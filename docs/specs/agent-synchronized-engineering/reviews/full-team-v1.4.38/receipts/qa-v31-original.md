# Tesbo graph reasoning and governed Skills — QA original first-pass receipt

**Receipt:** QA-V31-ORIGINAL  
**Reviewer:** QA Team lens, one analytical reviewer; unchanged QA charter v1.6  
**Stage:** Preliminary specification-adequacy and pinned-source integration review; upstream formal gates pending  
**Input:** v1.4.31-candidate-1, run TESBO-GRAPH-SKILLS-CONTINUATION-20261119  
**Date:** 2026-11-20 UTC  
**Disposition:** KEEP THE PROPOSAL NOT FROZEN. Its central lifecycle contracts are coherent enough to continue controlled design work, but this receipt does not establish full-journey assurance, implementation acceptance, operational approval, or runtime/UI verification.

## 1. Decision and practical meaning

The proposal can support the desired outcome without making a formal model, source repository, automation driver, or a new Skill identity mandatory for ordinary QA. It gives the important facts distinct owners and states: accepted expectation versus implementation observation, candidate versus official case, approval versus activation, Run preparation versus actual execution, and feedback versus a promoted method. It also permits legitimate manual work, simpler deterministic behavior, no change, and explicit uncertainty. Those are useful, testable boundaries. [C0–C4]

The present evidence does not show those boundaries working across the actual system. The current source still has concrete integration gaps for separately activated model revisions, mapping history, correction intake without generation, and independent action-bound assent. The candidate expressly recognizes these as admissions; they are not newly discovered specification omissions in this receipt. I inspected the relevant source and corroborated their limited current scope. The new source-specific counterexample I derived concerns concurrent browser recovery records: a single local-storage slot plus separate read/write/remove operations can lose an unresolved native-run request across tabs. This is a source-supported concurrency risk, not a reproduced runtime defect. [F01–F05]

Two subordinate links also point to an obsolete method-section fragment. This is a bounded documentation wiring defect, not a reason to create another method owner. [F06]

The proposed tests are useful obligations, but their count does not establish a journey denominator or execution. My preliminary inventory below has 24 material QA jobs, 20 assessed by document/source simulation, three not simulated, and one blocked on runtime. It is not a replacement for Grey's independently derived full inventory, which I have deliberately not consumed before freezing this cold pass.

## 2. Authority, independence, and exact evidence boundary

### Method actually applied

I read the unchanged method at NesberryEnterprise/Nesberry commit d83549c85a4dcd047fb40dc4fba4ec62737ab0fc:

- .kiro/steering/teams/README.md.
- .kiro/steering/teams/qa-team-charter.md, v1.6.
- .kiro/steering/teams/review-orchestration.md, including portability, consequence/completeness, sequence, escaped-failure and authentic-UI obligations.
- The Full-Journey Coverage Contract and G0/G1 distinctions in synthetic-user-journey-team-charter.md.
- The assurance-portability policy v001 and the application-scope/grounding portion of spec-writing-standard.md.

The target bindings are Tesbo's actual actors, services, source pins and proposal contracts. I did not import Nesberry's marketplace taxonomy, Medusa commands, Railway identity, or an administrator requirement. Tesbo's pinned AGENTS.md and CLAUDE.md were read; the same root files in the 419 source cache are byte-identical. Frontend AGENTS.md and CLAUDE.md were read at 419 before examining the additional frontend source. No code, database, branch, installed Skill or source document was changed.

Canonical 06 is proposed content under review. It did not replace the QA charter or supply the findings required from this reviewer.

### Input identity and read scope

The complete filename/digest bindings are in [the input manifest](../input-v31/manifest.json). Its SHA-256 is b628462508a61355954bc3701142b7ca5e244c73fc622bb8407f7f1886734c0a. RUN-CONTEXT.md SHA-256 is 26891c7b92f4765053b5ef71d82bacd6c93eafc6a25447c3e6795e9b5ef7a308. Parent archive SHA-256 is cccc79be82a65faf3a0f3c5ad34b05ebe802151791eef413f9bafbf6e2f05110.

| Input | Actual treatment |
| --- | --- |
| Eight canonical files, 00 through 07 | Heading inventory and substantive review of the current graph/Skills/ASER amendments, source-convergence map, contracts, acceptance additions, portable-method proposal and UI obligations. Relevant earlier model recovery, activation and test clauses were followed. This is not a claim of exhaustive rereading of every preserved historical paragraph. |
| Six subordinate views | Reviewed current reconciliation, ownership, portable rule, source map, aliases, acceptance and Skills reader/writer limits. Treated as subordinate, not additional authority. |
| Base application 6897f989b055a955280f810c7daace86f74057fa | Read root instructions from exact Git objects. Used the proposal's base binding; did not claim a complete base-source audit or transfer 419 findings to the base/deployment. |
| Open PR #167 source 419c2efa08b04aff6c7c7d0d56425eb572bd6ec2 | Targeted backend, migrations, MCP, tests and frontend inspection described below. An unmerged source tree, not deployed truth. |
| source419 cache | Supplied manifest contains 611 blobs. I verified local byte sizes and SHA-256 values for all 611; no mismatches. It contains no frontend files despite its original intended-scope wording. Cache absence did not establish product absence. |
| source419-frontend supplement | Available before first-pass freeze. Contains 261 frontend blobs; all local size/hash comparisons passed. I read the Model Studio page, recovery helper and authoring component, not all frontend behavior. |
| manual-test-authoring source | Standalone Pasted markdown(86).md, SHA-256 3fce0e3b1c78430091d99b2447c83ec63474a5f9b575451324c026408dbd5171. Read mode/authoring, expected-result, deferred-scope and improvement/governance sections. Referenced support files remain absent. |
| Product brief | Read Pasted text(6).txt, SHA-256 8dd97ff34d8a8220660c91aae17e297d9ac39333dcd94cc4968a8cddf166e6b1. Historical product-method input, not the actual locally evolving package or a new run instruction. |
| Recovered product-testing repository pack | All 18 blobs available before first-pass freeze at method commit d83549c8; local size/hash comparisons passed. Read SKILL.md, taxonomy-and-routing, coverage-and-variation, ai-assisted-testing and functional-state-api. The pack's other references were available but not semantically audited here. The brief's unpublished/local additions remain unknown. |

