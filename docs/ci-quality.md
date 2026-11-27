# CI architecture, reuse and cross-system impact

This is the operating procedure for the **CI architecture/reuse and cross-system
impact foundation** increment. [AGENTS.md](../AGENTS.md) remains the canonical
owner of engineering principles; [CLAUDE.md](../CLAUDE.md) owns database and product
E2E execution safety. This is not another product specification or test runner.

## Audit before implementation

Use the architecture/reuse and impact sections of the PR template before editing.
For material cross-system work, independent read-only investigations can inspect
the relevant owners in parallel; reconcile their file-backed findings into one
plan before implementation. Audit broadly, change only the named scope.

Record the existing owner, why reuse/extension/composition does or does not fit,
upstream inputs and downstream consumers, alternative entry points, failure/retry
semantics, and the tests that can distinguish the intended change from a regression.
An affected layer may need verification without any code edit. Similar code is
not automatically semantically interchangeable.

## Existing owners extended

| Capability | Existing owner | Treatment in this increment |
|---|---|---|
| Engineering principles | `AGENTS.md` | Reuse; no second rulebook |
| Core quality | `.github/workflows/core-quality.yml` | Extend with one architecture-quality lane and packed SDK consumer verification |
| SQL filename/sequence validation | `scripts/check-migrations.mjs`, `ci-hygiene.yml` | Extend with append-only history and real Git-fixture regressions; no database |
| Lint debt | `scripts/check-lint-baseline.mjs`, `.github/lint-baselines/` | Keep existing analysis; add trusted-base protection against allowance inflation |
| Lockfile integrity | `.github/workflows/security-analysis.yml` | Include the existing root package, now also owning quality tools |
| SDK lifecycle fixtures | `sdk/playwright-reporter/src/index.test.ts` | Extract test-only support for reuse by the installed-tarball smoke |
| Route/page reference inventory | `e2e/scripts/coverage-report.ts` | Preserve; do not duplicate its parser or pretend it measures executed behavior |
| Product E2E/smoke | Existing `e2e/` suites and runners | Preserve; impact planning does not replace or prune them |

No existing test lane is removed, path-filtered away, or made optional by the new
impact planner.

## Executable checks

Install root tools with `npm ci --ignore-scripts`. TypeScript, dependency-cruiser
and jscpd are exact locked development dependencies; none enters an application
runtime. Architecture and clone analysis runs locally/offline after installation.
No AI model, paid scanner, repository write token or production secret is needed.

```bash
npm run test:quality
npm run quality:architecture
node scripts/check-quality-policy.mjs --base origin/development
npm run quality:duplication -- --base origin/development
npm run quality:impact -- --base origin/development \
  --graph reports/quality/dependencies.json --output reports/quality/impact.json
node scripts/check-migrations.mjs --base origin/development
```

The shared `scripts/git-quality.mjs` resolves the explicit ref to its merge base
with HEAD. Missing history is an error, not permission to compare against an empty
tree. CI fetches full history and supplies the PR base (or pre-push revision).
Manual dispatch compares to the current commit. A verified empty Git diff is
reported as `no-changes`, not a product-test pass; missing input/history and
nonempty product changes with zero selection still fail. Local tracked
working-tree changes are included; untracked files are not change evidence until
added to Git.

### Architecture

`.dependency-cruiser.cjs` is the policy owner. The established TypeScript-aware
resolver handles relative/alias imports, re-exports, type dependencies and literal
dynamic/CommonJS loads. Each project uses its own `tsconfig.json`; their graphs
are merged once for reverse-dependency impact analysis. Declared aliases cannot
silently become unresolved external-package leaves.

The initial blocking boundaries follow the actual codebase:

- Applications and the publishable SDK cannot import another application's
  implementation; production cannot depend on tests.
- Neutral backend infrastructure cannot depend on feature services.
- Frontend components cannot depend on application routes; UI primitives cannot
  depend on domain components; library upward edges are narrowly constrained.
