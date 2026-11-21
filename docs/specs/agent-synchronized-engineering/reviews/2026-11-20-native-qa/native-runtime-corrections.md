# Native retest runtime findings and corrections

## Evidence boundary

This is a later correction record. The earlier source-review receipts and their hashes remain unchanged. Source review did not catch the recovery-trigger focus defect subsequently demonstrated by the real browser.

The first full impact run used PR head `aede3e951d26b99b09263883db9e08d15f6abe6f` in actual GitHub merge checkout `174ed8d62d55161035c30a4556f09d02f28cec30`, with integration base `8c254130384c7d6ae93dd7f10b9bfa271007e224`. [Smoke job 136150848945](https://github.com/1alextest/Tesbooboo/actions/runs/44695397891/job/136150848945) selected 256 tests in nine files, requested ten workers, used nine active file workers, and applied zero retries to this selection. It reported 160 expected outcomes, 84 unexpected failures, three explicitly skipped tests and nine not run after fixture setup failed. The 160 includes the pre-existing expected-failure billing-copy case; that result is not verified billing behavior.

The next published head, `644ab9616905af6ac832a098ab44656aa7faa1eb`, corrected the architecture and scanner findings but did not contain the runtime corrections in this record. Its [smoke job 136154856597](https://github.com/1alextest/Tesbooboo/actions/runs/44696639534/job/136154856597) actually checked out `e92b6668dfaa8d5bc4cb9fc1937d7a2e9a34aac0`, merging that head with development `5f880177c6dc79f6eeb849e9daa22ef4e920efef`. It repeated the same aggregate result. One shared-project summary race passed on this run while the shared-project sequential-number test failed; neither outcome establishes a deterministic fixture. The other 83 failed identities were unchanged. All other 24 check runs for that head passed, including 639 migrated-database tests and the full architecture and scanner controls.

Both runs passed all nine new native retest API scenarios and both retained-source route-resolution scenarios. Both passed 13 of the 16 new native UI scenarios. These are earlier-revision results, not acceptance of the later corrections.

Before corrective publication, development advanced to [d74ddce2](https://github.com/1alextest/Tesbooboo/commit/d74ddce2d04241695164b5a8b4d9b341932cfdcc). An independent freshness review verified its two-file delta: native model evidence counts distinct execution IDs and emits one summary per testcase, preserving all mappings; one real-database regression distinguishes mapping fanout from two actual executions. Source and retest executions remain distinct observations. No native writer, retest disposition, approval, authorization or plan-admission contract changes. The next actual synthetic merge must carry its own checkout and database totals; the earlier 639 count is not projected onto it.

The first evidence artifact is `ci-smoke-evidence`, ID `14612411648`, SHA256 `a70c6303e42e24dd033a19e9b30e252b54f2de7644d4aeebb6e4ed850fc6ef57`. The second artifact is ID `14612482982`, SHA256 `45e8f8f0ac8d2ccb09e1274893713dadbe33392c7c24ba4d1e491f7405748043`. The first artifact's six distinct successful native screenshots were visually inspected: selected-definition review, Untested destination, source observation in drawer and full page, deleted-source recovery, and custom-field definition comparison. Two other configured screenshots were not produced because their definition-edit fixtures failed. Final corrected-head screenshots and browser outcomes remain required.

## Third runtime: corrected focus and fixtures

[Smoke job 136177365716](https://github.com/1alextest/Tesbooboo/actions/runs/44703524270/job/136177365716) tested feature head `cab1c6928b32f6f7b74b30dbf75879ef127628be` in actual merge checkout `d5f1175644900b28845afdb4ed413c85f25454c0`. Its parents are development `d74ddce2d04241695164b5a8b4d9b341932cfdcc` and that feature head. All prerequisite smoke stages passed, but the complete impact selection remained red. Of 25 check runs, 24 passed and the smoke check failed.

| Scope | Selected | Actual passes | Expected failure | Unexpected failures | Explicit skips | Not run |
|---|---:|---:|---:|---:|---:|---:|
| Native UI | 20 | 18 | 0 | 2 | 0 | 0 |
| Native retest API | 9 | 9 | 0 | 0 | 0 | 0 |
| Native retained-source resolver | 2 | 2 | 0 | 0 | 0 | 0 |
| Complete impact selection | 260 | 198 | 1 | 50 | 2 | 9 |

There were no flaky or unclassified results. All original sixteen native UI scenarios and both added created-terminal focus cases passed. Both cancelled-terminal cases stopped during setup: their POST returned the established HTTP 201 with a valid cancelled receipt, while the new fixture incorrectly expected 200. The controller has no 200 override, and the existing exact-201 API cancellation case passed. The corrected fixture requires exactly 201 in both POST branches; it retains the receipt identity, reload, keyboard-focus and delayed-create cancellation assertions. Those two focus assertions did not execute in this run. The earlier source-review receipts remain unchanged; this later finding is not retroactively erased.

All nonbilling API files passed: cycles 47/47, executions 16/16, route resolution 18/18 and plans 13/13. Billing contributed 19 API and 16 UI unexpected failures. The two explicit skips are the existing Stripe Checkout/Portal write opt-ins. The pre-existing expected-failure billing-copy test stopped at the missing Billing heading, before its named copy assertion. Thirteen other legacy UI failures and nine cases blocked by their shared filter setup are classified below.

The artifact is `ci-smoke-evidence`, ID `14615375446`, 77,394,100 bytes, SHA256 `caa6a9f440266167825415bcc4cfd8d6270c85359644f2f7619524e1a6d37c4c`. Its downloaded bytes were verified before extraction. All eight unique native screenshots belong to passing tests and received independent visual inspection: the earlier six views plus fresh review after stopping an uncertain request and changed-definition comparison. The captures show readable native content without observed overlap; comparison captures are at different scroll positions. They do not certify cancelled-terminal focus, other viewports, or a later head.

On the same actual merge, behavioral quality passed 158 migrations and 640 real-database tests with zero database skips. API/MCP had 326 passes and eight existing gated skips; transactional coverage had 72 passes and 90 existing gated skips. Those separately gated Review Board suites also ran in the smoke prerequisites. Architecture passed 114 policy tests, 785 modules with no forbidden edges, no baseline expansion and no new clone. The default secret detectors and the exact-exception positive/negative controls also passed. These are cab1/d5f results, not certification of the next correction.

## Fourth runtime: all native scenarios passed

[Smoke job 136195888722](https://github.com/1alextest/Tesbooboo/actions/runs/44709080965/job/136195888722) tested feature `228a06a30156c8e3fee09938d0d0262cdd552e61` in actual merge `d53ed043a7203475605b8e4a93ccfc29baae35a3`, with development parent `d74ddce2d04241695164b5a8b4d9b341932cfdcc`. The merge tree is `eff016e4ee52210527acad03c72099949b73703e`; the feature tree is `19ca18524e7236ec0893aaebb0134feedfc6429c`. Their four-file difference is the previously reviewed upstream Model Studio and PR #172 test work, not a change to the frozen native product or selected files.

**All 32 native scenarios passed: 21 UI, nine API and two retained-source resolver cases.** Both cancelled-terminal focus variants reached and passed their real reload/focus/fencing assertions. The new null-environment retest-to-Edit journey passed, including disabled Save before choosing an environment, persisted target metadata, unchanged source observations and unchanged creation manifest. All ten filter cases ran and passed; none remained blocked by setup.

The full selection was **261 = 220 actual passes + one expected failure + 38 unexpected failures + two explicit skips + zero not run**. The report's 221 expected outcomes include the expected-failure billing-copy test. There were zero flaky or unclassified report outcomes. All nonbilling API files passed, and readable-URL tests passed 12/12. The unmodified timing-sensitive prefetch implementation's pass in this run is not a repair of the duplicate-read defect demonstrated in the earlier run.

The unexpected failures comprise 35 billing failures due to the missing enabled fixture, the recorded remote-ticket title defect, and two newly reached selector errors:

| Selected case | Actual evidence | Bounded test correction |
|---|---|---|
| Plan Create Run environment persistence | The environment assertions pass, but the name fill waits for `form input[type="text"]`. The existing Plan form contains one textbox whose Input does not emit an explicit type attribute. | Identify that owning form's single textbox by role, retaining environment selection, created Run visibility and API persistence. |
| Failed+Save then Link Existing Bug reopens the drawer | Picker title and selection now pass. The final nonexact `Link Bug` button query matches both the background testcase button and the actual footer action. The failure log identifies the exact action. | Require exact `Link Bug`, retaining the link, automatic drawer reopen, exact key and title assertions. |

No product change follows from those two selector errors. The [head-bound runtime classification and exact correction receipt](native-ui-228a-selector-correction.md) records the actual assertion steps, trace DOM and frozen two-line patch. The [independent selector review](native-ui-228a-selector-independent-review.md) found no source blocker, verified unchanged product/native bytes and independently recollected the same selection. The full 261-case selection and its existing timeouts/retry policy remain unchanged. The next exact-head run must reach the later assertions; their existence is not a pass.

All 26 prerequisite smoke stages passed, and 24/25 check runs passed; only the impact step made smoke red. The fresh behavioral logs independently confirm this actual merge, 158 migrations, 640 database passes/zero database skips, 326 API/MCP passes/eight existing gated skips, and 72 transactional passes/90 existing gated skips. Architecture and full-tree scanner controls also passed at this merge.

Artifact `14616593698` is 81,175,198 bytes, SHA256 `51f38ee801f60362a9ee772dbf3307e89c0077667025dbd89c8b0f1287a839ce`; its downloaded bytes were independently verified. The completed job log SHA256 is `f321bc15b56aa9c1e6b04a6c39ccd5f9888e3b61b6e0d660a6bf73845bc23add`. All eight expected native PNGs were produced by passing cases and their extracted hashes verified. Final visual acceptance is deferred to the next selector-only head; no screenshot pass is inferred from extraction.

## Confirmed native corrections

| Finding | Concrete cause | Correction and preserved claim |
|---|---|---|
| Two real definition-edit fixtures received 404 | They called PATCH; the existing testcase update controller and client use PUT | Use PUT, retaining the actual edit, human reapproval, stale-review refusal, new request identity and changed-definition acknowledgment checks. |
| Escape closed recovery but lost keyboard focus | Opening the dialog unmounted the recovery banner before the opening layout effect captured its trigger | Retain recovery-origin intent before opening and restore an existing focus target after the closed render. The existing focus assertion, containment and keyboard navigation remain required. |
| A terminal recovery close removes the banner entirely | Closing a validated created/cancelled outcome clears that terminal UI state, so the pending-only focus target no longer exists | The Run page owns stable references to its selected action, heading and Back to Test Runs link. A stable callback restores a surviving target after refs attach; source loading also exposes the existing Back action. Four additional real-server scenarios cover created/cancelled outcomes with available/deleted sources after reload without selection. |

The focus correction belongs in the existing retest interaction. It does not rewrite the shared Modal or change creation, cancellation or recovery authority. No failed test is removed, skipped, given a broader matcher, retried or given a longer timeout to hide this defect.

The [author's exact terminal-focus freeze](native-runtime-ui-author-freeze.json) and [independent correction review](native-runtime-ui-review.md) bind the three changed files and four new scenarios. Independent source inspection found no blocker and verified unchanged original assertions. The four browser cases wait for a loaded or unavailable source; the same-commit/loading ref race is covered by source inspection, not a separately forced runtime interleaving.

## Coupled verification repairs

The broad selection is retained because the new transaction-bound entitlement check reaches plan/billing behavior and the Run/execution surfaces. Actual error bodies, traces and existing authoritative owners distinguish incorrect setup from a product failure. The following repairs allow the original selected assertions to reach the behavior they intend to test:

- Six plan-rollup scenarios and older execution fixtures created Draft cases, ignored `409 TESTCASE_APPROVAL_REQUIRED`, and then used missing execution identities. They now use the existing real approval helper and assert successful exact attachment. The Approved gate and original rollup, result, evidence and Bug assertions remain.
- The export authorization test expected 401/403 although the established authentication owner returns 400 with `Authentication required`. The corrected case asserts that exact refusal, real authenticated CSV export, foreign-account refusal, and refusal after deletion, as already promised by its title.
- Disposable project names exceeded the existing 30-character limit and a priority fixture exceeded its eight-character limit. Short, unique fixture values and setup-response assertions address the demonstrated 400 responses.
- Several tests expected obsolete UUID-only navigation or matched background controls, an empty framework route announcer, a title instead of a drawer heading, or an unscoped status filter. Correct selectors identify the current readable route and actual user control while preserving the intended visibility, persisted identity and state checks.
- Shared-project summary and consecutive-number checks compete with other selected files creating and deleting Runs. Their exact aggregate/sequence assertions need an isolated project, rather than a weakened comparison or reduced worker count.
- Bug-picker cases must follow the real explicit Log bug action, search the intended row, and seed the exact execution relationship being asserted. A local result choice is not a saved observation; linking a Bug must preserve the recorded result. The existing native owner and baseline tests establish that distinction.

These are test corrections backed by concrete fixture or selector evidence. They are not evidence that every previously unreachable assertion will pass. Only the corrected full-file runtime can establish that.

### Further concrete test repairs after the third run

- The Run-filter fixture's noncanonical Type exceeded the existing 32-character limit. Its shorter unique value still tests noncanonical filtering. The prior Priority correction exposed this second setup error; the nine blocked cases are not counted as passes.
- The Run/Plan environment cases matched several Create controls on the page. Form-owned submit controls and the Plan header entry action identify the intended controls while retaining exact option, disabled-state and persisted-environment assertions.
- The existing-bug picker is titled `Link existing bugs`. The stale singular title prevented its real checkbox/Add Selected/link assertions from running.
- The deterministic two-file automation fixtures have DOM text `Evidence(2)`. The preceding correction to exact `Evidence` was itself wrong; the accessibility snapshot's spaced presentation also cannot be used as the DOM exact-text selector. An isolated transpile/server render of the actual header confirmed `Evidence<span>(2)</span>`. The exact populated label preserves screenshot, trace download, no-spinner and once-only evidence-request assertions.
- The current settings writer rejects malformed environments and normalizes a string input into a JSON object. Legacy reader coverage must therefore arrange actual old stored shapes through the existing bounded database fixture transport, rather than claiming that a successful current PATCH stored a string or admitting malformed input. Only freshly generated, owner-bound disposable projects are eligible; real API readback must confirm the exact legacy shape, and the current writer's refusal remains asserted. Shared project settings are not modified.

The [complete failure/repair receipt](native-ui-second-ci-legacy-review.md) preserves the initial source freeze. Its [corrective addendum](native-ui-second-ci-legacy-addendum.md) supplies the final exact DOM selector and the portable CTE/SELECT fixture return, without changing any owner predicate. Independent fixture review confirms the final legacy prefix, real API readbacks and unchanged valid assertions. Existing cleanup remains attempted through the original owner; no new runtime cleanup success is claimed before CI.

### Coupled nullable Run edit defect

The native retest input deliberately permits an empty environment. The native request normalizer and shared creation helper persist it as null. The existing Run-list Edit handler then copies nullable metadata into controlled string inputs, and its render calls `environment.trim()`. The third run's ordinary Run-card trace contains `TypeError: Cannot read properties of null (reading 'trim')`.

This is a pre-existing downstream defect, but the new retest operation can create the exact native object that reaches it. Independent scope review therefore classifies a minimal edit-form normalization as coupled. Normalize absent description, environment and build values only when initializing the form. Preserve stored null semantics, required environment on Edit save, permissions and the immutable retest manifest. Do not make an environment mandatory in retest or redesign the Run writer to avoid this defect.

The [independent scope receipt](native-runtime-second-scope-review.md) binds the cab1 source and actual failure traces. The [cancellation fixture freeze](native-runtime-cancellation-fixture-freeze.json) records the earlier isolated exact-201 correction and its then-current collection; later additions do not rewrite that snapshot.

The announced additional browser regression must create a real retest with no environment, assert its stored null, open that exact destination's Edit action without a page error, require an environment before Save, persist a configured choice, and prove source observations and historical retest data unchanged. The existing failed ordinary Run-card test is failing-first evidence for the same handler. The exact retest-to-Edit journey remains a source-supported inference until its new runtime executes.

## Adjacent product findings retained

These older owner implementations are unchanged from product baseline `1fe100588be6c3a1627ee39a4b0bbc1c0d9da2ea`. Their valid failing tests remain selected. A broad red selection does not itself authorize unrelated product changes.

| Finding | Evidence and consequence | Proposed bounded follow-up |
|---|---|---|
| Existing remote tickets receive the hidden default Bug title | `Tesbo-Frontend/components/LogBugDialog.tsx:381-391` sends `bugTitle.trim()` for each selected issue. The mixed Tesbo/Jira/Linear regression receives the generic testcase title twice instead of the two remote summaries; the keys and existing Tesbo Bug title remain correct. | Separately repair the existing link writer to use each selected issue's summary, preserving provider/key/URL, exact execution links and partial-failure retries. Do not rename historical Bugs or build provider synchronization. Native retest preservation does not depend on importing new remote issues. |
| A UUID project hard load makes duplicate reads | The trace records two successful project GETs and two member GETs. `Tesbo-Frontend/lib/projectPrefetch.ts:65-78` starts UUID reads immediately, then may start them again after a resolver callback checks a take-once map whose entries the consumer deletes. The trace proves duplication, but does not directly instrument that callback ordering. | Separately distinguish requests already started for a prefetch invocation from entries still waiting to be consumed. Add a held-resolver regression while preserving one-time consumption, expiry, explicit refetch and session gating. Do not replace the cache or weaken the exact-one assertions. |

The page remains reachable and no current evidence connects the extra GETs to retest recovery failure. The remote writer is not used to preserve an existing source Bug. Both findings are adjacent under `AGENTS.md` principle 13. An attempt to file the remote-title finding through GitHub returned HTTP 410 because repository Issues are disabled; neither repository settings nor another tracking service was changed. Both findings remain actionable in this existing work record and the PR's Findings not fixed section.

## Billing prerequisite remains unresolved

The workflow's disposable application has no Stripe secret, signing secret or configured price IDs. `AppConfigService.isStripeBillingEnabled` intentionally disables billing when the Stripe key is absent. `BillingService.requireStripeEnabled` then returns 503, the UI hides the billing surface, and `PlanLimitsService` exposes the documented unrestricted disabled-billing mode. The first run's 17 API billing failures and 15 UI billing-mode failures follow that prerequisite mismatch; the other two UI billing failures have separate name/route fixture causes above.

Do not reinterpret 503 as successful quote, checkout-validation or signature coverage. The pricing-stability test previously compared undefined fields from two error bodies; it now requires successful supported-currency quotes first. The INR checkout-refusal case previously sent its request before consulting the existing write opt-in and treated any non-403 response as eligibility. It now reads and validates eligibility first, fails on 503, and checks the same existing opt-in before an eligible checkout request. No new skip, provider substitution or external write is introduced.

Existing plan-state database fixtures and locally signed webhook helpers can exercise the native billing policy, but cannot supply Stripe price reads. The existing SDK provider has no local test-provider endpoint, and a dummy key with configured prices would still contact Stripe. Unit/lifecycle doubles do not replace full API/browser evidence.

Wiring an existing authorized Stripe test account and its prices into disposable CI would be a coupled verification prerequisite. Creating a new provider harness, endpoint seam or dependency is a separate proposed increment under `AGENTS.md` principle 13 and `docs/agent-scope-discipline.md`; it has not been authorized or implemented here. No shared secrets or customer billing records are used. The complete billing files remain selected and their failures remain visible. The existing two Stripe-write opt-in skips remain unchanged.

The pre-existing billing-copy `test.fail()` also remains an expected-failure limitation. Its failure while the Billing heading is absent does not verify the copy defect named by the annotation. Neither an expected-failure count nor missing-provider skips certify the billing journey.

### Concrete next-step proposal, not implemented

Prefer an owner-authorized dedicated Stripe test account over a new provider subsystem. Store its test-mode credential and webhook signing secret in the repository's approved CI secret mechanism, configure that account's monthly/annual price IDs, keep Stripe writes opted out, and use the existing country override for deterministic eligibility. The disposable application must verify enabled billing and successful non-null price quotes before its complete impact run. Existing tenant provisioning already promotes ordinary smoke tenants through its bounded fixture owner; the dedicated billing tenant retains its existing explicit state transitions. Credentials must not be posted into the PR or test artifacts. This option needs owner-controlled test-account configuration and a fresh full run; it does not require a new product API.

If a suitable test account is unavailable, a separate local provider-fixture increment needs an explicitly reviewed SDK transport seam, loopback-only isolation, rejected unexpected writes, versioned price-response fixtures and contract tests, lifecycle/cleanup controls, and separate reporting of simulated-provider versus actual Stripe evidence. Its cost is additional maintained code and security/contract review. It must not displace or weaken the native retest gate, and it cannot establish real Stripe integration. The current PR implements neither option and exposes the missing prerequisite for an owner decision.

## Admission after corrections

The final corrected collection resolves 261 selected tests out of 3,010 total tests, including 21 native UI scenarios. The prior twenty native scenarios, including the exact-201 correction, and the independently reviewed final legacy prefix are preserved byte-for-byte; one added nullable Run-edit journey accounts for the latest count increase. The [nullable-edit author freeze](native-ui-nullable-edit-freeze.json) binds the three-line product change, full test file and actual static/collection results. It retains the same eight screenshot attachments. The [independent nullable-edit review](native-ui-nullable-edit-review.md) found no source blocker and explicitly limits its runtime claim: environment/build nulls are forced by the new scenario, while historical null description remains source-inspected.

That collection and preservation statement describes the nullable-edit publication at 228a. Its subsequent selector-only follow-up retains all 21 native cases and every product byte unchanged, replacing only the two legacy selectors described above. The current source binding is the [selector correction freeze](native-ui-228a-selector-correction-freeze.json); collection remains 261/3,010 with the same eight native screenshot attachments. The 228a native runtime pass is historical evidence, not an assertion that the next full gate is green.

The next exact-head CI run must execute the same complete nine-file selection at `--workers=10 --retries=0`. The PR must report selected, executed, expected failures, unexpected failures, explicit skips and not-run counts separately, with its actual synthetic merge commit and environment. Type checks, collection and this record do not promote the implementation to verified or merge-ready. Merge remains contingent on the authorized complete green gate; production deployment and the external own-driver QA loop remain outside this increment.
