# A-001 verification — runnable foundation

Date: 2026-08-02
Result: Verified on local macOS with Node.js 24.18.1 and npm 11.16.0.

## Clean-copy reproduction

The workspace was copied to `/private/tmp/vibesource-a001.x0G8zL` without `.git`, `node_modules`, `.next`, or this verification directory. The temporary copy was then exercised with the runtime required by `.nvmrc` and `package.json`.

1. `npm ci` completed and installed 389 packages.
2. `npm run check` completed:
   - ESLint: passed with zero warnings.
   - Next route type generation and `tsc --noEmit`: passed.
   - Vitest: 2 files and 3 tests passed.
   - Next.js 16.2.12 production build: passed; `/` is static and `/api/health` is dynamic.
3. `npm run start -- --hostname 127.0.0.1 --port 3101` started the clean-copy production server in 82 ms.
4. `GET /api/health` returned HTTP 200, `application/json`, `cache-control: no-store`, and:

```json
{"status":"ok","service":"vibesource","milestone":"M1-runnable-foundation"}
```

An initial temporary-shell attempt used Node 26 and emitted the expected engine warning; it was rejected and is not counted as evidence. The successful run above explicitly used the required Node 24/npm 11 toolchain.

npm also reported that optional/install scripts for `fsevents`, `sharp`, and `unrs-resolver` were not approved. This did not prevent lint, typecheck, tests, build, production start, page rendering, or the health route. Script approval remains a deliberate supply-chain decision rather than an implicit setup side effect.

## Browser verification

Environment: Next.js production server in Codex In-app Browser.

| Check | Result |
|---|---|
| Desktop 1440×1024 | Homepage rendered with no horizontal overflow and no console warnings/errors |
| Desktop CTA | “查看收录标准” uniquely resolved and scrolled to `#criteria` |
| Mobile 390×844 | Homepage rendered with no horizontal overflow and no console warnings/errors |
| Mobile navigation | Menu opened, “关于” navigated to `#about`, and the menu closed |
| Truthful empty state | No product cards or metrics; submission is explicitly unavailable until the review loop exists |

- [Desktop screenshot](./desktop-1440x1024.png)
- [Mobile screenshot](./mobile-390x844.png)

## Visual fidelity ledger

- Copy: hero, qualification requirements, review status, and unavailable-submission copy match `docs/DESIGN.md`.
- Layout: desktop split hero/evidence rail and lower three-step qualification band match the accepted concept.
- Responsive flow: mobile keeps the three-line hero, linear qualification path, and complete status card inside 390×844.
- Palette: true white, black, electric lime, and cobalt link treatment match the documented tokens.
- Asset treatment: the generated VibeSource mark is used as a transparent standalone asset, not cropped from a concept image.
- Intentional deviation: implementation typography uses available system Chinese fonts rather than imitating uncertain lettering embedded in the generated concept.

## Verification boundary

This proves the local runnable foundation only. It does not prove a database, authentication, GitHub API, email, payment, analytics, production hosting, submission/review workflow, real products, or traffic.
