# QA informed material delta — candidate v6

**Signed:** `/root/qa_review`, 2026-11-20 05:26 UTC. Same actual QA member/invocation: `spawn_agent`, `fork_turns=none`, no model override, same family. This is an informed review, not new cold discovery, runtime certification or human approval.

## Disposition and exact target

**REQUIRES DOCUMENT CORRECTION:** v6 integrates the semantic/consequence scope and concrete QA fixtures coherently, but introduces one material contradiction between blanket active-revision wording and retained Draft/HISTORICAL Model Studio operations. Record QA6-D1 below before correcting it. Existing source and implementation findings remain open.

Target manifest: `input-v6/manifest.json`, SHA-256 **`323e7605def23ef1a1290682d6341d45ef0436dfbef1ee4c74016fac0f91c241`**. All 14 file sizes/hashes independently matched. Application remains **`6897f989b055a955280f810c7daace86f74057fa`**, inspected through pinned Git objects; neither concurrent documentation head `2a3708cec25acca0261dcb2461106a8ce0faf036` nor open PR167 is the reviewed application target. The incoming five files independently matched their verified-source manifest.

Unchanged QA charter/orchestration at method `d83549c85a4dcd047fb40dc4fba4ec62737ab0fc` apply; canonical06 remains the same candidate. Originals remain unchanged: `qa-v3.md` hash `6ab1c261f63a58241015f9b31e0bd8e66394d6418a5aa3fdb51d3a159bde3ed1`; `qa-grey-informed-v3.md` hash `a89bd6ddfd3e8909a2eb46b633c6ec9d5dcb720d32ddab683452a3d23649f389`.

Read scope: v3→v5 changes, exact v5/v6 manifests and v5→v6 canonical additions, affected subordinate sections, incoming semantic/activation/feedback clauses, retained lifecycle and scenario definitions. Permitted Green B count finding/probe and Grey's v5 continuation were consumed as attributed evidence. No other member's execution becomes mine.

## QA6-D1 — active-only clause contradicts valid modes

**High documentation inconsistency; source/runtime consequence unexecuted.** Canonical03:1662 and views/skills-governance:207 say **any governed Model Studio or Skill-assisted operation** resolves a **currently activated approved revision**, then pin the active revision to each attempt. Read literally, this blocks two legitimate retained paths.

Counterexample A: an authorized author previews a Draft without affecting official coverage; MBT-AC-03 and C13–15 permit it. Counterexample B: r1 is approved but inactive after r2 activation; a reviewer explicitly requests HISTORICAL r1 with fresh consent and eligible mapping/cases. Canonical03:890, canonical02:622–628, canonical04:798 and MBT-AC-04/29/43 permit that selected historical revision. Replacing it with active r2 changes the approved intent; denying it solely for inactivity contradicts the retained contract. “Compare proposed revisions” does not clearly preserve these operations.

**Required correction:** separate effective Skill assignment for governed authoring from Model Studio CURRENT applicability. Preserve authorized Draft inspection/preview and explicit HISTORICAL selection under MBT-C02, relevant consent and eligibility. Pin selected revision, mode, scope and applicable decision receipts; revalidate the relevant mode/action rather than forcing all work through the active model pointer. Missing authority still blocks its affected action; independently authorized raw observations remain valid. Canonical03 and subordinate Skills owner must agree; aliases41/42 should explicitly target CURRENT where intended.

**Closure oracle:** Draft preview succeeds without activation/publication; CURRENT selects active r2 and rejects a stale pointer; explicit HISTORICAL r1 preserves r1 without current-coverage credit; retired generation/dispatch remains denied. None has been executed here. This finding concerns the newly introduced wording, not a retroactive claim against the cold original.

## Corrected source-fit allocation and remaining evidence

V5/v6 adequately name QA3-02 proposal context and QA3-03 failed case discovery: delayed and already-loaded switches, errors/notices, cancellation, unavailable/zero/one-result controls, preserved selection and authentic browser proof. MBT-AC-45/43 correctly identify staging and removal-race obligations. Existing tests protecting latest-head supersession/manual Bug auto-failure cannot prove the target contracts.

