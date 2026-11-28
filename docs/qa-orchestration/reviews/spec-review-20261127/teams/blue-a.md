# Blue A — original independent source review of Tesbo v1.4.49 C1

**Date:** 27 November 2026. **Reviewer:** `/root/blue_a`, documentation-stage Blue member A. **Original report:** frozen on first write; no other member report was read before this report. **Disposition:** support continued proposed/backlog reconciliation, with the two bounded improvements below. This is not a formal two-member Blue verdict, an architecture freeze, implementation approval, native human approval, or release acceptance.

## 1. Assignment and independence

Assignment received: act as Blue Team member A for a source-based delta review of the connected v1.4.49 amendment; read the frozen run context and manifest, unchanged Blue charter, orchestration and portability policy; independently reconstruct reuse, prior decisions and ownership against product source `f92c3341eadc03f274becbead3b0f45d0a86539e`; make no product writes or test runs; preserve this original report before cross-review.

This dispatch supplied no inherited author history, prior reviewer findings or intended conclusion. I received the task and on-disk inputs, then developed my questions from the charter. Required candidate reading did expose historical judgments, explicitly authored proposals and the research author's existing-owner/namespace analysis. Confirmation of those supplied observations is corroboration by source inspection, not blind discovery. The single-source rebinding qualification below was derived while following the actual disconnect/reconnect writers. This run is not a method-efficacy experiment or a held-out discovery test.

The decision reviewed is whether the amendment is a coherent, appropriately bounded proposal for general optional contributions and evidence-informed engineering. The user has not selected the first plugin, arbitrary executable hosting, marketplace, SDK, distribution model or implementation priority. Nesberry's taxonomy, commands and local business policies are not imported into Tesbo. No new permission follows from this review.

## 2. Exact inputs and method identities

Frozen artifact root: `/workspace/scratch/e50b253d95e4/review-candidate-v149/`. Product repository: `/workspace/scratch/e50b253d95e4/tesbo`. All application source below was obtained with `git show f92c3341:<path>` or `git grep` at that commit, not the mutable working documents.

| Input | Identity / verification |
| --- | --- |
| `INPUTS.json` | SHA-256 `dd8fa57f48ebcfe054dc98c69215539ea669ac932136291a622f5fe123233bfb`; independently recomputed, matches run context |
| `RUN_CONTEXT.md` | SHA-256 `85745aafdf1db007c7c595fd766a8f817b20613a8170ec7ae6e265cf3344b3d3` |
| Application source | `f92c3341eadc03f274becbead3b0f45d0a86539e`, independently resolved with Git |
| Research parent | Declared `7539a739243167b2d6709df1d644bd5b955f6ffc`; inspected the frozen research artifact, not an upstream checkout |
| Saved v1.4.48 input | Declared archive SHA-256 `6665ba660aa208bd35db51b90052fc0b69abc01c6922c197544003e3480b1bef`; the eight supplied delta files were read; archive recovery was not rerun |
| Method source | `NesberryEnterprise/Nesberry@d83549c85a4dcd047fb40dc4fba4ec62737ab0fc`, recovered under `methods/` |
| Blue charter v2.7 | `.kiro/steering/teams/blue-team-charter.md`; 21,977 bytes; SHA-256 `1d6d78da69b3c55533740005a48082b6fc5f27c620ce66f50917fd180523c816` |
| Orchestration | `.kiro/steering/teams/review-orchestration.md`; 45,630 bytes; SHA-256 `8fd41f22e1909afd48d8af95120d03a0f52e30a1bf9976a639fb6cca67bb4729` |
| Portability policy | `docs/policies/governance/POL-GOVERNANCE-ASSURANCE-PORTABILITY/v001.md`; 5,618 bytes; SHA-256 `33c69cba82f7d98773e85a30fa1afff15cc0dbcec0d88302a0295ce06e2c8524` |

The three method files were read and their byte lengths/hashes independently compared with `methods/recovered-methods-manifest.json`: all match. They were not changed.

All thirteen candidate files were independently checked for the manifest's byte length and SHA-256, with thirteen matches:

