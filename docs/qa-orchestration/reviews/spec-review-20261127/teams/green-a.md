# Green A — Tesbo v1.4.49 C2 original review

**Date:** 27 November 2026  
**Assignment:** Green Team member A and declared document-verifier operator.  
**Disposition:** Scoped member signoff for the C2 amendment to remain **PROPOSED / BACKLOG / NOT FROZEN**, with the existing implementation and evidence gates retained. No newly demonstrated blocking amendment defect in the inspected scope. This is not a formal two-member Green verdict, product freeze, implementation acceptance, or human-owner approval.

## Independence, authority and identities

This member was separately dispatched without parent conversation history (`fork_turns=none`). I read RUN_CONTEXT.md and INPUTS.json first. No preparation report, other member report, or original C1 team report was opened before saving this original. In particular, I did not follow the embedded link to Red A's report. The candidate itself explicitly describes earlier source findings and its C2 corrections, including the sync fence, replacement-account identity, and retained-data distinctions. This is an informed delta review, with independent source corroboration of those exposed concerns; it is neither blind discovery nor an efficacy experiment. No human-owner participation is asserted.

Target: `1alextest/Tesbooboo`, proposed documentation amendment C2. Frozen INPUTS.json SHA-256: `c722c8e75521a495a1560f562324bfc27ad2b2e8e318f0d4986b80a18b1a760c`. Current integrated application source: `d440c48ede32ca38783b178ea6d957ded8bca9e4`. Historical source claims retain `f92c3341eadc03f274becbead3b0f45d0a86539e`; the research parent is `7539a739243167b2d6709df1d644bd5b955f6ffc`. Saved v1.4.48 baseline is the supplied extracted canonical directory; its archive digest is declared in the run context, not independently re-proven by the document verifier.

Unchanged method source: `NesberryEnterprise/Nesberry@d83549c85a4dcd047fb40dc4fba4ec62737ab0fc`. Read Green charter v5.8, review-orchestration.md, and POL-GOVERNANCE-ASSURANCE-PORTABILITY/v001.md. Local SHA-256 values:

| Method | SHA-256 |
| --- | --- |
| Green charter | `69137a78f4a6d4157886fb5e7a30d39f209772071716a866aee21f9c10d9f857` |
| Orchestration | `8fd41f22e1909afd48d8af95120d03a0f52e30a1bf9976a639fb6cca67bb4729` |
| Portability policy | `33c69cba82f7d98773e85a30fa1afff15cc0dbcec0d88302a0295ce06e2c8524` |

Tesbo supplies the actual authorization, KB, source-connection, Skill, task and execution owners. Nesberry's CMS exclusion, marketplace axes, runtime commands and deployment assumptions were not imported as Tesbo policy. The Green verification binding here is the declared Python document checker, not Nesberry's script or a Graph harness.

## Inspected scope and independent questions

Read all eight `delta/*.diff` in full. Read the C1→C2 changes for canonical 03/05, AGENTS.md, CLAUDE.md, the Skills subordinate pointer and the research continuation; read the verifier in full. Read the current source manifest and current method-owner excerpts, including canonical 06's complete added procedure/shared gates, AGENTS principles 1–18, and the subordinate canonical-method links. Followed selected prior owners: FR-058, FR-124, T-408, T-422, T-453, canonical 04's imported-source identity and ASER-C02 contracts, canonical 03's governed Skills owner and v1.4.47 maturity/trust boundary.

Read the listed source slices below at the current integration commit, both package manifests, and V47/V72/V97 migrations in full. Compared the relevant historical/current Git objects or function bodies. Inspected existing UI source excerpts for reuse, not pixels or behavior. Some broad discovery output was truncated; it was used only as a locator, and relied-on blocks were re-read narrowly. I do not claim full reading of the eight large historical files, legacy.service.ts, all integration paths, or the full repository.

Questions independently applied:

1. Does one native truth retain one owner through requirements, design, logical contracts and acceptance, or does a package create a second approval/evidence/runtime authority?
2. Which facts can survive disconnect, replacement, revocation and removal independently? What exact historical identity must a later reader resolve?
3. Does reuse preserve the actual capability and permission grain, including normal completion and same-account renewal, rather than merely reuse a familiar name?
4. Is a common invariant earned across materially different consumers without imposing one runtime, schema, UI or attachment scope?
5. Can the declared verifier distinguish a corrupted package from a valid one, and which purported assurances are outside its semantics?
6. Could an existing status/history UI be reused unchanged for richer freshness, health and exact-revision claims?

