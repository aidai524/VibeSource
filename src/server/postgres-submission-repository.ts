import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolClient, QueryResultRow } from "pg";

import {
  DEMO_EVIDENCE_CHECK_VERSION,
  EMPTY_DEMO_EVIDENCE,
  type DemoEvidenceAttempt,
  type DemoEvidenceErrorCode,
  type DemoEvidenceResult,
  type DemoEvidenceView,
} from "@/domain/demo-evidence";
import {
  EMPTY_GITHUB_EVIDENCE,
  GITHUB_API_VERSION,
  type GitHubEvidenceAttempt,
  type GitHubEvidenceErrorCode,
  type GitHubEvidenceResult,
  type GitHubEvidenceView,
  type GitHubLicenseDetection,
} from "@/domain/github-evidence";
import {
  normalizeBoundedString,
  normalizeIdempotencyKey,
  normalizeRejectSubmissionInput,
  normalizeSubmissionInput,
  REVIEW_ACTOR_LIMITS,
  SubmissionConflictError,
  SubmissionNotFoundError,
  SubmissionStateError,
  type RejectSubmissionInput,
  type ReviewEvent,
  type ReviewEventType,
  type Submission,
  type SubmissionInput,
  type SubmissionStatus,
} from "@/domain/submission";
import type { SubmissionStoreRepository } from "@/server/submission-store";

type PostgresDatabase = Pick<Pool, "query" | "connect">;
type SqlRow = QueryResultRow;

export interface PostgresSubmissionRepositoryDependencies {
  now?: () => Date;
  generateId?: () => string;
}

function requiredText(row: SqlRow, column: string): string {
  const value = row[column];
  if (typeof value !== "string") {
    throw new Error(`Database column ${column} is not text.`);
  }
  return value;
}

function nullableText(row: SqlRow, column: string): string | null {
  const value = row[column];
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new Error(`Database column ${column} is not nullable text.`);
  }
  return value;
}

function requiredNumber(row: SqlRow, column: string): number {
  const value = row[column];
  const number = typeof value === "string" ? Number(value) : value;
  if (typeof number !== "number" || !Number.isSafeInteger(number)) {
    throw new Error(`Database column ${column} is not a safe integer.`);
  }
  return number;
}

function nullableNumber(row: SqlRow, column: string): number | null {
  if (row[column] === null) return null;
  return requiredNumber(row, column);
}

function requiredBoolean(row: SqlRow, column: string): boolean {
  const value = row[column];
  if (typeof value !== "boolean") {
    throw new Error(`Database column ${column} is not boolean.`);
  }
  return value;
}

function timestamp(value: unknown, column: string): string {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) return parsed.toISOString();
  }
  throw new Error(`Database column ${column} is not a timestamp.`);
}

function nullableTimestamp(row: SqlRow, column: string): string | null {
  return row[column] === null ? null : timestamp(row[column], column);
}

function submissionStatus(value: string): SubmissionStatus {
  if (value === "pending_review" || value === "rejected") return value;
  throw new Error(`Database contains unsupported submission status: ${value}.`);
}

function reviewEventType(value: string): ReviewEventType {
  if (value === "submitted" || value === "rejected") return value;
  throw new Error(`Database contains unsupported review event type: ${value}.`);
}

function mapSubmission(row: SqlRow): Submission {
  const evidenceStatus = requiredText(row, "evidence_status");
  if (evidenceStatus !== "not_checked") {
    throw new Error(`Database contains unsupported evidence status: ${evidenceStatus}.`);
  }
  return {
    id: requiredText(row, "id"),
    productName: requiredText(row, "product_name"),
    summary: requiredText(row, "summary"),
    repositoryUrl: requiredText(row, "repository_url"),
    experienceUrl: requiredText(row, "experience_url"),
    aiInvolvement: requiredText(row, "ai_involvement"),
    techStack: requiredText(row, "tech_stack"),
    licenseName: requiredText(row, "license_name"),
    reuseNotes: requiredText(row, "reuse_notes"),
    status: submissionStatus(requiredText(row, "status")),
    evidenceStatus,
    version: requiredNumber(row, "version"),
    createdAt: timestamp(row.created_at, "created_at"),
    updatedAt: timestamp(row.updated_at, "updated_at"),
  };
}

function mapReviewEvent(row: SqlRow): ReviewEvent {
  const fromStatus = nullableText(row, "from_status");
  return {
    id: requiredText(row, "id"),
    submissionId: requiredText(row, "submission_id"),
    eventType: reviewEventType(requiredText(row, "event_type")),
    fromStatus: fromStatus === null ? null : submissionStatus(fromStatus),
    toStatus: submissionStatus(requiredText(row, "to_status")),
    actor: requiredText(row, "actor"),
    reason: requiredText(row, "reason"),
    createdAt: timestamp(row.created_at, "created_at"),
  };
}

