# Tesbo native governance integration — 19 November 2026

**Status: implementation verification in progress; broader specification NOT FROZEN.**

Latest completed runtime checkpoint: source `965a87a1`, tree-equivalent CI merge `e49fab4d`,
passes the occurrence repair's PostgreSQL and all 19 Model Studio API/browser cases. Native
suite-publication transport evidence closes SEC-NATIVE-01 narrowly. Aggregate smoke remains
red at one incomplete positive approval fixture (18/19 MCP); later selected stages did not run.
The following corrective revision supplies both exact approval hashes, improves screenshot
positioning and narrows a concurrently introduced secret-scanner exception. Its CI is still
required. Earlier sections below retain their historical pins and verdicts.

This is an implementation evidence record under the existing ASER review owner, not a ninth specification or a new approval authority. It follows the owner's authorization to finish the integrated native-owner work, run the genuine assurance teams and continue the retained original QA loop. It does not authorize a production deployment, customer-environment mutation or operational Skill grant.

## Run context and immutable inputs

- Target: `1alextest/Tesbooboo`, PR #167 into `development`; #158 is closed and unmerged. PR #164's governed model runs remain part of the integration.
- Baseline under independent archaeology: `288c89b36dd5e748621752a175f1f4bdaac7ec87`. Concurrent upstream work through `6862748b986264a6ae7866a33316ee796a9e8e46` is reconciled, including exact PostgreSQL JSONB history assertions, truthful credential-restricted MCP diagnostics, the reviewed-case graph-handoff fixture, human-reviewed MCP Notes/severity proposals, explicit reporter MCP consent, valid rename IDs, native-reviewed notification fixtures, the actual PUT case-edit route and the KB actions-menu navigation. The integration preserves stronger competing-transaction checks, full semantic revision counters and complete document readback before retry. PR #166's migration URL validation is retained through development merge parent `6897f989b055a955280f810c7daace86f74057fa`.
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

### Published integration evidence and remaining corrections

The first published corrective source is `3ebda24300d55a6d3e2141b9d64aecde23e7d4c4`, tree
`085693afe6a6e9673a74a730ce32bcee7bc8911f`. Its actual CI checkout was PR merge
`c181e36ccdbf43237efbb1a9e9ae8dff98478c34`, combining that head with development `6897f989`.
Behavioral run `44654648269`, database job `136017777581`, passed 599 tests and failed two new
rename fixtures before the history assertions: `REN-` plus a 32-character UUID exceeded the native
32-character external-ID limit. No assertion or production validation was weakened. The upstream
correction is retained, and run `44655359869`, database job `136020112536`, passed **all 601 tests
across all 17 suites**, including the two old/new run-history witnesses, model atomicity and Bug
association preservation. That run used source `3cc4e045473df6fcef8a204079ab37125d678329` and
merge build `fb29500535953cfff320c4acafcddcf86f0d76f0`.

For source `3ebda243`, smoke run `44654648304` passed the initial **19/19** smoke cases and the
selected graph/Zyra handoff **21/21**. The later notification lane failed six fixtures because they
assigned an Approved label without the required exact native review. The upstream notification
fixture repair uses the actual native review helper and is retained. Remaining downstream runtime
results must be read from their actual later head; this failed workflow is not acceptance.

Authentic artifact `14593362064`, `ci-smoke-evidence`, has SHA-256
`be90a1ac8a59be71757350072068de787a222293384d142d042bd63890460e59`. The downloaded bytes were
hash-verified and the embedded reports decoded. The artifact contains 218 PNGs, including actual
document uncertainty/navigation and full-page/drawer execution states. This is a count of artifact
images, not a visual-coverage verdict. A second testcase-lane invocation overwrote its earlier HTML
report with the one-test issue-key aggregate report; the pending workflow correction gives that
invocation its own existing artifact output directory. The original logs retain the earlier step
result, but the overwritten HTML inventory is not reconstructed as if it survived.

The independent [QA delta](2026-11-19-independent/qa-native-delta.md) at `3ebda243` passed 153
targeted assertions, three original unchanged contract probes and seven new real Nest/HTTP/domain
checks using injected authentication/persistence. It confirms the inspected backend corrections;
the HTTP harness is not actual cookie/token parsing or PostgreSQL evidence. It retains NOT READY
while actual browser journeys are pending and identifies late detail refresh resetting a newer
historical-revision selection. A coverage-read failure also needs truthful unavailable-state copy.
The owning UI tests and current source are being corrected; no future result is counted here.

