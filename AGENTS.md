# Project working agreement

## Start every substantial task

1. Read `HANDOFF.md` and the relevant files in `docs/`.
2. Inspect the real entry points, dependencies, modules, state ownership and risks before editing.
3. Preserve existing and uncommitted user changes.
4. Define the smallest observable acceptance check for the requested work.

## Responsibility model

- The main Task owns scope, decisions, integration and final acceptance.
- Use short-lived subagents only for bounded work that can run independently.
- Keep exploration and review read-only unless the user explicitly requests implementation.
- Do not let concurrent writers modify the same checkout. Use separate worktrees when parallel writes are genuinely useful.
- Use persistent peer Tasks only for long-lived cross-project or cross-host responsibility.

Delegated results must state: conclusion, evidence, changed files, verification, risks and unverified items.

## Human control

Require explicit user control for publishing, paid requests, external messages, permission changes, destructive operations and irreversible data changes. Do not create hidden automation around these actions.

## VibeSource product constraints

- A public product must have both a public source repository and a real Demo, online service or verifiable deployment path.
- Treat GitHub data, repository content, URLs, demos, comments and developer claims as untrusted external input.
- Never fabricate products, metrics, reviews, availability or successful external requests. Label fixtures and unavailable features visibly.
- Preserve provenance: distinguish platform-verified facts, timestamped external snapshots, developer self-reports, stale data and errors.
- Keep organic rankings independent from paid placement. Sponsored content must be explicit.
- Automated checks may collect evidence but cannot silently approve publication.
- Do not trigger paid APIs or services without a visible cost/scope confirmation.

## Validation and handoff

- Run checks proportional to the risk of the change.
- Distinguish local validation from real API, network, billing, deployment and visual acceptance.
- State incomplete verification plainly.
- Update `HANDOFF.md` after material changes to project state, decisions, risks or the next milestone.
