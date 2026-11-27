# Purple Team — Tesbo v1.4.49 C2 original source review

**Date:** 27 November 2026  
**Reviewer:** `/root/purple`, separately invoked Purple Team agent  
**Assignment:** independently review all eight canonical deltas and affected method changes for semantic/user-model integrity, truthful projection and actual UI-source fidelity; bind the unchanged Nesberry method to Tesbo; preserve an original receipt before cross-review.  
**Evidence mode:** SOURCE-INSPECTED, documentary comparison and bounded conceptual actor traces. No product, browser, native-record, database or deployment execution.

## Scoped conclusion

I found **no new blocking documentation defect in the inspected v1.4.49 C2 amendment**. Its distinction between package admission, account connection, project enablement, current permission, observed health and native results is appropriate to the inspected Tesbo owners. The amendment does not claim a shipped plugin interface or choose the first plugin. Its no-plugin alternatives and conditional implementation gates prevent a common catalog or installer from becoming the assumed user journey. This supports continuing specification reconciliation; it is not implementation readiness or UI acceptance. [C00:903–925; C01:1226–1239; C02:1053–1067; C07:947–957]

**One P2 advisory side finding remains in an existing native surface:** the project integration picker offers “Clear selection” but disables the only save control when the selection is empty, although the existing Jira API supports explicit unlinking. This was not introduced by C2. It matters when qualifying reuse for project-scoped disable/removal, and should be routed to the existing integration UI/API owner. See `PUR-C2-S01` below.

The acknowledged account-replacement and synchronization effect-fence limitations remain open. Source inspection supports retaining them; it does not establish their repair or an executed incident. **Authentic visual baseline/parity, keyboard/responsive/accessibility behavior, human comprehension, plugin/runtime behavior and native synchronization are unverified.** Keep the package **PROPOSED / BACKLOG / NOT FROZEN**. This receipt supplies no operational `PUR-GATE-001` verdict or computed Graph result.

## Independence, inputs and authority

This was a no-history role dispatch. I did not read another team's original report, preparation report or conclusions before saving this original. The supplied run context and candidate themselves expose prior judgments, including the stated purpose of C2 and a link to an earlier Red finding. I read that authored candidate text, but did not open the linked peer report. Consequently this is an independent **informed delta review**, not blind discovery, a held-out test or an effectiveness experiment.

The frozen candidate is `/workspace/scratch/e50b253d95e4/review-candidate-v149-c2`. `RUN_CONTEXT.md` and `INPUTS.json` were read first. I computed the manifest SHA-256 as `c722c8e75521a495a1560f562324bfc27ad2b2e8e318f0d4986b80a18b1a760c` and independently checked all 15 listed byte lengths and SHA-256 values: **15 checked, zero mismatches**. That check establishes file identity only.

Current-source references below mean `/workspace/scratch/e50b253d95e4/tesbo` at **`d440c48ede32ca38783b178ea6d957ded8bca9e4`**, inspected with `git show`/`git grep`, not mutable working documents. Claims expressly pinned to **`f92c3341eadc03f274becbead3b0f45d0a86539e`** were checked against that pin or bounded byte comparisons. The saved v1.4.48 baseline identity comes from the input manifest/run context; I read the supplied eight baseline-to-candidate diffs, not the entire historical archive.

Method source is the unchanged recovery of **`NesberryEnterprise/Nesberry@d83549c85a4dcd047fb40dc4fba4ec62737ab0fc`** under `/workspace/scratch/e50b253d95e4/methods`:

| Method input | SHA-256 | Applied scope |
| --- | --- | --- |
| `.claude/agents/purple-team.md` | `0d9311c4354879fb3781a1a0124bc746f41b7eebe120fa323755ff21d9d1f234` | Application binding, independence, source-vs-render evidence, active/advisory split, read-only review |
| `.kiro/steering/teams/review-orchestration.md` | `8fd41f22e1909afd48d8af95120d03a0f52e30a1bf9976a639fb6cca67bb4729` | Portability, semantic consequence, negative space, current-UI fidelity, Purple remit and phase limits |
| `docs/reviews/NESBERRY-PURPLE-TEAM-DESIGN-ASSURANCE.md` | `4b5cf3379fe058f0826a360556759ae7a6b7bd9f4051e9d79d519cc383f7bc73` | §§0–6, `PUR-BASELINE-001/002`, mental-model and whole-page provisions, §22 severity; selected relevant sections, not a claim to have reviewed every charter module |
| `docs/reviews/NESBERRY-PURPLE-TEAM-REVIEW-RUNBOOK.md` | `b16294368e861d0dd029bf46e2e6a202b8582afaf0a878138df3fa42c2a02325` | Status/intake, finding evidence schema, `RUN-014/014A` source and authentic UI receipt |
| `docs/policies/governance/POL-GOVERNANCE-ASSURANCE-PORTABILITY/v001.md` | `33c69cba82f7d98773e85a30fa1afff15cc0dbcec0d88302a0295ce06e2c8524` | Entire policy: target authority, mechanism-based applicability and proportionate proof |

The charter's §1.4 keeps its broad operational package unratified. I use the active orchestration's semantic/source-fidelity obligations and advisory purpose/placement lens; I do not activate its dormant ART/FC package or import Nesberry navigation, marketplace parties, breakpoints or release authority. Tesbo's frozen `AGENTS.md` principles, `CLAUDE.md`, canonical 02/04/07 and the run's explicit read-only limits supply the application binding. The task is a documentation review; no application mutation or E2E run was authorized or performed.

## Questions originated for this review and actual scope

The governing question was whether a Tesbo member can identify the intended object, effective scope, real state, consequence and supported next action. I asked:

1. Which facts describe a package, a connection, a project relationship, a permission, a method assignment and an observed result? Would a common “installed/ready” label collapse them?
2. Can the intended task end at the correct native result, including failure, refusal, partial completion and a lost acknowledgement?
3. Does removing or replacing a contribution preserve the right historical meaning without implying either blanket data deletion or unrestricted retained-data access?
4. Which current screens and components can actually be reused, and which apparently similar controls conceal a missing action or different authority?
5. Does the proposal preserve a legitimate task with no plugin, while refusing to promise a fallback where a required capability is absent?
6. What evidence would be necessary before claiming that a person understands the interaction or that a redesigned screen preserves the existing product?

All **eight `delta/*.diff` files** were read in full, including the added canonical 06 distillation gates. Relevant earlier contracts were read at C07:1–90 and 828–945; C04:483–499 and 919–975; C06:596–625. I read the candidate entrypoint principles and context, all of `CLAUDE.md`, the C1-to-C2 entrypoint/subordinate diffs and the subordinate Skills current-package/state paragraph. I did not read the full bodies of all eight large historical specifications or independently revalidate their old receipts. External precedent accuracy, the full research paper, full source/consumer coverage and method efficacy are outside this Purple sample.

Citation aliases `C00` through `C07` mean the correspondingly numbered file in the frozen candidate's `docs/qa-orchestration/`. Source paths below are relative to the pinned repository. Line ranges identify the inspected excerpts; they do not imply the entire large file was reviewed. Truncated search/inventory outputs were used only to locate follow-up reads and are not counted as full-file inspection.

## Actor, surface, state and consequence traces

These are source-grounded and conceptual traces, not executed user journeys.

