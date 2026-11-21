# Native QA retest and owner allocation — 20 November 2026

## Outcome and evidence boundary

This increment adds **Retest selected** to the existing native Test Run workflow. A human selects exact source executions, reviews their recorded observations against each case's current approved definition, and creates a separate Run whose new executions start Untested. The original Run, results, evidence and Bug associations retain their identities. This works with ordinary manually authored cases; it requires no repository, AI key, behavior model or automation driver.

The implementation and independent allocation reviews started from `development@1fe100588be6c3a1627ee39a4b0bbc1c0d9da2ea`, after foundation PRs #167 and #168 merged. Their published eight-file canonical reference is v1.4.34, NOT FROZEN. The branch incorporated the documentation-only PR #169 merge at `ed71aa544108760f711ed4cb1bb7b7ba008ef417`, then reconciled the concurrent documentation-only PR #171 merge at `8c254130384c7d6ae93dd7f10b9bfa271007e224`. All incoming documentation and its v1.4.38 assurance archive are preserved; product source bytes in the reviewed baseline are unchanged. The merged semantic preparation records remain PROPOSED / NOT FROZEN and do not silently convert the earlier native allocation review into full-package approval. A separately bound [v1.4.38 native reconciliation](native-v38-reconciliation-publication.md) finds no material conflict in the examined clauses and preserves their wider open requirements.

**Implementation is distinct from acceptance.** The frozen architecture receipts below inspected the clean baseline, not this changing implementation. Exact candidate commits, actual CI results and remaining limitations are recorded in the pull request. A successful source review, typecheck or test collection cannot certify database, browser or deployed behavior. This record does not claim production deployment or the complete external QA loop.

## Reuse and native ownership

| Required fact or action | Existing authoritative owner | Extension |
|---|---|---|
| Human-authored case and exact approval | `testcases`, approval receipts and the native approval policy | Retest eligibility uses the current exact approval; changed or unknown source definitions require visible comparison. |
| New execution occasion | `cycles`, `cycle_items`, `executions` | Reuse `createCycleWithTestcasesForUser` and approved-item admission in one transaction; no second Run or result store. |
| Source-at-creation relationship | Destination `cycles` row | V158 stores one immutable creation manifest, source Run identity, request identity and digests. |
| Terminal creation/cancellation disposition | Native Run command owner, owned `cycle_retest_requests` child | A cancelled request has no destination; this immutable fact fences delayed same-key creation without inventing a Run or attempt. |
| Original evidence and defects | Native attachments/storage and Bugs/links | Capture references and source metadata; do not copy old files or associations as new execution proof. |
| Current membership and plan authority | Existing project authority and `PlanLimitsService` | Recheck after serialization waits; the transactional plan path uses the same policy evaluator without the transport's earlier cached entitlement. |
| Recovery and navigation | Existing Run endpoints, readable-route resolver and Run UI | Retained receipt readback, exact replay and scoped recovery after a source or destination is soft-deleted. |
| User interaction | Existing Run table, modal primitives, execution drawer and full page | Selection on active/completed Runs, review dialog, original/new links, truthful read failures and durable pending intent. |

The native creation helper's ordinary `skipped` contract remains unchanged. Retest prevalidates its stricter exact occurrence set and refuses the entire selection if any selected occurrence is missing, foreign, stale or not currently approved.

## Command and recovery contract

- `GET /api/cycles/:cycleId/retests/preview` receives 1–100 distinct execution IDs. Its digest binds the selected source observations and current case definitions.
- `POST /api/cycles/:cycleId/retests` receives the retained UUID request key, exact IDs, reviewed digest and target Run details. A native human principal is required. The new Run, case membership, executions, immutable manifest and mandatory audit commit together.
- `GET /api/cycles/:cycleId/retests/requests/:requestKey` reads the authoritative committed receipt. The browser saves the exact request before POST and uses this read after reload or uncertainty.
- `POST /api/cycles/:cycleId/retests/requests/:requestKey/cancel` reconciles the exact saved request: return its created destination if creation won, or commit terminal cancellation and mandatory audit. Current human authority is required; no fresh Run is created.
- `GET /api/cycles/:cycleId/retests` lists the existing child Runs. A failed lookup remains an error, not an empty list.

