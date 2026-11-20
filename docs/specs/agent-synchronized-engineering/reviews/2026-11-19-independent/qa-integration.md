# QA Team — independent raw integration receipt

## Run context and authority

- Target: Tesbo, `1alextest/Tesbooboo`, draft PR167 into `development`; not Nesberry.
- Review pin: local `3299691e11941d5ab701c2f9b2dc53ff29d808da`, tree `332665d638e38a635ead798f87e2ed192d66a8d3`.
- Full integration base: `6897f989b055a955280f810c7daace86f74057fa`; repair delta base: `d65edc5e4dccc10117fd8c81a77a0cea509ab5c9`.
- Method pin: NesberryEnterprise/Nesberry `d83549c85a4dcd047fb40dc4fba4ec62737ab0fc`; unchanged QA Team Charter v1.6, complete review orchestration and portability/evidence policies. No Nesberry product taxonomy or operational role is imported into Tesbo.
- Canonical spec input: eight Markdown specifications, revision1.4.28, parent-supplied archive SHA-256 `6094687758ebf1e5dfa3c6ed8e2209b8967a190523815ba1e1197d11867374ef`. Parent supplied this archive identity; this receipt does not imply independent ZIP hashing.
- Tesbo AGENTS.md, CLAUDE.md and frontend instructions read. This run is source review plus authorized local non-DB checks only. No live environment, database, migration, browser, login, credential, deployment or customer mutation is authorized/performed by this QA reviewer.
- Intended bounded outcome: native exact human case review/publication, explicit project MCP exposure/consent, reviewed knowledge, native Run/Bug truth, governed Model Studio composition. The original external-executor QA loop remains a separate required capability, not presumed implemented by these changes.
- Independent derivation: no author closure findings were opened before the following oracles and denominator. The canonical specs carry historical review statements; those are treated as requirements/leads, not findings for this tree.

## Pre-author-review discriminating oracles

These are acceptance checks, not execution claims. Every refusal must leave the relevant authoritative domain records unchanged; HTTP status alone is insufficient. Each success must be independently read back through the appropriate owner.

| ID | Invariant / expected effect | Conforming neighbor and falsifier | Required boundary |
|---|---|---|---|
| QO01 | A human reviews exactly the current semantic case revision; only that approval makes a current case eligible. | Normal native human review succeeds; direct status=Approved, forged principal, changed semantic/custom dependency, stale revision or inherited clone/import approval must not. | REST/controller principal + service + DB invariant + native Run admission |
| QO02 | Proposal review and selected apply preserve exact selected intent, target, base and dependency closure, with one committed outcome. | Same approved revision retry returns existing outcome; changed proposal/base conflicts; selection excludes rejected/unselected items; late positional matching cannot redirect the target. | Native staging/review/apply transaction, audit and readback |
| QO03 | A project is externally undiscoverable until deliberate authorized consent, with named capability grants. | Native authorized reads/review continue while MCP is off. Both MCP aliases, cached sessions, discovery, reads/writes, token rotation/revoke and role removal must obey current scope at final owner. | MCP transport/auth/policy and native owner |
| QO04 | Canonical KB governed review pins the exact saved semantic snapshot; autosave history is not retroactive approval. | Ordinary draft autosave remains usable; stale CAS, review while save failed/uncertain, restore/edit after approval and legacy null metadata cannot approve new/unsaved content. | Browser write queue + native CAS transaction + immutable snapshot + retrieval |
| QO05 | Late save/read/review response remains bound to original document/project and cannot discard or relabel newer user work. | A→B navigation with queued A writes drains to A; lost ACK readback distinguishes exact committed desired bytes from foreign/stale edits; no blind retry. | Actual document page + queue + API |
| QO06 | Runs admit exactly the requested eligible approved case manifest and freeze the definitions actually selected. | Legitimate mixed approved selection succeeds; missing/foreign/draft/unapproved/mismatched selection rolls back all; re-approval/new case edits cannot rewrite old run truth. | Legacy run transaction, automation/schedule/model entrances and execution snapshots |
| QO07 | Bug association is association only: it cannot mutate attempt outcome/time/performer or historical failures. | Linking a Bug to Passed or Untested case preserves result; explicit native correction remains separately attributable and historical. | Bug create/link + execution/report consumers |
| QO08 | Model path generation remains unexecuted proposal truth; mapping records exact case/model versions. | Approved paths may create Draft cases; no implicit case approval; repeated/concurrent digests create one canonical mapping; failure after one creation rolls back all. | Model repository composing native owner on same transaction client |
| QO09 | Model run dispatch uses active/current approved model + fresh mappings + eligible approved cases and one atomic native run/link/audit. | Valid exact repeat is idempotent; changed payload under same key conflicts; unapproved/stale/archived/missing case, failed provenance insertion or revoked authority yields no stranded native Run. | Model/native transaction, unique keys and audit |
| QO10 | Authorization, locking and entitlement changes cannot be bypassed by an alternate writer or stale queued action. | Positive authorized normal flow survives. Same operation as cross-tenant, member-only, removed/revoked principal or locked project leaves no forbidden records. | Current DB authority + all entrance inventory |
| QO11 | Migration does not fabricate historical human review or rewrite prior actual outcomes. | Old Approved rows without authentic exact receipt become honest legacy/unreviewed state; old Runs retain original snapshots/provenance grade; new and mixed-version writes cannot bypass constraints. | Migration SQL/runner + representative pre-upgrade fixtures in real DB |
| QO12 | Tests assert product truth and ordinary positive behavior, not merely new fixture shape. | Regression fails under deliberately removed guard; changed seed approval may establish legitimate prerequisites but must not eliminate former bypass/partial-failure assertion. | Test diff, production wiring and failing-first witness |
| QO13 | Authentic visual and functional compatibility is tested at identical controlled builds and scope. | Real Before/After, keyboard/focus/loading/error/empty/permission, responsive and adjacent unchanged actions; old screenshots are historical evidence only. | Exact-build browser/runtime evidence |

