# Independent Purple receipt — Tesbo PR167 native governance

**Reviewer:** `/root/purple_native_visual_review`, an independently delegated reviewer, not a simulated team perspective.
**Review cutoff:** 2026-11-20 02:25 UTC; supplied immutable source and downloaded CI artifacts only.
**Disposition:** bounded built-surface review completed. The inspected captures support the specific observations below. Complete visual and journey acceptance of the native-governance integration remains **BLOCKED / unverified** by the named evidence gaps. This is not a release verdict or an adoption of the unratified Purple package.

## 1. Authority, independence and application binding

The unchanged method is NesberryEnterprise/Nesberry at `d83549c85a4dcd047fb40dc4fba4ec62737ab0fc`, supplied under `/workspace/scratch/fb086055b433/assurance-method-inputs/`. I read the Purple agent, the mandate and applicable charter sections, the runbook, the resource registry, orchestration portability/live-safety rules, and the whole-page, evidence and portability policies. The applicable split is the agent's own: truthful whole-context evidence under `PUR-SLOP-019`/`PUR-PLACE-011`; page purpose and placement (§5/§6) **ADVISORY**; `PUR-GATE-001`, `ART-*` packages, `PUR-FC-*` ledgers and operational adoption **NOT RUN**. Charter §1.4 explicitly limits the draft package. The older runbook's operational preflight does not ratify it.

The target is Tesbo's browser application, specifically the native KB save/review/restore, Zyra staged review and operation feedback, project MCP diagnostics, native execution/Bug continuity, and Model Studio recovery evidence supplied for PR167. The governing user question is: **what is proposed, actually saved, refused, uncertain or merely observed, and what can I safely do next without losing work or repeating an unknown write?**

The primary application contract is the existing eight-file v1.4.28 package in `/workspace/scratch/fb086055b433/tesbo-canonical-inputs/extracted-v1.4.28/`. The reviewed provisions are principally `00_README.md` P-01/P-07/P-08/P-12/P-13/P-17/P-18, `02_WORKFLOW_AND_UX_SPEC.md` ASER-UX01–03 (lines 668–722), and `07_UI_DESIGN_TASKS.md` D-01/D-03–09 and its v1.4.28 allocation. The package remains NOT FROZEN; its historical no-runtime statements are not silently rewritten as present-tense claims about PR167.

The sibling `tesbo-canonical-inputs/creating a testing tool to make my job easier/Tesbo_Existing_Application_Baseline_v1.0.md` was consulted as historical fieldwork and approved-design context. Its October captures, unknown production SHA and two approved proposed case-editor images are not the November CI baseline. Their original image assets were not supplied here; I did not claim to inspect them.

Application-specific binding preserves Tesbo's existing sidebar/header, document editor/history modal, Zyra conversations/review panel, API & MCP settings, native Runs and Bug surfaces. It does not require Nesberry's storefront shell, marketplace parties, footer, administrative counterpart, or breakpoints. Tesbo's relevant supplied acceptance asks for its real app baseline, keyboard/focus/status checks, long content, narrower layouts, 320 CSS-pixel reflow and 200% text zoom (`02` line 722; `07` D-09). These are separate from a requirement to recreate Nesberry.

The actors visible in this evidence are disposable CI first-admin/owner fixtures, the E2E KB owner, and the E2E Zyra QA Engineer (plus the source-binding owner test). Authenticated reviewer and machine permissions are separate; a screenshot of an owner does not prove every configured role. The native service owns persistence and the exact review receipt; Purple assesses comprehension and placement and does not clear the Blue/Security/QA gates.

I made no product edits, started no service/database/browser, issued no external communication and performed no deployed action. I inspected source and actual PNG bytes with `view_image`, decoded only selected report fields, and computed hashes. Tests were executed by the supplied isolated CI runs, **not rerun by this reviewer**. The parent supplied the scope, evidence locations, result summaries and existence of planned follow-ups. I did not inspect the moving worktree, consume other reviewers' conclusions as my verdict, or count any uncommitted follow-up as passed. This is independent review of supplied evidence, not a claim of blind discovery of every tested failure mechanism.

## 2. Source, merge build and artifact provenance

