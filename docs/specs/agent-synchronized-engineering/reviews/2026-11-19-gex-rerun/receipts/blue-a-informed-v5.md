# Blue Team member A — informed v5 delta

## Identity and recommendation

**Run:** GEX-ASER-2026-11-19. **Target:** `1.4.29-candidate-v5`, `/workspace/scratch/ce8c3109f396/assurance-run-20261119/input-v5`. **Manifest SHA-256:** `78583a79ce4f3d12a1d6e5bea39e36838c5d3ded828edb783cb0949253aa4bc6`. Its fourteen file hashes identify the reviewed bytes; its predecessor-archive hash does not identify a newly built v5 archive. The subordinate-view base is `7a80a3fb832902b135cc5fbc965e142bf6db9fa3`; the manifest explicitly pins the proposed working document bytes separately.

**Application:** `1alextest/Tesbooboo@6897f989b055a955280f810c7daace86f74057fa`, Git objects at `/workspace/scratch/307cd95373fe/tesbo`. **Method:** unchanged Blue charter v2.7 and orchestration at `NesberryEnterprise/Nesberry@d83549c85a4dcd047fb40dc4fba4ec62737ab0fc`; their verified hashes remain respectively `1d6d78da69b3c55533740005a48082b6fc5f27c620ce66f50917fd180523c816` and `8fd41f22e1909afd48d8af95120d03a0f52e30a1bf9976a639fb6cca67bb4729`.

**Recommendation: EXTEND EXISTING SUBSTRATE / COMPOSE.** V5 adequately corrects the reviewed documentation omissions and supports continued bounded design preparation and review. It does **not** close source mismatches, authorize architecture freeze, establish implemented governance or provide runtime approval. I found no additional document-level Must-Fix within this delta's scope.

This is an **INFORMED** analytical member receipt, signed `/root/blue_member_a`, 20 November 2026 UTC. It uses both original Blue receipts and White's original pre-gate receipt; it is not another cold discovery result or an independent team vote.

## Actual evidence and checks

I read `blue-a-v1.md`, `blue-b-v1.md`, `white-pre-v1.md`, v5 RUN-CONTEXT/manifest, every changed primary v1→v5 hunk, retained MBT-C-12 and MBT-AC-37, and the changed subordinate material. Python verified the supplied manifest digest and **14/14** member sizes/hashes. Unified-diff inspection confirmed canonical 06 and `AGENT_RULE_TEMPLATE.md` unchanged. The complete added source-convergence section in `views/design.md` equals canonical 03's section; the proof-allocation section in `views/implementation-plan.md` equals canonical 05's section. Other view additions retain their subordinate status and qualify current maturity.

Read-only Git-object checks reconfirmed the commit and selected affected operations: Model Studio save/approval, conversion, dispatch, links and coverage; database transaction acquisition; native case/feedback regeneration; source-binding reader/management; Model Studio page and mapping picker; and the two newly named conflicting test assertions. Original Blue source ledgers remain the disclosed baseline for unchanged neighboring mechanisms; this was not a new whole-product audit. No application, database, browser, queue, load or shared-infrastructure tests ran. I did not rerun or adopt another reviewer's isolated probe as my execution evidence.

Source locators below are relative to the exact commit. `M` means `Tesbo-Backend-Nest/src/behavior-graph/model-studio-repository.ts`; `L` means `Tesbo-Backend-Nest/src/legacy/legacy.service.ts`. Canonical numbers refer to this manifest's files.

## Changed obligations and preserved consumers

**Applicability and legacy state.** Canonical 03 now explicitly maps `mbt_models`/revisions to the singular FR-117 logical owner, preserves IDs, separates authoring head from CURRENT selection, and requires CAS activation. Saving or approving r2 leaves active r1 usable. Unknown historic scope/selection stays unselected/UNKNOWN pending an attributable present decision; older approval flags cannot certify missing assent. UI, REST/MCP, generation, dispatch, mappings/coverage and delayed jobs must use the same selection. Incompatible old clients receive a truthful conflict/unsupported result. These directly answer BA01's missing transition allocation while retaining MBT-C-12's scope restrictions. The source still selects the latest revision in dispatch and coverage (`M:546`, `M:863`); no migration has occurred.

**Publication, transactions and history.** Canonical 03/05 distinguish unpublished graph/AI proposals from legitimate native human Draft creation. They allocate protected case/run effects and mandatory provenance, commitment and audit to the actual native transaction, preserving IDs and uncertain historical records. The source still calls separately committing case creation inside model work and records the run manifest after native creation (`M:402`, `M:651`, `M:684`; database service `transaction`; `L:5192`). The existing client-aware case insertion seam remains reusable. Exact mapping decisions/removal history extend the current link owner; optional pins/deletion remain source facts (`M:473`, `M:499`). V5 also explicitly preserves MBT-AC-37's separately authorized PARTIAL stages, avoiding a contradictory demand for a fictitious transaction across independent operations.

