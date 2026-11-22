# Original native occurrence attribution repair

## Scope and status

Coupled repair of the independently reproduced Green finding on source `9519b56d3441dfec3a107db95ca602665454f407`: a new native occurrence of the same test case could inherit the original model dispatch's element mapping and result attribution. The source review worktree and independent before probe were left unchanged. This record describes an **uncommitted, stable implementation diff**, not a completed runtime gate or approval to merge.

Eight owned files are listed with SHA-256 values in `native-occurrence-repair-evidence.json`. Root's Zyra/catalog and review-document changes were not edited. No database, application service, browser, migration, or external API was run locally. No schema, route, native execution store, or restriction on native run editing was added.

## Ownership and resulting semantics

| Required capability | Existing owner reused | Change |
|---|---|---|
| Native run creation and exact reviewed snapshot | `LegacyService.createCycleWithTestcasesForUser` and its Approved-only writer | Called unchanged inside the existing shared transaction. |
| Durable dispatch identity | Existing `mbt_model_runs.manifest` JSON | Each case records `nativeOccurrence.cycleItemId`, `executionId`, and `snapshotApprovalRevision`, read from the newly created native rows before commit. |
| Atomic provenance | Existing repository/database transaction | Missing, ambiguous, or invalid required occurrence identity raises `NATIVE_OCCURRENCE_UNAVAILABLE` (409) before manifest insertion; the native run and occurrences roll back with the transaction. |
| Governed status and element attribution | `ModelStudioRepository` projections | A shared native-evidence projection matches original item, execution, test case and reviewed snapshot hash within the run/project/cycle scope. Both rollups consume that projection. |
| Original versus current membership | Existing governed-run and run-provenance responses | `caseCount` now consistently means the immutable dispatch count. Later additions do not supply model results. |
| Legacy and missing evidence | Existing manifest readers | Unpinned, incomplete or duplicate pins are `UNKNOWN`; no current-membership reconstruction occurs. Removed/missing or snapshot-mismatched originals are unavailable. |
| User explanation | Existing Model Studio and native run pages | Show dispatched counts, unavailable/unknown attribution and the exclusion of later native additions. |

The existing exclusion of soft-removed items/executions from active model outcomes is preserved. Their immutable manifest and reviewed snapshot remain intact. This does not introduce a new historical-result policy. Valid original active occurrences continue to contribute native statuses, including the initial Untested status.

Governed rows expose `occurrenceBasis`, `attributedCaseCount`, `unavailableCaseCount`, and `unknownCaseCount`; these distinguish unknown provenance from known original references whose result is currently unavailable. They do not turn missing evidence into a pass or a zero-coverage claim. Native run provenance reports original `caseCount`, `pinnedCaseCount`, and `unknownCaseCount`.

`caseEvidence` retains its separate linked-case history scope across native runs. Its API explanation and UI heading now state that scope explicitly; it is not used as a substitute for manifest-bound element evidence.

## Discriminating checks

Before changing product code, the expanded runs unit spec was executed against the original source bytes: **29 tests, 14 passed and 15 failed**. Failures included missing occurrence capture, missing/ambiguous identity not rolling back, substitution by a re-added case or different execution, snapshot mismatch, original-count drift, legacy fallback, and duplicate manifest identity. This supplements Green's independent original-occurrence positive control and failing replacement-occurrence counterexample.

After the repair, the runs, generator and preview unit suites passed **62/62 tests in 3 suites**. The runs suite itself passes **29/29**. These are composition/projection checks; they do not establish real PostgreSQL behavior.

Two regressions were added to the existing migrated database suite, bringing its declaration count to **21**:

1. Dispatch v1 through real model/native services, record a legitimate original pass, remove its native membership, edit and reapprove v2, add a fresh occurrence plus an unrelated case, record actual native results, and read authoritative database and coverage state. The new occurrences remain usable natively but cannot contribute to the original model dispatch. Original manifest and reviewed snapshot equality are asserted.
2. Insert a historical unpinned manifest fixture for an ordinary native run with a passing result. Its model attribution stays UNKNOWN while a genuine pinned dispatch retains its legitimate Untested outcomes. The genuine manifest is not modified.

The existing Model Studio API suite gained the same full remove/edit/reapprove/re-add lifecycle regression with response assertions and direct database readback. The existing governed-run UI journey now verifies the original pass, performs a real native remove/re-add and new pass, reads database/coverage state, reloads, and asserts explicit unavailable attribution. It retains the immutable manifest and checks native-page provenance wording. It adds the screenshot attachment `model-original-occurrence-unavailable-after-native-readd`; all four existing recovery screenshots remain.

## Validation record

| Check | Result |
|---|---|
| Before runs unit discrimination | 29 total; 14 passed / 15 failed, as expected on original product bytes |
| After scoped unit selection | 62 passed / 0 failed, 3 suites |
| Backend TypeScript | Pass, including new migrated test source |
| Frontend TypeScript | Pass |
| e2e TypeScript | Pass |
| Backend scoped ESLint | 3 files, 0 errors / 0 warnings |
| Frontend scoped ESLint | 3 files, 0 errors / 0 warnings |
| e2e scoped ESLint | 2 files, 0 errors / 0 warnings; existing TypeScript rules applied using the actual e2e tsconfig |
| `git diff --check` | Pass |
| Playwright discovery | 19 selected: 10 API + 9 UI; discovery only |
| Migrated database declarations | 21, including 2 new; hooks and bodies not executed locally |
| Database/API/UI execution | **Not run locally; isolated CI still required** |

Relevant local evidence files in this directory:

- `native-occurrence-before-results.json` and `native-occurrence-before.log`
- `native-occurrence-fixed-results.json` and `native-occurrence-fixed.log`
- `native-occurrence-unit-results.json` and `native-occurrence-unit.log`
- `native-occurrence-backend-types.log`, `native-occurrence-frontend-types.log`, `native-occurrence-e2e-types.log`
- `native-occurrence-backend-lint.json`, `native-occurrence-frontend-lint.json`, `native-occurrence-e2e-lint.json`
- `native-occurrence-discovery.log`, `native-occurrence-repair-evidence.json`

Initial attempts to apply the backend ESLint configuration directly to sibling e2e paths were ignored or lacked the owning TypeScript project. The final e2e lint used `native-occurrence-e2e-eslint.config.mjs`, preserving the existing rules while selecting the real e2e paths and tsconfig. No repository lint configuration was changed.

The existing isolated CI workflows already select the migrated model-run suite and both Model Studio e2e files. Root can pin and publish the complete diff, then bind independent review and actual database/API/UI outcomes to that new revision. The older 9519 CI results cannot certify this repair.