The frontend page and two Model Studio components were also fetched directly through GitHub at the exact 419 pin. Returned blob identities were page 529da428fce4a756a0494fcb5cb31368f70364ea, recovery helper 423d7f1bfec31a2df4e43cf88207892111a3cf3c, and authoring component 76a6bfdceaddaa4bd4c089d612b57d9eb7802caf. Subsequent local cache availability supplied the same pinned evidence.

### Exposure and non-claims

I did not read reviewer receipts, author retrospectives, views/reviews, or peer conclusions and did not call list_agents. Primary documents themselves expose historical review claims, source diagnoses, named test examples and counts, especially canonical 00 and 03 §18.2.1 and the subordinate source map. That exposure is disclosed: corroborating those diagnoses is not an independent discovery of them, and this review cannot show that an undisclosed method would have invented the graph/AI direction.

The coordinator supplied factual availability updates for the 18-file method pack and the missing frontend cache before freeze. They supplied source identities, not a verdict. No cross-model diversity, operational approver membership, actual human research, formal quorum, or completed review sequence is claimed.

**Executed checks:** file read/search, exact Git-object reads, targeted pinned GitHub reads, and local byte/hash verification.  
**Not executed:** product unit, integration, database, API, MCP, browser, migration, concurrency, fault-injection, benchmark, deployment, or human-usability tests. Reading a test source proves its definition, not its execution.

## 3. Independent problem model and lifecycle sweep

The question is whether an authorized tester or agent can get from an imperfect starting context to a useful next decision without losing or inventing truth. That includes a project with only a requirement; an existing case that needs amendment rather than duplication; a source change with incomplete dependencies; a correction made while generation is unavailable; and a previous result that must remain historically true after a new method/model is adopted.

| Stateful concept | Canonical truth and consequential lifecycle | Necessary terminal/recovery treatment |
| --- | --- | --- |
| Source binding and observation | Approved source/destination relationship → versioned binding → capture → compare/reconcile | Rebind, delete, revoke, missing event and unsupported parser cannot relabel old observations or imply zero impact. |
| Expected behavior/model | Candidate revision → exact review → approved → separately selected current scope | New Draft/approval must not silently replace the active basis; archive, rollback and ambiguous legacy applicability retain history. |
| Cases, requirements and governed documents | Stable native identity → immutable submitted candidate → selected decision → atomic native apply | Rejection, partial staging, changed base, deletion and reuse retain exact originals and explicit required effects. |
| Skill version | Inert imported/authored candidate → evaluation → human approval | Candidate repair is a successor, not payload mutation; rejection/no-change is a legitimate outcome. |
| Skill assignment | Separately approved pin/composition → effective resolution → consumption | Drift, expiry, revocation, rollback and bootstrap recovery have their own authority and cannot rewrite historical use. |
| Native Run and actual attempt | Selected approved basis → native preparation → real actor/target observation → reviewed correction if allowed | Unknown creation, retry, cancelled work, side finding and later attempt preserve occurrence identity and original result. |
| Feedback/evaluation | Attributed correction with exact compared content → triage → independent comparison → retain/revise/reject | Provider outage must not prevent correction intake; sensitive evidence, failed trials and fallback effectiveness remain visible. |
| Readiness/decision/deployment | Computed scoped readiness → authorized fixed decision → independently observed deployment → subsequent evidence | New source/policy/evidence may stale current reliance without rewriting the old decision; one changeset can serve separate releases. |

This model accepts transient read-only analysis. It does not require every query or explanation to become a durable business record. Persistence is required where the contract promises recoverable work, immutable review, execution history or attributable evaluation.

## 4. Preliminary journey inventory and accounting

These are QA-derived jobs and oracles, not the historical GJ list renamed. For compactness, G0 means document-level conceptual simulation and G1 means source-grounded simulation. HOLDS refers only to the examined proposed contract. FAILS refers to the stated source/contract mismatch, not a live product result.

For every row, actual runtime evidence is NOT RUN. Fixtures are proposed isolated fixtures, not existing customer records. High/Medium are review risk tiers, not claimed population frequency.

