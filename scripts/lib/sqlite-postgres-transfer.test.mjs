import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it } from "vitest";

import {
  importLegacySqliteSnapshot,
  readLegacySqliteSnapshot,
} from "./sqlite-postgres-transfer.mjs";

const temporaryDirectories = [];

function createLegacyFixture() {
  const directory = mkdtempSync(join(tmpdir(), "vibesource-transfer-"));
  temporaryDirectories.push(directory);
  const path = join(directory, "legacy.sqlite");
  const database = new DatabaseSync(path);
  database.exec(`
    create table schema_migrations (version integer primary key, name text, applied_at text);
    insert into schema_migrations values (3, 'fixture', '2026-08-04T00:00:00.000Z');
    create table submissions (
      id text, product_name text, summary text, repository_url text,
      experience_url text, ai_involvement text, tech_stack text,
      license_name text, reuse_notes text, status text, evidence_status text,
      idempotency_key_hash text, version integer, created_at text, updated_at text
    );
    create table review_events (
      id text, submission_id text, event_type text, from_status text,
      to_status text, actor text, reason text, created_at text
    );
    create table github_evidence_attempts (
      id text, submission_id text, actor text, outcome text, source_url text,
      api_version text, observed_at text, http_status integer, error_code text,
      error_message text, rate_limit_limit integer, rate_limit_remaining integer,
      rate_limit_reset_at text, repository_id text, full_name text, html_url text,
      visibility text, is_private integer, archived integer, is_fork integer,
      default_branch text, pushed_at text, stargazers_count integer,
      forks_count integer, open_issues_count integer, license_detection text,
      license_key text, license_name text, license_spdx_id text, license_url text
    );
    create table demo_evidence_attempts (
      id text, submission_id text, actor text, outcome text, source_url text,
      check_version text, observed_at text, method text, http_status integer,
      content_type text, resolved_address text, resolved_family integer,
      response_time_ms integer, error_code text, error_message text
    );
    insert into submissions values (
      'submission-1', 'Fixture Product',
      'A sufficiently detailed fixture summary for migration verification.',
      'https://github.com/example/fixture', 'https://fixture.example.com',
      'AI participation is documented in this migration fixture.',
      'Next.js, PostgreSQL', 'MIT',
      'Clone and deploy using the documented fixture instructions.',
      'pending_review', 'not_checked',
      '${"a".repeat(64)}', 1,
      '2026-08-04T00:00:00.000Z', '2026-08-04T00:00:00.000Z'
    );
    insert into review_events values (
      'event-1', 'submission-1', 'submitted', null, 'pending_review',
      'system', 'Submission received for manual review.',
      '2026-08-04T00:00:00.000Z'
    );
  `);
  database.close();
  return path;
}

function asPool(database) {
  const query = (text, values) => database.query(text, values);
  const client = { query, release() {} };
  return { query, connect: async () => client };
}

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    rmSync(temporaryDirectories.pop(), { recursive: true, force: true });
  }
});

describe("SQLite to PostgreSQL transfer", () => {
  it("reads schema v3 and atomically imports only into empty business tables", async () => {
    const snapshot = readLegacySqliteSnapshot(createLegacyFixture());
    expect(snapshot.counts).toEqual({
      submissions: 1,
      review_events: 1,
      github_evidence_attempts: 0,
      demo_evidence_attempts: 0,
    });

    const postgres = new PGlite();
    try {
      await postgres.exec(
        readFileSync("migrations/0003_submission_business_storage.sql", "utf8"),
      );
      await expect(importLegacySqliteSnapshot(asPool(postgres), snapshot)).resolves.toEqual(
        snapshot.counts,
      );
      await expect(
        importLegacySqliteSnapshot(asPool(postgres), snapshot),
      ).rejects.toThrow(/must be empty/);
      const counts = await postgres.query(`
        select
          (select count(*)::integer from vibesource_submissions) as submissions,
          (select count(*)::integer from vibesource_review_events) as events
      `);
      expect(counts.rows[0]).toEqual({ submissions: 1, events: 1 });
    } finally {
      await postgres.close();
    }
  });
});
