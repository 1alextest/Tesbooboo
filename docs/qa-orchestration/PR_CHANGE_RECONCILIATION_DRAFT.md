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

## Decision discovery and human review contract

The agent must **discover** underdetermined product decisions, not merely relay questions supplied by a coding agent. Generate possible decision points from observed changes to state transitions, authorization, ownership, data lifecycle, concurrency, money, trust boundaries, failure/retry behaviour and human-facing meaning. For each changed behaviour, compare current approved intent with alternative interpretations and their observable consequences. A missing decision is not necessarily a requirement defect: classify it as an evidence gap if an authoritative source cannot be retrieved, and as a genuine `decision_required` only when at least two materially different interpretations remain plausible after source review.

Decision detection is a separate pre-reconciliation pass. Its inputs are the exact bound diff, approved expectation versions and authorized historical evidence, **not** the coding agent's explanation or proposed tests. Invalidate or label independence when tool/context contamination occurs. Record false-negative probes, not only the questions the model happened to generate. Required triggers include a newly reachable transition, altered negative path, changed default, changed permission/consent, altered retention or revocation, changed version/approval owner, incompatible client behaviour, and a new user-visible status or label with uncertain meaning. A changed file alone is not proof that any trigger applies.

Each reviewable finding has a durable native task/reference and an evidence-backed record containing: specific affected journey and actor; observed behaviour; approved rule and its exact version (or explicit absence); competing interpretations with expected observable outcomes; impact/severity and reversibility; ownership of the pending decision; proposed verification probes; confidence/unknowns; and the exact source/head/Skill context. Keep detection evidence distinct from the agent's submitted claim and from the human decision. If no authorized decision-maker is identifiable, escalate through existing project governance instead of electing an AI team as owner.

**Information hierarchy for the reviewer:** show the human goal and changed outcome first, then the concrete conflict or decision and what happens if each option is chosen, then existing approved intent and actual evidence, then recommended next action. Put commit hashes, scanner references, graph paths, source excerpts, raw token usage and internal task mechanics in expandable provenance. Do not present opaque statuses like “Version 3 awaiting review” without the artifact purpose, changed fields, impact and action available to that reviewer. Do not make an unanswered question look like a defective feature or a pre-approved requirement. Use existing native proposal diff/version/approval UI where available; this is a specification for its contextual presentation, not a second UI system.

A reviewer may select an interpretation only with the native authorization appropriate to that decision. Record `accepted`, `rejected`, `deferred`, `superseded`, `duplicate` or `needs_evidence` with actor, target version, rationale and linked native proposal. Approval of a decision does not approve code, a Test Case, a Skill version or a release automatically. Any subsequent code or normative revision requires new exact-version validation. If there is an unresolved high-consequence interpretation, readiness cannot become `ready_for_authorized_decision` merely because analysis ran successfully.

## Authoritative findings and freshness

Reconcile **three separate** evidence layers: native PR review threads (including outdated unresolved threads), authoritative scanner/code-scanning alerts, and Tesbo's own independent findings. Do not treat a resolved GitHub thread as proof that the corresponding alert is closed, that its disposition was authorized, or that the scanner covered the exact source. Link them by provider alert identity and source revision, preserving many-to-one or unmatched relationships. Missing scanner credentials, API pagination, skipped analyzers, stale SARIF or ambiguous alert identities produce `insufficient_evidence` or `blocked`, never a clean finding count. Scanners may report deliberate rejection fixtures; contextual explanation is evidence for independent triage, not blanket suppression.

For every approval/readiness evaluation, read back the provider's current PR head and relevant approved-record/Skill revisions; fence decisions against the captured generation. Findings arriving after status publication or resolution changes without a new commit require fresh reconciliation. A GitHub branch rule requiring thread resolution and a trusted exact-head check are complementary controls, not substitutes. Preserve existing assurance gate ownership; do not create another self-publishing green check or let a bot change repository protections.

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
| PRR-11 | Change silently alters consent/revocation or negative-path default with no agent question | Independent decision discovery generates competing consequences and an owned review question before reconciliation; no AI-selected intended behaviour |
| PRR-12 | Human opens a candidate with only a version number and internal metadata | View shows purpose, user consequence, precise saved-field changes, authoritative expectation, uncertainty and allowed action before raw provenance |
| PRR-13 | Scanner alert persists after PR thread resolves, or later same-head alert arrives | Unmatched authoritative alert blocks readiness; check refreshed; thread closure alone never clears it |
| PRR-14 | Scanner rejects inputs, lacks permissions, or yields incomplete SARIF | Health may be partial/failed; coverage explicitly unknown; no clean scanner result or bypass |
| PRR-15 | Human decides one interpretation while source or approved Skill changes | Decision history retained, stale candidate cannot apply, assessment reruns under the new exact version |

## Decisions and validation still open

1. Which native task subtype can anchor a change with many proposal tasks and PR generations without conflating review-task approval? Inspect actual Zyra task schema/writers and FR-115 implementation before migration design.
2. Choose GitHub App webhook/Checks versus a repository Action for the initial adapter after verifying current source binding and permission deployment. The assurance engine remains provider-neutral; an optional Action can submit CI evidence. No privileged PR checkout.
3. Define project policy for an optional *readiness* merge gate, including human exceptions, partial/unknown results and a no-tests-applicable disposition. The operational check is never a release approval.
4. Prove first-pass independence empirically with seeded omissions, contradictions and correct submissions; measure important misses, false findings, review effort, latency and cost under FR-124. Existing 29 focused tests do not prove this workflow.

**Implementation state:** This file is a design draft only. No native Tesbo write, live PR assessment, end-to-end execution, GitHub App installation or merge gate was performed for this extension.
