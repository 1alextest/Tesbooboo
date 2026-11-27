# Plugin ecosystem and Obsidian: adoption review

**Review date: 26 November 2026. Status: proposed, non-normative research and reconciliation review.** This document records the owner's interest in future Tesbo plugins, evaluates the supplied Quality Forge / Agentic QE / Nagual sources, and proposes a first useful integration. It does not add a ninth canonical specification, approve a runtime dependency, activate a Skill, or claim a working plugin. The eight canonical specification files remain unchanged. Accepted product decisions must be incorporated into their existing owners before implementation.

## Recommendation

Reserve a governed extension contract within the existing Tesbo application. Prove its value through selected Markdown/Obsidian source intake, linked native drafts, and the existing human review workflow. Reuse the integration pipeline, knowledge store, Skills governance, MCP authorization and native execution/evidence owners. Introduce third-party execution only when an individual adapter demonstrates a useful result under those boundaries.

The first product outcome is: **a tester can select source notes, see what will be shared, create or update a linked proposal, and review the result in Tesbo without losing source identity or changing approved material silently.** A public marketplace, arbitrary server-side code loading and continuous two-way synchronization are later decisions.

## Evidence scope and existing work

The source audit used Tesbo `development` commit `63648aa2166cb456bae3ac6695d8dc0a4a475cc3`. The default `main` branch is release-only and is not the current development baseline. Reviewed source is evidence of implementation structure; it is not proof of deployed behavior. No upstream package was installed, no vault was connected, and no application or upstream test suite was executed during this review.

