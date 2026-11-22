# Independent Purple delta — Model Studio recovery captures

**Reviewer:** `/root/purple_model_recovery_delta`, separate from the implementation and capture authors.

**Review cutoff:** 20 November 2026, 03:36 UTC. This receipt covers the supplied source and actual CI evidence available at that cutoff.

**Disposition:** actual visual inspection completed for four authentic recovery attachments. The denial state and reconciled native-run notice are visible and useful. Two named state witnesses are outside the captured view; the historical-revision witness is incomplete. **Completion of the requested recovery visual evidence remains BLOCKED** until those actual views are captured and inspected. This is an evidence disposition, not a claim that the associated passing behaviors failed. Latest-source occurrence-attribution visuals remain pending separately.

## 1. Method, application binding and review boundary

Method: unchanged NesberryEnterprise/Nesberry `d83549c85a4dcd047fb40dc4fba4ec62737ab0fc`, supplied in `assurance-method-inputs/`. I read the full `.claude/agents/purple-team.md`; the charter's mandate/current-adoption split, `PUR-BASELINE-001/002`, §5, §6, `PUR-SLOP-019` and severity section; the applicable orchestration portability, sequence, live-safety, current-UI evidence and Purple sections; and the whole-page, portability and assurance-evidence policies. Input hashes are recorded in `purple-model-recovery-inputs.json`.

The active/advisory split remains unchanged: truthful whole-context evidence under `PUR-SLOP-019` and `PUR-PLACE-011` is binding for its applicable artifact; page-purpose and placement findings are **ADVISORY**. Unratified `PUR-GATE-001`, `ART-*`, `PUR-FC-*`, operational adoption and an overall release verdict are **NOT RUN**. The two indirect files `.kiro/steering/ux-ui-sanity.md` and `shared-vocabulary.md` are absent from the supplied subset; I do not claim to have read them. The supplied policy and agent retain their stated obligations.

This is a built Tesbo browser surface, with its own sidebar, top bar, model list, selected revision and native run destinations. No Nesberry storefront shell, marketplace actors, footer or breakpoint is imposed. The governing user question is: **did this exact request create a native run, what remains uncertain, and how can I recover without losing my draft or replaying an unknown write?** The actor in these captures is the isolated E2E Smoke Org owner. The scoped user decisions are native-run identification, historical model selection, coverage retry and eligible case selection.

The target contract is the original eight-file v1.4.28 package, particularly `00_README.md` P-08/P-13, `02_WORKFLOW_AND_UX_SPEC.md` ASER-UX03 (706–722), and `07_UI_DESIGN_TASKS.md` D-09. Unavailable coverage must not become empty coverage; uncertain writes must lead to authoritative readback; draft work and exact historical context must survive. The broader original external QA loop, protected policy and full platform acceptance are outside this four-capture delta.

I read the prior actual `assurance-working/purple-native.md` receipt, SHA-256 `5788d5554931fce22b46559dbd76f9c482bfd3952a9f787d700568eff2c35520`, as an earlier scoped record. Its 37-image inventory and older Model Studio visual gap are not images re-inspected by this reviewer. I opened exactly the four PNGs below with `view_image`, recomputed hashes, checked their ZIP membership, decoded the actual Playwright report, and inspected the specified source. No product/test/method edit, database, service, browser session or external executor was started. The existing CI executed the tests; I did not rerun them. A read-only fetch obtained the old merge Git object to verify tree identity; no branch, worktree content or product configuration was changed.

## 2. Exact source/build and capture provenance

| Fact | Verified identity |
|---|---|
| Source | `6d921151498e2a52b244ade4efd19efd7ecbf71b` |
| Actual CI PR merge checkout | `375f0895f4e1bf106a1772dee34fe7880ab0461b` |
| Source and merge tree | Both `e733ff65d25d7c2e8934b2f9b2f87665a1efb1af`; verified from Git objects |
| Merge parents | Development `6897f989b055a955280f810c7daace86f74057fa` and source `6d921151498e2a52b244ade4efd19efd7ecbf71b` |
| CI run / job | `44665137189` / `136052473874` |
| Model Studio report | 18 expected / 0 unexpected / 0 flaky / 0 skipped; 9 API and 9 UI; actualWorkers 2 |
| Attached tests | Both passing, retry 0; each supplies two attachments |
| Runner | Ubuntu 24.04.5, runner image `ubuntu-24.04` version `20261111.127.1`, recorded in smoke log 11–18 |
| Browser context | UI project uses Playwright `Desktop Chrome`; CI installs Chrome for Testing `149.0.7827.55`, Chromium build `v1228` (log 1213/1225). No independent runtime user-agent interrogation was performed. |
| Visible viewport/theme | Every PNG is 1280×720; actual pixels show the light theme and authenticated Tesbo shell |