| Artifact | SHA-256 |
| --- | --- |
| `AGENTS.md` | `8ae63e3c1d2a763cbde8ea60e7155bfca86487e16ec4823784175a5fb122920c` |
| `CLAUDE.md` | `28b88704ded3772166d1764ab686794d2a2972b55cc3b6f0e20921be5be21e47` |
| `skills-governance.md` | `e587d6754c58c8de33f67fbb0277c8814c8575ce8359a336b8f92a0a55cb6375` |
| `source-manifest.json` | `702bb7c24023322e6ed9728ca90af87a001fb4964756fd3202f869e994753e27` |
| `00_README.md` | `3d8723750db6bb3caeeb776ffac31baaa93017ba3777ee3921a10226bce93d70` |
| `01_PRODUCT_REQUIREMENTS.md` | `a552c1c310b75895a8fe852c78ce163606b3fd619dc180af06e4c98b42ea9d36` |
| `02_WORKFLOW_AND_UX_SPEC.md` | `e0cb04ab8fdba94b79f18d46a184b417e49565c56ee3b50492988116ce0c3b25` |
| `03_TECHNICAL_DESIGN.md` | `a9230d4d7bb64efb4ba2e247e66d0254f069b5e8303ac802ee67927f7d6c60a8` |
| `04_MCP_API_CONTRACTS.md` | `e87f1e9ddb2ac70c17ad2d06d7538e49c838ec71a8c7df7e314a5c6370d3c6fa` |
| `05_IMPLEMENTATION_BACKLOG_AND_TEST_PLAN.md` | `ae7e1e160d8f10ad7c58fb56fc57fc05460784bc6475c8f65734a1a095481357` |
| `06_IMPLEMENTATION_AGENT_BRIEF.md` | `279edcd5d6b941a3cd35e3fc877748d875efd36a967143b5b00a0cd5db512c17` |
| `07_UI_DESIGN_TASKS.md` | `a17f91dadbcf3e22c3f420126303d2ca7921d44665911fa50df423c0adaf8878` |
| `reviews/plugin-ecosystem-obsidian-review.md` | `c93d89f7e2e233bc0ceceaa34bbd9fe366473e6fafa7b2567e2d11acf818a5e1` |

This integrity check proves correspondence to the supplied manifest, not completeness, correctness, approval or application behavior.

## 3. Actual inspected scope and evidence mode

**Document inspection:** all eight complete delta files, including every v1.4.49 section and the internal amendment to canonical 06's earlier distillation section. Read the full candidate AGENTS entrypoint, CLAUDE lines 1–75, the full source manifest, the full frozen plugin research review, and Skills governance lines 1–120 and 190–222. Historical contracts followed include README P-07/P-14/P-16/P-18; PRD FR-058 and source/publication/Skills excerpts; technical-design source-identity and ownership excerpts; canonical 03 v1.4.47; canonical 04 imported-source identity, ASER-C02 and v1.4.47–48; canonical 06 portable method, principles, adoption and independent-review boundaries. Searches located additional prior IDs and their consumers. I do not claim to have read the roughly two megabytes of canonical history end to end. Tool output truncation was recognized; important lost passages were retrieved separately and truncated searches do not support an exhaustive scope claim.

**Source inspection:** full backend/frontend package manifests, application-module wiring, V47 and V72 migrations, V97 disconnect migration, sync types, Skills resolver and MCP-access predicate; selected actual implementation sections in the integration client/service/processor, native legacy writers, MCP service, automation service/controller and retrieval consumer. UI inspection covered the full IntegrationsTab and redirect route; selected WorkspaceIntegrationConfig, ProjectIntegrationMapping and SyncStatusPanel handlers/state/render sections; root layout/fonts, first 95 lines of global tokens, and the shared Button primitive. Searches found controller/API and other existing ownership locations; unread callers are not certified.

Evidence levels used here:

- **DOC:** directly inspected contract text or supplied metadata.
- **SOURCE:** directly inspected code/schema at the pinned commit. This establishes source structure and control flow, not deployed execution.
- **TRACE:** a reasoned scenario against the inspected contract/source; no operation was executed.
- **UNKNOWN / NOT RUN:** unsupported runtime, UI, human or environmental claim.

