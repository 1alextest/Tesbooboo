# Independent QA: ACU-10 cleanup failure at source 6d921151

## Finding and disposition

**Both authentic CI attempts failed in cleanup after a fresh login had already proved that the baseline fixture password worked.** Cleanup then requested a password change with identical current and new passwords. The native endpoint correctly returned HTTP 400, and the helper incorrectly converted that valid refusal into a cleanup failure.

This is a fixture cleanup defect. The traces do not establish a password-reset or email-delivery product defect. The minimal correction has been independently inspected in the working file: return after the isolated baseline-password login succeeds, while retaining the actual NEW_PASSWORD-to-FIXTURE_PASSWORD change path and the terminal failure. All existing test bodies and assertions remain unchanged. No corrected runtime result is claimed.

- Reviewer: actual independent QA participant `/root/qa_native_final_delta`, not the implementer.
- Verification timestamp: 2026-11-20T03:21:43.863824+00:00.
- Method: unchanged Nesberry method `d83549c85a4dcd047fb40dc4fba4ec62737ab0fc`; source inspection and captured runtime evidence are distinguished throughout.

## Source, build, and artifact identity

| Evidence | Identity |
| --- | --- |
| PR source | `6d921151498e2a52b244ade4efd19efd7ecbf71b` |
| Source tree, independently read from Git | `e733ff65d25d7c2e8934b2f9b2f87665a1efb1af` |
| Source parent | `9519b56d3441dfec3a107db95ca602665454f407` |
| Smoke workflow run / job, supplied with captured evidence | `44665137189` / `136052473874` |
| Actual checkout in smoke.log, lines 307–329 | `refs/remotes/pull/167/merge`, commit `375f0895f4e1bf106a1772dee34fe7880ab0461b` |
| Merge description in the checkout log | Merge source `6d921151498e2a52b244ade4efd19efd7ecbf71b` into `6897f989b055a955280f810c7daace86f74057fa` |
| Raw log | `/workspace/scratch/fb086055b433/tesbo-ci-evidence/6d921151/smoke.log` |
| Raw log SHA-256 | `430f581c711368699d95c95e6310e3365ca29ae96342f20e86ba6069e5c289f4` |
| Original archive | `/workspace/scratch/fb086055b433/tesbo-ci-evidence/6d921151/ci-smoke-evidence.zip` |
| Archive SHA-256 | `deb8e12ae99ce8e54e021e36649e2b93dd11f51b20f6bd7fa8f664e305f61cec` |
| Independently measured archive size / entries | 45,291,728 bytes / 275 entries |

The actual merge commit identity comes from the raw checkout log. That merge Git object was not available locally during this inspection; no independent merge-tree equivalence claim is made here. The narrower test-source attribution is stronger: both trace archives contain a source resource byte-identical to the account test file at source 6d921151.

Git comparison independently confirmed that the only changed path from 9519b56d to 6d921151 is `e2e/api/zyra.spec.ts`. The account test and native authentication service are identical between those two sources.

### Original attempt traces

Both paths below are relative to `/workspace/scratch/fb086055b433/tesbo-ci-evidence/6d921151/home/runner/work/Tesbooboo/Tesbooboo/e2e/`.

| Attempt | Trace path | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| Initial | `test-results-email/ui-account-account-screen--86e71-rules-as-the-account-screen-ui/trace.zip` | 2,033,648 | `cfb011d062e30e41f9b2b976f693c6c236f9b99e9dfb475cd3f0ef97f402bfdc` |
| Retry 1 | `test-results-email/ui-account-account-screen--86e71-rules-as-the-account-screen-ui-retry1/trace.zip` | 1,642,192 | `296a1b4b1a3aeccb6525372e880b27effcd207f321943a984e4ab5e9a51d0de4` |

In both archives, `resources/src@e5839574b2943da6b756c0e6dbbaedcc0dbd7724.txt` exactly matches the source account file, SHA-256 `5c6cb008b4bcfbdc0f225ba93f2dd3b229dc06557cd282d4d03752b0905a34d9`.

## Actual request and response evidence

Request JSON was read from each network snapshot's referenced resource and compared in memory to the exact source fixture constants. The table uses symbolic names; no password, cookie, email address, or reset token is included. `test.trace` afterEach start times were used to distinguish cleanup requests from the test's preceding baseline-password assertion.

All timestamps are UTC on 2026-11-20. All listed requests are POST.

