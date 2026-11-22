# Work Package A — Native requirements and testcase links (design note)

**Status:** Draft for review. Not approved, not implemented, no acceptance claimed.
**Date:** 2026-11-21
**Source commit:** `8686e3cbce03a7c73f609140071f8e4d740215a1` (`origin/development`)
**Spec basis:** R-ASE-04 (native requirements), R-ASE-05 (traceability semantics), R-ASE-06 (cases and verification), R-ASE-17/18 (deployed identity, security), R-ASE-25/26 (effective skills), `ASE-E2E-01`, `ASE-FLOW-01`, `ASE-FLOW-08`, and `GJ-19` in `implementation-plan.md`.
**Runtime evidence (2026-11-21):** `/api/health` reports `8686e3cb…`; MCP deploy check against the TESBOPROJECT endpoint reports 49 tools, fingerprint `6f1a2c05c69f8948`, catalog fingerprint matches, `OK` with `REQUIRE_PROPOSAL_PREVIEW=1`. No human UI session was available, so every UI statement below is **source-only**.

**Note on the package name:** “Work Package A” does not appear anywhere in this repository (`docs/`, `AGENTS.md`, `CLAUDE.md`). See decision **D1**. This note treats Work Package A as the bounded slice defined in §1 and maps it to the existing requirement IDs above.

---

## 1. Scope

**In scope**

- Native requirement identity, state and immutable reviewable revisions carrying normative acceptance criteria.
- Typed, append-only requirement-version-to-case-revision links at criterion granularity.
- Four separate coverage readings: authored, approved, executed, passing — including stale and missing reasons.
- UI, REST and MCP entry points, authorization, audit, idempotent retry and concurrent-update behaviour.
- The `GJ-19` acceptance fixture and the mapping to `ASE-E2E-01` / `ASE-FLOW-01` / `ASE-FLOW-08`.

**Out of scope (this work package)**

- The governed Skills library (identity/version/approval/assignment/effective resolution) — specified but not implemented; see §3.10 and §9 D7.
- Automatic case publication, changes to case review/approval, changes to run admission.
- Replacing Jira/Linear/Notion mirrors or the ticket-key association on test cases.
- Changing `sourceRefs` semantics or Model Studio links.
- Plans, runs, executions, reporting surfaces beyond a coverage read.

---

## 2. What exists today (source-verified)

