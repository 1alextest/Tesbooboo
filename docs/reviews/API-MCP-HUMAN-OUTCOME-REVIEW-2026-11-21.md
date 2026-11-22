# Tesbo API & MCP — outcome-first interface assurance (candidate review)

**Date:** 2026-11-21  
**Status:** SOURCE-REVIEWED / LIVE HUMAN-OUTCOME VERIFICATION BLOCKED  
**Target:** `Tesbo-Frontend/app/(app)/projects/[id]/settings/api-tokens/page.tsx` on **development**, with `ExternalMcpAccessPanel.tsx`, MCP helpers, backend authorization and existing Playwright evidence.  
**Design authority:** existing Tesbo requirements, human approval and governed MCP/token behavior; this document does not change those authorities.  
**Method:** an independent baseline AI review and skill-guided AI review (separate research calls), then six separate specialist lens calls (Grey, Purple, Security, QA, Red, Green); author reconciled their claims against implementation. These are *not* signed reviews from the canonical repository teams and are not human usability observations.

## Evidence and branch discipline

- `SOURCE_VERIFIED`: read directly in `development` source. The page and related helper were fetched with blob SHAs `1efd58fb9c155ee327508b83b0d2acd24a59a7c2` and `b140996e68bb71b2c183ed909ddae1523b3d4588`; ExternalMcpAccessPanel SHA `50125f478c4f826c7dd6aa7139af2492fe107e34`. These are **file SHAs, not deployment SHAs**.
- `EXISTING_TEST_SOURCE`: test assertions observed in Playwright source, not newly executed in this review (`e2e/utils/ci-repository-partial-edits.ts`, `e2e/utils/ci-mcp-diagnostic-lifecycle.ts`).
- `HYPOTHESIS`: a plausible human-journey risk inferred from the source and an independent, still-unexecuted oracle.
- `BLOCKED`: actual browser rendering, deployed build identity, role-based user behavior, accessibility and consented human task results were not captured. Avoid PASS/FAIL human claims.
- `VERSION_DRIFT`: `main` has an older page (blob `7f00b161db44061317ec249c235da1ec7e8385cf`) lacking development's external access panel, OpenCode tab, read-only default and diagnostic. PR #155 proposes development-to-main release but is draft; do not presume a deployed environment serves development.

### Existing source-verified protections — preserve

1. Project-level MCP external switch defaults **Off**, and each approved client binds to a distinct existing token. The backend validator rejects duplicate token grants and validates allowed tool names, scopes and optional grant expiry.
2. Token creation defaults **Read selected, Write unselected**. Invalid/empty scopes are rejected by current backend `normalizeApiTokenScopes`; they do *not* silently become Read+Write.
3. Newly issued token secret is available only in one reveal state, absent from token-list metadata and example snippets. Revealed state is cleared on Done.
4. Client-grant writes, token scopes, project membership, consent state and effective tool permissions are enforced server-side. The MCP service rechecks current consent per request and supports a scope-limited visible tool set.
5. Browser connection diagnostic performs live `tools/list` and a project-scoped `list_projects` **Read** call, without a write or reporter result; timeout 10 seconds; token cleared; explicit success limitation.
6. Existing Playwright source covers credential/permission negative cases, failure states, timeout/abort/navigation cleanup, and project switching. Review does not claim these tests ran today.

### Rejected or unsubstantiated agent claims

- **REJECTED (current source):** a reviewer claimed invalid scopes become both Read+Write. Current `api-token.service.ts` rejects them.
- **REJECTED (current source):** a reviewer proposed the same token could have multiple named MCP grants. `validateMcpAccess` rejects duplicate token IDs; the client form also filters already-approved token IDs.
- **REJECTED (conflated concepts):** a reviewer assumed API tokens have the optional client grant expiry. The visible expiry belongs to the named *MCP client grant*, not a token expiry setting.
- **NOT ESTABLISHED:** that non-manager REST token creation or revocation succeeds. A visible UI role restriction does not alone establish or refute the current server-side policy; verify actual legacy service policy and endpoint results.
- **NOT ESTABLISHED:** user confusion, screen layout defects, user satisfaction, compromised production access, or wrong deployment behavior.

## Human actors, underlying jobs, and possible hidden beneficiaries

