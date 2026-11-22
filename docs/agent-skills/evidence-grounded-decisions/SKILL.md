# Evidence-grounded decision engineering

**Status:** Adopted guidance. **Scope:** Coding, UX/UI, specification authors, Claude/other agents, and assurance teams. Principle-first and application-agnostic; project details are examples, not universal rules.

## Governing principle

When a change depends on an unsettled consequential decision, do not silently manufacture product policy or ask an ungrounded multiple-choice question. Reconstruct the applicable decision context, distinguish evidence from assumption, identify who has authority, and communicate why the decision matters. Continue independently where a prior authoritative rule resolves the ambiguity; request human judgment only for genuinely unresolved or authority-reserved decisions. A question is a traceable engineering artifact.

## Proactive decision discovery — mandatory for every agent and subagent

**Core capability:** Do not merely explain the trigger of an already-supplied question. Independently detect when a consequential question *ought* to exist, including when nobody asked one. Question discovery is an agent reasoning obligation; question presentation (Claude UI, MCP, CLI, issue, or another channel) is a separate transport capability. Never assume that only the coordinating Claude agent may originate a decision gap.

### Discovery signals (examples, not a checklist ceiling)

- Missing acceptance criteria, unstated business intent, undefined states, transitions, audiences, or failure behavior
- Two legitimate contracts that conflict; policy/code/UI drift; observed behavior that lacks an authoritative oracle
- More than one defensible product outcome with materially different consequences
- Hidden assumptions embedded in names, defaults, data models, mocks, code branches, or UX copy
- Change propagation across parents/children, permissions, lifecycle transitions, search, caches, interfaces, documents, external services, or human outcomes
- A negative-space question: who or what is excluded, what never happens, what remains visible or persisted, or what happens when the premise is reversed
- Competing stakeholder interests, privacy/security implications, irreversible changes, financial effects, and uncertainty about who may decide

### Discovery obligation

Every agent examines its actual work through its specialist lens, looking for evidence of an unmade consequential decision even when its input appears to be an implementation-only task. When a signal is found:

1. Name the **candidate decision gap** and its provenance; distinguish observed evidence, reasonable inference and unknowns.
2. Search existing authoritative decisions before escalating; a known rule is not an open question.
3. Determine whether the choice is routine delegated discretion, an unresolved product decision, a conflict requiring reconciliation, or an authority-restricted judgment.
4. Identify plausible human outcomes and downstream consequences. Do not assume the local symptom defines the full policy.
5. Surface a candidate to the coordinating agent or existing project decision record, even when the subagent has no interactive ask-user tool. Never quietly bury it because the agent cannot display a question.
6. Deduplicate overlapping candidates and escalate only genuine unresolved consequential choices using the decision brief below. Preserve non-blocking questions without stopping independent safe work.

**Do not require agents to invent questions or overwhelm the user.** A legitimate outcome is “no unresolved decision found, within the inspected scope,” never a claim of absolute completeness. Absence of an obvious question is not proof that no question exists.

### Transport-independent interface

A subagent's minimal handoff is: `candidate_decision`, `origin/evidence`, `why_not_resolved`, `affected_outcomes`, `authority_needed`, `urgency/blocking_scope`, `confidence/unknowns`. The orchestration layer decides whether to ask interactively, open a task/issue, attach to a review artifact, or resolve from existing policy. Do not imply that every runtime supports the same UI or that an MCP write is available.

### Illustrative discovery, not merely explanation

For a seller-profile visibility issue, an agent could independently notice that suspension hides credentials while other non-public states do not. Before anyone asks “what should paused show?”, it should discover the missing publication-eligibility policy and the independent credential/content approval dimension. The first engineering success is **recognizing the decision gap**; only then come evidence gathering, impact analysis, authority, question presentation, and recording the decision.

## At the decision point

