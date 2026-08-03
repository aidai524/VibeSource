# Architecture

> Status: M1 remains verified. M2.1 through M2.2b2b1 are implemented locally; current checks cover 95 tests, production build, real external responses, persistence, role authorization and browser rendering.

## Implemented M1 foundation

- Next.js 16.2.12 App Router and React 19.2.8.
- TypeScript 5.9 on Node.js 24 with npm 11 and `package-lock.json`.
- ESLint 9, Vitest 4, production build, static homepage and `/api/health` route.
- Provider-neutral Node server shape: it can run anywhere that supports the documented Node runtime; no production host has been selected or verified.
- No production database, identity provider, GitHub credential, email provider, analytics service or payment provider is connected.
- M1 stores no business data. Homepage status and qualification copy are reviewed static content in source, not simulated product records.

## 已实现的 M2 本地切片

- `VIBESOURCE_SUBMISSION_MODE` 默认为 `disabled`。只有显式启用 `local` 并配置绝对 `VIBESOURCE_DB_PATH` 时，候选 UI 和 API 才可用。
- 服务端校验 8 个字段：产品名、摘要、GitHub 仓库 URL、体验 URL、AI 参与说明、技术栈、许可证名称和复用说明。URL 形状校验不是外部核验。
- 有效候选记录与 `submitted` 审计事件以 `pending_review` 状态原子提交；幂等约束和“同仓库只有一条活跃待审记录”约束防止静默重复。
- 文件持久化使用 Node 24 内置同步 `node:sqlite`、显式 schema 迁移和调用方提供的绝对路径。该 API 是 Stability 1.2 / Release Candidate，因此当前仅限本地、单实例、非生产使用。
- 提交整体资格仍固定为 `not_checked`。M2.2a 另行保存 GitHub 证据：只有本地编辑明确点击才向固定公开 API 发起一次请求，不读取 GitHub Token、不自动重试或后台轮询。
- `github_evidence_attempts` 是 schema v2 追加表，保存来源、API 版本、观察时间、HTTP/限流、结构化仓库字段或明确错误；触发器禁止 update/delete。最近失败不覆盖最后成功快照，读取视图派生 `observed/stale/error/not_checked`。
- `demo_evidence_attempts` 是 schema v3 追加表。Demo 适配器解析全部地址并拒绝任何非公网结果，请求固定到已验证 IP，保持原 Host/TLS 身份，不跟随重定向，收到响应头后销毁响应且不读取正文；最近失败同样不覆盖最后成功快照。
- 许可证策略不新增可变状态：服务端从提交声明、当前 GitHub 成功快照和版本化 SPDX 3.28.0 OSI-approved 本地快照确定性派生三态建议。GitHub error/stale 不能通过；策略版本和来源随结果返回。
- 本地审核使用服务端配置的 token、actor 与角色。`editor`、`license_reviewer`、`admin` 的最小权限由应用确定，每个编辑 API 在服务端校验具体权限；无权操作不只是在 UI 隐藏，而是返回 403。唯一状态转换仍是 `pending_review -> rejected`。
- 当前不包含批准、发布、公开产品页、生产身份或许可证法律判断。
- 当前实现通过 lint、typecheck、95 个 Vitest 测试和 production build；证据见 `outputs/verification/M2-1/` 至 `M2-2b2b1/`。

## System context

### Actors

- Visitor：浏览榜单、分类和产品页，访问 Demo 与源码。
- Registered user：点赞、评论、订阅或管理自己的提交；身份方案待确认。
- Product developer：提交产品资料并查看审核状态。
- Editor/admin：核验源码、体验入口、许可证、宣传内容和付费标记，决定发布或下架。
- Main project Task：维护产品边界、实现集成和最终验收。

### System boundary

VibeSource 核心系统负责产品资料、审核状态、公开页面、社区互动、榜单快照、来源标记和运营操作记录。它不拥有 GitHub 仓库、第三方 Demo、邮件投递网络或支付清算结果。

### External boundaries

