# Product Requirements — Shared Human-and-Agent Engineering Workflow

**Current package amendment:** 1.4.46 — 26 November 2026; PROPOSED / NOT FROZEN. Read the final revision 1.4.46 section for this update. Earlier revision headers and receipts below retain their historical scope.

**Document ID:** TESBO-PRD-001  
**Revision:** 1.4.39 — 21 November 2026; module authoring principles and contextual guidance integration; NOT FROZEN 
**Scoped implementation evidence:** Native preview increments are tracked in Tesbo PR95 and PR98; use their exact-head receipts and the MBT contract/acceptance sections below. Historical full-source audit pins and older review results retain their original scope/date. Unverified criteria and independent assurance remain open; this is not package-wide implementation or deployment certification.
**Priority terms:** **MUST** = acceptance requirement; **SHOULD** = planned but can be staged; **MAY** = optional/future.  
**Application context:** project-agnostic, multi-project QA management and agent-orchestrated execution. DMIS/ODPEM is an initial web pilot only, never a product-specific requirement or default tenant.

**Engineering acceptance doctrine (P-01–P-20):** `00_README.md` is the binding source for web-native, project-neutral, single-Copilot/multi-session, canonical-knowledge, protected human-publication and reuse-first principles. A third-party UI/agent/test framework is a candidate only after a source-grounded evaluation against current Tesbo; using a library must not introduce a second authoritative session, KB, case, bug, execution or approval store. These rules refine implementation of the existing FRs; they do not create new product-specific FRs.

**Current integration amendment:** Read revision 1.4.28 below for ASER scope, exact canonical owners and contracts. Earlier dated source/implementation claims retain their original scope. The original QA round trip and P-07/P-14/P-17/P-18 are preserved. New runtime tests remain NOT RUN; the package is NOT FROZEN.

## 1. Problem statement and desired outcome

The first pilot involves a QA lead using ChatGPT to create testing prompts, an OpenCode executor testing a DMIS website with its locally configured **Chrome MCP**, and a reviewed Tesbo report. This is one reference integration, not the platform’s only execution route. OpenCode returns a detailed report; the QA lead pastes the report back into ChatGPT. ChatGPT critically analyzes the evidence and drafts test cases, execution updates and standalone GitLab issue text. The QA lead frequently requests changes before explicitly approving workbook updates. Copy/paste is wasteful, but the review and approval cycle provides essential quality control.

**Product outcome:** Tesbo is the approved test-case and evidence repository for each project, supporting optional migration from existing sources (Excel for the DMIS pilot) and replacing manual handoffs between compatible analysis/execution clients, without taking over the agent's browser, bypassing the QA lead, or mutating test definitions before approval.

**Platform scope:** Tenants/projects are first-class isolated configuration and authority boundaries. Test targets, UI case templates, source imports, data-policy rules, issue trackers and runtime/browser/API/device adapters are not hardcoded. Web testing via OpenCode/Chrome is the first target to implement and prove; other target types are extension points that require actual adapter support and validation. No per-project optional feature (e.g., import, tracker, mobile adapter) blocks unrelated projects.

## 2. Actors and responsibilities

| Actor | Responsibilities; not irrevocable rights |
|---|---|
| Human project owner / reviewer | Controls protected-suite policy, reviews/edits proposals, requests retesting, approves and merges. |
| Analysis assistant (ChatGPT initially) | Consults with the human, authors prompts, reads reports, assesses evidence, drafts/revises cases and issues. |
| Execution agent (OpenCode initially) | Retrieves assigned natural-language prompt, uses its own supported browser/API/device tool to test the authorized target (Chrome MCP for the first web pilot), submits raw report and evidence. |
| Other execution-capable agents | Kimi Code, Claude Code, Codex, Hermes, etc.; same task/report protocol. |
| Agent administrator | Registers/deactivates agent instances, credentials and capability profiles. Can be delegated by the project owner. |

An agent can have analysis **and** execution capabilities when explicitly granted. Its vendor/runtime is metadata, not its security role. A human may author directly under a project policy, but must not be able to impersonate another reviewer without audit.

### 2.1 Reuse constraints and observed configuration

Reuse existing `agents`/`actors`, `api_tokens`, staged `ai_generation_requests`, `testcase_versions`, cycles/executions, attachments/storage, queues, audit and UI components. External task attempts, immutable report receipts, revision-bound review decisions and full capability policy are demonstrated gaps requiring extensions. The live board is Zyra-centric and disabled without its AI allocation; external testing must be independent of that allocation. Duplicate Review Board is not the general proposal queue.

A KB document persistence/search/history check passed. MCP discovery/calls, external agent handoff and human-approved merge remain untested. Source and live evidence are detailed in `00_README.md` and `03_TECHNICAL_DESIGN.md`.

## 3. Functional requirements

### 3.1 Test task creation and dispatch

| ID | Priority | Requirement |
|---|---|---|
| FR-001 | MUST | Create an external testing task from a complete natural-language prompt without an existing test case or allocated Tesbo model key; preserve built-in generation as a separate task kind. |
| FR-002 | MUST | Record project, title, optional project-defined role/module, target kind and adapter/capability, purpose, stable environment/context identity and dispatched snapshot, target-specific permitted resources/actions (URLs only for web/HTTP), cleanup/evidence instructions, versioned references/profile, author and time. Upgrade existing name/URL environment objects; names or array positions are not IDs. |
| FR-003 | MUST | Version the actual prompt. The assigned executor receives an immutable prompt revision; post-claim changes create a follow-up revision/task, never edit the tested instructions in place. |
| FR-004 | MUST | Support manual dispatch and agent selection, including reassignment, cancellation and clarification. |
| FR-005 | MUST | Assigned executor can list/read/claim its tasks via MCP using a single active attempt with a server-issued fencing generation and authoritative expiry; heartbeat/progress/primary-report/resume validate that generation and idempotency. |
| FR-006 | SHOULD | Optional autonomous task pickup through an agent-side bridge/poller; never claim that MCP server registration alone pushes work to local sessions. |
| FR-007 | MUST | Support exploratory, investigation and regression task types; for regression link immutable snapshots/versions of existing published cases. |
| FR-008 | MUST | Record dispatch mode and who authorized it, including optional pre-dispatch approval policy. |
| FR-009 | MUST | Support clarification question/answer/resume, blockers, follow-up instructions, **ChatGPT-initiated verification/retest** and human-requested retests with explicit actor/lease rules. Follow-up links its parent finding, task, report, reviewed prompt and evidence; it receives a new immutable dispatch/attempt and independent original report. Material scope changes require a new revision/assignment; new material evidence reopens affected proposals/requires renewed human approval. Cancellation ends Tesbo authority; cooperating clients stop subsequent target actions without claiming reversal of in-flight external actions. |

### 3.2 Agent registry and permissions

| ID | Priority | Requirement |
|---|---|---|
| FR-010 | MUST | Extend existing agent/actor identities to register multiple runtime instances, including multiple installations of one runtime, with stable identity, project scope, owner, runtime metadata and accurate status; model-provider allocation is separate. |
| FR-011 | MUST | Extend existing API-token/credential lifecycle with distinct instance-bound, expiring/revocable credentials and attribution; never infer human authority from the issuing account. |
| FR-012 | MUST | Configure reusable versioned capability profiles and per-instance overrides. Effective access is credential ceiling intersected with current effective instance/profile grants and current project/task restrictions; explicit deny wins, absent/unknown grant denies. Scope inheritance and profile lifecycle are explicit. |
| FR-013 | MUST | Separate permissions for task submission, assignment, claim, report/evidence upload, analysis, proposal editing, review, approval, merge and administration. |
| FR-014 | MUST | Enforce privileges in backend services across REST, MCP and old endpoints; a hidden button or filtered `tools/list` is not sufficient. |
| FR-015 | MUST | Revocation/grant/issuer-authority changes apply next protected request. Machine workspace comes from bound project, not issuer active-workspace preference. Suspend affected credentials/attempts on issuer/instance-owner removal or loss of delegation until authorized transfer/reissue. New report/proposal evidence uses reauthorizing access, not irrevocable public links. |
| FR-016 | SHOULD | Surface effective permissions, active credentials, last seen, activity, issued-by and revoked-at in the management UI. |
| FR-017 | MUST | Fail closed on omitted, invalid or empty requested scopes; migration/backcompat strategy for legacy `read,write` tokens. |

### 3.3 Execution report and evidence ingestion

| ID | Priority | Requirement |
|---|---|---|
| FR-018 | MUST | Preserve original complete runtime report separately from interpretation/drafts. Permit authorized human paste/upload fallback, retaining actual human submitter and separately asserted runtime origin without forging an agent claim. |
| FR-019 | MUST | Reserve a pending report receipt before artifact upload; finalize immutable narrative/manifest only after required evidence integrity checks. Reuse storage with report ownership and private reauthorizing downloads; actual supported clients must be able to consume authorized screenshot/file bytes. |
| FR-020 | MUST | Allow report submission against a task with **zero existing test cases**. Do not fabricate case IDs. |
| FR-021 | MUST | Record chronology, attempts, observed outcomes, expected/actual details, uncertainty, evidence types, environment and agent identity when supplied. Do not turn unsupported assertions into verified facts. |
| FR-022 | MUST | Keep original reports append-only; amendments/supplements create new records, linked to earlier submissions. |
| FR-023 | MUST | When testing published cases, reuse Tesbo's existing `cycles`, `cycle_items`, `executions` and attachments for approved case-linked execution history, not a parallel run store. |
| FR-024 | MUST | Receiving a report does **not** modify an authored case, overwrite expected results, create an approved defect or merge anything. |
| FR-025 | SHOULD | Expose report/evidence browsing and scoped MCP reads, including paginated reports-awaiting-analysis and proposal discovery without pasted IDs. Published record links and exact definition/history URLs must reopen the correct record. |

### 3.4 Analysis and proposals

| ID | Priority | Requirement |
|---|---|---|
| FR-026 | MUST | Authorized analysts can read permitted prompt/reports/evidence, exact published bases and prior review. Task-scoped context/profile access permits only linked approved references, without requiring project-wide case/report enumeration. |
| FR-027 | MUST | Generalize shared Zyra staging for case create/update/archive, reviewed suite creation/placement with dependencies, governed results, **native Tesbo defect create/link/update proposals**, and optional external-tracker issue text. Each operation has separately selectable disposition and evidence. External clients and authorized humans share this engine; no parallel proposal/defect repository or internal-generation prerequisite. |
| FR-028 | MUST | Persist resolved operation kind, exact existing target UUID or stable logical new-target reference, base definition, destination/dependencies, complete proposed postimage, profile and evidence before review. Apply cannot repeat positional ticket pairing or change create into update; changed matching recommendations require a new reviewed revision. |
| FR-029 | MUST | Render exact immutable base/current/proposed values and full new/removed impact, including punctuation, custom/automation tags and complete fields. Reuse comparison layout without normalized similarity semantics. |
| FR-030 | MUST | Keep immutable proposal and operation revisions with stable logical operation identity across revisions. Persist commitment once per logical publishing operation; copying a committed item into a later revision cannot republish it. Further correction is a new explicit compensating operation. |
| FR-031 | MUST | Allow operation/field comments, direct human draft/analysis authoring, changes/retest, rejection and selected approval. Show save/dirty state and preserve typed corrections across remote revisions, navigation or reconnect; never silently replace unsaved text. |
| FR-032 | MUST | Bind human approval to the exact proposal revision and selected stable operation IDs/hashes, profile/policy versions and base content. Any approval-relevant edit, including test data, punctuation or suite/custom-field changes, requires renewed approval; do not automatically carry approval to another revision. |
| FR-033 | MUST | Only an authorized human reviewer/merger can publish into a protected suite under the protected-project policy; analysis/execution credentials never implicitly receive this authority. |
| FR-034 | MUST | Conflict-detect concurrent changes to an official case; deny silent overwrites and provide rebase/re-review. |
| FR-035 | MUST | Apply a dependency-closed selected approved operation set atomically; reject missing/unapproved/cyclic dependencies and conflicting same-target mutations. A previously committed dependency is satisfied only by exact receipt/mapping plus valid reviewed context, without reapproval/reapply. Aggregate status retains pending work yet closes when all items have terminal dispositions, including rejected items and issue approval-for-copy, without requiring every item to publish. |
| FR-036 | MUST | Retain stable official identifiers and reuse existing testcase_versions/history, adding complete definition/profile/custom-field provenance and human approval/report links; no second published-case history by default. |
| FR-037 | MUST | Enforce protection on official records AND authoritative review/state/receipt writers: existing MCP/REST CRUD, imports/bulk/clone, suite effects, custom fields/tags, Zyra save/chat/close/discard, duplicate review and legacy aiSave tracking. Client-supplied case IDs cannot mint apply receipts or hide pending work. |

### 3.5 Defect drafts and reporting

| ID | Priority | Requirement |
|---|---|---|
| FR-038 | MUST | Draft **project-configured defect proposals** with observed/expected, reproduction details, evidence links, severity/priority when configured and proposed existing-case/run linkage; support optional tracker-formatted standalone issue text. The DMIS/GitLab pilot profile uses feature + incorrect behaviour title; Description; Steps to Reproduce; Actual; Expected; Evidence. Impact remains optional. Never claim an unverified allegation is a confirmed defect. |
| FR-039 | MUST | Keep candidate issue status independent of test-case merge status; one issue may be rejected while cases are approved. |
| FR-040 | MUST | Let an authorized human edit, request verification, reject or independently approve defect/issue proposals. **Approval is not publication.** On explicit authorized selected apply, publish approved native defect operations to Tesbo's existing `bugs` and approved links to existing records, validating case/run associations and any execution-status side effect within the protected transaction; record bug IDs/receipts. Alternatively approve tracker-specific Markdown for manual copy. Draft/approve/copy actions never call live bug/link routines or post externally; no external tracker write without a separate explicit authorization. |
| FR-041 | SHOULD | Let the human optionally record GitLab issue URL/manual filing status without making Tesbo write to GitLab. |
| FR-042 | MUST | Separate authored expected results from observed execution outcomes and issue allegations; support NEEDS_CLARIFICATION and NOT_VERIFIED. |

### 3.6 Configurable project formats, hierarchy and optional migration (DMIS profile as pilot)

| ID | Priority | Requirement |
|---|---|---|
| FR-043 | MUST | Use existing suites for each project’s selected flat or hierarchical structure; Role → Module is the DMIS pilot profile, not a mandatory global taxonomy. Review new parent/child suite operations and dependent cases in one transaction using exact parent identities; never resolve destination by name alone. All relevant suite mutations share one hierarchy lock/version protocol. |
| FR-044 | MUST | Reconcile source/native IDs explicitly, including case-fold collisions, leading zeros, whitespace and native length limits. Optional reporters resolve IDs case-insensitively today; migration must prevent ambiguous mappings while preserving original spelling separately if needed. |
| FR-045 | MUST | Represent each project’s applicable fields (including UI/API when configured) with a lossless case-definition adapter: source/native IDs, requirement references, prerequisite/type/title/scenario, native action/expected pairs, independent case-level expected results/response, method/endpoint and data. Preserve clear/set/absent semantics, custom fields/tags and provider links; Actual Results/outcome remain execution data. |
| FR-046 | MUST | Support versioned per-project authoring/field-mapping profiles. The DMIS pilot profile uses concise titles, setup-only prerequisites, action-only steps, exact values in Test Data, concise numbered expectations and no generic environment-availability precondition; other projects can define distinct validated templates, fields and terminology. |
| FR-047 | MUST | When an import or migration is configured, preserve the original source file/data read-only (Excel for the DMIS pilot). Extend existing import/export mapping to stage row create/update/unchanged/conflict/reject dispositions by approved source identity, not title alone. Reconcile full hierarchy, literal delimiters/multiline steps/global expectations, references and custom fields before signed cutover. |
| FR-048 | MUST | Preserve authorized human editing and reviewed compensating restores. Accepted run snapshots/history cannot be overwritten from current cases by history-import/refreshSnapshots; corrections create reviewed result/snapshot revisions with original tested provenance intact. |

### 3.7 Operational and audit behavior

| ID | Priority | Requirement |
|---|---|---|
| FR-049 | MUST | Extend existing audit_logs/activity for lifecycle/decisions/applies/denials. Mandatory publication audit uses the same transaction client and propagates failure; independent pool writes or swallowed errors cannot represent authoritative successful publication. |
| FR-050 | MUST | Record principal, actor/agent instance, project, target entity, source interface, timestamp and correlation ID for write actions. |
| FR-051 | MUST | Prevent agents from accessing secrets outside their task scope; task prompts must not contain passwords, session cookies, bearer tokens or OTPs. |
| FR-052 | SHOULD | Extend existing Tasks/home/Activity/notifications with paginated source-neutral proposal and analysis queues, filters/stable order, old pending work and durable deep links. Do not inherit the generation board-only/chat exclusion or latest-50 cap as workflow discovery. |
| FR-053 | MUST | Record failures with retry-safe idempotency keys; no duplicate task claims, reports, approved case creates or merge operations. |

### 3.8 Durable QA sessions, native Copilot, and selectable agent backends (revision 1.4.0)

| ID | Priority | Requirement |
|---|---|---|
| FR-054 | MUST | Each project contains multiple durable, isolated QA sessions with stable identity, ordered attributed messages/events, tasks/reports/retests/decisions, lifecycle, and resumable history. A **single platform Copilot interface** lets an authorized user create, switch, search and resume these sessions; session context is loaded on selection and never leaks between projects. Multiple successive or concurrent analyst/executor participant bindings are permitted. |
| FR-055 | MUST | Authorized participants and the native Copilot retrieve the project Knowledge Base and requirements by canonical document identity **and immutable content version**, plus permitted published cases, findings and reports. Record exactly which versions informed a prompt/analysis; summaries are derived and link to evidence. Store each source document once, reference it from many sessions, and require explicit approved promotion of session insights to canonical knowledge. |
| FR-056 | MUST | Offer **one native Tesbo Copilot chatbox**, accessible within the web platform across authorized projects and their multiple sessions, rather than a distinct Copilot per session. Changing project/session loads its own authorized conversation, exact knowledge citations, tasks, reports, retests and staged case/result/native-defect changes; drafts and stream ownership are session-bound. Use the same backend authorization, proposal staging and human approval as external MCP clients; external-chat/MCP-only mode stays supported without native inference. |
| FR-057 | MUST | In the single Copilot, offer selection among actually configured AI analysis models/providers. **Separately**, select a verified, authorized execution agent instance: user-managed on its own workstation, independently deployed remote/gateway, or optional Tesbo-managed host. Display real capabilities, transport, status, ownership, version and authorization; local client installation is never required to USE web Copilot but is a permitted existing execution environment. |
| FR-058 | MUST | Support one capability-based **execution-agent integration contract** across external Tesbo MCP clients and optional hosted SDK/API/gateway/plugin adapters: discover identity/tools, get task/claim, send progress/clarification, submit report/evidence, retest, cancel/expiry/reconcile and audit. Treat OpenCode, Hermes, OpenClaw, Claude Code, Codex and Kimi as candidate agents with independently verified compatibility; treat Grok-box as a sandbox/execution substrate, not an equivalent agent. Unsupported optional operations fail explicitly. Agent-native threads do not replace Tesbo sessions. |
| FR-059 | MUST | Native Tesbo Copilot remains **web-only and usable without installing anything**. It neither installs nor controls arbitrary processes on a user device. An independently installed user-owned executor can voluntarily connect **outbound** to Tesbo MCP, operate its own target drivers and use pre-existing target connectivity; Tesbo does not provide or require that executor’s VPN. Isolated hosted execution is optional with tenant/tool/network/secret controls. Never expose an uncontrolled remote shell or copy the executor’s local secrets into Tesbo. |
| FR-060 | MUST | Persist application-level event receipts before acknowledging user submissions, with stable message/turn/attempt/idempotency IDs and ordered session events. On retries, streaming disconnect, hosted agent crash, external executor offline or project/session switch, reconcile provider/agent state and show `UNKNOWN` when completion cannot be established; do not replay a possibly accepted command, duplicate a report or lose a human decision. |
| FR-061 | MUST | External ChatGPT/Claude/Copilot handoff works through a scoped, paginated session-context/read contract (objectives, decision log, immutable knowledge version links, pending tasks, reports, proposals, approvals and uncertainties) rather than requiring copying an entire transcript. Authoritative original events and referenced bytes remain retrievable; provider-specific hidden history that was never recorded in Tesbo cannot be asserted available. |
| FR-062 | MUST | Per-session role and tool permissions compose with project, hosted/external agent instance and task constraints. Switching Copilot backend, project/session, executor or external model, or replaying/branching a session cannot bypass project isolation, reviewed publication, tool-origin allowlists or canonical source-document authorization; untrusted KB/report/agent output is data, never privileged instructions. |
| FR-063 | SHOULD | Support optional linked session branches, parallel analyst comparisons, session search and safe compaction. Preserve parent-child provenance, original event sequence and exact source citations; never copy/publish canonical knowledge or merge competing changes automatically, and do not require a new inference purchase for an external-agent-only session. |

### 3.9 Dual client entry, external-access governance and session summaries (revision 1.4.4)

| ID | Priority | Requirement |
|---|---|---|
| FR-064 | MUST | Support two **equivalent governed entry routes**: (A) user operates external ChatGPT/Claude through Tesbo MCP to discover opted-in projects, open authorized sessions, retrieve KB/QA records and create/review execution work, including retests and staged case/Bug proposals; (B) user operates one native Tesbo Copilot with project/session selection and selectable supported analyst AI/agent backend. Both call the same domain services and preserve common Tesbo session/task/approval history; the external client need not use native Copilot. |
| FR-065 | MUST | Project owner/authorized manager explicitly controls **External AI & MCP Access** per project, default OFF. A disabled project cannot be enumerated/read/mutated via external MCP regardless of token, URL, prior discovery, cached tool list or active session. Exposing one project does not expose others; administrator policy can prohibit enabling sensitive projects. Existing legacy tokens must undergo explicit safe migration/rotation rather than silently inheriting grants. |
| FR-066 | MUST | Gate every external operation by authenticated human/agent principal AND active project MCP opt-in AND explicitly approved client/credential binding AND project membership/role AND fine-grained operation/data visibility AND optional session/conversation-thread/task/agent restrictions; deny by default. Project setting changes and client revocation immediately block subsequent MCP calls, including retrieval and execution-report reads; preserve protected human-only approval/merge. |
| FR-067 | MUST | Permit authorized external clients (ChatGPT, Claude, other MCP consumers) to **submit a user-requested or periodic session summary** without claiming Tesbo observed the full private conversation. Store attributed source/client, project/session, window or message-range description, available source IDs, completeness declaration, gaps, summary revision, timestamps and original raw submission receipt. Mark the summary derived/unverified and distinct from official knowledge, tasks, reports and execution results. Support corrected/replacement versions with preserved history. |
| FR-068 | MUST | Support **execution-agent summaries** linked to exact task/prompt revision/attempt/report/evidence references and the agent's actually observed tool actions; separately support native-Copilot checkpoints. Summaries may supply cross-session context and unresolved questions but cannot override immutable original reports, invent observed evidence, publish cases/Bugs/results, or assert PASS for a case not executed on an approved version. |
| FR-069 | MUST | Reuse the existing project Requirements, Test Cases, Test Plans, Runs, Bugs, Insights, Agents, Knowledge Base, Activity Stream and Project Settings domain stores and screens. Add source-linked session/task/report/proposal references and read/write actions via the existing services; do not introduce competing AI-only QA repositories, insight engines, document stores or activity streams. |
| FR-070 | MUST | The **native Copilot's conversational runtime selector** and **independent task executor selector** are separate: selectable configured provider APIs OR technically compatible server-side/remote coding-agent interfaces (Claude Code, Codex, Kimi, Hermes, OpenCode, etc.) power the chat when supported, while an external or hosted executor can be assigned to act on a target. Never require a user-device CLI, local Tesbo companion or a session-bound duplicate agent model. Advertise only proven runtime/model availability and modes. |

