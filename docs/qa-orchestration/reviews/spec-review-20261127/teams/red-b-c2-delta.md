# Red B — informed C1→C2 correction verification

**Date:** 27 November 2026  
**Reviewer:** `/root/red_b`  
**Assignment:** focused documentation recheck of retained-data read authority, sequential source replacement versus valid renewal, the explicit sync-fence limit, current-package pointer and incoming development. No whole-system audit or runtime verification.

## Current member disposition

**No new material C2 documentation defect established in this focused recheck.** Continue with **PROPOSED / BACKLOG / NOT FROZEN**. The corrections preserve valid native/no-plugin alternatives and make an existing implementation risk more explicit. They do not close that risk.

My original C1 “no material defect established” conclusion remains an immutable, bounded historical review result. It must not be read as establishing a complete sync effect fence, proving retained-data policy, or qualifying sequential account replacement. This recheck independently corroborates the source shape now disclosed by C2 and retains its named implementation gate. I am not retroactively attributing this concrete corroboration to my first review.

This is informed correction verification. C2 and the assignment disclosed the correction topics; its text also names another reviewer and links a finding. I did **not** open that report or any peer/preparation report. No independent discovery, efficacy, formal Red quorum, human approval, Graph CLEAN or freeze claim follows.

## Identities, preservation and actual scope

- C2: `review-candidate-v149-c2/INPUTS.json`, SHA-256 `c722c8e75521a495a1560f562324bfc27ad2b2e8e318f0d4986b80a18b1a760c`. Its 15 artifact identities all matched actual lengths and SHA-256 values.
- C1 identity remains the original input manifest `dd8fa57f48ebcfe054dc98c69215539ea669ac932136291a622f5fe123233bfb`.
- `team-reviews/red-b.md` remains unchanged, SHA-256 `ebb5538bbb51448ac07174bec68c654a80141188fc1d83d4d06e28a6e49f47fa`.
- Historical source pin: `f92c3341eadc03f274becbead3b0f45d0a86539e`; current integrated development pin: `d440c48ede32ca38783b178ea6d957ded8bca9e4`. These are separate evidence identities.
- Unchanged method source and obligations remain those recorded in the original report: Nesberry `d83549c85a4dcd047fb40dc4fba4ec62737ab0fc`, Red charter, orchestration and portability policy. This recheck did not alter or re-admit those methods.

I read C2's `RUN_CONTEXT.md`, `INPUTS.json` and the complete C1→C2 diffs for AGENTS, CLAUDE, canonical 03 and 05, supporting plugin research, subordinate Skills view and source manifest. Six other canonical C1→C2 diff files are empty (00, 01, 02, 04, 06, 07). I verified that canonical 06 is byte-identical to C1; its conceptual probes are not rerun or promoted into stronger evidence. The two new verification-script artifacts were checked for manifest identity only; their logic and scanner behavior were not assessed in this focused Red recheck, and the declared verifier was not executed.

Source reads used `git show`/`git diff` at the exact pins. At current development I inspected:

- V97 soft-disconnect migration, complete;
- `legacy.service.ts` knowledge document/history/version readers (12475–12515, 14226–14232), Jira/Notion/Linear connection upserts (14816–14837, 14863–14887, 14907–14928), and disconnect (14931–14977);
- `integration-sync.service.ts` run transitions (194–204, 270–289);
- `integration-sync.processor.ts` awaited work and mirror transaction (481–527, 569–604);
- the full incoming `mcp-access.ts` diff and changed AGENTS/CLAUDE guidance; a scoped source-diff inventory and legacy diff hunk locations to locate the changed boundary.

V97 and the entire integration sync client/service/processor and Skills resolver files are byte-identical between the two source pins. Legacy changes do not alter the selected knowledge readers, connection callbacks or disconnect implementations; their line offsets changed. Incoming MCP/OAuth work is substantial and was **not** comprehensively re-audited here.

## Correction checks and counterexamples

