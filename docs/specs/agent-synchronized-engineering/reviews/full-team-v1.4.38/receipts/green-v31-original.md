# Green Team report v0.3 — Tesbo graph reasoning and governed Skills

**Receipt:** GREEN-TESBO-1.4.31-C3-ORIGINAL  
**Recorded:** 2026-11-20T05:26:52Z  
**Reviewer:** independent Green reviewer `/root/green_v31`  
**Method:** unchanged Green Team Charter v5.8, team README and review-orchestration at `NesberryEnterprise/Nesberry@d83549c85a4dcd047fb40dc4fba4ec62737ab0fc`  
**Stage:** preliminary specification-adequacy and source-grounded integration review; original cold receipt, frozen before peer/informed reconciliation  
**Disposition:** scoped support for the existing-owner design, with one Medium source-reconciliation finding and one Low documentation finding; implementation admissions and formal upstream gates remain open. **No formal Green verdict, architecture freeze, runtime pass, deployment approval or Skill activation is issued.**

## 1. Scope, independence and actual quorum

The desired outcome is for Tesbo to help people and authorized agents understand relevant application behavior and changes, create useful native testing/engineering records, and make trustworthy decisions across different target applications and kinds of work. I assessed whether the proposed graph reasoning and governed guidance serve that outcome without creating competing authorities, losing historical meaning, or treating authored guidance as enforced behavior.

The original Green charter requires a spec maintainer/verifier operator plus at least one reviewer independent of the active area, with a two-member quorum for a formal verdict, required target-verifier exit 0 and reviewer sign-off. The coordinator is the declared spec maintainer/verifier operator; I am the independent analytical reviewer. My execution of the verifier and this receipt are **one person's reviewer contribution**, not two members or independent human approval. I have not inspected or received the coordinator's formal sign-off or the required upstream gate receipts. This receipt therefore does not manufacture quorum or certify the prescribed sequence.

The original method puts Blue archaeology, Red premise challenge, applicable SUJT reconstruction and White's pre-architecture gate before architecture, then specialist review, Graph closeout and White freeze. This continuation reviews an explicit proposal while those formal dependencies remain pending. Source review may continue; it cannot retrospectively turn this into a completed pre-design sequence. Formal Graph closeout, White disposition, Security/Purple/QA evidence and their actual authority remain dependencies.

I started with the supplied primary inputs and unchanged charter. I did not open peer receipts, author retrospectives, the subordinate `views/reviews` directory or `list_agents`. The proposal itself contains historical review statements and source diagnoses: notably canonical 00's dated review history and 1.4.31 reconciliation, canonical 03's source-fit map, canonical 05's prior-evaluation qualification, and canonical 06's account of recovered methods and inconclusive comparisons. This is disclosed exposure to primary proposal content. It makes this an independent review of an explicit proposal, **not a blind opportunity-discovery experiment**, a held-out method trial, or proof that the method newly discovered any already disclosed idea.

The manual-test-authoring source, product brief and recovered repository method pack were available before this receipt. They are source content under review; their instructions did not amend the current review charter, grant execution authority or become installed Skills. I did not alter frozen inputs, source branches, native records, databases or Skills.

## 2. Exact input binding and work actually performed

### Specification and verification identity

| Input | Exact binding |
| --- | --- |
| Candidate | `/workspace/scratch/40f0abd3bdbc/input-v31-candidate3`, revision `1.4.31-candidate-3` |
| Candidate manifest SHA-256 | `7af22eba9961a157916cdcca8cd1692ddf6848df4c75342bda00fc8f95bb7804` |
| RUN-CONTEXT SHA-256 | `f29eeaf277bb28e21304fa8898ac986e550b3a4f8fb124b786783e3b03c801f2` |
| Canonical files | `00_README.md`, `01_PRODUCT_REQUIREMENTS.md`, `02_WORKFLOW_AND_UX_SPEC.md`, `03_TECHNICAL_DESIGN.md`, `04_MCP_API_CONTRACTS.md`, `05_IMPLEMENTATION_BACKLOG_AND_TEST_PLAN.md`, `06_IMPLEMENTATION_AGENT_BRIEF.md`, `07_UI_DESIGN_TASKS.md` |
| Subordinate views | `AGENT_RULE_TEMPLATE.md`, `README.md`, `design.md`, `implementation-plan.md`, `requirements.md`, `skills-governance.md`; these are not a ninth authority |
| Baseline | `/workspace/scratch/40f0abd3bdbc/input-v30`, canonical v1.4.30, parent archive SHA-256 `cccc79be82a65faf3a0f3c5ad34b05ebe802151791eef413f9bafbf6e2f05110` |
| Declared verifier | `/workspace/scratch/40f0abd3bdbc/verification/verify_spec_package.py`, SHA-256 `94f19e6e30e078c34b660fffa51655e8b6d4e4bce5c3343ae33bd49a8aae7ddc` |
| Independent verifier result | `/workspace/scratch/40f0abd3bdbc/verification/green-document-check.json`, SHA-256 `c48d61e49e7fa02f18f461b729d3fd6654b972c1d3b9e17cf23c64a70cc395d1` |
| Supplemental local checks | `/workspace/scratch/40f0abd3bdbc/verification/green-supplement-check.json` |

