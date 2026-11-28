# Informed v1.4.49 delta review — Security, Red, QA lifecycle and Operations

Date: 27 November 2026. Reviewer: `/root/plugin_patterns`. This is one delegated agent applying four analytical lenses. It is an informed review following the preserved original `review-security-lifecycle.md`, not a fresh blind first pass, formal human approval, native Tesbo execution, remote publication or release acceptance.

## Exact reviewed input

Frozen directory: `/workspace/scratch/57132e18e2df/review-input-v49`.

Manifest: `candidate-inputs.json`, SHA-256 **`a8bbdab6f513d2591ed60c55c56f327dbf55bd4d40f64cf865f69a636cdc9406`**, phase `first-v1.4.49-candidate`. Recorded specification parent `f92c3341eadc03f274becbead3b0f45d0a86539e`; research parent `7539a739243167b2d6709df1d644bd5b955f6ffc`.

I independently recalculated the manifest hash and every listed file's byte length and SHA-256: **12 of 12 matched**. Inputs were not edited.

| File | SHA-256 |
| --- | --- |
| AGENTS.md | `cb5f766e04f62f399eec56ccb646937bf7e07a00df167ccbb9e485810171ae5e` |
| docs/agent-scope-discipline.md | `ff2aa9ea743e5bbff571ccfd76e2e009fbb52354d8692c55d775666113466a89` |
| docs/specs/agent-synchronized-engineering/AGENT_RULE_TEMPLATE.md | `f6c03f6d737d7e18c121b59c1ea2595076e1e873846a5e173481bde62231b861` |
| docs/qa-orchestration/00_README.md | `0cd095bc78cb2ff420335409bca0f33751ef091e790d1c2c0fe1bdaa72b9d104` |
| docs/qa-orchestration/01_PRODUCT_REQUIREMENTS.md | `c6bbda1de1863565b2f816fb509788593e7c143cb144786a52b967818318435b` |
| docs/qa-orchestration/02_WORKFLOW_AND_UX_SPEC.md | `5068d9c6093e8cf32482cc6d591f5cc438f0e09e6744d92d30b2766d5660a92f` |
| docs/qa-orchestration/03_TECHNICAL_DESIGN.md | `87645446c4260a84204e1cc3e199f3101b45e6d47ed351bab1f6212eef6cb4c0` |
| docs/qa-orchestration/04_MCP_API_CONTRACTS.md | `d18f8533f12074c55c236c222d4c52fb35f0816201b39b368ff30d31f5d2be6f` |
| docs/qa-orchestration/05_IMPLEMENTATION_BACKLOG_AND_TEST_PLAN.md | `572c9a8ea30aa5c6db7008faa6ab01c4f6f73611d3e1b3274849c8801a4941c1` |
| docs/qa-orchestration/06_IMPLEMENTATION_AGENT_BRIEF.md | `45e08d05e7c3bd6171ef8d1eb185d7added06934f32fd795686e60d5cc95965b` |
| docs/qa-orchestration/07_UI_DESIGN_TASKS.md | `269c16eeec336b912b50f600599579273192405d0452f135f4b41e48ccb344e0` |
| research/docs/qa-orchestration/reviews/plugin-ecosystem-obsidian-review.md | `9d40638a29b48049a50acb38b3089f887f194de45f52a0beee726337a121f9d9` |

## Method and limits

Read all eight new v1.4.49 sections in full; compared the three guidance-file deltas against their recorded specification parent; read the research's corrected native/review handoff and complete new ecosystem comparison. Used the earlier inspected 1.4.47/48 lifecycle, security and dependency contracts as the preservation basis. I mechanically compared each pre-v1.4.49 canonical body with the recovered saved v1.4.48 file: differences are the intended top revision/date pointer and one separating blank line. Historical substantive text is preserved in all eight files.

Rechecked the newly added Backstage extension/module and Forge version/storage evidence in primary documentation. The prior review already read the cited VS Code runtime/security, Microsoft incident, Grafana security/sandbox, Backstage scoping and HashiCorp sources. No source framework was installed or executed. No test count here represents product tests. This is a targeted connected delta review, not a fresh line-by-line audit of all historical specifications or all application code.

## Verdict

