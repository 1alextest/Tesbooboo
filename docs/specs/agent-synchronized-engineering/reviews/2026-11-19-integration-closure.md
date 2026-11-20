# Tesbo native governance integration — 19 November 2026

**Status: implementation verification in progress; broader specification NOT FROZEN.**

This is an implementation evidence record under the existing ASER review owner, not a ninth specification or a new approval authority. It follows the owner's authorization to finish the integrated native-owner work, run the genuine assurance teams and continue the retained original QA loop. It does not authorize a production deployment, customer-environment mutation or operational Skill grant.

## Run context and immutable inputs

- Target: `1alextest/Tesbooboo`, PR #167 into `development`; #158 is closed and unmerged. PR #164's governed model runs remain part of the integration.
- Baseline under independent archaeology: `288c89b36dd5e748621752a175f1f4bdaac7ec87`. Concurrent upstream work through `ae3bdbd4725f2547af9a387afcdbfd6ab95c2cd2` is reconciled, including exact PostgreSQL JSONB history assertions, truthful credential-restricted MCP diagnostics, the reviewed-case graph-handoff fixture, human-reviewed MCP Notes/severity proposals and explicit reporter MCP consent. The integration preserves stronger competing-transaction checks, full semantic revision counters and complete document readback before retry. PR #166's migration URL validation is retained through development merge parent `6897f989b055a955280f810c7daace86f74057fa`.
- Canonical requirements: the original eight numbered files in `Tesbo_Specifications_v1.4.28.zip`, SHA-256 `6094687758ebf1e5dfa3c6ed8e2209b8967a190523815ba1e1197d11867374ef`, and the existing application baseline. The repository roadmap remains subordinate to those originals.
- Unchanged review method: `NesberryEnterprise/Nesberry@d83549c85a4dcd047fb40dc4fba4ec62737ab0fc`, canonical team charters, review orchestration, Purple mandate/runbook and Graph requirements/design/tasks. The portability policy binds the method to Tesbo's actual actors, policies, code, UI and authorized environments; Nesberry-specific product rules are not imported.
- Actors and outcomes: human project owners/managers/reviewers, project-bound machine credentials, internal jobs, external executor instances and separate analysts. Publication, execution observation, model expectations and human approval remain different facts.
- Source owners: native testcases/review receipts; cycles/items/executions; Bugs/bug_links; knowledge documents/versions; `ai_generation_requests`/Zyra proposal tasks; model revisions/approvals/mappings/manifests; project MCP consent/grants. New composition calls these owners rather than duplicating them.
- Execution binding: existing isolated GitHub Actions PostgreSQL/Redis/backend/frontend/Playwright stack. No shared `.env` database, live credentials or customer fixtures are used. Source, mocked composition, real PostgreSQL and browser proof are recorded separately.

## Confirmed failures and corrections

