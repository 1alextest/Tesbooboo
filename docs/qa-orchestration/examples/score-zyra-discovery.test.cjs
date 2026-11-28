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

// Executable transfer calibration, not model discovery, native acceptance or an active Skill.
function transferCalibration(check, same) {
  // These are deliberately small, synthetic domain models. No real financial or inventory system.
  class ExpectedInvariant extends Error {
    constructor(id) { super(id); this.id=id; }
  }
  function invariant(ok,id) { if (!ok) throw new ExpectedInvariant(id); }
  function financialRetry(fault, strong) {
    const rows=[];
    function credit(invoice, request, amount) {
      const existing=rows.find(r=>r.invoice===invoice&&r.request===request);
      if (!existing||fault==='repeat-side-effect') rows.push({id:rows.length+1,invoice,request,amount});
      return {accepted:true};
    }
    const initial=credit('invoice-A','request-1',25);
    const original=rows[0].id;
    credit('invoice-B','request-1',40); // same key on another independently scoped subject is legitimate
    const repeated=credit('invoice-A','request-1',25);
    invariant(initial.accepted&&repeated.accepted,'credit-ack');
    if (strong) {
      const selected=rows.filter(r=>r.invoice==='invoice-A'&&r.request==='request-1');
      invariant(selected.length===1&&selected[0].id===original&&selected[0].amount===25,'same-subject-single-effect');
      invariant(rows.filter(r=>r.invoice==='invoice-B').length===1&&rows.find(r=>r.invoice==='invoice-B').amount===40,'neighbor-preserved');
    }
    credit('invoice-A','request-2',10);
    if (strong) invariant(rows.filter(r=>r.invoice==='invoice-A').length===2,'distinct-intent-allowed');
  }
  function mobileSelection(fault,strong) {
    const items=new Map([['A',{revision:1,quantity:5}],['B',{revision:1,quantity:9}]]);
    let order=['A','B'];
    const queued={id:order[0],position:0,revision:items.get(order[0]).revision,delta:-2};
    order=['B','A']; // reorder between selection and the delayed write
    function apply(op) {
      const id=fault==='position-rebind'?order[op.position]:op.id;
      const item=items.get(id);
      if(item.revision!==op.revision) return {accepted:false,reason:'stale'};
      item.quantity+=op.delta; item.revision++;
      return {accepted:true};
    }
    const result=apply(queued);
    invariant(result.accepted,'sync-ack');
    if(strong) invariant(items.get('A').quantity===3&&items.get('A').revision===2&&items.get('B').quantity===9&&items.get('B').revision===1,'stable-subject-preserved');
    const snapshot=JSON.stringify([...items]);
    const stale=apply({id:'A',position:1,revision:1,delta:-1});
    if(strong) invariant(!stale.accepted&&stale.reason==='stale'&&JSON.stringify([...items])===snapshot,'stale-write-refused');
    // Independent, current operation on B remains possible.
    const current=apply({id:'B',position:0,revision:items.get('B').revision,delta:1});
    if(strong) invariant(current.accepted&&items.get('B').quantity===10,'authorized-neighbor-remains-usable');
  }
  function classify(run, expectedId) {
    try {run();return 'PASS';}
    catch(e) {return e instanceof ExpectedInvariant&&e.id===expectedId?'INTENDED_ASSERTION_FAILURE':'OTHER_FAILURE';}
  }
  for(const [run,fault,id] of [[financialRetry,'repeat-side-effect','same-subject-single-effect'],[mobileSelection,'position-rebind','stable-subject-preserved']]) {
    same(classify(()=>run(null,true),id),'PASS');
    same(classify(()=>run(fault,false),id),'PASS'); // weak acknowledgment oracle misses the fault
    same(classify(()=>run(fault,true),id),'INTENDED_ASSERTION_FAILURE');
    same(classify(()=>run(null,true),id),'PASS'); // fresh original repeat
    same(classify(()=>{throw new Error('fixture setup failed')},id),'OTHER_FAILURE');
    same(classify(()=>{throw new ExpectedInvariant('unrelated-assertion')},id),'OTHER_FAILURE');
  }
  check(true,'completed two independent domain fixtures');
}

test('cross-application calibration distinguishes intended faults from unrelated failures',()=>{
  transferCalibration((condition,message)=>assert.ok(condition,message),(actual,expected)=>assert.equal(actual,expected));
});

