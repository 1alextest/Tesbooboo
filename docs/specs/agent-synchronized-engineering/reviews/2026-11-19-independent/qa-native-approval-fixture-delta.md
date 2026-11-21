# Independent QA: native testcase approval fixture delta

## Scope and disposition

Reviewer: actual separate QA participant `/root/qa_native_final_delta`, not the implementer. Verification timestamp: 2026-11-20T03:44:04.917Z. Method: unchanged Nesberry method `d83549c85a4dcd047fb40dc4fba4ec62737ab0fc`.

**One positive approval fixture omitted the required semantic review hash. The native endpoint correctly refused it. The narrow correction has been independently inspected, and no second positive omission was found in the finite census below. Existing assertions are preserved. Corrected runtime verification remains outstanding.**

This review is limited to that omitted-review-hash mechanism in the remaining selected MCP, native run approval, governed-change, and native compatibility spec files. It is not a general product-readiness review.

## Exact source and runtime evidence

| Input | Identity |
| --- | --- |
| Immutable reviewed source | `965a87a13d2669354598f8d4b912f36fdb148867` |
| Immutable source tree | `b3c497bdb7a43cd43e8d0535f663c542cba88186` |
| Source parent | `bd6df78d434012ffc11e9466dc0a996fb18d9f60` |
| Immutable worktree | `/workspace/scratch/fb086055b433/tesbo-review-965a87a1` |
| Smoke run / job supplied with captured evidence | `44667829454` / `136061368017` |
| Actual merge checkout, raw smoke.log lines 324–327 | `e49fab4df4043b621b7007e97d8646743f441b6b` |
| Checkout description | Merge source 965a87a13d2669354598f8d4b912f36fdb148867 into 6897f989b055a955280f810c7daace86f74057fa |
| Raw log | `/workspace/scratch/fb086055b433/tesbo-ci-evidence/965a87a1/smoke.log` |
| Raw log SHA-256 | `489e65bb72addee8df4b7f864489f3cea9a76086bcba7c6b4a399fe366995081` |
| Old MCP spec SHA-256 | `6380cd15ce0186435069c2ed4bdbccd6920967489d2beb52f8127191a08519f5` |
| Corrected working MCP spec SHA-256 | `3d47b6b47dde0a7751e32710790e12027c0bb7072f33b5e3a2343d454987fa39` |

The actual raw log was consumed. Its lines 2567–2604 show the initial attempt and retry of `MCP-P07 disposable proposal review lifecycle preserves project and run boundaries` failing at `e2e/api/mcp.spec.ts:420`: expected HTTP 200, received HTTP 400, with the response error `expectedApprovalRevision must be the approvalRevision returned by the case detail read`. Lines 2608–2611 show **18 passed, 1 failed**, followed by exit code 1.

The dedicated `MCP-P07 SEC-NATIVE-01` suite-publication test is recorded passing at line 2565. That result does not establish that the failed lifecycle completed. The later run-approval, governed-change, and native-compatibility stages have no execution result from this failed smoke run. The artifact download was still being prepared by root; this receipt relies on the raw log and inspected source, not an uninspected archive or network trace.

## Cause

At immutable source, `e2e/api/mcp.spec.ts:417–419` sends only `expectedRevision: amended.editRevision` to the human testcase approval endpoint. `amended` comes from the MCP `get_testcase` read at line 334. The request omits `expectedApprovalRevision` entirely.

`Tesbo-Backend-Nest/src/legacy/legacy.service.ts:1846–1854` requires the human principal, edit revision, and semantic approval revision before beginning the approval transaction. `testcase-edit-revision.ts:22–28` explicitly rejects a missing or malformed semantic revision with the exact error shown in CI. Lines 1891–1895 of the service separately reject a well-formed but stale edit or semantic revision.

The edit hash and approval hash represent different review context: the approval snapshot includes testcase dependencies. Supplying only the edit hash is incomplete fixture input. The correction must obtain and send the exact native approval hash, not relax the product guard or change the expected successful approval status.

## Finite direct-call census

The census covered the full contents of these 12 spec files selected by `.github/workflows/smoke-security-quality.yml:249–295`, plus the shared testcase approval fixture utility. `rg` searches were followed by TypeScript AST enumeration of direct POST calls ending in `/approve`, and manual resolution of their endpoint variables, payloads, helper calls, and positive/negative expectations.

