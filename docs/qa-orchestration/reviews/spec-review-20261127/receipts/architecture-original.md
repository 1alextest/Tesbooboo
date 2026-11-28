# Blue / Green / Graph initial source review — general Tesbo plugins

Review date: 27 November 2026. Reviewer: `/root/architecture_review`, separate analytical agent covering Blue (archaeology/reuse), Green (seams), and Graph (ownership/traceability). This is one attributable multi-lens analytical review, not three independent teams, human approval, runtime testing, or a specification freeze.

## Exact inputs and limits

- Canonical repository input: PR295 `f92c3341eadc03f274becbead3b0f45d0a86539e` at `/workspace/scratch/57132e18e2df/tesbo`.
- Research input: PR315 `7539a739243167b2d6709df1d644bd5b955f6ffc` at `/workspace/scratch/57132e18e2df/tesbo-research`, `docs/qa-orchestration/reviews/plugin-ecosystem-obsidian-review.md`.
- Read `AGENTS.md`, relevant operational mandates in `CLAUDE.md`, existing scope/journey/finding procedures, canonical 06's portable method, relevant canonical 01/03/04/05 obligations, and the complete plugin research document.
- Examined current source definitions and dispatch/configuration seams in `integration-sync.types.ts`, `integration-sync.client.ts`, `integration-sync.service.ts`, `integration-sync.processor.ts`, `IntegrationsTab.tsx`, V47/V72/V73 migrations, `mcp-access.ts`, and `mcp.service.ts` on the research worktree. This is static source evidence, not deployed schema or runtime evidence.
- Parent is retrieving a potentially newer saved specification package. No conclusion here certifies its unseen contents. Existing historical receipts retain their original scope.

## Findings and required disposition

### ARCH-01 — High: publication claims exceed the available canonical Git artifacts

Research lines 214–215 assert that the general plugin correction is reconciled in a proposed v1.4.49 amendment through PR295 and that a connected review record is published at `docs/qa-orchestration/reviews/spec-review-20261127/README.md`. At the exact PR295 input, canonical 00 ends with revision 1.4.47; the purported review directory is absent. The available research cannot establish that named reconciliation or review publication.

**Impact:** a reviewer can treat unobserved specifications and unavailable receipts as an already-reconciled design. The intended general scope itself is clear in PR315; its canonical publication evidence is not.

**Disposition:** recover the latest saved artifacts, retain their exact provenance, reconcile into the existing canonical owners, and publish/verify the actual target before describing the links as available. If not recovered, change the unsupported claim to a truthful pending handoff. Do not create a new package version just to fit a stale assertion. This is a traceability/publication defect at the pinned inputs, not proof the missing saved artifacts never existed.

### ARCH-02 — Medium, blocks a future SDK contract: plugin identity does not settle contribution conflicts

The proposed contract names unique publisher/plugin IDs, immutable versions/digests, dependencies, typed operations, and native ownership. It does not yet specify collision/ownership behavior when two admitted packages declare the same tool alias, source namespace, route/UI contribution, event consumer, or shared capability. A globally unique package ID is insufficient to identify which contribution owns a host-facing name or effect.

**Impact:** silent last-installed-wins dispatch, shadowing of a core action, duplicate event effects, or a plugin bypassing the authoritative native operation through a second registered writer.

**Disposition:** the canonical technical/contract owners should require namespaced contribution identity and explicit admission-time conflict handling; protect core names, identify the native owner each contribution delegates to, and record precedence only where the host supports a deliberate composition rule. Unknown/ambiguous ownership blocks that contribution. Qualify upgrades, disable/removal and dependent consumers against the same mapping. This need not prescribe a marketplace, a specific SDK, or a second command registry.

**Future falsifier:** install/admit two otherwise-valid packages claiming one reserved or already-owned contribution; no silent replacement or doubled external/native effect occurs, and the unaffected authorized contribution remains usable. Runtime scenario NOT RUN.

### ARCH-03 — Medium: broader engineering research is implied, but the decision trail is underspecified

AGENTS principle 1 requires external-producer discovery; principle 15 requires dependency evaluation. Canonical 06 already owns principle distillation and context-sensitive transfer. These are strong foundations, but neither existing wording nor the plugin research establishes a consistent team handoff that distinguishes an external mechanism from a measured success, records failures and non-transfer conditions, and shows which specific Tesbo decision changed because of the evidence.

**Impact:** teams can cite familiar products, copy an architecture, or accumulate links while leaving the actual rationale and applicability untested. The opposite failure is redundant research or ritual comparisons for trivial changes.

