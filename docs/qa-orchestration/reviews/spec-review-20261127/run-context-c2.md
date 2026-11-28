# Tesbo plugin/specification continuation — review run context

Date: 27 November 2026. Target: `1alextest/Tesbooboo`. Stage: source-based review of a proposed documentation amendment, not implementation or release acceptance.

## Owner direction and authority

The owner wants Tesbo to be capable of general plugins in the future. Obsidian was one example, not a chosen first plugin. The owner requested assurance-team review and learning from established companies/teams, including successes and pitfalls, then distilling the reasoning for engineering work beyond UX. Current authorization is research/specification reconciliation. The first plugin, marketplace, hosting/runtime/SDK, distribution and implementation priority remain unselected. Future architecture may remain backlog. Existing native authorities and ordinary current behavior remain authoritative.

## Frozen target

`INPUTS.json` identifies 15 exact artifacts, including the same eight canonical files, current entrypoint/subordinate method view, proposed source manifest supporting research and two document-verification bindings. The manifest SHA-256 is `c722c8e75521a495a1560f562324bfc27ad2b2e8e318f0d4986b80a18b1a760c`.

The canonical changes against the saved v1.4.48 input are in `delta/*.diff`. Begin with all eight v1.4.49 sections and the affected method changes, then independently follow the prior contracts and source dependencies your role needs. Full files are provided so this is not restricted to the author's change summary. Scope claims must name what you actually inspected. Do not treat an entire file as read when a tool output was truncated.

The amendment introduces no application source changes relative to integrated development `d440c48ede32ca38783b178ea6d957ded8bca9e4` in `/workspace/scratch/e50b253d95e4/tesbo`. Earlier reviewed-source claims explicitly retain their `f92c3341eadc03f274becbead3b0f45d0a86539e` pin. Use the integrated development commit for current owner checks and the earlier pin to verify claims labelled with it; use `git show <commit>:<path>` or `git grep <term> <commit> -- <paths>`. Do not claim a whole-source/current deployment reconciliation from a selected trace. Its mutable working documents are not the frozen target. The research parent is `7539a739243167b2d6709df1d644bd5b955f6ffc`. The original eight-file v1.4.48 input is `/workspace/scratch/e50b253d95e4/inputs/canonical-v148/`, archive SHA-256 `6665ba660aa208bd35db51b90052fc0b69abc01c6922c197544003e3480b1bef`.

Actors, goals, lifecycle, interfaces and obligations must be reconstructed from those target sources. Plugin runtime/UI is not implemented by this proposal; inspect the native owners that do exist rather than assuming greenfield. No database, production, native Tesbo write, package installation or application test is authorized in this review. Read-only source/docs and isolated document-integrity checks are permitted. No callable Tesbo MCP is exposed in this task, so persistent native synchronization is unperformed. Existing read-only APIs/official documentation may be used to verify claims.

## Unchanged methods and phase limits

Method source is `NesberryEnterprise/Nesberry@d83549c85a4dcd047fb40dc4fba4ec62737ab0fc`, recovered byte-for-byte under `/workspace/scratch/e50b253d95e4/methods/`; see `recovered-methods-manifest.json`. Read the applicable charter, orchestration and portability policy. Resolve application bindings to Tesbo. Nesberry examples, local commands and business policy are not automatically Tesbo policy. No charter text, quorum or protected authority is changed here.

This is an informed delta review of an already-written candidate. It does not retrospectively satisfy earlier pre-architecture gates. Every newly dispatched reviewer starts with `fork_turns=none`; original reports are frozen before cross-review. The candidate contains historical judgments and explicit researched proposals; disclose that exposure. This is not a blind opportunity-discovery or method-efficacy experiment. Prior researcher notes and other team outputs are withheld from initial reviewers; inspect only your assigned inputs until your original output is saved.

Blue and Red each receive two separately invoked members. Green receives two separately invoked members and a declared document verifier; it must distinguish that verifier from unavailable runtime/Graph proof. Grey's Major/Critical candidates need independent corroboration before team adoption. Graph follows specialist reports and records manual versus executed mode; White is the final disposition. The coordinator will preserve actual assignments, identities, evidence and gaps. No source review can establish a running plugin, valid human approval, native case execution, UI accessibility, deployed safety or computed Graph CLEAN.

## Output

Write a self-contained original report at the assigned `/workspace/scratch/e50b253d95e4/team-reviews/<member>.md`. Include exact assignment, role, no-history dispatch statement, input/method identities, inspected scope, evidence mode, findings and counterevidence, scenario/trace where useful, severity/disposition, uncertainty and actual verification. Derive your own questions; zero findings is legitimate. Keep source findings distinct from hypothetical risks and future choices. Do not edit the candidate, repository, charters or other reports. Report completion and material blockers to the coordinator. Later informed corrections must be appended or saved separately; preserve your first output unchanged.

## C2 continuation and verification binding

C2 preserves C1 and corrects initial review findings: connector disconnection versus actual retained-data read revocation, sequential account replacement, an existing sync effect-fence proof gap, and the stale subordinate current-package pointer. These are explicit authored changes, so exposure to them must be disclosed; they do not supply the reviewer's question list or expected conclusion. Original peer reports and preparatory reports remain withheld for a new role's initial pass. Independently inspect their underlying sources when needed.

PR315 merged externally as 907076b6df572d6b161ce2bd334d083f450413b7. Its exact research bytes were preserved with the current follow-up in existing PR295. Incoming development and its AGENTS/CLAUDE additions were merged without application alterations. Existing C1 first reports remain immutable; no earlier review is relabelled C2. `change-from-c1/` provides exact changes, and `delta/` still covers all canonical changes from the saved v1.4.48 input.

Declared document verifier, run from `/workspace/scratch/e50b253d95e4/tesbo`:

```
python docs/qa-orchestration/reviews/spec-review-20261127/verify-documents.py --candidate /workspace/scratch/e50b253d95e4/review-candidate-v149-c2 --baseline /workspace/scratch/e50b253d95e4/inputs/canonical-v148 --output /workspace/scratch/e50b253d95e4/team-reviews/<member>-document-integrity.json
```

This is only an exact-byte/manifest/preserved-body/current-pointer/document-pin verifier. Independently inspect its limits; no semantic, runtime, native, UI, Graph or effectiveness acceptance follows. Green needs actual verifier execution plus independent signoff, scoped to this declaration. Local Docker/Gitleaks are unavailable; the exact excepted ordinary prose and scanner control rules are unchanged, with current document digests refreshed. Full scanner execution and current-head remote CI remain separate gates. Temporary negative controls may use isolated copies without modifying frozen candidates or the repository.