| Spec file, relative to the repository root | Direct testcase `/approve` POST sites |
| --- | ---: |
| `e2e/api/mcp.spec.ts` | 1 |
| `e2e/api/run-approval.spec.ts` | 5 |
| `e2e/ui/projects.spec.ts` | 0 |
| `e2e/ui/requirements.spec.ts` | 0 |
| `e2e/api/zyra.spec.ts` | 0 |
| `e2e/ui/zyra.spec.ts` | 0 |
| `e2e/api/bugs.spec.ts` | 0 |
| `e2e/ui/executions.spec.ts` | 0 |
| `e2e/api/cycles.spec.ts` | 0 |
| `e2e/api/automation.spec.ts` | 0 |
| `e2e/api/executions.spec.ts` | 0 |
| `e2e/api/attachments.spec.ts` | 0 |

The six direct testcase sites at immutable source have these dispositions:

| Site | Review context and expectation | Disposition |
| --- | --- | --- |
| `api/mcp.spec.ts:417` | Positive human approval; edit hash only; expects 200 | Identified fixture defect; corrected below |
| `api/run-approval.spec.ts:284` | Both hashes from native detail; machine principal; expects 403 | Intentional principal-refusal test |
| `api/run-approval.spec.ts:293` | Both hashes from native detail; human; expects 200 | Complete positive request |
| `api/run-approval.spec.ts:296` | Replays both exact hashes; expects 200 and the same receipt ID | Complete idempotent replay |
| `api/run-approval.spec.ts:313` | Loop deliberately sends four empty/malformed contexts, including an omitted approval hash; expects 400, Draft retained, no receipt | Intentional negative cases; must remain unchanged |
| `api/run-approval.spec.ts:333` | Both reviewed hashes after an intervening dependency mutation; expects 409 and retention of the old run snapshot | Intentional stale-context refusal |

The additional direct POST in `e2e/utils/testcase-approval.ts:17–23` sends both hashes from one fresh native detail read, with format/snapshot assertions at lines 11–16. `createApprovedTestcase`, `bulkCreateApprovedTestcases`, and `createTestcaseFixtureResponse` route their requested Approved fixtures through that helper. Inspected approval setups in the other selected files use this mechanism.

The Model Studio revision approval at `api/mcp.spec.ts:410–413` is a different endpoint with its own `expectedHash` contract. It is excluded from the testcase count. The `approve-ai-memory` endpoint is also not a testcase approval. They are not missing-testcase-hash findings.

**Census result:** one positive omission; four other direct calls supply both hashes; one direct call intentionally tests four malformed contexts; the shared helper supplies both hashes. No additional positive omission was found within this finite scope.

## Correction verification and assertion preservation

Corrected working path: `/workspace/scratch/fb086055b433/Tesbooboo/e2e/api/mcp.spec.ts`.

At corrected lines 417–423, the fixture now:

1. Performs a fresh signed-in owner GET of the native testcase detail after the unapproved-run denial.
2. Asserts HTTP 200 and parses that response.
3. Asserts that its `editRevision` still equals the `amended.editRevision` used by the scenario.
4. Asserts a 64-character lowercase hexadecimal `approvalRevision`.
5. Preserves `expectedRevision: amended.editRevision` and adds `expectedApprovalRevision: caseReview.approvalRevision` to the original human approval POST.

The existing approval status assertion remains exactly 200 at corrected line 425. The governed-run assertions remain intact: one requested and added case, zero skips, the native run identity, and the manifest relationship to the selected testcase. The preceding unapproved model/case refusals remain intact.

The inspected diff contains only the five fresh-review lines and the added request property. An independent TypeScript AST comparison retained all **787 original assertion statements in order** and found exactly three added assertions: detail status 200, unchanged edit revision, and approval-hash format. The other 12 census files, including the shared utility, are byte-identical between the immutable source and current working copies.

This preserves the required legitimate human approval and native run effects while keeping the forbidden effects covered by existing tests: machine self-approval, generic-status approval bypass, malformed review contexts, and stale dependency approval. The receipt does not claim those later tests ran in the failed job.

## Limits

No product or test files were edited by this reviewer. No local DB, API, product service, browser, or Playwright execution occurred. Source parsing and hash/AST comparisons are read-only checks, not API/runtime tests. No corrected CI result, complete selected-stage pass, full 49-journey closure, original external I3/S0 closure, or broad product readiness is claimed. The final corrected exact source/tree still needs its selected runtime gates.

Earlier QA and cleanup receipts remain separate and unchanged; this receipt does not rewrite their original source identities or evidence cutoffs.