**Prioritization:** FR-054–FR-062 define one web Copilot spanning multiple project-scoped sessions, with independent user-managed/remote execution agents as the first execution route and separately configured hosted Copilot AI providers; managed agent hosting is optional. FR-063 is a later enhancement. These extend FR-001–FR-053 using existing Tesbo source patterns; no local desktop companion or DMIS-specific core field is required.

### 3.10 Finding disposition, coverage evolution and QA Standards & Playbooks (revision 1.4.8)

| ID | Priority | Requirement |
|---|---|---|
| FR-071 | MUST | Preserve each finding as an attributed, evidence-linked **occurrence** of a specific task/report/execution attempt, step and expected condition (or unscoped exploratory observation). Classify its **relationship per occurrence** as `DIRECT`, `SIDE`, or `UNDETERMINED`; one Bug may be DIRECT in one attempt and SIDE in another. Preserve classification rationale, version, original actual behavior, target/build, original bytes and review history. Do not equate a discovered finding with a confirmed defect. |
| FR-072 | MUST | On an executed definition, a demonstrated failure of any applicable mandatory expected condition makes **that execution attempt** Failed; each condition has a stable condition ID, applicability, result, evidence and actual outcome. Incomplete applicable conditions prohibit an unqualified Pass. A SIDE finding alone never changes an otherwise valid outcome; a Bug association/link is not itself proof of a failed test. |
| FR-073 | MUST | Triage every SIDE/UNDETERMINED finding by searching existing Test Cases, historical versions and requirement coverage. Preserve discovery location separately from affected behavior; disposition as covered-by-existing (with targeted new execution where needed), revise-existing-case (only if its purpose legitimately includes the condition), create-dedicated-regression-case, non-defect/duplicate, or needs-clarification. Search and dedupe Bugs independently; never create a duplicate case simply because one was not in the current execution. |
| FR-074 | MUST | Case creation/revision and execution-result publication remain independently governed. A new or revised test case cannot be marked Failed without a valid *actual execution observation* against its approved version, environment/build and explicit applicable expected condition; historical evidence MAY be promoted as that execution only after exact coverage, traceability and human-reviewed acceptance are demonstrated. Linking an approved Bug cannot retroactively overwrite finalized Passed/Untested results; corrected status requires an explicit governed, versioned correction preserving original outcome and cause. |
| FR-075 | MUST | Preserve defect fix/reopen and independent retest lineage: observation → Bug → directly impacted test version/attempt or side-discovery context → fix/build → new task/execution attempt → result. Keep all attempts, per-condition outcomes, discoveries and status corrections source-attributed; no assumption that a Bug's status `Fixed` means the retest Passed. |
| FR-076 | MUST | Provide canonical, versioned **QA Standards & Playbooks** for project workflows and per-module/artifact practices (Requirements, Test Cases, Plans, Runs/Executions, Bugs/defect formats, evidence/reporting, Knowledge Base and other applicable modules). Separate **operational decision policies**, **authoring templates**, validation/schema requirements and worked examples. Resolve scope/priority deterministically from non-overridable platform/organization controls to authorized project/module settings and permitted task-level style overrides; one project may use its own issue-tracker formatting while another has none. |
| FR-077 | MUST | Native Copilot, external ChatGPT/Claude via Tesbo MCP and authorized executor agents can discover/read the same **effective** guides with revision ID/hash and supported template variables, subject to project, client, session/task and document visibility. Bind consumed guide revisions to task, proposed record and original report/summary; treat guide text and retrieved KB as untrusted instructions, never as grants or human approval. Authoritative backend schema and business-policy validation rejects invalid/ungoverned edits even when an AI ignores its guidance. Changes to standards are access-controlled, reviewed, audited and versioned. |
| FR-078 | MUST | Existing Test Cases/Plans/Runs/Bugs/Activity/Insights present source-backed **test-case evolution and finding discovery history**: published definition versions with step/expected-condition diffs and change reasons; exact definition snapshot used by each execution; direct/side finding histories and disposition; mapped coverage gaps and new/revised cases; accepted defects; independent fix/retest attempts; and honest metrics that avoid counting side discoveries as failed executions. Retain links when the application UI or requirements change. |

| FR-079 | MUST | **Bidirectional reviewed execution-result corrections:** an authorized evidence-backed correction may change the *effective display result* from Passed to Failed **or** Failed to Passed (and other explicitly permitted transitions). Render `Failed (corrected from Passed)` / `Passed (corrected from Failed)` with original and intermediate status events preserved append-only. Each event retains prior/effective status, attempt ID, test-definition revision, actor, timestamp, reason, evidence, review decision, source channel and revision/optimistic-lock metadata. Linking, unlinking or resolving a Bug alone never changes execution status. Corrections cannot fabricate execution observations or hide failed conditions. |
| FR-080 | MUST | **Task-oriented step and expected-condition execution:** model approved case steps as ordered, addressable instructions with stable step IDs, zero/multiple assertion/condition IDs, applicability and optional branch/dependency. Present an execution checklist/workflow showing `not started / in progress / performed / skipped / blocked` for each **action**, independently from `unverified / passed / failed / blocked / not applicable` for each **expected condition**. Capture original observed result, source/actor/time and evidence per condition. Completed action != passed assertion. Aggregate attempt outcome only from applicable required assertions and approved execution rules. Preserve actual tested definition version, even after edits. |
| FR-081 | MUST | **Typed, historical cross-module connections:** extend existing canonical relationship and read services so Requirements, authored Test Case **versions**, steps/conditions, execution attempts, observations, Bugs, plans, fix/build and retests have explicit semantic edge kinds (`tested_definition_version`, `assertion_failed`, `discovered_during`, `covers`, `regression_for`, `retested_by`, `supersedes` or justified equivalents), direction, provenance, permissions and authoritative owner. Bind evidence-bearing relationships to exact historical identity/grain and time, not merely the mutable latest case. Provide source-backed traversal without a second QA or graph source of truth; do not infer failure/causality from generic association. |
| FR-082 | MUST | **Compact contextual change history:** existing domain screens show the current/effective value first, with an accessible hover/focus preview and click/tap full history for consequential statuses, step/condition changes and other versioned fields. Preview supplies prior value(s), time, actor, reason, evidence and correction history subject to permission. Derive ordinary field diffs from existing immutable case snapshots/audit; add append-only events only where historical semantics require them (especially accepted status transitions). No per-field shadow tables or cluttered permanent history columns solely for UI. Hover is supplementary, never the only access path. |
| FR-083 | MUST | **Execution-attempt identity and occurrence-specific evidence:** preserve the existing Run/`cycle_items`/`executions` as canonical owners while assigning durable, immutable identities to each logical attempt and correction/observation event. A repeated result/retest within one Run must never overwrite or masquerade as an earlier attempt. All step outcomes, evidence, Bug discovery versus causal links, actor/channel, tested-definition fingerprint, build/environment and human decisions refer to the exact attempt. Existing imported per-execution `history` must be preserved as legacy results without pretending it contains authoritative new attempt IDs or corrections; clients need an honest compatibility projection. |
| FR-084 | MUST | **Temporal fidelity of test definitions and migrations:** reuse V119's `cycle_items.snapshot_*` full-field snapshots and V63 definition history, rather than rebuilding these stores, but explicitly distinguish an original creation-time captured snapshot, V119's later backfill reconstructed from then-current Test Case fields, imported positional `step_results`/`history` from V140 and a freshly approved version-bound attempted execution. No backfill, positional mapping, changed step order, missing definition version, or inferred ID may be presented as contemporaneous verified truth. Capture/reconcile stable step and expected-condition identifiers, definition version/hash, content, capture time/source and provenance quality before accepting future attempts; expose unknown/unverifiable old links in UI/API/exports. |
| FR-085 | MUST | **Policy-equivalent writes across every authoritative entrance:** check current actor, member/credential scope, project ownership, entitlement/write lock, applicable review grant and current record revision at the actual mutation owner. Include paths not shaped `/api/projects/:id` (e.g. `/api/cycles/:id`, `/api/bugs/:id`, `/api/mcp`), SDK ingest, imports, background jobs and external integrations. A global HTTP path guard alone is insufficient evidence that every write is protected. Preserve safe readonly access and deliberate exemptions such as archiving while requiring authorized actor/project semantics. |
| FR-086 | MUST | **Durable causal audit for protected decisions:** official result correction, approved proposal apply, attempt finalization, critical authorization/guide publication and protected Bug disposition changes must persist a precise original/current version, human actor, reason and evidence together with the authoritative state transition. Failure to record critical provenance must prevent publication or leave a recoverable pending/outbox state; a best-effort activity logger is not proof of immutable accepted history. Noncritical observability telemetry may remain best effort. |
| FR-087 | MUST | **Attempt-safe typed Bug/finding multiplicity:** preserve `bug_links` and existing case/run/Bug views as projections, but do not rely on the active unique `(bug_id,testcase_id,cycle_id)` association to represent multiple semantically distinct `DIRECT`/`SIDE` discovery events over different attempts, steps and conditions. Each independently evidenced observation has its own typed occurrence identity and stable actor/time/definition/evidence provenance; deduplicate repeated delivery of the same occurrence, not separate discoveries of one Bug. |

**Case/result semantics:** `testcases` store definitions, `executions`/attempts store observed outcomes, `bugs` store confirmed defect lifecycle and `finding occurrences` record where evidence was encountered. Do not use an unapproved AI inference to mutate official results. The domain owner has selected the **current corrected status with explicit origin label** (e.g. `Failed (corrected from Passed)` and the reverse), backed by the entire immutable correction history (FR-079).

## 4. Nonfunctional requirements

| ID | Requirement and validation |
|---|---|
| NFR-001 | **Authorization:** least privilege; project and task isolation; access denied on both MCP and REST. Use denied-access contract tests. |
| NFR-002 | **Data integrity:** transactional, idempotent merge; immutable published revision snapshot and task/report provenance. |
| NFR-003 | **Availability:** failure of OpenCode/local Chrome or ChatGPT connection must not corrupt task/report/proposal state; manual continuation supported. |
| NFR-004 | **Portability:** replacing OpenCode with another MCP-compatible agent must not require schema or business-rule changes. |
| NFR-005 | **Evidence integrity:** content-addressed checksums, access control, malware/size/type policy and retention settings; do not expose evidence publicly by default. |
| NFR-006 | **Security:** no credential leakage in logs/response/task payloads; use TLS, secret rotation, expiry, encryption at rest where appropriate. |
| NFR-007 | **Traceability:** from published test-case revision to proposal operation to human approval to analysis to raw task/report/evidence. |
| NFR-008 | **Compatibility:** existing manual Tesbo UI and external automation reporters continue to work subject to project protection policy; migrations reversible or forward-fixable with backups. |
| NFR-009 | **Usability:** before/after diff, comments and per-item decision controls; users can edit drafts themselves without asking an agent. |
| NFR-010 | **Observability:** structured audit and operational metrics (task queue, lease expiry, merge failures, client auth errors); no unverified SLA claims. |
| NFR-011 | **Retention:** preserve original report and proposal revisions after rejection, with configurable retention/privacy rules; destructive deletion gated. |
| NFR-012 | **Performance:** specify latency/volume targets after measuring current Railway baseline; load-test proposal diffs, bulk changes and artifact uploads rather than inventing numbers. |


## 5. Core acceptance scenarios

| AC ID | Observable acceptance requirement |
|---|---|
| AC-001 | ChatGPT-style client creates an external task with no case and no Tesbo AI allocation; exact prompt is retained. |
| AC-002 | OpenCode-style registered client claims only its assigned task and receives immutable prompt revision. |
| AC-003 | Agent uses its own supported external execution tool outside Tesbo (Chrome MCP for the web pilot); submits raw report/evidence without Tesbo launching or owning that runner. |
| AC-004 | Report submission leaves official suite/cases unchanged; evidence can be retrieved for review. |
| AC-005 | Analyst proposes 5 cases and 2 issue drafts; user approves 3 cases, requests changes to 1, rejects 1, and approves only 1 issue for copy. Exactly the 3 approved cases publish; other items remain traceable and no issue is posted. |
| AC-006 | Revision changes after approval or stale official case base cause merge denial pending renewed approval. |
| AC-007 | Agent token with task/report/proposal permissions cannot publish by old REST or MCP case CRUD or bulk endpoints. |
| AC-008 | Agent reassignment, task lease expiry, credential revocation and cross-project access are tested on next request. |
| AC-009 | Follow-up test produces another raw report without destroying the first. |
| AC-010 | Approved optional external-tracker issue draft (GitLab in the DMIS pilot) is copy-ready; no external ticket is posted automatically, and copy approval alone creates no native bug. |
| AC-011 | For a project that enables migration, its selected profile/hierarchy, IDs and authored/observed fields reconcile with the original source (DMIS Role → Module and Excel are pilot fixtures). A project without import is not blocked. |
| AC-012 | One complete real OpenCode + Chrome MCP + Tesbo + human merge demonstration as the **initial DMIS web pilot**, with actual execution evidence and captured approvals; a distinct project-agnostic validation must additionally prove no DMIS dependency. |

| AC-013 | Executor returns observed URL/build/role/tenant/environment (or explicit UNKNOWN/NOT_REACHED) and tested/blocked/untested scope; reviewers can distinguish intended from actually exercised conditions. |
| AC-014 | Analyst/replacement session can read the exact referenced KB/document version, full report chunks and real permitted screenshot bytes with completeness evidence, rather than current KB text or metadata alone. |
| AC-015 | A report created before a new case definition may inform the draft but does not confer official PASS/FAIL on that later case until the **approved immutable definition** is executed and verified. |
| AC-016 | Structured task scope bounds any natural-language prompt; contradictions pause for clarification. Admission/quarantine/redaction and consented downstream evidence access prevent unsafe original exposure or unauthorized disclosure. |
| AC-017 | A fresh authorized client discovers the full pending workflow without pasted IDs or reliance on previous chat memory; actual approval, evidence, report, grant and revision identities survive. |
| AC-018 | A human approves one verified native defect proposal and rejects another; **only the selected approved defect** is created in existing Tesbo Bugs, exactly once, with permitted evidence and explicitly approved case/run links and side effects. Approval-for-copy creates no Bug. |
| AC-019 | ChatGPT requests a targeted OpenCode verification through Tesbo MCP after analyzing an incomplete report. OpenCode uses its configured authorized Chrome MCP or Playwright MCP (not Tesbo MCP) and returns an independent report; ChatGPT compares both, revises affected proposals and obtains renewed human approval before publication. |

| AC-020 | A project user starts two durable sessions with distinct assistants/executors, resumes the first in another browser, and retrieves the same original ordered conversation/task/report history with immutable source references and access enforcement. |
| AC-021 | The **single web Copilot** switches between at least two sessions of one project and a session in another authorized project, displaying only the selected session’s correct history, KB citations, pending work and stream; a configured hosted API/agent backend can change without creating a new Copilot, duplicating knowledge, or altering pending approvals. |
| AC-022 | A fresh Claude/ChatGPT/Codex/Kimi/Hermes-compatible participant receives permitted session context and canonical KB document versions through Tesbo, not hidden provider history; wrong-project, revoked agent, expired credential and tampered-content reads fail closed. |
| AC-023 | Demonstrate **at least one real user-managed execution agent** connecting to Tesbo MCP, reading an assigned task and returning complete source report/evidence **without Tesbo-provided VPN or installed companion**; then demonstrate a second distinct agent runtime/gateway (for example Hermes or OpenClaw if compatible) using the same contract without schema changes. Optional hosted SDK/gateway smoke tests and Grok-box sandbox proof apply only when those capabilities are selected. Unsupported/revoked/offline/unknown states remain accurate. |
| AC-024 | A complete **non-DMIS** Copilot-led cycle: project KB context → durable session chat → independently operated agent connected through Tesbo MCP → its own target tool/browser → original evidence → ChatGPT/Copilot retest request → revised case/native Bug proposals → selected human approval and protected publication. Swap agent or analyst mid-session without losing Tesbo-owned history. Hosted execution is **optional**, not required for acceptance. |

| AC-025 | In the **ChatGPT app**, connect Tesbo MCP; discover an MCP-enabled project, choose a saved project session, retrieve versioned KB/QA context, dispatch an execution task to independently operating OpenCode/Hermes, analyze its actual report, request retest, stage case/Bug proposals and hand off to exact human review. Without ever opening the native Copilot, Tesbo persists the authoritative QA activity. The same services work from native Copilot in a different session. |
| AC-026 | With projects A (enabled) and B (disabled/sensitive), external ChatGPT/Claude and an executor can discover/use only explicit client-authorized project/sessions/operations. Denied projects are not enumerated; direct ID/API/MCP access fails. Toggling A off or revoking a client denies subsequent reads and writes without deleting internal project data or silently granting current tokens access to B. |
| AC-027 | External AI submits an explicitly requested per-chat summary and executor submits a report-linked attempt summary; Tesbo preserves revisions, attribution, coverage/gaps, source anchors and permission checks. A new authorized analyst uses the summaries plus original evidence without being told that hidden private chat was fully captured or that a summary is verified execution proof. |
| AC-028 | Every QA stage navigates to the existing correct Tesbo module (Requirements, Test Cases, Test Plans, Runs, Bugs, Insights, Agents, Knowledge Base, Activity Stream, Settings). Same-case/version and task/report identifiers resolve correctly and legacy manual workflows remain intact; an AI session never creates duplicate official records or bypasses selected human approval. |

| AC-029 | Given one execution with three applicable expected conditions, a failure of the second condition yields that attempt Failed with step/condition evidence; an unrelated SIDE Bug found in the same attempt does not change the direct-result calculation. A previously finalized attempt is never silently relabelled by creating/linking/unlinking a Bug. |
| AC-030 | An agent identifies a side finding, searches existing cases and Bugs, proposes a link to covered behavior OR an evidence-based change/new regression case, and preserves discovery and reviewer dispositions. A case created from a side finding is not falsely marked Failed without a demonstrably executed approved definition; a fix creates an independent retest and original evidence remains available. |
| AC-031 | Configure one project's Bug-report format and Test Case authoring standards. Native Copilot and a fresh external ChatGPT/Claude Tesbo MCP client receive the **same effective versioned guides** and create matching schema-valid, style-compliant staged drafts; switching provider/session does not change required structure or silently update accepted guide revisions. |
| AC-032 | A UI or requirement change revises the test definition. The existing Test Cases module displays the step/expectation diff, reason/author and historic version; older executions still reference the exact former definition and their original outcomes; Insights displays distinct direct failures, side discoveries, coverage additions and retests without double counting. |
| AC-033 | An AI reads a malicious or stale playbook, lacks one module's guide permission, or a guide changes during a pending draft. Tesbo denies unauthorized guide reads/edits, binds the effective approved revision, does not treat retrieved instructions as authority, and requires revalidation/review before a protected publish. Other projects' playbooks remain private. |

| AC-034 | An authorized human reviews a mistaken finalized Passed result with evidence and corrects it to Failed, then separately corrects a genuinely mistaken Failed to Passed. Each screen shows `Failed (corrected from Passed)` or `Passed (corrected from Failed)` as the current effective status; all previous states, actors, reasons, reviewed evidence, and original attempt facts remain accessible via hover/focus and full history. Concurrent/stale approval is rejected; simple Bug link/unlink does not mutate status. |
| AC-035 | Human and AI-assisted executors run a multi-step test with two conditions on one step, a conditional branch, a skipped action and a failed mandatory condition. The interface records action completion separately from assertion verdicts, actual observations and evidence; aggregated status reflects required condition truth. Definition revision persists after editing case; keyboard/touch users can execute the same workflow. |
| AC-036 | Starting from a Requirement, user follows a typed `covers` link to the exact Test Case revision, its condition, execution attempt, direct/side observation, linked Bug, subsequent fix and retest. All edges preserve meaning, version/occurrence grain, source provenance and authorization; edits to the current case do not rewrite the historical path. Invalid cross-project references, unsupported causal edges and orphaned links are denied or visibly unresolved. |
| AC-037 | Consequential field change history appears as a short on-hover/focus preview and an accessible click/tap complete timeline without new visible history columns. Ordinary definition diffs derive from snapshots, corrected statuses from append-only events; a restricted user cannot see a hidden actor/evidence detail in tooltip, export or linked view. |
| AC-038 | One approved Test Case runs twice inside one Run, once with a SIDE observation and once with an evidenced DIRECT failure of a mandatory assertion, with separate evidence and actors. Both have distinct immutable attempt/event IDs even if they share the same `executions` row for legacy projections. The same Bug can be linked by different semantic occurrence edges without overwriting either attempt, changing the earlier status or incorrectly moving its attachments; a later retest is separately attributable. |
| AC-039 | On a seeded legacy database, an execution predating V119 has a definition changed between execution and V119 backfill. Its reconstructed `snapshot_*` fields remain available but are explicitly labelled not verified as the original tested definition. V140 imported positional `step_results` and `history` retain original values and source attribution, never become fabricated stable condition IDs, accepted corrections or original evidence. A new post-migration Run binds a verified approved case revision/hash and per-condition identity, surviving later reordering and deletion. |
| AC-040 | Run drawer, full execution page, native/external adapter and exports distinguish current effective result from original and all attempt results, with one authoritative server revision and current-versus-all-attempt reporting denominators. A lost write acknowledgment, reordering, stale UI panel response, parallel reviewer, soft-deleted Bug link/re-link, cross-project reference or imported legacy record cannot duplicate, reassign, silently rewrite or falsely mark confirmed any attempt/result/evidence. |
| AC-041 | An owner downgrades or an expired entitlement locks a project; after the write-lock takes effect, equivalent writes through `/api/projects`, `/api/cycles`, `/api/bugs`, MCP, automation ingest, bulk/import, queued jobs and selected-apply either obey the policy or record an explicitly justified exception. Ordinary permitted reads and project archive escape remain available. Demonstrate with real HTTP/service integration tests; no claim from route inspection alone. |
| AC-042 | A protected approved status correction and proposal apply are attempted while audit/event persistence fails. The official state does not silently commit without required provenance: atomic rejection or recoverable durable outbox, deterministic retriable receipt, original/effective version, actor and evidence are verified. Noncritical background activity failures do not falsely certify critical events. |
| AC-043 | The same Bug is discovered as a SIDE finding on attempt A and directly causes a required-condition failure on attempt B of the same case in the same Run; both distinct typed occurrences persist with their own condition, evidence, actor and time despite legacy `bug_links` uniqueness. Replayed delivery of either occurrence does not duplicate it. A legacy Bug association remains readable. |
| AC-044 | The existing Knowledge Base History popover/timeline/diff patterns are considered for other change-history surfaces before introducing any new UI mechanism; existing Test Case drawer, Runs views, reviews, imports, search and report layouts remain intact. A real baseline render is required before visual parity signoff, and an accessible focus/click/touch route must expose current and previous values. |

## 6. Critical business rules

