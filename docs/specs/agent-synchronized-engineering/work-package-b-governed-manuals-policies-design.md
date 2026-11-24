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
- immutable history, diff and authoritative readback in the KB document surface.

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
| `submitKnowledgeDocument` | Unchanged; snapshots the exact document including metadata. |
| New `approveGovernedKnowledgeDocument` / `rejectGovernedKnowledgeDocument` | Owner/manager human-session exact-version decision for manual/policy; content digest; approved/rejected snapshot; `reviewed_version_id`/status; replay; stale conflict. |
| `restoreKnowledgeDocumentVersion` | For governed types, restore the snapshot's governed metadata with the body. |
| `getKnowledgeDocument` / list / version history | Return metadata and snapshot metadata. |
| KB UI | Type templates, metadata form, submit-for-review, exact submitted-version review/diff/approve/reject, a read-only exact-version timeline, and history/readback. |
| Zyra AI context / RAG | New types excluded until the exposure policy in §8 is approved. New and duplicated governed rows are created `embedding_status='unsupported'`; the boot sweep and embedding processor also exclude `user_manual`/`policy` so a status reset or an already-queued job cannot leak text. |

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
7. The UI reports the **latest** decision snapshot by version number, so a later rejection supersedes an earlier
   approval; it does not show the first approved snapshot forever.

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
  `HUMAN_REVIEW_REQUIRED`, replay, and refusal of a governed→general type change.
- UI: author a manual/policy with metadata, submit, owner reviews the exact version and its metadata and approves;
  QA is refused while the owner still has the actions (not after a decision hides them); an edit clears the
  reported decision even though history keeps the snapshot; a later rejection supersedes the approval on reload;
  exact-version history/readback. The Zyra context picker still lists governed documents that the backend then
  excludes; filtering the picker is a follow-up, not a claim of this slice.
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
13. **MCP surface is not governed-aware.** `create_knowledge_document`/`update_knowledge_document` accept an
    unconstrained `documentType`, so an agent token can read a governed manual/policy and edit its existing title
    or body (which re-drafts it); it cannot set `governedMetadata`, change the document type, set `status` or approve.
    The human exact-version decision invariant therefore still holds, but governed documents are not absent from the
    agent surface. A guarded MCP authoring contract, or refusing governed-document edits from agent tokens, is a
    follow-up; do not describe the current tools as legacy-only.
14. **Submit does not flush a pending editor autosave.** The panel submits the persisted revision and only patches
    metadata first. The page autosaves quickly and the empty-state copy asks the author to save content first, but a
    click inside the debounce window can submit the prior body. A shared editor flush hook is the follow-up.
15. **Zyra context picker.** The task composer lists all KB documents, including governed manuals/policies, while
    the backend snapshot/AI-context gate excludes them. No content is exposed, but the picker offers an inert
    choice and shows the raw type. Filtering/labelling it belongs with the exposure-policy follow-up.
