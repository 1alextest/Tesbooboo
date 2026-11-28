# Independent Grey / Purple / fresh-eyes EG review

## Original first observations — preserved before peer findings

Recorded 27 November 2026. These observations are provisional, source-only, and were written before receiving any other reviewer's findings. Later investigation and dispositions must be appended without rewriting this section.

**Pinned inputs:** Tesbo canonical repository `f92c3341eadc03f274becbead3b0f45d0a86539e` (PR295 working source); research repository `7539a739243167b2d6709df1d644bd5b955f6ffc` (PR315). The research artifact `docs/qa-orchestration/reviews/plugin-ecosystem-obsidian-review.md` has SHA-256 `d6ab77f7c903e9f0e8bd81d344e693da5f4764bd3e52e1e23fe27c884f14dc05`. Both working trees were clean when checked. No peer receipts or past role findings have been read. The canonical files declare proposed revision 1.4.47, not 1.4.49; a later supplied package may change this observation.

1. **Scope correction is explicit and useful.** The proposal lines 3, 7–9, 83–95 and 119 distinguish optional contribution profiles, reject a mandatory provider or execution mechanism, and avoid selecting Obsidian first. This is consistent with the supplied user intent; treating this as an Obsidian implementation authorization would be wrong.
2. **The most complete journey is still the source connector.** The proposal lines 125–187 supply concrete entry, preview, action, receipt, recovery and removal cases for Obsidian/Markdown. Other profiles receive categories and common obligations but no equally concrete user journey. Lines 119 and 193–196 properly call for unlike-profile qualification, so this is an explicit future proof obligation, not proof that the design already generalizes.
3. **Research breadth may not support a general ecosystem decision yet.** Lines 15–21 name one related AQE/Nagual/Quality Forge ecosystem plus Obsidian and a local bridge; lines 18 and 39 explicitly limit corroboration and effectiveness. Useful pitfalls are distilled, but mature independent host-platform precedents, their trade-offs, and evidence for successful operational outcomes are not yet established in this proposal. The user's reusable research-before-build practice also needs a recorded owner and evidence-completion condition beyond a one-off literature section.
4. **Canonical reconciliation is revision-dependent.** Proposal lines 214–220 say the scope correction is reconciled in a proposed 1.4.49 amendment, but the inspected canonical 00 header is 1.4.47 and its P-16 remains execution-focused; canonical 01 FR-058 and canonical 05 T-408 likewise remain execution integration. This may be missing supplied source rather than a defective design. Do not certify connected canonical integration against these pins.
5. **Lifecycle vocabulary is necessary but not an interaction contract.** Proposal lines 107–117 separate installed/configured/authorized/enabled/healthy and explain uncertain outcomes and removal. For someone discovering, enabling, upgrading, being blocked from, or replacing a contribution, the visible object, the responsible actor, the next action and return path remain to be specified across profiles. Do not reduce five independent facts to one green 'connected' label.
6. **Shared-credential and grant removal is a consequential boundary.** Proposal line 116 says remove extension-owned credentials without revoking resources shared by others, while preventing use under a revoked grant. The exact association and accountable ownership are not shown. A departing connection owner, a disabled extension and a revoked user grant can produce different user outcomes; the proposal's installer/connection/project-enable split at lines 66 and 205 is promising but not yet a resolved matrix.
7. **Integrity and review evidence are honestly bounded.** Proposal lines 13, 41, 45–49, 59, 161, 185, 214 and 222 avoid turning source inspection, a hash, advertised hooks, a proposed scenario or missing native sync into runtime acceptance. Preserve these limits in the final verdict.

## Review continuation

Pending focused inspection of the remaining canonical workflow, technical, API, implementation and UI owners. No runtime, browser, package installation, native Tesbo mutation, PR comment, feature implementation or repository edit is authorized or performed by this reviewer.

## Source-only review receipt — original investigation closeout

### Scope, evidence and independence

This is one independent analyst using Grey, Purple and fresh-eyes Elephant-Gold lenses. It is not three independently executed formal teams, a rendered-interface review, a human usability study, or overall release approval. The reviewed feature is an optional general Tesbo contribution capability. No provider, first plugin, distribution model, marketplace or execution/UI architecture is selected. The analysis reconstructs user jobs and future failure cases from the requested outcome and inspected text, not an assumed finished implementation.

