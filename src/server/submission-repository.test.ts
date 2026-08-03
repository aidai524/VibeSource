import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  GITHUB_API_VERSION,
  type GitHubEvidenceFailure,
  type GitHubEvidenceSuccess,
} from "@/domain/github-evidence";
import {
  SubmissionConflictError,
  SubmissionStateError,
  SubmissionValidationError,
  type SubmissionInput,
} from "@/domain/submission";
import {
  createDatabase,
  migrateDatabase,
  type Database,
} from "@/server/database";
import { SubmissionRepository } from "@/server/submission-repository";

const validInput: SubmissionInput = {
  productName: "Open Agent Studio",
  summary: "An open-source workspace for building inspectable AI agents.",
  repositoryUrl: "https://github.com/example-org/open-agent.git",
  experienceUrl: "https://demo.example.com/try",
  aiInvolvement:
    "AI assists implementation and is exposed as a visible product capability.",
  techStack: "Next.js, TypeScript, SQLite",
  licenseName: "Apache-2.0",
  reuseNotes:
    "Clone the repository and follow the documented local deployment instructions.",
};

const openDatabases: Database[] = [];

const githubSuccess: GitHubEvidenceSuccess = {
  outcome: "success",
  sourceUrl: "https://api.github.com/repos/example-org/open-agent",
  apiVersion: GITHUB_API_VERSION,
  observedAt: "2026-08-03T01:00:00.000Z",
  httpStatus: 200,
  rateLimit: { limit: 60, remaining: 59, resetAt: "2026-08-03T02:00:00.000Z" },
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
    pushedAt: "2026-08-02T20:00:00.000Z",
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
  sourceUrl: "https://api.github.com/repos/example-org/open-agent",
  apiVersion: GITHUB_API_VERSION,
  observedAt: "2026-08-03T02:00:00.000Z",
  httpStatus: 403,
  rateLimit: { limit: 60, remaining: 0, resetAt: "2026-08-03T03:00:00.000Z" },
  repository: null,
  errorCode: "rate_limited",
  errorMessage: "GitHub API rate limit was reached. No repository snapshot was saved.",
};

function setupRepository(): {
  database: Database;
  repository: SubmissionRepository;
} {
  const database = createDatabase();
  openDatabases.push(database);

  return {
    database,
    repository: new SubmissionRepository(database, {
      now: () => new Date("2026-08-03T00:00:00.000Z"),
    }),
  };
}

afterEach(() => {
  while (openDatabases.length > 0) {
    openDatabases.pop()?.close();
  }
});

