/** Offline executable specification. No Tesbo/target IO, authorization or product integration. */
import { createHash } from 'node:crypto';

export class ModelError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const fail = (message, code = 'INVALID_MODEL') => { throw new ModelError(code, message); };
const utf8 = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b));
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const id = value => typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value);
const integer = value => Number.isSafeInteger(value);
const scalar = value => typeof value === 'boolean' || integer(value) || (typeof value === 'string' && value.length <= 128);
const exact = (value, keys) => {
  if (!object(value) || Object.keys(value).some(key => !keys.includes(key))) fail('Unknown or malformed field');
};
const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
  : object(value) ? `{${Object.keys(value).sort(utf8).map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
    : JSON.stringify(value);
const digest = value => createHash('sha256').update(canonical(value)).digest('hex');
const lookup = (model, scope, name) => model.variables.find(v => v.scope === scope && v.id === name);
const domainContains = (definition, value) => definition.type === 'integer'
  ? integer(value) && value >= definition.min && value <= definition.max
  : definition.values.includes(value);

function expressionType(ast, model, depth = 0, counter = { nodes: 0 }) {
  if (++counter.nodes > 128 || depth > 16) fail('Expression exceeds pilot bounds');
  if (!object(ast)) fail('Expressions must be declarative AST objects');
  if (ast.op === 'literal') {
    exact(ast, ['op', 'value']);
    if (!scalar(ast.value)) fail('Invalid literal');
    return typeof ast.value === 'number' ? 'number' : typeof ast.value;
  }
  if (ast.op === 'var') {
    exact(ast, ['op', 'scope', 'name']);
    const variable = lookup(model, ast.scope, ast.name);
    if (!variable) fail('Undefined scoped variable');
    return variable.type === 'integer' ? 'number' : variable.type;
  }
  const arity = { eq: 2, gt: 2, lt: 2, add: 2, sub: 2, and: 2, not: 1 }[ast.op];
  if (!arity) fail('Unsupported expression operator');
  exact(ast, ['op', 'args']);
  if (!Array.isArray(ast.args) || ast.args.length !== arity) fail('Invalid expression arity');
  const types = ast.args.map(a => expressionType(a, model, depth + 1, counter));
  if (ast.op === 'eq') { if (types[0] !== types[1]) fail('Equality type mismatch'); return 'boolean'; }
  if (['and', 'not'].includes(ast.op)) {
    if (types.some(t => t !== 'boolean')) fail('Boolean expression required');
    return 'boolean';
  }
  if (types.some(t => t !== 'number')) fail('Numeric expression required');
  return ['add', 'sub'].includes(ast.op) ? 'number' : 'boolean';
}

function evaluate(ast, config, actor) {
  if (ast.op === 'literal') return ast.value;
  if (ast.op === 'var') return ast.scope === 'SHARED' ? config.shared[ast.name] : config.actors[actor][ast.name];
  const args = ast.args.map(a => evaluate(a, config, actor));
  const operations = {
    eq: () => args[0] === args[1], gt: () => args[0] > args[1], lt: () => args[0] < args[1],
    add: () => args[0] + args[1], sub: () => args[0] - args[1],
    and: () => args[0] && args[1], not: () => !args[0],
  };
  const result = operations[ast.op]();
  if (typeof result === 'number' && !integer(result)) fail('Unsafe arithmetic');
  return result;
}

export function validate(model) {
  exact(model, ['schema', 'semantics', 'actors', 'variables', 'states', 'initialState', 'transitions']);
  if (model.semantics !== 'SEQUENTIAL') fail('Temporal/concurrent generation is unsupported', 'UNSUPPORTED_SEMANTICS');
  if (model.schema !== 'MBT-FINITE-PILOT/1') fail('Unsupported pilot schema');
  for (const [key, cap, allowEmpty] of [['actors', 4, false], ['variables', 8, true], ['states', 16, false], ['transitions', 32, true]]) {
    if (!Array.isArray(model[key]) || model[key].length > cap || (!allowEmpty && !model[key].length)) fail(`Invalid ${key} cardinality`);
  }
  if (model.actors.some(a => !id(a)) || new Set(model.actors).size !== model.actors.length) fail('Invalid/duplicate actor');
  const variables = new Set();
  for (const v of model.variables) {
    exact(v, ['id', 'scope', 'type', 'min', 'max', 'values', 'initial']);
    if (!id(v.id) || !['SHARED', 'ACTOR'].includes(v.scope) || variables.has(`${v.scope}:${v.id}`)) fail('Invalid/duplicate variable');
    variables.add(`${v.scope}:${v.id}`);
    if (v.type === 'integer') {
      if ('values' in v || !integer(v.min) || !integer(v.max) || v.min > v.max || v.max - v.min > 16) fail('Integer domain must be finite and bounded');
    } else if (['boolean', 'string'].includes(v.type)) {
      if ('min' in v || 'max' in v || !Array.isArray(v.values) || !v.values.length || v.values.length > 16
        || v.values.some(x => !scalar(x) || typeof x !== v.type) || new Set(v.values).size !== v.values.length) fail('Invalid finite domain');
    } else fail('Unsupported variable type');
    if (!domainContains(v, v.initial)) fail('Initial value outside domain');
  }
  const states = new Set();
  for (const state of model.states) {
    exact(state, ['id', 'invariant']);
    if (!id(state.id) || states.has(state.id)) fail('Invalid/duplicate state');
    states.add(state.id);
    if (expressionType(state.invariant, model) !== 'boolean') fail('State invariant must be boolean');
  }
  if (!states.has(model.initialState)) fail('Missing initial state');
  const transitions = new Set();
  for (const t of model.transitions) {
    exact(t, ['id', 'from', 'to', 'actor', 'guard', 'pre', 'post', 'effects']);
    if (!id(t.id) || transitions.has(t.id) || !states.has(t.from) || !states.has(t.to) || !model.actors.includes(t.actor)) fail('Invalid transition identity/endpoint/actor');
    transitions.add(t.id);
    for (const ast of [t.guard, t.pre, t.post]) if (expressionType(ast, model) !== 'boolean') fail('Transition predicate must be boolean');
    if (!Array.isArray(t.effects) || t.effects.length > 8) fail('Invalid effects');
    const targets = new Set();
    for (const effect of t.effects) {
      exact(effect, ['scope', 'name', 'expr']);
      const v = lookup(model, effect.scope, effect.name), key = `${effect.scope}:${effect.name}`;
      if (!v || targets.has(key)) fail('Undefined/duplicate assignment');
      targets.add(key);
      if (expressionType(effect.expr, model) !== (v.type === 'integer' ? 'number' : v.type)) fail('Assignment type mismatch');
    }
  }
  return true;
}

function initialUnchecked(model) {
  const select = scope => Object.fromEntries(model.variables.filter(v => v.scope === scope).map(v => [v.id, v.initial]));
  const config = { stateId: model.initialState, shared: select('SHARED'), actors: Object.fromEntries(model.actors.map(a => [a, select('ACTOR')])) };
  const initial = model.states.find(s => s.id === config.stateId);
  if (model.actors.some(actor => !evaluate(initial.invariant, config, actor))) fail('Initial invariant fails');
  return config;
}
export function initial(model) { validate(model); return initialUnchecked(model); }

function stepUnchecked(model, config, transition) {
  if (config.stateId !== transition.from) fail('Transition source mismatch');
  const actor = transition.actor, source = model.states.find(s => s.id === config.stateId);
  if (!evaluate(source.invariant, config, actor)) fail('Source invariant fails');
  if (!evaluate(transition.pre, config, actor) || !evaluate(transition.guard, config, actor)) return { outcome: 'INFEASIBLE' };
  // All RHS expressions read the SAME pre-state, including assignments to actor-local values.
  const assignments = transition.effects.map(e => ({ ...e, value: evaluate(e.expr, config, actor) }));
  const candidate = structuredClone(config);
  for (const a of assignments) {
    if (!domainContains(lookup(model, a.scope, a.name), a.value)) fail('Effect outside variable domain');
    if (a.scope === 'SHARED') candidate.shared[a.name] = a.value;
    else candidate.actors[actor][a.name] = a.value;
  }
  candidate.stateId = transition.to;
  if (!evaluate(model.states.find(s => s.id === candidate.stateId).invariant, candidate, actor)) fail('Destination invariant fails');
  if (!evaluate(transition.post, candidate, actor)) fail('Postcondition fails');
  return { outcome: 'FEASIBLE', config: candidate };
}

export function step(model, config, transitionId) {
  validate(model);
  // This pilot accepts only configurations previously constructed by itself or equivalent JSON.
  exact(config, ['stateId', 'shared', 'actors']);
  if (!model.states.some(s => s.id === config.stateId)) fail('Unknown configuration state');
  exact(config.shared, model.variables.filter(v => v.scope === 'SHARED').map(v => v.id));
  exact(config.actors, model.actors);
  for (const actor of model.actors) exact(config.actors[actor], model.variables.filter(v => v.scope === 'ACTOR').map(v => v.id));
  for (const v of model.variables) {
    const values = v.scope === 'SHARED' ? [config.shared[v.id]] : model.actors.map(a => config.actors[a][v.id]);
    if (values.some(value => !domainContains(v, value))) fail('Invalid configuration valuation');
  }
  const t = model.transitions.find(t => t.id === transitionId);
  if (!t) fail('Unknown transition');
  return stepUnchecked(model, config, t);
}

export function generate(model, limits) {
  validate(model);
  exact(limits, ['maxWorkUnits', 'maxDepth', 'maxPaths']);
  for (const [key, cap] of [['maxWorkUnits', 256], ['maxDepth', 32], ['maxPaths', 64]]) {
    if (!integer(limits[key]) || limits[key] < 0 || limits[key] > cap) fail('Invalid logical budget');
  }
  const start = initialUnchecked(model), queue = [{ config: start, path: [] }], seen = new Set([canonical(start)]), paths = [];
  const transitions = [...model.transitions].sort((a, b) => utf8(a.id, b.id));
  let work = 0, stopReason = 'EXHAUSTED';
  outer: while (queue.length) {
    const current = queue.shift(), candidates = transitions.filter(t => t.from === current.config.stateId);
    if (candidates.length && current.path.length >= limits.maxDepth) { stopReason = 'MAX_DEPTH'; break; }
    for (const t of candidates) {
      if (work >= limits.maxWorkUnits) { stopReason = 'MAX_WORK_UNITS'; break outer; }
      if (paths.length >= limits.maxPaths) { stopReason = 'MAX_PATHS'; break outer; }
      work++;
      const result = stepUnchecked(model, current.config, t);
      if (result.outcome === 'INFEASIBLE') continue;
      const path = [...current.path, { transitionId: t.id, actor: t.actor, config: result.config }];
      paths.push(path);
      const key = canonical(result.config);
      if (!seen.has(key)) { seen.add(key); queue.push({ config: result.config, path }); }
    }
  }
  const logical = { schema: 'MBT-PILOT-MANIFEST/1', engine: 'finite-semantics-pilot/1', strategy: 'CONFIGURATION_REACHABILITY', modelDigest: digest(model), limits: structuredClone(limits),
    status: stopReason === 'EXHAUSTED' ? 'COMPLETED' : 'PARTIAL', stopReason, workUnits: work, paths, evidenceTier: 'SYMBOLIC_ONLY' };
  return { ...logical, digest: digest(logical) };
}
