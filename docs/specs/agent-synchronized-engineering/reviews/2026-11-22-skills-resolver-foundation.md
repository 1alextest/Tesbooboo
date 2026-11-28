# Governed effective Skill resolution — native-owner reconciliation

**Status:** PR199 repair candidate; production comparison baseline `f7cbdad5f485019d67b3a84dfbed01e954f17ac5`. Exact final composition and execution are recorded in the PR receipts. Native CI and distinct Independent/White review are required before integration. This note does not ratify S0 authority, role mapping, root approval or quorum.

## Existing owner and historical correction

PR201 merged native Skills profiles/assignments in migration V159, the production resolver in `Tesbo-Backend-Nest/src/skills/skills-governance.ts`, and protected requirement apply/approval in LegacyService. PR199 originally proposed an unused pure helper in `src/legacy/governed-skill-resolver.ts`. This continuation removes that parallel helper and its redundant impact-map entry from the proposed final delta, and repairs the actual production owner instead. No speculative inventory, authority schema or second Skills store is introduced.

The earlier helper's timestamp-only defect was demonstrated at its old source (one failed and sixteen passed; seventeen passed after repair). That historical result does not certify the native owner. PR201's existence also does not supply missing final-source reviews or ratify its authority choices retroactively.

## Bounded behavior

- Canonical pins bind the full assignment, immutable version/content digest and concrete target set. Observation time and display fields do not cause drift. A wildcard assignment may legitimately bind several different targets. Supplied digest headers must agree with their complete pinned body; valid historical ordering remains readable.
- A formerly resolved pin that loses an assignment is `SKILL_CONTEXT_STALE`, preserving the staged proposal and evidence, as required by canonical03 Skills§5. Initial absence is `SKILL_CONTEXT_UNAVAILABLE`; genuine ambiguity is `SKILL_ASSIGNMENT_CONFLICT`. Missing and conflicting target details remain available.
- Assignment overlap is checked symmetrically, including wildcard-after-exact. An ambiguous replacement rolls back its retirement and insertion together. No precedence winner is invented.
- One transaction-scoped project Skills advisory lock is acquired before domain and authority locks. Staging, effective reads, assignment mutations and protected apply/approval share it with KB document type/trash/restore and folder membership/cascade writers. Final resolution remains protected through commit. Current authority is refreshed after waits; the existing feature-specific role checks remain with their owners.
- Generic KB trash/restore/type transitions are refused while any assignment for that document remains active, including a legacy hidden or retagged document. Dedicated deactivation is required first. Ancestor folder cascades guard the final affected documents atomically. No-op restore and unchanged type remain no-ops; inactive candidates and ordinary KB operations remain usable.
- V160 permits only deactivation to recover an already-invalid active dependency. It does not relax immutable assignment identity/history or permit inactive-to-active mutation. Restoring an inactive Skill does not reactivate its old assignment; a distinct authorized assignment action is still required.

## Verification contract

The unchanged production resolver produced five failures and fourteen passes in discriminating unit regressions; the repaired resolver passes twenty-eight. Independent controlled-query probes executed the original wildcard-order, post-wait authority and generic API-token KB bypasses. Those probes establish actual application control flow, not PostgreSQL concurrency or deployed exploitability.

Existing database regressions and the requirements API acceptance owner cover native overlap rollback, stale pins, current membership, final-resolution/commit serialization, hidden-assignment recovery and history. Requirements API tests also cover human and API-token generic KB refusal, ancestor folder all-or-nothing behavior, ordinary/inactive recovery, and legitimate protected publication. Existing KB and requirement UI lanes remain part of native CI. Actual final-head results and complete original review methods belong in the PR receipts; written tests are not an execution pass.

No local/shared/production database test or production deployment is authorized by this note. Disposable existing CI is the runtime proof boundary. No native Tesbo MCP synchronization or personal skill installation is claimed.

## Remaining authority boundary

S0 root approval, exact assignment/deactivation role mapping, independent-approver/quorum rules and broader promotion policy remain unresolved until an authorized human decision is recorded. This repair preserves the existing implementation boundaries while correcting deterministic pin truth, loss-of-authority handling, overlap, publication consistency and generic KB bypasses. It does not declare the complete Skills governance model accepted.