| Evidence slice | Source revision | Actual tested PR merge build | CI result relevant to this review |
|---|---|---|---|
| Immutable baseline checkout `tesbo-review-baseline` | `288c89b36dd5e748621752a175f1f4bdaac7ec87` | `6a0c1db7dcf5fcfc08a1ba808a84f7c9d0f3daad` | Primary smoke: 19 total, 10 expected, 9 unexpected, no flaky/skipped. Baseline failures remain failures. |
| Immutable follow-up checkout `tesbo-review-3ebda243` | `3ebda24300d55a6d3e2141b9d64aecde23e7d4c4` | `c181e36ccdbf43237efbb1a9e9ae8dff98478c34` | Primary smoke: 19/19 expected. Zyra: 21/21 expected. The same artifact also contains a notifications report with 46 expected / 6 unexpected; this receipt does not call the whole run green. |
| Additional downloaded CI evidence, not a moving source checkout review | `cce4516c679a671b5c2ce30bc43afe99292079f1`, identified by embedded merge subject | `207f7cbba15928e33a5997a0c10bd819056a7932` | Model Studio: 17/17 expected (9 API, 8 UI), **zero image attachments**. KB: 28 expected / 1 unexpected. Notifications: 52/52 expected on this later build only. |

Run URLs from embedded CI metadata:

- Baseline: https://github.com/1alextest/Tesbooboo/actions/runs/44641518877
- `3ebda243`: https://github.com/1alextest/Tesbooboo/actions/runs/44654648304
- `cce4516c`: https://github.com/1alextest/Tesbooboo/actions/runs/44656690980

The report merge subjects explicitly identify each source SHA merged into `6897f989b055a955280f810c7daace86f74057fa`. The baseline report's `ci.prBaseHash` instead contains `4fc36724566e12829f52080c8bc27cfbc65663eb`; both values are preserved as metadata, not reconciled by guessing. The screenshots are observations of the named CI merge builds, not direct observation of source-only checkouts or production deployment.

The downloaded ZIP hashes were recomputed and match the supplied values:

| Exact path relative to `/workspace/scratch/fb086055b433/` | SHA-256 |
|---|---|
| `tesbo-ci-evidence/288c89b/ci-smoke-evidence.zip` | `92ba3d0aa75a4e1e8a16adc749382961d117cd6bbf04df9c654a618c8865b338` |
| `tesbo-ci-evidence/3ebda243/ci-smoke-evidence.zip` | `be90a1ac8a59be71757350072068de787a222293384d142d042bd63890460e59` |
| `tesbo-ci-evidence/cce4516c/ci-smoke-evidence.zip` | `a3c5b4960ab254406fef697b330c1944402c77f88cc59f43987de000e68c965c` |

`assurance-working/visual-evidence-index.json` was used as a locator, then checked against actual files/report associations. Its SHA-256 is `351ea60ee49186dfa8bd3d572686aa6c3df00d1bbc7b46352fe0030b7a3d2591`. It covers the primary baseline/follow-up reports, not every report. This review additionally inspected five images from the `3ebda243` Zyra report and three KB failure attachments from `cce4516c`. Appendix A identifies **all 37 PNGs actually inspected**; unlisted PNGs are not implicitly reviewed.

## 3. Capture semantics and whole-context checks

These are built-surface captures, not a proposed Now/With mockup. I therefore do not apply the Nesberry mockup scripts to Tesbo PNGs or issue a mockup-delta PASS. The mechanical commands `check-mockup-delta.mjs` and `check-mockup-fidelity.mjs` were **NOT RUN**: no applicable target mockup/adapter was supplied. Missing source references `.kiro/steering/ux-ui-sanity.md` and `shared-vocabulary.md` were not supplied in the method subset and are not claimed as separately loaded. The supplied active policies, agent and Tesbo canonical UI contract establish the bounded review obligations used here.

Capture mode was checked in pinned test source, not inferred from dimensions:

- KB save/restore and primary execution/Bug images use default `page.screenshot()` (`e2e/utils/ci-document-writes.ts:85`, `e2e/ci-smoke.spec.ts:593,734` at `3ebda243`). They preserve the visible host viewport; comments, form footer and lower fields can remain below the visible scroll position.
- Zyra review-close and suite/move captures use `page.screenshot({ fullPage: true })`. The full browser document is captured; the fixed-height conversation still has an internal scroll position. Expanded trace and result summary screenshots show different portions of it. A 1280×720 PNG is not, by itself, evidence of a cropped capture.
- The two outer MCP captures use default page screenshots; three lifecycle images use `card().screenshot()` (`e2e/utils/ci-mcp-diagnostic-lifecycle.ts:15`). Those three are explicitly component crops, useful as state detail but insufficient alone for page orientation.
- The ephemeral inspector's desktop and 390×844 mobile images use `fullPage: true`; graph images use the scroll-region screenshot, and the source-binding pending-save image uses the settings element screenshot (`e2e/ui/zyra.spec.ts:132–143,185–200,437`). Those element captures are not whole-page evidence.

