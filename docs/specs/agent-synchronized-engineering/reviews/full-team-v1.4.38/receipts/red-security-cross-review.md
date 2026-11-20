# Red informed cross-review of Security's four v1.4.32 findings

**Reviewer:** `/root/red_v31`, one analytical Red reviewer. **Date:** 2026-11-20 UTC. **Mode:** informed source substantiation and falsification after reading Security's original receipt. This is neither cold discovery nor another formal team quorum. No source changes, live tests, database access, provider calls or target operations were performed.

## Result

The four core mechanisms have source support at the cited `419c2efa08b04aff6c7c7d0d56425eb572bd6ec2` pin. **Security-2 contains a factual error in its foreign-key explanation that needs an explicit informed correction.** Its attribution finding survives that correction and gains more precise supporting evidence. Other findings need their existing conditions retained and several impact/closure statements narrowed as detailed below.

| Security finding | Cross-review disposition | Severity assessment |
| --- | --- | --- |
| Security-1: source allowlisting versus destination entitlement | Substantiated as a conditional source-admission gap. A documented intentionally shared source catalog is a legitimate counterexample. Metadata persistence and change-receipt exposure are supported; arbitrary raw-source disclosure is not. | Retain **HIGH, conditional** only where private source or sensitive metadata is configured for a destination lacking entitlement. Actual deployment exposure is unknown. |
| Security-2: machine result attributed to issuer | Substantiated, with a **material correction**: the declared `executed_by` FK is to `actors`, not `users`. Existing machine actor support should be reused. MCP also leaves existing `reported_by` unchanged, including a fresh row's `human` default. | Retain **HIGH for adoption into the proposed trusted-evidence workflow**, not a claim of observed high-severity human impersonation or unauthorized cross-project writing. |
| Security-3: admitted credential lost before capture finalization | Substantiated for the inspected MCP capture path. Current membership, binding and pinned-ref defenses remain effective counterevidence to broader claims. | Retain **HIGH within the stated revoked project/source scope** as a conditional adoption risk under the proposed final-use contract. Race outcome remains reasoned, not reproduced. |
| Security-4: retrieved data flattened into AI system context | Substantiated as loss of trust/authority metadata at the provider boundary and an injection-admission concern. No actual Skill activation, model obedience, tool escape or exfiltration is established. | **MEDIUM** is supportable for the inspected composition; no escalation is justified by this review. |

All four remain **Open**. I do not adopt a runtime risk-acceptance verdict from the existence of planned mitigations. This report supplies additional source scrutiny, not release permission or architecture freeze.

## 1. Exact evidence and independence

The reviewed [security-v32-original.md](sandbox:/workspace/scratch/40f0abd3bdbc/receipts/security-v32-original.md) is **35,860 bytes**, SHA-256 `fe8b65e8210ac37d6a0f65634a856957904748cd8f92bf897894ff6bf161b4c7`. I read it before this task's source traces, so the questions and findings here are explicitly informed.

Application evidence is the supplied backend and frontend caches at **419c2efa08b04aff6c7c7d0d56425eb572bd6ec2**. I reopened the cited implementations and followed only the additional paths needed to test their claims. I recomputed byte counts, SHA-256 and Git-blob identities for **26 primary source files** used in this cross-review; all matched their respective supplied manifests. This verifies local binding, not a fresh remote fetch or a deployed schema.

I read the relevant actor/authority and final-use clauses in candidate1's canonical 03 and 04 and verified those complete file digests against [the candidate1 manifest](sandbox:/workspace/scratch/40f0abd3bdbc/input-v32-candidate1/manifest.json), SHA-256 `4f406b91251b85b2cd0def05fef9ce950481daa6b7b030762aed49998ac747f9`. This was **not** a semantic recheck of the final canonical v1.4.32 amendment. I did not independently repeat Security's later-tree comparison to `e3d0ebcbe8ec88c5b191abdf2b1d352d44929747`, document verifier, all 872-file integrity sweep, dependency audit or secret/telemetry review. No later source or specification receives credit here.

