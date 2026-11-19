# Agent-Synchronized Engineering Records (ASER) — Integrated specification view

**Canonical home:** Tesbo specification package revision **1.4.28**, the same eight files `00_README.md` through `07_UI_DESIGN_TASKS.md`. This repository file is a subordinate integration view, not a ninth normative specification. Current requirements, owners, contracts, implementation gates and proof obligations are reconciled in those eight files. This is a **proposed design; NOT FROZEN and not an implementation/deployment claim**. P-07 human publication, P-14 eight-file ownership and P-18 project MCP consent remain unchanged. The independent review and its evidence limits are recorded in [the existing assurance record](reviews/2026-11-18-charter-guided-spec-challenge.md).

**Status:** Proposed integration design in canonical revision 1.4.28; NOT FROZEN. Existing native capabilities and the new integration requirements have different implementation maturity. Actual independent review receipts are separate from runtime, deployment and human approval evidence.
**Target repository/branch:** `1alextest/Tesbooboo` / `development`.
**Purpose:** Tesbo is the shared human-and-agent engineering assurance and delivery platform: help QA, BA, developers, PM, policy/security reviewers and release owners understand what AI agents did, reconcile what an application should do with what actually changed, verify real behavior, and release faster with defensible evidence. Keep the code and its relevant engineering records evolving together for every relevant change.

## Product positioning and guiding outcome

Tesbo **complements coding agents and IDEs** (Kiro, Claude Code, OpenCode, Codex) rather than replacing them. Its native case/run/bug, Knowledge Base, requirements, Zyra, graph, activity and existing project workflows are foundations for one connected cross-role experience. Test-management products such as Qase and TestRail are direct QA-category competitive benchmarks; GitLab, Polarion and other delivery/ALM platforms are sources of reusable methods and integration targets, not assumed direct substitutes.

**North-star outcome:** A human who did not watch the coding session can open Tesbo and accurately answer: what was requested and authorized, what the agent actually did or only reported, what requirements/policies it may affect, what tests really ran against which build, who must act next, and whether the release has sufficient evidence for an authorized decision. Neither release speed nor a high case count is a guarantee of software correctness.

The primary unit of coordination is an **application change moving from intent and implementation to human review, verification, release and post-release outcome**. Role-specific views should be projections on the same canonical objects and versioned graph, not replacement BA/PM/QA/policy stores. A solo developer may follow a lightweight path while an organization activates stronger policies without weakening server-side permissions.

**Five external patterns are implementation inputs, not new subsystems:** Kiro-style event hooks (advisory); GitLab-style witnessed agent activity/audit; Qase-style compact context and composite MCP workflows; Spec Kit-style cross-artifact consistency analysis; DORA-style separate delivery-throughput and instability measurement. Each must be reconciled with Tesbo's current source and existing eight authoritative specifications before build, with executable negative acceptance tests.

## User outcome

A coding agent implementing a feature, defect fix, refactor, or operational change must be able to use **Tesbo MCP** to discover existing authoritative records and, **where applicable**, prepare versioned changes to:

1. **Requirements** — behavior and acceptance criteria, including requirement-to-case traceability.
2. **Test cases and verification** — cases, test techniques, test suites, executions and supporting evidence.
3. **User manuals and technical documentation** — distinct internal staff/admin/support/developer/operations guidance and external end-user/partner/public instructions, with separate audience and access control.
4. **Policies, decisions and enforceable rules** — internal governance and application rules, external-facing policies and externally mandated obligations, keeping audience, exposure and authority distinct; no self-approval.
5. **Tasks, defects and project issues** — owners, lifecycle, acceptance, blockers and remaining work.
6. **Files and evidence** — immutable references to uploads, reports and observations when applicable.
7. **Skills Library and assignments** — versioned, searchable skills governing each module/subtype; agents read approved active assignments and may submit **new candidate skills or successor versions** but never edit existing versions, approve/publish, activate/deactivate, or reassign effective bindings through MCP. A protected meta-skill governs creation of skills.

