# Native Retest selected — independent UI review scenarios

Frozen before candidate inspection on 2026-11-20 by `/root/native_retest_ui_review`.

## Review boundary and evidence

Outcome supplied: an authenticated human selects exact existing Run executions, compares their old observations with the current approved definitions, explicitly reviews a changed definition, and prepares one linked native Run whose executions begin Untested. Source evidence remains intact. Failure, uncertain create results, duplicate delivery and user/project/Run changes require truthful, recoverable UI.

This is a bounded native Run preparation increment. Full attempt/correction journals, external-agent task/report loops, model-driven dispatch and new navigation systems are outside this review. Their absence is not a defect in this slice.

The independent scenario set derives from the stated outcome; the clean source baseline `/workspace/scratch/8e9074abd0d0/tesbo-qa-baseline` at `1fe100588be6c3a1627ee39a4b0bbc1c0d9da2ea`; root/frontend AGENTS.md, CLAUDE.md and scope discipline; and the published v1.4.34 canonical package under `delivery-input/canonical`. The package is marked NOT FROZEN and does not establish deployed acceptance. Relevant source contracts: `02_WORKFLOW_AND_UX_SPEC.md` WF-09/11/13/24, revisions 1.4.10–14 and ASER-UX03; `07_UI_DESIGN_TASKS.md` D-07/09/15–17 and revisions 1.4.10–16; `06_IMPLEMENTATION_AGENT_BRIEF.md` independent review boundary. The two files named in the repository's remote canonical branch are not present in the baseline checkout/ref; the supplied published package was used rather than inventing replacements.

No frontend candidate implementation or candidate tests were read before this freeze. No browser, app, database or product mutations have been performed. Runtime and visual acceptance cannot be inferred from source.

Baseline source hashes (SHA-256):

| File, relative to baseline | SHA-256 |
|---|---|
| `Tesbo-Frontend/app/(app)/projects/[id]/cycles/[cycleId]/page.tsx` | `43ea1c7390b70ee0cb644cc3406163f879ab0385dd76831380e34cddbea05611` |
| `Tesbo-Frontend/app/(app)/projects/[id]/cycles/[cycleId]/execute/[executionId]/page.tsx` | `fe24e34cad15884591f87c67b6dcbf202a47e00e454913921508474cdba3c1ae` |
| `Tesbo-Frontend/components/ui/Modal.tsx` | `2acf98039a8ec7ad5e95439432f19fc33f74d568d68c224295e17a2752bb8c36` |
| `e2e/ui/cycles.spec.ts` | `54546b290fa012160c2fd9a277fb845e2543f1b29e70d9237f9be12455b202fb` |

## Independent journeys and invariants

