# OAuth specifications and team-method continuation — 28 November 2026

**Documentation review and reconciliation; implementation not started.** This record is review evidence, not a ninth normative specification, native execution store, human approval or activation authority. Existing OAuth implementation and its narrower successful tests remain intact.

## Exact source lineage and concurrent work

- PR295 owns the specification change; no competing spec PR. Original parent: `07469c1d8ccd721fc7c2dcb96b7fbd6c5699a490`. The first-pass documentation candidate is preserved at Git commit `5a9936efa07e6373487186df10c7c7d1fe1cb3a4`; its [inputs](inputs.json), SHA-256 `0cba2bb837eb439367d59a6d1c9e2318684601dc46c8ddc4cf36475595ff93e4`, bind 26 source files and the original [brief](review-brief.md). That snapshot explicitly records the rerun as pending; it is historical, not the final result.
- First-pass product reference: development `2e91c8e95dbf90ced664ca4f35af207abaa56941`. No runtime acceptance was executed by this continuation.
- Concurrent PR295 `fabe66ca7` semantic-inference safeguards and `b915a2645` baseline-capability reconciliation are preserved in the combined candidate. Same eight canonical files; source hashes updated. Historical package/review receipts remain scoped to their original inputs. No matching new archive or package-wide freeze is claimed.
- Development advanced to `466427f45da8b47b1ae6ea31cd25433de9128fb6`: #337 merged as `3aede88ca`, #338 as `466427f45`. #337 is no longer an open task. Its exact head `1631eee76547bef602b23b278d8e4e35d881d1b5` had 33 successful checks/one event skip; its prior scanner failure is historical. #338 adds separate Gate A grants/prompt/assignment fences and migrations, not OAuth activation. The actual delta contains no change to the runtime login, provider, policy or panel source examined here. Its new provider fixture still installs a saved session. No fresh deployment/health assertion is inferred from these merges.
- [Combined inputs](combined-inputs.json), SHA-256 `862511a9fa6a4f422a8fce081f56775e7ac47fd79193584c7551504686403475`, bind 34 files after corrective and concurrent reconciliation. Original inputs/reports remain unchanged. Informed deltas assess this combined candidate separately.

## Why the earlier reviews did not establish the usable journey

