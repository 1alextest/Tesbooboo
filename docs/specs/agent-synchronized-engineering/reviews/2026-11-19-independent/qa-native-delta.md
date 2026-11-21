# QA Team — bounded native governance delta receipt

## Identity, scope and verdict

- Target: Tesbo / `1alextest/Tesbooboo`, PR167; not Nesberry.
- Source checkout: `/workspace/scratch/fb086055b433/tesbo-review-3ebda243`.
- Verified source commit: `3ebda24300d55a6d3e2141b9d64aecde23e7d4c4`.
- Verified source tree: `085693afe6a6e9673a74a730ce32bcee7bc8911f`.
- Prior QA source: `3299691e11941d5ab701c2f9b2dc53ff29d808da`, tree `332665d638e38a635ead798f87e2ed192d66a8d3`. The original `assurance-working/qa-integration.md` was not edited during this delta.
- Method: unchanged QA Team charter1.6, review orchestration and portability/evidence policies at Nesberry method `d83549c85a4dcd047fb40dc4fba4ec62737ab0fc`; original eight canonical Tesbo1.4.28 specifications and prior13 discriminating oracles remain the reference. This is a bounded follow-up, not a new full-charter/full-platform review.
- Authorized work: source review, isolated non-DB checks, read-only retrieval of GitHub CI evidence. No product edits, local/shared/customer database, migrations, browser runtime, login, deployment or customer mutation occurred. The isolated HTTP checks use loopback Nest servers with injected identity/persistence, not a real authenticated Tesbo environment.

**Scoped verdict: repairs to the four inspected mechanisms are substantiated at differing evidence levels, but this immutable candidate is NOT READY for completed native integration acceptance.** The exact-head-associated PostgreSQL gate has two fixture failures before its rename-history assertions, and the new Model Run recovery browser scenarios have not executed at this receipt's cutoff. A directly coupled residual revision-selection defect remains. This is not a finding that the three repaired backend mechanisms still fail their original independent probes: all three old red checks now pass with unchanged assertions.

No full I3-Q, release, freeze or original external-executor loop verdict is issued. The49-journey denominator,27 impacted journeys and22 broader obligations remain open at full journey scope unless specifically substantiated below.

## Delta oracles fixed before accepting new evidence

| Oracle | Required effect and conforming neighbor |
|---|---|
| D1, original QA-INT-01 | Both actual Model Studio approval/candidate HTTP routes and shared methods reject machine or absent trusted human principals before effects. A forged request-body identity must not help. Human approval and official Draft creation work; authorized machine generation/Run use remains available. |
| D2, original QA-INT-02 | Create/add/repeat Bug associations preserve complete execution result, performer/time/history/steps, Run state and selected-case snapshots. Only the Bug relationship changes. Actual observed failure continues through the explicit result writer; denied association cannot announce success. |
| D3, original QA-INT-03 | A recorded case revisionA cannot silently dispatch reapproved caseB. Refusal leaves native Run/items/executions/manifest and mappings unchanged. Explicit fresh relinking permits the new Run and does not rewrite the old manifest. Unrecorded legacy mappings must be identified honestly; this bounded repair does not certify the full proposed mapping/coverage system. |
| D4, original QA-INT-04 | Persist exact browser intent before non-idempotent POST; lost ACK/5xx/timeout/malformed success remains OUTCOME_UNKNOWN through reload, without automatic replay. Readback/explicit candidate identification or an acknowledged separate new intent resolves the gate. Real refusals remain distinguishable. MBT-C07 permits this manual fallback; lack of server idempotency alone is not a defect. |
| D5, coupled history | Rename a current native testcase through ordinary edit or selected proposal apply. Its existing Run/item/execution records stay exact; a later reapproved selection captures the renamed identity. |
| D6, coupled late completion | A response for the original model context settles only that intent and cannot clear the newly selected model's form or overwrite a newer revision selection. Preserve the model-wide unknown-intent fence. |

## Finding dispositions

### QA-INT-01 — machine model approval/publication bypass: repaired in source and independent HTTP/domain probes

`Tesbo-Backend-Nest/src/common/testcase-publication.policy.ts` now includes both model `approve` and `candidates` POST routes. `src/behavior-graph/model-studio-models.controller.ts` derives the principal from trusted request state for both methods. `src/behavior-graph/model-studio-repository.ts` calls `requireHumanReviewPrincipal` at the start of both public mutations, before access/database work. Request-body `principal`/`approvedBy` is not the source of authority.

Reviewer-authored `qa-delta-model-http.spec.ts` loads the actual controller, global REST guard and repository in a real Nest HTTP server. It demonstrates:

- Read and WRITE machine identities receive403/HUMAN_PUBLICATION_REQUIRED on both routes, despite body claims, without membership or database calls.
- Anonymous and revoked human identity fixtures are refused before database effects on both routes.
- Human approval succeeds; machine path generation remains usable; human candidate materialization produces a Draft and a mapping.
- Both shared methods independently refuse undefined and api_token principals, even with body claims, without database effects.

Result: **7/7 passed.** Identity middleware and all persistence are injected fixtures. This proves real HTTP/controller/service wiring under those fixtures, not cookie/token parsing, actual roles/tenants, PostgreSQL or deployment. The existing focused guard tests retain machine generation/Run neighbors. The full real-token API scenario is present at `e2e/api/model-studio.spec.ts:766–829`, including authoritative before/after data and a human/machine positive sequence; it was source-reviewed, but its smoke lane had not run at cutoff.

**Disposition:** original bypass mechanism closed at inspected source/isolated HTTP/domain level. Full current-token/membership and race/entitlement matrix remains subject to the existing exact-build runtime gates; this receipt does not claim all-entrance security acceptance.

### QA-INT-02 — Bug links manufacture verdict/time/performer: repaired; independent probes and relevant migrated-PG suite pass

`legacy.service.ts` removes `failLinkedExecutions` and its create/add callers. The shared Bug association functions now update only the Bug/link owner. Inspection of `parseBugLinks`, target locking, existing-link validation and `replaceBugLinks` confirms they validate project/parent identity, preserve exact historical tuples where allowed and write Bug links, rather than result fields. Creation and add-link retain their canonical service entrypoints; no parallel result store was added.

The two reviewer-authored old probes were copied to the new source with only import-path changes. Both now preserve the original Passed/time/performer equality assertion. The updated author boundary matrix covers create/add × manual/automation × open/closed × Passed/Failed/Untested/Blocked with full execution/run/snapshot equality, no execution UPDATE, no result activity/notification, repeat behavior and transaction failure. Those tests passed in the focused local run.

The retrieved exact-head-associated PostgreSQL job reports `src/automation/automation-closure.db.spec.ts` and `src/legacy/bug-metadata-writes.db.spec.ts` PASS. Source inspection of the former includes actual persisted complete execution/item state and both association-versus-close orderings: close first retains association without altering result; link first blocks close until association commit, then close still counts original Passed. This is stronger evidence than the local mocked field checks. It is CI evidence, not locally executed PostgreSQL.

The source also removes the misleading full execution page assumption and reads authoritative execution state after linking. Browser behavior remains pending. The complete DIRECT/SIDE/UNDETERMINED classification, step evidence and governed historical correction capabilities remain unimplemented/unclosed; association-only preservation does not create them. Native explicit result changes remain the positive compatibility neighbor.

**Disposition:** original automatic-result-mutation mechanism closed in reviewed source, local independent checks and relevant CI PG suites. Full UI/alternative actor journey acceptance remains pending, with the canonical oracle preserved rather than normalized to old behavior.

### QA-INT-03 — known recorded mapping permits newer case substitution: repaired for the declared bounded case

`model-studio-repository.ts` now reads/locks the current testcase edit revision when linking and rejects a supplied stale revision. Reusing an existing mapping with a different revision also conflicts instead of laundering the old mapping. Dispatch reads mapping ID/revision, locks/reloads cases and rejects any recorded revision that differs before calling the native Run writer. The resulting manifest includes each mapping ID, testcaseRevision and CURRENT/UNRECORDED basis.

The original independent A→B dispatch probe, unchanged except source import path, now rejects before native creation. The relevant real PG scenario in `model-studio-runs.db.spec.ts:233–275` creates a Run on mappingA, edits/reapproves caseB, verifies refusal and unchanged Run/mapping rows, rejects silent relinking, explicitly removes/relinks, then permits a new Run while asserting the original manifest is unchanged. The entire Model Studio PG suite passed in job136017777581.

**Scope qualification:** omitted legacy link revisions are still allowed and labelled UNRECORDED; generated-case provenance is not converted into a full immutable accepted mapping event/condition model. This is a truthful partial implementation, not proof of every proposed MBT-C05 requirement or an invented ratified activation policy.

**Disposition:** known-recorded-stale-admission failure closed in source, the old independent probe and the relevant CI PG suite. The broader mapping/history obligations from the prior receipt remain explicitly open.

### QA-INT-04 — immediate retry after lost Model Run ACK: core mechanism repaired; browser closure pending

The new browser intent owner stores principal/project/model, revision/hash, case selection, request name/environment and timestamp **before** calling the native non-idempotent owner. Storage failure prevents POST. A synchronous submission ref protects the same-page pre-render double click. The typed dispatch API treats network failure/timeout,5xx/408, malformed/empty success and mismatched response identity as MutationOutcomeUnknownError; it does not replay the mutation. Confirmed refusals retain their error status and clear only their own intent.

