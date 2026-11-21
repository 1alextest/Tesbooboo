# Blue Team member B — original cold receipt

**Run:** GEX-ASER-2026-11-19  
**Candidate:** 1.4.29-candidate-v1  
**Member:** `/root/blue_member_b`, independent analytical invocation, not the specification author and not member A  
**Review date:** 2026-11-20 UTC  
**Receipt state:** ORIGINAL / FROZEN at completion; subsequent discussion or corrections require a separately identified delta  
**Authority:** unchanged Blue Team charter v2.7, Active, and the pinned review orchestration; this receipt does not amend either method.

## 1. Member disposition and decision boundary

**The covered target design is directionally coherent and should EXTEND EXISTING SUBSTRATE and COMPOSE existing Tesbo owners.** Source inspection supports reuse of native case, task, run, observation, source-binding, model-revision and graph-history mechanisms. It does not justify another QA application, graph truth database, model authority, executor, approval ledger or published-case store merely because the amendment uses new labels.

I record **one open Should-Fix implementation-grounding finding**, GEX-ASER-BB-B01: make the current Model Studio writer-to-target transition explicit, including its approval principal, latest-head selection, direct native Draft conversion and transaction boundaries. These are concrete differences between the pinned implementation and the already-specified target. They are not evidence that the new target semantics are implemented, and they are not a newly discovered omission of the target's human-approval, staging or atomicity requirements. I found no independently established new Must-Fix requirement defect within this bounded read. That is not an exhaustive no-defect certificate.

**Do not freeze an implementation/runtime conclusion from this receipt.** Numeric exposure budgets, complete all-writer convergence, deployed schema, protected operation failures, actual native journeys, authentic current UI rendering, actual method admission, and generalization experiments remain unproved. For those claims the applicable disposition is **INSUFFICIENT REPO EVIDENCE — DO NOT FREEZE** until the named evidence is supplied. Source availability itself is not deficient for the files examined; deployment and some broader consumer coverage are.

This is one member's receipt. The charter requires two actual members, including one independent of authoring, for a formal Blue verdict. I do not infer another member's vote, Red's premise-falsification result, White's gate decision, a Grey full journey assessment, or the user's operational approval. No other reviewer output was read. The architecture is already proposed: this retrospective archaeology cannot certify that a pre-architecture gate occurred chronologically before design.

## 2. Identity, evidence modes and independence

### Pinned identities

- Input root: `/workspace/scratch/ce8c3109f396/assurance-run-20261119/input-v1`.
- Manifest and `RUN-CONTEXT.md` were read before the substantive review. The eight `canonical/` documents are primary; the six `views/` documents are subordinate.
- Application: `1alextest/Tesbooboo`, commit `6897f989b055a955280f810c7daace86f74057fa`, Git object database `/workspace/scratch/307cd95373fe/tesbo`. All application reads used that exact revision with `git show`, `git grep` or `git ls-tree`; the mutable worktree was not the reviewed source.
- Subordinate-view source identity in the manifest: `b906a22ae84e170061a9e19ab37063e6f58b608d`.
- Method source: `NesberryEnterprise/Nesberry`, commit `d83549c85a4dcd047fb40dc4fba4ec62737ab0fc`, recovered at `/workspace/scratch/ce8c3109f396/assurance-source-recovery/Nesberry-d83549c85a4dcd047fb40dc4fba4ec62737ab0fc`.
- Blue charter bytes: 21,977; SHA-256 `1d6d78da69b3c55533740005a48082b6fc5f27c620ce66f50917fd180523c816`.
- Orchestration bytes: 45,630; SHA-256 `8fd41f22e1909afd48d8af95120d03a0f52e30a1bf9976a639fb6cca67bb4729`.

The archive hash `6094687758ebf1e5dfa3c6ed8e2209b8967a190523815ba1e1197d11867374ef` in the manifest identifies the recovered predecessor archive. I do not present it as an aggregate hash of candidate v1. All 14 current input byte lengths and hashes were independently checked and matched; the exact list is in Appendix A.

### Evidence modes

| Mode | Actually available or invoked | Permitted conclusion |
|---|---|---|
| Document inspection | Current amendment in all eight canonicals, relevant earlier policies/contracts, six views, original method, source operational instructions | Target contract, intended owner, planned acceptance, declared gate |
| Pinned source inspection | Named backend/frontend/manifests/migration below | Implemented source structure and source-inferred behavior; not deployment or live outcome |
| Bounded G0/G1 reasoning | Independently derived journeys, counterexamples and ownership checks below | A contract can account for a case; not a product test pass |
| Isolated exact-source function execution | Parser/generator probe described in §10 | Those pure functions met the listed assertions under the synthetic input and host Node runtime |
| Not supplied/not run | Running target, deployed DB, current UI capture, real users, full application test suite, concurrent/failure injection, production auth, cross-model reviewers, G2/G3 evidence | UNKNOWN/BLOCKED, not inferred from source or prose |

No application code, schema, remote data, input document, skill or operational policy was changed. No application was started; no shared database tests, live provider operations, messages, deployments or merges were performed. The root repository operational instructions identify shared infrastructure as a test hazard; this review remained read-only apart from its own scratch receipt and isolated in-memory harness. Historical judgments embedded in the canonical history were not adopted as verdicts. Separate historical review records, author retrospective files and other reviewers' receipts were not opened.

## 3. Independent problem reconstruction

The user's job is to obtain a useful, reproducible test decision from incomplete information, execute the relevant test through an authorized human or external executor, and preserve a trustworthy connection between the expected behavior, the tested definition, the actual observation and the eventual accepted change. A code graph is useful when it narrows that work or reveals an uncertainty. A method is useful when it improves a decision without assuming the decision's authority. Neither is necessary for every legitimate manual test.

The material actors are the tester, source/requirement authority, case reviewer, delegated coding or authoring agent, external executor with its own target driver, method owner, integration/provider, and release decision owner. Authentication of a request, authorship of an observation, authority to define an expectation, and authority to approve an operational change are separate facts. A human-associated API token cannot silently establish all four.