function githubErrorCode(value: string): GitHubEvidenceErrorCode {
  if (
    value === "not_found" || value === "rate_limited" ||
    value === "timeout" || value === "network_error" ||
    value === "invalid_response" || value === "github_http_error"
  ) return value;
  throw new Error(`Database contains unsupported GitHub error code: ${value}.`);
}

function githubLicenseDetection(value: string): GitHubLicenseDetection {
  if (value === "detected" || value === "not_detected") return value;
  throw new Error(`Database contains unsupported license detection: ${value}.`);
}

function mapGitHubAttempt(row: SqlRow): GitHubEvidenceAttempt {
  const apiVersion = requiredText(row, "api_version");
  if (apiVersion !== GITHUB_API_VERSION) {
    throw new Error(`Database contains unsupported GitHub API version: ${apiVersion}.`);
  }
  const base = {
    id: requiredText(row, "id"),
    submissionId: requiredText(row, "submission_id"),
    actor: requiredText(row, "actor"),
    sourceUrl: requiredText(row, "source_url"),
    apiVersion: GITHUB_API_VERSION,
    observedAt: timestamp(row.observed_at, "observed_at"),
    httpStatus: nullableNumber(row, "http_status"),
    rateLimit: {
      limit: nullableNumber(row, "rate_limit_limit"),
      remaining: nullableNumber(row, "rate_limit_remaining"),
      resetAt: nullableTimestamp(row, "rate_limit_reset_at"),
    },
  } as const;
  const outcome = requiredText(row, "outcome");
  if (outcome === "error") {
    return {
      ...base,
      outcome,
      repository: null,
      errorCode: githubErrorCode(requiredText(row, "error_code")),
      errorMessage: requiredText(row, "error_message"),
    };
  }
  if (outcome !== "success") {
    throw new Error(`Database contains unsupported GitHub outcome: ${outcome}.`);
  }
  return {
    ...base,
    outcome,
    errorCode: null,
    errorMessage: null,
    repository: {
      repositoryId: requiredText(row, "repository_id"),
      fullName: requiredText(row, "full_name"),
      htmlUrl: requiredText(row, "html_url"),
      visibility: requiredText(row, "visibility"),
      isPrivate: requiredBoolean(row, "is_private"),
      archived: requiredBoolean(row, "archived"),
      isFork: requiredBoolean(row, "is_fork"),
      defaultBranch: requiredText(row, "default_branch"),
      pushedAt: timestamp(row.pushed_at, "pushed_at"),
      stars: requiredNumber(row, "stargazers_count"),
      forks: requiredNumber(row, "forks_count"),
      openIssues: requiredNumber(row, "open_issues_count"),
      licenseDetection: githubLicenseDetection(requiredText(row, "license_detection")),
      licenseKey: nullableText(row, "license_key"),
      licenseName: nullableText(row, "license_name"),
      licenseSpdxId: nullableText(row, "license_spdx_id"),
      licenseUrl: nullableText(row, "license_url"),
    },
  };
}

function demoErrorCode(value: string): DemoEvidenceErrorCode {
  if (
    value === "dns_resolution_failed" || value === "unsafe_address" ||
    value === "timeout" || value === "tls_error" ||
    value === "network_error" || value === "redirect_blocked" ||
    value === "http_error" || value === "invalid_response"
  ) return value;
  throw new Error(`Database contains unsupported Demo error code: ${value}.`);
}

