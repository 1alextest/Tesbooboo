# Gate A slice 2 — assignment, fenced attempts and prompt content

**Source:** branch `feat/gate-a-assignment-fencing-20261128` from
`origin/development` `2e91c8e95dbf90ced664ca4f35af207abaa56941`. Migrations **V173–V175** are
allocated here; the only other open migration is PR #292's conflicting `V166`, which must renumber
above V175 when it is rebased. This is a non-exposing implementation record, not a formal review.

## Findings addressed

- **A — manual primary report.** V175 restores canonical `DRAFT`/`READY`/`ASSIGNED → REPORTED` and
  rejects it while a claimed/in-progress attempt holds authority. The executor path
  `CLAIMED`/`IN_PROGRESS → REPORTED` requires a current attempt. Human authority, manual-adoption
  policy, expected task revision, unclaimed-assignment disposition and finalized original evidence
  remain command-service and Gate E obligations; the database refuses the unsafe authority overlap.
- **B — installation identity.** `agent_id`, `organization_id` and `installation_key` are immutable;
  the agent must be an `actor_type='agent'` actor; built-in shared actors remain refused on insert
  and on any indirect update.
- **C — grant and credential authority.** Grants are append-only generations: identity, capabilities,
  expiry and grantor are immutable; revocation is one-way; at most one live grant per
  installation/project. Assignments and attempts pin the exact grant row. `api_tokens.installation_id`
  is immutable and organization-scoped; an installation-bound credential cannot change project.
- **D — historical style.** V173 stops requiring `style` for legacy rows. V171's conversion of
  historical NULL to `'strict'` is irreversible and documented; no affected value can be recovered
  from authoritative evidence. `source_summary='[]'` is now enforced for external work, and the
  model documentation is corrected (forbidden for external, optional for legacy non-model producers).
- **E — human-only authority.** The installation capability ceiling excludes `report.import.manual`
  and dispatcher/publication actions. Capability vocabulary is not human authority.
- **F — CAS.** V171's row-level `OLD+1` consistency is preserved; assignments/attempts add the
  caller's exact expected task revision and prompt basis, rejected under the row lock. The command
  service must still use `WHERE revision = expected`, persist idempotent receipts and recover lost
  responses; the database enforces the durable half.

## Implemented

- **V173**: installation identity/actor immutability; grant generations, revocation and capability
  narrowing; credential binding immutability/scope; style/source_summary corrections.
- **V174**: `native_qa_task_prompt_revisions` — immutable exact content (objective, target,
  environment, repository/revision, permitted actions, exclusions, expected observations, required
  evidence, constraints, source refs, authorship/review) with a monotonic task pointer and
  `(task, revision, digest)` identity for assignment/attempt FKs.
- **V175**: `native_qa_assignments` (exact prompt + grant generation + installation, multiple
  historical, one current), `native_qa_attempts` (server-assigned immutable fence, lease hash only,
  one active attempt per task and per assignment, stale expected revision refused, expired/terminal
  attempts cannot regain authority), append-only `native_qa_execution_receipts`, and the manual
  REPORTED transition.

## Verification

`check-db-integrity.cjs` now also runs `verifyAssignmentFencing` on disposable PostgreSQL: server
fence, competing authority, stale task revision, prompt substitution, active-attempt manual
finalization, expired/terminal attempts and duplicate/immutable receipts. Producer fence remains
installed throughout. **Not yet implemented:** the command-time authorization service (current
membership/consent/writability intersection), a two-connection Jest concurrency suite, and the
manual/E2E lifecycle on real routes. These are the next bounded step and are not claimed.
