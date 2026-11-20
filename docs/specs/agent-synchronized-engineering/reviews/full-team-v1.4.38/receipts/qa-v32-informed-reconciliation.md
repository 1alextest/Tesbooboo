# QA informed reconciliation of original QA and Grey findings — v1.4.32 candidate 2

**Reviewer:** `/root/qa_v32_reconciliation`, one analytical QA reviewer, distinct from the original QA and Grey reviewers.  
**Date:** 2026-11-20 UTC.  
**Method:** unchanged QA charter v1.6, Grey/SUJT charter v1.8 and review orchestration at `NesberryEnterprise/Nesberry@d83549c85a4dcd047fb40dc4fba4ec62737ab0fc`.  
**Stage:** informed, sampled source substantiation and acceptance-allocation reconciliation.  
**Primary input:** `1.4.32-candidate-2`, manifest SHA-256 `e531935a62da0cabe61085f9f21696e8c2ab5a2c8a6a6f80fc4cbd68995ad9c0`.  
**Disposition:** the examined allocations fit the existing owners and preserve the material open source/runtime distinctions. **Keep the package NOT FROZEN.** One minor tool-name locator correction is recorded below. This receipt supplies neither full-journey closure nor implementation, runtime, accessibility, human-governance or release acceptance.

## 1. Outcome and exact scope

The candidate explicitly carries the original QA concurrent-recovery counterexample and Grey's uncertain-create, current-model, mapping/history, representation and feedback concerns into existing contracts and acceptance IDs. It credits the source419 Bug-link correction and provider-independent inline editor without treating either as complete runtime or feedback-history proof. Its representation amendment names the older numbered requirements and tests, so a tester now has a coherent proposed oracle for both a selected human-centered profile and appropriate event/contract/state-oriented work. [D1–D4]

I independently challenged the mechanisms below against the actual pinned source, rather than treating the original findings or the coordinator's earlier checks as proof. This is informed corroboration after reading those receipts; it is not another cold discovery run. Grey still owns the journey findings and persona evidence, QA owns the lifecycle oracles, and White owns completeness/freeze. No merged team, new role, human signer or operational approval is manufactured here. [M1]

The primary artifact contains the same eight canonical files, six subordinate views and run context. I recomputed SHA-256 and byte length for all 15 manifest entries: **15 matched, zero mismatches**; the manifest itself matched the assigned digest. Semantic reading was targeted: current source-convergence and admission clauses; FR-109/110, AC-077 and QA-437/438; relevant MBT and ASER recovery/history contracts; the v1.4.32 acceptance allocations and aliases; corresponding subordinate sections and method links. This is not an exhaustive reread of the accumulated historical package. [D0]

Source work used the supplied source419 and source419-frontend caches at `419c2efa08b04aff6c7c7d0d56425eb572bd6ec2`, with the root and frontend instructions read. I recomputed size, SHA-256 and Git-blob identity for the **19 source/instruction/test files** listed in the evidence index: all matched their supplied manifests. This binds local bytes to the supplied provenance, not a new remote retrieval or deployment observation. I compared the two supplied complete, non-truncated remote tree inventories: 419→`e3d0ebcbe8ec88c5b191abdf2b1d352d44929747` changes exactly seven blobs, comprising one frontend cycle page and six E2E fixture/test files; no backend blob changes. The Model Studio recovery and graph-review Run-setup files used below are unchanged in those inventories. This is a tree comparison, not execution of either tree. [S0]

The coordinator subsequently reported canonical v1.4.34/v1.4.35 and later PR heads. **Those later artifact bytes and the later implementation head are outside this receipt.** This receipt remains attached to candidate32's exact manifest; carrying it forward requires a separately bounded delta check.

## 2. Preserved originals, exposure and coverage limits

I read the original QA receipt, Grey original and informed delta, Red original including its appended Blue reconciliation, and Red's informed Security cross-review. Their differing source dates, exposure disclosures, severity systems and unresolved gates remain intact. Original document identifiers and current hashes are:

| Preserved input | SHA-256 |
| --- | --- |
| `qa-v31-original.md` | `dabbed1a4032d4f6075000e91c190566e341f6a69286b4950fd3a6b862887530` |
| `grey-v30-original.md` | `edc63c7d4705964799347ab602c9f5a5ce7c3bf4b34a21dde50cc069fda75601` |
| `grey-v31-delta.md` | `ee31ccfcbc8e70c8a5a4e408da46465549b351f3302c713d0d960d592d1c7653` |
| `red-v31-original.md` | `f42491896c72e9fd185cc63e8160d8a0db3bb53c4623a0b5404bd4fa28ce445d` |
| `red-security-cross-review.md` | `ae8086b73f08e0161fe0d3892b949ab65d688c4a98afbc91caccd925df354d67` |

