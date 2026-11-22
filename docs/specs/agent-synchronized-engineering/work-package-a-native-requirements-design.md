# Work Package A — Native requirements and testcase links (design note, revision 2)

**Status:** Draft for review. Not approved, not implemented, no acceptance claimed.
**Date:** 2026-11-21 (revision 2)
**Source commit:** `8686e3cbce03a7c73f609140071f8e4d740215a1` (`origin/development`)
**Work package:** `implementation-plan.md` **lines 176–182** (“Work package A — Native requirements and testcase links (first authored-artifact integration)”).
**Ownership map:** `design.md` **§3, lines 29–45** (“Native requirement content/version → existing KB document identity + typed requirement rules; approved DB mapping if necessary”).
**Runtime evidence (2026-11-21):** `/api/health` reports `8686e3cb…`; MCP deploy check against the TESBOPROJECT endpoint reports 49 tools, fingerprint `6f1a2c05c69f8948` matching, `OK` with `REQUIRE_PROPOSAL_REVIEW_PREVIEW=1`. **No human UI session was available: every UI statement in this note is source-only.** The new workflow, UI and GJ-19 have **not** been run.

**Changes from revision 1:** D1 resolved from Work Package A; ownership changed from a separate requirement store to the KB document/version owner; shared staging and protected apply made explicit; D7 resolved to “unavailable skills block guarded publication even in preview”; executed coverage requires a qualifying persisted attempt; link and current-version pointers are bound to their exact requirement lineage; migration number is provisional.

---

## 1. Scope

**In scope**

- A stable native requirement whose **content and versions are owned by the existing KB document identity and `knowledge_document_versions`**, extended with typed requirement rules and acceptance criteria.
- A typed, criterion-scoped relationship between an exact requirement version and an exact testcase revision, owned by a new link table because no existing owner can carry it.
- Shared staging of agent-authored requirement revisions, case candidates and link proposals in the **existing staging owner**, with a protected selected apply transaction.
- Four separate coverage readings — authored, approved, executed, passing — where **executed requires a qualifying persisted attempt on the exact reviewed basis**.
- The Work Package A proof obligations: `ASE-E2E-01, -02, -05, -07, -08, -11, -12`.

**Out of scope**

- The governed Skills library itself (identity/version/approval/assignment/resolution). Work Package A requires resolving and pinning effective requirement and test-case skills; while that capability is absent, guarded publication is blocked (§4.5, D7).
- Changing case review/approval, run admission, `sourceRefs` semantics, Model Studio links, external provider ownership or the Requirements screen’s external-ticket behavior.
- Any new content/version store for requirements, a second wiki, or repurposing the graph link layer.

---

## 2. What exists today (source-verified at `8686e3cb`)

| Capability | Owner and symbols | What it does / does not do |
| --- | --- | --- |
| Requirement content and versions (specified owner) | `knowledge_documents` + `knowledge_document_versions`; `design.md` §3; WP-A line 178 | KB identity and version history exist; `requirement_note` is an allowed type (`V45`). Mirrored external requirements are inserted read-only by `integration-sync.processor.ts` (~572) with `source_provider`, `source_external_id`, `source_role='mirror'`, `is_read_only=true`. Authored requirement semantics (identity key, criteria, approval, typed links) do not exist. |
| KB revision and review machinery | `createKnowledgeDocument` (~12173), `updateKnowledgeDocument` (~12465), `submitKnowledgeDocument` (~13470), `reviewAiMemory` (~13664→), `writeKnowledgeGovernedVersion`; `V156` snapshot kinds, immutability trigger, `reviewed_version_id` | Submitted/reviewed snapshots are immutable; exact-revision CAS and submission-key idempotency exist. Approval is hard-gated to `document_type='ai_memory'`; authority metadata is `ai_memory_review`. There is no requirement review path, and no typed criteria/identity. |
| Requirements screen | `requirements/page.tsx`; `linkedJiraKeys`/`linkedLinearKeys`/`linkedNotionPages` (~6540+); `requirementMatrix` (~10303) | Provider-synced tickets only; subtitle points at the KB Requirements folder (~723); no native create/revise/approve. Coverage is ticket-key string matching plus case/run/bug joins. |
| Case identity, approval, admission | `testcase-edit-revision.ts` (`TESTCASE_EDIT_REVISION_SQL`, `TESTCASE_APPROVAL_REVISION_SQL`, `TESTCASE_APPROVAL_CURRENT_SQL`); receipts `V151`/`V155`; `approved-run-cases.policy.ts`; `cycle_items.snapshot_approval_revision` (`V155`) | Exact edit revision and exact human review receipts exist; run admission requires both. Executions are auto-created `Untested` rows; only a recorded attempt sets `executed_at`/`executed_by`. |
| Case proposal staging and apply | `ai_generation_requests` + `V157` (design.md line 722: “preserve the current staging owner; add exact candidate-iteration content/history and selected-operation convergence”); `stageTestcaseChanges` (~15852); `testcase-proposal-review.ts`; `zyraSave`/`zyraSaveAttempt` (~21648) | Agent case operations are staged unreviewed and published only through human selected apply; official IDs allocated at apply. The staging payload is mutable between iterations and is case-shaped. |
| Typed relation owners | `testcases.source_refs` (`V101`) — citations; ticket-key columns — external provider association; `graph_review_run_case_links` (`V147`) — graph receipt→run→case handoff, comment: “no asserted test execution, coverage, defect, evidence or approval”; `mbt_model_case_links` (`V148`) — model revision→case revision | **None can represent requirement version + criterion → case revision.** `sourceRefs` is a citation (R-ASE-05); ticket keys are provider facts; the graph link PK is `(project_id, history_id, cycle_id, testcase_id)` with no requirement or criterion identity. |
| Exact-revision link precedent | `mbt_model_case_links` (`V148`), `linkCaseForUser` (`model-studio-repository.ts` ~470) | Composite project FKs, exact `testcase_revision`, unique key, `ON CONFLICT` + `MAPPING_CHANGED`, `FOR SHARE` on the case. No activity/audit entry — a gap to close, not a pattern to copy wholesale. |
| Skills | `skills-governance.md` (proposed); `AGENT_RULE_TEMPLATE.md:67` (no skill tool connected) | Not implemented. The deployed catalog contains no skill tools; `stageTestcaseChanges` refuses partly because governed effective-skill authority is absent. |

