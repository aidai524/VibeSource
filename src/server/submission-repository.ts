import { createHash, randomUUID } from "node:crypto";
import type { SQLOutputValue } from "node:sqlite";

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
import type { Database } from "@/server/database";

type SqlRow = Record<string, SQLOutputValue>;

export interface SubmissionRepositoryDependencies {
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
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(`Database column ${column} is not nullable text.`);
  }
  return value;
}

function requiredNumber(row: SqlRow, column: string): number {
  const value = row[column];
  if (typeof value !== "number") {
    throw new Error(`Database column ${column} is not numeric.`);
  }
  return value;
}

function nullableNumber(row: SqlRow, column: string): number | null {
  const value = row[column];
  if (value === null) {
    return null;
  }
  if (typeof value !== "number") {
    throw new Error(`Database column ${column} is not nullable numeric.`);
  }
  return value;
}

function requiredBoolean(row: SqlRow, column: string): boolean {
  const value = requiredNumber(row, column);
  if (value !== 0 && value !== 1) {
    throw new Error(`Database column ${column} is not boolean.`);
  }
  return value === 1;
}

function submissionStatus(value: string): SubmissionStatus {
  if (value === "pending_review" || value === "rejected") {
    return value;
  }
  throw new Error(`Database contains unsupported submission status: ${value}.`);
}

function reviewEventType(value: string): ReviewEventType {
  if (value === "submitted" || value === "rejected") {
    return value;
  }
  throw new Error(`Database contains unsupported review event type: ${value}.`);
}

function mapSubmission(row: SqlRow): Submission {
  const evidenceStatus = requiredText(row, "evidence_status");
  if (evidenceStatus !== "not_checked") {
    throw new Error(
      `Database contains unsupported evidence status: ${evidenceStatus}.`,
    );
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
    createdAt: requiredText(row, "created_at"),
    updatedAt: requiredText(row, "updated_at"),
  };
}

function mapReviewEvent(row: SqlRow): ReviewEvent {
  const fromStatusValue = nullableText(row, "from_status");

  return {
    id: requiredText(row, "id"),
    submissionId: requiredText(row, "submission_id"),
    eventType: reviewEventType(requiredText(row, "event_type")),
    fromStatus:
      fromStatusValue === null ? null : submissionStatus(fromStatusValue),
    toStatus: submissionStatus(requiredText(row, "to_status")),
    actor: requiredText(row, "actor"),
    reason: requiredText(row, "reason"),
    createdAt: requiredText(row, "created_at"),
  };
}

function githubEvidenceErrorCode(value: string): GitHubEvidenceErrorCode {
  if (
    value === "not_found" ||
    value === "rate_limited" ||
    value === "timeout" ||
    value === "network_error" ||
    value === "invalid_response" ||
    value === "github_http_error"
  ) {
    return value;
  }
  throw new Error(`Database contains unsupported GitHub error code: ${value}.`);
}

function githubLicenseDetection(value: string): GitHubLicenseDetection {
  if (value === "detected" || value === "not_detected") {
    return value;
  }
  throw new Error(
    `Database contains unsupported GitHub license detection: ${value}.`,
  );
}

function mapGitHubEvidenceAttempt(row: SqlRow): GitHubEvidenceAttempt {
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
    observedAt: requiredText(row, "observed_at"),
    httpStatus: nullableNumber(row, "http_status"),
    rateLimit: {
      limit: nullableNumber(row, "rate_limit_limit"),
      remaining: nullableNumber(row, "rate_limit_remaining"),
      resetAt: nullableText(row, "rate_limit_reset_at"),
    },
  } as const;

  const outcome = requiredText(row, "outcome");
  if (outcome === "error") {
    return {
      ...base,
      outcome,
      repository: null,
      errorCode: githubEvidenceErrorCode(requiredText(row, "error_code")),
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
      pushedAt: requiredText(row, "pushed_at"),
      stars: requiredNumber(row, "stargazers_count"),
      forks: requiredNumber(row, "forks_count"),
      openIssues: requiredNumber(row, "open_issues_count"),
      licenseDetection: githubLicenseDetection(
        requiredText(row, "license_detection"),
      ),
      licenseKey: nullableText(row, "license_key"),
      licenseName: nullableText(row, "license_name"),
      licenseSpdxId: nullableText(row, "license_spdx_id"),
      licenseUrl: nullableText(row, "license_url"),
    },
  };
}

function hashIdempotencyKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.toLowerCase().includes("unique constraint failed")
  );
}

function rollback(database: Database): void {
  try {
    database.exec("ROLLBACK");
  } catch {
    // Preserve the domain or SQLite failure if the transaction is already closed.
  }
}

const submissionColumns = `
  id,
  product_name,
  summary,
  repository_url,
  experience_url,
  ai_involvement,
  tech_stack,
  license_name,
  reuse_notes,
  status,
  evidence_status,
  version,
  created_at,
  updated_at
`;

const githubEvidenceColumns = `
  id,
  submission_id,
  actor,
  outcome,
  source_url,
  api_version,
  observed_at,
  http_status,
  error_code,
  error_message,
  rate_limit_limit,
  rate_limit_remaining,
  rate_limit_reset_at,
  repository_id,
  full_name,
  html_url,
  visibility,
  is_private,
  archived,
  is_fork,
  default_branch,
  pushed_at,
  stargazers_count,
  forks_count,
  open_issues_count,
  license_detection,
  license_key,
  license_name,
  license_spdx_id,
  license_url
`;

export class SubmissionRepository {
  private readonly now: () => Date;
  private readonly generateId: () => string;

  constructor(
    private readonly database: Database,
    dependencies: SubmissionRepositoryDependencies = {},
  ) {
    this.now = dependencies.now ?? (() => new Date());
    this.generateId = dependencies.generateId ?? randomUUID;
  }

  createSubmission(
    input: SubmissionInput,
    idempotencyKey: string,
  ): Submission {
    const normalizedKey = normalizeIdempotencyKey(idempotencyKey);
    const keyHash = hashIdempotencyKey(normalizedKey);
    const replay = this.findByIdempotencyHash(keyHash);
    if (replay !== null) {
      return replay;
    }

    const normalized = normalizeSubmissionInput(input);
    const id = this.generateId();
    const eventId = this.generateId();
    const timestamp = this.now().toISOString();

    this.database.exec("BEGIN IMMEDIATE");
    try {
      const concurrentReplay = this.findByIdempotencyHash(keyHash);
      if (concurrentReplay !== null) {
        this.database.exec("COMMIT");
        return concurrentReplay;
      }

      this.database
        .prepare(
          `
            INSERT INTO submissions (
              id,
              product_name,
              summary,
              repository_url,
              experience_url,
              ai_involvement,
              tech_stack,
              license_name,
              reuse_notes,
              status,
              evidence_status,
              idempotency_key_hash,
              version,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_review', 'not_checked', ?, 1, ?, ?)
          `,
        )
        .run(
          id,
          normalized.productName,
          normalized.summary,
          normalized.repositoryUrl,
          normalized.experienceUrl,
          normalized.aiInvolvement,
          normalized.techStack,
          normalized.licenseName,
          normalized.reuseNotes,
          keyHash,
          timestamp,
          timestamp,
        );

      this.database
        .prepare(
          `
            INSERT INTO review_events (
              id,
              submission_id,
              event_type,
              from_status,
              to_status,
              actor,
              reason,
              created_at
            ) VALUES (?, ?, 'submitted', NULL, 'pending_review', 'system', ?, ?)
          `,
        )
        .run(
          eventId,
          id,
          "Submission received for manual review.",
          timestamp,
        );

      this.database.exec("COMMIT");
    } catch (error) {
      rollback(this.database);

      if (isUniqueConstraintError(error)) {
        const idempotentReplay = this.findByIdempotencyHash(keyHash);
        if (idempotentReplay !== null) {
          return idempotentReplay;
        }

        if (this.hasPendingRepository(normalized.repositoryUrl)) {
          throw new SubmissionConflictError(
            "repository",
            "A pending submission already exists for this repository.",
          );
        }
      }

      throw error;
    }

    const created = this.getSubmission(id);
    if (created === null) {
      throw new Error("The committed submission could not be read back.");
    }
    return created;
  }

