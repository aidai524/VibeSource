# Agent workflow

## Default topology

```text
User
└── Main Task — scope, decisions, integration, acceptance
    ├── Explorer — read-only evidence gathering
    ├── Worker — bounded implementation when delegation is useful
    └── Reviewer — independent read-only review
```

## Milestone loop

```text
inspect → define acceptance → implement → verify → independent review → targeted correction → update HANDOFF
```

## Delegation gate

Delegate only when the subtask:

1. has a concrete, bounded output;
2. can run independently alongside useful local work;
3. has an objective verification method;
4. does not create an unsafe concurrent-write conflict.

Use a worktree when multiple agents must write to the same repository concurrently. Keep work in the main Task when it is small, sequential or tightly coupled.

## Required delegated report

```text
Conclusion:
Evidence:
Changed files:
Verification:
Risks:
Unverified items:
Recommended next step:
```

## Review discipline

The Reviewer checks the artifact against `docs/ACCEPTANCE.md` and project evidence. It reports findings; it does not silently change the implementation unless explicitly reassigned as a Worker.

## VibeSource evidence checklist

Before accepting a product-facing milestone, the main Task confirms:

1. the result uses a real public repository and real experience/deployment path, or any fixture is plainly labeled;
2. external values include provenance, observation time and failure state;
3. pending or rejected submissions cannot leak into public discovery;
4. publishing, paid requests, Newsletter sends and irreversible deletion still require human confirmation;
5. sponsored placement is visibly separate from the organic ranking;
6. local tests are not presented as proof of live GitHub, email, payment, deployment or traffic behavior;
7. evidence is saved under the applicable `outputs/verification/<acceptance-id>/` path before status becomes Verified.
