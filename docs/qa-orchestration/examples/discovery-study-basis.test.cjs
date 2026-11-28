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

const {ARTIFACT_DOMAINS,prepareCrossArtifactContext,bindCrossArtifactCitation,crossArtifactPracticeStudy}=require('./cross-artifact-calibration.cjs');

test('cross-artifact practice uses the existing frozen paired-study owner without exposing private targets',()=>{
  const study=crossArtifactPracticeStudy();
  const {manifest,subjectPackets}=freezePairedDiscovery(study);
  assert.equal(manifest.trials.length,12);
  assert.equal(subjectPackets.length,12);
  for (const packet of subjectPackets) {
    const input=verifySubjectPacket(packet,manifest,manifest.ref);
    const basis=JSON.parse(input.context.split('\n',1)[0]);
    assert.deepEqual(Object.keys(basis.domains),ARTIFACT_DOMAINS);
    assert.equal(prepareCrossArtifactContext(basis),input.context.split('\n',1)[0]);
    assert.doesNotMatch(input.context,/private:|practice-oracle:|expectedDisposition|rubricRef/);
  }
  const {scoreDiscovery}=require('./score-zyra-discovery.cjs');
  const score=scoreDiscovery(manifest,[],manifest.ref);
  for (const arm of score.arms) {
    assert.equal(arm.assigned,6);
    assert.equal(arm.available,0);
    assert.equal(arm.risk.unavailable,3);
    assert.equal(arm.requirementGap.unavailable,1);
    assert.equal(arm.controls.UNAVAILABLE,3);
    assert.equal(arm.risk.discovered,0);
  }
  const controls=Object.fromEntries(study.pairs.map(p=>[p.id,p.expectedDisposition]));
  assert.deepEqual(controls,{code:'FINDINGS',manual:'FINDINGS',policy:'FINDINGS',clean:'NO_FINDINGS',unknown:'UNKNOWN',temporal:'NO_FINDINGS'});
  for(const id of ['manual','policy']){
    const pair=study.pairs.find(p=>p.id===id);
    assert.equal(JSON.parse(pair.input.context).domains.implementation.availability,'not_applicable');
  }
  const unavailable=JSON.parse(study.pairs.find(p=>p.id==='unknown').input.context);
  assert.deepEqual(unavailable.domains.policy.records,[]);
  assert.equal(unavailable.domains.policy.availability,'unavailable');
});

test('exact citation binds source domain and revision without conferring semantic or transfer authority',()=>{
  const study=crossArtifactPracticeStudy();
  const {manifest,subjectPackets}=freezePairedDiscovery(study);
  const input=verifySubjectPacket(subjectPackets.find(p=>p.trialId==='temporal-2'),manifest,manifest.ref);
  const cite=(revision,excerpt)=>bindCrossArtifactCitation(input.context,{domain:'policy',id:'refund-policy',revision,excerpt});
  assert.deepEqual(cite('v3','the requester cannot approve their own refund'),{
    domain:'policy',id:'refund-policy',revision:'v3',role:'approved',
    interval:'within_recorded_interval',scopeRef:study.scopeRef,
    semanticVerdict:'not_adjudicated',transferAuthority:'not_established'
  });
  assert.equal(cite('v1','A clerk may approve').interval,'outside_recorded_interval');
  assert.equal(cite('v4','An automatic refund').interval,'outside_recorded_interval');
  assert.equal(cite('v5','Remove independent approval').role,'rejected');
  assert.throws(()=>cite('v3','An automatic refund'),/exact supplied artifact revision/);
  assert.throws(()=>cite('v3','Reconcile the actor'),/exact supplied artifact revision/);
  assert.throws(()=>bindCrossArtifactCitation(input.context,{domain:'requirement',id:'refund-policy',revision:'v3',excerpt:'independent supervisor'}),/exact supplied artifact revision/);
  const manual=verifySubjectPacket(subjectPackets.find(p=>p.trialId==='manual-1'),manifest,manifest.ref);
  assert.equal(bindCrossArtifactCitation(manual.context,{domain:'user_manual',id:'refund-guide',revision:'v3',excerpt:'The clerk clicks Approve'}).role,'candidate');
  const unknown=verifySubjectPacket(subjectPackets.find(p=>p.trialId==='unknown-1'),manifest,manifest.ref);
  assert.throws(()=>bindCrossArtifactCitation(unknown.context,{domain:'policy',id:'refund-policy',revision:'v3',excerpt:'independent supervisor'}),/exact supplied artifact revision/);
});

