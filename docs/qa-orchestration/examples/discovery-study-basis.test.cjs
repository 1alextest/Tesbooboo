const assert=require('node:assert/strict');
const test=require('node:test');
const {freezePairedDiscovery,verifyFrozenDiscovery,verifySubjectPacket}=require('./discovery-study-basis.cjs');
const {createHash}=require('node:crypto');
const copy=structuredClone;
const digest=value=>'sha256:'+createHash('sha256').update(JSON.stringify(value,null,2)+'\n').digest('hex');
function practiceStudy(){
  const pair=(id,expectedDisposition,targets=[])=>({id,ordinaryTrialId:id+'-1',candidateTrialId:id+'-2',
    input:{story:'Review this isolated change',acceptanceCriteria:'',context:'Authorized source excerpt',language:'en',requestedCount:3},expectedDisposition,targets});
  return {scopeRef:'practice:scope',cutoffRef:'practice:cutoff',rubricRef:'practice:rubric',
    settings:{nativeBuildRef:'practice:build',modelRef:'practice:model',clientRef:'practice:client',grantRef:'practice:read-only',
      budget:{maxWallMs:20000,maxToolCalls:0,maxOutputTokens:2000}},ordinaryMethodRef:'practice:ordinary',candidateMethodRef:'practice:candidate',candidateMethod:'Review possible downstream effects.',
    pairs:[pair('p1','FINDINGS',[{id:'private-target',kind:'RISK',oracleRef:'private-oracle'}]),pair('p2','NO_FINDINGS'),pair('p3','UNKNOWN')]};
}
test('freeze balanced pairs; only intended context changes; private labels stay outside subjects',()=>{
  const study=practiceStudy();const {manifest,subjectPackets}=freezePairedDiscovery(study);
  assert.equal(manifest.trials.length,6);assert.equal(subjectPackets.length,6);
  assert.equal(manifest.ref,freezePairedDiscovery(study).manifest.ref);
  assert.equal(verifyFrozenDiscovery(manifest,manifest.ref),manifest);
  for(let i=0;i<6;i+=2){
    const a=verifySubjectPacket(subjectPackets[i],manifest,manifest.ref),b=verifySubjectPacket(subjectPackets[i+1],manifest,manifest.ref);
    assert.deepEqual(b,{...a,context:a.context+'\n\n'+study.candidateMethod});
    assert.deepEqual(Object.keys(subjectPackets[i]),['trialId','subjectInputRef','input']);
    assert.equal(/private-target|private-oracle|expectedDisposition|candidateMethodRef|rubricRef/.test(JSON.stringify([subjectPackets[i],subjectPackets[i+1]])),false);
  }
  study.pairs[0].input.context='changed after freeze';study.settings.budget.maxToolCalls=3;
  assert.equal(verifySubjectPacket(subjectPackets[0],manifest,manifest.ref).context,'Authorized source excerpt');
  assert.equal(manifest.settings.budget.maxToolCalls,0);
});
test('reject modified private oracle, assignment, budget and recomputed manifest against original pin',()=>{
  const {manifest}=freezePairedDiscovery(practiceStudy());const pin=manifest.ref;
  for(const mutate of [m=>m.trials[0].targets[0].oracleRef='changed',m=>m.trials[0].arm='candidate',m=>m.settings.budget.maxToolCalls=5]){
    const m=copy(manifest);mutate(m);assert.throws(()=>verifyFrozenDiscovery(m,pin),/digest mismatch/);
    const {ref,...body}=m;m.ref=digest(body);assert.throws(()=>verifyFrozenDiscovery(m,pin),/digest mismatch/);
  }
});
test('reject stale, tampered, cross-trial or extra-field delivery',()=>{
  const {manifest,subjectPackets}=freezePairedDiscovery(practiceStudy());const pin=manifest.ref;
  let p=copy(subjectPackets[0]);p.input.context='different';assert.throws(()=>verifySubjectPacket(p,manifest,pin),/input digest/);
  p=copy(subjectPackets[0]);p.trialId=subjectPackets[1].trialId;assert.throws(()=>verifySubjectPacket(p,manifest,pin),/input digest/);
  p=copy(subjectPackets[0]);p.oracleRef='private';assert.throws(()=>verifySubjectPacket(p,manifest,pin),/subject packet fields/);
  p=copy(subjectPackets[0]);p.input.oracleRef='private';assert.throws(()=>verifySubjectPacket(p,manifest,pin),/native input fields/);
  const authorized=verifySubjectPacket(subjectPackets[0],manifest,pin);authorized.story='local mutation';
  assert.notEqual(authorized.story,subjectPackets[0].input.story);
});
test('reject invalid, unbalanced or answer-bearing input before freeze',()=>{
  let s=practiceStudy();s.pairs[0].input.oracleRef='private';assert.throws(()=>freezePairedDiscovery(s),/input fields/);
  s=practiceStudy();s.pairs[1].candidateTrialId=s.pairs[0].ordinaryTrialId;assert.throws(()=>freezePairedDiscovery(s),/duplicate paired assignment/);
  s=practiceStudy();s.pairs.pop();assert.throws(()=>freezePairedDiscovery(s),/insufficient-evidence controls/);
  s=practiceStudy();s.pairs[0].targets=[];assert.throws(()=>freezePairedDiscovery(s),/target\/control inventory/);
  s=practiceStudy();s.settings.budget.maxWallMs=0;assert.throws(()=>freezePairedDiscovery(s),/budget/);
  const {manifest}=freezePairedDiscovery(practiceStudy());const m=copy(manifest);m.trials.pop();const {ref,...body}=m;m.ref=digest(body);
  assert.throws(()=>verifyFrozenDiscovery(m,m.ref),/Unmatched paired assignment/);
});


