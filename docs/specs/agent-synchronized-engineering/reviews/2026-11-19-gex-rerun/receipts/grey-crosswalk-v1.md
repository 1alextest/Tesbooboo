# Grey / SUJT — informed canonical05 crosswalk v1

**Run:** GEX-ASER-2026-11-19. **Target:** 1.4.29-candidate-v1. **Author:** `/root/grey_journeys`. **Purpose:** trace reconciliation only, after independent inventory freeze; not a second cold review or test receipt.

## Independence and evidence boundary

The independent discovery artifact is `grey-inventory-v1.md`, SHA256 `4a97ea981b63298f704ff569c354a09e08b78b94b228da696a14e884599e700e`. It was written and hashed before opening canonical05's historical GJ inventory or acceptance scenarios. Its 50 jobs, personas, five source-fit findings and original G0/G1 judgments remain unchanged. The accompanying `grey-inventory-v1.sha256` records that freeze. This document was created afterward.

Comparison source: immutable input `canonical/05_IMPLEMENTATION_BACKLOG_AND_TEST_PLAN.md`, specifically the ASER integration falsifiers, historical GJ-01–49 inventory, ASE-FLOW-01–54, ASE-E2E-01–15, SK-E2E-01–40 and 1.4.29 allocation text. Historical review judgments appearing beside those rows were not imported as current evidence or used to generate the independent inventory. No other reviewer's receipt or author retrospective was opened.

Mappings below mean that a proposed test or historical job is relevant to an independently reconstructed job. They do **not** mean a test ran, that its exact assertions are sufficient, or that a historical result applies to the current pinned source. Canonical05 itself labels the 125 ASER definitions as planned and NOT RUN. Those are 125 definitions, not 125 user journeys or observations.

## Independent job → authored trace crosswalk

GJ identifiers here refer only to canonical05's historical inventory. Multiple mappings reflect different granularity; matching numbering was neither expected nor attempted. Relevant test families are pointers for QA/Graph reconciliation, not a claim of complete requirement-to-assertion allocation.