| Capability | Existing owner and symbols | Maturity | Evidence |
| --- | --- | --- | --- |
| Requirements screen | `Tesbo-Frontend/app/(app)/projects/[id]/requirements/page.tsx`; provider tabs, `requirement-link-warning`, coverage states | Shipped, provider-only | Subtitle says requirements are “synced from …” with full documents in the KB (line ~723); “View in Knowledge base” (line ~848); no create/revise requirement affordance |
| External requirement association | `legacy.service.ts` `linkedJiraKeys`/`linkedLinearKeys`/`linkedNotionPages` (~6540+): counts cases by `testcases.jira_issue_key` / `linear_issue_key` / `notion_page_id` | Shipped | MCP tool description `mcp.tools.ts:937`: “There is no separate 'requirements' table in this product: the ticket key on the test case IS the link” |
| Traceability matrix | `legacy.service.ts` `requirementMatrix` (~10303): cases joined to runs, executions and bugs | Shipped | MCP `get_requirement_matrix` (`mcp.tools.ts:1660`) is a case/run/bug matrix, not requirement-keyed |
| KB `requirement_note` documents | Type allowed in `V45_knowledge_base_v2.sql`; mirrored tickets inserted read-only by `integration-sync.processor.ts` (~572) with `source_provider`, `source_external_id`, `source_role='mirror'`, `is_read_only=true` | Shipped as mirror + general documents | Requirement notes created by authors are ordinary KB documents; no stable requirement identity, no criteria keys, no typed case relation |
| KB document revisions | `knowledge_document_versions` (`V45`, `V102`, `V156`): versions, `snapshot_kind` (`autosave/submitted/approved/rejected`), `submission_key`, `reviewed_version_id`, immutable reviewed snapshots | Shipped for documents | `createKnowledgeDocument`/`updateKnowledgeDocument` (~12173/12465), `submitKnowledgeDocument` (~13470); approval service is `approveAiMemory` (~13664) and applies to *ai_memory* only |
| Typed relations | None for requirements. `testcases.source_refs` JSONB is a citation list (`V101_testcase_citations.sql`); `mbt_model_case_links` (`V148`) and `graph_review_run_case_links` (`V147`) are other domains | Absent | R-ASE-05: sourceRefs, ticket keys, drafts and execution results are **not** a typed requirement relation or coverage |
| Exact-revision link precedent | `mbt_model_case_links` (`V148`) + `ModelStudioRepository.linkCaseForUser` (`model-studio-repository.ts` ~470): composite project FKs, `testcase_revision`, unique key, `ON CONFLICT DO NOTHING` + `MAPPING_CHANGED`, `FOR SHARE` on the case | Shipped | No project-activity/audit entry on link; a gap to close, not a pattern to copy wholesale |
| Case revision and approval | `testcase-edit-revision.ts`: `TESTCASE_EDIT_REVISION_SQL`, `TESTCASE_APPROVAL_REVISION_SQL`, `TESTCASE_APPROVAL_CURRENT_SQL`; receipts in `V151`/`V155`; `testcase_approval_snapshot()` includes content + custom fields/tags | Shipped | Approval requires principal `human_session`, current semantic revision |
| Run admission | `legacy/approved-run-cases.policy.ts` `assertApprovedNewRunCases`: current exact human receipt required for new run items | Shipped | `cycle_items.snapshot_approval_revision` / `snapshot_reviewed_content` (`V155`) record the accepted basis |
| Agent case proposals | `legacy.service.ts` `stageTestcaseChanges` (~15852), `testcase-proposal-review.ts` (`proposalDigest`, `expectedProposalRevision`, `requestKey`), apply through `zyraSave`/`zyraSaveAttempt` (~21648) | Shipped behind `TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED` | Official case IDs are allocated at protected apply; the refusal text names the missing governed effective-skill authority |
| Skills | `skills-governance.md` states the contract is proposed; `AGENT_RULE_TEMPLATE.md:67` says no skill tool is connected | Not implemented | Deployed catalog (49 tools) contains no skill tools |
| Requirement authoring via MCP/REST | Absent | Absent | Catalog listed above; `link_requirement_to_testcase` is retired in `common/testcase-publication.policy.ts` |

**Conclusion:** the existing relationship owner cannot represent an exact requirement revision + criterion → exact case revision. KB versions carry text but no stable requirement identity, criterion identity, approval or typed edge; ticket keys are external provider facts; `sourceRefs` is an authoring citation. A new, small relation owner is required.

---

## 3. Recommended relationship design

### 3.1 Why not reuse the existing surfaces

- **KB `requirement_note`:** suitable for content and version history, but `document_type` is taxonomy, not identity; mirrored notes are read-only external copies; there is no criterion-level identity, no requirement approval, and no typed case relation. Extending it into a requirement object would overload document semantics the spec explicitly says are insufficient (`design.md:22`).
- **Ticket keys on cases:** provider-owned and string-matched; they cannot carry a requirement revision or criterion. R-ASE-05 forbids reporting them as a typed relation or coverage.
- **`sourceRefs`:** an unordered citation JSON on a case, with no uniqueness, authorization or coverage semantics. It stays a citation.
- **Graph links:** `graph_review_run_case_links` relates graph history to runs and cases; it is not a requirement owner and must not be repurposed.

### 3.2 Smallest compatible extension (new tables only)

Migration **V159** (append-only; no backfill, no alteration of existing tables):

