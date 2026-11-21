# Graph Assurance — final manual closeout v16

**Run:** GEX-ASER-2026-11-19. **Reviewer:** `/root/graph_final`, informed analytical reconciler, 20 November 2026 UTC.

**Conclusion:** The inspected final documentation integration is supported within its declared scope. I found no additional material ownership conflict or contract correction in that delta. **Full-assurance and architecture-freeze clearance are not supported by this evidence.** This completes a manual reconciliation; it supplies neither a calculated Graph status nor a White decision.

## 1. Exact target, method and evidence

Workspace root: `/workspace/scratch/ce8c3109f396`. `R` denotes its `assurance-run-20261119/` directory. C00–C07 mean the eight numbered files in `R/input-v16/canonical/`; the six `R/input-v16/views/` files are subordinate. The exact target is **1.4.36-candidate-v16**, not an application build.

| Binding | SHA-256 |
| --- | --- |
| `R/input-v16/manifest.json` | `9dba403c3bb129ce5a5fcab4064a6afccdc669e588ba983e124680bbcf4e7062` |
| Published 1.4.35 predecessor ZIP | `e415fdb18b327d8ad8522f53cadd1582a524abbcc82a099018af9fcb1d96e48a` |
| `deliverables/Tesbo_Specifications_v1.4.36.zip` | `406d5da0eb7f4d4a6fc062407f2d3affa7ec540d2e8572678e457f8847a7de33` |

The delegated read-only identity audit matched all **14** manifest members, exactly **8 canonical + 6 subordinate**, and the ZIP's eight canonical members byte-for-byte, with valid CRC. Published35 bodies survive with revision-header and trailing separator-whitespace changes; this is not literal whole-prefix byte equality. `R/verification/canonical-persistence.json` records successful replacement of the same canonical item. That remote outcome is attributed to its receipt, not independently queried here.

I read unchanged `steering/teams/review-orchestration.md` and `specs/graph-assurance/{requirements,design,tasks}.md` under `assurance-source-recovery/Nesberry-d83549c85a4dcd047fb40dc4fba4ec62737ab0fc/.kiro/`. The retained manual ownership, semantic-consequence, completeness and proof review applies. The proposed harness remains **unbuilt**: no `--graph`, generated status, Graph CI gate or new specialist charter was invoked. Proposed automation and draft release machinery do not replace required manual gates; Elephant/Gold remains advisory.

Actual receipt inputs in `assurance-run-20261119/receipts/` were Blue A/B v1 and v12; Red A/B v1 and v12; `white-pre-v1.md`; Grey inventory/verdict/crosswalk v1; QA v3 and `qa-grey-informed-v3.md`; Green A v2/B v3; Purple v4; Security v1/v14; Elephant/Gold v1; and the actual **v16 informed receipts for both Blue, Red and Green members, QA, Grey, Purple, Security and Elephant/Gold**. I inspected current clauses across all fourteen primary files, retained contracts/proof allocations, `R/verification/green-b-informed-v16.json`, `R/verify-spec-package-v4.py`, `R/verification/delivery-source-advance.json`, and C05's final publication checkpoint. Historical bodies were targeted reads, not an exhaustive line audit.

Read-only `git show` at **6897f989b055a955280f810c7daace86f74057fa**, using `/workspace/scratch/307cd95373fe/tesbo`, reconfirmed material paths in backend `model-studio-repository.ts`, `database.service.ts`, `legacy.service.ts`, `project-source-binding.management.ts`, `qa-review-candidates.ts`, and frontend Requirements/Model Studio pages and `ModelStudioAuthoring.tsx`. No application, database, browser or extracted helper was executed by this closeout.

## 2. Owned semantic trace

This is the inspected material trace, not a complete repository reader/writer census. C03's convergence tables, C04's ASER-C01–06 and C05's named proof allocations preserve the following boundaries.

| Truth and native owner | Requirement → contract → proof obligation |
| --- | --- |
| Source binding/capture/history | FR-115/116, T-455/456 retain source generation, cursor, extractor and capture provenance separately from index publication. Source entitlement is distinct from destination ownership. GEX-AC-05, ASE-INT-07/FLOW-28 and GA-AC-05 require denied/allowed capture and fenced recovery. |
| Expected behavior and mappings | FR-117 belongs to the existing Model Studio family/revision owner; physical `mbt_models` identity is preserved without duplicate logical-alias tables. MBT-C-02/C-12 require an independently selected approved CURRENT pointer; approval/draft/HISTORICAL and T-422 assignment remain distinct. MBT-AC-28/41 and mapping-history MBT-AC-43 supply discriminating obligations. |
| Approved obligations and typed relationships | Requirements/Policy and FR-118/T-426 retain exact authority, applicability, direction, endpoint revisions and decision provenance; manual guidance and inference do not become approved expectations. ASER-C02 and GEX-AC-01/07, GA-AC-02 require union of applicable obligations, reviewed equivalence, visible conflicts and truthful incomplete denominators. |
| Selected publication and native Runs | Existing proposal/Cases/Runs owners, ASER-C03/04: a protected operation commits required native effect, provenance, audit and commitment together. MBT-AC-45 and ASE-INT-04/05/11 retain fault/replay checks. MBT-AC-37 also preserves separately authorized preparation/PARTIAL stages; viewing/staging creates no Run. |
| Attempts, impacts and Reports | FR-119/121–124 keep actual observations, accepted oracles, Bug relations and distinct impact dispositions independent. Reports is a projection. GA-AC-01–05 require occurrence-grain counts, cohort/stage pins, sufficient FAIL evidence without implied PASS, and PASS without automatic impact closure. Repeated paths never merge impact identities. |
| Governed methods and feedback | T-422 retains the existing KB/version owner; effective assignment/resolution and governed evaluation remain specified, unproved capabilities. C03/C04 retain actual principal, exact composition and immutable correction history; C06 remains candidate guidance. Existing SK-E2E families/GEX-AC-08 own proofs. Imports stay inert; no parallel graph, oracle, approval or experiment store earns admission here. |

