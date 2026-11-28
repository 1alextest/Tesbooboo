# Red A — original independent source-based review of Tesbo 1.4.49 C1

**Date:** 27 November 2026. **Reviewer:** `/root/red_a`, independent Red Team member A; not an author of the candidate. **Evidence mode:** read-only source/document inspection, document-integrity checks and explicitly conceptual adversarial traces. **Original report:** frozen at first completion; subsequent informed corrections must be separate or clearly appended.

## Individual disposition

The candidate can remain a **Proposed / Backlog / NOT FROZEN** documentation amendment. I found no Critical or Major contradiction in the inspected 1.4.49 design delta that requires abandoning the general-plugin direction. This is not approval to construct a platform, approve a new persistent primitive, activate a Skill, or implement a first plugin. The negative-design challenge leaves several simpler alternatives alive; therefore a generic registry/runtime still has no sufficient negative design proof.

Two findings are retained below: **TESBO-RA01**, a Major source-based implementation gap in the existing sync owner relevant to future reuse, and **TESBO-RA02**, a Minor current-pointer inconsistency in the subordinate method view. RA01 is not introduced by this documentation delta, is not an executed reproduction, and must not be represented as a confirmed deployed incident. Its material implication is that native sync ownership is reusable but present stop/generation enforcement cannot be certified from that ownership alone.

This is one member's disposition. The unchanged Red charter requires two members for a formal team verdict. White owns final disposition after the actual team reports and Graph's correctly bounded evidence mode. Architecture/runtime/UI freeze, measured method effectiveness, native Tesbo synchronization and computed Graph CLEAN are not established here.

## 1. Assignment, independence and authority

Assignment received: independently review the connected v1.4.49 proposal, reconstruct the relevant existing owners at exact source parent `f92c3341eadc03f274becbead3b0f45d0a86539e`, derive an independent premise/alternative/contradiction challenge, assess bounded transfer of the engineering method, and freeze the original report without reading other team reports. I began with `review-candidate-v149/RUN_CONTEXT.md` and `INPUTS.json` and loaded the unchanged Red charter, review orchestration and portability policy.

I was dispatched separately without prior reviewer conclusions or an author answer key. I did not read any other member report before saving this output. The candidate itself contains historical verdicts, prior source findings, researched proposals and examples. I was exposed to those as disclosed evidence and framing; this is an **informed delta review**, not blind opportunity discovery, a retrospective pre-architecture gate or a method-efficacy experiment. My independent questions included whether a plugin object should exist at all, whether static content needs an installation lifecycle, whether a single-provider reconnection needs generation isolation, and whether a stopping request can be mistaken for effect fencing.

The supplied run permits source/docs and isolated integrity checks only. I made no repository/product edits, database access, native Tesbo writes, package installation, application tests, deployments, sign-ins or external messages. Writing this assigned report is the sole artifact mutation. No callable Tesbo connector was supplied, so **Tesbo sync not performed**.

## 2. Method and artifact identities

The reviewed target is `1alextest/Tesbooboo`, candidate **1.4.49 C1**, with `INPUTS.json` SHA-256 **dd8fa57f48ebcfe054dc98c69215539ea669ac932136291a622f5fe123233bfb**. I recalculated that digest and verified all 13 declared artifact byte counts and SHA-256 values. The immutable input manifest, rather than the mutable repository document working tree, defines this report's target.

- Frozen target root: `/workspace/scratch/e50b253d95e4/review-candidate-v149/`.
- Exact application source parent: `f92c3341eadc03f274becbead3b0f45d0a86539e`, read using `git show` and `git grep` in `/workspace/scratch/e50b253d95e4/tesbo`.
- Declared research parent: `7539a739243167b2d6709df1d644bd5b955f6ffc`; I reviewed the frozen research artifact supplied in C1, not the entire research-parent tree.
- Declared original eight-file v1.4.48 archive: SHA-256 `6665ba660aa208bd35db51b90052fc0b69abc01c6922c197544003e3480b1bef`, 707,628 bytes. Its lineage is supplied by the run/manifest; I did not independently re-open that archive. The eight supplied v1.4.48-to-C1 diff files were inspected.