test('cross-artifact context fails closed for missing, contradictory or foreign inventory',()=>{
  const context=crossArtifactPracticeStudy().pairs[0].input.context;
  const basis=JSON.parse(context);
  const change=(mutate,reason)=>{const changed=copy(basis);mutate(changed);assert.throws(()=>prepareCrossArtifactContext(changed),reason)};
  change(x=>delete x.domains.user_manual,/explicit disposition/);
  change(x=>x.domains.policy.availability='unavailable',/conflicts with record/);
  change(x=>x.domains.policy.records[0].scopeRef='foreign-project',/scoped artifact/);
  change(x=>x.domains.policy.records.push(copy(x.domains.policy.records[0])),/Duplicate exact/);
  change(x=>x.asOf='2026-02-31',/identity or date/);
  change(x=>{x.domains.policy.records[0].from='2027-01-01';x.domains.policy.records[0].to='2026-12-31'},/scoped artifact or interval/);
  change(x=>x.domains.policy.records[0].excerpt='x'.repeat(4001),/scoped artifact/);
  change(x=>x.domains.policy.records[0].oracleRef='private-label',/scoped artifact/);
  change(x=>x.purpose='LIVE_PROJECT_CONTEXT',/calibration identity/);
  const temporal=JSON.parse(crossArtifactPracticeStudy().pairs.find(p=>p.id==='temporal').input.context);
  const canonical=prepareCrossArtifactContext(temporal);
  temporal.domains.policy.records.reverse();
  assert.equal(prepareCrossArtifactContext(temporal),canonical);
});

test('whole-system practice adds operating context without altering the original artifact protocol',()=>{
  const {WHOLE_SYSTEM_DOMAINS,wholeSystemPracticeStudy}=require('./cross-artifact-calibration.cjs');
  const study=wholeSystemPracticeStudy();
  const {manifest,subjectPackets}=freezePairedDiscovery(study);
  assert.equal(manifest.trials.length,10);
  for(const packet of subjectPackets){
    const input=verifySubjectPacket(packet,manifest,manifest.ref);
    const context=input.context.split('\n',1)[0],basis=JSON.parse(context);
    assert.deepEqual(Object.keys(basis.domains),WHOLE_SYSTEM_DOMAINS);
    assert.equal(prepareCrossArtifactContext(basis),context);
    assert.doesNotMatch(input.context,/private:|practice-oracle:|expectedDisposition/);
  }
  const {scoreDiscovery}=require('./score-zyra-discovery.cjs');
  for(const arm of scoreDiscovery(manifest,[],manifest.ref).arms){
    assert.equal(arm.assigned,5);
    assert.equal(arm.available,0);
    assert.equal(arm.risk.unavailable,3);
    assert.equal(arm.requirementGap.unavailable,2);
    assert.equal(arm.controls.UNAVAILABLE,2);
  }
  const original=crossArtifactPracticeStudy();
  assert.equal(original.pairs.length,6);
  assert.equal(Object.keys(JSON.parse(original.pairs[0].input.context).domains).length,10);
});

test('configuration, unit contracts, operational observations and partial scope retain exact provenance',()=>{
  const {wholeSystemPracticeStudy}=require('./cross-artifact-calibration.cjs');
  const {manifest,subjectPackets}=freezePairedDiscovery(wholeSystemPracticeStudy());
  const context=id=>verifySubjectPacket(subjectPackets.find(p=>p.trialId===id+'-2'),manifest,manifest.ref).context;
  const cite=(id,domain,ref,revision,excerpt)=>bindCrossArtifactCitation(context(id),{domain,id:ref,revision,excerpt});
  assert.equal(cite('configuration','effective_configuration','warehouse-profile','rev2','deployed source commit unchanged').role,'observed');
  assert.equal(cite('configuration','execution','issue-run','run1','before configuration rev2').role,'historical');
  assert.equal(cite('units','interface_contract','supplier-feed','v3','12 individual items').role,'approved');
  assert.equal(cite('units','execution','feed-run','attempt1','ledger contains 2 individual items').semanticVerdict,'not_adjudicated');
  assert.equal(cite('outcome','operational_observation','issue-telemetry','window1','7 seconds').transferAuthority,'not_established');
  const observed=cite('partial','effective_configuration','warehouse-profile','test-rev1','Test tenant A');
  assert.equal(observed.inventoryAvailability,'partial');
  assert.throws(()=>cite('partial','effective_configuration','warehouse-profile','test-rev1','Production warehouse B'),/exact supplied artifact revision/);
  const basis=JSON.parse(context('partial').split('\n',1)[0]);
  assert.match(basis.domains.effective_configuration.reason,/production warehouse B/);
  assert.equal(basis.domains.interface_contract.availability,'not_applicable');
  const changed=copy(basis);changed.domains.effective_configuration.records=[];
  assert.throws(()=>prepareCrossArtifactContext(changed),/Availability conflicts/);
  delete basis.domains.operational_observation;
  assert.throws(()=>prepareCrossArtifactContext(basis),/explicit disposition/);
});