[Verification record](sandbox:/workspace/scratch/40f0abd3bdbc/receipts/red-security-cross-review-verification.json) lists the exact checked paths and hashes. The original Red receipt including its Blue reconciliation remains byte-identical at SHA-256 `f42491896c72e9fd185cc63e8160d8a0db3bb53c4623a0b5404bd4fa28ce445d`; its frozen cold prefix remains `535bdcc0220ddd6fc24d0f7239b0485401eb17609c5acb0d43d385a6364d06de`. Neither that receipt nor Security's original was edited.

## 2. Security-1 — conditional source entitlement

### Independently supported mechanism

[graph-change-review.module.ts](sandbox:/workspace/scratch/40f0abd3bdbc/source419/Tesbo-Backend-Nest/src/behavior-graph/graph-change-review.module.ts), `parseApprovedSourceCheckouts`, builds a server registry of checkout key → root/repository identity. It contains no destination-project entitlement dimension. [project-source-binding.management.ts](sandbox:/workspace/scratch/40f0abd3bdbc/source419/Tesbo-Backend-Nest/src/behavior-graph/project-source-binding.management.ts), `setForOwner`, checks the destination owner, validates the configured repository/key/ref/prefix fields and tests registry membership. Its authorized SQL write rechecks destination ownership. [project-source-binding.ts](sandbox:/workspace/scratch/40f0abd3bdbc/source419/Tesbo-Backend-Nest/src/behavior-graph/project-source-binding.ts), `resolveForUser`/`verifyForUser`, combines destination membership with the enabled binding and approved checkout; it does not consult an independent source-to-destination grant.

That supports the narrow claim: **these controls do not independently represent selective source entitlement**. It does not prove that the real server hosts sources intended to be selectively private. The registry might deliberately contain only globally shareable repositories. The record supplies neither its deployed contents nor an accepted sharing policy, so that policy question remains unresolved.

### Counterevidence and blast-radius qualification

The [local pinned Git reader](sandbox:/workspace/scratch/40f0abd3bdbc/source419/Tesbo-Backend-Nest/src/behavior-graph/local-pinned-git-source.ts) uses a configured repository root, bounded `execFile` calls, cleaned Git environment, local branch refs and regular-blob checks. The [source verifier](sandbox:/workspace/scratch/40f0abd3bdbc/source419/Tesbo-Backend-Nest/src/behavior-graph/implementation-source-verifier.ts) validates exact bytes, scope, size and line hashes. These are concrete defenses against arbitrary host paths, commands and invented source evidence. They do not answer which destination may use the configured source.

The [implementation projection](sandbox:/workspace/scratch/40f0abd3bdbc/source419/Tesbo-Backend-Nest/src/behavior-graph/implementation-observation-graph.ts) puts repository/file-path identity into node IDs and content digests into node versions. The history owner persists that projection. A comparable change's [QA review receipt](sandbox:/workspace/scratch/40f0abd3bdbc/source419/Tesbo-Backend-Nest/src/behavior-graph/qa-change-review-receipt.ts) exposes added/modified/removed node IDs, and thus can expose path/repository metadata. However, `capture_qa_graph_change` returns a history receipt, revision and delivery outcome, **not an arbitrary file-body download**. A first baseline can have a null review receipt. Do not state that every successful capture immediately returns a full file inventory or all content hashes. The strongest proven sink is destination-project history; visible detail depends on the response/reader and whether there is a comparable change.

### Disposition and legitimate alternative

Retain the finding with conditional HIGH severity where that metadata or source is private and the destination lacks entitlement. Bind/capture/final-use checks belong to the existing source owner. An approved and tested intentionally shared catalog is a valid alternative; it is not a bypass simply because it lacks per-project grant rows. An empty/unconfigured registry or a refused bounded scan also does not demonstrate the hypothesized disclosure.

The proposed negative and neighboring positive tests are suitable. Their oracle must identify the actual source policy and inspect the precise exposed metadata. Raw source-body leakage should not become the expected reproduced failure without a separately traced body-reading path.

## 3. Security-2 — attribution survives challenge; foreign-key rationale does not

### Supported data flow