No product test, application boot, package install, database query, external mutation, native Tesbo write, browser action or active Skill change was performed. No private credentials were read. Native synchronization is **not performed**. No new current-build screenshots exist. Runtime claims and Graph CLEAN remain unverified.

## 4. Independent problem model and decided ground

The core problem is allowing a person or authorized machine to add an optional way of supplying or consuming QA work without changing who owns source facts, governing instructions, official cases, publication decisions and observed test evidence. A shared label such as plugin does not make an imported note, an executable process, an approved method and a result renderer the same object.

The current source supplies concrete actors and powers:

- Workspace integration management belongs to a current workspace owner: `legacy.service.ts` 14887–14933 checks ownership, settles active sync rows, clears credentials and disables mappings while retaining history.
- Project content and automation readers/writers pass project access checks. `AutomationService.createRun`, `recordResult` and `closeRun` retain native cycles/executions and do not manufacture cases from unknown IDs.
- Skill approval and assignment require a trusted interactive human plus current project authority; `approveSkillVersion` and `assignSkill` distinguish those actions and bind exact version identity.
- An external MCP client requires an enabled project, current issuer membership, a current credential row, an approved client grant, applicable scopes and tool permission. A plugin manifest is outside that authority chain.
- A background worker consumes queued sync work. Its existing owner is the integration pipeline, not a prospective package registry.
- Operator/hosting responsibility is distinct from member choice and human publication. The future hosted execution or executable UI authority is not selected.

Material existing lifecycle facts are similarly distinct: integration connection versus project mapping; sync `queued → running → succeeded/partial/failed`; Skill candidate/submission/approval versus active exact-version assignment; automation run creation, result recording and closure; source document versus derived embedding versus human comment. Candidate plugin installation, enablement, health and compatibility are proposed dimensions, not current universal runtime enums.

The relevant prior decisions were preserved in the inspected amendment: P-07 exact human publication, P-14 one eight-file canonical package, P-16 replaceable execution layers, P-18 project-controlled external exposure, T-422/D-14 method governance, native Cases/Runs/Evidence and source identity. FR-058 already describes an execution-agent contract; it does not establish a complete installed general-extension platform. The candidate correctly keeps that boundary.

### Semantic Completeness Matrix

| Problem dimension | Evidence | Target representation / disposition | Owner or remaining gap |
| --- | --- | --- | --- |
| Optional useful outcome without a package | C01/C02/C05 v1.4.49; built-in integration and reporter source | REPRESENTED: admitted outcome plus existing/no-plugin alternative | Selected native module; first outcome remains unselected |
| Authority to read, propose, publish and execute | P-07/P-18; MCP and Skill writers | REPRESENTED ELSEWHERE and preserved | Native authorization/review; no package-granted powers |
| Identity over source/account/package changes | C04 imported-source key and ASER-C02; V47/V72/V97 | REPRESENTED, with conditional implementation convergence | Integration/source owner; sequential rebinding qualification should be clearer |
| Method import versus effective method | Skills resolver and human writers; C03 profile table | REPRESENTED | KB version plus Skill assignment; package import stays inert |
| Supported version and dependency composition | C01/C03/C04 v1.4.49 | REPRESENTED as proposed admission obligations | Concrete owner/transport/support policy DEFERRED until profile selection |
| Installation, requested action and observed health | C02/C03/C04/C07 v1.4.49 | REPRESENTED as separate facts | Existing scoped owner; generic runtime NOT AVAILABLE |
| Interrupted, replayed and revoked work | C03/C04 v1.4.47–49 | REPRESENTED as proposed effect-boundary contract | Per-operation transaction and external reconciliation; runtime proof NOT RUN |
| Retained history, derivatives and removal | C03 lifecycle table; disconnect source; source/retrieval ownership | REPRESENTED; uninstall is not purge | Existing retention/access owners; approved source-specific policy still needed |
| Resource contention and operational recovery | C03 v1.4.47 and v1.4.49; C04 resource envelope | DEFERRED numeric envelope, named admission obligation | Selected implementation's owner, measured workload and support limits |
| User comprehension and accessible recovery | C02/C07; inspected settings components | REPRESENTED, runtime/human evidence UNKNOWN | Existing native surface; authentic before/after evidence required later |
| Marketplace commerce and plugin monetization | No selected user outcome or authorization | INTENTIONALLY EXCLUDED from this amendment | No marketplace owner justified |
| Improved engineering effectiveness | C05/C06; research evidence classifications | DEFERRED / UNKNOWN, explicitly not established | Existing FR-124/T-422/T-453 evaluation work |

