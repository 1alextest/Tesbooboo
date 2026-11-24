# Purple informed v8 finding — Graph Analytics integration

**Run:** GEX-ASER-2026-11-19. **Signed:** 2026-11-20 05:40 UTC. **Reviewer:** `/root/purple_review`, ChatGPT GPT-6 Astra Pro; same original invocation and model family, no human or cross-model quorum. This is an informed integration delta, not a new cold review.

## Exact target and scope

Target: `/workspace/scratch/ce8c3109f396/assurance-run-20261119/input-v8`, revision 1.4.34. All fourteen manifest sizes/digests match. The incoming ZIP hash was independently checked and all eight extracted canonical files matched its entries. Earlier v4/v7 receipts remain immutable.

| Binding | SHA-256 or commit |
|---|---|
| v8 manifest | `880a9c05c15d995619d56ca23bb3f3f303df9d8456cf209a4cce0cf51066d354` |
| Incoming 1.4.33 ZIP | `2e76fd42d35b7956007f2aba95f86a15598fcc102bf4d4318d72c56d581a52cc` |
| Application commit | `6897f989b055a955280f810c7daace86f74057fa` |
| Unchanged original method commit | `d83549c85a4dcd047fb40dc4fba4ec62737ab0fc` |
| Frozen v7 Purple receipt | `e3b75eb9a33165605ff4e4860ce4597aa75f4a2a989cafd1011cd5cd62862473` |

I inspected incoming C02/C07 Reports journeys, C03/C04 scope/ranking/handoff, C05's eight GEX and five GA planned proofs, C06's changed candidate boundary, their v8 reconciliation, and pinned Reports/ReportsNav/AI Insights/Traceability and native coverage consumers. No prior incoming assurance receipt was treated as evidence.

## PU-V8-01 — Material handoff-stage contradiction; OPEN

C02:768 states, “Only explicit authorized native dispatch creates a run.” Retained C04:811–813 explicitly permits native create/choose, case attachment and accepted model linking before dispatch; uncertain creation uses OUTCOME_UNKNOWN and manual reconciliation. C05:1850 preserves separately authorized committed stages and truthful PARTIAL under MBT-AC-37. The new sentence therefore conflicts with legitimate prepared Runs and their visible receipts.

**Consequence:** an implementer could wrongly block preparation, describe an already-created Run as nonexistent until dispatch, or couple preparation to execution. This is a documentation integration finding, not observed runtime behavior. I identified and reported it before receiving a proposed correction.

**Required qualification:** viewing or staging a Graph Analytics finding neither creates nor dispatches a Run. Explicit authorized native create/choose/attach/mapping preparation retains its existing stages, receipts and uncertain-outcome recovery, including a Run committed before dispatch. Separately preserve the single protected `run_behavior_model` Run-plus-manifest operation's atomicity. No fabricated prior attempt or implicit dispatch is permitted. The coordinator proposes v9; no corrected target is judged here.

## Other material surfaces and limits

The read-projection placement is source-supported, not implemented. Reports uses local tab state (:97), generic suite-derived coverage (:303–307), and two export entrances (:379/390,445/446); ReportsNav uses visual-only active styling (:39–44) and fixed width (:73). These paths are under `Tesbo-Frontend`. Backend `legacy.service.ts:10294–10317` counts cases with non-Untested execution, not approved-obligation/cohort coverage. Incoming URL/snapshot, metric-label, focus/reflow, recovery and export-exclusion contracts address these integration needs. Exact native links, accessible equivalent lists and scoped shared-header metrics still need real proof.

**SOURCE-INSPECTED / VISUAL-BASELINE BLOCKED.** Original active whole-page/fidelity obligations remain blocked; formal Pass 2, draft Purple release machinery and operational adoption remain NOT RUN. No authentic UI, keyboard/AT, user comprehension or runtime evidence appeared. GEX/GA rows are planned obligations only. Incoming C06 changed: earlier method-trial evidence cannot qualify that successor. Existing v4/v7 source-convergence prerequisites remain open. Disposition is **v8 documentation correction required**, with no official Purple or release verdict.
