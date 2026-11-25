# Work Package B — Governed manuals and policies (design note, first slice)

**Status:** Draft for review. Not approved, not frozen, no acceptance claimed.
**Date:** 2026-11-23
**Scope owner:** existing Knowledge Base document identity, folders and governed
`knowledge_document_versions`; existing shared review machinery.
**Source:** `docs/specs/agent-synchronized-engineering/implementation-plan.md` Work Package B; `design.md`
native-KB ownership; `AGENT_RULE_TEMPLATE.md`; R-ASE-06.

---

## 1. First-slice scope

This note begins the Work Package B workflow. The first slice is deliberately bounded to:

- authoring a **user manual** or **policy** in the existing KB;
- a typed metadata extension that keeps audience, subtype, confidentiality, distribution, source authority,
  effectivity and enforcement references distinct;
- submitting an exact version through the existing governed-version writer;
- an owner/manager exact-version approve/reject decision through the shared review machinery;
- immutable history, exact-version content and authoritative readback in the KB document surface (a computed
  submitted-vs-current diff is a follow-up; the full exact snapshot is shown).

It does **not** yet implement effective manual/policy Skill staging or agent-authored candidate apply,
audience-specific public views, policy enforcement execution, or Zyra exposure of the new types. Those are
explicit follow-ups/owner decisions in §8, not silently claimed.

---

## 2. Existing representation (source-verified)

| Capability | Existing representation | What it covers / does not cover |
| --- | --- | --- |
| Document identity and folder | `knowledge_documents` (`id`, `organization_id`, `project_id`, `folder_id`, `title`, `is_deleted`) | Reused unchanged. |
| Body and editor content | `knowledge_documents.content_json` (TipTap document), `content_html`, `content_text` | `content_json` is the editor's document body. It is not a place for governance metadata without corrupting the editor contract. |
| Type and review status | `document_type` (V45/V159 CHECK), `status`, `is_ai_generated`, `reviewed_by`, `reviewed_at`, `reviewed_version_id` | Review status exists. There is no manual/policy type and no generic governed-document decision. |
| Provider provenance | `source_provider`, `source_external_id`, `source_url`, `source_role`, `source_synced_by/at`, `is_read_only` | Provider-owned mirrors are read-only and carry their actual provenance. Legacy rows keep these values. |
| Version substrate | `knowledge_document_versions` (`version_number`, exact title/content copies, `snapshot_kind` submitted/approved/rejected, `snapshot_metadata`, `submission_key`, `changed_summary`, `changed_fields`, immutability trigger) | Immutable exact versions and review snapshots exist. `snapshot_metadata.contentDigest` binds the exact document bytes. |
| Governed writer | `writeKnowledgeGovernedVersion` (submitted/approved/rejected) | Writes immutable snapshots with actor, authority, digest and source binding. Reused. |
| Submission | `submitKnowledgeDocument` with `expectedRevision` + `submissionKey` | Exact-revision, idempotent submitted snapshot. Reused. |
| Existing approvals | `approveRequirementVersion`, AI-memory review | Requirement-specific or AI-memory-specific. No generic manual/policy approval. |
| Revision and digest | `KNOWLEDGE_DOCUMENT_REVISION_SQL`, `knowledgeDocumentContentDigest` | Revision hashes the current row; digest binds project/folder/title/body/type/source. Governance metadata must participate or an approval could survive a metadata change. |
| AI context exposure | `knowledgeDocumentAiContextSql` | Non-`ai_memory` documents are currently eligible for AI context without an approval/exposure gate. New confidential/external types must be excluded until a policy exists. |
| KB UI | Document templates/types, editor, history/diff (`ChangeHistoryList`), AI-memory review | Authoring/history/diff components are reusable. There is no manual/policy metadata form, submit-for-review control, or generic exact-version decision panel. |

### 2.1 Exact gap

1. `document_type` does not admit `user_manual` or `policy` (V45/V159 CHECK).
2. Audience, subtype, confidentiality, distribution, source authority, effectivity and enforcement references have
   no typed, queryable representation. `source_role` describes provider mirror/notes, not audience or authority;
   `status` describes review state, not effectivity.
3. There is no owner/manager exact-version decision for these types; only AI memory and requirements are approved.
4. New non-`ai_memory` types would be eligible for Zyra context under the current SQL, which would leak a
   confidential/external document without an exposure policy.