Negative-space checks considered single-source replacement, a content-only package, a report that reads no external source, an uninstalled external client, an unavailable renderer with preserved history and a valid no-change research result. None requires inventing a universal plugin process or a new business-record store.

## 5. Capability-Reuse Matrix and as-is ownership

Maturity labels apply to the requested capability. `PARTIAL` below means an implemented source-inspected subset exists; it does **not** mean deployed, exercised or complete. No entry is labelled BUILT+LIVE from source alone.

| Required capability | Existing owner | Maturity | Reusable | Extend | Extract | Missing / verdict / evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Scoped connections and credentials | Workspace integrations / `integration_connections` | PARTIAL | Organization/provider connection, encrypted-token paths, project mapping | Actual profile identity/generation and account migration if required | No demonstrated shared extraction need | EXTEND EXISTING SUBSTRATE; V47, V97, client 119–152, native callback/disconnect writers |
| Source sync, progress and recovery | IntegrationSyncService/Processor | PARTIAL | Native runs, queue, progress, bounded work, result accounting | New provider behavior only after effect/source fit | Not justified by plugin name | EXTEND EXISTING SUBSTRATE; service 86–171/270–278, processor 162–238/453–620 |
| Stable source snapshots and derived retrieval | Knowledge documents/version owner; RAG consumers | PARTIAL | Existing document identities, comments, embedding handoff | Namespace/configuration lineage and retained-access behavior as needed | No second knowledge store | COMPOSE existing source/version/permission owners; processor 579–613, C04 source identity and ASER-C02 |
| Governed method/content | KB identity/version + Skills resolver | PARTIAL | Exact approved immutable version, separate assignment and conflict detection | Imported package provenance/evaluation if admitted | No second method database | EXTEND EXISTING SUBSTRATE; resolver 1–190, native Skill writers 17356–17488 |
| External execution and observed results | Existing automation, cycles/executions, task/report contract | PARTIAL | Native run/result/evidence services and supported external clients | Selected adapter capability/packaged qualification | No independent result truth | COMPOSE; AutomationService 263–334/484–550/672–722; C01 FR-058 and C03 profile |
| Native effect authorization | Project access/MCP/interactive-review owners | PARTIAL for proposed profile set | Existing scope/issuer/grant/tool predicate and human-only publication | Selected queued/effect-boundary checks; no claim entry checks prove all waits | Not a package-owned permission service | REUSE owners and EXTEND verified boundaries; MCP service 178–213/319–383 and native Skill writers |
| Product/UI placement | Native module route, shared UI components and server action | PARTIAL | Settings, connection/mapping/recovery structure, Button/tokens/fonts | Actual selected states, permissions, errors and results | Only after concrete repeated need | EXTEND EXISTING SUBSTRATE; current-source UI map below |
| Report/export or analysis plugin | Native result/evidence and chosen analysis/report owner | SPECIFIED ONLY for contribution; source mapping incomplete here | Canonical result/evidence references | Selected delivery/redaction/analysis behavior | No generic report store justified | INSUFFICIENT REPO EVIDENCE — DO NOT FREEZE its implementation from this report; I did not inspect all report/export writers |
| General admission/lifecycle registry or executable host | No selected common owner/implementation established | SPECIFIED ONLY for proposal | May compose native owners without installed code | Only after two unlike profiles show missing common invariant | Not yet justified | No NEW PRIMITIVE JUSTIFIED verdict; missing generic source evidence is not proof of total absence |
| Evidence-informed method | AGENTS principles 1/4/14/15 and canonical 06 | SPECIFIED ONLY as refinement/effectiveness | Existing research/distillation/review records | Decision provenance, contrary mechanisms and recheck trigger | No new evaluator service | EXTEND EXISTING SUBSTRATE; no effectiveness verdict or active Skill follows |

