# Governed effective Skill resolution — native-owner foundation

**Implementation status:** Proposed source-only deterministic resolver + Jest test suite. **No live Skill assignments, approval, activation, protected requirement publication, API/MCP exposure, DB migration or deployment.** Nothing in this note grants an agent governance authority.

**Source ownership:** `Tesbo-Backend-Nest/src/legacy/governed-skill-resolver.ts` is a **pure internal helper** for the existing T-422/KB governance owner, not a parallel Skills subsystem. Later native reads must come from authoritative, coherent, access-filtered Knowledge Base Skill identities/immutable versions plus separately human-approved assignment records. This implementation deliberately does not accept public request-supplied inventories. It does not claim the existing legacy KB documents are valid governing Skill versions.

## Exact contract

- Input: server-verified workspace/project/principal/module/subtype/audience/operation/phase/as-of, the authority revision, a **complete** authorized inventory of immutable version metadata and governed assignments. Absent/partial/foreign inventory yields `SKILL_CONTEXT_UNAVAILABLE`; malformed/duplicated/ambiguous metadata yields `SKILL_ASSIGNMENT_CONFLICT`.
- Selection: only active assignments within their effective interval, exact scope/context, pointing to an **approved** immutable version with review digest **and** a distinct recorded human activation/approval. Never auto-select a candidate, version name, highest revision or newest record. An active link to revoked/unapproved/missing content returns `SKILL_CONTEXT_STALE`.
- Composition: multiple overlapping skills require the **same** declared composition identity and human-reviewed receipt with unique precedence. The resolver checks exact dependencies, cycles, duplicate effective ownership and simple mandatory-root violations. Unsupported semantic conflicts are not declared settled by this algorithm. Project adapters do not stand in for missing core governance.
- Output: deterministic, status-scoped IDs and SHA-256 fingerprints, a context/authority-version-pinned digest, or explicit blocker. **No instructions are interpreted, no model is called, no official artifact/status is published.** Even a `resolved` result has `publicationAuthority: none`.
- Drift: compare the original pinned digest with a fresh authorized resolution at submit/review/apply. Role/scope, source, assignment, approval or revocation changes yield stale/unavailable. Historical candidate evidence is preserved and remains bound to its original digest.

## Tests and proof

`governed-skill-resolver.spec.ts` exercises deterministic positive resolution, subtype/audience/operation/phase isolation, workspace/project isolation, missing authority, unavailable/partial inventory, candidates/revocations/expired assignments, unapproved activation, conflicting assignment owners and precedence, unauthorized root overrides, incomplete composition, dependencies/cycles, and version-pin drift. An isolated TypeScript transpilation and 15-case standalone behavior harness **passed**. This is not Nest/Jest/DB verification; current-head CI remains necessary.

### Drift versus outage — independent falsifier

The in-flight pin checker now preserves **different** failure consequences: a revoked/unassigned Skill is `SKILL_CONTEXT_STALE` relative to a formerly approved pin; an ambiguous or contradictory composition is `SKILL_ASSIGNMENT_CONFLICT`; a partial/unreadable authority source is `SKILL_CONTEXT_UNAVAILABLE`. An ordinary digest or principal/context mismatch remains stale. This matters because reassessment of human-changed governing rules is not equivalent to retrying a transient reader outage. The pure regression exercises each cause; the actual authoritative reader and UI guidance remain unimplemented.

## Admission blockers

- Native Skills identity/assignment storage, approved immutable KB version binding, authorized human publication and active assignment operations **are not implemented**. A forged caller-supplied review digest would not establish human authority, which is why this helper is **internal-only**.
- Work Package A continues to advertise `SKILL_CONTEXT_UNAVAILABLE` for protected apply, requirement approval, link activation and coverage while no actual authority reader and resolver connection exists. Never change that blocker based on an offline pure-model test.
- Next work must wire a project/org permission-filtered **single canonical reader** with coherent assignment-head/approved-version source, explicit source revocation and human activation receipts, then add human-only governance mutations and native Test/REST/MCP integration. Do not deploy a standalone editable JSON Skill registry, a new agent or a fake seeded approval to claim success.
- Independently challenge the exact implementation under Security (unauthorized/project cross-scope), QA (stale/concurrent and version truth), Blue (native KB reuse), Green (assignment/KB seams), Red (conflicting duties) and White/Graph; no team review is claimed here.
