import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

import { applyAndVerifyPostgresMigrations } from "./postgres-migrations.mjs";

describe("controlled PostgreSQL migrations", () => {
  it("applies the committed migrations and verifies their production contract", async () => {
    const database = new PGlite();
    try {
      const report = await applyAndVerifyPostgresMigrations({
        executeMigration: (sql) => database.exec(sql),
        query: (sql, values) => database.query(sql, values),
      });

      expect(report).toMatchObject({
        status: "passed",
        database: "postgres",
        tables: 10,
        requiredIndexes: 12,
        appendOnlyTriggers: 6,
      });
      expect(report.migrations).toEqual([
        "migrations/0001_better_auth.sql",
        "migrations/0002_editor_role_grants.sql",
        "migrations/0003_submission_business_storage.sql",
      ]);
    } finally {
      await database.close();
    }
  });
});
