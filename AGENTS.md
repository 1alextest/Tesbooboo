# Tesbo repository agent entrypoint

Work only in `1alextest/Tesbooboo`; `development` is the integration branch and `main` is release-only. Use a feature branch and a draft PR into `development`; do not merge, deploy or weaken CI without the owner's explicit authority. Each PR explains Purpose, Impact, reuse/source evidence, tests actually run, limitations and rollback.

## Canonical design and session context

Read `docs/qa-orchestration/00_README.md`, the same eight numbered specifications through `07_UI_DESIGN_TASKS.md`, and the single `docs/qa-orchestration/Tesbo_Existing_Application_Baseline_v1.0.md` before related work. Follow `06_IMPLEMENTATION_AGENT_BRIEF.md` and its session product-distillation contract. The separate PR extension under `docs/qa-orchestration/extensions/` retains its own scope and EXT-* IDs. On a feature branch these are proposed changes, not proof of merge, implementation or product acceptance. Preserve existing `CLAUDE.md` and module-specific instructions; resolve material conflicts explicitly.

## Session product distillation

Capture meaningful friction, corrections, workarounds, missing capabilities and successful reusable practices with exact source/permission/version references. At milestones/handoff, classify observations, inspect existing functionality/specs/candidates, and update the same Product Discovery Register. Link repeated observations rather than duplicating features. Propose testable amendments with alternatives, impact and uncertainties. Preserve historical decisions and allow a truthful no-new-discovery outcome. Retrospective review uses only authorized accessible sources and records coverage gaps and processed revisions.

Automatic drafting is not approval. Principles, approved specifications, official cases/results/bugs, baseline/mask changes, test retirement, implementation and deployment keep their separate human/authorized gates. Agent agreement is not evidence. Reuse existing services and components; do not create a second authoritative case, evidence, session, knowledge, approval or PR store.

## Product destination

The five directions are bounded autonomous exploration, governed telemetry-driven suite optimization, synthetic fixtures and optional authorized environments, correlated visual/functional/measured-performance evidence, and explainable pre-merge risk/testing. Follow FR-106–110 and T-448–453; do not interpret them as an order to implement everything now. A fixture is not execution evidence, a screenshot is not measured latency, and unvalidated model confidence is not a defect probability. Scope, budgets, provenance, cancellation/cleanup and exact revisions are mandatory.
