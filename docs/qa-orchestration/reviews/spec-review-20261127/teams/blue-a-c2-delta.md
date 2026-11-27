# Blue A — informed C2 correction verification

**Date:** 27 November 2026. **Reviewer:** `/root/blue_a`. **Scope:** focused recheck of PLUGIN-B-A01/A02, the connected retained-data authority clarification, and incoming development changes affecting the source/ownership claims relied on here. **Disposition:** both original documentary recommendations are **CLOSED at C2**; the future implementation and runtime gates remain open. No new scoped Must-Fix was established.

This is informed correction verification by the original reviewer. The assignment named the earlier recommendations and requested checks, and C2 contains authored remediation and an explicit reference to Red A's source finding. This is not fresh discovery, a new cold team member, human approval, a complete source audit or an efficacy experiment. I did not read another member's report for this recheck.

## Inputs, preservation and checks actually performed

- Frozen target: `/workspace/scratch/e50b253d95e4/review-candidate-v149-c2/`.
- `INPUTS.json` SHA-256: `c722c8e75521a495a1560f562324bfc27ad2b2e8e318f0d4986b80a18b1a760c`, independently recomputed and matched to RUN_CONTEXT.
- `RUN_CONTEXT.md` SHA-256: `6a5751f161daf02fb0d928f43ddc39e88144f4f85283bd8fd86a8a096a04001f`.
- Independently checked all fifteen manifested C2 file lengths and hashes: **15/15 match**. This was a narrow byte-integrity check, not execution/signoff of the declared Green document verifier, semantic lint, scanner or product tests.
- Original report `blue-a.md` remains unchanged, SHA-256 `85a59fa817132c45d6a7130ca79bf923624b12854fbd6d5cab3a90bc5e23695b`.
- Original source pin remains `f92c3341eadc03f274becbead3b0f45d0a86539e`; current integration parent is separately identified as `d440c48ede32ca38783b178ea6d957ded8bca9e4`, independently resolved with Git.
- Unchanged methodology remains the Blue v2.7 charter, orchestration and portability policy at the identities recorded in `blue-a.md`; no charter, quorum or authority change is adopted here.

Read C2 RUN_CONTEXT/INPUTS; all nonempty C1→C2 differences relevant to canonical 03/05, subordinate Skills, research, source manifest and incoming AGENTS/CLAUDE; current changed passages in their owning files. Compared relevant source files across f92/d440 and inspected the full selected legacy/MCP source diffs, new migration V167, current project knowledge-read paths, and current sync state/write boundaries. The eight canonical file hashes show only canonical 03 and 05 changed from C1. I did not reread all canonical historical bodies, rerun the original wider review or certify new unrelated development work.

## 1. PLUGIN-B-A01 — CLOSED as a documentary qualification gap

**C2 evidence:** `03_TECHNICAL_DESIGN.md` lines 2119–2121 now uses “Source-connection identity and cardinality” and explicitly requires qualification of sequential source/account replacement even with one active connection. It separately qualifies simultaneous accounts when selected, retains legitimate same-account credential renewal, and binds delayed work to original source identity and connection/configuration generation. `05_IMPLEMENTATION_BACKLOG_AND_TEST_PLAN.md` line 2336 supplies the discriminating A→B replacement/colliding-ID/old-A-work case and a same-account-renewal comparison. The supporting research decision row has the same scope correction.

This addresses both sides of the original recommendation: account replacement cannot escape qualification merely because simultaneous cardinality is one, while credential renewal does not automatically create a new business source. C2 retains the existing source owner and asks whether a migration is needed rather than prescribing a schema change without evidence.

**Source correspondence:** V47, V72, V97 and the integration client/service/processor/types are byte-identical between f92 and d440. The inspected full legacy diff leaves the relevant callback upserts and disconnect behavior unchanged. At d440, the Jira/Notion/Linear callback upserts still use `(organization_id, provider)`; `integrationDisconnect` is now at lines 14931–14978 and remains identical to its earlier method body. Thus the source reason for the qualification remains applicable; integration of development did not silently remove it.

**Closure limit:** only the wording/proof-allocation defect is closed. No account replacement, collision, renewal or delayed-event case ran. Correct implemented source-generation behavior remains unverified and is still an implementation gate.

## 2. PLUGIN-B-A02 — CLOSED

**C2 evidence:** `docs/specs/agent-synchronized-engineering/skills-governance.md` line 3 now identifies the proposed **1.4.49 (BACKLOG / NOT FROZEN)**, links the current source manifest and applicable review, and preserves historical bodies/receipt scopes. The current-pointer contradiction with the eight-file package is removed without promoting the subordinate view into a ninth canonical owner.