### Reader/writer and historical sweep

The inspected source chain is workspace settings/UI → API functions → legacy integration routes → owner-checked connection writer; project mapping/manual or nightly trigger → existing sync service and queue → processor → provider ticket rows and project-scoped knowledge mirror → embedding enqueue, source-change event and notifications → mapping/status/knowledge consumers. The V47 migration deliberately collapsed old per-project Jira connections into one organization/provider connection. V72 already fixed the older globally scoped mirror key to project/provider/external-ID/role. V97 deliberately retained the connection row and related history on disconnect. A future migration must preserve those historical reasons; blindly returning to row deletion or assuming connection UUID identifies one forever-unchanging remote account would be unsafe.

The method chain is native candidate → submitted version → exact human approval → separately human-assigned version → resolver read inside the consuming protected transaction. Consumers include requirement bundles, selected case creation and existing native publication; source searches locate multiple resolver calls in `legacy.service.ts` rather than one isolated helper. The resolver rejects overlap instead of choosing whichever assignment loads first. Reusing its semantic owner does not mean its present single-match contract already implements every proposed composition policy.

The execution chain is project-scoped automation API → shared AutomationService → existing cycles/executions and evidence owner. `recordResult` rejects unknown native cases; status validation precedes attachment; closed runs reject later result changes; `closeRun` derives stored counts and reports mismatch. These are reusable native facts, not proof of any general plugin-host lifecycle.

The entrypoint sweep is intentionally bounded: native integration/Skills/automation routes and MCP dispatch were examined; all reports, every legacy operation, all caches, every background path and all UI consumers were not fully audited. No all-writers conformance certificate follows.

## 6. Orthogonal-axis and participation classification

Tesbo's evidenced axes here are native asset kind, operation/effect, scope/authority, revision/provenance, delivery maturity, and projection. Nesberry marketplace axes are inapplicable to this capability without a demonstrated exchange.

| Proposed noun | Claimed facts/invariants | Nearest sibling and Brand Deletion result | Winning classification |
| --- | --- | --- | --- |
| General plugin | Package provenance, admitted contributions, compatibility and effective configuration | Remove “plugin”: source intake, method import, external execution and report rendering still retain different native owners | Optional contribution/admission dimension across owners; not a new owner for QA truth |
| Obsidian connector | Scoped selected source, local-to-native handoff, source identity | Remove vendor: external source snapshot and optional synchronization remain | Source-integration profile; no platform-wide local vault or companion requirement |
| Method pack | Imported guidance, approved version and assignment | Package bytes cannot represent human activation; library availability cannot replace assignment | Delivery/content input to existing Skills governance |
| Analysis/report extension | Interpretation or rendering of authorized native evidence | It cannot own the test observation or publication decision merely because it formats them | Derived/projection contribution with admitted effects |
| Plugin installation | Admitted artifact availability | Does not mean external account connected, project enabled, grant valid or worker healthy | Distinct admission/configuration fact, concrete owner selected later |

### Participation Scope Matrix

| Relationship/context | Primary subject | Semantic role / source context | Attachment scope | Independent acceptance? | Canonical owner / projection | Runtime maturity / evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Selected source intake | Native source knowledge | Supporting input to authoring; external source creates the dependency | Source binding + snapshot + destination project | Source receipt is separate from artifact approval | Integration/knowledge; native source and draft links | Existing native substrate PARTIAL; proposed connector NOT RUN |
| Content-only method import | Candidate Skill version | Primary imported content, then supporting guidance only after assignment | Immutable version; separate context assignment | Yes: human version approval and assignment remain distinct | KB/Skills; library and assignment subviews | Resolver/writers source-inspected; package import SPECIFIED ONLY |
| External execution | Authorized task/run and observed attempt | Execution-only contributor to an existing QA outcome | Principal/grant + operation/attempt + exact target basis | Run admission/evidence and protected publication retain own gates | Task/Run/Evidence; report readback | Existing result API PARTIAL; chosen adapter/host NOT RUN |
| Report rendering | Authorized native result | Presentation/projection-only unless separately admitted export effect | Reader scope + exact native evidence references + destination if exported | Data delivery consent is not test approval | Native result/export owner; replaceable view | Full report writer sweep UNKNOWN in this review |
| Product/UI action | Selected native module operation | Projection and entry point; owning action determines effect | Native object and server-verified principal | Protected action keeps its own review | Module service; contributed panel/action | No plugin UI selected; source baseline partial, visual baseline blocked |
| Peer source versus optional package | Normal core operation | No contribution needed | Existing supported configuration/manual route | Existing gates only | Current native owner | Legitimate no-plugin alternative retained |

