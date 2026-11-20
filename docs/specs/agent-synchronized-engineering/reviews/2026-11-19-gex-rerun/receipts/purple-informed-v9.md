# Purple informed final-target delta — Tesbo 1.4.34 candidate v9

**Run:** GEX-ASER-2026-11-19. **Signed:** 2026-11-20 05:43 UTC. **Reviewer:** `/root/purple_review`, ChatGPT GPT-6 Astra Pro; original invocation, same model family, no model override or human/cross-model quorum. This is informed integration review, not another cold pass.

## Disposition and exact binding

**PU-V8-01 is corrected at the documentation level in v9. No further material UX contract correction identified within this delta. SOURCE-INSPECTED / VISUAL-BASELINE BLOCKED remains unchanged.** The new Reports projection has a coherent proposed decision/action contract; neither that contract nor the correction proves implementation, accessible interaction or user benefit.

Target root: `/workspace/scratch/ce8c3109f396/assurance-run-20261119/input-v9`. Manifest SHA-256: `722b4e066b1f06322fc4a908476aaf21cbc01ec73e1e934d8445a39824eff6d3`; RUN-CONTEXT: `037799819ca98ef839e7b2a6b0945dca27252b8913ce990333f700276aa9dd0a`. All fourteen file sizes/digests independently match; full hashes follow. Exactly C02–C05 and views `design`/`implementation-plan` changed from v8, by the additive handoff qualification.

Application source remains `6897f989b055a955280f810c7daace86f74057fa`. Incoming canonical ZIP is `2e76fd42d35b7956007f2aba95f86a15598fcc102bf4d4318d72c56d581a52cc`; its eight extracted files were verified. Original method commit remains `d83549c85a4dcd047fb40dc4fba4ec62737ab0fc`; all six method digests still match v4. Frozen v4, v7 and v8 receipts are unchanged. The v8 finding receipt hash is `f5f9d88c1a50e364bcbd4cc7514e6da503906a09a3e452088df36afb96be5045`.

## Finding closure and native consequences

I independently identified the incoming dispatch-only Run-creation sentence before the coordinator proposed this correction, then froze it against v8. C02:783–789 and matching C03/C04/C05/view qualifications now expressly preserve authorized create/choose, attach and accepted-link preparation, including a committed Run before dispatch. Their PARTIAL and uncertain-outcome receipts remain meaningful under C04:811–813 and MBT-AC-37. Viewing/staging a finding creates no Run; dispatch, actual target execution, evidence and FR-119 closure remain distinct.

The separate `run_behavior_model` Run-plus-manifest protected operation retains its atomicity requirement. New planned variants distinguish harmless staging, legitimate preparation, existing-Run reuse, later-stage failure and atomic-operation failure. This resolves the conflicting user expectations without deleting historical text or inventing a preceding task/report. Real native transactions and recovery remain unexecuted.

## Reports projection, scope and user decisions

The material addition is Reports → Graph Analytics with Change impact and Coverage gaps. C02:749–768, C03:1636–1650, C04:1052–1063 and C07:699–722 retain native graph, requirement/policy, Model Studio, Case/Run/Evidence and impact-review owners. Model editing stays in Model Studio. The projection grants no approval, oracle, result or closure authority.

A finding must distinguish an absent approved case, an unexecuted eligible case, missing evidence, inaccessible/incomplete scope and supported no impact. These lead respectively to reuse/proposal, explicit native preparation, receipt recovery/distinct attempt, clarification/refresh, or no write. Requirement-only projects remain valid. Ranking is deterministic with explained factors, explicit unknown criticality and accessible critical/unexamined items; AI loss cannot erase counts or the useful list. Old/out-of-cohort passes and relationship multiplicity cannot establish current obligation coverage. Insufficient evidence requires abstention from quantitative defect probability.

### Material source/status matrix

Source paths below are at the application pin. **F** = `Tesbo-Frontend`; **R** = `F/app/(app)/projects/[id]/reports/page.tsx`; **B** = `Tesbo-Backend-Nest/src`.

