# Narrow informed experience delta — final v1.4.49 source candidate

## Bounded verdict

**No material UX, actor-authority or status regression was found in the inspected final delta. One P2 current-research navigation/provenance correction remains open for the publication delta.** The distinction between planned maintenance and already-authorized urgent containment is coherent with the preserved v1.4.47 authority and evidence rules. The approval clarification preserves a permitted human journey through an admitted UI while keeping approval with the native owner.

The five original findings remain addressed at the proposed-specification level, subject to the limits in the earlier review. This receipt does not reopen unrelated architecture or extend its scope to runtime, human comprehension, source-specific incident replication, publication, formal team approval or release acceptance.

## Inputs, independence and integrity

This is the same analyst's **informed** delta from the first v1.4.49 candidate. It is not a new blind Grey/Purple/EG pass, and using those three lenses does not constitute three independent approvals. The original `review-experience.md` and `review-experience-v49.md` were preserved without edits. The latter receipt's SHA-256 is `ee89590468b1655ebea867e8442f8b2dedafa4f8e035dd6042c00be90626aaf7`.

Compared only frozen inputs:

- Prior root: `/workspace/scratch/57132e18e2df/review-input-v49`; manifest `a8bbdab6f513d2591ed60c55c56f327dbf55bd4d40f64cf865f69a636cdc9406`.
- Final root: `/workspace/scratch/57132e18e2df/review-input-v49-final`; manifest **`c3b033ab88fef3dda865d7a4d61da157e4b39103e02db4975313a2f5d96249de`**.

All **18** final manifest entries independently match their recorded SHA-256 and byte length. The manifest records integration `d440c48ede32ca38783b178ea6d957ded8bca9e4` and archive SHA-256 `603b77ffa3c56a969bd364407114fcd6f49b60c183a3fccec109b4ea12dbcd27`; those are manifest provenance, not an independently verified merge/publication or ZIP-read claim in this review.

Material inspected document hashes:

| Document | Final SHA-256 |
| --- | --- |
| AGENTS.md | `9a2d03c21b7e3c1a92a817bc28a6eabf1984e94e33cbf820e7ede8d08e901f88` |
| docs/agent-scope-discipline.md | `34706fd2bce13748e0dc5bb237a58a19f9d78aed7f3142d715486c875d22939f` |
| 00_README.md — unchanged from first candidate | `0cd095bc78cb2ff420335409bca0f33751ef091e790d1c2c0fe1bdaa72b9d104` |
| 01_PRODUCT_REQUIREMENTS.md | `d23da84fe52a5508bd199672702e0557e716e2eb5c90e46dc07539ac14f79cd6` |
| 02_WORKFLOW_AND_UX_SPEC.md | `10c01791f0d83441541dfa240dabfdbafb51197525218a48bab556ac24417521` |
| 03_TECHNICAL_DESIGN.md | `d8ea5f3dad56c3b653663f71181b231187a389ca859e2e68bd52f1a631e18ef0` |
| 05_IMPLEMENTATION_BACKLOG_AND_TEST_PLAN.md | `e10520eb6d9b13f834c4ae82055334aea723efddc620ee0a9f7962954384c811` |
| 06_IMPLEMENTATION_AGENT_BRIEF.md — unchanged from first candidate | `45e08d05e7c3bd6171ef8d1eb185d7added06934f32fd795686e60d5cc95965b` |
| 07_UI_DESIGN_TASKS.md | `e22ec36214f386bb61badd07ca7dacade390f72aea8ed7cc3da993c8de71f56b` |
| Current plugin research document | `a017bf2ce088abf1cda1cb3abb81b8acdb64d531652d06b0670af5ed75c60075` |

References below use `00` through `07` for files under the final root's `docs/qa-orchestration/`. `Research` refers to the same root's `docs/qa-orchestration/reviews/plugin-ecosystem-obsidian-review.md`, now a same-package source rather than the prior snapshot's separate `research/` path.

## Findings and dispositions

### F-EXP-01 — P2: two current research entry points still target the historical PR

**Document evidence:** 00 line 907 says the “existing research proposal in PR315” owns external observations and candidate comparisons, linking to that PR. 06 line 881 still sends the implementing reader to the “PR315 research record” for the expanded established-ecosystem comparison. By contrast, 05 line 2316 now links the current local research document, and Research line 253 explicitly records that the additive correction/comparison is continued with PR295 while PR315 remains the original merged history.

