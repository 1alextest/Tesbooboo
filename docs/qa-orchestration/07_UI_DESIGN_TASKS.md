# UI/UX Design Tasks and Screen Specifications

**Current package amendment:** 1.4.46 — 26 November 2026; PROPOSED / NOT FROZEN. Read the final revision 1.4.46 section for this update. Earlier revision headers and receipts below retain their historical scope.

**Document ID:** TESBO-UX-007 | **Revision:** 1.4.45 — 22 November 2026. Evidence-derived application coverage. | **Status:** proposed extensions and scoped prototype evidence. NOT FROZEN.
**Scoped implementation evidence:** Native preview increments are tracked in Tesbo PR95 and PR98; use their exact-head receipts and the MBT contract/acceptance sections below. Historical full-source audit pins and older review results retain their original scope/date. Unverified criteria and independent assurance remain open; this is not package-wide implementation or deployment certification.

**Platform UI rule:** Project settings determine target kind/adapter, allowed test actions, test-case templates/fields and suite hierarchy, imported-source mapping, issue tracker and evidence classification. DMIS labels and web browser affordances are pilot fixtures, not universal UI controls. A project with no case import or issue tracker sees no required workbook/GitLab fields. Unsupported target adapters show `NOT_SUPPORTED` with no mock execution.

**Current integration amendment:** Read revision 1.4.28 below for ASER scope, exact canonical owners and contracts. Earlier dated source/implementation claims retain their original scope. The original QA round trip and P-07/P-14/P-17/P-18 are preserved. New runtime tests remain NOT RUN; the package is NOT FROZEN.

## Design basis

The live UI already contains Project home, Activity stream, Test cases, Test plans, Runs, Bugs, Insights, Agents, Knowledge base and Project settings. Agents expands to Tasks, Agent list and Zyra settings. Tasks currently has Task window, Kanban board and duplicate Review Board views. Preserve this structure and its shared components.

The user needs exact prompt → external agent testing → original report → ChatGPT synthesis → human revision/approval → official records. Extend existing task/review surfaces rather than adding independent top-level report/review/issue/audit applications. Current case lifecycle Draft/In Review/Approved is not sufficient proof of human approval before publication.

Live evidence: Zyra inactive and task create/chat disabled without AI allocation; no project API tokens; native case/run/bug/import/custom-field/environment forms inspected. KB create/search/reopen/history passed for one labelled recon note. No external task, report upload, staged review/apply, restricted identity or MCP connection was exercised. Proposed UI below does not imply it is deployed.

## D-01 — Existing navigation and project home

| Current destination | Extension |
|---|---|
| Agents → Tasks | Runtime-neutral Tasks heading; retain List/Task window and Kanban; add Change requests. |
| Current Review Board | Label Duplicate review; preserve duplicate/similarity purpose and current functionality. |
| Agents → Agent list | Built-in agents and Connected instances; dynamic runtime identities/grants. |
| Project settings | Retain API & MCP, Custom Fields, Test Environments, membership/integrations; add Workflow & access and QA formats. |
| Test cases / Runs / Bugs | Existing official destinations with provenance; no duplicate repositories. |
| Knowledge base | Reusable instructions/requirements/examples linked by version; not editable replacement for raw report receipts. |
| Activity / notifications / Project home | Extend with actionable pending task, analysis, review, conflict and retest counts. |

**Acceptance:** users distinguish assigned, claimed, report received, awaiting review and published. Existing official counts do not include unapproved proposals. Do not show online/connected state merely from registration, or promise automatic wake-up of a runtime/chat.

## D-02 — External testing task composer

Extend existing task drawer/page rather than a new task application. Task-kind choice separates External testing from Built-in generation. External kind is available without a Tesbo model-provider key; built-in generation keeps its own allocation/readiness rules.

| Form group | Controls / behavior |
|---|---|
| Identity | Title, kind (exploratory/investigation/regression), optional project-defined role/module and priority |
| Target/context | Project environment and target adapter/capability; permitted target-specific resources/actions (URL rules for web), optional case snapshots, instructions and project QA-format profile/version |
| Prompt | Exact natural-language text, preview, revision history, evidence and cleanup expectations; no target credentials in prompts |
| Assignment | Dynamic instance selector, manual/poller mode and dispatch rule from project policy; no vendor-hardcoded permission |
| Actions | Save draft, submit/ready, assign/send when permitted, cancel; no official case creation |

Before claim, edit creates an authored prompt revision; after assignment/claim, never overwrite what the executor received. Show dispatched version and proposed follow-up plainly. Use clear revision labels rather than technical hashes in the primary user flow; exact integrity metadata can live in details.

**Acceptance:** exact prompt and environment/context snapshot are reviewable, zero case references allowed, external task does not trigger Zyra, secret input is handled safely, long text wraps and actions remain visible.

## D-03 — Task list, Kanban and details

List columns: task/title, kind, role/module, selected instance, prompt revision, task phase, attempt/last contact, last update and author. Reuse existing List/Kanban shells. Preserve internal generation state mapping; external task state is explicit and not forced into generated-case/token counters.

| Detail tab | Content | Actions |
|---|---|---|
| Brief | Exact dispatched prompt and linked environment/instructions/profile/case versions | Inspect revision, prepare new revision/follow-up |
| Execution | Selected instance, assignment, attempt/claim/lease, **executor tool/provider and actual observed scope**, progress/questions and pickup mode | Assign/reassign, answer clarification, cancel or retry as permitted; unsupported tool visibly blocked |
| Reports & evidence | Immutable original receipts/supplements, **linked follow-up retest sources**, evidence by attempt and actual artifact bytes | Inspect source, compare first vs retest, request further testing with explicit scope and evidence question |
| Proposals | Separate analysis and typed case/result/**native defect**/optional tracker-copy items with decisions | Edit/comment, request changes, **request verification/retest**, reject, approve selected, merge approved |
| Discussion & history | Attributed user/agent dialogue and lifecycle events | Comment, follow-up/retest link |

Display task completion separately from review/publication. Expired attempts remain visible; reassignment revokes old authority. Retest creates a linked task/attempt/report without replacing previous evidence.

**Acceptance:** no false claim/delivery state, no confusion between Tesbo MCP and local Chrome MCP, no fake case created to store an exploratory report. An offline client does not block manual review.

## D-04 — Task report and analyst presentation

Use existing Markdown/editor/evidence primitives with safe rendering, report-parent ownership and immutable source presentation. Raw report pane identifies submitting instance, attempt, exact prompt revision, receipt time and source/supplement links. Technical checksums can be in metadata details.

Place analyst interpretation in Proposals or a clearly distinct analysis pane: observed facts, source references, requirement support, uncertainties, blocked paths and inferred claims. Original text never changes when an analyst edits interpretation. A report containing instructions remains untrusted text.

**Acceptance:** one-click source/evidence from a proposal; report upload can precede cases/runs; incomplete evidence does not appear finalized; unauthorized files/links remain inaccessible. No model allocation needed for external report browsing/submission.

## D-05 — Shared staged Change requests and selected publication

Generalize ZyraChatReviewPanel/ZyraDraftEditor and suitable compare components; do not build a competing review application. Keep current Duplicate review distinct and link any relevant duplicate finding from a proposal.

| Region | Design |
|---|---|
| Header | Request/title, author, task/reports, reviewed revision, target project/suite, format/policy version, human reviewer and aggregate state |
| Summary | Counts by typed case create/update/archive, proposed result and issue draft; pending/rejected/approved/committed distinct |
| Item list | Stable operation identity, target/source ID or temporary new-case label, evidence, validation and individual decision |
| Case diff | Base/current/proposed native fields, action/expected pairs, custom values, source ID mapping and suite; full preview for new case, impact for archive |
| Discussion/edit | Field/operation comments bound to exact revision; direct human draft correction; previous versions retained |
| Footer | Exact selected eligible count, unresolved conflicts and Merge approved changes; no implicit inclusion of other items |
| Conflict | Explain changed base/approved revision/profile/destination; offer refresh/rebase/review, preserving prior proposal |

Approval and merge are different. Viewing or editing is not approval. Changed approval-relevant content requires new approval. A new revision does not silently inherit old decisions. Show PARTIALLY_APPROVED/PARTIALLY_MERGED while actionable work remains; committed logical items cannot replay in a new revision. Rejected/withdrawn and approved-for-copy items are terminal review dispositions. Show MERGED when all items are publishing operations already applied; show COMPLETED for mixed/copy-only terminal dispositions with the applied/rejected/copy-only summary; legacy generation done is separate.

**Acceptance:** from 5 case items, approve 3, request changes to 1, reject 1; exactly 3 publish. Independently reject/approve issue text. Stale revision/base or failed mandatory audit yields no selected official writes. Pending/rejected items/comments remain discoverable after a partial merge.

## D-06 — Agent instances, credentials and policy

Use current Agent list for identities; link credentials to existing API & MCP settings. Do not add a separate credential store under a new Agents & Access application.

| Existing location | Fields/actions |
|---|---|
| Agent list → Connected instances | Instance name, runtime/client, owner/project, enabled state, accurate last contact and pickup mode; register/disable/detail |
| Instance detail | Effective capabilities/profile/overrides/task restrictions, current assignments, attribution/history and credential status |
| Project settings → API & MCP | Secure issue/show-once/rotate/revoke workflow; bind token to instance; client-specific setup and connection test status |
| Project settings → Workflow & access | Human review/publication policy, authorized human reviewers, dispatch/result policy, explicit human direct-edit exception and delegated grant administration |
| Workspace settings → AI Providers | Model endpoint/key allocation only; never presented as runtime registration or Chrome access |

**Acceptance:** two OpenCode installations can differ in permissions; changing grants affects next request; disabled/revoked instance visibly loses access. Runtime name confers no fixed authority. Human issuer, actual agent and reviewer are distinct. Registration is separate from successful authenticated MCP use. Keep required access-change confirmations concrete and follow the acting client's authorization controls.

## D-07 — Existing official cases, format configuration and provenance

Use existing suites and the **project-configured** flat or hierarchical taxonomy (Role → Module → Cases only for the DMIS pilot). Use native Title/Description/Preconditions/Test Data/action-expected fields; use existing custom-field definitions for truly separate API Method/Endpoint/reference fields. Define actual source/native ID mapping and applicable profile before migration. Do not copy execution Actual Results/outcome into authored definitions or confuse them with Draft/In Review/Approved status.

Add QA formats inside existing project settings, linked to Custom Fields and KB instructions/examples. Schema/profile version specifies required fields, title/step/test-data rules, issue sections and mappings. A profile change cannot silently invalidate historical approvals or weaken current required fields.

Build missing authorized case-version/provenance reads over existing testcase_versions and reuse the repository drawer. Current tcId route is a redirect stub, not a complete detail/history screen. Durable case/version URLs preserve filters and reopen exact selection after refresh/new tab/back/notification. Add originating request/decision, task/report and reviewer; approved restore is a compensating change with history. Accepted observations remain in existing execution detail/history and Insights.

**Acceptance:** from official case to reviewed proposal to original evidence; custom/profile values visible in diff/history/snapshot; no new independent case/version/run store. For projects that opt into source import, the existing Import stages governed data under protected policy and leaves original source bytes unchanged. Projects without imports work normally.

## D-08 — Native defect publication and optional external issue copy

Defect allegations are typed proposal items in shared review, not live Bugs. The project profile governs rendered format, severity/priority, reproduction and evidence, and optionally a tracker-specific standalone draft (the DMIS/GitLab example: feature + incorrect behaviour title; Description; Steps to Reproduce; Actual; Expected; Evidence). Show uncertainty and reproducer status; support immutable original/retest evidence comparison, edit/comment/reject/request verification, and **separate approval choices**: approve native Tesbo Bug for protected publication versus approve tracker text for manual copy.

Before native apply, preview the **existing `bugs` target and proposed case/run links**, including any Tesbo execution-status side effects, exact approval revision and selected items. `Approve native` only records a decision; the authenticated human explicitly executes `Merge approved` to create/link the Bug and receive its durable ID/receipt. The operation is idempotent, independently reviewable from case operations, with retained rejected/copy-only drafts. Keep draft storage separate from current live bug create/link, which can affect run status. Approval-for-copy causes no Bug/result change or outbound ticket comment; manual Copy Markdown and optional manually filed URL remain supported. No automatic Publish to GitLab in MVP.

**Acceptance:** reject an issue while publishing approved cases; issue decisions independent; standalone copy text matches configured format and contains evidence rather than tester-centric wording.

## D-09 — Design system, access, responsiveness and validation

Use actual app/globals.css violet/semantic tokens and light/dark behavior, current shared Button/Card/Modal/Drawer/Field/Input/Select/StatusChip/Pagination and components/workflows layouts. The teal-only visualguideline.txt is stale. Preserve providers/API/cache/error/loading conventions and update stale guidance inside existing documentation if needed.

Long report, diff and step text wraps; primary actions stay reachable at 1536×770 and narrower layouts. Keyboard access, named controls, visible focus, non-color status labels and screen-reader announcements are required. Separate empty configuration, loading, unauthorized, no data and failure states. Case/user workflow should show meaningful review choices, not implementation plumbing.

Sanitize report/issue Markdown, unsafe links/HTML and evidence rendering. Do not expose credentials, session cookies or full secrets in prompts, previews, copy output, logs or history. Planned capabilities must be labelled accurately; form presence cannot be used as proof of a successful integration.

Live follow-ups: KB search showed missing Updated by/Size metadata that the folder listing had; Reports Overview said No suites yet despite an existing empty suite. Triage those separately from required new features. Do not infer data loss or silently bundle unrelated redesigns.

### D-10 — Agent retest loop and dual-MCP clarity — revision 1.3.5

On Reports/Proposals provide a **Request clarification / Request verification / Retest** action for authorized humans and an accurate linked-task history for ChatGPT-originated requests. Show the exact observed gap, source report/finding/evidence, revised prompt, selected instance, target scope, dispatcher approval (if required), claim/attempt and **executor tool** separately from the Tesbo MCP connection. Enable inspect/compare original versus subsequent reports; do not hide conflicting evidence or imply the old outcome was replaced.

Use the existing Tasks List/Kanban and task details, source-neutral Change requests, `ZyraChatReviewPanel`/`ZyraDraftEditor` transformations, existing Test cases/Runs/Bugs screens, Activity and project settings. The only new controls are extensions in those surfaces. A new ChatGPT conversation can open authorized old pending tasks/reports/proposals from Tesbo without pasting session IDs. Stale revision or unknown executor capability must disable review/apply or claim as appropriate with an accessible recovery path.

**Acceptance:** real dual-MCP web pilot (Tesbo MCP for coordination; configured Chrome MCP or Playwright MCP for target action), ChatGPT-initiated linked retest, new immutable report, proposal re-review and exactly approved native Bug plus selected case changes. Unverified/blocked actions and agent offline state are represented honestly.

## Existing design tasks and acceptance deliverables

| Design Task | Updated deliverable | Pass criterion |
|---|---|---|
| UX-01 | Extend current navigation/home/Tasks | No second workflow dashboard; scoped source-neutral queues discover headless/old pending work; task/report/review/publication distinct |
| UX-02 | External task composer in current shell | Exact versioned prompt/context; no internal model allocation required |
| UX-03 | Current List/Kanban and five-tab task detail | Claim/attempt/clarification/retest clear; correct offline state |
| UX-04 | Task-owned raw report/evidence plus separate analysis | Original immutable/retrievable; supplements retained |
| UX-05 | Generalized staged editor/compare/Change requests | Approve 3 of 5; edit/reject/retest; revision/base-safe selected apply |
| UX-06 | Current Agent list + API & MCP + workflow/access settings | Multiple runtime instances, independent mutable grants/revocation and honest connection state |
| UX-07 | Existing case/run provenance and QA-format settings | Native/custom/profile/ID mapping preserved; history/results correctly separated |
| UX-08 | Typed staged issue editor/copy decision | Project sections; no live bug/result/external-post side effect |
| UX-09 | Current design tokens, access, responsive/error states | Keyboard and width checks; no inaccessible controls; actionable conflict/permission state |

