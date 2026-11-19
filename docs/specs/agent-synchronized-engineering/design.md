# ASER — Reuse-first technical design v0.2 (governed skills)

**Status:** Architecture proposal only. Existing source owners must be re-verified at implementation head. No migration approved by this document.

## 1. Architecture

A coding change produces a **Change Packet**: a versioned, project-scoped *coordination receipt* that links canonical records without becoming a duplicate source of truth.

```text
App repository + coding agent + human intent
                   |
          app AGENTS.md / CLAUDE.md
                   |  (guidance; never trusted authority)
                   v
       Tesbo MCP (project-scoped token)
                   |
     Resolve approved active module skills
      (human-governed assignments only)
                   |
     Discover existing source/policy/records
                   |
     Existing Zyra orchestration + change review
                   |
            Change Packet / links
          /        |           \
  requirements   cases/tests   docs/policy/tasks/files
  native/external native owners existing Tesbo services
          \        |           /
         Review + apply + verification receipts
                   |
  Graph change impact + native traceability reporting
```

Do **not** introduce a new chat assistant, a shadow test case writer, a disconnected project board, a second Knowledge Base or an AI-owned policy authority. Reuse `graph_history`, current cache graph, Model Studio revisions, Zyra task/feedback history, existing notification writers, `LegacyService` business rules, and versioned KB documents; extend them only at evidenced gaps.

## 2. Current evidence and actual gaps

Inspected `development` source: `Tesbo-Backend-Nest/src/mcp/mcp.tools.ts`, `mcp.service.ts`, `docs/FEATURE_DOCUMENTATION.md`, and `graph-change-review.controller.ts`.

- Existing MCP: `create_testcase`, `update_testcase`, `sourceRefs`, `link_requirement_to_testcase`, `create_knowledge_document`, `update_knowledge_document`, graph change capture/history, behavior model drafts. The source currently registers 58 tools; this is **not** proof the deployed client sees them.
- Existing `link_requirement_to_testcase` accepts **exactly one** `jiraIssueKey`, `linearIssueKey`, or `notionPageId`. It does not accept a native Tesbo requirement ID. The `get_requirement_matrix` endpoint largely reports cases/runs/bugs; external Requirements UI counts linked non-deleted cases, which is not executed coverage.
- Existing KB `requirement_note` and feature-requirements templates can hold content, but do not constitute a first-class native requirement object with accepted criteria/revision-aware typed testcase edges.
- The KB already owns documents, folders, version history and files; the MCP source includes KB **document/folder** tools but does **not** advertise binary file-upload tools.
- Zyra has a generation-specific Kanban/task review; Bugs have their own records. Neither is yet a general work-item system covering implementation and policy/documentation tasks.
- Graph history/capture, Zyra change review and Model Studio provide a reuse substrate; source-declared behavior and model/case mappings are not proof of deployed or executed behavior.
- The 2026-11-15 assurance manifest explicitly records no independent team run. This proposal does **not** inherit unexecuted review verdicts.

## 3. Canonical ownership map

| Record/relationship | Authoritative owner | Projection/adapter |
| --- | --- | --- |
| Code diff, PR, commit, deployment | repository/CI/deployment provider | project source binding and graph observation |
| Native requirement content/version | existing KB document identity + typed requirement rules; approved DB mapping if necessary | native Requirements UI and MCP |
| Jira/Linear/Notion requirement | provider and existing synced cache | integration adapters, external key mapping |
| Case, approval and execution | native case/suite/plan/run/result services | MCP, Zyra generation, Model Studio, reports |
| Manual/API/operations documentation | versioned KB document, classified by audience/access and subtype | internal/external manual views, governed skill-specific authoring and MCP |
| Decision, policy, enforcement rule | typed governed KB content with immutable authority-backed revisions | internal/external policy views, effective skill resolution, lifecycle and impact reports |
| Work item/task | unified native project task service derived from existing task/board infrastructure | agent work queue and board; Bugs remain defects |
| Bug | native Bugs service | work-item relation and graph link |
| File/evidence | existing KB file/storage/evidence services | MCP safe-upload/download/ref adapter |
| Governed Skills Library and approved assignments | existing KB/version owner where compatible + narrow skill/assignment metadata with separate human authority | read-only effective-skill resolver, candidate MCP tools and human-only Skill Assignments UI |
| Cross-artifact link and review | native graph/link services + change review history | Change Packet and summary read model |