| Whole-context obligation, rebound to this task | Disposition | Evidence and limits |
|---|---|---|
| 1a. Real host shell around reviewed states | **PASS, bounded** | B/K/Z/R groups and P01/P02 are real CI captures with Tesbo navigation/header or their genuine overlay. I inspected these actual images. This establishes their visible context, not hidden scroll content. |
| 1b. Every material screen fully reviewable | **BLOCKED** | M03–M05, P03–P05 are component crops; several page captures are scrolled viewports. They supplement, but cannot certify, full page/journey coverage. No invented replacement image was used. |
| 2. Authentic deployed “Now” | **BLOCKED** | Known CI builds exist; a matching deployed production build and capture were not supplied or observed. No production parity claim is made. |
| 3. Declared changes and preservation of unchanged regions | **BLOCKED for comprehensive parity** | B01/B02 are real baseline witnesses; K/Z follow-ups are real later witnesses. Different fixture dates/data and limited states preclude a complete before/after region comparison. No machine delta was run. |
| 4. Every material step, actor and branch | **BLOCKED for complete integration acceptance** | Named tests demonstrate bounded interactions, including injected failures; the PNGs are checkpoints, not a full visual traversal of every native-governance path or role. Model recovery has no images at this cutoff. |
| 5. Visible entry, list and return path | **PASS for visible controls; BLOCKED for complete return-state proof** | Document Back to Knowledge base, Zyra conversation list/Task board/Change review, native Run breadcrumb, and API & MCP settings context are visible. Some tests begin with direct `page.goto`; screenshots do not prove all discovery, filter/scroll, comment and focus restoration paths. |
| 6. Applicable widths, sample continuity and fold | **BLOCKED beyond the named samples** | Desktop 1280×720 light-theme evidence and a 390×844 light-theme ephemeral preview are inspected. This is not KB/MCP/Model recovery mobile coverage, 320px reflow, 200% zoom, dark-theme or full AT verification. The mobile inspector has the intentionally collapsed 60px sidebar; its test measures local containment. |
| 7. Evidence as delivered and corresponding authority surfaces | **PASS for inspected file integrity; BLOCKED for unobserved role surfaces** | ZIP/PNG digests and report associations are recorded. No separate Tesbo admin screen is manufactured as a requirement. Owner/QA fixtures do not establish the full configured human/machine capability matrix. |

**KEEP/EXTEND disposition, source-inspected only:** retain Tesbo's host shell and existing native destinations; extend document queue/history feedback, staged review feedback, project-scoped MCP diagnostics, and native result/Bug linkage in their current owners. The evidence shows these existing owners in use. It does not establish an approved visual redesign, complete unchanged-region parity, or implementation of the entire v1.4.28 platform.

## 4. Actual visual observations and task continuity

### KB work preservation, restore and review

K01 shows the real history confirmation waiting with disabled controls and “Restoring…”. K02 shows the restored document title/body and Saved status. K03 shows newer typed content while Saving… remains visible. These are distinguishable outcomes rather than a generic success screen.

K04 makes an uncertain write explicit: the restore action may already have been applied and the user should refresh before trying again. K05 visibly retains “Local draft retained through conflict”, marks Unsaved changes, and tells the user to copy the draft before reloading to compare with the saved document. This is better scoped than B01's baseline “Reload and review” instruction. The image proves the draft is present at that instant; the associated passing smoke scenario and its readback assertions are the separate persistence evidence, not something the pixels establish.

K06 names the Notion mirror/read-only reason and suggests adding a comment. K07 shows the control document reached after the queued-navigation scenario. It does not, by itself, prove the departed document's bytes survived; that claim belongs to the test's readback. `e2e/utils/ci-document-writes.ts:211–292,298–326` records the relevant native/intercepted requests and assertions. The test uses arranged document rows and controlled response delivery; it is not proof that every ordinary actor can create each prerequisite through the UI.

