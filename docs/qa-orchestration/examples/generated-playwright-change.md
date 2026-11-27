# Generated Playwright change from an approved handoff

**Status:** reference journey increment. It consumes the exact packet from
[approved-automation-handoff.md](approved-automation-handoff.md) and executes one generated
Playwright test against a controlled coverage target. It is not a generator fleet, a new review
owner, a native execution, or production acceptance.

## What is implemented

`scripts/qa-handoff-generated-change.mjs`:

1. Recomputes the packet's `selectionDigest` and refuses any changed content. This detects accidental
   or unconfirmed edits; it is not a signature and does not replace native authority.
2. Rechecks the native project/task/receipt/requirement/link/case identities, both case revisions,
   exact criterion keys, the approved external ID, the target path/repository/revision, and that the
   investigation's file and repository revision match the approved case target.
3. Supports exactly one reviewed oracle: "The requirement exposes exactly one current approved link
   for the selected case and criteria." Any other oracle is refused rather than approximated.
4. Emits one reviewable Playwright test at the approved `testcase.automationPath`. The test carries
   `@tesbo.testId("<externalId>")`, so the existing `@tesbox/playwright-reporter` can attribute a
   later real run to the case without inventing an identity.
5. Requires the coverage read to use the explicitly configured API origin, rejects credentials and
   non-loopback HTTP, and counts the logical approved case/requirement/criterion group before
   comparing the sole link's native ID. Criterion arrays retain the native contract's exact order:
   a reversed-only substitution is refused, while a valid separate reversed group does not count
   toward the selected group's uniqueness. A distinct second matching link is caught rather than filtered away.
6. Asserts the supported oracle for that case, requirement version, link and criterion keys, with
   the recorded case and approval revisions.
7. Checks the supplied evidence against the complete bounded identity (packet digest and the four
   reviewed target fields). Rejects additional fields and invalid input before any coverage read.
   Writes canonical identity JSON to the attempt's own output file and attaches that file before
   the first coverage assertion; it does not forward the input file's raw bytes. The existing
   reporter can therefore retain identity on a coverage failure without retaining unrelated input
   bytes or the rejected response body. Identity is not itself evidence of a successful execution.

The handoff packet now exports `native.testcase.externalId`; a generator no longer has to query
around the contract or guess the reporter tag.

## Verified path

`scripts/qa-handoff-generated-change.test.mjs` runs the generated `.spec.mjs` with the existing
Playwright installation. It serves controlled responses for:

- **Correct coverage:** one current approved link matching the packet. The generated assertion
  passes.
- **Faults:** duplicated link, a different or wrong link ID, wrong requirement/approved version,
  wrong approval revision, and a private 503 body. Each fails the relevant assertion, retains the
  validated packet-evidence attachment, and never publishes the rejected response body.
- **Legitimate unrelated links:** another case, different criteria, or a separate reversed-order
  group on the same coverage response do not block the selected case.

The proposed ordered-identity and bounded-evidence follow-up adds generated-process controls for
reversed-only substitution, valid reversed-order neighbors, extra evidence fields, and canonical
attachment bytes when the input contains a shadowed field. These follow-up controls are NOT RUN
until the exact candidate's CI supplies execution receipts. Earlier verified controls retain their scope.

The test also verifies that a changed selection digest, missing/backslash external ID, changed
repository, investigation revision or unsupported oracle is refused before a change is emitted,
including packets whose digest has been recomputed. This is real Playwright subprocess execution,
not textual inspection. It is wired into the pinned investigation/handoff CI step.

## Boundaries and unsupported associations

- **No approved TESBOPROJECT case is used by this fixture.** The 26 November 2026 staging receipt
  below records an unpublished proposal. Current project inventory and eligibility have not been
  reverified in this session; this does not establish that no approved case exists today. Persistent
  case publication and approval remain separate authorized human decisions. The test uses only
  its admitted CI-disposable project.
