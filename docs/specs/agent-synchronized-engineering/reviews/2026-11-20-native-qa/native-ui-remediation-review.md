# Native Retest selected — informed correction review

**Reviewer:** `/root/native_retest_ui_review`. **Date:** 2026-11-20.

**Verdict on the frozen correction:** the four original findings are corrected in source and have discriminating browser tests written. One additional coupled recovery defect remains in the readable-URL hint failure path (R1 below). Browser, database, assistive-technology and visual acceptance remain **NOT RUN / BLOCKED** for this review.

## Review binding and preserved evidence

This is an **informed follow-up**, not another independent first pass. The original scenario set and review were not modified:

| Original record | SHA-256 |
|---|---|
| `native-ui-independent.md` | `aa923cc13e40952b1ae67f261e4c34e767fbacd82a3c5ab68e956f5ac322f952` |
| `native-ui-review.md` | `911fa8c1f75431ef16ad9e6375d9c0f251536cd71ae9c9b0c6a3293a46f98f09` |

The correction was reviewed only after the owner announced its freeze. Manifest: `/workspace/scratch/8e9074abd0d0/native-ui-remediation-freeze.json`, SHA-256 `bab6ed5120f244eefd97041e6b0b908dcaa51da2baec5c0d0e420dd37224f7ef`. It declares 14 native UI scenarios and eight future screenshot attachments; none had runtime receipts or image bytes available to this review. All eight bound files were hash-verified and matched:

| File relative to `tesbo-qa-loop` | SHA-256 |
|---|---|
| `Tesbo-Frontend/lib/api.ts` | `bad0e4cb9ef07db1a18cacac742a931373301116a055f670bbc5b36b83d8b8da` |
| `Tesbo-Frontend/lib/nativeRetestIntent.ts` | `f1b6147fc710f910af1b0f851a64cf3a0dcf3a1b93df85121f8bf864cba3e824` |
| `Tesbo-Frontend/lib/routeParams.tsx` | `051ccc63d969a7d4601db0ab3d83c51171929933c6084807fedac55b29d0c028` |
| `Tesbo-Frontend/components/testruns/RetestRunDialog.tsx` | `baf0425ea4a7656bc29d25d5f07803d529449d708cb0c389aec798684ef4c068` |
| `Tesbo-Frontend/components/testruns/RetestLineage.tsx` | `3100c62733cbfb80f29c551f483c0b39a2bba802d6824de5bf8f81fb2f494ef5` |
| `Tesbo-Frontend/app/(app)/projects/[id]/cycles/[cycleId]/page.tsx` | `ce7df7666d7094b19fa03f69d4963da3e854675ca230ed82ba2a9b7b5d888fed` |
| `Tesbo-Frontend/app/(app)/projects/[id]/cycles/[cycleId]/execute/[executionId]/page.tsx` | `a4b83a5136c36cb8d9ca279848c6a5bb7820a68f17c8914b1a8155ffa647e3b7` |
| `e2e/ui/cycles.spec.ts` | `08c7aa4bd09bc4bbb11485ce0756161eea31a55834aa837b3d1f10b82d1d0781` |

The original product baseline remains `1fe100588be6c3a1627ee39a4b0bbc1c0d9da2ea`; the owner identified intervening PR169 as documentation-only. The checkout reported HEAD `ed71aa544108760f711ed4cb1bb7b7ba008ef417` during this review; the explicit file hashes above define the inspected candidate.

## Original finding dispositions

### F1 — Uncertain noncommit plus source drift: corrected in source

The previous dead end is replaced by explicit **Stop request and review again**. `RetestRunDialog.tsx:318–340` submits the exact retained request to cancellation/reconciliation. A transport failure retains the intent and reads its authoritative outcome; it does not infer rollback. POST refusal also retains the request until an exact created/cancelled disposition is obtained (`365–373`).

`acceptDisposition` at lines 178–201 verifies a cancellation's project, source, requesting actor, request key, canonical request digest and parseable decision time before clearing local intent. It resets preview and acknowledgment, retains target details, and presents the explicit Review again action. When create won, the same path accepts the existing created receipt and offers Open retest instead. Closing an unresolved dialog retains its request.