The candidate manifest and verifier result retain every candidate file's byte count and SHA-256; this receipt binds those exact bytes rather than an unpinned mutable title.

### Source and method identity

| Input | Scope actually used |
| --- | --- |
| Tesbo base `6897f989b055a955280f810c7daace86f74057fa` | Exact Git objects in `/workspace/scratch/307cd95373fe/tesbo`; read `AGENTS.md`, `CLAUDE.md`, and the baseline Requirements linked-read implementation. No mutable-checkout inference. |
| PR167 `419c2efa08b04aff6c7c7d0d56425eb572bd6ec2` | Selected byte-verified backend/source cache `/workspace/scratch/40f0abd3bdbc/source419` and full 261-blob frontend supplement `/workspace/scratch/40f0abd3bdbc/source419-frontend`. Inspected root/backend/frontend dependency manifests, selected graph/model/native writers, migrations and frontend consumers. |
| PR167 later `e3d0ebcbe8ec88c5b191abdf2b1d352d44929747` | Independently compared the two supplied complete, non-truncated remote-tree inventories: exactly seven changed blobs, no backend changes, and no change to the inspected Requirements page. Rehashed all supplied supplemental blobs; did not execute their tests. |
| Subordinate lineage | Parent `264380c28a6844e9a349968d9317f7a6b33daccf`, incoming `c12b8956bc1f219c6430e205eb1688e7833bd9cf`; candidate views are local reconciled proposal content. Rehashed the six recovered incoming blobs as part of the supplemental checks. |
| Original method | `/workspace/scratch/ce8c3109f396/assurance-source-recovery/Nesberry-d83549c85a4dcd047fb40dc4fba4ec62737ab0fc/.kiro/steering/teams/green-team-charter.md`, README and orchestration. Read the indirect portability policy `docs/policies/governance/POL-GOVERNANCE-ASSURANCE-PORTABILITY/v001.md`. |
| Recovered method pack | `/workspace/scratch/40f0abd3bdbc/method-inputs/repository-d83549c8/product-testing`; 18-blob manifest SHA-256 `c508317a49c153769324659d384406fe5e6ceebd68c4bb0f7e62177cb058b55d`. Read the core, evidence/distillation, coverage/variation, AI-assisted testing and Nesberry-adapter references. Other files were byte-verified, not all semantically read. |
| Other method sources | Standalone `Pasted markdown(86).md` and distinct product brief `creating a testing tool to make my job easier/Pasted text(6).txt`; source manifest SHA-256 `4127b0516ea6fd1626823e9febe2826f857fb56e89cf42311042783c2aeed426`. Read authoring modes, contradictory oracle rules, deferred-state rules and relevant brief sections on provisioning/evaluation/delivery. Supporting standalone reference files remain unavailable. |

I read applicable current contracts across all eight canonical files and six views, concentrating on revisions 1.4.28–1.4.31, R-ASE-01–48, source convergence, ASER-C01–06, current workflow/UI allocations, source-free QA, graph semantics, acceptance allocation and method adoption. I inspected headings and targeted earlier baseline contracts where needed. This is not a claim to have semantically reread every historical paragraph or exhaustively audited every repository file.

The source `AGENTS.md` and `CLAUDE.md` at the two inspected implementation pins are byte-equivalent. Their shared-database and deployment/E2E instructions were respected: no server, database, browser runtime, deploy or E2E command was invoked. Declared dependency versions were inspected as source declarations, not resolved installed or deployed versions. A guessed `src/auth/review-principal.ts` path did not exist; I located and read the actual `src/common/human-review-principal.ts` through source imports/search. That failed lookup is not evidence that the control is absent.

### Executed local checks

From the verification directory I independently ran:

```text
python3 verify_spec_package.py --candidate ../input-v31-candidate3 --baseline ../input-v30 --workspace .. --output green-document-check.json
```

Result: **exit 0; 60 declared document/input checks passed; 0 failed assertions**. The scoped definition counts were ASE-E2E 15, ASE-FLOW 54, SK-E2E 40 and ASE-INT 16, totaling **125 planned definitions**. These are not 125 executed product tests. The verifier establishes its declared structure, header, identifier, mirror, canonical-link and byte-integrity properties; it does not establish semantic completeness, all-writer enforcement, Skill effectiveness or runtime behavior.

