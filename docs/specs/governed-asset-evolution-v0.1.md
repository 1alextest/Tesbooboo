# Tesbo — Governed Asset Evolution
**Specification v0.1 · DRAFT FOR REVIEW · 2026-11-12**

**Status:** Proposed design only. Not an approved product contract, implementation authorization, migration, or Phase 2 sign-off.

**Scope:** Independently versioned test cases, requirements, and testing skills; granular field-and-related-artifact history; working drafts; auto/manual approval; version-aware relationships and run provenance. Applies across projects and applications. Nesberry is an initial application binding, not the generic data model.

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

A planned execution stores its frozen testcase/requirement/skill revision IDs and snapshot hashes; current edits cannot alter its interpretation. The current V119 field snapshots are useful but not the same as explicit approved revision bindings. New discovered cases during execution remain \`supplemental\` until reviewed; existing automation ingest may attach cases and must not silently grow a frozen planned denominator. Preserve all attempts, previous failures, evidence, blocked, inconclusive and tool errors separately from the eventual verified product verdict.

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

## References and provenance

**Internal verified source:** Tesbo \`development\` — \`V2\`, \`V45\`, \`V62\`, \`V63\`, \`V94\`, \`V102\`, \`V119\`, \`V141\`, \`V143\` migrations; current MCP \`mcp.tools.ts\`; Zyra task review; existing documentation. Nesberry \`main\` — \`.kiro/steering/teams/review-orchestration.md\`, \`docs/reviews/assurance-full-chain-reachability-proposal.md\`, \`docs/reviews/ASSURANCE-PORTABILITY-REVIEW-2026-11-09.md\`; these provide portability and complete-chain review disciplines but do not automatically authorize Tesbo design.

**Public patterns consulted:** HTTP conditional requests/strong ETag (\`RFC 9110\`); JSON Patch (\`RFC 6902\`); PostgreSQL MVCC, row locks and atomic transactions; established draft/review/versioning patterns from test management and code review tools. These inform the candidate design, not a claim that Tesbo already implements them.

**Status of this document:** proposal and evidence-backed gap inventory. Approval, implementation work and cross-product transfer validation remain separate.
