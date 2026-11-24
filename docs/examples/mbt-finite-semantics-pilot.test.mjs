import test from 'node:test';
import assert from 'node:assert/strict';
import { generate, initial, step, validate } from './mbt-finite-semantics-pilot.mjs';

const lit = value => ({ op: 'literal', value });
const variable = (name, scope = 'SHARED') => ({ op: 'var', scope, name });
const op = (op, ...args) => ({ op, args });
const effect = (name, expr, scope = 'SHARED') => ({ name, scope, expr });
const transition = (id, actor = 'A', extra = {}) => ({ id, actor, from: 'ready', to: 'ready', guard: lit(true), pre: lit(true), post: lit(true), effects: [], ...extra });
const reservation = () => ({ schema: 'MBT-FINITE-PILOT/1', semantics: 'SEQUENTIAL', actors: ['A', 'B'],
  variables: [{ id: 'remaining', scope: 'SHARED', type: 'integer', min: 0, max: 1, initial: 1 },
    { id: 'count', scope: 'ACTOR', type: 'integer', min: 0, max: 1, initial: 0 }],
  initialState: 'ready', states: [{ id: 'ready', invariant: lit(true) }],
  transitions: ['A', 'B'].map(a => transition(`reserve${a}`, a, { guard: op('gt', variable('remaining'), lit(0)),
    effects: [effect('remaining', op('sub', variable('remaining'), lit(1))), effect('count', op('add', variable('count', 'ACTOR'), lit(1)), 'ACTOR')] })) });
const approval = () => ({ schema: 'MBT-FINITE-PILOT/1', semantics: 'SEQUENTIAL', actors: ['author', 'reviewer'], variables: [], initialState: 'draft',
  states: ['draft', 'review', 'approved', 'rejected'].map(id => ({ id, invariant: lit(true) })),
  transitions: [transition('submit', 'author', { from: 'draft', to: 'review' }), transition('approve', 'reviewer', { from: 'review', to: 'approved' }), transition('reject', 'reviewer', { from: 'review', to: 'rejected' })] });
const budget = { maxWorkUnits: 64, maxDepth: 8, maxPaths: 32 };
const invalid = fn => assert.throws(fn, e => e.code === 'INVALID_MODEL');