```sql
CREATE TABLE requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  key VARCHAR(32) NOT NULL,
  title VARCHAR(512) NOT NULL,
  description TEXT,
  state VARCHAR(16) NOT NULL DEFAULT 'draft'
    CHECK (state IN ('draft','active','retired')),
  current_version_id UUID,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (project_id, key),
  UNIQUE (id, project_id)
);

CREATE TABLE requirement_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id UUID NOT NULL,
  project_id UUID NOT NULL,
  version_number INT NOT NULL,
  title VARCHAR(512) NOT NULL,
  description TEXT,
  criteria JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{"key":"AC-1","text":"…","normative":true}]
  rationale TEXT,
  source JSONB NOT NULL DEFAULT '{}'::jsonb,
  state VARCHAR(16) NOT NULL DEFAULT 'draft'
    CHECK (state IN ('draft','approved','rejected','superseded')),
  submission_key UUID,
  content_digest CHAR(64) NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  UNIQUE (requirement_id, version_number),
  UNIQUE (id, project_id),
  FOREIGN KEY (requirement_id, project_id)
    REFERENCES requirements(id, project_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX idx_requirement_version_submission_key
  ON requirement_versions(requirement_id, submission_key)
  WHERE submission_key IS NOT NULL;

CREATE TABLE requirement_case_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  requirement_id UUID NOT NULL,
  requirement_version_id UUID NOT NULL,
  criterion_keys TEXT[] NOT NULL CHECK (cardinality(criterion_keys) > 0),
  testcase_id UUID NOT NULL,
  testcase_revision CHAR(64) NOT NULL,
  testcase_approval_revision CHAR(64),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  retired_at TIMESTAMPTZ,
  retired_by UUID REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (requirement_version_id, project_id)
    REFERENCES requirement_versions(id, project_id) ON DELETE CASCADE,
  FOREIGN KEY (testcase_id, project_id)
    REFERENCES testcases(id, project_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX idx_requirement_case_link_active
  ON requirement_case_links(requirement_version_id, testcase_id, criterion_keys)
  WHERE retired_at IS NULL;
CREATE INDEX idx_requirement_case_link_case
  ON requirement_case_links(testcase_id) WHERE retired_at IS NULL;
```

`requirements.current_version_id` is maintained by the service inside the same transaction as a new version (and validated by a deferred FK or trigger). Existing `testcases(id, project_id)` already has a unique index (`V148`), so the composite FK is available.

**Immutability:** requirement versions are immutable from insert. A guard trigger permits only the `draft → approved | rejected` transition and fills `approved_by`/`approved_at`; a second trigger validates that `criteria` is a JSON array of objects with unique non-empty `key` strings, and that `content_digest` matches the canonical version JSON. Mirrors the `V156` `protect_governed_knowledge_version` pattern.

**Criterion identity:** keys (`AC-1`, `AC-2`, …) are stable within a requirement’s lineage. A new version may reuse a key for an unchanged obligation, may add keys, and removes a key only by omission (which makes links naming it stale). A link names one or more keys that must exist in the linked version; the service validates, and a trigger re-validates at insert.

### 3.3 Identity and lifecycle

| Fact | Owner |
| --- | --- |
| Requirement identity and key | `requirements` row; key allocated per project under an advisory lock (same pattern as `testcase-external-id:<projectId>`), e.g. `REQ-1` |
| Revision identity | `requirement_versions` row; monotonic `version_number`; `content_digest` = canonical JSON hash (title, description, criteria, rationale, source) |
| Criterion identity | `criteria[].key` inside a version |
| Typed link identity | `(requirement_version_id, testcase_id, criterion_keys)` among active links |
| Case identity/revision | Existing `testcases.external_id`, `TESTCASE_EDIT_REVISION_SQL`, approval receipts |

States: requirement `draft → active → retired` (retiring is soft; history remains); version `draft → approved | rejected`, and `approved → superseded` when a newer version becomes current. A version is never edited; a correction is a new version.

### 3.4 Authorization

| Operation | Rule |
| --- | --- |
| Read requirements/coverage | Any project member (`requireProjectAccess`) |
| Create requirement / add revision | Project member with write access (same population allowed to author case drafts and KB documents); preview flag must be on |
| Approve/reject a requirement version | Project **owner or manager** through a human session only; machine tokens refused (mirrors AI-memory review and case approval authority) |
| Create/retire a link | Project member with write access; no approval implied |
| Cross-project target | 404 on the requirement/case, never a cross-project write; no existence leak |

### 3.5 Audit

Every accepted mutation writes one project-activity entry via `logProjectActivity`: `requirement_created`, `requirement_version_created`, `requirement_version_approved`, `requirement_version_rejected`, `requirement_case_linked`, `requirement_case_link_retired`, each with before/after identifiers, actor, requirement version digest and case revision. Denied cross-project attempts and stale-CAS refusals are additionally recorded in `audit_logs` with the rejecting reason (R-ASE-18 “rejected and audited”); accepted state is never written on refusal.