The independent [Security receipt](2026-11-19-independent/security-native.md) at source `8707d56a`
identified two current-boundary gaps being repaired: suite create/update bypasses the stated human
publication boundary, and model approval/candidate authority is not rechecked and retained across
its transaction wait. Its machine-origin provenance finding remains a distinct tracked identity
gate, not permission to invent an installation schema. The receipt's 354 unit checks and 12 recovery
checks are mocked/source evidence; its required real denial/positive and concurrency tests remain
open until executed at the corrective head.

### Later runtime and current bounded follow-up

Source `cce4516c679a671b5c2ce30bc43afe99292079f1` ran as merge build
`207f7cbba15928e33a5997a0c10bd819056a7932`. Smoke run `44656690980`, job `136024548988`,
passed **17/17 Model Studio tests (9 API, 8 UI)**. Its testcase lane finished with **127 passed
and one passed on retry**, not a clean first-attempt 128/128. The retained trace shows proposal
schema dependency revision 22 at creation and 24 before the Notes update, while the parallel
API suite created/deleted suites in the same project. The exact-review Save returned 409 during those changes; the trace does not retain a save-time
snapshot to prove the sole cause of the conflict. The positive Notes fixture now owns a disposable project via the existing
project helper; all persistence/assertion checks remain and no automatic Save retry was added.

The same run passed **28/29** selected KB tests. KBU-65 passed the exact saved-content and reviewed
version assertions, then waited for a hidden menu item without first opening More actions.
The screenshot, accessibility snapshot and source agree on that navigation mistake. Upstream
`6862748b` adds the missing menu click; that exact correction is retained. No assertion, timeout
or production rule was relaxed. Later scheduled-run/MCP/native-execution stages were skipped by
this failed job and are not counted as executed.

Artifact `14594393268`, SHA-256
`a3c5b4960ab254406fef697b330c1944402c77f88cc59f43987de000e68c965c`, was downloaded and
hash-verified. Its 235 PNGs and traces remain authentic evidence of those captured scenes;
Model Studio's passing report has no screenshot attachments, so its visual recovery is not
inferred from the pass count.

The next coherent source batch prepares the following scoped repairs, still requiring exact-head CI:

- Preserve a still-valid historical model revision during delayed detail refresh; select a newly
  authored revision explicitly. Key coverage loading/error/ready state, retain the run draft and
  selection through denied-read retry, and block dispatch while eligibility is unavailable.
  Discovery selects 18 Model Studio tests (9 API, 9 UI), including the delayed-read ordering and
  real loading/error/retry/empty controls. Four After screenshots are attached after assertions;
  they are not produced or verified by discovery.
- Refuse machine suite create/update at MCP/REST and the shared native owner, while keeping
  trusted human creation/editing and exact-reviewed same-transaction suite insertion. Recheck
  current project/workspace/member authority after model transaction waits and retain it until
  commit. Eight new PostgreSQL authority/lock scenarios remain CI obligations.
- Keep the exact active MCP catalog at 46 default tools (22 read, 24 write), or 49 with the
  isolated proposal preview (24 read, 25 write); 13 direct testcase/dependency publishers are
  retired. Generic scope/billing controls use the existing permitted Bug writer and still check
  real persisted rows, exact audit and forbidden effects. The full project snapshot includes
  governing revision/consent state. Targeted MCP compatibility tests pass 201/201 locally.
- Preserve the full testcase HTML report by giving the later issue-key invocation a separate
  output directory. The runtime selection remains unchanged.

The independent [Purple receipt](2026-11-19-independent/purple-native.md) records 37 actual PNG
inspections, source-derived capture semantics and image hashes. It credits the narrow mobile and
keyboard preview evidence, identifies two advisory presentation issues, and keeps persisted-model
visual recovery and the completed KB history journey unverified. A passed browser assertion is
not substituted for an unseen screenshot or an untested assistive-technology path.

Final local backend regression at the coherent follow-up source passed **116 suites / 2,344
assertions**. Two environment-gated suites / 98 tests remained skipped and must not be counted as
runtime proof. The native publication selection passed **383/383 across nine suites**, and the
standalone deployment diagnostic passed 14/14. The immutable `3ebda243` suite-publication probe
failed five of six tests; the corrected native suite now passes seven, including a later-added
failed-lookup distinction. Backend/E2E types and the existing lint baseline passed with zero new
lint errors. Raw local logs and the adapted before-probe are retained beside these receipts.

