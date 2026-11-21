# Security team — bounded native Tesbo governance receipt

**Reviewer:** independent Security team invocation, S0 / S5 / S8 / S12. **Date:** 20 November 2026. **State:** review complete for the fixed source below; open findings and runtime obligations remain. This is an actual review receipt, not an author-authored team result, release approval, or specification freeze.

| Run context | Exact value |
| --- | --- |
| Target | 1alextest/Tesbooboo, intended integration into development |
| Reviewed source | 8707d56ac34c63bda3131bd51a0030059547fd9d |
| Reviewed tree | 36d2937d4006c86a641858bf670483dee1955609 |
| Comparison baseline | 288c89b36dd5e748621752a175f1f4bdaac7ec87 |
| Immutable checkout | /workspace/scratch/fb086055b433/tesbo-review-8707d56a |
| Canonical requirements | /workspace/scratch/fb086055b433/tesbo-canonical-inputs/extracted-v1.4.28/; eight existing 00–07 files, revision 1.4.28, NOT FROZEN |
| Historical application context | /workspace/scratch/fb086055b433/tesbo-canonical-inputs/creating a testing tool to make my job easier/Tesbo_Existing_Application_Baseline_v1.0.md |
| Authoritative methodology | Unchanged Security charter, review-orchestration, guard-security-privacy and portability policy under /workspace/scratch/fb086055b433/assurance-method-inputs |
| Mutations | No product source/test changes, dependency installations, local/shared DB access or mutations, deployed actions, external-client actions, credential use, or evidence uploads. Only scratch review/config/result artifacts were written. |

All source citations below resolve against this exact checkout. B = Tesbo-Backend-Nest; F = Tesbo-Frontend. The primary charter and target AGENTS/CLAUDE were read before source assessment. The trust model below was recorded before reading author or other-review conclusions. Historical audit statements in the supplied specifications/baseline were treated as contextual leads, never current proof. Relevant normative sections and actual source were read; this receipt does not claim a fresh line-by-line review of every historical section in all eight specifications.

## 1. Threat-model delta

The increment moves candidate case creation and model-derived Run creation into their native owners' transactions, adds explicit human-principal checks for model review/candidate publication, preserves historical execution snapshots, and prevents Bug linking from manufacturing a failed execution. The assets are exact official QA definitions and semantic dependencies, attributable human decisions, approved model/mapping/Run bases, reviewed knowledge, named MCP authority, original evidence, and retry/audit receipts. The main trust boundary remains whether machine authority, mutable source content, stale permission or an uncertain browser response can become an official human decision or asserted execution truth.

### Independent model and legitimate alternatives

The falsifiable invariants used in this review were:

- Project/organization membership and actual object ownership must govern each sensitive read and write; a supplied parent identifier cannot authorize a foreign child.
- A token, its human issuer, the machine actor, and the actual human reviewer are separate principals. Broad write scope is not an exact human publication decision.
- A human decision binds the complete reviewed revision and relevant dependencies; indirect edits and A→B→A changes must not resurrect stale authority.
- Selected publication validates the current base and explicit selection, and commits native effects, authoritative receipt and required audit together. Retry cannot broaden the selection or duplicate accepted effects.
- Model approval, accepted mappings, case approval, native Run preparation, and observed execution results are separate facts.
- Approved AI memory must match its exact same-document human-reviewed snapshot at consumption, including source context; stale indexes and move/retype/restore operations cannot inherit review authority.
- MCP consent intersects current token scope, current issuer access and a current named client grant, before discovery and calls.
- Bug association does not change an execution result; evidence must stay bound to its actual project, Run and execution.
- An unknown browser create result remains unknown and must not trigger an automatic repeat POST.

Legitimate alternatives deliberately retained: authorized human publication, readable but unapproved documents, historical evidence after source changes, machine draft staging, non-MCP REST compatibility, explicitly unrecorded legacy mapping bases, and absent runtime evidence. A named MCP grant is a real authorization control but is not an exact review of a future suite change. Conversely, draft model creation is not itself approval.

