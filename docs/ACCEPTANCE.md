# Acceptance

## Completion rule

里程碑只有在可观察结果通过约定检查并保存证据后才算完成。生成代码、通过语法检查或显示静态页面都不能单独证明产品闭环可用。

所有证据计划保存到 `outputs/verification/<acceptance-id>/`；目录不存在不代表检查已运行。

## MVP acceptance matrix

| ID | User-visible outcome | Observable check | Planned evidence | Status |
|---|---|---|---|---|
| A-001 | 新贡献者可以启动项目 | 在干净本地环境按 README 的真实命令完成安装、启动和测试；空状态首页与健康检查可访问 | `outputs/verification/A-001/`：干净副本记录、测试/构建结果、健康响应和桌面/移动截图 | Verified |
| A-101 | 开发者能提交合格产品 | 提交公开仓库、体验入口、AI 说明和复用信息后，产生唯一待审核记录和明确状态 | `outputs/verification/M2-1/`：自动化、浏览器提交、API/数据库与重启证据 | Partially verified — local candidate only |
| A-102 | 不合格产品不会误发布 | 私有/不可达仓库、缺少体验路径或必填信息时显示具体原因，公开目录中不存在该产品 | M2.1–M2.2b2a：字段/外部失败、许可证不一致理由和无发布路径；生产身份/批准待补 | Partially verified — local evidence and policy only |
| A-103 | GitHub 数据可追溯 | 产品记录包含来源、抓取时间、成功/失败状态；模拟限流后旧数据标 stale 而非伪装成最新 | `outputs/verification/M2-2a/`：真实 200/404、限流 fixture、追加存储与 stale 断言 | Partially verified — local manual refresh |
| A-104 | 发布保持人工控制 | 自动检查通过后仍为待审核；只有授权编辑确认才能发布，拒绝/覆盖含操作者、时间和理由 | `outputs/verification/M2-1/`、`M2-2b2b1/`、`M2-2b2b2a/`：actor、角色、401/403/503、原子拒绝与浏览器审计；真实 OAuth/批准待验证 | Partially verified — adapter and local reject only |
| A-105 | 产品页支持体验、验证和复用判断 | 已发布页显示 Demo/部署入口、源码、AI 参与、技术栈、许可证、二开说明和每项验证状态 | 浏览器断言、截图 | Not run |
| A-106 | 分类与每日榜单可解释 | 只包含符合资格的已发布产品；给定同一公式版本和输入窗口可复算相同结果；赞助金额不影响自然顺序 | 排名测试、快照、公式版本 | Not run |
| A-107 | 社区互动一致且可治理 | 授权用户只能产生一条有效点赞状态，取消后计数恢复；评论可举报/治理且刷新后数据一致 | 并发/幂等测试、浏览器流程 | Not run |
| A-108 | Newsletter 尊重同意 | 明示订阅后才可进入收件人集合；退订立即阻止后续发送；真正发送前需要编辑确认 | 同意记录、供应商测试环境证据 | Not run |
| A-109 | 指标不会冒充已验证事实 | GitHub 指标显示来源和时间；用户量/收入等显示自述、证据或未验证，缺失时不生成假值 | `outputs/verification/M2-2a/`：真实 GitHub 指标、来源/时间/限流与失败展示；其他指标待补 | Partially verified — GitHub only |
| A-110 | 付费推广透明且受控 | 服务范围和金额在请求前显示并确认；赞助位明确标识，支付失败不显示已付款，也不改变自然榜单 | 支付测试环境、UI/排名断言 | Not run |
| A-111 | 外部失败可见且可恢复 | GitHub、Demo、邮件或后台刷新失败不会破坏既有公开记录；用户/编辑看到错误并能安全重试 | `outputs/verification/M2-2a/` 与 `M2-2b1/`：结构化失败、stale 保留与重新刷新 | Partially verified — local GitHub and Demo adapters |
| A-112 | 首发目录有真实供给 | 上线前存在 50–100 个逐项人工检查的真实产品，每个都有仓库、体验路径、许可证状态和审核记录 | 首发清单、抽样复核记录 | Not run |

## M2.1 验证边界

