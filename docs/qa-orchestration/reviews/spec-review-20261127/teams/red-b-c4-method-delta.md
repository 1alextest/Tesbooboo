# Red B — informed C4 method-transfer delta

**Date:** 27 November 2026  
**Reviewer:** `/root/red_b`  
**Scope:** current canonical 06 method changes since C2, applied to the same two previously defined unlike conceptual cases. This is an informed semantic recheck, not another product audit, fresh discovery trial or empirical effectiveness evaluation.

## Target and inspected scope

- Actual C4 `INPUTS.json` SHA-256: **`5060d011e67a57092f3a4ad2ff1e1b050dcc775e43cc26e62e0cad6333a95bbf`**, matching the assignment.
- Actual C4 canonical 06 SHA-256: **`5c7503220dcf1bed842cfca5cb9f71781f6dd0241b1b27c5c4727c8dd1835041`**.
- Read C4 `RUN_CONTEXT.md`, `INPUTS.json`, the complete generated C2→C4 canonical-06 diff, canonical 06 lines 599–645 and 844–880, and `docs/agent-scope-discipline.md`'s complete “Research-informed engineering and team handoff” section. Checked the retained canonical-03 “Existing sync reuse limitation” paragraph. No peer or preparation report was opened.
- The original Red charter, orchestration and portability policy remain bound to Nesberry `d83549c85a4dcd047fb40dc4fba4ec62737ab0fc`, with the method identities and scope already recorded in `red-b.md`. No charter or authority changed in this review.
- C4's shared distillation and transfer/evaluation gate paragraphs are byte-identical to C2. The revised procedure adds relevant alternatives/cost, observable benefit and failure/result distinctions, research stopping/revisit/reversal conditions, existing handoff routing and the current research link.

The wording was held fixed while reapplying both cases. The cases and their original oracles were already exposed in my C1 report; this deliberately tests conceptual regression and transfer of the revision, not independent discovery. Their results are reasoning over stated contracts, not observed product behavior.

## Discriminating cases

### A. Synchronous offline numerical conversion library

**Unchanged contract/oracle:** a consumer needs a deterministic conversion under independently accepted units, input range, final-rounding rule and error tolerance. No persistent store, remote authority, plugin host or external effect is assumed. The discriminator compares the calculation with the independent reference contract; an implementation's own output cannot supply its oracle.

| Case | C4 application and conceptual disposition |
| --- | --- |
| Faulty | Intermediate rounding violates the accepted final-rounding rule/tolerance. Identify the smallest owning correction, its boundary regression and the observed-outcome evidence still required. A popular numerical library cannot establish correctness by reputation. |
| Conforming/no change | The existing implementation meets the reference contract. Reuse/no change remains valid; the expected benefit is preserving correct behavior and avoiding unsupported complexity, not a fabricated improvement percentage. |
| Valid alternatives | Scaled integers, rational arithmetic or a supported decimal implementation may satisfy the target. Compare relevant range, precision, performance, maintenance and dependency costs. A one-consumer library need not extract a shared service or benchmark every listed architecture category; “where relevant” permits a justified exclusion. |
| Competing explanation/unknown | A unit mismatch or disputed rounding contract may explain the discrepancy. Without an accepted oracle, record UNKNOWN and the accountable decision; do not label the algorithm defective. “Actual validation/result if available” does not require invented test results. |

**Benefit/failure/re-evidence boundary:** the benefit hypothesis is preserved numerical meaning within the admitted domain; a reference disagreement, unsupported range or regression is a failure signal. Cost estimates and missing benchmarks stay labeled. Research can stop with an evidenced no-change decision or a scoped unresolved-contract disposition once further searching is unlikely to alter that decision. A changed range, rounding policy, dependency or observed result reopens it. Reversing an adopted implementation requires compatibility and regression evidence; it does not rewrite prior results.

**Outcome:** the added clauses produce useful decision detail without forcing a platform, persistence, a new feature or an unrelated research program. No numerical code was executed.

### B. Asynchronous warehouse label printing

**Unchanged contract/oracle:** a worker needs one usable parcel label. Paper may emerge before an acknowledgement is lost. The discriminator is the approved outcome plus the actual device's job identity/readback and physical-output evidence. Transport acceptance is not proof of printing; a timeout is not proof of non-printing.

