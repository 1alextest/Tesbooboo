/* Independent Green repair probe. Executes the pinned production repository module only.
 * Database query results and transaction/native-owner dependencies are controlled test doubles.
 * This establishes projection/composition behavior, never PostgreSQL, HTTP or browser proof.
 * Override GREEN_OCCURRENCE_SOURCE_ROOT only to execute the identical oracle on the old source.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const test = require('node:test');
const ts = require('/workspace/scratch/fb086055b433/Tesbooboo/Tesbo-Frontend/node_modules/typescript');

const sourceRoot = process.env.GREEN_OCCURRENCE_SOURCE_ROOT || '/workspace/scratch/fb086055b433/tesbo-review-965a87a1';
const sourcePath = path.join(sourceRoot, 'Tesbo-Backend-Nest/src/behavior-graph/model-studio-repository.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
console.log(JSON.stringify({ sourcePath, sourceSha256: crypto.createHash('sha256').update(source).digest('hex'), mode: 'production projection/composition with controlled persistence doubles' }));
const compiled = ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  experimentalDecorators: true, emitDecoratorMetadata: false
} }).outputText;
const loaded = { exports: {} };
const nest = { Injectable: () => target => target };
for (const name of ['BadRequestException','ConflictException','ForbiddenException','HttpException','NotFoundException']) {
  nest[name] = class extends Error { constructor(body) { super(JSON.stringify(body)); this.response = body; } };
}
function stubRequire(name) {
  if (name === '@nestjs/common') return nest;
  if (name === '../legacy/testcase-edit-revision') return { TESTCASE_EDIT_REVISION_SQL: 'TEST_REVISION_EXPRESSION' };
  if (name === '../common/human-review-principal') return { requireHumanReviewPrincipal() { throw new Error('Unexpected review call'); } };
  if (name === './model-studio-preview.core') return { previewDraftModel() { throw new Error('Unexpected preview call'); }, DraftPreviewError: class extends Error {} };
  if (name === './model-studio-generator') return { generateModelPaths() { throw new Error('Unexpected generation call'); } };
  throw new Error(`Unexpected dependency: ${name}`);
}
new Function('require','module','exports',compiled)(stubRequire,loaded,loaded.exports);
const { ModelStudioRepository } = loaded.exports;
const id = n => `11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
const ids = { user:id(1), project:id(2), model:id(3), revision:id(4), run:id(5), cycle:id(6), case:id(7), item:id(8), execution:id(9) };
const hash = 'b'.repeat(64), newerHash = 'c'.repeat(64);
const pin = () => ({ cycleItemId:ids.item, executionId:ids.execution, snapshotApprovalRevision:hash });
const entry = (changes={}) => ({ testcaseId:ids.case, elementIds:['expected-transition'], nativeOccurrence:pin(), ...changes });
const run = (cases=[entry()], changes={}) => ({ id:ids.run, cycle_id:ids.cycle, cycle_name:'Native run', created_at:'2026-11-20T00:00:00Z', cycle_deleted:null, manifest:{cases}, ...changes });
const result = (changes={}) => ({ model_run_id:ids.run, testcase_id:ids.case, cycle_item_id:ids.item, execution_id:ids.execution, snapshot_approval_revision:hash, status:'Passed', ...changes });

async function project(runs, nativeRows) {
  const original = structuredClone(runs), queries=[];
  const db = { async query(sql, params) {
    queries.push(sql); assert.deepEqual(params,[ids.revision,ids.project]);
    if (sql.includes('SELECT id, manifest FROM mbt_model_runs')) return { rows:runs };
    if (sql.includes('SELECT mr.id, mr.cycle_id')) return { rows:runs.map(r => ({ ...r, case_count:nativeRows.filter(e=>e.model_run_id===r.id).length })) };
    if (sql.includes('COUNT(*)::int AS count')) {
      const counts = new Map();
      for (const r of nativeRows) { const key=r.model_run_id+':'+r.status; const v=counts.get(key)||{model_run_id:r.model_run_id,status:r.status,count:0}; v.count++;counts.set(key,v); }
      return { rows:[...counts.values()] };
    }
    if (sql.includes('SELECT mr.id AS model_run_id')) return { rows:nativeRows };
    throw new Error(`Unexpected projection query: ${sql}`);
  } };
  const owner=new ModelStudioRepository(db,{});
  const observed=await owner.observedByElementFor(ids.revision,ids.project);
  const governed=await owner.governedRunsFor(ids.revision,ids.project);
  assert.deepEqual(runs,original,'Reader must not rewrite immutable input manifests');
  return {observed,governed,queries};
}
const expectedObserved = [{elementId:'expected-transition',runs:1,results:1,statusCounts:{Passed:1}}];
function expectUnavailable(view, count=1) {
  assert.deepEqual(view.observed,[]);
  assert.equal(view.governed[0].caseCount,count);
  assert.equal(view.governed[0].attributedCaseCount,0);
  assert.equal(view.governed[0].unavailableCaseCount,count);
  assert.equal(view.governed[0].unknownCaseCount,0);
  assert.equal(view.governed[0].occurrenceBasis,'PINNED');
  assert.deepEqual(view.governed[0].statusCounts,{});
}
function expectUnknown(view, count=1) {
  assert.deepEqual(view.observed,[]);
  assert.equal(view.governed[0].caseCount,count);
  assert.equal(view.governed[0].unknownCaseCount,count);
  assert.equal(view.governed[0].unavailableCaseCount,0);
  assert.equal(view.governed[0].attributedCaseCount,0);
  assert.equal(view.governed[0].occurrenceBasis,'UNKNOWN');
  assert.deepEqual(view.governed[0].statusCounts,{});
}

test('original occurrence remains a positive native result in both projections',async()=>{
  const v=await project([run()],[result()]);
  assert.deepEqual(v.observed,expectedObserved);assert.equal(v.governed[0].caseCount,1);
  assert.deepEqual(v.governed[0].statusCounts,{Passed:1});
});
for (const [label,changes] of [
  ['same case re-added with a new item and execution',{cycle_item_id:id(18),execution_id:id(19)}],
  ['same item but different execution',{execution_id:id(19)}],
  ['same identities but a new reviewed snapshot',{snapshot_approval_revision:newerHash}],
  ['same occurrence identities falsely associated with another case',{testcase_id:id(17)}],
  ['otherwise matching occurrence attributed to another dispatch',{model_run_id:id(15)}],
]) test(label+' does not inherit original attribution',async()=>expectUnavailable(await project([run()],[result(changes)])));
test('later unrelated native additions do not inflate dispatched counts or statuses',async()=>{
  const v=await project([run()],[result(),result({testcase_id:id(17),cycle_item_id:id(18),execution_id:id(19),status:'Failed'})]);
  assert.deepEqual(v.observed,expectedObserved);assert.equal(v.governed[0].caseCount,1);
  assert.deepEqual(v.governed[0].statusCounts,{Passed:1});assert.equal(v.governed[0].attributedCaseCount,1);
});
test('removed original remains a known unavailable reference rather than zero dispatched cases',async()=>expectUnavailable(await project([run()],[])));
test('legacy missing pin stays UNKNOWN despite a present passing native case',async()=>{
  const e=entry();delete e.nativeOccurrence;expectUnknown(await project([run([e])],[result()]));
});
for (const [label,p] of [
  ['malformed item identity',{...pin(),cycleItemId:'not-a-uuid'}],
  ['missing execution identity',{cycleItemId:ids.item,snapshotApprovalRevision:hash}],
  ['unrecorded review digest',{...pin(),snapshotApprovalRevision:null}],
]) test(label+' stays UNKNOWN',async()=>expectUnknown(await project([run([entry({nativeOccurrence:p})])],[result()])));
test('duplicate manifest case pins invalidate both entries, not last-write-wins',async()=>expectUnknown(await project([run([entry(),entry({elementIds:['other-element']})])],[result()]),2));
test('one native execution cannot be claimed by two differently named case entries',async()=>{
  const e=entry({testcaseId:id(17),nativeOccurrence:{...pin(),cycleItemId:id(18)}});
  expectUnknown(await project([run([entry(),e])],[result()]),2);
});
test('one native item cannot be claimed by two entries with different executions',async()=>{
  const e=entry({testcaseId:id(17),nativeOccurrence:{...pin(),executionId:id(19)}});
  expectUnknown(await project([run([entry(),e])],[result()]),2);
});
test('duplicate result tuples do not choose an arbitrary passing or failing result',async()=>expectUnavailable(await project([run()],[result(),result({status:'Failed'})])));
test('duplicate element labels are counted once per native occurrence',async()=>{
  const v=await project([run([entry({elementIds:['expected-transition','expected-transition']})])],[result()]);
  assert.deepEqual(v.observed,expectedObserved);
});
test('empty historical manifest does not borrow current membership',async()=>expectUnknown(await project([run([])],[result()]),0));
test('valid, unavailable and unknown entries remain distinguishable in a partial result',async()=>{
  const missing=entry({testcaseId:id(17),nativeOccurrence:{cycleItemId:id(18),executionId:id(19),snapshotApprovalRevision:hash}});
  const unknown=entry({testcaseId:id(27),nativeOccurrence:null});
  const v=await project([run([entry(),missing,unknown])],[result()]);
  assert.deepEqual(v.observed,expectedObserved);
  assert.equal(v.governed[0].caseCount,3);assert.equal(v.governed[0].attributedCaseCount,1);
  assert.equal(v.governed[0].unavailableCaseCount,1);assert.equal(v.governed[0].unknownCaseCount,1);
  assert.equal(v.governed[0].occurrenceBasis,'UNKNOWN');assert.deepEqual(v.governed[0].statusCounts,{Passed:1});
});

function dispatchFixture(nativeRows, failManifest=false) {
  const state={inside:false,stagedNative:0,committedNative:0,committed:false,rolledBack:false,manifestWrites:0,manifest:null,events:[]};
  const client={async query(sql,values) {
    assert.equal(state.inside,true);state.events.push(sql);
    if (sql.includes('FROM mbt_models')) return {rows:[{id:ids.model,name:'Model'}]};
    if (sql.includes('FROM mbt_model_revisions')) return {rows:[{id:ids.revision,content_hash:hash,revision_number:1}]};
    if (sql.includes('FROM mbt_model_approvals')) return {rows:[{id:id(11),content_hash:hash}]};
    if (sql.includes('FROM mbt_generated_cases g')) return {rows:[{testcase_id:ids.case,title:'Case',status:'Approved',deleted:false,element_ids:['expected-transition'],path_digest:hash}]};
    if (sql.includes('FROM mbt_model_case_links')) return {rows:[]};
    if (sql.includes('FROM testcases')) return {rows:[{id:ids.case,title:'Case',status:'Approved',deleted:false,edit_revision:hash}]};
    if (sql.includes('FROM cycle_items ci')) {assert.deepEqual(values,[ids.cycle,ids.project]);return {rows:nativeRows};}
    if (sql.includes('INSERT INTO mbt_model_runs')) {
      state.manifestWrites++;if(failManifest)throw new Error('Manifest write refused');
      state.manifest=JSON.parse(values[7]);return {rows:[{id:ids.run,project_id:ids.project,model_id:ids.model,model_revision_id:ids.revision,approval_id:id(11),content_hash:hash,cycle_id:ids.cycle}]};
    }
    throw new Error(`Unexpected dispatch query: ${sql}`);
  }};
  const db={query(){throw new Error('Dispatch escaped shared transaction');},async transaction(fn){
    state.inside=true;
    try{const value=await fn(client);state.committed=true;state.committedNative=state.stagedNative;return value;}
    catch(e){state.rolledBack=true;throw e;}finally{state.inside=false;state.stagedNative=0;}
  }};
  const legacy={async requireProjectAccess(u,p){assert.equal(u,ids.user);assert.equal(p,ids.project);},
    async createCycleWithTestcasesForUser(u,p,body,tx){
      assert.equal(u,ids.user);assert.equal(p,ids.project);assert.equal(tx,client);assert.equal(state.inside,true);
      assert.deepEqual(body.testcaseIds,[ids.case]);state.stagedNative++;return {cycle:{id:ids.cycle,name:'Native run'},requested:1,added:1,skipped:0};
    },deleteCycle(){throw new Error('Fallible compensation must not be called');}};
  return {state,owner:new ModelStudioRepository(db,legacy)};
}
const dispatch = f => f.owner.dispatchRunForUser(ids.user,ids.project,ids.model,ids.revision,{caseIds:[ids.case]});
test('dispatch records real returned native identity before committing its manifest',async()=>{
  const f=dispatchFixture([result()]),v=await dispatch(f);
  assert.deepEqual(v.manifest.cases[0].nativeOccurrence,pin());assert.equal(f.state.committedNative,1);
  const read=f.state.events.findIndex(sql=>sql.includes('FROM cycle_items ci'));
  const write=f.state.events.findIndex(sql=>sql.includes('INSERT INTO mbt_model_runs'));
  assert.ok(read>=0&&read<write);assert.equal(f.state.committed,true);
});
for (const [label,rows] of [['missing',[]],['ambiguous',[result(),result()]],['invalid',[result({snapshot_approval_revision:null})]]]) {
  test(label+' native identity aborts the shared composition before manifest publication',async()=>{
    const f=dispatchFixture(rows);
    await assert.rejects(dispatch(f),e=>e.response?.code==='NATIVE_OCCURRENCE_UNAVAILABLE');
    assert.equal(f.state.committedNative,0);assert.equal(f.state.manifestWrites,0);assert.equal(f.state.rolledBack,true);
  });
}
test('manifest insert failure propagates through the same transaction without compensating deletion',async()=>{
  const f=dispatchFixture([result()],true);
  await assert.rejects(dispatch(f),/Manifest write refused/);
  assert.equal(f.state.committedNative,0);assert.equal(f.state.rolledBack,true);
});
