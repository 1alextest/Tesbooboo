# Can Zyra design a test that would catch the fault?

A box-office team asked for release cases for two changes: seat exchanges and calling people from a standby list. Four authors received that ordinary request through Zyra’s native prompt builder. **The two authors with the additional QA Investigation Harness planning method earned 18/20. The two using the ordinary Zyra prompt also earned 18/20.** Both groups found the hidden storage and identity risks. All four left the same gap in their notification tests.

## What the test authors received

The fictional theatre already had operating instructions. A replacement exchange offer retires previous offers. The cashier can reopen a booking at a second desk, and finance can look up receipts and charges by offer reference. Standby bookings can move in the list while selected. Different patrons may share a display name. Calling an already-called booking acknowledges it without requesting another notice. The release correspondence contained several competing proposals for allocating the last seat in an exact tie. None had current sign-off.

Two independent authors received the ordinary Zyra system and user messages. Two fresh authors received the same messages plus a 647-byte planning method in the task context. It asks the author to model the starting state and transition, identify how the screen could look right when the underlying result is wrong, find an independent observation, and surface any missing decision. The upstream project uses these ideas in its flow-model and risk-challenge stages. The adaptation fits the existing native draft format. Formal upstream plan export has additional evidence and approval prerequisites. [Model the flow](https://github.com/QAtools-tech/qa-investigation-harness/blob/a468921c2bead820520a97df897168487b2b4985/qa-harness/stages/02-model.md) · [Challenge risks](https://github.com/QAtools-tech/qa-investigation-harness/blob/a468921c2bead820520a97df897168487b2b4985/qa-harness/stages/03-challenge.md)

We froze the assignment, five scoring obligations and advancement threshold before sampling. The ticket requested five cases within 500 narrative words. The project used Zyra’s existing 1–10 range. Four fresh assistant sessions supplied model answers to a loopback provider. The original transport sessions ended at handoff. After verifying that the full native requests matched byte for byte, we replayed each request with its original, unedited answer. Zyra’s provider client and normalizer accepted all 20 cases. Two graders independently reviewed the normalized drafts with the treatment labels hidden. The pilot exercised native prompt construction, provider message handling and draft normalization. A deployed project model, authenticated Skill retrieval, task persistence and human Save remain outside this run. [Native generator](https://github.com/1alextest/Tesbooboo/blob/6f7799383fc3277f6586df4d94cdcaa3bd7c13d4/Tesbo-Backend-Nest/src/legacy/legacy.service.ts#L26377-L26452) · [Trial inputs, original answers and scorecards](zyra-proactive-authoring.json)

| Frozen obligation | Ordinary authors | Authors with method | What appeared in the draft cases |
| --- | ---: | ---: | --- |
| Retired offer | 4/4 | 4/4 | Check the refusal, reopen the original booking, and find zero receipt and charge rows for the retired offer. |
| Current offer | 4/4 | 4/4 | Complete the exchange, read the new seat from the booking, and check the matching finance entries. |
| Standby list changes | 4/4 | 4/4 | Move the selected row, identify the booking by reference, and check that another booking remains waiting. |
| Repeated notification | 2/4 | 2/4 | Verify the first call on one booking, then use a different booking already marked Called for the repeat. |
| Last-seat tie | 4/4 | 4/4 | Preserve the unresolved decision and avoid assigning a winner from an unapproved policy. |

Each obligation was worth up to two points per author. All four submissions were gradable, contained five cases, and met the word limit. On the primary scorecard each author earned 9/10. The second grader scored one ordinary answer 8/10 because it recorded the pending tie policy without explicitly asking an owner to decide. That gives 18/20 with the method and 17/20 without it under that reading. The predeclared threshold required the method to gain at least three points and preserve the positive and unresolved-decision controls. Neither grading met it. The operating notes were unusually specific, and the existing Zyra system prompt already asks for state transitions, meaningful edge cases and observable expected results. Generalization to short or conflicting tickets remains unverified.

## The test all four missed

One draft proved that a first Call created a notice for the right booking and recipient. Another began with an already-called booking and proved that acknowledging it preserved an existing notice. The second setup supplied the state that the first action should have produced. An implementation could store a fresh call differently from a pre-seeded one and still pass both tests.

| Action on the same booking | Independent expected result |
| --- | --- |
| Start with waiting booking B and its registered contact. Read the outbox by booking reference. | Zero notices for B. |
| Call B. Read it from booking detail and read its outbox. | B is Called. Exactly one notice is addressed to B’s contact. Record the notice ID. |
| Reopen B by reference and call it again. Read the outbox again. | The repeat is acknowledged. There is still exactly one notice for B and it has the original ID and recipient. |

This is a proposed repair based on the observed draft gap. It was not one of the model answers or an executed test of a theatre application. A candidate instruction for a separate trial is **“When a requirement limits side effects on retry, exercise the original action and the retry on the same record and compare the independently observed effects.”**

## What the upstream harness can already do

We ran the pinned, unmodified handoff command on isolated upstream fixtures. A current synthetic approval produced one ready case, TC-01, with its mapped test path. A stale dependency and an unapproved risk each produced zero ready cases and an explanation. The stock static example also withheld a case labeled approved when its approval could not be established as current. All four commands returned exit status zero. Exit status shows the checker produced a report. The Ready cases section identifies what it would send to a generator. Repeating the runs preserved the inputs and produced identical reports. All five upstream handoff tests passed. [Generator round trip](https://github.com/QAtools-tech/qa-investigation-harness/blob/a468921c2bead820520a97df897168487b2b4985/qa-harness/GENERATOR-ROUND-TRIP.md) · [Upstream handoff checks](https://github.com/QAtools-tech/qa-investigation-harness/blob/a468921c2bead820520a97df897168487b2b4985/qa-harness/checks/generator-handoff.test.mjs)

**Disposition for Tesbo.** Retain the upstream handoff as an opt-in candidate for teams converting a reviewed plan into automation. A Tesbo adapter would have to match each eligible row to the approved requirement, selected item, current draft and target revision, and permitted test path. Read the case-level disposition before offering generation. The existing human selection and save receipt govern publication. Leave the shared authoring method at the current baseline on this evidence. Human adoption and changes to active Skill assignments remain with the native owners.

## Replay the native evidence

With the repository’s backend development dependencies installed, run the following from the repository root:

```sh
node docs/qa-orchestration/examples/replay-zyra-authoring.cjs
```

The replay gives the recorded first answers to the native provider client using in-process transport. It checks the message and normalized-draft digests against the pilot. It can detect a material prompt or parser change without a model account or test database. A fresh behavioral benchmark requires new model answers and held-out tickets. [Replay source](replay-zyra-authoring.cjs)

## Does the author find a risk across a queue boundary?

On 26 November 2026, two fresh authors received one release ticket about importing a provider record into a knowledge tree. **Both authors identified deletion of the destination between enqueue and write. Both earned four of four on the same frozen rubric.** This pair gives no observed detection advantage for the extra excerpts on this ticket.

Both packets included destination creation, queue dispatch, the missing-ticket check, unchanged-content handling and run accounting from revision `551e7eab`. The brief mentioned that members can remove folders and asked about record placement, truthful progress and repeat imports. The longer packet added four excerpts showing the producer storing the folder ID on each ticket job, the worker reading it, and the insert/update using that ID. Across the two native requests, only those excerpts and their line labels differed. The evaluator selected excerpts with knowledge of the historical incident. Each assistant received one native message array and returned its first three drafts. A third assistant saw the two normalized submissions under different aliases and graded them against the rubric frozen before authoring. The project name, PR number, later fix, treatment labels and rubric were absent from both model-facing requests. [Test inputs, original answers and grading](zyra-queue-context.json)

| Frozen obligation | Shared excerpts | Extra producer and worker excerpts |
| --- | --- | --- |
| Remove the destination during the original import | Paused two queued tickets, removed the folder and kept one ticket present as the subject. | Paused one queued ticket, removed the captured folder and released the worker. |
| Check the stored record and a user-visible outcome | Read the surviving ticket's parent by external ID and reconciled reachability and run totals. | Read the mirror by project, provider and ticket ID and compared its parent with the tree and run totals. |
| Identify the policy decision | Distinguished an unreachable successful copy from legitimate choices for the removed destination. | Requested a decision about blocking removal, selecting another destination or reporting a skip/failure. |
| Preserve an ordinary unchanged repeat | Re-imported the same ticket and checked mirror identity, parent, body and modification timestamp or revision. | Re-imported the same ticket and checked its ID, location, content and write timestamps. |

The longer packet yielded a simpler one-ticket experiment. The other author used a second ticket to cover its disappearance in the same run. That observation was outside the grading rubric. The explicit release brief and visible queue dispatch gave both authors a reason to consider concurrency. The comparison used one author per condition, assessed proposed tests, and measured neither autonomous source selection nor deployed Zyra performance. The earlier [source-only reviewer that initially missed the path](../../specs/agent-synchronized-engineering/work-package-b-governed-manuals-policies-design.md#103-native-readback-for-the-duplicatedelete-pilot-25-november-2026) received a different task and different excerpts.

The replay command above now verifies four earlier replies and these two new ones through the native test-authoring adapter and normalizer at `289fdd8b`. The recorded replies came from isolated assistant sessions. The project displayed **AI provider not connected** on the pilot date. For a fresh project comparison, an authorized project model allocation is needed. Supply only the input reconstructed from the common story and one trial's source ranges, keep the rubric and other answer out of the request, record the model and source revisions, and preserve the first output before grading. An independent PR assessment additionally needs the [read-only assessment operation](../PR_CHANGE_RECONCILIATION_DRAFT.md#extending-zyra-for-independent-review). These exercises created no native task, case or Run.
