import type { PathLike } from "node:fs";
import { DatabaseSync } from "node:sqlite";

export type Database = DatabaseSync;

export interface CreateDatabaseOptions {
  path?: PathLike;
}

export const DATABASE_SCHEMA_VERSION = 3;

const migrations = [
  {
    version: 1,
    name: "create_submission_review_tables",
    sql: `
      CREATE TABLE submissions (
        id TEXT PRIMARY KEY NOT NULL,
        product_name TEXT NOT NULL,
        summary TEXT NOT NULL,
        repository_url TEXT NOT NULL,
        experience_url TEXT NOT NULL,
        ai_involvement TEXT NOT NULL,
        tech_stack TEXT NOT NULL,
        license_name TEXT NOT NULL,
        reuse_notes TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending_review'
          CHECK (status IN ('pending_review', 'rejected')),
        evidence_status TEXT NOT NULL DEFAULT 'not_checked'
          CHECK (evidence_status = 'not_checked'),
        idempotency_key_hash TEXT NOT NULL UNIQUE,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;

      CREATE UNIQUE INDEX submissions_pending_repository_url_unique
        ON submissions (repository_url)
        WHERE status = 'pending_review';

      CREATE INDEX submissions_pending_created_at_index
        ON submissions (created_at, id)
        WHERE status = 'pending_review';

      CREATE TABLE review_events (
        id TEXT PRIMARY KEY NOT NULL,
        submission_id TEXT NOT NULL,
        event_type TEXT NOT NULL CHECK (event_type IN ('submitted', 'rejected')),
        from_status TEXT
          CHECK (from_status IS NULL OR from_status IN ('pending_review', 'rejected')),
        to_status TEXT NOT NULL CHECK (to_status IN ('pending_review', 'rejected')),
        actor TEXT NOT NULL,
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (submission_id) REFERENCES submissions (id) ON DELETE RESTRICT
      ) STRICT;

      CREATE INDEX review_events_submission_created_at_index
        ON review_events (submission_id, created_at, id);
    `,
  },
  {
    version: 2,
    name: "create_append_only_github_evidence_attempts",
    sql: `
      CREATE TABLE github_evidence_attempts (
        id TEXT PRIMARY KEY NOT NULL,
        submission_id TEXT NOT NULL,
        actor TEXT NOT NULL,
        outcome TEXT NOT NULL CHECK (outcome IN ('success', 'error')),
        source_url TEXT NOT NULL,
        api_version TEXT NOT NULL,
        observed_at TEXT NOT NULL,
        http_status INTEGER,
        error_code TEXT CHECK (
          error_code IS NULL OR error_code IN (
            'not_found',
            'rate_limited',
            'timeout',
            'network_error',
            'invalid_response',
            'github_http_error'
          )
        ),
        error_message TEXT,
        rate_limit_limit INTEGER CHECK (rate_limit_limit IS NULL OR rate_limit_limit >= 0),
        rate_limit_remaining INTEGER CHECK (rate_limit_remaining IS NULL OR rate_limit_remaining >= 0),
        rate_limit_reset_at TEXT,
        repository_id TEXT,
        full_name TEXT,
        html_url TEXT,
        visibility TEXT,
        is_private INTEGER CHECK (is_private IS NULL OR is_private IN (0, 1)),
        archived INTEGER CHECK (archived IS NULL OR archived IN (0, 1)),
        is_fork INTEGER CHECK (is_fork IS NULL OR is_fork IN (0, 1)),
        default_branch TEXT,
        pushed_at TEXT,
        stargazers_count INTEGER CHECK (stargazers_count IS NULL OR stargazers_count >= 0),
        forks_count INTEGER CHECK (forks_count IS NULL OR forks_count >= 0),
        open_issues_count INTEGER CHECK (open_issues_count IS NULL OR open_issues_count >= 0),
        license_detection TEXT CHECK (
          license_detection IS NULL OR license_detection IN ('detected', 'not_detected')
        ),
        license_key TEXT,
        license_name TEXT,
        license_spdx_id TEXT,
        license_url TEXT,
        FOREIGN KEY (submission_id) REFERENCES submissions (id) ON DELETE RESTRICT,
        CHECK (
          (
            outcome = 'success'
            AND error_code IS NULL
            AND error_message IS NULL
            AND repository_id IS NOT NULL
            AND full_name IS NOT NULL
            AND html_url IS NOT NULL
            AND visibility IS NOT NULL
            AND is_private IS NOT NULL
            AND archived IS NOT NULL
            AND is_fork IS NOT NULL
            AND default_branch IS NOT NULL
            AND pushed_at IS NOT NULL
            AND stargazers_count IS NOT NULL
            AND forks_count IS NOT NULL
            AND open_issues_count IS NOT NULL
            AND license_detection IS NOT NULL
          ) OR (
            outcome = 'error'
            AND error_code IS NOT NULL
            AND error_message IS NOT NULL
            AND repository_id IS NULL
            AND full_name IS NULL
            AND html_url IS NULL
            AND visibility IS NULL
            AND is_private IS NULL
            AND archived IS NULL
            AND is_fork IS NULL
            AND default_branch IS NULL
            AND pushed_at IS NULL
            AND stargazers_count IS NULL
            AND forks_count IS NULL
            AND open_issues_count IS NULL
            AND license_detection IS NULL
          )
        )
      ) STRICT;

      CREATE INDEX github_evidence_attempts_submission_observed_at_index
        ON github_evidence_attempts (submission_id, observed_at DESC, id DESC);

      CREATE TRIGGER github_evidence_attempts_no_update
      BEFORE UPDATE ON github_evidence_attempts
      BEGIN
        SELECT RAISE(ABORT, 'github evidence attempts are append-only');
      END;

      CREATE TRIGGER github_evidence_attempts_no_delete
      BEFORE DELETE ON github_evidence_attempts
      BEGIN
        SELECT RAISE(ABORT, 'github evidence attempts are append-only');
      END;
    `,
  },
  {
    version: 3,
    name: "create_append_only_demo_evidence_attempts",
    sql: `
      CREATE TABLE demo_evidence_attempts (
        id TEXT PRIMARY KEY NOT NULL,
        submission_id TEXT NOT NULL,
        actor TEXT NOT NULL,
        outcome TEXT NOT NULL CHECK (outcome IN ('success', 'error')),
        source_url TEXT NOT NULL,
        check_version TEXT NOT NULL,
        observed_at TEXT NOT NULL,
        method TEXT NOT NULL CHECK (method = 'GET'),
        http_status INTEGER CHECK (http_status IS NULL OR http_status BETWEEN 100 AND 599),
        content_type TEXT,
        resolved_address TEXT,
        resolved_family INTEGER CHECK (resolved_family IS NULL OR resolved_family IN (4, 6)),
        response_time_ms INTEGER CHECK (response_time_ms IS NULL OR response_time_ms >= 0),
        error_code TEXT CHECK (
          error_code IS NULL OR error_code IN (
            'dns_resolution_failed',
            'unsafe_address',
            'timeout',
            'tls_error',
            'network_error',
            'redirect_blocked',
            'http_error',
            'invalid_response'
          )
        ),
        error_message TEXT,
        FOREIGN KEY (submission_id) REFERENCES submissions (id) ON DELETE RESTRICT,
        CHECK (
          (
            outcome = 'success'
            AND http_status BETWEEN 200 AND 299
            AND resolved_address IS NOT NULL
            AND resolved_family IS NOT NULL
            AND response_time_ms IS NOT NULL
            AND error_code IS NULL
            AND error_message IS NULL
          ) OR (
            outcome = 'error'
            AND error_code IS NOT NULL
            AND error_message IS NOT NULL
          )
        )
      ) STRICT;

      CREATE INDEX demo_evidence_attempts_submission_observed_at_index
        ON demo_evidence_attempts (submission_id, observed_at DESC, id DESC);

      CREATE TRIGGER demo_evidence_attempts_no_update
      BEFORE UPDATE ON demo_evidence_attempts
      BEGIN
        SELECT RAISE(ABORT, 'demo evidence attempts are append-only');
      END;

      CREATE TRIGGER demo_evidence_attempts_no_delete
      BEFORE DELETE ON demo_evidence_attempts
      BEGIN
        SELECT RAISE(ABORT, 'demo evidence attempts are append-only');
      END;
    `,
  },
] as const;

