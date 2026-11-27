# Gate K — external-work conditional shape (27 November 2026)

**Source identity:** branch `feat/gate-k-external-kind-coherence-20261127`, based on
`origin/development` `ca0cdca5c0f21c20e2f8a08bfa1de89a3c21c524` (the head also reported by PR
#326's verification record). This is an implementation record, not an independent review receipt,
not a canonical specification, and not a Gate K closure claim.

## Scope of this increment

Gate K requires every legacy consumer to admit only the kinds it supports, coherent conditional
external-work fields, and evidence separating database from application enforcement. This
increment addresses the **conditional-shape** prerequisite only. The external producer remains
physically closed by V168's `native_qa_external_producer_closed`; no code path can create,
assign, claim, report or close external QA work after this change.

### Reused owners

- `ai_generation_requests` remains the single native task root (allocation A). No parallel task,
  queue, proposal or attempt store is introduced.
- The canonical external task lifecycle is taken verbatim from
  `docs/qa-orchestration/02_WORKFLOW_AND_UX_SPEC.md` §4.1 — `DRAFT`, `READY`, `ASSIGNED`, `CLAIMED`,
  `IN_PROGRESS`, `REPORTED`, `UNDER_ANALYSIS`, `CLOSED`, `CANCELLED`, `NEEDS_CLARIFICATION`.
- V168's provider→kind classifier, kind immutability trigger and producer fence are unchanged.
- V157's proposal revision/history triggers and V169's snapshot scope are unchanged.

### Implemented

`Tesbo-Backend-Nest/migrations/V170_native_qa_external_work_shape.sql`:

1. Adds `external_work_state`, `external_work_revision`, `external_prompt_revision`,
   `external_prompt_digest` to the task root. These are the external work's own state/revision and
   current reviewed-prompt pointer; they are explicitly **not** `task_status` or
   `proposal_revision`.
2. Relaxes table-wide `NOT NULL` on the generation-only columns (`agent_name`, `task_status`,
   `user_story`, `requested_count`, `generated_count`, `generated_payload`, `saved_count`,
   `save_events`, `proposal_revision`, `token_input`, `token_output`, `token_total`) and restates
   them as **kind-conditional** constraints:
   - `native_qa_generation_fields_required` — non-external rows must still carry every legacy fact.
   - `native_qa_external_generation_inapplicable` — external rows must carry none of them, must
     have no proposal identity, and must not claim Skill context.
   - `native_qa_external_work_shape` — all four external fields present for external rows and
     absent for every other kind.
3. Adds vocabulary, non-negative revision, positive prompt-revision and digest-format checks.
4. Adds `native_qa_external_work_revision` (BEFORE UPDATE) which:
   - advances `external_work_revision` by exactly one when work state or the reviewed prompt
     pointer changes, and refuses any other revision edit (server-owned CAS token);
   - refuses a reviewed-prompt change once execution authority exists (`CLAIMED` onward);
   - refuses terminal-state rewinds (`CLOSED`, `CANCELLED`).

`Tesbo-Backend-Nest/scripts/ci/check-db-integrity.cjs` extends the disposable-PostgreSQL integrity
job: it asserts the installed constraints/columns, then — inside a savepoint that is rolled back —
temporarily lifts only the producer fence to prove one coherent external DRAFT fixture and fourteen
exact conditional refusals, and finally asserts the fence is restored and validated. No external
row can persist.

## Explicitly deferred

- **Producer admission.** The fence stays closed. Enabling it requires the Gate A installation,
  credential, assignment and fenced-attempt owners plus the Gate K runtime evidence below.
- **Prompt/analysis content revisions.** The root stores only the current pointer and digest. The
  immutable task-owned content envelope (unique task/type/revision, exact source refs) is a
  separate owned child, deferred with the prompt owner.
- **Assignment, attempt, fence, report custody.** Gates A and E; not represented here.
- **Transition legality beyond terminal immutability and prompt freezing.** Assignment/claim/
  lease semantics remain at the Gate A application owner, which must recheck authority under its
  own lock.
- **Frontend projection of `taskKind`.** Every backend list/detail query already filters kinds
  (verified below), so an external row cannot reach the current `ZyraTask` type. The projection
  change is deferred to avoid colliding with open PRs #323/#332, which both edit
  `Tesbo-Frontend/lib/api.ts`; it becomes required when a UI surface reads external work.
- **`requested_by` deletion behaviour.** V107 deliberately retained `ON DELETE CASCADE` with a
  documented single-meaning-NULL rationale. Changing it is a separate retention decision (Gate
  H) and was not made here.

## Consumer census (Gate K items 1, 3, 6, 7)

Source audit of every production reference to `ai_generation_requests` (backend `src` excluding
specs, migrations, `scripts`, and frontend non-test files) at `ca0cdca5`:

- **Real gaps: none.** Every read/write/list/serializer path either carries a positive
  `task_kind` predicate, or reads without a SQL predicate and then positively admits kinds via
  `isLegacyProviderTask()` / `assertNativeProposalRequestReplay()` before any effect.
- Trigger-assigned INSERTs (6) rely on the V168 `BEFORE INSERT` classifier; they cannot be born
  with the wrong kind.
- Ticket-comment claim/deliver/retry/list (5), notifications/activity (2), board/detail/listing,
  metrics/approval-rate and the archive sweep all pin admitted kinds.
- V169's snapshot function filters to `legacy_generation_review`/`governed_proposal`.
- Frontend references are comments or a type whose rows come only from kind-filtered backend
  queries. No misrender path today.

This is source inspection, not runtime telemetry; unknown deployed clients and operator SQL remain
rollout inputs.

## PR #323 integration (Gate K item 2)

PR #323's head `91213b1f` already contains `ca0cdca5`. Its net changes add
`lockReviewedZyraDraftBatch`, an exact `expectedProposalRevision` CAS, and a same-lock committed
reread. The new/retained task-row locks keep
`task_kind IN ('legacy_generation_review','governed_proposal')`, and the draft mutation UPDATE keeps
its kind predicate. Exact review revisions and task-kind restrictions are both preserved; no
integration edit was required here.

## Verification status

- **Implemented and statically checked:** `node --check` passes on the integrity script.
- **NOT RUN locally:** this environment has no repo-root `.env`, no Docker daemon and no backend
  `node_modules`, so neither the migrated PostgreSQL job nor the Playwright suite can be executed
  here. No runtime result is claimed.
- **Verification path:** `.github/workflows/behavioral-quality.yml` runs the real migrator twice and
  `check-db-integrity.cjs` against disposable PostgreSQL on every PR. The exact-head run result
  belongs to the PR record.
- **Impacted product area:** task/proposal generation, board, detail, notifications and ticket
  comments. The migration changes no API behaviour and no production code path; the external
  branch cannot be reached while the fence is installed.
- **Not claimed:** merged, deployed, accepted, Gate K closed, producer admitted, or any e2e run.
