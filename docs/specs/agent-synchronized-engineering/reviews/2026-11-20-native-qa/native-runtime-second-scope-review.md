# Native retest second runtime scope review

Review date: 2026-11-20. Independent reviewer: `/root/manual_qa_inventory`.

This is an immutable receipt of the read-only scope decision delivered to `/root` and accepted before the subsequent nullable-form correction. It records the reviewed source and completed runtime evidence, not a certification of later working-tree changes. No product/test edits or local application/database runtime were performed by this review.

## Binding and authority

- Repository: `/workspace/scratch/8e9074abd0d0/tesbo-qa-loop`.
- Reviewed committed feature head: `cab1c6928b32f6f7b74b30dbf75879ef127628be`.
- Actual completed smoke checkout: `d5f1175644900b28845afdb4ed413c85f25454c0`, combining feature `cab1c6928b32f6f7b74b30dbf75879ef127628be` with development `d74ddce2d04241695164b5a8b4d9b341932cfdcc`.
- Smoke run `44703524270`, job `136177365716`.
- Canonical engineering rules: repository `AGENTS.md` principles 5, 9 and 13; `docs/agent-scope-discipline.md` lines 16–18 and 31–37. A broad selected failure supplies evidence, not automatic authority to repair an adjacent product owner.
- Native scope: exact selected source observations, review against current approved definitions, a distinct native Untested Run, preserved source observations/evidence/Bug links, recoverable request disposition and usable native navigation. Full correction journaling, external execution, billing-provider configuration and broad product repair remain outside this increment.

The three implicated product owners—cycles list, LogBugDialog and projectPrefetch—have no committed diff from baseline `1fe100588be6c3a1627ee39a4b0bbc1c0d9da2ea` to reviewed feature head `cab1c6928b32f6f7b74b30dbf75879ef127628be`. They are existing defects exposed by the broad selection, not demonstrated regressions introduced by retest.

## Scope verdict

| Finding | Classification and action | Boundary |
|---|---|---|
| Run Edit crashes when environment is null | Coupled downstream defect: permit a minimal existing-form repair and one native regression. | Retest explicitly permits an empty environment and produces a native destination whose offered Edit action reaches the broken owner. Normalize nullable values at form initialization; preserve canonical null storage, required-environment save validation, permissions and immutable lineage. |
| Existing remote issue linking uses hidden bugTitle | Adjacent confirmed product defect: record for separate authorization. | Retest preserves existing Bug identities/references and does not depend on importing new Jira/Linear issues. No retroactive Bug rewrites or provider synchronization. |
| UUID hard-load prefetch duplicates project/member GETs | Adjacent confirmed navigation-performance defect: record for separate authorization. | Page loading and server authorization remain effective. No observed failure of retest identity/recovery depends on eliminating these extra GETs. Preserve exact-one assertions; do not add a general cache or routing subsystem. |
| New terminal-recovery UI fixture expects cancellation POST 200 | Correct the test to exact 201 within the named increment. | Existing endpoint and passing real API test establish 201. GET receipt readback remains 200. Preserve subsequent identity, reload, no-duplicate and focus assertions. |

### Nullable Run edit evidence

At reviewed head:

- `Tesbo-Frontend/components/testruns/RetestRunDialog.tsx:397–398` does not require environment for `canCreate`; lines 459–467 submit the optional form value.
- `Tesbo-Backend-Nest/src/legacy/native-retest.ts:63–65` normalizes optional environment/build values to null.
- `Tesbo-Backend-Nest/src/legacy/legacy.service.ts:7294–7298` passes those values into the reused native Run creation helper. The canonical insert stores `body.environment || null` at line 7008.
- `Tesbo-Frontend/app/(app)/projects/[id]/cycles/page.tsx:248–253` places `r.environment` directly into string form state, and the edit render calls `environment.trim()` at line 738.
- Completed smoke log lines 4633–4658 show the Run-card Edit action failing to display Save. Its actual trace console contains `TypeError: Cannot read properties of null (reading 'trim')`.

That runtime case used an ordinary native Run. Applying the same failure to a destination created by retest is a source-supported inference through identical stored null metadata and the identical Edit owner; the exact retest-to-Edit journey has not yet been executed in the reviewed build. This distinction must remain explicit.

The approved bounded regression should create a real retest with an omitted environment, open that exact destination's list Edit action, prove the form renders without a page error, select a configured environment, save and read it back. Source observations and the immutable retest manifest must remain unchanged. Do not make environment mandatory in retest to evade the defective consumer.

### Remote title evidence and parked repair

`Tesbo-Frontend/components/LogBugDialog.tsx:381–391` loops over selected issues but submits `bugTitle.trim()` for each. The visible selected item uses `issue.summary` at line 549, while the hidden default bugTitle derives from the execution at line 236. The existing native writer persists the supplied title at `Tesbo-Backend-Nest/src/legacy/legacy.service.ts:8924`.

