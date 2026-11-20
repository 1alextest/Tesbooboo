# Independent Security — final native-governance source delta

**Current evidence disposition:** the source checkpoint in sections 1–9 is preserved below. **CI Addendum A** records subsequently inspected real PostgreSQL evidence: SEC-NATIVE-02 is closed for its bounded approval/candidate race scenarios at the named isolated build; SEC-NATIVE-01 still awaits its terminal transport integration result; SEC-NATIVE-03 remains OPEN. The addendum supersedes only those explicitly named earlier pending-DB statements.

## Run context, independence and evidence boundary

This is a fresh advisory Security delta review, performed by a reviewer that did not author the product repair. It applies the unchanged Nesberry Security charter and orchestration to Tesbo's actual project, human, token, proposal, model, case and Run owners. It does not import Nesberry marketplace roles, commercial rules or operating assumptions. The prior `security-native.md` is a finding lead, not proof that the current source conforms.

| Identity | Exact binding |
| --- | --- |
| Target | `1alextest/Tesbooboo`, native-governance increment associated with PR #167 |
| Comparison source | `3ebda24300d55a6d3e2141b9d64aecde23e7d4c4`, tree `085693afe6a6e9673a74a730ce32bcee7bc8911f` |
| Primary inspected/executed source | `8db53c1f91a93c35572850e8229041c03bc5c1c0`, tree `c22dbe8dc5502e3c5c7d5497f7f94021ded6b156`, immutable worktree `tesbo-review-native-final` |
| Published follow-up inspected by Git delta | `9519b56d3441dfec3a107db95ca602665454f407`, tree `31b5e09247237c29ef3d215ab60147c7e4f13ba7` |
| Method | `NesberryEnterprise/Nesberry@d83549c85a4dcd047fb40dc4fba4ec62737ab0fc`; unchanged supplied charter, orchestration, privacy guard, assurance-portability and assurance-evidence policies |
| Product authority | Repository `AGENTS.md` and `CLAUDE.md`; freshly opened applicable passages of canonical v1.4.28 `00_README.md`, `01_PRODUCT_REQUIREMENTS.md` and `06_IMPLEMENTATION_AGENT_BRIEF.md`; native policy and writer code |
| Assessment | Source mitigation and mocked/in-process behavior of SEC-NATIVE-01/02; continued disposition of SEC-NATIVE-03; legitimate human and exact selected Save compatibility |
| Running build / environment | **NOT OBSERVED by this receipt.** No real DB, HTTP server, browser, target, service or migration was started or used. New CI was reported as triggered by the driver; its result is not counted. |

I independently checked that the complete `8db53c1f → 9519b56d` delta has exactly four files: the shared RBAC fixture password, account cleanup failure reporting, captured-old-CI analysis, and the closure record. There is no delta in `Tesbo-Backend-Nest`, `Tesbo-Frontend`, workflows, or `e2e/api/mcp.spec.ts`. The native source conclusions and selected test inputs therefore transfer by verified file equality; the 336-test execution remains an execution at **8db53c1f**, not a falsely relabeled full 9519b56d run. The account fixture change preserves product password policy and negative assertions; it makes restoration failure explicit. I read the old-CI analysis but did not independently decode its trace artifact, so its old runtime observations are attributed to that separate receipt.

The scope does not certify the original I3 external task/executor/report/retest/publication round trip, operational S0 decisions, complete Model Studio capability bindings, complete platform security, or release readiness. Security lens S0 below is a threat-model lens; it does not discharge the separately named operational S0 gate. The canonical method's Critical Preflight, shared vocabulary and spec-standard files are not present in the supplied method package; the same missing-input boundary remains named rather than waived. No product, immutable checkout, canonical specification or methodology file was edited. Both inspected product worktrees remained clean.

`B/` below means `Tesbo-Backend-Nest/` in the inspected source. Native code line references also apply to the byte-identical published follow-up.

## 1. Threat-model delta

The patch closes the machine-to-official-suite publication paths in the shared REST/MCP classification and at the native suite owner, while retaining explicit human editing and transaction-internal suite creation after exact selected proposal review. It extracts the existing transaction-bound project/workspace/member check and applies it after model approval and candidate-publication serialization waits, without moving Zyra's feature/role policy into Model Studio. Assets remain official suite instructions and hierarchy, case definitions, attributable human review, model approvals/mappings, native Run history, and the integrity of their audit and provenance.

