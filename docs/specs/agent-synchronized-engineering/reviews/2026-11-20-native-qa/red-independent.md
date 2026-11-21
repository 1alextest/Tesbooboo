# Red independent receipt — native QA loop allocation

## Freeze and evidence boundary

- Reviewer: `/root/red_qa_allocation`, independent of the product specification and candidate allocation authors.
- Phase: initial problem reconstruction and source-derived adversarial checks, frozen before opening `blue-i3-allocation-delta.md`, `native-owner-fit.md`, or any earlier team finding/receipt in the target repository.
- Target: Tesbo native manual QA plus the separately initiated ChatGPT → named external executor → original report → independent analysis → linked retest → exact human-selected native apply loop.
- Source: `/workspace/scratch/8e9074abd0d0/tesbo-qa-baseline`, HEAD `1fe100588be6c3a1627ee39a4b0bbc1c0d9da2ea`; `git status --short` was empty at first inspection.
- Product authority: the eight original current v1.4.34 files in `delivery-input/canonical`. They say NOT FROZEN. Historical audit descriptions embedded in those files are not treated as current implementation proof. Current source below supplies that proof at source-inspection tier only.
- Method: unchanged canonical Red charter v2.6, teams README and orchestration under the supplied Nesberry recovery directory. Nesberry environment and domain examples are not Tesbo policy. No method changes were made.
- Execution: file reads, `rg` searches, git identity/status reads and hash generation only. No product edits, database access, live calls, target execution, installation, deployment, visual capture or approval creation.
- This is an individual independent receipt, not the formal two-member Red quorum. Root is obtaining current-source author grounding. Any reconciled delta is a separate file; this receipt is not to be rewritten after candidate exposure.

## 1. Reconstructed problem and independently derived axes

The user needs to distinguish a statement of intended behavior, a request for someone to investigate, an observation of what happened, an interpretation of that observation, and an accepted change to the QA repository. The same UI may show all five, but their authors, mutable periods and consequences differ.

| Axis | Independent values / scope | Consequence if collapsed |
|---|---|---|
| Initiation and oracle | Human source-free QA from accepted policy/requirement/journey; external exploratory task; approved-case regression; existing internal generation | A repository/model/case/key prerequisite blocks a valid starting point, or observed code becomes its own oracle. |
| Definition versus occurrence | Native case definition/version; task prompt revision; assignment/attempt; report; analysis; selected publishing operation | A retest overwrites an earlier attempt; report receipt becomes a case/result write; shared status falsely says all work is done. |
| Principal versus tool branding | Human session; machine credential; issuer; registered runtime installation; external driver capability | Two OpenCode installations become one actor, or a user-issued token becomes the user’s human approval. |
| Authority versus observation | Dispatch permission; current fenced lease; original reported observation; independent acceptance; published native effect | Registration is mistaken for action, a stale executor writes, or analyst agreement becomes human assent. |
| Custody versus trust | Original bytes/narrative/manifest; authenticated submitter; asserted runtime source; uncertainty; retention | Human fallback fabricates a machine run, an analyst rewrites the original, or evidence disappears with a convenient parent. |
| Applicability versus performance | Requested conditions; exact approved case revision; actually observed environment/build/scope; unsupported capability | A selected case or completed action becomes a pass, or a single context implies universal conformance. |
| Acceptance grain | Proposal revision; stable logical operation; dependency-closed selection; exact native base; result correction versus definition approval | Array movement republishes an operation; unselected items leak into publication; source drift preserves stale approval. |
| Projection versus owner | Task board; Run; review pane; activity; report/analytics; source graph | A useful common view invents a new authoritative store or launders missing evidence into success. |

Brand deletion result: removing “QA task,” “Agent,” “Copilot,” and vendor names leaves independent prompt reliance, delegated occurrence authority, immutable report custody and human-selected native mutation. Those semantics need owners. It does not follow that they need a new top-level product, review engine or runner.

## 2. Current source / owner conclusions

