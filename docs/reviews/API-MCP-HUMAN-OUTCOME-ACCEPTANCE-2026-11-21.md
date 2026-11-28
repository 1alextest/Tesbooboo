# API & MCP human-outcome acceptance suite — proposed, not executed

**Scope:** `development` source; page `/projects/:id/settings/api-tokens`. **Status:** TEST DESIGNS / NOT RUN. The matching human-outcome review is [here](./API-MCP-HUMAN-OUTCOME-REVIEW-2026-11-21.md). These are proposed Tesbo-native requirement/test-case candidates; they have NOT been created in a Tesbo project through MCP and do not impersonate run evidence.

## Fixture ownership and safety

Use an isolated authorized QA project and approved role-based human sessions. Create only **synthetic** token/client identifiers, no external real-service access or production messages. Before each test record verified build SHA, project/organization identity, role, browser/viewport and effective server policy. Redact every one-time token, bearer value, CI secret, clipboard and error body from screenshots, attachments and logs. Maintain positive/negative/expiry/interrupt scenarios with cleanup and expected residual state. Only explicit project owners approve MCP grants or scopes.

**Do not run destructive or external write tests without human permission**. Read-only inspection of actual page behavior is independent of a separate, authorized synthetic integration test. No client certification, human comprehension, or actual Playwright report delivery is implied by passing a read diagnostic.

## Case inventory

| ID | Target human outcome / test objective | Independent oracle | Evidence needed | Current status |
| --- | --- | --- | --- | --- |
| API-MCP-HO-01 | First-time manager with no token can identify the correct prerequisites, create a Read-only token, approve its named client, enable external MCP, configure a supported client and verify limited Read access | Server grant/consent states, real client `tools/list` + project identity, no forbidden scopes; note missing steps and backtracking | Masked screen capture + synthetic-server receipt + consented task completion if studying usability | NOT RUN |
| API-MCP-HO-02 | Returning manager can distinguish global Off, token valid, named grant enabled, grant expired, revoked token, wrong project and disallowed tool from each other | Controlled credential state matrix + actual endpoint dispositions; user explains each display correctly | Role/state transcript with independent server truth | NOT RUN |
| API-MCP-HO-03 | Read-only MCP diagnostic never claims to prove Write or Playwright reporting and never performs a write | Check `tools/list`, `list_projects`; read token success; same token's synthetic write refused; no project mutations, token cleared after check | Network/source traces, no secret material | EXISTING TEST SOURCE; NOT RERUN |
| API-MCP-HO-04 | QA/CI operator can tell which scope permits reporter work and can verify that real results reached Tesbo | Read-only token fails reporting cleanly, authorized Read+Write token produces a synthetic Test Run with exact linked case/results; CI status alone insufficient | Reporter receipt + Tesbo run/execution ids + server audit | NOT RUN |
| API-MCP-HO-05 | Token/grant creation and revocation respect intended role policy across Owner/Manager/QA Engineer and foreign-project caller | Rendered action availability, backend POST/DELETE/PUT authorized/denied; compare actual policy owner to UI notice | Role-matrix readbacks and API responses | NOT RUN — server policy owner confirmation required |
| API-MCP-HO-06 | One-time secret is visible exactly once and never leaks through token list, preformatted config snippets, tooltips, logs, screenshots or other project context | Creation/reveal/Done lifecycle, redacted capture, no secret in subsequent DOM, storage, network response except one-time create result | Automated security test and redacted evidence | EXISTING TEST SOURCE; NOT RERUN |
| API-MCP-HO-07 | Approved named client cannot reuse a token already granted to a different client, and valid tools/expiry/scopes are enforced | Duplicate grant request rejected; unsupported tool rejected; expired grant blocked; project-switch/issuer exit blocked | Backend API tests plus actual MCP read attempts | SOURCE CONTROL VERIFIED; NOT RERUN |
| API-MCP-HO-08 | Disabling external MCP or revoking client/token stops subsequent authorized calls promptly without affecting native Tesbo use | Held external session followed by a fresh call after state change: denied; native project route remains accessible | Authorization and lifecycle traces; no external writes | EXISTING CODE ENFORCEMENT; NOT RERUN |
| API-MCP-HO-09 | Manager recognizes available live tools rather than mistaking the static 47 examples for all 59 registered or a Read token's 24 exposed tools | Compare current UI copy to pinned live filtered `tools/list`; comprehension task predicts accessible tool list correctly | Masked rendered page, live server SHA/catalog and task responses | SOURCE DISCREPANCY; LIVE NOT RUN |
| API-MCP-HO-10 | Accidental or intentional token revoke has predictable consequences and an available safe recovery procedure | In an isolated test, distinguish intentional emergency revoke from mistaken action; verify invalidation and authorized replacement/reapproval path | User-reported comprehension (if recruited), synthetic client trace | NOT RUN |
| API-MCP-HO-11 | Network failure, wrong token, wrong project, timeout and pending read on navigation each produce truthful non-secret results | 10-second bounded check; abort on navigation; refresh/retry; no stale token/status on new project | Existing Playwright lifecycle test plus screen capture | EXISTING TEST SOURCE; NOT RERUN |
| API-MCP-HO-12 | Screen is usable by keyboard/assistive-tech and across supported mobile widths | Keyboard-only create/approve/tab/copy/check tasks, visible focus, announcements, no inaccessible content/sideways overflow | Actual browser/screen-reader/viewport captures | NOT RUN |
| API-MCP-HO-13 | Manager and coding-agent operator can complete a cross-role handoff without viewing secrets they are not authorized to see | One credential issued and securely handed off, grant approved and client configured, record which actor supplies each precondition | Independent synthetic workflow and consented observations | NOT RUN |
| API-MCP-HO-14 | The interface under review matches the deployed build rather than a stale `main`/development assumption | Deployed SHA, route/component fingerprints and whole-page masked screenshot match source; note any differences | Actual deployed environment artifact, role and timestamp | BLOCKED — runtime/build not captured |

