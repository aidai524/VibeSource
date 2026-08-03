# Production platform target — M2.2b2b2a

## Accepted validation target

- Web runtime: Vercel Node.js deployment for the existing Next.js App Router application.
- Database: standard PostgreSQL, with Neon pooled PostgreSQL as the first managed target.
- Authentication: Better Auth 1.6.25 with GitHub OAuth and database-backed sessions.
- Authorization: VibeSource-owned roles in `vibesource_editor_role_grants`; GitHub profile claims never grant editor access.

This is a target for the first production-like validation, not evidence of a deployed system. Vercel, Neon and GitHub OAuth resources have not been created, configured or paid for.

## Why this target

Vercel is the narrowest operational path for the current Next.js server routes. Neon exposes standard PostgreSQL connection strings and a pooled endpoint suitable for serverless request concurrency. Better Auth supports Next.js 16, GitHub OAuth, PostgreSQL database sessions, state/PKCE protection and server-side session checks.

The app uses `pg` rather than a Neon-only data API. Moving to another PostgreSQL host should require configuration and operational changes rather than a business-domain rewrite.

## Configuration

Production external identity requires all of:

```text
VIBESOURCE_EDITOR_IDENTITY_MODE=external-oidc
DATABASE_URL=postgresql://...-pooler.../vibesource?sslmode=require
BETTER_AUTH_URL=https://your-production-origin
BETTER_AUTH_SECRET=<at least 32 random characters>
GITHUB_CLIENT_ID=<server secret>
GITHUB_CLIENT_SECRET=<server secret>
```

The GitHub callback is `${BETTER_AUTH_URL}/api/auth/callback/github`. Secrets must stay in the host secret store and must not be copied into source, preview logs or evidence packages.

## Database changes

Apply migrations in numeric order with a migration-owner connection:

1. `migrations/0001_better_auth.sql` — Better Auth 1.6.25 core tables and indexes.
2. `migrations/0002_editor_role_grants.sql` — application-owned, reasoned role grants and revocations.

`npm run auth:schema` asks Better Auth's pinned CLI to generate its current schema. It requires a reachable disposable PostgreSQL database because the CLI introspects existing tables. The command was attempted locally, but no PostgreSQL service or Docker daemon was available; therefore the committed SQL still requires comparison against a generated schema and application to a disposable database before production use.

Use separate database roles:

- migration owner: schema changes only during controlled deployment;
- web application: Better Auth table read/write plus read-only access to `vibesource_editor_role_grants`;
- role operator: explicit grant/revoke changes; no application runtime credentials.

The pooled connection is limited to five application connections per function instance. Transactions must not depend on session-level state because Neon pooling uses transaction mode.

## Manual role operations

After a user completes GitHub sign-in, an operator must resolve the Better Auth user ID and explicitly insert a grant with a stable actor ID, grantor and 10–500 character reason. Changing a role means revoking the active grant with revoker/reason/time and inserting a new grant in one transaction. The web runtime must not receive insert, update or delete privileges on the grant table.

## Remaining production blockers

- compare and apply both migrations on disposable then preview PostgreSQL;
- create GitHub OAuth app and verify callback, private-email and failure paths;
- verify session creation, fixed expiry, logout/revocation and role changes in preview;
- migrate candidate, evidence and audit state from local SQLite to PostgreSQL;
- verify backups, restore, migration rollback, monitoring, rate limits and secret rotation;
- only then design approve/publish state transitions.
