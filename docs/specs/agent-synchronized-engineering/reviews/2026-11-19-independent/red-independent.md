# Tesbo original QA loop — independent Red Team receipt

**Reviewer:** `/root/red_qa_premise`, actual independent member; not the implementation author or a compiler persona.
**Review date:** 2026-11-20 UTC.
**Stage:** PRE-DESIGN Gate B, after the actual Blue receipts and before Grey/White architecture admission.
**Individual disposition:** The original external QA job is real and remains unsatisfied at the inspected source pin. Admit **EXTEND + EXTRACT + COMPOSE** as the direction for further design; do not admit a parallel QA platform, a concrete new persistence design, full architecture freeze, implementation completion, or release readiness. The gates below remain open. This is one member's receipt, not a two-person Red quorum verdict.

## 1. Decision and the strongest counterevidence

The user needs to give a bounded testing job to a particular external executor, let that executor use its own reachable environment and Chrome/Playwright/Appium capability, preserve exactly what it observed, and later decide what belongs in Tesbo's native records. An independently linked retest must be able to contradict an earlier interpretation without changing the original observation. Human approval must identify the exact operations and content that will be applied. This job survives an attempt to remove the proposed subsystem entirely: case-backed automation ingestion and internal generation tasks cannot jointly establish those facts unchanged. [C01 FR-001–054; C02; S02, S04, S06]

However, the need does **not** justify another case repository, Bug store, run-result store, KB, assistant, general approval queue, source registry, or release-truth service. The inspected pin already has materially useful protections: current semantic test-case approval receipts, transactional approved-only run attachment, exact KB submission and review snapshots, a coherent proposal-review snapshot, transactional selected native case application, named external MCP consent, native files, and server-observed source capture. Several inherited objections to an older baseline would rebuild owners that now exist. [S03, S04, S07–S10, S12]

The sharpest independent findings are:

1. Current Bug creation/linking still calls a post-commit routine that changes manual and open automated executions to `Failed`, including execution time and actor. The canonical decision already forbids a Bug link alone from being a result correction. The closed-automated-run exception does not fix the semantic defect. [C00 revisions 1.4.8–1.4.11; C01 FR-071–087; S05]
2. Existing MCP direct-publication refusal is a **test-case** boundary. Native Bug writers remain ordinary `write` tools. Giving a future executor or analyst legacy broad write access could publish a Bug and trigger that result mutation, without the proposed selected-publication review. This is a design-admission hazard demonstrated by callable source, not a claim of observed misuse. [S05, S07]
3. The current case apply path has real exact-revision and transaction guarantees, but operation identity is still positional within mutable proposal payloads. It resolves some suite destinations by project-wide name at apply time and deliberately orders multiple operations against the same target. Those are not the canonical stable-operation, exact-destination, dependency-closed postimage guarantees. [C01 FR-028–035, FR-043; S04]
4. A bound machine project still passes through the human issuer's current active-workspace check. One shared MCP actor and a human issuer do not identify a particular external runtime installation or prove human assent. [C01 FR-010–017; C00 P-18; S02, S07]
5. Original report receipt/finalization, fenced attempt identity, evidence-byte integrity, immutable retest linkage, and independent per-attempt observations are not supplied by current generation tasks or latest-result automation ingestion. Necessary logical identities survive, but new table names do not thereby pass Negative Design Proof. [S02, S06, S09]
6. Generalizing old generation records without a retention migration would retain the real-human requester cascade: V107 makes system requesters nullable but deliberately leaves user-deletion cascade semantics in place. Historical approval/report retention cannot silently inherit that policy. [S02]

The correct response is to strengthen the existing owners and make their boundaries explicit. The findings are not permission to hide the original QA loop behind source-sync, Model Studio, Skills, or a large engineering-control platform. A useful observation-only increment must be labelled as such; the requested round trip also includes analysis, linked retest, and exact human-selected native publication. [C00 P-01, P-07, P-14, P-17, P-20; C03 §18; B]

## 2. Run context, authority, and evidence limits

### 2.1 Binding

| Field | Exact context used in this receipt |
| --- | --- |
| Target application | Tesbo, repository `1alextest/Tesbooboo` (dispatch label `TESBO1alextest/Tesbooboo`), not Nesberry |
| Immutable target source | `/workspace/scratch/fb086055b433/tesbo-review-baseline`, verified HEAD `288c89b36dd5e748621752a175f1f4bdaac7ec87`; clean `git status --porcelain` when inspected |
| Method | Unchanged `NesberryEnterprise/Nesberry@d83549c85a4dcd047fb40dc4fba4ec62737ab0fc`, provided under `/workspace/scratch/fb086055b433/assurance-method-inputs` |
| Mandatory method files | `.kiro/steering/teams/red-team-charter.md`, `.kiro/steering/teams/review-orchestration.md`, portability and evidence policies below |
| Verified method file hashes | Red charter SHA-256 `3f633248025cb73c8b6f392f989599eb6d7554db714a66ac323b080e2d749c9e`; orchestration SHA-256 `023a64168c5160a761b91e7496b8a35b89246baf7eda0ab62bac17a7fa44771e` |
| Product authority | Original eight `00`–`07` files in `/workspace/scratch/fb086055b433/tesbo-canonical-inputs/extracted-v1.4.28` |
| Archive binding | `Tesbo_Specifications_v1.4.28.zip`, SHA-256 `6094687758ebf1e5dfa3c6ed8e2209b8967a190523815ba1e1197d11867374ef`, 501470 bytes. All eight extracted Markdown files independently compared equal to corresponding archive members. |
| Historical application document | `/workspace/scratch/fb086055b433/tesbo-canonical-inputs/creating a testing tool to make my job easier/Tesbo_Existing_Application_Baseline_v1.0.md`; selected historical/context sections inspected, not asserted current-source truth |
| Blue input | Actual independent `/root/blue_qa_foundation_a` and `/root/blue_qa_foundation_b` raw receipts in `assurance-working/blue-a.md` and `blue-b.md` |
| Sole permitted author-worktree read | `/workspace/scratch/fb086055b433/Tesbooboo/docs/specs/agent-synchronized-engineering/reviews/2026-11-19-independent/blue-reconciliation.md` |
| Actors reconstructed | Task author; credential issuer; named client; executor installation; analyst; native Copilot; human reviewer; administrator; source/provider worker; ordinary native user; independently authorized automation reporter |
| Boundary | Source and supplied artifact inspection only. No application, database, migration, browser, customer environment, installed executor, network mutation, or implementation edit. The only authored output is this review receipt. |

The policies applied are `docs/policies/governance/POL-GOVERNANCE-ASSURANCE-PORTABILITY/v001.md` and `POL-GOVERNANCE-ASSURANCE-EVIDENCE/v001.md` under the method root. They require reasoning invariants, exact context, honest evidence, reachable producers, consequences, and recovery. They do not import Nesberry's marketplace entities, role vocabulary, operational permissions, or runtime harness into Tesbo. No method file was edited. No new cross-application policy is proposed here. [M]

### 2.2 Actual evidence modes

| Mode | Performed | What it can support |
| --- | --- | --- |
| Primary requirement reading | Yes, targeted original-loop, integration, authority, and UX sections across all eight files; headings inventoried | Product obligations and their conflicts; not a claim that all roughly 1.4 MB of canonical prose was line-audited |
| Static source/schema inspection | Yes, manifests, named migrations, native service paths, token/MCP boundaries, selected UI consumers | Existing ownership, actual statements/branches, missing guarantees in inspected paths, design counterexamples |
| Independent adversarial reasoning | Yes, explicit attacks below | Conditional failure mechanisms and expected oracles; not executed attacks |
| Existing CI report parsing | Yes, supplied `index.html` embedded report ZIP | Exact captured report statistics: 19 total, 10 expected, 9 unexpected, 0 flaky, 0 skipped, `ok: false` |
| Actual CI screenshot inspection | Yes, one PNG visually inspected | The captured native Zyra partial-review frame only |
| Trace metadata inspection | Yes, matching trace ZIP | Captured test title, browser/viewport/theme/locale metadata; not rerun success |
| Runtime/API/database/browser validation | **NOT RUN** | No implementation acceptance, exploit reproduction, deployed migration parity, or current live UI claim |
| Graph verification | Manual source/relationship reasoning only | No mechanical Graph harness, no `--graph` execution, no complete graph coverage claim |
| Specialist and full-journey assurance | **NOT RUN in this receipt** | Grey, White, QA, Purple, and other required receipts cannot be inferred from this Red receipt |

The raw Blue records are archaeology inputs, not substitutes for source inspection or authority. I did not inspect subsequent implementation fixes, future CI, or other moving-worktree content. The source manifests declare NestJS 10/TypeScript 5.7/pg 8.13/BullMQ 5, Next 16.4.6/React 19.2.3/Tailwind 4/Tiptap 3.33 and reporter 0.2.0; these are source declarations, not installed-version or runtime assertions. [S01]

## 3. Independently reconstructed job and authority graph

### 3.1 The irreducible round trip

