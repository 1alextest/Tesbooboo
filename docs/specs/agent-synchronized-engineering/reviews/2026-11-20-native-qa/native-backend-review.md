# Native retest backend — independent static review

Review freeze: 2026-11-20 06:48:49 UTC. Repository: `/workspace/scratch/8e9074abd0d0/tesbo-qa-loop`. Baseline HEAD: `1fe100588be6c3a1627ee39a4b0bbc1c0d9da2ea`. Candidate was uncommitted and backend-frozen when inspected. Frontend was deliberately excluded. Later fixes require a separate delta; this document does not silently certify them.

## Scoped conclusion

**Changes required for two concrete coupled defects: stale plan authority after a serialization wait, and loss of exact committed-request recovery after source Run soft deletion.** Both were reported promptly and accepted by the coordinating agent as coupled scope. No third product blocker was established.

The core implementation follows the bounded native new-Run allocation: it extends the existing cycle owner with a creation receipt, reuses exact Approved case admission and ordinary native executions, retains old observations, creates fresh manual Untested work, and leaves the public-share allowlist intact. This is source evidence, not runtime proof. The review did not run a database, backend, application, or E2E test; it grants neither release acceptance nor a formal architecture quorum and does not close a full immutable attempt/correction journal.

## Independence and method

Before opening candidate implementation or tests, I read the repository instructions and inspected the separate baseline owners. I froze 16 independent scenarios/invariants in `native-backend-independent.md`, SHA-256 `ecd934dd84c675e8da06625b08fa6a539a6d691ec5290b36d633f4703c682452`. The frozen scenarios were then applied to the candidate, rather than derived from its tests.

Reviewed candidate: V158; `native-retest.ts` and its pure-test source; the four controller routes; all native retest service methods; changed relational tests in `approved-run-cases.db.spec.ts` and `plan-project-lineage.db.spec.ts`; and the new API scenarios in `e2e/api/cycles.spec.ts`.

Traced actual surrounding owners: current project/workspace membership, AuthMiddleware and API-token exclusion, PlanRunWrite guard, request and entitlement cache behavior, canonical case approval snapshots and dependency triggers, existing Run creation/item insertion, manual and bulk result writing, administrative assignee cleanup, history import/snapshot refresh, automated result/evidence/finalization, native evidence upload, Bug target/link/unlink/delete writers, source/item soft deletion, Run reads/CSV/reports, and narrow public sharing. These traces were read-only. `git diff --check` on the changed tracked backend/API files exited successfully; that establishes whitespace cleanliness only.

## Confirmed findings

### NR-B01 — P2: transaction-time plan check reuses pre-wait entitlement

**Scope:** coupled correctness on the new creation path. **Invariants:** I03, I10.

**Mechanism and anchors.** `legacy.controller.ts:761` applies `@PlanRunWrite("cycle")`. The guard calls `assertPlanRunRestWritable` (`legacy.service.ts:6614`), which checks `PlanLimitsService.assertProjectWritable`. `PlanLimitsService.getEntitlement` (`plan-limits.service.ts:88`) remembers the first entitlement in RequestCacheService, and `loadEntitlement` also consults Redis. Native creation then waits on its request advisory lock and/or the source Run row (`legacy.service.ts:7186–7187`) and calls the same ordinary `assertProjectWritable` at line 7197. This reuses the original request's entitlement. The fresh membership helper locks project, project membership, workspace membership and user, but no organization entitlement row. RequestCacheService invalidation (`request-cache.service.ts:55`) operates on the current AsyncLocalStorage request only.

**Discriminating execution.** A native POST passes the route guard while its workspace is Pro, then waits on a source Run lock. Another request downgrades to Launch without an applicable grace period and invalidates its own request/Redis entitlement caches. The source project is beyond the two-project allowance. Release the source lock. The retest's second policy call still returns its remembered Pro entitlement and creates new work after the project became read-only. The issue is not an assertion that every global cache must be eliminated: this newly consequential delayed operation specifically claims a current authority recheck that its chosen API does not provide.

**Impact.** A request admitted earlier can create a new Run in a currently locked project. No source-record corruption is needed for the defect.

**Required correction and test.** Extend the canonical plan owner with an explicit fresh, transaction-aware check after serialization, bypassing the two caches for this path and holding the relevant organization policy row through the write. Reuse the canonical effective-plan/grace/override evaluator. An expired admin override must not self-deadlock by lazily updating the same row through a second connection. Test the real middleware/request-cache/plan service with separate connections and a verified lock wait; downgrade while the request is waiting, then assert 403 and no Run/items/receipt/audit. Keep positive controls for a still-writable project, grace, and billing-disabled behavior. Existing plan tests cover already-locked requests and post-commit readback, not this interleaving.