test('retains explicit subject abstention separately from review uncertainty and missing output',()=>{
  const ref='calibration:subject-disposition';
  const target={id:'risk',kind:'RISK',oracleRef:'practice:risk'};
  const ids=['abstained','abstained-with-side','partial','unavailable','negative','found'];
  const manifest={schemaVersion:1,ref,purpose:'CALIBRATION',trials:ids.map(id=>({
    id,arm:'ordinary',subjectInputRef:'input:'+id,expectedDisposition:'FINDINGS',targets:[target]
  }))};
  const receipt=(trialId,disposition,review='COMPLETE',claims=[])=>({
    trialId,manifestRef:ref,subjectInputRef:'input:'+trialId,outputRef:'output:'+trialId,
    reviewRef:'review:'+trialId,disposition,review,claims
  });
  const confirmed=(id,targetId)=>({id,targetId,verdict:'CONFIRMED',evidenceRef:'practice:'+id});
  const result=scoreDiscovery(manifest,[
    receipt('abstained','UNKNOWN'),
    receipt('abstained-with-side','UNKNOWN','COMPLETE',[confirmed('side',null)]),
    receipt('partial','NO_FINDINGS','PARTIAL'),
    receipt('negative','NO_FINDINGS'),
    receipt('found','FINDINGS','COMPLETE',[confirmed('matched','risk')])
  ],ref);
  assert.deepEqual(result.rows.map(row=>[row.subjectDisposition,row.targets[0].status]),[
    ['UNKNOWN','MISSED'],['UNKNOWN','MISSED'],['NO_FINDINGS','UNKNOWN'],
    ['UNAVAILABLE','UNAVAILABLE'],['NO_FINDINGS','MISSED'],['FINDINGS','DISCOVERED']
  ]);
  const arm=result.arms[0];
  assert.deepEqual(arm.subjectDispositions,{FINDINGS:1,NO_FINDINGS:2,UNKNOWN:2,UNAVAILABLE:1});
  assert.equal(Object.values(arm.subjectDispositions).reduce((sum,count)=>sum+count,0),arm.assigned);
  assert.deepEqual(arm.risk,{assigned:6,discovered:1,missed:3,unknown:1,unavailable:1});
  assert.deepEqual(arm.precision,{confirmed:2,adjudicatedDistinct:2});
});


// Literature-derived synthetic calibration: not a production reasoner or a held-out model trial.
function semanticGroundingCalibration(equal) {
  // Synthetic positive-proposition rules, not native graph relations or product approvals.
  // Roots are stipulated by the fixture; no inference from model confidence or missing data.
  const names=['p','q','independent','a','b','c','neighbor','cycle-x','cycle-y'];
  const rules=[
    {head:'a',body:['p','q']},
    {head:'a',body:['independent']},
    {head:'b',body:['a']},
    {head:'c',body:['b','q']},
    {head:'cycle-x',body:['cycle-y']},
    {head:'cycle-y',body:['cycle-x']},
    {head:'cycle-x',body:['p']},
  ];
  // Candidate bounded implementation: rebuild least grounded fixed point from roots.
  function grounded(roots, activeRules, limit=names.length+1) {
    const supported=new Set(roots);
    for(let round=0;round<limit;round++) {
      let changed=false;
      for(const {head,body} of activeRules) {
        if(!supported.has(head)&&body.every(x=>supported.has(x))) {supported.add(head);changed=true;}
      }
      if(!changed)return {status:'COMPLETE',supported:[...supported].sort()};
    }
    // Do not publish a partial result as complete or an authoritative clean result.
    return {status:'UNKNOWN',supported:null};
  }
  // Independent algorithmic oracle: recursively enumerate acyclic grounded proof trees
  // for each target on this small finite fixture; an ancestry cycle cannot prove itself.
  function oracle(roots, activeRules) {
    function proves(id, ancestors) {
      if(roots.has(id))return true;
      if(ancestors.has(id))return false;
      const next=new Set(ancestors);next.add(id);
      return activeRules.some(r=>r.head===id&&r.body.every(x=>proves(x,next)));
    }
    return names.filter(id=>proves(id,new Set())).sort();
  }
  // Complete enumeration of all premise availability masks and rule orderings in this fixture.
  const premiseNames=['p','q','independent','neighbor'];
  let comparisons=0;
  for(let mask=0;mask<2**premiseNames.length;mask++) {
    const roots=new Set(premiseNames.filter((_,i)=>(mask&(1<<i))!==0));
    for(const activeRules of [rules,[...rules].reverse(),rules.filter(r=>r.head!=='a'||r.body.length!==1)]) {
      const answer=grounded(roots,activeRules);
      equal(answer.status,'COMPLETE');
      equal(answer.supported,oracle(roots,activeRules));
      comparisons++;
    }
  }
  const initial=new Set(['p','q','neighbor']);
  const corrected=new Set(['q','neighbor']);
  const alternate=new Set(['q','independent','neighbor']);
  equal(grounded(initial,rules).supported,['a','b','c','cycle-x','cycle-y','neighbor','p','q']);
  equal(grounded(corrected,rules).supported,['neighbor','q']);
  equal(grounded(alternate,rules).supported,['a','b','c','independent','neighbor','q']);
  // No root supports this cycle after correction; a previous-result-seeded algorithm falsely retains it.
  const staleRoots=new Set([...corrected,...grounded(initial,rules).supported.filter(x=>x!=='p')]);
  const stale=grounded(staleRoots,rules).supported;
  equal(stale.filter(x=>!oracle(corrected,rules).includes(x)),['a','b','c','cycle-x','cycle-y']);
  // Same-source alternatives do not rescue invalidated source: two paths still share p.
  const shared=[{head:'a',body:['p']},{head:'b',body:['p']},{head:'c',body:['a']},{head:'c',body:['b']}];
  equal(grounded(new Set(['p']),shared).supported,['a','b','c','p']);
  equal(grounded(new Set(),shared).supported,[]);
  equal(grounded(initial,rules,1),{status:'UNKNOWN',supported:null});
  equal(comparisons,48);
}

test('grounded semantic support: differential oracle, retraction, alternatives and cycle containment',()=>{
  semanticGroundingCalibration((actual,expected)=>assert.deepEqual(actual,expected));
});