S8 was translated into QA workflow abuse, enumeration, provenance and false assurance. Nesberry payments, marketplace roles, no-AI-product-imagery rules and its code paths were not imported into Tesbo. The canonical original case-free external task → executor → original report → retest → exact human-selected publication loop remains a separately pending milestone; this receipt does not claim that loop is implemented.

## 2. Boundaries crossed

| Boundary | Authorization/consistency decision | Actual owner and source | Fails closed? |
| --- | --- | --- | --- |
| Presented bearer versus browser identity | Explicit bearer is authoritative; invalid bearer does not borrow a cookie session | B/src/auth/auth.middleware.ts:16–43; B/src/common/request.types.ts:4–9 | Yes by source; covered mocked tests |
| Token → project REST | Project binding, read/write ceiling, control-plane denial, protected case writer denial | B/src/auth/api-token-rest.guard.ts:23–65; B/src/common/testcase-publication.policy.ts:31–57 | Partial: F1 suite-create omission |
| Token → named MCP client | Current membership, authoritative token row/scopes, project opt-in, client token binding, expiry, allowlist | B/src/mcp/mcp.service.ts:177–215; B/src/mcp/mcp.controller.ts:86–140; B/src/mcp/mcp-access.ts:59–75 | Yes at request admission by source; DB/runtime and in-flight revocation unproven |
| Machine → native official case/suite mutation | Protected publisher classification plus native authoring | B/src/common/testcase-publication.policy.ts:1–27; B/src/mcp/mcp.service.ts:342–367; B/src/mcp/mcp.tools.ts:1034–1086 | No for suite create/update: F1 |
| Machine → human model decision | Explicit principal required at native approval/candidate owner | B/src/common/human-review-principal.ts:3–12; B/src/behavior-graph/model-studio-models.controller.ts:85–119; B/src/behavior-graph/model-studio-repository.ts:261–281,334–350 | Yes for machine principal rejection; current membership after waiting is F2 |
| Machine → persistent model provenance | Propagate token/machine origin separately from issuer | B/src/mcp/mcp.service.ts:369–380 versus B/src/mcp/mcp.tools.ts:290–295,316–320,354–366,434–447 | No: F3 |
| Case approval → Run admission | Human receipt must match exact current semantic snapshot | B/src/legacy/legacy.service.ts:1846–1937; B/src/legacy/approved-run-cases.policy.ts:24–55; B/migrations/V155_testcase_review_semantics.sql:3–116 | Yes by source; actual PostgreSQL trigger/lock proof pending |
| Machine proposal → selected human save | Bound principal, scope, exact proposal and target revisions, current authority, selected transaction and durable receipt | B/src/legacy/legacy.service.ts:15543–15627,15636–15646,20868–20983,21337 onward; B/migrations/V157_native_testcase_proposal_review.sql | Yes for inspected selected path by source, default preview OFF; runtime pending |
| Approved model → native Run | Current head/hash, active model, current cases/mapping bases, native Run + manifest in one transaction | B/src/behavior-graph/model-studio-repository.ts:562–780; B/src/legacy/legacy.service.ts:6997–7020 | Stronger atomicity/current-basis controls; permission recheck gap and runtime obligations remain |
| Document edit/review → AI context | Same-document human-approved immutable snapshot matching current body/source metadata; current ANN content hash | B/src/legacy/knowledge-document-revision.ts:20–39; B/src/legacy/legacy.service.ts:12156–12294,13161–13394; B/src/rag/rag-retrieval.service.ts:270–280,320–334; B/migrations/V156_knowledge_governed_snapshots.sql | Yes for governed ai_memory by source; general KB retains existing independent retrieval policy |
| Bug association → result/evidence | Lock actual project/case/Run/execution relations; association has no result side effect; scoped evidence lookup | B/src/legacy/legacy.service.ts:8353–8474,8580–8649,9307–9367,9541–9556,9699–9733 | Yes for inspected routes by source; live bytes/transport proof pending |
| Browser create → reconnect/retry | Persist scoped intent before POST, one attempt, retain unknown outcome, reconcile read-only, explicit separately acknowledged new request | F/lib/api.ts:5129–5150; F/components/model-studio/model-run-intent.ts:20–50; F/app/(app)/projects/[id]/model-studio/page.tsx:438–570,987–1041 | Yes in source and 12 pure production-module tests; rendered browser/cross-tab execution pending |

