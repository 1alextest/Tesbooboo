# Second CI legacy UI triage and bounded correction receipt

## Bound evidence and scope

This is a fresh review of completed GitHub Actions run `44703524270`, job `136177365716`. The tested PR head was `cab1c6928b32f6f7b74b30dbf75879ef127628be`; the job actually checked out synthetic merge `d5f1175644900b28845afdb4ed413c85f25454c0`, combining that head with development `d74ddce2d04241695164b5a8b4d9b341932cfdcc`. The report's older `prBaseHash` metadata does not identify the actual tested merge; the job's git output does.

The review used the completed job log, extracted Playwright report, failed-test error contexts, network/console trace records, and actual failure PNGs. It did not run an application, browser, database command, or local E2E test. Earlier independent scenarios, source reviews, first-CI triage, and correction receipts remain unchanged.

Evidence is under `/workspace/scratch/8e9074abd0d0/qa-loop-assurance/`:

| Evidence | SHA-256 |
| --- | --- |
| `runtime-correction-smoke-136177365716.log` | `a7d66954c3dc6df4feb4a153104d815ab743ff086cae13239c3667ada656ade5` |
| `runtime-correction-ci-evidence.zip` | `caa6a9f440266167825415bcc4cfd8d6270c85359644f2f7619524e1a6d37c4c` |
| `runtime-correction-ci-evidence/report-data/report.json` | `4a251e42a14d2525e5c26c15685ac588d80fe685d4e61ae275037e1018fdaabb` |

## Exact outcome counts

The reporter's 199 expected outcomes consist of **198 actual passes and one expected failure**. Its 11 skipped entries consist of **two explicit skips and nine tests blocked by a failing `beforeAll`**. No flaky classification was reported.

| File | Actual pass | Unexpected fail | Expected fail | Explicit skip | Setup-blocked | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `api/cycles.spec.ts` | 47 | 0 | 0 | 0 | 0 | 47 |
| `api/executions.spec.ts` | 16 | 0 | 0 | 0 | 0 | 16 |
| `api/plans.spec.ts` | 13 | 0 | 0 | 0 | 0 | 13 |
| `api/route-resolve.spec.ts` | 18 | 0 | 0 | 0 | 0 | 18 |
| `api/billing.spec.ts` | 3 | 19 | 0 | 2 | 0 | 24 |
| `ui/billing.spec.ts` | 1 | 16 | 1 | 0 | 0 | 18 |
| `ui/cycles.spec.ts` | 47 | 10 | 0 | 0 | 9 | 66 |
| `ui/executions.spec.ts` | 42 | 4 | 0 | 0 | 0 | 46 |
| `ui/readable-urls.spec.ts` | 11 | 1 | 0 | 0 | 0 | 12 |
| **Total** | **198** | **50** | **1** | **2** | **9** | **260** |

The expected failure is the existing UI billing renewal-copy test at tested line 194. Billing has 35 unexpected failures and remains root-owned. The 20 native UI cases have 18 passes: the original 16 plus both created-terminal focus cases. Both cancelled-terminal cases fail during setup on expected HTTP 200 versus the controller's valid HTTP 201, before their focus assertions. That one-line fixture correction belongs to the native author and is preserved here.

The remaining **13 nonbilling legacy UI failures** divide into **10 concrete fixture/selector problems and three genuine product defects in existing owners**. The nine blocked tests share the first fixture problem below. This classification does not claim that assertions beyond a failed step have run.

## Complete failure matrix

Line numbers below identify the tested `cab1` source, before this correction adds fixture code.

