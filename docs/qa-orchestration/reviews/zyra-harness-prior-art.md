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


## 26 November 2026 — specification and application source reconciliation

**Scope:** user-authorized update of the existing specifications after reading Uber's [Skills evaluation article](https://www.uber.com/us/en/blog/optimizing-ubers-agent-skills/). Source pin: `development@b28c17386ecc2e88f550b3c4a641143ede339255`. This is a collaborative specification/source review and later informed consistency review, not a cold full-roster assurance run, Graph/White freeze, authenticated production walkthrough, model trial or deployment. No statement that every application source line was audited is made.

**Initial inputs preserved:** repository v1.4.45 eight-file manifest, archive SHA-256 `bb06fb5b4080b81fd521f77ea4cc26a39b823a873d2cf221a182d984a6a088aa`; newer owner-saved v1.4.45 archive version 26, 635,694 bytes, SHA-256 `d4db29b98d4b7daa881770795287a2e920873b3875cce50a3353cf341f785a8f`. Six canonical files are byte-identical across these inputs. Saved 02 adds a 2,400-byte decision-basis/evidence-continuity clarification and saved 05 adds 2,932 bytes of corresponding acceptance; both are preserved before the 1.4.46 additions. Historical statements retain their exact date/scope, with the newest explicit source qualification governing current reuse.

**Concurrent input reconciled before save:** version 27, `Tesbo_Specifications_Skills_Interface_Update.zip`, 643,396 bytes, SHA-256 `479b1e1623c67af961329f54033f5670cf13215c5d78299e6a7759fa5430a44e`. It appends the source-pinned Skills interface redesign/reconciliation (including SIR-01–12 proposed outcome labels) to canonical 02 and a Work Package S/T-422 proof cross-reference to 05. Both complete additions were read during conflict reconciliation and preserved before the evaluation amendment. They retain their own prototype/source pins and unverified live-acceptance boundary. No additional global executed-test count follows.

### Reading coverage

| Current input group | Reading performed |
| --- | --- |
| Eight canonical originals 00 through 07 | Full-content review across six assigned readers: 00/application archaeology; 01–02/requirements and workflow; 03/design; 04 and 07/contracts and UI; 05/proof and backlog; 06/operating method. Readers used bounded overlapping windows to recover truncated tool output; exact repeated historical paragraphs were identified without discarding distinct clauses. |
| ASER integration views | Full README, requirements, design, implementation-plan, skills-governance and AGENT_RULE_TEMPLATE bodies. These remain subordinate to the eight canonical files. |
| Adjacent current specifications | Full mcp-change-workflow, mcp-team-attribution, Work Package A requirements design, Work Package B manuals/policies design, OAuth connection draft, and PR change reconciliation draft. |
| Runtime/integration design and recorded pilots | Full Zyra behavior, Langfuse observability plan, Playwright integration, QA harness options, stale-save and proactive-authoring examples; existing harness prior-art record. |
| Application | Selected actual backend Skills/KB/proposal/task/MCP/provider/observability/automation/evidence writers and related frontend Skills/task/comparison surfaces and Playwright reporter. Source inspection and current recorded pilot review; no live-target or database execution. |

No superseded review archive is re-certified by these reads. Read coverage is distinct from complete functional assurance. Existing UI design guidance and native regression records retain their independent acceptance.

### Source-backed capability map

All backend paths below are relative to `Tesbo-Backend-Nest/src/` at the pinned commit; line numbers are inspection anchors, not an assertion that only those lines affect the workflow.

