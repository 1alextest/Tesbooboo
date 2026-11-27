# KB transcription recovery modes — proposal

**Status:** implementation prepared for review; no live environment variable or production execution
policy is changed. This is separate from graph QA notification recovery in
[background-recovery-modes.md](background-recovery-modes.md).

**Owner:** the existing Knowledge Base path in `LegacyService`:

- `onModuleInit` / `onModuleDestroy` — start and stop the restart sweep.
- `startKnowledgeTranscriptionRecovery` — decide mode/scope and register the timer.
- `resumeInterruptedKnowledgeTranscriptions(projectId?)` — bounded claim-before-dispatch sweep.
- `transcribeKnowledgeFile` — existing transcription, lease, heartbeat, fencing and embedding owner.

No queue, storage object, transcription provider or duplicate recovery ledger is added.

## Configuration

| Variable | Meaning |
| --- | --- |
| `TESBO_KB_TRANSCRIPTION_RECOVERY_MODE` | `off`, `project` or `global` |
| `TESBO_KB_TRANSCRIPTION_RECOVERY_PROJECT_ID` | required UUID in `project` mode |

- **Unset** preserves the existing behaviour: automatic **global** recovery at startup and every five
  minutes. This work does not claim the default is off.
- Explicit `off` registers no startup dispatch and no timer.
- Explicit `project` requires a valid UUID; selection and processing are constrained to that project.
  A missing or invalid UUID fails closed with a warning and registers nothing — it never widens to
  global.
- Explicit `global` retains the existing all-project sweep.
- Any other explicit value fails closed to no registration.
- This flag is independent of `TESBO_GRAPH_QA_RECOVERY_*`. Changing one does not change the other.

**Request-triggered upload transcription is not controlled by this flag.** An authorized upload still
calls `transcribeKnowledgeFile` for its own file; disabling background recovery only stops the
restart/periodic sweep. Existing upload idempotency and replay are unchanged.

## What the sweep keeps

The existing safeguards are preserved: five-minute lease, one-minute heartbeat during byte reads and
provider calls, UUID claim fencing on every terminal write, live-file/archive rechecks, 25-row
bounded least-recently-tried batch, transient-versus-missing object handling, and at-least-once
external provider-call limitation after a crash. Project mode changes only the SQL scope and the
argument passed to the existing sweep.

## Rollout

1. **Review only now.** No environment variable is changed and production continues with the
   existing unset/global behaviour.
2. **Development/e2e `project`:** set the mode and a disposable project UUID in that environment;
   verify startup, the five-minute summary/heartbeat and that no other project is claimed or charged.
3. **Production:** retain unset/global (current behaviour) unless the owner explicitly approves a
   scope change. Setting `project` in production would deliberately stop automatic recovery for all
   other projects; setting `off` would stop background recovery entirely while leaving upload
   transcription enabled.
4. **Rollback:** restore unset (global) or set the previous explicit mode and restart instances.
   There is no durable scheduler identity to remove; the timer is process-local and cleared on
   shutdown.

## Verification

- Unit lifecycle tests exercise unset/global, off, project, invalid project and duplicate startup;
  they assert startup dispatch, the five-minute dispatch scope, and timer cleanup on shutdown.
- The migrated-PostgreSQL suite uses two disposable projects and proves a project-scoped sweep
  neither claims, reads bytes for, nor calls the provider for the other project.
- Existing transcription recovery tests continue to cover lease takeover, fencing, transient reads,
  missing objects, archived/deleted exclusion and embedding enqueue.
- Not proven here: a deployed timer under an actual non-default mode, production approval, alerting
  or manual execution. The Playwright suite does not own the backend process and cannot restart it in
  another mode; that is an explicit e2e boundary, not an executed acceptance claim.

## Native coverage

Native manual execution remains **UNRUN**. A separate KB recovery case was staged through the
authorized MCP path:

- task `aa42edf8-585c-49c1-adeb-44430752c0d4`
- revision `3ade16efbe499dafc222757f9ea07c18667b9630b2d36902b68047ee38e01565`
- request key `kb-transcription-recovery-20261126-1795738337274`
- status `in_review`, one unpublished Draft case in Knowledge Base
- review path `/projects/df072dfe-e4d0-406a-9350-e0d022c6323f/agents/tasks/aa42edf8-585c-49c1-adeb-44430752c0d4`

It is not the graph recovery case (`3484b21f-…`) and does not imply apply or execution.