C01, from the later KB failing retry, visibly shows Approved memory, Saved, and the edited body. The report still says **unexpected**: both attempts time out waiting to click `View history` at `e2e/ui/knowledge-base.spec.ts:2093`. This is a history-navigation test failure after the exact-byte assertions, not evidence that the visible approval itself failed or that history was successfully inspected. C02 and C03 are attachments associated with the first failure result but visually show a Trash restore and another ordinary document; they cannot be repurposed as proof of the dirty-memory approval step. I preserve that association/context mismatch rather than reading success from the attachment count.

### Zyra saved, refused, closed and proposed states

B02 is the earlier failing visual witness: prior-save information is present but the expected refusal feedback is not shown. Z01/Z03 visibly retain the one saved case summary alongside a red refusal message and the remaining proposal. Z02/Z04 then state that the batch closed without **additional** saved cases and retain the inspection disclosure. The locale-specific closure text is materially more accurate than an unconditional saved-all claim.

The refusal text “E2E close refused” is an explicit injected 503 (`e2e/utils/zyra-review-feedback.ts:61–76`), not a claim about production error wording or a natural server failure. The later close uses the genuine Nest endpoint with before/after task and repository assertions. Real rendering of an injected failure is correctly labelled fault-injection evidence.

Z05/Z06/Z07 expose suite errors and a failed operation in the expanded activity trace. Z08 shows a review-only move proposal; Z09/Z10 show unavailable destination feedback and staged work. These screens preserve the host conversation/list context, but the conversation's internal scrolling means a single image does not show its complete summary, trace and review controls together. Expanded details make the operation visible; raw model prose remains a separate concern below.

### MCP diagnosis and project context

M01 shows the OpenCode configuration instructions with a token placeholder/environment reference, not an exposed credential. M02 distinguishes a browser-verification failure and suggests API URL, network/CORS, redirect and token checks. M03 shows a ten-second timeout with an empty input. M04 reports the verified project/read scope and explicitly says write permissions/reporting were not tested. M05 shows another project endpoint with cleared input and without the previous project's success text. These are useful state distinctions.

The scoped successful read, timeout and navigation cancellation are browser-rendered test evidence; they do not prove a real OpenCode/ChatGPT client connected, wrote a report, or executed a target browser task. The three cropped cards do not show the project selector/navigation context, so their scope evidence is the visible endpoint plus test association, not an inferred full-page user journey.

### Native execution and Bug relationship

R01 displays an uncertain Bug-create response with the entered title retained and a warning against blind retry. The modal's lower actions are outside the captured scroll region; their reachability and focus are not visually certified. R02–R05 preserve Passed/Failed labels on the native execution after linking a Bug. Test source performs native readback and repeat-close comparison before capture (`e2e/ci-smoke.spec.ts:660–735`). The title `full-page-pass` identifies the execution route rather than a `fullPage` screenshot option. These images do not prove all immutable-attempt history or evidence availability behavior.

### Ephemeral preview and source binding, separate from persisted Model Studio

P01 visibly labels the draft as unapproved, source unverified and runtime evidence absent; structural reachability is not presented as execution. P02 shows its narrow, collapsed-sidebar layout and the table/diagnostic portion, not all editor and action regions at once. P03/P04 are graph-region detail crops with an unreachable node; the test intentionally enables actual-size scrolling on mobile. Clipping in that deliberate scroll region is not, on its own, a product overflow defect. The source test checks keyboard selection, focus, native table data, local containment and absence of writes (`e2e/ui/zyra.spec.ts:105–202`); this is bounded keyboard evidence, not a screen-reader audit.

P05 shows submitted source-binding fields during a pending save. Its passing test holds the genuine 400 refusal response, checks one request, then verifies the fields become editable and retained (`e2e/ui/zyra.spec.ts:398–452`). Only the pending state was captured. I did not visually inspect the later refusal or successful recovery state.

These five images concern the ephemeral Zyra preview/source binding. They must not be substituted for persisted Model Studio's run-recovery UI. The later Model Studio report has no image attachments despite 17 passing tests.

## 5. Advisory findings and routed contradictions

