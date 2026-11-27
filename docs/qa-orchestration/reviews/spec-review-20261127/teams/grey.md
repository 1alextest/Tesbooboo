# GREY TEAM RUN — Tesbo 1.4.49 C1

## Assignment, identity and bounded conclusion

**Reviewer:** `/root/grey`, independently dispatched Grey / Synthetic User Journey Team member. This is the original report, frozen before cross-review. I received the run context and assigned artifact locations without preparation notes, prescribed findings or other members' reports. I did not read other review reports. The candidate itself contains historical judgments and an explicit proposed solution; this is therefore an informed delta review, not blind discovery or an effectiveness experiment.

**Target:** the documentation-stage 1.4.49 C1 amendment in `review-candidate-v149`, against the saved v1.4.48 bodies. The exact 13 input identities are in `INPUTS.json`; its SHA-256 was checked and matches the run-context identity. Application source was inspected only through `git show` / `git grep` at `f92c3341eadc03f274becbead3b0f45d0a86539e`.

**Verdict:** the general-plugin delta provides coherent *conditional* journeys at the specification boundary. It does not select a plugin, SDK, marketplace, hosting model or implementation. I found one source-grounded **Major candidate** in an incumbent journey relevant to the proposed reuse: stopping a source connection for one project is supported by the native Jira mapping writer, but the inspected project integration screen cannot submit that transition. This is a pre-existing reuse/continuity issue, not a defect introduced by the documentation delta. It requires independent QA corroboration before Grey adopts it as a formal finding. No Critical finding was identified.

**Execution mode:** G0 specification simulation, with G1 source-grounded subtraces; no application execution. **Authentic UI baseline: NOT CAPTURED / VISUAL-BASELINE BLOCKED.** No browser observation, human comprehension result, package registration, native Run, deployed behavior, effective-method result or computed Graph CLEAN is claimed. Documentation-stage adequacy is distinct from implementation or release acceptance.

The permissions supplied by `RUN_CONTEXT.md` authorize read-only source/document review and isolated document-integrity checks. No database access, package installation, native mutation, product test or repository/candidate edit was performed. Tesbo synchronization was not performed; no callable native MCP was exposed.

## Methods and inspected scope

The unchanged methods are those recovered under `methods/` from `NesberryEnterprise/Nesberry@d83549c85a4dcd047fb40dc4fba4ec62737ab0fc`; their exact identities remain in `recovered-methods-manifest.json`. I read the full Grey charter, orchestration, executable Grey agent and `POL-GOVERNANCE-ASSURANCE-PORTABILITY/v001.md`. Nesberry's marketplace examples were not imported as Tesbo policies. The charter's targeted-regression inventory, continuation, status accounting, agent-ignorance and Major/Critical corroboration rules govern this report.

I read all eight frozen `delta/*.diff` in full, including the canonical 06 in-place distillation additions. I read candidate `AGENTS.md`, the relevant ownership/operational context in `CLAUDE.md`, and compared AGENTS, CLAUDE and the Skills governance view with exact source. CLAUDE is unchanged; the subordinate Skills view redirects the moved quality/transfer gates to canonical 06. I followed canonical 01's actor and native task/report/review requirements, FR-054–070, canonical 04's external-access/source-namespace/cross-channel contracts, and canonical 06's portable-distillation context. I read the source manifest. I do **not** claim to have read every historical line of the approximately megabyte-scale canonical package or independently revalidated the research paper's external precedent claims. The supporting research was not needed to establish the journey findings below.

### Evidence keys

All `D` references resolve within `review-candidate-v149/docs/qa-orchestration/`. All `S` references resolve at the source commit above, not the working tree.

