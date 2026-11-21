# Independent Security — native transport closure and scanner exception delta

## 1. Threat-model delta

The completed isolated CI run supplies the previously missing real transport evidence for machine-to-official-suite publication: both MCP aliases and bearer REST refuse writes while legitimate native human editing and exact selected Save still succeed. The newer scanner configuration changes a separate assurance boundary by suppressing a class of secret findings without expressing the review-file scope promised in its comments. Model persistence still records the credential issuer without preserving the acting machine identity, so neither the transport pass nor the scanner correction closes the broader attribution or action-bound human-assent gate.

### Run context and independence

This reviewer did not author the product repair. The work was limited to immutable source inspection, read-only captured CI evidence, local file/Git/hash inspection and official Gitleaks documentation/source. No product, method, canonical specification, database, service, API, browser or deployed environment was modified or started by this reviewer. No local Gitleaks execution or new full-suite execution is claimed.

| Binding | Verified or explicitly limited identity |
| --- | --- |
| Target | 1alextest/Tesbooboo, bounded native-governance increment associated with PR #167 |
| Product source | 965a87a13d2669354598f8d4b912f36fdb148867 |
| Immutable inspected checkout | /workspace/scratch/fb086055b433/tesbo-review-965a87a1; clean when checked |
| Product tree | b3c497bdb7a43cd43e8d0535f663c542cba88186 |
| Actual CI checkout | e49fab4df4043b621b7007e97d8646743f441b6b, printed in smoke.log:297–327 and database.log:209–239 |
| Merge parents and equivalence | 6897f989b055a955280f810c7daace86f74057fa plus source965; Git confirms identical complete tree b3c497bdb7a43cd43e8d0535f663c542cba88186 |
| Scanner delta independently inspected | 62f66ad3c438a27a6407efd73a7836e7768eb5df; tree 82ea6a4f96ca01c0f416529b944429e146cb8597; parent source965 |
| Scanner delta extent | Exactly .gitleaks.toml and .github/workflows/free-repository-security.yml; no product change in this delta |
| Method | Supplied unchanged Nesberry Security charter and orchestration pinned by the review package to d83549c85a4dcd047fb40dc4fba4ec62737ab0fc; applicable portability policy and security/privacy guard |
| Prior receipt | assurance-working/security-native-final-delta.md; SHA-256 441a3a37ef678da8db43670b24e7ed2af97f9bd304df8841125f390d6bba3640 |
| Outcome assessed | Bounded implementation verification plus source review of the new scanner exception; not release readiness |

The four Security lenses are applied to Tesbo's actual project members, human sessions, project credentials, proposals, suite/case/model/Run owners and CI secret-scanning control. Nesberry marketplace roles, commercial policies and operating assumptions are not imported. The supplied method package still lacks Critical Preflight and shared-vocabulary files; their content has not been invented or waived. Product AGENTS/CLAUDE guidance and canonical v1.4.28 P-07 human-controlled publication, P-08 source-backed truth, P-11 service-side defense and P-13 proof before promises are the target authority. Prior receipt dispositions are leads that were rechecked against current source and actual evidence; old unit executions have not been relabeled as new runs.

All B/ references below mean Tesbo-Backend-Nest/ in source965 unless explicitly labeled scanner62. All log references mean tesbo-ci-evidence/965a87a1/.

## 2. Boundaries crossed

| Boundary | Authorization or assurance decision | Source opened this review | Fails closed? |
| --- | --- | --- | --- |
| Project bearer REST → official suite creation | Shared protected-write policy rejects the publication before handler use | B/src/common/testcase-publication.policy.ts:31–46; B/src/auth/api-token-rest.guard.ts:23–65 | Yes for the named POST route, observed by real CI |
| Both MCP aliases → create_suite/update_suite | Shared dispatch rejects direct publishers; final tool wrapper also rejects cached/direct handler use | B/src/common/testcase-publication.policy.ts:2–6; B/src/mcp/mcp.service.ts:339–345; B/src/mcp/mcp.tools.ts:1982–1988 | Yes for the four exercised calls, observed by real CI |
| Transport identity → native suite owner | Controller supplies transport-derived principal; native create/update require human_session | B/src/legacy/legacy.controller.ts:537–544; B/src/common/human-review-principal.ts:3–12; B/src/legacy/legacy.service.ts:4467–4496 | Yes for missing/machine principal in source; transport integration confirms relevant use |
| Exact selected proposal Save → private suite insertion | Human principal and revision/selection validation precede transaction-internal insertion | B/src/legacy/legacy.service.ts:20912–20947,21357–21367 | Yes for the exercised reviewed Save; not proof of all future dependency operations |
| Authorized model request → wait → final authority | Six refusal and two commit-order tests exercise actual PostgreSQL barriers | B/src/behavior-graph/model-studio-runs.db.spec.ts:118–197 | Yes for the existing eight approval/candidate scenarios |
| MCP actor/token context → model persistence | Context contains tokenId/actorId, but adapters pass issuer userId and persistence uses created_by | B/src/mcp/mcp.service.ts:366–380; B/src/mcp/mcp.tools.ts:290–321,354–365; B/src/behavior-graph/model-studio-repository.ts:117–132,224–250,517–522,782–795 | No complete machine-origin preservation; SEC-NATIVE-03 remains open |
| Retained receipt → secret-scanner exception | Scanner62 promises review-path scope but expresses a global match-only exception | scanner62 .gitleaks.toml:1–14; .github/workflows/free-repository-security.yml:33–38 | No for the promised exception boundary; SEC-NATIVE-04 |

