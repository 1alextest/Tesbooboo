# ASER — Requirements v0.3 (governed human-and-agent delivery integration)

**State:** Draft for independent specification challenge. These are **proposed** requirements, not assertions that Tesbo implements them.

## R-ASE-01 — One change, many authoritative artifacts

When a project-bound agent or human initiates a feature/change/fix, Tesbo shall allow a single **Change Packet** to reference the originating user request/task, source binding, code revision, existing requirements, cases, documents, policies, defects, work items and verification evidence by **stable native identities plus specific revisions**. Packets are coordination metadata, not replacement artifact stores.

**Acceptance:** A reviewer follows change → requirement revision → approved or draft case → actual execution/evidence → code/PR without ambiguous IDs. A missing link is shown as missing, not fabricated.

## R-ASE-02 — Determine applicability, do not force updates

For each domain (requirements, test cases, manuals/docs, policies/rules, work items/bugs, files/evidence, and skills-governance resolution), Tesbo shall record a disposition: `proposed`, `approved`, `published`, `unchanged`, `not_applicable`, `blocked`, or `deferred`, with a reason/evidence reference for non-update outcomes and owner/reason for deferrals.

**Acceptance:** A CSS-only correction can properly mark policy `not_applicable`; a changed permission rule cannot be silently marked `unchanged` without comparing applicable sources.

## R-ASE-03 — Reuse-first source reconciliation

Before proposing an artifact, the agent shall be able to list/search relevant project records and their version/status, inspect authority, compare existing sources and use **update existing** whenever the canonical record already exists. Unknown identity stays unresolved rather than creating duplicates.

**Acceptance:** Replaying an agent session or switching to a second agent does not create a second requirement/manual/case for the same stable source identity.

## R-ASE-04 — Native requirements

Tesbo shall support authoring, browsing and revising **native requirements** without an obligatory Jira/Linear/Notion connection. A requirement has stable identity; title/description; normative acceptance criteria; state; owning project; immutable reviewable revisions; rationale/actor/source; and typed links to cases, policies, work items, code changes and evidence. Use/extend existing Knowledge Base and Requirements surfaces, not a second wiki.

**Acceptance:** Create native requirement, create a revised criterion, view both revisions, link exact case to exact requirement revision, and see stale/missing coverage. An external ticket remains attributable to its provider and cannot be overwritten by a native update.

## R-ASE-05 — Correct traceability semantics

A typed requirement-to-test-case relation shall be different from `sourceRefs` (authoring citation), `jiraIssueKey`/other external ticket keys, a generated draft, an execution verdict and actual product coverage. Reporting shall expose these separately.

**Acceptance:** A draft case linked to a requirement must not count as approved/executed/passing coverage. Archiving a case preserves history and removes eligibility for current coverage according to policy.

## R-ASE-06 — Cases and verification

Agent-generated new/updated cases shall begin as reviewable candidates and pass through Tesbo's **existing case approval** before being counted as eligible for protected test runs. Preserve steps, expected results, postconditions, classification, technique, reviewer views, source provenance and edit revision. Reuse existing Model Studio when behavior models apply; never require model-first development.

**Acceptance:** Source code change proposes a negative-path case and a regression update; reviewer can accept either, reject either, and see exactly which persisted approved case changed. An unapproved case cannot enter an approved-only run through REST/MCP/automation.

## R-ASE-07 — Manuals and technical documents

Tesbo shall distinguish internal staff/operator/admin/support/developer documentation from external/end-user/partner documentation and independently govern audience, access/exposure, authority and product/feature applicability; internal/external is not a two-value replacement for manual type. Each document subtype may resolve distinct approved skills. Tesbo shall support versioned user-manual content with audience/screen/feature applicability, preserved document identity, section-level diff where feasible, reviewer status, and links to affected requirement/behavior. Use the existing Knowledge Base as canonical document owner. Distinguish observed/verified behavior from documentation inferred from code.

**Acceptance:** Updating a user-facing workflow proposes an update to its existing manual section, not a second manual. A purely backend refactor may document `not_applicable`.

## R-ASE-08 — Authority-backed policies and rules

