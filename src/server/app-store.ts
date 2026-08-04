import { mkdirSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";

import { createDatabase, type Database } from "@/server/database";
import type { RuntimeConfiguration } from "@/server/features";
import { PostgresSubmissionRepository } from "@/server/postgres-submission-repository";
import { SubmissionRepository } from "@/server/submission-repository";
import type { SubmissionStoreRepository } from "@/server/submission-store";

type SubmissionStore = {
  readonly database: Database;
  readonly repository: SubmissionRepository;
};

type GlobalStoreRegistry = typeof globalThis & {
  __vibeSourceSubmissionStores?: Map<string, SubmissionStore>;
  __vibeSourcePostgresSubmissionStores?: Map<string, {
    readonly pool: Pool;
    readonly repository: PostgresSubmissionRepository;
  }>;
};

function storeRegistry(): Map<string, SubmissionStore> {
  const shared = globalThis as GlobalStoreRegistry;
  shared.__vibeSourceSubmissionStores ??= new Map();
  return shared.__vibeSourceSubmissionStores;
}

/**
 * Selects the explicitly configured local or PostgreSQL repository and reuses
 * its pool/connection across route reloads. Calling this function never enables
 * a feature: configuration must already have passed the fail-closed gate.
 */
export function getSubmissionRepository(
  configuration: RuntimeConfiguration,
): SubmissionStoreRepository {
  if (!configuration.submissionAvailable) {
    throw new Error("Submission storage is not available.");
  }

  if (configuration.mode === "postgres") {
    const databaseUrl = configuration.productionDatabaseUrl;
    if (!databaseUrl) throw new Error("PostgreSQL submission storage is not configured.");
    const shared = globalThis as GlobalStoreRegistry;
    shared.__vibeSourcePostgresSubmissionStores ??= new Map();
    const existing = shared.__vibeSourcePostgresSubmissionStores.get(databaseUrl);
    if (existing) return existing.repository;

    const pool = new Pool({
      connectionString: databaseUrl,
      max: 5,
      maxUses: 1,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
      allowExitOnIdle: true,
      application_name: "vibesource-business",
    });
    const repository = new PostgresSubmissionRepository(pool);
    shared.__vibeSourcePostgresSubmissionStores.set(databaseUrl, { pool, repository });
    return repository;
  }

  if (!configuration.databasePath) {
    throw new Error("Local submission storage is not configured.");
  }

  const databasePath = configuration.databasePath;
  const registry = storeRegistry();
  const existing = registry.get(databasePath);
  if (existing) {
    return existing.repository;
  }

  mkdirSync(path.dirname(databasePath), { recursive: true, mode: 0o700 });
  const database = createDatabase({ path: databasePath });
  const repository = new SubmissionRepository(database);
  registry.set(databasePath, { database, repository });

  return repository;
}