No commercial exchange-leg relationship is established by the requested capability; inventing a marketplace to satisfy a methodological example would expand scope. These differing attachment levels explain why one catalog screen or one runtime cannot yet define all contributions.

### Semantic consequence map

| User expression | Semantic truth / owner / scope | Authored, observed or derived | Consequences and mutation after reliance |
| --- | --- | --- | --- |
| “Install this version” | Admitted bytes, not operational permission; selected admission owner | Authored request plus verified artifact facts | No automatic project activation; changed bytes invalidate affected basis |
| “Connect this account” | Native external binding, credential custody and namespace | Authored target plus observed provider identity | Future requests must reference the correct source generation; old observations are not relabelled |
| “Use this method” | Exact approved assignment at native context grain | Human decision, resolved projection | Later assignment changes make dependent current work stale without rewriting historical method use |
| “The check passed” | Observed attributed execution, or separately labelled inference | Observation or inference, never interchangeable | Report rendering cannot fill absent evidence or approve a release |
| “Disable/remove” | Effective fence and supported resource action | Request, enforcement and external acknowledgement are separate | Retain completed receipts; uncertain effects need reconciliation; uninstall is not purge |
| “The plugin is healthy” | Fresh observation of an applicable capability | Observed/derived with freshness | Installation and old success cannot establish current readiness |

## 7. Current UI reconstruction and reuse limits

**SOURCE-INSPECTED / VISUAL-BASELINE BLOCKED.** No authentic app render, role fixture, viewport, keyboard/AT run or after image was captured. Exact visual parity and human comprehension cannot be approved.

| Current source | Observed behavior | KEEP / EXTEND / EXTRACT disposition |
| --- | --- | --- |
| `app/(app)/settings/integrations/page.tsx` | Redirects to `/settings?tab=integrations` | KEEP existing navigation; no duplicate plugin landing page justified |
| `components/settings/IntegrationsTab.tsx` | Fixed Jira/Linear/Notion providers, billing-dependent Linear presentation, owner-only disconnect, existing manage/configure links and connected-project display | KEEP scoped actions; EXTEND only selected provider/contribution facts; this is not an installed marketplace |
| `WorkspaceIntegrationConfig.tsx` | Workspace owner connection action, OAuth readiness, reconnect/error messages and optional return-project route | KEEP useful routing and context; EXTEND profile-specific readiness and actual permission states |
| `ProjectIntegrationMapping.tsx` | Single remote selection, provider-specific callbacks, shared SyncStatusPanel and native result navigation | KEEP mapping owner; EXTEND only if approved cardinality/effect changes require it |
| `SyncStatusPanel.tsx` | Existing queue/stage/partial/failed presentation; two-second active polling; live status markup | KEEP native run attribution; EXTEND freshness/error behavior where proposal requires truthful unknown state |
| Root layout, initial global tokens and Button | Local Inter/JetBrains font bindings, shared colors and button focus/disabled styles | KEEP primitives as source baseline; no full responsive/contrast/AT conformance claim |

**Counterevidence against blind “reuse unchanged”:** `IntegrationsTab.tsx` 79–86 converts each failed status lookup to `{ connected: false }`; `SyncStatusPanel.tsx` 39–50 suppresses polling errors. Thus merely importing those state handlers would not prove the amendment's separate unknown/stale/health claims. The selected design must preserve meaningful existing actions while extending truthful state presentation. This is a source-observed reuse constraint, not a newly reproduced production incident or an instruction to change unrelated UI in this documentation task.

## 8. Findings, counterevidence and recommended disposition

### PLUGIN-B-A01 — qualify single-source account rebinding independently of concurrent cardinality

