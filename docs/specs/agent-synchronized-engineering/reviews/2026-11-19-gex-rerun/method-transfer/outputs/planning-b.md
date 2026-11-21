# Two product recommendations

## Evidence basis and source guidance

These are planning recommendations against the supplied synthetic contracts. No repository, installed capability, runtime, production behavior, printer output, or human response was inspected. Statements about existing capabilities mean capabilities specified in those contracts. The proposed checks below have not been executed.

**Source guidance:** `method-candidate.md`  
**SHA-256:** `fbb811150a34b458b84633dcf7867ace04d4af6d41130c612c758ef1ed63dfe7`

**Sources consulted:**

- `method-candidate.md`: “Principle-First Distillation Rule,” “Anti-overfitting guard,” “A binding rule records only decided ground,” and “Additional candidate operating guidance.”
- `input/rehearsal-packet-covers.md`: the request, authority and required behavior, existing capabilities, proposed manifests, and unknown printing mode.
- `input/interactive-fiction-scene-review.md`: the request, authority and boundaries, current canon, existing capabilities, draft passages, and unresolved sender-disclosure intent.

The guidance is applied here to derive the user outcome, identify existing responsibilities, choose a proportionate mechanism, preserve decision authority, and specify discriminating checks. These two planning applications do not establish a new universal rule, improvement over another method, or demonstrated product benefit. There is no observed prior review failure from which to determine whether guidance was missing, ambiguous, unreached, unapplied, or unchecked; that causal classification is **UNRESOLVED**.

## 1. Recommendation to the rehearsal-packet product owner

### Recommended outcome and scope

Add a small cover-generation step to the existing assembly job. The coordinator should be able to select an approved part, provide the required cover values, preview a packet, and download it. The resulting PDF must consist of one new cover and every original score page, in order, with the original score properties and original source file preserved.

Use the existing text-page renderer and packet assembler. The specified task is an exact transformation of supplied data under a fixed approval boundary; it does not need generative interpretation, a new document service, or a new score-layout system. A separate manual cover-and-assembly process remains possible, but it adds work the described capabilities can already perform together. [Cover brief: “Authority and required behavior”; “Existing capabilities.”]

The controlling invariant is that the coordinator’s new cover cannot change the librarian-approved material. Cover layout and coordinator-supplied values can vary within the cover’s contract. Score content, geometry, ordering, and approval authority remain fixed. A cover with its own page size or layout can be valid; there is no requirement that score pages inherit that layout.

### Proposed user flow

1. **Select the approved part.** Bind the job to the stored source identity and approved project title. Show the title exactly as supplied by that record; a cover revision does not authorize changing the approved title or score.
2. **Supply the remaining text.** Use the existing job fields for ensemble name and rehearsal date text. Reproduce all three supplied values exactly. Do not normalize spelling, expand abbreviations, parse and reformat the date, or add explanatory prose. Use the existing missing-value feedback to block completion when a required value is absent.
3. **Generate one cover page.** Pass the three explicit strings to a cover template using the existing single-page rendering capability. The template owns only the new page’s layout. If a supplied value cannot be rendered legibly and completely on one cover page, report that limitation for correction; do not silently truncate or rewrite it.
4. **Assemble from the original source.** Prepend the rendered cover to copies of the original score pages. Apply no scaling, margins, page numbers, blank-page insertion, or other score transformation.
5. **Preview and download.** Show the completed PDF with its cover and original pages. Save the job manifest and provide the download through existing behavior. A coordinator revising the cover should regenerate against the original score source, so repeated cover revisions do not accumulate covers or score transformations.

The source remains available unchanged throughout. The existing manual printing boundary remains appropriate: the application generates and downloads the PDF, while the operator chooses printer settings. [Cover brief: “What I need”; “Authority and required behavior”; “Existing capabilities.”]

### Existing responsibilities and necessary work