1. **BR-001 Protected suite:** the official case corpus changes only through policy-authorized publication; project owner approves by default.
2. **BR-002 No self-approval:** proposing or executing alone does not confer approval authority. By default all protected projects require an authenticated human reviewer sign-off; a project’s stronger policy remains enforceable. An agent-generated approval is never equivalent to a human decision.
3. **BR-003 Proof before promotion:** a raw report is evidence, not an approved test case, official result, or confirmed defect. Analysis records uncertainty.
4. **BR-004 Partial approvals:** decisions are per proposal operation; chosen subset is explicit and atomic.
5. **BR-005 Revision-bound approval:** a material edit or base-case change blocks unsafe publication.
6. **BR-006 Agent interchangeability:** task and reporting contracts do not depend on proprietary OpenCode commands or Chrome MCP API shape.
7. **BR-007 No hidden bypass:** bulk import/export, AI assistants, user UI, REST, MCP and legacy paths obey publication policy.
8. **BR-008 Human authority:** auto-dispatch may be allowed independently of merge approval; these are distinct settings.
9. **BR-009 Manual GitLab filing:** publication into Tesbo does not imply GitLab issue creation.
10. **BR-010 Secret separation:** auth to Tesbo is distinct from any project target credentials/context held by an authorized executor.

## 7. Scope boundaries and open product decisions

**In-scope MVP:** multi-project operation with isolated project configuration and independent non-DMIS web-project proof; protected suite; task + prompt revisions; manual task dispatch; agent MCP task pickup; raw report/evidence; analysis drafts; human proposal review/edit/selective merge; issue drafts; audit and revocation; one real integrated demonstration.

**Out of scope MVP:** local Chrome access from Tesbo, native runner, Playwright/Appium execution implementation, event-driven auto-workstation startup, GitLab posting, chat-history replication, advanced AI orchestration and multi-agent consensus.

**OD-01** Should project owners be allowed to delegate the final merge authority to *other humans*? Proposed yes, auditable and policy-controlled.  
**OD-02** Should accepting official run results require a separate review from case-definition publication? Proposed configurable independently, default reviewer approval for manually synthesized results.  
**OD-03** What are the per-project evidence retention, residency, redaction, privacy and quota rules for the data class of the target? Policy required.  
**OD-04** Does the available ChatGPT plan/workspace support writable custom MCP and OAuth? Verify via an actual connector spike.  
**OD-05** On assistant-unavailable days, who synthesizes/report-review work? Human UI must support all operations.  
**OD-06** Should the user edit original prompts prior to task claim? Proposed yes, with authored revision and explicit dispatch authorization.  
**OD-07** If a project opts into external-source migration (Excel for DMIS), what constitutes a successful sample-to-full reconciliation? Propose sample-first then full reconciliation.

## 8. Requirement interpretation and completeness

All FR-001–FR-053, NFR-001–NFR-012 and AC-001–AC-012 identifiers are retained. Roles/profiles and permissions remain configurable; the default project-level human-approval invariant is enforced independently of runtime/product labels. A configured human direct-edit exception must be explicit, audited and unusable by an agent token borrowing that human's user ID.

Reports are untrusted evidence. Formatting profiles are versioned structured validation plus KB instructions/examples; they are not a second test store. Case lifecycle Draft/In Review/Approved is not proof of a pre-publication review decision. Current form access does not prove custom-field entitlement or persistence. Existing model-provider connections and issue-tracker OAuth must not be presented as a working ChatGPT/OpenCode connection.

## 9. Team-review decisions for revision 1.2

Five independent source reviewers checked security, staging/data, task/MCP orchestration, frontend workflow and integration/field fidelity against fork main `124f128` (remote HEAD confirmed unchanged). The README review register identifies corrections and source anchors. These are specification corrections, not completed product fixes.

- Protected workflow/format settings use reserved namespaces and explicit policy-admin CAS/versioned updates. Generic settings writes preserve those keys and cannot weaken the last-reviewer/default-human safeguards.
- Profiles have draft/active/retired immutable versions; activation shows affected instances, credentials and pending reviews. Historical versions remain readable; retired versions cannot be selected for new dispatch. Editing grants cannot expand a credential beyond its issuance ceiling without explicit reissue/delegation.
- Case-level expectations are distinct from per-step expectations; no inferred one-to-one matching or delimiter-based silent loss. Local requirement references are preserved as a typed list and remain distinct from provider ticket links; coverage/export must expose the supported mapped semantics, including bug_links.
- Exact tested snapshots bind at dispatch/execution and survive later case edits or privileged history-import refresh. Result correction is reviewed and append-only in provenance.
- Manual continuation is complete: a human can import original report/evidence, author analysis, stage/review changes and publish by policy without a connected agent/internal model key. Actual submitter and asserted source runtime remain distinct.
- Existing V116 already soft-deletes chats and changes review/message FKs to RESTRICT; do not repeat that migration. The surviving requested_by user-deletion cascade still requires explicit retention treatment.

Remaining owner choices are retention/quota, deployment entitlement rollout, exact workbook mapping and actual client/authentication availability. They cannot be treated as measured or approved by this source review. Permissions, policy and formats remain configurable within the default human-approval invariant.

Closure rule: new-case UUIDs allocate at apply; before review use stable logical new-target references. Initial current-attempt primary reports and authorized no-active-executor manual primary receipts can mark testing reported; supplemental/historical receipts never rewind terminal/analysis state. Exact lifecycle, manual active-executor behavior and committed-dependency satisfaction are defined in Workflow §10 and Technical Design §14.1.

## 10. Full-assurance product dispositions — revision 1.3

The following refine **existing** FRs and ACs, not an additional feature family. All related states are proposed and no current live implementation is implied.

| Decision | Existing requirement owners | Required normative behavior / owner of open policy |
|---|---|---|
| **D01 — Intended vs observed scope** | FR-002/003/009/021/025, AC-001/003/004/013 | Capture *intended* authorized environment/URL/build/tenant/role and a separately attributed *observed* set, including source/confidence and UNKNOWN/NOT_REACHED when inaccessible. Record each requested check as TESTED, BLOCKED or NOT_TESTED with reason/evidence; never claim unobserved client state. Product/QA validates semantics. |
| **D02 — Post-hoc result equivalence** | FR-007/021/023/024/042, AC-004/015 | **Default conservative policy selected:** after exploratory report with no case, publish approved case definition first, then execute its **exact approved immutable snapshot** before accepting official PASS/FAIL. Earlier observations can be attached to analysis only. A future retrospective equivalence route requires distinct explicit proof contract and owner approval; do not silently infer result acceptance. QA/result owner signoff remains required. |
| **D03 — External action/scope precedence** | FR-002/005/009/012/014/051, AC-002/016 | Structured allowed hosts/paths/roles/actions and safety restrictions are an upper bound; restrictive explicit deny wins over prompt prose, redirects, IdP login, new tabs, downloads or evidence egress. Contradictions clarify before action; an unreachable executor may remain physically active and Tesbo cannot retroactively undo external actions. Security/target owner defines approved redirects and IdP exceptions before use. |
| **D04 — Original evidence safety** | FR-018/019/022/024/051, NFR-006/011, AC-004/016 | Define capture → admission/scanning/size/type/PII/secret handling → quarantine/restricted original vs separately hashed safe redaction → scoped model consumption/export/telemetry. Preserve an exact admitted original, or restrict unsafe source and disclose a separately identified derivative; never mutate a finalized original silently. Privacy, quota, retention and exception decisions require project/security owner. |
| **D05 — Immutable reference completeness** | FR-002/019/025/026/052, AC-014/017 | Expose read-only exact KB/document/reference versions or dispatched immutable context snapshots, hash plus chunk/order/completeness receipts, and real client-consumable image/file bytes. Current mutable KB reads, RAG search, history metadata or restore mutation cannot substitute for exact-version reads. Authorized fresh-session continuation must not depend on an old model transcript. |

**Acceptance discipline:** Do not treat this spec revision as test execution. The planned QA-094–QA-122 scenarios and the existing QA-001–QA-093 require actual expected/actual evidence. DMIS pilot conditions reported in assurance (slow readiness, OIDC idle expiry and offscreen Item wizard actions) are test fixtures to verify, not live facts proven by source inspection. Cross-team formal closure, deployment SHA/schema verification and product owner decisions remain open; refer to README F01–F07.

### Revision 1.3.1 — requirement-to-proof correction

The acceptance matrix uses all 53 FR IDs explicitly, including FR-013/016/022/024/041/042/046/047/050/051/052 and the earlier abbreviated cross-references. QA-116–QA-122 separate the previously implicit role/action permission matrix, management-UI facts, immutable original-report mutation denial, observed-versus-official result states, DMIS authoring-profile validation, per-interface audit attribution and prompt-secret ingress handling. These are tests against existing FRs, not new functional requirements. Owner policy decisions and live execution remain open. The conservative post-hoc result policy is a **proposed fail-closed baseline pending named product/QA ratification**, not an already authorized exception to other lifecycle rules.

### Revision 1.3.2 — NFR validation precision

NFR-001–NFR-012 retain their original scope and identifiers. Their implementation acceptance is evidenced by **directly linked** QA scenarios, not just matching architecture prose. In particular: portability means an actual second independent MCP-capable runtime with unchanged business schema; evidence integrity includes malware/quarantine and private-byte delivery; traceability requires walking an approved case revision backwards to exact operation/decision/task/report/source; observability needs useful queue/lease/auth/merge measurements without leaking prompts or credentials; performance thresholds must come from measured Railway/staging baselines and approved workload/percentile targets, not guessed numbers; and retention/privacy must test deletion/expiry/hold without damaging audit/provenance.

NFR-009 additionally requires a declared supported browser/OS/assistive-technology matrix, 200% text zoom, 320 CSS-pixel reflow, full keyboard operation, and neutral fail-safe handling of unknown future server states. These refinements attach to existing UX-09 and QA-080/114/129; they are **not new screens or a new design system**. See QA-123–QA-129 in the same implementation backlog; none is marked executed.

## Revision 1.3.3 — implementation-policy decisions and canonical-source discipline

**Binding pilot decisions:** README PD-01–PD-08 set the default policy for implementing the existing FRs. These do not add new FR IDs, waive project-plan gates or substitute for organizational approval. Specific owner decisions:

- **FR-013–FR-017/030–035/050:** protect approval and merge as distinct current human grants; project-owner/delegated human approvers only; a credential issuer or machine runtime never acquires human authority. If the last human reviewer would be removed, deny the policy update. Defaults are fail-closed on omitted/unknown grants and policy versions.
- **FR-002/009/051:** manual dispatch and target-specific action scope by default (read-only HTTPS origin/path for the initial web adapter), with separately reviewed target host/path, IdP/redirect, mutating interaction, credential-delivery and download/evidence-egress exceptions. Project/server policy restricts prose. No automatic wake-up or browser control is promised.
- **FR-018/019/022/025/051/053:** synthetic pilot only until the pilot project’s applicable data governance is authorized. Bounded private uploads (25 MiB/object, 250 MiB/report, 2 GiB/project), 24h pending-receipt expiry and 7d synthetic-evidence retention subject to hold; failed scan or policy check blocks finalize. No implicit publication or policy-free export. For actual DMIS evidence owner-selected retention/classification/region/redaction are gating inputs.
- **FR-001/006/010/011/014/015:** independent external runtime identity and manual pickup; no Tesbo AI model-key consumption, but normal project membership/writability/entitlement applies. Agent-polling remains optional, configured and verified; no cross-client entitlement assumptions.
- **FR-041/044/045/048:** original imported source (Excel in pilot) remains byte-preserved, with explicit approved source-ID/native-ID and all authoring/observed-result mappings through staged import, conflict resolution, full readback and independent recovery; exact mapping blocked pending actual workbook and format-owner signoff. No title-only deduplication.
- **NFR-009/012 and ACs:** initial supported desktop QA baseline includes Chromium + Firefox on the selected OS, responsive/zoom/keyboard/screen-reader proof; measured P95/P99/load targets and real client MCP auth remain acceptance gates rather than guessed PASS criteria.

**Release interpretation:** `design selected` is distinct from `owner ratified`, `implemented`, and `tested`. Organizations retain authority over real protected data/retention and subscription policy. QA evidence must record every status explicitly, never silently upgrade a synthetic pass.

**Conversation thread semantics:** A QA session may contain multiple native/external client conversation threads, separately attributed and summarized, and multiple linked executor task attempts. Native message history persists when Tesbo hosts the thread; externally hosted chat content is known only to the extent deliberately submitted through MCP. `FR-054`, `FR-064`, `FR-066` and `FR-067` apply at project → session → thread as relevant, without cloning canonical KB or creating a separate Copilot for each thread.


## Revision 1.4.5 — assurance clarifications (no new platform requirement IDs)

- **QA session versus conversation thread:** a stable project-scoped QA session may aggregate multiple separately authorized native or external conversation threads, task attempts, and summaries. Existing `zyra_chat_sessions` are candidate conversation-thread records; do not silently reinterpret one chat row as an entire multi-thread investigation without preserving old messages/review links. Distinct session membership and thread visibility must be approved and enforced.
- **MCP OFF behavior:** this controls **all external Tesbo MCP clients**, including user-managed executors whose workflow depends on Tesbo MCP. Users can allow one named external client and deny another only when project MCP is ON and narrower grants are configured. Label the consequences plainly in Project Settings. No opt-in migration of legacy broad-scope tokens is implicit.
- **Summary truth:** user-triggered or opportunistic summary capture is supported; periodic automatic summaries require a genuinely configured scheduler/client that is running and authorized. Summaries are claims with declared coverage, not guaranteed complete ChatGPT/Claude transcripts or verified executor observations.
- **Source identity:** existing externally linked Requirements/Jira/Linear/Notion tickets and Knowledge Base documents must expose the historically used original revision/snapshot where available. A current mutable ticket cannot silently replace an immutable source assumed by an old task. Identical project KB documents must resolve to the canonical record/version unless a deliberately separate item is explicitly authorized; no accidental cross-project deduplication or leaking a source's presence.

## Revision 1.4.6 — journey completeness and existing-module invariants

No new platform feature abstraction or FR ID is required for the 27-group assurance review. The 70 existing requirements continue to govern both external MCP and native Copilot, but the following **binding interpretations** close otherwise ambiguous cross-module cases:

- **FR-055, FR-061, FR-065, FR-066, FR-069:** authorized source identifiers (external ticket/document/file, test-plan/case/run/Bug ID, report and private export link) resolve within the correct project/organization. Identical external source IDs in two different projects must neither conflict unexpectedly nor disclose that another tenant has the source; code/migration compatibility determines whether project-qualified identity, explicit shared ownership or a scoped reference table is the right implementation. A dedupe mechanism is not permission to share private source content.
- **FR-014, FR-037, FR-065, FR-066, FR-069:** every material mutation and downstream projection must be tested through all available applicable entrances: native UI/REST, external MCP, legacy Zyra, bulk imports, sync/integration adapters, scheduled work, outbound webhook/notification and authorized sharing/export. Distinguish writers from read-only observers; policy is enforced at the authoritative writer rather than by UI hiding. A notification/webhook may report an approved event but must not create independent QA truth.
- **FR-018–025, FR-067–069:** original reports, evidence and acceptance decisions remain authoritative over derived summaries, Insights and exports. Summaries and projections carry original IDs, authorization, event/definition versions and provenance; retry/replay never doubles official case/Bug changes, execution acceptance, alerts or metrics.
- **FR-054–070:** the external ChatGPT/Claude MCP client and native single Copilot are equally governed *entry paths*, not identical conversation-transcript sources. One QA session can link multiple native/external conversation threads and executor attempts; client-private transcript capture is never assumed.

The 27-journey/123-trace evidence is G0 reasoning for the declared QA-orchestration scope; no feature is certified as tested. Formal independent inventory comparison and live G2/G3 demonstration remain release evidence gates, not new runtime requirements or implied results.

## Revision 1.4.7 — reconciled technical change

Baseline: the same eight rev-1.4.6 files and pinned fork were reviewed in the completed Work second-pass (G0/G1 only). Read `00_README.md` for version/evidence and the standalone reconciliation audit for all IA-001–IA-040 dispositions. The content below records only this document’s assigned responsibilities; no live acceptance or source change is claimed.

### Binding scope and unresolved human product decisions

- **Existing-domain safety (FR-014/015/037/053/055/060/061/065/066/069):** actual credential ceiling and current project membership/entitlements apply to every REST/MCP alias, direct, bulk, nested child-link and background writer. Read-only MCP operations remain readable under read-only entitlement; project write locks enforce *semantic action*, not POST/path spelling. A parent-project grant never confers ownership of foreign child records. Invalid credential scopes MUST error, not increase authority. These are strengthened acceptance interpretations of existing FRs, not new feature primitives.
- **Original versus derived knowledge (FR-055/061/067):** accepted source/version and storage bytes are distinct from search embeddings and summaries. Reindexing MUST converge on latest source revision, must not mark invalid/no-vector replacements ready and cannot destroy the last usable generation without explicit recovery. File restoration MUST not imply original bytes are available when storage is gone. Source mirror restoration respects the already-project-scoped V72 unique constraint.
- **Cross-module truth (FR-021/023/024/037/069):** Bug links do not silently create an approved execution-status correction; human/product owner must ratify whether they represent a separately governed run correction or a derived defect flag. Pending AI proposals never count as approved case/run/Bug history, reporting or Insights metrics. Export scope and filtering must represent what user actually selected.
- **Task/summary lifecycle (FR-009/019/026/053/067/068):** a cancelled or expired attempt lacking a primary original report receives an explicit no-original/late-evidence recovery disposition; a post-finalized executor summary has separate bounded authorization and must recheck the referenced source grant. Requested check/finding IDs persist through split/merge/retest revisions with no silent omission. Cleanup outcomes for authorized target mutations are declared as cleaned, not-cleaned or unknown; new mutation requires fresh authority.
- **Platform prerequisites (NFR-001/002/003):** current signup challenge/payload binding, proof single-use/session invalidation, role-safe screens, mutation retry, and entitlement/billing event recovery are separately owned platform remediations. No promise is made that this QA-orchestration feature independently redesigns accounts or Stripe. These behaviors must be verified for supported release configurations.

**Historical BUG-EFFECT-01 discussion, fully superseded by revisions 1.4.8–1.4.9:** Direct/side classification and no silent Bug-induced result rewrites are binding, and the official current view now shows corrected effective status with preserved previous history in either direction.


## Revision 1.4.9 — accepted status-correction display and interaction/relationship completeness

The product owner has resolved the remaining post-approval status presentation: show **current effective result with correction provenance**, in either direction, with audit history of *every* status transition. Field-level history is a progressive projection of existing version snapshots/audit, not an independent mutable field-history store. Case steps and expected conditions must work as a guided execution procedure, preserving the separate semantics of performed actions and verified outcomes. Cross-module connections must be typed and pinned to correct entity/version/occurrence grain; a relation is not evidence of causation by itself. Refer to FR-079–082 and AC-034–037. This section supplements, rather than replaces, the 1.4.8 direct-versus-side finding policy.

## Revision 1.4.8 — BUG-EFFECT-01 decision and module guide policy

**Historical BUG-EFFECT-01 decision (completed by revision 1.4.9):** direct failures of the current test's applicable required condition fail that execution; an incidental discovery must not fail an unrelated execution. A side finding prompts existing-coverage/defect search and may lead to an approved revised/new regression case and later independent retest. Accepted historical observations cannot be replaced by mere linking. Later owner decision: the authoritative effective status shows `Failed (corrected from Passed)` or `Passed (corrected from Failed)` after a separately approved append-only amendment; the original remains permanently accessible.

**Operational playbook directive:** user-configurable per-project/module writing conventions (for instance a GitLab defect template) must be applied consistently across AI clients, but mandatory permissions, source provenance, observed result semantics and human-reviewed publication are code-enforced.

## Revision 1.4.10 — existing-surface fidelity requirements (clarifications; no new FR IDs)
- FR-080/FR-082 implementation **MUST reuse** the existing Run execution drawer and full execution page, providing equivalent frozen-definition step/action/condition/evidence semantics in both; a compact read-only step card must not become a second independently maintained result owner.
- FR-071–FR-075/FR-079: a Bug logged as a side finding **MUST remain visibly linked in Passed, Untested, Blocked and other applicable attempts** without automatically failing the attempt. A direct failure requires a violated applicable assertion and appropriate accepted result; `bug_links` alone must never be interpreted as proof of assertion failure.
- FR-079 effective-result correction history must extend current execution status UI; the Test Case `status` is definition governance (Draft/Approved/etc.) and must never show execution Pass/Fail. Existing test-case version history supports definition-field diffs, but does not by itself supply execution result event history.
- FR-082/FR-076–078: keep existing create/edit panel, tabs, suite tree, filters, table preferences, field validation, and Create/Create & Add Next; reorganize optional fields by progressive disclosure only after parity checks. Accessible hover/focus history and contextual QA Playbooks must be additive, not permanent extra columns or a duplicate authoring screen.
- Source-observed repository-summaries/row-status disagreement must be tested for consistency after create, edit, archive/deprecate, filter, pagination and optimistic save. Screenshots alone do not prove a reproducible backend status defect.

## Revision 1.4.11 — in-place execution UI fidelity (no new FR/AC)

FR-071–075, FR-079–082 and AC-029–037 retain their approved meanings. **Explicit existing-interface requirement:** Both `cycles/[cycleId]/page.tsx`'s Run drawer and `cycles/[cycleId]/execute/[executionId]/page.tsx`'s full execution must reuse the same frozen-definition action/condition data contract and interaction behavior. The Test Case authoring panel and repository retain all existing functionality; no second case editor or execution owner is permitted. Keep real status/evidence/bug primitives. **Correct `LogBugDialog`'s unconditional Failed language:** a `SIDE` or `UNDETERMINED` occurrence must never cause a false Failed assertion or status, and linking then refetching must show authoritative effective status in either execution view. In-progress action/condition events survive interrupted drawer/page navigation and reload. Planned tests QA-277–QA-279; all NOT RUN. Review evidence and interactive prototype are design artifacts, not validation of deployed behavior.


## Revision 1.4.12 — source/visual authenticity invariant

FR-079–082 and the other in-place UI requirements are unchanged. **Acceptance of visual equivalence requires actual running-UI evidence** from the specific baseline build, not a restyled clone of its markup. No proposed UI may omit/replace an existing control, route, keyboard path or interaction solely because an artist's Before mock omitted it. A source-based screen contract may identify required behavior, but it must be marked **not visually verified** until rendered/captured in the actual application. Real supplied screenshots govern the pictured screens; do not extrapolate their geometry to other unpictured screens.

## Revision 1.4.13 — source-verified attempt and historical-provenance correction

The binding distinction is **definition vs historical snapshot vs actual attempt vs mutable projection vs imported history**. Existing V119 already snapshots full Test Case fields into `cycle_items` and backfills older Run items from then-current Test Case rows; earlier descriptions of all `cycle_items` as title-only must not govern new implementation. V119's retrospective backfill **does not prove** the exact definition at an older execution time. V140 `executions.step_results` is positional imported result data, while `executions.history` is imported earlier results within the same Run, **not** a reviewed status-correction journal. V63 records pre-update Test Case snapshots, not an explicit initial creation-version event. Later migrations and actual deployed DB DDL require verification before any migration.

One execution/cycle item and one case/cycle (`V3`, `V78`/`V79`) can represent several logical tries through imported result history or future retests. Consequently FR-071/075/079–081 MUST bind every observation, evidence reference, direct/side relationship, correction and retest to a **stable occurrence/attempt**, not merely the mutable `executions.id`; preserve the canonical Run/Execution owner and compatibility reads instead of starting an unrelated testing system. Existing `bug_links` active uniqueness on `(bug_id,testcase_id,cycle_id)` after V117 is not a safe per-occurrence identity; preserve it as an older association projection while adding evidence-grounded typed occurrence semantics. An execution attachment under one `executions.id` is not automatically attributable to every result in its history. A legacy positional step result cannot be mapped to a reordered authored condition without independently verified correspondence.

