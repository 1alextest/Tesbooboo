# Native retest backend — targeted fix review

Frozen: 2026-11-20 06:56:12 UTC. Repository: `/workspace/scratch/8e9074abd0d0/tesbo-qa-loop`. Base: `1fe100588be6c3a1627ee39a4b0bbc1c0d9da2ea`. This is a separate static delta review of NR-B01, NR-B02 and NR-T01. It preserves the original independent scenarios and first review rather than rewriting their historical conclusions.

## Scoped verdict

**The three named findings are addressed by the inspected source and discriminating test additions. No remaining concrete backend blocker was found in this correction delta.** Proceed to the authorized isolated impacted CI gates. This is not a claim that the database or application tests have passed, that the feature is runtime-accepted, or that a formal architecture quorum occurred.

I independently recomputed all **30** file hashes and byte counts in `native-candidate-before-ci.json`; all matched. Its SHA-256 is `8d5534776300648d1b13e12a1854e6a2d273bb53ee6cc067a3efe3ed8920e641`. Hashing the entire manifest establishes candidate freshness only; this review did not inspect or certify frontend behavior, workflow execution, or unrelated documentation.

The original artifacts remain unchanged:

- `native-backend-independent.md`: `ecd934dd84c675e8da06625b08fa6a539a6d691ec5290b36d633f4703c682452`.
- `native-backend-review.md`: `c19f0e1d26241c63d0591e7976029ee4fac031501712a0224adbdb023c60f065`.

## Evidence timing clarification

The first report's supplemental PlanLimitsService hash, `364ab23fd1d9f19fbc70c593aadb0510b6c0c9fe85f3702b4bf8ac75dd471b7c`, was collected after the accepted canonical-owner correction had begun. It already identifies the optional transaction-aware helper reviewed below. The baseline/original PlanLimitsService hash is `c4404a3c9e0f690958f045fbeaf611f84be224a037a0a7e4e09feb21e308e547`.

The first finding remains valid against its frozen native service hash: that caller still used the ordinary two-argument cached path, whose behavior the helper correction preserves. The supplemental hash must not be treated as proof that the first review had already assessed the optional transaction path. This clarification records the source-read/hash timing honestly while leaving the original frozen artifacts intact.

## NR-B01: fresh canonical plan authority

**Disposition: addressed in source; runtime proof remains due.**

`createNativeRetest` now calls `assertProjectWritable(organizationId, projectId, client)` after `nativeRetestBasis` has acquired source, testcase, item, execution, evidence and Bug/link locks and validated the reviewed digest (`legacy.service.ts:7232–7241`). The existing current-project authority rows are already held through the transaction. The native command cannot use a transport guard's earlier Pro snapshot for this final admission check.

`PlanLimitsService.assertProjectWritable` accepts the optional transaction client (`plan-limits.service.ts:287`). That branch bypasses both RequestCacheService and Redis, reads organization entitlement columns with `FOR SHARE` on the same client (`146–153`), and computes project rank using that client as well. A billing update that committed before this lock is observed; one attempting to change the policy row after the SHARE lock waits for the retest transaction to finish. The read is a simple organization-row lock, followed by a separate project-ranking statement, so it does not depend on a stale pre-wait join snapshot.

The effective-plan logic now has one evaluator, `entitlementFromRow` (`113–123`). It preserves the existing rules: only stored `pro` yields Pro; Launch with a future grace deadline uses Pro limits; a lapsed admin override yields Launch with no extra grace. The ordinary no-client path still uses the existing caches, performs lazy override retirement, and sends the existing one-time lock notice. The transaction path performs neither retirement nor notification through another connection while holding the organization lock. That avoids the self-deadlock mechanism highlighted in the requested fix.

I traced the existing billing policy writer and the Run creation/audit path: billing changes update the organization row; the retest's remaining native creation and activity insert do not call a second-connection organization updater. The existing cycle-number advisory lock still serializes new Run numbering, and the receipt remains inside the same native transaction. I found no new concrete lock-order cycle from this correction. This is not a general assertion that all pre-existing multi-row lock patterns in the application are deadlock-free.

