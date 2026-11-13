# Tesbo — Governed Asset Evolution: Design Reconciliation Review
**Review proposal v0.5 · NOT A NINTH CANONICAL SPEC · 2026-11-12**

> **Noncanonical review artifact.** The recovered Tesbo `00_README.md` P-14 requires exactly the **eight existing canonical Markdown specifications** (`00_README.md` through `07_UI_DESIGN_TASKS.md`). The approved original package is the working authority. This document is a consolidated proposal/source-reconciliation receipt, not a ninth competing requirements, design, task or QA source. Any accepted changes must be made *in place* in the eight originals with approved IDs and review.
>
> **Revision log:** v0.1 initial asset/version/change-set contract; v0.2 strengthened field/relationship/legacy history and first-party Copilot integration; v0.3 charter-lens desk review, Copilot session continuity, temporal provenance and security/Graph gaps; v0.4 original Tesbo nine-role reconciliation, separate simulation lane, and outstanding exact-client/identity gates; v0.5 read all eight indexed Tesbo 1.4.18 files, reconciled owner overlaps and an approval-mode conflict, and routed this file out of canonical specs. Each remains a **proposal** until explicit owner decisions and independent evidence gates are met.

**Status:** Noncanonical design/review proposal only. Tesbo's eight original v1.4.18 specs remain authoritative until explicitly amended. Not a migration, implementation authorization, approval-policy change, or Phase 2 sign-off.

**Scope:** Independently versioned test cases, requirements, and testing skills; granular field-and-related-artifact history; working drafts; auto/manual approval; version-aware relationships, run provenance, and first-party AI Copilot access across the same governed domain services. Applies across projects and applications. Nesberry is an initial application binding, not the generic data model.

## 1. Problem and principles

Each asset evolves independently. TC-A can be published at version 4 after three meaningful releases while TC-B remains published at version 2 after one. A requirement or skill has its own version stream. No project-wide version counter is imposed.

An asset consists of a stable logical identity, one current published revision, zero or more immutable historical published revisions, and potentially multiple private/shared working drafts and proposed changes. Do not confuse an asset content revision with a workflow event, an artifact upload, a linkage update, or a test execution.

**Owner decisions captured so far:**
- Every field must be auditable, not just a manually selected subset. Include tags, custom fields, relationships, files, screenshots, evidence associations, ownership, and metadata where material. Track operational/system-only changes too, while distinguishing them from semantic published content revisions.
- Show field-level old/new differences and the attributable change context.
- The **latest approved published revision is the current published revision**. Everything not approved for publication is draft/proposal/rejected history. Older published revisions remain historically approved, not retroactively renamed drafts.
- Independent optimistic concurrency protection is required.
- Evaluate connected requirements/cases/skills and all downstream consumers before promotion; no automatic claim that every linked case must change.
- Past execution results and version bindings must never be rewritten by later edits. Historical facts enable trend/impact analysis.
- Restoring an old version creates a new published revision, preserving intermediate revisions.
- Record human/agent actor, governing skill revision, reason and verifiable change evidence.
- Existing records need a truthful baseline, not invented earlier history.
- Two application modes: automatic application **within explicit authority**; manual review/approval before publication. Mode selection is not a substitute for authorization, concurrency checks or safety.
- Skills can instruct agents how to author and validate requirements and cases, as well as how to conduct testing. No skill may invent authority or override an external source.

**Design posture:** Reuse Tesbo's existing records, Knowledge Base, history triggers, activity/audit logs, Zyra drafts/reviews, and MCP. Avoid parallel test-management entities and a new microservice.

## 2. Model: identity, versions, draft iterations and audit

### 2.1 Asset identity and published versions

