# ASER — Requirements v0.1

**State:** Draft for independent specification challenge. These are **proposed** requirements, not assertions that Tesbo implements them.

## R-ASE-01 — One change, many authoritative artifacts

When a project-bound agent or human initiates a feature/change/fix, Tesbo shall allow a single **Change Packet** to reference the originating user request/task, source binding, code revision, existing requirements, cases, documents, policies, defects, work items and verification evidence by **stable native identities plus specific revisions**. Packets are coordination metadata, not replacement artifact stores.

**Acceptance:** A reviewer follows change → requirement revision → approved or draft case → actual execution/evidence → code/PR without ambiguous IDs. A missing link is shown as missing, not fabricated.

## R-ASE-02 — Determine applicability, do not force updates

For each domain (requirements, test cases, manual/docs, policy/rules, work items/bugs, files/evidence), Tesbo shall record a disposition: `proposed`, `approved`, `published`, `unchanged`, `not_applicable`, `blocked`, or `deferred`, with a reason/evidence reference for non-update outcomes and owner/reason for deferrals.

**Acceptance:** A CSS-only correction can properly mark policy `not_applicable`; a changed permission rule cannot be silently marked `unchanged` without comparing applicable sources.

## R-ASE-03 — Reuse-first source reconciliation

Before proposing an artifact, the agent shall be able to list/search relevant project records and their version/status, inspect authority, compare existing sources and use **update existing** whenever the canonical record already exists. Unknown identity stays unresolved rather than creating duplicates.

**Acceptance:** Replaying an agent session or switching to a second agent does not create a second requirement/manual/case for the same stable source identity.

## R-ASE-04 — Native requirements

Tesbo shall support authoring, browsing and revising **native requirements** without an obligatory Jira/Linear/Notion connection. A requirement has stable identity; title/description; normative acceptance criteria; state; owning project; immutable reviewable revisions; rationale/actor/source; and typed links to cases, policies, work items, code changes and evidence. Use/extend existing Knowledge Base and Requirements surfaces, not a second wiki.

**Acceptance:** Create native requirement, create a revised criterion, view both revisions, link exact case to exact requirement revision, and see stale/missing coverage. An external ticket remains attributable to its provider and cannot be overwritten by a native update.

## R-ASE-05 — Correct traceability semantics

A typed requirement-to-test-case relation shall be different from `sourceRefs` (authoring citation), `jiraIssueKey`/other external ticket keys, a generated draft, an execution verdict and actual product coverage. Reporting shall expose these separately.

**Acceptance:** A draft case linked to a requirement must not count as approved/executed/passing coverage. Archiving a case preserves history and removes eligibility for current coverage according to policy.

## R-ASE-06 — Cases and verification

Agent-generated new/updated cases shall begin as reviewable candidates and pass through Tesbo's **existing case approval** before being counted as eligible for protected test runs. Preserve steps, expected results, postconditions, classification, technique, reviewer views, source provenance and edit revision. Reuse existing Model Studio when behavior models apply; never require model-first development.

**Acceptance:** Source code change proposes a negative-path case and a regression update; reviewer can accept either, reject either, and see exactly which persisted approved case changed. An unapproved case cannot enter an approved-only run through REST/MCP/automation.

## R-ASE-07 — Manuals and technical documents

Tesbo shall support versioned user-manual content with audience/screen/feature applicability, preserved document identity, section-level diff where feasible, reviewer status, and links to affected requirement/behavior. Use the existing Knowledge Base as canonical document owner. Distinguish observed/verified behavior from documentation inferred from code.

**Acceptance:** Updating a user-facing workflow proposes an update to its existing manual section, not a second manual. A purely backend refactor may document `not_applicable`.

## R-ASE-08 — Authority-backed policies and rules

A policy shall identify its normative authority, scope, invariant text, effective revision/date, status, predecessor, change reason, decisions and implementing rule/guard/test links. A semantic change creates an immutable successor; a correction to metadata is recorded and audited. The agent may propose, but only an authorized principal can approve/activate it.