**Disposition:** extend the existing owners rather than create another engineering rulebook or a plugin-only Skill. Require proportionate investigation of materially relevant prior designs, failures, alternatives and context; a concise evidence-to-principle-to-local-decision trail; an uncertainty/falsifier; and a reason to stop or revisit. Sources need not come from test-management competitors. A verified existing solution, reuse, configuration, manual flow, or no change remains a legitimate result. Source research is not authority to add scope or adopt dependencies.

## Confirmed reuse and constraints — no duplicate findings needed

| Boundary | Actual source / existing contract | Consequence |
| --- | --- | --- |
| Built-in integrations | `SyncProvider` is the fixed `jira | linear | notion` union; `IntegrationsTab` has explicit provider entries; sync client/service dispatch branches are provider-specific. | Existing integrations are useful native owners, not an already-general package lifecycle. Extend only the appropriate seams when a profile is admitted. |
| Connection cardinality | V47 has `UNIQUE (organization_id, provider)`; `loadConnection(organizationId, provider)` follows that model. | Multiple accounts/vaults need an explicit migration and access/identity design before implementation. PR315 already records this accurately. |
| Imported source identity | Canonical 04 requires `(project, provider, connector/source namespace, external ID)`; the inspected processor conflict key uses project/provider/external ID/source role. | Preserve this identified contract-versus-source gap. A second vault cannot be admitted by merely adding its provider name. Do not claim observed production collisions. |
| Human annotations | V73 and processor comments identify native `knowledge_document_comments`, replacing the earlier sibling-note design. | Reuse the current owner; avoid reviving the retired note store. |
| Incoming MCP authorization | `mcp-access.ts` lines 85–98 refuses OAuth preapproval beyond `read`; `mcp.service.ts` requires `mcp:read` for this path and rechecks grants. | Successful OAuth connection does not authorize future proposal writes. Generic plugin admission cannot widen the established OAuth contract. |
| External MCP consumption | Existing Tesbo MCP is a server exposing native operations; that does not establish Tesbo as a host/client of arbitrary third-party MCP servers. | Keep consumption/hosting a separate capability and admission decision; avoid a universal command proxy by assumption. |
| Native QA truth | Existing Cases, Runs, attempts, reporter, evidence, Skills and approval owners already have authority/evidence contracts. | Plugin outputs remain observations/proposals through those owners. No plugin-owned alternate test truth, approval, knowledge store or scheduler follows from general extensibility. |

## Unlike-profile design traces

These are conceptual traces for validating the abstraction, not executed journeys or first-delivery selections.

1. **Knowledge connector:** permitted source selection → account/source binding → existing integration/knowledge intake → namespaced immutable source snapshot → native proposed artifact or retrieval → current authorized readback. Its main unique seams are external identity, selected-source scope and source change reconciliation.
2. **Execution adapter:** authorized test task/attempt → actual runner capability and target grant → bounded target execution → original output/evidence → native reporter/attempt ingestion → independent permitted readback. Its main unique seams are execution authority, side effects, cancellation and uncertain completion. It is not a `RemoteTicket` ingestion adapter.
3. **Skill/content package:** permitted versioned package intake → inert candidate content → existing review and exact-version approval → separate context assignment → effective content resolution. Installation alone neither executes code nor activates governing instructions.
4. **Reporting/UI contribution:** authorized native read projection → typed presentation/export → disclosure of freshness, missing evidence and accessible next actions. Executable UI requires its own rendering/data/host boundary; a report cannot manufacture native approval or become an alternative writer.

The current research correctly says unlike contributions need not use one execution mechanism and that proving the abstraction does not require shipping every profile. Preserve those qualifications. Shared metadata/lifecycle obligations should not force every profile through the built-in ticket-shaped `RemoteTicket` schema.

## Narrow ownership for the requested method amendment