## Journey denominator fixed before author findings

Consumed and challenged the canonical Grey49 inventory in `05_IMPLEMENTATION_BACKLOG_AND_TEST_PLAN.md` (GJ-01–49):43 High-risk,6 Medium-risk. That historical G0/G1 inventory does not constitute fresh runtime coverage. This review's bounded code increment must be crosswalked against all49, retaining broader deferred work as named gaps.

Core direct/adjacent integration impact set (27 journeys,25 High +2 Medium): GJ-01,02,04,05,11,12,13,14,15,16,17,18,19,20,21,24,28,35,38,39,40,41,42,44,45,46,47.

Broader original-loop/platform obligations (22 journeys,18 High +4 Medium), not claimed complete by this increment: GJ-03,06,07,08,09,10,22,23,25,26,27,29,30,31,32,33,34,36,37,43,48,49. A coupled existing reader/writer discovered in source is promoted into impact scope, not silently excluded.

Evidence totals at derivation:49 inventoried;0 newly runtime executed;0 deployment verified;27 impacted journeys require source/test crosswalk and named branch gaps;22 broader obligations remain not certified. No full-system PASS or release/freeze verdict can follow from this review alone.

## Execution and source findings

Finalized for the pinned source only. **QA disposition: NOT READY.** The original external-executor QA loop is not implemented by this increment; this review does not certify full-system acceptance, deployment readiness, or authentic visual parity. Fresh CI, a fresh Grey delta receipt and the subsequent repaired integration pin were unavailable at cutoff. `tesbo-ci-evidence/288c89b` remains historical baseline evidence, never proof of this tree.

### Oracle refinements and authority reconciliation

The pre-author-review oracles above are retained as originally written so the derivation is inspectable. Two refinements avoid imposing invented requirements:

- **QO06:** ordinary native Run attachment historically returns explicit requested/added/skipped counts for missing or foreign IDs. Its applicable compatibility oracle is truthful accounting and no foreign mutation, with same-project unapproved additions refused. Governed Model Studio selection is stronger: every explicitly requested model case must be attached or its whole Run transaction rolls back. The initial blanket missing/foreign rollback wording must not be used to silently change the ordinary native contract.
- **QO09:** canonical proposed MBT-C07 expressly permits the existing native non-idempotent Run writer if the UI uses the defined OUTCOME_UNKNOWN/manual reconciliation fallback. Server idempotency is one conforming implementation, not the only allowed one. The actual defect is immediate retry after an uncertain response without reconciliation or a separately acknowledged new intent.
- **QO07:** canonical `00_README.md` lines 301/303 distinguish direct expected-condition evidence from incidental association and retain historical truth; line 329 expressly requires removal of automatic Bug-link status mutation; line 339 requires refreshing actual effective status. The closure document/test comment's alleged 19 November decision was challenged. Parent independently reconciled the authority and reported no attributable newer human decision overriding the canonical rule. Therefore this is a confirmed contract defect, not a discretionary change to an approved rule.
- Model mapping reliance and the MBT recovery details are explicitly **proposed** contracts in the canonical package. Their implementation gaps must not be described as proof of an already ratified model activation policy. Binding application instructions still require truthful unknown-write handling and native ownership.

### Confirmed findings and explicit contract gaps

All source paths below are relative to `/workspace/scratch/fb086055b433/tesbo-review-integration` at commit `3299691e11941d5ab701c2f9b2dc53ff29d808da`. Source and isolated mocked evidence are distinguished from real persistence proof.

#### QA-INT-01 — HIGH — Machine credential can approve a model and publish generated official Draft cases

**Category:** authorization-state / all-entrance policy equivalence. **Journeys:** GJ-02,11,40,41,46,47.

The shared REST classifier in `Tesbo-Backend-Nest/src/common/testcase-publication.policy.ts` protects ordinary testcase and dependency publication but omits Model Studio approval and candidates routes. `src/auth/api-token-rest.guard.ts` therefore permits a current project WRITE token to call both. `src/behavior-graph/model-studio-models.controller.ts` passes only `req.userId` to approval/candidate mutations. `src/behavior-graph/model-studio-repository.ts` approval at approximately 260–325 checks membership without a trusted human review principal; candidate creation at 331–424 then composes the native official Draft writer. Token issuer identity is thereby treated as human approval authority.

**Discriminating sequence:** seed an accessible project and current model revision; present a project WRITE token; POST the model approval with the correct content hash; POST generated candidates. Expected: both human publication decisions refuse machine credentials, with no approval, official testcase, mapping or audit publication. Actual source: guard allows both routes and the shared approval method records an approval attributed to the issuer without a human principal. Ordinary token-authorized model generation and permitted Run operations are the positive neighbors and must remain available.

**Executed evidence:** `qa-independent-probes.cjs` loads the production guard and repository in an isolated VM, mocking database and membership only. Ordinary `/testcases` is denied with HUMAN_PUBLICATION_REQUIRED, both model routes are allowed, and approval without a ReviewPrincipal succeeds. This is a real production-code boundary probe with mocked collaborators, not a real HTTP/DB or deployed exploit. Parent independently confirmed this finding and plans shared classifier plus service principal enforcement; no repaired pin is certified here.

**Required repair proof:** real authenticated HTTP matrix for human session / read token / write token / forged body principal / absent or revoked member, covering both model endpoints and direct service fail-closed behavior; authoritative before/after approval/case/mapping/audit counts; retained allowed machine neighbors.

#### QA-INT-02 — HIGH — Bug association manufactures execution verdict, time and performer

**Category:** causal side-effect / outcome-oracle integrity / history. **Journeys:** GJ-16,17,18,38,42.

`Tesbo-Backend-Nest/src/legacy/legacy.service.ts` `failLinkedExecutions` at approximately 8338–8445 still changes linked open/manual execution status to Failed, `executed_at` to now and `executed_by` to the linking actor. `createBug` and `addBugLink` reach it after the association write. Only finalized automated Runs receive the sealed-result protection. Linking an observation supplies no verified evidence that an expected condition of that exact attempt failed; an open attempt is not permission to infer such evidence.

**Discriminating sequence:** create a Passed execution with known original performer/time, then link an incidental Bug. Expected: Bug relation persists; status/time/performer remain byte-equivalent; no fabricated execution-transition notification or result event. Actual: both open manual and open automation fixtures change Passed to Failed and replace time/performer. Direct observed failure must continue through the explicit native result writer, with its evidence and attribution. Full DIRECT/SIDE/UNDETERMINED classification and governed historical correction remain unimplemented capabilities, not implicitly supplied by this fix.

