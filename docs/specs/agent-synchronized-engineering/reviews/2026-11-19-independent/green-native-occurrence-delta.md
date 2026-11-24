# Green Team v0.3 — independent occurrence repair and binding delta

**Receipt:** GREEN-NATIVE-OCCURRENCE-2026-11-20. **Independent reviewer:** `/root/green_native_occurrence_delta`. **Source:** `965a87a13d2669354598f8d4b912f36fdb148867`. This is a new member receipt, not a rewrite of the earlier blocked Green reports.

**Disposition at this cutoff: the GREEN-NATIVE-01 mechanism is repaired in the inspected production source and independently exercised projection/composition boundary, with supporting real migrated-database lifecycle evidence at the identical CI tree. I accept the bounded source/database repair and the v3 input-integrity binding. Final native Green readiness remains PENDING the current API/browser terminal evidence and actual two-member reconciliation.** This is not a release, merge, deployment, full-journey or original I3-Q acceptance.

No new Critical, High, Medium or Low product defect was established in this bounded delta. The earlier High is not reproduced on the repaired source. Its affected browser/API acceptance is still an explicit evidence gate; the unchanged broader history, authority, original-loop and visual-parity requirements are not waived.

## 1. Actual run context and independence

| Field | Binding and evidence boundary |
|---|---|
| Application and scope | `1alextest/Tesbooboo`, PR167 native integration. Review the original-occurrence relationship, its transaction, status/element projections, two existing UI consumers, related regressions and the revised declared Green binding. |
| Immutable source | `/workspace/scratch/fb086055b433/tesbo-review-965a87a1`, commit `965a87a13d2669354598f8d4b912f36fdb148867`, tree `b3c497bdb7a43cd43e8d0535f663c542cba88186`. Independently resolved and checked clean. |
| Original counterexample source | `9519b56d3441dfec3a107db95ca602665454f407`, tree `31b5e09247237c29ef3d215ab60147c7e4f13ba7`. The new identical-oracle probe was also executed against that immutable source. Earlier raw Green evidence remains untouched. |
| Actual CI build | `e49fab4df4043b621b7007e97d8646743f441b6b`, parents `6897f989b055a955280f810c7daace86f74057fa` and the reviewed source. I resolved both Git trees and ran `git diff --exit-code` between them: exit 0, identical tree `b3c497bdb7a43cd43e8d0535f663c542cba88186`. The received logs print that actual checkout. |
| Method | Unchanged Nesberry `d83549c85a4dcd047fb40dc4fba4ec62737ab0fc`; full Green charter v5.8, applicable orchestration/run-context/full-coverage/UI clauses and both evidence/portability policies were read. No method or product policy was edited. |
| Product authority | Original eight v1.4.28 specifications. Scoped original MBT-C-05, FR-048, P-05, FR-095/096 and T-438 clauses were read directly; the checker independently validated all eight declared file hashes. This is not an exhaustive re-audit of every original requirement. |
| Actors, owners and material states | Human reviewer and run operator, scoped API/MCP callers, model/native reader. Model dispatch owns the recorded reliance relation; native cycle/item/execution owns actual membership, reviewed snapshot and results. Creation, removal, re-addition, original evidence, missing evidence and legacy unknown provenance remain distinct. |
| Authorization and execution | Read-only source and supplied CI logs; scratch-only Node production-module probes and existing static verifiers. No local DB, migration, API, browser, application service, deployment or external executor was started. No product/method file was changed. |
| Evidence modes | Independent source inspection; actual Node execution with persistence/import doubles; actual input-integrity/migration-check execution; independent inspection and identity validation of authentic migrated-DB and architecture CI logs. UI source inspection is not rendered or accessibility proof. |

I did not author the product repair, the tests in the repository or profile v3. I received the named finding, author evidence and source pins, and read the previous receipts, so independence does not mean blindness to author context. Root is the disclosed maintainer/implementation author and second grounding member; that contribution is not counted as another independent vote in this member receipt. This review does not replace QA, Security, Purple, Graph or White.

The scope is a delta from the previous native review, not a new assertion that all eleven profile contracts or 49 broader journeys were re-executed. The runtime production changes in this delta are one backend repository, the frontend API types and two existing frontend pages. Native Legacy, MCP and database transaction owners retain their earlier bytes. The full source tree still binds all inspected dependencies.

## 2. Repair traced through actual native owners

Source references in this section are relative to the immutable checkout; **B** means `Tesbo-Backend-Nest`, **F** means `Tesbo-Frontend`.