### NR-B02 — P2: deleting the source hides an already committed receipt

**Scope:** coupled recovery correctness. **Invariants:** I09, I11, I12.

**Mechanism and anchors.** `readNativeRetestRequest` begins with `requireCycleAccess` (`legacy.service.ts:7166–7174`). That shared helper filters source `cycles.deleted_at IS NULL` (`7312–7327`). Creation/replay also calls it before the transaction and then requires an active source row (`7181`, `7187`) before reading the existing request receipt (`7190–7195`). The receipt itself lives durably on the destination and is not deleted by ordinary source soft deletion.

**Discriminating execution.** Commit a retest, lose its HTTP response, then soft-delete the source through ordinary native Run deletion. The destination and immutable manifest still exist. The exact GET recovery and same-key POST replay both return source-not-found instead of the committed result. This creates a false ambiguity for the recovery mechanism precisely when the caller does not know the new Run ID. Destination soft deletion already has the intended `available:false` behavior and is tested; source soft deletion is the missing sibling.

**Required correction and test.** Resolve retained source/project identity for receipt recovery, enforce current read authority, and return the prior exact receipt before refusing new creation from an inactive source. Keep ordinary deleted-Run detail and execution reads hidden. Add a committed-but-response-lost → source soft-delete → exact readback/replay regression, plus changed-key/new-request refusal and foreign/removed-member controls. Do not create a second receipt store to repair this.

## Validation gap with a concrete false-green mechanism

### NR-T01 — P2 validation gap: over-limit test is also a duplicate-ID test

`native-retest.spec.ts` uses `Array(101).fill(first)` as its oversized selection. Removing the maximum-size condition from the product would leave that assertion green because duplicate IDs are independently rejected. All valid native DB/API creation scenarios inspected select one execution, so they do not independently establish valid multi-selection mapping or the maximum supported selection.

The current product validator visibly implements the 100 cap; this is **not** a claim that its present code accepts 101. Use 100 distinct syntactically valid UUIDs for the accepted boundary and 101 distinct UUIDs for the refused boundary. A real multi-case creation should independently compare each source→destination mapping and prove that one ineligible member rejects the whole selection without a Run. This gap was sent to the coordinating agent before report freeze.

## Positive controls and source-supported properties

| Boundary | Evidence and practical meaning |
|---|---|
| Exact occurrence selection | `retestExecutionIds` requires an actual array, 1–100 syntactically valid UUID strings, case-normalizes them, rejects duplicates after normalization, and sorts the set. `nativeRetestBasis` resolves execution→item within the one source Run and requires exact cardinality. No malformed or foreign occurrence is silently dropped into a partial retest. |
| Human and tenant authority | Create accepts a trusted `ReviewPrincipal` only; the controller derives it from transport auth. Invalid bearer auth does not inherit a browser cookie, and existing global token guarding denies the non-project-prefixed Run aliases. Preview/create recheck current project/workspace membership and active workspace through a transaction-bound helper after the source lock. The selected case query is also project scoped. |
| Current exact approved definitions | The path uses canonical `TESTCASE_APPROVAL_CURRENT_SQL` and PostgreSQL `testcase_approval_snapshot`, including exact human receipt and semantic revision. Creation locks case rows, then rereads in a separate statement; dependency triggers serialize semantic custom-field/tag changes through those case rows. It then calls the existing approved native item writer and checks the inserted destination revision against the reviewed one. |
| Source-result freshness | The source Run is held `FOR UPDATE` during creation. Ordinary result/bulk/import/evidence/automation writers lock that same parent. Explicit source item and execution SHARE locks plus a fresh source read also fence direct occurrence edits and administrative assignee changes that do not take the parent. The source preview digest is recomputed from captured observations at creation; a stale preview conflicts. |
| Bug link freshness | The basis locks relevant Bug owners before the fresh active-link read. Supported additions/rebindings lock target Runs before Bugs; unlink/deletion uses the Bug owner. The fresh post-owner-lock link read avoids preserving a stale pre-wait association. The DB test uses a verified wait while unlink commits. No Bug status or link mutation is performed by retest. |
| Atomic effects and rollback | `DatabaseService.transaction` owns one client for destination cycle, items, executions, receipt UPDATE and mandatory activity audit. The reused creator accepts the same client. A count/revision mismatch or failed mandatory audit throws before commit; no external storage copy occurs. The DB test injects audit failure after creation and checks no request/cycle survives. |
| Fresh ordinary work | Destination uses normal native `createCycle`/item/execution insertion. Existing defaults produce `source='manual'`, `status='Planning'`, executions `Untested`, fresh IDs, no prior outcome/evidence/defect/history copied as new result. Automated closed source is read-only and need not be reopened. API test records a new Passed result while comparing the original execution response and downloaded evidence bytes. |
| Request idempotency | Per-project/request-key advisory serialization precedes a fresh prior-receipt read, and a unique index independently prevents duplicate committed keys. Digest binds source, actor, normalized selected IDs, reviewed preview and supported creation settings. Changed reuse conflicts. Prior success returns before revalidating mutable source observations/case content. Same-key failed transactions do not consume durable success identity. NR-B02 is the lifecycle exception. |
| Immutable receipt and lifecycle | V158 prevents changes to sealed project/source/request/digest/manifest fields while allowing ordinary Run metadata edits and soft deletion. Its CHECK requires a complete receipt and a database-computed JSONB digest. The same-project source FK is RESTRICT; V111's item/execution restrictions also prevent simple hard deletion of populated Runs. This is ordinary lifecycle protection, not a claim of a general non-erasable audit store against privileged destructive database maintenance. |
| Canonical hashing | JS canonicalization recursively orders object keys and the selection is canonicalized first. Preview values normalize Dates to their wire representation before hashing. Both preview comparisons use the same JS representation; approval hashes are owned entirely by PostgreSQL; manifest seal/hash is computed and checked entirely by PostgreSQL JSONB text. No erroneous assumption that JS JSON serialization equals PostgreSQL JSONB text is needed. |
| Public privacy and ordinary readers | The public Run projection remains its fixed eight fields and public execution projection its fixed six fields. No retest manifest, source result, Bug IDs, evidence metadata or actor IDs are added there. Authenticated Run detail/list can return the stored internal receipt. CSV names existing headers rather than iterating new fields; reports count normal new executions. The new Run is not misrepresented as Model Studio provenance. |