Run: https://github.com/1alextest/Tesbooboo/actions/runs/44665137189. The embedded report's `ci.commitHash` and `gitCommit.hash` both identify the merge above; its subject explicitly identifies source and development parents. The later email-stage cleanup failure remains a failure of that run. It does not erase the separately recorded Model Studio 18/18 result, and that 18/18 does not make the whole smoke workflow pass.

Archive: `/workspace/scratch/fb086055b433/tesbo-ci-evidence/6d921151/ci-smoke-evidence.zip`, 45,291,728 bytes, 275 entries, SHA-256 `deb8e12ae99ce8e54e021e36649e2b93dd11f51b20f6bd7fa8f664e305f61cec`. Every inspected PNG's extracted bytes equal its exact ZIP member.

The actual Model Studio report `index.html` hashes to `09dbe9628fe2bb6eeca76f450d83cf719743c71b010d1a2ecc13370b866f8713`; embedded `report.json` hashes to `a650831f6797d0e363e90030669f24eb747727116f13dfadb7cc9d01e13ad5f9`. Report extraction is an analysis copy, not a rewritten result. The capture index preserves exact paths, attachment names, test IDs, statuses, dimensions and file hashes.

All image paths below share this exact prefix:

`tesbo-ci-evidence/6d921151/home/runner/work/Tesbooboo/Tesbooboo/e2e/playwright-report-model-studio/data/`

| ID | Actual attachment / PNG filename | SHA-256 |
|---|---|---|
| MR1 | `model-run-outcome-unknown-after-reload` / `2368db980225296f3c7d42ee65266bd344853c50.png` | `20decf8979a2e62a8e14eb0bb01daa3d32bfdf772d0bab09eeb90d57c78491c5` |
| MR2 | `model-run-reconciled-historical-revision-retained` / `bb2ae1510682e2761f5028b1af89d3f57f215362.png` | `8a35a75d7d9c81481cbfcfdc1d57d5f95a1b33603665c6af0eed879557911475` |
| MR3 | `model-coverage-unavailable-draft-retained` / `29064c75718db0b014f8fc204cd93545d44779ac.png` | `1a658c1c95f823f15f395cf66389f856acce02cd208790a1b03de3acdf57ab45` |
| MR4 | `model-coverage-recovered-selection-retained` / `d23897df0a5c49bee73025f8497e9cff33c17a71.png` | `1d912b283af46e49350941e817da587df61ec282a3c61f0d9f313b63b3b28204` |

MR1/MR2 belong to `e2e/ui/model-studio.spec.ts:74`, test ID ending `fdc72cff6e9d837958b9`. MR3/MR4 belong to the coverage-recovery test at line 248, ID ending `12e2b0712cda79aa7058`. Both full IDs are in the index. No attachment from another test was substituted.

## 3. What the four images actually show

**MR1 — host and model identity visible; named recovery state outside the frame.** The visible screen shows Model Studio, the selected lost-ACK fixture, approved revision 2, revision selector, content hash and the graph. The sidebar and top bar orient the user. The unknown-outcome warning, saved run inputs, disabled Start and Inspect action are below the visible area. This image is an authentic host/model witness; its attachment name does not establish visual inspection of the unknown-run state.

**MR2 — reconciled notice and native run visible; historical selector outside the frame.** The lower workspace visibly says the identified native run's model basis and cases were read back, supplies its native-run link, shows a governed run with Untested 1 and explains that outcomes are not behavioral verification. This is meaningful recovery feedback. The revision selector is above the visible area, so the PNG does not prove it retains historical revision 1. The passing test separately asserts the selected value after the held detail response is consumed; source/test evidence and pixel evidence remain distinct. The empty optional fields in this reconciled view are not treated as draft loss: the submitted request was explicitly reconciled, and this receipt does not invent a requirement that its completed intent remain an editable pending form.