| Owner | Appropriate amendment |
| --- | --- |
| `AGENTS.md` principle 1 | Canonical engineering-wide obligation: investigate relevant established approaches before building/extending, distill mechanisms and contextual limits, and record how evidence informed the decision. Reference details rather than copy a checklist. |
| Canonical `06_IMPLEMENTATION_AGENT_BRIEF.md`, Portable method | Concrete evidence → outcome/mechanism → reusable principle → fit/non-fit → local options/decision → discriminating evaluation → feedback procedure; proportional research and stopping/revisit conditions. |
| `docs/agent-scope-discipline.md` existing team/journey procedure | Assign source-informed challenges to existing team responsibilities and require attributable source/decision evidence in the same review. No new authority or invented independent-team receipt. |
| `AGENT_RULE_TEMPLATE.md` | A short reference to the canonical method and receipt, preserving original approval and native-sync boundaries. |
| Existing plugin research document | Source matrix, failure/caveat evidence, applicability and non-transfer decisions for this plugin proposal. Retain it as supporting research. |
| Canonical 01/03/04/05 and 02/07 as affected | Put requirements, architecture, contracts, scenarios and journeys at their existing homes. Preserve current IDs and backlog/approval status; method amendments alone do not select a runtime or first plugin. |

## Initial disposition

**Source review completed; correction supported with findings above. NOT FROZEN.** General-purpose scope and reuse direction are coherent in the inspected research. Canonical publication and traceable review evidence require reconciliation. Contribution-conflict behavior needs a written contract before an SDK implementation. Runtime, browser, actual native records, plugin-package interoperability and migration proof are NOT RUN. No application code, source specifications, protected configuration or native records were changed by this reviewer.

## Informed delta — recovered saved v1.4.48

After the initial pass was recorded, the coordinator supplied `/workspace/scratch/57132e18e2df/saved-canonical-v1.4.48/`, eight files, saved archive version 33 / SHA-256 `6665ba660aa208bd35db51b90052fc0b69abc01c6922c197544003e3480b1bef`. I read the added v1.4.48 sections of all eight files and the adjoining v1.4.47 technical/contract controls. This is an informed delta to the original review, not a cold rerun or a new independent reviewer.

The recovered input adds dependency-aware task coordination, independently grounded checks, bounded local correction, combined revalidation, and governed planning feedback. It does not contain the general plugin v1.4.49 amendment or the claimed connected review receipt. ARCH-01 therefore remains a publication/traceability issue. Recovery resolves the availability of saved48, not Git publication of an unseen49.

Much of the needed security/lifecycle foundation already exists in revisions 47–48: current grants after waits, descendant fencing, resource/budget control, receipt reconciliation, truthful stop/readback, source/derivative access, and independent evidence. Reference and apply those controls per contribution instead of cloning their full text into a new plugin subsystem.

Plugin package/version/capability dependencies are a different relationship from v48 task-unit execution dependencies and from the application/assurance graph. An admitted package's dependency closure can reuse existing record/reference/operation owners while retaining its distinct meaning. It must not inherit dispatch authority, a green dependency result or a new graph database by analogy. Disable/revocation follows the actual dependent capabilities/grants and preserves unaffected shared connections and lawful historical evidence.

### Additional primary-source check

The following official sources were opened on 27 November 2026. They document mechanisms and caveats, not measured proof of benefit in Tesbo.

| Source | Observed mechanism | Transfer / non-transfer decision |
| --- | --- | --- |
| [Backstage backend extension points](https://backstage.io/docs/backend-system/architecture/extension-points/) | The registration example throws on duplicate action IDs. The singleton runner example rejects a second provider. Docs recommend small public extension interfaces and a separately named successor for a breaking API. | Supports ARCH-02's collision refusal and explicit version boundary. Does not select Backstage as a dependency or justify its topology for Tesbo. |
| [Backstage plugin modules](https://backstage.io/docs/backend-system/architecture/modules/) | Modules initialize before the target plugin; registration cannot continue after initialization. Modules depend on public extension-point libraries rather than a duplicate plugin implementation package. | Define actual supported activation/registration phase and public interfaces. Do not infer dynamic hot reload or universal runtime replacement. |
| [Backstage backend plugins](https://backstage.io/docs/backend-system/architecture/plugins/) | Static configuration is preferred for lighter customization; extensions are used when configuration is insufficient. The project defines its own inter-plugin network boundary. | Compare configuration and native adapters before inventing a public SDK. Retain Tesbo's native modular-monolith/domain owners; the vendor's microservice-oriented boundary is not adopted. |
| [VS Code contribution points](https://code.visualstudio.com/api/references/contribution-points) | Different capabilities have distinct manifest declarations; MCP provider collection IDs must match runtime registration; setting IDs must be unique. | Compare declared and actually registered contribution identity during package proof. A manifest description does not demonstrate invocation, correct effects or authorization. |

These observations strengthen the existing proposed dispositions; they do not remove the need for a scoped first user outcome, native contract implementation, independently observed runtime proof and normal review authority.