| ID | Tested case | Observed boundary and existing cause | Scope and bounded response |
| --- | --- | --- | --- |
| C1 | `ui/cycles.spec.ts:300`, Priority-only filtering | `beforeAll` fails at line 271 with `Row 6: Type must be at most 32 characters`. `LegacyImportedType${stamp}` at line 253 exceeds the existing field limit. | Coupled fixture. Shorten to `LegacyType${stamp}` while retaining a noncanonical Type and all ten filter scenarios. |
| C2 | `ui/cycles.spec.ts:1174`, environment settings object | The disabled-state assertion resolves header CTA, empty-state CTA, and actual form submit. The actual submit is disabled as expected. | Coupled selector. Scope disabled-state and submit actions to the form; retain exact environment list, Production selection, URL, created Run, and API persistence. |
| C3 | `ui/cycles.spec.ts:1174`, claimed settings string | Same three-button strictness. Also, the current writer normalizes string input to an object, so the old title overstated stored-string coverage. | Coupled selector/fixture. Same form scope. Use the existing isolated SQL transport to store an actual legacy JSON string and verify its type/value through the real API. No additional test. |
| C4 | `ui/cycles.spec.ts:1194`, no environments | Page-wide Create button resolves three controls; the form's submit is the intended disabled control. | Coupled selector. Scope to form; preserve empty options, disabled submit, and exact settings-tab href. |
| C5 | `ui/cycles.spec.ts:1203`, invalid/duplicate stored environments | Setup PATCH returns HTTP 400, `Environment URL is required`. The baseline writer correctly rejects invalid new configuration before the reader assertion. | Coupled legacy fixture. First assert exact writer refusal and unchanged settings, then seed old stored data on the generated project with organization/current-owner guards; assert real API readback and retain exact filtered dropdown options. |
| C6 | `ui/cycles.spec.ts:1250`, Test Plan environment choice | Initial `Create test run` resolves the header action, section action, and empty-state action. | Coupled selector. Use the existing header action, then form submit; preserve offered environments, Production choice, Run name, and API persistence. |
| C7 | `ui/cycles.spec.ts:1266`, Test Plan without environments | Same ambiguous initial action. | Coupled selector. Use header action and disabled form submit; preserve no-environments hint and refusal to submit. |
| C8 | `ui/cycles.spec.ts:1281`, card navigation followed by Edit | Navigation assertions pass; Edit produces the application error boundary. Trace logs `TypeError: Cannot read properties of null (reading 'trim')`. List-page `openEdit` copies null `r.environment`; the form calls `environment.trim()`. | Genuine baseline defect, classified by root/manual review as coupled downstream of native retest. Native author owns the separately authorized minimal normalization and new native empty-environment retest → Edit regression. This review did not alter the product or weaken this test. |
| E1 | `ui/executions.spec.ts:863`, mixed Tesbo/Jira/Linear bugs | Exact three bug-key assertion passes. Title assertion expects the two selected remote summaries but sees the default testcase-derived title twice. Actual POST bodies contain that wrong title. | Genuine baseline defect in `LogBugDialog.handleLinkExisting`; adjacent by root scope decision. Preserve exact title/key assertions and record the defect. |
| E2 | `ui/executions.spec.ts:1885`, Failed + Save → link existing | Picker and intended checkbox are present, but test expects `Link an existing bug`. Existing owner renders `Link existing bugs`. | Coupled selector. Use the exact existing title; retain selection confirmation, linking, reopened panel, and bug identity/persistence assertions. |
| E3 | `ui/executions.spec.ts:2245`, automation provenance/evidence | Failure/provenance assertions pass. Snapshot renders `Evidence (2)` with screenshot and trace. My preceding correction changed the selector to exact `Evidence`, causing this failure. | Test correction error, not a product defect. Match exact `Evidence (2)` in this deterministic two-file case; retain file, provenance, trace viewer/download assertions. |
| E4 | `ui/executions.spec.ts:2290`, evidence fetched once | The exact-one request and no-spinner assertions pass; final exact `Evidence` label fails because the label is `Evidence (2)`. | Same test correction error. Match exact counted label; preserve the existing observation period, exact-one request count, and no-spinner assertions. |
| R1 | `ui/readable-urls.spec.ts:150`, UUID hard-load prefetch | Exact-one assertion receives two project requests. Trace independently shows two member requests as well. | Genuine existing-owner duplicate-read defect; adjacent by root scope decision. Preserve both exact-one assertions. Static race described below; no product or test change made. |