**Acceptance:** A proposed agent policy cannot silently supersede an approved one; a conflicting concurrent policy revision is rejected, not last-writer-wins. A policy without enforceable controls is visibly marked unenforced, not implied to be enforced.

## R-ASE-09 — Decision / policy / rule separation

Tesbo shall distinguish (1) decision and rationale, (2) approved policy/invariant, (3) product rule/enforcement. Maintain typed, directional links and versions; any unsupported target is an explicitly unresolved edge, not a successful link.

**Acceptance:** Reviewer can answer who authorized a permission rule, which version applied to a prior run, how it was enforced and which paths/tests must be re-reviewed after change.

## R-ASE-10 — Work items and issues

A task/issue/change request shall support a general work-item lifecycle with owner, reporter, type, priority, status, blocked-on, PR/commit, related records and activity history. Extend the existing project task board/Zyra task review where structurally applicable; Bugs remain the defect owner. A Zyra testcase-generation task is not automatically the canonical task for implementation.

**Acceptance:** Fixing an existing defect updates the existing bug/work item; creating a new implementation task does not create a duplicate bug or invisible shadow board.

## R-ASE-11 — Files and evidence

The existing Knowledge Base files/evidence service shall support authorized agent references or uploads as needed, preserve file identity, ownership, hash, storage verification state and revision/retention semantics. A metadata row does not prove a binary exists; generated output does not prove target execution.

**Acceptance:** Missing/unretrievable bytes are surfaced independently of metadata; a mismatched tenant cannot download/link the file.

## R-ASE-12 — Delegation without authority escalation

One parent agent may call or delegate to specialized QA/BA/documentation/policy/task subagents. Tesbo shall attribute submissions to the actual authenticated principal and optional delegated actor, retain the same parent Change Packet, enforce per-role tool permissions, and prevent one domain's agent from unilaterally publishing another domain's approvals.

**Acceptance:** A policy-drafting subagent receives no implicit permission to approve policy; its output remains a candidate with provenance.

## R-ASE-13 — Safe retries and concurrency

Every multi-artifact proposal shall carry a stable idempotency key; mutation of existing records shall require a base version/editRevision and detect concurrent changes. Cross-service partial writes shall produce durable per-artifact success/failure receipts with deterministic reconciliation. No blanket claim of transaction atomicity across independent stores.

**Acceptance:** Duplicate MCP call creates no duplicate requirement or case; two agents revising the same requirement detect divergence; a failure after case creation but before manual update is safely resumable.

## R-ASE-14 — Source, test and release truth

Capture independently: observed source commit/revision, declared expected behavior revision, case approval revision, run selection, execution result, agent report provenance, evidence-byte validity, deployed target build evidence and reviewer sign-off. Do not conflate these states.

**Acceptance:** Code passing local/unit/E2E tests does not change a production-deployment verification status. If the target build is unknown, show it as unknown.

## R-ASE-15 — Agent instructions as portable trigger

Publish a short, app-agnostic `AGENTS.md`/`CLAUDE.md` rule that triggers applicable Tesbo updates for any development iteration, chooses the bound project securely, queries capabilities and existing records, respects authority/approval, records disposition of every domain, and closes with truthful links/gaps. Its content shall be phrased as general principles with context-sensitive decisions, not fixed Tesbo/Nesberry business answers.

**Acceptance:** Claude Code and a separate generic coding agent use the same project binding and can produce equivalent change-proposal receipts without hidden agent-specific state.

## R-ASE-16 — Enforced completeness signal

A PR/CI policy shall be able to verify that the change has a traceable packet and assessed artifact domains, or an authorized scoped exception, without requiring unrelated manual/policy edits. A prompt alone is not enforcement. CI shall independently verify refs, statuses and versions against Tesbo's authoritative API or an explicitly validated signed/exported receipt.