The initial observations above were saved before peer findings. Afterwards the coordinator supplied the exact saved v1.4.48 canonical files, and the saved UX and Purple guidance. No peer review receipt was read before the findings below were constructed. Any later review of v1.4.49 is an informed delta and must be appended separately.

Read-only coverage: AGENTS.md and CLAUDE.md; the repository's evidence-grounded-decisions procedure; focused sections of all eight canonical files covering product boundaries, execution integration, native ownership, user workflow, authority, evidence, delivery and review; the complete 225-line plugin proposal; all v1.4.48 added product/workflow/technical/API sections and the supplied consequential-choice/review guidance. This is not a line-by-line audit of every historical paragraph in the 10,000-plus-line specification package. No product code path, deployed schema, real browser, actual plugin distribution or user population was independently tested. The external living application-baseline file was not supplied to this reviewer and remains a coverage gap.

Evidence classes: **document-confirmed** for what the inspected texts state or omit within the stated scope; **AI_HYPOTHESIS** for user or operational consequences; **UNKNOWN_OR_BLOCKED** for implementation, human comprehension and actual effect. No finding is an observed deployed incident.

### Artifact pins

Repository canonical source: `f92c3341eadc03f274becbead3b0f45d0a86539e`. Proposal source: `7539a739243167b2d6709df1d644bd5b955f6ffc`. The proposal's own implementation audit is an earlier, separately declared `63648aa2166cb456bae3ac6695d8dc0a4a475cc3`; this review does not silently advance that source evidence to a newer runtime.

The saved canonical delta is `/workspace/scratch/57132e18e2df/saved-canonical-v1.4.48/`. The coordinator supplied archive identity `6665ba660aa208bd35db51b90052fc0b69abc01c6922c197544003e3480b1bef`, saved version 33; this reviewer independently hashed its extracted eight files, not the archive itself.

| File | Repository f92c3341 SHA-256 | Saved v1.4.48 SHA-256 |
| --- | --- | --- |
| 00_README.md | `3daa0d35db9afce275942f436911f30faf5bf0c0ada5e2f09bed95d2f681c974` | `cab39d67d8e7967525b293322472b649cbad507b4f9367863aa8ad05a6354591` |
| 01_PRODUCT_REQUIREMENTS.md | `3c7c1d598cae7881ce86c6791044f08cc893a7fb91fb6455c6131d66c6aeb44c` | `58bc5ceb430f74df678a6047b8ec46b5cff0993253591758748eb073f61ec220` |
| 02_WORKFLOW_AND_UX_SPEC.md | `4bf3f743031f30ae5f5a98e2b1b9264859959ac710d94d131010ddbc11237e37` | `76a7571f9ecf887a0e04ec99569c29f68fcab89c1eff998faf8f34c547cd4924` |
| 03_TECHNICAL_DESIGN.md | `6ad966d7c43d538a2b5cfc067c45e49a3074135671956ee369a73598eabb1dbe` | `30e8f0a4a273e9ee4dc487cb724b4cc71c181e12ad8845850430c9ee8d2728c3` |
| 04_MCP_API_CONTRACTS.md | `ea1da80900225d32cc136d4f79b9b58effcaf161b201684f5431280ec08b2848` | `2b7c39debfa153578f2bbd6661440b84c892ba361fb3880b333e3be07519c37d` |
| 05_IMPLEMENTATION_BACKLOG_AND_TEST_PLAN.md | `916a055ffed3782a5f78703975497dd35ca706b9dfc7006e0cbafb7f533db89e` | `fe6ce0586a1c847f06bfc2ed967359f430a3ace904a5f5509ece86d68b59e47d` |
| 06_IMPLEMENTATION_AGENT_BRIEF.md | `d3c1b96d83151f087b0b772072d69192c8dcba0b5f4c6c74df24cc905214dd91` | `5fa0f5f17557d3550aa8ad9eb12e6d9d0887439a4121f6bcd9a3e2b14916cd20` |
| 07_UI_DESIGN_TASKS.md | `dea4a7d6e89f2e2499c54717b9b27eac1437da8d3213e0bf566b1e9e34ac3053` | `40c5f62c20f3398613afbcddb9f7edbc25c1c9b8d48d18f81a043982fe65a610` |