---

## 3. Narrow typed extension

### 3.1 Schema

Add to `knowledge_documents` (new migration):

```sql
ALTER TABLE knowledge_documents DROP CONSTRAINT knowledge_documents_document_type_check;
ALTER TABLE knowledge_documents ADD CONSTRAINT knowledge_documents_document_type_check
  CHECK (document_type IN ('general','requirement_note','test_data_note','api_note','release_note','ai_memory','skill','user_manual','policy'));

ALTER TABLE knowledge_documents
  ADD COLUMN governed_metadata JSONB NOT NULL DEFAULT '{}'::jsonb
  CHECK (jsonb_typeof(governed_metadata) = 'object');
```

`governed_metadata` is the current typed projection; every submitted/approved/rejected version snapshot records the
exact metadata and includes it in the content digest. Legacy rows default to `{}` and keep their existing digests,
source fields and review state.

### 3.2 Field contract

For `user_manual` and `policy` only:

```jsonc
{
  "schemaVersion": "tesbo-governed-document/1",
  "audience": "internal" | "external",
  "subtype": "<type-specific value>",
  "confidentiality": "public" | "internal" | "confidential" | "restricted",
  "distribution": "internal" | "external" | "withheld",
  "sourceAuthority": {
    "kind": "internal" | "external" | "regulatory" | "contractual" | "other",
    "label": "1-200 chars",
    "reference": "1-500 chars or null"
  },
  "effectivity": {
    "from": "YYYY-MM-DD or null",
    "to": "YYYY-MM-DD or null"
  },
  "enforcementRefs": ["0-20 strings, each 1-500 chars, policy only"]
}
```

- Manual subtypes: `manual`, `quick_start`, `reference`, `runbook`.
- Policy subtypes: `policy`, `standard`, `procedure`, `guideline`.
- Non-governed document types must keep `{}`; unknown keys are rejected for governed types.
- Dates must be real calendar dates. `Date.parse` rolls `2026-02-31` forward to March, so validation
  round-trips the parsed value through `toISOString().slice(0, 10)` and compares it with the input.
- `effectivity.from <= effectivity.to` when both exist.
- No implicit relation between audience, distribution and confidentiality: an external-audience document can be
  withheld from distribution; a public-confidentiality document can still be internal-audience; source authority is
  not approval.
- Approval is **not** a metadata field. It is the existing `status` + `reviewed_*` + exact approved snapshot.
- Effectivity is **not** approval: an approved document can be future-effective or expired.

### 3.3 Digest and snapshot invariants

- `knowledgeDocumentContentDigest` includes `governed_metadata` when it is non-empty; legacy `{}` rows keep their
  existing digest basis.
- `writeKnowledgeGovernedVersion` records `governedMetadata` and the exact `contentDigest` in the immutable snapshot.
- Approval requires the submitted version's digest to match the current document exactly, so a metadata edit after
  submission invalidates the old approval.
- Restoring a governed decision snapshot restores the snapshot's content **and** metadata together. Autosave
  snapshots carry no metadata, so restoring one keeps the current metadata and the trigger re-drafts the document;
  that narrower exception is recorded in §8.12.

### 3.4 Writers / readers

| Surface | Change |
| --- | --- |
| `createKnowledgeDocument` | Accept and validate `governedMetadata`; default `{}`; new types require the full contract. |
| `updateKnowledgeDocument` / `writeKnowledgeDocument` | Accept, validate, store; treat a metadata change as content changed; exact-revision CAS. |
| `submitKnowledgeDocument` | Snapshots the exact document including metadata; only a `draft` can be submitted, and a repeat of the same `submissionKey` still returns its original receipt after a later decision. |
| New `approveGovernedKnowledgeDocument` / `rejectGovernedKnowledgeDocument` | Owner/manager human-session exact-version decision for manual/policy; content digest; approved/rejected snapshot; `reviewed_version_id`/status; replay; stale conflict. |
| `restoreKnowledgeDocumentVersion` | For governed types, restore the snapshot's governed metadata with the body. |
| `getKnowledgeDocument` / list / version history | Return metadata and snapshot metadata. |
| KB UI | Type templates, metadata form, submit-for-review, exact submitted-version review/readback/approve/reject, a read-only exact-version timeline, and history. Submit routes through the editor write queue and writes the current editor body + metadata before the exact submission. |
| Zyra AI context / RAG | New types excluded until the exposure policy in §8 is approved. New and duplicated governed rows are created `embedding_status='unsupported'`; the boot sweep and embedding processor also exclude `user_manual`/`policy` so a status reset or an already-queued job cannot leak text. |

