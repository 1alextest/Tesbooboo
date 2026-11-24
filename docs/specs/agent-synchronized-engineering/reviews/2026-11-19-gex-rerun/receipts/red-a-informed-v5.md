# Red A — informed final-target v5 delta

**Run:** GEX-ASER-2026-11-19. **Reviewer:** /root/red_member_a. **Date:** 2026-11-20 UTC.  
**Target:** 1.4.29-candidate-v5; input-v5 manifest SHA-256 78583a79ce4f3d12a1d6e5bea39e36838c5d3ded828edb783cb0949253aa4bc6.  
**Member disposition:** The original documentation omissions are adequately addressed for the two findings within this bounded delta. Both original Major source/runtime findings remain OPEN. No formal Red or White gate is cleared.

## Evidence and informed status

I read my unchanged red-a-v1.md, red-b-v1.md and the actual white-pre-v1.md. Their source conclusions informed this review; this is not another cold discovery. Original Red A remains SHA-256 3b4ef853857beea9b1ba6b690230a9e678b4a694c4481fe6afe76daf25ce4d5a.

I compared all primary v1→v5 changes and the six subordinate views, verified all fourteen target files against the manifest, and re-read the directly implicated Git-object paths. Application source remains 1alextest/Tesbooboo@6897f989b055a955280f810c7daace86f74057fa, from /workspace/scratch/307cd95373fe/tesbo. No later branch or mutable worktree supplied evidence.

The previously read Red v2.6 charter and active orchestration remain unchanged at Nesberry d83549c85a4dcd047fb40dc4fba4ec62737ab0fc. Their hashes still match 4f9893d877d89b31b6e2c0c1d42b89b4136f3da4c8ea079b9fd40024cffb02cd and 8fd41f22e1909afd48d8af95120d03a0f52e30a1bf9976a639fb6cca67bb4729. Canonical 06 remains byte-identical candidate guidance, not replacement authority.

Checks were hashing, document diffs, source inspection and G1 counterexamples. No application, database, browser or runtime tests were run; unchanged optional probes were not repeated. C03/C05 below identify the corresponding canonical files in input-v5.

## Findings and documentation disposition

| Preserved finding | v5 correction and proof allocation | What remains open |
|---|---|---|
| GEX-RA-R01 — Major, Failure / Spec-Code-Drift: generated case/provenance split | C03:1623 identifies direct native Draft creation and separate transactions; requires unpublished AI staging and actual shared protected commit. C05:1788 assigns insertion-fault, exact/concurrent retry and legitimate human-Draft checks. | Source implementation, real transaction faults, all affected writers and cache/index consumers. |
| GEX-RA-R01 — same finding, native Run sibling | C03:1624 separately names native Run creation before manifest and fallible compensation. C05:1789 requires manifest/audit fault, lost-response readback and stable identity proof. | Run/manifest atomicity and authoritative uncertainty recovery; correcting only case generation cannot close R01. |
| GEX-RA-R02 — Major, Invariant / Spec-Code-Drift | C03:1621/1632 separates newest authoring head from family-owned active approved selection across readers. C05:1787 assigns draft/approval nonactivation, competing CAS, rollback and historical checks. | Actual selected-pointer implementation, legacy decisions and UI/REST/MCP/job/coverage compatibility. |

These additions do more than repeat “reuse safely.” They name the concrete native owner, present behavior, required transition, historical treatment and discriminating proof. The views mirror that allocation; the README now avoids implying that existing approval substrate already establishes universal human governance.

The source mechanisms remain unchanged. In Tesbo-Backend-Nest/src/behavior-graph/model-studio-repository.ts, case conversion calls legacy.createTestCase at :402 inside the outer transaction, then records the mapping at :404. The native insert opens its own transaction at src/legacy/legacy.service.ts:5313; src/database/database.service.ts:76 obtains a separate pool client. An outer failure cannot roll back the committed case. Native run creation at model-studio-repository.ts:651 similarly precedes manifest insertion at :684, with cleanup errors swallowed at :702. These are source-supported failure mechanisms, not reproduced incidents.

Dispatch still selects maximum revision_number at :546. The source tests also retain latest-head blocking, including e2e/api/model-studio.spec.ts:680. V5 correctly requires deliberate test reconciliation against the retained target contract; a passing test of current behavior cannot establish C12 compliance. I have not run those tests.

## Atomicity, legitimate alternatives and legacy truth

C03:1634 and C05:1800 resolve the important operation-grain distinction. Separately authorized native creation, attachment and mapping may retain committed stages and report PARTIAL, as MBT-AC-37 already permits. They must preserve their receipts and uncertainty. A single protected dispatch/publication, however, must commit its required effect, provenance, commitment and audit together. Compensation or a durable partial-stage receipt cannot make that stipulated atomic operation atomic.

This also bounds my original receipt's “recoverable journal state” alternative: it applies only where the final contract legitimately permits staging or distinct operations. It is not a waiver of protected atomic publication. The original wording and severity remain preserved; this is the explicit informed interpretation.

V5 handles legacy truth appropriately: retain model/case/run identities and original attempts; do not relabel native Drafts as unpublished candidates; do not fabricate missing activation, scope, principal or reviewed revisions. Unknown selection remains unselected until a present attributable decision (C03:1621/1636). That may restrict availability during migration, so the implementing owner must demonstrate compatibility and recovery rather than infer historical intent from the latest row.

The reuse/composition premise survives. A transaction-aware native extension and one family-owned selection remain smaller than a second ledger or applicability service. Ordinary human Draft creation, source-free manual QA and independently authorized staged work remain conforming alternatives. Choosing latest-head-only behavior instead would still require an explicit canonical owner decision, not this review.

## Scope and gate limits

The new source-entitlement, feedback, mapping, UI-context and occurrence-count rows are material neighboring admissions. I read their changed contracts; this focused delta does not independently certify every mechanism, consumer or other reviewer's probe. They remain separately allocated and unexecuted. No new finding is asserted from mere proximity.

White's actual pre-gate is BLOCKED — MORE ARCHAEOLOGY. The clarified transition/proof plan addresses the documentation portion of W-S; it does not supply its full consumer census, actual authority, execution evidence or predecessor participation. Blue/Red still lack actual code-author/deployer grounding. Root is the document author/integrator, not that participant. Two analytical reviews do not erase that requirement.

Authentic UI evidence remains NOT CAPTURED / VISUAL-BASELINE BLOCKED. Runtime, user comprehension, complete manual/delegated QA execution and method efficacy remain unproved. Candidate 06 is unchanged and unvalidated for improved discovery. I recommend retaining both Major findings as Open implementation prerequisites while accepting these scoped documentation corrections for subsequent reconciliation. This receipt supplies no formal team verdict, architectural freeze, Skill activation, implementation permission or human operational authority.

**Signed:** /root/red_member_a — informed v5 delta. Preserve this receipt separately from the frozen originals.