I separately checked existing-target relative anchors in the six subordinate views: 12 such links checked, with five broken references to one removed heading. Links to review files outside the six-file snapshot were classified as unavailable in this snapshot, not asserted broken in the remote repository, and were not opened. I also rehashed 13 supplemental input blobs (six incoming views plus seven implementation-delta blobs), with zero mismatches. These additional checks do not change the declared verifier's successful result or inflate it into a broader pass.

## 3. Findings — Critical / High / Medium / Low

### Severity summary

| Severity | New findings in this bounded review | Meaning |
| --- | ---: | --- |
| Critical | 0 identified | No universal absence-of-defects claim; formal freeze remains unavailable. |
| High | 0 new specification defects established | High-consequence implementation admissions below remain open and cannot be waived by this result. |
| Medium | 1 | Current source reconciliation omits a material frontend improvement and leaves a misleading inherited gap statement. |
| Low | 1 | Five subordinate method links target a heading that no longer exists. |

### GREEN-M01 — Current Requirements linked-read handling is not reconciled into the current source-fit map

**Disposition:** confirmed documentation/source-reconciliation gap. **Confidence:** high for the named path and exact pins. **Owner:** canonical 03 source-fit section and its subordinate design mirror; related implementation/UI tasks retain their existing owners.

**Expected:** Green's mandatory spec↔code reconciliation and Tesbo P-01/P-08/P-13 require the current proposal to distinguish the baseline defect from corrected source, identify the reusable correction, and preserve still-open siblings and runtime evidence.

**Observed:** canonical 03 §18.2 says the Requirements page's linked-provider reads convert failures into empty keys/counts/tasks and instructs preserving successful-empty versus unavailable/stale/denied/partial and project/request identity. That describes the base `6897…` `refreshLinkedKeys` implementation, whose three calls use `.catch(() => ({ keys: [], counts: {}, tasks: {} }))`.

At `419c2efa…`, `Tesbo-Frontend/app/(app)/projects/[id]/requirements/page.tsx` now contains `LinkReadStatus = loading | available | unavailable | denied | stale`; `refreshLinkedKeys` uses `Promise.allSettled`, fences old project/request responses, clears cached payload on denial, and retains temporary-outage data only with a stale state. `tcCountFor` returns undefined outside `available`, task state becomes `Unknown`, authoring refuses until coverage reads are available, and the UI explicitly says unavailable coverage does not mean no cases/tasks exist. See the type/helper declarations, `refreshLinkedKeys`, `handleGenerateFromTicket`, the unavailable/stale status notice and `requirement-coverage-unknown` branch. The supplied full-tree comparison shows this file is unchanged at `e3d0ebcb…`.

Canonical 03 §18.2.1 reconciles other PR419 improvements but has no corresponding Requirements-read row. The earlier paragraph is not directly bound to `6897…` and can be read as an unresolved current-source implementation description inside the current convergence guidance. Its obligation remains correct, but its current source/maturity allocation is incomplete.

**Consequence:** an implementer can repeat or replace an already useful native guard, or a reviewer can carry the old blanket finding into a corrected source tree. Either outcome undermines reuse and accurate proof planning.

**Minimal correction:** preserve the old finding at the base pin; add the current linked-read correction and its source-only status to §18.2.1 and its mirror, with KEEP/EXTEND guidance. Bind §18.2's old statement explicitly to the base. Do not mark all Requirements failures fixed: other reads still need their own assessment. In this source, `fetchTickets` catches and returns undefined, `refreshSummary` catches to null, and initial provider-status failures can become `connected: false`. Those are different paths; the inspected link-state correction alone neither condemns nor certifies their behavior.

**Discriminating follow-up:** at the final authorized build, exercise successful-empty, temporary unavailable with/without cached data, denied access, out-of-order refresh and project switch for linked counts/task state. Confirm that blocked generation cannot create a duplicate and that an unrelated healthy provider remains usable. Separately classify ticket/summary/provider-connection failures. No such runtime check ran here.

**Valid alternative:** if the team intentionally keeps the entire §18.2 passage as historical base archaeology, an explicit base-pin label plus a current source-fit row is sufficient. No new service, fetch framework or UI pattern is required.

### GREEN-L01 — Five subordinate references still target the replaced method heading

**Disposition:** confirmed document-navigation defect. **Confidence:** high. **Owner:** the five existing subordinate consumers and their normal document check.

The following candidate references point to `skills-governance.md#1341-principle-distillation-and-contextual-instantiation`: `AGENT_RULE_TEMPLATE.md:55`, `README.md:161`, `design.md:330`, `implementation-plan.md:100`, and `requirements.md:57`. The target file has the heading `13.4.1 Portable method for discovery and principle distillation` and no explicit anchor retaining the old name. Its generated anchor is `1341-portable-method-for-discovery-and-principle-distillation`.

**Consequence:** the agent template and other views fail to navigate to the method they require. This is a narrow traceability/recovery defect, not evidence that the method content is missing or ineffective. The declared verifier checks canonical relative links only, so its pass is consistent with this finding.

