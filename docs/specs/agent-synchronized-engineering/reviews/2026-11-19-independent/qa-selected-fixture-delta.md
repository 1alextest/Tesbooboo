# Independent QA selected-fixture delta

## Identity, scope, and disposition

- Reviewer: actual separate QA participant `/root/qa_native_final_delta`; not the implementer of this correction.
- Inspection timestamp: 2026-11-20T03:17:23.446761+00:00.
- Method supplied for this review: unchanged Nesberry method `d83549c85a4dcd047fb40dc4fba4ec62737ab0fc` and its QA evidence boundaries.
- Disposition: **the narrow title-reader correction resolves the identified source-level fixture-oracle mismatch; the test bodies and assertions are unchanged. Runtime verification remains outstanding.**
- This is a separate fixture audit and correction receipt. It neither changes the earlier native-integration verdict nor establishes product readiness.

## Exact reviewed inputs

| Input | Identity |
| --- | --- |
| Immutable old source | `9519b56d3441dfec3a107db95ca602665454f407` |
| Old source tree | `31b5e09247237c29ef3d215ab60147c7e4f13ba7` |
| Old file | `/workspace/scratch/fb086055b433/tesbo-review-9519b56d/e2e/ui/zyra.spec.ts` |
| Old file SHA-256 | `94182ce200f4cdf0953a172e7aa37a677dca6fa45d115970e64df88ee2ef4238` |
| Corrected working file | `/workspace/scratch/fb086055b433/Tesbooboo/e2e/ui/zyra.spec.ts` |
| Corrected file SHA-256 | `b21c5122e757665819e537b56fcdddb31b7a171afcaa99e87df5e98c0deaffc0` |
| Main HEAD during inspection | `9519b56d3441dfec3a107db95ca602665454f407`; correction was an uncommitted working-file delta |

The corrected file hash, rather than a future commit or CI run, is the identity covered by this verification. This receipt makes no assertion about other mutable working files.

## Independently identified defect

The prior read-only audit inspected the remaining workflow selections for MCP, Approved-only native run attachments, governed Zyra review, Bug/result separation, requirements coverage, consent, and final native compatibility. It found one concrete sibling fixture-oracle defect in the selected Zyra tests.

At immutable source 9519, `e2e/ui/zyra.spec.ts:1261–1265` read persisted proposal titles using only `d->>'title'`. Its `seedChatReviewBatch()` fixture at lines 1182–1231 stores create operations as wrapped objects with the title in `draft.title`. Production code preserves that representation:

- `Tesbo-Backend-Nest/src/legacy/legacy.service.ts:20761–20780` removes the selected draft and writes the surviving raw entries.
- The same service at lines 20806–20829 edits a create operation through `entry.draft`.
- The same service at lines 20983–20993 preserves the remaining raw entries after partial publication.

Consequently, the old title-reader would produce null entries for these wrapped create proposals even when the required product persistence was correct. The affected selected assertions are ZYU-65 at line 4164, ZYU-66 at line 4219, and ZYU-141 at lines 4183 and 4196. This is a source-supported test-oracle failure prediction, not a claim that those browser tests were executed or failed in a captured run.

## Correction verification

The reviewed correction changes only line 1263. The query now extracts `draft.title`, then `fields.title`, then flat `title`, and aggregates in explicit source-array order:

```sql
SELECT COALESCE(
  jsonb_agg(
    COALESCE(d.value->'draft'->>'title', d.value->'fields'->>'title', d.value->>'title')
    ORDER BY d.ordinality
  ),
  '[]'::jsonb
)::text
FROM ai_generation_requests r,
     jsonb_array_elements(r.generated_payload) WITH ORDINALITY AS d(value, ordinality)
WHERE r.id = <escaped task id>;
```

The actual file retains the existing `literal(taskId)` interpolation. This presentation uses a placeholder solely for readability.

The title precedence matches wrapped create/edit proposals and retains support for flat task-board drafts. Explicit ordinality makes the ordered-array assertions deterministic. The query still yields an empty array when there are no stored entries, and it does not filter away unknown/null titles to manufacture a match.

Independent read-only byte comparison established equal line counts, exactly one changed line (1263), and identical bytes everywhere else in the file. Separate extraction of each affected complete test body also established byte identity:

| Test body | SHA-256, identical in old and corrected files |
| --- | --- |
| ZYU-65 | `f398a6d57d6823de0e08213fa0bf86fa6055937bce0e55c33f5bb2c8402784c9` |
| ZYU-66 | `2f6eaef2d4df027ad9cfd9160d799d84147b57cd58de938c22d9661c870118e7` |
| ZYU-141 | `bbc9cd2085a70cd5f604660ea35ec6a6af517342aacd3bcacbac1960dce473fe` |

Thus all title, count, selection, persisted-state, and reload assertions remain intact; this correction changes how the fixture reads the authoritative proposal rows.

## Required and forbidden effects retained

- **Required by the existing tests:** discard persists only the requested removal; edit persists the changed title; reload shows the live remaining batch; selecting C after discarding B publishes exactly C, leaves A staged, and does not create A; a later reload does not resurrect C as staged.
- **Forbidden by the existing tests:** surviving proposals disappear, discarded/saved proposals return, stale indexes publish a different case, or a merely rendered edit is accepted without stored evidence.
- **Correction boundary:** the title-reader issues a read query. The file change adds no product write, approval shortcut, authorization bypass, skip, retry relaxation, or weakened assertion. The unchanged UI actions remain responsible for exercising actual product writes in the eventual browser run.

## Other audit observations and limitations

No additional concrete publication/approval fixture shortcut was found in the inspected remaining selection. MCP suite-positive paths assert machine refusal and unchanged state before a human REST write (`e2e/api/mcp.spec.ts:160–174`). Run-approval fixtures create Draft cases and call exact human approval (`e2e/api/run-approval.spec.ts:52–58`); inspected selected native compatibility fixtures use the same helper mechanism. Selected Bug tests keep explicit result changes separate from association-only persistence checks. Main's catalog correction checks 49 tools and explicitly excludes both retired suite publishers (`e2e/api/zyra.spec.ts:301–304`). These are source observations, not execution results.

No database, API, product service, or browser was started or contacted for this audit. No SQL query or Playwright test was executed. The byte-comparison script only read the old and corrected local source files. SQL/runtime/browser behavior must still be established by the selected isolated CI stages on the final exact source/tree. This receipt does not extend to the occurrence-identity repair, the full 49-journey denominator, original external I3/S0, or broad history acceptance.

The earlier receipt `/workspace/scratch/fb086055b433/assurance-working/qa-native-final-delta.md` was left unchanged and independently rehashed as `57c9ca7324a16afe16fc6953598fa94de4a0bbaaf584bf802993306c0bbed491`.
