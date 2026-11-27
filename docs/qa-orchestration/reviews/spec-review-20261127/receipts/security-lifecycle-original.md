# Independent plugin research and specification review — Security, Red, QA lifecycle and Operations

Date: 27 November 2026. Reviewer: `/root/plugin_patterns`, an independent delegated agent. This is one agent applying four review lenses, not four separate human approvals. Scope: documentation and public-source research only; no repository mutation, package install, runtime test, native Tesbo write, approval, deployment or release.

## Inputs and review method

- Research artifact: PR315 head `7539a739243167b2d6709df1d644bd5b955f6ffc`, `docs/qa-orchestration/reviews/plugin-ecosystem-obsidian-review.md`, SHA-256 `d6ab77f7c903e9f0e8bd81d344e693da5f4764bd3e52e1e23fe27c884f14dc05`.
- Canonical baseline available initially: PR295 head `f92c3341eadc03f274becbead3b0f45d0a86539e`, package header 1.4.47. I read its relevant technical-design revision 1.4.47 in full, plus the plugin occurrences and neighboring scope in all eight canonical files. Technical-design file SHA-256 `6ad966d7c43d538a2b5cfc067c45e49a3074135671956ee369a73598eabb1dbe`.
- Read `AGENTS.md`, `CLAUDE.md`, and the repository's candidate `docs/agent-skills/living-security-engineering/SKILL.md`. Applied canonical reuse, one-owner, evidence, permission, lifecycle, source-status and principle-distillation rules. The candidate skill was consulted as review guidance, not activated or approved.
- Searched primary sources across VS Code, Jenkins, Grafana, Backstage and HashiCorp; opened their current docs and selected official incident accounts. Technical observations below are source observations. Tesbo recommendations are reviewer inferences from those mechanisms and Tesbo's specified constraints. No vendor popularity, library use or advertised architecture is treated as measured efficacy in Tesbo.
- Challenged the research against three unlike profiles: knowledge intake, external execution/analysis, and optional UI/report contribution. Traced package identity → configuration → actual grant → dispatch → effect → evidence → update/revocation/removal. Compared shared lifecycle with contribution-specific obligations, including no-plugin operation.

## Phase A verdict on the actual research artifact

**Scope correction holds at the reviewed revision.** The title and opening explicitly make plugins general-purpose, supersede Obsidian-first prioritization, distinguish seven contribution categories, and leave runtime, first profile and marketplace decisions unselected. Obsidian is an illustrative journey. The historical branch/file name is not evidence that the written scope remains Obsidian-specific.

**Strong controls already present; preserve them.** The contract distinguishes declaration from enforced isolation, installation from current grant, input data from authority, prepared results from execution evidence, and uninstall from purge. It checks grants at dispatch and commit, fences queued work on revocation, preserves uncertain in-flight effects, retains historical data under its actual permissions, and requires unlike-profile/no-plugin qualification. It explicitly refuses to infer a generic SDK from MCP, a consuming MCP client from Tesbo's MCP server, or writer authority from current read-only OAuth pre-approval. These are substantial existing safeguards, not gaps to recreate.

The existing canonical revision 1.4.47 already owns most execution-security controls: credential brokerage, effect-aware authorization, queued/restarted-work fencing, current grant checks, independent observation, stop control, hostile-code isolation, bounded egress and honest external cancellation. General-plugin refinements should reference and specialize these owners. They must not introduce a second broker, scheduler, authorization or telemetry platform merely because the word plugin is new.

## Findings and dispositions

