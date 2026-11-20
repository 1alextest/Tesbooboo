# Independent review of the two selector corrections

## Conclusion

No source blocker found in the two announced selector changes. They target the controls that the existing scenarios intend to operate, while preserving the existing behavior assertions. Runtime acceptance remains pending for the next exact-head full impact run.

This review covers the selector patch authored by the UI reviewer after Smoke run 44709080965, job 136195888722. It does not change the recorded result of that run: 220 actual passes, one expected failure, 38 failures, two explicit skips, and zero tests not run. All 32 native cases passed in that observed run.

## Evidence and findings

### Plan Create Run name input

The completed log shows the scenario selected Production, then timed out waiting for `form input[type="text"]`. The current plan page renders the create form with one Run Name `Input` and the Environment select. The Run Name input has no explicit `type` prop. The replacement `page.locator("form").getByRole("textbox")` addresses that input by its actual role and retains strict uniqueness instead of choosing the first match.

The configured-environment selection, Create action, visible run-name assertion, and exact API persistence assertion remain unchanged. The correction does not relax the environment or saved-value checks.

Product source inspected: `Tesbo-Frontend/app/(app)/projects/[id]/plans/[planId]/page.tsx`, including the complete conditional Create Run form. Failure evidence: `final-runtime-ci-evidence/report-data/all-outcomes.json`, case at `ui/cycles.spec.ts:1302`, and `final-runtime-smoke-136195888722.log`.

### Link Bug action

The completed error identifies two buttons matched by the old nonexact name: the background testcase button named `UI Auto Prompt Link Bug <timestamp>` and the actual `Link Bug` action. Adding `exact: true` selects the latter. It does not alter the previously completed bug selection.

`components/LogBugDialog.tsx` renders the action label as `Link Bug` for one selected bug, which is the state this scenario establishes. The following modal-close, drawer reopening, and exact Bug Key/Bug Title value assertions are retained.

The ambiguous background match is a testcase button, not the selected-bug chip. Failure evidence: the same detailed outcomes file, `ui/executions.spec.ts:1885`, with the strict-mode error at line 1920.

## Independently verified preservation

Baseline commit: `228a06a30156c8e3fee09938d0d0262cdd552e61`.

| Item | Verified result |
| --- | --- |
| Frozen patch | Exactly two changed selector lines; SHA256 `7777e7d687728ef5e89e6b0783408f1ef8cedc6d92f9a2a4aa9853d063cd2bf3` |
| `e2e/ui/cycles.spec.ts` | SHA256 `22d4810771a9df92188554ac6b9bf0e9ef62290c30ada07ab0cd31c1673d86f5` |
| `e2e/ui/executions.spec.ts` | SHA256 `f524e1f6178fdb537a20aa6db9bfa840a45355f12084139d9fd90a4a657b1abf` |
| Native 21-case block | Byte-for-byte equal to baseline; SHA256 `92cfd58630e0bde0cea5e4579f47a06830ac0ac9156c2a90f3b864679f0679fc` |
| Product files | No tracked frontend or backend file differs from baseline |
| Test behavior controls | No changed assertion, added skip, altered timeout, retry, or test declaration |

The current two-file diff exactly matches the author's frozen patch. Both before and after file hashes match the freeze manifest. The native block comparison was made against the published baseline through `git show`, rather than relying only on the author's report.

## Independent collection

List-only collection succeeded without an application, database, or browser run:

- Full impact selection: **261 tests in nine files**, including **21 native UI cases**.
- Full suite: **3010 tests in 91 files**.
- Requested impact configuration remained **10 workers and zero retries**.

Collection records are `native-ui-228a-selector-independent-selected-list.txt` and `native-ui-228a-selector-independent-suite-list.txt` in this directory. No source files were edited during this review.

## Remaining acceptance evidence

The next full CI run must show whether both corrected scenarios reach and satisfy their later assertions. The mixed-provider linked-bug title failure remains open in the observed run. The eight screenshots extracted from the 228a run remain intact; final-head visual review is still pending.