| Topic | Source/document evidence and independent challenge | Disposition |
| --- | --- | --- |
| Retained-data read authority | Current `integrationDisconnect` clears credentials, disables mappings and deliberately preserves imported knowledge (14943–14974). `getKnowledgeDocument`, history and version reads require current project access. C2 canonical 03 now distinguishes removing provider access/code from revoking a reader's separately authorized project knowledge, while preserving denial when the actual read grant is revoked. Canonical 05 tests disconnect and read revocation as separate changes. | Correct scope distinction. A user may legitimately read retained project-owned knowledge after disconnect; retained bytes cannot confer access after the applicable grant is revoked. Adding source-specific retained-data permissions remains a separately owned policy/migration/consumer decision. |
| Sequential replacement and valid renewal | V97 preserves the connection row. All three inspected upserts replace `external_id` and credentials on organization/provider conflict while returning the existing connection ID. A stable UUID therefore cannot prove that the remote account stayed the same. C2 now qualifies A→B replacement even with one active connection, and separately leaves simultaneous-account support conditional. | The correction closes the prior cardinality-only interpretation. Delayed A work must not become B work. Same-account credential renewal is a valid neighbor and need not invent a new source namespace; it still cannot revive revoked authority or bypass the relevant current-basis checks. No collision was executed or observed. |
| Existing sync fence | `failActiveRunsForConnection` sets active runs failed, but `markRunning` updates by ID without a terminal-state predicate. The ticket path awaits provider/analysis work and then enters a mirror write transaction whose inspected guards concern the project mutation lock and destination folder, not the original run/connection generation. Credential clearing and disabled mappings are real countermeasures but do not prove the last write is fenced. C2 explicitly retains this as an open source-based gate, and 05 specifies a paused-worker/refusal control plus legitimate same-generation completion. | I corroborate the stated source limitation. It remains **open before reliance on the proposed guarantee**. The correction is not a fix, executed production defect or justification for another scheduler. Current development does not resolve it in the inspected unchanged files. |
| Current subordinate pointer | The changed Skills header now identifies proposed 1.4.49 through the current source manifest and preserves historical bodies/review scopes. Canonical 06 and its adoption/efficacy limits are unchanged. | The pointer no longer directs the current reader to a stale branch proposal. No active Skill or improved-method claim follows. |
| Incoming development | The manifest adds the current integration parent without changing historical source pins. Incoming AGENTS/CLAUDE guidance strengthens identity, pre-effect authority, recovery and evidence distinctions. The inspected MCP access diff preserves the API-token grant form, adds a distinct OAuth-client form and explicitly restricts that pre-approval to read-only; it does not make pre-approval live consent. | No contradiction found with the valid external-client/native-owner alternatives or the plugin proposal's limits. This is a selected compatibility check, not acceptance of all incoming OAuth endpoints, tests or deployed behavior. |

### Preserved alternatives and temporal boundary

The corrected contract admits these distinct legitimate outcomes: disconnect a provider while retaining permitted project knowledge; revoke the applicable read grant and deny protected derivatives; renew credentials for the same evidenced account without falsely treating it as a new source; replace the account and fence old work; complete already authorized work under the applicable temporal contract while refusing newly forbidden effects. A successful later receipt cannot erase an earlier effect or prove that a denied action never ran. C2's acceptance rows and incoming guidance retain these distinctions.

The no-plugin/manual path, inert content package, independent external client and separately authorized native historical view remain valid. No new registry, permanent provider dependency or runtime implementation is selected by these corrections.

## Verification and remaining limits

Executed checks were limited to file hashes/lengths, empty-diff inventory, preservation of the original report, canonical-06 byte equality and source-byte comparisons. **15/15 C2 manifest artifacts matched.** No application, database, native Tesbo, UI, package installation, runtime, scanner, declared document-verifier or effectiveness test was run.

**New C2 defect counts in this scope: Critical 0; Major 0; Minor 0.** The existing sync source limitation is corroborated and remains an implementation gate; it is not closed or erased by these counts. Retained-data enforcement across every cache/index/export path, actual account-replacement migration, real race reproduction and the full incoming OAuth boundary remain outside this recheck's proof. The selected implementation still requires its normal source, runtime, authority and assurance evidence.

This addendum preserves the first report and records the narrower, informed C2 disposition only.