The unchanged methods were recovered from **NesberryEnterprise/Nesberry@d83549c85a4dcd047fb40dc4fba4ec62737ab0fc**. I read these three documents completely and verified their local bytes against `methods/recovered-methods-manifest.json`:

| Method | SHA-256 verified locally |
| --- | --- |
| `.kiro/steering/teams/red-team-charter.md`, v2.6 | `4f9893d877d89b31b6e2c0c1d42b89b4136f3da4c8ea079b9fd40024cffb02cd` |
| `.kiro/steering/teams/review-orchestration.md` | `8fd41f22e1909afd48d8af95120d03a0f52e30a1bf9976a639fb6cca67bb4729` |
| `docs/policies/governance/POL-GOVERNANCE-ASSURANCE-PORTABILITY/v001.md` | `33c69cba82f7d98773e85a30fa1afff15cc0dbcec0d88302a0295ce06e2c8524` |

This verifies correspondence to the supplied recovered manifest, not an independent remote retrieval of every historical method blob. The methods were not edited. Their application-neutral reasoning and evidence obligations apply here; Nesberry marketplace nouns, operating commands and business policies were not imported into Tesbo.

The full 13-artifact identity table is retained in the verified [INPUTS.json](../review-candidate-v149/INPUTS.json). Especially relevant identity pins are canonical 03 `a9230d4d7bb64efb4ba2e247e66d0254f069b5e8303ac802ee67927f7d6c60a8`, canonical 06 `279edcd5d6b941a3cd35e3fc877748d875efd36a967143b5b00a0cd5db512c17`, subordinate Skills governance `e587d6754c58c8de33f67fbb0277c8814c8575ce8359a336b8f92a0a55cb6375`, and supporting plugin research `c93d89f7e2e233bc0ceceaa34bbd9fe366473e6fafa7b2567e2d11acf818a5e1`.

## 3. Examined scope and limits

### Candidate documents

I read all eight **final revision 1.4.49 sections**, the complete supplied delta files, the relocated quality/transfer gate in canonical 06, AGENTS.md, CLAUDE.md, source-manifest.json and the complete supplied plugin research review. I compared AGENTS.md, CLAUDE.md and subordinate Skills governance to the exact application source parent in memory: AGENTS adds the research-method link and current manifest pointer; CLAUDE is unchanged; the subordinate method replaces two copied gate paragraphs with links to canonical 06.

I independently followed these earlier contracts rather than treating the amendment as self-contained proof:

- Canonical 01, FR-054–062, particularly executor-specific FR-058 and optional unmanaged execution.
- Canonical 03, complete revision 1.4.46 evaluation section and revision 1.4.47 trust/lifecycle/control section. These explicitly separate implemented source owners from proposed qualification, authority and stopping guarantees.
- Canonical 04, revision 1.4.6 source-namespace/cross-channel clauses and ASER-C01 evidence/readiness, ASER-C02 identity/history, ASER-C03 exact protected application and the opening ASER-C04 composite boundary.
- Canonical 05, T-407–410 and associated sequencing; searches for T-408 and relevant prior proof-owner references.
- Canonical 06, Portable method for discovery and principle distillation, its principle table, independent-application boundary and the subsequent revision 1.4.31 trigger limitation.
- Subordinate Skills governance, opening ownership/authority/resolution/evaluation sections and complete §13.4/13.4.1 method view, including its current header.

I did **not** read every historical line in the roughly 1.9 MB canonical package. Long search output and initially truncated batched reads were used as navigation only; decisive sections were retrieved in smaller ranges. The scope above, not whole-file size or a keyword hit count, is the read claim.

### Exact application source

At `f92c3341…` I read root/backend/frontend package manifests; key schema portions of V47 and V72; full V97 soft-disconnect migration; full `integration-sync.types.ts`; `integration-sync.client.ts` connection-loading/token-refresh portion; `integration-sync.service.ts` run creation, run-state/failure/finish/progress and provider-folder-write portions; and `integration-sync.processor.ts` provider mapping table, dispatch, coordinator and per-ticket mirror path. I searched migrations for integration-connection consumers but did not inspect every migration body.