The independent problem model includes a compromised but valid named project write client, an honest human whose membership/workspace/project changes while queued, a stale cached MCP catalog, an assistant emitting an old suite operation, and a human saving only selected proposal operations. A token issuer is not the acting machine or the human reviewer; a draft is not an approved model; an approved model or prepared native Run is not observed execution. These distinctions are required by canonical README P-06/P-07/P-08/P-13 (`00_README.md:26–33`), with protected indirect writers explicitly in FR-037 (`01_PRODUCT_REQUIREMENTS.md:96`).

Valid alternatives were retained: machine draft/model generation and reads, an existing suite being found without any publication, human native suite creation/editing, exact reviewed Save that creates its chosen suite atomically, human Model Studio actions when unrelated Zyra storage is disabled, and historical records whose origin remains unknown. The proposed broader MBT capability and independent-review binding still requires ratification/mapping (`01_PRODUCT_REQUIREMENTS.md:680–701`); this review does not invent a new owner/manager-only model-review rule.

## 2. Boundaries crossed and writer sweep

| Boundary / entrance | Authorization or consistency owner | Observed disposition |
| --- | --- | --- |
| Bearer versus cookie session | `B/src/auth/auth.middleware.ts:16–43`; global middleware registration `B/src/auth/auth.module.ts:39` | Bearer remains authoritative; invalid bearer clears user identity rather than borrowing a human cookie. A request-body `principal`, `approved` or `userId` is not the transport principal. |
| Project REST suite create | `B/src/common/testcase-publication.policy.ts:31–46`; `B/src/auth/api-token-rest.guard.ts:23–65`; global guard at `B/src/app.module.ts:60` | POST `/api/projects/:projectId/suites` is now protected. Source and guard tests refuse before native mutation. Actual HTTP proof pending. |
| REST suite update/delete aliases | `B/src/legacy/legacy.controller.ts:537–549`; guard `:31–39`; native service `:4495–4508` | PATCH remains unavailable to machine tokens as a non-project-prefixed route, with an additional explicit principal guard at updateSuite. DELETE remains explicitly refused by the existing publication guard. No new DELETE bypass was found. |
| Both MCP transports and cached suite tools | policy `:2–9`; `B/src/mcp/mcp.service.ts:335–367`; `B/src/mcp/mcp.tools.ts:1982–1988` | create_suite, update_suite and clone_test_suite are hidden and replaced with refusal handlers. The service also rejects them before actor resolution or handler effects. Direct calls to all three wrapped handlers refused in independent probes. |
| Native suite create/update and clone's insert | `B/src/legacy/legacy.service.ts:4429–4430,4467–4508`; `B/src/common/human-review-principal.ts:3–12`; MCP adapters `mcp.tools.ts:1050–1052,1073–1085,1165–1171` | Missing and machine principals fail closed. REST derives principal kind from authenticated request; MCP passes api_token explicitly. No machine adapter fabricates human_session. |
| Assistant legacy standalone create_suite | `B/src/legacy/legacy.service.ts:17906–17911,18010–18023,18123–18131` | Existing suite lookup remains read-only. Missing suite reaches createSuite without a human principal and is refused. Expected refusal is presented truthfully. Lookup errors no longer become an empty result followed by creation. |
| Assistant move / pending suite choice | `B/src/legacy/legacy.service.ts:17912–17943,18115–18120` | Destination name is a proposal when absent; pending draft mutation does not itself insert a suite. Human Save remains the publication entrance. |
| Exact selected Save / private insertion seam | `B/src/legacy/legacy.service.ts:21357–21367,20902–20949,20953–21002` | Human principal first; suite mutex, current proposal authority, task/target locks, exact digest and selection before `insertSuite`. Private insertion has only guarded native create and this reviewed Save as production callers. Suite, native cases, receipt and mandatory audit use the same transaction. Runtime atomicity not proved locally. |
| Import-created suites | `B/src/legacy/legacy.controller.ts:658–660`; service `:5593–5623,5710,5886–5950,6093`; policy `:38` | Both bulk and fallback suite insertion are inside the existing native import owner. Its sole external source caller is the import REST route, already protected from machine tokens. No new principal-less public route was introduced. This is source inventory, not a complete import runtime pass. |
| Native suite deletion and setup seed SQL | service `:4541–4594`; `B/src/setup/setup.service.ts:33–64,111–139`; setup controller `:13–24` | Deletion has the existing protected REST entrance. Demo suite inserts are fixed bootstrap data into a newly created project behind first-admin setup checks, not an additional machine suite-authoring alias. Bootstrap concurrency itself was not audited. |
| Human model approval | `B/src/behavior-graph/model-studio-models.controller.ts:85–95`; repository `:269–326` | Human principal, active model/current head/exact hash, then current authority on the transaction client after the model/revision wait. It is checked before first approval insert and before an existing receipt can be returned. |
| Human model candidate publication | controller `:109–119`; repository `:343–429`; native case writer `legacy.service.ts:5283–5306` | Human principal, approved exact generated digest selection, model-candidate mutex, suite mutex, then current authority. Native Draft, mapping and audit stay in the outer transaction; post-commit cache/index effects remain deferred. |
| Shared current authority versus proposal-specific policy | service `:4035–4046,15654–15660` | Current query uses the supplied client, current active project, project and workspace memberships, active workspace, and `FOR SHARE OF p,pm,om,u`. Proposal role parsing and testcaseStorage remain solely in requireProposalAuthority. Native helper accepts valid human authority with Zyra storage disabled. |
| Other model writes / machine origin | model controller `:21–65,98–106`; MCP `mcp.tools.ts:290–320,354–366,402–447`; repository `:114–151,221–251,467–547,567–578,764–778` | Draft/revision, mapping, archive and Run writers still propagate issuer userId. They do not gain machine-origin provenance from this patch. Their broader after-wait authority contract is not closed by the two new checks. |