| ID | Rule basis and severity | Exact observation | Consequence, correction and owner |
|---|---|---|---|
| PUR-NATIVE-01 | **ADVISORY P2**, `PUR-PURPOSE-002`, `PUR-PLACE-003`/`006`; Tesbo P-08 and ASER-UX03 | Z08 says the proposed changes have not been applied, then the same assistant answer says “Moved the requested test cases.” Z05/Z09 similarly display a suite-error warning followed by completed-action prose. At `3ebda243`, `legacy.service.ts:25224–25254` prepends factual warnings but retains `decision.reply`. The fixture deliberately supplies that misleading prose. | The warning is useful and materially mitigates the claim, but the answer still asks the reader to reconcile incompatible operational statements. Keep the authoritative applied/pending/refused summary visually distinct and label the retained model response as unverified original wording, or render a factual result summary while preserving the original in details. Do not silently alter original evidence. Engineering/Content owns presentation; Blue/Red assess the operation-result contract. Recheck both locales, partial success and all-refused cases. This is not a claim that the pictured moves actually committed. |
| PUR-NATIVE-02 | **ADVISORY P2**, `PUR-PLACE-004`, `PUR-PURPOSE-001`; ASER-UX03 | K04 says refresh before trying again and K06 says the body cannot be edited, yet the confirmation still presents an enabled-looking Restore button. Source confirms it is disabled only while `restorePhase === "restoring"` (`knowledge-base/documents/[documentId]/page.tsx:695–705`). | The suggested next action and emphasized control diverge. Offer a clearly named authoritative read/recovery step or keep the refused action unavailable until its prerequisite changes, while retaining Cancel and the draft. Do not infer duplicate persistence from this finding: the queue/server guards are separately tested. Engineering owns the UI decision; QA checks no replay and retained work. |
| PUR-NATIVE-03 | **Evidence gap, not a newly established product defect**; same-revision evidence policy and Tesbo ASER-UX03 | cce KB KBU-65 remains failed at the history-entry click; C01 shows approval but no opened history. Model Studio's cce report passes 17 tests but contains no screenshot attachments. | Preserve the test failure and the missing visual inspection. QA owns a corrected exact-revision rerun of the actual history entry; Purple needs the resulting genuine history and Model recovery captures. Neither a passing neighboring test nor an approved badge clears these obligations. |

**Side observations, not redesigned or elevated into new release blockers:** the RU screenshots retain some English shared controls (“Change review”, inspection disclosure and the deliberately injected error). Several direct-navigation screenshots also leave Project home visually selected while showing a document or Zyra. These are observed locale/orientation inconsistencies; this packet does not establish their supported-scope requirements, origin or user impact well enough to call them new PR167 failures. Route them to the existing UI/localization owner if that surface is in the declared delta.

## 6. Unverified coverage and next bounded obligations

1. **Persisted Model recovery visuals:** obtain the promised actual captures on an identified new source/merge build, then inspect (a) lost-response uncertainty after reload with the form retained, (b) failed readback without a false empty/success state, (c) successful identification of the existing native run, and (d) confirmed rejection preserving editable inputs/no created run. A planned attachment or uncommitted test edit is not evidence. Keep cce's 17-pass result at its own revision.
2. **KB history completion:** rerun the correct visible menu entry on the revised build and capture the exact reviewed history after the dirty save/approval. Keep the existing failed attempts. Confirm draft/receipt preservation separately from whether a selector can click the menu.
3. **Whole-context supplements:** where a crop is used for a material decision, pair it with the host page and entry/return context. Capture scroll-dependent actions and error/recovery states when those are the acceptance claim. Do not require a new mockup or a second design source.
4. **Remaining target-specific UI acceptance:** no complete evidence has been inspected here for 320px reflow, 200% text zoom, dark theme, screen-reader announcements, touch, all role-safe denied/revoked states, or all queue/filter/comment/focus returns across these changed native surfaces. P02 and the keyboard assertions credit only their named ephemeral-preview slice. These are outstanding scope-specific evidence items, not fabricated failing tests.
5. **Broader workflow boundary:** the original ChatGPT → Tesbo MCP → assigned executor → genuine target testing → original report → human-selected native publication round trip, skills governance, release decisions and post-deployment verification are not established by this screenshot set. This receipt does not turn the whole eight-file specification into an acceptance checklist supposedly executed by PR167.

**Final bounded conclusion:** the actual captured recovery states are reviewable and materially useful, with the two advisory presentation findings above. No full Purple whole-journey visual PASS, production parity, Model recovery visual sign-off, or overall release approval is issued. This completed receipt can be cited by other reviewers for the exact observations, image hashes and limits it records; later evidence needs a clearly identified addendum at its own revision.

## Appendix A — inspected PNG inventory