Verified C2 file SHA-256: `cc850737c2995a86dc285fc02791e41fd598658c3afe1d13af727637cd2b9310`. The manifest's current revision and separate integration parent agree with this pointer. This closure does not assert publication, freeze or native activation.

## 3. Retained-data read authority — clarification accepted at document/source level

**C2 evidence:** canonical 03 line 2143 now separates disconnect/code removal from revocation of the applicable read authority. It preserves separately authorized project-owned knowledge/history, denies retained derivatives when their actual read grant is revoked, and requires a policy owner, migration and full affected reader/index/cache/export mapping before introducing source-specific retained-data permissions beyond current project access. Canonical 05 line 2339 separately tests disconnect/removal and read-grant revocation.

The inspected d440 source supports this allocation:

- `legacy.service.ts` 14956–14974 clears provider credentials and disables mappings but deliberately leaves the knowledge folder and imported documents intact.
- `getKnowledgeDocument`, lines 12475–12484, checks project access and reads the project-scoped, nondeleted document. `getKnowledgeDocumentHistory`, lines 12492–12515, checks the same project access and routes mirror history to the existing sync-event owner.
- `requireProjectAccess`, lines 4117–4139, establishes current accessible project/workspace membership for those reads.
- Unchanged `rag-retrieval.service.ts` lines 270–281 and 320–332 scopes retrieval by project, deletion and applicable document eligibility. This selected reader does not establish a universal source-account revocation policy.

The clarification therefore preserves actual native ownership instead of treating provider disconnection as an implicit new knowledge-access rule. It also retains the necessary converse: retained bytes or a usable native view cannot grant access that has been revoked. Existing canonical 01's access-revocation obligation and canonical 04's current-grant-before-sensitive-readback contract remain compatible with this scoped interpretation.

**Limit:** this is not an all-reader authorization audit or a proof of concurrent revocation behavior. I did not inspect every export, cache or embedding consumer. C2 correctly keeps that sweep as a prerequisite for any additional source-specific permissions.

## 4. Development integration and retained implementation gate

I independently compared f92 and d440 rather than treating the declared integration parent as proof. The following relevant files are byte-identical: V47/V72/V97; integration-sync client, processor, service and types; Skills resolver; RAG retrieval; knowledge-document revision helper. The full legacy-service diff contains other development changes, including a native automation handoff and task-readback adjustments, but does not alter the inspected connection/disconnect/Skill-approval/Skill-assignment methods. Exact method-body comparisons also confirmed identical `integrationDisconnect`, `approveSkillVersion` and `assignSkill` bodies despite shifted line numbers.

MCP source **did change**, so the original f92 observations must not be silently presented as the complete current implementation. The inspected additions distinguish API-token grants from OAuth client preapproval, restrict OAuth preapproval to read, reuse current project authority, and retain separately revocable human consent. V167 adds consent provenance subordinate to `externalMcpAccess`; it does not change integration connection/mirror keys or create plugin authority. The incoming AGENTS/CLAUDE additions reinforce exact identity, effect-boundary authority, truthful uncertainty and discriminating tests. No contradiction with the affected C2 ownership claims was found in this selected comparison. OAuth deployment/reachability and the wider new handoff implementation were not certified.

**The newly explicit sync effect-fence gate remains OPEN.** C2 canonical 03 line 2125 and canonical 05 line 2335 accurately avoid calling the current path proved safe or fixed. Independent source inspection at d440 confirms:

- `integration-sync.service.ts` 194–200 sets `running` by run ID without a terminal-state predicate.
- `integration-sync.processor.ts` 481–525 can await provider/comments/analysis before further writes.
- Its mirror transaction at 569–600 checks the provider folder and performs the native upsert without rechecking original run/connection generation inside that transaction.

These observations support retaining an implementation/reproduction gate. They are not a runtime reproduction or proof of a particular production incident. Closing A01's acceptance-wording recommendation does not close this separate source-level protection gap.

## C2 member disposition

**Accept the scoped corrections for continued PROPOSED / BACKLOG reconciliation.** PLUGIN-B-A01 and PLUGIN-B-A02 are closed as documentary recommendations at this exact C2 manifest. The retained-data authority clarification fits inspected current owners, and the limited incoming-development comparison introduces no contradiction requiring another correction in this scope.

All implementation, source-generation/effect-fence, packaged invocation, native persistence, UI, human and runtime acceptance gates remain as stated. No product execution, database/native write, package install, deployment, scanner execution, Graph computation or human approval occurred. The original C1 report and its evidence limits remain intact; this separate receipt supplies only informed C2 delta verification.