| Mechanism | Correction and preserved neighbor | Discriminating evidence |
| --- | --- | --- |
| Queued document save takes the revision of a newly opened document | Each document write queue owns its acknowledged state, including late acknowledgements after navigation. | Queue regression plus existing real browser navigation/save journey. |
| A lost save acknowledgement leads to a stale or duplicate retry | A new explicit Save reads persisted content first. Exact content is acknowledged without another PATCH; a different concurrent edit preserves both the server version and local draft. | Exact no-duplicate browser assertions and concurrent-edit recovery scenario. |
| Model run commits before required provenance and relies on fallible deletion | Native run/items/executions and manifest share one transaction. Model/mapping/case locks preserve the basis until commit. | Injected manifest failure, before/after revision/archive races, case demotion and link removal; ordinary native run remains valid. |
| Candidate Draft commits independently of its model mapping | Native Draft, audit and mapping share one transaction; cache/index effects run after commit. | Mapping-failure rollback and concurrent retry idempotency. |
| Link/unlink can mutate after a model archive wins | The same active-model lock and mapping mutation share a transaction. | Archive-first link/unlink refusals with no forbidden effects and existing positive mapping journeys. |
| A recorded case mapping can dispatch a different, subsequently edited case revision | Explicit recorded revisions are checked at link and dispatch under the existing locks. A changed basis requires explicit removal and a fresh link; the manifest records mapping identity and basis. | Four discriminating local falsifiers plus migrated and HTTP old-run/new-run witnesses. Unrecorded legacy/generated mappings remain an explicit separate contract gap. |
| An uncertain model-run response permits another accidental create | Persist an actor/project/model-scoped pending intent before POST; block another create through reload, inspect native runs, and require explicit identification or a separately acknowledged new request. | Production transport/helper tests and three actual browser journeys selected in CI. The browser reference is not a server idempotency receipt or a cross-device guarantee. |
| Ordinary testcase rename rewrites previously accepted run identifiers | Native case editing and selected proposal application leave existing item snapshots untouched. A newly admitted run captures the newly reviewed identifier. | Two migrated native/proposal scenarios and the existing full HTTP rename/delete journey compare complete old run, item and execution records. |
| Old machine-publication and revision expectations contradict the integrated contract | Preserve human positive paths; retired machine publishers require explicit refusal and no row/history/activity/cache effects. Assert exact semantic revision increments and genuine no-op preservation. | Migrated partial-edit/suite tests and real human/consented-machine bulk journeys. |
| Fixture helper mistakes a cycle-membership endpoint for testcase creation | Match the project testcase creation endpoint exactly. | Existing Run, Bug, Plan and repository journeys continue through their actual endpoints. |
| Negative move snapshot races embedding bookkeeping | Existing governing-state projection excludes only asynchronous search bookkeeping; authored content, relationships, revisions and history remain exact. | Refusal snapshots and legitimate move controls. |

Independent Blue and QA review identified two further concrete defects: a machine credential could approve a model or materialize its native cases through the token issuer's identity, and Bug association could rewrite an execution's result. The principal repair applies both the shared REST classification and a fail-closed domain check; a human approval/materialization remains valid, while proposal generation and ordinary governed dispatch retain their existing machine permission boundary. Cookie-free HTTP regressions inspect forbidden database effects as well as the response.

**Bug authority correction:** canonical README lines 301/303/329/339 separate evidence-backed failure from association and explicitly remove the automatic `failLinkedExecutions` mutation. The earlier interpretation of commit `1db41cf9` as a newer user decision was unsupported; that interpretation is withdrawn. Linking a Bug must preserve the complete execution record, including open/manual runs. The explicit observed-result writer remains available. Full direct/side/unresolved finding classification and separately governed historical correction remain outstanding. This correction follows the primary specification, not majority agreement between reviewers.

**Historical boundary:** ordinary case rename now preserves accepted snapshots. The existing privileged history-import `refreshSnapshots` path still has broader mutation semantics. This iteration does not claim to implement the full FR-048 historical correction/attempt contract or to have closed every historical mutation entrance. That path needs its own explicit contract and refusal/positive runtime evidence before a broader historical-integrity claim.

## Verification ledger before the new CI head

The original `288c89b` PR CI is a failing baseline, not acceptance: behavioral run `44641518974` had 11 failed / 573 passed migrated tests; smoke run `44641518877` had 9 failed / 10 passed and downstream impact stages did not execute. Its browser artifact reports the actual PR merge build (`6a0c1db…`, merging that head with `6897f989…`), not a direct checkout of the head alone.

Authentic baseline browser evidence is retained by GitHub artifact `14586457890` (`ci-smoke-evidence`), SHA-256 `92ba3d0aa75a4e1e8a16adc749382961d117cd6bbf04df9c654a618c8865b338`. Its screenshots and traces establish only the captured fixture/role/viewport scenes, not full visual coverage or successful workflows.

Local verification of the initial repair batch at local source `3299691e11941d5ab701c2f9b2dc53ff29d808da` (tree `332665d638e38a635ead798f87e2ed192d66a8d3`):