### 3.6 Retry and idempotency

- **Requirement revision:** `submissionKey` unique per requirement. Replaying the same key with the same canonical payload returns the existing version; the same key with different content is `409 SUBMISSION_KEY_REUSED`.
- **Link creation:** the active unique index plus `ON CONFLICT DO NOTHING` then an exact-row comparison; a replay with identical inputs returns the existing link. A replay naming a different case revision or criterion set is `409 REQUIREMENT_LINK_CHANGED` and must retire the old link first.
- **Retire:** idempotent; retiring an already-retired link returns the existing row.

### 3.7 Concurrency and stale revisions

- **Requirement revision:** transaction locks the `requirements` row `FOR UPDATE`, re-reads the current head after the lock (the lesson from V155’s post-wait recheck), compares `expectedVersionId` **and** `expectedContentDigest` to the current head, then inserts the next version and advances `current_version_id`. A mismatch is `409 REQUIREMENT_STALE_REVISION` with no row written.
- **Link creation:** `FOR SHARE` on the target testcase row, exact comparison of `testcaseRevision` to the current edit revision (and, when supplied, `testcaseApprovalRevision` to the current approval revision), then insert. A mismatch is `409 TESTCASE_REVISION_CHANGED` / `409 TESTCASE_APPROVAL_CHANGED`. Immutable requirement versions need no lock beyond the FK.
- **Approval:** rechecks the approving principal’s role after any wait and requires the version still be the one whose digest was reviewed; a superseded version cannot be approved.

### 3.8 Coverage semantics (separate facts)

For a requirement’s current version and a case, with `L` an active link:

| Reading | Predicate |
| --- | --- |
| **Authored** | `L` exists for the current requirement version (any case revision/approval state) |
| **Current link** | `L.requirement_version_id = current_version_id` AND `L.testcase_revision = current editRevision` AND `L.testcase_approval_revision = current approvalRevision` AND the case is not deleted |
| **Approved** | current link AND the requirement version is `approved` AND `TESTCASE_APPROVAL_CURRENT_SQL` is true for the case |
| **Executed** | approved AND there is an execution whose `cycle_items.snapshot_approval_revision = L.testcase_approval_revision` for that case (the run accepted that exact reviewed basis) |
| **Passing** | executed AND that execution’s status is `Passed` |

A linked draft contributes **authored only**. An approved-but-unrun case contributes **approved**, not executed/passing. A historical execution never counts after the case or requirement moves; it remains readable as history. Stale/missing reasons returned separately per criterion: `REQUIREMENT_VERSION_SUPERSEDED`, `CASE_REVISION_CHANGED`, `CASE_APPROVAL_CHANGED`, `CASE_ARCHIVED`, `LINK_RETIRED`, `NOT_LINKED`.

### 3.9 Entry points

**REST (human session; preview flag on):**
`POST /api/projects/:projectId/requirements` (create), `GET …/requirements`, `GET …/requirements/:id`, `POST …/requirements/:id/revisions` (`expectedVersionId`, `expectedContentDigest`, `submissionKey`), `POST …/requirements/:id/revisions/:versionId/approve|reject`, `POST …/requirements/:id/links`, `POST …/requirements/:id/links/:linkId/retire`, `GET …/requirements/:id/coverage`.

**MCP (read+write scopes; preview tools absent when the flag is off, like proposal tools):**
`create_requirement`, `add_requirement_revision`, `get_requirement`, `list_requirements`, `link_requirement_case`, `retire_requirement_case_link`, `get_requirement_coverage`. Approval/rejection is **not** exposed to tokens.

**UI:** the Requirements screen gains a **Native** source alongside provider tabs with create/revise; the requirement detail shows versions, criteria, links and the four coverage readings with reasons; the testcase detail panel shows typed requirement links (visually separate from `sourceRefs` citations and from Jira/Linear keys). Reuse existing panel/dialog and document-version patterns.

### 3.10 Skills resolution and pinning (target semantics vs today)

**Target (R-ASE-25/26/27):** before a governed requirement/case write, call `resolve_effective_skills` for the project/module/subtype/operation; pin the returned assignment/version IDs and digests onto the requirement version and the case proposal; an `UNASSIGNED`, ambiguous, expired, revoked or incompatible resolution blocks *approval* (not raw observation intake) per explicit project policy; conflicting composition is `BLOCKED`, never an arbitrary winner.

