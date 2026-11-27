# What Agentic QE adds to Tesbo’s automation handoff

**Decision, 26 November 2026.** Use Agentic QE’s executable method to evaluate an assertion on small, known reference fixtures. Borrow its practice of tying evidence to the exact candidate across entry points. The optional human-selected automation handoff still belongs to Tesbo. The earlier blind trial found no gain in changing Zyra’s default authoring prompt. [Previous experiment](../examples/zyra-proactive-authoring.md) · [Merged Tesbo PR #284](https://github.com/1alextest/Tesbooboo/pull/284)

The supplied link is Dragan Spiridonov’s portfolio. Its primary QA platform is **Agentic QE**. **QA Investigation Harness** is a separate project from QAtools-tech. The latter exports eligible plan-to-test mappings. Agentic QE can help test whether the automation subsequently written for one of those mappings would actually catch a defect. The Agentic QE default branch inspected was commit `3b569fdf0169f78f5e0eb6cbb1527e410d876c27`, dated 25 November 2026. Its package declared version 3.15.23 and its license was MIT. The commit pins the code in this review. [Portfolio](https://github.com/proffesor-for-testing) · [Agentic QE commit](https://github.com/proffesor-for-testing/agentic-qe/commit/3b569fdf0169f78f5e0eb6cbb1527e410d876c27) · [Manifest](https://github.com/proffesor-for-testing/agentic-qe/blob/3b569fdf0169f78f5e0eb6cbb1527e410d876c27/package.json) · [License](https://github.com/proffesor-for-testing/agentic-qe/blob/3b569fdf0169f78f5e0eb6cbb1527e410d876c27/LICENSE) · [Investigation Harness](https://github.com/QAtools-tech/qa-investigation-harness)

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
