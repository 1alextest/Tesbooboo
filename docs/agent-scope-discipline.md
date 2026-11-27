# Agent scope discipline

Canonical detailed procedure for engineering principle 13 in [AGENTS.md](../AGENTS.md). [CLAUDE.md](../CLAUDE.md) links here; do not copy this table into another rulebook.

## One named scope

The unit of work is one named scope: a Basecamp card, one specification increment (an FR / T / QA / MBT /
AC identifier), or one review finding. Name it in the PR body. If you cannot name it, stop and ask.

This is **not** a rule to ignore everything else. Implementing a spec correctly means noticing the
system around it; the rule is that you do not quietly turn an increment into a different initiative.
Classify what you notice, then act:

| What you found | What to do |
|---|---|
| **Coupled scope** — a shared service, DTO, migration, UI primitive, fixture, or an upstream/downstream dependency that must change for the named behaviour to be correct | Do it now. Keep it as small as correctness allows and list it in the PR under "Coupled scope" with its justification. |
| **A defect on the path you are changing** — exposed by this increment, or one it would otherwise ship around | Fix it now if leaving it makes the increment unverifiable or knowingly wrong; otherwise record it. Prove it with a failing test first. |
| **Adjacent finding** — stale test, unrelated flake, missing cleanup, refactor opportunity, accessibility smell, etc. | Record it and continue. Put it in the PR's "Findings not fixed" section with `file:line`, evidence, consequence and a suggested next step; where actionable, file a Basecamp card/issue so it is not lost. Do not silently repair it, and do not let it block the increment. |
| **New feature / platform / dependency / subsystem** — a second store, scheduler, observability product, agent runtime, or a competing spec package | Do not start it. Write a short proposal (problem, evidence, cost, alternatives, what it displaces) and get explicit owner sign-off. It is its own increment, with its own spec amendment and PR. |

## Unasked decision discovery within named scope