| Frozen job | Related historical GJ | Relevant authored obligations / remaining qualification |
|---|---|---|
| J01 Project/client access | 01, 02, 46 | ASE-FLOW-12/15/28/51; ASE-INT-03/09/14; SK-E2E-40. Actual human/client authority stays O1. |
| J02 Accepted sources and effective method | 05, 33 | ASE-FLOW-40/50; SK-E2E-35/37; ASE-INT-01/06. Retrieval does not establish effectiveness. |
| J03 Absent/contradictory expectations | 29 | ASE-FLOW-05/22/33/37/46; SK-E2E-34/36; ASE-INT-16. Legitimate no-change and UNKNOWN retained. |
| J04 Source bind/rebind/retire | 26 | ASE-FLOW-18/19/28; ASE-INT-07. Generation and multi-source proof absent. |
| J05 Planned/spontaneous/event capture | 25, 26 | ASE-FLOW-01/02/16–19/27; ASE-INT-07/14. Source watcher is optional, gap reporting is required. |
| J06 Dependencies and incomplete impact | 25, 29, 42, 49 | ASE-FLOW-20/21/28/47/52; SK-E2E-29; ASE-INT-16. Unknown edges cannot become no-impact. |
| J07 Durable QA impact work | 30, notification part of 48 | ASE-INT-14; ASE-FLOW-16/27. Scheduled outbound report continuation is separately unexamined below. |
| J08 Grounded graph interpretation | 29, 49 | ASE-FLOW-39/41/45/47/52; ASE-INT-16. Output quality is an unexecuted evaluation gate. |
| J09 Source-free manual case | 12 | ASE-FLOW-29/31/33/45; SK-E2E-31/32/36. No repository/model/runner prerequisite. |
| J10 Case reuse and semantic distinction | 12, 13, 14, 41 | ASE-FLOW-24/32/38; ASE-INT-03. Bulk/import/clone/metadata paths remain writer gates. |
| J11 Native requirement/criteria | 19 | ASE-E2E requirement scenarios; ASE-FLOW-01/05; ASE-INT-04/16. Native authority/criterion implementation not established. |
| J12 External requirement reconciliation | 20 | ASE-INT-14; failed read ≠ empty contract. Current source finding SG1 is not displaced by historical GJ-20's bounded HOLD. |
| J13 Audience-specific manual | 21 | ASE-E2E manual scenarios; ASE-INT-02/06. Immutable governed snapshot and every reader remain gates. |
| J14 Policy authority/effectivity | 22 | ASE-FLOW-05; ASE-E2E policy scenarios; ASE-INT-04/08/16. Approval ≠ enforcement/effectivity. |
| J15 General work/task continuation | 23 | ASE-E2E task scenarios; ASE-FLOW-07/14; ASE-INT-16. Native general task extension remains open. |
| J16 Files and evidence bytes | 24 | ASE-INT-06/12/14; ASE-E2E evidence scenarios. Metadata, original bytes and read permission are separate. |
| J17 Exact typed trace | 19, 42 | ASE-FLOW-21/28/47; ASE-INT-04/07. Citation, accepted mapping and observed result are distinct. |
| J18 Multifact stage/assess | 25, 27 | ASE-FLOW-01/03/06; ASE-INT-04/05/16. No unnecessary mutation to satisfy a domain checklist. |
| J19 Human exact selected apply | 11 | ASE-FLOW-12/51; ASE-INT-03/04/05/11. Historical GJ outcome is not current all-writer proof. |
| J20 Uncertain receipt/resume | 28 | ASE-FLOW-03/06/16/27; ASE-INT-04/05/14. Stable receipt must survive ambiguous response. |
| J21 Original case-free delegation | 06; selection portion of 03 | ASE-INT-12. Initial runtime registration remains CW-O1 below. |
| J22 Executor claim/clarify/cancel | 07, 08; swap portion of 03 | ASE-INT-12/14. External target capability and server task lease remain separate. |
| J23 Original report/manual fallback | 09 | ASE-FLOW-04; ASE-INT-12/14. No proof that proposed report interface exists end to end. |
| J24 Analysis/new independent retest | 10 | ASE-INT-12. New observation cannot be a rewritten original report. |
| J25 Plan/run/schedule selection | 15 | ASE-FLOW-25; ASE-INT-03. Scheduled run is distinct from scheduled outbound report. |
| J26 Real human manual attempt | 16 | ASE-FLOW-30; SK-E2E-32; ASE-INT-12. Real human testimony does not require fabricated machine evidence. |
| J27 SDK/CI retry and evidence | 15, 16, 18 | ASE-FLOW-04/26; ASE-INT-14/15. Current source upsert/retry counter is not full immutable occurrence proof. |
| J28 Direct/side finding and Bug | 17 | ASE-FLOW-35; ASE-INT-03. SG2 preserves status/time/performer independently of association. |
| J29 Attributed result correction | 18 | ASE-FLOW-36; ASE-INT-03/15. Original status and failure remain visible. |
| J30 Fix/reopen/independent retest | 18, 37 | ASE-FLOW-14/26/36; ASE-INT-12/15. Fixed is not independently Passed. |
| J31 Ephemeral preview | 39 | Existing MBT preview definitions. G1 HOLD is only the inspected bounded parser, not rendered UI. |
| J32 Persisted model lifecycle | 40 | Existing MBT approval/current-pointer definitions; ASE-FLOW-22/25. SG3 current-vs-latest mismatch requires explicit regression. |
| J33 Mapping acceptance/removal | 41, 42 | Existing MBT mapping/history definitions; ASE-FLOW-21/25. SG4 requires mapping-decision history, not only run history. |
| J34 Bounded model generation | 41 | ASE-FLOW-22/23/41. Supported feasibility, constraints and budget ≠ complete product coverage. |
| J35 Generated suggestion → native case | 11, 41 | ASE-FLOW-24/32; ASE-INT-03/04. SG5 direct native creation/transaction boundary needs exact failure injection. |
| J36 Model run vs target execution | 15, 41 | ASE-FLOW-25; SK-E2E-30. Native run preparation is not target action/assertion. |
| J37 Coverage and historical scope | 38, 42 | ASE-FLOW-08/26/33; SK-E2E-30; ASE-INT-15. Denominators, stale scope and missing assertions remain visible. |
| J38 Feedback/correction layer | 43 | ASE-FLOW-31/34–36/40/44/54; SK-E2E-31. Local correction may complete with no reusable-method change. |
| J39 Inert immutable method candidate | 31 | ASE-FLOW-49/51; SK-E2E-35/38/40; ASE-INT-02/06. Imported or retrieved text cannot activate itself. |
| J40 Independent candidate evaluation | 34 | ASE-FLOW-38/39/43/48/53; SK-E2E-33/38. Authored scenarios themselves do not provide the independent evaluation. |
| J41 Approve/assign/compose/drift | 32, 33 | ASE-FLOW-09/12/44/50/54; SK-E2E-37–39; ASE-INT-01/05. Approval and effective assignment stay separate. |
| J42 Revocation/root recovery | 32, 33 | ASE-FLOW-09/44; SK-E2E-39; ASE-INT-09/11. Recovery quorum remains an unresolved real authority decision. |
| J43 Privacy-preserving lesson transfer | 31, 34, 43 | ASE-FLOW-42; ASE-INT-06. Sanitization and destination authorization cannot be inferred from relevance. |
| J44 Workspace default pack | 01, 32 | ASE-INT-01/11. Explicit upgrade and unknown historical usage retained. |
| J45 Session/provider/UI continuity | 03, 04, 35, 46 | ASE-FLOW-03/07/13; ASE-INT-05/13/14. Initial executor registration is not fully traced; CW-O1. |
| J46 Role-safe change closeout | 25, 35 | ASE-FLOW-07/13; ASE-INT-10/13/16. Settlement and readiness remain derived from authoritative facts. |
| J47 Predeploy readiness decision | 36 | ASE-FLOW-08/10; ASE-INT-08/16. Exact candidate and actual risk decision required. |
| J48 Deployment/smoke/incident | 37 | ASE-FLOW-10/11/14; ASE-INT-08/14/15. Missing provider evidence remains unknown. |
| J49 Reports/export/share | 38, 44; recipient projection part of 48 | ASE-INT-06/13/15. Scheduling and actual outbound delivery not traced end to end; CW-O2. |
| J50 Migration/archive/delete/restore | 13, 45, 47 | ASE-INT-02/06/11; existing MBT history gates. Retention authority and all destructive paths remain O1/O2/O6. |

