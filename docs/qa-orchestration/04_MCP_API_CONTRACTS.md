# Proposed MCP / REST Contracts and Integration Security

**Current package amendment:** 1.4.47 — 26 November 2026; PROPOSED / NOT FROZEN. Read the final revision 1.4.47 section for this update. Earlier revision headers and receipts below retain their historical scope.

**Document ID:** TESBO-API-004 | **Revision:** 1.4.39 — 21 November 2026; module authoring principles and contextual guidance integration; NOT FROZEN | **Status:** mixed proposed and scoped native contracts; NOT FROZEN. PROPOSED labels remain proposals.
**Scoped implementation evidence:** Native preview increments are tracked in Tesbo PR95 and PR98; use their exact-head receipts and the MBT contract/acceptance sections below. Historical full-source audit pins and older review results retain their original scope/date. Unverified criteria and independent assurance remain open; this is not package-wide implementation or deployment certification.
**Important:** Names, JSON payloads and paths labeled `PROPOSED` below are **not existing routes**. Discover/confirm their implementation after engineering work. Source audit found current Tesbo MCP at `/api/projects/:projectId/mcp` and `/api/mcp` through JSON-RPC 2.0 and a `tsbo_` bearer token.

**Project-neutral contract invariant:** The existing MCP/REST task/report/review tool schemas are stable across projects; each request is bound to project and typed target context. OpenCode, Chrome MCP, DMIS fields, Excel, GitLab and government policies are NOT required parameters or hardcoded default values. Where the current API exposes web `url`, that field is permitted only under a `web` target adapter; define typed resource selectors/action policies for other supported adapters instead of trying to encode them as fake URLs. Reject unsupported adapter types and cross-project context with structured errors. Project-configured trackers and imports are optional and may be absent.

**Reuse/protocol rule (P-01–P-20, architecture §17):** Extend Tesbo's existing project MCP gateway/registry and shared authorized domain services. Study Qase's task-oriented discovery design, but do not deploy a separate QA MCP service. A2A can be a future transport adapter for peer agents, while AG-UI is only a potential Copilot event/render bridge; neither provides Tesbo project authorization, immutable source receipts, or approval authority. Provider/CLI-specific protocol endpoints must demonstrate actual support; absence of capability is `NOT_SUPPORTED`, not synthetic success. No browser or desktop companion is required.

**Current integration amendment:** Read revision 1.4.28 below for ASER scope, exact canonical owners and contracts. Earlier dated source/implementation claims retain their original scope. The original QA round trip and P-07/P-14/P-17/P-18 are preserved. New runtime tests remain NOT RUN; the package is NOT FROZEN.

## 1. Protocol positioning

- **Tesbo MCP:** coordination and durable QA data (task inbox, prompt revision, report/evidence submission, proposals, review history). It is not the Chrome browser MCP.
- **OpenCode's Chrome MCP:** browser-control tool selected and invoked by OpenCode on its own workstation; it need not know Tesbo's PostgreSQL schema.
- **Analysis client:** ChatGPT initially; any future authorized analysis client may use the same Tesbo MCP tools.
- **REST UI:** exact same domain services/policy checks as MCP, not alternative privileged data mutations.
- **MCP tool discovery:** may be filtered to principal permissions, but every `tools/call` still checks authorization at execution time.

## 1.1 Live readiness and shared-service constraint

The live API & MCP page displayed the project endpoint and repository-tool catalogue, but the project had no token. No authenticated JSON-RPC discovery/call, ChatGPT MCP connection, external task/report or selective publication was exercised. Browser login and a KB create/search/reopen/history check succeeded; that is a separate path.

All task/report/proposal names below are proposed contracts. Implement them as adapters over the shared services in `03_TECHNICAL_DESIGN.md`. Generalize existing `ai_generation_requests` staging and selected transactional save; do not create a second proposal engine or send an external task to the existing internal-generation POST. Existing tools remain compatibility adapters under the same policy.

Capability names are proposed stable semantic operations, not current token scopes. Current read/write tokens must not silently become all capabilities. External exchange works without a Tesbo AI-provider key; provider allocation, agent identity and client authentication are independent.

## 2. Proposed MCP tool catalogue

| Tool name (proposed) | Capability | Principal's authorized use |
|---|---|---|
| `create_test_task` | `task.create` | Draft feature-testing prompt and contextual metadata |
| `get_test_task` | `task.read.assigned` or `task.read.project` | Read exact prompt revision and safe context |
| `revise_test_task` | `task.edit` | Create new draft prompt revision, cannot rewrite claimed version |
| `submit_test_task` | `task.submit` | Move task from draft to ready/dispatch approval |
| `assign_test_task` | `task.assign` | Assign an active agent instance |
| `list_assigned_tasks` | `task.read.assigned` | List ready/assigned work only for the caller's instance |
| `claim_test_task` | `task.claim.assigned` | Atomic lease of one assigned task revision |
| `heartbeat_test_task` | `task.progress.assigned` | Renew lease if assignment and token still valid |
| `report_task_progress` | `task.progress.assigned` | Progress/question action bound to current attempt generation; does not resume expired work |
| `answer_task_clarification` / `resume_test_task` | `task.clarification.answer` / `task.resume.assigned` or dispatch | Append answer; explicit new fenced attempt on resume; material changes require prompt revision |
| `submit_test_report` | `report.submit.assigned`, scoped `report.supplement` or explicit human `report.import.manual` | Phase RESERVE returns pending report ID; phase FINALIZE commits immutable narrative/manifest after verification |
| `start_evidence_upload` / `attach_test_evidence` | `report.evidence.upload` | Upload/attach evidence via authenticated upload links/chunks |
| `get_test_report` | scoped `report.read` | Original source/manifest plus provenance, constrained to current project/assigned-reference grants |
| `read_report_artifact` | scoped `report.evidence.read` | Actual permitted MIME/length/hash and client-supported image/resource/content, reauthorizing current parent access |
| `list_task_reports` | `report.read` | Retrieve source and supplemental report sequence |
| `create_analysis_revision` | `analysis.create` | Store synthesis with claim/evidence references |
| `create_change_proposal` | `proposal.create` | Stage multi-operation review request (no suite write) |
| `add_proposal_operations` | `proposal.edit` | Add typed suite/case, run-result, **native Tesbo bug create/link/update** and separate external issue-copy proposals; never invoke live Bugs writer during staging |
| `submit_change_proposal` | `proposal.submit` | Queue revision for human review |
| `get_proposal_review` | `proposal.read` | Get complete current diff, comments, decisions and state |
| `revise_change_proposal` | `proposal.edit` | Produce new revision after comments; old approvals invalidated as needed |
| `create_followup_task` | `task.create` + permitted source read/dispatch grant | ChatGPT or human creates a linked clarification/retest/verification task referencing original task/report/finding/operation IDs and immutable evidence context; no live browser command or inherited approval |
| `get_qa_format_profile` | scoped `context.profile.read` | Exact referenced approved schema/rules version without unrelated case enumeration |
| `comment_on_proposal` | `proposal.review.comment` | Add attributed revision/operation/field discussion without granting approval |
| `list_change_proposals` | scoped `proposal.read` | Paginated source-neutral review inbox/search with pending history and durable links |
| `list_reports_for_analysis` | scoped `report.read` / analysis | Paginated reports awaiting synthesis across permitted tasks without pasted report IDs |
| `list_case_versions` / `get_case_version` | scoped case/history read | Existing testcase_versions/provenance read adapter; no second version store |

**Initial no-agent-merge rule:** human approval/merge goes through authenticated Tesbo UI; do not expose `approve_proposal` or `merge_proposal` to assistant credentials in MVP. Future policy may permit delegated review only after separate security design and explicit human authorization.

## 2.1 Exact ChatGPT ↔ Tesbo ↔ executor round trip (PROPOSED; no live client proof)

| Phase | Client and MCP tool | Durable server record / transition | Call must **not** do |
|---|---|---|---|
| Scope | ChatGPT → `create_test_task` / `submit_test_task` | Project-bound task and immutable prompt/context revision, planned scope, target adapter and optional selected browser-tool capability | Execute browser, require Zyra model key, or mint test case |
| Dispatch | Authorized human/dispatcher → `assign_test_task`; OpenCode → `list_assigned_tasks`/`claim_test_task` | Instance-bound task assignment, active attempt/lease generation; exact prompt revision | Assume an offline runtime woke up or borrow issuer permissions |
| Execute | OpenCode → configured Chrome MCP **or** Playwright MCP → authorized target | OpenCode's external tool transcript; actual observed environment/role/build/actions/evidence | Mistake this second MCP for Tesbo MCP or assume either tool exists without setup |
| Evidence | OpenCode → `submit_test_report` RESERVE; `start_evidence_upload` / `attach_test_evidence`; FINALIZE | Immutable report ID/body, manifest/bytes/hash, observed scope, current attempt and authorization | Create official cases/results/bugs on receipt or expose unreviewed evidence publicly |
| Analysis | ChatGPT → `list_reports_for_analysis`, `get_test_report`, `read_report_artifact`, `get_case_version`, `create_analysis_revision` | Evidence-cited synthesis with fact/inference/uncertainty and actual source completeness | Treat raw instructions as authority or fabricate missing evidence |
| Proposal | ChatGPT → `create_change_proposal` / `add_proposal_operations` / `submit_change_proposal` | Revisioned typed case, accepted-result, native bug and optional tracker-copy items with stable identities | Call `create_bug`/case CRUD directly or misrepresent item draft as published |
| Retest | ChatGPT or human → `create_followup_task`; authorized dispatcher assigns → OpenCode claims/executes/resubmits | Linked follow-up task/new prompt+attempt/new immutable report and new analysis/proposal revisions | Rewrite first report, silently broaden target actions, carry stale approvals, or mark tests passed |
| Decide/apply | **Authenticated human UI** → shared REST review decisions + separate selected apply | Immutable human decisions, exact proposal operation and checked base, official case/result/native `bugs` record, apply receipt and audit | Grant MCP assistant approval/merge or post external tracker issue by default |

**Minimum identifiers to persist/return:** `projectId`, `taskId`, `promptRevisionId`, `assignmentId`, `attemptId` + fencing generation, `reportId`, `artifactId` + hash, `analysisRevisionId`, `proposalId`, `proposalRevisionId`, `operationId`, `humanDecisionId`, `applyReceiptId`, and published `caseId`/`executionId`/`bugId` as applicable. Reference continuity and discovery are mandatory even for a new ChatGPT conversation. Unknown IDs, unapproved versions, wrong project, wrong assigned instance, missing capability or stale attempt fail closed with structured errors.

**Executor tool contract is external to Tesbo MCP:** do **not** invent a universal `browser.click` Tesbo tool. The task contains adapter type (`web` initially), target policy, allowed action classes, requested observations/evidence and optional compatible tool capabilities. OpenCode chooses an actually connected Chrome MCP or Playwright MCP implementation and records what it used. A different compatible executor later preserves Tesbo schema and governance. An unsupported API/mobile adapter returns `NOT_SUPPORTED` rather than being treated as a web URL.

**Defects:** Native Tesbo Bug publication is a protected selected-apply operation, not an assistant MCP tool. The user may instead approve text for manual GitLab/other tracker filing. If a project chooses both, maintain explicit distinct native Bug ID and external ticket ID, links and independently approved outbound action; never conflate or auto-duplicate. Existing Bugs linking can alter execution state, so reviewed link/side-effect scope is mandatory.

## 3. Proposed REST endpoints

Use project-qualified paths for clear resource ownership, while enforcing writability at the domain operation. Prefixes alone do not cover MCP aliases/entity routes or distinguish MCP POST reads. Exact paths remain illustrative and must follow the existing route/service conventions; they do not mandate new independent modules.

| Method and proposed route | Action | Capability |
|---|---|---|
| `POST /api/projects/:projectId/test-tasks` | Draft task with initial prompt | `task.create` |
| `GET /api/projects/:projectId/test-tasks` | List tasks scoped to caller | `task.read.*` |
| `POST /api/projects/:projectId/test-tasks/:taskId/revisions` | New immutable prompt revision | `task.edit` |
| `POST /api/projects/:projectId/test-tasks/:taskId/assignments` | Assign agent instance and revision | `task.assign` |
| `POST /api/projects/:projectId/task-assignments/:id/claim` | Claim assigned task | `task.claim.assigned` |
| `POST /api/projects/:projectId/task-assignments/:id/heartbeat` | Lease extension | `task.progress.assigned` |
| `POST /api/projects/:projectId/test-tasks/:taskId/reports` | RESERVE pending receipt / FINALIZE immutable source and manifest | assigned primary executor, explicit manual-import human or separately scoped historical supplement |
| `POST /api/projects/:projectId/task-reports/:id/artifacts` | Upload evidence | `report.evidence.upload` |
| `GET/POST /api/projects/:projectId/change-proposals` | Paginated filtered read / shared draft | scoped `proposal.read` / `proposal.create` |
| `GET /api/projects/:projectId/task-reports` | Filtered analysis inbox including old pending reports | scoped report/analysis read |
| `POST /api/projects/:projectId/test-tasks/:taskId/clarifications` | Append question/answer; no implicit resume | scoped question/answer authority |
| `POST /api/projects/:projectId/test-tasks/:taskId/resume` | New fenced current attempt after explicit resume | dispatcher/assigned resume |
| `GET /api/projects/:projectId/task-reports/:id/artifacts/:artifactId` | Reauthorizing content adapter | scoped evidence read |
| `GET /api/projects/:projectId/testcases/:caseId/versions` | Read existing definition/provenance versions | scoped case/history read |
| `GET /api/projects/:projectId/testcases/:caseId/versions/:versionId` | Exact immutable version | scoped case/history read |
| `PATCH /api/projects/:projectId/workflow-policy` | Protected expected-version CAS update | current policy administration |
| `GET/POST /api/projects/:projectId/access-profiles` | Read/create/version/validate/activate/retire existing grant profile model | delegated profile administration |
| `GET/POST /api/projects/:projectId/qa-formats` | Versioned QA-format lifecycle | delegated format administration |
| `POST /api/projects/:projectId/change-proposals/:id/revisions` | New revision | `proposal.edit` |
| `GET /api/projects/:projectId/change-proposals/:id/diff` | Revision-level diff | `proposal.read` |
| `POST /api/projects/:projectId/change-proposals/:id/comments` | Review discussion | `proposal.review.comment` |
| `POST /api/projects/:projectId/change-proposals/:id/decisions` | Review selected operations | `proposal.review.decide` + human policy |
| `POST /api/projects/:projectId/change-proposals/:id/merge` | Publish selected approved ops atomically | `proposal.publish.merge` + human policy |
| `GET/POST /api/projects/:projectId/agent-instances` | Compatibility DTO over extended agents/actors identities | `agent.read` / `agent.register` respectively |
| `POST /api/projects/:projectId/agent-instances/:id/revoke` | Revoke | `agent.grant.manage` |

**Compatibility:** preserve current Tesbo MCP and automation endpoints; centralize service policies so they cannot bypass protected suite or impersonate another project. Do not accidentally block read-only calls due only to an HTTP `POST` verb used by MCP/resolve endpoints.

## 4. Example request/response objects (illustrative, no secrets)

### 4.1 Create an exploratory testing task (DMIS web pilot illustration; not mandatory fields for every project)

```json
{
  "title": "Events: create, lifecycle and validation",
  "targetKind": "web",
  "kind": "EXPLORATORY",
  "roleKey": "APPLICATION_ADMINISTRATOR",
  "moduleKey": "MASTER_DATA_EVENTS",
  "environmentRef": { "id": "<existing-environment-id>", "version": "<approved-context-version>" },
  "executionMode": "EXTERNAL_AGENT",
  "qaFormatProfileRef": { "id": "<profile-id>", "version": 1 },
  "promptMarkdown": "Test the Events feature through your configured Chrome MCP. Record UI, network and evidence. Do not edit application code. Report every untested path distinctly.",
  "evidenceExpectations": ["screenshots", "reproduction_steps", "observed_network_when_available"],
  "caseRefs": [],
  "requestedDispatchMode": "MANUAL"
}
```

Proposed response:

```json
{
  "taskId": "<uuid>", "state": "DRAFT", "promptRevision": 1,
  "promptSha256": "<sha256>", "assignedAgentInstanceId": null
}
```

The server derives effective dispatch/review policy from versioned project configuration; a client request cannot disable it. Resolve environment/context references in-project and preserve the dispatched snapshot; regression case references include exact authored definition/custom-field/profile versions. No Tesbo model-key allocation is needed.

**Server must not** embed any target-project passwords, session cookies, OAuth tokens, VPN settings or secret credentials in this record (DMIS credentials are one pilot example).

### 4.2 Claim task: the execution agent does not invent a case ID

```json
{ "taskId": "<uuid>", "agentInstanceId": "<uuid>", "idempotencyKey": "<unique-client-id>" }
```

```json
{
  "assignmentId": "<uuid>", "attemptGeneration": "<server-issued-fence>",
  "leaseExpiresAt": "<timestamp>", "renewAfterMs": 60000,
  "taskId": "<uuid>", "promptRevision": 1,
  "promptMarkdown": "<exact prior text>",
  "promptSha256": "<sha256>",
  "caseRefs": [], "taskKind": "EXPLORATORY"
}
```

The caller's authenticated agent identity must match the assignment; never trust the supplied agent ID alone. Request must be atomic. attemptGeneration is server-issued and required on heartbeat/progress/primary-report reservation/finalization/resume; it is not a caller-chosen version. renewAfterMs is illustrative, not a selected production SLA. Lease extension requires same authenticated instance, current generation/authority and nonexpired lease. Late heartbeat/release cannot affect a replacement attempt. Setup-blocker report can finalize from CLAIMED without asserting the browser ran.

### 4.3 Reserve, upload and finalize a raw report

First call the same proposed report operation with phase RESERVE. It returns reportId before any artifact requires it:

```json
{
  "phase": "RESERVE",
  "taskId": "<uuid>",
  "assignmentId": "<uuid>",
  "attemptGeneration": "<current-server-issued-fence>",
  "idempotencyKey": "events-attempt1-reserve1",
  "receiptKind": "ORIGINAL"
}
```

```json
{
  "reportId": "<uuid>", "state": "PENDING_RECEIPT",
  "requiredEvidence": ["<profile-derived-requirement>"],
  "pendingExpiresAt": "<policy-timestamp>"
}
```

Upload/attach artifacts against that pending report ID and current authority using existing storage adapters. Verify actual bytes/length/MIME/checksum. Then finalize:

```json
{
  "phase": "FINALIZE",
  "reportId": "<reserved-uuid>",
  "assignmentId": "<uuid>",
  "attemptGeneration": "<current-server-issued-fence>",
  "idempotencyKey": "events-attempt1-finalize1",
  "rawMarkdown": "# Original runtime report\n... complete report verbatim ...",
  "artifactManifest": [
    { "artifactId": "<verified-id>", "sha256": "<sha256>", "required": true }
  ],
  "observations": [
    { "path": "Events > Create", "observedOutcome": "BLOCKED", "evidenceClassification": "LIVE_OBSERVED", "evidenceRefs": ["<verified-id>"], "notes": "Record exactly what happened; browser execution is not inferred." }
  ]
}
```

Server derives finalized content hashes and returns immutable receipt/time/manifest. Only the initial current-attempt primary receipt moves CLAIMED/IN_PROGRESS to REPORTED; replay returns its prior receipt without changing later state. Supplements/historical/manual evidence-only receipts append provenance without rewinding analysis/closed/terminal lifecycle. Same finalize key/payload returns original receipt; conflicting payload/key fails. Lost response must be recovered by receipt lookup/replay, not duplicate submission. Optional missing evidence and quota/upload failures remain explicit; required failures block availability. An authorized pending receipt can be abandoned/expire by policy with audited cleanup of unreferenced bytes; finalized evidence is retained. Supplemental receipt reserves independently and references a finalized original.

Manual fallback uses the same phases under human report.import.manual authority. Record actual human submittedBy and separately asserted reportedRuntime/source; do not fake assignmentId/generation or agent authenticity. Provide one explicit manual-context path rather than bypassing checks with invented leases. A manual primary receipt may move DRAFT/READY/ASSIGNED to REPORTED only with report.import.manual, dispatch/manual-adoption policy, expected task-version CAS and no active executor lease; unclaimed assignment is explicitly closed as manually fulfilled. With an active executor, import is evidence-only and does not alter/cancel its lifecycle. Historical supplement requires report.supplement or human import scoped to finalized original/current grants, not an invented active fence; it authorizes no new target actions. No phase creates a case/run/accepted result/bug.

### 4.4 Analyst creates proposal operations