**Executed evidence:** reviewer-authored `qa-independent-contract-probes.spec.ts` calls production `addBugLink` with mocked persistence. Its two canonical preservation checks fail at the before/after assertion for manual and automation; setup succeeds and the association is called. The log records all three altered fields. Real database effects remain unexecuted by this reviewer.

**Test-oracle defect:** existing `bug-link-finalization.spec.ts` passes by requiring this automatic mutation, including Passed/Untested/Blocked→Failed. Its comment's supposed 19 November decision is not sufficient authority. The author closure paragraph repeats the same incorrect policy. These are defect-normalizing assertions/documentation, not evidence of conformance. Correct source, tests, UI assumptions and closure wording together. Require real Run drawer and full execution page to refresh actual status and show associated findings independently of verdict.

#### QA-INT-03 — HIGH contract gap — Model dispatch silently substitutes a later case version for the accepted mapping basis

**Category:** reliance/history / semantic completeness. **Journeys:** GJ-40,41,42,45. **Authority grade:** proposed MBT contract gap, with confirmed current source behavior.

`src/behavior-graph/model-studio-repository.ts` `linkCaseForUser` at approximately 487–499 permits an omitted or syntactically valid testcaseRevision without comparing it to the current case. Dispatch's linked-case SELECT around 586 does not read `testcase_revision`. The later case refresh replaces title/status from the current case and delegates the current case to the native approved writer. The manifest stores case ID/title/path/element IDs/source but no exact mapping event or bound native case revision. Coverage code around 933–949 and 1020–1035 can recognize changed/unrecorded link revisions, but dispatch does not enforce that distinction.

**Discriminating sequence:** map reviewed case A to model element E; change case semantics to B and legitimately reapprove B; dispatch the old mapping. Expected under proposed MBT-C05: conflict/BLOCKED until a fresh accepted mapping, or an explicitly authorized immutable historical execution mode. Actual: dispatch succeeds with B under the mapping that described A. Valid same-revision mappings are the positive neighbor; historical Runs must retain their original manifests after later remapping or unlink.

**Executed evidence:** reviewer-authored production-repository probe supplies a mapping revision A and current approved revision B, assumes native B approval is valid, and expects a 409 before native write. It instead resolves a governed-run manifest with the current B title and mapping element E. The failure occurs at the intended rejection assertion. Database queries and native Run writer are mocked, so this does not establish PG isolation or stored row shape. The actual SQL's omission of the binding field independently supports the mechanism.

**Contract and conforming alternative:** canonical numbered canonical specification03 MBT-C05 approximately 963–965 binds accepted case/step/scope mappings and requires MAPPING_CHANGED/BLOCKED on pre-dispatch drift while preserving history. numbered canonical specification04 MBT001H and `05_IMPLEMENTATION_BACKLOG_AND_TEST_PLAN.md` MBT acceptance obligations support exact provenance. These remain proposed. Preserve old mapping history; block latest substitution until explicit remapping, or implement clearly consented historical execution. Do not invent a second approval system or describe current-model approval as coverage proof.

#### QA-INT-04 — HIGH — Lost model Run acknowledgement returns directly to a retryable form

**Category:** unknown commit outcome / retry / recovery. **Journeys:** GJ-28,40,41.

`Tesbo-Frontend/app/(app)/projects/[id]/model-studio/page.tsx` approximately 390–415 catches dispatch errors into a generic runError and unconditionally clears runBusy. The form retains the request and permits another create. Backend `dispatchRunForUser` creates a new native Run each invocation without a durable operation receipt/deduplication identity. A committed Run whose response is dropped is therefore indistinguishable in this UI from a failed request; retry can create a second Run.

**Discriminating sequence:** seed a valid approved model/current case mapping, submit a named Run request, allow native Run/items/executions/manifest commit, drop only the response, then attempt resubmission. Expected: OUTCOME_UNKNOWN with the original requested name/selection/time/context retained; automatic retry disabled; inspect existing native Runs and attach the authoritative chosen Run, or remain blocked; creating a distinct Run requires acknowledged new intent. Actual source returns the generic error to a newly enabled create action.