Every entry below was opened with `view_image`; every SHA-256 was recomputed. Paths are exact relative paths under `/workspace/scratch/fb086055b433/`. Dimensions describe files, not assumed capture semantics. Source/build binding is the table in §2. Images are original CI evidence; no reconstruction, retouching or generated replacement was used.

### 288c89b — playwright-report-ci

Exact data directory: `tesbo-ci-evidence/288c89b/home/runner/work/Tesbooboo/Tesbooboo/e2e/playwright-report-ci/data/`.

| ID | Actual inspected state/name | File in this exact data directory | Dimensions | SHA-256 |
|---|---|---|---|---|
| B01 | baseline KB uncertain-save failure | `d06ee1c8b49bfcadb9a8be96cca9c69e131ccd05.png` | 1280×720 | `83818484583fc31743d607ff964cc805a253f525f38ae46d15bef28c524e8bc4` |
| B02 | baseline Zyra partial-save failure | `0cc12c4b3b43521ad2ec897d21b56e3db5637757.png` | 1280×720 | `d844b3dec1fc37b5bec46832a68355409ff980559fa850eb72e956ef716a1212` |

### 3ebda243 — playwright-report-ci

Exact data directory: `tesbo-ci-evidence/3ebda243/home/runner/work/Tesbooboo/Tesbooboo/e2e/playwright-report-ci/data/`.