The listed “yes” results are evidence-level statements, not claims that migrations or deployed controls have been exercised.

## 3. Findings

| ID / lens | Severity / confidence | Evidence | Prerequisites and bounded blast radius | Violated invariant | Required mitigation |
| --- | --- | --- | --- | --- | --- |
| SEC-NATIVE-01 — policy implementation drift: machine suite writers bypass protected publication classification. S0/S5/S12 | **HIGH / HIGH** | Source-read plus executed policy-function check. B/src/common/testcase-publication.policy.ts:1–6,17–27,34–56; B/src/mcp/mcp.tools.ts:1034–1086; B/src/mcp/mcp.service.ts:335–384; B/src/legacy/legacy.controller.ts:537–544; B/src/legacy/legacy.service.ts:4457–4490 | A current project write token; for MCP, enabled project and named grant permitting the tool; writable project. It can change official suite hierarchy, descriptions and preconditions inside its authorized project without an exact human review. No foreign-project access, case-body overwrite, execution outcome forgery or approval-receipt forgery is established by this finding. | The implementation expressly says machine credentials cannot publish official case dependencies, and that suite/dependency changes require native human editing. Yet the suite tools bypass that branch and call immediate native INSERT/UPDATE writers. | Classify actual suite create/update/move/description/preconditions operations consistently at all machine adapters and at the native owner using explicit principal; preserve legitimate human editing and transaction-internal reviewed suite creation. Prove no mutation on refusal and the human positive path. |
| SEC-NATIVE-02 — model review/candidate authority can become stale during its transaction wait. S0/S5 | **MEDIUM / HIGH for missing final check; MEDIUM for unexecuted race impact** | Source-read and reasoned concurrency trace. B/src/behavior-graph/model-studio-repository.ts:33–46,269–311,342–350,410–421; contrast B/src/legacy/legacy.service.ts:13188–13202 and15636–15646 | A human is authorized at preflight, submits an exact valid review/candidate request, then loses membership or the project is archived while waiting for the transaction/model lock. The account must remain a valid user for the existing FK. One in-flight request can still approve a model revision or publish its selected Draft cases after access was removed. No permanent ability to initiate new authorized requests is claimed. | A protected native decision must use current authority at its serialization/commit boundary, not just an earlier membership check. Model locks serialize model state but do not lock/re-read project membership or project lifecycle. | Reuse a native transaction-bound current-project/organization/member capability check after the relevant wait and retain its protection through commit. Define lock order consistently. Do not infer a new review role from the separate proposed MBT role-binding contract. |
| SEC-NATIVE-03 — model writes erase machine origin and retain only the human issuer. S5/S8/S12 | **MEDIUM / HIGH** | Source-read. B/src/mcp/mcp.service.ts:369–380 supplies tokenId/actorId/userId; B/src/mcp/mcp.tools.ts:290–295,316–320,354–366,434–447 passes only userId; B/src/behavior-graph/model-studio-repository.ts:114–130,221–251,462–532,759–775; B/migrations/V148_model_studio_revisions.sql:6–52; V154_model_studio_governed_runs.sql:15–29 | A valid authorized model-write client. Its model/revision/mapping/Run provenance is attributed to the issuer user without persistent machine/token origin in these native records. The affected scope is its project and subsequent audit/incident interpretation. The explicit model approval principal guard still prevents a token from directly becoming a human reviewer. | Persisted agent content and actions must remain distinguishable from human actions; knowing an issuer is not knowing which principal acted. | Carry a typed effective principal through native model writers and persist machine/token/client origin separately from issuer and actual human reviewer in existing native provenance/audit structures. Do not invent human attribution for historical rows; mark unknown origin honestly. |