- E2E helpers cannot import specs. The existing frontend transport smoke import
  remains an exact exception; SDK integration consumes built/packed artifacts.
- Existing legacy-service consumers are named explicitly. New consumers require
  an architecture-policy review; neutral helpers in the legacy directory remain
  reusable.
- Unresolved local/alias imports fail rather than silently removing graph edges.

Generated-output exclusions are scoped to actual build/report directories;
application report routes and reporting components remain part of the analysis.

Current cycles, service size and semantic rule duplication are **not** automatically
rejected. Nest global providers, queues, HTTP, SQL, events, generated configurations
and computed module paths are not fully captured by import graphs. Explicit
domain mappings and human review remain necessary.

### Reuse / substantial duplication

jscpd compares the complete configured production TS/TSX corpus with the trusted
base using identical settings: at least **100 tokens and 20 lines**. The legacy
service is included; test scaffolding, declarations and fixtures are excluded from
this production gate. The report preserves existing debt.

The gate rejects new clone occurrences, including a third copy of an already
duplicated block. It is not a global percentage budget. A real-detector fixture
checks that third-copy failure, unchanged debt, harmless line shifts and empty-scan
failure. No embedding model or remote semantic analysis is enabled.

Do not raise thresholds, broaden ignores or refresh a baseline just to pass.
Independent runtime contracts may intentionally mirror values; prefer a
discriminating parity test and a narrowly reviewed policy decision over forcing
backend source imports into the browser or SDK.

### Lint-baseline integrity

The existing lint runner remains in place with its rules enabled. The new policy
check rejects larger allowances, moving allowances to new files/rules, and invalid
entries against the trusted base. Removed debt should retire its allowance.

**Limit:** the current lint inventory still counts file/rule occurrences; it does
not identify every violation by semantic identity. Replacing one old violation
with another within the same count is not solved by the inflation check.
Identity-level lint ratcheting is a follow-up, not a claim of this delivery.

### Impact plan

`.github/test-impact.json` owns reviewed domain mappings. The planner combines
changed paths, the optional reverse-import graph, additive shared-risk rules and
conservative fallbacks. Shared auth, tenancy, entitlements, schemas and the large
legacy service cannot be narrowed to one nearby feature.

The plan lists selected spec **files**, required checks, rationale and mapping
gaps—not executed-test counts. It validates paths without importing Playwright
fixtures or creating `.auth` state. Unknown product changes cannot silently
produce an empty green selection. Existing full quality and smoke jobs still run.

Review Board has backend integration coverage, but no matching product E2E
owner was found in the initial audit. Do not invent a spec filename to make the
mapping look complete.

#### Concurrent candidate impact

In an authorized Git checkout containing the exact target and candidate
objects, use the existing impact planner to review joint verification leads:

```sh
node scripts/test-impact.mjs --compare-candidates <target-sha> <candidate-a-sha> <candidate-b-sha> --format markdown
```

Supply 2–16 distinct candidate commit SHAs. The comparison uses each candidate's
unique merge base with the target and the **target's committed** test-impact
configuration and regular file inventory. It ignores dirty worktree and
candidate-authored mapping changes. It lists target drift overlapping each
candidate's changed paths, direct shared changed paths across candidates,
optional supplied-graph consumer intersections, shared mapped domains,
selected spec files and required checks. The optional graph is explicitly
unverified; do not infer runtime dependencies or semantic behavior.

Structural intersections or incomplete mapping evidence require review. Shared
mapped obligations alone do not establish a conflict. No merge is simulated,
no tests run, and no coverage or release verdict is issued. Inspect the actual
changed behavior and relevant requirements before proposing joint regression
work. Use the existing Change Packet and authorized test/run owners for the
next action. This is an opt-in review mode, not a new CI gate, scheduler or
independent AI finding.

### Migration history

The existing checker validates the current manifest and compares existing SQL
files with the trusted base. Forward additions are allowed; historical edits,
deletions, renames and renumbering are rejected. Windows newline conversion is
handled explicitly by the checker rather than falsely treating checkout line
endings as a schema change.