| Key | Inspected evidence and limit |
| --- | --- |
| D00–D07 | The corresponding canonical file's full 1.4.49 amendment, as read in the frozen deltas. |
| D01-P | Canonical 01, actor table and existing task/report/proposal requirements; FR-054–070 including FR-058 execution integration and FR-059 no-install native use. |
| D04-P | Canonical 04, external project consent and §§15–16 alternate-channel/source-namespace requirements. |
| D06-P | Canonical 06 portable discovery/distillation context, both relocated quality/transfer paragraphs and the entire new precedent-transfer method. |
| S1 | `Tesbo-Frontend/components/integrations/ProjectIntegrationMapping.tsx`, full component read in non-overlapping/complementary slices; source lines 75–157, 185–224, 248–380 anchor the traced states. |
| S2 | Jira project integration page, full 20-line wrapper; `Tesbo-Frontend/lib/api.ts` lines 4099–4116; native controller Jira mapping/sync handlers around 2314–2334. |
| S3 | `Tesbo-Backend-Nest/src/legacy/legacy.service.ts`: complete `integrationDisconnect` at 14887–14935; `connectJiraProjects` and `startIntegrationSync` around 15045–15141. |
| S4 | Full V47 and V72 integration migrations; `integration-sync.client.ts` connection-loading query; `integration-sync.processor.ts` mirror lookup/upsert around 530–603. Later implementation constraints were not inferred solely from old migration comments. |
| S5 | Native Skills controller around 1757–1803; service receipt-recovery/deactivation/library region 17637–17725; selected source lines in Skills settings and `SkillAssignmentForm.tsx` for submit, approve, unassign, generation guard, pending request and receipt recovery. These are selected source paths, not a full Skills implementation audit. |
| S6 | Full `approved-run-cases.policy.ts`: current exact human-review receipt and Approved-state guard for new Run cases. Call-site completeness was not re-proven. |
| S7 | `e2e/ui/integrations.spec.ts`, INT-U-24 around 950–984; `e2e/api/integrations.spec.ts`, INT-A-41 around 1433–1449. Test source inspected; neither was run. |
| S8 | Source route inventory and targeted symbol searches for integration, knowledge, Skills, Tasks, report and Run consumers; selected matches in `WorkspaceIntegrationConfig.tsx`. An inventory match is not a full file review. |

Initial combined outputs were truncated. The complete required charters and eight diffs were reread in bounded chunks; truncated search output is used only as navigation, not as a claim of full scope.

## Independent problem and actor reconstruction

The primary job is to obtain usable, attributable engineering work inside existing project authority. A plugin is one possible contributor. The needed outcomes already divide into different native completions: source content becomes authorized knowledge; an executor produces a report and possibly separately admitted Run evidence; method content becomes an inert candidate until approval and assignment; analysis becomes attributed interpretation/proposal; a report exposes permitted evidence; an interface exposes an existing native action. These distinctions derive jointly from D01-P, D04-P and source owners, not from treating the candidate's scenario table as an exhaustive inventory.

Four discovery sources were reconciled:

1. **Actors/jobs:** project member/tester, human reviewer, project manager and workspace owner have distinct jobs. A machine's role is its effective grant, not its vendor label. The proposed plugin manager/operator labels confer no new powers.
2. **Surfaces:** existing workspace/provider settings, project mapping/sync, knowledge/requirements, Skills library/assignments, Tasks/review, native Runs/reports, REST and MCP. Future SDK/UI/plugin surfaces remain unselected. Background sync is an additional producer, not a user-visible approval.
3. **Contracts:** separate source, draft, approval, execution and evidence stages; current authority at protected effects; exact revisions; retained history; truthful unknown effects; optional/no-plugin continuity.
4. **Implementation/data:** actual workspace-level connection and project mapping ownership; source mirror keys; native Skills receipts and human governance; approved-case Run admission. A general plugin implementation is **NOT AVAILABLE** in this proposal; existing native code is available and was not treated as greenfield.

The reconciliation found a concrete **reachable through API but unreachable through the inspected native control** transition (J14). Conversely, package admission and contributed UI are **specified but not currently available** rather than undiscovered shipped features. Multiple entry channels must converge on native owners; this review does not infer that such convergence has already been implemented for plugins.

### Executable persona set

These are synthetic roles, not interviewed people or newly created RBAC roles.