| Case | C4 application and conceptual disposition |
| --- | --- |
| Faulty | Blindly resend after a timeout despite a possible completed print. C4 requires the effect boundary, preserved unique-label obligation and a failure signal that detects duplicate output or false completion. A queue vendor's documented reliability does not settle the device's behavior. |
| Conforming | A supported durable job identity and trustworthy device readback permit reconciliation before replay. Record the expected reduction in duplicate/uncertain outcomes and the actual result only when available. This conceptual case does not supply measured improvement. |
| Valid manual alternative | The device lacks adequate readback. A bounded, authorized operator check before another print can remain the chosen design. Compare operator effort/delay against the implementation, maintenance and device-support cost of automation; the method does not require a new spooler or always-automatic recovery. |
| No change | The existing spooler already satisfies the accepted recovery contract with adequate evidence. Retain it, including its known limits, instead of manufacturing a second queue or new primitive. |
| Competing explanation/unknown | A jam, delay, lost acknowledgement or already removed label may explain “no label seen.” If the device is inaccessible, preserve UNKNOWN and defer the completion claim. Closing the research decision does not convert that unknown effect into safe permission to retry. |

**Benefit/failure/re-evidence boundary:** expected benefit concerns correctly attributed output and fewer unsafe duplicates, with recovery delay/cost recorded as sacrifices. Failure signals include repeated prints, unsupported completion claims or unreconciled job identity. A device/firmware change, changed workload or contradictory observed outcome reopens the decision. “Allow reversal of adoption” permits withdrawing or replacing the future mechanism through its actual owner; it cannot unprint paper, erase receipts or promise rollback of committed physical effects. Failed trials and local exceptions remain preserved.

**Outcome:** the revision retains a valid low-capability/manual design, an adequate incumbent and an explicit unknown. No device, worker, queue or UI was exercised.

## Overbreadth and false-positive challenge

No new material blocker or false positive is forced by the inspected wording:

- The options list is qualified by **“where relevant”**, and the unchanged trigger/proportion paragraph still permits adequate existing research, small work and absence of a public analogue. It does not require implementing all alternatives.
- Expected benefit, failure signal and **“actual validation/result if available”** distinguish a prediction from proof. Supported no-change remains explicit; a decision need not invent a measurable improvement to qualify.
- Research stopping requires supported bounded dispositions, a reason further searching is unlikely to change the decision, and retained missing evidence. It ends a research scope; it does not close missing execution, authorization or oracle evidence.
- Revisit/reversal conditions concern reliance on the adopted choice. The unchanged target-authority and effect-boundary obligations still constrain implementation and recovery.
- The handoff section points to canonical 06 and owns routing/disposition only. The current local research link improves source navigation without becoming a new authority or proof of transfer.

The originating regression remains protected: vendor/process resemblance, signing or apparent installation cannot establish target containment, authorization or an effective result. These replays still do not prove how often the method detects unfamiliar failures or whether its effort/cost is better than the incumbent.

## Verification, preservation and disposition

I inspected and executed the frozen, standard-library document verifier; receipt: `team-reviews/red-b-c4-document-integrity.json`. **51 checks passed; 0 failed**, including the declared 21 file identities and bounded manifest/body/pointer checks. Its hash/ordered-line checks do not establish semantic completeness, runtime correctness, scanner acceptance, native state, human comprehension or method efficacy.

Original reports remain unchanged:

- `red-b.md`: `ebb5538bbb51448ac07174bec68c654a80141188fc1d83d4d06e28a6e49f47fa`.
- `red-b-c2-delta.md`: `1c48a0c37b7f2de81aec71ef46b1bb9bfff21ce3216885191dceaa9a269ee284`.

**Current member disposition:** no new material C4 method defect established in this bounded conceptual recheck (**Critical 0 / Major 0 / Minor 0**). The revision supports these two unlike applications and their faulty/conforming, alternative/no-change and UNKNOWN cases. Keep the method proposed and unvalidated for improved effectiveness; this is not a universal portability claim or a formal freeze verdict.

**RA01 and all source/native/runtime gates remain open at their existing owners.** The inspected C4 sync paragraph still records the missing proved final effect fence and requires safe reproduction, current-authority/generation qualification and legitimate same-generation completion. This method review performs no new source-path, application, database, native Tesbo, UI, package or external-effect verification and does not weaken that gate. No existing report, frozen candidate, repository source, Skill, authority or external system was changed.