This is source-history protection, **not** proof of migration rollback, upgrade
compatibility or the running database's checksums. The runtime migrator's
historical-fork handling needs separately proven database regression work.

#### Proactive concurrent migration review

Before integrating concurrent schema changes, use the existing migration owner
to compare a verified target commit with the exact heads of pending candidates
in an authorized Git checkout containing their objects and ancestry:

```sh
node scripts/check-migrations.mjs --review-candidates <target-commit-sha> <candidate-commit-sha>...
```

Supply 1–32 distinct candidate heads. The command is read-only: it resolves
each candidate's unique merge base with the target, validates the complete
numbered migration inventories and append-only history on both sides, and
compares candidate additions by version, filename and canonical LF checksum.
It does not inspect or modify the checked-out worktree, execute SQL, fetch
missing objects, enumerate open PRs, or read any database. Git replacement
objects are disabled in the shared Git-quality reader to preserve exact object
identity.

The structured report separates additions already present with identical name
and checksum, unallocated target slots, and slots occupied by distinct
migrations. It also reports conflicts between candidates sharing a pending
version, even when that version is not yet on the target. A branch behind the
target is not treated as deleting newer target migrations merely because its
ancestor predates them. Exit 1 means review required or invalid/unavailable
input; exit 0 means no detected numbered-slot conflict within the supplied
inventory, **not** release readiness, successful tests, or applied schema.
Missing Git history, invalid migration sequences, ambiguous ancestry and changed
historical files fail closed. Identical content is not independent work or
proof of compatible SQL effects. Cross-version checksum reuse, dependencies,
persistent migration history and deployment compatibility still require their
existing authorized review. Do not automatically allocate a replacement number.

Use these observations as source-qualified leads in the existing Change Packet
/ PR assessment procedure, retaining exact candidate identities and scope.
Do not turn them into an independent model score or a new migration gate.
The normal migration-name and quality checks remain unchanged.

### SDK publish boundary

The existing SDK job builds first, then packs and installs the real tarball into
an external consumer directory. It verifies package-name CJS/ESM loading, strict
declarations, both CLI aliases, and a browser-free Playwright reporter round trip
against the shared loopback ingest fixture. Missing artifacts must fail without
a rebuild or silent skip.

The consumer installs exact public tooling versions from the SDK lockfile with
scripts disabled, isolated npm configuration/cache and no inherited SDK/npm
credentials. Registry access is required for that installation; no live Tesbo,
database, model provider or browser is used.

## Evidence and enforcement

`architecture-quality` retains dependency, clone, policy and impact evidence under
`reports/quality/`. Existing job names and result semantics stay intact; there is
no synthetic aggregate that can pass after missing, cancelled or failed checks.

Configured checks are not necessarily required checks. A repository administrator
must approve and configure rulesets after fresh mergeable-PR runs demonstrate the
exact contexts. This increment does not modify repository settings, enable
auto-merge, deploy, or switch to `pull_request_target`.

The initial audit found both rulesets had no required status checks. It also found
the default `main` branch lacked these workflows, so cron definitions on
`development` did not establish recurring scans. Default-branch/release policy is
an owner decision, not fixed by adding another schedule.

## Remaining rollout — not implemented by this foundation

