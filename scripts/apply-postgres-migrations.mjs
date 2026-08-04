import { Client } from "pg";

import { applyAndVerifyPostgresMigrations } from "./lib/postgres-migrations.mjs";

if (!process.argv.includes("--apply")) {
  console.error("Refusing to change PostgreSQL without the explicit --apply flag.");
  process.exitCode = 2;
} else if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required. The connection string is never printed.");
  process.exitCode = 2;
} else {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    application_name: "vibesource-controlled-migration",
    connectionTimeoutMillis: 15_000,
    statement_timeout: 60_000,
  });

  try {
    await client.connect();
    const report = await applyAndVerifyPostgresMigrations({
      executeMigration: (sql) => client.query(sql),
      query: (sql, values) => client.query(sql, values),
    });
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await client.end().catch(() => {});
  }
}
