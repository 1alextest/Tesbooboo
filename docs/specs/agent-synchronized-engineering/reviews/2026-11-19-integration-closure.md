# Tesbo native governance integration — 19 November 2026

**Status: implementation verification in progress; broader specification NOT FROZEN.**

This is an implementation evidence record under the existing ASER review owner, not a ninth specification or a new approval authority. It follows the owner's authorization to finish the integrated native-owner work, run the genuine assurance teams and continue the retained original QA loop. It does not authorize a production deployment, customer-environment mutation or operational Skill grant.

## Run context and immutable inputs

- Target: `1alextest/Tesbooboo`, PR #167 into `development`; #158 is closed and unmerged. PR #164's governed model runs remain part of the integration.
- Baseline under independent archaeology: `288c89b36dd5e748621752a175f1f4bdaac7ec87`. Concurrent upstream commit `d65edc5e4dccc10117fd8c81a77a0cea509ab5c9` adds cached-machine publisher denial coverage; the integration preserves it alongside the stronger competing-transaction checks.
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
| Old machine-publication and revision expectations contradict the integrated contract | Preserve human positive paths; retired machine publishers require explicit refusal and no row/history/activity/cache effects. Assert exact semantic revision increments and genuine no-op preservation. | Migrated partial-edit/suite tests and real human/consented-machine bulk journeys. |
| Fixture helper mistakes a cycle-membership endpoint for testcase creation | Match the project testcase creation endpoint exactly. | Existing Run, Bug, Plan and repository journeys continue through their actual endpoints. |
| Negative move snapshot races embedding bookkeeping | Existing governing-state projection excludes only asynchronous search bookkeeping; authored content, relationships, revisions and history remain exact. | Refusal snapshots and legitimate move controls. |

The 19 November Bug decision is retained: a direct Bug link to a manual/open automated execution transitions it to Failed with native attribution; a repeated link does not churn the result. Finalized automated results remain sealed. Full direct/side/unresolved finding classification remains outstanding and is not claimed by this integration.

## Verification ledger before the new CI head

The original `288c89b` CI run is a failing baseline, not acceptance: behavioral run `44641518974` had 11 failed / 573 passed migrated tests; smoke run `44641518877` had 9 failed / 10 passed and downstream impact stages did not execute.

Authentic baseline browser evidence is retained by GitHub artifact `14586457890` (`ci-smoke-evidence`), SHA-256 `92ba3d0aa75a4e1e8a16adc749382961d117cd6bbf04df9c654a618c8865b338`. Its screenshots and traces establish only the captured fixture/role/viewport scenes, not full visual coverage or successful workflows.

Local verification of the repair batch:

- Backend non-database regression command: `npm test -- --testPathIgnorePatterns='\.db\.spec\.ts$' --silent` — 114 suites and 2,269 tests passed. Two environment-gated suites / 98 tests did not run locally and remain CI obligations.
- Document write queue: 13/13 passed.
- Focused model composition, generator and preview checks: 39/39 passed. The new composition suite fails 3/6 against the unchanged baseline and passes 6/6 against the fix: orphan run, orphan Draft and stale manifest title. This is mocked composition evidence, not PostgreSQL proof.
- Backend, frontend and E2E TypeScript checks passed; whitespace validation passed.
- Full frozen-baseline lint checks passed with zero new errors. Existing debt remains explicit: backend 5 errors / 2 warnings, frontend 13 errors / 10 warnings; no rules or baselines were weakened.
- Migration inventory: V1–V157 valid; 154 migrations already in `development` unchanged under the append-only check. V154 remains the merged model migration; new review/document/proposal migrations remain V155–V157.

The required new runtime run must include all existing selected stages in `smoke-security-quality.yml`, including the full Model Studio API/UI files, exact human review, consent, KB, testcase, native Run/execution/automation/evidence compatibility and the smoke journeys. `behavioral-quality.yml` includes the 10 new model transaction/race cases alongside all existing migrated suites. A skipped downstream step, mocked pass or earlier green commit does not close these exits.

## Independent assurance and retained next milestone

Fresh Blue reviewers are examining the pinned baseline without implementation-author context under the unchanged charter, with two-member reconciliation required before a formal verdict. Red premise challenge, Grey journey reconstruction, White prearchitecture, implementation specialist review, Graph closeout and White final reconciliation retain their original sequence and evidence obligations. No full-team verdict is recorded yet.

At the pinned methodology revision, Graph tasks state that its mechanical harness is not implemented. Any closeout in this iteration must be labelled a manual evidence reconciliation, not an executed Graph verifier. Missing runtime or visual evidence remains an explicit gap.

The retained I3-Q outcome remains ChatGPT task → explicitly assigned external executor using its own driver → original report bytes/attachments → analysis → linked new retest → exact selected human native publication. The current default-off proposal preview and model dispatch do not implement that outcome. The next design must reuse the native task, principal, storage, proposal, case, Run and Bug owners, with separate task/prompt/assignment/attempt/report/analysis identities and truthful failure/retry semantics. Operational S0 decisions and real original-loop runtime evidence remain outstanding.