Completed smoke log lines 4744–4764 report the mixed Tesbo/Jira/Linear case receiving two identical `Bug: UI Bug Mixed Types …` titles instead of `Mixed Jira ticket` and `Mixed Linear ticket`. Issue identities remain distinct; the title mapping is wrong. A separately authorized correction can use each selected issue's summary while retaining provider/key/URL, native execution links and partial-failure retry behavior. Existing lineage preservation does not require this writer correction.

### Prefetch evidence and parked repair

`Tesbo-Frontend/lib/projectPrefetch.ts:65–68` starts project/member requests immediately for UUID paths. Its resolver callback at lines 73–78 uses `store.has(...)` to decide whether to start them again. `takePrefetched` deletes an entry when consumed at lines 39–43; consumption can therefore be mistaken for a request never having started. `ProjectDataProvider.tsx:64–65` consumes those promises.

The actual UUID trace contains two successful project GETs and two successful member GETs. Completed smoke log lines 4883–4903 records exact expected length 1 versus actual 2. The trace does not instrument callback ordering, so the source mechanism is a concrete ordering consistent with the duplication, not a trace-proven scheduling claim.

A separately authorized bounded repair should distinguish "already started in this prefetch invocation" from "still available for consumption," preserving take-once consumption, expiry, explicit refreshes, project-key behavior and the authentication gate. No assertion should be loosened to accept duplicate calls.

### Cancellation status fixture confirmation

`Tesbo-Backend-Nest/src/legacy/legacy.controller.ts:756–759` exposes the cancellation POST without an HTTP 200 override. `e2e/api/cycles.spec.ts:1679` asserts exact 201; that real API scenario passed on tested merge d5f117 (smoke log line 3251). Its subsequent GET readback asserts 200.

The independently reviewed working-tree hunk at the time of this decision changes only the terminal setup status expectation from `outcome === "created" ? 201 : 200` to exact `201`. Both setup branches are POSTs. The hunk remains correct; cancelled terminal-focus cases still need the next real CI execution after this fixture repair. Concurrent unrelated authorized fixture edits are not covered by this status-hunk conclusion.

## Evidence identifiers

Decoded smoke log: `/workspace/scratch/8e9074abd0d0/qa-loop-assurance/runtime-correction-smoke-136177365716.log`.

Log SHA-256: `a7d66954c3dc6df4feb4a153104d815ab743ff086cae13239c3667ada656ade5`.

Trace root: `/workspace/scratch/8e9074abd0d0/qa-loop-assurance/runtime-correction-ci-evidence/home/runner/work/Tesbooboo/Tesbooboo/e2e/test-results-native-retest`.

| Trace below that root | SHA-256 |
|---|---|
| `ui-cycles-run-card-is-one--24dec--still-opens-its-own-dialog-ui/trace.zip` | `dfe5bf34e53f795a629c2ca1891aa690d5f4a21a3491a488ff05889e30a668a5` |
| `ui-executions-auto-bug-fil-556c8-ix-of-Tesbo-Jira-and-Linear-ui/trace.zip` | `d92a1ba280ba8242830fa3176e939142b0aa666348a324b02f3657eb5032329d` |
| `ui-readable-urls-project-p-571be-t-and-its-members-once-each-ui/trace.zip` | `004d3e75824c57ab4a7b6bcd56d96a14395272734083c114e989b2ceae337671` |

Hashes below are of exact committed cab1 file bytes, obtained using `git show`, so later concurrent working-tree changes cannot alter this receipt's source binding.

| Source path relative to repository | SHA-256 at cab1 |
|---|---|
| `Tesbo-Frontend/app/(app)/projects/[id]/cycles/page.tsx` | `53b3ac5ddaed7252d61db29c342e0639166a0a5b43acc70f77fb3b0cfe10532a` |
| `Tesbo-Frontend/components/LogBugDialog.tsx` | `450c00e9661f833fb9cb535b54ec744a988bd636a4c7fc48503d1bbfd04efc03` |
| `Tesbo-Frontend/lib/projectPrefetch.ts` | `1d958865f951aa55f0b041588d6687c9dbe0f31a70237c1653c841a3d71f4014` |
| `Tesbo-Frontend/components/testruns/RetestRunDialog.tsx` | `f34c1b9b077e3e38352f04e2a8569465c1d53138ae0890388425bd834eabc400` |
| `Tesbo-Backend-Nest/src/legacy/native-retest.ts` | `606721565ff07ff18ac67e66b3265a947263c115a30ae962f4d3d4712baf5f3e` |
| `Tesbo-Backend-Nest/src/legacy/legacy.controller.ts` | `40303d47ddb2e7d8a3c5ca2408f78003f361d8a9155c89381d17bb57728b94bc` |
| `Tesbo-Backend-Nest/src/legacy/legacy.service.ts` | `732b79be810df5b46e5cbdaa7504bd1cb98e33a325382a42172418626dfd2617` |

## Limits and follow-through

The root accepted this verdict and authorized the minimal nullable-form correction plus one native regression. This receipt does not review that later diff or claim its runtime success. The legacy environment reader fixture is a separate pending read-only review. No Stripe or broad product-system changes are authorized by this receipt. Adjacent red cases remain honestly reported; neither their inclusion in the broad gate nor the simplicity of a possible fix expands scope automatically.
