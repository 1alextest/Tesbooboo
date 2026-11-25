# Evidence-grounded decision engineering

**Status:** Adopted guidance. **Scope:** Coding, UX/UI, specification authors, Claude/other agents, and assurance teams. Principle-first and application-agnostic; project details are examples, not universal rules.

## Canonical owner and purpose

[AGENTS.md](../../../AGENTS.md) owns the binding engineering principles, including principle 17 on discovering unresolved decisions and principle 13 on reporting findings within scope. Use this procedure to apply those principles across agents and roles. It supplies discovery, investigation, coordination, presentation and recording details; it grants no product permission and does not select unresolved product policy.

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
2. **Investigate:** consult relevant specs, existing code/runtime behavior, policies, manuals, task/issue history, prior decisions, linked graph obligations, security/access constraints, tests, lifecycle rules and linked records, to the extent available and permitted. Label missing evidence; never imply an investigation occurred when it did not.
3. **Explain the trigger:** cite the issue/requirement/observation and the exact conflict or unknown; explain why a decision is needed now.
4. **Assess consequences:** identify affected actors, permissions, records, state transitions, entry points, APIs, discoverability, caching, dependencies, reversibility and potential downstream obligations. Distinguish changing underlying record state from changing visibility or access.
5. **Present options:** state meaningful alternatives, a recommendation grounded in evidence, trade-offs, risks, assumptions, confidence and the cost of deferral. Avoid false certainty and forced choices; allow a user-authored decision.
6. **Respect authority:** independently resolve decided implementation details; seek authorized human judgment for unresolved product policy, consequential trade-offs, trust boundaries and other reserved decisions. Never use agent consensus to replace product ownership. Do not block unrelated safe work; do not turn every detail into an approval request.
7. **Preserve the decision:** record trigger, evidence references, rejected alternatives, decision-maker, rationale, scope, affected obligations, residual unknowns and change conditions in the project's existing authoritative records. For Tesbo, update the applicable native requirements, cases, policies, manuals, tasks/issues and files/evidence where those tools are available and authorized. Align implementation, coverage and documentation with the decision. Reopen only on new material evidence or changed context.

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


## Specification-stage discovery: question generation before design freeze

**The failure mode:** a team can thoroughly review the questions already written in a spec yet fail to recognize that the spec has omitted a decision entirely. Specification completeness is not the same as decision completeness; multiagent agreement is not evidence that all consequential questions have been discovered.

**Discovery is generative, not merely reactive.** For each proposed feature, independently construct potential questions from evidence and latent interactions, without waiting for the user, developer, issue or coordinator to pose them. In particular:

1. **Reconstruct the outcome:** What problem, human outcome and invariant does the feature serve? What would make a technically correct implementation product-wrong?
2. **Derive the semantic axes:** Distinguish identity, standing, publication, visibility, entitlement, individual-content eligibility, actor permission, record existence, lifecycle and display projection when those mechanisms exist. Do not collapse similarly named states into one eligibility flag without evidence.
3. **Explore combinations:** For meaningful states and audiences, ask what happens to dependent records, direct and indirect readers, before/after transitions, restoration, legacy data, cached projections and third-party copies. Look at *non-participation*, excluded states and absence of a parent.
4. **Intersect with decided ground:** Search not just the new feature's own spec but adjacent product decisions, roles, plans, trust rules and existing public-read contracts. Identify semantic collisions even when all documents look individually complete.
5. **Generate candidate questions:** Derive alternative behavior policies and surface genuine unresolved choices. An unresolved choice may be a missing rule, a rule's ambiguous applicability, or an apparent contradiction between two accepted rules.
6. **Assign consequence and authority:** Classify whether each candidate affects human outcomes, rights, security, money, data, external access, irreversible transitions, or other material commitments. Report through any available tool/handoff; ask a human only when established authority does not already settle it.
7. **Close the discovery loop:** In specs record discovered decisions, source and owner, alternatives, disposition (decided/delegated/open/blocked), affected semantic axes and downstream obligations. A “no open decisions found” conclusion must name inspected scope and known gaps.

**Counterexample from the actual Nesberry record (ISS-9482, D-115):** credential/portfolio visibility was initially keyed to suspension alone. The prompt about paused, under-review and rejected sellers did surface a missing question, but even the first proposed answer “require a published seller profile” conflicted with the accepted every-plan availability decision: branded-page publication was a separate entitlement, and a seller on Basic/Verified or in draft need not have a published page. The subsequent founder clarification was “Any not-blocked profile”. The missed discovery obligation was to *generate and reconcile the cross-axis eligibility question* before choosing the visibility rule—not merely to ask what triggered the original issue. This is an illustrative historical resolution in Nesberry, not a transferable policy for Tesbo or other products.

**Reviewer anti-patterns:** “The spec does not mention it, so it is out of scope”; “every team agreed”; “we have a state matrix” when the matrix is only one dimension; “ask Claude to ask” instead of every subagent discovering; “published” silently conflated with “authorized”; “we found an issue” treated as proof all connected issues were found.

