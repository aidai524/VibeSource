# Identity and access — M2.2b2b1

## Current boundary

M2.2b2b1 defines the editorial authorization contract. M2.2b2b2a adds a fail-closed Better Auth 1.6.25 adapter using GitHub OAuth and PostgreSQL database sessions. The adapter compiles, has deterministic authorization tests and renders locally, but no real GitHub OAuth app, PostgreSQL database or production host has been connected, so production authentication remains unverified.

The server derives the actor and role from server configuration. Clients can present the local token but cannot choose their actor, role or permissions. Every editor API checks the required permission near the protected operation; hiding a button is only a matching UX behavior, never the authorization control.

## Roles and permissions

| Role | Read submissions | Refresh evidence | Reject submission | Perform license review |
|---|---:|---:|---:|---:|
| `editor` | Yes | Yes | Yes | No |
| `license_reviewer` | Yes | Yes | No | Yes |
| `admin` | Yes | Yes | Yes | Yes |

`license:review` reserves the future human legal-review responsibility. There is no approve, publish or legal-decision endpoint in this slice, so possessing that permission does not create an unavailable operation.

## Production target

The selected validation target is Better Auth with GitHub OAuth, standard PostgreSQL, Vercel Node.js hosting and Neon pooled PostgreSQL. The application uses only a PostgreSQL connection string, so the database can move to another compatible provider. Hosting and database accounts have not been created or paid for.

Production sessions must be opaque and server-side/database-backed, with:

- `HttpOnly`, `Secure` and appropriate `SameSite` cookie settings;
- fixed eight-hour expiry without sliding refresh, explicit revocation and reauthentication after privilege changes;
- IdP MFA for privileged roles and no fallback from failed identity checks to elevated access;
- same-origin/CSRF protection on mutations;
- authorization checks in the server data-access/operation layer, not only route middleware or UI;
- audit records containing stable subject, application actor, role, required permission, action, target, time and outcome.

GitHub proves who signed in. VibeSource remains the source of truth for application roles, permission policy and review audit. Account linking is disabled, OAuth tokens are encrypted at rest, OAuth state is stored in PostgreSQL, cookie/origin/CSRF checks stay enabled, and sensitive editor APIs force a database session lookup rather than accepting a cookie cache.

An authenticated account without an active role grant receives 403. Each grant records the Better Auth user ID, stable actor ID, role, grantor, time and reason; revocation requires its own actor, time and reason. The application query only accepts a single unrevoked grant and rejects unknown role strings.

## Deliberately unavailable

- live GitHub OAuth credentials and callback verification;
- applied production session schema, revocation and recovery rehearsal;
- role-assignment administration;
- approval, publication and public-product state;
- production GitHub credentials or background refresh.

Setting `VIBESOURCE_EDITOR_IDENTITY_MODE=external-oidc` without every required value returns an unavailable state. With complete configuration, the real auth route is enabled; database or provider failures remain visible and never fall back to local-token or elevated access.