```json
{
  "title": "Events QA: cases and candidate GitLab issue",
  "sourceTaskId": "<uuid>",
  "sourceReportIds": ["<uuid>"],
  "qaFormatProfileRef": { "id": "<profile-id>", "version": 1 },
  "destinationSuiteRef": { "id": "<existing-suite-id>", "baseToken": "<reviewed-structure-token>" },
  "operations": [
    {
      "operationKey": "new-case-1",
      "kind": "CASE_CREATE",
      "baseCaseRevision": null,
      "proposed": {
        "testCaseId": null,
        "requirementId": "<requirement reference>",
        "title": "Create Event with valid required fields",
        "prerequisite": "An authorized Application Administrator account exists.",
        "steps": [
          { "stepNumber": 1, "action": "Sign in.", "expectedResult": null },
          { "stepNumber": 2, "action": "Navigate to Events and complete the required fields from Test Data, then submit.", "expectedResult": null }
        ],
        "testData": { "eventType": "Storm" },
        "caseExpectedResults": ["A new Event is created.", "The saved Event appears in the list."]
      },
      "sourceEvidenceRefs": ["<report-id>"],
      "certainty": "PROPOSED"
    },
    {
      "operationKey": "issue-1",
      "kind": "ISSUE_DRAFT_CREATE",
      "proposed": { "markdown": "# Events: incorrect validation response\n\n## Description\n..." },
      "sourceEvidenceRefs": ["<artifact-id>"]
    }
  ]
}
```

Server validates each payload using the approved QA-format profile and adapts it to existing native/custom fields. The illustrative `proposed` shape is not a claim about current Tesbo DTOs. Return server-issued stable operation IDs and immutable revision/content tokens; never approve by mutable array index or trust a caller-supplied hash/identity as authoritative. Store analysis and typed issue/result operations in the shared staging workflow.

**Important distinction:** issue approval-for-copy creates neither a GitLab issue nor a live Tesbo bug/link. Those routines may affect linked execution status. Case creation, result acceptance and issue-copy approval have independent typed decisions; a generic save cannot publish all three implicitly.

### 4.5 Human review decision and merge (UI-backed)

```json
{
  "proposalRevisionId": "<uuid>",
  "proposalRevisionHash": "<sha256>",
  "decisions": [
    { "operationId": "<stable-server-operation-id-1>", "decision": "APPROVE", "operationHash": "<sha256>" },
    { "operationId": "<stable-server-operation-id-2>", "decision": "REQUEST_CHANGES", "operationHash": "<sha256>" }
  ],
  "comment": "Rewrite the issue expected result; first case is approved."
}
```

Merge names only selected approved uncommitted operation IDs, exact revision/content tokens and idempotency key. For case/hierarchy publication accept only reviewed CASE_* and necessary approved SUITE_* operation kinds in dependency-closed selection; separately governed result acceptance requires its explicit operation/policy. Issue-copy decisions are never live bug/case/result publication. Derive reviewer ID from authenticated human session, not request body or token issuer.

Response includes durable apply receipt, selected logical operation/operation revision IDs, resulting existing suite/case/execution IDs and tokens, plus excluded/pending/terminal dispositions. Already committed logical operations are ineligible across later revisions and fresh request keys. Return PARTIALLY_MERGED while actionable work remains and COMPLETED for fully decided mixed applied/rejected/copy-only requests. Same key/same payload returns the recorded receipt; changed payload conflicts. Any base, destination, custom-field/profile or approved payload change requires renewed review. Do not silently create/move to another suite.

## 5. MCP handshake / supported current behavior

The audited source and displayed setup describe a project-scoped JSON-RPC endpoint. A supported client should send `initialize`, `tools/list`, and `tools/call` with Bearer credential; MCP discovery returns tool schemas. The source supports HTTP JSON-RPC responses, not a demonstrated push channel for launching local agents. This session did not run a handshake. Source/setup information is not authorization or client-compatibility proof. A `tools/list` result does not authorize execution of a tool; recheck at every call.

Illustrative `tools/call` request:

```json
{
  "jsonrpc": "2.0", "id": "call-1", "method": "tools/call",
  "params": { "name": "list_assigned_tasks", "arguments": { "status": "ASSIGNED" } }
}
```

**Execution agent setup principle:** Configure OpenCode with two separate MCP integrations: existing Chrome MCP for browser testing and Tesbo MCP for task/report exchange. The Tesbo credential belongs only to the agent instance; the Chrome MCP/browser remains local. The exact OpenCode config syntax depends on installed version; validate against the local client rather than inventing a JSON schema.

## 5.1 Evidence transfer and report finalization

Use existing storage/upload mechanisms with a report/attempt-owned pending receipt. Authorize project/parent ownership before reserving/uploading bytes. Primary executor receipts require the current assignment/fence; manual and historical supplements require their explicit current scoped grants as in §4.3. Uploaded artifacts remain pending until size/type/checksum and actual content completion are validated; an S3 exists stub is insufficient. Finalize the immutable report only after referenced evidence meets its contract. Supplements append to the original receipt; they cannot replace it.

Check ownership on reserve, attach, finalize, read, signed download and deletion, including foreign attachment IDs. Revoked/expired/reassigned clients cannot finalize as the current attempt. Failed upload/finalization cannot mark a report available or modify official cases/results. Reuse quota/retention/audit handling and never include browser/session secrets in exported evidence.

## 6. Error contract and request safety

| Condition | REST response suggestion | MCP error semantics | Required side effect |
|---|---|---|---|
| Missing authentication | `401` | Denied/unauthorized | No data mutation |
| Capability missing/revoked | `403` | Permission denied, stable code | Log safe denial; no mutation |
| Task belongs to another project | `404` or `403` without leakage | Project scope denied | No cross-project read |
| Task not assigned to caller | `403` | Assignment denied | No prompt disclosed |
| Active claim already held | `409` | Lease conflict | No duplicate claim |
| Expired assignment | `409` or `410` | Lease expired | No primary current-attempt operation accepted unless explicit recovery; scoped manual/historical receipts follow §4.3 |
| Duplicate idempotency key, same payload | `200` / previous result | Repeat result | No duplicate row |
| Duplicate idempotency key, different payload | `409` | Idempotency conflict | No overwrite |
| Missing required evidence / invalid MIME | `400` / `413` / `415` | Validation error | Reject invalid file; no partial report confirmation |
| Approval revision stale | `409` | Approval revision mismatch | No case write |
| Published case base stale | `409` | Merge conflict | No partial selected-ops merge |
| Unapproved direct case write | `403` | Protected suite violation | No case write |

Authorization checks are per-resource, not string matching on route names alone. Logging must exclude raw bearer tokens, OTPs, cookies, secret browser context and stored encrypted keys.

## 7. End-to-end credential and connection setup plan

**Connector spike A (OpenCode):** create a Tesbo *project-scoped least-privilege test credential* after authorization code is implemented; register named OpenCode agent instance; configure that client with Tesbo MCP URL and bearer auth; validate `initialize`, `tools/list`, assigned task, claim and report. Do not use a broad `read,write` token for production execution-only claims.

**Connector spike B (ChatGPT):** determine current workspace eligibility for custom MCP write actions and supported authorization types. If OAuth is required, implement auditable OAuth client/user mapping or a secure gateway that delegates to Tesbo principals; complete authorization in settings, never in chat text. Verify actual tool availability and mutation with a disposable project/task. If the actual client path is unavailable, retain manual UI/import continuation and mark the connection incomplete. Do not assert a plan restriction or OAuth requirement without verifying it for the available client. Outbound Jira/Linear/Notion OAuth code is not an inbound MCP authorization server.

**Browser validation:** for the initial pilot, verify the user-managed executor itself can access the authorized target and its chosen browser MCP, with any existing site/VPN setup owned by the user/executor; no Tesbo VPN implementation is a prerequisite. Other target types and projects have their own validated target adapters; Chrome and VPN are not protocol prerequisites. OpenCode executes the supplied task naturally; Tesbo cannot authenticate to DMIS or control Chrome simply because its MCP service is running.

## 8. Threat model checks

- Cross-project references and direct UUID guesses blocked, including nested attachments/executions.
- User-issued broad legacy token must not grant permission to publish by slipping through `legacy.controller` or bulk endpoints.
- A compromised agent is limited to its own task context, cannot enumerate other agents' tasks, cannot mint a stronger token, and can be revoked promptly.
- All credentials rotated without losing report audit lineage.
- Review actions are bound to human principal and proposal hash, preventing replay/self-approval.
- Prompt injection in OpenCode-generated report is **untrusted data**; neither ChatGPT nor backend treats report text as an instruction to invoke tools or bypass review.
- Malicious attachment types, path traversal, misleading MIME and oversized evidence are rejected.
- Browser-authenticated users and token clients cannot gain extra privileges through mixed headers/cookies.
- Read-only project lock and subscription protections are preserved across new task/report/proposal writes per documented product policy.

## 9. Contract validation and compatibility gates

Every proposed input requires enforced runtime validation, bounds and unknown-field rules; advertised JSON Schema alone does not validate dispatch. Test both MCP URL forms, old tool names invoked directly even if hidden from discovery, entity-addressed REST, cookie/bearer combinations and project locks. Equivalent operations must reach the same policy boundary.

Existing create/update/archive/import/bulk/suite/custom-value/tag/Zyra/duplicate-review and bug/result writers must enforce protected policy before mutation. Preserve public responses or version/deprecate adapters explicitly. Do not silently expand old broad-token authority. Only an authenticated human path can decide/merge under default protected-project policy, while an authorized agent can read review comments and propose revisions.

Claim/heartbeat/primary-report requests bind to the server-resolved current assignment, immutable prompt and attempt version. Ownership is never inferred solely from IDs supplied in a payload. Concurrency tests cover double claim, reassignment, idempotent replay, conflicting replay and approval/base changes during apply. Persistent review history survives chat/issuer removal according to explicit retention rules.

## 10. Team-reviewed scoping, read and lifecycle contracts

### 10.1 Discovery, pagination and exact navigation

Proposal/report lists are source-neutral adapters over generalized staging/report receipts, not the current generation board (which excludes chat batches and caps 50). Inputs include bounded page size/cursor, state, source kind, task, author and assignee filters. Use deterministic timestamp plus stable ID ordering; authorization filters apply before list/count/page formation. Responses provide stable record/revision URLs and next cursor. Old pending work and a headless proposal without a task-board card remain discoverable by an authorized replacement analyst.

Case version reads use existing testcase_versions plus current definition/provenance projection. Read scope binds project/case/version; exact version URL must reopen the existing repository drawer. Store is reused; read adapter/UI is new work. Report artifact read returns actual client-supported image/resource/content as well as MIME/length/hash/ID, not just a count or a cookie-only URL. Adapt current MCP JSON-text wrapper for typed content and test both actual clients; if inspection cannot occur label evidence NOT_VERIFIED.

### 10.2 Grant, settings and profile semantics

Apply credential ceiling intersected with current profile/instance allows and project/task restrictions; explicit deny wins, unknown/absent grant denies. Exact-resource scope is default; descendants only by explicit grant and reevaluated after moves. context.profile.read permits referenced approved context only. Scope report/proposal reads and queues consistently; no project-wide case grant is required solely to read a task's format.

Resolve machine workspace from bound project, not human active-workspace setting. Issuer/instance-owner removal or required-delegation loss suspends affected credentials/attempts next request until audited transfer/reissue; history survives. Later issuer promotion does not grow token ceiling.

Protected policy/format updates require explicit administration and expectedPolicyVersion/profile version CAS with server-derived next version and audit. Generic settings writes preserve/reject changes to reserved namespaces. Profiles have immutable draft/active/retired versions, validated activation impact, assignments/overrides and last-authorized-human safeguards. Activation/reissue is not an agent privilege escalation path.

### 10.3 Clarification, resume and client stop behavior

Question/answer messages bind task/prompt/author and prior resumable state. Waiting for clarification releases/pauses active authority rather than renewing indefinitely. Answer alone never resumes; explicit resume claims a new current generation. Material target/action/scope changes require a new prompt revision/assignment. Old heartbeat/progress/primary-finalize/release after replacement fails without affecting new work.

Cooperating clients check task/lease validity before material target actions and during long tasks; cancel/revoke/lost authority/sustained connection loss stops new actions and preserves evidence for explicit recovery. Server cannot undo an in-flight action or kill an unreachable local Chrome MCP runtime. Task state, server authority and actual external activity must not be conflated.

### 10.4 Suite/field operations and immutable target resolution

The shared proposal payload supports SUITE_CREATE and necessary suite placement/rename/reparent operations alongside CASE_*, governed result and issue kinds. Use server-issued logical operation IDs; temporary client keys only resolve to stable IDs before review. New-parent/destination references use parentOperationRef/destinationOperationRef and explicit dependsOn. Existing destination is exact UUID plus hierarchy/base token. Reject cycles, missing/foreign/unapproved dependencies and ambiguous same-target writes. No implicit dependency approval or name-only suite matching.

Persist resolved operation kind, existing target UUID or stable logical new-target reference, base and complete postimage before submitting for review. Current save-time positional ticket matching must not convert a reviewed create to update in either save branch. Review changes to matching as a new revision. Canonical field adapter carries all native/custom/provider/tag fields with absent/clear/set rules; global caseExpectedResults is independent of native step expectedResult. Legacy action/expected arrays or delimiter encodings require explicit lossless mapping, never inferred correspondence.

Logical operation commitment is durable across revisions; copying applied A into revision 2 cannot republish it with a fresh idempotency key. Later correction is a new compensating operation. Protect legacy receipt/state tracking (including aiSave) from fabricating trusted publication events. Only the actual selected shared transaction can issue authoritative receipt/counts.

## 11. Protocol compatibility and evidence-sharing boundaries

Preserve current negotiated versions (source supports 2025-06-18 and 2024-11-05 fallback), fingerprinted sessions and stale-session 404 recovery through reinitialize/rediscovery, notification 202 and unsupported GET/DELETE responses. Session ID is not authentication. Extend existing e2e/api/mcp.spec.ts; schema rediscovery cannot replay completed writes. Update current MCP_SERVER_INSTRUCTIONS direct bug/result guidance for protected tasks/reports/proposals.

New unpublished evidence uses reauthorizing authenticated access by default. Do not inherit existing public cycle/one-hour trace sharing or S3 bearer redirect as a claim of immediate revocation. Any exception requires approved bounded lifetime and explicit residual-access semantics, or a revocable server-side grant. Public accepted-run compatibility cannot expose unapproved reports/proposals. Revoke-after-mint/reassign/parent archive/delete/foreign artifact reads must be tested.

History-import and refreshSnapshots are protected existing result/snapshot mutation paths. Accepted tested snapshots/history cannot be replaced in place from latest cases; use reviewed compensating correction preserving the exact dispatched/tested definition. Manual receipt is a real human path through the same services, not an impersonated machine request.

Closure detail: dependency-closed apply can use exact previously committed logical-parent receipt/mapping plus a still-valid reviewed hierarchy instead of selecting/reapplying that parent. Uncommitted dependencies require explicit approved inclusion. Reject deleted/changed dependency targets for re-review. New targets use stable logical references until UUID allocation at publication. The all-publishing terminal state is MERGED; mixed/rejected/copy-only fully decided requests use the Workflow §4.3 terminal rule, never remain pending only because a rejected item produced no record.

## 12. Full-assurance MCP/REST contract refinements — revision 1.3

All following operations/fields are **PROPOSED**, not evidence of deployed Tesbo tools. Reuse the existing project-scoped JSON-RPC `tools/list`/`tools/call`, session negotiation and NestJS shared-service authorization; schema discovery is not the security boundary.

| Domain adapter (proposed operation, final name assigned inside existing registry) | Required input / response commitments | Failure and security rule |
|---|---|---|
| `external_task.get` / `external_task.claim` | Return immutable prompt/context ID, permitted structured target/action policy, linked source document **version IDs**, principal/lease/fence, and request-scope IDs. | Claim must be assigned and currently authorized. Structured restrictions supersede prose; inconsistent scope must CLARIFY rather than execute. |
| `external_task.submit_observation` / report primary | Attempt/fence, actual observed origin/build/role/tenant or `UNKNOWN`/`NOT_REACHED`, observed timestamps, requested-check dispositions `TESTED`/`BLOCKED`/`NOT_TESTED`, source/evidence refs. | Unknown context may not be represented as verified; foreign scope, expired attempt and prohibited action denied. |
| `report.reserve` / `artifact.attach` / `report.finalize` | Stable receipt ID before upload; bytes/length/digest/type, integrity and quarantine/derivative states; idempotent primary vs supplement identity. | At most one primary per attempt independent of request key. Different-key race = explicit `PRIMARY_REPORT_CONFLICT`; finalize/cleanup races never corrupt admitted original. |
| `report.read_content` / `artifact.read_content` | Authenticated complete ordered chunks, digest/byte count/part count and media-safe actual content where supported. | Metadata-only and expired signed URL are not evidence consumption. No public trace/cycle sharing by default; authorize every read. |
| `knowledge.read_version` / task context read | Exact document ID **and version**, immutable content or referenced dispatched snapshot, digest/chunk counts and completeness flags. | Do not silently return latest KB body or invoke mutating restore if historical bytes unavailable; return typed `VERSION_UNAVAILABLE`. |
| `proposal.stage` / `proposal.review` / `proposal.apply_selected` | Exact stable operations, original source references, actual/tested snapshot, decision/base/profile revisions, explicit selected set and receipt. | Human approval validated in shared domain transaction; `RESULT_ACCEPT` requires an exact approved-definition execution (or separately approved alternative contract), no post-hoc inference. |

**External execution scope:** API stores **permitted actions** (readonly navigation vs submitted forms, downloads and writes) and explicit host/origin/redirect/IdP/tab/egress allowlists. Policy denies override prompt, document text and hostile site/report instructions. Do not implement arbitrary browser control in Tesbo; only a cooperating external runtime can enforce physical actions and must report enforcement gaps. Task permission grants and independent agent credentials remain separate from human reviewer authority.

**Evidence ingress/egress:** Before sensitive capture, define legal/privacy basis, evidence-size/retention, detection/quarantine/scanning where available, credential/PII redaction, raw-original restriction, hashed separately labelled derivative and allowed analysis/telemetry/export access. Capture an exact admitted original or preserve sensitive source in restricted quarantine with an independently hashable redacted view; changing finalized source bytes is forbidden. If external clients cannot inspect image bytes, mark evidence `UNVERIFIED`, not `INSPECTED`.

**Acceptance/oracles:** Test hostile-site and malicious-report prompt injection separately; concurrent different-key primary receipts, finalize/cleanup and old-upload races, in-flight authorization changes, mixed old/new migrated records and restored/current reference mistakes. Test actual client re-init/rediscovery and fresh-session reconstruction with complete reports and source versions. Keep typed errors scoped and nonrevealing (`SCOPE_CONFLICT`, `PRIMARY_REPORT_CONFLICT`, `VERSION_UNAVAILABLE`, `EVIDENCE_QUARANTINED`, `CONTENT_INCOMPLETE`, `RESULT_SNAPSHOT_REQUIRED` are proposed names; not asserted to exist). Endpoints remain gated on Phase 1 authorization and F02/F03 proofs.

### 12.1 Revision 1.3.1 contract-proof details


**Revision 1.3.2 NFR compatibility and evidence gate:** The existing JSON-RPC transport must support at least two independently named runtime instances with a **single unchanged business tool schema**, each independently credentialed and denied cross-task access; do not hardcode OpenCode as a security role (QA-123). Report RESERVE/upload/FINALIZE denies unavailable, unscanned, unsafe or tampered artifacts, makes quarantine status explicit to authorized actors, and never leaks original bytes in tool error messages (QA-124). Exact provenance links resolve official case/version → applied operation/decision → analysis/report/attempt/task/context/evidence subject to authorization (QA-125). Preserve structured error categories and safe correlation IDs for queue/lease/failed auth/finalize/merge metrics (QA-126); no secret-bearing tokens/prompt/HAR data in telemetry. Retention/deletion and access-after-expiry obey project policy and applicable hold decisions without forging a fresh receipt (QA-128). Unknown/unsupported operation or state version fails closed with a typed incompatibility error rather than coercion into success (QA-129).

A `tools/list` schema or broad `read`/`write` token is never a grant for `review`/`approve`/`merge`; each of the ten capability families is checked at the authoritative domain boundary. Standardize actor/project/entity/source/correlation response and audit context on both MCP URL paths and legacy REST, without granting public audit enumeration (QA-116/121). A finalized receipt has immutable content address/digest: repeat requests with different body/digest are typed conflicts, while any supplement has a new ID and remains linked (QA-118). A missing/blocked/uncertain observation stays nonofficial and cannot trigger case mutation (QA-119). Proposed task creation must apply an ingress guard to credentials embedded in literal prompt/context text before saving, tracing or execution (QA-122). Exact existing token/error contracts and compatibility remain to be determined from source and client runs.

## Revision 1.3.3 — implementation-policy decisions and canonical-source discipline

**Contract policy defaults (README PD-01–PD-08):** Keep token `read`/`write` solely as a legacy transport ceiling, **not** approval/merge/case-operation authority. Authenticated `instanceId`, bound project, task/attempt lease, current instance grants and explicit current human reviewer/merger must be enforced by the same domain service regardless of MCP/REST adapter. `tools/list` visibility cannot grant a protected operation. No fallback to issuer `userId` as approval.