The selected mechanisms relate to Grey J10, J24–J28, J32 and J42, and QA QJ04/QJ05/QJ14/QJ16/QJ17. That is a scope crosswalk, not eight fully rerun Grey journeys or five fully executed QA journeys. I did not regenerate the four-source whole-product inventory, replay all 42 Grey rows or all 24 original QA rows, or inspect every branch/entrance of the selected rows. Grey's original 42-row accounting and QA's separate 24-row accounting retain their original evidence dates; they must not be added together or upgraded by this receipt. Grey J41's source-pointer/scope uncertainty and the other unreviewed remainder are not closed here. [R1–R3]

No application, unit, integration, DB, API, MCP, browser, migration, provider or fault-injection test was executed. No target setup or current authenticated runtime was supplied. Test definitions were read as definitions. All schedules below are source-derived counterexamples or planned oracles, **not reproduced incidents**. This distinct reviewer supplies additional source corroboration, especially for GF-01 and the GF-02 correction; it does not supply a formal human sign-off, actual code-owner/deployer participation, cross-model diversity or broad assurance quorum.

## 3. Independent challenge and reconciliation

### A. Original QA F01 — concurrent Model Studio recovery

**Source substantiation:** `modelRunIntentKey` contains principal/project/model, but not the individual intent ID. `writeModelRunIntent` replaces that slot. `clearModelRunIntent` reads, compares the ID and separately removes the key. The page's `runSubmitting` ref is per component; its storage listener updates state after a storage event. Neither is a demonstrated atomic cross-tab admission or compare-and-delete fence. The read-empty/read-empty/write-A/write-B schedule can discard A's unresolved recovery context; the read-A/write-B/remove-key schedule can clear B. [S1]

**Counterevidence retained:** persistence happens before the non-idempotent POST; failed persistence prevents sending it. The page prevents ordinary same-component duplicate submits, retains unknown outcomes, scopes late UI updates, and independently reads native Run, provenance and executions when a person selects a possible match. `model-run-recovery.test.mjs` defines scope-isolation, sequential old-acknowledgement, malformed-storage and unknown-response cases. Its sequential newer-intent test does not prove the interleaved read/remove schedule. I did not execute it. [S1, S6]

**Allocation/oracle:** MBT-AC-14/37 and ASE-INT-13/14 now explicitly require the two-tab admission and old-clear/new-intent cases. Use controlled browser barriers and native readback: every admitted potentially committed intent remains recoverable until its own explicit resolution, or a competing admission is refused before its POST. An older completion cannot silently remove another request. A genuine second intentional Run remains a distinct legitimate operation. Multiple keyed intents, a supported atomic fence or an authoritative native receipt are alternatives; universal server idempotency is not the only acceptable design. [D2, D3]

**Disposition:** original source-supported risk corroborated; allocation is adequate at specification level; runtime closure OPEN. This is a recovery-context loss mechanism, not proof that every pair of clicks creates duplicate Runs.

### B. Grey GF-04 — graph-review native creation with a lost Run ID

**Source substantiation:** `ReviewCaseRunSetup.attachSelected` calls `createTestRun`, retains `pendingRunId` only after receiving the result, and sets `creationUnconfirmed` when an attempted create throws before an ID is known. A checkbox permits another create. The displayed existing-run picker filters out Completed, closed and automation runs; absence there is not authoritative proof that the first operation never committed or cannot commit later. The API adapter sends the name/environment/description payload to the native cycles endpoint; the controller delegates to `createCycleForUser`, and `createCycle` performs a fresh INSERT without a logical-request receipt lookup in this inspected chain. This strengthens the original component-only concern. It is still not an exhaustive audit of infrastructure outside that chain. [S2, S3]

**Counterevidence retained:** no automatic retry occurs. The UI's synchronous submit ref and honest unknown-outcome alert are useful. Once a Run ID is known, attachment/link retry targets that same Run; the selected cases are rechecked before creation. These are valid controls and must survive the repair. Model Studio's separate recovery journal must not be confused with this graph-review component's local state. [S1, S2]

**Allocation/oracle:** ASE-FLOW-06/16/27 and ASE-INT-14 explicitly include lost ID/response, tab/process loss, delayed original, same versus changed intent, revocation and known-ID attachment retry. The contract permits native same-operation reconciliation or an explicit no-repeat/pause outcome. A deliberate new Run remains a new intent; title equality is not identity. The corresponding existing UI recovery task is present in canonical 07. [D2–D4]

