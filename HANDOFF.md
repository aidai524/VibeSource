# VibeSource handoff

Last updated: 2026-08-04

## Current state

- Phase: implementation
- Current milestone: M2 — 可信提交与人工审核
- Responsible Task: main project Task
- Architecture profile: standard；当前是单仓库项目，不需要 federated
- Repository state: GitHub draft PR #1；当前分支 `agent/initial-vibesource`

## What works

- Codex 编排式协作基线已经创建。
- 产品范围、逻辑架构、路线图、决策和 MVP 验收条件已有初版。
- Explorer 与 Reviewer 被限定为只读角色；初始化没有创建子代理、工作树或后台任务。
- Next.js 空状态首页、响应式移动导航和 `/api/health` 已实现。
- 默认首页只显示人工核验状态与三项收录要求，不展示虚构产品或指标；只有受控本地模式才显示真实提交入口。
- M1 时点的 Vitest、lint、typecheck 和 production build 已验证；M2.1 当前验证状态另列于下方证据表。
- 桌面与移动概念稿、独立 Logo 资产和 `docs/DESIGN.md` 已保存。
- M2.1 受控本地切片已经实现：提交模式默认关闭，只有显式启用 `local` 且配置绝对数据库路径后才接收候选资料。
- 8 项候选资料经过服务端确定性校验后，以 `pending_review` 状态和 `submitted` 审计事件原子写入带迁移的 SQLite 文件。
- 整体发布资格固定为 `not_checked`；只有本地编辑显式开启并点击后才访问 GitHub 或 Demo，许可证策略运行时使用版本化本地快照，不访问许可证服务。
- 本地编辑 token 和服务器端 actor 只能执行带理由、预期版本和原子审计事件的拒绝；没有批准、发布或公开产品路径。
- M2.1 当前 lint、typecheck、41 个自动化测试和 production build 通过；隔离浏览器已完成默认关闭、提交、审核、拒绝、重启持久化、桌面/移动溢出和控制台验收。
- M2.2a 已实现本地编辑显式 GitHub 证据刷新：固定公开 API、API 版本 `2026-03-10`、一次请求、无 Token/重试/重定向、8 秒超时和 1 MiB 响应上限。
- SQLite schema v2 追加保存每次 GitHub 成功或失败；最近尝试和最后可用快照分离，失败后旧成功显示 `stale`，触发器禁止证据 update/delete。
- 审核台显示来源、观察时间、仓库指标、许可证检测、限流余量和 error/stale；整体发布资格仍为 `not_checked`，没有批准或发布路径。
- M2.2a 时点 `npm run check` 通过：7 个文件、53 个测试、lint、typecheck 和 production build；真实公开仓库 200、不可见仓库 404 与刷新后持久化已通过浏览器验证。
- M2.2b1 已实现本地编辑显式 Demo 响应头验证：全地址公网校验、固定 IP、原域名 TLS、一次 GET、禁止重定向、8 秒超时、16 KiB 头上限且不读取正文。
- SQLite schema v3 追加保存 Demo 成功或失败；真实 HTTP 200、保留网段拒绝、301 拦截与刷新后持久化已通过隔离浏览器验证，整体状态仍为 `not_checked`。
- M2.2b1 时点 `npm run check` 通过：8 个文件、81 个测试、lint、typecheck 和 production build。
- M2.2b2a 已实现版本化许可证机器分流：内置 SPDX 3.28.0 的 136 个未废弃 OSI-approved 标识和来源 SHA-256，从当前 GitHub 证据与开发者声明派生三态人工复核建议。
- `ready_for_manual_review` 只代表机器前置条件一致；GitHub stale/error、未检测、非快照标识或声明不一致都会显示具体原因，且永远不改变 `pending_review`。
- M2.2b2b1 已实现编辑授权契约：`editor`、`license_reviewer`、`admin` 映射到四项最小权限，所有编辑 API 在服务端按操作授权，UI 同步移除无权操作。
- `external-oidc` 是保留但不可用的生产目标；当前 local-token 只用于受控 QA，不是生产身份或会话。
- 当前 `npm run check` 通过：10 个文件、95 个测试、lint、typecheck 和 production build；角色 UI 与直接 API 403 已通过隔离浏览器验证。
- M2.2b2b2a 已实现默认关闭的 Better Auth 1.6.25 + GitHub OAuth + PostgreSQL session 适配器；完整 HTTPS/secret/OAuth/database 配置才启用真实 auth handler。
- 敏感编辑 API 强制数据库 session 查询，再读取应用自有的唯一活动角色 grant；未认证 401、已认证未授权 403、基础设施故障 503，GitHub identity 不自动授予角色。
- PostgreSQL 核心 auth schema 与可审计角色授权迁移已提交；D-023 将首个托管验证目标改为 Cloudflare Workers/OpenNext + Hyperdrive + Neon，但没有创建外部资源，也没有迁移本地业务数据。
- PGlite 仅作为开发测试依赖；两份迁移已在 PostgreSQL 17.5 WASM 中重复应用并验证 6 张表、7 个索引、角色/理由/撤销约束、活动 user/actor 唯一性、重新授权和历史保留。
- Cloudflare OpenNext 适配已实现：`nodejs_compat`、Workers-safe `pg-cloudflare` 打包、可选 Hyperdrive 连接串注入和 `maxUses: 1`；本地 Worker 首页/健康接口 200，未配置 auth/提交接口保持 503。
- 当前 `npm run check` 通过：12 个文件、103 个 Vitest 测试、PostgreSQL 迁移验证、lint、typecheck、Next production build 和 Cloudflare OpenNext build；本地 token 与外部登录空状态浏览器回归通过。