| ID | Journey or stressor | Observable invariant / evidence needed |
|---|---|---|
| UI-01 | Select one execution and a deliberately nonadjacent subset; repeat with the same case appearing in more than one execution | Submitted source identities are exactly the selected execution IDs. Selecting one occurrence does not select every occurrence of the case. A counted selection remains legible through filtering, sorting and pagination. |
| UI-02 | No selection; all-on-page; clear selection; selected row removed by concurrent actor | Empty selection cannot create a Run. All-on-page does not silently include hidden pages. Missing selected source cannot be silently dropped into a smaller create. |
| UI-03 | Open review from Planning, In Progress and Completed source Runs | Eligible source observations are reviewable regardless of lifecycle where supported; Completed source remains closed and existing prohibited mutation controls stay prohibited. |
| UI-04 | Inspect preview for failed and passed source observations | UI distinguishes source observation/status/actual/evidence from current approved definition and prospective Untested execution. It never calls an unperformed retest Passed/Failed or copies an old outcome into the new Run. |
| UI-05 | Source definition differs from current approved definition; long multiline actions/expected values/data and an unchanged sibling | Changed fields are inspectable, current approval is explicit, and deliberate review is required before create. Review state is specific to the displayed current basis; a refreshed changed basis requires a new decision. |
| UI-06 | Current case is missing, unapproved, approval stale, inaccessible or malformed | Create is refused with actionable explanation. No auto-approval, no substitute case/current title masquerading as tested history, no partial create from the surviving subset. |
| UI-07 | Preview request fails, is delayed, or returns incomplete scope | Loading, successful absence, denial and read failure are distinguishable. A failed preview cannot enable create from stale data. Retry reads the intended source/selection and preserves useful user input. |
| UI-08 | Create one eligible retest with default and edited name | One native Run is independently readable, linked to the exact source executions, with current approved definitions and Untested observations. Source status/actual/evidence/bug links remain unchanged. |
| UI-09 | Double click / Enter repeats while create is pending | At most one logical create is initiated by the UI; idempotent recovery and server receipt prevent duplicate Runs even if delivery repeats. The user sees that work is pending. |
| UI-10 | Server commits create but acknowledgment is lost; recover in same dialog and after reload | UI labels the outcome uncertain and resolves the same durable intent/receipt before permitting a new create. Recovery navigates to the already-created Run with exact selection and actor/scope matching. |
| UI-11 | Create never committed, receipt lookup succeeds empty; then explicit retry | UI distinguishes confirmed receipt absence from failed read. Any retry uses safe operation identity and does not discard the earlier uncertainty merely because a read failed. |
| UI-12 | Receipt lookup fails / permission is revoked / receipt belongs to another selection, project, source Run or user | No wrong receipt is accepted as successful creation. No hidden cross-context metadata appears. Unresolved intent is not cleared and duplicate-creating controls remain unavailable until safe reconciliation. |
| UI-13 | Reload an uncertain operation after source Run or an execution has been deleted | Recovery still has an authorized route to the operation receipt; source-load failure cannot hide a known committed retest or reinterpret uncertainty as no operation. |
| UI-14 | Navigate A→B (Run, project, execution, account), and resolve delayed A preview/create/receipt/lineage requests afterward | A results never display beneath B, submit B with A selection, clear B recovery state or navigate B to A. Repeated A→B→A and stale completions are fenced by request generation, not identity alone where necessary. |
| UI-15 | Close/reopen/cancel during preview and during create; navigate away then return | Pending authoritative writes and their recovery identity survive; cancel is not presented as server rollback. Pre-create review cancellation does not write. Focus returns to the initiating control when safe. |
| UI-16 | Browser storage unavailable, stale, malformed or populated for another scope | No unhandled render failure or accidental foreign recovery. Required durability failure blocks or truthfully constrains create. Storage retains only the minimal recoverable scope and intent, not copied sensitive evidence. |
| UI-17 | Read source/target lineage in Run summary, drawer and full execution page; reload and use links/back | Shared semantics identify source versus retest, resolve exact authorized records, distinguish absent lineage from failed lookup and preserve existing deep links. Source-deleted lineage remains intelligible. |
| UI-18 | Use existing Start/Complete, Add, Remove, Assign, Set status, share/export, drawer Save, Log bug, evidence and full-page navigation | Existing capabilities and permissions remain coherent. Exact-execution selection change must not silently broaden legacy case-based remove/assign/status actions or remove their availability. Source-preservation claim applies to retest preparation, not an assertion that unrelated edit controls no longer exist. |
| UI-19 | Keyboard only: select, open review, inspect changed content, enter name, acknowledge, create, handle error, dismiss | Native controls have useful names; initial focus, trap, Escape, restoration and live status/error work. Disabled busy controls and hidden/background controls cannot be activated. Tabs/details remain operable without mouse. |
| UI-20 | Authentic render at declared build/fixture/role/theme; long content, normal viewport and narrow/zoomed layout | Old observation versus new definition remains understandable; primary actions remain reachable; no truncation or overflow hides decision-critical content. Only actual before/after screenshots plus interaction receipts can establish visual acceptance. |

## Test quality checks to apply after candidate freeze

- Match assertions to each claim: a visible button, toast or intercepted mock alone does not prove persisted identity, evidence preservation or transaction behavior.
- Confirm current-definition drift tests actually mutate a selected definition between preview and create, not merely force an arbitrary status code.
- Confirm lost-response tests commit the real create before dropping delivery, then assert one persisted target and the exact recovered IDs.
- Separate genuine navigation/pending-request races from tests that reload only after all requests settle.
- Require actionable failure recovery without treating storage/receipt read errors as absence.
- Classify retained-control defects already present in the clean baseline as adjacent unless this increment exposes or changes their mechanism.
- Declare browser/CI tests NOT RUN until exact-head receipts exist; declare visual review BLOCKED until authentic screenshots exist.

This initial scenario set is frozen. Candidate-informed findings and any later additional scenario are recorded separately in `native-ui-review.md`.