The result and field histories remain intentionally separate: imported older result values, accepted result-correction events, and Test Case definition diffs must never display as interchangeable evidence. When provenance is unknown, say `historical definition unverified` / `legacy imported result` and avoid a fabricated verified PASS or causal link. New read APIs and reports must make `effective current status`, `original accepted observation`, `all attempts`, and `unverified historical reconstruction` explicit with permission-aware projections. These are source-grounded refinements to the existing Test Case, Run, Bug, evidence and analytics modules. Acceptance: AC-038–AC-040 and QA-280–QA-301, all NOT RUN.

## Revision 1.4.14 — all-module source audit and authoritative cross-surface invariants

The source-wide inventory includes 857 tracked files, but directory/file enumeration is **not** the same as independently reviewing every file or executing every journey. The separate `Tesbo_Deep_Module_and_System_Source_Audit_v1.4.14.md` and module ledger disclose per-system evidence and open areas. This revision adds **only** three net-new enforceable invariants FR-085–087 and AC-041–044; previously reconciled IA-001–IA-040 findings remain owned by the existing backlog, not duplicated as features.

- **Plan and authorization policy:** `ProjectWriteLockGuard` is globally installed but its regex matches only `/api/projects/<UUID>...`; other current mutating routes use `/api/cycles/...`, `/api/bugs/...` and `/api/mcp`. The guard returning true on those paths is source-confirmed. Whether a downstream service independently rejects each write has not been proven and must be decided by integration tests. Existing current-principal, child-ownership and selected-apply protections remain mandatory.
- **Audit/provenance:** current `AuditService.log` catches failures and warns. V62 prevents mutation of committed `audit_logs` rows but does not guarantee that a critical audit insert succeeded, nor verify the running database role. Protected human corrections/approvals require a transactional audit or durable outbox contract; do not claim existing activity events are sufficient without proof.
- **Bug link multiplicity:** V48/V117 limit an active `bug_links` row to one `(bug_id,testcase_id,cycle_id)` relationship, regardless of future attempt IDs. It remains a correct case/run association for legacy reads, but it cannot be treated as the authoritative collection of distinct SIDE/DIRECT findings per attempt. Reuse the case/run/Bug owner, extend with typed observations and optional projections; do not create a rival Bug tracker.
- **Existing UX and services:** reuse the Knowledge Base `ChangeHistoryList`, `ChangeDiffModal` and `ChangeHistoryTrigger` as reference implementations for contextual history; existing `ReviewBoard`, Zyra review UI, `ExecutionEvidencePanel`, `LogBugDialog`, `RepositoryTestCaseTable`, import mapping, report views and Run drawer/full page stay the primary routes. Imported V140 history and V119 migration-time snapshots retain their separate provenance.
- **Outcome and breadth:** failed or stale reads are not clean empty states, cached summary is not authoritative inventory, a screen smoke test is not acceptance, and SDK/worker/MCP are distinct writers over the canonical domain. Source-only findings carry G0/G1 labels; live G2/G3 and deployed DDL verification remain open.

## Revision 1.4.15 — source-grounded causal delivery, trustworthy actor and semantic-link integrity

### Binding incremental requirements

| ID | Priority | Requirement |
|---|---|---|
| FR-088 | MUST | Existing Tesbo automation reporter/ingest and agent-result paths MUST distinguish **attempt order** from network arrival, retain immutable attempt/event identity and reject or record as superseded an older attempt arriving after a newer result, including parallel shards and same-key/different-content collisions. Finalized Run lifecycle MUST linearize result delivery with closure: no silently accepted result, evidence or status mutation after finalization except a separately authorized reopened/new attempt; close, retry and lost acknowledgment use durable receipts and accurate counter reconciliations. Preserve the Playwright reporter and existing Run domain. |
| FR-089 | MUST | The authoritative execution owner MUST preserve the original performer and execution timestamp on metadata-only changes (assignee, comments or unrelated fields). An actual observed result, new attempt and reviewed correction are separate attributed events with durable original/effective values; an update through a nested URL MUST validate that the requested parent owns the child. A revised outcome cannot arise from relabeling another actor's metadata edit. |
| FR-090 | MUST | Every proposed or published Bug/Requirement/Test Case/Run/Execution/evidence relationship MUST be checked as a **coherent typed lineage**: project and actual parent/child ownership, source record/version, applicable execution attempt and assertion grain, and direct-versus-side role. Individually valid IDs are insufficient if they do not belong to the same chain. Invalid triples fail without partial changes or cross-project disclosure; repair current Bug-link creation/replace/add paths, not a new Bug store. |

### Focused acceptance criteria

| ID | Required acceptance proof |
|---|---|
| AC-045 | A failed old SDK test attempt is delayed while its successful retry arrives first; delivering the old result last cannot replace the newer accepted outcome, fabricate a correction, increment one logical result twice, or reassign newer evidence to the old attempt. The same rule holds for same-key/different-payload and parallel-shard deliveries with deterministic receipts. |
| AC-046 | A Run close races with result, retry and evidence delivery, followed by lost close acknowledgment and a late result. The final Run state and reported totals reflect one authoritative linearization, with either documented rejection/superseded receipt or separately authorized reopen/new attempt. Reporter UI/CLI cannot say “closed” if close failed. |
| AC-047 | A person changes only an execution's assignee/notes: original `executed_by`, `executed_at`, attempt and evidence identity survive. A different execution ID under a well-formed but incorrect `cycleId` URL is denied, even if the user can access both Runs. An intentional corrected result creates an explicit audited correction with original and new actor, not an overwrite disguised as execution. |
| AC-048 | Bug creation, edit, replacement and `/api/bugs/:id/links` reject a same-project Test Case/Run/execution ID combination whose parent-child lineage does not match. No unrelated execution is auto-failed, no dangling/foreign or logically false association is published, and the SIDE/DIRECT classification remains tied to the exact actual observation. |

**Source verification scope:** pinned `legacy.service.ts` lines ~7065–7177, 7563–7685, 7737–7810, 8492–8523; Nest controller PATCH route at ~726; automation service ~400–530 and ~565–650; reporter `onTestEnd`/`onEnd`. These are actual code constructs, **not live reproductions**. Application behavior after deploy, current DB policies and legitimate owner exceptions require tests.

## Revision 1.4.16 — additional source-grounded requirements

| ID | Priority | Requirement |
|---|---|---|
| FR-091 | MUST | Preserve truthful **per-ticket outcome accounting** in the existing Jira/Linear/Notion sync service. One ticket contributes exactly once to run completion regardless of success, storage rejection, invalid initial upsert, permanent queue failure, duplicate delivery or interruption. Define processed as a disjoint category or a total inclusive of failures, but never count it both ways. A run with invalid/skipped source tickets must not appear cleanly succeeded; a partial result, retry visibility, error/disposition and resumable cursor must accurately reflect skipped, processed and failed counts. Finalization cannot precede all terminal ticket outcomes. |
| FR-092 | MUST | Preserve the existing Review Board analysis worker, but bind every claim/reclaim to a monotonic **lease generation or claim token** and fence heartbeat, terminal completion, recommendation updates and failure writes on that identity. A stale claimant that resumes after another worker has reclaimed its run must not publish findings or invalidate the newer claimant; preserve selected-review actions, fingerprints and exactly-once publication semantics. |

**In-place behavioral clarifications to existing current-UI and concurrency requirements:** Requirements source switches and ticket/filter/history responses must be keyed to the current project/provider/filter/request generation; a late response for Jira cannot replace Linear's current tickets/history or poison the project cache. API errors must not silently become zero linked Test Cases, disconnected provider, no requirements, or no source history. Plan detail independent reads may fail, but a progress-only or secondary-list failure must not redirect the user to `/projects` as though the Plan were missing/unauthorized. Preserve edit/create draft and show recoverable errors through existing status/error components. Reuse existing views and error handling; no new feature ID is imposed for an already required failure-state principle.

| ID | Acceptance criterion |
|---|---|
| AC-049 | With two integration tickets, the first ticket hits storage limits. After it returns `processed:1,failed:1`, Run remains incomplete until the other ticket settles and reports the correct partial/failed counts. One ticket is not counted as two completions; duplicate delivery does not double increment. |
| AC-050 | When every initially fetched remote ticket fails validation/upsert before being queued, sync status is not `succeeded`, a clear visible failed/partial disposition is recorded and an authorized next sync can retry without silently losing those tickets. |
| AC-051 | Review analysis worker A loses its lease and worker B reclaims. A resumes and attempts heartbeat, persist or failure update; only B's claim-generation may modify the authoritative run or recommendations. The accepted review results and reviewer decisions remain consistent after retries and restarts. |
| AC-052 | Rapid Requirements provider switching with out-of-order list/history and linked-coverage responses never shows mismatched provider data or false zero, and transient Plan secondary fetch errors do not redirect away from the existing Plan or discard edits. Recovered data and current context are correctly presented. |


**Clarification of FR-091 and FR-085/090:** The provider's authoritative sync cursor must advance only when all intended source revisions have either been successfully mirrored or explicitly retained as durable, source-addressable retry obligations. A `partial` run is not automatically safe as a completed incremental checkpoint. Reuse current provider ticket IDs and sync-run cursors to enable retry even when an upstream item's `updatedAt` precedes the last partial run start. For Plans, source IDs and parent-child associations must resolve to the same project, including `Plan→suite/testcase` and `Run→Plan` both on creation and reassociation. Do not rely solely on single-column foreign keys or the caller's access to the parent Plan.

| ID | Acceptance criterion |
|---|---|
| AC-053 | A non-truncated partial nightly integration sync leaves an unchanged source ticket unmirrored. The subsequent incremental cycle retries that ticket or retains a durable, source-addressable retry obligation, regardless of whether its upstream timestamp predates the last partial run. |

## Reconciled integrity and atomicity requirements — same existing spec

The existing FR-085/FR-090 cross-project relationship and last-write protections also apply to Plan→Suite/Test Case membership, Run→Plan creation and reassociation, soft-deleted relations and scoped Plan-Run projections. Enforce these in the existing Plan/Run services and DB constraints as appropriate; do not create a parallel Plan module or a second requirement ID for the same ownership invariant.

FR-091 also includes the source-confirmed missing terminal-status guards on `IntegrationSyncService.markRunning`, `setStage`, `setTotals` and `recordTicketResult` and the valid incremental cursor after a partial run; prefer the already specified T-435 and AC-049–050/053 over any duplicate Sync requirement. FR-092 and AC-051 already cover Review Board reclaim-generation fencing; no second Review Board requirement is created.

| ID | Priority | Requirement |
|---|---|---|
| FR-093 | MUST | The existing Zyra save/review path must create its dependent Suite and persist its selected Test Cases as one atomic, idempotent transaction, following task/selection validation. Invalid, stale, rolled-back and retried saves must not leave empty/orphan Suites or partially committed results. |
| FR-094 | MUST | Zyra update/archive and any indirect Test Case writer must validate the target's owning project both at the authoritative read/lock and the final SQL write; a staged or synthetic foreign ID must not change or archive foreign project data. Keep the existing review, actor attribution, soft-delete and audit model. |
| FR-095 | MUST | Knowledge Base change handling must treat semantic changes to persisted `contentJson` as content changes even when title/HTML/plain text are unchanged: version history, change notification, approved `ai_memory` review invalidation and embedding freshness must remain consistent. No-op updates must not generate fake revisions. |
| FR-096 | MUST | Knowledge Base edit and restore operations must serialize or compare versions across the complete read/diff/history/write transition, preventing lost updates and ensuring one truthful ordered version trail. Reuse existing document and revision tables, advisory locks, review and indexing services. |

| ID | Acceptance criterion |
|---|---|
| AC-054 | Known foreign-project or deleted Suite/Test Case/Plan IDs are rejected in Plan membership and Run association APIs, without cross-project Plan/Run reads or partially changed relations; a legitimate same-project link still works. |
| AC-055 | Zyra Save with suiteName and an invalid task, invalid selection, failed transaction or uniqueness retry produces no orphan Suite; a completed valid Save links exactly the selected Cases once in both feature-flagged saving modes. |
| AC-056 | A staged Zyra update/archive targeting a foreign-project Test Case, including within a mixed batch, is rejected atomically with the foreign row unchanged; exercise its real exposed caller paths to determine exploitability. |
| AC-057 | A JSON-only Knowledge Base edit creates the correct revision, invalidates prior content approval and stale embeddings where applicable; an unchanged write does none of those things. |
| AC-058 | Concurrent Knowledge Base editors, and a simultaneous edit/restore, cannot silently overwrite changes or create divergent history/version order; stale inputs are rejected or merged under the declared transaction policy. |

## Revision 1.4.17 — newly identified cross-surface invariants

**Clarification to existing FR-085 / FR-086 / FR-090 (not a duplicate requirement):** The *presented credential* must be independently authorized at every REST, MCP, SDK or background mutation. A machine bearer with `read` scope cannot acquire write authority by routing to an ordinary browser API that trusts `req.userId`; revoked project membership, invalid/unknown scopes, cancelled policies and credential disablement must fail closed at the authoritative service boundary. Existing per-project consent, current entitlements and durable audit requirements apply unchanged. Token creation may not silently broaden an unknown/empty scope input to `read,write` without explicit authorized default policy.

| ID | Priority | Requirement |
|---|---|---|
| FR-097 | MUST | The existing publicly shared Test Run must expose **only** the documented fields consumed by its unauthenticated report, not whole database rows or internal identifiers/secrets. Preserve the current `/share/[token]` page and `/api/public/shared-runs/:token` routes, but apply explicit publication permissions, revocation and token lifecycle; disabling and subsequently re-enabling must not unexpectedly reactivate a leaked old link. |
| FR-098 | MUST | The existing password-reset flow must consume each live reset token **at most once under concurrent requests** and commit password change, token consumption and persistent session invalidation as a coordinated recovery transition. A crash, timeout or duplicate submission cannot leave another active unauthorized session, permit replay, or leave the user with an undiscoverable partially completed reset. |
| FR-099 | MUST | Existing project custom-tag assignment and custom-field undo/restore must preserve recorded values and respect current metadata uniqueness. When a supplied replacement tag ID is stale, invalid or belongs to another project, do not silently clear valid prior assignments. When a deleted field's name was reused, return an intentional recoverable name-conflict outcome, not an uncontrolled unique-constraint failure, while maintaining the field's original saved values. |
| FR-100 | MUST | The existing daily analytics-to-Basecamp report must have a recoverable, claim-fenced **external publication receipt** so a BullMQ retry, lease expiry, concurrent worker or crash after external posting cannot silently double-publish a given date's report or mark a report posted without matching external evidence. Reuse existing analytics job, DB run and Basecamp client. |

| ID | Acceptance criterion |
|---|---|
| AC-059 | An authenticated human's **read-only** API bearer token is rejected when calling existing POST/PUT/DELETE/bulk/import REST mutation routes, even when that human is a project member; read MCP functionality remains available within current permissions. A write-scoped token cannot bypass current project membership, consent or entitlement. |
| AC-060 | Invalid/unknown/empty token scope input cannot silently become unrestricted read+write without an explicit approved and visible default; revoke/remove membership immediately blocks both REST and MCP use as specified by the current credential policy. |
| AC-061 | An unauthenticated shared-Run detail response includes only public page fields (name, description, status, environment, build/version and visible dates as needed); it does not disclose `share_token`, project/user identifiers, internal metadata or private execution details. The existing public executions route remains intentionally projected. |
| AC-062 | Disabling public sharing makes the URL unusable. Re-enabling issues a fresh authorized token or requires deliberate controlled reuse with an explicit owner decision; an old leaked URL cannot silently regain access. Confirm who may publish a Run before shipping. |
| AC-063 | Two simultaneous submissions of the same password-reset token cannot both change the password. Exactly one valid consume succeeds and the other receives a normal used/invalid-token response. |
| AC-064 | A failed password update, token-consume, or session-invalidation step does not leave an accepted-but-reusable token or an active previously authenticated browser session after an acknowledged completed reset. Cache/session invalidation must be ordered safely around the committed DB transition. |
| AC-065 | Replacing a testcase's tags with an invalid/foreign/stale ID returns a deliberate validation outcome and preserves existing tags; an intentionally empty valid selection still removes all tags. Valid project tags remain independent of `automation_tags`. |
| AC-066 | A deleted custom field whose name is now owned by another active field cannot be restored as a duplicate; the existing session-local Undo control shows a conflict without losing the deleted definition's historical values. Restoring a non-conflicting field succeeds. |
| AC-067 | An analytics worker whose claim expired or whose Basecamp request succeeded before its DB acknowledgment cannot create a duplicate external report on reclaim/retry; current and stale claim generations and the remote receipt resolve deterministically. |

## Revision 1.4.18 — session learning and governed product-specification distillation

These requirements extend existing session, Guide, Requirements/KB and review owners. They do not authorize a parallel repository or implementation of every discovered feature. Product proposals are problem-led and product/agent-neutral; DMIS and OpenCode are pilot examples only.

| ID | Priority | Requirement |
|---|---|---|
| FR-101 | MUST | Capture attributed session observations of workflow friction, corrections, repeated workarounds, missing capabilities and successful reusable practices. Preserve source project/session/thread/event or document revision, original-versus-summary evidence, observed-at and distilled-at, source coverage/gaps and permissions. Separate observation from interpretation and principle/Guide candidates from product-improvement candidates. Native and external observations use the same domain semantics. |
| FR-102 | MUST | Maintain one canonical project-scoped product-discovery candidate with many source observations. Before proposing a new capability, inspect accessible current functionality, specifications, relevant approved decisions and existing candidates; preserve check scope/version and UNKNOWN when inspection is incomplete. Classify defect, existing-capability discovery, workflow improvement, principle/Guide, product proposal or no-action. Exact replay is idempotent; semantic similarity may recommend reconciliation but cannot silently merge distinct purposes, permissions or approvals. Retain rejection/deferral/supersession history and counterevidence. |
| FR-103 | MUST | Convert eligible discoveries into draft amendments of existing canonical specifications, including problem/evidence, impact with uncertainty, alternatives/no-change option, scope/non-goals, reuse audit, affected requirements/workflows, security/data/MCP implications and testable acceptance criteria. Bind proposals to exact source, candidate and target-document revisions and explicit patch hashes. Human review of a candidate is distinct from approval of a specification amendment and authorization to implement. Reuse protected exact-revision review/apply; stale bases or changed relevant inputs invalidate approval. No autonomous principle adoption, official record publication or application code/deployment follows from drafting. |
| FR-104 | MUST | Support authorized, bounded retrospective distillation of selected sessions/date ranges/documents and incremental checkpoints. Declare requested, retrieved, examined, excluded and unavailable sources; preserve original timestamps and do not claim private provider histories were imported. Store processed source revisions/ranges for resumable idempotent review; changed sources require explicit re-evaluation, not silent history rewriting. Automatic checkpoints require configured execution, source authorization and resource limits; missing infrastructure yields NOT_SUPPORTED/BLOCKED rather than a promise of background completion. |
| FR-105 | MUST | Expose session Learning & Product Discoveries through the existing single Copilot/session UI and shared authorized MCP/domain services, with project-level reconciliation using existing Requirements/Insights/KB destinations. Native and external clients see the same permitted candidate/decision versions. Reauthorize source and destination independently; cross-project promotion requires explicit permitted transfer/sanitization and must not leak restricted evidence, titles or identifiers. Trace approved amendments through tasks/PRs and actual workflow validation; implementation/validation states never follow automatically from a merged document or a passing model evaluation. |

### Acceptance criteria — new capability, not executed

| ID | Acceptance criterion |
|---|---|
| AC-068 | Native and external session observations preserve exact permitted source lineage, distinct event/discovery timestamps and evidence completeness; generated fixture/summary data cannot become an observed execution result or binding principle. |
| AC-069 | Replayed observations do not duplicate candidates; independent observations can support one candidate, existing requirements are reused, materially distinct needs are not silently merged, and rejected proposals retain their decision history. |
| AC-070 | An amendment is an exact reviewable diff against canonical document revisions. Only separately authenticated authorized human approval permits selected apply; stale base/source/candidate changes, malicious source text and partial-write failure cannot publish unapproved content or alter unrelated artifacts. |
| AC-071 | A bounded historical review reports coverage/gaps truthfully, resumes without duplicates and distinguishes original from derived evidence. Scope revocation, missing provider history or resource exhaustion leaves an explicit incomplete/blocked checkpoint, not fabricated completion. |
| AC-072 | A permitted second client resumes the same discovery and sees the same review state; other projects/private threads remain inaccessible. Approved requirements link to implementation and actual validation without automatic implementation, PASS, deployment or cross-project data transfer. |

## Revision 1.4.19 — default workspace testing skill pack and versioned asset scope (PROPOSED)

**Ownership/anti-duplication:** FR-076/077 and T-422 remain the one canonical **QA Standards & Playbooks** owner; FR-027–037 remain the single shared proposal/review/apply workflow; FR-046 is the configured authoring profile; FR-078/081/082/084 retain case history/typed links; FR-101–105 retain governed observations and learning. The following ID additions cover only the genuinely uncovered workspace-installation, platform-source distribution, actor-first method, Requirements mapping and per-asset history semantics. They do not authorize a second skill/requirement/test management system.

| ID | Priority | Requirement |
|---|---|---|
| FR-106 | MUST | Every newly created workspace SHALL receive an idempotent reference to the current **approved** Tesbo default testing-pack revision using existing organization/workspace provisioning; assignment MUST be atomic or provably recoverable, unique under concurrent retries, independent of project creation, and MUST NOT enable external MCP, launch execution, or create case/requirement/results. Existing workspaces adopt by separate explicit approval; fail closed if no valid published pack exists. |
| FR-107 | MUST | Maintain ONE platform-owned published immutable core testing-pack identity, section/template references, revision number and content hash within the approved QA Standards & Playbooks substrate (FR-076/077, T-422). Workspaces pin a particular published revision without mutable copies. Approved explicit upgrades retain prior revisions, rollback as a new reviewed assignment, history and generating-method provenance. A platform-wide pack publication requires an independent authorized human/policy gate; project edits cannot alter the global pack. |
| FR-108 | MUST | Resolve an effective testing-method manifest deterministically: non-overridable platform/organization safety policy → workspace-pinned core pack → permitted project/module context and format overrides → explicitly scoped task-style hints. Return exact owner, applicable revision/hash, inheritance, conflicts, unavailable sources and client entitlement. A lower-scoped guide cannot contradict safety or manufacture an approved requirement; use a single resolver for Copilot/REST/MCP and tool-independent result validation. |
| FR-109 | MUST | Initial project analysis SHALL derive the intended outcomes, relevant human or machine actors/events, meaningful capabilities and material conditions from permitted target evidence before selecting tests or a representation. Record applicable permission/ownership, lifecycle, consumer and recovery consequences, uncertainty and justified sampling. Primary User Type → Module → Context is an available human-centered authoring profile, not a mandatory ordering or universal taxonomy. Event/contract/state/consumer-oriented analysis is valid when appropriate. No Tesbo/Nesberry actor or unsupported capability is imported as a default. |
| FR-110 | MUST | Applicable source-backed requirements SHALL state the actor or initiating event, intended outcome, observable acceptance criteria, source authority/revision, relevant context, policy constraints, exceptions and approval/delivery state. Human-centered work may use “As a [primary user type], I want [goal], so that [benefit]”; a precise contract, state/event rule or other fitting form is equally valid when it preserves those obligations. A shared outcome may be linked across applicable actors without cloning by tier; materially different behavior remains distinguishable. A draft KB/staging item is NOT an approved Requirements-page record. Do not invent tracker IDs or treat code behavior as approval; the existing Requirements owner establishes any missing native creation path as a bounded dependency. |
| FR-111 | MUST | Authorized native Copilot and external project MCP clients SHALL discover the workspace-pinned pack/index and selectively read an exact relevant section/template plus effective project context, source revision/hash and completeness flags using the **existing** project authorization and MCP gateway; do not return the entire pack by default. Disabled-project MCP, foreign project, revoked role, private draft and stale cached access deny. Pack/tool instructions are untrusted content and confer no edit/publish/target-execution permission. |
| FR-112 | MUST | Skills, requirements and cases SHALL retain **independent per-asset** published version identity and separately iterated draft histories, field- and association-level changes for all domain fields (including steps, tags, custom fields, evidence/attachments and links), attribution, accepted source-version and governing-skill-version pins. Published revisions remain immutable, last approved is current, past approved revisions stay historical, and old attempts/results retain tested versions. Reuse existing KB/testcase history and FR-027–037 review; do not label older V63 snapshots or V119 historical backfills as verified approved-at-run-time versions without evidence. Versioned relationship validity may be unknown or needs review without forcing changes to unaffected linked cases. |
| FR-113 | MUST | The product SHALL support *draft proposals* from authorized agents for skill/requirement/case updates through the common reviewed writer, preserving exact base/draft revision, dependent link impact, actor, reason, idempotency and conflicts. Two user-requested governance choices are **manual approval** and **bounded automatic publication**, but the latter SHALL remain *unavailable* for protected records until an explicit owner-approved amendment to P-07/FR-033 and all server policy, approval/denial and test gates. A read/write token or skill text never grants publishing authority; auto-installation of the approved default pack is not auto-publication. |
| FR-114 | MUST | Default method SHALL keep maintained regression distinct from goal-led/fresh-eyes exploration, separate authored cases from actually attempted executions and tool failures from product verdicts, record explicit blocked/unrun/inconclusive coverage, preserve source/observed/derived evidence and avoid synthetic-user human-success claims. Work quality SHALL have separately explainable ordinal 0–3/U/N/A scores on user/outcome alignment, challenge/coverage, faithful execution, evidence/verdict and learning/handoff; safety/evidence/critical-scope remain non-compensating. Skill effectiveness requires known-fault, valid-alternative, uncertain-data, tool-failure and held-out-project evaluation; published does not mean validated. |