Integrated source inspection confirms the server read/cancel methods require a human principal and current project authority, serialize on the same request key, and return the prior terminal result when present. The terminal record is bound to the native creation receipt in V158 through a deferred compound relationship and a matching human-actor constraint. The new table is a child fact of the existing Run owner; it does not introduce an execution-result or external task lifecycle. The separate backend review remains the owner of the wider transaction/concurrency assessment.

The tests added at `e2e/ui/cycles.spec.ts:1690`, `1755` and `1802` target the actual boundaries:

- First POST is aborted before commit; a real selected case is changed and reapproved; exact retry receives 409; stopping returns a real cancellation; a delayed original is refused; a new reviewed key creates exactly one target with the approved basis.
- Cancellation commits but its response and immediate readback are lost; reload recovers the cancellation and clears the saved intent without another create/stop.
- Creation commits before response loss; stopping returns the already-created Run, exposes no fresh-review action and independently confirms one target.

These tests are written, **not executed by this review**.

### F2 — Focus lost when the focused control is replaced: corrected in source

`RetestRunDialog.tsx:282–316` now combines document-level focus containment/Tab handling with a layout check after every render. It repairs focus after a focused element is removed or disabled, handles no enabled controls, wraps forward and reverse Tab, and restores the initiating element when still connected.

The dedicated regression at `e2e/ui/cycles.spec.ts:1927` uses actual Tab/Shift+Tab traversal. It checks initial focus, preview-error→reload, the all-disabled pending phase, recovery controls becoming enabled, close/return, reload/reopen and Escape restoration. Its helper advances by keyboard and checks intermediate containment instead of manually focusing each destination. This directly discriminates the original focus bug. It does not establish screen-reader, touch or zoom acceptance until those interactions are actually observed.

### F3 — Hidden custom-field definition differences: corrected in source

`RetestRunDialog.tsx:29–39` adds recursive field rendering. Each custom field now has an expandable full definition, including its configuration (`70–85`). Extra step attributes are exposed, and Complete saved definition provides the exact snapshot fallback (`88–92`) for other saved dependencies and identities.

The regression at `e2e/ui/cycles.spec.ts:2073` uses an isolated project because editing a custom-field definition invalidates approvals project-wide. It holds the field name/value constant, changes requiredness and maximum length, reapproves the selected case, checks the old/current values are inspectable, requires acknowledgment, and independently reads source and target snapshots plus target approval revision. This is the specific discriminator missing from the original title/expected-text test.

Source readability is improved by named disclosure controls and labels. Actual density, wrapping, narrow-layout accessibility and visual comprehension remain unverified; raw complete-snapshot availability alone is not visual acceptance.

### F4 — Selection follows a replacement execution: corrected in source

The Run page now retains a map of testcase ID to **exact selected execution ID** (`page.tsx:409–411`). Refresh reconciliation removes missing/replaced identities and announces the cleared selection (`432–439`). Checkbox state compares both identities. Retest selected, assign and status use retained execution IDs directly; case removal keeps its explicit case-ID projection.

The test at `e2e/ui/cycles.spec.ts:2135` performs a real remove/re-add and verifies the replacement has a different execution ID. It triggers a same-mounted refresh through Log Bug, so full navigation cannot mask the original bug. It checks the notice, unchecked replacement and absence of an implicit preview, then explicitly selects the replacement and reads the resulting exact source identity from the manifest. Existing bulk controls are also checked for continued availability.

A separate read-only second lens (`retest_focus_test_delta`) inspected F2/F4 and their tests against the same hashes and found no additional concrete blocker in those two mechanisms. That agreement is supporting source review, not runtime evidence.

## Coupled deleted-source/readable-URL path

The new pending-intent hint is appropriately separated from authority:

- `findRetestRouteIntent` inspects only the current user's key prefix, validates the stored intent's scope/key/UUIDs, requires an exact case-insensitive route match, and refuses ambiguous matches.
- `routeParams.tsx:128–145` enables the fallback only after a real resolver 404 on a Run route. It binds the failure/recovery state to the current user and does not insert the hint into the ordinary resolved cache.
- The fallback only supplies UUIDs so the existing page can mount. Source, project and outcome reads still go through the server's current authorization checks.
- A delayed canonical rewrite can enrich the saved hint without changing the request body. The candidate has the failure gap below.

The test at `e2e/ui/cycles.spec.ts:1842` intentionally holds route resolution, saves an uncertain request on the UUID URL, then verifies successful hint enrichment when the readable URL arrives. It deletes the source before any server terminal result, proves the normal resolver returns 404, reloads through the current user's saved intent, stops the request and verifies late creation is refused.

**Claim limit:** its second browser context uses the same authenticated user, first without an intent and then with a synthetic foreign-user storage record. This proves absent/actor-mismatched storage does not activate the fallback. It does not perform a real account switch or test delayed responses crossing an account/project A→B→A transition. Those matrix cases remain unrun.

## R1 — Medium: failed hint enrichment still rewrites away from the recoverable URL

**Scope:** coupled defect introduced by readable-URL recovery. **Basis:** original independent scenarios UI-13/16. **Evidence:** deterministic source trace; no browser reproduction. **Status at report freeze:** promptly sent to the implementation owner for disposition.

At `routeParams.tsx:169–177`, `updateRetestRouteHint` can throw on its localStorage write or verification readback. The caller catches the error but still executes `window.history.replaceState` with the new readable URL. A previously saved intent can therefore retain only the UUID route hint while the address bar now holds the readable route.

Concrete sequence:

1. Delay canonical route resolution, as the existing deleted-source/no-outcome test does.
2. Save an intent while the address bar is the UUID route; abort create before delivery so no terminal record exists.
3. Resolve canonicalization, but make the hint enrichment write fail (for example a quota/write failure while the original stored value remains readable). The catch suppresses this failure; the browser still rewrites to the readable URL.
4. Delete the source before any terminal result, then reload the readable URL.
5. The server resolver returns 404. `findRetestRouteIntent` cannot match the persisted UUID hint to the readable references, so the page remains Page not found and the unresolved request's recovery controls are inaccessible from the URL the product gave the user.

The original request body and UUID scope still exist in storage, but the ordinary user has no visible path to them. This is distinct from initial storage failure, which correctly blocks a new POST.

**Bounded correction:** do not rewrite away from the previously recoverable route when a pending intent's required hint enrichment fails; alternatively provide an equally scoped, actor-bound fallback that is independent of successful hint mutation. Preserve the request identity and surface any material recovery limitation truthfully.

**Discriminating regression:** add a storage-write/readback-failure variant to the existing delayed canonicalization→deleted source→no outcome journey. Assert the request body remains unchanged, the page remains recoverable after reload, Stop yields the exact terminal cancellation, and no Run is created. Do not use an unrelated passing resolver/receipt path to conceal the failing hint update.

## Validation and remaining gates

Performed: all eight manifest hashes checked; original assurance hashes checked unchanged; source/diff review of the four corrections, recovery digest/wire contract, integrated server result/cancel binding, actor-scoped route fallback and all relevant test assertions; read-only second lens on focus/selection; scoped `git diff --check` passed.

Not performed: product/test edits, browser interaction, app/server launch, database activity, application E2E, screenshot inspection or visual comparison. No typecheck result is claimed by this reviewer.

The fourteen named UI scenarios and eight image attachments are still planned execution evidence. After R1 disposition, bind any further correction review to new hashes and the exact CI commit. Keep the original findings and this review intact. Run the agreed impacted selection in authorized isolated CI, report the actual selected/ran/passed/failed counts, then inspect authentic screenshots with declared build/role/fixture/browser/viewport/theme. Before/after fidelity requires an authentic baseline as well as the new render; screenshots do not replace keyboard or assistive-technology interaction evidence.
