# Method challenge — OAuth requirements and existing team application

Date: 28 November 2026. Read-only analysis; original report by delegated reviewer `/root/oauth_method_challenge`.

Method/specification pin: `tesbo-oauth-specs@07469c1d8ccd721fc7c2dcb96b7fbd6c5699a490` (PR295 source supplied for this task). Implementation pin: `tesbo-oauth-teams@2e91c8e95dbf90ced664ca4f35af207abaa56941`. Line references to product files below are relative to the implementation repository; method references are relative to the specification repository. Prior review evidence means `tesbo-oauth-teams/docs/reviews/oauth-readiness-20261128/`.

## Verdict and evidence boundary

The main transferable invariants already exist. The missing OAuth outcome is evidence of incomplete application/closure, not sufficient evidence that the teams lacked a principle. `agent-scope-discipline.md:57–59` already requires the actual starting state, ordinary entry point, authority, real writer, fresh read and next consumer; `:67–85` already covers configuration, environment, unlinked dependencies, lifecycle, degraded states and scope-qualified evidence. Canonical 06:599–624 already requires causal alternatives, independent expectations, no-change/unknown, falsifiers and application receipts. Living Security guidance:15–30 already requires actual boundaries and tests that cannot be replaced by mocked grants.

One **confirmed wording defect** is worth repairing: canonical 06:842 requires every applicable specialist to originate a candidate gap, while :601 and :624 allow no-change/insufficient evidence and explicitly reject a finding quota. The other recommendations below are **targeted operational refinements of existing invariants**. No retained original invocation/delivery trace proves whether an older reviewer did not receive, did not reach, did not apply, or did not check the guidance. That historical failure class remains **UNRESOLVED**; a new sentence must not be credited with preventing the miss before a suitable evaluation.

I read the current journey/whole-system method, canonical 06 shared distillation/team procedure, living-security candidate, OAuth draft, repository instructions and the relevant prior originals/readbacks, and inspected the product sources cited below. I did not execute browser, HTTP, DB, product tests, scanners or native operations. The dependency-internal claims below are attributed to the preserved Security original, not independently reproduced upstream observations. No product/configuration/authentication change or shared specification edit was made.

## M1 — Remove the requirement to manufacture a gap

**Observed conflict:** canonical 06:842 says “Each applicable specialist must originate its own evidence-grounded candidate gap”; :624 says “No quota of findings or preferred solution is required.” The shared method also accepts supported no-change and insufficient evidence (:601, :611, :623).

**Causal counterexample:** a reviewer can correctly find that the shared project's global invalidation epoch is intentionally conservative, with stale families denied and fresh consent available. To comply literally with “must originate a gap,” the reviewer must invent another gap, relabel a valid safeguard as a defect, or appear noncompliant. The same problem applies to an intentionally operator-owned startup switch and to an adequately bounded existing token workflow. No evidence shows that this contradiction actually caused the earlier miss; the incompatible instructions themselves are observable.

**Minimal amendment at canonical 06:842:** “Each applicable specialist independently investigates the supplied outcome through its existing charter and returns an attributable, evidence-grounded finding, supported no-change, or bounded insufficient-evidence disposition. A coordinator's supplied question list does not establish independent discovery.” This preserves initiative and attribution without requiring a finding or creating a role/store.

**Qualification:** a conforming case should permit an empty finding set with an evidenced bounded conclusion; a hidden fault should still require a discovered obligation; inaccessible evidence should yield unknown, not invented gap or clean. A reviewer who merely repeats coordinator-supplied findings has not demonstrated independent discovery.

## M2 — Close the actual starting condition, not the two successful halves

**Concrete mechanism:** `lib/redirect.ts:92–96` derives the consent navigation origin from ordinary `API_BASE`; `lib/api.ts:5,154–158` governs ordinary credentialed API fetches; `next.config.mjs:13–20` rewrites frontend `/api` requests; `auth.service.ts:289–296` issues a host-only Lax cookie. The consent controller separately redirects unauthenticated browsers to the frontend and expects the backend interaction/session (`mcp-oauth-interaction.controller.ts:138–149`). These relationships make cookie/host/session identity a material join, even if all named services exist.