| Required capability | Existing owner/source | Maturity and reuse decision |
| --- | --- | --- |
| Governed Skill identity, immutable version and active assignment | `skills/skills-governance.ts:85–139`; `legacy/legacy.service.ts:17092–17336,17440–17466` | Implemented source: approved-version selection and protected human governance. Extend the owner with candidate evaluation evidence; metadata resolution alone cannot prove model input delivery or judgment. |
| Attributed authoring/review work | `legacy/legacy.service.ts:16316–16603,22974–23120,23697–23704` | Existing feature-gated task/proposal and exact human Save receipt substrate. Requirement/document proposals and standalone case staging have different method pin coverage. General assigned evaluation tasks still need Work Package C fit; ordinary New task invokes generation. |
| Provider usage and token ledger | `legacy/legacy.service.ts:16283–16302,23029–23092,29162–29165` | Insert-only project/source/provider/model token observations exist, but lack trial/Skill/client correlation and use best-effort writes. Some task displays use estimates or absent-to-zero normalization. Extend correlation and provenance; no per-Skill cost or savings claim. |
| Diagnostic traces and stage history | `observability/ai-trace.ts:93–154,339–379`; `legacy/zyra-turn-trace.ts` | Message-derived trace identity, retrieval/tool/model spans and bounded stage attempts/timing exist. Optional/best-effort diagnostic evidence is not complete immutable evaluation history; absent/truncated trace cannot establish absence of activity. |
| Trace egress and minimization | `observability/langfuse.ts:32–163`; `observability/ai-trace.ts:93–154` | Default-off/configured-destination/cloud safeguards and limited input/output key masking exist. Current detailed payloads can contain message/prompt/output and KB/Jira data; metadata is outside that mask hook. Proposed minimized routine events and project disclosure/retention are separate obligations, not completed protections. |
| Price coverage | `observability/langfuse-model-prices.ts:129–159`; observability plan §3.5 | Optional default-off missing-only price seeding exists. Exact deployed prices, cached/modal/service-tier accounting and fully attributable costs remain unverified. |
| Results and retries | `automation/automation.service.ts:484–636` | Effective native run/case execution row, retry watermark, duplicate no-op and closure guards exist. They are not a complete immutable per-attempt store. Extend existing T-459/native evidence contracts for trial proof. |
| Evidence/report transport | `automation/automation.service.ts:838–945`; `sdk/playwright-reporter/src/index.ts:302–405` and client | Disk-backed uploads and result reporting exist. Run/case execution association lacks a retry-specific artifact binding; an upload alone cannot prove which attempt produced it. |
| External client provenance and capability | `mcp/mcp.service.ts:130–131,178–208,334–370`; `mcp/mcp-producer.ts` | Current API-token grant filtering, revalidation and credential-derived producer attribution exist. A display client name is not member delegation, model identity or observed process order. Do not infer production OAuth evaluation/staging from separate candidate work. |
| Review UX | Frontend `app/(app)/projects/[id]/settings/skills/page.tsx`, `components/skills/SkillAssignmentForm.tsx`, `components/knowledge-base/KnowledgeComparison.tsx` and native task page | Existing library, assignments, exact-version comparison and selected draft Save are reusable. No inspected source establishes a complete operational Skill evaluator, judge or quality dashboard. |

### Dispositions and bounded next increment

- **Extend existing evaluation owners.** Canonical 01/03/04/05/06/07 now operationalize FR-124/T-461 and T-422/D-14 rather than introduce a new learning service or generic quality score. Existing cases/attempts/evidence/review own durable proof.
- **Keep optional telemetry optional.** Collector failure cannot break ordinary authoring. If a required evaluation cannot establish a process fact, that dimension remains unavailable and dependent assurance stays open; no false application effect or automatic approval follows.
- **Separate minimally collected usage from detailed diagnostics.** Global tracer opt-in does not establish per-project onward disclosure or retention acceptance. Restrict hidden grading material across chat, retrieval, worker/cache and trace/export paths.
- **Preserve honest comparison and economics.** Use independent expectations, matched active/candidate configurations, repeated same-method controls, optional-only ablations, full assigned/attempted/graded/ungraded accounting, noncompensating critical failures and measured/estimated/missing cost distinctions. Do not sum shared or nested costs twice.
- **Retain no-improvement evidence.** The primary recorded authoring comparison remains 18/20 per arm; it does not justify a new active method. Recorded-answer replay, source-only reviewer answers and authenticated native/client execution remain different evidence levels.
- **Route friction to its real owner.** Distinguish product authority, grant/configuration, tool/adapter, fixture/grader and reusable-method issues. Use existing Tasks/issues/findings and linked regressions; any generalized successor remains a human-reviewed candidate.
- **Defer unresolved operating values appropriately.** Actual supported client matrix, inventory/rubric, improvement/false-block thresholds, budgets, sensitive-data retention/egress and any canary or model-specific adaptation require their stated owners before a pilot. None prevents completing this proposed documentation update.

**Verification boundary:** package preservation, internal-reference, manifest/archive and whitespace checks are source/document checks. New runtime acceptance remains NOT RUN. No API, provider, execution, approval, assignment, production data, CI rules or deployment was changed. **Tesbo sync not performed:** no callable authorized Tesbo project connector is exposed; retain the proposed native handoff rather than invent records or direct-write through another path.

**Final integration source recheck:** development advanced to `289fdd8be002ff6094944869a60afda0aea2cdae` after the pinned review. A full-tree comparison against b28c173 identifies only `e2e/api/mcp.spec.ts` and `e2e/utils/testcase-edit-state.ts`; all inspected frontend/backend application owners are byte-identical. The documentation integration preserves those newer test/helper bytes. This continuity recheck carries no execution or deployment credit.


## 26 November 2026 — multiagent control coverage