| ID / risk | Fixture and ordered scenario | Required canonical result and counterexample | Evidence state / result |
| --- | --- | --- | --- |
| QJ01 High | Accepted requirement R1, no Git/model/driver; tester asks for a useful case; reviews proposal. | Native candidate has setup, actor/data, actions and independent observable results; no fabricated execution or mandatory source prerequisite. Unsupported automation leaves manual use legitimate. | G0 / HOLDS; C1, C2, C4 |
| QJ02 High | Existing C1 addresses one condition; agent proposes an equivalent and a similar-but-distinct condition. | Equivalent work links/amends C1; distinct obligation is not collapsed by similarity; no new official ID before apply. Search failure remains unknown. | G0 / HOLDS; C1, C4 |
| QJ03 High | Accepted policy denies actor B; current observed behavior permits B. | Conflict remains against the policy; generated expected result does not normalize the defect. Authorized intentionally limited scope is a conforming neighbor. | G0 / HOLDS; C1, M1, M2 |
| QJ04 High | r1 approved/current; save r2, approve r2, then explicitly activate r2 under concurrent selectors. | r1 remains current until activation; one CAS winner; previous runs keep r1. Current source instead dispatches latest revision. | G1 / FAILS; F02 |
| QJ05 High | Map case c1@v1 to r1; amend c1, unlink, relink; inspect a never-dispatched link and an old run. | Exact mapping decisions and prior basis remain recoverable; current eligibility becomes stale; no historical remap. | G1 / FAILS; F03 |
| QJ06 High | Owner of project A chooses allowlisted private source S; capture waits while source grant/rebind changes. | Both destination and source entitlement required at effect; historical binding stays original; globally shared deployment policy is a valid evidenced alternative. | G1 / INCONCLUSIVE; source policy unavailable; G02 |
| QJ07 High | Watcher absent; provider revision changes, then duplicate/late event, rename and unsupported syntax arrive. | Reconciliation records exact scope/discontinuity and incompleteness; unsupported or missed context is not unchanged. | G0 / HOLDS; C1, C3, C5 |
| QJ08 High | Bounded subgraph has accepted edge, hypothesis, missing transitive consumer and truncated query. | Explanation separates known/unknown links and independent expectations; no inferred full coverage or native mutation. | G0 / HOLDS; C3, C4 |
| QJ09 High | Import a candidate Skill with references, hostile text and incompatible dependency; submit repaired successor. | Candidate stays inert; exact package lineage and rejected original survive; missing support files block affected admission rather than cause guessed content. | G0 / INCONCLUSIVE; package/admission work pending |
| QJ10 High | Admin-owned machine token proposes root replacement; actual human reviews and separately assigns permitted successor. | Token cannot promote, assign or weaken root. Exact human action and recovery quorum must come from configured policy. | G0 / INCONCLUSIVE; F05, G01 |
| QJ11 High | A manual security test uses API observations; multiple relevant Skills match; required pin changes before submission. | All applicable guidance resolves deterministically or conflicts; old candidate remains; raw authorized evidence intake continues. Classifier/grammar must not drop an orthogonal quality concern. | G0 / INCONCLUSIVE; G03 |
| QJ12 High | One change affects a requirement and internal manual but no external policy; BA/document reviewer stage separate artifacts. | Seven domain assessments may produce only two mutations; external ownership and audience/access remain independent; each exact target remains native. | G0 / HOLDS; C1–C4 |
| QJ13 High | Stage two candidates; fail second; replay/read receipt; explicitly resume; select dependency-closed native apply and fail mandatory audit. | Staging may be partial with receipts; selected native apply rolls back entirely; no committed operation repeats. Model/native shared-client path is present, broader integration unproved. | G1 / INCONCLUSIVE; S1, C4, G04 |
| QJ14 High | Approved model/cases; native creation response is lost; reload and inspect; two same-scope tabs interleave storage operations. | Preserve each unresolved intent or atomically refuse a competing admission; no blind retry or disappearing receipt. | G1 / INCONCLUSIVE; F01 |
| QJ15 High | Case-free prompt, no Tesbo AI key; external authorized executor claims fenced attempt, returns evidence, analyst requests linked retest. | Original prompt/report/attempt remain; new retest is distinct; lease expiry is not proof of stopped external execution; apply remains selected human action. | G0 / HOLDS; C2, C5; actual loop unproved |
| QJ16 High | Human or agent executes exact approved case; discovers adjacent defect; later corrects setup-error classification. | Original actual observation remains; side Bug link cannot rewrite status/time/performer; correction and later attempt are separately attributable. | G0 / HOLDS; C1, C4 |
| QJ17 High | Reviewer corrects weak expected result with no provider allocation; then regenerates/rejects successor. | Correction saved independently; original/successor/rejection and exact input/model/method retained. Current feedback inlet requires generation allocation. | G1 / FAILS; F04 |
| QJ18 High | Candidate method beats incumbent on authored examples, misses hidden forbidden transition; later active method degrades. | Independent thresholds reject or hold promotion; authority/evidence failures cannot be averaged away; rollback has a visible effect and preserves history. | G0 / INCONCLUSIVE; trial/responder not supplied |
| QJ19 High | Role revoked during retrieval; same request via list/history/search/RAG/export/cache/agent context. | No restricted content, IDs or counts in any reader; permitted incomplete explanation remains usable. | NOT_SIMULATED / NOT_ASSESSED; complete reader inventory pending |
| QJ20 High | Legacy rows lack model/Skill/approval history; mixed clients roll out; source is deleted or lawfully erased; restore supported scope. | Unknown remains unknown; no reconstruction presented as contemporaneous truth; permitted tombstone/provenance and explicit unsupported old-client handling. | G0 / INCONCLUSIVE; migration/retention policy pending |
| QJ21 Medium | Tester returns from source/case/run link with dirty work, keyboard/AT/mobile context; switches projects during delayed response. | Correct context and work retained; accessible truthful recovery and adjacent controls preserved. Model page source is inspected, but authentic before/after is unavailable. | BLOCKED_ACCESS_OR_RUNTIME / NOT_ASSESSED |
| QJ22 High | Accepted change creates QA obligation; notification fails; worker lease expires and retries; another agent resumes. | Obligation persists independently of delivery/read; fenced ownership and exact downstream receipt; no false completion. | NOT_SIMULATED / NOT_ASSESSED; queue/worker consumer sweep pending |
| QJ23 High | One library change feeds two releases; pre-deploy approval; one deploy fails smoke; policy changes afterward. | Separate fixed decisions and observations; no future production proof required for first approval, no CI/old pass promoted to post-deploy acceptance. | G0 / HOLDS; C1, C4 |
| QJ24 Medium | Query/learning budget exhausts; delivery metric lacks provider data; broad evaluation seeks quality claim. | Partial/unknown result with honest denominator and cost; no causality from counts; approved limits measured before exposure. | NOT_SIMULATED / NOT_ASSESSED; operating profile absent |

**Totals:** 24 inventoried; 22 High and two Medium. Twenty conceptually assessed: 14 G0 and six G1. Of the assessed rows, nine HOLDS, three source/contract FAILS, eight INCONCLUSIVE. Three NOT_SIMULATED; one BLOCKED_ACCESS_OR_RUNTIME. Runtime observed/executed: zero. Twenty of 22 High rows have bounded G0/G1 treatment; QJ19 and QJ22 remain explicitly unassessed. The Medium runtime/UI and measured-operation rows are not passed.

This denominator is the bounded QA inventory for this receipt, not a proven complete inventory of Tesbo or the extension. Grey's independent inventory, Blue's writer/consumer sweep, Security/Purple findings and the formal upstream gate must be reconciled after this original is frozen. Historical 49-journey and 125-definition figures are not added to these totals.

## 5. Findings in QA charter format

### F01 — Concurrent recovery slots can strand an unknown native-run request

**Category:** Concurrency gap; Observability/recovery gap.  
**Risk:** High integration risk.  
**Evidence status:** New source-supported counterexample; runtime reproduction NOT RUN. Independent challenge still required.