The irreducible truth distinctions are: accepted expectation versus observed implementation; proposed case versus published native case; current authored definition versus the definition actually exercised; generated path versus performed action; raw observation versus reviewed conclusion; approved method version versus its current scoped assignment; local inventory completeness versus external freshness; and evidence of coverage versus a visually reassuring rollup. These distinctions are derived from the QA task and corroborated by D00 P07/P17/P18, D01 R-ASE-06/13/21–48, D02 C-02, D03 C-12 and current amendments, and the source observations below.

Two workflows must remain independently complete. A tester may create and execute a meaningful manual test without code, model, CI or a configured executor. Separately, the original case-free workflow must still allow a ChatGPT-origin task, a registered external executor's immutable report/evidence, analysis, a linked new retest and selected human apply. A successful modeled-run demo cannot substitute for either exit.

### Independently generated review questions and journeys

| Journey/question | Required outcome or refusal | Candidate accounting | Evidence status |
|---|---|---|---|
| A tester has a requirement and no repository/model/CI | Capture actor, setup/data, action, expected result, cleanup and source; manual observation is legitimate | Current D01–D07 manual-first amendments and native Cases/Runs | Target represented; native source inspected in part; end-to-end unrun |
| An executor starts from a task with no existing cases | Preserve original report/evidence, analysis, linked retest and selected apply, without a model/key prerequisite | D00 original workflow; D02/D05 current preservation | Required; no external execution proof supplied |
| Code changes but the requirement is uncertain | Return impact/unknown and a clarification proposal; do not convert implementation into the expected oracle | D01 FR-115–119; D03 independent graph views | Source candidate nominations narrower than target; intended refusal is coherent |
| Approved revision r1 is active when draft r2 is saved | New CURRENT work continues to use r1 until a separate authorized activation changes it | D02 C-02; D03 C-12 | Target clear; pinned source uses latest head and therefore needs migration |
| A write-scoped API token calls model approval | Request identity must not count as the independent human action required by the target | D01 R-ASE-34; D04 C-03; MBT-AC-36 | Source guard/controller show a convergence seam; live exploit not attempted |
| Case generation succeeds but provenance insertion fails | Either protected native effects and mandatory provenance commit together, or none do | D01 R-ASE-13; D04 C-03 | Source split transaction risk inferred; no fault injection |
| A method is unavailable or revoked while a tester reports a failure | Preserve authorized raw observations; block only operations that require the missing governed method | D01 R-ASE-21–36; D03 resolver contract | Specified; resolver/runtime not demonstrated |
| A graph is locally complete but a provider is stale or a repository slice is missing | Expose partial/unknown scope and freshness; no zero-impact or global completeness assertion | D03 GEX source classes; D04 result bounds | Existing candidate builder explicitly says upstream freshness unverified |
| A passed result belongs to an earlier build, fixture or case revision | Retain historical result; avoid carrying it forward as witnessed current coverage | D03 exact obligation/build/actor/fixture binding; D04 context manifest | Target represented; no current verification proof |
| A Bug is linked to an execution | Preserve observation and review history rather than silently rewrite accepted historical truth | D03 source convergence/attempt contracts | Existing side effect independently confirmed; already named by target |
| A suggested method or AI profile performs no better than a simpler incumbent | No-change, simpler alternative, rejection or unknown is a valid outcome | D05 evaluation amendments; D06 candidate principle limits | Designed comparison only; no generalization result |
| A proposed relationship crosses project scope or resolves a deleted/ambiguous identity | Deny/unknown; never relink by title or silently select a convenient revision | D03 C-12/typed same-project contracts | Source has project checks; complete cross-entrance proof unrun |

These are this member's own bounded cases, not a replay or adoption of an earlier journey inventory. They are not a claim to enumerate every affected Tesbo journey.

## 4. Semantic Completeness Matrix

| Problem dimension | Evidence | Target application representation | Disposition | Owner/gap |
|---|---|---|---|---|
| Human-readable, reproducible manual test | D01/D02/D07 current amendment; native case and execution source | Native Test Case with concrete actor/setup/action/expectation/cleanup; native execution | REPRESENTED | Case/result owners; complete new manual journey unrun |
| Original case-free external execution | D00 original workflow, P07/P17/P18; D05 preservation | Task → immutable executor report/evidence → analysis → retest → selected apply | REPRESENTED | Existing task/executor/report owners; outside executed proof |
| Independent accepted expectation | D02 C-02; D03 C-12 | Versioned family/revision with distinct approval and active selection | REPRESENTED | Existing Model Studio substrate needs explicit migration reconciliation |
| Implementation observation and change impact | Graph coordinator/binding/history/candidate source; D03 current amendment | Pinned capture, typed relationships and bounded impact projection | REPRESENTED | Existing graph/source owners; general code dependency parser not demonstrated |
| Test applicability without a model | D01 current manual-first clauses | Native case with explicit source and applicability | REPRESENTED | No mandatory modeled path allowed |
| Agent/principal authority and human assent | Request type, global token guard, model controller; D04 C-03 | Shared operation policy and exact human action proof | REPRESENTED | Current model approval path is a migration/admission gap |
| Historical definition and raw observation | Native cycle/automation/result source; D03 attempt extension | Immutable attempt/provenance plus current effective projection | REPRESENTED | Deployed migration and immutable-path proof unknown |
| Method version, assignment, context and influence | D01 R-ASE-21–36; D03 skills contract; D04 manifests | Governed version/assignment and input/output context manifests | REPRESENTED | Resolver and every native consumer remain specified/partially planned |
| Feedback and causal learning | D03/D05 current feedback clauses | Scoped feedback/candidate versions with independent comparator/oracle | REPRESENTED | Improvement/cause not established by repeated output |
| Release readiness | D01 R-ASE-37–48; D04 C-05 | Derived state across applicability domains, distinct from approval | DERIVED | No release approval implied by settled/proven/no-issue labels |
| Load, latency, queue, retry and provider budgets | D01 NFR-012; D04 C-06 | Measured, approved per-operation envelope before exposure | DEFERRED | Numeric values and actual recovery/soak proof required at implementation admission |
| Existing UI parity and accessibility | Pinned owning routes and tokens; D07 | Extend native pages and shared components | UNKNOWN — NEEDS EVIDENCE | No actual pinned render/viewport/role/theme/a11y run |
| Arbitrary concurrent/timed executable model language | Preview/parser source and D03 versioned semantics rules | Unsupported semantics rejected; future accepted bounded schema separately versioned | INTENTIONALLY EXCLUDED | Do not infer silently supported guards/effects/concurrency |
| General-purpose autonomous target runner | Native model run source; D00 external executor contract | Existing registered executor/adapters own target action | REPRESENTED ELSEWHERE | Model dispatch itself only creates native Run |
| A universal superior QA method | D06 explicit candidate status and orchestration distillation | Held-out different-context evaluation before admission | UNKNOWN — NEEDS EVIDENCE | No installation/promotion or general superiority claim admissible |

Nothing above establishes that the concept set is complete merely because existing storage is reusable. Conversely, absence of deployed proof does not erase the conceptual requirement.

## 5. As-is owners and Capability-Reuse Matrix

The as-is source shows a Next/React frontend and Nest/pg/BullMQ backend, native Test Cases, Runs/Executions, Bugs, Requirements/KB and Tasks/Agents, a project source-binding and current-cache graph capture path, and Model Studio draft/revision/approval/generation/native-run mechanisms. Backend `DatabaseService.transaction` obtains its own client for each call; transaction composition therefore requires explicit client flow. Native case creation already has a client-taking seam inside `LegacyService`. These are materially reusable facts; similar nouns alone are not.

`PARTIAL` below means relevant implementation was found but required target semantics and/or live evidence are incomplete. It must not be read as `BUILT+LIVE`. No deployed state was proved, so no live maturity label is assigned.

| Required capability | Existing owner | Maturity | Reusable | Extend | Extract | Missing | Evidence |
|---|---|---|---|---|---|---|---|
| Project-authorized pinned source capture | Project source binding/coordinator/history | PARTIAL | Authorization, checkout allowlist, same-client history, comparison continuity | Immutable binding generations, full intended adapters/partial reporting | Only if concrete shared parser/adapter need arises | Provider freshness and watcher runtime proof | `project-source-binding.ts`, coordinator, history; D03 GEX |
| QA change candidates | `qa-review-candidates.ts` over native cached references | PARTIAL | Conservative candidates and no-coverage/no-execution assertions | Typed bounded dependency/trace traversal | No new graph store shown necessary | General code dependency graph and complete impacted-consumer proof | Candidate source; D03 current amendment |
| Expected model identity/revisions | Existing Model Studio repository and mbt model tables | PARTIAL | Persisted model/revision IDs, parser, approvals | Separate active selection, scope, migration correspondence and exact principal | Shared policy/resolver, not second expected registry | Target active pointer and machine-resistant approval path | Repository/controller/V153; D02 C-02; D03 C-12 |
| Bounded path planning | Pure parser and generator | PARTIAL | Deterministic supported sequential paths and explicit exclusions | Accepted versioned guards/data/negative obligations if justified | Optional shared pure validation | Target richer semantics, target execution and verified coverage | Exact-source probe; parser/generator |
| Published native cases and review | Legacy case/version/approval and existing review/staging contracts | PARTIAL | Native IDs, steps, approval CAS and client-aware insert seam | Route model proposals through shared unpublished staging and exact selected apply | Share client-aware mutation/policy helpers where warranted | Uniform cross-entry admission and rollback proof | `legacy.service.ts`, model repository; R-ASE-06/13/34 |
| Native runs/manual observations | Legacy cycles/executions; automation actor/result service | PARTIAL | Native run membership, snapshots, manual result UI, automation attribution | Immutable attempt/correction/manifest convergence | Shared policy/client-aware services | Full history and simultaneous/failure-path proof | Legacy/automation/model-run source; D03 attempt contracts |
| Knowledge and requirement consumers | Existing KB/recent/search/RAG and native Requirements | PARTIAL | Canonical read/write owners and existing links | Governed immutable submission, stale context/permission checks | Reuse existing adapters | Every native/machine/import reader/writer not traced here | Selected KB source and symbol sweep; D03 §18 |
| Effective testing method resolution | Proposed skills version/assignment resolver over existing settings/agent/KB contexts | SPECIFIED ONLY | Reuse identity, settings, context and review infrastructure | Exact resolver, immutable effective context, conflicts/revocation | Shared resolver when implemented | Installed resolver, root admission and all-consumer proof | D01 R-ASE-21–36; D03; bounded negative source search |
| Feedback evaluation | Proposed governed candidates and independent comparison | SPECIFIED ONLY | Existing observation/case/method provenance owners | Scoped feedback and evaluation receipts | No separate truth store justified | Counterfactual/held-out evidence | D03/D05/D06 current amendment |
| Native UI integration | Existing Sidebar, Cases, Zyra changes, Model Studio, execution shell | PARTIAL | Shell, tokens/fonts, controls and canonical links | Current-selection, explicit unknowns, case deep links, context/provenance panels | Extract only after actual duplication proves value | Authentic render and all affected page inspection | UI source ledger; D07 |

**Architecture decision:** EXTEND EXISTING SUBSTRATE and COMPOSE. REUSE UNCHANGED is appropriate for stable native identity/shell pieces, not the entire protected writer flow. EXTRACT-GENERALIZE is a conditional implementation option for demonstrated shared transaction/policy logic, not a new domain. No new primitive is justified by this review; an immutable attempt or method assignment can still be a necessary semantic extension subordinate to an existing owner, rather than a second product authority.

### Existing seams and dormant mechanisms

The source module actually registers the graph controllers/readers/history/models. An opt-in recovery scheduler is wired through BullMQ and `TESBO_GRAPH_QA_RECOVERY_ENABLED=1`; this is source evidence of machinery, not evidence that the flag is enabled or a scheduled job runs. Comments describing an unregistered module must not override registration source. Model preview explicitly returns capabilities such as target execution/activation as false; the persisted model service is a separate path and must not be confused with preview capability declarations. The native client-aware case insert is an existing composition seam; its existence does not mean the model conversion caller currently uses the same transaction.

## 6. Orthogonal axes and Brand Deletion Test

Tesbo's relevant axes are expectation/observation, identity/revision, approval/activation, proposal/publication, scope/applicability, actor/authority, task/execution, method/content, evidence/provenance, and derived presentation. No Nesberry marketplace taxonomy is imported.

