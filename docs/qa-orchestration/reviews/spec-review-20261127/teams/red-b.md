# Red Team member B — original review of Tesbo 1.4.49 C1

**Review date:** 27 November 2026  
**Reviewer identity:** independently dispatched agent `/root/red_b`  
**Assignment:** documentation-stage delta review of the frozen Tesbo general-plugin and evidence-informed-engineering proposal, including premise/analogy/abstraction attacks, valid alternatives, temporal/effect boundaries, and fixed-wording conceptual method-transfer probes.  
**Evidence mode:** read-only source and document inspection; limited official-document verification; conceptual counterexamples; executed document-integrity checks only.

## Disposition

**No material C1 defect was established within the inspected delta.** This member recommends continuing specification reconciliation with the candidate's **PROPOSED / BACKLOG / NOT FROZEN** status and its existing implementation gates intact. This is a single member's scoped conclusion, not a two-member Red verdict, pre-architecture clearance, White freeze, human approval, implementation authorization or release acceptance.

The candidate survives the main attempted falsifications because it does not require a new installed package, executable host, central plugin registry, common screen, provider-specific source workflow or additional approval owner. It separates desired configuration, admitted basis, effective state, observations, authorization and historical evidence. Its conditional native convergence requirements are supported by the source inspected below, rather than being presented as current runtime guarantees.

The method wording can generate discriminating checks in two non-plugin capability contexts without requiring the plugin solution to transfer. That is bounded conceptual admission evidence. It is **not** a comparative efficacy experiment, independent discovery of the original opportunity, or execution on another application.

## Independence, authority and frozen identities

I received a no-history assignment with the target paths, scope and unchanged methods. I did not author C1 and did not read preparation notes, another member's report, a team synthesis or a prescribed finding list before saving this original report. The candidate itself exposes historical judgments, explicit proposed solutions, selected research and prior evidence claims; I read those as required inputs. This is therefore an **informed delta review**, not blind opportunity discovery. The two conceptual contexts below were selected by this reviewer after reading the fixed wording and before deriving their case dispositions. I cannot establish what the author may privately have considered, and do not describe them as experimentally held-out tasks.

The task authorizes research/specification reconciliation, source reads and isolated document checks. The first plugin, SDK, marketplace, runtime, hosting/distribution approach and implementation priority remain unselected. No target database, native Tesbo writer, installed package, application test, UI session or production system was used. No protected authority is inferred from this report.

Input and method identity references:

- Frozen target: `review-candidate-v149/INPUTS.json`, candidate **1.4.49 C1**, SHA-256 `dd8fa57f48ebcfe054dc98c69215539ea669ac932136291a622f5fe123233bfb`; its 13 exact artifact entries identify the reviewed package. All 13 file lengths and hashes matched in this review.
- Baseline: saved eight-file v1.4.48 bodies under `inputs/canonical-v148/`; archive identity `6665ba660aa208bd35db51b90052fc0b69abc01c6922c197544003e3480b1bef`. All eight supplied deltas reproduced exactly from those bodies and the frozen candidate.
- Application source: `1alextest/Tesbooboo@f92c3341eadc03f274becbead3b0f45d0a86539e`. Reads used `git show` and `git grep` at that revision, not mutable working documents. Research parent recorded by the package: `7539a739243167b2d6709df1d644bd5b955f6ffc`.
- Methods: `NesberryEnterprise/Nesberry@d83549c85a4dcd047fb40dc4fba4ec62737ab0fc`, identified by `methods/recovered-methods-manifest.json` (SHA-256 `d8142db3e7b16ce6a144a48733ad9e17f2386ffe1ccef3f27cf936ed83d6b56d`). I read the Red charter v2.6, all of `review-orchestration.md`, and `POL-GOVERNANCE-ASSURANCE-PORTABILITY/v001.md`; all three recovered file identities matched that manifest. Their text was not changed.

Nesberry's historical nouns and local operating commands were not imported as Tesbo policy. The applicable obligations were reconstruction, reuse/compression, source grounding, counterexamples, authority preservation, and proportionate evidence. The current task is already-written documentation review; it cannot retrospectively satisfy the charter's earlier pre-design sequence.

## Actual inspected scope

### Frozen documents

I read `RUN_CONTEXT.md`, `INPUTS.json`, the proposed `source-manifest.json`, and **all eight complete `delta/*.diff` files**. This includes every new v1.4.49 section and the additional shared quality/transfer gates inserted into canonical 06's earlier method section. I did not read all historical content in the eight large canonical files.

