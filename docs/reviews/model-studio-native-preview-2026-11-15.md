# Native Model Studio M1 preview — implementation checkpoint

## Purpose and boundary

Move from an offline symbolic example to a real, opt-in project API without introducing another expected-model authority or assuming unresolved publication, retention or target-execution policy. This increment is ephemeral structural validation, not persisted model authoring or M2 path generation. FR-117/C-12 remains the sole proposed family/revision owner for future persisted models.

POST `/api/projects/{projectId}/agents/zyra/changes/model-preview` is registered in the existing graph change-review module. The endpoint uses native authentication, project membership, machine-token scope and project write-lock guards. `TESBO_MODEL_PREVIEW_ENABLED=1` is required; default is503 MODEL_PREVIEW_DISABLED after native access authorization. Only isolated CI configuration opts in in this change. No production environment setting is changed.

## Request / response contract

```json
{
  "schemaVersion": "tesbo-fsm-draft/1",
  "semantics": "SEQUENTIAL_FSM",
  "initialStateId": "draft",
  "states": [{"id":"draft","label":"Draft"},{"id":"approved","label":"Approved"}],
  "transitions": [{"id":"approve","from":"draft","to":"approved","action":"Approve","expectedObservation":"Approval recorded"}]
}
```

Exact fields only. IDs start with an ASCII letter and contain up to64 letters/digits/underscore/hyphen; all state and transition IDs are distinct. Intake permits1–32 states and0–64 transitions, state labels1–120 characters, actions1–500 and expected observations1–1000, with nonblank text and no NUL. Missing initial state/endpoints, duplicates, unknown fields, authority fields, variables/guard/effect code and oversize input fail400 INVALID_MODEL. Non-SEQUENTIAL_FSM semantics fail422 UNSUPPORTED_SEMANTICS. Source text is inert caller data, never an approved oracle or instruction. A nonempty expected-observation string establishes structural presence only.

The deterministic response normalizes elements by ASCII ID, includes a candidate-content SHA-256 (not a canonical model version), reachable state/transition annotations, retained unreachable/terminal diagnostics and fixed parser limits. Cycles terminate: each state enters the queue once and each outgoing edge is examined once. There is no path enumeration or generation-job admission. Payloads cannot select a principal, source registry, canonical family/revision, approval, run, credentials or target. No provider/tool is called.

Status is always DRAFT_PREVIEW, validation STRUCTURALLY_VALID, approval NOT_APPROVED, sourceAuthority UNVERIFIED and runtimeEvidence NONE. Canonical model/revision IDs are null. Capabilities persistence/publication/activation/pathGeneration/targetExecution are all false; no coverage or execution result is emitted. Unreachable diagnostics are not silently removed from a denominator or approved exclusions.

After validating caller data, a scoped SELECT rechecks current project/organization membership and archive/deletion before returning. The feature has no model/case/run/history/link write path; native access/token infrastructure may retain its existing workspace bookkeeping and token-usage behavior. Denied callers do not receive validation or feature-state details. A candidate preview cannot satisfy human publication or target authorization.

## Verification selection

The existing `e2e/api/zyra.spec.ts` owns three added API journeys:

1. Valid/reordered/diagnostic preview with identical deterministic response and unchanged native case/run/graph/link counts.
2. Invalid, oversized, authority-bearing, guard-bearing and unsupported-semantics inputs with typed refusals and unchanged native counts.
3. Anonymous, guest, foreign project, read-only/write token and revoked-member boundaries; native API cleanup restores the disposable membership and revokes tokens.

Existing owner/source setup, graph history, browser navigation and case-to-run handoff scenarios remain in the same selected CI step. The selection is listed before execution and run through the existing disposable CI backend/frontend/migrated DB stack with `--workers=10`; it does not use the user's shared stack/database. No real provider, production record or target execution is involved. Full source/model publication, plan-transition matrix, UI/AT, storage/migration and native occurrence/evidence semantics remain their separate gates; existing global guard reuse is not a complete new entitlement audit.

Native Jest regressions cover the structural core, default-off flag, errors, current principal, revocation fence and no-write SQL. Direct Node stripped-type checks exercised the actual new core for deterministic output, invalid/unsupported inputs, cycles and unreachable states. These local core checks do not substitute for the required native HTTP/database end-to-end evidence. All new remote CI/product tests are pending until their exact-head results are read; no passing result is implied by this checkpoint file.

Source preparation parent is `92abc8601bf2b2e796170c034f75d759719db2aa`. The accepted implementation head is the commit actually identified by the PR/CI run; branch names and older CI passes cannot certify this source. The previous commit's8/8 green workflows are the unchanged-source baseline only. The specification-only White/Graph verdict at v1.4.22 is not superseded by this implementation checkpoint.