Use dummy data in an identified design/staging context to review these extensions. Keep design decisions and acceptance updates in these existing specifications; no replacement spec set or independent UI framework is required.

## Team-reviewed screen and interaction details

### Source-neutral queues and deep links

Change requests and Reports awaiting analysis have server-backed pagination/search, stable ordering and state/source/task/author/assignee filters. Include chat/external/headless origins and old pending items even beyond 50 newer generation tasks. An alternate analyst can resume authorized work without pasted IDs. Reuse shared staging/report reads; do not broaden task-only grants to project-wide case/report listing merely to obtain context/profile.

Published-case notification/proposal/history links open the correct existing drawer and exact version. Add authorized version reads and routeParams handling for UUID/readable project IDs. Preserve repository filters/back navigation; foreign case/version IDs reveal nothing. Treat this as new read/navigation work over existing data, not an already implemented detail feature.

### Complete manual continuation and report finality

Task Reports & evidence includes authorized Paste/import report and Upload evidence; analysis/proposal editors allow human synthesis and staging without an agent or AI key. Actual submitted-by human is distinct from asserted runtime/source, which must not display as authenticated agent activity. Do not reuse Zyra Feedback/regenerate or outbound tracker selectors for this workflow.

Pending upload shows reserved receipt, required/optional evidence and progress/recovery/abandon state; only verified finalize displays report available. Original and supplemental reports stay separate. Analyst can view actual image/file content by current scoped access; metadata-only or unavailable content is labelled unverified. New report/proposal evidence is excluded from inherited public cycle/trace sharing by default.

### Profiles, policy and context lifecycle

Inside Workflow & access and QA formats, support create/clone/edit/validate/activate/retire immutable versions, assignment/override impact summaries, explicit token ceiling/deny precedence and last-authorized-human safeguards. Current credential authorization reevaluates changes; historical format versions remain readable. General stale settings save cannot wipe reserved policy/profile keys. Show clear version conflict/reload/keep choices instead of silently resetting policy.

Existing environments gain stable ID/context version in the same settings objects; all parsers/save forms preserve them. Rename/reorder/retire never changes dispatched target snapshots. Distinguish displayed historical name/URL from currently selectable context; a changed allowed target needs a new task revision/assignment.

### Exact operation review and completion

Show immutable operation kind, exact existing target or logical new-target reference and full postimage before approval. Matching may recommend update instead of create before review, never at merge. Compare layout may be reused, but current Review Board normalizes punctuation/case/spacing and fetches only live records; replace those semantics with exact Base/Current/Proposed version data. Make punctuation/test-data/custom-field changes visible, not merely approval-invalidating.

Show proposed new suite parent/destination dependencies and exact hierarchy. Rejecting/deselecting required parent prevents child publication with an explanation; no hidden auto-selection/approval. Persistent logical identity prevents already merged A from becoming a new selectable item when B is revised. Conflicting same-target operations are explicit before submission, not dependent on array order.

### Human corrections and shared primitive hardening

Display editing/saving/saved/conflicted state. Close/Escape/backdrop/navigation with dirty edits offers save/keep/discard. Remote revision/session expiry/reconnect preserves typed text for explicit recovery/rebase rather than silently resyncing rows over it. Avoid unscoped sensitive browser storage.

Upgrade current Modal/Drawer with dialog/title semantics, focus trap/return, named close controls and keyboard lifecycle. Associate Field labels with input IDs; do not reuse color-only KB diffs. Mark base/current/proposed text explicitly and announce validation/conflicts. Regression coverage includes impacted existing dialogs, not a parallel component library.

### Data fidelity and accepted history UX

Import preview presents source identity/native mapping and row create/update/unchanged/conflict/rejected, not automatic project-wide duplicate-title deletion. Render independent case-level expectations alongside native step expectations with no guessed correspondence. Versioned structured export preserves literal pipes/arrows/newlines, local/provider requirements, custom tags/values and each project’s full suite parent identities (Role/Module only for the DMIS pilot). Show case-fold/native-ID constraints before cutover.

Accepted run history/snapshot correction is a reviewed compensating revision. Current history-import refresh action cannot silently replace tested expectations with the latest case. Requirement reference custom text must not be labelled native coverage until read projections include the declared references and full bug_links.

## Full-assurance UI updates — revision 1.3

These changes extend the existing **UX-01–UX-09** deliverables; do not establish new top-level screens, credential store, chat-history database or case repository.

| Existing UX task | Specific assurance reconciliation | Acceptance distinction |
|---|---|---|
| UX-02/03 | Intended versus observed task context: displayed host, environment version, observed URL/role/tenant/build (or UNKNOWN), tester/time/source and TESTED/BLOCKED/NOT_TESTED coverage per requested action; structured allowlist/redirect/IdP contradictions visible before dispatch. | A task marked complete does not imply every step or intended environment was tested. A disconnected executor is not displayed as online. |
| UX-04 | Report status PENDING/QUARANTINED/RESTRICTED/FINALIZED; original immutable source distinct from separately hashed permitted redaction; download/view permissions and exact source version/chunk-completeness indicators; image viewer requires actual authorized bytes. | Metadata-only, unavailable or redacted screenshot cannot be labelled original fully inspected. Unsafe source must not leak through preview, logs or export. |
| UX-05/07/08 | Approved post-hoc case drafts show `RESULT_SNAPSHOT_REQUIRED` until the published immutable definition is actually executed; candidates/issue copy/manual GitLab URL are separate. Exact Base/Current/Proposed compares include normalized-looking punctuation/tag differences and `UNKNOWN`/`NOT_VERIFIED`. | No display control may silently accept retroactive PASS/FAIL or merge issue draft with case publication. Unknown is a neutral state, not a success badge. |
| UX-01/03/05 | Fresh authorized replacement client can discover old/source-neutral pending work and reopen exact task/prompt/document-version/report/proposal/decision/receipt without pasted IDs. Optional compact continuation card is derived from authoritative records. | Old reports must be read in full; current KB content or a file name alone cannot impersonate historical source. |
| UX-09 | Test actual stated viewport widths, narrow mobile/reflow, full-length text, focus return after dialog, keyboard tab/Escape, labelled inputs, accessible contrasts and non-color three-way diff. | Only verified viewport/accessibility behaviors are advertised. Missing evidence blocks consequential approval rather than displaying misleading green status. |

**Recovery scenario:** Slow DMIS load, expired OIDC session, and separately the horizontally offscreen Item-wizard Next/Update in 1536×770 are target-browser test conditions, *not* proof that the Tesbo editor fails. Surface task BLOCKED/NOT_TESTED and a safe retest/clarification route; never auto-resubmit uncertain mutations. Define which part was tested under which actual URL/tenant/role, not simply the prompt's intended account.

**Design-system invariant:** Reuse current Tesbo violet CSS variables, existing `Button`, `Field`, `Modal`, `Drawer`, review/editor and provenance components; transform shortcomings with targeted compatibility tests instead of inventing a new design system. QA-094–QA-129 remain planned; no existing screen is claimed to implement these additions today.

### Existing-screen verification addendum — revision 1.3.1

Agent list and API & MCP settings must accurately show active/expired/revoked credentials, actual effective capabilities, issuing human, last-known activity and **unknown/offline rather than inferred online** states (QA-117). Shared staged editor validates the selected project’s configured preconditions/steps/Test Data/expected-result placement (DMIS rules are one profile) and shows exact field-level correction without silently altering values (QA-120). Task/report panes distinguish immutable primary, append-only supplements and restricted derivatives and do not offer overwrite actions (QA-118). Approval/merge controls correspond to separate current human permissions, not broad token capabilities; blocked/NOT_VERIFIED is never rendered as passed (QA-116/119). Reuse existing violet shared components.

### Revision 1.3.2 — accessibility matrix and unknown-state safety

UX-09 must publish its supported browser engine/version, OS, keyboard and assistive-technology matrix **before** test execution. Test at **320 CSS-pixel reflow** independently from **200% text zoom**, with long report and exact 3-way diff content, operation selection, sticky actions, keyboard tab order, focus return, status/error announcements and light/dark contrast. Use adaptive stacked Base/Current/Proposed panels instead of cutting or silently truncating data. The separate DMIS target wizard at 1536×770 is a **different** external browser fixture, not Tesbo UI conformance proof (QA-080/QA-114).

When any task/proposal status or permission is absent, unrecognized or incompatible after an API upgrade, show a **neutral Unknown / refresh** state, preserve dirty edits and source link, provide a safe recovery route, disable submit/review/approve/merge/results that depend on the unknown value, and separately record version diagnostics (QA-129). Server denies unknown/absent permissions regardless of UI. Do not map to Complete/Approved/Passed or silently turn off all historical navigation.

## Revision 1.3.3 — implementation-policy decisions and canonical-source discipline

**UI decisions from PD-01–PD-08:** Keep the current Agent list, Tasks, Change requests, repository, review drawer and violet design tokens. The task composer selects target kind/adapter and manual pickup; web targets show HTTPS origin/path and read-only action defaults, while other supported target kinds use their own typed scope and safe interaction controls; missing approval is a visible blocker and no hazardous click is hidden behind a simple navigational label. Show the actual instance, last-seen and disconnected state without suggesting an offline agent will auto-run.

Project Workflow & access shows current delegated human approvers distinctly from agent credential issuers, approval vs merge grants, active policy/profile version, effective denies and last-human-reviewer protection. Read-only entitlement presents historical permitted records but disables tasks, uploads, proposal writes and merge with typed reasons. Never imply that external MCP use consumes a Tesbo model key or that a plan's client auth is proven from UI configuration alone.

Reports & evidence shows pilot file/receipt/project quota, upload-reservation age, quarantine, hashes, original vs separately redacted derivative, human privacy approvals, hold and synthetic retention countdown and mandatory preservation hold for evidence referenced by a pending/approved result or review. Before real sensitive-project evidence admission, visibly require configured data classification, retention/residency, scanning and export rules. Sample-import review shows original file digest, source-ID/native UUID mapping, field loss/conflict gates, side-by-side configured suite hierarchy (Role/Module in the DMIS pilot), and confirmed cutover approval only after independent readback/rollback.

New-session continuation must distinguish canonical Project source revision, historical report/context version and current server data; no stale pinned source auto-selected. Chromium/Firefox desktop, viewport/zoom/keyboard/screen-reader and unknown-version fail-safe checks remain part of existing UX-09 acceptance. Do not add new top-level applications or a replacement UI component library.

## D-13 — Native Copilot/session picker and CLI execution selection (revision 1.4.0; unique identifier corrected in 1.4.5)

The supplied Open Design screen shows a compact provider menu inside the chat composer. **Borrow only the in-chat selector concept**, not its desktop-only `Use local CLI` / `Rescan PATH` implementation or assets. Tesbo remains a **web-only platform with one Copilot chatbox and multiple project-scoped sessions**, built using the existing violet/light/dark design system and Zyra chat components. AI backend/model selection and task execution-agent assignment are intentionally distinct.

| UI region | Reuse/extension | Required behavior |
|---|---|---|
| Existing Agents navigation and Zyra chat | Generalize the existing chat shell into **one Copilot interface**, retaining old session links | Project selector plus create/search/resume/switch among many sessions; each has isolated history, context and activity, not its own Copilot instance |
| Composer engine selector | Reuse shared Dropdown/Button/Select primitives | Choose an actually configured AI provider API/BYOK or supported agent-backed service for **Copilot chat**; no device installation, local mode or PATH scan |
| Runtime selector | Existing agent list, capability/permission profile and task composer | **Task executor** chosen separately from the Copilot AI backend; show registered user-managed or remote agent instances (OpenCode, Hermes, OpenClaw, Claude Code, Codex, Kimi, etc.) **based on verified protocol/integration support**, with optional hosted runtime as a separate mode; never assume OpenClaw or any runtime implements Tesbo MCP natively |
| Model selector | Existing provider/model configuration and verified runtime capabilities | Show compatible configured backend model options if supported; do not require an agent CLI executable on the user device or assume provider-plan entitlement |
| Connection panel | Existing Project settings API & MCP, agent instances and status | Registered agent identity, where it runs (user-managed/remote/optional hosted), transport, verified last-contact/capabilities/auth and revocation; no local companion pairing or PATH rescan |
| Conversation timeline | Existing Zyra conversation components, activity/proposals and shared Markdown/evidence primitives | Durable attributed events only from **selected project/session**, streaming, source links, restore/resume and provider/agent handoff; switching preserves per-session draft and status |
| Context/knowledge side panel | Existing Knowledge Base/read-only exact-version service | Canonical KB/requirements pointers by version and project access; source summaries clearly differentiated from originals; no file duplication |
| Task/review side panel | Existing Tasks/Kanban, Change requests and Test cases/Runs/Bugs | Authorize dispatch; inspect execution and verify-again; review/reject/approve exact items; explicit human-only merge |

**Critical interaction gates:** display a hosted/API AI backend as `Ready` only after real project-authorized auth/capability/readiness checks; offline or unsupported external executors must not be presented as running. Switching project/session in the **one Copilot** must never mix drafts, messages, KB versions, tool actions, reviews or approvals. Original history remains in Tesbo after provider switching and model compaction. Preserve accessible keyboard/screen-reader states, narrow viewport behavior, source citations, protected review/merge, and denial of arbitrary shell access. No local workstation scanning or installation prompt.

**UI acceptance evidence:** QA-141–QA-158, plus existing cases for review, native Bugs, KB and accessibility. Exact icons, labels and responsive layout are subject to usability testing; the screenshot is a reference image rather than verified Tesbo functionality.

## D-11 — Reuse-first Copilot UI component selection (revision 1.4.2)

**Design principle:** Borrow the compact backend/model picker seen in Open Design, but preserve the existing Tesbo violet/light-dark project navigation and chat shell. The native Copilot is **one shared web chatbox** with project/session navigation; session ownership, KB/version references, task activity and approvals belong to Tesbo, not a third-party chat framework. No desktop execution toggle, local CLI status, PATH button or companion setup.

**Implementation experiment:** Compare extending current Zyra React components against **selectively incorporating suitable source modules/components from LibreChat** (MIT, subject to code-level compatibility and dependencies) or `assistant-ui` (MIT), integrated directly in Tesbo without a second chat store or an embedded replacement application. If deep live agent-interaction UI is genuinely needed, consider CopilotKit/AG-UI as an **alternate** experiment, not a second framework alongside assistant-ui. Evaluate using existing `components/ui`, project providers, session/message API, theme tokens, keyboard focus/200%-zoom behavior, tool/event rendering, exact KB source citations, pending-review panels and screen-reader support. No outside UI package may own project authorization, session persistence, QA approval or official storage; optional cloud history services are not the default. Choose the least intrusive proven approach with a maintainable rollback plan. Capture costs, accessibility regressions and a real provider switch before accepting the library.

## D-12 — Two AI entry paths, external project consent and reuse of actual Tesbo modules (revision 1.4.4)

**External AI route:** A person may stay exclusively in the **ChatGPT/Claude app**, connect Tesbo MCP, select only an opted-in project and one of its sessions, call knowledge/task/report/retest/proposal operations, and open a Tesbo review deep link solely when human review is needed. Do not depict this as a sub-mode of the native Copilot engine selector.

**Native Copilot route:** Exactly **one Copilot chatbox** in Tesbo, providing project + session switcher and one conversational engine/model picker (configured API or compatible hosted/remote coding agent). A **separate** execution-agent picker binds a task to a registered user-managed/remote/optional hosted runtime. Open Design's compact selector is visual/interaction inspiration, not permission to add a local workstation installer, PATH scanner or a second chat product.

