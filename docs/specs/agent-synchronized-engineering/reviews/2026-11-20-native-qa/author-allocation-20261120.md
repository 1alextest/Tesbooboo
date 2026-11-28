# Native QA continuation — current engineering allocation

Author: `/root`, the current implementation coordinator and author of this allocation. This is author grounding, not an independent review or a claim to have authored/deployed the previously merged code. Date: 20 November 2026. Scope: the existing I3 manual QA path and I3-Q external QA loop. Product authority remains the eight canonical v1.4.34 specifications. No new product, normative specification, methodology or authority is created by this record.

## 1. Exact current state and decision

PR167 and PR168 are merged. The inspected development commit is `1fe100588be6c3a1627ee39a4b0bbc1c0d9da2ea`, tree `390058d78ef0175b729570f75c66320a5895f3ed`. An exact, clean 1,224-file checkout is retained at `tesbo-qa-baseline`; implementation takes place separately in `tesbo-qa-loop`. Open PR169 changes the semantic assurance specification; it is not a second implementation of this flow, nor merged authority for this increment.

I select the existing Blue candidate **A** for the external allocation: preserve `ai_generation_requests` as the sole native TASK identity and extend it with immutable kinds and narrowly owned child facts. Native Run retest remains at `cycles`/`cycle_items`/`executions`. These are distinct subjects, not two competing task or attempt registries. This engineering choice is submitted to the actual current Blue/Red/White admission sequence before external physical allocation.

`allocation-source-freshness.json` compares all 59 source/instruction/manifest files used by the earlier concrete Blue allocation against current development. **58 are byte-identical.** The only changed input, `Tesbo-Frontend/lib/api.ts`, adds Model Studio occurrence provenance fields; its task/API contracts are unchanged. The retained diff is independently inspectable. This is source freshness, not a runtime test, a claim to have inspected every deployed consumer, or certification of the current whole tree.

## 2. Why these owners

The capability is a bounded job that can precede any testcase, a record of what a particular installation received and reported, an analyst interpretation, and exact human-selected effects in existing native domains. Intent, authority, observation, interpretation and commitment are separate facts. Removing the UI/product/agent names does not change those distinctions.

| Capability | Existing owner and current maturity | Decision and boundary |
| --- | --- | --- |
| Human case authoring and exact approval | Native testcase writer, versions and V155/V157 approval controls; source-inspected implementation | Reuse. Do not require a model, repository or model key for ordinary manual authoring. |
| New manual Run and case snapshots | Native cycles/items/executions and approved-case admission; source-inspected implementation | Extend with an immutable retest creation receipt, leaving result authority and future correction work at the same native owner. |
| Current generation/review task identity | Legacy/Agents and `ai_generation_requests`; source-inspected implementation | Extend with explicit immutable kind. Preserve UUID, TASK sequence, current legacy contracts and legitimate generation. |
| External dispatch responsibility | Not represented by an existing current external producer/assignment/report contract in inspected source | Add owner-bound prompt/analysis revisions, assignment, attempt and report relations. They have independent cardinality and constraints; none becomes a second work-completion root. |
| Installation/credential/consent | `agents`/`actors`, `api_tokens`, project MCP settings; source-inspected partial fit | Extend the actual roots. Runtime brand, issuer, shared MCP actor and rotating token are not installation identity. |
| Report bytes | `attachments` and `StorageService`; source-inspected partial fit | Extend attachment custody and create-only report-object operations. An editable KB document, legacy run report or dummy execution is not original evidence. |
| Proposed effects and human publication | Existing proposal root, exact V157 snapshot/save and native case writers; source-inspected partial fit | Extend stable operation/submission/decision/commitment facts there. Use same-client native adapters for supported mixed effects. |
| Effective Skills | Governed guide/document responsibility is specified; current AI-memory review is a narrower implemented pattern | Resolve at the existing governed guidance/version owner after its authority admission. Do not rename AI-memory approval into Skill assignment or silently enable the current preview. |