**Disposition:** GF-04 retained as a source-fit recovery risk and unexecuted consequence hypothesis. Checkbox-only absence checking does not close it; no duplicate Run was observed.

### C. Grey GF-01 / QA F02 — saved, approved and active model revisions

**Source substantiation:** `dispatchRun` selects the greatest `revision_number` and rejects another requested revision with `SUPERSEDED_REVISION`. Its own comment states that saving a revision moves the basis and that no second active pointer exists. `coverageForUser` also reads the greatest revision; the UI chooses `revisions[0]` for current authoring/dispatch. V154 describes the same latest-as-active choice. These are consistent source semantics; they conflict with the candidate's separately activated-current contract. Saving unapproved r2 therefore prevents the intended current r1 dispatch in this source trace. [S1, S4]

**Counterevidence retained:** model revisions and approval receipts are distinct, the hash-bound approval is checked, and the inspected native Run/manifest path shares its transaction and captures actual occurrence identities. Those improvements do not provide a separate active selection. An explicit product amendment choosing latest-head semantics is a legitimate alternative; neither code nor an old passing latest-head test silently authorizes it.

**Allocation/oracle:** MBT-AC-28/29/41 retain r1 current through r2 save and approval; separately activate with one CAS winner; refuse stale/default/old-client assumptions; preserve historical Runs and honest unknown migration basis. The model UI/API/MCP/coverage consumers and ordinary manual non-model path are explicitly included. [D1, D2]

**Disposition:** distinct informed corroboration of the open source/contract mismatch. Grey's provisional Major classification and original limits remain; this source review is not runtime reproduction or a formal freeze verdict.

### D. Mapping history and generated origin — related, separate obligations

**Source substantiation:** `linkCase` allows omitted `testcaseRevision`, storing null; `unlinkCaseForUser` physically deletes the current mapping row. V148 defines the live relationship table without a mapping-decision event history. A dispatch manifest retains its selected mapping and native occurrence, which preserves useful dispatched context but does not record the removed decision for a never-dispatched link. A genuinely unknown legacy basis must remain unknown. [S4]

The same dispatch code also corroborates Red R01's narrower distinction: generated rows add element IDs and origin, whereas only explicit links populate `mappings` for the case-revision comparison. A legitimate semantic case edit and reapproval can therefore retain generated origin without a fresh accepted applicability basis; an added explicit mapping does not itself remove the generated element union. The current approval checks and exact native snapshots are counterevidence to simplistic claims that no governance exists. `coverageAssertion: none` means this is not an observed false conformance pass. [S4, R4]

**Allocation/oracle:** MBT-AC-34/35 and ASE-INT-11 cover creation/removal history, exact relied-on basis, never-dispatched links, old Run preservation, permitted erasure and unknown legacy handling. Their generated-only and mixed-origin variations are explicitly allocated. Record before/after native relation/history state; retain an unchanged valid generated case as a control. A reviewed existing-history event/tombstone can satisfy retention; a duplicate mapping store or indefinite full-payload retention is not required. [D1, D2]

**Disposition:** open history and applicability obligations are correctly distinguished and allocated. I did not perform a complete trigger, all-writer, privacy-retention or migration audit. Red's post-wait authority case has a planned existing-owner allocation; this receipt does not replace its separate authorization substantiation.

### E. Grey GF-02 — Bug association and original execution truth

**Source substantiation and correction:** the inspected `createBug`, `updateBug`, `addBugLink`, `removeBugLink` and `replaceBugLinks` paths write Bug/link state without the original `failLinkedExecutions` mutation. The current MCP `link_bug` declaration explicitly preserves verdict, performer and time and directs a real observation to the result writer. Existing unit and API definitions cover preservation, replay and the legitimate explicit-failure neighbor. [S3, S5, S6]

**Disposition:** retain the original base finding as historical and the Grey delta's **source-corrected419** disposition. Do not report the old mechanism as still present at the inspected 419 owner, or mark it runtime closed because definitions exist. Final native UI/API/MCP and history/audit proof remains NOT RUN. A real observed failure remains a valid separately authorized result action; association alone is not an observation.

### F. Grey GF-05 / QA F04 — correction, regeneration and comparison history

**Source substantiation:** `zyraFeedback` explicitly means provider regeneration, rejects inappropriate task states and chat-linked batches, and looks up active provider allocation before recording the feedback activity or claiming the task. `processZyraFeedback` later replaces `generated_payload`. A missing allocation therefore blocks this operation before retention. Its state-CAS and post-generation status condition are useful controls against other concurrent task transitions. [S3]

