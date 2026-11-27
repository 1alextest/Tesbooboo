# Generated Playwright change from an approved handoff

**Status:** reference journey increment. It consumes the exact packet from
[approved-automation-handoff.md](approved-automation-handoff.md) and executes one generated
Playwright test against a controlled coverage target. It is not a generator fleet, a new review
owner, a native execution, or production acceptance.

## What is implemented

`scripts/qa-handoff-generated-change.mjs`:

1. Recomputes the packet's `selectionDigest` and refuses any changed content.
2. Rechecks the native project/task/receipt/requirement/link/case identities, both case revisions,
   exact criterion keys, the approved external ID, the target path/repository/revision and the
   single approved investigation risk.
3. Emits one reviewable Playwright test at the approved `testcase.automationPath`. The test carries
   `@tesbo.testId("<externalId>")`, so the existing `@tesbox/playwright-reporter` can attribute a
   later real run to the case without inventing an identity.
4. Asserts the approved oracle: exactly one current approved link exists for that case,
   requirement version, link and criterion keys, with the recorded case and approval revisions.
5. Attaches a JSON evidence file containing the packet digest and exact target, so an execution
   carries the selection identity rather than only a title.

The handoff packet now exports `native.testcase.externalId`; a generator no longer has to query
around the contract or guess the reporter tag.

## Verified path

`scripts/qa-handoff-generated-change.test.mjs` runs the generated `.spec.mjs` with the existing
Playwright installation. It serves two controlled responses:

- **Correct coverage:** one current approved link matching the packet. The generated assertion
  passes.
- **Relevant fault:** the same coverage row is duplicated. The generated assertion fails because
  the approved invariant is exactly one link.

The test also verifies that a changed selection digest, missing external ID, or changed target is
refused before a change is emitted. This is real Playwright subprocess execution, not textual
inspection. It is wired into the pinned investigation/handoff CI step.

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
