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