Policies include both internal governance/application-operational rules and externally-facing/externally-mandated policies. Distinguish audience, publication visibility, authority origin, jurisdiction and enforcement locus; external origin does not imply public exposure or agent change authority. Govern each applicable policy subtype with approved skill assignments. A policy shall identify its normative authority, scope, invariant text, effective revision/date, status, predecessor, change reason, decisions and implementing rule/guard/test links. A semantic change creates an immutable successor; a correction to metadata is recorded and audited. The agent may propose, but only an authorized principal can approve/activate it.

**Acceptance:** A proposed agent policy cannot silently supersede an approved one; a conflicting concurrent policy revision is rejected, not last-writer-wins. A policy without enforceable controls is visibly marked unenforced, not implied to be enforced.

## R-ASE-09 — Decision / policy / rule separation

Tesbo shall distinguish (1) decision and rationale, (2) approved policy/invariant, (3) product rule/enforcement. Maintain typed, directional links and versions; any unsupported target is an explicitly unresolved edge, not a successful link.

**Acceptance:** Reviewer can answer who authorized a permission rule, which version applied to a prior run, how it was enforced and which paths/tests must be re-reviewed after change.

## R-ASE-10 — Work items and issues

A task/issue/change request shall support a general work-item lifecycle with owner, reporter, type, priority, status, blocked-on, PR/commit, related records and activity history. Extend the existing project task board/Zyra task review where structurally applicable; Bugs remain the defect owner. A Zyra testcase-generation task is not automatically the canonical task for implementation.

**Acceptance:** Fixing an existing defect updates the existing bug/work item; creating a new implementation task does not create a duplicate bug or invisible shadow board.

## R-ASE-11 — Files and evidence

The existing Knowledge Base files/evidence service shall support authorized agent references or uploads as needed, preserve file identity, ownership, hash, storage verification state and revision/retention semantics. A metadata row does not prove a binary exists; generated output does not prove target execution.

**Acceptance:** Missing/unretrievable bytes are surfaced independently of metadata; a mismatched tenant cannot download/link the file.

## R-ASE-12 — Delegation without authority escalation

One parent agent may call or delegate to specialized QA/BA/documentation/policy/task subagents. Tesbo shall attribute submissions to the actual authenticated principal and optional delegated actor, retain the same parent Change Packet, enforce per-role tool permissions, and prevent one domain's agent from unilaterally publishing another domain's approvals.

**Acceptance:** A policy-drafting subagent receives no implicit permission to approve policy; its output remains a candidate with provenance.

## R-ASE-13 — Safe retries and concurrency

Every multi-artifact proposal shall carry a stable idempotency key; mutation of existing records shall require a base version/editRevision and detect concurrent changes. Cross-service partial writes shall produce durable per-artifact success/failure receipts with deterministic reconciliation. No blanket claim of transaction atomicity across independent stores.

**Acceptance:** Duplicate MCP call creates no duplicate requirement or case; two agents revising the same requirement detect divergence; a failure after case creation but before manual update is safely resumable.

## R-ASE-14 — Source, test and release truth

Capture independently: observed source commit/revision, declared expected behavior revision, case approval revision, run selection, execution result, agent report provenance, evidence-byte validity, deployed target build evidence and reviewer sign-off. Do not conflate these states.

**Acceptance:** Code passing local/unit/E2E tests does not change a production-deployment verification status. If the target build is unknown, show it as unknown.

## R-ASE-15 — Agent instructions as portable trigger

Publish a short, app-agnostic `AGENTS.md`/`CLAUDE.md` rule that fetches the exact active governing skills (including approved meta-skill when proposing a new skill), refuses absent/conflicting required assignments, and triggers applicable Tesbo updates for any development iteration, chooses the bound project securely, queries capabilities and existing records, respects authority/approval, records disposition of every domain, and closes with truthful links/gaps. Its content shall be phrased as general principles with context-sensitive decisions, not fixed Tesbo/Nesberry business answers.

**Acceptance:** Claude Code and a separate generic coding agent use the same project binding and can produce equivalent change-proposal receipts without hidden agent-specific state.

## R-ASE-16 — Enforced completeness signal

A PR/CI policy shall be able to verify that the change has a traceable packet and assessed artifact domains, or an authorized scoped exception, without requiring unrelated manual/policy edits. A prompt alone is not enforcement. CI shall independently verify refs, statuses and versions against Tesbo's authoritative API or an explicitly validated signed/exported receipt.