The followed contract context was:

- Canonical 01, FR-054–062, especially FR-058's execution-agent scope and FR-059's existing external-client/no mandatory companion boundary.
- Canonical 03, the complete v1.4.47 execution trust/lifecycle/control section, plus the changed v1.4.49 section. This establishes the conditional credential, isolation, temporal authority, stopping and observability contracts on which the delta relies.
- Canonical 04, the proposed round-trip and no-agent-merge contract (approximately lines 47–84), and source namespace, revocation race and alternate-channel contracts (approximately lines 485–507), alongside the complete v1.4.49 delta.
- Canonical 05, the existing T-408 definition and the complete v1.4.49 proof/backlog addition.
- Canonical 06, the portable distillation method, original independent-review/experiment boundary and adjacent authoring/evidence context (lines 580–648), plus all affected method changes and the new precedent-transfer section.
- Frozen `AGENTS.md` lines 1–65: canonical engineering principles, current-package pointer and the new procedure reference; `CLAUDE.md` lines 1–48: rule ownership and relevant operating restriction; subordinate `skills-governance.md` lines 184–226: evaluation, portable method, canonical cross-reference and adoption boundaries.
- The full supplied `plugin-ecosystem-obsidian-review.md` (243 lines). Its claims about upstream AQE, Nagual and Obsidian code remain supplied research evidence; I did not independently audit those repositories.

Broad searches were used as navigation, not treated as complete file reads. Where a search or combined output was truncated, the substantive selected sections were read separately. Scope above names actual content inspected and does not claim full-package historical assurance.

### Source at f92c3341

| Inspected source | Scope and relevance |
| --- | --- |
| Root and `Tesbo-Backend-Nest/package.json` | Complete manifests; source/build context is an existing NestJS application with PostgreSQL, BullMQ and native modules, not an implemented generic plugin host inferred from the new prose. No dependency was installed. |
| `migrations/V47_integration_connections.sql` | Connection/OAuth schema and organization/provider uniqueness; migration text was also visible, but no database/migration execution was attempted. |
| `migrations/V72_integration_sync_pipeline.sql` | Complete file: project/provider/source identity, sync-run state, connection reference and one-active-run key. |
| `src/integration-sync/integration-sync.client.ts:1–205` | Actual `loadConnection` selection by organization/provider; current credential refresh ownership and connection-ID update. |
| `src/integration-sync/integration-sync.processor.ts:450–635` | Per-ticket processing, current-provider connection reload, source lookup/conflict target, native document write, human-comment distinction and RAG handoff. |
| `src/integration-sync/integration-sync.service.ts:550–635` | Successful-run cursor, enabled-mapping/live-connection discovery and native event/readback ownership. Additional targeted search located enqueue/disconnect owners; that search is not a full read of their implementations. |
| `src/integration-sync/integration-sync.types.ts` | Complete 68-line file: closed provider set and existing job payloads. |
| `src/skills/skills-governance.ts` | Complete 190-line file: approved immutable-version resolution, active assignment, conflict/unassigned outcomes, exact-basis digest, historical pins and stale/current distinction. |
| `src/mcp/mcp-access.ts` | Complete file: project consent, explicit scopes/tool allowlist and permission intersection. |
| `src/mcp/mcp.service.ts:178–214, 319–384` | Request-time current project/token/grant checks, dispatch restrictions, direct testcase publisher refusal and native handler delegation. This is not proof of all downstream protected-commit paths. |

No authentic running UI was captured. No changed UI implementation or mockup is supplied by C1, so an in-place visual parity assertion is not being assessed. Its future selected UI work remains subject to the unchanged baseline and user-evidence gates.

### Independently checked primary precedents

On 27 November 2026 I opened the official documentation for three mechanisms used in the proposal:

- [Backstage extension points](https://backstage.io/docs/backend-system/architecture/extension-points/) documents narrow public interfaces, duplicate registration handling, a singleton task-runner example and versioned replacement of breaking interfaces. Its addition-only design context does not establish revocation guarantees for Tesbo.
- [Jenkins plugin management](https://www.jenkins.io/doc/book/managing/plugins/) documents dependency-sensitive removal, continued operation until restart in the file-removal case, and retained configuration. This supports distinguishing a lifecycle request from effective removal; it does not prescribe a restart architecture for Tesbo.
- [Terraform plugin protocol](https://developer.hashicorp.com/terraform/plugin/terraform-plugin-protocol) distinguishes protocol compatibility from plugin releases and describes discovery metadata. This supports the separate compatibility dimensions; it does not establish compatibility of an arbitrary Tesbo adapter.

These are current documentation observations, not measured success outcomes or immutable product-version audits. The remaining cited vendor claims were not independently reverified here. Their status stays as supplied research with the candidate's adoption-time freshness gate.

## Reconstructed problem and independent attacks

The relevant jobs are: a member uses an optional capability to reach an authorized native outcome; a publisher supplies content or code; an appropriately authorized manager admits/configures/enables a selected contribution; a worker performs the permitted operation; a native reviewer decides protected changes; a reader interprets historical output; an operator reconciles failure. Those are capability descriptions, not new RBAC powers. The important truths already have distinct owners: integration/source identity, approved method and assignment, task/attempt, native result/evidence, current grants and review/apply decisions. A future contribution must fit those boundaries or demonstrate a genuinely missing responsibility.

My principal questions and dispositions follow. None was supplied as an expected finding.

| Attack | Evidence and counterevidence | Disposition |
| --- | --- | --- |
| Delete “plugin”: can the same user outcome use existing configuration, source upload, a content version or an external client? | 01 §1, 03 contribution profiles, 02's profile-specific journey and 06 step 4 admit those paths. Existing FR-058/T-408 cover executor exchange specifically. | The platform noun is not promoted into a new truth owner. No newly justified persistence primitive is being approved. |
| Does the extension abstraction force content into executable lifecycle, or every consumer into the same UI? | 03 permits declarative content or an existing remote API; 02/07 make connection/runtime concepts applicable by profile. A content import is distinct from approved effective Skill, and a report needs no vault. | Valid opposite siblings survive. No required uniform runtime, catalog screen or account connection follows. |
| Could one familiar vendor's successful product be treated as proof of Tesbo's design? | 06 requires causal limits and an alternative explanation; research labels documented mechanisms separately from reproduced results. The three checked primary sources support mechanisms, not measured benefits. | No success attribution established by popularity. Comparative effectiveness remains unproven and explicitly gated. |
| Does registration, verified signing or installation manufacture authority? | 01 §2, 03 contribution table and 04 authority groups retain native permission/approval owners. Current MCP source intersects credential/grant/tool scope, and Skills source requires approved versions and active assignments. | Candidate preserves the distinction. Actual future plugin enforcement is unexecuted. |
| Can a newly connected source silently receive an older connection's delayed work? | V47 and the client key by organization/provider; V72 and the processor's mirror conflict key omit a separate connection namespace. Existing job payloads likewise do not establish the proposed generation binding. C1 §“Source-connection cardinality” names the native migration/consumer gate rather than claiming the source already supports it. | Conditional convergence gate is supported. No observed production collision or introduced code regression is asserted. |
| Is “disabled” used to claim physical termination or reversal? | 03/04 fence stale native effects, retain uncertain external effects and require reconciliation; 02 forbids showing stopped merely because dispatch ceased. The preserved v1.4.47 contract already distinguishes these boundaries. | Correct design separation. Commit-time races and external stopping capability need later execution evidence. |
| Does removal erase relied-on truth or give an optional renderer permanent ownership of history? | 02/03 distinguish uninstall, purge, retained native history, missing rendering and current source-access revocation; 05 requires historical readback and no-plugin paths. | Native permitted history remains authoritative; access denial and evidence absence must stay explicit. Actual retention and renderer-independent interpretation remain implementation qualification. |
| Could a successful review activate the method or certify its value? | 06 and subordinate governance preserve proposal, implementation and demonstrated effectiveness separately; original outputs precede synthesis; 05 requires an incumbent comparison before improvement claims. | This review supplies only bounded conceptual/source evidence. No Skill activation or efficacy verdict follows. |

### Compression and Negative Design Proof

I attempted the charter's alternatives instead of treating a general platform as the answer:

| Alternative | Surviving use here |
| --- | --- |
| REUSE | Existing supported external client, built-in source integration, native record read/export, manual/core path. |
| EXTEND | A selected source mapping, native method/package metadata or existing contribution-specific contract only when the user outcome requires it. |
| EXTRACT | Possible later shared interface after unlike implementations demonstrate coherent shared invariants; no generic runtime extraction is justified by this review. |
| COMPOSE | Existing authorization, integration, task/result, Skills and evidence owners provide the outcome without a second approval or evidence system. |
| PROJECTION-ONLY | Availability/status/impact views may project native facts; a contribution listing does not itself require a new lifecycle authority. |

Several alternatives remain adequate. Therefore a new generic persistent plugin registry would **not** have passed Negative Design Proof on these inputs. C1 does not request that approval: it expressly leaves the registry/runtime unselected and requires the selected implementation to establish its gap. That counterevidence prevents treating this as a documentation defect.

### Temporal/effect trace

Consider a source contribution admitted under connection A, configuration generation 4 and grant G. A job is queued; a manager then disconnects/replaces the account and revokes G; an old job arrives after replacement. The current processor's organization/provider connection reload is insufficient evidence of binding the old job to A/generation 4. C1 requires the original connection/configuration basis and current authority at protected effects, with the applicable migration/consumer review. It would be false to mark the planned trace passed merely because incoming MCP authorization exists.

For an executor, instead place revocation after a remote action has committed but before Tesbo receives its response. Fencing a later Tesbo write can be correct while the remote effect remains completed or unknown. C1 preserves that outcome and requires attributed reconciliation; it does not promise a distributed rollback. For both traces the expected future discriminator is authorized new work succeeding, stale work producing no newly forbidden protected effect, and historical/uncertain effects remaining correctly attributable. **Both traces are conceptual and NOT RUN.**

## Fixed C1 method-transfer receipt

**Fixed wording:** canonical 06's “Shared distillation quality gate”, “Transfer and evaluation gate” and “Evidence-informed engineering and precedent transfer” as hashed in the input manifest. I did not revise the wording while applying it. Its operative structure remains outcome/current owner → comparable mechanism and contrary experience → conditional principle/alternative cause → target-specific adopt/adapt/reject/defer/no-change → observable check, owner and recheck trigger.

**Mechanism under test:** apparent similarity or reported success can lead an engineer to import a mechanism with incompatible assumptions. The method should preserve the target's outcome, causal uncertainty, legitimate alternatives and authority while deriving a refutable local check. It must not require a plugin, persistence, a particular interface or a public success story in every context.

**Origin regression retained:** the supplied plugin research supplies a known comparison: do not equate a separate extension process with a tenant security boundary, a signature with authorization, or an installation message with an effective native result. The C1 procedure requires the target boundary, observed evidence class and a discriminator before adoption. This is a replay of an exposed concern, not a newly discovered defect or independent upstream-runtime verification.

I recorded the following capability inventory, questions, oracles, expected and forbidden effects in the tool transcript before applying the selected conceptual cases. The cases are deliberately outside the origin plugin family; they do not inspect a real unseen implementation.

### Probe A — synchronous offline numerical conversion library

**Context and selection:** a library consumer needs a deterministic conversion with declared input units, supported range, rounding stage and error tolerance. Execution is synchronous and offline; there is no plugin host, remote grant, persistent record or external effect. This tests whether the procedure can accept a small existing computation instead of demanding platform machinery.

**Predeclared check/oracle:** compare the target calculation with an independently specified reference calculation and tolerance. Determine whether a mismatch is caused by premature rounding, an input-unit mismatch, an unresolved contract or the implementation. Required effect: preserve the declared numerical meaning; forbidden effect: use an incumbent or popular library's output as its own oracle or silently choose disputed rounding policy.

**Conceptual cases and results:**

- Defective case: the declared contract permits only final rounding, but the candidate design rounds intermediate values and its stated examples cross the declared tolerance. The fixed method identifies the contract/implementation gap and derives a boundary regression; merely citing a successful numerical package cannot close it.
- Conforming neighbor: the existing deterministic implementation preserves the specified precision and the independent reference agrees over the admitted domain. The correct decision is **no change**, retaining the existing owner and evidence; no new service or Skill is required.
- Valid alternative/exception: exact rational arithmetic, scaled integers or a supported decimal implementation can each be acceptable if they meet the same target range and tolerance. Uniform implementation is not the invariant. Persistence and retry checks are legitimately inapplicable to this pure computation.
- Competing explanation: the caller passed a value in a different unit, or the fixture assumes a different rounding rule. The method requires checking these before calling the algorithm defective.
- Insufficient evidence: the accepted unit/rounding contract is contradictory or unavailable. The result is **UNKNOWN / decision required** for that claim, while inspecting the current implementation and researching alternatives can continue. An unavailable public analogue does not require blocking safe local analysis.

**Transfer disposition:** the unchanged wording supports a discriminating, non-platform check and preserves valid deterministic/no-change results. No numerical code was executed; no accuracy or production benefit is claimed. The accountable owner is the target contract/library maintainer, not the Tesbo reviewer.

### Probe B — asynchronous warehouse label printing

**Context and selection:** a warehouse worker requests one usable parcel label. A service sends work to a separately operated printer; paper may emerge before an acknowledgement is lost. The physical output cannot be undone by rolling back a service record. This tests a different outcome and state/effect boundary from offline computation and from inert content admission.

**Predeclared check/oracle:** establish the approved one-label/recovery outcome, actual device job identifiers/readback capability and observable physical print evidence. Required effect: attributable completion or explicit unknown with a supported recovery path. Forbidden effect: blind replay after an uncertain physical effect, or a cancellation badge claiming the already printed paper was reversed.

**Conceptual cases and results:**

- Defective case: a transport timeout automatically resends the job even though the device may already have printed. The fixed method traces the effect, compares the claimed queue success with device evidence and identifies the unsupported exactly-once inference.
- Conforming neighbor: the admitted device supports durable job identity/readback; the service reconciles the original job before retry, and the worker sees completed or unresolved physical output accurately.
- Valid alternative/exception: a simpler printer has no such readback. Suspending automatic retry and routing a bounded check to the authorized operator can be valid. The rule does not force new device infrastructure or promise automatic recovery.
- Competing explanation: “no label seen” may result from a jam, delayed dispatch, a lost acknowledgement or a label already removed by another worker. An incident report alone cannot select the cause.
- No-change case: an existing spooler already meets the declared recovery contract with adequate attributable evidence. Preserve it rather than adding a second queue/registry.
- Insufficient evidence: the printer cannot be observed and job status is inaccessible. Preserve **UNKNOWN** and defer the completion claim; do not manufacture a failed-print result merely to justify resending. The operator's ability to complete legitimate work through an authorized manual route remains a target decision.

**Transfer disposition:** the same wording produces a concrete temporal/effect check and accepts a valid manual alternative. The actor's starting knowledge, action, visible status, downstream consequence and missing/recovery path are explicit. This is a synthetic design trace, not a printer test, human-behavior observation or evidence that the method will discover unfamiliar real defects.

### Limits of the transfer conclusion

Both unlike probes were selected by this reviewer and not copied from the supplied plugin scenarios. They are constructed conceptual cases whose answers follow from the stated contracts. They support the wording's applicability and rejection of overbroad interpretations; they cannot establish detection rates, false-positive cost, reviewer effort, effectiveness relative to the incumbent, universal portability or causal benefits. The proposal already requires a separately selected, independently graded comparison for those claims. No semantic correction was made, so no affected-case rerun was necessary.

## Findings, remaining gates and verification

**Confirmed C1 finding register:** empty. **Critical: 0; Major: 0; Minor: 0.** This is not an assertion that the existing product is defect-free or that every historical contract is consistent.

The following are retained implementation/assurance gates, not newly discovered C1 defects:

1. Select the concrete outcome and admitted profile, hosting/distribution model, permission powers and support/retention/recovery policy through their accountable owners.
2. If multiple same-provider connections or replacement-generation semantics are needed, qualify migration and every affected reader/writer, including delayed jobs, retrieval derivatives and current single-provider behavior.
3. Prove current authority at the actual protected boundary, uncertain remote effects, packaged entry-point/readback, permission refusal, dependency conflicts, upgrade/removal and history for each admitted profile. Request-time checks alone do not close these gates.
4. Obtain authentic existing UI evidence and later accessible interaction/human comprehension evidence for selected UI work. Nothing in this source review supplies them.
5. Preserve source-based review, conceptual transfer and real method effectiveness as separate results. Independent held-out comparison remains needed before the proposed method is called better.

**Checks actually executed:** Python standard-library byte-length/SHA-256 verification of all 13 frozen artifacts; exact reproduction of all eight unified diffs using the saved v1.4.48 bodies; hash/length verification of the three required recovered method documents. Results: **13/13**, **8/8**, **3/3**, with no mismatch. These checks establish identity and delta integrity only, not semantic completeness or runtime behavior.

**Not performed:** application/unit/integration/E2E execution; database inspection or migration; native Tesbo synchronization; actual plugin installation or invocation; OAuth/client round-trip; external physical-effect execution; UI screenshots/accessibility/human acceptance; method efficacy experiment; Graph execution or computed CLEAN. Broad source/consumer closure beyond the named paths remains unverified. This receipt cannot satisfy a full-system assurance claim.

This is the original member report. It is saved before cross-review and should remain unchanged; later informed corrections or dissent must be appended in a separate attributable addendum or separate file.