Source `6862748b986264a6ae7866a33316ee796a9e8e46`, merge build
`e14e1f3c6ac2f69aca8b7fe8ff9a90ea917b23ad`, subsequently passed **29/29 KB** and **19/19
scheduled-run** tests in smoke run `44660092957`. Its selected testcase and email stages each had
one retry-pass and are not clean first-attempt results. The bulk execution stage selected 11:
eight passed, one failed in setup, and two did not run. The setup sent generic Approved cases to
bulk-create and then assumed a successful `created` array. The existing run-browser fixtures now
use the real bulk Draft writer followed by the exact human review helper; the six sibling setup
sites retain all original run/filter/sort/status assertions. These fixture corrections still require
a new real run; later MCP/compatibility stages remain unexecuted at this cutoff.

These local and source statements do not promote the earlier browser/database results to the new
batch. The independent security, QA and visual reviewers must reconcile the final pinned delta.

## Independent assurance and retained next milestone

Two actual independent Blue reviewers completed archaeology at the pinned baseline. Their unchanged individual receipts and bounded two-member reconciliation are retained in [the independent review directory](2026-11-19-independent/blue-reconciliation.md). The agreed direction is to extend and compose the native owners; it is not a full specification freeze, approval of a concrete new persistence primitive or release readiness.

The independent QA receipt at source `3299691e` is [retained](2026-11-19-independent/qa-integration.md) with only its terminal blank line normalized for repository whitespace validation (original SHA-256 `585d28eb35a4c98e73e2dcd4e317918263b5f55a784007c5ef98d90e3134c1c4`); its findings are unchanged. Its NOT READY verdict identified four concrete defects: machine model publication, Bug result rewriting, stale recorded mappings and uncertain run retry. The later fixes and runtime evidence require a new delta review; the earlier verdict is not silently replaced. Its 49-journey denominator and unexecuted broader obligations remain explicit.

The actual independent [Red receipt](2026-11-19-independent/red-independent.md) and root grounding
member's [formal two-member Gate B reconciliation](2026-11-19-independent/red-grounding-and-reconciliation.md)
are complete. They admit only the native extension/extraction/composition direction to Grey/White;
no concrete new persistent primitive or unresolved human policy is approved. The independent
[Elephant Gold receipt](2026-11-19-independent/eg-independent.md) independently retains NOT FROZEN
and records the canonical/source authority and actual merge-build distinctions.

The independent [Grey receipt](2026-11-19-independent/grey-independent.md) retains 49 journeys:
43 high and six medium, with 24 G0 simulations, 20 G1 source traces and five blocked original-loop
journeys. It records zero runtime observations and MATERIAL JOURNEY GAPS. Its independent
pre-crosswalk reconstruction checkpoint is preserved alongside it. The separate actual [W-I challenge](2026-11-19-independent/grey-independent-challenge.md)
verified the accounting and sustained the bounded findings, while narrowing the positional-save,
source-history and conditional-deletion claims. It also independently corroborated the same-pin
suite publication gap. The actual [White prearchitecture receipt](2026-11-19-independent/white-prearchitecture.md)
records **PASS WITH EXPLICIT GATES — bounded native design work only**, after reading the actual
W-I receipt. It admits native journey, owner-fit, consumer and oracle design; it does not approve
a new persistent owner, unresolved protected policy, original-loop completion or final readiness.
Its known suite omission is pinned to `3ebda243` and requires a new disposition on the later fix.
Remaining implementation specialists, manual Graph closeout and White final reconciliation retain
their original sequence and evidence obligations. No full-team verdict is recorded yet.

At the pinned methodology revision, Graph tasks state that its mechanical harness is not implemented. Any closeout in this iteration must be labelled a manual evidence reconciliation, not an executed Graph verifier. Missing runtime or visual evidence remains an explicit gap.

The retained I3-Q outcome remains ChatGPT task → explicitly assigned external executor using its own driver → original report bytes/attachments → analysis → linked new retest → exact selected human native publication. The current default-off proposal preview and model dispatch do not implement that outcome. The next design must reuse the native task, principal, storage, proposal, case, Run and Bug owners, with separate task/prompt/assignment/attempt/report/analysis identities and truthful failure/retry semantics. Operational S0 decisions and real original-loop runtime evidence remain outstanding.

