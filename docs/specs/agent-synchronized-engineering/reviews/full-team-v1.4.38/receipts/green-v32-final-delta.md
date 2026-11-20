# Green Team report v0.3 — informed v1.4.32 candidate 2 delta

**Receipt:** GREEN-TESBO-1.4.32-C2-INFORMED-DELTA  
**Recorded:** 2026-11-20T06:02:33Z  
**Reviewer:** `/root/green_v32_final`, one analytical Green reviewer  
**Method:** unchanged Green Team Charter v5.8, team README, review-orchestration and the referenced portability policy at `NesberryEnterprise/Nesberry@d83549c85a4dcd047fb40dc4fba4ec62737ab0fc`  
**Stage:** specification/source reconciliation; informed delta after the original independent receipts  
**Disposition:** the two original Green documentation findings are resolved in these candidate bytes, with the narrow correction to the original receipt recorded below. No additional material documentation defect was established in the bounded delta. Existing implementation, authority, runtime, UI and methodology-evaluation admissions remain open. **This is not a formal Green quorum verdict, Graph closeout, White freeze, runtime pass, deployment approval or Skill activation.**

## 1. Exact scope, provenance and independence

This receipt reviews the frozen **v1.4.32 candidate 2**, not a moving latest package. The coordinator subsequently reported newer incoming canonical/view revisions and preparation of v1.4.35. Those reports do not extend this receipt's coverage. Any later candidate requires its own preservation and changed-contract review.

| Input or result | Exact binding |
| --- | --- |
| Candidate | `/workspace/scratch/40f0abd3bdbc/input-v32-candidate2`; eight canonical Markdown files and six subordinate views |
| Candidate manifest SHA-256 | `e531935a62da0cabe61085f9f21696e8c2ab5a2c8a6a6f80fc4cbd68995ad9c0` |
| Candidate RUN-CONTEXT SHA-256 | `553e119b4f0674ba8c542e3b60a4c0b1d3396cf1ab5383dfc29517def66b61fa` |
| Actual saved canonical parent | v1.4.31, Library version 11, archive SHA-256 `ae475b1bada1a5a74089d6ab389e7019f5d6b67d5f1de5358ad0eb014739ef47` |
| Comparison baseline | `/workspace/scratch/40f0abd3bdbc/baseline-latest`; the saved parent's eight canonical files plus six exact `c12b8956bc1f219c6430e205eb1688e7833bd9cf` views; manifest SHA-256 `441fad307dfa4235785aad43fe9d852f9781ef1a3de466460da266f71b9d9db3` |
| Earlier original Green input | local `input-v31-candidate3`, manifest SHA-256 `7af22eba9961a157916cdcca8cd1692ddf6848df4c75342bda00fc8f95bb7804`; **not** the subsequently saved canonical v1.4.31 version 11 |
| Preserved original Green receipt | `receipts/green-v31-original.md`, 44,568 bytes, SHA-256 `e89136894ec30d48e34a1695b636aa343d1cbb5964a8b8ca54412d27580c87c4`, matching its original freeze record |
| Declared v2 verifier | `verification/verify_spec_package_v2.py`, SHA-256 `ba9a2423f04559e14ef65dc53d9f1b5cea7baf032cdd492a3bc5b05459cfcf44` |
| Independent invocation result | `verification/green-v32-final-document-check.json`, SHA-256 `3168d03300d9ed83991271b04d3eed66e21f1502210900d6eff1420cd0280e73` |
| Implementation source inspected | PR167 `419c2efa08b04aff6c7c7d0d56425eb572bd6ec2`, supplied byte-verified `source419` and `source419-frontend` caches |
| Later implementation comparison | Complete supplied trees at `419c2efa…` and `e3d0ebcbe8ec88c5b191abdf2b1d352d44929747`; exactly seven changed blobs and no backend changes |

I read the original charter, orchestration, team README and `POL-GOVERNANCE-ASSURANCE-PORTABILITY/v001.md`; the target run context and verification binding; the original Green receipt and freeze; the saved-parent-to-candidate changes across all fourteen documents and material surrounding contracts; Red's Security cross-review; and the relevant Purple/Elephant original finding sections. I consulted the QA/Red/Grey finding and allocation sections to trace the changed proof obligations. This is disclosed informed exposure. It is neither another cold review nor independent rediscovery of those findings.