describe("SubmissionRepository", () => {
  it("creates one pending, unverified submission and a submitted audit event", () => {
    const { database, repository } = setupRepository();

    const created = repository.createSubmission(
      validInput,
      "submission-request-0001",
    );

    expect(created).toMatchObject({
      productName: "Open Agent Studio",
      repositoryUrl: "https://github.com/example-org/open-agent",
      status: "pending_review",
      evidenceStatus: "not_checked",
      version: 1,
      createdAt: "2026-08-03T00:00:00.000Z",
      updatedAt: "2026-08-03T00:00:00.000Z",
    });
    expect(repository.getSubmission(created.id)).toEqual(created);
    expect(repository.listPending()).toEqual([created]);

    expect(repository.listReviewEvents(created.id)).toEqual([
      expect.objectContaining({
        submissionId: created.id,
        eventType: "submitted",
        fromStatus: null,
        toStatus: "pending_review",
        actor: "system",
        reason: "Submission received for manual review.",
      }),
    ]);

    const storedKey = database
      .prepare(
        "SELECT idempotency_key_hash FROM submissions WHERE id = ?",
      )
      .get(created.id)?.idempotency_key_hash;
    expect(storedKey).toMatch(/^[a-f0-9]{64}$/);
    expect(storedKey).not.toBe("submission-request-0001");
  });

  it("replays the same idempotency key without creating another row or event", () => {
    const { database, repository } = setupRepository();
    const first = repository.createSubmission(
      validInput,
      "submission-request-0002",
    );

    const replay = repository.createSubmission(
      { ...validInput, productName: "A different valid name" },
      " submission-request-0002 ",
    );

    expect(replay).toEqual(first);
    expect(
      database.prepare("SELECT COUNT(*) AS count FROM submissions").get()
        ?.count,
    ).toBe(1);
    expect(repository.listReviewEvents(first.id)).toHaveLength(1);
  });

  it("rejects a different key for a repository that is already pending", () => {
    const { repository } = setupRepository();
    repository.createSubmission(validInput, "submission-request-0003");

    expect(() =>
      repository.createSubmission(
        {
          ...validInput,
          repositoryUrl:
            "https://github.com/EXAMPLE-ORG/OPEN-AGENT/?from=duplicate",
        },
        "submission-request-0004",
      ),
    ).toThrowError(
      expect.objectContaining<Partial<SubmissionConflictError>>({
        reason: "repository",
      }),
    );
  });

  it("rejects with actor, reason and an atomic audit event", () => {
    const { repository } = setupRepository();
    const pending = repository.createSubmission(
      validInput,
      "submission-request-0005",
    );

    const rejected = repository.rejectSubmission(pending.id, {
      actor: " editor@example.com ",
      reason: " The submitted demo does not provide a usable experience yet. ",
      expectedVersion: 1,
    });

    expect(rejected).toMatchObject({
      id: pending.id,
      status: "rejected",
      evidenceStatus: "not_checked",
      version: 2,
    });
    expect(repository.listPending()).toEqual([]);
    expect(repository.listReviewEvents(pending.id)).toEqual([
      expect.objectContaining({
        eventType: "submitted",
        fromStatus: null,
        toStatus: "pending_review",
      }),
      expect.objectContaining({
        eventType: "rejected",
        fromStatus: "pending_review",
        toStatus: "rejected",
        actor: "editor@example.com",
        reason: "The submitted demo does not provide a usable experience yet.",
      }),
    ]);
  });

  it("does not write an event for stale versions or an illegal second review", () => {
    const { repository } = setupRepository();
    const pending = repository.createSubmission(
      validInput,
      "submission-request-0006",
    );

    expect(() =>
      repository.rejectSubmission(pending.id, {
        actor: "editor@example.com",
        reason: "This reason is long enough to be accepted.",
        expectedVersion: 2,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<SubmissionConflictError>>({
        reason: "version",
      }),
    );
    expect(repository.listReviewEvents(pending.id)).toHaveLength(1);

    repository.rejectSubmission(pending.id, {
      actor: "editor@example.com",
      reason: "This repository is not ready for the directory.",
      expectedVersion: 1,
    });

    expect(() =>
      repository.rejectSubmission(pending.id, {
        actor: "second-editor@example.com",
        reason: "A second review must not overwrite the first review.",
        expectedVersion: 2,
      }),
    ).toThrowError(SubmissionStateError);
    expect(repository.listReviewEvents(pending.id)).toHaveLength(2);
  });

  it("requires a meaningful review reason and leaves state unchanged on failure", () => {
    const { repository } = setupRepository();
    const pending = repository.createSubmission(
      validInput,
      "submission-request-0007",
    );

    expect(() =>
      repository.rejectSubmission(pending.id, {
        actor: "editor@example.com",
        reason: " too short ",
        expectedVersion: 1,
      }),
    ).toThrowError(
      expect.objectContaining<Partial<SubmissionValidationError>>({
        field: "reason",
      }),
    );
    expect(repository.getSubmission(pending.id)).toEqual(pending);
    expect(repository.listReviewEvents(pending.id)).toHaveLength(1);
  });

  it("allows a new pending submission for the same repository after rejection", () => {
    const { repository } = setupRepository();
    const first = repository.createSubmission(
      validInput,
      "submission-request-0008",
    );
    repository.rejectSubmission(first.id, {
      actor: "editor@example.com",
      reason: "The current experience path cannot be accepted yet.",
      expectedVersion: 1,
    });

    const resubmitted = repository.createSubmission(
      { ...validInput, productName: "Open Agent Studio v2" },
      "submission-request-0009",
    );

    expect(resubmitted.id).not.toBe(first.id);
    expect(resubmitted.status).toBe("pending_review");
    expect(repository.listPending()).toEqual([resubmitted]);
  });

  it("rolls back the submission when its initial audit event cannot be written", () => {
    const { database, repository } = setupRepository();
    database.exec(`
      CREATE TRIGGER inject_submitted_event_failure
      BEFORE INSERT ON review_events
      WHEN NEW.event_type = 'submitted'
      BEGIN
        SELECT RAISE(ABORT, 'injected submitted event failure');
      END;
    `);

    expect(() =>
      repository.createSubmission(validInput, "submission-request-0011"),
    ).toThrowError(/injected submitted event failure/);
    expect(
      database.prepare("SELECT COUNT(*) AS count FROM submissions").get()
        ?.count,
    ).toBe(0);
    expect(
      database.prepare("SELECT COUNT(*) AS count FROM review_events").get()
        ?.count,
    ).toBe(0);
  });

  it("rolls back status and version when the rejection event cannot be written", () => {
    const { database, repository } = setupRepository();
    const pending = repository.createSubmission(
      validInput,
      "submission-request-0012",
    );
    database.exec(`
      CREATE TRIGGER inject_rejected_event_failure
      BEFORE INSERT ON review_events
      WHEN NEW.event_type = 'rejected'
      BEGIN
        SELECT RAISE(ABORT, 'injected rejected event failure');
      END;
    `);

    expect(() =>
      repository.rejectSubmission(pending.id, {
        actor: "editor@example.com",
        reason: "The submission requires more verifiable experience details.",
        expectedVersion: 1,
      }),
    ).toThrowError(/injected rejected event failure/);

    expect(repository.getSubmission(pending.id)).toEqual(pending);
    expect(repository.getSubmission(pending.id)).toMatchObject({
      status: "pending_review",
      version: 1,
    });
    expect(repository.listReviewEvents(pending.id)).toHaveLength(1);
  });

  it("stores GitHub attempts append-only without changing submission state", () => {
    const { database, repository } = setupRepository();
    const pending = repository.createSubmission(
      validInput,
      "submission-request-evidence-0001",
    );

    const view = repository.recordGitHubEvidenceAttempt(
      pending.id,
      "qa-editor",
      githubSuccess,
    );

    expect(view).toMatchObject({
      state: "observed",
      latestAttempt: {
        actor: "qa-editor",
        outcome: "success",
        repository: { stars: 42, licenseSpdxId: "Apache-2.0" },
      },
    });
    expect(repository.getSubmission(pending.id)).toEqual(pending);
    expect(repository.listReviewEvents(pending.id)).toHaveLength(1);
    expect(() =>
      database.exec(
        "UPDATE github_evidence_attempts SET actor = 'tampered' WHERE submission_id = '" +
          pending.id +
          "'",
      ),
    ).toThrow(/append-only/);
    expect(() =>
      database.exec(
        "DELETE FROM github_evidence_attempts WHERE submission_id = '" +
          pending.id +
          "'",
      ),
    ).toThrow(/append-only/);
  });

  it("keeps the last usable snapshot when the latest refresh fails", () => {
    const { repository } = setupRepository();
    const pending = repository.createSubmission(
      validInput,
      "submission-request-evidence-0002",
    );
    repository.recordGitHubEvidenceAttempt(pending.id, "qa-editor", githubSuccess);

    const view = repository.recordGitHubEvidenceAttempt(
      pending.id,
      "qa-editor",
      githubFailure,
    );

    expect(view.state).toBe("stale");
    expect(view.latestAttempt).toMatchObject({
      outcome: "error",
      errorCode: "rate_limited",
      rateLimit: { remaining: 0 },
    });
    expect(view.latestUsableAttempt).toMatchObject({
      outcome: "success",
      repository: { repositoryId: "12345", stars: 42 },
    });
  });

  it("represents an initial failed refresh without fabricating a snapshot", () => {
    const { repository } = setupRepository();
    const pending = repository.createSubmission(
      validInput,
      "submission-request-evidence-0003",
    );

    const view = repository.recordGitHubEvidenceAttempt(
      pending.id,
      "qa-editor",
      githubFailure,
    );

    expect(view).toMatchObject({
      state: "error",
      latestAttempt: { outcome: "error", errorCode: "rate_limited" },
      latestUsableAttempt: null,
    });
  });

  it("does not attach new GitHub evidence after a submission is rejected", () => {
    const { database, repository } = setupRepository();
    const pending = repository.createSubmission(
      validInput,
      "submission-request-evidence-0004",
    );
    repository.rejectSubmission(pending.id, {
      actor: "qa-editor",
      reason: "This fixture is complete and should leave the pending queue.",
      expectedVersion: 1,
    });

    expect(() =>
      repository.recordGitHubEvidenceAttempt(
        pending.id,
        "qa-editor",
        githubSuccess,
      ),
    ).toThrow(SubmissionStateError);
    expect(
      database
        .prepare("SELECT COUNT(*) AS count FROM github_evidence_attempts")
        .get()?.count,
    ).toBe(0);
  });
});

describe("database lifecycle", () => {
  it("applies explicit migrations idempotently with safe connection settings", () => {
    const database = createDatabase();
    openDatabases.push(database);

    migrateDatabase(database);
    migrateDatabase(database);

    expect(
      database.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get()
        ?.count,
    ).toBe(2);
    expect(
      database.prepare("SELECT MAX(version) AS version FROM schema_migrations").get()
        ?.version,
    ).toBe(2);
    expect(database.prepare("PRAGMA foreign_keys").get()?.foreign_keys).toBe(1);
    expect(database.prepare("PRAGMA busy_timeout").get()?.timeout).toBe(2000);
    expect(database.prepare("PRAGMA journal_mode").get()?.journal_mode).not.toBe(
      "wal",
    );
  });

  it("persists a submission after a real temporary database is closed and reopened", () => {
    const temporaryDirectory = mkdtempSync(
      join(tmpdir(), "vibesource-submission-store-"),
    );
    const databasePath = join(temporaryDirectory, "vibesource.sqlite");
    let reopened: Database | undefined;

    try {
      const initial = createDatabase({ path: databasePath });
      const initialRepository = new SubmissionRepository(initial);
      const created = initialRepository.createSubmission(
        validInput,
        "submission-request-0010",
      );
      initial.close();

      reopened = createDatabase({ path: databasePath });
      const reopenedRepository = new SubmissionRepository(reopened);

      expect(reopenedRepository.getSubmission(created.id)).toEqual(created);
      expect(reopenedRepository.listReviewEvents(created.id)).toHaveLength(1);
      expect(
        reopened
          .prepare("SELECT COUNT(*) AS count FROM schema_migrations")
          .get()?.count,
      ).toBe(2);
    } finally {
      reopened?.close();
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