### SEC-NATIVE-01 exact route and policy classification

This is not a claim that every suite HTTP alias is bypassable:

| Entry point | Pinned behavior |
| --- | --- |
| MCP create_suite | Write tool, not in DIRECT_TESTCASE_PUBLISHERS; directly invokes createSuite at mcp.tools.ts:1050–1052. |
| MCP update_suite | Write tool, not in the set; same-project check at1078 then updateSuite at1079–1085. The ownership check is a positive control but does not supply a human publication decision. |
| POST /api/projects/:projectId/suites | Registered at legacy.controller.ts:537–539; project-bound REST guard sees a write token but its protected-write matcher has no suite-create route. Reaches createSuiteForUser. |
| PATCH /api/suites/:suiteId | Registered at542–544. **Already denied to machine tokens** by ApiTokenRestGuard:37–39 because it is not a project-prefixed REST route. No PATCH bypass is alleged. |
| DELETE /api/suites/:suiteId | Explicit human-publication refusal at ApiTokenRestGuard:31–34; no deletion bypass alleged. |

The primary current source policy is the comment and refusal contract in testcase-publication.policy.ts:1–27. It is corroborated by canonical 00_README.md:27 (P-07 exact human approval and atomic selected publication), its explicit no-automatic-publication clarification at411, and 06_IMPLEMENTATION_AGENT_BRIEF.md:50–68 (all protected writers, including suite move/delete) and74 (no unreviewed suite creation/relocation), plus 01_PRODUCT_REQUIREMENTS.md FR-032/FR-033 at91–92. V157's suite dependency trigger at72–73 changes pending proposal review revisions, but it neither prevents the direct suite mutation nor supplies a human decision. V155's case approval snapshot at21–39 does not snapshot the suite row; therefore this receipt does not claim that the existing case approval digest itself detects changed suite text.

Severity is HIGH because this bypasses the express integrity boundary for official QA instructions/dependencies available to an external machine. It is bounded to an already authorized writable project, rather than an unauthenticated or cross-tenant compromise. The omission predates this comparison baseline; the reviewed increment strengthens nearby boundaries but does not close this residual path.

### Proposed-contract versus current-contract limit

Canonical 01_PRODUCT_REQUIREMENTS.md:680–701 proposes a broader MBT action/capability binding, independent-review default, and exact human grants. That section expressly requires ratification/mapping to actual native policy. This receipt does **not** turn every project member's model approval into a demonstrated role-escalation defect, assume a second reviewer is already mandatory, or equate creation of a native Test Run with an external target action. The actual current human guard and exact content-hash checks are positive controls. Final role/action policy mapping, per-attempt external consent and full historical model governance remain named acceptance gaps; they are not silently declared complete by these source improvements.

SEC-NATIVE-02 concerns freshness of the authority that the implementation itself already requires. It is separate from that proposed role policy. Its membership-after-wait path is not yet a reproduced PostgreSQL race; owner deletion/archival and transaction serialization must be exercised in isolation before declaring it closed. SEC-NATIVE-03 also predates the comparison baseline and remains relevant to the requested native governance/identity review. Its broader installation-identity contract must be tracked separately; this receipt does not authorize a new identity schema. The bounded review/candidate freshness repair can extend the existing locked native authority helper without choosing a new role policy.

## 4. Attack chains

One bounded workflow chain is established by source: a valid named MCP write grant → an untrusted or compromised client selects update_suite → the generic publication classifier permits it → the native owner immediately changes official suite text/hierarchy. Same-project authorization and plan writability constrain the chain but do not provide the required exact human action. This is SEC-NATIVE-01's integrity impact, not a new greater-severity finding.

The model permission race can similarly leave an accepted model approval after its requester's membership was removed, which a still-authorized actor could later rely on. The latter reliance is plausible from source, not a separately reproduced exploit or a claim that the removed actor can make further calls.