[mcp.tools.ts](sandbox:/workspace/scratch/40f0abd3bdbc/source419/Tesbo-Backend-Nest/src/mcp/mcp.tools.ts) explicitly sends `ctx.userId` to `LegacyService.updateExecution` for both `record_execution_result` and `update_execution_result`. The MCP service has already resolved a separate agent actor in its context, but these handlers do not pass it into the native result writer. The helper `requireExecutionOwner` checks the execution's parent project; this is not a demonstrated cross-project write.

In [legacy.service.ts](sandbox:/workspace/scratch/40f0abd3bdbc/source419/Tesbo-Backend-Nest/src/legacy/legacy.service.ts), `updateExecution` uses that one identity for user/project authorization, then `writeExecution` uses it as `executed_by` when a nonempty status is written and sets `executed_at` to recording time. Metadata-only edits preserve the existing performer value. `publishExecutionChange` also attributes the activity to that identity. Consequently, the described machine submission loses its distinct machine actor at this path. The tool documentation is candid about issuer attribution; it is not a covertly undocumented choice.

### Required correction to the original explanation

The handler comment says `executions.executed_by` references users rather than actors. **That comment is contradicted by the repository's schema and neighboring implementation:**

- [V60_executions_soft_delete_and_actors.sql](sandbox:/workspace/scratch/40f0abd3bdbc/source419/Tesbo-Backend-Nest/migrations/V60_executions_soft_delete_and_actors.sql) adds `executed_by UUID REFERENCES actors(id)` and describes recording results by humans or AI agents.
- [V58_actors_identity.sql](sandbox:/workspace/scratch/40f0abd3bdbc/source419/Tesbo-Backend-Nest/migrations/V58_actors_identity.sql) represents human users and agents in `actors`, sharing the corresponding IDs.
- [V65_mcp_agent_actor.sql](sandbox:/workspace/scratch/40f0abd3bdbc/source419/Tesbo-Backend-Nest/migrations/V65_mcp_agent_actor.sql) explicitly seeds `tesbo-mcp` for actor-referencing columns including `executions.executed_by`.
- [V84_automation_run_ingest.sql](sandbox:/workspace/scratch/40f0abd3bdbc/source419/Tesbo-Backend-Nest/migrations/V84_automation_run_ingest.sql) and [automation.service.ts](sandbox:/workspace/scratch/40f0abd3bdbc/source419/Tesbo-Backend-Nest/src/automation/automation.service.ts), `recordResult`, already support a distinct automation actor and `reported_by='automation'`. The resolver has an issuer fallback when its agent actor is unavailable; this is source support for a reusable mechanism, not a claim of perfect provenance on every automation path.

A targeted search of the supplied migrations found no later explicit `executed_by` repoint to users. No database was introspected, so a deployed schema mismatch remains unknown. At the reviewed source pin, the statement that a **users FK explains the choice** is unsupported. It should be corrected in an informed addendum, preserving the original receipt.

The comment's other explanation remains material: `updateExecution` treats its second argument as a user for workspace/membership authorization. **Simply substituting `ctx.actorId` into that parameter is not a safe fix.** Separate the identity authorizing the delegated request from the actor recorded for the submission, and carry credential/delegation/attempt provenance through the existing native owner. Reuse the actor model rather than prescribing an unnecessary FK migration or parallel identity store.

### Additional evidence and limits on user-visible consequences

V84 creates `reported_by` with default `human` and allows `human|automation`. The inspected MCP/native `writeExecution` path does not change that field. A freshly created ordinary execution therefore retains the human channel marker when the machine records a result; an older automated row can retain its earlier automation marker after a different later writer. This follows from the declared default and update statement, not a live reproduction.

The native `executions()` projection returns `reported_by` but does **not** select `executed_by`. The frontend [API type](sandbox:/workspace/scratch/40f0abd3bdbc/source419-frontend/Tesbo-Frontend/lib/api.ts) describes the human/automation channel, and [AutomationResultMeta.tsx](sandbox:/workspace/scratch/40f0abd3bdbc/source419-frontend/Tesbo-Frontend/components/AutomationResultMeta.tsx) shows its automated badge only for `reportedBy === 'automation'`. These sources support an attribution/channel gap. They do not establish a rendered screen falsely naming a particular human as physical tester. The current row records who submitted through a path; even a correct actor ID would not by itself prove that anyone physically exercised the target.