**Today:** no skill resolver, no skill tools, no `skills-lock` runtime; the deployed catalog has none. The case proposal path already refuses when the preview flag is off partly because governed skill authority is absent (`legacy.service.ts` ~15854). Therefore this slice must:

- keep native requirement authoring behind a **new default-off preview flag** (name in D3),
- record `skillContext: { status: "unavailable", resolvedAt: null }` on every requirement version and link creation receipt,
- present “no effective skill resolved — preview mode” in the human review view, and **never** claim governed skill provenance,
- remain forward-compatible: when the resolver ships, the flag is not a substitute; approval requires a resolved, pinned skill set.

---

## 4. Dogfood workflow in TESBOPROJECT

1. **Agent reads the owning spec and the change.** It records the source SHA and the specific requirement sections; no write yet.
2. **Agent creates a native requirement draft** (`create_requirement`) with title, description, criteria (`AC-1…`) and rationale. The response carries the requirement key/version 1 and `skillContext: unavailable`. Nothing is approved.
3. **Agent stages a case candidate** for the same change through `stage_testcase_changes` (existing review workflow). Because `sourceRefs` has no native-requirement type in this slice (D6), the draft’s Notes name the requirement key and spec section for the reviewer; the typed link is created later.
4. **Human applies the selected case drafts** in the review task. Only now does an official case ID, edit revision and (if requested) approval appear. Proposal ≠ publication ≠ approval.
5. **Agent or human creates the typed link** against the *official* case revision and approval revision (when approved) and the requirement version + criterion keys. The link is a relation, not an approval; duplicate retries are idempotent.
6. **Human approves the requirement version** (owner/manager, session-only) if it is not already approved. Approval is distinct from case approval and from link creation.
7. **Run creation** (if desired) uses the existing approved-case admission; the run’s `cycle_items` snapshot records the accepted approval basis. Executing the case is the only thing that creates executed/passing coverage.
8. **Revision:** the agent adds requirement version 2 with `expectedVersionId`/`expectedContentDigest`. Historical version 1 and its links remain readable; current coverage reports stale until links target version 2. No silent re-pointing.
9. **Reconcile:** the agent re-links the current case revision to version 2; the human sees the new coverage split. A missing or conflicting skill resolution would block approval once the resolver exists; today the preview marker is shown and the capability remains flagged.
10. **Report:** the agent states authored/approved/executed/passing before and after, and every item that remains unverified.

---

## 5. GJ-19 acceptance fixture (planned — NOT RUN)

All rows are planned checks. None has been executed; no CI or browser run exists for them.

