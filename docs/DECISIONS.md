# Decision log

只记录会约束后续工作的决策，不作为每日活动日志。

| ID | Date | Decision | Reason | Consequences | Status |
|---|---|---|---|---|---|
| D-001 | 2026-08-02 | 使用 standard 编排式项目结构，不使用 federated | 当前是一个单仓库产品，但有多里程碑、外部依赖、状态归属和验收边界 | 主 Task 负责集成；Explorer/Reviewer 只读；未来出现真实多仓库边界再升级 | Accepted |
| D-002 | 2026-08-02 | VibeSource 定位为 AI 原生开源产品的发现和发布平台 | 核心价值是可信发现、流量与复用，而非普通软件目录 | 所有公开产品必须满足源码和体验资格 | Accepted |
| D-003 | 2026-08-02 | 自动检查不能替代人工发布审核 | 仓库公开、许可证、Demo 和宣传真实性都需要编辑判断 | 提交默认待审核；覆盖和发布操作必须审计 | Accepted |
| D-004 | 2026-08-02 | 所有关键指标显示来源、时间和验证状态 | 防止把缓存、自述或失败回退冒充实时事实 | 数据模型和 UI 必须支持 verified/self-reported/stale/error 等状态 | Accepted |
| D-005 | 2026-08-02 | 自然榜单与付费推广分离 | 可信机制不能被收入暗中改变 | 赞助位明确标注；赞助金额不进入自然排序 | Accepted |
| D-006 | 2026-08-02 | 前期人工筛选 50–100 个产品，并至少投入一半精力做供给与分发 | 平台壁垒来自流量和真实供给，不是目录页面本身 | 路线图同时验收软件能力与首发内容/用户结果 | Accepted |
| D-007 | 2026-08-02 | 付费、发布、外部消息、邮件发送和永久删除保持人工确认 | 这些操作产生费用、声誉或不可逆影响 | 不实现隐藏自动扣费、自动群发、自动发布或静默永久删除 | Accepted |
| D-008 | 2026-08-02 | 后续商业模式按轻量验证顺序推进 | 先证明自然发现价值，再增加商业复杂度 | 先赞助/首发服务，再代运营、开发者 SaaS 和复用市场 | Accepted |
| D-010 | 2026-08-02 | M1 使用 Next.js 16.2.12 App Router、React 19.2.8、TypeScript 5.9、Node 24、npm 11、ESLint 9 和 Vitest 4 | 该组合有当前长期支持基础、完整 Node 服务能力，并能以单仓库快速验证公开页面与服务端边界 | 使用 `package-lock.json`；保持供应商中立的 Node 部署形态；M1 不引入数据库、身份或外部服务 | Accepted |
| D-016 | 2026-08-03 | M2.1 采用默认关闭的本地候选提交与人工拒绝切片；使用 Node 24 内置 `node:sqlite` 文件、显式迁移、绝对路径和原子审计 | 在不伪造 GitHub/Demo/许可证证据、不提前决定生产数据库和身份方案的前提下，先验证服务端校验、持久化、幂等、状态转换和追加审计 | `VIBESOURCE_SUBMISSION_MODE` 默认 disabled；外部证据始终 `not_checked`；本地 token + 服务端 actor 只能带理由/版本拒绝；无 approve/publish/公开产品。`node:sqlite` 是同步 Stability 1.2 / RC，只允许本地单实例；D-015 保持 Open | Accepted |
| D-017 | 2026-08-03 | M2.2a 只允许本地编辑显式触发未认证的公开 GitHub 仓库请求；每次一次、无重试、追加保存成功或失败，并把最近尝试与最后可用快照分开 | 先验证真实来源、时点、限流与 stale/error 语义，同时避免 GitHub Token 扩大到私有仓库元数据和秘密管理 | 固定 `api.github.com` 与 API 版本 `2026-03-10`；默认 disabled；响应限 1 MiB、8 秒超时、不跟随重定向；GitHub Licensee 结果只叫“检测”，不是法律结论。D-014 的生产接入仍 Open；无 approve/publish | Accepted |
| D-018 | 2026-08-03 | M2.2b1 只允许本地编辑显式触发 Demo 响应头检查；不读取响应正文，不自动重试、跟随重定向、批准或发布 | Demo URL 是不可信输入，需要在证明真实时点可响应的同时控制 SSRF、DNS rebinding、重定向和内容摄入风险 | 仅 HTTPS；解析全部 A/AAAA 且任一非公网地址即拒绝；连接固定到已验证 IP 并保持原始 Host/TLS 身份；8 秒超时、16 KiB 响应头上限；成功/失败追加保存并派生 stale/error。许可证和生产身份仍 Open | Accepted |
| D-019 | 2026-08-03 | M2.2b2a 使用版本化 SPDX 3.28.0 OSI-approved 快照派生许可证人工复核建议，不自动给出法律结论或发布资格 | GitHub Licensee 只匹配部分 LICENSE 文件，不能覆盖依赖、双许可证、权利归属或法律有效性；但当前证据、OSI 标识和开发者声明一致性可以确定性检查 | 136 个未废弃 OSI-approved SPDX 标识及来源 SHA-256 入库；只有当前 GitHub 成功快照可进入策略；结果为 not_ready / needs_manual_review / ready_for_manual_review，始终保持 pending_review；生产身份仍 Open | Accepted |

## Open decisions

- D-009 — 对外品牌、首发语言和目标市场。
- D-011 — M2.2b2a 已接受本地机器分流政策；仓库转私有、许可证变化后的公开产品处理和法律复核流程仍 Open。
- D-012 — AI 参与分类字段及其核验方式。
- D-013 — 身份、投票资格、榜单公式、时区和反作弊。
- D-014 — GitHub、Newsletter、分析和后续支付供应商。
- D-015 — 数据库、迁移、后台任务、缓存、对象存储和生产托管供应商。

## Decision template

### D-XXX — Title

- Date:
- Status: Proposed / Accepted / Replaced
- Context:
- Decision:
- Alternatives considered:
- Consequences and follow-up:
