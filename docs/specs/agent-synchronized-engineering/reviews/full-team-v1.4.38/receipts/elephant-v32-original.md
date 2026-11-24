# Elephant-Gold — original cold receipt for Tesbo v1.4.32 candidate 1

**Receipt kind:** frozen original, before informed reconciliation.  
**Reviewer:** /root/elephant_v32.  
**Recorded:** 2026-11-20 UTC.  
**Method:** original Elephant-Gold charter v1.3 at method revision d83549c85a4dcd047fb40dc4fba4ec62737ab0fc.  
**Bounded disposition:** three 🟢 Nit candidates for triage; no 🔴 Blocker or 🟡 Major established in the examined specification/source scope. This is an advisory, focused original review, not an exhaustive all-claims pass, implementation-readiness certification, runtime acceptance, method-efficacy conclusion, quorum completion, or freeze verdict.

## 1. Artifact, context and invocation

### Exact target and evidence identity

The application is Tesbo. The desired result is that people and authorized agents can understand relevant behavior and change, produce useful native testing/engineering records, and make trustworthy decisions across different applications and kinds of work. The target is the explicit proposed specification package, not a blank opportunity-discovery exercise.

The reviewed input root is:

/workspace/scratch/40f0abd3bdbc/input-v32-candidate1

The run context is RUN-CONTEXT.md. Its SHA-256 is 370f72543c5a65f3ee25326ddc4412661c5a585e6b211eeacc180bf4b50e50c6. The manifest SHA-256 is 4f406b91251b85b2cd0def05fef9ce950481daa6b7b030762aed49998ac747f9. I independently computed each of the 15 manifest entries' local byte counts and SHA-256; all matched. This pins the material reviewed, not its correctness.

| Target file under input root | SHA-256 |
|---|---|
| canonical/00_README.md | 9d6fd78460f9c369f806da5cf0d6f41e351599469d11d2a073611f17230b0043 |
| canonical/01_PRODUCT_REQUIREMENTS.md | 009184a14956bd32f748cdc50a7ff629026e3a61b1c9e55648860f66582540c0 |
| canonical/02_WORKFLOW_AND_UX_SPEC.md | 23d9120c7aaa320f458fc51284388966e3e2a8945d929c9ef9730f10338425a9 |
| canonical/03_TECHNICAL_DESIGN.md | 0fbdd2bffbc534e4be40df61fae5a095191ba920129c546a930c60e3b27b9921 |
| canonical/04_MCP_API_CONTRACTS.md | 182aed015f69079f0a78d0c1420319729b7baecf8f8d6c0a1859d7463a48d1bd |
| canonical/05_IMPLEMENTATION_BACKLOG_AND_TEST_PLAN.md | a1e6a3f82b2725961a7501995d2cc8e40365afae4f5a7ee9a9d4dfd34bba6cfe |
| canonical/06_IMPLEMENTATION_AGENT_BRIEF.md | cf96798db8e48d161cc971313ed8e82c65d46dee8185a9c5d9d104d282bbe16c |
| canonical/07_UI_DESIGN_TASKS.md | c1270b7008e56bd5b44bfb53c11c6dadfc6ebaae6ba15d3e86b30b0b790cb45c |
| views/AGENT_RULE_TEMPLATE.md | a51ba3cb8cb8f9cd7a5dcbd0e127e2098c5bdac708635fb080f4b8b2f21e3704 |
| views/README.md | a9660807de7b1df968a0691bfc0567366b39fc42e3922e2ff068eb8bde3f37e5 |
| views/design.md | 806cfbdef4e04a03884f000a65493cc814930f2e31639e103f71663baf0ae0bb |
| views/implementation-plan.md | 937dd2197e9abe3043443634cadbe92e524e16756a2c05540b51b9b8a902926e |
| views/requirements.md | 920d10da6fc91cf23beb978ee9a1e276585beab78f43230d7cf4f903d199e977 |
| views/skills-governance.md | 3f5db629089dd0d2aed6ce7f68d06dec11975c13211ea56637174a921400d753 |

The manifest identifies v1.4.32-candidate-1 and the saved v1.4.31 parent archive SHA-256 ae475b1bada1a5a74089d6ab389e7019f5d6b67d5f1de5358ad0eb014739ef47. The parent archive's actual Library save/version event was not independently inspected in this review. The six subordinate views have a recorded reconciled head c12b8956bc1f219c6430e205eb1688e7833bd9cf; the manifest separately retains their earlier parent. A header or source label is not deployment evidence.

### Actual invocation and exposed context

The coordinator supplied the actual collaboration.spawn_agent transcription in:

/workspace/scratch/40f0abd3bdbc/verification/elephant-invocation.json

It records task_name elephant_v32, fork_turns none, no model override, no reasoning-effort override, the full neutral assignment, and returned task path /root/elephant_v32. The coordinator also confirmed those parameters directly. This is evidence of the no-history dispatch used in this conversation. The JSON labels itself a coordinator transcription, not an independent provider audit export. I do not upgrade it to provider attestation, cross-model diversity, or proof against shared model bias.

The input received was the task, artifact paths and pins, original method location, scope/safety restrictions, and neutral follow-ups giving the invocation record and a missing primary method file. No defect, preferred architecture or desired verdict was supplied by the coordinator.

I did not open peer receipts, author retrospectives, target views/reviews, or list_agents. I did read the actual primary specifications, which themselves expose historical findings, verdict language, source-convergence judgments, earlier method trials, named scenario families and preserved review references. Particularly relevant exposure includes canonical 03 §18.2.1, the historical/source-reconciliation portions of canonical 05 and 06, and the subordinate views' descriptions of earlier assurance. The original findings below therefore are independent derivations from this permitted primary material, not an unexposed discovery experiment. I cannot establish priority against unread prior findings. “Net-new” below means a candidate independently raised in this original receipt; peer overlap remains UNKNOWN.

### Actual method and target binding

The original method root is:

/workspace/scratch/ce8c3109f396/assurance-source-recovery/Nesberry-d83549c85a4dcd047fb40dc4fba4ec62737ab0fc

I read the actual .kiro/steering/teams/elephant-gold-team-charter.md, .claude/agents/elephant-gold.md, teams/README.md and review-orchestration.md, together with the portability and assurance-evidence policies at their original governance paths and the relevant independence rules in spec-writing-standard.md §0.45. The six EG lenses, problem-space reconstruction, semantic-consequence test, axis/brand-deletion and participation-scope challenges inform this receipt. They do not import Nesberry's marketplace, Medusa, Admin Counterpart or specification template into Tesbo.

The missing playbook was supplied at:

/workspace/scratch/40f0abd3bdbc/method-source-supplement/docs/pressure-test-playbook.md

Its computed SHA-256 is 87db381c83c066766c2dec75b96da4d70024a2287dbce08cc5cc7aa189e20421, matching the supplied exact-pin blob record. I read the charter-referenced §§12–13. At this pin they concern precise use of standards and hard rules versus heuristics, including preserving uncertainty; they are not literally a section entitled “review is a lead, not a verdict.” The charter itself explicitly supplies the advisory rule at lines 50–63 and 135–155. This indirect-reference imprecision does not remove the rule or justify modifying the charter.

Target binding comes from the run context, the actual Tesbo AGENTS.md/CLAUDE.md at base 6897f989b055a955280f810c7daace86f74057fa, applicable current-source guidance, docs/agent-scope-discipline.md, and the proposed eight-file contracts including P-07, P-14 and P-18. I read the available frontend instructions before frontend source inspection. I found no basis to invent an additional target-specific specification standard or a ninth normative owner. Proposed decisions in the supplied package are assessed as proposed contracts, not independently proven current human ratification.

### Read scope, source identity and actions

The review applied all six lenses to the current proposal, with focused source verification. It is not a line-by-line re-audit of every historical assertion in these large, accumulated documents.

The focused canonical reads included: 00 current principles and revision amendments; 01 the current ASER/GEX requirements; 02 ASER workflows, MBT-C-02 and current graph/semantic additions; 03 MBT-C-03/04/05, C-12, §18 ownership/source fit and current graph/semantic contracts; 04 ASER-C01–06 and current admission/recovery semantics; 05 current scenario allocation, method trials and graph/semantic proof obligations; 06 current method source reconciliation and portable-candidate content; 07 current UI/integration and graph additions. Earlier headings and selected historical passages were also inspected and are exposure, not fresh evidence.

The six views were inspected. README, AGENT_RULE_TEMPLATE and skills-governance were read in detail; requirements through the current numbered requirements and relevant scenario/proof material; design and implementation-plan through their ownership/workflow sections and selected current convergence, semantic and integration gates. Intervening historical rows and every link were not exhaustively audited.

Additional source references in this receipt resolve as follows:

- S419 = /workspace/scratch/40f0abd3bdbc/source419, exact PR #167 pin 419c2efa08b04aff6c7c7d0d56425eb572bd6ec2.
- F419 = /workspace/scratch/40f0abd3bdbc/source419-frontend, the 261-file frontend supplement at the same pin.
- The base repository Git objects are /workspace/scratch/307cd95373fe/tesbo at the base commit above; mutable checkout state was not accepted as a substitute.
- The later PR head is e3d0ebcbe8ec88c5b191abdf2b1d352d44929747, with supplied full-tree inventories and seven-file delta.

I independently checked local byte counts, SHA-256 and Git-blob identities for the 611 selected S419 files, 261 F419 files, two standalone method-input files and 18 repository product-testing files against their supplied manifests. This verifies local cache integrity against those manifests; it is not a fresh independent network retrieval or proof that the selected cache is an exhaustive repository. The two full supplied tree inventories are non-truncated and differ in seven blobs: six E2E fixture/test files and one frontend execution-status label file; no backend blob differs. No test-execution conclusion follows.

The source read in detail included the preview core, path generator, QA review-candidate derivation, source-binding resolver/management and targeted model-repository/controller/test-definition passages. Migrations and related owners were inspected selectively. Frontend searches for the forecast fields did not identify a current consumer within the available frontend tree; external/API consumers remain UNKNOWN.

The only executable behavior exercised was an isolated import and call of the unmodified pure model path generator under Node v24.22.3 with invented in-memory input and two controls. It called no API, application boot, DB, queue, browser, target system, external model or installed Skill. This is executable local pure-function evidence, not Tesbo runtime or acceptance evidence. No repository/product/source input was changed. This receipt is the only review artifact written by this reviewer.

## 2. Paraphrase and independently reconstructed problem

### Plain-language paraphrase

The proposal would let Tesbo follow a change from the question or expectation that motivated it to the records and evidence people use to judge it. Some inputs are accepted expectations; others are what source code says, what an agent thinks, or what a real test observed. Tesbo must keep those different meanings visible.

The graph helps find relevant relationships. It does not become the owner of requirements, cases, Bugs, reports or authority. A Change Packet coordinates the existing native records. A model can help propose useful test paths, but a generated path is not a reviewed case or evidence that an application worked. People can still do useful manual QA without a repository, formal model, native AI key, CI or automated executor.

Reusable Skills would govern how authorized agents reason and draft. A Skill's text, immutable version, approval, current assignment, actual use and evaluation are separate facts. An agent can propose a successor but cannot make its own candidate authoritative. Protected publication depends on the actual native owner and current authority; every accepted result must retain the exact basis that mattered at the time.

The proposal also calls for semantic interpretation, contradiction analysis, consequence tracing and learned prioritization. Those are proposed capabilities with evidence and capability gates. The package does not establish that an AI will infer every relevant relationship, correctly diagnose flakiness, predict defects or improve QA merely because those requirements have been written.

### Reconstruction from the desired outcome

The underlying job is reliable coordination of decisions under incomplete and changing evidence. Graphs, models and Skills are possible aids to that job, not its definition.

The materially different actors are the person responsible for intended behavior; the author changing code or documentation; manual testers; external agents and CI/executors; reviewers deciding publication or applicability; people operating governance/recovery; and downstream consumers relying on a decision. One human may occupy several roles. A machine credential issued by that human remains a machine principal. “User” alone is too coarse an authority model.

The system must answer: What should happen, and who accepted that expectation? What actually changed? Which affected obligations are known, uncertain, excluded or unexamined? What may this actor do now? Which exact version did a reviewer or executor rely on? What really ran, on what build and conditions? What remains incomplete after interruption? Why is a proposed change useful, including the legitimate answer that no change is needed?

The essential truth axes are normative expectation versus observation versus hypothesis; canonical ownership; scope and applicability; revision/time; visibility and purpose; review and current selection; actual execution; and evidence of method effectiveness. A single “approved,” “covered,” “current,” “AI generated” or “complete” label cannot carry those meanings.

The necessary transitions are intake → bounded interpretation → proposed native change → exact review → authorized native effect → actual observation → evaluation → separately governed future guidance. Each arrow can fail or become stale independently. Cancellation, rejection, unavailable evidence, late results and uncertain effects are real outcomes rather than omissions from a happy path.

### Semantic completeness matrix

Disposition here concerns representation in the inspected proposed contracts. It does not certify implementation.

| Independently required dimension | Disposition | Basis and unresolved consequence |
|---|---|---|
| Accepted expectation independent of current implementation | REPRESENTED | Current requirements/consistency contracts distinguish approved requirement/policy from source observation and inferred hypothesis. Without that distinction, implementation could manufacture its own oracle. |
| Manual and source-free work; original external executor loop | REPRESENTED ELSEWHERE and retained | P-07/original task-report-review workflow, I3-Q and current R-ASE-48 preserve it. Graph/model/CI prerequisites must not displace that work. Actual integration remains UNVERIFIED. |
| Exact relied-on identity, revision and applicability | REPRESENTED | MBT-C-02/05 and ASER-C03 specify immutable accepted basis and separate current selection. Subordinate universal wording has the historical-mode defect in EG-V32-02. |
| Change identity and coordination across native records | DERIVED | FR-115 changeset owner and ASER Change Packet projection. The proposal does not require another independent task/case/requirement authority. |
| Actor, audience, content subtype, authority and visibility | REPRESENTED | Requirements and Skills views separate these axes. They require concrete deployment bindings; “internal” or “public” alone cannot decide entitlement or normative authority. |
| Useful unchanged, rejected, unknown, N/A and inaccessible outcomes | REPRESENTED | Applicability/workDisposition, typed consistency classifications and missing-data handling. “No detected issue” is bounded; unavailable lookup must not become successful empty. |
| Observed, selected, mapped and verified obligations | REPRESENTED | MBT-C-03 defines separate sets and denominators. The existing generator's omission-cause diagnostic is narrower and mislabels a legitimate strategy outcome: EG-V32-01. |
| Atomic protected native effect versus external uncertainty | REPRESENTED | ASER-C03/04 separates selected atomic apply, partial staging, receipt lookup/resume and external handoff. Source-fit gaps are expressly admitted, not implemented by prose. |
| Governance across in-flight work and changed permissions | REPRESENTED | Pinning, generation/checkpoint revalidation, queue/start/resume/delivery/apply, immutable historical attempts and pause/fallback are specified. Actual all-entrance enforcement is UNVERIFIED. |
| Confidentiality, retention and lawful deletion | REPRESENTED | Current source/graph/Skills contracts retain authorized provenance without treating history as unlimited rehydration or universal access. Actual policy configuration and migrations are UNKNOWN. |
| New method quality independent of its author's evidence | REPRESENTED; efficacy DEFERRED | Canonical 05/06 require independent, held-out comparisons, counterexamples and realistic outcomes. The candidate cannot ratify itself; no improvement is established here. |
| Concrete root authority, quorum/recovery, parser grammar, limits and operational budgets | DEFERRED / UNKNOWN — NEEDS EVIDENCE | Named implementation/admission decisions remain. They must be resolved before affected capability exposure; absence of a current deployment is not evidence of a deployed defect. |
| Arbitrary program equivalence, exhaustive infinite paths and guaranteed causal diagnosis | INTENTIONALLY EXCLUDED as guaranteed claims | Bounded support, refusal/unknown and evidence-qualified hypotheses are legitimate. A universal semantic correctness promise would be unsupported. |
| Current authentic UI usability, real adoption and comparative benefit | UNKNOWN — NEEDS EVIDENCE | Source text and conceptual reasoning cannot establish a person can complete the workflow or that the approach improves outcomes. |

### Axes, reuse, participation and brand deletion

Removing the name “Graph AI” still leaves source observations, accepted expectations, typed relationships, bounded queries, proposals and native evidence. Those already have native owners. The useful new contribution is better interpretation and explanation under authority and evidence limits, not a second writable truth graph.

Removing “Skills Library” still leaves immutable guidance, an approved binding, context resolution, evidence of use and a controlled change process. A library/search screen is one projection. T-422/D-14 and existing KB submission/version facilities are the correct reuse candidates under the current proposal; whether every required invariant is implemented remains a separate source and integration question.

The same Skill is PRIMARY when its content is under review, SUPPORTING when it governs a requirement/case authoring task, EXECUTION-ONLY provenance when an attempt records the actual method used, and PROJECTION-ONLY when shown in a library or usage view. None of those roles permits the Skill to grant permissions or become the product oracle. A graph relationship may itself be the subject of review or supporting evidence for another decision. An exchange-leg role is N/A in the disclosed Tesbo scope: no independent negotiated exchange is evidenced here. Importing a marketplace exchange just to fill that cell would distort the target.

Requirement approval, model activation, mapping acceptance, case publication and execution consent are independently meaningful commitments. Collapsing them because they appear on one screen would lose business truth. Conversely, similarly worded cases may legitimately differ by actor, fixture, expected refusal or downstream obligation; semantic similarity alone must not force identity collapse.

### Consequence and negative-space challenges

I considered the following independently useful cases, including conforming alternatives. These are conceptual challenges except the generator probe in §4.

| Variation | Consequence demanded by the user job | Disposition from the inspected contract |
|---|---|---|
| Policy changes while code does not | Review current audience-specific manuals, affected obligations and evidence without inventing a source commit | Represented in semantic/current applicability provisions. |
| Manual wording changes without changing behavior | Legitimate unchanged requirements/cases; preserve rationale | Represented; no requirement to manufacture records. |
| Approved r1 stays current while r2 is saved or merely approved | r1 reliance survives; explicit activation changes current basis | Represented canonically; existing source limitation admitted. |
| Authorized historical replay uses inactive but still-approved r1 | Exact consent and historical label; do not activate r1 merely to replay | Represented canonically; subordinate wording conflict found. |
| Skill is revoked while work is queued or a result is late | Stop current governed reliance, preserve permitted history, revalidate at actual protected handoff | Represented as proposed checkpoints; execution unverified. |
| Failure evidence arrives while method resolution is unavailable | Preserve truthful raw evidence under its own permission; block only the dependent governed promotion | Represented. |
| Dynamic dependency or inaccessible source cannot be resolved | Unknown/unexamined scope, not zero impact or “complete” | Represented; parser/entitlement implementation still needs evidence. |
| Native Run creation may have committed but the response vanished | Reconcile same intent or prohibit repeat until authorized resolution; preserve deliberate new intent separately | Already admitted by current source-convergence text; not claimed as a new incident. |
| Source is permitted globally by an actual deployment policy | Registry scope may be legitimate; do not infer private-source leakage from the registry design alone | The proposal acknowledges the conditional policy question; actual policy UNKNOWN. |
| A human performs a manual test | Keep actual observation/evidence and honest provenance without inventing machine execution | Represented; authentic workflow proof remains unavailable. |
| New project has sparse or biased defect labels | Abstain or use justified human/rules-based prioritization; retain required regression | Represented as an evaluation/admission limitation. |
| Shortest-path strategy deliberately omits return/self-loop edges despite ample budget | Explain strategy nonselection without inventing resource exhaustion | Existing source fails the diagnostic distinction in EG-V32-01. |

### Legitimate alternatives and readiness

A deterministic diff, typed lookup, explicit checklist or manual review can be sufficient for a given change. A no-AI/no-change outcome is legitimate. More reasoning depth, more graph edges or more cases is not automatically better.

A reviewed handbook or controlled configuration can supply the portable method's invariants; an elaborate Skills product is not a logical prerequisite to portability. Within Tesbo, reuse of the existing guide/KB owners is a legitimate implementation choice. A new storage relation needs a demonstrated missing invariant, not a new feature label.

Historical mode can preserve a valid old approved model without changing current applicability. Unknown side effects can be handled by authoritative idempotent receipt/readback or by explicit no-repeat reconciliation. The requirement is truthful effect handling, not one compulsory technical implementation.

An engineer can use the current proposal to identify owners, authority boundaries, state distinctions and proof obligations. It is not enough to ship the whole capability without further decisions and evidence. Exact root authority/recovery, affected writer inventory, migration scope, parser/interpreter capabilities, quotas and measured budgets, operating responders, client compatibility and authentic UI/runtime evidence remain named gates. I do not promote those acknowledged admissions into new specification defects or excuse them as already implemented.

## 3. Claim-verification table

References beginning canonical/ or views/ are relative to the exact input root in §1. Source references beginning S419/ or F419/ use the absolute pinned roots in §1. VERIFIED is limited to the stated evidence class.

| Claim checked this run | Status | Actual primary reference and evidence class |
|---|---|---|
| Exact candidate files match the input manifest | VERIFIED | input manifest and all 15 local files; executed byte/SHA-256 checks. Content validity is not implied. |
| EG is cold-dispatched and advisory under the actual method | VERIFIED, with invocation provenance limit | verification/elephant-invocation.json plus coordinator's actual-call confirmation; original charter:65–85,135–155; agent “Required input and invocation contract.” Not independent provider attestation. |
| The eight canonical files are authoritative and the six views subordinate in this proposal | VERIFIED as document contract | canonical/00_README.md P-14/current revision text; views/design.md:3 and implementation-plan.md:3. Actual user ratification outside supplied material not inferred. |
| Approval, current activation and historical use are independent | VERIFIED as proposed contract | canonical/02_WORKFLOW_AND_UX_SPEC.md:614–628; canonical/03_TECHNICAL_DESIGN.md MBT-C-02/C-12; no deployed implementation claim. |
| Every governed Model Studio operation must use a currently activated revision | WRONG when read universally | views/skills-governance.md:213 conflicts with canonical/02_WORKFLOW_AND_UX_SPEC.md:624–628. Canonical precedence limits consequence; EG-V32-02. |
| Current Step 0 should bind the package at v1.4.29 | STALE | views/implementation-plan.md:12 versus :3 and exact manifest v1.4.32-candidate-1; EG-V32-03. Historical checkpoint references are not automatically wrong. |
| Current source supports arbitrary guarded/effectful models already | WRONG if asserted; not asserted as implemented by the current proposal | S419/Tesbo-Backend-Nest/src/behavior-graph/model-studio-preview.core.ts:1–139 enforces the limited sequential FSM schema and fixed bounds; document additions are proposed capability. Source inspection only. |
| All reachable transitions omitted from generated paths were excluded by bounds | WRONG for shortest_paths | S419/Tesbo-Backend-Nest/src/behavior-graph/model-studio-generator.ts:159–188; actual isolated pure-function counterexample and controls in §4. |
| The generator diagnostic can reach a returned API result | VERIFIED as source path | model-studio-repository.ts:1173–1191 returns the generator payload; model-studio-models.controller.ts:73–82 forwards the native method. No authenticated request executed. |
| Generated forecast equals execution coverage | WRONG if inferred; current source explicitly disclaims it | model-studio-generator.ts:200–201 returns coverageAssertion none and executionAssertion none; canonical/03_TECHNICAL_DESIGN.md:935–943 distinguishes stages. This limits EG-V32-01 severity. |
| Existing source-binding registry alone proves arbitrary project source entitlement | UNVERIFIABLE as entitlement claim | S419 behavior-graph/project-source-binding.ts and project-source-binding.management.ts checked; owner/registry checks exist, but actual destination policy not supplied. No live disclosure established. |
| Later e3d0 head changed backend conclusions | VERIFIED that backend blobs are unchanged in supplied full inventories | verification/implementation-tree-419c2efa.json and implementation-tree-e3d0ebcb.json; executed tree comparison: seven differing blobs, none backend. Remote publication/deployment not independently rechecked. |
| Repository product-testing source recovery means it is installed/effective | UNVERIFIABLE as installation claim; not claimed by the current proposal | method-inputs manifests/README; local 18-file byte/blob checks; product-testing/SKILL.md and references/evidence-and-distillation.md inspected. Canonical 06 correctly keeps source, candidate and activation distinct. |
| The standalone manual authoring text is uniformly an independent-oracle policy | WRONG without reconciliation | method-inputs/Pasted markdown(86).md:66 versus :228–270. Early shipped-behavior preference and later accepted-oracle qualification coexist. The current canonical source-reconciliation text already recognizes this; not a new defect. |
| Historic reviews or synthetic comparisons prove this exact candidate passes or the method improves discovery | UNVERIFIABLE | Historical narrative exposed in primary specs; underlying peer receipts intentionally unread. Definitions and disclosed limited trials cannot establish this candidate's runtime, human outcomes or independent discovery power. |
| The playbook §§12–13 literally contain the advisory maxim cited by the charter | STALE/IMPRECISE cross-reference | method-source-supplement/docs/pressure-test-playbook.md:1706–1715 has standards/heuristics sections. Advisory rule is directly verified in charter:50–63,135–155. No target policy change follows. |

Other factual assertions throughout the historical package, external publications, competitor descriptions and every claimed source correction were not all verified. They remain UNVERIFIED by this receipt even where repeated in primary documents. Agreement or absence of a new finding does not elevate them.

## 4. Findings

### Finding register

| ID | Severity | Lens | Claim and independent failure | Consequence | Corroboration status |
|---|---|---|---|---|---|
| EG-V32-01 | 🟢 Nit | Claim verification; drift; implementation readiness | Generator places every reachable unselected transition in boundsExcludedTransitionIds. A valid shortest_paths run omits return/self-loop edges because of its objective with neither limit binding. | Misstates why a proposal omitted obligations; a consumer could increase a budget without addressing the strategy choice. No false run verdict, current UI defect or actual incident established. | Net-new candidate in this original pass; overlap with unread teams UNKNOWN. |
| EG-V32-02 | 🟢 Nit | Comprehension; decided-ground; semantic consequence | “Any governed Model Studio or Skill-assisted operation” requires currently activated revision in views/skills-governance.md:213. Canonical MBT-C-02 explicitly permits approved inactive historical generation/replay. | A reader could block a valid historical workflow or unnecessarily alter current activation to use it. Canonical precedence already supplies the correct rule. | Net-new candidate in this original pass; overlap UNKNOWN. |
| EG-V32-03 | 🟢 Nit | Drift; self-containment | Current Step 0 in implementation-plan.md:12 directs use of v1.4.29 while the same view and manifest bind v1.4.32. It is an operative instruction, unlike a clearly labeled historical checkpoint. | An implementer can start from an older contract and miss later amendments, or spend time resolving which pin controls. No actual wrong-tree implementation is observed. | Net-new candidate in this original pass; overlap UNKNOWN. |

### EG-V32-01 — distinguish strategy nonselection from resource exclusion

**Oracle.** A reason for omission must describe the actual limiting mechanism. Canonical MBT-C-03 separates eligible, selected, excluded and unknown obligations; MBT-C-04 requires explicit bounds and stop reasons. A shortest-path objective is a valid strategy, not an implicit promise to traverse every edge. The defect is the cause label, not the absence of redundant edge paths.

**Source mechanism.** The generator's shortest_paths branch computes a shortest path to each reachable noninitial state (lines 166–172). It then collects every reachable transition absent from all selected paths (175–176) and returns that same array as both uncoveredTransitionIds and boundsExcludedTransitionIds (187–188). The repository and controller return the payload through the generation operation (references in §3).

The generator file's SHA-256 is 028232d7f5ab188e50466c166a2bc0748ff58c4157743338bedf1a4fa2f896d6; its Git blob is fd8521fbbacd9e5164b40df7e3f4d0de1b3ee802. The same backend blob remains at e3d0 in the supplied inventories.

**Executed local probe.** I imported that unmodified TypeScript file with Node v24.22.3. The in-memory definition was sequential FSM schema tesbo-fsm-draft/1 with initial state start, second state ready, t_go from start to ready, t_return from ready to start, and t_wait from start to start. All three transitions are reachable and have action/expectedObservation text. Seed was fixed; revisionId was review-probe and contentHash was 64 “a” characters. There was no product record, API request or persistence.

| Probe | Strategy and limits | Actual returned paths | Actual uncovered / boundsExcluded |
|---|---|---|---|
| Counterexample | shortest_paths; maxPaths 64; maxDepth 32 | [t_go] | Both arrays [t_return, t_wait] |
| Conforming strategy control | edge_coverage; maxPaths 64; maxDepth 32 | [t_go], [t_go, t_return], [t_wait] | Both arrays empty |
| Genuine budget control | edge_coverage; maxPaths 1; maxDepth 32 | [t_go] | Both arrays [t_return, t_wait] |

All three outputs retained coverageAssertion none and executionAssertion none. All reported three reachable transitions and no unreachable states/transitions. The first run used one path of length one despite allowance for 64 paths of depth 32, so neither configurable bound explains the omitted return/self-loop. The generous edge-coverage control demonstrates those transitions can be generated under the same input-size limits; the maxPaths-one control demonstrates a real budget case that currently receives the identical label.

This is a reproduced pure-logic diagnostic defect with a source-supported API path. It is not an observed deployment failure or an executed integration test. Searches within the supplied frontend did not reveal consumption of these fields; other consumers remain unknown. Those limits, and the explicit proposal-only/no-coverage assertions, justify Nit rather than asserting a harmful decision or false QA pass.

**Acceptable resolution options.** Separate strategy-omitted from bound-excluded elements; return a neutral unselected set with truthful per-cause diagnostics; or otherwise define an accurate API concept. Preserve the legitimate shortest_paths behavior. Do not “fix” it by silently changing the selected objective or claiming all omitted edges must be tested. At the adopting integration tree, check the two generous-budget strategies and a genuinely binding budget, including source/API contract compatibility.

### EG-V32-02 — preserve approved historical use without changing current activation

**Oracle and counterexample.** Canonical/02_WORKFLOW_AND_UX_SPEC.md:624–625 expressly permits explicit HISTORICAL/INACTIVE or HISTORICAL generation and consented historical replay of still-approved inactive revisions. CURRENT mode separately resolves and rechecks the active pointer at :628. Retired content has stricter limits.

Suppose approved r2 is current and approved r1 is inactive. An authorized reviewer wants a historical replay under r1 with exact consent and an explicit historical label. The canonical contract represents the request and preserves r2's current applicability. The subordinate statement that any governed Model Studio operation must use a currently activated revision cannot be applied literally to this valid case. Activating r1 merely to replay would change applicability for other work without being required by that user's intent.

**Conforming control.** For a CURRENT generation/dispatch or current governed Skill authoring task, selecting and rechecking the active approved assignment is appropriate. Candidate comparison also remains permissible as inspection. The problem is the universal quantifier crossing these different operations.

**Bound.** The eight-file canonical authority and the subordinate header already establish which rule wins. I did not observe implementation enforcing the overbroad sentence. This is a local reader/build-instruction inconsistency, not a finding that historical mode is wholly absent.

**Acceptable resolution.** Scope the sentence to CURRENT normative reliance and name the existing explicit historical/candidate-evaluation exceptions. Preserve separate model-mode, approval, retirement, activation and execution-consent checks. This does not authorize inactive arbitrary Skill content to govern current production authoring.

### EG-V32-03 — bind the active implementation instruction to the current reviewed package

The implementation plan's current Step 0 item 4 names revision 1.4.29, while its canonical-home line and the pinned manifest name the v1.4.32 proposal. A reader following Step 0 should not have to guess whether later model, recovery, semantics and method admissions apply.

**Conforming control.** A dated historical checkpoint may retain its original pin, as may a preserved review receipt. The finding concerns the unqualified current Step 0 command, not an instruction to globally rewrite historical version numbers or retrospectively refresh old evidence.

**Acceptable resolution.** Bind Step 0 to the current exact reviewed package/manifest, or explicitly state why 1.4.29 remains a historical starting point and require the current amendment set before implementation. Recheck this one actionable reference; no new canonical owner or broad historical rewrite is needed.

### Considered leads not raised as new defects

The current package already admits latest-head model dispatch, incomplete mapping history, action-bound human-assent work, mutable regenerated candidate history, unknown native-Run creation outcomes, cross-tab recovery races and conditional source-entitlement questions. I did not independently reproduce all of those mechanisms and do not reissue them as new discoveries or claim they are repaired.

More advanced graph reasoning than the current sequential FSM supports is intentional proposed work. Missing runtime proof does not by itself falsify a proposal clearly labeled NOT RUN. Similarly, a detailed held-out evaluation plan is not proof of benefit, but the present package generally preserves that limit rather than claiming established efficacy.

“Human correction” is not automatically a universally correct lesson. The inspected candidate method preserves observed evidence, causal uncertainty, alternatives and independently governed promotion. No extra application-shaped universal principle is justified by the limited defects in this receipt.

## 5. Routed

| Recipient | Candidate or dependency | Bounded next question |
|---|---|---|
| Blue | EG-V32-01; native owner reuse | Keep the existing generator/API owner. Determine the accurate diagnostic contract and compatibility consequences; no second coverage engine is required by this finding. |
| Graph Assurance | EG-V32-01 and the existing coverage/evidence contract | Preserve distinct obligation, selection, exclusion, attempt and verification facts through the native return/projection path. An API label correction alone does not prove end-to-end enforcement. |
| Purple | EG-V32-02 and any actual exposure of EG-V32-01 | Does the eventual user surface explain mode and omission causes accurately? This run supplies source/document leads, not current rendered-UI evidence. |
| Blue / Grey | EG-V32-02 | Preserve the legitimate historical replay under exact consent while current applicability remains unchanged; do not force reactivation as a workaround. Grey's authentic/journey evidence remains a separate dependency. |
| Blue / White driver | EG-V32-03 | Reconcile the current implementation entry point to the exact reviewed canonical package while preserving historical receipts. EG does not perform White's closure. |
| Security | Existing authority/source/privacy admission dependencies | Verify actual governance principals, all relevant entrances, source entitlement and revocation at the adopted build. No new live vulnerability is claimed by this receipt. |
| Red | Method-value and semantic-reasoning premises | Challenge claimed incremental value against deterministic/manual/no-change baselines and incomplete evidence. This receipt cannot establish efficacy from specification agreement. |

These are routing requests and bounded questions, not claims that another role executed, agreed or satisfied quorum. EG is permitted as one fresh reviewer applying all six lenses; it has no numeric multi-person quorum stated in its charter. No available evidence establishes completion of the other specialist roles, ordering prerequisites, Graph closeout or White freeze in this run. I did not inspect their status.

## 6. Not checked — UNVERIFIED and UNKNOWN

- No live Tesbo target, authenticated API/MCP request, deployed tools/list, source-to-deploy identity, browser session, current rendered UI, target execution, DB transaction, queue/worker, external agent, CI run, load measurement or production data was exercised.
- No actual source entitlement configuration, human authority mapping, governance quorum, root-recovery policy, operating thresholds, retention/legal deletion policy or client rollout was supplied and verified. A source path or proposed policy does not establish those facts.
- No exhaustive writer/reader/cache/restore/import/alias audit was completed. The full current source-convergence table was not independently re-proved mechanism by mechanism; only the cited claims and targeted paths were checked.
- The supplied source trees/manifests were locally checked, not independently fetched again from the remote provider. The selected source cache is not an exhaustive repo inventory. No conclusion of “not implemented anywhere” follows from a missing cached file.
- No exhaustive clause/link verification of all eight large historical documents or all six complete subordinate histories was performed. Unchecked external research, benchmark, DORA/competitor and historical review claims remain UNVERIFIED by this receipt. The all-claims requirement of an unqualified full EG pass is not claimed satisfied.
- No peer receipts, author retrospectives or target views/reviews were read before freezing this original. Corroboration, prior-findings priority and disagreements with other roles remain UNKNOWN. The primary documents' historical conclusions and specified scenarios were exposed; this was not a blind opportunity-discovery trial.
- Of the 18 repository product-testing files, byte/blob identity was checked for all, while detailed semantic inspection focused on SKILL.md and evidence-and-distillation guidance. The standalone manual-test-authoring text was sampled around relevant modes/oracle/evidence rules. The distinct product brief was identity-checked, not exhaustively semantically reviewed. Missing referenced standalone files, unpublished local edits, installation, assignment and earlier use remain unverified.
- The new conceptual cases here are not authentic human study results. The isolated pure-function probe is not an executed product acceptance scenario. Counts of the 125 scoped definitions, eight GEX-AC obligations, SK-E2E-41..44 aliases or semantic variations do not become passed tests.
- No evidence establishes improved discovery, transfer across real applications, useful human comprehension, calibrated risk, root-cause accuracy, defect recall, economic value or full journey completeness. Prior synthetic comparisons were not rerun or treated as causal proof.
- No independent provider audit of this invocation or different-model-family corroboration is asserted. A cold context supports this method's stance; it does not eliminate common model bias.
- No product decision, publication approval, merge authorization, operating acceptance or freeze is issued. No Skill, canonical charter, repository branch, target record or frozen input was changed.

**Final bounded disposition:** preserve this original receipt as advisory evidence. Triage EG-V32-01 through EG-V32-03 on their demonstrated, limited consequences. The examined current proposal contains the main truth, authority, reuse and failure distinctions needed for the stated outcome, with substantial implementation and empirical gates still explicitly open. That assessment is narrower than a complete specification pass. Later source/input changes or informed comparison require a separate delta; they must not overwrite this original.

