/** Synthetic transport fixtures. These are never production review/approval records. */
import { CONTRACT, PROVENANCE, canonicalJson, inputManifestDigest, parsePolicy, readLocalPolicy,
  recordBody, sha256 } from './assurance-pr-gate.mjs';

export const fixtureRepository = 'owner/tesbo';
export const fixtureHead = 'a'.repeat(40);
export const fixtureBase = 'b'.repeat(40);
export const fixtureSource = 'c'.repeat(40);
export const fixturePolicyRaw = readLocalPolicy();

export function nativeReview(id, body, extra = {}) {
  return { id, node_id: `review-${id}`, body, state: 'COMMENTED', commit_id: fixtureHead,
    submitted_at: `2026-11-22T00:00:${String(id).padStart(2, '0')}Z`,
    user: { id: 42, login: 'owner', type: 'User' }, editVerified: true, lastEditedAt: null, ...extra };
}
export function subject(snapshot) {
  return { repositoryId: snapshot.repository.id, prNumber: snapshot.pr.number,
    headSha: snapshot.pr.head.sha, baseSha: snapshot.pr.base.sha, policySha: snapshot.policySha };
}
export function fixtureSnapshot() {
  const snapshot = { repository: { id: 7, full_name: fixtureRepository, default_branch: 'main',
    owner: { id: 42, login: 'owner', type: 'User' } },
  pr: { number: 7, state: 'open', draft: false, changed_files: 1, user: { id: 42, login: 'owner' },
    head: { sha: fixtureHead }, base: { sha: fixtureBase, ref: 'development', repo: { id: 7 } } },
  files: [{ filename: 'docs/specs/agent-synchronized-engineering/requirements.md', status: 'modified', sha: 'd'.repeat(40) }],
  reviews: [], policy: parsePolicy(fixturePolicyRaw), policySha: fixtureSource,
  policyDigest: sha256(fixturePolicyRaw) };
  return installReceipts(snapshot);
}
export function installReceipts(snapshot, changes = {}) {
  const common = { contract: CONTRACT, subject: subject(snapshot), implementationInvocationId: 'implementation-actual-id',
    inputManifestSha256: inputManifestDigest(snapshot), coveredPaths: snapshot.files.flatMap(file => [file.filename, file.previous_filename].filter(Boolean)),
    method: { name: 'synthetic-fixture-only', revision: 'fixture-revision', sha256: sha256('synthetic method') },
    limits: ['Synthetic data tests validation only; no actual AI, human review or product execution.'] };
  const independentOutput = 'Synthetic original Independent result for transport tests.';
  const independent = { ...common, role: 'INDEPENDENT', invocationId: 'independent-actual-id', disposition: 'reviewed',
    output: { text: independentOutput, sha256: sha256(independentOutput) }, ...changes.independent };
  const independentReview = nativeReview(11, recordBody('receipt', independent));
  const whiteOutput = 'Synthetic original White result, after reading the Independent fixture.';
  const white = { ...common, role: 'WHITE', invocationId: 'white-actual-id', disposition: 'admit_scope',
    output: { text: whiteOutput, sha256: sha256(whiteOutput) },
    independentReceiptSha256: sha256(independentReview.body), ...changes.white };
  const whiteReview = nativeReview(12, recordBody('receipt', white));
  const imported = { contract: CONTRACT, subject: subject(snapshot), provenance: PROVENANCE,
    attestation: 'observed-distinct-worker-outputs', receipts: [
      { role: 'INDEPENDENT', reviewId: 11, bodySha256: sha256(independentReview.body) },
      { role: 'WHITE', reviewId: 12, bodySha256: sha256(whiteReview.body) },
    ], ...changes.imported };
  snapshot.reviews = [independentReview, whiteReview, nativeReview(13, recordBody('import', imported))];
  return snapshot;
}
export function revoke(snapshot, id = 14) {
  snapshot.reviews.push(nativeReview(id, recordBody('revoke', {
    contract: CONTRACT, subject: subject(snapshot), importReviewId: 13, reason: 'Synthetic withdrawal control.',
  })));
}

export async function withGitHub(options, action) {
  const original = globalThis.fetch;
  const snapshot = options.snapshot ?? fixtureSnapshot();
  const policyRaw = options.policyRaw ?? fixturePolicyRaw;
  const checks = [];
  const requests = [];
  let captures = 0;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input);
    const method = init.method ?? 'GET';
    requests.push({ url: String(input), method });
    if (options.deny?.({ url, method, captures })) return { ok: false, status: 403 };
    let data;
    if (url.pathname === '/graphql') {
      const ids = JSON.parse(init.body).variables.ids;
      data = { data: { nodes: ids.map(id => {
        const review = snapshot.reviews.find(item => item.node_id === id);
        return review ? { id, body: review.body, state: review.state, lastEditedAt: review.lastEditedAt,
          commit: { oid: review.commit_id }, pullRequest: { number: 7, repository: { nameWithOwner: fixtureRepository } } } : null;
      }) } };
      if (options.graphqlError) data = { errors: [{ message: 'Synthetic API denial' }] };
    } else {
      const suffix = url.pathname.slice(`/repos/${fixtureRepository}`.length);
      if (url.hostname !== 'api.github.com' || !url.pathname.startsWith(`/repos/${fixtureRepository}`)) throw new Error('Unexpected fixture host/repository');
      if (suffix === '' || suffix === '/') {
        captures++;
        options.beforeCapture?.(captures, snapshot);
        data = snapshot.repository;
      } else if (suffix === '/git/ref/heads/main') data = { object: { sha: snapshot.policySha } };
      else if (suffix === `/git/ref/heads/${encodeURIComponent(snapshot.pr.base.ref)}`) data = { object: { sha: options.actualBaseSha ?? snapshot.pr.base.sha } };
      else if (suffix === '/contents/.github/assurance-policy.json') data = { type: 'file', encoding: 'base64',
        content: Buffer.from(policyRaw).toString('base64') };
      else if (suffix === '/pulls/7') data = snapshot.pr;
      else if (suffix === '/pulls/7/files') data = snapshot.files;
      else if (suffix === '/pulls/7/reviews') data = snapshot.reviews;
      else if (suffix === '/pulls') data = options.openPRs ?? [{ number: 7 }];
      else if (suffix === '/check-runs' && method === 'POST') {
        const payload = JSON.parse(init.body);
        data = { id: 1000 + checks.length, ...payload };
        checks.push({ method, ...data });
        options.afterCreate?.(snapshot, data);
      } else if (/^\/check-runs\/\d+$/.test(suffix) && method === 'PATCH') {
        const id = Number(suffix.split('/').at(-1));
        const previous = checks.find(check => check.id === id);
        data = { ...previous, ...JSON.parse(init.body), id };
        checks.push({ ...data, method });
      } else throw new Error(`Unexpected fixture endpoint: ${method} ${suffix}`);
    }
    const copied = JSON.parse(JSON.stringify(data));
    return { ok: true, json: async () => copied };
  };
  try { return await action({ snapshot, checks, requests, getCaptures: () => captures }); }
  finally { globalThis.fetch = original; }
}
export const gateOptions = () => ({ repository: fixtureRepository, prNumber: 7,
  token: 'synthetic-test-token', sourceSha: fixtureSource, policyRaw: fixturePolicyRaw });
export const rewriteRecord = (review, kind, change) => {
  const body = JSON.parse(review.body.slice(review.body.indexOf('\n') + 1));
  change(body);
  review.body = recordBody(kind, body);
};
export const copied = value => JSON.parse(canonicalJson(value));