### 3.4.1 Ambiguous Submit recovery

A governed Submit crosses two distinct server commits: editor UPDATE and immutable submission POST.
The editor write queue serializes these client actions but does not make them an atomic DB transaction.
After UPDATE acknowledges, retain the returned edit revision, immutable submission key, and
a snapshot fingerprint of the editor title/body/metadata. If POST fails or its response is lost,
the next same-key attempt must **not repeat UPDATE**: first read the authoritative document
and replay POST with the original revision/key. The server's exact-key receipt resolves
a prior successful POST, even if a later decision changed document status. Reject retries
after intervening local editor changes rather than quietly submitting a different draft.
Keep pending ambiguity on network/readback failure; never manufacture success.

Regression coverage: KBU-72 proves pre-UPDATE failure retains the editor draft without a
submission. KBU-73 runs both pre-POST-commit failure and post-commit response loss,
verifies same-key replay, no duplicate editor UPDATE, one immutable submitted version,
and preservation of visible content. KBU-74 forces a competing external edit after the
first POST fails and asserts that retry neither overwrites the competing revision nor
manufactures a submitted snapshot, while retaining the visible local draft. KBU-75 verifies that an exact-key retry
returns the existing immutable submission receipt even when an authorized owner has
already approved that version; retry must not rewrite or re-open the approved document.
KBU-77 verifies a separate local-edit race: a title edited while the governed save/submit
request is in flight must remain visible and unsaved rather than being overwritten by
the older acknowledged response. This matches ordinary editor save revision fencing. Official Tesbo execution remains
distinct from the Playwright CI result.

### 3.5 Mutation permission matrix

All governed mutation paths use the shared `assertAgentMayTouchGoverned` owner (and its folder-subtree counterpart)
and the existing KB role rules. The agent restriction is re-checked against the **locked** document inside the write
transaction, so a document that becomes governed while a token operation waits is refused before any write, folder
change or version snapshot. Folder delete/restore/move are refused for a token when the subtree contains a governed
document, because the cascade would archive, unarchive or relocate it.

| Operation | Human session | API/MCP token | Notes |
| --- | --- | --- | --- |
| create governed | any project member (as before) | refused | token cannot originate governed types or `governedMetadata` |
| update / submit | creator, owner or manager; submit only from `draft` | refused | exact-revision CAS; submit snapshots body + metadata |
| duplicate | any project member with project access | refused for a governed source | copies the locked source's type/metadata; new row is a draft |
| move | creator, owner or manager | refused | locked type re-check; trigger re-drafts when folder changes |
| restore-version | creator, owner or manager | refused | locked type re-check; restores body + decision-snapshot metadata |
| archive (delete) | creator, owner or manager | refused | soft delete only; no approval change while archived |
| unarchive | owner or manager | refused | locked type re-check; original provenance preserved |
| approve / reject | owner or manager, human session | refused (`HUMAN_REVIEW_REQUIRED`) | exact submitted version; manager aliases normalized |

**Unresolved permission policy (owner evidence):** the matrix deliberately keeps governed authoring available to
any project member, matching the existing KB create rule, while approval remains owner/manager. A project may want
authoring restricted to owners/managers or to a named document role; that is a product decision because it changes
who can originate a manual/policy draft. Archive is also currently refused to agent tokens even though it changes
no content; the alternative is to allow archive/unarchive for tokens while keeping content/metadata/status writes
closed. Both alternatives are tracked, not implemented.

---

## 4. Decision semantics

1. An authorised owner/manager chooses **the exact submitted version**; the decision is `approved` or `rejected`.
2. Approval writes one approved snapshot with `authority: "governed_document_review"`, `sourceVersionId`, and the
   exact metadata/digest; it sets `status='approved'` and `reviewed_version_id`.
3. Rejection writes one rejected snapshot with the source version and reason; it sets `status='rejected'` and also
   sets `reviewed_version_id` to that rejected decision snapshot. `reviewed_version_id` names the exact decision
   snapshot, not an approval flag; `status` and the snapshot kind carry approved vs rejected. A rejection therefore
   never creates an approved binding by itself.
