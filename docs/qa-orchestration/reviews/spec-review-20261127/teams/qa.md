# QA Team — Tesbo 1.4.49 C2 original report

## Disposition and scope

**QA disposition: the C2 amendment can remain a source-reviewed Proposed / Backlog design with named implementation gates. It is not product acceptance, architecture freeze, or release approval.** I found no additional contradiction that blocks retaining the documentation at that declared maturity. The source-identity and sync-fence qualifications added in C2 have concrete source support and remain unexecuted implementation gates.

**GREY-C01 corroboration: source restriction confirmed; adoption as a Major current-product defect withheld.** The inspected project mapping screen cannot submit an empty selection, while the Jira API supports project unlink. That difference is real at both inspected application pins. The available current requirements do not establish that every supported integration API operation must have a native-screen action, and the inspected UI test deliberately treats Clear selection as an unsaved selection change. Keep the unmet native-screen journey as a product/UX clarification and a future selected-source-profile coverage gate. Do not record it as a reproduced bug, an introduced C2 regression, or an independently adopted Major finding. Full reasoning and valid alternatives appear below.

**Reviewer/assignment:** `/root/qa`, separately invoked QA Team role. Dispatch supplied C2 run context and source/method paths, required an independent initial oracle derivation, and then explicitly authorized an informed challenge of Grey's frozen inventory. No parent conversation or preparatory review conclusions were inherited. Candidate text itself exposes historical judgments, authored C2 corrections and a reference to an earlier Red finding; this exposure prevents any claim of blind discovery. I did not open other peer reports. The only peer report read was the assigned Grey report, after freezing my own initial questions.

**Evidence mode:** source/document inspection; bounded G0 conceptual scenario analysis and G1 code-grounded subtraces. No application tests, database operations, native Tesbo writes, installs, browser interactions, repository/candidate edits or external provider calls. No native synchronization was performed. No new official Tesbo Test Case IDs were created. Q01–Q18 below are local review questions only. Product/runtime, native-record execution, authentic Before/After UI, accessibility, human comprehension and deployment outcomes are **NOT RUN / NOT VERIFIED**. Graph review, if performed later, must remain manual unless its actual harness runs.

The inventory is the **changed and affected plugin/reuse journey families**, not all of Tesbo. Source sampling does not prove complete writer or consumer convergence. No pre-architecture gate is retrospectively satisfied by this post-proposal review.

## Identities, chronology and inspected evidence

| Identity | Exact reference |
| --- | --- |
| Target | `review-candidate-v149-c2`, 1.4.49 C2; `RUN_CONTEXT.md` and 15-artifact `INPUTS.json` |
| Target manifest SHA-256 | `c722c8e75521a495a1560f562324bfc27ad2b2e8e318f0d4986b80a18b1a760c` |
| Current owner-check source | `1alextest/Tesbooboo@d440c48ede32ca38783b178ea6d957ded8bca9e4` |
| Historical claims pin | `1alextest/Tesbooboo@f92c3341eadc03f274becbead3b0f45d0a86539e` |
| Research parent | `7539a739243167b2d6709df1d644bd5b955f6ffc`; no independent external precedent verification claimed |
| Saved v1.4.48 archive identity | `6665ba660aa208bd35db51b90052fc0b69abc01c6922c197544003e3480b1bef`, as supplied in the run context; archive itself not rehashed by QA |
| Unchanged methods source | `NesberryEnterprise/Nesberry@d83549c85a4dcd047fb40dc4fba4ec62737ab0fc`, recovered under `methods/` |
| QA charter SHA-256 | `f15d2853bc50c8f2e9a4833092c34404b3f7711fb802d461980d8d939dcc5717` |
| Orchestration SHA-256 | `8fd41f22e1909afd48d8af95120d03a0f52e30a1bf9976a639fb6cca67bb4729` |
| Portability policy SHA-256 | `33c69cba82f7d98773e85a30fa1afff15cc0dbcec0d88302a0295ce06e2c8524` |
| Independent question ledger | `team-reviews/qa-independent-derivation.md`; SHA-256 `8f6e4ec23db4561d5eed8a019e5915297c7b35c51c18cd81c67c7390283d394e`; saved before Grey was opened, at the observed tool time `2026-11-27T12:23:20Z` |
| Grey input | `team-reviews/grey.md`; SHA-256 `b6e22c141dfed3dad177a1ce00b36493031be149d5a7d81c9b0fe756135a1e4c`; explicitly **C1**, historical source pin `f92c334…`; preserved unchanged |