**Minimal correction:** update those five links to the actual heading or retain one deliberate compatibility anchor at the existing method owner. Extend the current verifier's link scope if the six views are intended to be runnable navigation inputs. Do not add another method copy or a new validation subsystem.

**Proof:** `/workspace/scratch/40f0abd3bdbc/verification/green-supplement-check.json` preserves the exact links and target-exists/anchor-absent result. No runtime is needed to establish this defect.

## 4. Source reconciliation and reuse decisions

The following are independently inspected source facts and bounded design consequences. Several correspond to gaps already named in the candidate; they are corroboration and admission tracking, not newly discovered missing requirements.

| Capability | Source evidence and maturity | Green allocation and unresolved proof |
| --- | --- | --- |
| Bounded graph impact | `behavior-graph/qa-review-candidates.ts` derives candidates only from case changes and explicit `references_cached_requirement` edges; returns `coverageAssertion: none`, `executionAssertion: none`, `upstreamFreshness: unverified`. | **EXTEND** the existing projection with accepted semantic mappings and explicit incompleteness. Do not relabel current direct-reference traversal as general source-to-test impact. |
| Model path proposals | `model-studio-generator.ts` is bounded deterministic BFS, with `tesbo-fsm-bfs/1`, forecast/unknown/bounds and no execution/coverage claim. `model-studio-preview.core.ts` limits the supported sequential model schema. | **KEEP/EXTEND** that replaceable seam. Deterministic generation is a legitimate baseline. Rich guards, data, time/concurrency and external action resolution require versioned capability admission; prose cannot add them. |
| Current versus saved/approved model | `saveRevisionForUser` creates newest draft; `approveRevisionForUser` permits only newest; `dispatchRun` selects greatest `revision_number` and rejects a prior revision. Frontend Model Studio uses latest-revision controls. | **EXTEND** the current native identity with explicit active-selection/CAS/history if the proposed contract is adopted. Saving r2 currently makes r1 nondispatchable; the candidate correctly requires separate selection and migration. This is a source/spec difference, not a demonstrated deployed incident. |
| Native case/run materialization | `createCasesFromPathsForUser` passes `{client, afterCommit}` to the native writer; `dispatchRun` passes its client to `createCycleWithTestcasesForUser`, verifies exact selection cardinality and records actual cycle-item/execution/snapshot identities in the manifest. | **KEEP** shared native transactions and occurrence provenance; **COMPOSE** future reasoning above them. Final integrated rollback, race and retry proof remains required. A prepared Run still does not prove a target action. |
| Model-case relationship history | `linkCase` validates supplied revisions but permits omitted `testcaseRevision`; `unlinkCaseForUser` physically deletes mapping rows. Dispatch retains its relied-on mappings in the run manifest. | **EXTEND** existing typed relationship history. Never-dispatched links and removal decisions also need retained, permissioned history; run manifests alone do not supply it. Preserve honest unknown legacy basis. |
| Trusted human review | The controller derives `human_session` versus `api_token` from the authenticated transport; `common/human-review-principal.ts` refuses other kinds. Expected hash and current membership checks exist in model approval. | **KEEP** real bearer refusal, **EXTEND** action-bound assent and native-AI origin where required. A non-token session is not proof that the person reviewed the exact protected effect. No full all-entrance claim follows. |
| Native case, KB and proposal substrate | V155 defines semantic/dependency approval snapshots and invalidation, including custom values/tags; V156 distinguishes autosave from immutable submitted/approved/rejected versions; V157 preserves producer/request identity and append-only apply receipts but still updates `generated_payload`. | **EXTEND/COMPOSE** those owners. Do not create another case/KB/approval store. Migrations are source evidence only; they do not prove full Skills assignments, immutable candidate iterations or installed schema. |
| Correction and optional generation | `zyraEditDraft` edits an in-review payload with native field validation without provider allocation. `zyraFeedback` requires eligible status, excludes chat-linked batches and requires a provider allocation before storing the regeneration feedback. | **KEEP** cheap inline correction; **EXTEND** independent original/successor/rejected evidence and feedback acceptance. Do not claim all feedback requires paid generation, or that mutable inline edit already satisfies immutable evaluation history. |
| Source binding | `project-source-binding.management.ts` checks destination owner membership and administrator-approved checkout identity, then upserts one project-keyed row. | **EXTEND** binding/configuration history and actual source-to-destination entitlement under existing owners. The source permission/deployment policy is not supplied; treat private-source admission as conditional/unknown. An evidenced intentionally shared source policy is a valid alternative. |
| MCP consent | `mcp-access.ts` has OFF default, named credential grants, scopes, allowed tools and expiry configuration. | **REUSE** this policy representation; full facade enforcement, asynchronous revocation and purpose/data restrictions are not all re-audited by this receipt. No fresh MCP-session proof exists. |
| Existing UI | Model Studio imports `ModelDraftGraph`, `ModelDefinitionModal`, `LinkCaseModal` and native API operations; Requirements uses the existing workflow/page components and source-state rendering. | **KEEP/EXTEND/COMPOSE** current components, revision selectors and native deep links. No justified new Graph AI page, generic editor or duplicate history viewer was established. Source-inspected; authentic visual baseline and after-state remain blocked. |