No supported composition to cross-project disclosure, arbitrary code execution, credential extraction, or fabricated Passed/Failed execution was established in this bounded review. No exploit was run against a live application, target or database.

## 5. Closure plan and executed evidence

### Open closure owners

SEC-NATIVE-01 has exactly one required terminal closure artifact: **SEC-NATIVE-01-IT, an integration regression in the existing authorization/MCP test suite on a real isolated boot**. Exercise both MCP aliases and the real REST suite-create route using a named authorized write token; assert refusal plus unchanged suite rows/preconditions/parent and no publication effect; pair with a successful authorized human suite edit and reviewed transaction-internal suite creation. This is a required future test after the principal-aware owner fix. It was not executed here and does not close the finding merely by being planned. No risk acceptance was supplied.

SEC-NATIVE-02 remains open for a real PostgreSQL barrier test: authorize and queue model approval/candidate publication, commit membership removal or project archive before releasing the blocking lock, then require denial and zero approval/generated-case effects. Pair with the still-authorized path; verify lock order and one atomic rollback. Proposed owner: native ModelStudioRepository/current access owner.

SEC-NATIVE-03 remains open for an existing-suite provenance assertion through both REST bearer and MCP transports: a permitted machine draft/revision/mapping/Run must persist actual principal kind and machine origin, issuer separately, and no fabricated human reviewer. Pair with a human path. Historical unknown actor rows require explicit treatment. Proposed owner: native model owner and existing identity/audit owners. This is a broader tracked provenance/installation-identity gate, not authorization to create a new identity schema or expand this bounded repair. A repair author can document and retain the gate while fixing the already-defined suite and locked-authority boundaries.

### Checks actually executed

| Check | Result and limit |
| --- | --- |
| git rev-parse and clean worktree check | Exact HEAD/tree above confirmed; product checkout remained clean. |
| Baseline comparison and native source/migration inspection | Reviewed changed native paths and material inherited security owners; no package/package-lock or migration delta between the supplied baseline and reviewed HEAD. V148 and V153–V157 were nevertheless inspected as relied-on schema owners. No migrations applied. |
| Selected backend Jest run | **8/8 suites, 354/354 tests passed, 0 failed, 0 snapshots; 11.024 seconds.** Native source compiled by ts-jest with diagnostics false / isolatedModules true using already-installed dependencies outside this checkout. These are mocked unit tests, not typecheck, database integration, browser or HTTP deployment evidence. |
| Existing production-module browser-recovery tests | **12/12 passed, 0 failed**, node test, 3.157 seconds. Loads actual TypeScript intent/API modules; only HTTP/storage supplied by tests. This is not a rendered browser run. |
| Direct executable publication-policy check | update_testcase=true, create_suite=false, update_suite=false for isDirectTestcasePublisher; POST /testcases=true and POST /suites=false for isProtectedTestcaseRestWrite; preview flag defaults false. Confirms classification omission only; no request or DB write performed. |
| Dependency source inspection | Lockfile resolves Nest common/core10.4.22, pg8.21.0, TypeScript5.9.3, Jest29.7.0, ts-jest29.4.11. No dependency changes in compared delta. No package vulnerability/security-advisory audit performed or claimed. |

Backend suites actually run:

| Existing suite | Passed checks |
| --- | ---: |
| src/mcp/mcp.service.spec.ts | 152 |
| src/mcp/mcp-publication.spec.ts | 45 |
| src/behavior-graph/model-studio-runs.spec.ts | 12 |
| src/legacy/testcase-proposal-review.spec.ts | 20 |
| src/auth/api-token-rest.guard.spec.ts | 77 |
| src/legacy/bug-link-finalization.spec.ts | 35 |
| src/legacy/testcase-approval.spec.ts | 10 |
| src/legacy/knowledge-document-governance.spec.ts | 3 |