  getSubmission(id: string): Submission | null {
    const submissionId = normalizeBoundedString(id, "submissionId", {
      min: 1,
      max: 128,
    });
    const row = this.database
      .prepare(`SELECT ${submissionColumns} FROM submissions WHERE id = ?`)
      .get(submissionId);

    return row === undefined ? null : mapSubmission(row);
  }

  listPending(): Submission[] {
    return this.database
      .prepare(
        `
          SELECT ${submissionColumns}
          FROM submissions
          WHERE status = 'pending_review'
          ORDER BY created_at ASC, id ASC
        `,
      )
      .all()
      .map(mapSubmission);
  }

  recordGitHubEvidenceAttempt(
    submissionId: string,
    actor: string,
    result: GitHubEvidenceResult,
  ): GitHubEvidenceView {
    const normalizedId = normalizeBoundedString(
      submissionId,
      "submissionId",
      { min: 1, max: 128 },
    );
    const normalizedActor = normalizeBoundedString(
      actor,
      "actor",
      REVIEW_ACTOR_LIMITS,
    );
    const attemptId = this.generateId();
    const repository = result.repository;

    this.database.exec("BEGIN IMMEDIATE");
    try {
      const submission = this.getSubmission(normalizedId);
      if (submission === null) {
        throw new SubmissionNotFoundError(normalizedId);
      }
      if (submission.status !== "pending_review") {
        throw new SubmissionStateError(
          "GitHub evidence can only be refreshed for a pending submission.",
        );
      }

      this.database
        .prepare(
          `
            INSERT INTO github_evidence_attempts (
              id,
              submission_id,
              actor,
              outcome,
              source_url,
              api_version,
              observed_at,
              http_status,
              error_code,
              error_message,
              rate_limit_limit,
              rate_limit_remaining,
              rate_limit_reset_at,
              repository_id,
              full_name,
              html_url,
              visibility,
              is_private,
              archived,
              is_fork,
              default_branch,
              pushed_at,
              stargazers_count,
              forks_count,
              open_issues_count,
              license_detection,
              license_key,
              license_name,
              license_spdx_id,
              license_url
            ) VALUES (
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
          `,
        )
        .run(
          attemptId,
          normalizedId,
          normalizedActor,
          result.outcome,
          result.sourceUrl,
          result.apiVersion,
          result.observedAt,
          result.httpStatus,
          result.errorCode,
          result.errorMessage,
          result.rateLimit.limit,
          result.rateLimit.remaining,
          result.rateLimit.resetAt,
          repository?.repositoryId ?? null,
          repository?.fullName ?? null,
          repository?.htmlUrl ?? null,
          repository?.visibility ?? null,
          repository === null ? null : Number(repository.isPrivate),
          repository === null ? null : Number(repository.archived),
          repository === null ? null : Number(repository.isFork),
          repository?.defaultBranch ?? null,
          repository?.pushedAt ?? null,
          repository?.stars ?? null,
          repository?.forks ?? null,
          repository?.openIssues ?? null,
          repository?.licenseDetection ?? null,
          repository?.licenseKey ?? null,
          repository?.licenseName ?? null,
          repository?.licenseSpdxId ?? null,
          repository?.licenseUrl ?? null,
        );
      this.database.exec("COMMIT");
    } catch (error) {
      rollback(this.database);
      throw error;
    }

    return this.getGitHubEvidence(normalizedId);
  }