Reload reads the saved marker. Inspection failure does not pretend no Runs exist or enable new intent. Candidate identification independently fetches native Run, model provenance and executions and checks their context before resolving the marker. A separate request requires successful inspection plus explicit acknowledgment that the first may still commit. Clearing is conditional on the original intent ID so a late response cannot erase a newer marker. These are browser recovery records, not native Runs or server idempotency receipts.

The delegated bounded QA subreview ran `scripts/model-run-recovery.test.mjs`: **12 selected/12 ran/12 passed/0 failed/0 skipped.** It compiles the production helper/API and injects HTTP/storage; it does not render React or prove reload/response loss in a real browser. This agent independently inspected the central page/state and recovery code and the returned subreceipt. No author review was used to establish the oracle.

Three discriminating UI tests exist in `e2e/ui/model-studio.spec.ts:64–205`: real commit/lost ACK/reload/reconcile with persisted counts; synthetic503 plus failed inspection and acknowledged separate new intent; real409 stale mapping refusal with no Run/manifest. At cutoff the smoke job had not reached this lane. No current-head screenshots/traces were available, and none are inferred from the older288c baseline.

**Disposition:** immediate generic-error retry mechanism repaired in source and helper/API checks; complete browser recovery closure pending. The residual D6 issue below prevents an unqualified context-lifecycle pass.

## Directly coupled findings and limits

### QA-DELTA-01 — rename-history runtime test setup fails before its oracle (gate defect, not established product failure)

Source removes both automatic `UPDATE cycle_items SET snapshot_external_id...` statements from ordinary testcase rename and selected proposal apply. That is the expected automatic-history preservation change. An explicit privileged history-import `refreshSnapshots` path still exists; it is outside the narrow automatic rename repair and is not certified by this delta.

The exact CI PG job fails two new `testcase-proposal-review.db.spec.ts` rename-history cases at184–188. Their fixture is `REN-` plus a full32hex UUID: **36 characters**. Native `legacy.service.ts:5164` enforces a32-character Test case ID. The stack traces show ordinary edit and proposal staging both reject at `assertTestcaseFieldLengths` before the rename/history assertions execute. This is neither proof that history still mutates nor a passing gate.

**Required disposition:** shorten only the test fixture to a valid unique ID; preserve complete original Run/items/executions equality, the current case In Review transition, reapproval and later-Run new-identity assertions. Parent independently identified the same issue and reported an intended fixture-only repair. That later tree/run is not assessed here.

### QA-DELTA-02 — late completion can overwrite a later historical revision selection (medium, residual source defect)

In `Tesbo-Frontend/app/(app)/projects/[id]/model-studio/page.tsx`, the Run scope key at128–134 excludes revision. The revision selector at700–703 remains enabled while a dispatch is pending. A user can dispatch approved headR2, choose historicalR1, then receive the old success. The scope guard at486 still matches; success increments reloadToken at495. The detail effect depends on that token and unconditionally sets revisionId to head at196. Successful reconciliation at551 has the same reload consequence.

The underlying unconditional head reset and dispatch reload predate this delta. The new guard leaves this requested temporal boundary unprotected, and reconciliation adds a trigger. The demonstrated effect is a lost UI selection, not corruption of stored revisions or Runs. Different-model selection callbacks update the visible scope, so this finding must not be described as a reproduced cross-model overwrite.

**Required check:** delay dispatch/reconciliation, select historicalR1, release the response, assertR1 remains selected while the original intent settles. Keep the model-wide unknown-intent block; splitting it per revision would create a new retry channel. Source-confirmed and independently re-read here; no browser reproduction.

### Adjacent inherited error projection — unavailable coverage is described as no cases

A failed coverage GET sets coverage to null at201–206; eligibleRunCases becomes[] at234. The Run section then says “No cases belong to this revision yet” at1057–1060, while the separate Coverage panel says unavailable. The dispatch guard blocks sending without coverage, so the observed source risk is misleading recovery/setup information rather than unsafe creation. This inherited source issue is recorded as an adjacent limit, not asserted as a new regression.

### Conservative reconciliation restriction

Candidate readback also compares current native name/environment and live execution membership to the original request. If another user renamed/edited the actual Run after an ACK loss, that candidate remains unresolved even if its immutable model provenance matches. This is conservative and truthful; the explicit separate-request fallback remains available. It is not a demonstrated duplicate-creation defect. A future policy may decide how edits and immutable creation intent should be reconciled; this review does not invent that policy.

## Executed evidence ledger

All new local evidence is under `/workspace/scratch/fb086055b433/assurance-working/`; production checkout files were not changed.

