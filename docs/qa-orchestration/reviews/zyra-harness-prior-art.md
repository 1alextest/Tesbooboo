# Which parts of a QA harness should Tesbo reuse?

**Decision record, 25 November 2026.** The [four proposed capabilities](../ZYRA_QA_HARNESS_OPTIONS.md) have different needs. Start with the existing draft reader, independent fixtures, and reports from a runner the team already operates. Consider an external trial driver when running a repeatable client matrix becomes work in its own right. The product owner can select each pilot separately.

## What the builders actually use

| Builder and evidence | Mechanism | What it changes for Tesbo |
| --- | --- | --- |
| [Anthropic Managed Agents](https://www.anthropic.com/research/managed-agents) and [long-running harness experiments](https://www.anthropic.com/research/harness-design-long-running-apps) | Anthropic separates the durable session, the loop that calls the model and tools, and the execution environment. Its generator/evaluator experiments give the evaluator explicit criteria and test the effect of adding agents. | Keep the task, assessed draft revision, evidence and decisions recoverable if the worker disappears. Reuse Zyra’s existing loop for a bounded check. Compare a specialist with one Zyra pass on independently graded cases before paying for another model call. |
| [OpenAI Codex platform](https://developers.openai.com/blog/codex-as-a-platform), [Performance Factory](https://openai.com/index/how-openai-performance-factory-keeps-chatgpt-fast/) and [Agents SDK approval handling](https://openai.github.io/openai-agents-js/guides/human-in-the-loop/) | Codex exposes one-off execution, an SDK and a persistent app-server. OpenAI’s performance investigation system assigns ready work and wakes an agent on a relevant event, then checks recovery. The separate Agents SDK documents authenticated, single-use consumption of a pending approval by the application. | A supported external worker is a candidate when a task actually needs to run. For a later Run Analyst, wake the existing task when the matching attempt evidence arrives, deduplicate delivery and recheck the grant and revision. Two resume deliveries must produce at most one authorized action. SDK permission to call a tool cannot approve a native case. |
| [Microsoft Playwright Test Agents](https://playwright.dev/docs/test-agents), [JSON reporter](https://playwright.dev/docs/test-reporters#json-reporter) and [TestResult](https://playwright.dev/docs/api/class-testresult) | A planner can create a test plan and a generator can produce executable tests. The optional healer can change a test or skip it when it judges the feature broken. The runner exposes attempt-specific steps and attachments. | Read stock reports first. When testing code generation, give the external generator one reviewed plan with a pinned expectation. A proposed skip, weaker assertion or changed expectation returns to the shared draft as a diff. Retain the old test, original failure and case revision for review. |
| [Promptfoo recorded-output grading](https://www.promptfoo.dev/docs/configuration/expected-outputs/), [CLI](https://www.promptfoo.dev/docs/usage/command-line/), [custom providers](https://www.promptfoo.dev/docs/providers/custom-api/) and [JS grading results](https://www.promptfoo.dev/docs/configuration/expected-outputs/javascript/) | The CLI can score saved outputs or run repeated trials. A custom provider can call a real system. Per-assertion results can be exported to JSON. | First candidate for an isolated Skill/client comparison driver. Wrap the real client only if it can perform the scoped MCP operation. Preserve which assertion ran, its expected polarity, refusal, tool failure or unknown. An intentional assertion failure on a faulty control is successful fault detection. A provider-only simulation cannot establish client behavior. |
| [Langfuse experiments](https://langfuse.com/docs/evaluation/experiments/experiments-via-sdk) and [experiment model](https://langfuse.com/docs/evaluation/experiments/data-model) | The experiment runner accepts a dataset, task and evaluators. Even local-data experiments send experiment data to the configured Langfuse instance. Tesbo currently declares the OTel and tracing packages at 5.10.1. The current experiment documentation describes newer client APIs. | Reuse permitted telemetry and existing product-outcome comparisons. If comparison dashboards or a trial driver become necessary, compare an approved Langfuse instance with Promptfoo on the same small dataset. Test installed-version compatibility, retention and export first. Trial IDs and source evidence remain independently retrievable in Tesbo. [Backend dependencies](../../../Tesbo-Backend-Nest/package.json) · [Tesbo egress policy](../../../Tesbo-Backend-Nest/src/observability/langfuse.ts) |
| [Sierra τ²-bench implementation](https://github.com/sierra-research/tau2-bench/blob/main/docs/evaluation.md) and [UK AI Security Institute Inspect agent bridge](https://inspect.aisi.org.uk/agent-bridge.html) | Sierra replays reference actions on a fresh environment to construct a target state. It can grade state, actions and communication separately. Inspect can place a real agent CLI behind an evaluation interface. | Borrow the independent-state check for the customer-agent option. Accept lawful alternative sequences. Inspect attempted publication separately because a denied write can leave the same state as a voluntary stop. Consider a runner bridge only when a customer brings a supported real CLI. Customer approval rules and state readers must come from the customer’s actual application. |

The [Agent Skills client guide](https://agentskills.io/client-implementation/adding-skills-support) distinguishes catalog discovery, loading instructions, and accessing supporting files. Tesbo already specifies the [portable package and native governance](../../specs/agent-synchronized-engineering/skills-governance.md#133-source-package-interoperability-and-safety-boundary). Add held-out controls for the same Skill name at the wrong digest, catalog-only delivery, and a missing referenced checklist. Compare governed output and evidence of delivery separately. Record an unobservable private authoring step as unknown.

## What was exercised

A scratch-only probe used Playwright Test **1.61.1**, its JSON reporter, one worker and one retry. The test attached text identifying its retry index, entered a named step, and intentionally expected the retry index to equal one. The inspected outcome was synthetic. Neither the test nor its step label represents a database read, mobile session or Tesbo case. The two configured projects exercised different report identities with the same Node-only test.

| Control | Observed in the stock JSON report | Consequence |
| --- | --- | --- |
| One test with Tesbo tag and annotation | Process exit 0, one flaky test, failed retry index 0 with assertion error and its own text attachment, then passed retry index 1 with a different attachment. | Ingest each attempt. The overall exit status loses a fact needed for investigation. |
| Same tagged test in two named projects | Process exit 0, two flaky project tests, four attempts. The test ID at the spec level, case marker, retry indexes and attachment names were shared across projects. The JSON carried distinct project IDs in the test entries. | Scope attempt identity by source run/invocation, shard or repetition where relevant, reporter project, test and retry position. Bind to the selected native project, case revision and actual build before giving native coverage credit. |
| Case marker representation | The declared tag was `@tesbo.testId("SYNTH-1")`. Stock JSON serialized it as `tesbo.testId("SYNTH-1")`; the structured `tesbo` annotation retained the ID. The native reporter callback parser expects the leading `@`. | Normalize the version-tested JSON tag form at the import boundary. Compare declared tag and annotation IDs before calling the existing resolver, which gives valid tags precedence. Exercise tag only, annotation only, agreement and conflicting identity. Preserve the existing live callback behavior. Quarantine ambiguous imported identities for review. [Native marker reader](../../../sdk/playwright-reporter/src/tag.ts) |

A fixture for reproduction with the stated test runner version follows. Save the first block as `control.spec.cjs` and the second as `playwright.config.cjs` in an isolated test directory. Run the installed Playwright test CLI with `playwright test --config playwright.config.cjs`. For the single-project control, omit the `projects` option. The report’s timestamps, timings and local paths vary between runs.

```javascript
const { test, expect } = require('@playwright/test');

test('retry evidence control', {
  tag: '@tesbo.testId("SYNTH-1")',
  annotation: { type: 'tesbo', description: 'SYNTH-1' },
}, async ({}, testInfo) => {
  await testInfo.attach('observed-attempt-' + testInfo.retry + '.txt', {
    body: Buffer.from('attempt ' + testInfo.retry),
    contentType: 'text/plain',
  });
  await test.step('check persisted value', async () => {
    expect(testInfo.retry, 'target assertion on observed retry index').toBe(1);
  });
});
```

```javascript
module.exports = {
  testDir: '.',
  outputDir: 'test-results',
  workers: 1,
  retries: 1,
  projects: [{ name: 'desktop-web' }, { name: 'mobile-web' }],
  reporter: [['json', { outputFile: 'report.json' }]],
};
```

The probe established the report format on this version. A real CI handoff still needs a trusted run/build reference, exact case revision, project entitlement, report completeness, attachment access and retention. An unbound screenshot or a missing shard yields partial evidence. For merged or repeated reports, import the same artifact twice and verify deduplication without collapsing distinct projects or attempts. No agent generator, healer, customer agent, model or Tesbo service participated in the probe.

## Build decisions for the four options

| Option | Reuse first | Tesbo-specific work and decision to advance |
| --- | --- | --- |
| Assertion adequacy | Existing [test fixture for reading a draft revision](../../../e2e/utils/zyra-proposals.ts), Jest/Playwright assertions and reviewed good/faulty fixtures. The [existing Stryker job](../../../Tesbo-Backend-Nest/stryker.ci.config.json) runs Jest with per-test coverage and JSON output, but its mutation scope is the external-URL utility. | Run the same revision-bound assertion on both controls. For a later executable mutation, demonstrate that the specific assertion detects the target fault. The existing mutation score supplies no shared-draft coverage. Add a dependency only if the simple comparison leaves a measurable gap. |
| Run analysis | Team-owned CI JSON report, existing [native result reporter](../../../sdk/playwright-reporter/src/index.ts) and [evidence transport](../../../sdk/playwright-reporter/src/client.ts). | Correlate source attempts with authorized native records. Retain the original artifact and reconciliation result. A legacy run/case attachment alone remains unassigned to any particular attempt. |
| Skill/client regression | Existing [native comparison fixture](../../../e2e/utils/compare-langfuse-outcomes.mjs) checks an explicit case inventory across three tracing configurations. Borrow its missing/duplicate checks. Trial Promptfoo’s repeat and machine-readable results when the real client matrix is selected. | Pin the Skill and member grant and independently read what was drafted. Compare active and candidate within each actual client. Tracing configurations do not stand in for different clients. Baseline the existing fixture approach before adding a service or framework. |
| Customer-agent evaluation | State/action scoring from Sierra, the customer’s actual agent, a disposable customer-authorized target, and a read-only verifier. | Prove the verifier detects intended, collateral and forbidden effects within its stated scope and supports legitimate alternative actions. Keep the customer’s approval decision with its owner. Consider a CLI bridge only if the target integration requires it. |

**Dependency decision.** A candidate can be declined if a native fixture provides the same decisions at lower operating cost. Before choosing a runner, compare one accepted, one faulty, one denied and one inconclusive case, the completeness of its export, an unavailable tool, and offline or permission-restricted operation. Pin versions and review redistribution terms. Promptfoo's [core license](https://github.com/promptfoo/promptfoo/blob/main/LICENSE), [default usage telemetry](https://www.promptfoo.dev/docs/configuration/telemetry/) and [report sharing](https://www.promptfoo.dev/docs/usage/sharing/) are separate considerations. Use an approved destination or turn off telemetry and sharing for a private trial. For future hosted execution, validate credential handling, retention, cancellation and exit cost before selection. No vendor purchase, runtime migration or dependency addition follows from this comparison.