**Acceptance:** A change that modifies a governed rule but omits policy disposition is flagged; an absent/offline Tesbo connection yields `blocked`, not a false green check. The gate may initially be informational, with deliberate promotion criteria.

## R-ASE-17 — MCP/client compatibility

Tesbo shall expose capability/schema version and reliable deployed identity. Agent flow shall test tool availability and expected field contracts at runtime, and reject or degrade truthfully when the connected client cached an older catalog.

**Acceptance:** A source branch advertising a newer tool does not cause an agent connected to an older deployed 50-tool catalog to claim it used that tool.

## R-ASE-18 — Security, isolation and data stewardship

All reads/writes shall honor project/organization memberships, immutable skill history, server-only effective skill assignment and human-only governance/promotion, case approval roles, policy authority, KB ownership, token scope, active plan locks, confidentiality, input validation, audit logging and least-privilege uploads. The MCP facade shall call **native application services**, not update tables directly to bypass invariants.

**Acceptance:** Cross-project requirement link, stale update, unauthorized approval, attempts to forge source identity, and tool-call replay with modified payload are rejected and audited.

## R-ASE-19 — Change-impact and freshness

When the underlying source, policy, requirement or manual changes, the existing graph/change-review machinery shall identify affected linked artifacts and signal **review candidates** with freshness/provenance labels, including absent, uncertain and indirect links. A link is not proof of coverage.

**Acceptance:** Changing a requirement revision marks affected case mapping stale pending review; a change with no evidence-backed edge is not invented as a definite impact.

## R-ASE-20 — Observable work completion

The change packet shall contain an independently reviewable closeout summary: implementation status, applicable artifacts proposed/approved/published, actual tests run and results, untouched/unproven areas, blockers, approvals, and exact record/PR links. It must preserve unfinished work when the session ends or is handed off.

**Acceptance:** Another agent can resume from persisted Tesbo records, not ephemeral chat history, and does not treat proposals as final records.


## R-ASE-21 — One Skills Library, independent version streams
Tesbo shall provide a Skills Library, reusing governed KB/history ownership where proven compatible, with one stable skill ID, immutable candidate and published snapshots, explicit version/predecessor, content digest, creator/provenance, applicability metadata, supporting files, dependencies and version-specific evaluation. Agents can read authorized versions and **create new candidate skill identities or successor versions through MCP**, never modify an existing skill-version payload, published history or approve candidate status.

**Acceptance:** Agent creates candidate S1 and reads it back. An attempt to edit that candidate in place, edit published v1, or publish a candidate with the agent credential is refused. Creating proposed v2 leaves v1 active and unmodified.

## R-ASE-22 — Human-governed effective module assignments
Skill assignment is a first-class record **separate from skill identity/version**, with workspace/project scope, module/subtype/audience/context, pinned approved version, active/inactive, precedence/composition, effective interval, actor and review receipt. An approved but unassigned version is inert. An inactive assignment does not remove or invalidate the skill record. No automatic "latest" or agent-supplied override.

**Acceptance:** An agent proposing v3 does not affect active v2; human can approve v3 without activating it; only authorized interactive human action can change the binding or activation state, with exact audit history.

## R-ASE-23 — Machine credential non-escalation
No MCP tool or agent-callable REST path may update an effective skill assignment, activation, precedence, approval, trust root, or existing skill-version payload. This is true **even if the machine token was created by a project owner/administrator**. Interactive human governance requires independent trusted authorization/assent beyond token ownership; caller-supplied "human approved" assertions are untrusted.

**Acceptance:** An admin-owned MCP token cannot approve, assign or activate through either MCP or REST/GraphQL variants; all attempts leave state unchanged and produce auditable denials.

## R-ASE-24 — Governed meta-skill and nonrecursive bootstrap
A protected, human-approved Skills-authoring meta-skill shall govern new skill candidates. It requires purpose/scope, principle vs app-context separation, evidence, activation triggers, exceptions, false-positive cases, evaluation, authority boundary and counterexamples. Its approved root and its promotion mechanism cannot be overwritten, bypassed or self-promoted by an agent or candidate; detect invalid/self-referential dependencies.