Current clauses also retain deterministic critical→unknown→noncritical ordering, authorized-visible snapshots separate from internal indexes, authority expiry invalidation without recapture, bounded no-progress recovery, and useful deterministic results during AI-only loss. No-impact requires a justified assessed frontier. These assertions have named proof obligations, **not demonstrated enforcement**.

## 3. Findings, corrections and unresolved proof

Original severities and scopes remain intact: BA01 Must-Fix versus BA02/BB-B01 Should-Fix; Red A's Major case **and Run** transaction siblings versus Red B's narrower case emphasis; Grey's five Major candidates; QA's context/retrieval findings; Green's occurrence-count/history concerns; and Security's HIGH authority/source-entitlement findings. A universally shared source registry is an explicit accountable alternative, not an assumed deployment fact. Historical UI source does not establish cross-model persistence or an observed production incident.

The documentation now allocates source-to-target selection, real principal, staging, atomicity, mapping history, unavailable-versus-empty, result-preserving Bug association and immutable feedback work to native owners. EG's canonical/subordinate authority-label nit is corrected. QA independently confirmed Grey's five candidates at bounded G1. These are document corrections and additional analytical evidence, not source repairs or retroactive rewrites of originals.

The inspected source remains **6897**. `R/verification/delivery-source-advance.json` and C05 attribute external PR168's documentation merge to **f43013473b3a8b725bb547187e21b4459d0e8838** and PR167/delivery parent to **1fe100588be6c3a1627ee39a4b0bbc1c0d9da2ea**. Later implementation and separate-checkout claims retain their own provenance. Historical findings neither automatically apply to changed code nor close by merge. This receipt does not recertify that implementation, its linked closure record, final-delivery CI or deployment.

At closeout entry, Blue/Red signatures stopped at v12 despite substantive later clauses. I reported that final-target gap. The subsequently supplied and actually read **four separate v16 deltas** address it. They do not supply missing code-author/deployer participation. Root is the actual documentation maintainer. All analytical reviewers share a model family; no human or cross-model independence is claimed.

No additional contradictory ownership edge was established in the reviewed clauses. Material **proof edges remain absent or incomplete**: complete affected-consumer wiring, current-source enforcement, real authority/entitlement, native fault/race/revocation recovery, authentic UI/accessibility, original delegated QA-loop and method efficacy. Proposed capabilities remain proposed. These gaps prevent an unqualified clean-graph/full-coverage conclusion.

## 4. Counts and execution boundaries

**125 ASER definitions** comprise 15 ASE-E2E, 54 ASE-FLOW, 40 SK-E2E and 16 ASE-INT. **Eight GEX-AC obligations** are separate. **Five GA-AC checks** now occupy **ten physical rows**, because v35 extends the five v33 checks; the four v32 prose summaries are superseded. SEM/DISC/SK aliases add fixtures, not canonical IDs or execution credit. These are definitions, not executed results.

Green B actually executed verifier-v4 on v16: **58 checks passed, exit 0, empty stderr**. The JSON digest is `03b029d69d2e6a23a75a282fa20921c6e14af2f95b417a1f69c3c9edef336187`; verifier digest is `01cd82984869ed57f2301dfc12f30f952d84f5d65de5742709decb2c5b02b041`. I read both. Checks establish bounded identity/preservation/set accounting; set-based IDs hide duplicates, fragment/external links are skipped, and this run has zero local-link check rows. Source checking establishes Git-object availability only. Root's retained v13 link failure and v14 exact-commit URL correction do not certify external content. Semantic completeness, view parity, runtime, UI and efficacy are outside this verifier.

Grey's original **50 jobs** are **37 G0/13 G1**, with **36 HOLDS/5 FAILS/9 INCONCLUSIVE**, not runtime journeys. Seven personas are not seven reviewers. CW-O1 remains incomplete; CW-O2 gained partial source tracing at the actual daily-user-metrics/Basecamp owner, not a fabricated project scheduler or outbound execution. QA's five isolated helper controls, Blue B's pure-function probe and Green B's source-equivalent SQLite join probe retain narrower identities; none is an executed native E2E journey.

## 5. Method qualification and retained gates

I read the frozen `method-transfer/RESULT.md`, both methods, two synthetic briefs, actual planner outputs and adjudication in `tesbo-docs/docs/specs/agent-synchronized-engineering/reviews/2026-11-19-gex-rerun/`. Both arms met the fiction-scene and rehearsal-cover briefs. Their differences demonstrate **no decisive superiority**, product efficacy or framework-wide transfer. The later candidate changed and remains unqualified by that trial; the incoming portability assessment is separate. No installation or activation follows. The v1–v16 author ledger is attributed amendment history; the editable current-review summary was not used as evidence.

Original **`white-pre-v1.md`: BLOCKED — MORE ARCHAEOLOGY** remains unchanged. W-D participation, W-S complete source/consumer fit, W-A actual authority, W-R runtime/operations, W-U authentic UI, W-M method promotion and W-C completeness/later closure retain their outstanding obligations. The later QA confirmation and this manual Graph receipt supply their own bounded evidence without completing those broader gates or recreating the original chronology. Missing proof is not N/A, an advisory waiver or a pass.

**Signed:** `/root/graph_final`. Final manual receipt, frozen on placement. No primary input, source, original method or earlier receipt was modified.
