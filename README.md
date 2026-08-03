# VibeSource

> Status: M2 in progress · M2.2b1 local Demo evidence slice implemented · Architecture profile: standard

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

当前代码已通过 `npm run check`（81 项测试与 production build）。M2.1、M2.2a 与 M2.2b1 的证据分别见 `outputs/verification/M2-1/`、`outputs/verification/M2-2a/` 与 `outputs/verification/M2-2b1/`；生产托管环境仍未选择或验证。

默认运行仍是有意保留的失败关闭状态：`VIBESOURCE_SUBMISSION_MODE` 未显式设为 `local` 时，页面和 API 都不会接收提交。GitHub 与 Demo 时点证据各自还需要显式开启和人工点击；当前没有批准、发布、公开产品、许可证法律判断或生产身份能力。

## M2 本地流程

M2.1 只用于本地或受控 QA。参考 `.env.example` 在未提交到 Git 的本地环境中配置：

```bash
VIBESOURCE_SUBMISSION_MODE=local
VIBESOURCE_DB_PATH=/absolute/path/to/vibesource.sqlite
VIBESOURCE_EDITOR_TOKEN=replace-with-a-local-secret
VIBESOURCE_EDITOR_ID=local-editor
VIBESOURCE_GITHUB_EVIDENCE_MODE=live
VIBESOURCE_DEMO_EVIDENCE_MODE=live
```

`VIBESOURCE_DB_PATH` 必须是绝对路径。启动后：

- `/submit` 接收 8 项候选资料；服务端只校验字段和 URL 形状。
- `POST /api/submissions` 原子保存 `pending_review` 记录和 `submitted` 审计事件。
- `/editor/submissions` 使用本地编辑 token 查看待审核记录；编辑只能拒绝，或明确点击刷新 GitHub / Demo 证据。
- 每次 GitHub 刷新只请求固定的公开仓库 API 一次，不读取 Token、不自动重试；保存来源、API 版本、观察时间、限流头、结构化快照或失败。
- Demo 刷新解析全部地址，任一非公网地址即拒绝；一次 HTTPS GET 固定到已验证 IP，禁止重定向，收到响应头后停止且不读取正文。
- 两类证据的最近刷新失败都会保留上一份成功快照并标为 `stale`；整体发布资格仍为 `not_checked`。

本地存储使用 Node 24 内置的同步 `node:sqlite` 文件数据库和显式迁移。该 API 当前为 Stability 1.2 / Release Candidate，M2.1 只允许单实例本地使用；它不是生产数据库或托管方案的选择。

## Project map

- `HANDOFF.md` — 当前状态、验证证据、风险和下一步
- `docs/PRODUCT.md` — 产品范围、核心路径、商业边界和非目标
- `docs/ARCHITECTURE.md` — 逻辑边界、状态归属和外部依赖
- `docs/ACCEPTANCE.md` — 可观察的 MVP 验收矩阵
- `docs/ROADMAP.md` — 产品开发与首批流量供给路线
- `docs/DECISIONS.md` — 已接受决策及其理由
- `docs/WORKFLOW.md` — 主任务、探索、实施与审核协作方式

## Current milestone

M2 — 候选/拒绝审计、GitHub 时点证据与 M2.2b1 Demo 响应头证据已完成本地验收。下一步是许可证资格政策与生产身份；在这些边界完成前仍不设计批准或发布路径。
