# Tesbo Model Studio MBT-001 — assurance review and original findings
**Date:** 2026-11-15
**Target:** the proposed MBT-001 extension in the existing docs/FEATURE_DOCUMENTATION.md
**Review process:** one-analyst source-informed application of 11 established team lenses; initial pass, specification amendment, second pass; NOT independent team executions
**White verdict:** NOT FROZEN; MBT implementation and deployed behavior NOT CERTIFIED

## Evidence and current repository truth

- Tesbo PR #88 was merged into development at 2026-11-15T10:29:37Z. Final PR head: 19d326702d27d7e6eac483617a44805f14419e5c; merge commit: 7fdd4ba1c81914767f8b98dcd3f589011b5cb08b. Earlier user report said PR open at 224227a; that was historical, not current. GitHub reports nine completed successful workflow groups for the final PR HEAD, not for every future development commit, merge or deployment.
- Code inspection of GraphReviewRunLinks and Zyra ReviewCaseRunSetup on merged development confirms persisted receipt/canonical case/run links and read-only execution/evidence metadata fields, with warnings that older or undated execution does not verify a new change. This is source-inspected behavior (C1), not an independent full audit or actual deployed user evidence (C3).
- MBT expected model, transition semantics, guard/oracle validation and path-generation engine do not exist as accepted Tesbo implementations. These are design proposals, not confirmed features.
- The authoritative Tesbo specification is the existing eight-file package, most recent indexed version 1.4.21. Its raw original ZIP could not be materialized for byte-preserving edits. This amendment is NOT a ninth authoritative spec; full eight-file reconciliation remains blocked.
- Research-only libraries: https://graphwalker.github.io/graphwalker-rs/ and https://fast-check.dev/docs/advanced/model-based-testing/. GraphWalker offers graph path generation and stop conditions; fast-check offers commands/modelRun/asyncModelRun/scheduledModelRun and seed/path/replay. No dependency install, license decision or benchmark occurred. fast-check warns against models that simply mirror implementation; GraphWalker guards/actions must not become an untrusted script-execution path.

## Evidence grading contract — required for EVERY team and future app

C0 AUTHOR-REPORTED: feature claims in PR body or prose.
C1 SOURCE-VERIFIED: exact code file/function at pinned SHA, all relevant paths inspected; not live.
C2 CI-EXECUTED: named completed runs, actual run SHA, scope and skipped tests; green prior SHA cannot bless latest.
C3 DEPLOYED-OBSERVED: authenticated user, actual target build/schema, steps, original evidence and result.
C4 INDEPENDENT-ASSURED: isolated blind reviewer original traces plus seeded bad/good controls, false-positive adjudication, reproduced outcome.

Changes to PR state and HEAD must be rechecked on each run. Merge is not deployment. AI-authored outputs, graph links and execution metadata do not themselves imply expected behavior or approval.

## First-pass role findings, changes and second-pass outcome

| Team lens | Original challenge or missing capability | Spec correction applied in MBT-001 | Second-pass result |
|---|---|---|---|
| Blue / archaeology | Existing graph captures, Zyra and native cases/runs/evidence might be duplicated by MBT engine | MBT-001-A/C explicitly retain canonical owners, project-scoped PostgreSQL expected-model revisions, graph as read projection | SPEC IMPROVED; architecture implementation untested |
| Red / premises | Could code-behavior observations be recycled as model oracles and certify a defect as correct? | Independent expected oracle and injected forbidden-operation contradiction acceptance test | BLOCKED until falsification test |
| Green / reuse | Why invent traversal when GraphWalker/fast-check provide proven techniques? | M2 adapter benchmark, budget/seed manifest, library fit/licensing and no duplicate execution framework | CONDITIONAL, library benchmark not run |
| White / gate | Eight source specs unavailable for exact preservation; could a new appendix silently become ninth canonical document? | Explicit MBT-001-L eight-file map and MBT-GATE-01; draft status NOT FROZEN | BLOCKED |
| Security / trust | Imported model guard might run scripts or trigger destructive target action without authority | Pure AST, strict request caps, project composite FKs, target-level per-attempt permission and cleanup | SPEC AMENDED, attack corpus not run |
| Purple / design truth | Graph view can hide unmapped exploratory cases and break keyboard/cascade form | Case-wide graph/list fallback, source/runtime UI baseline and accessibility proof gate | BLOCKED real UI check |
| QA / concurrency | Model approval, role revocation or lost CREATE response could duplicate work or reattribute old evidence | Exact revision CAS, immutable model/attempt ties, retry tokens, non-idempotent mutation safeguards | SPEC AMENDED, concurrency execution not run |
| Grey / journeys | Does novice QA work without model-first development? Can coding agent start unplanned? | Explicit optional modeling, native run creation and existing Zyra/agent tasks; no silent execution/approval | G0 ONLY, no real journey |
| Graph / traceability | Source-declared route not normative transition; mapped case not verified case; unknown denominator hidden | Versioned expected/observed separation, typed edges and statuses MODELED/LINKED/SELECTED/EXECUTED/VERIFIED/APPROVED | SPEC IMPROVED, runtime unknown |
| Elephant-Goldfish / cold fresh eyes | Accessibility, performance, exploratory or negative tests may have no useful state path | Every canonical case graph-visible without fabricated state association; false-positive control | SPEC IMPROVED, independent blind check not run |
| Operability / observability | Cyclic paths, high graph cost, abandoned job, stale scheduler, deletion loss | Bounded graph jobs, fencing/lease/cancel/replay, saturation metrics, restrict-or-tombstone decision, two-domain performance pilot | BLOCKED until operational proof |