### Nine blocked filter cases

The C1 `beforeAll` failure prevents Type-only filtering (line 308), Assignee/Unassigned filtering (316), AND composition with status/search (329), empty-match state (350), Clear filters (361), noncanonical Type (378), noncanonical Priority (388), picker isolation (398), and rapid interleaved changes (417). They are not passes and were not intentionally skipped. Shortening the invalid setup Type lets CI reach their original assertions.

## Product evidence and ownership

### Nullable Run edit

The actual failure PNG under `ui-cycles-run-card-is-one--24dec--still-opens-its-own-dialog-ui/` shows the whole-page error boundary, and its trace records null `.trim()`. This is more specific evidence than an absent Save button. `Tesbo-Frontend/app/(app)/projects/[id]/cycles/page.tsx:248–253` copies nullable API metadata into string form state; the submit guard later trims environment. A missing environment is a real API-supported state, including native retest's optional environment, so changing the fixture to hide it would mask the defect.

The list-page owner is byte-identical between baseline `1fe1005` and tested head `cab1`. Root assigned its correction and one native downstream regression separately. No product acceptance is claimed here for that later correction.

### Remote ticket title corruption

`Tesbo-Frontend/components/LogBugDialog.tsx:232–236` preloads `Bug: <testcase title>`. Its existing-link branch at lines 381–390 sends that hidden `bugTitle`, rather than the selected issue summary. The same component's lines 519–523 say the existing tickets carry their own title and hide new-bug title/description fields.

The `ui-executions-auto-bug-fil-556c8-ix-of-Tesbo-Jira-and-Linear-ui/trace.zip` network records contain two successful HTTP 201 writes, one Jira and one Linear, each with title `Bug: UI Bug Mixed Types 1795164289459`, despite the selected summaries being `Mixed Jira ticket` and `Mixed Linear ticket`. The rendered result and screenshot show the wrong stored titles. The existing Tesbo title and all three keys are correct. This writer is byte-identical to baseline. Changing expected titles would conceal the defect; assertions remain untouched.

### Duplicate UUID project reads

The `ui-readable-urls-project-p-571be-t-and-its-members-once-each-ui/trace.zip` shows same-project GET pairs beginning at 08:44:25.334 / 08:44:25.444 UTC and member GET pairs at 08:44:25.335 / 08:44:25.447 UTC. The page renders; duplicate traffic is the failure.

Existing `lib/projectPrefetch.ts` starts project/member requests immediately for UUID paths. `takePrefetched` deletes entries when `ProjectDataProvider` consumes them. The resolver continuation subsequently checks `store.has(projectKey(projectId))` and starts both again when absent. Consumption before that continuation is a concrete source-level duplicate path. **The trace does not expose JavaScript callback ordering, so that ordering remains a source-supported mechanism hypothesis for this particular occurrence.** A resolver held until after initial consumption would be a discriminating regression for the owner. Prefetch and provider code are both byte-identical to baseline; the native cycle recovery branch does not apply to this bare-project URL. The exact-one assertions remain unchanged.

## Approved corrections and preservation boundary

Root approved the ten fixture/selector corrections and the existing string scenario's storage-shape repair. Only the legacy prefix of `e2e/ui/cycles.spec.ts` and three selectors in `e2e/ui/executions.spec.ts` were edited by this reviewer. No billing file, readable-URL file, product code, validation policy, timeout, retry, skip, or test deletion was changed. The native block, including the author's HTTP 201 fixture correction, is byte-for-byte preserved.

The environment fixture reuses the already imported `literal`/`scalar` from `e2e/utils/psql`; search found no dedicated project-settings fixture helper. Existing isolated settings maintenance in `e2e/ui/zyra.spec.ts` uses the same transport. The bounded local helper:

1. Accepts only a project ID in this describe's generated-project collection and explicitly excludes the shared context project.
2. Retrieves the current user through authenticated `/api/auth/me`.
3. Updates only that project ID, the expected organization, a nonarchived row, and an existing `project_members` row for the current user with role exactly `owner`.
4. Requires `RETURNING id` to equal the single generated ID.
5. Reads the project through the actual authorized API and asserts both settings type and exact value.

The schema spelling and lowercase `owner` value are confirmed by the existing project creator's `INSERT INTO project_members` at `legacy.service.ts:3959`. Cleanup retains the existing project API deletion loop. No SQL was executed locally.

The canonical object scenario verifies the public writer's object shape. The legacy string scenario now actually stores and reads a JSON string. The malformed scenario first proves exact HTTP 400 and unchanged settings, then separately arranges legacy persisted input for the tolerant reader. The current writer and the legacy reader keep separate, explicit contracts.

## Correction freeze and static checks

Freeze: `native-ui-second-ci-legacy-correction-freeze.json`, SHA-256 `1d3d5347cf59843f20d2fe1314839cd949b0b1cefa728975d5c338d3f0e99cc7`.

| Frozen item | SHA-256 |
| --- | --- |
| Whole `e2e/ui/cycles.spec.ts` at this handoff, before the next native regression | `ac83a68659476a0be3ddf15bfe06cc2a25b89cf59dcd3a18065e53a306fc771b` |
| Owned cycles legacy prefix | `b5ec9d3a811ca63f9ebcadc711f524c2d51961d551f5d85084be602bd7240228` |
| Preserved native 20-case block, including exact HTTP 201 correction | `ed06b8ff95ec6da570f5a4bcd42785d405d55d7100f38d77e4f262c23ca3e59b` |
| `e2e/ui/executions.spec.ts` | `19c547d8fc3fe831b2f0fa29549606fe9e541da465ea4dc614981ea0455a5182` |
| Owned `native-ui-second-ci-legacy-correction.patch` | `1ed03a5f8b9de9e2c651431092b0545eb08eb280b0354ec54ac0d4407b7dc8ea` |

The prefix is saved separately as `native-ui-second-ci-legacy-prefix-frozen.txt`, so a later authorized native append need not invalidate the owned-prefix proof.

Checks actually run: E2E TypeScript `tsc --noEmit` passed; `git diff --check` passed; Playwright list-only collection reported **260 tests in the same nine selected files**, **3009 in the whole suite**, before the separately authorized native addendum. No test count changed in this correction. List-only collection is not runtime execution.

Tested source bindings before these repairs:

| Source at `cab1` | SHA-256 |
| --- | --- |
| `e2e/ui/cycles.spec.ts` | `ccd23508bacf31b463bff63046188a2ce1bdf8b044953980357e5876ddf54c00` |
| `e2e/ui/executions.spec.ts` | `88b4adb537250f956b3218d2b3d8ffc158480c677b1d309dcd96d299513d4bc1` |
| `e2e/ui/readable-urls.spec.ts` | `154e48bc27ce1dfb780840a195c1991722fe76883803bbe946a62507badffcd8` |
| Run list page | `53b3ac5ddaed7252d61db29c342e0639166a0a5b43acc70f77fb3b0cfe10532a` |
| `components/LogBugDialog.tsx` | `450c00e9661f833fb9cb535b54ec744a988bd636a4c7fc48503d1bbfd04efc03` |
| `lib/projectPrefetch.ts` | `1d958865f951aa55f0b041588d6687c9dbe0f31a70237c1653c841a3d71f4014` |
| `components/project/ProjectDataProvider.tsx` | `0ff6f722ceea14f6146fa84d40854882b0f0f34f7406a300cf4b2e78bfe7fed3` |

## Remaining gates

The approved fixture corrections require isolated CI on their exact final combined head. The nullable Run edit correction and its new native regression require separate source review and runtime evidence. Cancelled-terminal focus still needs a run that reaches its assertions after the 201 setup correction. The adjacent remote-title and duplicate-prefetch defects remain recorded with unchanged failing assertions. The completed `cab1` run is not green and does not certify subsequent changes.
