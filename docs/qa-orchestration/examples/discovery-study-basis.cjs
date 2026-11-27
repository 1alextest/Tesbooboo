// Offline basis preparation for the existing Zyra discovery scorecard, not a dispatcher.
const { createHash } = require('node:crypto');

const digest = value => 'sha256:' + createHash('sha256').update(JSON.stringify(value, null, 2) + '\n').digest('hex');
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const isDigest = value => typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value);
const ensure = (ok, message) => { if (!ok) throw new Error(message); };
function exactKeys(value, keys, label) {
  ensure(value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)), 'Invalid '+label+' fields');
}
const inputKeys = ['story','acceptanceCriteria','context','language','requestedCount'];
function nativeInput(input) {
  exactKeys(input, inputKeys, 'supplied-context input');
  ensure(nonempty(input.story) && typeof input.acceptanceCriteria === 'string' && typeof input.context === 'string' &&
    ['en','ru'].includes(input.language) && Number.isInteger(input.requestedCount) && input.requestedCount >= 1 &&
    input.requestedCount <= 10, 'Invalid bounded supplied-context input');
  // Same input shape as the existing native authoring replay. This pilot does not retrieve source.
  return { feedback:'', knowledge:[], jira:[], linear:[], notion:[], existingTestcases:[],
    requestedCount:input.requestedCount, testcaseRange:'1-10', knowledgeConfidence:'none', language:input.language,
    story:input.story, acceptanceCriteria:input.acceptanceCriteria, context:input.context };
}
function validateSettings(settings) {
  exactKeys(settings, ['nativeBuildRef','modelRef','clientRef','grantRef','budget'], 'study settings');
  ensure(['nativeBuildRef','modelRef','clientRef','grantRef'].every(key=>nonempty(settings[key])), 'Missing configuration identity');
  exactKeys(settings.budget, ['maxWallMs','maxToolCalls','maxOutputTokens'], 'study budget');
  ensure(Object.values(settings.budget).every(value=>Number.isSafeInteger(value)&&value>=0) &&
    settings.budget.maxWallMs>0 && settings.budget.maxOutputTokens>0, 'Invalid bounded study budget');
}
function validateTargets(expectedDisposition, targets) {
  ensure(['FINDINGS','NO_FINDINGS','UNKNOWN'].includes(expectedDisposition)&&Array.isArray(targets)&&
    (expectedDisposition==='FINDINGS')===(targets.length>0), 'Invalid target/control inventory');
  const ids=new Set();
  for (const target of targets) {
    exactKeys(target,['id','kind','oracleRef'],'private target');
    ensure(nonempty(target.id)&&!ids.has(target.id)&&['RISK','REQUIREMENT_GAP'].includes(target.kind)&&
      nonempty(target.oracleRef),'Invalid or duplicate private target');
    ids.add(target.id);
  }
}
function verifyFrozenDiscovery(manifest, expectedRef) {
  exactKeys(manifest,['schemaVersion','purpose','ref','scopeRef','cutoffRef','rubricRef','settings','methods','trials'],'frozen manifest');
  const {ref,...body}=manifest;
  ensure(manifest.schemaVersion===1&&manifest.purpose==='BLINDED_TRIAL'&&isDigest(expectedRef)&&ref===expectedRef&&
    digest(body)===expectedRef,'Frozen discovery manifest digest mismatch');
  ensure(['scopeRef','cutoffRef','rubricRef'].every(key=>nonempty(manifest[key])),'Missing study identity');
  validateSettings(manifest.settings);
  exactKeys(manifest.methods,['ordinaryRef','candidateRef','candidateTextRef'],'method basis');
  ensure(nonempty(manifest.methods.ordinaryRef)&&nonempty(manifest.methods.candidateRef)&&
    manifest.methods.ordinaryRef!==manifest.methods.candidateRef&&isDigest(manifest.methods.candidateTextRef),'Invalid method basis');
  ensure(Array.isArray(manifest.trials)&&manifest.trials.length>0,'Missing paired assignments');
  const pairs=new Map(), ids=new Set();
  for (const trial of manifest.trials) {
    exactKeys(trial,['id','pairId','arm','commonInputRef','subjectInputRef','expectedDisposition','targets'],'paired assignment');
    ensure(nonempty(trial.id)&&!ids.has(trial.id)&&nonempty(trial.pairId)&&['ordinary','candidate'].includes(trial.arm)&&
      isDigest(trial.commonInputRef)&&isDigest(trial.subjectInputRef),'Invalid or duplicate paired assignment');
    ids.add(trial.id); validateTargets(trial.expectedDisposition,trial.targets);
    const members=pairs.get(trial.pairId)||[]; members.push(trial); pairs.set(trial.pairId,members);
  }
  for (const members of pairs.values()) {
    const ordinary=members.find(t=>t.arm==='ordinary'), candidate=members.find(t=>t.arm==='candidate');
    ensure(members.length===2&&ordinary&&candidate&&ordinary.subjectInputRef===ordinary.commonInputRef&&
      candidate.commonInputRef===ordinary.commonInputRef&&candidate.subjectInputRef!==ordinary.subjectInputRef&&
      candidate.expectedDisposition===ordinary.expectedDisposition&&digest(candidate.targets)===digest(ordinary.targets),'Unmatched paired assignment');
  }
  ensure(['FINDINGS','NO_FINDINGS','UNKNOWN'].every(kind=>manifest.trials.some(t=>t.expectedDisposition===kind)),
    'Study requires finding, no-finding and insufficient-evidence controls');
  return manifest;
}
function freezePairedDiscovery(study) {
  exactKeys(study,['scopeRef','cutoffRef','rubricRef','settings','ordinaryMethodRef','candidateMethodRef','candidateMethod','pairs'],'study');
  validateSettings(study.settings);
  ensure(nonempty(study.candidateMethod)&&Array.isArray(study.pairs)&&study.pairs.length>0,'Missing candidate or pairs');
  const trials=[], subjectPackets=[], pairIds=new Set();
  for (const pair of study.pairs) {
    exactKeys(pair,['id','ordinaryTrialId','candidateTrialId','input','expectedDisposition','targets'],'study pair');
    ensure(nonempty(pair.id)&&!pairIds.has(pair.id),'Duplicate or invalid pair'); pairIds.add(pair.id);
    const base=nativeInput(pair.input), commonInputRef=digest(base);
    for (const arm of ['ordinary','candidate']) {
      const id=arm==='ordinary'?pair.ordinaryTrialId:pair.candidateTrialId;
      const input=structuredClone(base);
      if(arm==='candidate') input.context+='\n\n'+study.candidateMethod;
      const subjectInputRef=digest(input);
      trials.push({id,pairId:pair.id,arm,commonInputRef,subjectInputRef,expectedDisposition:pair.expectedDisposition,targets:structuredClone(pair.targets)});
      subjectPackets.push({trialId:id,subjectInputRef,input});
    }
  }
  const body={schemaVersion:1,purpose:'BLINDED_TRIAL',scopeRef:study.scopeRef,cutoffRef:study.cutoffRef,rubricRef:study.rubricRef,
    settings:structuredClone(study.settings),methods:{ordinaryRef:study.ordinaryMethodRef,candidateRef:study.candidateMethodRef,candidateTextRef:digest(study.candidateMethod)},trials};
  const manifest={...body,ref:digest(body)};
  verifyFrozenDiscovery(manifest,manifest.ref);
  return {manifest,subjectPackets};
}
function verifySubjectPacket(packet,manifest,expectedRef) {
  verifyFrozenDiscovery(manifest,expectedRef);
  exactKeys(packet,['trialId','subjectInputRef','input'],'subject packet');
  const trial=manifest.trials.find(t=>t.id===packet.trialId);
  ensure(packet.input !== null && typeof packet.input==='object', 'Missing native input');
  const projected=nativeInput(Object.fromEntries(inputKeys.map(key=>[key,packet.input[key]])));
  ensure(digest(projected)===digest(packet.input), 'Unexpected native input fields or configuration');
  ensure(trial&&packet.subjectInputRef===trial.subjectInputRef&&digest(packet.input)===trial.subjectInputRef,'Subject input digest or assignment mismatch');
  // A host delivers only this native input, not the coordinator's packet or evaluator manifest.
  return structuredClone(packet.input);
}
module.exports={freezePairedDiscovery,verifyFrozenDiscovery,verifySubjectPacket};