**Authority:** AGENTS principle 7 requires truthful unknown-write handling. Canonical proposed MBT-C07 in numbered canonical specification04 approximately 807–815 explicitly allows native non-idempotent creation with this manual fallback; MBT-AC14 gives the corresponding acceptance requirement. Idempotency keys are an alternative, not an invented mandatory retrofit of every legacy Run write.

**Evidence:** source-confirmed recovery omission. No browser lost-ACK experiment was performed. Required isolated CI proof must drop the response after authoritative commit, inspect all relevant native records, prove no second create occurs automatically, and exercise successful reconciliation, no-match BLOCKED, permission loss and explicitly acknowledged new intent.

### Ancestry correction: PR166 migrator safety is not an authored deletion

A literal two-dot comparison of development6897 to this older-based checkout shows the newer migration runner safety changes and tests absent. That initially looked like a regression. Parent identified the ancestry issue; the authored three-dot PR diff of `src/database/migrate.ts` and `migrate.spec.ts` is empty, independently rechecked before cutoff. **This is an inherited-base integration gap, not a PR-authored deletion or test weakening.**

The isolated VM probe shows this checkout's migrator performs import effects and constructs its historical localhost fallback without explicit configuration, whereas development6897's version does not. Every filesystem/dotenv/pg/process collaborator was mocked; no real runner, DB, migration or network connection was executed. The probe was relabelled to avoid retaining the incorrect authored-regression characterization. Parent plans to merge development including PR166 into the next pin. Verify that merged tree and its migration gates later; do not count this as a fifth confirmed PR finding.

### Verification ledger — executed by this QA reviewer

| Evidence | Actual result | Limits |
|---|---|---|
| `qa-independent-probes.cjs` / `.log` | Production guard/service bypass reproduced; safe inherited-migrator comparison recorded | VM + mocked DB/membership/filesystem/process. No HTTP/DB/runtime proof. |
| `qa-independent-contract-probes.spec.ts` / `.log` | 3 intended contract failures: manual Bug preservation, automation Bug preservation, stale model mapping rejection | Reviewer-authored assertions, production methods, mocked persistence. Deliberate red evidence, not suite setup failure. |
| `qa-jest-retry.log` | 9 suites, 329 tests passed | Auth REST guard, MCP service/publication, model composition, testcase approval/proposal, KB governance, approved Run policy, Bug link. Transpile-only ts-jest, diagnostic checking disabled, main-checkout dependency resolution. No typecheck/PG/browser claim. |
| `qa-document-queue.log` | 13/13 passed | Production queue serialization, old-document acknowledged state, failure fencing, restore barriers, explicit readback state; not React page/network/browser proof. |
| First `qa-jest.log` attempt | 1 suite / 10 assertions passed; 8 suites failed before assertions in dependency import | Evidence-only config initially resolved nested lru-cache incorrectly. Corrected external search configuration, then reran the same 9 suites successfully. Not product failures. |
| First document queue invocation | Could not resolve TypeScript | Repeated with authorized main-checkout dependency path; 13/13 above. No source edits. |
| Pinned checkout identity/status | Commit/tree matched supplied pin; clean checkout; migrator three-dot diff empty | No moving-tree or subsequent repair verification. |
| Real PG / migration execution / real boot / HTTP integration / browser / AT / deployment | NOT RUN by this reviewer | Explicit environment restrictions; fresh exact-pin CI not received before cutoff. |

Evidence files are under `/workspace/scratch/fb086055b433/assurance-working/`. The source checkout was not modified. Executed passing assertions are **not** a count of complete user journeys, nor are the 3 intentional failing checks a target finding quota.

### Positive source findings and assertion preservation