**Work Package A blocker (implementation-plan line 182):** “demonstrate how the existing graph canonical link layer represents the native case relation without misusing `sourceRefs` or external ticket keys.” **Result:** it cannot. `graph_review_run_case_links` is a human-selected QA handoff between a graph receipt, a run and a case; it has no requirement identity, version, criterion or coverage semantics and its own comment disclaims coverage. Reusing it would mislabel a graph handoff as requirement traceability. `sourceRefs` and ticket keys are citations/provider facts. A dedicated typed link owner is required; this is the blocker’s evidence, not a new initiative.

---

## 3. Ownership decision: extend the KB owner

### 3.1 Options compared

| Option | What it reuses | What it adds | Verdict |
| --- | --- | --- | --- |
| A. Separate requirement identity/version/content store + link table | Nothing from KB except maybe attachments | `requirements`, `requirement_versions`, editor, history, review, search, folder UI | **Rejected.** Duplicates the specified KB owner (design §3, WP-A line 178), creates a second wiki, and would have to re-prove version immutability, review, search and editor behavior already owned by KB. |
| B. KB-backed identity/versions + typed requirement rules + link table | `knowledge_documents` identity, `knowledge_document_versions` history/immutability, `reviewed_version_id`, review/CAS/idempotency patterns, editor/search/folders | Typed criteria schema, requirement key/state profile, requirement review authority, lineage constraints, typed link table, staging operations | **Recommended.** Satisfies every R-ASE-04 field by extension: stable identity (document id + requirement key), title/description (document + typed content), criteria (typed content/version metadata), state (profile + review), owning project, immutable reviewable revisions (submitted/approved snapshots), rationale/actor/source (snapshot metadata), typed links (new table). No invariant is unmeetable; the cost is a narrow, type-specific extension of review and content validation. |
| C. Reuse the graph link layer for the relation | Existing table and service | None | **Rejected.** No requirement/version/criterion identity; purpose is graph-receipt handoff; explicitly not coverage. |

### 3.2 The KB extension (no separate content/version store)

**Identity and content**

- A native requirement is a `knowledge_documents` row with `document_type='requirement_note'` and `source_provider IS NULL` (mirror documents remain provider-owned and read-only).
- `content_json` uses a typed schema, validated on write for this document type:

```json
{ "schemaVersion": "tesbo-requirement/1",
  "description": "…",
  "criteria": [ {"key": "AC-1", "text": "…", "normative": true},
                {"key": "AC-2", "text": "…", "normative": true} ] }
```

- `content_text`/`content_html` are rendered projections for search and display; they are not the authority for criteria.
- `updateKnowledgeDocument` (and every writer for this type) rejects content that does not satisfy the schema; the generic free-form editor is replaced by a requirement editor for `requirement_note`, so the criteria cannot be corrupted through the ordinary KB path.

**Requirement profile (typed rules, 1:1 with the KB identity)**

```
requirement_profiles (
  document_id UUID PRIMARY KEY REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  project_id  UUID NOT NULL,
  requirement_key VARCHAR(32) NOT NULL,
  state VARCHAR(16) NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','active','retired')),
  created_at, updated_at,
  UNIQUE (project_id, requirement_key),
  FOREIGN KEY (document_id, project_id) REFERENCES knowledge_documents(id, project_id)
)
```

- Justification: key allocation, lifecycle state and the “this document is a requirement” rule are requirement-specific; a side table keeps the general document table from widening with conditional columns while the **identity remains the KB document**. This is the “typed requirement rules” the ownership map allows.
- A unique index `knowledge_documents(id, project_id)` backs the composite FK.

**Versions**

- Before publication, a requirement candidate exists only as a staged operation (§4); it is **not** written as a KB row.
- At protected apply, the candidate becomes a `knowledge_document_versions` row with `snapshot_kind='submitted'` written through the existing governed-version path, with `criteria` copied into `snapshot_metadata.criteria` and the existing `content_digest`.
- The approved revision is an `'approved'` snapshot; `knowledge_documents.reviewed_version_id` is the current approved pointer (existing column). No candidate is promoted into approval by apply.
- Both kinds are immutable after submission/approval through the `V156` trigger; no new version store is created.

**Requirement review (extension of the KB review path)**

- Generalize `reviewAiMemory` into a type-dispatched review (`ai_memory` → existing `ai_memory_review` authority; `requirement_note` → new `requirement_review` authority) with the same locks, CAS, idempotent replay and activity logging.
- Requirement review requires: owner/manager role, human session, the document still at the reviewed edit revision, valid criteria schema, and the submitted version being the one reviewed. It writes an approved snapshot and advances `reviewed_version_id`.
- `invalidate_changed_knowledge_review` (V156) is extended so a requirement-note content/criteria change clears the approval binding, exactly as it does for AI memory. `writeKnowledgeGovernedVersion` takes the authority label instead of hardcoding it.
- **Current-version pointer lineage:** `knowledge_documents.reviewed_version_id` is bound to its own document by a composite FK `(reviewed_version_id, id) → knowledge_document_versions(id, document_id)` (backed by a unique index on `(id, document_id)`; MATCH SIMPLE permits NULL for unreviewed documents). A pointer can never name another requirement’s version.

### 3.3 Typed link owner (new table, justified independently)