**MR3 — denial, retained form and safe next action visible.** The actual image shows Case mappings and Model runs explaining that coverage is unavailable, the deliberately injected text `Synthetic coverage read denied`, a Retry coverage button, the entered run name and `QA coverage recovery`, and a disabled-looking Start run. The named scope and next step are adjacent. The source confirms a test-injected 403, while the retry later uses the genuine GET. This is rendered fault-injection evidence; it is not a screenshot of a naturally occurring production permission failure. The test's zero-request/zero-native-run assertions are the separate forbidden-effect evidence.

**MR4 — returned mapping data visible; recovered selection/form outside the frame.** The screenshot shows two linked case rows and their `never run` linked-case history. At its bottom, only the beginning of Model runs is visible. The checked/excluded inputs, retained name/environment and enabled Start control are below the frame. It establishes that mapping data returned, but it does not visually establish the selection-preservation claim in its attachment name.

The capture mechanism explains these gaps. Tests at 6d lines 127, 161, 307 and 323 call `page.screenshot({ fullPage: true })`. Tesbo's actual app layout at `Tesbo-Frontend/app/(app)/layout.tsx:14–18` uses an `h-screen` shell and an internal `<main className="... overflow-y-auto">`. The browser document capture retains that internal scroll position; it does not expand the workspace's offscreen content. `toBeVisible`, `toHaveValue` and text assertions do not establish that the witness is within the screenshot viewport. The observed gaps are not inferred merely from the 1280×720 dimensions: I inspected the actual pixels and source owner.

## 4. Whole-context and current-source disposition

No Now/With mockup is supplied. Nesberry's `check-mockup-delta.mjs` and `check-mockup-fidelity.mjs` are **NOT RUN**; no applicable Tesbo capture adapter was supplied, and no mockup-parity result is invented.

| Applicable whole-context check | Disposition | Evidence / limit |
|---|---|---|
| 1. Actual host context | **PASS for the visible host; BLOCKED for complete state content** | All four images retain sidebar/top bar and actual workspace. MR1/MR4 omit the named state; MR2 omits the selected-revision witness. |
| 2. Authentic identified running surface | **PASS for the named isolated CI build; production parity BLOCKED** | Archive/report/Git identities and actual PNGs agree. No production capture or deployed parity comparison was made. |
| 3. Declared change and preserved regions | **SOURCE-INSPECTED; comprehensive visual parity BLOCKED** | Preserve shell, list/revision controls and native destinations; extend existing run-recovery/coverage states. No matching pre-repair visual baseline exists here. |
| 4. Material steps, actors and branches | **BLOCKED for full requested visual completion** | Four attachments from two owner-fixture tests; two missing state witnesses, one partial. Other passed tests have no inspected screenshots in this packet. |
| 5. Entry/list/return context | **PASS for visible controls; broader journey BLOCKED** | Model list visible in MR1, native link in MR2. Tests use direct page navigation; complete discovery, back/filter/focus continuity is not pictured. |
| 6. Supported widths and fold | **PASS for identifying the actual desktop viewport; responsive/AT scope BLOCKED** | 1280×720 light theme only. No mobile, 320px reflow, 200% zoom, dark theme, keyboard/focus or screen-reader audit was performed. |
| 7. Exact evidence and authority context | **PASS for inspected file associations; wider roles BLOCKED** | ZIP members, PNG hashes and passed test associations verified. A disposable owner is not the full human/machine permission matrix. No invented admin counterpart is required. |

New source `965a87a13d2669354598f8d4b912f36fdb148867`, tree `b3c497bdb7a43cd43e8d0535f663c542cba88186`, was source-inspected in the immutable `tesbo-review-965a87a1` worktree. The app shell, browser configuration and run-intent module are byte-identical to 6d. The test prefix containing both recovery tests is also identical (SHA-256 `957cc0827e098416d0135d488110607f6c714984efa109db4b0855a7c05db555`). The Model Studio page changes linked-case history wording and the occurrence-bound run displays; the governed-run UI test adds a remove/re-add lifecycle and a fifth attachment. This supports bounded source continuity of the existing recovery code, not current-build pixel or runtime acceptance.

The fifth capture is authored after reload/model selection and text assertions, without an explicit in-viewport witness. The internal-scroll mechanism could therefore recur; this is a source-supported capture-risk prediction, not an inspected 965 image or claimed 965 failure. Its actual CI build/images must be inspected separately.