| Follow-up | Reuse target / prerequisite |
|---|---|
| Identity-level lint ratchet, broader type-aware rules and complexity budgets | Existing ESLint runner; calibrate debt and prove no new violations are hidden |
| Unused-code/dependency analysis | Inventory framework, CLI, worker and generated entry points before blocking findings |
| Changed-code branch coverage | Existing Jest configuration; include unimported production files and retain machine-readable evidence |
| Broader mutation effectiveness | Existing Stryker lane; triage survivors before expanding scope or raising the current gate |
| Property-based invariants | Existing parser, ordering, context and Review Board tests; bounded reproducible seeds |
| Required-suite execution accounting | Existing behavioral workflow; explicitly selected Review Board suites currently lack their dedicated infrastructure variables |
| Migration upgrade/rollback/concurrent runners | Existing migrator and DB-integrity tests; separately approved isolated infrastructure/policy |
| Runtime accessibility and keyboard/focus | Existing shared UI and isolated Playwright smoke, not a second E2E project |
| Deterministic AI/network/export contracts | Existing fake provider, AI consistency and observability tests; strict request budgets and explicit host/egress configuration |
| REST/MCP/reporter compatibility | Existing transport contracts and authoritative domain services |
| Wider SDK OS/Node/Playwright matrix | Existing SDK and new installed-package smoke; preserve advertised compatibility boundaries |
| Performance/query/bundle/memory budgets | Existing k6/smoke tooling; first repair benchmark authorization and measure a real baseline |
| Flake detection | Existing tests under repetition/order/concurrency; never hide failures by automatic retirement |
| SBOMs and release provenance | Existing package/container release owners; no release is performed here |

Product verification still follows `CLAUDE.md`: exact impacted selection,
explicit execution approval, correct build/environment, and honest reporting of
what actually ran. None of these static checks certifies system-wide correctness.

## Coordinator-attested AI assurance — operational contract v1

**Named scope:** correct the specification-assurance verifier and publisher to
support independent AI analytical review with owner-authorized integration. This
extends the existing GitHub review/check owners and the existing verifier scripts.
It does not create a Tesbo approval service, evidence database, agent runtime or a
new canonical specification. The canonical eight-file package, its FROZEN status,
product acceptance, Skill assignment and release authority retain their owners.

The selected model separates these facts:

| Fact | Authority / evidence | Meaning |
|---|---|---|
| Independent and White analysis | Actual distinct worker invocations, pinned inputs, original outputs and methods | Analytical work, including legitimate no-new-finding, changes-required and hold outcomes |
| Receipt import | Repository owner or an explicitly delegated coordinator, authenticated by GitHub's native review metadata | The coordinator attests that it observed the identified worker outputs |
| Development integration | Existing owner-authorized integration policy, applicable CI and access controls | Permission to integrate within that scope; not a product approval or release |
| Main/release | Existing separately authorized release process and actual repository rules | Unchanged; an analytical check cannot replace the main approval rule |

The machine contract is
`tesbo-coordinator-attested-ai-assurance/v1`. Its policy is the small
[`.github/assurance-policy.json`](../.github/assurance-policy.json) file executed
from an installed, immutable default-branch source revision. Runtime reads verify
that its local bytes match that revision's GitHub bytes and that the default and
PR target refs have not moved. A candidate's policy file cannot activate itself.
Repository-owner identity comes from GitHub's stable numeric user ID; the PR author
may also be that owner. `delegatedImporterIds` is empty by default. It permits only
explicitly authorized numeric GitHub identities from the trusted policy. It does
not infer analytical authority from a collaborator's `maintain`/`admin` label or
require two human GitHub accounts. This first contract supports a personal-owner
repository; organization ownership needs an explicit approved authority mapping,
not an invented organization-to-human fallback.

### Provenance the mechanism can and cannot establish

The accepted provenance label is
`owner-authorized-coordinator-observation`. It means the authorized coordinator
observed actual original worker invocations and registered their results. The
coordinator must preserve tool-issued invocation identities and disclose input
exposure and limitations; it must never invent worker identities or write the
Independent and White outputs itself while pretending they came from workers.
White reads the exact Independent output before issuing its own scoped judgment.
Workers must differ from each other and from the implementation invocation.

GitHub authenticates the submitting account. That does **not** establish that a
human personally examined the output, that a worker has a cryptographic identity,
or that separate agent invocations guarantee intellectual independence. The
available coordinator tools expose observed worker invocations; no independently
verifiable worker issuer/credential is presumed. The checker verifies bindings and
current authenticated import metadata. Substantive review quality remains the
actual analytical work and its disclosed evidence, not a hash or a green badge.

### Native records, outside the candidate commit