```
requirement_case_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  requirement_id UUID NOT NULL,               -- knowledge_documents.id, requirement_note, non-mirror
  requirement_version_id UUID NOT NULL,       -- knowledge_document_versions.id, snapshot_kind submitted|approved
  criterion_keys TEXT[] NOT NULL CHECK (cardinality(criterion_keys) > 0),
  testcase_id UUID NOT NULL,
  testcase_revision CHAR(64) NOT NULL,
  testcase_approval_revision CHAR(64),        -- required for approved/executed readings
  state VARCHAR(16) NOT NULL DEFAULT 'proposed'
    CHECK (state IN ('proposed','active','retired','withdrawn')),
  proposed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  proposed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_by UUID REFERENCES users(id) ON DELETE SET NULL,
  applied_at TIMESTAMPTZ,
  retired_by UUID REFERENCES users(id) ON DELETE SET NULL,
  retired_at TIMESTAMPTZ,
  FOREIGN KEY (requirement_id, project_id)
    REFERENCES knowledge_documents(id, project_id) ON DELETE CASCADE,
  FOREIGN KEY (requirement_version_id, requirement_id)
    REFERENCES knowledge_document_versions(id, document_id) ON DELETE CASCADE,
  FOREIGN KEY (testcase_id, project_id)
    REFERENCES testcases(id, project_id) ON DELETE CASCADE,
  CHECK (state <> 'active' OR (applied_at IS NOT NULL AND applied_by IS NOT NULL))
);
CREATE UNIQUE INDEX idx_requirement_case_link_live
  ON requirement_case_links(requirement_version_id, testcase_id, criterion_keys)
  WHERE state IN ('proposed','active');
```

- A trigger validates that `criterion_keys` is a subset of the linked version’s `snapshot_metadata.criteria` keys, and that the requirement document is `requirement_note`, non-mirror, same project.
- Proposed rows are immutable except for the `proposed → active | withdrawn` state transition; active rows are immutable except retirement. Identity is the row; a correction is a new link (retire, then propose), preserving history.
- **Two requirements in the same project:** linking requirement A’s document id with requirement B’s version id violates `(requirement_version_id, requirement_id) → versions(id, document_id)`; the service returns `409 REQUIREMENT_LINEAGE_MISMATCH` before the insert and the database rejects a direct one. The same fixture also proves `reviewed_version_id` cannot be pointed at B’s version.

### 3.4 Migration (provisional)

No migration number is assigned in this design. The current latest is `V158`; the eventual migration (“provisional V159”) is created only after acceptance and after re-reconciling the then-latest migrations. It:
- adds the composite unique indexes the lineage FKs require: `knowledge_documents(id, project_id)`, `knowledge_document_versions(id, document_id)`, and `ai_generation_requests(id, project_id)`;
- creates `requirement_profiles`, `requirement_case_links`, and the staging-operations table (§4);
- adds the document review-lineage constraint `(reviewed_version_id, id) → knowledge_document_versions(id, document_id)`;
- alters no existing content/version table and performs no backfill (mirrored requirement notes are never promoted into native requirements).

---

## 4. Shared staging and protected apply

### 4.1 Staging owner

The existing staging owner is `ai_generation_requests` + `V157` (`design.md` line 722). We **extend it, not replace it**:

```
proposal_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  task_id UUID NOT NULL,                    -- ai_generation_requests.id, same project
  logical_operation_id UUID NOT NULL,
  operation_kind VARCHAR(32) NOT NULL CHECK (operation_kind IN (
    'requirement_revision','testcase_create','testcase_update','testcase_archive',
    'requirement_case_link','requirement_case_link_withdraw')),
  base_revision JSONB NOT NULL,             -- exact document/case/version bases
  payload JSONB NOT NULL,                  -- exact candidate content for this operation
  content_digest CHAR(64) NOT NULL,
  skill_context JSONB NOT NULL,            -- resolved assignments/versions/digests, or {status:'unavailable'}
  created_by UUID, created_at,
  UNIQUE (task_id, logical_operation_id),
  FOREIGN KEY (task_id, project_id) REFERENCES ai_generation_requests(id, project_id) ON DELETE CASCADE
)
```

- Append-only; a revised candidate is a new task iteration/operation with a new digest. The task’s proposal revision (`proposalDigest` in `testcase-proposal-review.ts`) covers the existing case payload **and** these operations, so the human reviews one exact revision.
- Existing `stage_testcase_changes` continues to write `generated_payload` for Zyra compatibility and additionally records typed case operations; new staging tools record requirement-revision and link operations on the same task. This is the “exact candidate-iteration content/history and selected-operation convergence” the design asks for.
- **Requirement candidates** are staged operations, not KB rows yet. On apply they become an immutable `submitted` KB version. This keeps the KB revision history as the durable record while preserving the shared staging contract.
- **Link candidates** are staged with `state='proposed'` only at apply time; the staging operation itself is inert and grants no coverage.

### 4.2 Human review surface

- The existing review task/board shows every operation in the batch: requirement title/description/criteria and version diff, case drafts, and link intents with requirement version, criterion keys, target case and both case revisions.
- Any project member with read access to the task can review; only an **owner or manager human session** can apply, approve or reject guarded operations.
- Every proposal records the pinned source commit, base revisions, and `skill_context`. Missing/stale/conflicting skill context is displayed as a blocking reason, not hidden.

### 4.3 Protected apply

A single human “Apply selected” action on the exact proposal revision runs one database transaction with one `PoolClient`:

1. Lock the task row (`FOR UPDATE`), re-read the proposal revision, and verify the selected logical operation IDs still exist with the reviewed digests.
2. Recheck the acting human’s role after any wait; recheck the effective skill context (currently unavailable → block, §4.5).
3. Apply in dependency order:
   - `requirement_revision`: write the immutable `submitted` KB version with typed content/criteria (`writeKnowledgeGovernedVersion` authority `candidate`); no approval.
   - `testcase_create/update/archive`: call the existing transaction-aware native case writer with the same client; official case IDs are allocated here.
   - `requirement_case_link`: insert or activate a link row referencing the exact requirement version and the exact case edit revision created/verified in this transaction (approval revision included only if current and reviewed).
