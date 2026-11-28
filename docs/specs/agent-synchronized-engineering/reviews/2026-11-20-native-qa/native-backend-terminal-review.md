# Native retest terminal requests — informed backend delta review

Frozen review: 2026-11-20 07:12:37 UTC. Repository: `/workspace/scratch/8e9074abd0d0/tesbo-qa-loop`; base commit `1fe100588be6c3a1627ee39a4b0bbc1c0d9da2ea`. The coordinating agent explicitly confirmed the final backend/test freeze before these hashes were captured. Frontend remained in progress and is not certified by this report.

## Scoped conclusion

**Source review passes with the existing isolated runtime gates still open. No concrete remaining backend blocker was found in this terminal-request delta.**

The new child relation gives an unresolved native command a durable created-or-cancelled answer without inventing a Run for cancellation. The implementation preserves the destination Run's immutable creation manifest, binds a successful terminal fact to that exact manifest, serializes create/cancel/readback on the same request identity, and rechecks current authority after waiting. Cancellation is possible when the original preview is stale, its case is no longer Approved, its source is soft-deleted, or the project is billing-locked. It does not undo a committed creation.

This is an informed implementation review against the admitted correction, not a newly independent preimplementation allocation review, a formal architecture quorum, or a runtime certification. No database/app/backend/E2E execution was performed here. The admitted contract's authentic browser and real PostgreSQL proof remains due in authorized isolated CI.

## Contract and preserved earlier evidence

Before inspecting this correction, I read and verified:

| Input | SHA-256 |
|---|---|
| `native-request-disposition-addendum.md` | `c83f702e5e6b1847e1b682318fb1a5657f6acfc4069fc8663da8a9455e8528ae` |
| `white-native-request-disposition.md` | `c6bd03d794017ce713b0a1ff7c64ccf1aa29533a0a53925b841c5e8ade580f0d` |

The original independent scenarios still govern source preservation, current approval/authority, atomic fresh Run creation, replay and privacy. The admitted correction adds the terminal noncommit fact needed when a lost-before-arrival command becomes stale and absence cannot fence a delayed POST.

Earlier records were rehashed and remain byte-identical:

- `native-backend-independent.md`: `ecd934dd84c675e8da06625b08fa6a539a6d691ec5290b36d633f4703c682452`.
- `native-backend-review.md`: `c19f0e1d26241c63d0591e7976029ee4fac031501712a0224adbdb023c60f065`.
- `native-backend-fix-review.md`: `b084c144d6ba7f150c692b6065132cfd45e94309871c4182164044ec7f9e1b78`.

Those records retain their historical scope and limitations. In particular, the prior fix review's dependency-hash timing clarification is not erased or reinterpreted.

## Relational guarantees inspected

V158 retains the destination `cycles.retest_manifest` and adds `cycle_retest_requests` as a terminal command child. I checked the relationship in both directions, including the default nullable behavior of the composite FK for ordinary non-retest cycles.

| Required property | Implementation and consequence |
|---|---|
| One terminal fact for one project/request identity | Primary key `(project_id, request_key)` owns uniqueness. Outcome is restricted to `created` or `cancelled`; there is no queued/running/attempt state. |
| Zero or one real destination | Shape CHECK requires a non-source destination for `created` and no destination for `cancelled`. Unique `(project_id,destination_cycle_id)` prevents multiple created commands claiming the same Run while allowing multiple cancelled requests with NULL destinations. |
| Same-project identity | Source and destination FKs reference existing `cycles(project_id,id)`. The project's own FK is RESTRICT. No cross-project destination or orphan source is admitted by these relational paths. |
| Every sealed Run receipt has the matching terminal fact | `cycles_retest_request_binding_fk` pins project, request key, source, request digest and actual destination ID to the corresponding unique terminal tuple. It is deferred so the existing Run writer can bind the receipt before inserting its terminal child in the same transaction. A cancelled row has no destination and cannot satisfy that FK for a sealed Run. Ordinary cycles have null retest fields and retain their existing behavior. |
| Every created terminal fact matches a real sealed receipt | The deferred `native_retest_created_request_binding` trigger checks the destination's project/source/key/digest, manifest `createdBy`, and `principalKind='human_session'`. It cannot label an ordinary destination or a different actor's manifest as this request's success. |
| Terminal outcome cannot be rewritten/reused by an ordinary writer | BEFORE UPDATE OR DELETE on `cycle_retest_requests` rejects mutation. The destination manifest already has its existing immutability guard and completeness/hash CHECK. Thus the two stored facts cannot independently drift after commit. |
| Historical retention through supported lifecycle operations | Native Run deletion remains soft deletion. It changes neither child outcome nor receipt identity; same-project RESTRICT FKs also block simple hard deletion of referenced source/destination rows. `requested_by` is an immutable historical UUID, deliberately without a new live-user deletion policy. This is not a claim of non-erasure against privileged TRUNCATE/schema maintenance. |