| Stage | Fact that must be owned | Authorized producer and consequence | What the stage does not prove |
| --- | --- | --- | --- |
| Author task | Exact requested work, target/environment reference, constraints, context and acceptance intent | Authorized human or permitted producer creates native task; dispatch freezes the consumed revision | A task, prompt, URL, or model answer does not prove testing occurred |
| Assign and claim | Particular eligible executor, one current attempt generation, lease and accepted terms | Bound-project runtime claims under current grant; server fences competing/stale writers | Registration, heartbeat and model-brand metadata do not prove a browser/device action |
| Execute externally | Claimed observations with actual target/build and evidence provenance | Executor uses its own network and driver; blocked, partial and unknown are legitimate outcomes | Tesbo need not share the executor's VPN; an action is not an assertion result |
| Reserve/upload/finalize report | Durable pending receipt, exact original body, manifest and verified immutable bytes | Current attempt reserves before upload; finalization checks scope, task/attempt generation and required artifacts | Finalized means an accepted report receipt, not independently verified truth of every reported assertion |
| Analyze | Versioned interpretation, proposed case/result/Bug changes, explicit uncertainty | Authorized analyst or native Copilot reads original evidence and produces a candidate | Analysis must not rewrite the report, approve itself, or publish native facts |
| Clarify or retest | New request and linked attempt/report with its own context | Clarification/retest records explain the relationship, require an appropriate new claim, and preserve old evidence | A fix, new case, or second report does not retroactively make the first execution pass |
| Human review | Exact revision, selected stable operation identities, destination/base/policy bindings | Trusted human action approves the selected dependency-closed set and exact postimages | Credential issuer, session owner, generated text, or a checked model box is not assent |
| Native apply | Single authoritative native effect and durable receipt | Existing native writers run under final guards, one transaction for the selected protected native set, mandatory audit | Tracker-copy approval is not an external tracker write; an apply receipt is not deployment or release approval |
| Inspect and recover | Original chain and truthful incomplete state | Authorized users resolve uncertain calls by receipt lookup; retry/resume rechecks authority; recoveries have owners | A log line, timeout, cached green badge, or delayed worker does not establish completion |

This decomposition preserves original reports, analyses, proposed operations, accepted native records, and retests as different meanings. It does not prescribe separate microservices or tables. It permits reuse of an immutable artifact envelope across meanings if type, authority, retention, and consumer rules remain explicit. [C01 FR-001–054, FR-071–087; C02; C04]

### 3.2 Native engineering integration must compose around that job

Requirements and acceptance criteria belong to canonical typed native knowledge/work artifacts; exact approved test definitions remain Test Cases; their observations/results remain Runs and executions; defects remain Bugs; evidence bytes remain native file storage; general work belongs to the work/task owner. Reusable methods and policy documents can use KB identity/versioning, with distinct assignments and governed activation where required. Source bindings, captured changes, impact obligations, and Model Studio own their existing source/model facts. A Change Packet is a projection linking a changeset, impact assessment, and shared operations. Release readiness is derived from its actual obligations and independently recorded decisions; a release is not whatever a Change Packet aggregate says. [C03 §18.1–18.3; C04 ASER-C01–06; S08, S10]

A source-free exploratory test, manual execution report, policy edit, or environment investigation remains legitimate. It must not invent a commit, source binding, running model, approved Skill, or test case just to satisfy a universal engineering form. Conversely, a code-linked change with several relevant repositories or release candidates must retain those explicit many-to-many relationships. Seven required domain assessments mean seven reasoned dispositions, not seven manufactured mutations. [C03 §18; C04 ASER-C01–06]

The minimum questions the model must answer are: Who asked for what exact version? Which installation could act, under what current grant? What attempt actually submitted this evidence? Which bytes were received, and can an authorized reader retrieve them? Which findings were direct, side, or undetermined for which assertion/attempt? What interpretation was reviewed? Which exact operations were committed once, by whose assent? What remains unresolved, blocked, deliberately deferred, or cancelled? What changed between original and retest? Which downstream decisions are now stale? Each question has a different legitimate producer; collapsing the answers into a single task status fails the job. [C01; C04]

## 4. Mandatory premise falsification and Shadow Architecture Test

| Hypothesis tested | Counterexample against it | Disposition |
| --- | --- | --- |
| No external-QA capability is needed; native automation already does it | `AutomationService.recordResult` requires an existing `caseId` and native run; one current execution row receives retry updates. A case-free exploratory task/report cannot be represented truthfully without a fabricated case or a separate original-receipt meaning. | Falsified for unchanged reuse. Extend native work/evidence owners; retain native execution as the accepted result owner. [S06] |
| Internal generation tasks already are external work | V8/V35 and the Tasks UI contain provider/model, generation count and generation/review statuses; creating the UI task calls Zyra and availability depends on its active state. Assignment to a particular external installation with lease/fence is different from generation. | Falsified unchanged; typed extension/extraction remains viable. Do not rename generation `done` into successful external work. [S02, S11] |
| A KB page can simply be the report | An editable document and its latest autosave do not establish report-finalization semantics, required-byte completeness, task/attempt authority or original-versus-supplement linkage. But V156's exact immutable version pattern defeats the claim that a wholly new versioning platform is necessary. | A typed immutable artifact pattern can be reused/extracted; report semantics must be added at the correct owner. [S08, S09] |
| A token or vendor/model label is an executor identity | Two installations of the same named client can claim concurrently; a token can rotate while the installation/attempt continues; one issuer can change active workspace. Shared MCP actor and token display name cannot express all three facts. | A stable installation identity/binding is necessary; a new global agent platform is not. [S02, S07] |
| Latest report/result is enough | The analyst's original interpretation may have been approved before a contradictory retest; the exact earlier definition and evidence must remain inspectable. Current automation retry overwrite cannot answer this history question. | Append-only original/retest identity is necessary. A projection may show latest/effective, never replace the historical owners. [C01 FR-009, FR-022, FR-048, FR-083; S06] |
| One common approval can cover case publication, methods and release | A case edit may be correct while the reusable method remains unsafe; a QA finding may be preserved while release is blocked. Independent terms and actors can disagree legitimately. | Separate decision meanings on existing review/audit seams. Reject a universal approval state machine that grants all consequences. [C03 §18; C04 ASER-C03] |
| Source graph/Model Studio should be the parent of all work | A mobile investigation with no repo access and a manual side finding are valid primary jobs. Conversely, a source change can have several QA tasks and no execution yet. | Wrong parent. Typed links and projections compose source impact with QA; neither owns the other's evidence. [C04 ASER-C02, ASER-C06; S10] |
| Skills/effective governance must be operational before any evidence can enter | Raw authorized observation intake has no method-activation consequence. Blocking a failure report because no Skill is active destroys evidence precisely when governance is incomplete. | Reject as a universal prerequisite. Govern activation and protected promotion separately; preserve declared no-Skill/unknown method context. [C04 ASER-C06] |
| Building a general executor product is required | Browser, CLI and Appium runtimes can all produce the same declared observation contract while owning different driver capabilities and network access. Tesbo does not need to implement their drivers. | Reject platform expansion. Define adapter contract and evidence claims; keep transport/vendor details as axes. [C00 P-06, P-15, P-17] |

The shadow-architecture verdict is consequently specific: a second owner is rejected wherever Tesbo already owns the authoritative fact. Candidate schemas that duplicate case versions, KB versions, native Bugs, files, source captures, or review receipts fail even if their new API is cleaner. A narrower common writer or immutable-envelope extraction is legitimate only if all participating consumers use it and the old owner remains authoritative. No proposal earns an exception through a fashionable noun such as “Agent”, “Skill”, “Change Packet”, “Context”, or “Orchestrator”.

## 5. Negative Design Proof for proposed persistent primitives

This matrix deliberately treats C03's table names as hypotheses. `R` means **REUSE unchanged**, `E` **EXTEND an existing owner**, `X` **EXTRACT a shared implementation from an existing owner**, `C` **COMPOSE existing owners**, and `P` **PROJECTION-ONLY**. Each cell records the attempted alternative and why it survives or fails. “Need identity” never means “new independent table approved.” Because E/X/C survive repeatedly, no new independent persistence subsystem passes all five rejection tests in this receipt. Exact physical storage is a subsequent design proof. [C00 P-01/P-20; C03 proposed tables and §18; M]

### 5.1 Every original proposed table family

