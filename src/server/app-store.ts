import { mkdirSync } from "node:fs";
import path from "node:path";

import { createDatabase, type Database } from "@/server/database";
import type { RuntimeConfiguration } from "@/server/features";
import { SubmissionRepository } from "@/server/submission-repository";

type SubmissionStore = {
  readonly database: Database;
  readonly repository: SubmissionRepository;
};

type GlobalStoreRegistry = typeof globalThis & {
  __vibeSourceSubmissionStores?: Map<string, SubmissionStore>;
};

function storeRegistry(): Map<string, SubmissionStore> {
  const shared = globalThis as GlobalStoreRegistry;
  shared.__vibeSourceSubmissionStores ??= new Map();
  return shared.__vibeSourceSubmissionStores;
}

/**
 * Opens one lazy SQLite connection per configured absolute path and reuses it
 * across route-handler reloads. Calling this function never enables a feature:
 * the caller must pass a configuration that already passed the fail-closed gate.
 */
export function getSubmissionRepository(
  configuration: RuntimeConfiguration,
): SubmissionRepository {
  if (!configuration.submissionAvailable || !configuration.databasePath) {
    throw new Error("Submission storage is not available.");
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