External task accepts versioned structured scope containing exact HTTPS origins, normalized path/method/action policy, permitted/forbidden target interactions, optional explicitly approved IdP/redirect/download/egress exceptions. No client-supplied `allowAll` or prompt prose overrides denial. The `MANUAL` dispatch kind is the enabled baseline; `POLL` is disabled by default and never implies a push channel to an offline runtime. No credentials or browser session tokens appear in task JSON.

Evidence lifecycle applies synthetic pilot quotas **25 MiB/file, 250 MiB/receipt, 2 GiB/project**, atomic accounting and typed `quota_exceeded`/`evidence_quarantined`/`governance_unconfigured` conditions. Pending artifact reservations age out after 24h; unreferenced synthetic pilot objects after 7d; referenced evidence must remain on approved provenance hold until policy-compliant release. Sensitive real-project evidence requires project-specific a signed classification/retention/residency/redaction/export policy and acceptable scanning result before upload/finalize. An authorized reader consumes safe image/file bytes via scoped reauthorization; unsigned artifact URLs cannot become permanent privileges. Audit handles decisions without leaking raw content.

Read-only projects permit authorized historical reads and evidence export only under current scoped policy; mutation/merge requests fail before changes. Remote client compatibility is an executable handshake requirement: call initialize, tools/list and scoped tools/call on the proven ChatGPT and OpenCode transports, fetch multipart/long report and actual screenshot bytes, and verify incorrect token/expired lease/foreign project fail closed. A missing supported client flow remains `BLOCKED`, not a documentation failure or fabricated compatibility claim.

## 13. Project session and CLI/Copilot contracts (PROPOSED; revision 1.4.0)

**Strict ownership:** One Tesbo web Copilot UI selects among authorized project-scoped sessions. Each Tesbo `sessionId` is a durable project resource, not a Copilot instance, MCP transport session or provider `threadId`. APIs below are proposed, not existing; reuse the current NestJS/MCP/RBAC services. The web frontend has **no local CLI process-control endpoint** and cannot invoke an arbitrary backend shell.

| Proposed operation | Minimum inputs and outputs | Enforcement |
|---|---|---|
| `list_qa_sessions` / `get_qa_session` | Project, cursor, session ID; ordered event timeline, participant bindings, task/report/review references | Project membership, session visibility, immutable paging, authorized redaction |
| `create_qa_session` / `post_session_message` | Project, title, human actor, message, idempotency; stable session/event IDs and sequence | Authenticated principal; model-generated text is never automatically an approved decision |
| `get_session_context` | Session ID, optional version watermark; goal, decision ledger, exact authorized KB/version and case/report links, open tasks, ambiguous/untested paths and completeness marker | Reauthorize every referenced source; no hidden provider transcript claim |
| `list_execution_connectors` / `get_connector_capabilities` | Authorized execution agent instances by mode `USER_MANAGED`, `REMOTE_GATEWAY`, `TESBO_MANAGED_OPTIONAL`, plus separately configured Copilot analysis backends; identity/runtime/transport/tool capabilities, freshness, permissions, supported models only where relevant | Project/session/task authorization; an external registered agent may be offline; no PATH discovery or assumption that a vendor offers MCP client support |
| `register_execution_agent_instance` / `get_execution_agent_health` | Register named user-managed MCP client, authorized remote/gateway or optional managed worker; credentials, instance ID, last contact and independently verified capabilities; hosted instance lifecycle only when enabled | Bound project/task and machine identity; revocation; no endpoint to install/start a user process from the web UI; no impersonated live health |
| `start_session_turn` / `stream_turn_events` / `reconcile_turn` / `cancel_session_turn` | Stable session/turn/binding/attempt IDs, context watermark, bounded scopes, native thread binding, event cursor and confirmed/unknown state | Single event ordering, replay/idempotency, bounded tool approvals; disallow unauthorized shell |
| `create_linked_retest_task` / `submit_report` | Parent finding/report, immutable prompt revision, target policy, executor binding and independent receipt | Existing task claim/fencing, scope consent, original source integrity |
| `propose_session_changes` / existing review/apply | Source-linked case/result/native Bug operations with exact revision and human decision IDs | Shared Zyra-derived stage/review/apply; human-only approval and protected official repositories |

Keep the browser-facing REST/SSE or WebSocket event stream distinct from **Tesbo MCP task/report reads originating at user-managed agent machines** and optional hosted-agent worker/gateway transports. Browser MCP/Playwright MCP are tools belonging to the authorized executor, not the web Copilot or the agent-client protocol. ACP may be negotiated where a hosted adapter supports it, never assumed or confused with MCP. Enforce typed project/session/agent/turn/task provenance, idempotency and backend authorization on every transport; `session:write` cannot authorize direct publication of cases or Bugs through legacy APIs.

**Interface failure decisions:** unavailable hosted API/worker, invalid provider credentials, unsupported agent protocol/model, insufficient runtime capacity, stale gateway status, tool approval pending, server worker crash after request acceptance, stream gap, duplicate turn, expired source version and wrong-project context need distinct actionable responses. `UNKNOWN` completion never triggers unsafe blind resubmission. An externally connected MCP agent may be offline; Tesbo MCP registration alone does not start that external agent. Initially the user can open their existing OpenCode/Hermes session, use Tesbo MCP tools to claim/run a task, then return the report; no target-site VPN or CLI installation is managed by Tesbo. For an OpenClaw gateway, verify or develop a scoped plugin/poller adapter rather than promising native tool support. Original report bytes require authorized re-read, not stale embedded download URLs.

## 14. External AI full-workflow MCP, project toggles and summary contracts — revision 1.4.4 (PROPOSED)

**Two clients, same domain methods:** (A) an external ChatGPT/Claude app uses an authenticated Tesbo MCP connection to perform **the complete permitted** project/session/knowledge/task/report/retest/proposal workflow; it does not route via Copilot chat. (B) the Tesbo web Copilot uses the corresponding shared NestJS domain services through application API, selecting a verified API model or technically compatible server-side/remote conversational agent. A native Copilot backend is distinct from the independently assigned execution agent, which may be user-managed. No second MCP server or application is required.

**New proposed tool contract additions** (add to the *same* project MCP registry, not separately deployed tools):

| Semantic operation | Capability | Return / authorization behavior |
|---|---|---|
| `list_accessible_projects` | `project.external.discover` | Only opted-in projects explicitly granted to this authenticated human/client; disabled project existence not leaked. Existing project-token MCP endpoint continues to operate for a **single** project after consent; multi-project discovery requires deliberately issued account+client OAuth/grant binding or equivalent supported flow, not an accidental broad project token. |
| `list_project_sessions`, `create_qa_session`, `get_qa_session` | `session.read`, `session.create` | Paginated owned/member-authorized sessions of that enabled project; only permitted metadata; active backend/provider thread IDs are not authoritative records. |
| `get_session_context`, `list_session_events` | `session.context.read` | Ordered paginated source-linked events, KB/version citations, task/attempt/report IDs, summaries and unanswered questions; authorize each linked artifact separately at retrieval. |
| `get_project_knowledge_version`, `list_project_requirements` | `knowledge.version.read`, `requirements.read` | Exact permitted canonical identity/version and citations from existing KB + Requirements; explicit unavailable/revoked states, no silently substituted latest. |
| `save_session_summary`, `list_session_summaries`, `get_session_summary` | `summary.submit.external`, `summary.read` | Submit an explicitly requested external client summary with source app, client/actor, claimed coverage window, completeness/gaps, cited Tesbo record IDs and revision; prior revision never overwritten. No privileged commands embedded in summary. |
| `submit_execution_summary` | `summary.submit.assigned` | Only active/authorized assigned executor; verified task/prompt revision/attempt/report reference and bounded observed-tool-action citations; does **not** finalize a raw report, result or defect. |
| `get_project_external_access` (REST UI/admin only) | `external_access.manage` | Returns project enable state, policy locks, connected-client grants; no MCP bypass or model-issued elevation; consent/disable/revoke writes through authenticated Tesbo Project Settings only. |

**External project consent lifecycle:** Project Settings defaults MCP access OFF for every project. Authorized human enables project with explicit settings action, registers/authorizes an identified client, chooses project/session/conversation-thread and operation/data classes, and issues revocable short-lived credentials/supported OAuth consent. Account-scoped discovery has no implied all-project access. Legacy broad `read,write` tokens are not automatically upgraded. Inbound MCP calls check policy version at operation time; turning OFF blocks *all* external project/session/Kb/task/evidence reads and writes, including direct ID calls, regardless of stale discovery, model cached tools, remote session or already claimed tasks. Executor-grant exceptions are **not** implicit: if policy needs agents to keep operating after analyst MCP OFF, design a separately named non-MCP service policy rather than silently bypassing the OFF switch. Native human project UI still works normally.

**Illustrative summary submission** (not a claim of full external transcript access):

```json
{
  "projectId": "project-A",
  "sessionId": "session-024",
  "sourceKind": "external_chat",
  "sourceClient": "chatgpt",
  "sourceScope": {"coverageDescription":"User-requested summary of this visible chat", "completeProviderTranscript":false, "knownGaps":["Private messages outside Tesbo MCP are not independently observed by Tesbo"]},
  "summary":"Checkout regression planning, observations and two unresolved cases",
  "sourceRefs":[{"kind":"task","id":"task-17"},{"kind":"report","id":"report-31"}],
  "idempotencyKey":"summary-scope-unique-client-id"
}
```

**Summary provenance:** Server validates real UUIDs and authorized source references; sample IDs are placeholders. A client may submit a summary with no Tesbo references only as a clearly labelled *unverified external narrative*, not as verified results. Retain append-only revision/history and visible corrections; do not copy summary body into official KB as an original. Executor summaries require actual registered task/attempt and referenced immutable report; if report is pending or missing mark summary `unverified` and never fake PASS. Event pagination, oversized data, source expiry and tool errors are structured and revocation-safe.

**Acceptance:** AC-025–AC-028 and QA-159–QA-176. Access `tools/list` filtering is convenience only; every `tools/call`, REST operation, media URL and download reenforces the same policy. Project disable and consent revocation must fail closed even if model/client's tool list was cached earlier.

**Thread-granular tools:** `list_session_threads` and `register_session_thread` (with capability `session.thread.read` / `session.thread.register`) expose only authorized in-Tesbo metadata and source summaries. `save_session_summary` accepts optional `threadId` bound to its session, and an external client-declared source window. Provider thread IDs are optional opaque references and never credentials. Disabling external access or revoking a thread grant denies subsequent summary, context and evidence reads; absence of a registered thread does not grant the whole session.


## 15. Assurance-required compatibility and denial probes — revision 1.4.5

The source presently exposes project-scoped `/api/projects/:projectId/mcp` and `/api/mcp` POST handlers, a static `tools/list`, a broad `read/write` token model and legacy direct case/bug/execution writers. Neither `list_accessible_projects` nor operation-/thread-scoped client authorization is currently operational. New multi-project discovery must establish an identified user + client grant independently of a single-project token; an existing token's project is not an account-wide grant. `tools/list`, individual `tools/call`, REST compatibility routes, issue metadata and evidence URLs all require same effective policy; filtered discovery alone is no security boundary.

**Fail-closed scope regression:** absent/unknown/empty requested scopes must NOT issue a default `read,write` token; token creation and old-token migration need concrete negative and rollback tests. Present static MCP responses require a real ChatGPT/Claude compatibility test against response codes, structured content, transport/session reinitialization, long paginated context and actual image bytes; client advertisements are not executed acceptance. Shared `tesbo-mcp` actor attribution is insufficient to distinguish instance/client/human delegation and must be extended consistently through current BUG/KB write adapters before high-trust agent access.

**Critical revocation race:** set policy before operation admission; if project is disabled while report upload/finalization or selected apply is running, enforce documented linearization/abort-or-commit semantics, quarantine/reconcile incomplete uploads and prevent an expired actor from completing new protected side effects. Clarify whether an already-authorized in-flight external browser action is out of Tesbo's physical control.

## 16. Revision 1.4.6 — alternate-channel and cross-project conformance gates

The current `/api/mcp` token-bound alias and `/api/projects/:projectId/mcp` must converge on the **same active permission decision** for every list/read/write call. An external client's cached `tools/list` grants no capability; explicit `tools/call`, guessed entity ID, direct REST and retained evidence URL require current access checks. Validate client-specific supported authentication and write-tool behavior rather than assuming all ChatGPT/Claude plans or runtimes expose identical features. Distinguish project discovery authority from per-project machine task and evidence authority.

**Imported external-source identities** are `(project, provider, connector/source namespace, external ID)` unless a separately authorized global source owner and reference scheme is expressly selected. `list/search/get` must return only authorized results; same external ID in another project is not evidence of access, and collisions must never suppress local import or leak foreign existence. Exact task-time source revision must remain retrievable or explicitly `UNKNOWN`, never silently substituted.

**Cross-channel conformance contract:** for each official source mutation, compare native authenticated REST/UI, existing bulk/import/sync and all MCP clients and legacy write paths; verify the same human-review/policy guard, durable operation ID, correct audit attribution, idempotency and event publication. Notifications/webhooks and report/share/export are downstream consumers, not an independent source of acceptance. Reject/retry duplicates and stale operations safely; test revoked grants before and during evidence read/finalize and delayed async event handling. Per-client real-runtime compatibility is a separate acceptance result, never inferred from a protocol JSON schema.

## Revision 1.4.7 — reconciled technical change

Baseline: the same eight rev-1.4.6 files and pinned fork were reviewed in the completed Work second-pass (G0/G1 only). Read `00_README.md` for version/evidence and the standalone reconciliation audit for all IA-001–IA-040 dispositions. The content below records only this document’s assigned responsibilities; no live acceptance or source change is claimed.

### Reconciled transport/authentication and task lineage acceptance (proposed, not deployed)

1. **Effective credential, project and child-owner guard:** resolve resource project from stored parent and each referenced child; require current member/client/agent/credential grant and semantic operation-specific entitlement on `/api/mcp`, `/api/projects/:id/mcp`, matching REST and background service handlers. A `read` machine token cannot create, export beyond project, issue another token, or mutate via a REST alias. `tools/list` is advisory; tools/call and source-byte retrieval must reauthorize. Unknown/empty scope issuance is invalid.
2. **Mutation command identity:** every new task-create, task-cancel, report reserve/finalize, selected human apply and analogous non-idempotent protected command SHALL accept or server-generate a stable command identity before dispatch; retries with the same authorized command resolve one receipt. Existing frontend generic `fetch` retry MUST NOT automatically resend unsafe POST/PATCH/DELETE after unknown completion. Distinguish `UNKNOWN_COMMIT` and recovery from a second action.
3. **No original report before cancellation:** cancel/expire creates a terminal task/attempt disposition and empty-primary evidence status, not a fabricated original report. Later late evidence is quarantined or admitted only through an authorized new recovery receipt; old assignment/lease generation never regains commit authority. Define the ordering oracle for cancel vs finalize; both may race but one terminal record is authoritative.
4. **Summary after finalized attempt:** executor summary is not an extension of the original execution lease. Its permitted post-finalization lifetime, source/evidence grant, and allowed revision operations are explicit; reauthorization applies to both derived bytes and cited original URLs. A revoked original can never be laundered through a derivative summary.
5. **Requested-check lineage:** assign stable check IDs and explicit added/retired/split/merged relationships when prompt revisions, repeated agent attempts and user corrections change check names. Every requested check receives a disposition; report finding identities remain source-linked, not title-only.
6. **Bug/result side effects:** link-to-Bug is not itself a newly verified execution. Under the revision 1.4.8 BUG-EFFECT-01 policy, classify direct and side findings per occurrence and separate a proposed human-approved status correction from immutable original run observation. On direct link/unlink, REST/MCP aliases and retries, enforce the same guarded policy without duplicating Test Case, Run or Bugs repository.
7. **Network/optional integration status:** current MCP POST-only / 201 response/stream limitations require actual client compatibility proof. Outbound analytics accepted-then-local-ack-lost is `UNKNOWN` until reconciled; a local notification retry must not invent a new official QA item.


## Revision 1.4.8 — QA guide and finding-classification contracts (PROPOSED; not existing routes)

All operations inherit the actual principal, project MCP enabled grant, session/task scope, permitted KB/read classification, source-bytes authorization and protected apply; MCP tool discovery is not authorization. The native Copilot uses the **same** domain operations. All accepted responses include correlation ID, canonical record ID and effective revision/etag.

| Tool / service action | Inputs (schema outline) | Typed return and guard |
|---|---|---|
| `get_effective_qa_guide` | `projectId`, `module`, `artifactType`, optional `taskId` / `atRevision` | `effectiveGuideId`, `publishedRevision`, `hash`, `applicablePolicy`, `authoringTemplate`, `templateVariables`, `gaps`, `sourceRefs`; data-read scope enforced; no secret/other-project guide leakage. |
| `list_qa_guide_versions` | `projectId`, `guideId` | Authorized revision list, content diff and published status; immutable historic versions. |
| `propose_qa_guide_revision` | project/module scope, change diff, base revision | Staged item only; cannot turn an AI-authored guide into binding policy or silently change human approvals. |
| `submit_finding_observation` | exact task/report/attempt, optional execution+step+condition, observed build, evidence manifest/hash and original data | Append-only observation ID and `UNDETERMINED` default; does not change Test Case/Run/Bug. Agent can submit observed fact but cannot approve an official Bug/Failed result. |
| `propose_finding_disposition` | `observationId`, relation `DIRECT`/`SIDE`/`UNDETERMINED`, expected-condition comparison, rationale, candidate existing coverage or new/revised case, duplicate/defect assessment, base guide and definition revisions | Versioned proposal with confidence and original evidence; status/case/bug writes require human-selected review. |
| `get_case_evolution_and_findings` | `caseId`, permitted cursor / version or time bounds | Versions with exact field/condition diff, executed-definition snapshot identity, direct/side occurrences, reviewed case/defect/retest lineage and proof completeness. |
| `propose_execution_result_correction` | existing finalized `executionId`, base result/version, violated specific condition, evidence, reason | Staged correction event; never silent Bug-link auto-fail or status rewrite. Apply may require different authorized reviewer than the agent. |

**Contract decision table:** `DIRECT + evidenced violated mandatory condition` → Failed **only for the corresponding actually executed attempt** (or reviewable correction if finalized); `SIDE` → discovery logged, no change to that attempt solely for the finding, seek existing coverage; `UNDETERMINED` → needs review, no synthetic outcome; `new case + no verified compatible execution` → created/proposed case with NOT RUN initial status, not Failed; `fixed Bug + no independent retest` → verification pending, never Passed. Distinct `discoveredDuring` and `directCauseOfFailure` links may reference the same Bug. Exact expected-condition IDs and guide revision are immutable operation inputs to reviewed apply.


## Revision 1.4.9 — executable step/condition results and relation/history reads

These are **proposed protected shared domain operations** (not claims about deployed Tesbo MCP tools); REST, native Copilot and external MCP are adapters over the same authorized service:

| Operation | Typed request | Response/guarantee |
|---|---|---|
| `record_step_execution_observation` | `taskId`, `attemptId`, immutable `testedDefinitionVersionId`, `stepId`, action state, condition ID(s), observed values/evidence, client operation ID and context-version | Accepted per-action and per-condition events; `performed` does not imply Passed; idempotent receipt and authorization |
| `propose_execution_result_correction` | immutable attempt, prior effective event ID/version, proposed status (either direction), condition evidence, reason, reviewer context | Version-bound **proposal**, no immediate status mutation |
| `get_execution_status_history` | attempt ID, pagination, permitted fields | Original and all accepted correction events, effective status, redaction/access scope and full audit provenance |
| `get_entity_field_history` | entity + field/step/condition identifier, as-of/version, page | Derived authorized old/new/version/reason/actor context from canonical snapshots and event audit; no arbitrary hidden field leak |
| `get_typed_qa_relationships` | entity ID + version/occurrence scope, kinds, direction, pagination, as-of | Directed, authorized typed links with target grain, exact version/attempt, provenance; unsupported/inferred relation cannot assert test failure |

**Idempotency/authority:** source events are immutable; retries of corrections/step operations preserve a single logical change with receipt, or return a deterministic conflict when an operation ID is reused for a different payload. Reject wrong-project child refs, different tested-version references, missing required evidence, old approvals and guide-policy bypass across every writer. Distinguish corrected current status from historical original in API and exports (`effectiveStatus`, `originalStatus`, `correctionEvents[]`); never encode historical correction merely by a UI suffix.

## Revision 1.4.10 — existing execution views must consume one canonical contract
Keep existing REST/MCP project-scoped Test Case creation/update, Run execution update, Bug create/link/unlink, evidence and version retrieval routes as the adapters. Add the proposed typed action/condition observation and effective-result correction fields **to the shared domain owner**, not an API exclusively designed for a new Copilot view. Existing Run drawer and existing full execute page must fetch/reconcile the same attempt ID, frozen definition version/hash, applicable condition IDs, action-performed/verified state, evidence IDs, Bug links classified by occurrence semantics, and correction receipt/history. Existing consumers lacking structured assertions must receive a safe legacy read projection; do not synthesize `Passed` from a step string or a Bug link. Do not change existing idempotency/permission semantics accidentally when extending old API methods. No extra browser/agent-only writer may skip reviewer selection, client permission ceilings or project consent.

