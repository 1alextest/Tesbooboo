# Exact assurance-method recovery for scoped Tesbo review

**Date:** 27 November 2026. **Recoverer:** `/root/plugin_precedents`. **Status:** source recovery and orchestration interpretation; no charter edits, formal review verdict, live execution or product authorization.

## Assignment

The parent requested recovery of unchanged original ten-team methods from the manifest in `docs/specs/agent-synchronized-engineering/reviews/full-team-v1.4.38/Tesbo_Assurance_v1.4.38.tar.xz`, rooted at `NesberryEnterprise/Nesberry@d83549c85a4dcd047fb40dc4fba4ec62737ab0fc`. Required outputs were exact local copies with original paths and hash verification; reading orchestration and portability; feasible review order/quorum and documentation-phase limits; no new role labels, method rewrites, changed quorum or blind-discovery claim.

## Recovery method and integrity

1. Read the archive's `verification/method-charter-source-manifest.json` directly with Python `tarfile`; saved its original bytes as `methods/historical-method-charter-source-manifest.json`.
2. Selected core team charters, their runnable agents, orchestration, human-readable indices, portability/evidence policies and necessary Purple/Graph/Security source owners. Did not recover the entire unrelated historical source pack or its large UX/spec vocabulary files.
3. Fetched each selected path through the authorized GitHub connector's contents read with the exact `ref=d83549c85a4dcd047fb40dc4fba4ec62737ab0fc`.
4. Encoded each returned text as UTF-8 without edits; verified the byte length, Git blob object SHA-1 (`blob <size>\0<bytes>`) and SHA-256 against the archive manifest before accepting the file. Larger responses were written to temporary download files and renamed only after all checks passed.
5. Saved 25 exact files with their original relative paths beneath `/workspace/scratch/e50b253d95e4/methods/`. The complete new verification receipt is `methods/recovered-methods-manifest.json`.
6. Read `review-orchestration.md` and the portability policy in full. Read the Green membership/review cycle, White final-freeze rules and EG stance/receipt sections; located explicit quorum passages in Blue, Red, Green and Grey. Files recovered for future reviewers are not all claimed read in full by this recovery task.

All 25 selected files matched all three identity checks. The historical manifest's `current_main` field remains historical; no claim that today's upstream main is identical was made. The recovered files are unchanged evidence inputs outside the Tesbo repository, not installed or modified skills.

## Ready source paths

All following paths are relative to `/workspace/scratch/e50b253d95e4/methods/`:

| Role or control | Exact recovered source |
| --- | --- |
| Orchestration | `.kiro/steering/teams/review-orchestration.md` |
| Role index | `.kiro/steering/teams/README.md`; `docs/review-charters.md` |
| Blue | `.kiro/steering/teams/blue-team-charter.md` |
| Red | `.kiro/steering/teams/red-team-charter.md` |
| Green | `.kiro/steering/teams/green-team-charter.md` |
| White | `.kiro/steering/teams/white-team-charter.md` |
| QA | `.kiro/steering/teams/qa-team-charter.md` |
| Grey / SUJT | `.kiro/steering/teams/synthetic-user-journey-team-charter.md`; `.claude/agents/grey-team.md` |
| Elephant-Gold | `.kiro/steering/teams/elephant-gold-team-charter.md`; `.claude/agents/elephant-gold.md` |
| Security | `.claude/agents/security-team.md`; `.kiro/steering/guard-security-privacy.md` |
| Purple | `docs/reviews/NESBERRY-PURPLE-TEAM-DESIGN-ASSURANCE.md`; `.claude/agents/purple-team.md`; `docs/reviews/NESBERRY-PURPLE-TEAM-REVIEW-RUNBOOK.md`; `docs/purple-team.md` |
| Design Blue/Red consumers | `.claude/agents/design-blue-team.md`; `.claude/agents/design-red-team.md` |
| Graph Assurance | `.kiro/specs/graph-assurance/requirements.md`; `.kiro/specs/graph-assurance/design.md`; `.kiro/specs/graph-assurance/tasks.md` |
| Portability | `docs/policies/governance/POL-GOVERNANCE-ASSURANCE-PORTABILITY/v001.md` |
| Evidence policy | `docs/policies/governance/POL-GOVERNANCE-ASSURANCE-EVIDENCE/v001.md` |

The canonical ten roles are Blue, Red, White, Green, Security, Purple, QA, Grey/SUJT, Elephant-Gold and Graph Assurance. Operability concerns remain applicable work for existing owners; this recovery does not add a separately defined eleventh team.

## Governing order without method changes

The canonical sequence is problem reconstruction/completeness → Blue archaeology → Red premise challenge → Grey/SUJT pre-design reconstruction for user-facing work → White pre-architecture gate → design candidate → concurrent Green/Blue/Red/Security/Purple/QA/Grey/EG reviews → Graph closeout → White final verdict.

For this existing documentation candidate, retain historical completed gates as historical receipts, identify what the present scope changes, and run an informed delta review. Do not pretend the existing candidate was written after a new pre-architecture gate or that prior findings were freshly discovered. New state owners or unresolved architectural changes require the appropriate upstream review rather than skipping straight to a final sign-off. The orchestration's prose contains an older `Gate C` label in its architecture paragraph; follow the explicit governing sequence with White before design, rather than using that label as a bypass.