| Boundary | Directly inspected behavior and consequence |
|---|---|
| Authoritative dispatch transaction | `B/src/behavior-graph/model-studio-repository.ts:574–595` calls `DatabaseService.transaction` and passes the same client into dispatch. The existing model/revision/approval, mapping and case gates remain before native creation. |
| Existing native producer | `B/src/legacy/legacy.service.ts:7017–7033` accepts the supplied client rather than opening another transaction. `insertApprovedCycleItems` at approximately `7440–7500` retains the Approved-only policy, project check and native reviewed snapshot. Native insertion remains the owner of item and execution identity. |
| Exact capture before publication | Repository `:751–798` queries the just-created native rows inside that same transaction, scoped by cycle and project. It records actual `cycleItemId`, `executionId` and `snapshotApprovalRevision` in each existing manifest case. Missing, invalid or non-unique required occurrence data, or an unexpected row count, rejects before manifest publication. The manifest does not guess identifiers from requested testcase IDs. |
| Rollback owner | `B/src/database/database.service.ts:73–97` commits only after its callback completes and attempts rollback on failure. The repair propagates capture/manifest failure through that owner; it does not depend on a later fallible deletion. The independent composition probe verifies client forwarding and callback failure, while the migrated test supplies actual PostgreSQL rollback evidence. |
| One shared read projection | Repository `:850–900` reads the manifest and scoped native rows, then matches model-run ID, cycle-item ID, execution ID, testcase ID and reviewed snapshot hash. `coverageForUser` supplies the same resulting evidence to both run counts and per-element outcomes. It does not reconstruct an occurrence from the current case or mapping. |
| Ambiguity and absence | `nativeOccurrenceFor` / `manifestCases` at `:825–848` reject missing/malformed pins and duplicate valid case/item/execution pins. Duplicate returned occurrence tuples are not arbitrarily selected. Valid pins with no matching active result are unavailable; unpinned/invalid provenance is UNKNOWN. Partial results retain all three counts. |
| Immutable versus current membership | `governedRunsFor` uses manifest membership for `caseCount`; only matching original active occurrences supply statuses. Later unrelated additions cannot inflate the dispatch count or supply a model outcome. Original removed items remain represented as unavailable, preserving existing exclusion of removed results from active model outcomes. |
| Ordinary native editability | Native `removeCycleTestCase` / `removeCycleTestCases` still soft-delete the original item/execution. `addCycleTestCases` still creates a new native occurrence after re-add. Those owners were not changed to prohibit a legitimate native operation merely to make a model projection simpler. |
| Historical native provenance | `runProvenanceForUser` now reports manifest count and pinned/unknown counts, under existing project access. Model mappings and original manifest element IDs remain the relied-on basis even after link changes. Exact historical reliance is not a link to today's mutable membership. |
| Consumer distinction | `F/lib/api.ts` carries the new counts and optional legacy pin. The Model Studio page shows original dispatched counts, unavailable/UNKNOWN states and exclusion of later additions. The native Run page says “originally dispatched” and explains later additions. Existing linked-case history is separately labelled “across native runs”; that broader history is not substituted for manifest-bound model outcomes. |

The new relation is an extension of existing `mbt_model_runs.manifest`, not another execution or result owner. A source census found the production manifest insert and its readers in this repository; no new mutable manifest update path or migration was introduced by the repair. That is an application-writer observation, not a claim that V154 contains a universal database prohibition on privileged SQL changes.

The reviewed snapshot comparison also refuses an observed native row whose snapshot digest no longer matches the original pin. It does **not** implement the broader immutable correction/attempt protocol or repair the privileged history-import writer. Native result editing remains native result ownership; this change does not freeze every result value forever.

## 3. Independent discriminating probe

I wrote `green-native-occurrence-delta-probe.cjs` separately from the author's repository tests. It transpiles and loads the actual production repository module using the installed TypeScript dependency. Nest imports and persistence/native-owner dependencies are explicitly controlled doubles. The exact module path and SHA-256 are printed in each log. No SQL is executed by the probe.

The same script and assertions were run twice, changing only `GREEN_OCCURRENCE_SOURCE_ROOT`:

| Source | Executed assertions | Result |
|---|---:|---|
| Original `9519b56d` | 24 | **2 passed, 22 failed**, process exit 1; failures retained. |
| Repaired `965a87a1` | 24 | **24 passed, 0 failed**, process exit 0; no skip/cancel/todo. |