| Persona | Starting knowledge, constraint and behavior | Success / abandonment |
| --- | --- | --- |
| P1, project tester/member | Knows the work to test and project; uses visible navigation, not hidden APIs. Needs source context or a valid core alternative. | Finds current permitted source/result and can continue; abandons on a required capability with no intelligible next action. |
| P2, integration manager | Acts only with actual project/workspace permissions. Has two projects using one connection; wants a narrowly scoped change. Reads impact before committing. | Changes only the intended scope, preserves other work/history; refuses an unexplained workspace-wide substitute. |
| P3, human reviewer | Knows the accepted expectation and owns the relevant protected decision. Does not assume a package, grade or report is approval. | Reviews exact basis and reopens the authoritative outcome; fails if a changed basis inherits approval. |
| P4, delegated executor/analyst | Knows assigned task/grant, not hidden project state. Can lose connectivity and receive stale work. | Performs only current permitted effects and submits attributed evidence; stops with explicit unknown/refusal when reconciliation is unavailable. |
| P5, authorized reader/operator | Needs historical interpretation or diagnosis; may lack original source access. Searches current permitted evidence. | Understands observed status and retained result without leaked derivatives; abandons a misleading success/stop signal. |
| P6, engineering author/reviewer | Can inspect code and prior decisions for research, but has no authority to choose the unselected runtime or activate a Skill. | Makes a supported adopt/adapt/reject/defer/no-change decision with proof limits; fails if research is promoted into permission or measured benefit. |

## Targeted journey inventory and crosswalk

This is an accountable inventory of the material **changed/affected journey families**, not full-product assurance. Failure variants do not inflate the denominator. `HOLDS` means the available contract/source supplies the stated transition at its declared evidence tier; it does not mean an executed acceptance test passed. All rows share this review's non-executing environment. H = high risk, M = moderate. No Critical-risk journey was separately classified.

