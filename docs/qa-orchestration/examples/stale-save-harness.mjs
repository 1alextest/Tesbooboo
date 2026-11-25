// Run: node stale-save-harness.mjs  (Node 24+, no packages, loopback only)
import assert from 'node:assert/strict';
import { collectObservations } from './stale-save-fixture.mjs';

// Frozen assignments and independent answer key. A and B are different
// review revisions of the same proposal. B is current during each trial.
const task = { id: 'TASK-17', project: 'DEMO', evaluatedRevision: 'B' };
const assignments = [
  { id: '01', fixture: 'clean', expected: 'accept' },
  { id: '02', fixture: 'orphan-suite', expected: 'reject' },
  { id: '03', fixture: 'orphan-case', expected: 'reject' },
  { id: '04', fixture: 'readback-unavailable', expected: 'ungraded' },
  { id: '05', fixture: 'other-revision', expected: 'ungraded' },
];

// Editing or adding one entry changes the assertions under comparison. These
// functions receive observations only. They never see fixture names or the key.
const checks = {
  'HTTP 409 only': ({ response }) => response.status === 409,
  '409 + stored state': ({ response, readback }) =>
    response.status === 409 && readback.suites.length === 0 && readback.cases.length === 0,
};

function evidenceProblem({ context, readback }) {
  if (!readback) return 'missing state readback';
  for (const field of Object.keys(context)) {
    if (readback[field] !== context[field]) return 'readback differs on ' + field;
  }
  return null;
}

function grade(check, record, expected) {
  const problem = evidenceProblem(record);
  if (problem) return { decision: 'ungraded', reason: problem };
  const decision = check(record) ? 'accept' : 'reject';
  if (decision === expected) return { decision, reason: 'correct' };
  return { decision, reason: decision === 'accept' ? 'missed fault' : 'false block' };
}

const observations = await collectObservations(task, assignments);
assert.ok(observations.every(record => record.response.status === 409), 'Each fixture must return HTTP 409');
const results = Object.entries(checks).map(([name, check]) => {
  const trials = observations.map((record, i) => ({
    trial: record.context.trial,
    ...grade(check, record, assignments[i].expected),
  }));
  const correct = trials.filter(t => t.reason === 'correct').length;
  const graded = trials.filter(t => t.decision !== 'ungraded').length;
  return { name, assigned: trials.length, graded, correct, trials };
});

// Smoke expectations for this example. An unexpected change exits nonzero.
assert.deepEqual(results.map(r => [r.assigned, r.graded, r.correct]), [[5, 3, 1], [5, 3, 3]]);
assert.deepEqual(results[1].trials.map(t => t.decision), assignments.map(a => a.expected));
assert.deepEqual(results[0].trials.slice(1, 3).map(t => t.reason), ['missed fault', 'missed fault']);

// This is a proposed reviewer finding. Only the existing application can
// accept a human selection and apply it at the exact reviewed revision.
function reviewDisposition(currentRevision) {
  if (currentRevision !== task.evaluatedRevision) return 'rerun on current revision';
  return 'ready for human review';
}
const finding = {
  task: task.id,
  evaluatedRevision: task.evaluatedRevision,
  proposal: 'After the 409, verify zero matching new suites and test cases in the project.',
  reviewAtB: reviewDisposition('B'),
  reviewAtC: reviewDisposition('C'),
};
assert.equal(finding.reviewAtC, 'rerun on current revision');
console.log(JSON.stringify({ observations, results, finding }, null, 2));