The [retrospective](../MCP-OAUTH-ASSURANCE-2026-11-23.md#28-november-2026--retrospective-closure-analysis) preserves the original changes-required review. Two initial independently invoked read-only investigations—[archaeology](archaeology-original.md) and [method challenge](method-challenge-original.md)—support the following bounded explanation:

- Fresh sign-in, account switch, live-client and operational proof were already required. Retained later evidence does not close them. The earlier specification was not a completed-acceptance receipt.
- Later implementation choices created concrete joins requiring re-review: split-host cookies/continuation, dynamic read breadth and provider-induced key fetching. These cannot all be attributed to a pre-implementation reviewer.
- Narrower fixtures are legitimate: mocked browser login and planted provider sessions each prove useful parts, while leaving their real-browser join unproved. Metadata and model lookup concurrency similarly have narrower boundaries than client use and HTTP redemption races.
- Two linked method instructions demanded a candidate gap/question while also allowing no-change. Both are now corrected. This is a demonstrated guidance contradiction; its causal contribution to earlier behavior is unproved.
- Default-off, read-only scope and conservative project-wide revocation are deliberate policies, not automatically defects. Exact historical reviewer inputs/decisions are incomplete; motivation and universal team failure remain unknown.

Canonical06 owns the [reusable refinement](../../qa-orchestration/06_IMPLEMENTATION_AGENT_BRIEF.md#closing-actual-handoffs-and-learning-from-a-miss); existing scope, decision and security guidance apply it. No new principle IDs, team framework, status store, issuer, permission owner or active native Skill is created. The [OAuth continuation](../../specs/mcp-oauth-chatgpt-connection.md#28-november-2026--read-only-connection-continuation) owns contextual acceptance OAUTH-15–20.

## Actual rerun and attribution

Seven fresh invocations produced six specialist first passes plus a White original. Original files were frozen before new peer contents were read; later informed turns are not extra independent teams. Existing Tesbo role guidance was available; full external Nesberry charter originals were not supplied, so no formal external quorum is claimed. The case is disclosed in the specs: this is informed application/regression, not blind discovery efficacy, participant usability research or human approval.

| Invocation / lenses | Original | Result within declared source scope |
| --- | --- | --- |
| Blue / Graph | [Original](blue-graph-original.md) | No additional documentation blocker; owners, maturity, preservation and current-authority boundaries retained. |
| Red / Elephant-Gold | [Original](red-eg-original.md) | Found linked residual question quota, conditional older-consent withdrawal reachability, and callback-code wording conflict; corrective dispositions below. |
| Security | [Original](security-original.md) | No additional documentation blocker; retained proof/decision gates and derived authenticated-client-specific refresh qualification. |
| Green / Operability | [Original](green-ops-original.md) | No unconditional documentation blocker; registration identity/authentication and endpoint/protocol matrix need concrete handoff. |
| QA / lifecycle | [Original](qa-lifecycle-original.md) | No additional documentation blocker; real browser, HTTP race, recovery and owner-selected-policy proof remain unexecuted. |
| Grey / Purple | [Original](grey-purple-original.md) | No additional documentation blocker; account recognition, personal revoke wording, OTP/profile recovery and truthful setup states remain implementation work. |
| White | [Original](white-original.md) | Original-source completeness bounded; residual linked wording ambiguity and runtime/authority gates retained. |

**Exposure limits:** Grey/Purple's broad source search returned limited excerpts from the prior archaeology/method investigations before its original; it read no new specialist originals. White received a coordinator location-only cue about a retained specialist finding before its original; it disclosed that cue and claimed no independent-discovery credit for the finding. Other originals report no new peer-content reads. Each verified the 26 frozen source identities. Role combinations are lenses within one invocation, not eleven independent teams.

## Corrective and preserved dispositions

| Item | Combined-candidate disposition | Proof limit / next owner |
| --- | --- | --- |
| Forced question/gap quota | Canonical06 and both unconditional sentences in the linked decision procedure now require independent investigation with supported finding/no-change/unknown. | Text consistency correction; no efficacy result or active Skill promotion. |
| Older personal consent outside latest 50 | Existing OAuth spec now requires withdrawal reachability or proof older effective authority is impossible under settled lifecycle; >50/privacy/uncertain-response/refusal/reconsent scenarios extend OAUTH-16/18. | Source-supported conditional gap, not live population/exploit. Mechanism remains at existing personal-history/revoke owner, not project-wide revoke or new consent system. |
| Authorization-code URL wording | Protocol-defined exact callback/exchange is explicitly permitted; unrelated navigation, tokens/OTP/passwords in URLs and secrets in evidence remain forbidden. | Contract wording corrected; no protocol implementation changed. |
| Registration and protocol seams | Existing D2/D6 now carry selected ID/callback/authentication across operator and project policy, and OAuth project/modern vs token project/shared/legacy matrix. | Unsupported opaque static identity remains truthfully refused; no automatic expansion or `none` workaround. Actual client acceptance NOT RUN. |
| Refresh oracle | Bind concurrency/replay expectation to negotiated client/authentication and independently observed rotation precondition. | Existing D5/OAUTH-19 policy and real HTTP proof still needed; no inferred vulnerability from valid unrotated credentials. |
| Original blockers and legitimate policies | Keep real login/topology, tool/data/offline/account-event policy, fetch/runtime/schema/rotation/restore and release gates; retain read-only/default-off/global-epoch behavior and ordinary clients. | No green metadata/CI or team agreement substitutes for real boundary proof or applicable authority. |

The informed Blue/Graph, Red/Elephant-Gold, Security, Green/Operability and final White reconciliations are separate linked artifacts when complete. Their scope is combined documentation, not product acceptance. The artifact manifest binds originals and deltas without rewriting history.

## Verification, native synchronization and next work

Actual checks here: frozen input identities; all eight canonical size/SHA-256/Git-blob identities; retained concurrent/historical bodies; changed local links; diff whitespace; original-report integrity. These are documentation checks. No new product unit/DB/API/browser/MCP test, login, client grant, OAuth activation, configuration, credential change, production deployment or native execution occurred.

Requirements/cases: OAUTH-15–20 are proposed source acceptance detail, not new native case IDs. Existing tests and CI history are retained. Manual/operator guide already describes default-off and split-host boundaries; future implementation must update its actual instructions. Policies remain at existing owners with unresolved choices explicit. Existing Task/PR295 contains the review; no duplicate task store. Security/decision/method guidance is refined as text, with no native Skill approval/assignment. Native Tesbo tools are absent: **Tesbo sync not performed**; no Requirements/Cases/Runs/Files publication or PASS is claimed, and manual execution remains UNRUN.

Next bounded step is the owner-selected login continuation/topology and pilot scope at existing owners, with the required discriminating scenarios and explicit activation authority. A truthful in-place unavailable/setup explanation can be implemented independently if its contract needs no unsettled choice. This continuation does not choose new domains, relax cookies, start the provider or introduce OAuth write capability.