| Review finding | Evidence and consequence | Disposition / proposed correction |
| --- | --- | --- |
| SL-01 — Referenced canonical 1.4.49 review is not present in initially available PR295 head. | PR315's final section asserts reconciliation through PR295 and links `reviews/spec-review-20261127/README.md`; supplied PR295 is 1.4.47 and its changed-file inventory does not include that review. This prevents this reviewer from treating the link as proof of a completed connected review. It does not prove the saved package or review never existed. | **OPEN provenance reconciliation.** Parent is locating the saved canonical package. Bind the final claim to actually published files/receipts and exact revisions, or qualify it as pending. Do not inherit an unseen team's verdict. |
| SL-02 — Ecosystem research breadth falls short of the user's new engineering comparison request. | The research sources are valuable but concentrate on one related AQE/Quality Forge/Nagual ecosystem plus the illustrative Obsidian route. They are explicitly not independent corroboration. Broader primary precedent can falsify assumptions about distribution, dependency failure and trust. | **Coupled documentation improvement.** Add a compact comparison of distinct host models and official failures below, with adopt/adapt/reject/defer and applicability limits. No runtime choice follows. |
| SL-03 — Transitive dependency impact and version-level emergency containment need explicit plugin lifecycle treatment. | Existing contract pins dependencies and changes capabilities on upgrade, but does not expressly require dependency closure/impact preview, distinguish exact-version quarantine from whole-plugin disable, or prevent retries of revoked artifact generations. Jenkins documents dependency-removal boot failures; Microsoft documents post-publication version removal and delayed updates after a 2026 incident. | **Proposed qualification requirement, not a current runtime defect.** Before admitting executable distribution, evaluate dependency closure, state the affected installations/scopes, fence exact revoked artifacts and stale queued generations, and verify allowed unaffected work. Reuse existing task/grant generation controls. Select rollout/cooldown policy from the actual threat model; do not prescribe Microsoft's timing. |
| SL-04 — Upgrade rollback must distinguish code from data migration. | The research mentions compatible API/schema versions and incompatible upgrades, but offers no acceptance oracle for a migration that partially succeeded or makes the old code unable to read new state. Existing history preservation and uncertain-effect rules are relevant but do not themselves prove rollback. | **Proposed lifecycle clarification.** Qualify host API, plugin package, configuration and data-schema compatibility independently. Require a migration/recovery plan for selected profiles that persist state. A package downgrade is not a proven data rollback; block automatic re-enable when recovery is unverified. Preserve native history and offer explicit recovery state. No new migration is authorized. |
| SL-05 — Catalog metadata, report viewers and proxied credentials are part of plugin attack surface. | UI boundary admission is explicitly undecided, which is correct. Add concrete negative qualification examples so a read-only report or installation metadata path is not assumed harmless. Official Jenkins findings include unescaped plugin metadata and an Allure report path traversal; Grafana recorded cookie/token leakage through plugin proxies. | **Proposed tests under existing owner.** Exercise malicious metadata/rendered reports, unauthorized evidence paths, redirects and ambient cookie/header forwarding when the relevant UI/report/remote profile is selected. Use host-authorized data APIs and existing escaping/containment/egress owners. This is not a demand for a new UI runtime. |
| SL-06 — Integrity, publication and health are separate claims. | The research already says verification establishes provenance, not inherent safety, and separates health from enablement. Grafana's historical versioning flaw bypassed signature validation; VS Code's ongoing scans/blocklist respond after initial admission. | **Existing principle reinforced.** Require verification against exact distributed bytes and supported verification/version paths; record active artifact digest separately from catalog labels. Re-evaluate on update and revocation. A signature is not proof of safe behavior, and publication is not irrevocable trust. |
| SL-07 — Operational failure containment needs a concrete admission oracle. | Research Operations row covers freshness, backlog, failures, budgets and dependency health; canonical 1.4.47 already owns diagnostics, fairness and stop control. It does not yet demonstrate a faulty optional plugin leaves core QA and unrelated tenants usable. | **Proposed qualification scenario.** Bound latency, CPU/memory/storage, concurrency and retry cost for selected profiles; inject hang/crash/queue saturation and verify scope-limited containment plus native QA continuity. Record plugin/version/operation/attempt correlation without secrets or uncontrolled high-cardinality metrics. Thresholds remain workload-derived decisions. |

None of SL-03–SL-07 is a claim that the inspected implementation is exploitable. They are bounded proof obligations for a proposed capability. Some may already be resolved in the saved canonical amendment; reconcile them before adding text.

## Primary evidence comparison

### VS Code: useful extension boundaries, unsuitable authority default