The suite inventory used both function-call searches and case-insensitive direct INSERT/UPDATE/DELETE searches over production backend source; test-only writers were excluded. Same-project parent validation and omitted/clear/set edit behavior remain intact (`legacy.service.ts:4445–4505`). The native owner guard is a genuine second boundary; hiding a tool from discovery alone was not accepted as protection.

## 3. Findings and previous-finding disposition

| ID / lens | Severity / confidence | Evidence, prerequisites and blast radius | Invariant / disposition / required next step |
| --- | --- | --- | --- |
| SEC-NATIVE-01 — suite publication | Previous **HIGH**, **HIGH** confidence; no surviving bypass found in this bounded delta | Source-read at owners above; independently reproduced five previously failing machine/refusal cases against 3ebda243 and successful refusals at final source. Requires an otherwise valid writable project credential; bounded to its own project's official hierarchy/text. | **SOURCE MITIGATION PRESENT; RUNTIME CLOSURE PENDING.** Machine credentials no longer directly publish suites through the inventoried entrances. Preserve the real both-MCP-alias/REST denial and human/exact-Save positive integration regression as the terminal closure artifact. |
| SEC-NATIVE-02 — stale model review/candidate authority | Previous **MEDIUM**, **HIGH** for missing check; original real-DB race not reproduced here | Source-read repository `:278–326,349–429`, current helper `:4039–4046`; both authored race simulations fail against the old repository and pass final. Requires an authorized in-flight human request plus authority change during a wait. | **SOURCE MITIGATION PRESENT; REAL LOCK PROOF PENDING** for approval and candidate publication. Current authority is queried after the identified waits and held through transaction completion by the intended row locks. Execute eight real PostgreSQL before/after lock scenarios; do not generalize closure to every model/native writer. |
| SEC-NATIVE-03 — model machine-origin loss | **MEDIUM / HIGH**, **OPEN** | Source-read MCP context `mcp.service.ts:369–380` versus model adapters above; persistence `model-studio-repository.ts:121–129,245–247,514–519,764–778`; schema `V148_model_studio_revisions.sql:6–52`, `V154_model_studio_governed_runs.sql:15–29`. A valid allowed model-write client is enough. Scope is attributable model/revision/mapping/Run history in its project, not human approval forgery. | Agent-origin writes must remain distinguishable from human actions at persistence. The patch does not add token/client/actor provenance to these native records. Carry this as the existing broader identity gate; do not label historical issuer-only rows as proven human authorship. Require typed principal propagation plus actual REST/MCP and human persistence assertions when that owner is implemented. |