Every historical GJ has either a thematic relationship above or an explicitly unexamined continuation below. This does not declare equivalence between the two inventories or transfer their result counts. The current independent denominator remains 50 jobs; comparison has exposed two missing continuations whose status must accompany any completeness statement.

## 1.4.29 addition allocation

This is a complete thematic mapping of the 38 new ASE-FLOW and twelve new SK-E2E definitions to independently frozen jobs. It is **not** a claim that all detailed assertions or all intersections were simulated. The G0/G1 limits and O1–O7 apply to each mapped job.

| Added definition | Frozen job(s) | Added definition | Frozen job(s) |
|---|---|---|---|
| ASE-FLOW-17 | J05 | ASE-FLOW-36 | J29/J38 |
| ASE-FLOW-18 | J04/J05 | ASE-FLOW-37 | J03 |
| ASE-FLOW-19 | J04/J05/J50 | ASE-FLOW-38 | J10/J40 |
| ASE-FLOW-20 | J06 | ASE-FLOW-39 | J08/J40 |
| ASE-FLOW-21 | J06/J17 | ASE-FLOW-40 | J02/J38 |
| ASE-FLOW-22 | J03/J34 | ASE-FLOW-41 | J08/J34 |
| ASE-FLOW-23 | J34 | ASE-FLOW-42 | J43 |
| ASE-FLOW-24 | J10/J35 | ASE-FLOW-43 | J40 |
| ASE-FLOW-25 | J25/J36 | ASE-FLOW-44 | J38/J41/J42 |
| ASE-FLOW-26 | J27/J37 | ASE-FLOW-45 | J08/J09 |
| ASE-FLOW-27 | J05/J20 | ASE-FLOW-46 | J03 |
| ASE-FLOW-28 | J01/J04/J17 | ASE-FLOW-47 | J06/J08/J17 |
| ASE-FLOW-29 | J09 | ASE-FLOW-48 | J40 |
| ASE-FLOW-30 | J26 | ASE-FLOW-49 | J39 |
| ASE-FLOW-31 | J09/J38 | ASE-FLOW-50 | J02/J41 |
| ASE-FLOW-32 | J10 | ASE-FLOW-51 | J01/J19/J39 |
| ASE-FLOW-33 | J03/J09/J37 | ASE-FLOW-52 | J06/J08 |
| ASE-FLOW-34 | J38 | ASE-FLOW-53 | J40 |
| ASE-FLOW-35 | J28 | ASE-FLOW-54 | J38/J41 |