With four available agents, the reviews can be scheduled in successive batches. Concurrency limits do not reduce quorum or replace a missing role. Separate original outputs must be retained before reconciliation; the exact artifact revision, scope, method revision, evidence mode and exposure to prior conclusions belong in each receipt. Changes made after a review trigger a review of the affected delta and consumers.

### Membership and quorum actually stated

- **Blue:** two members for a formal verdict, at least one independent of the spec area; the charter also seeks grounding from those who wrote/deployed relevant code (`blue-team-charter.md` membership, reviewed lines 255–256).
- **Red:** the same two-member formal quorum and independent member requirement (`red-team-charter.md` reviewed lines 160–161).
- **Green:** two members, declared target verifier exit 0 and reviewer sign-off; includes the spec maintainer/verifier operator and at least one reviewer independent of the active area (`green-team-charter.md` membership). A Nesberry command is not automatically the Tesbo command: declare the actual target verification binding and its limits.
- **Grey/SUJT Major/Critical findings:** one journey runner plus an independent reviewer (`synthetic-user-journey-team-charter.md`, reviewed line 707). A single agent's high-severity scenario is a candidate until independently reviewed.
- **Other roles:** no blanket numeric quorum is invented from role names. Apply their own methods, explicit evidence and sequencing obligations. White checks the required disposition of each role, not merely whether its name appears in a table.

This recovery does not certify that those quorums have been met in the current task.

## Cold invocation and informed evidence

Orchestration and the EG charter state that team agents start cold at dispatch. EG additionally re-derives instead of absorbing the repo framing. EG's binding stance explicitly requires no inherited conversation/session memory, such as `fork_turns="none"`, or a recorded equivalent. An instruction to forget does not establish isolation.

The current researcher inherited the parent conversation and contributed findings. It cannot be reused as a fresh EG reviewer of its own work. Its earlier Purple/Blue precedent challenge remains useful supporting research, but it is not retroactively a formal cold-team receipt. Commission a new no-history invocation for that role, supply a neutral pinned input package and record the actual invocation evidence.

The candidate itself already contains historical findings. Even a no-history reviewer must disclose that exposure. It may re-derive from primary sources, but agreement with embedded historical findings is informed corroboration; it is not a held-out or blind discovery experiment. Preserve the exact given/not-given context and do not remove necessary authoritative decisions merely to manufacture apparent blindness.

## Documentation-only phase limits

The portability policy preserves reasoning/evidence obligations while resolving application-specific policies, source paths, commands, actors and authority from Tesbo. Nesberry business examples, target commands and operational assumptions do not automatically bind Tesbo. Missing sources are UNKNOWN/BLOCKED for the affected claim, not N/A.

The proper current outcome is review of proposed contract adequacy and reconciliation. The plugin platform, external runtime, marketplace and UI remain unimplemented unless current Tesbo evidence establishes a specific existing part. Source inspection, conceptual journey simulation, runtime execution and deployed observation must stay distinct.

For a full-team request, Grey must produce the material journey inventory from jobs/actors, requirements/lifecycle, entry surfaces, and actual code/data ownership where available. A spec-only new contribution marks its absent implementation NOT AVAILABLE, while existing native owners still require inspection. QA challenges the inventory and its testable outcomes. Count inventory, G0/G1 conceptual traces, G2/G3 execution, blocked and untested separately. Do not equate two illustrative plugins with complete journey coverage.

Graph may provide a clearly labeled **manual assessment** using the target's existing ownership and evidence map. Its receipt must name mode, version, evidence and limitations. An unimplemented graph checker is not an executed harness, and static text validation does not establish runtime enforcement.

Purple can assess semantic clarity and the proposed user contract. Authentic current-UI comparison is unavailable unless a real running baseline was observed. No screenshot/mock should be claimed from this documentation review, and no visual parity or accessibility runtime pass follows from prose review.

White remains the last gate. It requires relevant role dispositions, resolved material findings, traceable requirements/design/tasks, a properly qualified Graph closeout and explicit deferred seams. Use its actual FROZEN / FROZEN WITH NAMED GATES / NOT FROZEN outcomes only when the applicable evidence supports them. Specification merge does not authorize implementation, activate a plugin, establish product acceptance or constitute a native human approval.

## Implication for the new generalized engineering lesson

The unchanged methodology already requires archaeology, adjacent research, principle-first distillation and transfer. Check those owners before adding a new universal obligation. If the proposed lesson materially changes a reusable rule/skill, orchestration requires a bounded transfer receipt: fixed wording, originating regression, at least two other application contexts and unlike capability families, a defective/conforming pair, valid alternative, missing-evidence case, oracle and evidence mode. At least one probe must not have authored the rule; disclose contamination and do not rename a known-defect replay as discovery.

When that admission evidence is unavailable, retain the lesson as a candidate/scoped checklist in the existing owner. No fixed source count, mandatory new registry, unconditional infrastructure build or changed review quorum is justified by this research.

## Remaining work

The parent can now dispatch qualified scoped reviews using these exact method paths and a pinned candidate. Reviewers must load the sources relevant to their role and resolve indirect references against Tesbo's run context. This recovery supplies files and interpretation, not the required final full-team receipts or runtime/native evidence.