Method sources: AGENTS.md `eac635a4febf3cad1fa7eaa1ff544a1ae68a6a13f22d172aef780e06568f669b`; CLAUDE.md `28b88704ded3772166d1764ab686794d2a2972b55cc3b6f0e20921be5be21e47`; evidence-grounded-decisions/SKILL.md `abe304e7fe7aa2327c1e053c24499d3dc8d89b26e32a1b1ced0ac4e911111734`. Saved `UI_Assurance_Experimental_Skill_Draft.md` actually declares **v0.56**, SHA-256 `805d72ef968c3a1cda94453b090c346599672765849fd9816dcd88e19547d995`; saved Purple charter `b137fec36462e2ccc8cf0cafdb88e8cd3303bd702ad6618557100c446e1d41ee` expressly declares itself historical r3, not latest or binding. Its research methods inform the analysis; its unratified gate and registry prescriptions are not imported into Tesbo authority.

### Findings and proposed dispositions

Severity refers to the assurance claim or affected future implementation. **P1** means the affected admission/completeness claim should not close until addressed. **P2** means a material design or method refinement that can be resolved alongside bounded planning. None requires stopping unrelated authorized research.

#### EX-01 — P1: the claimed canonical reconciliation is not present in the supplied published inputs

**Evidence:** Proposal lines 214–220 assert reconciliation in proposed v1.4.49. Repository canonical 00 line 3 declares v1.4.47; 00 line 42 P-16, 01 line 139 FR-058 and 05 line 106 T-408 are execution integration. The saved v1.4.48 delta, 00 lines 885–901 and 01 lines 1213–1224, concerns dependency-aware coordination and bounded correction. It contains no new general plugin obligations. The proposal itself lines 3 and 161 correctly makes the eight canonical owners authoritative.

**Consequence:** An implementing reader could mistake a supporting research proposal for an approved or integrated plugin specification, or interpret FR-058's executor contract as the whole plugin contract. This is an input/publication mismatch, not evidence that the intended v1.4.49 design is absent from every work location.

**Disposition:** `EVIDENCE_BLOCKED` for the reconciliation claim until the exact amended eight files and their receipt are available. Correct the proposal's tense/status to match the actual artifact. Preserve P-16/FR-058's existing execution meaning and explicitly allocate general contribution obligations across the existing owners rather than relabeling the executor mechanism. A later exact-file delta can close the textual gap; it cannot close runtime proof.

#### EX-02 — P1 for affected profiles: retained plugin-created history can become unusable when the plugin disappears

**Evidence:** Proposal lines 92–93 allow product capability modules with distinct state and specialized UI; line 111 preserves original output or restricted metadata where retention is disallowed; line 116 preserves native history after uninstall. Lines 179–182 cover disable/removal/packaging for the illustrative source integration. None specifies how a permitted colleague later interprets a custom record or evidence format when its sole decoder/viewer is removed or incompatible. AGENTS.md lines 26 and 36 require preserved work and outputs usable by the next consumer. Canonical 02 lines 190–198 and 07 lines 28–29 and 149 retain native history and evidence ownership.

**G0 case / AI_HYPOTHESIS:** A specialist analysis extension writes evidence viewed through its own panel. A human approves a native case/result based on it. The extension is disabled after a host update. Another authorized reviewer opens the historical record from a native link: the bytes exist, but the decision basis is unintelligible or the viewer demands re-enabling unsupported executable code. A source connector with ordinary Markdown may not exhibit this problem; it does not falsify the different-profile risk.

**Disposition:** Extend admission for any profile that creates a persistent dependent artifact: name the historical representation owner, schema/version, authorized read/export path, essential semantics preserved without execution, and behavior on removal/incompatibility/retention restriction. A native fallback representation, documented export, supported migration, or a narrower admitted profile are valid alternatives. Preserve the original independently of derived display. Do not invent an obligation to execute obsolete untrusted code. The preservation principle is `ALREADY_DECIDED`; the implementation boundary is `DELEGATED` once a profile is selected; allowing irreversible loss of required usability would need explicit authorized product/retention judgment.