test('integrated blinded scoring preserves missing trials and rejects mismatched observed execution',()=>{
  const {scoreDiscovery}=require('./score-zyra-discovery.cjs');
  const {manifest}=freezePairedDiscovery(practiceStudy());
  const receipt=trial=>({
    trialId:trial.id,manifestRef:manifest.ref,subjectInputRef:trial.subjectInputRef,
    outputRef:'practice:output:'+trial.id,reviewRef:'practice:review:'+trial.id,
    disposition:'FINDINGS',review:'COMPLETE',
    claims:[{id:'claim-1',verdict:'CONFIRMED',targetId:'private-target',evidenceRef:'practice:oracle'}],
    execution:{
      attemptRef:'practice:attempt:'+trial.id,attemptOrdinal:1,runtimeEvidenceRef:'practice:runtime:'+trial.id,
      subjectInputRef:trial.subjectInputRef,methodRef:trial.arm==='ordinary'?manifest.methods.ordinaryRef:manifest.methods.candidateRef,
      configuration:Object.fromEntries(['nativeBuildRef','modelRef','clientRef','grantRef'].map(k=>[k,manifest.settings[k]])),
      usage:{wallMs:100,toolCalls:0,outputTokens:50}
    }
  });
  const receipts=manifest.trials.slice(0,2).map(receipt);
  const result=scoreDiscovery(manifest,receipts,manifest.ref);
  assert.equal(result.purpose,'BLINDED_TRIAL');
  for(const arm of result.arms){
    assert.equal(arm.assigned,3);assert.equal(arm.available,1);
    assert.deepEqual(arm.risk,{assigned:1,discovered:1,missed:0,unknown:0,unavailable:0});
    assert.equal(arm.controls.UNAVAILABLE,2);
  }
  const mutations=[
    [r=>delete r.execution,/execution observation fields/],
    [r=>r.execution.attemptOrdinal=2,/First-attempt/],
    [r=>r.execution.runtimeEvidenceRef='',/First-attempt/],
    [r=>r.execution.subjectInputRef=manifest.trials[1].subjectInputRef,/input mismatch/],
    [r=>r.execution.methodRef=manifest.methods.candidateRef,/method mismatch/],
    [r=>r.execution.configuration.modelRef='different',/configuration mismatch/],
    [r=>delete r.execution.usage.outputTokens,/usage fields/],
    [r=>r.execution.usage.wallMs=-1,/invalid execution usage/],
    [r=>r.execution.usage.toolCalls=1,/exceeds frozen budget/]
  ];
  for(const [mutate,reason] of mutations){
    const altered=copy(receipts);mutate(altered[0]);assert.throws(()=>scoreDiscovery(manifest,altered,manifest.ref),reason);
  }
  const reused=copy(receipts);reused[1].execution.attemptRef=reused[0].execution.attemptRef;
  assert.throws(()=>scoreDiscovery(manifest,reused,manifest.ref),/attempt reused/);
  const changed=copy(manifest);changed.trials[0].targets[0].oracleRef='unreviewed';
  assert.throws(()=>scoreDiscovery(changed,receipts,manifest.ref),/digest mismatch/);
});
