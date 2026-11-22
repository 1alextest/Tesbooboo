const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('/workspace/scratch/fb086055b433/Tesbooboo/Tesbo-Frontend/node_modules/typescript');

// Independent execution of the actual production effect callback, extracted without rewriting it.
// React, DOM, browser, network and persistence are NOT exercised. Controlled setters model the
// functional-state contract and the supplied GET promise determines response order.
const path = process.env.QA_PAGE_SOURCE || '/workspace/scratch/fb086055b433/tesbo-review-native-final/Tesbo-Frontend/app/(app)/projects/[id]/model-studio/page.tsx';
const source = fs.readFileSync(path, 'utf8');
const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const callbacks = [];
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect' &&
      node.arguments[0]?.getText(ast).includes('getModelStudioModel(')) callbacks.push(node.arguments[0].getText(ast));
  ts.forEachChild(node, visit);
}
visit(ast);
assert.equal(callbacks.length, 1, 'Use the actual single production detail effect');
const effectJs = ts.transpileModule('const effect = '+callbacks[0]+'; return effect;', {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText;
function deferred() { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; }
const flush = () => new Promise(resolve => setImmediate(resolve));
function fixture(initial = 'R2') {
  const held = deferred();
  const state = { revision: initial, detail: null, error: null, settled: null, gets: 0 };
  const context = {
    projectId: 'P', selectedModelId: 'M', detailKey: 'P:M:1',
    getModelStudioModel: () => { state.gets++; return held.promise; },
    getModelStudioCoverage: () => Promise.resolve({ modelId: 'M' }),
    setCoverage: () => {},
    setError: value => { state.error = value; },
    setDetail: value => { state.detail = value; },
    setSettledDetailKey: value => { state.settled = value; },
    setRevisionId: value => { state.revision = typeof value === 'function' ? value(state.revision) : value; },
  };
  const effect = new Function(...Object.keys(context), effectJs)(...Object.values(context));
  return { state, held, effect, rows: { id: 'M', revisions: [{id:'R2'}, {id:'R1'}] } };
}

test('historical revision selected during the actual pending detail callback survives its late result', async () => {
  const f = fixture(); f.effect();
  assert.equal(f.state.gets, 1); assert.equal(f.state.detail, null);
  f.state.revision = 'R1'; // The selection occurs after GET began, before its response resolves.
  f.held.resolve(f.rows); await flush();
  assert.equal(f.state.revision, 'R1');
  assert.equal(f.state.detail.id, 'M');
});

test('an unavailable previous selection defaults to the received model head', async () => {
  const f = fixture('different-model-revision'); f.effect();
  f.held.resolve(f.rows); await flush();
  assert.equal(f.state.revision, 'R2');
});

test('cleanup rejects a stale detail result without replacing selection or visible detail', async () => {
  const f = fixture(); const cleanup = f.effect();
  cleanup(); f.state.revision = 'new-model-revision';
  f.held.resolve(f.rows); await flush();
  assert.equal(f.state.revision, 'new-model-revision');
  assert.equal(f.state.detail, null);
  assert.equal(f.state.settled, null);
});