| Proposed primitive | R test | E test | X test | C test | P test and admission |
| --- | --- | --- | --- | --- | --- |
| `agent_instances` | Existing agent/actor rows lack installation/attempt distinction | Extend actor/agent with scoped installation identity survives | Extract principal resolution survives | Compose installation, credential binding and current grants survives | Registration cannot be inferred from brand; durable identity needed, separate registry unproved. [S02, S07] |
| `agent_token_bindings` | Existing `api_tokens` binds issuer/project, not necessarily installation lifecycle | Add explicit binding/rotation semantics to token owner survives | Extract bound-principal resolver survives | Token plus installation identity survives; separate relation only for real cardinality/history | Effective current binding can project; historical grant/rotation facts cannot be invented. No table approval. |
| `capability_profiles` | Legacy read/write too coarse for protected actions | Versioned action ceiling in existing token/project settings survives | Extract capability evaluator survives | Existing consent plus ceiling plus task restriction survives | Effective allowed set should derive, not be a second mutable authority. Durable profile versions only if actually selected/relied on. |
| `capability_grants` | Named client consent useful but lacks every task/attempt action | Extend current grant owner survives | Shared authorization policy extraction survives | Intersect ceiling/current grant/task scope; deny wins | Do not persist independently editable “effective allow”; grant changes require attributable source facts. [S07] |
| `project_workflow_policies` | Current settings lack all reviewed policy versions | Version project settings or existing canonical policy document bindings survives | Shared resolver survives | Compose platform/workspace constraints with project/task choices | Resolved policy is derived; relied-on version must be snapshot-bound. No parallel project-policy store justified. |
| `test_tasks` | Generation semantics fail case-free external work unchanged | Typed native task/work extension survives | Extract common work lifecycle from generation owner survives | Work plus assignment plus artifacts survives | Task identity/intent cannot be merely derived from results; second top-level task app rejected. [S02, S11] |
| `test_task_revisions` | Current generation history is mutable payload/counter | Add frozen dispatch revision at work owner survives | Reuse/extract exact-snapshot pattern survives | Task+existing immutable artifact record survives if retention/scope correct | Latest task cannot reconstruct former instruction; immutable consumed version needed, table unproved. |
| `task_assignments` / fenced attempts | Current active actor/run retry metadata lacks one live claim generation | Typed assignment/attempt children at work owner survive | Extract lease/CAS service survives | Existing task+principal+receipt may represent state | Current lease may derive from authoritative events; authoritative claim/fence cannot be inferred from heartbeat. Durable identity required. |
| `task_reports` | Automation result or editable KB doc lacks original receipt contract | Typed immutable work artifact extension survives | KB snapshot and receipt patterns can be extracted | Work revision+attempt+artifact manifest+audit survive | Original observations cannot be rebuilt from later analysis; independent report identity necessary, physical owner open. |
| `report_artifacts` | Storage handles bytes, not report-manifest binding | Existing attachment relation extended with receipt/digest/finality survives | Extract byte-verification adapter survives | Report manifest+existing file identity survives | Lists derive from canonical bindings; new join only if actual cardinality requires it. No second file service. [S09] |
| `analysis_revisions` | Latest generated text lacks immutable consumed inputs | Typed work-artifact revisions survive | Shared immutable envelope survives | Report refs+analysis body+proposal refs survive | Analysis text is authored, not a derived status; separate service or universal analysis table unproved. |
| `change_proposals` | Existing generation request already stages cases, but fields assume generation | Generalize source-neutral proposal type at same owner survives | Extract shared staging/apply from Zyra survives | Typed operations+native writers survive | Aggregate status derives from operations; second proposal queue rejected. [S04] |
| `proposal_revisions` | V157 counter/current digest cannot recover every draft revision | Immutable revisions at existing proposal owner survive | Shared snapshot/CAS implementation survives | Existing revision plus content-addressed artifact survives | Current mutable array cannot reconstruct history. Need immutable revision semantics; storage choice not admitted. |
| `proposal_operations` | Positional index insufficient across revision/retry | Stable operation identity/commit linkage at proposal owner survives | Extract normalization/planning/validation survives | Existing native-target identities+receipt mapping survive | Postimages/commitment cannot be derived after deletion; status and progress should derive from stable facts. |
| `proposal_comments` | Existing task feedback/activity are reusable where semantics match | Typed comments linked to exact revision/operation survive | Shared comment component survives | Comment plus native permissions/audit survives | Thread display derives; no new independent comment authority. |
| `review_decisions` | Existing human case/KB receipts cover narrower decisions | Typed exact selected-operation decisions extend existing review/audit owners | Shared trusted-principal/digest helpers survive | Native approval receipts+proposal bindings survive | Human assent cannot be inferred from status; no universal approval engine justified. [S03, S04, S08] |
| `merge_commits` | Existing `save_events` already provides apply receipts, not full new contract | Extend receipt with stable operations and exact mappings survives | Extract same-client transactional apply survives | Native writes+mandatory audit+receipt one commit survive | Receipt lookup projects committed facts; independent merge-truth store rejected. |
| `published_case_revisions` | Existing V63 native versions and V155 review snapshots directly own definition history | Fill specific exact-revision gaps in those owners survives | Extract diff/presenter if needed | Compose case version+approval+run snapshot | No new publication-history authority. C03 already removes this as default; retain that compression. |
| `issue_drafts` | Shared proposal payload can hold a typed Bug draft | Add native Bug/tracker-copy operation types survives | Shared review form/apply seam survives | Existing Bugs/tracker adapters+operation receipts survive | Derived draft list only; no second defect repository or tracker truth. |
| `workflow_audit_events` | Existing audit/activity is usable but some paths best-effort | Add mandatory transaction-bound event types survives | Extract same-client audit sink survives | Existing transaction+native write+receipt survives | Audit facts cannot be inferred from final rows; second independent audit chronology rejected. |

### 5.2 Additional native-engineering nouns and implied primitives

| Proposed family | R test | E test | X test | C test | P test and admission |
| --- | --- | --- | --- | --- | --- |
| Session, ordered events, context summaries | Current chats own sessions but not every external event/recovery guarantee | Extend session/event identity and monotonic sequencing | Extract shared event envelope | Compose chat, task refs and explicit external observations | Summaries are derived with source/window/unknowns; never pretend an unavailable private transcript was observed. |
| Environment/context profile | `{name,url}` cannot preserve typed mobile/CLI targets or stable identity | Extend project settings with stable ID/typed target and history | Shared parser/serializer across settings/run/task | Compose environment reference+dispatch snapshot | Display name derives; exact dispatched target cannot derive from current settings. No environment platform justified. [S11] |
| Execution attempts, assertion outcomes, corrections | Native execution owns result; mutable retry row is insufficient history | Append attempts/condition events/corrections beneath native execution/work | Extract step/assertion presenter and guards | Compose native run snapshot+observation+review correction | Effective status derives; no parallel result repository. Legacy unproven attempts remain unknown. |
| Finding occurrences and typed links | V48 aggregate Bug links do not identify every attempt/condition occurrence | Extend relation owner with exact occurrence identity | Shared typed-link validation survives | Bug+attempt+condition+evidence | Direct/side role is occurrence-scoped; cannot infer from Bug global status. No new Bug domain. |
| Native requirement/criterion/manual/policy | Existing KB identity/versioning useful; current Requirements UI provider-bound | Typed document/work extensions survive | Shared editor/version/review primitives survive | Canonical documents+typed native links+domain views | Lists/coverage are projections; no duplicate Requirements database justified merely by adding native authoring. |
| Skills identities/versions/assignments/reviews/usages | KB versions reusable; approval alone is not assignment or activation | Typed KB identity and scoped immutable assignment/use facts survive | Extract effective resolver and review binding | Compose approved version, scope, policy and current authority | Effective Skill is derived; candidate read must not become active. Separate Skills KB/version store rejected; exact assignment storage open. |
| Source binding/config history | V146 already owns one current binding per project | Version config identity/history at that owner survives | Existing server-side registry validation extraction | Compose approved repository checkout+captured source fact | Current label cannot reconstruct prior checkout/config; new source registry rejected. [S10] |
| Changesets/impact obligations | Graph capture history/links already own source evidence | Extend typed impacts/history and native work links | Extract common obligation evaluator | Compose changeset, affected version, task and decision | Readiness is derived; new changeset platform is unearned. |
| Change Packet / coordination status | Existing changeset+impacts+proposals contain its facts | Add links or missing authoritative decision facts where necessary | Extract projection query | Composition directly satisfies C03 definition | **PROJECTION-ONLY survives** for packet/status; independent mutable packet approval/completion store rejected. |
| Release candidates/decisions | Existing release/provider facts and audit/review seams are starting owners | Typed independent release decision bindings may extend them | Shared policy evaluator survives | Many-to-many changesets/candidates plus actual evidence | Readiness derives; actual human decision does not. No deployment truth invented from QA success. |
| Composite request journal/idempotency | Single-case save receipt is narrower than multi-step staging | Extend existing receipt/request owner for ordered checkpoints | Shared exact-key/hash lookup and CAS resume | Compose existing individual writes with bounded journal | Staging partial state may be real; protected native apply must remain atomic. No distributed universal transaction platform. |
| Outbox/provider recovery | Existing BullMQ and graph review recovery do not prove general reconciliation | Add durable dispatch/reconciliation facts at existing job/integration owner only if needed | Extract worker patterns | Compose native commit+outbox+provider receipt | Provider completion cannot derive from queue success; no new scheduler product. |
| Coverage/traceability graph and history previews | Existing typed refs/native history useful | Add missing exact-grain links | Extract relation validation/history UI | Compose owners and approved edge semantics | Traversal/counts/previews derive; a graph edge never proves executed coverage. |
| Importer, runner/framework registry, analytics | Existing reporter/adapters and Insights may serve scoped needs | Extend supported formats only with real contracts | Shared parsing/validation extraction | Compose declared external capability+evidence | Brand/framework capabilities are axes; inventory/metrics projections do not justify a new product category. |

The table is an admission constraint, not a migration specification. Before proposing a new physical primitive, the designer must show the concrete failed extension/extraction/composition attempt, cardinality, authority, retention, transition and consumer requirements. “JSON is ugly,” “future flexibility,” or an existing C03 table name is not a negative proof. Conversely, compressing everything into one untyped JSON object also fails if it loses transaction guards, immutable references, access boundaries, or a reliable producer path.

## 6. Compression, axes, hardest siblings and participation scope