**Material counterevidence retained:** `zyraEditDraft` already accepts bounded inline edits without an allocation lookup and updates the existing draft/activity under a row lock. It is incorrect to say all manual correction requires a provider. Its activity records an edit/title, not the exact previous and successor contents. V157 increments proposal revision and protects producer/request identity and committed publication receipts; its coherent review-snapshot function reads current operations. Those mechanisms do not alone archive every original, rejected or no-change trial. I make no claim that every output or audit history everywhere is lost. [S3, S4]

**Allocation/oracle:** SK-E2E-31/38/39 and ASE-FLOW-54 require permitted correction retention without generation, separate provider status, exact compared candidate iterations, independent evaluation and rollback without rewriting prior truth. Exercise the legitimate existing inline path, provider-absent correction and provider-required regeneration separately; read the actual original/successor/rejected payloads back. Use the existing feedback/candidate/version owners. [D1, D2]

**Disposition:** candidate32 correctly narrows the finding and credits reuse. Full feedback/history/evaluation integration remains OPEN; neither provider-independent editing nor a revision counter closes it.

### G. Grey GF-03 — hierarchy and story profile boundary

The original and Grey delta correctly recorded the older deliberate hierarchy/story requirement and the then-unresolved optional-lens conflict. Candidate32 now changes FR-109/110, AC-077 and QA-437/438 themselves, and its v1.4.32 normative reconciliation explicitly supersedes the universal form requirement. Approved scoped profiles may still require the original human-centered hierarchy. Applicable actors/events, permissions, consequences, coverage/unknowns and independently sourced observable oracles survive the representational choice. [D1, D2, R2, R3]

**Discriminating oracle:** accept a fitting human-centered profile and a machine/event contract without invented human roles; still flag missing actors/permissions when authorization is material, and preserve UNKNOWN when authority is absent. This is a document-level correction to the acceptance ambiguity, not a runtime user outcome or an independently ratified policy decision. The raw historical brief remains provenance and is not relabeled an accidental error or an installed portable rule.

## 4. Definition accounting and evidence separation

I counted the canonical 05 definition rows by their existing first-column identifiers:

| Family | Distinct definition rows |
| --- | ---: |
| ASE-E2E | 15 |
| ASE-FLOW | 54 |
| SK-E2E | 40 |
| ASE-INT | 16 |
| **Scoped ASER total** | **125** |
| Supplemental GEX-AC obligations | 8 |

SK-E2E-41–44 and GEX-SEM-01–08 appear in expressly labeled alias/allocation tables. The final source-case rows reuse existing acceptance/task owners and are explicitly planned, NOT RUN obligations. The new conditions increase what the affected tests must eventually prove, not the reported number of independent canonical definitions. When executed, each material variation still needs an individual outcome; an unchanged denominator is not permission to omit it. The eight GEX-AC obligations remain separately visible. [D2]

The final source-case allocation also preserves the following evidence boundaries:

- Elephant-Gold's local generator diagnostic is identified as a pure-function observation. It cannot satisfy final API, consumer, UI or product acceptance. I did not rerun the probe or independently assess every generator result.
- The generator row compares strategy omissions with genuine binding budgets and retains `coverageAssertion: none` / `executionAssertion: none`; generated paths remain proposals, not actual target execution.
- Security's source-attribution correction uses existing actor support and separates issuer authorization from recorded actor/channel. Capture revocation distinguishes pre-commit refusal from lawful committed history and later access, and does not invent a client idempotency-key argument.
- Document integrity, counts, links, source inspection, saved remote CI observations, current-head integration execution and actual deployment are different claims. None of my checks is a product test pass or a fresh CI run.

These checks validate the allocation and its limits. They do not independently revalidate all Security, Purple or Elephant-Gold source findings, nor the complete native all-entrance inventory. [D2–D4, R5]

## 5. Small document disposition

**Minor locator correction:** canonical 03 §18.2.1's additional admission table calls the MCP pair `record_execution_result` / `update_execution`. The inspected declaration is `update_execution_result`; Red's Security cross-review uses the correct name. Correct the label in the next reconciled candidate and any matching view. The owner, mechanism, oracle and acceptance count are unaffected. This was reported to the coordinator before receipt completion. No additional material contract inconsistency was found in the sampled clauses. [D1, S5, R5]

**Original QA F06:** both subordinate links now use `1341-portable-method-for-discovery-and-principle-distillation`, matching the current §13.4.1 heading in `skills-governance.md`. This is a source-level Markdown fragment correction; no rendered-browser navigation was performed. It creates no new method owner. [D5]