- GitHub：公开仓库、许可证和仓库指标的外部来源。
- Product Demo / deploy target：不可信外部链接，只能记录最近一次检查结果。
- Identity provider：目标为外部 OIDC/OAuth；具体供应商待确认，当前未接入。
- Newsletter provider：待确认。
- Analytics/observability：待确认。
- Payment provider：MVP 后的商业验证需要，待确认。
- Production hosting, database and storage：待确认。M2.1 的本地 SQLite 文件不是生产方案。

## Target M2+ runtime and data flow

M2.1 实现确定性提交和拒绝，后续切片实现 GitHub/Demo 时点证据、许可证分流和本地角色授权。生产身份适配器、批准和发布仍是目标行为。

1. 开发者提交产品资料、仓库、体验入口、AI 参与声明和复用信息。
2. 服务端校验输入，并从 GitHub 读取公开元数据；每次快照保存来源、时间、结果和错误，不允许客户端伪造“已验证”状态。
3. 应用保存提交版本和待审核状态。外部检查失败时保留原始输入与可重试错误，不自动发布。
4. 编辑人工审核，发布或拒绝操作记录操作者、时间和理由。
5. 公开页面只读取已发布版本，并分别显示平台数据、GitHub 快照、开发者自述和赞助信息。
6. 点赞和评论写入应用业务数据；身份、限频、幂等与治理规则在实现前确认。
7. 每日榜单从符合资格的已发布产品和有效互动计算，保存公式版本、时间窗口与结果快照。
8. Newsletter 由编辑人工选品与确认发送；订阅和退订必须可审计。
9. 后续付费服务先生成可见订单与费用确认，再交给支付供应商；自然榜单不读取赞助金额。

## Provisional module boundaries

这些是逻辑职责，不代表已经选择的部署单元。当前已实现 Public web 基础、本地候选/拒绝、证据适配器、许可证分流和角色授权契约。批准、发布及其他模块仍是目标边界。

| Module | Responsibility | Inputs | Outputs | Policy owner |
|---|---|---|---|---|
| Public web | 榜单、分类、产品详情、来源与状态展示 | 已发布产品和榜单快照 | 页面和外部跳转 | Product rules |
| Identity and access | 用户、开发者和编辑权限 | 登录身份、会话；当前仅 local-token QA | 带角色与权限的授权上下文 | Security policy |
| Product registry | 草稿、提交版本、必填资格和发布状态 | 开发者输入 | 可审核产品记录 | Application backend |
| GitHub evidence adapter | 获取并标准化仓库与许可证检测证据 | 已归一化仓库 URL；当前无凭证 | 带时间戳快照或明确错误 | Verification policy |
| License policy | 比较当前 GitHub 许可证检测、开发者声明和版本化 OSI-approved SPDX 快照 | 提交声明 + 当前 GitHub 快照 + 内置政策源 | 人工复核建议和具体理由 | Product/legal policy |
| Editorial review | 人工核验、发布、拒绝、下架和理由记录 | 提交与证据 | 审核事件、公开版本 | Editor/admin |
| Discovery and ranking | 分类、每日榜单和公式版本 | 已发布产品、有效互动 | 可复算的榜单快照 | Ranking policy |
| Community | 点赞、评论、举报和治理 | 授权用户操作 | 互动记录与计数 | Community policy |
| Distribution | Newsletter 订阅、选品和发送确认 | 同意记录、编辑选择 | 投递请求和结果 | Editor/admin |
| Commercial services | 赞助位、首发服务和后续订单 | 明示服务选择与费用确认 | 订单状态、赞助标记 | Human-approved policy |

## State ownership

M1 不保存业务状态。M2.1 保存候选与审核事件，M2.2a 追加保存 GitHub 尝试；两者都不包含公开产品状态。