**False-pass witness:** `e2e/ui/oauth-login-continuation.spec.ts:15–56` models sign-in as a JavaScript boolean and returns final consent HTML from interception. The preserved QA original:39–54 and CI readback:57–64 show the provider script starts from a directly created saved session/manual cookie jar. Both halves can pass while a genuinely signed-out browser never establishes the cookie at the host that performs consent. Their tests remain useful for their actual contracts. This is a demonstrated proof limitation, not a reproduced live browser failure.

**Existing invariant:** AGENTS principles 9–11; journey method:57–59; canonical 06:601,617,621,624. **Classification:** absent/unchecked contextual application; historical process cause UNRESOLVED.

**Minimal refinement at the existing journey method:** for a material handoff, identify the preconditions it consumes and whether the supporting evidence established, injected or mocked them. Keep a substituted precondition outside the end-to-end claim. Inspect the actual identity/authority/state carrier, not only the destination URL or success status. This is proportionate review evidence, not an additional mandatory ledger or test framework.

**Team application:** Blue/Green trace the actual origin/site/cookie/session/provider-interaction carriers; Grey independently starts at the supported external client as a signed-out or wrong-account person and follows offered recovery; Purple checks account recognition and expiry/cancel/restart; QA compares actual signed-out path with valid injected-session controls; Security checks the pre-login and consent boundaries separately; White leaves the browser join open until its exact evidence exists.

**Falsifier / no-change:** an authorized real browser run at the selected topology may show current login already satisfies the join. That permits no new login adapter. A provider-only HTTP regression should continue using a saved-session fixture when it accurately declares that boundary. Do not replace every targeted test with a full browser test.

## M3 — Follow dependency-created effects beyond the first validated address

**Concrete local evidence:** `mcp-oauth-server.ts:198–220` restricts CIMD client IDs through the existing provider callbacks and relies on the dependency's network protections; it does not supply a custom fetch or purpose-specific body limits. Static clients are forced to `token_endpoint_auth_method: "none"` (:99–105), so switching registration mode is not automatically semantically equivalent.

**Preserved independently collected evidence:** Security original:36–48 reports pinned `oidc-provider` source where remote `jwks_uri` fetches have different limits/redirect treatment from CIMD and dispatcher initialization can fall back to unprotected fetch. Its contemporaneous public metadata observation makes signing-key fetching relevant. This report did not repeat that external retrieval and does not claim an attacker can control OpenAI metadata or exploit the running system.

**Causal counterexample:** initial metadata URL validation succeeds; the producer returns a key URI; a later token-authentication/key-refresh path fetches that URI with different defaults. A first-hop URL predicate or CIMD happy path cannot prove the safety or availability of the second effect. Similarly, a protective initializer that fails and falls back is not proof that the protection exists in the running path.

**Existing invariant:** AGENTS principles 2/8/15; whole-system method:75–78; Security method:18,25–29 and SEC-P08. **Classification:** existing boundary/dependency invariant with insufficiently explicit transitive application, not a new SSRF principle.

**Minimal refinement:** when a dependency can create further consequential effects, trace the enabled transitive calls and fallback behavior until the claimed control's boundary is established or the scoped frontier is explicit. Qualify fetch purposes, initialization failure and recovery at the actual pinned runtime. Conditional examples belong with this OAuth review; do not prescribe a universal allowlist, disable protocol features, fork the provider or add a fetch service.

**Team application:** Blue identifies actual pinned configuration/defaults and reusable hooks; Green traces lifecycle fetches, key rotation and downstream failure; Security tests boundary failure and forbidden effects; QA pairs refusal with a real legitimate key/client control; Operability establishes safe diagnosis and recovery; Red challenges an apparent equivalent registration shortcut; White records which enabled effects remain unexamined.