## Revision 1.4.11 — Run presentation parity and side-finding reconciliation

The external MCP contract and native UI MUST resolve the same authoritative execution attempt, frozen complete definition, typed DIRECT/SIDE/UNDETERMINED finding links, per-action/per-condition observation events and effective result/correction timeline. Publishing a Bug link MUST NOT imply or send an execution `Passed→Failed` mutation (the only accepted correction path is the governed result writer). A native `LogBugDialog` success and an MCP `addBugLink` success both require authoritative read-after-write/reconciliation and project/attempt authorization; neither client may synthesize `Failed` from generic Bug association. Duplicate callback/delivery must not create a second occurrence or alter original results. Partial executed-step progress survives client switch and disconnect. These constraints reuse the existing receipt/idempotency and guarded-domain-writer policies; no additional duplicate MCP API platform is introduced.


## Revision 1.4.12 — UI visual proof is separate from protocol proof

No new MCP endpoint is created for this revision. Semantic parity across external clients and native frontend must be verified through authorized API data and source state; visual screenshots alone cannot prove protocol, authorization, idempotency or persistence. Conversely, code/API inspection alone is not proof of exact rendered UX/UI. Do not publish G0 reconstructions as G2 runtime observations.

## Revision 1.4.13 — attempt-aware protocol and truthful history compatibility

The existing `record_step_execution_observation`, `propose_execution_result_correction`, `get_execution_status_history` and typed relationship operations remain **proposed**. Their implementation and REST/native consumers MUST accept the stable logical attempt/event identity, authenticated original actor/runtime, expected revision, tested approved definition ID+hash, step and condition IDs, evidence IDs, operation idempotency key and scope-bound guide revision. Server responses include persisted attempt revision, operation receipt, effective result, missing/unverified coverage and retry/conflict resolution, never merely client-predicted success. Where a v1 legacy reader knows only `executions.id`, provide a labelled latest-result/legacy projection—not an invented `attemptId`.

Expose `historicalDefinitionProvenance` (original signed/verified | V119 migration-time reconstructed | source imported | unknown), `legacyImportedHistory` separately from reviewed `correctionEvents`, and appropriate `allAttempts` vs `effectiveCurrent` result scopes. Imported V140 positional step values and prior results are unverified for stable condition references unless an approved mapping exists; project-specific sensitive evidence remains access-filtered. Bug association must refer to exact finding occurrence/attempt and relationship type, rather than attaching causal semantics to the V117 case/run unique row. Evidence uploaded to an existing execution before explicit attempt attribution is displayed as `legacy execution-level evidence`, not automatically reclassified. All new operations have conditional-current-revision and idempotency conflict responses, including success-then-lost-ack recoverable receipts; reuse existing authorization/domain writers, not a parallel protocol service.

## Revision 1.4.14 — equivalent write eligibility, critical audit and occurrence-scoped Bug links

All proposed `submit_finding_observation`, `propose_finding_disposition`, `record_step_execution_observation`, correction and selected-publish commands apply the **same actual-authoritative** project entitlement, member/credential, named MCP client consent, allowed operation, task scope, grant freshness, approved definition and expected revision checks as REST/UI/SDK/integration writers. Existing global `ProjectWriteLockGuard` does not by itself guarantee policy on `/api/cycles` or `/api/bugs`; the adapter must delegate to a shared domain owner, never treat a URL-level guard as final proof.

Each material write returns typed `operationId`, `projectId`, `attemptId`/`observationId` as applicable, server revision, committed effective outcome, and durable event receipt or explicitly pending/recoverable audit publication; a lost ack must be retriable without producing duplicate state. Reuse of the same idempotency key with a different payload returns deterministic conflict. A single Bug may have many distinct SIDE/DIRECT relationship events within one case/run; existing `bug_links` remains a backward-compatible case/run projection. Reads distinguish latest effective execution, original event, attempts, legacy imported result and unverified history. No such new MCP operation is claimed implemented in this source.

## Revision 1.4.15 — result/relationship API invariants at existing owners

**Compatibility-first changes (PROPOSED, not currently deployed):** Extend the existing SDK `POST /api/projects/:projectId/automation/runs/:runId/results` request/response with a stable `logicalAttemptId`, explicit `attemptOrdinal` or verified monotonic generation, reporter run/shard identity and idempotency digest/receipt. Compare ordinal **under the authoritative Run/execution lock**; accept an exact replay as the same event, refuse same-key/different-payload reuse, store a superseded attempt without changing the current result, and treat retry indexes as ordering evidence only when the producer guarantee is explicit. A submission after the Run is closed returns deterministic closed/superseded/reopen-required state and cannot silently modify accepted totals. Bind evidence upload and retried close PATCH to the event/attempt receipt. Do not break existing SDK without a clearly tested compatibility adapter and rollout gate.

The existing `PATCH /api/cycles/:cycleId/executions/:executionId` MUST bind both URL IDs and actual parent-child membership before modifying state. Metadata-only writes must not update the performer. The existing `POST /api/bugs/:bugId/links` and Bug create/edit/import/MCP paths MUST verify that `executionId → cycle_item → testcaseId/cycleId → projectId` matches every supplied ID; reject mismatched triples without modifying or auto-failing an unrelated execution. Returned validation errors should be bounded, project-safe and suitable for the native UI and external AI to act on.

**Receipt minimum:** event/attempt identifier, accepted or superseded/rejected state, authoritative version, source actor/client, effective Run/case IDs, prior/effective result when authorized, closure fence/generation and idempotent hash. Original import and historical correction remain distinguishable in all read paths.

## Revision 1.4.16 — reporting and worker completion contract clarification

No separate MCP integration endpoint is created. Existing provider-sync and review-analysis progress responses must expose authoritative receipts for ticket identity, terminal disposition, skip/fail causes, accepted operation generation, total and terminal counts; an externally initiated sync cannot treat skipped invalid tickets as successful coverage. Current review-analysis run status must be tied to the lease generation that published it. Existing Requirements/Plans frontend source is the user-facing reader of these records; upstream MCP/native AI receives the same truth and cannot infer completion from a stale cached panel or heartbeat alone. Concurrent retry and cancellation need idempotent responses and actual current project/role checks; preserve existing APIs/format wherever compatible.


**Scoped source and Plan contract refinement:** A provider-sync `partial` receipt reports any outstanding source revisions and whether the incremental cursor is safe to advance; it cannot certify synchronized coverage while unmirrored failures have been lost from the retry set. Existing Plan items and Run association writers must validate same-project ownership across Plan/Suite/Test Case/Run IDs irrespective of REST or MCP entry path, returning a project-safe validation failure without partial mutation. Existing APIs remain owners; no new standalone service.

## Reconciled final-write and reporting invariants

No new MCP endpoint or second source of truth. All existing native/REST/MCP/automation paths which can add Plan items, assign Run/Plan, save Zyra selected operations or edit/restore Knowledge Base must converge on the same project-scoped authoritative writer and transactional guard. A validation failure is project-safe, does not expose a foreign resource title, and makes no partial mutation. Sync status receipts use one outcome per ticket and reject changes to settled attempts; retries are explicit. Concurrent KB revision conflicts return the existing appropriate conflict response, not silent last-write-wins. Inputs/reporting must preserve provenance and human approval constraints; exact endpoint signatures remain those of source and must be inspected, not guessed.

## Revision 1.4.17 — enforce presented credential across actual REST and MCP entry points

**Existing current routes, not proposals:** `POST /api/mcp`, `POST /api/projects/:projectId/mcp`, `POST /api/projects/:projectId/testcases`, `PUT /api/projects/:projectId/testcases/:testcaseId`, `POST /api/projects/:projectId/testcases/bulk-update`, `GET /api/public/shared-runs/:token`, `GET /api/public/shared-runs/:token/executions`, `POST /api/cycles/:cycleId/share`, `POST /api/auth/password/reset`, `POST /api/projects/:projectId/custom-fields/definitions/:definitionId/restore`. Check current service/controller source before adding or changing contracts.

**Token-scope and membership contract:** For a request authenticated by a `tsbo_` bearer token, authorization uses *both* the underlying human (where required) and the presented credential's effective scopes, live project/member status, entitlement, and project MCP policy. `read` never permits create/update/delete through a different REST URL just because middleware populated `req.userId`. Invalid/empty scopes cannot broaden implicitly. A human browser session retains existing session behavior; project API tokens do not inherit unrestricted browser-scope mutation rights. Existing MCP `tools/list` and `tools/call` advertise/execute only the current allowed capabilities. Normalize denied and stale-state responses without revealing target existence across projects.

**Public shared Run response contract:** Define an explicit public-run DTO consistent with the current `share/[token]` frontend (`name`, `description`, `status`, `environment`, `buildVersion`, `createdAt`, `startedAt`, `endedAt` as needed). Exclude `shareToken`, `projectId`, `ownerId`, `planId`, `shareEnabled` internals and future database fields by default. The public execution list remains intentionally minimal. A disabled token must fail to resolve; publication and re-enabling follow the owner-approved rotation/permission policy. Do not add a second sharing service.

**One-time reset contract:** A reset request either atomically consumes the valid token and changes password with durable persistent-session invalidation, or returns used/expired/failure with no second accepted mutation. Concurrent uses, failed DB steps, stale cached sessions, and recovery after a successful commit but failed post-commit cache eviction are explicit protocol cases. Preserve existing password validation and frontend URL shape.

**Custom metadata/error contract:** Nonempty tag replacement containing invalid, missing, stale or foreign IDs fails before deleting existing links, with an intentional validation error. `[]` is a valid intentional clear-all. Restoring a soft-deleted custom definition with a currently occupied normalized name returns a controlled conflict without purging history. Reuse existing REST endpoints and project scopes.

**Scheduled external-report delivery:** The existing analytics job uses provider-correlated idempotency/receipt or discoverable reconciliation, as supported by the actual Basecamp API; an opaque retryable HTTP timeout cannot be treated as definitely unposted. Persist claim generation and coherent outcome evidence and validate via fault injection, not just by counting local jobs.

## Revision 1.4.18 — product-distillation service/MCP extensions (PROPOSED; not implemented)

Extend the existing project gateway and shared services; discover deployed capabilities before calls. The native UI uses the same authorization and domain operations. Names below are proposed design names, not proof of callable endpoints. Effective Guide retrieval/proposal remains get_effective_qa_guide / propose_qa_guide_revision; do not duplicate it.

| Proposed action | Required contract outline | Result and boundary |
|---|---|---|
| record_session_observation | Bound project/session; clientObservationKey; source refs with revisions/ranges and evidence kind; observedAt; observation; interpretation separately; completeness/gaps. | Persisted observation ID/revision, authorization-scoped source references and receipt; exact replay returns original receipt. No case/result/spec publication. |
| search_product_discoveries | Bound project; query; optional session/classification/status; bounded cursor/limit. | Authorized canonical candidate IDs/revisions, evidence/disposition and related requirement refs. No restricted existence, titles or counts. |
| propose_product_discovery | Observation IDs; candidate ID/base revision when extending; problem; evidence/counterevidence; existing-capability/spec checks; classification; alternatives/scope. | Draft candidate revision or explicit existing-match/conflict; semantic matches are recommendations, not auto-merges or approvals. |
| request_session_distillation | Authorized source selection and version/date bounds; purpose; idempotency key; resource limits; resume checkpoint when applicable. | Accepted job/checkpoint ID only when a real worker accepts; otherwise NOT_SUPPORTED/BLOCKED. Requested/retrieved/examined/excluded/unavailable coverage is retained. |
| draft_spec_amendment | Candidate revision; exact source manifest; canonical target document IDs/base revisions; proposed patches/hash; impact and acceptance criteria. | Existing staged proposal/revision with exact diff and review requirements. No agent approval, direct protected write or implementation permission. |
| get_discovery_trace | Candidate ID with permitted version/pagination; optional source details subject to separate ACL. | Observation → decisions → amendment → approved requirement → implementation → validation references, with unknown/missing links explicit. |

**Shared guards:** existing project MCP opt-in/client/principal/session policy applies before discovery and again before commit. Source and destination must each permit the requested operation; cross-project promotion requires an explicit authorized transfer, not merely access to the target. Missing/invalid scope denies. UI/REST/MCP/background paths share the same service policy. No approve_product_feature machine tool is introduced.

**Typed failure semantics:** validation error for malformed source/patch identity; NOT_AUTHORIZED without sensitive existence disclosure; STALE_REVISION for changed bases/inputs; SOURCE_UNAVAILABLE or INCOMPLETE_CONTEXT with truthful coverage; LIMIT_REACHED with resumable checkpoint; NOT_SUPPORTED where no adapter/worker exists. Timeout after possible acceptance requires receipt reconciliation before retry, not blind replay. Payload text cannot grant authority.

**Apply:** use the existing human-only, exact-revision/selected-operation approval and transactional apply contract, including live permission/revision recheck and durable audit receipt. Never bypass it with a generic KB update, Git commit tool, background worker or caller-supplied approved=true. Remote repository/spec-file writes require the separately authorized change path and a receipt; no direct main/deployment is implied.

## Revision 1.4.19 — effective testing-method discovery via existing project MCP (PROPOSED)

**No parallel MCP server, no new transport, no secret in instructions.** Existing project-scoped `src/mcp/mcp.service.ts` supports JSON-RPC 2.0 `initialize`, `ping`, `tools/list`, `tools/call`; current `mcp.tools.ts` has 50 tools including `list_projects`, `list_knowledge_documents`, `get_knowledge_document`, `search_knowledge_base`. Those do not expose a **workspace-installed immutable effective pack** and their project KB reads cannot safely substitute for platform guide identity/version, effective precedence and exact historical method retrieval. Reuse the same registry, service, auth and error conventions and introduce at most ONE semantic read-only tool **unless implementation analysis shows an existing T-422 operation already satisfies it**.

| Proposed operation | Inputs | Authenticated output | Bounds and side effects |
|---|---|---|---|
| `get_effective_testing_method` | `sectionId?` (omitted means index), optional exact approved `revisionId` only for authorized historical read, `includeContext?` bounded | Project/workspace scoped manifest: `{schemaVersion, packId, packRevisionId/hash, effectiveRevisionHash, projectId, sections[{id,title,revision,hash,reference}], policyScopes, sourceRefs, contextSummary, missing, unavailable, stale, asOf}`; when `sectionId` supplied, permitted exact content/template and cited source hashes | Read only. No full-pack dump by default; unknown section is typed error, absent/hidden source is unavailable without foreign metadata. No local requirement/test/run/skill approval, agent assignment, AI provider use or target execution. Token and project grants reauthorized on every call. |

Example *index* request to existing project MCP endpoint (illustrative, not implemented):

```json
{"jsonrpc":"2.0","id":"guide-1","method":"tools/call","params":{"name":"get_effective_testing_method","arguments":{}}}
```

Follow-up with a specific section ID such as `core.primary-user-type-module-context` to obtain the *approved* section text and its own source citation. The response must not claim a project-specific user type, a live requirement record or active validation without source/receipt. A `resources/list` / `resources/read` adapter can be considered later if actual MCP client interoperability warrants it; not a prerequisite or replacement for existing tools.

**Authentication/authorization:** source project ownership derived from token and target resource, project MCP enabled and named client/session grant as defined in P-18/T-411, effective actor authorization at call, no cache-based privilege renewal, version/section visibility and logging. The method is still useful via native authorized REST/Copilot when external MCP is disabled; do not turn off the entire workspace skill system just because external client exposure is OFF. Neither `read` nor `write` bearer scope by itself grants authority to publish guide revisions or edit official records. Pre-existing tokens do not grandfather opt-in access.

**Authoring workflow:** clients may request project context (using existing project metadata and KB scoped reads), identify the target outcome, relevant actors/events, capabilities and contexts using a fitting FR-109 profile, with explicit missing-source markers, then submit a proposal to the existing shared staging pipeline. A generated KB note is not an approved Requirements-page record. No `create_requirement` tool is to be invented solely because the current Requirements page lacks an editor. Field/association revision proposals and optional automatic *protected* publication are separate GAE work under explicit owner approval.

**Protocol tests:** genuine initialized project MCP tool discovery + content read; exact version/hash; index, one section, invalid section, huge result, missing project context, revoked membership, project MCP OFF, disabled client, cross-workspace ID guessing, legacy read/write tokens, active version change between list/get, project overlay conflict, external model prompt-injection request, read-only actor attempting method publication. Claim successful code path only after actual CI and authorized client receipts, not a speculative tool schema.

## Revision 1.4.20 — incremental coding changes and QA impact REST/MCP contracts (ALL PROPOSED)

**No endpoint/tool in this section is asserted to exist.** Extend the existing `McpService`/`buildMcpTools()` project-scoped JSON-RPC gateway and `ApiTokenRestGuard`; no additional MCP server, credential type, agent session/copy service or model provider. Existing APIs for native cases, run/result recording, Bugs and evidence stay authoritative, including `POST /api/projects/:projectId/automation/runs/:runId/results` and current attachment paths. Transport cannot determine requirement approval or product conformance by itself.

### A. Read and write contracts, with authority

| PROPOSED REST method/path (all `:projectId` bound) | MCP candidate (same domain service) | Required authority / effect |
|---|---|---|
| `GET /api/projects/:projectId/quality/context?sourceRevision=...&paths=...` | `get_quality_context` | Project read; authorized relevant approved source/behavior/cases and gaps only, version/hash and `scopeCompleteness`; no automatic whole-source download. |
| `POST /api/projects/:projectId/quality/changesets` | `start_quality_change` | Project write+write-lock; `origin=unplanned|prepared`, registered repo, base commit or provisional workspace digest; no requirement/model prerequisite. |
| `GET /api/projects/:projectId/quality/changesets/:changeId` | `get_quality_change` | Project read; exact source/branch/revision, event cursor, deltas, verified/unverified separation, impact links. |
| `POST /api/projects/:projectId/quality/changesets/:changeId/events` | `append_quality_change_event` | Project write; exact incremental event and idempotency key, event-sequence precondition. Appends, never mutates previous event. |
| `POST /api/projects/:projectId/quality/changesets/:changeId/reconciliation` | **no generic agent self-verify tool** | Trusted separately authorized Git/CI attestor; captured source scan with independent credential/commit/manifest signature, not agent-provided `verified=true`. |
| `GET /api/projects/:projectId/quality/impacts?status=...&cursor=...` | `list_quality_impacts` | Authorized project read with bounded counts and non-enumerating foreign record behavior. |
| `PATCH /api/projects/:projectId/quality/impacts/:impactId` | `assess_quality_impact` (if separately authorized) | Project user with explicit QA assessment permission, `If-Match`/`expectedVersion`; assign/ack/review/block/verify/close with reason and actual evidence. Not triggered by bell read. |
| `POST /api/projects/:projectId/quality/behavior-proposals` | `propose_quality_behavior_revision` | Staged proposed model and typed links; project write only submits draft, no publication. Reuse T-304/T-305 review writer. |
| `POST /api/projects/:projectId/quality/behavior-proposals/:proposalId/approve` | **NO agent approval tool in first slice** | Named authorized human, exact content/base/policy hashes and dependency closure; approval identity cannot be MCP machine token by default. |
| `GET /api/projects/:projectId/quality/testing-context?impactId=...&atRevision=...` | `get_quality_testing_context` | Read-only case selection, model/path/AC pins, fixture/adapter needs, evidence requirements, unexamined scope and targeted source escalation. |
| `GET /api/projects/:projectId/quality/trace?subject=...&depth=...` | `get_quality_trace` | Project-safe typed graph walk with depth/fanout caps and as-of revision. No inaccessible counts or metadata. |
| `POST /api/projects/:projectId/quality/executions/:executionId/assertion-receipts` | `append_quality_assertion_receipt` (authorized reporter only) | Validate native same-project existing run/execution, actual attempt and independently observed assertion/evidence, authorized adapter, exact pinned expected/model/build; append-only and no fabricated success. |

**Machine scope ≠ human authority:** current project token with `read`/`write` may not publish protected expectation, approve case updates, alter owner policy, enable external project MCP or invoke hazardous targets. Verify membership/revocation on each request. Human flows still follow existing staging/review, plan write-lock guards and audit rules. Returned `NOT_SUPPORTED` is preferable to an invented integration.

### B. Incremental changeset request (example schema shape, not an existing API)

```json
{
  "origin": "unplanned",
  "repositoryId": "registered-project-repository-id",
  "branch": "fix/automation-result-ack",
  "baseCommit": "<trusted-full-commit-sha>",
  "headCommit": null,
  "provisionalWorkspaceDigest": "sha256:<digest>",
  "relatedSourceRefs": [],
  "knownGaps": ["Approved requirement for lost acknowledgement unavailable"],
  "idempotencyKey": "project-repo-source-change-identity"
}
```

A source that is not configured/authorized is rejected or remains `UNVERIFIED_SOURCE`, never silently linked to another repository. A provisional uncommitted worktree does not assert a deployed build. The server generates its own project-bound UUID and `revision=1`, returns `sourceVerification=PROVISIONAL`, `scopeCompleteness=UNKNOWN` and a canonical `changesetId`. A prepared change may include existing exact `requirementRef`, `planId`, `testcaseId` and source revision, but shares the same write path.