- 已实现范围：失效关闭的本地候选提交、确定性服务端校验、SQLite 迁移/文件持久化、原子 `pending_review` + `submitted` 审计，以及带 actor/理由/版本/审计的受权本地拒绝。
- 当前证据：`npm run check` 通过，包括 lint、typecheck、6 个文件中的 41 个 Vitest 测试和 production build。
- 浏览器与持久化证据：默认关闭返回 503；隔离 fixture 完成“提交 → 审核 → 拒绝”；重启后仍为 rejected/version 2/not_checked 且两条审计完整；390×844 与 1280px 无横向溢出，控制台无 warning/error。详见 `outputs/verification/M2-1/`。
- A-101 仍为部分验证，因为语法有效的候选记录尚未被外部证明为合格产品。
- A-102 仍为部分验证，因为只覆盖缺失/非法字段，不检查私有或不可达仓库与体验。
- A-104 仍为部分验证：本地 token 已验证按角色读取、刷新和拒绝的服务端授权，但生产身份、数据库会话、批准和发布均不存在。
- A-109 仍为部分验证，因为 M2.1 虽真实返回 `not_checked`，但尚未读取或展示真实外部指标。
- 在 M2.1 证据快照中，A-103、A-105 和 A-111 尚未运行；下方 M2.2a 已把 A-103/A-111 推进为局部验证，A-105 仍未运行。
- 即使待补的 M2.1 证据完成，也不能把上述四项升级为 Verified；未满足的外部/生产条款必须继续明示。

## M2.2a 验证边界

- 已实现范围：本地编辑显式触发公开 GitHub 仓库请求；SQLite v2 追加保存每次尝试；成功显示时点指标和许可证检测，失败显示 error，旧成功后失败显示 stale。
- 当前证据：`npm run check` 通过，包括 7 个文件中的 53 个测试和 production build；真实 `octocat/Hello-World` 返回 200 并持久显示来源/时间/限流，虚构仓库返回 404 且没有快照。
- 限流、超时、网络失败、错误响应、单次无重试和成功后失败保留旧快照由确定性测试覆盖。
- A-103、A-109 和 A-111 仅部分验证：没有生产身份、后台刷新、Demo 证据、公开产品或生产数据保留策略。
- GitHub 的许可证字段只表示 GitHub Licensee 检测到已知许可证文件，不是法律有效性或产品可复用资格判断。

## M2.2b1 验证边界

- 已实现范围：本地编辑显式触发一次 Demo HTTPS GET；解析全部地址并拒绝任何非公网结果，固定请求 IP，禁止重定向，收到响应头后停止且不读取正文。
- 当前证据：`npm run check` 通过，包括 8 个文件中的 81 个测试和 production build。隔离浏览器中 `https://1.1.1.1/cdn-cgi/trace` 返回 HTTP 200；`example.com` 在当前 QA 网络解析到保留网段而被拒绝；`https://1.1.1.1/` 的 301 被明确拦截。
- 浏览器刷新后 200 快照仍存在，整体状态仍为 `not_checked`，页面无横向溢出且无 console warning/error。确定性测试覆盖 timeout/TLS/network/DNS、混合安全/非安全地址、追加约束和 stale 保留。
- A-102 与 A-111 仍为部分验证：这是本地手动时点证据，不证明持续可用、页面内容安全、部署成功、生产网络控制、公开产品或生产保留策略。

## M2.2b2a 验证边界

- 已实现范围：提交内置 SPDX 3.28.0 中 136 个未废弃 OSI-approved 标识及来源 SHA-256；服务端从开发者声明和当前 GitHub 成功快照派生 `not_ready / needs_manual_review / ready_for_manual_review`。
- 当前证据：`npm run check` 通过，包括 9 个文件中的 89 个测试和 production build；显式来源校验脚本复算快照版本、SHA-256 和标识集合。
- 隔离浏览器中，`vercel/next.js` 的 MIT 当前证据与 MIT 声明一致，策略在同一次刷新后显示“可进入人工复核”；`facebook/react` 的 301 失效关闭；`lodash/lodash` 的 `NOASSERTION` 与 Apache 声明显示具体人工复核理由。刷新后结果可重复派生，整体仍未核验。
- 该切片不验证法律有效性、双许可证、依赖兼容、权利归属、公开产品或生产身份；“可进入人工复核”绝不等于批准或可发布。

## M2.2b2b1 验证边界

