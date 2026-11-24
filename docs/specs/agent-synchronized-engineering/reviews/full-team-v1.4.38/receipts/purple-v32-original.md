# Purple Team — original first-pass receipt

**Review:** Tesbo graph reasoning and governed Skills, v1.4.32 candidate 1  
**Reviewer:** /root/purple_v32, an analytical agent applying the original Purple definition  
**Date:** 2026-11-20 UTC  
**Stage:** specification adequacy and source-grounded integration review  
**Original disposition:** The proposal supplies a coherent, appropriately qualified direction for the sampled jobs. It does not yet establish a usable implemented experience or visual acceptance. Six advisory source findings remain below. Authentic current/after UI proof is BLOCKED. No operational Purple release verdict, ratification, human sign-off or cross-team closeout is issued.

## 1. Artifact, exact inputs and evidence boundary

The artifact is the eight-file canonical proposal in:

/workspace/scratch/40f0abd3bdbc/input-v32-candidate1/canonical

For citations below:

- **C/** means that exact canonical directory.
- **F/** means /workspace/scratch/40f0abd3bdbc/source419-frontend/Tesbo-Frontend/.
- **M/** means /workspace/scratch/ce8c3109f396/assurance-source-recovery/Nesberry-d83549c85a4dcd047fb40dc4fba4ec62737ab0fc/.
- **B/** means the Git object at 1alextest/Tesbooboo@6897f989b055a955280f810c7daace86f74057fa, read using git show from /workspace/scratch/307cd95373fe/tesbo.

These prefixes identify exact source files, not a mutable checkout or another specification version.

| Input | SHA-256 |
| --- | --- |
| RUN-CONTEXT.md | 370f72543c5a65f3ee25326ddc4412661c5a585e6b211eeacc180bf4b50e50c6 |
| manifest.json | 4f406b91251b85b2cd0def05fef9ce950481daa6b7b030762aed49998ac747f9 |
| C/00_README.md | 9d6fd78460f9c369f806da5cf0d6f41e351599469d11d2a073611f17230b0043 |
| C/01_PRODUCT_REQUIREMENTS.md | 009184a14956bd32f748cdc50a7ff629026e3a61b1c9e55648860f66582540c0 |
| C/02_WORKFLOW_AND_UX_SPEC.md | 23d9120c7aaa320f458fc51284388966e3e2a8945d929c9ef9730f10338425a9 |
| C/03_TECHNICAL_DESIGN.md | 0fbdd2bffbc534e4be40df61fae5a095191ba920129c546a930c60e3b27b9921 |
| C/04_MCP_API_CONTRACTS.md | 182aed015f69079f0a78d0c1420319729b7baecf8f8d6c0a1859d7463a48d1bd |
| C/05_IMPLEMENTATION_BACKLOG_AND_TEST_PLAN.md | a1e6a3f82b2725961a7501995d2cc8e40365afae4f5a7ee9a9d4dfd34bba6cfe |
| C/06_IMPLEMENTATION_AGENT_BRIEF.md | cf96798db8e48d161cc971313ed8e82c65d46dee8185a9c5d9d104d282bbe16c |
| C/07_UI_DESIGN_TASKS.md | c1270b7008e56bd5b44bfb53c11c6dadfc6ebaae6ba15d3e86b30b0b790cb45c |

The saved canonical parent is the declared v1.4.31 version 11 archive, SHA-256 ae475b1bada1a5a74089d6ab389e7019f5d6b67d5f1de5358ad0eb014739ef47. I did not re-review that archive or use earlier receipts as current proof.

**Source identity.** Current source inspection used the selected frontend files at PR167 commit 419c2efa08b04aff6c7c7d0d56425eb572bd6ec2. I independently recomputed SHA-256 and Git blob identities for all 261 frontend cache files: 261 checked, zero mismatches against the supplied manifest. That establishes cache integrity against the supplied evidence, not execution or an exhaustive code audit. The frontend manifest SHA-256 is 25886fd5f94fd83fa91949c9ae8104867a55c61152b837529907dc0bc066532a.

I compared both supplied, non-truncated remote-tree inventories for 419c2efa and e3d0ebcbe8ec88c5b191abdf2b1d352d44929747. Exactly seven blobs differ: six E2E fixture/test files and the Run page's execution-status group label. All seven delta blobs match their supplied SHA-256 and Git identities. The remote-delta manifest SHA-256 is 2653daa624d3a458e455dfb53cfd3bde64ac92d68205498ba000a462be8cab5f. The only frontend delta adds role="group" and aria-label="Execution status" in cycles/[cycleId]/page.tsx; it does not change the paths underlying the findings below. I did not run those tests or independently authenticate a deployment.

**Actual read scope.** I read the original agent, applicable charter portions, runbook intake/baseline/accessibility provisions, team README and orchestration, the full UX sanity §0, the specified vocabulary entries and the two directly applicable governance policies. I read B/AGENTS.md, B/CLAUDE.md and the scope procedure; the cached current root instructions match those base files. I read frontend module instructions. In the canonical package I inspected relevant workflow, UI, governance, source-fit, contract and acceptance sections across all eight files, not every historical paragraph. Source inspection covered the application/project shells, Sidebar, relevant TopBar destinations and CSS tokens/layout/focus rules; Model Studio's page, authoring and recovery helpers; draft graph/preview; Change review; exact case detail redirect and native case-panel loading; and the Run provenance link. Backend writers, all 261 frontend files and the whole repository were not semantically audited.

The separately named Tesbo_Existing_Application_Baseline_v1.0.md is absent from the inspected base Git tree and was not supplied in this assigned package. Its contents are UNKNOWN here. Current source and the supplied absence of runtime evidence are the usable baseline.

**Deployed commit claimed by a “Now” artifact:** none supplied; UNKNOWN.  
**Evidence modes:** DOCUMENT-INSPECTED, SOURCE-INSPECTED and explicitly conceptual journeys only. No CAPTURED server HTML, RENDERED browser UI, current screenshots, after screenshots, assistive-technology session, target execution or human comprehension study.

## 2. Actual authority and independence

The charter is explicitly Draft, version PURPLE-2026.10.18-r7. Its §1.4 says only the whole-page journey/fold gate runs as binding, §5–6 are advisory, and the rest is not run pending ratification. The runbook is also unratified; RUN-001 prevents an operational package review before ratification. Its older canonical-version reference is not evidence of later adoption. I therefore did not create ART-* packages, PUR-FC-* rows, a PUR-GATE-001 verdict or a Purple Graph closeout. [M/docs/reviews/NESBERRY-PURPLE-TEAM-DESIGN-ASSURANCE.md:78–94; M/docs/reviews/NESBERRY-PURPLE-TEAM-REVIEW-RUNBOOK.md:3–10,113–124]

The binding portable obligation is truthful whole-context journeys and declared changes. Tesbo does not inherit ClassifiedsNav, two marketplace parties, Nesberry breakpoints or a mandatory marketplace admin page. The active orchestration separately requires source-to-runtime fidelity and permits source-only work while visual parity remains blocked. It also assigns Purple semantic/user-model integrity. This is the basis for continuing this bounded source/specification review without pretending to operate the whole draft charter. [M/.claude/agents/purple-team.md, “Application binding” and “What is binding”; M/.kiro/steering/teams/review-orchestration.md:17–42,432–438,529–533]

Tesbo's own engineering principles require preserved work, truthful uncertainty, complete usable handoffs and accessible existing workflows. The candidate's proposed contracts are the design being assessed; words such as “shall” inside that proposal do not prove owner acceptance, implementation or runtime compliance. Canonical 06 remains proposed target guidance and did not replace my reviewer charter. [B/AGENTS.md:23–43,47–53; C/06_IMPLEMENTATION_AGENT_BRIEF.md:598–626]

**Cold-pass boundary.** I did not read peer receipts, author retrospectives, subordinate views, views/reviews, or list_agents. No other reviewer supplied a finding list. The first-pass receipt is frozen before any informed reconciliation. “Original” means this agent's original disposition, not a claim that nobody has previously noticed the mechanism.

**Disclosed exposure inside primary inputs.** The primary specifications contain historical judgments and reconciliation conclusions. I saw the dated source/live claims in C/00_README.md:4–13 and C/07_UI_DESIGN_TASKS.md:16; the source-fit conclusions in C/03_TECHNICAL_DESIGN.md:1374–1406; historical journey totals/crosswalks at C/05_IMPLEMENTATION_BACKLOG_AND_TEST_PLAN.md:1182 and1539 encountered while locating acceptance clauses; historical review summaries surfaced in searches of C/06; and its inconclusive/equal earlier candidate-trial statement at C/06_IMPLEMENTATION_AGENT_BRIEF.md:619. These are exposed context. They do not constitute my own tests, a freshly supplied Grey inventory, independent replication, novelty evidence or approval. In particular, the active-selection and unknown-Run items below were already described in the current proposal and are treated as corroborated admissions, not fresh discoveries.

## 3. Reconstructed jobs and source-grounded journeys

The user's outcome requires someone to understand the relevant behavior, see why a suggestion follows, create or reuse the right native record, obtain the appropriate decision, and return to evidence after interruption. A graph or a Skill is useful only where it helps that sequence.

This is a **sampled Purple inventory**, not a full-journey coverage claim. The following rows were derived from those jobs and real entry points. Conceptual expected outcomes are not recorded as executed passes.

| Journey | Actor, starting knowledge and attempted outcome | Conceptual result and evidence |
| --- | --- | --- |
| PJ-01 — Manual work without code or a model | Tester has an approved requirement and wants a clear manual case, then a genuine native attempt. | C/02_WORKFLOW_AND_UX_SPEC.md:726–733 and C/03_TECHNICAL_DESIGN.md:1603–1607 preserve this valid path. The existing Tasks screen still presents Zyra task creation and disables it when the agent is inactive; that source is not proof of the external-runtime/no-provider contract (F/app/(app)/projects/[id]/agents/tasks/page.tsx:323,473–541). End-to-end delivery remains unverified; ordinary native case/manual work must stay available. |
| PJ-02 — Change notification to an affected case and back | QA has a historical change observation and needs the particular case, its version and the return context. | Real source has Change review and native links, but the case destination drops identity. F-01. Change-history fetch failure also deserves the truthful-state check in F-05. |
| PJ-03 — Explain a historical Run | Reviewer knows a Run was based on model revision r1 and needs that exact basis after r2 exists or the model is archived. | The Run displays a revision but sends only model identity; the receiver defaults to head or another model. F-01. Active-versus-approved selection is also an explicit unresolved candidate admission. |
| PJ-04 — Author, pause and resume a model | Human edits expected behavior, interrupts editing, or closes the overlay to inspect another source. | Draft state is local to an unmounted modal; dismissal can discard it without a choice. F-03. Keyboard/assistive navigation lacks the expected shared dialog contract. F-04. |
| PJ-05 — Compare two models while generation is slow | Tester starts path proposals for A, selects B, and then chooses what to turn into draft cases. | Proposal state and responses are not bound to visible model/revision. F-02. No foreign native write is claimed. |
| PJ-06 — Reuse an existing case during a lookup failure | Tester knows cases exist, opens Link case, and gets a failed read or later retries. | The loader silently empties the list. The user cannot distinguish unavailable discovery from no eligible cases. F-05. |
| PJ-07 — Inspect an approved model without trusting a diagram | Reviewer uses textual transitions and list controls, including keyboard-only access, to decide what is approved versus observed. | Graph/table alternatives and explicit “not execution” copy are useful. Reused graph copy nevertheless calls approved expectations unapproved draft material. F-06. Real accessibility and layout remain blocked. |
| PJ-08 — Correct an interpretation and govern learning | Tester rejects a suggestion without provider credit; a separately authorized human later evaluates and assigns a method version. | C/02_WORKFLOW_AND_UX_SPEC.md:731–739,746,752 and C/03_TECHNICAL_DESIGN.md:1437–1487 define separate correction, candidate, approval and effective assignment states. Scope-specific recovery and independent raw observations are coherent. Actual configured authorities, implemented resolution and visible readback are not proved. |
| PJ-09 — Policy/manual change without code | Authorized reader asks what a changed rule means for instructions, roles, tests and downstream work; wording-only/no-effect and contested-source branches must remain legitimate. | C/02_WORKFLOW_AND_UX_SPEC.md:755–757, C/03_TECHNICAL_DESIGN.md:1661–1674 and C/04_MCP_API_CONTRACTS.md:1060–1062 explicitly support this, with cited claims and owner-specific next actions. The source Change review is currently an observation/triage surface, not proof of a semantic analyst. No false causal or completeness conclusion is accepted. |

The proposed design is strongest where it preserves separate meanings: observed source, accepted expectation, candidate, approval, active assignment, native Run preparation and actual test observation. It also permits manual/no-model/no-AI work, a valid no-effect result, and abstention when evidence is inadequate. These are substantive design choices, not proof that users can yet perform the entire sequence. [C/00_README.md:664–687; C/02_WORKFLOW_AND_UX_SPEC.md:720–739; C/03_TECHNICAL_DESIGN.md:1593–1607,1625–1639]

## 4. Pass 1 — whole-page journey truth

**Mechanical verdict: NOT RUN / BLOCKED.** No mockup.html, authenticated current/after DOM pair, current deployed identity or target-specific fidelity adapter was supplied. I did not run Nesberry's delta/fidelity commands against unrelated Tesbo Markdown and call that a pass. Hash checks above verify input identity only.

No mockup was submitted for visual acceptance. The table records what remains blocked if this package is used as a design preview; the absence of a mockup is not itself a fabricated UI defect or a reason to stop source-only research.

| Pass 1 check | Status | Evidence and what would unblock the claim |
| --- | --- | --- |
| 1. Whole page | BLOCKED | Source maps the actual Sidebar/TopBar/app shell (F/app/(app)/layout.tsx:11–23), but no complete rendered page at a known build/role/fixture exists here. Capture the real host surface and overlays. |
| 2. “Now” is deployed | BLOCKED | Both PR pins are source snapshots, not a supplied deployment. Record actual build, browser, theme, role, fixture and authenticated capture. |
| 3. Changes only at declared regions | BLOCKED | No authenticated before/after pair or declared visual delta is present. Preserve unchanged native controls and compare the actual revised surface. |
| 4. Every step, person and branch | BLOCKED | PJ-01–09 are sampled conceptual/source traces, not full rendered walks or the reconciled full-team inventory. Complete the applicable actor/state paths, including denied, stale, unavailable and interrupted work. |
| 5. Visible way in and list/detail continuity | BLOCKED | Native entry paths exist in source, but F-01 shows specific handoff defects. Prove repaired exact-object/revision navigation and return behavior in the running app. |
| 6. Supported widths, sample world and fold | BLOCKED | Source has layout rules, not measured pixels. Use the target's supported matrix, including its proposed 320 CSS-pixel reflow and separate 200% text zoom, plus agreed desktop context. Do not import Nesberry's viewport pair as Tesbo's approved contract. |
| 7. Checked delivered artifact and appropriate governance counterpart | BLOCKED | No delivered mockup integrity receipt or rendered reviewer/governance counterpart. Resolve Tesbo's actual capability mapping and show relevant author/reviewer/operator states, rather than inventing a marketplace admin surface. |

**Pass 1 disposition:** no PASS. Visual review is not ready; authentic baseline and comparable after evidence are prerequisites. This does not prevent Blue/Red or other roles from using the source findings for architecture review.

## 5. Advisory purpose, meaning, placement and recovery findings

These are **ADVISORY** findings under the original agent's §5–6 lens, active orchestration's semantic-integrity duty and Tesbo's own preservation/truthfulness/accessibility obligations. They are not PUR-FC release gates. Formal rendered Pass 2 has not passed its visual prerequisite. Severity uses the charter's §22 descriptions without importing its unratified release authority.

For every finding, **width is unobserved**: the mechanism is source-level and is not limited to one measured viewport. No pixel, fold or actual screen-reader behavior is claimed.

### F-01 — P1 ADVISORY: native drill-down loses the object or historical basis

**Checks:** PUR-PURPOSE-001 (entry/exit/return), PUR-PLACE-004/006 (action beside the right evidence; separate scope).  
**Step · person · region:** PJ-02/PJ-03 · QA/reviewer · case link and model provenance navigation.

Change review offers “Open existing test case” at F/app/(app)/projects/[id]/agents/zyra/changes/page.tsx:228–232. Generated cases use the same detail-route form at F/app/(app)/projects/[id]/model-studio/page.tsx:887–891. The owning case route reads only project id and redirects to the repository, discarding tcId (F/app/(app)/projects/[id]/testcases/[tcId]/page.tsx:11–13). This is an inspected route defect, not an assumption that a case page is missing. The native repository already owns openViewPanel and complete-record loading (F/app/(app)/projects/[id]/testcases/page.tsx:1134–1170).

The Run's link shows its recorded revision but sends only ?model= (F/app/(app)/projects/[id]/cycles/[cycleId]/page.tsx:1238–1257). Model Studio reads only that query key, selects the head on first detail load, and falls back to the first model if the requested model is not in its list (F/app/(app)/projects/[id]/model-studio/page.tsx:92–94,174–208). A historical or archived link can therefore lead to a different revision or different object. This undermines the decision to trust the linked evidence.

**Concrete fix/alternative:** extend the existing repository drawer route to resolve exact case/revision and validated return context; preserve exact model revision/mode in the native link and receiver. An authorized detail page or the existing drawer is valid. Unknown/revoked/archived targets need a safe historical/unavailable result, never another selected object. These are already required by C/07_UI_DESIGN_TASKS.md:162 and543–547 and T-308 (C/05_IMPLEMENTATION_BACKLOG_AND_TEST_PLAN.md:82); add these source cases to their proof rather than inventing a second case UI.

**Discriminating proof:** two cases with equal titles, an older model revision, an archived model, reload/back/new tab and a denied target. The outcome must be the exact authorized historical identity or an explicit unavailable state, with preserved return context.

### F-02 — P1 ADVISORY: path proposals can stay under the wrong model

**Checks:** PUR-PLACE-002/006, PUR-PURPOSE-001.  
**Step · person · region:** PJ-05 · tester · model selector, Path proposals and Create draft cases.

The page stores proposals and selected digests without model/revision keys (F/app/(app)/projects/[id]/model-studio/page.tsx:122–127). Selecting a model changes only the selection/run scope (657–660). The path response unconditionally sets proposals (411–427), and the display renders them under the currently selected detail (808–859). Case creation then uses the current model and latest revision (431–443). A completed result left on screen, or a delayed A result arriving after selection of B, can therefore present A's proposals as B's decision context.

This is a source-supported presentation/intent mismatch. I have not demonstrated an unauthorized native write: the server is intended to regenerate and verify digests, and could refuse the stale request. Such refusal would not make the misleading decision surface correct.

**Concrete fix/alternative:** key proposal output, selections, notices and pending responses to project/model/revision/generation inputs. Clear them on a scope change, or retain them in an explicitly labelled historical context with separate selection. Fence stale callbacks. Reuse existing source patterns: this page keys coverage reads (219–238); Change review fences reads and mutations (F/app/(app)/projects/[id]/agents/zyra/changes/page.tsx:42–94,99–125).

**Discriminating proof:** generate/select A then switch to B; separately switch while A's read is delayed and while a new revision arrives. Only the labelled current context may drive the action. Rejected stale results must preserve useful work without attaching it to B. This concretizes C/02_WORKFLOW_AND_UX_SPEC.md:720,737–739 and MBT-AC-39, not a new permission rule.

### F-03 — P1 ADVISORY: closing the model editor can silently discard work

**Checks:** PUR-PURPOSE-001 (exit, return and success), target preservation requirement.  
**Step · person · region:** PJ-04 · author · model definition overlay.

ModelDefinitionModal owns name/states/transitions in local state (F/components/model-studio/ModelStudioAuthoring.tsx:120–150). The shared Modal sends Escape and backdrop clicks straight to onClose (F/components/ui/Modal.tsx:17–24,52–64). The parent unmounts the editor whenever authorBusy is false, without a dirty check or retained draft (F/app/(app)/projects/[id]/model-studio/page.tsx:1252–1266). The source path therefore drops unsaved content on an ordinary dismissal, including after a save refusal has preserved it in the open editor.

**Concrete fix/alternative:** give close/navigation an explicit Save draft / Keep editing / Discard decision when dirty, or retain a clearly labelled draft scoped to principal/project/model with current-authority/conflict checks. Deliberate Discard is valid; involuntary dismissal is not. Extend the existing overlay/editor ownership without creating a new draft database by default. C/07_UI_DESIGN_TASKS.md:545 and C/02_WORKFLOW_AND_UX_SPEC.md:714,720 already state the intended behavior.

**Discriminating proof:** author a multi-step model, receive a stale-base error, press Escape or backdrop, then reopen and navigate/back. The chosen preservation/discard result must be explicit, and closing one project must not expose its draft in another.

### F-04 — P1 ADVISORY: shared dialog and field semantics do not support the promised accessible journey

**Checks:** PUR-PLACE-007; target keyboard/assistive acceptance in C/07_UI_DESIGN_TASKS.md:571–573.  
**Step · person · region:** PJ-04/PJ-06/PJ-07 · keyboard/screen-reader user · authoring and linking dialogs.

The actual shared Modal renders presentation roles for both overlay and content, has no dialog naming/modal semantics, and contains no focus admission, containment or return mechanism (F/components/ui/Modal.tsx:16–76). The authoring callers supply no alternative mechanism. The visible Model name and Initial state labels are sibling labels with no htmlFor/id association (F/components/model-studio/ModelStudioAuthoring.tsx:161–217). Field and Input are plain wrappers, so they do not supply that association automatically (F/components/ui/Field.tsx:4–17; F/components/ui/Input.tsx:6–18).

The source does include general focus-visible CSS and role=alert errors; I do not claim there is no focus styling or no error announcement. The specific gap is the dialog's semantic/focus lifecycle and reliable control naming. Actual assistive behavior remains NOT OBSERVED.

**Concrete fix/alternative:** repair the shared native Modal/Field contract, or use a suitable native dialog mechanism while preserving Tesbo's existing visual system; associate labels and control/error IDs. Do not solve this with another overlay framework unless existing ownership cannot fit. Check existing consumers, because reuse also carries defects. T-308 already allocates shared dialog/diff/field hardening (C/05_IMPLEMENTATION_BACKLOG_AND_TEST_PLAN.md:82).

**Discriminating proof:** open, edit, validate, traverse and close entirely by keyboard and an explicitly declared screen-reader/browser pair; focus returns to the invoker, background interaction is controlled, names match the task, and announcements describe the correct current state. Then repeat narrow/zoom and shared-consumer cases. Source inspection alone cannot close this.

### F-05 — P2 ADVISORY: failed case discovery looks like an empty chooser

**Checks:** PUR-PURPOSE-001, PUR-PLACE-003; target truthful failure requirement.  
**Step · person · region:** PJ-06 · tester · Link case search/selection.

LinkCaseModal catches listTestCases failure with setCases([]) and sets loading false, without storing or presenting the read error (F/components/model-studio/ModelStudioAuthoring.tsx:339–356). The chooser subsequently shows the same “Select a case” state used after a successful read (364–384). Search is a possible retry, but the user is not told that discovery failed. They cannot decide whether to retry, request access or investigate a missing case.

Related source-state checks deserve the same oracle: first model-list and Change-history failures can display an error beside the empty-state copy because the render branches use empty arrays rather than successful-read status (F/app/(app)/projects/[id]/model-studio/page.tsx:174–195,624–649; F/app/(app)/projects/[id]/agents/zyra/changes/page.tsx:53–71,194–198). I did not reproduce those states in a browser.

**Concrete fix/alternative:** retain a typed read outcome and context, show a safe unavailable/denied/retry treatment, and reserve empty-success wording for completed discovery. Existing selections and model elements should remain usable when safe. No duplicate-creation shortcut should infer absence from this failure. This extends the candidate's existing C/02_WORKFLOW_AND_UX_SPEC.md:710–716 and C/07_UI_DESIGN_TASKS.md:561–565 obligations to the actual linker.

**Discriminating proof:** successful zero results versus 403, timeout and stale response, followed by recovery. Only the successful zero may describe an empty result; the failed read must not silently remove the reason or certify no match.

### F-06 — P2 ADVISORY: the reused graph contradicts approved status

**Checks:** PUR-PURPOSE-001, PUR-PLACE-005/006.  
**Step · person · region:** PJ-07 · reviewer · model header and graph explanation.

Model Studio can display “Approved” from the selected revision (F/app/(app)/projects/[id]/model-studio/page.tsx:680–685), then renders ModelDraftGraph unchanged for that revision (752–754). The reused component always says “Draft state graph,” “draft states,” and “Expected observation (unapproved)” (F/app/(app)/projects/[id]/agents/zyra/changes/ModelDraftGraph.tsx:46–60,98–108). The page header also says “A model is not approved” without conditioning that statement (F/app/(app)/projects/[id]/model-studio/page.tsx:606–609). Approval and lack of runtime evidence are independent facts; generic draft language cannot represent both.

**Concrete fix/alternative:** pass the actual authority/display context into the existing component, or use neutral structural wording plus the separate authentic approval status. Keep “not execution evidence” truthful even after approval. Preserve the exact textual list alternative. No visual redesign or new graph owner is needed.

**Discriminating proof:** render the same structural model as ephemeral draft, saved draft, approved current and approved historical; status text and accessible names must agree with each state without turning approval into a test pass.

## 6. Existing-surface reuse and legitimate alternatives

| Surface/owner | Keep | Extend or verify |
| --- | --- | --- |
| App shell, Sidebar, TopBar, native tokens | Existing project navigation and host layout; Model Studio is already a native item | Capture real full contexts. Retain existing controls and workspace/project switching; no standalone Graph AI shell. F/app/(app)/layout.tsx:11–23; F/components/Sidebar.tsx:43–84,209–213,284–353. |
| Native Test Cases | Existing repository, editor and complete-record/approval loading | Exact-object/revision route and return behavior. F/app/(app)/projects/[id]/testcases/page.tsx:1037–1059,1134–1170. |
| Model Studio | Existing model/revision, mapping, proposal and native Run surfaces | Scope-binding, history, accessible overlays, preserved work and accurate labels in F-01–06. |
| Structural graph and tables | Bounded schematic, textual reachability and equivalent details | Authority context and real keyboard/reflow proof; a list-only experience remains legitimate. F/app/(app)/projects/[id]/agents/zyra/changes/ModelDraftGraph.tsx:46–110; F/app/(app)/projects/[id]/agents/zyra/changes/ModelDraftPreview.tsx:122–153. |
| Change review | Existing capture/history, native links, bounded request fencing and honest non-execution text | Semantic/source-free entry, exact links and failure recovery under the current proposal; its present source does not prove those future extensions. |
| D-14 guide/settings owner | One proposed Skills Library/Assignments owner, contextual guides and native content | Actual authority mapping, exact effective-version readback and operator recovery before exposure. C/07_UI_DESIGN_TASKS.md:315–319,640–676; C/03_TECHNICAL_DESIGN.md:1437–1489. |

A diagram is optional when a table explains the same relationships. Deterministic diff/traversal or human review is a legitimate alternative to AI for a clear bounded question. Manual testing remains legitimate without a graph, source checkout or driver. A policy/manual wording change can validly produce no behavior change. These alternatives are supported by the candidate, and I have not required uniform UI or universal graph/Skill use. [C/02_WORKFLOW_AND_UX_SPEC.md:726–739,757; C/03_TECHNICAL_DESIGN.md:1627,1639; C/06_IMPLEMENTATION_AGENT_BRIEF.md:624–626]

## 7. Known source-fit admissions and side findings

These items are already named in the primary proposal and are not counted among the six fresh receipt entries as novel discoveries:

- **Viewed/approved/active revision:** the UI derives latestRevision and targets it for generation/approval/run work; C/02_WORKFLOW_AND_UX_SPEC.md:614–628,750 and C/03_TECHNICAL_DESIGN.md:1392,1651 already require separate activation and current/historical selection. Source confirms this integration remains material. I did not independently audit its backend transaction.
- **Unknown Run outcome:** the UI truthfully labels uncertainty and performs native candidate readback, but allowing a separate new request clears the unresolved browser marker (F/app/(app)/projects/[id]/model-studio/page.tsx:582–594). C/02_WORKFLOW_AND_UX_SPEC.md:760 and C/03_TECHNICAL_DESIGN.md:1403–1404 already require preserved original intent and authoritative reconciliation. The local journal is contextual evidence, not a server receipt. A supported pause/manual reconciliation is valid; automatic retry is not required.
- **Feedback and governed Skills:** the candidate already distinguishes saved correction, optional generation, immutable successor, approval and assignment. No configured human governance mapping, active resolver, operator rollout or post-action convergence was supplied. Their current status is unestablished, not inferred absent from the selected frontend files.

**Adjacent source finding, not fixed:** Drawer shares the presentation-role/no-focus-lifecycle pattern, and its icon-only close button has no supplied accessible name (F/components/ui/Drawer.tsx:19–60). It is outside the directly inspected model-dialog interaction, but is a relevant shared-consumer check for T-308. I did not inventory or certify every Drawer caller.

**Method/package side boundary:** the runbook references an older charter revision while remaining explicitly draft. This receipt follows the later charter's explicit §1.4 active/advisory split; it does not repair, ratify or expand the methodology.

## 8. Unresolved dependencies, validation and bounded verdict

**Actual checks run:** file/manifest SHA-256 checks; Git blob checks for 261 frontend and seven delta files; full supplied-tree comparison; targeted source/document reads and static control-flow tracing. All integrity checks described above matched. No application unit, API, MCP, browser, database, migration, accessibility or E2E tests ran. No source, input, branch, installed Skill, native record or external system was changed.

**What the proposal establishes:** a coherent proposed distinction between facts, interpretation, approved expectations and effects; useful manual/no-model alternatives; native record and permission ownership; source-aware stale/partial/conflict/recovery requirements; separate Skill approval and activation; and explicit evidence limits. I did not find a reason in this sample to replace those owners with another graph application or to require a formal model for ordinary QA.

**What remains insufficient:** source proves that important existing journeys still violate the intended contract. The six findings need concrete implementation/proof allocations within the existing tasks. Descriptive UI requirements and acceptance IDs cannot establish that the supported actors can complete them, or that Skill-guided interpretation is useful or comprehensible to real users.

The next evidence should be proportionate to those decisions:

1. Bind a permitted actual build, roles/capabilities, realistic fixtures, browser/theme and supported accessibility/viewport matrix. Capture authentic Before and After for the changed host pages and shared controls; record unchanged regions.
2. Demonstrate exact case/model/revision round trips, delayed-response fencing, successful-empty versus unavailable discovery, dirty-editor recovery and the keyboard/assistive journeys named above.
3. Have accountable humans resolve the proposal's still-open governance/assignment/recovery authority and operating limits before enabling those actions. Denial of an affected governed operation must not silently disable unrelated authorized manual work.
4. Validate comprehension and usefulness with appropriate user evidence: can the tester identify the expected authority, uncertainty, affected scope and next owner/action, including a valid no-effect or inaccessible-source result? Synthetic walkthroughs do not answer that empirical question.
5. Reconcile with the actual Grey inventory, QA proof obligations, Blue ownership evidence, Security permissions and White/Graph disposition. This isolated agent did not inspect their receipts and cannot manufacture quorum, full journey completeness, independent human review or model diversity.

**Final bounded disposition:** source/document review may proceed with the findings and dependencies above. **Visual-baseline and parity acceptance: BLOCKED / NOT OBSERVED.** The proposal is **not yet reviewable as an authenticated whole-page before/after design**, and no operational or release verdict is issued. Its declared NOT FROZEN status is justified by the evidence available to this receipt. Any informed reconciliation must be a separate dated delta and must preserve this original file and its findings.