The C1 Grey inventory is not relabelled as C2 coverage. This report supplies the subsequent **informed C2 crosswalk and independent source corroboration**, including changed oracles for sequential account replacement, retained-data authorization and awaited-work fencing.

### Scope and evidence keys

`D00`–`D07` mean the corresponding canonical document in `review-candidate-v149-c2/docs/qa-orchestration/`. Source paths below are relative to the Tesbo repository and resolve at the stated pin, never the mutable working copy. Line numbers are source locators for this report; they do not imply execution.

| Key | Actually inspected |
| --- | --- |
| M | Full unchanged `.kiro/steering/teams/qa-team-charter.md`, full `review-orchestration.md`, full `POL-GOVERNANCE-ASSURANCE-PORTABILITY/v001.md`. Full reads were completed in bounded chunks after initially truncated combined output. |
| D | All eight `delta/*.diff`, 337 lines in total, including D06's in-place quality/transfer additions. C2 changes to AGENTS, CLAUDE and the subordinate Skills pointer; C1→C2 D03/D04 changes; relevant canonical prior excerpts, not all historical bodies. |
| D01-P | FR-054–070; R-ASE-22–36 and acceptance statements, including exact assignment, raw observation independence, historical provenance and UI/governance boundaries. |
| D04-P | §§10.1–10.4, source namespace/cross-channel and revocation/retry contracts around lines 485–510; ASER-C02–04 around 936–990. |
| D03-P | v1.4.47 stop/current-authority and v1.4.48 dependency-aware coordination excerpts around 2040–2070. |
| S01 | Full `Tesbo-Frontend/components/integrations/ProjectIntegrationMapping.tsx`, current pin, lines 1–373; same exact Git blob at historical pin. |
| S02 | Full Jira project integration page wrapper; current `Tesbo-Frontend/lib/api.ts:4128–4140`; `Tesbo-Backend-Nest/src/legacy/legacy.controller.ts:2300–2348`. Targeted frontend call-site and `/jira/projects` searches. |
| S03 | Current `legacy.service.ts:14931–15005` (disconnect/status), `15089–15188` (Jira mapping, sync admission/status); current callback `14790–14865`; historical callback `14764–14802`. These are selected complete functions or explicitly bounded excerpts, not a full LegacyService audit. |
| S04 | Historical `integration-sync.service.ts:180–310` (queue identities/run transitions/settling); processor `110–245`, `275–340`, `450–605` (coordinator, callbacks and post-await mirror write); current client `110–140`. The three files' blobs are identical at the current pin. Not every function or writer was read. |
| S05 | Full V47, V72 and V97 integration migrations at the historical pin. Historical schema intent was compared with actual current/historical writers; migration comments alone are not deployed-schema proof. |
| S06 | Current `skills-governance.ts` selected resolver/type/history excerpts, including complete eligibility query and resolver at 86–140; `legacy.service.ts:17675–17735` covering receipt recovery, assignment deactivation and library start. |
| S07 | Current `e2e/ui/integrations.spec.ts:935–995` and `e2e/api/integrations.spec.ts:1420–1465`. Both files are byte-identical between the two source pins. Existing test source was read; no test was run. |
| S08 | Current `docs/FEATURE_DOCUMENTATION.md:3135–3190`, located during alternative/requirement search. Its historical UI restriction is useful context, but several surrounding details are stale relative to S01/S03; it is not a reliable current behavior oracle. |
| G | Entire frozen 199-line Grey C1 report, read only after the initial QA ledger was saved. |

Broad `rg`/`git grep` output was navigation; truncated matches were not treated as a full document read. No external research source, full source tree, full active-client registry, deployed configuration or complete legacy policy history was independently audited.

## Initial QA derivation and oracle discipline