1. **Recognize:** distinguish implementation discretion, established product policy, contradiction, missing requirements, and high-impact uncertainty. Do not convert an observed bug into an assumed requirement.
2. **Investigate:** consult relevant specs, existing code/runtime behavior, policies, prior decisions, security/access constraints, tests, lifecycle rules and linked records, to the extent available and permitted. Label missing evidence; never imply an investigation occurred when it did not.
3. **Explain the trigger:** cite the issue/requirement/observation and the exact conflict or unknown; explain why a decision is needed now.
4. **Assess consequences:** identify affected actors, permissions, records, state transitions, entry points, APIs, discoverability, caching, dependencies, reversibility and potential downstream obligations. Distinguish changing underlying record state from changing visibility or access.
5. **Present options:** state meaningful alternatives, a recommendation grounded in evidence, trade-offs, risks, assumptions, confidence and the cost of deferral. Avoid false certainty and forced choices; allow a user-authored decision.
6. **Respect authority:** independently resolve decided implementation details; seek authorized human judgment for unresolved product policy, consequential trade-offs, trust boundaries and other reserved decisions. Never use agent consensus to replace product ownership. Do not block unrelated safe work; do not turn every detail into an approval request.
7. **Preserve the decision:** record trigger, evidence references, rejected alternatives, decision-maker, rationale, scope, affected obligations, residual unknowns and change conditions in the project's existing authoritative records. Align implementation, coverage and documentation with the decision. Reopen only on new material evidence or changed context.

## Decision-brief contract (concise, proportional to risk)

- **Why now:** concrete trigger and what remains unresolved
- **Known / inferred / unknown:** sources with freshness and confidence; never invent findings
- **Recommendation and alternatives:** rationale, trade-offs, risks, reversibility
- **Impact map:** users, states, permissions, parent-child records, APIs, UI, search, cache, dependent behavior
- **Authority and action requested:** who decides, what exactly needs approval, and what can continue
- **After decision:** record location, implementation consequences, visibility of residual risk

## Example — seller public visibility (illustrative, not a pre-approved policy)

A reported issue says credentials and portfolios remain publicly visible when a seller profile is paused, under review or rejected, while suspension hides them. A bare prompt offering “hide unless active,” “hide only rejected/suspended,” and “leave as is” misses important evidence and consequences. The agent should identify the observed behavior as reported (not independently verified), seek current publication/moderation policy, distinguish profile lifecycle, publication eligibility, individual credential approval, and viewer permissions, and identify public profile/listing pages, direct URLs, API reads, discovery indexes and caches. It should recommend a policy only with stated assumptions, ask the authorized product owner if the rule is unresolved, and preserve the final decision. Hiding public visibility should not implicitly delete or rewrite underlying records; owner/reviewer access may differ according to actual policy.

## Cross-role application

- **Coding agents:** investigate contract ownership, choose only delegated implementation details, propagate approved obligations to code, tests and documentation.
- **UX/UI agents:** design decision prompts that show trigger, evidence, consequences, uncertainty, recommendation and genuine alternative choices; do not present unverified impact as fact. Keep human effort proportional, and do not replace real UI with invented mock data.
- **Blue:** find prior authoritative decisions, source truth and reuse. **Red:** challenge framing and hidden assumptions. **Green:** trace seams and second-order effects. **Grey:** inspect user journeys, role-specific outcomes and recoverability. **Purple:** check interface truth, comprehension and accessible decision presentation. **QA:** identify state transitions and negative/boundary scenarios. **Security:** identify trust boundaries and disclosure risk. **Graph:** check semantic obligations and change consequences. **White:** confirm decision authority, completeness and unresolved blockers. **Elephant-Gold:** independently inspect blind spots. Other teams apply the same principle within their charter.

## Distillation and evolution

Generalize the failure mechanism, not the seller-specific nouns. Keep the principle stable across domains; contextualize against each product's true policies. Record human feedback on the usefulness of a decision brief and refine the living skill without treating one approval as universal proof. Do not mandate a separate skill-validation campaign for adopting this instruction.