A single agent may perform these activities or delegate to specialist agents. The records, permissions, history and reviews belong to **Tesbo's native services**, not to the coding model or a new parallel assistant. Extend **Zyra** as the human-facing coordinator.

**Completion is not defined as "all seven domains were changed."** Each domain must be assessed. Applicability (`change_required|unchanged|not_applicable|undetermined`), each artifact operation’s review/apply state and work disposition (`active|blocked|deferred|resolved`) are separate; the canonical API contract defines their aggregation. Human labels such as “Updated”, “Awaiting review” and “Deferred” are derived from those facts. Never create a meaningless document or ticket to satisfy a checklist.

## Source-backed reuse inventory (2026-11-18)

| Area | Tesbo existing owner | Specific extension |
| --- | --- | --- |
| Skills governance | Canonical T-422 / D-14 QA Standards & Playbooks and FR-106–113 guide/asset bindings; project KB identity is reusable, coalesced edit history needs a governed snapshot extension | Human-governed effective skill assignments, immutable skill revisions, candidate-only MCP skill authoring, bootstrap meta-skill, per-artifact revision pins and independent evaluation. |
| Requirements | Jira/Linear/Notion test-case keys; Requirements/coverage UI; Knowledge Base `requirement_note` documents; change-aware cache graph | First-class **native requirement identity + version/acceptance criteria + typed case relation**. An MCP `sourceRefs` citation is not coverage. Keep external integration caches as external owners. |
| Test cases | Native case/suite/version/history and MCP authoring; run lifecycle; Model Studio drafts and graph-review links | Draft-by-default agent changes and approved-only publication/eligible run membership; source/requirement version pins and stale-change review. |
| User manuals | Knowledge Base document, folder, version and MCP read/write services | Internal and external audience/subtype skill bindings, scoped edits, previews, review, and UI access; never start another document store. |
| Policies | Knowledge Base plus approval/history and existing review/audit substrate | Distinguish internal application/governance and externally-facing/externally sourced policy contexts; typed, immutable, authority-backed **policy revisions** with decision/rule/enforcement links, effective state, change impact and approval. Reuse the Nesberry Policy Ledger *principles*, not its filesystem as Tesbo's database. |
| Tasks/issues | Zyra task board/activity/review, Bugs and integrations | General work items/issue tasks integrated into existing board with type-specific lifecycle; Zyra generation task remains a subtype or linked activity, not a competing board. |
| Files/evidence | Knowledge Base files, uploads, evidence/attachments, storage | Project-safe MCP or REST upload adapter, hash/byte existence truth, provenance, retention and permissions; no duplicate file service. |
| Cross-record change | Committed graph history, Zyra change review/notifications, native project authorization | **Change Packet is the view of the existing FR-115/T-455 changeset**; proposals use FR-027–037, impacts FR-119, typed relationships FR-118/T-426 and observations current graph history. No separately writable packet completion or approval. |

The inspected source at `0c54b8ed28c9dec51ed0ca3bbb3cd3b7b8ab12d8` declares **58 tool names**, including native case and KB-document writes; a prior external client reported a **50-tool deployed catalog**. Source inspection alone does not prove client visibility or the deployed contract. Require a fresh deployment/tool fingerprint before an external pilot.

## Portable lessons from Nesberry (research input, not code copied)