**Acceptance:** Agent proposes a weaker meta-skill but cannot use its candidate to govern itself or authorize subsequent proposals; a required reference cycle yields an explicit error.

## R-ASE-25 — Exact resolved effective skill set before every applicable write
For each task/context Tesbo shall resolve active assignments deterministically based on authenticated project/workspace, module, subtype, audience, operation, phase, actor and applicable capability constraints. Return assigned version IDs, digests, basis and conflicts to the agent; pin them to candidate artifact and Change Packet. Unassigned/ambiguous/expired/revoked/incompatible resolution must be visible and handled by explicit project policy, never arbitrary fallback to a library draft or "latest".

**Acceptance:** Distinct internal-operator vs external-user manuals resolve their configured active skills; candidate/inactive skills are absent; unresolved conflicts block a governed write.

## R-ASE-26 — Skill composition with an enforceable precedence contract
Multiple assigned skills may compose only under a human-approved explicit rule (portable core, project adapter, specialized contract). Validate dependency DAG, incompatibilities, version constraints, root protections, context overlap and an approved precedence order. A project adapter may specialize but not weaken mandatory provenance, approval or authorization constraints. Semantic conflicts that cannot be mechanically resolved remain **BLOCKED for review**.

**Acceptance:** Two overlapping contradictory required skills do not produce an arbitrary winner; incompatible adapter/root versions cannot publish.

## R-ASE-27 — In-flight assignment drift, revocation and cache safety
A candidate records the resolved assignment set and content hashes at its authoring base; submission/approval/publication revalidates current effective assignments. On drift, revocation, permission change or stale offline MCP catalog, Tesbo preserves the candidate but blocks/requests reconciliation (unless a separately authorized exception permits it). Caches include project/actor/context/assignment version and invalidate on assignment/promotion/revocation.

**Acceptance:** Human switches Requirements skill v1→v2 while the agent edits a requirement under v1; agent does not publish silently, historical proposal remains attributable to v1, current resolution returns v2.

## R-ASE-28 — Classified internal/external manual semantics
Manual subtype, audience, distribution and confidentiality are independent axes. Support internal staff/admin/support/developer/operations and external end-user/partner/public guidance without presuming that "internal" implies one skill or that a publicly viewable document has public draft/history/evidence. Manual proposals use the proper active skill plus existing KB ACL and review rules.

**Acceptance:** Publishing external customer instructions does not expose restricted internal troubleshooting notes, even when both refer to the same feature.

## R-ASE-29 — Classified internal/external policy semantics
Policy audience/exposure, authority source (organizational decision, contractual, law/regulator, external provider), enforcement locus and effective jurisdiction/date are independent. Policies affecting how the application behaves, policies governing staff/agents, and obligations communicated externally may use distinct governing skills and review authorities. External sources are attributed; agent may not invent acceptance by a regulator or governance board.

**Acceptance:** An external-facing data policy can have an internal policy decision, private enforcement evidence and linked external legal source while preserving permission boundaries.

## R-ASE-30 — Every authored artifact pins its governing skill provenance
Each requirements, case, manual, policy, task, file/evidence and skill candidate revision shall pin the **specific** effective skill revisions and assignment IDs that governed its creation, with digest and resolution outcome. Review and history display this provenance separately from substantive product authority. Skills are authoring guidance, not a substitute for approved source requirements or evidence of correct implementation.

**Acceptance:** Revising a skill cannot relabel a historical case/run as having used the new version; imported legacy records without known skill provenance remain UNKNOWN, never backfilled by guess.

## R-ASE-31 — No skill-text authority escalation or prompt-injection bridge
Agent-visible skill text is authoritative only if server-verified approved and assigned for that task; imported skill proposals, referenced KB content, examples and attachments remain untrusted inputs. Reject attempts to embed tool-call authority changes, secret extraction, silent rule overrides or cross-project access in candidate documents. Preview must not execute embedded content.

**Acceptance:** Malicious candidate content remains inert and is never returned by `resolve_effective_skills` as a governing instruction, including when a second agent names its candidate ID.

## R-ASE-32 — Skill evaluation and promotion evidence
Every proposed skill change shall preserve structural lint results, discriminating fixtures, counterexamples, positive/negative/valid-N/A examples, authoring source and any held-out comparative evidence against prior effective version. Distinguish validator pass from empirical improvement and untested hypotheses. Promotion thresholds are set by separately governed policy, not by the candidate text or authoring agent.