4. A later edit clears the exact binding through the existing review-invalidation rules; a stale approval is refused.
5. A QA reader can read/author where the existing KB mutation rule allows but cannot approve/reject.
6. Agent-authored content remains a draft/submission until this human decision; no agent token can approve.
7. The UI's current decision comes from the document's `reviewed_version_id` + `status`, joined to that exact
   snapshot. History can retain an older approval after an edit, but it is not reported as current. Supersession
   uses the latest decision snapshot and the submitted snapshot's bound content, so a later rejection supersedes an
   approval and an edited undecided submission is not offered for a decision.

---

## 5. Exposure and confidentiality

`knowledgeDocumentAiContextSql` currently admits every non-`ai_memory` document. The first slice must add:

```sql
AND document_type NOT IN ('user_manual','policy')
```

to the non-memory branch, and skip `enqueueEmbedding` for the new types. New and duplicated governed rows are
created with `embedding_status='unsupported'`, and both the boot-time `resumeInterruptedEmbeddings` sweep and
`RagEmbeddingProcessor` also exclude by document type. The type filter is the durable guard: a future migration
that resets terminal statuses (V85 did this for a dimension change) or a job queued before the item became governed
still cannot put its text on the embedding wire. This is a deliberate containment boundary, not a final exposure
policy. An approved document does not become Zyra-visible merely because it is approved.

---

## 6. UI reuse

- KB document templates/labels gain Manual and Policy.
- The document page gains a governance metadata form and a submit-for-review action using the existing exact-revision
  submission.
- The review card loads the exact submitted version through the existing version endpoint, renders it with the shared
  `VersionContent`, shows typed metadata and the existing `ChangeHistoryList`/diff, and offers approve/reject to an
  owner/manager only.
- Readback shows current status, reviewed version, exact metadata, authority/effectivity and immutable history.

---

## 7. Verification

- DB/API: metadata validation (valid, missing, unknown key, invalid enum/impossible date/inverted effectivity/
  misplaced refs), duplicate metadata preservation and embedding hold, legacy `{}` compatibility, digest change on
  metadata edit, submitted snapshot metadata, owner approve, QA refusal, stale approval, lost-response replay,
  later rejection superseding an earlier approval, AI-context exclusion for draft and approved governed documents,
  owner/manager API approval, QA engineers, guests and unauthenticated users refused; project boundary 404; machine API token
  `HUMAN_REVIEW_REQUIRED`, refusal of agent-token governed creation/update, a policy with enforcement references
  through submit/approve, replay, and refusal of a governed→general type change.
- UI: author a manual/policy with metadata, submit, owner reviews the exact version and its metadata and approves;
  QA is refused while the owner still has the actions (not after a decision hides them); an edit clears the
  reported decision even though history keeps the snapshot; a later rejection supersedes the approval on reload;
  exact-version history/readback. The Zyra context picker filters governed documents before a selection can copy
  their body into task context; the API/RAG gates remain the authoritative exclusion.
- Native Tesbo: REQ-WPB-01 task `d5b7ab51-1c6b-460b-971f-280d1f567edb` staged; execution UNRUN until human apply.

---

## 8. Follow-ups and owner decisions

1. **Effective manual/policy Skills.** The first slice does not stage or pin effective manual/policy Skills. Work
   Package B requires them for agent-authored candidates. Do not treat this slice as full WP-B closure.
2. **Exposure policy.** When may an approved manual/policy enter Zyra context? Which audience/confidentiality/
   distribution/effectivity combinations are eligible? The first slice is intentionally dark.
3. **Rejection binding (decided for this slice).** A rejected decision records a rejected snapshot and sets both
   `status='rejected'` and `reviewed_version_id` to that rejected decision snapshot. `reviewed_version_id` identifies
   the exact decision snapshot, while `status` and snapshot kind distinguish approved from rejected; no approved
   binding is created. Revisit only if a consumer needs to interpret `reviewed_version_id` as approval-only.
4. **Distribution semantics.** The first slice uses `internal | external | withheld` as a scope. If distribution is a
   channel list or per-recipient entitlement, that is a wider model requiring a separate decision.