| Added definition | Frozen job(s) | Added definition | Frozen job(s) |
|---|---|---|---|
| SK-E2E-29 | J06/J09 | SK-E2E-35 | J02/J39 |
| SK-E2E-30 | J36/J37 | SK-E2E-36 | J03/J09 |
| SK-E2E-31 | J09/J38 | SK-E2E-37 | J02/J41 |
| SK-E2E-32 | J09/J26 | SK-E2E-38 | J39/J40/J41 |
| SK-E2E-33 | J40 | SK-E2E-39 | J40/J41/J42 |
| SK-E2E-34 | J03 | SK-E2E-40 | J01/J39 |

## Comparison-exposed omissions: not retrofitted into cold discovery

| ID / material continuation | Discovery status / result | Existing relationship and missing path | Consequence, owner and closure requirement |
|---|---|---|---|
| CW-O1 Register and verify an analyst backend/executor before selecting it | **NOT_SIMULATED / NOT_ASSESSED** | Historical GJ-03 prompted this gap. J01/J21/J22/J45 cover scoped access, selection, dispatch, revocation and handoff, but do not trace initial instance registration, capability verification and secure credential/connection handoff through the actual native owner. Exact registration writer/data body was not inspected. | A configured fixture cannot prove how the real prerequisite is produced. Blue/QA/Grey must establish supported registration producer, actual capability evidence, denied registration, incompatible runtime and revoke/swap behavior without expanding into a new agent platform. O1/O2/O4 remain; no claim that registration is absent. |
| CW-O2 Schedule and deliver an outbound project report to an authorized destination | **NOT_SIMULATED / NOT_ASSESSED** | Historical GJ-48 prompted this gap. J07 traces durable graph notifications, J25 scheduled runs, and J49 report/export/share. None traces the distinct outbound reporting scheduler through recipient/destination resolution, delivery, retry/uncertainty and revoked recipient readback. Exact outbound delivery source body was not inspected. | Report generation is not report delivery. Blue/QA/Grey must identify the actual producer/delivery owner and test scoped recipients, lost acknowledgments, repeat delivery and restricted evidence in the projection. O2/O4/O6 remain; no invented implementation or permission to send. |

These are named coverage gates, not newly confirmed product defects. They preserve the required user jobs instead of silently adapting them to the evidence available. They may be handled as extensions of J21/J45 and J49 or as separate stable jobs in a later informed inventory; that choice must not alter the original freeze.

## Trace and evidence cautions for the coordinator

1. **Do not carry historical outcomes.** Historical GJ-20's bounded G1 HOLD does not establish the currently inspected failed-link-read branch: J12/SG1 statically fails it. Conversely, J31's G1 HOLD concerns the parser's bounded rejection/disclaimer behavior only, while GJ-39 described a wider preview journey. These scope differences require explicit labels, not averaged verdicts.
2. **Keep source-fit regressions specific.** The broad GJ-40/41 and model families must retain the separate SG3 active-pointer, SG4 mapping-history and SG5 publication/transaction obligations. A general “model can create a run” test cannot prove them. This is an allocation recommendation, not an assertion that no existing MBT test covers any part.
3. **Do not infer efficacy from case count.** The new method-evaluation scenarios refer to frozen comparators, independent accepted oracles, unlike contexts and held-out failures. Their presence does not demonstrate that this evaluation has occurred or that the method can rediscover unseen requirements. No runtime, human study or cross-model independence is supplied.
4. **Do not use a matching row as closure.** All 125 definitions still need actual fixtures, source/build/schema/principal pins, required and forbidden effects, authoritative readback and exact artifacts. All-entrypoint, migration, disclosure, genuine human authority and authentic UI evidence remain gates even when a themed scenario exists.
5. **Completeness is qualified.** Fifty independently reconstructed jobs are frozen; two additional unexamined continuations were identified by this permitted later comparison. The role receipt must report both facts and cannot call this complete end-to-end execution.

**Signature:** `/root/grey_journeys`, Grey/SUJT lead and sole runner. Informed trace comparison completed after independent inventory freeze. No product/source/input/remote mutation, execution test or external message performed.
