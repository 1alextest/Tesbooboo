# Native Retest selected — frozen candidate UI/source review

**Review date:** 2026-11-20. **Reviewer:** `/root/native_retest_ui_review`.

**Verdict on this candidate:** changes required. All four concrete findings were accepted by the implementation owner before this report was frozen. Runtime, browser, assistive-technology and visual acceptance remain **NOT RUN / BLOCKED** for this review. No product, browser or database changes were made by this reviewer.

## Independence, scope and binding

The original 20 scenarios were frozen before candidate inspection in `native-ui-independent.md`, SHA-256 `aa923cc13e40952b1ae67f261e4c34e767fbacd82a3c5ab68e956f5ac322f952`. The clean baseline was `1fe100588be6c3a1627ee39a4b0bbc1c0d9da2ea`. Review began only after the owner announced the candidate freeze, including the coupled source-deletion recovery correction.

This report reviews the native manual retest preparation slice: exact source selection, old observation/current approved definition review, a distinct Untested native Run, retained source evidence, scoped asynchronous behavior, recoverable creation, existing controls and usable UI. It does not require a full attempt/correction journal or the external executor task/report loop. Such broader features are deliberately outside this increment.

The frozen candidate manifest is `native-candidate-before-ci.json`, SHA-256 `8d5534776300648d1b13e12a1854e6a2d273bb53ee6cc067a3efe3ed8920e641`, status “Frozen code before first isolated CI; no runtime acceptance.” There was no implementation commit at initial review. All seven review files were independently hash-checked against that manifest and matched.

| Candidate path relative to `tesbo-qa-loop` | SHA-256 |
|---|---|
| `Tesbo-Frontend/app/(app)/projects/[id]/cycles/[cycleId]/page.tsx` | `20e35c63d582bbd223de94ca935e8a3e2c81995b44f7953e7d0c43169f333bdb` |
| `Tesbo-Frontend/app/(app)/projects/[id]/cycles/[cycleId]/execute/[executionId]/page.tsx` | `a4b83a5136c36cb8d9ca279848c6a5bb7820a68f17c8914b1a8155ffa647e3b7` |
| `Tesbo-Frontend/components/testruns/RetestRunDialog.tsx` | `40ba2adb5072c28f077c08206e40ff981c03321f51f31cfa93a1f093e4cc2d92` |
| `Tesbo-Frontend/components/testruns/RetestLineage.tsx` | `3100c62733cbfb80f29c551f483c0b39a2bba802d6824de5bf8f81fb2f494ef5` |
| `Tesbo-Frontend/lib/nativeRetestIntent.ts` | `59cdee351b48c184b21d55c6e659b0e5fbefc25e0f0c95996294295114cf7714` |
| `Tesbo-Frontend/lib/api.ts` | `6412e79d43eed492d06704affec949f00f5bca1372cd5fbc229c21acdaef9221` |
| `e2e/ui/cycles.spec.ts` | `620627b633aa1e88a756a88a296b12260c91dd837baa366a8d44ec3fd9dff009` |

Supporting source inspected: the native retest API owner and existing execution reader in `legacy.service.ts`, `native-retest.ts`, canonical case approval snapshot in V155, cycle-item/execution identity constraints, shared Modal/Button, route parameter resolution, API read deduplication and app identity lifecycle. Existing source mechanisms are not assumed to be new defects merely because this review encountered them.

## Findings

### F1 — High: uncertain noncommit followed by source drift cannot reach a fresh review

**Scope:** defect on the new recovery path. **Independent scenarios:** UI-10/11/13. **Evidence classification:** deterministic source trace; browser reproduction not performed. **Owner disposition at freeze:** accepted; safe server-backed terminal disposition planned.

`RetestRunDialog.tsx:260–277` only releases an intent for a definitive *first* refusal. Any retry uses `recovering=true`, so even a definitive stale-preview refusal goes through receipt lookup. Lookup 404 deliberately retains uncertainty (`146–157`). While `pending` is set, the UI offers only Close and keep, Check outcome, and Retry saved request (`326–340`); it cannot obtain a new preview or revise the request.

Concrete journey:

1. Select an eligible execution and load its preview.
2. Abort the first POST before delivery, as the existing new “404 recovery” test already does. No retest is committed; the intent remains saved.
3. Change and reapprove the selected definition, or change the source observation, before the retry.
4. Retry the saved request. The server checks the unchanged request key, finds no receipt, then rejects the old preview digest with `RETEST_PREVIEW_CHANGED` (`legacy.service.ts:7228–7241` in the candidate).
5. The UI performs receipt GET, receives 404 and remains pending. Every retry repeats the same refusal. Reload preserves the blocked intent. Another selection in this source Run cannot start fresh.

The user is told that a changed source will require fresh review after the earlier outcome resolves, but no safe path exists to reach that state. Clearing on an arbitrary 404 would be unsafe because the original request could still commit later. A narrow durable terminal noncommit/cancellation decision, serialized with create for the same operation, is an appropriate resolution: if creation already won, return its receipt; otherwise prevent a delayed original from creating and allow a fresh reviewed operation. Keep the creation receipt authoritative.

**Discriminating regression:** extend the existing no-delivery→404 fixture with a real source/approved-definition change before retry, then explicitly stop/reconcile and obtain a fresh preview. Assert a delayed original cannot create after the terminal disposition, and assert the eventual new operation creates exactly one Run. Also test the inverse race where create wins and reconciliation returns that committed Run.

### F2 — Medium: recovery and preview transitions can eject keyboard focus from the modal

**Scope:** defect on the new dialog path. **Independent scenarios:** UI-15/19. **Evidence classification:** DOM/control-flow source trace; actual focus behavior awaiting browser test. **Owner disposition at freeze:** accepted; focus containment across phases planned.

The dialog focuses its root only when `open` changes (`RetestRunDialog.tsx:225–230`). Its custom Tab trap handles events only inside the inner dialog div (`309–317`). On submit, setting `pending` immediately replaces the form and its focused Create button (`240`, `326–350`). On Reload preview, clearing the error removes the focused Reload button (`198–199`, `359`). Neither transition moves focus to a surviving dialog element. The shared Modal does not make the background inert or trap document-level focus.

When a focused element is removed, focus can return to the document body. Subsequent Tab events originate outside the inner dialog and bypass its handler. A keyboard user recovering from a lost response can reach background Run controls instead of the newly enabled Check outcome/Retry controls. The initial trap does not establish containment after content changes.

**Recommended correction:** use a suitable shared focus primitive if available, or maintain containment and an explicit surviving focus target across preview/loading/pending/receipt/error phase transitions. Preserve Escape behavior and return focus to the initiating control when it still exists. Do not infer keyboard acceptance from manually calling Playwright `.focus()` on each desired destination.

**Discriminating regression:** open using keyboard, verify initial focus and forward/reverse Tab containment, submit into a lost-response state, then continue with Tab without programmatically selecting the recovery control. Repeat for preview-error→Reload, and verify close restores the initiating control. Include the busy phase and no enabled controls.

### F3 — Medium: some approval-relevant custom-field definition changes are invisible in comparison

**Scope:** defect on the new changed-definition review path. **Independent scenario:** UI-05. **Evidence classification:** source-confirmed rendering omission. **Owner disposition at freeze:** accepted; exact dependency detail rendering and analogous snapshot-field inspection planned.

V155 `testcase_approval_snapshot` stores the full custom-field definition alongside its value (`V155_testcase_review_semantics.sql:21–35`). Those definition attributes participate in the approved semantic basis. `RetestRunDialog.tsx:52–59` displays only `custom.definition.name` and `custom.value`. Changes to type, options/configuration, requiredness, or other definition attributes do not appear. The general case renderer also excludes `review_dependency_revision`, so it does not incidentally disclose these changes.

Concrete journey: retain a field's name and value, change its approval-relevant configuration and reapprove the case. The preview correctly marks the definition changed, but Source and Current custom-field displays can be identical. The user is required to acknowledge differences that the comparison does not show.

**Recommended correction:** expose relevant custom-field definition details through a readable expandable comparison, with a complete exact-data fallback where necessary. Inspect other nested snapshot dependencies for the same loss of information. This needs no second case editor.