Dependency manifests show a NestJS/PostgreSQL backend, a Next.js/React frontend and repository quality tools, including dependency-cruiser. These establish existing stack/seams at the pinned source, not a reason to install a graph database, adopt a competitor product, or report package/runtime health. External research links in the proposal were not independently researched in this receipt, so their empirical results or adoption fitness are not certified.

## 5. Independent problem reconstruction and negative space

The material user outcome is a decision a person or authorized service can safely make from relevant evidence. A graph is useful only if it helps that decision. The work can begin with code, a policy/manual change, an accepted requirement, an unexplained test result or an ordinary tester observation. It may finish with a correction, a native candidate, a justified no-change result, a blocked question or an actual authorized test. A new model, Skill or case is not required in every path.

The affected actors are the tester, developer/external coding agent, native AI, requirement/policy/document owner, configured governance human, release decision maker and downstream consumers. Job labels do not establish privileges. Material state includes authorship, review, effectivity, current applicability, execution, retention, access and evidence availability; one overall green status cannot replace these independent dimensions.

| Dimension reconstructed from the outcome | Candidate disposition | Why it matters / remaining boundary |
| --- | --- | --- |
| Expected rule versus shipped behavior | **REPRESENTED** — R-ASE-14/40, canonical 01 quality/grounded analysis, 03 semantic claims, 06 source reconciliation | An observed defect cannot teach the system that the defect is expected. The standalone method's contrary rule is correctly blocked from adoption. |
| Work without source code, model or automation | **REPRESENTED** — R-ASE-06/48, canonical 02/03 manual-first path and I3-Q | Ordinary manual QA and case-free exploration remain legitimate. Runtime proof of that retained workflow is still unavailable. |
| Scope loss: inaccessible, stale, partial and unsupported context | **REPRESENTED** — ASER-C01/C06 and graph input/output contract | Unknown retrieval cannot produce zero impact, no duplicates or full coverage. Current linked-read correction should be reconciled under GREEN-M01. |
| Policy/manual-only change | **REPRESENTED** — semantic extension, GEX-SEM-02/03 allocations | Meaning and effectivity can change with no commit. A wording-only change may legitimately leave binding behavior unchanged. |
| Historical reliance across model/case/Skill/assignment revisions | **REPRESENTED; IMPLEMENTATION PARTIAL** — ASER-C02/C03, MBT selection, V155–157 source | Current selection, exact historical mapping and immutable feedback remain implementation admissions, not missing conceptual owners. |
| Actor, fixture, build and environment variation | **REPRESENTED** — coverage denominator and causal/flakiness contracts | Two runs on different conditions are not interchangeable evidence; a source-only root-cause hypothesis stays a hypothesis. |
| Honest human manual observation | **REPRESENTED** — canonical 01/03/04 | A human need not fabricate a machine receipt. Agent self-report cannot masquerade as that human. |
| Loss/revocation of authoring guidance while receiving a failure | **REPRESENTED** — R-ASE-25/30 and ASER-C03 | Block stale governed publication while preserving independently authorized raw failure evidence; do not let governance suppress bad news. |
| Corrections, rejected interpretations and no-change decisions | **REPRESENTED; IMPLEMENTATION PARTIAL** — feedback contract, SK-E2E-31/38/39 and ASE-FLOW-54 | A mutable payload or generation success is not a retained comparative record. Source recovery and adoption are distinct. |
| Information restricted to one audience/purpose | **REPRESENTED** — R-ASE-28/29/31/46, ASER-C06 | Derived graph explanations, counts and exports must not leak a protected source or inherit its authority. Full enforcement remains unverified. |
| Multiple repositories, releases and delayed events | **REPRESENTED; IMPLEMENTATION PARTIAL** — R-ASE-37/45, ASER-C02 | A shared commit can participate in different releases; rebinding must not rewrite the origin of delayed events. The current project row is not the future contract. |
| Cost, incomplete exploration and cold-start risk | **REPRESENTED; NUMERIC ENVELOPE DEFERRED WITH GATE** — R-ASE-36 and ASER-C06 | Partial analysis can be useful, but cannot claim exhaustive traversal. Budgets are an implementation prerequisite, not unbounded discretion. |
| Retention/erasure against immutable audit | **REPRESENTED; POLICY UNKNOWN** — 03/04 retention, historical references and access rules | Immutability does not grant permanent disclosure. Exact legal/organizational retention and permitted erasure need the accountable policy owner. |
| Operational authority, bootstrap and emergency recovery | **UNKNOWN / NAMED GATE**, not N/A | The proposal names the required authority but the run supplies no configured human governance. Fail-closed adoption is appropriate; no reviewer can fill this by assumption. |
| Comprehension and real usefulness | **PLANNED, NOT OBSERVED** — canonical 07 and R-ASE-47 | A fluent explanation, graph count or synthetic persona cannot establish whether real testers understand or benefit. |