**Discriminating proof:** A permitted reviewer without the optional provider can inspect the required historical result and limitations after disable/uninstall/host upgrade; unauthorized readers remain denied; a missing original remains explicitly unavailable. Compare with a plugin-free native artifact. This is proposed and UNRUN.

#### EX-03 — P2: extension availability is not yet a complete choice and recovery workflow

**Evidence:** Proposal lines 66 and 205 distinguish installation, connection, project enablement and grants; lines 109 and 114 distinguish authority from installed/configured/enabled/healthy status; line 116 requires avoiding damage to shared consumers. The concrete actor scenarios in lines 165–183 are primarily source-integration scenarios. Saved v1.4.48 canonical 06's consequential-choice section and 07 lines 919–930 require a recognizable target, scope, consequence and original outcome. No concrete general lifecycle matrix shows who can resolve each blocked condition, or what happens when the person who supplied a shared account credential leaves.

**Consequence / AI_HYPOTHESIS:** An ordinary tester sees an enabled capability that cannot run, is directed to reconnect an account they do not own, or is told to uninstall/reinstall in a way that affects colleagues. Conversely a departed installer's grant may be assumed to invalidate an independently authorized organizational service, or to keep its own authority alive. The correct answer depends on the actual principal and credential owner; neither blanket policy follows from the text.

**Disposition:** Reuse current role/grant owners to map package administrator, external account connector, project enabler, invoking user/service, native reviewer and historical reader. For the selected profile, name legitimate entry, permitted action, bounded effect, independent readback, recovery owner and return context. Explain a missing capability without leaking private accounts. Define reassignment/reconsent where supported; preserve user work and unaffected consumers. Existing authorization semantics should be `DELEGATED` from source evidence; genuinely new cross-user connection authority is `HUMAN_REQUIRED` only for the affected profile. This is not a request to create a new admin role or mandatory central settings screen.

#### EX-04 — P2: overlapping contributions need deterministic, intelligible routing and default behavior

**Evidence:** Proposal lines 83–95 list multiple execution/analysis/report/UI profiles and line 108 requires named typed operations. Line 114 separates availability states. The unresolved-decision table lines 201–210 covers first profiles, installers, cardinality and distribution but not what enabling a second contribution for the same job changes. Canonical 00 P-06/P-16 and canonical 04 lines 431–435 deliberately keep analyst, executor, target tool and native authority distinct. The Skills resolver's precedence rules do not automatically define precedence for unrelated execution or UI contributions.

**G0 case / AI_HYPOTHESIS:** A project already has one admitted evidence formatter or analysis provider. An administrator enables a second, both advertise the same user job, and the tester resumes an old task. The source does not settle whether the default changes, whether existing tasks stay bound to the original version, whether the user chooses each time, or whether incompatible contributions are rejected. A last-installed-wins rule would be a consequential unrecorded interpretation.

**Disposition:** During unlike-profile qualification, make contribution identity, capability matching, user-visible selection, default changes and task/version binding explicit. Namespaced operation identity prevents collisions but does not itself decide which provider serves a goal. Reuse existing task binding and deterministic policy owners. Product owner chooses material default/auto-switch semantics only when a profile creates that choice. A one-provider admitted slice can defer coexistence with an explicit limitation; it cannot claim general multi-provider substitution proof.

#### EX-05 — P2: the research is useful, but a reusable engineering precedent practice needs broader evidence and a completion rule

**Evidence:** Proposal lines 15–21 identify Quality Forge/AQE/Nagual as one connected ecosystem plus Obsidian and the local bridge; lines 18 and 39 correctly reject independent corroboration and count-based effectiveness. Lines 29–59 contain valuable reported failure mechanisms and inspected limitations. AGENTS.md lines 16, 42 and 44 already own discovery, preventive learning and dependency evaluation; canonical 03 lines 414–418 already requires comparisons with existing code and no dependency. Saved v1.4.48 canonical 06 lines 826–837 describes causal distillation and governed learning. The supplied UI skill lines 52, 94 and 271–288 supplies transferable contrastive research and source-strength distinctions, and says the generic distillation procedure has an existing owner. The current plugin proposal has no mature independent general host comparison or measured operational-success study, and no task-level record of why research coverage is sufficient for this decision.

