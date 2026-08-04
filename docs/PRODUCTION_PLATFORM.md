# Production platform target — M2.2b2b2a

## Accepted validation target

- Web runtime: Cloudflare Workers using the OpenNext Cloudflare adapter for the existing Next.js App Router application.
- Database: standard PostgreSQL, with Neon through Cloudflare Hyperdrive as the first managed target.
- Authentication: Better Auth 1.6.25 with GitHub OAuth and database-backed sessions.
- Authorization: VibeSource-owned roles in `vibesource_editor_role_grants`; GitHub profile claims never grant editor access.

The first preview infrastructure slice is now deployed: a Neon preview database has all three migrations, Cloudflare Hyperdrive is bound as `HYPERDRIVE`, and the existing Worker is live at `https://vibesource.aidai524.workers.dev`. This does not yet prove a production authentication or business-data flow: GitHub OAuth and the required application secrets/modes remain disabled, and no real SQLite data has been imported.

## Why this target

Cloudflare officially supports full-stack Next.js on Workers through the OpenNext adapter. The committed adapter uses the Next.js Node runtime with `nodejs_compat`; local OpenNext build and Workers preview are verified. Hyperdrive can connect Workers to an existing Neon PostgreSQL database while owning the cross-request connection pool. Better Auth continues to use GitHub OAuth and PostgreSQL database sessions.

The app uses `pg` rather than a Neon-only data API. `HYPERDRIVE.connectionString` is used when the binding exists and `DATABASE_URL` is absent; ordinary Node tools can continue to use `DATABASE_URL`. Moving to another PostgreSQL host should require configuration and operational changes rather than a business-domain rewrite.

The local `node:sqlite` candidate store cannot become the Workers production store: Workers exposes `node:sqlite` only as a non-functional compatibility stub. Submission, evidence and audit state must move to PostgreSQL before those routes can be enabled on Workers.

## Configuration

Production external identity requires all of:

```text
VIBESOURCE_EDITOR_IDENTITY_MODE=external-oidc
HYPERDRIVE=<Cloudflare binding configured in wrangler after resource creation>
BETTER_AUTH_URL=https://your-production-origin
BETTER_AUTH_SECRET=<at least 32 random characters>
GITHUB_CLIENT_ID=<server secret>
GITHUB_CLIENT_SECRET=<server secret>
```

The GitHub callback is `${BETTER_AUTH_URL}/api/auth/callback/github`. Secrets must stay in Cloudflare's secret store and must not be copied into `wrangler.jsonc`, source, preview logs or evidence packages. `DATABASE_URL` remains available for migration/schema commands outside Workers and as an explicitly configured fallback, but it must also be stored as a secret.

Committed deployment files are `wrangler.jsonc`, `open-next.config.ts` and the OpenNext setup in `next.config.ts`. `wrangler.jsonc` contains only the reviewed Hyperdrive resource ID; origin credentials remain in Cloudflare and Neon.

OpenNext 1.20.2 calls Wrangler's local platform proxy while preparing a remote deployment. With a Hyperdrive binding, that preparation requires `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE`. Use a local development PostgreSQL URL for local work and keep it outside the repository. The 2026-08-04 remote deployment used an unreachable loopback placeholder only to initialize the proxy; no cache population or database query used it, and the deployed Worker received the remote Hyperdrive binding.

## Database changes

Apply migrations in numeric order with a migration-owner connection:

1. `migrations/0001_better_auth.sql` — Better Auth 1.6.25 core tables and indexes.
2. `migrations/0002_editor_role_grants.sql` — application-owned, reasoned role grants and revocations.
3. `migrations/0003_submission_business_storage.sql` — candidates, review events and append-only GitHub/Demo evidence.

`npm run verify:postgres-migrations` applies all three committed migrations twice to an in-memory PGlite PostgreSQL 17 WASM engine. It checks the expected tables and indexes, database-enforced role/reason/revocation constraints, unique active user/actor grants, re-grant after complete revocation and role-history retention. This is a deterministic SQL compatibility test, not a substitute for a networked PostgreSQL service, pooling or operations rehearsal.

`npm run apply:postgres-migrations -- --apply` is the explicit network PostgreSQL migration command. It records no connection URL, applies the three files in numeric order, and verifies 10 target tables, 12 required indexes and 6 append-only triggers. The preview Neon database was also checked read-only after application on 2026-08-04.

`npm run auth:schema` asks Better Auth's pinned CLI to generate its current schema. It requires a reachable disposable PostgreSQL database because the CLI introspects existing tables. The command was attempted locally, but no PostgreSQL service or Docker daemon was available; therefore the committed Better Auth SQL still requires comparison against CLI output before production use.

Set `VIBESOURCE_SUBMISSION_MODE=postgres` only after all three migrations are applied. The runtime then uses the PostgreSQL business repository; missing database configuration fails closed. `local-token` is intentionally unavailable in postgres mode, so production editing still requires the external identity adapter.

Legacy transfer is a separate human-controlled operation. `npm run migrate:sqlite-to-postgres -- --source=/absolute/file.sqlite` reads schema-v3 SQLite in read-only mode and prints per-table counts. Adding `--apply` requires a migration-owner `DATABASE_URL`, refuses non-empty PostgreSQL business tables, writes all four tables in one transaction and commits only when target/source counts match. It never applies schema changes automatically.

Use separate database roles:

- migration owner: schema changes only during controlled deployment;
- web application: Better Auth table read/write plus read-only access to `vibesource_editor_role_grants`;
- role operator: explicit grant/revoke changes; no application runtime credentials.

The application pool is limited to five connections and `maxUses: 1`, so a physical connection is not reused across Worker requests; Hyperdrive owns the persistent origin pool. Transactions must not depend on session-level state. This behavior still requires live Hyperdrive/Neon verification.

## Manual role operations

After a user completes GitHub sign-in, an operator must resolve the Better Auth user ID and explicitly insert a grant with a stable actor ID, grantor and 10–500 character reason. Changing a role means revoking the active grant with revoker/reason/time and inserting a new grant in one transaction. The web runtime must not receive insert, update or delete privileges on the grant table.

## Remaining production blockers

- compare Better Auth's generated schema against the applied preview schema;
- create GitHub OAuth app and verify callback, private-email and failure paths;
- exercise an application query through the deployed Hyperdrive binding before enabling PostgreSQL submission mode;
- verify session creation, fixed expiry, logout/revocation and role changes in preview;
- dry-run, review and explicitly apply candidate/evidence/audit import from local SQLite to empty PostgreSQL business tables;
- verify backups, restore, migration rollback, monitoring, rate limits and secret rotation;
- verify Worker CPU/runtime limits, logs, rollback and custom-domain behavior;
- only then design approve/publish state transitions.