5. **Policy enforcement references.** The first slice stores references only; it does not execute or enforce them.
6. **Audience-specific views.** Internal/external views and section-level review are not part of this first slice.
7. **Changing a decision on the same exact version.** The API currently allows a later opposite decision on the same
   submitted version (matching digest), recording a second snapshot and flipping `status`; the UI hides the actions
   once a version is decided. Treating a decision as final or as a deliberate "change of mind" is a governance
   decision. Until it is made, do not rely on API finality; the snapshot history preserves both decisions.
8. **`reviewBinding` read model.** `reviewBinding='exact_snapshot'` currently means "an exact decision snapshot is
   bound", including a rejection. Consumers that require approval semantics must also check `status`; the governed
   panel does. Splitting approval/rejection into separate read fields is a follow-up once a consumer needs it.
9. **Newer submission supersedes an older one (implemented).** The governed reviewer refuses a version when a newer
   `submitted` snapshot exists (`GOVERNED_VERSION_SUPERSEDED`), matching the Skill reviewer. A lost-response replay
   of the already-recorded decision still returns its receipt first.
10. **One-time `editRevision` change on deploy.** Adding `governed_metadata` changes the legacy `editRevision` hash
    once for every row. A client holding a pre-deploy revision sees a `DOCUMENT_REVISION_CONFLICT` and must reload.
    No persisted state depends on the old value; excluding the column from the hash would let concurrent metadata
    edits bypass the CAS, so the one-time invalidation is deliberate.
11. **Sweep exclusion test depth.** The processor exclusion is behavioural; the boot sweep is asserted by its SQL
    predicate because the query is global across projects and a DB fixture would contend with unrelated pending rows.
    The terminal `embedding_status='unsupported'` state is asserted through the real DB.
12. **Autosave restore metadata.** Decision snapshots carry the exact governance metadata; autosave snapshots do not.
    Restoring an autosave therefore keeps the current metadata and the trigger re-drafts the document. Restore of a
    decision snapshot restores its metadata with the body.
13. **Agent write boundary for governed documents.** API-token principals are refused when they create a
    `user_manual`/`policy`, supply `governedMetadata`, update/submit a governed document, duplicate one, move it,
    restore one of its versions, archive it or unarchive it. The REST controller and MCP handlers pass the token
    principal; the service enforces it across those paths, re-checking the locked document type for operations that
    wait on a row lock. Folder delete/restore/move are refused for a token when their subtree contains a governed
    document, since the cascade would archive, unarchive or relocate it. Agents may still read/list governed
    documents and their metadata, and none of them can set `status` or approve. This is a containment rule for the
    first slice, not a complete MCP schema; a future governed-authoring contract would need an explicit human-review
    design.
14. **Submit binds the current editor state (implemented).** Save metadata, Submit and decisions run through the
    document write queue. Submit cancels a pending debounce and writes the current title/body + metadata in one
    operation, then submits that returned revision. A failed save or stale revision leaves the draft in the editor,
    surfaces the API error and does not submit; retries reuse the pending submission key until it succeeds.
15. **Zyra context picker (filtered).** The task composer no longer offers `user_manual`/`policy` documents,
    because selecting one copies its full text into the task context sent to the model. The backend snapshot and
    AI-context gates remain authoritative; a future exposure policy may reintroduce an explicitly labelled option.
16. **Submitted-vs-current diff.** Governed snapshots intentionally carry no changed summary/fields, so the history
    list does not render a text diff for them. The panel shows the complete exact snapshot and its metadata; a
    computed diff against the current working copy is a follow-up, not a current capability.

### 8.1 Owner decision brief — decision reversal on the same exact version

**Question:** may an owner or manager reverse an already-recorded approval/rejection on the same submitted version?

**Current evidence:** `reviewGovernedKnowledgeDocument` only replays when `reviewed_version_id` points at a decision
snapshot with the same kind and `sourceVersionId`. A later opposite call with the same matching digest creates a
second decision snapshot, flips `status` and rewrites `reviewed_version_id`; the UI hides actions once decided.

**Options and consequences:**

- **Final decision (block opposite calls):** simplest auditor story and matches the current UI; an accidental or
  mistaken approval needs a new submission/revision, which is a heavier but more defensible correction path.
- **Explicit reversal (allow, require a reason, label it as a reversal):** matches the API's current capability and
  supports genuine changes of mind without editing content; requires a new receipt/UI affordance and consumers must
  read the latest decision snapshot rather than assume one decision per version.