## Concurrent fixture reconciliation before publication

Upstream `77573c4a35e7a04c510d225788211c5584df8d4e` supplied the same six run-browser fixture repairs through the shared `bulkCreateApprovedTestcases` helper. This batch preserves that upstream implementation and adds the created-row count assertion from the independently prepared local helper. Both paths use actual Draft creation and exact human review; no status/filter/sort assertions are removed. The local-only duplicate helper is removed. Runtime verification still belongs to the next published tree.

## First-attempt email fixture diagnosis

Artifact `14596256551` from source `6862748b`, merge `e14e1f3c`, run `44660092957` confirms ACU-10 failed after earlier account reset work because the shared positive fixture password had 18 characters while native password setting permits at most 16. Cleanup authenticated with the previous reset password, received HTTP 400 when restoring the oversized seed, and silently exhausted its attempts. The API email tests and the three negative form assertions passed. This is a demonstrated fixture-policy mismatch, not evidence of broken email delivery. The existing shared positive seed now satisfies the policy and the existing cleanup throws if it cannot restore the native state; negative assertions and product policy remain unchanged. The same selected ACU-07/08/10 sequence must now pass on its first attempts. See the hash-bound [artifact analysis](2026-11-19-independent/ci-686-failure-analysis.md).

## Published9519 checkpoint and remaining coupled correction

Source `9519b56d3441dfec3a107db95ca602665454f407` and actual CI merge
`0d510c59843210365810f446db0aa395a28011ca` both have tree
`31b5e09247237c29ef3d215ab60147c7e4f13ba7`; the fetched Git objects have an empty diff.
Behavioral run `44663468056` passed the17 migrated suites: **609/609**, including eight new current-authority cases. All157 migrations applied and the repeat migrate was up to date. HTTP/contracts had326 pass/8 environment-gated skips; concurrency had72 pass/90 skips. Those98 Review Board tests then actually ran in smoke run `44663468105`, job `136047014072`: **2suites/98passed**. Do not add overlapping local or reviewer selections to those counts.

The smoke job passed its19 primary tests, then selected21 Zyra model/graph tests and passed20 with one failure. The failure was an outdated catalog expectation of51 after the intentional retirement of two suite publishers; actual discovery returned49. The fixture now expects49 and explicitly refuses both suite publisher names. No later selected smoke stage ran on this head. Architecture job136047014026 passed114 quality-tool tests, analyzed780 modules with zero forbidden edges and reported zero new clones (nine existing clones remain debt). All eight sibling workflows completed success; smoke remains failed at this checkpoint.

The separate [Security delta](2026-11-19-independent/security-native-final-delta.md) independently reproduces prior defects and closes SEC02 narrowly using the exact-tree DB evidence. SEC01 real MCP-P07 terminal evidence remains pending; SEC03 machine-origin provenance remains open. The separate [QA delta](2026-11-19-independent/qa-native-final-delta.md) retains NOT READY pending browser evidence and the new occurrence finding; its188 in-process tests and three temporal probes are not browser proof.

Actual Green found **GREEN-NATIVE-01**: current model outcome projections can match a later re-added native execution by testcaseId to the original immutable model manifest. Its unchanged-production projection probe has a passing original-occurrence neighbor and a failing replacement-occurrence oracle. Root and QA independently corroborated the native remove/re-add source path. A repair must pin actual cycle-item/execution occurrence and reviewed snapshot identity in the existing manifest transaction; original native runs remain editable and unknown legacy provenance must not be guessed. The correction and real lifecycle tests are in progress, not passed evidence here.

