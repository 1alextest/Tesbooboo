# ASER — Implementation roadmap and assurance plan

**State:** Proposed; not a delivery report. Do not merge unimplemented acceptance statements into deployment claims. Use Tesbo `development` → reviewed PR → green checks; never write directly to `main`.

## Step 0 — Grounding / ownership challenge (before schema work)

1. Pin exact `development` commit and inspect current Tesbo source: `legacy` case/KB/bugs/requirements routes, `mcp.tools.ts`, `mcp.service.ts`, `behavior-graph`, `Model Studio`, Zyra task/activity/approval, files, migrations, sidebar and current tests.
2. For each user job (create native requirement, link case, maintain manual, propose policy, track task, attach file), create **reuse / extend / transform / new / unresolved** decision with evidence; check whether some existing feature already satisfies it through a different UI.
3. Compare deployed authenticated MCP `tools/list` and schema/fingerprint with this exact source, using a **separately authorized disposable test project**. Existing client observation of 50 tools vs source's 58 is an explicit outstanding gap.
4. Reconcile the existing Tesbo specification package and approved behavior before adding normative requirements. This proposal is not a replacement for the canonical eight-spec package or for the original independent assurance methodology.
5. Create a source-backed mapping from affected page/API/DB/graph artifact → rightful owner → existing tests → missing acceptance evidence.

**Exit:** no competing owners; persisted source/deploy/capability receipts; authority/approval and unresolved questions explicit.

## Work package A — Native requirements and testcase links (first vertical slice)

Extend the existing Requirements UI and KB `requirement_note` document/version owner with a stable typed native requirement and acceptance criteria. Extend native relationship services and MCP to create/read/revise native requirements, author case candidates and link them by native ID/revision. Preserve external Jira/Linear/Notion ownership and synced mirrors, and existing testcase history. Recompute separate authored/approved/executed coverage.

**Ship together:** migration only if actually needed; REST + MCP adapters; native UI; permissions; optimistic versions; idempotency; audit; reader migration/compatibility; API/UI/database tests; disposable agent create→read→update→link→approve/reject checks. Prove ASE-E2E-01, -02, -05, -07, -08, -11, -12.

**Blockers:** demonstrate how the existing graph canonical link layer represents the native case relation without misusing `sourceRefs` or external ticket keys.

## Work package B — Governed manuals and policies

Use existing Knowledge Base documents/versions/folders. Implement typed user manual view and section review/update workflow. Add decision/policy/rule governance and immutable accepted policy revisions, authority, previous/effective history, enforcement refs, and semantically valid corrections. Reuse Tesbo's actual reviewer/notification/audit services; adapt Nesberry policy triad by principle, not path or status vocabulary.

**Ship together:** UI views + diffs, REST + MCP proposal interfaces, enforcement of human approval, history immutability, stale-impact notifications, missing-verification status and tests for both legitimate changes and adversarial unauthorized attempts. Prove ASE-E2E-03, -04, -13.

**Blockers:** settle which existing KB version representation supports immutable accepted revisions and whether a narrow metadata extension is needed. Agent cannot assign its own normative authority.

## Work package C — General work items and file/evidence access

Extend existing Zyra task board/activity and Bugs relationships into one general project work-item/task journey, without changing the meaning of existing AI-generation tasks or duplicating Bugs. Add safe upload/link/metadata/byte-verification MCP/REST path over existing KB file/storage owner; use existing evidence links.

**Ship together:** work-item classification/ownership/status, board UX, source-aware reopen/close rules, MCP integration, project membership/role limits, file size/type/content validation, provenance/hash and storage-exists truth. Prove ASE-E2E-02, -07, -09.

**Blockers:** existing KB restore/download semantics and exact files/evidence owner must be re-verified. No speculative file service rewrite.

## Work package D — Connected Change Packet and reviews

Extend existing graph history/review, Zyra activities and notification delivery with cross-artifact Change Packet identity, applicability dispositions, typed edges and durable review receipts. Handle idempotent resume, conflicting revisions, partial writes and per-domain approval. Surface the change in a **single** Zyra review screen and project traceability report rather than creating a second Copilot.

**Ship together:** bounded batch API and thin MCP orchestration, atomic where same native transaction or durable partial journals where not, stale/current links, history, deduplication and notifications, error recovery, exact typed report views. Prove ASE-E2E-01 through -10 and -14 through -15.

**Blockers:** prove candidate vs approved vs executed vs deployed identity distinctions from the current graph and native runs before enabling completion badges.

## Work package E — Agent adoption and CI guardrails

Publish app-agnostic agent installation template; support Claude Code and a distinct `AGENTS.md`-reading agent. Inspect actual tool catalog at runtime, secure project binding, existing-record reconciliation, delegation and N/A reasoning. Add source/PR linkage verification and opt-in CI policy that reports missing domain assessments without mandating unnecessary updates.

**Ship together:** negative tests for cached catalogs, token mismatch, no MCP connection, replay, conflicting revisions, human rejection, cross-project links and offline resolution. Prove ASE-E2E-04, -06, -07, -08, -14.

**Blockers:** project-aware secure secrets and reconnect flow; avoid requiring always-on remote calls for builds without bound Tesbo integration.

## Independent specification assurance (separate from implementation author)

Use the **actual canonical** Nesberry team charters/orchestration as an independent review method applied to this Tesbo specification. Preserve original isolated findings and evidence before reconciling them. Do not reword the teams' instructions to elicit expected issues, and do not describe a written list of hypothetical objections as team findings.

Review targets: README, requirements, design, agent-rule template and this plan; plus exact Tesbo source baseline, Nesberry Policy Ledger format/tasks, and per-issue concurrency lesson. Confirm source and charter revisions in every real invocation.

For each invoked team preserve: role/charter SHA, input SHA, invocation identity, original findings, counterexamples, user/engineering consequence, evidence tier, proposed falsifiable test, explicit unknowns and false positives. Follow the canonical role order and **Graph then White closeout** if and only if actually run through the real orchestrator. An unexecuted review stays `not_run`.

The *specification* is the review target; the teams' methodology is not being rewritten as part of this PR.

## Verification gates

- **Architecture:** no duplicate owner for requirements/cases/documents/policies/bugs/tasks/files; call native services with existing validation/authorization.
- **Correctness:** reuse-first no-duplicate scenario; native requirement versioning/traceability; approval/publish exact-version checks; stale edit conflict; idempotency; partial failure recovery.
- **Security:** project and token isolation; delegated principal has no elevated authority; target source binding; file access and byte verification; role/plan/approval bypass attempts.
- **User experience:** correct modules/records visible to QA/BA/coding agent/PM/manual owner, accessibility and single Zyra workflow.
- **Execution:** selected unit/integration/E2E suites actually execute; approved cases only; attached evidence and target revision truthful.
- **Operations:** tool schema/version deployed identity, notification idempotency, rollback/cancel/retry, audit and history.
- **Documentation:** descriptions match verified source and current UI; unimplemented features explicitly labeled proposed.

## Non-authorized actions in this PR

Do not modify production tenants, delete/migrate live data, mark tests passed, claim target E2E verified, silently revise approved policies, assume all 58 source tools are deployed, alter agent charters, or merge before review and green checks. No actual assurance-team execution is recorded by writing this plan.