function mapDemoAttempt(row: SqlRow): DemoEvidenceAttempt {
  const checkVersion = requiredText(row, "check_version");
  if (checkVersion !== DEMO_EVIDENCE_CHECK_VERSION) {
    throw new Error(`Database contains unsupported Demo check version: ${checkVersion}.`);
  }
  const method = requiredText(row, "method");
  if (method !== "GET") throw new Error(`Database contains unsupported Demo method: ${method}.`);
  const base = {
    id: requiredText(row, "id"),
    submissionId: requiredText(row, "submission_id"),
    actor: requiredText(row, "actor"),
    sourceUrl: requiredText(row, "source_url"),
    checkVersion: DEMO_EVIDENCE_CHECK_VERSION,
    observedAt: timestamp(row.observed_at, "observed_at"),
    method,
    httpStatus: nullableNumber(row, "http_status"),
    contentType: nullableText(row, "content_type"),
    resolvedAddress: nullableText(row, "resolved_address"),
    resolvedFamily: nullableNumber(row, "resolved_family"),
    responseTimeMs: nullableNumber(row, "response_time_ms"),
  } as const;
  const outcome = requiredText(row, "outcome");
  if (outcome === "error") {
    return {
      ...base,
      outcome,
      resolvedFamily: base.resolvedFamily as 4 | 6 | null,
      errorCode: demoErrorCode(requiredText(row, "error_code")),
      errorMessage: requiredText(row, "error_message"),
    };
  }
  if (
    outcome !== "success" || base.httpStatus === null ||
    base.resolvedAddress === null ||
    (base.resolvedFamily !== 4 && base.resolvedFamily !== 6) ||
    base.responseTimeMs === null
  ) throw new Error("Database contains an incomplete Demo success attempt.");
  return {
    ...base,
    outcome,
    httpStatus: base.httpStatus,
    resolvedAddress: base.resolvedAddress,
    resolvedFamily: base.resolvedFamily,
    responseTimeMs: base.responseTimeMs,
    errorCode: null,
    errorMessage: null,
  };
}

function hashIdempotencyKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

function constraintName(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const record = error as Record<string, unknown>;
  if (typeof record.constraint === "string") return record.constraint;
  if (typeof record.message !== "string") return null;
  if (record.message.includes("vibesource_submissions_pending_repository_idx")) {
    return "vibesource_submissions_pending_repository_idx";
  }
  return null;
}

const submissionColumns = `
  id, product_name, summary, repository_url, experience_url, ai_involvement,
  tech_stack, license_name, reuse_notes, status, evidence_status, version,
  created_at, updated_at
`;

const githubColumns = `
  id, submission_id, actor, outcome, source_url, api_version, observed_at,
  http_status, error_code, error_message, rate_limit_limit,
  rate_limit_remaining, rate_limit_reset_at, repository_id, full_name,
  html_url, visibility, is_private, archived, is_fork, default_branch,
  pushed_at, stargazers_count, forks_count, open_issues_count,
  license_detection, license_key, license_name, license_spdx_id, license_url
`;

const demoColumns = `
  id, submission_id, actor, outcome, source_url, check_version, observed_at,
  method, http_status, content_type, resolved_address, resolved_family,
  response_time_ms, error_code, error_message
`;

export class PostgresSubmissionRepository implements SubmissionStoreRepository {
  private readonly now: () => Date;
  private readonly generateId: () => string;

  constructor(
    private readonly database: PostgresDatabase,
    dependencies: PostgresSubmissionRepositoryDependencies = {},
  ) {
    this.now = dependencies.now ?? (() => new Date());
    this.generateId = dependencies.generateId ?? randomUUID;
  }

