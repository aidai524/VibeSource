# M2.2b1 verification — local Demo response-header evidence

Date: 2026-08-03

## Implemented boundary

- Demo evidence is disabled unless `VIBESOURCE_DEMO_EVIDENCE_MODE=live` and the local editor boundary is complete.
- One explicit editor click performs one HTTPS GET. All resolved A/AAAA addresses must be public; the connection is pinned to the selected verified IP while preserving the submitted hostname for Host and TLS verification.
- Redirects are not followed. The response is destroyed after headers; response bodies and redirect locations are not stored.
- Every success or failure is appended to SQLite schema v3. A failed refresh preserves the last successful snapshot and derives `stale`; no attempt changes submission status or creates approval/publication state.

## Automated verification

`npm run check` passed:

- ESLint: passed with zero warnings.
- Next type generation and `tsc --noEmit`: passed.
- Vitest: 8 files, 81 tests passed.
- Next.js 16.2.12 production build: passed, including the Demo refresh route.

Deterministic tests cover public/reserved IPv4 and IPv6, IPv4-mapped IPv6, mixed DNS results, pinned request options, success, redirect and HTTP failures, DNS/timeout/TLS/network errors, no retry, schema v3, append-only triggers, stale preservation, rejected-submission protection, and default-disabled configuration.

## Isolated browser verification

Environment: local Next development server on `127.0.0.1:3108`, isolated SQLite file, server-owned `qa-editor`, GitHub evidence disabled, Demo evidence live.

- `https://example.com/` resolved in the QA network to `198.18.13.193`, a reserved benchmarking address. The adapter saved `unsafe_address`, made no Demo request, and displayed no fabricated snapshot.
- `https://1.1.1.1/` returned HTTP 301. The adapter saved `redirect_blocked` and did not follow it.
- `https://1.1.1.1/cdn-cgi/trace` returned HTTP 200 with `text/plain`; the UI displayed the timestamp, `m2.2b1-v1`, GET, pinned `1.1.1.1 / IPv4`, and observed response time.
- After browser reload and a fresh authenticated queue read, the successful snapshot remained. The candidate still showed “整体仍未核验”.
- At 1280px, document `scrollWidth` equaled `clientWidth`; browser console warnings/errors were empty.

## Not verified by this slice

- A successful response header is not proof of continuous uptime, safe/useful page content, successful deployment, user conversion, or license eligibility.
- Local direct egress is not a production network sandbox, proxy policy, background scheduler, data retention plan, monitoring system, or production identity model.
- No approve, publish, public product, payment, email, or destructive action exists.