## Requirement → design → proof reconciliation

| Obligation | Design/contract owner | Proof and current maturity |
| --- | --- | --- |
| Exact package, source, configuration and actor identity | 03 identity/contribution sections; 04 logical groups and ASER-C02 | 05 packaged-entry, source replacement, upgrade and retry scenarios. Proposed plugin fields are expressly logical meanings, not deployed schema. |
| Existing authority survives every entry point | 01 obligations 2/4/5; 03 lifecycle/native owners; 04 admission/protected-effect current grant | 05 unauthorized UI/API/MCP/job and awaited-work fence controls. Native Skills has concrete authority/version enforcement; sync lacks equivalent demonstrated post-wait fencing. No runtime acceptance follows. |
| Retained history differs from current source access | 03 retained-data paragraph; 04 authorized readback and expired/redacted evidence | 05 explicitly separates disconnect/removal from revocation of the applicable read grant. This fits sampled project-owned KB readers. |
| Content import does not approve or activate a method | 03 method/content profile; existing T-422/D-14; 04 native approval owner | Existing approved-version assignment source is reusable. Full content-pack compatibility/composition and efficacy remain proposed. |
| Research conclusions remain attributable and falsifiable | 06 method owner; existing FR-124/T-453 evaluation | 05 unlike tasks, valid alternatives, faulty/conforming/UNKNOWN outcomes and full cost. Current review supplies no comparative effectiveness result. |
| Usable optional contribution and no-plugin route | 02 outcomes/recovery; 07 existing native surfaces | 05 distinct-profile and legitimate core/manual scenarios. No authentic current render or human task-comprehension evidence. |

The six profiles are conditional design obligations, not six new approved features. FR-058 and T-408 retain execution-agent scope. Their original definitions do not establish a general installed-plugin platform. T-422 remains the method owner; T-453 and FR-124 supply evaluation obligations, rather than a new scoring/learning service. The package's four planning states do not replace runtime state. The inspected trace has no new orphan owner or contradictory admission rule requiring a C2 text change.

This is sampled semantic traceability, not a computed zero-orphan audit of every prior requirement or task.

## Source corroboration and counterevidence

### G-A/C2-01 — retained knowledge and read authority: correction supported

**Disposition:** no new defect; C2 clarification accepted in this scope.

At current `legacy.service.ts` around 14934–15006, `integrationDisconnect` requires workspace-owner authority, settles active runs, clears credentials and disables mappings, and deliberately leaves KB folders/documents untouched. `listKnowledgeDocuments` and `getKnowledgeDocument` around 12363 and 12475 check project access and project-scoped document identity; the inspected methods do not require a currently connected provider. V97 preserves the connection row.

Consequently, disconnect alone is not evidence that project-owned knowledge becomes unreadable. Conversely these sampled readers do not prove a new source-specific retained-data authorization model. C2 correctly makes that an explicit policy/reader/index/cache/export migration gate if selected. The revised 05 scenario has a meaningful conforming neighbor: disconnected but still project-authorized history stays available; separately revoked protected reads must fail.

**Boundary:** I did not sweep every RAG, embedding, cache, export, sharing, evidence URL or MCP reader. No complete retained-data revocation certification.

### G-A/C2-02 — source identity survives neither UUID nor provider name alone

**Disposition:** candidate-exposed concern independently corroborated; retain the conditional convergence gate.

V47 fixes connection cardinality to organization/provider. V72 fixes mirror uniqueness to project/provider/external ID/source role. V97 retains the row on disconnect. Jira, Notion and Linear branches of `integrationCallback` update external identity and credentials through `ON CONFLICT (organization_id, provider) DO UPDATE`, preserving the row ID. `IntegrationSyncClient.loadConnection` resolves by organization/provider. These facts support C2's sequential-replacement question even when simultaneous accounts remain unselected.

The future trace must distinguish account A→B with a colliding remote ID and delayed A work from legitimate renewal of A's credentials. Neither a blanket rejection of all reconnects nor automatic continuity through a stable local UUID is adequate. The amendment places this with the existing source/connection owner and does not authorize a schema migration now.

**Boundary:** no provider collision was executed; no actual remote identifier collision frequency, migrated deployment, or data loss was established.

### G-A/C2-03 — existing sync is not a proven effect fence

**Disposition:** material existing implementation/proof gate, already represented in C2; not a newly discovered or reproduced production defect.

