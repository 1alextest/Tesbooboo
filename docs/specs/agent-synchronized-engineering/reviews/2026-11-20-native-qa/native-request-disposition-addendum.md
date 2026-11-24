# Native retest request disposition — bounded implementation correction

Current author: `/root`. Baseline: `1fe100588be6c3a1627ee39a4b0bbc1c0d9da2ea`. This addendum preserves the frozen allocation memo and White receipt unchanged.

## Concrete missing invariant

The independent UI review found that a request can be lost before reaching the server, then become stale when the source observation or current approved case changes. Same-key retry correctly refuses the stale preview, but 404 readback cannot prove that an earlier delayed POST will never arrive. Keeping the intent indefinitely blocks the user; clearing it can allow a delayed duplicate creation. A usable recovery path needs a durable terminal noncommit fact.

## Selected owner extension

Add a narrow `cycle_retest_requests` child relation under the existing native Run command owner. It is keyed by `(project_id, request_key)` and binds exact source-cycle identity, human actor and normalized request digest. Its immutable terminal outcome is either `created`, referencing the actual native destination, or `cancelled`, with no destination. It is not a task, attempt, result, approval, workflow or completion root. The destination `cycles.retest_manifest` remains the sole immutable source-at-creation receipt; its request key/digest are historical pins, not an independently mutable command state.

Creation, readback and explicit cancellation use the same existing project/request advisory lock and current project/human authority. Creation inserts the terminal `created` disposition with destination creation/manifest/audit in one transaction. Cancellation returns the created receipt if creation already won; otherwise it commits `cancelled` plus mandatory audit. Every later same-key create checks that disposition and refuses after cancellation. Changed payload/actor/source with the same key conflicts. A lost cancellation response is recovered by readback. A fresh preview/new key is permitted only after the browser verifies the exact terminal cancellation, or after it opens the exact committed destination.

Cancellation releases a pending intent; it creates no Run and changes no existing result. It remains available under a project billing write lock, as other revocation/recovery actions do, while requiring a current human session and project/workspace membership. It does not claim to stop already completed creation or any remote driver. Deleted source identity may be retained for authorized command recovery; ordinary source reads/new creation remain refused.

## Alternatives and constraints

Unchanged cycle-only receipts cannot represent cancellation when no destination exists. Creating a placeholder/deleted Run would invent a test occasion. A mutable localStorage flag or timeout is not a server fence. Hiding cancellation in unindexed arbitrary audit JSON would make the activity log an implicit command-state owner with weaker relational uniqueness; the existing audit owner still records the decision, but does not replace the native command relation. A general idempotency framework is not needed.

Use same-project source/destination FKs, unique request identity, immutable outcome rows, exact digest/actor binding and a coherent successful-receipt relationship. No active/queued/attempt state machine or new top-level product UI is added. V158 is still unpublished/unapplied and can include this additive native child table before first CI. Retain exact created/cancelled historical facts through ordinary soft deletion; no blanket real-data retention policy is invented.

## Decisive tests and evidence limit

1. Lost POST before commit → source/case change → stale same-key retry → explicit cancel/reconcile → durable cancelled readback → late original POST refused → fresh reviewed request creates exactly one Run.
2. Create wins versus cancel wins under real concurrent request serialization: one immutable terminal outcome, no duplicate Run, cancellation cannot erase a created receipt.
3. Lost cancellation response and repeated cancellation recover the same disposition; changed reuse and unauthorized callers cannot alter it.
4. Current plan lock permits cancellation/readback while refusing fresh creation. Mandatory audit failure rolls back the cancellation fact.

This is a source-grounded correction to the admitted native recovery increment, not external I3-Q implementation or full immutable attempt/correction completion. Actual database/HTTP/browser proof remains required in isolated CI.