- Native testcase approval requires the trusted human principal at the shared decision owner, locks current project membership and case, rereads after the lock, compares exact edit and semantic snapshots, and commits status, immutable receipt and audit together. V155 includes native semantic content plus custom-field/tag dependencies, demotes approval after semantic drift, and avoids manufacturing receipts for legacy Approved rows. Native Run eligibility uses the current semantic receipt rather than status alone.
- Native Run creation/attachment and Model Studio composition now use one supplied transaction for Run/items/executions and mandatory model provenance. The repair checks exact model selection counts, locks model/mapping/cases in a stable order, refreshes cases after waiting, and removes dependence on a fallible compensating Run deletion. Model candidate Draft/audit/mapping share the transaction, with cache/index effects deferred until commit. This closes the inspected orphan-write mechanism in source/mocked composition, subject to PG proof and the independent mapping/principal findings above.
- Project MCP access defaults off, uses named credential-bound grants and server-side validation, rechecks current project/token grant for each request including discovery/notification shortcuts and both route aliases, and permits locked-project access reductions while rejecting grant expansion. The native consent UI invalidates stale project/permission/load/save generations and requires a new authoritative read after an uncertain save. No fresh authentic-browser proof is claimed.
- The proposal preview remains server-gated off by default. Its native task owner captures normalized intent and producer provenance, explicit selected indexes and exact snapshot revision. Apply rechecks current project/workspace/principal authority, locks the proposal and targets, rejects stale bases, and composes selected native writes/audits/receipt atomically. Exact receipt retry is distinguished from new intent. Dependency validation precedes creating a requested suite. The UI holds an opened review snapshot and clears publication authority after uncertain outcomes.
- Governed KB snapshots extend native versions with explicit submitted/approved/rejected kinds; legacy Approved documents with no authentic binding remain ineligible as approved AI memory. Review is human-only and exact-revision CAS inside the native transaction. The shared reviewed-memory filter is consumed by inspected legacy context readers and RAG paths. Ordinary non-memory document behavior is preserved separately.
- The document queue owns its acknowledged state per document. Navigation, failure-generation fencing, closing/draining, restore barriers and explicit readback are covered by the 13 executed unit checks. Source review of the page confirms queued saves retain their original document context and only a new explicit Save performs reconciliation after an unknown result. End-to-end React/network behavior remains pending.
- Inspected partial-edit DB test changes retain the service race while requiring retired MCP writers to refuse before lock/write, with full state/effect snapshots and a legitimate positive neighbor. Bulk-scope utility changes retain actual human writes, assert machine refusal plus unchanged records, and strengthen equality/revision assertions. Fixture changes that genuinely approve cases preserve admission prerequisites instead of fabricating an Approved status. Removing expectations for now-retired direct MCP publishers is legitimate only with their refusal/unchanged-state and native positive coverage; it does not prove all historical removed cases are replaced.
- Model DB tests present in source include injected provenance failure, concurrent candidate materialization, revision/archive races in both orderings, live demotion and mapping unlink. They were read, not executed. A green mocked test claiming refreshed title does not close stale mapping semantics. The Bug suite is the identified exception where the oracle positively normalizes the defect.

### Material journey crosswalk and named branch gaps

All 49 Grey journeys retain their original denominator. The 27 impacted journeys below received this bounded source/test crosswalk; none is marked end-to-end runtime proven. Several implemented positive subpaths exist, but a journey remains open when a material branch or required capability is missing.

