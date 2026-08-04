# M2.2b2b2a verification — GitHub OAuth/PostgreSQL adapter

Date: 2026-08-04

## Implemented

- Better Auth 1.6.25 real route handler at `/api/auth/[...all]`.
- GitHub OAuth provider with encrypted OAuth tokens, database-backed OAuth state and account linking disabled.
- PostgreSQL sessions with fixed eight-hour expiry, no sliding refresh and no cookie session cache.
- Sensitive editor authorization forces session validation and then reads the single active application role grant.
- Explicit status semantics: unauthenticated 401, authenticated without grant/permission 403, unavailable identity infrastructure 503.
- PostgreSQL auth schema and reasoned role grant/revocation migration.
- Vercel + Neon pooled PostgreSQL selected as the first production-like validation target; application code uses standard `pg`.

## Automated verification

```text
npm run check
lint: passed
typecheck: passed
tests: 12 files, 102 tests passed
postgres migrations: passed on PGlite PostgreSQL 17.5 WASM
production build: passed
```

Tests cover complete/incomplete production configuration, HTTPS enforcement, local-token regression, injected external principals, missing role grants, permission denial, infrastructure failure, invalid database roles and auth route fail-closed behavior.

`npm run verify:postgres-migrations` applies `0001` and `0002` twice, then verifies six expected tables, seven required indexes and seven role-grant behaviors: supported roles, reason length, complete revocation, one active grant per user, one active grant per actor, re-grant after revocation and retained grant history. It passed on the bundled PGlite PostgreSQL 17.5 WASM engine.

## Browser verification

Two configurations used one isolated SQLite database and a local server on `127.0.0.1:3110`:

- `local-token`: the editor credential loaded an empty queue and displayed `editor · 0 条`.
- `external-oidc`: the page displayed the GitHub login action and explicit text that login does not grant a role. Validating without a session returned `请先使用已获授权的 GitHub 账号登录。`.
- Both states had `clientWidth = scrollWidth = 1280`.

The local server was stopped and browser tabs were finalized after verification.

## Migration-generation boundary

`npm run auth:schema` was attempted with Better Auth's pinned CLI. The CLI requires a reachable PostgreSQL database for schema introspection; the machine had no PostgreSQL server and the Docker daemon was not running, so the command failed before writing output. `migrations/0001_better_auth.sql` reflects Better Auth 1.6.25's core schema for the committed options. The SQL now executes in PGlite, but it must still be compared with CLI output and applied to a disposable networked PostgreSQL database before production.

## Not verified

- no GitHub OAuth application, callback, account or private-email path;
- no live network PostgreSQL/Neon schema, session, connection pool or role grant; PGlite only verifies local SQL and constraints;
- no Vercel preview or production deployment;
- no session revocation, secret rotation, backup or restore rehearsal;
- business submissions/evidence remain in local SQLite;
- no approve, publish or public-product state.
- production dependency advisory lookup was not run because it would transmit the dependency manifest to an external registry; installed versions and lockfile are recorded, but current advisory status remains unverified.