The initial ledger reconstructed the job as obtaining usable, attributable engineering work under existing native authority. It independently identified the member, manager, delegated worker, human reviewer, historical reader, operator and method author/evaluator. These are capability descriptions, not new RBAC grants. It traced outcome selection → admission → configuration/connection → enablement → invocation → native result/review → change → stop/removal → historical read/retry/reinstall, with profile-specific exclusions.

The 18 questions recorded before Grey exposure cover: core/manual alternatives (Q01); exact admission/dependency cardinality (Q02); sequential and simultaneous source identity plus legitimate renewal (Q03); all-entrance authority (Q04); post-wait fencing (Q05); unknown commit/retry (Q06); upgrade/migration (Q07); dependencies and shared state (Q08); retained read authority (Q09); purge/reinstall/shared resources (Q10); source provenance and review (Q11); execution/attempt/report/Run distinction (Q12); inert method import and human assignment (Q13); report/export and inference (Q14); context-bound UI and recovery (Q15); operability (Q16); historical reconstruction/migration (Q17); and method comparison/evidence limits (Q18). The original ledger contains each expected and forbidden effect and remains unchanged.

These oracles come from current requirements and retained contracts, not merely from matching the implementation. A read-only report can be correct with no durable write; a native publication must have authoritative readback and required provenance. A UI status, accepted report, package signature, successful helper, matched hash or linked case cannot prove an unobserved effect. The same rule permits legitimate alternatives: API-only administration can be an intentional product boundary; a remote client need not be an installed plugin; a source disconnect can leave independently authorized project knowledge available; and current-authority revocation does not erase historically observed actions. [D01-P, D03-P, D04-P, D01–D07, M]

## Informed crosswalk of all Grey material families to C2

All 16 Grey families are retained. H/M are Grey's high/moderate risk classifications, also appropriate for this bounded review; no separate Critical tier is asserted. `DEFINED` means a discriminating contract-level oracle exists, never an executed pass. `OPEN` means the named implementation, decision or policy evidence remains unresolved. `BLOCKED` means an actual journey cannot yet be instantiated. All rows have **runtime NOT RUN**.

