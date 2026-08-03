# Roadmap

路线图同时推进“可信产品闭环”和“真实供给/流量”。前期不能把全部精力投入网站开发。

| Milestone | Independently observable outcome | Dependencies | Acceptance IDs | Status |
|---|---|---|---|---|
| M0 — 产品与可信机制基线 | 产品边界、非目标、数据真相源、人工控制和验收条件明确；待定政策有清单 | None | 文档确认 | Completed |
| M1 — 可运行基础 | 技术栈与托管约束已决定；Git 仓库、安装/启动/测试命令和空状态应用在干净本地环境通过 | M0 | A-001 | Completed / Verified |
| M2 — 可信提交与人工审核 | 开发者提交、GitHub/Demo 证据、错误状态、审核审计和发布资格形成真实纵向闭环 | M1 | A-101–A-105, A-109, A-111 | In progress — M2.1 + M2.2a + M2.2b1 implemented |
| M3 — 发现与社区 | 分类、每日榜单、点赞和评论在明确身份、排序和反作弊规则下可用 | M2 | A-106, A-107 | Planned |
| M4 — 首发供给与分发 | 50–100 个真实产品完成核验；Newsletter 明示订阅、退订和人工发送可验证 | M2 | A-108, A-112 | Planned |
| M5 — 首个商业验证 | 在自然发现成立后，小规模验证一个透明赞助/首发服务，费用和标记全程可见 | M3, M4 | A-110 | Planned |
| M6 — 开发者增长工具与复用市场 | 基于真实需求再评估分析、反馈、候补名单、邮件工具、部署和定制交易 | M5 evidence | 待确认 | Future |

## Remaining product and platform decisions

- 确认工作名、首发语言和目标市场。
- 确认合格开源许可证范围和 AI 参与分类。
- 确认生产数据库、迁移与托管方案；M1 的供应商中立 Node server 和 M2.1 的本地 `node:sqlite` 都不等于生产方案已选定或验证。
- 确认身份、GitHub、Newsletter、分析与后续支付供应商。
- 确认每日榜单时区、时间窗口、投票资格和反作弊原则。

## Early execution split

- 约一半精力：平台实现、数据可信、失败路径和运营工具。
- 至少一半精力：寻找产品、逐项核验、采访开发者、制作内容、Newsletter 和社交分发。

该比例是经营约束，不要求每个短周期机械地精确到 50/50；但任何连续里程碑都不能只增加功能而没有真实供给或用户验证。

## M2 slices

- **M2.1 — 本地候选与拒绝审计（Implemented, locally verified）**：默认失效关闭；8 项服务端校验资料原子写入 `pending_review` 和 `submitted` 事件；本地编辑只能带 actor、理由和版本拒绝。当前 lint、typecheck、41 个自动化测试、production build、隔离浏览器闭环和重启持久化均已通过；这仍不是生产能力。
- **M2.2a — 本地 GitHub 时点证据（Implemented, locally verified）**：显式一次请求公开 GitHub API；追加保存来源、版本、时间、指标、许可证检测、限流和失败；最后成功快照与最近失败分离。真实 200/404、持久化和模拟限流/stale 已验证；无 Token、自动抓取或发布资格。
- **M2.2b1 — 本地 Demo 响应头证据（Implemented, locally verified）**：显式一次固定公网 IP 的 HTTPS GET；禁止重定向并在响应头后停止；追加保存成功/失败和 stale 语义。真实 200、保留地址拒绝、301 拦截和持久化已验证。
- **M2.2b2a — 许可证机器分流政策（Implemented, locally verified）**：版本化 SPDX 3.28.0 OSI-approved 快照；将当前 GitHub 证据、SPDX 标识和开发者声明派生为未就绪/需人工判断/可进入人工复核，不产生法律或发布结论。
- **M2.2b2b — 生产身份与权限（Next）**：选择生产编辑身份、角色和会话边界；决定生产 GitHub 身份/限流方案。在此之前不实现 approve/publish。
- **M2 exit**：只有在可追溯外部证据、人工批准、公开产品和失败恢复完成后，才能把 M2 标为 Completed。

## Sequencing rules

- M2 先验证本地候选提交与人工拒绝审计，再接入真实外部证据和生产身份；两者完成前不增加批准/发布、大量页面或高级推荐。
- M3 的自然榜单先稳定，再引入 M5 的赞助服务。
- 未满足发布资格的产品不能为了填满目录而使用假数据或降低标识标准。
- 不因后续市场设想提前拆成多个仓库或部署系统。