## 5. Findings and exact capture repair guidance

| Finding | Classification | Evidence and required next evidence |
|---|---|---|
| PUR-MODEL-E01 | **Capture coverage gap** | MR1 omits unknown warning/form and MR4 omits selection/form. MR2 omits historical revision. Keep each authentic attachment and add properly positioned whole-viewport witnesses in the real UI, preserving the existing passing assertions. No behavioral failure is inferred. |
| PUR-MODEL-A01 | **ADVISORY P2**, `PUR-PURPOSE-002` / `PUR-PLACE-006`; Tesbo truthfulness | MR1's permanent subtitle says “A model is not approved, execution evidence or verified coverage” while the same screen displays revision 2 approved. Source at 6d/965 `model-studio/page.tsx:608–609` is unconditional. Distinguish definitions, exact approval and observed evidence without saying an approved model is unapproved. This existing copy contradiction is separate from the occurrence repair and is routed to the UI/content owner. |

Capture placement should use the existing semantic locators and actual internal scrolling. Preserve the shell and record a sequence of genuine viewport captures when all witnesses do not fit. Do not change CSS, fabricate expanded content or stitch a synthetic “full page.” A screenshot can establish visible state; existing DB/API/DOM assertions retain their separate enforcement role.

| Claim | Actual source-owned witness and capture position |
|---|---|
| Unknown request after reload | `runs = page.getByRole("region", {name:"Model runs", exact:true})`; `recovery = runs.getByRole("region", {name:"Run request recovery", exact:true})`. Scroll recovery into view and capture its alert, requested revision/name/environment and Inspect existing runs. Add a companion scrolled to the retained run fields and disabled Start if they do not fit together. Source 965 page 1024–1049; test 6d 116–127. |
| Reconciled run and historical selection | After the existing detail-busy/value assertions, scroll `page.getByRole("combobox", {name:"Revision", exact:true})` into view and capture the visible historical option with model identity. Then scroll `runs.getByRole("status")` and capture its exact native-run link. These are two positions in one unchanged state. Source page 721–736/1183–1186; test 6d 148–164. |
| Coverage unavailable | Scroll the existing Model runs region; capture its alert, Retry coverage, both field values and disabled Start. MR3 already shows this state, but explicit positioning makes the witness intentional. Source page 1018–1022 and form; test 6d 297–307. |
| Coverage recovered and exclusion retained | Scroll `runs.getByRole("list", {name:"Eligible model cases"})` and verify both `Include ...` checkboxes are within the viewport with the expected check states. Capture retained fields and enabled `Start run with 1 case`; use a companion position when necessary. Source page 1101–1178; test 6d 313–323. |
| Original occurrence unavailable after native re-add | On actual new-source completion, scroll the Governed runs heading/matching row within `runsAfter`; capture `1 original occurrence unavailable`, original dispatch count and the later-additions explanation. Keep the DOM absence assertion for `getByRole("list", {name:"Observed results by element"})` and the API/DB/manifest assertions. A screenshot alone cannot prove absence outside its frame. Source 965 page 1188–1244 and new governed-run test block. |

Before each attachment, require the relevant witness to be **in the viewport**, rather than only DOM-visible. Existing `scrollIntoViewIfNeeded()` and `toBeInViewport()` can make that capture precondition explicit; the author should determine whether one position or companion shots are required at the fixed viewport. These are recommendations, not actions performed by this reviewer.

## 6. Remaining evidence and conclusion

The actual four-image review closes the earlier blanket statement that no persisted Model Studio images exist: genuine images now exist, and their exact content is recorded. It does not close the named visual obligations that are still outside the captured frame. The associated Model tests remain 18/18 at source 6d/merge375; no pass was converted to failure, and no older build is promoted to certify965.

Next bounded evidence is the corrected actual viewport sequence on an identified source/build, plus the new unavailable-original-occurrence capture. Purple should inspect those bytes and preserve this receipt as the earlier checkpoint. The broader authentic Before/After parity, responsive/accessibility matrix, other actor/journey states and original external QA round trip remain at their existing scope-specific gates. This receipt issues no unratified release gate, Graph result or overall native-governance approval.

Companions: `purple-model-recovery-capture-index.json` and `purple-model-recovery-inputs.json`. They preserve exact file identities; the report itself is the independent interpretation and disposition. Original PNG/archive/report bytes and earlier receipts are unchanged.
