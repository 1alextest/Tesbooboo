// From the repository root, with Node.js 24 and the backend's locked dependencies:
// npm ci --prefix Tesbo-Backend-Nest --ignore-scripts
// node docs/qa-orchestration/examples/replay-zyra-authoring.cjs
// This replays captured answers. It does not invoke a model or authorize a Task save.
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const path = require('node:path');

const backend = path.resolve(__dirname, '../../../Tesbo-Backend-Nest');
const backendRequire = createRequire(path.join(backend, 'package.json'));
backendRequire('ts-node').register({ project: path.join(backend, 'tsconfig.json'), transpileOnly: true });
backendRequire('reflect-metadata');
const { LegacyService } = backendRequire('./src/legacy/legacy.service.ts');
const evidence = JSON.parse(readFileSync(path.join(__dirname, 'zyra-proactive-authoring.json'), 'utf8'));

function digest(value) {
  const bytes = JSON.stringify(value, null, 2) + '\n';
  return 'sha256:' + createHash('sha256').update(bytes).digest('hex');
}

async function replay(trial) {
  // The native provider adapter uses fetch. Replace it only for this invocation and
  // reject any second request or unexpected destination, including from another tool.
  const originalFetch = globalThis.fetch;
  const baseUrl = 'http://127.0.0.1:1/v1';
  let calls = 0;
  try {
    globalThis.fetch = async (url, init) => {
      assert.equal(++calls, 1, trial.id + ': unexpected extra request');
      assert.equal(String(url), baseUrl + '/chat/completions');
      assert.equal(init.method, 'POST');
      const request = JSON.parse(init.body);
      assert.equal(digest(request.messages), trial.messagesDigest, trial.id + ': native messages changed');
      return Response.json({ choices: [{ message: { role: 'assistant', content: JSON.stringify(trial.originalReply) } }] });
    };

    const input = structuredClone(evidence.baseGenerationInput);
    if (trial.method === 'candidate') input.context += '\n\n' + evidence.candidateMethod;
    const result = await new LegacyService().generateZyraWithProvider({
      provider: 'evaluation-relay', model: 'blind-author-subject', apiKey: '',
      baseUrl, projectId: 'synthetic-pilot', input,
    });
    assert.equal(calls, 1, trial.id + ': provider was not called');
    assert.equal(result.drafts.length, 5, trial.id + ': expected five normalized drafts');
    assert.equal(digest(result.drafts), trial.normalizedDigest, trial.id + ': native normalized output changed');
    console.log(trial.id + ': verified original messages and ' + result.drafts.length + ' normalized drafts');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function main() {
  const { trials } = evidence;
  assert.equal(trials.length, 4);
  assert.equal(new Set(trials.map(trial => trial.id)).size, 4);
  assert.equal(trials.filter(trial => trial.method === 'candidate').length, 2);
  for (const trial of trials) {
    assert.ok(['baseline', 'ordinary', 'candidate'].includes(trial.method), 'Unknown trial method: ' + trial.method);
    await replay(trial);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