1. **Native case authoring is already a separate owner.** `LegacyService.createTestCaseForUser`, `createTestCase`, `insertTestCaseWithClient`, `updateTestCaseWithClient`, native publication policy, V63/V151/V155 history/review migrations and the repository’s existing case surfaces must remain the definition/history path. The inspected creation path does not require a repository, formal behavior model, external driver or model-provider call. Ordinary human Draft authoring is not the same event as publishing an assistant proposal into native storage, nor is either equivalent to approving the case for execution.

2. **Shared proposal staging exists at this head, but is narrower than the complete accepted contract.** V157 extends `ai_generation_requests` with proposal revision/provenance/idempotency and a coherent review snapshot. `stageTestcaseChanges` (legacy service around 15566–15646) accepts native create/update/archive proposals; `zyraSaveAttempt` (20888 onward) validates the rendered proposal, native bases and dependencies, applies through with-client case writers and records a receipt. `zyraSave` requires a human session. This is a real reusable native seam. It still uses selected array indexes and mutates remaining `generated_payload`; it is not proof of full immutable proposal revisions, stable logical operations, independent approval then apply, suite dependency graphs, result/Bug operations or task/report custody.

3. **The current task-generation owner is not a neutral execution dispatcher.** V8/V35/V36 supply provider/model/story/payload/task_status/activity fields. `aiGenerate` (20109 onward) requires an allocated key and immediately starts `processZyraTask`; `zyraFeedback` (20460 onward) looks up by project/id, checks generation statuses and chat origin, then can regenerate from the stored story/context. `zyraCloseTask` (20841 onward) changes the row to done. Tasks UI reads `getZyraAgent`; Create task is disabled when `state.agent.active` is false. `zyraAgent` derives that active flag from AI-key allocation and aggregates saved/generated counts. Extending these surfaces cannot mean inheriting those lifecycle semantics for external execution.

4. **Native execution is case-linked, and the optional reporter is a different producer.** V3 requires a non-null `cycle_items.testcase_id` and one `executions` row per cycle item. `AutomationService` resolves approved cases, creates/attaches native run items, writes execution results and owns execution-linked attachments. This is a valid accepted-case execution path; it cannot represent a case-free original report by inventing a case ID or by silently accepting external claims as official outcomes. A future report can link to native case/run history after the relevant approved operation; the report needs its own custody before that.

5. **The identity roots are reusable but lack installation/attempt meaning.** V58 has `agents`, `actors` and `actor_profiles`; V65/McpService resolve the common `tesbo-mcp` actor. ApiTokenService has a project/user/hash/scope root with read/write scopes and delete-to-revoke. That does not yet identify each runtime installation or provide assignment ceilings, authoritative expiry, fenced attempt ownership and full current capability intersections. Conversely current `AuthMiddleware` already prioritizes explicit bearer over browser cookie, and `normalizeApiTokenScopes` rejects invalid/empty values while omission is read-only. Older canonical audit statements that cookie wins or omitted scopes grant broadly are not current-source findings.

6. **Storage reuse is defensible, immutable receipt reuse is not established.** `StorageService.verify` actually checks object length/availability, unlike its S3 `exists` shortcut; `getBuffer` can retrieve bytes. `getAccessUrl` produces a bearer-style S3 URL after caller checks. New report custody must use these capabilities with a report parent and continuing authorization, not inherit public/share semantics by default. Current SDK evidence is linked to an execution. A mutable KB document, chat message, generation payload or SDK result is not an immutable original report merely because it can hold text.

7. **Retention and consumers extend beyond the visible task board.** V8/V107 retain `requested_by REFERENCES users ON DELETE CASCADE`; V116 protects chat references, which does not fix requester removal. Text search finds direct `ai_generation_requests` consumers in `legacy.service.ts`, RAG ingestion, archive sweep, stream/activity adapters, migrations, frontend API/Requirements and test helpers. Indirect task DTO/API callers also matter. A physical extension must classify each semantic reader/writer and lifecycle/FK trigger, not only count text hits.

## 3. Participation and consequence matrix