The circular created relationship is coherent: the new Run is inserted, its manifest is bound, the created terminal row is inserted, and both deferred directions are checked at commit. `DatabaseService.transaction` resolves the command only after COMMIT succeeds. A deferred constraint failure therefore cannot be returned as a successful committed receipt by this service.

## Command owner, exact binding and race order

The new `lockNativeRetestRequest` (`legacy.service.ts:7202`) takes the same per-project/request advisory lock for create, cancel and readback. It then locks the source Run and invokes the existing transaction-bound current project/workspace/user authority helper before reading the terminal row. Creation takes the source FOR UPDATE; cancellation/readback take FOR SHARE. The source read deliberately includes soft-deleted rows for recovery.

`assertNativeRetestRequestBinding` verifies source and requesting human for every existing terminal result, and also verifies the normalized request digest for create/cancel. The digest uses the unchanged `retestCreateInput` normalization and binds source, actor, key, exact selected occurrence set, reviewed preview and supported target settings. URL/body request-key mismatch is explicitly refused. A same-key change of actor, source or payload cannot take over an existing outcome.

The terminal decision is checked before fresh-create effects:

- **Create commits first:** it inserts the real Run/items/executions/manifest, terminal created row and mandatory activity audit on one client. A later exact cancel reconciles to the created receipt; it never changes that outcome to cancelled or deletes the destination.
- **Cancel commits first:** it inserts only the terminal cancelled fact and its mandatory audit. Later exact create returns `RETEST_REQUEST_CANCELLED` with the retained disposition before any Run creation. A differently bound reuse conflicts.
- **No terminal fact yet:** readback returns a nonterminal 404. Explicit cancellation, rather than that absence or a timeout, supplies the durable fence needed before a fresh key can be used safely.
- **Mandatory audit fails:** the native transaction rolls back its terminal insert along with any creation effects. An unsuccessful cancellation cannot silently consume the request identity.

No cancellation precondition requires a still-current approval, unchanged source observation, active source, or prior destination. Validating the saved input's original syntactic shape is retained, while current eligibility is checked only for fresh creation. This directly addresses the dead-end mechanism described in the admitted addendum.

## Current authorization, billing and privacy

The controller passes trusted transport principal identity for create, readback and cancellation; all three require a native human principal. The existing global API-token guard still excludes these non-project-prefixed Run routes. User IDs from a body are not used as authority.

`requireNativeRetestSourceAccess(..., true)` permits authorized cancellation/readback using a retained soft-deleted source even before any terminal request exists. Project/workspace access is checked before the operation and current membership/active workspace is checked again inside the transaction after request/source waits. Fresh creation retains its active-source requirement after exact prior-outcome handling.

The new `PlanRunWrite("retestRecovery")` path performs access checking without a billing write prohibition. It can create only the requested terminal cancellation/audit or reconcile to an existing created receipt. For the ordinary create route, an existing immutable terminal key allows the native owner to return/refuse the already-final outcome without requiring renewed billing entitlement. The owner still verifies source/actor/digest under the shared lock. A genuinely new request retains both the ordinary guard and the fresh same-client PlanLimitsService admission check from NR-B01.

The retained-identity resolver now keys off terminal requests, covering both created and cancelled outcomes. It still returns only the existing authorized project/Run identity fields. A deleted source with no terminal remains unresolved through ordinary route resolution; cancellation can use its retained UUID without exposing deleted Run contents. Normal deleted Run detail/preview/new-create access remains refused. The public Run and execution share allowlists are unchanged. No cancelled placeholder Run appears in ordinary Run lists or reports.

## Discriminating test-source review

### Real PostgreSQL ordering and current authority

`approved-run-cases.db.spec.ts` now forces both create-wins and cancel-wins. A separate connection holds the source Run, the chosen winner is observed waiting there after acquiring the request lock, and the loser is observed waiting on the advisory lock. Releasing the source establishes the intended order without a guessed delay. Assertions independently check one terminal row, exact Run count, source-result preservation and the outcome returned/refused by the loser. These tests would expose separate locks, missing terminal checks, or cancellation relabeling success.

The final parameterized regression at line 511 covers **create, cancel and readback** after membership is revoked during the actual source-owner wait. It establishes membership first; the readback variant seeds a real created receipt. A separate revoker connection deletes membership only after `pg_stat_activity` confirms the request is blocked. After release, each variant requires 403 and exact equality of independently queried cycles, terminal requests, audit and original source-result rows. If authority were checked only before the wait, the test would either fail to revoke due to the held membership lock or observe a forbidden successful operation. It therefore distinguishes the named after-wait condition from a simple before-call rejection.

The existing `requireProjectAccess` fixture stub remains explicit: these tests isolate the actual transaction-bound authority check and database behavior; they do not independently prove cookie or HTTP middleware admission. Genuine HTTP authorization is exercised in the other existing harness and API cases.