### Disposition and severity

Retain the core finding, with the corrected rationale and existing-actor reuse recommendation. HIGH is defensible **when adopting this path as trusted actual-performer/evidence input under the proposed contract**. An authorized delegated result submission is otherwise a legitimate operation; issuer accountability alone is not an authorization exploit. Actual consumer reliance, deployment policy and rendered harm remain unverified. No unconditional current-exploit severity or CVSS score is established here.

The existing result-owner regression should compare a human report, machine report and authorized automation report from the same accountable issuer; assert separate recorder/issuer/provenance, truthful channel, preserved originals and lawful corrections. Do not backfill old results as known human or machine events. An automation actor is evidence about the recorder, not proof of target execution.

## 4. Security-3 — final credential checks are missing from the inspected capture path

### Supported interleaving

[mcp.service.ts](sandbox:/workspace/scratch/40f0abd3bdbc/source419/Tesbo-Backend-Nest/src/mcp/mcp.service.ts), `authorizeRequest`/`clientCanUseTool`, checks current token and named grant at entry. `callTool` preserves `tokenId`, actor and user in the tool context. But the capture handler calls `captureForUser(ctx.userId, ctx.projectId)`; the [coordinator](sandbox:/workspace/scratch/40f0abd3bdbc/source419/Tesbo-Backend-Nest/src/behavior-graph/project-source-graph.coordinator.ts) and [history owner](sandbox:/workspace/scratch/40f0abd3bdbc/source419/Tesbo-Backend-Nest/src/behavior-graph/current-cache-graph.history.ts) accept only user/project identity for authorization. No token, named grant or MCP-purpose context reaches their final write check. `callTool` returns the handler result without a fresh grant check.

Thus the proposed schedule is supported: admission succeeds; token/grant is revoked or MCP disabled while source work or a lock wait is pending; issuer membership and source binding remain valid; the later history path has no credential-specific fact with which to deny the operation. This is a source-derived race against candidate1's post-wait/final-use contract, not an executed exploit. It does not establish a universal legacy rule that every already admitted request must be cancellable at every instant; the required fence must remain explicit.

### Counterevidence that must remain in the finding

The history writer locks and compares the current binding, revalidates the pinned branch after acquiring the project lock, reads the native graph with current membership conditions and checks membership again in the INSERT. The [native reader](sandbox:/workspace/scratch/40f0abd3bdbc/source419/Tesbo-Backend-Nest/src/behavior-graph/current-cache-graph.reader.ts) scopes its authorized projection in SQL. A different-member, changed-binding or moved-ref attack is therefore not interchangeable with token-only revocation while the issuer remains authorized.

`LegacyService.stageTestcaseChanges` is a concrete stronger sibling: it carries producer context, rereads token scope and MCP grant inside the native transaction and preserves producer provenance. The actor/request context need not become a new security service. That inlet is an opt-in preview; its pattern is useful source evidence, not a deployed or universally verified solution.

### Refine the closure schedule

Retain the finding and its bounded HIGH adoption severity. Reuse the native operation context and check current credential/purpose/grant where the protected effect is fenced. The regression should distinguish:

1. **Revocation before the final history fence:** refuse the protected effect; no forbidden new history commit.
2. **Lawful commit before revocation, with response/notification delivery still pending:** retain the lawful historical fact, then enforce whatever current-access delivery/readback contract applies. Do not demand retroactive deletion or claim an external effect can be undone.
3. **New call after revocation:** the already implemented MCP entry check should refuse it; this does not demonstrate cancellation of an earlier in-flight request.

`capture_qa_graph_change` accepts **no parameters**, and I found no client idempotency-key contract on that tool. Its graph/history receipt has a stable derived identity. Security's “same key/readback” closure wording should therefore be bound to the actual history/receipt mechanism or explicitly marked as future contract work, not described as an already installed client-key interface. A successful test must use the actual native controls and a deterministic barrier, not timing luck.