**Scenario / preconditions:** Two tabs share principal, project and model. Both have a valid approved selection and no pending stored intent. The native run create remains non-idempotent, which the proposal legitimately handles through explicit manual reconciliation.

**Event sequence:** A reads no local intent; B reads no local intent before A stores; A writes intent A; B writes intent B to the same key; both can issue their POSTs. If A's response is lost, reloading reads only B. A's original context has been overwritten without a user resolving it. A related interleaving exists in clearModelRunIntent: a tab reads matching A, another tab replaces the slot with B, then the first removes the shared key. The matching-ID test protects a sequential late acknowledgement, but read-then-remove is not an atomic compare-and-delete across independent tabs.

**Expected canonical truth:** Each potentially committed request remains attributable and recoverable until explicitly reconciled, or a competing admission is atomically refused before its POST. Two deliberate distinct Run requests may be valid; the oracle is not blanket deduplication of all clicks. Their independent unknown outcomes must not disappear.

**Failure mode / support:** modelRunIntentKey contains only principal/project/model, writeModelRunIntent replaces that key, and clearModelRunIntent performs separate read/remove operations. The page's runSubmitting ref is per component; its localStorage read then write and StorageEvent listener do not establish an atomic cross-tab admission. Page source lines 136, 490 and 496; recovery helper key/write/clear functions. [S2, S3]

**Owner that must prevent it:** Existing Model Studio run-intent/recovery integration and native run owner; MBT-C-07 and MBT-AC-14/37, not another Run subsystem.

**Test layer / evidence required:** Controlled two-page browser test with barriers around storage reads/writes and a committed POST whose response is dropped; authoritative native Run/manifest readback, retained request identities after reload, and no extra unacknowledged retry. Add an interleaved old-clear/new-intent case. Break the chosen fence/storage retention mechanism to prove non-vacuity.

**Legitimate alternatives:** Preserve multiple intents by identity, atomically serialize admission with a supported fallback, or add a proved native operation receipt. The specification's explicit manual reconciliation remains valid; server-wide automatic idempotency is not the only acceptable design. Source tests already protect ordinary sequential late acknowledgements and single-tab unknown outcomes; neither test definition proves this interleaving executed. [T1]

### F02 — Current source selects latest saved model, not independently activated model

**Category:** Lifecycle gap; Migration/backfill gap.  
**Risk:** High; already recognized source-admission gap, corroborated here.

**Scenario / preconditions:** r1 is the deliberately current approved model with eligible cases. A user saves a harmless Draft r2, then tries an otherwise valid new run under r1.

**Event sequence / expected truth:** Saving r2 preserves r1 as current; approving r2 also preserves r1 until a distinct authorized selection changes it. Concurrent activations have one winner and old runs keep r1. Unknown legacy selection stays unknown until a new explicit decision.

**Failure mode / support:** saveRevision creates a new greatest revision_number. dispatchRun rejects any other revision as SUPERSEDED_REVISION; coverageForUser also chooses greatest revision. V154 explicitly encodes latest-as-active, and MCP advertises that behavior. This is coherent current code but differs from the proposed contract. [S1, S6; C2, C3]

**Owner:** FR-117/MBT-C-12 native model applicability, with its current UI/API/MCP/coverage readers and migration.

**Test layer / evidence required:** Real DB/API plus native UI and two supported MCP clients; r1 → save r2 → approve r2 → explicit activation, concurrent selectors, stale old client, rollback and ambiguous legacy fixtures. Inspect exact current selection and old run manifests after each step. MBT-AC-28/29/41 already allocate this work.

**Alternative:** A product owner may separately amend the contract to latest-head semantics, but code or a passing latest-head test does not itself make that decision. No unapproved change of policy is inferred here.

### F03 — Unlinking a mapping removes the current record without complete mapping-decision history

**Category:** Deletion/revocation gap; Migration/backfill gap.  
**Risk:** High for historical reliance; already recognized, corroborated.

**Scenario / preconditions:** A reviewed model-case relation exists, including one never used in a Run. The case changes; an authorized user unlinks and relinks.

**Sequence / expected truth:** Current eligibility may stop, but the earlier creation/removal decision and exact relied-on basis remain distinguishable under retention policy. A historical Run must not adopt a new mapping's meaning.

**Failure mode / support:** linkCase permits omitted testcaseRevision as null/UNRECORDED; unlinkCaseForUser physically DELETEs mbt_model_case_links. Dispatch now records exact mappings and native occurrences in its manifest, which is a useful partial preservation. That does not preserve the never-dispatched mapping's removed decision. [S1]

**Owner:** Existing native relationship/history owner FR-118/T-426 and applicable model mapping owner.

**Test layer / evidence required:** DB/API history readback before and after unlink/relink, with stale explicit mapping refusal, unknown legacy basis, never-dispatched link, old Run and permitted erasure fixture. MBT-AC-34/35 and ASE-INT-11 remain applicable.

**Alternative:** An immutable decision event/tombstone in an existing authorized history owner is sufficient. Permanent full payload retention is not universally required. Null historical basis must remain honest, not fabricated into approval.

### F04 — Correction intake remains coupled to optional regeneration, and exact comparison retention is incomplete

**Category:** Observability/recovery gap; Lifecycle gap.  
**Risk:** High for usable manual QA and learning evidence; already recognized, corroborated.

**Scenario / preconditions:** A reviewer can read a proposed case and has a legitimate correction. No active model-provider allocation exists, or the draft arose in chat. Later regeneration may succeed, be rejected or make no useful change.

**Sequence / expected truth:** Save the authorized correction and its source/candidate context first. Optional generation is a separate status. Original, successor and rejected/no-change comparisons remain attributable without rewriting old cases or Skill history.

**Failure mode / support:** zyraFeedback rejects states other than in_review/failed and chat-linked batches, then requires an active provider allocation before recording its feedback activity. processZyraFeedback replaces generated_payload. The newer readTestcaseProposal and SQL review-snapshot function derive a current coherent snapshot; they are not, by themselves, immutable storage of every rejected feedback trial. Existing applied-event audit may retain some history; I do not claim all historical outputs everywhere are lost. [S4, S7]

**Owner:** Existing Zyra feedback/candidate/review and T-422 evaluation integration.