## 6. Handoff and final candidate fit

The examined candidate is suitable to carry these findings into the existing implementation/admission work with its current NOT FROZEN status. Keep source-corrected Bug association, current native transaction groundwork, provider-independent inline editing and the explicit representation amendment credited at their actual evidence levels. Keep active-model selection, relation/history completeness, uncertain creation, concurrent recovery, feedback-history/evaluation and all applicable runtime/UI proof open.

The decisive future evidence is bounded: two-tab storage barriers plus native readback; lost-ID/late-commit Run recovery; r1/r2/current/historical dispatch; never-dispatched unlink/relink and generated-case semantic mutation; side-finding versus explicit result action; and correction/regeneration with exact immutable comparison history. Each has an existing owner and a conforming control. No whole-application setup or optional test run was necessary to complete this authorized source/allocation reconciliation.

All frozen inputs and original receipts were preserved. Later canonical or implementation revisions need their own delta binding. This receipt does not claim all 42 Grey journeys were rerun, all QA obligations were executed, the full review sequence was formally closed, or any product/runtime result passed.

## Evidence index

- **M1 — unchanged method:** [QA charter](sandbox:/workspace/scratch/ce8c3109f396/assurance-source-recovery/Nesberry-d83549c85a4dcd047fb40dc4fba4ec62737ab0fc/.kiro/steering/teams/qa-team-charter.md), [Grey/SUJT charter](sandbox:/workspace/scratch/ce8c3109f396/assurance-source-recovery/Nesberry-d83549c85a4dcd047fb40dc4fba4ec62737ab0fc/.kiro/steering/teams/synthetic-user-journey-team-charter.md), [orchestration](sandbox:/workspace/scratch/ce8c3109f396/assurance-source-recovery/Nesberry-d83549c85a4dcd047fb40dc4fba4ec62737ab0fc/.kiro/steering/teams/review-orchestration.md). These and the teams README were read in full; the Grey executable-agent instructions were also consulted.
- **D0 — input binding:** [manifest.json](sandbox:/workspace/scratch/40f0abd3bdbc/input-v32-candidate2/manifest.json) and [RUN-CONTEXT.md](sandbox:/workspace/scratch/40f0abd3bdbc/input-v32-candidate2/RUN-CONTEXT.md).
- **D1 — current requirements/source fit:** [01_PRODUCT_REQUIREMENTS.md](sandbox:/workspace/scratch/40f0abd3bdbc/input-v32-candidate2/canonical/01_PRODUCT_REQUIREMENTS.md), FR-109/110, AC-077 and v1.4.32; [03_TECHNICAL_DESIGN.md](sandbox:/workspace/scratch/40f0abd3bdbc/input-v32-candidate2/canonical/03_TECHNICAL_DESIGN.md), §18.2.1. Corresponding current README and subordinate design/requirements clauses were inspected.
- **D2 — existing acceptance allocations:** [05_IMPLEMENTATION_BACKLOG_AND_TEST_PLAN.md](sandbox:/workspace/scratch/40f0abd3bdbc/input-v32-candidate2/canonical/05_IMPLEMENTATION_BACKLOG_AND_TEST_PLAN.md), cited MBT/ASER/Skills definitions and v1.4.32 allocation/alias/final-source-case sections; [implementation-plan.md](sandbox:/workspace/scratch/40f0abd3bdbc/input-v32-candidate2/views/implementation-plan.md), corresponding allocations.
- **D3 — recovery contracts:** [04_MCP_API_CONTRACTS.md](sandbox:/workspace/scratch/40f0abd3bdbc/input-v32-candidate2/canonical/04_MCP_API_CONTRACTS.md), MBT-C-07/ASER-C04 and concurrent-recovery state; relevant current workflow and proposed agent-method clauses were searched/read without full historical certification.
- **D4 — current UI allocation:** [07_UI_DESIGN_TASKS.md](sandbox:/workspace/scratch/40f0abd3bdbc/input-v32-candidate2/canonical/07_UI_DESIGN_TASKS.md), v1.4.32 and final concrete-source tasks.
- **D5 — method links:** candidate32 subordinate [README.md](sandbox:/workspace/scratch/40f0abd3bdbc/input-v32-candidate2/views/README.md), [AGENT_RULE_TEMPLATE.md](sandbox:/workspace/scratch/40f0abd3bdbc/input-v32-candidate2/views/AGENT_RULE_TEMPLATE.md), [skills-governance.md](sandbox:/workspace/scratch/40f0abd3bdbc/input-v32-candidate2/views/skills-governance.md), §13.4.1.
- **R1–R5 — informed inputs, in order:** [qa-v31-original.md](sandbox:/workspace/scratch/40f0abd3bdbc/receipts/qa-v31-original.md), [grey-v30-original.md](sandbox:/workspace/scratch/40f0abd3bdbc/receipts/grey-v30-original.md), [grey-v31-delta.md](sandbox:/workspace/scratch/40f0abd3bdbc/receipts/grey-v31-delta.md), [red-v31-original.md](sandbox:/workspace/scratch/40f0abd3bdbc/receipts/red-v31-original.md), [red-security-cross-review.md](sandbox:/workspace/scratch/40f0abd3bdbc/receipts/red-security-cross-review.md).
- **S0 — supplied source provenance:** [source419-manifest.json](sandbox:/workspace/scratch/40f0abd3bdbc/verification/source419-manifest.json), [source419-frontend-manifest.json](sandbox:/workspace/scratch/40f0abd3bdbc/verification/source419-frontend-manifest.json), [419 tree](sandbox:/workspace/scratch/40f0abd3bdbc/verification/implementation-tree-419c2efa.json), [e3d0 tree](sandbox:/workspace/scratch/40f0abd3bdbc/verification/implementation-tree-e3d0ebcb.json). The 19 locally verified files comprise S1–S6 below plus root `AGENTS.md`/`CLAUDE.md` and frontend `AGENTS.md`/`CLAUDE.md`; each source/test received the bounded treatment described above, not complete semantic certification.
- **S1 — Model Studio recovery:** [model-run-intent.ts](sandbox:/workspace/scratch/40f0abd3bdbc/source419-frontend/Tesbo-Frontend/components/model-studio/model-run-intent.ts) and [Model Studio page](sandbox:/workspace/scratch/40f0abd3bdbc/source419-frontend/Tesbo-Frontend/app/(app)/projects/[id]/model-studio/page.tsx), key/read/write/clear, storage listener, dispatch and reconciliation.
- **S2 — graph-review Run setup and adapter:** [ReviewCaseRunSetup.tsx](sandbox:/workspace/scratch/40f0abd3bdbc/source419-frontend/Tesbo-Frontend/app/(app)/projects/[id]/agents/zyra/changes/ReviewCaseRunSetup.tsx) and [api.ts](sandbox:/workspace/scratch/40f0abd3bdbc/source419-frontend/Tesbo-Frontend/lib/api.ts), create/attach/unknown outcome and native adapter.
- **S3 — native owners:** [legacy.service.ts](sandbox:/workspace/scratch/40f0abd3bdbc/source419/Tesbo-Backend-Nest/src/legacy/legacy.service.ts), createCycle/createCycleForUser, the named Bug/link writers, zyraFeedback/processZyraFeedback/zyraEditDraft; [legacy.controller.ts](sandbox:/workspace/scratch/40f0abd3bdbc/source419/Tesbo-Backend-Nest/src/legacy/legacy.controller.ts), native cycles create route.
- **S4 — model and version/history source:** [model-studio-repository.ts](sandbox:/workspace/scratch/40f0abd3bdbc/source419/Tesbo-Backend-Nest/src/behavior-graph/model-studio-repository.ts), link/unlink, dispatch and coverage; [V148](sandbox:/workspace/scratch/40f0abd3bdbc/source419/Tesbo-Backend-Nest/migrations/V148_model_studio_revisions.sql), [V153](sandbox:/workspace/scratch/40f0abd3bdbc/source419/Tesbo-Backend-Nest/migrations/V153_model_studio_governance.sql), [V154](sandbox:/workspace/scratch/40f0abd3bdbc/source419/Tesbo-Backend-Nest/migrations/V154_model_studio_governed_runs.sql), [V157](sandbox:/workspace/scratch/40f0abd3bdbc/source419/Tesbo-Backend-Nest/migrations/V157_native_testcase_proposal_review.sql).
- **S5 — named MCP declarations:** [mcp.tools.ts](sandbox:/workspace/scratch/40f0abd3bdbc/source419/Tesbo-Backend-Nest/src/mcp/mcp.tools.ts), result-tool names and Bug-link preservation contract; other Security source paths were not independently rereviewed here.
- **S6 — definition-only counterevidence:** [model-run-recovery.test.mjs](sandbox:/workspace/scratch/40f0abd3bdbc/source419/scripts/model-run-recovery.test.mjs), [bug-link-finalization.spec.ts](sandbox:/workspace/scratch/40f0abd3bdbc/source419/Tesbo-Backend-Nest/src/legacy/bug-link-finalization.spec.ts), [bugs.spec.ts](sandbox:/workspace/scratch/40f0abd3bdbc/source419/e2e/api/bugs.spec.ts), targeted recovery/preservation/control definitions; **NOT RUN**.