| Source | What was inspected | Interpretation |
| --- | --- | --- |
| [Quality Forge articles](https://forge-quality.dev/articles/) | Selected implementation accounts, particularly evidence, integration and learning failures | Author-reported experience; useful failure mechanisms, not independent performance validation |
| [Agentic QE homepage](https://agentic-qe.dev/), [getting started](https://agentic-qe.dev/playbook/getting-started), [agents](https://agentic-qe.dev/agents), [integrations](https://agentic-qe.dev/integrations) | Method, catalog, onboarding and ecosystem claims | These pages and the author's repositories belong to the same ecosystem; they are not independent corroboration |
| [Agentic QE source](https://github.com/proffesor-for-testing/agentic-qe/tree/3b569fdf0169f78f5e0eb6cbb1527e410d876c27) | Pinned commit `3b569fd`, package 3.15.23; plugin lifecycle/security, packaging ADR and measurement provenance | Concrete source mechanisms and limitations; no new runtime certification |
| [Nagual-QE source](https://github.com/proffesor-for-testing/nagual-qe/tree/5733bbba90f9631a7ec706daf93496090eaeddb5) | Pinned commit `5733bbb`, package 0.2.0; architecture, scoring, pattern model, lineage, witness, deduplication and service seams | A separate, pre-1.0 Rust knowledge system; candidate mechanisms to evaluate against existing Tesbo owners |
| [Obsidian documentation](https://docs.obsidian.md/) and [Local REST API with MCP](https://github.com/coddingtonbear/obsidian-local-rest-api/tree/ef36bf3a7ec4a05a728e4e474d5a448c3aa33c0d) | Official local-vault/plugin model and bridge source at `ef36bf3`, version 5.6.0, desktop-only, minimum Obsidian 1.15.1 | Potential optional transport; broad upstream authority is not a Tesbo permission boundary |

This extends [the existing Agentic QE handoff review](agentic-qe-candidate-handoff.md), [the harness prior-art review](zyra-harness-prior-art.md), and [Zyra QA harness options](../ZYRA_QA_HARNESS_OPTIONS.md). The earlier mutation experiment and authoring comparison retain their original scope and results. This review supplies no new evidence that the whole AQE fleet improves Zyra.

At the inspected work snapshot, [PR #295](https://github.com/1alextest/Tesbooboo/pull/295) owns proposed governed Skill evaluation and continuous improvement; [#310](https://github.com/1alextest/Tesbooboo/pull/310) and [#313](https://github.com/1alextest/Tesbooboo/pull/313) own the approved automation handoff and reporter/native-evidence seam; [#312](https://github.com/1alextest/Tesbooboo/pull/312) owns linked-case navigation. Preserve those owners. PR searches found no Obsidian or Nagual initiative, but cannot establish that no unpublished work exists.

## Lessons to transfer

| Source mechanism | Distilled principle | Contextual application in Tesbo |
| --- | --- | --- |
| The homepage's completion-theater and integrity lessons | Completion requires an observable outcome and attributable evidence | A plugin's success message cannot by itself mark a native case executed, a draft approved or a source synchronized |
| [The Witness Stand](https://forge-quality.dev/articles/witness-stand.html) reports coverage assembled from stale and disconnected data | Preserve measurement method and uncertainty through every consumer | Keep measured, estimated and unavailable values distinguishable in evidence, derived analytics and UI; an uncollected metric has no invented percentage |
| [The Book That Talked Back](https://forge-quality.dev/articles/book-that-talked-back.html) reports a tool-name mismatch that passed CI and benchmark contamination of learning data | Test actual composition and keep evidence populations distinct | Verify packaged discovery, authorized invocation and native readback; separate evaluation fixtures from operational learning |
| [The Question That Followed Me Home](https://forge-quality.dev/articles/question-that-followed-me-home.html) reports fresh-install failures, unbounded storage and an unused router | Verify reachability, recovery and resource limits | Include clean install, restart, upgrade, empty input, revocation, bounded retry and retention/compaction behavior in adapter qualification |
| [The Orchestra Keeps Playing](https://forge-quality.dev/articles/orchestra-keeps-playing.html) reports portable work across coding clients and a default panel that bypassed its own validator | Keep durable decisions outside replaceable execution providers; exercise real defaults | Tesbo retains tasks, cases, evidence and authority; validate the shipped configuration at the actual dispatch boundary |
| [The Gate That Fights Back](https://forge-quality.dev/articles/gate-that-fights-back.html) describes weak-test detection and independent review | Challenge generated assertions before synthesizing a verdict | Reuse existing assurance and governed evaluation to detect empty or tautological assertions and preserve independent findings; agreement, model diversity and similarity scores remain heuristics rather than proof of correctness or collusion |
| [AQE measurement provenance ADR](https://github.com/proffesor-for-testing/agentic-qe/blob/3b569fdf0169f78f5e0eb6cbb1527e410d876c27/docs/implementation/adrs/ADR-126-measurement-provenance.md) attaches collection method to metrics | A derived conclusion cannot be stronger than its evidence | Propagate revision, collector, method, environment, completeness and limitations into a risk or coverage claim |

The homepage's 10% generation / 90% verification statement is a heuristic, not an engineering quota. Likewise, agent/Skill/tool counts establish inventory, not effectiveness. The website and current repository describe different inventories and client assumptions. Pin the version actually evaluated and preserve per-client limitations. The [repository README](https://github.com/proffesor-for-testing/agentic-qe/blob/3b569fdf0169f78f5e0eb6cbb1527e410d876c27/README.md) and [small interaction benchmark](https://github.com/proffesor-for-testing/agentic-qe/blob/3b569fdf0169f78f5e0eb6cbb1527e410d876c27/benchmarks/interaction/results/README.md) explicitly limit effectiveness claims.

A content hash can identify bytes and help detect alteration against a protected reference. It cannot establish that an observation is true, confer human approval, or independently identify its author. Reuse existing attributable evidence and approval records.

### AQE has plugin code, with limits that matter

AQE's [manifest](https://github.com/proffesor-for-testing/agentic-qe/blob/3b569fdf0169f78f5e0eb6cbb1527e410d876c27/src/plugins/manifest.ts) and [lifecycle manager](https://github.com/proffesor-for-testing/agentic-qe/blob/3b569fdf0169f78f5e0eb6cbb1527e410d876c27/src/plugins/lifecycle.ts) are useful references for package identity, versions, dependencies, hooks, compatibility and caching. The inspected `install()` ends after validation and caching; this review did not establish a complete external-package activation path. Its [security checks](https://github.com/proffesor-for-testing/agentic-qe/blob/3b569fdf0169f78f5e0eb6cbb1527e410d876c27/src/plugins/security.ts) inspect manifest names, paths and dangerous declarations. They do not sandbox execution or mediate every file/network operation.

The [fleet packaging ADR](https://github.com/proffesor-for-testing/agentic-qe/blob/3b569fdf0169f78f5e0eb6cbb1527e410d876c27/plugins/agentic-qe-fleet/docs/adrs/0001-agentic-qe-fleet-contract.md) is especially useful. It records missing package-local MCP registration, wrong tool namespaces, floating executable versions, version drift and a smoke test aimed at the wrong artifact. Tesbo's acceptance should inspect the exact distributed package, resolve its own dependencies, verify the advertised tools, execute one permitted operation and read back its result. A repository-root test is not a substitute for testing what a user installs.

Classify operations by actual effects. A tool called coverage analysis may execute the target repository's build or tests. AQE's measurement ADR makes that its default and leaves sandboxing outside scope. A Tesbo adapter must instead use the applicable execution authorization and isolation policy; a read-sounding name is insufficient.

### Nagual: useful lesson memory, not a replacement knowledge store

Nagual's [architecture](https://github.com/proffesor-for-testing/nagual-qe/blob/5733bbba90f9631a7ec706daf93496090eaeddb5/docs/architecture.md), [scoring implementation](https://github.com/proffesor-for-testing/nagual-qe/blob/5733bbba90f9631a7ec706daf93496090eaeddb5/src/reasoning_bank/scoring.rs) and [pattern model](https://github.com/proffesor-for-testing/nagual-qe/blob/5733bbba90f9631a7ec706daf93496090eaeddb5/src/reasoning_bank/pattern.rs) distinguish relevance, freshness, reuse and outcome evidence. Its [lineage](https://github.com/proffesor-for-testing/nagual-qe/blob/5733bbba90f9631a7ec706daf93496090eaeddb5/src/lineage/mod.rs) and [witness](https://github.com/proffesor-for-testing/nagual-qe/blob/5733bbba90f9631a7ec706daf93496090eaeddb5/src/witness/mod.rs) code preserve derivation and change history. The valuable candidate is a better explanation of why a prior lesson applies, with supporting and contradicting outcomes.

Tesbo should evaluate that as a retrieval projection over native knowledge, versions and evidence. Show applicability, source revision, verified outcomes, independent uses, freshness and governing approval separately. A frequently retrieved lesson is not necessarily correct; a reward estimate is not an approval; a similarity score is not calibrated reliability. Benchmark or synthetic outcomes cannot silently become operational evidence.

Do not transfer destructive consolidation or automatic governing promotion. Nagual's [deduplication implementation](https://github.com/proffesor-for-testing/nagual-qe/blob/5733bbba90f9631a7ec706daf93496090eaeddb5/src/reasoning_bank/dedup.rs) can delete merged records; its [automatic promotion](https://github.com/proffesor-for-testing/nagual-qe/blob/5733bbba90f9631a7ec706daf93496090eaeddb5/src/learning/auto_promotion.rs) uses recurrence. Tesbo must preserve record identity, histories, context differences and approved Skill assignments. Similarity may nominate a duplicate for reconciliation, not authorize deletion or activation.

Source inspection also found important maturity limits: [the GCS adapter](https://github.com/proffesor-for-testing/nagual-qe/blob/5733bbba90f9631a7ec706daf93496090eaeddb5/src/sync/gcloud.rs) simulates upload success; [the MCP server](https://github.com/proffesor-for-testing/nagual-qe/blob/5733bbba90f9631a7ec706daf93496090eaeddb5/src/mcp/server.rs) can return an informational success when no execution registry is attached. These are reasons to verify the configured path, not claims that every Nagual operation is simulated. Its [README](https://github.com/proffesor-for-testing/nagual-qe/blob/5733bbba90f9631a7ec706daf93496090eaeddb5/README.md) also distinguishes semantic ONNX embeddings from the non-semantic hash fallback. A general claim of self-learning effectiveness remains unevaluated here.

## Existing Tesbo capability ownership

| Required capability | Existing owner and maturity | Recommended disposition |
| --- | --- | --- |
| Integration configuration | [IntegrationsTab](../../../Tesbo-Frontend/components/settings/IntegrationsTab.tsx) presents built-in Jira, Linear and Notion; [SyncProvider](../../../Tesbo-Backend-Nest/src/integration-sync/integration-sync.types.ts) is a fixed union | Extend with a reviewed adapter registration contract when implementing; do not label the current UI a plugin marketplace |
| Connections and credentials | [Integration client](../../../Tesbo-Backend-Nest/src/integration-sync/integration-sync.client.ts), [connection schema](../../../Tesbo-Backend-Nest/migrations/V47_integration_connections.sql) | Reuse credential handling. Distinguish package installation, account/vault connection, project enablement and effective grant |
| Sync work, progress and recovery | [Integration sync service](../../../Tesbo-Backend-Nest/src/integration-sync/integration-sync.service.ts), [processor](../../../Tesbo-Backend-Nest/src/integration-sync/integration-sync.processor.ts), [pipeline schema](../../../Tesbo-Backend-Nest/migrations/V72_integration_sync_pipeline.sql) | Extend existing jobs, state and error accounting; no second scheduler |
| Source material and human annotations | [V73 comments](../../../Tesbo-Backend-Nest/migrations/V73_knowledge_document_comments.sql) retired V72's `notes` siblings; the current processor updates a provider-owned mirror while native comment threads are stored separately | Reuse the current comment owner; source refresh must preserve human annotations and visibly orphan an anchor when its passage disappears |
| Knowledge ingestion and retrieval | [RAG ingestion](../../../Tesbo-Backend-Nest/src/rag/rag-ingestion.service.ts), [RAG retrieval](../../../Tesbo-Backend-Nest/src/rag/rag-retrieval.service.ts) use native PostgreSQL knowledge and hybrid search | Reuse; evaluate lesson ranking as an extension, not a second persistent brain |
| Governing memory and Skills | [Knowledge revision rules](../../../Tesbo-Backend-Nest/src/legacy/knowledge-document-revision.ts), [governed snapshots](../../../Tesbo-Backend-Nest/migrations/V156_knowledge_governed_snapshots.sql), [Skills governance](../../../Tesbo-Backend-Nest/src/skills/skills-governance.ts) | Imported instructions and learned patterns remain candidates; native exact-version approval and assignment own activation |
| Tool exposure and authorization | [MCP tools](../../../Tesbo-Backend-Nest/src/mcp/mcp.tools.ts), [dispatch](../../../Tesbo-Backend-Nest/src/mcp/mcp.service.ts), [access checks](../../../Tesbo-Backend-Nest/src/mcp/mcp-access.ts) | Compose with shared native writers and effective project/client grants; a tool declaration does not grant permission |
| Execution, attempts and evidence | [Automation service](../../../Tesbo-Backend-Nest/src/automation/automation.service.ts), [Playwright reporter](../../../sdk/playwright-reporter) | Reuse native cases/runs/executions/evidence and existing reporter work; do not create plugin-owned test truth |
| General extension lifecycle | No complete installable platform found in the inspected tree and owners | Proposed new orchestration contract only where needed; remain inside the modular monolith |

### Identity gap to resolve before multiple vaults

The canonical desired imported-source key includes **project, provider, connector/source namespace and external ID**. The inspected [V72 uniqueness key](https://github.com/1alextest/Tesbooboo/blob/63648aa2166cb456bae3ac6695d8dc0a4a475cc3/Tesbo-Backend-Nest/migrations/V72_integration_sync_pipeline.sql) contains project, provider, external ID and source role, without a separate connector namespace. The [connection schema](https://github.com/1alextest/Tesbooboo/blob/63648aa2166cb456bae3ac6695d8dc0a4a475cc3/Tesbo-Backend-Nest/migrations/V47_integration_connections.sql) also assumes one provider connection per organization. Review of the repository migration chain found no later change to these constraints, and the [current processor](https://github.com/1alextest/Tesbooboo/blob/63648aa2166cb456bae3ac6695d8dc0a4a475cc3/Tesbo-Backend-Nest/src/integration-sync/integration-sync.processor.ts) still uses the V72 conflict target. Live deployed schema behavior remains unverified. This is a prerequisite for supporting multiple accounts or vaults, not evidence of an observed production collision.

Preserve a stable vault/source namespace and stable document identity separately from path and content hash. Two vaults containing `requirements/login.md` must not collapse into one record. A rename changes a path; an edit changes a hash. Neither necessarily changes document identity. Any schema/uniqueness change needs a migration and compatibility plan for existing providers; this review makes no schema change.

## Proposed plugin model

A Tesbo plugin is a **versioned extension with declared contributions, compatibility, permissions and lifecycle**, whose actions use Tesbo's existing owners. The term covers several different contributions:

| Contribution | Useful examples | Result and authority |
| --- | --- | --- |
| Knowledge connector | Markdown/Obsidian, documentation repositories, existing Notion ingestion | Scoped source material and proposed links; source content cannot authorize an action |
| Execution adapter | Playwright, a future Appium/UiAutomator2 integration, API runners | Bounded execution and attributable attempt evidence; prepared work is not executed work |
| Analysis adapter | Coverage, mutation, accessibility or security analysis | Findings with method, scope and limitations; a report cannot approve a release |
| Method/Skill pack | QA heuristics, domain playbooks, reviewer methods | Versioned candidate content through existing Skills governance |
| Reporting adapter | Markdown exports, approved report formats | Permission-filtered views of native facts |
| UI contribution | A review panel or specialized evidence viewer | Initially declared, host-rendered contributions; arbitrary third-party frontend code is a separate trust decision |

These are categories for product planning, not claims that the examples are installed. A connector need not be an AI agent or run its own server. A Skill pack need not execute code. Native reviewed adapters can remain compiled modules. Untrusted executable extensions need a separate, enforced execution boundary before admission; placing code in another module or declaring permissions is insufficient isolation.

[MCP](https://modelcontextprotocol.io/docs/learn/architecture) can expose an adapter's tools/resources and provide interoperability. Tesbo still owns package admission, project grants, native record semantics, review, lifecycle, cost limits and evidence. Avoid confusing a protocol connection with a complete plugin platform.

Tesbo's existing MCP server exposes Tesbo operations to clients. Consuming another server is a distinct host/client capability; this review does not establish that it is already available inside Tesbo. An optional local client can mediate the Obsidian side without creating a universal remote-command proxy.

The inspected MCP grant validation also keeps OAuth client pre-approval read-only; existing API-token grants have their own explicit scopes and tool allowances. A future proposal-writing connector must qualify a currently supported, authorized writer. Successful sign-in or plugin installation cannot be treated as write consent, and this review does not authorize broadening the OAuth contract.

### Contract to settle before an executable SDK

| Concern | Proposed required behavior |
| --- | --- |
| Identity and package integrity | Unique publisher/plugin ID, immutable version/digest, source/license, dependency pins and compatible host/API/schema versions; verification establishes provenance, not inherent safety |
| Contributions and effects | Named typed operations and outputs; classify filesystem, network, execution and mutation effects, including indirect effects; expose only configured operations with a real consumer |
| Scope and authority | Tenant/project/source binding and an authenticated actor/service grant; intersect plugin capabilities with current member permissions, project policy and authorization at dispatch and commit |
| Configuration and secrets | Validated non-secret settings separate from credentials; permitted destinations and local file scope are enforced, not merely shown in UI |
| Result semantics | Preserve permitted original outputs with secret filtering and restricted access under native evidence/retention policy, alongside normalized status: completed, partial, refused, failed, cancelled or outcome unknown as applicable. If raw retention is disallowed, retain authorized metadata/hashes and disclose the evidence limitation; a hash cannot reconstruct discarded observations. Return observed receipts; no green default when evidence is absent |
| Evidence | Bind plugin version, actor/grant, operation, source/input revision, target revision, environment, producer and observation time. Preserve test/attempt identities and completeness; distinguish measurement from inference |
| Recovery | Bounded timeout/retry, operation idempotency and explicit reconciliation after uncertain effects; do not blindly repeat a write after a lost response |
| Lifecycle | Separate installed, configured, authorized, enabled and healthy states. Revalidate changed capabilities on upgrade; stop new dispatch and fence queued work after disable/revocation |
| In-flight actions | Cancellation is best effort where external effects already began; record what was confirmed and reconcile uncertain results instead of claiming rollback |
| Removal and data | Remove subscriptions/jobs/credentials owned by the extension without revoking resources shared by other enabled consumers, and prevent further collection/use under a revoked grant. Apply current native access and retention rules to retained snapshots, embeddings, caches and derived retrieval. Preserve approved history where required without broadening access; uninstall is not automatic purge |
| Operations | Visible last successful operation, freshness, backlog, failures, budget usage, dependency health and affected records; reuse current observability and work records |

The first implementation should exercise the contract with one existing built-in adapter and one new source adapter, maintaining existing behavior. A universal SDK designed only around Obsidian would not yet demonstrate a reusable abstraction.

## Obsidian: a concrete first journey

Obsidian stores [plain Markdown files in local vaults](https://obsidian.md/help/data-storage). The official [plugin API](https://docs.obsidian.md/) extends the running app. This supports portable source exchange and an optional Tesbo command inside Obsidian; it does not establish a supported way to embed the Obsidian application inside Tesbo or execute existing Obsidian plugins in Tesbo.

### First slice: selected source snapshots to linked proposals

1. A permitted member selects Markdown files, a note section or a bounded folder. Capture the exact content shown in preview, including the current editor buffer when applicable, and distinguish it from the last saved file. Show attachment choices, destination project and intended use. Bind submission and receipt to that snapshot and destination; re-preview if either changes. Do not assume a browser can read an arbitrary local vault.
2. Reconcile against accessible existing sources and native records. Import a source snapshot through the knowledge owner, retaining vault/source namespace, document identity, current path, source revision/hash and relevant heading/block anchors. For manual uploads, distinguish declared vault/path/author metadata from observed receipt facts: authenticated uploader, received bytes/hash, destination and time. An upload alone does not verify original-vault provenance.
3. The member requests the applicable result: keep the material as project knowledge, propose a requirement, suggest test cases or record a question. Reuse the effective Skill and existing authoring workflow. Do not require every note to become every artifact type.
4. Show proposed changes, source references, duplicates/conflicts, incomplete evidence and the member's available action. Native writers enforce permissions and expected revisions.
5. An authorized human reviews the exact candidate through the existing workflow. A draft, a source upload and an approved artifact are separate outcomes. Record the native links and operation receipt.
6. Let the user open the shared Tesbo source record and linked native records. An optional device-local Obsidian link is a convenience: colleagues may have different vault names/locations or no Obsidian. Do not require or disclose absolute local paths. A companion can later show status or write back a link under explicit permission. The first snapshot flow requires no automatic writeback.

**Illustrative use:** a tester selects notes about stock adjustments. Tesbo identifies ambiguity about who may approve an adjustment, references the exact note section, and proposes requirement/test-case changes under the current native workflow. Reimporting the same revision should return the existing receipt or no-change result. This is a proposed product scenario, not a claim about DMIS permissions or current Tesbo functionality.

Preserve frontmatter, headings, aliases and links as source data where needed. A Wikilink is not by itself proof of a formal requirement-to-case relationship. A field such as `approved: true` in a note cannot confer Tesbo approval. Embedded instructions, linked pages and attachments remain untrusted inputs; they must not broaden the selection, execute commands or grant authority.

### Optional local connection, after the first flow

Two paths are worth comparing on the same fixture:

- A small first-party **Tesbo plugin inside Obsidian**, with commands such as Send selection to Tesbo, Preview changes and Open linked record. It uses official Vault/editor APIs and makes outbound authenticated requests.
- A narrow local adapter around the existing **Local REST API with MCP** plugin. Its [pinned README](https://github.com/coddingtonbear/obsidian-local-rest-api/blob/ef36bf3a7ec4a05a728e4e474d5a448c3aa33c0d/README.md), [manifest](https://github.com/coddingtonbear/obsidian-local-rest-api/blob/ef36bf3a7ec4a05a728e4e474d5a448c3aa33c0d/manifest.json) and [conditional-write implementation](https://github.com/coddingtonbear/obsidian-local-rest-api/blob/ef36bf3a7ec4a05a728e4e474d5a448c3aa33c0d/src/conditionalRequests.ts) offer existing transport, events and stale-write protections to evaluate.

A hosted Tesbo service cannot reach a user's loopback server. A selected local integration must communicate through an authorized outbound channel; do not make the desktop API public to solve reachability. This remains optional for Obsidian users and does not introduce a mandatory Tesbo companion for every customer.

The upstream bridge exposes broad CRUD and command execution. Its API key is not narrowed by a Tesbo folder selector. Its [path handling](https://github.com/coddingtonbear/obsidian-local-rest-api/blob/ef36bf3a7ec4a05a728e4e474d5a448c3aa33c0d/src/vaultPath.ts) explicitly allows owner-created symlinks beyond the vault, so a stricter selected-folder contract requires real filesystem containment checks or a different restricted integration. Keep the broad local credential local, withhold it from agents, deny unused operations, verify transport identity and make update preconditions mandatory. The reviewed bridge is desktop-only; mobile support needs separate evidence.

Obsidian's [plugin security documentation](https://obsidian.md/help/Extending%2BObsidian/Plugin%2Bsecurity) states that plugins inherit broad application access. Borrow the extension lifecycle and user experience, not this trust model for a shared Tesbo server. Even a first-party companion must communicate its local scope honestly.

### Later synchronization: preserve both owners

Obsidian owns the selected source narrative; Tesbo owns native artifact lifecycle, approval, execution and evidence. Store source revision and last acknowledged revision separately from Tesbo artifact/revision and operation identity. Source changes may propose a new native draft version; they cannot silently replace approved content.

Stable note IDs may be stored in metadata only with user consent, or maintained through a reliable connector mapping. Copied IDs, uncertain renames and concurrent edits require reconciliation. Do not infer identity from a filename, title or similarity score alone. A source deletion means a missing-source condition until policy determines the outcome; it does not automatically delete approved native material. Any purge request follows existing retention and privacy rules.

If writeback is added, preserve the user's unrelated text and unsaved work. Official [Vault guidance](https://docs.obsidian.md/Plugins/Vault) recommends a guarded read/modify operation; asynchronous results must recheck the current content. Reject stale updates and offer a reviewable conflict. Preserve both revisions. Obsidian file synchronization does not resolve Tesbo business approval conflicts.

## Proposed acceptance scenarios

These scenarios are **proposed and UNRUN**. Actor labels describe effective capabilities, not new roles. Actual role mappings and native case reuse must be resolved from the configured project before automation. Coverage navigation follows actor → feature → scenario; each scenario has one canonical implementation in the existing test project.

| Actor and state | Feature / scenario | Observable result and evidence |
| --- | --- | --- |
| Permitted member, selected note | Intake / submit a source snapshot | Only selected bytes and permitted attachments reach the chosen project; source revision and receipt are independently retrievable |
| Member with unsaved edits or changed preview destination | Intake / submit the reviewed selection | Uploaded bytes and destination match the reviewed snapshot; changed content/destination requires renewed preview, with no stale-disk or unexpected full-file upload |
| Member with access to two vaults | Source identity / same path in both vaults | Two correctly scoped source identities remain distinct; title or path similarity cannot overwrite either |
| Member repeating an import after a lost response | Recovery / retry same operation | Reconcile the first outcome; return one canonical receipt/proposal without duplicate native records |
| Member with an existing linked source | Intake / submit unchanged and then changed content | Unchanged submission produces no duplicate; changed submission preserves history and proposes the correct revision |
| Member lacking native authoring permission | Authorization / attempt proposal submission | Server refuses without creating or changing a native draft, regardless of plugin UI or supplied metadata |
| Member from another project/tenant | Authorization / request a source, receipt or native link | No content or derived metadata leaks; authorized access in the original project still works |
| Authorized human reviewer | Review / apply the exact candidate | Native review and apply semantics remain authoritative; source/agent approval flags have no effect |
| Member whose source or target changed during review | Concurrency / apply stale proposal | Preserve both edits and refuse stale overwrite with a useful reconciliation path |
| Local connector, bounded folder | Scope / traversal, symlink, hidden configuration and external links | No unselected file, secret or attachment is transferred; verify actual file access and outbound bytes |
| Member supplying hostile note content | Source trust / embedded instruction attempts | Content cannot change grants, invoke commands, activate Skills, publish records or fetch unselected destinations |
| Disconnected client with queued work | Recovery / reconnect after grant revocation | Queued work remains fenced and produces no new forbidden effect; UI distinguishes offline, refused and unknown outcomes |
| Member renaming or copying a note | Identity / rename and duplicate-ID handling | Reliably tracked rename keeps links; ambiguous identity stops for reconciliation without silent overwrite |
| Member deleting a source | Lifecycle / missing source | Existing approved material and history remain governed; user sees missing source and the allowed next action |
| Authorized integration manager | Lifecycle / disable during work | No new dispatch; queued work is fenced; completed or uncertain in-flight effects remain attributable |
| Authorized integration manager | Lifecycle / remove or upgrade | Owned subscriptions and credentials are handled; native evidence survives according to policy; incompatible versions fail visibly |
| Member or service after access revocation | Retrieval / query retained source derivatives | Revoked scope cannot retrieve snapshots, cached excerpts, embeddings-derived content or derived metadata; separately authorized native history remains governed by its existing policy |
| Verifier using the distributed package | Packaging / discover, invoke and read back | Exact package/version exposes the documented names and one authorized operation produces the expected native receipt; missing runtime registration fails the check |
| Verifier comparing analysis providers | Evidence / unavailable or estimated metric | Missing collection remains unavailable, estimates stay labeled, and neither silently satisfies a measurement-dependent gate |

For each implemented slice, predeclare fixtures, expected state, unique correlation IDs, cleanup and discriminating assertions. Include correct, faulty, refused and unobservable controls. A report formatter must not convert execution failure or absent evidence into a passing result. A generated test count or successful HTTP response alone is insufficient.

Use the existing `e2e/` owners for integration, knowledge, authorization, Skills, Zyra and relevant UI behavior; use SDK/adapter contract tests for the actual package boundary. Discover existing native cases in TESBOPROJECT by actor, condition, action and expected result before creating new records. Preserve native case and requirement references when available. These proposed rows are not official Test Case IDs or execution results.

## Sequencing and unresolved decisions

| Stage | Coherent deliverable | Exit evidence |
| --- | --- | --- |
| 1. Reconcile contract | Incorporate approved extension requirements into canonical owners; map one built-in adapter and selected Markdown intake | Owners, effects, actor permissions, identity and lifecycle decisions are explicit; no duplicate platform |
| 2. Prove source intake | Selected files → source snapshot → appropriate linked proposal → native human review | Real scoped readback, duplicate/retry controls, revision conflicts, access refusals and retained source provenance |
| 3. Compare local experience | Optional first-party Obsidian command versus bounded existing bridge | Same user scenario, measured setup burden, containment, compatibility and recovery; choose on evidence |
| 4. Qualify a second contribution | One existing runner/report adapter or bounded analysis capability through the same contract | Genuine reuse across different effects, complete evidence and successful disable/upgrade behavior |
| 5. Expand selectively | Multi-account/vault support, controlled sync, third-party catalog or UI contributions as separately justified | Tested tenancy/isolation, distribution, migration, observability and support boundaries |

The current research is not blocked by the following future product decisions. Record them in the existing review/work owner and resolve only before the affected implementation:

| Decision | Current disposition | Recommendation and consequence |
| --- | --- | --- |
| Does the first Obsidian outcome need live sync or selected snapshots? | HUMAN_REQUIRED for implementation priority; snapshot flow proposed | Start with snapshots to establish value and preserve source/approval ownership; live sync adds local connectivity and conflict obligations |
| Who may install an extension, connect an account/vault, and enable it for a project? | HUMAN_REQUIRED; exact existing role mapping not established by this review | Reuse existing permissions where adequate; separate these powers instead of assuming one admin flag covers all |
| Can a workspace connect several accounts/vaults for one provider? | Source constraints established; live deployment unverified; HUMAN_REQUIRED for expanded product cardinality | Plan namespaced source identity; verify deployment and prove existing-provider migration and cross-account isolation before expanding cardinality |
| Which local approach should be supported first? | DELEGATED evaluation, adoption remains a product decision | Compare the official plugin route and bounded REST/MCP bridge; do not assume the bridge's broad key is least privilege |
| May third-party code execute or render arbitrary UI? | HUMAN_REQUIRED for later scope; excluded from the initial proposal | Keep first-party adapters and declared UI contributions initially; choose and prove an enforced boundary before opening executable extensions |
| May learning change active Skills or approve artifacts? | ALREADY_DECIDED by existing governance | No automatic promotion; reuse candidate evaluation and authorized exact-version activation |
| Does a plugin require a second knowledge database or mandatory desktop application? | ALREADY_DECIDED by existing architecture | Reuse native knowledge and work owners; an optional Obsidian integration does not impose a companion on every Tesbo user |

## Canonical reconciliation and native handoff

When the owner adopts a slice, amend the existing eight specifications in place using their normal version/review process:

- `00_README.md` P-16 and `01_PRODUCT_REQUIREMENTS.md` FR-058: retain replaceable execution integration; add the distinct knowledge/report/Skill contribution obligations where approved. FR-058 alone is not a finished generic plugin SDK.
- `03_TECHNICAL_DESIGN.md` modular-monolith, integration, imported-source identity and GEX learning sections: define registration, namespace, scope, evidence and lifecycle at their existing owners.
- `04_MCP_API_CONTRACTS.md`: document only implemented/approved adapter contracts, explicit unsupported behavior, authority, provenance and recovery. Do not invent a callable plugin endpoint from this review.
- `05_IMPLEMENTATION_BACKLOG_AND_TEST_PLAN.md` T-408 and the existing Skills/evidence tasks: add accepted scenarios and dependencies, reconcile with #295 and #310/#313.
- `02_WORKFLOW_AND_UX_SPEC.md`, `07_UI_DESIGN_TASKS.md` and `06_IMPLEMENTATION_AGENT_BRIEF.md`: reflect selected-content preview, accessible status/conflicts, effective authority, existing native record handoffs and the optional-local-client boundary.

Native assessment for this documentation change: Requirements and Test Cases have a proposed future handoff; Manuals and Policies have no implemented behavior to update; Skills and active assignments remain unchanged; this review/PR owns the research task and source evidence. **Tesbo sync not performed:** no callable authorized Tesbo connector was exposed in this session. Native duplicate discovery, record publication, approval and Test Run execution are not claimed. Preserve this review for later reconciliation with the existing native records; do not bypass missing MCP access with direct database or REST writes.

Rollback of this documentation-only proposal is removal of the review and its two cross-references through normal review. No runtime configuration, credentials, schema, installed packages or production data are changed.