**Project Settings → API & MCP / External AI Access:** Reuse `settings/page.tsx` tabs, API token primitives, project member-role display and integrations. Provide an explicit OFF-by-default project exposure control, project-owner/manager confirmation, organization lock indicator, allowed external clients, scope inspector (projects, permitted sessions/conversation threads, knowledge/report sensitivity classes and operation groups), per-credential expiry/revoke, last-use audit, and an effective-access preview. When project OFF, show disabled session/tool discovery, not exposed metadata. Existing human UI still works. Distinguish AI analyst connections from execution agent identities.

**Summary controls:** Within each selected session show `Save summary to Tesbo` instructions/copy template for external AI, `Submit summary` via MCP for external assistant, and executor attempt-summary receipts; native Copilot can checkpoint automatically only for conversations it actually sees. History cards show source app, coverage period, references, completeness gaps, derived/unverified marker, revision and human corrections. Never use summary status as a test pass icon. Provide filtered source-linked original history, pagination and re-fetch on permission changes.

| Screenshot navigation area | Primary official destination | Only added Copilot/session affordance |
|---|---|---|
| Project home | Existing project dashboard | Current sessions and pending approvals summary, deep links |
| Requirements | Linked tickets, KB requirements matrix | Pin exact requirements into task/context, open citations |
| Test cases | Existing suite/case repository, filters, custom fields and history | View staged proposal diff; publish only selected approved cases |
| Test plans | Existing plans | Attach session/task to plan; never create plan merely from exploratory report |
| Runs | Existing cycles/executions | Link real approved result to exact case snapshot; raw report remains separate |
| Bugs | Existing Bugs list/board, evidence and links | Draft/retest reference; native Bug only after approval |
| Insights | Existing reports/requirement matrix and aggregate metrics | Add agent/session metrics as derived slices, not a second analytics area |
| Agents | Existing Zyra/task board and registered agent foundations | Runtime instance/connection status and session-linked task/retest queue |
| Knowledge Base | Existing folder/document/file and version search | Share one canonical version across sessions; do not upload copies |
| Activity Stream | Existing activity and audit | Add discrete session/task/summary/decision events with deep links, no transcript duplication |
| Project settings | Existing General, Members, API tokens, Integrations etc | External AI & MCP opt-in and per-client/session permissions |

**Interaction acceptance:** QA-159–QA-176. Screen artifacts use Tesbo's current violet theme, shared accessibility/focus patterns, existing sidebar order and responsive shell. Avoid a new top-level `Reports`, `Defects` or `Knowledge` page that duplicates an existing destination.

**Thread navigation:** Under the currently selected QA session, display native chat history plus any explicitly registered external ChatGPT/Claude threads and their summary receipts. Distinguish `Native full history` from `External summary only`; allow per-chat summary/revision inspection. Thread chips and labels are navigational, not a second Copilot or another project's knowledge store; respect project/session/thread permission intersections.


## Revision 1.4.5 — full-assurance UX corrections

The unique native Copilot design task identifier is now `D-13`; `D-10` remains the earlier retest design task. This preserves the existing descriptions without two tasks sharing an ID.

Under Project Settings, explain that turning MCP OFF blocks both external ChatGPT/Claude and independently running MCP execution agents; show explicit client/agent grants and warn before disabling an active external task. Session navigation displays a QA-session parent and individually authorized native/external conversation threads, with `Full Tesbo transcript` vs `External summary / receipts only`. On reactivation, do not imply previously blocked tasks automatically resumed.

The existing Knowledge Base `Duplicate` action and `Screenshots & Evidence` reference folder must not cause accidental duplicate canonical requirements or masquerade as the immutable original report repository; display source identity, existing canonical match and the permission-controlled Link/Reference versus Deliberate clone decision. Review evidence is surfaced by links to official report receipts, not by copying it into documents.

## Revision 1.4.6 — full-journey cross-surface reuse and visibility

Preserve existing Requirements, Test Cases, Plans, Runs, Bugs, Insights, Agents, Knowledge Base, Activity and Settings routes; don't turn the Copilot into a replacement domain dashboard. Trace the complete UI path for each material journey and its alternate API/MCP/import/sync/share entry; maintain visible *proposal pending*, *evidence observed*, *review approved*, *published*, *blocked*, *revoked*, *unknown* and *retrying* distinctions. Reopening a session or switching its analyst must not imply that external private chat history is mirrored in Tesbo.

In current Project Settings, explicit OFF-by-default MCP access and named client grants must explain that **user-managed executors connecting through Tesbo MCP are also blocked** by OFF; this does not disable native authorized Tesbo UI. Disable/filtering UI cannot replace backend denial. Linked external knowledge/tickets must always resolve within project context; repeated source IDs in other projects are never surfaced as collisions with foreign object details.

Check existing bulk import, linked requirements, Insights/activity projections, webhooks/notifications, report export and share views against the same source/event IDs and correct permitted user. Do not invent new tab sets merely to visualize these paths. Fold QA-184–QA-190 into the already assigned D-01–D-13 design/regression responsibilities; the independent blind-review process is outside product UI and not a new feature screen.

## Revision 1.4.7 — reconciled technical change

Baseline: the same eight rev-1.4.6 files and pinned fork were reviewed in the completed Work second-pass (G0/G1 only). Read `00_README.md` for version/evidence and the standalone reconciliation audit for all IA-001–IA-040 dispositions. The content below records only this document’s assigned responsibilities; no live acceptance or source change is claimed.

### Source-backed UI regressions to preserve under native Copilot integration

- **Native chat:** scope unsent composer state, delayed history, pending SSE events, model selection and errors to exact QA session/thread/project; thread switch must never send S1 draft to S2.
- **Permission truth:** missing role in project DTO disables privileged controls and displays a truthful unknown/permission-needed state; server guards remain independent. Project read-only versus MCP read should not show a misleading generic 'all actions blocked'.
- **Data-state truth:** share a typed `loading / empty / denied / offline / failed / stale` presentation; older asynchronous search/filter/report responses cannot replace current selected results. An export must say what grouping/filter scope it actually contains.
- **Legacy screens:** plan field-clear and failed-save recovery, actual archive versus permanent-delete labels/public shares, and unsupported schedule creation must remain honest; do not fix by building a second UI or unrequested scheduler.
- **Governance display:** linked Bug must not silently relabel a previously Passed official execution as Failed; show proposed correction separately while the corrected-current-view display choice remains open; revision 1.4.8 direct/side classification is decided. Display cancelled attempt with no original evidence, executor summary after finalize with source/authorization status, and target cleanup residual `cleaned / not cleaned / unknown`.


## Revision 1.4.8 — contextual QA Standards & Playbooks and finding evolution

### D-14 — QA Standards & Playbooks within existing Project Settings and modules

- Add **Project Settings → QA Standards & Playbooks**, with scope picker, effective/overridden rule preview, per-module operational guidance and authoring-template editor, example validation, draft/publish version diff, access restrictions and audit. Authorized admins can configure standards; ordinary users and appropriately granted AI clients read only their effective subset. A mandatory platform/org guard cannot be disabled by local style text.
- Add one contextual **View guide** control in current Requirements, Test Cases, Test Plans, Runs, Bugs, reporting/evidence and other applicable module screens. These are pointers to a single versioned standard and explicit effective revision, not separate settings databases. The Copilot input and human proposal review visibly cite the consumed guide revision; changing provider or selected task does not silently change instructions.
- Define two separate editor modes: **Operating policy** (what to do; classification, evidence, approvals, retest) versus **Writing format/template** (sections, field order, title rules, examples, optional external tracker presentation). Provide project-neutral examples; only a project that configures a specific tracker sees its template.

### D-15 — Finding triage, test-case evolution and retest provenance

- Extend Run/Execution detail with per-condition results, source step/condition evidence, `DIRECT`/`SIDE`/`UNDETERMINED` findings, status proof, and clearly labeled proposed correction; never represent a Bug link as a failed attempt by itself.
- Extend existing Bug detail with `Direct failures` and `Discovered incidentally` groupings, link-to-test conditions, duplicate identification, affected build and new/fixed/reopened retests. Link one Bug across multiple discovery contexts without duplication.
- Extend Test Case detail with **Definition / Executions / Findings / Version History / Coverage & Retests** using existing routing/design language. Version History supports side-by-side diff of title, steps, individual expected conditions, test data/requirements, change author/reason and links to observed app UI/build change. Earlier execution shows its approved tested definition even if the current definition has evolved.
- Expose guided review choices `covered by existing`, `revise existing`, `create new regression`, `not a defect/duplicate`, `needs clarification`. User sees why the agent suggested each, original evidence and confidence, and that a new case is NOT RUN until compatible execution proof exists. Reviews use existing selected publish.
- Activity and Insights offer defensible trends for side-finding discoveries, direct failures, case-revision reasons, coverage additions and time-to-retest; show data freshness/denominator and avoid treating repeated sightings as distinct Bugs or failures.


## Revision 1.4.9 — restrained, task-first execution and relation/history microinteractions

### D-16 — Execution procedure as compact actionable task rows

- In the existing Runs/Executions detail, show a single vertically ordered checklist of definition steps with accessible progress marks, active/failed/waiting feedback, inline **expected conditions** and expandable actual-result/evidence capture. Multiple assertions and conditional branches remain separate, and `action performed` never renders as `assertion passed` without verification.
- Prefer a compact summary (`3/5 actions performed · 2/4 required conditions verified`) and focused expansion rather than a giant static text block, a form for every possible field, or decorative progress. Authoring remains rich structured prose; execution gets an interactive task treatment. Never automatically mark a run Passed from checkmarks.
- Support keyboard/touch, visible focus, accessible control names, offline/partial/error states, safe resumption, responsive layout and exact frozen-definition identity. Show actual vs expected where it is relevant; preserve the user’s place after submitting evidence.

### D-17 — Corrected-status microhistory and typed context trails

- Primary display shows **effective current value**. After an approved revision display `Failed (corrected from Passed)` / `Passed (corrected from Failed)` (or equivalently compact visible status and `corrected` indicator with the previous status available). Hover/focus reveals a concise last-change preview. Click/tap opens the full authorized event timeline: previous → new, actor, time, reason, approval and linked evidence. This must work without hovering and must not leak restricted metadata.
- Use existing immutable `testcase_versions` snapshots for field/step/condition diffs; do not create permanent columns or per-field shadow stores for aesthetic hover needs. Meaningful temporal history remains linked by immutable source/actor/creation date.
- Display relevant typed `covers`, `tested revision`, `failed assertion`, `discovered during`, `verified by retest` links as contextual chips/links near the work, not a mandatory graph canvas or an islanded new module. Each opens a version-accurate, permitted detail view. Keep the visual system quiet and task-centered; validate against Purple accessibility/interaction criteria rather than copying another branded application's chrome.

## Revision 1.4.10 — actual UI baseline and component-by-component reuse mandate
**Audit method:** user-supplied October 18 screenshots of existing Test Case create drawer (top and scrolled steps) and repository, cross-checked with pinned source. The resulting changes are in-place UI extensions, not an independent redesign or another app. For each existing surface, design an annotated before/after using Tesbo's existing violet/dark palette, density, typography, spacing, nav, status and responsive behavior.

| Existing UI / pinned source | Preserve exactly as a capability | Extend with | Reject |
|---|---|---|---|
| `testcases/page.tsx` create/edit right-side `aside` | Present Title/ID/Description/metadata, Preconditions/Postconditions/Test Data, numbered Step Action/Expected cards, Notes, tags/custom fields; Create/Create & Add Next/Cancel; edit Overview/Steps/Custom Fields/Bugs/Context tabs | Compact grouping and optional disclosure of secondary metadata, inline effective authoring guide; definition-version diffs and contextual field history on edit | New stand-alone case builder, new column for every historical value, replacement of the existing per-step authoring fields |
| `components/testcases/RepositoryTestCaseTable.tsx` + suite tree | Suite hierarchy, search, bulk actions, filters, sort, persisted columns and status chips | Contextual `history` action in detail, accurate aggregate/row status parity, typed coverage hints only when relevant | Second case repository, forced extra permanent columns, changing `Draft/Approved` to execution Passed/Failed |
| `cycles/[cycleId]/page.tsx` existing `Drawer` | Run rows, selection, status picker, assignee, actual notes, `LogBugDialog`, evidence and full-page link | Shared task/condition execution component and compact `performed/verified` progress, status correction microhistory; side findings visible regardless of current result | A separate Run workflow, Bug list hidden for Passed, auto-fail when linking a side finding |
| `cycles/[cycleId]/execute/[executionId]/page.tsx` | Deep-linked full execution page, status/actions, existing read-only step cards and evidence | Reuse the exact same shared task/condition component and immutable version state as Run drawer; room for longer evidence and history | Second divergent step state or reinterpretation of current test-case fields as tested historical definition |
| `components/ui/Drawer`, `Field`, `Input`, `Textarea`, `Select`, `Button`, `StatusChip`, `StatusBadge` and current tokens | Approved spacing, controls, status palette and a11y patterns | Small shared `ExecutionStepReview`/`StatusHistoryTrigger` components only if reused by both screens; popover/focus latest change and click/tap full audit | New visual theme, cloned design system, hover-only critical facts, permanently expanded panels for every fact |
| `LogBugDialog`, `ExecutionEvidencePanel`, Test Case Bugs tab | Persisted Bug links, evidence, linked test cases and permission checks | Badge/label `Direct failure` vs `Side finding` with explicit assertion/occurrence association and triage; no result side effect | New bug tracker or imported report/evidence owned only by UI |

**Specific baseline concerns:** The creation panel already has step cards, so its authoring UI needs only small density improvements; the **execution** surfaces are where interactive task state is missing. The UI currently hides linked Bug rows when execution status is not Failed (`cycles/[cycleId]/page.tsx` and full page), contrary to incidentally discovered defect semantics; this should be changed at the existing components and domain writer. The third screenshot appears to show a `Draft` row while summary counters show `Draft 0 / Deprecated 1`; log a reproducibility/aggregate source check, not a confirmed runtime bug. Confirm the drawer's fixed half-width/min-480 behavior at narrow viewports before claiming responsive parity.

**Acceptance/deliverables:** retain current layouts and original CSS variables; provide code-linked updated component spec, screenshot diffs against actual routes, keyboard/touch/mobile flows, existing API compatibility and QA-269–QA-276 results. Keep old screenshot as the grounded before-state. The present documentation does **not** mean product code changed or any live acceptance was run.

## Revision 1.4.11 — BEFORE/AFTER exercise on the existing Run execution interfaces

**Source-grounded design proof, not an alternate application UI.** Review artefacts: `Tesbo_Run_Execution_InPlace_Before_After_Review_v1.4.11.md`, `Tesbo_Execution_Before_After_Prototype_v1.4.11.html`, `Tesbo_Run_Drawer_Before_Reconstruction_v1.4.11.png`, `Tesbo_Run_Drawer_After_v1.4.11.png`, `Tesbo_Full_Execution_After_v1.4.11.png`. The source-reconstructed Before screens are **not captured production screens**; source and the three user-supplied Test Case screenshots established the foundation. Inspect actual current UI in a controlled run before implementation.

**D-16 / D-17 refined (same task IDs):**

