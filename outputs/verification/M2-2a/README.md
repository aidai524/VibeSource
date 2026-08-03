# M2.2a local GitHub evidence verification

Date: 2026-08-03
Environment: macOS, Node 24.18.1, npm 11.16.0, Next.js 16.2.12, isolated SQLite file under `/tmp`

## Scope proved

- GitHub evidence is disabled unless local submissions, local editor identity and `VIBESOURCE_GITHUB_EVIDENCE_MODE=live` are all configured.
- Loading the submission or review page performs no GitHub request. Each editor click performs one fixed public repository request with API version `2026-03-10`, no GitHub credential, no retry and no implicit redirect.
- SQLite schema v2 appends every attempt with actor, source, time, status, rate-limit provenance and either strict repository fields or a sanitized error. Update/delete triggers protect the attempt history.
- The latest attempt and last usable success are read separately: first failure is `error`; failure after a success is `stale` and keeps the old snapshot.
- A GitHub observation does not change `pending_review`, version 1 or overall `not_checked`, and there is still no approve/publish path.

## Automated verification

Final command:

```text
npm run check
```

Result:

- ESLint: passed with zero warnings.
- Next type generation and TypeScript: passed.
- Vitest: 7 files, 53 tests passed.
- Next.js production build: passed; the refresh route was emitted as a dynamic Node route.

Deterministic coverage includes 200 mapping, 404, rate limit, timeout, network failure, invalid response, redirect refusal, single-request/no-retry, append-only triggers, initial error, success, stale preservation, rejected-state refusal and fail-closed feature configuration.

## Isolated browser flow

Server configuration used a disposable `/tmp/vibesource-m22a-qa.sqlite` file and local-only editor credential.

1. Submitted three clearly labeled QA fixtures. Before any editor action, all cards displayed `尚未请求`; no snapshot or metric was synthesized.
2. Explicitly refreshed `https://github.com/octocat/Hello-World`.
   - GitHub returned HTTP 200.
   - The review card displayed `已观察`, source `https://api.github.com/repos/octocat/hello-world`, API `2026-03-10`, observed time, public visibility, stars, forks, open issues, default branch, pushed time, archive/fork flags, license detection and response rate-limit balance.
   - GitHub did not detect a known license, and the UI said exactly that rather than inferring reuse rights.
3. Explicitly refreshed `https://github.com/vibesource-qa/definitely-not-a-public-repository`.
   - GitHub returned HTTP 404.
   - The card displayed `刷新失败`, `not_found`, HTTP 404 and no repository snapshot or metrics.
4. A fixture using `facebook/react` exposed a legitimate HTTP 301. The adapter was tightened to `redirect: manual`, so the current behavior records `github_http_error / HTTP 301` after exactly one exchange instead of following an unrecorded second request or collapsing it into a network error. A regression test fixes this behavior.
5. Reloaded the editor page and re-entered the in-memory credential. Both the 200 snapshot and 404 failure remained visible.
6. At 1280 px viewport width, `scrollWidth === innerWidth === 1280`; no horizontal overflow was observed. M2.1 retains the previously verified 390 px responsive baseline; this run did not repeat a mobile viewport.

## Database assertions

Read-only inspection after the browser run:

```json
{"schemaVersion":2,"submissions":3,"pending":3,"attempts":4,"successes":1,"errors":3,"mutatedStatus":0}
```

The extra error is the original pre-fix redirect attempt; it remains intentionally present because evidence attempts are append-only. `mutatedStatus: 0` proves every fixture remained version 1, `pending_review` and overall `not_checked`.

## External contract used

- GitHub REST API version header: `2026-03-10`.
- Public `GET /repos/{owner}/{repo}` without authentication.
- GitHub primary rate-limit response headers are captured for display and diagnosis.
- GitHub license detection is treated as Licensee output, not legal advice or proof of eligibility.

## Not proved

- Production identity, GitHub App/OAuth/token management, conditional requests, background refresh, webhook handling, production rate-limit capacity or data retention.
- Demo reachability, deployment success, malware/security, repository content, commit activity or legal validity of a license.
- Production database concurrency, backup, restore, hosting, monitoring or rollback.
- Approval, publication, public product pages, ranking, community, Newsletter, analytics or payment.

M2 remains in progress. M2.2a is a local evidence slice, not production launch readiness.