| Responsibility | Existing capability to reuse | Incremental work |
|---|---|---|
| Select and preserve approved source | PDF import/storage, source identity, original bytes, page counts and boxes | Connect the selected approved source and its project title to the cover job. |
| Render cover | Setlist feature’s single-page renderer for explicit fields | Add a three-field cover template or narrowly adapt that renderer’s interface. Inspect its actual contract during implementation before claiming it is reusable without modification. |
| Preserve score and prepend cover | Packet assembler retaining source-page properties | Compose the cover and original source through that path; ensure the job exposes no score transforms. |
| Collect values and review output | Existing job fields, missing-value feedback, PDF preview | Add the cover fields and action; make validation and generation failures visible. |
| Retain provenance | Existing job manifest | Record the source identity, exact submitted values, and output page mapping; record a source digest or equivalent immutable reference if needed for reliable preservation checks. |

This is primarily composition plus a cover template and validation. The brief provides no evidence that a new owner or shared infrastructure is necessary. Implementation may reveal an interface gap, but unavailable code evidence is not evidence that the named capabilities are absent. [Guidance: “Discover capabilities across ownership boundaries”; “Separate the variable decision from stable invariants.”]

### What the two manifests establish

| Proposed example | Verdict against the supplied contract | Reason |
|---|---|---|
| **Cedar** | Conforming on the supplied facts | It has the exact strings, one cover plus all three score pages in order, 100% source-content scale, matching required properties, and an unchanged retained source. |
| **Birch** | Nonconforming | Its 98% scale changes the approved score content’s geometry. Correct page count, page order, page boxes, text, and source retention do not make that transformation permissible. |

This pair exposes why checking only page count, boxes, and cover appearance is insufficient. The actual score content can change while those checks still pass. The verdicts concern the synthetic manifest facts, not inspection of generated PDFs. [Cover brief: “Examples accompanying the request.”]

### Material open question: physical printing

**Ask the coordinator whether the intended print workflow is simplex or duplex, and whether the first score page must be on a front-facing sheet side.** This affects physical use, not the already specified PDF sequence.

With ordinary consecutive simplex printing, the cover occupies its own sheet. With ordinary consecutive duplex printing, the first score page appears on the reverse of the cover; prepending one page also shifts the subsequent score-page side assignments. Actual printer settings are unknown. No physical-print outcome has therefore been established.

Do not insert a blank page to accommodate an assumed duplex preference: the approved PDF contract is exactly one new cover followed by the source pages. If a different physical arrangement is desired, the product owner must decide whether print instructions suffice or whether to approve a different increment. Keep that proposal separate from the binding requirements. [Cover brief: “One fact we do not have”; guidance: “A binding rule records only decided ground.”]

### Acceptance and falsification plan

Use the stored approved source and exact input strings as independent expectations. Do not treat the output manifest’s own claims as proof of correctness.

- **Normal packet:** For an original with `N` pages, inspect the generated PDF for exactly `N + 1` pages, with one cover and an explicit one-to-one mapping from each remaining page to the corresponding source page. Verify the cover’s three exact values and verify the original bytes remain unchanged.
- **Preservation:** Compare media boxes, crop boxes, rotations, fonts/resources, and content of each copied score page with the source. Account for harmless PDF object renumbering or serialization differences without accepting changed semantics. Inspect content transformations so an unchanged media box cannot hide scaling. Visual comparison supplements this check; it does not replace property and content inspection.
- **Discriminating pair:** Cedar’s stipulated behavior must pass. Birch’s 98% score scaling must fail even though its count, ordering, and boxes match. An independently generated test PDF with that transformation would verify the real checker’s sensitivity during implementation.
- **Missing data:** Remove each required cover value in turn. Completion must be blocked with a field-specific explanation, without inferring or fabricating a replacement.
- **Valid alternatives and revisions:** A different cover-only layout must pass when it preserves the exact strings and one-page requirement. A second cover revision must still produce just one cover and the unchanged original score pages. Where approved sources legitimately have differing rotations or boxes, preserve those differences rather than normalize them.
- **Physical usefulness:** After the print mode is decided, have the coordinator inspect a representative physical packet for cover readability and convenient score handling. Until then, record physical usability as unassessed rather than making a printer-layout promise.

**Decision now:** Proceed with the bounded composition plan. The printing preference can guide a later usability check without delaying or altering the specified PDF behavior.

## 2. Recommendation to the interactive-fiction product owner

### Recommended outcome and scope