**Test layer / evidence required:** Provider-absent correction intake, provider failure after correction commit, chat-derived correction, two reviewers/stale revision, exact original/successor/rejected payload readback, and a later rollback. Verify correction and provider statuses separately. SK-E2E-31/38/39 and ASE-FLOW-54 already contain the strengthened expected outcomes.

**Alternative:** A permitted comment/correction event linked to immutable candidate snapshots can meet the requirement; no new paid generation service or separate evaluator store is necessary. An explicitly regeneration-only endpoint may remain if the ordinary correction path exists and is usable.

### F05 — Session classification is not the complete action-bound governance proof

**Category:** Authorization-state gap; Integration/wiring gap.  
**Risk:** High admission gate, not a demonstrated live exploit.

**Scenario / preconditions:** An owner-issued bearer token, native AI acting through a human session, and a genuinely interactive authorized reviewer reach equivalent protected model/case/Skill actions.

**Sequence / expected truth:** The token remains unable to approve. The real reviewer approves an exact target/digest/dependency/action under current authority. AI-origin or replayed content cannot inherit assent solely from the host session.

**Failure mode / support:** Current model controller and requireHumanReviewPrincipal correctly reject api_token and accept human_session. That is a meaningful correction over treating issuer userId as assent. The inspected classification contains no independently bound action/expiry/consent context, so it cannot alone prove ASER-C03's stronger guarantee. Existing source does not demonstrate the future Skill/root authority policy. [S8, C4]

**Owner:** P-07/T-305/430/439 and T-422's existing governance mechanism; accountable human decides actual roles/root recovery. QA does not invent quorum or identities.

**Test layer / evidence required:** All-entrance DB/API/MCP/native-AI regression with the same valid payload, token versus real review action, stale target/assent, replay, permission removal during queue/lock wait, and successful legitimate use. A malformed-payload refusal is not the authorization oracle.

**Alternative:** Any equivalent server-owned action-bound assent mechanism satisfying the target policy is acceptable. The receipt does not prescribe a new identity service or mandatory UI ceremony for ordinary unprotected edits.

### F06 — Two subordinate method links still target an absent fragment

**Category:** Integration/wiring gap, documentation.  
**Risk:** Low; not architecture-blocking.

**Scenario / preconditions:** A reader follows the principle-first method link from views/README.md or the distillation link from views/AGENT_RULE_TEMPLATE.md.

**Sequence / expected truth:** The link should land on the current method section in skills-governance.md.

**Failure mode / support:** Both links use fragment 1341-principle-distillation-and-contextual-instantiation. The actual heading is “13.4.1 Portable method for discovery and principle distillation”; no explicit matching old anchor was found. [V1]

**Owner:** Existing subordinate views and canonical-method link maintainer.

**Test layer / evidence required:** Static rendered-heading/fragment resolution, then ordinary navigation if rendered. No product E2E is needed for this doc-only correction.

**Alternative:** Update the two references or preserve an explicit compatible anchor. Do not duplicate the method body to repair navigation.

## 6. Executable test-plan shapes for the highest-consequence boundaries

These are proposed plans. “Expected” is an oracle, never an observed passing result. Shared fixture rule: use an authorized disposable project/workspace, valid inputs and roles, independently query native records, and retain evidence before scoped cleanup. Runtime evidence for every plan below is NOT RUN.

### TP-A — Unknown native creation and two-tab recovery (QJ14 / F01)

**Scenario:** Preserve unknown native creation across simultaneous browser work.  
**Actors/principals:** Same authorized human in tabs A/B; repeat with different principals to check scope isolation.  
**Initial state:** Approved current model and approved selected cases; zero pending intents; record preexisting Run IDs.  
**Command/event sequence:** Coordinate both empty-slot reads; release two writes; let selected native request commit and drop its response; reload both tabs; then interleave an old clear with a new pending intent.  
**Expected state after each step:** No admitted intent disappears. Each committed Run has its exact manifest. Unknown remains unknown until explicitly reconciled.  
**Expected side effects:** Only deliberately admitted native requests; readable exact recovery context.  
**Forbidden side effects:** Overwritten unknown request, cross-project read, automatic duplicate POST, a stale clear removing another intent.  
**Retry behavior:** Read/inspect first; separate new intent requires the explicit policy acknowledgement.  
**Concurrency behavior:** Atomic refusal or independently recoverable intents.  
**Legacy-data fixture:** Existing browser recovery v1; malformed and unavailable storage remain blocked.  
**Authorization fixture:** Membership removed before retry/inspection; no privileged readback.  
**Recovery:** Match/read canonical outcome or retain uncertainty; never infer failure from silence.  
**Test layer:** Browser plus native API/DB/manifest readback and controlled network loss.  
**Runtime evidence:** NOT RUN.

### TP-B — Model and Skill selection migration (QJ04/QJ10/QJ11/QJ20)

**Scenario:** Independent saved, approved and active revisions survive rollout and concurrent changes.  
**Actors/principals:** Author, authorized governance human, owner-issued machine token, old client.  
**Initial state:** Active r1/v1 with known history; legacy record with no trustworthy activation witness; candidate r2/v2.  
**Command/event sequence:** Save, approve, concurrently activate, revoke during work, retry old client, roll back current selection.  
**Expected state after each step:** Save/approve leave active r1/v1; one versioned activation winner; stale work stays intact but cannot promote; rollback changes future reliance only.  
**Expected side effects:** Exact decision/assignment history and affected current review signals.  
**Forbidden side effects:** Latest-timestamp backfill, old-run relabeling, machine promotion, silent fallback to a different method.  
**Retry behavior:** Same operation returns its authorized receipt or defined manual reconciliation.  
**Concurrency behavior:** Enforced at native selection/assignment authority, not a UI precheck.  
**Legacy-data fixture:** Null/unknown historical basis, existing latest-head clients, mixed rollout.  
**Authorization fixture:** Valid versus revoked approval authority; independent root recovery remains policy-bound.  
**Recovery:** Preserve candidate; authorized rebase/selection/fallback; confirm actual resolved manifest after rollback.  
**Test layer:** DB migration/integration, API/MCP, UI and worker consumers.  
**Runtime evidence:** NOT RUN.

