# Independent runtime classification and selector correction: head 228a06a

## Bound completed run

GitHub Actions run `44709080965`, job `136195888722`, tested head `228a06a30156c8e3fee09938d0d0262cdd552e61` through actual synthetic merge `d53ed043a7203475605b8e4a93ccfc29baae35a3`, with development parent `d74ddce2d04241695164b5a8b4d9b341932cfdcc`.

The completed 261-test selection has **220 actual passes, one expected failure, 38 unexpected failures, two explicit skips, and zero not-run cases**. The reporter's 221 expected outcomes include the existing billing expected failure. All 94 nonbilling API cases passed. Nonbilling UI has **122 passes and three failures** across 125 cases. Billing's 35 unexpected failures remain separately owned.

Evidence under `/workspace/scratch/8e9074abd0d0/qa-loop-assurance/`:

| Evidence | SHA-256 |
| --- | --- |
| `final-runtime-smoke-136195888722.log` | `f321bc15b56aa9c1e6b04a6c39ccd5f9888e3b61b6e0d660a6bf73845bc23add` |
| Downloaded artifact ZIP, ID `14616593698`, 81,175,198 bytes | `51f38ee801f60362a9ee772dbf3307e89c0077667025dbd89c8b0f1287a839ce` |
| `final-runtime-ci-evidence/report-data/report.json` | `fab3647b9f57a35093ad68eb5f6c411033effc97a044e04d4a3819a2051d6e6d` |
| `final-runtime-ci-evidence/report-data/all-outcomes.json` | `1bc52c1af79fd8d5c706b60644dac582d1943df4e049c4431f6f5d6d0e3d6524` |

This reviewer independently inspected detailed per-file results and actual DOM/error-context trace data. No local application, database, browser, or E2E runtime was run.

## Native outcomes reached their assertions

All **32 native cases passed: 21 UI, nine API, and two resolver cases**. The detailed UI results have actual status `passed`, retry 0, and no errors.

Both cancelled-terminal cases executed the closing dialog, removed-banner, and final `toBeFocused` assertions: the available source returns focus to its heading; the deleted source returns focus to Back to Test Runs. Their later cancellation/no-created-Run assertions also executed. These are complete journey passes, beyond the previously failing setup status check.

The new empty-environment retest → card Edit case executed stored-null/manifest checks, empty form and disabled-Save assertions, valid environment selection, exact PATCH response, persisted metadata, full creation-manifest equality, source-observation equality, reload, and persisted form-value assertions. The detailed steps mark these assertions as executed, not skipped. The original ordinary card Edit case also passed.

This runtime review does not claim final visual acceptance. Root retains that review for the final corrected head's artifacts.

## Previously repaired cases

All ten Priority/Type/Assignee filter cases passed, including the nine previously blocked by invalid setup. The repaired noncanonical Type fixture therefore let their original filter, combination, empty-state, reset, picker-isolation, and rapid-change assertions run.

Of the ten previously repaired legacy cases, eight completed; two progressed to additional selector failures:

| Existing journey | Actual outcome on 228a06a |
| --- | --- |
| Priority-only filtering / shared filter setup | Passed; all nine formerly blocked siblings also passed |
| Run creation with current object settings | Passed |
| Run creation with actual legacy JSON-string settings | Passed |
| Run creation without configured environments | Passed |
| Invalid/duplicate legacy environment filtering, including public-writer refusal and unchanged settings | Passed |
| Test Plan creation with selected environment | Timed out at later Run Name selector after environment assertions succeeded |
| Test Plan creation without configured environments | Passed |
| Failed + Save → existing bug picker → reopened drawer | Reached confirmed picker selection, then failed at nonexact Link Bug action |
| Automated provenance and two evidence files | Passed |
| Exactly one evidence fetch and settled two-file display | Passed |

## Three remaining nonbilling failures

1. **Plan Run Name selector — coupled test error.** `ui/cycles.spec.ts:1311` used `form input[type="text"]`. The actual trace DOM contains the expected INPUT with placeholder `E2E EnvPlan 1795166846885`, empty value, and no `type` attribute. The existing plan form has exactly one textbox, and shared Input forwards props without adding a type. A default text input is valid; requiring the explicit attribute was the test's mismatch. Trace directory: `ui-cycles-Test-Environment-d7395-nts-and-persists-the-choice-ui`.

2. **Link Bug action selector — coupled test error.** `ui/executions.spec.ts:1920` used a nonexact button name. The failure resolves both the background testcase button `UI Auto Prompt Link Bug 1795166857339` and the actual `Link Bug` action. The earlier picker-title correction succeeded, and Add Selected (1) completed. The conflicting control is the background testcase button, not the selected bug chip. Trace directory: `ui-executions-run-detail-—-74032-bug-after-Link-Existing-Bug-ui`.

3. **Mixed remote bug titles — preserved adjacent product defect.** `ui/executions.spec.ts:946` again receives the hidden default testcase title for both Jira and Linear instead of their selected summaries. The exact three-key assertion passed. This is the same existing `LogBugDialog.handleLinkExisting` writer defect already recorded; its assertion remains unchanged.

The readable-URL file passed all 12 tests, including UUID exactly-once project/member reads in this occurrence. That does not resolve the recorded timing-dependent duplicate-read defect: its product owner is unchanged, and the earlier duplicate traffic remains valid evidence.

## Authorized two-line correction

After log/source review and actual DOM corroboration, root approved exactly these two changes:

- Plan case only: replace the explicit-type CSS selector with `page.locator("form").getByRole("textbox")`.
- Existing-bug case only: add `exact: true` to the final `Link Bug` button query.

Every environment persistence, reopened drawer, exact bug key/title, and other assertion remains unchanged. No product file, native case, timeout, retry, skip, or test declaration was changed. The final patch is one replacement line in each spec.

## Frozen patch and checks

Manifest: `native-ui-228a-selector-correction-freeze.json`, SHA-256 `01a33d12942bafcd32205524750a5cb034de41a146ffe61d40d133d1ba885e9b`.

| Item | SHA-256 |
| --- | --- |
| Corrected `e2e/ui/cycles.spec.ts` | `22d4810771a9df92188554ac6b9bf0e9ef62290c30ada07ab0cd31c1673d86f5` |
| Corrected `e2e/ui/executions.spec.ts` | `f524e1f6178fdb537a20aa6db9bfa840a45355f12084139d9fd90a4a657b1abf` |
| `native-ui-228a-selector-correction.patch` | `7777e7d687728ef5e89e6b0783408f1ef8cedc6d92f9a2a4aa9853d063cd2bf3` |
| Byte-identical native 21-case block | `92cfd58630e0bde0cea5e4579f47a06830ac0ac9156c2a90f3b864679f0679fc` |
| Byte-identical Run list product page | `6bb698196ef9bb8c11651bf379bdf4f091bd93b6f7a349f36c2daa7bfd0f056c` |

E2E TypeScript and `git diff --check` passed. List-only collection remains **261 selected in nine files / 3010 total in 91 files**. The two corrected journeys require a new isolated run on the exact combined head; their current historical outcomes remain failed. A passing native subset on 228a06a is not a green full suite or proof of a later revision.