Source work was limited to concrete reconciliation risks: the Requirements linked-read implementation; native model selection, generated/explicit mappings, unlink and final-authority helpers; MCP result attribution and V60/V65/V84 schema support; and exact case/model navigation. I read the base `AGENTS.md` and `CLAUDE.md`, confirmed their bytes equal the PR419 copies, and read the frontend instructions. I did not write product code, change candidate documents, modify a repository, access a database, invoke a provider or run the application. Source cache completeness must not be inferred beyond the manifests.

The Green charter's formal two-member quorum and reviewer sign-off are not manufactured by one analytical reviewer running a checker. This receipt supplies a review contribution. It does not certify the prescribed pre-architecture sequence or operational human authority. Graph and White retain their own actual gates, and the specialists retain their evidence responsibilities.

## 2. Verification actually performed

I inspected the v2 verifier before executing the declared binding independently:

```text
python3 verification/verify_spec_package_v2.py \
  --candidate input-v32-candidate2 \
  --baseline baseline-latest \
  --workspace . \
  --output verification/green-v32-final-document-check.json
```

**Observed:** exit 0, **65 bounded document/input checks passed**, zero failed checks. The checks establish the declared file set, revision/status headers, identifier continuity, scoped definition counts, alias allocations, specific canonical/view mirrors, covered relative anchors and input-byte integrity. They do not establish semantic completeness, zero semantic orphans, implementation conformance, real executions, visual parity, actual authority, improved discovery or freeze.

Additional targeted comparisons found:

- All fourteen saved-parent baseline files match their declared bytes/digests. The baseline is the saved v1.4.31/c12b combination, not the earlier local v1.4.31 review candidate.
- The canonical ASER definition-ID sets are equal across that baseline and candidate: **125** distinct definitions — 15 ASE-E2E, 54 ASE-FLOW, 40 SK-E2E and 16 ASE-INT. Strengthening a condition does not add an executed result.
- All **eight GEX-AC supplemental obligation rows are text-identical to the saved canonical parent** and mirrored in the implementation view. They remain a separately identified supplemental set, not another ASER denominator. The four SK-E2E-41–44 and eight GEX-SEM-01–08 labels are mapped aliases/variations; every broadened condition still needs its own actual evidence.
- Canonical 05 retains 48 R-ASE crosswalk rows. A row count is navigation evidence, not a semantic proof; the material chains assessed below are a risk-based sample.
- Each of the five original broken method-link consumers now has one repaired `#1341-portable-method-for-discovery-and-principle-distillation` reference and zero copies of the removed fragment. The verifier resolves the sibling-view anchors and confirms the portable method mirror agrees with canonical 06.
- Both supplied implementation trees declare `truncated: false`. Their seven differing blobs are six E2E fixture/test files and the Run-page execution-status label change. No backend blob differs. The Requirements page has Git blob `e614c478aa81d87831f09fbb5ed081a4828ee4e0` at both pins; the inspected local file matches that blob, is 64,023 bytes and has SHA-256 `43064607ce45a3e38b9c0ac0e4a1587fbd2875061147a31646a5033fb9c8cf5d`.

The tree comparison is local verification of supplied remote inventories, not a fresh deployment observation. Later source revisions reported by the coordinator are outside this receipt. No broad optional test sweep was run.

## 3. Findings and explicit original-receipt correction

### Severity/disposition register

| Item | Disposition at v1.4.32 candidate 2 | Evidence and limit |
| --- | --- | --- |
| GREEN-M01 — missing current Requirements linked-read reconciliation | **Resolved as a documentation/source-fit finding** | Canonical 03 §18.2 now binds the old failure-to-empty statement to base6897. §18.2.1 and its exact design mirror credit the PR419 correction, retain KEEP/verification guidance and leave ticket/summary/provider-status siblings open. No implementation/runtime closure follows. |
| GREEN-L01 — five broken subordinate method anchors | **Resolved as a documentation finding** | All five consumers target the actual heading; the v2 sibling-link check passes. No new method copy or authority was introduced. |
| Factual error in GREEN-M01's original helper description | **Corrected in this informed delta only** | The original sentence about `tcCountFor` returning undefined is false. The source and corrected explanation are below. The original file remains byte-identical. |
| EG-V32-02 — universal activation wording excludes approved historical use | **Documentary correction verified** | The subordinate Skills clause now scopes activated selection to CURRENT normative reliance and explicitly preserves approved inactive historical generation/replay under canonical MBT-C-02. Retired revisions and inactive Skill production use do not gain permission. |
| EG-V32-03 — stale operative Step 0 package version | **Documentary correction verified** | `views/implementation-plan.md` Step 0 item 4 now names v1.4.32 and requires rechecking the implementation head. Historical checkpoint references remain historical. |
| New Critical/High/Medium/Low documentation findings from this delta | **None established in the bounded examined changes** | This is not an absence-of-defects claim for the entire package or product. High-consequence source admissions below remain open. |