No new CRITICAL/HIGH defect was established in the bounded repair. This is not a NO-FINDINGS verdict: source repairs and the open evidence/provenance obligations are different facts. No risk acceptance from the user is inferred.

## 4. Attack chains

The previous valid-write-token → cached create_suite/update_suite → immediate official-suite mutation chain now terminates at the shared policy before any handler, with the explicit native human-principal guard behind it. Independent in-process probes challenged direct wrapped handlers as well as controller-to-real-native-owner calls; the forbidden effects did not occur in those mocks.

The previous authorized human → wait on model revision/candidate mutex → membership removed → approval/Draft commits chain now reaches a late transaction-bound check. Its source and simulated behavior are corrected, but real PostgreSQL wait/recheck/commit order is still a pending observation. There is no evidenced chain here to cross-project disclosure, arbitrary execution, secret extraction or forged Passed/Failed results.

The remaining provenance chain is still possible by source: valid machine model write → issuer-only native fields → later audit readers cannot distinguish issuer from acting machine. It does not bypass the explicit human approval guard. No higher-severity compound exploit was established.

## 5. Closure plan and checks actually executed

### Terminal closure artifacts

**SEC-NATIVE-01-IT remains the sole terminal closure artifact for the HIGH finding:** the real isolated integration regression now exists as `e2e/api/mcp.spec.ts:5302–5393` (test title begins `MCP-P07 SEC-NATIVE-01 suite publication`). It exercises both MCP aliases, REST suite create, forged body principal, exact unchanged suite/case/audit state, native human partial edit, and machine staging followed by exact human selected Save that creates a suite and a Draft. Expanded existing suite-text/reparent/clone journeys preserve neighboring behavior. I inspected this test and workflow selection; I did not execute HTTP/DB/browser checks locally. A passing exact-build CI receipt is still required to close it.

**SEC-NATIVE-02:** `B/src/behavior-graph/model-studio-runs.db.spec.ts:117–196` has six deny cases crossing approval/candidate-digest/candidate-suite waits with membership removal/project archive, plus two authorized commit-before-revocation neighbors. The deny cases observe actual blocked PostgreSQL activity before changing authority and compare native cases/mappings/audit/approval/revision state; the positive cases hold the outer transaction before commit and require a competing membership delete to wait. Candidate's positive case deliberately disables Zyra testcaseStorage. This is a material test design, not a timed sleep or mock substituted for a DB claim. Actual execution and DB/version/build receipt remain pending. Additional organization-member/workspace-switch variants were not added in this patch and are not separately runtime-certified by these eight cases.

**SEC-NATIVE-03:** unchanged broader gate, owned by native model plus identity/audit owners. Neither a named client grant nor an issuer foreign key closes it. No accepted residual was supplied and no machine-provenance migration is present in this delta.

### Executed evidence

| Run | Actual result and limit |
| --- | --- |
| Final source, selected backend in-process checks | **7/7 suites; 336/336 tests passed, 0 failed, 0 skipped; 10.928 seconds.** Existing tests plus 14 reviewer-authored probes. ts-jest diagnostics disabled / isolatedModules; not a typecheck or real service/database/transport run. |
| Independent SEC-NATIVE-01 discrimination at 3ebda243 | **7 selected/executed: 5 failed, 2 passed; 7 unrelated authority probes excluded by name filter.** The failures are machine create, machine update, implicit-principal service create, cached raw MCP create and update. The two positive controls are authorized human editing and already-protected clone. |
| Authored SEC-NATIVE-02 simulation at old repository | **2 selected/executed, both failed; 13 other cases excluded by name filter; 6.336 seconds.** Final test source was mapped to old `ModelStudioRepository`; approval and candidate promises resolved after mocked revocation instead of rejecting. This is explicitly a hybrid before-control, not a full old-build test or DB reproduction. Both same scenarios passed in the final source run. |
| Source / integrity checks | Exact Git HEAD/tree, clean worktrees, complete suite writer/caller search, all model writer entrances, native/helper/proposal diff, real-DB and transport regression inspection, four-file published delta. No migration/package/lockfile changes in this native comparison. |

Final source suite denominator:

| Suite | Passed |
| --- | ---: |
| `src/mcp/mcp.service.spec.ts` | 152 |
| `src/mcp/mcp-publication.spec.ts` | 49 |
| `src/behavior-graph/model-studio-runs.spec.ts` | 15 |
| `src/legacy/testcase-proposal-review.spec.ts` | 20 |
| `src/auth/api-token-rest.guard.spec.ts` | 79 |
| `src/legacy/suite-publication.spec.ts` | 7 |
| reviewer `security-final-contract-probes.spec.ts` | 14 |

The reviewer probes specifically test counterfeit body human authority through both actual suite controller methods, an issuer with no effective principal, human explicit clear/root move, the three raw wrapped MCP publishers before any collaborators, supplied-transaction authority, missing membership, retained proposal role/storage refusals, preserved allowed legacy role aliases, and native authority when Zyra storage is disabled. They do not mock a green database outcome and call it lock proof.

Reproduction commands (all paths are scratch or immutable source; installed dependencies are reused only):

```sh
node /workspace/scratch/fb086055b433/Tesbooboo/Tesbo-Backend-Nest/node_modules/jest/bin/jest.js --config /workspace/scratch/fb086055b433/assurance-working/security-final-jest.config.cjs --runInBand --json --outputFile /workspace/scratch/fb086055b433/assurance-working/security-final-jest-results.json

SECURITY_REVIEW_SOURCE=/workspace/scratch/fb086055b433/tesbo-review-3ebda243 node /workspace/scratch/fb086055b433/Tesbooboo/Tesbo-Backend-Nest/node_modules/jest/bin/jest.js --config /workspace/scratch/fb086055b433/assurance-working/security-final-jest.config.cjs --runInBand --runTestsByPath /workspace/scratch/fb086055b433/assurance-working/security-final-contract-probes.spec.ts --testNamePattern 'Independent SEC-NATIVE-01' --json --outputFile /workspace/scratch/fb086055b433/assurance-working/security-final-before-results.json

node /workspace/scratch/fb086055b433/Tesbooboo/Tesbo-Backend-Nest/node_modules/jest/bin/jest.js --config /workspace/scratch/fb086055b433/assurance-working/security-authority-before.config.cjs --runInBand --testNamePattern 'SEC-NATIVE-02 rechecks' --json --outputFile /workspace/scratch/fb086055b433/assurance-working/security-authority-before-results.json
```

The expected-before runs returned exit code 1. The final run returned 0. The final log includes the intentional synthetic Zyra lookup-failure logger line; it is a negative-path fixture, not a production failure. The author's reported 116-suite/2,344-test run and older 383-test/before receipts were not counted as this reviewer's execution.

## 6. Residual risk and evidence gaps

1. **Real lock and atomicity behavior:** no PostgreSQL engine executed here. Source ordering and mocks cannot prove row-lock requalification, competing transaction ordering, trigger effects, rollback, or deploy migration parity. The real barrier and rollback tests remain required.
2. **Actual transport and discovery:** both real MCP aliases, cookies/bearers, cached-session refresh, named grant/token revocation and REST routing remain CI/deployed observations. A source catalog count is not a live external client's registration.
3. **Scope of authority repair:** the new shared helper is called for approval and candidate publication, plus the existing proposal authority owner. It is not a universal retrofit across model draft/revision/archive/mapping/Run or direct suite edits. In particular link/unlink/revision operations still authorize before their transaction waits. Broader guarantees about current authority at every write cannot follow from SEC-NATIVE-02's narrow repair.
4. **Broader publication model:** the preview is still default OFF. Complete effective Skills, independently approved model capability bindings, stable logical operations across proposal revisions, full dependency-closed suite operations, and original I3 task/report/attempt identity remain separate gates. Existing name-based suite resolution in reviewed Save is not presented as the full future dependency/operation contract (`06_IMPLEMENTATION_AGENT_BRIEF.md:121`).
5. **Provenance:** SEC-NATIVE-03 remains open. No historical human attribution was fabricated by this delta; lack of new fabrication is not recovery of missing historical origin.
6. **Other security planes:** no fresh exhaustive audit of KB retrieval/egress, upload bytes, external evidence lifetime, dependency advisories, environment secrets, operations recovery, commercial entitlements, or target execution. The narrow patch introduces no new provider or dependency. Missing coverage is not N/A or proof of safety.
7. **UI and runtime:** no rendered interface or browser run was performed. The native source receipt cannot discharge Purple's current-render gate, QA's actual user journey proof, or repository e2e completion requirements.

