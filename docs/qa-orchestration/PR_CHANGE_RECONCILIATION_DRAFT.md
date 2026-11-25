# PR change reconciliation — scoped specification draft

**Status:** Proposed, not implemented or approved. **Source baseline:** `development@93ca0d6` (24 November 2026). This extension refines FR-115–119, FR-124, R-ASE-06 and the existing Change Packet contract in canonical 01/03/04/05. It creates no second requirement, case, task, approval, graph, run or bug owner. The canonical package remains NOT FROZEN.

## Outcome and boundary

A coding agent creates a PR and submits its account of the change to Tesbo: the task/change identity, applicable existing records, proposed requirement and case changes, links, claimed coverage and evidence. Zyra independently inspects the exact PR revision and the authorized *pre-existing* Tesbo expectations before reconciling that account. Tesbo presents agreements, omissions, contradictions and uncertain product decisions as reviewable findings and stages justified candidates through existing native proposal owners. Human decisions and real executions remain separate. A successful analysis can report unresolved QA findings; operational success is not change readiness.

The PR provider owns code, PR identity and commits. FR-115/T-455 owns the changeset identity; the Change Packet is its assembled view. Existing Zyra/project tasks own work and review candidates. The graph is a versioned observation and relationship aid, not an expectation or coverage authority. Native Requirements, Test Cases, Knowledge Base, Runs, Bugs, Skills and FR-119 impacts retain their current owners.

## Verified reuse and new seams

| Needed capability | Current owner/evidence at baseline | Maturity | Disposition |
| --- | --- | --- | --- |
| Project change identity and cross-record references | FR-115/T-455 Change Packet contract, canonical 03 § revision 1.4.28 | Proposed contract; exact runtime not proven here | Extend existing changeset/task references |
| Graph change and case nomination | `behavior-graph/graph-change-review.*`, `qa-review-candidates.ts`, `qa-verification-gaps.ts` | Read-only bounded observation; four focused suites, 29 tests passed in this session | Reuse; never promote nomination to coverage |
| Requirement plus optional case/link candidate | MCP `stage_requirement_change_bundle` and native proposal task | Implemented staging; end-to-end PR integration unverified | Reuse human apply owner |
| Case, manual and policy candidates | MCP `stage_testcase_changes`, `propose_manual_revision`, `propose_policy_revision` | Implemented staging; authorization and exact Skills basis apply | Reuse; no direct machine approval |
| PR identity, exact-head ingestion and independent reconciliation | No complete owner verified in this audit | New orchestration seam | Extend source binding/change owner and Zyra tasks; do not add parallel store |
| Workflow status versus change readiness | Existing `assurance-pr-gate.yml` is scheduled/manual specification-assurance publisher | Different purpose; not this PR product flow | Add separate, truthful result projections without weakening that gate |

## Required sequence

1. **Bind submission.** After creating the PR, the coding agent submits the canonical project/change/task identity and stable provider repository ID, PR number, base/head SHA, declared intent and exact native record/proposal references through an authorized MCP path. A pre-PR change may exist under FR-115 and is bound later. Validate repository-to-project entitlement and fetch provider identity server-side; never trust an arbitrary URL or client-authored diff as proof. Duplicate deliveries with the same key return the same receipt; a later head is a new assessment generation under the same change.
2. **Independent first pass.** Before exposing the agent's proposed cases or interpretations to Zyra's analysis context, retrieve the exact diff and authorized approved requirements/policies, existing cases, manuals, graph relationships and relevant historical evidence. Record the bounded dependency frontier, retrieval gaps, source revision, effective Skill versions and separate observations versus inferred consequences. A model-only or semantic match cannot establish a normative requirement. If practical blinding is unavailable, record the contamination and weaken the independence claim.
3. **Reconcile.** Compare Zyra's first-pass inventory with the coding agent's submitted account. For each meaningful behavior/obligation classify `agreement`, `missing_from_agent`, `unsupported_agent_claim`, `contradiction`, `unknown_intent`, or `not_applicable`, with evidence and uncertainty. Search existing native identities before proposing new ones. A code behavior absent from an approved requirement is a candidate or a decision question, not automatically the intended requirement. Do not demand a new document in every domain: record evidence-backed unchanged/not-applicable/undetermined outcomes.
4. **Route work.** The one change/task view links FR-119 impacts and existing proposal tasks. Use their native writer and review gates for requirement/case/link and manual/policy candidates. A suspected bug is a triage finding in the existing task/Bug path; a failed execution retains its raw result and evidence, then becomes a confirmed Bug only after classification against expected behavior and environment/test reliability. Preserve rejected, duplicate and no-change dispositions. No agent can apply, approve or publish merely because it authored or reviewed a candidate.
5. **Execute and revisit.** Authorized manual/automated Runs link case version, target build/environment, source/head where supported, evidence and result to the change. Designed, linked, selected, attempted and passed coverage are distinct. A push or relevant approved-record revision supersedes the current assessment; older receipts stay historical. Reassess current head, retain proposal continuity only if its exact base/Skill/target remains valid, and never silently replay a mutating proposal.