No additional stateful domain is justified by this pass. The model expresses the material negative-space concerns above at the specification level; most remaining uncertainty is whether the stated owner contracts are implemented and usable. That is a bounded adequacy judgment, not exhaustive full-journey assurance. The historical 49-journey list and 125 definition count cannot substitute for a newly reconciled applicable journey inventory and its per-journey evidence.

## 6. Candidate relationships and participation scope

I challenged links at the grain another actor can actually rely on. The following relationships have real value and fit the existing owner allocations. They do not justify a generic graph product.

| Candidate meaning and direction | Cardinality / owner / evidence | Lifecycle, grain and permissions | Disposition |
| --- | --- | --- | --- |
| Policy obligation → enforced by control; separately → checked by assertion | Many-to-many; approved policy, source/control and case owners | Exact obligation/control/assertion revisions, entrypoint scope and mapping decision; a private control does not become visible through public policy | Already represented in ASER-C02. Preserve separate enforcement and verification edges. |
| Manual section → describes accepted behavior | Many-to-many; KB manual and behavior/requirement owners | Stable section or content digest, audience, exact subject revision, review on change; guidance cannot approve policy | Already represented. Semantic extension adds a useful interpretation seam, without a new manual owner. |
| Authored candidate → authored under effective method resolution | One resolution with many Skill/assignment versions; native artifact plus T-422 | Immutable authoring input and composition basis; later revocation affects future reliance, not the old record; permissioned history | Already represented. Shared reasoning metadata is justified; shared publication machinery must preserve each domain's authority. |
| Finding occurrence → observed on target context → retested by attempt | Many-to-many; native Bugs/findings, Runs and evidence | Exact occurrence, build/environment/fixture and expected/case revision; original result survives cause/flake relabeling | Already represented. A current case ID or latest Passed result is insufficient historical evidence. |
| Source event → original binding configuration | Many-to-many with dedupe; source/capture owners | Immutable configuration generation and provider event/revision; source entitlement checked separately from destination ownership | Represented but not fully implemented in inspected storage. Extend existing binding owner. |
| Human decision → relied-on evidence/build/risk context | One fixed context containing many refs; existing review owner | Exact selected native operations and obligations; changes require a new decision; summary access does not expose source payloads | Represented. Do not promote the Change Packet into a second approval or writable release owner. |

Participation differs by job: the requirement/case/manual is primary when being authored; effective Skills are supporting guidance; a source capture is observed input; target results are execution evidence; the Change Workspace is a projection. A Skill used as the subject of its own proposal remains a candidate under a separately approved root. One shared resolver therefore does not imply one UI, one review role or one lifecycle.

Rejected alternatives: a universal `verified_by` edge, a link to mutable latest state as historical proof, a new graph-owned copy of native results, and a graph confidence score that grants policy authority. Each collapses distinctions the user needs to make a trustworthy decision.

## 7. Mandatory second-order opportunity pass

| Green question | Outcome-derived answer |
| --- | --- |
| Sibling capability | Requirement drafting, manual/policy maintenance and test-case/graph interpretation all need applicable guidance, exact provenance, uncertainty and independently authorized publication. These are concrete specified siblings. |
| Common substrate | Identity/scope, immutable versions, accepted authority, effective assignments, bounded retrieval, protected native writes and auditable correction repeat. Domain content and decision authority remain distinct. |
| Architectural compression | Compose the existing KB/case/proposal/graph owners and one T-422 resolver. A packet/workspace is a read projection. The proposal largely achieves this; the source fit must continue to narrow new storage to genuinely missing invariants. |
| Adjacent-category scan | Dependency-selection tooling supplies bounded structural reachability; document-control methods supply revision/reliance; testing methods supply independent oracles and discriminating evidence. These patterns are visible in inspected source/method inputs. Their value is the invariant, not a copied IDE, CMS or agent-control-plane product. External comparative research remains unverified in this receipt. |
| Platformization boundary | Three authoring consumers justify examining a shared guidance contract. They do not justify another agent studio, universal workflow engine, new graph database, autonomous approval or a full experimentation platform. |
| Value of option | Recording exact content/assignment/source basis now prevents costly later reconstruction for accepted models, manual corrections and multi-client handoff. A narrow schema seam is valuable even when richer AI/risk ranking is deferred. |
| Prematurity | Architecture now: authority classes, exact version/reliance, resolver and bounded proposal contracts. Implement only the smallest admitted owner extensions. Defer runtime inference, active learning and general distributed-model semantics until supported uses and evidence exist. |
| Spec↔code reconciliation | Current code contains meaningful native transactions, immutable snapshots and narrower graph/model capabilities. It does not establish the full target. GREEN-M01 corrects one missed source improvement; named current admissions remain. |
| Business/operational value | Reduced duplicate authoring and quicker evidence-based review are plausible value. No observed savings, monetization, defect-reduction or marketplace claim is established. Preserve measurement as a later comparative decision input. |
| Cross-channel/role continuity | Native UI, external MCP, native AI, imports and jobs must preserve the same native identity and final admission. Role-sensitive summaries may differ without duplicating facts. All-entrance proof is still required. |
| Hardest/opposite sibling | A source-free manual test or policy-only review with no AI provider, no formal model and restricted evidence must still retain authorized observations and a useful next action. The specification permits it; the original I3-Q and manual acceptance paths must prove it. |
| Orthogonal axes / brand deletion | Removing the GEX/ASER/Skills branding leaves guidance resolution, source observation, normative content, accepted mapping, review and execution truth. These belong to existing owners. None of the brands earns a new domain solely by name. |
| Participation scope | Skills are supporting method, Cases/Requirements/Manuals are authored subjects, Runs are execution, and Workspace is projection. A separately approved meta-skill governs Skill authorship; no self-authorizing recursion. |