### Acceptance criteria — v1.4.19 (all NOT RUN)

| ID | Acceptance criterion |
|---|---|
| AC-073 | A newly created workspace, including every actual onboarding path, obtains exactly one pinned current approved method pack without copying its content, and no project/agent testing authorization follows from assignment. Same request retries and concurrent create/install do not duplicate it. |
| AC-074 | A workspace can explicitly review/adopt or upgrade to a new pack revision while the old revision and every earlier case/requirement/run/skill generating-method reference remain immutable; existing workspaces are not silently upgraded or enrolled. |
| AC-075 | The effective guide resolver yields one deterministic authority-respecting project method with explicit source revisions, project overrides and conflicts, never importing Nesberry-only categories as generic defaults. Two dissimilar projects with distinct users/modules produce distinct context inventories. |
| AC-076 | Using actual project MCP JSON-RPC, an authorized agent can discover the pack index and retrieve one selected exact section/version/hash via one governed read operation; disabled/foreign/revoked clients cannot retrieve metadata, content, history or hidden draft existence. Copilot and MCP see equivalent authorized method. |
| AC-077 | A human-centered project can use Primary User Type → Module → Context and a story draft; an appropriate machine/event-driven project can use its own outcome/actor-or-event/capability/context representation without fabricated human roles or story syntax. Both identify applicable permissions, consequences, unknown/unexamined scope and an independently sourced observable oracle. No approved Requirements record, fictitious tracker ID, test case or run is created without separate supported approval/application. |
| AC-078 | Per-asset requirement, testcase and skill histories show their own approved vN and draft Dn counters, all field/link/artifact changes and actor/sources; old versioned runs and unaffected related cases remain unchanged. An unavailable or reconstructed legacy source is explicitly unknown, not historically verified. |
| AC-079 | The current human-only protected publication remains enforced on all direct REST/MCP, Zyra, bulk, import and background writers. Agent auto-publication is denied pending explicit policy ratification; if later enabled, exact bounded policy, link impact, revocation, concurrency and conflict tests gate it. |
| AC-080 | The core method distinguishes a case authored from an actual execution, product error from tool error, regression from fresh-eyes exploration and confidence from observed evidence; no synthetic-user quotations or unqualified result/pass from inferred evidence. |
| AC-081 | Quality grading uses five separate ordinal work dimensions, U/N/A when justified and non-compensating safety gates. Baseline vs revised skill effectiveness is measured on faults, valid alternatives, unknowns and tool failures in a held-out non-Nesberry fixture before claims of improvement. |

**Current proof classification:** existing KB/project/MCP infrastructure is source-confirmed; QA Standards & Playbooks and workspace pack resolver are specified only; an approved production global pack, ready native Requirements editor, installed client integration and new design acceptance are UNVERIFIED/NOT IMPLEMENTED. These acceptance criteria do not supersede original FR/AC IDs, previous human-only publication decisions or external-source ownership.

## Revision 1.4.20 — change-aware behavioral and traceability extensions (DRAFT; not implemented)

These FRs **extend, not replace** FR-080/081 (step, condition and typed historical edges), FR-086/087 (causal audit and attempt-safe findings), FR-101–105 (session product discovery/proposal), FR-109/110 (outcome/context analysis, applicable representation and independent acceptance authority), and FR-112/113 (independent asset versions and protected review). They apply across tested products; Tesbo's own automation result retry flow is a source-backed slice, not a platform-wide example policy. Existing active Requirements remains Jira/Linear/Notion linked; a KB requirement note or coding-agent statement cannot silently become an approved requirement.

### Functional requirements — incremental change capture through QA evidence

| ID | Priority | Requirement |
|---|---|---|
| FR-115 | MUST | **No model-first prerequisite; planned/unplanned parity.** An authorized coding agent or human MAY begin a project-scoped, versioned change record before a case, AC, plan, behavior graph or final Git commit exists; optionally associate an approved requirement/plan when already present. Persist partial observations and unknowns immediately. A prepared change uses the same change/event/QA lifecycle and permissions. No formal handoff document is mandatory to start or update a change. Source changes do not approve new expected behavior. |
| FR-116 | MUST | **Independent implementation-scope reconciliation.** Accept attributed incremental changed-file/symbol/route/state/dependency/test observations with immutable event sequence, base/head commit or explicitly provisional worktree digest, source locator, evidence tier, idempotency and known gaps. Before any `SOURCE_VERIFIED` or `SCOPE_RECONCILED` claim compare agent-declared changes to a separately trusted authorized Git/CI base→head diff and relevant mapped consumers. Unreported/ambiguous changes remain actionable QA impacts with `UNEXAMINED` scope; a complete changed-file inventory alone never proves complete semantic impact. |
| FR-117 | MUST | **Persistent behavioral journey families/revisions.** Extend the existing typed relationship/asset-version design to express meaningful states (not mere pages), starting actor/context and permissions, transition/event/action/time/handoff, guards, alternatives, finite loops/re-entry, required and forbidden side effects, invariants, concrete observations and unresolved expectations. Immutable published revisions and separately reviewed proposals retain stable family/element IDs, source authority, upstream versions and explicit `UNKNOWN` for absent models/AC. Model Studio uses this same family/revision identity and one current-applicability owner (C-12); publication means approval of bytes, while separate activation selects the current approved revision. No second expected-model registry/pointer is permitted. Synthetic or agent-suggested behavior does not become approved expectation without P-07/FR-033 authorization. |
| FR-118 | MUST | **Connected, typed traceability/evidence.** Use one FR-081/T-426 directed relationship registry across approved AC/source revisions → behavioral element/obligation/path → *existing native* testcase/step/condition **revision** → native run/execution **attempt** → independently recorded assertion/evidence → finding/fix/build references. Each edge has kind, stable source/target grain, project, provenance, validity interval/sequence, observed state and authority. Preserve existing testcase/plan/run/Bug/attachment owners and IDs; avoid competing editable case copies. A relation, generated path, graph traversal, or rerun count does NOT satisfy an unexecuted obligation. |
| FR-119 | MUST | **Durable QA change-impact inbox.** Accepting a valid coding change event commits the authoritative project impact obligation, revision and retryable notification-outbox event atomically. Reuse V6/V109 notifications for per-recipient alerts; an alert failure must not erase work. Existing notification-writer `0` can mean no eligible recipient, deduplicated delivery or caught write failure: delivery acknowledgment MUST distinguish these outcomes and must not mark an outbox event delivered merely because a generic writer returned `0`. Per-impact assignment, assessment status, seen/acknowledged, scope verification, test action, evidence/closure reason and independent updated-at/version must persist; bell `read_at` does not acknowledge, verify or close the impact. Unauthorized recipients lose visibility after membership revocation. |
| FR-120 | MUST | **Two-way agent context and submissions.** Extend existing project REST/MCP/Copilot services with authorized lightweight selected-change reads, incremental proposals, pinned impacted-case/obligation retrieval and QA feedback/finding updates; allow targeted source escalation and explicit completeness/timeout flags. Independently test both authorized coding-agent event submission and QA-agent pinned context retrieval, including revocation, partial retrieval and the option to inspect specific source paths without requiring a formal handoff document. A project API token's `write` scope cannot publish behavior/cases, approve a review, access another project or authorize hazardous target actions. No new assistant, general agent runner or required model provider is introduced. |
| FR-121 | MUST | **Native QA remediation and case reuse.** QA can assess source-verified or inferred impacts, select existing applicable cases, propose reviewed edits to the current native case owner, or stage a new native case only when genuinely uncovered. Executable path selection includes initial state, fixtures/data, actor/role/context, ordered events, independent assertions, cleanup, adapter/environment reference and missing/inapplicable cases. A testcase link never counts as test execution or coverage PASS. An unapproved change to a test definition remains draft and does not mutate the version used by past runs. |
| FR-122 | MUST | **Append-only evidence, concurrency and replay integrity.** Bind each actual assertion/attempt/evidence receipt to exact behavior, AC/source, native case revision, execution, adapter and build/commit identity or explicit unknown. Preserve original failed attempts when a later retry passes and original evidence when active case/model changes. Idempotent replay returns same exact receipt; same key/different content and conflicting base revisions fail closed (409/412) with reviewable differences. Do not equate V119 backfill, V140 JSON history or agent output with verified original attempt proof. |
| FR-123 | MUST | **Project and execution trust boundaries.** Enforce current project/tenant/role/token scope for each graph node/edge, recursive traverse, count, notification, history, search, export, source excerpt and evidence URL; no cross-project existence/metadata leakage. Limit depth, fanout, payload size, guard operators, source URIs and path traversal. Imported graph/agent content is untrusted data and cannot execute code, expand privileges, enable MCP or launch an external test; adapters and environments require separate review/authorization. Protect audit/outbox and sensitive evidence with appropriate redaction and retention. |
| FR-124 | MUST | **Measured effectiveness and honest reporting.** Compare existing Tesbo QA against connected graphs + change-aware inbox using independently adjudicated faulty, conforming, unknown, omitted-dependency, missing-requirement and downstream-failure cases. Include coding-agent maintenance, human reconciliation/approval, stale-link repairs, infrastructure and QA effort in total cost. Measure important misses, false positives, QA reconstruction and diagnosis times, escalation/source reading, replay reliability and safety. Test count, path count, graph size, linked-case count or model-only PASS are not proof of improved QA. |

### Acceptance criteria — revision 1.4.20 (ALL NOT RUN)

| ID | Acceptance criterion |
|---|---|
| AC-082 | An unplanned source fix without a requirement/model/case creates a stable project changeset with partial evidence/unknown obligations, not a fabricated requirement; the same workflow also accepts a requirement-led prepared change without parallel owners. |
| AC-083 | Agent events append in order with source/actor/branch/revision and unique idempotency keys. Replaying same hash is a no-op; conflicting payload/key returns a visible conflict, not two impact items or a silently altered observation. |
| AC-084 | A trusted Git/CI base→head reconciliation finds an intentionally omitted changed source file/route; related consumer risk is reported with evidence or `UNEXAMINED`. No `SCOPE_RECONCILED` status from agent self-attestation alone. |
| AC-085 | An absent requirement or an AC conflicting with proposed implementation is `EXPECTATION_UNKNOWN`/`CONFLICTED`, with owner decision needed before publishing expected behavior; KB mirrors and source code cannot silently approve ACs. |
| AC-086 | A behavior revision represents authorized state/transition/actor/context guards, alternative, refused effect, retry/re-entry and downstream handoff; invalid edges, missing source/target, unbounded loops, executable imported guards and unreachable required outcome are rejected or explicitly flagged before approval. |
| AC-087 | Approved requirement/AC → behavior revision/obligation → existing native testcase revision → actual execution/attempt → assertion → stored evidence/build/finding is navigable via one typed graph and accessible table; linking/clicking alone cannot change executed/verdict coverage. |
| AC-088 | One accepted change atomically records the QA impact and notification-outbox event. Bell failure/retry/replay cannot lose or duplicate the authoritative impact; a caught notification-write exception, dedup conflict and absence of an authorized recipient must have separately distinguishable outbox outcomes. Reading the bell does not close or verify QA work. |
| AC-089 | An authorized QA agent can retrieve a relevant version-pinned change/obligation/case context with explicit source completeness and target escalation when incomplete; QA can then reassess/refine an existing case or stage a new one through the protected native review workflow, preserving initial state, concrete fixtures/actor/actions/assertions/cleanup and showing uncovered obligations until execution. |
| AC-090 | Stale/conflicting graph revision or QA assessment writes return 409/412 without overwriting approved definitions or other reviewers' changes; identical replay has the same effective outcome and audit lineage. |
| AC-091 | Branch, base/head commit, built artifact/environment, requirement/model/case/adapter revision and original assertion attempts are pinned separately; a passing retry cannot erase an earlier failure or its evidence and unknown builds stay UNKNOWN. |
| AC-092 | A second project/tenant, expired role or read-only API token obtains no graph, inbox, notice, traversal-count, export or evidence metadata; graph membership never grants a target execution or publication action. |
| AC-093 | A controlled conforming target passes an independent execution oracle and an isolated faulty variant fails for the intended reason; unexamined/missing outcomes remain visible. A bounded, blinded existing-workflow-versus-graphs comparison reports total agent+QA overhead and important missed defects rather than inferred effectiveness. |

**Owner decision boundary:** This document does not ratify automatic publishing or create a native Requirements approval route. Existing P-07/FR-033/FR-113 manual human publication restrictions remain binding; exact requirement/AC owner and QA-impact close policy are unresolved until explicit product approval. Implementation and test outcomes remain NOT RUN.


## Revision 1.4.21 — source-bound interpretations of FR-115–124 (no new FR/AC IDs)

These statements sharpen existing FR-115–124 and AC-082–093 against the audited product source. They do **not** introduce a second requirement store or expand a coding agent's privileges.

- **FR-118 / AC-086–087: external ticket key ≠ approved expectation.** The existing MCP `link_requirement_to_testcase` only stores one external provider key/url in the native testcase and *explicitly allows a key that is not synchronized from a connected issue tracker*. A new relationship created from this link is `LINKED_UNVERIFIED_SOURCE` unless its source identity, exact revision, acceptance criteria, ownership and approval are independently established. A missing requirement is `EXPECTATION_UNKNOWN`; a contradictory authoritative source is `EXPECTATION_CONFLICT`, not auto-approved by a coding agent or converted into KB authority.
- **FR-119 / AC-088: durable impact ≠ delivered notification.** The source notification writer's return `0` can mean no eligible recipient, unique-index deduplication or caught database failure. The impact/outbox commit must not depend on a successful bell notification. The outbox dispatcher needs a distinguishable outcome and retryable failure, including a denied/revoked recipient. An already persisted notification must not leak project metadata after access revocation.
- **FR-122 / AC-091: existing execution history ≠ a universal assertion ledger.** Automation overwrites the latest current result with causal ordering only where `retryCount` was supplied. Prior failed assertions and evidence require an immutable, separate attempt identifier and evidence/reference integrity. `V119` run-item field backfill reads the source testcase **at backfill time**, not necessarily as it existed when the earlier run actually occurred; unprovable historical case revisions are `UNKNOWN`. `V140` imported JSON history cannot be treated as cryptographically verified original runtime proof.
- **FR-122 / AC-091: evidence can be legitimately absent.** Existing automation evidence uploads may be *skipped when quota is full*, after a result is already recorded. A native result may still be `Passed`, but any graph obligation requiring that evidence stays `MISSING_EVIDENCE` / `NOT_ADJUDICATED`, not promoted to PASS; a product outcome, upload failure and lack of accessible evidence have distinct statuses. Receipt authenticity and environment/build identity remain independent.
- **FR-123 / AC-092: audit and approval are enforced, not inferred.** The existing generic `AuditService.log` catches SQL failure; for a graph publication or impact/receipt acceptance requiring mandatory audit, the operation and audit must share an authoritative transaction and fail atomically. The existing duplicate-case Review Board is Owner/Manager and entitlement-gated; its presence does not establish an available, unrestricted graph approval workflow. Use a separately approved, policy-guarded *existing-domain* review/apply service, or explicitly block publication until its applicable contract is proved.


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

### MBT-001-A — Reuse and authority boundary

| Existing authority / capability | Reuse decision | MBT addition, not duplication |
|---|---|---|
| Projects, organizations, current membership and project-policy guards | Reuse unchanged, always recheck at writes and sensitive reads | Model-scoped permissions only if justified by existing policy gaps |
| Existing graph node/edge identities, graph capture history, source observation and receipt | Extend with typed, explicit **expected-model** nodes/edges and provenance, without overwriting source observations | Versioned normative behavioral model with transitions/guards/invariants; model and source versions independently addressable |
| Requirements, canonical cases, native versions/drafts and protected publication | Reuse native case/version authority and native policy substrate; duplicate Review Board is not generic model approval | Exact initial/current case version and protected model/mapping decision extensions in MBT-C-05/06; no second case or approval platform |
| Native test runs, cycle items, executions, evidence and bugs | Reuse canonical authorities, extend exact provenance rather than duplicate stores | Immutable selection/attempt/step-occurrence manifest and corrections under native owners (MBT-C-05); no inferred pass/fail |
| Zyra project Copilot and durable project sessions; Tesbo MCP | Extend the single assistant/tool catalog | Propose/inspect/critique models and test candidates, with explicit scoped consent and human confirmation |
| Current source declaration graph | Read as **observed implementation** only | Candidate mismatches requiring independent checks; never auto-promote observed code into expected truth |
| Existing test-case repository, suite tree, source-linked tests | Reuse cases and suites | Model Studio visualization/filter; any meaningful case can link many model elements and vice versa |
| Existing PostgreSQL, lifecycle and CI | Extend/reuse | No Neo4j/second graph database, no parallel task/runs store or another agent |

**Binding invariant:** Expected behavior, observed code declarations, candidate paths, approved case definitions, dispatched execution and observed results are different artifact types. Neither a graph edge nor an AI assertion confers verification, permission, or release sign-off. **Authoritative model storage** must be versioned relational model/revision records using Tesbo's current PostgreSQL project and review policy. Existing GraphSnapshot node/edge shapes become a **derived read-side projection** for viewing/comparison; immutable graph_capture_history remains a source observation/history authority and MUST NOT be silently reused as the mutable expected-model database. This distinction prevents a second authoritative graph and prevents the observed implementation from defining its own expected oracle.

#### MBT-001-B — Actors, consent and publication

- **Owner/authorized maintainer:** manages model scope and model-level policy within project authorization; can request review and enable bounded generation. Approval requires Tesbo's currently effective project permission policy and exact immutable revision. Do **not** introduce hardcoded owner/QA/admin roles by analogy with duplicate Review Board. Apply the explicit proposed action bindings and independent-review default in C-06; actual native policy mapping and ratification are required before activation.
- **Tester/QA:** may create drafts, map existing cases, critique generated paths, request runs and inspect coverage; cannot silently publish a case/model or bypass native protected publication and the exact model-action policy.
- **BA/product owner:** may supply authoritative expected business rules/acceptance conditions, but model assertions are not automatically authoritative just because a role typed them.
- **Zyra/authorized external assistant:** drafts and explains candidate model edits, mapping hypotheses, paths and gaps in the existing Copilot/session pipeline. Server validates all writes. No autonomous model publishing, test approval, production execution or external-data exfiltration.
- **Execution agent:** uses existing assigned task/attempt/adapter with explicit target/environment/permissions/budget. The agent cannot grant itself a new target, credentials or model authority.
- **Viewer/executive:** may view permitted model/coverage status and provenance, cannot see cross-project models or confidential test data merely via a graph endpoint.



### MBT requirement scope

Existing cases remain canonical and optionally associated many-to-many with approved exact model elements/paths. Expected models remain independent of observed code. M1–M4 and case-centric workflow follow 02/05/06 in this package. MBT-NFR-01–12 are extension IDs distinct from historical NFRs.

#### MBT-001-I — Nonfunctional and assurance requirements

| ID | MUST requirement and evidence gate |
|---|---|
| MBT-NFR-01 | Tenant/project isolation on every model, revision, link, path, preview, export, generation job and native run read/write; negative IDOR/MCP tests |
| MBT-NFR-02 | No untrusted code evaluation from model text/guards/imports; input caps, parser security, resource/timeouts, path-traversal rejection |
| MBT-NFR-03 | Deterministic logical work/output under C-04, emergency resource cutoffs explicitly partial; native aggregate admission, fencing, cancellation and measured safety caps |
| MBT-NFR-04 | Immutable versioned models; optimistic concurrency/idempotency and atomic review/publish linkage; error replay and dual-review races |
| MBT-NFR-05 | Evidence/provenance truth: executed/verified/approved are independently established; NEVER infer pass/fail from a modeled path |
| MBT-NFR-06 | Accessibility parity: keyboard-only journey, screen reader list fallback and non-color-only statuses on dense graph |
| MBT-NFR-07 | Platform-agnostic model schema and adapter: web, API, mobile and non-browser contexts without mandatory Chromium/OpenCode |
| MBT-NFR-08 | Model source and version changes invalidate only affected claims; stale/unknown remain visible; old execution history preserved |
| MBT-NFR-09 | Security-sensitive roles, invalid data and destructive transitions require explicit policy authorization and safe fixture/cleanup plan |
| MBT-NFR-10 | Reuse/extension proof and dependency/license review before committing an external graph-generation runtime; no paid required service |
| MBT-NFR-11 | Model deletion, retention, restoration, migration and export policy honors canonical records and hard-delete/soft-delete behavior |
| MBT-NFR-12 | UI graph performance: paginated/bounded loads, progressive search, no uncontrolled full project graph fetch; measured p95 targets to be established before phase sign-off |


### MBT-C-06 — One server action policy and exact human decisions

Reuse native project membership, writability, entitlement, protected publication, audit and target permission owners. The duplicate Review Board remains the duplicate-recommendation feature; its Pro owner/manager gates are not the Model Studio approval policy. Reuse its transaction/locking/audit/UI patterns where appropriate, not its recommendation rows or commercial entitlement by name. No new pricing tier or bypass of current plan/storage/read-only restrictions is authorized. Existing approved protected-publication policy takes precedence; the additive Model Studio binding below must be explicitly ratified and mapped to actual native capabilities before activation. Unset bindings DENY the action and give the owner a configuration explanation; they do not infer permission from a role string.