| Actor and intended outcome | Surface/state/action | Owner and consequence | Review result |
| --- | --- | --- | --- |
| Workspace owner connects a source; project member selects which source feeds a project | Workspace integration → project integration mapping → queued/running/partial/succeeded sync → Knowledge Base/Requirements | Workspace connection and project mapping are separate. The actual page describes one remote unit per project and says old synced documents remain. Native sync, not a plugin label, owns the run and mirror. | Coherent basis for C02's distinct facts. Reuse must preserve workspace-vs-project scope and must address the unlink gap. Source: `WorkspaceIntegrationConfig.tsx:63–108,184–218`; `ProjectIntegrationMapping.tsx:137–159,285–366`. |
| Owner changes the connected remote account; reader later inspects old material | Reconnect while reusing the same connection row; delayed work or an overlapping external ID arrives | Callback writers replace `external_id` on the organization/provider conflict key. Mirror lookup/upsert uses project/provider/external-ID/source-role. A stable row UUID alone does not prove unchanged remote identity. | C03:2119–2121 and C05:2336 preserve the required gate. Same-account credential renewal is a valid continuity case; a blanket rule to discard all old history would be wrong. No deployed collision is claimed. |
| Owner requests disconnect; authorized member still needs historical knowledge | Disconnect credentials/mappings while an earlier worker may have passed a read/await; later open retained native data | The disconnect writer clears credentials, disables mappings and deliberately retains knowledge. Run settlement is not proof that every later mirror effect is fenced. Retained bytes remain subject to their own current read authority. | C03:2125,2141–2143 and C05:2335,2339 correctly keep stop effect, retention and read permission separate. The receipt does not certify all reader/cache/export enforcement. |
| QA author proposes method content; permitted human reviews and assigns it | Existing Skills Library → exact saved version → approval → separately scoped assignment | The current UI identifies exact project/skill/version and expressly states approval leaves assignments unchanged; create/submission partial recovery retains the saved draft. A package import must not replace these steps. | Supports C03's method/content profile and C04's no-metadata-authority rule. Exact current UI source is a usable reuse anchor; no native transaction or human-assent proof follows from reading it. Source: Skills page:392–438,478–568,640–735. |
| Tester wants an external executor to investigate; reviewer interprets its report | Proposed task/attempt/report handoff; unknown response must be reconciled before retry; native Run admission/result remains separate | The sampled current Task page is Zyra-oriented: `createZyraTask`, agent-active gating and generated-testcase language. That page is not evidence that a general external executor or plugin install flow is already available. | C00:909, C02:1061 and C05:2316–2322 preserve the distinction. T-408 and the selected adapter still need actual capability and effect proof. A supported independently operated client is a valid no-installed-plugin alternative. |
| Reader loses an optional report renderer | Open authorized native evidence/history; show an unavailable presentation truthfully | Existing exact-content display renders stored text/JSON/HTML/source details through the native version owner. It is a reuse example, not proof that every possible report can survive removal. | C02:1063 and C07:957 condition the fallback on actual support. Each chosen report/profile must prove an interpretable native route; missing required evidence cannot become a successful result. |

## Source reuse and preservation map

| Existing source surface inspected | KEEP / EXTEND / EXTRACT disposition | What is and is not established |
| --- | --- | --- |
| `Tesbo-Frontend/app/(app)/layout.tsx:1–24`; `components/Sidebar.tsx:45–91`; `components/workflows/StandardPageLayout.tsx:1–17`; `app/globals.css:534–620` | **KEEP** the real host shell, existing project destinations and shared layout/style owners. **EXTEND** a selected native surface when an outcome is admitted. No new top-level plugin destination is justified by this review. | Shell/sidebar/style ownership is source-observed. Full navigation behavior, every shared consumer, themes and responsive rendering were not audited. `TopBar` internals were not inspected. |
| `components/integrations/WorkspaceIntegrationConfig.tsx:1–308` | **KEEP** connection/configuration and owner-only management cues; **EXTEND** consequence/readback only under its actual owner. | Loading, connection, reconnect, deployment-not-configured and return-project paths exist in source. The current disconnect action has no proposed plugin dependency/stop-effect presentation; C2 does not claim otherwise. |
| `components/integrations/ProjectIntegrationMapping.tsx:1–373`; Jira route:1–20; `lib/api.ts:4128–4140` | **KEEP/EXTEND** provider-specific mapping and links to current Knowledge Base/Requirements. | Shared picker supports current provider concepts. Exact Jira API wiring was followed. Do not assume all future source profiles require a remote-project picker, or that its current unlink UI completes. |
| `components/integrations/SyncStatusPanel.tsx:1–195` | **KEEP** native-run attribution, partial/failure distinction and `role=status`; **EXTEND only after qualifying** freshness/unknown presentation. | Poll errors are swallowed at 39–50 and retain prior `run`; displayed time is run start/finish, not last successful observation. Reusing this unchanged would not prove the proposed observed-health/freshness contract. This is a source reuse limitation, not a C2 promise of a working health panel. |
| `app/(app)/projects/[id]/settings/skills/page.tsx:1–230,285–460,470–570,640–735`; `components/skills/SkillAssignmentForm.tsx:1–100`; `components/knowledge-base/GovernedVersionContent.tsx:1–42` | **KEEP** separate candidate, submission, exact review, approval, assignment and history; **EXTEND** admitted content provenance through those owners. No new approval store and no extraction justified here. | Selection fencing, focus-return logic and inert exact-content presentation are present in inspected source. Remaining assignment implementation, backend authorization and rendered interaction were not completely audited. |
| `app/(app)/projects/[id]/agents/tasks/page.tsx:242–368` | **KEEP/EXTEND** the existing task entry and review destinations after target-specific contract qualification. | This excerpt shows native Zyra behavior. General executor task/report operation, all task-detail states and external runtime continuity remain unverified. |

