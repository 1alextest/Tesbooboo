# Purple Model Studio recovery — actual 965 build addendum

## Outcome and scope

**Independent inspection of all five actual source-965 CI PNGs is complete. Visual evidence for the full five-state claim set remains incomplete. The refreshed eleven-capture gate is PENDING actual CI output and image inspection.** The Model Studio report records **19/19 expected tests passing**; the missing visual witnesses are evidence gaps, not behavioral test failures. No new runtime or product correctness verdict is inferred from an offscreen control.

This is a separate, immutable addendum to [purple-model-recovery-delta.md](sandbox:/workspace/scratch/fb086055b433/assurance-working/purple-model-recovery-delta.md). The original four-image receipt, capture index, and inputs were rehashed and preserved unchanged. This review does not replace their source/build binding or transfer their pixel findings to source 965: every image below was opened individually with `view_image` and inspected in this turn. One earlier multi-image display attempt was truncated and was not counted as inspection.

Reviewer: `/root/purple_model_recovery_delta`, independently assigned Purple visual/recovery review. Recorded at `2026-11-20T03:59:09.148714+00:00`. No browser, database, services, test suite, or production application was started by this reviewer. No product or test files were edited by this reviewer. Work is limited to existing artifact bytes, report metadata, source reads, and these receipt files.

## Evidence identity and integrity