These are 24 contract assertions, not 22 independent product defects. The original-occurrence positive control and the already-existing manifest-insert rollback behavior pass on both. The old source fails the replacement-attribution oracles and lacks the new pin/unknown/dispatched-count contracts. Assertions were not weakened after observing the repair.

The independently exercised cases cover:

- The legitimate original result in both status and element projections.
- A re-added same testcase with different item/execution; a different execution under the same item; a changed reviewed snapshot; a mismatched testcase; and a result under another dispatch.
- A later unrelated native member, removed original membership and an empty historical manifest.
- Missing legacy pins, malformed item ID, missing execution ID and missing review digest.
- Duplicate case pins, reuse of one execution or one item by multiple entries, duplicate result tuples and duplicate element labels.
- A mixed result with one attributed, one unavailable and one unknown manifest entry.
- Capturing actual returned native identity before manifest insertion; missing, ambiguous and invalid occurrence capture aborting the shared composition; manifest failure propagating through the same transaction.

Every projection check also verifies that its supplied manifest object is unchanged. The transaction double checks actual client identity and failure propagation, but its staged/committed counters do not themselves prove database atomicity. That stronger claim relies on the source transaction boundary and actual migrated evidence below. The source queries' project/cycle predicates were inspected directly; mocked query results are not proof that PostgreSQL executes those predicates correctly.

## 4. Authentic CI evidence independently inspected

### Migrated database

I read `/workspace/scratch/fb086055b433/tesbo-ci-evidence/965a87a1/database.log`, SHA-256 `755f8d2dc9e42e095ab453b3fa0562a9d57d14297232e974fd90871a91996094`, job `136061368514`. It prints merge `e49fab4d`, selects the actual `model-studio-runs.db.spec.ts` alongside sixteen other suites, reports that suite PASS, and finishes **17 suites / 611 tests passed**. Git independently proves this build's tree equals the reviewed source.

I inspected the changed database test bodies and their suite enablement. They run only against the disposable `tesbo_ci` database; the successful log contains no suite skip in the 611 total. The two new scenarios are actual production-owner interactions with persisted readback, rather than rows manufactured to stand in for the main lifecycle:

1. Create/review/map/dispatch through actual model/native methods; record an original pass; remove native membership; edit and explicitly reapprove the case; add a replacement and an unrelated case; record their real native passes. Assert distinct new item/execution IDs, no inherited model-element attribution, original dispatch count and unavailable state, separately scoped linked-case history, unchanged full manifest and original reviewed snapshot, and retained soft-deleted original result.
2. Create a real ordinary native run/result, then insert an explicitly labelled historical **unpinned fixture**. Its projection stays UNKNOWN while the genuine pinned dispatch retains its initial native status. This proves the legacy reader branch; it is not a claim that a real historical customer row was migrated or that the fixture establishes historical provenance.

The same passing migrated suite includes an actual failed manifest write whose database effects must roll back, followed by legitimate governed and ordinary native runs. External notification/index/cache effects are stubbed where the suite declares them. It is therefore database/domain lifecycle evidence, not email, external integration or browser proof.

### Existing architecture component

I read `architecture.log`, SHA-256 `14535aa6b1695d6b32ed3d44d1913cd9628f5d7f7f1969b8f0ca57764f72b33f`, job `136061368312`, at the same merge checkout. It reports **114 quality-tool tests passed** and **780 modules analyzed, 0 forbidden edges**. This is the declared static import component, not the unbuilt Graph Assurance harness or a semantic owner-fit proof.

The parent reported further HTTP/concurrency and smoke progress. I do not turn those progress messages into an inspected terminal result in this receipt. In particular, the new Model Studio API/browser lifecycle and screenshot evidence remain pending at this cutoff. Earlier `6d921151` Model Studio 18/18 results cannot certify the new 19-test source.

## 5. Declared Green binding and semantic reconciliation

I inspected the unchanged `check_native_review_trace.py` and the v2→v3 profile changes, then executed the adapter independently against the exact new Git source and original canonical directory. Result `green-native-occurrence-binding-result.json`: exit 0; **11 declared contract rows, 41 source hashes and 8 canonical hashes**, with all four seeded negative controls rejected: removed required row, wrong source hash, undefined canonical identifier and missing consumer edge.