No rendered Before was created. No source reconstruction is offered as a screenshot, deployed baseline or complete current UI inventory.

## Finding and counterevidence

### PUR-C2-S01 — Project-level unlink cannot be committed from the inspected picker

**Severity/disposition:** **P2 / ADVISORY / OPEN**, pre-existing source finding on a proposed reuse path. Not caused by C2 and not a reason to block continued documentation reconciliation. Resolve or explicitly qualify before claiming that this native control supports project disable/unlink.  
**Owner:** existing integration frontend/API owner; QA should reproduce with an authorized isolated fixture.  
**Rule binding:** orchestration semantic consequence/negative-space check; advisory `PUR-PURPOSE-001` task/action/exit requirement; Tesbo `AGENTS.md` principles 6, 11, 13 and 16; C02:1063 and C07:953–957 establish the future lifecycle/readback need.

**Actor and starting state:** authorized project member/owner, Jira already connected to the workspace, one project mapping selected. The user wants only this project's mapping removed while preserving the workspace connection and historical knowledge.

**Source trace:**

1. The project Jira route passes `connectJiraProjects` into the shared mapping component (`.../settings/integrations/jira/page.tsx:9–17`).
2. “Clear selection” calls only `setSelectedId(null)` (`components/integrations/ProjectIntegrationMapping.tsx:339–346`).
3. The only save button is `disabled={saving || !selectedId}` (`:335–338`). No empty selection can reach its click handler through the normal UI.
4. The handler already constructs `[]` when no item is selected and contains the “unlinked” outcome (`:137–149`). The API passes that array to the native route (`lib/api.ts:4136–4140`).
5. Native `connectJiraProjects` treats an empty request as explicit unlink: disable the project's enabled mappings, return without replacement, and return `linked: 0` (`Tesbo-Backend-Nest/src/legacy/legacy.service.ts:15089–15133`).

**Consequence:** local cleared selection can be mistaken for a pending unlink, but the UI provides no committing action. Returning/reloading can restore the still-enabled mapping. Disconnecting the workspace instead has wider scope and is not an equivalent correction.

**Counterevidence/limits:** selecting or replacing a nonempty source remains supported; “Clear selection” does not itself claim a successful server unlink. The native API is an available technical path, so this is a contained UI gap rather than a missing domain capability. I did not execute the browser/API or claim that no other application route could unlink. The confirmed source scope is this shared component with the Jira binding; other providers require their own contract checks.

**Smallest correction and discriminating proof:** within the existing mapping surface, expose an explicit authorized unlink action, or allow the cleared state to commit with an unmistakable consequence. Verify the target project's enabled mapping becomes absent through native readback, while the workspace connection, a neighboring project's mapping and retained history survive. Also verify cancellation/no-change and unauthorized use. Do not equate this requested mapping change with cancellation of all already-running effects; the separate fence proof remains required. No fix, native case or test was created by this review.

### C2's acknowledged boundaries remain supported, not closed

