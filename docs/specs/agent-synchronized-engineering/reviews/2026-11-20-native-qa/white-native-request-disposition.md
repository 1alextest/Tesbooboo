# White native retest request disposition — bounded admission

**Reviewer:** `/root/white_qa_allocation`. **Date:** 20 November 2026 UTC.

**Verdict: PASS WITH EXPLICIT GATES — ADMIT the narrow `cycle_retest_requests` terminal-disposition child at the existing native Run command owner.** This is a justified command fact, not a second task, workflow, attempt, result or Run registry. The correction may proceed within the already authorized native retest increment. No additional user continuation or general architecture cycle is required.

The original `white-allocation-decision.md` remains byte-identical at SHA-256 `d9471685b6853d086e12c0e4a3e22c974e64eb44e9cebfa63bb4f5c00164df11`. Allocation A is neither reopened nor enlarged. This separate receipt admits the author's correction at `native-request-disposition-addendum.md`, SHA-256 `c83f702e5e6b1847e1b682318fb1a5657f6acfc4069fc8663da8a9455e8528ae`. It does not rewrite any earlier review or convert source review into runtime acceptance.

## Required White record

| Field | Disposition |
|---|---|
| Review area | Safe recovery of an uncertain native retest creation when no destination committed and the original reviewed basis has since become stale. |
| Application/run context and revision | Tesbo; clean implementation base `1fe100588be6c3a1627ee39a4b0bbc1c0d9da2ea`; canonical v1.4.34 and unchanged method from the original allocation receipt. Proposed correction is the exact author addendum above. Relevant pre-correction source bytes were checked against `native-candidate-before-ci.json`; see evidence table below. |
| Development stage and evidence boundary | Coupled architecture correction before its implementation/first isolated CI. Static source and document inspection only. No DB, HTTP, browser, migration or deployment was run. |
| Gate | PRE-ARCHITECTURE, limited extension of the already admitted native command-recovery obligation. No Gate 2 verdict. |
| Evidence package | Actual current author addendum; frozen independent UI scenarios; existing independent backend fix review; direct trace of the pre-correction native create/readback, request normalization/digest, destination receipt migration and dialog recovery. |
| Methodology transfer receipt | N/A: no canonical method or reusable rule is changed. |
| New primitive reviewed | One immutable terminal request disposition keyed by project/request key, binding source, authenticated actor and normalized intent digest; either created with the exact destination or cancelled with no destination. |
| Duplicate-authority risk | Controlled by one native command owner, shared request serialization, immutable terminal facts and one-transaction created linkage. Destination `cycles.retest_manifest` continues to own source-at-creation/target-occurrence provenance; the child does not copy that manifest or own Run/results status. |
| Unresolved product decisions | None introduced. Cancellation suppresses an uncertain command; it does not cancel a created Run, undo test results or grant target/driver authority. |
| Unresolved architecture decisions | None blocking this narrow allocation. The chosen constraints, consistent receipt linkage, serialization and authorized recovery path require implementation proof. |
| Graph status | Manual White ownership/consequence reconciliation. No separate Graph or mechanical closeout is claimed. |
| Blocking reasons | None for this allocation. Implementation and runtime gates below remain open. |
| Named gates | Existing native N/recovery, current-authority, retention and UI/CI gates, refined by the finite proofs below. External A and its gates are unchanged. |
| Accountable human decisions required | None for this bounded correction. Existing current-human membership and project authorization still govern cancellation/readback; no operational policy or deployment authority is created. |

## Missing fact and direct source check

The initial independent UI scenario set already requires safe uncertain-result recovery, truthful absence versus failed read, source-deletion recovery and preservation of pending intent across navigation. The reported candidate finding is consistent with a direct static trace:

- `createNativeRetest` serializes creation by `native-retest:${projectId}:${requestKey}`. It returns a prior destination receipt if one exists, otherwise compares the current basis with the saved preview and refuses a mismatch with `RETEST_PREVIEW_CHANGED`.
- `readNativeRetestRequest` searches destination `cycles` by source/project/request key. Without a committed destination it returns 404; this is absence at that read, not a promise that a delayed create can never arrive.
- `RetestRunDialog` correctly retains an uncertain intent on a refused retry and on 404 readback. The pending intent prevents fresh preview/create. After a lost-before-arrival POST and changed source/current definition, the same saved request can repeatedly receive 409 and then 404 with no safe terminal clearing path.
- V158's original receipt fields and unique key exist only on a destination Run. They cannot record a terminal decision when there is no destination.

This establishes the missing recovery mechanism at source-review tier. I did not reproduce a browser hang, network failure or database race. The current request digest already normalizes the exact occurrence set and creation input and includes source and actor; that is a useful existing binding to preserve.

## Why the proposed child is the correct ownership extension

The command and its possible output have different cardinality: a successfully created request has one real destination; a cancelled request has none. Both outcomes must permanently answer a retry using the same identity. The missing fact is **this exact command identity can no longer create a Run**. It is not reconstructable from an absent destination, a timeout or current browser state.

The alternatives in the author's addendum survive the negative-design check:

| Alternative | Disposition |
|---|---|
| Keep cycle-only success receipts unchanged | Insufficient: no row exists on which to record noncommit. A 404 cannot fence a later request. |
| Create a placeholder or deleted Run for cancellation | Rejected: it fabricates a test occasion and burdens native Run/history consumers with a non-Run. |
| Clear local storage or wait a fixed interval | Insufficient: neither binds the server nor excludes a delayed old POST. |
| Use arbitrary audit JSON as the command lookup authority | Unjustified here: it would make activity an implicit uniqueness/command-state owner. Audit should record the native terminal decision in the same transaction. |
| Introduce a general idempotency/task engine | Unnecessary: the demonstrated invariant belongs to this existing native command and its request identity. |
| Add the proposed narrow terminal child | **Admitted:** it records the zero-or-one-output decision without creating another lifecycle root. |