| Proposed noun | Facts/invariants claimed | Nearest sibling axes and fit | Brand Deletion Test | Winning classification |
|---|---|---|---|---|
| Graph capability | Typed relations, scope/revision, provenance, reachability and unknown boundaries | Observation, expected definition and trace/evidence each fit existing distinct owners; one owner cannot collapse their authority | Relationships, bounded traversal and provenance remain | Cross-owner relation/projection capability; not a new truth authority |
| Model Studio | Authored expected behavior, revisions, approval and selected active definition | Expected-definition identity is intrinsic; UI placement and path generation do not create another authority | A versioned expected model and its authoring view remain | Existing expected-model owner plus authoring/generation surface |
| Skill / testing method | Versioned procedural content, scoped assignment, approved influence | Method/content and applicability fit; permission, business rule and execution result do not become method content | Version, assignment, context and evidence of influence remain | Governed orthogonal method capability with explicit consumer attachment |
| Change Packet | Changed inputs, affected contexts, decisions and downstream obligations | Change identity/projection fits; cannot own case truth or release authority | An actionable change review view remains | Projection over existing change/task/asset owners |
| Generated path | Proposed sequence through a bounded model | Planning fits; native case publication and actual result have different invariants | A proposed sequence and its unresolved concrete fixtures/assertions remain | Planning artifact; may propose existing staged case operations |
| Verified coverage | Witnessed correspondence among obligation, exact definition/build/context and evidence | Derived evidence claim fits; mapping, dispatch or status alone does not | The proof obligation survives label removal | Derived scoped evidence assertion, not its own writable truth |
| Learning / reasoning profile | Candidate procedure, evaluation conditions, feedback lineage | Method revision and derived evaluation fit; product requirements and causal truth remain separate | A tested or untested change in procedure remains | Governed method candidate; no universal authority from branding |

## 7. Participation Scope Matrix

| Relationship/context | Primary subject | Semantic role | Source context | Attachment scope | Independent acceptance? | Canonical owner | Projection | Runtime maturity | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| Reviewing a method candidate | Method version | Primary/intrinsic | Method governance submission | Immutable version/evaluation | Yes, own human governance | Proposed version/governance owner | Settings/Skills review | SPECIFIED ONLY | R-ASE-21–36; D03 skills |
| Using a method to author a case | Native case proposal | Supporting dependency | Authoring task and effective assignment | Exact input manifest/version/scope | Method acceptance does not approve case | Existing case staging/review; method resolver | Provenance panel | SPECIFIED ONLY for full method convergence | D03/D04 current manifests |
| Reporting an observed failure | Execution observation | Execution-only provenance when a method influenced work | Actual human/executor run | Exact attempt/context; method may be absent | Raw observation authorization is independent | Native execution/attempt | Run result/evidence | PARTIAL | Legacy/automation source; R-ASE |
| Approving expected model | Model revision | Primary/intrinsic | Accepted requirement/oracle | Exact project/family/revision | Yes; distinct from activation | Existing expected-model authority | Model Studio | PARTIAL | Model repository; C-02/C-12 |
| Generating cases from model | Native case proposal | Supporting dependency | Approved/active expected-definition resolution | Exact revision/path, unresolved concrete data | Case acceptance remains independent | Native staging/case owner | Model Studio → Cases | PARTIAL | Generator/repository; R-ASE-06 |
| Computing change impact | Changed source and affected assets | Supporting dependency | Pinned source observation/binding | Typed scoped relation/evidence | Acceptance of each affected asset remains separate | Graph capture/relationship and native assets | Zyra change review | PARTIAL | History/candidates; FR-115–119 |
| Displaying readiness | Release/change context | Presentation/projection-only | Domain applicability/decisions/attempt evidence | Exact readiness context | Settled projection is not release authorization | Existing release decision owner; derived read model | Readiness view | SPECIFIED ONLY for complete target | D04 C-05; R-ASE-37–48 |
| Exchanging commercial consideration | None in this scoped QA proposal | Not applicable; no exchange leg established | No supported source context | N/A | N/A | N/A | N/A | No runtime claim | Independent problem model; scope |

Scope asymmetry matters: a method is the primary reviewed object in governance, a supporting dependency in authoring, and provenance during observation. Its absence cannot erase a valid observation. A graph is primary while validating a relationship, but supporting during impact analysis and merely projected in readiness. UI adjacency does not transfer ownership.

## 8. Semantic Consequence Archaeology

| User expression | Semantic truth | Canonical owner | Scope | Authored / observed / derived | Downstream consequences | Mutation after reliance | Current runtime evidence |
|---|---|---|---|---|---|---|---|
| “Approve this model” | Accept exact expected revision, not select it automatically | Model revision approval; active selection separate | Project/family/revision/hash | Authored decision | Eligible for explicit activation; audit/assent required | Preserve decision; supersede through another event | Source approval exists; full target principal and selection missing |
| “Use the current model” | Resolve the family-owned active approved revision | Same family owner | Declared scope and pointer version | Authored configuration resolved at use | Generation/dispatch must recheck stale selection | CAS activation; old runs remain pinned | Source latest-head behavior differs; no runtime proof |
| “Create cases from these paths” | Propose selected native case operations before publication | Existing native staging/case owner | Exact model/path and selected proposal set | Authored proposal | Duplicate/reuse checks, concrete data/oracle, later selected apply | Immutable proposal/version; do not rewrite historical case | Source currently creates native Draft rows directly |
| “Passed” | A reported result for a particular performed attempt | Native execution/attempt | Case definition/build/actor/fixture/evidence | Observed | May support scoped coverage only with required provenance | Corrections are new reviewed events; retain observation | Native result handling inspected; immutable target not proved |
| “Link this bug” | Associate a defect with affected observation/definition | Bug link plus execution relation | Exact project and evidence context | Authored association | Must not silently revise accepted historical observation | Preserve association history/impact | Source can mark linked executions Failed; existing spec already covers migration |
| “This code changed” | An observed source delta, with trust/freshness limits | Verified source capture/binding | Pinned repo/ref/binding generation | Observed | Candidate impact, not an expected behavior oracle | New capture/version; do not retarget old event | Source binding/history/candidate inspection only |
| “Use this testing method” | Resolve approved method version under effective scoped assignment | Method version and assignment | Tenant/project/agent/task/action context | Authored policy; derived resolution | Authoring influence, conflicts and revocation recheck | New version/assignment; retain historical context | Target specified; bounded source search did not locate resolver |
| “Improve the method from feedback” | Propose a changed procedure; causal benefit remains uncertain | Method candidate/evaluation and feedback owners | Version, cohort, comparator, oracle | Observed feedback; derived hypothesis | Independent review and held-out comparison | Never rewrite old evidence or declare incumbent defeated by assertion | No empirical benefit/runtime evidence supplied |
| “No detected issue / settled” | A bounded derived result under declared applicable domains and evidence | Existing domain owners plus derived coordination | Specific change/release context | Derived | Does not approve release or prove all tests passed | Recompute with traceable inputs; preserve prior receipt | Target contract only |