| Semantic | Primary owner / role | Valid opposite sibling | Required preservation |
|---|---|---|---|
| Case definition and case review | Native Cases; primary authored truth | Source-free human manual test without automation | Stable native ID, full intended action/expected fields and immutable relied-on versions. |
| External task | Primary scoped request, prior to any official case | Internal generation task producing draft definitions | External task never consumes a model key or changes generation payload through an inherited regeneration route. |
| Assigned executor | Supporting party to one task revision; authority begins at claim | Same runtime installation also has analysis permission on another task | Rights attach to actual principal/current assignment, not vendor name or issuer. |
| Original report | Primary evidence object; task/attempt provenance supports it | Authorized human uploads a historical report with no executor claim | Original and asserted source survive; no fake lease or agent identity. |
| Native run/result | Execution-only occurrence over accepted native definition | Case-free exploratory evidence that later motivates a case | No fake case/run binding; no retrospective claim that a newly authored case was executed. |
| Analysis | Attributed interpretation supporting review | Analyst correctly rejects the executor’s claimed failure or requests more evidence | Original remains unchanged; rejection/no-change is a legitimate useful outcome. |
| Proposal operation | Independently selectable commitment before native effect | Copy-only issue text with no native Bug | Approval scope and terminal disposition do not require every item to become a native record. |
| Tasks/report/review navigation | Projection of the owners above | Existing manual repository workflow without agent session | Same canonical identities, permission filtering and deep links; no forced universal screen. |

## 4. Pre-candidate falsification plan and controls

These checks and their oracles are derived here before examining the candidate. They are planned boundary tests and source-reasoned counterexamples, not executed runtime results.

### R-QA-P01 — kind and lifecycle membrane (allocation discriminator)

**Setup:** one existing internal-generation record, one external exploratory task with zero cases and no allocated Tesbo model key, and one staged testcase proposal linked to that task. Give the human legitimate project review rights and the executor legitimate current task rights. The external task has a revision already relied on by its assigned executor.

**Attack:** address each record through every existing task mutation adapter, including `aiGenerate`, task feedback/retry, edit/delete draft, close, save, chat staging append, archive sweep and recovery/worker paths. Independently enumerate readers such as board status buckets, task resolver, approval rate, notification links, source summaries and RAG.

**Expected:** correct internal-generation operations still generate/retry; correct proposal edits/save still work under their review rules; the external task can receive its new fenced attempt/report through its task owner. No generation operation accepts the external record, changes its relied-on prompt, consumes a key, edits report custody or closes execution authority. A proposal becoming terminal cannot silently terminate an active assignment. The external task is discoverable with truthful status even if no model key or case exists.

**Discriminator:** shared header storage is viable only if the allocation specifies enforceable row-kind eligibility and orthogonal child lifecycle ownership for every reachable consumer; a separately linked task header is viable only if it preserves one native proposal owner and coherent navigation/identity. A common UI label or a new enum alone fails. A consumer inventory that lists files but does not classify their predicates/effects fails this check. This test can reject either physical choice without prescribing one.

### R-QA-P02 — custody survives analysis, retries and owner loss

Reserve report R; upload the required bytes; finalize with body/hash/manifest; perform a second identical finalize and a changed-body replay; request retest R2; change analysis and reject all proposals; deactivate the executor/issuer. R and R2 remain separately retrievable subject to current authorized access and retention policy, original bytes/content do not change, identical replay returns the original receipt, changed replay conflicts, and no official case/result/Bug changes occur. A legitimate supplement appends; a manual historical import retains a human submitter and asserted runtime source. Unknown original provenance remains unknown. Failure before finalized integrity leaves a pending receipt, not an available verified report.

### R-QA-P03 — identity at occurrence grain

Two installations of one runtime, tokens issued by the same human, are assigned different tasks. Swap task IDs or lease generations; remove the issuer or instance owner; turn project MCP access off; mix a bearer header with an authorized human cookie. Only the currently authorized instance/attempt can submit a primary report; no issuer or cookie can turn that machine into a reviewer. Authorized analysts may still read historical evidence with appropriate current report access without an active executor lease. This positive control prevents overbroad lease checks from breaking review.

