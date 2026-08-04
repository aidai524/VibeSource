# VibeSource

> Status: M2 in progress · PostgreSQL business repository and Cloudflare Workers/OpenNext build verified locally; external services remain not live-verified · Architecture profile: standard

VibeSource 是一个专门发现和发布 AI 原生开源产品的平台。开发者可以获得首发与持续流量；用户可以直接体验产品、查看源码、判断 AI 的参与方式，并基于许可证与部署说明复用成果。

VibeSource 是当前工作名，对外品牌名仍待确认。

## 计划中的 MVP 边界

- 产品必须提交公开源码仓库，并提供可体验 Demo、在线服务或可部署版本。
- 产品页展示 AI 参与说明、技术栈、部署方式、许可证和二次开发信息。
- GitHub 指标必须附来源与抓取时间；活跃用户、收入等无法独立确认的数据必须标为自述或附证据。
- 第一版包含产品提交、GitHub 验证、人工审核、每日榜单、分类、点赞、评论和 Newsletter 订阅。
- 正式开放社区提交前，先人工筛选并核验 50–100 个质量较高的产品。
- 付费置顶或首发服务必须明确标注，不得伪装成自然榜单结果。

完整范围和非目标见 `docs/PRODUCT.md`。

## Quick start

需要 Node.js 24 和 npm 11；仓库中的 `.nvmrc` 与 `packageManager` 字段记录了这一约束。

```bash
npm ci
npm run dev
```

打开 `http://localhost:3000`。健康检查位于 `http://localhost:3000/api/health`。

运行当前已通过的自动化基线：

```bash
npm run lint
npm run typecheck
npm test
```

验证完整自动化基线和生产模式构建：

```bash
npm run build
npm run start
```

当前代码已通过 `npm run check`（109 项 Vitest 测试、PostgreSQL 迁移约束验证、Next production build 与 Cloudflare OpenNext build）。M2.1 至 M2.2b2b2c 的证据位于 `outputs/verification/`；真实 GitHub OAuth、Cloudflare Worker/Hyperdrive 和托管 PostgreSQL 环境仍未创建或验证。

默认运行仍是有意保留的失败关闭状态：`VIBESOURCE_SUBMISSION_MODE` 未显式设为受控的 `local` 或 `postgres` 时，页面和 API 都不会接收提交。GitHub 与 Demo 时点证据各自需要显式开启和有权限的人工点击；许可证策略只派生人工复核建议。当前没有批准、发布、公开产品、许可证法律判断或生产身份能力。

## M2 本地流程

M2.1 只用于本地或受控 QA。参考 `.env.example` 在未提交到 Git 的本地环境中配置：

```bash
VIBESOURCE_SUBMISSION_MODE=local
VIBESOURCE_DB_PATH=/absolute/path/to/vibesource.sqlite
VIBESOURCE_EDITOR_IDENTITY_MODE=local-token
VIBESOURCE_EDITOR_TOKEN=replace-with-a-local-secret
VIBESOURCE_EDITOR_ID=local-editor
VIBESOURCE_EDITOR_ROLE=editor
VIBESOURCE_GITHUB_EVIDENCE_MODE=live
VIBESOURCE_DEMO_EVIDENCE_MODE=live
```

`VIBESOURCE_DB_PATH` 必须是绝对路径。启动后：

- `/submit` 接收 8 项候选资料；服务端只校验字段和 URL 形状。
- `POST /api/submissions` 原子保存 `pending_review` 记录和 `submitted` 审计事件。
- `/editor/submissions` 使用本地 token 验证 `editor`、`license_reviewer`、`admin` 三种角色；每个 API 在服务端校验读取、拒绝、证据刷新或许可证复核权限。
- 每次 GitHub 刷新只请求固定的公开仓库 API 一次，不读取 Token、不自动重试；保存来源、API 版本、观察时间、限流头、结构化快照或失败。
- Demo 刷新解析全部地址，任一非公网地址即拒绝；一次 HTTPS GET 固定到已验证 IP，禁止重定向，收到响应头后停止且不读取正文。
- 两类证据的最近刷新失败都会保留上一份成功快照并标为 `stale`；整体发布资格仍为 `not_checked`。
- 许可证策略使用提交内置的 SPDX 3.28.0 OSI-approved 快照，比较当前 GitHub 检测与开发者声明；结果只表示证据是否足以进入人工复核。

