# ASER cross-module acceptance ledger — execution handoff (2026-11-23)

**Status: OPEN / not accepted.** This is an execution ledger for the existing ASER v1.4.38 proposal and Work Package A, **not** a ninth canonical specification, new service, new ownership model, release authorization, or a claim that end-to-end acceptance has run.

**Pinned source inspected:** `5f43b49b6872b44ab7cf5a875193dfb725aec3e1` on `development` (PR #210 integration). Reconcile the source SHA and selections before execution if `development` moves. This ledger is deliberately separated from release #155 and default-main assurance bootstrap #191. Do not treat their CI as execution of a real coding-agent journey.

## Existing owners and evidence already discoverable in source

- Canonical ASER authority: the eight existing specification files `00_README.md` through `07_UI_DESIGN_TASKS.md`, referenced by `docs/specs/agent-synchronized-engineering/README.md` (proposed, NOT FROZEN).
- Work Package A scope and criteria: `docs/specs/agent-synchronized-engineering/work-package-a-native-requirements-design.md`; reuse KB requirements/version owner, native testcase/revision owner, FR-027–037 staging/review, governed Skills, native task and run owners.
- `e2e/api/requirements.spec.ts`: seven native API cases including inert/idempotent staging, denied publication, rejection/withdrawal, cross-project isolation, governed publication and exact approval, overlap conflict, and KB bypass prevention. They are test *definitions*; do not infer a live run from their presence.
- `Tesbo-Backend-Nest/src/mcp/mcp-publication.spec.ts`: MCP staging, denied approval/apply, true agent principal, consent and scope, and native conflict propagation; the test's 52-tool assertion is a source-bound contract, **not a production MCP catalog readback**.
- `Tesbo-Backend-Nest/src/legacy/testcase-proposal-review.db.spec.ts`: migrated-Postgres suites for selected atomic apply, rollback, exact dependency and identity, races, retries, Skills assignment drift, membership revocation, unchanged rejected state, and the four separate coverage readings. The suite has an environment-dependent DB selection; a skipped run is not passing database evidence.
- Skills version review and lifecycle: `e2e/ui/skills.spec.ts`, plus separately scoped PRs #206, #207, #208 and #210. A later corrective PR #211 was already in progress when this ledger was authored; do not assert its disposition.

## Required single-change proof: one immutable chain, not independent green checks

Select an **authorized disposable project** and one real repository change. Capture exact project, actor/role, repository/base/head, credential/consent scope, API/MCP catalog fingerprint, build provenance, approved effective Skill version IDs/digests and current assignments *before* work. If disposable project or write authority is unavailable, mark the journey **BLOCKED** without impersonating a human or writing to production. Record the same change identity throughout.

| ID | Journey and required readback | Minimum observation and refusal controls | Status |
| --- | --- | --- | --- |
| A1 | Agent discovers project, applicable policies/manuals/requirements/cases/graph, assigned approved Skills, and reports missing decisions | Capture authorized retrieval, exact versions, source type and unresolved authority; never equate observed code with approved requirement | NOT RUN |
| A2 | Coding agent changes a real feature and stages native requirement revision, criterion-scoped testcase(s), links, task, relevant manual/policy proposals, and evidence through existing owners | Record each existing ID, exact version and digest, caller principal, change/head binding, task/proposal receipt, artifact existence and access scope; no shadow owners | NOT RUN |
| A3 | Authorized human opens complete candidate content, predecessors, effective assignments and impact before deciding | Exercise approve, reject, withdraw and superseded/revision-change refusal. Agent/MCP/API token must not self-approve/apply or silently reassign an active Skill | NOT RUN |
| A4 | Human applies **selected** changes and independently approves the exact requirement and testcase basis | One atomic apply receipt for the selected set, no leaked partial documents/cases/links/assignments on refusal, and immutable author/approver identities | NOT RUN |
| A5 | Case/version/criterion links and graph impacts resolve from accepted native records | Verify meaning, obligation and consequences of links, not just graph reachability; distinguish inferred, authored, approved, executed and passing evidence | NOT RUN |
| A6 | QA executes an accepted case in a native run against a known application build, attaches real evidence and raises/retests a defect when appropriate | Check persisted execution attempt and run ID, frozen case/requirement/Skill versions, actual assertion outcome and evidence hash, then historical retest without overwriting prior attempt | NOT RUN |
| A7 | Updated user manuals, internal policy, task state and evidence remain navigable from the same change | Verify audience and permissions, no unintended external disclosure, exact change history and link readback, no automatic publication for unapproved content | NOT RUN |
| A8 | End-user review explains readiness and remains truthful after later code, Skill, assignment, or requirement change | Show stale build/test warnings, missing approval/coverage, contextual downstream impact, unresolved decisions and release hold; never infer deployment from CI | NOT RUN |

### Adversarial and lifecycle campaign (execute against A1–A8)

For each materially relevant transition, prove both a successful path and a rejected/unchanged path. Prioritize: wrong project or role, missing/revoked MCP consent, forged caller identity, stale selected versions, changed requirement/criterion/case/Skill assignment, competing apply/reject/withdraw, duplicate idempotency request with unchanged vs altered payload, lost HTTP response followed by retry, lock wait followed by permission/assignment changes, backend restart between stage and review, evidence missing or unreadable, public-vs-internal document exposure, run on a newer build than its approved case basis, and historical approved versions after newer submissions. Use actual persisted state before/after refusals, not just response codes.

## Execution protocol and acceptance accounting

1. **Source/authority preflight:** capture tested commit, exact installed API/MCP catalog and connected disposable project; verify principals and effective Skill snapshot. Never substitute a reported test name, mocked service or CI snapshot for live capability.
2. **Automated baseline:** run the existing focused API/UI/MCP/Postgres selectors against the **same** checked-out commit. Save run/job IDs, environments, test counts, retries, failures and skips separately. Preserve failing-first artifacts; do not relabel a passing retry as first-attempt stability.
3. **Real connected journey:** exercise A1–A8 in the permitted disposable project with real Tesbo MCP/HTTP/DB/UI readbacks. Persist stable object IDs, link IDs, version/digest, evidence hashes, exact principal and timestamps. Redact credentials.
4. **Independent challenge:** Red tests rejected transitions and unexpected authority; Green tests cross-owner seams; QA tests retries, stale state and concurrency; Security tests trust and money/data boundaries; Grey tests human journeys; Purple tests presentation truth; Graph tests semantic obligations; White adjudicates completeness. Preserve each actual reviewer input/method/output and head binding; no fictional team signoff.
5. **Native record synchronization:** submit/update existing Tesbo Requirements, Test Cases, User Manual, Policies, Tasks/Issues, Files/Evidence and their relationships only when exposed and authorized. If any surface is inaccessible, leave a named BLOCKED gap and the precise missing permission/endpoint, not a fake native ID.
6. **Decision:** ACCEPT only after every in-scope A-row has a reproducible successful and refusal/unchanged-state proof, independent review, correct native acceptance/approval, and no material unowned blocker. Otherwise classify each gap as FAIL, BLOCKED, NOT RUN or OUT OF SCOPE with owner and reproduction link. This record never releases to `main`.

### Current assessment, limited to what was observed

The repository contains meaningful **automated test definitions** for A2–A4 and several negative paths; this is not proof that A1–A8 have been executed together, nor that a live MCP project can currently accept native record writes. No disposable project, deployed tool catalog, human approval, native official test run, source-bound graph consequence proof, or production release was exercised to produce this ledger. All A1–A8 remain **NOT RUN** as an integrated journey. Next execution owner should begin by obtaining the disposable project and exact MCP connection and pinning the current approved Skill assignments; this is a genuine test authority/environment prerequisite, not a request to weaken controls.

## Release dependencies (separate)

- #191: eligible nonauthor native approval of exact bootstrap head, trusted main installation, observed publisher write and denied-merge enforcement; no admin bypass.
- #155: current-head CI, real deployment mappings/provenance, applied migration ledger, rollback/backward compatibility, release-wide independent acceptance and owner authorization. Green development CI does not satisfy this.