| Actor | Real job/outcome | Distinct affected people |
| --- | --- | --- |
| Project owner/manager | Approve the right external client, authorize the minimum necessary capabilities, understand active grants and revoke safely | Other team members and client operators affected by changed access |
| Coding-agent operator | Configure their client to use the right Tesbo project and understand which tools actually work | Test authors and maintainers whose project records may change |
| QA engineer / reporter owner | Configure reporting and verify that the actual Test Run and results arrived | Reviewers relying on run history and product-release evidence |
| Security/governance reviewer | Distinguish scoped consent, authorization and effective grants from cosmetic 'connected' status | Project data subjects and people impacted by external reads/writes |
| Viewer/nonmanager | Understand available information, why certain actions require escalation, and the correct handoff | Approving manager and CI owner |

**Outcome-first reconstruction:** The user must reach an *authorized and demonstrably usable* connection, not merely create a token, enable a switch or see a green connection banner. For reporting, the desired outcome is a traceable Test Run with correct result attribution; the diagnostic's read-only result is an intermediate proof.

## Blind pass: reviewed outcomes and confirmed facts

The independent baseline and method-assisted agents each received the same source-derived factual inventory without seeded suspected defects. Both discovered separation between token creation, named approval, client configuration, read verification and reporting. The skill-assisted agent more consistently qualified actual human benefit as unknown and emphasized end-to-end receipt evidence, while the baseline agent made several unsupported claims (rejected above). This is one illustrative pair of runs, **not a scored causal skill benchmark**.

## Candidate UX and human-outcome findings (not observed human failures)

| ID | Source-grounded trigger | Human-outcome hypothesis and causal alternative | Outcome family / priority | Independent acceptance oracle |
| --- | --- | --- | --- | --- |
| HX-01 | `ExternalMcpAccessPanel` renders **before** Create token; approval requires an existing token; empty-state asks to create then reload | New owners may try to approve before they have a credential and lose orientation. **Alternative:** security administrators naturally prefer the access-control overview first, and the empty-state guidance may suffice | H02 orientation, H05 accomplishment, H06 effort; **P2 hypothesis** | First-time manager with no token completes real approved-client setup without coaching. Capture ordering misunderstandings, backtracks, completion and necessary security checks |
| HX-02 | Diagnostic headline says "Check MCP connection", successful status begins "Connected to ...", but proof is only live Read + project identity, and the limitation is stated | Operator may infer integration/write/reporting readiness despite scope disclosure. **Alternative:** the explicit limitations are already clear to the target operator | H03 comprehension, H07 truthful state, H16 warranted trust; **P2 hypothesis** | After read-only success, ask operators to explain exactly what is and is not verified, then separately validate a real client and reporter with no test pollution |
| HX-03 | Other tab says static `47` tool descriptions; developer E2E test currently describes 59 registered, and 24 visible to a Read token | Static description may be mistaken for the accessible contract. **Alternative:** 47 are an intentionally curated *documented subset*, not the full registry; need to label accurately, not automatically list all | H04 informed tool decision, H07 truthful status; **P2 source inconsistency / human impact hypothesis** | Diff the rendered descriptive catalog against pinned live `tools/list` and its scoped result, and have an operator determine which tools a given credential can use |
| HX-04 | Creation modal defaults Read and reporter explicitly needs Read+Write, while nonmanagers cannot issue tokens through visible controls | QA operator may discover scope insufficiency only after configuring reporter. **Alternative:** intentional least-privilege and manager-assisted access is appropriate and the explanatory copy is sufficient | H05 completion, H06 effort, H10 agency, H14 handoff; **P2 hypothesis** | Compare first-run reporter setup with Read-only and explicitly authorized Read+Write tokens; verify actual Test Run/results and permission copy comprehension |
| HX-05 | One-time reveal and direct Revoke actions; no secondary confirmation for Revoke visible in source | Accidental revoke can interrupt AI clients/CI and recovery may require new token and repeated grants. **Alternative:** immediate revocation is a necessary urgent security response; confirmation friction can itself be harmful during incident containment | H08 recovery, H12 safety, H14 multi-actor consequence; **P2 hypothesis** | With test credentials, assess intentional urgent revoke vs mistaken-action recovery, server deauthorization latency and CI reconciliation. Do not enforce confirmation without first proving it helps |
| HX-06 | Authorization, consent and client-grant states are separate; UI shows approved clients, one global switch, and a grant form | A manager may misunderstand whether a client is merely approved vs actually enabled, or whether its grant expired or tool restrictions apply. **Alternative:** visible global state and grant rows already answer this sufficiently | H03 meaning, H07 calibrated status, H10 control; **P2 hypothesis** | Multiple-role teach-back and independent read-only `tools/list` checks under global Off, approved/denied, expired, restricted-tool and revoked states; no write calls |
| HX-07 | There is no onscreen reporter-delivery verification in this page; `Check MCP connection` explicitly excludes writes and report delivery | CI owner may treat green local execution as successful Tesbo reporting despite an absent downstream Test Run. **Alternative:** reporter CLI initializer and separate run history already provide sufficient end-to-end observability | H05 actual accomplishment, H07 truth, H16 trust; **P2 hypothesis** | Run a dedicated harmless synthetic Playwright job in an authorized test project and assert its corresponding Tesbo Test Run, execution IDs, outcomes and delivery receipt; test failure modes separately |
| HX-08 | Project/version split: `main` and `development` differ materially | Advice may target a UI that is not deployed; user could see an older token default or missing panels. **Alternative:** the production build is tied to development already; source branches alone cannot prove it | Build fidelity / H07 truth; **BLOCKED** | Observe deployed build SHA, full-page masked screenshot and role state, then match source components and actual behavior before grading an interface |