Reuse unchanged fails for external creation because `aiGenerate` needs an AI allocation and schedules provider work; the automation result path needs a native case and Run. Composition alone cannot give mutable generation payloads immutable original/report identity. Extraction B could be coherent with a single shared-PK root, but still needs every authority/report/apply extension and additionally migrates root ownership, sequences, FKs and all legacy joins. No required invariant currently demonstrates that extra root move is necessary. A new parallel external task system would duplicate identity, authorization, navigation and review. Reconsider A only on a concrete counterexample showing its typed constraints cannot preserve a required invariant.

## 3. Native manual retest: bounded implementation now

The next usable native flow is ordinary manual case authoring and exact approval, an observed native execution with result/evidence/defect, then **Retest selected cases** in the existing Run UI. The retest creates a fresh manual Run and fresh native items/executions, initially Untested. It does not write `Retest` to the source, reopen an automated Run, copy evidence as new proof, copy a model dispatch manifest, or infer that a linked Bug failed a new execution.

Current cycles metadata has no suitable immutable typed lineage. Automation `external_id`, mutable description/tags and imported `executions.history` have other meanings. A nullable immutable retest creation manifest, parent cycle reference and request-key/digest fields belong on the destination cycle. The manifest pins source cycle-item/execution identities, source reviewed snapshot and result **as observed when this retest was created**, prior evidence references, target environment/build intent, and the new native execution/approved-definition pins. It is a receipt, not a second status owner. All old/ordinary runs retain null lineage. A same-project FK, uniqueness, all-or-none shape and immutable binding enforce the boundary.

Preview resolves the selected actual occurrences and current exact Approved definitions. Create compares that fingerprint after serialization/current-authority checks and runs the existing native creation cores in one transaction. Any mixed invalid, stale, unauthorized or unapproved selection refuses before creating a Run. Identical request replay returns the original receipt; changed input under the same key conflicts. The UI persists pending intent before POST and uses readback after uncertainty. Later Run membership edits cannot rewrite the original receipt to refer to a replacement occurrence. Public Run sharing keeps its existing narrow projection and does not automatically expose source-private lineage.

This implements one distinct new-run retest flow. It does not claim the full T-428 logical-attempt/result-event model, T-424 correction journal, per-action assertions or historical reconstruction is finished. Those retained requirements cannot be satisfied by relabeling the current mutable execution row or its imported history.

## 4. External A allocation selected for admission

The detailed finite census and physical cardinalities are the existing `blue-i3-allocation-delta.md` §§4–8, rebound by §1. The selected responsibilities are:

| Subject | Constraint and authoritative transition |
| --- | --- |
| Native task root | Immutable `legacy_generation_review`, `external_qa_work` or `governed_proposal` kind; same UUID/project/seq. Generation-only values are inapplicable for external work, with explicit conditional checks rather than invented defaults. External work revision/state is not `task_status` or proposal revision. |
| Prompt/analysis revisions | Typed immutable task-owned content envelope; unique task/type/revision; digest and exact source refs. Prompt and analysis have different schemas/visibility. Current prompt pointer is task-owned. |
| Installation | One existing agent/actor identity per installation, separate from vendor/model and shared transport actor. Explicit organization/owner/current project grants. Deactivate instead of deleting relied-on attribution. |
| Credential | Existing project token binds to installation with explicit action ceiling and expiry. Nonsecret historical attribution survives rotation/revocation; current token existence and consent remain mandatory for each command. |
| Assignment and attempt | Separate owned relations: unclaimed assignment may exist; one assignment can have sequential attempts. One active task authority. Task lock precedes assignment/attempt/report locks. Claim creates a unique fence; heartbeat cannot revive an expired fence. |
| Original report | Owner-bound pending receipt, immutable finalized body/manifest, one primary per attempt independent of request key, explicit manual/supplement meaning. Finalize and cleanup serialize on the same owner. Received evidence does not certify target execution. |
| Report artifacts | Existing attachment metadata with checked same-project report ownership. Full bytes/digest and exact create-only object identity; no fake testcase/run/file catalog. |
| New retest | A new task root, prompt, assignment/attempt and original receipt, with exact parent report/finding references. Resume is a distinct fenced continuation, never a replacement original. |
| Proposed effect | Existing proposal root plus stable operation identity, immutable submission and human decision, and once-only native commitment. Task can have several proposal batches. Old positional Save remains a guarded legacy contract. |

