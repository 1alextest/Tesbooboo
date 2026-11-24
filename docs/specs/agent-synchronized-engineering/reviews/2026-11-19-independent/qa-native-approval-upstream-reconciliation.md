# Independent QA: upstream testcase approval reconciliation

## Scope and disposition

Reviewer: actual separate QA participant `/root/qa_native_final_delta`, not the implementer. Verification timestamp: 2026-11-20T04:04:17.284Z. This read-only review is bounded to the reconciliation of `e2e/api/mcp.spec.ts` and `e2e/utils/testcase-approval.ts`, under the unchanged Nesberry method `d83549c85a4dcd047fb40dc4fba4ec62737ab0fc`.

**The merged source preserves the upstream helper implementation, the original exact HTTP 200 requirement, the amended-case identity check, and the governed-run assertions. The lifecycle makes one approval POST. Corrected runtime verification remains outstanding.**

## Exact identities

| Input | Identity |
| --- | --- |
| Upstream parent | `be0240f413780770c427c4b589a29348d900ec65` |
| Parent tree | `ec64ab6f2802f044bac69cf225de62428b74526f` |
| Adopted upstream source / inspected working HEAD | `0e52c23367246a15f47c99d80288dafe55ed8151` |
| Upstream tree | `32e09ed3ec0686654914ed9d2378d27e6202b221` |
| Upstream MCP spec SHA-256 | `584ee61a6aca91e4ba0dc5844504f2ced6a3ccedba85efb60b4c36efce916e95` |
| Reconciled working MCP spec SHA-256 | `a8e9a02466f52d337cbb48b15db37169035bf2f91671aebce4cf3c8a6d8f5fc5` |
| Upstream shared helper SHA-256 | `a7078257d282ec8d79d20d13da4606c1f8c6c3814449a158479524c2eee33635` |
| Reconciled working helper SHA-256 | `39ac0db7340a45d3158b5a0b44ab5e40598204a0384e3019988fa8c3ca261030` |

Working paths are `/workspace/scratch/fb086055b433/Tesbooboo/e2e/api/mcp.spec.ts` and `/workspace/scratch/fb086055b433/Tesbooboo/e2e/utils/testcase-approval.ts`. The two current file hashes identify the reviewed uncommitted reconciliation; this receipt does not assign it a future commit or CI result.

## Verified reconciliation

The upstream change replaces the incomplete direct approval POST with `approveTestcase(owner, projectId, caseId!)`, its explanatory comment, and an `approvedCase.status === "Approved"` assertion. Those upstream lines remain unchanged.

The working MCP delta from upstream consists only of five lines immediately before the helper call, at lines 419–423: a fresh owner GET, an exact detail-response HTTP 200 assertion, parsing of the native detail, equality of `caseReview.editRevision` and `amended.editRevision`, and validation of the native approval hash's 64-character hexadecimal form.

The shared helper's sole delta is line 24: `approval.ok() === true` is strengthened to `approval.status() === 200`. This preserves the original direct-call response requirement at the single approval writer. The native controller explicitly declares `@HttpCode(200)` at `Tesbo-Backend-Nest/src/legacy/legacy.controller.ts:603–604`.

The helper still performs a fresh native detail read, sends both its `editRevision` and `approvalRevision`, and reads back the resulting Approved case. Source inspection found exactly one helper call and no direct testcase-approval POST in this lifecycle. The helper contains one approval POST. The additional preliminary operation is a read, not a duplicate approval.

The amended-revision comparison must precede approval. `TESTCASE_EDIT_REVISION_SQL` in `src/legacy/testcase-edit-revision.ts:9–10` includes status and updated_by, and `legacy.service.ts:1897–1902` changes those fields during approval. Comparing the returned Approved detail's edit hash to the earlier amended hash would therefore be the wrong oracle.

## Assertion preservation

Independent byte checks established that removing the five-line MCP insertion restores the upstream MCP file exactly, and replacing the strengthened helper assertion with its old form restores the upstream helper exactly. No other two-file delta was found.

Independent TypeScript AST comparison established:

- All **787 upstream MCP assertion statements** remain in their original order, with exactly three added native-review assertions, for **790** total.
- Of the pre-upstream parent’s 787 MCP assertions, **786 remain unchanged in the spec**. The sole relocated assertion is the exact approval HTTP 200 requirement, now enforced in the shared helper.
- The upstream Approved-status readback assertion and all original unapproved-run refusals, governed-run counts, native run identity, and manifest relationship assertions remain intact.

The reconciliation therefore retains the original behavioral obligations while using the shared exact-review fixture. It adds no product change, direct status approval, missing-hash bypass, duplicate approval, skip, or relaxed status expectation.

## Preserved earlier evidence and limits

The prior direct-call review remains frozen at `/workspace/scratch/fb086055b433/assurance-working/qa-native-approval-fixture-delta.md`, SHA-256 `d9a284dcacd6365c50771cb49a5c92607491776084d6b173fcdfa2af6570d636`. Its reviewed direct-call candidate is preserved separately at `/workspace/scratch/fb086055b433/assurance-working/mcp-approval-direct-candidate.spec.ts`, independently rehashed as `3d47b6b47dde0a7751e32710790e12027c0bb7072f33b5e3a2343d454987fa39`. Neither is relabeled as this adopted helper implementation.

No product or test file was edited by this reviewer. No DB, API, product service, browser, or Playwright execution occurred. The source/hash/AST verification does not establish a corrected runtime pass, later selected-stage completion, occurrence-repair acceptance, full 49-journey closure, original external I3/S0 closure, or product readiness. The final exact source/tree still needs its selected runtime gates.
