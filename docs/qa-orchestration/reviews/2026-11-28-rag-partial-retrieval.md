# Hybrid retrieval resilience — whole-system reasoning implementation increment

**Scope:** source pin `2e91c8e95dbf90ced664ca4f35af207abaa56941`; existing FR-124/R-ASE reasoning and qualified negative-space direction, canonical specification continuation #295 and evaluation #320. Source-grounded coordinator review, NOT independently assured or frozen. Do not treat returned relevance as normative authority, verified behavioral coverage or exhaustive inventory. No production content or provider authorization is widened.

## Existing paths and reuse

The large LegacyService blob `c0ea557ecefdb6c377c6ab30ed47d57701bc0736` was successfully read via Git object access (29,845 lines). This supersedes the earlier connector range-read limitation for this exact source. The shared `knowledgeDocumentAiContextSql` is referenced at 12 source locations in LegacyService: 22243 (ticket plan), 24649 (memory), 24893 (explicit/recency snapshot), 24984 (folder), 25033/25072 (ticket catalogue/named ticket), 25335 (citation replay), 27419 (case-update requirement lookup), 28874/28895/28933 (ticket inventory and scope), 29211 (project snapshot). RagRetrievalService also uses the shared filter for ANN and FTS. The inventory is a source call-site count, not proof of runtime route reachability or complete future participation coverage.

The governed document native owner retains review/version state (LegacyService 18118–18178); get/list and historical read at 12376, 12488 and 14239 use project access and scoped IDs. Existing holds also occur in create/update/duplicate/restore producers, ingestion restart sweep and the worker before external provider use. Current context SQL distinguishes approved AI memory, but generic retrieval and replay citation objects are not exact effective-revision authority receipts. No policy/manual filter, access rule, queue behavior, external-provider disclosure policy, graph store or schema is changed by this increment.

## Confirmed defect and correction

RagRetrievalService's allocation/keyword preparation and ANN/FTS queries were combined with Promise.all. A rejected ANN call discarded valid FTS results; the prior regression explicitly expected an empty array in that situation. FTS SQL failures were swallowed as empty results. A missing query vector could be reported as a completed semantic search merely because a key existed. The same existing service now isolates preparation and search failures, preserves successful bounded candidates, retains the existing confidence thresholds and trace context, and reports client-safe path-specific diagnostics. A valid empty query or completed empty candidate set is distinct from unavailable retrieval. Existing explicit passage selection fallback remains unchanged. No completeness assertion follows from a successful search or confidence score. Existing trace consumer reads the returned reason (LegacyService 20232); no UI redesign, exhaustive source inventory or new contract claimed.

## Distillation — contextual application of existing principles

**Failure locality and epistemic honesty:** independent evidence-producing mechanisms should retain valid observations when another mechanism fails; qualify the affected scope and preserve the causal distinction between failed, skipped, empty and observed outcomes. This is an instantiation of existing qualified negative-space reasoning, evidence-bound cross-domain reasoning and observability, not a second competing principle. Anti-pattern: shared catch that turns one mechanism's failure into total absence; recovery: independently settle paths, keep valid observations, mark unavailable path, avoid treating relevance as authority. Discriminating verification: successful FTS with failed ANN and the inverse, failure vs complete bounded empty control. Canonical 05/06 remain the proof/method owners.

## Acceptance scenarios (committed, execution not yet verified)

- Provider rejection retains keyword match and weak relevance; semantic search not completed.
- Document FTS rejection preserves file and ANN results; file FTS rejection preserves document result.
- Failed allocation retains keyword results; failed keyword preparation retains ANN results.
- Both failed and completed-empty queries distinguish diagnostics; missing query vector never claims ANN ran.
- A real API/chat integration with fake embedding endpoint failing and real keyword retrieval delivers a requirement beyond the recency fallback's first 1500 characters to the drafting provider, preserving exact citation. The fake drafting output does not demonstrate model reasoning quality.
- Existing provider-error redaction, empty query, ranking, confidence, tracing and explicit selection controls remain. No new external exposure.

## Coordinator risk lenses (not independent dispatch)

Blue: same retrieval owner, no duplicate service. Red: false absence, incomplete search and malformed vectors. Green: allocation, SQL, ranking, trace and downstream drafting contracts. QA: failure injection and positive neighbor, repeatability, null vector, actual prompt oracle. Security: fixed path diagnostics avoid raw failure payloads; existing authorization SQL and governed hold unchanged. Grey/Purple: trace reason is already consumed; new user-facing selection not in this increment. Graph: no claim that linkage or retrieval proves coverage. Operability: observable unavailable paths, existing provider tracing retained. EG and formal White review NOT RUN. Full independent team receipts, runtime acceptance and signing remain open.

## Open seams before user-configurable participation

A source-selection policy must cover exact revisions, actor/scope, processing destination and authority independently; approval does not imply inclusion. Inventory remaining: provider tracing/telemetry egress, source change and revocation boundaries, any direct file or external-source paths outside generic KB reads, actual composer filtering, all deployed permissions and asynchronous producer/worker fencing. In particular, a worker's pre-allocation source read is not proof of authorization at each later external effect. Do not remove current exposure guards or treat this partial-retrieval correction as production participation implementation. Default/granularity/destination policy remains unresolved under #295; existing hold retained.

Rollback: revert this increment. No migration or data transformation. Local checkout blocked by DNS; no local Jest/Playwright execution or native Tesbo synchronization claimed. Use exact-head hosted checks and review actual job/test results before acceptance.
