import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Pool } from "pg";

import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  DEMO_EVIDENCE_CHECK_VERSION,
  type DemoEvidenceFailure,
  type DemoEvidenceSuccess,
} from "@/domain/demo-evidence";
import {
  GITHUB_API_VERSION,
  type GitHubEvidenceFailure,
  type GitHubEvidenceSuccess,
} from "@/domain/github-evidence";
import {
  SubmissionConflictError,
  SubmissionStateError,
  type SubmissionInput,
} from "@/domain/submission";
import { PostgresSubmissionRepository } from "@/server/postgres-submission-repository";

const input: SubmissionInput = {
  productName: "Open Agent Studio",
  summary: "An open-source workspace for building inspectable AI agents.",
  repositoryUrl: "https://github.com/example-org/open-agent",
  experienceUrl: "https://demo.example.com/try",
  aiInvolvement: "AI assists implementation and is exposed as a visible capability.",
  techStack: "Next.js, TypeScript, PostgreSQL",
  licenseName: "Apache-2.0",
  reuseNotes: "Clone the repository and follow the documented deployment instructions.",
};

const githubSuccess: GitHubEvidenceSuccess = {
  outcome: "success",
  sourceUrl: "https://api.github.com/repos/example-org/open-agent",
  apiVersion: GITHUB_API_VERSION,
  observedAt: "2026-08-04T01:00:00.000Z",
  httpStatus: 200,
  rateLimit: { limit: 60, remaining: 59, resetAt: "2026-08-04T02:00:00.000Z" },
  errorCode: null,
  errorMessage: null,
  repository: {
    repositoryId: "12345",
    fullName: "example-org/open-agent",
    htmlUrl: "https://github.com/example-org/open-agent",
    visibility: "public",
    isPrivate: false,
    archived: false,
    isFork: false,
    defaultBranch: "main",
    pushedAt: "2026-08-03T20:00:00.000Z",
    stars: 42,
    forks: 7,
    openIssues: 3,
    licenseDetection: "detected",
    licenseKey: "apache-2.0",
    licenseName: "Apache License 2.0",
    licenseSpdxId: "Apache-2.0",
    licenseUrl: "https://api.github.com/licenses/apache-2.0",
  },
};

const githubFailure: GitHubEvidenceFailure = {
  outcome: "error",
  sourceUrl: githubSuccess.sourceUrl,
  apiVersion: GITHUB_API_VERSION,
  observedAt: "2026-08-04T02:00:00.000Z",
  httpStatus: 403,
  rateLimit: { limit: 60, remaining: 0, resetAt: "2026-08-04T03:00:00.000Z" },
  repository: null,
  errorCode: "rate_limited",
  errorMessage: "GitHub API rate limit was reached; no snapshot was saved.",
};

const demoSuccess: DemoEvidenceSuccess = {
  outcome: "success",
  sourceUrl: input.experienceUrl,
  checkVersion: DEMO_EVIDENCE_CHECK_VERSION,
  observedAt: "2026-08-04T03:00:00.000Z",
  method: "GET",
  httpStatus: 200,
  contentType: "text/html",
  resolvedAddress: "93.184.216.34",
  resolvedFamily: 4,
  responseTimeMs: 80,
  errorCode: null,
  errorMessage: null,
};

const demoFailure: DemoEvidenceFailure = {
  outcome: "error",
  sourceUrl: input.experienceUrl,
  checkVersion: DEMO_EVIDENCE_CHECK_VERSION,
  observedAt: "2026-08-04T04:00:00.000Z",
  method: "GET",
  httpStatus: 302,
  contentType: "text/html",
  resolvedAddress: "93.184.216.34",
  resolvedFamily: 4,
  responseTimeMs: 40,
  errorCode: "redirect_blocked",
  errorMessage: "The Demo redirected; redirects are not followed.",
};

function asPool(database: PGlite): Pick<Pool, "query" | "connect"> {
  const query = async (text: string, values?: unknown[]) => database.query(text, values);
  const client = { query, release() {} };
  return {
    query,
    connect: async () => client,
  } as unknown as Pick<Pool, "query" | "connect">;
}

