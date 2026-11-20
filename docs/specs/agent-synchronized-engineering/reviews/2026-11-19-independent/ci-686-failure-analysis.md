# CI 686: bulk setup failure and email retry

Read-only analysis of captured CI evidence, 2026-11-20. No product, fixture, or test edits and no runtime API, browser, or database calls were made for this analysis.

## Identity and evidence

- Requested source pin, resolved with local Git: `6862748b986264a6ae7866a33316ee796a9e8e46`.
- Both embedded Playwright reports identify CI commit `e14e1f3c6ac2f69aca8b7fe8ff9a90ea917b23ad`, PR #167, base `6897f989b055a955280f810c7daace86f74057fa`, and [build 44660092957](https://github.com/1alextest/Tesbooboo/actions/runs/44660092957). These are the captured build's metadata, not evidence for a later source tree. The merge object's parents were not independently checked: that object is unavailable in local Git.
- Artifact: `/workspace/scratch/fb086055b433/tesbo-ci-evidence/6862748b/ci-smoke-evidence.zip`; SHA-256 `c08766c8ff047f51a478b68ebbd9a0be59abf1c9a02c77136d3ced11cad9c895`.
- Report paths below are relative to the extracted `home/runner/work/Tesbooboo/Tesbooboo/e2e/` directory. Embedded report JSON was decoded into `/workspace/scratch/fb086055b433/assurance-working/ci686-decoded/`.

## Bulk execution — confirmed fixture contract failure

Report `playwright-report-bulk-executions`: **11 selected; 8 expected passes, 1 unexpected failure, 2 skipped**. All eight `api/execution-ops.spec.ts` tests passed. The UI failure is “setting a status on a multi-selection applies it to exactly those rows and clears the selection”; its `beforeAll` failed on both attempts before the test body ran.

Both authentic traces show:

1. Cycle creation returned **201**.
2. `POST /api/projects/:projectId/testcases/bulk-create` submitted three rows, all with `status: "Approved"`.
3. Bulk creation returned **400**, at `02:33:53.847Z` on attempt 0 and `02:33:54.398Z` on retry 1, with the same body:

   ```json
   {"error":"Row 1: Approve the exact reviewed test case through its approval action"}
   ```

4. Captured source `ui/cycles.spec.ts:462` unconditionally evaluated `created.created.map(...)` on that error response, causing `TypeError: Cannot read properties of undefined (reading 'map')`. Cycle cleanup returned **200** on both attempts.

**Classification:** confirmed stale fixture writer contract, not a demonstrated bulk-status product failure. The API refused direct approval exactly as its response states. Root's reported repair—create Draft cases, assert the bulk response, then use the existing exact `approveTestcase` flow—addresses this observed mechanism. This artifact does not execute or certify that repair.

Trace files under `playwright-report-bulk-executions/data/`:

- `dd62675f1ae190e354235e46afd17ed9cecb4f74.zip`, attempt 0; SHA-256 `1c1287c4a325510226ef5fc4d663867a8224cf0e472e2ea8ea9646a2cc6fc43f`.
- `d236936148194a201b4b2840cf6d9c4bf69f4463.zip`, retry 1; SHA-256 `23d2f4fd3bbb591df9fc8752e7af8e489157ed89fc04387c33c1273352bf8f31`.

## Email stage — confirmed invalid cleanup password; retry masks fixture state

Report `playwright-report-email`: **6 selected; 5 expected passes and 1 flaky, no unexpected failures or skips**. All three `api/email-delivery.spec.ts` tests passed on their first attempt. The flaky test is **ACU-10, “the reset form enforces the same password rules as the account screen”** (`ui/account.spec.ts:345`), not an email-delivery test.

### Direct observations

- ACU-07 and ACU-08 passed before ACU-10. Their successful password-reset requests appear in the retained browser traces at `02:33:44.311Z` and `02:33:45.677Z`; both returned **201** and set the same 16-character password. Duplicate trace contexts contain copies of these requests, not additional operations.
- On ACU-10's first attempt, all three refusal-message assertions passed: minimum length, missing uppercase/number, and mismatched confirmation. The failure was the final `passwordWorks(FIXTURE_PASSWORD)` assertion at line 379.
- The corresponding login at `02:33:47.124Z` submitted an **18-character** password and returned **401**, `{"error":"invalid_email_or_password"}`.
- In cleanup, login with the **16-character** password returned **201** at `02:33:47.380Z`. `POST /api/auth/password/change` then attempted to restore the **18-character** fixture value and returned **400** at `02:33:47.415Z`, `{"error":"Password must be at most 16 characters"}`. A second fixture-password login returned **401**.
- Sanitized equality checks confirm the failed login and successful cleanup login target the same email; cleanup's new password equals the failed login password; cleanup's current password equals the successful login password and the earlier successful reset passwords. No credential, reset token, cookie, or email address is reproduced here.
- Source `6862748b` and review pin `8db53c1f` both have the 18-character shared seed password at `e2e/utils/rbac-tenant.ts:170`. `seedUser` at lines 189–195 directly upserts its password hash. `restoreFixturePassword` at `e2e/ui/account.spec.ts:88–99` silently returns after exhausting both unsuccessful candidates; it does not assert successful restoration.
- Retry 1 reran `beforeAll` at `02:33:48.089Z`, including tenant provisioning. ACU-10 then passed. The report preserves the overall outcome as **flaky**.

### Classification and limits

The invalid restoration target and silent cleanup failure are confirmed. **The evidence supports fixture state leaking between password tests**, not an email delivery delay or an intermittent password-policy refusal. The explanation for the retry pass is an inference grounded in the recorded `beforeAll` rerun and source: reseeding restores the 18-character hash directly before ACU-10 runs alone, bypassing the change-password policy. There is no successful-retry network trace attached, so this note does not claim direct observation of the retry's SQL or HTTP response bodies.

### Minimal proposed correction, not applied here

1. In the existing shared fixture owner, `e2e/utils/rbac-tenant.ts:170`, replace the 18-character positive seed password with a value within the current 8–16-character policy and containing uppercase, lowercase, and a digit. Keep a single shared constant used by the seeder and login helpers. The existing SQL upsert refreshes disposable fixture hashes on provisioning.
2. At the end of `restoreFixturePassword`, `e2e/ui/account.spec.ts:99`, throw a clear error if no restoration succeeded. This makes cleanup failure attributable to the test that caused it, rather than allowing a later assertion or worker retry to conceal it.
3. Preserve product password policy and all negative assertions. Run ACU-07, ACU-08, and ACU-10 together, require first-attempt success, and disclose this as a separate fixture delta after the immutable native review pin. The shared fixture change also needs the usual affected-consumer CI selection; a standalone ACU-10 retry cannot prove inter-test restoration.

Email trace: `playwright-report-email/data/a3671a95aa19f56a581c630ccbca05fe4351e48f.zip`; SHA-256 `0dc5440373c1a86bfcf7e9770fc2925699c370a32962877066113cbd131818c9`. Error context: `data/fdc7495ab0523beec65197ffa1f7ca3a5a1ed8b7.md` in that report. This is captured-build diagnosis only; neither the latest native changes nor the proposed email correction are runtime-certified by artifact 686.
