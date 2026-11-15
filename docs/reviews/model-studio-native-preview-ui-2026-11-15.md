# Model Studio structural preview UI increment

Purpose: allow human QA to inspect the existing ephemeral native draft preview from Zyra's existing Change impact review page. Reuse its layout/CSS, native API transport, existing project/session/plan guards, ModelStudioPreview and existing test suites. No persisted model, separate assistant, graph database, review board, target action, case mapping or approval writer.

Baseline: development ddb9b240d6e63566272a3cb69ccd797f7ca611f8. Prior PR95 REST/MCP preview is merged. Read the current Next16.4.6 installed client-component/use-client/useParams guides before frontend implementation. No dependency or lockfile changes.

## Native contract

GET on the same project model-preview path reads authenticated availability only: schemaVersion tesbo-fsm-preview-availability/1, enabled, SEQUENTIAL_FSM and fixed32/64 parser limits. Existing project/org membership and final archive/delete/revoke SELECT fence apply. Read tokens may inspect availability but cannot POST preview. It does not enable the server flag or confer model/source/runtime authority. POST and MCP continue using the same parser and existing write-scope/project-lock checks. Default flag remains off; this change only opts in through the existing isolated CI configuration.

## Visible workflow

A collapsed Draft model preview panel extends the existing page without redesigning source binding, history or native run handoff. Enabled availability reveals an explicitly labelled JSON editor and example/load/preview/cancel/clear controls. Disabled/failed/unrecognized availability hides the editor and allows an explicit recheck. The editor is in-memory only, warns that leaving discards it, and has a1000000-character UI intake safeguard (not a model or generation quota). No autosave, cache, browser storage or automatic POST replay is introduced.

Exact input generation and keyed project component bind each result. Editing, clearing, cancelling, loading an example or unmounting aborts/invalidate the pending response and clears results. Old successes and old errors cannot replace current data. Client wire fencing rejects incompatible/authority-bearing result envelopes; it does not reimplement the native model validator. Lost stateless preview responses say the draft remains unsaved rather than borrowing the shared mutation warning's implication of a possible persisted write.

Results retain unapproved/source-unverified/no-runtime truth, display accessible state/transition tables and structural diagnostics, and label the candidate fingerprint as normalized data rather than a canonical revision. React renders all authored text as text. Keyboard/native details/table captions/column headers and focusable bounded scroll region are provided. This is a structural list inspector, not the full graphical Model Studio editor, publication flow or accessibility certification.

## Verification preparation

221 focused native/MCP tests and backend/frontend type checks passed locally. Native availability unit tests cover enabled/default-off state, identity/access and completion refusal, and SELECT-only behavior. Existing API suite adds real availability auth/read-token/no-write checks. Existing UI suite adds four journeys: actual native rendering/keyboard/mobile/reload/no-write; malformed/unsupported/bounded drafts and disabled/denied/network/incompatible responses; delayed edit/cancel/no-replay handling; native project navigation and foreign-project denial. Stubbed service failures are UI failure-path evidence only; genuine success, model refusal and access checks use actual native HTTP/DB.

Selection is14 of400 tests across the existing Zyra API/UI files, comprising five new scenarios and all nine prior preview/source/graph/handoff neighbors. Existing CI lists then runs that exact selection with10 workers. General smoke, Approved-only and existing compatibility suites remain unchanged. Desktop/mobile screenshots are internal CI evidence for visual review, not user deliverables. Preparation status is not executed full-stack evidence: acceptance requires the final exact-head receipt and actual screenshot inspection.

## Remaining gates and side findings

Persisted family/revision authoring, reviewed source authority, activation, generated paths/quotas, case mapping/dispatch, target conformance, full graphical editor, broader keyboard/AT audit and independent successor assurance remain open. No White/Graph freeze verdict is self-issued. The existing parent history page's asynchronous loads have no response-generation fence; it merits separate source/race review rather than being silently declared covered by this new panel's project-key fence. No runtime history leak is asserted without a discriminating fixture. No shared database, manual user stack, paid provider, merge or deployment is changed by this feature preparation.

The existing migrated Plan/Run lineage suite additionally registers the real preview controller/service and exercises locked native REST access: read-token availability remains readable, while write-token and human-session POSTs are refused by the actual project lock before validation, with full business/history snapshot equality. This is prepared real HTTP/PostgreSQL coverage, not a browser-injected plan claim; its executed status belongs to final-head CI.
