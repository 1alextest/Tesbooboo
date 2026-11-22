# Source guidance for the planning task

This is an unchanged excerpt of the original principle-distillation method, NesberryEnterprise/Nesberry@d83549c85a4dcd047fb40dc4fba4ec62737ab0fc, .kiro/steering/teams/review-orchestration.md. Apply its reusable reasoning to the target facts; no originating application policy is imported.

## Principle-First Distillation Rule — mandatory

Canonical team methodology MUST generalize from incidents rather than memorize the latest feature failure.

When a review discovers a defect, missing requirement, or architecture mistake, distill it through:

```text
CONCRETE OBSERVATION
        ↓
BUSINESS CONSEQUENCE
        ↓
FAILURE CLASS
        ↓
UNDERLYING INVARIANT
        ↓
DOMAIN-AGNOSTIC PRINCIPLE
        ↓
REUSABLE REVIEW QUESTION
        ↓
FEATURE EXAMPLE / PLAYBOOK
```

The incident that exposed a principle is evidence and an example. It MUST NOT become the canonical rule unless the rule remains useful after removing the original feature names, UI labels and domain nouns. Renaming nouns is insufficient: preserve the failure mechanism, applicability, invariant and discriminating evidence. Label examples so they neither define the complete problem space nor introduce hidden requirements.

Before adding a rule to a canonical team charter, ask:

1. Would the unchanged principle detect the same failure mechanism in an application outside the originating domain, with materially different architectural constraints?
2. Does it identify an invariant, applicability condition and required evidence rather than prescribe the original control, screen, stack or fix?
3. Does it survive removing the original feature names and local policy assumptions while still detecting the original failure?
4. Can it distinguish a defective case from a conforming neighbor, accept a valid alternative design, and preserve UNKNOWN when evidence is absent?
5. Could it discover an unfamiliar sibling failure, and does an existing principle already express it? Refine or reinforce that owner before adding another rule.
6. Are application policies, bindings, trade-offs and examples explicitly distinguished from the reusable obligation? Keep detailed incident records with their review package; a labelled example may explain the core without adding authority.

**Admission evidence for a new or materially changed core obligation:** attach a bounded transfer receipt to the methodology review. Record the mechanism/invariant, trigger, review question, evidence/oracle, owner and limitations; the originating regression; and cases from at least two other application contexts, including an applicable case outside the originating domain and different architectural constraints or a justified N/A boundary. Include a defective/conforming pair, a valid counterexample to an overly broad reading, and missing-evidence treatment. Hold the core wording fixed while applying it; a semantic correction requires rerunning affected cases. Mere renaming should preserve the relevant verdict; changed semantics may change applicability. Report conceptual scenarios separately from repository/tool/runtime execution. No percentage or framework-wide portability claim follows from a small scenario sample.

If a finding cannot meet this admission test, retain it as an application policy, example, test or candidate in the existing owner; do not turn it into a universal rule. Distillation can strengthen an existing question, applicability condition or regression without adding a new principle. Generalizing a reasoning contract does not by itself justify new shared infrastructure.

### Anti-overfitting guard — demonstrate transfer, not resemblance

**Refined 2026-11-12 — founder correction:** an incident-shaped checklist does not become an agnostic principle by
replacing its nouns or adding more examples. Apply this guard when writing or materially changing a reusable
principle, rule, skill or checklist, not only a team charter. This sharpens the admission contract above; it does not
require every scoped principle to detect every failure family.

1. **State the mechanism before examples.** Name applicability, the invariant, the decision/question it changes,
   evidence that would refute it, and legitimate exceptions. Remove the originating examples: the next reviewer
   must still be able to derive a concrete check. "Check everything" and "ensure it works" fail this test.
2. **Freeze the wording, then select unlike cases.** Choose from a capability/risk inventory, not the incident's
   screens or component names. Within the existing transfer receipt, use at least two non-origin capability
   families with different user outcomes or state/effect boundaries; retain the cross-application and architectural
   conditions above. Similar screens, renamed fixtures and repetitions of the known defect do not supply this evidence.
3. **Derive before looking.** Record the check, oracle, expected effect and forbidden effect before inspecting the
   selected implementation/result. At least one probe must not have been used to author the rule. If prior issue
   knowledge or required pre-reading removes independence, disclose it; do not call confirmation discovery or held-out
   validation. No new defect is required: a justified conforming result or named evidence gap is informative.
4. **Try to reject the rule.** Keep the original regression, defective/conforming pair, valid alternative and
   missing-evidence case. Surface resemblance alone is not a defect; neither implementation nor existing code is
   automatically the oracle. A rule that demands uniform interfaces, mandatory persistence or the original fix
   irrespective of the target contract fails admission. Rerun affected cases after any semantic revision.
5. **Keep an auditable disposition.** Record fixed wording/revision, case-selection provenance, generated check,
   oracle, evidence mode, observed result and limits. Known-defect replay establishes regression sensitivity, not
   novel discovery; a hypothetical example is not an executed check. If all supporting cases remain in the origin
   family, retain a scoped checklist/candidate rather than advertise demonstrated generality. Never attribute
   earlier findings to a later rule without an actual comparative evaluation.
   A scope claim spanning variants, consumers or quality dimensions also needs evidence for that applicability set;
   one conforming example or one passing dimension cannot certify the rest. Disclose sampling and untested targets.

**User-perspective check for user-facing principles.** When a rule claims to protect a person's experience or outcome,
the fixed wording must let a tester derive a concrete, unrelated journey: the actor's goal and starting knowledge,
what is visible at a decision, expected and forbidden outcomes, attempted action, subsequent consequence and an
applicable recovery or missing-path question. Compare a failing case with a valid alternative and preserve UNKNOWN
when evidence is absent. Record a test or evidence plan before implementation details are used as the oracle. A
synthetic persona's preference is a hypothesis, not proof of human behavior or a new product policy. For a rule
about a non-user-facing mechanism, apply this check to its actual actor/consumer and observable outcome instead of
inventing a human journey. A plausible story without a discriminating check fails this guard.

**Guard status:** mandatory manual admission review, not a semantic CI detector. A heading/keyword/count lint cannot
establish causal transfer. An agnostic scope claim without this receipt is unvalidated; a bounded receipt is not proof
of universal effectiveness. Keep the receipt with the methodology review, not in another principle registry.

**A binding rule records only decided ground** *(G1 freeze, White's round 2, 2026-10-11)*. When a review folds a
finding into a binding guard or charter, every clause must rest on a decision already made. A clause that depends on a
decision still open is written as PROPOSED, naming the decision it waits on, and becomes binding only when that
decision lands.
- *Principle:* a binding rule that runs ahead of an open decision either pre-empts the decider or ends up
  contradicting them, and then the old rule and the new decision both stand.
- *Philosophy:* a guard serves a decision; it never makes one.
- *Evidence:* on 2026-09-28 a guard named a posting gate as a protection a self-declared form must never narrow. The
  decision on what that gate keys on was still open, and two founder records said otherwise: the gate's own scope,
  ratified before G1 was drafted, and a decision of the same day keeping that work on the other form. The founder then
  keyed the gate on the form, so the binding guard contradicted three founder records
  (`work-marketplace/_INPUT_g1-relationship-form-and-basis-carriers.md` §8 D3, §9 R6).

