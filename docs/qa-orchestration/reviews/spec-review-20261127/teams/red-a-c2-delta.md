# Red A — informed C1 to C2 delta verification

**Date:** 27 November 2026. **Reviewer:** `/root/red_a`. **Target:** Tesbo 1.4.49 C2. **Mode:** focused read-only source/document recheck; no runtime tests. This is an informed continuation by the original C1 reviewer, not fresh discovery, a formal Red team verdict, architecture freeze or human approval.

## Disposition

**No material new contradiction identified within this delta scope.** C2 may retain the **Proposed / Backlog / NOT FROZEN** disposition. TESBO-RA02 is addressed at the document level. TESBO-RA01 remains an **open source-based implementation gate**: C2 records it accurately and supplies discriminating future proof, but does not fix or execute it. No new platform/runtime, first plugin, Skill activation, permission power or implementation priority is approved.

## Identity and preservation

- C2 root: `/workspace/scratch/e50b253d95e4/review-candidate-v149-c2/`.
- C2 `INPUTS.json` SHA-256, independently recalculated: `c722c8e75521a495a1560f562324bfc27ad2b2e8e318f0d4986b80a18b1a760c`.
- All **15** manifest artifact byte counts and SHA-256 values matched.
- C1 manifest remains `dd8fa57f48ebcfe054dc98c69215539ea669ac932136291a622f5fe123233bfb`.
- Original report `/workspace/scratch/e50b253d95e4/team-reviews/red-a.md` was not changed. Its recalculated SHA-256 remains `9db9063596f4baef19b0b08061e22d93819462b657cf9ad8b228fe529f0f27fa`.
- Earlier source findings retain `f92c3341eadc03f274becbead3b0f45d0a86539e`; incoming development is separately identified as `d440c48ede32ca38783b178ea6d957ded8bca9e4`.
- Methods remain the previously read, verified and unchanged Red charter v2.6, orchestration and portability policy from `NesberryEnterprise/Nesberry@d83549c85a4dcd047fb40dc4fba4ec62737ab0fc`. No role, quorum or evidence obligation was altered for this recheck.

C2's authored changes explicitly name earlier findings; I was exposed to those and to my own C1 conclusions. I did not read another member's report. External PR publication status is supplied run context, not a fresh remote-status audit by this member.

## Exact inspected scope

I read C2 RUN_CONTEXT and INPUTS; complete C1→C2 semantic deltas for canonical 03/05, subordinate Skills governance, AGENTS, CLAUDE, source manifest and supporting plugin research; and the resulting canonical 03 identity/lifecycle/retained-data paragraphs plus canonical 05 scenario rows. The other six canonical diff files are empty and their manifest identities remain unchanged from C1. I did not reopen the entire historical package.

Using immutable Git objects, I compared selected current owners between `f92c3341…` and `d440c48…`: the integration-sync directory, V47/V72/V97 connection migrations, RAG retrieval, Skills resolver, LegacyService and MCP access. The sync files, named migrations, RAG retrieval and Skills resolver have no diff. I read the complete LegacyService and MCP-access diffs; current `markRunning`, `integrationDisconnect`, knowledge-document/history read methods and the relevant RAG query were also read. Incoming changed-file names were inspected to bound the audit; OAuth transport internals, all frontend changes and the whole incoming development tree were not audited.

I inspected the document verifier's source and compared the scanner-binding file against incoming development. The scanner delta changes explanatory comments and the two exact canonical-document digests, preserving the inspected exception fragments and control logic. I did **not** run the declared document verifier, Docker/Gitleaks or any product check; Green's declared verifier receipt remains its own evidence. The independent 15-file identity check here is only byte integrity. Initially truncated scanner output was not treated as a full scanner review; the exact incoming-development delta supplied the bounded comparison.

## Finding dispositions and contradiction checks