Before adding columns/tables, inspect existing migration indexes, KB version identities, Zyra tables and current graph link schema. The storage implementation is not pre-decided: prove reuse/extend/new options against required invariants first.

## 4. Change Packet contract

Proposed fields (exact API/storage decided by discovery; **not** currently available):

```json
{
  "changeId": "uuid",
  "projectId": "uuid",
  "sourceBindingId": "uuid-or-null",
  "workItemId": "uuid-or-null",
  "trigger": "feature|bugfix|refactor|policy|docs|infra",
  "source": {
    "repository": "owner/repo",
    "baseCommit": "sha-or-null",
    "candidateCommit": "sha-or-null",
    "deployedTarget": "unverified"
  },
  "participants": [{"principalId":"id","role":"coding-agent","parentSessionId":"id"}],
  "effectiveSkillSet": [{"assignmentId":"governed-binding-id", "skillVersionId":"approved-revision-id", "sha256":"approved-content-digest", "resolvedFor":"module/subtype/audience"}],
  "artifactAssessments": [
    {
      "domain": "requirements",
      "disposition": "proposed",
      "artifactId": "native-id",
      "baseRevision": "rev-3",
      "candidateRevision": "rev-4",
      "reason": "changed acceptance criterion",
      "evidenceRefs": []
    }
  ],
  "idempotencyKey": "stable-client-generated-key",
  "status": "open|review|partially_applied|completed|blocked",
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

There is no claim that this is the final database shape. Link records shall include `fromType, fromId, fromRevision, relationType, toType, toId, toRevision, provenance, confidence/evidence, linkStatus`, scoped to the same project. Use existing graph edges where semantics match; a graph projection must not invent the authoritative relation.

Suggested typed edges: `implements`, `specified_by`, `verified_by`, `documented_by`, `governed_by`, `caused_by`, `tracked_by`, `evidenced_by`, `supersedes`, `depends_on`, `affects`. Distinguish typed durable relationships from `sourceRefs` contextual citations.

## 5. Agent work cycle

**Preflight** (read only): Verify project binding, token permissions, runtime server identity, `tools/list` contract, source commit, existing applicable records **and the exact approved effective skill assignments for each selected module/subtype/audience**. Do not load a skill proposal or stale cached version as authority. Missing or conflicting mandatory binding blocks the affected governed authoring action; no automatic choice of another project when binding fails.

**Assess**: Find source and behavior changes, existing artifacts, affected stakeholders, applicable policy versions and tasks. Classify each domain as update/unchanged/not applicable/blocked/deferred, with rationale. For spontaneous code changes, this can occur incrementally; no prerequisite formal spec ceremony.

**Plan**: Establish affected requirement acceptance criteria and verification strategy. Preserve existing IDs, define potential manual/policy impact, list cases before automation. A specialist can draft one area but inherits no extra publishing authority.

**Build and prove**: Code, unit/integration/E2E tests and actual observations remain within the coding tool's execution environment. Record what was **run**, not just authored, and distinguish CI, local, and live target.

**Propose**: Generate/update *draft* native requirement revisions, test case candidates, internal/external manual edits, internal/external policy/decision/rule proposals, work item changes and (when requested) *new skill candidates/successor proposals* using existing services and the pinned governing skill versions. An agent can propose a new skill version but **cannot mutate any existing skill version, assign/reassign it, activate/deactivate it or approve it**, even through an admin-owned machine token. Hash source inputs; keep base revisions and exact source citations. Never unilaterally rewrite an approved policy.

**Reconcile**: Link coherent candidate revisions, identify duplicates/conflicts, mark impacted existing cases stale, and surface QA/BA/policy/manual review through existing Zyra and notifications.

**Approve/publish**: Each domain's authorized reviewer approves exact revisions. Skill promotion and module assignment require independently authenticated interactive human governance, not an MCP credential issued by a human. Publishing occurs through authoritative services with optimistic concurrency and validation; an unapproved case cannot be introduced into a run.

**Close out**: Save exact persisted receipt(s), links, missing evidence, blocked/deferred work and next actions; support resume after interruption.

## 6. Multistep reliability and security

- Server: all tool handlers call native services; verify project identity and role per operation, not only at the initial client handshake. Explicitly bind reads and writes to the token's project.
- Proposal idempotency: `(projectId, operationKind, idempotencyKey)` must return the prior result when payload hash matches; a reused key with a different payload is a conflict.
- Revision guard: every update carries `expectedRevision` (or an equivalent version token); concurrent disjoint changes may merge only when semantically safe and reviewed.
- Batch safety: where a native DB transaction is possible, use it; otherwise persist a durable per-item journal/receipt and compensating/retry strategy. Do not describe a partially committed multi-artifact batch as atomic.
- Permissions: `read`, `propose`, `edit`, `review`, `publish`, `approve_policy` are distinct **capabilities** enforced by Tesbo role/authorization rules. Avoid assuming all existing tokens support these granular scopes.
- Auth and secrets: server-side source allowlist, stored source binding, no user-supplied URL/bearer tokens in free-text prompts, file content/byte checks, tenant isolation and audit trails. An agent is never the policy authority by virtue of being the proposer.
- Client version drift: compare deployed `serverInfo.version` / tool fingerprint and introspected schemas; reconnect or mark blocked if the needed capability is absent. Tool catalog advertised in a branch is not runtime verification.

## 7. Modules and user experience

Use the **existing project navigation** and domain services, with modules or views as needed:

- **Requirements:** Native + External tabs; details and revision diff; acceptance criteria; linked cases and gaps; approval/status. Proposal UI shows effective requirements-authoring skill version.
- **Test Cases:** Existing editor and Zyra review; “Requirement coverage” links are separate from source citations.
- **Knowledge Base / User Manual:** existing document editor; internal/external plus functional-audience subtypes; grouped Manual/Policy/API documentation views without another document store. Audience, source authority and visibility are independent axes.
- **Policies:** governed KB-backed policy index, internal application-governance and external-facing/externally sourced policies, active/draft/history, decision and enforcement reference details, review/activation permission checks, skill-specific authoring rules.
- **Tasks & Issues:** existing task board extended to general project work; defect links continue to native Bugs; a single card exposes cross-artifact change status.
- **Files & Evidence:** existing KB file browse/upload/preview; verifiable byte metadata and canonical source linkage.
- **Skills Library:** one versioned searchable library, candidate creation/proposed successor via MCP, dependency/evaluation and usage history; only a separately authorized human governance view may approve versions, activate or reassign effective bindings, or change root meta-skill.
- **Zyra Change Review:** one change packet and per-domain proposals, diffs, missing verification, approvals, timeline and reports. No new independent Copilot.

UI status must never collapse `draft`, `linked`, `approved`, `executed`, `passed` and `deployed-verified` into one “complete” badge.

## 8. Policy design extracted from Nesberry (context-sensitive)

Nesberry's Policy Ledger uses distinct *Decision* → *Policy Version* → *Business Rule/enforcement*, append-only semantic versions, provenance/authority, version predecessor validation, session effects and link integrity. Port that **contract**, not its file layout/ID namespace:

- In Tesbo, the KB document owns approved policy text and immutable revision identity. Typed projections expose active/draft/history.
- A decision explains who/why; the policy states normative invariant and effective scope; rules/tests/guards prove some degree of enforcement.
- Session manifest principle becomes a persisted Change Packet activity/effect receipt. Approval and publication remain authorized and audited.
- Policy change impacts graph-linked requirements/cases/manuals/tasks; unknown/dangling links remain explicitly uncertain.
- Source completeness matters: Nesberry's policy-ledger tasks show some phases built and some pending. Do not transplant incomplete features as "already implemented."

Nesberry's concurrent issue-filing lesson becomes **per-record isolation**, collision checks and optimistic locking in Tesbo's DB, not an `ISS-NNNN.md` store.

## 9. Evidence tiers

| Assertion | Minimum evidence |
| --- | --- |
| Proposed artifact | Persisted draft ID + readable revision |
| Approved artifact | Authorized review event binding the precise revision |
| Code changed | Pinned repository diff/commit |
| Test authored | Saved case/spec ID, not a pass |
| Test executed | Actual runner/run receipt + result + selected scope |
| Target validated | Known deployed target identity + test evidence against it |
| File verified | Retrieved/checksummed bytes, not metadata count |
| Change complete | Domain dispositions, accepted revisions, residual risks and reviewer sign-off as applicable |

No artifact count or generated graph equals a proof of real target behavior.

## 10. Skills governance architecture and seven-domain lifecycle
The complete, testable contract is [skills-governance.md](skills-governance.md); this design adopts it as a **governing layer**, not a seventh duplicate document store.

### 10.1 Two separable invariants
1. **Skill identity and immutable revisions:** skills are versioned native content; the agent's only skill mutations are additive candidate creation/proposed successors. Creation, editing existing version payload, approving and publishing are distinct verbs.
2. **Effective assignment authority:** a separate typed binding resolves exact approved skill versions to module/subtype/audience/project operations. Activation/deactivation/assignment, precedence and root protection are *never MCP-writable*. The human-governance endpoint must reject machine principals even when the token owner is a human administrator.

A Skills-authoring meta-skill is itself a governed artifact, but initial bootstrap and successor promotion use an independent human-controlled root trust anchor, not a recursive skill loop. The root can be replaced only by a separately authorized and evidenced governance decision.

### 10.2 Application and source boundaries
- **Manual:** module/user group/internal-external distribution/ACL and artifact subtype are orthogonal. Internal instructions, developer manuals, external customer instructions, partner manuals and support runbooks are not one indiscriminate template.
- **Policy:** internal application/business/governance policies and external-facing or externally mandated policies are distinct in audience, source of authority, required sign-off, jurisdiction and scope; an externally mandated rule can be handled by an internal enforcement policy while external-public display remains separate.
- **Project-specific adaptations:** portable core and scoped adapter may compose by a human-approved rule. No "last matching skill wins" and no candidate skill can override the root, change the module assignment or supply its own authority.
- **Agent control:** a governed authoring call pins effective assignment IDs, skill version IDs and hashes in the candidate and Change Packet. The native service revalidates binding before submission/promotion; stale means `SKILL_CONTEXT_STALE`, ambiguity means `SKILL_ASSIGNMENT_CONFLICT`, and absent mandatory mapping means `SKILL_UNASSIGNED`.
- **Prompt injection:** a skill candidate is untrusted input until approved and assigned, and external files never inherit instruction authority just by being cited. Effective skills are signed/digest-bound read results; references, assets and examples remain data.

### 10.3 End-to-end authoring flow
```text
coding agent / optional specialist delegates
           |
      MCP identity + project/source binding
           |
  resolve_effective_skills (read-only)
    -> exact approved versions, assignments and hashes
           |
   read existing records + actual target behavior
           |
   create draft per applicable module, pin governing skill set
    -> requirements  -> native testcase candidates
    -> internal/external manuals, internal/external policies
    -> tasks/issues, evidence/files, optionally skill candidate
           |
   native writer validation, typed links, idempotency, audit
           |
     human review for artifact publication
     separate trusted human skill activation/assignment
           |
    graph impact + historical version/skill provenance