| Artifact/check | Observed outcome | Evidence boundary |
|---|---|---|
| `qa-delta-jest.log` with `qa-delta-jest.config.json` | 4 suites /153 tests passed | Actual guard tests, existing Nest HTTP integration, Model Studio composition, full Bug association boundary matrix. Transpile-only ts-jest, authorized main-checkout dependencies; mocked persistence. |
| `qa-delta-contract-probes.spec.ts` / `.log` | Original3 red checks now3/3 green | Only source import paths changed from prior reviewer checks. Bug manual/automation equality and stale recorded mapping rejection assertions retained. |
| `qa-delta-model-http.spec.ts` / `.log` | 7/7 passed | New independent actual Nest/HTTP/controller/guard/repository probe with synthetic identities and database/native-writer collaborators. No real cookie/token/PG claim. |
| `qa-model-recovery-delta.md` |12/12 helper/API checks, source/UI-test review | Delegated QA subcheck. No browser/React/server/DB execution by that reviewer. Parent re-read the source findings before accepting them. |
| `qa-delta-database-integrity.log` |17 PG suites:16 pass/1 fail;601 tests:599 pass/2 fail | Downloaded exact-head-associated CI job136017777581. Migrations and schema gates passed; rename tests fail before their substantive assertions. |
| `qa-delta-ci-initial.json`, `qa-delta-ci-cutoff.json` | Exact run/job metadata and retrieved merge-commit identity retained | Read-only GitHub connector responses. Cutoff is a snapshot, not a promise of final pipeline outcome. |

The local numbers describe distinct test executions, not full material journeys. They must not be summed with PG counts into a claimed full-system coverage percentage. A green suite does not establish every branch outside its fixtures.

## Exact CI identity and cutoff

Runs were retrieved through the commit-specific GitHub Actions query for source3ebda243:

- Behavioral: [44654648269](https://github.com/1alextest/Tesbooboo/actions/runs/44654648269). `api-mcp-contracts` and `transactional-concurrency` succeeded; `database-integrity` failed as described. The actual checked-out build is **`c181e36ccdbf43237efbb1a9e9ae8dff98478c34`**, whose message is “Merge3ebda243… into6897f989…”. The job log and independent commit retrieval both establish that identity. This receipt does not relabel the merge checkout as the raw source commit or assert an independently fetched merge-tree hash.
- Core: [44654648355](https://github.com/1alextest/Tesbooboo/actions/runs/44654648355). Latest retrieved job statuses: frontend-quality, backend-quality, architecture-quality and sdk-quality all completed successfully. Typecheck/build/selected test steps are successful according to job metadata; their complete logs were not separately audited, so no new inferred assertion totals are supplied.
- Smoke: [44654648304](https://github.com/1alextest/Tesbooboo/actions/runs/44654648304). Latest retrieval: playwright-smoke still running its initial “Verify service readiness and run smoke tests” step; later model/API/UI, knowledge, native run and impact lanes pending. Container-security and dependency-audit jobs completed successfully. Query for `ci-smoke-evidence` returned no artifacts. No unavailable artifact or downstream stage is counted as passed.

No idle wait for CI completion occurred. Future artifacts, later commits or reruns require a new evidence addendum tied to their own identity.

## Denominator, semantic limits and handoff

The original49 journeys retain43 High/6 Medium risk. The bounded delta directly advances subpaths of GJ-02,11,15–18,28,40–42,45–47 and the coupled history/UI obligations. It does not close their complete alternate actor/entrance/permission/restore/runtime branches merely because a mechanism is repaired. The original27-impact/22-broader split remains; all22 broader original-loop/platform obligations are still unclosed by this receipt. No full journey is newly marked deployment verified. Some real PG lifecycle subcases are now executed evidence, unlike the prior source-only receipt.

The following distinctions remain essential:

- Official native Draft publication differs from human approval and from execution evidence.
- A Bug association is not a direct-failure classification or historical result correction.
- Model approval/generated paths/native case outcomes are not verified coverage.
- Recorded-current mappings, known stale mappings and UNRECORDED legacy mappings differ.
- Local recovery intent is not a server receipt; an unknown outcome is not a failed create.
- Existing Run snapshots and current testcase identity differ after rename.
- Real PG subcase evidence, injected HTTP evidence, pure helper checks and source reasoning are different proof grades.
- The external-executor original task→assigned attempt→original report bytes→analysis→linked retest→selected human publication loop remains unimplemented/unaccepted by these repairs.

**Handoff decision:** preserve the positive closure of the inspected backend failure mechanisms; retain NOT READY for full bounded integration acceptance at3ebda243 because the rename gate has not exercised its assertion, browser recovery evidence is pending and QA-DELTA-02 remains a coupled source defect. Repair/verify those exact gaps without changing the canonical oracles or weakening test assertions, then attach a fresh immutable candidate and executed evidence. Root/White retain broader prearchitecture/freeze reconciliation; this QA receipt does not supersede them.
