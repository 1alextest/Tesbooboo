# Planning recommendations


These recommendations use only the supplied guidance and the two synthetic briefs. The briefs are the target contracts. The assessments below are conceptual comparisons against those contracts; no repository, implementation, PDF output, human reader, or live product has been inspected or tested. Proposed checks describe evidence to collect when implementing the additions.

## 1. Recommendation to the rehearsal application owner

### Proposed outcome and scope

Add a cover-generation step to the existing job screen and use the existing packet assembler to prepend that page to each approved part. Reuse the single-page text renderer from the setlist capability, provided its reusable rendering operation can accept the three supplied cover values without adding setlist-specific material. The completed packet remains a previewable, downloadable PDF that the coordinator prints separately.

The coordinator's authority covers assembly and cover revision. The approved score remains protected throughout this operation. For a source containing N pages, the output has exactly N + 1 pages: one cover followed by source pages 1 through N. Preserve each score page's media box, crop box, rotation, fonts, content, geometry, and order. Preserve the original source PDF bytes and its availability. The cover can have its own layout; its layout must not cause score pages to be resized or rearranged.

The failure mechanism to guard against is a composition operation applying its own presentation choices to protected input. A packet can have the correct title, page count, and order while still violating the score contract. The governing question is: **After adding the authorized material, can we demonstrate that every protected page and the retained source still satisfy their original requirements?** The approved PDF and the explicit contract supply the oracle; the assembler's current behavior does not define correctness.

### Coordinator flow

1. Select the approved instrumental part. Show its recorded identity and approved title so the coordinator can confirm the intended source.
2. Populate the cover's part title from the project record. Collect the ensemble name and rehearsal date as explicit text values. Preserve the supplied characters, spelling, abbreviations, and date text; do not infer a date or generate additional cover prose.
3. Validate that all three required values are present. Identify a missing value and let the coordinator supply it. That packet cannot be completed while a required value is missing. An unusual but supplied date string is not permission to rewrite it.
4. Render exactly one cover page containing the supplied values. Prepend it through the existing page-copying assembler, retaining every source page and its properties.
5. Check the packet against the contract, then display the existing completed-PDF preview. Let the coordinator revise cover inputs and regenerate the packet using the same approved source.
6. Save the job manifest and make the completed PDF available for download. The coordinator continues to choose printing settings outside the application.

If assembly produces a page-property mismatch or an incorrect page sequence, report the discrepancy and withhold successful packet completion. Recovery is to correct cover/assembly behavior and assemble again from the retained source. Altering the approved score to make the output fit would exceed the authority given for this increment.

### Existing capability and necessary change

| Existing capability supplied by the brief | Use in this increment | Necessary additional work |
|---|---|---|
| PDF import with source identity, original bytes, page count, and boxes | Bind the job to the approved part and retain the original | Connect the cover job to that source record and expose enough identity for review |
| Approved titles in the project record | Supply the part-title text | Map that value into the cover without text correction |
| Single-page PDF rendering from explicit text fields | Generate the cover | Add a cover layout with the three required fields; reuse the rendering capability where suitable |
| Page-preserving copying and prepending | Assemble the cover and score pages | Compose the existing operations and verify the score portion receives no transformations or additions |
| Job text fields, required-value errors, preview, and manifest saving | Collect input, recover from missing values, review and download results | Add the cover fields and record enough source/output information to assess the new operation |

The manifest should make the chosen source identity, supplied cover text, output page count, and cover/source page sequence reviewable. Extend its existing shape only where those facts cannot already be represented. A new PDF-processing platform, print integration, or shared workflow system is not justified by this limited need.

### Assessment of the supplied examples

| Example | Assessment against the stated contract | Discriminating evidence |
|---|---|---|
| **Manifest Cedar** | Conforms to the supplied PDF requirements, on the facts given | One cover plus all three source pages, exact text, original order, 100% source-content scale, all other source properties preserved, and original source retained |
| **Manifest Birch** | Does not conform | Its 98% source-content scale changes protected score geometry. Matching page boxes, count, order, and text cannot cure that violation |

