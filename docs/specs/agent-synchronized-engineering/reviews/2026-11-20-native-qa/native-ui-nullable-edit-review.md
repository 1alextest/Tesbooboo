# Independent review: nullable native retest destination editing

## Disposition

**No source blocker found in the frozen two-file correction. Runtime verification remains open.** The product change belongs at the existing Run editor's form boundary, and the new regression exercises the real native retest → destination Edit journey without weakening the older card-edit assertion.

This review was read-only. It inspected the frozen source, relevant existing UI/API owners, the author's exact patch and collection artifacts, and byte preservation of the earlier tests. It did not run the application, database, browser, or E2E tests locally.

## Exact source binding

Source base: `cab1c6928b32f6f7b74b30dbf75879ef127628be`.

| Item | SHA-256 |
| --- | --- |
| `native-ui-nullable-edit-freeze.json` | `a9e69cdf3d5a770f043e0f1f60ceea70d123add53d56a12450c11fc2dd4687c2` |
| `Tesbo-Frontend/app/(app)/projects/[id]/cycles/page.tsx` | `6bb698196ef9bb8c11651bf379bdf4f091bd93b6f7a349f36c2daa7bfd0f056c` |
| `e2e/ui/cycles.spec.ts` | `739d0fd9d66c553620e696331f98ec51b0f81aa6a577f892894186620ffda77f` |

The hashes above were independently recomputed from the actual files. The earlier legacy prefix remains `38419004f3fc0fcfa929ab790da0f211b101417fb2ecd218633678d555aa5cb6`. The prior native 20-case block remains `ed06b8ff95ec6da570f5a4bcd42785d405d55d7100f38d77e4f262c23ca3e59b`, including the exact HTTP 201 cancellation-setup correction and existing screenshot attachments. This was checked by removing only the appended test and comparing the entire retained block, not by counting declarations. `e2e/ui/executions.spec.ts` remains `ffe939db07c4517c4ea5af20de79e4511758589c44fbe1ebba2f882b825eb011`.

## Product boundary

The only product delta is three assignments in `openEdit`: description, environment, and build version now use `?? ""` before entering existing controlled string state. Existing nonnull values are preserved. The Run object and stored values are not changed by opening the form. The existing required-environment disabled state and submit guard still call `.trim()` on a string, and the existing update API remains the writer.

The prior CI run `44703524270` / job `136177365716` captured an ordinary card Edit failure with a whole-page error boundary and `TypeError: Cannot read properties of null (reading 'trim')`. That actual failure is the pre-fix runtime evidence. The new native scenario itself has not yet executed.

The native input parser accepts blank optional environment/build fields as null. The existing cycle writer stores those nulls, and the creation manifest records the exact target name/environment/build. The ordinary update writer changes current metadata without rewriting the native creation manifest. The regression's expectations match those existing owners.

## Regression assessment

The single appended case is discriminating at the relevant boundaries:

1. It creates its own project and configures Staging through the real settings API. It does not modify the shared context project's settings.
2. It creates approved source cases and a real Failed source observation through the existing fixture, then captures the complete source execution list.
3. It opens the actual reviewed native dialog, clears optional environment/build, creates the retest through the UI, and checks the source lineage. It retrieves the destination through the real API and asserts exact null environment/build plus the creation manifest's null target settings.
4. It locates the destination card by its exact Run ID and clicks that card's Edit action. The existing modal heading and form fields must render, the environment/description/build fields must be empty, Save must be disabled, and no unhandled page error may have been observed. Without the environment normalization, the existing `.trim()` crash prevents those modal assertions from passing even when React handles the error through its boundary.
5. Supplying description/build alone must leave Save disabled. Selecting configured Staging must enable Save. The test waits for the exact destination PATCH and checks HTTP 200, followed by an authorized API readback of the supplied values.
6. It compares the entire retained creation manifest and the complete original source execution observations for equality. It then reloads the list, reopens the same destination's Edit form, and checks persisted values and enabled Save.

The new test explicitly forces null environment and build. Description is empty under the current cycle writer, so this scenario does not separately demonstrate a historical `description: null` row at runtime; the description normalization is covered by the same narrow source review. Existing native cases retain the broader evidence, exact-occurrence, recovery, and keyboard coverage.

Cleanup stays in `finally`: child Runs, source Run/cases, and the generated project are passed to existing cleanup/API deletion owners, and the request context is disposed. The review confirms scoped cleanup attempts, not runtime deletion success. The added case introduces no mock response, skip, retry, timeout increase, or alternate product writer.

## Verification limits

The author reports frontend/E2E TypeScript, scoped ESLint, and diff checks passing. This reviewer independently verified the frozen files and their preservation boundaries. The bound list artifacts contain **261 selected tests in nine files, 3010 total tests, and 21 native UI cases**; their hashes match the author's manifest. Collection is not execution.

The exact combined-head isolated CI run must still prove this new native journey, the corrected cancelled-terminal focus cases, and the bounded legacy fixture corrections. The adjacent remote-ticket title and duplicate-prefetch defects remain recorded with unchanged assertions. This source verdict does not certify a green suite or later revisions.
