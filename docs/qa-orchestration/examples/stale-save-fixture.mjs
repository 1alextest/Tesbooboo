// Disposable substitute for the application endpoint. Requires Node 24+.
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// Each trial is a unique marker in a fresh database. Query the actual
// persisted records for that marker through the independent read connection.
function readState(reader, id) {
  const context = reader.prepare(
    'SELECT project, task AS taskId, trial, revision FROM drafts WHERE trial = ?'
  ).get(id);
  const suites = reader.prepare('SELECT id FROM suites WHERE project = ? AND trial = ? ORDER BY id');
  const cases = reader.prepare('SELECT id FROM cases WHERE project = ? AND trial = ? ORDER BY id');
  return {
    ...context,
    suites: suites.all(context.project, id).map(row => row.id),
    cases: cases.all(context.project, id).map(row => row.id),
  };
}

function makeServer(writer, task, fixtureByTrial) {
  return createServer({ requestTimeout: 5000, headersTimeout: 5000 }, async (req, res) => {
    const id = /^\/trials\/(\d+)\/save$/.exec(req.url)?.[1];
    if (req.method !== 'POST' || !fixtureByTrial.has(id)) {
      res.writeHead(404).end();
      return;
    }
    try {
      let body = '';
      for await (const chunk of req) body += chunk;
      const { expectedProposalRevision } = JSON.parse(body);
      const { revision } = writer.prepare('SELECT revision FROM drafts WHERE trial = ?').get(id);
      if (expectedProposalRevision !== 'A' || expectedProposalRevision === revision) {
        res.writeHead(422).end('Fixture only accepts a stale A revision');
        return;
      }
      const mode = fixtureByTrial.get(id);
      if (mode === 'orphan-suite') {
        writer.prepare('INSERT INTO suites VALUES (?, ?, ?)').run(task.project, id, 'suite-under-test');
      }
      if (mode === 'orphan-case') {
        writer.prepare('INSERT INTO cases VALUES (?, ?, ?)').run(task.project, id, 'case-under-test');
      }
      res.writeHead(409).end();
    } catch {
      res.writeHead(500).end('Fixture error');
    }
  });
}

export async function collectObservations(task, assignments) {
  const resources = new AsyncDisposableStack();
  try {
    const folder = await mkdtemp(join(tmpdir(), 'tesbo-harness-'));
    resources.defer(() => rm(folder, { recursive: true, force: true }));
    const path = join(folder, 'fixture.sqlite');
    const writer = new DatabaseSync(path);
    resources.defer(() => writer.close());
    writer.exec(`
      CREATE TABLE drafts (project TEXT, task TEXT, trial TEXT PRIMARY KEY, revision TEXT);
      CREATE TABLE suites (project TEXT, trial TEXT, id TEXT);
      CREATE TABLE cases (project TEXT, trial TEXT, id TEXT);
    `);
    const reader = new DatabaseSync(path, { readOnly: true });
    resources.defer(() => reader.close());
    const byTrial = new Map(assignments.map(a => [a.id, a.fixture]));
    const server = makeServer(writer, task, byTrial);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    resources.defer(async () => {
      const closed = once(server, 'close');
      server.close();
      server.closeAllConnections();
      await closed;
    });

    const observations = [];
    for (const { id, fixture } of assignments) {
      writer.prepare('INSERT INTO drafts VALUES (?, ?, ?, ?)').run(task.project, task.id, id, 'A');
      const earlierRead = readState(reader, id);
      writer.prepare('UPDATE drafts SET revision = ? WHERE trial = ?').run(task.evaluatedRevision, id);
      const context = { project: task.project, taskId: task.id, trial: id, revision: task.evaluatedRevision };
      const url = 'http://127.0.0.1:' + server.address().port + '/trials/' + id + '/save';
      const request = { expectedProposalRevision: 'A' };
      const response = await fetch(url, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
        redirect: 'error', signal: AbortSignal.timeout(5000),
      });
      await response.arrayBuffer();
      let readback = null;
      if (fixture === 'other-revision') readback = earlierRead;
      else if (fixture !== 'readback-unavailable') readback = readState(reader, id);
      observations.push({ context, request, response: { status: response.status }, readback });
    }
    return observations;
  } finally {
    await resources.disposeAsync();
  }
}
