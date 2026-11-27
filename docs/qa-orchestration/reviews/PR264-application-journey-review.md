# PR #264 application journey review

**Scope and evidence.** This record follows two connected pieces of existing Tesbo behavior from the normal user controls to the decision or external recipient. Source observations use `development@97ce6b18143a62bc377f9dd7dd671fe92456d546`. The candidate entering this amendment was `3d09b0a28d0ca9d8f8095c0ade58b348df73bad9`. The [PR assessment draft](../PR_CHANGE_RECONCILIATION_DRAFT.md) owns the proposed integration, the [earlier review](PR264-20261125-coordinator-charter-challenge.md) retains its original evidence, and the [Tesbo review procedure](../../agent-scope-discipline.md#show-the-application-journey-in-the-existing-review-record) owns the local handoff. This is a bounded source review. It makes no production, acceptance or freeze decision.

## How the previous review missed the path

Principle 2 already required following an action through authorization, persistence, jobs and consumers. The earlier record called out unresolved task ownership in B-02. Its Grey section labelled the journeys conceptual, and its admission section kept implementation readiness open. The record did not join the ordinary button's payload to the generation writer, its context reads, the saved task, the human's available actions and their downstream effects. Separate valid observations about Tasks and Zyra could coexist with that gap. Those records establish where proof stopped. They do not establish what any reviewer privately considered. [Tesbo principles, lines 16–18][principles] · [Earlier review, B-02 and admission](PR264-20261125-coordinator-charter-challenge.md)

The portable method already assigns Blue existing-owner discovery, Grey the critical journey and White evidence reconciliation. The Tesbo procedure adds a place in the existing review record to expose missing joins before claiming that a particular application journey is understood. Canonical method ownership stays with Nesberry. [Orchestration][method] · [Grey inventory and evidence tiers][grey] · [White admission][white]

## Member requests cases and a reviewer closes or saves

**G1_CODE_GROUNDED for the existing path.** A QA member with project access enters a story, context, acceptance criteria and selected Knowledge Base items on Agents → Tasks. The form also submits the configured count. The client posts to the project Zyra tasks route; the controller calls `aiGenerate`. The service checks access, active model allocation and the generation capability, derives the configured range, inserts an `ai_generation_requests` row and starts background generation. A second entry exists on Requirements. Generate/Regenerate from a ticket refuses when its coverage read is unavailable. Otherwise it sends provider-specific Jira/Linear keys or a Notion page ID to the same writer and navigates to Tasks. A ticket-keyed request and a hand-written story therefore need separate context tests. [Tasks entry][new] · [Requirements entry][req] · [Client transport][api] · [Controller][controller] · [Generation writer][writer]

The worker rereads the task and model allocation, reads story, acceptance criteria and feedback, then gathers project knowledge, provider snapshots and existing test cases for the model. A guarded update persists the drafts and moves the row to review only from the eligible state. A late generation return after the task changes has its own branch. This path explains why an assessment requiring a blind first pass needs its own restricted input contract. Inspecting the PR alone cannot establish what an ordinary Zyra invocation saw. [Worker reads][inputs] · [Persistence and late return][finish]

On a fresh load the board selects up to 50 recent non-chat task rows by project and agent. The detail endpoint rereads by project and task. The detail page offers different handlers for requirement, document and case proposals. A human can close an ordinary task without saving further drafts. A selected-case save binds the human session, expected revision, selected indexes and resulting native case changes. Its transaction records the reviewer's identity, accepted operations and remaining drafts. A lost response can be recovered from the original decision receipt. A card outside the current window, “Done,” a saved case, and an executed Test Run each answer a different question. [Board query][board] · [Detail read][detail] · [Requirement and document controls][controls] · [Case save and close controls][casecontrols] · [Close][close] · [Decision and replay][decision] · [Case receipt][receipt]

**Proposed application and controls, G0_SIMULATED.** FR-115/T-455 identifies the change. General assigned follow-up belongs to Work Package C and typed proposal review retains its native owner. A QA lead must be able to assign source-free manual work when the project has no model allocation. A valid configured generation request from Tasks or Requirements must still produce reviewable drafts. Closing the task without saving must leave the case collection and current-build Run evidence untouched. A claimed complete change view must still find a linked task outside the board window or explicitly report its inaccessible scope. These are acceptance oracles for PJ-04/05/08/12 and PRR-03/16/21. Execution is **NOT RUN**.

**Concurrent editing in Tasks.** Today ordinary draft Edit/Delete addresses an array index. Locking the task serializes writes yet permits an earlier deletion to shift which draft that index denotes. The activity entry records a title and actor. Require a stable item identity and the expected proposal revision on edit/delete as well as final selection. Expose exact per-item outcomes of partial bulk operations and the stored change on reload. A conflict can offer an authorized refresh, diff and intentional resubmission. Preserve the original actor, target and input revision on refused attempts. [Draft mutations](https://github.com/1alextest/Tesbooboo/blob/97ce6b18143a62bc377f9dd7dd671fe92456d546/Tesbo-Backend-Nest/src/legacy/legacy.service.ts#L23274-L23355).

## One member saves, another retries external delivery

**G1_CODE_GROUNDED for the existing path.** Consider two project members. Member A authorizes the selected native case save. Saving a newly created case records a Draft. A later formal case approval can belong to a different person. Member B later handles a failed ticket comment. The records available to them have different meanings.

| Step | Existing owner, effect and evidence |
| --- | --- |
| A accepts selected cases | The human-gated save commits the selected case operations and A's save receipt. Post-commit processing invalidates caches, enqueues embeddings, queues ticket comments for the actual touched rows and can notify the requester. A replay returns before those hooks. [Decision and replay][decision] · [Receipt][receipt] · [Post-commit consumers][hooks] |
| Tesbo processes linked tickets | Each linked provider/issue group consults project auto-comment settings and connection state. A claim keyed by task, save event, provider and issue records `pending`, `skipped_disabled` or `skipped_not_connected`. A pending claim invokes Jira, Linear or Notion. Provider success/failure updates the claim separately from the case transaction. A pre-claim error can leave no delivery row despite a successful case save. [Claim and setting][claim] · [Provider dispatch][send] |
| B opens the task and retries | The task detail reads the delivery ledger, polls while a comment is pending and can retry a failed row. Its initial list-read error falls back to an empty array. The retry service checks project access, claims the failed row, replaces `posted_by` with B and rebuilds content from current case titles, omitting deleted cases. A's native save receipt is the source for the original decision. The current delivery row identifies neither the entire attempt history nor byte-for-byte content A reviewed. [Visible read and retry][retryui] · [Delivery read][list] · [Failed-row retry][retry] |

**Proposed application and controls, G0_SIMULATED.** A reviewer who accepts an assessment report authorizes that report's disposition. Opening evidence, drafting, staging and accepting the report must produce zero case writes, ticket delivery claims or provider comments. A separate authorized native case save can trigger its configured side effects. Show the intended provider/audience when known, the save decision, the distinct delivery state and the authorized retry action. A failed or unavailable delivery read must remain distinguishable from an observed empty list. Preserve A, B, the provider connection/worker, attempt time, reviewed revision and actually delivered revision/content reference subject to access policy. Derive them from native events and receipts. Mark missing historical provenance unknown. This refines R-ASE-06/10, FR-119/123 and PJ-05/09/12. It does not introduce an external publisher.

Check a linked case with the setting on, a valid unlinked case, a disabled provider, and a failed delivery followed by a rename and retry by B. Compare case version, original decision, delivery attempt and destination, using authorized isolated fixtures. A provider failure leaves A's case save intact. After the provider accepts a comment but its acknowledgement is lost, an unknown delivery outcome requires readback or an explicit operator disposition before a second external send. A database claim by itself cannot establish exactly-once remote delivery. The shown retry path rechecks project access and a failed-row state. Proposed default: switching off automatic comments halts automatic sends and automatic retries. An explicit manual retry of a prior failure requires a separately permitted project policy, an active bound connection, the current member’s send capability and a reviewed destination and payload. Without that policy or with a disconnected provider, send nothing. Verify a permitted manual retry independently. A crash after the successful native case commit but before the first delivery claim has no failed row to retry. Recover the original eligible intent from durable native save/outbox evidence, check current policy, and prevent both duplicate cases and retroactive sends for saves made while automatic comments were disabled. [Native save and provider boundaries][test] · [Existing disabled and failure examples][testcases] · [Retry eligibility][retry]

**Destination identity at retry.** The delivery claim records provider and issue key. Jira send resolves the current project connection and Linear uses the current organization connection. Reconnecting to another provider workspace can redirect the same key to a different recipient. The current retry checks project access before claiming a failed delivery. Specify the native capability for external send and recheck the retrying member separately from task-read access. Verify zero claims and zero transfers for a reader who lost send eligibility. Bind and check the approved provider tenant and stable issue identity at both first send and retry, and preserve the destination actually used. Separately test permissible credential rotation within one authorized destination. [Delivery claim](https://github.com/1alextest/Tesbooboo/blob/97ce6b18143a62bc377f9dd7dd671fe92456d546/Tesbo-Backend-Nest/src/legacy/legacy.service.ts#L2036-L2052) · [Jira connection](https://github.com/1alextest/Tesbooboo/blob/97ce6b18143a62bc377f9dd7dd671fe92456d546/Tesbo-Backend-Nest/src/legacy/legacy.service.ts#L14821-L14830) · [Linear connection](https://github.com/1alextest/Tesbooboo/blob/97ce6b18143a62bc377f9dd7dd671fe92456d546/Tesbo-Backend-Nest/src/legacy/legacy.service.ts#L15512-L15520).

## Evidence limits and closeout

| Claim | Evidence and outstanding check |
| --- | --- |
| Existing source paths reach the described handlers, records and alternatives | G1_CODE_GROUNDED. Trace is pinned above. Existing unit examples mock both the committing transaction and provider calls. They document intended behavior across that boundary. The follow-up verification ran the existing ticket-sync suite against the pinned test source. Its 19 mocked tests passed. They exercise the handler contract and do not establish live delivery. |
| Proposed PR assessment, member attribution and governed Skill checks work end to end | G0_SIMULATED for the described scenarios. Outcome NOT_ASSESSED. No live member sessions, model trace, database readback, authenticated UI journey or external delivery was exercised here. G2_LIVE_OBSERVED and G3_ADAPTER_OBSERVED remain unclaimed. |
| All material product journeys or independent review teams have completed | Unestablished. This record covers the two linked journeys above and their identified entry points. The draft's PJ inventory, role receipts, complete critical-journey coverage and release/freeze decisions retain their own status. |

On a candidate or base change, recheck affected paths and their source anchors. Changes to the active Skill, role, repository grant, model configuration, generation capability, ticket setting or destination can invalidate a conclusion at the same source revision. Keep the historical trace, reopen its affected assertion, record the new authority/evidence and identify the role responsible for closing it. Blue and Grey own the entry and user action, Green the integration effects, Security/Red the authority and replay challenges, Purple the meaning on reload, QA the discriminating evidence, and White the reconciled claim. Unrelated source-free work may continue. Publish a claim at the level the evidence supports.

[principles]: https://github.com/1alextest/Tesbooboo/blob/97ce6b18143a62bc377f9dd7dd671fe92456d546/AGENTS.md#L16-L18
[new]: https://github.com/1alextest/Tesbooboo/blob/97ce6b18143a62bc377f9dd7dd671fe92456d546/Tesbo-Frontend/app/%28app%29/projects/%5Bid%5D/agents/tasks/page.tsx#L227-L247
[req]: https://github.com/1alextest/Tesbooboo/blob/97ce6b18143a62bc377f9dd7dd671fe92456d546/Tesbo-Frontend/app/%28app%29/projects/%5Bid%5D/requirements/page.tsx#L678-L705
[api]: https://github.com/1alextest/Tesbooboo/blob/97ce6b18143a62bc377f9dd7dd671fe92456d546/Tesbo-Frontend/lib/api.ts#L1489-L1509
[controller]: https://github.com/1alextest/Tesbooboo/blob/97ce6b18143a62bc377f9dd7dd671fe92456d546/Tesbo-Backend-Nest/src/legacy/legacy.controller.ts#L1679-L1682
[writer]: https://github.com/1alextest/Tesbooboo/blob/97ce6b18143a62bc377f9dd7dd671fe92456d546/Tesbo-Backend-Nest/src/legacy/legacy.service.ts#L22634-L22729
[inputs]: https://github.com/1alextest/Tesbooboo/blob/97ce6b18143a62bc377f9dd7dd671fe92456d546/Tesbo-Backend-Nest/src/legacy/legacy.service.ts#L22797-L22865
[finish]: https://github.com/1alextest/Tesbooboo/blob/97ce6b18143a62bc377f9dd7dd671fe92456d546/Tesbo-Backend-Nest/src/legacy/legacy.service.ts#L22890-L22928
[board]: https://github.com/1alextest/Tesbooboo/blob/97ce6b18143a62bc377f9dd7dd671fe92456d546/Tesbo-Backend-Nest/src/legacy/legacy.service.ts#L15952-L15965
[detail]: https://github.com/1alextest/Tesbooboo/blob/97ce6b18143a62bc377f9dd7dd671fe92456d546/Tesbo-Backend-Nest/src/legacy/legacy.service.ts#L16170-L16177
[controls]: https://github.com/1alextest/Tesbooboo/blob/97ce6b18143a62bc377f9dd7dd671fe92456d546/Tesbo-Frontend/app/%28app%29/projects/%5Bid%5D/agents/tasks/%5BtaskId%5D/page.tsx#L390-L419
[casecontrols]: https://github.com/1alextest/Tesbooboo/blob/97ce6b18143a62bc377f9dd7dd671fe92456d546/Tesbo-Frontend/app/%28app%29/projects/%5Bid%5D/agents/tasks/%5BtaskId%5D/page.tsx#L550-L602
[close]: https://github.com/1alextest/Tesbooboo/blob/97ce6b18143a62bc377f9dd7dd671fe92456d546/Tesbo-Backend-Nest/src/legacy/legacy.service.ts#L23368-L23392
[decision]: https://github.com/1alextest/Tesbooboo/blob/97ce6b18143a62bc377f9dd7dd671fe92456d546/Tesbo-Backend-Nest/src/legacy/legacy.service.ts#L23416-L23453
[receipt]: https://github.com/1alextest/Tesbooboo/blob/97ce6b18143a62bc377f9dd7dd671fe92456d546/Tesbo-Backend-Nest/src/legacy/legacy.service.ts#L23518-L23534
[hooks]: https://github.com/1alextest/Tesbooboo/blob/97ce6b18143a62bc377f9dd7dd671fe92456d546/Tesbo-Backend-Nest/src/legacy/legacy.service.ts#L23889-L23935
[claim]: https://github.com/1alextest/Tesbooboo/blob/97ce6b18143a62bc377f9dd7dd671fe92456d546/Tesbo-Backend-Nest/src/legacy/legacy.service.ts#L2011-L2071
[send]: https://github.com/1alextest/Tesbooboo/blob/97ce6b18143a62bc377f9dd7dd671fe92456d546/Tesbo-Backend-Nest/src/legacy/legacy.service.ts#L2278-L2308
[retryui]: https://github.com/1alextest/Tesbooboo/blob/97ce6b18143a62bc377f9dd7dd671fe92456d546/Tesbo-Frontend/app/%28app%29/projects/%5Bid%5D/agents/tasks/%5BtaskId%5D/page.tsx#L257-L350
[list]: https://github.com/1alextest/Tesbooboo/blob/97ce6b18143a62bc377f9dd7dd671fe92456d546/Tesbo-Backend-Nest/src/legacy/legacy.service.ts#L2310-L2334
[retry]: https://github.com/1alextest/Tesbooboo/blob/97ce6b18143a62bc377f9dd7dd671fe92456d546/Tesbo-Backend-Nest/src/legacy/legacy.service.ts#L2337-L2377
[test]: https://github.com/1alextest/Tesbooboo/blob/97ce6b18143a62bc377f9dd7dd671fe92456d546/Tesbo-Backend-Nest/src/legacy/zyra-save-integration-sync.spec.ts#L23-L32
[testcases]: https://github.com/1alextest/Tesbooboo/blob/97ce6b18143a62bc377f9dd7dd671fe92456d546/Tesbo-Backend-Nest/src/legacy/zyra-save-integration-sync.spec.ts#L123-L246
[method]: https://github.com/NesberryEnterprise/Nesberry/blob/6ba0692164198d30f0baf1a1537b2e0869bc79e6/.kiro/steering/teams/review-orchestration.md#L12-L15
[grey]: https://github.com/NesberryEnterprise/Nesberry/blob/6ba0692164198d30f0baf1a1537b2e0869bc79e6/.kiro/steering/teams/synthetic-user-journey-team-charter.md#L284-L307
[white]: https://github.com/NesberryEnterprise/Nesberry/blob/6ba0692164198d30f0baf1a1537b2e0869bc79e6/.kiro/steering/teams/white-team-charter.md#L25-L27

## Independent amendment review and evidence

The three source investigations covered current member authority, Skill delivery and the complete task-to-external-effect journey. Separate reviewers challenged the written amendment from QA/Red, a fresh application-reader perspective, Graph/QA, Security, Purple UX and Green implementation fit. A fresh design reader and a separate White-style reviewer then read the same corrected content. These are attributable design reviews. The formal project assurance process retains its own approval and deployment evidence requirements.

| Challenge | Result carried into the specifications |
| --- | --- |
| QA/Red and fresh application reader | Bounded external Skill-read claims, patch versus full step replacement, reviewer suite overrides, author-written expectations in the diff, stale index-based edits and changed external recipients. |
| Graph/QA | All 14 earlier findings mapped to owners and checks. Corrected the reachable direct-MCP publication baseline, refusal/settlement counts, replay and baseline-vs-treatment pilot test. |
| Security, Purple and Green | Current permission to send a comment, explicit transfer of an authorized checkpoint between clients, private sibling threads, and two observable evidence levels for external authoring. |
| Fresh design reader | Supported implementation planning for the bounded contracts. Two actual member sessions and the served methods, committed revisions, reviewer and downstream effects still need demonstration. |
| White-style admission review | Read-only, single-source shadow evaluation is appropriate after input/egress authorization and a frozen comparison protocol. The first review identified the missing pre-claim crash and the distinction between automatic comments and a deliberate manual retry. A second read verified those corrections in the final design; product policy adoption and all live acceptance remain open. |

The final substantive blobs reviewed are PR reconciliation `2db0c4de0f4ea70e863a719e2a61724f775f3f25`, Skills governance `b966d9caa51473d8fd45b0ddfa7b093e90c29066` and team attribution `a50943d609796f7226e0c7b3a165ed0c526ab9d7`. The isolated merge-tree validation preserved the eight source-manifest hashes. Four existing backend unit suites (Skills, proposal review, MCP publication refusal and ticket sync) passed 161 tests. The existing specification-gate and status-publisher fixtures passed 57 tests with a simulated provider. The proposed multi-member product workflows, deployment settings, model transmissions, real provider effects and human comprehension remain unexecuted.

## Git-style collaboration follow-up

Review input was PR head `a88fbeb8` and application source `development@97ce6b18`. The [collaboration spec](../../specs/agent-synchronized-engineering/mcp-change-workflow.md) maps the existing native contracts to two-member editing and adds eight discriminating exercises. The earlier version of the evidence record above remains attached to the documents identified by its blob hashes.

| What ran | Observation | Conclusion and boundary |
| --- | --- | --- |
| Git 2.56.1, disposable two-author repository | Two individually valid changes on separate lines merged cleanly. Together the result permitted a viewer to publish, contrary to the fixture’s approved rule. A same-line conflict retained Base/Current/Proposed. An expected-old conditional ref update admitted the first writer and refused a stale second writer. A revert produced a new commit with the original tree and still refused a ref update expecting the first commit. | These four exercises demonstrate the Git primitives and a semantic failure that a clean text merge misses. They provide no native Tesbo authorization or publication evidence. |
| Pinned Tasks service, two simulated members, in-memory SQL double | Bob read drafts A/B/C. Alice deleted A. Bob's stale edit targeted index 1 and modified C; B remained unchanged. The saved activity attributed Bob's actual change to C. With a fresh read before editing, only B changed. | Reproduced the wrong-target baseline in actual service methods. A correct actor receipt alone cannot establish that the intended object changed. Require a stable item ID and expected proposal revision on every mutation. |
| Same service, ordinary task already closed | Editing B returned a conflict. Deleting B succeeded, leaving A/C. Both calls used the same fixture authority. | Check both lifecycle guards at the native owner. The positive control is an eligible action against the right item on an open review. No live database, client, provider or role enrollment was exercised. |
| Existing backend suites on the verified integration source | Five suites passed 171 tests covering Skills, proposal review, native run-admission policy, MCP publication refusal and ticket sync. | They verify their own implemented contracts, with simulated dependencies where applicable. The eight new collaboration exercises and a real two-client qualification remain open. |

The service source used by the two baseline probes has Git blob `766c7c48b9beab2a628fe2e9a4898af5e9d2d7e7`. The probes ran the actual ordinary task read, edit, delete and activity paths with synthetic inputs. The accepted new behavior must retain an authorized fresh write, reject a stale or closed write before any persisted or outgoing effect, preserve each contributor’s unpublished revision, and expose the official result on fresh read. [Pinned methods](https://github.com/1alextest/Tesbooboo/blob/97ce6b18143a62bc377f9dd7dd671fe92456d546/Tesbo-Backend-Nest/src/legacy/legacy.service.ts#L23274-L23355)

Independent source and draft reviews checked identity versus Git metadata, semantic merge and compensation, prior acceptance coverage, unpublished history retention, causal attribution on tag changes, and the difference between one-adapter and two-adapter proof. Five source and specification review assignments contributed to this follow-up. The backend remains the authority for native writes. Full authenticated client, PostgreSQL, external delivery and human acceptance evidence still belongs to the implementation pilot.

## Joined application assurance follow-up — 27 November 2026

**Disposition: bounded repairs and verification; complete authoring acceptance remains open.**
The user authorized the full team review and on-path corrections. This addition preserves the
older source-pinned receipts above. It does not reinterpret them as current certification or
introduce a ninth specification package. Every fact retains its existing writer and review owner.

### Reviewed source and moving owners

The independent source reviews began at `development@45ca0de3c6fb708478dbbbe4783dcb183115904a`.
The local source assembly of #319 and #317 was `f0e865ffa2c270615cffedf018f78a041ae0ffef`;
it was not an executed integrated release. During review, #312 merged as `5d237376`, #314 as
`cb5163a9`, and #317 as `8b627402bb6ca6812fba73c2275b6571d0966041`. The ordinary-draft repair
was reconciled with that development source, preserving the exact-case navigation and handoff UI.
#319 merged into #313's branch, not directly into development. The last observed #313 head was
`146ff36bd61b63e720e54a4d2dfb89a18e26f151`; #321 was `9c386e97875e9a68aa6ed91def8c87cb274f57ff`.
These are observations, not merge actions by this review.

The diagnostic correction is [#322](https://github.com/1alextest/Tesbooboo/pull/322), candidate
`4f515aee940ab8b007cdb8a323d640c9b45f8a60`. The ordinary draft changes accompany this review
addition. The wrong-version coverage display correction follows merged #312 in the same
Requirements UI owner. Open PRs, checks and approvals must be reread before any later decision.

### Eleven independent roles, with distinct evidence boundaries

| Role | Contribution and resulting disposition |
| --- | --- |
| Blue | Located the existing draft writer and demonstrated why an array index and actor attribution do not preserve the reviewed target. Confirmed the same revision field can fence this first increment without a new draft store. |
| Grey | Traced ordinary New task through generation, source collection, review and bulk deletion. Kept model-authored cases distinct from typed governed proposals; identified incomplete regeneration-source history and generic visible contributor labels. |
| QA | Added stale/fresh, malformed revision, two-reviewer, ABA, wrong-batch and closed-task API discriminators. Strengthened the concurrency test to assert exactly which drafts survive, not only their count. |
| Purple | Traced Task polling, chat remount/resync, editor state and partial acknowledgements. Required revision-bound selection, read ordering, pinned edits and explicit reconciliation preserving typed work. |
| Green | Checked the joined handoff/reporter/native writers. Kept exact packet admission, immutable retries, build/cohort provenance and per-criterion proof with existing owners. |
| Security | Traced human versus machine result paths, Skill metadata versus delivery, and scanner/review evidence. Identified the full-row diagnostic risk subsequently reproduced by Red. |
| Red | Executed actual emitted Playwright controls. Duplicate rows copied an unrelated runtime response field into the actual error, JSON, console and failure-context bytes even though packet bytes were clean. |
| Graph | Independently found old criterion text joined to current coverage by criterion key. Distinguished misleading display from the separate exact-version handoff guard and clarified case-level aggregate coverage limits. |
| Observability/Operability | Executed the real SDK against ambiguous-acknowledgement fixtures; identified duplicate-create risk, lost diagnostics and evidence/closure proof gaps. Reviewed actual hosted job boundaries. |
| EG | Reproduced additional parser, malformed-field, URL-userinfo and transport-token disclosure. Independently reran eight actual controls after the coupled fix. Also caught refusal tests that needed valid revisions to reach their original owner-specific guards. |
| White | Reconciled findings and owners, kept source/local/hosted/native/human evidence separate, and required full impacted E2E files rather than treating a passing grep slice as completion. |

All roles participated. Their analytical receipts are not protected human approvals, and the
frontend implementation assignment is not counted as another independent review. A role's early
receipt does not automatically clear a later changed head.

### Consolidated findings and acceptance ownership

| Finding | Correction or explicit remaining acceptance |
| --- | --- |
| Ordinary edit/delete could mutate a shifted index; a closed delete could alter the late-append sentinel | Require `expectedProposalRevision`, check ordinary owner, `in_review` lifecycle and exact revision under the existing row lock, then return the committed proposal snapshot from inside that transaction. No schema or draft repository is added. |
| A fresh-looking response could adopt another actor's revision | Do not reread the proposal after committing a mutation. The service regression introduces another writer at that boundary and proves the acknowledgement still describes this mutation. |
| Task/chat selection, delayed GETs and partial deletion could lose the user's intended target | Bind selection and editor to the reviewed revision. Fence pending reads, avoid joining a pre-write GET during reconciliation, display each committed bulk result, and require explicit reload after uncertainty. Keep unsaved editor text and Cancel. |
| Generic refusal tests could start passing at the wrong guard | Existing Requirements and Skills callers now submit the staged revision and retain their specific governed-owner 409 assertions. A generic 400 is not equivalent evidence. |
| Generated-test diagnostics disclosed response fields and credentials | #322 restricts cardinality inputs, validates primitive identities before equality formatting, replaces parser/request errors with fixed categories, and uses boolean URL refusals. Runtime canaries are checked in reports, output and all reported attachment bytes. Native upload/readback remains separate. |
| Requirement coverage could attach B's evidence to A's reused criterion key | Correct the existing Requirements UI join to require the exact approved basis. Unavailable historical readings must not be rendered as false/zero or borrowed passing evidence. Keep the independent handoff ID guard. WF-23/24 and T-426/427 retain acceptance ownership. |
| Packet basis is stronger than reporter admission by external ID | Existing handoff/reporter/native admission owner, T-459. Exercise a case edit/reapproval between selection, execution and admission; require the admitted result to retain the correct native identity and basis. A stable one-case fixture does not qualify the race. |
| Coverage is case-evidence presence, not complete criterion/build proof | Existing T-426/T-459 and GA-AC-02. Current aggregate passing uses at least one qualifying linked case. Add two-required-criterion, old-build, mixed-environment, same-occurrence and missing-provenance acceptance; labels must disclose unknowns and scope. |
| Three separate Runs do not prove immutable attempts within one Run | Existing T-428/T-459 and automation retry owner. A later retry can update the effective execution row. Qualify retained attempts and effective-result selection separately. |
| Ambiguous Run/evidence acknowledgment can be retried without a stable operation identity | Existing SDK/automation/T-203/T-408. The actual SDK loopback probe produced two fixture records after a lost create acknowledgment without a key, one with a stable key, and two evidence records after an upload retry. Native duplicate consequence is inferred, not executed. Require replay-safe receipts or truthful uncertainty without breaking the reporter's nonblocking customer-test contract. |
| Generated child failures and native evidence can be under-observed | Existing #313 owner. Current head `146ff36b` asserts authoritative Run closure and verifies bytes for every child attachment; these earlier findings are resolved in source. Unexpected child exit/timeout still needs a bounded sanitized summary before cleanup. Existing review threads remain authoritative; do not create duplicate findings or retain already-fixed cleanup claims. |
| Automation-only fencing does not establish all-writer machine attribution | Existing #321/common execution/MCP attribution owner. Current `9c386e97` has successful hosted replay/result/evidence/close refusal coverage and 758 passing database tests across 18 suites; this qualifies its AutomationService boundary. Unchanged legacy MCP paths still pass only `ctx.userId` to the manual-result writer. Whether delegated agents may record observed manual outcomes is a product-policy decision; both allowed and forbidden designs require truthful machine provenance. |
| Regeneration source display and member activity are incomplete | Existing Task source/provenance owners. Fresh regeneration retrieval is not necessarily appended to the displayed source history; generic user/agent labels do not establish the individual causal actor. Preserve historical unknowns. |
| Skill resolution is not actual delivery or conformance | Existing T-422, Skills governance and member attribution. Resolve an immutable applicable method, deliver its permitted content, bind the receipt, validate structured output and evaluate semantic conformance. Do not promise identical prose merely because a client fetched a Skill. |

**Lifecycle policy remains explicit.** Close task / chat Discard all currently closes the batch at
execution time and retains its stored drafts; it does not carry an expected proposal revision.
Changing that to discard only the snapshot reviewed requires an authorized product decision.
The edit/delete repair does not silently change this behavior or claim universal conflict protection.

### Executed evidence and unexecuted boundaries

| Evidence | Actual result and scope |
| --- | --- |
| Ordinary-draft regression before correction | 6 failed / 1 passed; 57 unrelated tests excluded by the focused selection. Actual service methods with simulated SQL/transaction dependencies. |
| Three existing service suites after correction | 109 passed / 0 failed / 0 pending. Stale selection, lifecycle and exact post-write response are discriminated; these are not PostgreSQL or browser receipts. |
| API/UI implementation inventory | Eleven new API cases and nine browser cases in existing Zyra files; existing two-member concurrency and adjacent governed refusals strengthened. Type checking passed before publication. Runtime status is reported by candidate CI, not inferred from discovery. |
| Diagnostic regression | Original top-level suite: 1 passed / 1 failed before correction. Extended correction: 2 passed / 0 failed / 0 skipped, executing 25 actual generated Playwright attempts. Positive cases and intended faults/refusals are asserted independently. |
| EG independent final diagnostic check | Eight actual child executions: two valid controls passed; duplicate, malformed JSON, object requirement/link, socket reset and userinfo controls failed in their intended categories. No synthetic marker occurred in actual errors, full reports, stdout/stderr or any reported attachment. Exact generator blob `6079805376a2f9e6a6167a732ddb1c956b61bfda`. |
| Hosted #319 governed journey | Actual test at `e2e/api/handoff-native-reporter.spec.ts:758` passed in job [140422976505](https://github.com/1alextest/Tesbooboo/actions/runs/45974568700/job/140422976505), head `d5eac248d82762287f103fb36cbdd1477a5d66c1`. It used disposable native Skills/proposal/apply/requirement/case/link/handoff records and actual generated Playwright/reporter execution with good, fault and corrected Runs. |

The hosted governed journey does not start ordinary New task/model generation and does not
exercise two real external authoring clients. The corrected automated execution is a separate Run;
the prepared manual retest remains Untested. Native approval, deployment and production acceptance
are distinct. CI selection for the ordinary-draft repair includes the complete impacted
`api/zyra.spec.ts`, `ui/zyra.spec.ts`, `api/requirements.spec.ts` and `ui/skills.spec.ts` together,
with `--workers=10`, after disposable setup and the narrower diagnostic slice. The existing
PostgreSQL proposal suite remains in Behavioral quality. Product completion requires the actual
final candidate's relevant API/UI/database results, not a green local type check.

#319's stacked-base check set did not trigger DevSkim or Snyk IaC; that means not triggered, not
passed. The later #313 head `146ff36b` targets development and DevSkim executed successfully while Snyk discovery found no supported IaC target and skipped the actual scan; its current smoke result must still be checked. Security's source classifications of existing scanner threads are proposed dispositions,
not authorized dismissals. The full alert inventory and final-head checks retain their own gate.
The signed App publisher was not verified as activated in this session; draft publication follows
the existing feature-branch route and does not claim signed-publisher or human-review clearance.

### Seven native domains and concrete handoff

No authorized current Tesbo MCP writer was available in this session. No native IDs, test Runs,
approvals or statuses have been invented, and no direct REST/DB substitute was used to synchronize
product records. The following is a reviewable handoff to the existing owners:

| Domain | Disposition |
| --- | --- |
| Requirements | Amend existing collaboration and exact-version coverage obligations; retain build/admission acceptance and the unresolved lifecycle/result policy decisions. |
| Test Cases | Stage the concurrency, lifecycle, partial-acknowledgement, delayed-read, diagnostic and reused-criterion-key controls against those requirements; attach actual execution once available. |
| Manuals | Explain explicit reload after uncertain draft changes, ordinary versus governed generation, and current coverage labels without implying complete criterion proof. |
| Policies | Preserve publication and review authority. Do not automatically decide delegated manual-result recording or change what closing a batch authorizes. |
| Tasks/Bugs | Associate each finding with its existing draft, generator, Requirements UI, reporter, SDK or attribution owner; discover actual native IDs before linking. |
| Files/Evidence | Retain exact source pins, before/after reports, independent probe bytes and later CI receipts with original scope. |
| Skills | Unchanged by these narrow mechanism fixes. Preventive guidance changes require the existing immutable-version, review and evaluation process. |

The next bounded qualification is the two-member authoring path after delivered Skill content,
per-member connection authority and safe existing-draft collaboration are implemented. Define one
authoring attempt explicitly, use two supported write-capable clients, compare canonical output
and semantic conformance, then exercise stale refusal and intentional reconciliation. A read-only
client is a refusal control, not a second qualified author. This does not require another harness
engine or another architecture review cycle.
