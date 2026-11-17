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

The follow-up source audit located the existing Review Board browser/worker
helper under `e2e/utils/ci-review-board-ui.ts`; it remains part of the existing
smoke owner, not a new E2E project. Runtime evidence obligations belong in
selected-check descriptions, not blocking `DOMAIN_EVIDENCE_GAP` messages once
their infrastructure/accounting is wired. Genuine unresolved mapping or fixture
gaps still block. Neither classification changes the planner's `not-run` verdict.

### Migration history

The existing checker validates the current manifest and compares existing SQL
files with the trusted base. Forward additions are allowed; historical edits,
deletions, renames and renumbering are rejected. Windows newline conversion is
handled explicitly by the checker rather than falsely treating checkout line
endings as a schema change.

This is source-history protection, **not** proof of migration rollback, upgrade
compatibility or the running database's checksums. The runtime migrator's
historical-fork handling needs separately proven database regression work.

The follow-up makes the existing runtime entrypoint import-safe and refuses
missing/blank `DATABASE_URL` before reading migrations or constructing a pool.
`src/database/migrate.spec.ts` checks configuration, pending selection, checksum
decisions and transaction query ordering with mocks. These are not PostgreSQL
rollback, concurrency or historical-upgrade evidence.

Historical compatibility is deliberately unchanged: source shows V76 admin-plan
SQL renamed to V77 (`d217ccd6` / `3ea87f27`), and V78 intentionally edited for an
existing constraint (`36673f6f`). Synthetic identity fixtures do not establish
deployed SHA-256 tuples. The broad same-filename and unknown-version allowances
remain known limitations; narrowing them requires authorized migration-ledger
and deployed-artifact evidence. Runtime raw-text hashing is not silently replaced
by the source-history guard's CRLF-normalized contract.

Adjacent source-only finding, not fixed here: `Dockerfile` removes npm from the
runtime image while `docker-compose.yml` invokes the migrator through npm.
Host-based CI does not reproduce that image-command path; inspect the built
image and deployment command separately before any authorized rollout.

### Required backend execution

`.github/test-impact.json` now owns explicit `requiredBackendSuites` for the
behavioral and authorization jobs. Generic evidence paths never authorize test
execution. `scripts/required-backend-tests.mjs` validates this declaration,
resolves installed backend Jest, checks exact `--listTests` discovery, then runs
the same in-band selection with Jest's built-in JSON output. It fails on child
failure/interruption, missing/duplicate/unexpected files, skips/todo, zero
assertions, invalid/stale/partial reports and inconsistent aggregate counts.
The broad backend-quality run retains its optional infrastructure suites.

Both Review Board suites relocate together into `review-board-integration` in
the existing behavioral workflow; other selections and job names stay intact.
Fresh job-owned pgvector PostgreSQL `rb_test_ci` and Redis `56379` satisfy the
existing guards unchanged. Preflight runs before the existing full migrator and
refuses unsafe targets/overrides. This is GitHub-hosted CI only, not permission
for any workstation database. The existing `tesbo_ci` lane remains separate.

Each invocation has a fresh exclusive evidence directory under
`reports/quality/required-backend/`: discovery, raw Jest JSON, and a receipt with
check ID, invocation, checkout commit, tracked-worktree changes, manifest hash,
child outcomes and validated execution counts. Failed/absent evidence does not
become PASS because artifact upload succeeds. Jobs retain evidence with
`always()` and missing-file errors. Pure malformed-report fixtures run in root
quality; real installed-Jest positive/negative fixtures run in backend-quality.

Review Board's integration fixtures substitute authentication/cache
collaborators; its HTTP suite does exercise the real BullMQ worker. This does
not prove deployed auth, application boot, cache behavior or browser journeys.
Existing Playwright smoke is preserved, not replaced. Hosted services are
disposable isolation, not an egress sandbox or automatic repository-ruleset
enforcement.

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

Foundation evidence: exact head `0c6d785056f2e0de28360e4f3821dbc06858e9f4`
on PR #118 had **25/25 reported checks passing** on 17 November 2026, including
Linux SDK, database-integrity and Playwright smoke. This records completed job
results, not proof that each opt-in suite executed. Required-suite accounting is
the next bounded review finding; older green results do not certify later edits.

Follow-up local evidence (17 November 2026, Windows Node 24.14.0, worktree based
on `0c6d7850` before the owner's concurrent merge of #118): 148 root
quality tests, 22 real-Jest adapter fixtures and 18 no-DB migrator tests passed,
with zero skipped harness tests. Explicit service-free selections accounted
4 API/MCP files / 266 tests, 3 concurrency files / 72 tests and 5 authorization
files / 270 tests; these overlapping selections are not a distinct-test total.
Build, typecheck, frozen lint, actionlint, architecture, duplication and
append-only history checks passed. The import regression failed on the original
entrypoint before repair. No workstation database or deployed-stack E2E ran.
Review Board and migrated-database claims require fresh exact-head CI receipts
from the `chore/required-suite-execution` follow-up PR, not these local fixtures
or the foundation's earlier green jobs. The follow-up was replayed without
conflicts on development `5280d9398605cf6c29cc85429517e3b212603bdc`.

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
| Wider execution accounting | Explicit behavioral/authorization selections are accounted above; broad optional Jest and product E2E need their own reviewed execution policies |
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

### Session source and discovery limits

The resume audit retrieved `00_README.md` and `06_IMPLEMENTATION_AGENT_BRIEF.md`
from `origin/docs/qa-specs-product-direction-20261028`. The other six canonical
specifications, the single application baseline and its Product Discovery Register
were not available in this checkout. No substitute register or product amendment
was created. Silent required-suite skips support the already-recorded execution
accounting follow-up and the existing warning in
`e2e-quality-report-2026-08-19.md`; they are not a new product initiative.
Reconciliation into the canonical register remains blocked on access to that
source. This CI increment does not claim acceptance of the larger orchestration
specifications.