**Consequence:** A strong account of one ecosystem's pitfalls can dominate the architecture, while a reusable method becomes a collection of recommendations without a named trigger, owner, contrasting alternative or falsifier. Conversely mandating a fixed number of articles or review teams would add work without proving fit.

**Disposition:** Extend existing engineering guidance and work records, not a new service, ninth spec or competing taxonomy. For a consequential feature, state the desired user/engineering outcome, current owned capabilities and concrete unknown; investigate established comparable mechanisms, failures and successful outcomes where evidence exists; deliberately include an independent alternative and the no-new-dependency path; distinguish implementation documentation, author-reported lessons, independently measured effects and reviewer inference. Record applicability, trade-offs, negative evidence, chosen/rejected/unresolved options, accountable decision, smallest discriminating local proof and reopening trigger. Stop proportionately when the decision is supported or the evidence gap is explicit. Reuse relevant positive and negative lessons across implementation, API, data, reliability, testing, security, operations and UX; do not copy product-specific policy.

The research stage can be completed with an honest `no measured success evidence located in this bounded search`; it must not recast adoption, maturity or vendor documentation as measured success. Continued research needs no new feature-development permission. Selecting a dependency or consequential product policy retains its actual authority.

### External primary precedents checked in this review

These are targeted documentary comparisons, not an exhaustive ecosystem survey, installed-package proof or performance replication. Retrieval: 27 November 2026. All are official producer documentation; the observations below are documented behavior or limitations. Their operational or human-success effectiveness was **not measured here**.

