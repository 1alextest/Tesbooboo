# Tesbo — assured specification gate and first read-only graph review slice

**Status:** Implementation proposed on feature branch; not deployed, not independently assured, and not a semantic-AI product result.

## Existing owners reused

- `graph_capture_history.review_receipt_json` remains the authoritative persisted QA change-review receipt, created by existing authenticated capture logic.
- `CurrentCacheGraphHistory` obtains one exact receipt using a **single PostgreSQL authorization-and-read statement**, preserving current project/organization membership and archived/deleted denial.
- `GraphChangeReviewController` exposes only `GET /api/projects/:projectId/agents/zyra/changes/:historyId/analysis`; the request supplies no graph, policy, manual, expected oracle or execution status.
- `explainQaConsequenceReceipt` transforms that receipt into an **evidence-bounded, read-only** test-case review explanation. It identifies native-reference candidates and unlinked/unproven source-only change, while explicitly disclosing unsupported approved Policy, User Manual, causal, deployment and executed-coverage claims.
- No second graph owner, database, model runtime, skill, rule authority or automated result writer is introduced. A true semantic Policy/Manual consequence analysis requires a **separately verified, authorized effective-revision source reader** and a governed Skill, neither invented here.

## Current independent-assurance enforcement defect

The live GitHub development and main rulesets observed on November 20 each had **zero required approving reviews and zero required status checks**. A PR-only rule does **not** enforce prior independent team/White approval.

Proposed `.github/workflows/assurance-pr-gate.yml` inspects protected ASER specification/gate changes using a **trusted base-branch** verification script. `scripts/assurance-pr-gate.mjs` uses GitHub’s actual PR files, exact head and reviewer objects. It refuses Draft PRs, an author approving themselves, bot approvals, stale head, dismissed/change-requested state, duplicate reviewers/receipts, forged/absent evidence references and unavailable GitHub data. It requires distinct independently authenticated APPROVED reviews marked `TESBO-ASSURANCE: INDEPENDENT` and `TESBO-ASSURANCE: WHITE`, each with `TESBO-HEAD: <current SHA>` and `TESBO-EVIDENCE: docs/specs/agent-synchronized-engineering/reviews/<existing receipt>.md`; White decision is separately `TESBO-DECISION: FROZEN`. A deliberate `EXPLICIT-WAIVER` is a separate output, requiring a meaningful rationale and distinct human approvals; it is **not** a normal White freeze or an independent team result.

**Critical limitations:** This CI checker validates accountable GitHub approval identities, current-head binding and existence of receipt files; it **cannot prove** the review content reflects a genuine independent team execution, complete FJCC, human competence, runtime behavior or an active canonical Library ZIP. The original unchanged teams, measured coverage and evidence must still be independently checked. This GitHub workflow must be made **required** in the protected branch rulesets; a workflow that is not required does not protect a merge. Ruleset mutation is a separate administrator action not performed by this PR. The workflow is split into a **separate stacked PR #175** after this foundation's verifier/tests are present on its trusted base; it never executes unreviewed PR-authored policy code. When the foundation is approved and merged, PR #175 must be retargeted to the updated `development` and rerun before its status can become a ruleset requirement. This avoids a bootstrap self-dependency while retaining actual independent human and White review gates.

## Actual proof required

1. Local `node --test scripts/assurance-pr-gate.test.mjs` verifies both positive two-review authorization and denied older/author/bot/dismissed/duplicate/waiver/bad-path/missing-API cases, including exact-head receipt retrieval.
2. Backend Jest tests `qa-consequence-preview.spec.ts` and `qa-consequence-receipt-read.spec.ts` check read-only provenance, absence of fabricated semantic or execution assertions, authorization-first, one statement, foreign project, malformed cursor, and unchanged native case status. CI must confirm types, lint and tests on the actual changed head.
3. Authenticated DB/HTTP regression must exercise a real project member, revoked member, foreign project and deleted/archived project; cache source freshness is **unverified** even if stored, and original underlying report bytes are not silently inferred.
4. For the later semantic Policy/Manual milestone, independently source approved policy obligations and audience-scoped manual revisions under exact ACL and effective time, then test both a relevant change and a lexically similar unrelated record. Do not infer existing Policy coverage from native source link slots.
5. Independent assurance teams, Graph and White remain unexecuted on this code until actual reviewer receipts exist. The original case-free external task → own driver → original immutable report → linked retest → human-approved native publication remains an independent acceptance path.

**Release gate:** No merge, production deployment, canonical freeze, activated Skill or PASS result is asserted by this author document.