- **The standalone script does not report a native Run.** The existing reporter/automation
  ingest remains the result owner. The separate `e2e/api/handoff-native-reporter.spec.ts` joins this
  generator to that actual reporter with both synthetic and governed disposable inputs. Its exact
  candidate must execute in hosted CI before native readback is credited; a passing standalone
  generator test does not establish that seam.
- **No source-to-code review is automated.** The generated file is a reviewable change; a human must
  review the diff before committing it to the approved target. This script does not push branches or
  approve code.
- **No deployment or production acceptance.** The control server is a local fixture. A real target
  build, live browser observation, native evidence bytes and manual UAT remain separate gates.

## Native coverage

A separate Draft case proposal was recorded through the authorized MCP path on 26 November 2026 (America/Bogota).
These are historical receipt fields, not a fresh read of the current task/revision/status:

- task `2f20c10e-c1d3-4480-ba08-51f4cb04eca7`
- revision `44cff570c008a8b1b8bb46eb4712f61642c73b5aaf305702e1fd3cd5ffab9dcd`
- request key `approved-handoff-generated-change-20261127-1795746703915`
- status `in_review`, one unpublished Draft case in Requirements
- review path `/projects/df072dfe-e4d0-406a-9350-e0d022c6323f/agents/tasks/2f20c10e-c1d3-4480-ba08-51f4cb04eca7`

No manual execution is evidenced by that receipt. Current native execution history must be read
after reconnecting; no new manual execution is performed here. Staging is not approval, apply,
a Test Run or evidence.

## Where verification is visible

Developer checks, disposable integration results and persistent project executions have different
destinations. The historical scorecard/calibration examples use Node tests and retain engineering
output in their local or CI run. They provide neither an intelligence dashboard nor native Run
records. This generated-process test uses Playwright's list/JSON reporters, and likewise has no
Tesbo upload. An `@tesbo.testId` tag identifies a case only when the configured Tesbo reporter
actually reports it to an authorized project.

The joined handoff fixture reuses the existing **Test Runs** list and Run result drawer. The governed
scenario now requires all three actual reporter-created Runs (initial pass, controlled fault,
corrected automated attempt) to be discoverable by their unique names. Opening a card must read
that exact Run, show automated provenance and the actual checkout commit/branch, preserve its
case/result after reload, and download every observed evidence file through the UI with identical
bytes. The original closure and full attachment checks remain at the API boundary. The separate
native manual retest must still show **Untested** and retain its origin. It is not executed by the
corrected automated Run.

These are assertions in the candidate, not a claim of executed browser acceptance. On a completed
hosted run, the existing compatibility HTML report retains Run/evidence screenshots and bounded
`native-run-readback-<runId>.json` attachments with exact project/case/Run/execution identities,
result, checkout commit/branch and evidence hashes. Fixture records are then deleted as required.
The Git checkout identifies the disposable application build; the packet's separate target revision
still identifies the controlled generated-change fixture. Neither is a production acceptance.

For persistent TESBOPROJECT tracking, reopen the existing review task above and reconcile the
connected requirement/case inventory before proposing any revision. Reuse matching definitions and
history; do not create eleven cases merely because eleven development checks ran. A permitted
human must apply and approve an eligible definition before an authorized reporter can create its
real Run. Navigate **Test Runs → Run → case result → Evidence** for that reported execution.
Keep source/CI links with the existing review work when no native evidence writer is available.
No persistent case, approval, Run or PASS is created by this documentation or disposable test.

The native requirements/cases/review task and engineering evidence need reconciliation through the
connected project; no official IDs are invented. The developer walkthrough is updated here. Native
Manual/Policy records and active Skills remain unchanged by this test-only continuation; their
discovery/write status stays blocked until the authorized connection is available.

## Run

```sh
node --test scripts/qa-handoff-generated-change.test.mjs
```

The test writes only under a temporary directory inside `e2e/` and removes it. It does not use a
Tesbo token, create records or call a provider.