  private async transaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.database.connect();
    try {
      await client.query("begin");
      const result = await operation(client);
      await client.query("commit");
      return result;
    } catch (error) {
      try {
        await client.query("rollback");
      } catch {
        // Preserve the original operation failure.
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async createSubmission(input: SubmissionInput, idempotencyKey: string): Promise<Submission> {
    const normalized = normalizeSubmissionInput(input);
    const keyHash = hashIdempotencyKey(normalizeIdempotencyKey(idempotencyKey));
    const id = this.generateId();
    const eventId = this.generateId();
    const observedAt = this.now();

    try {
      return await this.transaction(async (client) => {
        const inserted = await client.query(
          `insert into vibesource_submissions (
             id, product_name, summary, repository_url, experience_url,
             ai_involvement, tech_stack, license_name, reuse_notes,
             status, evidence_status, idempotency_key_hash, version,
             created_at, updated_at
           ) values (
             $1, $2, $3, $4, $5, $6, $7, $8, $9,
             'pending_review', 'not_checked', $10, 1, $11, $11
           )
           on conflict (idempotency_key_hash) do nothing
           returning ${submissionColumns}`,
          [
            id, normalized.productName, normalized.summary,
            normalized.repositoryUrl, normalized.experienceUrl,
            normalized.aiInvolvement, normalized.techStack,
            normalized.licenseName, normalized.reuseNotes, keyHash, observedAt,
          ],
        );
        if (inserted.rows.length === 0) {
          const replay = await client.query(
            `select ${submissionColumns} from vibesource_submissions
              where idempotency_key_hash = $1`,
            [keyHash],
          );
          if (!replay.rows[0]) throw new Error("Idempotent submission replay was not visible.");
          return mapSubmission(replay.rows[0]);
        }

        await client.query(
          `insert into vibesource_review_events (
             id, submission_id, event_type, from_status, to_status,
             actor, reason, created_at
           ) values ($1, $2, 'submitted', null, 'pending_review', 'system', $3, $4)`,
          [eventId, id, "Submission received for manual review.", observedAt],
        );
        return mapSubmission(inserted.rows[0]);
      });
    } catch (error) {
      if (constraintName(error) === "vibesource_submissions_pending_repository_idx") {
        throw new SubmissionConflictError(
          "repository",
          "A pending submission already exists for this repository.",
        );
      }
      throw error;
    }
  }

  async getSubmission(id: string): Promise<Submission | null> {
    const submissionId = normalizeBoundedString(id, "submissionId", { min: 1, max: 128 });
    const result = await this.database.query(
      `select ${submissionColumns} from vibesource_submissions where id = $1`,
      [submissionId],
    );
    return result.rows[0] ? mapSubmission(result.rows[0]) : null;
  }

  async listPending(): Promise<Submission[]> {
    const result = await this.database.query(
      `select ${submissionColumns} from vibesource_submissions
        where status = 'pending_review' order by created_at, id`,
    );
    return result.rows.map(mapSubmission);
  }

  async recordGitHubEvidenceAttempt(
    submissionId: string,
    actor: string,
    result: GitHubEvidenceResult,
  ): Promise<GitHubEvidenceView> {
    const id = normalizeBoundedString(submissionId, "submissionId", { min: 1, max: 128 });
    const normalizedActor = normalizeBoundedString(actor, "actor", REVIEW_ACTOR_LIMITS);
    const repository = result.repository;
    await this.transaction(async (client) => {
      await this.requirePending(client, id, "GitHub evidence");
      await client.query(
        `insert into vibesource_github_evidence_attempts (
           id, submission_id, actor, outcome, source_url, api_version,
           observed_at, http_status, error_code, error_message,
           rate_limit_limit, rate_limit_remaining, rate_limit_reset_at,
           repository_id, full_name, html_url, visibility, is_private,
           archived, is_fork, default_branch, pushed_at, stargazers_count,
           forks_count, open_issues_count, license_detection, license_key,
           license_name, license_spdx_id, license_url
         ) values (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
           $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
           $21, $22, $23, $24, $25, $26, $27, $28, $29, $30
         )`,
        [
          this.generateId(), id, normalizedActor, result.outcome,
          result.sourceUrl, result.apiVersion, result.observedAt,
          result.httpStatus, result.errorCode, result.errorMessage,
          result.rateLimit.limit, result.rateLimit.remaining,
          result.rateLimit.resetAt, repository?.repositoryId ?? null,
          repository?.fullName ?? null, repository?.htmlUrl ?? null,
          repository?.visibility ?? null, repository?.isPrivate ?? null,
          repository?.archived ?? null, repository?.isFork ?? null,
          repository?.defaultBranch ?? null, repository?.pushedAt ?? null,
          repository?.stars ?? null, repository?.forks ?? null,
          repository?.openIssues ?? null, repository?.licenseDetection ?? null,
          repository?.licenseKey ?? null, repository?.licenseName ?? null,
          repository?.licenseSpdxId ?? null, repository?.licenseUrl ?? null,
        ],
      );
    });
    return this.getGitHubEvidence(id);
  }

  async getGitHubEvidence(submissionId: string): Promise<GitHubEvidenceView> {
    const id = normalizeBoundedString(submissionId, "submissionId", { min: 1, max: 128 });
    const latest = await this.database.query(
      `select ${githubColumns} from vibesource_github_evidence_attempts
        where submission_id = $1 order by observed_at desc, sequence desc limit 1`,
      [id],
    );
    if (!latest.rows[0]) return EMPTY_GITHUB_EVIDENCE;
    const latestAttempt = mapGitHubAttempt(latest.rows[0]);
    const usable = await this.database.query(
      `select ${githubColumns} from vibesource_github_evidence_attempts
        where submission_id = $1 and outcome = 'success'
        order by observed_at desc, sequence desc limit 1`,
      [id],
    );
    const latestUsableAttempt = usable.rows[0] ? mapGitHubAttempt(usable.rows[0]) : null;
    return {
      state: latestAttempt.outcome === "success"
        ? "observed"
        : latestUsableAttempt === null ? "error" : "stale",
      latestAttempt,
      latestUsableAttempt,
    };
  }

  async recordDemoEvidenceAttempt(
    submissionId: string,
    actor: string,
    result: DemoEvidenceResult,
  ): Promise<DemoEvidenceView> {
    const id = normalizeBoundedString(submissionId, "submissionId", { min: 1, max: 128 });
    const normalizedActor = normalizeBoundedString(actor, "actor", REVIEW_ACTOR_LIMITS);
    await this.transaction(async (client) => {
      await this.requirePending(client, id, "Demo evidence");
      await client.query(
        `insert into vibesource_demo_evidence_attempts (
           id, submission_id, actor, outcome, source_url, check_version,
           observed_at, method, http_status, content_type, resolved_address,
           resolved_family, response_time_ms, error_code, error_message
         ) values (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
           $11, $12, $13, $14, $15
         )`,
        [
          this.generateId(), id, normalizedActor, result.outcome,
          result.sourceUrl, result.checkVersion, result.observedAt,
          result.method, result.httpStatus, result.contentType,
          result.resolvedAddress, result.resolvedFamily,
          result.responseTimeMs, result.errorCode, result.errorMessage,
        ],
      );
    });
    return this.getDemoEvidence(id);
  }

  async getDemoEvidence(submissionId: string): Promise<DemoEvidenceView> {
    const id = normalizeBoundedString(submissionId, "submissionId", { min: 1, max: 128 });
    const latest = await this.database.query(
      `select ${demoColumns} from vibesource_demo_evidence_attempts
        where submission_id = $1 order by observed_at desc, sequence desc limit 1`,
      [id],
    );
    if (!latest.rows[0]) return EMPTY_DEMO_EVIDENCE;
    const latestAttempt = mapDemoAttempt(latest.rows[0]);
    const usable = await this.database.query(
      `select ${demoColumns} from vibesource_demo_evidence_attempts
        where submission_id = $1 and outcome = 'success'
        order by observed_at desc, sequence desc limit 1`,
      [id],
    );
    const latestUsableAttempt = usable.rows[0] ? mapDemoAttempt(usable.rows[0]) : null;
    return {
      state: latestAttempt.outcome === "success"
        ? "observed"
        : latestUsableAttempt === null ? "error" : "stale",
      latestAttempt,
      latestUsableAttempt,
    };
  }

  async rejectSubmission(id: string, input: RejectSubmissionInput): Promise<Submission> {
    const submissionId = normalizeBoundedString(id, "submissionId", { min: 1, max: 128 });
    const normalized = normalizeRejectSubmissionInput(input);
    const updatedAt = this.now();
    return this.transaction(async (client) => {
      const currentResult = await client.query(
        `select ${submissionColumns} from vibesource_submissions
          where id = $1 for update`,
        [submissionId],
      );
      const row = currentResult.rows[0];
      if (!row) throw new SubmissionNotFoundError(submissionId);
      const current = mapSubmission(row);
      if (current.status !== "pending_review") {
        throw new SubmissionStateError("Only a pending submission can be rejected.");
      }
      if (current.version !== normalized.expectedVersion) {
        throw new SubmissionConflictError(
          "version",
          `Expected submission version ${normalized.expectedVersion}, but found ${current.version}.`,
        );
      }
      const updated = await client.query(
        `update vibesource_submissions
            set status = 'rejected', version = version + 1, updated_at = $1
          where id = $2 and status = 'pending_review' and version = $3
          returning ${submissionColumns}`,
        [updatedAt, submissionId, normalized.expectedVersion],
      );
      if (!updated.rows[0]) {
        throw new SubmissionConflictError("version", "The submission changed before rejection.");
      }
      await client.query(
        `insert into vibesource_review_events (
           id, submission_id, event_type, from_status, to_status,
           actor, reason, created_at
         ) values ($1, $2, 'rejected', 'pending_review', 'rejected', $3, $4, $5)`,
        [this.generateId(), submissionId, normalized.actor, normalized.reason, updatedAt],
      );
      return mapSubmission(updated.rows[0]);
    });
  }

  async listReviewEvents(submissionId: string): Promise<ReviewEvent[]> {
    const id = normalizeBoundedString(submissionId, "submissionId", { min: 1, max: 128 });
    const result = await this.database.query(
      `select id, submission_id, event_type, from_status, to_status,
              actor, reason, created_at
         from vibesource_review_events where submission_id = $1
         order by created_at, sequence`,
      [id],
    );
    return result.rows.map(mapReviewEvent);
  }

  private async requirePending(
    client: PoolClient,
    submissionId: string,
    label: string,
  ): Promise<void> {
    const result = await client.query(
      "select status from vibesource_submissions where id = $1 for update",
      [submissionId],
    );
    if (!result.rows[0]) throw new SubmissionNotFoundError(submissionId);
    if (result.rows[0].status !== "pending_review") {
      throw new SubmissionStateError(`${label} can only be refreshed for a pending submission.`);
    }
  }
}
