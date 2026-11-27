# What Agentic QE adds to Tesbo’s automation handoff

**Decision, 26 November 2026.** Use Agentic QE’s executable method to evaluate an assertion on small, known reference fixtures. Borrow its practice of tying evidence to the exact candidate across entry points. The optional human-selected automation handoff still belongs to Tesbo. The earlier blind trial found no gain in changing Zyra’s default authoring prompt. [Previous experiment](../examples/zyra-proactive-authoring.md) · [Merged Tesbo PR #284](https://github.com/1alextest/Tesbooboo/pull/284)

The supplied link is Dragan Spiridonov’s portfolio. Its primary QA platform is **Agentic QE**. **QA Investigation Harness** is a separate project from QAtools-tech. The latter exports eligible plan-to-test mappings. Agentic QE can help test whether the automation subsequently written for one of those mappings would actually catch a defect. The Agentic QE default branch inspected was commit `3b569fdf0169f78f5e0eb6cbb1527e410d876c27`, dated 25 November 2026. Its package declared version 3.15.23 and its license was MIT. The commit pins the code in this review. [Portfolio](https://github.com/proffesor-for-testing) · [Agentic QE commit](https://github.com/proffesor-for-testing/agentic-qe/commit/3b569fdf0169f78f5e0eb6cbb1527e410d876c27) · [Manifest](https://github.com/proffesor-for-testing/agentic-qe/blob/3b569fdf0169f78f5e0eb6cbb1527e410d876c27/package.json) · [License](https://github.com/proffesor-for-testing/agentic-qe/blob/3b569fdf0169f78f5e0eb6cbb1527e410d876c27/LICENSE) · [Investigation Harness](https://github.com/QAtools-tech/qa-investigation-harness)

## Follow-up: the real Tesbo assertion pilot

**Current decision, 26 November 2026.** Extend Tesbo's existing Stryker/Jest mutation job. Keep Agentic QE's raw evaluator as an optional, source-pinned research probe. The hostile controls below reproduce five ways it can award a successful assertion-quality score without the intended assertion detecting a behavioral fault. This changes the evaluator adoption recommendation; it preserves the earlier four-control experiment and its original scope.

### Existing owners and the application path

This pilot follows the assertion-adequacy option under FR-124, T-459 and QA-473/474/481. It contributes bounded source evidence; those broader acceptance obligations are not closed by this run. Product source and the existing tests were read at development `63648aa2166cb456bae3ac6695d8dc0a4a475cc3`.

| Capability | Existing owner | Reuse decision and proof boundary |
| --- | --- | --- |
| Generate faults and execute tests | Stryker 10.1.1, Jest 29.7.0, `stryker.ci.config.json`, `mutation-quality.yml` | Extend with a small configuration. The original URL-security mutation selection remains in the same job. No dependency was added. |
| Attribute an external proposal | `nativeProposalProducerIdentity` and the existing testcase/requirement staging transactions | Exercise the actual shared helper. A recorded machine actor, token issuer and human reviewer remain different identities. This helper receives a trusted principal; it does not authenticate a client by itself. |
| Export one approved case | `LegacyService.requirementAutomationHandoff` and its native receipt reader | Exercise the actual domain method and the shared human-review guard. The unit fixture doubles database reads, so this result does not prove SQL, locking, HTTP or MCP behavior. |
| Assert the selected obligations | Existing `testcase-proposal-review.spec.ts` and `requirement-automation-handoff.spec.ts` | Reuse all 68 cases in these two files. No duplicate test suite or copied business implementation. |
| Retain and review evidence | Existing Stryker JSON/HTML reports and GitHub mutation-job artifacts | Keep the selected source, mutant, failing canonical test and diagnostic together. A raw score cannot authorize native publication or activate a Skill. |
| Generate a Playwright change | Existing approved handoff, with the next consumer in [PR #310](https://github.com/1alextest/Tesbooboo/pull/310) | Preserve its separate implementation and evidence ownership. This source-level pilot does not replace that consumer. |
| Compare Skills and clients | Existing T-422 Skills resolver, native proposal review, and [the governed comparison amendment](https://github.com/1alextest/Tesbooboo/pull/295) | Supply known fault controls for that comparison. This pilot contains no model generations or authenticated two-client trial. |

The relevant product path is an authenticated contributor staging a proposal, the existing Task retaining its exact revision and producer provenance, an eligible human applying and approving the selected case, and a human requesting a handoff tied to the original receipt. The selected tests challenge three seams in that path. The complete native/API journey remains in `e2e/api/requirements.spec.ts`, in **“a coding-agent MCP bundle stages requirement-linked native regression cases for human approval and evidence.”** The distinct-credential and stale-save journeys remain in `e2e/api/zyra.spec.ts`. None of those Playwright journeys was executed by this local mutation experiment.

### What was actually exercised

| Actor and obligation | Canonical existing scenario | Controlled faulty behavior | Required observation |
| --- | --- | --- | --- |
| A machine proposal keeps its recorded identity | `preserves a null API-token actor without inventing a human approver` | Treat every producer as a human and substitute the issuing user's ID for the absent machine actor | The exact provenance assertion detects `null` becoming the issuer ID. |
| A machine cannot export a human-approved handoff | `requires a human session before reading the database` | Disable the shared human-review rejection predicate | The expected 403 refusal fails when the handoff resolves. The unchanged correct test also requires no database transaction. |
| A reviewer cannot reuse the original receipt after a case edit and reapproval | `refuses an edited and reapproved case even when its current requirement and link are fully approved` | Remove the receipt/current semantic-revision comparison | The expected 409 refusal fails because the changed case is exported. |
| A permitted current selection remains usable | `exports only the current case selected by the receipt with attributable producer fields` | Invert that semantic-revision comparison | The valid export is incorrectly refused, exposing the overly restrictive guard. |

The named three-expression scope generates **11 mutants**. It does not mean eleven independent product scenarios or eleven AI-generated test cases. The two existing Jest files execute **68 cases**. Parameterized rows can share a Stryker test ID, so test-ID or `killedBy` counts are not execution denominators.

The source selector uses the already-installed TypeScript parser to locate one actual binary expression for each reviewed target. Missing expressions, comment/string decoys and duplicate executable matches stop selection. A legitimate line movement recalculates the range. This addresses an independently reproduced defect in the initial text-based configuration: a comment retaining an old expression could satisfy selection after the executable expression changed. The reproduced selector error did not invalidate the earlier run, whose actual expression locations were verified. The configuration regression checks exercise the real selector with the actual parser.

**Execution record.** The original baseline passed 68/68 with no skips. The bounded mutation run reported 11/11 killed with no final surviving, uncovered, timed-out or error mutants. Repeating the original tests after mutation testing passed 68/68. Initial and all-failure-identity runs each recorded one worker memory failure followed by Stryker's automatic recovery; retain those original logs. Recovery is an infrastructure event, not an assertion detection or evidence of a product memory defect. The final AST-based configuration reproduced the same 68-case dry run and 11 detected mutants in 36 seconds, with one recovered worker memory incident. The two earlier diagnostic configurations each had their own recovered incident; these are three executions of the same 11-mutant scope, not 33 distinct faults. The final raw JSON SHA-256 is `84d2e715d6a64aa5664550c4d94cf5a27dcc0b0c7d2acd29678789212098b4c5`. The selector regressions passed 4/4; before the AST correction, three of those four checks failed.

`disableBail: true` retains every failing test identity. In this Stryker version, `statusReason` still contains only the first failure message. The all-failure report includes the exact three negative scenarios above. Ten primary diagnostics are Jest matcher failures. The inverted receipt comparison's first diagnostic is a product `ConflictException` during the valid-export call, before its subsequent matcher. Preserve this distinction instead of describing every raw kill as the intended assertion failure.

**Exact diagnostic replay.** Because the first-message limit hid the two selected failure messages, a temporary source copy replayed only the unchanged null-actor and human-handoff cases against their exact reported mutants. Both original cases passed before and after. The producer mutation caused the exact `.toEqual` provenance check to fail (`actorId: null` became the issuer UUID). The human-guard mutation caused the exact expected-403 rejection check to fail because the handoff resolved. Each mutant run selected and executed one case; the other 67 inventory cases were filtered out. The two original runs selected and passed two cases, with the other 66 filtered out. No setup/runtime-error suite was reported. The stale-receipt scenario's expected-409 rejection failure is already preserved directly in the Stryker report. The diagnostic copy was restored and removed, and the actual repository's three product files and two canonical test files remained unchanged.

### Repeat the pilot

Run from the checked-out repository's `Tesbo-Backend-Nest` directory after its lockfile dependencies are installed. These commands use local, installed executables and do not download a fallback runner.

```sh
npm ci --ignore-scripts
mkdir -p reports/mutation
node --test stryker.qa-handoff.config.test.cjs
./node_modules/.bin/jest --config jest.qa-handoff-mutation.config.cjs --runInBand --json --outputFile=reports/mutation/qa-handoff-baseline.json
./node_modules/.bin/stryker run stryker.qa-handoff.config.cjs
./node_modules/.bin/jest --config jest.qa-handoff-mutation.config.cjs --runInBand --json --outputFile=reports/mutation/qa-handoff-restored.json
```

The existing mutation workflow performs these checks and retains the reports under its existing `mutation-report` artifact. It also retains the original security-utility mutation step. Baseline execution requires a successful dependency installation. After a successful baseline, the original-code check still runs if mutation testing fails. The pilot inherits the existing timeout, concurrency and coarse mutation threshold. That threshold remains a runner check; it is not the business assertion-quality verdict, a model benchmark or a Skill promotion rule.

Review the actual three selected source expressions, baseline and restored case counts, all mutant states, named scenario identities and failure reasons. Do not credit missing reports, skipped/zero test selections, syntax errors, setup failures or timeouts as confirmed assertion detections. Stryker's documented headline score counts timeouts as detected, so retain its raw categories even if the percentage looks strong. A source/configuration/selection change requires fresh evidence for the affected conclusion.

### What this enables for the team's Skills

The next comparison can give each supported client the same approved task, effective Skill/profile/assignment and independent fault controls, then compare its governed output and actual defect detection. Use the existing [mandatory delivery and cross-member conformance contract](../../specs/agent-synchronized-engineering/skills-governance.md#mandatory-skill-delivery-and-cross-member-authoring-conformance). Keep authenticated member, credential/grant, client, effective role, delivery receipt and produced draft revision attributable through the existing owners. A shared credential cannot establish which person wrote a change.

The intended consistency is the same required fields, rules, coverage obligations and meaningful assertions under the same approved context. Identical wording requires a deterministic renderer or template. Merely instructing every model to read a Skill does not establish either behavioral conformance or identical prose. Preserve the ordinary Zyra baseline and the earlier 18/20 versus 18/20 comparison; this pilot does not demonstrate a new authoring benefit.

**Native-record assessment.** Requirements and Test Cases retain their existing definitions and proof owners. Manuals and Policies need no product-publication change for this test-infrastructure increment. Active Skills and assignments are unchanged. The PR is the reviewable work/evidence handoff, with candidate methodological findings retained here for reconciliation into the existing living work record. **Tesbo sync not performed:** this session exposes no callable, project-authorized Tesbo MCP writer. No native IDs, case approvals, official Runs or application acceptance results are created by the local tests. Real database/API execution, supported-client conformance and human publication retain their existing gates.

## An executable test of the missed retry

All four authors in Tesbo’s earlier trial missed a check on the **same booking across both calls**. I ran the upstream mutation evaluator against a small, hand-written model of this risk. Calling standby returns 202. On an empty one-booking outbox it adds one notice addressed to Ada. The injected defect changes the boundary from `length < 1` to `length <= 1`. The second call on booking B then appends a duplicate with the same ID and recipient. The reference model deliberately covers just that one booking.

| Assertion given to the upstream evaluator | Against the correct behavior | Did it detect the duplicate? |
| --- | --- | --- |
| Check 202 on both calls to B | Passed | No, 0 of 1 mutations detected |
| Call B once and check the exact first receipt | Passed | No, 0 of 1 |
| Call B, verify its sole receipt, call the same B again, check the sole receipt still has the original ID, booking and recipient | Passed | Yes, 1 of 1 |
| Expect 400 on the first call | Failed | Evaluator stopped before mutation testing |

This executed seven real Node test subprocesses with upstream code. The four tests were hand-written controls. No model generated them. The outbox was an in-memory fixture, with no live notification delivery or Tesbo run. A production result still needs an independent native read and an attributable test failure. The upstream runner treats any nonzero child result on a mutant as a detection. Distinguish an assertion failure from infrastructure errors and timeouts before showing such results to a reviewer. [Evaluator](https://github.com/proffesor-for-testing/agentic-qe/blob/3b569fdf0169f78f5e0eb6cbb1527e410d876c27/src/validation/oracle-eval.ts) · [Mutation operator](https://github.com/proffesor-for-testing/agentic-qe/blob/3b569fdf0169f78f5e0eb6cbb1527e410d876c27/src/arena/mutator.ts) · [Child test runner](https://github.com/proffesor-for-testing/agentic-qe/blob/3b569fdf0169f78f5e0eb6cbb1527e410d876c27/src/arena/runner.ts)

## What transfers to Tasks, Skills and MCP

| Upstream evidence | Tesbo application and decision |
| --- | --- |
| One upstream integration test exercises CLI, CI and MCP against the same candidate. It compares receipt IDs and reasons across surfaces, including stale, legacy-unbound and mixed evidence from two commits. Local uncommitted changes with the same Git HEAD also invalidate the previous evidence. This test was source-reviewed here. [Candidate resolver](https://github.com/proffesor-for-testing/agentic-qe/blob/3b569fdf0169f78f5e0eb6cbb1527e410d876c27/src/domains/quality-assessment/evidence-candidate.ts) · [Cross-surface test](https://github.com/proffesor-for-testing/agentic-qe/blob/3b569fdf0169f78f5e0eb6cbb1527e410d876c27/tests/integration/quality-gate-candidate-1474.test.ts) | Reuse the native draft/review owner. Bind each selected case to its project, stable case identity, reviewed content or revision, and relevant mapping. If a teammate edits one of two reviewed cases, each entry point must identify the changed selection and give a consistent reason. A digest identifies content. Only the native review record can say which human approved it under what authority. |
| A test-generation Skill pairs instructions, a schema, a validator configuration and behavior fixtures. Several fixtures match words. A separate live fixture requires generated tests to pass a good implementation and detect operator mutations. Its simulated runner skips that fixture. [Validation layers](https://github.com/proffesor-for-testing/agentic-qe/blob/3b569fdf0169f78f5e0eb6cbb1527e410d876c27/docs/guides/skill-validation.md) · [Actual Skill fixtures](https://github.com/proffesor-for-testing/agentic-qe/blob/3b569fdf0169f78f5e0eb6cbb1527e410d876c27/.claude/skills/qe-test-generation/evals/qe-test-generation.yaml) | Extend the existing Skill comparison fixture. For two team members and two supported clients, require the same governed case fields from the same pinned Skill and run the same independent behavioral controls. Store the authenticated member or machine grant, client, effective role, Skill digest and resulting draft revision through the existing owners. A valid JSON shape or shared credential cannot prove who authored the change. [Mandatory Skill delivery and cross-member conformance](../../specs/agent-synchronized-engineering/skills-governance.md#mandatory-skill-delivery-and-cross-member-authoring-conformance) |
| An upstream two-scenario benchmark records both a model judge and independent hidden-test outcomes. The judge split one scenario each, one verdict was unparseable, and hidden-test fix rates were 0.50 bare and 0.00 assisted. The authors report insufficient evidence of a benefit. [Upstream run record](https://github.com/proffesor-for-testing/agentic-qe/blob/3b569fdf0169f78f5e0eb6cbb1527e410d876c27/benchmarks/interaction/results/README.md) | Keep the ordinary Zyra path as the comparison. Record ungradable runs separately and use held-out product defects to measure what survives. This fixture proves discrimination for one defect. Adopting the fleet, its own memory/service, or a mandatory score requires a separate trial. |

Three other projects surfaced in the same portfolio. **Sentinel** has a typed assertion registry shared conceptually across its Python and Rust generators. That can inform a future case-to-API assertion mapping. One prominent regression file tests a local mock evaluator, so require a contract test against the actual consuming runner before drawing conclusions. **Nagual-QE** is a separate Rust knowledge system. Its scoring code distinguishes similarity, recency, reliability and reuse. If a reviewed repair is suggested on a later task, its verified outcomes and scope would be more useful than a mention count. **LionAGI QE Fleet** describes itself as a Python reimplementation of Agentic QE. None of these services was installed or benchmarked here. [Sentinel registry](https://github.com/proffesor-for-testing/sentinel-api-testing/blob/704f47fbc4d2d75ed9261f9a602d76aea930d01b/sentinel_backend/common/assertion_registry.py) · [Sentinel regression fixture](https://github.com/proffesor-for-testing/sentinel-api-testing/blob/704f47fbc4d2d75ed9261f9a602d76aea930d01b/sentinel_backend/tests/unit/test_assertion_semantics_regression.py) · [Nagual ranking source](https://github.com/proffesor-for-testing/nagual-qe/blob/5733bbba90f9631a7ec706daf93496090eaeddb5/src/reasoning_bank/scoring.rs) · [LionAGI README](https://github.com/proffesor-for-testing/lionagi-qe-fleet/blob/ce1d58750a240a16c3c53abcb8a7c73864e98c99/README.md)

## Replay the four controls

Run in an empty disposable directory with Node 24, Git and curl. The commands download only the three pinned upstream modules. The probe uses Node’s TypeScript type stripping and writes its local JS copies next to the sources. Each upstream test workspace is temporary. The four final assertions also check the observed pass decisions and denominators.

```sh
set -eu
aqe_rev=3b569fdf0169f78f5e0eb6cbb1527e410d876c27
mkdir -p src/arena src/validation
for module in arena/mutator arena/runner validation/oracle-eval; do
  curl -fsSL "https://raw.githubusercontent.com/proffesor-for-testing/agentic-qe/$aqe_rev/src/$module.ts" -o "src/$module.ts"
done
test "$(git hash-object src/arena/mutator.ts)" = 3bf3aa47a3b8868b005f9df703b8d7f619bf654c
test "$(git hash-object src/arena/runner.ts)" = 6e964c0d10e613d1b1c9ca2061c644e4fdd96396
test "$(git hash-object src/validation/oracle-eval.ts)" = 1c020fab3743698d44f8a89e4de9554a67c639e6
```

Save the following as `probe.mjs` in that directory and run `node probe.mjs`.

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

for (const name of ['arena/mutator', 'arena/runner', 'validation/oracle-eval']) {
  const source = fs.readFileSync('src/' + name + '.ts', 'utf8');
  fs.writeFileSync('src/' + name + '.js', stripTypeScriptTypes(source));
}
const { evaluateOracle } = await import('./src/validation/oracle-eval.js');
const referenceImpl = `export function callStandby(outbox, bookingRef, recipient) {
  if (outbox.length < 1) outbox.push({id:'notice-1', bookingRef, recipient});
  return 202;
}`;
const call = "callStandby(outbox,'B','Ada')";
const receipt = "assert.deepEqual(outbox,[{id:'notice-1',bookingRef:'B',recipient:'Ada'}]);";
const cases = [
  ['Status twice', `assert.equal(${call},202); assert.equal(${call},202);`, [true, 0, 1]],
  ['First receipt', `${call}; ${receipt}`, [true, 0, 1]],
  ['Repeated receipt', `${call}; ${receipt} ${call}; ${receipt}`, [true, 1, 1]],
  ['Invalid baseline', `assert.equal(${call},400);`, [false, 0, 0]],
];
for (const [name, body, expected] of cases) {
  const generatedTest = `import {test} from 'node:test';
    import assert from 'node:assert/strict';
    import {callStandby} from '../src/callStandby.mjs';
    test('call and repeat on B', () => { const outbox = []; ${body} });`;
  const result = evaluateOracle({
    moduleName: 'callStandby', referenceImpl, generatedTest, threshold: 1, timeoutMs: 5000,
  });
  assert.deepEqual([result.baselinePassed, result.mutantsKilled, result.mutantsTotal], expected);
  assert.equal(result.passed, name === 'Repeated receipt');
  console.log(name, result.reason);
}
```

## Source-pinned evaluator failure controls — 26 November 2026

**Decision: retain Agentic QE as a research reference; do not adopt its raw oracle score as Tesbo's assertion-quality gate. Reuse the existing Stryker/Jest lane for the real Tesbo pilot.**

Executed the actual upstream `evaluateOracle`, operator mutator, and Node runner at [Agentic QE commit `3b569fdf0169f78f5e0eb6cbb1527e410d876c27`](https://github.com/proffesor-for-testing/agentic-qe/tree/3b569fdf0169f78f5e0eb6cbb1527e410d876c27), package version **3.15.23**, using **Node v24.22.3**. These eight hand-written fixtures test the evaluator's failure classification. They are not model-generated tests, product regressions, live Tesbo executions, or evidence that an upstream skill improves generation.

| Control | Actual upstream outcome | Interpretation |
|---|---|---|
| Intended boundary assertion | Baseline passes; 1/1 killed; score 100%; `passed: true` | Positive control: intended assertion detects the mutation. |
| Fixture-unavailable exception in test | Baseline passes; 1/1 killed; score 100%; `passed: true` | Failure is counted as detection without an assertion on target behaviour. |
| Test calls `process.exit(4)` | Baseline passes; 1/1 killed; score 100%; `passed: true` | Process failure is counted as detection. |
| Syntactically invalid generated mutant | Baseline passes; 1/1 killed; score 100%; `passed: true` | Invalid JavaScript is counted as detection. |
| Only assertion is in `test.skip` | `baselinePassed: true`; 0/1 killed; score 0%; `passed: false` | Overall score fails, but the baseline is accepted although the test never executes. |
| Reference module throws during import | `baselinePassed: false`; 0 mutants evaluated; score 0%; `passed: false` | Only the generic baseline-failed reason is returned; cause/phase is lost. |
| Outer process timeout at 250 ms | Baseline passes; 1/1 killed; score 100%; `passed: true` | Runner timeout is counted as detection. |
| Node test timeout at 100 ms | Baseline passes; 1/1 killed; score 100%; `passed: true` | Framework timeout is counted as detection. |

The generator control changes valid `export function* select() { yield 1; }` into invalid `export function+ select() { yield 1; }`. The five non-assertion failure controls receive the same successful score as the intended assertion control. This is a false **assertion-quality conclusion**, not a claim that every runtime exception or timeout can never reveal a product defect.

### Source evidence and reuse boundary

- [`runner.ts`](https://github.com/proffesor-for-testing/agentic-qe/blob/3b569fdf0169f78f5e0eb6cbb1527e410d876c27/src/arena/runner.ts) returns only `ok: proc.status === 0`, duration, and optional coverage. It discards exit details, signal/error, test counts, stdout, stderr, and the failure diagnostic.
- [`oracle-eval.ts`](https://github.com/proffesor-for-testing/agentic-qe/blob/3b569fdf0169f78f5e0eb6cbb1527e410d876c27/src/validation/oracle-eval.ts) increments `killed` whenever `run.ok` is false; its assertion check scans source text rather than executed assertion evidence.
- [`mutator.ts`](https://github.com/proffesor-for-testing/agentic-qe/blob/3b569fdf0169f78f5e0eb6cbb1527e410d876c27/src/arena/mutator.ts) scans text operators and can produce invalid syntax. These internal modules are not declared public package exports in the pinned package.

Stryker 10.1.1 already exists in Tesbo. Its structured statuses and failing-test identities are useful, but its standard mutation score counts `Timeout` as detected. Its Jest adapter also treats an individual failed test as `Killed`, which can include a setup failure attributed to that test. Therefore preserve the raw report and inspect `killedBy`, `statusReason`, exact source mutation, baseline, and restored-run evidence before calling a target regression detected. Keep invalid mutants, setup/runner errors, timeouts, and unexecuted tests visible. Do not convert this small review into a new evaluator platform.

Primary Stryker sources: [status/metric definitions](https://stryker-mutator.io/docs/mutation-testing-elements/mutant-states-and-metrics/), [Jest adapter](https://github.com/stryker-mutator/stryker-js/blob/959127763e5bbe2eb65f5341a8161780d6d8a476/packages/jest-runner/src/jest-test-runner.ts), [result mapping](https://github.com/stryker-mutator/stryker-js/blob/959127763e5bbe2eb65f5341a8161780d6d8a476/packages/api/src/test-runner/run-result-helpers.ts).

### Reproduce the eight controls

Use an external checkout of the pin above. Save the following as `aqe-hostile-controls.mjs` and run `node aqe-hostile-controls.mjs /absolute/path/to/agentic-qe`. No package installation is needed. It hash-verifies all three upstream modules, strips TypeScript into a temporary directory, and calls the real evaluator without editing the checkout. The recorded experiment used Node v24.22.3. Timeouts deliberately remain bounded; a host unable to complete the baseline within a timeout will report baseline failure rather than reproducing that control's original result.

```js
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
import { pathToFileURL } from 'node:url';

const sourceRoot = process.argv[2];
if (!sourceRoot) throw new Error('Pass the pinned Agentic QE checkout path');
const hashes = {
  'arena/mutator': 'a10a2da4feb854cedbd5a0d5a9a12c51e35d22346479ebae11253c6de217c121',
  'arena/runner': '655404259a99de1660a4764f83ce7ac0ff195505af63f4e6f04fa896d7832f73',
  'validation/oracle-eval': '5489019d539ec0c712e4cd296bd6ccb1ae5cfb5949907315be462fa714d80417'
};
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'aqe-classification-'));
try {
  fs.writeFileSync(path.join(scratch, 'package.json'), '{"type":"module"}');
  for (const [module, expectedHash] of Object.entries(hashes)) {
    const source = fs.readFileSync(path.join(sourceRoot, 'src', module + '.ts'));
    if (createHash('sha256').update(source).digest('hex') !== expectedHash) {
      throw new Error('Unexpected upstream source: ' + module);
    }
    const target = path.join(scratch, 'src', module + '.js');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, stripTypeScriptTypes(source.toString('utf8')));
  }
  const { evaluateOracle } = await import(pathToFileURL(
    path.join(scratch, 'src/validation/oracle-eval.js')));
  const source = 'export function select(n) { return n < 1; }';
  const fixtures = [
    { name: 'assertion failure', source,
      body: "test('observation',()=>assert.equal(select(1),false));" },
    { name: 'setup exception', source,
      body: "test('observation',()=>{if(select(1)) throw new Error('TEST_FIXTURE_OFFLINE'); assert.equal(202,202);});" },
    { name: 'test process exits', source,
      body: "test('observation',()=>{if(select(1)) process.exit(4); assert.equal(202,202);});" },
    { name: 'syntax-invalid mutant',
      source: 'export function* select() { yield 1; }',
      body: "test('observation',()=>assert.deepEqual([...select()],[1]));" },
    { name: 'skipped assertions', source,
      body: "test.skip('observation',()=>assert.equal(select(1),false));" },
    { name: 'reference unavailable',
      source: "throw new Error('FIXTURE_DEPENDENCY_FAILED'); " + source,
      body: "test('observation',()=>assert.equal(select(1),false));" },
    { name: 'outer process timeout', source, timeoutMs: 250,
      body: "test('observation',async()=>{if(select(1)) await new Promise(r=>setTimeout(r,800)); assert.equal(202,202);});" },
    { name: 'test timeout', source,
      body: "test('observation',{timeout:100},async()=>{if(select(1)) await new Promise(r=>setTimeout(r,300)); assert.equal(202,202);});" }
  ];
  for (const fixture of fixtures) {
    const generatedTest = "import {test} from 'node:test'; " +
      "import assert from 'node:assert/strict'; " +
      "import {select} from '../src/select.mjs'; " + fixture.body;
    const result = evaluateOracle({ moduleName: 'select',
      referenceImpl: fixture.source, generatedTest, threshold: 1,
      timeoutMs: fixture.timeoutMs ?? 1500 });
    console.log(JSON.stringify({ name: fixture.name, node: process.version, result }));
  }
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
```

The actual retained result fields are described in the table; per-process elapsed time is deliberately not an acceptance criterion. Preserve both this source pin and the controls if revisiting upstream adoption. A successful broad mutation score alone does not establish a consistent, attributable, role-aware test-generation harness.
