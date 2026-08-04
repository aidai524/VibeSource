import { fileURLToPath } from "node:url";
import { Pool } from "pg";

import {
  describeLegacySnapshot,
  importLegacySqliteSnapshot,
  readLegacySqliteSnapshot,
} from "./lib/sqlite-postgres-transfer.mjs";

function parseArguments(arguments_) {
  const sourceArgument = arguments_.find((argument) => argument.startsWith("--source="));
  const unknown = arguments_.filter(
    (argument) => argument !== "--apply" && !argument.startsWith("--source="),
  );
  if (unknown.length > 0 || !sourceArgument) {
    throw new Error(
      "Usage: node scripts/migrate-sqlite-to-postgres.mjs --source=/absolute/file.sqlite [--apply]",
    );
  }
  return {
    source: sourceArgument.slice("--source=".length),
    apply: arguments_.includes("--apply"),
  };
}

export async function main(arguments_ = process.argv.slice(2)) {
  const options = parseArguments(arguments_);
  const snapshot = readLegacySqliteSnapshot(options.source);
  if (!options.apply) {
    console.log(JSON.stringify({ mode: "dry-run", ...describeLegacySnapshot(snapshot) }, null, 2));
    return;
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("--apply requires DATABASE_URL for a migration-owner connection.");
  }
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    maxUses: 1,
    connectionTimeoutMillis: 5_000,
    allowExitOnIdle: true,
    application_name: "vibesource-sqlite-import",
  });
  try {
    const counts = await importLegacySqliteSnapshot(pool, snapshot);
    console.log(JSON.stringify({ mode: "applied", counts }, null, 2));
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Migration failed.");
    process.exitCode = 1;
  });
}