let database: PGlite;
let repository: PostgresSubmissionRepository;
let nextId: number;

beforeEach(async () => {
  database = new PGlite();
  const migration = await readFile(
    join(process.cwd(), "migrations/0003_submission_business_storage.sql"),
    "utf8",
  );
  await database.exec(migration);
  nextId = 0;
  repository = new PostgresSubmissionRepository(asPool(database), {
    now: () => new Date("2026-08-04T00:00:00.000Z"),
    generateId: () => `postgres-test-${++nextId}`,
  });
});

afterEach(async () => {
  await database.close();
});

describe("PostgresSubmissionRepository", () => {
  it("atomically creates and idempotently replays a pending submission", async () => {
    const created = await repository.createSubmission(input, "postgres-request-0001");
    const replay = await repository.createSubmission(
      { ...input, productName: "Ignored replay name" },
      " postgres-request-0001 ",
    );

    expect(replay).toEqual(created);
    expect(created).toMatchObject({ status: "pending_review", version: 1 });
    expect(await repository.listPending()).toEqual([created]);
    expect(await repository.listReviewEvents(created.id)).toEqual([
      expect.objectContaining({ eventType: "submitted", actor: "system" }),
    ]);
  });

  it("enforces one pending record per repository and permits resubmission after rejection", async () => {
    const first = await repository.createSubmission(input, "postgres-request-0002");
    await expect(
      repository.createSubmission(input, "postgres-request-0003"),
    ).rejects.toBeInstanceOf(SubmissionConflictError);

    const rejected = await repository.rejectSubmission(first.id, {
      actor: "editor-1",
      reason: "The current experience path needs more verification.",
      expectedVersion: 1,
    });
    expect(rejected).toMatchObject({ status: "rejected", version: 2 });

    const resubmitted = await repository.createSubmission(
      { ...input, productName: "Open Agent Studio v2" },
      "postgres-request-0004",
    );
    expect(await repository.listPending()).toEqual([resubmitted]);
    await expect(
      repository.rejectSubmission(first.id, {
        actor: "editor-2",
        reason: "A second rejection must not rewrite review history.",
        expectedVersion: 2,
      }),
    ).rejects.toBeInstanceOf(SubmissionStateError);
  });

  it("preserves stale GitHub and Demo snapshots without changing submission state", async () => {
    const pending = await repository.createSubmission(input, "postgres-request-0005");
    await repository.recordGitHubEvidenceAttempt(pending.id, "editor-1", githubSuccess);
    const github = await repository.recordGitHubEvidenceAttempt(
      pending.id,
      "editor-1",
      githubFailure,
    );
    await repository.recordDemoEvidenceAttempt(pending.id, "editor-1", demoSuccess);
    const demo = await repository.recordDemoEvidenceAttempt(
      pending.id,
      "editor-1",
      demoFailure,
    );

    expect(github).toMatchObject({
      state: "stale",
      latestAttempt: { outcome: "error" },
      latestUsableAttempt: { outcome: "success" },
    });
    expect(demo).toMatchObject({
      state: "stale",
      latestAttempt: { outcome: "error" },
      latestUsableAttempt: { outcome: "success" },
    });
    expect(await repository.getSubmission(pending.id)).toEqual(pending);
  });

  it("makes audit and evidence rows append-only at the database boundary", async () => {
    const pending = await repository.createSubmission(input, "postgres-request-0006");
    await repository.recordGitHubEvidenceAttempt(pending.id, "editor-1", githubSuccess);
    await repository.recordDemoEvidenceAttempt(pending.id, "editor-1", demoSuccess);

    await expect(
      database.exec("update vibesource_review_events set actor = 'tampered'"),
    ).rejects.toThrow(/append-only/);
    await expect(
      database.exec("delete from vibesource_github_evidence_attempts"),
    ).rejects.toThrow(/append-only/);
    await expect(
      database.exec("update vibesource_demo_evidence_attempts set actor = 'tampered'"),
    ).rejects.toThrow(/append-only/);
  });
});