| ID / job / risk | Actor, start, entry and ordered ownership trace | Expected / forbidden outcome; mode and recovery | Status / result / evidence |
| --- | --- | --- | --- |
| J01 Choose a useful capability, M | P1 has a task, no selected plugin. Native work surface or supported external client → existing owner/capability → task outcome. | Existing/manual route can suffice; no forced package, local companion or invented fallback. Happy, low-knowledge, unavailable-optional. | `G0_SIMULATED` / HOLDS / D00–03, D07, FR-058–059. |
| J02 Connect and consume one source, H | P1/P2, permitted current single-provider account, no project mapping. Project provider screen → workspace connection if necessary → project mapping → queued sync → KB/native requirement navigation. | Authorized current project gets attributable mirror/result; connected/queued/partial are distinct. Source bytes do not approve a case. Failure exposes reconnect/remap path. Happy, negative, handoff. | `G1_CODE_GROUNDED` / HOLDS at inspected source/contract boundary / S1–4, D02–04. |
| J03 Change source identity without corrupting history, H | P2, prior connection/source and retained mirror; optionally two accounts with equal external ID. Configure/import or delayed background event → native connection namespace/generation → mirror and retrieval. | Old event cannot write replacement namespace; old output remains attributable; current single-provider use preserved. Mutation, collision, late event. Multi-account path waits for selected cardinality/migration. | `G0_SIMULATED` / INCONCLUSIVE for unselected cardinality / D03 conditional migration gate, D04-P, S4. |
| J04 Obtain trustworthy external execution, H | P1/P4/P3, approved task scope, verified executor capability. Task/MCP handoff → claim/attempt → evidence/report → analysis/review → separately authorized native Run. | A report does not create approval, alter expected results or prove a Run occurred. Expiry/reassignment stops stale authority; unknown external completion is reconciled. Happy, denied, retry, longitudinal. | `G0_SIMULATED` / HOLDS as contract / D01-P, D02–05; S6 only corroborates native Run gate. |
| J05 Adopt method content deliberately, H | P3/P6, imported/unapproved method and current project authority. Skills candidate → exact submission → human approval → selected assignment → governed use/history. | Import/grade never activates; changed content has new review basis; unauthorized machine cannot approve/assign. Unassign changes assignment, not historic approval. Happy, denied, stale. | `G1_CODE_GROUNDED` / HOLDS for inspected governance seams / S5, D03–04, D06-P. |
| J06 Turn analysis into reviewed work, H | P4/P3, source/report and known expected basis. Attributed analysis → native proposal → exact revision review → protected apply/readback. | Inference remains inference; actual result/expectation/approval independent; conflict requires rebase/re-review without losing original evidence. Happy, negative, conflict. | `G0_SIMULATED` / HOLDS / D01-P, D02–04. |
| J07 Read/export results with truthful history, H | P5, historical result with allowed read scope; optional renderer removed or source access revoked. Report/native record/evidence reader → current authorization → permitted rendering/export destination. | Keep permissible result interpretable; unavailable/redacted source explicit; no revoked snapshot, secret, inferred PASS or unauthorized destination. Trust, denial, historical. | `G0_SIMULATED` / HOLDS as obligation / D02–05, D04-P. |
| J08 Complete a contributed UI action accessibly, H | P1/P3, a selected native module and admitted UI contribution would be required. Actual placement/control → server action → native receipt → return/history. | Visible action must communicate scope and retain keyboard/focus/context; no cosmetic action or false readiness. Exact path cannot be walked because no profile/UI is selected. | `BLOCKED_MISSING_CAPABILITY` / NOT_ASSESSED / D07 explicitly defers UI; White/Purple continuation gate. |
| J09 Admit compatible contributions, H | P2, existing incumbent/provider/dependencies. Selected packaged entrance → native admission → cardinality/composition → usable operation. | Unknown/cyclic/conflicting required basis refused before effects; singleton incumbent unchanged; ordered partial result explicit. Boundary, conflict, partial failure. | `G0_SIMULATED` / HOLDS as conditional contract / D01, D03–05. |
| J10 Upgrade or reconfigure knowingly, H | P2/P3, approved release/configuration and dependent work. Impact preview → exact authorized change → migration/readiness → native readback. | Permission growth cannot borrow stale approval; narrowing fences old work; failed migration remains recoverable/blocked, not healthy. Mutation, interruption, downgrade. | `G0_SIMULATED` / HOLDS / D01–05, D07. |
| J11 Revoke work and understand stopping limits, H | P2/P4, queued/native/external work at three effect boundaries. UI/REST/MCP/job request → current grant/generation fence → native refusal or attributed reconciliation. | No new stale effect; external unknown is not rolled back or physically stopped by assertion; completed receipts remain. Race, denial, external failure. | `G0_SIMULATED` / HOLDS as obligation / D01–05; S3 shows existing disconnect has its own scope. |
| J12 Recover a lost acknowledgement, H | P3/P4, exact operation may have committed; same actor/project and request intent retained. Receipt lookup → current authority → original result or continued uncertainty → permitted identical retry. | One logical effect; changed payload conflicts; no foreign receipt; separate legitimate operation stays distinct. Retry, revocation, context switch. | `G1_CODE_GROUNDED` / HOLDS for selected Skills recovery seam; plugin generalization unexecuted / S5, D02/D04–05. |
| J13 Remove/purge/reinstall with bounded effects, H | P2/P5, installation with dependents and retained records. Impact → owning removal → retained readback; separately authorized purge/reinstall. | Shared resources survive; historical permissions still enforced; revoked grants/deleted data do not revive. Removal and data rollback not conflated. Longitudinal, denied, failed removal. | `G0_SIMULATED` / HOLDS as contract / D01–05, D07; S3 gives native retention counterexample to delete-everything. |
| J14 Stop one project's source while preserving neighbors, H | P2, Jira connected to workspace and mapped into projects A/B. A settings → Clear selection → attempted save/unlink → desired A mapping disabled. | A loses its active mapping; B, workspace credentials and retained history unchanged. Native UI cannot submit the empty selection; REST writer supports it. Recovery must not disconnect entire workspace. | `G1_CODE_GROUNDED` / FAILS for inspected UI trace / S1–3, S7; candidate GREY-C01. |
| J15 Diagnose degradation and recover service, H | P5/P2, slow/crashed contribution, backlog or unavailable required dependency. Health/current operation → correlated release/configuration evidence → bounded recovery or core continuation. | Unknown health stays unknown; support can attribute failure without secrets; no unlimited resource consumption or false failover. Load, stale data, partial dependency. | `G0_SIMULATED` / INCONCLUSIVE for quantitative outcome: budgets/support policy unselected / D03/D05. |
| J16 Improve an engineering decision using evidence, M | P6, meaningful capability/repeated failure; existing guidance and source. Outcome/owner → precedent and contrary evidence → conditional principle → target decision → future discriminating check/feedback. | A valid no-change/defer is retained; text/grades do not activate rules or certify benefit. Unlike case, alternative cause, unknown evidence. | `G0_SIMULATED` / HOLDS for method semantics / AGENTS principle 1, D06-P, D05. |

### Crosswalk to the amendment and participation contexts