**Append event** (`If-Match: "change-seq-<n>"` plus stable `Idempotency-Key`):

```json
{
  "eventId": "client-stable-event-uuid",
  "eventType": "SOURCE_BEHAVIOR_OBSERVATION",
  "sourceRevision": { "kind": "provisional_worktree", "digest": "sha256:<digest>" },
  "changed": [
    { "path": "Tesbo-Backend-Nest/src/automation/automation.service.ts", "symbol": "recordResult", "kind": "conditional_transition_modified", "locator": "git-diff-hunk-ref" }
  ],
  "behaviorClaim": { "familyKey": "native-result-reporting", "elementKey": "ACK_UNKNOWN", "certainty": "AGENT_REPORTED", "proposedEffect": "read back before retry" },
  "affectedExistingCases": [],
  "notExamined": ["other callers of result ingestion", "runtime environment"],
  "sourceEvidence": ["commit/diff locator, if available"],
  "proposalOnly": true
}
```

**Conflict and retry contract:** duplicate exact `(project,changeset,eventId|idempotencyKey,payloadHash)` returns original event/impact refs without a second notification; same key with differing payload yields `409 KEY_REUSED_DIFFERENT_CONTENT`; stale expected sequence yields `409 STALE_EVENT_SEQUENCE`. No silent last-write-wins; a corrected observation is a new appended event.

### C. Source reconciliation attestation (separate, least-privileged)

The proposed trusted attestor inputs `registeredRepositoryId`, base and head *immutable* commits (or a signed bounded patch provenance for uncommitted drafts), diff tool/version, changed paths and route/dependency extraction scope, timestamp and attestable signature/token identity. The backend independently verifies the attestor's allowed repository/project and signature; it never trusts an ordinary coding-agent `attested=true` field. Reconciled output returns three sets: `reportedAndVerified`, `verifiedButUnreported`, `reportedButUnverified`; plus `unexaminedDependencies`, source span, checks actually run, and `SCOPE_RECONCILED|PARTIAL|UNVERIFIED` status. A file outside the agent report still creates/reopens an assessment obligation. Proven changed bytes are **not** proof of business correctness. Missing commit history or dynamic dispatch remains UNKNOWN, not a false complete report.

### D. Read-only QA assessment and testing context (response projection)

```json
{
  "impactId": "<project-owned-uuid>",
  "changesetId": "<project-owned-uuid>",
  "impactRevision": 3,
  "assessmentStatus": "ACTION_REQUIRED",
  "sourceVerification": "PARTIAL",
  "branchAndBuild": { "baseCommit": "<sha>", "headCommit": "<sha-or-unknown>", "buildDigest": null },
  "requirementRefs": [{ "source": "external_provider", "externalId": "<real-source-id>", "sourceRevision": null, "authority": "UNKNOWN" }],
  "behavior": { "familyId": "<uuid-or-null>", "revisionId": "<uuid-or-null>", "requiredElements": ["<element-key>"], "missingExpectation": true },
  "nativeCaseBindings": [{ "testcaseId": "<existing-uuid>", "contentHash": "sha256:<hash>", "bindingState": "REVIEW_REQUIRED" }],
  "unexaminedScope": ["secondary ingestion path"],
  "testPlan": { "initialData": "REQUIRED", "independentAssertions": "REQUIRED", "adapterId": null, "environmentAuthorized": false },
  "evidenceStatus": "NOT_EXECUTED",
  "readyForExecution": false
}
```

This is a *selected, version-pinned projection*, not a compulsory formal handoff artifact. Coding and QA agents can request additional relevant context or targeted source inspection; responses MUST state source/version coverage, permissions, stale refs, inaccessible sources and any `NOT_CHECKED`. Do not produce a confident empty array when a query failed; preserve `UNAVAILABLE`.

### E. Immutable actual assertion receipt (supplement to native Runs)

```json
{
  "executionId": "<existing-native-execution-uuid>",
  "attemptKey": "<stable-executor-attempt-key>",
  "assertionKey": "<approved-condition-or-obligation-key>",
  "behaviorRevisionId": "<immutable-revision-uuid>",
  "caseDefinitionHash": "sha256:<exact-case-content>",
  "requirementSourceRevision": "<source-revision-or-UNKNOWN>",
  "adapterRef": { "name": "existing-reviewed-adapter", "version": "<version>" },
  "buildRef": { "commit": "<code-sha>", "artifactDigest": "<digest-or-null>" },
  "observation": { "expected": "<independent-oracle>", "actual": "<observed-fact>", "verdict": "FAILED", "evidenceTier": "ACTUAL_EXECUTION" },
  "attachments": [{ "id": "<existing-attachment-uuid>", "sha256": "<content-digest>" }],
  "idempotencyKey": "<source-run-attempt-assertion>"
}
```

Server validation must verify the native execution belongs to the caller's project, that assertion/attempt identity and model/case revision are approved or explicitly unverified, the evidence attachments belong to the same run/attempt/project, and independent observation exists. A `PASSED` assertion with no required observation/evidence is rejected or stored as `NOT_ADJUDICATED`, not silently converted. A later passing retry writes another immutable attempt; native `executions` may display its current effective status but the first failure remains in historical receipts. The same content key is idempotent; conflicting content is refused. A `trace` edge alone is never a result writer.

### F. Notification and inbox events

New `quality_impact_requires_assessment` notification type should be added via **existing** `legacy/notification-events.ts`/`notification-writer.ts` and frontend `TopBar.tsx` safe link resolver (`<projectId>:<impactId>`). `quality_impact_items` plus a transactionally inserted `quality_outbox_events` row are authoritative; background delivery to `notifications` is idempotent against V109 `(user_id,dedupe_key)`, checks current project membership and yields an auditable outcome. Existing notification `writeNotifications()` returns `0` for errors as well as no eligible/deduplicated writes; it cannot be the outbox success acknowledgment. The single existing notification owner needs a structured delivery receipt or an independent persisted status check distinguishing `DELIVERED`, `ALREADY_PRESENT`, `INELIGIBLE_RECIPIENT`, and `RETRYABLE_FAILURE`. Recoverable failure remains pending with backoff, and membership revocation cannot cause old queued content to leak. Existing `POST /api/notifications/:id/read` remains bell-read only. QA impact `ACKNOWLEDGED/ASSESSING/VERIFIED/CLOSED` must use its own authorized compare-and-swap endpoint, not the notification read API. Unknown notification type cannot be an arbitrary unvalidated URL.

### G. Common security, error and evidence tiers

- Return `401` for no session/token, non-enumerating `403/404` for foreign project or inaccessible resource; no cross-tenant counts, titles, source IDs or evidence link metadata. `read` scope cannot write; `write` scope cannot approve protected asset or run an external target.
- Return `400/422` for invalid schema, wrong relation/element types, missing start data/assertion obligations, unsupported predicate or malformed source ID; `409/412` for exact event/base/revision conflict, never silent rebase.
- Return typed `UNKNOWN_SOURCE`, `EXPECTATION_CONFLICT`, `STALE_MODEL`, `NOT_EXECUTED`, `EVIDENCE_UNAVAILABLE`, `BUILD_UNKNOWN`, `SCOPE_PARTIAL`, `NOT_SUPPORTED` with actionable references and no invented source or verdict. A `5xx` or transient backend error does not change a recorded product assertion.
- A graph edge is source-linked metadata, not authorization, approved expectation or evidence. Persist actor/operation/policy/source revisions, payload hashes and independent trace. Imported Markdown, diffs and artifacts are untrusted data; deny arbitrary code execution, unexpected URL schemes, path escape, prompt injection and privileged tool directives.

**Regression proof:** design this contract with existing `e2e/api/{mcp,automation,authorization,notifications,executions,testcases}.spec.ts`, project-boundary guards and actual migrated-DB tests. These tests are specified, **not run**, and must be authorized for an isolated environment before execution.


## Revision 1.4.21 — T-454 source-seam corrections (all NEW operations still PROPOSED)

**Actual requirements link cannot certify a requirement.** Existing MCP `link_requirement_to_testcase` edits the native testcase's Jira/Linear/Notion key and allows a not-yet-synced ticket. New `get_quality_context` / `get_quality_trace` must return `sourceLinkStatus: LINKED_UNVERIFIED_SOURCE` if provider identity, relevant AC, revision or approval are missing. Do not fabricate a `requirements` row, authority or verified `APPROVED_EXPECTATION` from `testcases.source_refs` or KB. A verified external source revision is separately pinned, and its missing/deleted status remains visible.

**Actual MCP and REST authority split.** MCP tool calls are authenticated project-scoped JSON-RPC, with current issuer membership and read/write scope. REST API tokens are project-prefixed and method-scoped. New `submit_quality_change_event` is a draft/proposal capability; `approve_quality_behavior` requires independently authorized human review under domain policy. Until explicitly designed/proven, do not expose graph publication to MCP merely because it supports `write`. Current `initialize` advertises `tools.listChanged:false`, so neither API nor UI should promise server-initiated push notifications to coding or QA agent clients; polling/explicit read is the supported initial design.

**Outbox delivery identity:** Proposed delivery result object: `{ outboxEventId, recipientUserId, deliveryState: 'INSERTED'|'ALREADY_DELIVERED'|'NO_ELIGIBLE_RECIPIENT'|'RETRYABLE_FAILURE', notificationId?: string, retryAfter?: string }`. Generic `writeNotifications` returning zero is never a delivery acknowledgment. Dedup requires proven lookup/unique index rather than a zero count guess; DB failures preserve outbox pending state. Once recipient membership is revoked, notification reads and deep links must not expose project metadata—even when the old notification was previously written.

**Audit + result proof:** Require all graph approvals, impact acceptances, assertion receipts and security-relevant status transitions to write mandatory audit in the same DB transaction using a shared transaction client; existing catch-and-log `AuditService.log` is not a sufficient fail-closed API. The `recordResult` API updates native latest outcome; a graph assertion receipt is appended with exact separate attempt identity and independently recorded observation, not inferred from the API's retry count. `uploadEvidence` may return `{ skipped:'quota' }` and may compensate after late close; only confirmed artifact association satisfies a required evidence obligation. Accept native result/status independently while returning `evidenceStatus: 'PENDING'|'AVAILABLE'|'QUOTA_SKIPPED'|'MISSING'|'INACCESSIBLE'|'UNKNOWN'`, without fabricating accepted proof.

**Browser/data leak negative contract:** New list/search/count/export/trace/evidence routes always recheck current project membership and per-resource authorization. The existing per-user `/api/notifications` contract must be reviewed for project alerts after membership revocation; never assume an old bell record is safe because it is owned by the user. Unauthorized responses disclose neither protected labels, project identity, adjacency, counts nor source/evidence hashes.


## Revision 1.4.22 — Model Studio MBT-001 revision 0.2

Specification amendment only. Earlier source reviews and decisions above retain their historical dates/baselines; they are not current deployed claims. Existing IDs/content are preserved. This amendment extends native graph, Zyra, case, run/evidence and publication owners, not a parallel platform. Owner ratification and independent delta closeout remain open.

The MBT-C namespace below defines proposed design contracts. The eight files remain one package; each clause has the normative home listed here. All files apply the full cross-referenced contract; omission of duplicated prose never waives a dependency.

| Contract | Normative file |
|---|---|
| MBT-C-01 | `03_TECHNICAL_DESIGN.md` |
| MBT-C-02 | `02_WORKFLOW_AND_UX_SPEC.md` |
| MBT-C-03 | `03_TECHNICAL_DESIGN.md` |
| MBT-C-04 | `03_TECHNICAL_DESIGN.md` |
| MBT-C-05 | `03_TECHNICAL_DESIGN.md` |
| MBT-C-06 | `01_PRODUCT_REQUIREMENTS.md` |
| MBT-C-07 | `04_MCP_API_CONTRACTS.md` |
| MBT-C-08 | `04_MCP_API_CONTRACTS.md` |
| MBT-C-09 | `07_UI_DESIGN_TASKS.md` |
| MBT-C-10 | `03_TECHNICAL_DESIGN.md` |
| MBT-C-11 | `00_README.md` |

#### MBT-001-H — Service/API/MCP contract shape (proposed, not implemented)

- Model drafts: project-scoped GET/POST/PATCH with explicit expected revision token; immutable approve/reject and version-diff actions; writes require current roles, project policy and audit. Server-generated IDs only.
- Model validation: bounded POST validate on a draft revision; returns diagnostics and coverage feasibility without executing user code or changing published models.
- Case links: GET and policy-gated POST/DELETE with modelRevisionId + caseId + caseRevisionId + optional step/path and provenance; validate both artifact ownership and active publication; version link decisions.
- Generation: bounded POST generate with explicit CURRENT/HISTORICAL mode, pointer token, strategy, seed, logical budget, actor/fixture and scope; eligible states per MBT-C-02, resource/determinism per C-04. Store through native task/draft owners only.
- Execution preparation: POST propose-case/run mapping through existing Tesbo agents/tasks/runs; explicit human authorization and cancellation. New executor adapters are capability-checked and sandboxed; no browser/network actions by the graph engine.
- Coverage: GET parameterized by model revision, environment/build and evidence mode, with paginated model paths/cases and confidence categories. Unauthorized or ambiguous requests fail closed rather than silently returning an empty but apparently complete graph.
- Observability: native audit/change and task/attempt events record actor, project, model revision, generation manifest, policy decision, outcome, retry dedupe and errors. Diagnostic data must not contain secrets. Read permissions must be rechecked on every downstream dereference.
- MCP: extend the existing Tesbo tool catalog, typed input schemas, budgets and user/project consent; external agent cannot submit self-attested runtime “passed” or approve the model by writing JSON.

**Backend rule:** Versioned model/revision/element/relationship records use project-composite foreign keys, immutable approved snapshots and restricted delete semantics. Referenced provenance uses targeted RESTRICT at native parent deletion owners while reliance/holds exist, with archival and authorized privacy-erasure handling under MBT-C-05. This is a proposed explicit policy needing native-owner ratification and migration proof, not a claim existing cascade FKs are safe. All writes check authorization within their database transaction; immutable revisions use optimistic concurrency plus project/organization FK constraints and idempotency keys. A stale revision, foreign case, revoked member, duplicated approval, mixed valid/invalid batch, conflict or lost network response cannot partially publish or cross-link unrelated records. Side-finding proposals remain separate from the selected path.


### MBT-C-07 — Command recovery without fictional native idempotency

All new model/approval/activation/mapping/accepted-materialization operations require a project-scoped operation key, canonical payload digest, action/principal binding and server receipt. Scope is `(projectId, action, operationKey)`; payload includes all native target IDs, immutable revisions, mode, selection, expected versions and consent identity. Same key/same payload returns the prior outcome after current read authorization; same key/different payload returns `409 OPERATION_KEY_CONFLICT` with no mutation. Persist request identity and selections across reload under the authenticated project session; never store credentials in URL/local state. A server operation receipt lookup is authoritative; a browser timeout is not FAILED or proof of rollback.

**M1–M3 initial run-create decision: retain explicit manual reconciliation.** Current native run creation is not assumed idempotent. Prepare against an existing run where possible. For a new run, a lost response enters OUTCOME_UNKNOWN and disables automatic create/retry. Preserve exact requested name/selection/time/context and offer “Inspect existing runs,” then explicit attachment to the identified canonical run. Finding a similar title is only a candidate, not proof. If no authoritative outcome can be established, remain BLOCKED; a human must acknowledge possible duplication before starting a distinct new intent/key. Existing case-attachment/link deduplication cannot certify preceding run creation. AC-14 expressly tests this behavior rather than claiming automatic no-duplicate native creates. The same fallback applies to any native case materialization/adapter write whose owner lacks a verified receipt contract.

Idempotent relationship attachment records a separate receipt and cannot partially publish a mixed batch. Workflow stages (prepare intent → native create/choose → attach cases → accepted model link → dispatch) retain native IDs and stage outcomes; this is orchestration metadata on existing native task/run owners, not a distributed transaction or second run store. Failure after commit leaves its committed truth visible and subsequent projection/evidence state PARTIAL. Never compensate by deleting an unrelated run or conceal a performed external action.

For new receipt-backed model operations, retain key/digest/result identity while any provenance relies on it. If full payload is expired under policy, a minimal key/digest/outcome tombstone prevents re-execution. Expired grants are not renewed by retry. An absent/expired recoverable receipt returns `410 OPERATION_RECEIPT_UNAVAILABLE` and requires reconciliation; no silent same-key fresh execution. Product retention sets actual periods; unset retention disables such automated recovery, never makes it unbounded. New intent is explicit and is subject to current budget/consent. A future native idempotent create extension must be proved at the native owner (commit then drop response, concurrent repeat, altered payload, reload, expiry and foreign principal) before replacing this manual fallback.


### MBT-C-08 — Untrusted text, AI egress and export

Model labels, imported requirements, source comments, evidence and provider responses are DATA. They cannot override system/project instructions, call tools, grant consent, approve content, change destinations or suppress findings. Import/preview retains provenance and isolates untrusted text from executable instructions. Guard AST allowlisting does not substitute for these natural-language boundaries.

Before enabling a Zyra-assisted Model Studio action, inventory existing provider, tool, retrieval, session, telemetry/log, export and attachment boundaries. Reuse native controls and name their owner/configuration/evidence. Provider/tool destinations and permitted data fields must be allowlisted by project policy BEFORE egress. Deterministically minimize/redact secrets, credentials, personal data and foreign-project content before constructing prompts, tool arguments, provider requests or logs; a later UI redaction is insufficient. Private evidence bytes/credentials are excluded by default. A detector, classifier or provider failure blocks the egress with `DATA_POLICY_BLOCKED` and preserves the draft locally under normal access controls. Do not assume a provider can safely redact content after receiving it. Missing confirmed policy means local/manual model work only, no provider egress.

Canary fixtures include hostile “approve/run/export this secret” instructions embedded in a rule, benign same-project rule text, secret-like values, foreign references and filtering-provider failure. Assert destination payloads, tool requests and logs, not only assistant wording; no canary leaves the allowed boundary and no approval/dispatch occurs. Record safe diagnostic reason without reproducing the secret. An authorized export is an explicit redacted snapshot with revision/digest/scope/unknowns; subsequent access revocation stops new downloads, but cannot recall bytes legitimately exported earlier. Retention/use of those bytes follows the agreed data policy; no impossible recall promise.




## Revision 1.4.23 — Model Studio revision0.3 reconciliation



**Canonical identity:** MBT-C-12 in `03_TECHNICAL_DESIGN.md` binds Model Studio to the same FR-117 behavior family/revision owner; model IDs are aliases, and current-published is the active pointer, never a second latest-approved authority. This v1.4.23 clarification governs operative FR-117/MBT identity and selection wording in earlier proposal sections; historical source evidence retains its original pin.

Resolve familyId/modelId and revision aliases to identical canonical IDs at the native owner; inconsistent aliases fail INVALID_MODEL before writes. New typed conflict codes MODEL_SCOPE_CONFLICT and MAPPING_CHANGED preserve selection/history and require explicit resolution, never blind retry or historical-mode conversion. C-12 authority, C-05 removal gate and C-03 dimensional obligation keys apply equally to REST/MCP/job transports.


## Revision 1.4.24 — opt-in native M1 candidate preview

MBT-C-13 in `04_MCP_API_CONTRACTS.md` owns the exact ephemeral structural preview contract. This adds no expected-model identity, publication, active pointer or second data store; FR-117/C-12 remain authoritative for future persisted models. Intake and authorization are explicit; default OFF. Source implementation is proposed for merge in Tesbo PR95, parent92abc860/native implementation23b5a7ec; no deployed or target-runtime proof is claimed by this spec checkpoint. Existing historical source/test/review claims remain at their original pins.

### MBT-C-13 — Native M1 ephemeral structural candidate preview

POST `/api/projects/{projectId}/agents/zyra/changes/model-preview` extends the existing graph change-review module. Its sole job is bounded structural inspection of caller-authored sequential FSM candidate data. It does not resolve/persist an FR-117 family, issue canonical model/revision IDs, accept rule authority, approve/activate a model, generate paths, prepare a run, access a provider or act on a target. C-12 remains the only expected-family/revision authority for future persisted models. This route's candidate digest is not a canonical model version.

The route is OFF unless server configuration `TESBO_MODEL_PREVIEW_ENABLED=1` explicitly enables it. A caller must pass existing native authentication/current project/workspace access; the POST retains existing project write-lock and machine-token WRITE-scope enforcement. This revision adds no special role/entitlement bypass. The later MBT-C-14 adapter exposes this same native preview through the existing MCP gateway; it does not add a second validator or authority. Native access is checked before feature/body diagnostics, and project/organization membership/archive/deletion is rechecked before returning the computed candidate preview. Missing/changed access fails with native non-enumerating refusal; disabled feature returns503 MODEL_PREVIEW_DISABLED to an otherwise authorized caller. Preview's no-write boundary concerns model/case/run/execution/Bug/graph/link state; existing authentication/token/workspace bookkeeping remains its native owner's behavior.

Request schema is intentionally limited to the explicit preview format, not a final executable EFSM/import contract:

```json
{
  "schemaVersion": "tesbo-fsm-draft/1",
  "semantics": "SEQUENTIAL_FSM",
  "initialStateId": "draft",
  "states": [{"id":"draft","label":"Draft"},{"id":"approved","label":"Approved"}],
  "transitions": [{"id":"approve","from":"draft","to":"approved","action":"Approve","expectedObservation":"Approval recorded"}]
}
```

Only those fields are accepted. IDs use `[A-Za-z][A-Za-z0-9_-]{0,63}` and are unique across states and transitions. Require1–32 states,0–64 transitions, a valid initial state and existing transition endpoints. Nonblank label/action/expected-observation text has respective limits120/500/1000 characters and no NUL. These fixed parser/transport safeguards are not ratified production generation quotas. No caller budget can expand them. Variables/guards/effects, code-bearing fields, canonical IDs, project/principal overrides, approval/VERIFIED/result claims and any unknown field fail400 INVALID_MODEL. Semantics other than SEQUENTIAL_FSM fail422 UNSUPPORTED_SEMANTICS. All action/observation strings remain inert untrusted data; nonempty observation text is not a justified/approved oracle.

Normalize by stable ASCII element-ID order and hash the explicit normalized definition using SHA-256. Visit each reachable state once and its outgoing edges once, so finite cycles cannot create an unbounded job. Return states/transitions with structural reachable annotations and retained UNREACHABLE_STATE/UNREACHABLE_TRANSITION/TERMINAL_STATE diagnostics. A terminal state can be legitimate; an unreachable diagnostic is not automatically an approved exclusion. This is neither path enumeration nor an execution-coverage calculation and supplies no percentage.

Response always states schemaVersion tesbo-fsm-preview/1, status DRAFT_PREVIEW, validation STRUCTURALLY_VALID, approval NOT_APPROVED, sourceAuthority UNVERIFIED and runtimeEvidence NONE. modelId/modelRevisionId are null; candidateDigest describes caller bytes only. capabilities persistence/publication/activation/pathGeneration/targetExecution are all false. No paths, canonical records, execution result, source approval or coverage claim are returned. Actual service HTTP execution is distinct from the absence of real target-behavior evidence.

Implementation slice: native core/service/controller in the existing backend behavior-graph owner, no database migration or frontend change; opt-in isolated CI only. The earlier offline finite-EFSM pilot remains an experiment and is not imported as a production generation/authority engine. Native model storage/publication, quotas/generation, adapters, exact case/attempt/evidence, UI/AT and real target conformance retain their separate gates.



## Revision 1.4.25 — native MCP draft-preview integration

MBT-C-14 extends the existing MCP gateway with the MBT-C-13 stateless validator. This adapter creates no model authority or native QA record. Review gates remain NOT FROZEN; persisted models, activation, generation, target execution and native UI require their own completed work/evidence. The earlier native REST code at778e3658 has exact-head CI evidence; this MCP delta requires its own final-head receipt in PR95. Historical review and implementation statements remain pinned to their original revisions.

### MBT-C-14 — Native MCP structural draft preview adapter

`preview_behavior_model_draft` extends Tesbo's existing in-process MCP registry, not a second MCP server or model authority. Arguments are exactly `{ "model": <MBT-C-13 native candidate> }`, with no project/principal/approval override. The native `ModelStudioPreview.previewForUser` remains the sole validator for REST and MCP. The shared discovery schema advertises the same 1–32 states,0–64 transitions, required fields, ID pattern, text limits and unknown-field rejection; runtime cross-reference, duplicate-ID, blank/NUL text and semantics checks remain the native parser's responsibility.

Require a valid project-scoped token, current issuer membership, `write` scope and existing project write entitlement before handler execution. This matches the REST POST boundary even though the preview creates no domain records. The existing native membership/archive/deletion completion fence is retained. No read-token escalation, new approval role, paid provider, remote tool, actor creation, database migration, family pointer or publication path is added. Existing token authentication/usage bookkeeping remains with its current owner.

The static MCP catalog contains53 tools and advertises the feature prerequisite/default-off boundary. Discovery alone does not mean a deployment enables preview. The existing tool fingerprint/session-expiry behavior forces stale session clients to rediscover the changed schema. No new server stream or listChanged claim is introduced.

MCP uses existing JSON-RPC result/error envelopes. Successful preview content is exactly the C-13 native result, including DRAFT_PREVIEW/NOT_APPROVED/UNVERIFIED/NONE, null model/revision IDs and all authority/execution capabilities false. Native parsing errors map to JSON-RPC ToolExecutionError -32003 with `data.code` and `data.httpStatus`: INVALID_MODEL/400, UNSUPPORTED_SEMANTICS/422 and MODEL_PREVIEW_DISABLED/503. Missing native service fails MODEL_PREVIEW_UNAVAILABLE/503. These status values are diagnostic metadata, not the actual transport status: native MCP's HTTP201 JSON-RPC error envelope is preserved. Existing scope/project/auth/write-lock errors retain their established categories and non-enumerating behavior. Unknown infrastructure errors are not promoted to validation success.

Both `/api/mcp` and `/api/projects/{projectId}/mcp` use this same handler; URL project still must equal the token project. Repeated accepted/refused previews must not change native cases, cycles, executions, Bugs, graph history or run-case links. No generated path, runtime coverage, target execution or canonical model version can be inferred from a successful tool response. All existing model persistence/publication/activation/dispatch/target/UI and independent review gates remain open as recorded.



## Revision 1.4.26 — native ephemeral draft inspector

MBT-C-15 adds the bounded structural list inspector and scoped availability read to the existing Zyra page. C-13/C-14 remain validation owners; C-12 remains future persisted-model authority. Earlier API-only/no-frontend statements describe their historical slices, not this new increment. There is still no approved/persisted model, graphical editor, case mapping, target action or self-issued independent freeze. PR98 owns exact-head implementation/visual receipts. Historical acceptance and review results retain their original pins.

### MBT-C-15 — Native ephemeral preview inspection in Zyra

Extend Zyra's existing Change impact review page with a collapsed Draft model preview inspector. Reuse the current page/layout/CSS and API transport, native ModelStudioPreview, current project/session/token/plan boundaries, and existing API/UI suites. C-12 retains the only future persisted family/revision authority; C-13/C-14 remain the REST/MCP validation owners. This is an in-memory structural list inspector, not the full graphical editor, an approved expected model, case mapping or target execution.

GET `/api/projects/{projectId}/agents/zyra/changes/model-preview` reports `schemaVersion: tesbo-fsm-preview-availability/1`, enabled boolean, SEQUENTIAL_FSM, maxStates32 and maxTransitions64. Require current native project/org membership and the same final archive/delete/revoke access fence before returning. Availability is a read: a scoped read token may GET but still cannot POST. It neither enables the server's default-off flag nor grants write, publication, source-oracle or execution authority. No project-specific enablement is invented for the existing server-wide flag. Unknown/failed availability fails closed; disabled availability hides editing and offers an explicit recheck. A cached enabled read never overrides a subsequent native POST refusal.

Enabled UI offers an explicitly labelled draft-format JSON editor, an inert example requiring review, preview, cancel and clear. One1000000-character textarea intake safeguard accommodates the bounded native format, including escaped text; it is not a model-version or M2 generation quota. Invalid JSON and non-object transport frames (null, arrays or primitives) fail locally without a POST. This is basic request-format admission, not semantic validation. Object-shaped candidate data uses C-13 unchanged; do not create a competing browser model validator or silently repair unsupported semantics/unknown authority fields. Preserve invalid draft text for explicit correction. Do not automatically retry POSTs or save draft content in local/session storage, caches, graph history, cases, runs or any new owner. Leaving the page discards it and the UI must say so.

A successful view belongs to exactly one project and input generation. Editing, clearing, loading an example, cancellation or unmount immediately clears prior result/error and invalidates the outstanding generation, with transport cancellation as a supplementary safeguard. Late success/error cannot replace newer input or another project's state. Component keying uses the canonical project ID. Cancel stops accepting that response; it is not a claim that a target action or persisted job was cancelled. Stateless preview loss can safely say the draft remains unsaved; it must not imply a possible model write by blindly displaying a generic mutation warning.

Fence the response wire format/version and exact DRAFT_PREVIEW/STRUCTURALLY_VALID/NOT_APPROVED/UNVERIFIED/NONE, null model/revision IDs and all false persistence/publication/activation/path-generation/target-execution capabilities. Incompatible or authority-bearing envelopes and unexpected paths/coverage claims must not be rendered as an accepted result. This is defensive protocol admission, not a second expected-model validator. Render author text with ordinary React text nodes, never executable markup.

Show labelled states with initial/reachability annotations, transitions with action and expected observation, and retained terminal/unreachable diagnostics. A terminal state can be legitimate; no diagnostic is an approved exclusion. Do not equate a clean structural preview with PASS, target conformance, executed coverage or approval. The digest is a fingerprint of normalized input, not an approved/canonical revision. Semantic truth badges remain visible beside the result. Native details, labelled controls, table captions/column headers, keyboard actions, focusable bounded scrolling and small-screen containment are required. Full graphical editing and broad assistive-technology certification remain separate work.

Prior native preview/source-binding/history/run-handoff flows remain intact. Native records and current publication policy must be unchanged by this inspector. Actual runtime proof requires the existing isolated full-stack stack at the final source head, listed/ran selection, real native HTTP successes/refusals and desktop/mobile screenshot inspection. Route-injected network/service/hostile response failures establish browser recovery only, not independent evidence of a real production outage or server access policy. No independent assurance freeze can be self-issued from a passing implementation test.



## Revision 1.4.27 — inspector wire-format and layout proof clarification

C-15 admits only object-shaped JSON to the native POST transport. Invalid JSON, null, arrays and primitives remain in the editor with local errors; semantic fields, bounds and authority still use the one native validator. This avoids treating a pre-routing JSON/CORS transport failure as a typed model response. Mobile containment is measured after the existing sidebar reaches its chosen60px collapsed width; the strict overflow assertion and default timeout are unchanged. Independent assurance, full AT, persisted/graphical authoring and target-conformance gates remain open.


## Revision 1.4.28 — ASER shared state, identity, publication and recovery contracts

### ASER-C01 — One vocabulary and one owner per state

All ASER schemas are **proposed** until implemented and advertised through the existing project gateway. This section is the single contract owner for the following fields; repository views and UI labels map to it. A client encountering an unsupported schema/enum returns an explicit compatibility error, not a success or `no_detected_issue`.

ASER consistency enum: confirmed_conflict, unresolved_conflict, missing_link, stale_reference, unknown_source, not_applicable, no_detected_issue

| Field / value | Meaning and required consumer behavior |
| --- | --- |
| `confirmed_conflict` | A supported contradiction between identified revisions, with evidence and the applicable deterministic rule or accountable review decision. Correct the owning artifact; the analyzer cannot approve a replacement oracle. |
| `unresolved_conflict` | A suspected semantic disagreement needs an accountable review; it is not silently resolved by a model. |
| `missing_link` | A required relation is unresolved within the declared scope. `reason=missing_requirement` does not itself prove that code is invalid or that a requirement must be invented. |
| `stale_reference` | The relied-on revision differs from the current relevant source. Preserve both and require the affected reassessment. |
| `unknown_source` | `reason=unbound|unavailable|inaccessible|unsupported|unverified|scope_incomplete`; uncertainty and capability limitations remain distinguishable. Do not expose foreign identities/counts through the reason. |
| `not_applicable` | An evidence-backed applicability decision for this exact scope; not a fallback for failed retrieval. |
| `no_detected_issue` | No supported discrepancy in the declared examined scope. It is not exhaustive correctness, execution or release approval. |

Every analysis result also carries source/expectation revisions, assessed scope, unexamined scope, evidence class, rationale, checker/version, timestamp/freshness and next responsible review. Scope denominators must not leak inaccessible records. A denied or failed lookup is not an empty successful dataset.

**Activity evidence class:** `tesbo_observed|provider_attested|agent_reported|derived_inference|unobserved`. A Tesbo receipt proves the operation Tesbo witnessed (for example report submission), not the truth of every target action described in its payload. Agent claims about test execution retain their own evidence tier. `unobserved` represents a scoped observation gap, not an invented agent event. Preserve authenticated principal, credential kind and delegated actor separately.

**Domain assessment:** `applicability=change_required|unchanged|not_applicable|undetermined`; separately `workDisposition=active|blocked|deferred|resolved`. Assess all six engineering-record domains plus skills governance, even in the first slice. Each artifact points to its stable logical operation or native identity and exact revision, with the shared review/apply outcome. A domain is not forced into one approval state when it has mixed artifacts. Non-update decisions have reason/source; a deferral has owner, scope, review/due trigger and an independently authorized exception where one is needed. Unsupported required work blocks the relevant readiness claim; I8 sequencing does not waive it.

**Readiness:** `not_assessed|insufficient_evidence|blocked|ready_for_authorized_decision`. Keep `assessmentPhase=pre_deployment|post_deployment`, immutable decision receipt, deployment observation and verification separately. An approved pre-deployment decision needs the tested candidate and required evidence, not a future production observation. After deployment, acceptance needs the observed deployed build and required smoke/monitoring. `released_with_known_risks` is a derived label for an observed deployment and its approved nonempty risk set; a release with no recorded known risks uses the ordinary deployment label. Neither label guarantees defect-free behavior.

### ASER-C02 — Identity, cardinality and historical scope

`changeId` is the FR-115/T-455 `changesetId`; do not allocate a second packet identity. One changeset has one or more source revision references when applicable, zero or more observations, proposals, independent tasks/impacts and native attempts. A source-free policy/document change may have no Git revision with an explicit reason. One proposal can cover several domains using existing logical operations; one domain can have several proposals. Case/requirement candidates use logical target references until native apply resolves and records official IDs. A native Draft case is not an unpublished proposal.

A release candidate composes exact changeset/source/build/configuration/dependency references. Changesets and release candidates are many-to-many: a shared-library commit used by two releases does not share their approval or outcome. Policy effectivity, skill assignment and case approval are independently scoped decisions, not inherited packet approval. Trace edges retain source and target kind/ID/revision or exact attempt/occurrence, direction, project/scope, provenance, authority class and validity. No link to mutable `latest` substitutes for a relied-on revision.

**Typed relationship semantics:** FR-081/118 and T-426 remain the registry/projection owner; each native endpoint owner retains its content and decision authority. The meanings below are the admissible integration relationships, not permission to invent a new graph store or silently change an installed wire enum. Bind each meaning to the existing registry schema and migrations before exposure. Every edge has its own proposed/accepted/rejected/superseded decision history, separately from whether its pinned endpoints are current, stale, unavailable or revoked for current reliance. A changed endpoint can invalidate current applicability without erasing the historical link or silently accepting a successor.

| Meaning and direction | Cardinality and native authority | Required historical grain and limit |
| --- | --- | --- |
| Requirement criterion → covered by → case assertion/condition | Many-to-many; requirement, case and authorized mapping reviewers | Exact criterion and assertion/condition revisions plus mapping rationale. Designed coverage is not execution or a passing result. |
| Policy obligation → enforced by → guard/control; separately → checked by → test assertion | Many-to-many; policy, source/control and test owners | Approved obligation revision, source/guard revision and entrypoint scope; a check's actual attempt is separate. A policy citation alone proves neither enforcement nor verification. |
| Manual section → describes → requirement/behavior | Many-to-many; KB/manual and subject owners | Stable section identity or anchored content digest, audience and exact approved subject revision. A changed subject creates review work rather than rewriting the manual. |
| Authored revision → authored under → effective guidance resolution | One immutable operation resolution can contain many skill/assignment revisions; artifact and T-422 owners | Exact skill/assignment revisions, digests, resolved scope, actor class and outcome. Raw observations can truthfully use not_applicable; skill use never confers product authority. |
| Source/change observation → observed from → binding configuration and provider event/revision | Many-to-many with explicit deduplication; source/change owners | Stable binding ID and immutable configuration revision, repository/ref, event identity and evidence tier. Rebinding never relabels a past observation. |
| Human readiness decision → relied on → fixed evidence/build/risk context | One immutable context per decision, containing many scoped references; existing authorized decision owner | Exact candidate/build, obligations, attempt/evidence versions and accepted risks. New material evidence requires a new context; the link does not authorize deployment. |
| Finding occurrence → observed on → build/deployment; remediation → retested by → native attempt | Many-to-many; Bugs/findings and native execution owners | Occurrence, target and actual attempt identities, cause confidence and independent result. Task closure, a Bug link or current case status cannot substitute for retest proof. |
| Derived/redacted evidence → derived from → original file revision/object | Many-to-many; existing file/evidence owner | Immutable input/output digests, transformation and inspection status, custody and relevant attempt. A fixture, expected reference or derivative is not automatically observed execution evidence. |

Ordinary project-owned artifact links remain within the authorized project. A narrow exception permits **approved shared platform/workspace guidance through an authorized assignment/binding** under FR-106–113/T-422; it does not permit arbitrary cross-project links or access to private candidate/history payloads. Authorize endpoint existence/disclosure, edge metadata and payload independently. Revoked or unavailable shared guidance stops new effective reliance as applicable policy requires; retain only the historical references permitted by access/retention policy, without copying restricted content into a project. Read access to a redacted derivative likewise does not grant access to its confidential source. There is no universal `verified_by` edge that equates a planned mapping, a current Passed status and exact-build assertion proof.

Existing source bindings are currently one mutable row per project. Extend that owner with a stable binding identity and immutable configuration revision containing provider/repository identity, ref/scope, activation history and source fingerprint. Existing current-row storage may remain a pointer. Migration uses observed legacy metadata with declared provenance; unavailable historic configuration remains UNKNOWN. Never invent a historically verified binding or move history to the new repository after rebind. Delayed events must resolve their original binding/configuration, then be retained, quarantined or rejected under current permissions; they cannot advance an unrelated active binding. Deletion/rotation suspends current capture without erasing lawful historical references. Single-source pilots advertise that limit and cannot report a multi-repo release complete.

### ASER-C03 — Exact protected submission, decision and apply

1. Resolve current project/principal/capabilities, source/base revisions and applicable effective-method manifest. Authenticated identity includes machine versus independently authorized interactive human; issuer user ID alone is insufficient. Check P-18 before external MCP initialization/discovery/calls, on both aliases and cached sessions. Native read/governance remains independently usable when external MCP is OFF.
2. Submit immutable candidate snapshots to shared staging. Governed KB submission captures exact title/body/semantic metadata, references and attachment hashes, authority/applicability, base revision and skill/assignment manifest. This is an explicit boundary separate from coalesced autosave history. Later repairs create new candidate iterations; old submitted or accepted content never changes. Required CAS and transaction locks reject stale submission without losing the local draft.
3. A human decision binds exact logical operation/revision, payload digest, target, semantic dependency manifest and approval authority. Skill approval, activation/assignment, policy effectivity and release decisions remain distinct. Job labels, ownership of a machine token, caller `isHuman`/approval fields or a native AI tool running in an owner's session are not assent. Protected methods require server-owned action-bound review evidence, current authorization and replay/expiry controls; exact interactive proof/root recovery policy is an explicit implementation-admission gate.
4. Apply only selected approved dependency-closed operations, under one actual native transaction/client. Recheck current permissions, approval/base/dependency/skill revisions, plan locks, operation kind and target. Allocate official new IDs at apply; record logical-operation commitments and exact target mappings with the same mandatory audit/outbox transaction. Reject unsupported transaction participation before official writes. An audit failure rolls back this protected apply; do not broaden that requirement into an undocumented rewrite of unrelated legacy logging.
5. Preserve previous approved case and run snapshots until their valid transition. Current case eligibility requires a valid review of the exact semantic definition plus relevant dependency versions; generic create/update/bulk/clone/import/restore cannot set or inherit approval merely by status. New semantic edits cannot carry old approval to new meaning. An old run remains historical. Read back the actual selected run manifest; skipped missing/foreign entries are not performed coverage.
6. Raw reports/provider observations and evidence intake remain independent authorized observation operations. A revoked authoring skill blocks stale candidate promotion, not truthful authorized failure evidence. An observation receipt cannot publish a testcase, policy or official result. Result correction and Bug linking use their own native rules: associating a side finding must not change result, execution time or performer; any real correction needs an explicit, separately reviewed effect and immutable history.

### ASER-C04 — Partial staging, uncertain outcomes and controlled resume

A composite is an orchestration adapter over existing owners, never an arbitrary REST escape hatch. Its manifest fixes scope, payload digest, stable logical operation IDs, dependency graph and per-item base/skill revisions. Use existing `get_quality_context` for bounded authoring/change context and the T-422 `get_effective_testing_method` resolver for governing content. ASER names such as `get_project_authoring_context` and `resolve_effective_skills` are semantic aliases/profiles of these owners, not orders for duplicate tools or resolvers. Advertise actual versioned tool names and capabilities; the current 58 source declarations do not prove these proposed capabilities exist.

