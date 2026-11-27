import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { HARNESS_REVISION, readInvestigationMapping } from './qa-investigation-mapping.mjs'

const harnessRoot = process.env.QA_INVESTIGATION_HARNESS_ROOT
const optional = { skip: harnessRoot ? false : 'set QA_INVESTIGATION_HARNESS_ROOT to the pinned checkout for upstream contract tests' }
const id = 'CASE-300'
const targetPath = 'tests/filter.spec.ts'
const riskFile = 'qa-artifacts/' + id + '/risks.md'
const investigationFile = 'qa-artifacts/' + id + '/investigation.md'
const modelFile = 'qa-artifacts/' + id + '/flow-model.md'
const planFile = 'specs/' + id + '.plan.md'
const oracle = 'Only matching tasks are returned'
const model = '# Recorded observation\nFiltered list retains only matching tasks.\n'
const modelHash = createHash('sha256').update(model).digest('hex')

function git(root, ...args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trimEnd()
}

async function temp(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'tesbo-mapping-test-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  return root
}

function commit(root) {
  git(root, 'add', '-A')
  git(root, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgSign=false',
    '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'Synthetic investigation snapshot')
  return git(root, 'rev-parse', 'HEAD')
}

async function project(t) {
  const root = await temp(t)
  git(root, 'init', '-q')
  for (const file of [targetPath, riskFile, investigationFile, planFile]) {
    const source = git(harnessRoot, 'cat-file', 'blob', HARNESS_REVISION + ':qa-harness/fixtures/run-report/' + file)
    await mkdir(path.dirname(path.join(root, file)), { recursive: true })
    await writeFile(path.join(root, file), source + '\n')
  }
  await writeFile(path.join(root, modelFile), model)
  await edit(root, riskFile, text => text.replace('R1 revision 1; exact oracle in row above', 'Risk: The list may show a stale result; Oracle: ' + oracle)
    .replace('flow-model.md@2026-11-11', 'flow-model.md@sha256:' + modelHash))
  const repoRevision = commit(root)
  return { harnessRoot, repoRoot: root, repoRevision, investigationId: id, upstreamCase: 'TC-01', targetPath }
}

async function edit(root, file, apply) {
  const filename = path.join(root, file)
  const before = await readFile(filename, 'utf8')
  const after = apply(before)
  assert.notEqual(after, before, 'the test must change the intended upstream input')
  await writeFile(filename, after)
}

test('rejects unsafe or non-spec paths and malformed identities before opening a repository', async () => {
  for (const candidate of ['/tests/case.spec.ts', '../tests/case.spec.ts', 'C:\\case.spec.ts', 'tests/.git/case.spec.ts',
    'tests/./a.spec.ts', 'tests/one\n.spec.ts', 'tests/fixture.js']) {
    await assert.rejects(readInvestigationMapping({ investigationId: id, upstreamCase: 'TC-01', targetPath: candidate }), /spec path/)
  }
  await assert.rejects(readInvestigationMapping({ investigationId: '../scope', upstreamCase: 'TC-01', targetPath }), /investigation ID/)
  await assert.rejects(readInvestigationMapping({ investigationId: id, upstreamCase: 'all', targetPath }), /TC ID/)
})

test('refuses an upstream checkout with a different commit', async t => {
  const root = await temp(t)
  git(root, 'init', '-q')
  await writeFile(path.join(root, 'plain'), 'fixture')
  commit(root)
  await assert.rejects(readInvestigationMapping({ harnessRoot: root, repoRoot: root, investigationId: id, upstreamCase: 'TC-01', targetPath }), /reviewed revision/)
})

test('exports one current upstream fixture case and its exact oracle without executing mapped source', optional, async t => {
  const config = await project(t)
  await writeFile(path.join(config.repoRoot, targetPath), 'throw new Error("generator target is data only")\n')
  await edit(config.repoRoot, planFile, text => text + '\n### TC-02: A different case\n**Steps:** Do not export.\n')
  config.repoRevision = commit(config.repoRoot)
  const result = await readInvestigationMapping(config)
  assert.equal(result.upstreamCase, 'TC-01')
  assert.equal(result.targetPath, targetPath)
  assert.equal(result.targetBlob, git(config.repoRoot, 'rev-parse', 'HEAD:' + targetPath))
  assert.equal(result.repoRevision, config.repoRevision)
  assert.equal(result.harnessRevision, HARNESS_REVISION)
  assert.equal(result.plan.title, 'Filter tasks')
  assert.match(result.plan.section, /Filter tasks/)
  assert.doesNotMatch(result.plan.section, /TC-02|Do not export/)
  assert.equal(result.risks[0].oracle, oracle)
  assert.equal(result.risks[0].observableFromBrowser, 'yes')
  assert.equal(result.risks[0].requirements[0].id, 'C1')
  assert.equal(result.risks[0].decisionId, 'D1')
  assert.deepEqual(result.risks[0].dependencies, [{ file: modelFile, sha256: modelHash }])
  assert.deepEqual(await readInvestigationMapping(config), result)
  assert.equal(git(config.repoRoot, 'status', '--porcelain'), '')
})

test('uses immutable consumer and upstream blobs despite dirty working files', optional, async t => {
  const config = await project(t)
  const localHarness = await temp(t)
  git(localHarness, 'clone', '-q', '--local', harnessRoot, '.')
  config.harnessRoot = localHarness
  const before = await readInvestigationMapping(config)
  await writeFile(path.join(localHarness, 'qa-harness/checks/coverage-report.mjs'), 'throw Error("working checker executed")')
  await writeFile(path.join(config.repoRoot, planFile), 'Unreviewed local edit')
  assert.deepEqual(await readInvestigationMapping(config), before)
})

test('accepts the Stage 3B format with a wrapped action and exact wrapped expectation', optional, async t => {
  const config = await project(t)
  await edit(config.repoRoot, planFile, () => [
    '# Investigation', '#### 1.1. TC-01: Filter tasks', '', '**File:** `' + targetPath + '`', '', '**Steps:**',
    '  1. Submit the filter', '     and refresh.', '    - expect: Only matching', '      tasks are returned.', '',
  ].join('\n'))
  config.repoRevision = commit(config.repoRoot)
  const output = await readInvestigationMapping(config)
  assert.equal(output.risks[0].observableFromBrowser, 'yes')
  assert.deepEqual(output.plan.gaps, [])
})

const refusals = [
  ['non-browser oracle', riskFile, text => text.replace('| yes | APPROVED |', '| no | APPROVED |'), /independent evidence reader/],
  ['partial browser observability', riskFile, text => text.replace('| yes | APPROVED |', '| partial | APPROVED |'), /independent evidence reader/],
  ['explicit evidence gap', planFile, text => text + '\n - expect: GAP — A database reader is required.\n', /evidence gap/],
  ['step header without an action', planFile, text => text.replace('**Steps:** Filter tasks.', '**Steps:**'), /concrete action/],
  ['expectations disguised as steps', planFile, text => text.replace('**Steps:** Filter tasks.', '**Steps:**\n  - expect: ' + oracle), /concrete action/],
  ['changed wrapped assertion', planFile, text => text + '  except where the filter is ignored.\n', /reviewed oracle/],
  ['changed evidence', modelFile, text => text + 'Different observed state.\n', /current mapping/],
  ['unusable date-only freshness', riskFile, text => text.replace('sha256:' + modelHash, '2026-11-11'), /current mapping/],
  ['pending decision', riskFile, text => text.replace('D1 | R1 | APPROVED', 'D1 | R1 | PROPOSED'), /current mapping/],
  ['noncanonical decision', riskFile, text => text.replace('D1 | R1 | APPROVED', 'D1 | R1 | APPROVED_PENDING'), /explicit approval/],
  ['conflicting risk and decision', riskFile, text => text.replace('| yes | APPROVED |', '| yes | REJECTED |'), /explicit approval/],
  ['ambiguous case mapping', riskFile, text => text.replace('| R1 | TC-01 | tests/filter.spec.ts |',
    '| R1 | TC-01 | tests/filter.spec.ts |\n| R1 | TC-01 | tests/other.spec.ts |'), /current mapping/],
  ['unresolved requirement', riskFile, text => text.replace('| C1 |', '| C1, C99 |'), /referenced requirement/],
  ['changed plan assertion', planFile, text => text.replace(oracle, 'All tasks including nonmatches are returned'), /reviewed oracle/],
  ['conflicting second expectation', planFile, text => text + '\n- expect: The filter is ignored\n', /reviewed oracle/],
  ['different target named in plan', planFile, text => text + '\n**File:** `tests/unselected.spec.ts`\n', /differs from/],
  ['missing case', planFile, text => text.replace('TC-01', 'TC-02'), /current mapping/],
]
for (const [name, file, transform, expected] of refusals) {
  test('refuses ' + name, optional, async t => {
    const config = await project(t)
    await edit(config.repoRoot, file, transform)
    config.repoRevision = commit(config.repoRoot)
    await assert.rejects(readInvestigationMapping(config), expected)
    assert.equal(git(config.repoRoot, 'status', '--porcelain'), '')
  })
}

test('requires an existing regular Git file and rejects a tracked symlink', optional, async t => {
  const config = await project(t)
  await rm(path.join(config.repoRoot, targetPath))
  config.repoRevision = commit(config.repoRoot)
  await assert.rejects(readInvestigationMapping(config), /non-regular tracked file/)
  await symlink('../' + riskFile, path.join(config.repoRoot, targetPath))
  config.repoRevision = commit(config.repoRoot)
  await assert.rejects(readInvestigationMapping(config), /non-regular tracked file/)
})
