# M2.2b2b2d Cloudflare + Neon preview evidence

Date: 2026-08-04

## Verified external state

- Neon preview project `soft-bird-25495300` uses PostgreSQL 17 in Singapore.
- Migrations `0001`, `0002` and `0003` were applied in numeric order through the Neon SQL editor.
- A read-only verification returned PostgreSQL `17.10`, 10 target tables, 12 required indexes and 6 append-only triggers.
- Cloudflare Hyperdrive `vibesource-neon-preview` was created with caching disabled and bound to the Worker as `HYPERDRIVE`.
- `wrangler deploy --dry-run` resolved both `HYPERDRIVE` and `ASSETS`.
- Worker version `6b9eb1fa-e186-40aa-aef4-22eeb07f3b33` was deployed to `https://vibesource.aidai524.workers.dev`.
- `/`, `/api/health`, `/submit` and `/editor/submissions` returned HTTP 200 after deployment.

## Local acceptance

`npm run check` passed with:

- lint and TypeScript checks;
- 15 Vitest files and 110 tests;
- replayed PostgreSQL migration verification;
- Next.js production build;
- Cloudflare OpenNext build.

The explicit network migration helper has a targeted test that applies all three files, reports no database URL and verifies the same table/index/trigger totals.

## Credential boundary

- The Neon connection string was pasted by the operator directly into Cloudflare and is not present in source, evidence or committed configuration.
- The committed Hyperdrive ID is a resource identifier, not an origin credential.
- OpenNext deploy preparation required a local Hyperdrive connection value. This run used an unreachable loopback placeholder; the deployed runtime binding still references the Cloudflare Hyperdrive resource.

## Not yet verified

- The current application modes and GitHub OAuth secrets remain disabled, so the deployed app has not executed a business or Better Auth query through Hyperdrive.
- No local SQLite business data was imported.
- Session creation, expiry, logout, grant/revoke, database role separation, backup/restore, rollback and custom domain behavior remain open.
- Neon password rotation is an operator-controlled action and was not independently inspected or recorded by the application.