A human_session is an authenticated transport kind. This receipt does not equate possession or automation of such a session with independently observed human assent to every protected action.

## 3. Findings and prior-finding disposition

| ID / lens | Severity / confidence | Evidence, prerequisites and blast radius | Invariant and required disposition |
| --- | --- | --- | --- |
| SEC-NATIVE-01 — S0/S5/S12 suite publication | Previous HIGH; HIGH confidence in bounded closure | Source-read owners above plus observed isolated CI regression. Requires otherwise valid project write credentials; affected assets were official suite hierarchy/text and downstream case context in that project. | CLOSED for the named native defect at the actual source965/tree-equivalent CI build. The single terminal transport test passed with refused effects and legitimate neighbors. Preserve the regression; do not generalize to every publication action. |
| SEC-NATIVE-04 — S5 scanner exception has repository-wide scope | MEDIUM / HIGH; OPEN pending correction and scanner-level discrimination | Source-read scanner62 .gitleaks.toml:11–14. Exploitation requires a committed value that both a default detector and the global file-path-to-64hex exception match. Suppression can occur outside the intended receipts. No actual leaked credential or successful attacker commit was established. | An exception for reviewed integrity maps must not suppress a matching finding in an unrelated file or rule. Restrict to the exact reviewed paths, generic-api-key rule and verified hash mappings, combine criteria with AND, retain all default rules, and execute the control matrix below through the actual scanner. |
| SEC-NATIVE-03 — S5/S12 machine-origin loss | MEDIUM / HIGH; OPEN | Source-read current adapters, repository and migrations V148:6–52 / V154:15–29. A valid allowed model-write client suffices; the loss affects attribution of its model/revision/mapping/Run history. | Persisted agent-origin activity must remain distinguishable from human action. Existing created_by issuer fields and a separate human review guard do not satisfy this. Native model and identity/audit owners must propagate typed principal/client/token/actor provenance and verify real human and MCP persistence. No historical origin is inferred. |
| SEC-NATIVE-02 — S0/S5 stale approval/candidate authority | Previous MEDIUM; HIGH confidence in bounded retained closure | Current registration of six revoke/archive refusal cases plus two authorized commit-order cases, and full real-DB suite execution on source965. | CLOSED for those eight named approval/candidate scenarios. Organization/workspace variants and every other model writer remain outside that closure. |

No new unmitigated HIGH or CRITICAL defect was established by this bounded delta. No accepted residual risk is inferred from user authorization to continue work.

### Four-lens coverage

| Lens | Applicable check and result |
| --- | --- |
| S0 — trust boundaries | Real transport refusals and exact human Save support SEC-NATIVE-01 closure. Existing real lock scenarios preserve bounded SEC-NATIVE-02 closure. This is not the separately owned operational S0 gate. |
| S5 — identity, secrets and scope | Machine credentials remain distinct from human review transport. Scanner exception scope is a new confirmed configuration finding. Issuer-only native model attribution remains open. |
| S8 — abuse / false assurance in Tesbo's workflow | The checked machine path cannot silently mutate official suite/case/audit state; valid review still creates a Draft. The red aggregate MCP job remains red. No financial/marketplace policy is imported. |
| S12 — agents and untrusted input | Forged body principal and approved flags do not authorize the exercised calls. Tool discovery hiding is supported by actual dispatch/native enforcement. Broad prompt injection, provider egress and every agent action were not re-audited. |