**Acceptance:** A change that modifies a governed rule but omits policy disposition is flagged; an absent/offline Tesbo connection yields `blocked`, not a false green check. The gate may initially be informational, with deliberate promotion criteria.

## R-ASE-17 — MCP/client compatibility

Tesbo shall expose capability/schema version and reliable deployed identity. Agent flow shall test tool availability and expected field contracts at runtime, and reject or degrade truthfully when the connected client cached an older catalog.

**Acceptance:** A source branch advertising a newer tool does not cause an agent connected to an older deployed 50-tool catalog to claim it used that tool.

## R-ASE-18 — Security, isolation and data stewardship

All reads/writes shall honor project/organization memberships, case approval roles, policy authority, KB ownership, token scope, active plan locks, confidentiality, input validation, audit logging and least-privilege uploads. The MCP facade shall call **native application services**, not update tables directly to bypass invariants.

**Acceptance:** Cross-project requirement link, stale update, unauthorized approval, attempts to forge source identity, and tool-call replay with modified payload are rejected and audited.

## R-ASE-19 — Change-impact and freshness

When the underlying source, policy, requirement or manual changes, the existing graph/change-review machinery shall identify affected linked artifacts and signal **review candidates** with freshness/provenance labels, including absent, uncertain and indirect links. A link is not proof of coverage.

**Acceptance:** Changing a requirement revision marks affected case mapping stale pending review; a change with no evidence-backed edge is not invented as a definite impact.

## R-ASE-20 — Observable work completion

The change packet shall contain an independently reviewable closeout summary: implementation status, applicable artifacts proposed/approved/published, actual tests run and results, untouched/unproven areas, blockers, approvals, and exact record/PR links. It must preserve unfinished work when the session ends or is handed off.

**Acceptance:** Another agent can resume from persisted Tesbo records, not ephemeral chat history, and does not treat proposals as final records.

## Scenario-based cross-domain acceptance suite

| Case | Input | Must prove |
| --- | --- | --- |
| ASE-E2E-01 | New feature, no prior requirement | native requirement draft, linked draft cases, manual candidate, work item; policy assessed; reviewer owns publication |
| ASE-E2E-02 | Fix existing regression | updates same requirement/case/bug identities, preserves history and actual run scope |
| ASE-E2E-03 | Policy-changing authorization fix | authority-backed policy proposal, linked rule/tests, blocked activation until authorized |
| ASE-E2E-04 | Cosmetic-only refactor | defensible `not_applicable` for manual/policy/requirements; no fake docs |
| ASE-E2E-05 | Two agents edit same record | optimistic conflict, no lost update, visible reconciliation |
| ASE-E2E-06 | Mid-batch write failure and replay | no duplicate artifacts, correct partial receipts and resumable state |
| ASE-E2E-07 | Wrong project token or role | denial, zero cross-project writes |
| ASE-E2E-08 | Agent calls missing/stale MCP tool | explicit blocked/degraded state; no claims of update |
| ASE-E2E-09 | Evidence metadata exists, bytes missing | separate evidence unavailable status; no false verification |
| ASE-E2E-10 | Source version differs from deployed app | local test truth remains separate from deployment truth |
| ASE-E2E-11 | KB synced external requirement | remains read-only, no native overwrite; correct external attribution |
| ASE-E2E-12 | Unapproved case added to run | prohibited by backend regardless of writer surface |
| ASE-E2E-13 | Policy proposal rejected | old policy head stays authoritative; rejection/history preserved |
| ASE-E2E-14 | One agent delegates four disciplines | same parent packet; separate contributors, permissions and review receipts |
| ASE-E2E-15 | Existing source record removed/renamed | stale/dangling relation detected; no silent remap |

**Exit criterion:** Actual authenticated disposable-project MCP lifecycle + native UI + backend/DB tests must pass against the same relevant commit. External agent catalog and target deployment identity require separate verification. Independent assurance teams must review the **spec** without guided findings; no team review is claimed here.