### R-QA-P04 — selected publication with stable meaning

Stage one case create, one case update, one rejected case and one native defect/copy alternative. Select a dependency-closed approved subset; change an unselected item, move array positions, copy a committed operation into another proposal revision, and edit the selected target’s base. Required effects: stable operation commitments prevent republishing, changed selected meaning/base forces re-review, rejection/copy-only terminal states stay coherent, and an audit failure rolls back native effect. Legitimate human source-free Draft creation and separately authorized native case approval remain available. A disabled machine publisher is not evidence that all protected writers converge.

### R-QA-P05 — impossible-or-false observation

Executor reports “could not start driver”; human supplies a valid manual observation; another task executes an approved case on an unknown build; independent analyst finds evidence insufficient. All are representable without fabricated machine receipts or a pass. A case-free finding may propose a new case without asserting it ran. The retained contract requires neither an automated driver for manual testing nor a successful target run before a truthful blocker report.

### R-QA-P06 — downstream native result/Bug semantics

A SIDE finding during a Passed attempt is proposed as a Bug; a direct failed condition is separately confirmed; a later retest passes. Proposal storage, copy approval and mere Bug association must not rewrite original result. Authorized result correction is a separate evidence-bound append-only event, preserving original attempt and exact tested definition. A legitimate native Bug publication may commit only its explicitly reviewed links/effects through the same transaction-aware native owners.

## 5. Negative design proof before candidate exposure

| Option | Current-source conclusion | Evidence that could change it |
|---|---|---|
| REUSE unchanged | Reject for complete task/receipt loop: existing generation task requires provider key; current executions require cases; current staging handles only selected case operations. Accept unchanged roots for actor identity, native case IDs and reusable storage primitives where compatible. | A reachable current external task/receipt operation with exact scope/lease/custody contract; none identified in the inspected MCP/REST surface. |
| EXTEND | Viable: subtype/common workflow header plus separately scoped revision/assignment/receipt children, native proposal operations and guarded consumers. Not yet chosen. | Finite consumer classification, lifecycle separation, retention migration and exact principal propagation. |
| EXTRACT | Viable for a shared authorization/transaction-aware native owner interface or common task projection where multiple existing consumers need it. Not proof that all domains should migrate together. | Current callers and compatibility plan showing why extraction is smaller/safer than in-place extension. |
| COMPOSE | Viable: a distinct task lifecycle composed with the existing native proposal/case/run owners; no second proposal engine. | Explicit parent/relationship identity and transaction/recovery boundaries preserving a single owner for each fact. |
| PROJECTION-ONLY | Sufficient for board/queue/summary presentation; insufficient for immutable prompt reliance, single active attempt, original report custody and approval commitment. | Evidence that those facts already have authoritative compatible persistence; a display shell cannot supply missing guarantees. |

Compression attempts that survive: no new runner, second case store, second review board, duplicate actor registry, generic knowledge/report owner, per-field history system or a second native Run truth is justified. Separate source report and accepted outcome semantics cannot be compressed away. Physical table reuse and logical ownership are distinct decisions; count of tables is not the oracle.

## 6. Disposition before candidate exposure

The existing native owners are credible foundations. The full loop is not demonstrated by this head, and a physically shared task/proposal row has a concrete eligibility-and-lifecycle burden. The checks above will challenge the candidate without presuming that a new task table is duplicate architecture or that reuse of an existing table is automatically safe.

Source-free manual QA and an authorized no-model-key external loop are both in scope. Native UI components were inspected at source level only. Authentic current runtime captures are NOT CAPTURED and visual-parity/interaction acceptance remains BLOCKED. Product runtime, database concurrency, migration, bytes custody and real client execution remain NOT RUN. This receipt supports architecture allocation review only.

## Exact input hashes

The following manifest was computed at freeze. It binds the authority, methodology and principal inspected source anchors; it is not a claim that every line of every hashed file was reviewed. Targeted passages and source searches above define this receipt’s inspection scope.

Freeze UTC: 2026-11-20T06:28:05.931043+00:00