## Test quality assessment and finite missing proof

The relational additions are meaningfully stronger than query-shape mocks: they query stored results independently, compare source rows before/after, use actual PostgreSQL transactions, and poll `pg_stat_activity` for a real lock wait before releasing a blocker. They test identical concurrent creation, stale result/definition rejection, a delayed definition demotion, delayed source result writing, delayed Bug unlink, immutable receipt updates, atomic rollback, and destination item removal/re-addition. Their `requireProjectAccess` stub and no-op entitlement collaborator are explicit fixture limits; they cannot establish the HTTP authorization or billing claim. The other DB suite uses real middleware, plan service, guards, request-scoped cache and migrated SQL with explicit Redis/email collaborators, which is the appropriate location for NR-B01's regression.

API test source covers usable fresh manual work, preservation of source result and exact evidence bytes, a captured Bug link, same-key concurrency/readback/conflict, stale source/approved-definition changes, destination soft deletion, malformed/wrong-Run selection, anonymous/foreign rejection, public receipt privacy, and the negative Model Studio provenance control. The first preservation test does not independently reread the complete Bug row/link after creation; it captures the link in the manifest, while code inspection establishes absence of a Bug writer in this operation. This is a finite coverage limitation, not evidence of corruption.

No test in this review has been executed. Additional meaningful boundary coverage, if not already supplied elsewhere in the impacted CI selection, includes: valid two-case and 100-case creation; a selected soft-deleted item/execution; stale semantic custom-field/tag changes; evidence addition after preview; membership/workspace removal while waiting; source-deleted recovery; direct FK hard-delete refusals; and committed receipt retrieval after later source/case content changes. These should be selected to prove the named claims, not expanded into a full system test project. The two confirmed bugs and NR-T01 are the specific review actions; the rest are clearly stated evidence gaps for CI planning.

## Deliberately not promoted to blockers

- The destination Run and executions remain ordinarily mutable after creation; their immutable creation mapping is retained even if an item is removed and re-added. That is the bounded allocation, not a missing full attempt/correction journal.
- Legacy source rows can have unknown approval history; the API explicitly labels the fallback `legacy_snapshot_unknown_approval` rather than manufacturing a human-reviewed past definition.
- Existing history import can refresh display snapshot columns while retaining the original reviewed-content pin. This review does not claim those legacy display mutations reconstruct an immutable source execution timeline.
- `listCycles` already selects `c.*`; storing manifests on cycles consequently increases its authenticated payload. No load measurement or performance failure was observed, so this is a follow-up projection/payload-budget consideration rather than a blocker invented from a hypothetical.
- Multi-row administrative cleanup and other pre-existing lock patterns merit runtime deadlock testing if concurrent coverage is required. No additional reachable deadlock was proven here; no speculative lock concern is represented as a confirmed defect.

## Exact candidate and dependency hashes

All paths below are relative to the candidate repository. These hashes define the first-review boundary, not a later fix.