## 7. Scoped verdict

**ACCEPTABLE-RISK for the bounded native source delta, with named verification gates.** The SEC-NATIVE-01 HIGH finding now has a substantive, independently challenged source mitigation and a concrete integration regression; SEC-NATIVE-02 has the corresponding late native authority check and discriminating tests. No new unmitigated HIGH/CRITICAL defect was established in the scoped repair.

**This is not release acceptance. SEC-NATIVE-01 and SEC-NATIVE-02 remain pending runtime closure, and SEC-NATIVE-03 remains OPEN.** Full protected machine governance, the original I3 round trip, operational S0 and broader specification freeze remain unaccepted. Only a subsequent exact-build receipt can add CI/runtime evidence; an older passing build or the same source tree's unit pass cannot substitute. The Security verdict is advisory and never overrides red or unexecuted required checks.

### Lens disposition

| Lens | Bounded result |
| --- | --- |
| S0 — trust boundaries | Suite entrances and exact Save traced; source mitigation for SEC-NATIVE-01/02; real transaction/transport proof pending. |
| S5 — identity and scope | Trusted human principal is separate from issuer; explicit machine refusals retained; SEC-NATIVE-03 and wider after-wait authority remain named. No credential access performed. |
| S8 — workflow abuse / false assurance | No new confirmed finding in inspected mutation/refusal behavior. Valid human publication and existing suite reads retained; no execution result is manufactured by the suite repair. Full QA workflow assurance not claimed. |
| S12 — untrusted agent/input | Cached tools and old assistant operations cannot promote forged `approved`/`principal` input into native suite writes in inspected paths. Persistent model machine-origin gap remains. Prompt/egress-wide coverage not claimed. |

## 8. False-positive log / positive controls

| Challenged hypothesis | Actual defense / limit |
| --- | --- |
| Forged `{ principal: { kind: 'human_session' }, approved: true }` authorizes suite writes | Controller derives the kind from request transport, native helper rejects api_token; `legacy.controller.ts:539,544`, `human-review-principal.ts:6–12`. Two independent probes pass final and fail old source. |
| Removing tools from discovery is the only protection | Both service dispatch and final registry handler reject; `mcp.service.ts:342–345`, `mcp.tools.ts:1982–1988`. All three direct raw-handler probes fail before collaborators. |
| Clone can create the parent suite before the case guard fires | clone is protected before any handler and its underlying create call explicitly carries api_token; `mcp.tools.ts:1165–1171,1982–1988`. Existing clone positive-refusal neighbor passes both pins. |
| Human callers silently lose omitted suite fields or cannot clear one | Existing COALESCE plus explicit parent-presence logic retained; `legacy.service.ts:4452–4459,4499–4505`. Human clear/root-move independent probe and author partial-edit unit pass. |
| The private insert seam allows machine Save to pretend to be human | `zyraSave` rejects missing/machine principal before access; exact revision and selected indices precede its private suite insertion; `legacy.service.ts:21357–21367,20918–20949`. No alternate production caller found. |
| The extracted helper silently drops proposal-specific role/storage policy | `requireProposalAuthority` still applies both after common current access; `legacy.service.ts:15654–15660`. Three reviewer refusal probes and valid legacy-role neighbor pass. |
| Model Studio acquires the unrelated Zyra testcaseStorage requirement | Native repository calls only current-project helper; `model-studio-repository.ts:306,394`. Reviewer native-helper probe succeeds with storage false; real positive candidate test explicitly uses that configuration but has not run here. |
| Candidate waits on the suite mutex after membership was checked | Repository now acquires both candidate and suite mutexes first; `model-studio-repository.ts:388–394`; native insertion reacquires the same transaction mutex at `legacy.service.ts:5339`. Real ordering proof remains CI. |
| An API token is relabeled as the actual human model reviewer | Model approve/candidates still use explicit principal checks at controller and repository; `model-studio-models.controller.ts:93–95,117–119`, repository `:269,343`. Provenance loss on other allowed writes remains SEC-NATIVE-03, not a fabricated approval bypass. |
| A failed suite lookup is treated as an absent suite | The catch-to-empty fallback is removed at `legacy.service.ts:18125–18128`; the expected lookup-failure unit leaves only a truthful error activity, without create effects. |