At `integration-sync.service.ts:194`, `markRunning` updates by run ID without a terminal-state predicate. `failActiveRunsForConnection` changes queued/running records to failed. In `integration-sync.processor.ts`, `processTicket` reads its ticket, resolves a provider connection, awaits provider comments/possible analysis, updates cached fields and later writes a mirror. Its mirror transaction takes the project/Skill mutation lock and checks the destination folder, but the inspected transaction does not revalidate the original run/source generation.

**Counterevidence that matters:** disconnect clears credentials and disables mappings; missing connection/mapping prevents some new work; `finishRun` does restrict its update to queued/running; the mirror transaction protects folder-deletion consistency. These controls are real and must survive a fix. They do not establish the proposed final authority/generation fence for work that already acquired its inputs. C2 accurately leaves a safe paused-worker demonstration and same-generation positive control open.

Current/historical equality was checked: V47, V72, V97 and all three inspected sync files have identical Git blobs at `f92c3341` and `d440c48e`. Callback/disconnect functions are byte-identical between these pins; legacy.service.ts as a whole is not. Thus the historical concern remains relevant to these exact current paths without upgrading it to a whole-source or deployment result.

### G-A/C2-04 — reuse has a demonstrated semantic seam, with limited current maturity

**Disposition:** source-grounded reuse advice; nonblocking for backlog documentation.

Native `approveSkillVersion` checks a human principal, current project authority, a selected submitted version, supersession and content digest before producing an approved snapshot. `skillAssignmentSource` requires an approved immutable version, and `assignSkill` separately checks current authority, scope conflicts and effective resolution under a transaction. `deactivateSkillAssignment` changes the assignment, preserving the version. This is a concrete unlike sibling to source connections: the shared invariant is exact basis + scoped authority + historical attribution, while their lifecycle/attachment policies differ.

UI disposition: **KEEP/EXTEND** the existing `WorkspaceIntegrationConfig` and `SyncStatusPanel` patterns for integration context/progress; **COMPOSE** suitable shared Button/Card/Field/Select and existing assignment recovery concepts from `SkillAssignmentForm`. Do not certify those components as a complete plugin-management interface. In the inspected `useSyncRun` excerpt a failed poll returns null while retaining prior state; progress is distinct from a new plugin's required health/freshness/configuration evidence. The existing history reader exposes sync-event descriptions with `versionId: null`; a history timeline alone does not prove exact prior source-body retrieval. Prior 04 already requires a retrievable exact task-time source revision or explicit UNKNOWN.

These are constraints on future reuse, not demands to add a catalog, poller, snapshot store or new UI now. Actual rendered baseline, accessibility, keyboard, reflow and human comprehension remain unverified.

## Second-order and relationship pass

Three credible uses of the semantic invariant are current provider intake, governed Skill assignment, and the existing FR-058/T-408 executor task/report direction. A fourth report/export consumer can use the same authoritative receipt references without sharing their write authority. The hardest contrasting case is inert method content: it needs approved-version assignment but may need no account connection, process, health probe or executable sandbox.

| Relationship candidate | Meaning, scope and disposition |
| --- | --- |
| Operation → exact source/binding generation | One operation can rely on several explicitly identified sources; source owner owns identity, native operation owns receipt. Pin original source/configuration and retain allowed history; reject/quarantine late events after replacement. Already covered by ASER-C02 + C2; extend the owner when admitted, no parallel graph. |
| Authored artifact → effective method resolution | One operation resolution can contain multiple exact approved assignments. T-422 owns selection; artifact owner owns output. Import/availability is not approval or activation. Already represented, keep distinct from package dependency closure. |
| Report/derived view → exact native evidence | Potentially many inputs; native result/evidence owners govern permission, retention and versions. Renderer removal changes presentation, not original result authority. Use existing references and UNKNOWN where a historical body is unavailable. |

Generalize the reasoning contract now. Keep package/interface/dependency identity as a named conditional seam. Do not extract shared runtime/storage merely because three capabilities mention identity or lifecycle. Source namespace participation is supporting input; method assignment is an authoring-policy dependency; an executor has effect authority; a report is a read projection. One UI or universal permission bit would erase those differences.

The practical opportunity is lower integration/review/recovery cost through consistent attribution and native receipt reuse. No measured cost saving, monetization opportunity or marketplace demand was established. Marketplace, SDK, hosting, distribution, first plugin and arbitrary code containment remain open decisions. This matches the owner-authorized scope and avoids both premature platformization and hiding the real future convergence needs.

## Executed document verification and limits

Executed from `/workspace/scratch/e50b253d95e4/tesbo`:

```sh
python docs/qa-orchestration/reviews/spec-review-20261127/verify-documents.py --candidate /workspace/scratch/e50b253d95e4/review-candidate-v149-c2 --baseline /workspace/scratch/e50b253d95e4/inputs/canonical-v148 --output /workspace/scratch/e50b253d95e4/team-reviews/green-a-document-integrity.json
```

**Exit 0; 45 passed, 0 failed.** Invoked script and frozen script both hash to `97410fd680261207ca04df7c284510af65e8471fbbb162323aa19ae216562b5b`. The input-manifest hash matches the declared frozen identity. The receipt is the unmodified verifier output.

Inspected semantics: 15 frozen-file identity checks; one canonical file/cardinality agreement; eight each of document-manifest identity, ordered saved-body preservation and canonical current-pointer checks; three text presence/count checks; two scanner document pins. The preserved-body check is an ordered line subsequence excluding the current-package pointer, not semantic equivalence or strict append-only verification. Exact bytes are bound to the externally declared manifest; a self-consistent replacement manifest is not independent provenance. Subordinate pointer correctness was inspected manually; the checker only verifies its canonical-method link. It does not resolve all links, validate implementation owners, prove archive extraction, execute the scanner, interpret contracts, or compute Graph closure.

**Non-vacuity control:** used a temporary copy of the 15 inputs plus INPUTS.json under `/tmp/green-a-document-control-qmo3t0z7/candidate`. Before invoking, the intended oracle was that altering the README's original title must fail saved-body preservation even if copied manifest metadata is recomputed consistently. Changed only that historical title; updated copied README bytes/SHA/Git blob, copied source-manifest metadata and copied INPUTS hashes. Frozen candidate/repository remained untouched.

```sh
python docs/qa-orchestration/reviews/spec-review-20261127/verify-documents.py --candidate /tmp/green-a-document-control-qmo3t0z7/candidate --baseline /workspace/scratch/e50b253d95e4/inputs/canonical-v148 --output /tmp/green-a-document-control-qmo3t0z7/negative-preserved-body.json
```

**Verifier exit 1; 44 passed, 1 failed**, exactly `saved v148 body preserved: 00_README.md`. The Python harness asserted this exact failure set and returned **exit 0**. This demonstrates one meaningful rejecting predicate, not comprehensive mutation sensitivity or semantic detection.

Compared frozen scanner binding to `d440c48e:scripts/check-gitleaks-evidence-exceptions.py`: only the explanatory comment and two canonical-document digests differ; the control logic and prose fragments are unchanged. That read-only diff returned exit 0. No Docker/Gitleaks or remote current-head CI was run, so scanner success is not claimed.

Source commands actually used included `git show <pin>:<path> | sed -n '<selected ranges>p'`, `git grep -n -E <symbols> <pin> -- <paths>`, `git diff --unified=0 f92c3341eadc03f274becbead3b0f45d0a86539e d440c48ede32ca38783b178ea6d957ded8bca9e4 -- Tesbo-Backend-Nest/src/legacy/legacy.service.ts`, and `git rev-parse <pin>:<path>` for the six equality checks above. Those relied-on reads/comparisons returned exit 0. One preliminary `git ls-tree ... | rg '(knowledge|skills|integration-connections|integrations).*(service|controller)\\.ts$'` lookup returned exit 1 (no dedicated named owner match); tracing then found the actual methods in legacy.service.ts. It was not a failed product test.

## Remaining gates and member signoff

No application tests, database calls, native writes, package installation, repository edits, deployed actions or new external research were performed. No callable Tesbo MCP was used; **Tesbo synchronization was not performed**. This report and its document receipt are the only final outputs of this member. External precedent claims were assessed for their stated evidence class/transfer limits, not independently re-researched.

Keep open: complete selected-profile actor/entrypoint/reader inventory; implementation/hosting/permission decisions; source-rebinding and post-wait fence proof/fixes; migration and exact-history qualification; applicable real client/packaging proof; full scanner/current-head CI; authentic UI and human validation; independent method evaluation; native record reconciliation; Graph and White disposition. The absence of runtime execution here is required by this review scope and cannot be converted to PASS or implicit N/A.

**Green A signs the declared document verification and this bounded source/semantic review.** C2's corrected distinctions and traceable future scenarios are adequate for the inspected proposal/backlog stage. The existing sync and source/history limitations must remain visible in the implementation owners. No source-based result grants product freeze, human approval, deployed safety, full review coverage, general-plugin readiness or computed Graph CLEAN.

This is the first frozen member output; later informed corrections must be separately appended or saved, retaining these original bytes.