Reproduction commands:

    node /workspace/scratch/fb086055b433/Tesbooboo/Tesbo-Backend-Nest/node_modules/jest/bin/jest.js --config /workspace/scratch/fb086055b433/assurance-working/security-jest.config.cjs --runInBand --json --outputFile /workspace/scratch/fb086055b433/assurance-working/security-jest-results.json

From the immutable checkout:

    NODE_PATH=/workspace/scratch/fb086055b433/Tesbooboo/Tesbo-Frontend/node_modules node --test scripts/model-run-recovery.test.mjs

The temporary Jest configuration points rootDir/roots/tsconfig to the immutable source and modulePaths/ts-jest to the already installed backend dependencies. It selects only the eight named files; no repository test was edited or weakened. The ts-jest isolatedModules deprecation warning was tooling output, not an application failure. JSON results and temporary config remain beside this receipt.

## 6. Residual risks and coverage gaps

The source repairs and passing simulations do not discharge the following obligations:

1. **Real PostgreSQL behavior:** migration replay/backfill, immutable-version/receipt triggers, exact review digest SQL, row/advisory lock order, ABA dependencies, mixed valid/invalid selections, concurrent model edit/archive/mapping removal, membership/grant revocation, actual rollback after audit/native writer/manifest failure, and repeat-key behavior. Existing SQL and mocked tests support design plausibility; isolated CI must prove actual execution.
2. **Actual transport enforcement:** both MCP paths, cached sessions, named grant expiry/revocation, token revocation and issuer removal, foreign object versus missing object response parity, scope widening attempts, mixed cookie/bearer and reverse-proxy behavior. No live token, client registration or request was used here.
3. **Browser behavior:** rendered unknown-outcome recovery after navigation/reload, principal/project switch, concurrent tabs, corrupt/unavailable storage, matching-but-distinct Runs, first response lost after commit, and deliberate separate-create acknowledgement. Pure tests prove one POST for tested API failures, not a transactional browser-wide deduplication guarantee. There is no server operation receipt attached to the local intent.
4. **Knowledge/untrusted-input plane:** inspected governed-memory predicates, document writes, source snapshots, ANN/FTS and named-folder retrieval. Did not exhaust every importer/provider/background job, rendering sanitizer, prompt construction, egress/DLP/budget boundary, or all stale-worker races. General KB/file retrieval intentionally remains outside ai_memory review gating. A reviewed memory document is not proof its text is safe to treat as instructions.
5. **Evidence plane:** inspected Bug-link identity/atomicity and Bug/execution download access. Did not verify physical bytes, file type enforcement across all upload routes, signed-URL expiry/revocation, report-chunk completeness, storage finalize/cleanup races, trace-link redemption, or external report identity. The future immutable case-free report/attempt contract is not supplied by a mutable KB document or a Bug link.
6. **Compatibility/rollback:** no old/new mixed deployment or rollback exercise; no proof migrations are deployed; no destructive downgrade attempted. Dependency snapshots and tests do not prove production configuration or deployment parity.
7. **Governance policy gaps:** future MBT role/action bindings, independent reviewer default, exact per-attempt external grants, stable logical operation IDs across proposal revisions, full protected-writer inventory, and original external round trip are not certified complete. This is a bounded native integration review, not full platform acceptance.
8. **Methodology coverage:** unchanged provided methodology was used. The charter's referenced Critical Preflight/vocabulary/spec-standard resources were not present in the supplied methodology tree (filename search returned none); this is a named input gap, not a waiver. Nesberry-specific delegated mechanisms are nonportable; the principles were checked against native Tesbo owners instead.

### Lens coverage

| Lens | What was examined | Result / limit |
| --- | --- | --- |
| S0 trust model | Native authoritative owners, full selected transaction, schema identity, indirect suite boundary, old/new state, retry and rollback claims | SEC-NATIVE-01; positive controls below; DB runtime open |
| S5 identity and authority | Presented bearer, issuer versus actual human, REST/MCP scope, named client, membership after wait, same-project links/evidence | SEC-NATIVE-02/03; no credentials accessed; deploy/session proof open |
| S8 workflow abuse and false assurance | Bug link side effects, approval versus execution truth, mappings versus coverage, duplicate/unknown run creation, opaque foreign targets | No additional confirmed finding in inspected paths; positive controls and explicitly unexecuted cases below |
| S12 untrusted agent/data | Machine writers, reviewed AI memory, stale context indexes, source metadata, actor provenance | SEC-NATIVE-01/03; full prompt/egress/rendering audit outside this bounded receipt |