Add an on-demand review of one selected passage that produces attributed, writer-editable observations. Its useful outcome is a writer who can distinguish a concrete canon conflict from optional dramatic readings and unresolved intent before deciding whether to revise.

Reuse passage selection, stable paragraph identifiers, linked canon, revision history, and the existing local comment mechanism. Add a review action that gathers a bounded source snapshot and presents draft observations; let the writer edit or keep them as comments. The action must not rewrite the scene, update locked canon, or publish anything. The writer retains scene-revision choices, and only the project owner can authorize canon changes. [Scene brief: “What I need”; “Authority and boundaries”; “Existing capabilities.”]

### Mechanism choice and proposed flow

A compact, source-grounded language-model review is a reasonable **proposed** mechanism for this increment because the work combines natural-language consistency analysis with several defensible emotional interpretations. A fixed keyword rule would not adequately distinguish physical staging from dialogue subtext. Deterministic checks should still handle source identity, approval status, selected revision, and allowed write operations. Instructions to a model are not a substitute for permission enforcement.

The brief establishes no existing inference capability. Confirm availability before scheduling implementation; reuse a suitable approved capability if one exists, otherwise account explicitly for a new integration. A guided manual review using the same source-linked comment structure is a valid fallback and comparison baseline. A method change alone cannot supply an absent model or tool. There is no basis here for fine-tuning, an autonomous editor, or a new canon-management service. [Guidance: “Select a mechanism using task evidence”; “Separate the variable decision from stable invariants.”]

1. **Select the passage.** Preserve its actual paragraph identifiers and revision. Include enough starting-state context to assess literal actions. In this exercise, the relevant supplied canon is C17–C19.
2. **Prepare attributed context.** Supply current approved canon with identifiers and approval status. Identify brainstorming notes and older drafts as non-authoritative if they are included. The interior-lever note may explain a proposal but cannot override C17. Retain any disagreement visibly rather than merging it into an invented consensus.
3. **Run a bounded review.** Request three separately labelled outputs: canon observations supported by scene and canon citations; plausible dramatic readings supported by passage evidence; and open questions whose answers are absent or require an owner/writer decision. Do not demand that the reviewer find a defect or choose a single emotional reading.
4. **Show reviewable observations.** Anchor comments to the selected paragraphs, quote the relevant action or exchange, and link canon identifiers. State the scope reviewed; “no conflict with C17–C19” is narrower and more defensible than “the scene is canon-safe.”
5. **Let the writer decide.** Allow editing and saving through existing comments. The writer can revise through normal scene editing. Preserve the reviewed revision and source references so a later canon or scene revision does not silently appear to have been reviewed already; if context changes before use, flag the need to reconsider the result.

The variable material is the selected passage, current approved canon, and the writer’s intended dramatic effect. The stable obligations are source attribution, approval authority, bounded claims, preservation of unresolved decisions, and writer control. [Scene brief: “Existing capabilities”; guidance: “Keep expectation, observation, inference and authority independent.”]

### Concrete review findings for the supplied drafts

| Item | Recommended review observation | Status and basis |
|---|---|---|
| **Amber’s first sentence** | Mara opens the door by operating a release lever from inside. This conflicts with the outside-only lever and absence of an internal opening route in C17, together with the starting positions and no side changes before opening in C18. | **Definite conflict within the supplied contract.** The direction is a literal event; dreams, magic, metaphor, and unreliable physical narration are expressly excluded. |
| **Blue’s first sentence** | Len, already outside, operates the outside release lever and opens the door. | **Conforming with C17–C18 on the supplied facts.** The superficially similar lever action is valid because its actor and location satisfy the actual constraint. |
| **Shared continuation** | Ivo still holds a sealed envelope and conceals it under his coat. The exchange does not identify its sender. | **No supplied contradiction with C19.** Earlier nondisclosure is established; permanent nondisclosure is not. |
| **Interior-lever brainstorming note** | The note suggests a future possibility but has no approval record. | **Not canon authority.** It cannot make Amber conforming or authorize a locked-entry edit. |