---

## Separately bounded v1.4.35 candidate 1 preservation delta

**Date/stage:** 2026-11-20 UTC; informed document-preservation and allocation check requested after the candidate32 receipt was written. **The preceding 28,872 bytes remain unchanged**, SHA-256 `89392c89bd7fc0df4919100e69c1e477ee5fb83eb31ec13a9130eccbea1243af`. The earlier receipt's claims remain scoped to candidate32. This appendix adds only the checks below.

**New exact input:** [input-v35-candidate1/manifest.json](sandbox:/workspace/scratch/40f0abd3bdbc/input-v35-candidate1/manifest.json), SHA-256 `b5cb419188c3525c6a8bef56aba3beb57e0bacb13f3ce5783f4d44b94df1203d`; saved parent v1.4.34, Library version 14, archive SHA-256 `ac55077842806781223c83c64869b2f55a992155ec12bb9ae4689459961f11f9`; subordinate parent `ac49fa64d87723c9c1be4491a6fe06c7672e3af6`; implementation head `b07def32b725cfa3b71f34d001bbbdc94ed38226`. I read the new run context and recomputed all 15 listed file digests/lengths: **15 matched, zero mismatches**.

### Preserved meaning and corrected locator

I compared **19 exact operative lines/paragraphs** from candidate32 with candidate35. All were identical: FR-109, FR-110 and AC-077; seven source-convergence rows covering latest/current model, mapping history, feedback, Bug association, unknown native create, concurrent recovery and generated origin; four explicit uncertain-create/concurrent-recovery/generated-origin/post-wait allocation paragraphs; SK-E2E-31 and QA-437/438; and both existing-Run and concurrent-tab UI recovery paragraphs. The supersession paragraph is retained with the current revision label, preserving approved scoped human-centered profiles.