| Amendment concept / actor / surface | Journey coverage |
| --- | --- |
| Source/knowledge; workspace owner and project member; provider settings, sync, KB, retrieval | J02, J03, J07, J11–14 |
| Executor; member, worker and reviewer; native Tasks, external MCP, reports, Run admission | J01, J04, J06, J11–12 |
| Method/content; author, human reviewer and assignee; Skills/native authoring | J05, J12, J16 |
| Analysis/verification; analyst and reviewer; evidence, proposal and native review | J06, J07, J16 |
| Report/export; authorized reader and recipient/destination boundary | J07, J13, J15 |
| Product/UI; current module user and server action owner | J08, plus contextual native source trace J02/J14 |
| Release/admission/dependencies/order/upgrade/configuration | J03, J09–10 |
| Scope/authorization/fencing/late effects/receipts | J03–07, J10–14 |
| Retention/purge/reinstallation/renderer loss | J07, J13–14 |
| Health/observability/budget/optional degradation | J01, J02, J09, J15 |
| Research/maturity/distillation/no-change/adoption boundary | J01, J16 |

Participation is different by profile: source intake is primary when importing knowledge but a supporting input to a task; an executor is execution-only for a previously authorized task; a report is a projection over native evidence; method content governs authoring only after its own admission. An exchange/payment-leg model is N/A: no such plugin business relationship is selected. A source picker, task handoff and report therefore do not inherit one universal marketplace screen.

## Significant conceptual traces and forbidden effects

### J02 — source intake continues beyond “connected”

1. P1 arrives at project A's provider settings to obtain test context. Source shows a missing workspace connection with either Connect, a return-preserving workspace-settings link, or an instruction to ask the workspace owner, depending on current capability/configuration.
2. Once connected, P1 selects a remote project. A successful mapping is only the prerequisite for sync; it is not a knowledge receipt.
3. P1 starts sync. Source represents an already-running operation as existing progress rather than a second success. Native start checks project access, entitlement, connection and enabled mapping.
4. P1 follows View Knowledge Base, or the Requirements link available after succeeded/partial sync. Partial is not interpreted as all records imported. Mirroring uses its native source identity and preserves source ownership.
5. The future connector must additionally establish the exact retained source revision and current permitted retrieval before analysis; imported content cannot approve its derived case. No new plugin-specific execution was inferred from this current source path.

**Synthetic feedback:** “Connected tells me the account is available; I still need to know what arrived in this project and what failed.” **Result:** coherent native route identified; actual bytes, current rendering and all permission paths remain unexecuted.

### J04/J05 — two different completions

For the executor, the trace is task scope → authorized attempt → report/evidence → independent interpretation → protected review → separately admitted Run. S6 explicitly requires an Approved case and current exact human-review receipt for a new case association. It does not prove an external executor contract or actual observation.

For method content, the trace is imported draft → submitted immutable basis → human approval → assignment for the selected context → use/history. Inspected Skills source exposes these separate operations; the UI text says a submitted candidate stays inert until human approval. Receipt recovery checks current human authority and request ownership. Importing a package with a familiar name cannot replace these steps.

**Synthetic feedback:** executor requester: “I need evidence of what happened, not merely a received report.” Method reviewer: “I need to approve this content before it changes how my project is authored.” **Forbidden:** either contribution treating its own output as approval or execution evidence.

### High-risk escaped-failure and alternate-entry challenge

These are conceptual probes, not executed fault injections. They supplement the inventory rather than create new jobs.

| Failure family and applicable journeys | Concrete sequence and authoritative oracle | Evidence disposition |
| --- | --- | --- |
| Late response after context switch — J02/03/06/07/12 | Start request in A, move to B, deliver A's old response. B's selection/draft/result must stay B; accepted A work retains A identity and permitted readback. A delayed source event after reconnect targets its original generation, never replacement source. | Simulated. Skills generation/receipt guards inspected; all native/plugin counterparts not audited or run. |
| Ambiguous commit and retry — J04/05/06/10/11/12/13 | Operation K may commit, response disappears; query K with current actor/grant before replay. Authorized same intent has one native effect/receipt; changed intent conflicts; revocation denies sensitive lookup. External uncertain effects stay unknown until approved target readback. | Simulated. Skills receipt ownership source provides a real reference seam, not general plugin proof. |
| Valid action changes secondary record — J02/03/05/06/09/10/11/13/14 | Begin A and unaffected B. Unlink A, unassign one method scope, replace one package or remove its owned resource. Only declared target/dependency closure changes. B, shared credential and unrelated approved records remain identical. | Simulated. J14 exposes a concrete native UI dead end; workspace disconnect demonstrably has wider scope. |
| Alternate writer/transport — J02/04/05/06/07/11/12/13/14 | Compare native UI, applicable REST/MCP, background callbacks and direct receipt/evidence lookup. Current authorization must hold at effect/read boundary despite hidden controls or cached discovery. | Contract challenge performed. Jira REST/UI and Skills controller/service seams inspected. General plugin paths unselected; no all-writer implementation certification. |
| Admission/load-order/dependency failure — J09/10/15 | Add conflicting singleton or failing ordered member; then change a required dependency. Incumbent and independent work remain; admitted output is stable order or explicit partial/failure, not whichever provider loaded last. | G0 simulated; packaging/runtime/threshold proof blocked until selected. |