## Outcome-first exploratory evaluation protocol

1. **Phase A (blind):** Give a permitted reviewer the job and actor context, with no expected defect, chosen click path or taxonomy list. Capture actual actions, human/task goal, observed state, server truth and uncertainty. Do not count AI navigation as human success.
2. Freeze Phase A receipts; explicitly label screenshots as actual Before only if captured from the running matching build.
3. **Phase B (informed):** Consult the existing v0.31 human-outcome skill (provisional H01–H16), challenge candidate hidden outcomes, reveal prior reviews and tests. Avoid inventing missing functionality because a catalogue suggests it.
4. **Phase C (verify):** Explain every observed discrepancy and competing cause with a test oracle; route product, security or governance decisions to existing accountable owners. Preserve real successful behavior and non-applicable findings.
5. **Evaluation:** Use independent assessors blinded to reviewer condition, case-level factual adjudication, controlled budget and false-positive penalties. Keep user-owned principle grades distinct from human-observed usability evidence.

## Grade capture — user owns the value judgment

| Candidate principle | User grade (Good / Mixed / Poor / Ungraded) | User reason | What is supported empirically |
| --- | --- | --- | --- |
| P-HX-1 Dependency-legible workflow | Ungraded | Pending | Source order verified; no human task study |
| P-HX-2 Evidence-calibrated readiness | Ungraded | Pending | Read-only diagnostic scoped in source and E2E tests |
| P-HX-3 Permission-transparent decisions | Ungraded | Pending | Static/live source discrepancy, current deployed state unknown |
| P-HX-4 Risk-proportionate lifecycle | Ungraded | Pending | Revocation behavior and one-time reveal in source, no user study |
| P-HX-5 Cross-role outcome completion | Ungraded | Pending | Permissions/role structure in source; actual team handoff unobserved |

**Exit criterion for design promotion:** User feedback and accountable owner decisions; verified current deployed build; any changed interface supported by old/new screenshots, negative/positive/boundary/state tests and preserved original controls; security approval for any token/consent/write behavior; real client and Playwright outcome evidence for claims of operational success. No arbitrary single score can substitute for these.