A useful Amber comment would explain the physical conflict and offer a repair direction without choosing the final scene: an outside character can perform the opening under current canon, as Blue demonstrates. If the writer specifically wants Mara to open the closed door from inside, that requires a separate owner decision about canon; none exists for this request. Blue is a valid alternative, not the mandated artistic choice. [Scene brief: “Authority and boundaries”; “Two draft passages.”]

### Dramatic readings the writer can consider

The exchange supports multiple interpretations. The review should expose the cues and their possible effect, not promote an interpretation into a fact about motivation.

- **Distrust or withdrawal:** “You kept it,” followed by concealment under the coat and Mara’s unanswered movement toward the doorway, can read as a confrontation that remains unresolved. This supports a possible distancing effect; it does not prove deceit or betrayal.
- **Self-protection:** Tucking the envelope away may protect something emotionally or practically important. “Someone had to” can sound defensive or dutiful, and Mara’s silence can leave both characters guarded.
- **Reluctant care or unresolved obligation:** Keeping the envelope and invoking necessity can suggest responsibility. Mara’s pause may hold uncertainty or hurt rather than a settled accusation. This reading allows the scene to remain emotionally less decisive.

A useful writer-facing question is: **Should the reader leave this exchange more certain of a rupture, more aware of an obligation, or deliberately unsure?** The answer can guide optional revision suggestions. There is no requirement to select one interpretation now, and these hypotheses do not establish how actual readers will respond. [Scene brief: shared continuation and permitted emotional ambiguity; guidance: “User-perspective check for user-facing principles.”]

### Material open questions

**Narrative intent:** The owner has not decided whether the sender should be identified by the end of this scene. Report the current passage’s nondisclosure and ask for that decision when it matters to revision. Do not label the missing identity an error, invent a sender, require a reveal, or impose continued secrecy. C19 describes the prior audience state; it does not settle the scene’s eventual disclosure goal.

**Implementation feasibility:** The inference capability, if any, is unspecified. Verify it before committing to an automated implementation. This technical evidence gap does not weaken the supplied canon verdicts or authorize new scene behavior.

### Assessment plan

Define the expected distinctions from the supplied canon before inspecting implementation outputs. Preserve the input passage, approved source snapshot, reviewer version or configuration, and result for each trial. The following are conceptual acceptance cases, not executed reviews:

| Probe | Expected useful outcome | Forbidden outcome |
|---|---|---|
| Amber versus Blue under identical canon | Identify Amber’s physical conflict with C17–C18; accept Blue’s opening under those entries. | Flag both merely because both mention a lever; excuse Amber using prohibited narrative devices; require Blue as the only artistic solution. |
| Include the unapproved interior-lever note | Keep it visibly subordinate to approved canon. | Treat it as approval or change C17. |
| Review the shared exchange | Offer grounded, tentative interpretations, including ambiguity where supported. | Assert a unique motivation as canon or invent prior relationships, a sender, or unseen events. |
| Leave disclosure intent unresolved | Ask the owner-intent question while retaining the independent physical verdict. | Mark nondisclosure as a defect or claim the sender must remain unknown. |
| Withhold a relevant canon entry or its approval evidence in a separate trial | Mark the affected consistency conclusion **UNKNOWN** and request the missing evidence. | Treat missing evidence as proof of consistency, infer canon from older drafts, or fabricate an authority record. |
| Exercise the review action and retain a comment | Change only the writer-chosen comment state; retain source and revision references. | Rewrite a scene, update locked canon, publish, or silently imply a stale result covers new material. |

Have an independent reviewer assess correctness against the contract, especially the Amber/Blue distinction, source authority, and unsupported claims. For usefulness, ask a writer to review a comparable passage manually and with the proposed assistance, recording time, necessary corrections, false alarms, missed conflicts, and whether the observations help them choose a revision. Do not score success by agreement on one emotional reading or by the number of suggestions produced. A small trial supports only a bounded decision; it does not prove improved discovery or general editorial quality. [Guidance: “Test transfer and regression, not agreement”; “Verify that the method was applied.”]

**Decision now:** Proceed with a narrowly scoped, source-linked review design and confirm the available review mechanism. Preserve Amber’s canon conflict, Blue’s valid staging, optional emotional readings, and sender-disclosure intent as four different kinds of conclusion throughout the flow.
