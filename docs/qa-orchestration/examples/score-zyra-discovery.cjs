// Read-only calibration projection of independently recorded discovery adjudications.
// The caller must pin and authenticate the manifest and review receipts outside this reducer.
const {verifyFrozenDiscovery}=require('./discovery-study-basis.cjs');
function scoreDiscovery(manifest, receipts, expectedManifestRef) {
  const nonempty = v => typeof v === 'string' && v.trim().length > 0;
  const require = (condition, message) => { if (!condition) throw new Error(message); };
  const dispositions = ['FINDINGS','NO_FINDINGS','UNKNOWN'];
  const verdicts = ['CONFIRMED','FALSE','UNSUPPORTED','UNRESOLVED','NOT_ADJUDICATED','DUPLICATE'];
  require(manifest && manifest.schemaVersion === 1 && nonempty(expectedManifestRef) &&
    manifest.ref === expectedManifestRef && ['CALIBRATION','BLINDED_TRIAL'].includes(manifest.purpose),
    'Invalid or mismatched frozen manifest reference');
  if (manifest.purpose === 'BLINDED_TRIAL') verifyFrozenDiscovery(manifest, expectedManifestRef);
  require(Array.isArray(manifest.trials) && manifest.trials.length > 0 && Array.isArray(receipts), 'Invalid trial inventory');
  const roster = new Map();
  for (const trial of manifest.trials) {
    require(trial && nonempty(trial.id) && nonempty(trial.arm) && !roster.has(trial.id) &&
      nonempty(trial.subjectInputRef) && dispositions.includes(trial.expectedDisposition) && Array.isArray(trial.targets),
      'Invalid or duplicate assigned trial');
    const targetIds = new Set();
    for (const target of trial.targets) {
      require(target && nonempty(target.id) && !targetIds.has(target.id) &&
        ['RISK','REQUIREMENT_GAP'].includes(target.kind) && nonempty(target.oracleRef), 'Invalid or duplicate target');
      targetIds.add(target.id);
    }
    require((trial.expectedDisposition === 'FINDINGS') === (targetIds.size > 0), 'Control/target inventory conflict');
    roster.set(trial.id, trial);
  }
  const delivered = new Map();
  for (const receipt of receipts) {
    require(receipt && roster.has(receipt.trialId) && !delivered.has(receipt.trialId) &&
      receipt.manifestRef === expectedManifestRef &&
      receipt.subjectInputRef === roster.get(receipt.trialId).subjectInputRef,
      'Unexpected, duplicate or stale receipt');
    require(nonempty(receipt.outputRef) && nonempty(receipt.reviewRef) &&
      dispositions.includes(receipt.disposition) && ['COMPLETE','PARTIAL'].includes(receipt.review) &&
      Array.isArray(receipt.claims), 'Incomplete receipt');
    delivered.set(receipt.trialId, receipt);
  }
  const rows = manifest.trials.map(trial => {
    const receipt = delivered.get(trial.id);
    const counts = Object.fromEntries(verdicts.map(v=>[v,0]));
    const confirmed = new Set(), unresolved = new Set(), claims = new Map();
    if (receipt) {
      for (const claim of receipt.claims) {
        require(claim && nonempty(claim.id) && !claims.has(claim.id) && verdicts.includes(claim.verdict),
          'Invalid or duplicate claim identity');
        require(claim.targetId === null || trial.targets.some(t=>t.id===claim.targetId), 'Unknown target reference');
        if (claim.verdict === 'DUPLICATE') {
          const original = claims.get(claim.duplicateOf);
          require(original && original.verdict !== 'DUPLICATE' && claim.targetId === original.targetId,
            'Duplicate must identify an earlier nonduplicate claim for the same target');
        } else {
          require(claim.duplicateOf === undefined, 'Unexpected duplicate reference');
          if (claim.verdict !== 'NOT_ADJUDICATED') require(nonempty(claim.evidenceRef), 'Adjudication evidence required');
        }
        if (claim.verdict === 'CONFIRMED' && claim.targetId !== null) {
          require(!confirmed.has(claim.targetId), 'Repeated confirmed target must be classified as duplicate');
          confirmed.add(claim.targetId);
        }
        if (['UNRESOLVED','NOT_ADJUDICATED'].includes(claim.verdict) && claim.targetId !== null) unresolved.add(claim.targetId);
        claims.set(claim.id,claim);
        counts[claim.verdict]++;
      }
      require(receipt.review !== 'COMPLETE' || counts.NOT_ADJUDICATED === 0, 'Complete review contains unadjudicated claims');
      require(receipt.disposition !== 'NO_FINDINGS' || receipt.claims.length === 0, 'No-findings receipt asserts findings');
      require(receipt.disposition !== 'FINDINGS' || receipt.claims.length > 0, 'Findings receipt has no claims');
    }
    const targets = trial.targets.map(t=>({id:t.id,kind:t.kind,
      status:confirmed.has(t.id)?'DISCOVERED':!receipt?'UNAVAILABLE':
        receipt.review!=='COMPLETE'||unresolved.has(t.id)?'UNKNOWN':'MISSED'}));
    const control = trial.expectedDisposition === 'FINDINGS' ? 'NOT_APPLICABLE' :
      !receipt?'UNAVAILABLE':receipt.review!=='COMPLETE'||counts.UNRESOLVED>0?'UNKNOWN':
        receipt.disposition===trial.expectedDisposition&&receipt.claims.length===0?'MATCH':'MISMATCH';
    return {id:trial.id,arm:trial.arm,delivery:receipt?'AVAILABLE':'UNAVAILABLE',
      review:receipt?.review??'NOT_REVIEWED',targets,claims:counts,control};
  });
  const arms = [...new Set(rows.map(r=>r.arm))].map(arm=>{
    const selected = rows.filter(r=>r.arm===arm);
    const targets = selected.flatMap(r=>r.targets);
    const byKind = kind=>{
      const t=targets.filter(x=>x.kind===kind);
      return {assigned:t.length,discovered:t.filter(x=>x.status==='DISCOVERED').length,
        missed:t.filter(x=>x.status==='MISSED').length,unknown:t.filter(x=>x.status==='UNKNOWN').length,
        unavailable:t.filter(x=>x.status==='UNAVAILABLE').length};
    };
    const claims = Object.fromEntries(verdicts.map(v=>[v,selected.reduce((sum,r)=>sum+r.claims[v],0)]));
    const controls = Object.fromEntries(['MATCH','MISMATCH','UNKNOWN','UNAVAILABLE'].map(v=>[v,selected.filter(r=>r.control===v).length]));
    return {arm,assigned:selected.length,available:selected.filter(r=>r.delivery==='AVAILABLE').length,
      completeReview:selected.filter(r=>r.review==='COMPLETE').length,risk:byKind('RISK'),requirementGap:byKind('REQUIREMENT_GAP'),
      claims,precision:{confirmed:claims.CONFIRMED,adjudicatedDistinct:claims.CONFIRMED+claims.FALSE+claims.UNSUPPORTED},controls};
  });
  return {status:'RECORDED_ADJUDICATION_PROJECTION_ONLY',purpose:manifest.purpose,manifestRef:expectedManifestRef,arms,rows};
}

module.exports = {scoreDiscovery};
