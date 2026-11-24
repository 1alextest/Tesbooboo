# Tesbo ASER — outcome/capability discovery Skill diagnostic

**Classification:** AUTHOR-APPLIED DESK TEST — not an independent assurance-team run, not a blind A/B evaluation and not a product/runtime test.

**Source:** `1alextest/Tesbooboo`, branch `docs/gex-unified-graph-extension-20261119`, latest source at diagnostic outset: `2a3708cec25acca0261dcb2461106a8ce0faf036` (no subsequent GitHub changes until this receipt). Examined: `README.md` blob `b229f2d3b6b8ebcbb473297399f46ad7ec628adc`; `requirements.md` blob `b490cdf2dfe4ea7fab65864fa0303b9ab14f547a`; `design.md` blob `3b9f066d733cc01c69c5443b6d168e7a96ca7714`; `implementation-plan.md` blob `b18b52f4faba6667ef061de9697edb0031e43787`; `skills-governance.md` blob `673470c1d6c81f9d05a8ce7af3e33573d5e46f10`; `AGENT_RULE_TEMPLATE.md` blob `aa325087efd547ca5768314809f30587d476e8dc`.

**Method:** Applied the candidate `skills-governance.md` §13.4.1 and “Method lesson from the graph semantic-direction gap” to the stated outcome: make Tesbo's existing graph enable reliable, reviewer-understandable decisions about obligations, behaviors and consequences. Reconstructed user/agent jobs, mapped existing capabilities and owners, asked what supported decisions become possible, considered negative/contradictory/unknown contexts and tested alternative no-AI/deterministic/manual interpretations. No team charters were modified. The authored GEX-SEM scenarios and recent conversation are **known to this reviewer**, so this cannot establish blind novelty or how an unrelated agent would perform.

## Source-backed newly surfaced candidate questions

### DISC-01 — Which applicable obligation wins, and who decides? (HIGH / candidate gap)

**Evidence:** `requirements.md` R-ASE-08/09, R-ASE-19/40; `design.md` §8, §14 “GEX semantic impact and causal reasoning”. They distinguish decision vs policy vs enforcement, effective scope/jurisdiction/audience and require conflicts to be surfaced. **Not clearly resolved:** the contract for simultaneously applicable, independently authoritative but incompatible obligations (e.g. two effective policy revisions with overlapping domain/period, locally applicable rule vs externally mandated requirement, emergency exception vs ordinary separation of duties) and for a provenance-backed human ruling. Silently choosing “latest” or LLM-suggested hierarchy would be unsafe.

**Proposed outcome-level test:** With two contemporaneously authoritative conflicting obligations, can Tesbo explain their applicability, identify a conflict without assuming priority, point to the accountable decision owner and preserve an unknown or blocked release/coverage assertion until a governed ruling? A rule-bound decision may be deterministic where documented. **Do not invent a universal legal/policy precedence rule.**

**Disposition:** Candidate specification clarification, not established runtime defect; have policy owner determine whether existing policy lifecycle already supplies the authority-resolution contract.

### DISC-02 — What makes a consequence genuinely actionable rather than an attractive narrative? (HIGH / candidate gap)

**Evidence:** `design.md` §14 “Consequence traversal” describes grounded direct/transitive/hypothetical/blocked outcomes and §14 “Reviewable output” asks for evidence and human owner. It does **not yet supply a discriminating acceptance oracle** for the semantic *correctness and practical necessity* of the causal chain when several plausible explanations share the same linked nodes. This is distinct from verifying a typed path exists.

**Proposed outcome-level test:** Give reviewers a grounded change and two plausible consequences (one truly dependent on a condition, one connected but unaffected), with the needed counterexample or negative control available. Can Tesbo state the causal/conditional mechanism, reveal missing premises, propose a differentiating observation, and appropriately conclude no effect when warranted? Avoid treating a hypothetical intervention as a performed product test.

**Disposition:** Proposed cross-artifact explanation quality acceptance; do not imply that observational dependency is experimental causal proof.

### DISC-03 — How do semantic results behave through overlapping effective times and source revisions? (MEDIUM/HIGH / candidate gap)

