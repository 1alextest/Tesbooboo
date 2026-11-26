# Background recovery execution modes — proposal

**Status:** implementation prepared behind explicit configuration; recommended development/project/global
policy remains pending owner approval. No live worker scope is changed by this document or by deploying
the code with no new environment variables.

**Owner:** the existing T-455 graph QA notification recovery path:

- `Tesbo-Backend-Nest/src/behavior-graph/graph-change-review.recovery.ts` — durable-receipt selection
  and bounded sequential delivery (100 receipts, 48-hour window).
- `graph-change-review.recovery.processor.ts` — the BullMQ worker entry points.
- `graph-change-review.module.ts` — the cluster-wide scheduler registration.
- `graph-change-review.delivery.ts` — the existing notification writer and per-user dedupe key.

No outbox table, notification type or delivery implementation is added. Project mode does add a
second BullMQ queue and scheduler so it cannot be claimed by the legacy worker. The committed
`graph_capture_history` receipt and native `notifications` row remain authoritative. REST/MCP retries
remain project-authorized; the background path only calls the trusted internal recovery method.

## Modes

| Mode | Scheduler | Worker scope | Intended use |
| --- | --- | --- | --- |
| `off` | none registered | both processors refuse | default; production until owner approval |
| `project` | `graph-qa-review-recovery-scoped-v1` | only `TESBO_GRAPH_QA_RECOVERY_PROJECT_ID` | development, e2e, and isolated verification |
| `global` | `graph-qa-review-recovery-v1` | every eligible project | production only after explicit approval |

Configuration precedence:

- `TESBO_GRAPH_QA_RECOVERY_MODE=off|project|global` wins when set.
- An unknown non-empty mode fails closed to `off`; it never widens to global.
- With `MODE` unset, legacy `TESBO_GRAPH_QA_RECOVERY_ENABLED=1` still means `global`, so upgrading an
  existing deployment does not silently remove an already-enabled worker.
- `project` requires `TESBO_GRAPH_QA_RECOVERY_PROJECT_ID` to be a UUID. If it is missing or invalid,
  the module registers nothing and logs the reason; a scoped processor also refuses a job whose scope
  does not match its own configuration.

## Why the scoped queue is separate

The legacy queue is understood by older instances that ignore job data and call the global sweep.
Putting a project-scoped job on that queue would let an old instance claim it and scan every project.
`project` therefore uses `graph-qa-review-recovery-scoped` with its own scheduler and processor. An
old instance cannot receive it. The legacy queue remains global-only.

Mixed versions and mixed modes are still unsafe to treat casually:

- **All replicas must share the same mode and, in project mode, the same project id.** A global
  instance still registers a scoped processor (which refuses the job) and can therefore consume a
  project tick without doing its work. Two project instances with different ids upsert the same
  scoped scheduler id, so the last boot wins and the other project silently never runs. Mixed
  configurations are unsupported, not merged.
- During a rolling deployment, an old instance with `TESBO_GRAPH_QA_RECOVERY_ENABLED=1` continues to
  run the legacy global sweep. `project` cannot constrain that instance.
- A disabled instance never deletes the shared scheduler because the scheduler identity belongs to
  the cluster, not the process. Removing a scope requires an explicit scheduler removal after every
  worker is disabled.

## Rollout proposal

1. **Approval (pending).** The owner decides whether development uses `project`, whether staging may
   use `project`, and whether production may ever use `global`. This proposal does not decide it.
2. **Development/e2e first.** Set `MODE=project` and a disposable project UUID in the development or
   e2e environment only. Verify the ten-minute scheduler fires, the scoped log summary appears, and a
   missing native notification row becomes present. No production variable changes.
3. **Production audit while off.** Confirm the current value of `TESBO_GRAPH_QA_RECOVERY_ENABLED`.
   If it is `1`, treat that as an existing global grant and do not change it implicitly. If it is
   absent, production remains `off`.
4. **Production global only after approval.** After all instances run this code and the legacy
   scheduler state is understood, set `MODE=global` (or retain the legacy flag). Verify the log
   heartbeat, a SQL-confirmed notification row, and scheduler identity. Never infer delivery from an
   enqueued job or a UI toast.
5. **Rollback.** Set `MODE=off` and remove the registered scheduler after all workers are disabled
   using the BullMQ scheduler id (`graph-qa-review-recovery-v1` or
   `graph-qa-review-recovery-scoped-v1`) through the existing Redis/queue tooling; there is no HTTP
   removal route. A rollback does not delete committed receipts or delivered notifications;
   re-enabling is safe because the native dedupe key makes delivery idempotent.

## Verification plan

- Unit: mode precedence, fail-closed unknown mode, project UUID requirement, global/scoped processor
  dispatch and refusal, separate scoped scheduler/job identity.
- Existing migrated-PostgreSQL recovery test: one synthetic project via the internal project filter.
- CI smoke/e2e: must not enable global recovery or send another tenant's notifications. Development
  project mode uses only the disposable project id.
- Operator readback: structured `GraphChangeReviewRecovery` summary on every run, 100-receipt
  saturation warning, notification dedupe row, current project/organization/role checks, and absence
  of notification rows for archived projects or revoked members.
- Not proven here: a deployed Redis timer with the new mode, production approval, latency/SLO,
  alerting, or a connected source-to-QA acceptance journey.

**E2E disposition.** This change has no HTTP route, UI, or default-deployment behaviour change; it
only chooses which existing worker may run when a new environment variable is deliberately set. The
Playwright suite cannot restart the backend with a different mode because it does not own the server
process. The applicable executable coverage is therefore the processor/module registration tests
plus the existing migrated-PostgreSQL project-filter test. A deployed mode switch remains unexecuted
and is a rollout step, not something this PR claims to have tested end to end.

## Filename concurrency (upload race covered; broader invariant separate)

The upload work had left displayed-name allocation outside the insert lock, and no open PR owned it.
A bounded correction now allocates the name inside the upload transaction after the project advisory
lock, preserving deliberate same-name uploads under a new request key. The concurrency regression is
KBF-A-87. Move, rename and restore still do not reallocate a name, so the broader folder-wide
uniqueness invariant is not claimed as closed; the storage layer, delete retries and historical
repair are unchanged. See §13.1 of
[the Work Package B design](work-package-b-governed-manuals-policies-design.md).

## Native coverage record

A native search found 35 existing cases in the authorized Tesbo project, none covering graph background
recovery. A create-case proposal was staged through the authorized MCP path:

- task `3484b21f-5c20-4b15-b28e-d5a474551499`
- proposal revision `93457a5ad0156066d563428e619330f9e4925b512bc2f669d96d2f2aabdd2ff5`
- request key `bg-recovery-mode-20261126-1795729018487`
- status `in_review`, one unpublished Draft case in the Requirements suite
- native review path `/projects/df072dfe-e4d0-406a-9350-e0d022c6323f/agents/tasks/3484b21f-5c20-4b15-b28e-d5a474551499`

The proposal is not applied, linked or executed. Manual execution remains **UNRUN**; the case remains
Draft if a human later applies it, and no PASS/FAIL evidence is inferred from the staging.

## Coordination

- **#301** owns `knowledge-document-writes.db.spec.ts` destination/race coverage; this work does not
  edit it.
- **#302** owns `integration-sync.processor.ts` quota-accounting behavior; this work does not edit it.
- **#303** owns the automation handoff; it is not duplicated.
- **#292/#298** own runtime authorization corrections; no OAuth/security surface is changed.