## 9. Consumer/read-write sweep, migration constraints and finding

### Source-confirmed routes and bounded coverage

| Consumer/writer family | Source observation | Target convergence / limit |
|---|---|---|
| Native REST model authoring/approval/generation/run | Controller forwards `request.userId`; service owns models/revisions/approvals/case conversion/native runs | Must carry actual principal and operation proof; single resolver/transaction semantics |
| API token REST | Global guard permits project-prefixed operations according to read/write scope and membership, with selected admin exclusions; model approval is not a separately denied operation in inspected guard | Human identity cannot be inferred from userId; trace target operation policy across all entrances |
| MCP aliases and model tools | Controller/session auth and tool definitions inspected; model create/save/link/coverage/run routes exist | Token/method/P18 gates remain distinct; not every MCP policy branch audited here |
| Zyra/source review | Native change-review controller and UI call existing capture/history/candidate owners | Preserve authorized scope and partial/unknown states; no parallel review application |
| Native testcase approval/create | Approval uses edit revision/CAS and a same-client receipt; native insertion has client-aware helper | Reuse authoritative native ID and helper; converge model/import/other writers under exact policy |
| Native run and model provenance | Native cycle creation commits through LegacyService; model run metadata follows in another operation with compensating cleanup | Target mandatory provenance and native effects need one actual transaction or formally specified equivalent, not optimistic cleanup |
| Manual and automation results | Native execution status/result update, automation attribution/retry watermark and existing history mechanisms found | Extend existing attempt/correction owner; do not claim new history is deployed |
| Bug link side effect | `failLinkedExecutions` can write Failed/time/performer on linked writable executions | Already identified by canonical convergence; preserve immutable observation semantics |
| KB edits and knowledge consumers | Existing transaction/coalesced history and recent/search/RAG symbols | Governing immutable proposal/submission must handle coalescing; all consumer paths not fully traced |
| Bulk/import/clone/restore/jobs | Entry symbols/search and target all-writer requirements reviewed; full call graph not inspected | Remain explicit admission coverage, not passed by this receipt |

Migration must preserve native IDs, accepted historical content, case/run snapshots and exact authorization scope. Physical `mbt_*` names are not themselves a defect: D03 C-12 deliberately permits physical naming choices while requiring one logical identity. Existing duplicate/ambiguous identities must be explicitly reconciled from retained provenance and quarantined when unresolved, not merged by title. New draft/approval/active-selection distinctions must not reinterpret earlier dispatched runs. Mapping removal needs historical meaning and stale-dispatch behavior even when current source uses deletion. Source binding generations must preserve the provenance of prior captures. Existing migration filenames are not proof of deployed schema and new migration numbers must be resolved against the implementation baseline when work occurs.

### GEX-ASER-BB-B01

- **Severity:** Should-Fix.
- **Category:** Implementation-Grounding (with a clarity consequence in the subordinate source summary).
- **Finding:** The candidate's current-source account should explicitly reconcile the presently implemented Model Studio write paths to the stronger target contract. The target has the relevant requirements and general all-writer gates, but the exact latest-head, approval, staging and transaction transition is not made as concrete as the older native case/KB/Bug reconciliation.
- **Source:** At the pinned commit, `model-studio-repository.ts` lines 259–421 and 508–714, `model-studio-models.controller.ts`, `api-token-rest.guard.ts`, `common/request.types.ts`, `database.service.ts`, and `legacy.service.ts` selected lines 5192–5285 and 6892–6965. D02 C-02, D03 C-12, D01 R-ASE-06/13/34 and D04 C-03 specify the target. `views/README.md` line 104 says “Existing human-governed case/model/publication controls persist”; that shorthand needs an explicit source-maturity qualification.
- **Observed differences:** (1) dispatch uses the latest model revision and approval at that head, so a new draft can prevent use of previously approved r1; it is not the separate active-revision contract; (2) model approval receives userId without distinguishing the API-token principal carried elsewhere on the request; the global guard's inspected rules do not make this action human-only; (3) generated paths become native Draft Test Cases directly rather than shared unpublished proposals; (4) case creation calls a LegacyService operation with its own transaction from inside an outer model transaction without passing its client; generated-case provenance can therefore roll back separately from native cases; (5) native run creation precedes model-run manifest insertion, followed by compensating deletion on error, rather than one transaction; (6) model-case links accept optional revision and unlink by deletion, so exact mapping/history/staleness semantics need deliberate transition.
- **Impact:** If implementers treat the existing source as already satisfying target governance and add only new graph/method surfaces, old entrances can preserve a different authority, selection or atomicity rule. An ordinary save can change which approved model is usable; machine credentials can be confused with independent human assent; native case rows or runs can exist without their mandatory proposal/provenance. These are source-inferred risks, not executed exploit or rollback results.
- **Recommendation:** Add a concise as-is→target migration row for each existing Model Studio operation under the existing native/model tasks and proof gates. Name the shared principal/approval policy, family selection resolver, unpublished proposal owner, client-aware mutation seam and exact mapping-history behavior. Preserve current IDs and historical run definitions. Reuse the already-required MBT active-selection, stale-pointer, every-entrance, mapping-removal and shared-staging acceptance cases; add targeted failure evidence for the concrete split transactions before exposure. Qualify the subordinate README as “existing approval/generation/run substrate; target human-only and all-writer controls require convergence proof.” Do not add a second model authority or independent transaction ledger.
- **Status:** Open.
- **Why not a new Must-Fix requirement finding here:** The canonical target already requires distinct approval/activation, shared unpublished staging, exact protected human action and one-client atomicity, and blocks affected exposure pending convergence. A migration path exists at the logical owner/service level. This finding asks that the newly inspected concrete path be incorporated before implementation design is frozen; it does not claim those safety requirements are missing. If a later gate proposes exposing the feature while retaining the incompatible entrances, that proposal would fail the existing requirements and cannot inherit this bounded disposition.

