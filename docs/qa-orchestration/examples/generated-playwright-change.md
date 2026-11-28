# Generated Playwright change from an approved handoff

**Status:** the coupled generator/reporter increment is merged as #317 (`8b627402`) and #313
(`f7788439`). Hosted disposable CI executed the generated Playwright test through the real Tesbo
reporter, and the joined governed scenario used a disposable project's approved requirement/case/link
created by the CI test actor. This remains disposable CI engineering evidence, not a human
TESBOPROJECT approval, manual UAT or production acceptance.

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

The ordered-identity and bounded-evidence follow-up is now part of the merged generator. It adds
generated-process controls for reversed-only substitution, valid reversed-order neighbors, extra
evidence fields, and canonical attachment bytes when the input contains a shadowed field. Hosted
CI smoke run `45975273556` (`#317`) and the reporter seam run `45985939679` (`#313` head
`afb3722b`, merged as `f7788439`) executed these controls; the generated-process test passed in the
pinned handoff CI step.

The test also verifies that a changed selection digest, missing/backslash external ID, changed
repository, investigation revision or unsupported oracle is refused before a change is emitted,
including packets whose digest has been recomputed. This is real Playwright subprocess execution,
not textual inspection. It is wired into the pinned investigation/handoff CI step.

## Boundaries and unsupported associations

- **No approved TESBOPROJECT case is used by the hosted journey.** The governed scenario creates a
  disposable approved requirement/case/link inside the admitted CI project through the real APIs.
  Persistent TESBOPROJECT publication and approval remain separate authorized human decisions; no
  project token or production approval is used.
- **The standalone script does not report a native Run.** The separate
  `e2e/api/handoff-native-reporter.spec.ts` joins this generator to the existing reporter with both
  synthetic and governed disposable inputs. The hosted run verifies Completed/completed closure
  with timestamps, exact execution/revisions, every observed attachment byte, closure-check
  rejection controls, the Bug-linked failed occurrence and the separate Untested manual retest.
- **No source-to-code review is automated.** The generated file is a reviewable change; a human must
  review the diff before committing it to the approved target. This script does not push branches or
  approve code.
- **No deployment or production acceptance.** The control server is a local fixture. A real target
  build, live browser observation, native evidence bytes and manual UAT remain separate gates.

## Native coverage

A separate generated-but-unsaved case proposal was recorded through the authorized MCP path on
26 November 2026 (America/Bogota). It is not a persisted native testcase. These are historical
receipt fields; the readback is retained in
[native-handoff-coverage-readback-20261127.md](../reviews/native-handoff-coverage-readback-20261127.md):

- task `2f20c10e-c1d3-4480-ba08-51f4cb04eca7`
- revision `44cff570c008a8b1b8bb46eb4712f61642c73b5aaf305702e1fd3cd5ffab9dcd`
- request key `approved-handoff-generated-change-20261127-1795746703915`
- status `in_review`, one generated/zero saved case proposal (no persisted Draft case)
- review path `/projects/df072dfe-e4d0-406a-9350-e0d022c6323f/agents/tasks/2f20c10e-c1d3-4480-ba08-51f4cb04eca7`

No manual execution is evidenced by that receipt. No new manual execution is performed here.
Staging is not approval, apply, a Test Run or evidence.

A second, distinct generated-but-unsaved proposal records the governed reporter journey:

- task `601cc4f6-08e8-4fae-8b95-933010f2dc54`
- revision `72d4982203eec734585ac5560e78fd2c09b0ce1f558b7369654f8241866704cf`
- request key `governed-handoff-native-run-20261127-1795778472668`
- status `in_review`, one generated/zero saved case proposal (no persisted Draft case)
- review path `/projects/df072dfe-e4d0-406a-9350-e0d022c6323f/agents/tasks/601cc4f6-08e8-4fae-8b95-933010f2dc54`

It remains separate from task `2f20c10e-…` (generated change/controls) and from #318's Bug/retest
contract. Manual execution remains **UNRUN**; disposable CI is not an official native result.

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

These are executed assertions in the hosted disposable smoke run. Its existing compatibility HTML
report retains Run/evidence screenshots and bounded `native-run-readback-<runId>.json` attachments
with exact project/case/Run/execution identities, result, checkout commit/branch and evidence
hashes. Fixture records are then deleted as required.
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

## Diagnostic disclosure correction — 27 November 2026 candidate

The independent Red review reproduced a narrower failure that packet-byte validation did not
cover: the uniqueness assertion received entire coverage rows. On a duplicate, Playwright copied
an extra runtime-only `internalReviewerNote` marker into its actual error, JSON report, console
output and file-backed failure context. The canonical packet attachment remained clean. This was
an isolated synthetic probe, not an observed production disclosure or a native upload.

The generator now passes only `{ length: matching.length }` to the same length matcher. It keeps
the reviewed uniqueness label and exact expected/received cardinality diagnostics consumed by
the existing reporter-journey checker, while withholding unrelated response properties. Ordered
criterion matching, exact sole-link/revision checks and native identity remain unchanged.

EG then independently reproduced additional disclosure from malformed JSON, object-valued
identities, URL credentials and a real loopback connection reset. The transport error included
the synthetic bearer header. The coupled correction now replaces parser/request exceptions with
fixed categories, validates UUID/digest primitives before value comparisons and evaluates URL
refusals as booleans. It never forwards an original exception or cause containing body, path or
header data. These are corrections within the same emitted-test owner.

The regression puts the random marker into successful HTTP coverage responses on both the
duplicate and valid-single-row paths. It checks the actual child error/report/output and every
reported attachment's bytes, including failure context. The original private-503, ordered-group,
identity and alternate-link controls remain. The added control failed before the generator fix;
the complete two-case Node suite passed afterward, with its actual generated Playwright children.
The extended suite also passed after EG’s corrections: seven malformed-body/field/transport
controls and one rejected-userinfo control use runtime-only markers and inspect report, console
and all reported attachment bytes. The socket-reset control uses its marker as the actual bearer
token, so a formatter that reintroduces the request call log fails the regression.
These local results qualify the emitted-test boundary. Hosted candidate CI, native diagnostic
upload/readback, broader field-specific disclosure policy and live acceptance remain separate.

The native reporter seam and governed requirement/case/link journey remain in #313; #319 was
merged into that owner branch on 27 November. Their disposable record and execution evidence must remain attributed to their
own candidates; they do not establish the ordinary New task/model-authoring path or mandatory
Skill-content delivery. No new runner, draft owner or result service is introduced here.
