# Assurance and living Security Skill — adversarial evaluation checkpoint

**Candidate branch:** `fix/assurance-skill-scope-validation-20261124`
**Review basis:** merged PRs [#254](https://github.com/1alextest/Tesbooboo/pull/254) and [#255](https://github.com/1alextest/Tesbooboo/pull/255), current `development` baseline, the exact source/test paths listed below.
**Evidence tier:** one source-grounded analytical review by an assistant, with test code submitted for GitHub Actions. **Not** independently run teams, a native Tesbo Test Case/Run, an approved Skill assignment, or human/White signoff.

## Outcome and cause

**Intended human outcome:** a reviewer should be able to trust that consequential agent guidance and security rules cannot be changed without the appropriate exact-head assurance. A passing CI job must not conceal unresolved native findings or pretend the corresponding trusted check has actually been installed on the protected release branch.

**Observed mechanism:** `scripts/assurance-pr-gate.mjs` correctly inventories *all* native inline review threads, including outdated threads, checks that pagination is complete, and blocks unresolved findings. But `requiresAssurance` did not identify the actual instruction/skill owners (`AGENTS.md`, `CLAUDE.md`, `skills-lock.json`, `docs/agent-skills/**`, `.agents/skills/**` and `.claude/skills/**`) as protected paths. Accordingly, a clean-thread change that altered the Security Skill could have been classified `not_applicable` rather than requiring Independent and White receipts. This is a verified source-scope gap, distinct from a demonstrated unauthorized merge.

**Change:** include canonical agent instructions, the version lockfile and all three actual skill roots in the existing `requiresAssurance` predicate, preserve detection through `previous_filename` for renames, add narrow positive/negative regressions to `scripts/assurance-pr-gate.test.mjs`, and update the exact evaluator blob pin in `scripts/branch-rulesets.mjs`. Reuse the current publisher, policy, fixture and test owners. No new review service, bypass, policy type, native authority or datastore.

## Challenge matrix

| Lens | Attack or counterexample | Evidence and disposition |
| --- | --- | --- |
| Blue / reuse | Is a second skill or review engine necessary? | **No.** Canonical `AGENTS.md`, Skills governance §13.4.1, candidate Security Skill and existing assurance evaluator suffice; extend the protected-path predicate. |
| Red / premise | Does a green CI check prove security enforcement? | **No.** The candidate code has synthetic contracts; actual live merge gating needs main's trusted publisher and required context installed. PR #191 remains the bootstrap dependency. |
| Green / seams | Can renaming a governed skill file to an unrelated folder evade its old path? | The evaluator checks `previous_filename`. Added a regression for that path. |
| Security / authority | Can unrelated README-only changes be falsely forced to obtain distinct analytical receipts? | Remain `not_applicable` with no unresolved thread; must still fail if any unresolved native thread exists. Tests cover both conditions. |
| QA / lifecycle | Can outdated unresolved findings or delayed incoming findings pass unnoticed? | Merged #254 tests handle outdated threads, pagination and state-digest changes; publisher tests recheck before/after publication. Missing evidence or stale head must refuse. |
| Grey / human journey | Does an owner understand the difference between a warning, a disposition, and permission to merge? | Security Skill has contextual disposition and evidence protocol; interface/operability proof and actual authorized review remain unverified. |
| Purple / design truth | Is a warning on a rejected hostile URL equivalent to a production insecure endpoint? | **No.** The reviewed #246 fixtures contain intended negative inputs and localhost rejection guards. Distinguish source, runtime reachability and environment. |
| Graph / consequence | Does a skill change alter the basis of future proposals or historical approvals? | Candidate skill version, approved version and active assignment are distinct. Existing historical receipts must remain pinned; activation and change propagation were not exercised in this branch. |
| White / completeness | Does this resolve the release gate and security-bot inventory problem entirely? | **No.** Installed main publisher (#191), required status check, exact production rule readback, and scanner alerts without corresponding inline review threads are still outside verified acceptance. |
| Independent fresh eyes / observability | Could a status be green but not fresh or not produced by the trusted workflow? | The existing publisher binds repository/PR/head/base/source, checks before and after publication; live GitHub enforcement demonstration and operational telemetry are still required. |

## Living-skill evaluation — provisional

The shared distillation method is in `docs/specs/agent-synchronized-engineering/skills-governance.md` §13.4.1; the domain adapter is `docs/agent-skills/living-security-engineering/SKILL.md`. It was evaluated *analytically* against these known cases rather than through an independent blind A/B study:

1. **True security case:** OAuth same-client-ID revoke/reapprove can resurrect old provider consent/refresh families unless permanently invalidated. Candidate **SEC-P04** identifies the dependent-authorization-chain invariant and OA-T18. This is a plausible preventive insight, **not yet demonstrated runtime security**.
2. **False-positive control:** DevSkim HTTP/local-host references in explicit rejection fixtures and defensive URL guards from #246. **SEC-P06** requires actual source/sink/reachability classification, avoiding an unsafe blanket replacement or scanner suppression. The accepted contextual disposition is supported by source, not exploit testing.
3. **Infrastructure evidence:** #241 originally pointed Snyk at a nonexistent path with no token and would upload missing SARIF. **SEC-P07/P08** distinguish N/A from passed security coverage, insist on real targets and immutable action pins. Actual no-IaC detection is deployment/environment scoped.
4. **New discovered gap:** modifying the security rulebook itself was excluded from `requiresAssurance`. **SEC-P03/P10** plus outcome-backward review exposed the missing protection of *the source of future security decisions*. The new regression makes this distinguishable.
5. **No-change control:** ordinary README text should not need independent analytical receipts unless an unresolved native review thread exists. The test intentionally permits `not_applicable` rather than adding approval friction.

**Provisional grades, not authoritative user scores:** causal grounding 4/5; transferability 3/5 (no held-out domains); context fit 4/5; discriminatory test value 4/5 after CI; evidence strength 2/5 pending live publisher. False-positive cost and user's outcome rating **UNRATED**. The candidate skill is not active by virtue of these grades. Do not convert an analytic score into a security guarantee.

## Gate checklist and deferred work

- **Tested through source inspection / new contract assertions:** candidate skill path and AGENTS path protected; previous name included for rename; known no-change and unresolved thread behavior distinguished.
- **Must be observed after CI:** exact-head branch-ruleset audit, evaluator test suite, publisher tests, security checks and their complete logs.
- **Requires separate authority:** #191 trusted publisher on `main` must pass legitimate native non-author approval; no bot/account may fake that approval. Branch rules must actually require its trusted check before a negative-case live merge block can be demonstrated.
- **Uncovered risk, not hidden:** scanner findings not surfaced as GitHub review threads require an independently verified code-scanning alert inventory/merge-protection path and disposition receipts. Thread resolution alone is not proof a vulnerability was fixed.
- **Native Tesbo:** no authorized MCP connection, live Test Case staging, approval or Run is claimed by this checkpoint.

**Rollback:** revert only this branch's evaluator-scope/test/pin additions and this receipt; keep the already merged #254/#255 controls intact.
