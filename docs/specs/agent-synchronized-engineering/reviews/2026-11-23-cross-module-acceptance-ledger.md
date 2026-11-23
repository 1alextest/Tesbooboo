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

## Release dependencies (separate)

- #191: eligible nonauthor native approval of exact bootstrap head, trusted main installation, observed publisher write and denied-merge enforcement; no admin bypass.
- #155: current-head CI, real deployment mappings/provenance, applied migration ledger, rollback/backward compatibility, release-wide independent acceptance and owner authorization. Green development CI does not satisfy this.
