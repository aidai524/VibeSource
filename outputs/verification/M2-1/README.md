# M2.1 verification record

Date: 2026-08-03
Environment: macOS, Node.js 24.18.1, npm 11.16.0
Scope: local, single-instance, fail-closed candidate submission and rejection audit only

## Result

The following local vertical slice was verified:

1. Default configuration renders the unavailable state and `POST /api/submissions` returns HTTP 503.
2. Local mode accepts the eight-field QA fixture and returns a real UUID with `pending_review`, version 1 and `not_checked`.
3. The protected local queue reads the persisted record and labels developer claims and unchecked external evidence separately.
4. A server-derived `qa-editor` rejects the record with a reason and expected version.
5. The queue becomes empty; after a server restart, SQLite still contains `rejected`, version 2, `not_checked` and both `submitted` and `rejected` events.
6. A second visual-only fixture was rejected through the same API after QA. The isolated database finished with 2 rejected fixtures, 0 pending fixtures, 4 audit events and no evidence value other than `not_checked`.

No fixture was inserted into source code, a production database or a public directory. The temporary SQLite file lived under `/private/tmp` and is not part of this repository.

## Automated verification

`npm run check` passed after the browser-discovered same-origin fix:

- ESLint: pass with zero warnings.
- Next type generation and `tsc --noEmit`: pass.
- Vitest: 6 files, 41 tests passed.
- Next.js 16.2.12 production build: pass.
- Dynamic routes produced for `/`, `/submit`, `/editor/submissions`, `/api/submissions`, `/api/editor/submissions` and `/api/editor/submissions/[id]/reject`.

Tests include idempotency replay, pending-repository uniqueness, rejected resubmission, optimistic version conflicts, migration idempotency, real-file reopen, private/local URL rejection, server-side actor authorization and two SQLite trigger fault injections. The fault injections prove that an audit insert failure rolls back the related submission or status change.

## Browser verification

The in-app browser ran against an isolated local Next.js process.

- Blank submit focused the first required field.
- Successful submit displayed the real ID, pending state and unchecked evidence state.
- Blank reject focused the required reason field.
- Successful reject removed the card and announced the recorded result.
- Restarted server returned an empty pending queue; a read-only database assertion confirmed the rejected record and two events.
- 390×844 submit and editor pages had `documentWidth === innerWidth === 390`.
- The mobile navigation opened with the expected three site-root links.
- 1280px submit and editor pages had no horizontal overflow.
- Final submit and editor screenshots were visually inspected in the browser session; no framework error overlay was present.
- Console warning/error logs were empty on both final pages.

During the first reject attempt, browser QA exposed a legitimate-host false negative: Next.js canonicalized `Request.url` to `localhost` while the browser sent `127.0.0.1` in `Origin` and `Host`. The origin gate was changed to accept the actual browser destination in `Host` while preserving the protocol check; a regression test was added before the full flow was rerun successfully.

## Acceptance boundary

This evidence only supports partial verification of A-101, A-102, A-104 and A-109. It does not verify:

- a repository is public or eligible;
- a Demo is reachable, safe or deployable;
- a license is present or permits reuse;
- production identity, rate limiting or multi-instance storage;
- approval, publication, public product pages or external metrics;
- real external failure, retry or stale-data behavior.

Accordingly, M2 remains in progress. A-103, A-105 and A-111 remain Not run.