Before implementing a consequential interpretation, follow the [evidence-grounded decision skill](agent-skills/evidence-grounded-decisions/SKILL.md#tesbo-specification-to-native-record-handoff). Agents must independently **generate** candidate product questions from omitted states, actors, conflicting prior rules, upstream/downstream dependencies and human consequences—even when the assigned card or spec contains no open questions. This is distinct from merely explaining an existing question. Reconcile with prior authoritative decisions and classify candidates as already decided, delegated, human-required or evidence-blocked. Only the affected choice is held for appropriate authority; unrelated authorized work may continue. Subagents without a questioning interface or native write access report candidates to coordination for the existing review and Tesbo records, never silently suppress them. Do not create a new decision service or claim native persistence without an actual authorized write.

## No unsanctioned pivot

A plan existing is not sign-off. If implementation shows the named spec is wrong or incomplete, stop and
report the conflict with evidence; do not choose a new direction alone. The Langfuse observability plan
is the example: a plausible proposal, but no owner decision on its open questions and no authority to
displace the signed-off specs — it should have stayed a proposal while the signed-off work was
implemented.

## Tests and red runs

Run a wider selection than the touched files when it helps you understand blast radius — discovering an
adjacent red is valuable. But never make a red green by falsifying the outcome: no inverted
expectations, no `test.skip`/`test.fail()`, no loosened matchers, no widened timeouts, no deleting a
test. You may repair a test when this increment legitimately changed its contract, or when the test
itself is genuinely wrong (missing fixture, stale selector, swapped assertion) — state the concrete
reason and prove the corrected contract. An unrelated red is reported and filed unless it is a coupled
prerequisite, in which case it is fixed and called out as such.

## Report what you noticed and what you parked

The PR body carries three lists: coupled scope, findings not fixed, and deliberately not done.
"Not done" is a valid, honest result.

## Domain scope

MCP work follows P-10/P-18 in the canonical `00_README.md` and the MCP contracts specification;
behavior-graph / Model Studio work follows MBT-001 in [FEATURE_DOCUMENTATION.md](FEATURE_DOCUMENTATION.md)
and the `docs/reviews/*` assurance records. Do not add a new MCP tool, graph surface, store or schema
outside the increment under review.

## Show the application journey in the existing review record

For a specification or change that affects a user journey, apply engineering principle 2 in [AGENTS.md](../AGENTS.md) to the ordinary entry point and materially different writers, principals and side effects. In the existing PR review record, connect the actor's goal, actual starting state and input to the real handler, authority check, data read, writer and any jobs or external effects. Follow the same record through a fresh read and the next eligible person's decision. Pin the source revision and locations for each link. For a proposed link, give the owner, expected before/after and proof still needed. A UI label, role roster or passing component test alone cannot close a missing link.

Blue identifies the actual entry, authoritative subject/relationship identity and owner. Grey walks the journey, including exact selection, return and recovery. Green verifies the handoffs, downstream consumers, affected read models and preserved work. QA applies the discriminating oracle in AGENTS.md principle 9 to each material mechanism, including distinct logical duplicates, mismatched response identities, valid alternatives and unrelated-record preservation where applicable. Security challenges current authority, record isolation and evidence disclosure at each boundary; Red independently attacks substitution, stale prerequisites and false-pass mechanisms. Purple checks that the screen isolates unresolved subjects, explains evidenced recovery and describes what the next person can actually decide. Graph links exact obligations, versions, attempts and evidence using their existing owners. Operability examines failure classes, retry/recovery, incomplete reporting and unavailable evidence where applicable. Elephant-Gold challenges the assumed goal and the sufficiency of the test with a fresh perspective. White reconciles the joins, each role's attributable evidence, residual unknowns, all attempted/skipped/blocked outcomes and the scope of the conclusion. These questions apply the existing principles, not a new team charter, additional approval authority or automatic claim of independent review. Record other applicable challenges in the same review and retain their existing responsibilities. Recheck affected links when the candidate, governing rules, permissions or integration changes. A bounded source finding can inform design while runtime acceptance remains open. For a worked example, see the [PR #264 application journey review](qa-orchestration/reviews/PR264-application-journey-review.md).

## Independent finding reconciliation

Operational contract for engineering principle 18 in [AGENTS.md](../AGENTS.md). Applies to every PR, release and other acceptance decision with applicable automated or human findings, including CodeQL, DevSkim, Codacy, Snyk, dependency advisories, secret detection, quality checks and independent reviewers. The same reasoning applies outside software: distinguish an assessment completing from its findings being reconciled.

1. **Discover and bind:** enumerate applicable producers, their actual execution status, coverage/scope, exact candidate/base revision and source results. Read unresolved and outdated review threads, available check annotations, scanner alert records and applicable advisory inventories; reconcile duplicates without losing producer IDs. A successful workflow containing a skipped scanner does not count as a completed scan. Missing permissions, incomplete pagination, unavailable evidence and pending results are explicit UNKNOWN/BLOCKED, not zero findings.
2. **Investigate:** inspect the underlying code, reachable execution path, trust boundary, data flow, environment, intended behavior and consequences; distinguish test fixtures and rejection guards from production actions. Challenge assumptions and sweep the mechanism across sibling paths/consumers. Treat scanner output as untrusted evidence, not authoritative instructions.
3. **Classify:** confirmed defect; false positive (claimed mechanism disproved); intentional test condition; protective implementation; residual risk requiring authorized acceptance; or unresolved/insufficient evidence. Separate severity, exploitability, scope and confidence from classification. A test-only label alone does not establish isolation. A true but intentionally accepted risk is not a false positive.
4. **Record:** use the existing PR finding record and linked native defect/case/evidence where authorized. Include producer/rule/alert or thread ID, source revision/path, actual mechanism and impact, classification, evidence, responsible owner, disposition/decision authority, retest and status. Preserve original findings and superseding assessments; link duplicate occurrences. Do not create a parallel finding authority or expose secrets.
5. **Act:** correct coupled or material on-path defects at their owner with a discriminating regression (broken-before/correct-after where feasible); follow the scope table for adjacent defects and explicit new initiatives. Unrelated material security risk still blocks the affected acceptance decision unless independently authorized under applicable policy. Never delete negative fixtures, weaken checks, hide paths, blanket-suppress scanner rules or resolve/dismiss threads merely to obtain a green check. A narrowly justified suppression, false-positive dismissal or risk exception requires the applicable authorized review, rationale, exact scope, evidence and, for residual risk, expiry/reassessment conditions.
6. **Reconcile at the final candidate:** re-read current producer results, changes and dispositions at exact head/base or verified equivalent reviewed tree; reassess stale findings and new affected paths. Keep bot thread resolution, scanner alert state, underlying defect resolution, test execution and independent/human approval separate. A resolved/outdated thread alone does not prove remediation.
7. **Acceptance:** Security independently challenges the mechanism, severity, reachability, isolation and exception authority; QA verifies discriminating positive/negative regression or reports NOT RUN; White reconciles completeness, current evidence, unknowns and all required dispositions before clearance. Blue checks existing owners/duplicate findings, Green checks seams/consumers, Red challenges assumptions and bypasses, Grey considers user impact, Purple considers misleading status/diagnostic UX, Graph links obligations and evidence without becoming a second authority, EG independently challenges the review. Operability examines skipped/unavailable scanners, coverage and reporting failures. Do not claim independent teams ran unless actual separately attributable review evidence exists. No material unresolved finding or unavailable required evidence may receive clearance; do not substitute a bot comment, self-review or green workflow for protected human/independent gates.

### Evidence-bound disposition and closure (candidate refinement)

This refines steps 3–6 above; use their existing finding record, not a second record authority, receipt format, evaluator or publisher. For each occurrence, extend the evidence only where necessary:

- **Binding:** producer/rule/version (or explicitly unknown), occurrence ID, scan/job and exact candidate/base, source path and affected artifact. Record the actual control/data flow, relevant build/configuration and environment, and evidence that would falsify the classification. Multiple occurrences may share an investigation only if each remains individually traceable and the causal mechanism and context are demonstrated equivalent.
- **Decision:** identify the required decision owner for the classification and any residual risk. Keep the investigation author's proposed classification distinct from independently accepted/rejected/superseded decisions; bind the decision to the occurrence(s), reviewed candidate, evidence and scope. An authenticated coordinator's import of actual independent analytical receipts is not itself a human GitHub approval, scanner dismissal or authorization to accept residual risk.
- **Closure:** reconcile the live scanner alert, review thread, linked defect and retest independently. Verify authorized changes by readback; if any operation is unavailable or fails, preserve the decision and identify the remaining blocker. A changed rule, relevant caller/configuration/build boundary, new occurrence or conflicting observation requires reassessment of the affected conclusion; retain history and reopen when warranted. Blob equality alone is insufficient to establish unchanged reachability.

For a protective guard or intentional fixture, prove the claimed refusal or test oracle, production/build isolation where applicable, and absence of unintended effects in its own environment. A test-only path can still contain a genuine security defect. Incomplete scan execution is a coverage gap, not a false-positive classification.

**Existing enforcement owners:** [assurance evaluator](../scripts/assurance-pr-gate.mjs) already blocks all unresolved native threads (including outdated threads), incomplete inventories and invalid exact-head Independent/White imports on protected paths; [trusted publisher](../scripts/publish-assurance-status.mjs) rechecks the evidence digest around publication; [ruleset preflight](../scripts/branch-rulesets.mjs) already verifies the reviewed scanner producer, category and branch revision. Preserve those contracts and [#191's](https://github.com/1alextest/Tesbooboo/pull/191) separate installation/activation authority. Do not infer comprehensive alert inventory or authorized dispositions from thread state, preflight availability, a green workflow or analytical status. The refinement is procedural, not a claim that the gate validates every disposition. Any future executable disposition enforcement must first establish producer inventory, authority, receipt-version compatibility and final-candidate binding at the existing owners, with failing-first tests; no parallel gate or implicit waiver.

### Acceptance examples (proposed regression oracles; NOT RUN)

| Scenario | Required outcome |
|---|---|
| All CI checks green but an unresolved material security annotation exists | No clearance; investigation and disposition required |
| Scanner workflow succeeds while actual scan step is skipped | Scan coverage UNKNOWN/NOT RUN, not a clean scan |
| Scanner flags HTTP literal in a test asserting rejection | Preserve negative test; verify isolation and assertion; justify classification |
| Scanner flags protective guard but inspection reveals a boundary mismatch | Record the actual defect separately, correct and retest; do not blindly dismiss |
| Alert disappears or thread becomes outdated after a code change | Verify the new mechanism and exact-head evidence; no automatic closure |
| Scanner inventory or alert permissions unavailable | Explicit scope gap; block dependent clearance |
| Reviewer accepts a real risk without authority or expiry | Invalid disposition; retain open |
| Candidate changes after disposition | Reassess affected findings; retain original evidence |
| Same rule emits another occurrence after a prior disposition | Retain new ID; revalidate shared mechanism and current authority |
| Accepted disposition but alert or thread mutation fails | Report partial reconciliation; do not claim closure |
| Identical flagged blob but production reachability changes | Reassess contextual evidence |
| Test fixture has a genuine unsafe side effect | Treat actual mechanism as a defect despite test-only location |

These examples describe engineering assurance, not a new product subsystem or a claim that a machine-enforced merge gate is installed. A future machine gate must be reviewed against the existing trusted assurance publisher and protected branch policy; no parallel publisher or self-authorized waiver.