This is a judgment of the proposed manifests, not an assertion that either PDF has been generated or inspected. Birch illustrates why checking only the four-page sequence and A4 boxes would be inadequate.

A valid alternative design can use a different cover layout or page size while preserving the score portion exactly. Neither a common page size across the packet nor a particular cover design is required. This matters when choosing acceptance checks: enforcing a uniform layout would add a requirement that the owner has not approved.

### Material unresolved question: physical printing

Ask the coordinator: **Will these packets be printed on one side or both sides, and is the first score page appearing on the reverse of the cover acceptable?**

The answer affects the physical packet, not the already-decided PDF sequence. With ordinary duplex printing, PDF page 2—the first score page—would appear on the reverse of the cover; subsequent score pages would occupy different physical sides than they do when printing the source alone. With one-sided printing, the cover occupies its own sheet. Printer options can also affect physical scaling independently of the PDF.

The current increment still produces exactly one cover followed immediately by all source pages. The unknown printing choice does not authorize an inserted blank, automatic scaling, margin changes, or other score modification, and it does not prevent completing a conforming PDF. If the owner later wants the score to start on a separate front side under duplex printing, record that as a proposed change awaiting a revised output contract. Do not quietly introduce a blank page under the current requirements.

### Evidence plan and acceptance checks

Define the checks from the contract before inspecting an implementation:

| Proposed check | Expected result and forbidden effect |
|---|---|
| Replay the Cedar/Birch pair | Accept Cedar on its supplied facts; reject Birch specifically for source scaling. A pass on count and boxes alone must not certify Birch |
| Assemble an approved N-page source and inspect the result | Exactly N + 1 pages; cover first; each original page occurs once, in order; no score overlays or inserted blanks |
| Compare every copied score page to its approved source page | Media/crop boxes, rotation, fonts, content, and geometry remain unchanged; detect added scale or translation operations even when the page boxes match |
| Compare retained source bytes before and after a job and cover revision | Original bytes remain identical and the source remains available |
| Use supplied text with punctuation, abbreviations, and an unusual date representation; omit each required field in turn | Exact text is reproduced when present; each missing field prevents that packet's completion and produces an actionable error; no inferred replacement |
| Use a cover whose layout differs from the score | Accept when the cover is one page and all score requirements are preserved; do not resize the score to match the cover |
| Preview, revise cover values, regenerate, and download | Coordinator sees the revised cover with the same approved score; no automatic printing occurs |

PDF inspection must compare the specified source-page properties and content, with visual comparison as a useful supplement. The assembled document need not be byte-identical to the original document because it contains an additional page and may serialize PDF objects differently. The retained original must remain byte-identical. A missing page-property comparison is an evidence gap, not proof of preservation.

Assess physical printing separately once settings are known. A PDF acceptance result alone cannot certify duplex placement or printer-applied scaling.

## 2. Recommendation to the interactive-fiction workspace owner

### Proposed outcome and scope

Add one writer-invoked review operation for a selected passage. It should produce grounded observations the writer can inspect, edit, and retain through the existing comment mechanism. It should identify literal conflicts with current approved canon, discuss plausible dramatic effects, and identify relevant unresolved intent. Writers retain the revision decision.

The relevant failure mechanism is allowing evidence with different authority or certainty to acquire the same force: an unapproved idea could be treated as canon, a physical contradiction could be excused as interpretation, or an uncertain emotional reading could become a compulsory rewrite. The invariant is that observations preserve the authority and evidential status of their premises. **What in the current approved record makes this a contradiction, what wording supports an interpretation, and what decision or evidence is still missing?** Those questions produce different outputs in this passage.

The feature must leave scenes and locked canon unchanged through review. It does not publish, choose the final scene, approve the brainstorming note, or require one accepted interpretation of a character's motivation.