### TP-C — Composite draft recovery and protected native apply (QJ12/QJ13)

**Scenario:** A requirement/case/manual change spans staging but selected native publication stays atomic.  
**Actors/principals:** Scoped agent proposing; separate authorized reviewer applying.  
**Initial state:** Known base revisions, exact required Skills and logical operation IDs; no official new rows.  
**Command/event sequence:** Stage item one; fail item two; repeat same key; change payload under same key; explicitly resume eligible item; apply dependency-closed selection with injected audit failure; then legitimate apply.  
**Expected state after each step:** Partial staging receipt is exact; duplicate read does no new work; altered payload conflicts; failed native apply leaves no selected official mutation; success creates one committed set.  
**Expected side effects:** Mandatory audit/outbox and official ID mappings share the protected commit.  
**Forbidden side effects:** Half-published selected batch, reused approval on changed semantics, silent downstream success.  
**Retry behavior:** Commitments prevent reapplication across new keys or resume.  
**Concurrency behavior:** Competing base edit/assignment change forces reconciliation at final owner.  
**Legacy-data fixture:** Old REST/import/bulk/clone writer with missing revision.  
**Authorization fixture:** Same action through both MCP aliases, native AI, REST and integration where exposed.  
**Recovery:** Retain committed staging and uncertainty; reconcile external effects before retry.  
**Test layer:** Real transaction DB/API fault injection plus actual clients.  
**Runtime evidence:** NOT RUN.

### TP-D — Feedback without provider and evidence-preserving learning (QJ17/QJ18)

**Scenario:** Save a correction independently of generation, then compare a method successor honestly.  
**Actors/principals:** Authorized tester; separate evaluator/approver; least-privileged drafting agent.  
**Initial state:** Exact candidate a1, accepted oracle, no model-provider key; independent holdout and incumbent fixed before evaluation.  
**Command/event sequence:** Correct/reject a1; read correction back; attempt unavailable generation; enable authorized generation; produce a2; evaluate against hidden critical fault and conforming alternative; reject or activate separately; induce declared degradation and roll back.  
**Expected state after each step:** Correction exists even when generation does not; a1/a2 and rejection/no-change reasons remain; failed independent criterion holds promotion; rollback affects new work and is verified.  
**Expected side effects:** Scoped attributed evidence and exact method/model/input versions.  
**Forbidden side effects:** Self-authored gold labels, promotion by candidate text, private cross-project leakage, rewriting accepted cases/results.  
**Retry behavior:** Duplicate feedback does not inflate evaluation evidence or spawn repeated generation silently.  
**Concurrency behavior:** Stale correction cannot overwrite a newer reviewed interpretation.  
**Legacy-data fixture:** Chat-linked batch, older task with only current generated_payload, unavailable historic evidence.  
**Authorization fixture:** Revoked sharing consent and denied method-promotion token.  
**Recovery:** Retain correction, show generation/matching unavailable, preserve incumbent or authorized fallback.  
**Test layer:** Native feedback API/DB, actual provider seam with controlled failures, independently adjudicated evaluation.  
**Runtime evidence:** NOT RUN.

### TP-E — Source entitlement and incomplete impact (QJ06/QJ07/QJ08)

**Scenario:** Destination authority and server checkout availability do not substitute for source entitlement.  
**Actors/principals:** Project A owner; source S owner; second project; authorized reader.  
**Initial state:** S is on server allowlist; only one source/destination grant is valid; exact binding generation and approved expectation pinned.  
**Command/event sequence:** Attempt unentitled binding/capture; allow entitled capture; delay scan while grant/ref/binding changes; deliver late/duplicate event; truncate unsupported dependency traversal.  
**Expected state after each step:** Wrong grant refuses without source disclosure; valid source works; late capture cannot promote under changed authority; partial impact is explicit.  
**Expected side effects:** Attributable permitted observations and exact discontinuity/gap records.  
**Forbidden side effects:** Cross-project content/counts, relabeled prior captures, zero-impact claim from incomplete scope.  
**Retry behavior:** Reconcile exact source checkpoint and original event identity.  
**Concurrency behavior:** Revalidate at capture/finalization after waits.  
**Legacy-data fixture:** Single mutable legacy binding and unknown older configuration.  
**Authorization fixture:** Independently evidenced globally shareable deployment policy as a valid alternative, tested separately.  
**Recovery:** Stop only source-dependent work; ordinary authorized manual QA continues.  
**Test layer:** Source-adapter/DB integration, API/MCP and permissioned reader/export tests.  
**Runtime evidence:** NOT RUN.

### TP-F — Actual attempts, side findings and historical truth (QJ05/QJ15/QJ16)

**Scenario:** Real execution and later correction remain distinct from model dispatch, Bug association and historical reconstruction.  
**Actors/principals:** Authenticated manual tester; external assigned executor; analyst; authorized correction reviewer.  
**Initial state:** Exact case/model/definition and selected native occurrence; one previous attempt under build A; actual target may now be build B or UNKNOWN.  
**Command/event sequence:** Dispatch; perform real allowed actions; submit original observation/evidence; add adjacent Bug; classify setup error; remove/re-add case membership; run a distinct retest; delete/unavailable evidence source under policy.  
**Expected state after each step:** Dispatch alone is unexecuted; actual attempt pins actor/occurrence/build; side link cannot change result; correction has lineage; re-added membership cannot inherit old evidence; unavailable proof remains unavailable.  
**Expected side effects:** Correct native result, separate correction/retest and permitted trace links.  
**Forbidden side effects:** Invented human action, Bug-induced result rewrite, reconstructed current state presented as old observation, auto-pass from a path or link.  
**Retry behavior:** Original report/attempt deduplication and separately identified supplemental/retest data.  
**Concurrency behavior:** Cancel/complete, lease expiry/late report and membership changes respect native identity/fencing.  
**Legacy-data fixture:** Imported prior result without contemporaneous witness; old manifest without occurrence identity.  
**Authorization fixture:** Token cannot impersonate human/manual performer or retrieve forbidden evidence.  
**Recovery:** Preserve original outcome; disclose UNKNOWN, then obtain a new authentic observation if authorized.  
**Test layer:** Native DB/API plus real manual/executor boundary; authentic UI separately.  
**Runtime evidence:** NOT RUN.