All old generation producers, workers, failure handlers, feedback/edit/delete/close/save aliases, history/metrics/list pagination, chat streaming/references, archive sweep, notifications, ticket comments, TASK resolution, UI caches and proposal snapshot triggers must be explicitly kind-safe **before** external producers are enabled. A board-only filter is insufficient. The original census identifies each concrete family. Existing external-proposal/chat/sweep rows remain legacy generation/review; no false historical adoption or inferred assent.

Machine authorization resolves current membership and role against the token's bound project/organization. It must not depend on the issuer's last active browser workspace. Human UI navigation retains its current workspace rule. Recheck token/grant/installation/current project authority after waits, and deny revoked or reassigned authority without rewriting historical attribution. Narrow executor/analyst grants do not acquire native result or human publication powers through an issuer ID.

## 5. Evidence, adapters and rollout boundaries

Raw authorized observation intake has its own authority. A missing governed authoring Skill blocks the affected proposal/promotion; it does not turn permitted original evidence into a case or discard it. Conversely, observation permission does not grant proposal publication.

Use the existing storage owner in an explicit create-only report mode. Local exclusive creation can be implemented/tested with full-byte digest readback. S3-compatible immutable mode must stay unavailable until conditional creation and immutable-generation read behavior are actually proven for the configured driver. Never fall back to ordinary overwrite, length-only HEAD or an unreauthorizing signed URL for protected reports. Existing ordinary storage remains unchanged.

Reservation/primary identity, upload generation, ready/finalized/abandoned states, current fence and private byte readers must be concrete. Quota reservation belongs to the existing storage-plan owner and must cover competing ordinary writers before claiming a hard global concurrency guarantee. Finalize and mandatory audit commit together; cleanup cannot delete finalized/held bytes. Exact temporary cleanup and retained-data handling follow the already selected synthetic pilot policy; no real-project classification, legal retention, region or scanner-failure policy is invented here.

Selected mixed publication must compute a dependency-closed plan, lock and recheck exact native bases/current authority, and use one database client for native writes, audit and commitments. Reusing public `createBug` inside an outer transaction is insufficient because it starts a separate transaction. Extract its bounded same-client core rather than add a Bug store. Unsupported native result/correction or requirement/policy/KB adapter causes pre-write refusal of the affected selected set; it is not silently omitted. Copy-only text produces no tracker/native write. After-commit side effects use existing idempotent receipt/notification/comment owners and remain pending/failed until delivered.

Stage schema/readers/denials before enabling producers. Existing IDs/receipts remain readable. Once new kinds exist, rollback means disable new producers while retaining a compatible read/deny binary; it never means deploying an old untyped reader or dropping new original/history data. No blanket deployment or real customer mutation is authorized by this allocation record.

## 6. Authority and evidence that remain explicit

- Current case-free task, original report, external analysis and new retest runtime do not exist at the inspected base. Source ownership is not live proof.
- Protected Skills bootstrap/root replacement/recovery remains human-controlled and must bind to the actual authorized governance decision. This record does not choose a root authority, self-assign a candidate, grant emergency privileges or enable the preview flag.
- PD-01 project human review/merge grants remain settled. That rule does not silently authorize platform Skill root operations or real-project data governance.
- Actual ChatGPT authentication/full image consumption, executor driver access and target permissions are executable client/target gates. CI protocol tests are necessary but cannot be called a genuine external-client session.
- Existing UI source must be reused; source inspection alone cannot certify visual parity, keyboard/zoom or actual successful navigation. New manual UI and its API will receive actual isolated CI evidence at the exact candidate source.
- The native manual increment and external allocation can progress independently at their existing owners. The original I3-Q milestone closes only after the whole task-to-selected-publication loop is implemented and exercised; observation intake alone does not close it.

## 7. Current assurance accounting

