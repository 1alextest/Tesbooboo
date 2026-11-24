## Purpose and named scope

Describe what changed and why.

## Architecture, reuse and impact

- Base/head revision and existing authoritative owner:
- Existing implementation/helper/component/workflow inspected (paths):
- Reuse / extend / compose / extract / new, and why:
- Affected entry points and downstream consumers (REST, MCP, jobs, data, UI, SDK, reports):
- Impact-plan artifact and gaps requiring human review:

Follow the canonical principles in `AGENTS.md`; static mapping does not prove behavior.
Affected areas need verification, not gratuitous edits in every layer.

## Validation

- Exact commands and results, tied to the current head:
- Selected versus executed tests, skips and unverified paths:
- [ ] Architecture/reuse and migration-history gates checked
- [ ] Existing impacted backend/frontend/SDK/contract lanes checked
- [ ] Product E2E run under `CLAUDE.md`, or explicitly reported blocked/not run
- [ ] Documentation updated, if needed

## Coupled scope

List necessary cross-area changes and their justification.

## Findings not fixed

Give file/source evidence, consequence and next action. Do not silently expand scope.

## Deliberately not done, limitations and rollback

Include configuration/migration steps, remaining owner decisions and rollback.