**Three-use result:** the shared reasoning/metadata contract is earned by cases, requirements and manuals/policies. Shared runtime extraction remains conditional on demonstrated implementation reuse and native ownership; a source file's repeated words are not sufficient. Generalize the invariant now, extend the present native owner where evidence warrants, and defer additional storage/runtime until a concrete consumer needs it.

## 8. R↔D↔T traceability and proof sufficiency

Canonical 05 supplies 48 R-ASE crosswalk rows. Its GEX allocations and semantic aliases preserve existing identifiers; canonical 01 describes requirement obligations, 03 ownership and mechanisms, 04 transport/effect boundaries, 02/07 workflows and UI, and 06 the candidate operating method. That is a coherent navigation and responsibility structure. The declared verifier's preserved-ID check is not a zero-orphan semantic proof.

I traced these material chains rather than treating every nonempty cell as sufficient:

| Requirement chain | Design / contract / work | Evidence obligation and assessment |
| --- | --- | --- |
| R-ASE-05/14/19/40: grounded relationship meaning and independent oracle | 03 GEX composition/semantic claim; 04 C01/C02 and bounded analysis; I4/F4, T-426/457/458 | ASE-FLOW-21–28, 33–36, 43–47 and GEX-SEM aliases distinguish observation, norm, mapping and actual proof. Appropriate planned falsifiers; not run. |
| R-ASE-06: useful manual cases, no model prerequisite | 02 manual path; 03 manual-first/native case owners; C03; I3/I3-Q | ASE-FLOW-29–34/37/38/45/46/48/49, SK-E2E-31/32/35/37 and original QA loop obligations address usability and evidence. An authored case still needs concrete executable data/actions/oracle when instantiated. |
| R-ASE-21–27/30–34: effective guidance and non-escalation | T-422/D-14, 03 Skills contract, C03/C06, S0/S1/S2 | Immutable versions, separate approval/activation, drift/revocation and all-reader/writer controls have explicit tests. Bootstrap/assent and full source conformance remain gates. |
| R-ASE-37/45: reliable observations and binding history | Existing source coordinator/binding/history, C02/C04/C06, I1/F1 | ASE-FLOW-17–20/27/28 and integration negatives distinguish source capture, loss/rebind and entitlement. Current mutable binding and missing runtime evidence prevent closure. |
| R-ASE-32/44/47: evaluated improvement | 03 feedback/evaluation; 04 feedback contract; 06 fixed candidate method; 05 1.4.30 qualification | Independent selection, comparable inputs, valid no-change/UNKNOWN cases, held-out outcomes and no authority regression are explicitly required. The cited prior equal/inconclusive trials cannot be counted as improvement. |
| R-ASE-41/48: usable cross-role continuation | ASER-UX01–03 and existing D-14/Zyra/native screens | Partial state, restricted evidence, no forced seven mutations, return context and authentic UI proof are allocated. Source inspection supports reuse, not real comprehension or rendered parity. |

The expanded semantic conditions are variations under 125 planned definitions. Implementation evidence must identify each actually executed condition and its result, rather than reporting one passed parent ID as proof of every aliased scenario. The candidate expressly requires this, which is the correct control. Full R-D-T and journey adequacy still needs the actual Graph/QA reconciliation; this receipt supplies a risk-based trace sample, not exhaustive full-system completion.

## 9. Portability and method-source reconciliation