**Reader consequence / inference:** A person following the README or implementation brief can arrive at the earlier research revision rather than the current comparison and corrected evidence boundary. This does not change plugin authority or prove that the linked PR is unavailable. It makes the ordinary evidence handoff inconsistent with the candidate's own provenance statement.

**Recommended disposition:** Point 00 and 06 to `reviews/plugin-ecosystem-obsidian-review.md` as the current record, retaining PR315 as its historical origin and PR295 as the present amendment where needed. Do not rewrite the original PR's history or imply a new change to that merged PR. This is a small documentary correction; no runtime or new full-feature review is needed solely for the link change, but its exact resulting diff and source identity should be recorded.

**Current status:** Open in manifest `c3b033ab…`. The coordinator acknowledged the finding and plans it as a small later publication delta after the independent White pass. That plan is not completion; this receipt does not certify the future edit or inherit its new hashes.

### Planned maintenance versus urgent containment — no additional finding

02's added paragraph after line 1063, 03 lines 2121–2123, 05's added urgent-containment scenario and 07's added paragraph after line 957 distinguish the two situations that require different user decisions:

- Planned update/disable/revoke/remove preserves the impact preview, inspected basis, required/optional dependencies, shared resources, historical records and current authority.
- An already-authorized urgent stop/revoke does not wait for complete dependency inventory, telemetry or catalog availability. It acts only within its authorized affected scope, reports actual acknowledgement and unknown/in-flight effects, then supports reconciliation.

The addition is grounded in preserved 03 lines 2043–2045: independent emergency control must have actual operator authority, cannot stop unrelated work or authorize ordinary domain writes, and must disclose audit/control gaps. The new wording retains these constraints and explicitly refuses to represent an unavailable control as confirmed stopping. It does not create an emergency principal, unauthenticated override or agent-granted authority.

**Analytical check, not execution:** With a healthy catalog and a planned removal, the user still sees the effects before committing. With a failing catalog and a permitted urgent containment request, lack of inventory cannot become an artificial waiting gate. With an unavailable stop control, the outcome remains unconfirmed rather than green. An actor lacking stop authority receives no new privilege in any of these cases. The proposed acceptance row now discriminates those outcomes; it remains NOT RUN.

### Human approval through an admitted UI — no additional finding

01 line 1234 changes the earlier broad statement that a contribution “cannot approve” into a precise distinction: the contribution cannot independently confer approval; an authorized human using an admitted UI still calls the existing native approval owner on the exact reviewed basis.

This preserves a legitimate end-to-end user journey for UI contributions without granting the plugin its own review authority. The interface can present and initiate the user's permitted decision; the native service still owns identity, authorization, revision validation and commitment. Package installation, a plugin's self-report or a machine caller cannot impersonate that human decision. No new approval role or automatic activation is introduced.

### Guidance and ASER source pointers — no additional finding beyond F-EXP-01

The additional AGENTS.md guidance makes exact record identity, delayed-response isolation, actor-specific recovery, pre-effect authority and complete attempt evidence more explicit. The scope-procedure mapping applies those same obligations to existing reviewers and says it creates no new charter, approval authority or automatic independent-review claim. These changes are consistent with the already-inspected UX guidance and the established native ownership model; this review does not claim they have improved actual outcomes.

The inspected ASER current-package headers point to proposed v1.4.49, preserve their historical v1.4.38 body scope and narrower earlier review evidence, and distinguish the canonical package from subordinate views. They do not claim that changing a pointer re-executed an old review or installed the proposed behavior. This was a header/pointer check, not a new full audit of every ASER document body.

## Residual obligations

The first contribution profiles, delivery priority, admitted code/UI/runtime/distribution boundaries, actual authority mapping and profile-specific dependency/recovery decisions remain open as recorded in the prior receipt. The final delta does not select Obsidian first, mandate a marketplace or companion, alter the native evidence owners, or assert runtime support.

Urgent containment still requires proof of the actual selected control, authority, propagation, acknowledgements and uncertainty handling. Human approval through a custom UI still requires actual authenticated action and native readback. Historical usability and shared-connection protections retain their previous future acceptance obligations. The small current-research link correction requires exact-diff/source reconciliation but does not authorize further scope.

**Final scope statement:** document hashes and textual consistency were checked; system behavior and human outcomes were not observed. No input was edited, no moving live worktree was used as review evidence, and no publication, native record, package/runtime, accessibility, human usability, protected approval or release result is claimed.