Freeze the candidate head before review. Store original outputs and their import
as native GitHub **COMMENTED** review records anchored to that commit. Keeping them
outside its tree avoids the impossible requirement for a commit to contain its own
final SHA in a newly added receipt. Do not manufacture GitHub `APPROVED` reviews or
copy an agent result into a supposed human sign-off.

Each body is one marker line followed by canonical JSON. Use the exported
`recordBody(kind, value)` helper in `scripts/assurance-pr-gate.mjs`; it sorts object
keys and serializes the exact body whose SHA-256 is imported. Noncanonical JSON,
duplicate keys, excessive size and trailing content are rejected. The marker kinds
are `TESBO-AI-RECEIPT: 1`, `TESBO-AI-IMPORT: 1` and `TESBO-AI-REVOKE: 1`.

Both receipt and import carry a `subject` object containing `repositoryId`,
`prNumber`, `headSha`, `baseSha` and `policySha`. `policySha` is the immutable installed
default-branch **source commit**, not a candidate-provided policy label. The source
revision includes the verifier and policy, so changing it requires fresh bindings.

An AI receipt contains:

- `contract`, `role` (`INDEPENDENT` or `WHITE`) and the exact `subject`.
- The actual `invocationId` and common `implementationInvocationId`.
- `inputManifestSha256`, computed with `inputManifestDigest(snapshot)` from the
  authenticated repository/PR/head/base and complete changed-file identities.
  `coveredPaths` declares the protected paths actually covered. This identifies
  the review input delta; it cannot prove a worker read every line.
- `method: { name, revision, sha256 }` identifying the actual method/charter input.
- `output: { text, sha256 }`, preserving original output text and its UTF-8 digest.
- Explicit `limits`, including unavailable or unrun proof.
- Independent `disposition: reviewed` or a refusal outcome. White accepts only
  `disposition: admit_scope` and includes `independentReceiptSha256`, the exact
  complete Independent **review body** digest. `hold` is a refusal; `FROZEN` is not
  a supported substitute for a scoped analytical judgment.

After both actual outputs exist, the owner/delegated coordinator submits a separate
COMMENTED import with `contract`, `subject`, `provenance`,
`attestation: observed-distinct-worker-outputs`, and exactly two `receipts` entries:
`{ role, reviewId, bodySha256 }`. The native review's authenticated account supplies
importer identity; body text cannot supply or elevate it. The raw receipts may be
transported through the same owner account because their analytical identities are
the actual worker invocations, not two fabricated GitHub users.

An authorized revocation is an append-only COMMENTED record using the revoke
marker, its subject, `importReviewId` and a reason. The latest authorized control
record on the PR is decisive; a revocation, malformed new control or stale control
cannot fall back to a previous successful import. A subsequent explicit new import
is a new authorized decision, not silent restoration. Preserve all earlier
records. Never edit a record to change a prior judgment. Native GraphQL
`lastEditedAt` metadata is required alongside the REST body/state/commit identity;
edited records are rejected even if their original text is restored. Missing
referenced records, unavailable edit metadata and REST/GraphQL disagreement refuse.
Edit metadata and the evidence-state digest cover every review by the current
owner or delegated importer, even when its current body has no protocol marker.
GitHub does not expose the previous body through this snapshot, so an authorized
edit at or after the latest control is ambiguous: it could have removed or
relabelled a revocation. That edit invalidates an earlier import. An unedited
ordinary comment does not block assurance, and an ordinary edit strictly before a
later valid import is superseded by that explicit new decision. A valid recovery
import must have a submission time strictly later than all such edits and uniquely
later than other current controls. Tied control times refuse; numeric review IDs
are allocated before submission and do not prove submission order. Missing edit
or ordering metadata also refuses. This conservative boundary can require a new
import after editing an ordinary comment; editing the old comment again is not a
recovery mechanism.
GitHub's [review deletion API](https://docs.github.com/en/rest/pulls/reviews#delete-a-pending-review-for-a-pull-request)
only deletes pending reviews; submitted reviews cannot be deleted through that
endpoint. Using submitted COMMENTED reviews therefore avoids ordinary comment
deletion as a way to remove the latest control record. This is a provider API
boundary, not a claim that GitHub supplies an immutable historical ledger.
The mechanism cannot reconstruct historical records that GitHub no longer exposes;
retaining this append-only history remains part of the import authority's duty.

