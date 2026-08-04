# M2.2b2b2a Cloudflare adapter verification

Date: 2026-08-04

## Implemented

- Cloudflare Workers target through `@opennextjs/cloudflare` 1.20.2 and Wrangler 4.118.0.
- Explicit `wrangler.jsonc` with `nodejs_compat`, generated-worker entry point, static assets and observability.
- Optional `HYPERDRIVE.connectionString` injection only when `DATABASE_URL` is absent.
- `pg-cloudflare` workerd export preserved through `serverExternalPackages`.
- PostgreSQL pool retires each physical connection after one use; Hyperdrive is expected to own cross-request pooling.
- No Worker, Hyperdrive, database, OAuth app or deployment was created.

## Automated and runtime evidence

```text
npm run build:cloudflare
OpenNext build: passed
Next.js: 16.2.12
OpenNext Cloudflare: 1.20.2
Wrangler: 4.118.0
compatibility date: 2026-08-04
worker output: .open-next/worker.js
wrangler deploy --dry-run: passed
upload size: 6632.40 KiB raw / 1378.66 KiB gzip
```

Local Wrangler preview on `127.0.0.1:3112`:

- `GET /` -> 200, title `VibeSource — AI 原生开源产品发现平台`;
- `GET /api/health` -> 200 with the deterministic health payload;
- `GET /api/auth/session` -> 503 because production identity is unconfigured;
- `POST /api/submissions` -> 503 because submission remains disabled;
- preview was stopped after verification.

## Boundaries

- Local preview does not prove Cloudflare account configuration, remote Worker behavior, custom domains, limits, logs or rollback.
- No Hyperdrive binding or Neon connection was exercised.
- Workers' `node:sqlite` compatibility module is non-functional, so local SQLite business state must migrate before production submission routes can be enabled.
- `npm run deploy:cloudflare` is intentionally not executed without explicit external-resource and publication confirmation.
- The latest adapter currently brings deprecated build-time transitive packages `glob@9.3.5` and `node-domexception@1.0.0`. They are recorded from the local dependency tree; registry advisory lookup was not performed, so current advisory impact remains unverified.