### Atomicity and cross-fact integrity

The DB tests inject mandatory cancellation-audit failure, verify no terminal row/Run survives, verify readback remains absent, and then allow the original request to create successfully. Separate SQL refusal tests attempt to update/delete cancelled rows, invent a created terminal fact for an ordinary Run, and bind a destination receipt to a cancelled request. The latter requires the named composite FK failure and verifies the ordinary row remained unmodified. Exact repeated cancellation/readback, actor/source/payload conflict, and cancellation after source deletion without prior creation or current approval are also checked.

The initial create-audit rollback scenario remains in place; its now-common transaction includes the created terminal child as well. All of these tests are source-reviewed, not locally executed by this reviewer.

### Actual HTTP recovery and billing behavior

`plan-project-lineage.db.spec.ts` includes terminal rows in independent business-state comparison. It checks cancellation/readback while billing is locked, no Run/evidence writes, exact replay refusal after cancellation, machine-token exclusion, and no-op created replay after a later downgrade while a new key remains blocked. The previous real cached-Pro/source-wait/downgrade regression is retained.

`e2e/api/cycles.spec.ts:1645` models the missing workflow: save an unsent request, change the source, refuse the stale retry, observe nonterminal absence, explicitly cancel, ignore its response body, recover cancellation by key, refuse the delayed original POST, and successfully create one fresh reviewed Run under a new key. The first cancellation remains retrievable afterward. Anonymous/foreign coverage includes the cancel endpoint. The existing successful multi-case flow also checks cancel reconciles to its already-created receipt.

`e2e/api/route-resolve.spec.ts` parameterizes created and cancelled retention. For the cancelled case it deletes the source before any terminal record, confirms ordinary resolver absence, explicitly cancels by source UUID, then verifies both UUID/readable identity and receipt recovery. Ordinary content/new-create refusal and foreign/anonymous exclusion remain asserted.

The observed test additions address the named terminal-recovery risks; no further optional test expansion is requested by this review. Authentic browser completion remains owned by the independent UI work and isolated runtime selection.

## Final backend/test hash boundary

All paths are relative to the repository. These values were recomputed after the coordinating agent's backend/test freeze.

| File | SHA-256 |
|---|---|
| `Tesbo-Backend-Nest/migrations/V158_native_run_retest.sql` | `2c37a5ba9c3cc918f47d2ebdb3c00cb1588cae48032f462ff6ce462c31c42601` |
| `Tesbo-Backend-Nest/src/legacy/legacy.service.ts` | `732b79be810df5b46e5cbdaa7504bd1cb98e33a325382a42172418626dfd2617` |
| `Tesbo-Backend-Nest/src/legacy/legacy.controller.ts` | `40303d47ddb2e7d8a3c5ca2408f78003f361d8a9155c89381d17bb57728b94bc` |
| `Tesbo-Backend-Nest/src/legacy/native-retest.ts` | `606721565ff07ff18ac67e66b3265a947263c115a30ae962f4d3d4712baf5f3e` |
| `Tesbo-Backend-Nest/src/legacy/native-retest.spec.ts` | `a33603438298c4b143e4ee4e4d6d3bd033fd712f2bde927b8b52d93ac284fe43` |
| `Tesbo-Backend-Nest/src/legacy/approved-run-cases.db.spec.ts` | `19f30645e50c01a6b8af169ff699ffc0f94c023e83e1ddccdd030fc6a09787c4` |
| `Tesbo-Backend-Nest/src/legacy/plan-project-lineage.db.spec.ts` | `a1363cb2d9f14a2163d32cbbf43cb970ff010c6e1f5eab65f21788285963a842` |
| `Tesbo-Backend-Nest/src/plan-limits/plan-limits.service.ts` | `364ab23fd1d9f19fbc70c593aadb0510b6c0c9fe85f3702b4bf8ac75dd471b7c` |
| `e2e/api/cycles.spec.ts` | `b049bac126fe951c5d809a2f451955277624409283622490100d6fc303d2f83c` |
| `e2e/api/route-resolve.spec.ts` | `5b9bef7657621e60af8c2cf101002eabace46bdf8f9fa13e69f9c6cd0c6185a4` |

## Checks performed and remaining proof

Performed by this reviewer: read-only source/test inspection, admitted-contract and earlier-record hash verification, final backend/test hashing, and scoped `git diff --check` with successful exit. No product/tests were edited. The coordinating agent reports typecheck/diff checks passing; no runtime result is inferred from that report.

Still required at the exact CI revision: apply the final migration, execute the real relational/HTTP concurrency and rollback gates, and run the authorized impacted API/UI/billing/plan selection. The deferred relational constraints and lock behavior require actual PostgreSQL evidence; the user-visible recovery workflow requires actual application/browser evidence. No local database or application was started or queried here. This delta closes no full immutable execution-attempt/correction journal, external executor loop, or deployment/release gate.
