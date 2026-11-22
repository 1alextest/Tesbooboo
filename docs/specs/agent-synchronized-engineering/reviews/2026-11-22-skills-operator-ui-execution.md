# Skills governance — native operator UI execution and acceptance contract

**Status:** proposed implementation slice; not acceptance evidence or production authorization. **Date:** 2026-11-22. **Owner:** existing D-14 / QA Standards & Playbooks and KB governance; no new canonical specification. Reconcile accepted decisions into ASER's existing eight normative files. This document records bounded engineering execution and falsifiers, not an additional normative spec.

## Source-grounded starting point

- PR #201 (closed) implemented V159, KB-backed project Skill identities/versions/assignments, `src/skills/skills-governance.ts` (deterministic, project-scoped resolver), pinned requirement/case/link review and atomic apply, exact-version requirement approval, coverage readback and a task-review Apply button. Reported CI includes 23 checks green at `a2e2e23e` and an isolated database/API/UI journey. **This is not the full Skills Library/assignment UI or production acceptance.**
- PR #199 remains a **draft** separate governed Skill resolver foundation. Its unratified S0/root-policy/approval-quorum decision and distinct helper must not silently replace the PR #201 owner or be treated as approved authority.
- PR #155 is the draft release PR, separate from Skills UI acceptance.
- Canonical subordinate integration view: `docs/specs/agent-synchronized-engineering/skills-governance.md`. Review routes, APIs and auth against their actual source before implementation.

## Desired outcome

The authorized human project owner sees real Skills and their immutable versions inside the existing **QA Standards & Playbooks** settings, can review and approve an exact eligible version, and can assign/revoke its activation for explicit project/module/subtype/operation. A coding agent can then stage a native requirement, Draft test case, and exact-revision link; the human reviews and applies the pinned bundle; readback shows exact Skill assignment/version/digest, human approval/activation/apply receipts, resulting native records, and evidence-aware coverage. Agent-bearer tokens must be unable to approve, assign or revoke, even when issued by an owner.

## Required source and decision discovery

Before code, inspect the existing UI navigation, KB identity/version services, V159 schema, REST/MCP tools and direct writers, `src/skills/skills-governance.ts`, task-review panel, user/session authentication and DB transaction boundaries. Document every writer that can mutate protected artifacts; do not protect only one convenient endpoint. Obtain or surface the **unresolved S0 governance decision** (trusted role/authority, root skill and approval quorum) as a blocked decision. Do not guess a project policy, self-approve a root Skill or let a candidate become active via preview.

## Native UI behavior

1. **Skills Library** nested within the existing D-14 surface. Search/filter genuine records, show stable ID, purpose, KB provenance, visibility, supported contexts, immutable version chronology, version content digest, candidate/approved/revoked status, approval receipt, and effective assignment counts. Display missing/unavailable data honestly.
2. **Effective Skill inspector** resolves through a server-owned project/context; show resolved assignments with exact versions and source, or separately show unassigned, conflicting, inactive/revoked, stale, unauthorized, and unknown conditions. Do not silently pick the newest version or use client-side inferred authority.
3. **Exact-version approval** requires verified interactive human authority, version/content hash, explicit decision, recorded actor/time and durable receipt. Make state/diff and consequence visible before the action; rejected/withdrawn candidates remain inspectable. Guard with server-side authorization, anti-replay and concurrency requirements, not `isHuman` headers or UI-only button disabling. If trust policy is unratified, provide view/preview only and a visible blocker.
4. **Assignment management** is a separately permissioned human-only subview. Assign/activate/deactivate/revoke exact approved versions for server-verified project/module/subtype/operation. Show effective interval, priority if supported, inherited rules, conflicts, before/after impact and history. Require explicit authorization and locking/expected revision in the same transaction as the mutation.
5. **Change review** reuses the current Zyra/requirements bundle review surface and exposes pinned Skills. On stale/missing/conflict states, permit reject/withdraw while preventing apply. Preserve the current reviewed version until a new human review. After successful apply, show the committed receipt, linked requirement/case/version and coverage readback.

## Independent end-to-end falsifiers

| Scenario | Expected verifiable outcome |
| --- | --- |
| Human with eligible interactive authority approves exact candidate version | Approved immutable KB snapshot plus actor/version/digest receipt read from DB |
| Agent, MCP token, owner-issued API token or forged `isHuman` tries approval/assignment | Denied; no approved version, assignment or receipt written |
| Human assigns approved exact version, agent stages requirement + case + link, human applies reviewed bundle | Persisted skill pin, immutable submitted requirement version, official Draft case and exact active link, one apply receipt |
| Human separately approves exact requirement revision | Approved snapshot/approved-version links without modifying earlier submitted history |
| Assignment changes after preview or while apply waits on task lock | Stale precondition; no official writes; candidate and review evidence retained |
| Candidate-only, inactive, revoked, expired, wrong-project or missing assignment | No effective Skill; precise non-success state and fail-closed write |
| Two matching assignments without approved composition | Conflict, never arbitrary selection |
| Wrong revision, unauthorized actor, forged session or cross-project request | Denied; no writes or leaked private provenance |
| Exact request retried | Original receipt returned; no duplicate requirement, case, link or approval |
| Valid run evidence bound to correct case approval revision | Authored / approved / executed / passing coverage shown distinctly; mixed PASS/FAIL or stale attempts not misreported |
| Keyboard-only / screenreader, loading, empty, denied, conflict and error UI | Accessible controls, stable focus, clear accurate state; no fake or hardcoded sample data |

Record real DB queries, authenticated HTTP/MCP requests, and isolated-stack UI screenshots/captures. Do not report mocks or static source inspection as E2E. If no isolated DB or independent reviewer is available, mark the associated acceptance **NOT RUN**.

## Integration and delivery obligations

- Update native Tesbo Requirements, linked Test Cases, internal/external User Manuals and Policies as applicable, Tasks/Issues and Files/Evidence via existing MCP if available. If not, record exact pending updates, never invent receipts.
- Reconcile normative decisions within the same eight ASER specification files; this document is a subordinate execution note.
- Run Red (premises/abuse), Blue (reuse), Green (cross-service seams), White (completeness), QA (lifecycle/concurrency), Security (trust and money boundaries), Grey (operator journeys), Purple (design truth), Graph (one-owner/relationships) and operability lenses; preserve their independently sourced findings and dispositions.
- Submit changes by PR into `development`, with current-head typechecks, lint, migration checks, database-integrity, API/MCP tests, isolated real UI E2E, required reviewer approval and separately documented merge eligibility. No direct `main` change, release promotion or production activation from this slice.

**Definition of done:** A human can perform the actual operator journey and independently read back immutable Skill/version/assignment/decision receipts plus linked requirement/testcase/coverage. Every fail-closed negative case has execution evidence. Without a ratified trust decision, accessible native MCP, or required exact-head review, explicitly report the remaining gate rather than calling the feature shipped.
