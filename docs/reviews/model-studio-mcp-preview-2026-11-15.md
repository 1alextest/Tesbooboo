# Model Studio native MCP draft preview continuation

Purpose: let agents submit the same ephemeral sequential FSM draft accepted by the existing native REST preview. Extend the existing MCP gateway, GraphChangeReviewModule and ModelStudioPreview; no parallel model authority, assistant, database, runner or remote service.

## Contract

Tool `preview_behavior_model_draft`, arguments exactly `{ "model": <tesbo-fsm-draft/1> }`. Same 32-state/64-transition parser, normalized candidate digest and diagnostics as REST. Project and issuer are taken from the authenticated token. Required scope is `write`, matching native REST preview and retaining the existing project write-entitlement gate. No persisted model/case/run/evidence rows are written; native token usage bookkeeping remains the existing gateway behavior.

`tools/list` statically advertises 53 tools, including this optional capability. Description states the `TESBO_MODEL_PREVIEW_ENABLED=1` prerequisite and default-off behavior. Existing tool fingerprint/session-expiry machinery detects the new schema. Discovery is not proof that the deployment enables preview. Calls while disabled return JSON-RPC ToolExecutionError `-32003` with data `{ code: "MODEL_PREVIEW_DISABLED", httpStatus: 503 }`. This is metadata in an HTTP-successful JSON-RPC error response, not an HTTP 503 transport response. Malformed arguments/model: INVALID_MODEL/400; nonsequential semantics: UNSUPPORTED_SEMANTICS/422; missing native injection: MODEL_PREVIEW_UNAVAILABLE/503. Existing project/scope errors remain unchanged. No caller-supplied source authority, model identity, approval or project override is accepted.

Output is precisely the shared native preview: DRAFT_PREVIEW, NOT_APPROVED, source UNVERIFIED, runtime evidence NONE, null canonical model/revision IDs, all persistence/publication/activation/path-generation/target-execution capabilities false. Structural validity and reachability establish neither target conformance nor executed test coverage.

## Verification scope and preparation status

Unit scenarios exercise real shared native validation through McpService, exact discovery bounds/catalog, malformed and authority-bearing payloads, unsupported semantics, default-off behavior, absent injection, read token/cross-project/write-lock denial and both membership revocation fences. Query assertions allow SELECT only. Real existing Zyra disposable-tenant HTTP scenario compares both MCP transports with REST, tests discovery/read scope/foreign URL/revoked token, typed validation errors and unchanged native case/run/execution/Bug/graph/link counts. Existing isolated CI selects this new scenario plus the prior eight graph/source/QA/preview neighbors, lists the selection before running with 10 workers and does not use a shared production database or paid provider. Two live diagnostic expectations move from 52 to 53 without weakening exact assertions.

Local shared parser/schema checks passed. Native compilation, actual HTTP/DB and regression evidence must be taken from CI on the resulting exact branch head; this preparation note does not claim they passed.

## Remaining gates

Native persisted authoring, source authority policy, explicit activation, review ratification, independent successor assurance, M2 generation/quotas, mapping/dispatch permissions, runtime evidence, target adapters and native UI/accessibility are not implemented by this adapter. White and Graph are not self-cleared. Default production configuration is unchanged; no merge or production deployment is included.

## CodeQL follow-up

PR #95 has a scanner comment for loop-bound injection at the original queue traversal. The queue was internally constructed and deduplicated from at most 32 validated states, but the loop now also states `index < 32` explicitly. A 32-state/64-edge cyclic regression exercises the complete admitted boundary. This addresses the report without suppressing it or weakening validation. The next exact-head scan must establish whether the alert is removed; a passing workflow alone is not a clean-alert receipt.

## Concurrent development reconciliation

Development advanced from d65c6211 to 9ad2af49 while the adapter was prepared. Reconcile against that merged Approved-only REST/MCP/automation implementation; retain its transactional cycle writer and tests, its diagnostic fixture approvals, all living-reference updates, dedicated approval-boundary suite and six existing positive compatibility HTTP journeys. Preview's nine affected API/browser scenarios remain a separate listed selection with10 workers; the inherited approval/compatibility suites retain their serialized CI configuration. The preview branch is rebased with a guarded lease and linear history, without editing development. Exact-head evidence must come after this reconciliation.