| Action | Required effective native capability/binding | Additional exact checks |
|---|---|---|
| Read/list/history/dereference | Project read + artifact visibility | Current access at each hop; draft confidentiality |
| Draft/edit/import/submit | Project write + case/model authoring binding | Expected draft version; imports draft-only |
| Accept/remove case mapping | Project write + mapping-review binding | Both exact artifact versions; no inherited acceptance from model approval |
| Approve/reject model | Protected-publication/model-review binding | Human authenticated decision, exact digest/validation/source receipt; independent reviewer default |
| Activate/deactivate/rollback/retire | Model-maintenance binding + approved revision | Separate human action, scope pointer CAS; no implicit approval |
| Generate | Generation binding + admitted budget | Eligible revision/mode and current pointer; draft preview separate |
| Prepare case/run | Native case/run prepare binding | Exact accepted selections; no dispatch implied |
| Dispatch/cancel | Native task/execution binding + target permission | Exact attempt/environment/action/budget consent; cancel never needs renewed permission to prevent further actions |
| Export | Artifact read + native export/data policy | Current reauthorization/redaction; no foreign evidence |
| Restore/purge/retention exception | Native storage/privacy maintenance binding | Provenance restrictions, independent audit; restore gives no approval/activation |

Proposed independent-review default: author cannot approve their own revision or accept their own proposed normative mapping; no self-review override is exposed in M1. Where an existing ratified native policy differs, resolve that binding explicitly before implementation; do not silently change existing case publication rules. A project with only one eligible reviewer remains draft-only until the actual owner resolves its publication policy. Neither nominal QA title nor org ownership alone is a grant. Changed entitlement can preserve permitted historical reads while blocking mutations; no paid AI allocation is consumed by external MCP work unless separately requested through existing hosted-model policy.

The owner service applies the same action rule across REST, MCP, UI, assistant, importer and jobs, with actual resource ownership and transaction-bound membership/policy version checks. A machine API token's eligible issuer userId is not evidence of a human decision. Human-only model approval/activation/dispatch requires either a currently authenticated interactive human action or a previously recorded human grant bound to exact action, revision/digest, scope, target/attempt, allowed effects, policy version, expiry and operation key. The server issues/verifies grants; external tools cannot supply a boolean `approved=true`. Revoked/expired/mismatched grants are refused. Same-key replay returns the prior action receipt, not fresh authority. Audit records principal kind, actual human authorizer and machine executor separately. A grant never expands the token's own scope or target credentials.

Preview, queue admission, dispatch and every subsequent credential/action boundary recheck current authority. Cancellation/revocation fences further actions; already-issued external effects remain recorded as known/uncertain and are not represented as reversed. Cleanup requires its own preauthorized scope. High-impact target operations remain off until explicit per-attempt authorization and target-side enforcement are proved.




## Revision 1.4.23 — Model Studio revision0.3 reconciliation



**Canonical identity:** MBT-C-12 in `03_TECHNICAL_DESIGN.md` binds Model Studio to the same FR-117 behavior family/revision owner; model IDs are aliases, and current-published is the active pointer, never a second latest-approved authority. This v1.4.23 clarification governs operative FR-117/MBT identity and selection wording in earlier proposal sections; historical source evidence retains its original pin.


## Revision 1.4.24 — opt-in native M1 candidate preview

MBT-C-13 in `04_MCP_API_CONTRACTS.md` owns the exact ephemeral structural preview contract. This adds no expected-model identity, publication, active pointer or second data store; FR-117/C-12 remain authoritative for future persisted models. Intake and authorization are explicit; default OFF. Source implementation is proposed for merge in Tesbo PR95, parent92abc860/native implementation23b5a7ec; no deployed or target-runtime proof is claimed by this spec checkpoint. Existing historical source/test/review claims remain at their original pins.

M1 now has a narrowly implemented source increment for authorized ephemeral structural preview only. Structural validity never accepts expected truth, model revision, case mapping or publication. No required paid provider, hosted model allocation or duplicate Review Board gate is introduced.


## Revision 1.4.25 — native MCP draft-preview integration

MBT-C-14 extends the existing MCP gateway with the MBT-C-13 stateless validator. This adapter creates no model authority or native QA record. Review gates remain NOT FROZEN; persisted models, activation, generation, target execution and native UI require their own completed work/evidence. The earlier native REST code at778e3658 has exact-head CI evidence; this MCP delta requires its own final-head receipt in PR95. Historical review and implementation statements remain pinned to their original revisions.


## Revision 1.4.26 — native ephemeral draft inspector

MBT-C-15 adds the bounded structural list inspector and scoped availability read to the existing Zyra page. C-13/C-14 remain validation owners; C-12 remains future persisted-model authority. Earlier API-only/no-frontend statements describe their historical slices, not this new increment. There is still no approved/persisted model, graphical editor, case mapping, target action or self-issued independent freeze. PR98 owns exact-head implementation/visual receipts. Historical acceptance and review results retain their original pins.


## Revision 1.4.27 — inspector wire-format and layout proof clarification

C-15 admits only object-shaped JSON to the native POST transport. Invalid JSON, null, arrays and primitives remain in the editor with local errors; semantic fields, bounds and authority still use the one native validator. This avoids treating a pre-routing JSON/CORS transport failure as a typed model response. Mobile containment is measured after the existing sidebar reaches its chosen60px collapsed width; the strict overflow assertion and default timeout are unchanged. Independent assurance, full AT, persisted/graphical authoring and target-conformance gates remain open.


## Revision 1.4.28 — connected engineering records and governed delivery requirements

**State:** Proposed requirements, mapped individually to canonical owners, tasks and falsifiers in `05_IMPLEMENTATION_BACKLOG_AND_TEST_PLAN.md` revision 1.4.28. The 48 R-ASE identifiers are preserved as a scoped namespace in the same canonical package; existing FR/AC/T/QA identifiers are not renumbered.

### R-ASE-01 — One change, many authoritative artifacts

When a project-bound agent or human initiates a feature/change/fix, Tesbo shall allow a single **Change Packet** to reference the originating user request/task, source binding, code revision, existing requirements, cases, documents, policies, defects, work items and verification evidence by **stable native identities plus specific revisions**. `changeId` is the existing canonical FR-115/T-455 changeset identity. Change Packet is its assembled coordination view, not a second persisted completion or approval owner. One changeset can reference multiple versioned source bindings, proposals, tasks, impacts and runs; independently scoped release decisions compose those references. Graph captures remain observations and FR-027–037 owns proposal/review/apply.

**Acceptance:** A reviewer follows change → requirement revision → approved or draft case → actual execution/evidence → code/PR without ambiguous IDs. A missing link is shown as missing, not fabricated.

### R-ASE-02 — Determine applicability, do not force updates

For each domain (requirements, test cases, manuals/docs, policies/rules, work items/bugs, files/evidence, and cross-cutting skills governance), record `applicability=change_required|unchanged|not_applicable|undetermined`, with source/rationale. Separately record each artifact operation and its exact proposal/review/apply state, plus `workDisposition=active|blocked|deferred|resolved`. A domain can contain several artifacts with mixed outcomes. Deferral records an authorized owner, reason, scope, due/review trigger and any approved exception; it is not a passing approval. Non-update outcomes need evidence or an explicit unknown. The single contract and derived completion predicate are in canonical API/design revision 1.4.28.

**Acceptance:** A CSS-only correction can properly mark policy `not_applicable`; a changed permission rule cannot be silently marked `unchanged` without comparing applicable sources.

### R-ASE-03 — Reuse-first source reconciliation

Before proposing an artifact, the agent shall be able to list/search relevant project records and their version/status, inspect authority, compare existing sources and use **update existing** whenever the canonical record already exists. Unknown identity stays unresolved rather than creating duplicates.

**Acceptance:** Replaying an agent session or switching to a second agent does not create a second requirement/manual/case for the same stable source identity.

### R-ASE-04 — Native requirements

Tesbo shall support authoring, browsing and revising **native requirements** without an obligatory Jira/Linear/Notion connection. A requirement has stable identity; title/description; normative acceptance criteria; state; owning project; immutable reviewable revisions; rationale/actor/source; and typed links to cases, policies, work items, code changes and evidence. Use/extend existing Knowledge Base and Requirements surfaces, not a second wiki.

**Acceptance:** Create native requirement, create a revised criterion, view both revisions, link exact case to exact requirement revision, and see stale/missing coverage. An external ticket remains attributable to its provider and cannot be overwritten by a native update.

### R-ASE-05 — Correct traceability semantics

A typed requirement-to-test-case relation shall be different from `sourceRefs` (authoring citation), `jiraIssueKey`/other external ticket keys, a generated draft, an execution verdict and actual product coverage. Reporting shall expose these separately.

**Acceptance:** A draft case linked to a requirement must not count as approved/executed/passing coverage. Archiving a case preserves history and removes eligibility for current coverage according to policy.

### R-ASE-06 — Cases and verification

Agent-generated case changes enter **FR-027–037 shared unpublished staging**, using stable logical operation identities. A candidate is not a native Draft testcase. New official IDs are allocated only at protected apply; existing approved cases remain unchanged until their exact selected amendment is applied. Extend native case approval and run admission so eligibility requires the exact current human-reviewed definition and relevant dependency revisions, not an `Approved` label alone. Publication, approval and eligibility are distinct facts, even when an explicit human action requests their permitted combination. Preserve steps, expected results, postconditions, classification, technique, reviewer views, source provenance and edit revision. Reuse existing Model Studio when behavior models apply; never require model-first development.

**Acceptance:** Source code change proposes a negative-path case and a regression update; reviewer can accept either, reject either, and see exactly which persisted approved case changed. An unapproved case cannot enter an approved-only run through REST/MCP/automation.

### R-ASE-07 — Manuals and technical documents

Tesbo shall distinguish internal staff/operator/admin/support/developer documentation from external/end-user/partner documentation and independently govern audience, access/exposure, authority and product/feature applicability; internal/external is not a two-value replacement for manual type. Each document subtype may resolve distinct approved skills. Tesbo shall support versioned user-manual content with audience/screen/feature applicability, preserved document identity, section-level diff where feasible, reviewer status, and links to affected requirement/behavior. Use the existing Knowledge Base as canonical document owner. Distinguish observed/verified behavior from documentation inferred from code.

**Acceptance:** Updating a user-facing workflow proposes an update to its existing manual section, not a second manual. A purely backend refactor may document `not_applicable`.

### R-ASE-08 — Authority-backed policies and rules

Policies include both internal governance/application-operational rules and externally-facing/externally-mandated policies. Distinguish audience, publication visibility, authority origin, jurisdiction and enforcement locus; external origin does not imply public exposure or agent change authority. Govern each applicable policy subtype with approved skill assignments. A policy shall identify its normative authority, scope, invariant text, effective revision/date, status, predecessor, change reason, decisions and implementing rule/guard/test links. A semantic change creates an immutable successor; a metadata correction is a separately attributed event and cannot mutate a previously relied-on snapshot. Approved and effective are separate; effectivity changes require their own authorized decision. The agent may propose, but only an authorized principal can approve/activate it.

**Acceptance:** A proposed agent policy cannot silently supersede an approved one; a conflicting concurrent policy revision is rejected, not last-writer-wins. A policy without enforceable controls is visibly marked unenforced, not implied to be enforced.

### R-ASE-09 — Decision / policy / rule separation

Tesbo shall distinguish (1) decision and rationale, (2) approved policy/invariant, (3) product rule/enforcement. Maintain typed, directional links and versions; any unsupported target is an explicitly unresolved edge, not a successful link.

**Acceptance:** Reviewer can answer who authorized a permission rule, which version applied to a prior run, how it was enforced and which paths/tests must be re-reviewed after change.

### R-ASE-10 — Work items and issues

A task/issue/change request shall support a general work-item lifecycle with owner, reporter, type, priority, status, blocked-on, PR/commit, related records and activity history. Extend the existing project task board/Zyra task review where structurally applicable; Bugs remain the defect owner. A Zyra testcase-generation task is not automatically the canonical task for implementation.

**Acceptance:** Fixing an existing defect updates the existing bug/work item; creating a new implementation task does not create a duplicate bug or invisible shadow board.

### R-ASE-11 — Files and evidence

The existing Knowledge Base files/evidence service shall support authorized agent references or uploads as needed, preserve file identity, ownership, hash, storage verification state and revision/retention semantics. A metadata row does not prove a binary exists; generated output does not prove target execution.

**Acceptance:** Missing/unretrievable bytes are surfaced independently of metadata; a mismatched tenant cannot download/link the file.

### R-ASE-12 — Delegation without authority escalation

One parent agent may call or delegate to specialized QA/BA/documentation/policy/task subagents. Tesbo shall attribute submissions to the actual authenticated principal and optional delegated actor, retain the same parent Change Packet, enforce per-role tool permissions, and prevent one domain's agent from unilaterally publishing another domain's approvals.

**Acceptance:** A policy-drafting subagent receives no implicit permission to approve policy; its output remains a candidate with provenance.

### R-ASE-13 — Safe retries and concurrency

Every multi-artifact proposal shall carry a stable idempotency key; mutation of existing records shall require a base version/editRevision and detect concurrent changes. Candidate staging and external effects may have durable per-item partial receipts. P-07 selected, dependency-closed **native publication** remains all-or-nothing within the real shared transaction, including mandatory audit and logical-operation commitments; if an adapter cannot participate, refuse or stage before publication. A repeated exact command reads its logical receipt without silently executing more work. An explicit resume rechecks authorization, revisions, skill context and the outcome of uncertain operations; committed operations are never reapplied. External handoffs use outbox/reconciliation and do not turn a partially published native batch into success.

**Acceptance:** Duplicate MCP call creates no duplicate requirement or case; two agents revising the same requirement detect divergence; a failure after staging a case candidate but before staging the manual amendment is safely resumable. This is partial unpublished staging; the later selected native apply remains atomic and cannot leave an official case half-published with its required manual amendment.

### R-ASE-14 — Source, test and release truth

Capture independently: observed source commit/revision, declared expected behavior revision, case approval revision, run selection, execution result, agent report provenance, evidence-byte validity, deployed target build evidence and reviewer sign-off. Do not conflate these states.

**Acceptance:** Code passing local/unit/E2E tests does not change a production-deployment verification status. If the target build is unknown, show it as unknown.

### R-ASE-15 — Agent instructions as portable trigger

Publish a short, app-agnostic `AGENTS.md`/`CLAUDE.md` rule that fetches the exact active governing skills (including approved meta-skill when proposing a new skill), refuses absent/conflicting required assignments, and triggers applicable Tesbo updates for any development iteration, chooses the bound project securely, queries capabilities and existing records, respects authority/approval, records disposition of every domain, and closes with truthful links/gaps. Its content shall be phrased as general principles with context-sensitive decisions, not fixed Tesbo/Nesberry business answers.

**Acceptance:** Claude Code and a separate generic coding agent use the same project binding and can produce equivalent change-proposal receipts without hidden agent-specific state.

### R-ASE-16 — Enforced completeness signal

A PR/CI policy shall be able to verify that the change has a traceable packet and assessed artifact domains, or an authorized scoped exception, without requiring unrelated manual/policy edits. A prompt alone is not enforcement. CI shall independently verify refs, statuses and versions against Tesbo's authoritative API or an explicitly validated signed/exported receipt.

**Acceptance:** A change that modifies a governed rule but omits policy disposition is flagged; an absent/offline Tesbo connection yields `blocked`, not a false green check. The gate may initially be informational, with deliberate promotion criteria.

### R-ASE-17 — MCP/client compatibility

Tesbo shall expose capability/schema version and reliable deployed identity. Agent flow shall test tool availability and expected field contracts at runtime, and reject or degrade truthfully when the connected client cached an older catalog.

**Acceptance:** A source branch advertising a newer tool does not cause an agent connected to an older deployed 50-tool catalog to claim it used that tool.

### R-ASE-18 — Security, isolation and data stewardship

All reads/writes shall honor project/organization memberships, immutable skill history, server-only effective skill assignment and human-only governance/promotion, case approval roles, policy authority, KB ownership, token scope, active plan locks, confidentiality, input validation, audit logging and least-privilege uploads. The MCP facade shall call **native application services**, not update tables directly to bypass invariants.

**Acceptance:** Cross-project requirement link, stale update, unauthorized approval, attempts to forge source identity, and tool-call replay with modified payload are rejected and audited.

### R-ASE-19 — Change-impact and freshness

When the underlying source, policy, requirement or manual changes, the existing graph/change-review machinery shall identify affected linked artifacts and signal **review candidates** with freshness/provenance labels, including absent, uncertain and indirect links. A link is not proof of coverage.

**Acceptance:** Changing a requirement revision marks affected case mapping stale pending review; a change with no evidence-backed edge is not invented as a definite impact.

### R-ASE-20 — Observable work completion

The derived change view shall contain an independently reviewable closeout summary, with proposal settlement separate from QA impact closure and release decision: implementation status, applicable artifacts proposed/approved/published, actual tests run and results, untouched/unproven areas, blockers, approvals, and exact record/PR links. It must preserve unfinished work when the session ends or is handed off.

**Acceptance:** Another agent can resume from persisted Tesbo records, not ephemeral chat history, and does not treat proposals as final records.


### R-ASE-21 — One Skills Library, independent version streams
Tesbo shall provide Skills Library views inside the existing **D-14 QA Standards & Playbooks / T-422** owner, extending FR-076/077 and FR-106–113 for independent asset versions, workspace pins and project context. There is one effective-method resolver. Project content reuses KB identity with an explicit immutable governed submission/acceptance boundary; platform packs are not copied into fake project KB records. This provides each governed skill with one stable skill ID, immutable candidate and published snapshots, explicit version/predecessor, content digest, creator/provenance, applicability metadata, supporting files, dependencies and version-specific evaluation. Agents can read authorized versions and **create new candidate skill identities or successor versions through MCP**, never modify an existing skill-version payload, published history or approve candidate status.

**Acceptance:** Agent creates candidate S1 and reads it back. An attempt to edit that candidate in place, edit published v1, or publish a candidate with the agent credential is refused. Creating proposed v2 leaves v1 active and unmodified.

### R-ASE-22 — Human-governed effective module assignments
Skill assignment is a first-class record **separate from skill identity/version**, with workspace/project scope, module/subtype/audience/context, pinned approved version, active/inactive, precedence/composition, effective interval, actor and review receipt. An approved but unassigned version is inert. An inactive assignment does not remove or invalidate the skill record. No automatic "latest" or agent-supplied override.

**Acceptance:** An agent proposing v3 does not affect active v2; human can approve v3 without activating it; only authorized interactive human action can change the binding or activation state, with exact audit history.

### R-ASE-23 — Machine credential non-escalation
No MCP tool or agent-callable REST path may update an effective skill assignment, activation, precedence, approval, trust root, or existing skill-version payload. This is true **even if the machine token was created by a project owner/administrator**. Interactive human governance requires independent trusted authorization/assent beyond token ownership; caller-supplied "human approved" assertions are untrusted.

**Acceptance:** An admin-owned MCP token cannot approve, assign or activate through either MCP or REST/GraphQL variants; all attempts leave state unchanged and produce auditable denials.

### R-ASE-24 — Governed meta-skill and nonrecursive bootstrap
A protected, human-approved Skills-authoring meta-skill shall govern new skill candidates. It requires purpose/scope, principle vs app-context separation, evidence, activation triggers, exceptions, false-positive cases, evaluation, authority boundary and counterexamples. Its approved root and its promotion mechanism cannot be overwritten, bypassed or self-promoted by an agent or candidate; detect invalid/self-referential dependencies.

**Acceptance:** Agent proposes a weaker meta-skill but cannot use its candidate to govern itself or authorize subsequent proposals; a required reference cycle yields an explicit error.

### R-ASE-25 — Exact resolved effective skill set before every applicable write
For each governed authoring task/context Tesbo shall resolve active assignments deterministically based on authenticated project/workspace, module, subtype, audience, operation, phase, actor and applicable capability constraints. Return assigned version IDs, digests, basis and conflicts to the agent; pin them to candidate artifact and Change Packet. Unassigned/ambiguous/expired/revoked/incompatible resolution must be visible and handled by explicit project policy, never arbitrary fallback to a library draft or "latest".

**Acceptance:** Distinct internal-operator vs external-user manuals resolve their configured active skills; candidate/inactive skills are absent from effective instructions; unresolved conflicts block the governed authoring action. Authorized raw observations, failure reports and byte intake retain independent permission/provenance rules and are not blocked solely by an unavailable or revoked authoring skill.

### R-ASE-26 — Skill composition with an enforceable precedence contract
Multiple assigned skills may compose only under a human-approved explicit rule (portable core, project adapter, specialized contract). Validate dependency DAG, incompatibilities, version constraints, root protections, context overlap and an approved precedence order. A project adapter may specialize but not weaken mandatory provenance, approval or authorization constraints. Semantic conflicts that cannot be mechanically resolved remain **BLOCKED for review**.

**Acceptance:** Two overlapping contradictory required skills do not produce an arbitrary winner; incompatible adapter/root versions cannot publish.

**Authoring-content allocation (revision 1.4.39):** Compose the shared authoring principles and the applicable module/subtype guidance in canonical 06 with an explicitly approved project adapter/output profile where needed. Keep one maintained definition of common guidance. Module assignments do not copy a whole external standard, require unrelated module techniques or turn project-specific formats/business answers into platform defaults. This refines R-ASE-21/24/25/26/30/32 rather than introducing another skill owner.

### R-ASE-27 — In-flight assignment drift, revocation and cache safety
A candidate records the resolved assignment set and content hashes at its authoring base; submission/approval/publication revalidates current effective assignments. On drift, revocation, permission change or stale offline MCP catalog, Tesbo preserves the candidate but blocks/requests reconciliation (unless a separately authorized exception permits it). Caches include project/actor/context/assignment version and invalidate on assignment/promotion/revocation.

**Acceptance:** Human switches Requirements skill v1→v2 while the agent edits a requirement under v1; agent does not publish silently, historical proposal remains attributable to v1, current resolution returns v2.

### R-ASE-28 — Classified internal/external manual semantics
Manual subtype, audience, distribution and confidentiality are independent axes. Support internal staff/admin/support/developer/operations and external end-user/partner/public guidance without presuming that "internal" implies one skill or that a publicly viewable document has public draft/history/evidence. Manual proposals use the proper active skill plus existing KB ACL and review rules.

**Acceptance:** Publishing external customer instructions does not expose restricted internal troubleshooting notes, even when both refer to the same feature.

### R-ASE-29 — Classified internal/external policy semantics
Policy audience/exposure, authority source (organizational decision, contractual, law/regulator, external provider), enforcement locus and effective jurisdiction/date are independent. Policies affecting how the application behaves, policies governing staff/agents, and obligations communicated externally may use distinct governing skills and review authorities. External sources are attributed; agent may not invent acceptance by a regulator or governance board.

**Acceptance:** An external-facing data policy can have an internal policy decision, private enforcement evidence and linked external legal source while preserving permission boundaries.

### R-ASE-30 — Every authored artifact pins its governing skill provenance
Each **authored or transformed** requirement, case, manual, policy, task, file/evidence description and skill candidate revision shall pin the **specific** effective skill revisions and assignment IDs that governed its creation, with digest and resolution outcome. Review and history display this provenance separately from substantive product authority. Skills are authoring guidance, not a substitute for approved source requirements or evidence of correct implementation. Raw external evidence/source observations use truthful `skillUsage=not_applicable` with a reason where no Tesbo-governed authoring occurred; preserve their actual source, submitter, hash and custody. Unknown historical skill use remains unknown.

**Acceptance:** Revising a skill cannot relabel a historical case/run as having used the new version; imported legacy records without known skill provenance remain UNKNOWN, never backfilled by guess.

**Guidance versus subject authority:** A case's effective authoring method and output profile remain distinguishable from the requirement/policy/configuration that establishes its expected business behaviour. The same applies to manuals, requirements, policies, work items and evidence descriptions. Resolve unknown expectations during authoring and preserve independently authorized observations without fabricating a rule or execution verdict. Canonical 06 owns the concrete writing guidance; native services retain publication and result authority.