**The candidate addresses the original scope and research-method request coherently, with one narrow security/lifecycle clarification required.** The general plugin direction is separated from Obsidian, implementation priority and runtime choice. The new source comparison changes specific contract and acceptance decisions without copying another product's architecture. Existing authority, task, evidence, migration, dependency and operational owners remain in charge.

The remaining clarification is **SV49-01: planned dependency preview must not delay authorized emergency containment**. No other new material contradiction was identified in this review scope. This is a documentation verdict only; all plugin runtime and human-usability acceptance remains NOT RUN.

## New finding — SV49-01

**Severity:** medium documentation inconsistency / potential implementation trap. **Status:** OPEN on this frozen candidate. **Classification:** coupled refinement of existing v1.4.47 stop behavior, not a new runtime feature.

The new technical-design dependency paragraph says to calculate affected bindings, dependent capabilities and work **before update, disable, revocation or removal**. The new workflow step 7 and UI guidance similarly require impact presentation before commitment. Those universal formulations do not distinguish planned maintenance from emergency revocation when the dependency/catalog service or telemetry is unavailable or compromised.

The preserved technical design v1.4.47 requires manual emergency stopping to remain available when analytics is unavailable; its trusted stop/grant owner must be able to fence authorized future effects despite a failed worker. A new plugin preflight requirement could therefore be implemented as a gate that prevents the existing emergency action precisely when the metadata needed for the preview cannot be trusted or fetched. Saying unknown impact stays unknown helps truthful reporting but does not explicitly settle whether the action may proceed.

**Minimal correction:** apply dependency calculation and reviewed impact preview to planned lifecycle transitions. For an already authorized emergency containment action, explicitly inherit v1.4.47: use its trusted native stop/grant owner to fence the permitted affected scope promptly, record known and unknown impact and actual acknowledgements, and reconcile dependency consequences afterward. Do not add new emergency privileges, silently broaden the stop, fabricate physical termination or waive required audit semantics. Preserve ordinary transition concurrency checks.

**Proof refinement:** add a variation under the existing operator/availability or dependencies row where the plugin dependency inventory or optional telemetry is unavailable, yet an authorized scoped emergency containment still denies subsequent protected effects. Confirm the unknown impact/acknowledgement is visible, unrelated authorized work remains governed, and no unavailable observation is interpreted as successful termination. This remains proposed and NOT RUN.

**Exact locations in this frozen input:** canonical 03, v1.4.49 "Dependency and lifecycle specialization" (line 2121); canonical 02, v1.4.49 step 7 (line 1063); canonical 07, v1.4.49 transition paragraph (line 957). Preserved comparison: canonical 03 v1.4.47 effective stopping/monitoring (including line 2045). These line numbers identify this snapshot, not future revisions.

## Original findings reconciled

| Original finding | Candidate evidence | Informed disposition |
| --- | --- | --- |
| SL-01 — unsupported earlier 1.4.49 publication/reference | Canonical 00 and research handoff expressly acknowledge the earlier inputs stopped at 1.4.47/48 and do not retroactively validate the claim. They point to a successor review record. | **Textual correction holds.** Actual successor receipt inclusion and remote link readback are publication gates outside this snapshot; do not claim remote completion from this review. |
| SL-02 — independent ecosystem comparison | Research adds primary Backstage, VS Code, Microsoft, Jenkins, Grafana, HashiCorp and Forge sources with separate observation, inference, adoption and limits. Canonical 06 generalizes the method beyond UX/plugins. | **Addressed in proposed documentation.** Evidence type and causal limits are explicit; no measured Tesbo superiority is claimed. |
| SL-03 — package dependencies and exact lifecycle | Canonical 03 separates package/capability dependencies, work-unit dependencies and native assurance meaning; requires closure, conflict/multiplicity handling, version binding and affected-work fencing. 04 and AC-094 carry these into effect/receipt semantics and scenarios. | **Addressed at design level, subject to SV49-01.** No new graph owner or automatic-update policy is selected. Runtime proof remains open. |
| SL-04 — code downgrade versus migrated state | Canonical 01/02/03 and AC-094 explicitly distinguish package downgrade from data/schema rollback; require compatible rollback, forward repair or authorized manual recovery. | **Addressed at design level.** Actual migration/recovery depends on selected persistent profiles and cannot be called verified now. |
| SL-05 — metadata/report paths/proxy credentials | 03 prohibits ambient host auth forwarding; 04 treats metadata, markup and filenames as untrusted; AC-094 tests rendering, traversal and actual outbound bytes with valid controls. | **Addressed at design level.** Qualify each selected surface; source advisories do not establish a Tesbo exploit. |
| SL-06 — integrity versus permission/health | Exact artifact digest and current grant remain separate; observed health, installation and configured capability have separate evidence. Incorrect digest/protocol/dependency are explicit failure controls. | **Existing principle preserved and concretely applied.** No duplicate security registry. |
| SL-07 — fault containment and core continuity | 03 budgets initialization, invocation, background work and artifacts; AC-094 tests crash, timeout and exhaustion while core/manual QA and unrelated contributions remain usable. | **Addressed at design level.** Reuses prior stop/budget/observability owners; no new ops system is implied. |

