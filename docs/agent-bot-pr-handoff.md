# GitHub App PR handoff — single human reviewer, separate writer

**Status:** Proposed source and workflow only. Not installed on protected default main, not provisioned with a GitHub App, and not live-verified. Existing GitHub rulesets, Tesbo assurance policy, signed-commit rules, and native Tesbo engineering records remain authoritative.

## Goal and reuse

The engineering agent stages candidate code in `agent-candidate/<scope>`. An owner-triggered trusted default-main workflow checks exact source/base commits and stages **the same Git tree** on `development`. A dedicated GitHub App signs the resulting commit and authors a **draft** PR. The owner (`1alextest`) can review that PR using the same account, since the author and latest pusher are the App.

This is not an approval bot: existing independent/White analytical receipts, revisioned QA, CI checks, human acceptance and release decisions stay separate. Reuse the existing agent workflow, Tesbo MCP record owners, branch rulesets and coordinator-attested assurance verifier rather than building another agent/reviewer service.

## One-time human setup and bootstrap

1. Register a GitHub App for **only** `1alextest/Tesbooboo`. Give it repository **Contents: read/write** and **Pull requests: read/write**, not Administration, Checks write, Actions write, or any branch protection bypass. Do not use a human PAT.
2. Install the App into that one repository. Put its client ID into repository variable `TESBO_AGENT_PR_APP_CLIENT_ID` and its private key into repository secret `TESBO_AGENT_PR_APP_PRIVATE_KEY`. Never put credentials into a PR, console output, code, or this chat.
3. The publisher workflow must be merged to default `main` with the repository's **existing native rules intact**. At present, PR #191 cannot be self-approved: another eligible human reviewer must approve the initial default-main installation (or an already-authorized independent installation route must be provided). Do not temporarily weaken branch protection.
4. Configure/verify required current-head CI and assurance checks plus the native rule requiring approval of the latest reviewable push by someone other than that pusher. Test a genuine denied merge.
5. Run one disposable pilot and record the actual App bot identity, valid signed HEAD, human reviewer eligibility, exact source tree, CI, and approval. Until then the feature is **NOT LIVE VERIFIED**.

## Per-change contract

- Agent prepares `agent-candidate/feature-scope` on the same repository; the source commit must be an exact forty-character SHA descended from the explicitly pinned current `development` commit.
- Owner dispatches the installed `Tesbo agent PR handoff` workflow on `main` with `source_branch`, `source_sha` and `base_sha`. The workflow checks repository and owner identity; there is no user-controlled target, unsigned fallback, self-approval or automatic merge.
- Trusted validator runs from a **separate main checkout**. The candidate is fetched as inert Git objects with read-only GitHub permissions and no persisted checkout credentials. No candidate code, package, script or git hook executes before App token minting.
- Ref changes, non-ancestor source, unclean checkout, empty/oversized diff, and sensitive governance/CI paths (`.github/`, `AGENTS.md`, `CLAUDE.md`, gitmodules, publisher and assurance scripts) refuse before any write. Security/workflow changes retain the separate normally reviewed PR path.
- The staged index tree must equal the exact source tree; this includes added, modified, deleted and binary content. Only then is a one-repository App token minted with minimal write scopes.
- The publisher creates/updates a **draft** `tesbo-agent/<exact-source-sha>` PR against `development` using a GitHub App signed commit. A native readback verifies the bot PR author, repository, base, branch and verified bot-committer HEAD. If the result is uncertain, inspect GitHub's authoritative PR/branch state before retrying.
- Human approval, actual executed tests, native Tesbo records and distinct Independent/White receipts are **still required** after publication. A green check or signed commit alone is not release authorization.

## Required positive and refusal scenarios

Prove a valid candidate becomes an App-authored signed draft that the owner can approve; preserve the exact candidate tree and unmodified source branch. Also prove rejection for nonowner/nonmain dispatch, stale SHA, malformed branch, protected-file edit, missing credential, wrong App/unsigned commit, new owner push after approval, unavailable API/readback, redundant dispatch, and an untrusted source trying to execute code.

The unit/real-local-Git contract tests run with `node --test scripts/agent-pr-handoff.test.mjs` and are part of normal CI hygiene. They do **not** certify installation, live App token permission, signed publication or GitHub rulesets. The default-main installation pilot must independently supply that evidence.

## Recovery and rollback

No publisher step merges, deploys, edits Tesbo project records, changes rulesets or fabricates review evidence. On failure preserve both candidate and history; a possibly created PR requires native readback before retry. Rollback via reviewed workflow removal and App key revocation; do not rewrite historical PR/assurance records.

**Important bootstrap limit:** This workflow cannot publish PR #191 as a bot before the workflow itself is installed on main. The current GitHub rule requiring another eligible reviewer for that initial installation remains in force.