The remaining rows need their full target fixtures and actual writer/reader crosswalk before execution. The table identifies their outcomes and omissions; it does not claim executable automated coverage merely because an acceptance ID exists.

## 7. Escaped-defect families and all-writer challenge

| QA failure family | Applicable counterexamples and current evidence | Status |
| --- | --- | --- |
| Temporal/context binding | Model UI late response, project/model switch, two-tab pending context; original report versus later attempt | SIMULATED_ONLY for selected paths; full shared-consumer sweep OPEN |
| Unknown commit outcome | Native run response lost; explicit manual fallback; composite per-item receipts; two-tab recovery risk F01 | SIMULATED_ONLY; actual fault injection OPEN |
| Causal side-effect closure | Model/native case/run commit and manifest share client; mapping unlink/history; feedback replacement; side Bug cannot rewrite result | SIMULATED_ONLY on inspected source/contracts; external/outbox effects OPEN |
| All-entrance policy equivalence | Bearer refusal versus human action, old REST/MCP/native AI/import/background readers/writers and revocation | OPEN; selected classification inspected, universal closure not proved |
| Outcome-oracle integrity | Dispatch vs action, model/case count vs coverage, accepted policy vs faulty code, retrieved bytes vs metadata, source-free manual work | SIMULATED_ONLY; target execution and measured quality OPEN |

All five families are applicable. None receives TESTED. Other nonapplicability boundaries: Tesbo is not the target application's payment/marketplace engine; no invented payment, exchange-leg, capacity-sale or marketplace test is required here. Participation scope still applies to one guidance version serving several modules/projects and one change serving multiple releases. Resource scarcity applies to generation/query budgets, but quota policy and actual operating limits remain admission work.

For critical guards, the required non-vacuity witness is at the real claim boundary: disable/change the chosen guard in an isolated fixture and make the intended wrong effect happen. A mocked helper failure, 4xx before the intended rule, or no rows because setup failed is insufficient.

## 8. Legitimate alternatives and rejected overbroad conclusions

1. **Manual reconciliation is legitimate.** MBT-C-07 explicitly allows an unknown non-idempotent native creation to remain blocked while a person inspects and deliberately chooses a canonical Run. The current UI has real source support for this. I did not classify “no server idempotency key” alone as a defect. F01 concerns losing the recovery context under concurrency.
2. **Read-only or source-free work is legitimate.** A requirement-only manual case, transient explanation or clearly scoped unknown result can be useful. Mandatory Git, model, driver, persistence for every read, or AI adoption would contradict the desired scope.
3. **A shared-source policy may be legitimate.** An explicit deployment policy making sources shareable to eligible projects can satisfy entitlement. An allowlisted path by itself does not prove that policy.
4. **No new Skill can be the right answer.** A reconciled existing manual method, product-testing core with a target adapter, reviewed handbook, deterministic rule, or no change may satisfy a task. New graph-reasoning identity needs a distinct responsibility and composition contract.
5. **Correct limited behavior is not necessarily a defect.** A ratified release limitation may be the proper oracle. An observed limitation without that decision cannot override an accepted requirement.
6. **Partial historical retention can be legitimate.** Lawful erasure or restricted evidence may leave permitted references/tombstones and honest uncertainty rather than full payload retention. It must not silently manufacture or erase reliance history.
7. **Source correction is meaningful but scoped.** The 419 shared-client model/native paths and direct token refusal are substantive source improvements. I did not carry an earlier split-transaction or direct bearer mechanism forward as though this code still had it.
8. **A checked hypothesis may be rejected.** I considered whether normal post-commit cache invalidation exceptions would automatically make generated-case publication fail after commit. The inspected cache invalidators catch and log their failures; that specific exception argument is not supported and is not a finding. Queue/index durability and freshness still need their own actual contract tests.

## 9. Open gates and method-input disposition

| Gate | Owner and required resolution | Current limit |
| --- | --- | --- |
| G01 Actual human authority, action-bound assent, root recovery/quorum | Existing policy/review/T-422 owners; bind legitimate people/capabilities and positive/denied operations | Policy/operational approval unavailable; analytical reviewer cannot supply it |
| G02 Source entitlement and finalization | Source binding/capture owner; grant or explicit deployment sharing policy, revoked/rebound cases | Current source checks destination owner/member and server registry; deployment source policy unknown |
| G03 Effective context/composition grammar | T-422 resolver; overlapping required/optional contexts, deterministic precedence, semantic-review boundary | Classification examples mix manual/automated, API and security/performance concerns. This is not proof of a bad scalar schema; require a concrete manual-security-through-API fixture so no applicable obligation disappears. Multivalued predicates or orthogonal tags are legitimate alternatives. |
| G04 Complete writers/readers and migration | Blue/native owners plus QA/Security; map all applicable channels, old clients, source/case/model/KB histories and downstream consumers | Targeted source inspection is not exhaustive; QJ19/QJ22 remain named gaps |
| G05 Method source and evaluation admission | Existing method/version/evaluation owner | Manual source contradicts itself on expected-result authority; its referenced support files are absent. Recovered repository product-testing pack is now pinned, but unpublished brief-referenced local files, installation and efficacy remain unverified. |
| G06 Measured operating envelope and response | Existing task owners and accountable responder; budgets, pagination, fanout, retention, queue age, failure signals and observed fallback | Defined as prerequisites in C4/C6, not actually configured or measured |
| G07 Authentic current/after UI and original QA loop | Purple/QA/native/executor owners; known build/role/fixture, keyboard/AT/reflow, untouched consumers, original case-free loop | No running target or authentic captures supplied; source is not visual proof |
| G08 Formal assurance dependencies | Blue/Red/Grey upstream gate, Grey inventory challenge, specialist findings, Graph closeout, White disposition | Pending; this is an original preliminary receipt, not sequence closure |

The method pack adds useful reusable taxonomy, independent-oracle, state/retry and effect-witness guidance. That is source evidence for reuse, not empirical evidence of improved testing. The standalone manual source's early instruction to prefer observed behavior over requirements conflicts with its later required-behavior section; the proposed package correctly makes reconciliation an admission gate. Preserve the useful UI grounding and executable action/result structure without importing that contradiction into active guidance. [M1, M2]