### Narrow correction to the original Green receipt

The original GREEN-M01 paragraph says: **“`tcCountFor` returns undefined outside `available`.”** At PR419, `Tesbo-Frontend/app/(app)/projects/[id]/requirements/page.tsx` lines 342–344 instead define:

```typescript
function tcCountFor(req: Requirement): number {
  return linkStateFor(req).counts[req.externalId] || 0;
}
```

The helper returns the stored numeric count or zero without consulting `linkReadState`. **The source correction's protection is in the state-aware consumers.** `isLinked` requires `available`; `activeTaskFor` returns undefined outside `available`; `zyraStatusFor` returns Unknown in those states; `handleGenerateFromTicket` refuses before using counts when the provider is unavailable; and both authoring buttons are disabled outside `available`. The coverage cell branches on `coverageState` before interpreting the count, showing access denied, loading, unavailable or a count explicitly labelled stale. Thus it is also inaccurate to say the renderer never reads a stale count: it can display a labelled last-known count.

`refreshLinkedKeys` uses settled provider reads and project/request fences. It clears payload on denial and can retain prior known payload under the stale state for a temporary outage. The explicit warning says unavailable links do not establish that no cases/tasks exist. Those are source facts, not a demonstration that every Requirements error path is correct.

The corrected source evidence still supports the substantive GREEN-M01 conclusion: a useful implemented guard was missing from the then-current source-fit map and the historical diagnosis needed its base pin. Candidate 2 credits that guard accurately without repeating the helper error. The original receipt, its severity and its evidence scope remain preserved; this delta must accompany it when its helper sentence is relied on.

## 4. Material requirement–design–work–proof reconciliation

The following checks assess the changed chains and their historical/ownership consequences. “Allocated” means a reviewable planned obligation exists; it does not mean implementation or acceptance is complete.

