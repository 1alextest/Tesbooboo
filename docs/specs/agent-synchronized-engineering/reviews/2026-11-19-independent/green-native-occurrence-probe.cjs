/* Independent Green counterexample. Loads only the unchanged production projection module.
 * Persistence and Nest imports are stubbed; no database, API, service, browser or migration runs.
 * Passing control + failing counterexample establish projection behavior, not SQL reachability.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('/workspace/scratch/fb086055b433/Tesbooboo/Tesbo-Frontend/node_modules/typescript');

const sourcePath = '/workspace/scratch/fb086055b433/tesbo-review-native-final/Tesbo-Backend-Nest/src/behavior-graph/model-studio-repository.ts';
const source = fs.readFileSync(sourcePath, 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  experimentalDecorators: true, emitDecoratorMetadata: false
} }).outputText;
const loaded = { exports: {} };
const nest = { Injectable: () => (target) => target };
for (const name of ['BadRequestException', 'ConflictException', 'ForbiddenException', 'HttpException', 'NotFoundException']) {
  nest[name] = class extends Error {};
}
function stubRequire(name) {
  if (name === '@nestjs/common') return nest;
  if (name === '../legacy/testcase-edit-revision') return { TESTCASE_EDIT_REVISION_SQL: 'UNUSED_IN_PROJECTION' };
  if (name === '../common/human-review-principal') return { requireHumanReviewPrincipal() { throw new Error('Unexpected authority call'); } };
  if (name === './model-studio-preview.core') return { previewDraftModel() { throw new Error('Unexpected preview call'); }, DraftPreviewError: class extends Error {} };
  if (name === './model-studio-generator') return { generateModelPaths() { throw new Error('Unexpected generation call'); } };
  throw new Error(`Unexpected imported dependency: ${name}`);
}
new Function('require', 'module', 'exports', compiled)(stubRequire, loaded, loaded.exports);
const { ModelStudioRepository } = loaded.exports;

const scope = { projectId: 'project-p', modelRevisionId: 'model-r1', modelRunId: 'dispatch-d1', testcaseId: 'case-a' };
const manifest = { contentHash: 'model-content-r1', cases: [{
  testcaseId: scope.testcaseId, title: 'Original case v1', pathDigest: null,
  elementIds: ['expected-element-v1'], sources: ['linked'],
  mappings: [{ id: 'mapping-v1', testcaseRevision: 'case-edit-v1', basis: 'CURRENT' }]
}] };

async function projectionFor(fixture) {
  const observedSql = [];
  const db = { async query(sql, parameters) {
    observedSql.push(sql);
    assert.deepEqual(parameters, [scope.modelRevisionId, scope.projectId]);
    if (/SELECT id, manifest FROM mbt_model_runs/.test(sql)) {
      return { rows: [{ id: scope.modelRunId, manifest }] };
    }
    if (/SELECT mr.id AS model_run_id, ci.testcase_id, e.status/.test(sql)) {
      // The real projection selects only these columns from the active native occurrence.
      // fixture.* captures the distinct underlying native facts; none is selected by this query.
      return { rows: [{ model_run_id: scope.modelRunId, testcase_id: scope.testcaseId, status: fixture.status }] };
    }
    throw new Error(`Unexpected query: ${sql}`);
  } };
  const owner = new ModelStudioRepository(db, {});
  return { result: await owner.observedByElementFor(scope.modelRevisionId, scope.projectId), observedSql };
}

test('positive control: the original dispatched occurrence can contribute its native result', async () => {
  const fixture = { cycleItemId: 'item-v1', executionId: 'execution-v1', snapshotApprovalRevision: 'approved-v1', status: 'Passed' };
  const { result } = await projectionFor(fixture);
  assert.deepEqual(result, [{ elementId: 'expected-element-v1', runs: 1, results: 1, statusCounts: { Passed: 1 } }]);
});

test('new re-added occurrence must not inherit the original dispatch element attribution solely by testcaseId', async () => {
  // Source-supported producer scenario, NOT a performed database mutation:
  // dispatch item-v1 -> remove item-v1 -> edit/approve case v2 -> re-add same testcaseId
  // creates item-v2/execution-v2 -> explicit native result Passed for v2.
  const fixture = { cycleItemId: 'item-v2', executionId: 'execution-v2', snapshotApprovalRevision: 'approved-v2', status: 'Passed' };
  const { result } = await projectionFor(fixture);
  assert.deepEqual(result, [], 'A later native occurrence lacks the original dispatch mapping/definition basis and must stay unbound to that model element.');
});