### 6.1 What can be deleted without losing the invariant

Delete a second task navigation root, independent QA case/run/Bug stores, a publication-history copy, a separate Skills document store, per-field history tables, an independently writable readiness total, and a universal “agent status.” Keep context-specific views into the native owners. Delete vendor-brand branches from authority; a brand is descriptive metadata, not a grant. Delete a model/provider prerequisite from externally executed or manually submitted work. Delete late suite-name interpretation from reviewed publication. Delete a generic “everything succeeded” aggregate wherever individual obligations can remain unresolved. [C00 P-01/P-06/P-20; C02; C03; S02–S11]

Do **not** delete the differences between requested and consumed instructions, installation and issuer, current lease and historical attempt, received bytes and claimed action, report and analysis, operation identity and revision index, direct and side occurrence, immutable native definition and current editing draft, accepted result and correction, human approval and machine recommendation, candidate method and active assignment, or queue acknowledgment and external effect. Each surviving distinction changes a legitimate consequence or a necessary historical question. Most are types, bindings or child events under existing owners, not independent domains.

### 6.2 Orthogonal axes and brand-deletion attack

| Noun/axis | Unique mutable truth after deleting the brand | Correct placement and rejected conflation |
| --- | --- | --- |
| “AI agent” | Installation identity, capabilities, credentials, claims; possibly model responses | Actor/runtime axis; model backend, transport, execution substrate, tool driver and human reviewer remain separate |
| Chrome / Playwright / Appium | Declared and evidenced browser/device/driver capability | Executor capability and evidence metadata; no provider-specific task domain |
| “QA task” / coding work | Work intent and acceptance obligations | Typed native work; generation completion is a different state than work acceptance |
| “Report” | Original authored observation and receipt | Immutable work evidence with exact producer/context; not a test-case lifecycle state |
| “Skill” | Canonical versioned guidance, explicit assignment and governed use | Typed KB/policy relationship; not a second assistant or a generic permission grant |
| “Change Packet” | No new independent fact beyond changeset, impacts, proposed operations and decisions | Projection; an attractive card does not justify a new completion authority |
| “Readiness” | Derived satisfaction and blockers at a declared evaluation revision | Computed view with source facts; release decision and deployment result remain separately owned |
| “Coverage” | Defined relation between requirement/condition/definition/observation | Typed graph semantics and explicit evidence tier; a linked case alone does not mean run or passed |
| “Environment” | Stable target configuration and what the executor consumed | Project configuration plus task/attempt snapshot; not merely a URL, name or assumed hosted web application |

Sibling symmetry matters: if native Bug history is composed from its authoritative versions and links, case history must not be copied into a new “AI provenance” domain. If internal generation is one producer of shared proposals, external analysis must not require a separate review queue. If a native human can submit source-free work, an external producer must not fabricate source context solely to enter the same owner. [C03 §18; C04 ASER-C01–06]

### 6.3 Participation and opposite-scope siblings

| Attack | Hardest/opposite sibling | Result |
| --- | --- | --- |
| False flatness | A case-free investigation report is primary evidence; a screenshot in a case-backed run supports a particular assertion | One universal `execution_id` parent is wrong. Preserve a typed owning relation and exact subordinate condition links where present. |
| Wrong parent | A policy change creates a work obligation before any repo or test run exists | Neither graph capture nor run creation may be mandatory parent for all work. |
| Parent contamination | A separately reviewed case revision arises from an incidental finding during another attempt | Link the new work/proposal and retain the original result. Do not insert its future acceptance into the old attempt. |
| Universal UI | A manual submitter, autonomous executor, analyst and reviewer use the same facts for different decisions | Shared services/components do not require one giant universal form or agent-only screen. Labels/actions must match the actor's consequence. |
| Scope mutation | Project environment, task intent, requirement, or Skill assignment changes after an attempt consumed it | Historical consumption stays pinned. New work takes a new revision; current projections do not rewrite past scope. |
| Independent acceptance | Receiving a raw report, approving a case edit, activating a method, and releasing a build can have different legitimate approvers | Retain independent decision bindings. A parent “approved” cannot imply all four. |
| Derivation versus storage | Whether a report is original, a supplement, or a linked retest follows explicit parent/role facts | Store the irreducible relation; derive display role and aggregates. Avoid two independently mutable classification fields saying different things. |
| Opposite authorization | Authorized automation reporter may submit a case result directly under its existing contract; an external analyst may only propose that result | Shared native result writer, distinct entry policy. Do not grant analysts reporter authority, or silently break established reporter compatibility. |
| Opposite guidance | A failure report arrives while the assigned method has been revoked | Retain raw authorized observation with method context; reject protected activation/publication if its current authority gate fails. |

Manual report submission is especially useful as a falsifier. It has a real human submitter and may name an asserted external runtime, but has no authenticated executor claim unless one actually occurred. With no active attempt, primary submission can use the task's explicit CAS/assignment-close rules. During an active lease, a manual supplement cannot steal primary completion or impersonate the executor. After a terminal report, additional evidence remains a supplement/new linked job rather than rewriting the original. A generic `reported_by_agent` boolean fails these cases. [C01 FR-018–022; C02; C04 reserve/finalize contract]

## 7. Semantic consequences, hostile traces and recovery ownership

### 7.1 Consequences that determine the model

| Fact and reliance | Mutation/race attempted | Required consequence and accountable owner |
| --- | --- | --- |
| Dispatch prompt/environment snapshot | Author edits current task while executor is running | Work owner preserves consumed revision; change becomes follow-up/new claim where required, not silent instruction substitution |
| Current claim/lease | Two installations claim; stale executor reports after expiry/reassignment | Task/attempt owner atomically consumes the single claim slot and rejects stale protected writes; lease expiry does not claim the external browser was stopped |
| Credentials and named consent | Token rotates/revokes; grant changes while a worker waits | Bound-principal resolver rechecks at next protected operation and after relevant lock waits; original attribution remains historical |
| Pending receipt and uploads | Response lost after reservation; upload finishes twice | Receipt owner returns the original matching reservation; exact content conflict fails; cleanup applies only to abandoned pending uploads |
| Finalized evidence | Same-size bytes substituted or object key reused | Artifact owner binds digest and immutable byte/version identity; byte retrieval uses current authorization; receiving metadata does not satisfy this |
| Human selected operations | Base changes or an operation is copied to a later revision | Native proposal owner invalidates stale approval and prevents repeat logical commit under a fresh key; explicit compensation is separate work |
| Accepted native run snapshot | Case renamed/edited or later approved differently | Run history preserves the consumed definition/identity and approval binding; present navigation can link to current case separately |
| Finding classification | Same Bug is direct on A and incidental on B | Occurrence owner records per-attempt/condition meaning; Bug association alone changes neither result |
| Current method/source config | Assignment or checkout changes after observed work | Usage/capture retains consumed version; current policy controls new acts, and stale obligations become visible without rewriting the old event |
| Composite staging | Some non-protected candidate writes succeed, one fails | Request journal reports actual partial/uncertain state; explicit CAS resume rechecks authority. Protected selected native apply remains all-or-none. |
| Provider action | Timeout follows possibly completed remote effect | Integration owner records unknown, resolves against provider receipt when possible, and refuses blind retry; queue worker success is insufficient |

Scarcity is not limited to compute slots. A live claim, a particular human's selected approval, a logical operation's once-only commitment, and a reviewed revision's applicability all have consumption/release semantics. None can safely be reconstructed from the latest status label. Revocation controls future protected acts; it cannot retroactively cancel an external action already performed, revoke knowledge already disclosed, or make historical evidence disappear. [C01; C04 ASER-C03–05; S04, S07, S09]

### 7.2 Explicit adversarial traces

These are **conceptual/source-backed attack traces, NOT RUN**. Each records the producer and the success/forbidden-effect oracle for later verification; writing the trace does not pass it.