## 9. Side findings and handoff

**SF-01 retained — machine authority follows issuer's active workspace.** The extracted query deliberately preserves the former proposal predicate `u.active_organization_id=p.organization_id` (`legacy.service.ts:4043`). That is appropriate to the current human workspace owner and does not silently fix machine workspace identity: canonical implementation brief `:119` calls for machine workspace resolution from bound project. A valid machine proposal can therefore remain unavailable when its issuer changes active workspace. This is an inherited fail-closed compatibility gate, not a new escalation, and was not broadened into a new identity implementation here.

**SF-02 bounded authority coverage.** Broader model writes remain outside the new late-check calls: saveRevision `model-studio-repository.ts:221–249`, link `:467–519`, unlink `:534–547`, and dispatch `:567–578,732–778`. A source-reasoned in-flight revocation concern therefore remains for those entrances; it was not exercised against PostgreSQL and no external target execution is alleged. The owner must retain this inventory when implementing the broader action-policy/current-authority contract. Do not use this receipt's narrow SEC-NATIVE-02 disposition to close that larger obligation.

**Handoff:** await exact-source CI/build/runtime evidence for the two source repairs; preserve SEC-NATIVE-03 and the broader I3/operational gates. No live message, commit, publication, customer data or shared-database action was performed by this reviewer.

### Evidence fingerprints

All evidence files are under `/workspace/scratch/fb086055b433/assurance-working/`. SHA-256 values bind the actual captured files, not an asserted runtime environment.

| File | SHA-256 |
| --- | --- |
| `security-final-contract-probes.spec.ts` | `7b6898260dd08759bd43c968e42c3d73280de417427e4dc37a748547e07b1258` |
| `security-final-jest.config.cjs` | `f71ca2b281b5ac8f1fc8e21e427a697d4bb42d045b6ada8f48dfca1355a2c580` |
| `security-final-jest.log` | `0595627045d3de4a5f57161b325fa687c00b10dabb4cc8e5f086238504748cf2` |
| `security-final-jest-results.json` | `9f626f8f8bffd892f4da2e8c4fb7b1b243611eca493a68d052367ac0016510e1` |
| `security-final-before.log` | `61cad85df60a2ad0ae5e0a0072efcc62253b52e61de80b2c1b8cd40abe888f9e` |
| `security-final-before-results.json` | `205626d610736ca0d8eaf51bb47b721f6f00c13198829e05595a7563c2d56b72` |
| `security-authority-before.config.cjs` | `413e3d6a99db2c0b11550933e46e0cd70523f1c678eb35629970e57ae3e4253f` |
| `security-authority-before.log` | `c038b4d8e9a1b4d2392106d929edf3aa34775ac51cf5a527ff280c9151a4348a` |
| `security-authority-before-results.json` | `81340dab8f7e26552526de12b84d1b0773d09948c457fe0cf99079c507df0418` |

### Unchanged methodology fingerprints

| Supplied method input | SHA-256 |
| --- | --- |
| `.claude/agents/security-team.md` | `09d1d25d99e2fa3bd489c6aacabb33648b9e6d99f9b5b52f148fb30ddde1eb64` |
| `.kiro/steering/teams/review-orchestration.md` | `023a64168c5160a761b91e7496b8a35b89246baf7eda0ab62bac17a7fa44771e` |
| `.kiro/steering/guard-security-privacy.md` | `b4bd8cf0e05484f127035e1e3354c9c0d7a7f3d8d4610d94476c6ef0d0cd3f55` |
| `POL-GOVERNANCE-ASSURANCE-PORTABILITY/v001.md` | `33c69cba82f7d98773e85a30fa1afff15cc0dbcec0d88302a0295ce06e2c8524` |
| `POL-GOVERNANCE-ASSURANCE-EVIDENCE/v001.md` | `a6176c0c75342dfa6cbf66cf64e00b9a2940a47655f343e255b96f4fa58c5d52` |