Each asset type (testcase, requirement, skill) uses a stable \`assetId\`, existing project/workspace scope, \`assetType\`, \`currentPublishedRevisionId\`, and independently monotonic *published* \`versionNumber\` beginning at 1. Expose \`TC-A v4\` rather than a global sequence. A published revision is an immutable canonical snapshot with SHA-256 content hash, creation/publication time, actor, source identity/revision, approval receipt or authorized automatic-policy receipt, base revision and change-set ID.

The first published version can be approved from a draft. No draft, rejection or no-op increments the published version. If an asset is newly created as Draft, it has no published version yet; display \`Draft (unpublished)\`, never falsely \`v1 approved\`.

Keep distinct:
1. **Published revision history** — immutable full snapshots (including linked sub-objects at that point), approved historical states.
2. **Draft iteration history** — individually attributed saves/changes to an unpublished proposal, using draft IDs and draft iteration sequence (D1, D2, ...); no published version consumed.
3. **Activity/audit history** — every field-affecting and consequential operational event, including approval decisions, linkage events, attachments, restores, access policy changes, computed fields, background enrichment and execution association. All changes must be observable; no-op write is recorded only if relevant as an attempted operation and must not fabricate a new content version.
4. **Execution history** — immutable run/attempt/evidence records pinned to approved asset revision IDs, even if the current asset changes, is archived or restored.

For *every field* specify ownership and significance. Compare canonical typed values rather than raw JSON serialization ordering. Tag sets, custom-field entries, ordered steps, evidence/attachment sets, source links and nullable values need typed diff adapters. Preserve explicit absent vs null vs empty semantics. Track before/after on removal and soft-deletion; never erase the history when links or attachments are removed. Content hash covers all fields defined as part of the published snapshot, including related references, but does not include volatile timestamps or embedding/cache writes.

### 2.2 Drafts and approval

The published version remains readable and authoritative while work proceeds on a draft. Multiple drafts can branch from the same version but cannot both silently publish. Draft iterations are immutable events while the mutable working draft can move ahead. Publishing requires rechecking the current head/relevant relationship heads.

Proposed workflow: \`working_draft → submitted → needs_changes | rejected | approved/published\`; \`submitted\` freezes the reviewed payload/hash. A reviewer request for changes creates a further draft iteration, **invalidating prior approval** of the earlier payload. Rejected proposals remain attributable. Approved/published is a transaction, not a mutable status on an old snapshot.

**Automatic mode:** Agent can propose and publish only where a project/workspace policy grants a narrow combination of asset type, field set, operation, environment, risk tier and scope. Policy has version, authority, expiry and actor identity; the exact proposal, its base revision, link-impact report, and enforcement receipt are stored. Application uses the *same* validation/transaction path as human approval. Auto mode does not mean "any write". Policy can disable itself, require two-person review or mandate human approval for high-risk changes.

**Manual mode:** Agent writes a pending proposal. Human compares granular diffs and impacted relationships, can approve/reject/request changes; no active published content changes before approval. A reviewer cannot approve a payload that changed after review; platform may prohibit self-approval for governed executable skills and sensitive requirements.

Candidate protective default (requires owner sign-off): Manual by default; human approval for publishing or altering executable skill policies and for materially changing an authoritative requirement or its semantics, even if ordinary case edits allow bounded auto. Agents may prepare draft proposals without publication permissions.

### 2.3 Conflict and restoration

Every proposal has \`basePublishedRevisionId\` and \`baseDraftIterationId\` (if relevant), plus an expected graph-head token for affected relationships. Apply under transaction + appropriate row locks; if any expected head differs, respond \`409 STALE_BASE\` with non-secret conflict context. Rebase with explicit user/agent reconciliation, never last-write-wins or silent field loss. Two proposals that alter disjoint fields still require controlled merge and revalidation of linked invariants. Policy changes while pending invalidate auto-approval.

Restore copies the selected past revision into a **new draft**, revalidates current links/constraints, then publishes the next sequential version following the same review policy. Original version IDs and time order never change. Archiving/unarchiving does not delete version/audit history.

## 3. Requirements, source authority and dependent relationships

A requirement may be Tesbo-owned or an externally authoritative item (Jira, Linear, Notion, Git repository specification, policy document). Store a stable identity for the logical obligation plus source reference, immutable upstream revision/commit/content hash, authority level, effective interval and provenance. Tesbo may capture mirrored historical revisions and local proposed interpretations, but **must not claim to have amended an externally owned requirement** without verified upstream change/authorization. A new upstream version can trigger impact review even if Tesbo cannot write upstream.

Test cases link to stable logical requirement IDs; the relationship has its own ID/history, validity assessment, relationship type and coverage state (e.g. validated against revision X, impact review required, no longer applicable, unknown). Do not force a new test case content revision for every link-only event, but record a relationship revision and include the relationship state in frozen baselines/coverage projections as appropriate.

When a requirement changes:
- Traverse **upstream sources and downstream consumers**, including linked cases, suites/plans, frozen run manifests, defects, skills, reports and external sync/public projections as applicable; publish a bounded *impact report*, not an invented global guarantee.
- Propose specific case/link modifications where necessary. Some linked cases remain valid; others need reassessment or new cases. Do not automatically break historical valid links.
- Classify each affected edge: \`still_valid\`, \`needs_review\`, \`no_longer_applicable\`, \`unknown\`, with oracle/evidence and last assessed requirement/case revision IDs.
- Material changes spanning several assets may form one \`changeSet\` with multiple proposed revisions and relationship operations. Promotion is atomic over Tesbo-owned rows and audit/outbox writes within one database transaction. **External systems cannot share the same transaction:** use an explicit prepared/confirmed/uncertain external handoff state and reconciliation; never represent multi-system atomicity.
- Prevent a new published requirement from causing prior executions to be silently counted against the new version. Reports distinguish current coverage, historically validated coverage and current coverage awaiting impact assessment.

No blanket graph rewrite: exact link IDs, source references, and prior bindings are preserved. A missing edge/consumer inventory means \`impact_incomplete\`, not "no impact".

## 4. Run provenance and freeze

A manifest-managed run pins: project, lane, target/build/environment, fixtures, authorization/budget, scope/exclusions, skill revision, each requirement revision and each planned test case published revision plus the linked relationship assessment. Existing \`cycles\`, \`cycle_items\`, \`executions\` remain the operational records.

A planned execution stores its frozen testcase/requirement/skill revision IDs and snapshot hashes; current edits cannot alter its interpretation. The current V119 field snapshots are useful but not the same as explicit approved revision bindings; V119 backfilled historical rows from the currently available testcase row at migration time, so they cannot be presented as verified historical-at-execution snapshots. New discovered cases during execution remain \`supplemental\` until reviewed; existing automation ingest may attach cases and must not silently grow a frozen planned denominator. Preserve all attempts, previous failures, evidence, blocked, inconclusive and tool errors separately from the eventual verified product verdict.

## 5. Skills as governed, versioned instructions

Skills describe:
- **Identity and applicability:** scope, purpose, asset/journey type, allowed engines and capability prerequisites.
- **Authoring contract:** field requirements, how to derive an independent oracle, how to write test steps and requirements, examples and forbidden assumptions.
- **Relationship contract:** sourcing, link creation/update, impact checks, coverage revalidation, and what must never be auto-published.
- **Execution/evidence contract:** observations, verification, failure vs tool error, redaction and limitations.
- **Evaluation:** regression fixtures, counterexamples, expected outcomes and calibration results; \`IMPLEMENTED_UNVALIDATED\` is distinct from demonstrated improvement.

Skills may be derived from existing Tesbo Knowledge Base documents; publishing pins immutable text/content/metadata and version. A skill update can trigger a *candidate* impact analysis of artifacts created using earlier skill versions, **not automatic mass rewriting**. Store the governing skill revision used to create/change each asset version; validate a skill cannot elevate its own permissions, replace an authoritative requirement or silently approve its own material policy modification.

Allow separate skill applicability: workspace shared skill, project-specific override or adapter, and explicit pinned version; do not accidentally impose Nesberry's business rules on other applications. Versioned project adapters reference the portable core, rather than copying/forking the core content. Skills must be retrievable and reviewable through Tesbo UI and MCP; external agents are clients, not a parallel canonical instruction repository.

## 6. Artefacts and evidence: no orphan data

All evidence and supplemental artefacts (images, files, logs, screenshots, citations, requirement source excerpts, custom-field values, tags, attachments, reviews) must have a clear owner and reference. An artefact may belong to a particular asset revision, a draft, a linked relationship, a change set, or an execution attempt. **Not everything is a normal editable field:** typed associations, membership, ordering, retention and access controls must still be versioned/audited.

Use existing Tesbo \`attachments\` and \`StorageService\` for bytes and ACL; add reference/association metadata only where the existing entity mapping cannot express ownership. Track original artifact IDs, hash, source, creator, redaction, retention, lifecycle, and when/why it became associated or detached; deleting a link must not silently erase history. Private artifacts must not become public through historical version comparison/export. Do not duplicate uploaded bytes for every revision when immutable content-addressed references suffice and existing retention policy permits.

Distinguish authored expected evidence from runtime observed evidence. A screenshot, toast or agent verdict does not establish actual persistence/recipient delivery. Store verification references and explicit missing evidence.

## 7. User interface

In each test case/requirement/skill row and detail view show current published version (\`v4\`) and draft/pending indicators separately. On hover expose a history affordance; it MUST also work by click/tap/keyboard without hover and from a visible details action.

Reuse existing drawer/modals/layout. History panel tabs/filters:
- **Published versions** — chronological timeline, author, date, summary, approval/auto-policy receipt, exact revision.
- **Draft proposals** — active drafts, base version, assigned reviewer, state, iterations, visibility and permissions.
- **Activity** — individual field/link/artifact/approval/restore events, filterable, with field-level \`before → after\`.
- **Affected relationships** — which requirement/test cases/skills/plan/run are bound or awaiting review.
- **Compare** — any two published versions or a draft against its base/current; field-level and order-sensitive step diffs with attachment/citation/link changes.
- **Restore** — select an old version, create new proposed draft, preview affected references, approve/publish as next version.

The user must see where a current approved version differs from an unapproved draft. Filter summaries must never imply no changes if the inspected comparison is partial/unknown. Long histories require cursor pagination and server-authoritative ordering; all decisions revalidate the current revision at save/approve time. A bulk change set has one review page with per-asset diffs and an impact summary, not a wall of unrelated updates.

## 8. API, MCP and enforcement (proposed)

Do not replace existing test case/KB/requirement writers. Introduce a shared domain service for \`createDraft\`, \`proposeRevision\`, \`getHistory\`, \`compareVersions\`, \`reviewChangeSet\`, \`publishChangeSet\`, \`restoreAsDraft\` and \`assessImpact\` that reuses current project access/permissions/transaction and audit services. All REST, MCP, Zyra and UI publication paths must pass through the *same* enforcement/transaction boundary.

Proposed semantic endpoints (exact route conventions to confirm in implementation design):
- \`GET /api/projects/:id/assets/:type/:assetId/history\`
- \`GET /api/projects/:id/assets/:type/:assetId/compare?from=...&to=...\`
- \`POST /api/projects/:id/assets/:type/:assetId/drafts\`
- \`PATCH /api/projects/:id/drafts/:draftId\` with a required expected draft iteration/revision
- \`POST /api/projects/:id/change-sets\`, \`.../:changeSetId/submit\`, \`.../:changeSetId/review\`, \`.../:changeSetId/publish\`
- \`POST /api/projects/:id/assets/:type/:assetId/restore-draft\`

Possible MCP tools: \`get_asset_history\`, \`compare_asset_versions\`, \`propose_asset_revision\`, \`get_change_set\`, \`assess_change_impact\`, \`review_change_set\`. MCP tool additions must be scoped to distinct necessary workflows; don't duplicate existing \`update_testcase\` or \`update_knowledge_document\`. Updating those writers and integrating with the common service may be safer than parallel tool verbs.

Security: project+asset association, membership, per-asset and per-field policy, read/write/review/publish privileges, actor attribution, published immutable history, no mass-assignment, no agent self-approval of privileged policy, request idempotency, \`If-Match\`/revision preconditions, and fail-closed on stale/unknown impact. Risk-based multi-approver policy is proposed for high-consequence changes. A read/write MCP token alone is **not** publication or policy-approval authority.

## 9. Existing source reuse and migration concerns

Existing Tesbo implementation (confirmed in \`development\`, source snapshot 2026-11-12):
- \`V2_test_cases_and_suites.sql\`: \`testcases\` and \`testcase_versions\`.
- \`V63_testcase_versions_snapshot_trigger.sql\`: pre-update snapshots of \`OLD\` for materially changed testcase rows, excluding timestamp/search-vector-only no-ops; changed actor/type recorded. This is **not** complete per-asset approved draft/version management.
- \`V119_cycle_items_field_snapshots.sql\`: historical run field snapshots. Preserve them; add revision pinning rather than replacing run/execution records.
- \`V45_knowledge_base_v2.sql\`, \`V94_knowledge_document_versions_unique.sql\`, \`V102_knowledge_document_versions_changed_diff.sql\`: KB version snapshots, serialized writes, changed-field summaries and uniqueness. Snapshot/version numbering is not automatically an immutable published skill or authoritative requirement revision.
- \`V62_audit_logs_immutable.sql\`: append-only audit logs with runtime-role restrictions; check actual deployment role before claiming tamper resistance.
- \`V141_review_board.sql\`, \`V143_review_state_fingerprints.sql\`: duplicate-review recommendations and stale-state rejection based on fingerprints.
- Zyra autonomous task review and the current Test Case/Knowledge Base MCP tools: useful review UX and domain APIs, not a universal governed asset change-set service.

**Important migration risks:**
1. \`testcase_versions\` historically snapshots the **pre-update** row, not a guaranteed complete chain of approved published revisions. Check for missing creation version, latest live state, duplicate version numbers, concurrent writes and related tag/custom-field changes before assigning new version identifiers.
2. Existing direct REST/MCP/Zyra writers must be audited and routed through a common publication boundary or explicitly remain draft-only. No bypass via old endpoints.
3. External requirement sources cannot be rewritten as if Tesbo were authoritative; no unsupported "requirements table" claim. Establish source-backed requirement IDs and pinned snapshots before declaring requirements owned by Tesbo.
4. Never reinterpret old rows as having passed an approval workflow that didn't exist. Label baseline capture with its real provenance and \`legacy_unverified\` where applicable; old snapshots retain their original semantics and identifiers.
5. Existing KB version numbers, generated diffs and V94 uniqueness are not silently renumbered by this design.
6. Attachments and actor provenance must survive soft-deletion; review any physical FK cascades before guaranteeing permanent history.
7. Field-level differences across custom fields/tags/links may not be emitted by the current row-only testcase trigger: evaluate a change-set-aware snapshot/ledger instead of mutating unrelated legacy trigger rules blindly.
8. Cross-client stale writes, pre/post-COMMIT acknowledgement ambiguity and external outbox delivery need explicit contract; "transaction successful" does not prove external side-effect delivery.

**Candidate schema shape (subject to migration review):** a thin \`asset_revision\` / \`asset_draft\` / \`asset_change_set\` / \`asset_change_event\` / \`asset_relation_history\` layer keyed to existing authoritative testcase/KB records and external source descriptors; not new replacement \`testcases\`, \`requirements\`, or \`documents\` tables. Evaluate typed table constraints and meaningful append-only history vs duplication before implementation. Published versions should be unique by asset and version; branch/draft IDs distinct; apply must be atomic and idempotent.

## 10. Test plan and acceptance gates

Required executable tests, to be mapped to existing test owners before implementation:
1. Independent numbering: TC-A v1→v4, TC-B v1→v2, SKILL-C v1→v3, REQ-D v1→v2; no shared counter or draft numbering as published history.
2. Every authored material field, structured step, tag, custom field, attachment, evidence link and requirement association produces an attributable field/association-level history event. Null/empty/omission and reordered lists are distinct. No-op and embedding-only operational writes do not inflate published versions but remain observable if consequential.
3. Draft autosave/iteration and rejection leave latest published asset unchanged; rejected proposals remain historically visible. Published history is read-only.
4. Manual approval promotes exactly the reviewed payload; stale review, newer draft edit and changed base or link-impact receipt invalidate approval.
5. Bounded automatic mode may publish an authorized low-risk edit, but cannot publish a privileged skill policy or authoritative requirement change without the necessary review.
6. Requirement revision change identifies dependent cases and provides separate \`still_valid\` and \`needs_review\` paths without forced case revision. Missing inventory fails closed.
7. Multi-asset/relationship publication either fully commits or fully rolls back using migrated PostgreSQL; injected late failure leaves no partial current revisions, orphan relations or fake activity events. External write uncertainties remain visible.
8. Previous run with pinned TC-A v2 and REQ-R v3 continues to show those versions after current TC-A v4/REQ-R v5 or restore, including export/reports.
9. Restore v2 when current is v4 produces a draft and on approval publishes v5, retaining v3/v4 unchanged.
10. Concurrent agents editing same base, disjoint fields, stale review and cross-project ID reuse are tested with actual race and privilege oracles.
11. History/diff UI is reachable by hover, keyboard, touch, deep link and screen reader; field-level history and attachments respect project ACLs and pagination; a missing artifact/permission is not rendered as "no changes".
12. Legacy migration inventory checks old snapshots, missing creation revisions, trigger ordering, date provenance, empty/detached relationships and historical approval unknowns without fabricating records.
13. Changed skill must be evaluated against held-out quality/false-success/false-failure cases before claimed improvement or automatic propagation.
14. MCP/UI/REST/Zyra parity: every applicable mutation surface shares version preconditions, permissions and audit behavior; forbidden bypasses and cancelled/unknown effects do not silently write.
15. Artifact storage retention, private historical downloads, soft-delete, review-only cross-project restrictions and no-secret capture tested at API/storage boundary.

Verification classes: unit/contract; real migrated PostgreSQL transactions and races; REST/MCP authorization; real frontend UI/browser flows; independent review of frozen baselines; app-specific compatibility. Green source checks are not deployed runtime or human UAT sign-off.

## 11. Delivery sequencing and deliberately unapproved decisions

**Proposed bounded PRs (not authorized):**
- PR-A: source audit + missing-field/relationship inventory, data migration proof plan, stable version identity and draft-vs-published semantics; contract tests, no behavior redirects until proven.
- PR-B: common revision/draft/approval engine and testcase adapter using existing V63/V119 rather than replacing them; multi-writer parity, conflict and rollback tests.
- PR-C: KB-backed skills publishing and authoring skill governance; existing review UI reuse and MCP retrieval, immutable skill revision pinning.
- PR-D: external-source-backed requirements revision/relationship impact handling and unified change sets; downstream compatibility.
- PR-E: reusable history/compare UI, draft review, impact panels and pinned run integration; then actual Nesberry goal-led execution milestone.

**Unresolved owner decisions for review:**
- Whether to support multiple simultaneous drafts per asset and private vs team draft visibility; design allows both, default TBD.
- Whether draft history tracks every autosave or groups rapid edits into bounded checkpoints while capturing all substantive changes; retention and volume TBD.
- Which material fields trigger new published content revisions versus a relationship-only revision, and how to display combined change history; every field still auditable.
- Whether ordinary case auto-publication is allowed and by which roles/fields/risk thresholds; proposed default Manual.
- Which classes require two-person approval vs one reviewer; mandatory separation for privileged skills is proposed, not ratified.
- Whether to version relationship edges independently or embed their revision in asset published snapshots; must preserve precise historical bindings in either scheme.
- How to ingest and authorize external requirement revisions when the source is immutable Git/Jira/Notion and upstream API cannot be written.
- How to treat mutable evidence content and retention (prefer immutable attachment identity and versioned associations).
- Whether approved published versions should be semver or monotonic integer per asset; recommend monotonic integer and optional human release label.

Until these are reviewed, no implementation, migration, live testing, token use, deployment, project data mutation, Phase 2 launch, or automatic risk acceptance is authorized.

## 12. Closure of previously identified gaps (contract-level, not implementation claims)

**GAE-C01 — Full field/association coverage.** Before writing a migration or redirecting a writer, inventory all user-visible and domain-semantic fields in current \`testcases\`, \`testcase_versions\`, \`knowledge_documents\`, \`knowledge_document_versions\`, custom-field tables, tags, attachment/evidence tables, ticket/Notion links, suite/membership relationships, run snapshots, review records, and other source-backed fields. For **each** record its owning writer(s), affected consumers, whether it belongs to the published snapshot, draft, linked relation, evidence binding or operational audit, and the required authorization. Every field—including those not on a form and new fields introduced later—MUST be classified. Schema/API contract changes require updating this manifest and its parity tests; unknown fields fail the coverage gate rather than disappearing from history.

**GAE-C02 — Typed, exact comparisons.** Show the before and after for text, structured step identity/order, typed values, null/empty/omitted states, sets, custom fields and document bodies. Use stable step IDs if already supported or add a backwards-compatible mapping only with migration proof; do not infer step moves from ordinal edits without confidence. Every attachment, citation, evidence object and link is a typed association with identity, order (when relevant), hash/revision, provenance and visibility. Record a removal as a historical detachment rather than erasing bytes or links. Sensitive values appear redacted with change metadata and authorization-appropriate diff; do not leak historical secrets.

**GAE-C03 — Draft/published separation and meaningful versions.** Latest approved *published* revision is current. A working draft may have multiple saved iterations and remains unpublished until guarded promotion. Historical approved revisions stay historically approved; rejected/draft versions never consume published numbers. All fields must be **auditable**, but generated operational state (timestamp, embedding status, cache index, worker activity) does not automatically create a newly approved semantic asset version. Classify such events explicitly, show them under Activity, and require source-derived agreement before excluding any domain field. No-op and repeated commands do not inflate versions.

**GAE-C04 — Concurrency and approval freshness.** Revision preconditions cover asset content, relevant relationship heads, draft iteration, review payload hash and policy version. If a linked requirement or publishing policy changes while a proposal awaits approval, recalculate impact and invalidate stale authorization/approvals as appropriate. Disjoint-field edits require a controlled merge with invariant checking; do not silently merge merely because paths differ. Draft proposal/comment changes after review void earlier approvals of the affected revision. A cross-tab/network-lost COMMIT acknowledgement resolves by idempotency key + authoritative read before retry.

**GAE-C05 — Link integrity beyond direct requirements.** Maintain version-aware bidirectional edges for source requirements, cases, suites, plans, run manifests, skills, defects, external tickets, attachments and actual evidence consumers. Separate *stable identity linkage* from *validated coverage of a particular revision*. Each edge has its own version/event history, effective interval and status; linked text changes do not automatically version an unaffected neighbour. A change-set's impact report must account for upstream producers, downstream readers, affected and unchanged valid neighbours, unresolved and hidden/deleted dependencies, authorization-bounded consumers, and cross-project references. Unknown coverage is not zero. The existing Jira/Linear/Notion columns remain compatible until a separately verified one-owner migration design exists.

**GAE-C06 — Run immutability and insight.** Existing V119 run field snapshots are reused with a **temporal-provenance limitation**: V119 backfilled earlier run rows from the test case's *then-current* values, not from a verified original run-time capture. For those legacy rows provenance is reconstructed/unknown, never certified contemporaneous. For new runs require actual add-time snapshots. Manifest-managed runs additionally pin the exact published case/requirement/skill revisions, relationship validation, source hash and build. Published changes, link removals, soft-deletion and restoration cannot modify historical attempts/evidence or finalized verdicts. Historical data may inform trend/coverage insight, but trend labels must distinguish observed facts, inferred changes and reconstructed legacy baselines. A historical test that passed under REQ v2 is not counted as newly verified coverage of REQ v3.

**GAE-C07 — Restoration and deletion.** Restore earlier published content by creating a new draft; review/publish as next version. Re-check current permissions, relationships, current policy and external authority. A hard delete of a source row that cascades its \`testcase_versions\` or \`knowledge_document_versions\` would destroy required history; define explicit retention/tombstone or legally mandated purge semantics and verified migration behavior *before* claiming permanent immutability. Audit/event and artifact-retention exceptions must be visible and attributable, with least privilege and no invented indefinite-retention guarantee.

**GAE-C08 — AI attribution and approval.** Every agent-authored proposal records the stable asset, base version, draft iteration, source citations/source versions, governing authoring-skill revision and immutable hash, agent/model/tool/session identifiers where available, stated reason and verification result. No private chain-of-thought storage. An agent is never elevated by skill content or a generic MCP write scope. A reviewer action must be an explicit authenticated user or narrowly authorized policy decision, not a model-authored “approved” label. Auto and manual publish paths share all guards.

**GAE-C09 — Legacy adoption.** Introduce current baseline values from an explicitly dated source snapshot; retain V63 old-row snapshots and V45 document history without renumbering or pretending they were approved publications. Capture source and reconstruction grade per legacy revision. Missing creation snapshots or inconsistent link history remain \`UNKNOWN\`, and no job silently “repairs” dates, actors or old test results. Inventory/data-quality report before migration; a failed baseline operation leaves all original records intact.

**GAE-C10 — Existing current UI authenticity.** Before implementation, inspect existing Tesbo testcase table/detail drawer, KB versions/restore modal, requirements, Zyra chat/task board and project settings in actual owning source; verify representative running-app states before asserting pixel/interaction parity. Reuse current components and preserve minimize/cascade draft retention, focus, keyboard, mobile and permission behavior. This is a product design spec, not runtime screenshot proof.

## 13. First-party AI Copilot integration — one testing control plane

### 13.1 Product requirement and existing reuse

**GAE-AI01.** Tesbo will offer a project-scoped **AI Copilot** able to navigate, explain, author and review testing assets through the same authoritative services as the UI/MCP. The Copilot must be able to discover *all classes of relevant information*—skills, requirements, cases, drafts when permitted, published history, field diffs, linked entities, source provenance, files/evidence metadata, review decisions, run manifests, executions, findings and impact assessments. “Access to all” means capability to retrieve authorized, relevant records, **not** a blanket dump or cross-project bypass.

**GAE-AI02.** Reuse existing Zyra chat sessions, citation/source context, Knowledge Base retrieval, human-reviewed draft flow, tool attribution and project membership enforcement. Current source includes \`Tesbo-Frontend/app/(app)/projects/[id]/agents/zyra/page.tsx\`, \`components/agents/ZyraContextDrawer.tsx\`, \`ZyraChatReviewPanel.tsx\`, \`V89_zyra_chat_review.sql\`, \`V100_zyra_chat_session_lock.sql\` and \`src/legacy/zyra-turn-context.spec.ts\`. These are existing capabilities, **not** evidence that the requested unified Copilot with version-aware retrieval is implemented. Decide and document whether Copilot extends/rebrands Zyra, hosts Zyra as a capability, or shares its domain backend—do not silently ship a second project chat with duplicate session/task records.

**GAE-AI03.** The Copilot's chat is a control surface. It must reuse the common history/diff/proposal/impact/publish service and existing test-case and KB writers; its own chat message isn't the canonical requirement, revision, review or execution outcome. Link to real asset IDs, revision IDs, review IDs and evidence references. Store an attributable Copilot action receipt, not a duplicate state machine.

### 13.2 Read and explanation contract

**GAE-AI04.** Intent-driven Copilot context retrieval supports:
- \`current\`: current approved asset revision, current linked coverage assessment and latest valid run.
- \`history\`: cursor-paginated per-asset versions, draft iteration history (permission gated), authors and reasons.
- \`compare\`: exact versions, field-level diffs, attachment and relationship changes with ACL-aware redaction.
- \`impact\`: upstream/downstream graph, approved source authority/revisions, unaffected neighbours and missing/unknown coverage.
- \`proposal\`: pending drafts/change sets assigned or visible to current actor, reviewer comments, stale state and approval requirements.
- \`provenance\`: governing skill versions, source citations, model/agent activity and approval receipts.
- \`run\`: frozen manifests, pinned versions, attempts, evidence, verified results, open gaps and historical truth.

**GAE-AI05.** Every Copilot answer claiming a fact about an asset links to the exact project, asset ID, revision, relationship and evidence (where relevant). Explain whether context is approved current, historical, draft, stale, missing, reconstructed legacy or uncertain. It may say “I cannot determine from available evidence,” but must not fabricate dates, approval receipts, missing attachments or impacted cases. A chat answer summarizing TC-A v2 does not imply TC-A v2 is current if v4 is published. Cross-project retrieval is denied unless explicitly and independently authorized by the domain policy.

**GAE-AI06.** Retrieval respects the *requesting user's* effective permission at query time AND at use/action time, not the model's system key or the source content's claims. Private drafts, unpublished skills, evidence, sensitive historical field values, archived documents and cross-project links require their respective ACL. Permission revocation must invalidate in-flight access and cached snippets; Copilot sessions must not retain a privileged context packet readable by a later lower-privilege actor. RAG embeddings and full-text indices need ACL/version filters at **materialization and response**, not merely post-hoc hiding of a citation label. Returned files, retrieved MCP messages and external documents are untrusted data, not executable instructions.

**GAE-AI07.** Context packets are bounded and typed, with source IDs, content hash, revision, entitlement, as-of time, citation and missing/partial flags. Don't fetch the entire project history into a prompt. Use a server-side query over existing authoritative data followed by scoped pagination/on-demand expansion; large documents and binary evidence are referenced and summarized with permitted excerpts. A failed retrieval is \`unavailable/unknown\`, not an empty result. Session memory is useful for continuity but never outranks live authoritative project state or a pinned manifest.

### 13.3 Drafting, reviewing, auto mode and guarded actions

**GAE-AI08.** Copilot can create requirement/testcase/skill drafts, propose individual-field edits, attach relevant citations/artifacts, suggest link changes, analyze impact, and request review from within chat; use existing Zyra draft/review UI patterns. It can show “before → after,” affected assets, source versions, risk, proposed validators, and expected consequences. Proposed text remains inert until the shared service authorizes publication.

**GAE-AI09.** In **manual approval mode**, Copilot submits to the normal Tesbo review queue, links the user directly to the draft/change-set comparison UI, and reports \`submitted/pending\` rather than “updated.” The user approves in Tesbo's application after inspecting changes. No Copilot-generated rationale is a reviewer signature. If a draft changes or approval goes stale, show why and request re-review.

**GAE-AI10.** In **automatic mode**, Copilot is permitted only the exact bounded operations allowed by an owner-authorized policy; actual publication occurs through server enforcement of revision, ACL, impact, source authority and high-risk human-review gates. Clearly distinguish “proposed,” “validated,” “approved,” “applied” and “verified downstream” outcomes. Automatically published ordinary testcase edits do not authorize silently changing requirement meaning, skill safety instructions or linked historic execution results.

**GAE-AI11.** Copilot must detect link consequences before suggesting approval. A proposal to change REQ-1 from v3 to v4 may need TC-A v5 but leave TC-B v2 intact; both states need evidence or \`impact-review-required\`. Copilot cannot auto-label the new requirement covered simply because an old case link exists, and cannot auto-update every related asset without explicit per-edge applicability assessment.

**GAE-AI12.** Copilot should read the **published versioned authoring skills** that tell agents how to write requirements and testcases and how to assess coverage/evidence. It records which skill revision guided each proposal. A newly drafted skill cannot become the effective instructions of the same run before separate approval. Safety/policy/authorization rules come from server-owned policy, never from arbitrary skill or retrieved document text. Conflicting skills require explicit precedence, scope and an observed conflict; do not merge them silently.

**GAE-AI13.** Responses/actions must be resilient to interrupted chat turns, duplicate submissions, model/provider failover, stale source retrieval, conflicting human edits, and explicit user correction. Repeat an exact command idempotently, not blindly. Copilot must reconcile uncertain writes by stable command receipt and authoritative read. Server can report partial external effects and required recovery rather than claiming rollback when an external provider already committed.

### 13.4 Copilot permissions and visible UI

| User/actor role (conceptual) | Read approved history | Read private drafts | Propose | Approve | Publish |
|---|---|---|---|---|---|
| Authorized project viewer | Authorized subset | No, unless shared | No, unless separately granted | No | No |
| Asset author | Authorized subset | Own/shared | Yes, within asset scope | Per explicit owner policy only | No by default |
| Assigned reviewer | Authorized subset | Assigned/shared | May request changes | Yes for eligible changes; exact hash | Via approved service only |
| Project manager/owner | Authorized subset | Managed scope | Yes | Per policy, separation-of-duties | Configure bounded auto and authorized publish |
| Copilot/agent | User-delegated subset | Only caller-visible | Yes when allowed | Not human approval | Only narrowly server-authorized automatic mode |
| External MCP client | Token AND current member/role subset | Only delegated scope | As above | No implied approval from Write token | Governed service; no bypass |

This is a **proposed authorization mapping**, not a claim that Tesbo already exposes these exact roles/grants. It must be reconciled against current role system.

**GAE-AI14.** User workflow: within the existing single per-project Copilot conversation, user can ask “What changed in TC-A between v2 and v4?”, “Which approved requirements does TC-A v4 cover?”, “Which cases became impact-review-required after REQ-X v3?”, “Draft updates based on skill S v2,” and “Show pending proposals I can review.” Copilot presents bound version chips, source links, typed changes, relationship impact, status and direct opening of the existing detail/history/review panel. No invented duplicate management screens. On navigation the draft conversation must not lose unsent content.

**GAE-AI15.** The current project UI must visibly distinguish human-review-required proposals from auto-applied updates and report actual outcome. Notifications to relevant reviewers and affected owners require durable event receipt; a chat toast alone isn't proof of a delivered notification. Copilot may suggest source research, but authoritative external updates require authorized connectors and verified upstream confirmation.

### 13.5 Copilot acceptance oracles

- **AI-T01:** A project viewer asks for TC-A history: receives authorized current+historical references and accurately labels a private draft as unavailable without leaking its title/body/attachment metadata.
- **AI-T02:** An author asks for a v4→v5 proposal: remains pending until manual approval; the Copilot cannot claim an applied update early.
- **AI-T03:** Auto mode with authorized field scope publishes once; forbidden requirement/skill policy edits are rejected even if the prompt requests them, or if a retrieved skill says “ignore approval.”
- **AI-T04:** Copilot cites exact requirement, case and skill revision IDs and handles a changed head between retrieval and publication as \`STALE_BASE\` with a re-review path.
- **AI-T05:** Search/RAG and session memory never return a private draft or revoked actor's context across a workspace/role change; retrieved document prompt-injection attempts do not redirect tools or policy.
- **AI-T06:** Graph impact answers distinguish validated/no-longer-applicable/unknown linked cases; hidden or unavailable consumers cannot be counted as zero.
- **AI-T07:** Chat interruption, repeated “yes,” duplicate user clicks and provider retries produce one accepted command/receipt or an explicitly reconciled unknown, not duplicate versions or notifications.
- **AI-T08:** Copilot proposes with an approved authoring skill and can show which revision governed an older TC; a new draft skill does not silently replace the active one.
- **AI-T09:** Copilot claims full implementation or release readiness only with current explicit build/CI/connected-test and human evidence; documents and agent self-review alone are not proof of runtime.
- **AI-T10:** Direct navigation from conversation to the existing testcase/requirement/skill detail and field-diff panel works with current permissions, keyboard/mobile access, and a preserved unfinished chat draft.

### 13.6 Copilot sessions, model/tool bindings and durable continuity

**GAE-AI16.** Preserve the planned **single project Copilot conversation surface with project-scoped Sessions**, consistent with the broader Tesbo product direction, without assuming that design is already implemented. A Session has a stable identity and ownership, selected AI provider/model/connected external agent (if any), allowed MCP/project tools, enabled testing skills with immutable revision pins, explicit environment/execution permissions, bounded history and summary, and an audit of actions/decisions. The current Zyra chat and review machinery is a reuse candidate, not automatically a safe multi-provider session implementation.

**GAE-AI17.** Session tool permissions are *separately enforceable* from project membership, token scopes and a skill's authoring instructions. Switching from native model to ChatGPT/Claude/OpenCode, connecting or disconnecting MCP, or disabling session project access must not share elevated cached context, hidden drafts or server-side tokens with the new actor. A proposed update originating in one session stays linked to that session and its initiating human, not a different chat tab. Tools not enabled for the current session never appear callable because they happen to be installed globally.

**GAE-AI18.** Support session continuity by storing compact attributed summaries of decisions and references—not large unverified conversation paraphrases as authoritative requirements. On resume, re-resolve versioned asset IDs, approval states, graph heads and permissions; surface changed/stale/unavailable context. A human can inspect what the Copilot knows from the project and the sources/revisions behind its answer, including the scope of unavailable data. Never copy private chat instructions to a different project or auto-promote a chat recommendation into an approved skill.

**GAE-AI19.** Copilot can request *existing* MCP/REST operations via its governed adapter and query authorized asset-history and impact data. It does not require a second Copilot-only testcase/requirement/skill store or a second approval engine. An external model connector has no inherent permission to approve on behalf of a human; a UI-confirmed authorized reviewer action supplies that approval. For a change-set proposal, the Copilot must bind intended target asset IDs and base revision, preventing cross-thread or stale-card writes.

**GAE-AI20.** On model/provider failure, partial retrieval, session expiration, revoked permissions or lost successful publication ACK, report the precise uncertain boundary. Resume should not repeat old mutating commands without persisted receipt reconciliation. The session timeline distinguishes *Copilot suggested*, *draft saved*, *submitted for review*, *approved*, *committed*, *downstream synced*, and *verified*, with attributable dates and links to real records.

Session acceptance tests: (a) same project/role + session reuse preserves source/version references, (b) switching project/session or revoking access prevents disclosure of private drafts and cached source chunks, (c) two concurrent session proposals cannot overwrite each other or a newer human edit, (d) a connected external model cannot invoke disabled tools or approve itself, and (e) an in-flight change submitted before a role downgrade cannot publish after downgrade.

## 14. Decision and risk register for first implementation

Before implementation, get explicit product-owner decisions on: whether Copilot **extends Zyra** or reuses its backend while unifying the visible conversation, draft visibility and who may grant it, who can enable auto mode and allowed field classes, self-approval protections, source authority precedence, revision retention/redaction, and whether a change set may be partially approved as explicitly separate subchanges. Default proposals: manual publication, owner-managed private drafts, no self-approval of safety/authority changes, and an **indivisible atomic sub-change-set** for every dependency group. A rejected subset must not be silently treated as applied to remaining assets; re-assess the graph and base revisions before partial approval.

A future PR must prove: (1) compatibility with current APIs, (2) no alternate data store for Copilot context, (3) complete authoring and relationship histories, (4) fine-grained permission enforcement and RAG retrieval isolation, (5) source-to-current-UI fidelity, (6) downstream read/export/report/notification correctness, (7) real PostgreSQL commit/rollback/concurrency evidence, and (8) an explicitly bounded migration/retention strategy.

## 15. Role-based desk review receipt and findings (2026-11-12; not full-team certification)

### Review context, actual execution and authority

**Target:** this Tesbo GAE living specification v0.3 on the current PR branch; Tesbo \`development\` is the source baseline; Nesberry is an example target, not an imported application policy. **Stage:** design adequacy / code-grounding, not implementation or deployed QA. Current repository access here provides read-only source inspection and documentation PR writes. **No independent team agents, Graph harness, White owner, local PostgreSQL, browser, deployed Tesbo or external app execution were invoked.** The following are **role-by-role desk challenge passes against the canonical Nesberry team charters and Tesbo source**; they are not eight separately executed agents, real persona/browser passes, independent human approval, or formal White/Graph certification. An actual independent cold-review pass and executable graph harness receipt remain outstanding.

Framework authority inspected: Nesberry \`.kiro/steering/teams/README.md\` and \`review-orchestration.md\`, Blue, Red, Green, White, QA, Grey/SUJT, Elephant-Gold charters; Security agent \`.claude/agents/security-team.md\`; Purple design-assurance draft; Graph Assurance specification. The original charters are **not copied or changed**. Tesbo-specific judgments are recorded below, and framework portability is bounded because cross-app runtime execution has not occurred.

| Review lens | Finding ID / severity or stage | Source-grounded challenge | Disposition in this spec |
|---|---|---|---|
| **Blue — archaeology/reuse** | GAE-B01 high | V63 takes OLD testcase row before update; attached tags/custom fields/other FK tables are outside that single-row trigger. V45/V102 KB snapshots and V141/V143 review fingerprints are useful but not a new publishing model. | C01–C03 and §9 require full writer/consumer inventory; reused owners explicit. Complete source-to-reader inventory is **OPEN** preimplementation. |
| **Blue — ownership** | GAE-B02 high | External Jira/Linear/Notion requirement keys are currently testcase attributes; no independent full requirements owner demonstrated. | §3 and C05 require explicit source authority/identity, compatibility mapping and no parallel registry. Exact ownership/migration **OPEN**. |
| **Red — premise/negative design** | GAE-R01 high | A “read/write” MCP tool or agent chat instruction must not permit direct publication around the draft gate; existing direct writers could bypass a new parallel \`publish\` endpoint. | §8, C04, C08, AI08–AI13 demand one guarded writer and compatibility plan; full endpoint-bypass proof **OPEN**. |
| **Red — version contradictions** | GAE-R02 moderate | “Latest approved” could wrongly render historical approved v2 as draft, or a testcase lifecycle “Approved” as a published revision. | §2, C03, and UI rules distinguish current published, historically approved, draft, and runnable/archived lifecycle. |
| **Green — reuse/second order** | GAE-G01 high | Building a new Copilot chat, skill store, requirement registry, or approval board would shadow Zyra/KB/MCP owners. | §13 reuses Zyra sessions, source citations and task draft review; §8 reuses writers and KB, no duplicate store. Decide concrete Copilot ownership before implementation. |
| **Green — portability** | GAE-G02 moderate | Nesberry Grey charter examples could be baked into general-purpose testing skills, causing false universal rules. | §5/§13 separate portable method from versioned project adapter and requirement source; held-out cross-app evaluation remains **OPEN**. |
| **QA — history and temporal truth** | GAE-Q01 **high** | V119 backfilled historical \`cycle_items\` snapshots from the testcase state present at migration time: a later value may be falsely represented as original run-time content. | C06, §4 and §9 now explicitly label reconstruction and forbid historical certainty; migration controls and original-run provenance inventory **OPEN**. |
| **QA — rollback, attempts, side effects** | GAE-Q02 high | Published revision + linked edges + activity/event effects may partially commit; a lost successful COMMIT ACK cannot be treated as failure and blindly retried. | §2, §3, C04, AI13 and executable tests demand atomic local write, idempotency and reconciliation. Real migrated DB fault tests **OPEN**. |
| **Grey / SUJT — user journeys** | GAE-J01 moderate | “Hover for history” excludes touch/keyboard and could hide private draft context or force the reviewer to abandon an unsaved edit. | §7/C10/AI14–AI15 require discoverability, accessible click/focus/touch, existing source-authenticated UI, retained unsent draft and status-aware recovery. Actual user journeys **NOT RUN**. |
| **Grey / SUJT — long-term trust** | GAE-J02 moderate | A reviewer needs to know if an auto update was proposed, validated, committed, exported, externally confirmed, or undone—and whether older passed runs apply. | C06, AI09–AI15 distinguish outcomes and histories; realistic multi-session/re-entry usability verification **OPEN**. |
| **Security — trust/permissions** | GAE-S01 **high** | An untrusted skill/requirement/RAG snippet could instruct Copilot to self-approve, disclose a private draft or use an external token beyond current session privileges. | AI05–AI12 require retrieval-time/action-time ACL, prompt-injection resistance, server-held approval policy and redaction; adversarial verification **OPEN**. |
| **Security — data egress/retention** | GAE-S02 **high** | “Copilot sees all” could leak case evidence, old versions and sensitive attachments to an unapproved model/provider; signed URL access may outlast role revocation. | §6, AI06/AI07 and new controls below require classification, provider egress rules, provenance and expiration; product consent decision **OPEN**. |
| **Purple — design/clarity** | GAE-P01 moderate | Current Test Case/KB/Zyra UIs must be read from code and runtime; speculative mockups cannot establish fidelity. Draft vs published badges, field diffs and link-impact state need distinct accessible flows. | §7/C10 and AI14 specify clear states and parity gate. Current runtime capture **NOT RUN**; Purple source is itself a draft standard, not a Tesbo sign-off. |
| **Elephant-Gold — cold-read challenge** | GAE-E01 high | The old description “testcase version history exists” could be misread as proven creation snapshots, versioned approved snapshots and complete related-field history. | §9 and C01/C09 specify pre-update-only history, baseline proof grades and absence of fabricated approval. Independent fresh-eyes reviewer **NOT RUN**. |
| **Elephant-Gold — claim verification** | GAE-E02 moderate | “All fields”, “every downstream consumer”, “fully approved latest” are absolute claims without full inventory or runtime closure. | C01/C05/AI07 and §16 below require explicit inventory and UNKNOWN states; zero unknown isn't allowed by wording alone. |
| **Graph Assurance — consequence/lineage** | GAE-GR01 high | A receipt must prove source authority → published revision → link validation → frozen run → attempt → evidence → verification → reader/export. Listing those entities is not proof that edges resolve. | §16 introduces exact edge/evidence contract and non-vacuity checks; deterministic Graph harness execution **NOT RUN**. |
| **White — predesign gate** | GAE-W01 **blocking for freeze** | Missing approved owner decisions, incomplete writer/consumer inventory, independent fresh-eyes review, current-interface runtime proof and actual Graph/QA execution mean evidence is insufficient for final architecture freeze. | Keep status **DRAFT, DO NOT FREEZE/IMPLEMENT** until named gates and owner sign-off. Conditional Phase 1 exit policy does not by itself authorize this Phase 2 capability. |

### Consolidation and anti-duplication

The review identified **17 distinct challenged obligations** (some already covered, some strengthened below, some blocked pending evidence). It did **not** justify another test-management domain, second generic Copilot session system, second approval board or generalized microservice. Existing testcases, KB, Zyra, MCP, attachment storage, audit and run records remain owners. Similar risks from multiple lenses are consolidated into the single relevant owner rather than repeated as separate requirements. **Severity here is design risk if unmitigated, not a reproduced production security incident.**

### Scope and limitations of this role-lens assessment

This review covers each of Nesberry's ten currently named canonical roles as a **design lens**, plus a conceptual Graph edge check and White gate application. The original Tesbo roster (nine roles) and separate Simulation lane are reconciled in §17; they were **not** included as fresh independent executions in this pass. It does NOT certify actual team-agent orchestration, fresh independent reviewers, complete source/app journeys or machine-executed Graph closure. In the canonical process, real independent reviewers, role-specific receipts and runnable tool evidence must be attached before White freeze. Treat unsupported proof as \`UNVERIFIED\`, not as a pass. Future full-system journey claims require a four-source journey inventory and an explicit not-run/blocked ledger rather than a few sampled examples.

## 16. Amendments raised by full-team challenge

**GAE-X01 — Machine-readable lineage proof.** For every changed content/link/artifact field, produce a source-and-consumer matrix with \`assetType/id/revision/field\`, authoritative source/version, real writer(s), applicable readers (UI/API/MCP/Copilot/SDK/import/export/notifications/CI), link edge/revision, enforced invariant, test ID, proof level and unresolved gaps. A Graph closeout derives coverage from these receipts and cannot author itself “passed.” If a consumer is unknown, mark \`UNKNOWN\` and block a full-completeness claim.

**GAE-X02 — Temporal-provenance classification.** Run snapshots/backfilled revisions are \`observed_at_operation\`, \`recorded_contemporaneously\`, \`reconstructed_later\`, or \`unknown\`, with timestamp/source evidence. V119 historical backfill is \`reconstructed_later\`, not proof of what existed when a prior test ran; only a contemporaneous authoritative witness may strengthen it. Copilot/reporting must display the reconstruction limit, never silently relabel as exact.

**GAE-X03 — External and AI provider egress.** Before invoking a model/provider or uploading a file for AI analysis, classify source/evidence sensitivity, actor consent/authorization, allowed model/provider/workspace policy, retention/data-location constraints where applicable, intended purpose, permitted fields and redaction. No raw API tokens, private keys, passwords or other credentials in prompts, history diffs or skill documents. A model session with a broad service token cannot bypass current user/project permissions. The Copilot's context packet carries safe citations and classification, not unrestricted binary evidence.

**GAE-X04 — Access revocation, historical artifacts and caches.** Sensitive version history and private drafts remain protected after archive, user removal, role downgrade, token revocation, session switch and source deletion. Cache/RAG chunks, search indexes, generated context packets, signed URLs and conversation history are consumers in the access graph; define invalidation/expiry and tests. Revocation cannot retroactively undo a downloaded file—UI must not promise it. Historical export/review links re-authorize download at access time.

**GAE-X05 — External identity continuity.** Stable internal asset ID survives external test-case ID/key rename, requirement source moves and title changes. Explicit aliases/redirect/reconciliation avoid silent relinking by title; ambiguous/external duplicate identities produce an owner-review queue. A source split/merge needs authored mapping decisions rather than cloning approval lineage.

**GAE-X06 — Artifact lifecycle and deletion policy.** V2 \`testcase_versions\` and V45 \`knowledge_document_versions\` have hard-delete-cascading foreign keys. A statement that “history is immutable forever” is currently false under privileged deletion. Choose retention/tombstone/legal-purge policy and test the actual storage object lifecycle; content-addressed attachment refs require their own byte-integrity and access proof. Every declared purge records a minimum lawful audit receipt without retaining prohibited content.

**GAE-X07 — Cross-boundary publication and outbox.** Local asset revisions, relationship-head changes, audit and a durable intent/outbox event commit atomically (when feasible). External provider writes, search/RAG indexing, Copilot cache invalidation, notifications, exports and webhook delivery are distinct eventual consumers with acknowledged/pending/failed/unknown states, retry identities and reconciliation. Never claim they rolled back with the SQL transaction. An unchanged visual UI or success toast proves neither delivered notification nor refreshed external source.

**GAE-X08 — Revision graph consistency/read snapshots.** Copilot and review UI should obtain an authorization-scoped consistent set of asset heads and relationship revisions (or return an explicit \`asOf\`/staleness warning). A multi-query read mixing TC-A v4 with REQ-X v5 mid-update cannot be labelled one valid approval basis. Publishing rechecks current heads, graph and source versions, even when a previous impact report looked green. Cycles and high-degree graphs require bounded traversal and \`truncated/unknown\` indicators, not silent omission.

**GAE-X09 — Reviewer identity and multi-actor governance.** Distinguish *proposer*, *draft editor*, *human approver*, *policy-authorized publisher*, *agent actor*, *upstream source owner*, *revalidator*, *run executor* and *independent verifier*. One user may hold multiple roles but approval separation is enforced for protected actions. Changes initiated from Copilot, MCP, Zyra, bulk import and UI must carry original initiating human/session policy where relevant; do not substitute a generic agent actor as authority. A reviewer's granted rights must be rechecked when accepting.

**GAE-X10 — Safe compatibility rollout.** First map *all* mutation entry points and side-effect readers. An additive versioning feature is unsafe if legacy REST, MCP, imports, Zyra, bulk edits, background workers or direct SQL continue updating current records around approval. Require a migration/interception/legacy-policy matrix, negative bypass tests and one shared commit path. Deploy compatibility in stages with a rollback and read-only freeze plan; do not create two contradictory “latest approved” stores.

**GAE-X11 — Performance, retention and observability budget.** Set explicit P95 read/diff/review latency, max version page size, graph traversal cap, project fan-out, AI retrieval token/cost budget, queue age, provider retry bound and artifact retention classes before engineering acceptance. Exceeding a budget must return bounded partial/unknown or rate-limited status, not an apparently complete answer. Expose failed publication, stale proposal, queue backlog, eventual-effect failures, access-denied events and reconciliation backlog to accountable operators. Numbers are owner-design decisions to benchmark in the first slice.

**GAE-X12 — User-journey inventory and recovery.** Capture distinct entry paths: testcase/requirement/skill repository row, detail view, Copilot deep-link, incoming reviewer notification, external MCP, run-history comparison, draft restore and multi-asset change-set review. Test author/reviewer/manager/observer roles with first-use, saved draft, stale draft, access revoke, network loss, archived asset and partially applied external effect. No user should mistake “suggested” for “applied” or have to close an unfinished form to inspect history. Human comprehension remains unproven by a synthetic UI journey.

**GAE-X13 — Evaluation before declaring improved skills.** A new skill revision may be published through approval, but effectiveness claims require a before/after evaluation against known faults, valid alternatives, insufficient-evidence and tool-failure cases, including a held-out application binding. Record false positives, false negatives, missed obligations, cost and regressions. Publishing a skill without such evidence is \`PUBLISHED_UNVALIDATED\` for effectiveness, not self-certified improvement. Existing skill versions remain available to explain earlier authored cases.

**GAE-X14 — Explicit readiness gates and non-goals.** Pre-implementation readiness requires: a recoverable approved Tesbo roadmap and scope; source-authenticated data field/consumer inventory; exact API/MCP/Copilot ownership design; owner decisions on privacy/auto mode/approval/retention; independent cold review; Graph edge specification with non-vacuity checks; and test design for migrated DB and browser runtime. No “team pass” or White freeze is issued from this desk exercise. No production changes, destructive cleanup, AI provider integration, direct \`main\` change, microservice introduction or cross-project privilege is authorized by this document.

### Priority owner decisions after the challenge

**Blockers to finalize v1:** external requirement ownership/version precedence; exact approved/draft status semantics versus testcase lifecycle; private draft/Copilot permissions; publish auto-policy classes and separation of duties; complete field/association ownership inventory; immutability-vs-purge retention; and whether the first slice may expose versioned link reads before a unified relationship writer is ready.

**Can be staged with named limits:** bulk history UX, full semantic diff sophistication, all external connector write-backs, cross-application skill effectiveness claims, multi-hop graph visualization, large-scale archive/pagination tuning and optional execution workers. These do not excuse incorrect permissions, missing historical bindings or false approval/coverage claims.

## 17. Reconciliation with original Tesbo assurance roster and Simulation (2026-11-12)

### 17.1 Accurate roster: canonical teams versus specialist activities

**Source of truth for the pre-existing Tesbo assurance workflow:** the October 17, 2026 artifacts \`Tesbo_Full_Assurance_Review_2026-10-17.md\` and \`Tesbo_Full_Assurance_Review_v1.4.4_to_v1.4.5_2026-10-17.md\`. They reviewed the **eight-file Tesbo specification package** then at revisions 1.2 and 1.4.4→1.4.5, not this new GAE draft, and must not be presented as fresh independent review of v0.4.

The agreed **nine Tesbo review roles** are: **Blue, Red, White, Green, Security, Purple, QA, Grey/SUJT and Graph Assurance**. The newer Nesberry orchestration adds **Elephant-Gold** as a tenth distinct cold-review role. Its method is useful for Tesbo as an additional independent check; it was not proven to be a ratified Tesbo-specific team in the older nine-role package. **Simulation** is a separately accountable exact-workflow *assurance activity*, not a substitute for Grey/SUJT and not quietly folded into a role count.

| Role or activity | October Tesbo baseline | v0.4 activity actually performed | Required real completion |
|---|---|---|---|
| Blue | Team role | Source-grounded desk lens | Independent code-author/maintainer-grounded inventory of all versioned fields, writers, consumers, dependency scopes and approvals |
| Red | Team role | Desk premise/hostile-case lens | Independent negative-design proof and direct bypass/attack challenge against actual code and contracts |
| Green | Team role | Desk reuse/distillation lens | Independent reuse, relationship-seam and portability evidence; no redundant Copilot/KB/requirements owner |
| White | Team role; pre and final | Conceptual gate ONLY | Independent pre-architecture and final decision after all actual receipts; currently **NOT FROZEN** |
| Security | Team role | Desk threat lens | Auth, external-client consent, private draft/AI egress, agent/browser authority and denial tests |
| Purple | Team role | Draft design-charter desk lens | Existing UI source and authentic runtime baseline, UX/keyboard/touch/responsive and trust-state checks |
| QA | Team role | Source-informed lifecycle lens | Real migrated DB, API/MCP, client, concurrency, migration, retry, evidence-byte and report/commit race tests |
| Grey/SUJT | Team role | User-journey conceptual lens | Independent 4-source full journey inventory and actual G0/G1/G2 distinction, with blocked/not-run accounting |
| Graph Assurance | Harness/role in Tesbo roster | Conceptual edge challenges ONLY | Executed deterministic ownership→invariant→writer→reader→test→evidence ledger and independent artifact output |
| Elephant-Gold | Nesberry later tenth role | Not independently invoked; cold-review stance interpreted as a desk lens | Independent reviewer actually starts cold, ignores prior conclusions and supplies direct source/spec-code drift receipts |
| **Simulation** | **Separate required activity** | **NOT executed for GAE v0.4** | Concrete exact ChatGPT→Tesbo MCP→OpenCode/Chrome MCP→report/evidence→ChatGPT/Copilot analysis→human revision review/approval/retest→published assets with real receipts |

**Specialist sub-lenses, NOT invented core-team memberships:** AI assurance (prompts, model routing, retrieval, memory, tool use and hallucinated authority); privacy/data governance (PII, exports, historical evidence and model egress); and SRE/operability (queue/backpressure, logs/metrics, retries, storage and outage recovery). Route them to Security, QA, Blue and Graph with named owners/receipts, or obtain an explicitly delegated specialist review if a qualified reviewer is available. Do not say these sub-lenses were independent teams simply because they appear in a checklist.

**Status:** All nine original roles and the newer Elephant-Gold lens are **ACCOUNTED FOR AS METHODS**. They are not independently completed for v0.4; the exact Simulation, real graph harness, runtime UI, current full eight-file reconciliation and White freeze remain **NOT RUN / BLOCKED**. The phrase “full teams completed” is prohibited in release or PR summaries until separately executed receipts substantiate it.

### 17.2 Original Tesbo workflow that must remain a first-class acceptance path

The former Tesbo review explicitly required **two equal entry paths**:
1. **External ChatGPT/Claude through Tesbo MCP:** QA user agrees an exact testing brief, the external client stores a durable project-scoped task with complete source/authorization context, an individually registered OpenCode/Hermes/etc. installation claims it, and that installation uses *its own* Chrome MCP/browser tools. Tesbo coordinates but does not assert physical control of an independent browser.
2. **Native Tesbo AI Copilot:** user interacts through one Copilot chatbox with project QA Sessions and selectable native/connected AI backend, reusing the **same task/report/retest/evidence/proposal/published records** and independently selected executor as the external entry path.

**Boundary:** Native Copilot cannot be the only authorized route; its chat session is not the QA-session/task/report aggregate. Existing V41 Zyra chat conversation and V89 draft-review links are reuse candidates, but a project QA Session may need a minimal independent parent for multiple chat threads, tasks, summaries and execution attempts. Do not replace or copy chat history into a second competing source of truth. Actual multi-project discovery/consent and multi-provider compatibility must be designed and tested separately; current project tokens are project-scoped.

**Source-to-output lineage:** exact prompt bytes/hash → approved scope/source revisions → executor/client+task attempt identity → observed environment+actions → admitted immutable original report and evidence bytes → separate analyst interpretation with citations/uncertainty → immutable proposal revisions/base/link-impact → distinct authenticated human approvals or narrow automatic policy → exact selected publish receipt and run/testcase/requirement/skill current versions. An agent report or transcript is not itself product verification; a newly authored case after exploration cannot be declared previously executed. Future retest targets a frozen approved case revision and retains earlier failures.

### 17.3 Prior Tesbo acceptance gaps not adequately called out in v0.3

These are historical review risks to **RECHECK AGAINST CURRENT SOURCE**, NOT all assumed to remain open:

| Prior October review issue | Current source observation / boundary | GAE contract addition |
|---|---|---|
| **AS-01 token scopes** | Current \`ApiTokenService.normalizeScopes\` defaults absent scopes to \`read\` and rejects invalid/empty scope sets (improvement since the older review). Existing previously issued credentials, token migration and revocation are still an unverified migration concern. | Explicit old-token inventory/rotation/upgrade gate, not a stale claim that current default is Read+Write |
| **AS-02 protected writers** | \`mcp.tools.ts\` still names direct case and KB mutation tools gated by read/write scope; GAE is not implemented. | Uniform proof that REST/MCP/Copilot/Zyra/import/bulk/background cannot bypass proposed approval/publish rules |
| **AS-03 project MCP OFF / consent** | Project membership/token read-write enforcement is visible in \`mcp.service.ts\`; the inspected service does not demonstrate project/client/session OFF-by-default and named consent grants. Full deployment/config proof unavailable. | Policy and server enforcement before listing/calling tools, with deny for preexisting/legacy credentials; feature-gate state verified, not guessed |
| **AS-04 external client identity** | Current MCP token is one project identity, including shared alias \`/api/mcp\`; a human-account multi-project connector and external client-registration consent scheme was not demonstrated. | Explicit human⇄client⇄project⇄session⇄executor attribution, grants/consent and revocation; named client instance, no provider-as-identity |
| **AS-05 exact loop / AS-12 interoperability** | No current real ChatGPT and OpenCode/Chrome client exchange was executed for this GAE review. | Require real endpoint handshake, task claim, evidence byte/content completeness, screenshot inspection and source/readback in a fresh authorized external session |
| **AS-06 true actor attribution** | MCP writes may carry a shared agent actor or the token issuer user FK; these aren't independently sufficient to identify an external runtime installation and approval authority. | Persist initiating human, external connector, executor instance, actual tool actor and immutable approval identity separately |
| **AS-07 session ownership** | \`zyra_chat_sessions\` is a chat conversation, not proof of a parent aggregate for many QA threads/tasks/retests. | Reconcile minimal QA Session versus existing conversation/plan/task semantics; no second chat history store |
| **AS-08 KB source uniqueness** | V45 original \`knowledge_documents(source_provider,source_external_id)\` index lacks explicit project; later migrations/active constraint must be reviewed before a live defect claim. | Source identity and duplicate/clone semantics must be project-appropriate, verified against final schema; do not leak another project's existence |
| **AS-09 historical requirements** | Current external ticket refs and KB snapshots do not alone certify prior Jira/Linear/Notion text at dispatch. | Pin authoritative external requirement revision/content hash and state \`UNKNOWN\` if absent |
| **AS-10 order / AS-11 revocation races** | Permission/consent must be enforced before external task pickup/AI provider egress; revocation during reserve/upload/finalize/apply is an explicit boundary. | Deny before execution, recheck at linearized commit, fence stale executor leases, reconcile post-commit effects |
| **AS-13/14 untrusted summaries and target enforcement** | External executor owns its browser; task text is not a physical network permission barrier. | Attribute observed target/build/actions, trustworthy environment-side policy when available, evidence completeness and verified limits |
| **AS-15 native Copilot backend** | Existing Zyra UI and chat routes are not a demonstrated general-purpose multi-backend project Sessions Copilot. | One native UI, adapter compatibility check, model/tool/session permissions, streaming/resume/cancel proof |

The original October review recorded **93 planned acceptance scenarios with zero product tests in that review**; those counts are historical and are **not automatically current GAE coverage**. Reconcile the eight authoritative original specifications and current protected-writer plans before accepting a Phase 2 implementation roadmap. No requirement ID, prior reviewer decision or approved test is copied here as freshly executed.

### 17.4 Mandatory Simulation ledger — G0 design scenarios, G2 execution unproven

**SIM-GAE-01: external model, manual approval, revision lineage (G0, designed NOT RUN).**
1. QA human defines a user goal and approved target/permission manifest with the external ChatGPT client.
2. ChatGPT uses **authorized Tesbo MCP** to store the exact task/context/source versions; server returns stable receipt. No official case/result/bug modified.
3. Individually registered OpenCode installation claims task through its own identity, executes permitted Chrome MCP/browser journey and records observed targets, actions and blocked conditions; Tesbo does not falsely claim it launched the browser.
4. External client submits immutable admitted report and actual artifact/evidence bytes; separate read retrieves exact content and proves completeness; unsafe content is quarantined/redacted with auditable derivative.
5. ChatGPT or native Copilot reads source/evidence and proposes TC-A v5 draft D1 based on TC-A v4, REQ-X current source revision and skill S v2. A new finding may propose a new case but must not claim it was executed after creation.
6. Human modifies draft D2, changes link-impact to another requirement, requests actual retest; current approved TC-A v4 and all old run/evidence remain unchanged. Stale original approval is invalidated.
7. Authorized agent retests against the **exact approved target case revision** when available; manual reviewer approves selected exact proposal revisions, rejects others. One shared guarded publish produces TC-A v5, relation revision, audit and receipt once; no unapproved GitLab filing/other side effect.
8. Fresh authorized external session discovers the project task and exact prior state without user pasting chat IDs; unauthorized/other-project client sees nothing. Gaps and pending/unrun conditions remain visible.

**SIM-GAE-02: native Copilot, bounded automatic case update (G0, designed NOT RUN).**
1. User in project Copilot selects project QA Session, approved authoring skill revision and permitted source scope; current user/role and project policy are resolved.
2. Copilot proposes a permitted low-risk field change to TC-B v2 based on current published head, including source citations. In manual mode this remains pending. In narrowly authorized auto mode the exact same guarded shared service may publish v3.
3. If the requirement source, approval policy or TC-B head changed while the model was reasoning, stale apply refuses and prepares an impact/review proposal; no blind replay.
4. A skill-policy modification, external authoritative requirement meaning change, private draft read or session-disabled MCP tool is blocked even if natural-language instructions request it.
5. An interrupted success acknowledgment is resolved by the stored command/receipt and readback, not by duplicate publication.
6. Switching to another project/model/session removes prior private context and does not leak evidence; activity shows who did what and exactly which revision was committed.

**SIM-GAE-03: calibration counterexamples (G0 proposed, G1/G2 NOT RUN).** Include (a) known bad testcase logic the system should reject, (b) legitimate alternate workflow to accept, (c) inaccessible/ambiguous requirement source returning \`NEEDS_ORACLE\` or UNKNOWN, (d) Chrome/tool failure while product remains unproven, (e) authorized duplicate submission and distinct later update, (f) changed target build after task dispatch, and (g) two linked requirement changes needing independent review.

**Required actual receipts before "complete simulation":** independent actual OpenCode/Chrome execution with known allowed host, actual deployed SHA, real signed-in/-out identities where authorized, task/report/evidence object IDs, downloaded bytes/hashes, human review events, exact API/MCP readbacks, denied second project and role-changed actor, full G2/G3 not-run ledger. At this design stage all above are **proposed journeys**, not executed tests or verified performance.

### 17.5 AI Assurance / Privacy / SRE specialist coverage (without inventing teams)

- **AI Assurance within Security + QA:** instruction hierarchy and prompt injection in untrusted requirements/skills, RAG retrieval freshness and context isolation, model/tool routing and fallback, exact source revision grounding, hallucination and unsupported “success,” generated-output calibration, cost/context limits, and agent self-approval prevention.
- **Privacy / data governance within Security + Blue:** field-level confidentiality of old versions, cross-tenant retrieval, PII in screenshots/files/EXIF/logs, exports/signed URLs/referrers, model-provider egress and retention, deletion-versus-provenance tensions, and protection of draft visibility after access revocation.
- **SRE/operations within QA + Blue + Graph:** report-upload partial failures, worker leases and fencing, queue backlog, retries/circuit breakers, LLM/provider outages, storage exhaustion, audit/outbox lag, metrics and recovery procedures; show operator-reachable signals and evidence the alert gets to its owner.

These specialist lenses were **not independently executed** for v0.4 and need named delegated owners/receipts when their boundary is in scope. They do not confer any new account/tool access.

### 17.6 Full assurance / White freeze criteria and evidence ledger

The original Tesbo nine-role and later Nesberry ten-role charters are **accounted for**, but formal full assurance remains **BLOCKED** until:

1. Recover and read current **eight Tesbo authoritative specs** and all approved addenda, with exact file/revision receipts; compare this GAE proposal against their active requirements/design/tasks/QA.
2. Create the independent **four-source journey universe** from actor jobs, specifications, actual route/UI/MCP/CLI surfaces and data ownership. Include internal Copilot, external ChatGPT/MCP and simulator-only fallback; record all alternate entry points, roles, lifecycle, source/consumer and crossed trust boundaries.
3. For each material journey, record source-linked oracle, expected outcome, explicit G0/G1/G2/G3 proof tier, PASS/FAIL/NOT RUN/BLOCKED/UNKNOWN, and gaps. A representative G0 example does not establish universe coverage.
4. Get separate Blue/Red/Green/White/Security/Purple/QA/Grey review receipts with actual source and independently grounded counterexamples; optional added Elephant-Gold truly cold receipt; no correlated self-review counted as independent.
5. Execute real Graph closeout on source→revision→relation→plan/run→attempt→evidence→review→publication→report/effect, with non-vacuity failure controls; don't substitute an authored table for a graph harness run.
6. Authenticate existing Tesbo UI from current source plus actual runtime captures before claiming visual parity; do human/keyboard/mobile and non-happy-path checks at appropriate stage.
7. Obtain owner decisions on project MCP/client consent, exact protected writer/approval policy, native Copilot vs existing Zyra ownership, external requirement source authority, draft visibility and legally safe revision/evidence retention.
8. Run real targeted migrated PG/API/MCP/auth/browser tests, and eventually the **actual external client/executor** loop; no source-only coverage accepted as operational PASS. Record absent tools/environments separately.
9. White records *NOT FROZEN* until requirements/design/tasks, reuse inventory, owner decisions and actual evidence are reconciled. New GAE spec changes mandate a targeted delta re-review; CI green for documentation cannot be called a product/security review.

**Current outcome for this supplement:** **ROSTER RECONCILED; SIMULATION SCENARIOS SPELLED OUT; FULL TEAM EXECUTION NOT PERFORMED; WHITE NOT FROZEN; implementation not authorized.** This supersedes any earlier unqualified “all teams complete” statement in the review receipt without erasing that earlier historical desk exercise.


## 18. Crosswalk against recovered Tesbo eight-spec package v1.4.18 (2026-10-28)

### 18.1 Scope, evidence strength and precedence

This review read the **indexed content of all eight original project specifications** at reported revision **1.4.18**, modified October 28, 2026: \`00_README.md\`, \`01_PRODUCT_REQUIREMENTS.md\`, \`02_WORKFLOW_AND_UX_SPEC.md\`, \`03_TECHNICAL_DESIGN.md\`, \`04_MCP_API_CONTRACTS.md\`, \`05_IMPLEMENTATION_BACKLOG_AND_TEST_PLAN.md\`, \`06_IMPLEMENTATION_AGENT_BRIEF.md\`, \`07_UI_DESIGN_TASKS.md\`. The README declares 105 FR, 12 NFR, 72 AC, 77 tasks and 423 planned QA cases; **declared counts, not a fresh byte-level checker result**. Raw-file materialization was unavailable. These files are materially newer than previously cited 1.4.4/1.4.5 or 1.4.6 baselines; their own audit references historical fork SHA \`124f1280\`, not a confirmed current deployed build. No live environment tested.

**Critical authority finding GAE-18-01 (blocking):** Original README **P-14** and \`06_IMPLEMENTATION_AGENT_BRIEF.md\` require maintaining **only the eight original canonical filenames and existing ZIP**, with amendments integrated into the owning sections and original IDs. The former \`docs/specs/governed-asset-evolution.md\` looked like a ninth canonical source; placing this document under \`docs/reviews/\` fixes that source-of-authority conflict *for this PR*. The eight original source attachments were NOT modified, overwritten or regenerated; accepted edits still need an authorized in-place update and versioned ZIP/byte verification.

### 18.2 Reuse and overlap mapping (new work must not reinvent these)

| Canonical original | Existing binding capability and IDs | GAE reconciliation / actual delta |
|---|---|---|
| **00_README** | **P-05** canonical KB/history; **P-07** human exact approved publication; **P-14** exactly eight specifications; **P-17** external and native equal AI entry paths; **P-18** project external MCP off by default; P-01 reuse-first and P-20 existing modules. | Do not invent a second spec package, Copilot, KB, permission system or publisher. **Requested auto mode needs an explicit P-07 amendment**, not implied permission. |
| **01_PRODUCT_REQUIREMENTS** | **FR-027–037** shared Zyra-derived staging, logical operations, exact field diffs, immutable proposal revisions, comments, human approve and selected apply, existing testcase version history; **FR-046** per-project format profiles; **FR-076–077** versioned QA Standards & Playbooks, effective guides and native/external MCP consumption; **FR-078** case evolution; **FR-080–084** condition/step IDs, typed historical links, hover/focus history, attempted-version provenance; **FR-101–105** governed learning/discovery and spec amendments. | A wholly new GAE approval engine, skills store, generic graph or Copilot learning module duplicates already specified owners. Real incremental requirements: approved-vs-working **per-asset** draft streams for *requirements and skills as well as cases*, typed attachment/custom-field/link history, source-revision/coverage validity, cross-asset atomic change-set semantics, and owner-ratified auto-publication if chosen. |
| **02_WORKFLOW_AND_UX_SPEC** | **WF-05/06** draft correction/partial merge; **WF-09** finding triage; **WF-10** QA Standards & Playbooks; **WF-11** actionable step execution; **WF-12** contextual change history; **WF-13** typed relationships. Single native Copilot and QA-session UX already described. | Integrate per-item current/past/draft view and independent requirement/skill histories into WF-10/12/13. Do not add another top-level page or independent review workspace. |
| **03_TECHNICAL_DESIGN** | \`ai_generation_requests\`/Zyra staging, \`zyraSaveAttempt\`, V63 testcase history, V119 run snapshots, KB versioning, shared guarded selected apply; §10 stable operation/receipt; **revision 1.4.8 expressly proposes one \`qa_guide\` identity with immutable revisions, scope/inheritance/effective manifest and source-linked consumption**. Modular monolith. | Prior GAE idea for new \`asset_change_set\` or \`qa_skill\` storage is **not justified unchanged**. First show which existing shared staging/review and \`qa_guide\` constructs cannot express new per-asset draft/version/publishing invariants; no competing writer/table until negative-design proof. |
| **04_MCP_API_CONTRACTS** | Existing proposed task/report/proposal operations, \`list_case_versions\`/\`get_case_version\`, \`propose_qa_guide_revision\`, draft amendments and product discovery. **Initial no-agent-merge** prohibits assistant credentials from approving/publishing in MVP. | Extend proposed history/diff/guide/impact APIs, not a duplicate MCP catalogue. A true agent auto-publish capability needs an explicit authorization/policy revision and denial tests across direct REST/MCP/import/Zyra paths. |
| **05_IMPLEMENTATION_BACKLOG_AND_TEST_PLAN** | **T-304** shared review, **T-422** QA Standards & Playbooks, **T-407/T-409/T-411–414** sessions/Copilot/project MCP. **QA-242–248** guide/version and case-history checks; **QA-261–268** typed relationships, hover/focus and historical checks; **QA-404–423** session learning/discovery. | Extend existing backlog IDs with scoped changes/dependencies. New QA IDs only for genuinely missing per-requirement/skill publication streams, auto-policy security, all-field/attachment consistency and multi-asset transaction tests. Do not count any planned scenario as executed. |
| **06_IMPLEMENTATION_AGENT_BRIEF** | Read all eight, protect exact human-reviewed publication, source-first reuse, no duplicate spec package, PR-only development and no deployment claim without proof. | Update brief in place only once owner approves the amended policy and actual implementation sequence. This review document is a *review input*, never a ninth new agent instruction package. |
| **07_UI_DESIGN_TASKS** | **D-05** shared Change requests; **D-13** Copilot; **D-14** QA Standards & Playbooks; **D-15** finding/case evolution; **D-16/D-17** action history and contextual microhistory; **D-18** Learning & Product Discoveries in Sessions. Authentic current-screen proof mandatory. | Extend existing row/detail/drawer/history/compare/reviewer UI with per-asset version, drafts, field/link/evidence diff, accessibility, and Copilot deep-link. Reconstruct actual source and running UI before asserting visual parity. |

**New semantic scope is not zero:** GAE requests that every **individual requirement and skill** has its own approved published version and draft iteration history, just as each case does, with comprehensive field/linked-object history and a new optional auto-update governance mode. The original pack specifies important pieces but does not fully settle this combined model.

### 18.3 Owner-policy conflict (GAE-18-02, MUST resolve before auto implementation)

Current **P-07, FR-032/033/037, MCP no-agent-merge and the implementation brief** require an authenticated **human** to approve an exact revision and separately apply selected operations into protected official records. The user subsequently requested **two modes**: automatic agent application of authorized case/requirement/skill updates, or manual approval in the application. This is a real, deliberate change request, not an already-approved exception.

**Proposed safe reconciliation for owner's decision:**
- Manual remains binding for all protected publication **until** the eight originals are amended. Automatic proposal preparation can be implemented without publication authority; do not falsely call it the requested auto-publishing feature.
- An opt-in automatic publish policy, if ratified, must bind project, actor/client/runtime, asset type, fields/operation, effective guide/skill, base revision, approval-risk class, temporal budget, revocation and an exact durable signed policy decision. A generic \`read/write\` MCP token or “AI approved=true” is never a delegation.
- Preserve mandatory human review for sensitive authoritative requirement semantics, security/evidence retention policy, executable guide/skill safety constraints, cross-project links and historical accepted results unless a separately ratified bounded exception exists. A policy author cannot be its own unreviewed privileged publisher.
- Revise P-07/FR-033, affected Workflow/Technical/MCP/Backlog/Agent Brief/UI sections **together**, then test denied direct bypasses, revocation/lease races, mixed client identity, stale version, lost commit ACK and actual approved auto apply through the same guarded domain service. A proposal is never a publication receipt.
- Normal case changes still preserve revisioned exact history, relationship impact and old run evidence. “Auto” must not silently rewrite linked neighbours or external Jira/Linear/Notion requirements.

### 18.4 Second-pass adversarial counterexamples against original 1.4.18 (desk review, NOT independent team agent)

| Test challenge | Expected truth / disposition |
|---|---|
| Create a second skills registry though \`qa_guide\` revisions and effective playbooks already planned | **Reject duplication**; reuse/extend QA Standards & Playbooks, document any necessary difference between executable skills and policy/authoring guide. |
| Auto agent invokes legacy \`update_testcase\`, bulk REST, MCP or Zyra save with only read/write token | **Denied** without specifically approved effective automatic policy; current source does not demonstrate that future restriction. |
| Agent edits only a requirement link, file attachment, tag or custom-field value | Must appear in one truthful asset/relationship/artifact timeline; absence of testcase text difference is not “no change.” |
| Publish REQ-X v4 while TC-A stays valid v2 and TC-B needs update | Keep independent per-asset versions, relationship-version validation, explicit unknowns and an unchanged legitimate neighbour; no blanket versions. |
| Human edits a submitted proposal after reviewing it | Review must invalidate stale approval; protect exact change-set hash, dependencies and revision. |
| Requirement mirrored from external Jira loses upstream version | Mark \`UNKNOWN/needs oracle\`, never claim Tesbo can approve changes to Jira source automatically. |
| GAE historical runs use V119 backfilled snapshot | Mark \`reconstructed_later\`, not original vN-tested truth; no manufactured historic pass. |
| Copilot shares a private draft in cached context after role/project/session switch | Fail authorization and clear/hide cached excerpts at use time; maintain own QA-session source boundaries. |
| G0 “simulation” result is uploaded as if real OpenCode/browser evidence | Explicitly reject product PASS; original immutable report bytes, client and build proof required for G2. |
| New spec is marked approved because documentation CI is green | **Reject**: original eight have not been amended/approved; reviewers/Graph/White and real tests remain outstanding. |

This pass was performed by the same assistant reading recovered indexed sources. It is **not** an independently run second engineering agent, actual GitHub project-code execution, real client integration, or formal White freeze.

### 18.5 Recommended owner-reviewed integration order

1. Resolve **P-07 / FR-033** change request concerning scoped auto publication; define allowed/forbidden operations and human-only exceptions.
2. Amend **the same eight canonical source files in place**, preserving existing IDs and content; update active revision/changelog and exact file/ZIP receipts. Original indexed sources are readable but were **not** available for authorized raw-byte replacement in this turn, so this PR must not claim that step completed.
3. Reconcile against current Tesbo \`development\` code (later than original audit \`124f128\`) and all current mutation/read paths. Show REUSE/EXTEND/NEW with negative proof.
4. Obtain a genuinely independent cold review, a full actor/source/route/lifecycle journey inventory, deterministic Graph checks and White gate. Prior role-lens desk passes do not substitute for those.
5. After owner design approval, implement first bounded extension of **shared review/publishing and \`qa_guide\`** with real migrated PostgreSQL/auth/MCP/browser denial and history tests. Do not prematurely start the goal-led executor or invent a new test-management service.

**Review status:** INTEGRATION READY FOR OWNER DISCUSSION; **NOT APPROVED, NOT FULLY ASSURED, NOT IMPLEMENTED**. No original eight-file source was overwritten, no target/project data was changed and no app migration/test/deploy was executed for this review.

## References and provenance

**Internal verified source:** Tesbo \`development\` — \`V2\`, \`V45\`, \`V62\`, \`V63\`, \`V94\`, \`V102\`, \`V119\`, \`V141\`, \`V143\` migrations; current MCP \`mcp.tools.ts\`; Zyra task review; existing documentation. Nesberry \`main\` — \`.kiro/steering/teams/review-orchestration.md\`, \`docs/reviews/assurance-full-chain-reachability-proposal.md\`, \`docs/reviews/ASSURANCE-PORTABILITY-REVIEW-2026-11-09.md\`; these provide portability and complete-chain review disciplines but do not automatically authorize Tesbo design.

**Public patterns consulted:** HTTP conditional requests/strong ETag (\`RFC 9110\`); JSON Patch (\`RFC 6902\`); PostgreSQL MVCC, row locks and atomic transactions; established draft/review/versioning patterns from test management and code review tools. These inform the candidate design, not a claim that Tesbo already implements them.

**Status of this document:** proposal and evidence-backed gap inventory. Approval, implementation work and cross-product transfer validation remain separate.