**Discriminating regression:** use an unchanged custom-field name/value with a changed and reapproved configuration attribute. Assert that the old and new attributes are both inspectable, that creation stays disabled until the explicit acknowledgment, and that the target pins the reviewed revision.

### F4 — Medium: selected case identity can silently retarget to a replacement execution

**Scope:** new retest action composed with existing selection/refresh behavior. **Independent scenarios:** UI-01/02/18. **Evidence classification:** source-traced supported sequence; runtime reproduction not performed. **Owner disposition at freeze:** accepted; exact selected execution identity retention or clear/warn behavior planned.

The Run page's selection remains keyed by testcase ID (`page.tsx:410`, `970–992`). The new action only resolves the selected case keys to exact *currently loaded* execution IDs when clicked (`1485`). Same-Run `load()` replaces `executions` without reconciling the selection (`515–539`); Log Bug completion is one existing refresh path (`544–558`).

The active unique cycle-item/case and execution/cycle-item constraints make simultaneous duplicate active executions for the same case unsupported in this native UI. That is why mere testcase-keying was not immediately classified as a defect. Temporal replacement is different:

1. User selects execution A for case C.
2. Another tab removes C from the Run, then re-adds the still-approved case. Existing soft-delete behavior preserves A historically and creates a new active cycle item/execution B.
3. A normal refresh of the same Run, for example after logging a bug on an unaffected row, loads B. The stored selection still contains C, so B appears selected automatically.
4. Retest selected resolves C to B and sends B. The user originally selected A, whose status/observation can differ from B's.

**Recommended correction:** retain exact execution identity for retest selection, or clear/warn when a selected case's execution identity changes during refresh. Preserve the semantics of existing case-based remove actions explicitly; avoid quietly broadening another bulk operation while correcting this path.

**Discriminating regression:** select A, perform real remove/re-add through another authorized context, refresh through a supported UI path, then assert B is not silently admitted as the selected source. Either require explicit B selection or retain A and surface its unavailability without partial creation.

## Positive source findings and preserved behavior

- The native create API carries exact execution IDs and an expected preview digest. Source/current definition distinction is explicit. New Run preparation is separate from execution results; the dialog labels new observations Untested.
- `saveRetestIntent` writes and reads back browser recovery state before POST. Storage errors block fresh submission. A synchronous in-flight ref supplements disabled React controls.
- Recovery checks source Run, request key, project, creating user, target Run identity, source digest, name/environment/build and exact source execution IDs before accepting a receipt. A read failure is not presented as no retest. A 404 is explicitly uncertain rather than permission to blindly create a new request.
- Retest dialog and lineage components are keyed by user/project/Run. Preview/create/lookup paths also check scope and request generation/mount state. Run and full execution page initial reads check resource identity and fence delayed responses. This supports the intended design but is not runtime proof of the navigation race matrix.
- The recovery component occupies a stable sibling position through loading, loaded and source-unavailable states. The source-deletion test intentionally delays source 404 responses until after receipt recovery, then checks the recovered result survives that transition.
- Completed source Runs gain selection for retesting while their existing bulk remove/assign/status controls stay hidden. Existing normal Run controls, drawer Save/Log Bug/evidence, sharing/export and full execution navigation remain present in the source diff.
- Shared `RetestSourceObservation` is used in both drawer and full page. It labels the captured source result as historical, shows old actual-result text/evidence counts, and links to the original execution. Legacy snapshot approval uncertainty has a visible message.

## What the seven new UI tests establish if they pass

All seven tests were **written but not run by this reviewer**. The candidate UI spec starts the new describe at line 1380.