| ID | Actual inspected state/name | File in this exact data directory | Dimensions | SHA-256 |
|---|---|---|---|---|
| K01 | document-save-restore-delivery-barrier | `c36d8d5eec74381f257e9bb1fb0ff1fafa2a0509.png` | 1280×720 | `8b7370022fede4729240a163ebcecce04919e247b08ecb3447229094a3de0ce1` |
| K02 | document-restored-without-second-autosave | `781efc1ac0a42b818eb38cbb545c7303015daaee.png` | 1280×720 | `c009459f10bf79c33464351e3515b80aed77ef979697f530b12aa372d2716c64` |
| K03 | document-newer-draft-awaiting-own-ack | `743193b7bd80b14151a9b36de974c5bc8f6b4420.png` | 1280×720 | `b1af51054055e6358892e173535f61abcd771ea8b5980c2610269b0773f8f0b6` |
| K04 | document-uncertain-save-blocks-queued-restore | `a4f96fa1ef23e5bcb277829eaeb5b9d89aece916.png` | 1280×720 | `d3c98101386524c85dc237e7fcf4bcd24395c161f8970f6ca59c2033b7da868a` |
| K05 | document-uncertain-save-conflict-preserves-both-versions | `962e0b538565b532dac73483c81d9b7330200b39.png` | 1280×720 | `cd9baa20c625db1825ded129ecb4a03d4829b2acc1145516e0e121170cb6c0bc` |
| K06 | document-read-only-restore-refusal | `ea4f25fc0baa0a00294d37cb4043f78c6b262fbf.png` | 1280×720 | `29e7ea49fb329414df900a276094f264fa5f3d7daec469e3ca42112c78437f2a` |
| K07 | document-queued-navigation-preserved | `7f76463e3c1a28349e488dd9200fed0c5555bd56.png` | 1280×720 | `60d31baa036a37a3576a5feca1206102050666ab58731f9da21f6f83880a24dc` |
| Z01 | zyra-en-partial-save-refused | `5cb43065f5bbdbc2c3448199e9cdd12cf5b41f0f.png` | 1280×720 | `3dabc947ed53dba8543831187970b1f02ac9522f1aa06a524e9c1c51a84ac00a` |
| Z02 | zyra-en-partial-save-closed | `4fcbe6c8fc2df712baa1fab7b1ee32f65f194721.png` | 1280×720 | `1e533d9fc01dfbee38a921c29f00ba8c8476ca3bbe44d6c6cfb7c26a2076707d` |
| Z03 | zyra-ru-partial-save-refused | `8b7321b5b5c21aac7d5f188ff42cd1f9a06ac4ab.png` | 1280×720 | `3a193b3e4714f4cdc16542273bc7b1973edefee1121c96e4ff8d926af9b508bc` |
| Z04 | zyra-ru-partial-save-closed | `8bd4804696a4515e3ce0ef04d835e0199ef8bf7e.png` | 1280×720 | `9d1081f4f12b997114b7f4b22c2804e8ce2c25500404507121c3a45c6a682d95` |
| Z05 | suite-en-partial | `616b2c91bade4e75884f7d9a96fc75fd357f8ec2.png` | 1280×720 | `6a1da5bb006eaba1034be5ff139f95a9c888acc3d35c2109da6b80175250931c` |
| Z06 | suite-en-partial-expanded | `3646cff0978853cf5806372e115c1a0640987226.png` | 1280×720 | `e928d7c3e1c9455b4e7fb4abade4942ebd2989ee48d0c87ffa1017f0961b968f` |
| Z07 | suite-ru-partial-expanded | `d5779eaf8e33eaf1133ad4311a578ccddcb988a5.png` | 1280×720 | `048cf3213deb52aca58c7acf0bf05d1cff77a93f04a4855c22f6b36f7e20a78e` |
| Z08 | move-en-partial-review | `c3fac87973b6a068fc9f237eed4346c0693fea60.png` | 1280×720 | `7f0f5d69e59b56da9d46dd88302543ca0be6f6b32836b0733878a6966eee8a2c` |
| Z09 | destination-en-partial-review | `3967958d8c50813a12cd10218b42b956d6d1896e.png` | 1280×720 | `647091ae1d7bf1219b6f024f7a6f11b1015ce5d8d32bcabca4eb490d059f6ba0` |
| Z10 | destination-ru-partial-review-expanded | `143ad0781d0e9f22f30e221043138bc430237575.png` | 1280×720 | `753eb8a0cda3784ca5f63a5e4de27232a3f757495024cc269c046e4091cb6bca` |
| M01 | mcp-browser-read-check-and-opencode-config | `616648ba7f9b74f0f7dbb9b7ca6eb937e02e7316.png` | 1280×720 | `5ccd40dacdb21d0b0123651382ba3f3e0af35c2e0a65901c81c84803190dba17` |
| M02 | mcp-browser-diagnostic-failure-with-token-cleared | `c2fc330affea2feca061968716b38b3e4cebf299.png` | 1280×720 | `1845a432556015982212022c08a6c0febd539209e5890573d083e81ee07926a5` |
| M03 | mcp-browser-project-read-timeout-with-cleared-input | `d9117f4cac2f882da64908a6abe278c8e1575ddc.png` | 956×243 | `f6c8cbc942bc5977e75f9048311f60077fc9c7a902ce93ce1626ed9e6b66f73d` |
| M04 | mcp-browser-verified-read-status-after-timeout-recovery | `959ad7bc3fbec184f0949593787130c61d070e4e.png` | 956×263 | `b73f2fe7966df89d2ba40ce954e639059a073307ac714e2a589c38b4d77cc457` |
| M05 | mcp-browser-other-project-after-client-navigation-cancellation | `b03c4c5ee502ea71275aac51a46d383815646db1.png` | 956×211 | `f2acd0056184893aced7201ccea5aa83241289b81576ca970e853727114def14` |
| R01 | lost-create-acknowledgement | `b30f093c06edf5e15cca43cd1fd760549aeaf52c.png` | 1280×720 | `f57a775d403a02a383908f6fe2d3dea91351c2217d90b350db51f6b12c3e0fd5` |
| R02 | drawer-pass | `43a8c38020eae894bca2606416feb364157199ea.png` | 1280×720 | `589506163019791aeacd2e0f0151c06095331b5671b1dcb77c6573999beb3f42` |
| R03 | drawer-fail | `fa6508d4ef7355b9b0bd077fe9620665bba2be42.png` | 1280×720 | `8e43fe7878dff6518dd4b984c5ffb17b862b93f243052df4d1bf025db21518a8` |
| R04 | full-page-pass | `df17ebac72d5f0abdd594c5caa9aba8b725c18e0.png` | 1280×720 | `e3e51809bd580f40a6d88e2d6584d8840278f95247ba1e9f38e89459e0de95e2` |
| R05 | full-page-fail | `7f4771fdb01d86c8d570a2b177227292adb7c8f9.png` | 1280×720 | `e72968d6dc958a7ed2abe2edbed1ec4f55b665870b7988204610503c0bb1c122` |

### 3ebda243 — playwright-report-zyra

Exact data directory: `tesbo-ci-evidence/3ebda243/home/runner/work/Tesbooboo/Tesbooboo/e2e/playwright-report-zyra/data/`.