### R-ASE-31 — No skill-text authority escalation or prompt-injection bridge
Agent-visible skill text is authoritative only if server-verified approved and assigned for that task; imported skill proposals, referenced KB content, examples and attachments remain untrusted inputs. Reject attempts to embed tool-call authority changes, secret extraction, silent rule overrides or cross-project access in candidate documents. Preview must not execute embedded content. Readability is separate from authority: authorized candidates may be inspected as untrusted data, but all context assembly, RAG, recent/folder reads, direct/history reads, exports and caches must preserve server-owned authority and visibility metadata. Neither a subtype label nor a new resolver protects bypassing retrieval consumers. Semantic maliciousness cannot be completely proved absent by lint or model review; actual tool permissions remain enforced independently.

**Acceptance:** Malicious candidate content remains inert and is never returned by `resolve_effective_skills` as a governing instruction, including when a second agent names its candidate ID.

### R-ASE-32 — Skill evaluation and promotion evidence
Every proposed skill change shall preserve structural lint results, discriminating fixtures, counterexamples, positive/negative/valid-N/A examples, authoring source and any held-out comparative evidence against prior effective version. Distinguish validator pass from empirical improvement and untested hypotheses. Promotion thresholds are set by separately governed policy, not by the candidate text or authoring agent.

**Acceptance:** A candidate that validates formatting but misses held-out requirements cannot claim proven quality or auto-approve.

### R-ASE-33 — UI library versus governance permissions
Tesbo shall expose searchable skills, draft/version diffs, usage, reference attachments, evaluations and approval status for authorized users; only a separately permissioned **Skill Assignments** governance surface may activate/deactivate, pin versions, set composition or retire bindings. The library offers agent-accessible read/candidate workflows and honest inactive/unassigned/conflicted states.

**Acceptance:** Direct URL/API access to the human assignment page cannot be repurposed with machine credentials; keyboard/touch users can inspect and manage permitted assignments without hover-only controls.

### R-ASE-34 — Universal writer compatibility and migration
Enumerate every existing writer—both MCP aliases, REST/entity routes, native UI, Zyra, bulk/import/clone/restore, automations, SDKs, background tasks and integrations—and every material reader/projection/cache. Converge protected mutations at the native owner, preserve actual machine versus interactive human identity, and prevent bypass of publication, exact-version approval and applicable skill guards. Case status writes, dependent custom fields/tags/links, Bug association side effects and run admission are explicitly included. P-18 project opt-in and named-client grants apply before MCP discovery and calls; current membership/read-write checks alone are insufficient. Migration cannot fabricate previous skill use or change already-approved case/requirement states. Stage rollout against compatible client capability versions, with explicit controlled exception/legacy handling.

**Acceptance:** An old token calling legacy `create_testcase` cannot silently evade a required skill/approval gate; imported historical cases show `governingSkill: unknown` if provenance is unavailable.

### R-ASE-35 — Skill governance linked to change impact
A new approved/assigned skill version shall signal candidate review of affected current artifacts and authoring workflows using the existing graph/change-review owner. No automatic mass rewriting, regeneration or retrospective invalidation of executed runs; current scope and historic usage remain distinct.

**Acceptance:** Requirement skill upgrade identifies applicable new writing tasks and review candidates, while pre-upgrade test executions retain their exact original evidence and verdict.

### R-ASE-36 — Skill lifecycle and scale
The proposal shall define bounded version/assignment scans, indexed contextual resolution, retry/timeout behavior, max payload/dependency depth, archive/revocation effects and measurable cache/latency budgets before code ships. When skill resolution fails or is unavailable, workflows remain safely resumable with explicit blocked/unassigned receipts rather than unverifiable publication.

**Acceptance:** A revoked skill or unavailable resolver cannot be bypassed by requesting an old cached version; failure handling preserves draft work and produces bounded diagnostics.


### R-ASE-37 — Change capture from complementary coding agents and source providers
Tesbo shall support multiple **optional** authenticated change observers, including coding-agent hooks where available (for example Kiro agent/file/task hooks), repository push/PR/merge provider events, CI status callbacks and verified deploy facts. One project may bind multiple repos/branches with stable binding IDs, immutable configuration revisions and source lineage; release candidates reference sets of those exact revisions. Rebinding must not relabel delayed events or history. The current single project-keyed source binding requires a migration; a first slice may advertise single-source capability, but must explicitly refuse/mark incomplete multi-source claims until supported. Ingested events shall be idempotent, source-attributed, ordered where source supports ordering, and durable. A missing hook, unsupported client or failed provider event must not imply the application was unchanged; mark source freshness `UNKNOWN` or `STALE` relative to the latest verified provider revision. The hook is neither the security boundary nor the only way Tesbo learns of changes.

**Acceptance:** A commit pushed without any agent hook produces a visible unmatched change or missing-observation gap through the configured provider reconciliation; duplicate/out-of-order PR callbacks do not duplicate Change Packets; a deleted source binding cannot silently capture another project.

### R-ASE-38 — Verified agent activity and understandable progress
Tesbo shall provide one attributable human-readable activity timeline for an application change, using existing Zyra agent sessions/tasks, graph observations, native logs and authorized external agent event adapters. Each event explicitly distinguishes `tesbo_observed`, `provider_attested`, `agent_reported`, `derived_inference` and `unobserved`; record source, authenticated actor vs delegated agent, time, context/revision, status, retained evidence and privacy scope. Do not claim visibility into local/remote tool actions Tesbo never observed, reconstruct hidden agent reasoning or expose private context to unauthorized reviewers. Support liveness, interruption and unknown status without treating silence as success.

**Acceptance:** A BA can tell what request changed behavior, QA can locate actual test evidence, PM can identify the owner of a blocker, and security can inspect authorized tool events. A self-reported "tests passed" without a runner receipt remains unverified.

### R-ASE-39 — Task-oriented MCP context and composite operations
Tesbo shall extend the **existing** MCP registry with capability-discoverable, bounded project/context bootstrap and composite agent workflows over canonical native services, including a proposed change+requirements/case draft and a verified run-result/defect triage flow. These are **orchestration adapters**, not new independent writers or permission bypasses. Each underlying action shall be authorized and revision-checked, with a stable overall idempotency key and per-item deduplication, explicit committed/failed/not-attempted/uncertain outcome and resumable receipts. Partial staging is not partial official publication: the existing P-07 selected native apply remains atomic and dependency-closed. Receipt lookup and explicit resume are separate operations as defined by the canonical API contract. External effects use a durable handoff/outbox, with uncertain outcomes reconciled before retry.

**Acceptance:** One tool call cannot create a published case that an equivalent direct REST action would deny; failure after the requirement draft but before case linking reports exact partial persistence; replay with the same request key does not duplicate records; a changed payload with a reused key conflicts.

### R-ASE-40 — Independent cross-artifact consistency and contradiction checks
Before recommending publication or release, Tesbo shall be able to check typed relationships and discrepancies among *approved* requirements/policies, submitted proposals, source declarations/code observations, manual versions, test cases/models, tasks and run/evidence status. The analyzer is **read-only until an authorized proposal is explicitly created**; it must classify `confirmed_conflict`, `unresolved_conflict`, `missing_link`, `stale_reference`, `unknown_source`, `not_applicable` and `no_detected_issue` without pretending the last means complete correctness. A requirement inferred solely from code is an observation or candidate, not an approved independent oracle. Correct source owners, not the consistency analyzer, own amendments.

**Acceptance:** A coding agent implements a permission behavior forbidden by an approved policy; Tesbo flags the contradiction rather than generating a matching "requirement" and passing its own check. A missing requirement does not automatically prove one should exist or that the code is invalid.

### R-ASE-41 — One role-sensitive Change Workspace
The existing Tesbo project/Zyra/graph shall expose a single navigable, role-authorized view of the change, with common immutable record identities and revision links. Developer, solo creator, QA, BA/product, PM, policy/security, support/operations and authorized executive views use the same underlying records, customized to their decisions—not different record stores. Show observed agent activity versus self-report, dependencies, requirements/policy impact, test and documentation draft/review state, task owners, release blockers and next actionable review steps. A user must be able to drill into evidence and return to context without a raw log or a separate agent product.

**Acceptance:** Three role views on the same Change Packet show consistent revision IDs, differentiated visibility and no cross-role confidentiality leaks. A low-knowledge reviewer can answer what changed, why, who is accountable and what remains unproven.

### R-ASE-42 — Evidence-aware release readiness and human decision
Tesbo shall provide a **computed, explainable release-readiness projection** bound to a specific source/PR/commit, build/deployment candidate, approval and evidence scope. Its `readiness` is `not_assessed|insufficient_evidence|blocked|ready_for_authorized_decision`, with reason codes and freshness. Human decision, deployment observation and post-deployment verification are separate axes. `released_with_known_risks` is a derived presentation of an observed deployment plus its exact authorized risk decision, never the only release state or a pre-deployment readiness value. Assessment phase is explicit: pre-deployment evidence concerns the tested candidate build; post-deployment acceptance requires the observed deployed build and smoke/monitoring evidence. Do not require future production evidence to approve an initial deployment, or infer it from that approval. Evidence inputs shall include approved expectation versions, coverage scope, case/run approval, executed selections and results, observed target-build identity, blocking defects, policy conflicts, unresolved changes, rollout/rollback plan and responsible release owner. A green CI check or count of linked cases cannot by itself make an application "safe" or verified. Original human controlled publication (P-07) stays in force pending any separately ratified amendment.

**Acceptance:** With no relevant tested-build proof or required negative-path execution, readiness is insufficient/blocked even when unit tests are green. A pre-deployment decision cannot claim production verification, and missing after-deploy evidence prevents post-deployment acceptance. An authorized release decision pins current evidence and risk owner; changing a critical policy afterward visibly stales that decision.

### R-ASE-43 — Post-deployment verification and incident continuation
An application change remains traceable through deployment, post-deploy smoke/health checks, operational monitoring, rollback or fix-forward, and any subsequently reported production defect. Tesbo shall distinguish source change, PR merge, deployment attempt, successfully deployed build, test observations, incident and recovered state. An unavailable provider or missing telemetry yields `UNVERIFIED` rather than a synthetic successful release.

**Acceptance:** An agent's feature passed CI, deployed, then failed smoke: Tesbo links the precise build, regression, affected case/requirement/manual, incident owner, remediation and later retest. Pre-deploy success is preserved historically but does not imply post-deploy acceptance.

