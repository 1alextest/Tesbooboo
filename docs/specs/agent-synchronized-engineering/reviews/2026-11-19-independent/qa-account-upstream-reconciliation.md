# Independent QA: adopted upstream account-cleanup correction

## Scope and disposition

Actual separate QA participant: `/root/qa_native_final_delta`. Inspection time: 2026-11-20T03:25:21.483554+00:00. This read-only review is bounded to the three-line upstream correction in `e2e/ui/account.spec.ts`, under the unchanged Nesberry method `d83549c85a4dcd047fb40dc4fba4ec62737ab0fc`.

**The adopted upstream correction addresses the previously observed same-password cleanup failure at source level. The current account file is byte-identical to the upstream commit, and all existing test bodies and assertions are preserved. No corrected runtime pass or product-readiness decision is claimed.**

## Exact identities

| Input | Identity |
| --- | --- |
| Old source | `6d921151498e2a52b244ade4efd19efd7ecbf71b` |
| Old source tree | `e733ff65d25d7c2e8934b2f9b2f87665a1efb1af` |
| Old account file SHA-256 | `5c6cb008b4bcfbdc0f225ba93f2dd3b229dc06557cd282d4d03752b0905a34d9` |
| Adopted upstream source | `bd6df78d434012ffc11e9466dc0a996fb18d9f60` |
| Adopted upstream tree | `5e3fbb574403e532f065a1d577e27c34dd0de9bc` |
| Upstream parent, independently read from Git | `6d921151498e2a52b244ade4efd19efd7ecbf71b` |
| Upstream account file SHA-256 | `1777871581e6a0e924461a369da86d4eddeb6e49fa4ef8e84bc0dbc853a2cecb` |
| Current working account file SHA-256 | `1777871581e6a0e924461a369da86d4eddeb6e49fa4ef8e84bc0dbc853a2cecb` |

Current inspected path: `/workspace/scratch/fb086055b433/Tesbooboo/e2e/ui/account.spec.ts`. Direct byte comparison, not just hash comparison, established equality with the account file obtained through `git show bd6df78d434012ffc11e9466dc0a996fb18d9f60:e2e/ui/account.spec.ts`.

## Narrow correction and helper verification

The only file delta from the old source is an insertion at new lines 89–91: two comment lines explaining the already-restored baseline and this statement at the start of `restoreFixturePassword()`:

```ts
if (await passwordWorks(FIXTURE_PASSWORD)) return;
```

The unchanged `passwordWorks()` at adopted-source lines 176–180 calls `requestContextFor(password)`, returns false if no authenticated context is obtained, disposes a successful context, and returns true. `requestContextFor()` at lines 106–122 creates a new API context with explicitly empty cookies and origins, posts the supplied password to the native login endpoint, and disposes unsuccessful contexts. Therefore the new return requires a fresh successful baseline-password login; it does not rely on inherited authentication or a toast.

If the baseline-password probe fails, the existing restoration loop still executes. The real NEW_PASSWORD-to-FIXTURE_PASSWORD request, response handling, disposal, and terminal throw remain unchanged. This preserves failure visibility when restoration cannot be established. When the baseline is already valid—the state established in both authentic 6d CI failure traces—the new preflight avoids the unnecessary same-password change that the product correctly rejects.

## Assertion preservation

An independent read-only byte comparison found exactly one insertion of three lines. Removing those lines from the adopted file restores the old account file exactly. Thus every existing test body and assertion is byte-identical, including all ACU-10 validation and stored-password assertions.

The complete ACU-10 body was also compared separately and is identical, SHA-256 `54490501e07684d118d6347fa701ddde78bb43b01241969212bf83d799fb19d5`.

No assertion, test selection, retry allowance, or skip was weakened. The correction adds no direct password-hash write and does not make the product accept a forbidden same-password change.

## Reconciliation with the earlier receipt

`/workspace/scratch/fb086055b433/assurance-working/ci-6d-account-cleanup-analysis.md` remains unchanged, SHA-256 `04202e6464f568e65513aa1ebae68b86d777422336902b5841d6cfcb09ea2ed8`. It remains the authentic trace diagnosis and review of the earlier local six-line guard, whose file hash was `3eebb2610209d846707e19e2010ec38244d9f04c18203a4a0453cc5e25043497`.

This receipt records the actual adopted upstream implementation separately. It does not relabel the earlier local implementation as the published one or transfer a future runtime result to either file.

No database, API, product service, browser, or Playwright execution occurred in this reconciliation review. The original CI failure evidence remains in the earlier receipt; the corrected selected stage still requires execution on the final exact source/tree. Other product changes, the occurrence-identity repair, and broader integration acceptance are outside this three-line review.