| Journey(s) | Inspected owner / applicable oracle | Named remaining gap |
|---|---|---|
| GJ-01,02 | Project MCP settings/grants, both aliases, native authorization; QO03/10 | Real credential rotation/revocation, concurrent consent update and exact deployment defaults; project onboarding beyond consent not tested. |
| GJ-04 | KB per-document write queue; MCP project generation fences; QO05 | Multi-tab/session handoff, broader agent conversation continuity, actual navigation/browser evidence. |
| GJ-05 | Reviewed-memory shared filter and inspected RAG/legacy readers; QO04 | Provider outage/completeness, every knowledge source/reader, actual index/worker freshness and permission runtime. |
| GJ-11 | Native proposal task/stage/snapshot/apply, human case approval; QO01/02/10 | Real PostgreSQL replay/races/role revoke, full dependency closure, every alternative publisher; QA-INT-01. |
| GJ-12 | Case approval UI/server snapshot and native field writers; QO01/13 | Full authoring image/structured-field compatibility, keyboard/focus/touch and unsaved drafts at exact build. |
| GJ-13 | Import/duplicate admission and fixture policy changes; QO01/11/12 | Real lossless export/import, identity collisions, mixed old clients and historical attachment/provenance fixtures. |
| GJ-14 | Native suite mutex, suite deletion/case assignment and proposal suite resolution; QO02/10 | All create/reparent/delete interleavings; documented pre-existing suite hierarchy race remains unproven, not waived by this review. |
| GJ-15 | Native approved admission, ordinary Run counts, automation/schedule/model consumers; QO06/09 | Fresh PG/HTTP evidence for all entrances, scheduled/automation compatibility, exact snapshot history. |
| GJ-16,17,18 | Run snapshots, Bug create/link and native result ownership; QO07 | QA-INT-02; condition evidence, full direct/side/unknown classification and separately governed correction not implemented. |
| GJ-19,20 | Proposal source/reference snapshots and requirement-related adapter changes; QO02/10 | Native criterion-level ownership, source provider outage/refresh races and requirement UI truth not fully inspected or runtime tested. |
| GJ-21 | Native KB doc/version/CAS/review and UI queue; QO04/05 | Real save/review/restore races, lost ACK, legacy fixture parity, document audiences and source propagation. |
| GJ-24 | Native file access/retained evidence seams and unchanged owner | Original report byte intake, interrupted upload, hash/retention/authorization evidence not implemented/proven by this increment. |
| GJ-28 | Proposal replay, KB queue readback, model transaction; QO02/05/09 | QA-INT-04; real response-loss recovery and provider/notification partial completion. |
| GJ-35 | Native review, consent and document surfaces; QO10/13 | Full BA/QA/PM/support permission-filtered journeys, AT and return-context behavior. |
| GJ-38 | Native outcome truth feeding existing reports; QO07 | QA-INT-02 contaminates downstream aggregates; no fresh report/export denominator or visual execution proof. |
| GJ-39 | Native ephemeral preview/generator boundary; QO08 | Bounded candidate inspection is not persistence, execution or coverage; full preview interaction and scale not executed. |
| GJ-40,41 | Model/revision/approval/candidate/mapping/Run composition; QO08/09/10 | QA-INT-01/03/04; real PG rollback/races, exact mapping/version history, current approval and unknown recovery. |
| GJ-42 | Native Run snapshots and model manifests; QO06/08/09 | Exact typed mapping/condition/event provenance and deleted-source traversal not represented completely; QA-INT-03. |
| GJ-44 | Existing native Run/share ownership remains relevant downstream | Public/revoked share and restricted history not independently run; no inference from internal Run tests. |
| GJ-45 | Model archive/link locks, suite soft-delete and immutable receipt/version policies; QO11 | Full restore/soft-delete uniqueness, missing source links, account deletion and history retention runtime. |
| GJ-46 | Auth guard, current-membership checks, MCP consent scope/reduction; QO03/10 | Mid-process revocation/expiry/active-workspace/entitlement across every shared writer; QA-INT-01. |
| GJ-47 | V155–157, old receipt/null semantics, preview gate and migrated fixtures; QO11/12 | Mixed-version rollout, real old-data migration, PR166 merged tree and exact candidate CI; no historical backfill truth fabricated. |

Broader 22 journeys remain **not certified, not N/A**: GJ-03 (capable analyst/executor registration),06 (case-free prompt dispatch),07 (executor-owned driver),08 (cancel/expire/reassign),09 (original report intake),10 (independent linked retest),22 (policy effective revisions),23 (durable cross-domain work),25 (engineering change assessment),26 (source reconciliation without hooks),27 (multi-agent assignment identity),29 (cross-artifact contradiction detection),30 (durable QA impact claims),31 (skill candidate lifecycle),32 (skill promotion/binding/revocation),33 (exact composed skill governance),34 (independent method evaluation),36 (release decision),37 (deployment/incident/retest),43 (product-learning amendment),48 (scheduled/outbound delivery),49 (target-derived stories). Each needs its own fixture, current authority, outcome and recovery proof. Existing native tasks or model Runs cannot stand in for these capabilities.

### Charter dimension disposition