test('reservation consumes the final unit and blocks sequential second actor', () => {
  const m = reservation(), before = initial(m), first = step(m, before, 'reserveA');
  assert.equal(first.outcome, 'FEASIBLE'); assert.equal(first.config.shared.remaining, 0);
  assert.equal(step(m, first.config, 'reserveB').outcome, 'INFEASIBLE');
  assert.equal(before.shared.remaining, 1); // Original configuration is immutable input.
});
test('actor-local effects do not alter the other actor', () => {
  const c = step(reservation(), initial(reservation()), 'reserveB').config;
  assert.deepEqual(c.actors, { A: { count: 0 }, B: { count: 1 } });
});
test('reset constructs a fresh baseline without rewriting old observations', () => {
  const m = reservation(), c = step(m, initial(m), 'reserveA').config;
  assert.equal(initial(m).shared.remaining, 1); assert.equal(c.shared.remaining, 0);
});
test('simultaneous assignments use pre-state rather than previous RHS updates', () => {
  const m = reservation(); m.variables = ['x', 'y'].map(id => ({ id, scope: 'SHARED', type: 'integer', min: 0, max: 2, initial: 0 }));
  m.transitions = [transition('update', 'A', { effects: [effect('x', lit(1)), effect('y', variable('x'))], post: op('eq', variable('y'), lit(0)) })];
  assert.deepEqual(step(m, initial(m), 'update').config.shared, { x: 1, y: 0 });
});
test('data-dependent second transition becomes feasible after update', () => {
  const m = reservation(); m.transitions = [transition('advance', 'A', { effects: [effect('remaining', lit(0))] }), transition('then', 'B', { guard: op('eq', variable('remaining'), lit(0)) })];
  assert.equal(step(m, initial(m), 'then').outcome, 'INFEASIBLE');
  assert.equal(step(m, step(m, initial(m), 'advance').config, 'then').outcome, 'FEASIBLE');
});
test('duplicate effects, malformed domains and out-of-domain values fail closed', () => {
  const m = reservation(); m.transitions[0].effects.push(m.transitions[0].effects[0]); invalid(() => validate(m));
  const n = reservation(); n.variables[0].max = Infinity; invalid(() => validate(n));
  const p = reservation(); p.transitions[0].effects[0].expr = lit(-1); invalid(() => step(p, initial(p), 'reserveA'));
});
test('unknown operators never become false guards or successful paths', () => {
  const m = reservation(); m.transitions[0].guard = { op: 'eval', args: [lit('process.exit()')] }; invalid(() => generate(m, budget));
});
test('expressions reject type confusion, excessive depth and undefined variables', () => {
  const m = reservation(); m.transitions[0].guard = op('gt', lit('1'), lit(0)); invalid(() => validate(m));
  m.transitions[0].guard = op('eq', variable('missing'), lit(1)); invalid(() => validate(m));
  let ast = lit(true); for (let i = 0; i < 18; i++) ast = op('not', ast);
  m.transitions[0].guard = ast; invalid(() => validate(m));
});
test('invalid transition and actor identities, dangling edges and source mismatch reject', () => {
  const m = approval(); m.transitions[0].to = 'missing'; invalid(() => validate(m));
  const n = reservation(); n.transitions[0].actor = 'foreign'; invalid(() => validate(n));
  invalid(() => step(approval(), initial(approval()), 'approve'));
});
test('input object tricks and unknown executable fields reject', () => {
  const m = reservation(); m.variables[0].id = '__proto__'; invalid(() => validate(m));
  const n = reservation(); n.transitions[0].script = 'unsafe'; invalid(() => validate(n));
});
test('initial/destination invariants and postconditions are not silent guard failures', () => {
  const m = approval(); m.states[0].invariant = lit(false); invalid(() => initial(m));
  const n = reservation(); n.transitions[0].post = lit(false); invalid(() => step(n, initial(n), 'reserveA'));
  const p = approval(); p.states[1].invariant = lit(false); invalid(() => step(p, initial(p), 'submit'));
});
test('foreign, missing or extra configuration valuations reject', () => {
  const m = reservation(), c = initial(m); c.shared.remaining = -1; invalid(() => step(m, c, 'reserveA'));
  const d = initial(m); delete d.actors.B; invalid(() => step(m, d, 'reserveA'));
  const e = initial(m); e.shared.extra = 0; invalid(() => step(m, e, 'reserveA'));
});
test('target concurrent/time semantics explicitly UNSUPPORTED, never sequentialized', () => {
  for (const semantics of ['CONCURRENT', 'TEMPORAL', 'EVENTUAL']) {
    const m = reservation(); m.semantics = semantics;
    assert.throws(() => generate(m, budget), e => e.code === 'UNSUPPORTED_SEMANTICS');
  }
});
test('deterministic generation includes values and actor-local state, not just state label', () => {
  const result = generate(reservation(), budget);
  assert.equal(result.status, 'COMPLETED'); assert.equal(result.paths.length, 2);
  assert.equal(result.workUnits, 6); // Both outgoing guards checked in all three configurations.
  assert.deepEqual(result.paths.map(p => p[0].transitionId), ['reserveA', 'reserveB']);
  assert.equal(result.evidenceTier, 'SYMBOLIC_ONLY'); assert.equal('verified' in result, false);
});
test('same inputs reproduce ordered logical manifest and digest', () => {
  const m = reservation(); assert.deepEqual(generate(m, budget), generate(structuredClone(m), { ...budget }));
  assert.notEqual(generate(m, budget).digest, generate(m, { ...budget, maxWorkUnits: 1 }).digest);
});
test('zero/limited work and path/depth bounds terminate visibly partial', () => {
  for (const [key, reason] of [['maxWorkUnits', 'MAX_WORK_UNITS'], ['maxDepth', 'MAX_DEPTH'], ['maxPaths', 'MAX_PATHS']]) {
    const result = generate(reservation(), { ...budget, [key]: 0 });
    assert.equal(result.status, 'PARTIAL'); assert.equal(result.stopReason, reason); assert.equal(result.paths.length, 0);
  }
  const partial = generate(reservation(), { ...budget, maxWorkUnits: 1 }); assert.equal(partial.workUnits, 1); assert.equal(partial.paths.length, 1);
});
test('invalid, uncapped and oversize budgets do not start traversal', () => {
  for (const value of [undefined, -1, NaN, Infinity, 1.5, 1000]) invalid(() => generate(reservation(), { ...budget, maxWorkUnits: value }));
  invalid(() => generate(reservation(), { ...budget, wallTime: 10 }));
});
test('second independent domain produces approval and rejection paths', () => {
  const m = approval(), result = generate(m, budget);
  assert.equal(result.status, 'COMPLETED'); assert.equal(result.workUnits, 3);
  assert.deepEqual(result.paths.map(p => p.map(s => s.transitionId)), [['submit'], ['submit', 'approve'], ['submit', 'reject']]);
  assert.equal(step(m, initial(m), 'submit').config.stateId, 'review');
});
test('finite cycles terminate through configuration dedupe without claiming exhaustive paths', () => {
  const m = approval(); m.transitions.push(transition('retry', 'author', { from: 'rejected', to: 'draft' }));
  const r = generate(m, budget); assert.equal(r.status, 'COMPLETED'); assert.equal(r.paths.length, 4); assert.equal(r.workUnits, 4);
});
test('known incorrect model and synthetic observation do not become expected truth', () => {
  const expected = { remaining: 0 }, bad = reservation(); bad.transitions[0].effects = [];
  const actual = step(bad, initial(bad), 'reserveA').config.shared;
  assert.notDeepEqual(actual, expected); // Hand-specified oracle, not derived from the defective model.
  const good = step(reservation(), initial(reservation()), 'reserveA').config.shared;
  assert.deepEqual(good, expected);
});
test('validation has finite caps and rejects duplicate IDs even on unreachable branches', () => {
  const m = approval(); m.transitions.push(structuredClone(m.transitions[1])); invalid(() => validate(m));
  const n = reservation(); n.actors = Array.from({ length: 5 }, (_, i) => `actor${i}`); invalid(() => validate(n));
});
test('boolean/enum finite domains and typed conjunctions retain explicit values', () => {
  const m = reservation(); m.variables = [{ id: 'allowed', scope: 'SHARED', type: 'boolean', values: [false, true], initial: true },
    { id: 'phase', scope: 'SHARED', type: 'string', values: ['new', 'used'], initial: 'new' }];
  m.transitions = [transition('consume', 'A', { guard: op('and', variable('allowed'), op('not', op('eq', variable('phase'), lit('used')))),
    effects: [effect('phase', lit('used')), effect('allowed', lit(false))] })];
  const c = step(m, initial(m), 'consume').config;
  assert.deepEqual(c.shared, { allowed: false, phase: 'used' });
  assert.equal(step(m, c, 'consume').outcome, 'INFEASIBLE');
});
test('manifest parameters cannot be changed by later caller mutation', () => {
  const limits = { ...budget }, r = generate(reservation(), limits); limits.maxWorkUnits = 0;
  assert.equal(r.limits.maxWorkUnits, budget.maxWorkUnits);
});
test('empty transition inventory completes without inventing a path or test result', () => {
  const m = reservation(); m.transitions = [];
  const r = generate(m, { maxWorkUnits: 0, maxPaths: 0, maxDepth: 0 });
  assert.equal(r.status, 'COMPLETED'); assert.equal(r.workUnits, 0); assert.deepEqual(r.paths, []);
  assert.equal(r.strategy, 'CONFIGURATION_REACHABILITY');
});