| Material contract and requirement basis | Design and work owner | Discriminating proof / delta assessment |
| --- | --- | --- |
| Current model applicability, FR-117 / MBT-C-02/C-12 | Native family/model selection; canonical 02 current/history modes, 03 §18.2.1, 04 convergence and 07 existing Model Studio tasks | MBT-AC-28/29/41 and GEX-AC-02 preserve active r1 after saving/approving r2, CAS conflict, old clients and unknown legacy basis. Approved inactive historical replay remains an explicit valid alternative. I rechecked that source dispatch still orders by greatest revision number; the correction is an open native-owner admission, not a delivered selector. |
| Generated origin versus current accepted model–case relationship, FR-118 / R-ASE-19 | Existing model/case relationship and review owners; canonical 03 source-fit rows and 04 current applicability | MBT-AC-34/35 and ASE-INT-11 explicitly include generated-only semantic edit/reapproval, mixed provenance, unchanged-valid controls and preserved old manifests. Source dispatch unions generated element IDs with explicit links, while case revision checks inspect explicit mappings. The candidate correctly preserves origin without treating it as perpetual current applicability. No second graph-owned link registry is justified. |
| Authority after serialization waits, R-ASE-18 / ASER-C03 | Existing link/unlink mutation boundary plus shared transactional authority helper | Canonical 05 allocates revoke-before-write and valid write-before-revoke orderings. I rechecked preflight `access()` and transaction writes in link/unlink, alongside `requireCurrentProjectAuthority`'s current membership locks. The native source risk remains open; a transport check or request cache does not close it. |
| Source entitlement and admitted credential lifetime, R-ASE-37/45 / P-18 | Existing binding, capture/history and consent owners, T-455/456; canonical 03/04 | ASE-FLOW-17–20/27/28 and QA-163 separate destination permission, actual source sharing and credential-specific final authority. An evidenced intentionally shared catalog remains valid. Revocation before the protected commit and revocation after a lawful commit have different expected effects. The current capture interface is not misdescribed as accepting a client idempotency key. These are retained qualified admissions, not raw-source disclosure or reproduced exploitation claims. |
| Actual recorder versus issuer, T-203/T-207 and trusted-result obligations | Native result writer and existing actors model; canonical 03 additional source admissions | QA-116 / ASE-INT-12 compare authorized human and machine submissions from the same issuer, current readers and unknown legacy attribution. I confirmed V60's `actors(id)` FK, V65 MCP actor, V84 human/automation channel support, and the MCP/native writer's issuer coupling. The candidate accurately carries Red's material correction: reuse actors and separate authorization input from recorded provenance; no unsupported users-FK migration or blind agent-ID substitution. Physical execution and rendered human impersonation remain unobserved. |
| Unknown native Run creation and concurrent recovery, ASER-C04 / MBT-C-07 | Existing native Run owner and contextual recovery UI, canonical 02/03/04/07 | ASE-FLOW-06/16/27, ASE-INT-13/14 and MBT-AC-14/37 include lost response/ID, late original, tab/process loss, distinct intent, stale cleanup and known-ID attachment retry. A recovery journal is not a second Run authority. Authoritative reconciliation or a supported truthful no-repeat protocol is valid; matching names and a user's list check are not absence proof. The document allocation does not close the QA/Grey source admissions. |
| Correction and comparison history independent of generation, R-ASE-32/44/47 / T-422 | Existing Zyra review/candidate/version/evaluation owners | Strengthened SK-E2E-31 with 38/39 and ASE-FLOW-54 preserves correction without allocation, exact original/successor/rejection/no-change evidence, matching UNKNOWN and rollback. The source-fit table correctly credits inline edits already possible without allocation while retaining the narrower regeneration/history limitations. No duplicate feedback or experiment store is justified. |
| Reference data versus governing guidance, R-ASE-21–34 / T-422 | Native KB/context readers and the proposed effective assignment resolver | ASE-INT-06, SK-E2E-14 and preserved GEX-AC-04 distinguish permitted ordinary references, approved-but-unassigned content, hostile instructions and revoked evaluation sources. Provider-envelope typing and deterministic effect controls remain planned. The candidate does not claim successful injection, installed Skills or complete governance from current AI-memory filtering. |
| Policy/manual semantic consequences, R-ASE-19/40 / GEX | Existing graph projection plus native Policy, Manual, Requirement and Case owners; canonical 01/02/03/04 and T-455–458 | GEX-SEM aliases map to existing ASE-FLOW/INT and SK obligations, including policy-only change, harmless wording change, contested authority, unsupported consequences, causal alternatives and truncated budgets. A link does not convey source authority. Deterministic/manual/no-change answers remain legitimate. Causal explanation, coverage arithmetic and actual verified attempts remain distinct. |
| Exact UI evidence navigation and honest state, R-ASE-41/48 / MBT-C-09 / ASER-UX03 | Existing case panel, Model Studio, Run links and shared T-308 UI work | I rechecked that the current case redirect drops `tcId`, the Run URL supplies model ID without its displayed revision, and Model Studio can choose head/another model. Candidate 07 now allocates exact authorized object/revision or explicit unavailability, equal-title and denied controls, return/reload/back and historical mode. Purple's other five mechanisms retain source-advisory status and authentic-runtime proof gates. Source/backend refusal cannot alone prove a truthful screen. |
| Truthful generator omission cause, FR-117/124 | Existing native generator/API contract | Canonical 03/05 preserve EG's pure-function diagnostic and allocate generous shortest-path/edge-coverage controls plus an actually binding budget to existing tests/GEX-AC-07. Strategy omission is not necessarily budget exclusion. I did not rerun EG's diagnostic; its executed-local status remains attributed to that receipt, not counted as my product test or new runtime proof. |

The eight-file requirement/design/contract/workflow/test/UI division remains coherent for these changes. Canonical 03 points to its own governed Skills contract, with the repository document expressly subordinate. Existing native owners retain publication and effects; graph analysis and the Change Workspace remain derived views/proposals. Planned contract breadth still requires an actual all-entrance and all-consumer census at the adopting implementation head.

## 5. Green opportunity, relationship and negative-space delta

No newly justified stateful subsystem emerged from these amendments. The concrete common needs are exact revision/reliance, independently authorized effects, meaningful typed relations, explicit incomplete reads and attributable correction. Cases, requirements and manuals/policies provide the three credible authoring consumers already identified in the original receipt. That supports a shared reasoning/metadata contract and the existing resolver seam; it does not establish that a new runtime/store is required or that this implementation has already earned a general platform.