| Operation/event | Authoritative result and safe next step |
| --- | --- |
| New proposal command | Journal acceptance and each staging result under the existing proposal/operation owner. `committed|failed|not_attempted|uncertain` describes that item's attempted effect, not official approval. |
| Exact duplicate key + digest | Reauthorize access and return the same logical receipt identity plus its current journal revision/history. Do not silently execute additional items. Original attempts and actor attribution remain immutable. |
| Same key, different payload | Conflict with no overwrite. An amended proposal is a new revision/command referencing the same relevant logical operation; it is not permission to recreate an already committed target. |
| Lost response / `uncertain` item | Read back the native operation commitment/provider receipt before retry. If outcome cannot be established, retain uncertainty and route to reconciliation; do not guess failure. |
| Explicit resume | Requires original command/manifest identity, expected journal revision, a new resume-attempt ID and eligible failed/not-attempted items. Recheck permissions, dependencies, source and skill context. Do not replay committed operations. |
| Changed remaining intent, base or required skill | Preserve earlier commitments; create/review the necessary new candidate revision. New key does not erase the old logical-operation commitment. Reconcile dependencies using exact prior target mappings. |
| Cancellation / expiry / withdrawal | Stop not-yet-committed eligible work at the actual owner. Record who/why; do not pretend an external action was undone. Preserve committed records, observations and residual obligations. |
| Native protected publication | All selected official mutations, commitments and mandatory audit succeed atomically or none do. Partial candidate staging never weakens P-07. |
| External handoff or notification | Outbox + provider/native receipt + bounded retries/dead-letter/reconciliation. Queued/read/zero-row return is not delivered, assessed or verified. Compensating semantic changes require a new authorized operation; do not undo unrelated accepted work. |

Every mutation reauthorizes at the final owner, including resume and long-running jobs. The idempotency namespace is project/operation and scoped receipt access; permission to guess another key never grants access to its record. Stable workflow operation IDs allow an authorized handoff without changing original actor provenance.

### ASER-C05 — Derived coordination and completion

`coordinationState=open|review_required|blocked|settled|cancelled|superseded` is a **derived view**, computed from existing change events, seven domain assessments, logical operations, impact/work obligations and explicit terminal decisions. It is not independently settable through MCP, UI, a task close or a graph capture.

| Condition / transition | Derived behavior and what does not follow |
| --- | --- |
| New or changed scope; assessment incomplete | `open`; missing/unknown domain scope remains visible. |
| Coherent candidates awaiting human decisions | `review_required`; per-item mixed decisions remain visible. |
| A required unresolved conflict, unavailable dependency, uncertain mutation or unhandled obligation | `blocked`, with owner/recovery reason. No aggregate success hides it. |
| Every domain assessed; each relevant operation applied, rejected, cancelled, superseded or otherwise terminal under the native contract; residual work resolved or validly deferred | `settled` for coordination. Rejected-only work can settle without publishing anything. Disclosed deferral never satisfies an unmet mandatory release requirement. QA verification, policy effectivity and release decision remain independent. |
| Explicit cancellation or supersession | Derived `cancelled`/`superseded` only from the changeset owner's attributable terminal event/lineage. Existing official artifacts and unfulfilled independent impacts are preserved. |
| Reopen / new evidence / source or authority change | Append the new event/revision to the same correct owner and recompute affected scope; preserve the prior settlement/decision snapshot. A new unrelated release has its own context. |

Precedence for an active view is blocked → review_required → open → settled; an explicit terminal cancellation/supersession is shown with surviving obligations, never as a green release. Persist a revision/freshness fingerprint of the **inputs** for reproducibility, not a second authored answer.

### ASER-C06 — Readers, privacy, errors and resource limits

Apply the shared visibility and instruction-authority contract to direct/list/history/search, RAG keyword/vector retrieval, recent/folder context, Zyra fallback snapshots, graph traversal, notifications, exports/public sharing, generated summaries and caches. An authorized candidate can be returned as data with server-owned candidate status; only the exact approved active resolved manifest is governing instruction. Current ordinary KB read semantics do not prove the future finer disclosure policy. Cache by authenticated scope/role/context and binding revisions; reauthorize and invalidate on membership/assignment/source changes. Required inaccessible evidence yields a permission-safe incomplete/unknown assessment, not zero or N/A.

Every existing writer/reader must have an owner, contract, legacy disposition and discriminating proof before its new governed capability is exposed. Do not retrofit fictitious approval/skill/source pins into old records. Maintain explicit capability versions and fail safely for unsupported clients. Pending uploads, quarantined/unavailable bytes, source fetch failures, expired leases and resolver outages remain distinct from successful empty results or completed work.

Before an implementation slice ships, its existing task must record and test the resource envelope: supported workload and concurrency; payload/archive expansion/file limits; dependency depth/fanout; pagination and source scan bounds; queue/retry/dead-letter age; timeout/cancellation; retention/holds; measured latency/error budgets; and recovery responsibility. Reuse applicable existing evidence limits and platform controls. Numeric SLOs are not invented by this review; absent approved limits block the affected deployment. Imported scripts/resources are inert by default, safely rendered, path/size/network constrained, and cannot grant tool or network authority through skill text.

## Revision 1.4.29 — bounded graph-analysis and method-feedback contract

**Proposed extension of ASER-C01–06, existing graph/Model Studio/native authoring and T-422 contracts.** This section does not announce a new tool name, endpoint, installed enum or deployed capability. The implementation task must map each obligation to actual versioned native operations and advertised capabilities. A client must not invent or fall back to a less protected route when the required operation is unavailable.

### Read and analysis input

The server binds an analysis to its authenticated principal and project/scope, request intent and task mode, a bounded authorized context manifest, canonical source/model/case revisions, known target build/environment where relevant, independent expected-behavior authority, effective method/assignment versions and digests, actual tool/parser capabilities, and approved resource limits. The server—not skill text or user-supplied node metadata—determines authorization and governing instruction status. Required graph/model/code fields are mode-dependent: a valid requirement-only manual-design request must not fail because it has no Git commit or model ID. Unknown facts remain explicit.

The context manifest records which relevant sources were retrieved, their versions/provenance and incomplete/unsupported/stale portions. Do not represent a sampled subgraph as the entire project. Enforce ACLs before retrieval and again at affected tool/native operations; partition and invalidate caches by principal/scope and material source/assignment revisions. A permitted derived explanation must not disclose forbidden endpoint existence, metadata, counts or content. Rebinding or revocation does not mutate original histories or grant new access to their payloads.

### Structured proposal and native mutation boundary

Return an attributed proposal containing the user outcome, supported interpretations, accepted normative references, separate hypothesis relationships, contradictions/missing facts, relevant actors/states/data and consequences, existing-case/model matches, proposed changes and why, execution feasibility, original input/method/model provenance, resource use and any truncation. Use ASER-C01's distinct applicability, work disposition and operation state; do not create another writable overall completion flag or equate successful inference with complete assurance.

Validate referenced identities and revisions against permitted canonical owners. Valid syntax or a high confidence number does not make a proposed edge accepted, an expectation authoritative or an observation verified. Unsupported or unverifiable references stay explicitly untrusted or are rejected at the contract boundary. Source/doc/graph content is data; embedded instructions cannot expand the tool scope, load scripts, alter source selection or override governance.

Analysis is read-only until an explicitly authorized proposal submission. Case, model, relationship and method changes use existing shared staging and each native owner's authority. Apply ASER-C03 exact revision/decision/dependency checks and atomic selected publication; preserve stable logical operation IDs, receipts and ASER-C04 resume. Revalidate applicable grants, effective required methods and dependencies before authored submission or promotion. A method update cannot silently change an accepted case/model/run or retroactively revise an expected oracle. Independently authorized raw events, failures and genuine manual observations retain their own ingestion grants when a required authoring method is unavailable.

### Feedback, evaluation and activation

Feedback records the original candidate/attempt/revision, attributed correction or acceptance/rejection reason, supporting evidence, scope, source access and classification at the existing feedback/work/review owner. Duplicate observations must not inflate the evidence for promotion. Proposed method successors are immutable candidates with change rationale and provenance; a local fact correction must not be propagated as a universal rule. Evaluation binds baseline/candidate, independent cases and oracles, model/configuration and data snapshots, metrics and unresolved uncertainty. A candidate cannot set its own acceptance threshold or supply the sole gold labels.

Approval of a method and activation/assignment are separate human-authorized operations under T-422. Use exact version and assignment CAS; reject stale/unauthorized promotion and retain a truthful audit. Rollback changes effective reliance through the same authorized mechanism, never old contents, observations or results. Prevent private cross-project feedback from entering a shared method without approved generalization and disclosure controls. Analysis/evaluation scripts and network access need separate actual capabilities and authority.

### Failure, resources and evidence grade

Apply existing ASER-C06 resource, cancellation, timeout, queue, retention and disclosure controls to retrieval, expansion, inference and optional active probing. An approved numeric envelope is an implementation prerequisite; missing values do not authorize unbounded work. Exhaustion returns a partial or blocked affected assessment with preserved completed receipts, not a zero-impact/no-defect conclusion. Reauthorization after asynchronous delay is mandatory. Running a model means only its evidenced native operation; dispatch is not a target assertion. Human testimony, agent self-report, witnessed automation and retrievable bytes retain their distinct provenance and practical limits.


## Revision 1.4.31 — graph contracts and assurance findings

Extend existing graph, Model Studio and Skill operations. Return selected revision, active assignment generation, source generation/cursor/extraction profile where applicable, comparable-scope status, evidence-stage and bounded coverage counts. Existing readers return authorized policy and manual object/version handles and typed relationship provenance. Unknown scope, inactive guidance and historical results remain distinguishable.

Enforce permitted purpose and recipient before sending data to tool, provider or evaluator, including telemetry; minimize and redact. Recheck source and derived-output access during async processing, readback and promotion. On evidence loss, prevent rehydration, retain permitted historical receipts, and hold current reliance unless re-evaluated with authorized evidence. Approved bundled references cannot confer instructions or authority.

An executor lease fences Tesbo writes, not external effects. If a dispatched target mutation may have happened, use approved target readback or a target idempotency key to reconcile before retry. Without that capability retain UNKNOWN and require authorized disposition before another mutating attempt.


## Revision 1.4.32 — Graph Analytics

Graph Analytics clients reuse authorized graph and reporting readers or extend their typed responses where necessary. Bind every row and drill-down to project, comparison or evidence scope, source revisions, freshness, evidence stage and relationship provenance. Return permitted record handles and status for unsupported or partial results. Pagination and aggregate counts obey the same authorization as details. Retest drafts use existing native proposal and review contracts.


## Revision 1.4.33 — Graph Analytics assurance amendments

Readers authorize the projection before traversal, deduplication, ranking, counts or AI context. Restricted material must not affect visible facets, ranks, paths, placeholders, cursors, snippets or signals. Pin an opaque snapshot and cursor to principal/project, filter, exact comparison/revisions, source generation, extraction/ranking versions and evidence cohort. List, counts, details and actions share that scope. Reauthorize each access. Permit old snapshots only while access remains valid and show them as historical; otherwise invalidate and require explicit refresh. Fence late responses on route, access or snapshot change.

Return each finding's permitted citations, effective authority, edge direction/class, uncertainty and observation vs hypothesis. AI explanations bind citations, expected-model revision where applicable, runtime model and Skill assignment generation; recheck access/purpose before provider submission, result delivery and reuse. Keep imported content inert. Reject obsolete explanations as current.

Bind native handoff to finding, snapshot, impact ID when present, action, case/oracle revision, build/environment and any genuine prior receipt. Recheck terms and permission at stage, readback and submission. Stale inputs require explicit reselection; recover a lost committed response from the existing idempotent receipt path. A handoff cannot dispatch or close an impact implicitly.

## Revision 1.4.34 — source convergence and method-adoption reconciliation

### Source-convergence boundary for existing operations

The inspected model approval, path-to-case, model-run and source-binding operations are existing interfaces with narrower guarantees, not implementations of every proposed ASER-C contract. Apply the canonical 03 convergence plan below the UI/REST/MCP/native-AI entry points: trusted actual principal and exact human assent; independent source entitlement; shared unpublished staging; one actual native transaction for selected effects, mandatory provenance, commitment and audit; authoritative uncertain-outcome readback; family-owned current selection; exact versioned mapping/removal history. A wrapper transaction around a separately committing writer does not satisfy atomicity. No new endpoint/tool is declared by this clarification, and an old client must not fall back to latest, fabricated success or a permissive writer when a required contract is unavailable. Historical unknowns remain truthful. Canonical 05 records required allowed/denied/fault/race proofs; all are unexecuted here.

### Context and output-profile admission for the existing method resolver

Extend the single T-422 semantic read operation and its aliases; do not infer a second tool or installed endpoint from this contract. Its versioned request/response must distinguish authoring operation, artifact family/subtype, execution mode, interface facets, quality concerns, audience and relevant target capabilities. Values come from an advertised, approved profile with documented cardinality; unknown, unsupported, absent and not applicable have distinct meanings. Target facts and caller hints cannot grant Tesbo permissions. Security-relevant project/principal/assignment facts are independently resolved by the service.

The profile must define matching across simultaneous facets, explicit wildcard scope, required versus optional methods, stable composition order, dependency/version compatibility and bounded resource limits. A missing required facet cannot silently match nothing or weaken a mandatory protection. Unknown optional context may yield a disclosed partial analysis where the underlying operation permits it. Incompatible or unresolved required composition blocks the affected governed write with the existing typed conflict/unavailable result; authorized candidate inspection and original raw evidence retain their separate grants. Free-text semantic consistency that cannot be decided remains REVIEW REQUIRED rather than a false mechanical pass.

Return the exact interpreted context/profile version, effective method and assignment revisions/digests, matched and unresolved applicability, composition order and output-adapter identity in the existing usage manifest. Revalidate the relevant current heads and authority at protected writes. Approving a method does not activate it; a CURRENT model selection does not itself assign a Skill; an authorized historical request pins its actual historical basis rather than silently switching to current. Cross-facet and CURRENT/HISTORICAL behavior must be equivalent through every exposed alias and native consumer.

The output adapter must validate the native artifact kind and lifecycle before staging or applying a proposal. Explicitly separate definition status from execution outcome and preserve step-local expected results, original identities, accepted revisions and actual attempts. Unsupported classifications require a declared mapping or an honest unresolved result, never a guessed enum conversion. The exact wire schema/profile and mapping remain implementation-admission deliverables; these behavior obligations are not a claim of a deployed API.


## Revision 1.4.35 — Graph Analytics review closure contracts

Pin each comparison side's effective instant and governing authority revisions independently of source generation. For historical replay use its declared as-of scope; for current reliance, applicable authority expiry or supersession invalidates affected results and handoffs even without recapture. A no-impact status requires available, comparable and fresh authorized inputs, resolved governing applicability and a justified assessed frontier with no detected impact. Otherwise report incomplete, stale, incomparable or unresolved as appropriate.

Keep absent and private proof indistinguishable within a projection. Report incomplete only from an independently authorized limitation. Hidden-only rebuilds must leave authorized cursor behavior, freshness, rank, facets, counts, snippets and deep links equivalent. Enforce actual permission loss on subsequent reads, late AI delivery, reuse and handoff; discard obsolete visible content. Pin exact selected native impact ID, eligible case/oracle/model where applicable, source, build, environment and genuine prior receipt where required. Identical operation-key replay returns the same committed receipt; a changed payload under the same key conflicts. No implicit run, acknowledgment or closure.


## Revision 1.4.36 — concurrent-source reconciliation and independent assurance

This amendment preserves the complete incoming published 1.4.35 canonical bodies, including portability and Graph Analytics closure contracts, and reconciles the separately reviewed GEX corrections through v11. Earlier receipts bind their exact inputs; final integration requires its own target-bound receipt. The same eight files remain canonical; repository views remain subordinate. The newest explicit qualifications below govern overlapping older shorthand. Source inspection remains pinned to `1alextest/Tesbooboo@6897f989b055a955280f810c7daace86f74057fa`; other open PRs and this proposal do not establish current deployment. Exact current-target review receipts, actual method versions and remaining gates belong to GEX-ASER-2026-11-19. The package remains NOT FROZEN.

### Source-convergence boundary for existing operations

The inspected model approval, path-to-case, model-run and source-binding operations are existing interfaces with narrower guarantees, not implementations of every proposed ASER-C contract. Apply the canonical 03 convergence plan below the UI/REST/MCP/native-AI entry points: trusted actual principal and exact human assent; independent source entitlement; shared unpublished staging; one actual native transaction for selected effects, mandatory provenance, commitment and audit; authoritative uncertain-outcome readback; family-owned current selection; exact versioned mapping/removal history. A wrapper transaction around a separately committing writer does not satisfy atomicity. No new endpoint/tool is declared by this clarification, and an old client must not fall back to latest, fabricated success or a permissive writer when a required contract is unavailable. Historical unknowns remain truthful. Canonical 05 records required allowed/denied/fault/race proofs; all are unexecuted here.


**Selection and analytical scope qualification:** The 1.4.31 sentence about model dispatch selecting an active revision applies to **CURRENT** applicability only. Model applicability/CAS generation and T-422 effective Skill assignment generation belong to distinct native owners. Authorized Draft inspection/preview and explicit HISTORICAL selection retain MBT-C02's selected revision, consent, retirement, mapping and permission rules; neither owner silently substitutes for the other. Current-generation checks do not discard legitimate historical work. The initial Graph Analytics Reports slice is Change impact and Coverage gaps. Later diagnosis/stability and optional prediction remain separately gated capabilities, not implied initial UI features. Insufficient or unqualified evidence requires abstention from quantitative defect probability; qualitative hypotheses, explicitly uncalibrated relative heuristics and deterministic/manual prioritization may remain informative without probability or coverage claims. Calling a result advisory does not waive evidence admission.


### Graph finding handoff and legitimate prepared Runs

The 1.4.33 phrase “Only explicit authorized native dispatch creates a run” prohibits **implicit** Run creation from viewing/staging a finding; it does not remove the retained native preparation workflow. Viewing a finding or staging an analysis/case proposal creates no Run and dispatches no target work. Explicitly authorized native create/choose-Run, attach-case, accepted model-link and dispatch stages remain available under their existing contracts, including a legitimate prepared Run committed before dispatch. Preserve each stage's persisted/blocked/not-attempted receipt and truthful PARTIAL outcome under MBT-AC-37; do not fabricate a preceding task, report or attempt for a graph-only finding.

The existing `run_behavior_model` operation may create a native Run as its own explicitly requested protected operation. That operation's required native effect, model manifest, provenance and audit still share the actual native transaction. Separately authorized preparation stages are not one fictitious cross-operation transaction. Dispatch remains distinct from target execution, evidence and FR-119 acknowledgment/closure.

Acceptance must discriminate viewing/staging with no Run side effect, authorized native creation yielding a prepared Run before dispatch, reuse/choose of an existing eligible Run, later-stage failure with accurate PARTIAL receipts, and the atomic Run-plus-manifest failure path of `run_behavior_model`. Preserve project, permission, case/oracle revision, snapshot, cohort and genuine-prior-receipt checks at the applicable native boundary. These variants extend the retained GA-AC-01 / MBT-AC-37 / ASE-INT transaction proofs; they are NOT RUN and add no new scenario ID.


**Final authority and evidence reconciliation:** Revision 1.4.35 retains both the published portability assessment and this separate GEX-ASER run without pooling their members, trials or verdicts. The 1.4.34 chapter's characterization of GEX-SEM/GEX-DISC as noncanonical proposals describes that predecessor. In this reconciliation their substantive assertions are allocated to existing canonical proof owners by the explicit tables above/in canonical05; their labels remain supplementary aliases, not new canonical definitions or executed tests. Eight GEX-AC obligations, five current GA-AC checks and 125 ASER definitions retain separate accounting. The current/historical/Skill-assignment and prepared-Run qualifications in this reconciliation control older conflicting shorthand. Imported method conventions are scoped through the existing resolver and native lifecycle. No original method body is installed or activated, and the earlier two-brief experiment does not qualify the changed discovery method or imported-method profile.


**Current36 integration boundary:** The published35 Graph Analytics closure contracts are preserved and govern mixed model/policy/requirement obligation scope, distinct evidence sufficiency and observed PASS/FAIL, per-impact actions, total ranking, authorized-visible snapshot identity and current-authority rollover. Their new fixtures extend the same five GA-AC checks and remain NOT RUN. The DMIS approval-to-posting workflow is the named pilot context, not a universal actor/schema/method or a claimed live test. The incoming short source-checkout claim belongs to its separate review; this run's inspected source remains6897 and its delivery parent is1fe. Earlier current-state statements are historical when this latest explicit qualification differs. This chapter preserves the independently reviewed CURRENT/HISTORICAL, separate Skill assignment, prepared-Run and source-status qualifications above. No empirical benefit, deployment, activation or implementation acceptance is inherited.


## Revision 1.4.37 — Graph Analytics review resolution

Initial Graph Analytics entry uses authorized native human project sessions. Existing read-only API tokens receive no graph metadata under AC-092; later credentialed surfaces require explicit grant contracts. Bind cursors, caches and receipts to effective grant and authorized visible scope. Internal index identity never directly governs visible cursor expiry. A hidden-only update preserves continuation and visible freshness. Authorized visible changes preserve a clearly pinned historical view if still allowed, or require explicit refresh. Permission loss invalidates subsequent access. Recheck at deferred delivery for both AI and native attachment reads.