Confirmed existing gaps are not double-counted as novel findings. In particular, the testcase detail route currently redirects to the repository and loses `tcId`, but D03, D07, T-104 and QA-075 already name the durable exact-case/version link fix. Bug-triggered result changes and KB coalesced edits also have explicit target convergence treatment. Their source confirmation does not prove the planned fixes have occurred.

## 10. Actual checks, design simulations and bounded performance conclusion

### Invoked checks

1. Python read the 14 manifest-listed documents as bytes and compared each length and SHA-256 with the manifest. **All matched.** This validates identity, not semantic consistency or quality.
2. Read-only Git object commands inspected the pinned source, package manifests, instructions, selected migration, owning routes and operations. Symbol searches covered the capability names/owners and consumer seams described in Appendix B. Searches for `get_effective_testing_method`, `resolve_effective_skills`, `skill_assignment`, `skill_versions`, `guide_revision`, `quality_journey`, `active_revision` and `active_model_revision` over the selected backend source/migrations and frontend app/components produced no matches. This is bounded negative evidence about those terms, not proof that no capability exists anywhere under another name.
3. A Node v24.22.3 stdin harness loaded the exact Git blobs of `model-studio-preview.core.ts` and `model-studio-generator.ts`, used `stripTypeScriptTypes(..., {mode:'strip'})`, and imported their in-memory data modules. No source file was changed and no application dependency, DB, network or target action was invoked. The harness used a synthetic three-state sequential model, `start → ready → end`, with transition `a` (Prepare / Ready shown) and `b` (Finish / End shown). It asserted:
   - preview approval is NOT_APPROVED, runtime is NONE, and targetExecution capability is false;
   - changing semantics to CONCURRENT throws UNSUPPORTED_SEMANTICS;
   - adding transition guard `role=admin` throws INVALID_MODEL rather than silently dropping the unsupported field;
   - edge_coverage generation with maxPaths=1, maxDepth=1, seed `blue-b-probe`, revision `synthetic-revision` includes only transition `a` and explicitly lists `b` in boundsExcludedTransitionIds;
   - repeating the exact structural inputs is deeply equal;
   - coverageAssertion and executionAssertion remain `none`.
   **All assertions passed.** Parser blob SHA-256: `00486d575998b02c6fc6c808f0211325aaa16ea4ac1693a811793e595976556d`; generator blob SHA-256: `028232d7f5ab188e50466c166a2bc0748ff58c4157743338bedf1a4fa2f896d6`. Produced path digest: `39bde2bb004e27d18e6a9523df0c37508e4199d4ed7a796b9eeb80460fc8153e`.

This is an isolated exact-source pure-function probe. Type stripping in this host is not the pinned application's production compiler/build. The probe does not validate the Nest controller, persistence, auth, generation-to-case writes, native run creation, executor behavior, deployed schema, current UI, stochastic AI output or any numbered acceptance test in D05. It does not turn the 125 planned definitions mentioned in the package into executed passes. No suite/test-run count is inferred.

### Performance and failure envelope

The existing pure model language has bounded state/transition/path/depth behavior; the inspected preview limits states to 32 and transitions to 64, rejects unsupported semantics, and the generator reports bounded omissions. That is useful but not an end-to-end workload budget. The wider graph, context retrieval, proposal generation, provider callbacks, method resolution and review queue need expected/peak rates, tail deadline, maximum queue age/backlog, database/provider cost, retry amplification and per-user/project/tenant limits. Dependency throttle/down and post-burst recovery behavior must be testable.

D01 NFR-012 and D04 C-06 explicitly make numeric, measured approved envelopes prerequisites before affected exposure. I treat those as deliberate deferred implementation inputs rather than fabricated numbers or proof of performance. Revisit at the first implementation admission for each exposed costly operation and whenever its source scope, concurrency, retrieval size or provider changes. No load, soak, queue-recovery or cost experiment was run. The source scheduler being registered does not satisfy recovery evidence.

### Cross-application portability and method distillation

The unchanged charter's transferable questions were applied to Tesbo's actual capabilities, not Nesberry's business nouns or scripts. As a bounded reasoning check, separate approval/active selection also has meaning in a versioned policy publishing workflow; observation-versus-expectation also matters in document reconciliation; and a method's absence should not erase a separately authorized raw observation in a field inspection workflow. These examples show that the questions are not definitionally tied to a graph label. They do not establish measured discovery improvement.

The stronger claimed benefit of the candidate D06 process requires fixed wording before held-out evaluation, materially different contexts/families, independent comparators/oracles, valid simpler/no-change outcomes, and preserved failures. No held-out application, independent model, fixed scoring run or benefit evidence was supplied or executed by this member. D06 correctly labels the extra guidance as candidate, not active installed Skill or replacement charter. I do not retrospectively recast this now-explicit review as a blind discovery experiment.

## 11. Current UI reconstruction and KEEP/EXTEND/EXTRACT map

**Status: SOURCE-INSPECTED / VISUAL-BASELINE BLOCKED.** The actual pinned source was read. No hand-authored reproduction, screenshot substitute, current render, pixel parity or accessibility approval is provided. Actual application/component execution with pinned dependencies, fixture, role, theme and viewport remains necessary.