## 4. Attack chains

The prior project-write credential → cached create_suite/update_suite → official suite change chain now stops at the shared MCP classifier, with the native human-principal boundary behind it. The real regression observes unchanged complete project suite/case/audit snapshots after each of four machine MCP requests and the REST refusal.

The remaining provenance chain is allowed machine model write → issuer-only created_by persistence → later readers cannot distinguish acting machine from human issuer. This does not establish human-approval forgery.

The scanner exception could compose with a committed secret expressed in the excepted shape outside the receipt directory to suppress an otherwise applicable default finding. The current evidence establishes excess suppression scope, not actual secret exposure or a proved higher-severity chain. No cross-project disclosure, arbitrary target execution or forged Passed/Failed execution result was established here.

## 5. Closure plan and evidence actually inspected

### SEC-NATIVE-01 terminal artifact

The full test e2e/api/mcp.spec.ts:5302–5393 was opened at source965. It requires the authorized disposable fixture, logs in a native human owner and uses a separate machine context with empty cookies. The issued named project credential has read/write scope; both /api/mcp and /api/projects/{id}/mcp are exercised with create_suite and update_suite, including forged body principal and approved fields.

Each machine call must return HUMAN_PUBLICATION_REQUIRED, omit a successful result, and preserve a SQL snapshot of all suite, testcase and audit rows in the project. Bearer REST suite creation must return 403 with the same code and preserve that snapshot. The legitimate positive then edits a native child suite while retaining parent/description and clearing preconditions, stages a case through MCP, and has the human save the exact current proposal revision and selected index. It asserts the human receipt/reviewer/apply parameters, newly chosen suite, and persisted Draft case in that suite.

The real smoke log lists 19 selected MCP cases at :2536 and records this dedicated test PASS at :2565, duration 1.8 seconds. Its dedicated result is not a retry rescue and is not the separately failing lifecycle case. This is captured CI execution observed by the reviewer, not a local reviewer HTTP execution.

### Exact CI evidence and honest denominators

| Evidence | Actual result and limit |
| --- | --- |
| Smoke run 44667829454, job 136061368017 | Actual checkout e49 = source965 tree. Model Studio 19 passed at smoke.log:2143; email 6 at :2410; bulk 11 at :2481. These totals are corroborating context, not a fresh exhaustive Security review of those surfaces. |
| Selected MCP portion | 19 selected; 18 passed; 1 failed, as printed at smoke.log:2608–2611. Dedicated SEC01 test passed. Lifecycle case at e2e/api/mcp.spec.ts:232 fails at :420 because approval omitted expectedApprovalRevision; actual response was 400 and expected 200. Its retry fails the same way. |
| Database-integrity job 136061368514 | 17 suites / 611 tests passed; model-studio-runs.db.spec.ts explicitly PASS at database.log:549, denominator at :565–566. The command has no test-name filter. Full registration therefore includes all eight existing SEC02 cases; the log does not fabricate a separate trace line for each. |
| Migration evidence | 157 migrations and integrity check pass at database.log:508; immediate repeated migration reports schema up to date at :501. No mixed-version rollback or production deployment inference. |
| Current-tree secret job 136061367812, run 44667829490 | Actual source965/tree-equivalent checkout; scanner exits 1 with 5 findings. The log does not identify finding paths or rules. The five receipt-map explanation is a source-backed inference to verify, not a fact established solely by this log. |
| Scanner image identity | gitleaks.log:155 records resolved digest sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f. Workflow requested latest; CLI version was not printed. No v8.30.1 claim is made. |
| CI artifact 14599202284 | Local ci-smoke-evidence.zip is 36,776,144 bytes; SHA-256 verified below. This receipt does not claim browser image review or decode all traces merely because the archive was present. |

The later stages of the failed smoke job must not be presented as passed. The aggregate failure still prevents a clean-CI acceptance claim. The driver's newer fixture/screenshot/scanner repairs require their own exact-source run.

### SEC-NATIVE-04 minimal correction proposed to the driver

Official Gitleaks README documents that targetRules attaches an allowlist only to named rules, AND requires all criteria and match evaluates the full detector match. Official config/config.go independently shows targetRules entries are not appended to the global allowlist list. The default generic-api-key regexp can begin at the suffix api.ts because its identifier prefix excludes directory separators; the exception must match the actual detector match, not assume the whole original JSON path is included.

The retained false-positive candidates are exactly three known files:

- reviews/2026-11-19-independent/native-green-profile-9519.json.
- reviews/2026-11-19-independent/native-green-profile-9519-v2.json.
- reviews/2026-11-19-independent/native-occurrence-repair-evidence.json.

All are under docs/specs/agent-synchronized-engineering/. The two profiles contain the old API file digest and canonical contract digest; the repair receipt contains the newer API digest. This reviewer independently recomputed the three values from actual bytes: git show9519:Tesbo-Frontend/lib/api.ts, git show965:Tesbo-Frontend/lib/api.ts, and canonical v1.4.28/04_MCP_API_CONTRACTS.md. They match the retained maps. The original scan's count of five does not by itself prove those were its exact five findings.

Proposed narrow configuration, not applied by this reviewer:

    [extend]
    useDefault = true

    [[allowlists]]
    description = "Verified content-hash mappings in three retained native assurance receipts"
    targetRules = ["generic-api-key"]
    condition = "AND"
    paths = ['''^(?:/repo/)?docs/specs/agent-synchronized-engineering/reviews/2026-11-19-independent/(?:native-green-profile-9519(?:-v2)?|native-occurrence-repair-evidence)\.json$''']
    regexTarget = "match"
    regexes = ['''^(?:api\.ts": "(?:962dcaf20576c2603f30c4b438bdbef9bf83ffb687024a9d89c65dc0ae468412|b8f6f6fdf4ce97aca68824b9eae3b08d22cbdb6c0abf56989429f3f74b5a492d)|04_MCP_API_CONTRACTS\.md": "5893a48fe504a8d5c6b47bb552c493685e950fab62d44334702a92edc7c9474d)"$''']

Enumerating already verified immutable digests is stronger than allowing every lowercase 64-hex value. A new receipt/hash requires a fresh reviewed exception; a real credential does not become an integrity digest because it has 64 hexadecimal characters. The path is anchored to the documented /repo mount or the repository-relative root; confirm the actual File representation in scanner JSON and add no unobserved arbitrary prefix. An independent read-only challenge caught that the earlier proposed (^|/)docs prefix would also admit a nested src/docs lookalike; the proposal above incorporates that correction. Do not add a global directory exclusion, disable generic-api-key/default rules, use a baseline of unexplained findings, weaken the CI exit, or expand the pattern merely to obtain green.

Primary sources opened for this proposal:

- https://github.com/gitleaks/gitleaks — README Configuration, including rule inheritance, AND, match and targetRules.
- https://github.com/gitleaks/gitleaks/blob/master/config/config.go — targetRules attachment and explicit exclusion from global list.
- https://github.com/gitleaks/gitleaks/blob/master/config/gitleaks.toml — default generic-api-key identifier/match structure and retained provider-specific rules.

These are official current source/docs, not a pinned binary execution. Attempted version-specific source URLs were unavailable through retrieval. A third-party issue about global path skipping was treated only as a lead; this receipt does not assert that defect was independently reproduced or present in the actual CI image.

### Scanner-level discrimination matrix required for closure

Run through the same actual Docker image and config path as the real directory scan, in temporary fixture roots outside the repository scan. Capture its resolved image digest and CLI version; keep reports redacted and assertions on paths/rule IDs/counts, not secret values. A pure regexp test is not terminal scanner proof.

| Control | Expected original/default scan | Expected corrected-config scan |
| --- | --- | --- |
| Actual five verified maps in the three allowed receipt paths | generic-api-key findings; verify actual identity/count before treating these as the five original findings | No findings for these exact hash mappings |
| Same verified map at a path outside the explicit receipt scope | Finding | Still a finding with generic-api-key |
| Same verified map in another review filename, a filename with the allowed name only as a prefix/suffix, or nested /repo/src/docs/... | Finding | Still a finding; repository-root/directory/name boundary enforced |
| Synthetic different 64-hex value under the same api.ts key in an allowed filename | Finding | Still a finding; only reviewed digests excepted |
| Synthetic non-hash generic credential inside an allowed filename | Finding | Still a finding; paths alone cannot suppress the file |
| Synthetic provider-shaped credential inside an allowed filename | Applicable provider rule finding | Same provider rule retained; targetRules cannot suppress it |
| Known allowed mapping plus another synthetic credential on the same line | Additional credential finding | Additional credential still detected; no line-wide exception |

