import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const tableSpecifications = [
  {
    source: "submissions",
    target: "vibesource_submissions",
    orderBy: "created_at, id",
    columns: [
      "id", "product_name", "summary", "repository_url", "experience_url",
      "ai_involvement", "tech_stack", "license_name", "reuse_notes",
      "status", "evidence_status", "idempotency_key_hash", "version",
      "created_at", "updated_at",
    ],
  },
  {
    source: "review_events",
    target: "vibesource_review_events",
    orderBy: "created_at, rowid",
    columns: [
      "id", "submission_id", "event_type", "from_status", "to_status",
      "actor", "reason", "created_at",
    ],
  },
  {
    source: "github_evidence_attempts",
    target: "vibesource_github_evidence_attempts",
    orderBy: "observed_at, rowid",
    booleanColumns: ["is_private", "archived", "is_fork"],
    columns: [
      "id", "submission_id", "actor", "outcome", "source_url", "api_version",
      "observed_at", "http_status", "error_code", "error_message",
      "rate_limit_limit", "rate_limit_remaining", "rate_limit_reset_at",
      "repository_id", "full_name", "html_url", "visibility", "is_private",
      "archived", "is_fork", "default_branch", "pushed_at",
      "stargazers_count", "forks_count", "open_issues_count",
      "license_detection", "license_key", "license_name", "license_spdx_id",
      "license_url",
    ],
  },
  {
    source: "demo_evidence_attempts",
    target: "vibesource_demo_evidence_attempts",
    orderBy: "observed_at, rowid",
    columns: [
      "id", "submission_id", "actor", "outcome", "source_url",
      "check_version", "observed_at", "method", "http_status", "content_type",
      "resolved_address", "resolved_family", "response_time_ms", "error_code",
      "error_message",
    ],
  },
];

function normalizeRow(row, specification) {
  const normalized = {};
  for (const column of specification.columns) {
    const value = row[column];
    normalized[column] = specification.booleanColumns?.includes(column) && value !== null
      ? value === 1
      : value;
  }
  return normalized;
}

export function readLegacySqliteSnapshot(sourcePath) {
  const absolutePath = resolve(sourcePath);
  if (absolutePath !== sourcePath) {
    throw new Error("The SQLite source path must be absolute.");
  }
  const database = new DatabaseSync(absolutePath, {
    readOnly: true,
    enableForeignKeyConstraints: true,
    enableDoubleQuotedStringLiterals: false,
    allowExtension: false,
    timeout: 2_000,
  });
  try {
    const version = database.prepare(
      "select max(version) as version from schema_migrations",
    ).get()?.version;
    if (version !== 3) {
      throw new Error(`Expected SQLite schema version 3, found ${String(version)}.`);
    }
    const tables = {};
    for (const specification of tableSpecifications) {
      const columns = specification.columns.join(", ");
      tables[specification.source] = database
        .prepare(
          `select ${columns} from ${specification.source} order by ${specification.orderBy}`,
        )
        .all()
        .map((row) => normalizeRow(row, specification));
    }
    return {
      sourcePath: absolutePath,
      schemaVersion: version,
      tables,
      counts: Object.fromEntries(
        tableSpecifications.map(({ source }) => [source, tables[source].length]),
      ),
    };
  } finally {
    database.close();
  }
}

async function targetCounts(client) {
  const counts = {};
  for (const { source, target } of tableSpecifications) {
    const result = await client.query(`select count(*)::integer as count from ${target}`);
    counts[source] = result.rows[0].count;
  }
  return counts;
}

export async function importLegacySqliteSnapshot(database, snapshot) {
  const client = await database.connect();
  try {
    await client.query("begin");
    const before = await targetCounts(client);
    if (Object.values(before).some((count) => count !== 0)) {
      throw new Error("PostgreSQL business tables must be empty before legacy import.");
    }

    for (const specification of tableSpecifications) {
      const placeholders = specification.columns.map((_, index) => `$${index + 1}`).join(", ");
      const sql = `insert into ${specification.target} (${specification.columns.join(", ")}) values (${placeholders})`;
      for (const row of snapshot.tables[specification.source]) {
        await client.query(
          sql,
          specification.columns.map((column) => row[column]),
        );
      }
    }

    const after = await targetCounts(client);
    for (const { source } of tableSpecifications) {
      if (after[source] !== snapshot.counts[source]) {
        throw new Error(`Imported count mismatch for ${source}.`);
      }
    }
    await client.query("commit");
    return after;
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      // Preserve the original import failure.
    }
    throw error;
  } finally {
    client.release();
  }
}

export function describeLegacySnapshot(snapshot) {
  return {
    source: snapshot.sourcePath,
    schemaVersion: snapshot.schemaVersion,
    counts: snapshot.counts,
  };
}