**Decision discovery is not a mandate to ask unlimited questions.** Deduplicate, investigate first, make small delegated choices autonomously, and report the remainder proportionally. Distinguish candidate coverage from the strength of evidence and never fabricate an exhaustive review.


## Tesbo specification-to-native-record handoff

**Ownership:** Engineering principle 17 in `AGENTS.md` remains authoritative; this section is its operational application, not a new policy owner, record type, approval path, or MCP service. Execute during requirement/spec drafting, before implementation of a consequential interpretation, and when code/review uncovers new evidence. Individual agents must originate candidate gaps independently; their coordinator reconciles them.

### Discover before asking

For each material feature/increment, reconstruct the human outcome and enumerate the independent dimensions actually implicated by the feature (actor/role, tenant/project/object scope, lifecycle, publication, authorization, content eligibility, ownership, entitlement, history, UI/API/MCP caller and downstream projections). Trace source evidence for each intersection that materially changes outcomes. Use bounded relevance rather than a combinatorial requirement to enumerate every theoretical combination. Include what is absent, what is restored, and where dependent records retain independent eligibility.

Require each applicable specialist agent to report its own candidate question **even if no question appeared in the user request or spec**. Coordinator consolidation is not a substitute for independent discovery. For every question, cross-check existing Tesbo requirements, approved policies/manuals, current implementation, prior decisions, tasks/issues and linked evidence before treating it as undecided. Preserve `NOT INSPECTED` or `UNKNOWN` when access is missing; do not invent a conflict or pretend a source was read.

### One candidate disposition in the existing work record

Use the existing requirement/spec review, native Task/Issue or linked evidence record, depending on its established owner. Capture the following fields as prose or supported metadata—**do not create a parallel decision table/service or fictitious MCP endpoint**:

| Field | Meaning |
| --- | --- |
| Context and trigger | Named FR/T/QA/MBT/AC or issue, exact relevant version and observed evidence |
| Candidate decision | The previously unasked consequential question, not just the immediate defect |
| Source reconciliation | Existing authoritative rules/owners; contradictions or explicit absence; evidence vs inference |
| Alternatives and impact | Material behavioral choices; affected actors, states, entry points and linked records |
| Disposition | `ALREADY_DECIDED`, `DELEGATED`, `HUMAN_REQUIRED`, or `EVIDENCE_BLOCKED` |
| Authority and scope | Accountable decision owner; whether only a named slice is blocked |
| Outcome and follow-through | Authorized resolution/reference; requirements, manual/policy, cases, graph links and implementation consequences |
| Confidence and open risks | Evidence gaps, residual uncertainties, stale inputs and conditions that would reopen it |

A subagent lacking interactive questioning or native MCP write permission must **still report the candidate** in its normal output. The coordinator attaches it to the existing review/PR handoff and, when tools and authorization permit, writes/link it using the existing native owners. A proposed record, generated draft or pending decision must not be represented as approved. Preserve provenance, exact revision and identity where available; never forge evidence or quietly amend approved policies.

### Escalation and continuation rule

- `ALREADY_DECIDED`: cite and apply the relevant version; do not ask the owner again merely because the agent was uncertain.
- `DELEGATED`: choose within documented authority and record material rationale; no ritual approval.
- `HUMAN_REQUIRED`: state a concise recommendation and alternatives, identify the accountable human, and leave the **affected interpretation** unresolved until decision; do unrelated safe work.
- `EVIDENCE_BLOCKED`: name inaccessible source/tool or missing provenance and the claim it prevents; continue only portions whose correctness does not depend on that evidence.

After authorized resolution, propagate the decision through **existing** Tesbo Requirements, applicable Policies and User Manuals, linked Test Cases for regression, Tasks/Issues and Evidence, plus graph obligations where supported. Creating a draft test case or note does not confer approval or execution status. If an MCP capability is absent, write a truthful handoff and do not claim the native records were updated.

### Why this matters for spec teams

The historical Nesberry seller-visibility issue (ISS-9482 / D-115) did not fail only because an agent explained a question poorly. It also revealed that teams had not generated a question about two independent semantic axes: published branded-page status versus eligibility to display credentials and portfolios on every plan. For Tesbo, apply the **method**, not that marketplace policy. For example, when deciding whether a retired requirement hides its linked test cases, independently ask whether lifecycle, discoverability, historical evidence, test approval and regression reuse are separate decisions. Verify Tesbo's actual decided rules before recommending any outcome.

### Reviewer completion language

Say `candidate decisions found: N; already decided: A; delegated: B; human-required: C; evidence-blocked: D` only when those counts come from the inspected review scope. Cite record references and the inspected surfaces. If there are none, say `no candidate found in the inspected scope`, never `no product questions exist`. Do not turn this guidance into a mandatory extra runtime test campaign or a new feature implementation.