The checker is `tesbo-native-review-trace/1.0`, SHA-256 `e3116e8b77350d3a3670a9a5bb4e9f36778ffd30714c4d0872ea39b23b9ce9ed`. Profile v3 is SHA-256 `09c507633a46ecd38eaf86d41665d1c8dc0c61d3d9ecb37e22a9a521d85d3875`. Its bytes remain unchanged as later CI evidence arrives. It explicitly reports semantic, runtime, full-scope and Graph verification as false.

The v3 source inventory correctly adds the native Run page as an affected N11 consumer and binds the revised backend, API, UI and test bytes. N11 includes unit, migrated DB, API and UI proof paths, and is `source_verified` with its runtime/reviewer gate stated. That is suitable for the profile's creation cutoff; a later receipt can credit actual runtime without retroactively rewriting the profile.

The prior N07 correction survives intact: P-05 owns canonical KB identity/versions; FR-095 owns semantic JSON change and review/index consistency; FR-096 owns serialized edit/restore/history; T-438 is their native repair task. I read those original clauses and the backlog row. V3 does not reintroduce the earlier incorrect R-ASE-04/R-ASE-37 mapping. N11's MBT-C-05 / FR-048 references are appropriate for the narrow exact native occurrence and retained original-provenance invariant, **not** evidence that their complete step-attempt, correction, deletion/retention or accepted mapping-history contracts are implemented.

I also ran the existing migration checker on this exact checkout: **157 nonempty SQL migrations, 154 existing migrations unchanged against development `6897f989`**, exit 0. That is inventory/append-only checking, not an executed migration or rollback rehearsal. The new architecture CI supplies the existing import-check component separately.

The binding remains intentionally limited. It validates its declared denominator and textual IDs; it cannot prove that every required contract was declared, every trace is semantically correct or every proof file executed. Historical N01–N10 runtime references retain their original scope, as v3 explicitly says. Formal Green still requires actual two-member semantic reconciliation; a profile pass never overrides a failing invariant.

## 6. Mandatory second-order questions — current delta

| Green question | Source-grounded delta conclusion |
|---|---|
| 1. Sibling capability | Native editable runs, model-dispatched runs and later linked-case history share the same underlying cases/results but need different membership/time scopes. The repair preserves those distinct consumers. |
| 2. Common substrate | The repeated invariant is exact relied-on identity plus current access and explicit missing evidence. Subject ID, native occurrence and reviewed definition are separate facts. |
| 3. Architectural compression | One shared `governedRunEvidenceFor` feeds both model rollups. It removes two opportunities to resolve current membership differently without creating a new execution store. |
| 4. Adjacent-category scan | Existing native snapshots, source captures and immutable review receipts supply the relevant pattern: later material with the same subject/name is not the historical material relied on. No external product parity or researched commercial claim is introduced. |
| 5. Platformization boundary | Extending an existing manifest is earned by two actual projections and native provenance. A generic graph, execution platform or approval registry is not earned by this bug. |
| 6. Option value | Preserving exact native identity now keeps later provenance inspection possible and prevents irreversible ambiguity. It does not pre-approve a future report/attempt schema. |
| 7. Prematurity | Repair the current dispatched-occurrence edge now. Full step occurrences, dataset/role attempts, immutable corrections and original external reports remain separately admitted work. |
| 8. Spec/code reconciliation | The original MBT/FR clauses, subordinate owner/design/plan, actual source, V154/V155, frontend types/pages and tests were consulted. The existing review record and FEATURE_DOCUMENTATION contain the new repair status; no new normative specification is needed. |
| 9. Business value | Trustworthy attribution and explicit unavailable history reduce misleading QA conclusions. No measured revenue, savings, latency or capacity guarantee follows from this review. |
| 10. Cross-role/channel continuity | REST/MCP dispatch continues to use the shared repository/native owner. API and both UI projections consume the same relation; neither the user interface nor an actor display label becomes result authority. |
| 11. Hardest/opposite sibling | Ordinary native removal/re-addition remains legitimate. Making all governed runs immutable would evade that sibling; instead, the later result remains valid natively and excluded from the old model basis. |
| 12. Orthogonal axes / brand deletion | Removing the Model Studio name still leaves subject, exact native execution, reviewed snapshot and derived projection. Those identities earn a relation, not a branded domain. |
| 13. Participation scope | Native execution is primary result truth; dispatch is historical reliance; model coverage is projection-only; linked-case history is a separate cross-run view. Reusing the same records does not make those scopes interchangeable. |

