# Gate A — installation identity foundation (27 November 2026)

**Source identity:** branch `feat/gate-k-external-kind-coherence-20261127` on top of
`origin/development` `ca0cdca5…`, after the Gate K correction V171. This is an implementation and
reconciliation record, not an independent review receipt, not a canonical specification, and not a
Gate A admission claim.

## Owners inspected before designing

| Fact | Existing owner | Observation |
|---|---|---|
| Human/agent identity | `agents` + `actors` (V58) | One actor row is materialised per `agents` row; FK reuse of the same UUID. |
| Shared machine actor | `agents` seed `tesbo-mcp` (V65) | Transport/API-token identity. It cannot distinguish two workstations or a rotated credential. |
| Automation actor | `agents` seed `tesbo-automation` (V84) | SDK result provenance. Also not a physical installation. |
| Zyra actor | `agents` seed `zyra` (V58) | Tesbo's internal author; not an executor installation. |
| Project credential | `api_tokens` (V5) | Binds `user_id`/`project_id`, not an installation. A rotated token is indistinguishable from its predecessor. |
| OAuth consent evidence | `mcp_oauth_grant_approval_bindings` (V167) | Binds a grant fingerprint and membership evidence; subordinates to the revisioned project MCP owner. Not installation identity. |
| Membership reinstatement | PR #292 (unmerged) | Adds paired `project_membership_id`/`organization_membership_id` to `api_tokens` so a removed/recreated membership cannot revive an old token family. |

## Findings

1. **The shared `tesbo-mcp` actor is not an installation.** An attempt attributed to it cannot name
   the physical executor, its project grants, or its credential generation. The same applies to
   `tesbo-automation` and `zyra`. Installation identity must be a distinct `agents`/`actors` row.
2. **`api_tokens` alone is not installation-bound.** It binds an issuer and a project; it does not
   identify which installation acts, so rotation, revocation and historical attribution cannot be
   separated from the human issuer.
3. **PR #292 is currently unmergeable on migration numbering.** Its branch adds
   `V166_api_token_membership_generation.sql`, but `development` already has
   `V166_knowledge_file_upload_recovery.sql`; the PR reports `CONFLICTING`. Its own record says not
   to allocate a number until persistent migration history is verified. Gate A therefore reserves
   **V172** and does not add the membership columns; #292 must be rebased and renumbered above V172
   before either can merge. Its `project_membership_id`/`organization_membership_id` columns are
   orthogonal to `api_tokens.installation_id` and compose in one later branch.
4. **PR #331 is documentation-only** (OAuth cookie topology). No schema overlap; installation
   binding for OAuth remains with the existing consent owner.

## Implemented — bounded slice 1 (`V172_agent_installation_foundation.sql`)

- `agent_installations`: one row per physical executor, `UNIQUE(agent_id)` so one installation owns
  exactly one `agents`/`actors` identity; organization-scoped unique installation key; `status`
  (`active`/`paused`/`deactivated`) so deactivation preserves attribution instead of deleting it;
  `created_by` as non-authoritative provenance.
- A trigger refuses the shared built-in actors (`zyra`, `tesbo-mcp`, `tesbo-automation`) as
  installations.
- `agent_installation_project_grants`: project-scoped action ceiling (`capabilities` whitelist
  enforced at the database), one grant per installation/project, `expires_at`/`revoked_at`,
  `granted_by`. A trigger refuses a grant whose project is outside the installation's organization.
- `api_tokens.installation_id` (nullable, `ON DELETE RESTRICT`): a credential may act as an
  installation; legacy/unbound tokens keep `NULL` and are never backfilled or inferred. Deleting an
  installation or its agent while a grant or credential depends on it is refused.

No route, MCP tool, service method, feature flag, assignment, attempt or producer is enabled. The
V168 external producer fence remains installed.

## Deferred to later bounded slices

- Assignments, fenced attempts, lease heartbeat/expiry, reassignment and revoked/expired authority
  (slice 2). The prompt↔attempt binding required by the V171 review belongs there.
- Command-time capability and current-membership enforcement, including the #292 membership
  generation predicate and the issuer-vs-installation distinction.
- OAuth/MCP consent binding to a specific installation (with #331 and the V167 owner).
- Any external producer admission; Gate K and Gate A admission evidence must both hold first.

## Verification

`check-db-integrity.cjs` now executes `verifyInstallationFoundation` against the disposable
PostgreSQL service: shared actor refused, per-organization key uniqueness, one agent per
installation, unknown capability refused, cross-organization grant refused, credential binding
retained, restricted deletion, and deactivation preserving attribution. Exact-head CI results belong
to the PR record; local Docker/Playwright execution is unavailable in this environment.