### Writer flow

1. Select the passage using the existing paragraph identifiers and invoke review.
2. Assemble the selected text and relevant current approved canon, retaining entry identifiers and approval status. For this supplied case, use C17, C18, and C19. Identify the scene revision being reviewed through the existing history capability.
3. Show review observations with the relevant passage quotation and canon reference where applicable. Make the observation's status clear: a literal conflict, an interpretation supported by wording, or an unresolved intent/evidence question.
4. Let the writer inspect linked canon, edit the proposed comments, and save the comments they want through the existing local persistence path.
5. Let the writer make any scene revision through the ordinary editing flow. A subsequent review should use the revised passage and the then-current approved canon. The review itself does not change either record.

Older drafts and the interior-lever brainstorming note may be identified as nonauthoritative context if useful. Their presence cannot override locked canon. If a writer wants an interior lever, that requires a separate explicit owner approval; a scene-review result cannot supply it.

Review observations should identify the passage revision they concern. If the text changes during or after review, the writer should be able to tell which version was assessed instead of treating an old comment as proof about the current text. This can use existing paragraph identities and revision history; it does not require a new canon store.

### Existing capability and necessary change

| Existing capability supplied by the brief | Use in this increment | Necessary additional work |
|---|---|---|
| Passage selection and stable paragraph identifiers | Bound review scope and anchor observations | Add the review invocation and bind each observation to the reviewed text |
| Canon entries with IDs and approval status; linked-canon reading | Ground literal consistency findings in current authority | Supply approved entries to the review operation and retain their references and status in findings |
| Brainstorming notes and older drafts | Provide context when relevant | Preserve their distinct authority; exclude them from the canon oracle |
| Editable comments with quotations and canon references | Present and retain review observations | Populate draft observations for writer inspection and reuse comment editing/saving |
| Revision history and local persistence | Identify what was reviewed and retain accepted comments | Integrate with those existing mechanisms; add no automatic scene/canon mutation |

The new capability is the review operation and its evidence-grounded output. The brief does not establish a need for a particular model, external service, new persistence layer, or a redesigned authoring workflow. Choosing an implementation can follow after its output contract is agreed.

### Concrete review of the two passages

#### Draft Amber: a definite staging conflict

Suggested observation:

> “Mara lifted the release lever from inside the archive” conflicts with C17 and C18. C17 places the sole release lever outside and rules out an inside lever or another way to open the closed door from inside. C18 places Mara inside, Len outside, and prevents anyone changing sides before the door opens. Under the passage's literal-event rules, this action cannot occur as written.

This conclusion does not depend on a reader's interpretation of Mara's motivation. Dreams, magic, metaphorical directions, and unreliable physical narration have explicitly been excluded for this passage. The unapproved idea of adding an interior lever supplies no exception.

Offer Draft Blue's staging as one available correction: Len can operate the outside lever from the side where C18 places Len. The writer may choose that wording or another staging that obeys the same canon. Present it as a suggestion, leave Amber unchanged, and do not revise C17 to accommodate it.

#### Draft Blue: conforms to the supplied staging canon

Len operates the lever from outside, where C17 places it and C18 places Len. The door opens before the continuation describes Mara stepping toward the doorway. There is no supplied conflict with C17 or C18. C19 also fits: Ivo possesses the sealed envelope and then tucks it beneath his coat.

The review should therefore avoid reporting the lever conflict for Blue. Its emotional ambiguity remains an appropriate topic for commentary. A review that flags both drafts because the archive has a constrained exit would fail to distinguish the defective case from its conforming neighbor.

#### Shared continuation: supported possibilities, with limits

