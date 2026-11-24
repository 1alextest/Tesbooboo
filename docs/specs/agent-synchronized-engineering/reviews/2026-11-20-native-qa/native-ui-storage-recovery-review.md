# Native Retest selected — final route-storage correction review

**Date:** 2026-11-20. **Reviewer:** `/root/native_retest_ui_review`.

**Source verdict:** R1 is corrected in the announced frozen delta. No concrete remaining source blocker was found in this targeted follow-up. Together with the preceding informed review, F1–F4 and R1 are now corrected at the source level. **Runtime, browser, assistive-technology and visual acceptance remain open.** This is not permission to substitute source inspection for the exact final CI/visual gates.

## Evidence binding

This is a targeted informed addendum. Earlier independent scenarios and findings remain unchanged:

| Record | SHA-256 |
|---|---|
| `native-ui-independent.md` | `aa923cc13e40952b1ae67f261e4c34e767fbacd82a3c5ab68e956f5ac322f952` |
| `native-ui-review.md` | `911fa8c1f75431ef16ad9e6375d9c0f251536cd71ae9c9b0c6a3293a46f98f09` |
| `native-ui-remediation-review.md` | `b8314c1de775c5be731795caa22c7d9cc28a0a93f33c2039916f46e2bac606af` |

Reviewed after the author's freeze notice: `/workspace/scratch/8e9074abd0d0/native-ui-storage-recovery-freeze.json`, SHA-256 `851a53f60c25919b2c264f5868d86a04be4e84bcf59eec3394eddb6d9f137786`. It extends the prior eight-file manifest `bab6ed5120f244eefd97041e6b0b908dcaa51da2baec5c0d0e420dd37224f7ef` with two changed files:

| File relative to `tesbo-qa-loop` | SHA-256 |
|---|---|
| `Tesbo-Frontend/lib/routeParams.tsx` | `7423f9f63b4b33c4a00e08c2ff56f46970d4f122c30dac02c3d38b2b80e466c4` |
| `e2e/ui/cycles.spec.ts` | `d0f1b77520724acb12a9b9392c0ab2ec89adee19cf4d85aff1c4bd5256dd2248` |

Both changed files and the manifest were independently hash-verified. The six other product/test files still match the preceding remediation manifest. All three earlier assurance hashes were rechecked unchanged.

## Why R1 is corrected

The previous code swallowed a URL-hint persistence failure and continued rewriting from a recoverable UUID URL to a readable URL. After source deletion with no terminal request record, the readable route could fail resolution while the saved intent still carried only the UUID hint. The recovery component then could not mount from the URL the product had supplied.

`routeParams.tsx:175–183` now handles hint-write or verification-readback failure by retaining or selecting the **resolver-confirmed project/source UUID path**, preserving the existing query and fragment, and returning before the readable rewrite. This makes the route independent of the hint's unknown persisted state. It covers both possibilities: the hint stayed unchanged because the write failed, or the new hint was written but could not be verified.

Using the known UUID pair also keeps the recovery path coherent if the previous URL contained mixed readable and UUID references. It does not trust storage to authorize data access, create another cache entry, clear a pending request, or declare the request successful/cancelled. The existing UUID route can mount the Run page, and its source/outcome reads retain the ordinary server authorization and terminal-disposition checks.

The successful path is preserved: when hint enrichment completes, the normal readable rewrite still occurs at line 185. No new outcome owner or result mutation was introduced.

## Regression quality

The delayed-canonicalization/deleted-source test at `e2e/ui/cycles.spec.ts:1842` now has three variants: storage available, hint-write failure, and hint-readback failure. This increases the native UI scenario count from 14 to 16; the manifest still declares eight future screenshot attachments.

The failure injection is placed after the initial intent was successfully saved. It targets only the later hint enrichment for that exact storage key, so the test does not accidentally exercise initial create blocking instead of R1. The readback variant performs the real storage write before failing its verification read. It asserts that the intended fault was reached.

The assertions distinguish the outcomes:

- Available storage still produces the readable URL and its matching saved hint.
- Failed write retains the UUID URL and exact original intent.
- Failed readback retains the UUID URL even though the saved hint may already be readable; the request body and actor/project/source scope remain unchanged.
- After restoring browser storage access, each variant deletes the real source before any terminal result, reloads, reaches the retained request, stops it through the real server owner, reads the exact cancellation, and requires a late original create to be refused.
- Native Run list readback confirms no destination with the attempted name was created, and only one original POST was sent through the browser path.
- A separate same-user browser without the intent, and then with a synthetic foreign-user intent, never exposes a recovery banner. The expected difference between readable-route Page not found and UUID-route Run unavailable is intentional and explicitly asserted.

These are meaningful written discriminators. **They were not executed by this reviewer**, and a passing collection/typecheck is not a browser result. As previously recorded, the storage actor-mismatch test is not a real account-switch/delayed-response race; that broader matrix remains unrun.

## Validation and handoff

Performed in this follow-up: read-only inspection of the two-file delta and complete changed test; combined prior/latest hash verification; verification that earlier assurance records are unchanged; scoped `git diff --check`, which passed. No implementation or test file was edited by this reviewer. No browser, app server, database or application E2E was run, and no screenshot was consumed.

The author reported frontend/e2e typechecks, route-parameter lint and Playwright list-only collection of 16 native UI tests. Those are attributed author checks, not independently rerun runtime evidence.

The next acceptance evidence remains the exact final CI commit and authorized impacted API/UI execution, followed by authentic screenshot review at declared build, role, fixture, browser, viewport and theme. Actual keyboard assertions must pass; image availability alone does not establish interaction quality. An authentic baseline is required for before/after visual fidelity. No broader attempt/correction journal, external executor loop or deployment certification is implied by this bounded source verdict.