| Existing surface / source | Source-observed baseline | KEEP / EXTEND / EXTRACT | Evidence limit |
|---|---|---|---|
| `app/layout.tsx`, `app/globals.css`, Sidebar | Local Inter and JetBrainsMono, saved theme, semantic violet/light tokens, native project navigation and collapsible shell | KEEP shell/fonts/tokens; EXTEND native navigation only where actual workflow needs it | CSS first 175 lines and Sidebar selected ranges, not all dark/mobile branches; no render |
| Zyra changes page | Existing source settings/preview/run setup, abort/request-generation handling, capture/notify states, empty/loading/error/notice branches, explicit no-execution candidate context | EXTEND exact provenance/partial states and native links | Owning page read 1–240/278; not every imported child/source branch inspected |
| Model Studio page and repository/controllers | Native list/current model, save/approve/generate/link/run handlers; approval prompt; generated-case/run panels and responsive `lg:grid-cols-[240px_1fr]` shell | KEEP native owner/shell; EXTEND independent active selection, governed staging and source/method context | Most page examined in separated ranges; full child editor and every responsive state not inspected; source does not prove human-only server gate |
| Native testcase detail route | Exact route discards `tcId` and redirects to repository | EXTEND existing repository/drawer routing under already-named T-104/QA-075 | Full redirect file read; repository state/handler symbols sampled, not complete page |
| Native execution page | Existing StatusChip/Input/Button, evidence/automation metadata, Bug dialog, manual result handler, status choices and source step fallback | KEEP native result workflow; EXTEND exact attempt/definition context and protected corrections | First 230/419 lines inspected; no rendered long text/mobile/modal validation |
| Shared Modal | Portal, Escape/overlay close, html/body/main scroll locking, token-based responsive max-height container | Reuse existing component when suitable; accessibility improvements require actual focus/dialog verification | Full source read; source uses presentation roles, no accessibility pass performed |
| Task detail, Zyra draft/review, Requirements, KB, Run detail and Skills/settings consumers | Named owning routes/components and target integration contracts identified; some writer symbols examined | Extend canonical consumers; EXTRACT only after concrete duplicate behavior is established | Full source/UI pass not completed for these surfaces in this member's bounded review |

Source current UI is not inferred from product mockups. The final row is an explicit coverage gap under the charter's full affected-interface obligation. This member does not approve exact before/after parity, complete UI source reconstruction or every native consumer on the basis of partial page reads. The candidate's task list can require those later proofs, but requirements alone do not satisfy them.

## 12. Handoff and unresolved admissions

Hand this original capability/owner/axis/participation/consequence/completeness analysis to Red for premise falsification and White for the applicable gate. No later team's result is manufactured here. Mandatory method obligations were applied with disclosed evidence limits; candidate/advisory process guidance was not promoted to the original charter's authority.

Before an implementation freeze or exposure claim, the remaining admissions include:

- Incorporate or explicitly resolve GEX-ASER-BB-B01 against the same pinned target; if source advances, reconcile at the new exact commit rather than borrowing unrelated PR/CI evidence.
- Complete the all-writer/consumer trace for native, REST, MCP aliases, imports/clones/restores/jobs and protected operation/principal proof, including the newly named model writer paths.
- Establish deployed schema and safe migration/replay/rollback evidence in an authorized isolated environment; no inferred deployment from V153 or source comments.
- Execute transaction, duplicate/retry/response-loss, stale activation/assignment, revocation, denied principal, old-version, ambiguous identity and cross-project cases against real owning services.
- Demonstrate both the manual no-repo/no-model workflow and the preserved original case-free external executor/report/retest/human-apply workflow, plus each material native consumer affected by the amendment.
- Complete source-authenticated UI coverage and actual renders under the relevant role/theme/viewport; retain accessibility/loading/error/partial/no-result evidence.
- Supply numeric approved operation envelopes and observed slow/throttled/unavailable dependency and recovery behavior before exposure.
- Validate method/root admission and any claimed AI or process improvement through its own fixed, independently evaluated evidence; no install, authority expansion or causal claim follows from this receipt.

These are concrete missing proofs or inherited gates, not a request to expand this bounded cold review into an unauthorized runtime audit. The user's decision remains the operational authority. A later informed delta may resolve findings; this original must remain unchanged.

**Signed analytically:** Blue Team member B, `/root/blue_member_b`. Separate cold analytical invocation at the manifest's pinned inputs, no cross-model independence claim, no operational approver status. **Original member receipt frozen on write completion.**

---

## Appendix A — independently verified input identities

| Manifest path | Bytes | SHA-256 |
|---|---:|---|
| canonical/00_README.md | 145559 | e4d294b93bce79ceb4387cbdf7b9fb3eaad93d715919eecd4096003a8ee2aefc |
| canonical/01_PRODUCT_REQUIREMENTS.md | 200662 | 19ae33312871a83b21254b2ea15f0057b9ad1d889791e9c0de6086583d074024 |
| canonical/02_WORKFLOW_AND_UX_SPEC.md | 124594 | b4d9692a438c18d136503a3c18c19b3f616e50a36a9f4c99fe95930f213fe5ed |
| canonical/03_TECHNICAL_DESIGN.md | 318264 | 398d71f502566f153efec4427038d558924f188d92a87827744e3a4a755f52ca |
| canonical/04_MCP_API_CONTRACTS.md | 161921 | 4741417746e00db79b10f95549bce8302141c9b11e6378b8b2bffcbeb4c9fba1 |
| canonical/05_IMPLEMENTATION_BACKLOG_AND_TEST_PLAN.md | 314177 | 156ca409f95738392423d30fcacb2233e725ca9067466090bac4acd52dc1907d |
| canonical/06_IMPLEMENTATION_AGENT_BRIEF.md | 111058 | c4e79c5006caefda4aa3bc043e34a96da913186cedde0e7a8be95f38b5d810ea |
| canonical/07_UI_DESIGN_TASKS.md | 112886 | d0463f68de16b84451d69f29ee930d5af98dca15d46db786ac403dee1b0752f3 |
| views/AGENT_RULE_TEMPLATE.md | 22931 | a2eaeaa1b072609552fe9ad556ce06d1b5044df9557562aa2f81b4208efeaaf3 |
| views/README.md | 33180 | df7aca3925ca274e8e57aab0cb17c18f826e13273fd95b3dc687b678a7e10ce6 |
| views/design.md | 100434 | 1d8ee44f9a3885c1ebdd5613cb0adeffb415745295b4738f0389de22bc1ee4f2 |
| views/implementation-plan.md | 75170 | 9eeed5abaa94462a7fc8f5de5394e8fdf6b406899dea282eaac73b5e42d814f2 |
| views/requirements.md | 75892 | 98262f4c3e8ee07d6fd31cae24941a765138908e351d629542d02b2556141b2c |
| views/skills-governance.md | 47691 | 5dee70b6eb6518ac8888aa7b340f8aea953b2a766a501bb338c8906d7e635c7b |