- **Policy triad:** distinguish *who decided and why*, *what invariant/version is binding*, and *how a rule is enforced*. Nesberry's source is `NesberryEnterprise/Nesberry/.kiro/specs/policy-ledger/` and `docs/policies/README.md`; foundational phases are built, later integration/impact phases remain incomplete.
- **Immutable meaning, versioned change:** a semantic policy or skill change creates a successor revision; audit history cannot be silently rewritten.
- **Skill methodology reuse:** Existing Nesberry and Tesbo skills/versioning work illustrates a portable core + project adapter, principle-based generalisation, version-specific provenance and objective evaluation. Copy no Nesberry-specific business authority into Tesbo.
- **Avoid write hotspots:** Nesberry's per-issue files fixed parallel editing of a shared issue log (ISS-7166). In Tesbo, instantiate the principle as per-record version locking and conflict-aware writes; do **not** copy a repository issue-file schema into the database.
- **Reuse canonical owners:** decisions, policies, rules, tests, issues, documentation, code and evidence are distinct truths connected by typed relationships. A traceability projection is not an authoritative duplicate.
- **Principle distillation:** generalize the underlying *why* and re-apply based on Tesbo's actual context, ownership and source evidence.

## End-to-end quality and product-learning contract

A coding agent may begin without a formal specification; it still must not turn observed code into an automatically approved requirement. Use project source binding, graph observations and approved requirement/policy history as separate evidence planes. A source change can be observed through an optional agent hook, source-provider event or CI integration; **missing capture** must be reported as stale/unknown, not silently treated as no change.

Tesbo distinguishes trusted server-observed events, externally authenticated event receipts, agent self-reports, inferred impacts, and unobserved activity; only show “agent did X” at the evidence tier actually available. Sensitive prompt/tool data require permissioned retention and redaction. Governed multi-operation MCP calls may make work easier but must reuse existing native services and preserve per-item authorization, idempotency, partial-result truth and review.

The shared Change Workspace and release-readiness view must distinguish case drafted, approved, selected, executed, passed on a known build, deployed and post-deployment verified. Show blockers and accepted risk; release approval is an explicit accountable decision, not a generated green badge.

Measure project outcomes in two axes: delivery throughput and instability, plus human comprehension, review burden, change-to-record freshness, false claims, duplicated records and defects escaping to production. Metrics are descriptive and baseline-aware; no causal success claim without comparison.

## Non-negotiable boundaries

- Never create a shadow test-case, requirements, KB, task or policy owner merely to feed agents.
- Never grant an agent authority to approve normative decisions or bypass existing QA reviewer controls.
- MCP agents may read authorized candidate content as untrusted data for review, but effective governing instructions come only from assigned approved skill versions. Agents may create additive skill candidates/proposed successors. **Never** allow agent/machine credentials to edit existing skill versions, approve/publish skill candidates, alter activation, precedence or module assignments—even when the token belongs to a human administrator. A skill candidate is not an instruction authority.
- Skills-authoring meta-skill is human-governed, with nonrecursive root protection; active/inactive and approved/unapproved are separate. Conflicting mandatory skills block governed authoring rather than causing arbitrary selection.
- Do not equate **drafted**, **linked**, **CI-pass**, **target-tested**, **evidence verified** and **approved**.
- Persist source/project/commit/revision provenance; never infer a target deployment version from a local commit.
- Reject project-crossing references and stale writes. On partial failure record exactly what persisted and allow safe recovery.
- The target application's `AGENTS.md`/`CLAUDE.md` is a **trigger and operating guide**, not a security boundary or proof of completion.

## Deliverables in this proposal

- [Requirements and falsifiable acceptance criteria](requirements.md)
- [Governed Skills Library, active assignments, protected meta-skill and test matrix](skills-governance.md)
- [Reuse-first technical design](design.md)
- [Implementation and independent assurance plan](implementation-plan.md)
- [Portable agent-rule template](AGENT_RULE_TEMPLATE.md)
- [Preliminary charter-guided specification challenge and independent team-run status](reviews/2026-11-18-charter-guided-spec-challenge.md)

No application code, schemas, migrations, MCP catalog, user data or production configuration is changed by this documentation PR. The same eight canonical files now contain the 1.4.28 integration amendment and complete requirement/owner/task/proof crosswalk. These six repository files remain subordinate views. [The prior governed-asset evolution review](../../reviews/governed-asset-evolution-reconciliation.md) and earlier source receipts retain their historical scope; they do not override the current amendment or establish implementation/freeze.