**Evidence:** `requirements.md` R-ASE-19 and GEX semantic clause; `design.md` §14 pins individual source revisions, effective time, provenance, freshness and build/environment. **Potential under-specification:** a single consequence assertion spanning differently effective Policy, Manual, Requirement, Model and deployed-build timelines; a manual published after a rule changed but describing the previous period may be historically correct rather than stale.

**Proposed outcome-level test:** Compare current and historical user journeys under deliberately mismatched effective dates and deployed builds. Can the graph return separately “historically accurate”, “currently applicable”, “future pending”, “unknown deployment”, and “truly stale/contradictory” without rewriting past evidence? Evaluate whether existing versioned owner contracts already suffice before extending storage.

**Disposition:** Clarify time-aligned applicability and acceptance, not a request for a new timeline store.

### DISC-04 — How do we identify missed meaning when the graph has no accepted link? (HIGH / candidate gap)

**Evidence:** `design.md` §14 and GEX-03..07 identify missing links, uncertain edges and source-free QA; `requirements.md` R-ASE-19 explicitly refuses invented impacts. This safety is correct. **Remaining practical question:** how a permitted reviewer discovers a potentially important obligation in a Manual/Policy with no pre-existing graph edge, without making AI semantic similarity an authoritative link.

**Proposed outcome-level test:** Provide two authorized but unlinked records with a substantively shared condition and a similarly worded unrelated pair. Can the analyzer propose the meaningful missing association with source evidence, reject the lexical decoy, retain both as unapproved hypotheses and request owner confirmation? Compare with deterministic search/manual discovery; retain privacy filtering and false-positive measurements.

**Disposition:** Discovery evaluation and existing FR-118 hypothesis lifecycle clarification; no auto-link or invented coverage.

### DISC-05 — Can the user challenge an explanation and observe the correction propagate safely? (MEDIUM / candidate gap)

**Evidence:** `requirements.md` R-ASE-40 and `design.md` §14 learning/review preserve corrections and approved-source authority; Skills §13.4.1 requires distillation. **Potential missing outcome:** a reviewer-facing challenge/appeal cycle for a particular inferred obligation/consequence (including the exact mistaken premise), clear invalidation of downstream *candidate* impact/coverage rankings after a corrected source or rejected hypothesis, and preservation of previously viewed decisions.

**Proposed outcome-level test:** Reviewer rejects a graph-predicted downstream impact, citing a counterexample. Does the system preserve the original proposal and correction, re-evaluate dependent **candidate** views, prevent the rejected hypothesis from continuing to justify a release decision and leave approved artifacts/historical executions unchanged? Do not use feedback as automatic global training truth.

**Disposition:** Existing graph review, provenance and staged native apply may meet much of this; verify end-to-end consumer invalidation and reviewer comprehension before creating UI/storage.

## Negative controls and no-addition outcomes

- No new graph database is warranted merely because semantic relationships are needed. FR-118/119, versioned KB owners and T-422 are the existing candidates.
- A correct current manual and unchanged policy must permit `unchanged`/no proposal.
- Where deterministic scope matching or a direct policy rule is sufficient, the Skill should not force AI inference.
- A path in a linked graph is **not** proof of an actual consequence; a QA finding is not a validated causal explanation.
- Manual verification and code-free projects remain legitimate, and no missing dependency edge authorizes a false `no impact` claim.
- An unresolved source authority question can be `BLOCKED` rather than solved by a new automated feature.

## Diagnostic result

**Observed author-applied outcome:** five candidate contract/evaluation questions, of which DISC-01, DISC-02 and DISC-04 are high-value, potentially independently discriminating scenarios. The method helped turn previously covered provenance/link semantics into questions about user decisions and consequences. This **does not prove** any team previously failed, any gap is definitively absent from all canonical documents, or that the candidate Skill improves blind review.

**Comparison limits:** No separately executed current-skill baseline; no independent cold reviewers; original canonical eight-file source bytes unavailable for exact P-14 review; no Tesbo runtime/CI capability validated. Findings must be triaged against canonical owner sources and original agent receipts, and independently tested before promoting Skill effectiveness or revising team charters.

**Next admission experiment:** On a frozen canonical snapshot, give the same broad outcome and available sources to separate unchanged-method and candidate-method reviewers without these five findings or planted scenarios. Freeze initial outputs. Score genuine missed obligations, useful proposals, false claims, no-change judgment, scope and cost against independent human adjudication. Keep actual team review separate from this diagnostic.