The recovered `product-testing` core already requires outcome-first checks, independently established expectations, affected-consumer analysis, honest execution/disposition distinctions and fixed-wording transfer evidence. Those are not new inventions of the Tesbo candidate. Its adapter explicitly contains Nesberry-specific rules, commands, actors and incidents. The portable method should reuse the generic reasoning while a Tesbo binding supplies current authority, owners, actual tools and execution limits. Neither Nesberry's CMS restriction nor its Medusa/ISS/checker bindings became Tesbo requirements in this review.

The standalone manual method contains a material internal conflict: its early Mode C workflow prefers shipped behavior over a requirement, while its later deferred/WIP section requires the accepted contract as Expected Result. Canonical 06 resolves this correctly at proposal level: real UI/source grounds executable steps; independently accepted authority grounds correctness. A legitimately limited release can define a limited outcome if its authority is evidenced. Missing authority remains unresolved. The original source text must stay preserved, and a reconciled successor still needs its own evaluation/adoption.

The brief is a separate source: it names local/uncommitted files and an authoring profile not established by the recovered repository pin. Automatic workspace provisioning and reviewed version pins are product requirements; they are not proof the pack is installed or that a specific local revision exists. A role/module/context hierarchy, workbook layout or wording convention can be a scoped profile; it must not displace API-only, mobile, non-UI or service/event actors.

I used these bounded conceptual counterexamples to challenge the proposal, not to claim empirical transfer:

| Context | Required check / valid alternative | Bounded result |
| --- | --- | --- |
| Offline mobile workflow, human tester, no source or AI provider | Derive expected recovery from accepted project behavior; preserve actual manual observation and unknown build. Do not require a Git graph or machine receipt. | Candidate permits the path and makes unsupported automation explicit. Runtime continuity remains untested. |
| API/event service with a policy-only change | Trace the service actor, event scope, accepted obligation, forbidden downstream effect and independent evidence. A visual role hierarchy is irrelevant. | Candidate's policy/manual-only trigger, scope and optional lenses can express it; exact adapter and oracle must come from that application. |
| Stable deterministic mapping with no ambiguity | Existing traversal/version comparison or human review is sufficient; no new Skill or AI invocation is necessary. | Candidate explicitly permits no-change/deterministic outcomes, so probabilistic interpretation is not mandatory. |
| Contradictory unapproved instructions with restricted evidence | Preserve permission-safe UNKNOWN and request the accountable decision; do not invent a norm or leak hidden sources. | Candidate preserves uncertainty and authority separation. The real governance owner remains unavailable in this run. |

These are conceptual applications after reading the proposal, not unseen tasks, comparative outputs, live tests or an admission receipt for a new universal rule. No causal claim that the candidate improves discovery is established. The existing original method and human/manual alternatives remain legitimate comparators. No charter or Skill wording was modified here.

## 10. Open dependencies, exclusions and bounded disposition

### Admissions that remain open

1. **Actual upstream sequence and formal membership:** coordinator/verifier sign-off, Blue/Red/SUJT/White pre-architecture artifacts and applicable specialist receipts, followed by Graph and White's own disposition. This receipt cannot infer them.
2. **Governance authority:** real human action-bound assent, root/bootstrap/recovery authority, domain-review capabilities, no-skill exceptions, retention and approved budgets. Missing configuration is UNKNOWN/BLOCKED for affected promotion, not invented authority.
3. **Current native model applicability:** active selection distinct from save/approval, migration of old clients, historical mapping provenance and current/all-consumer semantics.
4. **Complete candidate/feedback history:** original, successor, rejected/no-change and unavailable-generation evidence under the native owner, including matching failures and retained corrections.
5. **Source and all-entrance enforcement:** source entitlement and binding generation, final-owner authorization, compatible native/MCP/import/job consumers, retrieval disclosure and revocation after waits. This source sample does not establish universal enforcement.
6. **Runtime/UI/user evidence:** final integrated real-boot database/API/MCP/browser tests, authentic existing UI baseline, keyboard/responsive/recovery checks, original case-free loop, real human comprehension and method comparison. All remain NOT RUN/NOT OBSERVED here.

This review excludes live target behavior, production configuration, installed migrations, deployed identity, actual customer permissions, source-provider credentials, external tool installation, empirical dependency adoption, exhaustive E2E coverage, all file contents in the recovered pack, and every entrypoint of the full repository. It is a focused original Green review of the proposed graph/guidance integration, not a full assurance closure claim.

**Recommended next action:** reconcile GREEN-M01 at the existing source-fit owner and repair GREEN-L01 in the existing views, then preserve this receipt and issue a separately labeled informed delta for any changed candidate. Continue implementation only through the already named source, authority and proof admissions; do not add new product domains in response to this review. Green's two-member formal verdict and White's freeze remain unissued. The useful outcome of this pass is a coherent existing-owner direction with precise limits and two bounded corrections, not certification of a running product.

---

**Original-output freeze:** this file is the original independent receipt. Subsequent disagreement, source changes or peer reconciliation must be recorded separately; do not rewrite these original findings or their scope.