- **Recommended pending decision:** keep the API's recorded reversals during the pilot but do not present them as a
  supported workflow; add an explicit reversal endpoint/UI and reason before relying on it. No silent change.

### 8.2 Owner decision brief — future AI-context exposure

**Question:** which approved manuals/policies, if any, may enter Zyra context or RAG?

**Current evidence:** every governed row is created `embedding_status='unsupported'`; the boot sweep and embedding
processor exclude `user_manual`/`policy`; `knowledgeDocumentAiContextSql` excludes them from both the non-memory and
the approved-memory branches; the task-composer picker filters them. No governed content is *automatically* admitted to
Zyra context/RAG. A read-scope MCP token can still explicitly fetch a governed document through
`get_knowledge_document`; closing that explicit-read path is part of the exposure decision, not a claim of this slice.

**Options and consequences:**

- **Remain dark (current):** strongest confidentiality posture; owners must read manuals/policies in the KB and
  cannot use them as Zyra context, including for policy-aware generation.
- **Explicit selection only (recommended first exposure):** allow an owner to mark one exact approved revision as
  context-eligible per project, with audience/distribution/confidentiality checks and a visible receipt; requires a
  new eligibility field/decision and retrieval/audit tests.
- **Automatic by metadata:** derive eligibility from confidentiality/distribution/effectivity; risks silently
  admitting content when metadata is wrong or a policy becomes effective, and needs a durable enforcement model.

Do not change the exposure gate or embedding hold until the owner chooses an option and the corresponding retrieval,
audit and UI contract is reviewed. GitHub CI is not evidence that native publication/execution occurred.

---

## 9. Agent-authored manual/policy proposals (next workflow)

The existing proposal task owner (`ai_generation_requests`) now carries one inert managed-document candidate under
provider `external_document_proposal`. The candidate is not a knowledge document and does not alter the target.

- **Payload.** `opType='managed_document_revision'`, `operation='create'|'update'`, `documentType`, optional
  `documentId`/`targetEditRevision`, create-only `folderId`, a `document` with `title`, `governedMetadata` and the
  proposed `contentJson`/`contentHtml`/`contentText` representations, and a producer `reason`. On update an
  omitted representation means "preserve the current one"; it is not stored or applied as null.
- **Exact base.** An update stages only after comparing the caller's `expectedRevision` with the target's locked
  `editRevision`; the task stores a base snapshot (title/content/metadata/type/status/revision/content digest).
  A target edit, type change, provider-owned row or deletion after staging refuses apply with
  `PROPOSAL_TARGET_CONFLICT` and writes nothing.
- **Pinned Skills.** Targets are `user_manuals` or `policies`, subtype `internal`/`external` from the metadata
  audience, operation `manual_revision`/`policy_revision`. Staging pins the resolved assignment IDs, exact Skill
  document/version IDs and content digests. Reading classifies the live basis as `current`, `stale`, `conflict` or
  `unavailable`. Apply proceeds only when the pinned and current basis are exactly equal; otherwise
  `DOCUMENT_PROPOSAL_SKILL_STALE` is returned with the current resolution.
- **Review.** The task view exposes the exact target/base, full proposed content and metadata, a
  `summarizeDocumentChange` diff, reason, producer provenance, pinned Skill context/assignments and current
  applicability. It never offers direct editing of the governed document.
- **Apply.** Human session only; owner/manager checked after the task row wait. The task row, project Skill
  assignments and target row are locked in one transaction. Create publishes a native `draft` governed document with
  `embedding_status='unsupported'`; update uses the existing KB writer, preserving the prior body as a version and
  letting the invalidation trigger clear any review. The receipt is stored in `save_events` and the task becomes
  `done`. The same decision key returns the receipt; a changed proposal revision is refused.
- **State distinctions.** Candidate staged (`in_review`, no document write) → applied native Draft (document/version
  exists, not submitted) → submitted exact version (existing submission) → human approved/rejected (existing review).
  Apply does not submit or approve; submission does not approve.
- **REST/MCP.** `POST/GET /knowledge-base/document-proposals`, `GET /:taskId`, `POST /:taskId/apply|reject`;
  MCP `propose_manual_revision`, `propose_policy_revision`, `get_document_proposal`, `list_document_proposals`.
  API-token producers need a write scope and current MCP consent; they cannot apply, reject or approve.