| Grey family / risk | QA questions and concrete fixture / sequence | Required authoritative result; forbidden effect | C2 QA disposition and source basis |
| --- | --- | --- | --- |
| J01 Choose capability / M | Q01/Q18. A member has a core task and optional provider unavailable; compare current native/manual/client completion. | Valid native outcome or explained missing prerequisite; no compulsory package or fictional fallback. | **DEFINED**. G0 contract assessment, D00–03/07 and FR-058–059. No capability selection inferred. |
| J02 Connect and consume source / H | Q03/Q04/Q11. Project A, current connected account and permitted member; map → request sync → follow the native result. Add denied actor, partial import and missing upstream content. | Mapping and queued run remain prerequisites; actual imported records/provenance are required for intake completion. No source label may approve a native case. | **DEFINED**, with S01–05 source subtrace. S03 admission checks access/entitlement/connection/mapping; no real source bytes or end-to-end persistence observed. |
| J03 Change source identity / H | Q03/Q05/Q17. Replace A by B under one active provider connection with equal external IDs; deliver old A work; separately renew the same evidenced A account. | Historical A remains A; late A cannot update/claim B; valid same-account continuity remains. Simultaneous sources require their own selected cardinality proof. | **OPEN — source identity/migration gate**. C2 improves Grey's C1 formulation: sequential replacement is required even if multiple active accounts are never selected. S03 callback, S04 mirror keys, S05 and D04-P support it. |
| J04 Trust external execution / H | Q04/Q05/Q06/Q12. Authorized task and expected basis → delegated attempt → external observation/report → native review → separately admitted Run. Include revoked/stale attempt and unobserved claimed PASS. | Retain actual attempt/evidence and uncertainty; no report acceptance, agent assertion or trace becomes execution or publication authority. | **DEFINED** at contract level, D01-P/D04-P/D01–05. QA did not independently re-audit every Run-admission call site. |
| J05 Adopt method content / H | Q04/Q13/Q17. Inert candidate v2 beside assigned approved v1; approve without assigning, then explicitly assign under current human authority; revoke and retry. | Approval/assignment remain distinct; exact scoped version resolves; v1 historical attribution survives. Machine cannot self-approve, assign or activate. | **DEFINED**, with S06 resolver/deactivation/recovery subtraces and D01-P. Not full Skills/runtime acceptance. |
| J06 Analysis becomes reviewed work / H | Q04/Q06/Q08/Q11/Q12. Exact source/expectation → attributed inference → candidate → selected human review/apply; change the basis before apply. | Conflict preserves work and requires valid current basis; only authorized selected native effect commits. No inference becomes an observed result or independent oracle. | **DEFINED**, D04-P ASER-C02–04 and D01–05. Proposal, publication and audit transaction implementation not comprehensively inspected. |
| J07 Read/export historical result / H | Q09/Q14/Q17. Disconnect provider or remove renderer while project read remains; then revoke applicable read grant; inspect permitted native history and derivatives. | Permitted project history remains interpretable; actual revoked scope denies protected snapshots/cache/index/export, with unavailable evidence explicit. No blanket disconnect-implies-revocation or derivative laundering. | **DEFINED**, C2 D03 correction controls over Grey's C1 shorthand. S03 confirms retained KB intent; all reader/cache/export paths require later proof. |
| J08 Use contributed UI / H | Q01/Q04/Q15. A selected contribution with actual placement, role, fixture and native action is needed before navigation/keyboard/return can be walked. | Correct contextual action and native outcome with preserved work/focus; no cosmetic control or false ready state. | **BLOCKED — contribution/UI not selected or implemented**. D07 intentionally defers it. No authentic current/after capture or interaction verdict. |
| J09 Admit compatible contributions / H | Q02/Q04/Q08. Exact packages, incumbent singleton, optional and required dependencies; inject conflict/cycle/unknown capability and ordered-member failure. | Refuse affected admission before effects, preserve incumbent and independent route, retain stable explicit composition/partial result. | **DEFINED**, D01/D03–05. Package boundary, host and registration runtime remain unselected. |
| J10 Upgrade/reconfigure / H | Q05/Q07/Q08/Q10. Pin approved version/configuration; expand scope or change dependency, fail migration, then attempt downgrade. | Exact changed basis is reviewed and current; safe compatible recovery or blocked receipt. No inherited broader permission or unsupported data rollback. | **DEFINED**, D01–05/07. Concrete schema/migration/compatibility tests await selected profile. |
| J11 Stop/revoke / H | Q04/Q05/Q06. Pause queued and post-provider/analysis work; disconnect/revoke/replace generation; resume; compare legitimate same-generation control and externally committed action. | No new stale protected effect or terminal-run resurrection; already committed/unknown external outcomes remain attributed and reconciled. | **OPEN — existing sync fence proof**. C2 D03 names the source gap; S03/S04 independently support it. Grey's C1 HOLDS applies only to the intended contract, not the incumbent guarantee. |
| J12 Recover lost acknowledgement / H | Q04/Q06/Q15. Commit K, lose response; query as same authorized actor, revoked actor and different actor; replay same/different payload. | One logical native effect and original receipt; changed payload conflicts; denied actor gets no sensitive receipt. External uncertainty persists until reconciled. | **DEFINED**, D04-P and S06 current-authority/actor-owned Skills receipt lookup. Other writers and complete request-key creation/replay are not certified. |
| J13 Remove/purge/reinstall / H | Q07/Q09/Q10. Remove a contribution with dependents/shared credentials and retained history; separately purge and reinstall an approved release. | Owned cleanup obeys impact/retention; shared assets and permitted history survive; no revival of expired grants or deleted data. | **DEFINED**, C2 D03/D05 and S03 retention boundary. Conditional plugin hooks, reinstall and purge remain unimplemented/unexecuted. |
| J14 Stop only project A source / H | Q04/Q09/Q10/Q15. Jira feeds A and B; on A's native mapping screen clear selection; compare explicit authorized API unlink and workspace disconnect. | If native unlink is a required supported journey: A disabled, B/credentials/history unchanged; no workspace-wide substitute. Current code only changes local selection through Clear. | **OPEN — native UI expectation/product decision**, not adopted Major failure. S01–03/S07 prove restriction/API; no specific current native-screen requirement found in inspected contract. See corroboration section. |
| J15 Diagnose/degrade/recover / H | Q08/Q16. Slow or failed contribution, required dependency loss and competing workload; compare actual operation identity and core route. | Current observed health, restricted attribution, selected measurable limits and supported recovery; no fabricated SLA or implicit fallback. | **OPEN — workload/support thresholds and runtime proof**. D03/D05 define required meanings; quantitative pass/fail awaits selected workload/policy. |
| J16 Learn from precedent / M | Q18. Select dissimilar authorized tasks and good/fault/unknown controls; compare incumbent and candidate with alternative cause and no-change result. | Traceable adopt/adapt/reject/defer/no-change decision; independent expected basis and denominators; no claim that document review proves effectiveness or human acceptance. | **DEFINED**, D06 method/D05 qualification plus M. This informed review is not a controlled comparison or held-out discovery experiment. |