| Mandatory dimension | This review's disposition |
|---|---|
| Happy lifecycle | Source/mocked subpaths assessed; all 49 full runtime journeys OPEN. |
| Negative paths | 329 targeted assertions include useful denials; independent bypass still confirmed; no all-entrance full pass. |
| Retry/idempotency | Proposal/KB mechanisms inspected; QA-INT-04 OPEN; unknown outcome remains a real state. |
| Concurrency | Native transaction/lock code and DB test source assessed; PG execution pending. No deadlock/serialization proof from mocks. |
| Migration/historical truth | V155–157 reviewed, legacy bindings remain honestly absent; representative real migration and mixed-version rollout pending. |
| Deletion/revocation | Some current membership/model/suite protections inspected; whole lifecycle branches named above remain open. |
| Identity/authorization changes | Production guard/service probe exposes QA-INT-01; source review of other owner checks is not runtime coverage. |
| Partial failure | Shared composition removes inspected orphan mechanism in source/mocks; cache/index/outbox/provider delivery not end-to-end certified. |
| Real boot | BLOCKED/PENDING exact candidate CI; no local DB or browser authorized. |
| Wiring/non-vacuity | App global REST guard wiring/source and production method probes inspected; red tests fail for intended reasons; no universal mutation-test claim. |
| Participation-scope lifecycle | Applied to Bug↔attempt, model↔case and case↔Run relationships; no Nesberry-specific relationship taxonomy imported. QA-INT-02/03 expose collapsed distinctions. |
| Consequence-driven derivation | Covered temporal state, semantic dependencies, native record/effect closure, role/consent change, mapping reliance and retained history. Final-unit capacity is only relevant to actual quotas/claims; no invented marketplace scenario. |
| Problem-model completeness | External assignment/attempt/original report/retest, effective skills/policy and direct/side/unknown finding states remain absent or incomplete, not simulated as implemented. |
| Authentic UI regression | Source review only. Historical288c screenshots/traces exist but are not an After build, functional pass or exact controlled comparison. Keyboard/AT/reflow/touch/unchanged-region proof pending. |

The five mandatory escaped-defect families are explicitly assessed: temporal/context binding **SIMULATED_ONLY** (queue tests + source, broader UI OPEN); unknown commit outcome **OPEN** (QA-INT-04); causal side-effect closure **OPEN** (QA-INT-02 and unexecuted downstream effects); all-entrance policy equivalence **OPEN** (QA-INT-01); outcome-oracle integrity **OPEN** (QA-INT-02/03 and missing exact runtime truth). They are not marked TESTED at full workflow scope from helper assertions.

### Independence, author-claim reconciliation and handoff

The pre-author oracles and49-journey denominator were written before opening `docs/specs/agent-synchronized-engineering/reviews/2026-11-19-integration-closure.md`. The closure was read later for reconciliation, not used as an oracle. Its transaction/queue corrections agree with inspected mechanisms, but its test/typecheck/lint/CI totals are author claims unless independently rerun above. Its Bug policy paragraph conflicts with canonical authority. Its statement that the original QA loop remains outstanding is consistent with this review. No mechanical Graph verifier is claimed.

Parent messages supplied the finding repair direction and clarified ancestry/authority; those communications are disclosed and do not convert this into repaired-tree acceptance. This reviewer did not author implementation fixes. The original method charter is unchanged; no generic checklist or favorable sample substitutes for its lifecycle and denominator obligations.

**Handoff:** four material source/probe findings or contract gaps remain open at this pin, with13 discriminating oracles,49 identified journeys (43 High/6 Medium),27 impacted crosswalks (25 High/2 Medium),22 broader obligations (18 High/4 Medium),0 newly executed full runtime journeys and0 deployment-verified journeys. Local evidence comprises329 passing targeted backend assertions,13 passing queue checks and3 intentionally failing reviewer contract checks, plus the independent auth VM probe. These counts describe different evidence grains and must not be summed into journey coverage.

**Final QA disposition for3299691/tree332665d: NOT READY.** Resolve the current findings, reconcile the development/PR166 merge into a new immutable candidate, and perform focused independent repair verification with exact-build isolated CI and authentic UI evidence. Broader specification freeze/release and the original external-executor loop remain open independently of whether this bounded increment later passes. No fresh CI/Grey evidence was awaited or presumed at cutoff.