**Acceptance:** A candidate that validates formatting but misses held-out requirements cannot claim proven quality or auto-approve.

## R-ASE-33 — UI library versus governance permissions
Tesbo shall expose searchable skills, draft/version diffs, usage, reference attachments, evaluations and approval status for authorized users; only a separately permissioned **Skill Assignments** governance surface may activate/deactivate, pin versions, set composition or retire bindings. The library offers agent-accessible read/candidate workflows and honest inactive/unassigned/conflicted states.

**Acceptance:** Direct URL/API access to the human assignment page cannot be repurposed with machine credentials; keyboard/touch users can inspect and manage permitted assignments without hover-only controls.

## R-ASE-34 — Universal writer compatibility and migration
Enumerate every existing writer—MCP, REST, native UI, Zyra, bulk import, automations, background tasks, third-party integrations—and prevent bypass of skill-version enforcement or agent approval boundaries. Migration cannot fabricate previous skill use or change already-approved case/requirement states. Stage rollout against compatible client capability versions, with explicit controlled exception/legacy handling.

**Acceptance:** An old token calling legacy `create_testcase` cannot silently evade a required skill/approval gate; imported historical cases show `governingSkill: unknown` if provenance is unavailable.

## R-ASE-35 — Skill governance linked to change impact
A new approved/assigned skill version shall signal candidate review of affected current artifacts and authoring workflows using the existing graph/change-review owner. No automatic mass rewriting, regeneration or retrospective invalidation of executed runs; current scope and historic usage remain distinct.

**Acceptance:** Requirement skill upgrade identifies applicable new writing tasks and review candidates, while pre-upgrade test executions retain their exact original evidence and verdict.

## R-ASE-36 — Skill lifecycle and scale
The proposal shall define bounded version/assignment scans, indexed contextual resolution, retry/timeout behavior, max payload/dependency depth, archive/revocation effects and measurable cache/latency budgets before code ships. When skill resolution fails or is unavailable, workflows remain safely resumable with explicit blocked/unassigned receipts rather than unverifiable publication.

**Acceptance:** A revoked skill or unavailable resolver cannot be bypassed by requesting an old cached version; failure handling preserves draft work and produces bounded diagnostics.


## R-ASE-37 — Change capture from complementary coding agents and source providers
Tesbo shall support multiple **optional** authenticated change observers, including coding-agent hooks where available (for example Kiro agent/file/task hooks), repository push/PR/merge provider events, CI status callbacks and verified deploy facts. One project may bind multiple repos/branches/releases with observed scope and version. Ingested events shall be idempotent, source-attributed, ordered where source supports ordering, and durable. A missing hook, unsupported client or failed provider event must not imply the application was unchanged; mark source freshness `UNKNOWN` or `STALE` relative to the latest verified provider revision. The hook is neither the security boundary nor the only way Tesbo learns of changes.

**Acceptance:** A commit pushed without any agent hook produces a visible unmatched change or missing-observation gap through the configured provider reconciliation; duplicate/out-of-order PR callbacks do not duplicate Change Packets; a deleted source binding cannot silently capture another project.

## R-ASE-38 — Verified agent activity and understandable progress
Tesbo shall provide one attributable human-readable activity timeline for an application change, using existing Zyra agent sessions/tasks, graph observations, native logs and authorized external agent event adapters. Each event explicitly distinguishes `tesbo_observed`, `provider_attested`, `agent_reported`, `derived_inference` and `unobserved`; record source, authenticated actor vs delegated agent, time, context/revision, status, retained evidence and privacy scope. Do not claim visibility into local/remote tool actions Tesbo never observed, reconstruct hidden agent reasoning or expose private context to unauthorized reviewers. Support liveness, interruption and unknown status without treating silence as success.

**Acceptance:** A BA can tell what request changed behavior, QA can locate actual test evidence, PM can identify the owner of a blocker, and security can inspect authorized tool events. A self-reported "tests passed" without a runner receipt remains unverified.