- **Disconnect versus retained-data access:** `legacy.service.ts:14931–14977` explicitly retains knowledge while clearing credentials and disabling mappings. C03:2143 respects that existing behavior and separately requires current read authority. This counters an overbroad interpretation that unplugging the connector must delete or deny all independently authorized project history. I did not prove the complete derivative/cache/export reader set.
- **Sequential account replacement:** `legacy.service.ts:14816–14837,14867–14887,14908–14928` updates external account identity on the same organization/provider row; `V47:6–18`, historical `V97:1–8` and mirror keys in `V72:72–80` explain why “one active connection” is insufficient namespace evidence. C03:2121's same-account renewal counterexample is appropriate. The selected callback/disconnect/Jira mapping method bodies were byte-identical across the two pins, although the whole legacy service was not.
- **Stopping versus final effects:** `integration-sync.service.ts:194–200` can mark by run ID without a terminal predicate, while `:270–287` settles/finishes active runs. `integration-sync.processor.ts:481–525,538–600` reads a connection, awaits work and reaches a mirror transaction without an inspected run/connection-generation check in that transaction. Credential clearing, disabled mappings and existing folder/lock checks are real protections; they do not prove the missing final fence. The sync service, processor and client blobs were identical at the historical and integrated pins. The candidate explicitly retains the proof gap at C03:2125 and C05:2335. This review independently checks the source mechanism without reading the earlier peer report or claiming a safe reproduction occurred.

## UI and comprehension evidence gates

| Check | Actual result and scope |
| --- | --- |
| `PUR-SLOP-019` mechanical delta/fidelity | **NOT RUN / no mockup supplied.** No Tesbo adapter or HTML artifact was selected. Nesberry scripts cannot certify these Markdown amendments. |
| Whole host page and authentic Current | **SOURCE-INSPECTED / VISUAL BASELINE BLOCKED.** Some actual shell and route sources were inspected. Current deployed build, screenshot, role/fixture/theme/browser/viewport are not captured. |
| Declared Before/After regions | **NOT AVAILABLE.** No redesign or implemented plugin screen exists in the supplied proposal. Future selected UI must map kept/changed/removed controls and preserve adjacent consumers. |
| Every page, branch and way in/list | **PARTIAL SOURCE/CONCEPTUAL COVERAGE.** The traces above are bounded samples. No complete screen-by-screen plugin journey or full Tesbo journey coverage claim. |
| Supported widths and fold | **NOT RUN.** No imported Nesberry viewport policy; Tesbo's own supported contexts and existing 320 CSS-pixel reflow/200% text-zoom obligations need actual evidence when UI work is selected. |
| Exact delivered artifact and counterpart views | **15 candidate identities checked.** This is document identity, not a mockup sent-copy or administrative/UI counterpart receipt. |
| Keyboard, focus, screen reader, long content, responsive behavior | **NOT RUN.** Source hooks/roles alone do not prove accessible completion. |
| Human comprehension and legitimate/refused recovery | **NOT RUN.** A representative person must predict the action's scope/effect and find the subsequent native evidence. No synthetic assertion substitutes for that evidence. |
| Runtime effects, native persistence and Tesbo synchronization | **NOT RUN / NOT PERFORMED.** No callable native Tesbo MCP was used and no database/API/browser action was taken. |
| Cross-team/Graph/release acceptance | **OUTSIDE THIS RECEIPT.** Specialist findings must be reconciled after originals are frozen; no computed CLEAN, visual approval, human approval, deployment or freeze follows. |

## Verification performed and handoff

Performed: read-only document/source searches and reads; all eight complete deltas; candidate manifest identity and 15 byte/hash comparisons; named source-method/blob comparisons across the two pins. No declared Green document verifier, product test, scanner, installation or native write was executed. One initially guessed V97 filename was absent; the actual path was located from the pinned tree and then read. All source conclusions above use the located file, not that failed lookup.

The amendment's research/transfer procedure distinguishes source-reported mechanisms, causal hypotheses, authorized target decisions, no-change results and later efficacy evidence. Its affected passages are consistent with this receipt's limited claims; the existence of this review does not demonstrate improved discovery or method effectiveness. [C06:600–625,844–882; C05:2346–2348]

Preserve this original unchanged for subsequent informed synthesis. Route `PUR-C2-S01` and the freshness reuse limitation to the existing integration work owner; keep the already-authored account identity/fence and actual UI/runtime/comprehension gates open. No new plugin scope, runtime, distribution model, role, permission or product implementation is selected here.