| Field | Verified value |
|---|---|
| Product source | `965a87a13d2669354598f8d4b912f36fdb148867` |
| Actual CI merge build | `e49fab4df4043b621b7007e97d8646743f441b6b` |
| Source and actual-build tree | `b3c497bdb7a43cd43e8d0535f663c542cba88186` — identical Git trees |
| Build parents | `6897f989b055a955280f810c7daace86f74057fa` and source `965a87a13d2669354598f8d4b912f36fdb148867` |
| CI run | [44667829454](https://github.com/1alextest/Tesbooboo/actions/runs/44667829454) |
| Archive | [ci-smoke-evidence.zip](sandbox:/workspace/scratch/fb086055b433/tesbo-ci-evidence/965a87a1/ci-smoke-evidence.zip) |
| Archive SHA256 | `606d02869014f699136eec46ef830bd630cc15df8527593d60660539b2b2bfd3` |
| Archive size / entries | 36,776,144 bytes / 247 entries |
| Model report HTML SHA256 | `d42deb0aeb53b4ef7493139fadab035b7c120c8db26d73b2990754c224e4b4aa` |
| Embedded report JSON SHA256 | `31403f3f04cfaa2bd316a2aa298894c10d59840dde5b85305d4ce82b7ebce0f6` |
| Recorded Model result | 19 total; 19 expected; 0 unexpected; 0 flaky; 0 skipped; no report errors |
| Breakdown | 10 API tests and 9 UI tests; actualWorkers 2 |

Attachment names, test IDs, original source locations, outcomes, status, and retry numbers were mapped from the HTML report's embedded ZIP/JSON, not guessed from PNG basenames. Every extracted PNG was byte-compared with its unique entry in the authenticated archive and independently hashed. The three tests owning the five PNGs all record `passed`, `expected`, retry `0`.

The report metadata binds the actual merge commit and run above. Git object inspection separately confirms the source/build tree equivalence. These scoped results do not assert that the entire smoke workflow or every other product surface passed. The archive is the supplied authentic CI artifact; this reviewer did not originate the CI run.

## Actual five-capture index

All five images are 1280 × 720, visibly in the light theme. The real Tesbo sidebar, organization context, and top bar remain in the frames. Source configuration uses the UI project's Desktop Chrome device. The actual smoke log records Ubuntu 24.04.5 and installation of Chrome for Testing / Headless Shell 149.0.7827.55, Playwright Chromium v1228. Runtime user-agent probing was not performed. This is desktop synthetic CI coverage, not production, mobile, or theme parity evidence.

| ID | Actual attachment name | Actual PNG | SHA256 |
|---|---|---|---|
| N1 | `model-run-outcome-unknown-after-reload` | [53d423c5986e31774bb4433b864889ae478d5d63.png](sandbox:/workspace/scratch/fb086055b433/tesbo-ci-evidence/965a87a1/home/runner/work/Tesbooboo/Tesbooboo/e2e/playwright-report-model-studio/data/53d423c5986e31774bb4433b864889ae478d5d63.png) | `3c3e0183ed1c5ab69edf7940f840e521f9b75d4b46b158895f5e796fa493362e` |
| N2 | `model-run-reconciled-historical-revision-retained` | [dc0d8553deb4247bcd68540600dc5dfd2afeea48.png](sandbox:/workspace/scratch/fb086055b433/tesbo-ci-evidence/965a87a1/home/runner/work/Tesbooboo/Tesbooboo/e2e/playwright-report-model-studio/data/dc0d8553deb4247bcd68540600dc5dfd2afeea48.png) | `29aeeb2a0e32468b64b12ab70f05a1af0ee4a43a9a47e98c988f60ce7fbe1bcd` |
| N3 | `model-coverage-unavailable-draft-retained` | [bfaf892aa56d46a120287cfbac505288b0c40243.png](sandbox:/workspace/scratch/fb086055b433/tesbo-ci-evidence/965a87a1/home/runner/work/Tesbooboo/Tesbooboo/e2e/playwright-report-model-studio/data/bfaf892aa56d46a120287cfbac505288b0c40243.png) | `5a39668ae9b10fe1f8f6429bceb61bc73fa80b8a123180817f64b31b32484dba` |
| N4 | `model-coverage-recovered-selection-retained` | [9aa396a675da4c7e8b0fbbef5552f7b4b4741d69.png](sandbox:/workspace/scratch/fb086055b433/tesbo-ci-evidence/965a87a1/home/runner/work/Tesbooboo/Tesbooboo/e2e/playwright-report-model-studio/data/9aa396a675da4c7e8b0fbbef5552f7b4b4741d69.png) | `69078428c0f786467b54095d2a8d64e7415b190e0ff20628cf59a37e440e1c03` |
| N5 | `model-original-occurrence-unavailable-after-native-readd` | [0882b179c1c174070022da417f63190d5c280798.png](sandbox:/workspace/scratch/fb086055b433/tesbo-ci-evidence/965a87a1/home/runner/work/Tesbooboo/Tesbooboo/e2e/playwright-report-model-studio/data/0882b179c1c174070022da417f63190d5c280798.png) | `05506d4470b585b4ccf2104700c641becd174f446192a3ff9fa0257eb1af6d69` |

The exact test mapping is preserved in [purple-model-965-capture-index.json](sandbox:/workspace/scratch/fb086055b433/assurance-working/purple-model-965-capture-index.json). N1/N2 belong to the lost-response recovery test at original source line 74; N3/N4 belong to the coverage retry test at original source line 248; N5 belongs to the governed-run test at original source line 448. These are original source-965 report locations, before the pending capture additions.

## Direct image observations

| ID | What the actual pixels show | What the pixels do not establish | Scoped finding |
|---|---|---|---|
| N1 — outcome unknown after reload | Top Model Studio host, selected lost-ACK model, approved revision 2, revision selector, content hash, and graph. | The unknown-outcome warning, Inspect existing runs action, retained inputs, and disabled Start control are below the frame. | **Evidence gap:** host context only for this named recovery state. |
| N2 — reconciled with historical revision retained | Lower Model runs panel, selected case, the native-reconciliation confirmation and actual native-run link, governed-run row with Untested 1, and observed finish / Untested 1. | The historical revision selector is above the frame. The title does not prove its selected value. | **Partial visual witness:** reconciliation and link visible; historical selection still needs its companion image. Empty optional fields shown after reconciliation are not characterized as a draft-loss defect. |
| N3 — coverage unavailable, draft retained | Case mappings and Model runs show the explicit synthetic coverage-denied explanation; Retry coverage is visible; run-name input is populated; Environment reads QA coverage recovery; Start run is visibly disabled. | A still image does not prove retry behavior or absence of a native write. The long run-name value extends past the visible input width, so its exact full value is supported by the recorded assertion, not every glyph in the PNG. | **Useful visible witness** for the denial warning, retained populated form, retry affordance, and disabled action in this state. |
| N4 — coverage recovered, selection retained | Restored mapping rows for the included and excluded cases, both linked to finish, plus linked-case history showing never run. Only the start of Model runs reaches the frame bottom. | The checkbox checked/unchecked states, retained run inputs, and enabled Start control are outside the frame. | **Evidence gap:** recovery of mappings/history is visible; the named selection/form claim is not. |
| N5 — original occurrence unavailable after native re-add | Top Model Studio host, selected governed model, approved revision 1, revision selector, content hash, and graph. | The governed-run row, original-occurrence-unavailable count, later-addition explanation, and observed-element area are below the frame. No native-run provenance image exists in this five-attachment set. | **Evidence gap:** no actual visual certification of the new occurrence state from this PNG. |

The recorded test assertions provide a separate behavioral evidence layer. In the governed-run test, the source removes and re-adds the case through native API owners, verifies new execution/item identities, records a Passed result on the later occurrence, and checks the original manifest remains unchanged. It asserts one original occurrence unavailable, no attributed status counts, an empty observed-by-element response, and no observed-results list in the rendered page. The passing report records those assertions. N5 does not visually show their UI witnesses, so this receipt does not call the fifth screenshot sufficient.

## Pending eleven-capture source delta

The capture source was reviewed at observed main HEAD `be0240f413780770c427c4b589a29348d900ec65`. The assigned UI file had **41 added lines, zero removed lines**, with SHA256 **`15408bc8af9e54564f51d412560b2a5eec8302bcd8576b292ff0f7aca965006d`**. Main HEAD advanced after the assignment's initial `62f66ad3` reference; this receipt binds the actual read file bytes and captured diff, not a presumed unchanged HEAD. Other working-tree changes are outside this visual review.

The saved [capture delta](sandbox:/workspace/scratch/fb086055b433/assurance-working/purple-model-965-capture-delta.patch) has SHA256 `05e4b88de6e3cd8655f132f83f63dca947b033e42b3ade5577b89ae81e2baa7b`. It adds six attachments, producing eleven intended attachments, plus scroll/viewport checks. Existing state, readback, duplicate suppression, retained-value, selected-case, historical-revision, original-occurrence, and provenance assertions are retained; no test name or assertion was deleted by this diff.

The original draft used bare `toBeInViewport()`. Installed Playwright's type documentation explicitly says its default ratio is zero and any positive intersection qualifies. That precision issue was reported to the parent, who changed all **21 of 21 new viewport guards to `toBeInViewport({ ratio: 1 })`**. The corrected source was reread and hashed above. The correction is source-reviewed only; actual execution and final image readability remain pending.

The shell's outer `main` is the `overflow-y-auto` scroll owner inside an `h-screen` flex shell. Model Studio has its own inner `main`, but that does not make the outer document a full-height capture. `page.screenshot({ fullPage: true })` alone therefore does not expose the entire application scroll region, as N1/N4/N5 directly demonstrate. The diff uses the real locators' `scrollIntoViewIfNeeded()` to move the actual container, retains shell/context frames, and adds separate witness frames. It does not resize the viewport, fabricate content, expand CSS, crop the product, or stitch an imagined full page.

### Reviewed witness placement

| Claim / target | Actual source owner or locator | Capture arrangement reviewed | Remaining actual-image check |
|---|---|---|---|
| Unknown request + blocked retry | Model runs region → Run request recovery region; its alert and Inspect existing runs button | Host context, then recovery-region scroll with full-intersection checks; then Start/form scroll with full-intersection checks | Warning wording and action must be readable; companion must show retained fields and disabled Start. |
| Historical revision survives reconciliation | Revision combobox; Model runs status and status link | Separate revision-selector image after held detail refresh resolves, followed by status/link image | Selected historical revision and actual native confirmation/link must be readable across the bound pair. |
| Coverage unavailable retains draft | Model runs alert, Retry coverage button, Run name/Environment inputs, Start button | Scroll Start into view and require full intersection for all compact witnesses before the image | Warning, retry, retained values and disabled action must coexist readably; exact long value still comes from value assertion. |
| Coverage recovered retains inclusion/exclusion | Eligible model-case checkboxes named Include + case title; both inputs; Start | Preserve host context; scroll Start and require full intersection for included/excluded checkboxes, fields and button | Checkmark/unchecked state, identifying labels, retained populated fields and enabled single-case action must be legible. |
| Removed original occurrence stays unattributed | Model runs → Governed runs heading; original-occurrence-unavailable text and later-addition explanation | Host frame then governed-run scroll; both text witnesses require full intersection | Original dispatch count, unavailable count, explanation and panel tail should be visible. Empty observed-by-element attribution remains supported by API/DOM assertions; no positive empty-state text is rendered to photograph. |
| Native run preserves original dispatch provenance | Native run page `data-testid=run-model-provenance` | Navigate through the existing test path, retain provenance content/link assertions, scroll provenance and require full intersection | Actual model name/link, revision, originally dispatched count and later-addition caveat must be readable with native run context. |

The current product source supports these locators and wording. Model Studio's governed row says **“1 original occurrence unavailable”** for the fixture and explains that results use original active dispatch occurrences and that later native additions are not attributed to the model run. Observed results by element renders only when the corresponding array is nonempty. The native-run provenance says **“Started from model”**, revision, **“1 originally dispatched case”**, and **“later additions are outside this model dispatch”**, with a real link back to Model Studio. These are actual native component strings, not new labels invented for the receipt.

All eleven intended attachment names in the corrected source are:

| # | Pending attachment |
|---|---|
| 1 | `model-run-outcome-unknown-host-context` |
| 2 | `model-run-outcome-unknown-after-reload` |
| 3 | `model-run-outcome-unknown-retained-disabled-form` |
| 4 | `model-run-reconciled-historical-revision-selector` |
| 5 | `model-run-reconciled-historical-revision-retained` |
| 6 | `model-coverage-unavailable-draft-retained` |
| 7 | `model-coverage-recovered-host-context` |
| 8 | `model-coverage-recovered-selection-retained` |
| 9 | `model-original-occurrence-unavailable-host-context` |
| 10 | `model-original-occurrence-unavailable-after-native-readd` |
| 11 | `model-native-run-original-dispatch-provenance` |

**None of those eleven refreshed attachments is certified by this source review.** Source placement is suitable for the bounded gaps identified here, but only the next actual report/images can establish that all witnesses fit, remain readable, and are attached to passing tests at the intended source/build.

## Bounded source equivalence and limits

SHA256 comparison confirms the inspected source-965 bytes match the current working-tree bytes for the application layout, Model Studio page, native run page, model-run-intent module, and Playwright configuration. The capture test file intentionally differs. Exact hashes are in [purple-model-965-addendum-inputs.json](sandbox:/workspace/scratch/fb086055b433/assurance-working/purple-model-965-addendum-inputs.json). This supports use of the current components to explain scroll owners and intended locators. It is not broad product equivalence, and it does not turn the five earlier screenshots into eleven new captures.

The prior P2 advisory **PUR-MODEL-A01** remains separate. The permanent Model Studio subtitle says a model is “not approved” while the same top-host frame visibly identifies an approved revision. This contradiction is observable again in N1/N5 and remains in the source. It is a content/design advisory for the owning UI team, not an occurrence-attribution failure and not a new release gate.

The unchanged pinned Nesberry Purple charter and portability, whole-page/journey, and assurance-evidence policies were applied with the same scope and adoption limits as the preserved original receipt. Their hashes are carried in the new inputs file. Authentic whole-context evidence and fold awareness remain applicable; page-purpose/placement guidance remains advisory. Operational Purple release gates, ART/FC families, and mockup/mechanical fidelity remain NOT RUN where unratified or unsupported. No Nesberry shell, breakpoint, or marketplace rules were imposed on Tesbo.

No claims are made for broader route parity, production behavior, 320 px reflow, 200% zoom, dark mode, mobile, keyboard navigation, assistive technology, additional roles, or an actual mockup comparison. No simulated or extrapolated full-page evidence was created. The remaining evidence action is to inspect and bind the actual eleven refreshed PNGs from their next CI report, with a further separate receipt if necessary.

## Receipt integrity

| Preserved or companion file | SHA256 |
|---|---|
| Original four-image receipt | `8fa805a79e909e49e022cfd67e432e36b2f9c06f3c2a8bb72d4a7cca96338468` |
| Original four-image capture index | `bb5d7a9b6ee31896ebdcd3fb2579c029026b40b5aa05926f6fb25e819994fec6` |
| Original input hashes | `84c2064bba1a5ebf96ee25cbc1e54b7e417ecb8a1323db2e905d34e85f253a3e` |
| New five-image capture index | `f539b78ff994463730a16656701428758213e0c56df5b0bff199f429c8fabfdb` |
| New addendum inputs | `862f4bfa4481dc701285096953374505a66a214074eab414f9229e5e7c9b713b` |
| Corrected pending capture diff | `05e4b88de6e3cd8655f132f83f63dca947b033e42b3ade5577b89ae81e2baa7b` |