### Regression discriminator

The new `plan-project-lineage.db.spec.ts:917` test runs the actual HTTP middleware, RequestCacheService, route guard, PlanLimitsService and business SQL. It verifies both request-cache enablement and a cached Pro entitlement, holds the source Run on another connection, polls `pg_stat_activity` until the real request waits, commits a Launch/no-grace policy change from another connection, then releases the source lock. It requires 403, unchanged independently queried business state, no request-key cycle and no file write. The earlier two-argument cached caller would return success and create a Run, so this test targets the observed mechanism rather than merely agreeing with the new helper's shape.

Existing real HTTP positive tests still exercise an unlocked Pro retest, and surrounding gates cover ordinary grace/within-allowance/billing-disabled behavior and expired-override retirement. The new transaction branch does not yet have its own explicit expiry-during-wait or organization-writer-blocks-until-commit regression. Those are finite proof limits, not evidence that the inspected shared evaluator or lock is incorrect. No additional local runtime work is requested by this review.

## NR-B02: recovery after source soft deletion

**Disposition: addressed in source; runtime proof remains due.**

The new `NATIVE_RETEST_SOURCE_IDENTITY_SQL` (`legacy.service.ts:7177`) admits an active source or a retained source with an actual same-project retest receipt. `requireNativeRetestSourceAccess` validates UUID syntax and normal project/workspace access before returning its identity. It does not return the deleted source's results to the caller.

`readNativeRetestRequest` now locks the retained source, rechecks current project/workspace/user authority on the transaction client, and reads only the exact project/source/request receipt (`7195–7208`). It remains a read operation with no billing write gate.

Creation/replay locks the source regardless of soft-delete state, rechecks current authority, and reads the prior request before the active-source refusal (`7211–7231`). The exact stored request digest still binds the original actor, source, normalized selection, preview and creation input. Exact replay returns the durable original receipt; changed reuse conflicts; a new key against a deleted source reaches the explicit 404 before creation. No new receipt store or source-history resurrection is introduced.

The controller uses the scoped `PlanRunWrite("retest")` target. Its deleted-source branch skips billing only because the native service permits receipt replay and refuses every new creation from that source. The current native human principal and membership checks still execute. Active-source writes retain the established guard; GET recovery remains available after a later downgrade.

The readable resolver applies the same retained-identity predicate to UUID and Run-number lookup (`resolveRoute`, `4120–4128`). Existing project authorization scopes every lookup. It returns only the usual project and cycle identity fields, allowing the recovery page to mount. An ordinary deleted source without a retained receipt is still unresolved, and normal deleted Run detail, preview and execution access retain their active-only checks. Public-share projections and manifest schema did not change.

### Regression discriminators

- `e2e/api/cycles.spec.ts:1608` creates a retest without consuming the original receipt, soft-deletes the source, recovers by the retained key, and exactly replays it. It checks changed-payload 409, new-key 404, anonymous/foreign refusal without destination disclosure, and one surviving destination in project Run listing. The previous active-source-first access would fail at the recovery assertion.
- `e2e/api/route-resolve.spec.ts:172` checks both source UUID and readable reference after deletion, exact identity-only output, unchanged detail/preview/new-create refusal, receipt readback, and foreign/anonymous/wrong-project exclusion. The existing no-receipt deleted-Run test now checks both UUID and readable reference remain 404.

These are real requested API outcomes, not a test of the helper's SQL string. Membership revocation while a recovery request is waiting is not newly exercised by these API additions; the inspected transaction-bound current-authority helper is the same owner that enforces that condition in creation.

## NR-T01: boundaries and meaningful multi-selection

**Disposition: test-source defect corrected; pure-test execution is reported by the coordinating agent, and application execution remains due.**

