# M2.2b2a verification — versioned license triage policy

Date: 2026-08-03

## Implemented boundary

- Policy `m2.2b2a-osi-spdx-3.28.0-v1` bundles 136 non-deprecated SPDX 3.28.0 identifiers marked OSI-approved.
- The server derives a view from the developer declaration and the latest GitHub evidence. A missing, error or stale GitHub result cannot pass the gate.
- A public repository, detected OSI-approved SPDX identifier and matching declaration produces only `ready_for_manual_review`; every unresolved condition produces a specific reason.
- The view is deterministic and not persisted separately. It never changes submission status and cannot approve or publish.

## Source reproducibility

Pinned source: `https://raw.githubusercontent.com/spdx/license-list-data/v3.28.0/json/licenses.json`

SHA-256: `f728c534d8bd1044fc515a2ddb2292be99559021d830bfa3281be0bcd36302ee`

`npm run verify:license-policy-source` fetched that pinned source, verified the checksum and reproduced all 136 identifiers using `isOsiApproved=true` and non-deprecated criteria. The normal test/build path remains offline with respect to license services.

## Automated verification

`npm run check` passed:

- ESLint and TypeScript: passed.
- Vitest: 9 files, 89 tests passed.
- Next.js 16.2.12 production build: passed.

Tests cover source version/order/uniqueness, missing and stale evidence, matching SPDX/name declarations, mismatches, no detected license and a non-OSI SPDX identifier.

## Isolated browser verification

- Before GitHub refresh, the policy showed `not_ready` and the missing-evidence reason.
- `vercel/next.js` returned current public MIT evidence. A developer MIT declaration changed the policy immediately to `ready_for_manual_review`; reload reproduced the same derived result.
- `facebook/react` returned HTTP 301 and failed closed without license qualification.
- `lodash/lodash` returned `NOASSERTION / Other`; the Apache-2.0 declaration produced `needs_manual_review` with both non-OSI-snapshot and mismatch reasons.
- Every card remained `pending_review` and “整体仍未核验”. At 1280px there was no horizontal overflow and browser console warnings/errors were empty.

## Not verified by this slice

- Copyright ownership, full license text, dependencies, SPDX expressions, dual licensing, exceptions, compatibility, patent/trademark obligations and legal enforceability.
- Production identity, role assignments, approval audit, public products, background refresh, retention, hosting or database operations.