## Current integration details

| Truth / label | One authoritative owner and canonical work | Integration decision |
| --- | --- | --- |
| Change Packet / Change Workspace | FR-115/T-455 changeset + immutable events; FR-119/T-457 impact obligations | Packet is a composed view of `changesetId`, not another mutable completion/approval entity. Source observations may create or relate to a changeset; graph capture alone never accepts behavior. |
| Candidate and human decision | FR-027–037, T-301–306 shared staging/review/apply | Stable logical operations and immutable revisions; exact selected dependency-closed apply. A candidate is not a native Draft row. |
| Native requirements / criteria | Existing project KB identity and typed governed content, surfaced by Requirements; FR-110/112, work package A | Extend immutable submitted/accepted revision and criterion identity, never copy a second wiki. External provider requirements retain provider identity and provenance. |
| Cases / definitions / approval | Native Test Cases, existing version and approval services; T-103/104/305/430 | Extend shared principal and exact semantic revision checks across all writers. Custom fields, reference images and material relationship dependencies participate in the reviewed manifest. |
| Runs / actual attempts / results | Native Runs and execution owners; T-207/433/459 | Selection, actual observation and reviewed correction are distinct. Preserve original attempts and frozen definitions. A Bug link cannot supply execution evidence. |
| Manuals / decisions / policies | Project KB content/version owner + shared review; work package B / T-438 | Typed governed snapshots, authority and effectivity metadata; audience/exposure/authority remain independent. Ordinary draft autosave may continue. |
| Skills Library / Assignments | T-422 / D-14 QA Standards & Playbooks; FR-076/077/106–113; T-448–453 | Extend the same guide/asset identity, workspace/project bindings and one effective-method resolver. Library and assignment controls are subviews of existing settings, not a new top-level app. |
| Global pack versus local guidance | Platform-approved guide revision, workspace pin, project KB overlay | Platform authority does not live in a fake project. Reuse narrow existing bindings; a new relation is justified only for an unrepresented invariant. No per-project core copies. |
| Tasks / work / generation jobs | Existing Tasks service/shell and planned T-201/203/206/306 extensions; Bugs own defects; impacts own QA obligations | General work has a typed task identity, assignee and its own completion criteria; generation completion does not close it. Link distinct independently accepted work rather than overloading one `done` flag or copying impact state. Exact current table fit remains a source/implementation gate. |
| Files / report evidence | Existing storage, KB Files and native attachments; T-204/205/443 | Immutable references and verified bytes where available; no new upload service. Raw ingestion is not automatically authored content. |
| Typed relationship / trace | FR-118/T-426, extended with current graph/native link owners | One typed relationship owner; history pins exact revisions/occurrences. Source citations, accepted coverage mappings and observed graph edges retain distinct meanings. |
| Source binding / capture | Existing `project_source_bindings`, graph capture/history and provider adapters; T-455/456 | Extend stable binding/configuration history and multi-source capability. Preserve current server-provisioned checkout boundary and historical capture fingerprints. |
| Agent activity / session | Existing Zyra sessions/tasks/activity and authenticated receipts | Timeline is a permission-filtered projection; no separate assistant or implied record of unobserved tool use. |
| Release decision / deployment / readiness | Shared human review/audit records a typed decision; provider owns deployment facts; T-461 reports derive readiness | Fixed candidate/evidence/risk scope per decision. Readiness is computed, never another writable release-authority status. One source change may participate in several independently decided releases. |

The complete 48-row requirement/design/task/proof crosswalk, all 75 planned ASER scenarios and the 49-journey inventory are in the existing implementation-plan view and canonical 05. Canonical 02/07 owns the concrete role/recovery and existing-surface contract; canonical 04 owns ASER-C01–06. The same exact contracts are incorporated in the eight-file 1.4.28 package; none asserts runtime completion.
