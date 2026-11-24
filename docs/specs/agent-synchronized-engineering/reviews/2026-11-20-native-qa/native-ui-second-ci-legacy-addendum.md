# Second CI legacy correction addendum

This addendum corrects two source-review details in the earlier freeze. It does not replace the historical files:

- `native-ui-second-ci-legacy-review.md`, SHA-256 `6c0aee4629fd1b142bdff2c1e674225abc10a6694ce6b8cc8d7338349b470dc7`.
- `native-ui-second-ci-legacy-correction-freeze.json`, SHA-256 `1d3d5347cf59843f20d2fe1314839cd949b0b1cefa728975d5c338d3f0e99cc7`.

## Exact evidence text

The earlier correction to exact `Evidence (2)` was still wrong. The accessibility/error-context presentation inserts a display space, while the actual DOM has adjacent text `Evidence` and a count span `(2)`. `getByText` matches normalized DOM text; the correct exact text is **`Evidence(2)`**.

Root confirmed the absence of whitespace by isolated transpile/SSR of the existing header, without running the application. This reviewer independently corroborated it in the actual CI trace's DOM snapshot. The paragraph's children are the icon, text `Evidence`, and `SPAN` text nodes `(`, `2`, `)`, with no intervening whitespace node.

Trace: `runtime-correction-ci-evidence/home/runner/work/Tesbooboo/Tesbooboo/e2e/test-results-native-retest/ui-executions-execution-ev-5b3bf-he-failure-and-its-evidence-ui/trace.zip`, SHA-256 `79cc4ca338fde9571bdd4e83a68899b748e6b90dfdc36e7e43ff34abc87ab74c`.

Only the two deterministic two-file assertions now use exact `Evidence(2)`. The provenance, screenshot, trace viewer/download, loading-state and exact-one-request assertions remain unchanged. The initial exact `Evidence` error and this space error are test-selector mistakes, not missing-evidence product defects. The original CI failures remain historical evidence; this source correction still needs runtime validation.

## SQL scalar portability

Independent manual review identified a transport difference in the new legacy-data fixture: direct `UPDATE ... RETURNING` may include the `UPDATE 1` command status under the existing Docker psql transport, while the direct node-postgres runner prints returned rows. The existing `scalar` helper documents a single-column SELECT contract.

The approved addendum wraps the identical guarded update in `WITH updated AS (...) SELECT id::text FROM updated`. Generated-project membership, shared-project exclusion, organization, nonarchived status, actual authenticated user, exact `owner` membership, returned-ID assertion, and authorized API readback are unchanged. No new transport or fixture authority was introduced. The current writer's exact 400 refusal and unchanged-settings assertion are intact. The existing cleanup loop remains unchanged; it records cleanup attempts, not proof of runtime archive success.

The independent manual reviewer checked the final prefix and reported no source blocker. No database operation was executed locally.

## Final owned freeze

Manifest: `native-ui-second-ci-legacy-addendum-freeze.json`, SHA-256 `77b91b812b9052505e12be1e5de25cd97f4aa6dcf1d5b0458e2bc2112aa3e449`.

| Item | SHA-256 |
| --- | --- |
| Final owned cycles legacy prefix, saved in `native-ui-second-ci-legacy-prefix-final.txt` | `38419004f3fc0fcfa929ab790da0f211b101417fb2ecd218633678d555aa5cb6` |
| Whole cycles file immediately before the separately authorized native append | `f2669c9e2eadfcb4cb01fe224724d586f0b325b2bb9507758e017329c94db36f` |
| Preserved native 20-case block, including the author's exact 201 correction | `ed06b8ff95ec6da570f5a4bcd42785d405d55d7100f38d77e4f262c23ca3e59b` |
| Final `e2e/ui/executions.spec.ts` | `ffe939db07c4517c4ea5af20de79e4511758589c44fbe1ebba2f882b825eb011` |
| `native-ui-second-ci-legacy-addendum.patch` | `b102f861e66fb696348f9c7447cba2a12ed8b4e8227cbdfffaeda788d9bee73f` |

E2E TypeScript and `git diff --check` passed again after these two corrections. The preceding list-only check collected 260 selected tests and 3009 total; this addendum changes no declarations or selection, and the native author owns the separately announced one-test expansion. No new local runtime, browser, or DB execution was performed. The corrected fixture/selector journeys require CI on the final combined head. The recorded adjacent remote-title and duplicate-prefetch defects and their exact failing assertions remain unchanged.