Use generated synthetic fixtures only. Supply an explicit default-only config for the before-control so automatic repository-config discovery cannot contaminate it. Make the before-control fail if the default rule never detects the input; otherwise a passing negative case could be inert. Do not catch every scanner exit as an expected finding: distinguish valid finding exit from configuration/tool failure and inspect a valid report. The final ordinary repository scan still must run and succeed without skipping previously required checks. These checks are proposed, not executed in this receipt. The independent challenge's Python regex evaluation is only a compatibility check, not Gitleaks or Go RE2 execution; /usr/bin/go here is not a usable Go compiler and rejected go run.

## 6. Residual risk

SEC-NATIVE-03 remains open; retained model records cannot be backfilled with invented human/machine provenance. Human transport identity is not independent proof of action-bound assent. Native approval/candidate race closure does not cover every other writer, organization membership removal, active-workspace switching or production deployment.

The scanner correction is unexecuted in this receipt. Its original red scan does not prove an actual secret leak, but its proposed explanation must be confirmed by a real report before closing SEC-NATIVE-04. The mutable latest image tag also limits reproducibility unless its resolved digest/version are retained.

No broader source-to-runtime UI gate, operational S0, original I3 external task/executor/report/retest/publication round trip, full protected-action governance, deployment recovery, dependency security or specification freeze is discharged. Preview-gated behavior was observed only under the isolated CI binding.

## 7. Verdict

**ACCEPTABLE-RISK for the bounded native suite-publication repair, with named open gates.** SEC-NATIVE-01 is closed at source965's actual tree-equivalent isolated transport build; SEC-NATIVE-02 retains bounded closure for eight real PostgreSQL scenarios. **SEC-NATIVE-03 and SEC-NATIVE-04 remain OPEN.**

This is advisory Security evidence, not release approval or permission to disregard a red required check. The actual source965 smoke aggregate and secret scan both failed. No complete human-assent, platform security or original-I3 completion claim follows.

## 8. False-positive log and legitimate controls

| Challenged claim | Evidence-backed result |
| --- | --- |
| A forged principal/approved body can bypass the machine suite boundary | Four real MCP refusals and the bearer REST refusal pass with complete unchanged suite/case/audit state; source dispatch/native guards cited above. |
| Hiding discovery is the only defense | Shared dispatcher rejects before handler; wrapped direct publishers also reject; B/src/mcp/mcp.service.ts:342–345 and mcp.tools.ts:1982–1988. |
| Suite protection breaks legitimate human editing or exact Save | Real test verifies parent/description preservation, explicit precondition clear, exact reviewed proposal Save, receipt reviewer and persisted Draft in its chosen suite. |
| A green dedicated test makes the whole MCP suite green | False: real aggregate is 18 passed/1 failed; lifecycle failure and retry are retained. |
| Every 64-hex value is a credential or every one is harmless | Neither assumption is used. Three precise values were independently verified as content digests; their exact scanner attribution still requires the report. |
| The scanner62 comments restrict the allowlist to review paths | False: the actual config has no paths or targetRules. The code, not the comments, determines suppression scope. |

## 9. Side findings and retained limits

The separate failed lifecycle fixture sends expectedRevision without expectedApprovalRevision at e2e/api/mcp.spec.ts:417–420; correcting the fixture must read the current native approval hash and preserve the existing 200/governed-run assertions. QA owns that correction and rerun. A missing precondition is not grounds for weakening the native approval guard.

The current source still has model save/link/unlink/run entrances outside the narrow late-authority checks; the earlier side finding remains a reasoned boundary for the broader action-policy owner. No new PostgreSQL reproduction for those entrances was performed here.

Purple/current-render evidence belongs to its independent owner. Model19 passing alone is not proof that retained screenshots show every asserted control, and this Security receipt does not certify those images.

### Evidence integrity

| Captured file | SHA-256 |
| --- | --- |
| smoke.log | 489e65bb72addee8df4b7f864489f3cea9a76086bcba7c6b4a399fe366995081 |
| database.log | 755f8d2dc9e42e095ab453b3fa0562a9d57d14297232e974fd90871a91996094 |
| gitleaks.log | d04ac3521130de0dbc6ddf56680b00e66ad93ba440411e9766e62ddd2df2ae6e |
| ci-smoke-evidence.zip | 606d02869014f699136eec46ef830bd630cc15df8527593d60660539b2b2bfd3 |
| prior security-native-final-delta.md | 441a3a37ef678da8db43670b24e7ed2af97f9bd304df8841125f390d6bba3640 |

The companion security-native-transport-closeout-inputs.json binds the exact opened method, product/test, scanner-config and evidence files. Hashes assert byte identity, not additional unseen test execution.