### Evaluation and status publication

The verifier checks the complete native snapshot, including an exact match to
GitHub's `changed_files` count and unique changed-file names. Renaming a protected file out
of its directory cannot hide its previous protected path. A valid unrelated diff
may be `not_applicable`; that is not product or release acceptance. Draft PRs and
unsupported target branches cannot satisfy integration assurance.

The publisher performs two complete evaluations before writing and compares their
evidence-state digests, including head, base, owner, trusted source/policy bytes,
input identities and native receipt/import/revocation state. It re-evaluates after
writing a success and changes that same check to failure if evidence moved or
became unavailable during publication. It acknowledges the actual Checks API
head/conclusion; failed or unknown writes are not reported as successful delivery.
Closed PRs are skipped without a status write.
Only accepted analytical evidence is described as an importer attestation in the
published result. Blocked/unavailable evidence reports provenance as not
established, and an unrelated source delta reports it as not applicable; the
required provenance profile is identified separately from observed acceptance.

`analytical_evidence_accepted` means the described coordinator-attested evidence
passed these mechanical predicates. It does not grant merge authority, report
canonical FROZEN, convert NOT RUN into PASS, or establish installed Skills or
production behavior. There is no automatic waiver or fabricated positive fallback.

### Trusted execution and freshness

The separate workflow uses **only** default-branch `workflow_dispatch` and a
bounded schedule. It has a repository-wide concurrency group, no concurrent
publisher cancellation, an explicit default-ref guard and checkout of immutable
`github.sha`. It never checks out or executes candidate code, downloads candidate
artifacts as executables, accepts a caller-selected workflow script, or uses
`pull_request_target`/`issue_comment`. The publisher also checks the runtime event,
repository ID and ref. Fetch permissions are read-only; only its job receives
`checks: write`. There are no scanner suppressions.

Dispatch can select one positive PR number. An empty selection refreshes up to 50
open PRs; overflow and unavailable pagination fail explicitly instead of silently
ignoring the tail. The schedule runs every 15 minutes. A workflow can complete
successfully after truthfully publishing refused PR checks: policy refusal is a
valid evaluated outcome. A failed API/write or an incomplete queue is a refresh
failure and is not represented as complete.

A successful check records its observed time, state digest, trusted policy source
and a 30-minute fresh-merge deadline. **GitHub does not automatically expire a green
check.** Scheduling can be delayed or unavailable and cannot ensure instantaneous
revocation. Immediately before an authorized merge, dispatch a fresh evaluation
and verify the exact head/base/policy/import state, all required CI, unresolved
review holds, and the observation's age. The owner/merge coordinator must retain
that final check; a 15-minute schedule is not an atomic merge/approval transaction.
No claim of a race-free atomic GitHub snapshot or instantaneous revocation is made.

GitHub Actions app identity alone also does not uniquely identify one trusted
workflow. The final merge decision must verify the intended workflow/source/run
provenance, and repository controls must keep untrusted workflows from obtaining
an equivalent check-writing authority. This foundation does not invent a dedicated
GitHub App credential or change repository settings to claim that condition holds.

### Validation and rollout

Run the local boundary suite with:

```bash
node --test scripts/assurance-pr-gate.test.mjs scripts/publish-assurance-status.test.mjs
```

The suite uses explicitly synthetic transport fixtures. It exercises the valid
single-owner import path, untrusted/self-labelled records, distinct actual-role
identity requirements, exact input/output/White bindings, native edits/deletions,
revocation, moved refs/policy, API denial, queue bounds and publication races. It
proves the parser/adapter/publisher logic under those inputs; it does not perform
real worker authentication, a live Checks API write, a denied real merge or any
product/database test.