1. **Competing installations and stale finalization.** Installations A and B of one named client race to claim the same ready task. Exactly one current generation wins. A loses the lease, B claims a later generation, then A uploads/finalizes late. The report owner may preserve appropriately scoped pending bytes but must not accept A as current completion or let A alter B's state. Recovery owner: task coordinator. A provider-brand lock or human-user lock cannot implement this correctly. [C01 FR-005/010; S02, S07]
2. **Manual opposite path.** A human records a blocked mobile observation with no saved case, source binding, model key or authenticated external installation. A valid original receipt must be reachable without pretending a browser ran or stealing an active claim. Recovery owner: human task author/reviewer, with explicit pending/blocked state. This attacks the current generation-only UI and case-required result API. [C01 FR-001/018/020; S06, S11]
3. **Lost reserve/finalize response.** Server commits report reservation, response is lost, caller repeats the key; server returns the same receipt only for the same authorized content. After finalization response loss, status lookup reads the receipt without replaying state changes. A finalized report is not garbage-collected as an abandoned upload. Recovery owner: report service and its pending-upload cleanup. [C04 reserve/finalize and operation-receipt rules]
4. **Equal-length evidence substitution.** Upload evidence A, then replace the storage key with equal-length B before/after finalization. Current `verify` checks availability/length, so it is not a digest oracle. Required finalization binds actual verified bytes/version; authorized download returns those bytes, not an expired pointer to a different object. Recovery owner: storage/report boundary. [S09]
5. **Issuer workspace switch and revoke.** A token bound to project P is used by an external runtime while its human issuer changes active workspace to Q. Bound-project work should remain governed by current project membership/grants, not human navigation state. Revoke the grant before a protected operation commits: that operation must fail without changing native records. Recovery owner: auth resolver; historical actor remains the real installation and issuer chain. [C01 FR-015; C00 P-18; S07]
6. **Analyzer uses an allowed Bug tool.** A future analyst grant mapped to ordinary MCP `write` calls `create_bug` with an execution link. Actual handlers can publish a native Bug and, for eligible executions, invoke automatic failure. Required oracle: analyst staging permission alone produces no native Bug/result; separately authorized reporter/native-human compatibility remains explicit. Recovery owner: native writer/policy seam. [S05, S07]
7. **Two selected edits to one target.** Two independently reviewed operations both start from testcase T at revision r, with different complete postimages. Current apply advances expected state to its own prior write and orders them. The canonical planner must reject conflicting selected operations unless an explicit reviewed dependency/postimage sequence makes the intended effect unambiguous. Recovery owner: proposal planning and native transaction. [C01 FR-035; S04]
8. **Duplicate suite name and fresh retry key.** Two branches contain “Regression”; review shows a candidate with a suite name, then application resolves `lower(name) ... ORDER BY id LIMIT 1`. Or an already committed logical operation is copied into a new revision with a new request key. Neither target selection nor once-only commitment may depend on the incidental current name/index/key. Recovery owner: exact destination mapping and stable operation receipt. [C01 FR-028–035/043; S04]
9. **Side Bug and corrected result.** Passed attempt A has an incidental finding later linked to Bug B. Its result/time/actor remain unchanged. A separate direct-evidence correction may change effective result with original and correction retained. Fixing B does not automatically pass A or a new case; retest C supplies its own observation. Recovery owner: Runs/occurrences, not Bug association. [C00 revisions 1.4.8–1.4.11; S05]
10. **Historical identity and delayed interpretation.** Rename a case after it was executed; then analyze the old report and follow its exact version link. The old run must still display the consumed identity/definition and distinguish backfilled fields. Current selected-save updates every matching `cycle_items.snapshot_external_id`, making this a concrete source concern. Recovery owner: native history. [S03, S04]
11. **Late UI response after context switch.** User changes project/task while a list/detail, comments or KB request is pending, then selects candidate operations after a refreshed payload. Selection must bind stable identities and exact revision; wrong-scope cached content must not appear or submit. Failed ancillary reads must remain distinguishable from true empty lists. Recovery owner: scoped UI request/state owner and server final guards. This trace remains unexecuted; inspected source shows relevant fallback/index seams. [S11]
12. **Source config rebind and old event.** Source selection changes while a capture/provider event is delayed. Existing server-observed capture is retained; interpretation must bind the config/check-out actually consumed. A later current config must not relabel the prior event. Recovery owner: source binding/capture owner. [S10]
13. **Method revoked, raw report arrives.** An old approved guidance version is no longer active, but an authorized executor submits a failure report. Preserve observation and consumed-method context. Reject any protected activation/publication dependent on current invalid authority; do not suppress evidence. Recovery owner: distinct intake versus governed promotion policies. [C04 ASER-C06; S08]
14. **Partial composite request and independent release.** Candidate staging succeeds for one domain, fails for another, and the response disappears. Lookup must expose the actual journal; it must not auto-resume or turn `cancelled` into all obligations satisfied. A subsequent release decision references its own candidate/evidence, not merely a green packet. Recovery owner: request journal, work obligations, release decision owner. [C04 ASER-C04–06]

## 8. Findings register

Findings below remain **Open** unless explicitly marked otherwise. “Critical” is an admission-severity judgment for a protected consequence; it does not assert a production exploit, data loss incident or runtime reproduction. Source and conceptual gaps are identified separately.

### TESBO-R01 — Original capability is still missing; replacement-platform premise is rejected

**Severity:** Major. **Category:** Assumption / Coupling. **Status:** Open.

**Finding and evidence:** The inspected work UI/service assumes generation, while automation `recordResult` requires an existing case and mutates a current native result. Neither provides the complete case-free assigned external task → original evidence → analysis/retest → selected native publication chain. Source-sync and Model Studio are adjacent native owners, not substitutes. Blue's common EXTEND/COMPOSE direction survives independent falsification. [C01 FR-001–054; C03 §18; S02, S06, S10, S11; B]

**Impact:** The team can ship technically useful source/proposal infrastructure and incorrectly call the user's original job complete; or build duplicate owners to fill the perceived gap.

**Recommendation and acceptance:** Design the bounded native round trip first, with source-free/manual/opposite paths. Reuse/extract existing writers and immutable envelopes. Any intermediate observation-only milestone explicitly omits later analysis/publication acceptance. Gate B may admit this direction, not a new subsystem schema. Actual reachable producers and the entire round trip still require implementation evidence.

### TESBO-R02 — Bound machine authority and human assent are not yet the same thing

**Severity:** Critical for new protected grant admission. **Category:** Boundary / Invariant. **Status:** Open.

**Finding and evidence:** `requireProjectAccess` and proposal authority include the user's current active organization. MCP and token REST paths reuse issuer-user checks. V58/V65 provide an actor seam but one shared MCP agent, not per-installation execution authority. Existing current token/consent checking and direct test-case publication refusal are real and must be retained. `create_bug`, `update_bug`, and `link_testcase_to_bug` remain native `write` tools; refusal is not a general ban on every consequential native mutation. [C01 FR-010–017/037; C04 ASER-C03/06; S02, S07]

**Impact:** Human UI navigation can break legitimate machine work; overly broad future grant mapping can permit analyst/executor publication outside selected human review. Issuer ID can be mistaken for acting executor or assent.

**Recommendation and acceptance:** Extract a project-bound machine resolver and explicit installation attribution; intersect token ceiling, current named grants, task restrictions and action policy. Retain human workspace behavior for human navigation. Apply final native policy across every supported REST/MCP/job/reporter/assistant writer, with explicit compatibility for separately authorized reporters. Protected human decisions must be action-bound and trusted; choosing the account role/root-recovery mechanism remains a named product/security gate, not this reviewer's invention. Prove revoke-after-wait and all writer aliases before exposure.

### TESBO-R03 — Current proposal commitment lacks stable operation history and exact destinations

**Severity:** Major. **Category:** Invariant / Spec-Code-Drift. **Status:** Open.

**Finding and evidence:** V157 and `zyraSaveAttempt` correctly bind current snapshot, revision, reviewer, selected indexes and apply parameters; use shared locks/native transaction; reject stale current base; and look up an exact prior decision. Nevertheless, selected indexes address a mutable payload that is filtered after saving. The digest/request receipt does not establish one logical operation's commitment across future revisions or fresh keys. `resolveSuite` can match name project-wide or create a suite at apply time; full destination identity was not necessarily what was reviewed. [C01 FR-028–035/043; S04]

**Impact:** The same intended change can be reintroduced as apparently new work, and ambiguous same-name destinations can receive approved content. Auditors cannot equate an array index across history with a stable operation.

**Recommendation and acceptance:** Extend the existing proposal owner with stable logical operation identity, immutable revision content, exact destination UUID or reviewed logical-create mapping, base/full postimage, and durable native mappings. Preserve exact current transaction/replay checks. Migration must preserve old receipts as legacy facts, never infer equivalence from title/content hash alone. Test fresh-key/future-revision replay and duplicate-name hierarchy without late interpretation.

### TESBO-R04 — Ordered same-target writes are not a dependency-closed reviewed plan

**Severity:** Major. **Category:** Invariant. **Status:** Open.

**Finding and evidence:** The selected-save loop advances a same-target operation's expected state to the prior operation it just applied. This allows an ordered sequence; it does not prove the user reviewed each resultant postimage or reject conflicting independently based edits. Missing/unapproved/cyclic dependencies and conflicting same-target selections are explicit canonical rejection cases. [C01 FR-035; S04]

**Impact:** Last applied operation can overwrite another selected operation while a successful atomic receipt makes the batch look correct. Atomicity preserves consistency of the wrong plan.

**Recommendation and acceptance:** Resolve and validate the entire selected operation graph before native writes. Reject conflict or expose a separately reviewed deterministic composed postimage. Receipts retain exact accepted mappings. Reuse existing native transaction; do not add a second merge engine. Prove that partial nonselected candidates remain untouched and dependency receipts are exact, authorized and current.

### TESBO-R05 — Bug association still rewrites execution outcome and attribution

**Severity:** Major. **Category:** Spec-Code-Drift / Invariant. **Status:** Open.

**Finding and evidence:** `createBug` commits Bug/link creation, then calls `failLinkedExecutions`; `addBugLink` also invokes it. The routine separately locks eligible runs and changes nonfailed executions to Failed with `executed_at=now()` and the linking actor. Closed automated runs are excluded, but manual/open automated runs remain affected. The canonical decision has already separated side/direct occurrences and explicit status corrections. This is a confirmed source contradiction, not an unresolved policy choice. [C00 1.4.8–1.4.11; C01 FR-071–087; S05]

**Impact:** Incidental findings falsify result history and authorship. A failure after Bug commit can also return an uncertain overall response, inviting a duplicate create retry if no idempotent receipt resolves it.

