# Knowledge index publication basis — bounded implementation increment

**Status: draft, NOT FROZEN.** Development pin 2e91c8e95dbf90ced664ca4f35af207abaa56941. Reuse existing RagEmbeddingProcessor and KB source owner. #342 owns query-time freshness and #343 owns partial retrieval resilience; no overlap in their changed files. #340 and #341 retain model nomination and historical graph basis ownership. No new schema, graph, policy, authorization grant, provider exposure or active Skill.

## Source finding and contextual distillation

The existing knowledge worker loaded text once, awaited provider calls, deleted/reinserted chunks and then marked the parent ready in a separate statement. It could publish old input after a source edit, or mark ready with no valid vectors (the prior test explicitly expected ready after wrong dimension). Source evidence: development rag-embedding.processor.ts lines 35–177 and existing regression at 218–230. No production occurrence asserted.

Apply the existing **invalidate reliance, not history** and **exact source-basis** principles: a derived representation's publication must be atomic with the current authoritative basis check and its readiness signal; never replace the previous generation with a partial, malformed or superseded result. A preflight read is not a durable effect fence. Reuse the owner, transaction and parent lock, not a second index or lifecycle. Falsifiers: source edit during provider wait, deleted or foreign source, changed governed type, wrong vector shape and valid unchanged source. This is a contextual application of canonical 03/04/05/06, not a separate binding principle or approved Skill.

## Change and limits

- Match queued source to actual project and organization, preserve current manual/policy exposure hold using the existing type classifier, and refuse status writes on missing/deleted/foreign input.
- Scope intermediate status writes to the original text and type; compare current native basis before each external batch (best-effort, not a serialized egress grant).
- Refuse incomplete/malformed vector replacement, retain prior chunks, mark current basis failed instead of ready.
- Lock the scoped parent and compare exact source text/type after the provider returns. Replace chunks and set ready together in one transaction. No provider call while holding a database lock. Retain existing notification path.
- This is a content/type/scope fence, not an immutable revision, job-generation or provider-allocation fence. Same-text ABA, changed provider, job terminal failure callback, enqueue/recovery status generation, testcase embedding path and post-read/transport races remain open. #342 query-time filtering is complementary. No guarantee that an already transmitted request can be recalled, or that every current index is valid. No change to governed exposure policy.

## Verification scenarios and evidence

Existing unit suite extended for scope refusal, stale/deleted/changed-type/foreign locked basis, atomic valid publication, invalid-vector preservation and stopping subsequent batches after change. E2E API suite adds controlled provider wait, edit, held replacement and durable chunk/status assertions; uses disposable tenant and existing stub. Fixture now supplies native root folder required by current create contract. The actual worker scheduling and exact E2E selection remain to be verified. Tests authored; no local Jest, migrated DB or Playwright execution. Git DNS unavailable. Hosted CI and exact-head logs pending. No fake test pass, native Tesbo record, independent team or production verification claimed.

## Coordinator assurance (not independent team dispatch)

Blue: one existing owner; Red: stale/invalid result; Green: provider/DB/chunk/status boundaries; QA: staged race and positive/negative controls; Security: scope and existing type hold preserved, external disclosure fence not established; Grey/Purple: ready must mean a complete current replacement, no new UI; Graph: no coverage or normative authority implied; operability: failure state, retry and old generation retention; EG and formal White NOT RUN. Next: generation-bound queue/failure handling, exact destination authorization and user-configurable participation; independent review, real DB/concurrency tests and native sync before acceptance.

Rollback: revert these four files; no migration.