J08 cannot receive an actor-visible UI counterexample until an actual contributed surface exists. For J15, a numeric latency/fairness oracle is intentionally unresolved until the selected workload and support policy supply it. For J01/J16, native mutation/replay is N/A to the research/no-change step itself; if those decisions cause later writes, the relevant J05/J09–13 transitions apply.

## Candidate finding and counterevidence

### GREY-C01 — Project-specific source unlink is not reachable from the inspected native screen

**Severity:** Major **candidate**, pending independent QA corroboration; no adopted Major/Critical team finding yet. **Category:** broken flow / hidden capability / scope mismatch. **Evidence:** CODE-PROVEN control-flow restriction, with user consequence a source-grounded synthetic hypothesis. **Origin:** unchanged incumbent source, adjacent to the delta's reuse/removal/no-plugin promises. It is not a regression created by 1.4.49 C1.

**Persona / goal / initial state:** P2 has sufficient native access to manage project A's mapping; workspace Jira connection also supports project B. Stop feeding A without disconnecting B or deleting historical source material. The source API accepts the specific operation. The persona knows the visible product, not the empty-array API encoding.

**Trace:**

1. Enter A's actual `/projects/[id]/settings/integrations/jira` route. Its wrapper supplies the shared mapping component and native `connectJiraProjects` client.
2. The existing linked remote item is selected. Choose **Clear selection**.
3. The component sets `selectedId` to null. Its only mapping-submit button has `disabled={saving || !selectedId}`; no clear/unlink submit control appears elsewhere in the complete inspected component.
4. The handler contains an empty-list branch and an “unlinked” success message, but that branch is unreachable through the normal enabled button for an empty selection. The native writer accepts `{ projects: [] }`, disables A's mappings and returns `linked: 0` while retaining history.
5. The available workspace disconnect path is not an equivalent recovery: `integrationDisconnect` clears the workspace/provider credentials and disables every mapping fed by that connection. P2 cannot use it without changing the intended scope and affecting B.

**Expected authoritative before/after:** A enabled mapping → disabled; B mapping and workspace connection remain active; cached tickets/KB history retained. **Source-predicted actual:** clearing changes only local selection; no mapping write; A's persisted link remains. No physical mutation was observed in this review.

**Synthetic user voice:** “I only want this project to stop using that source. Clearing the choice leaves me unable to save, and disconnecting the workspace would affect other work.” This is a simulated utterance, not human research evidence.

**Counterevidence / legitimate alternative:** INT-U-24 intentionally asserts that empty selection disables the Link button. It is therefore unsafe to assume Clear selection was designed as unlink, or to call this a new accidental regression. INT-A-41 establishes that project unlink is a supported native API contract in test source. A capable API user has a workaround; the desired native-screen outcome is not thereby reachable for P2. This review has not established every possible alternate UI in the entire application, nor verified deployed pixels. These limits may reduce the final severity or lead the product owner to record an intentional UI exclusion.

**Delta implication:** D02/D03/D07 correctly require task completion, bounded removal and preservation of other work. No wording change is necessarily required to state the invariant again. The issue belongs in the existing implementation/reuse record before a selected source profile is called complete; the baseline cannot be described as already supplying a usable project-scoped removal path merely because its API exists.

**Recommended owner and check:** QA independently trace the exact route and corroborate the source restriction; Blue confirm alternate entrances and native scope; Purple assess the understandable action; product owner decide if native unlink is intended. Under a later authorized isolated runtime, compare a project unlink with workspace disconnect while preserving project B and history. Include refusal, reload, same-operation retry and the existing legitimate link action. Do not fix code or execute against real project data as part of this documentation review.

