// Run with node --test docs/qa-orchestration/examples/score-zyra-authoring.test.cjs
const assert = require('node:assert/strict');
const test = require('node:test');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { buildScorecard } = require('./score-zyra-authoring.cjs');

const load = name => JSON.parse(readFileSync(join(__dirname, name), 'utf8'));
const author = () => load('zyra-proactive-authoring.json');
const queue = () => load('zyra-queue-context.json');
const arm = (view, name) => view.arms.find(x => x.arm === name);
const totals = view => view.arms.map(x => [x.arm, x.pointsEarned, x.assignedPointsPossible]);

test('reconstruct historical primary and independent grading without pooling', () => {
  const result = buildScorecard(author(), queue());
  assert.equal(result.status, 'HISTORICAL_RECORDED_GRADES_ONLY');
  assert.deepEqual(totals(result.primaryNormalized), [['ordinary',18,20],['candidate',18,20]]);
  assert.deepEqual(totals(result.independentRaw), [['ordinary',17,20],['candidate',18,20]]);
  assert.deepEqual(totals(result.queueContext), [['shared excerpts',4,4],['coordinator and worker',4,4]]);
  assert.equal(result.primaryNormalized.arms.every(a => a.assigned===2 && a.graded===2), true);
});

test('preserve the common partial notification obligation rather than count it as fully met', () => {
  const result = buildScorecard(author(),queue());
  for (const a of result.primaryNormalized.arms) {
    assert.deepEqual(a.obligations.find(x=>x.id==='FOH-notice'),
      {id:'FOH-notice',full:0,partial:2,zero:0,ungraded:0});
  }
});

test('absent assigned grade stays in denominator and is not an observed zero', () => {
  const a = author();
  delete a.primaryBlindReview.grades.ash;
  const result = buildScorecard(a,queue());
  const x = arm(result.primaryNormalized,'candidate');
  assert.deepEqual([x.assigned,x.graded,x.unavailable,x.pointsEarned,x.assignedPointsPossible,x.gradedPointsPossible],
    [2,1,1,9,20,10]);
  assert.deepEqual(x.obligations.find(v=>v.id==='FOH-notice'),
    {id:'FOH-notice',full:0,partial:1,zero:0,ungraded:1});
  assert.deepEqual(result.primaryNormalized.rows.find(r=>r.id==='h2'),
    {id:'h2',arm:'candidate',status:'UNAVAILABLE',scores:null,total:null});
});

test('explicitly unavailable independent grade remains ungraded', () => {
  const a = author();
  a.independentBlindReview.results.ash = {available:false};
  const x = arm(buildScorecard(a,queue()).independentRaw,'candidate');
  assert.deepEqual([x.assigned,x.graded,x.pointsEarned,x.assignedPointsPossible],[2,1,9,20]);
});

test('an observed zero is different from unavailable', () => {
  const a = author();
  a.primaryBlindReview.grades.ash.scores['FOH-notice']=0;
  a.primaryBlindReview.grades.ash.total=8;
  const x = arm(buildScorecard(a,queue()).primaryNormalized,'candidate');
  assert.deepEqual(x.obligations.find(v=>v.id==='FOH-notice'),
    {id:'FOH-notice',full:0,partial:1,zero:1,ungraded:0});
});

test('reject reassigned arms, removed or duplicated assignments, unexpected aliases', () => {
  let a=author(); a.trials[0].method='candidate';
  assert.throws(()=>buildScorecard(a,queue()),/frozen roster/);
  a=author(); a.trials.pop();
  assert.throws(()=>buildScorecard(a,queue()),/assignment/);
  a=author(); a.trials[1]=a.trials[0];
  assert.throws(()=>buildScorecard(a,queue()),/frozen roster/);
  a=author(); a.primaryBlindReview.grades.extra=a.primaryBlindReview.grades.ash;
  assert.throws(()=>buildScorecard(a,queue()),/Unexpected grade/);
});

test('reject incorrect totals, missing obligations and out-of-range scores', () => {
  let a=author(); a.primaryBlindReview.grades.ash.total=10;
  assert.throws(()=>buildScorecard(a,queue()),/Inconsistent recorded total/);
  a=author(); delete a.primaryBlindReview.grades.ash.scores['FOH-tie'];
  assert.throws(()=>buildScorecard(a,queue()),/incomplete rubric/);
  a=author(); a.primaryBlindReview.grades.ash.scores['EX-retired']=3;
  assert.throws(()=>buildScorecard(a,queue()),/incomplete rubric/);
  a=author(); a.independentBlindReview.results.ash.available=null;
  assert.throws(()=>buildScorecard(a,queue()),/availability/);
});

test('reject changed rubric inventory', () => {
  const q=queue(); delete q.rubric.control;
  assert.throws(()=>buildScorecard(author(),q),/rubric identity/);
});
