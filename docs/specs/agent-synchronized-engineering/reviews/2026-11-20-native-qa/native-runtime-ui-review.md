# Terminal recovery focus: independent source review

## Verdict and scope

No source blocker identified in the frozen terminal-focus addendum. The page-owned fallback is coherent with the existing recovery lifecycle, and the four new scenarios distinguish the missing fallback from correct behavior. This is a read-only source/test review, not runtime or visual acceptance. No product or test file was edited or executed for this review.

The comparison includes the prior first-CI correction, whose dialog hash is `99e7e4e4000052e16b9bd30ce6f3a5d99d67897ad6df71c10f813d2cc7facf55`. Published parent remains `644ab9616905af6ac832a098ab44656aa7faa1eb`; these corrections were not present in either completed browser run. Earlier review receipts remain unchanged.

## Evidence and lifecycle

The original pending-recovery focus failure is runtime evidence: after Escape closed the dialog, Review retest request was inactive instead of focused in the first full impact job `136150848945`, at the original test line 2068. Opening recovery removed its banner before the layout effect captured the trigger. The earlier correction records recovery origin before opening and restores the newly mounted banner button after closing.

The subsequent terminal counterexample is source evidence: a positively recovered created or cancelled outcome clears its terminal display state on Close. Its recovery banner therefore does not remount. After a reload there may be no selected-row action either, so restoring only the banner button leaves no return target. Retaining an already-resolved banner merely to preserve a focus node would change the recovery semantics.

The addendum preserves that terminal clearing and supplies focus through the existing Run page:

- RetestRunDialog first uses its own remounted recovery button. When none exists, it calls the required page-owned `onRestoreFocus` callback. Its query remains scoped to the banner ref; there is no global target lookup.
- The callback waits one microtask for sibling refs to finish attaching, then requires the same user/project/Run view scope. It chooses a connected enabled Retest selected button, otherwise the current Run heading, otherwise Back to Test Runs.
- The Run heading receives `tabIndex={-1}` for programmatic return focus. Back to Test Runs remains available for an unavailable source and is also rendered while the source loads.
- Existing ordinary connected-trigger restoration and dialog focus containment remain. The callback is stable, so adding it to the layout effect dependencies does not reset focus on every parent render.
- A changed view scope suppresses the queued restoration. Unmounting detaches the page refs, preventing a disconnected element from receiving focus.

There is one RetestRunDialog call site. The shared Modal, request/receipt validation, terminal disposition ownership, intent clearing, approval rules, and create/cancel semantics are unchanged by this addendum.

## Four discriminating scenarios

Each case saves the real browser create body, aborts that browser POST, temporarily makes browser outcome lookup unavailable, then executes the exact saved request through the real API to create or cancel it. The test reloads, recovers that disposition, proves no selected-row action remains, proves saved intent is cleared, enters recovery by Tab/Enter, and closes by keyboard.

| Terminal outcome | Source after reload | Close action | Required focus |
|---|---|---|---|
| Created | Available | Enter on Close | Source Run heading |
| Cancelled | Available | Enter on Close | Source Run heading |
| Created | Actually deleted | Escape | Back to Test Runs link |
| Cancelled | Actually deleted | Escape | Back to Test Runs link |

All four require both the dialog and terminal banner to disappear before checking the exact destination with `toBeFocused()`. `tabTo` sends keyboard events; it does not programmatically focus the destination. The prior banner-only correction cannot satisfy these assertions because the opener is disconnected, the terminal banner is absent, and selection is empty.

The created cases additionally require exactly one matching destination Run and one Untested occurrence for the selected testcase. The cancelled cases require no matching Run and refusal of a delayed create with `RETEST_REQUEST_CANCELLED`. Every case keeps the original browser POST count at one. These checks prevent a focus fix from being obtained by changing the terminal outcome or replaying creation.

The four tests wait for loaded or unavailable source state. The loading fallback and a source read settling in the dismissal commit were inspected in source; these four cases do not independently force that scheduling race. No runtime claim is made for those branches.

## Exact binding and preservation

All three current hashes were independently calculated and match `/workspace/scratch/8e9074abd0d0/native-ui-terminal-focus-freeze.json`, whose SHA-256 is `bb4347b924a1ddf6cf250b08957885ddc8b0a129b57e9e9ae470958446d373fb`.

| File | SHA-256 |
|---|---|
| Tesbo-Frontend/components/testruns/RetestRunDialog.tsx | `f34c1b9b077e3e38352f04e2a8569465c1d53138ae0890388425bd834eabc400` |
| Tesbo-Frontend/app/(app)/projects/[id]/cycles/[cycleId]/page.tsx | `e1ea5293eb13d0ee7b91a5decfd17dd358ad834af384e8a4db6c51a36d5c525a` |
| e2e/ui/cycles.spec.ts | `ccd23508bacf31b463bff63046188a2ce1bdf8b044953980357e5876ddf54c00` |

The legacy cycles prefix matches the earlier frozen bytes exactly, SHA-256 `9b0842a74cfa35e543728ce1cdd40abeb69477536ccb73a5201218533ac43054`. A source comparison against the previous native block, SHA-256 `7d4eaceaa7a67775840740d344db437b6b2ae6e30bad9b6997356c9474f1de84`, finds 91 added lines and no removed native lines or assertions. Existing native PUT corrections remain.

The author's saved collection outputs report 260 tests in the same nine impact files, including 20 native UI cases, and 3009 tests in 91 suite files. The author reports passing frontend/E2E type checks, scoped ESLint, architecture checks, and diff checks; those commands were not rerun by this reviewer. Own verification comprised source/lifecycle review, hash comparison, preservation comparison, and inspection of those collection outputs.

## Remaining gate

The exact corrected merge checkout still needs the complete authorized isolated CI run and final browser evidence. The earlier 13/16 native UI result does not certify either focus correction. This receipt passes the bounded source review gate only; it does not approve merge or deployment.
