# M2.2b2b2c verification — PostgreSQL business storage

Date: 2026-08-04

## Implemented

- `migrations/0003_submission_business_storage.sql` for candidates, review events and GitHub/Demo attempts.
- Partial indexes for pending repository uniqueness and pending queue order; indexed foreign keys and observed-at access paths.
- PostgreSQL repository with short transactions, row locking for state transitions, idempotency replay and database-enforced append-only audit/evidence.
- Explicit `VIBESOURCE_SUBMISSION_MODE=postgres`; absent connection fails closed and local-token cannot authorize postgres editing.
- SQLite schema-v3 transfer that defaults to read-only dry-run and requires `--apply`, an empty target and exact transactional count parity.

## Verification

```text
lint: passed
typecheck: passed
tests: 14 files, 109 tests passed
PostgreSQL engine: PGlite PostgreSQL 17.5 WASM
migrations replayed: 0001, 0002, 0003
tables: 10
required indexes: 12
Next production build: passed
Cloudflare OpenNext build: passed
```

Repository tests cover create + submitted event atomicity, idempotent replay, one pending record per repository, versioned rejection, resubmission, GitHub/Demo stale preservation and append-only triggers. Transfer tests cover schema-v3 reads, one-transaction import into empty tables, count parity and repeat-import rejection.

## Not verified

- no network PostgreSQL, Hyperdrive or Neon connection;
- no production SQLite import or backup/restore rehearsal;
- no multi-client load, connection interruption or transaction-pool behavior;
- no external GitHub OAuth session using the PostgreSQL business store;
- no approve, publish or public-product state.