**No-change/exception:** an installed, verified provider/network owner can already enforce the invariant. A feature verified disabled and unreachable need not receive its own implementation. Known trusted metadata still warrants honest failure bounds; it is not evidence of arbitrary attacker control. Changing to static registration needs compatibility evidence, not automatic preference.

## M4 — Reuse of one authorizer does not settle the target's allowed reach

**Concrete mechanism:** OAuth preapproval writes `scopes:["read"], allowedTools:null` (`ExternalMcpAccessPanel.tsx:210–213`). Shared `hasApprovedMcpToolPermission` treats null as unrestricted within the required scope (`mcp-access.ts:136–144`); runtime tool lookup uses the current catalog (`mcp.service.ts:307–309`). The reviewed target includes `allowedTools:null`, and consent describes “all permitted read-only tools” (`mcp-oauth-interaction.controller.ts:120–127,167`). A new read tool can therefore join the permitted population without a project-policy revision. This is a source-supported consequence, not executed disclosure or an established policy violation.

**Second direction of the same issue:** every successful existing policy save increments the project revision and tombstones all older OAuth bindings, including unrelated-token client changes (`mcp.service.ts:483–510`). That is intentionally conservative per the OAuth draft:49; fixing local settings copy must not silently narrow it.

**Causal counterexample:** a correct shared read predicate permits the newly registered knowledge/proposal reader, but the product owner intended a limited case-read pilot. Alternatively, a local “remove client B” action correctly denies stale authority yet disrupts consenting users of client A. Correct reuse at one owner does not prove the local promise's disclosure or impact population.

**Existing invariant:** AGENTS principles 2/3/6/8/16; canonical 06:613,618–622; Security SEC-P03/P05/P11; OAuth draft:23,72,97,147. **Classification:** missing local decision/coverage, not authorization to create an independent OAuth policy owner.

**Minimal refinement in canonical 06's contextual-instantiation/application instruction:** compare a reused mechanism's actual recipient/data/effect/lifecycle population with the target's accepted promise, including wildcard/default behavior, catalog changes and collateral consumers. State the unresolved owner decision when that population is not approved. Do not equate shared implementation or a read label with settled product scope.

**Team application:** Blue/Graph identify the true permission owner and dynamic population; Green identifies affected clients and users; Security/data owners classify the disclosed material; Grey/Purple test comprehension of breadth and project-wide effects; QA uses two clients, a legitimate unrelated project and a materially different new read tool; Red challenges the “read-only therefore minimal” premise; White distinguishes policy choice from confirmed breach.

**No-change/exception:** broad dynamic read access can be legitimate when knowingly approved by the applicable owner; named tools are not a universal requirement. The conservative project-wide epoch can remain with accurate impact/reconsent guidance. Explicit allowlists can bound a pilot using the existing owner if chosen. No per-tool consent service, new epoch design or notification platform follows.

## M5 — Readiness is a scoped claim with an owner, recovery and stop condition

**Concrete mechanism:** provider mounting is restart-scoped and awaits configuration before the shared backend listener (`mcp-oauth-server.ts:177–198`, `main.ts:117–123`). Project enablement/client preapproval is a different fact; the current OAuth form explicitly says it is not a connection (`ExternalMcpAccessPanel.tsx:210–216`). Public metadata, personal consent history and a first read have still different owners and observation boundaries (prior White original:35–83; QA CI readback:57–76). The selected origin does not establish operational schema/key/replica/browser/client readiness.

**Causal counterexample:** project On plus available metadata produces a green badge while persistence or signed-out login is unavailable; a first read passes before access expiry, but refresh/lost-response recovery fails; “global Off” is treated as terminal revoke although turning the runtime back on with unchanged durable authority may resume artifacts. A member asked to start an operator-owned provider either cannot finish or is offered the wrong authority.

**Existing invariant:** AGENTS principles 7–11; whole-system method:77–83; canonical 06:601,617,621,624,856; Security SEC-P09/P10. **Classification:** unsupported closure/owner projection, not missing global start capability.