4. Write one apply receipt (selected operation IDs, resulting native IDs/revisions, proposal digest, actor) and activity/audit rows; commit; run cache/index effects after commit.
5. A failure anywhere rolls back the whole apply: no official IDs, versions or active links survive. The task keeps its reviewed operations and records a truthful failure receipt; a resume re-reads, re-verifies and does not replay committed operations.

### 4.4 When the official case ID and exact link exist

- **Official case ID and edit revision** exist only after a successful protected apply. Before that, the case is a staged operation, not a native Draft.
- **The typed link** becomes `active` in that same apply, pinned to the new case revision and the requirement version that existed at review. It is a relation, not an approval.
- **Requirement approval** is a separate owner/manager action on the exact version; approved coverage begins only then. Approval is not part of case apply and cannot be inferred from it.
- **Run eligibility and execution** remain the existing case-approval and run-admission path; a link or an `Approved` label alone is never eligibility.

### 4.5 Skills gate (D7 resolved)

- Requirement and test-case skills are **required** for guarded publication under Work Package A (WP-A lines 178–180; R-ASE-25/26).
- The resolver is not implemented and the deployed catalog exposes no skill tools. Therefore:
  - Staging, reading, diff review and **rejection/withdrawal** are allowed in preview.
  - **Protected apply, requirement approval, link activation and any claim of approved/executed/passing coverage are blocked** with `SKILL_CONTEXT_UNAVAILABLE`, even in preview. There is no “blocked once the resolver exists” loophole.
  - `skill_context = {status:"unavailable"}` is recorded on every staged operation and displayed on the review surface.
  - Once the resolver exists, the same gate requires a resolved, pinned, conflict-free assignment set; `UNASSIGNED`, stale, revoked or conflicting resolution blocks apply/approval unless an explicit, scoped project policy (which does not exist today) says otherwise. Raw observations and evidence intake remain independently permitted.
- Consequence: **the positive half of Work Package A (apply → approve → coverage) is blocked on the minimal effective-skill capability.** The first slice can ship and prove staging, review, lineage, refusal and non-publication; its positive acceptance rows remain BLOCKED, not NOT RUN.

---

## 5. Coverage semantics

Four readings per requirement version and criterion; a linked draft may raise only **authored**.

### 5.1 Definitions

- **Qualifying attempt** for a link `L` and case: an execution row that
  1. belongs to a `cycle_item` for the same case and project, not deleted;
  2. has a recorded result — `executed_at IS NOT NULL` and `executed_by IS NOT NULL`;
  3. carries the **exact reviewed basis**: `cycle_items.snapshot_approval_revision = L.testcase_approval_revision` (both non-null), with the item’s reviewed content snapshot present.
- **Unstarted run item:** `status='Untested'` or `executed_at IS NULL` — not an attempt, regardless of the item existing.
- **Stale attempt:** `snapshot_approval_revision` differs from the link’s approval revision (or the case moved after the attempt). It remains historical and is excluded from current readings.
- **Latest qualifying attempt:** ordered by `(executed_at, execution.id/created_at)`; retests create new native runs and therefore new attempts, never rewrite the source execution (`V158`).

### 5.2 Readings

| Reading | Predicate |
| --- | --- |
| **Authored** | An `active` link exists for the requirement’s current **submitted or approved** version; any case revision/approval state. This is “a relationship was authored”, not coverage. |
| **Approved** | Active link AND requirement version is the current **approved** version (`reviewed_version_id`) AND `L.testcase_revision` equals the current edit revision AND `L.testcase_approval_revision` equals the current approval revision AND `TESTCASE_APPROVAL_CURRENT_SQL` is true. |
| **Executed** | Approved AND at least one **qualifying attempt** exists. |
| **Passing** | Executed AND the **latest qualifying attempt** has status `Passed`. |

Additional reported facts (not part of the four readings): attempt count per status, latest attempt status/time, `open_unstarted_items`, `conflicting_attempts` (qualifying attempts disagree), and per-criterion stale/missing reasons.

### 5.3 Edge controls

| Situation | Effect on readings |
| --- | --- |
| Requirement document edited after approval | The KB review-invalidation trigger clears `reviewed_version_id`; approved/executed/passing drop for current coverage; links and history remain readable. |
| Test case edited after linking | `L.testcase_revision` no longer matches the current edit revision; approved/executed/passing drop with `CASE_REVISION_CHANGED`; the link stays authored/historical until re-applied to the current revision. |
| A newer requirement version is submitted | Current-version readings move to the newer version only when it is approved; old-version links remain readable and report `REQUIREMENT_VERSION_SUPERSEDED` in current coverage. |
| Run item exists but is unstarted | Contributes nothing. It does not count as executed and does not override an earlier qualifying attempt; reported as `open_unstarted` / `NOT_STARTED` for that run. |
| Attempt on an older approval basis | Excluded from current readings with `STALE_ATTEMPT`; retained as history. |
| Pass then later Fail on the same exact basis | `executed` stays true; `passing` becomes false because the latest qualifying attempt is not Passed. The earlier Pass remains readable. |
| Fail then later Pass on the same exact basis | `passing` true (latest attempt Passed); the earlier Fail remains in the attempt history and counts. |
| Two attempts at effectively the same time | Deterministic tie-break by execution `id`/`created_at`; the report exposes both and `conflicting_attempts=true` if statuses differ. |
| `Skipped`, `Blocked` or `Retest` as latest | `executed` true; `passing` false. |
| Evidence metadata missing for an attempt | Does not change executed/passing (the attempt is persisted); evidence status is reported separately (R-ASE-11). |

---

## 6. Dogfood workflow in TESBOPROJECT