| ID | Starting point / action | Entry points | Persisted evidence that would prove it | Status |
| --- | --- | --- | --- | --- |
| GJ19-01 | Owner creates a native requirement with two criteria | UI, REST, MCP | `requirements` row (key, project), `requirement_versions` v1 with two criteria and digest, activity `requirement_created` | NOT RUN |
| GJ19-02 | Owner revises criterion AC-2 and adds AC-3 | REST/MCP | v2 row; v1 still readable; `current_version_id` = v2; both digests distinct | NOT RUN |
| GJ19-03 | Link an exact approved case revision to v2 keys `[AC-2,AC-3]` | REST/MCP | active link row with exact `testcase_revision` and `testcase_approval_revision`, criterion keys, actor | NOT RUN |
| GJ19-04 | Link a **draft** case (no approval) | REST/MCP | link row with null approval revision; coverage authored=1, approved=executed=passing=0 | NOT RUN |
| GJ19-05 | Approve that case through the existing human review | UI/REST | receipt in `testcase_approval_receipts`; coverage after re-link to the approved revision: approved=1, executed=0 | NOT RUN |
| GJ19-06 | Execute the approved case as Passed in a run admitted after approval | UI/REST/MCP | `cycle_items.snapshot_approval_revision` equals the link’s approval revision; execution Passed; coverage executed=1, passing=1 | NOT RUN |
| GJ19-07 | Create requirement v3 after the run | REST/MCP | v1/v2/v3 readable; historical link intact; current coverage stale/missing with `REQUIREMENT_VERSION_SUPERSEDED` | NOT RUN |
| GJ19-08 | Re-link the current case revision to v3 | REST/MCP | new active link; old link retired or historical; current coverage moves; history still readable | NOT RUN |
| GJ19-09 | Unauthorized attempts: no session, guest/non-member, second tenant’s session, machine token approval | REST/MCP | 401/403/404, no rows written, audit entry for the rejection | NOT RUN |
| GJ19-10 | Stale `expectedVersionId`/digest on revision | REST/MCP | 409 `REQUIREMENT_STALE_REVISION`, no new version, prior head unchanged | NOT RUN |
| GJ19-11 | Duplicate retry: same `submissionKey`; same link payload twice; same key with different payload | REST/MCP | one version row / one active link; identical payload returns same ids; changed payload returns 409 and writes nothing | NOT RUN |
| GJ19-12 | Archive the linked case | UI/REST | link history preserved; current coverage excludes the case with `CASE_ARCHIVED`; executions/history untouched | NOT RUN |
| GJ19-13 | External ticket ownership: mirrored Jira/Linear/Notion document and the case’s ticket key | UI/REST | mirror document unchanged by native requirement ops; case ticket key unchanged; provider remains attributed | NOT RUN |
| GJ19-14 | Case re-approved after a content edit; old execution remains | Existing review + run | old execution stays historical; it no longer counts as executed for the new approval revision; coverage shows `CASE_APPROVAL_CHANGED` until re-link | NOT RUN |

Mapping to the rest of Work Package A: GJ19-01…03 prove R-ASE-04 acceptance (create, revise, both revisions readable, exact links); GJ19-04…06 prove R-ASE-05/06 separation of authored/approved/executed/passing and run admission; GJ19-07…08 prove historical links and stale/missing coverage; GJ19-09…11 prove authorization, audit, CAS and idempotency (ASE-E2E-05/06/07); GJ19-12…14 prove archive, provider ownership and exact-revision execution semantics (`ASE-FLOW-08`, `ASE-FLOW-25/26`).

---

## 6. First implementation slice

**Bounded deliverable**

1. Migration **V159**: three tables, indexes, immutability/approval/criteria triggers. No existing table altered, no backfill.
2. A `RequirementsService` as the single owner of identity, versions, links and coverage. REST controller and MCP tools call it; no table writes from adapters. MCP context gains the service (or a narrow facade) rather than a second implementation.
3. REST endpoints and MCP tools listed in §3.9, behind a default-off preview flag; approval/reject is REST+UI session-only.
4. Coverage read returning four counts plus per-criterion reasons; no derived number is stored.
5. UI: Native requirement list/detail/revise/approve, link picker on the requirement and a typed-links section on the testcase panel.
6. Tests, all **NOT RUN** at note time:
   - real-Postgres DB spec: immutability, criteria validation, CAS/stale revision, idempotent retries, link uniqueness/retire, coverage predicates;
   - API spec: authorization matrix, foreign-tenant 404s, approval authority, error codes and no-side-effect refusals;
   - MCP spec: tools absent when flag off, scopes enforced, schemas closed, no approval tool;
   - UI spec: native tab, version history, four coverage readings, typed-link display separate from citations;
   - GJ-19 rows above.

**Acceptance gates for the slice**

- [ ] Migration applies forward and the DB constraints reject every invalid shape in the DB spec.
- [ ] A draft-only link cannot raise approved/executed/passing coverage (GJ19-04).
- [ ] A superseded requirement version leaves historical links readable and current coverage stale (GJ19-07).
- [ ] Unauthorized and cross-tenant calls write nothing and are audited (GJ19-09).
- [ ] Duplicate retries produce no duplicate rows; changed payloads are refused (GJ19-11).
- [ ] External mirrors and ticket keys are untouched (GJ19-13).
- [ ] With the preview flag off, no native requirement tool is discoverable and REST writes are refused.
- [ ] Every accepted mutation has an activity entry; every refusal names its reason and writes no state.
- [ ] No claim of governed skill provenance is made in preview mode; `skillContext` is recorded as unavailable.

---

## 7. Compatibility and migration