**Reasoning contract generalized now:** a consequential historical consumer must retain the exact occurrence/definition it relied on and explicitly represent missing/unknown evidence. **Additional shared runtime/storage extraction now:** not justified. The three existing consumers earn the narrow shared projection; they do not earn a universal artifact system. A new source-free external task/report loop remains W-OWN/I3-Q work, not a relabelled native run.

## 7. Relationship and UI completeness

The repaired edge has a concrete typed meaning: one model dispatch references each originally created native item/execution and its reviewed snapshot hash. The native owner creates those identities; the manifest records their historical relationship; one native cycle has the existing unique model manifest. The edge is project/cycle scoped, preserves original element mapping, and is read under current access. Removal can make its active result unavailable without replacing the edge. Re-add creates a separate legitimate native occurrence. Legacy absence remains unknown.

Rejected alternatives are concrete: resolving by testcase ID still aliases later occurrences; counting every current native member changes dispatch meaning; silently backfilling legacy pins invents history; copying native result values into a new model result store creates another authority; prohibiting ordinary native editing changes the legitimate neighboring workflow. None is necessary for this repair.

For UI reuse, this is **EXTEND** of existing Model Studio and Run provenance, with **KEEP** for native run editing/navigation and the existing linked-case history list. No new modal, editor, approval surface or design system was introduced. Source distinguishes known unavailable originals, unknown provenance and later native membership. I did not inspect authentic new screenshots or execute the UI, keyboard, responsive or AT journeys. Full visual-parity and usability claims remain with actual Purple/QA evidence; source labels alone cannot close them.

## 8. Sign-off boundary and handoff

| Claim | This independent member's disposition |
|---|---|
| Original occurrence can still supply its real native result | Accepted in independent production-code probe and received real migrated lifecycle. |
| Later replacement/unrelated native results inherit the old model basis | Refused by the repaired source/probes and real migrated lifecycle; the original High mechanism is no longer reproduced. |
| Legacy/missing/ambiguous identity is guessed from today's membership | Refused by source/probes; the real DB legacy fixture stays UNKNOWN. |
| Shared transaction/native owner is retained | Accepted at inspected source and composition probe, with actual migrated rollback/positive-neighbor evidence. |
| V3 target binding is declared, executed and independently reviewed | Accepted for bounded input/trace integrity and its explicitly limited static components. |
| Current API/browser terminal and authentic UI evidence | Pending at receipt cutoff. Do not substitute old source results or authored test names. |
| Formal two-member Green native readiness | Pending root grounding/reconciliation and applicable terminal evidence. This member receipt does not self-complete quorum. |
| Full original QA loop, seven-domain implementation, S0, full history, architecture freeze, merge/deploy | Not claimed; retained gates remain. |

A later actual CI/evidence delta should be a separate addendum with its own hash, preserving this cutoff. It must read the completed 19-test Model Studio selection and any relevant remaining native stages at the same source/build, including the new lifecycle and actual unavailable-provenance UI result. A new source requires an explicit byte/consumer delta assessment, not automatic inheritance of this verdict.

## 9. Artifact hashes

All supporting files are under `/workspace/scratch/fb086055b433/assurance-working`, except the CI logs identified above. The companion input index records 48 exact file hashes and command scope. Its inclusion of a file hash is not an assertion that every line of that file received exhaustive semantic review.

| Artifact | SHA-256 |
|---|---|
| `green-native-occurrence-delta-probe.cjs` | `e1a8dfc659eb6964ee9412b0dfe6544007c7e3affa4f97e01d8f9ef051619144` |
| `green-native-occurrence-delta-probe.log` | `c49675ff3ccb3337b205d1546d996830a6e5b04426d86bc33781d8fe6326ce17` |
| `green-native-occurrence-delta-before.log` | `5b5ca45256d17672e23dbc4b5c78035fb1cdb1fa56546d8d7acd5ac190ae8dd5` |
| `green-native-occurrence-binding-result.json` | `7cb1b77ad179f717824405a3917880594224302ee4471b3d85b0d623027f5315` |
| `green-native-occurrence-migrations.log` | `4c5fc30013aa0ab07a01029afa37240ed97d865833a2a187340db1523dc0cbfc` |
| `green-native-occurrence-delta-inputs.json` | `afd4f1814ff04f6243ad7bdad0377edd889279bd5b5aa0794d19e5df4001f644` |

**Independent sign-off:** I accept the bounded source/database repair and v3 binding described here, with the remaining runtime, quorum and broader-scope gates explicitly retained. I make no completed browser, full-product, merge or production-readiness claim.
