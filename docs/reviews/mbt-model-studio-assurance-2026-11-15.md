# Model Studio MBT-001 — unexecuted assurance review manifest

**Status:** REVIEW INPUT ONLY — no team findings or team verdicts are represented by this file.
**Target:** Tesbo Model Studio proposal in the existing `docs/FEATURE_DOCUMENTATION.md`, section MBT-001.
**Date:** 2026-11-15.
**Source context:** `1alextest/Tesbooboo`, `development` and draft PR #90; obtain and pin the exact spec SHA and source SHA at the start of each actual review.
**Review objective:** Independently challenge the specification for missing, contradictory, untestable, redundant, unsafe, unworkable or unnecessary requirements. Identify genuine issues, justified alternatives and legitimate nonissues. No preferred finding count or answer has been supplied.

## Required original review method

The authoritative team methodology is in `NesberryEnterprise/Nesberry`:
`.kiro/steering/teams/README.md` and `.kiro/steering/teams/review-orchestration.md`, together with each existing canonical role charter and its specialist agent/rules. This PR does not edit or override those charters. Apply their normal orchestration and stages to the **Tesbo specification**, with an evidenced Tesbo application context; do not transplant Nesberry marketplace policies.

For each team, provide the pinned Model Studio spec and the relevant Tesbo code/architecture, product decisions and integration constraints. The aim is to discover and verify flaws in **the specifications**, not to qualify or retune the teams. Begin each independent review without previous role outputs, original analyst findings, proposed fixes, or a known-issues answer sheet. Preserve the original unedited findings before reconciliation. Reviewers may find that a requirement is correct or that an apparently missing capability already exists; record both honestly.

Use the roles already defined by canonical orchestration, including Blue, Red, Green, Grey/SUJT, QA, Security, Purple, Graph Assurance, Elephant-Gold and White, without rewriting their questions, inventing new team roles, merging roles, or preassigning conclusions. Specialist coverage and sequencing are determined by the original orchestration, not this manifest.

## Evidence requirement

Every actual finding should identify the exact requirement or omitted user journey, why it is defective, the user/engineering consequence, evidence from existing Tesbo or a comparable alternative, severity, and a falsifiable acceptance test. Disagreement is permitted. Mark observations as spec-only, source inspected, CI executed, or deployed; do not represent unexecuted scenarios as tests.

## Status checkpoint

- Current deliverable is an authored draft specification, **not a completed team review**.
- No independent team execution is recorded in this PR.
- An earlier single-analyst lens narrative was withdrawn from the review input so it cannot contaminate cold team findings. It remains reachable in Git commit history for audit; it is not evidence of independent team sign-off.
- The Model Studio proposal remains unimplemented and is not approved for rollout by this document.
- The latest eight canonical Tesbo specification files still require source-preserving reconciliation; the v1.4.21 raw ZIP was not available for that operation in this session.

**Review output destination:** record independently produced, original role findings and evidence in this existing review area after the respective review executes. Do not append imagined team verdicts to this manifest.


## PR #100 — current pinned implementation review input (2026-11-16)

**Target:** Tesbo `1alextest/Tesbooboo` PR #100, `feat/qa-mcp-lifecycle-provenance-20261116`, on the `development` branch after PR #98. Pin the **exact head SHA and canonical specification package SHA** before real reviewer dispatch; this section intentionally does not predetermine any role's result. The originating 50-tool Nesberry agent observations are external read-only evidence, not an executed end-to-end proof.

**Proposed review boundary:** Existing Zyra draft preview, graph history capture, graph-to-native case/run handoffs, QA gap summary, native cycle `commit_sha`, source `observedCommitSha`, MCP token catalog and credential-scoped operations. The specific implementation increments are: current-selection vs historical-only discrimination; read-only reported source/run commit comparison; and a disposable MCP create/read/revision-guarded-update/archive test. Native requirements, cases, executions, run membership, attachments, notification delivery, approved checkout binding, project/org access and plan locks remain authoritative owners. No new model persistence or test-result store is proposed.

**Review question (not a preassigned verdict):** Do the specs and implementation correctly distinguish durable handoff, current execution eligibility, timestamped result, source-byte identity, caller-reported run revision, actual deployed target revision, evidence-byte validity and human acceptance? Can the current implementation's contracts be satisfied through native owners without a duplicate graph/approval/actor service? May a legitimate alternative skip a model entirely and still run ordinary cases? Classify all unknowns and justified nonissues explicitly. The roles must independently derive checks, counterexamples and remaining gaps from their charters, not repeat this prompt's issue vocabulary as their findings.

**Existing source-inspected observations, NOT independent team findings:**
- Soft-removed case/run links had been counted as current selection by `summarizeQaVerificationGaps`. PR #100 now distinguishes current vs historical-only; unit and database proofs are required at exact head.
- The native source graph can pin Git bytes and native runs can store a caller-reported `commit_sha`, but there is no proven trusted deploy-to-target attestation linking them. PR #100 surfaces only an unverified reported comparison, not behavior/coverage/approval.
- The external connected client can read Nesberry but its 50-tool catalog differs from current source. Need a fresh authenticated server/catalog receipt and separate authorized disposable connection; source code tests do not resolve this.
- The existing independent role orchestrator is **not exposed as a callable agent runner in this conversation**. No role dispatch, independent findings, mandatory Graph closeout, White freeze or deployment has been executed here.

**Required real review receipts:** Per role, capture charter revision, isolated invocation ID, source/spec SHA, actual documents/tools inspected, original findings and severities, counterexamples, acceptance oracles, execution mode and unknowns. Run normal Blue→Red→Grey→White pre-gate and successor specialist sequence through Graph→White; do not edit or lead the teams' verdicts. Keep unedited role outputs before reconciliation. A report compiled by the implementation author does not replace independent reviewers.

**Release separation:** CI can prove the isolated local stack and disposable project. Public deployed MCP tool/version verification, actual tester-to-application browser/device execution, matching target build, retrievable evidence bytes and human approval require distinct authorized end-to-end evidence. Keep that status BLOCKED until actual proof.