1. **Preflight.** The agent records the source SHA, project binding and the exact approved requirement/test-case skill assignment set. Today the resolver/tools are absent: it records `skillContext=unavailable` and knows that publication is blocked; it may still stage.
2. **Requirement candidate.** The agent stages a `requirement_revision` operation (typed content, criteria, base document revision) in the shared staging task. Nothing is written to the KB yet.
3. **Case candidate.** The agent stages `testcase_create/update` operations in the same task, citing the requirement **document** through the existing `sourceRefs` `knowledge_document` citation type (a citation, not the typed relation; no enum change needed) and naming the requirement key in the Notes for the reviewer.
4. **Link proposal.** The agent stages `requirement_case_link` operations naming the requirement version/criteria and the intended case operation, so the relation is reviewed with the case.
5. **Human review.** Owner/manager opens the task, sees requirement diff/criteria, case drafts and link intents with blocking reasons (skills unavailable). They may reject or withdraw; they cannot apply, approve or activate while the skills gate is closed.
6. **When the skills resolver ships:** the same task is revalidated (proposal revision, bases, skill digests), then a protected apply creates the immutable `submitted` requirement version, the official Draft cases and the active exact-revision links in one transaction; requirement approval remains a separate exact-version human decision.
7. **Coverage.** Until requirement approval, active links yield authored only. After approval, approved follows the exact current case and requirement revisions; executed requires a qualifying attempt; passing follows the latest attempt.
8. **Revisions.** A new requirement revision is a new staged operation with `expectedVersionId`/digest; the old version and links remain readable; current coverage reports stale until links are re-applied to the new version. No silent re-pointing.

**Fact separation:** staged operation ≠ native requirement version ≠ official case ≠ approval ≠ typed link ≠ run eligibility ≠ execution/passing.

---

## 7. Work Package A acceptance mapping (statuses explicit)

Work Package A requires proving `ASE-E2E-01, -02, -05, -07, -08, -11, -12` (implementation-plan line 180). Definitions are in `requirements.md` (ASE-E2E rows 421–432).

| ASE check | What it must prove | GJ-19 rows | Status |
| --- | --- | --- | --- |
| ASE-E2E-01 | New feature, no prior requirement: native requirement draft, linked draft cases, manual candidate, work item; reviewer owns publication | GJ19-01…04 | **BLOCKED** — staging can be built and reviewed; apply/publication is blocked by the skills gate |
| ASE-E2E-02 | Fix existing regression: same requirement/case identities, history preserved, actual run scope | GJ19-07/08/14 | **BLOCKED** — requires guarded publication |
| ASE-E2E-05 | Two agents edit the same record: optimistic conflict, no lost update, visible reconciliation | GJ19-10, GJ19-18 | **NOT RUN** — staging-level CAS can be proven before the skills gate |
| ASE-E2E-07 | Wrong project token/role: denial, zero cross-project writes | GJ19-09 | **NOT RUN** — executable in the staging/lineage slice |
| ASE-E2E-08 | Agent calls missing/stale MCP tool: explicit blocked/degraded state, no claims of update | GJ19-16 | **NOT RUN** — executable against the preview flag/catalog |
| ASE-E2E-11 | KB synced external requirement stays read-only, correct attribution, no native overwrite | GJ19-13 | **NOT RUN** — executable without the skills resolver |
| ASE-E2E-12 | Unapproved case added to run is prohibited regardless of writer surface | GJ19-17 | **NOT RUN** — executable with existing run admission |

**Interpretation:** the slice can prove the negative/control half and the staging half now; the positive publication half of Work Package A is explicitly blocked on the minimal effective-skill capability. This note does not claim WP-A complete.

---

## 8. GJ-19 fixture (planned)

All rows are planned; statuses distinguish executable-now from blocked.

| ID | Action | Entry points | Persisted evidence | Status |
| --- | --- | --- | --- | --- |
| GJ19-01 | Create a requirement candidate with two criteria | UI/REST/MCP staging; protected apply | `proposal_operations` row (typed payload, digest, skillContext); after apply: KB `submitted` version with criteria metadata | BLOCKED at apply (skills); staging executable |
| GJ19-02 | Revise a criterion and add one | staging | new operation + digest; base document revision recorded; no KB version before apply | BLOCKED at apply |
| GJ19-03 | Link an exact approved case revision to the requirement version/criteria | staging + apply | active link row with both case revisions and criterion keys | BLOCKED |
| GJ19-04 | Link a draft case | apply | active link with null approval revision; authored=1, approved/executed/passing=0 | BLOCKED |
| GJ19-05 | Approve the requirement version | UI/REST, owner/manager, skills resolved | approved KB snapshot + `reviewed_version_id`; activity | BLOCKED |
| GJ19-06 | Approve case, execute Passed on exact basis | existing case review + run | approval receipt; qualifying attempt; approved=1, executed=1, passing=1 | BLOCKED |
| GJ19-07 | Create a newer requirement version | staging/apply + approval | old/new versions readable; old links intact; current stale | BLOCKED |
| GJ19-08 | Re-link current case revision to the new version | staging/apply | new active link; old link retired/historical | BLOCKED |
| GJ19-09 | No session, guest, second tenant, machine-token approval | REST/MCP | 401/403/404; zero rows; audit entry | NOT RUN |
| GJ19-10 | Stale `expectedVersionId`/digest or stale selected operation | REST/MCP staging | 409; no operation/version written; prior head unchanged | NOT RUN |
| GJ19-11 | Duplicate retry: same submission key; same apply selection; changed payload | REST/MCP | one operation/version/link; identical replay returns same IDs; changed payload 409 | NOT RUN (staging/apply blocked where publication is required) |
| GJ19-12 | Archive the linked case | UI/REST | link history preserved; current coverage excludes with `CASE_ARCHIVED` | BLOCKED |
| GJ19-13 | Mirrored Jira/Linear/Notion requirement untouched; ticket key unchanged | UI/REST | mirror document byte-identical; native ops refused on mirror; provider attribution preserved | NOT RUN |
| GJ19-14 | Case re-approved after edit; old execution remains | existing review/run | old attempt historical; not executed for new basis; `CASE_APPROVAL_CHANGED` until re-link | BLOCKED |
| GJ19-15 | **Same-project wrong requirement:** link requirement A’s id with requirement B’s version/criteria | REST/MCP and direct SQL | service 409 `REQUIREMENT_LINEAGE_MISMATCH`; SQL FK/trigger rejects; zero rows | NOT RUN |
| GJ19-16 | Preview flag off / stale or missing MCP catalog | MCP | native requirement tools absent/refused; explicit blocked state; no writes | NOT RUN |
| GJ19-17 | Add a draft/unapproved linked case to a run via REST, MCP and automation | REST/MCP/automation | refused by `assertApprovedNewRunCases`; no cycle item/execution | NOT RUN |
| GJ19-18 | Concurrent requirement revisions from two sessions | REST/MCP | one wins; loser 409; no lost update; visible reconciliation | NOT RUN |
| GJ19-19 | Unstarted run item, then Pass, then a later Fail on the same basis | UI/REST | executed=true; passing false after the Fail; attempt history shows both; unstarted item not counted | BLOCKED (needs publication) |

