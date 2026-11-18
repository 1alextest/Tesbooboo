# ASER — Reuse-first technical design v0.1

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
| Manual/API/operations documentation | versioned KB document | document-type/section navigation and MCP |
| Decision, policy, enforcement rule | typed governed KB content with immutable authority-backed revisions | Policy UI, lifecycle and impact reports |
| Work item/task | unified native project task service derived from existing task/board infrastructure | agent work queue and board; Bugs remain defects |
| Bug | native Bugs service | work-item relation and graph link |
| File/evidence | existing KB file/storage/evidence services | MCP safe-upload/download/ref adapter |
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

**Preflight** (read only): Verify project binding, token permissions, runtime server identity, `tools/list` contract, source commit and existing applicable records. No automatic choice of another project when binding fails.

**Assess**: Find source and behavior changes, existing artifacts, affected stakeholders, applicable policy versions and tasks. Classify each domain as update/unchanged/not applicable/blocked/deferred, with rationale. For spontaneous code changes, this can occur incrementally; no prerequisite formal spec ceremony.

**Plan**: Establish affected requirement acceptance criteria and verification strategy. Preserve existing IDs, define potential manual/policy impact, list cases before automation. A specialist can draft one area but inherits no extra publishing authority.

**Build and prove**: Code, unit/integration/E2E tests and actual observations remain within the coding tool's execution environment. Record what was **run**, not just authored, and distinguish CI, local, and live target.

**Propose**: Generate/update *draft* native requirement revisions, test case candidates, manual edits, policy/decision/rule proposals and work item changes using existing services. Hash source inputs; keep base revisions and exact source citations. Never unilaterally rewrite an approved policy.

**Reconcile**: Link coherent candidate revisions, identify duplicates/conflicts, mark impacted existing cases stale, and surface QA/BA/policy/manual review through existing Zyra and notifications.

**Approve/publish**: Each domain's authorized reviewer approves exact revisions. Publishing occurs through authoritative services with optimistic concurrency and validation; an unapproved case cannot be introduced into a run.

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

- **Requirements:** Native + External tabs; details and revision diff; acceptance criteria; linked cases and gaps; approval/status.
- **Test Cases:** Existing editor and Zyra review; “Requirement coverage” links are separate from source citations.
- **Knowledge Base / User Manual:** existing document editor; grouped Manual/Policy/API documentation views without another document store.
- **Policies:** governed KB-backed policy index, active/draft/history, decision and enforcement reference details, review/activation permission checks.
- **Tasks & Issues:** existing task board extended to general project work; defect links continue to native Bugs; a single card exposes cross-artifact change status.
- **Files & Evidence:** existing KB file browse/upload/preview; verifiable byte metadata and canonical source linkage.
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