本地存储使用 Node 24 内置的同步 `node:sqlite` 文件数据库和显式迁移。该 API 当前为 Stability 1.2 / Release Candidate，M2.1 只允许单实例本地使用；它不是生产数据库或托管方案的选择。

## M2 生产身份目标

M2.2b2b2a 已加入默认关闭的 Better Auth 1.6.25 + GitHub OAuth + PostgreSQL 数据库会话适配器。完整配置见 `.env.example`；核心 schema 和应用角色授权表位于 `migrations/`。`npm run verify:postgres-migrations` 会在内存 PGlite/PostgreSQL WASM 中重放迁移并验证关键约束。GitHub 登录只建立账号身份，只有 `vibesource_editor_role_grants` 中未撤销的人工授权才能产生编辑权限。

当前优先验证目标是 Cloudflare Workers + OpenNext，以及通过 Hyperdrive 连接的 Neon PostgreSQL。Cloudflare 构建、本地 Workers 预览和 PostgreSQL 业务仓储已经通过本地验证；默认/本地 QA 仍使用 SQLite，真实 Hyperdrive/Neon 数据路径尚未运行，所以项目还不能称为生产系统。创建外部账号、绑定真实资源、应用迁移和生产部署仍需单独确认与验收。

M2.2b2b2c 已增加标准 PostgreSQL 业务仓储，覆盖候选、审核事件和 GitHub/Demo 证据。只有显式设置 `VIBESOURCE_SUBMISSION_MODE=postgres` 且数据库连接存在时才启用；本地 token 不允许在 PostgreSQL 模式中充当生产编辑身份。`migrations/0003_submission_business_storage.sql` 定义生产表、部分索引和追加保护。

旧 SQLite 数据迁移默认只做只读盘点：

```bash
npm run migrate:sqlite-to-postgres -- --source=/absolute/path/to/vibesource.sqlite
```

只有人工复核计数、先应用迁移并确认目标业务表为空后，才可追加 `--apply`；写入使用单一事务，要求迁移所有表的前后计数完全一致。该命令读取 `DATABASE_URL`，不会读取或打印连接串。

Cloudflare 本地构建命令：

```bash
npm run build:cloudflare
npm run preview:cloudflare
```

`npm run deploy:cloudflare` 会产生真实外部部署，只能在确认账号、资源、秘密和发布范围后人工执行。

## Project map

- `HANDOFF.md` — 当前状态、验证证据、风险和下一步
- `docs/PRODUCT.md` — 产品范围、核心路径、商业边界和非目标
- `docs/ARCHITECTURE.md` — 逻辑边界、状态归属和外部依赖
- `docs/ACCEPTANCE.md` — 可观察的 MVP 验收矩阵
- `docs/ROADMAP.md` — 产品开发与首批流量供给路线
- `docs/DECISIONS.md` — 已接受决策及其理由
- `docs/WORKFLOW.md` — 主任务、探索、实施与审核协作方式
- `docs/LICENSE_POLICY.md` — 许可证机器分流政策、来源版本和非法律边界
- `docs/IDENTITY_AND_ACCESS.md` — 编辑身份、角色、权限、会话目标和未实现边界
- `docs/PRODUCTION_PLATFORM.md` — 生产托管、PostgreSQL、GitHub OAuth 与迁移计划

## Current milestone

M2 — GitHub OAuth/PostgreSQL 身份适配器和 PostgreSQL 业务仓储已实现并失败关闭；Cloudflare OpenNext 构建与本地 Workers 预览已通过。下一步是人工创建 GitHub OAuth、Cloudflare Worker/Hyperdrive 和 Neon 资源，在预览环境应用迁移、先 dry-run 后人工执行 SQLite 导入，并验证真实登录、会话撤销和角色授权。在此完成前仍不设计批准或发布路径。
