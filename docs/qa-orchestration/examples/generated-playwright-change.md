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
   comparing the sole link's native ID. A distinct second link is therefore caught rather than
   filtered away.
6. Asserts the supported oracle for that case, requirement version, link and criterion keys, with
   the recorded case and approval revisions.
7. Reads and checks the evidence file's packet digest and exact target, then attaches it before the
   first coverage assertion, so a failed attempt still carries the selected packet identity while
   never attaching the rejected response body.

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
- **Legitimate unrelated links:** another case or different criteria on the same coverage response
  do not block the selected case.

The test also verifies that a changed selection digest, missing/backslash external ID, changed
repository, investigation revision or unsupported oracle is refused before a change is emitted,
including packets whose digest has been recomputed. This is real Playwright subprocess execution,
not textual inspection. It is wired into the pinned investigation/handoff CI step.

## Boundaries and unsupported associations

- **No approved TESBOPROJECT case is used.** The authorized project currently has staged/unapplied
  coverage proposals and Draft cases, and this session must not approve production records. The
  journey remains a CI-disposable contract until a human applies and approves one exact bundle.
- **No native run/evidence readback is claimed from this script.** The Playwright reporter/automation
  ingest and its authoritative readback are owned and tested separately in
  `e2e/api/automation.spec.ts`; this reference consumer does not create a native run. The next
  authorized increment is to run the generated tag through that reporter against a disposable
  approved case and read the resulting run, execution and evidence back through the existing API.
- **No source-to-code review is automated.** The generated file is a reviewable change; a human must
  review the diff before committing it to the approved target. This script does not push branches or
  approve code.
- **No deployment or production acceptance.** The control server is a local fixture. A real target
  build, live browser observation, native evidence bytes and manual UAT remain separate gates.

## Native coverage

A separate Draft case proposal was staged through the authorized MCP path:

- task `2f20c10e-c1d3-4480-ba08-51f4cb04eca7`
- revision `44cff570c008a8b1b8bb46eb4712f61642c73b5aaf305702e1fd3cd5ffab9dcd`
- request key `approved-handoff-generated-change-20261127-1795746703915`
- status `in_review`, one unpublished Draft case in Requirements
- review path `/projects/df072dfe-e4d0-406a-9350-e0d022c6323f/agents/tasks/2f20c10e-c1d3-4480-ba08-51f4cb04eca7`

Manual execution remains **UNRUN**. Staging is not approval, apply, a Test Run or evidence.

## Run

```sh
node --test scripts/qa-handoff-generated-change.test.mjs
```

The test writes only under a temporary directory inside `e2e/` and removes it. It does not use a
Tesbo token, create records or call a provider.
