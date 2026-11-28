// Read-only projection of two existing historical Zyra trials; not an evaluator or release gate.
function summarizeRecordedGrades({trials, expected, armField, criteria, grades, extract}) {
  if (!Array.isArray(trials) || trials.length !== expected.length ||
      !grades || typeof grades !== 'object' || Array.isArray(grades) ||
      !criteria.length || new Set(criteria.map(c => c.id)).size !== criteria.length ||
      criteria.some(c => typeof c.id !== 'string' || !Number.isSafeInteger(c.max) || c.max < 1)) {
    throw new Error('Invalid assignment, rubric or grade inventory');
  }
  const byId = new Map(trials.map(t => [t.id, t]));
  if (byId.size !== expected.length || new Set(expected.map(t => t.alias)).size !== expected.length ||
      expected.some(t => {
        const actual = byId.get(t.id);
        return !actual || actual.gradeAlias !== t.alias || actual[armField] !== t.arm;
      })) throw new Error('Recorded assignment differs from frozen roster');
  if (Object.keys(grades).some(alias => !expected.some(t => t.alias === alias))) {
    throw new Error('Unexpected grade outside the assigned roster');
  }
  const max = criteria.reduce((n, c) => n + c.max, 0);
  const rows = expected.map(t => {
    const entry = Object.prototype.hasOwnProperty.call(grades, t.alias) ? grades[t.alias] : undefined;
    if (entry === undefined) return {id:t.id, arm:t.arm, status:'UNAVAILABLE', scores:null, total:null};
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('Invalid grade: ' + t.alias);
    const read = extract(entry);
    if (read === null) return {id:t.id, arm:t.arm, status:'UNAVAILABLE', scores:null, total:null};
    const {scores, reportedTotal} = read;
    if (!scores || Object.keys(scores).length !== criteria.length ||
        criteria.some(c => !Object.prototype.hasOwnProperty.call(scores,c.id) ||
          !Number.isSafeInteger(scores[c.id]) || scores[c.id] < 0 || scores[c.id] > c.max)) {
      throw new Error('Invalid or incomplete rubric grade: ' + t.alias);
    }
    const total = criteria.reduce((n,c) => n + scores[c.id],0);
    if (reportedTotal !== undefined && reportedTotal !== total) throw new Error('Inconsistent recorded total: ' + t.alias);
    return {id:t.id,arm:t.arm,status:'GRADED',scores:Object.fromEntries(criteria.map(c=>[c.id,scores[c.id]])),total};
  });
  const arms = [...new Set(expected.map(t=>t.arm))].map(arm=>{
    const assigned = rows.filter(t=>t.arm===arm);
    const available = assigned.filter(t=>t.status==='GRADED');
    return {arm,assigned:assigned.length,graded:available.length,unavailable:assigned.length-available.length,
      pointsEarned:available.reduce((n,t)=>n+t.total,0),
      assignedPointsPossible:assigned.length*max,
      gradedPointsPossible:available.length*max,
      obligations:criteria.map(c=>({id:c.id,full:available.filter(t=>t.scores[c.id]===c.max).length,
        partial:available.filter(t=>t.scores[c.id]>0&&t.scores[c.id]<c.max).length,
        zero:available.filter(t=>t.scores[c.id]===0).length,ungraded:assigned.length-available.length}))};
  });
  return {arms,rows};
}

function buildScorecard(authoring, queue) {
  const authorRoster = [
    {id:'h1',alias:'cedar',arm:'ordinary'},
    {id:'h2',alias:'ash',arm:'candidate'},
    {id:'h3',alias:'palm',arm:'candidate'},
    {id:'h4',alias:'plum',arm:'ordinary'}
  ];
  const queueRoster = [
    {id:'M17',alias:'Cedar',arm:'shared excerpts'},
    {id:'L42',alias:'Linden',arm:'coordinator and worker'}
  ];
  const authorCriteria = ['EX-retired','EX-current','FOH-target','FOH-notice','FOH-tie'].map(id=>({id,max:2}));
  const queueCriteria = ['target','observation','policy','control'].map(id=>({id,max:1}));
  if (JSON.stringify(authoring.scoringRubric.obligations.map(x=>x.id)) !== JSON.stringify(authorCriteria.map(x=>x.id)) ||
      JSON.stringify(Object.keys(queue.rubric).filter(x=>x!=='boundedEvidence')) !== JSON.stringify(queueCriteria.map(x=>x.id))) {
    throw new Error('Recorded rubric identity differs from this historical adapter');
  }
  const authorView = (grades, extract) => summarizeRecordedGrades({
    trials:authoring.trials,expected:authorRoster,armField:'method',criteria:authorCriteria,grades,extract
  });
  const primary = authorView(authoring.primaryBlindReview.grades, g=>({scores:g.scores,reportedTotal:g.total}));
  const independent = authorView(authoring.independentBlindReview.results, g=>{
    if (g.available === false) return null;
    if (g.available !== true) throw new Error('Independent availability is unknown');
    return {scores:Object.fromEntries(Object.entries(g.obligations).map(([id,v])=>[id,v.score])),reportedTotal:g.score};
  });
  const context = summarizeRecordedGrades({trials:queue.trials,expected:queueRoster,armField:'condition',
    criteria:queueCriteria,grades:queue.blindReview,
    extract:g=>({scores:Object.fromEntries(Object.entries(g).map(([id,v])=>[id,v.score]))})});
  return {status:'HISTORICAL_RECORDED_GRADES_ONLY',primaryNormalized:primary,independentRaw:independent,queueContext:context,
    limits:[
      'Separate rubrics and grading representations; no cross-study aggregate or causal claim.',
      'Unavailable grades are not observed failures; assigned denominators retain every assigned trial.',
      'No new model calls, runtime execution, independent regrading, approval or automatic skill activation.',
      'Defect recall, false-positive rate, root-cause accuracy, graph coverage, human effort, latency and recurrence remain UNKNOWN from these fixtures.'
    ]};
}

module.exports = {buildScorecard, summarizeRecordedGrades};
if (require.main === module) {
  const { readFileSync } = require('node:fs');
  const { join } = require('node:path');
  const load = name => JSON.parse(readFileSync(join(__dirname, name), 'utf8'));
  console.log(JSON.stringify(buildScorecard(load('zyra-proactive-authoring.json'), load('zyra-queue-context.json')), null, 2));
}