- **Known limits / decisions.** Candidate revision is a new `requestKey` (an exact key replay resolves to the original
  task). Archive/delete proposals, direct governed authoring, auto-submit and automatic approval are out of scope.
  Whether a future Skill rename should preserve pinned applicability, and whether candidate revision should replace
  an earlier task, remain owner decisions. The task record cannot be updated through the available native tools;
  REQ-WPB-03 `4c6d84b3-64e9-4508-a4fd-d6001fbb4c75` remains staged/`in_review`, execution **UNRUN**.

### 9.1 Review-surface hardening after review

- An update may omit all three of `contentText`/`contentHtml`/`contentJson` to keep the current
  body, and an explicit `null` clears one representation; an omitted representation is never
  coerced to JSON null. A body-changing proposal (create or update) must supply all three
  together, so the published Draft cannot show revised text/HTML over stale editor JSON (which the
  next editor save would revert). The panel distinguishes "preserved" from "cleared" and shows the
  base title/status/revision, the changed representations and the producer provenance.
- A text-only diff no longer has to stand in for HTML/JSON or metadata-only changes: the read
  model lists `Title`, `Plain text`, `HTML`, `Editor JSON` and `Governance metadata` changes, and
  compares the effective value of an omitted representation (the current one), not `""`.
- Managed candidates are immutable through the generic Zyra close/feedback/edit/delete draft
  paths, and are excluded from `list_testcase_proposals`; only the dedicated owner/manager
  Apply/Reject actions decide them.
- Reject requires the exact `expectedProposalRevision`, stores a decision receipt and refuses a
  candidate already applied/decided or changed since review. Its decision key is independent of
  the optional reason text, so a retry after a lost response replays the stored receipt. All
  managed REST reads/apply/reject share the same preview gate as staging.
- Apply asserts the row's `external_document_proposal` provider and revalidates governed type,
  provider ownership/read-only state, the exact target revision and the reserved Zyra-memory title.
  A no-op update records `no_change` and the actual status instead of claiming a new Draft.
- With the preview capability off, AI history excludes managed candidates. The generic agent-task
  read redacts the staged payload, receipts, pinned Skill context, both revision aliases, request
  identity/digest, provenance and raw or rendered activity/source entries (which can themselves
  contain Skill pins). The dedicated endpoints refuse with `not_implemented`. Basic task metadata
  remains visible; this is a capability gate, not a replacement for project access control.
- Apply gives the published document its own `created`/`updated` project activity entry in the
  same transaction (the task receipt remains the authoritative applied-proposal record), so a
  replay cannot append a second history row for one publication.
- The managed review revision is a digest of the exact operation + pinned Skill context, not the
  unrelated testcase proposal dependency snapshot.
- e2e now covers: non-owner apply refusal, generic draft tamper refusal, target moved after
  staging (`PROPOSAL_TARGET_CONFLICT`), Skill deactivated after staging
  (`DOCUMENT_PROPOSAL_SKILL_STALE`), token apply refusal, revision-bound reject/replay and the
  no-change receipt.

### 9.2 Merge and deployment record (2026-11-24)

- PR #251 merged into `development` as `0bde8123726f0ad4c3b4e22d5fba4031a336e156`. The last
  exact-head CI run at `9b1a61d6` passed all 32 required checks (1 expected skip), and fresh
  Independent and White reviews at that head reported no BLOCKER or HIGH findings.
- The Railway deployment for `0bde8123` reported success, and production `GET /api/health`
  returned `{"status":"ok","gitSha":"0bde8123726f0ad4c3b4e22d5fba4031a336e156"}`.
- Native Tesbo evidence writing remains unavailable in this session: the read-only MCP probe
  requires a separately operator-approved origin file beside the project token, and no Tesbo MCP
  tools are exposed to the agent. REQ-WPB-02 and REQ-WPB-03 stay `in_review`/unassigned with
  execution **UNRUN**; the PR, CI and deployment evidence above is the authoritative record until
  the native task can be updated.

---

## 10. PR #250 carried findings — disposition

