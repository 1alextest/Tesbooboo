// Synthetic practice controls, never a held-out model trial.
const assert = require('node:assert/strict');
const test = require('node:test');
const {scoreDiscovery} = require('./score-zyra-discovery.cjs');

function calibrate(score, check, rejects) {
  const ref='calibration:v1';
  const targets=[{id:'move',kind:'RISK',oracleRef:'practice:move'},{id:'policy',kind:'REQUIREMENT_GAP',oracleRef:'practice:policy'}];
  const trial=(id,arm,expectedDisposition,targets=[])=>({id,arm,subjectInputRef:'practice:'+id,expectedDisposition,targets});
  const manifest={schemaVersion:1,ref,purpose:'CALIBRATION',trials:[
    trial('A','ordinary','FINDINGS',targets),trial('B','candidate','FINDINGS',targets),
    trial('C','candidate','NO_FINDINGS'),trial('D','candidate','UNKNOWN'),
    trial('E','ordinary','FINDINGS',targets),trial('F','ordinary','NO_FINDINGS')]};
  const claim=(id,verdict,targetId=null,extra={})=>({id,verdict,targetId,evidenceRef:'practice:review:'+id,...extra});
  const receipt=(trialId,disposition,claims,review='COMPLETE')=>({trialId,manifestRef:ref,subjectInputRef:'practice:'+trialId,
    outputRef:'practice:output:'+trialId,reviewRef:'practice:review:'+trialId,disposition,review,claims});
  const receipts=[
    receipt('A','FINDINGS',[claim('a1','CONFIRMED','move'),claim('a2','DUPLICATE','move',{duplicateOf:'a1'}),claim('a3','FALSE')]),
    receipt('B','FINDINGS',[claim('b1','CONFIRMED','move'),claim('b2','UNRESOLVED','policy'),claim('b3','CONFIRMED')]),
    receipt('C','NO_FINDINGS',[]),receipt('D','UNKNOWN',[]),
    receipt('F','FINDINGS',[claim('f1','UNSUPPORTED')])];
  const copy=x=>JSON.parse(JSON.stringify(x));
  const result=score(manifest,receipts,ref);
  const ordinary=result.arms.find(a=>a.arm==='ordinary'), candidate=result.arms.find(a=>a.arm==='candidate');
  check(result.purpose==='CALIBRATION'&&result.status==='RECORDED_ADJUDICATION_PROJECTION_ONLY','calibration status');
  check(JSON.stringify(ordinary.risk)===JSON.stringify({assigned:2,discovered:1,missed:0,unknown:0,unavailable:1}),'unavailable target retained');
  check(ordinary.requirementGap.missed===1&&ordinary.requirementGap.unavailable===1,'observed miss vs missing');
  check(candidate.requirementGap.unknown===1&&candidate.requirementGap.discovered===0,'unresolved target not counted as miss or discovery');
  check(ordinary.precision.confirmed===1&&ordinary.precision.adjudicatedDistinct===3&&ordinary.claims.DUPLICATE===1,'deduped precision');
  check(candidate.precision.confirmed===2&&candidate.precision.adjudicatedDistinct===2&&candidate.risk.discovered===1,'side finding separate from recall');
  check(candidate.controls.MATCH===2&&ordinary.controls.MISMATCH===1,'clean and unknown controls');
  let x=copy(receipts); x[0].review='PARTIAL';
  check(score(manifest,x,ref).arms[0].requirementGap.unknown===1,'partial review preserves unknown');
  x=copy(receipts);x[0].manifestRef='old';rejects(()=>score(manifest,x,ref),'stale manifest');
  x=copy(receipts);x[0].subjectInputRef='wrong';rejects(()=>score(manifest,x,ref),'wrong subject input');
  x=copy(receipts);x.push(copy(x[0]));rejects(()=>score(manifest,x,ref),'duplicate receipt');
  x=copy(receipts);x[0].claims[1].verdict='CONFIRMED';delete x[0].claims[1].duplicateOf;rejects(()=>score(manifest,x,ref),'double count target');
  x=copy(receipts);x[0].claims[1].duplicateOf='missing';rejects(()=>score(manifest,x,ref),'unbound duplicate');
  x=copy(receipts);x[0].claims[0].evidenceRef='';rejects(()=>score(manifest,x,ref),'missing grading evidence');
  x=copy(receipts);x[0].claims[2].verdict='NOT_ADJUDICATED';rejects(()=>score(manifest,x,ref),'complete review contradiction');
  x=copy(receipts);x[2].claims=[claim('c1','FALSE')];rejects(()=>score(manifest,x,ref),'no findings contradiction');
  const m=copy(manifest);m.trials.push(copy(m.trials[0]));rejects(()=>score(m,receipts,ref),'duplicate assignment');
  rejects(()=>score(manifest,receipts,'wrong'),'wrong reviewed reference');
  return result;
}

test('calibrate discovery accounting and negative receipt controls',()=>{
  calibrate(scoreDiscovery,(condition,message)=>assert.ok(condition,message),(fn,message)=>assert.throws(fn,undefined,message));
});