## In progress

- 保持 M2.1 的本地证据包可复现，不把它升级解释为生产能力。
- 设计生产许可证人工复核流程；本地机器分流已完成，但公开产品变更处理、生产刷新和保留策略仍待定。
- 按 D-023 创建并验证 GitHub OAuth、Cloudflare Worker/Hyperdrive 与 Neon preview database；应用/复核迁移、session/revocation 和角色变化。本地 token 不能升级解释为生产身份。
- 为 M2 选择生产数据库、迁移和托管方案；本地 `node:sqlite` 不关闭 D-015。
- 确认 Newsletter、分析和后续支付方案。
- 确认开放源码资格、AI 参与分类、榜单算法与反作弊政策。
- 确认首发语言、目标市场和对外品牌名。

## Entry points and commands

- Homepage: `src/app/page.tsx`
- Candidate page: `src/app/submit/page.tsx`
- Candidate API: `src/app/api/submissions/route.ts`
- Local review page: `src/app/editor/submissions/page.tsx`
- Local review APIs: `src/app/api/editor/submissions/`
- Domain and validation: `src/domain/submission.ts`
- Local persistence and migration: `src/server/database.ts`, `src/server/submission-repository.ts`
- Health endpoint: `src/app/api/health/route.ts`
- Development: `npm run dev`
- Tests: `npm test`
- PostgreSQL migration verification: `npm run verify:postgres-migrations`
- Cloudflare build: `npm run build:cloudflare`
- Cloudflare local preview: `npm run preview:cloudflare`
- Cloudflare deploy (external write, explicit confirmation required): `npm run deploy:cloudflare`
- Complete checks: `npm run check`
- Production build/server: `npm run build && npm run start`

## Decisions that constrain the next step

- 产品必须同时满足公开源码和可体验要求。
- 产品发布必须经过人工审核，数据必须显示来源、时间和验证状态。
- 自然榜单与付费推广分离；付费、发布、邮件发送和删除保持人工确认。
- 前期至少一半精力用于寻找产品、采访开发者、内容分发和帮助首批项目获得真实用户。
- M2.1 仅是本地失效关闭切片：同步 SQLite、绝对文件路径和本地 token 都不是生产承诺。
- 在生产身份适配器、许可证人工流程和批准审计完成前，不增加批准或发布入口。
- M2.2a 的未认证 GitHub API 受共享 IP 每小时限额约束；它只证明本地手动刷新，不关闭 D-014。
- See `docs/DECISIONS.md`.

## Verification evidence