The candidate35 technical-design table and subordinate design mirror now correctly name `update_execution_result`. The candidate32 locator issue is therefore **document-corrected in this new input**, without rewriting candidate32 or its receipt. The original QA/Grey findings, source corrections and NOT RUN limits remain intact in the sampled current clauses. [V35-D1, V35-D2]

I consulted the two supplied merge/preservation ledgers for their declared provenance: 14 file entries and 34 merge decisions, plus an exact-added-line check with explicit current-label corrections. Those ledgers describe how incoming material was preserved; I did not independently certify every merged paragraph or reconstruct the whole three-way merge. [V35-M]

### Count and imported-condition boundaries

Canonical 05 still has 15 ASE-E2E, 54 ASE-FLOW, 40 SK-E2E and 16 ASE-INT definition rows: **125 scoped ASER definitions**. The eight GEX-AC rows remain separate. Five actual GA-AC-01–05 table rows now form the current Graph Analytics set; the chapter explicitly supersedes the older four prose summaries, so they are not nine checks. All five are planned and NOT RUN. [V35-D2]

The five GEX-DISC-01–05 rows are expressly historical diagnostic labels allocated to existing canonical owners and tests. Their conditions distinguish authority conflict from CAS, conditional consequence from reachability, effective/published/observed/deployed time, proposed versus accepted relations, and correction-driven rederivation from rewriting accepted history. Each retains a legitimate neighbor/negative control or a named evidence requirement. They add no new canonical definition family or execution credit. GEX-SEM-01–08 and SK-E2E-41–44 retain the same alias treatment. The six subordinate views identify the current 125 / eight / five boundary and state that later imports do not inherit earlier cold, runtime or empirical review. [V35-D2]

This is allocation review, not full Graph Analytics journey assurance or an independent method-effectiveness trial. I did not replay the DMIS fixture, all report consumers/exports, all discovery cases or the incoming author diagnostic. The incoming 285-line method-source attribution remains distinct from the earlier 525-line standalone source and recovered repository pack; this appendix claims no new semantic inspection or adoption of that 285-line body.

### Source precedence and occurrence-count admission

I independently compared the supplied complete e3 and b07 tree inventories. Exactly three blobs differ: the frontend cycle page and `e2e/api/cycles.spec.ts` / `e2e/ui/executions.spec.ts`. No backend blob differs. This carries the inspected backend mechanisms to that source identity; it is not a runtime or deployment claim. The changed cycle-page behavior and E2E outcomes were not independently executed or fully semantically reviewed here.