- Backend non-database regression command: `npm test -- --testPathIgnorePatterns='\.db\.spec\.ts$' --silent` — 114 suites and 2,269 tests passed. Two environment-gated suites / 98 tests did not run locally and remain CI obligations.
- Document write queue: 13/13 passed.
- Focused model composition, generator and preview checks: 39/39 passed. The new composition suite fails 3/6 against the unchanged baseline and passes 6/6 against the fix: orphan run, orphan Draft and stale manifest title. This is mocked composition evidence, not PostgreSQL proof.
- Backend, frontend and E2E TypeScript checks passed; whitespace validation passed.
- Full frozen-baseline lint checks passed with zero new errors. Existing debt remains explicit: backend 5 errors / 2 warnings, frontend 13 errors / 10 warnings; no rules or baselines were weakened.
- Migration inventory: V1–V157 valid; 154 migrations already in `development` unchanged under the append-only check. V154 remains the merged model migration; new review/document/proposal migrations remain V155–V157.

Later corrective checks, before the final CI pin:

- Trusted model principal plus recorded-mapping tests: 89/89 passed. The four new mapping falsifiers first failed against the uncorrected implementation, then passed after the repair.
- Bug association, relationships and attribution: 76/76 passed. The association suite first produced 19 failures / 16 passes, then passed all 35 cases with outcome preservation.
- Model run recovery and production API behavior: 12/12 passed; the existing loopback HTTP transport regression passed 1/1. Neither is browser or database evidence.
- Backend, frontend and E2E TypeScript passed for the corresponding final changes. Full Model Studio discovery finds 17 tests (9 API, 8 UI); discovery is not a runtime pass.
- At upstream `bf7f9c7a`, all eight other workflows passed, while smoke run `44650229724` passed 18/19 primary smoke tests. The remaining reporter test lacked its explicit MCP grant, and downstream stages were skipped. The repaired fixture retains the unconsented refusal, grants the actual named credentials through the native owner, then asserts legitimate access and read-only write denial. Later upstream `5e02b5c5`/`0fe75a44` fixture fixes are preserved; their PR description is not substituted for final-head CI evidence.

The required new runtime run must include all existing selected stages in `smoke-security-quality.yml`, including the full Model Studio API/UI files, exact human review, consent, KB, testcase, native Run/execution/automation/evidence compatibility and the smoke journeys. `behavioral-quality.yml` includes 11 model transaction/race/mapping cases alongside all existing migrated suites and the new historical rename/association assertions. The existing frontend quality job also selects the recovery helper/transport regressions. A skipped downstream step, mocked pass or earlier green commit does not close these exits.

## Independent assurance and retained next milestone

Two actual independent Blue reviewers completed archaeology at the pinned baseline. Their unchanged individual receipts and bounded two-member reconciliation are retained in [the independent review directory](2026-11-19-independent/blue-reconciliation.md). The agreed direction is to extend and compose the native owners; it is not a full specification freeze, approval of a concrete new persistence primitive or release readiness.

The independent QA receipt at source `3299691e` is [retained](2026-11-19-independent/qa-integration.md) with only its terminal blank line normalized for repository whitespace validation (original SHA-256 `585d28eb35a4c98e73e2dcd4e317918263b5f55a784007c5ef98d90e3134c1c4`); its findings are unchanged. Its NOT READY verdict identified four concrete defects: machine model publication, Bug result rewriting, stale recorded mappings and uncertain run retry. The later fixes and runtime evidence require a new delta review; the earlier verdict is not silently replaced. Its 49-journey denominator and unexecuted broader obligations remain explicit.

Independent Red and Elephant Gold reviews are in progress. Grey journey reconstruction, White prearchitecture, implementation specialist review, manual Graph closeout and White final reconciliation retain their original sequence and evidence obligations. No full-team verdict is recorded yet.

At the pinned methodology revision, Graph tasks state that its mechanical harness is not implemented. Any closeout in this iteration must be labelled a manual evidence reconciliation, not an executed Graph verifier. Missing runtime or visual evidence remains an explicit gap.

The retained I3-Q outcome remains ChatGPT task → explicitly assigned external executor using its own driver → original report bytes/attachments → analysis → linked new retest → exact selected human native publication. The current default-off proposal preview and model dispatch do not implement that outcome. The next design must reuse the native task, principal, storage, proposal, case, Run and Bug owners, with separate task/prompt/assignment/attempt/report/analysis identities and truthful failure/retry semantics. Operational S0 decisions and real original-loop runtime evidence remain outstanding.