## R-ASE-39 — Task-oriented MCP context and composite operations
Tesbo shall extend the **existing** MCP registry with capability-discoverable, bounded project/context bootstrap and composite agent workflows over canonical native services, including a proposed change+requirements/case draft and a verified run-result/defect triage flow. These are **orchestration adapters**, not new independent writers or permission bypasses. Each underlying action shall be authorized and revision-checked, with a stable overall idempotency key and per-item deduplication, explicit committed/failed/not-attempted status and resumable receipts. Batch atomicity may be asserted only for records within an actual transaction; external service effects use a durable handoff/outbox.

**Acceptance:** One tool call cannot create a published case that an equivalent direct REST action would deny; failure after the requirement draft but before case linking reports exact partial persistence; replay with the same request key does not duplicate records; a changed payload with a reused key conflicts.

## R-ASE-40 — Independent cross-artifact consistency and contradiction checks
Before recommending publication or release, Tesbo shall be able to check typed relationships and discrepancies among *approved* requirements/policies, submitted proposals, source declarations/code observations, manual versions, test cases/models, tasks and run/evidence status. The analyzer is **read-only until an authorized proposal is explicitly created**; it must classify `confirmed_conflict`, `unresolved_conflict`, `missing_link`, `stale_reference`, `unknown_source`, `not_applicable` and `no_detected_issue` without pretending the last means complete correctness. A requirement inferred solely from code is an observation or candidate, not an approved independent oracle. Correct source owners, not the consistency analyzer, own amendments.

**Acceptance:** A coding agent implements a permission behavior forbidden by an approved policy; Tesbo flags the contradiction rather than generating a matching "requirement" and passing its own check. A missing requirement does not automatically prove one should exist or that the code is invalid.

## R-ASE-41 — One role-sensitive Change Workspace
The existing Tesbo project/Zyra/graph shall expose a single navigable, role-authorized view of the change, with common immutable record identities and revision links. Developer, solo creator, QA, BA/product, PM, policy/security, support/operations and authorized executive views use the same underlying records, customized to their decisions—not different record stores. Show observed agent activity versus self-report, dependencies, requirements/policy impact, test and documentation draft/review state, task owners, release blockers and next actionable review steps. A user must be able to drill into evidence and return to context without a raw log or a separate agent product.

**Acceptance:** Three role views on the same Change Packet show consistent revision IDs, differentiated visibility and no cross-role confidentiality leaks. A low-knowledge reviewer can answer what changed, why, who is accountable and what remains unproven.

## R-ASE-42 — Evidence-aware release readiness and human decision
Tesbo shall provide a **computed, explainable release-readiness projection** bound to a specific source/PR/commit, build/deployment candidate, approval and evidence scope. It shall distinguish `not_assessed`, `insufficient_evidence`, `blocked`, `ready_for_authorized_decision`, and `released_with_known_risks` (exact vocabulary reconciled with canonical eight), plus reason codes and freshness. Evidence inputs shall include approved expectation versions, coverage scope, case/run approval, executed selections and results, observed target-build identity, blocking defects, policy conflicts, unresolved changes, rollout/rollback plan and responsible release owner. A green CI check or count of linked cases cannot by itself make an application "safe" or verified. Original human controlled publication (P-07) stays in force pending any separately ratified amendment.

**Acceptance:** With no target-build proof or negative-path execution, readiness is insufficient/blocked even when unit tests are green. An authorized release decision pins current evidence and risk owner; changing a critical policy afterward visibly stales that decision.

## R-ASE-43 — Post-deployment verification and incident continuation
An application change remains traceable through deployment, post-deploy smoke/health checks, operational monitoring, rollback or fix-forward, and any subsequently reported production defect. Tesbo shall distinguish source change, PR merge, deployment attempt, successfully deployed build, test observations, incident and recovered state. An unavailable provider or missing telemetry yields `UNVERIFIED` rather than a synthetic successful release.

**Acceptance:** An agent's feature passed CI, deployed, then failed smoke: Tesbo links the precise build, regression, affected case/requirement/manual, incident owner, remediation and later retest. Pre-deploy success is preserved historically but does not imply post-deploy acceptance.