Exact same-key retries return the same committed destination. Reusing a key with changed input conflicts. A read returning 404 after a lost response does not prove the POST failed; the UI retains the saved intent and offers readback or the same idempotent request. An explicit stop/reconcile action serializes with creation and either recovers the existing destination or records a terminal cancellation that fences every delayed same-key create. Only an exact terminal outcome releases the browser intent. A new preview and key are then safe; a timeout or 404 alone never manufactures a replacement operation.

Deleting the source Run cannot erase an already committed receipt or make exact recovery depend on an active source. New creation from that deleted source remains refused. Readable URL resolution preserves only the authorized retained identity needed for this recovery. Deleting the destination retains its receipt with `available: false`, so an exact retry does not create a replacement Run. Normal private authorization still applies; public sharing uses its existing explicit field projection and does not expose the source manifest.

The manifest describes **the source result as observed when this retest was created**. The existing native execution row is still a mutable current projection. This increment does not implement the full T-428 logical-attempt model, T-424 correction journal or original-byte report custody. Those requirements remain at their existing owners.

## Actual independent architecture admission

The actual current author, independent Blue reviewer, independent Red reviewer and independent White adjudicator contributed separate records. Blue and Red first froze their own source reconstruction and discriminating scenarios, then reviewed the selected allocation. White checked the bounded participation, exact inputs and earlier finite gate.

**White admits allocation A and the destination-cycle retest receipt with explicit gates.** The former W-OWN “MORE ARCHAEOLOGY” block is closed at that allocation boundary. A retains `ai_generation_requests` as the sole task identity/namespace, with immutable kinds and owned prompt/analysis, assignment/attempt/report and proposal facts. It does not authorize external producers or another task/proposal application.

| Frozen input | Record |
|---|---|
| Current author decision and adopted clarifications | [Author allocation](author-allocation-20261120.md) |
| Blue first reconstruction and informed review | [Independent](blue-independent.md), [allocation delta](blue-allocation-delta.md) |
| Red first reconstruction and informed challenge | [Independent](red-independent.md), [allocation delta](red-allocation-delta.md) |
| White adjudication and exact retained gates | [Allocation decision](white-allocation-decision.md) |
| Receipt identity and source comparison | [Exact hashes](allocation-receipts.json), [source freshness](allocation-source-freshness.json) |

The admitted external design includes two consequential conditions. Legacy representation cannot bypass current applicable governance after cutover. Relevant new report/retest evidence must require a fresh affected decision even when proposal text and native-base hashes have not changed. Those are future implementation obligations, not claims that this native retest increment implements the external report/apply lifecycle.