| Existing screen / component | KEEP | EXTEND or EXTRACT | Prohibited replacement |
|---|---|---|---|
| Test Case `testcases/page.tsx` create/edit right panel | Existing overview, numbered action/expected authoring, tabs, fields, sticky Create/Create & Add Next/Cancel | Progressive disclosure for advanced metadata only if parity proven; contextual QA Playbooks/history | New wizard, second editor or source-of-truth |
| Run `cycles/[cycleId]/page.tsx` Drawer | Drawer, current Run list, status/evidence/assignee/notes, Log Bug and Open full page | One extracted action/condition review renderer, compact progress/failed condition summary, corrected status hint and linked SIDE findings even when Passed | Full replacement of run page or checkbox=Pass inference |
| Full `cycles/[cycleId]/execute/[executionId]/page.tsx` | Existing deep link/full-page shell, Save, evidence and status | Consume the **same** shared renderer/state; provide more room for actual/evidence without changed semantics | Parallel per-step state or separate execution service |
| `LogBugDialog` | Existing create/link, Bug picker, filed Bug identity | Direct/side/undetermined classification; context-specific wording; avoid saying a Passed SIDE encounter failed the test; refresh authoritative status after mutation | Duplicate Bug form or hidden side discoveries |
| Existing StatusChip & evidence components | Current palette, per-result chip and evidence upload | Corrected-from accessible hover/focus preview + click/tap full history, attached to accurate source truth | New status vocabulary, permanent audit-history columns |

**User task hierarchy:** (1) tested version and effective state; (2) actionable steps with separate outcome verification; (3) exceptional actual/evidence and SIDE/DIRECT links; (4) contextual history; (5) keep high-frequency Save/Log Bug/navigation. Expand only active/failed tasks by default. Human and agent execution share semantics, but should not have to view every backend field. A run status is not a case-definition `Draft/Approved` status. Test narrow sizes and hoverless controls; preserve keyboard focus, pending draft and guarded submit.

**Completion receipt:** source-path component map, linked UI prototype, before/after images marked schematic, accepted behavioral contract, running-client screenshots and screenshots of keyboard/touch interactions once implemented. Latest 1.4.11 additions QA-277–QA-279; all NOT RUN. No new D task ID or new navigation destination.


## Revision 1.4.12 — correct the UI baseline and enforce source fidelity

**D-16/D-17 evidence amendment:** The v1.4.11 `Before` reconstruction was inaccurate as a representation of the actual Tesbo interface and must **not** be used for current-versus-proposed visual approval. The source-informed After prototypes remain behavior concepts, not pixel-parity designs. Actual user screenshots (unmodified original bytes) exist for (a) repository, (b) create form top and (c) create form Steps. They are collected in `Tesbo_Actual_UI_Baseline_v1.4.12/`. For Run Drawer and full-page execution, the frontend source was inspected, but neither a current running-app screenshot nor a verified component render exists. **Visual fidelity is BLOCKED**, not passed by a constructed image.

Before new UI designs, inspect source and actual running current screen side-by-side, matching sidebar, header, drawer geometry, content hierarchy, authentic data, scroll areas, status chips, typography, breakpoints, focus and overflow. Keep existing components, correct only explicitly specified interactions, and capture native frontend After with same fixture. Add a before/after evidence receipt documenting each intentional change; no fabricated Before, no guessed UX, no unverified screenshot claims. Do not create another Test Case repository, execution route or style system.

## Revision 1.4.13 — existing execution/history UI with verified and reconstructed data

**D-16/D-17 existing views only:** In the current `cycles/[cycleId]/page.tsx` Run drawer and `cycles/[cycleId]/execute/[executionId]/page.tsx` full page, use shared attempt-aware view/model without changing the existing shells, navigation, status chips, Bug entry point, evidence panel or Test Case editor. Distinguish visually and accessibly: **current effective result**; **individual recorded attempts** (with actor, build and evidence); **reviewed corrections** (with exact previous result and reason); **legacy imported history** (older result values from V140); and **historical reconstructed Test Case snapshots** (V119 migration-time backfill, not asserted original). Tooltip/focus previews should never promote uncertain history as verified; click/tap reveals source and limitation. Preserve existing Draft/Approved *definition* status vocabulary apart from Passed/Failed *execution* results.

Use one compact expand-on-demand attempt timeline rather than adding five permanent columns; an existing status chip can host a history affordance. Per-action performed status and per-condition verified result operate on the exact latest selected attempt, not across the whole Run. A selected Bug occurrence can show `Discovered during` versus `Caused this failed condition` with typed links. New attempt evidence and step observations must not inherit old execution-level attachments or an imported step position by assumption. If a test's original definition cannot be proven, show `Historical definition unverified` and provide a nonblocking route to reconstructive context; do not silently hide the legacy result or call its provenance high confidence.

**Source anchors for UX design:** V119 `snapshot_*` full-field capture; V140 `step_results/history` imported fields; V84 per-cycle-item latest attempt projection; V117 existing Bug-link owner; `Tesbo-Frontend/lib/api.ts` `ExecutionItem` source comments; both existing execute UI routes and `LogBugDialog`. Keep the authentic-current-UI gate from 1.4.12: visual comparisons to actual renders only, not a hand-drawn prior mock. Implement after authoritative API semantics and cross-view event receipts exist; all QA-280–QA-301 remain NOT RUN.

## Revision 1.4.14 — concrete reuse mandate from repository UI survey

**Keep existing surfaces:** Requirements page, Test Case repository and right-side create/edit tabs, Plans, Runs drawer/full execution page, Bug dialog/details/discussion, agent task/Zyra review pages, Knowledge Base viewer/editor, Reports/Insights tabs, Settings, shared `StatusChip`, `Drawer` and `ExecutionEvidencePanel`. Keep theme tokens and existing status labels; visual before/after must use a genuine baseline at a declared running commit/build.

**Extract or extend where semantics justify:** `(a)` one step/condition renderer and state store shared between existing Run drawer and full page, `(b)` status-correction/field-change history UI derived from `components/knowledge-base/ChangeHistory.tsx`, `ChangeDiffModal.tsx` and the actual KB `ChangeHistoryTrigger`, `(c)` link classification and occurrence badge inside `LogBugDialog`, Test Case Bugs tab and existing Bug details; avoid extra permanent columns and duplicate drawers. `(d)` Policy-denied/stale/pending-audit state uses existing status/empty/loading components rather than turning error into zero/empty.

**Do not mistake superficially similar controls for equivalent business meaning:** KB version restore history is not result correction history; `ZyraChatReviewPanel` selects generated draft cases, not unrestricted official proposal accept; imported V140 attempt history lacks guaranteed correction actors. Component visuals may be reused, while domain behavior/authorization is handled by the canonical owner. No guessed screenshot is accepted as the old UI.

## Revision 1.4.15 — current-screen interaction refinements, not another interface

- **Run drawer and full execution page (existing):** keep shared Run table, status controls, `ExecutionEvidencePanel` and `AutomationResultMeta` surface. An authoritative **older attempt delivered late** may be visible in an expandable history but cannot replace the most recent causally accepted result, while an SDK close error must not look like successful completion. Present incomplete/closed/reopen-required distinctly. Reuse compact status chips and KB-style history, not permanent duplicate columns.
- **Execution attribution:** existing assignee/status/actual-result editors must not make “assigned by”, “performed by” and “corrected by” the same person. Surface original performer and correction actor appropriately in compact history, with accessible click/focus/touch; preserve current drawer/full-screen component parity.
- **Bug link picker/dialog:** the existing Test Case/Run selector needs coherent parent-child validation. If the chosen execution does not belong to the selected Run and Test Case, retain user input, explain the mismatch and allow reselection; never auto-fail an unrelated execution. Display direct versus side finding against the exact occurrence and condition.
- **Baseline rule unchanged:** no invented Before screenshot; match actual source, runtime, theme and current composition, and do not claim visual parity without an authenticated render of the pinned (or identified deployed) build.

## Revision 1.4.16 — keep current UI while fixing misleading states

Existing Requirements source tabs, linked counts, history selector, `SyncStatusPanel`, Plan detail editor and Review Board status/recommendation controls are KEEP/EXTEND, not replacements. Distinguish a failed linked-key lookup from a real zero; a delayed Jira response cannot overwrite Linear's selected source. Show all-skipped-invalid sync as partial/failed, not green success, and expose the current completed/pending/outstanding count clearly. A Plan's optional progress fetch failure may display a small inline retry without navigating away or dropping an editor draft. For Review Board, a reclaimed stale worker cannot flash old findings as completed. Any visual change requires authentic same-build current UI proof; do not generate a guessed Before screen.


**Existing sync and Plan surfaces only:** Extend SyncStatusPanel to display outstanding source revisions after partial runs without pretending the next nightly checkpoint guarantees full coverage. Validate the current Plan item selection and Run/Plan association via scoped picker data plus server validation, displaying a short inline mismatch message without losing edits. Preserve the current layout, shared controls, tokens and authentic-baseline proof gate.

## Reconciled exact-screen design constraints

KEEP/EXTEND the existing Plan picker and Run/Plan editor, Zyra staged-review/save flow, Knowledge Base editor/history/review, sync status and Review Board panels. No new duplicate view or invented visual baseline. Show project-safe Plan relationship rejection, failed Zyra Save with draft retained and no phantom Suite, KB stale-revision conflict and JSON-only review/index state using existing design tokens/components once the exact current frontend source and screenshots are inspected. Source findings justify behavior change, not a wholesale redesign. Each UI task needs BEFORE-source/screenshots → proposed delta → AFTER acceptance and responsive/error/accessibility states.

## Revision 1.4.17 — current-UI fidelity for newly reviewed paths

**Public Run sharing (`app/share/[token]/page.tsx`):** KEEP existing read-only, unauthenticated share screen with brand header, report title, Run status, description, environment/build/date context, donut chart, status cards and case rows. The backend currently returns too many fields; fix response allowlist without drawing a replacement share page. Share disable/re-enable in the existing Run actions needs honest revocation/rotation behavior with the minimum additional affordance required by approved permission policy; do not invent a new settings page.

**Custom Field restoration (`components/customFields/CustomFieldDefinitionList.tsx`):** KEEP existing session-local deleted-item Undo and error text, retain data/definition after conflicting restore, and show an actionable same-name conflict with normal error styling. No new field editor or permanent recovery screen. **Test Case tag editing:** current project tag picker/chips must remain selected when a supplied tag ID is invalid; surface a precise inline validation error rather than silently resetting all selections.

**Password reset and API token settings:** KEEP current reset-password and existing project API/MCP configuration screens. Credential-scoped permissions must be faithfully represented; do not hide a backend authorization bug merely by disabling a button. Reset-token race and server error use existing error/loading components; avoid invented progress indicators or reworked navigation.

**Scheduled Basecamp analytics:** This is a background delivery pipeline; there is no evidence of a customer-facing Tesbo report-management UI to redesign. Instrument its existing job and provider receipt, not a new screen. All UI sign-off requires as-built screenshot/video evidence of the same commit and viewport, including negative/error paths.

## Revision 1.4.18 — D-18: Learning & Product Discoveries inside existing Sessions

**Status:** proposed interaction requirements; no approved new mockup, implemented UI or visual acceptance is implied.

Extend the existing project/session navigation and single Copilot shell with a Learning & Product Discoveries view. Keep separate Principle/Guide and Product discovery views; show source completeness, classification, canonical candidate/requirement link, evidence and review state. A project-level aggregate is a view of the same records, not another backlog store. Reuse existing Requirements/KB/review/diff and Activity components.

Provide compact in-session checkpoint entries and on-demand detailed evidence/counterevidence. Show existing-capability matches, unknown checks, reject/defer/needs-evidence and reviewed merge choices; do not pressure users into creating a feature. Retrospective selection exposes permitted scope, unavailable sources, resource budget, checkpoint, cancellation and truthful job state. No private-source names/counts should leak through filters or badges.

An exact amendment diff displays its canonical document/base revision and human decision separately from candidate agreement. On edit/conflict/revocation, preserve the draft, explain review invalidation and prevent accidental publication. Implementation/validation badges require actual linked records; spec approval is not completion.

Validate keyboard navigation, focus restoration, readable source-status indicators, loading/empty/error/revoked states and session-switch isolation in the current design system. Use authentic current screenshots and explicit sign-off for any proposed visual before claiming fidelity. D-18 supports FR-101–105 / AC-068–072; QA-404–423 cover behavior, with existing accessibility/regression gates retained.

## Revision 1.4.19 — UI reuse for workspace pack and context-first authoring (no new top-level system)

**Extend D-14 (QA Standards & Playbooks) rather than introducing a new Skills page.** Within the existing workspace/project settings family show “Default testing method”, approved pack ID/revision, source/owner, installed-at and update history, effective method preview, approved project/local guides, unavailable/override conflicts and a clear permission-limited “review upgrade” action for owners. A project may not exist when the workspace is created; do not require one just to show an installed default. Existing workspaces have explicit adoption status; never imply all were silently upgraded. A workspace installation should not advertise external MCP as enabled.

**Extend D-13/D-18 Copilot rather than introducing another AI assistant.** One project/session Copilot context drawer opens method index and selectively read exact sections, shows pinned method and source revisions, project/user/module/context inventory status, guide priority and missing facts. External MCP clients get the same effective authorized manifest without using Copilot. Compact P→M→C entry guidance appears before test-generation controls, but is not a mandatory wizard that blocks other valid QA work. Separate source-backed draft story from approved Requirements item, case creation, executed result and exploration assessment.

**Extend D-17 contextual history + existing Requirements/Test Cases/KB views.** Individual assets show separate `vN` approved-version history and `Draft Dn` iteration history, granular field/tags/custom-fields/attachment/evidence/typed-link changes, actor/skill/source revisions and relationship validity. On row hover reveal History; focus, tap and explicit detail actions provide same entry. The preview must show as-of and status; full panel shows true current/approved/draft/unknown distinctions, permissioned compare and revert-as-new-draft. Do not claim V119 reconstructed pre-implementation data were verified at original execution. Reuse existing drawer, editor, minimize/cascade and unsaved-data retention; no new replacement forms without exact source/runtime approval.

**Core method UX:** offer a reviewable representation appropriate to FR-109/110. A selected human-centered profile can use a Primary User Type / Module / Context table; event/contract/state-oriented work keeps its own relevant actor/consumer/context view. Show shared capabilities, applicable allowed/read-only/conditional/denied/unknown states, source and as-of fields. Stories and legitimate alternative drafts cite actual source/approval state, intended outcome and observable acceptance criteria. A legacy project with no tracker sees an honest “create draft note / connect source” flow and an explicit native Requirement capability limit, never fake imported tickets. Risk-based sample justification and skipped/unexamined matrix visible. Use the same authoring templates available via MCP and the same review workflow from D-05.

**States to test:** configured, not installed, no project yet, source missing, private draft, MCP disabled, revoked actor, changed pack since dialog opened, conflicting override, approved vs draft, pending upgrade, unknown requirement source, blocked execution, network loss/retry and inaccessible historic artifact. Existing 320px keyboard/screenreader/touch/reflow and real runtime screenshot gates remain; no invented UI Before or product sign-off from this design. Expected realization: no new navigation item except a small subpanel in existing Settings and associated Copilot/record history links.

## Revision 1.4.20 — change-aware QA impact + connected behavior/evidence UI (PROPOSED)

**UI doctrine:** Reuse current project Sidebar/TopBar, `PageHeader`, `StandardPageLayout`, `Breadcrumbs`, testcase repository, Requirements, Runs, Bugs, agent Tasks/draft review and `components/reports/TraceabilityTab.tsx`. No separate graph application or duplicated case editor. The list/table path is mandatory; any diagram is an optional read-only synchronized projection. These are DESIGN TASKS, not deployed components or screenshots.

### D-19 — Project QA impact inbox (durable record, bell as alert)

**Entry points:** a project-local “QA impacts” item under Test management/Execution *or* a contextual “Changed behavior / Review impact” link in Activity/Tasks, plus existing TopBar notification `quality_impact_requires_assessment` that resolves only to an authorized same-project impact detail. Final navigation placement is an owner UX decision; do not invent a global cross-project feed or an independent QA system.