## Additional safeguards that improve the proposed design

- **Collision behavior has an oracle:** a namespaced plugin can still collide on a contributed route, action, tool, renderer or singleton. Whole-set admission and explicit refusal avoid silent loading-order shadowing. An allowed multiple-provider control prevents turning safety into blanket denial.
- **Provider choice survives execution:** scoped defaults apply only to eligible future work; selected provider/version remains bound to queued attempts and history, and fallback requires its own admitted effects and authority.
- **Retained evidence stays useful:** preserving opaque plugin bytes is not enough. A persistent/custom-UI profile needs an intelligible admitted native representation, export/migration or an explicitly restricted profile, without executing unsafe obsolete renderer code.
- **Departure does not silently substitute identity:** expired/departed account authority pauses affected work, with authorized reassignment/reconnection and unaffected shared consumers handled separately.
- **Research stays proportionate:** canonical 06 permits a checked existing precedent, no-change outcome or a reason research is unnecessary; it rejects source-count quotas, unsupported causal claims and compulsory new systems. The independent-first-pass versus informed-review distinction is explicit.

These are useful design obligations and proof purposes; they do not establish application behavior, product comprehension or signed/reviewed publication.

## Source fidelity check

The security and lifecycle inferences are supported and appropriately qualified. In particular:

- [Backstage extension points](https://backstage.io/docs/backend-system/architecture/extension-points/) demonstrates duplicate action checks and the singleton-runner pattern; [modules](https://backstage.io/docs/backend-system/architecture/modules/) states initialization ordering and registration limits. This supports explicit conflicts/phase boundaries, not dynamic loading or multi-tenant isolation claims.
- [Forge app versions](https://developer.atlassian.com/platform/forge/versions/) separates installed code/version from consented permissions; [hosted storage lifecycle](https://developer.atlassian.com/platform/forge/storage-reference/hosted-storage-data-lifecycle/) limits access/recovery following uninstall. The candidate correctly avoids copying Forge retention periods or asserting a recovery success rate.
- [VS Code runtime security](https://code.visualstudio.com/docs/configure/extensions/extension-runtime-security), [Microsoft's incident response](https://github.com/microsoft/vsmarketplace/discussions/1904), [Jenkins management](https://www.jenkins.io/doc/book/managing/plugins/), [Grafana's security release](https://grafana.com/blog/grafana-security-releases-new-versions-with-fixes-for-cve-2022-39229-cve-2022-39201-cve-2022-31130-cve-2022-31123/) and [current sandbox status](https://grafana.com/docs/grafana/latest/administration/plugin-management/plugin-frontend-sandbox/) support the stated transfer limits. The deprecated Grafana preview is rejected as a presently selected mechanism, without asserting that all browser isolation is invalid.

No source-derived observation was promoted to a measured Tesbo benefit, a vulnerability in Tesbo, or an approved dependency. Remaining license/version/security qualification is correctly deferred until an actual candidate and profile are selected.

## Justified remaining decisions and next gate

The first real user outcome/profile, hosting and distribution model, executable/UI boundary, actual extension points, version/support policy, actor mappings and workload-derived operational limits remain implementation-admission decisions. Leaving them open does not prevent this design/method amendment. Existing authorized decisions can satisfy them without ritual new approvals. Runtime acceptance, human comprehension, native record reconciliation, signed publishing and protected review remain separate and unclaimed.

Correct SV49-01 at the existing owners, preserve this original receipt, and provide the changed input hashes for a narrow informed closure review. The current report does not pre-approve that future correction. No broader research or runtime test is necessary to finish this documentation review once the semantic issue and actual receipt/publication references are reconciled.
