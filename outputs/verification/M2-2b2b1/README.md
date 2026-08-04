# M2.2b2b1 verification — editorial authorization contract

Date: 2026-08-03

## Implemented

- Application roles: `editor`, `license_reviewer`, `admin`.
- Permissions: `submission:read`, `submission:reject`, `evidence:refresh`, `license:review`.
- Each editor route requires its specific permission after token authentication; the server derives actor, role and permissions from server configuration.
- Review UI receives server-derived capabilities and does not render operations the role cannot execute.
- `external-oidc` is recognized but remains unavailable because no production adapter or session store exists.

## Automated verification

```text
npm run check
lint: passed
typecheck: passed
tests: 10 files, 95 tests passed
production build: passed
```

Tests cover the exact role map, fail-closed configuration, valid/invalid tokens, 403 for insufficient permission, same-origin enforcement and the reserved unavailable OIDC mode.

## Isolated browser and API verification

The app ran on `127.0.0.1:3108` with an isolated SQLite database, local submission mode, `local-token` identity and role `license_reviewer`.

- A real persisted QA candidate loaded in the review queue.
- The queue identified the role as `license_reviewer`.
- Evidence refresh remained available.
- No reject form or reject button was rendered; explicit permission copy was visible.
- An authenticated same-origin `POST` to the reject endpoint returned HTTP 403 with `当前编辑角色没有执行此操作的权限。`.
- Reload confirmed the candidate remained `pending_review`.
- At 1280 px, `clientWidth` equaled `scrollWidth`; no console errors were observed.

The isolated server was stopped after verification and no QA database was added to the repository.

## Boundaries not verified

- No external identity provider, callback, account lifecycle or MFA exists.
- No database-backed production session, rotation, revocation or role-assignment administration exists.
- The local token is not production authentication.
- No approve, publish, public-product or legal-license-decision operation exists.
- Production hosting, database, GitHub identity and audit retention remain unselected and unverified.