| Finding | Disposition |
| --- | --- |
| Title edited during governed Save/Submit could be overwritten | Fixed in #250 (in-flight local revision fence + refresh guard); KBU-77 covers save/submit. |
| Decision path could overwrite a title/body edited during the in-flight decision | Fixed here: the decision captures the local revision and preserves the visible draft as unsaved; KBU-78 covers the browser path. |
| `writer.needsReadback` blocked a decision retry after a failed decision | Fixed in #250: removed from the pre-decision guard; draft state still blocks a genuinely unsaved body. |
| Ambiguous governed UPDATE acknowledgement | Confirmed follow-up: POST ambiguity is covered (KBU-73), but a PATCH that commits with a lost response still requires reload/readback. Not an authority or draft-loss defect. |
| Reload-persistent submission key | Confirmed follow-up/product decision: a lost POST plus reload can create a second identical submitted snapshot; server-side identical resubmission is intentional. |
| Create-vs-folder-delete race | Fixed in #257 (`ca18d6c8`): document create rechecks the folder under `FOR SHARE` in the insert + audit transaction and revalidates authority after the wait; a delete either cascades the new document or makes the create 404. Regression race + audit-rollback tests run in `behavioral-quality`; deployment health returned the merge SHA. Move/duplicate destination integrity was re-investigated in #263 — see §10.1. |
| Native record cannot be updated by the available native tools | Recorded; evidence is retained in the PR/CI, and native execution remains UNRUN. |

### 10.1 Move/duplicate destination integrity (PR #263)

**Lock map.** `moveKnowledgeDocument` and `moveKnowledgeFolder` take
`pg_advisory_xact_lock('skill-assignments:<project>')` before any domain row lock. `duplicateKnowledgeDocument`
did not; it now takes the same lock as its first transaction statement, before the source `FOR SHARE` (taking
it after would invert the order against `deleteKnowledgeFolder` and can deadlock). `deleteKnowledgeFolder`
takes the project lock before its `FOR UPDATE` and recursive cascade. Therefore ordinary deletion, subtree
deletion, moves and duplicates in the same project are serialised:

- Delete acquires first → the move/duplicate waits on the advisory lock, then reads the destination/source
  after the delete committed and refuses with 404; no row is written.
- Move/duplicate acquires first → the delete waits, then its cascade statement sees the newly moved/copied
  row and soft-deletes it. No live row can point at a deleted folder.

The move regressions observe that advisory wait in `pg_stat_activity`; the duplicate orphan regression was
red before the advisory-first fix and green after it. No extra destination row lock was added: the project
lock is the ordering boundary, and adding a folder lock after the source-document wait would reintroduce the
deadlock it prevents.

**Confirmed gaps fixed.** `duplicateKnowledgeDocument` did not revalidate membership/archive after its
source-document wait; it now calls `requireCurrentProjectAuthority` under the transaction and inserts from the
current authority row. Document/folder move and duplicate wrote their audit entry after commit (best-effort),
so an audit failure left an unaudited mutation; all three now write it on the mutation transaction's client.
External effects (duplicate embedding enqueue) remain after commit.

**Sibling disposition (not changed).** These are the same unlocked-destination shape but belong to different
owners; they are recorded, not widened into this KB move/duplicate repair:
- `integration-sync.processor.ts` upserts provider mirrors with a `folder_id` resolved earlier, without the
  project mutation advisory lock or a locked recheck. Owner: integration-sync.
- `createKnowledgeFolder` (`legacy.service.ts`) checks the parent in a preflight and inserts without the
  advisory lock or a locked parent recheck. Owner: KB folder writes; follow-up.
- `rememberZyraMemory` (`legacy.service.ts`) resolves the AI Memory folder unlocked, then inserts the memory
  document; an ancestor delete in that window can strand it. Owner: Zyra memory; follow-up.
- `setup.service.ts` seeds a document during project bootstrap inside the project-creation transaction,
  before the project is reachable, so no concurrent deletable destination exists.
There is no hard-delete path for `knowledge_folders` in product code.

**Evidence.** Two failing-first runs against tests-only heads:
- `6a415207` (`actions/runs/45513840933/job/138868072480`): 4 new regressions failed (duplicate resolved with
  `null`; the three audit cases resolved instead of rejecting); 721 existing tests passed.
- `5214acf9` (`actions/runs/45522403393`): the new duplicate/ancestor-delete regression failed with `Expected:
  0, Received: 1` live copies under the deleted folder; 725 existing tests passed.

The advisory-first fix is verified green at `2060ae82`
(`actions/runs/45524121118`, 726 database tests). Native execution remains UNRUN; native record update is
blocked as in §9.2.
