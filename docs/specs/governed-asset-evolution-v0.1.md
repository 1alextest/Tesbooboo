# Tesbo — Governed Asset Evolution
**Living specification v0.2 · DRAFT FOR REVIEW · 2026-11-12**

**Status:** Proposed design only. Not an approved product contract, implementation authorization, migration, or Phase 2 sign-off.

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

## 12. Closure of previously identified gaps (contract-level, not implementation claims)

**GAE-C01 — Full field/association coverage.** Before writing a migration or redirecting a writer, inventory all user-visible and domain-semantic fields in current \`testcases\`, \`testcase_versions\`, \`knowledge_documents\`, \`knowledge_document_versions\`, custom-field tables, tags, attachment/evidence tables, ticket/Notion links, suite/membership relationships, run snapshots, review records, and other source-backed fields. For **each** record its owning writer(s), affected consumers, whether it belongs to the published snapshot, draft, linked relation, evidence binding or operational audit, and the required authorization. Every field—including those not on a form and new fields introduced later—MUST be classified. Schema/API contract changes require updating this manifest and its parity tests; unknown fields fail the coverage gate rather than disappearing from history.

**GAE-C02 — Typed, exact comparisons.** Show the before and after for text, structured step identity/order, typed values, null/empty/omitted states, sets, custom fields and document bodies. Use stable step IDs if already supported or add a backwards-compatible mapping only with migration proof; do not infer step moves from ordinal edits without confidence. Every attachment, citation, evidence object and link is a typed association with identity, order (when relevant), hash/revision, provenance and visibility. Record a removal as a historical detachment rather than erasing bytes or links. Sensitive values appear redacted with change metadata and authorization-appropriate diff; do not leak historical secrets.

**GAE-C03 — Draft/published separation and meaningful versions.** Latest approved *published* revision is current. A working draft may have multiple saved iterations and remains unpublished until guarded promotion. Historical approved revisions stay historically approved; rejected/draft versions never consume published numbers. All fields must be **auditable**, but generated operational state (timestamp, embedding status, cache index, worker activity) does not automatically create a newly approved semantic asset version. Classify such events explicitly, show them under Activity, and require source-derived agreement before excluding any domain field. No-op and repeated commands do not inflate versions.

**GAE-C04 — Concurrency and approval freshness.** Revision preconditions cover asset content, relevant relationship heads, draft iteration, review payload hash and policy version. If a linked requirement or publishing policy changes while a proposal awaits approval, recalculate impact and invalidate stale authorization/approvals as appropriate. Disjoint-field edits require a controlled merge with invariant checking; do not silently merge merely because paths differ. Draft proposal/comment changes after review void earlier approvals of the affected revision. A cross-tab/network-lost COMMIT acknowledgement resolves by idempotency key + authoritative read before retry.

**GAE-C05 — Link integrity beyond direct requirements.** Maintain version-aware bidirectional edges for source requirements, cases, suites, plans, run manifests, skills, defects, external tickets, attachments and actual evidence consumers. Separate *stable identity linkage* from *validated coverage of a particular revision*. Each edge has its own version/event history, effective interval and status; linked text changes do not automatically version an unaffected neighbour. A change-set's impact report must account for upstream producers, downstream readers, affected and unchanged valid neighbours, unresolved and hidden/deleted dependencies, authorization-bounded consumers, and cross-project references. Unknown coverage is not zero. The existing Jira/Linear/Notion columns remain compatible until a separately verified one-owner migration design exists.

**GAE-C06 — Run immutability and insight.** Existing V119 point-in-time run snapshots are reused; manifest-managed runs additionally pin the exact published case/requirement/skill revisions, relationship validation, source hash and build. Published changes, link removals, soft-deletion and restoration cannot modify historical attempts/evidence or finalized verdicts. Historical data may inform trend/coverage insight, but trend labels must distinguish observed facts, inferred changes and reconstructed legacy baselines. A historical test that passed under REQ v2 is not counted as newly verified coverage of REQ v3.

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

## 14. Decision and risk register for first implementation

Before implementation, get explicit product-owner decisions on: whether Copilot **extends Zyra** or reuses its backend while unifying the visible conversation, draft visibility and who may grant it, who can enable auto mode and allowed field classes, self-approval protections, source authority precedence, revision retention/redaction, and whether a change set may be partially approved as explicitly separate subchanges. Default proposals: manual publication, owner-managed private drafts, no self-approval of safety/authority changes, and an **indivisible atomic sub-change-set** for every dependency group. A rejected subset must not be silently treated as applied to remaining assets; re-assess the graph and base revisions before partial approval.

A future PR must prove: (1) compatibility with current APIs, (2) no alternate data store for Copilot context, (3) complete authoring and relationship histories, (4) fine-grained permission enforcement and RAG retrieval isolation, (5) source-to-current-UI fidelity, (6) downstream read/export/report/notification correctness, (7) real PostgreSQL commit/rollback/concurrency evidence, and (8) an explicitly bounded migration/retention strategy.

## References and provenance

**Internal verified source:** Tesbo \`development\` — \`V2\`, \`V45\`, \`V62\`, \`V63\`, \`V94\`, \`V102\`, \`V119\`, \`V141\`, \`V143\` migrations; current MCP \`mcp.tools.ts\`; Zyra task review; existing documentation. Nesberry \`main\` — \`.kiro/steering/teams/review-orchestration.md\`, \`docs/reviews/assurance-full-chain-reachability-proposal.md\`, \`docs/reviews/ASSURANCE-PORTABILITY-REVIEW-2026-11-09.md\`; these provide portability and complete-chain review disciplines but do not automatically authorize Tesbo design.

**Public patterns consulted:** HTTP conditional requests/strong ETag (\`RFC 9110\`); JSON Patch (\`RFC 6902\`); PostgreSQL MVCC, row locks and atomic transactions; established draft/review/versioning patterns from test management and code review tools. These inform the candidate design, not a claim that Tesbo already implements them.

**Status of this document:** proposal and evidence-backed gap inventory. Approval, implementation work and cross-product transfer validation remain separate.