| Primary source | Documented mechanism and useful comparison | What it does not establish |
| --- | --- | --- |
| [VS Code extension capabilities](https://code.visualstudio.com/api/extension-capabilities/overview) | Separates common, workbench, language/debugging capabilities and restricts direct access to host DOM. Compare declared host-controlled contribution points with fully customized UI. | A host process boundary is not proof of isolation suitable for a shared Tesbo server; the existence of an API does not prove Tesbo users will understand it. |
| [VS Code Webview guidance](https://code.visualstudio.com/api/ux-guidelines/webviews) and [Webview API](https://code.visualstudio.com/api/extension-guides/webview) | Advises using custom webviews when needed, preserving host theming/accessibility; API guidance requires restrictive capabilities/resources, CSP and sanitization and notes resource roots alone are insufficient protection. | No automatic accessibility or security qualification for an adapted Tesbo view. Each admitted rendering boundary and interaction still needs actual evidence. |
| [Atlassian Forge app versions](https://developer.atlassian.com/platform/forge/versions/) | Separates code/version rollout from permission consent and documents installation/version distinctions and upgrade limitations. Useful contrasting lifecycle precedent for changes that require renewed consent versus changes that can preserve it. | Does not choose Tesbo auto-update policy or prove that Tesbo should adopt Forge's major/minor rules. A version name is not a complete material-change test. |
| [Forge storage lifecycle](https://developer.atlassian.com/platform/forge/storage-reference/hosted-storage-data-lifecycle/) and [storage recovery](https://developer.atlassian.com/platform/forge/storage-reference/) | Distinguishes installation-specific storage, uninstallation, reinstallation, retained data and separately requested recovery; explicitly warns that retention is not an archive the app can read. This sharpens EX-02's distinction between storage retention and usable historical access. | Forge retention periods or support process do not become Tesbo retention policy. No measured recovery success or customer outcome is established. |

The coordinator should retrieve these primary pages directly before citing them in the final synthesis. Their live documentation is a dated observation rather than a pinned dependency version.

### Bounded G0 journey and proof inventory

These are analytical scenarios, not official Test Case IDs, actual user observations or test results. They supplement the proposal's detailed source snapshot cases; they do not select the first plugin.

| Actor and job | Consequential variant | Required outcome / current evidence |
| --- | --- | --- |
| Ordinary tester adds a useful capability to a project | Already available / denied / unsupported / plugin absent | Discover the supported operation and understand the legitimate next step; core manual/native workflow remains usable. Textual direction present; concrete general entry and roles unverified. |
| Account connector shares an authorized integration | Two project consumers; connector owner departs or revokes | Each action uses its actual current service/user authority; no forbidden continuation and no accidental loss for an independently authorized consumer. Exact selected-profile ownership decision pending. |
| Tester invokes an execution or analysis contribution | Read-sounding operation starts tests or external effects | Before effect, actor sees relevant scope and actual effect; existing execution authority applies; output is attributed to its actual attempt. Proposal lines 49 and 108 cover principle; runtime proof absent. |
| Project administrator upgrades a contribution | Added permission, harmless patch, changed renderer/schema, active old task | Material changes obtain required consent; harmless changes do not create needless interruption; old task and historical review basis stay identifiable. Version policy and actual mechanisms pending. |
| Authorized reviewer opens historical evidence | Plugin disabled, removed or incompatible | Required native meaning and permitted original evidence remain accessible with truthful limitations; no need to run obsolete untrusted extension. EX-02 unresolved. |
| Tester chooses among two eligible contributions | One unavailable; second available; existing task bound to first | Explicit supported selection/reconciliation, no silent change of task authority/provider or misleading completeness. EX-04 unresolved or expressly outside first admitted scope. |
| Reviewer or operator recovers a lost response | Same operation accepted once versus request never reached | Inspect original receipt before any retry; preserve failed/unknown and later successful attempt evidence separately. Proposal lines 111–115 and v1.4.48 contracts support principle; no execution credit. |

### Decisions and current dispositions

| Decision | Disposition and accountable owner | Scope blocked |
| --- | --- | --- |
| First user outcome, contribution profiles and provider | `HUMAN_REQUIRED`, product owner; explicitly unselected in proposal line 203 | Delivery priority and first implementation scope only |
| Distribution/hosting/executable or UI admission | `HUMAN_REQUIRED`, product and architecture/security owners; proposal line 208 | Only the selected boundary requiring the decision |
| Multi-account cardinality and actual connection delegation | Existing invariants first; new cardinality/delegation `HUMAN_REQUIRED` where no current owner resolves it | Expanded accounts/shared-connection behavior |
| Contribution choice/default/automatic substitution | `HUMAN_REQUIRED` only if the admitted profile presents the competing outcome; implementation wiring `DELEGATED` afterwards | Coexisting providers and default-changing lifecycle |
| Preservation of approved/native evidence and current authorization | `ALREADY_DECIDED`; choose lawful fallback/migration within existing authority | No permission to silently discard or overexpose data; actual mechanism still needs proof |
| Binding general plugin requirements to exact canonical package | `EVIDENCE_BLOCKED` pending actual proposed v1.4.49 files and dispositions | Claim that the direction has been reconciled in published canonical owners |
| Research and causal distillation method | `DELEGATED` extension of existing instructions under user intent; no automatic active-Skill promotion | No blockage to continued read-only research or review |

### Truthfully bounded verdict

**Useful supporting research with a corrected general-purpose direction; not an implementation-ready generic plugin contract or completed connected canonical review at the supplied pins.** The scope correction, owner reuse, effect-based authority, truthful uncertain results, native evidence and explicit nonclaims are strong and should be retained. No P0 or deployed defect was established. EX-01 blocks the textual reconciliation claim; EX-02 blocks admission of any persistent custom/UI profile that cannot preserve required historical usability. EX-03/04/05 are material refinements for the selected scope and reusable research practice, not reasons to require every plugin category or a marketplace immediately.

v1.4.48 improves consequence review, independent first-pass preservation, dependency-aware correction and legitimate continuation. It does not itself resolve the general plugin decisions above. **All runtime, UI/accessibility, human comprehension, deployment, installed-package and native test outcomes are NOT RUN or UNKNOWN.** No native Tesbo records were created or changed. Stopping point: enough source evidence exists to identify the named gaps and propose bounded checks; further implementation inspection should be targeted to the chosen contribution profiles and the actual amended canonical package.