`native-retest.spec.ts` now generates 101 distinct valid UUIDs, accepts the first 100, and rejects all 101. Removing the maximum-size predicate would make the rejection fail; duplicate rejection can no longer produce a false green for this boundary.

The API concurrent replay scenario now creates two real approved cases in the same Run and sends the same key with opposite selection order (`e2e/api/cycles.spec.ts:1515`). It requires one destination, two fresh executions, exact per-source testcase/item/execution mapping, Untested status, zero inherited evidence, and the reviewed approval revision. It independently compares the original execution response after creation. This verifies the semantic set normalization in the actual transport/creation path.

The scenario then invalidates one selected case, fetches a fresh preview proving exactly one eligible and one ineligible member, and submits that fresh digest under a new key. It requires `TESTCASE_APPROVAL_REQUIRED`, no additional retest and no committed request receipt. This distinguishes whole-selection approval refusal from merely rejecting an old digest. The server cap's valid 100 boundary is covered by the pure test; a real 100-case application creation is still not claimed.

## Exact delta hashes

Paths are relative to the repository. The same values appear in the verified candidate manifest.

| File | SHA-256 |
|---|---|
| `Tesbo-Backend-Nest/src/plan-limits/plan-limits.service.ts` | `364ab23fd1d9f19fbc70c593aadb0510b6c0c9fe85f3702b4bf8ac75dd471b7c` |
| `Tesbo-Backend-Nest/src/legacy/legacy.service.ts` | `e75bc9adc36e67541706f9a3de2224af1e48b6ea2155ef39e221ea00b6db387d` |
| `Tesbo-Backend-Nest/src/legacy/legacy.controller.ts` | `6511370ec4e3d9ac1c531a53a39bdb01516017f308c784cf71c1cea2c93031de` |
| `Tesbo-Backend-Nest/src/legacy/native-retest.spec.ts` | `a33603438298c4b143e4ee4e4d6d3bd033fd712f2bde927b8b52d93ac284fe43` |
| `Tesbo-Backend-Nest/src/legacy/plan-project-lineage.db.spec.ts` | `d4491ef8c1e4aa702a3bea655fef2e2f22804cd7920aca3a221bafd333927d35` |
| `e2e/api/cycles.spec.ts` | `2f2949f095f70901cb4bd280fcc9942296ee8e826390752bf851b6fd960979d1` |
| `e2e/api/route-resolve.spec.ts` | `a612944afcbdb3e7fb9ce9458d390a725ef3450c8a32335239fb8ee965159286` |

Unchanged retest owners: V158 remains `2eb41fa3a816ff488fee3d1ed2828b7df133319b1cb46e53b3dd3fcd8b47dea9`; `native-retest.ts` remains `606721565ff07ff18ac67e66b3265a947263c115a30ae962f4d3d4712baf5f3e`; `approved-run-cases.db.spec.ts` remains `9510238291d718259a530db164dd00cfd46c2657eeb4d19a45d8e48ecc13ee40`.

Additional unchanged dependency traces in this delta: `billing/billing.service.ts` is `2b19a38c3c9e6303956f32bc4dbb01e543f6060120aa349aad99d93db1f6a38d`; `cache/entitlement-cache.service.ts` is `bbd5f6a2bf70f441cfaf7930e5813ca67696d554174bfd0a00e74b05e2cd7296`.

## Checks performed and remaining acceptance boundary

Performed here: read-only targeted source/test inspection, actual surrounding-owner tracing, all 30 manifest hash/size comparisons, original-report hash confirmation, and scoped `git diff --check` with successful exit. No product/test edits, database queries, backend/app starts, DB tests or E2E runs were performed by this reviewer.

The coordinating agent reported backend/e2e typechecks and three pure tests passing; this reviewer did not independently rerun them or treat them as database proof. Actual isolated CI remains responsible for migrations, PostgreSQL concurrency/rollback/immutability, authenticated API/browser outcomes, and the affected billing/plan gates. Any subsequent source change or observed failure needs evidence against that exact new revision. The first report's other bounded proof limits remain in force.
