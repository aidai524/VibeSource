import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

export const migrationPaths = [
  join(projectRoot, "migrations/0001_better_auth.sql"),
  join(projectRoot, "migrations/0002_editor_role_grants.sql"),
  join(projectRoot, "migrations/0003_submission_business_storage.sql"),
];

const expectedTables = [
  "account",
  "rateLimit",
  "session",
  "user",
  "verification",
  "vibesource_demo_evidence_attempts",
  "vibesource_editor_role_grants",
  "vibesource_github_evidence_attempts",
  "vibesource_review_events",
  "vibesource_submissions",
];

const expectedIndexes = [
  "session_user_id_idx",
  "account_user_id_idx",
  "verification_identifier_idx",
  "vibesource_editor_role_grants_active_user_idx",
  "vibesource_editor_role_grants_auth_user_id_idx",
  "vibesource_editor_role_grants_active_actor_idx",
  "vibesource_editor_role_grants_granted_at_idx",
  "vibesource_submissions_pending_repository_idx",
  "vibesource_submissions_pending_created_idx",
  "vibesource_review_events_submission_created_idx",
  "vibesource_github_evidence_submission_observed_idx",
  "vibesource_demo_evidence_submission_observed_idx",
];

const expectedTriggers = [
  "vibesource_review_events_no_update",
  "vibesource_review_events_no_delete",
  "vibesource_github_evidence_no_update",
  "vibesource_github_evidence_no_delete",
  "vibesource_demo_evidence_no_update",
  "vibesource_demo_evidence_no_delete",
];

function placeholders(values) {
  return values.map((_, index) => `$${index + 1}`).join(", ");
}

async function readNames(query, sql, values, column) {
  const result = await query(sql, values);
  return result.rows.map((row) => row[column]).sort();
}

function expectExactNames(actual, expected, label) {
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error(`${label} verification failed.`);
  }
}

export async function applyAndVerifyPostgresMigrations({
  executeMigration,
  query,
}) {
  const applied = [];
  for (const path of migrationPaths) {
    await executeMigration(await readFile(path, "utf8"));
    applied.push(path.slice(projectRoot.length + 1));
  }

  const tables = await readNames(
    query,
    `select tablename
       from pg_catalog.pg_tables
      where schemaname = 'public'
        and tablename in (${placeholders(expectedTables)})`,
    expectedTables,
    "tablename",
  );
  const indexes = await readNames(
    query,
    `select indexname
       from pg_catalog.pg_indexes
      where schemaname = 'public'
        and indexname in (${placeholders(expectedIndexes)})`,
    expectedIndexes,
    "indexname",
  );
  const triggers = await readNames(
    query,
    `select tgname
       from pg_catalog.pg_trigger
      where not tgisinternal
        and tgname in (${placeholders(expectedTriggers)})`,
    expectedTriggers,
    "tgname",
  );

  expectExactNames(tables, expectedTables, "Table");
  expectExactNames(indexes, expectedIndexes, "Index");
  expectExactNames(triggers, expectedTriggers, "Append-only trigger");

  const version = await query(
    "select current_setting('server_version') as version, current_database() as database",
  );

  return {
    status: "passed",
    migrations: applied,
    serverVersion: version.rows[0].version,
    database: version.rows[0].database,
    tables: tables.length,
    requiredIndexes: indexes.length,
    appendOnlyTriggers: triggers.length,
  };
}