| File | SHA-256 |
|---|---|
| `delivery-input/canonical/00_README.md` | `dfdc9812777ff4be000dbbe69c6e200f37b20da3d1d0341f96d3270c609e5b29` |
| `delivery-input/canonical/01_PRODUCT_REQUIREMENTS.md` | `b7ba6b1cb7a4e5bd6e042a3265701c88c1282e7e60bb3056914c18cd201f186b` |
| `delivery-input/canonical/02_WORKFLOW_AND_UX_SPEC.md` | `cac79a2587569d9d3a5a9ea080181a2efebf9da6e2b0ebdc99c56ef3666bcaea` |
| `delivery-input/canonical/03_TECHNICAL_DESIGN.md` | `e287764354e802649377ec919f33824aa203208316760d38c0a19f4f013aae78` |
| `delivery-input/canonical/04_MCP_API_CONTRACTS.md` | `f20fa5ae712bfe3416dea4d56909e55570a56f0a40525e78ab92853bb594beab` |
| `delivery-input/canonical/05_IMPLEMENTATION_BACKLOG_AND_TEST_PLAN.md` | `97bd618c52d1e1ccafa9b2d3f3924854ddfef4f8e1cca1688e4d69bcb4994d7f` |
| `delivery-input/canonical/06_IMPLEMENTATION_AGENT_BRIEF.md` | `58f0f5612c0154887b03b509fdc359d4292d438302331a1c5c002955cf5e5c9f` |
| `delivery-input/canonical/07_UI_DESIGN_TASKS.md` | `9672278db49b9da6ce8a981f5d508fbd3e7fd425baadd72b375acd913358f4c5` |
| `methodology/README.md` | `4cdfb5e2f78bf760201bb516b308e89b166a611cc22e331d36a991cf56afd4fb` |
| `methodology/red-team-charter.md` | `4f9893d877d89b31b6e2c0c1d42b89b4136f3da4c8ea079b9fd40024cffb02cd` |
| `methodology/review-orchestration.md` | `8fd41f22e1909afd48d8af95120d03a0f52e30a1bf9976a639fb6cca67bb4729` |
| `tesbo-qa-baseline/AGENTS.md` | `38f5e4b02ba352d90c1f4268434616c85d22053e5e032598d00c8e994726421d` |
| `tesbo-qa-baseline/CLAUDE.md` | `d82f42d90c90a7037b40ec03cc473d05655f820ebc13073a52b2d4696220119f` |
| `tesbo-qa-baseline/package.json` | `72736314bf5ebe869927d4165090311e77259e31d311311b214655ca8dbb89d7` |
| `tesbo-qa-baseline/Tesbo-Backend-Nest/package.json` | `02775ebb1bd47d325f6f2684b01d8da999f8c6f41466556aca30469355368b1b` |
| `tesbo-qa-baseline/Tesbo-Backend-Nest/src/legacy/legacy.service.ts` | `e51f779469455c818bc274cf11be0716445c8a9558e80b0257336881bc8f8104` |
| `tesbo-qa-baseline/Tesbo-Backend-Nest/src/legacy/legacy.controller.ts` | `c5725581c49f0ab2f07ec663f2935acd425aec711d6f0d0050b96bdf47eda455` |
| `tesbo-qa-baseline/Tesbo-Backend-Nest/src/common/human-review-principal.ts` | `ddba247c680a53b4d091908061add30b04c8a2505fe6321bc58d93f20fde50c8` |
| `tesbo-qa-baseline/Tesbo-Backend-Nest/src/common/testcase-publication.policy.ts` | `90f2accd42b37f5c8476833cd362646728c681ac8a91b73c9c6424ce6d8203c0` |
| `tesbo-qa-baseline/Tesbo-Backend-Nest/src/auth/api-token.service.ts` | `28959f0f009383cbb8f6fb24b9ca6d8164063b7bcfd23a32b36331901dfa7de5` |
| `tesbo-qa-baseline/Tesbo-Backend-Nest/src/auth/auth.middleware.ts` | `22f03f9c016a812f2e001b50603e272b6e78fb718b579d8dcb6f12e7a7aafeff` |
| `tesbo-qa-baseline/Tesbo-Backend-Nest/src/mcp/mcp.service.ts` | `6a171831791944ab3ee1f85b1fe1f60a4210e4baa85791633a0fe4d2602b1533` |
| `tesbo-qa-baseline/Tesbo-Backend-Nest/src/mcp/mcp.tools.ts` | `810177d5684fe7498e0068f8ef2ea9d23171add241b4e0d07d0807e3b2aeab85` |
| `tesbo-qa-baseline/Tesbo-Backend-Nest/src/storage/storage.service.ts` | `f9b28def7397dbe16f842db02f241ad280a6ba43f46e21031f388afc6440133a` |
| `tesbo-qa-baseline/Tesbo-Backend-Nest/src/automation/automation.service.ts` | `7f65f3217e132a19daf8aa940b9c3fd315c1810e8ec0c67ca070c1f03f8b0ff0` |
| `tesbo-qa-baseline/Tesbo-Backend-Nest/src/automation/automation.types.ts` | `6f7ae0cbf8303da37b6f95b94a7cd2f27d3bb6388aa9a96ab13c764fa3333fea` |
| `tesbo-qa-baseline/Tesbo-Backend-Nest/migrations/V3_plans_cycles_executions.sql` | `52451138830d0240179ff2395ce6ae942f13a69ad7d1ae0eeb57805e1c14275c` |
| `tesbo-qa-baseline/Tesbo-Backend-Nest/migrations/V8_ai_generation_history.sql` | `0d4468bf96d124673e1b4c81fa1919967f2fd216ab4c85f696c67e2d2df11b3d` |
| `tesbo-qa-baseline/Tesbo-Backend-Nest/migrations/V16_tesbo_reports.sql` | `418dbda436b01cb08035a279c5b29c98c28317105293bd1d6e5618859539ec48` |
| `tesbo-qa-baseline/Tesbo-Backend-Nest/migrations/V35_zyra_agent_tasks.sql` | `9d54ed6bda3617b23761950229a9edfaa85d8485bf9f0177eb7455095e4abbd1` |
| `tesbo-qa-baseline/Tesbo-Backend-Nest/migrations/V36_zyra_activity_sources.sql` | `14072201a7fd2bec63970bbc6f45fcd3e87d4aaf50ad00371225abf6c2d5e171` |
| `tesbo-qa-baseline/Tesbo-Backend-Nest/migrations/V58_actors_identity.sql` | `2295da8c84e7f7b9014a1ff1ec11f0952c3fbeae06ea9708598e218ed577cf9d` |
| `tesbo-qa-baseline/Tesbo-Backend-Nest/migrations/V89_zyra_chat_review.sql` | `31f19e63c46e6fb03f0eecbaae13c2de319149baf29b160fc7b27954b51eb5fb` |
| `tesbo-qa-baseline/Tesbo-Backend-Nest/migrations/V107_ai_generation_requests_system_actor.sql` | `ca295d2fa92006a07e2f6c54cfe4029d29cc1c12f6eb7905eaecca4a05ca9f9f` |
| `tesbo-qa-baseline/Tesbo-Backend-Nest/migrations/V157_native_testcase_proposal_review.sql` | `cfd6a0091351f7f39807dd0a9832c706f31d712e0c64d2a61efae7f2f96e7c51` |
| `tesbo-qa-baseline/Tesbo-Frontend/app/(app)/projects/[id]/agents/tasks/page.tsx` | `f3a187dc8d641bde474ccf876c912002a023fba123f6a9e26b15e6d27872165d` |
| `tesbo-qa-baseline/Tesbo-Frontend/app/(app)/projects/[id]/agents/tasks/[taskId]/page.tsx` | `8bd8b2a9dba9b21457718eafb157a31acb42214dceb0f2c2ed8cc579ef23cc0b` |
| `tesbo-qa-baseline/Tesbo-Frontend/components/agents/TaskQuickViewPanel.tsx` | `771177b354d1dc630a6562fc8973e924cb0eba3014818788c6fa4a4e325236b3` |