### Coverage and status counts

| Accounting basis | Total | High risk | Moderate risk | Meaning |
| --- | ---: | ---: | ---: | --- |
| Grey C1 inventory | 16 | 14 | 2 | Preserved original denominator; not full Tesbo coverage |
| Grey C1 simulated families | 15 | 13 | 2 | 11 G0 + 4 G1 code-grounded; 1 actual contributed-UI family blocked |
| Grey C1 result labels | 12 HOLDS; 2 INCONCLUSIVE; 1 FAILS; 1 NOT_ASSESSED | — | — | Original judgments, unchanged; HOLDS is not a test pass |
| C2 QA crosswalk and oracle assessment | 16/16 | 14/14 | 2/2 | Every original family mapped; no silent omission |
| C2 QA DEFINED contract oracles | 11/16 | 9 | 2 | J01/02/04/05/06/07/09/10/12/13/16 |
| C2 QA OPEN evidence/decision gates | 4/16 | 4 | 0 | J03 identity/migration; J11 fence; J14 native UI requirement; J15 workload/support |
| C2 QA BLOCKED concrete journey | 1/16 | 1 | 0 | J08 selected contributed UI absent |
| Runtime tests executed by QA | 0/16 | 0/14 | 0/2 | All 16 unexecuted; run context forbids product execution |
| G2/G3/deployment verified | 0/16 | 0/14 | 0/2 | No running build observed |
| Uncrosswalked inventory rows | 0/16 | 0/14 | 0/2 | Does not imply all channel/role/state combinations assessed |

QA reviewed 15 conceptual families against C2's required/forbidden outcomes and named the blocked J08 prerequisites. Selected S01–S07 subtraces provide source grounding, not four or more fully implemented journeys. No complete plugin scenario has demonstrated automated coverage. Two existing test-source excerpts constrain the unlink interpretation; their existence is not execution, complete current-state coverage, or proof for other entrances.

The C2 changes alter the branch obligations without adding artificial journey counts: J03 now includes sequential replacement and same-account renewal; J07/J13 distinguish connector removal from actual read revocation; J11 explicitly retains post-await and queued-run fence gaps. J08 and J15 remain blocked/open for legitimate deferred decisions. J14's source limitation persists at d440, but its normative FAIL is not independently established.

## Independently corroborating and challenging GREY-C01

### What the source establishes

The Jira page passes `connectJiraProjects` into `ProjectIntegrationMapping`. `handleSaveMapping` can submit `[]` and contains an unlinked success string, but the only normal save control is disabled when `selectedId` is null. Clear selection sets that state to null. Full component inspection found no separate unlink control. The current frontend wrapper posts to the same project-scoped backend mapping owner. [S01:137–153, 335–347; S02]

The backend explicitly accepts an empty array, disables enabled mappings **only for the given project**, and returns `linked: 0`. It preserves outgoing cached tickets/documents. Workspace disconnect instead clears the shared connection's live credentials and disables every mapping backed by it; it intentionally retains imported KB material. Thus disconnect is not an equivalent project-scoped outcome. [S03:14931–14977, 15089–15134]

The mapping component, existing integration UI test file, integration API test file, sync service, processor and client all have identical Git blobs at f92 and d440. The control restriction is therefore corroborated against current integrated development, not only the older candidate pin. The Jira mapping endpoint/service was separately re-read at d440 because LegacyService changed in other areas.

### Counterevidence and current requirements