## Result contract

Return two orthogonal axes on the exact head: `assessment_health = completed | partial | failed` (transport, authorization, bounded analysis and durable receipt) and `change_readiness = ready_for_authorized_decision | findings_open | insufficient_evidence | blocked | not_assessed`. `completed` may accompany `findings_open`. `partial` or `failed` cannot be shown as zero findings. A pass on the operational check means the bounded assessment was durably saved, **not** that the PR is safe or all tests passed. A separately configured readiness check may block merge under explicit project policy; it cannot be inferred from a green operational check. Include scope/frontier, unexamined areas, counts by actual lifecycle state, proposal/task links, and evidence freshness. The provider status is bound to the actual current head SHA and becomes non-current when the head changes.

## Trust, concurrency and cost

- Verify webhook signatures/provider installation, tenant/project/repository binding and minimum read/check permissions. PR text, code, agent task content and retrieved KB are untrusted data. Do not execute PR code in a privileged webhook/check publisher. Use an isolated authorized executor for testing.
- Use one generation per `(project, repository identity, PR number, head SHA, source/configuration revision)` with idempotent delivery. Fence late workers and prevent an older generation publishing the current verdict. A retry resumes or supersedes explicitly, preserving uncertain write outcomes.
- Bound changed-file analysis, graph traversal, model calls, test selection and execution budgets. Report truncation and unsupported language/source semantics as partial scope, not no impact.
- Pin actor, model/skill/version/digest, approved expectation versions, graph capture, proposal revision, source and execution provenance. Specialist agents may later receive bounded task scopes; Zyra reconciles their distinct evidence and disagreements under the same task owner. Agent count or consensus is not proof.

## Acceptance scenarios to specify and execute during implementation

| ID | Scenario | Required observation |
| --- | --- | --- |
| PRR-01 | Agent submits matching requirement/cases for a PR | Independent first pass and comparison recorded; matching native IDs reused; no unnecessary proposals |
| PRR-02 | PR changes an authorization branch omitted by agent | Finding cites diff and approved rule; case/requirement candidate staged in existing task; operational assessment can complete while readiness has findings |
| PRR-03 | Agent claims a case covers change but only an old run exists | Designed/linked versus current executed evidence remain distinct; no passing-coverage claim |
| PRR-04 | Code introduces behavior without authorized expected outcome | Unknown product decision and plausible alternatives recorded; no AI-authored requirement becomes approved |
| PRR-05 | Failure arises from test/environment flake | Raw execution and triage preserved; no automatically confirmed product Bug |
| PRR-06 | New push arrives during analysis or after proposals | Old generation cannot publish current verdict; stale candidates guarded; new head assessed without losing history |
| PRR-07 | Fork or wrong project, forged webhook, denied MCP grant | No cross-project data or mutation; truthful failed/partial health and no readiness success |
| PRR-08 | Missing/truncated diff, graph, Skills or run data | Explicit unexamined scope and insufficient evidence; no false zero-gap result |
| PRR-09 | Human rejects proposal or accepts only one part | Native owner preserves exact decision; remainder stays open; Zyra cannot self-approve |
| PRR-10 | Supported no-impact refactor | Evidence-backed bounded no-impact disposition; no mandatory new artifact or execution claim |

## Decisions and validation still open

1. Which native task subtype can anchor a change with many proposal tasks and PR generations without conflating review-task approval? Inspect actual Zyra task schema/writers and FR-115 implementation before migration design.
2. Choose GitHub App webhook/Checks versus a repository Action for the initial adapter after verifying current source binding and permission deployment. The assurance engine remains provider-neutral; an optional Action can submit CI evidence. No privileged PR checkout.
3. Define project policy for an optional *readiness* merge gate, including human exceptions, partial/unknown results and a no-tests-applicable disposition. The operational check is never a release approval.
4. Prove first-pass independence empirically with seeded omissions, contradictions and correct submissions; measure important misses, false findings, review effort, latency and cost under FR-124. Existing 29 focused tests do not prove this workflow.

**Implementation state:** This file is a design draft only. No native Tesbo write, live PR assessment, end-to-end execution, GitHub App installation or merge gate was performed for this extension.