  getGitHubEvidence(submissionId: string): GitHubEvidenceView {
    const normalizedId = normalizeBoundedString(
      submissionId,
      "submissionId",
      { min: 1, max: 128 },
    );
    const queryLatest = (successOnly: boolean): GitHubEvidenceAttempt | null => {
      const row = this.database
        .prepare(
          `
            SELECT ${githubEvidenceColumns}
            FROM github_evidence_attempts
            WHERE submission_id = ?${successOnly ? " AND outcome = 'success'" : ""}
            ORDER BY observed_at DESC, rowid DESC
            LIMIT 1
          `,
        )
        .get(normalizedId);
      return row === undefined ? null : mapGitHubEvidenceAttempt(row);
    };

    const latestAttempt = queryLatest(false);
    if (latestAttempt === null) {
      return EMPTY_GITHUB_EVIDENCE;
    }
    const latestUsableAttempt = queryLatest(true);
    return {
      state:
        latestAttempt.outcome === "success"
          ? "observed"
          : latestUsableAttempt === null
            ? "error"
            : "stale",
      latestAttempt,
      latestUsableAttempt,
    };
  }

  rejectSubmission(id: string, input: RejectSubmissionInput): Submission {
    const submissionId = normalizeBoundedString(id, "submissionId", {
      min: 1,
      max: 128,
    });
    const normalized = normalizeRejectSubmissionInput(input);
    const timestamp = this.now().toISOString();
    const eventId = this.generateId();

    this.database.exec("BEGIN IMMEDIATE");
    try {
      const current = this.getSubmission(submissionId);
      if (current === null) {
        throw new SubmissionNotFoundError(submissionId);
      }
      if (current.status !== "pending_review") {
        throw new SubmissionStateError(
          "Only a pending submission can be rejected.",
        );
      }
      if (current.version !== normalized.expectedVersion) {
        throw new SubmissionConflictError(
          "version",
          `Expected submission version ${normalized.expectedVersion}, but found ${current.version}.`,
        );
      }

      const updateResult = this.database
        .prepare(
          `
            UPDATE submissions
            SET status = 'rejected', version = version + 1, updated_at = ?
            WHERE id = ? AND status = 'pending_review' AND version = ?
          `,
        )
        .run(timestamp, submissionId, normalized.expectedVersion);

      if (updateResult.changes !== 1) {
        throw new SubmissionConflictError(
          "version",
          "The submission changed before it could be rejected.",
        );
      }

      this.database
        .prepare(
          `
            INSERT INTO review_events (
              id,
              submission_id,
              event_type,
              from_status,
              to_status,
              actor,
              reason,
              created_at
            ) VALUES (?, ?, 'rejected', 'pending_review', 'rejected', ?, ?, ?)
          `,
        )
        .run(
          eventId,
          submissionId,
          normalized.actor,
          normalized.reason,
          timestamp,
        );

      this.database.exec("COMMIT");
    } catch (error) {
      rollback(this.database);
      throw error;
    }

    const rejected = this.getSubmission(submissionId);
    if (rejected === null) {
      throw new Error("The rejected submission could not be read back.");
    }
    return rejected;
  }

  listReviewEvents(submissionId: string): ReviewEvent[] {
    const normalizedId = normalizeBoundedString(
      submissionId,
      "submissionId",
      { min: 1, max: 128 },
    );

    return this.database
      .prepare(
        `
          SELECT
            id,
            submission_id,
            event_type,
            from_status,
            to_status,
            actor,
            reason,
            created_at
          FROM review_events
          WHERE submission_id = ?
          ORDER BY created_at ASC, rowid ASC
        `,
      )
      .all(normalizedId)
      .map(mapReviewEvent);
  }

  private findByIdempotencyHash(keyHash: string): Submission | null {
    const row = this.database
      .prepare(
        `
          SELECT ${submissionColumns}
          FROM submissions
          WHERE idempotency_key_hash = ?
        `,
      )
      .get(keyHash);

    return row === undefined ? null : mapSubmission(row);
  }

  private hasPendingRepository(repositoryUrl: string): boolean {
    return (
      this.database
        .prepare(
          `
            SELECT 1 AS found
            FROM submissions
            WHERE repository_url = ? AND status = 'pending_review'
          `,
        )
        .get(repositoryUrl) !== undefined
    );
  }
}