I read full `skills/skills-governance.ts`, full `mcp/mcp-access.ts`, the native `approveSkillVersion` and assignment-eligibility opening in `legacy.service.ts`, the integration OAuth reconnect/disconnect portions, and automation service's ownership rationale plus full `recordResult` path. Source searches located surrounding automation writer/readback methods. This does not amount to a complete MCP dispatcher audit, security review or all-writer consumer sweep.

### Primary precedent spot checks

I independently opened and inspected relevant official documentation on 27 November 2026:

| Source and locator | What the inspected text establishes | What it does not establish |
| --- | --- | --- |
| [Backstage extension points](https://backstage.io/docs/backend-system/architecture/extension-points/), sections Defining/Registering and Extension Point Design; web references `turn963019634view0`, `turn104776845view0` | Narrow public extension surfaces, duplicate registration rejection, a single task-runner example, and an additions-only design assumption tied to module installation | Dynamic tenant permission revocation, safe in-flight removal, or measured benefit in Tesbo |
| [VS Code extension runtime security](https://code.visualstudio.com/docs/configure/extensions/extension-runtime-security), About extension runtime permissions; `turn104776845view2` | The extension host has the application's permissions, including filesystem/network/process powers | A tenant sandbox merely because execution occurs in another process |
| [Jenkins plugin management](https://www.jenkins.io/doc/book/managing/plugins/), Removing/Disabling; `turn104776845view3` | Removal can leave code active until restart; dependencies affect removal; configuration retention and purge differ | A requirement for Tesbo restarts, a universal retention policy, or remote-process termination |

These limited checks support the candidate's mechanism/limitation distinctions. I did not independently revalidate every AQE/Nagual/Obsidian/Grafana/Terraform claim, install any upstream package, or reproduce vendor outcomes. Their remaining research claims are supplied secondary evidence for this report, not independently certified here.

## 4. Independently reconstructed problem and ownership

The owner's consequential goal is the ability to add optional capabilities while keeping native QA work usable, attributable and governed. The selected problem is not yet “operate a marketplace” or “run third-party code.” Those are possible future answers with separate costs and authority.

| Actor or consumer | Outcome and present owner | Material distinction |
| --- | --- | --- |
| Project member/source contributor | Supply bounded source material and find the native knowledge or proposed artifact | Uploaded/imported data is not approved governing content; source identity is not its filename |
| Permitted human reviewer/manager | Review the exact candidate or approved Skill binding | Package admission, Skill-version approval, assignment and artifact publication are distinct decisions |
| External executor | Carry out admitted work and report attributable attempts/results | A Tesbo receipt proves accepted reporting, not every claimed external action; stopping dispatch cannot undo a remote effect |
| Report/analysis consumer | Interpret permitted native evidence and uncertainty | Rendering/analysis is a projection, not a new result owner or execution oracle |
| Integration/operator owner | Configure, diagnose, change or retire a capability | Organization connection, project mapping, worker activity and retained history are different scopes |
| Core user without a plugin | Complete the supported native/manual workflow | Absence of an optional contribution must not fabricate readiness or force a new installation |

The source gives concrete owners: integration connections and mappings; sync runs and provider-specific tickets; knowledge documents; immutable governed Skill versions and assignments; MCP project grants; and automation's existing cycles/cycle_items/executions. The `SyncProvider` union is fixed to Jira/Linear/Notion. Automation deliberately reports into native result rows and refuses to invent an unknown case. The Skills resolver selects human-assigned approved immutable versions and returns conflict rather than arbitrarily choosing multiple matches. These are evidence for reuse candidates and boundaries, not proof of a complete general extension runtime.

Persistent facts potentially new to a future installed package—verified publisher/package artifact, installation ownership, resolved dependency set and configuration generation—still need an actual selected use case and schema-fit decision. C1 leaves that decision open instead of pretending existing MCP metadata already supplies it.

## 5. Premise falsification, negative design proof and compression

**Premise attack:** If the word “plugin” is removed, a member may still upload selected content, use an existing external client, apply an approved method or open a report. The native outcomes survive. Therefore the request does not yet justify a new mandatory Plugin domain or runtime. C1 survives this attack because its 01/03/04/05 sections permit existing/manual paths and explicitly avoid introducing a runtime, manifest API or parallel store.

| Alternative challenged | Evidence and remaining applicability | Negative-design result |
| --- | --- | --- |
| REUSE | Native knowledge and Skills records can carry imported content; native automation and existing client grants already own reporting/access | Not rejected. Use where the selected outcome fits; import/installation must not imply approval |
| EXTEND | Fixed provider-specific sync adapters can acquire a bounded new source adapter; current native writers can gain necessary generation checks | Not rejected. Extension needs precise maturity and acceptance evidence, including RA01 |
| EXTRACT | A shared registration/lifecycle helper could be justified after two consumers demonstrate the same invariant | Unproven. A repeated noun or manifest shape does not establish a coherent shared mutable owner |
| COMPOSE | A user-owned executor can combine existing target tools with Tesbo reporting; declarative content can combine import with native review | Not rejected. Composition preserves native authority and does not require a Tesbo installation wrapper |
| PROJECTION-ONLY | Inventory, status and reporting may project existing records without owning result/approval truth | Not rejected. A catalog screen alone supplies no execution or admission guarantee |
| New persistent registry/runtime | No initial user outcome, hosting, distribution or permission model is selected | Not justified by C1. Requires a subsequent negative design proof and unchanged pre-architecture gates before freeze |

**Compression:** Remove a compulsory marketplace, standalone plugin settings screen, new approval service, plugin-owned evidence store, universal process runtime and mandatory `installationRef` for a mere content import. The owner's optional-capability goal remains expressible. Keep only semantically applicable identities and transitions. C1's logical-field table could be over-read as all fields mandatory everywhere, but its “selected contribution,” existing-reference and required/optional/null/unknown qualifications, plus the workflow instruction to show applicable concepts only, provide sufficient counterevidence. I do not raise a defect from that over-reading; future adapter contracts must instantiate applicability explicitly.

**Participation and wrong-parent attack:** A provider connection can support multiple project mappings; a package may contribute both a source importer and a renderer; a Skill assignment belongs to its reviewed project context rather than the package's enabled flag. Package removal cannot become authority to revoke unrelated assignments or shared credentials. C1 preserves these distinctions. A single combined “installed/enabled/healthy/approved” truth would violate them, but is expressly rejected by the proposal.

**Analogy attack:** Backstage's module-initialization/additions-only model does not supply an answer for current permission revocation during an external call. Jenkins's restart-dependent stopping is a reason to expose effective state, not a reason to impose restart semantics. VS Code's extension-host separation cannot be used as tenant confinement. The independently inspected primary pages support these limits; C1 does not silently import the rejected mechanisms.

## 6. Unlike-profile traces and opposite siblings

These are source-grounded design traces, not executed journeys or complete cross-profile qualification.

### Trace A: selected source/content, with no executable plugin

1. An authorized member selects a bounded document snapshot and a destination project; a manual upload or existing connector can be adequate.
2. Native source/knowledge records own received bytes, source identity and receipt. A user-declared origin remains weaker than observed bytes and authenticated uploader.
3. An optional authoring step produces an inert candidate. Native exact-version review is the acceptance boundary; an imported `approved` field and a signed package cannot supply it.
4. A later source update preserves the relied-on native revision and routes the changed source through the existing owner.
5. Removing the delivery package does not retroactively erase approved native material. Current reads still enforce applicable source/derived-data permissions.

The opposite sibling is a one-time declarative Skill pack. It has no live connection, worker heartbeat or physical stop. Its meaningful states are import/candidate/version/assignment under T-422. The inspected resolver and approval path give a real existing owner. Forcing that pack to create a second plugin activation authority fails the compression test; C1's content-profile language avoids requiring it.

Remaining source/profile questions are the selected native intake contract, supported input format, exact source namespace and permissions. No Obsidian choice or live import was made.

### Trace B: independently operated executor with an uncertain external effect

1. An existing client with a current project grant obtains its permitted work under the executor contract, without a mandatory Tesbo companion.
2. The operation pins the applicable task/input/attempt and authority basis. The external client's real target access and stopping capability are separately established.
3. The external action begins; the response is lost and Tesbo access is revoked.
4. Native protected writes and new work must reject stale authority. The actual external effect can remain committed or unknown; neither “disabled” nor a rejected report proves it did not happen.
5. Authorized reconciliation preserves the original attempt and receipt, and a new attempt is admitted only with current authority and an understood prior effect. Native permitted historical evidence remains interpretable after the adapter is removed.

The opposite sibling is a read-only report renderer: failure may remove presentation without undoing or invalidating an independently established native result. A source/renderer has different required recovery evidence from the executor. The proposal keeps that distinction and avoids a universal stopped/succeeded flag.

The existing automation result path demonstrates native result ownership, explicit-attempt conflict handling and an exact duplicate no-op for that contract. It does not prove a generic executor lease, package generation or cross-process cancellation guarantee. Existing unindexed legacy reporting also retains a narrower ordering guarantee. Those limitations cannot be erased by putting the reporter in a plugin manifest.

## 7. Findings and counterevidence

### TESBO-RA01 — native sync stopping is not a proved effect fence, even with one provider connection

**Severity:** Major for implementation/reuse acceptance. **Category:** Invariant / Failure / Spec-Code-Drift. **Status:** Open source-based gap; preserve as an affected implementation gate. **Change attribution:** existing application source at `f92c3341…`, not a new C1 runtime regression. **Runtime status:** NOT RUN; no deployed incident alleged.

**Evidence:**

- `integration-sync.service.ts:85–145` creates a run with a connection ID but queues a payload containing run/org/project/provider/actor, without an immutable connection-configuration generation.
- `integration-sync.types.ts` likewise gives the per-ticket job provider/ticket/run scope without that generation.
- `integration-sync.service.ts:194–201` changes a run to `running` using only `WHERE id = $1`; it does not refuse a run previously settled as failed.
- `integration-sync.service.ts:270–278` marks active runs failed during disconnect. `legacy.service.ts:14887–14934` then clears credentials and disables mappings, while deliberately retaining tickets, folders and mirrored documents.
- `integration-sync.processor.ts:162–190` loads the current connection by organization/provider and the current enabled project mapping. `integration-sync.client.ts:119–154` implements that current-row lookup.
- `integration-sync.processor.ts:453–637` reads a ticket, loads a connection, performs awaited provider/analysis work and eventually writes the knowledge mirror. Its native transaction checks the destination folder but does not test run terminal state, disconnect state or original connection/configuration generation immediately before the mirror mutation.
- `integration-sync.service.ts:431–450` confirms the folder check is about existing folder identity/deletion, not the connection or run fence. V97 and the OAuth upsert retain/reuse the same connection row across disconnect/reconnect; the connection ID alone therefore cannot distinguish changed source-account meaning.

**Adversarial source trace:** A ticket worker has obtained a valid connection and is waiting on an external call. A permitted manager disconnects, which settles the run and clears the current credentials. The already running worker can retain its earlier connection object; after the awaited result, the inspected mirror transaction has no corresponding run/connection-generation check. The source therefore does not establish “no later native mirror write after the fence.” Separately, a delayed coordinator can attempt to change a failed run back to running and resolve whatever connection/mapping is current. Both mechanisms are relevant with one connection slot; multiple simultaneous accounts are not required.

**Impact:** A future adapter that treats the existing sync owner as already implementing C1's generation and revocation guarantees could record new source-derived effects after requested shutdown or attribute stale work to a replacement configuration. The exact production frequency, provider behavior, concurrent uniqueness outcomes and deployment state are unknown. This is a code-path consequence requiring focused runtime proof, not a claim that a customer's data was exposed.

**Counterevidence and scope:** Disconnect does clear credentials and disable mappings; current requests can therefore fail, and disappearance of a destination folder also stops a mirror write. Those controls reduce reachable paths but do not supply the missing final fence for a worker that already read its inputs. C1 03's lifecycle section and 04's protected-commit checks already require generation/current-authority enforcement. Earlier 03 revision 1.4.47 and 04 ASER-C02 also require current authority and original binding/configuration. This makes the proposed invariant adequate; the gap is implementation maturity and explicit proof routing. I do not mark the entire proposal defective or demand a schema change now.

**Recommendation:** Preserve this as a source-owner investigation under the existing integration/sync work. Clarify that **single-provider reconnect/in-flight disable** also needs generation/effect-boundary proof, outside the conditional multiple-account row. Before affected implementation acceptance, derive a discriminating test that pauses a worker at the awaited boundary, disconnects or changes the source basis, resumes it, and observes no forbidden native write; pair it with legitimate same-generation completion and permitted historical readback. Bind any fix to the actual native transaction/authority owner. No new scheduler, plugin registry, automatic purge or product test is authorized by this report.

### TESBO-RA02 — subordinate Skills header still describes 1.4.46 as this branch's proposal

**Severity:** Minor. **Category:** Assumption / Spec-Code-Drift (document navigation). **Status:** Open documentation reconciliation item.

**Evidence:** Frozen `docs/specs/agent-synchronized-engineering/skills-governance.md:3` describes merged publication 1.4.45 and says “this branch proposes 1.4.46.” The C1 source manifest and all eight current-package pointers identify 1.4.49. C1 changes §13.4.1 of this same subordinate file to reference the new canonical precedent-transfer method, while leaving the opening current-branch sentence unchanged.

**Impact:** A reviewer entering through this subordinate view can reasonably identify the current review target incorrectly or attach a receipt to the wrong candidate. This is a navigation/provenance ambiguity, not a second active Skill or a product security defect.

**Counterevidence:** The header expressly subordinates the file to the eight canonical documents, and canonical 03 already clarifies that older copied-view labels retain historical scope. The correct target is therefore resolvable; no authority has actually been transferred to the stale header.

**Recommendation:** Make the opening current-package pointer resolve to the current source manifest/1.4.49 proposal and keep 1.4.45/1.4.46 statements labeled as historical scope. Preserve old receipts and historical bodies. No runtime change or new governance owner is needed.

## 8. Bounded transferable-method assessment

### Fixed wording and mechanism

I used C1 canonical 06's fixed step-4 obligation: compare the target's actors, scale, tenancy, trust, data, lifecycle, existing owners, business rules, operational ability and deployment constraints; decide adopt/adapt/reject/defer/no change with reasons and unknowns. I held its meaning fixed while generating the following probes, together with step 5's observable discriminator and contrary/no-change case. I did not revise the rule to match the selected outcomes.

**Trigger:** a consequential design choice is being justified using another system's precedent. **Mechanism:** copying the mechanism without matching the target's effect and authority boundary can preserve the borrowed shape while defeating the target outcome. **Invariant:** target obligations and the evidential strength of the conclusion survive the transfer. **Owner:** the existing target decision/work owner, with the applicable specialist and legitimate human authority. **Refutation:** a case in which applying the wording necessarily forces the original infrastructure despite a justified conforming alternative, or cannot retain UNKNOWN when evidence is missing.

### Case selection, predeclared checks and dispositions

These two non-origin contexts were selected by this reviewer for dissimilar effect/architecture families, not copied from the proposal's source/executor examples. They are hypothetical stipulated contracts; no corresponding repository, device or runtime was inspected. The check/oracle is stated before the conceptual result. They are not empirical held-out validation and supply no measured discovery or cost claim.

| Context | Check and oracle derived from fixed wording | Conceptual result and limit |
| --- | --- | --- |
| Offline warehouse label workstation; physical output and an unreliable spooler acknowledgement | Before adopting a cloud retry pattern, determine whether a retry can print a second usable shipping label. Oracle: stipulated one authorized physical label; an unknown first print must remain unknown until a supported reconciliation step. Forbidden effect: unexplained duplicate print. | Blindly replaying after timeout is nonconforming; preserving unknown status and obtaining a physical scan/operator reconciliation can conform without a distributed plugin registry. A device that proves deduplication for its job ID is a valid alternative. Actual printer semantics are UNKNOWN absent evidence. |
| Stateless public unit-conversion page; deterministic recomputation with no retained user state or external effect | Before importing durable queue/receipt infrastructure from a stateful service, inspect the stated outcome and failure semantics. Oracle: correct conversion from the submitted value/unit, with readable invalid-input feedback. Forbidden effect: changing result meaning or claiming a persisted operation that does not exist. | Recomputing a pure deterministic conversion can conform without durable operation receipts; retaining the existing function is a valid no-change decision. A queue/registry is not justified solely because another product uses one. A hidden billed API or persisted submission would change the semantics and reopen the choice. |

The originating regression is preserved separately: a plugin's “disable succeeded” label cannot substitute for the true effect boundary, illustrated by RA01's actual source trace and C1's external-executor limits. The unlike contexts above include a defective/conforming pair, a legitimate alternative, a no-change case and missing-evidence treatment. An allowed exception is omitting persistent operation identity for a genuinely stateless pure computation; that exception does not relax authority checks for a protected write or remove the original plugin regression.

### Competing explanations and assessment

A design that performs well at an established company may owe that outcome to its operational staffing, workload shape, limited extension population or selection/reporting bias, rather than to the borrowed API or lifecycle design. The three official pages inspected establish mechanisms and constraints, not causal outcome measurements. C1 explicitly permits these competing explanations and unknowns.

The proposed procedure is sufficiently concrete to generate distinct checks and legitimate different decisions in this small conceptual sample. It strengthens the existing principles without needing a new registry, role or automatic gate. Its benefit over the incumbent method remains **UNESTABLISHED**. This review was already shown the explicit proposal, and its questions could also follow from the unchanged Red charter. My source finding cannot be attributed causally to C1's new wording. No percentage grade, universal portability or improved discovery is claimed. The existing T-422/FR-124 evaluation owner would need separately selected tasks, an eligible baseline, independent criteria, original outputs, contrary/no-change/UNKNOWN results and effort/cost accounting before any effectiveness claim.

## 9. Actual verification and residual gates

| Check actually performed | Outcome | Evidential boundary |
| --- | --- | --- |
| Compute input-manifest hash and all 13 candidate byte/hash matches using Python standard library | All matched supplied identities | Document integrity only; not semantic correctness |
| Compute three method file byte/hash matches against recovered manifest | All matched | Local recovered identity; no charter edit or remote provenance re-audit |
| Read all eight supplied delta files and final 1.4.49 sections; follow selected earlier owners | Completed within stated scope | Not whole-history/full-system review |
| Compare AGENTS, CLAUDE and subordinate Skills text to exact source parent in memory | Changes identified as described; CLAUDE unchanged | No repository mutation |
| Inspect exact-commit source owners and trace the stop/reconnect boundary | RA01 source gap; documented countercontrols retained | No test execution, timing measurement or deployed reproduction |
| Independently spot-check three official precedent pages | Inspected claims support the bounded transfer cautions | No vendor-performance validation; remaining precedent claims not rechecked |
| Conceptual premise, compression, two unlike contribution traces and two non-origin transfer probes | Alternatives remain viable; sampled method wording can preserve different valid outcomes | Manual conceptual assessment; no runtime acceptance or causal comparison |

The work did not run product tests, test discovery, database queries, installs, migrations, native cases, UI automation, runtime plugin invocation or Graph tooling. There is no authentic current UI capture: **VISUAL-BASELINE BLOCKED / runtime and human comprehension NOT RUN**. C1 includes no actual mockup or existing-screen change to certify here.

Before an affected implementation can be accepted, the existing owners must select the user outcome and profile, resolve any new installation/distribution/permission power, prove actual compatibility and containment where applicable, qualify final generation/authority checks, define retention/recovery and observe one packaged native outcome with its refused/adverse controls. A source review does not resolve these gates. Safe research and document reconciliation can continue while those implementation choices remain open.

**Handoff to Red B / coordinator / White:** preserve the two findings with their evidence modes; independently evaluate RA01 before calling it a runtime defect or attaching it to another current product issue. Do not reclassify retained current behavior as a shipped general plugin platform. Retain this report unchanged for later informed synthesis and preserve any disagreement.