I independently inspected `coverageForUser`937–976: relationship joins can multiply `COUNT(*)`, and the projection emits per link. Green B's SQLite probe is supporting **peer** evidence, not my execution. Distinct native attempts must remain distinct; deduplicating one mutable execution row cannot reconstruct overwritten history. Native `writeExecution` around7795 updates the result row, while `publishExecutionChange` emits best-effort activity afterward; the retained immutable-attempt/history gates therefore remain necessary. No PostgreSQL or displayed-count incident is claimed.

## Incoming-label allocation: actual assertions, not label equivalence

The v6 mapping is adequate **because it specifies additional fixtures**. Existing broad family tests alone do not establish those assertions. The following independently checks its actual allocations; suggested extra references are not required to make an otherwise explicit fixture valid.

| Incoming alias | Actual v6 canonical allocation / assessment |
| --- | --- |
| SEM01 | FLOW37/46; SK26/34/36: policy/manual/code conflict, exact authority/scope and expired-policy control. Adequate. |
| SEM02 | FLOW21/45/52; FR119: explicitly adds policy-only change with zero code event. Adequate new trigger fixture; original code-trigger tests insufficient. |
| SEM03 | FLOW32/45; R-ASE19/40: explicit editorial/no-new-case outcome versus changed obligation. Adequate positive no-change control. |
| SEM04 | FLOW36/43; MBT-AC34: comparable/mixed attempts, competing causes and independent observations. FLOW43 alone is evaluation, not flakiness proof; new fixture supplies the distinction. |
| SEM05 | FLOW40/43/48/53; SK20/33: biased/cold labels, abstention, separate holdouts/calibration and retained mandatory coverage. Adequate; no numeric predictive performance established. |
| SEM06 | FLOW33/53; MBT-AC02/34; COVERAGE/1: independent forbidden obligation and separated denominators. Mapping multiplicity is not normative or execution proof. |
| SEM07 | FLOW23/41/52; ASER-C06: finite loop/data budget, omissions and no completeness claim. Critical obligations remain visible/unmet at exhaustion; do not exceed the authorized budget to pretend completion. |
| SEM08 | FLOW47/51/52; SK40: inferred consequence remains hypothesis/UNKNOWN, no trusted edge or native/Passed mutation. Adequate denied-effect oracle. |
| Proposed SK41 | SK04/06; MBT-AC28/41: older active versus newer approved, separate method/model owners. Adequate fixture, subject to QA6-D1 mode correction. |
| Proposed SK42 | SK02/04; MBT-AC41: save/approve leaves CURRENT selection unchanged. Subject to the same correction. |
| Proposed SK43 | SK31/39; FLOW34/48/54: immutable correction, original outputs and optional regeneration/rollback. Adequate; result correction still uses its separate native owner. |
| Proposed SK44 | SK05/11; FLOW09: action-time assignment revalidation and raw-observation exception. Adequate, with mode-specific Model Studio handling under QA6-D1. |

Here FLOW/SK abbreviate ASE-FLOW/SK-E2E; SEM abbreviates incoming GEX-SEM. Independently counted canonical definition rows and unique IDs: **15 ASE-E2E + 54 ASE-FLOW + 40 SK-E2E + 16 ASE-INT = 125**, with no duplicates in those anchored definition rows. The twelve aliases add fixtures, not twelve scenario definitions or executions. This check is not the Green package verifier or semantic proof by count.

## Limits and handoff

Semantic interpretation has testable authority, provenance, uncertainty and consequence boundaries. Normative applicability depends on the real owner/effective scope, not merely the title Policy. Manual/deterministic/no-prediction outcomes remain legitimate. Causal claims, calibrated risk and human usefulness each require independent outcome evidence; structural consistency cannot prove them. New subordinate method discussion is contextual candidate material, not an installed or demonstrated superior method.

Original **50 Grey jobs** and **five executed pure helper controls** remain unchanged. This delta ran only hashes/counts, document comparison and pinned source inspection; no helper rerun, planned scenario, native runtime, DB fault injection, UI/AT, provider action, human study or shared-system mutation. Original five Grey Major source findings, actual authority/recovery/retention, complete consumers, original QA round trip and deployment gates stay open.

Freeze this v6 finding receipt unchanged. Any corrective target needs a separately identified informed delta; no architecture freeze, implementation permission or operational sign-off follows.