**Default table columns:** Changed source/build (branch + base/head or provisional), affected route/module/context, behavior family/transition revision or `UNKNOWN`, requirement/AC source status, matched existing native cases, uncovered obligations, source confidence (`AGENT_REPORTED`, `SOURCE_VERIFIED`, `PARTIAL`, `UNEXAMINED`), impact priority, QA assignee, assessment state, evidence outcome and last updated. Show total/filtered counts scoped to the authorized project and current source revision, not read-side cached guesses. Search/filter/sort by impact ID, file, AC, testcase, status and assignee; stable cursor pagination with no cross-project count leakage.

**User interactions:** acknowledge/assign as `ASSESSING`, open detail, request missing source, link an applicable existing native case, submit revised native case or new-case *proposal*, flag source/expectation conflict, request testing, review evidence and close with reason and expected revision. Auto-generated related-case suggestions are separate `RECOMMENDED`, not applied until reviewed. Bell `read_at` never changes assessment. An existing run/bug/case record opens in its canonical Tesbo page, not a graph-specific clone.

**Required states:** NEW, ASSESSING, ACTION_REQUIRED, BLOCKED, VERIFIED, CLOSED, SUPERSEDED, with explicit `SOURCE_UNAVAILABLE`, `EXPECTATION_UNKNOWN`, `CONFLICTED`, `STALE_BASE`, `MISSING_COVERAGE`, `NOT_EXECUTED`, `BUILD_UNKNOWN`, `EVIDENCE_UNAVAILABLE`, `NOT_CHECKED`. Optimistic update conflict (409) keeps the user's form intact and offers view-current/reconcile; no lost text. Outbox lag shows “Impact saved; notification pending” instead of claiming the alert was delivered. A notification writer returning zero must not display “Delivered” without a verified recipient/dedup receipt; show retriable failure and recipient-ineligible states separately without leaking unauthorized identities. A later failure/retest reopens a *linked* assessment, never rewrites a closed historical result.

### D-20 — Behavior/trace view and accessible list-first navigation

An impact detail uses two named sections/tabs, not two independent editors:

**Behavior** — user job, target actor/context (from target project source), starting state/data, ordered action/event/condition/timeout, branch alternatives, refusal, bounded retry/re-entry, handoff/downstream, required/forbidden effects and observation requirements. Each element displays stable ID, current pinned revision, approval status, provenance and source locator/unknown. A screen/URL is merely a possible visual cue, never sufficient state definition. The project can have no approved model; the UI then shows a source-backed partial delta and `MODEL_NOT_APPROVED` with review path, not a fake empty graph or blocking wizard.

**Trace/evidence** — source-approved AC/requirement identity and exact revision → behavior obligation/transition → existing native testcase ID/revision/step/condition → actual run/execution/attempt → independent assertion and evidence artifact → finding/bug/build. Each typed directed edge reveals reason, temporal validity and evidence tier. `LINKED`, `DRAFT`, `NOT_EXECUTED`, `PASSED_ACTUAL`, `FAILED_ACTUAL`, `BLOCKED`, `STALE`, `UNKNOWN` use distinct status text. Viewing or adding an edge never increments executed coverage. Multi-hop traversal has bounded depth/fanout and explicit omitted/unauthorized scope; do not render foreign titles/counts in a disabled button tooltip.

**List-first accessibility:** responsive sortable tables/row disclosures with visible focus, keyboard-operated controls, screen-reader headings/labels, typed edge description, keyboard-reachable links, contrast-safe status text and no color-only distinctions. Preserve native design tokens and existing focus/tooltip patterns. Optional diagram uses the same service/data and has a “View as table” parity route; no drag/drop editor first slice. Modals/drawers retain unsaved work on minimization, permission changes or conflict where safe, and identify data not persisted.

### D-21 — Source-change, QA assessment and historical evidence details

**Coding-agent change timeline:** show original event vs a later correction (never edited in place), exact branch/base/head/merged commit and deployed build *separately*, author/agent type, declared files/routes and independently verified diff additions. Highlight `VERIFIED_BUT_UNREPORTED` and `UNEXAMINED` consumer paths, with a request-for-verification action. An uncommitted workspace digest is visually `PROVISIONAL`, not deployed. Exact Git link/hunk only when source is verified; otherwise disabled unknown locator.

**QA assessment:** in the same view show applicable source/AC status, selected existing cases vs new drafts, required conditions and independent evidence requirements. Use existing Testcase create/edit/draft and Runs/Executions flows; do not display “Passed” because a testcase binding exists. Link to actual artifact downloads only after separate current auth check; evidence unavailable stays visible, not guessed. A failed attempt followed by passing retry displays **both** evidence-bearing attempts and which build/model/case each tested, while native effective status remains what its own authoritative projection records.

**Prepared-work parity:** an approved requirement/plan deep link opens the same QA impact detail, preselected relevant source/case, with no duplicate Prepared/Spontaneous app. Both support inspection of actual diff, unknown results, draft review and direct/side finding separation.

### Screen-level acceptance / negative UX controls (NOT EXECUTED)

| User-visible check | Expected result |
|---|---|
| New unplanned change with no model or case | QA sees the changeset and MISSING_COVERAGE obligation, can assess without mandatory graph diagram. |
| Agent omission vs source diff | Unreported file/route visible as independent verified/unexamined impact, not hidden under “complete”. |
| Changed AC conflicts with behavior | `CONFLICTED` with source authority and review path; cannot be auto-approved from a coding-agent write. |
| Notification read and delivery failure | Bell read only changes bell; persistent QA work remains. Delivery pending/retry visible, recipient dedup proven. |
| Draft case and selected graph path | Case remains in current native repository/review; no clone; no PASSED if no actual execution/evidence. |
| Stale QA decision while editing | 409 shows current revision and diff without dropping typed changes or silently applying stale action. |
| Old failed attempt then later pass | Both original attempts/evidence/builds remain in accessible history, with final effective native status identified. |
| Cross-project deep link/export/count | Non-enumerating denial, no project/title/adjacency/evidence metadata. |
| Keyboard + narrow viewport + no graph library | Same full semantic navigation via tables with visible status, no inaccessible hover-only controls. |

**No UI implementation is approved by this document.** T-460 implements after T-454 owner/design decisions and T-455–459 backend evidence readiness; T-461 runs actual UI/e2e proof in approved environment. Screen colors, content or dashboards may not be called source-authenticated screenshots without actual captured evidence.


## Revision 1.4.21 — D-19–21 source-realistic denial and evidence states (PROPOSED)

- **Unsynced external requirement:** A case's Jira/Linear/Notion key appears as *Linked, source not verified*, with navigable provider identity only where authorized. Do not color the AC green, count it approved or imply a native Requirements record exists until a real revision/authority reference is available. A KB note remains a different source type.
- **Quota-skipped / not yet durable evidence:** Run result label remains the actual native outcome; graph obligation shows `Evidence missing (quota skipped)` or `Evidence pending`, with exactly which assertion was not adjudicated. A later retry is a new attempt/history row, not a replacement for earlier failure proof.
- **Bell/read/inbox independence:** A bell notification can be read without touching `quality_impact_items.assessment_status`. Source/freshness view survives lost bell delivery, with delivery status visible only to authorized reviewers; a revoked user sees a safe unavailable notice, not the previous project's title/link/metadata.
- **Approval availability:** Duplicate Review Board may have a separate subscription and Owner/Manager gate. The new behavior-review action must not link to it as if it were a general approval API. If publication authority or audit is unavailable, show `Approval unavailable` / `Pending review`, with no optimistic 'Approved' status.
- **Historical uncertainty:** Show current testcase revision separately from run-item backfill and imported history. When exact historic revision is not provable, label it `Original definition unverified` with an accessible source explanation, not an inferred previous step set.
- **Accessible proof:** Use existing tables, status chips and review drawers; all statuses must have visible text, keyboard focus, non-color explanation and scoped source/evidence links. A graph visualization stays optional and read-only for the initial slice.


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

#### MBT-001-G — Model Studio UX and interoperability

**Placement:** A dedicated “Model Studio” view under existing project Test Management/QA navigation, using native project routing and one Zyra Copilot. The graph is a visualization/projection of authorized backend data, not client-held authority. Case detail adds “View in Model”; model detail shows states/transitions and their linked cases. Existing test-case creation, cascade/minimize forms, native protected publication and evidence views are reused with explicit model-policy extensions; duplicate Review Board remains duplicate review. Large graphs get filtering, search, hierarchy/clustered overview and accessible list/table alternative. Keyboard, screen reader, focus/zoom/reset, high-contrast and mobile/responsive navigation must be tested. Never require a diagram to complete a test.

**Interaction contract:** The current UI baseline, route ownership, authentication behavior and accessibility must first be observed from source and then in a real browser; no visual pixel/focus sign-off is claimed from this proposal. Click node/transition → inspect expected predicate, risk, requirement, known cases, gaps and last native execution; click case → highlight precise accepted model paths and list versioned links; click changed element → version diff and impact; click generated path → preview steps and existing-case reuse suggestions. Native deep links remain stable on reload and no unsaved edits disappear on panel collapse. Unapproved drafts are owner/author-policy scoped and not publicly presented as accepted product truth.

**Import/export:** start with schema-versioned JSON and a rendered read-only diagram; diagram/image import or automatic ML extraction is proposal-only and separately reviewed. Exports redact sensitive data based on project role; must preserve IDs, revision hashes, evidence references and explicit unknown/excluded states. Cross-project imports clone semantic proposals with NEW IDs and require human revalidation, rather than preserving foreign-project permissions or evidence bindings.


### MBT-C-09 — Source-grounded routes, persistent scope and accessible recovery

Proposed native routes are `/projects/{projectId}/models`, `/models/{modelId}/revisions/{revisionId}` and revision-relative `/paths/{proposalId}` under that project. These are future route contracts, not claims of existing pages. Extend the existing case repository/detail-route owner to resolve `/projects/{projectId}/testcases/{caseId}?caseRevisionId=…&stepId=…`, preserving case identity rather than redirecting it away. “View in Model” carries exact project/case/revision/step and an authorized same-project return context. Server resolves IDs; no title/array index is authority. Unknown/deleted/revoked targets show non-enumerating unavailable state, never a different case. History mode is explicit in the URL; draft confidentiality still applies.

Store shareable identity/revision/scope/filter selections in validated URL parameters; session return context stores suite/filter/sort/page/scroll and unsaved form recovery under project/user isolation. Raw evidence, credentials and private form text are never in URLs. Browser back/reload/deep-link preserves selected case/model revision and list context. Unsaved navigation offers Save draft / Keep editing / Discard; collapse/minimize does not discard. Project/tenant changes fence late fetch/validation/save responses; they cannot render or attach in the newly selected project. Restoring a saved draft requires current authority and conflict detection.

Every graph/list/diff/proposal/coverage surface displays persistent scope: selected revision and approval, active pointer version, CURRENT/HISTORICAL mode, exact case revision where applicable, source/build/environment, actor/fixture and evidence freshness/unknowns. Moving between views preserves scope or explicitly confirms a reset; no hidden latest-version substitution. Historical passing evidence beside a newer active revision is labeled historical and current UNKNOWN/STALE.

| View | Primary question / action | Success signal |
|---|---|---|
| Model list | Which applicable model/revision should I inspect? Open model | Exact revision and scope retained |
| Detail/list/graph | Which behavior and canonical cases apply? Inspect element/case | Same identity/relationships in graph and list |
| Draft editor | What expected rule changes? Save/submit exact draft | Preserved input and new version/receipt |
| Review/diff | Is this revision justified? Approve/reject | Exact human decision receipt, no activation implied |
| Path preview | Which bounded proposals reuse existing cases? Select/reuse | Explicit selections, forecast distinct from verification |
| Run preparation | Where will selected work execute? Choose/prepare native run | Native run ID or visible uncertainty, no dispatch implied |
| Coverage | What is actually verified in this scope? Inspect supporting observation | Counts, exclusions/unknowns and evidence provenance visible |

| UI state | Required presentation and recovery |
|---|---|
| Complete empty/no model | Explain no model/links; offer authorized create/link action; no fake path |
| Loading/pending | Keep context/input; announce progress; prevent duplicate intent |
| Fetch/provider unavailable | “Unavailable,” retained stale data if safe, explicit retry; never empty-success |
| Forbidden/revoked | Non-enumerating access-unavailable message; no stale private data or retry-write loop |
| Conflict/stale revision/link | Preserve draft/selection; compare/refresh/review, no blind overwrite |
| Partial/truncated | Show stop reason, logical work/unknowns; no complete forecast |
| Commit outcome unknown | Reconcile original request/receipt/native records; disable blind create |
| Cancel requested | Show pending acknowledgement and known/uncertain effects; no false terminal success |
| Cancelled/failed/budget blocked | Show terminal cause and authorized explicit new attempt; preserve evidence |

Every graph action has an equivalent permission-identical list/table action: select states/transitions, inspect predicate, map/unmap case steps, compare revisions, inspect evidence, preview/select paths and review/activate. Use stable accessible names, textual statuses, roving/standard keyboard order, focus return to the invoking element after drawers/modals, validation/status announcements, zoom/reset controls and bounded pagination with selection retained. Changing graph/list layout does not reset scope or dirty input. No graph-only drag gesture is required.

Before implementing UI changes, inspect actual repository routes, picker, evidence panel, forms/shared consumers, and render the authorized current build at agreed fixture/role/viewport/theme. Capture After against the same baseline, including full keyboard/screen-reader author→review→mapping→preview and back/reload/collapse, responsive/zoom and permission/error/empty states. Existing screenshots/mockups/source-derived drawings cannot certify visual parity. No runtime/UI sign-off is recorded by this document.




## Revision 1.4.23 — Model Studio revision0.3 reconciliation



**Canonical identity:** MBT-C-12 in `03_TECHNICAL_DESIGN.md` binds Model Studio to the same FR-117 behavior family/revision owner; model IDs are aliases, and current-published is the active pointer, never a second latest-approved authority. This v1.4.23 clarification governs operative FR-117/MBT identity and selection wording in earlier proposal sections; historical source evidence retains its original pin.

Scope summaries display canonical model/family identity, exact revision, approval and separate active-pointer state from the one authority. Coverage shows separate structural and actor/assertion units. Mapping removal recovery retains user input and never presents an undispatched selection as retained execution authority.


## Revision 1.4.24 — opt-in native M1 candidate preview

MBT-C-13 in `04_MCP_API_CONTRACTS.md` owns the exact ephemeral structural preview contract. This adds no expected-model identity, publication, active pointer or second data store; FR-117/C-12 remain authoritative for future persisted models. Intake and authorization are explicit; default OFF. Source implementation is proposed for merge in Tesbo PR95, parent92abc860/native implementation23b5a7ec; no deployed or target-runtime proof is claimed by this spec checkpoint. Existing historical source/test/review claims remain at their original pins.

No frontend change is shipped by this preview increment. Any future UI must expose DRAFT_PREVIEW/NOT_APPROVED/UNVERIFIED/NONE truth states and retain diagnostics, without inventing current model/case/runtime coverage. Authentic current/After screenshots and keyboard/AT evidence remain required before UI sign-off.


## Revision 1.4.25 — native MCP draft-preview integration

MBT-C-14 extends the existing MCP gateway with the MBT-C-13 stateless validator. This adapter creates no model authority or native QA record. Review gates remain NOT FROZEN; persisted models, activation, generation, target execution and native UI require their own completed work/evidence. The earlier native REST code at778e3658 has exact-head CI evidence; this MCP delta requires its own final-head receipt in PR95. Historical review and implementation statements remain pinned to their original revisions.

The MCP catalog/diagnostic count becomes53. Two existing exact diagnostic assertions update accordingly; no production frontend redesign is part of this increment. UI/accessibility acceptance remains open.


## Revision 1.4.26 — native ephemeral draft inspector