The older brief's mandatory Primary User Type → Module → Context sequence and unpublished file list are not silently claimed as the recovered repository pack. Canonical 06 now treats contextual lenses as optional in a portable method. Any product-policy conflict with an independently approved earlier brief belongs to the accountable owner; neither this reviewer nor a historical text establishes that approval status. No method was installed, edited, published or activated.

## 10. Source index and frozen handoff

References below identify the actual evidence inspected. Local links are evidence pointers; the manifest supplies exact revision/digests.

- **C0:** [00_README.md](../input-v31/canonical/00_README.md), revisions 1.4.28–1.4.31, ownership and evidence boundaries.
- **C1:** [01_PRODUCT_REQUIREMENTS.md](../input-v31/canonical/01_PRODUCT_REQUIREMENTS.md), R-ASE-01–48 and graph/quality/current-source amendments.
- **C2:** [02_WORKFLOW_AND_UX_SPEC.md](../input-v31/canonical/02_WORKFLOW_AND_UX_SPEC.md), MBT-C-02, ASER-UX01–03 and revisions 1.4.29/31.
- **C3:** [03_TECHNICAL_DESIGN.md](../input-v31/canonical/03_TECHNICAL_DESIGN.md), §18, governed Skills, GEX, evaluation and portability bindings.
- **C4:** [04_MCP_API_CONTRACTS.md](../input-v31/canonical/04_MCP_API_CONTRACTS.md), MBT-C-07/08, ASER-C01–06 and graph/feedback/current-source contract.
- **C5:** [05_IMPLEMENTATION_BACKLOG_AND_TEST_PLAN.md](../input-v31/canonical/05_IMPLEMENTATION_BACKLOG_AND_TEST_PLAN.md), MBT-AC-14/28/29/34/35/37/41, current ASE-FLOW/SK-E2E additions and v1.4.31 allocation.
- **C6:** [06_IMPLEMENTATION_AGENT_BRIEF.md](../input-v31/canonical/06_IMPLEMENTATION_AGENT_BRIEF.md), portable method and independent-review boundary.
- **C7:** [07_UI_DESIGN_TASKS.md](../input-v31/canonical/07_UI_DESIGN_TASKS.md), current graph assistance/Model Studio and authentic UI gates.
- **S1:** [model-studio-repository.ts](../source419/Tesbo-Backend-Nest/src/behavior-graph/model-studio-repository.ts), save/approve, createCasesFromPaths, link/unlink, dispatch, coverage and original native-occurrence readers.
- **S2:** [Model Studio page](../source419-frontend/Tesbo-Frontend/app/(app)/projects/[id]/model-studio/page.tsx), recovery state, storage listener, dispatchModelRun, clearResolvedRunIntent, selectInspectedRun and separate-intent acknowledgement. Blob 529da428fce4a756a0494fcb5cb31368f70364ea.
- **S3:** [model-run-intent.ts](../source419-frontend/Tesbo-Frontend/components/model-studio/model-run-intent.ts), key/read/write/clear. Blob 423d7f1bfec31a2df4e43cf88207892111a3cf3c.
- **S4:** [legacy.service.ts](../source419/Tesbo-Backend-Nest/src/legacy/legacy.service.ts), createTestCase transaction hook, stageTestcaseChanges, readTestcaseProposal, zyraFeedback, processZyraFeedback and formatAiTask.
- **S5:** [project-source-binding.ts](../source419/Tesbo-Backend-Nest/src/behavior-graph/project-source-binding.ts), [project-source-binding.management.ts](../source419/Tesbo-Backend-Nest/src/behavior-graph/project-source-binding.management.ts), [project-source-graph.coordinator.ts](../source419/Tesbo-Backend-Nest/src/behavior-graph/project-source-graph.coordinator.ts), and [current-cache-graph.history.ts](../source419/Tesbo-Backend-Nest/src/behavior-graph/current-cache-graph.history.ts).
- **S6:** [V153 governance](../source419/Tesbo-Backend-Nest/migrations/V153_model_studio_governance.sql), [V154 governed runs](../source419/Tesbo-Backend-Nest/migrations/V154_model_studio_governed_runs.sql), and [mcp.tools.ts](../source419/Tesbo-Backend-Nest/src/mcp/mcp.tools.ts), run_behavior_model.
- **S7:** [V157 proposal review](../source419/Tesbo-Backend-Nest/migrations/V157_native_testcase_proposal_review.sql), testcase_proposal_review_snapshot.
- **S8:** [human-review-principal.ts](../source419/Tesbo-Backend-Nest/src/common/human-review-principal.ts) and [model-studio-models.controller.ts](../source419/Tesbo-Backend-Nest/src/behavior-graph/model-studio-models.controller.ts).
- **T1:** [model-run-recovery.test.mjs](../source419/scripts/model-run-recovery.test.mjs), [UI model-studio.spec.ts](../source419/e2e/ui/model-studio.spec.ts), [API model-studio.spec.ts](../source419/e2e/api/model-studio.spec.ts), and selected model-studio-runs unit/DB test definitions. Inspected, NOT RUN.
- **V1:** [views README](../input-v31/views/README.md), [agent rule template](../input-v31/views/AGENT_RULE_TEMPLATE.md), and [skills-governance.md](../input-v31/views/skills-governance.md), obsolete fragment versus current §13.4.1 heading. Other current source/alias portions of requirements, design and implementation-plan were also reviewed.
- **M1:** [Supplemental method manifest](../method-inputs/manifest.json); standalone manual source and product brief as identified above.
- **M2:** [Pinned repository method manifest](../method-inputs/repository-d83549c8/manifest.json) and listed read subset of product-testing.

**Freeze statement:** This file is the original QA first-pass output. No informed reconciliation, peer disagreement resolution, full Grey inventory challenge or formal gate outcome is incorporated. Preserve it unchanged; any later correction or additional evidence belongs in a separately labeled informed delta. The coordinator should route F01 for independent source/runtime challenge, retain the existing admission work for F02–F05, repair F06 at the existing view owner, and complete the named inventory and runtime dependencies before any broader closure claim.