| State | Source of truth | Cache or copy | Persistence | Recovery / failure rule |
|---|---|---|---|---|
| M2.1 候选提交与拒绝审计 | 本地 `node:sqlite` 文件 | 提交表单与本地审核页 | 显式迁移；绝对路径；单实例 | 提交/事件和拒绝/事件分别原子提交；失败不部分写入 |
| 批准、公开产品与生产审计 | 未来 VibeSource 生产业务数据库 | 管理端和公开页视图 | 必须持久化并有迁移、备份和恢复策略 | M2.1 没有此状态；删除优先归档 |
| M2.2a GitHub 仓库元数据 | GitHub at observed time | 带 `observed_at`、API 版本和来源的本地快照 | SQLite v2 追加尝试；生产保留期待确认 | 最近失败显示 stale/error，不覆盖旧成功、不写伪造值 |
| M2.2b1 Demo 可用性 | 受控请求在观察时点的响应头 | 带 `observed_at`、检查版本、HTTP、内容类型、固定 IP 与耗时的本地快照 | SQLite v3 追加尝试；生产保留策略待确认 | 最近失败显示 stale/error；一次成功不解释为持续可用 |
| M2.2b2a 许可证策略 | 版本化代码与政策源 | 审核 API/UI 的确定性派生视图 | Git 中的策略版本、SPDX 标识快照和 SHA-256；不另存派生结果 | 政策升级必须新版本；不改写历史 GitHub 证据 |
| M2.2b2b1 编辑授权 | 应用角色与权限映射 | 当前由服务端环境配置派生；未来由生产数据库持有 | 不保存本地会话；API 按操作授权 | external-oidc 无适配器即不可用；客户端不能选择 actor/role |
| AI 参与、技术栈和复用说明 | 开发者声明 + 编辑审核记录 | 公开产品版本 | 版本化保存 | 显示自述或核验状态 |
| 点赞、评论和举报 | VibeSource 业务数据库 | 聚合计数 | 必须持久化 | 幂等、限频、软删除和申诉待设计 |
| 每日榜单 | 公式版本 + 输入窗口的派生结果 | 公共缓存 | 保存每日快照 | 可按同版本重算；赞助金额不得进入自然榜 |
| Newsletter 同意状态 | 待确认：应用或邮件供应商之一必须被指定为唯一真相源 | 双向同步副本 | 保存订阅、退订和发送记录 | 冲突时默认不发送 |
| 订单和付款结果 | 支付供应商交易 + VibeSource 订单状态 | 管理端视图 | MVP 后持久化 | 幂等处理；未知状态不得标为已付款 |
| 验证证据与运营审计 | VibeSource 证据/事件记录 | 报告导出 | 保留期限待确认 | 不静默改写历史证据 |

## External dependencies and trust boundaries

| Dependency | Purpose | Credentials/data involved | Required failure behavior | Verified? |
|---|---|---|---|---|
| GitHub API | 仓库、许可证检测和指标证据 | M2.2a 仅未认证公开数据 | 手动重试；限流/失败可见，保留旧快照并标 stale | Partial — local real 200/404 and deterministic failures |
| Product URLs | Demo、部署和源码跳转 | 不可信 URL；M2.2b1 不摄入正文 | 全地址公网校验、固定 IP、HTTPS、禁重定向；失败不伪造可用 | Partial — local real 200/301/reserved-address paths |
| Identity provider | 登录与角色身份 | 账号标识、会话 | 登录失败不降级为管理员；最小权限 | No — external-oidc reserved but unavailable |
| Local SQLite | M2.1 候选提交与拒绝审计 | 开发/QA 候选数据 | 只允许绝对路径和单实例；配置缺失时失效关闭 | Partial — local automated, browser and restart checks only |
| Production database/storage | 公开业务真相和证据 | 用户与产品数据 | 备份、迁移、恢复和数据保留策略必须验证 | No |
| Newsletter provider | 订阅与投递 | 邮箱、同意和退订状态 | 未确认或同步冲突时不发送 | No |
| Analytics/observability | 真实流量和故障诊断 | 事件、可能的设备信息 | 最小采集并公开隐私规则；失败不阻塞核心浏览 | No |
| Payment provider | 后续付费服务 | 订单、支付状态，不保存原始卡数据 | 金额先确认、幂等、未知状态人工处理 | No |
| Hosting/CDN | 提供网站和后台服务 | 部署产物、配置和日志 | 本地 Node build/server 已验证；生产环境仍需验证回滚、健康检查和秘密隔离 | No — production not selected |

## Security and privacy