## Appendix B — actual read scope and reproducible evidence locations

### Document reference key and coverage

`D00`–`D07` mean the corresponding canonical filename in Appendix A. This was a targeted amendment/contract/source-fit review, not a claim to have read every historical paragraph in approximately 1.5 MB of canonical text. Heading inventories and relevant searches preceded focused reads. Some large outputs truncated; claims below are limited to recovered/visible ranges and separately read relevant sections.

- D00: original policies/workflow/accepted decisions in approximately lines 1–162; current 1.4.28/1.4.29 owner/status/gate amendments from line 591 to end; relevant headings/searches.
- D01: R-ASE-01–48 (735–1003), current amendment (1004–end); FR-115–119, NFR-012 and related policy searches.
- D02: model workflow/C-02 (601–641), current amendment and failure/recovery (724–end), heading and relevant contract searches.
- D03: C-12 (988–1014), 1.4.28 convergence and skills contract (1349–1549), current amendment (1553–end); target case-version redirect, native writer, graph and attempt searches. Earlier physical-schema/attempt descriptions are cited as target context, not a fresh deployed-schema audit.
- D04: ASER-C-01–06 (915–1013), current manifest/context/output/feedback contract (1014–end), heading inventory.
- D05: current task/proof/evaluation delta (1687–end), targeted T-104/QA-075 and MBT active-selection/stale/every-entrance/mapping/staging acceptance searches. No historical journey inventory or reviewer verdict is used as this member's outcome.
- D06: current amendment, operational-principles candidate and review boundary (546–end), heading inventory.
- D07: current native UI tasks/decision table (678–end); earlier exact-case-link/source/tokens task searches.
- Views: README 85–165/current GEX crosswalk and source-maturity notes; AGENT_RULE_TEMPLATE approximately 1–125/current usage and admission limits; design 1–75 plus relevant current sections/searches; implementation-plan 1–135/current sequencing/manual/GEX/learning/gates; requirements heading and current GEX/ASE searches with governing canonical contracts read in full relevant ranges; skills-governance 176–245/current candidate/admission/consumer and scenario sections. Full byte identity was checked for every view, not semantic equality of every duplicate paragraph.
- Method: original Blue charter and applicable full orchestration sections, including portability/run context, problem-space reconstruction, sequencing, actual membership and candidate-method distillation; no historical reviewer records read. Charter was re-read completely before finalization.

### Application source coverage

All following paths are relative to the pinned repository and were read with `git show 6897f989b055a955280f810c7daace86f74057fa:<path>` or searched with `git grep` at that SHA.

- Instructions/build: root `AGENTS.md`; root `CLAUDE.md` (substantial operational text, some large-output tail not claimed); `docs/agent-scope-discipline.md`; `Tesbo-Frontend/AGENTS.md` and its CLAUDE redirect; both package.json files. No `.env` credential values were opened.
- Full or substantially complete backend file reads under `Tesbo-Backend-Nest/src/behavior-graph/`: `project-source-graph.coordinator.ts`, `project-source-binding.ts`, `qa-review-candidates.ts`, `graph-change-review.controller.ts`, `graph-change-review.module.ts`, `model-studio-preview.core.ts`, `model-studio-generator.ts`, `model-studio-models.controller.ts`, `model-studio-runs.controller.ts`.
- Selected backend ranges: `current-cache-graph.history.ts` 1–220; `current-cache-graph.reader.ts` 1–180; `model-studio-repository.ts` 1–153 and 219–724, plus bounded coverage/generation searches around later metadata. The verifier/local pinned reader/comparison names were traced/referenced from the owning code but not every implementation body was read.
- `Tesbo-Backend-Nest/migrations/V153_model_studio_governance.sql` full. Migration inventory names including V145–V147 were searched; their presence is not equivalent to full body/deployment inspection.
- `Tesbo-Backend-Nest/src/common/request.types.ts`, `auth/api-token-rest.guard.ts`, `database/database.service.ts`, `mcp/mcp.controller.ts` full; `mcp/mcp.service.ts` 1–210; `mcp/mcp.tools.ts` 250–455; app module guard registration searched. Every MCP branch/policy was not audited.
- `Tesbo-Backend-Nest/src/legacy/legacy.service.ts`: approximately 1840–1901 approval; 5192–5285 case insertion/client seam; 6892–6965 cycle creation; 7700–7810 execution updates; 8257–8335 linked-Bug execution changes; 12112–12256 KB update/coalescing. Additional bulk/import/clone/restore/knowledge consumer symbols searched, not fully call-traced.
- `Tesbo-Backend-Nest/src/automation/automation.service.ts` 481–594 for actor/result/retry/protection behavior.
- Frontend full or visible selected reads under `Tesbo-Frontend/`: `app/layout.tsx` full; `app/globals.css` 1–175; `components/Sidebar.tsx` 1–160 and 230–275; `components/ui/Modal.tsx` full; `app/(app)/projects/[id]/testcases/[tcId]/page.tsx` full; `app/(app)/projects/[id]/agents/zyra/changes/page.tsx` 1–240; `app/(app)/projects/[id]/model-studio/page.tsx` first approximately 250 lines, explicit 250–480, and later approximately 750–1022 after an oversized output truncated the middle; `app/(app)/projects/[id]/cycles/[cycleId]/execute/[executionId]/page.tsx` 1–230. Native testcase repository state/deep-link/panel handlers searched.
- `ModelStudioAuthoring.tsx`, `Drawer.tsx`, full Task/Zyra review/Requirements/Run detail/API library bodies are **not** claimed read: attempted oversized child-component output did not provide usable content, or only file inventories/counts were obtained. Their remaining source coverage is explicitly open.
- A tree search did not locate the named standalone `Tesbo_Existing_Application_Baseline_v1.0.md` or `Tesbo_Codebase_Audit` file in the pinned tree. No prior review was substituted for that unavailable input. The in-document source descriptions were used as leads and checked against the source subset above.

Commands were read-only shell/Git/Python/Node operations. No newer PR, old CI status, externally linked paper or unrelated product document is used as evidence for this pinned application's implementation or the method's effectiveness.