**Regression candidate:** drive an explicit project unlink from the selected native UI; independently read A/B mapping and connection state; prove retained records and no B effect. Existing tests for disabled selection and API unlink do not establish this end-to-end outcome. **Disposition now:** report and route; not a blocker to retaining a Proposed/Backlog specification, not permission to implement a repair.

## Rejected concerns and remaining gates

- **“Plugins bypass native approvals.”** Rejected as a delta finding: D01–04 explicitly retain native authorities, and inspected Skills/Run seams demonstrate relevant owners. Complete runtime enforcement remains unverified.
- **“Obsidian or arbitrary code was selected.”** Rejected: the amendment explicitly leaves initial profile, distribution, runtime and hosting open; content/remote APIs can satisfy an outcome without executable plugins.
- **“Two example profiles prove all plugin outcomes.”** Rejected as an asserted claim: D05 says unlike design traces are not selection of both implementations and do not qualify every profile. My UI and overload gaps remain explicit.
- **“Retain history means retain access forever.”** Rejected as a contract reading: D03/D04 preserve permitted history while applying current access to snapshots, caches, embeddings and derivatives. A historical receipt is not a new grant.
- **“The new research method has demonstrated benefit.”** Rejected: D05/D06 separate proposed method, implementation and independent effectiveness. This informed review supplies no causal comparison.

No separate marketplace/distribution/payment job was invented: the owner has not selected those products. No demographic preference or adoption-demand claim follows from these personas. Mobile/screen-reader/keyboard/error-copy comprehension is applicable to any selected actual surface but remains unobserved. Resource thresholds, hosting containment, distribution packaging, multi-account migration and all cross-channel implementation proofs remain future gates attached to their relevant owners.

## Coverage and handoff accounting

| Scope | Inventoried | Simulated | Observed G2/G3 | Blocked | Unreviewed inventory rows |
| --- | ---: | ---: | ---: | ---: | ---: |
| Targeted changed/affected families | 16 | 15 | 0 | 1 | 0 |
| High-risk subset | 14 | 13 | 0 | 1 | 0 |
| Critical-risk subset | 0 | 0 | 0 | 0 | 0 |

The 15 simulations comprise **11 G0** and **4 G1_CODE_GROUNDED** rows. Results are **12 HOLDS**, **2 INCONCLUSIVE**, **1 FAILS**, **1 NOT_ASSESSED**. The blocked row is J08; no material row was silently dropped. G1 here is code-grounded simulation, not a product test. This denominator measures journey families accounted for in a targeted delta review, not all role × channel × state combinations or complete Tesbo coverage.

**White-owned continuation:** keep J08 visual/native action proof blocked until a selected contribution and authentic runtime exist; keep J03 migration/cardinality and J15 workload/support decisions explicit. Preserve all later runtime/accessibility/comprehension/packaging/authority proofs as NOT RUN. Do not retroactively satisfy the earlier pre-architecture gates from this post-proposal review.

**QA handoff:** independently corroborate GREY-C01 before any Major adoption; retain its pre-existing/source-only classification. Carry the late-context, ambiguous-commit, secondary-record and alternate-writer oracles into the selected implementation's existing test owner. No new official native Test Case IDs were minted.

**Graph handoff:** map D01–07 to the native source, task/report, Skills, approval, Run and permitted-reader owners above; distinguish future links and manual review from executed enforcement. **Purple handoff:** authentic baseline and user comprehension remain blocked; the inspected source does not establish accessible rendering.

**Verification actually performed:** read-only exact-source/doc inspection; original/candidate comparison of method entrypoints and subordinate view; full eight-diff inspection; INPUTS manifest SHA-256 check; targeted test-source reading. No runtime acceptance, full hash audit, external precedent verification or efficacy measurement was performed.

The suitable disposition is **JOURNEYS HOLD AT THE PROPOSED SPECIFICATION BOUNDARY, WITH AN INCUMBENT JOURNEY-GAP CANDIDATE AND EXPLICIT IMPLEMENTATION GATES**. For any running-plugin, visual-parity or release claim the disposition remains **INSUFFICIENT RUNTIME EVIDENCE**. The original report ends here; informed changes should be appended separately without rewriting this account.