The relation is coherent only as an immutable command disposition. It has no independent queued/running/attempt/result lifecycle. A `created` row references the exact same-project destination and agrees with that destination's immutable source/key/digest/actor receipt; a `cancelled` row has no destination and fences every later same-key create. The two records are not independently editable replicas: native creation, its manifest, mandatory audit and the terminal created disposition commit together. Cancellation commits its terminal disposition and mandatory audit together. Readback projects those facts rather than inventing another completion state.

The selected project/request serialization gives a discriminating outcome: if create commits first, cancel returns the created receipt; if cancel commits first, delayed create refuses. Cancellation never erases or relabels successful creation. Changed actor/source/digest reuse conflicts instead of taking over the key. Terminal identity and receipt consistency must remain enforced through ordinary soft deletion and every relevant native writer.

## Finite implementation and acceptance conditions

These implement the author's selected contract; they do not reopen the external allocation or require a new product design.

1. **Use the same request lock and exact normalized intent throughout.** Create, explicit cancel and authoritative readback must agree on project/key, source, actor and digest. Check the terminal disposition before a creation can produce effects; validate coherent created linkage and mutually exclusive created/cancelled shape. Terminal rows cannot be updated, deleted and reused by an ordinary path. Mandatory audit failure rolls back the corresponding terminal write and native effects.

2. **Recovery must remain reachable for the actual failure case.** Cancellation cannot require a still-valid preview, a current Approved case, or an already-created destination receipt; those would reproduce the dead end. It may resolve retained source identity for current authorized recovery after source soft deletion, without exposing deleted source contents or permitting fresh creation. Ordinary source reads and new creation retain their active-source and eligibility rules. Fresh creation retains the current billing/writability check; cancel/readback can suppress or recover an old intent under the stated billing lock while still requiring current human identity and project/workspace authority. Recheck authority after waits.

3. **The browser clears uncertainty only from an exact terminal result.** A 404, timeout, failed read or stale retry remains nonterminal. The browser verifies the cancelled disposition against its saved scope/actor/digest before allowing a freshly reviewed new key, or verifies/opens the exact created destination. A lost cancellation response is recoverable with the same key. Scope/request-generation fencing must prevent an old tab/account/Run response from clearing or navigating a different intent. This is distinct from dismissing an unsent preview, which creates no server command.

4. **Prove the complete recovery and its races in the existing isolated checks.** Exercise lost-before-arrival POST → changed basis → stale retry → explicit cancellation → cancelled readback → late original refusal → fresh reviewed request producing exactly one Run. Force both create-wins and cancel-wins orderings under real serialization; test lost cancellation acknowledgement, same-key replay, altered reuse, unauthorized and post-wait-revoked callers, billing-lock cancellation versus refused fresh creation, source soft deletion without a prior destination, and forced mandatory-audit failure. Independently read terminal outcome, native Run count/identity and unchanged source results/evidence. Authentic browser evidence must show the user can complete recovery; static code and intercepted responses alone do not prove persistence or transaction behavior.

The author states V158 is unpublished and unapplied. This admission covers adding the selected native relation in that correction under that stated status; this reviewer did not inspect a deployed schema or execute a migration. The updated migration, services, UI and tests require a new exact candidate binding for their actual CI evidence.

## Evidence identities and preservation

All paths below are under `/workspace/scratch/8e9074abd0d0`. Exact pre-correction source files matched their entries in the frozen candidate manifest when inspected. This is a targeted seam review, not a review of every changing implementation file or a second acceptance of the backend fix receipt.

| Input | SHA-256 |
|---|---|
| `qa-loop-assurance/native-request-disposition-addendum.md` | `c83f702e5e6b1847e1b682318fb1a5657f6acfc4069fc8663da8a9455e8528ae` |
| `qa-loop-assurance/white-allocation-decision.md` — unchanged | `d9471685b6853d086e12c0e4a3e22c974e64eb44e9cebfa63bb4f5c00164df11` |
| `qa-loop-assurance/native-ui-independent.md` | `aa923cc13e40952b1ae67f261e4c34e767fbacd82a3c5ab68e956f5ac322f952` |
| `qa-loop-assurance/native-backend-fix-review.md` | `b084c144d6ba7f150c692b6065132cfd45e94309871c4182164044ec7f9e1b78` |
| `tesbo-qa-loop/Tesbo-Backend-Nest/src/legacy/legacy.service.ts` | `e75bc9adc36e67541706f9a3de2224af1e48b6ea2155ef39e221ea00b6db387d` |
| `tesbo-qa-loop/Tesbo-Backend-Nest/migrations/V158_native_run_retest.sql` | `2eb41fa3a816ff488fee3d1ed2828b7df133319b1cb46e53b3dd3fcd8b47dea9` |
| `tesbo-qa-loop/Tesbo-Frontend/components/testruns/RetestRunDialog.tsx` | `40ba2adb5072c28f077c08206e40ff981c03321f51f31cfa93a1f093e4cc2d92` |

**Final disposition:** the terminal child is justified by a concrete zero-destination recovery invariant and has one clear native owner. Implement this coupled correction, preserve the source-at-creation manifest on `cycles`, and retain runtime/UI/authority/migration proof. The native increment still does not complete T-428/T-424 or external I3-Q. Canonical v1.4.34 and the product remain NOT FROZEN. Only this separate White receipt was written by this reviewer.