export function migrateDatabase(database: Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    ) STRICT;
  `);

  const hasMigration = database.prepare(
    "SELECT 1 AS applied FROM schema_migrations WHERE version = ?",
  );
  const insertMigration = database.prepare(
    "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
  );

  for (const migration of migrations) {
    if (hasMigration.get(migration.version) !== undefined) {
      continue;
    }

    database.exec("BEGIN IMMEDIATE");
    try {
      database.exec(migration.sql);
      insertMigration.run(
        migration.version,
        migration.name,
        new Date().toISOString(),
      );
      database.exec("COMMIT");
    } catch (error) {
      try {
        database.exec("ROLLBACK");
      } catch {
        // Preserve the migration failure if SQLite already rolled back the transaction.
      }
      throw error;
    }
  }
}

export function createDatabase(
  options: CreateDatabaseOptions = {},
): Database {
  const database = new DatabaseSync(options.path ?? ":memory:", {
    enableForeignKeyConstraints: true,
    enableDoubleQuotedStringLiterals: false,
    allowExtension: false,
    timeout: 2_000,
    readBigInts: false,
    returnArrays: false,
    allowBareNamedParameters: false,
    allowUnknownNamedParameters: false,
    defensive: true,
  });

  database.enableLoadExtension(false);
  database.exec("PRAGMA foreign_keys = ON");
  database.exec("PRAGMA busy_timeout = 2000");
  migrateDatabase(database);

  return database;
}