Canonical 03's v1.4.35 checkpoint and canonical 05's current-source precedence note explicitly qualify the retained base6897 source/test-status chapter. Thus older split-transaction, token-principal and Bug-link observations must be read historically alongside source419's corrections. The preserved table is not evidence that the corrected mechanism still exists at b07. Newer CI binds only its actual commit/stages; no CI or document result closes these new obligations. [V35-D1, V35-D2]

For the newly retained occurrence-count concern, I read the actual `coverageForUser` query at source419: it uses `COUNT(*)` after joining `mbt_model_case_links` through cases/cycle items to executions, grouped by case/status. V148 permits distinct element-set mappings for the same case. That query shape supports keeping relationship-multiplication versus observation-grain as an **open source admission**, with soft-deleted/historical scope explicit. The source's comment already says these observed case results are not model verification; preserve that control. Candidate35 assigns the proof to GEX-AC-07 / GA-AC-02 / MBT-AC-02/34. I ran no in-memory, PostgreSQL, API or UI occurrence probe and did not reproduce a user-visible count defect. [S4, V35-D1, V35-D2]

**Bounded v35 disposition:** preservation and acceptance allocation fit the examined scope; retain NOT FROZEN and the original open source/runtime gates. No additional material unallocated obligation was found in this bounded delta. This appendix does not expand the 42-Grey/24-QA journey claims, certify all incoming Graph Analytics/discovery semantics, or grant formal White/human approval.

**Additional evidence:**

- **V35-D1:** [01_PRODUCT_REQUIREMENTS.md](sandbox:/workspace/scratch/40f0abd3bdbc/input-v35-candidate1/canonical/01_PRODUCT_REQUIREMENTS.md), the cited requirements and current supersession; [03_TECHNICAL_DESIGN.md](sandbox:/workspace/scratch/40f0abd3bdbc/input-v35-candidate1/canonical/03_TECHNICAL_DESIGN.md), §18.2.1 and current source checkpoint.
- **V35-D2:** [05_IMPLEMENTATION_BACKLOG_AND_TEST_PLAN.md](sandbox:/workspace/scratch/40f0abd3bdbc/input-v35-candidate1/canonical/05_IMPLEMENTATION_BACKLOG_AND_TEST_PLAN.md), retained GA-AC table, current acceptance/source-case and DISC allocation; [07_UI_DESIGN_TASKS.md](sandbox:/workspace/scratch/40f0abd3bdbc/input-v35-candidate1/canonical/07_UI_DESIGN_TASKS.md), the two recovery paragraphs; corresponding source/status/count/alias clauses in the six subordinate views.
- **V35-M:** [merge35-resolution-ledger.json](sandbox:/workspace/scratch/40f0abd3bdbc/verification/merge35-resolution-ledger.json), [incoming34-ac49-preservation-check.json](sandbox:/workspace/scratch/40f0abd3bdbc/verification/incoming34-ac49-preservation-check.json), [b07 tree](sandbox:/workspace/scratch/40f0abd3bdbc/verification/implementation-tree-b07def32.json), compared with the e3 tree in S0.

### Final candidate35-2 availability-note delta

**Exact input:** [input-v35-candidate2/manifest.json](sandbox:/workspace/scratch/40f0abd3bdbc/input-v35-candidate2/manifest.json), SHA-256 `311423fa8cdafc3c94d9a6df62280ec9c6fcf7e350583ad46c15cbe757362a82`. I recomputed all 15 listed file hashes/lengths: **15 matched, zero mismatches**. Direct comparison against candidate35-1 found only the two availability-note additions in canonical 00 and subordinate README, plus the run-context candidate label and explanatory note. No other canonical/view byte changed.

The identical inserted notes distinguish the imported v1.4.34 review's then-unavailable repository pack from this continuation's 18-file recovery. They retain unknown unpublished variants and explicitly deny that recovery establishes installation, approval, assignment, activation or effectiveness. This is a coherent evidence-date clarification and changes none of the sampled QA/Grey allocations, oracles, source dispositions or definition counts. It does not claim this appendix independently reread or reran the full pack.

The previous **36,344 bytes**, containing candidate32 and the candidate35-1 appendix, remain unchanged at SHA-256 `2386521ba719f44ac3433599d032663e71f92b77230870e5ad375a31c8cf4659`. The candidate32 prefix was also rechecked against its recorded digest. **Final bounded fit remains suitable for the stated proposal/allocation continuation, NOT FROZEN; all stated implementation/runtime/formal-gate limits remain.** No new CI, browser, database, generator or method trial was executed or independently certified in this final delta.