- 已实现范围：定义 `editor`、`license_reviewer`、`admin` 及读取候选、拒绝候选、刷新证据、许可证复核四项应用权限；每个编辑 API 在服务端要求具体权限。
- 当前证据：`npm run check` 通过，包括 10 个文件中的 95 个测试和 production build。隔离浏览器中 `license_reviewer` 可读取候选并刷新证据，但不显示拒绝表单；携带有效 token 直接调用拒绝 API 返回 403，候选仍为 `pending_review`。
- `external-oidc` 配置被识别但保持不可用；本地 token、actor 和 role 只用于受控 QA，不证明生产登录、会话、MFA、撤销、角色管理或审计持久化。
- 当前没有批准、发布或许可证法律结论操作；`license:review` 权限只保留责任边界，不生成假功能。

## M2.2b2b2a 验证边界

- 已实现范围：Better Auth 1.6.25 + GitHub OAuth handler、PostgreSQL 数据库 session、固定八小时无滑动刷新、OAuth token 加密、state 入库、账号关联关闭、数据库限流和应用自有角色授权表。
- 当前证据：`npm run check` 通过，包括 12 个文件中的 103 个 Vitest 测试、PGlite/PostgreSQL 17 WASM 迁移验证、Next production build 和 Cloudflare OpenNext build；自动化覆盖配置失效关闭、Hyperdrive URL 注入优先级、外部 principal、未分配角色 403、权限 403、基础设施异常 503、auth route 默认 503，以及迁移幂等、表/索引和角色授权数据库约束。
- 隔离浏览器中，本地 token 模式仍载入 `editor · 0 条`；外部模式显示 GitHub 登录和“登录不等于授权”说明，未登录明确返回 401；两种模式 1280px 无横向溢出。
- Cloudflare 本地预览：首页和健康接口返回 200；未配置 auth/session 与提交接口返回明确 503。未验证真实 GitHub callback/private-email、Hyperdrive/Neon 上的 migration/session/revocation、Cloudflare secrets/远端 runtime、备份恢复和业务数据迁移。PGlite 和本地 Wrangler 都不能替代真实预览环境验收。

## Release blockers

以下任一情况存在时，不得声称 MVP 可上线：

- 公开产品没有可访问源码或可体验/可部署路径。
- 未经人工批准的提交进入公开目录。
- 自述或过期数据被展示为平台已核验的实时事实。
- 赞助内容未标注，或赞助金额影响自然榜单。
- 未经同意发送邮件、未经确认发起付费请求或执行永久删除。
- 秘密进入源码、客户端包、日志或交付物。
- 关键失败路径只显示成功假状态，或数据损坏后无法解释。
- 把 M2.1 的本地 token 或 SQLite 文件宣称为生产身份或生产数据库。
- 在生产身份、许可证人工复核流程和批准审计仍未完成时增加批准、发布或公开产品路径。

## Guardrails

| Area | Must remain true | Check |
|---|---|---|
| Existing data | 无无法解释的丢失或不兼容改写 | 迁移前后计数与关键记录对比、恢复演练 |
| Eligibility | 公开产品同时满足源码和体验要求 | 发布策略测试、人工抽样 |
| External effects | 发布、付款、邮件、外部消息和永久删除保持用户/编辑确认 | 权限与端到端流程 |
| Sponsored content | 赞助位明确标注并与自然榜单分离 | UI、查询与排序测试 |
| Secrets | 秘密不进入源码、日志和交付物 | secret scan、定向审阅 |
| External data | 来源、时间和验证状态始终可见 | 数据契约和组件测试 |
| Failure UX | 错误可见、可恢复，不使用假成功 | 故障注入和重试测试 |
| Abuse | 点赞、评论和提交具有限频、幂等和审计 | 并发与滥用场景测试 |
| Accessibility | 核心路径可使用键盘并有可读错误状态 | 自动检查 + 人工键盘检查 |

## Verification vocabulary

- **Verified**：所述检查已在所述环境成功运行，并有证据。
- **Partially verified**：只通过较窄的代理检查；必须写清剩余边界。
- **Not verified**：尚未运行适用检查。
- **Self-reported**：数据来自开发者声明，平台没有独立确认。
- **Stale**：曾成功读取，但刷新窗口已过或最近刷新失败。