MBT-C-15 adds the bounded structural list inspector and scoped availability read to the existing Zyra page. C-13/C-14 remain validation owners; C-12 remains future persisted-model authority. Earlier API-only/no-frontend statements describe their historical slices, not this new increment. There is still no approved/persisted model, graphical editor, case mapping, target action or self-issued independent freeze. PR98 owns exact-head implementation/visual receipts. Historical acceptance and review results retain their original pins.

Native structural list inspector is a separate limited increment under C-15. Require labelled JSON editor, native keyboard controls, semantic truth/status/error text, state/transition tables and retained diagnostics; no authoritative graph/model identity or publication action. Desktop/mobile screenshots and keyboard/scoping/failure tests prove only the named slice. Full graphical editor, broader AT audit and independent design sign-off remain open.


## Revision 1.4.27 — inspector wire-format and layout proof clarification

C-15 admits only object-shaped JSON to the native POST transport. Invalid JSON, null, arrays and primitives remain in the editor with local errors; semantic fields, bounds and authority still use the one native validator. This avoids treating a pre-routing JSON/CORS transport failure as a typed model response. Mobile containment is measured after the existing sidebar reaches its chosen60px collapsed width; the strict overflow assertion and default timeout are unchanged. Independent assurance, full AT, persisted/graphical authoring and target-conformance gates remain open.

Use an explicit separate label/htmlFor/unique editor ID and help association so controlled text cannot change label targeting. Wait for the actual chosen sidebar width before measuring containment; do not suppress overflow, widen timeouts, weaken selectors or drop failed UI journeys.

Combined PR98 validation retains the additional native overlapping-history pagination regression. It extends the inspector selection from14 to15 scenarios without replacing any prior scenario.


## Revision 1.4.28 — existing-surface placement, role-safe review and acceptance

Canonical 02 owns ASER-UX01–03. The identical contract below is adopted here for UI task allocation and acceptance; it is not a second workflow authority.

### ASER-UX01 — Preserve the intended workflow and both entry paths

The central principle remains: **the codebase and its supporting engineering records evolve together**. A developer or coding agent may start from a feature, defect, refactor or investigation. Tesbo MCP supplies shared project/change context; native record owners and reviewers determine what must change.

| Stage | Usable human/agent outcome | Existing owner and retained boundary |
| --- | --- | --- |
| Understand the change | Identify project, source scope, request, current records and applicable decisions; disclose unknowns | Source binding + FR-115 changeset + bounded context; no guessed project or automatic requirement inferred from code |
| Requirements | Propose expected behavior/criteria against the existing native or externally owned revision | Requirements / governed KB + shared staging; provider authority and human acceptance remain explicit |
| Test Cases | Reuse/update cases and exact requirement coverage, then prepare and actually execute permitted scope | Native cases, Models where useful, Plans/Runs/attempts; drafted, approved, selected and executed are separate |
| User Manual | Update the correct existing audience-specific section when behavior changed | KB identity and exact reviewed revision; access is not inferred from audience label |
| Policies | Record applicable authority, decisions, invariants and enforcement/unknowns | Governed KB + shared review and typed links; no agent self-approval |
| Tasks & Issues | Assign implementation/review/defect work and retain unresolved follow-up | Existing Tasks, Bugs and impact obligations with distinct lifecycles |
| Files & Evidence | Preserve original reports, source references and actual accessible bytes | Existing file/report/evidence owners; raw observations are not invented skill-authored artifacts |
| Trace, verify and decide | See one versioned history of what changed, why, which build/scope was tested, who decided and what remains | Existing Zyra Change review composes the native facts; separate release decision and post-deploy verification |

Skills governance is cross-cutting: each governed authoring operation resolves the exact approved assigned method; a change does not need to create a skill, policy or document merely to satisfy a checklist. Seven domain assessments are mandatory, seven mutations are not.

**Original QA round trip remains mandatory and additive:** ChatGPT creates a durable exact prompt/task through Tesbo MCP → assigned OpenCode or another capable instance claims the fenced attempt → executor uses its own authorized Chrome/Playwright MCP or equivalent driver → immutable original report/evidence returns through Tesbo MCP → ChatGPT reads original evidence, analyzes uncertainty and can request a linked retest/new report → human edits/rejects/approves exact selected operations → protected apply updates native cases/results/Bugs. No existing cases, formal model, Tesbo AI key or new browser engine is required for case-free exploration. Manual receipt/synthesis fallback preserves true attribution. A local agent cannot be assumed stopped merely because its server lease expired. The broader coding-change flow does not replace this contract (FR-001–037, T-201–207/T-301–308/T-401, QA-135–138).

### ASER-UX02 — One role-sensitive workspace, capabilities rather than invented roles

Extend **Zyra → Change review**, its existing task/review discovery and native record destinations. Skills Library and separately protected Assignments are subviews of **D-14 QA Standards & Playbooks** in existing settings, with contextual links; no new top-level Skills navigation or second Copilot is introduced. A solo person can perform several jobs. These job labels do not grant new roles or permissions.

| User job | Safe information / decision | Required server capability and next owner |
| --- | --- | --- |
| Developer / coding agent | Authorized source/change context, own permitted draft operations, actual tool receipts and blockers | Current project read/propose grants; machine principals cannot acquire human approval through token ownership. Request review through the existing queue. |
| BA / product | Exact requirement/criteria versions, proposed behavior change and coverage gaps | Requirement read/propose; acceptance requires the separately configured human requirement-review authority. If absent, preserve candidate and identify that configuration gate. |
| QA | Test definition diff, selected manifest, actual attempt/evidence, blocked/untested scope and Bug relationship effects | Case review/run/report/correction capabilities are separate; the configured authorized tester or reviewer supplies the missing decision/evidence. |
| Policy / security | Permitted source obligation, decision, policy effectivity and control/test evidence | Policy read/propose does not grant policy activation or skills governance. Current explicit authority and exact scope are required. |
| PM / delivery / executive | Authorized summary of progress, responsible owner and permitted blocker/risk reasons | Project summary permission grants only its allowlisted fields. It does not grant restricted document/history/prompt/evidence access or release approval. |
| Support / operations | Published relevant guidance, deployed build, incident and remediation/retest links | Native document/incident/report capabilities; restoration and release decisions remain with their independently authorized owner. |
| Workspace/project governance human | Approved method versions, binding diffs, exact scope/precedence, emergency recovery state | Independent trusted human governance action plus current configured capability. Existing KB edit ownership and project membership are not automatic skill/root/policy/release authority. |
| Release decision maker | Candidate build, evidence snapshot, required sign-offs, known risks and rollout/rollback responsibility | Current explicitly configured human release-decision capability. Decision is pinned; observed deployment and later smoke/incident results remain independent. |

Implementation must map these capabilities to Tesbo's actual existing principal/role/ownership checks and approved project policy; **unknown mapping means denied for the affected action**, not an invented role or a new permission service. The inspected KB UI currently allows owner/manager mutation or creator-owned mutation; that is a current editing rule, not proof of the future governance rights. Before exposing protected actions, record the actual mapping and positive/denied API/UI tests in T-004/T-102/T-103 and the relevant work package.

### ASER-UX03 — Recovery, disclosure and continuity at every decision

| State | What the user can know | Safe action / accountable next actor |
| --- | --- | --- |
| Successful empty lookup | No authorized records in the successfully queried scope, with pagination/completeness | Create a permitted candidate only after reconciliation; do not confuse with failed discovery. |
| Unavailable / partial / stale source | Last permitted data, labelled stale when retained, failed scope and retry/reconnect guidance | Retry the read or ask the source/integration owner. Preserve draft work; no inferred zero coverage or duplicate record creation. |
| Permission unknown / denied / revoked | Permission-safe denial and any explicitly shareable next-owner information | Current owner restores a valid grant if appropriate. Do not auto-switch project, reveal hidden counts or renew privileges from cache. |
| Required skill absent, conflicted or revoked | Affected authoring operation and human-governed recovery path | Governance owner resolves/assigns approved guidance; preserve the candidate. Authorized raw evidence may still be received through its independent permitted route. |
| Stale proposal / changed base or dependency | Exact reviewed, current and proposed versions where authorized | Compare/rebase and obtain the needed new review; retain typed comments and unsaved edits, never silent overwrite. |
| Partial or uncertain operation | Each known committed/failed/not-attempted/uncertain item, without inaccessible metadata | Read the authoritative receipt first; explicitly resume only eligible work. Generic Retry must not duplicate an unknown committed action. |
| Restricted evidence | Only the approved summary/disclosure fields; never the protected payload or an existence leak | An authorized reviewer assesses it or publishes a permitted summary. Restricted does not mean no evidence, passed or N/A. |
| Rejected / cancelled / validly deferred work | Exact terminal decision and surviving impact/work obligations | Keep original records and review history; show next owner/trigger. Proposal settlement does not imply QA closure or release. |
| No deployment/monitoring data | Pre-deployment candidate evidence versus unverified production state | Configure authorized observation or perform the appropriate validation; no fabricated success or zero-failure metric. |

Every drill-down carries project, changeset, exact artifact/revision/operation or attempt and a validated return context. Preserve queue filters, selection/scroll where applicable, draft comments and keyboard focus when returning. Direct deep links and old pending work must remain discoverable with pagination. A stale link offers a permitted exact historical view and current comparison; it does not silently open latest. On project switch, cancel/fence stale responses so data, permissions and unsaved work do not cross contexts. A bell read is not an assessment decision. Inherited canonical shared-dialog, exact-link, dirty-state and review contracts apply here rather than being reinvented.

Before UI acceptance, capture the authentic current app at a known build, role, fixture, browser, viewport and theme; document KEEP/EXTEND and compare the real After. Exercise keyboard/focus, screen-reader status/error announcements, touch, 320 CSS-pixel reflow, 200% text zoom, long content and loading/empty/denied/stale/partial states. Current status is **SOURCE-INSPECTED / VISUAL-BASELINE BLOCKED**; no new mockup is approved by this amendment.


**Design task allocation:** extend D-14/T-451 for skills; existing Zyra Change review/T-306/T-460 for the connected view; Requirements and KB native routes for their content; native case/run/Bug/task views for their exact truths. Preserve current component/route ownership, validated before/after controls, the original case editor and baseline decisions. No additional approved visual is introduced. Source/API changes affecting these views share the same authentic baseline and interaction gate.

## Revision 1.4.29 — explainable graph assistance on existing surfaces

Extend D-14/ASER-UX01–03, existing Zyra change review, native Cases/Runs and Model Studio where their current responsibility fits. This is an interaction contract, not authorization for a parallel Graph AI app, new chat panel or an unrelated visual redesign. Establish the actual current screen, controls and data before designing a change; no fabricated production content or screenshot proves the interface.

| User decision | Information and existing interaction required | Acceptance boundary |
| --- | --- | --- |
| Is this analysis relevant? | User outcome, current project/role/context, input version, included/missing scope and meaningful upstream/downstream/state consequences | A partial or source-only analysis cannot appear complete or authoritative. |
| Why should I trust this suggestion? | Permitted source/revision, accepted expectation versus observation/hypothesis, effective method/model provenance and uncertainty | Confidence, path count or fluent prose cannot stand in for evidence. |
| Do I need a new case? | Existing canonical matches, proposed link/amendment/new candidate, purpose and expected observation | Reuse identity where equivalent; exact protected review shows the consequence of the selected action. |
| Can I execute it? | Setup/data/actions/expected observations, manual or actual supported driver capability and relevant target/build uncertainty | Manual QA remains available without Git/model/automation; dispatch is not shown as execution. |
| What did my correction change? | Original suggestion, reason and scope, candidate revision and its separate review/evaluation/activation state | Editing an interpretation cannot silently change a requirement, effective skill or old attempt. |
| Can I recover or return? | Existing native source/case/run links, return context, unsaved-work preservation and permission-safe recovery | Stale/revoked/unsupported/timeout states retain valid unrelated work and do not leak inaccessible source details. |

Prefer progressive detail: the tester sees the decision, supporting reason and next action; evidence/revision diagnostics are available when needed to assess trust. A generic user need not understand parser internals to author a case. Keep source facts, proposals and accepted records distinguishable without relying on color alone. Verify focus, keyboard navigation, screen-reader labeling, reflow and error/recovery against the actual interface. Comprehension and perceived usefulness need appropriate user evidence; an expert/synthetic walkthrough is labeled accordingly.


## Revision 1.4.31 — graph contracts and assurance findings

Extend existing graph/list and review surfaces with policy obligation and manual section links, exact revision, relationship rationale and conflict or unavailable state. Preserve project and permission scope. Show evidence stage, denominator and truncation for coverage. Investigation views distinguish hypotheses, cohort limitations and confirmed dispositions. Show an effective Skill readback and a scoped degradation/recovery state with permitted actions for operators. Validate screen placement and accessible equivalents against actual source and runtime before sign-off.


## Revision 1.4.32 — Graph Analytics

### Existing source and proposed design

Baseline inspected at Tesbo commit 6897f989: `Tesbo-Frontend/app/(app)/projects/[id]/reports/page.tsx` and `Tesbo-Frontend/components/reports/ReportsNav.tsx`.

| Before, from source | Proposed | Why |
| --- | --- | --- |
| Reports already contains Traceability and AI Insights | Add Graph Analytics within Reports as a deep-linkable view. Cross-link to the existing reports where they answer the next question. | Keep a single reporting entry point and preserve the existing division of work. |
| AI Insights advertises risk, flaky tests and gaps | Start Graph Analytics with Change impact and Coverage gaps. Reuse existing stability and risk metrics when later adding graph-driven investigations. | The additional value is explaining consequences and supplying evidence for a decision. |
| Reports has shared navigation, loading and header controls | Reuse shell and tokens. Put scope filters over an actionable list and reveal evidence details on selection. | Familiar interaction and a clear path from finding to action. |

Header: project breadcrumb, Graph Analytics title, comparison scope, source freshness. Views: Change impact and Coverage gaps. Filters: affected component or workflow, evidence stage and relevance to the selected change. List: what changed or is missing, why it matters, status and one primary action. On narrow layouts use the same content in one column. Details show source revisions, applicable obligations, downstream consequences, confidence limits and links to records. A graph is optional detail with an equivalent ordered relationship and evidence list.

Keep filters, focus and row selection stable on return. Announce loading, failed refresh and changed counts without moving focus. Distinguish empty results, incomplete indexing, unavailable sources and insufficient evidence. Use text alongside color. Avoid movement on filtering, sorting and keyboard navigation. An occasional evidence panel may use the existing transition to communicate its origin, with immediate reduced-motion behavior. Status or evidence never depends on hover or animation.

Design basis: Purple design assurance task, scope and truth checks, plus Emil Kowalski's design engineering and motion-restraint guidance. Source inspected only. Rendered Before/After, responsive accessibility checks and final component parity remain pending.


## Revision 1.4.33 — Graph Analytics assurance amendments

Proposed route: existing project Reports with URL view=graph-analytics and explicit impact/coverage subview plus permission-safe scope handles. Reload and Back/Forward restore scope. Invalid or unavailable scope shows a scoped recovery action without silently selecting latest. Fence late project and filter results. Use adaptive Reports navigation with programmatic active state and a labeled inline evidence region. Move focus to the detail heading on explicit open and return it to the initiating row or list heading if removed. Preserve reading order at narrow width and zoom. Announce refresh, error and result counts without disruptive motion.

Present evidence stage, index completeness, selected revisions/as-of and AI availability independently. Label the legacy suite metric as suite execution coverage wherever it appears in this view or omit it here. Graph Analytics obligation counts retain their own scope and denominator. First release omits Graph Analytics export at both shared entry points and sends no export request for these views. Preserve all six existing report exports. Rendered Before/After and assistive technology verification stay pending.

## Revision 1.4.34 — source convergence and method-adoption reconciliation