| File | SHA-256 |
|---|---|
| `Tesbo-Backend-Nest/migrations/V158_native_run_retest.sql` | `2eb41fa3a816ff488fee3d1ed2828b7df133319b1cb46e53b3dd3fcd8b47dea9` |
| `Tesbo-Backend-Nest/src/legacy/native-retest.ts` | `606721565ff07ff18ac67e66b3265a947263c115a30ae962f4d3d4712baf5f3e` |
| `Tesbo-Backend-Nest/src/legacy/native-retest.spec.ts` | `bfce070d94ae60bbb2cb17d3a7bc58a2901af80746615b762123fa8d61e6b823` |
| `Tesbo-Backend-Nest/src/legacy/legacy.service.ts` | `6a124ce92feb1e982100367a9ec0c62e1c4d360e31d91a9bc1087c38b7a0546b` |
| `Tesbo-Backend-Nest/src/legacy/legacy.controller.ts` | `910e7fe7afac52997b93a1fca15c0891b5d03f8c0f5b212092777a385b9124ac` |
| `Tesbo-Backend-Nest/src/legacy/approved-run-cases.db.spec.ts` | `9510238291d718259a530db164dd00cfd46c2657eeb4d19a45d8e48ecc13ee40` |
| `Tesbo-Backend-Nest/src/legacy/plan-project-lineage.db.spec.ts` | `22a06c2fd3bd987c9579adfc9023d9a0a5382ec9c0faff94994f39cdbcb4daa3` |
| `e2e/api/cycles.spec.ts` | `e5f89f667601764605dab36acd2ea01be5636a9eb0da2f0b8318acf43544796f` |
| `Tesbo-Backend-Nest/src/legacy/approved-run-cases.policy.ts` | `093a82f2e826080c433a30e184f801e5da4a302da7941fcda7109341cbed23e2` |
| `Tesbo-Backend-Nest/src/legacy/testcase-edit-revision.ts` | `79630cf6a16babaf4aa1f3ba1c96a4db940b81443bc56a6f48845dc3584e0bc9` |
| `Tesbo-Backend-Nest/src/common/human-review-principal.ts` | `ddba247c680a53b4d091908061add30b04c8a2505fe6321bc58d93f20fde50c8` |
| `Tesbo-Backend-Nest/src/legacy/plan-run-write-lock.guard.ts` | `2f3d3916fd456315895ef09ca9523b2308d8a8df0bc33c5dd997642b8fab20fd` |
| `Tesbo-Backend-Nest/src/plan-limits/plan-limits.service.ts` | `364ab23fd1d9f19fbc70c593aadb0510b6c0c9fe85f3702b4bf8ac75dd471b7c` |
| `Tesbo-Backend-Nest/src/request-cache/request-cache.service.ts` | `13dccc2e57ac14e47010765092e4b3b078784bd9407d3263e1b467819fd6d318` |
| `Tesbo-Backend-Nest/src/automation/automation.service.ts` | `7f65f3217e132a19daf8aa940b9c3fd315c1810e8ec0c67ca070c1f03f8b0ff0` |
| `Tesbo-Backend-Nest/src/database/database.service.ts` | `857d5854386388ec786956982d93bb12c84d2a55e04d88e84b5703aeffa1ac24` |
| `Tesbo-Backend-Nest/src/auth/auth.middleware.ts` | `22f03f9c016a812f2e001b50603e272b6e78fb718b579d8dcb6f12e7a7aafeff` |
| `Tesbo-Backend-Nest/src/auth/api-token-rest.guard.ts` | `47d47da161c3012c9d764ddca070bdd75d4e76aa539490865c474d918ab102f8` |
| `Tesbo-Backend-Nest/migrations/V111_cycles_soft_delete.sql` | `8bc642a2a7235f6610377a65945b11fe1a30a9783a69a7239e605b544f8db0ce` |
| `Tesbo-Backend-Nest/migrations/V135_project_scoped_run_task_seq.sql` | `8059a162d691a63faf4178431ae129264533d273022c89571c4f70353b91ca31` |
| `Tesbo-Backend-Nest/migrations/V147_graph_review_run_case_links.sql` | `38d39b76a96ce9439ad506d2a80b976234a13e799b56bcc74bad0d5f5bc009fc` |
| `Tesbo-Backend-Nest/migrations/V155_testcase_review_semantics.sql` | `43452d7ad712a5ba9d75320ddc83a73e3e982ec3307ce140084f4028d7d15ee2` |

## Handoff

The coordinating agent owns product/test corrections and actual isolated impacted CI. Re-review only the resulting affected deltas against NR-B01/NR-B02/NR-T01 and any concrete new mechanism they introduce. Preserve this first report and the independent pre-candidate scenarios as historical evidence; do not rewrite them into a retroactive clean verdict.