## 7. Scoped verdict

**RELEASE-BLOCK for claiming or enabling a complete protected machine-publication boundary at this source.** SEC-NATIVE-01 remains reachable with no implemented and verified mitigation on the reviewed pin. SEC-NATIVE-02 and SEC-NATIVE-03 are open; their severity is not inflated into an unauthenticated or cross-tenant compromise.

This is the Security team's advisory verdict for the stated boundary, not authority over CI, a blanket rejection of every improvement, or proof of a deployed exploit. A red required check still wins. Neither this source review nor the 366 passing unit/module checks supports release/freeze, migration success, actual-client compatibility or completion of the original external QA round trip. Remediation on another commit requires a fresh exact-source delta receipt; this receipt deliberately does not chase a moving author branch.

## 8. False-positive log and positive controls

| Attack hypothesis challenged | Counterevidence in actual source | Bounded disposition |
| --- | --- | --- |
| An invalid bearer can use an accompanying human cookie | auth.middleware.ts:16–43 clears identity and treats bearer as authoritative | Prevented by source; token guard suites passed |
| A read token mutates ordinary REST or mints stronger credentials | api-token-rest.guard.ts:37–64 enforces bound project, read/write ceiling and human-only control plane; api-token.service.ts:38–49 rejects invalid/empty scopes | Prevented in inspected boundaries; do not call legacy non-MCP access an MCP-consent bypass |
| An enabled project or old MCP session bypasses a missing/revoked named grant | mcp-access.ts:59–63 defaults OFF; mcp.service.ts:177–215 loads current token/settings/member/grant and intersects permission; controller authorizes before RPC/session use | Strong current-request control; actual concurrency/transport still unexecuted |
| A machine directly approves a case/model/AI-memory document | explicit human principal at common/human-review-principal.ts:3–12; model controller:93–95,117–119 and repository:269,342; legacy.service.ts:1846 onward,13355 onward | Guarded at inspected native decision owners; actual reviewer identity is separate from token issuer |
| Exact model hash alone is sufficient after model archive/head change | model-studio-repository.ts:281–305,580–604 locks active parent, reads current head and approval hash | Prevents the examined archive/head stale basis by source; DB lock proof pending |
| Generated case or native Run commits before provenance and cannot roll back | model-studio-repository.ts:410–421 passes the same transaction client to native case creation;728–775 composes native Run, cases and manifest in the outer transaction; DatabaseService:73–97 rolls back on failure | Previous compensating-delete pattern is removed; no claim that simulated failure proves real PostgreSQL atomicity |
| A stale/deleted/unapproved case enters a governed Run or mapping removal rewrites history | model-studio-repository.ts:610–714 locks mappings and current cases and checks current basis; approved-run-cases.policy.ts:24–55 rechecks exact current human approval; manifest preserves relied-on mappings759–775 | Source controls defend current admission and historical reliance; explicitly UNRECORDED legacy mapping remains labeled, not asserted current |
| Approval can survive indirect custom field/tag edits or A→B→A content | V155:44–100 locks affected cases, increments semantic revision and demotes Approved on reviewed changes; approval digest includes definition dependencies21–39 | Positive mechanism; suite row exception is explicitly separated in F1 |
| Changed proposal or selection silently reuses an earlier save decision | testcase-proposal-review.ts:8–37 validates digest/selection; V157 snapshot and dependency revision; legacy.service.ts:20868–20983 locks current proposal/targets, recomputes digest and decision key, records receipt and native effects together | Inspected path fails on stale reviewed base and retains unselected work; future stable operation identity is still a broader acceptance gap |
| Machine staging secretly publishes native cases or consumes approval | legacy.service.ts:15543–15627 is preview gated, binds producer/principal and stores proposal, with current token and MCP grant recheck inside transaction15588–15595 | Default OFF and draft staging only; legitimate staging retained |
| A document status flag or another document's version becomes governing memory | knowledge-document-revision.ts:20–39 requires same document ID/version, human actor, exact body/title/source metadata; legacy.service.ts:13355–13394 checks human reviewer and exact revision | Prevented in inspected memory admission; general KB readable content intentionally independent |
| Stale ANN content bypasses an edited/moved/restored memory review | shared predicate includes current text chunk hash; rag-retrieval.service.ts:270–280,320–334; V156 demotes on semantic/source changes; immutable governed versions protected | Positive source controls; indexing/provider races require live DB tests |
| Draft or foreign Bug association causes Failed result or discloses foreign execution | legacy.service.ts:8353–8354 removes status coupling;8400–8474 resolves actual consistent relation with locks and generic refusal;8580–8649 and9307–9367 commit relation changes atomically | Inspected mutation no longer manufactures a failure; inherited execution evidence remains independent |
| An attachment ID alone authorizes evidence download | legacy.service.ts:9541–9556 checks project and attachment scope;9699–9714 checks actual Run/execution and attachment entity/project;9727–9733 restricts inline formats | Source-level defense; full storage/trace lifetime not covered |
| Network loss causes automatic repeat model-run POST | F/lib/api.ts:5129–5150 classifies uncertain outcomes; intent owner scopes durable marker; page:438–570 persists before submit, reconciles read-only and requires explicit new request acknowledgement | 12 production-module tests passed including seven uncertain outcome classes; no rendered browser claim |
| A mapping, approved model or native Run result is automatically verified behavior | model-studio-repository.ts:15–27,71–97 separates expected/observed/runtime authority; MCP coverage tool:373–375 says coverageAssertion none | Truth boundary retained in inspected projection; no claim of target execution |