| Check | Result | Evidence | Date |
|---|---|---|---|
| Standard profile dry-run | Complete | 13 planned files, no conflicts | 2026-08-02 |
| Standard profile creation | Complete | Initializer reported 13 created files | 2026-08-02 |
| Tailored baseline review | Complete | Product brief applied across PRODUCT, ARCHITECTURE, ACCEPTANCE, ROADMAP and DECISIONS; unknowns remain explicit | 2026-08-02 |
| Standard profile check | Complete | Initializer reported all 13 required files present | 2026-08-02 |
| Non-overwrite dry-run | Complete | JSON dry-run reported 13 preserved and zero planned/conflicting files | 2026-08-02 |
| Agent configuration parse | Complete | Python 3.12 parsed both TOML files successfully | 2026-08-02 |
| Current-workspace lint | Complete | `npm run lint` passed | 2026-08-02 |
| Current-workspace tests | Complete | 2 files, 3 Vitest tests passed | 2026-08-02 |
| Current-workspace typecheck | Complete | Next type generation and `tsc --noEmit` passed | 2026-08-02 |
| Current-workspace production build | Complete | Next.js 16.2.12 build produced `/` and `/api/health` | 2026-08-02 |
| Responsive browser flow | Complete | 1440×1024 and 390×844; anchor/menu interactions passed; mobile had no horizontal overflow | 2026-08-02 |
| Clean-copy install and complete checks | Complete | Node 24.18.1/npm 11.16.0; `npm ci` plus `npm run check`; 3 tests and production build passed | 2026-08-02 |
| Clean-copy production start and health | Complete | Server ready on 127.0.0.1:3101; `/api/health` returned HTTP 200 and the deterministic M1 payload | 2026-08-02 |
| A-001 evidence package | Complete | `outputs/verification/A-001/` contains the reproduction record and production screenshots | 2026-08-02 |
| M2.1 lint | Complete | `npm run lint` passed for the current M2.1 code | 2026-08-03 |
| M2.1 typecheck | Complete | Next type generation and `tsc --noEmit` passed for the current M2.1 code | 2026-08-03 |
| M2.1 complete checks | Complete | `npm run check`; lint/typecheck passed, 6 files / 41 Vitest tests passed, Next.js 16.2.12 production build completed | 2026-08-03 |
| M2.1 default fail-closed state | Complete | `/submit` showed unavailable state and `POST /api/submissions` returned HTTP 503 without local mode | 2026-08-03 |
| M2.1 browser workflow | Complete | Isolated QA fixture submitted, loaded with local editor credential, rejected with server actor, removed from queue and remained rejected after restart | 2026-08-03 |
| M2.1 persistence and audit | Complete | After restart: `rejected`, version 2, `not_checked`, two events; final isolated DB had 0 pending and all visual fixtures formally rejected | 2026-08-03 |
| M2.1 responsive and console QA | Complete | 390×844 and 1280px pages had no horizontal overflow; mobile menu and required-field focus passed; final console warnings/errors empty | 2026-08-03 |
| M2.1 evidence package | Complete | `outputs/verification/M2-1/README.md` records commands, browser flow, database assertions and unverified boundaries | 2026-08-03 |
| M2.2a complete checks | Complete | `npm run check`; lint/typecheck passed, 7 files / 53 tests passed, Next.js production build completed | 2026-08-03 |
| M2.2a real GitHub success | Complete | Explicit refresh of `octocat/Hello-World` returned a timestamped public snapshot with API version, metrics, license detection and rate-limit provenance | 2026-08-03 |
| M2.2a real GitHub failure | Complete | A nonexistent public path produced persisted `not_found` / HTTP 404 with no fabricated snapshot | 2026-08-03 |
| M2.2a persistence and stale semantics | Complete | Browser reload preserved success/error; deterministic tests preserve old success after simulated rate limit and derive `stale` | 2026-08-03 |
| M2.2a evidence package | Complete | `outputs/verification/M2-2a/README.md` records implementation, commands, browser/API evidence and remaining boundaries | 2026-08-03 |
| M2.2b1 complete checks | Complete | `npm run check`; lint/typecheck passed, 8 files / 81 tests passed, Next.js production build completed | 2026-08-03 |
| M2.2b1 real Demo outcomes | Complete | HTTP 200 headers persisted; QA-resolved reserved address was rejected; HTTP 301 was not followed | 2026-08-03 |
| M2.2b1 persistence and UI | Complete | Reload preserved the 200 snapshot; overall remained unverified; 1280px had no overflow and console was clean | 2026-08-03 |
| M2.2b1 evidence package | Complete | `outputs/verification/M2-2b1/README.md` records security boundary, checks, browser evidence and remaining limits | 2026-08-03 |
| M2.2b2a policy source | Complete | SPDX 3.28.0 snapshot: 136 OSI-approved non-deprecated identifiers; pinned SHA-256 reproduced by explicit verification script | 2026-08-03 |
| M2.2b2a browser policy | Complete | Real MIT match became ready for manual review; redirect failed closed; NOASSERTION/mismatch showed reasons; reload reproduced results | 2026-08-03 |
| M2.2b2a evidence package | Complete | `outputs/verification/M2-2b2a/README.md` records policy, checks, browser evidence and non-legal boundaries | 2026-08-03 |
| M2.2b2b1 role authorization | Complete | `license_reviewer` could read/refresh but had no reject UI; direct authenticated reject returned HTTP 403 and candidate stayed pending | 2026-08-03 |
| M2.2b2b1 complete checks | Complete | `npm run check`; lint/typecheck passed, 10 files / 95 tests passed, Next.js production build completed | 2026-08-03 |
| M2.2b2b1 evidence package | Complete | `outputs/verification/M2-2b2b1/README.md` records the role contract, API/UI checks and production identity boundary | 2026-08-03 |
| M2.2b2b2a automated checks | Complete | `npm run check`; lint/typecheck passed, 12 files / 102 tests passed, Next.js production build completed | 2026-08-04 |
| M2.2b2b2a browser fallback | Complete | Local token queue remained functional; external mode showed GitHub login and returned explicit unauthenticated state; both had no 1280px overflow | 2026-08-04 |
| M2.2b2b2a evidence package | Complete | `outputs/verification/M2-2b2b2a/README.md` records implementation, failure boundaries and missing live provider/database verification | 2026-08-04 |
| M2.2b2b2a local PostgreSQL migration verification | Complete | Both migrations replayed on PGlite PostgreSQL 17.5 WASM; 6 tables, 7 required indexes and 7 role-grant behaviors passed | 2026-08-04 |
| M2.2b2b2a Cloudflare OpenNext build | Complete | OpenNext 1.20.2 generated `.open-next/worker.js` for Next.js 16.2.12 with Workers `nodejs_compat` | 2026-08-04 |
| M2.2b2b2a Cloudflare local preview | Complete | Homepage and health returned 200; unconfigured auth and submission returned explicit 503; preview stopped after verification | 2026-08-04 |
| M2.2b2b2a Cloudflare evidence package | Complete | `outputs/verification/M2-2b2b2a-cloudflare/README.md` records build, local runtime outcomes and unverified remote boundaries | 2026-08-04 |