---

## 9. First implementation slice and acceptance proof

**Slice 1 (buildable and testable now, skills-independent)**

1. Provisional migration: profile and typed-link tables, lineage indexes/constraints, staging operations table, review-lineage constraint. No content/version-table replacement, no backfill.
2. KB type extension: typed criteria validation for `requirement_note` writes; requirement key/state profile; generalized review path with `requirement_review` authority, but approval remains gated by skills at runtime.
3. Staging tools and review surface: requirement revisions, case operations (typed mirror of the existing case payload), link proposals; one proposal revision; blockers shown.
4. Skills gate: `SKILL_CONTEXT_UNAVAILABLE` blocks apply/approval/activation; staged items remain inert. Rejection/withdrawal allowed.
5. Lineage enforcement: FKs and service checks; wrong-requirement fixture.
6. Coverage read with the four readings and edge controls, exercised on seeded/non-guarded data; no product-path approval is claimed.

**Acceptance proof for slice 1**

- [ ] Typed requirement write rejects malformed/missing/duplicate criteria; submitted snapshots are immutable.
- [ ] Staging records exact payloads/digests; proposal revision changes only with new content; replay is idempotent.
- [ ] Apply/approval are refused with `SKILL_CONTEXT_UNAVAILABLE` while skills are unavailable; zero native versions/cases/active links/approval rows created.
- [ ] Wrong requirement id/version and wrong project are refused by service and database; zero rows.
- [ ] Stale base revision returns 409 with no lost update.
- [ ] Preview flag off hides/refuses the new MCP tools and REST writes.
- [ ] External mirror documents remain read-only and attributed; native operations leave them unchanged.
- [ ] Unapproved/draft cases remain inadmissible to runs through every writer surface.
- [ ] Coverage on controlled fixtures: draft link → authored only; unstarted item → not executed; stale attempt → excluded; Pass-then-Fail → executed but not passing; Fail-then-Pass → passing with history.

**Slice 2 (blocked input):** the minimal effective-skill resolution and pinning required by WP-A/R-ASE-25. Only after it ships can apply/approval/link activation and the positive WP-A rows run. Sequence decision: **D9**.

---

## 10. Remaining decisions

| ID | Decision | Recommendation |
| --- | --- | --- |
| D1 | Work Package A definition | **Resolved** from `implementation-plan.md` 176–182 at `8686e3cb`; no further source needed |
| D2 | Requirement approval authority | Owner/manager human session only; authors (any project write member) may propose |
| D3 | Preview flag | Keep a default-off flag gating staging tools and exposing the skills blocker; do not treat it as permission to publish |
| D4 | Link timing | Apply-batch link referencing the case revision created in the same transaction; standalone link allowed only against an existing exact revision |
| D5 | Criterion identity | Stable keys (`AC-n`) in the typed content; reuse only for semantically unchanged obligations; omitted key = removed |
| D6 | `sourceRefs` for requirements | Use the existing `knowledge_document` citation type for review context; the typed link remains the only relation (no new enum) |
| D7 | Skills unavailable | **Resolved:** staging/review/reject allowed; apply/approval/activation and approved-or-better coverage blocked, in preview too |
| D8 | Audit depth | Activity for accepted mutations; `audit_logs` for unauthorized/cross-tenant/stale refusals |
| D9 | Slice sequencing | **Resolved:** Slice 1 is staging/review/reject-withdraw first; apply/approval remain blocked until effective Skills resolution exists |
| D10 | Migration number | Provisional only; assign after acceptance and reconciliation with the then-latest migrations |

---

## 11. Evidence log

- `git fetch origin development`; `git rev-parse origin/development` → `8686e3cbce03a7c73f609140071f8e4d740215a1`.
- `GET /api/health` (production, 2026-11-21) → `gitSha = 8686e3cb…`.
- `scripts/mcp-deploy-check.mjs` against `…/projects/df072dfe-e4d0-406a-9350-e0d022c6323f/mcp` with `REQUIRE_PROPOSAL_PREVIEW=1` → 49 tools, fingerprint `6f1a2c05c69f8948` matches, `OK`. Catalog has `get_requirement_matrix`; no native requirement or skill tools; retired `link_requirement_to_testcase` absent.
- Sources read: `docs/specs/agent-synchronized-engineering/{requirements.md,design.md,implementation-plan.md,README.md,skills-governance.md,AGENT_RULE_TEMPLATE.md}` at the pinned commit; `src/legacy/{legacy.service.ts,testcase-edit-revision.ts,testcase-proposal-review.ts,approved-run-cases.policy.ts}`; `src/behavior-graph/model-studio-repository.ts`; `src/behavior-graph/graph-review-run-links.ts`; `src/integration-sync/integration-sync.processor.ts`; `src/mcp/{mcp.tools.ts,mcp.types.ts}`; `src/common/testcase-publication.policy.ts`; migrations `V45, V101, V147, V148, V151, V155, V156, V157, V158`; `Tesbo-Frontend/app/(app)/projects/[id]/requirements/page.tsx`; document write/review services.
- **No implementation, migration or acceptance run has been performed for this note. UI statements are source-only.**