```

New skill candidates do not change any active effective assignment. A skill assignment change mid-flight preserves the candidate and records a blocking stale context unless specifically re-reviewed; the prior exact skill version stays in historical records and frozen executions. Old MCP/REST/AI writers **must not** bypass server-enforced skill applicability: inventory and compatibility/migration gate precedes rollout.

### 10.4 Proposed conceptual governance model (no migration asserted)
- `skills`: stable identity, owning scope, shared KB document identity if compatible, lifecycle and metadata.
- `skill_versions`: immutable content snapshot, predecessor, hash, references, candidate/published/rejected event identity; no in-place overwrite.
- `skill_assignments`: independently versioned binding of approved skill-version(s) to module/context plus activation/precedence/owner/approval.
- `skill_reviews`: human decision and source of authority binding exact reviewed payload hash to version/assignment.
- `artifact_skill_usages`: durable immutable provenance edge per artifact/content version; migration unknown marked UNKNOWN.
- `skill_effective_resolution`: derived read model only, no authored parallel truth.
These are **logical entities**, not a mandate to create six new tables. Use existing KB/history/graph/audit models first, add narrow constrained metadata where proven necessary.

### 10.5 Admission and completeness criteria
Design isn't ready until library version lineage, composition conflict, root-meta bootstrap, inaccessible/inactive skill, revocation/rollover, per-role privilege checks, cache consistency, externally sourced obligations, all existing REST/MCP/UI writer paths, candidate poisoning, historical provenance and a realistic human approval flow are specified with independently falsifiable tests. The `SK-E2E` test matrix in the Skills document is mandatory for implementation admission, **not** proof of execution.

No implementation or current deployment claim is implied by this section.