### Source-grounded interaction migration

Before changing the existing Model Studio, Requirements, native Run/Bug and feedback surfaces, capture their actual permitted Before state and map current controls to the canonical 03 convergence plan. Distinguish latest draft from active approved revision; permit continued work on the active basis; show unavailable matching instead of confirmed absence; retain original result/history when a side finding is linked; and let correction capture succeed independently of optional regeneration. Preserve navigation, selected scope, drafts, focus and role-safe recovery across these changes. Source inspection does not establish visual parity, accessibility or user comprehension; those gates remain NOT VERIFIED until the actual interface is observed.

For Model Studio, bind generated proposals, errors and delayed write notices to their original project/model/revision/request, including switches after proposals have already loaded. Preserve or discard them under that explicit context; never relabel A output beneath selected model B. The mapping picker distinguishes unavailable lookup with recovery from a successful empty list. Reuse proven native request-fencing patterns where applicable and verify the actual delayed-response, cancellation, focus and selection behavior under MBT-AC-39/ASE-INT-13/14. Source guards on persistence do not prove truthful display.

### Method/profile clarity on existing authoring and history surfaces

Within the existing case editor, execution review, method detail and assignment views, distinguish a definition candidate from an actual attempt and from an exported presentation. Show the selected supported method/profile, material applicability limits and unresolved composition without implying approval or execution. Preserve native IDs and past results during reorganization. Keep accepted release-window expectations and the tested actor/fixture scope visible where they affect interpretation. No invented role hierarchy, API tab or mandatory graph/driver setup is required for a target that does not need one.

**Revision 1.4.39 — content integration:** Use the existing detail/review surfaces to identify the applicable shared/module guide and output profile with exact version, separately from the governing requirement/policy. Offer concise field-level authoring feedback grounded in canonical 06; keep full guidance, provenance and evaluation history available in their existing authorized detail views. Preserve plain case text, native field mapping, IDs, current execution results and unsaved work during correction. Method-level feedback records the affected version/context and actual reviewer evidence; no displayed grade is an approval or proof that an individual principle caused improvement. Skill assignments remain a separate human-governed action. These are refinements to D-14/T-422 and native module views, not new top-level navigation or a complete UI redesign.

Verify these refinements against authentic current surfaces at an exact build, role, fixture and viewport, including keyboard/accessibility and interrupted recovery. Source review and workbook sketches do not close the existing visual/runtime gate. Use the current D-14/T-422 and native Case/Run owners; no new top-level navigation is proposed.


## Revision 1.4.35 — Graph Analytics review closure contracts

Show evidence stage and outcome independently. On verified FAIL, route to native QA triage; on verified PASS, show posting evidence and preserve impact workflow. Give unknown criticality an explicit label and filter. Display each authorized native impact's status and make action target selection explicit. Show only permission-safe freshness and recovery detail, with a scope explanation for model-only coverage. Rendered and accessibility proof remain pending.


## Revision 1.4.36 — concurrent-source reconciliation and independent assurance

This amendment preserves the complete incoming published 1.4.35 canonical bodies, including portability and Graph Analytics closure contracts, and reconciles the separately reviewed GEX corrections through v11. Earlier receipts bind their exact inputs; final integration requires its own target-bound receipt. The same eight files remain canonical; repository views remain subordinate. The newest explicit qualifications below govern overlapping older shorthand. Source inspection remains pinned to `1alextest/Tesbooboo@6897f989b055a955280f810c7daace86f74057fa`; other open PRs and this proposal do not establish current deployment. Exact current-target review receipts, actual method versions and remaining gates belong to GEX-ASER-2026-11-19. The package remains NOT FROZEN.

### Source-grounded interaction migration

Before changing the existing Model Studio, Requirements, native Run/Bug and feedback surfaces, capture their actual permitted Before state and map current controls to the canonical 03 convergence plan. Distinguish latest draft from active approved revision; permit continued work on the active basis; show unavailable matching instead of confirmed absence; retain original result/history when a side finding is linked; and let correction capture succeed independently of optional regeneration. Preserve navigation, selected scope, drafts, focus and role-safe recovery across these changes. Source inspection does not establish visual parity, accessibility or user comprehension; those gates remain NOT VERIFIED until the actual interface is observed.

For Model Studio, bind generated proposals, errors and delayed write notices to their original project/model/revision/request, including switches after proposals have already loaded. Preserve or discard them under that explicit context; never relabel A output beneath selected model B. The mapping picker distinguishes unavailable lookup with recovery from a successful empty list. Reuse proven native request-fencing patterns where applicable and verify the actual delayed-response, cancellation, focus and selection behavior under MBT-AC-39/ASE-INT-13/14. Source guards on persistence do not prove truthful display.

The Reports Graph Analytics projection and Model Studio source-convergence corrections apply to their respective existing surfaces. Neither is an approved rendered mockup. Preserve both export-entry exclusions for new Graph Analytics views and the six existing native export types; original navigation, authentic UI and accessibility proof remain required.


**Final authority and evidence reconciliation:** Revision 1.4.35 retains both the published portability assessment and this separate GEX-ASER run without pooling their members, trials or verdicts. The 1.4.34 chapter's characterization of GEX-SEM/GEX-DISC as noncanonical proposals describes that predecessor. In this reconciliation their substantive assertions are allocated to existing canonical proof owners by the explicit tables above/in canonical05; their labels remain supplementary aliases, not new canonical definitions or executed tests. Eight GEX-AC obligations, five current GA-AC checks and 125 ASER definitions retain separate accounting. The current/historical/Skill-assignment and prepared-Run qualifications in this reconciliation control older conflicting shorthand. Imported method conventions are scoped through the existing resolver and native lifecycle. No original method body is installed or activated, and the earlier two-brief experiment does not qualify the changed discovery method or imported-method profile.


**Current36 integration boundary:** The published35 Graph Analytics closure contracts are preserved and govern mixed model/policy/requirement obligation scope, distinct evidence sufficiency and observed PASS/FAIL, per-impact actions, total ranking, authorized-visible snapshot identity and current-authority rollover. Their new fixtures extend the same five GA-AC checks and remain NOT RUN. The DMIS approval-to-posting workflow is the named pilot context, not a universal actor/schema/method or a claimed live test. The incoming short source-checkout claim belongs to its separate review; this run's inspected source remains6897 and its delivery parent is1fe. Earlier current-state statements are historical when this latest explicit qualification differs. This chapter preserves the independently reviewed CURRENT/HISTORICAL, separate Skill assignment, prepared-Run and source-status qualifications above. No empirical benefit, deployment, activation or implementation acceptance is inherited.


## Revision 1.4.37 — Graph Analytics review resolution

Show mixed alongside the evidence stage, link the native discrepancy and preserve both authorized attempts. Label unknown frontier, scoped no-impact, recorded historical and recomputed historical distinctly. Show conflicts outside known denominator. Keep existing Reports shell and both export controls in rendered evidence. Preserve same-scope return and focus during async recovery, refresh and scope loss. Visual and accessibility proof remains pending.

## Revision 1.4.38 — extend existing Model Studio and review states

Under the existing Model Studio and native review UI tasks, show viewed/edited, approved and active revisions independently. Keep an active r1 usable and visibly current while r2 is drafted or approved; show a deliberate permitted activation and truthful conflict/readback recovery. Preserve historical selections and native run links. Correction saved, generation pending/unavailable and matching unknown must be separately understandable in the existing task/review surfaces, without a new navigation module or technical diagnostic burden. Source entitlement failures disclose only the user's permitted context and recovery action.

The canonical 02 workflow and 03 §18.2.1 source map define the behavior. Reuse existing components and preserve controls, keyboard/focus, dirty edits, history and return context. Current rendered-state parity and after-change interaction evidence remain NOT OBSERVED until authentic runtime review; document consistency is not visual acceptance.


**Semantic/consequence extension within existing tasks:** Apply canonical 02's meaningful source→effect→uncertainty→owner presentation to existing change/review views, including policy/manual-only changes, a valid no-effect result, inaccessible/contested source, truncated analysis and a retained failed attempt with a separate causal hypothesis. Native drill-down preserves permission and return context. These are proposed states to verify on authentic before/after UI, not a claim that a generated graph view or static mock passed.

**Existing Run setup recovery task:** Replace checkbox-only assurance for an unknown creation outcome with the native logical-operation readback/resume contract. Preserve known-ID attachment retry, original operation history, accessible status/recovery and explicit new-intent semantics. Authentic runtime/fault-injection evidence remains required.

**Concurrent-tab recovery:** Preserve and expose each relevant unresolved request across tabs/reload, or clearly refuse a competing action before submission. A successful older response must not clear a different request or rewrite the newly selected model/project state. Verify the real browser interleaving and native readback under MBT-AC-14/37.


### Concrete source findings assigned to existing UI tasks

The original Purple source review is advisory under its Draft charter; its truthful-mockup subset is binding under the separately recorded founder authority; the full charter remains unratified. These source cases make existing Tesbo tasks concrete without creating a second interface or inventing operational Purple approval. Pin the actual adopting build before implementation and acceptance.

| Existing task / surface | Inspected mechanism | Required behavior and proof |
| --- | --- | --- |
| T-308 / MBT-C-09 / ASER-UX03, case panel and Model Studio deep links | The case-detail redirect drops `tcId`. A Run link displays model revision but sends only model ID; the receiver selects head or falls back to another model. | Reuse the native case panel and exact model/revision route. Preserve validated return context and current/historical mode; resolve exact authorized identity or explicit unavailable state. Check equal titles, older/archived revision, denied target, reload/back/new tab. |
| MBT-AC-39 / Model Studio proposals | Proposal/digest state is not scoped to model/revision, a model switch leaves it intact, and a delayed generation callback can replace visible results. | Scope results, selections and notices to project/model/revision/generation, fence stale callbacks, and clear on switch or retain in an explicitly historical non-current action context. Check switch before/after response and revision advance. Native digest validation remains separately required. |
| T-308 / existing editor dirty-state contract | Model authoring uses local component state; Escape/backdrop calls close and the parent unmounts nonbusy editing without a dirty decision. | Offer Save draft / Keep editing / Discard or retain a clearly scoped recoverable draft. Verify dismissal after a stale-save conflict, reopen/back and principal/project isolation. Deliberate discard is valid. |
| D-09 / T-308, shared Modal/Field and affected consumers | Shared Modal uses presentation roles and lacks the required dialog naming/focus lifecycle; inspected authoring labels lack control association. Focus-visible CSS and alert markup already exist. | Extend the existing primitives or appropriate native dialog; verify accessible names/errors, focus admission/containment/return and background control with actual keyboard and declared assistive technology, narrow reflow and zoom. Include applicable Drawer consumers in the shared-control sweep; no complete caller inventory is claimed. |
| ASER-UX03 / native case linker | `LinkCaseModal` catches failed discovery by clearing cases and loading without retaining the error. | Keep successful-empty, unavailable, denied and stale outcomes distinct, permit safe retry, preserve valid selection where safe and avoid absence claims from a failed lookup. Other list/error combinations require their own inspected oracle. |
| Existing Model Studio graph preview / MBT-C-09 | An approved revision reuses a component whose labels always say Draft/unapproved. | Pass actual authority/display context or use neutral structural wording beside genuine approval status. Check ephemeral/saved draft, approved current and approved historical; preserve text alternatives and the distinction between approval and execution. |

All six require authentic current/after evidence. Source inspection establishes neither a rendered accessibility failure measurement nor a repaired user journey. Original advisory severities and their limits remain in the review receipt; this table allocates work rather than granting release approval.

### Current continuation checkpoint — revision 1.4.38

The current canonical parent is the saved eight-file v1.4.37 archive, version 17, SHA-256 `1ed8afd0a978ab9b257c10d61549f6085c7f1f593713a26b0ae56a4540562848`. Preserve all v1.4.35–37 Graph Analytics amendments, including the separate applicability/evidence/outcome/impact axes, bounded frontier witness, mixed governing obligations, permission-safe visible snapshots, native operation receipts and source-index convergence. The pilot is a synthetic DMIS approval-to-posting fixture; it establishes neither a universal application schema nor live DMIS testing.

PR168 and PR167 were merged externally as `f43013473b3a8b725bb547187e21b4459d0e8838` and `1fe100588be6c3a1627ee39a4b0bbc1c0d9da2ea`. This continuation performed neither merge. Its repository-view parent is open draft PR169 at `bddd97971637a54c6e2aff9e7686cfb9c9f25d8e`, based on that merged development commit. The later PR169 head `c07d4c2a16912ca71fbc319aec9a23e68a452edd` adds only a separate executable-preflight review record; all six view bytes remain bddd-identical. Preserve that record and its distinct candidate/executor limits; it is not another role receipt or a verdict on this continuation’s independently pinned reviews. Statements in preserved incoming review chapters about their own source6897 inspection retain that historical scope. This continuation independently inspected source419 and compared full trees through e3d0, b07 and merged1fe: no backend changes across those intervals; b07→1fe changes only ten documentation blobs and no frontend blobs. Thus the qualified source findings in §18.2.1 of canonical03 remain applicable at that merge checkpoint. This is source continuity, not deployment, runtime or acceptance certification. The separately observed b07 CI results retain their exact executed-test scope.

Retain 125 unique scoped ASER definitions, eight supplemental GEX-AC obligations and five unique GA-AC IDs. The five GA IDs carry fifteen cumulative table rows from revisions33/35/37; later fixtures extend the same checks, without adding ten test identities or erasing earlier assertions. Repeated GEX-SEM-01..08 allocations are cumulative fixture/proof-owner contributions to the same eight aliases. Apply the union of their stated assertions and existing owner allocations; they are not competing definitions or alternative authorities. SK-E2E-41..44 and GEX-DISC-01..05 likewise remain mapped aliases. All new product acceptance outcomes remain NOT RUN. Original cold receipts remain unchanged; later target-specific reconciliation is explicitly informed. The package is PROPOSED / NOT FROZEN.

## Revision 1.4.40 — contextual Skills Library refinements for D-14 / T-451

*Expanded through revision 1.4.42 with approved task, decision, and inspection principles.*

This design applies ASER-UX02 and ASER-UX03 to the project Settings Skills surface following review of the two-view prototype on 22 November 2026.

- **Preserve each job.** The Library browses the authorized project inventory across modules and subtypes. Candidate submission and exact-version review are reachable from it. Assignments owns current assignments, Work Package A readiness, and assignment history. Current assignments and readiness share the required-operation rows. Keep submission, approval and exact version assignment legible as distinct states.
- **Group and orient.** Place search by name, key or instructions, Module, Subtype and Assignment in one desktop row where space permits. Reflow deliberately for narrow widths, zoom and long labels. Keep review-state filtering discoverable and neutral by default. Place one quiet result count with the table controls and reflect the current query. Preserve search and filters across a history visit.
- **Use existing destinations.** Remove the generic readiness link from the Library and the duplicate review link and no-approved-versions banner from Assignments. Expose the real prerequisite with the unavailable action or an applicable readiness state. Test discovery through the existing tabs and preserve scoped shortcuts where they convey a distinct relationship.
- **Expose per-skill history.** The skill title opens the newest saved version with its status. The version count in History opens the authorized list of saved versions with submission dates, approval status, and any active usage indicators. Offer newest-first and oldest-first ordering by submission date with a consistent tie-breaker. Each row’s **View** opens the exact saved content. Keep viewing read-only and restore the previous sort, row, and keyboard focus when possible. Assignment history records the binding generations, including superseded and revoked assignments.
- **Match priority to scope.** Give the Library’s project-wide inventory priority in the Library. Place Work Package A readiness with the assignments and operation contexts it describes.
- **Reveal focused work on demand.** Open candidate and assignment forms from their respective views. Keep the list in view behind the skill drawer where space allows, provide **Close** and keyboard dismissal, and return to the originating list position and control when the row remains visible.
- **Show decision evidence with the exact file.** Identify the saved version, its content, submission date and status, and the approval date where present. Show **Approve vN** only for the version eligible for review. Show **Assign vN** for an eligible approved version and carry that version into assignment. Approval changes eligibility for assignment while existing bindings retain their version pins. If an exact version is unavailable, show the state and provide a return path to history.
- **Apply one version to several eligible actions.** Within the chosen module, allow several explicit choices under **Applies when**. Request any narrower required context per action. Before saving, show the exact version and the consequence for each target, including additions, replacements and selections already satisfied. Require all chosen scopes to be complete and valid before saving the batch. The mock-up saves the selected changes together. Native assurance must verify transaction behavior, authorization, the current binding for each target, and safe handling when the reviewed effect changes before save.
- **Verify meaningful data.** Use a multi-module inventory and a skill with an approved older version, a newer submission, and a binding to the older version. Confirm exact historical reopening and comparison, distinct maturity states, discoverability of all five original capabilities, and safe empty, loading, denied and stale states. Readiness continues to derive from the three required Work Package A operation contexts. See canonical 06 for the independent review prompts.

