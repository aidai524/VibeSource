# Identity and access — M2.2b2b1

## Current boundary

M2.2b2b1 defines and locally verifies the editorial authorization contract. It does not provide production authentication. The only implemented adapter is a fail-closed `local-token` mode for controlled QA; `external-oidc` is a reserved configuration value and deliberately remains unavailable until a real adapter, production database and host are selected.

The server derives the actor and role from server configuration. Clients can present the local token but cannot choose their actor, role or permissions. Every editor API checks the required permission near the protected operation; hiding a button is only a matching UX behavior, never the authorization control.

## Roles and permissions

| Role | Read submissions | Refresh evidence | Reject submission | Perform license review |
|---|---:|---:|---:|---:|
| `editor` | Yes | Yes | Yes | No |
| `license_reviewer` | Yes | Yes | No | Yes |
| `admin` | Yes | Yes | Yes | Yes |

`license:review` reserves the future human legal-review responsibility. There is no approve, publish or legal-decision endpoint in this slice, so possessing that permission does not create an unavailable operation.

## Production target

The production adapter should use a maintained authentication library with an external OIDC/OAuth identity provider and application-owned role assignments. Provider selection remains pending until hosting, database, account lifecycle and operating-region requirements are chosen.

Production sessions must be opaque and server-side/database-backed, with:

- `HttpOnly`, `Secure` and appropriate `SameSite` cookie settings;
- rotation after sign-in or privilege changes, explicit revocation, idle timeout and absolute expiry;
- IdP MFA for privileged roles and no fallback from failed identity checks to elevated access;
- same-origin/CSRF protection on mutations;
- authorization checks in the server data-access/operation layer, not only route middleware or UI;
- audit records containing stable subject, application actor, role, required permission, action, target, time and outcome.

The identity provider proves who signed in. VibeSource remains the source of truth for application roles, permission policy and review audit. No provider claim should silently grant `admin` unless an explicit, audited mapping policy is accepted.

## Deliberately unavailable

- external OIDC login, callback and account lifecycle;
- production session storage, revocation and recovery;
- role-assignment administration;
- approval, publication and public-product state;
- production GitHub credentials or background refresh.

Setting `VIBESOURCE_EDITOR_IDENTITY_MODE=external-oidc` therefore returns an unavailable state rather than simulating a login. These items require a new implementation slice and production verification.