**Feedback and input integrity.** Canonical 03/05 and the skills view now name native matching, technique/citation and feedback seams. Correction capture is independent of optional regeneration; immutable compared iterations, their bases and rejected/no-change trials survive. Failed matching remains uncertainty. This answers BA02 without treating current key-gated feedback or overwritten `generated_payload` as sufficient (`L:20189`, `L:20400`). Requirements lookup and Bug/result repairs remain assigned to their native owners. Source-free manual testing and the case-free external task/report/retest/human-apply loop remain mandatory independent exits.

**Added consumers.** Source entitlement is separated from destination ownership, with accountable intentionally shared-source policy retained as a legitimate alternative. The inspected binding manager/reader enforce project access plus a global approved checkout; deployed policy remains unknown. Model Studio request-context and picker failure clauses fit the actual unfenced `generateProposals` state and `loadCases` catch-to-empty behavior. Evidence-grain clauses fit `coverageForUser`'s link join and `COUNT(*)` (`M:937`); two mappings cannot legitimately manufacture two observations. Distinct retries and historical/deleted scope still require explicit implementation proof. These clauses extend existing owners rather than create another registry or evidence store.

## Disposition table

| Item | Original classification retained | V5 documentation disposition | Source/runtime disposition |
| --- | --- | --- | --- |
| GEX-ASER-BA01 | Must-Fix before affected Model Studio freeze/admission | **Addressed:** explicit identity, applicability, migration, legacy/client treatment and MBT-AC-28/41 proof allocation | **OPEN:** latest-head source remains; real migration/CAS/consumer proof absent |
| GEX-ASER-BA02 | Should-Fix | **Addressed:** concrete native reuse, regeneration-independent correction, immutable comparison and truthful matching status | **OPEN:** target capture/history/evaluation not demonstrated |
| GEX-ASER-BB-B01 | Blue B's broader Should-Fix; not rerated | **Addressed within this member's read:** principal, staging, transaction, selection and link transitions; README maturity corrected | **OPEN:** this assessment does not replace B's own informed disposition or prove convergence |
| White W-S | Explicit native transition/consumer reconciliation required | Allocation materially improved for both case and run siblings, mapping history and legacy unknowns | Every material entrance/reader and real native-boundary proof remain required |
| Added entitlement, UI-context and evidence-grain obligations | No new severity assigned here | Coherent owner-bound clauses and discriminating positive/negative fixtures | Policy, delayed UI behavior, PostgreSQL/API projections and learning effects unverified |
| Existing native tests | Historical evidence preserved | Correctly identifies assertions requiring deliberate reconciliation against retained contracts | No test executed or assertion changed; old passes cannot prove new behavior |
| Formal pre-gate/participation | White's original formal advancement block retained | No documentary correction manufactures participation or sequence | Code-author/deployer grounding still absent; root is document author/integrator, not that participant |

## Remaining boundaries and freeze

Canonical 05 correctly labels allocations as definitions, not executed closure. I confirmed the existing model API test requires older approved revision dispatch to fail after a save (`e2e/api/model-studio.spec.ts:663`) and the Bug unit test retains manual auto-failure (`Tesbo-Backend-Nest/src/legacy/bug-link-finalization.spec.ts:36`). Implementers must revise those assertions against independently accepted contracts while preserving valid neighbors; an unchanged family ID supplies no new coverage.

Full native/UI/REST/MCP-alias/AI/import/job/reader convergence, actual authority and P-07/P-18 enforcement, safe migration/rollback, fault/retry/concurrency evidence, approved numeric limits, manual and original delegated journeys, authentic UI/accessibility, and method efficacy remain open. Grey omissions and specialist/Graph/White dependencies are not closed by this member. UI remains **SOURCE-INSPECTED / VISUAL-BASELINE BLOCKED**. Capability maturity is not upgraded to BUILT+LIVE; no new primitive or Skill activation is admitted.

The remaining physical schema, authority-policy, legacy inventory and runtime details are explicit implementation admissions, not silently resolved design facts. This bounded review finds the changed allocation adequate to proceed with that work, subject to the unchanged formal gates.

**Frozen informed delta.** The original `blue-a-v1.md` remains unchanged, SHA-256 `b2e9b6d971f6b6ed17543df24c2207d8bbfc6ad7dbd0249590c2866b0925b187`. Original severity differences and evidence limits remain intact. No input, application source, remote state or Skill was changed. Later reconciliation must be separately recorded.