Current [runtime security documentation](https://code.visualstudio.com/docs/configure/extensions/extension-runtime-security) says extension code has the application's permissions, including files, network and processes. It also describes dependency-publisher trust, package signatures, security scans and blocklisting. **Transfer:** explicit provenance, version-aware lifecycle and clearly described permissions. **Do not transfer:** desktop-user ambient authority to a shared Tesbo service; a separate extension host is not proof of a hostile multi-tenant sandbox.

Microsoft's [8 June 2026 supply-chain response](https://github.com/microsoft/vsmarketplace/discussions/1904) reports removal of an affected version within hours and says VS Code 1.123 added delayed auto-updates. This is an official incident response observation, not proof of perfect prevention. **Transfer:** trust and response continue after publishing, and installed versions need an attributable emergency action. **Limit:** Tesbo has not selected automatic updates or a marketplace; staged update policy is an option to evaluate, not a current requirement to build that infrastructure.

### Jenkins: dependency and retained-data lifecycle

The [plugin-management manual](https://www.jenkins.io/doc/book/managing/plugins/) warns that removing a plugin needed by others can prevent correct startup. Uninstall retains configuration, while removing old data is distinct. **Transfer:** dependency impact, separate disable/uninstall/purge actions, and explicit retained-history behavior. **Do not transfer:** Jenkins' shared-process or restart assumptions to Tesbo without evidence.

The [2 September 2026 security advisory](https://www.jenkins.io/security/advisory/2026-09-02/) records missing permission checks for credential-ID enumeration (CVE-2026-84674), path traversal in Allure report serving (CVE-2026-84669), and unescaped plugin metadata in update-center2 (CVE-2026-84677). These are documented vulnerabilities, not claims of observed exploitation. **Transfer:** authorization belongs at every actual endpoint, and presentation/metadata/file paths need adversarial qualification. **Limit:** the particular Java/Stapler mechanisms are not Tesbo mechanisms.

### Grafana: integrity and broker boundaries, plus a deprecated pattern

[Signature documentation](https://grafana.com/docs/grafana/latest/administration/plugin-management/plugin-sign/) distinguishes signed, unsigned, invalid and modified plugin states and describes verification at load. **Transfer:** make artifact integrity and refusal observable. **Limit:** signing does not supply tenant policy or certify behavior.

Grafana's [13 October 2022 security release](https://grafana.com/blog/grafana-security-releases-new-versions-with-fixes-for-cve-2022-39229-cve-2022-39201-cve-2022-31130-cve-2022-31123/) records plugin-proxy cookie/token leakage (CVE-2022-39201 / CVE-2022-31130) and signature bypass through a versioning flaw (CVE-2022-31123). **Transfer:** test exact version/integrity logic and credential/header routing at the real proxy boundary; do not rely on package status alone.

Current [Frontend Sandbox documentation](https://grafana.com/docs/grafana/latest/administration/plugin-management/plugin-frontend-sandbox/) explicitly marks that public preview deprecated, with removal planned in 13.4. It also documents exclusions and compatibility/performance limits. **Disposition:** reject adopting this deprecated mechanism merely because it appears in historical examples. Its maintenance change is a concrete reason to check current status before transferring a design. It does not show that every possible browser isolation mechanism is unsuitable.

### Backstage: ownership and scoping

[Backend plugin architecture](https://backstage.io/docs/backend-system/architecture/plugins/) separates plugin responsibilities and calls across public interfaces; the default can still put plugins inside one backend. **Transfer:** named owners and contracts. **Do not infer:** logical modules or network-style APIs imply runtime security isolation.

[Connection concepts](https://backstage.io/docs/backend-system/core-services/connections/concepts/) describes per-plugin credential visibility and explicitly says configuration scoping does not replace authorization. **Transfer:** separate configured connection, credential selection and effective operation permission. Tesbo's native grant/actor/project enforcement remains the owner; a manifest or matching configuration cannot confer authority.

### HashiCorp: explicit protocol compatibility

[go-plugin's README](https://github.com/hashicorp/go-plugin/blob/main/README.md) documents subprocess/RPC operation, protocol-version incompatibility handling, checksum/TLS options, and its reliable-local-network assumption. **Transfer:** distinguish package version from protocol compatibility and verify what happens when they disagree. **Do not transfer:** a Go runtime choice, local trust assumptions, or the claim that this RPC implementation is an Internet plugin service. Its use across HashiCorp products is evidence of use, not a measured Tesbo fit result.

## Discriminating qualification scenarios to reconcile with the canonical matrix

These are reviewer-proposed test purposes, **NOT RUN**, with no invented native Test Case IDs. Reuse equivalent cases first. Actor names describe required capabilities; they do not create new roles.

1. Verify an authorized manager sees the dependent consumers and retained-data consequence before disabling/removing a selected plugin, and the operation does not revoke credentials owned by another enabled consumer.
2. Verify a permitted user can continue core case/review work while an optional plugin hangs, crashes or exceeds its admitted resource budget; unrelated tenants and valid work remain usable.
3. Verify a plugin worker with a revoked artifact/grant generation cannot commit queued, retried or resumed work after an upgrade, disable or emergency quarantine; fresh authorized work has a positive control.
4. Verify a manager sees unknown/partial recovery after a failed migration and cannot silently reactivate incompatible old code as a successful rollback; original evidence remains attributable.
5. Verify a permitted report viewer can read authorized evidence while plugin metadata, generated markup, attachment paths and cross-project identifiers cannot execute code or expose unauthorized files/data.
6. Verify an authorized remote adapter receives only its intended credential and headers; redirects and destination changes cannot forward a Tesbo session cookie or another plugin's token.
7. Verify a verifier can distinguish installed catalog version from exact active artifact bytes and rejects a tampered, revoked or unsupported verification/version combination.
8. Verify an operator can identify the plugin/version/operation/attempt that failed, distinguish incomplete observation from a clean result, and contain only the authorized scope when diagnostics are unavailable.

## Distilled method for the engineering teams

Refine the existing canonical discovery/distillation procedure, not a new plugin-only framework:

**Find prior implementations and primary incident evidence for the mechanism; extract the causal invariant, check the assumptions that make it work, compare it with Tesbo's existing owners, and prove the proposed transfer at the boundary where it can fail.**

For a consequential design, retain a short record: outcome and risk → existing owner → primary precedent and version/date → observed mechanism/failure → evidence type and limits → transferable principle → context mismatches → adopt/adapt/reject/defer → smallest coherent change → discriminating test/observation → source-review and outcome-feedback status. A full research dossier is not warranted for a routine change already governed by a verified owner/contract; a documented no-change conclusion is valid.

The Grafana deprecation is a useful falsifying example: historical prominence does not establish present suitability. The VS Code host is another: successful desktop extensibility does not establish acceptable multi-tenant authority. No amount of source count replaces a context-fit argument or executed proof.

## Remaining review boundary

Phase B remains pending receipt of the saved canonical plugin amendment and any existing original team receipts. This report does not certify unseen v1.4.49 clauses or endorse runtime implementation. Native Tesbo synchronization and product execution were not attempted. The parent should reconcile these findings with the same canonical owners and publish only truthful review status.

## Phase B — informed reconciliation with recovered 1.4.48

This section preserves and updates the original Phase A findings; it does not rewrite the earlier evidence state. The parent recovered the saved eight-file package in `/workspace/scratch/57132e18e2df/saved-canonical-v1.4.48/`, described as saved version 33 with archive SHA-256 `6665ba660aa208bd35db51b90052fc0b69abc01c6922c197544003e3480b1bef`. I read the revision 1.4.48 amendment sections of all eight files in full and independently calculated these input-file hashes. This is a targeted connected amendment review, not a fresh line-by-line review of every historical clause in the package.

| Input | SHA-256 |
| --- | --- |
| 00 README | `cab39d67d8e7967525b293322472b649cbad507b4f9367863aa8ad05a6354591` |
| 01 requirements | `58bc5ceb430f74df678a6047b8ec46b5cff0993253591758748eb073f61ec220` |
| 02 workflow | `76a7571f9ecf887a0e04ec99569c29f68fcab89c1eff998faf8f34c547cd4924` |
| 03 design | `30e8f0a4a273e9ee4dc487cb724b4cc71c181e12ad8845850430c9ee8d2728c3` |
| 04 contracts | `2b7c39debfa153578f2bbd6661440b84c892ba361fb3880b333e3be07519c37d` |
| 05 backlog/proof | `fe6ce0586a1c847f06bfc2ed967359f430a3ace904a5f5509ece86d68b59e47d` |
| 06 agent brief | `5fa0f5f17557d3550aa8ad9eb12e6d9d0887439a4121f6bcd9a3e2b14916cd20` |
| 07 UI tasks | `40c5f62c20f3398613afbcddb9f7edbc25c1c9b8d48d18f81a043982fe65a610` |

### What 1.4.48 already resolves

The recovered amendment explicitly accounts for direct/transitive dependencies beyond produced values, current authority after waits, shared resources, combined checks, stale-result invalidation, dependency visibility, bounded no-progress correction, and immutable original attempts. Its contracts bind exact input/check/authority generations and preserve receipt-based recovery. Its team method also requires independent first passes before informed reconciliation. These are existing owners and should be applied to selected plugin profiles, not repeated as a parallel plugin coordination engine.

### Narrowed finding dispositions

- **SL-01 remains an evidence-link defect until publication is reconciled.** The recovered package is 1.4.48, so it still does not establish the referenced 1.4.49 review. Parent intends a new 1.4.49 amendment in existing PR295. Publish and bind actual receipts before asserting that reconciliation is present.
- **SL-02 remains a useful coupled addition:** primary precedent and official failure comparison directly address the user's request and add evidence that the AQE-centric research cannot supply by itself.
- **SL-03 is narrowed:** 1.4.48 already supplies dependency closure and stale-generation controls. Specialize the dependency identity to package/artifact/dependency versions and current per-scope enablement only when a selected distribution profile needs it. Preserve dependency impact inspection and safe uninstall; do not create new graph storage or universal automatic-update policy.
- **SL-04 remains the clearest lifecycle clarification:** package rollback, settings/schema compatibility and data recovery must be distinguished for stateful selected profiles. Existing correction semantics do not prove reverse migration works. The requirement is a recovery qualification, not immediate schema engineering.
- **SL-05 remains a useful acceptance refinement:** catalog metadata/report rendering/file containment and accidental host credential forwarding are concrete witnessed ecosystem failure mechanisms. Add selected-profile variations to existing authorization/evidence/egress tests; do not declare new native scenarios implemented.
- **SL-06 is sufficiently expressed at principle level.** Preserve exact immutable digest/provenance and add one verifier-negative scenario only if no equivalent current case exists. No duplicate security principle is needed.
- **SL-07 is covered in general by 1.4.47/48.** The remaining work is proof that a chosen optional plugin's failure preserves core and unrelated authorized work. Use the existing budget, observability and stop owners with a plugin fixture; do not add a second ops framework.

### Recommended minimal v1.4.49 additions

1. Keep the general-purpose contribution profiles and unselected product decisions already corrected in PR315.
2. Link the existing execution/authority/dependency controls; add only plugin-specific identity, dependency-impact and stateful-upgrade/recovery qualifications.
3. Add a short primary-source comparison with transfer limits and explicit reject/defer outcomes, including the currently deprecated Grafana sandbox.
4. Extend existing qualification owners with a materially different source/report or execution contribution, no-plugin continuity, incompatible/migrating version, hostile presentation/paths and proxied-credential controls as applicable. These remain NOT RUN and profile-dependent.
5. Update the canonical engineering procedure once so team reviews of all consequential feature work require proportionate prior-art/incident evidence and a demonstrated context-fit argument. Keep routine well-understood changes lightweight and avoid source-count quotas.

**Phase B verdict:** no newly identified blocking contradiction in the reviewed 1.4.48 controls; targeted plugin and engineering-method additions remain justified. This is not acceptance of an unwritten 1.4.49 amendment. No runtime, native run or human assurance result is claimed.