| Test/journey | Useful assertion boundary | Remaining limitation |
|---|---|---|
| Selected Untested occurrence + source evidence (`1439`) | Real API readback of exactly one target, Untested/empty actual, unchanged source rows, original evidence still visible, lineage links | Uses manual `.focus()` for Create/link; does not prove full keyboard journey, double click or multi-page selection. |
| Failed lineage/preview reads (`1487`) | Injected read errors remain errors; real fresh preview/list retry; no target created on cancel | Does not test malformed/mismatched preview, storage errors or denied/current-user switches. |
| Commit then lost response/reload (`1517`) | Real server create is committed before abort; saved intent existed before POST; recovery uses GET and one persisted target | Does not test response identity mismatch or later terminal noncommit handling. |
| Deleted source/readable URL recovery (`1561`) | Real delete, authorized receipt, intentional source error/recovery ordering, no extra POST, independently readable target | No visual or browser result existed at review time. |
| No delivery→404→same retry (`1647`) | Exact request body retained; no initial target; later identical retry creates once | Source stays unchanged; therefore misses F1. |
| Completed source (`1673`) | New Planning target, original status and execution rows unchanged, mutation controls absent | Retained drawer/full-page actions are not all exercised by this test. |
| Changed definition (`1695`) | Real case edit and reapproval, old/new expected text, explicit acknowledgment, new target with changed definition and preserved original | Mutation happens before preview. Does not cover drift during review, custom-field dependency changes or F4 replacement. |

The changed existing Completed-run bulk-status assertion was appropriately updated to preserve the prohibited mutation check while permitting the new selection action. This is a changed user contract, not an unexplained assertion weakening.

## Independent scenario disposition

| Scenarios | Source review disposition |
|---|---|
| UI-01/02 exact and changing selection | Ordinary unique active case selection maps to exact IDs; temporal replacement remains F4. Pagination/filter boundaries still need runtime coverage. |
| UI-03/04/08 source lifecycle and preserved observations | Source-supported; targeted real-readback tests written. NOT RUN. |
| UI-05 definition review | Native field/step comparison implemented; F3 for hidden nested definition changes. Drift after uncertain response is F1. |
| UI-06/07 unavailable approval and failed reads | Server refusal/UI disable and explicit errors present; failed-read test written. Full denied/missing/malformed matrix NOT RUN. |
| UI-09 duplicate submission | Synchronous UI guard and server idempotency exist; browser double-event test absent. NOT RUN. |
| UI-10/11/12 recovery and receipt match | Strong matching and same-intent recovery design; F1 blocks one legitimate recovery. Mismatch/revocation/denied retry UI cases unrun. |
| UI-13 deleted source | Stable recovery mounting and targeted real-deletion test present. NOT RUN. |
| UI-14 navigation races | Keyed component lifetime and request-generation checks are present on new retest paths; no actual A→B→A/account race UI test in this candidate. |
| UI-15/16 close and storage | Pending intent preserved across close/reload; failures block writes. Malformed/unavailable storage recovery tests absent. F2 affects keyboard phase transitions. |
| UI-17 lineage | Shared drawer/full-page component and source links implemented; failure distinguishable from empty. Tests written. NOT RUN. |
| UI-18 existing controls | Source diff preserves them; Completed behavior deliberately extended. Exact-head impacted suite required. |
| UI-19 keyboard | Named controls, dialog role, Tab handler and initial/return focus exist, but F2 remains; current keyboard assertions do not cover the claim. |
| UI-20 visual/readability | BLOCKED pending actual frontend captures. No synthetic Before or source-only visual approval. |

## Validation performed and required next evidence

Performed: read-only source/diff inspection; independent baseline and candidate SHA-256 checks; trace of exact-selection, preview, creation, receipt, storage and source-deletion paths; review of all seven new UI tests and the adjusted existing test. No frontend server, browser, database test, application E2E or mutation was run. No typecheck result is claimed by this reviewer.

The candidate wires six PNG attachments into successful test paths. Those are future artifacts, not screenshots already observed. Authentic captured images can support post-change readability review; authentic baseline images at the declared baseline/build, role, fixture, viewport, theme and zoom are still needed for a before/after fidelity claim. Keyboard/assistive-technology acceptance also needs actual interaction assertions; screenshots cannot establish it.

After fixes, bind this report's remediation review to the new exact file hashes and CI commit. Preserve this original finding set and mark later review informed. Run the whole agreed impacted API/UI selection in authorized isolated CI, retain counts/results and failed-test evidence, then review genuine screenshots. Neither this source review nor an eventual narrow UI pass certifies the broader attempt journal or external task loop.
