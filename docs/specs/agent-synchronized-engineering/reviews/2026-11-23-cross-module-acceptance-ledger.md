# ASER cross-module acceptance ledger — execution handoff (2026-11-23)

**Status: OPEN / not accepted.** This is an execution ledger for the existing ASER v1.4.38 proposal and Work Package A, **not** a ninth canonical specification, new service, new ownership model, release authorization, or a claim that end-to-end acceptance has run.

**Pinned source inspected:** `5f43b49b6872b44ab7cf5a875193dfb725aec3e1` on `development` (PR #210 integration). Reconcile the source SHA and selections before execution if `development` moves. This ledger is deliberately separated from release #155 and default-main assurance bootstrap #191. Do not treat their CI as execution of a real coding-agent journey.

## Existing owners and evidence already discoverable in source

- Canonical ASER authority: the eight existing specification files `00_README.md` through `07_UI_DESIGN_TASKS.md`, referenced by `docs/specs/agent-synchronized-engineering/README.md` (proposed, NOT FROZEN).
- Work Package A scope and criteria: `docs/specs/agent-synchronized-engineering/work-package-a-native-requirements-design.md`; reuse KB requirements/version owner, native testcase/revision owner, FR-027–037 staging/review, governed Skills, native task and run owners.
- `e2e/api/requirements.spec.ts`: seven native API cases including inert/idempotent staging, denied publication, rejection/withdrawal, cross-project isolation, governed publication and exact approval, overlap conflict, and KB bypass prevention. They are test *definitions*; do not infer a live run from their presence.
- `Tesbo-Backend-Nest/src/mcp/mcp-publication.spec.ts`: MCP staging, denied approval/apply, true agent principal, consent and scope, and native conflict propagation; the test's 52-tool assertion is a source-bound contract, **not a production MCP catalog readback**.
- `Tesbo-Backend-Nest/src/legacy/testcase-proposal-review.db.spec.ts`: migrated-Postgres suites for selected atomic apply, rollback, exact dependency and identity, races, retries, Skills assignment drift, membership revocation, unchanged rejected state, and the four separate coverage readings. The suite has an environment-dependent DB selection; a skipped run is not passing database evidence.
- Skills version review and lifecycle: `e2e/ui/skills.spec.ts`, plus separately scoped PRs #206, #207, #208 and #210. A later corrective PR #211 was already in progress when this ledger was authored; do not assert its disposition.

## Persistent Tesbo regression assets — required outcome, not optional follow-up

**Canonical project:** [TESBOPROJECT](https://tesbooboo-production.up.railway.app/projects/df072dfe-e4d0-406a-9350-e0d022c6323f) (ID `df072dfe-e4d0-406a-9350-e0d022c6323f`). The project already exists. An agent must **reuse existing native requirements, cases and suites when semantically matching**, rather than create duplicates to satisfy a count. No artificial sample project or ephemeral-only case store is authorized.

**Regression organization:** Keep affected feature cases in their module-specific regression suites. The existing intended cross-module/Skills suite is **Skills & Governance — Regression** (select or have an authorized human create this suite if absent). Create or link an ASER cross-module regression grouping within the existing suite structure when necessary; do not invent a separate test-case service. Build a stable case identity, then create *new cycle/execution/attempt identities per run*. A regression case is not consumed or recreated by executing it.

**Minimum native test-case contract:** each saved case has an independent purpose and stable title; applicable project/module and suite; requirement identity + **exact requirement revision and acceptance criterion**; role/authorization; preconditions/fixtures; setup and test data; clearly numbered repeatable actions; assertions/expected results, including persisted unchanged-state oracle for rejected transitions; teardown/reset; positive, negative, boundary, state-transition, concurrency/retry and recovery coverage as applicable; risk/priority; agent/author provenance; and links to source commit/spec, CI selector, evidence and related defect. An identified existing case should be revised/versioned, not silently overwritten. Cases pending approval remain Draft/UNRUN, never represented as published, executed or passed.

**Execution preservation:** once a case is reviewed and eligible, select its exact approved revision in a native test cycle/run; preserve build SHA, environment, execution agent, time, attempt number, evidence hashes and observed vs expected outputs. Write PASS/FAIL/BLOCKED only from an actual persisted attempt. Retest creates a **new historical attempt** linked to the same stable case and defect, preserving prior failures and evidence. Automated Playwright/API/DB tests should report to their corresponding native case IDs through existing ingestion/reporter integration when authorized; never use CI completion alone as an official Tesbo execution.

**Test-set maintenance:** on each feature change, search for existing cases first; update affected cases/requirement links; add genuinely uncovered paths; retain obsolete cases in archived/versioned history with replacement pointers; include new discoveries as regression candidates; keep manual and automated case coverage distinguishable; use historical run evidence to detect flakiness and stale build/Skill/requirement bases. Verification and approval remain separate from authoring.

**Immediate native publication blockers (historically observed; recheck live):** `PILOT-REQ-AUTHOR` and `PILOT-CASE-AUTHOR` were submitted, not effective; required assignments for `requirement_revision`, `requirement_case_link`, `testcase_create` remained absent. The `Skills & Governance — Regression` suite had not been created and earlier cases were staged but not approved/published. Do not fabricate a suite/case/run ID or mark publication complete while these authorities are missing. Still prepare/link repeatable draft test cases and preserve the blocked reason in Tesbo's existing task/proposal owner where authorized. This is an **approval/assignment/publication gate**, *not* a reason to request a new project.

### Persistent regression deliverable checklist

- [ ] Current TESBOPROJECT inventory and existing equivalent cases/suites checked and recorded
- [ ] Every A1–A8 scenario mapped to an existing or newly staged native case ID, with exact requirement/criterion links
- [ ] Role, setup/data, actions, expected results, rejection oracles and cleanup saved in each test case
- [ ] Authorized suite placement, approval and publication receipts preserved; any blocked item explicitly marked Draft/UNRUN
- [ ] Same-head automated selectors tied to stable native IDs where supported, without inventing run results
- [ ] At least one genuine native run with immutable case/build/evidence basis, and a separate historical regression/retest attempt
- [ ] Future changes reselect the saved cases and retain cumulative pass/fail/flaky history

## Required single-change proof: one immutable chain, not independent green checks

Use the **existing dedicated Tesbo dogfooding project, TESBOPROJECT (`df072dfe-e4d0-406a-9350-e0d022c6323f`)**, and one real repository change. **Do not create a replacement Tesbo project for this campaign.** Capture project, actor/role, repository/base/head, configured MCP consent and actual connection, API/MCP catalog fingerprint, build provenance, effective approved Skill version IDs/digests and current assignments *before* work. If a particular destructive/permission-boundary scenario cannot safely run inside TESBOPROJECT, isolate that scenario with existing authorized test fixtures and record the boundary; never casually repurpose or erase real project records. If a required write/approval tool or human authority is missing, stage what is permitted and mark the publication/execution step **BLOCKED** without impersonating a human.

| ID | Journey and required readback | Minimum observation and refusal controls | Status |
| --- | --- | --- | --- |
| A1 | Agent discovers project, applicable policies/manuals/requirements/cases/graph, assigned approved Skills, and reports missing decisions | Capture authorized retrieval, exact versions, source type and unresolved authority; never equate observed code with approved requirement | NOT RUN |
| A2 | Coding agent changes a real feature and stages native requirement revision, criterion-scoped testcase(s), links, task, relevant manual/policy proposals, and evidence through existing owners | Record each existing ID, exact version and digest, caller principal, change/head binding, task/proposal receipt, artifact existence and access scope; no shadow owners | NOT RUN |
| A3 | Authorized human opens complete candidate content, predecessors, effective assignments and impact before deciding | Exercise approve, reject, withdraw and superseded/revision-change refusal. Agent/MCP/API token must not self-approve/apply or silently reassign an active Skill | NOT RUN |
| A4 | Human applies **selected** changes and independently approves the exact requirement and testcase basis | One atomic apply receipt for the selected set, no leaked partial documents/cases/links/assignments on refusal, and immutable author/approver identities | NOT RUN |
| A5 | Case/version/criterion links and graph impacts resolve from accepted native records | Verify meaning, obligation and consequences of links, not just graph reachability; distinguish inferred, authored, approved, executed and passing evidence | NOT RUN |
| A6 | QA executes an accepted case in a native run against a known application build, attaches real evidence and raises/retests a defect when appropriate | Check persisted execution attempt and run ID, frozen case/requirement/Skill versions, actual assertion outcome and evidence hash, then historical retest without overwriting prior attempt | NOT RUN |
| A7 | Updated user manuals, internal policy, task state and evidence remain navigable from the same change | Verify audience and permissions, no unintended external disclosure, exact change history and link readback, no automatic publication for unapproved content | NOT RUN |
| A8 | End-user review explains readiness and remains truthful after later code, Skill, assignment, or requirement change | Show stale build/test warnings, missing approval/coverage, contextual downstream impact, unresolved decisions and release hold; never infer deployment from CI | NOT RUN |

### Adversarial and lifecycle campaign (execute against A1–A8)

For each materially relevant transition, prove both a successful path and a rejected/unchanged path. Prioritize: wrong project or role, missing/revoked MCP consent, forged caller identity, stale selected versions, changed requirement/criterion/case/Skill assignment, competing apply/reject/withdraw, duplicate idempotency request with unchanged vs altered payload, lost HTTP response followed by retry, lock wait followed by permission/assignment changes, backend restart between stage and review, evidence missing or unreadable, public-vs-internal document exposure, run on a newer build than its approved case basis, and historical approved versions after newer submissions. Use actual persisted state before/after refusals, not just response codes.

## Execution protocol and acceptance accounting

1. **Source/authority preflight:** capture tested commit, exact installed API/MCP catalog and connected TESBOPROJECT (exact ID above); verify principals and effective Skill snapshot. Never substitute a reported test name, mocked service or CI snapshot for live capability.
2. **Automated baseline:** run the existing focused API/UI/MCP/Postgres selectors against the **same** checked-out commit. Save run/job IDs, environments, test counts, retries, failures and skips separately. Preserve failing-first artifacts; do not relabel a passing retry as first-attempt stability.
3. **Real connected journey:** exercise A1–A8 in the existing TESBOPROJECT with real Tesbo MCP/HTTP/DB/UI readbacks. Persist stable object IDs, link IDs, version/digest, evidence hashes, exact principal and timestamps. Redact credentials.
4. **Independent challenge:** Red tests rejected transitions and unexpected authority; Green tests cross-owner seams; QA tests retries, stale state and concurrency; Security tests trust and money/data boundaries; Grey tests human journeys; Purple tests presentation truth; Graph tests semantic obligations; White adjudicates completeness. Preserve each actual reviewer input/method/output and head binding; no fictional team signoff.
5. **Native record synchronization:** submit/update existing Tesbo Requirements, Test Cases, User Manual, Policies, Tasks/Issues, Files/Evidence and their relationships only when exposed and authorized. If any surface is inaccessible, leave a named BLOCKED gap and the precise missing permission/endpoint, not a fake native ID.
6. **Decision:** ACCEPT only after every in-scope A-row has a reproducible successful and refusal/unchanged-state proof, independent review, correct native acceptance/approval, and no material unowned blocker. Otherwise classify each gap as FAIL, BLOCKED, NOT RUN or OUT OF SCOPE with owner and reproduction link. This record never releases to `main`.

### Current assessment, limited to what was observed

The repository contains meaningful **automated test definitions** for A2–A4 and several negative paths; this is not proof that A1–A8 have been executed together. **TESBOPROJECT already exists**, has historically enabled read/write MCP consent and has staged drafts; this does not establish that the needed MCP tools or approved Skills are available in this particular agent session. The project was previously observed with no published suites/cases; that is a historical snapshot, not a fresh inventory. No end-to-end connected native publication, human approval, official execution, graph consequence proof or production release was exercised to produce this ledger. All A1–A8 remain **NOT RUN** as an integrated journey. Next execution owner should read current TESBOPROJECT suite/case/Skill inventories and installed MCP catalog, then stage and save reusable regression assets through the existing governed owners, without silently replacing the project.

## PR216 Skills regression preparation — existing-project handoff

**Prepared definitions, native synchronization BLOCKED / execution UNRUN.** The 23 November continuation
resumes existing PR216, tests-first head `85fd39633d3eeebb75e966e54d8bd5ffa901854e`, over development
`724f878e83a98bed7e62196415d4a921b39af4b2`. Its accepted bounded contract and decision provenance are in
the existing Work Package A design §15.4. Original red CI and later implementation execution have distinct
source/run receipts on that PR. No callable Tesbo connector is exposed in this continuation, so current
native duplicate discovery, case revision, requirement links and publication cannot be asserted. The
browser remains read-only. **Tesbo sync not performed.** These rows are reviewable proposals for the
existing task/case owner; their titles are not invented native IDs or claims of saved cases.

Before staging, inspect current TESBOPROJECT and match each purpose to an existing case. Retain a matching
case's identity and propose a new revision only where its content changes. Use the existing Skills &
Governance — Regression suite after authorized setup, and bind the actual requirement revision/criteria
from D-14/T-451/Work Package A. Record real IDs only after readback. All cases below require the exact
tested build, project, actor and immutable Skill version/assignment basis in their evidence; setup may
use isolated CI fixtures, while persistent native definitions and attempts stay in TESBOPROJECT.

| Proposed stable case title / risk | Role and controlled setup | Repeatable actions and expected persisted outcomes | Existing automated owner / teardown |
| --- | --- | --- | --- |
| Discover a Skill and return from exact saved-version inspection / medium | QA reader; authorized multi-module inventory; one Skill with older assigned approval, later unassigned approval and newer submission; text, JSON-only, HTML-only and source-only differences | Search by title/key/instructions and combine module/subtype/review/assignment filters. Confirm exact count, impossible-query empty state and clear recovery. Open dated history, change sort, inspect an exact version and compare. Verify full stored fields, immutable IDs/digest/lineage, inert HTML and unchanged approvals/assignments; close/Escape returns to the same query, history position and control. Repeat unavailable-content/read recovery without a false empty result. | `ui/skills.spec.ts`: existing Library/history regression and representation/compare cases. Remove only scenario-owned CI fixtures; never remove the persistent native regression case. |
| Apply one eligible approved Skill version to reviewed targets atomically / high | Owner/manager; same-module Skill with older approved version still eligible and a newer submission; one matching binding with recorded nonzero precedence, one different binding, one unassigned target, one unselected neighbor | Select the exact older approval; choose three explicit contexts within its one module (for a requirements Skill: requirement_revision, requirement_case_link and one explicitly entered custom requirements operation). Review Already satisfied/Replace/Add effects, save once, reload and inspect effective resolution plus history. Expect one receipt; satisfied generation/digest unchanged; replacement retains its inactive predecessor; one addition; neighbor unchanged; all chosen targets point to the exact selected approved snapshot. Approval pointer and submission history remain unchanged. | `testcase-proposal-review.db.spec.ts` atomic command cases; `api/requirements.spec.ts` atomic route case; `ui/skills.spec.ts` exact older version case. Deactivate only the scenario's exact new generations and preserve evidence; CI owns its fixture cleanup. |
| Refuse stale or conflicting assignment selections without partial effects / high | Owner/manager; reviewed target generations recorded; a second authorized actor can change one target; fixtures include wildcard/exact overlap | Preview a mixed selection, change one reviewed generation through the other actor, then save the old command. Expect `SKILL_ASSIGNMENT_STALE`, no new assignment/receipt/audit, and unchanged neighboring history. Refresh and explicitly review again before retrying. Exercise existing and selected wildcard overlap in both directions; expect `SKILL_ASSIGNMENT_CONFLICT` and no implicit cleanup or partial commit. | DB atomic stale/overlap cases and UI stale re-review case. Restore only scenario-owned bindings through authorized actions; preserve rejected command evidence. |
| Recover a lost assignment response and replay the same command once / high | Owner/manager; controlled transport can lose the response after a real commit; exact request key and reviewed payload retained | Save, drop the response after the server commits, make initial receipt discovery unavailable, then reload. Keep the outcome unconfirmed and preserve the same command/key. Restore reads and reconcile the actor-owned receipt; verify one generation per changed target and one mandatory audit. Reordered targets/default-zero replay returns that identical historical receipt; changed payload with the same key refuses. Later revocation does not rewrite the receipt or reactivate the binding. | DB concurrent/replay cases; API exact receipt case; UI lost-response/reload case. Remove transport interception, preserve committed receipt, clean only isolated fixture records. |
| Enforce current human authority at assignment and receipt recovery / critical | Owner/manager, QA member, unrelated project principal and read/write API token; current membership can change while a command waits for the project lock | Attempt POST, replay and receipt GET as a token/QA/foreign principal and after membership or project-access loss. Expect the native refusal and no assignment/receipt/audit mutation. Read the legitimate Activity feed as a machine token: it must retain the audit reference and count without exposing the full command key/digest or before/after receipt. Verify an authorized human still succeeds; full readback belongs to the acting human. Archive the project through its existing native action and verify history remains at rest while new commands/readback are denied. | DB authority/lock/archive and Activity cases; API machine command/receipt/Activity case; retained QA UI checks. Revoke fixture token and restore only the controlled CI membership/archive setup; never downgrade a real user for manual rehearsal. |
| Roll back every assignment when any mandatory write fails / critical | Isolated migrated CI DB; owner/manager; mixed replacement/add with a protected neighbor; scoped failure injection | Independently fail the second assignment insert, command receipt insert and mandatory audit. For each, issue the same reviewed batch and compare complete before/after assignment, receipt and audit state. Every write must roll back, including predecessor deactivation; the neighbor stays unchanged. Remove injection, retry and verify one complete committed receipt. | DB existing parameterized second-assignment/receipt/audit tests. Always remove the test-scoped trigger/function in finally; never inject failure into the persistent live project. |
| Preserve candidate work and exact-generation revocation through navigation / high | QA author with unsent or acknowledged candidate; owner with multiple assignment generations and neighbors | Close/reopen the candidate form and return from history; retain all input fields and the uncertain request key. Exercise acknowledged-create/submission recovery on the same document/revision. From Assignments, revoke the specifically inspected generation; confirm only that generation becomes inactive, neighbors retain pins and history is readable. | Retained creation/submission recovery and exact-ID revocation tests in `ui/skills.spec.ts`; API KB-boundary coverage. Keep native proposals UNRUN until independently reviewed/approved; clean only fixture objects. |

### Seven-domain disposition for this bounded continuation

| Domain | Prepared or unchanged work | Current synchronization boundary |
| --- | --- | --- |
| Requirements | Reuse D-14/T-451 and Work Package A §15; record exact command/receipt/conflict contract and retrieved user decision in §15.4. | Actual native requirement identity/revision and criterion mapping must be discovered; no published requirement claimed. |
| Test Cases | Existing DB/API/UI owners retain original regressions and add uncovered route/recovery/authority scenarios; case proposals above are ready for review. | Native duplicates, suite placement, case revisions, approval and official execution not performed; UNRUN. |
| User Manual / Docs | Existing implementation design documents Library, history, assignment preview, receipt recovery and separate approval. | No new native manual publication or claim that the production UI already shows this source. |
| Policy / Rules | Preserve human owner/manager, current authority, unchanged eligible immutable snapshots, project scoping and mandatory audit. | No policy rewrite, machine approval, new eligibility retirement rule, root/S0 or automatic activation. |
| Tasks / Issues | Continue PR216 under its original branch; preserve separately owned PR220/221, OAuth218, release155 and bootstrap191. | Existing native task ownership/identities stay untouched; no duplicated or fabricated task. |
| Files / Evidence | Retain original full red logs, exact source/tree/parents and complete author/independent/White reports with methods on the existing PR. | Current implementation CI and admission receive their own observed receipts; CI is not an official native run. |
| Skills Governance | Reuse KB versions, assignments, resolver and human transitions; no live approval or assignment performed. | Current live effective Skill discovery is unavailable through a callable connector; earlier snapshots are historical. |

## Testcase list consistency repair — authorized regression handoff

The owner authorized the recommended cache repair on 23 November after the activation handoff
recorded two successful testcase creations followed by stale unfiltered list responses. This is a
separate bounded correction at the existing `TestcasesListCacheService` and `LegacyService.listTestCases`
owners, before PR228 integration. It does not alter testcase publication, permissions, approval,
filters, sorting, pagination contracts or the canonical specification package.

The preserved original diagnostic reproduced against unchanged development
`c2561acbe16ac3031178ec9b02a5788342049054`: one selected, one executed, one semantic failure. An older
query finished after completed invalidation and populated a later request with the old rows. The
two earlier CI traces establish the stale-response symptom; they do not establish the exact Redis
interleaving. Original reports and methods remain in
[PR228's final evidence receipt](https://github.com/1alextest/Tesbooboo/pull/228#pullrequestreview-6029017176).
Current repair execution belongs to its own exact-source PR/CI receipts, not to these case definitions.

### Reused contract and implementation boundary

The writer audit also found that the dedicated custom-field value endpoint changes the list
projection without invalidating it. Its standalone write owner must invalidate after the completed
write attempt, including a later error after an autocommitted value change. Existing access, ownership
and plan checks remain before that attempt; an explicit transaction runner leaves invalidation to its
outer commit owner. This preserves the existing error and transaction semantics.
The same audit traced V155 custom-field definition triggers to testcase approval/status changes;
all eight existing definition mutation families therefore invalidate after their completed write or
whole transaction. A requirement bundle that creates a testcase invalidates the existing list and
suite projections after its own commit; true replay and requirement-only bundles do not rotate them.

The authoritative database query remains unchanged. An eligible unfiltered read captures a random
project generation and page atomically before loading rows. It may publish those rows only while
that exact generation still exists. A completed invalidation rotates the generation atomically,
making every pagination variant obsolete without a separate key-index enumeration. A pre-write
request may finish its existing database snapshot; it cannot repopulate the cache for later readers.
Uppercase/lowercase forms of the same UUID share a cache identity, matching PostgreSQL project identity.

Page envelopes retain the existing ten-second TTL and 200 KiB stored-size bound. The generation has
a bounded twenty-second TTL, refreshed after a valid population; expiry, eviction or missing state
requires a fresh token and refuses old fills. A failed or disabled cache read cannot acquire a token
after the authoritative load. Redis remains best-effort: failed invalidation and restoration of older
Redis state are not made transactional with the database by this repair. Query errors still propagate.

The v2 namespace prevents old unversioned pages being interpreted as current envelopes. Deployment
must replace/drain every serving old worker before claiming this protocol across the fleet; old
invalidators cannot rotate the new namespace. No configuration change or deployment is authorized by
this document. Rollback restores prior code/protocol with its prior consistency limitation; stale
cache keys expire under their own bounded lifetimes. No schema, migration, dependency or parallel
cache service is introduced.

### Native regression proposals

**Tesbo sync not performed. Native definitions, approval and official execution remain UNRUN.**
Search TESBOPROJECT for the existing testcase repository requirement and equivalent regression cases
before staging. Reuse the actual requirement revision/criteria, suite and case identities; the titles
below are purposes, not fabricated native IDs. Keep persistent definitions and attempts in that
project, while destructive automated fixtures remain in the existing isolated CI tenants.

| Proposed stable case purpose / risk | Preconditions and repeatable actions | Observable expected result / cleanup | Automated owner |
| --- | --- | --- | --- |
| Prevent a read crossing invalidation from seeding later readers / high | Controlled authoritative rows; start and pause an older unfiltered read after it selects rows. Commit the modeled change, complete real cache invalidation, then release the older read and issue a new request. Repeat with a newer valid page already populated. | Later request returns current rows; old fill does not overwrite the newer page. Confirm a following healthy hit avoids another authoritative load. Release every barrier in finally; no production timing injection. | Existing `legacy/testcase-list-cache-consistency.spec.ts` and real-Redis integration. |
| Invalidate all pages for one canonical project identity / high | Populate first and later pages, a different page size and a neighboring project through independent cache clients. Alternate uppercase/lowercase UUID reads and invalidations. | Every page of the changed project becomes a miss; the other project retains its valid page. Fresh population and subsequent hit succeed. Delete only the test's exact unique keys. | Cache unit and `cache/testcases-list-cache.redis.integration.spec.ts`. |
| Reject stale generations after missing state and repeated changes / high | Capture a token, remove/expire its generation while retaining a page, then initialize a fresh generation. Also rotate twice before releasing an old fill. | No old token or envelope is accepted or recreated; a fresh load can populate and hit normally. Verify bounded page/generation TTLs on real Redis without claiming durable failover guarantees. | Cache unit and real-Redis integration. |
| Refresh a warmed list after a dedicated custom-field value write / high | Warm an unfiltered page with an existing value, then use the authorized dedicated value endpoint to change and clear it. In isolated unit coverage, allow the value SQL to commit and fail a later audit; also supply an explicit transaction runner and refuse access/plan before the write attempt. | A subsequent list reflects the committed value; a partial-write failure keeps its original error while invalidating stale data. Nested writes do not rotate before their outer commit, and pre-write authority/plan refusals do not rotate. Restore only scenario-owned definitions/cases and injections. | Existing cache consistency spec and `e2e/api/custom-field-values.spec.ts`. |
| Reflect definition-triggered approval changes in a warmed repository / high | For each native definition create, edit, option add/toggle, reorder, status, delete and restore, approve the controlled testcase and warm two unfiltered pages before that operation. | Exact-case GET and persisted dependency revision/status show the V155 transition; both list pages show In Review and approvalCurrent=false before any next approval/write. Existing authority/plan refusals remain selected. | Existing `e2e/api/custom-fields.spec.ts` plus the actual public setStatus/cache semantic unit regression. |
| Refresh the repository after a reviewed requirement bundle creates a case / high | Warm a repository page before exact reviewed bundle apply. In a separate unit seam, hold transaction completion and exercise successful case creation, true replay, requirement-only apply and rollback. | No invalidation occurs before commit; the created case appears immediately afterward and a healthy cache hit remains possible. Replay/requirement-only/rollback retain the current page; original rollback error propagates. | Existing `e2e/api/requirements.spec.ts`, migrated-DB requirement publication tests and `legacy/testcase-requirement-cache.spec.ts`. |
| Preserve authoritative fallback and query eligibility / high | Disable caching or fail its read/write/invalidation; exercise malformed envelopes and oversized multibyte values. Issue searched, filtered, sorted, archived and ID-selected queries. Separately fail the authoritative loader. | Responses retain the real query's shape and data; filters never receive the unfiltered page. Missing read authority prevents late population. Loader error remains an error. Redis failures retain their documented best-effort/TTL boundary. Restore all injected doubles after each case. | Legacy/cache unit selection; existing API filter, sorting and boundary cases. |
| Keep a warmed repository current through native testcase writes / high | Authorized human in a scenario-owned CI project; warm lowercase and uppercase unfiltered pages. Create, update, archive/restore and delete through existing native endpoints; read the list after each successful operation. | Current content, membership and totals match the committed operation, with original response and authorization contracts. Clean only scenario-owned records/project in finally. | Existing `e2e/api/testcases.spec.ts`, neighboring suite/tag/import owners and `e2e/ui/testcases.spec.ts`. |

The real-Redis tests use two independent clients against the existing disposable CI Redis service,
require an explicit safe loopback test URL, and clean exact random project keys. No global flush,
shared database mutation, local deployment or test-only product endpoint is required. The original
Notes editor test, assertions, timeout and retry settings remain intact; a recovered retry must still
be reported separately from a clean first attempt. Actual selection counts and results are recorded
before/after execution in the repair's PR evidence.

### Seven-domain disposition for the cache repair

| Domain | Disposition and existing owner |
| --- | --- |
| Requirements | Preserve the existing testcase repository read/write contract; discover its actual native requirement and criterion revision before proposing the concurrency/identity clarification. Native synchronization blocked by absent callable Tesbo tools. |
| Test Cases | Reuse existing unit, API/UI and native regression owners; add discriminating late-fill and real-Redis controls. Native proposals above remain unpublished/UNRUN until actual governed staging and review. |
| User Manual / Docs | Internal freshness, fallback, rollout and rollback semantics are recorded here at the existing handoff owner. External UI/actions are unchanged; no new native manual publication claimed. |
| Policy / Rules | Unchanged authentication, tenant/project access, publication, approvals and Skills gates. The cache remains derived and optional; no stronger durable cross-system consistency policy is invented. |
| Tasks / Issues | Continue the separately authorized cache repair in its focused feature PR, retain the original finding on PR228, then reconcile activation. Repository Issues are disabled; no issue/native Bug identity is fabricated. |
| Files / Evidence | Preserve original red, exact source/tree/CI identity and complete author/independent/White reports with methods. Unit doubles, actual Redis, API/UI and native official results stay distinguishable. |
| Skills Governance | Unchanged. No assignment, approval, policy mapping or new Skill is introduced. Live discovery is blocked by the unavailable connector; historical observations are not current effective authority. |

## Release dependencies (separate)

- #191: eligible nonauthor native approval of exact bootstrap head, trusted main installation, observed publisher write and denied-merge enforcement; no admin bypass.
- #155: current-head CI, real deployment mappings/provenance, applied migration ledger, rollback/backward compatibility, release-wide independent acceptance and owner authorization. Green development CI does not satisfy this.

## PR221 activation reliability — bounded regression handoff

**Prepared definitions: Draft / UNRUN. Native synchronization: BLOCKED. Tesbo sync not performed.**
This 23 November continuation prepares the accepted reliability follow-ups to the existing requirement
link activation owner, from integrated source `0222ed20d9ddff4e05c97177977babb108d1833d`. PR228 extends
the overlapping PR226 candidate rather than competing with it. It does not reopen PR221, certify its
later source, or change the eight canonical specification files. The
corresponding bounded design belongs to the existing Work Package A design document. Implementation,
automated execution, independent review, native publication and official execution require their own
subsequent evidence; none is established by these prepared cases.

### Observed access gap and exact-link handoff

The current session's available/deferred tool registry exposed no Tesbo case, requirement or staging
connector. A Plugin Management search for `Tesbo` returned no results. The local browser connection
was unavailable; the permitted cloud-browser read of `/projects/TESBOPROJECT` redirected to the site's
sign-in page, which offered Password and Email code. No credential was requested or extracted, no
authenticated project content was read, and no browser-session HTTP, direct database write, approval,
assignment or publication was attempted. This is a session access gap, not evidence that the project
or its records are absent. Earlier empty inventories and Skill-state observations remain historical.

Use **TESBOPROJECT (`df072dfe-e4d0-406a-9350-e0d022c6323f`)**. PR226 reports a staged **REQ-WPA-12**
reliability bundle at task `3a961980-261a-47d9-b019-7331027b4695`; retain that receipt and **REQ-WPA-11**
as discovery leads, not a live-verified native identity or approved oracle in this session. Once the
authorized connection is available, read the matching existing requirement and its current approved
version, discover matching cases
and suites, and resolve the exact criterion keys for each obligation below. For every proposed case,
record the actual requirement document ID, immutable version ID/digest, exact ordered criterion keys,
existing case ID/revision where present, and review-task/proposal revision. If the requirement or a
needed criterion cannot be established, keep that mapping BLOCKED and propose the amendment through
the existing requirement owner; do not invent a criterion or approve it by writing this ledger.
Preserve a matching case's stable identity and history. The titles below are proposed titles, not
native Test Case IDs. Fixture symbols such as `R1`, `C1`, `A` and `B` describe controlled test data only.

All six cases require a source/build/environment binding, actual actor and authorization, complete
before/after link generations and attributable `requirement_link_reapplied` audit records. The native
requirement linkage for each case is **UNRESOLVED / awaiting live readback** of the existing reliability
bundle and its predecessor. Run destructive
setup, failure injection and membership changes only inside the existing suite's isolated disposable
tenants. Keep persistent case definitions and genuine execution history in TESBOPROJECT; never treat
fixture setup or repository CI as an official native run.

### Proposed case: replay only the current approved requirement and case basis

**Risk / linkage obligation:** high; exact approved-basis replay, immutable generations and one audit.
**Role / setup:** authorized human owner or manager; a currently approved case revision and approval
revision; one requirement with an earlier approved version and a different current approved version;
record the target link and the exact ordered criterion group. Create any otherwise unreachable
historical-generation arrangement only in the isolated database fixture.

1. Activate the target group on the current approved requirement version using the reviewed case and
   approval revisions. Read back the created link, retired predecessors and one attributable audit.
2. Retry using the same original link ID and revision basis. Expect `replayed: true`, the same created
   link ID on the current approved requirement version, and no additional generation or audit.
3. In a separate controlled fixture, leave only a matching active link on an older requirement
   version, then retry a retired link. Expect refusal rather than replay of the older version. Also
   remove the current approved requirement basis in a controlled variant: replay must not bypass the
   requirement approval guard.
4. In a separate real lifecycle, keep the requirement approved and edit the case after a successful
   activation. Retry the retired input link with its earlier case revisions, before and after the new
   case approval. Expect `CASE_REVISION_CONFLICT`; historical links and audit must remain unchanged.
5. An isolated missing-approval-receipt integrity fixture with the same case edit revision must refuse
   with `CASE_NOT_APPROVED`. This fixture does not imply a product revocation operation. A legitimate
   activation on the new current case basis must subsequently replay exactly without another write.

**Persisted refusal oracle:** all link rows, states, revision pins and relevant audit rows equal the
captured before-state; no stale generation is returned as current success. **Automated owner:** extend
`Tesbo-Backend-Nest/src/legacy/testcase-proposal-review.db.spec.ts` and the replay assertions in
`e2e/api/requirements.spec.ts`. DB selectors: `does not replay an activation after its requirement basis
becomes %s` and `does not replay a retired link when the current case is %s`. **Cleanup:** use the existing
fixture-owned requirement/case/Skill cleanup in `finally`; preserve real case and attempt history.

### Proposed case: guard the displayed requirement version without breaking omitted-field callers

**Risk / linkage obligation:** high; explicit selection freshness and compatible omitted-field behavior.
**Role / setup:** human owner/manager with current case approval; the UI has read approved requirement
version `R1`; another authorized fixture actor can approve `R2` before activation obtains its lock.

1. Send activation with the optional expected requirement-version field set to the exact displayed
   `R1`. Advance the approved pointer to `R2` before the writer revalidates it. Expect a version-conflict
   refusal on both the active-link path and a retired-link replay path, without publishing to `R2`.
2. Refresh and explicitly review `R2`, then send its exact version and current case revisions. Expect
   successful activation on that basis. A supplied malformed version must receive validation refusal.
3. Exercise the existing caller contract with the new optional field absent. With all existing
   authority and case/requirement approval gates satisfied, activation remains supported and binds to
   the current approved requirement version observed by the authoritative transaction.

**Persisted refusal oracle:** no changed link generation, retirement, audit or approval pointer from the
refused activation; the independently authorized `R2` approval retains its own history. **Automated
owner:** existing DB owner plus `e2e/api/requirements.spec.ts` and the requirement review journey in
`e2e/ui/skills.spec.ts`. Field: `expectedRequirementVersionId`; mismatch: `REQUIREMENT_VERSION_CONFLICT`;
DB selectors: `refuses a changed displayed requirement version before retiring links or reaching
criterion validation` and `validates an explicitly supplied requirement basis while preserving
successful legacy activation`.
**Cleanup:** release held locks in `finally`, remove only fixture-owned actors/objects, and never reset
real approval history merely to make the test repeatable.

### Proposed case: activate one exact ordered criterion group and preserve its neighbors

**Risk / linkage obligation:** high; relation identity, scope isolation and ordered-array preservation.
**Role / setup:** human owner/manager; the same approved case is linked through `[A, B]`, `[B, A]` and a
distinct neighboring group, using valid fixture criterion keys. Capture every group's generation and
history. These arrays are intentionally different identities under the existing owner contract.

1. Open the review surface and verify separate rows/controls for the exact ordered groups. Do not
   sort, normalize or deduplicate their order into a single group.
2. Activate `[A, B]`. Expect only that group's active/proposed predecessors to retire and exactly one
   current active generation for its reviewed case/requirement basis. Read back `[B, A]` and the other
   neighbor unchanged, including IDs, states, revision pins and timestamps.
3. Replay the first command and separately activate the reversed group. Each result, notice and audit
   must remain attributable to its own exact ordered group; neither operation consumes the neighbor.

**Persisted isolation oracle:** full neighbor rows/history remain equal after each unrelated action;
the UI does not hide a group because it shares a case ID or the same unordered keys. **Automated
owner:** existing DB link tests and `e2e/ui/skills.spec.ts`; add API assertions in the existing
`e2e/api/requirements.spec.ts` owner where the route boundary is exercised. DB selector: `activates only
the selected ordered criterion group and exposes each persisted case basis`. Retain PR226's separate
reversed-order regression and the original API journey.
**Cleanup:** remove only scenario-owned fixture links and parents through the established cleanup;
never retire a real neighbor or delete a persistent regression case.

### Proposed case: reconcile two independently uncertain activation outcomes

**Risk / linkage obligation:** high; per-group uncertain-write state and independent recovery.
**Role / setup:** human owner/manager; two eligible ordered groups in the same review panel; transport
interception can discard each response after a real commit and delay the subsequent coverage reads.

1. Activate the first group, lose its committed response and keep its readback unresolved. Activate the
   second group and independently lose that response. Both groups must retain their own attempted
   link, ordered keys, requirement version, case revision and approval revision; the second attempt
   must not overwrite or clear the first group's uncertainty.
2. Restore authoritative proof for only the first attempted basis. Confirm only that group's recovery;
   the second remains unconfirmed with no false success notice or blind repeat write.
3. Restore exact proof for the second basis. Confirm it independently. Count one committed activation
   and one attributable audit per group; read-only reconciliation must create neither.
4. Edit the case through its native writer without reapproving it, then refresh coverage through the
   existing interaction. The earlier link IDs and history stay intact but no longer qualify as
   approved coverage; no green current-success notice may remain beside that invalidated state.

**Persisted/visible oracle:** two separate real commits remain attributable, while each UI conclusion
depends on its own exact proof. A failed/partial read is not an empty or successful state. **Automated
owner:** extend the existing lost-activation-response journey in `e2e/ui/skills.spec.ts`; retain real
API/DB readback for commits/audits rather than infer them from mocked responses. UI selector:
`activation recovery retains two uncertain ordered groups and verifies their exact native outcomes`.
**Cleanup:** release every held response and remove every route interception in `finally`, then clean
only the isolated fixture records; retain the failed-response and recovery evidence separately.

### Proposed case: later revisions cannot confirm an earlier uncertain attempt

**Risk / linkage obligation:** high; evidence freshness and truthful attribution across revisions.
**Role / setup:** human owner/manager; capture an attempted group's exact requirement version, case
revision, approval revision, ordered keys and original link ID; lose its response and delay readback.
Use separate fixture variants for case edits/reapproval and requirement-version approval changes.

1. Before recovery completes, advance the case or approved requirement basis and activate a valid link
   on that later basis through an independently authorized fixture action.
2. Return coverage containing the later active link. It must not clear the earlier uncertainty or
   display that earlier attempt as verified merely because the case ID/group matches or current
   coverage is approved. Recovery compares the persisted approval revision as well as the edit
   revision; do not invent a product action that changes only an approval receipt for this variant.
3. Where the original exact basis remains independently provable, supply that proof and reconcile
   only its attempt. Where it is superseded and no such proof is available, retain an honest
   unconfirmed/review-needed outcome; do not relabel the later action as the earlier result.

**Persisted/visible oracle:** recovery adds no writes, duplicate audits or approval changes; original
and later generations retain distinct attribution. Current coverage and confirmation of a past attempt
remain separate facts. **Automated owner:** `e2e/ui/skills.spec.ts`, with backend revision/replay controls
in the existing DB/API owners. UI selectors: `activation recovery does not confirm an earlier 503 from
a different case approval basis` and the corresponding `requirement` variant. The additional UI case
`activation refuses the displayed stale requirement basis and preserves its error after the group
disappears` verifies the semantic refusal survives readback even when the previous row is absent.
**Cleanup:** remove transport interception and
isolated fixtures, retaining all source-bound historical execution evidence.

### Proposed case: match activation affordance to server authority and preserve server-error uncertainty

**Risk / linkage obligation:** high; consistent authority and truthful failure classification.
**Role / setup:** isolated owner/manager, QA reader and legacy-role fixtures; include raw `admin` and
`test_manager` memberships, which the pre-existing canonical project-role contract maps to manager.
Every fixture actor must select the valid active organization so membership checks cannot disguise the
role result. The initial raw-denial oracle was incorrect and is replaced by this established contract.

1. Verify the canonical owner/manager and both manager aliases can inspect and actually activate an
   eligible link. Independently retrieve the exact persisted link and attributable audit. Canonical QA
   remains read-only; direct forbidden calls still fail server-side with no link/audit changes. Retain
   machine-principal refusal and current project/workspace authority checks.
2. Inject an actual server 5xx for the authorized activation path. Preserve its server-error meaning;
   the UI must not report a definite validation/permission rejection or confirmed success solely from
   that response. Reconcile the exact attempted basis through authoritative reads, without automatic
   repeat activation. A controlled pre-commit failure must leave persisted state unchanged.
3. Remove the failure and verify legitimate operation. Separately retain existing 4xx validation,
   authorization and stale-basis refusal messages so a known refusal is not relabeled as an unknown
   infrastructure failure.

**Persisted refusal oracle:** unauthorized/pre-commit-failed attempts create no new or retired links,
audit records or approvals. **Automated owner:** `e2e/ui/skills.spec.ts` and existing API/DB authority
tests. UI selector: `activation accepts documented manager role aliases and still refuses a QA reader
without writes`; retain PR226's independent 503/retry assertions. **Cleanup:** remove scoped
faults and restore/delete only disposable fixture memberships in `finally`; do not change real users'
roles or policy to run the case.

### Native record dispositions and completion boundary

| Domain | Bounded disposition | Native status |
| --- | --- | --- |
| Requirements | Discover and reuse the REQ-WPA-12 reliability bundle reported by PR226 and its REQ-WPA-11 predecessor; amend only evidenced missing obligations. | BLOCKED: live identity/version/criterion linkage unverified. |
| Test Cases | Six prepared regression purposes; search and revise matching native cases before proposing new identities, with exact source selectors finalized after implementation. | Draft / UNRUN; no staging or publication claimed. |
| User Manual | Existing Work Package A design owns the reliability behavior and recovery explanation; native manual changes depend on actual affected content. | Assessment retained; native content unavailable. |
| Policies | Existing human authority, ordered group identity, revision guards and no fabricated execution remain unchanged; no new authority or role promotion. | No native policy mutation required by this handoff. |
| Tasks / Issues | Link PR226/228 and exact evidence to the existing reliability task after discovery; retain the reported task ID as a lead. | BLOCKED: current native task revision/state unverified; no replacement task created. |
| Files / Evidence | Retain failing-first/after results, source/build/CI bindings, audit/generation readbacks and review originals with their actual outcomes. | Prepared evidence contract; new execution and native evidence upload not performed. |
| Skills Governance | Reuse current approved methods and effective assignments only after authorized readback; §16.8 records the unresolved reviewed link-Skill basis after a requirement-only revision. | PARTIAL/BLOCKED: link reapply lacks the documented guard, the general basis contract needs an authorized decision, and live versions/assignments remain unverified. |

These definitions are a native synchronization handoff, not native acceptance. Finalize the source
selectors and actual run evidence separately; all six native execution statuses remain UNRUN until a
genuine persisted attempt is read back. Preserve failed or blocked attempts and later regression
history under the same stable case identities. Source CI, a successful publication, and case approval
must never be substituted for one another.

### Source-bound execution evidence

The tests-first checkpoint is PR228 head `96870b71910d7e5f875516073dd4ddf4ef72e5d6` over development
`0222ed20d9ddff4e05c97177977babb108d1833d`, changing only the two DB/UI test files. Actual checkout
`70d80894560f6100efa9129089e34d4a5d1d8f06` has those ordered parents and the same tree
`1c58fd7f43cec056a202fea14aa5026af0c208ec`. The [database job](https://github.com/1alextest/Tesbooboo/actions/runs/45239600554/job/137920344630)
completed **7 failed / 688 passed / 695 total**, with all seven intended regressions reaching their
assertion. The [complete coordinator receipt](https://github.com/1alextest/Tesbooboo/pull/228#pullrequestreview-6027398936)
records each failure, method and source binding. This is failing-source evidence, not a fixed-source
or native execution pass.

PR226's first [database run](https://github.com/1alextest/Tesbooboo/actions/runs/45239479050/job/137919921284)
had one earlier prerequisite-oracle failure (requirement unapproved when testing case approval).
Its `6502f70fc7d905edb508227a21ae807b014e4e71` successor separates those fixtures and is reused here;
the continuation additionally supplies valid active-workspace membership to its role actors. The
imported UI fixture's new ordered groups also require AC-2 in its staged native requirement. These
fixture corrections preserve exact refusal and persisted-state assertions. The initial raw-alias
denial proposal is expressly corrected against the pre-existing canonical role policy, not presented
as a product defect or used to claim a false red-to-green result.

The current implementation contains nine requirements API definitions and 35 Skills UI definitions
(44 selected definitions). Static type/lint/discovery checks do not establish those executions.
Actual later CI, screenshot artifacts and final independent/White verdicts must be bound to their
own exact candidate on PR228/226; this ledger does not predeclare their outcomes. The six prepared
panel captures will be actual browser-fixture screenshots only if the corresponding test states are
reached. Native TESBOPROJECT execution remains UNRUN.