| Item | Evidence and counterevidence | C2 disposition |
| --- | --- | --- |
| **TESBO-RA01: sync effect fencing** | Canonical 03 now states the terminal-state/generation gap and retains the legitimate disconnect controls: credentials are cleared and mappings disabled. Canonical 05 calls for pausing at the awaited boundary, changing/disconnecting the basis, resuming, and observing no forbidden write or stale reopening, paired with legitimate same-generation completion. The relevant sync code is unchanged at the incoming parent; current `markRunning` still updates by run ID without a terminal-state predicate. Current disconnect still retains imported knowledge. | **OPEN**, Major for affected implementation/reuse acceptance. Documentation routing is addressed; no runtime closure. The original counterevidence and lack of deployed reproduction are preserved. |
| **TESBO-RA02: subordinate current pointer** | The opening Skills governance paragraph now links the current source manifest, states proposed 1.4.49 BACKLOG / NOT FROZEN, and points to this review's applicable limits. Older body/history remains explicitly historical and subordinate. | **ADDRESSED for C2 documentation.** No active Skill or runtime verification follows. |
| **Sequential source replacement** | Canonical 03 distinguishes source identity from the stable connection UUID and separates sequential A→B replacement from simultaneous-account cardinality. Canonical 05 tests delayed A work with a colliding external ID and explicitly compares legitimate same-account credential renewal. V97, the unchanged callback upsert semantics and current disconnect behavior support the need for the temporal distinction. | Adequate scoped clarification. It does not require every credential refresh to become a new source, grant multiple-account authority or authorize a migration now. |
| **Retained-data reads after disconnect** | Canonical 03 now ties denial to the applicable reader's revoked authority, while preserving separately authorized project knowledge/history after disconnect or code removal. It also refuses to let retained bytes override an actual revoked grant. A new source-specific retained-data ACL needs its own owner, migration and consumer sweep. Current `getKnowledgeDocument`/history require project access and resolve the document by project/ID; the inspected RAG query is project/document scoped. Current disconnect deliberately leaves imported knowledge present. | No contradiction found with inspected existing ownership. The new test pair distinguishes disconnect from actual read revocation. This is not proof of every reader/export/cache enforcing a future source-specific ACL. |
| **Incoming development and method language** | AGENTS/CLAUDE additions distinguish authoritative identity, pre-action admission, later reporting, negative controls and preserved attempt history. They are consistent with C2's effects/authority distinctions. Incoming MCP access keeps API-token and OAuth-client identities distinct and rejects OAuth write pre-approval; it does not turn connection or installation into write consent. Incoming handoff/readback changes retain native owners and exact reviewed basis. | No material new contradiction identified in inspected additions. This is not acceptance of the entire OAuth implementation, automation handoff or incoming UI behavior. |

### Retained boundary questions

For RA01, a failed-run label or cleared current credential cannot by itself establish the behavior of an already running worker. Conversely, a source trace is not proof that a particular deployed schedule exercised that path. C2 preserves both limits and keeps the necessary owner investigation open.

For temporal identity, a stable local row may outlive its original remote account. The invariant is continuity of the actual source and authority basis, not automatic churn on every token refresh. C2's positive renewal control prevents the broader rule from disabling legitimate continuity.

For retention, stopping future capture and revoking a right to read existing knowledge are separate decisions. C2 preserves current native authority and requires a separate convergence plan if a future profile introduces finer permissions. It neither silently deletes lawful history nor allows a retained copy to bypass an actual read denial.

## Verification limits and handoff

Actual checks were read-only file/hash checks, immutable Git diffs/selected source reads and manual semantic comparison. No database, native Tesbo call, application test, runtime reproduction, installation, deployment, UI capture, scanner run or Graph execution occurred. **Tesbo sync not performed. Runtime/UI/human acceptance remains NOT RUN; authentic visual baseline remains unavailable.** This continuation provides no new method-efficacy or generality evidence and does not relabel C1 reviews as C2.

The original Red A disposition remains valid with the document-level closure above. Preserve RA01 in the existing sync owner's work and require its legitimate and adversarial boundary proof before relying on the proposed guarantee. The remaining independent member/team and White dispositions retain their own authority and quorum.