New independent Blue and Red reviewers receive the outcomes, unchanged charters, exact current source and canonical specs. Their initial scenario/reconstruction receipts are frozen before reading prior diagnoses or this author's selected allocation. The informed deltas and actual author grounding are separate records. White adjudicates the specific allocation using those actual receipts. No paper receipt substitutes for database/API/UI/driver evidence, no team vote is invented, and no user continuation confirmation is needed to perform this already authorized engineering work.

The unchanged methods are pinned to `NesberryEnterprise/Nesberry@d83549c85a4dcd047fb40dc4fba4ec62737ab0fc`. Their principles apply using Tesbo actors, states, policies and runtime, not Nesberry business rules. The source-to-current comparison and this author decision have no effect on prior frozen reviewer findings; those remain historical evidence at their own pins.

## 8. Current author clarification: kind is not a governance exemption

The new Red challenge identifies an important cutover distinction. `legacy_generation_review` is a representation/compatibility kind; it is **not** an exemption from a required effective-Skill or protected-publication policy. Keeping current generation/chat/sweep producers on that shape does not authorize them to remain a weaker alternate publication route once governed authoring is enabled.

The cutover unit is the affected project/capability and its authoritative writer policy, not which UI/API/MCP route or row kind the caller chooses. Before enabling new governed authoring there, inventory and converge native generator, chat streaming/regeneration, sweep, external staging, model-generated case proposals and every protected promotion/Save alias on the same server-owned applicability and effective-guidance check. Caller labels cannot turn a required method into optional context. Current policy must be rechecked after locks and against the exact submitted content; assignment/version/digest consumption is bound to the immutable reviewed revision. No new route may write native protected effects by passing the issuer user ID.

Existing immutable historical receipts remain readable with their actual historical provenance. A historical or pending legacy batch lacking required consumed guidance remains honestly unknown and cannot gain that claim retroactively. At governed promotion, it must be refused with a specific migration/review action, or explicitly adopted into a new immutable governed submission using current required guidance and a new exact human review. Adoption retains the original batch/snapshot reference, fences its old mutation/Save route and permits only one authoritative writable successor. It never fabricates an earlier Skill read or previously approved logical operation mapping.

Legitimate ordinary human Draft authoring keeps its existing authorization and workflow where the actual project policy permits it; it cannot impersonate machine consumption or exact governed promotion. Existing legacy generation controls are preserved as positive compatibility tests for supported uncutover behavior and for properly guided/adopted behavior after cutover. They are not a perpetual route around v1.4.34. If any affected producer/promoter cannot satisfy the shared guard, the governed capability remains disabled at that boundary until its adapter is ready. Raw authorized original evidence and manual native retest remain independent permitted capabilities.

## 9. Evidence changes between decision and apply

Exact payload/native-base hashes alone cannot protect a decision when a linked retest supplies contradictory evidence after review. Each governed operation submission therefore binds its explicit relevant task/report/finding inputs and their current evidence-context revisions at the existing proposal owner. Finalizing a primary/retest/supplement report advances the relevant task-owned evidence context and invalidates affected open decisions through those explicit same-project links; it does not edit an original report or require an analyst to voluntarily change the proposal payload. New potentially relevant linked evidence initially means review required, not an automated inference that the old decision was false.

Apply locks/rechecks the selected operation's evidence-context bindings together with its exact submission, native bases and current authority. A changed relevant context refuses the affected selected effect before any native writes. A current authorized human may record an exact, reasoned unaffected/relevance disposition and review the current submission/context again; neither an executor label nor an arbitrary analyst flag preserves an old approval. Already committed effects remain historical commitments and require an explicit follow-up/correction if needed.

Scope remains causal: an unrelated task/report, an unrelated project, or a supplement explicitly reviewed as immaterial does not invalidate every project proposal. The relevant relationship and its current disposition have one owner and are part of the review fingerprint. This binding is an apply-enable obligation within A, not a new global evidence registry. Its discriminating proof is a report finalized after approval and before apply with unchanged proposal/native hashes, paired with an unrelated-report control.