## 5. Security-4 — unsafe authority composition, without demonstrated activation

### Supported composition

The inspected `knowledgeSnapshot` returns title/content and optional source citations. Ordinary files and documents can be selected or obtained through bounded fallback. The chat assembly then flattens knowledge items to title/text under a “Knowledge base” heading, along with other project sources and transcript text. Those bytes enter the same `context` string as fixed router instructions. `zyraChatWithOpenAi` puts it in a system message; `zyraChatWithAnthropic` puts it in the system field. The cited code therefore supports the stated composition mechanism. It does not retain a server-resolved governing manifest with each source's current assignment, exact version/digest and trust class in that envelope.

### Counterevidence and legitimate reference use

[knowledge-document-revision.ts](sandbox:/workspace/scratch/40f0abd3bdbc/source419/Tesbo-Backend-Nest/src/legacy/knowledge-document-revision.ts), `knowledgeDocumentAiContextSql`, does enforce exact reviewed AI-memory content and relevant metadata; its comment expressly limits this to memory rather than a general Skills resolver. KB capability OFF also clears the context, and ordinary reads remain project-scoped. Existing native permissions and publication guards are not erased merely because a model sees malicious text.

Readable reference material is legitimate input. The desired invariant does not require banning all unapproved documents from analytical context or pretending that every document is a governing Skill. It requires keeping reference facts and instructions that have actual governing authority distinguishable, with deterministic permissions and effects enforced outside model prose. An approved document that has no effective assignment also cannot acquire that assignment from its own text.

### Disposition and closure

Retain MEDIUM as a source-admission concern. The proven fact is **loss of authority classification and co-placement with instructions**, not successful model obedience, durable Skill activation, arbitrary external tools, exfiltration or official publication. Changing a provider role or adding delimiters alone would not establish the broader contract.

The proposed hostile-content cases should use the actual selected consumers and inspect provider envelopes, permitted tool requests, attempted effects and resulting records. Include legitimate ordinary reference use, reviewed-but-unassigned content, candidate text claiming authority and separately authorized governing guidance. No model/provider was invoked here, and the susceptibility of a particular model or downstream tool chain remains untested.

## 6. Consolidation, uninspected scope and handoff

Security-1 concerns **which source a destination may use**. Security-3 concerns **whether an already admitted credential still authorizes a later effect or disclosure**. They are related, but do not duplicate one another. Security-2 is a **recording/provenance** issue, not proof of unauthorized write scope. Security-4 is a **context trust** issue, not proof that retrieval changes durable assignment. A combined attack chain requires all of its prerequisites and downstream reliance; independent source support for its links is not an executed chain.

Required report refinements are:

- Correct Security-2's users-FK rationale using V58/V60/V65/V84 and the existing automation actor path. Preserve the single-parameter authorization coupling as the actual problem; do not suggest passing an agent ID into a user-membership check unchanged.
- Retain conditional sharing policy and metadata-only scope for Security-1; distinguish baseline receipt from changed-node exposure.
- Keep Security-2's adoption severity conditional; distinguish stored attribution/channel from rendered human identity and physical performance.
- Split Security-3's before-commit and after-commit schedules; bind retry/readback to the actual tool contract.
- Describe Security-4 as unproven authority/injection safety at the context boundary, not observed Skill activation or exploit success.

Uninspected or unknown: live registry contents and sharing policy; actual deployed schema and migration state; token/client rollout configuration; all REST/MCP/worker entrances; every legacy result consumer or actor display; full RAG/provider/evaluator/telemetry paths; notification delivery internals; runtime transaction ordering, cancellation and replay; real LLM response; privacy/retention implementation; final post-specialist canonical v1.4.32 text; and all other Security side findings. The targeted frontend reads were source inspection only, not an authentic UI baseline.

**Final disposition:** distinct analytical source substantiation complete, with one material factual correction and explicit scope/closure refinements. All four findings remain open at their qualified scope; no runtime risk acceptance, formal Security/Red quorum, human signature or freeze is supplied. The original Red and Security receipts remain unchanged. Final canonical amendment recheck is a separate task.