## R-ASE-44 — Delivery throughput, instability and human comprehension measures
Tesbo shall calculate or ingest **source-grounded** delivery measures with exposed source, denominator, scope, timestamp, missing data and confidence: change lead time, deployment frequency, failed deployment recovery time, change fail rate and deployment rework rate (DORA's five delivery measures). It shall additionally measure developer/BA/QA/PM time-to-understand a change, review burden, artifact freshness, unsupported agent claims, duplicate records and escaped defects when observable. No performance benefit may be claimed from created-document/testcase counts or by selectively excluding failed work; these measures are **descriptive**, not proof Tesbo caused improvement.

**Acceptance:** A failed deployment is counted in stability and recovery metrics, not excluded to flatter lead time. A sample project with no deployment integration shows `NO_DATA` and source limitations rather than invented zero failures.

## R-ASE-45 — Source and event semantics under failures
For relevant sources and agents, define receipt identities, source/event version, capability flags, clock skew, out-of-order status, event loss and retry/cancellation. Tesbo shall use native graph history and notification writers to deliver change candidates and review tasks with idempotency, dead-letter/recovery and observable queue age. Do not require an always-running local coding agent; provider reconciliation and manual resync must be possible where permitted.

**Acceptance:** A code change observed by provider after the agent process exited still appears in impact review; reconnecting two clients with the same event does not duplicate a requirement; dropped notifications remain visible as pending/failed delivery.

## R-ASE-46 — Privacy and least-privilege agent trace visibility
Tesbo shall distinguish operational trace metadata from optional sensitive prompt/tool payloads. Session logs, evidence, skill text, source snippets and externally linked files obey project/role/retention/redaction/access rules. Access to a high-level release summary does not grant access to private agent prompts, documents, secrets or protected QA evidence; collection and retention of detailed agent traces shall be configurable and bounded.

**Acceptance:** A PM can see a failed agent task and its owner without viewing redacted secrets or a restricted policy draft; cross-project reads and raw tool-event export are denied and audited.

## R-ASE-47 — Comparative acceptance, not copy-by-feature
Delivery of the first integrated Tesbo Change Workspace shall be validated against a real coding-agent workflow using an existing application and a direct QA management baseline (Qase/TestRail where available). Reuse complementary Kiro/Spec Kit/GitLab patterns only where actual compatibility and maintenance/security tradeoffs support adoption. Record measured effectiveness: successful user jobs, erroneous agent claims, human correction effort, time to understand/review/release, test completeness, incomplete-sync recovery, CI/deploy outcomes and costs. A source review or a prototype does not establish production improvement.

**Acceptance:** Two distinct authorized coding-agent clients can produce equivalent change receipts, and at least one BA/QA/PM review flow can be completed without manual record reconstruction. Any benchmark limitation is explicit.

## R-ASE-48 — No forced ceremony, no governance bypass
Agents may begin with spontaneous feature development, a defect fix, a requirement, an investigation or a policy change. Tesbo shall not require a formal model or approved requirement to be authored *before* any code edit, but must apply required authority checks before official publication/release, identify missing policy/requirement context, and preserve the approved test-case and skill-governance boundaries. Every change domain may legitimately be unchanged or N/A with evidence, and the user-facing workflow shall surface the smallest safe next action rather than forcing all modules to generate records.

**Acceptance:** A cosmetic patch does not create fake policy and manual updates. A security-sensitive change cannot obtain a green readiness badge merely because its case author used an approved skill.

## First integrated scenario matrix — mandatory implementation proof (proposed, NOT RUN)
| ID | Starting point | What must be independently observed |
| --- | --- | --- |
| ASE-FLOW-01 | Spontaneous Kiro/OpenCode feature implementation | Source/agent/project binding, versioned Change Packet, native requirement candidate and linked case draft using active skills |
| ASE-FLOW-02 | Coding agent stopped before calling Tesbo | Provider/CI source observer detects unknown/unreconciled change; no false current state |
| ASE-FLOW-03 | Two concurrent delegated agents | Same change identity, distinct actor and permission receipts, no duplicate official record |
| ASE-FLOW-04 | Agent reports successful tests without runner receipt | Report remains agent-reported, QA result unverified |
| ASE-FLOW-05 | Approved policy contradicts changed implementation | Independent discrepancy, approved requirement remains authoritative, no self-generated oracle |
| ASE-FLOW-06 | Composite MCP write fails after first item | Exact partial receipt, idempotent resume, same native authorization |
| ASE-FLOW-07 | BA, QA and PM inspect one change | Cross-role status consistency and confidential-source filtering |
| ASE-FLOW-08 | Test case linked to requirement but never executed | Current release not reported verified; coverage reasons readable |
| ASE-FLOW-09 | Skill assignment revoked mid-change | Candidate preserved, no unapproved promotion, stale/version conflict surfaced |
| ASE-FLOW-10 | PR merged without deployment | Production status UNKNOWN/NOT DEPLOYED, no fabricated release metrics |
| ASE-FLOW-11 | Failed deployment and rollback | Correct change fail/recovery/rework classification with referenced provider events |
| ASE-FLOW-12 | Native Copilot as an admin user | AI tool cannot perform human-only skill governance without exact independent human action |
| ASE-FLOW-13 | Low-risk solo coder and high-governance organization | Same product truth, different presentation and approval configuration, no security bypass |
| ASE-FLOW-14 | Support reports post-deploy regression | Accurate deployed build, incident, affected requirement/case/manual and retest lineage |
| ASE-FLOW-15 | Wrong project token or disabled MCP | No cross-project read, discovery, candidate submission or effective skill resolution |
| ASE-FLOW-16 | Lost hooks, out-of-order provider events, duplicate agent submission | Dedupe, freshness gaps, bounded retries and no false complete/approved records |

**Evidence gate:** these rows are implementation acceptance requirements, not executed tests or formal assurance-team verdicts. The canonical Tesbo eight-file package governs official FR/T/QA/AC numbering; this noncanonical ASER proposal must be reconciled before promotion.

## Skills governance executable acceptance scenarios (proposed, not run)
See [skills-governance.md](skills-governance.md) `SK-E2E-01..22` for the authorization, lifecycle, audience, composition, concurrency, stale-binding and malicious-candidate test contract. Those scenarios are required in the disposable-project gate; source-spec text alone is not execution evidence.

## Scenario-based cross-domain acceptance suite

| Case | Input | Must prove |
| --- | --- | --- |
| ASE-E2E-01 | New feature, no prior requirement | native requirement draft, linked draft cases, manual candidate, work item; policy assessed; reviewer owns publication |
| ASE-E2E-02 | Fix existing regression | updates same requirement/case/bug identities, preserves history and actual run scope |
| ASE-E2E-03 | Policy-changing authorization fix | authority-backed policy proposal, linked rule/tests, blocked activation until authorized |
| ASE-E2E-04 | Cosmetic-only refactor | defensible `not_applicable` for manual/policy/requirements; no fake docs |
| ASE-E2E-05 | Two agents edit same record | optimistic conflict, no lost update, visible reconciliation |
| ASE-E2E-06 | Mid-batch write failure and replay | no duplicate artifacts, correct partial receipts and resumable state |
| ASE-E2E-07 | Wrong project token or role | denial, zero cross-project writes |
| ASE-E2E-08 | Agent calls missing/stale MCP tool | explicit blocked/degraded state; no claims of update |
| ASE-E2E-09 | Evidence metadata exists, bytes missing | separate evidence unavailable status; no false verification |
| ASE-E2E-10 | Source version differs from deployed app | local test truth remains separate from deployment truth |
| ASE-E2E-11 | KB synced external requirement | remains read-only, no native overwrite; correct external attribution |
| ASE-E2E-12 | Unapproved case added to run | prohibited by backend regardless of writer surface |
| ASE-E2E-13 | Policy proposal rejected | old policy head stays authoritative; rejection/history preserved |
| ASE-E2E-14 | One agent delegates four disciplines | same parent packet; separate contributors, permissions and review receipts |
| ASE-E2E-15 | Existing source record removed/renamed | stale/dangling relation detected; no silent remap |

**Exit criterion:** Actual authenticated disposable-project MCP lifecycle + native UI + backend/DB tests must pass against the same relevant commit. External agent catalog and target deployment identity require separate verification. Independent assurance teams must review the **spec** without guided findings; no team review is claimed here.

**ASER context-extension note:** The seventh domain is Skills Governance. The earlier six-domain `ASE-E2E` scenarios remain required but are not sufficient for governed authoring; `SK-E2E` extends them, and every published artifact must pin applicable skill provenance. Approval of this proposal does not authorize changing the original eight Tesbo canonical specs without their own reconciliation and review.