**Method and scope.** Re-read the complete [multiagent engineering article](https://x.com/katelyn_lesse/article/2114542280535318557) and its complete [linked security architecture article](https://www.katelynlesse.com/blog/secure-agents-architecture-and-sandboxing). The table records topic coverage, not independent confirmation of every external claim. These are research inputs; the Tesbo-specific controls and falsifiers are proposed adaptations derived with the existing native design. Source review is informed, by the updating agent, not an independently dispatched team or runtime acceptance run. The introductory encouragement to engineers is contextual, not a product requirement.

| Source concern | Existing owner / revision 1.4.47 disposition | Proof allocation in canonical 05 |
| --- | --- | --- |
| Coordinator and non-executor specialist roles | R-ASE-12; bounded independent question, evidence, permission and result | Delegation and legitimate narrower worker |
| Stateful, single-instance work with arbitrary idle periods | T-201/203; native durable context and claim generation | Idle/crash/event/wake recovery |
| Waiting on tools, inference, peers or humans | FR-009/058; explicit waiting cause and fresh resume | Duplicate/lost/out-of-order events |
| Startup, idle allocation and burst scale tradeoffs | NFR-010/012; measure before runtime/scheduler selection | Mixed active/idle burst and fairness |
| Agent identity and short-lived workload credentials | FR-010/011; evaluate existing issuer/credential mechanism | Principal/audience/expiry/rotation |
| Acting for a human versus independent workload | R-ASE-12/18; separately evidenced authority and consent | Human/workload and valid-control flows |
| Meaningful long-running consent | FR-012–015; scope/lifetime and renewal/effect rechecks | Revoke during wait and before commit |
| Trust between agents | R-ASE-12/18; verified peer request and bounded delegation | Forgery/replay/scope/fan-out |
| Vulnerable kernels, browsers, runtimes and libraries | R-ASE-18; image/dependency provenance and patch evidence | Chosen isolation/advisory controls |
| Injection transmitted between agents and future memory | R-ASE-31; derivative authority never increases | A → summary/RAG/memory → fresh B |
| Separate orchestration, state and secrets from hostile code | T-101/203/408; independent custody/enforcement | Secret-access and broker misuse |
| Destination-bound credential injection and MCP brokerage | T-105/106/408; existing custody or evaluated broker | Destination/redirect/error leakage |
| Isolation level and tenant blast radius | R-ASE-18; qualify actual hostile-code boundary | Escape/mount/cross-tenant controls |
| Disposable environments and hard resource limits | T-408/410; bounded execution and independent cleanup | Limits, teardown failure and quarantine |
| Default-deny outbound access, including DNS | FR-012/058; actual network and action enforcement | IP/protocol/DNS/rebinding/private-target controls |
| Dependency bootstrap before tighter execution scope | T-408; isolated pinned install phase, no elevated secrets | Install-hook and subsequent egress controls |
| Correlated cross-agent OTel | Existing observability + T-459; validate associations | Forged/late/duplicate/missing observations |
| Agents cannot rewrite their own or others' traces | R-ASE-14/38/46; protected collector and accepted evidence | Edit/delete/admin and correction controls |
| Independent tool, command and network observations | NFR-010; real evidence source and completeness | Self-report versus observed effect |
| Monitoring-triggered scoped stop and credential cutoff | T-105/203/408; admitted policy plus trusted control | Queued/idle/in-flight/descendant stop |
| Stop survives the compromised execution | R-ASE-18/43; external control and fresh continuation | Worker/control restart and uncertain remote activity |
| Legitimate persistence can resemble an attack | FR-124/R-ASE-44/47; observed policy event, calibrated intent limits | False stops, misses and valid retries |

### Specification and source reconciliation

Input inventory: all eight saved canonical v1.4.46 files (archive Library version 30, SHA-256 `1b84a0f0840d04b097007d3cdfa460157e9c2c91796b7b1ec78d4b3539e8018c`); all six ASER integration views; Skills governance, team attribution, MCP workflow, OAuth, PR reconciliation, harness/options/research and Langfuse plan. Work Package A/B were assessed for shared-control consumers; their domain schemas/review owners remain unchanged. The current application owner inspection is pinned to development `899543a6625fafebb522783550678324e12ec4c4`; #295 at `21d19243ae54a0fb79d280e3c12ad140444363ce` supplies the documentation parent. Six canonical bodies match the saved input exactly at that parent; canonical 02/05 additionally preserve the later saved revision 58/live owner-view deltas. No older source or prototype observation is relabeled as a fresh production check.

Current source has MCP grant/membership/tool enforcement and partial opt-in OTel/bounded turn tracing. General workload identity/delegation, durable idle runtime, secretless managed execution, protected fleet collector and independently confirmed fleet stopping remain unverified. KB claim/heartbeat/fencing is a reusable local pattern, not acceptance of a general executor. #246/#292/#298/#297/#299 retain their own owners and gates. No new runtime is selected; the first proof is one bounded task/worker lifecycle, not scale infrastructure. New product acceptance remains NOT RUN; no native Tesbo synchronization or formal independent signoff is claimed.

### Review correction retained

The earlier chat review emphasized tracing, revocation and contamination but compressed idle infrastructure, workload identity/peer trust, DNS/bootstrap restrictions, patching and ambiguity in monitoring. This second pass explicitly allocates all those concerns. It does not generalize an article's architecture preference into a requirement to replace existing hosting or mandate managed workers. Mandatory native audit and best-effort diagnostics remain separate. The source-informed consistency pass also clarified shared-host stop scope and pre-authorized independent emergency containment during a control/audit outage, without permitting ordinary writes or an unauthenticated bypass. Requirements/API/design/UX/proof use the same distinction between request acceptance, authority fencing, real termination and uncertain external work; no parallel workflow enum is introduced.