Keep rollout states separate:

1. **Proposed foundation:** local/CI code tests and actual recorded analytical
   review of that candidate. Its own proposed policy has no installed authority.
2. **Installed/advisory:** separately authorized promotion of verifier, policy and
   workflow to the trusted default branch; confirm actual execution and status
   publication. Main's existing approval/release rules remain unchanged.
3. **Required/enforced:** an authorized administrator configures the real required
   check/source and applicable approval controls, then demonstrates permitted and
   refused merges with fresh source-bound evidence. Workflow existence is not
   evidence that this has occurred.

At this implementation checkpoint the available connector can publish actual
COMMENTED review data. No check-creation, workflow-dispatch or ruleset-writing
connector has been established. That is an operational admission gap, not a reason
to fabricate green checks or human approval. Existing GitHub Actions can perform
its declared operations after the separately authorized trusted installation is
actually demonstrated.

### Native finding protection — proposed activation phase

The assurance evaluator requires Independent and White receipts for changes to the [finding reconciliation procedure](agent-scope-discipline.md) and the [ruleset implementation](../scripts/branch-rulesets.mjs). A rename into or out of either path requires coverage of both names. The trusted default-branch installation must carry this reviewed verifier revision before the activation preflight can succeed. The earlier PR 191 bootstrap carries an older verifier.

Following AGENTS principle 18 and PR254, use the existing ruleset owner, not a parallel publisher. The `--findings` phase extends the assurance phase with native `code_scanning` protection for CodeQL and DevSkim, both alert thresholds set to `all`. Existing unrelated scanner rules and required checks are preserved. Native conversation resolution stays mandatory; it closes the same-head thread timing gap that a scheduled check cannot guarantee. Native scanner protection addresses qualifying PR alerts and missing analysis, not every historical repository alert or every possible independent finding.

Before applying, verify the installed trusted publisher, both target branches' pinned CI and scanner sources, active workflows, no bypass actors, and the newest result from each reviewed scanner job at the exact target ref and commit. The command checks the native tool name, GitHub analysis key (workflow path and job ID), and SARIF category. It examines at most the 100 newest results per tool and ref. Missing evidence, an unidentified newer producer, a changed category on the reviewed job, or an incomplete analysis blocks activation.

| Native tool | Reviewed analysis key | Expected SARIF category |
| --- | --- | --- |
| `CodeQL` | `.github/workflows/security-analysis.yml:codeql` | `/language:javascript-typescript` |
| `devskim` | `.github/workflows/devskim.yml:lint` | `.github/workflows/devskim.yml:lint` |

The preflight accepts one optional trailing slash in the category and records the value GitHub returned. PR 258's [native scanner results](https://github.com/1alextest/Tesbooboo/pull/258/checks) distinguish the lowercase native tool name from the Actions job named DevSkim. The pinned CodeQL job sets its category explicitly. The pinned DevSkim upload uses the workflow/job default with no matrix. Confirm the native analysis records on both target branches during authorized rollout. Snyk, Codacy and other applicable producers retain their separate finding review. An analysis result count alone cannot establish an authorized alert disposition.

Read-only configuration audit: `node scripts/branch-rulesets.mjs --findings`. The existing explicit administrator-token/confirmation contract applies to `--apply --findings`; never transmit tokens in chat or logs. The command does not install the publisher, perform a real merge test, or prove all scanners are configured. Before activation, reconcile live required contexts, verify trusted check publication and independently review this candidate. After activation, read back both rulesets and demonstrate a real denied merge using a disposable benign PR with an unresolved finding, then a permitted merge after authorized reconciliation (other gates must be satisfied in both cases). GitHub ruleset writes are not atomic across branches; report partial application and do not silently weaken protections. See [GitHub rules API](https://docs.github.com/en/rest/repos/rules) and [code scanning API](https://docs.github.com/en/rest/code-scanning/code-scanning).