- Append-only migration; existing requirements screen, ticket mirrors, sourceRefs, case review, run admission and Model Studio are unchanged.
- No backfill: existing mirrored `requirement_note` documents are **not** promoted into native requirements (no invented identity or criteria). A future migration may offer an explicit, reviewed import; not part of this slice.
- The native requirement key space is independent of `external_id` and of provider keys.
- Rollback: stop writing and disable the preview flag; tables remain inert history. No destructive downgrade.

---

## 8. Risks and limitations

- **Skill authority is unbuilt.** The slice cannot satisfy R-ASE-25 for governed authoring; it must stay a clearly labelled preview and must not be cited as compliance.
- **Two-step linking (D4)** means the human applying a case cannot see the typed link at apply time; the case Notes carry the requirement key only as context.
- **Coverage depends on approval-revision snapshots.** Cases older than `V155` have no `snapshot_approval_revision`; executions of pre-V155 runs cannot count as executed for the new approval basis (they remain historical).
- **Criterion-key discipline** is a design convention; a poorly chosen key reuse across versions can make historical links appear current. Validation prevents missing keys, not semantic drift — reviewers must treat revision diffs as meaningful.
- **UI is unverified in a running session**; all UI claims are source-only at this commit.

---

## 9. Unresolved decisions

| ID | Decision | Recommendation |
| --- | --- | --- |
| D1 | “Work Package A” is not defined in this repository; is there a canonical package section to cite? | Treat this note’s §1 as the definition until the canonical text is added; do not claim the package name is authoritative |
| D2 | Who may approve a requirement version? | Project owner/manager, human session only (mirror AI-memory review). Any member with write may author revisions |
| D3 | Preview flag name/default for this capability | `TESBO_NATIVE_REQUIREMENTS_PREVIEW_ENABLED`, default off; MCP tools absent when off; REST writes refused with `capability_unavailable` |
| D4 | Link timing: two-step after case apply vs carrying link intent through the protected apply | Two-step for the first slice (smallest, honest identity); record “intent carried through apply” as a follow-up |
| D5 | Criterion identity | Stable per-lineage keys (`AC-n`) reused only for semantically unchanged obligations |
| D6 | Add `requirement` as a `sourceRefs` citation type now? | No in this slice; the typed link is the relation, and Notes carry the key for review context. Revisit if reviewers need richer citations |
| D7 | Behaviour when no effective skill resolves | Allowed only in preview with `skillContext: unavailable` and a visible review warning; approval blocked once the resolver exists unless policy explicitly allows `UNASSIGNED` |
| D8 | Audit depth for denied attempts | Activity for accepted mutations; `audit_logs` for cross-tenant/stale/unauthorized refusals; confirm retention expectations with the security owner |

---

## 10. Evidence log

- `git fetch origin development`; `git rev-parse origin/development` → `8686e3cbce03a7c73f609140071f8e4d740215a1`.
- `GET /api/health` (production, 2026-11-21) → `gitSha = 8686e3cb…`.
- `scripts/mcp-deploy-check.mjs` against `…/projects/df072dfe-e4d0-406a-9350-e0d022c6323f/mcp` with `REQUIRE_PROPOSAL_PREVIEW=1` → 49 tools, fingerprint `6f1a2c05c69f8948` matches, `OK`. Catalog contains `get_requirement_matrix`; no native requirement authoring tools; retired `link_requirement_to_testcase` absent.
- Sources read: `docs/specs/agent-synchronized-engineering/{requirements.md,design.md,implementation-plan.md,README.md,skills-governance.md,AGENT_RULE_TEMPLATE.md}`; `Tesbo-Backend-Nest/src/legacy/{legacy.service.ts,testcase-edit-revision.ts,testcase-proposal-review.ts,approved-run-cases.policy.ts}`; `src/behavior-graph/model-studio-repository.ts`; `src/integration-sync/integration-sync.processor.ts`; `src/mcp/{mcp.tools.ts,mcp.types.ts}`; `src/common/testcase-publication.policy.ts`; migrations `V45`, `V101`, `V147`, `V148`, `V151`, `V155`, `V156`; `Tesbo-Frontend/app/(app)/projects/[id]/requirements/page.tsx`; `utils/` MCP proposal fixtures.
- No implementation, migration or acceptance run has been performed for this note.