---

## 12. Slice 1 contracts (D9: staging first)

### 12.1 One authoritative staged payload

For Slice 1 the **authoritative reviewed content is `ai_generation_requests.generated_payload` itself** — the same array `testcase_proposal_review_snapshot()` returns as `operations` and `proposalDigest()` covers into `proposalRevision`. Typed requirement-revision and link-intent entries live as additional elements of that array; **no parallel staged table and no compatibility mirror exist**, so there is nothing that can disagree.

- Operation kinds for the slice: `requirement_revision`, `testcase_create`, `requirement_case_link`. Existing case kinds (`create/update/archive`) are unchanged.
- The proposal revision is computed over the returned snapshot, which includes every operation and its digests. A human reviews that revision; `expectedProposalRevision` on apply/decision must equal it.
- Idempotent retry is keyed by `(projectId, producerPrincipal, requestKey)`: the same key with a byte-identical normalized payload returns the same task; any difference returns `PROPOSAL_REQUEST_CONFLICT` and writes nothing.
- A stale target/document base revision or changed dependency snapshot is refused before staging with a 409, and on a later re-read the proposal revision moves only when the reviewed payload moves — never on a read.
- If a later slice introduces a normalized table for these operations, it must be **derived** from `generated_payload`, byte-compared on read/apply, and fail closed on disagreement. The reviewed representation still owns the decision.

### 12.2 Exact revision handoff (future publication, outside Slice 1)

A staged link intent names the staged requirement revision and case operation, not official IDs (neither exists yet). When publication is eventually enabled:

1. Protected apply creates the submitted requirement version and the official Draft case, then inserts the link bound to that exact requirement version and case edit revision; a later approval binds the approved requirement version.
2. A requirement revision that is awaiting approval remains readable as a **submitted/candidate** revision; readers see it labelled unapproved, and the last approved version remains the current normative one.
3. When the approved version changes, a new link row is created against the approved version (or the existing link is re-applied by a human); the original link and audit history are preserved, never rewritten. Current coverage follows the current approved version; historical coverage follows the historical link.
4. None of this is implemented in Slice 1: apply, approval, link activation and approved-or-better coverage stay blocked by the Skills gate.

### 12.3 Coverage and outcomes

- **Authored**: an active link exists for the current requirement version (submitted or approved), at any case state. It proves a relationship was authored, not coverage.
- **Approved**: the link targets the current **approved** requirement version and the current exact approved case revision; the case’s approval receipt is current.
- **Executed**: approved **and** at least one qualifying attempt exists — a persisted result with `executed_at`/`executed_by`, in a run whose `cycle_items.snapshot_approval_revision` equals the link’s approval revision, for the same case and project.
- **Passing**: executed and the **latest qualifying attempt** is `Passed`; the latest result is reported separately from verified coverage.
- **Build/environment/execution scope**: each attempt reports its run’s name/build metadata and environment where recorded; coverage is scoped to the exact requirement version, case revision and approved basis, never pooled across bases.
- **Mixed outcomes**: when qualifying PASS and FAIL results coexist on the same exact basis, the outcome is reported as **mixed**; `passing` is false unless the latest attempt is Passed, the discrepancy remains open for native triage, and only an authorized disposition (a later recorded attempt or an explicit triage decision in the native record) can resolve it. Historical results are never deleted to make the summary agree.
- A linked draft, an unstarted run item and a stale attempt can only affect the reading they qualify for; none may raise approved, executed or passing.

### 12.4 Slice 1 boundary

Slice 1 implements: staging of the typed bundle in `generated_payload`, the native task review read, authorized reject (owner/manager) and withdraw (producer), the server-side Skills gate that refuses apply/approval/link activation with `SKILL_CONTEXT_UNAVAILABLE`, idempotency and conflict handling, and project/lineage isolation checks for staged references. It does **not** create requirement documents/versions, cases, active links or approvals, and it does not add the publication tables (§3.2/§3.3) — those remain specified for the publication slice.

## 13. Slice 1 implementation map and evidence (as built)

**Source symbols**

- `LegacyService.stageRequirementChangeBundle` — validates one `requirement_revision`, optional `testcase_create` and optional `requirement_case_link`; enforces criterion-key membership, bundle-local operation references, request-key idempotency and the exact revision of an existing `requirement_note` document; records `REQUIREMENT_SKILL_CONTEXT`; writes only the review task.
- `LegacyService.requirementProposalTask` / `listRequirementProposals` — the native review reads; they return the bundle from the single `generated_payload` authority.
- `LegacyService.rejectRequirementProposal` / `withdrawRequirementProposal` — owner/manager human rejection, producer-only human withdrawal; append-only activity and project activity; idempotent close; no publication.
- `LegacyService.assertGuardedPublicationAvailable` — called before any save write and before draft edit/delete; refuses a bundle with `SKILL_CONTEXT_UNAVAILABLE`.
- `LegacyService.formatAiTask` — partitions the typed bundle entries from case drafts so the existing case review renderer never sees them; exposes `requirementBundle` and `skillContext`.
- REST: `POST/GET /api/projects/:projectId/requirements/proposals`, `GET …/:taskId`, `POST …/:taskId/reject`, `POST …/:taskId/withdraw` in `legacy.controller.ts`.
- MCP: `stage_requirement_change_bundle` (write), `get_requirement_proposal_task` and `list_requirement_proposals` (read), all `proposalPreviewOnly`; preview off hides and refuses them.
- UI: the native task page renders the bundle panel (`requirement-change-bundle`), requirement criteria, case candidate, link criteria, the publication gate, and reject/withdraw actions.