The inspected UI test explicitly clears the selection and expects Link to be disabled. That test is a **Notion** shared-component case, not a separate Jira product decision, but it is strong evidence that Clear selection is deliberately treated as local form state rather than a committed unlink action. The Jira API test separately expects empty-array unmapping and retained cached data. These tests demonstrate differing declared source behaviors; neither test was executed here. [S07]

The legacy feature documentation also records the UI/API discrepancy. Its surrounding multi-select, hard-delete and synchronous-sync descriptions conflict with current S01/S03; the suggested check/uncheck workaround cannot be adopted for the current single-selection component. It is therefore historical context, not current policy approval or reliable recovery guidance. [S08 versus S01/S03]

FR-064's equivalent governed entry routes apply to Copilot/external-client QA work; they do not require every integration administration API to have a corresponding UI control. FR-069 requires reuse of native stores/screens and source-linked actions; it does not specifically decide project-source unlink presentation. C2 D02/D07 require understandable completion for a **selected future contribution** and D03 requires bounded lifecycle effects. They do not retroactively announce complete native unlink support in an unchanged incumbent screen. Targeted searches of D01–05/07 did not locate a specific current Jira-unlink UI obligation. This is a bounded negative search, not proof that no external owner decision exists. [D01-P, D01–07]

### Valid alternatives and disposition

A product can validly make this administrative transition API-only with a documented operator flow, or provide a separate explicit Unlink action while preserving Clear selection as form editing. Either can satisfy a stated product contract; merely enabling the Link button on an empty selection is not the only valid design. An independently supported project-level pause could also meet a stop-new-intake goal if its effects and user contract were established; this review found no such alternate control and does not invent one. Replacing the selected source is not equivalent to stopping intake. Workspace-wide disconnect is not equivalent when B must continue.

**Disposition:** confirm the narrow source reachability fact and affected-persona hypothesis; **do not adopt Major severity or a confirmed current UI defect without the relevant product obligation**. Route the decision to the existing integration/product owner and Purple. If native project unlink is already intended, the source evidence supplies a concrete implementation gap and the future test below becomes required. If API-only is deliberate, record that boundary and ensure a future plugin design does not claim otherwise. The observation is pre-existing, source-based and nonblocking for keeping C2 Proposed/Backlog. Grey's original FAIL and candidate remain preserved in its own report; this is explicit dissent on normative adoption, not an edit to Grey.

### Conditional regression oracle

Fixture: authorized project manager, workspace connection C, A and B mapped, distinct cached tickets and KB documents, no unrelated mutation permitted. If the selected native UI contract includes unlink, invoke that actual action on A and independently reload its mapping, B mapping, C credential/connection state and retained records. A must be disabled; B and C remain valid; historical content identities remain. Repeat the same operation, race two tabs, deny an unauthorized actor, reload after lost acknowledgement, and prove ordinary linking still works. Independently test current-action authority at the effect boundary and the separate queued/in-flight fence—unmapping alone must not be advertised as physical termination. Test layers: real database/service transaction, API and authentic UI in an authorized disposable environment. **Runtime evidence: none; test remains planned and conditional.**

## C2 source gates: independent support, controls and limits

### Sequential account replacement — retain the identity gate

V47 allows one connection per organization/provider. V97 preserves that row during disconnect; both inspected callback versions replace its external account/site and credentials under the same uniqueness key. The source mirror lookup/upsert uses project/provider/external ID/source role rather than an immutable external-source generation. One active connection is therefore not sufficient evidence that a connection UUID denotes the same remote source over time. [S03 callback; S04:538–541, 580–598; S05]

Scenario: A produces issue X and a retained mirror; connection C is reused for account B where X also exists; delayed A work arrives. Required truth is distinct source history and no old event advancing B. A same-account credential renewal is the conforming neighbor and must preserve legitimate continuity. Legacy unknown source identity must remain unknown rather than be reconstructed as B. This is a **source-supported migration/identity proof gap**, already represented in C2 D03/D05; it is not a newly discovered collision or demonstrated deployed overwrite. Before using the path for the new guarantee, the native connection/source owner must qualify original-source identity, mapping/retrieval/cache/export effects, delayed work and a safe migration. Simultaneous accounts are an additional gate only if selected.

### Disconnect during awaited work — retain the effect-fence gate