## Candidate principles to grade (owner: user)

These are *not binding UX rules*. Preserve each source context, causal mechanism, falsification and counterexample. User may assess as Good / Mixed / Poor / Ungraded, with a free-text reason, independently of empirical validation.

- **P-HX-1 — Dependency-legible workflows.** When a human job has prerequisites, make the relationship discoverable at the moment of action; an admin control-plane overview may justifiably appear before onboarding when experienced users need it. **Test:** first-time and return-use tasks, no coaching.
- **P-HX-2 — Evidence-calibrated readiness.** A status should communicate the precise capability verified and what remains untested; safe read-only diagnostics must not be replaced with exploratory writes without authorization. **Test:** teach-back plus distinct actual client/report outcomes.
- **P-HX-3 — Permission-transparent decisions.** Present effective user/client permissions and tool availability from authoritative state, and label illustrative static references as such. **Test:** reconcile tool discovery and manager's understanding.
- **P-HX-4 — Risk-proportionate lifecycle control.** Protect irreversible credentials and operations while preserving urgent revocation and safe recovery; no blanket 'always confirm' rule. **Test:** loss/revoke/resume versus emergency-off workflows.
- **P-HX-5 — Cross-role outcome completion.** A credential/configuration setup is successful only if the human's downstream job is demonstrably achievable under the approved authority. **Test:** end-to-end manager→operator→reporter handoffs.

## Disposition and next verification

**No source code has been changed by this review.** Design hypotheses must remain unratified. Do not unilaterally add proposal-only write permissions, new security controls, change token scope defaults, or alter currently approved MCP behavior. Existing controls are safety boundaries. No real human assessment was performed, and this document must not be treated as Tesbo-native test case execution or sign-off.

The existing active QA/engineering team would verify deployment SHA and capture a real full-page Before screenshot, then run the [companion outcome-acceptance cases](./API-MCP-HUMAN-OUTCOME-ACCEPTANCE-2026-11-21.md) with real users and authorized synthetic credentials. Separate `SYSTEM_VERIFIED`, `HUMAN_OBSERVED`, `AI_HYPOTHESIS` and `BLOCKED`. Only after the user grades principles and authorized owners ratify warranted design changes should the page be edited.

**Primary source links:** [page](../../Tesbo-Frontend/app/(app)/projects/%5Bid%5D/settings/api-tokens/page.tsx), [grant UI](../../Tesbo-Frontend/components/project/ExternalMcpAccessPanel.tsx), [diagnostic helper](../../Tesbo-Frontend/lib/mcpConnectionCheck.ts), [server MCP authorization](../../Tesbo-Backend-Nest/src/mcp/mcp.service.ts), [validation](../../Tesbo-Backend-Nest/src/mcp/mcp-access.ts), [API token scope parser](../../Tesbo-Backend-Nest/src/auth/api-token.service.ts), [existing browser lifecycle tests](../../e2e/utils/ci-mcp-diagnostic-lifecycle.ts). The relative links point to branch content only, not a deployed user screenshot.
