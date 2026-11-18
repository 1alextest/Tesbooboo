# Agent-Synchronized Engineering Records (ASER) — Proposal

**Status:** Proposed product contract; **not implemented, approved, deployed, or independently reviewed**.
**Target repository/branch:** `1alextest/Tesbooboo` / `development`.
**Purpose:** Keep the code and its relevant engineering records evolving together whenever a human or coding agent makes an application change.

## User outcome

A coding agent implementing a feature, defect fix, refactor, or operational change must be able to use **Tesbo MCP** to discover existing authoritative records and, **where applicable**, prepare versioned changes to:

1. **Requirements** — behavior and acceptance criteria, including requirement-to-case traceability.
2. **Test cases and verification** — cases, test techniques, test suites, executions and supporting evidence.
3. **User manuals and technical documentation** — context-specific, user-observable instructions, API notes and operational guidance.
4. **Policies, decisions and enforceable rules** — historical authority and what must stay true; no self-approval.
5. **Tasks, defects and project issues** — owners, lifecycle, acceptance, blockers and remaining work.
6. **Files and evidence** — immutable references to uploads, reports and observations when applicable.

A single agent may perform these activities or delegate to specialist agents. The records, permissions, history and reviews belong to **Tesbo's native services**, not to the coding model or a new parallel assistant. Extend **Zyra** as the human-facing coordinator.

**Completion is not defined as "all six records were changed."** Each domain must be assessed; valid outcomes include `updated`, `unchanged-with-evidence`, `not-applicable-with-reason`, `proposed-awaiting-approval`, `blocked`, and `deferred-with-owner`. Never create a meaningless document or ticket to satisfy a checklist.

## Source-backed reuse inventory (2026-11-18)

| Area | Tesbo existing owner | Specific extension |
| --- | --- | --- |
| Requirements | Jira/Linear/Notion test-case keys; Requirements/coverage UI; Knowledge Base `requirement_note` documents; change-aware cache graph | First-class **native requirement identity + version/acceptance criteria + typed case relation**. An MCP `sourceRefs` citation is not coverage. Keep external integration caches as external owners. |
| Test cases | Native case/suite/version/history and MCP authoring; run lifecycle; Model Studio drafts and graph-review links | Draft-by-default agent changes and approved-only publication/eligible run membership; source/requirement version pins and stale-change review. |
| User manuals | Knowledge Base document, folder, version and MCP read/write services | A user-manual document kind/section contract, scoped edits, previews, review, and UI access; never start another document store. |
| Policies | Knowledge Base plus approval/history and existing review/audit substrate | Typed, immutable, authority-backed **policy revisions** with decision/rule/enforcement links, effective state, change impact and approval. Reuse the Nesberry Policy Ledger *principles*, not its filesystem as Tesbo's database. |
| Tasks/issues | Zyra task board/activity/review, Bugs and integrations | General work items/issue tasks integrated into existing board with type-specific lifecycle; Zyra generation task remains a subtype or linked activity, not a competing board. |
| Files/evidence | Knowledge Base files, uploads, evidence/attachments, storage | Project-safe MCP or REST upload adapter, hash/byte existence truth, provenance, retention and permissions; no duplicate file service. |
| Cross-record change | Committed graph history, Zyra change review/notifications, native project authorization | One traceable **Change Packet** linking existing owners and their revisions; agent-synchronized proposals, idempotent reconciliation, review and CI gates. |

The current `development` MCP source declares **58 tool names**, including native case and KB-document writes; a prior external client reported a **50-tool deployed catalog**. Source inspection alone does not prove client visibility or the deployed contract. Require a fresh deployment/tool fingerprint before an external pilot.

## Portable lessons from Nesberry (research input, not code copied)

- **Policy triad:** distinguish *who decided and why*, *what invariant/version is binding*, and *how a rule is enforced*. Nesberry's source is `NesberryEnterprise/Nesberry/.kiro/specs/policy-ledger/` and `docs/policies/README.md`; foundational phases are built, later integration/impact phases remain incomplete.
- **Immutable meaning, versioned change:** a semantic policy change creates a successor revision; audit history cannot be silently rewritten.
- **Avoid write hotspots:** Nesberry's per-issue files fixed parallel editing of a shared issue log (ISS-7166). In Tesbo, instantiate the principle as per-record version locking and conflict-aware writes; do **not** copy a repository issue-file schema into the database.
- **Reuse canonical owners:** decisions, policies, rules, tests, issues, documentation, code and evidence are distinct truths connected by typed relationships. A traceability projection is not an authoritative duplicate.
- **Principle distillation:** generalize the underlying *why* and re-apply based on Tesbo's actual context, ownership and source evidence.

## Non-negotiable boundaries

- Never create a shadow test-case, requirements, KB, task or policy owner merely to feed agents.
- Never grant an agent authority to approve normative decisions or bypass existing QA reviewer controls.
- Do not equate **drafted**, **linked**, **CI-pass**, **target-tested**, **evidence verified** and **approved**.
- Persist source/project/commit/revision provenance; never infer a target deployment version from a local commit.
- Reject project-crossing references and stale writes. On partial failure record exactly what persisted and allow safe recovery.
- The target application's `AGENTS.md`/`CLAUDE.md` is a **trigger and operating guide**, not a security boundary or proof of completion.

## Deliverables in this proposal

- [Requirements and falsifiable acceptance criteria](requirements.md)
- [Reuse-first technical design](design.md)
- [Implementation and independent assurance plan](implementation-plan.md)
- [Portable agent-rule template](AGENT_RULE_TEMPLATE.md)

No application code, schemas, migrations, MCP catalog, user data or production configuration is changed by this documentation PR.