**Recommendation and acceptance:** Remove result mutation from link/unlink/resolve behavior at the native owner and update consumers that assume it. Explicit direct assertion finalization or reviewed correction uses the result owner, retaining original history. Preserve Bug-link scope/FK validation already present. Do not solve this with a parallel defect/result model. Prove both correction directions, side finding on Passed, same Bug with different occurrence roles, and uncertain response lookup.

### TESBO-R06 — Native history is stronger than status alone but still not immutable attempt truth

**Severity:** Major. **Category:** Invariant / Failure. **Status:** Open.

**Finding and evidence:** V155 plus `assertApprovedNewRunCases` requires an exact current human receipt and snapshots review content on new attachment. This is strong reuse evidence. V119 historical field backfills are still backfills, V140 positional step/history data is not an authenticated attempt ledger, and automation updates one execution row on retries. Current `zyraSaveAttempt` also updates all matching historical `cycle_items.snapshot_external_id` when a case external ID changes. [C01 FR-048/074/079/083/084; S03, S04, S06]

**Impact:** Future consumers can mislabel migration-time data as original observation, lose the exact earlier attempt, or display a new identity as if it was executed originally.

**Recommendation and acceptance:** Extend native history with explicit attempt/observation/correction facts and frozen definition identity, retaining a compatibility current-result projection. Preserve current approval semantics. Mark legacy provenance unknown/backfilled; do not manufacture timestamps, attempts, conditions or authenticated actors. Sweep historical identity writes and all renderers at the same pin; verify replay/correction behavior with actual supported writers later.

### TESBO-R07 — Report finalization needs verified immutable bytes, not storage availability alone

**Severity:** Major. **Category:** Failure / Boundary. **Status:** Open.

**Finding and evidence:** `StorageService` has useful path validation, byte reads, S3/local storage and metadata verification. Its `verify` checks presence/size, not a content digest; object writes can replace a key; S3 existence is lazy; presigned access has a TTL. These are not defects in a generic storage helper by themselves, but unchanged reuse cannot prove the proposed immutable original-report contract. MCP tool results currently serialize JSON text, so metadata return does not demonstrate image/byte consumption by the intended client. [C01 FR-019/021/022; C04; S07, S09]

**Impact:** A finalized report may reference missing/replaced/unreadable bytes or unsupported client content. A later reauthorization check cannot retroactively revoke an already issued presigned URL before its expiry.

**Recommendation and acceptance:** Extend native attachment/receipt semantics with pending reservation, content-bound manifest, required-byte verification, immutable/versioned storage identity, explicit read path and actual supported content modes. Make presigned/proxy revocation behavior match declared policy. Retain declared limits and retention decisions; do not invent a malware-scanning platform or new file store. Prove equal-length substitution, missing required evidence, retry, expiry, and authorized actual-byte retrieval on real client adapters.

### TESBO-R08 — Existing generation retention cannot silently govern new evidence and decisions

**Severity:** Major. **Category:** Failure / Assumption. **Status:** Open.

**Finding and evidence:** V8 binds `ai_generation_requests.requested_by` to users with `ON DELETE CASCADE`. V107 makes system requesters nullable but explicitly keeps the cascade for actual humans; null historically means system. V116 fixes chat-session retention but does not remove that requester consequence. Generalizing this owner without explicit retention changes can delete new durable work/proposal evidence when a human is deleted. [S02]

**Impact:** Audit/report/decision lineage could disappear or be misattributed to a system actor if a naive SET NULL migration is used.

**Recommendation and acceptance:** Preserve existing historical meaning while introducing retained immutable attribution and a consciously chosen deletion/retention policy at the native owner. Enumerate user/project/task/file deletion and restore consequences. Do not invent the legal retention duration. Verify actual deletion/restore paths in an authorized later environment; this receipt ran none. A new table is not inherently safer and still needs the same policy.

### TESBO-R09 — Skills, work acceptance and release authority cannot inherit KB approval wholesale

**Severity:** Major. **Category:** Assumption / Boundary. **Status:** Open.

**Finding and evidence:** Current KB submission records immutable exact candidate versions with same-commit audit; AI-memory review checks trusted human principal, owner/manager role, current locked membership and exact revision. V156 explicitly does not implement Skills assignment/bootstrap. C03/C04 require separate effective-method, work-acceptance, independent release and exact human authority semantics, with unresolved accountable-role/recovery choices kept as gates. [C03 §18; C04 ASER-C03/06; S08]

**Impact:** A candidate read or ordinary KB approval can accidentally activate instructions or authorize release; alternatively, every raw report gets blocked behind a nonexistent governance bootstrapping path.

**Recommendation and acceptance:** Reuse KB versions and trusted-principal primitives, compose explicit assignment/use and independent decisions, and keep derived effective state read-only. Record owner decisions for root governance, role/quorum, exceptions, retention and recovery before exposing those protected capabilities. Preserve raw intake under its own authority. No duplicate authority registry and no silently selected reviewer policy.

### TESBO-R10 — Source integration and packet readiness require historical bindings, not new truth stores

**Severity:** Major. **Category:** Coupling / Assumption. **Status:** Open.

**Finding and evidence:** V146 already owns one mutable source binding per project, and the reader validates approved server registry/project/org before observation. Source capture takes no client-asserted source body and checks checkout state; graph history/model review/run-link owners exist. Current config alone cannot identify all historical configuration changes. C03 defines Change Packet as composition, and C04 distinguishes activity evidence tiers, domain assessment, coordination and release decisions. [C03 §18; C04 ASER-C01–06; S10]

**Impact:** Delayed events can be interpreted against a newer config; a packet status can claim release or complete coverage that no producer established; source-free work can become unreachable.

**Recommendation and acceptance:** Version native binding/config consumption, compose existing captured facts and typed obligations, keep packet/readiness as projections, and record independently scoped decisions. Do not treat the existing notification-recovery scheduler as proof of provider reconciliation. Validate actual source producer/rebind/recovery paths later, including no-source and multiple-release-candidate siblings.

### TESBO-R11 — Existing UI cannot yet represent or evidence the complete original loop

**Severity:** Major for workflow admission. **Category:** Failure / Spec-Code-Drift. **Status:** Open.

**Finding and evidence:** Tasks creation is Zyra-generation-oriented; detail loads/fallbacks and selections remain positional; its `loading || !task` branch renders a loader before downstream content. Some ancillary failures become empty lists. Environment type/parser and Settings serializer retain only name/URL, so naive addition of stable ID/type fields would be lossy. The testcase detail route redirects to the repository and discards the exact case route target. Shared Modal/Drawer source lacks a complete dialog/focus contract; no accessibility runtime claim is made. [C02; C07; S11]

**Impact:** A backend-capable flow may still be unreachable for a no-model human; users may confuse unreadable with empty, lose exact destinations/context, or approve content different from their persistent selection. A mockup can conceal these states.

**Recommendation and acceptance:** Extend native Tasks, report/retest detail, shared exact-review panel and context-aware links; preserve the current transaction-bound save interaction while binding stable operations. Update every environment reader/writer together. Distinguish loading, error, forbidden and genuine empty states. Capture actual affected surfaces and shared-component consumers at the implementation pin; verify keyboard/focus/responsive/draft recovery. VISUAL-BASELINE BLOCKED for any unobserved Before state and all proposed After states.

### TESBO-R12 — Evidence scope does not permit a full-suite or release claim

**Severity:** Major if used for freeze. **Category:** Assumption / Boundary. **Status:** Open.

**Finding and evidence:** The supplied report actually fails (`10 expected`, `9 unexpected`, `ok=false`). One screenshot and its metadata prove one captured scene. Source reading and this attack inventory are not full GJ-01–49 execution, all writer coverage, restored backups, actual external-client reachability, or complete specialist receipts. Historical mocks and source-reconstructed Before images remain non-runtime artifacts. [M; C00 revision 1.4.12; B; E]

**Impact:** A polished review package can manufacture confidence while original-loop execution, recovery and consumer reachability remain unknown.

**Recommendation and acceptance:** Preserve raw findings and each evidence tier. Grey supplies the full journey/consumer inventory, White binds actual required receipts, and later QA/Purple supplies same-revision runtime and visual evidence with honest blocked/N/A dispositions. Do not wait for future CI to complete this pre-design receipt, and do not apply a future fix result to this immutable source pin.

## 9. Historical coexistence and valid migration alternatives

The following are admissible migration strategies, not implementation instructions or executed migrations:

1. **Keep generation records meaningful.** Introduce a typed work/proposal path at the current owner or extract a common owner with compatibility adapters. Existing Zyra tasks continue to mean generation and review. Old `done` does not become “external task accepted,” and old provider/model strings do not become installation identities. A separate table may eventually be the safest physical extension, but only after demonstrating why the current owner plus typed children cannot preserve the needed lifecycle, access, retention and migration semantics. [S02]
2. **Preserve old publication receipts without fabricating operation lineage.** Freeze/drain an old in-review payload, or explicitly adopt it into a new immutable revision with new stable operation identities and a recorded adoption boundary. Show prior saved outcomes as committed legacy receipts. Do not use array index, title, a fresh request key, or content similarity as proof that two historical operations are the same. A known previous native effect requires an exact mapping, not optimistic deduplication. [S04]
3. **Extend native execution history while keeping compatibility readers.** Preserve existing current execution IDs and reporter APIs where authorized. Append new attempt/condition/correction facts; current status can project from the accepted event sequence. Existing rows lacking attempt/condition identity remain legacy/unknown. V119 backfilled fields must not be relabelled original snapshots; current V155 exact review snapshots must not be downgraded to status-only checks. [S03, S06]
4. **Retain original byte and attribution semantics.** Existing attachments may remain ordinary mutable lifecycle assets. A finalized report must bind an immutable/versioned attachment meaning without retroactively asserting that every historical key was immutable. Preserve the human-versus-system origin distinction through requester-retention changes and deleted-user attribution. Exact retention/deletion/redaction policy is a named owner decision. [S02, S09]
5. **Keep legacy credentials explicit.** Existing read/write reporting clients do not silently gain new task-claim, method-activation, review, or release powers. New narrowed grants do not silently acquire legacy native Bug/result writes. Rotation links historical identities without treating a new bearer token as the historical actor. Update machine access without changing the human's current-workspace navigation semantics. [S07]
6. **Version observed source configuration from a truthful boundary.** Record an initial configuration identity only with known provenance; do not invent prior configuration history from the current V146 row. Captures retain the server-observed checkout/commit they actually established. Existing graph/model approvals and run links retain their own scope, not a retrospective universal release status. [S10]
7. **Roll out shared writers before exposing new producer aliases.** New MCP/native Copilot/UI entry points must reach the same final guarded native services. Disabled preview is a truthful interim state. A partially migrated adapter that cannot meet atomic protected apply must refuse before native writes; it cannot report staged work as committed. Composite staging may use the explicitly described partial journal, with different consequences. [C04 ASER-C04/06; S04, S07]

These choices leave room for implementation design without declaring an arbitrary normalized schema inevitable. They also expose the risky alternative: a clean new owner populated with optimistic inferred history produces two truths and weaker evidence even if its columns look better.

## 10. Omission and negative-space result

| Missing or easily collapsed reality | Why users/operators need it | Disposition after attack |
| --- | --- | --- |
| No case, no source repository, no model and no active Skill | Exploratory/manual/blocked work must remain reachable | Explicit native task/report path required; no fabricated prerequisites |
| Partial work, unsupported driver, unavailable VPN/device | A valid task can produce no executed assertions | Truthful blocked/partial/unknown, not automatic Failed or Passed |
| Manual primary versus supplementary evidence | Human intake must coexist with an active or terminal executor claim | Explicit relation and CAS; no impersonated installation |
| Scope-restricted evidence that reviewer cannot read | A candidate can exist while approval lacks necessary evidence | Unreadable/forbidden differs from absent; review cannot silently use a zero-item list |
| Action completed versus assertion observed | Appium/Playwright command success is not business expected behavior | Stable condition identity and observation meaning required |
| Direct, side and undetermined occurrence | One Bug can have different consequences across attempts | Occurrence-scoped linkage and separate result/correction owner |
| Authenticated report receipt versus attested external claim | Tesbo observes receipt, provider may attest action, agent may merely report it | Preserve C04 evidence tiers; do not promote assertion strength |
| Analysis superseded but original still authoritative | Later interpretation must be inspectable without destroying earlier reliance | Immutable analysis versions with consumed-report refs |
| New case without execution | Proposed regression coverage does not prove a run | Native Draft/Approved lifecycle separated from execution status |
| Mixed selected/rejected/copy-only proposal outcome | A proposal can be terminal without every item being merged | Aggregate derives from typed operation dispositions |
| Same target, different granularities | Case edit, assertion result and Bug occurrence can refer to different versions/events | Typed exact-grain edges, not a universal “related ID” |
| Current authorization versus historical consumption | Revocation must stop future acts without rewriting attribution | Current checks plus immutable historical binding |
| Source-free versus multi-source change | A universal single-repository parent excludes legitimate work | Optional explicit source relations; independent release-candidate mappings |
| Deliberate non-applicability versus unresolved impact | “No change required” and “not assessed” have different release consequences | Separate domain applicability and work-state axes |
| Missing provider receipt/partial journal | Operator needs a safe next action after timeout | Explicit unknown/partial state and named recovery owner |
| User/account/project deletion or restored backup | Receipts must retain declared meaning through lifecycle events | Retention/restore owner decision and later demonstrated recovery gate |
| Volume and abuse | Report bytes, long logs, event streams, pollers and multi-operation batches consume resources | Measured latency/resource/provider-cost budgets and enforced limits required before exposure; none invented or measured here |

This inventory deliberately includes realities absent from current UI/schema. Each surviving gap still uses the reuse/scope matrix; absence is not automatic permission for a new primitive. The original-loop material capabilities are represented in the analysis, but the full canonical ASER/Skills/MBT scenario corpus and every native writer/consumer have not been exhaustively inspected. Grey must crosswalk the complete required journey set, including GJ-01–49, to explicit actors, producers, consequences, recovery and evidence modes. The 14 hostile traces above are not that denominator, and neither Blue's groups nor planned QA case counts are executed coverage percentages. [C00; C05; B; M]

## 11. Authentic UI baseline and changed-versus-retained mapping

The supplied CI artifact is associated by the parent/Blue provenance with workflow `44641518877`, artifact `14586457890`, and source `288c89b36dd5e748621752a175f1f4bdaac7ec87`. I inspected the local artifact; I did not independently retrieve it from GitHub or rerun the workflow. The independently parsed report is failing: 19 total, 10 expected, 9 unexpected, no flaky/skipped, `ok=false`. The supplied archive hash is an external provenance assertion here, not a separately recomputed archive verification. [E]

I visually inspected `data/0cc12c4b3b43521ad2ec897d21b56e3db5637757.png` (SHA-256 `d844b3dec1fc37b5bec46832a68355409ff980559fa850eb72e956ef716a1212`). It shows the native Tesbo sidebar/project context and a Zyra conversation with one case already saved, one remaining pending-review candidate, selection count, native saved-target inspection, and a “No AI key” state. It is actual captured product evidence for that one frame, not a complete passing partial-save/retry journey. The matching `e27ee08c2df0a66170761fc600e6c824f0e0a441.zip` trace identifies `ci-smoke.spec.ts:837 › Zyra review close feedback preserves prior saves and distinguishes refused closes`, Playwright 1.61.1 Chromium, 1280×720, light theme, en-US, desktop/no touch. No After was captured by this reviewer. [E]

| Surface/consumer | Retained native ownership and presentation | Required changed semantics | Actual visual disposition |
| --- | --- | --- | --- |
| Tasks list/Kanban/detail | Existing Agents/Tasks home, native shell and scoped state | Source-neutral work kinds, no-model external/manual path, exact dispatch/assignment/report/retest states, real errors | Source snippets inspected; no authentic Before for all relevant states; BLOCKED |
| Shared case proposal review, including Zyra/chat/tasks/external candidate consumers | Existing native review and transactional selected-save seam | Stable operations, exact destination/base/postimage/dependencies, complete operation kinds and conflict/recovery | One actual Zyra partial-save frame only; other states and proposed changes BLOCKED |
| Test Case repository and exact detail/version navigation | Existing repository, suite/filter/column preferences, authoring fields and native versions | Exact historical target links and lossless field review; no new case repository | Detail redirect source inspected; full current repository Before/After not inspected; BLOCKED |
| Run drawer/full execution, Bug dialog and evidence | Existing Runs/Bugs/files and shared UI tokens; preserve both native execution entry points | Assertion/occurrence/correction meaning, visible side findings, no link-induced local/server failure assumption | Full interaction consumer sweep and actual Before/After not performed; BLOCKED |
| KB/Requirements/Skills/work views | Native canonical document versions, existing navigation and editor | Typed native authoring, candidate-versus-active guidance, independent acceptance and provenance | KB source and provider-only Requirements shape inspected; runtime views and recovery BLOCKED |
| Project settings and all environment selectors | Existing settings owner and native selectors | Stable typed target identity, snapshot meaning, lossless parser/serializer and all consumers | Name/URL source confirmed; real target variants and responsive UI BLOCKED |
| Modal/Drawer and indirect consumers | Existing shared components and design tokens | Correct dialog semantics, focus/escape/restore, scrolling and context-specific actions | Source inspected; keyboard/AT/mobile/dark/overlay parity NOT RUN; BLOCKED |

No source-inspired mock or historical October prototype is promoted to a current Before. The historical baseline and C00's own 1.4.12 correction reinforce this limit. Purple/QA must capture exact affected roles, data states, responsive layouts, overlays, errors, loading, draft recovery and shared consumers on the reviewed implementation build. “Keep” means intended retention of the native owner/control, not an unverified claim that every pixel or behavior will remain unchanged.

## 12. Admission, gates and portability disposition

