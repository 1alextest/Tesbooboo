# Blue B — informed C2 delta recheck

**Date:** 27 November 2026  
**Member:** /root/blue_b  
**Target:** frozen Tesbo v1.4.49 C2  
**Scope:** closure of my C1 finding PLUG-BB01 and its affected native owners/consumers; adjacent C2 source-identity, fencing and pointer changes  
**Evidence mode:** document/source inspection and exact-byte comparisons only

## Disposition

**PLUG-BB01 is ADDRESSED in C2 at the specification level.** The changed canonical 03 paragraph now distinguishes connector disconnection or code removal from revocation of the actual authority to read retained material. Canonical 05 supplies both the legitimate retained-read outcome and the refused-read outcome after the governing grant is revoked. The former ambiguity no longer blocks this scoped member's acceptance of the C2 documentation correction.

**No new material contradiction was found within this focused delta.** This does not establish implemented retained-data ACLs, a fixed sync-effect fence, runtime acceptance, whole-package freeze or a formal Blue quorum verdict. The package remains **Proposed / Backlog / NOT FROZEN**. White owns final disposition.

The original C1 report remains a C1 report with its original finding and evidence. This separate record closes that finding against C2; it does not rewrite the earlier result or retroactively certify the older candidate.

## Commission and independence

Exact follow-up assignment:

> Please perform a focused informed delta recheck of your own PLUG-BB01 against frozen C2: /workspace/scratch/e50b253d95e4/review-candidate-v149-c2/RUN_CONTEXT.md, INPUTS.json and change-from-c1/. C2's 03/05 clarify actual read revocation versus disconnect, add retained-data reader/migration gates and positive/refused scenarios; also source replacement and source-fence qualification, stale pointer and incoming development integration. Independently verify whether the changed contract closes your finding, any affected prior owner/consumer contradiction, and the scope of your C2 member disposition. Preserve blue-b.md byte-for-byte; write brief /workspace/scratch/e50b253d95e4/team-reviews/blue-b-c2-delta.md. No need to reread unchanged historical files or expand the audit. No product execution or candidate/repository edits. Do not relabel your C1 output or claim human participation.

This is an **informed follow-up by the same member**, not a fresh no-history review. I retain my own C1 findings. C2's authored text describes corrections and links a Red A finding; I read that candidate text but did not read the peer report or use its conclusion as my oracle. No human/deployed-owner participation or native authority is claimed.

Methods remain the unchanged Blue v2.7 charter, review orchestration and portability policy at NesberryEnterprise/Nesberry@d83549c85a4dcd047fb40dc4fba4ec62737ab0fc, already read and hash-verified in my original report. No method, quorum or authority was changed.

## Exact identities and checked scope

- C2 INPUTS.json SHA-256: **c722c8e75521a495a1560f562324bfc27ad2b2e8e318f0d4986b80a18b1a760c**.
- C2 canonical 03 SHA-256: **374bf4e7d853c958c9442baf56c8a06e62dcac0a97be10e221a7fd73e41c7499**.
- C2 canonical 05 SHA-256: **1a0c034a4198df51eede6acfbe4f32f519322de4b8073fa4e52a6f67d71677bd**.
- Current application integration parent: **d440c48ede32ca38783b178ea6d957ded8bca9e4**.
- Earlier source claims retain **f92c3341eadc03f274becbead3b0f45d0a86539e**.
- Original blue-b.md SHA-256: **f33c4cb49fad8e0ce8ff959e8ee8edb0a59de01d024e3f0b08301fb22d570431**.

I read C2 RUN_CONTEXT.md and INPUTS.json, complete C1→C2 diffs for canonical 03/05, AGENTS.md, CLAUDE.md, the subordinate Skills pointer, research continuation and source manifest. I also read the changed canonical 03 lifecycle context and canonical 05 scenario table directly from the frozen files.

I verified all **15/15** C2 artifact hashes and byte counts, all **7/7** inspected diffs against the actual C1/C2 files, and that canonical 00/01/02/04/06/07 are byte-identical to C1. Their relevant prior clauses were inspected in my C1 review and were not needlessly reread. The added verifier/scanner-binding files were checked for manifest identity only; I did not review their implementation or execute Green's declared verifier.

No entire-history, entire-source, deployment, UI or full-review claim follows.

## Closure reasoning and counterexamples