## 9. Side findings and handoff

**SF-01 — machine proposal availability follows issuer's active workspace.** B/src/legacy/legacy.service.ts:15636–15640 requires users.active_organization_id = project.organization_id in the shared proposal-authority check. The machine staging path calls this owner as the issuer. Consequently a legitimate project-bound machine can be denied when its human issuer changes active workspace, although its token/project membership/grant remain valid. This is a fail-closed availability/compatibility concern, not an escalation; canonical 06_IMPLEMENTATION_AGENT_BRIEF.md:119 says machine workspace resolves from the bound project rather than issuer preference. It should be reconciled by the native identity owner without relaxing human review checks. Not fixed here.

No other security-adjacent issue is promoted from insufficient evidence. UI product redesign, complete report lifecycle, commercial policy and future delegated execution remain outside this review's implementation claim.

### Methodology integrity fingerprints

| Unchanged input | SHA-256 observed |
| --- | --- |
| .claude/agents/security-team.md | 09d1d25d99e2fa3bd489c6aacabb33648b9e6d99f9b5b52f148fb30ddde1eb64 |
| .kiro/steering/teams/review-orchestration.md | 023a64168c5160a761b91e7496b8a35b89246baf7eda0ab62bac17a7fa44771e |
| .kiro/steering/guard-security-privacy.md | b4bd8cf0e05484f127035e1e3354c9c0d7a7f3d8d4610d94476c6ef0d0cd3f55 |
| docs/policies/governance/POL-GOVERNANCE-ASSURANCE-PORTABILITY/v001.md | 33c69cba82f7d98773e85a30fa1afff15cc0dbcec0d88302a0295ce06e2c8524 |

**Handoff:** all three findings remain OPEN on 8707d56a. The next required evidence is the owner fix/delta plus isolated integration/DB/browser receipts. This review neither modifies methodology nor imports Nesberry product changes, and makes no change to the canonical eight specifications or living application baseline.