`markRunning` updates by run ID without a terminal-state predicate; `failRun` and `finishRun` have active-state predicates. `processRun` calls markRunning before loading the current connection. The ticket path reads connection/input, awaits comments and possibly analysis, then can write cached summaries and enter the KB transaction. That transaction locks the project/folder mutation scope and checks destination-folder survival, but the inspected write body does not recheck the original run/source generation. [S04:194–200, 211–216, 279–288; processor 162–175, 481–525, 569–600]

Counterevidence matters: disconnect clears credentials and disables mappings; API sync admission checks connection/mapping; some terminal transitions are guarded; folder deletion has a real transactional guard. These protect legitimate paths and constrain the proposed failure schedule. They do not prove that work which already obtained its inputs cannot commit after the effective fence. Distinct project/folder and workspace/provider locks do not, by their names alone, establish a shared generation boundary. [S01–05]

Fixture and sequence: seed a permitted run and mirror A plus unaffected B; pause the worker after provider response or analysis began; commit disconnect/revocation; release the worker; inspect the authoritative run, mirror, cached summary and later projection/index effects. Also queue a run before disconnect and resume its coordinator. Required result: no forbidden post-fence native effect and no terminal run reopening; any prior authorized effect stays attributed. Positive control: same generation completes normally. Fault/non-vacuity control: deliberately remove or bypass the selected final guard in a disposable branch and demonstrate failure at the intended target-state assertion, not a timeout or fixture error. Include a physically independent external action whose outcome is unknown; retain uncertainty instead of asserting rollback. **No schedule was executed.** C2 appropriately calls this an open source-based implementation gate and does not claim a completed fix.

### Retained data — prevent an overbroad revocation oracle

S03 deliberately retains imported KB documents after disconnect. C2's refined D03/D05 now matches the necessary distinction: disconnect/installation removal changes connection/code authority; it does not by itself revoke a separate current project read grant. Conversely, historical retention cannot override a revoked reader's authority. The correct fixture has three separate events: disconnect with project read retained, grant revocation, and authorized purge. Test direct/native history, cached retrieval, indexes/embeddings, exports and derivatives against each authority state. Source-only verification of disconnect does not prove all readers implement current authorization. No source-specific retained-data ACL was invented; C2 requires a chosen profile to name its owner/migration if it introduces one.

## Mandatory lifecycle and escaped-failure sweep

The method is bound to Tesbo's native owners and this run's restricted evidence. Nesberry marketplace, payment, Medusa and production-environment assumptions were not imported.

| Dimension / mechanism | Applicable C2 families and oracle | Actual status / omission |
| --- | --- | --- |
| Happy and terminal lifecycle | J02–14: native result, removal/revocation, retained history and explicit recovery; no ownerless terminal path found in the conditional design. | **SIMULATED_ONLY**; package transitions not implemented or executed. |
| Negative paths / identity / all entrances | Q04 across J02–14: denied, stale, foreign-scope, absent prerequisite; prohibit target effect and sensitive disclosure; prove valid neighbor. | **SIMULATED_ONLY**; Jira UI/controller/API and Skills seams sampled. Full MCP/SDK/import/background/client surface enumeration and guard proof remain open. |
| Retry / unknown commit | J04–06/10–13: identical intent one receipt, changed intent conflict, receipt lookup reauthorizes, old failure preserved. | **SIMULATED_ONLY**; Skills recovery source inspected, no fault injection, all remaining command owners unverified. |
| Concurrency / final unit / generation | J03/05/09–14: current generation and serialized scope; singleton/dependency races and assignment conflicts. | **SIMULATED_ONLY / OPEN** for J11. Capacity/payment final-unit cases are N/A absent a selected capability; resource/fairness conflict remains J15, not blanket N/A. |
| Migration / historical provenance | J03/05/07/10/13: legacy nulls, old enums/configuration, source A observed then changed B, honest unknown instead of false backfill. | **SIMULATED_ONLY / OPEN**; selected migrations read, no migration, rollback or mixed-version database proof. |
| Delete / deactivate / revoke | J07/11/13/14: target scope versus shared resources, retained permitted history versus revoked read. | **SIMULATED_ONLY**; source confirms soft disconnect scope, not all derivative reader or queued-work enforcement. |
| Partial failure / causal side-effect closure | J02/04/06/09–13/15: native success/downstream failure, external commit/ack lost, renderer gone, partial composition. | **SIMULATED_ONLY**; enumerate notifications/index/export/history effects in selected implementation before claiming closure. |
| Temporal/context binding | J02/03/06/07/12/14: response A arrives while B selected; no wrong-subject content/action, draft remains under own identity. | **SIMULATED_ONLY**; this is required by current AGENTS/CLAUDE additions, not a claim every existing component is fixed. |
| Outcome-oracle integrity | J01–16: required result/readback versus status; source evidence, simulation, execution and human acceptance distinct. | Contract and report discipline applied; **runtime proof NOT RUN**. |
| Real boot / wiring / non-vacuity | Every implementation claim and consequential guard, especially J03/04/05/11/12. | **BLOCKED by authorized run scope**, not N/A. Existing source tests are not execution. No helper-only proof accepted. |
| Participation scope | Source primary or supporting; executor execution-only; report projection; method authoring guidance after assignment. | Conceptually assessed. Exchange/payment-leg-specific cases N/A: no such plugin relationship selected. Cross-profile composition remains conditional. |
| Authentic UI / unchanged behavior | Current project mapping/Skills and any selected contribution: real role/fixture/build/browser/theme/viewport; action/focus/reflow/denial/unsaved-work checks. | **SOURCE REVIEWED only where stated; BEFORE/AFTER RENDERED = no; VISUAL DIFFERENCE / INTERACTION / human comprehension = NOT RUN**. |