[Root's disclosed Green grounding and target binding](2026-11-19-independent/green-native-root-grounding.md) defines the bounded native trace profile and actual mechanical results. Its11 declared rows/40 source hashes/eight canonical hashes and four negative controls are input-integrity evidence only; the open High remains open. Independent Green assessment of that binding and the final correction remains required. The unchanged methodology and separate manual Graph obligation are preserved.

The concurrent upstream catalog correction `6d921151498e2a52b244ade4efd19efd7ecbf71b` is preserved, including its source comment; the local follow-up adds explicit absence assertions for both retired suite tools. The new occurrence repair uses the existing V154 JSON manifest with no migration, preserves ordinary native editing, and exposes unavailable/unknown attribution. Its62 focused tests and all three typechecks passed locally; two real PostgreSQL lifecycle cases, one API case and the extended existing UI case require the next isolated run. The complete Model Studio selection is now19 (10 API,9 UI).


## Catalog-only CI and next exact repair checkpoint

Source `6d921151498e2a52b244ade4efd19efd7ecbf71b` preserved the catalog correction (49 preview tools). Smoke run `44665137189`, job `136052473874`, built PR merge `375f0895f4e1bf106a1772dee34fe7880ab0461b`. It passed the isolated Review Board 98 tests, primary smoke 19, Zyra/graph 21, testcase 128 plus issue-key 1, notifications 52, admin 3, reports 3, requirement matrix 1, Model Studio 18, KB 29 and scheduled runs 19. Email selected six: five passed and ACU-10 failed on both attempts in fixture cleanup. Bulk and all later selected stages did not run. Eight sibling workflows passed. These historical outcomes do not certify the new occurrence repair.

The authentic 45,291,728-byte smoke archive, artifact `14598046061`, has SHA-256 `deb8e12ae99ce8e54e021e36649e2b93dd11f51b20f6bd7fa8f664e305f61cec`. Both ACU-10 traces show a successful fresh login using the fixture password followed by a same-password change correctly refused with 400. The correction returns after that successful login proves restoration; it preserves the real changed-password restoration and terminal failure. The independent account analysis records the actual trace and exact corrected file. Existing negative policy assertions are retained.

Independent QA also found a selected Zyra test reader mismatch: chat proposals retain wrapped `draft.title`/`fields.title`, while the test helper read only flat `title`. The helper now reads the actual representations in explicit array order. `qa-selected-fixture-delta.md` verifies that every other byte and the complete ZYU-65/66/141 assertion bodies are unchanged. This is a corrected persistence oracle, not a weaker product contract. Its runtime remains in the unchanged governed selection.

The authoring memo `i3-native-owner-fit.md` is retained as a concrete design input, explicitly not an independent verdict or ninth normative specification. It maps all logical facts, current owner/producer/consumer boundaries, A/B physical alternatives, seven domains, native transaction requirements and 15 full-loop acceptance oracles. Physical selection remains W-OWN; fresh design-delta review is in progress. No new persistence or operational authority is allocated by retaining the memo.


Before publication, concurrent upstream `bd6df78d434012ffc11e9466dc0a996fb18d9f60` supplied the same account-cleanup correction through a successful `passwordWorks(FIXTURE_PASSWORD)` check before the restoration loop. Its account file is preserved byte-for-byte. The prior independent receipt remains an authentic record of the equivalent six-line local correction reviewed before reconciliation; it is not relabeled as the upstream bytes. The new reconciliation record binds the adopted upstream file. No concurrent work was overwritten.

Local validation of the fixture delta: E2E TypeScript passes. Scoped ESLint finds the same existing unused `page` declaration at `e2e/ui/zyra.spec.ts:1470` in both immutable9519 and the corrected file, with no new diagnostic; it is not reported as a lint pass. A full local discovery attempt cannot load suite-wide tests because the CI-generated `.auth/context.json` files are absent. No service/setup was started to manufacture that state. The focused Model Studio discovery remains 19, and CI lists each actual selected stage after its isolated fixture setup.

## Published965 runtime and bounded independent reconciliation

Source `965a87a13d2669354598f8d4b912f36fdb148867` and actual CI merge
`e49fab4df4043b621b7007e97d8646743f441b6b` have the identical complete tree
`b3c497bdb7a43cd43e8d0535f663c542cba88186`. The merge parents are development
`6897f989` and source965. Raw logs are retained under the supplemental integrity index;
counts below are actual isolated CI execution and must not be added to overlapping probes.

| Selected stage | Completed source965 result |
| --- | --- |
| Migrated PostgreSQL | 17 suites / 611 passed; 157 migrations and immediate repeat-migrate integrity passed |
| HTTP/contracts and concurrency | 326 pass / 8 environment skips; 72 pass / 90 environment skips |
| Isolated Review Board | All 98 environment-gated tests actually ran and passed in its dedicated stack |
| Primary smoke; Zyra/graph | 19 passed; 21 passed |
| Testcases and issue-key UI | 128 passed plus the separate one-case issue-key selection |
| Notifications; admin; reports; requirement matrix | 52; 3; 3; 1 passed respectively |
| Model Studio | 19 passed: 10 API and 9 UI, including original occurrence removal/re-add attribution |
| Knowledge; schedules; email; bulk runs | 29; 19; 6; 11 passed respectively |
| MCP | 18 passed / 1 failed; the positive lifecycle fixture omitted expectedApprovalRevision on both attempts |
| Later approved-run, governed-change and native-compatibility stages | Not run after MCP failure |
| Architecture | 114 tool tests; 780 modules; zero forbidden dependency violations |
| Workflow aggregate | Seven passed; smoke and the current-tree secret scan failed |

The independent Green occurrence probe ran the same 24 discriminating oracles against old
and corrected production projections: old9519 had 2 pass / 22 fail, source965 had 24 pass.
Those are oracle results, not 22 separately established defects. The independent receipt and
disclosed author-member grounding bind the original manifest to exact native occurrence and
snapshot identity, retain legacy UNKNOWN and removed-original unavailable semantics, and
preserve ordinary native additions. The later addendum reconciles actual API/browser behavior;
none of these results closes privileged historical rewrite or the full original I3 loop.

The independent Security transport closeout observes the dedicated MCP-P07 test passing:
four machine requests across both aliases and bearer REST preserve complete suite/case/audit
state, while legitimate human partial edit and exact selected Save create the native Draft.
SEC-NATIVE-01 is closed narrowly; SEC02's eight PostgreSQL cases retain closure. SEC03
machine-origin provenance and action-bound human assent remain open.

Independent Purple opened all actual source965 Model Studio images. Passing behavior did
not establish complete visual evidence: several claimed controls were below the internal main
scroll viewport. The capture-only follow-up retains every existing assertion and adds actual
scrolling, full-overlap viewport guards and eleven named attachments. No synthetic DOM or
layout is substituted. The next CI's actual images still require independent visual review.

## Exact approval fixture and scanner correction awaiting their own run

The MCP correction obtains a fresh human case-detail read, proves the edit revision agrees,
validates its approvalRevision format and supplies both required hashes. Independent QA's
finite census of twelve selected spec files and the shared helper found this one positive
omission; malformed-context refusal cases remain intact. E2E types and focused MCP/Model
lint passed locally. These source checks do not count as corrected transport execution.

Concurrent commits `62f66ad3`, `be0240f4` and `0e52c233` are preserved. The last adopts the
existing exact-review approval helper in the MCP lifecycle. Its single approval call and
Approved readback remain; the shared helper now retains the original exact HTTP200
requirement, and the scenario separately checks its amended edit revision before approval. Commit `be0240f4` classifies .gitleaks.toml as repository tooling. Commit `62f66ad3`
introduced a global match-only hash exception despite its
receipt-only comment; independent Security records SEC-NATIVE-04. This corrective revision
keeps every default rule and restricts each exception to generic-api-key, an exact repository-root
receipt filename, the complete detector match and independently verified historical digest.
Old9519 profiles, original occurrence evidence and the new965 v3 profile have separate exact
bindings. Arbitrary 64-hex values are not exempted.

The existing secret job now resolves and logs one scanner image ID/digest and CLI version,
then uses that exact image for both discrimination controls and the repository scan. The
controls require seven known mappings to be found by an explicit default-only config and
suppressed by the corrected config. Nine denied neighbors run with both configs: outside
path, nested lookalike, unrelated filename, filename suffix, different digest, wrong historical
digest, generic credential in an allowed file, provider credential in that file, and a second
credential on the same line. Assertions inspect redacted rule/file/count results; scanner
errors cannot count as expected findings. Actual scanner execution remains a CI obligation.

The previous secret log reports five findings without identities. The candidate receipt-map
explanation is independently source-backed, but is not relabeled as an observed report. The
known source965 scanner digest was sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f;
its CLI version was not printed. No local scanner or service execution is claimed.

The separate White I3 owner-admission receipt accepts comparative design work with explicit
gates and requests finite Blue/Red archaeology before physical allocation. It is retained as an
actual independent review, not a native PR release vote. Current full CI, final QA/Purple,
manual Graph and White final disposition remain open for their respective bounded scope.