**Second-pass White adjudication:** Source reuse appears appropriate and the proposed specification explicitly separates expected models from observed source and actual evidence. No material claim about MBT runtime is verified. Do not authorize release or present this as independently qualified teams. The original 11-role table is preserved as a source-informed challenge only.

## Generic lifecycle/integrity full-chain check

For ANY application and module: reachable authorized producer -> original expected source & scope -> version/freshness -> model validation -> accepted case mapping -> bounded deterministic generation -> human-selected native run -> actual attempts & evidence -> explicit reviewer decision -> stale-state reporting -> retry/cancel/retention and observability. Missing edge/actor/attempt or unsupported case domain is a gap, not "out of scope" without documented adjudication.

## Findings and disposition ledger

| ID | Severity | Finding | Current status |
|---|---|---|---|
| MBT-F-01 | P1 | Normative model authority vs implementation graph ambiguous | SPEC CHANGED; test pending |
| MBT-F-02 | P1 | Circular expected-versus-observed self-validation | SPEC CHANGED; seeded contradiction pending |
| MBT-F-03 | P1 | Arbitrary expression / code evaluation | SPEC CHANGED; adversarial runtime pending |
| MBT-F-04 | P1 | Nonatomic activation and stale case/run/evidence versions | SPEC CHANGED; QA races pending |
| MBT-F-05 | P1 | Hard-delete removes historical provenance | OPEN: RESTRICT/tombstone decision |
| MBT-F-06 | P1 | Eight canonical spec files cannot be reconstructed from unavailable ZIP bytes | BLOCKED: retrieve/reconcile original |
| MBT-F-07 | P2 | Non-state test cases invisible or forced into fake paths | SPEC CHANGED; UI proof pending |
| MBT-F-08 | P1 | Unbounded generator and missing cancellation | SPEC CHANGED; load proof pending |
| MBT-F-09 | P1 | Design inferred from mock graph rather than existing UI | OPEN: Purple browser baseline |
| MBT-F-10 | P1 | Model approval mistaken for permission to execute target actions | SPEC CHANGED; real authorization proof pending |
| MBT-F-11 | P1 | Old execution silently counted as current coverage | SPEC CHANGED; acceptance proof pending |
| MBT-F-12 | P1 | Reuse/evidence report relies on stale PR status or CI SHA | CORRECTED with merged code + final PR-head CI |
| MBT-F-13 | P1 | Third-party generator's scriptable guard/actions bypass safety policy | OPEN: adapter security benchmark |
| MBT-F-14 | P1 | Role-lens analysis presented as independently executed team review | BLOCKED: C4 original cold-run proof |

## Independent reviewer qualification corpus (NOT RUN)

Use a fresh, isolated input for every existing team and withhold the answer key until its ORIGINAL response is frozen. Record false positives on conforming controls, not merely seeded defect catch rates:

- NEG-1: model approved => assume destructive production execution authorized. Must reject.
- NEG-2: previous HEAD 9/9 CI cited after new HEAD. Must detect stale evidence.
- NEG-3: observed bug copied into normative oracle. Must detect circular self-validation.
- NEG-4: model guard includes JavaScript/network commands. Must reject.
- NEG-5: report 100% despite unreachable transitions removed from denominator. Must distinguish excluded/unknown.
- NEG-6: no model path for accessibility/performance case. Must keep case valid.
- NEG-7: model/case revision changed since valid prior execution. Must preserve history and mark current stale.
- NEG-8: role revoked between preview and write, then ambiguous response. Must block/avoid duplicates.
- NEG-9: proposed extra model-run/evidence database. Must identify existing native owners.
- NEG-10: cycle/path generation never terminates under missing stop condition. Must enforce policy caps.
- POS-1: explicitly accepted case/model link with real native run evidence. Must recognize the link without overclaiming verification.
- POS-2: valid standalone manual/exploratory case with no state machine. Must not issue false missing-path defect.

Every team must identify actor, original source/citation, version, assumption, real observation, proposed vs actual effect, negative/recovery test, severity, disposition and exit evidence. Re-run a NEW seeded set after amendments; no shared-context agent can grade its own generated answer as independent. White signs only after harmful blind misses and unsupported high-confidence claims are resolved.

## Outstanding blockers and next steps

- MBT-GATE-01: full authorized eight-file v1.4.21 canonical archive and exact-preservation/diff validation: BLOCKED.
- MBT-GATE-02: native project role/review policy and isolation proof: OPEN.
- MBT-GATE-03: independently sourced expected oracle and injected forbidden-operation mismatch: OPEN.
- MBT-GATE-04: historical-delete/retention policy: OPEN.
- MBT-GATE-05: actual accessible Model Studio UI, list fallback and browser baseline: NOT IMPLEMENTED.
- MBT-GATE-06: two-domain bounded generator/replay benchmark: NOT RUN.
- MBT-GATE-07: independently executed qualified teams with original blind outputs: NOT RUN.
- MBT-GATE-08: real target adapter permissions/evidence: NOT RUN.
- MBT-GATE-09: exact model/case/build provenance and truth-preserving coverage dashboard: NOT IMPLEMENTED.

**Release recommendation:** do not merge a normative MBT engine or deploy Model Studio yet. Accept PR #88 integration independently at its actual deployed scope. M1 may be planned separately: versioned independently sourced expected models, precise case-to-model-step mappings, pure validator, read-only graph/list explorer. Reuse existing Zyra, review, case, run, execution and evidence systems. The review document is non-authoritative evidence, NOT a ninth canonical Tesbo specification.