Branch-level omissions remain explicit: all real runtime interleavings; physical external stopping; credential rotation under provider failure; full reader/cache/export revocation; complete native/MCP/SDK/import/client parity; package hooks and distribution; migration/backfill/rollback; resource budgets and overload; authentic UI/accessibility; participant comprehension; and independently measured method efficacy. These are future proof gates, not passed tests. The selected source comparison is sufficient for this bounded documentary disposition; more optional source reading would not establish those missing runtime facts.

## Actual checks and handoff

1. Read and checked the C2 run context and manifest identity. Independently recomputed length and SHA-256 for all **15/15** listed candidate artifacts: all matched; zero mismatches. This establishes byte identity only.
2. Read all eight canonical delta diffs, relevant prior contracts and affected method changes. Inspected the unchanged charters/policy at the identities above. Canonical files were not claimed read in full.
3. Froze the 18-question initial ledger before peer exposure. Then consumed the entire 16-family Grey C1 inventory and recorded this separate C2 challenge. Grey and other reports were not edited.
4. Used pinned `git show`/`git grep` for current and historical sources. Compared six relevant Git blobs across f92/d440: **6/6 identical** for shared mapping component, sync service/processor/client, and two integration test files. Selected current LegacyService/controller/client functions were read independently.
5. Inspected the two existing integration test-source excerpts and their conflicting UI/API expectations. **Zero product tests run.** No native record or official case was created.
6. The declared `verify-documents.py` was not invoked by QA; Green's verification/signoff remains independent. QA's direct manifest check does not establish preserved-body semantics, scanner execution, CI, runtime or Graph status. Docker/Gitleaks/current-head remote CI were not inspected or run.

**For White:** accept this only as bounded source/document QA. Retain C2's source-identity and sync-fence gates, J08's missing actual UI, J15's unselected measurable policy, and J14's native-UI expectation decision. Do not adopt GREY-C01 as a corroborated Major on this evidence. No new source fix or native change was authorized/performed; those gates cannot be marked closed by merging this documentation.

**For Graph:** 16/16 Grey families have an explicit C2 oracle or named gap and native owner. This is a manually prepared mapping with zero executed acceptance receipts; no computed CLEAN or full-system coverage follows.

**For implementation QA/Purple:** when a contribution is selected and isolated execution is authorized, bind these fixtures to its real operations, complete the all-entrance/consumer inventory, preserve valid alternatives, execute discriminating positive/denied/fault/unknown controls, and capture authentic current/after UI. Native synchronization remains unperformed.

This is the frozen original QA C2 report. Later corrections or further informed review must be appended separately without rewriting this account or the initial derivation.