| Surface / decision | Actual source and required change | Status |
|---|---|---|
| Entrance and return scope | R:97 uses local tab state; proposed URL/subview/snapshot must survive reload, Back and stale scope | Source inspected; navigation proof pending |
| Shared navigation and detail | `F/components/reports/ReportsNav.tsx:39–44,73` has visual active styling and fixed width; C07 requires adaptive, programmatic state and focus return | Render/reflow/keyboard/AT BLOCKED |
| Loading and refreshed findings | R:202–289 contains unfenced or failure-to-empty readers; reuse must preserve unavailable/partial, fence late work and reauthorize | Contract represented; actual recovery unproven |
| Coverage and surrounding metrics | R:303–307,431–435; `B/legacy/legacy.service.ts:10294–10317` aggregate suite execution, not selected obligations | Relabel/omit legacy coverage; scope all reused header metrics; denominator proof NOT RUN |
| Native detail continuation | `TraceabilityTab.tsx:10–21,149–178` renders case/run/bug data, not the proposed obligation graph | Exact permitted handles, revisions and return context need convergence |
| Both export entrances | R:379/390,445/446 and ReportsNav:113–132 export six native views | New Graph Analytics exports omitted; preserve six existing types; actual checks NOT RUN |
| Finding-to-action transition | v9 explicit native stages plus exact snapshot/case/oracle/cohort checks | PU-V8-01 text corrected; side-effect, denial and recovery proof pending |

## Unresolved gates and method limits

The unchanged Purple charter `PURPLE-2026.10.18-r7` and runbook `PURPLE-RUNBOOK-2026.08.29-r2` retain their active/advisory/draft distinctions. Seven active whole-page obligations and mechanical fidelity remain **BLOCKED / NOT RUN**: no authentic Before, rendered After or target session exists. Formal Pass 2, operational adoption and draft release machinery were not run. No official Purple verdict is issued.

Comprehension of stages, denominators, unknowns and selected-versus-current scope remains unobserved, as do focus, announcements, narrow layout, zoom and real recovery. Original source-convergence, authority and manual/delegated QA round-trip prerequisites remain open. Eight GEX and five GA obligations are planned proof; aliases and mechanical package checks are not product tests. I did not run the separate verifier. Incoming C06 changes the candidate method: prior trial assertions cannot validate these successor bytes or user benefit. PR167 and incoming assurance prose remain outside current-runtime evidence. No Skill, product, external data or UI was changed; this post-authorship review establishes no chronological admission or release readiness.

## Full v9 primary-input hash report

| File | SHA-256 |
|---|---|
| canonical/00_README.md | `eb726debc44f82ab886099249139768fb453c1df21c1b59309f4396680f2e4e2` |
| canonical/01_PRODUCT_REQUIREMENTS.md | `d92c9c4829aaecc4f15758175d42aba217c499ef2249c157ffc46431f6f01cee` |
| canonical/02_WORKFLOW_AND_UX_SPEC.md | `f2a7a9875dd16c2aa3acb90dc927ff4db95282a60692384146ee0e92ec4ea327` |
| canonical/03_TECHNICAL_DESIGN.md | `99409c523d7e4bb066de9fd8f265090b319c5141bc7520ff3354231d354232f6` |
| canonical/04_MCP_API_CONTRACTS.md | `0d3e2fbefbf5b843384d2ecda4ed4b2d642af48b1c643aa7070281761e044597` |
| canonical/05_IMPLEMENTATION_BACKLOG_AND_TEST_PLAN.md | `c0af9242ccae9187ce2b6b2e8fff9fb59d1e7aa6cbe00c07f5edf5d1153baf25` |
| canonical/06_IMPLEMENTATION_AGENT_BRIEF.md | `47f096c1ad78fa0b452ec0641a387c5d042b71df98b77b6f03f96ce249a15e45` |
| canonical/07_UI_DESIGN_TASKS.md | `0a1d35cfe2be06b1095535f338cd62f8b2df6744653ba196afb8fbea0cd26945` |
| views/AGENT_RULE_TEMPLATE.md | `16924790aafb5002a8c595215a9c1723a998d60431a16d3a87ad2adb50005951` |
| views/README.md | `804a0277caae43eb540d525c328d835dc6a1cfc925678b2874893d66a455e7d9` |
| views/design.md | `f0f2239c5bcd440d05690b3ef9d38899f940b07259e072270152a282768bef41` |
| views/implementation-plan.md | `6363283682d595c28c36e0927f7b8cd0945b78216a2bf1a6530a29af48124e47` |
| views/requirements.md | `b66e6069876e032c0db3f144a75f3441c2a7ff780188629c5a097a37f552dcbd` |
| views/skills-governance.md | `d87075f518c059efe045f43bc9c128c7ca40e2ecb795b348a2af196c1a39b4c0` |