| Decision | Individual recommendation | Evidence/gate still required |
| --- | --- | --- |
| Premise that reliable external QA handoff is needed | Survives | Actual complete native round trip remains unimplemented/unproved at this pin |
| Parallel QA/agent/review/KB/release platform | Reject | Surviving E/X/C/P alternatives defeat necessity |
| Existing-native extension and composition direction | Admit to Grey/White consideration | Preserve exact reviewed native protections; resolve scope, retention, migration and actor semantics in design |
| Concrete new persistent primitives | Not admitted by this receipt | Per-primitive failed-alternative proof with cardinality, lifecycle, authority, retention, producers and consumers |
| New protected executor/analyst publication grants | Block exposure | R02–R07 native final-guard, selected-operation, result and evidence constraints; real writer coverage |
| Governance/Skill/root/release authority | Block unresolved protected capabilities | Named accountable owner decisions and reachable trusted human action/recovery; raw authorized evidence intake remains separately scoped |
| Complete UI design/parity | VISUAL-BASELINE BLOCKED | Authentic relevant Before/After, complete changed/retained consumer map, QA/Purple evidence |
| Full original-loop acceptance | Not accepted | Task through external executor, immutable bytes, analysis/retest and exact selected native publication, opposite paths and recovery on one actual implementation pin |
| Current source remediation or later CI | Separate review | Fresh immutable head and relevant evidence; cannot close this pin's findings by assertion |
| Formal Red quorum | Pending parent grounding receipt/reconciliation | Root is actual grounding member; preserve this independent receipt and reconcile disagreements explicitly |
| Freeze/release | Not accepted | Grey/White, required specialist dispositions, same-revision reachable journeys, evidence/recovery/budgets and full applicable acceptance |

Gate B is complete **for this individual review**, with actionable findings and bounded evidence. This does not stall harmless specification clarification or source remediation already authorized elsewhere. It forbids using this receipt as if it approved a schema, executed the original QA workflow, activated governance, or released software. The next legitimate architecture step is Grey's independent full journey/opposite-case reconstruction and White's explicit admission decision using the raw receipts; it is not an implementation-first fait accompli.

The portability method is applied through a causal invariant: when a later consequential decision relies on an earlier fact, the fact's owner, exact consumed version, authority, evidence strength and recovery must remain identifiable. Positive conceptual cases include an original QA report supporting a native case change, a submitted KB version supporting method activation, and a server-observed source capture supporting release assessment. Negative cases include an unreviewed candidate read, an unexecuted task, and an absent source binding: none acquires the stronger consequence. A counterexample to universal approval is a raw failure report admitted while method activation is blocked. Unknown evidence, such as a missing external provider receipt, stays unknown. These materially different native owner families challenge the transfer without copying Nesberry nouns; they are conceptual portability evidence, not runtime cross-application proof. No new general rule, engine or registry is introduced. [M; C04 ASER-C01–06]

## 13. Primary evidence locator catalogue

All `S` references below are relative to the immutable source root `/workspace/scratch/fb086055b433/tesbo-review-baseline` at the exact commit in §2. Line numbers are inspection locators, not a claim of complete file audit. All `C` references are the original extracted archive files, not subordinate repository rewrites.

| Ref | Primary authority / inspected evidence |
| --- | --- |
| M | Under `/workspace/scratch/fb086055b433/assurance-method-inputs`: unchanged Red charter, review orchestration, `docs/policies/governance/POL-GOVERNANCE-ASSURANCE-PORTABILITY/v001.md`, `POL-GOVERNANCE-ASSURANCE-EVIDENCE/v001.md`. Red mandatory attacks/output/quorum, orchestration order and evidence modes, documentation-only portability/evidence constraints. |
| C00 | `/workspace/scratch/fb086055b433/tesbo-canonical-inputs/extracted-v1.4.28/00_README.md`: principles, historical reconciliations, accepted Bug/attempt rules and authentic-visual correction, v1.4.28 canonical/integration boundary. |
| C01 | Same directory, `01_PRODUCT_REQUIREMENTS.md`: original FR-001–087 and selected native-engineering/authority requirements. |
| C02 | Same directory, `02_WORKFLOW_AND_UX_SPEC.md`: task/assignment/report/proposal transitions, human and external paths, native surfaces. |
| C03 | Same directory, `03_TECHNICAL_DESIGN.md`: original proposed tables and architecture, §18 native-engineering integration and authority/evidence boundaries. |
| C04 | Same directory, `04_MCP_API_CONTRACTS.md`: original task/claim/report/analysis/review contracts, reserve/finalize/retry rules, ASER-C01–06. |
| C05 | Same directory, `05_IMPLEMENTATION_BACKLOG_AND_TEST_PLAN.md`: original phase/tasks and acceptance work, selected integration material; planned tests, not execution evidence. |
| C06 | Same directory, `06_IMPLEMENTATION_AGENT_BRIEF.md`: original completion boundary and native implementation constraints. |
| C07 | Same directory, `07_UI_DESIGN_TASKS.md`: native Tasks/report/review/retest and existing-surface design obligations. |
| B | `/workspace/scratch/fb086055b433/assurance-working/blue-a.md`, `blue-b.md`; permitted compiler record `/workspace/scratch/fb086055b433/Tesbooboo/docs/specs/agent-synchronized-engineering/reviews/2026-11-19-independent/blue-reconciliation.md`. Independent claims cross-checked as described; not all source claims inherited as verified. |
| S01 | Root, `Tesbo-Backend-Nest`, `Tesbo-Frontend`, and `sdk/playwright-reporter/package.json`; source declarations and selected repository agent guidance. |
| S02 | `Tesbo-Backend-Nest/migrations/V8_ai_generation_history.sql`, `V35_zyra_agent_tasks.sql`, `V58_actors_identity.sql`, `V65_mcp_agent_actor.sql`, `V89_zyra_chat_review.sql`, `V107_ai_generation_requests_system_actor.sql`, `V116_zyra_chat_sessions_soft_delete.sql`. Task/actor/retention ownership. |
| S03 | Backend migrations `V63_testcase_versions_snapshot_trigger.sql`, `V119_cycle_items_field_snapshots.sql`, `V140_run_history_fields.sql`, `V155_testcase_review_semantics.sql`; `src/legacy/approved-run-cases.policy.ts` fully read. Native version/backfill/review/attachment guarantees and limits. |
| S04 | `Tesbo-Backend-Nest/migrations/V157_native_testcase_proposal_review.sql`; `src/legacy/legacy.service.ts`: `stageTestcaseChanges` near 15599, `requireProposalAuthority` near 15692, `readTestcaseProposal` near 15736, `reviewedTestcaseOperations`, `zyraSaveAttempt` 20924–21042. Current—not obsolete alternative—apply path. |
| S05 | `Tesbo-Backend-Nest/src/legacy/legacy.service.ts`: `failLinkedExecutions` 8330–8405, `createBug` 8626–8703, `addBugLink` call near 9422, link parsing/validation; `src/mcp/mcp.tools.ts` native Bug handlers near 1537–1615. |
| S06 | `Tesbo-Backend-Nest/migrations/V84_automation_run_ingest.sql`; `src/automation/automation.controller.ts`; `automation.service.ts` current `recordResult` 477–638 and native approval-snapshot attachment. Dormant older automation tables were not assumed to be current runtime owners. |
| S07 | `Tesbo-Backend-Nest/src/auth/api-token-rest.guard.ts`; selected token/MCP resolution in `src/mcp/mcp.service.ts` (authorization and `callTool` near 320–400), `mcp-access.ts`, `mcp.tools.ts`; `src/common/testcase-publication.policy.ts`, `human-review-principal.ts`; legacy `workspace` near 2762, `requireProjectAccess` near 4010 and proposal authority. No claim of exhaustive auth audit. |
| S08 | `Tesbo-Backend-Nest/migrations/V156_knowledge_governed_snapshots.sql`; `src/legacy/legacy.service.ts` `submitKnowledgeDocument`, `lockKnowledgeReviewDocument`, `writeKnowledgeGovernedVersion` 13217–13290 and `reviewAiMemory` 13419–13455. Real immutable candidate/review snapshot reuse. |
| S09 | `Tesbo-Backend-Nest/src/storage/storage.service.ts`: inspected local/S3 put, key/path validation, exists, metadata verify, byte reads, access URL and delete methods. Storage capability is distinct from original-report contract. |
| S10 | `Tesbo-Backend-Nest/migrations/V145_graph_capture_history.sql`, `V146_project_source_bindings.sql`, related V147/V148/V153/V154 ownership inventory; `src/behavior-graph/project-source-binding.ts`, `graph-change-review.controller.ts`, `graph-change-review.module.ts`. Source binding/reader/controller and recovery wiring inspected; not a full Model Studio audit. |
| S11 | `Tesbo-Frontend/app/(app)/projects/[id]/agents/tasks/page.tsx`, `agents/tasks/[taskId]/page.tsx` selected creation/load/review/error branches; `testcases/[tcId]/page.tsx`; `settings/page.tsx` environment serializer; `requirements/page.tsx` provider/source shape; `lib/api.ts` environment type/parser near 885; `components/ui/Modal.tsx`, `Drawer.tsx`. Other execution/editor consumers inventoried or supplied by canonical/Blue evidence, not all fully source-read or visually checked. |
| E | `/workspace/scratch/fb086055b433/tesbo-ci-evidence/288c89b/home/runner/work/Tesbooboo/Tesbooboo/e2e/playwright-report-ci/index.html`, the PNG and trace named in §11. Local report parse and one visual inspection only. |

**End of independent raw receipt.** All twelve findings remain open at the inspected source pin. No runtime verification, implementation mutation, formal two-member verdict, complete source coverage, schema approval, architecture freeze or release approval is claimed.
