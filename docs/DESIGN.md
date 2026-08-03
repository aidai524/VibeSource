# VibeSource interface design system

## Accepted concept

- Desktop: `outputs/design/vibesource-home-desktop-concept.png`
  - Native concept size: 1487 × 1058
  - Implementation comparison viewport: 1440 × 1024
- Mobile: `outputs/design/vibesource-home-mobile-concept.png`
  - Native concept size: 852 × 1846
  - Implementation comparison viewport: 390 × 844
- Standalone brand mark: `public/assets/vibesource-mark.png`

The first generated desktop draft was rejected because it invented timestamps, live pipeline statuses and a verified count. The accepted revision removes every pseudo-live value. Implementation must not restore them.

## Visual direction

VibeSource looks like an open-source evidence desk: editorial, precise and direct. It uses a true-white canvas, near-black typography, electric chartreuse for qualification evidence and restrained cobalt for navigational links.

- Theme: open-source evidence editorial
- Background: true white, never cream or warm gray
- Density: low to medium with generous whitespace
- Container model: open grid, bordered bands and evidence rails
- Geometry: mostly square; 8–12px radii only on interactive or empty-state frames
- Motion: one restrained scan-line or focus transition; disabled under reduced motion
- Avoid: card grids, bento layouts, gradients, glow, glass, fake dashboards, fake data and decorative badges

## Design tokens

| Token | Value | Use |
|---|---|---|
| `--background` | `#ffffff` | Page and surfaces |
| `--ink` | `#0a0a0a` | Primary type and strong borders |
| `--muted` | `#5b5b5b` | Supporting copy |
| `--line` | `#d9d9d9` | Dividers and quiet outlines |
| `--accent` | `#c8ff00` | Qualification nodes and primary mobile action |
| `--accent-strong` | `#78d500` | Fine evidence lines on white |
| `--link` | `#134bff` | Secondary action and focus |
| `--max-width` | `1488px` | Desktop content |
| `--header-height` | `82px` | Desktop header |

## Typography

- Display and UI: `Arial Black`, `Arial`, `Helvetica Neue`, `PingFang SC`, system sans-serif.
- Metadata: `ui-monospace`, `SFMono-Regular`, `Menlo`, `Consolas`, monospace.
- Desktop hero: approximately 72–82px, 0.98 line-height, heavy weight.
- Mobile hero: approximately 48–54px, 1.08 line-height, heavy weight.
- Body: 18–22px desktop and 17–20px mobile.
- Control text is explicitly sized; do not inherit browser defaults.

## Allowed first-viewport copy

No visible copy may be added above the first fold without updating this file.

- Brand: `VibeSource`
- Navigation: `发现`, `收录标准`, `关于`
- Main heading: `发现真正能看源码、能运行、能复用的 AI 产品`
- Supporting copy: `每一个产品都公开源代码，并提供真实体验或部署路径。我们正在人工核验首批 50–100 个项目。`
- Primary action: `查看收录标准`
- Secondary action: `为什么先做人工审核`
- Static rail heading: `核验标准`
- Qualification labels: `公开源码`, `真实体验`, `来源可追溯`
- Empty-state heading: `首批目录正在核验中`
- Empty-state copy: `公开源码、真实体验、许可证与数据来源，缺一不可。`
- Availability status: `提交入口将在审核闭环上线后开放`

## Component families

- `Brand`: generated V/s mark plus code-native wordmark.
- `SiteHeader`: desktop nav; compact mobile qualification action and working menu.
- `ActionLink`: solid cobalt, outline cobalt and chartreuse mobile variants.
- `CriteriaRail`: static connected evidence nodes; never a live progress meter.
- `QualificationSteps`: code, run and provenance requirements with matching custom SVG icons.
- `EmptyCatalogState`: honest availability frame with no fake product rows or counts.

## Responsive behavior

- Desktop uses a two-column hero and a horizontal qualification sequence.
- Below 860px, the header collapses, the hero stacks, the desktop evidence rail is removed and qualification steps become a vertical connected sequence.
- Primary actions have at least a 44px touch target.
- Mobile content uses 20–24px gutters and must not horizontally scroll at 390px.

## Icon inventory

- Arrow right: 2px square-cap custom SVG.
- Menu: three 2px horizontal strokes with accessible expanded state.
- Code: angle brackets plus slash, 2px stroke.
- Run: outlined play triangle, 2px stroke.
- Provenance: simple database cylinder, 2px stroke.
- Availability: clock/lock treatment, 2px stroke.
- Qualification nodes: square on desktop rail, circular check on mobile sequence.

## Truthfulness constraints

- The criteria rail is a static eligibility explanation, not a process status.
- Do not show timestamps, counts, GitHub statistics, product names or completion states until backed by real persisted data.
- Unavailable submission remains visibly unavailable and is not an active button.
- The page may link to its own explanatory sections; it must not imply that external services, authentication or publishing work.