## Known risks and unverified items

- 主要商业风险是供给与流量冷启动，而不是页面开发本身。
- GitHub API 限流、仓库转私有、许可证变化和指标过期会影响“已验证”状态。
- 榜单、点赞、评论和提交入口会受到刷量、机器人和垃圾内容攻击。
- Demo 链接、仓库内容和用户提交均是不可信外部输入。
- 本地 `node:sqlite` 是同步、单实例文件存储，且 API 为 Stability 1.2 / Release Candidate；它不证明生产数据库、并发、备份或恢复能力。
- Demo 只验证单个时点的响应头，不证明持续可用、内容安全或部署成功；许可证法律/资格判断、真实 GitHub OAuth/Hyperdrive/PostgreSQL/远端 Cloudflare、邮件、支付、分析和生产部署均未验证。
- 当前 local build 和浏览器成功不证明生产托管、签名域名、监控、备份与回滚能力。
- PGlite 只证明单进程 WASM PostgreSQL 上的 SQL 执行和约束；不证明 Better Auth CLI schema 一致性、网络 PostgreSQL、并发、Neon pooling、session 或运维能力。
- 新增依赖已锁定并通过 build/test，但当前安全公告查询未执行；对外发送依赖清单前需明确授权，生产上线前必须补做依赖审计。
- M2.1 只证明单实例本地候选提交与人工拒绝路径；不证明批准、发布、公开产品、榜单或流量闭环。

## Next smallest verifiable milestone

由人工创建 GitHub OAuth App、Cloudflare Worker/Hyperdrive 和 Neon preview database；在预览环境复核并应用迁移，验证 callback、private email、session expiry/revocation、角色 grant/revoke、secret rotation 和故障路径。随后把候选/证据/审计存储从 SQLite 迁到 PostgreSQL。在这些完成前保持 approve/publish 不存在。
