# Plugin ecosystem contract assurance review

**Date:** 27 November 2026  
**Reviewer:** independent child agent `spec_contract_review`; combined Blue / Green / Graph / Security / QA-lifecycle lenses. These are review lenses used by one reviewer, not a claim that five separately staffed teams ran.  
**Disposition:** proposed design amendments against recovered v1.4.48; no product implementation, runtime acceptance, release or deployment certification. All suggested scenarios below are **NOT RUN**.

## Inputs, method and scope

- Repository inspected: `/workspace/scratch/e50b253d95e4/tesbo`, exact HEAD `f92c3341eadc03f274becbead3b0f45d0a86539e` (PR #295 branch).
- Read repository `AGENTS.md` and `CLAUDE.md`; followed native owner reuse, exact evidence, source-versus-runtime qualification and no competing subsystem requirements. No product files, remote records, native Tesbo records or deployed resources were changed.
- Reviewed canonical `docs/qa-orchestration/03_TECHNICAL_DESIGN.md` and `04_MCP_API_CONTRACTS.md` across their base sections and accumulated amendments; inspected relevant requirements/backlog ownership in `01_PRODUCT_REQUIREMENTS.md` and `05_IMPLEMENTATION_BACKLOG_AND_TEST_PLAN.md`.
- Recovered package supplied by parent: `/workspace/scratch/e50b253d95e4/inputs/canonical-v148/`, archive SHA-256 `6665ba660aa208bd35db51b90052fc0b69abc01c6922c197544003e3480b1bef`. Read the complete saved deltas for 03/04 and relevant 01/05 deltas. Saved v1.4.48 adds dependency-aware work coordination, correction and independent checks; it does not introduce general plugin package identity or lifecycle.
- Reviewed research PR #315 at `7539a739243167b2d6709df1d644bd5b955f6ffc`, path `docs/qa-orchestration/reviews/plugin-ecosystem-obsidian-review.md`, through `git show origin/docs/plugin-ecosystem-obsidian-review-20261126:...`. Its outside-source assertions were treated as attributed research, not independently rerun installations or externally verified claims by this reviewer.
- Inspected current integration UI/provider types, connection schema/client, source mirror uniqueness and writer, and current approved-Skill resolver. Searches were scoped owner discovery, not proof that every possible plugin-related file in the repository was exhaustively audited.
- Read-only analysis only: no server started, packages installed, external API invoked, database accessed, migration run, test executed or native case ID created. This note is the only write by this reviewer.

**Evidence discipline:** repository current source, recovered proposed contracts, historical receipts and research are separate evidence classes. Historical defects and earlier executed tests retain their original source/date/scope. Existing acceptance IDs below designate owners to extend, not proof of new coverage.

## Overall conclusion

The native architecture is a strong fit for a future plugin ecosystem. It already assigns authority, source/version ownership, protected publication, task/attempt recovery, evidence and isolation to existing services. The missing work is a narrow general extension admission and lifecycle contract connecting those owners. FR-058 and T-408 presently describe execution-agent integrations; they cannot alone establish coverage for content packs, source connectors, reports, analysis, UI or other product contributions.

Obsidian remains one example. No first plugin, executable SDK, marketplace, general dynamic loader, isolation vendor, mandatory companion or initial product implementation is selected by this review. A reviewed compiled adapter or no-plugin solution remains valid when it meets the actual need.

Severity below is the significance of an unresolved **design admission gate before implementation**, not a finding of an exploitable deployed vulnerability.

## Findings and minimal amendments

### PC-01 — General plugin identity and authority associations are not yet canonical

**Severity:** High design gap.  
**Evidence:** 01 §3.8, FR-058 limits the common contract to execution agents. 03 §16.2 defines a narrow executor adapter interface. 03 §18.1 and T-422 sections already separate native owners and governed Skill content/versions/assignments. 04 ASER-C02 defines native identity/cardinality; v1.4.47 defines authenticated workload and delegation. None of these constitutes a general publisher/plugin/package-to-installation-to-contribution identity contract. PR #315, “Contract to settle before an executable SDK,” identifies this as proposed research.

**Consequence if left implicit:** installation, connection authentication, project enablement and current effect authorization can be conflated; a display name or selected package could be treated as authenticated executor identity; a package upgrade could silently change which contribution owns a queued operation.

**Recommended amendment:** define logical associations, without selecting tables or a new public API: publisher/plugin identity; immutable package version/digest and admitted source; contribution identifier/type and real native consumer; installation/configuration revision; connection/source binding; project enablement; authenticated caller/actor and current operation grant. Manifest declarations are untrusted claims until admitted and observed capabilities are separately recorded. Successful install or sign-in grants no native write authority. Package signatures/hashes establish only the qualified provenance/integrity they actually prove. Content-only packs continue through T-422; execution adapters continue through T-408; native record mutations continue through the relevant existing domain owner.

**Testable outcome, NOT RUN:** two packages with similar names remain distinct; a changed digest cannot masquerade as the same immutable admitted version; an installed and authenticated extension without the relevant project grant cannot dispatch or write; a version/config change leaves historical receipts bound to their original package and native operation. A content-only pack works without being granted executable hooks.

**Already covered — reference, do not duplicate:** 03 §9.1 and v1.4.47, 04 §10/14 and v1.4.47 already own intersection of live membership, credential ceiling, grant, policy, task/attempt and final-effect checks. This finding adds the plugin associations, not another authorization engine.

### PC-02 — Package dependency and compatibility closure needs an explicit admission rule

**Severity:** High design gap.  
**Evidence:** 03 T-422 governed Skills sections already require immutable version/digest, dependency constraints and explicit conflict/missing outcomes; 03 v1.4.48 “Unit, expectation and dependency basis” covers task prerequisites and affected reliance. 04 §11 covers negotiated protocol/schema compatibility. These are useful primitives but do not specify general package dependency selection, host/API/schema compatibility, required versus optional dependencies, withdrawn versions or activation of mutually dependent contributions. Research #315 specifies dependency pins and compatible host/API/schema versions, but leaves concrete activation consequences open.

**Consequence if left implicit:** a nominally compatible package can load against a different transitive dependency, capability or schema than the reviewed basis; an unavailable optional dependency could accidentally block unrelated native work; an upgrade could silently select “latest” and revive an old queued action under new semantics.

**Recommended amendment:** admission binds the actual selected immutable dependency closure and host/API/schema/runtime capability basis. Required missing, conflicting, unsupported or cyclic dependencies block the affected activation with a useful authorized reason. An optional dependency has a declared reduced capability/result; it cannot be silently substituted. Reassess actual direct/transitive consumers when a version, capability, compatibility basis or admission decision changes. Define how withdrawn/revoked package versions affect future activation and queued/current work under the existing generation/authority fence. Preserve historical evidence. No silent latest-version fallback; no new graph store or task scheduler is implied. Select upgrade strategy only after inspecting actual owners and migration constraints.

**Testable outcome, NOT RUN:** exercise a satisfied closure, missing required dependency, optional unavailable dependency, incompatible host/schema, cycle, conflicting version requirements and withdrawal after queueing. Only affected contributions are withheld; an unrelated enabled contribution and native manual path remain usable. A delayed old operation cannot run using a silently substituted new package/dependency basis.

**Already covered — reference, do not duplicate:** 03 v1.4.48 and 04 v1.4.48 already require exact relied-on inputs, dependency meanings, invalidation and no stale success. Apply those semantics to package admission; do not relabel the work-coordination graph as the plugin registry.

### PC-03 — Lifecycle dimensions and transition effects require a single mapped contract

**Severity:** High design gap.  
**Evidence:** research #315 lifecycle/in-flight/removal rows distinguish installed/configured/authorized/enabled/healthy and shared-resource cleanup. 03 v1.4.47 “Effective stopping, monitoring and recovery” and 04 v1.4.47 already specify fencing, best-effort cancellation, physical termination uncertainty and new authorized continuation. Existing source integration disconnect concerns a configured provider connection, not a full package upgrade/removal lifecycle. 04 ASER-C01 warns against collapsing distinct state meanings.

**Consequence if left implicit:** disable, disconnect, authorization revocation, unhealthy status, upgrade and uninstall can become interchangeable commands; cleanup can revoke a shared credential or delete retained approved evidence; an advertised rollback can incorrectly imply that committed external effects or native migrations were undone.

**Recommended amendment:** keep package availability, selected version, configuration, connection/grant, enablement, health and current operations as separate observable dimensions. For install/configure/enable/disable/upgrade/remove, name the actual permitted actor, existing writer, expected revision, affected contribution/dependency scope and receipt. Material capability/effect expansion needs its actual authorization owner; install/update hooks run only under a separately admitted execution profile. Disable/revoke stops new admission and fences queued effects at their native owner. In-flight work reports confirmed versus uncertain effects under existing recovery rules. Upgrade failure preserves the last valid supported state where actually possible; downgrade/rollback is conditional on real data/schema/provider compatibility, not a promise to erase history. Removal cleans only extension-owned schedules/subscriptions/resources and follows existing data retention/visibility; shared credentials/resources require reference-aware ownership. Uninstall is not purge or authorization to destroy approved native records.

**Testable outcome, NOT RUN:** disable while work is queued, disable after an external effect starts, permission-expanded upgrade, failed migration/activation, old worker returns after re-enable, removal with another enabled consumer sharing a connection, and reinstall. No stale operation revives; native evidence remains lawful and identifiable; shared work is unaffected; unknown outcomes and unsupported rollback remain visible. A normal fresh authorized operation succeeds.

**Already covered — reference, do not duplicate:** idempotency, native receipt reconciliation, stop acceptance versus fencing versus termination, retention and exact protected publication are existing 03/04 contracts. Plugin lifecycle needs to route to them; it does not justify separate review, audit, evidence or stop engines.

### PC-04 — Multi-connection source identity is a source-backed conditional prerequisite

**Severity:** High if a selected connector supports multiple accounts/vaults of one provider in one project; otherwise a documented future design constraint, not an observed runtime collision.  
**Evidence:** 04 §14/16 and ASER-C02 require source namespace/binding-qualified identity and historical configuration. Current `Tesbo-Backend-Nest/migrations/V47_integration_connections.sql` declares `UNIQUE (organization_id, provider)`; `src/integration-sync/integration-sync.client.ts:119–123` loads by organization and provider. `migrations/V72_integration_sync_pipeline.sql:78–80` indexes source mirrors by `(project_id, source_provider, source_external_id, source_role)`. `src/integration-sync/integration-sync.processor.ts:540` looks up that tuple, and `:585` uses the same conflict target. This matches the research #315 finding; it is one finding, not two independent bugs.

**Consequence if extended without migration:** two same-provider connections/vaults that reuse external IDs cannot be safely represented by this mirror key. Changing only a plugin manifest or UI selector cannot establish correct namespace isolation.

**Recommended amendment:** preserve current provider behavior and explicitly gate any multi-connection connector on a reviewed native connection/source-namespace migration and corresponding ingestion/read/cache/retrieval/link tests. Bind delayed events to the original connection/configuration generation, never the current connection by provider name. Reuse existing knowledge documents, source revisions and native artifact links. Do not pick the migration/schema now, and do not infer deployed collisions from this future cardinality need.

**Testable outcome, NOT RUN:** import identical external IDs from two authorized same-provider sources into one project; each retains separate native source identity and attributed version history. Reconfigure one source then deliver an old event; it cannot update the replacement namespace. Denied source content and derivatives do not leak through search, counts, links or cached results. Existing one-provider connection migration behavior remains supported.

**Already covered — reference, do not duplicate:** native source/RAG access and retained history already belong to FR-055/069, 03 §18 and v1.4.47, 04 ASER-C02/C06. This finding is the concrete current-source convergence gate.

### PC-05 — Generalization needs profile-specific admission and installed-artifact proof

**Severity:** Medium design/proof gap; high before admitting untrusted executable contributions.  
**Evidence:** 03 §16.2 and 05 T-408/T-405 establish two execution-runtime interoperability proofs; 05 T-435 owns current source-sync recovery. Those cannot establish an arbitrary general plugin API. 03 v1.4.47 already provides strict hostile-code isolation, separately bounded dependency bootstrap and secret custody. Research #315 contribution table proposes content, connectors, execution, analysis, reporting, product modules and UI; it explicitly says two source adapters are insufficient generic proof. `src/integration-sync/integration-sync.types.ts:1` is the fixed Jira/Linear/Notion union, and `Tesbo-Frontend/components/settings/IntegrationsTab.tsx` enumerates those providers. This is usable existing integration architecture, not demonstrated general installed-extension support.

**Recommended amendment:** each selected contribution identifies concrete inputs/outputs, direct and indirect effects, native owner/consumer, trust/execution profile and observed capabilities. Content-only, reviewed compiled, remote-service and executable/UI contributions need the boundaries their actual effects require; a manifest/module/signature is not a sandbox. Do not force all profiles through a universal remote-command adapter. Before claiming generality, qualify at least two materially different profiles chosen for real user need and compare the current/manual/no-plugin alternative. This is a future proof gate, not selection or commitment to ship profiles together. Test the actual distributable/installable artifact and registered entry points, not only source functions. Any package lifecycle scripts or migrations participate in the admitted effect model.

**Testable outcome, NOT RUN:** per selected profile, independently observe normal/refused/interrupted/unsupported behavior, exact package and dependency basis, permission changes, cross-tenant denial, bounded resource use, stale operation rejection, truthful outputs and cleanup. Include missing distribution files/entry points, advertised-but-unregistered operations, malformed output and a deliberate forbidden effect. A failing plugin does not corrupt core records or disable unrelated valid native work. Record which guarantee belongs to native enforcement and which remains outside Tesbo's control.

**Already covered — reference, do not duplicate:** 03 v1.4.46/47 and 05 v1.4.46/47/48 already require independent expectations, attribution, attempted versus observed effects, budget and no inferred PASS. Add plugin variants to actual feature-owned cases after native inventory; do not create misleading case IDs or credit historical tests with these new scenarios.

## Existing owners that should remain authoritative

| Concern | Canonical/current owner | Plugin use |
| --- | --- | --- |
| Source intake, revision, RAG | FR-055/069; 03 §6/18; IntegrationSyncService/Processor; native KB | Connector outputs become attributed native source versions; summaries and embeddings preserve source access/trust. |
| Actor and operation authority | 03 §9.1/v1.4.47; 04 §10/14/v1.4.47; native MCP/access and domain writers | Intersect plugin-declared capability with actual current grant; plugin metadata cannot confer rights. |
| Protected proposals/publication | 03 §2/5/10; 04 ASER-C03 | Plugin output is an observation or candidate; approved cases/requirements/Bugs/Skills retain native review/apply. |
| Task/attempt/recovery | T-201–205/T-408; 03 v1.4.47/48; 04 ASER-C04 | Pin contributing package/input basis and native operation receipts; no alternate plugin job-history authority. |
| Methods/content packs | T-422/D-14; current `src/skills/skills-governance.ts` | Immutable approved content and assignments remain separate; approved text cannot activate executable scripts. |
| Typed graph/impact | 03 v1.4.29 and subsequent GEX sections; 04 ASER-C02 | Package/source provenance can be referenced; a plugin-derived edge is attributed evidence, not approved truth or execution permission. |
| Evidence/diagnostics | 03 §12/v1.4.46/47; 04 report and ASER contracts | Package/producer/input binding supplements native evidence; telemetry is not an authoritative publication receipt. |
| Isolation/secrets/stopping | 03 v1.4.47; 04 v1.4.47 | Qualify chosen executable profile against existing controls; do not invent a second broker or stop plane. |

## Traceability reconciliation

The research branch refers to a proposed v1.4.49 and `docs/qa-orchestration/reviews/spec-review-20261127/README.md`. The latter is absent at the inspected PR #295 checkpoint, and parent recovery found only saved v1.4.48. Treat those links as an unavailable prior review/publication reference, not an actual assurance receipt. The current review should be published with its true date, inputs, scope and unresolved runtime gates; no earlier review, native synchronization, executed acceptance or release approval should be reconstructed or fabricated.

**Recommended disposition:** reconcile saved v1.4.48 intact, then add the narrow general plugin amendments above as the first verified current v1.4.49 candidate. Keep the ecosystem research and all plugin implementation in backlog pending selection, source-fit decisions and applicable proof. Independent final review of the written candidate should check cross-file agreement and ensure these additions have not duplicated native ownership or expanded the user's intended scope.