The changed relationships preserve useful distinctions: generated-from lineage versus currently accepted case applicability; a historical Run's relied-on revision versus today's active pointer; source-to-destination entitlement versus issuer membership; and actual result recorder versus the person authorizing a delegated request. Their direction, revision grain and owner matter to the consumer's decision. None is safely replaced by a generic verified-by edge or a link to mutable latest state. Current acceptance and historical provenance must be represented separately, even if existing tables are extended to do so.

The second-order questions retain these bounded answers:

| Green lens | Delta judgment |
| --- | --- |
| Siblings / common substrate / architectural compression | Requirements, cases and manuals share guidance resolution, immutable input/review basis and evidence qualification. Compose existing native owners; do not collapse their publication authority or independent lifecycle. |
| Adjacent patterns / option value | Revision-controlled document reasoning and operation reconciliation provide useful invariant patterns. Source-grounded native examples are available. I did not independently research external products or certify the proposal's research claims. Exact relation/intent history is valuable now; broader AI architecture remains a candidate. |
| Platformization / prematurity / brand deletion | Removing GEX/ASER/Skills branding still leaves known owners for guidance, observation, accepted content, execution and projection. Architecture-now contracts are justified; new graph databases, universal workflow engines and agent studios are not earned by this delta. |
| Business value / cross-channel continuity | Less repeated authoring and better review context are plausible benefits, not observed outcomes. Native UI, MCP, AI, imports and jobs must converge at the same owner while retaining distinct principal and evidence classes. |
| Hardest/opposite sibling | Source-free, model-free manual QA, machine/event contracts, a policy-only change, no provider credit, harmless wording change and an unresolved oracle remain expressible without forced extra mutations. Actual completion of those paths is still unverified. |
| Participation scope | Skills are supporting guidance; native artifacts are authored subjects; attempts/results are execution evidence; the workspace is a projection. Approved inactive model history is a legitimate selected subject, not an instruction to change current applicability. |

The negative-space check found the relevant exceptions represented or explicitly gated: unavailable evidence, authority disagreement, historical ambiguity, provider/matching failure, source-only privacy policy, unknown external effects, interrupted multi-tab work and ordinary manual observations. Exact retention/erasure, governance bootstrap/recovery authority, resource envelopes, human comprehension and full consumer/runtime coverage remain **UNKNOWN or planned gates**. They are not silently N/A, and their mere mention is not proof of adequacy across the whole application.

FR-109/110, AC-077, WF-16, QA-437/438 and the related agent/UI instructions now consistently allow a fitting human or machine/event/contract representation. The independent oracle and material coverage obligations remain. This corrects a portability constraint without proving improved discovery. Canonical 06 preserves the recovered method's existing contributions, the standalone author's contradictory oracle guidance, separate source/candidate/installation status, and the earlier equal/inconclusive evaluation outcome. No methodology text was amended by this review.

## 6. Open gates and bounded handoff

The original review's substantive source admissions are still open: separate current model selection and migration; complete mapping/candidate/feedback history; final-owner action-bound assent and machine-origin provenance; source entitlement/credential fencing; exact native Run reconciliation; and all adopted entrances/consumers. The later Security/Purple/Elephant allocations extend those existing owners and proof obligations. A corrected description of source or a new scenario allocation does not close an implementation defect.

Still unavailable or not performed in this delta: actual deployment/build identity, installed migrations, real authenticated DB/API/MCP/browser acceptance, genuine current/after visual evidence, keyboard/assistive measurements, permissioned real-user governance, original case-free QA-loop execution, full journey inventory reconciliation, human-usefulness evidence, independent comparative method improvement, formal human quorum, executed Graph harness and White freeze. This is a bounded changed-contract/source reconciliation, not full-system assurance completion.

**Handoff:** preserve this delta with the original Green receipt and its original freeze; use the v2 JSON only for its stated document/input scope. GREEN-M01 and GREEN-L01 can be recorded as resolved for these exact candidate bytes. Keep the factual helper correction explicit. Carry the named source/authority/runtime admissions into the eventual integration work. The subsequent package receives no acceptance from this receipt until its own exact preservation and changed-contract delta is reviewed.

---

**Freeze rule:** this is the completed informed v1.4.32 candidate-2 receipt. Later reconciliation belongs in a separately labelled delta. The original Green report and reviewed inputs were not rewritten.
