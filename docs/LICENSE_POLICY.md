# License policy — M2.2b2a

Status: accepted local triage policy; not legal advice and not a publication decision.

## Purpose

VibeSource needs a deterministic way to decide whether a submission has enough current license evidence to enter human license review. The policy must not turn GitHub Licensee detection into a legal conclusion.

## Versioned source

- Policy version: `m2.2b2a-osi-spdx-3.28.0-v1`.
- Source: SPDX License List 3.28.0, released 2026-02-20.
- Filter: `isOsiApproved === true` and `isDeprecatedLicenseId !== true`.
- Snapshot: 136 SPDX identifiers in `src/domain/license-policy-source.json`.
- Source SHA-256: `f728c534d8bd1044fc515a2ddb2292be99559021d830bfa3281be0bcd36302ee`.

The normal app and `npm run check` use the committed snapshot and make no license-service network request. A maintainer can explicitly run `npm run verify:license-policy-source` to fetch the pinned SPDX tag, verify its checksum and reproduce the identifier set.

## Derived states

### `not_ready`

Used when GitHub evidence has never been requested, or the latest GitHub attempt failed and the old snapshot is stale. Stale license evidence cannot pass the gate.

### `needs_manual_review`

Used when any machine-checkable prerequisite is unresolved:

- repository evidence is not public;
- GitHub Licensee did not detect a license;
- the detection has no SPDX identifier;
- the SPDX identifier is absent from the policy snapshot; or
- the developer declaration differs from GitHub's SPDX identifier, key and name.

This state is not an automated rejection. Custom, multi-license, exception and uncommon cases remain reviewable by a human.

### `ready_for_manual_review`

Requires a current successful GitHub snapshot, a public repository, an OSI-approved non-deprecated SPDX identifier and an exact normalized match to the developer declaration. It only means the machine prerequisites are internally consistent.

## Explicit non-conclusions

The policy does not determine copyright ownership, license-text integrity, dependency compatibility, dual-license choice, SPDX expressions, license exceptions, trademark/patent obligations, commercial-use suitability or legal enforceability. It never changes `pending_review`, creates approval, or publishes a product.

## Refresh and change control

A future SPDX or OSI update requires a new committed snapshot, policy-version bump, checksum verification, tests and a decision-log entry. Existing historical GitHub evidence must retain its original source and observation time; policy changes must not rewrite evidence attempts.