The later [native request-disposition addendum](native-request-disposition-addendum.md) records a concrete recovery dead end found by the independent UI review. [White's separate bounded admission](white-native-request-disposition.md) justifies the terminal native command child; it preserves the original allocation receipt and external A decision unchanged. This is a necessary no-destination fact, not another Run/result/workflow owner.

Kind-safe consumers before external production, installation authority/fencing, complete-byte custody, effective guidance, exact selected apply, retained history, workload limits, actual UI and the authenticated own-driver I3-Q demonstration retain their named N/K/A/E/P/C/H/R gates. No feature flag or Skills assignment is activated here.

## Verification and review

Scenarios were announced before test authoring. Existing API/UI suites and migrated native-owner tests are extended; no parallel test project is introduced. Coverage includes independent new results, original evidence/Bugs, current definition pins, mixed-selection refusal, concurrent/repeated requests, interrupted responses, source/destination deletion, plan downgrade during a wait, current membership, machine-token denial and public-sharing privacy. Successful-path screenshots are captured from the actual CI browser, not from mocked product HTML.

The exact impacted Playwright selection is the full `api/cycles.spec.ts`, `api/executions.spec.ts`, `api/route-resolve.spec.ts`, `api/plans.spec.ts`, `api/billing.spec.ts`, `ui/billing.spec.ts`, `ui/cycles.spec.ts`, `ui/executions.spec.ts` and `ui/readable-urls.spec.ts`, with 10 workers and no retries. The initial pre-CI `--list` collected 256 selected tests out of 3,005 suite tests, including 16 native retest UI scenarios and eight configured successful-path screenshots. Later correction counts and exact-head runtime belong to the PR's current verification record. Collection does not execute those tests. The existing smoke workflow builds this candidate's backend/frontend and applies migrations to its disposable PostgreSQL service. Existing migrated Plan/Run and approval suites run in behavioral quality. The Plan/Billing files are included because the fresh transaction path extends the shared entitlement owner. Existing optional-provider skips remain visible in the run result; they are not counted as executed proof. The migrated HTTP plan matrix exercises the enabled billing policy with disposable fixtures and the real request cache. Other existing required checks are retained.

No local shared database, production application or user workstation deployment is used. Source-only/typecheck results and collected-but-unrun tests remain separately labelled. Independent implementation review findings and actual CI results must be reconciled before describing this increment as verified.

The actual [backend independent scenarios](native-backend-independent.md), [first backend review](native-backend-review.md), [targeted backend correction review](native-backend-fix-review.md), [terminal-request backend review](native-backend-terminal-review.md), [UI independent scenarios](native-ui-independent.md) and [first UI review](native-ui-review.md) and [informed UI correction review](native-ui-remediation-review.md) preserve reading order and exact source boundaries. The later backend delta explicitly corrects one supplemental dependency-hash timing statement; earlier bytes are retained. The terminal-request review passes source inspection, including real-database test definitions for create/cancel races and authority revoked during a lock wait; their actual runtime outcomes remain open. The informed UI review records the four original findings as source-corrected and identifies a further URL-hint storage failure. The separately frozen [storage-recovery delta](native-ui-storage-recovery-review.md) finds that failure corrected, including write failure and successful-write/readback-failure paths. No concrete source blocker remains in that review. Runtime evidence and authentic screenshot inspection remain separate gates. [Review hashes](implementation-review-receipts.json) establish receipt identity, not execution success.

The first CI pass also identified a prohibited route-library import and a secret-scanner false positive in a frozen review sentence. The [identity-composition correction](native-ui-identity-composition-review.md) passes the existing current user from the project layout, preserving the architecture rule. The [scanner-policy review](native-secret-exception-review.md) binds one exact non-credential match to the frozen report path and detector, checks its original file hash, and retains real-scanner positive/negative controls for nearby prose and credentials. Original evidence bytes remain unchanged. These source corrections require fresh corrected-head CI; earlier passing database jobs do not certify the later UI composition.

## Session distillation and rollback

The [runtime findings and bounded corrections](native-runtime-corrections.md) preserve the four actual red full-impact runs, the native focus defect, the exact-201 cancellation fixture correction, the coupled nullable Run-edit defect, concrete legacy fixture/selector repairs, inspected screenshot scope, and the unresolved enabled-billing CI prerequisite. All 32 native scenarios passed on the fourth run; two newly reached legacy selector errors still required correction. Two adjacent product defects remain recorded with their valid assertions intact, including a timing-sensitive prefetch case that passed in the fourth occurrence without a product fix. Earlier source-review passes do not supersede browser findings. Billing failures remain in the full selection; they are not converted into passing or skipped evidence. Exact corrected-head results belong to the PR's current verification record.

This implements an already specified native retest boundary. It extends existing baseline PD-03 scope/provenance and PD-10 result/approval/Bug truth; it introduces no new product-discovery candidate or second register. The independent review's cached-entitlement and deleted-source recovery findings are coupled defects on the selected journey. Their corrective mechanisms are fresh canonical admission and retained receipt recovery, with discriminating regression coverage. The original attempt/correction limitation remains explicit rather than being reclassified as complete.

Rollback can revert the application changes while retaining V158 and existing native Runs/receipts. V158 is additive and leaves old cycle rows null; do not edit or reverse applied migrations or delete committed retest history. An older application will not expose this lineage UI, but new Runs remain native Runs. Deployment, any retained-data deletion and broader external enablement keep their own authority and verification boundaries.