| ID | Actual inspected state/name | File in this exact data directory | Dimensions | SHA-256 |
|---|---|---|---|---|
| P01 | model-preview-desktop | `644c74e4fa5d43ee74c13584bddecbb289fe5d0e.png` | 1280×720 | `f62573cf52cc6642c4b70b2201b55d2e6c12095f491190c8706d312e72fc4666` |
| P02 | model-preview-mobile | `929955cce722eaa071b2f95ab23d2ebc8e351044.png` | 390×844 | `a40c0621962ecdc9bd30774b3f044b7c6d8c5d95ce6b9fa2348f9ca181fb0767` |
| P03 | draft-graph-desktop | `f11be059354980a6dc2948ff8cba6f9bac4be306.png` | 856×363 | `2ce3a880f95cd9af78010e5fe617d39e67cef858ff4bcca567c958eecda57ca0` |
| P04 | draft-graph-mobile | `beb3581ce72780d51098ec680f6441bf0d3bc76b.png` | 182×385 | `904ea0989ac5fcaff418aaff4fdf7ad82dbda9996a87c2267c43ee56009fe10b` |
| P05 | source-binding-pending-save | `1d718ff319b2df769c662433514e5d7e0752663c.png` | 916×530 | `a3fc2fb15a3b42ab38e59bbc6c2e737a75f9e484cb472e2852b2bf8400aa0e8a` |

### cce4516c — playwright-report-kb

Exact data directory: `tesbo-ci-evidence/cce4516c/home/runner/work/Tesbooboo/Tesbooboo/e2e/playwright-report-kb/data/`.

| ID | Actual inspected state/name | File in this exact data directory | Dimensions | SHA-256 |
|---|---|---|---|---|
| C01 | KBU-65 retry failure, approved-memory visible | `1a14f64388974c1354153857051b411e42dc699f.png` | 1280×720 | `1249bf58931be7cbdfbbe1760dace9fb43080dc2cc755595f9d915e7356c0890` |
| C02 | KBU-65 first-result attachment, Trash restore visible | `c964947c1ebab27c81a9a3befa034bbea65928e7.png` | 1280×720 | `95b59e69506fdfcad27724a97e84526d629fa466e5a77a5b4a5092b094e59526` |
| C03 | KBU-65 first-result attachment, other document visible | `ca4649f2e31162864f890792b83510c8a39d0b5f.png` | 1280×720 | `7d1391521115be773b0a41cf0cbb221ba068753892bafed7262744b228ebf88c` |


## Appendix B — method input integrity

The supplied supplemental and indirect manifests' Git blob hashes were verified against local bytes. This validates the manifest/file relationship, not an independently fetched remote checkout. Original method documents remain unchanged.

All paths below are relative to the exact method directory in §1.

| Method input | SHA-256 |
|---|---|
| `.claude/agents/purple-team.md` | `9cd28ab82a771de754432b0e40a0e6319da54e6f2ba4c63fd2c2e3580792aeae` |
| `.kiro/steering/teams/review-orchestration.md` | `023a64168c5160a761b91e7496b8a35b89246baf7eda0ab62bac17a7fa44771e` |
| `docs/reviews/NESBERRY-PURPLE-TEAM-DESIGN-ASSURANCE.md` | `4b5cf3379fe058f0826a360556759ae7a6b7bd9f4051e9d79d519cc383f7bc73` |
| `docs/reviews/NESBERRY-PURPLE-TEAM-REVIEW-RUNBOOK.md` | `b16294368e861d0dd029bf46e2e6a202b8582afaf0a878138df3fa42c2a02325` |
| `docs/reviews/NESBERRY-PURPLE-TEAM-RESOURCE-REGISTRY.md` | `8be36e60db11eea0303e7de1b7ebe87f719e787f27e2761b053a82df9c7b5757` |
| `docs/policies/governance/POL-GOVERNANCE-ASSURANCE-PORTABILITY/v001.md` | `33c69cba82f7d98773e85a30fa1afff15cc0dbcec0d88302a0295ce06e2c8524` |
| `docs/policies/governance/POL-GOVERNANCE-MOCKUP-WHOLE-PAGE-JOURNEY/v001.md` | `bf778904da7ee598324d60486cedbf49211df4091bd3c04955504e09ad0479d4` |
| `docs/policies/governance/POL-GOVERNANCE-ASSURANCE-EVIDENCE/v001.md` | `a6176c0c75342dfa6cbf66cf64e00b9a2940a47655f343e255b96f4fa58c5d52` |