**Minimal refinement at the existing journey closeout:** for the declared outcome, name each unresolved prerequisite's authoritative owner and next permissible action; include a materially relevant degraded/recovery or stop path, and retain temporary interruption versus terminal withdrawal. Derive the minimum proof from the actual claim. Do not demand every possible operational test or a richer readiness API merely to make a truthful unavailable statement.

**Team application:** Grey/Purple start from each actual audience and check permitted next actions; Green/Operability trace startup, shared-service impact, schema/keys/replicas and disable/restart/restore; Security distinguishes expected denial from infrastructure failure without public detail leakage; QA tests actual HTTP refresh competition and response-loss recovery where durable connectivity is promised; Graph retains dependencies and exact attempts; White reports bounded partial/block/no-change without converting them into ready.

**No-change/exception:** a truthful in-place explanation plus existing operator runbook may fully solve the immediate setup confusion; OAuth stays unavailable. A source-only review may conclude design is supportable while runtime acceptance remains open. A bounded read-only milestone can exclude case authoring with an explicit accepted outcome; it cannot claim authoring was delivered. Public errors may remain deliberately generic while protected diagnosis distinguishes causes. Temporary outage need not revoke consent; incident revocation follows the applicable owner policy.

## Minimum useful amendment and rerun

1. Fix M1's contradictory sentence in canonical 06. It is the only directly demonstrated defect in the method text identified here.
2. Refine the existing application-journey paragraph and canonical contextual-instantiation guidance with the compact consequences in M2–M5. Prefer two short owner edits and OAuth-specific instantiation in the existing review/spec over five new principle IDs or checklists. Keep living-security guidance linked to the shared owner.
3. Rerun through the unchanged team charters on the candidate artifact. Ask for the supported actor outcome, exact versions/environment, original evidence and each reviewer's own findings/no-change/unknown. Do not prescribe the desired answer or demand a gap. Retain originals before informed reconciliation; later runs must not overwrite prior failures.
4. Use this now-disclosed OAuth case for **informed application/regression**, not a blind efficacy claim. Compare meaningful held-out cases later through the existing evaluation owner before claiming improved independent discovery. Controls should include a valid single-origin login; a second dependency fetch; a disabled unreachable feature; broad read explicitly authorized; retained global epoch; metadata-only preview; storage unavailable; lost write acknowledgement; an already-authorized operation whose reporting fails; and an unchanged legitimate neighbor. These are qualification candidates, NOT RUN.
5. The rerun may close specification/application obligations or identify an owner decision; it supplies no implementation, native sync, release, deployment or OAuth activation authority. `Tesbo sync not performed`: this reviewer had no applicable native write operation and invented no native identity.

## Distillation record for coordination

| Observation | Existing invariant / transferable question | Local consequence | Valid alternate result |
|---|---|---|---|
| Every specialist is required to find a gap | Evidence should determine the verdict; did the method reward a particular conclusion? | Permit independently evidenced finding/no-change/unknown | A conforming area yields no finding |
| Mocked login plus saved-session provider tests | A claim requires its necessary preconditions; which carrier did the proof actually establish? | Real signed-out browser/session join remains open | Existing topology works; no adapter |
| Validated metadata can cause subsequent fetch | Controls must cover actual effects; which further calls/defaults/fallbacks can the producer create? | Qualify enabled key fetch and failure behavior | Existing verified network owner suffices |
| Shared read default expands with current catalog | Reuse preserves ownership, not automatically appropriate policy; who approved the actual affected population? | Resolve pilot read breadth and disclose global epoch impact | Broad read and conservative epoch consciously retained |
| Setup facts are collapsed into connected/ready | Evidence and authority bound a claim; who owns the missing link and usable recovery? | Separate operator/project/member/client prerequisites | Truthful unavailable state/runbook is adequate |

These are candidate refinements of current principles with concrete application evidence. They are neither a new team/framework nor a demonstrated improvement in reviewer effectiveness.