- **Severity:** Should-Fix.
- **Category:** Completeness / Implementation-Grounding.
- **Status:** Open recommendation for the design/acceptance wording; no implementation authorized.
- **Finding:** C03 line 2121 names its connection/source migration gate conditionally on a selected connector needing multiple same-provider account/vault namespaces. C05 line 2336 exercises colliding IDs, reconfiguration and an old event only in the “conditional multi-source connector” row and says that case applies only if that cardinality is selected. A connector restricted to one active account can still replace account A with account B over time. That lifecycle needs explicit qualification independently of simultaneous cardinality.
- **Source evidence:** V97 intentionally keeps the connection UUID and history on reconnect. Actual Jira and Linear callback writers (`legacy.service.ts` 14773–14793 and 14864–14884) update `external_id`, credentials and destination on `(organization_id, provider)` conflict. The worker resolves a connection by organization/provider at execution (`integration-sync.processor.ts` 169 and 481; client 119–124). Mirrors upsert by project/provider/external-ID/role (processor 579–598). These facts show why connection UUID and “one active account” alone do not settle source-generation identity.
- **Discriminating trace, NOT RUN:** queue work against source account A; disconnect; reconnect the same provider to B, keeping one active connection; give B an external ID that also occurred in A; deliver an old A event. Expected: no mutation or attribution of A's work as B, distinct historical source basis, current authorized B work still succeeds. A no-change reconnect to the same evidenced account is a conforming neighbor; it need not allocate a new business source merely because credentials rotated.
- **Impact if overlooked:** implementers might treat “we support one account” as sufficient to skip this migration/identity proof, while their reused row and worker lookup cross a temporal source boundary. The report does not establish that a deployed collision has occurred.
- **Counterevidence / why not Must-Fix now:** the broader contract already rejects the bad result. C03's Configure/connect row says changed account is not a rename of the old namespace/authority; it requires generation fencing; C04 line 493 requires source namespace, and ASER-C02 preserves immutable binding configuration on observations. The overall requirement is present and no implementation is being approved. The gap is the narrower named qualification trigger and explicit proof row.
- **Recommendation:** state that source identity/rebinding qualification applies to source-account replacement as well as concurrent multiple connections. Add or broaden one existing acceptance row for sequential A→B replacement, delayed events and same-account credential renewal. Reuse existing source/connection work; do not introduce a new registry or mandate a particular schema migration without the source/deployment sweep.
- **Evidence level:** DOC + SOURCE + TRACE. Runtime confidence remains UNKNOWN.

### PLUGIN-B-A02 — refresh the changed subordinate view's current revision pointer

- **Severity:** Should-Fix (documentation consistency; nonblocking for retained proposal status).
- **Category:** Clarity / Consistency.
- **Status:** Open.
- **Finding:** `docs/specs/agent-synchronized-engineering/skills-governance.md` line 3 still says “this branch proposes 1.4.46” and that “the 1.4.46 candidate requires its own applicable review.” The same frozen changed file now directs the reader to v1.4.49's precedent-transfer method at line 200; the current source manifest identifies v1.4.49 C1 and the eight files carry that pointer.
- **Impact:** a reader entering through the subordinate Skills view receives two different answers about the current candidate and applicable review basis. This is especially undesirable where exact method/review revision is part of the contract.
- **Recommendation:** refresh the current-pointer sentence to the current proposed candidate, or use an explicit link to the current source manifest. Keep the historical v1.4.38/v1.4.46 bodies and original receipts at their original scope.
- **Counterevidence / limit:** the header explicitly identifies the file as subordinate to the eight-file package; the canonical source manifest resolves precedence, and the body does not claim runtime activation. This is not a second authority or a release blocker. The stale wording may predate the delta, but this connected amendment changes and republishes the view, making a narrow pointer correction appropriate.
- **Evidence level:** DOC; exact frozen text verified.

### Material claims challenged without a new finding