- 秘密只保存在服务端配置或秘密管理中，不进入源码、客户端包、日志、导出和生成文档。
- 所有仓库内容、Markdown、图片、URL、API 响应、评论和开发者声明均按不可信数据处理。
- M2.2a 只访问固定 `https://api.github.com/repos/{owner}/{repo}`，8 秒超时、1 MiB 响应上限且不跟随重定向。
- M2.2b1 Demo 请求只允许 HTTPS；解析并校验全部地址后固定连接到选定公网 IP，保持原域名 TLS 校验，不跟随重定向，8 秒超时、16 KiB 响应头上限且不读取正文。
- 渲染用户内容时防止 XSS；外链使用安全属性并避免可控开放重定向。
- GitHub 和其他供应商权限遵循最小范围；公开数据能满足时不索取写权限。
- 提交、投票、评论、登录和刷新任务需要限频、幂等、审计与反机器人策略。
- 本地编辑 token、actor 和 role 只存在服务端环境配置；请求不得覆盖它们，所有编辑 API 校验操作权限，所有变更必须同源。
- 生产目标是维护中的外部 OIDC/OAuth 库、数据库支持的不可伪造会话、IdP MFA 和应用自有角色映射；详细边界见 `docs/IDENTITY_AND_ACCESS.md`。
- 邮件只发送给有明确同意且未退订的地址。
- 隐私政策、数据保留、用户导出和删除流程待确认。

## Failure and truthfulness rules

- 外部请求失败时展示“失败、过期或未验证”，不得回退为看似真实的占位数据。
- 一个仓库转私有、许可证改变或 Demo 失效后，产品进入需复核状态；自动下架策略待确认。
- 后台任务必须可重试且幂等，并保留最后成功快照和最近错误。
- 管理员覆盖自动检查必须记录理由；不能修改外部来源的历史快照来“修复”展示。
- 尚未接入的支付、邮件、分析和发布功能必须禁用或明确标为开发中。
- 提交、身份或证据配置不完整时页面能力和 API 同时失效关闭；无权限操作不会显示，直接 API 调用仍返回 403。
- 不存在 approve/publish 端点或界面控件，`not_checked` 不能被解释为资格通过。

## Architecture risks

- GitHub 限流和数据语义变化导致指标不完整或过期。
- 榜单和互动被机器人、互刷或多账号操纵。
- 公开仓库并不自动代表许可证有效、代码安全或易于部署。
- Demo 检查可能产生 SSRF、安全扫描责任和误判风险。
- 运营人员审核量随提交增长，可能成为瓶颈。
- 邮件、分析和身份数据引入隐私及合规责任。
- 赞助业务若边界不清会破坏自然榜单可信度。
- `node:sqlite` 为同步 API 且当前是 Stability 1.2 / Release Candidate；多实例、无持久磁盘的托管或高并发均不在 M2.1 承诺内。

## Accepted runtime foundation

- Web：Next.js 16.2.12 App Router、React 19.2.8、TypeScript 5.9。
- Runtime：Node.js 24、npm 11、锁定依赖；本地 Node server 与生产构建已验证。
- Quality：ESLint 9、Vitest 4、Next type generation、TypeScript typecheck。
- M1 边界：不引入数据库、登录、队列或供应商 SDK，避免在业务真相源确定前制造临时状态。

## 已接受的 M2 本地边界

- 本地候选提交、`pending_review` 状态和追加审计是当前唯一业务真相。
- 本地 SQLite 只是可替换的单实例验证适配器，不决定 D-015 的生产数据库、对象存储或托管。
- 整体发布资格仍为 `not_checked`；GitHub 只是带时点的局部证据。本地编辑只能刷新证据或拒绝，不能批准或发布。
- GitHub 公开 API 使用 API 版本 `2026-03-10`，不使用 Token、自动刷新、隐式重定向或自动重试；生产接入仍由 D-014 决定。
- 编辑授权契约使用三种应用角色和四项最小权限；`external-oidc` 在真实适配器完成前始终不可用，本地 token 不是生产身份。

## Technology decisions still pending

- 生产数据库、队列/定时任务、缓存和对象存储；M2.1 的本地迁移不关闭这些决策。
- 生产 GitHub 身份、刷新频率、条件请求、后台任务和数据保留策略。
- 外部 OIDC 供应商、数据库会话实现、账号生命周期、角色管理与普通用户反作弊方案。
- 托管区域、CDN、监控、备份和恢复目标。
- Newsletter、分析与后续支付供应商及预算。