### R-ASE-44 — Delivery throughput, instability and human comprehension measures
Tesbo shall calculate or ingest **source-grounded** delivery measures with exposed source, denominator, scope, timestamp, missing data and confidence: change lead time, deployment frequency, failed deployment recovery time, change fail rate and deployment rework rate (DORA's five delivery measures). It shall additionally measure developer/BA/QA/PM time-to-understand a change, review burden, artifact freshness, unsupported agent claims, duplicate records and escaped defects when observable. No performance benefit may be claimed from created-document/testcase counts or by selectively excluding failed work; these measures are **descriptive**, not proof Tesbo caused improvement.

**Acceptance:** A failed deployment is counted in stability and recovery metrics, not excluded to flatter lead time. A sample project with no deployment integration shows `NO_DATA` and source limitations rather than invented zero failures.

### R-ASE-45 — Source and event semantics under failures
For relevant sources and agents, define receipt identities, source/event version, capability flags, clock skew, out-of-order status, event loss and retry/cancellation. Tesbo shall use native graph history and notification writers to deliver change candidates and review tasks with idempotency, dead-letter/recovery and observable queue age. Do not require an always-running local coding agent; provider reconciliation and manual resync must be possible where permitted.

**Acceptance:** A code change observed by provider after the agent process exited still appears in impact review; reconnecting two clients with the same event does not duplicate a requirement; dropped notifications remain visible as pending/failed delivery.

### R-ASE-46 — Privacy and least-privilege agent trace visibility
Tesbo shall distinguish operational trace metadata from optional sensitive prompt/tool payloads. Session logs, evidence, skill text, source snippets and externally linked files obey project/role/retention/redaction/access rules. Access to a high-level release summary does not grant access to private agent prompts, documents, secrets or protected QA evidence; collection and retention of detailed agent traces shall be configurable and bounded.

**Acceptance:** A PM can see a failed agent task and its owner without viewing redacted secrets or a restricted policy draft; cross-project reads and raw tool-event export are denied and audited.

### R-ASE-47 — Comparative acceptance, not copy-by-feature
Delivery of the first integrated Tesbo Change Workspace shall be validated against a real coding-agent workflow using an existing application and a direct QA management baseline (Qase/TestRail where available). Reuse complementary Kiro/Spec Kit/GitLab patterns only where actual compatibility and maintenance/security tradeoffs support adoption. Record measured effectiveness: successful user jobs, erroneous agent claims, human correction effort, time to understand/review/release, test completeness, incomplete-sync recovery, CI/deploy outcomes and costs. A source review or a prototype does not establish production improvement.

**Acceptance:** Two distinct authorized coding-agent clients can produce equivalent change receipts, and at least one BA/QA/PM review flow can be completed without manual record reconstruction. Any benchmark limitation is explicit.

### R-ASE-48 — No forced ceremony, no governance bypass
Agents may begin with spontaneous feature development, a defect fix, a requirement, an investigation or a policy change. Tesbo shall not require a formal model or approved requirement to be authored *before* any code edit, but must apply required authority checks before official publication/release, identify missing policy/requirement context, and preserve the approved test-case and skill-governance boundaries. Every change domain may legitimately be unchanged or N/A with evidence, and the user-facing workflow shall surface the smallest safe next action rather than forcing all modules to generate records.

**Acceptance:** A cosmetic patch does not create fake policy and manual updates. A security-sensitive change cannot obtain a green readiness badge merely because its case author used an approved skill.


Acceptance definitions and the one-to-one R/D/T/proof crosswalk are in [05_IMPLEMENTATION_BACKLOG_AND_TEST_PLAN.md](05_IMPLEMENTATION_BACKLOG_AND_TEST_PLAN.md), revision 1.4.28. These are proposed requirements; actual runtime proof remains separate.

## Revision 1.4.29 — graph interpretation and learning within existing requirements

This amendment extends the existing R-ASE/FR/MBT owners; it creates no new authoritative requirement family. GEX tags are navigation only. The proposal must remain useful for manual QA and for the original delegated-execution loop as well as for source-driven analysis.

| Existing requirement allocation | Added obligation | Distinguishing acceptance |
| --- | --- | --- |
| R-ASE-06; FR-117; native Cases and FR-027–037 | Derive meaningful conditions and human-executable cases from authorized requirements, policy, design, journeys or tester evidence; resolve appropriate method guidance and match existing identities first | A requirement-only project can prepare a useful manual case without a repository/model/driver. A duplicate is linked or amended; absence of automation is not a failed manual test. |
| R-ASE-05/14/19/40; FR-118/119 | Interpret relations with attributed source, revision, actor/state/data context, uncertainty and independently accepted expectations | A source-only edge remains observation or hypothesis. Unknown propagation cannot produce a zero-impact claim; approved behavior contradicted by current code remains a discrepancy. |
| R-ASE-06/21/22/25/29/32; T-422/D-14 | Guide AI analysis with explicit approved effective method versions and composition; allocate variable reasoning separately from enforced guarantees | A method change may alter proposed interpretation using supported tools; it cannot grant a tool, alter permissions, self-approve an edge/case or rewrite history. Missing required guidance blocks that governed authoring operation, not an independently authorized raw observation. |
| R-ASE-37/45; FR-115/116 | Support optional event/watch and periodic reconciliation within actual source/parser capability | Create/change/delete/rename, duplicate, delayed, missing and interrupted events are reconciled to exact source generations without falsely asserting runtime behavior. Unsupported languages or sources stay explicit. |
| R-ASE-06/14/40; FR-117 and native execution owners | Separate deterministic path proposals, accepted richer semantics, native dispatch and actual target observation | Unsupported guards/data/concurrency are refused, not silently erased. `run_behavior_model` creating a native Run is not a target action, assertion or pass. |
| R-ASE-32/44/47/48; T-422 and existing feedback/review owners | Improve methods through attributed correction, independent evaluation and separately authorized activation | Candidate/incumbent comparison includes critical omissions, oracle quality, useful novelty, executability, false claims and effort. A valid rejection, no-change decision or local-only correction is retained; no automatic universal rule or private cross-project data transfer. |

### Quality and legitimate execution

Each proposed manual case identifies purpose/obligation, actor, environment and prerequisites, representative data/fixtures, executable Actions paired with observable Expected Results, postconditions/cleanup, relevant sources and unresolved assumptions. Select applicable techniques from state/transition, decision tables, equivalence/boundaries, roles/permissions, forbidden effects, concurrency, recovery, integration, usability/accessibility and other justified concerns. Do not impose every technique on every case. Preserve native case identity, review and revision history; a candidate in shared staging is not yet an official Draft case.

A human's authenticated manual attempt and original actual observation are legitimate execution evidence without a fabricated machine receipt. An agent cannot impersonate that human or claim actions it did not perform. Human, delegated agent and CI attempts may refer to the same exact approved case revision while retaining actor, capability, environment/build (including UNKNOWN), original results and separate evidence grades. Direct defects and adjacent findings remain separately attributable. A case link, graph traversal, selected run or historical result cannot establish fresh tested-build conformance.

### Grounded analysis and controlled adaptation

AI output must distinguish source-supported facts, independently accepted normative content, accepted mappings, proposed relationships, contradictions and missing information. The analysis identifies why a condition matters, the upstream prerequisites and downstream consequences where evidenced, relevant states/allowed and prohibited transitions, existing coverage and a discriminating observation. It may identify a candidate missing requirement but cannot approve it. Retrieval must preserve authorization, project scope, source freshness and incomplete-context disclosure.

The effective method may adjust query strategy, useful lenses, technique selection, output language and bounded orchestration. New graph schema/parsers, source verification, execution capabilities, protected state changes and immutable recording require ordinary engineered contracts. Candidate methods remain inert until the existing approval/assignment mechanism makes them effective. Recovered skill text is not proof of current installation. The `manual-test-authoring` source conflict between trusting shipped behavior and the accepted requirement must be resolved before adoption; UI labels can ground navigation without legitimizing a product defect.

Feedback may improve source reconciliation, behavioral hypotheses, case-design methods or optional prioritization. Record which layer changed. Keep a stable comparator, independent cases, counterexamples, source/skill/model versions, costs and human quality judgment. Preserve genuine failures and previous attempts. New evidence or an alternate model is not by itself proof of a better skill. Canonical 06 owns the agnostic distillation process; canonical 05 contains the extended existing acceptance suites, with no executed result implied.


## Revision 1.4.31 — graph contracts and assurance findings

Extend FR-115–119 and FR-124 through exact-revision typed relationships to governing policy obligations and user-manual sections. For each applicable obligation, show the approving authority, scope and effective interval. A manual explains intended operation and is linked as guidance. Conflicting requirements, policy, observed behavior and manuals remain visible and require an accountable disposition. A reviewed change may create linked review candidates for affected policies, guides or tests. Publication remains with the respective native owner.

Graph analysis may rank root-cause hypotheses, surface inconsistent execution cohorts and prioritize defect investigation. Root-cause confirmation requires independent distinguishing evidence and an authorized disposition. Risk scores and inconsistency flags are informational. They cannot change test verdicts, defect status or release approval.


## Revision 1.4.32 — Graph Analytics

Extend FR-115–119 and FR-124 with a ranked, permission-scoped Graph Analytics view. Explain the meaning of a relationship, its applicable obligation or guidance, the plausible consequence of a change, evidence strength, alternatives where material, and the next verification step. Initial views are Change impact and Coverage gaps. Later failure investigation and stability use the same reporting surface and existing analytics owners.


## Revision 1.4.33 — Graph Analytics assurance amendments

FR-115–119 and FR-121–124 apply. Each finding explains the affected outcome, exact obligation or evidence basis, relationship direction, plausible consequence, uncertainty and next check. An effective approved policy or requirement can establish an obligation without a model. Manual guidance, observed behavior and inferred dependencies retain their separate meaning. Where applicable, a finding links to the existing FR-119 impact and its current status. Viewing or drafting leaves acknowledgment and closure to that workflow.

## Revision 1.4.34 — source convergence and method-adoption reconciliation

### Reuse requires preserving the retained user contract

Reuse of existing graph, model, case, run, feedback and source services means extending their actual guarantees to the accepted contract, not treating existing status fields or transaction wrappers as proof. CURRENT model applicability is independent of draft creation and approval; machine identity remains distinct from human assent; source access is independently entitled; a generated candidate remains unpublished until authorized apply; native effects and required provenance commit together. Missing lookup data, historical mapping uncertainty and side-finding associations cannot become learned coverage or execution truth. Canonical 03 specifies source convergence and canonical 05 assigns proof to the existing requirements and test families; no new requirement identity or authority is introduced here.

### Method portability preserves the target contract

Reuse an imported method only within an explicit supported authoring/output profile. Separate reusable test-design reasoning from target actors, interfaces, artifact formats, classification vocabulary and lifecycle operations. A target without accounts, a browser, a repository, a formal model or an automated driver must not acquire fabricated prerequisites. Technique applicability follows the actual obligation and supported capability; a narrow specialist method may legitimately be not applicable.

The method must preserve an accepted current restriction, release window or user-visible notice when it is part of the applicable requirement. Incidental planning labels may be omitted; wording alone cannot supersede an accepted obligation. A reusable case's intended actor/data/channel scope is distinct from the subset actually observed. Representative execution supports only its evidenced scope or an explicitly justified equivalence claim, never an implicit all-context pass.

Native definition status, execution outcome, approval, active applicability and presentation layout remain independent. Imported workbook conventions cannot renumber canonical case identities, reset prior attempts, promote a Draft, overwrite relied-on revisions or bypass native selected review/apply. These are refinements of existing T-422, native case/history and accepted-oracle requirements, not new record owners.


## Revision 1.4.35 — Graph Analytics review closure contracts

FR-115–119 and FR-121–124 require approved applicable policy and requirement obligations in the selected scope, including those outside an active model. Keep distinct native impact records and dispositions. Evidence sufficiency and observed outcome are independent. Verified failure leaves the discrepancy visible for native QA triage. A supported no-impact conclusion only applies within a documented, assessed dependency frontier and comparable authorized baselines.


## Revision 1.4.36 — concurrent-source reconciliation and independent assurance

This amendment preserves the complete incoming published 1.4.35 canonical bodies, including portability and Graph Analytics closure contracts, and reconciles the separately reviewed GEX corrections through v11. Earlier receipts bind their exact inputs; final integration requires its own target-bound receipt. The same eight files remain canonical; repository views remain subordinate. The newest explicit qualifications below govern overlapping older shorthand. Source inspection remains pinned to `1alextest/Tesbooboo@6897f989b055a955280f810c7daace86f74057fa`; other open PRs and this proposal do not establish current deployment. Exact current-target review receipts, actual method versions and remaining gates belong to GEX-ASER-2026-11-19. The package remains NOT FROZEN.

### Reuse requires preserving the retained user contract

Reuse of existing graph, model, case, run, feedback and source services means extending their actual guarantees to the accepted contract, not treating existing status fields or transaction wrappers as proof. CURRENT model applicability is independent of draft creation and approval; machine identity remains distinct from human assent; source access is independently entitled; a generated candidate remains unpublished until authorized apply; native effects and required provenance commit together. Missing lookup data, historical mapping uncertainty and side-finding associations cannot become learned coverage or execution truth. Canonical 03 specifies source convergence and canonical 05 assigns proof to the existing requirements and test families; no new requirement identity or authority is introduced here.


### Concurrent graph clarification and canonical ownership

The concurrent subordinate amendments observed at `1alextest/Tesbooboo@2a3708cec25acca0261dcb2461106a8ce0faf036` are reconciled here as proposed revision 1.4.29 scope. The same canonical owners, fixed method candidate in 06, protected native mutation path and NOT FROZEN status remain. Earlier v1–v5 reviews apply only to their exact inputs; this added material requires an explicitly informed later delta. Nothing in the documentation certifies another open implementation PR or a deployed capability.

### GEX semantic obligations and consequences (R-ASE-19/40; proposed canonical clarification)

The **existing** graph shall support authorized, revision-scoped interpretation of what a linked source *means* to a user, operator or system: actor and audience; goal; normative obligation versus descriptive instruction versus implementation observation; triggering conditions; permissions; state/guard and forbidden effects; upstream prerequisites; downstream effects; exception/recovery behavior; effective scope/time; and evidence provenance. The graph must connect approved **Policies** (normative rules and decision/enforcement provenance) and **User Manuals** (audience-specific procedures and intended user-visible behavior) to requirements, code observations, behavior-model revisions, native cases, runs, defects, tasks and evidence *without transferring authority across edges*. Manuals can reveal potential missing expectations but never independently override an approved policy; external mandates are authority only when separately validated in their governing scope. Conflicts, expired versions, contested meanings and missing links are explicit review candidates rather than resolved by LLM confidence.

**Acceptance:** A changed approval rule triggers explainable potential effects on relevant user instructions, roles, state transitions, downstream audit/notifications and tests; each consequence has an evidenced or hypothetical path with provenance. A manual describing a workflow contrary to current approved policy raises a contradiction for owners; the manual cannot redefine the expected oracle. The same behavior applies when a policy/manual changes without any code change. Unsupported domains, insufficient retrieval or ambiguous language yield UNKNOWN, not a fabricated link.

### GEX evidence-calibrated graph analysis (R-ASE-19/40; proposed)

Across existing native histories and authorized graph views, support (a) **root-cause investigation** that separates temporal co-occurrence, dependency, plausible mechanism, tested falsification and verified cause; (b) **defect-risk prioritization** grounded in labeled historical outcomes with model/version, held-out precision/recall/calibration, prevalence/drift and uncertainty, with a valid rules-only/no-prediction baseline; (c) reproducible **node/edge/branch/transition/selected-path coverage** with a model-revision and actor/data/build/environment-scoped denominator, exclusions, feasibility, status tiers and explicit unknown; (d) **flakiness investigation** using comparable attempts, build/environment/fixture/time differences, independently observed outcomes and alternate setup/product defects, without equating any intermittent failure with flaky test code; and (e) **bounded path exploration** with explicit budget, loop/state/data equivalence, safety-critical and policy-mandated obligations protected, reasons for selection/omission and a truthful incomplete result.

**Acceptance:** High structural coverage with a missing approved business obligation remains a gap; a graph-selected path never becomes an executed or Passed result without genuine evidence; a single failed test does not establish a root cause or flakiness; a risk model with unverified labels/low sample size must abstain; a bounded traversal cannot silently discard a required forbidden-transition check. AI may generate evidence-linked hypotheses and experiment proposals but never authority, official defects or test verdicts by inference alone.


### Late concurrent semantic diagnostic reconciliation

The author-applied DISC-01..05 material at branch a800d18 is preserved and reconciled through existing canonical owners. Its diagnostic and all-lens desk record are historical author observations, not independent cold-team receipts, demonstrated method improvement or evidence that source bytes/agents were unavailable in this separate run. The current exact source/review records determine those claims. The following clarifications remain proposed and retain the current scope, authority and proof limits.

### GEX semantic discovery refinement (R-ASE-07/08/09/19/40; proposed canonical clarification)

**Competing applicable obligations (DISC-01):** When several separately approved rules appear applicable to one actor/action, reconcile documented authority, scope, jurisdiction, exceptions and effective periods independently. A genuine overlap with incompatible effects remains `unresolved_conflict` with both exact sources and an accountable authorized decision owner until a valid precedence or exception decision is supplied. Do not infer that the newest, externally sourced, most specific-looking, or AI-preferred text automatically wins. Do not mistake two concurrent revisions of one identity for two independent valid policy authorities.

**Condition-qualified consequences (DISC-02):** An impact proposal must distinguish a link/path from the mechanism that would make an actual behavior change. State the necessary preconditions, affected actor/state, consequence, applicable evidence, plausible alternative/no-effect interpretation and discriminating observation. A correct edge with an unsatisfied guard is not a confirmed effect; an explanatory hypothesis does not establish runtime causality.

**Time-aligned meaning (DISC-03):** Compare Policy, Manual, Requirement, Model, source and tested deployment against a declared *as-of* time, actor and target build; separate effective date from document publication, recorded observation and actual deployment. Historical accuracy, currently applicable, future pending, stale, conflicting and unknown-deployment meanings cannot be silently collapsed. Missing temporal identity must result in incomplete/unknown, not retrospective relabeling.

**Unlinked discovery (DISC-04):** Authorized, scoped reasoning may propose a potentially material semantic relationship between previously unlinked sources using content spans, actor/context/conditions and independent negative comparisons. Similar wording alone is insufficient. The hypothesis remains an unapproved edge candidate; it cannot establish accepted requirement, confirmed impact, coverage or authority until native owner review. Record false positives and deliberately unrelated lookalikes.

**Correction propagation (DISC-05):** When a reviewer contests a derived meaning or impact, preserve the exact original claim, source/Skill versions, correction, reason and reviewer attribution. Recompute or invalidate all known dependent *derived candidates* and explain unresolved consumers; protect accepted authoritative records, historical runs and unrelated graph facts. Neither rejecting a hypothesis nor replacing a Skill version silently edits prior decisions.

**Acceptance:** An independent reviewer can distinguish two valid authorities with conflicting scope, a linked but causally unaffected consumer, historically accurate but not currently effective instructions, a meaningful unlinked obligation versus a lexical decoy, and a rejected inference whose downstream candidates must become stale. Each outcome shows evidence/unknowns and the authorized next owner. A deterministic/no-change outcome is valid. These are proposed additions to existing owners, not a new graph service or a claim of implemented functionality.


**Final authority and evidence reconciliation:** Revision 1.4.35 retains both the published portability assessment and this separate GEX-ASER run without pooling their members, trials or verdicts. The 1.4.34 chapter's characterization of GEX-SEM/GEX-DISC as noncanonical proposals describes that predecessor. In this reconciliation their substantive assertions are allocated to existing canonical proof owners by the explicit tables above/in canonical05; their labels remain supplementary aliases, not new canonical definitions or executed tests. Eight GEX-AC obligations, five current GA-AC checks and 125 ASER definitions retain separate accounting. The current/historical/Skill-assignment and prepared-Run qualifications in this reconciliation control older conflicting shorthand. Imported method conventions are scoped through the existing resolver and native lifecycle. No original method body is installed or activated, and the earlier two-brief experiment does not qualify the changed discovery method or imported-method profile.


**Current36 integration boundary:** The published35 Graph Analytics closure contracts are preserved and govern mixed model/policy/requirement obligation scope, distinct evidence sufficiency and observed PASS/FAIL, per-impact actions, total ranking, authorized-visible snapshot identity and current-authority rollover. Their new fixtures extend the same five GA-AC checks and remain NOT RUN. The DMIS approval-to-posting workflow is the named pilot context, not a universal actor/schema/method or a claimed live test. The incoming short source-checkout claim belongs to its separate review; this run's inspected source remains6897 and its delivery parent is1fe. Earlier current-state statements are historical when this latest explicit qualification differs. This chapter preserves the independently reviewed CURRENT/HISTORICAL, separate Skill assignment, prepared-Run and source-status qualifications above. No empirical benefit, deployment, activation or implementation acceptance is inherited.


## Revision 1.4.37 — Graph Analytics review resolution

Maintain independent axes for applicability, evidence sufficiency, observed outcome, and native impact disposition. Opposing admissible observations in the same applicable cohort are mixed and cannot establish a met obligation without a scoped, authorized native decision. An authorized correction can supersede an erroneous interpretation while retaining the original record. A successful retry is a separate attempt and does not erase the original failure.

## Revision 1.4.38 — existing owner requirements made explicit

This is a clarification of FR-115–119, R-ASE-06/14/19/21–32/34/37/40/45, P-07/P-11/P-18 and MBT-C-12, not a new requirement namespace. A source checkout's platform allowlist and a project's administration privilege do not alone establish source-to-project entitlement. Governed source capture requires the applicable source and destination grants or an evidenced deployment policy making that source shareable to the eligible projects; absence remains a blocked source-dependent operation.

Model applicability has a single native owner: saving and approving a successor do not change the separately activated current revision. Existing model and case identities, relied-on mappings and original attempts survive migration and rollback. Correcting or rejecting an authored candidate is useful work even when optional generation is unavailable; preserve that correction and the compared versions without requiring model-provider credit. Matching uncertainty must remain visible and cannot become a declaration that no similar case exists. All these requirements bind applicable entrances and consumers through the existing owners; they do not make a model, code repository, AI backend or automation mandatory for ordinary manual or case-free QA.

**1.4.38 normative reconciliation:** The current FR-109, FR-110 and AC-077 wording above supersedes the earlier universal hierarchy/story-format requirement. Their IDs and substantive outcome, permission, coverage and oracle obligations remain. Approved project-specific authoring profiles may still require the human-centered hierarchy for their scoped work. Historical 1.4.30 text and review receipts retain their original meaning.


### GEX semantic obligations and consequences (R-ASE-19/40; proposed in the canonical package)

The **existing** graph shall support authorized, revision-scoped interpretation of what a linked source *means* to a user, operator or system: actor and audience; goal; normative obligation versus descriptive instruction versus implementation observation; triggering conditions; permissions; state/guard and forbidden effects; upstream prerequisites; downstream effects; exception/recovery behavior; effective scope/time; and evidence provenance. The graph must connect approved **Policies** (normative rules and decision/enforcement provenance) and **User Manuals** (audience-specific procedures and intended user-visible behavior) to requirements, code observations, behavior-model revisions, native cases, runs, defects, tasks and evidence *without transferring authority across edges*. Manuals can reveal potential missing expectations but never independently override an approved policy; external mandates are authority only when separately validated in their governing scope. Conflicts, expired versions, contested meanings and missing links are explicit review candidates rather than resolved by LLM confidence.

**Acceptance:** A changed approval rule triggers explainable potential effects on relevant user instructions, roles, state transitions, downstream audit/notifications and tests; each consequence has an evidenced or hypothetical path with provenance. A manual describing a workflow contrary to current approved policy raises a contradiction for owners; the manual cannot redefine the expected oracle. The same behavior applies when a policy/manual changes without any code change. Unsupported domains, insufficient retrieval or ambiguous language yield UNKNOWN, not a fabricated link.


### Revision 1.4.38 — semantic discovery conditions within existing owners

**Competing applicable obligations (DISC-01):** When several separately approved rules appear applicable to one actor/action, reconcile documented authority, scope, jurisdiction, exceptions and effective periods independently. A genuine overlap with incompatible effects remains `unresolved_conflict` with both exact sources and an accountable authorized decision owner until a valid precedence or exception decision is supplied. Do not infer that the newest, externally sourced, most specific-looking, or AI-preferred text automatically wins. Do not mistake two concurrent revisions of one identity for two independent valid policy authorities.

**Condition-qualified consequences (DISC-02):** An impact proposal must distinguish a link/path from the mechanism that would make an actual behavior change. State the necessary preconditions, affected actor/state, consequence, applicable evidence, plausible alternative/no-effect interpretation and discriminating observation. A correct edge with an unsatisfied guard is not a confirmed effect; an explanatory hypothesis does not establish runtime causality.

**Time-aligned meaning (DISC-03):** Compare Policy, Manual, Requirement, Model, source and tested deployment against a declared *as-of* time, actor and target build; separate effective date from document publication, recorded observation and actual deployment. Historical accuracy, currently applicable, future pending, stale, conflicting and unknown-deployment meanings cannot be silently collapsed. Missing temporal identity must result in incomplete/unknown, not retrospective relabeling.

**Unlinked discovery (DISC-04):** Authorized, scoped reasoning may propose a potentially material semantic relationship between previously unlinked sources using content spans, actor/context/conditions and independent negative comparisons. Similar wording alone is insufficient. The hypothesis remains an unapproved edge candidate; it cannot establish accepted requirement, confirmed impact, coverage or authority until native owner review. Record false positives and deliberately unrelated lookalikes.

**Correction propagation (DISC-05):** When a reviewer contests a derived meaning or impact, preserve the exact original claim, source/Skill versions, correction, reason and reviewer attribution. Recompute or invalidate all known dependent *derived candidates* and explain unresolved consumers; protect accepted authoritative records, historical runs and unrelated graph facts. Neither rejecting a hypothesis nor replacing a Skill version silently edits prior decisions.

**Acceptance:** An independent reviewer can distinguish two valid authorities with conflicting scope, a linked but causally unaffected consumer, historically accurate but not currently effective instructions, a meaningful unlinked obligation versus a lexical decoy, and a rejected inference whose downstream candidates must become stale. Each outcome shows evidence/unknowns and the authorized next owner. A deterministic/no-change outcome is valid. These are proposed additions to existing owners, not a new graph service or a claim of implemented functionality.

These conditions refine FR-117/118/119 and existing R-ASE obligations; canonical 05 maps the original diagnostic labels without new requirement or test identities. They remain proposed and unimplemented here.

### Current continuation checkpoint — revision 1.4.38

The current canonical parent is the saved eight-file v1.4.37 archive, version 17, SHA-256 `1ed8afd0a978ab9b257c10d61549f6085c7f1f593713a26b0ae56a4540562848`. Preserve all v1.4.35–37 Graph Analytics amendments, including the separate applicability/evidence/outcome/impact axes, bounded frontier witness, mixed governing obligations, permission-safe visible snapshots, native operation receipts and source-index convergence. The pilot is a synthetic DMIS approval-to-posting fixture; it establishes neither a universal application schema nor live DMIS testing.

PR168 and PR167 were merged externally as `f43013473b3a8b725bb547187e21b4459d0e8838` and `1fe100588be6c3a1627ee39a4b0bbc1c0d9da2ea`. This continuation performed neither merge. Its repository-view parent is open draft PR169 at `bddd97971637a54c6e2aff9e7686cfb9c9f25d8e`, based on that merged development commit. The later PR169 head `c07d4c2a16912ca71fbc319aec9a23e68a452edd` adds only a separate executable-preflight review record; all six view bytes remain bddd-identical. Preserve that record and its distinct candidate/executor limits; it is not another role receipt or a verdict on this continuation’s independently pinned reviews. Statements in preserved incoming review chapters about their own source6897 inspection retain that historical scope. This continuation independently inspected source419 and compared full trees through e3d0, b07 and merged1fe: no backend changes across those intervals; b07→1fe changes only ten documentation blobs and no frontend blobs. Thus the qualified source findings in §18.2.1 of canonical03 remain applicable at that merge checkpoint. This is source continuity, not deployment, runtime or acceptance certification. The separately observed b07 CI results retain their exact executed-test scope.

Retain 125 unique scoped ASER definitions, eight supplemental GEX-AC obligations and five unique GA-AC IDs. The five GA IDs carry fifteen cumulative table rows from revisions33/35/37; later fixtures extend the same checks, without adding ten test identities or erasing earlier assertions. Repeated GEX-SEM-01..08 allocations are cumulative fixture/proof-owner contributions to the same eight aliases. Apply the union of their stated assertions and existing owner allocations; they are not competing definitions or alternative authorities. SK-E2E-41..44 and GEX-DISC-01..05 likewise remain mapped aliases. All new product acceptance outcomes remain NOT RUN. Original cold receipts remain unchanged; later target-specific reconciliation is explicitly informed. The package is PROPOSED / NOT FROZEN.


## Revision 1.4.46 — behavioral assurance for governed Skills and agent workflows (PROPOSED)

**Scope and maturity.** Extend T-422/D-14, FR-076/077/101–105/108–114/124 and R-ASE-21–36/38/39/44/46–48 through the existing native Skills, Tasks, shared proposals, Cases, Runs and Files/Evidence owners. This is a proposed specification amendment, not authorization to implement, enable a harness, change an active Skill, add a mandatory gate, or certify an agent. The current development source has a minimum project-scoped approved-version resolver and protected Skills governance; it does not establish the broader evaluation, client-observation, composition or telemetry guarantees below. Earlier dated statements such as “Skills specified only” remain historical where this newer source qualification differs. Exact application-source evidence and remaining gaps belong to canonical 03's 1.4.46 source-fit amendment. Preserve the original eight-file identities and existing requirement/acceptance IDs.

**External-method basis.** Uber's [How Uber Evals 1 Million Agent Skill Invocations a Month](https://www.uber.com/us/en/blog/optimizing-ubers-agent-skills/) (23 November 2026) supplies design evidence for specifications, outcome/process evaluation, ablation, operational metadata and feedback. It is not an adoption receipt, independently replicated benchmark or downloadable Tesbo integration. Its reported evaluation mix, scale, savings and pass-rate observations do not define Tesbo policy. Online canaries and model-family-specific compilation remain separately selected future experiments. The recorded [Zyra authoring pilot](examples/zyra-proactive-authoring.md) found no qualifying advantage for its additional method on the primary scorecard; preserve that result and the current authoring default.

### Product obligations within the existing requirement owners

| Existing owner | Proposed refinement | Discriminating acceptance |
| --- | --- | --- |
| R-ASE-21/24/30/32; FR-076/114 | A Skill's reviewable specification identifies the intended job, applicability/non-applicability, required inputs and outputs, independently grounded expectations, required/forbidden effects, observable checks, recovery and stop conditions, supported client/model/tool conditions, dependencies and evaluation limits. Preserve agnostic principle separately from contextual rule and example. A linter checks declared structure and supported deterministic rules; it does not certify judgment, safe free text or business truth. | A well-formatted candidate that invents an expectation or misses a material forbidden effect remains ineffective/unproven. A legitimate N/A case does not fail merely because it avoids the Skill. |
| R-ASE-32/38/47; FR-114/124 | Grade independently (a) task outcome and important omissions, (b) observable process obligations, (c) permitted and forbidden attempted actions/effects, (d) evidence sufficiency and (e) effort/cost. Preserve existing advisory ordinal work-quality dimensions where applicable; do not collapse non-compensating safety or evidence failures into an average. Evaluate product decisions, useful questions and false questions, not prescribed wording or a single preferred tool sequence. | Correct final state plus an attempted forbidden publication is distinguishable from lawful completion. Reading every named source but drawing an unsupported conclusion cannot pass outcome grading. An authorized alternate sequence can satisfy the same obligation. |
| FR-109/110/114/124; R-ASE-32/40 | Test proactive discovery on tasks that do not supply the missing question. An independently prepared rubric distinguishes material unsettled decisions, already-decided questions, delegated discretion, valid no-change outcomes and unavailable evidence. Retain what source was actually available to the subject. | On a held-out retry scenario, the subject discovers whether the same record and side effect must be observed, identifies an actually missing policy without inventing its answer, and avoids escalating a choice already settled by the supplied authority. A question count alone earns no quality credit. |
| R-ASE-22/25/27/32/36/47; FR-124 | Compare the active method and exact candidate within each supported client/model configuration using the same authorized task, authority, fixture, available tools, effective role, budget and independent grader. Repeat an unchanged-method control to expose ordinary variation. A comparison without an optional Skill, or with a shorter variant, is an isolated experimental arm only when the experiment's authorization permits it; never remove mandatory guidance, safety controls or required delivery from ordinary governed work. | A claimed improvement cannot come from more tools, hidden expected answers, a different task, looser authority or omitted hard cases in one arm. Direct model prompts alone do not establish MCP-client conformance. |
| R-ASE-32/44/47; FR-124 | Freeze the eligible inventory, repetitions, rubric, primary measure, tolerable false blockers/misses, resource ceilings and stop conditions before unblinding. Retain assigned, attempted, correctly/incorrectly graded and ungraded counts plus reasons, unknown and unsupported cells. Report correct/graded, graded/assigned and correct/assigned together; zero denominators are undefined. Preserve paired outcomes and uncertainty. Calibrate any model grader against independently annotated controls and retain disagreements. | A candidate with six correct graded results and four ungraded assignments cannot appear better solely because its conditional accuracy is 100%. Correct escalation on an underdetermined expectation is gradable when the independent oracle expects it; unavailable verification is ungraded. |
| FR-101–105; R-ASE-10/19/32/35 | An authorized agent or human can report workflow friction through the existing Task/Issue/finding route: attempted operation, expected basis, actual outcome, affected method/client/tool revisions, evidence and any workaround. Triage at the real owner before generalizing. Link repeated occurrences, corrected false alarms and independent follow-up; propose a Skill successor only where evidence supports a reusable method change. | A broken adapter, missing grant, bad fixture or changed product policy does not automatically become a Skill rule. One report can yield no change. A resolved repeated failure links to a discriminating regression and actual post-fix observation before claiming verified closure. |
| R-ASE-33/38/44/46; NFR-010/011/012 | Present permission-scoped, version-specific operational measures where observable: uses/attempts, active/candidate version, actual client/model/tool configuration, error/retry/unknown rates, latency, attributable cost, independent outcomes and reviewer corrections. Identify collection source, completeness, denominator, timestamps and retention. Missing observations do not become zero. Adoption, popularity or usage does not prove effectiveness. | An external client with only server-observed fetch/submission receipts cannot claim full generation or local tool telemetry. An uninstrumented cost is unknown; overlapping/nested windows must not be summed as independent causal Skill costs. |
| FR-111; R-ASE-25/31/39/46 | Load a bounded authorized index and exact required sections on demand, preserving content-completeness and version receipts. Stable normalization, schema checks and report processing may use existing service utilities or independently admitted scripts. References, imported packages and generated adapters cannot install tool servers, obtain secrets, add network destinations or enlarge execution privileges. | Truncated mandatory guidance remains incomplete. A small derived answer links to retained permitted evidence. Enabling a Skill never starts a script or changes MCP/server configuration by itself. |
| R-ASE-21/22/24/26/32/36 | A future model/client-specific rendition or deterministic utility is a derived, versioned adapter to one reviewed Skill intent, with source digest, compiler/configuration version, capability limits and conformance evidence. Preserve required/prohibited effects, disclosure and authority. Re-evaluate after a relevant model, harness, tool, dependency or source change; deprecate or retire through the existing human governance owner. | A model-specific wording change that drops a required check is rejected as nonconforming. A better model may justify simplifying or retiring optional guidance only through the separately authorized lifecycle; it cannot silently alter active assignments. |

### Adoption and scope decision

The first proposed increment is one read-only, reproducible comparison attached to an existing Skill version review, using recorded authorized material and independently graded held-out tasks. Native source replay, a local demonstration and a live model/client trial have distinct evidence levels. Extend the existing FR-124/harness comparison accounting rather than creating a second benchmark database or agent platform. A complete product claim additionally needs supported native persistence/readback, authorization, current-source integration and a real human review journey.

The accountable QA/project owner selects the task distribution, supported cells, independently adjudicated expectations, thresholds and budget for that increment. Those values remain explicit prerequisites, not invented defaults and not a reason to block this specification update. Separate permission is required for sensitive trace capture/export, online experiments on customer work, changes to mandatory policy or active assignments, and an external execution runtime. A candidate may be revised, deferred, rejected, scoped to one context or left unused. No new pricing tier, universal pass percentage, online rollout or mandatory marketplace is selected here. Acceptance variations extend the existing proof owners in canonical 05 and remain **NOT RUN** until their exact execution evidence exists.