| Original concern / closure condition | C2 evidence | Member result |
| --- | --- | --- |
| Does remove/disconnect automatically revoke every retained read? | Canonical 03, “Lifecycle, changes and recovery,” now limits denial to the extent of the applicable read-authority revocation and expressly preserves separately authorized project-owned knowledge/history after disconnect or uninstall. | Closed: scope is explicit. |
| Could retained history be used to bypass a genuinely revoked source/data grant? | The same paragraph states that retained bytes or an available native view do not override a revoked read grant, and requires each reader's current native authority. | Closed: the valid preservation case does not create a privacy bypass. |
| Does a new source-specific retained-data policy silently appear as already implemented project behavior? | Canonical 03 names the policy owner, migration and every affected reader/index/cache/export path as prerequisites when the selected profile adds such permissions. | Closed at design stage; actual policy/migration/enforcement remains future work. |
| Is there an observable discriminator rather than only prose? | Canonical 05's “Authorized reader / historical result” scenario opens retained evidence after disconnect/removal or renderer loss, then separately revokes its applicable read grant. | Closed: positive and refused outcomes are distinguishable. |
| Are prior requirement/workflow/contract/UI consumers contradicted? | Unchanged canonical 01/02/04/07 preserve native authority, governed history, current permission on receipt readback and profile-specific UI. C2 qualifies the previously ambiguous implementation paragraph consistently with them. | No affected contradiction found. |

The discriminating pair remains the one from my original review:

**A — stop collection, retain legitimate rights.** A provider is disconnected or its code removed while the reader still has the native right to read project-owned imported knowledge. C2 preserves permitted knowledge/history and readable evidence context.

**B — revoke the governing read right.** The relevant source/project/data grant is withdrawn. C2 denies that protected scope and its derivatives, even when bytes remain retained or a native renderer is available.

These are conceptual contract checks. Neither was executed against an application. A valid independent native historical right is assessed at its own policy boundary; merely labeling a document “history” cannot grant it.

## Current-source reconciliation

I compared relevant source at both commits rather than treating the incoming development merge as covered automatically.

The full LegacyService file differs between f92c3341 and d440c48e. The relevant function slices are nevertheless byte-identical:

| Function at d440c48e | Relevant current evidence |
| --- | --- |
| getKnowledgeDocument, beginning at line 12475 | Same native project-access check and KB document read as the C1 evidence. |
| integrationDisconnect, beginning at line 14931 | Same credential clearing, mapping disabling and deliberate preservation of imported knowledge. |
| connectIntegration, lines 14779–14930 | Same account-replacing upsert behavior as the earlier source pin. |

The complete ProjectIntegrationMapping.tsx file, integration-sync client/types/service/processor files, and migrations V47, V72 and V97 have identical Git blobs at both commits. Thus the narrow existing owner/consumer observations used here remain applicable to the integrated source. This is **not** a reconciliation of every incoming application change.

For the adjacent identity change, I read V97_integration_connections_soft_disconnect.sql and the f92 connection writer branches. V97 preserves the connection row on disconnect; Jira, Notion and Linear upserts can replace external_id under the existing organization/provider conflict key. C2 therefore correctly requires sequential account replacement to be qualified even with one active connection, while preserving legitimate same-account credential renewal. Its separate simultaneous-account gate does not mandate that feature.

For the adjacent stop/fence clarification, I directly read markRunning at f92 lines 194–201: it updates by run ID without a terminal-state predicate. The processor source inspected in C1 remains byte-identical at d440c48e and its selected ticket write path does not establish the required original-generation commit fence. C2 now keeps that implementation proof gap explicit and adds a paused-worker/changed-basis/same-generation control in canonical 05. It does not claim that this documentation fixed the worker or that a production defect was reproduced. This is consistent with my original source limits and does not reopen PLUG-BB01.

## Other changed consumers

The incoming AGENTS/CLAUDE additions reinforce identity, effect-boundary authority, truthful recovery and discriminating negative controls. Within this delta, they do not grant plugin powers, require a second owner, authorize product execution or contradict the retained-read distinction. I did not conduct a new cross-application efficacy/admission review of those incoming rules.

The subordinate Skills header now points to the current source manifest and proposed v1.4.49 backlog status while retaining its subordinate ownership and historical review limits. It no longer presents the old 1.4.46 candidate as current.

The manifest distinguishes the earlier reviewed-source pin from d440c48e integration. The research continuation labels its publication history separately. I did not independently inspect live PR state or certify the external merge/publication narrative in this focused recheck.

## Verification and limits

Executed checks: 15 artifact identity checks, seven exact diff comparisons, six unchanged-canonical comparisons, selected Git-blob/function comparisons, and read-only source inspection. The original report's hash matched its frozen value before this follow-up; preservation is checked again at handoff.

**Not executed:** application tests, package installation, database/API/native writes, UI rendering, Graph harness, runtime effect-fence reproduction, retained-data permission scenarios, or method-effectiveness trials. Native Tesbo synchronization remains unperformed. No candidate, repository or original report was edited.

**Scoped C2 member disposition:** accept the PLUG-BB01 documentation correction; no new material finding in the reviewed delta. Keep runtime/migration/security/UI/native acceptance and the explicitly documented sync-fence gate open under their existing owners.

