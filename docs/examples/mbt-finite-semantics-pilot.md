# Model Studio offline finite-semantics pilot

This executable specification checks a bounded subset of MBT-C-01/04 against hand-calculated fixtures before native integration. Run from the repository root:

```sh
node --test docs/examples/mbt-finite-semantics-pilot.test.mjs
```

The pilot uses only Node built-ins and makes no network, database, filesystem-data or target-application calls. It is not a production generator, native task runner, supported import format or new authority. It has no model approval, publication, credentials, execution, persistence, human-grant or VERIFIED capability. Its JSON schema is deliberately pilot-specific, not the final MBT API contract.

It implements explicit finite shared/actor-local valuations, pure typed allowlisted expressions, simultaneous pre-state assignments, guards, source/destination invariants, pre/postconditions, fresh baseline construction and deterministic bounded configuration-reachability proposals. Transition ordering uses UTF-8 ID bytes. Full configuration identity includes shared values and all actor-local values. A false guard is infeasible; invalid types/assignments/invariants are errors. Temporal/concurrent/eventual semantics explicitly return UNSUPPORTED_SEMANTICS.

`COMPLETED` means the finite configuration-discovery frontier was exhausted under this strategy. It does not mean all possible paths/transition pairs were enumerated, any real operation ran, a complete model was approved, or any target behavior passed. Work/depth/path limits produce PARTIAL with an explicit reason. The manifest is deterministically hashed and labeled SYMBOLIC_ONLY. There is no random/stochastic strategy or resume frontier; seed/shrink/real scheduler/provider budgets and emergency resource-interruption proofs are outside this pilot. Numeric caps protect these tiny local fixtures and do not set production quotas or p95 objectives.

Two domains are represented: a shared-last-unit reservation with independent actor counters, and a document approval/rejection lifecycle. They are synthetic models, not deployments of two applications. A deliberately incorrect reservation effect is compared against a separately hand-specified expected remaining value to demonstrate non-vacuity; it does not establish real target conformance. Mutation trials additionally alter effect application, actor scoping and work-budget enforcement in temporary copies and require the check suite to reject each variant.

The expected-behavior identity remains the FR-117 family/revision owner under MBT-C-12. This pilot does not introduce a competing expected-model store. Its interpreter/traversal is an experiment, not a dependency/adoption decision. A maintained-library fit/benchmark, source-owner census, ratified policy, native version/attempt/evidence integration, actual DB/race/API/UI tests, authorized adapters, independent oracle and real two-domain observations remain required before production adoption. Existing Tesbo e2e instructions apply to any future product changes; these local symbolic checks do not replace them.