1. **“Plugin” as a new domain owner:** not established and not required by C1. The contribution model can reuse existing owners. A concrete new primitive still needs the charter's negative-design proof before freeze.
2. **Already-built general plugin platform:** not claimed. Fixed provider unions/UI and native module wiring corroborate the need to separate current integrations from a future generalized admission contract; they cannot prove total repository absence.
3. **Manifest/signature/installation as authority:** explicitly rejected. The native MCP and human Skill boundaries support the proposal's owner allocation.
4. **Measured success from famous precedents:** not claimed by the frozen research. It distinguishes reported experience, documented mechanisms, inspected source and independent reproduction. This member did not independently revalidate all external URLs, security support dates or package claims.
5. **Missing numeric workload budgets:** current stage defers a selected workload and runtime. C03 v1.4.47 and C04's resource-envelope contract retain the obligation before affected deployment. Do not treat unselected numbers as a defect now, or waive them later.
6. **Universal effectiveness of the revised method:** not established. C06/C05 expressly retain no-change, rejection, competing explanations and independent evaluation. This review supports source/document coherence only. The unchanged orchestration's bounded transfer-admission evidence remains required before a broadly adopted core obligation is called validated; these plugin examples alone cannot certify all engineering domains.

## 9. Unlike-profile traces and future proof gates

The following are conceptual contract traces, not executed tests or official native cases.

| Trace | Native chain and discriminator | Outcome of this review |
| --- | --- | --- |
| Content-only method package | Received bytes → native inert candidate → immutable submission → exact human approval → independent assignment → current resolver | Coherent composition. No executable host, account connection or automatic activation is necessary. Existing resolver/source supports the ownership seam; full package import is unverified. |
| Source snapshot with optional authored output | Authorized selected bytes → source namespace/snapshot → native knowledge → optional candidate → permitted human decision | Coherent ownership, with A01 qualification. Source metadata cannot approve the output. Manual source intake can be a valid no-plugin solution. |
| External execution | Authorized task/current grant → chosen external client → attributed attempt/evidence → native Run readback | Coherent proposed separation. Current automation source demonstrates native result ownership; distributed adapter, stop and current-effect authority need later real proof. |
| Optional renderer removed | Authorized native evidence remains; renderer is unavailable; source/native route exposed if actually supported | Correct conditional fallback. No promise that missing renderer equals lost evidence, or that fallback exists for every format. Runtime/user comprehension NOT RUN. |
| Precedent offers no useful advantage | Current owner satisfies outcome; contrary mechanism adds cost; decision records no change with reopen condition | Valid outcome under C06. An invented feature or mandatory implementation is unnecessary. |

Before any selected contribution is treated as implementation-ready, the actual owner must resolve its user outcome, hosting/effect/distribution scope, account/project/install authority, compatibility/support policy, resource envelope, retention and recovery. It then needs its complete writer/reader and consumer inventory, real packaged operation/native readback, both legitimate and refused actions, old/new version and source-generation cases, failure/replay/unknown-effect handling, existing-provider migration, and authentic current/after UI evidence where a current surface changes. Missing adapter or runtime evidence remains a scoped gate, not automatic absence or a global block on safe documentation work.

This amendment's source-based review cannot retrospectively satisfy Blue-before-architecture or the earlier White predesign gate. It cannot satisfy future human role acceptance, independent Graph computation or release review. Those boundaries are explicit in RUN_CONTEXT and consistent with C1.

## 10. Verification actually performed and member conclusion

Performed: read-only manifest/charter verification; independent Git commit resolution; thirteen candidate hash/length checks; source/path/capability searches; source/document comparison; conceptual lifecycle and unlike-profile traces; source-authenticated integration UI reuse map. The only written artifact is this report.

Not performed: product tests, native case lookup/publication/execution, runtime/queue/deployment checks, actual credential or plugin admission, authentic visual/keyboard/responsive/AT validation, human comprehension, external-package execution, method efficacy comparison, whole-repository absence proof or computed Graph CLEAN.

**Member conclusion:** no new Must-Fix requirement defect is established within the inspected v1.4.49 proposed/backlog delta. The retained native owners, stage boundaries and explicit nonselection of implementation are credible at this phase. Address or explicitly disposition PLUGIN-B-A01 and PLUGIN-B-A02 during reconciliation. Keep the current UI/state and partial-source coverage limitations attached to the receipt. A second independent Blue member and subsequent specialist/Graph/White reconciliation are still required for any team-level disposition; this report supplies neither quorum nor human approval.