The HTML prototype demonstrates multi-action assignment, dated sortable version history, exact file previews, and separate approval and assignment using sample data. Verify native transaction behavior, stored file identity, access controls and keyboard return against the exact native build.

## Revision 1.4.43 — paired Current and Redesign for D-14 / T-451

Use the paired Skills mock-up and capability map to review the proposed redesign. The Current reconstruction uses the operator's live Skills screen and supplied captures observed on 22 November 2026. Native review source and test definitions were inspected at PR #207's development merge `4b37def37b846017dc50087783fd1ef30becb018`. That source pin identifies the reviewed code, while the live capture establishes the pictured state. The paired mock-up uses representative sample records and independent state in each view. Reviewed artifact: Library version 16, SHA-256 `8eab76573de19779ebd456a5eeeb6e3c62e7fc158cfe8e7c1acab6df19581cfa`. [Tesbo-Skills.html](https://chatgpt.com/library?file_id=libfile_fde3_f-11316f226b3c8191bf73aad07435ac3b_4ee04b678f8481919580c594fcc15a5b&account_id=personal)

| Current capability | Redesign disposition and check |
| --- | --- |
| Work Package A readiness and Refresh | Move to Assignments alongside the exact action and scope. The unassigned state and Refresh control were visible live. Chrome demonstrated the sample 3/3, conflict and unavailable paths. Compare full native resolver and refresh behavior separately. |
| Skills library and candidate submission | Preserve authorized inventory, key, scope, submitted and approved states, date and author, exact history, and native candidate inputs including module and subtype. Fields and history were visible live. Browser and scripted mock checks covered the restored inputs and demo QA submission. Compare valid input and an applicable native refusal. |
| Exact review, timeline and comparison | Preserve author, saved date, rationale, digest, full stored text, structured JSON, inert HTML and source details at the exact version. Live observation established the fields and controls. Mock checks opened exact evidence, compared an active context, and detected scope-only changes. Include prior, latest approved, arbitrary-pair and large or stored-field-only snapshots in native verification. |
| Approval lineage and existing assignments | The live screen showed v1 submitted and approved separately as v2. Native source and test definitions specify unchanged effective pins. Chrome demonstrated sample v3 creating v4 while both v2 pins remained active. |
| Exact assignment, revocation and history | The live screen showed the exact-context form and empty history. The native source supplies the approved-version pointer and active/revoked generations. Preserve these outcomes in Assignments and label scope in both row and form. **Open parity item:** the mock-up blocks writes on a conflicting Assignments row but offers no direct route from that row to review and revoke the exact conflicting generation. The Library drawer resolves revocation by target. Verify exact-generation selection, protected neighboring bindings and effective readback before closing the item. |
| Role-specific, failed and uncertain states | The native source and test definitions specify owner/manager and QA behavior, stale review, exact-read retry and uncertain approval reconciliation. Mock checks covered role cues and sample readiness failure states. Verify server authorization, persistent readback, retries and publication enforcement in the native environment. |

Older-approved selection, applying a version across multiple targets, and returning a version for revision with in-screen successor submission remain proposals. Match any added scope choices to a verified native catalog before representing them as supported. Apply canonical 06's review questions and retain an explicit disposition for unknown or deferred states. This amendment records a design and review contract, with native acceptance pending.

### Revision 1.4.44 — fields, representations and native action contracts

Extend the D-14/T-451 map below the screen-section level. Source names in this table refer to the reviewed native Skills implementation at the source pin above. They identify what must be preserved or explicitly changed. Tests listed here are verification obligations. This documentation revision supplies no new native execution results.

| Material data or contract | Evidence and required observable outcome |
| --- | --- |
| Stored title, text, JSON and HTML | The native review reads `title`, `contentText`, `contentJson` and `contentHtml`. Retain each stored representation and its meaning. An authorized reviewer can inspect a JSON-only or HTML-only change while plain text stays equal. HTML is displayed safely as inert source. A missing text or HTML representation has its documented missing state. Full inspection remains available when a diff is bounded. |
| Saved source attributes | Preserve `projectId`, `folderId`, `documentType`, `sourceProvider`, `sourceExternalId`, `sourceUrl`, `sourceRole` and `isReadOnly` from the saved snapshot where available. A source-only change remains reviewable for the exact version. Missing values follow the native contract. A generated default cannot masquerade as recorded provenance. |
| Decision metadata and identity | Review binds the project, skill document and exact version ID, with version number/kind, author, creation date, content digest and recorded reason. Display the relevant evidence with its source. Equal text or digest can belong to distinct identities. A reviewed submission stays distinct from its separately created approved snapshot linked by `sourceVersionId`. A prior active assignment keeps its approved version pin. |
| Candidate fields and validation | Preserve Title, optional Skill key, Module, Subtype and Instructions. Title and instructions must contain non-whitespace text. At the inspected UI, maximum lengths are 512, 64, 32 and 20,000 respectively for title, key, subtype and instructions. Creation trims text, omits a blank optional key and maps blank subtype to `*`. All seven native module choices remain accounted for. Verify valid boundaries and the actual service rules before changing form constraints. Catalog target selection is a proposed additional control. |
| Create and submit handoff | The inspected UI first creates the candidate, then submits using the returned document ID and `editRevision`. Verify the submission uses that exact created revision. Inject a failure between the two requests and inspect native state before retry. Establish from the owning contracts whether a draft remains and how it is recovered. The redesign must represent partial completion accurately and prevent a retry from creating an unintended duplicate or submitting another revision. |
| Approval contract | The native action sends the reviewed project, skill and exact submitted version ID. A successful approval creates the approved snapshot and leaves active bindings pinned. A superseded submission produces the native refusal and current-version recovery. The response, protected snapshots and binding state are checked independently. A lost response stays unconfirmed until native reconciliation establishes the outcome. |
| Assignment and revocation contract | The native assignment request carries `skillDocumentId`, current `approvedVersionId` as `versionId`, and exact `module`, `subtype`, `operation`. Blank subtype and operation map to `*` in this native form. Revocation targets the exact assignment generation ID. UI labels, chosen scope and the request refer to the same identity. Native readback verifies the affected and neighboring bindings, effective result and history. |
| Roles, derived state and consumption | Owner/manager governs approval, assignment and revocation. QA can read and submit candidates. Trace authorized reads of every stored representation through those roles. Readiness is derived from effective resolution of the three Work Package A contexts and must distinguish unassigned, unavailable and conflict. Native resolver, persistence, authorization and downstream consumption require their own evidence. |

Apply the domain-neutral rule in Improve User Experience v0.39 §2C to other modules using their own fields, representations and contract owners. Show decision-relevant information in the primary view and preserve an authorized path to exact evidence when needed. Record a field's retirement, transformation or restricted access in the existing map, with the governing decision and its verification.

### Revision 1.4.45 — scope of the example and discovery of new obligations

The Skills table above records facts and obligations discovered for this workflow. Use Improve User Experience v0.40 §2D to build the inventory for another Tesbo surface or target application. Begin with its users' intended outcomes, approved rules and material operating conditions, inspect its actual journeys and implementation where available, then follow inputs to effects and effects back to their dependencies. Include newly discovered concepts that alter the task outcome even when the Skills example has no corresponding field or control. Expose contradictions, missing evidence and unresolved decisions in the existing review record.

Validate the inventory with similar-looking cases whose correct outcomes differ under the target's rules, plus a changed condition that legitimately preserves the result. A narrow cosmetic change can use a correspondingly narrow dependency investigation with evidence for its unaffected paths. A new feature without a current implementation uses its approved needs as baseline. Report which sources and conditions were examined before making a completeness claim. The method and these conceptual transfer checks retain their pending native and human-outcome validation status.

## Revision 1.4.46 — Evaluation evidence in the existing Skills and review surfaces

**PROPOSED / NOT FROZEN — 26 November 2026.** Extend D-14/T-451, D-03–05, D-15, ASER-UX01–03 and existing Insights/Run/evidence views. This amendment adds interaction requirements, not an implemented evaluation dashboard, approved mock-up, active Skill change or runtime acceptance result. Canonical 04 owns the evidence and disclosure contract; canonical 03 and 05 own implementation and proof. Preserve the full prior exact-version/representation and current-versus-redesign requirements.

### Source-grounded placement and preservation

At inspected development `b28c17386ecc2e88f550b3c4a641143ede339255`, `app/(app)/projects/[id]/settings/skills/page.tsx` already supplies Library/Assignments, exact saved version inspection, historical/approved/active-context comparison, independent approval and assignment actions, and request fencing. `components/skills/SkillAssignmentForm.tsx` owns exact target selection, receipt verification and uncertain assignment recovery. Task detail already shows pinned Skill references and native proposal/readback states. Reuse these surfaces and their shared components. Their presence does not demonstrate behavioral evaluation, telemetry completeness, deployed client conformance or the new interactions below.

| Existing place | Proposed extension and user decision | Retained boundary |
| --- | --- | --- |
| Exact Skill version review | Add a compact evaluation-evidence section answering what was tested, against which version, what changed and what remains uncertain. Open the underlying authorized Task/trial and exact artifacts on demand. | Text/content comparison remains available and is labeled as content comparison. Equal text/digest or a clean diff cannot be labeled equivalent behavior or measured improvement. |
| Skill history and assignment context | Show applicable historical evidence with its tested client/model/task scope, current relevance and source date. The reviewer can retain, revise or defer the candidate through existing native decisions. | Viewed, submitted, approved and assigned remain separate. A better trial grade cannot assign, activate, retire or rewrite a version. |
| Existing Task/review detail | Present the bounded evaluation question, subject, baseline/candidate, independent expectations, progress/limitations, next responsible action and links back to the assessed version. | Evaluation completion is not native case approval, Run PASS, release readiness or delivery. Cancellation preserves known effects and uncertain outcomes. |
| Existing Runs/evidence and Insights | Link actual attempts/readbacks and show authorized per-version reliability/resource summaries where the evidence supports them. | Preserve actual executor, case/build/attempt and evidence identity. A source replay, prepared Run or final passing retry never supplies an unobserved earlier assertion. No second report or evidence repository. |
| Existing Tasks/Issues and candidate feedback | Offer a supported, permissioned way to record friction and inspect existing matching reports with exact context and safe evidence. | A report is a candidate finding. Creating it cannot file an official Bug, change an active method or notify an external recipient without its own authorized action. |

Only expose creation, execution, refresh or cancellation controls when the deployment advertises the supported capability and the actor has the corresponding native grant. Otherwise show the available evidence and a clear permitted next step. An evaluation is not silently launched by opening a Skill, comparing content or approving a version. Native manual review remains available under its actual policy.

### A reviewable comparison, without false certainty

The primary view shows the evaluation question and decision-relevant result, named comparison versions, task/domain scope, actual client/model configuration where known, dates and evidence limitations. Keep digests, correlation and parser diagnostics in expandable details. Frozen expectation/rubric and grader history are available only to authorized reviewers; the subject must not gain hidden grading labels through the same view, notifications, exports or summaries.

Use a compact table with one row per meaningful task/client cohort. Keep outcome correctness, observable process conformance, attempted prohibited actions/actual effects and resource use separately readable. Display the original observation, the grader's interpretation and disagreement distinctly. An allowed alternative action sequence must remain legible as conforming when it satisfies the rubric. Correct escalation of an unresolved decision is an outcome; lack of grading evidence is a different limitation. No chain-of-thought display is required or inferred.

Show assigned, attempted, graded and ungraded counts together, including critical misses, false approvals and false blocks. Present correct/graded, graded/assigned and correct/assigned with their actual fractions. A zero denominator displays no applicable measurement, never 100%. Missing or excluded work must not disappear when a filter changes the apparent score. Keep trial count, repeatability/variation, affected cohorts and unavailable comparisons visible near any claim of improvement. A small inconclusive pilot can legitimately result in keeping the current method.

Label controls precisely: active versus candidate; repeated unchanged control; optional removal/shorter variant. A without-Skill trial may remove only a separately authorized optional component in the isolated scope. Do not offer “disable governance to compare” or imply a production assignment changed. An incompatible client, unknown configuration or unsupported baseline displays the limitation and prevents an unqualified cross-client ranking.

Routine usage summaries show the actual observed collection period and coverage, not assumed total agent activity. Distinguish Skill availability, delivered content, instrumented generation input, reported use and demonstrated behavior. Missing or truncated telemetry reads as unknown coverage; neither a zero count nor a green task establishes non-use or full compliance. Any cost figure identifies observed versus estimated versus unavailable, units/currency and meaningful coverage. Missing usage or a stored zero placeholder must not render as free execution or a proven saving. Comparisons retain failed/ungraded work and avoid double-counting nested sessions.

### Recovery, feedback and human decisions

Preserve project/version/cohort, filters, return context, draft feedback and focus on opening evidence or returning to history. Fence late responses after project, candidate, grant or comparison changes. A stale candidate can retain historical trial evidence, but the current decision explains the changed basis and offers explicit reassessment. Failed evaluation lookup is unavailable, not “no regressions”; denied sources do not reveal hidden existence, names or counts. A dropped trace cannot be silently reconstructed from an agent's completion claim.

For friction, show tried, expected, actual, affected version/tool/client and evidence limits; offer an existing-match link or authorized candidate submission. The person can inspect the reason, assigned owner and next action without reading a raw provider trace. Recording a workaround does not make it an approved operating instruction. A confirmed method correction stages a successor in the current Skill workflow, keeps the original report and records its separate evaluation and authorized adoption. Task closure and post-fix verification remain distinguishable.

Before approval or assignment, show what that exact action changes and which bindings remain unchanged. Show permitted evaluation evidence and unresolved limitations as input to the decision; do not add an undocumented mandatory gate or invent a new approval role. Any future policy requiring evaluations must be expressly configured by its existing authorized owner with a supported evidence/recovery contract. Optional canaries, task routers and model-specific compiled forms remain separately reviewed future capabilities, with exact parent-method lineage and no unverified equivalence label.

**UI acceptance:** Allocate these variants to the existing D-14, task/review, evidence, Insights and UX-09 proofs in canonical 05: complete and inconclusive comparison; candidate that improves one cohort but regresses another; smaller graded denominator hiding missing work; expected authorized refusal versus ungradable trial; unchanged final state after a prohibited attempted action; unavailable/truncated/duplicate evidence; measured/estimated/missing cost; expired access during grading; stale version while reviewing; feedback failure/recovery; actual keyboard/focus, screen-reader announcements, 320 CSS-pixel reflow, 200% text zoom and long content. Use authentic current/After renders at the same declared build, role, fixture and scope. No invented live data or generated Before image can close that gate. All newly described product and human-outcome acceptance remains **NOT RUN**.