Use the native handoff write owner for an atomic operation commitment and final authority check. Scope key to project, effective principal/grant, action and operation identity, with immutable canonical input fingerprint and authorized receipt retention. Simultaneous exact requests converge on one commitment; changed payload conflicts. Revoked authority before commitment yields no effect. Lost/expired receipts require authorized readback or explicit unresolved outcome before retry. These rules also apply to model-free handoffs. No implicit dispatch or impact disposition.

Historical replay defaults to the recorded decision and its knowledge cutoff. Authorized retrospective recomputation is labeled separately and pins later corrections plus original effective scope; neither silently becomes current reliance.

## Revision 1.4.38 — transport convergence without new authority

The existing ASER-C01–06, MBT current/historical selection and source-binding contracts own these refinements; no new public tool is declared by this amendment. A governed operation resolves the current applicable approved model or method at its native owner, retains the selected revision/assignment generation and rechecks it at the protected effect. Save, approve and activate remain separate authorized actions. Compatibility handling is explicit: an older client cannot silently reinterpret newest-saved as activated, drop a required revision, or convert ambiguous legacy history into permission.

Source configuration and capture/finalization validate the current destination actor and entitlement to the selected source, including after waits or changed bindings. Registry membership and a user-supplied repository identifier are not source grants. Readback, projections, caches and failure messages preserve scope and avoid restricted metadata disclosure. A legitimate globally shared-source policy must be an evidenced server-side authorization rule, not an inferred fallback.

The existing feedback/candidate operation retains the exact input/output references, correction text/reason, real principal and allowed audience independently of optional regeneration. Generated successors receive distinct attributable revisions; unavailable matching or evidence is explicit. Native selected Draft publication and model Run preparation retain the same required transaction and review ownership. Current PR #167 source improvements do not establish the full action-bound human approval or machine-origin provenance contract; bearer classification alone is insufficient.


### Semantic interpretation within the existing analysis contract

Under the existing read/context/analysis profiles and ASER-C01–06, semantic claims retain exact permitted Policy/Manual/Requirement/source IDs, versions, audience/effective scope, cited spans or paths, authority/trust class and uncertainty. Grounded direct/transitive consequences, hypotheses, blocked/unknown and unrelated results remain distinguishable. A manual revision may change guidance without changing a binding rule. A policy/manual-only change is a valid analysis trigger without a Git commit. Root-cause, flakiness and risk rankings remain qualified hypotheses until their respective evidence contracts are met. Graph retrieval cannot promote a source's authority, infer complete coverage or grant mutation rights; any proposed update reuses native staging, review and selected apply. This extends payload meaning under the existing owners, not a new tool or installed endpoint claim.


**ASER-C04 native-owner binding:** The logical-operation/intent and unknown-outcome rules include native Run creation reached through adopted graph/model/review workflows. Carry the same operation identity through the actual mutation owner and protected effect; transport or UI retries cannot turn an unacknowledged success into a second effect. A user's checklist confirmation is not authoritative absence evidence. Reconciliation may return the committed receipt, a deterministic conflict or an explicit unresolved state; a deliberate later new intent is allowed and retains separate lineage.


**Concurrent recovery state:** A browser or process recovery journal is contextual evidence, not a native Run or server idempotency receipt. It must not silently lose an unresolved potentially committed request through another tab's admission or cleanup. Preserve intent identity and explicit resolution, or fence admission before the target effect. Where an operation intentionally offers no automatic retry, its supported reconciliation/pause outcome must remain truthful; do not claim idempotency from a client-side flag.


**Current applicability and final authority:** Generated-from provenance is historical lineage, not automatic proof that a materially changed case still tests the same model elements. Current governed selection resolves the declared accepted semantic relation; historical attempts retain their original basis. For link/unlink and equivalent protected relation writes, revalidate the relevant current authority after serialization waits at the native mutation boundary and retain its enforcement through commit. A preflight token/session/project check does not settle a later revocation race.

### Current continuation checkpoint — revision 1.4.38

The current canonical parent is the saved eight-file v1.4.37 archive, version 17, SHA-256 `1ed8afd0a978ab9b257c10d61549f6085c7f1f593713a26b0ae56a4540562848`. Preserve all v1.4.35–37 Graph Analytics amendments, including the separate applicability/evidence/outcome/impact axes, bounded frontier witness, mixed governing obligations, permission-safe visible snapshots, native operation receipts and source-index convergence. The pilot is a synthetic DMIS approval-to-posting fixture; it establishes neither a universal application schema nor live DMIS testing.

PR168 and PR167 were merged externally as `f43013473b3a8b725bb547187e21b4459d0e8838` and `1fe100588be6c3a1627ee39a4b0bbc1c0d9da2ea`. This continuation performed neither merge. Its repository-view parent is open draft PR169 at `bddd97971637a54c6e2aff9e7686cfb9c9f25d8e`, based on that merged development commit. The later PR169 head `c07d4c2a16912ca71fbc319aec9a23e68a452edd` adds only a separate executable-preflight review record; all six view bytes remain bddd-identical. Preserve that record and its distinct candidate/executor limits; it is not another role receipt or a verdict on this continuation’s independently pinned reviews. Statements in preserved incoming review chapters about their own source6897 inspection retain that historical scope. This continuation independently inspected source419 and compared full trees through e3d0, b07 and merged1fe: no backend changes across those intervals; b07→1fe changes only ten documentation blobs and no frontend blobs. Thus the qualified source findings in §18.2.1 of canonical03 remain applicable at that merge checkpoint. This is source continuity, not deployment, runtime or acceptance certification. The separately observed b07 CI results retain their exact executed-test scope.

Retain 125 unique scoped ASER definitions, eight supplemental GEX-AC obligations and five unique GA-AC IDs. The five GA IDs carry fifteen cumulative table rows from revisions33/35/37; later fixtures extend the same checks, without adding ten test identities or erasing earlier assertions. Repeated GEX-SEM-01..08 allocations are cumulative fixture/proof-owner contributions to the same eight aliases. Apply the union of their stated assertions and existing owner allocations; they are not competing definitions or alternative authorities. SK-E2E-41..44 and GEX-DISC-01..05 likewise remain mapped aliases. All new product acceptance outcomes remain NOT RUN. Original cold receipts remain unchanged; later target-specific reconciliation is explicitly informed. The package is PROPOSED / NOT FROZEN.

### Equivalence decision owner qualification — revision 1.4.38

The retained revision1.4.37 phrase “existing Change Packet adjudication owner” denotes the existing shared native review/apply path under FR-027–037 and the authoritative Requirements, Policy or Model record owners for the exact selected decision. A Change Packet remains a derived projection under R-ASE-01 and ASER-C02; it owns no approval authority, authoritative equivalence store or independent persistence lifecycle. Only an explicitly permitted human decision, bound to the exact governing revisions, scope and authority, can establish reviewed equivalence. Use the existing owner’s version/evidence/audit services and selected native operation. Withdrawal or supersession invalidates affected current projections and handoffs while retaining the original historical decision and receipts. Neither inferred similarity nor a report action transfers authority between linked records.


## Revision 1.4.39 — module guidance and context ownership

Extend the existing R-ASE-25/26/30, ASER-C02 and governed native authoring contracts; this amendment defines no new tool names or parallel transport. Existing effective-guidance reads resolve the authorized shared core, relevant module/subtype, compatible project adapter/output profile and their exact assigned versions/digests under the current capability schema. They must keep authoring authority distinct from project requirement/policy/configuration references. A client cannot substitute a user-supplied profile or readable candidate for an effective assignment.

Both native Copilot and external MCP authoring use the same resolved basis and native proposal/review/apply path. At the applicable write boundaries revalidate scope, authenticated actor, artifact base revision and effective assignments. Preserve a stale candidate for explicit reconciliation; reject an unauthorized effective-version change or protected publication through any writer. A profile-specific field validation result cannot approve semantic content, claim target execution or reset a prior result. Missing required authoring context blocks the governed action according to existing policy while independently authorized raw evidence intake remains available.

Return actionable existing validation/conflict diagnostics identifying the permitted affected field/source reference and next decision. Do not leak inaccessible sources, invent new status enums, claim all semantic mistakes can be mechanically rejected or silently coerce one project's case format into another. Definition state, execution outcome, approval and exported presentation retain their separate contracts. Exact version/digest/source lineage is persisted by the native owner with the accepted operation, not inferred later from an agent's claim that it read a standard.

## Revision 1.4.46 — Skill evaluation and usage evidence at existing contract owners

**PROPOSED / NOT FROZEN — 26 November 2026.** This amendment refines T-422/D-14, FR-124, ASER-C01–06 and the existing task, proposal, native execution, feedback and evidence contracts. It introduces no public endpoint, installed tool, new credential permission, evaluation result or Skill assignment. Canonical 03 owns technical design, canonical 05 owns proof allocation, and canonical 07 owns interaction acceptance. The [Zyra QA harness options](ZYRA_QA_HARNESS_OPTIONS.md) remain independently selectable experiments.

### Current source fit and advertised capability

Source inspected at `b28c17386ecc2e88f550b3c4a641143ede339255` supplies the following reuse points. Source inspection does not establish deployment, enablement or an integrated behavioral evaluation workflow.

| Existing owner | Current source evidence | Required contract refinement |
| --- | --- | --- |
| Project MCP gateway and staging | `src/mcp/mcp.service.ts` binds catalogs to supported tools, client grants and instructions. `mcp.tools.ts` exposes native case/requirement staging and explicitly qualifies decision-discovery guidance as guidance. | Keep versioned discovery and native authorization. An evaluation capability must be advertised only after its complete native reader/writer path is implemented. A tool description cannot certify that an agent investigated or applied a method. |
| Governed Skill/native document versions | `src/skills/skills-governance.ts` resolves assigned approved version references and digests; native Skills/version readers provide exact saved content. | Bind the trial to those identities. Candidate trial selection must not alter the effective assignment or substitute readable candidate content for current governing instructions. |
| Zyra observation and trace | `src/observability/langfuse.ts`, `src/observability/ai-trace.ts` and `src/legacy/zyra-turn-trace.ts` already provide opt-in destination-gated tracing and best-effort, bounded turn-stage records. | Extend appropriate correlation and evidence coverage instead of introducing another telemetry service. Existing trace inputs can contain message text; they are not evidence of a metadata-only policy. Preserve that source fact and apply the disclosure contract below to new usage events and approved detailed traces separately. |
| Native Task/review and Run/evidence | Existing task/proposal readers, selected human Save, automation attempt/result ingestion and attachment handling own their respective effects. | Retain these identities and native state vocabularies. A recorded comparison, source replay or task completion cannot become a native execution, published case or proof of a target assertion. |

The portable intent is an accountable method contract: goal, applicability, required outputs, required/forbidden observable effects, permissible alternatives, supported client capabilities and recovery. Any later compiled client/model form retains its parent version/digest, transformation/version and limitations. It must demonstrate semantic conformance before the native owner offers it. Compiling a document, installing a package and executing an approved method are separate facts. Current or future Uber internal tooling is a design reference, not an available Tesbo adapter.

### Comparison binding through the existing task and evidence owners

The following are logical obligations on existing versioned records, not a new wire schema. Select concrete supported fields/adapters during implementation and advertise compatibility before use.

| Binding | Minimum information and admission rule |
| --- | --- |
| Trial intent and inventory | Existing project/task and assessed Skill identity; exact independent expectation/criterion and rubric versions; frozen eligible task/fixture inventory, repetitions, arm assignment, predeclared primary measure, critical-error rule, resource ceiling and accountable adjudicator. Retain an authorized manifest or its permitted digest rather than publishing hidden labels to the subject. |
| Compared methods | Exact active/candidate Skill versions, assignment generation, composed dependencies and output profile; all common mandatory governance remains enforced. Record which optional component or wording changed. An authorized without-optional-Skill control is distinct from disabling a required method. An unsafe or unsupported baseline is unavailable, not an instruction to bypass the production guard. |
| Actual subject and environment | Verified member/service and originating client/grant, task/attempt, actual runtime/model identifier and observable configuration, tool grants, input/source digests, fixture/build/environment and reset observation where applicable. Unknown model revision, nondeterministic settings or unavailable client instrumentation qualify attribution; a direct model call does not establish conformance of an MCP client. |
| Actual trial artifacts | Distinct repetition/attempt identities, immutable input/output evidence references and digests, observable tool-action records where authorized, independent state/readback, actual timing/usage and stopping reason. Use a native Run only for work actually executed through that owner; an offline or source-only assessment keeps its actual method and evidence class. |
| Adjudication | Independent human-annotated expectation, grader/rubric/version and provenance, authorized visible evidence, per-dimension judgment, disagreement and any subsequent correction. The subject cannot overwrite its labels or grade; an LLM judge is not sole authority for a protected decision. Record genuinely underdetermined expectations separately from missing evidence that prevents grading. |

Compare active versus candidate **within each supported client** on equivalent authorized inputs. Include repeated unchanged-version controls to expose ordinary variation, and optional removal/shortening controls only where authorized. Hold task, evidence, grants, budgets and independent grading constant where possible; disclose differences and pairing failures. Do not pool incomparable clients, roles, tasks or configurations into an unqualified superiority claim. Later model-specific phrasing or canary assignment is a separate optional experiment with its own native authorization; neither is implied by approving this specification.

### Observable process, results and effect are distinct evidence

Apply ASER-C01's existing activity evidence classes to every relevant assertion. A catalog entry proves availability; an authorized exact-content receipt proves what Tesbo delivered; controlled generation input can establish what entered that generation; a bounded external attestation remains reported. None alone proves that the model understood, followed or benefited from the Skill. Missing events, disabled tracing, truncation or telemetry loss cannot prove non-use or absence of an attempted action.

Grade independently: (1) requested outcome and independently observed state, (2) supported observable process obligations and legitimate alternative sequences, and (3) attempted prohibited actions plus actual effects. A guard that prevents a prohibited attempt can preserve final state while the subject still violates its permitted procedure. Conversely, correctly identifying an unresolved expectation or refusing an unauthorized action can satisfy the independent rubric. A missed observation is not automatically a product failure or a successful abstention. Do not require private chain-of-thought, reconstruct hidden reasoning from narration, or make an exact tool sequence mandatory unless that sequence itself is an established obligation.

Each comparison reports assigned, attempted, graded-correct, graded-incorrect and ungraded counts by relevant arm/cohort, with safe reasons for unavailable, failed, cancelled or unsupported work. Show correct/graded, graded/assigned and correct/assigned together, all with numerators and denominators; zero denominator is undefined. Preserve critical misses, false approvals, false blocks, unresolved disagreements and repeated-trial variability. Exact duplicate delivery cannot add a trial, and a retry never erases an earlier failure or unknown. A predeclared authorized exclusion retains its reason and symmetric comparison treatment. No all-purpose quality score or high conditional pass rate grants promotion authority.

### Usage telemetry, cost and friction reporting

Routine Skill usage events contain only approved, bounded non-secret metadata: permitted opaque correlation references, exact Skill/assignment versions, actual client/runtime classification, event kind/time, supported outcome/error category, duration and usage provenance. Exclude raw prompt/output/document/file contents, credentials, headers and free-form error bodies. Do not use individual member or source identifiers as unbounded metric labels. Detailed diagnostic traces, source artifacts and grader evidence remain separately permissioned under their native owners with explicit destination, purpose, retention and redaction controls. An ordinary usage counter never implies permission to copy its underlying content to a tracing provider. Current message-bearing trace behavior requires explicit privacy reconciliation before expansion; masking known key patterns alone cannot establish this contract.

Record observed provider usage/cost separately from estimates, rate-table assumptions and unavailable fields. Preserve units, currency, actual model/rate revision and observation coverage. A zero placeholder or missing measurement is not free work. A session-cost difference may include nested/concurrent work; label attribution limits and avoid double-counting parent and child totals. Failed/ungraded trials remain part of resource accounting. Unknown cost cannot establish a saving.

Reauthorize before telemetry/evidence egress, deferred delivery, aggregate read, drill-down and export. Use existing deduplication, pagination and scope-safe projections; dropped, late or duplicate events retain their observation limits. Revoke/disable stops new unauthorized disclosure and current reliance without rewriting historical receipts or promising recall of already exported bytes. Ordinary observability failure must not fail an otherwise authorized task; if required assessment evidence is unavailable, the assessment remains insufficient under the existing readiness contract.

An agent encountering repeated tool errors, contradictory success signals, silent wrong-target data, stale instructions or excessive retry can submit a **candidate finding to an existing Task/Issue or review record** through a currently supported authorized route. Preserve tried/expected/actual, exact method/client/tool/revision, safe evidence and workaround limits; reconcile an existing match before creating another item. Reporting neither certifies a defect nor authorizes a fix, official Bug, method promotion or external message. Triage classifies product/tool/environment/method/oracle/measurement causes before any generalized lesson. A verified repair links its regression and later observation through existing records; closing the task alone is not post-fix verification.

**Acceptance allocation:** Extend the existing Skill/client, FR-124 comparative, native attribution, evidence, security and recovery proof owners in canonical 05. Required variants include missing delivery, known alternative process, refused prohibited attempt with unchanged state, uninstrumented external client, dropped traces, duplicate/late events, zero/estimated usage, revoked evidence during grading and stale candidate at proposed adoption. These contract/UI/product obligations are **NOT RUN** in this documentation update. No native Tesbo synchronization or authority is inferred from a Git diff.

## Revision 1.4.47 — identity, continuation, evidence and stop contract refinements

**Proposed logical associations, not published field names, new tools or wire enums.** Extend existing task/claim/report/proposal, current authorization, evidence and capability owners after schema/writer inspection. Existing ASER-C states and idempotency/publication semantics remain authoritative. No unsupported field may be sent to a deployed client on the basis of this text.

| Existing contract owner | Information and invariant |
| --- | --- |
| Principal / grant / delegation | Server-verified subject and credential kind; separately evidenced authorizing human or enrolled workload; project/audience, client/instance, task/attempt generation, current grant/consent revision, expiry and verified parent delegation when applicable. Caller-provided actor/client names remain claims. Child requests cannot exceed current parent delegation, child grant or shared limits. |
| Runtime capability discovery | Identify which credential custody, isolation, outbound policy, action observation, durable wait/resume, descendant cancellation and termination-readback functions the actual adapter supports. Distinguish declared, independently observed and unavailable capabilities with version/build scope. Missing capability prevents the dependent guarantee, not all authorized manual work. |
| Dispatch / wait / resume | Immutable authorized inputs/Skill/environment references, selected adapter, pending event identity and completed-operation receipts. Resume rechecks authority/revisions/budget and atomically obtains current generation; duplicate or stale event cannot issue a second effect. Retain reason for blocked/expired/unsupported continuation using existing lifecycle vocabulary. |
| Consequential writes and replay | Enforce current credential/membership generation, consent, scope and target guards after waits and at the owning transaction/effect boundary. Revocation/removal/re-add/rotation cannot revive old work. Exact authorized replay returns the existing receipt; changed payload conflicts; a different principal cannot obtain another contributor's private receipt by guessing its key. |
| Observation / evidence | Bind original action/attempt/effect evidence and applicable trace references to their source and access scope. Mark platform-observed, independently verified, self-reported, inferred, partial or unavailable according to evidence; these are provenance facts, not replacement workflow states. A span ID, signature or digest does not alone prove execution. |
| Stop request and readback | Bind accountable actor or configured monitoring policy/version, scope and descendants, operation identity and expected current basis. Independently return accepted request, effective authority fencing, provider/worker acknowledgements, known in-flight effects and unresolved external activity. Duplicate stop delivery is safe; the subject cannot acknowledge itself as independently terminated. |
| Renewal and explicit continuation | Renewal never exceeds existing authority. Following a stop, an eligible native resume/new attempt revalidates scope, input/Skill revisions, consent, remaining budget and previous uncertain effects. A fresh token or later membership alone does not resume an old generation. |

No sensitive credential bytes, browser sessions, vault contents or model-provider keys appear in task JSON, MCP content, trace metadata, exported evidence or error text. Credential injection is performed by the approved broker at the permitted destination. User-managed modes that expose scoped credentials disclose their actual guarantees. Incoming OAuth, outbound SaaS/MCP brokerage and human browser review remain distinct boundaries; #246's read path does not imply delegated write or workload identity support.

Authorize before revealing stop status, evidence, counts or parent/child relationships; preserve project/tenant boundaries, privacy and safe denied/error behavior. A failed status read is unknown, not stopped. A transport cancellation is not proof that the downstream operation did not commit. Required audit failure aborts the protected native effect; optional telemetry export failure is separately disclosed. External effects reconcile by their real provider/native operation receipt and must not be blindly retried.

Negotiate and test any adapter/schema increment against both existing MCP endpoints and supported actual clients. Retain old bearer-client compatibility within its current policy; do not grant new powers or invent exact identities to accommodate a legacy client. Acceptance and rollout follow canonical 05; all added runtime scenarios remain NOT RUN.