| Attempt / phase | Time | Network member | Route and symbolic input | Response |
| --- | --- | --- | --- | --- |
| Initial, test body | 03:15:55.015 | `0-trace.network` | `/api/auth/password/login`, FIXTURE_PASSWORD | 201 |
| Initial, afterEach | 03:15:55.067 | `1-trace.network` | `/api/auth/password/login`, NEW_PASSWORD | 401; `invalid_email_or_password` |
| Initial, afterEach | 03:15:55.110 | `2-trace.network` | `/api/auth/password/login`, FIXTURE_PASSWORD | 201 |
| Initial, afterEach | 03:15:55.145 | `2-trace.network` | `/api/auth/password/change`, current=FIXTURE_PASSWORD, new=FIXTURE_PASSWORD | 400; identical-password refusal |
| Retry 1, test body | 03:15:58.706 | `1-trace.network` | `/api/auth/password/login`, FIXTURE_PASSWORD | 201 |
| Retry 1, afterEach | 03:15:58.751 | `2-trace.network` | `/api/auth/password/login`, NEW_PASSWORD | 401; `invalid_email_or_password` |
| Retry 1, afterEach | 03:15:58.789 | `3-trace.network` | `/api/auth/password/login`, FIXTURE_PASSWORD | 201 |
| Retry 1, afterEach | 03:15:58.822 | `3-trace.network` | `/api/auth/password/change`, current=FIXTURE_PASSWORD, new=FIXTURE_PASSWORD | 400; identical-password refusal |

Both 400 response resources contain the error **“New password must be different from your current password”**. Equality of the two submitted password fields was independently checked using the actual request JSON, not inferred solely from that response text.

The initial afterEach starts at monotonic time 7629.737; retry afterEach starts at 11314.757. Both traces record the terminal fixture-restore error after that boundary. No completed call before afterEach had an error in either trace. This is consistent with ACU-10's final unchanged assertion at source line 380: the baseline password still works after the reset form rejects invalid input.

`smoke.log:2408–2483` records ACU-10 failing on both attempts at `restoreFixturePassword`, source line 99; the stage finishes with **5 passed, 1 failed**, then exit code 1. The remaining selected MCP, run-approval, governed-change, and native-compatibility stages have no execution result in this failed smoke run. Earlier green selections do not convert this job to success or prove a corrected future source.

## Native behavior and causal explanation

At source 6d921151, `Tesbo-Backend-Nest/src/auth/auth.service.ts:138–171` validates the new password, verifies the current password, and explicitly rejects equality at lines 155–156. That rejection precedes `setPassword`, session invalidation, notification, and password-changed audit logging. The inspected source file SHA-256 is `4b2714e5a7bbb1a780ceed05da9e4e39f468321495c189f7a9827e722e912258`.

The old helper at `e2e/ui/account.spec.ts:88–99` tries NEW_PASSWORD, then FIXTURE_PASSWORD. Every successful login is followed by a password-change POST, including the successful baseline-password login. ACU-10 intentionally leaves the baseline unchanged, so this path issues an unnecessary same-password change and reaches the terminal error after the correct 400 refusal.

The login proof is meaningful: `requestContextFor()` explicitly supplies an empty storage state at source lines 103–119, so it cannot accept an inherited authenticated browser session as evidence that an arbitrary password works. The authentic 201 baseline login is positive native evidence that this fixture is already in the required password state.

## Independently verified correction

Corrected working file: `/workspace/scratch/fb086055b433/Tesbooboo/e2e/ui/account.spec.ts`.

Corrected file SHA-256: `3eebb2610209d846707e19e2010ec38244d9f04c18203a4a0453cc5e25043497`.

The sole delta from the exact source account file is an insertion at corrected lines 92–97: two explanatory comment lines and the following guard immediately after a successful `requestContextFor(candidate)`:

```ts
if (candidate === FIXTURE_PASSWORD) {
  await ctx.dispose();
  return;
}
```

Read-only byte comparison independently established that removing this single insertion restores the entire old file exactly. Therefore all test bodies and assertions, the NEW_PASSWORD-to-FIXTURE_PASSWORD write, context disposal, and terminal throw are unchanged. The complete ACU-10 body is separately byte-identical, SHA-256 `54490501e07684d118d6347fa701ddde78bb43b01241969212bf83d799fb19d5`.

This is the smallest legitimate fixture correction: it recognizes a positively verified baseline state without asking the product to accept a forbidden same-password change. It does not suppress failures, ignore all 400 responses, bypass the native password service, change persisted password hashes directly, relax password policy, or weaken the test assertions.

Required effects remain: when the fixture is at NEW_PASSWORD, cleanup must use the real native change endpoint to restore it; when it is already at FIXTURE_PASSWORD, a fresh isolated login must verify that fact. If neither path establishes the baseline, cleanup still throws. Forbidden effects remain: accepting an invalid password, letting a reset-form refusal change the stored password, or hiding genuine restoration failure.

## Limits and preserved receipts

This inspection read existing local Git objects, source files, original CI archives, and raw logs. No local DB, API, product service, or browser was started or contacted. No password was changed by this reviewer. No corrected unit, type-check, lint, Playwright, or CI result is claimed. The corrected file must be verified in the selected isolated CI stage on its final exact source/tree.

This is not a product-readiness decision, an occurrence-identity repair review, or closure of the full 49 journeys or original external I3/S0. The earlier receipts were left unchanged:

- `qa-native-final-delta.md`: `57c9ca7324a16afe16fc6953598fa94de4a0bbaaf584bf802993306c0bbed491`.
- `qa-selected-fixture-delta.md`: `d0cb0e992844223cceda043d5ae7720039d8169456f5532a7feb57bf994da6c3`.