**Evidence run at this note revision**

- `npx tsc --noEmit` (backend, frontend, e2e) — pass.
- `npx eslint` on the changed backend/frontend/MCP files — pass.
- Backend unit suites `mcp-publication.spec.ts` (50 tests) and `mcp.service.spec.ts` (151 tests) — pass, including the new bundle staging/read tool and the 52/26/26 preview catalog.
- `node --test scripts/mcp-deploy-check.test.mjs` — 31 pass.
- DB spec `testcase-proposal-review.db.spec.ts` now carries the bundle staging/rejection/gate/isolation coverage; it is in the CI `database-integrity` path list but **was not run locally** (no `DATABASE_URL`/Docker on this machine). CI status: NOT RUN at note time.
- E2E specs `api/requirements.spec.ts` and the `ui/zyra.spec.ts` bundle test were added and added to the smoke workflow; **not run locally** (no `.env`, auth context or Docker). CI status: NOT RUN at note time.
- The stage → review → reject/withdraw journey on a disposable project is **BLOCKED locally** by the same missing environment; the CI smoke step is the intended executing path.

## Implementation continuation: read-only typed requirement preview (proposed; not yet accepted)

**Scope:** A deliberately narrow, preview-only implementation of Work Package A's typed requirement criteria admission contract. It reuses the existing **Knowledge Base / LegacyController** authorization and document identity, not a new requirement service or store. It **does not implement** staging, official KB version writes, requirement approval, a Skills resolver, criterion-to-case linking, graph consequence analysis or coverage publication.

- New **POST** `/api/projects/:projectId/knowledge-base/requirements/preview`, returning HTTP 200 only after native `requireProjectAccess`, under exact opt-in `TESBO_REQUIREMENT_PREVIEW_ENABLED=1`. All other values, including unset, return `503 REQUIREMENT_PREVIEW_DISABLED` after authorization. Missing/denied project membership fails first (no side-channel through validation).
- The only admitted request fields are `documentType: requirement_note`, `title` and `contentJson`. That content must declare `schemaVersion: tesbo-requirement/1`, nonempty description and 1–50 criteria, each with a unique stable `AC-n` key, nonblank text and explicit boolean `normative`. Unknown keys, external-source/mirror fields, invalid schema, duplicate criteria and oversized input fail as `400`; no legacy documents are migrated or silently reclassified.
- Response includes normalized candidate text, deterministic digest and `disposition: preview_only`, `canPublish: false`, `publicationBlocker: SKILL_CONTEXT_UNAVAILABLE`, `skillContext: {status: unavailable}`, `authoritativeRequirementId: null`, and `coverageAssertion: none`/`executionAssertion: none`. The digest is a candidate comparison aid, never an accepted revision or approval receipt.
- Implementation files: `Tesbo-Backend-Nest/src/legacy/native-requirement-preview.ts` with validation, `legacy.controller.ts` using the existing project-membership check, and `native-requirement-preview.spec.ts` for positive/negative/boundary/authorization/flag/no-write contracts.
- **Verification:** Offline pure-function transpilation/smoke passed one valid candidate plus five malformed/unauthorized-content negative examples. Full Nest typecheck, Jest, DB/HTTP and CI **not yet established at this writing**; review the exact PR head's workflow logs for result. No installed Skills, live MCP synchronization or product-data writes were asserted.

**Promotion boundary:** This slice proves only preview/validation and opt-in authorization when corresponding CI passes; it must not be used to declare GJ19-01 (staging), GJ19-03 (typed links), GJ19-05 (requirement approval) or GJ19-06 (executed coverage) passed. An authorized Tesbo MCP project was not connected in this session, so native Requirements/Cases/User Manuals/Policy/Task evidence updates remain **unverified and pending**, not fabricated as complete. The previously specified Skills and full WP-A application gates remain unchanged.

### Preview request-path recovery and acceptance boundary

Independent review at `d95e2e08` found that the global project write-lock guard interpreted the read-only preview POST as a mutation. On locked Launch projects, billing notification/history effects could run before the controller membership check, including with the preview flag off. The repair classifies only this exact preview POST (including the router's case/trailing-slash forms) as read-only in the existing guard; normal KB mutations retain billing enforcement and the existing REST token scope policy remains unchanged. The preview handler still owns membership before feature availability and candidate validation.

The new actual Nest HTTP regression executes both global guards and the real controller: seven scenarios failed against the old guard; all fourteen tests in the preview spec passed after the repair. Those tests use fake persistence/billing adapters. The existing Playwright KB suite now also defines enabled positive/boundary/negative acceptance and a real locked-project scenario, with product/history, organization billing/audit and email-outbox readback. CI executes the locked-project scenario in both default-off and opted-in processes with real disposable Postgres and a synthetic read-only Stripe fixture. These newly added Playwright cases require current-head CI execution before an acceptance claim; local collection is not execution.

The read-only preview accepts `tesbo-requirement/1` candidate content. Slice 1 staging accepts its separately documented bundle operation payload; both use criterion `key`, but staging currently has different validation/defaulting rules (including optional normative values and broader criterion keys). The preview is not the staging admission authority and does not certify that a candidate can be staged or published. Convergence of the formats belongs to the protected publication/Skills dependency; this recovery does not silently change staged bundle semantics. No claim of zero authentication-metadata writes is made: the no-effect boundary is native requirement/case/run/proposal content, billing state/history and notifications.

PR #196 was observed merged concurrently as `62b9c626`; its recorded smoke and database results apply to bounded staging at head `49ec9780`, not the future positive publication path. The combined preview workflow retains that staging lane and both tracing lanes. An independent post-merge review identified separate generic-task lifecycle and authorization gaps in staging; their repair is a separate increment. No native Tesbo connector is bound in this recovery session; native record synchronization remains pending.