| Possible dramatic effect | Wording that supports it | Limit on the inference |
|---|---|---|
| Distrust or guardedness | Mara's “You kept it,” Ivo's concealment of the envelope, and Mara's unanswered pause can suggest tension around retention | The text does not establish that Mara disapproves or that Ivo is deceiving her |
| Self-protection or protective secrecy | Ivo puts the envelope under his coat; “Someone had to” frames keeping it as necessary | Who or what Ivo is protecting, and why, remain unspecified |
| Reluctant responsibility or unresolved concern | “Someone had to” can express an accepted burden; Mara's silence can leave the response unfinished | Silence can sustain several readings and does not establish consent, accusation, or a settled motive |

These are candidate readings derived from the passage, not findings about actual readers. The current text can sustain a less decisive emotional exchange. A writer who wants stronger emphasis can consider changing a line or action, but that preference must remain the writer's choice. No canon rule requires eliminating ambiguity.

C19 concerns the audience's earlier knowledge of the sender. It does not establish that the characters are equally uninformed. Avoid inventing a sender or claiming that Mara and Ivo cannot know one.

### Material unresolved question: audience knowledge by scene end

Ask the owner: **Should the audience learn the sender's identity by the end of this scene?**

The supplied continuation does not explicitly identify the sender. C19 says the audience has not learned it in an earlier scene; that fact creates neither a requirement to reveal it now nor a prohibition on doing so. Keep the scene-end requirement unresolved.

If the owner chooses a reveal, assess whether the completed scene gives the audience sufficient identifying information; the supplied exchange alone does not do that. If the owner chooses continued uncertainty, assess whether the completed scene preserves it while serving the intended dramatic effect. Neither conditional objective should become an acceptance criterion until the decision is made. The unanswered question does not prevent reporting Amber's existing canon conflict or assessing Blue's compliance with the supplied canon.

Because this increment reviews a selected passage, a claim about everything the audience learns by the end of a larger scene would also require that larger scene as evidence. Do not turn an excerpt-level observation into a whole-scene verdict.

### Evidence plan and acceptance checks

Record the expected outcomes before evaluating a review implementation:

| Proposed check | Expected result and forbidden effect |
|---|---|
| Review Amber against C17–C19 | Identify the literal lever conflict, quote the relevant sentence, and cite C17/C18. Do not excuse it through a narrative device excluded by the contract |
| Review Blue against the same records | Report no supplied lever/staging conflict; do not require a canon change or a compulsory rewrite |
| Include the unapproved interior-lever note and an older draft | Preserve the Amber/Blue distinction; neither record acquires canon authority |
| Review the shared continuation | Provide textual support for plausible dramatic readings, make uncertainty visible, and refrain from declaring one motive canonically correct |
| Leave the sender's scene-end objective undecided | Record the open question; do not fail the passage for withholding the identity or invent an identity to satisfy a supposed reveal requirement |
| In a separate test fixture, omit a relevant canon entry or its approval evidence | Name the missing evidence and limit the finding to what can be supported. Do not certify consistency or invent a governing fact |
| Save an observation, reopen the passage, and edit the comment | The accepted comment persists through the existing local mechanism with usable paragraph/canon references and remains editable |
| Compare state before and after review | Scene text and canon records remain unchanged; there is no publication side effect |
| Review a changed passage revision | Observations identify the text actually assessed; stale observations do not certify the new revision |

For the dramatic component, use a small writer/reader review to ask what interpretations they draw and which words support them. Treat their responses as evidence about those readers and that passage, with the sampling limits stated. This can assess whether comments help writers make a choice; it cannot establish a universal emotional reading. The canon pair has a determinate contract-based oracle, while the interpretive exercise appropriately has a different standard.

## Status of the reasoning

The recommendations apply the supplied guidance by tracing concrete differences to their consequences, preserving authority and unresolved decisions, and specifying checks that distinguish failure from a conforming alternative. They do not introduce a new binding methodology rule or claim demonstrated transfer across real products. Proposed UI and implementation choices remain recommendations. The source-page preservation requirements and the supplied locked canon are decided ground; duplex preferences and the sender-reveal objective remain open.