## CI Addendum A — isolated PostgreSQL evidence received after source checkpoint

This addendum is a read-only review of a captured CI log, not a claim that the reviewer started a database or ran the tests locally. It supplements the source checkpoint without changing its independent probe results or substituting database evidence for transport/browser proof.

| Evidence binding | Independently checked fact |
| --- | --- |
| Published source | `9519b56d3441dfec3a107db95ca602665454f407` |
| Actual CI checkout | `0d510c59843210365810f446db0aa395a28011ca`, printed in `database.log:211–241` |
| Merge identity | Local Git object independently inspected: parents `6897f989b055a955280f810c7daace86f74057fa` and `9519b56d3441dfec3a107db95ca602665454f407`; tree `31b5e09247237c29ef3d215ab60147c7e4f13ba7` |
| Tree equivalence | `git diff 9519b56d 0d510c59` is empty; both complete trees are identical. This is stronger than assuming a PR head was the running build. |
| CI locator supplied with artifact | Behavioral run `44663468056`, database-integrity job `136047013966`; [run](https://github.com/1alextest/Tesbooboo/actions/runs/44663468056) / [job](https://github.com/1alextest/Tesbooboo/actions/runs/44663468056/job/136047013966) |
| Captured primary evidence | `/workspace/scratch/fb086055b433/tesbo-ci-evidence/9519b56d/database.log` |
| SHA-256 verified by reviewer | `3f9f447580eb93bdee6797b1b3a5d4d7527ea98f29987d68845dd927a0293f8c` |
| Environment evidence | The job creates `pgvector/pgvector:pg16` and uses the disposable `tesbo_ci` database (`database.log:130,498–520`). This is the authorized isolated CI binding, not the prohibited local/shared application database. |
| Migration proof | All 157 migrations applied, including V153–V157; immediate second migration reports schema up to date; integrity check passes (`database.log:490–513`). No rollback/mixed-version deployment is inferred. |
| Selected test execution | Unfiltered `--runTestsByPath` command names 17 database suites (`database.log:514–522`). `model-studio-runs.db.spec.ts` is explicitly PASS at `:557`. Summary at `:570–574`: **17 passed / 17 total suites; 609 passed / 609 total tests; 0 snapshots; 38.212 seconds.** No skipped count is hidden in that result. |

I rechecked the Model Studio suite's environment selector and parameterized cases. It runs only for the `tesbo_ci` database (`model-studio-runs.db.spec.ts:13,27`), which the captured job supplies. Its SEC-NATIVE-02 cases expand to six refusal scenarios (approval revision lock, candidate-digest mutex, candidate-suite mutex, each crossed with membership removal or project archive) plus two legitimate authority-held-through-commit cases (`:117–196`). None has a per-case skip or exclusion; the captured command has no test-name filter and all selected tests passed. The log does not print a separate line for each parameterized case, so this is proof from the exact checked-in test registration plus full suite execution, not fabricated per-case trace excerpts.

**Updated SEC-NATIVE-02 disposition: CLOSED for the scoped native approval/candidate authority-after-wait defect in this isolated PostgreSQL binding.** The source fix, discriminating old/final simulations, six real deny/unchanged-state scenarios and two real legitimate commit-order neighbors now support that bounded conclusion. The candidate positive case also verifies native publication while Zyra testcaseStorage is false. Organization-membership removal, active-workspace change, every other model/native writer, operational environments and future capability bindings do not gain separate verification from these eight cases.

**SEC-NATIVE-01 remains pending its one terminal integration closure artifact.** PostgreSQL source and owner tests are useful corroboration; the named real both-MCP-alias/REST suite refusal plus human/exact-Save journey has not yet been supplied as completed evidence. The driver identifies that pending smoke run as `44663468105`, job `136047014072`; this receipt does not mark it passed. SEC-NATIVE-03 and SF-01/SF-02 remain open with the original bounds. Sibling HTTP/concurrency results were not needed or credited for this addendum, and their separately reported skipped tests are not counted as passes.

The scoped advisory verdict remains **ACCEPTABLE-RISK with named gates**. This database addendum does not turn the source checkpoint into complete release acceptance, full system assurance, original I3 completion, operational S0 closure or current-UI validation.
