import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

export const HARNESS_REVISION = 'a468921c2bead820520a97df897168487b2b4985'
const coverageDigest = 'a270de270689020662acfb5cb45621adb4014adfcaf29ae47a58ab5a9358de0a'
const matrixDigest = '63c37af09b3691ac7a836ddc369d4d58a1312dab72dfa84669e54ba3c5b40970'
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')

function git(root, ...args) {
  return execFileSync('git', ['--no-replace-objects', '--literal-pathspecs', '-c', 'protocol.allow=never', '-C', root, ...args], {
    maxBuffer: 4 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))), GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0' },
  })
}

function head(root) {
  return git(root, 'rev-parse', '--verify', 'HEAD^{commit}').toString().trim()
}

async function pinnedModule(root, filename, digest) {
  const source = git(root, 'cat-file', 'blob', HARNESS_REVISION + ':qa-harness/checks/' + filename)
  if (sha256(source) !== digest) throw new Error('Upstream checker source does not match the reviewed digest.')
  // Both pinned modules are self-contained apart from Node built-ins. Import exactly
  // these verified bytes; neither checkout's working files or packages are loaded.
  return import('data:text/javascript;base64,' + source.toString('base64'))
}

function regularEntry(root, revision, file, required) {
  const line = git(root, 'ls-tree', '-z', revision, '--', file).toString()
  if (!line && !required) return null
  const entry = /^(100644|100755) blob ([0-9a-f]{40})\t([^\0]+)\0$/.exec(line)
  if (!entry || entry[3] !== file) throw new Error('Missing or non-regular tracked file: ' + file)
  return entry[2]
}

async function readSnapshot({ repoRoot, revision, investigationId, targetPath, temporaryRoot }) {
  const directory = 'qa-artifacts/' + investigationId + '/'
  const planPath = 'specs/' + investigationId + '.plan.md'
  const files = new Map()
  for (const file of [
    planPath, directory + 'risks.md', directory + 'investigation.md',
    directory + 'flow-model.md', directory + 'exploration.md', directory + 'validation.md',
  ]) {
    const required = file === planPath || file.endsWith('/risks.md') || file.endsWith('/investigation.md')
    const oid = regularEntry(repoRoot, revision, file, required)
    if (!oid) continue
    const bytes = git(repoRoot, 'cat-file', 'blob', oid)
    const dest = path.join(temporaryRoot, file)
    await mkdir(path.dirname(dest), { recursive: true })
    await writeFile(dest, bytes)
    files.set(file, bytes)
  }
  // Upstream only tests whether the selected source is a regular file. Record its
  // actual Git blob and give the checker an empty marker; its content never executes.
  const targetOid = regularEntry(repoRoot, revision, targetPath, true)
  const target = path.join(temporaryRoot, targetPath)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, '', { flag: 'wx' })
  return { files, planPath, directory, targetOid }
}

function one(items, label) {
  if (items.length !== 1) throw new Error('Missing or ambiguous ' + label + '.')
  return items[0]
}

const sameId = (a, b) => a.toUpperCase() === b.toUpperCase()
const textOf = bytes => bytes.toString('utf8')
const lineOf = locator => Number(locator.slice(locator.lastIndexOf(':') + 1))
const oracleText = text => text.trim().replace(/[.]$/, '').trimEnd()

function browserObservability(risksFile, locator) {
  const lines = risksFile.split(/\r?\n/)
  const index = lineOf(locator) - 1
  const cells = line => line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(cell => cell.trim().toLowerCase())
  let start = index
  while (start > 0 && lines[start - 1].trim().startsWith('|')) start--
  const header = cells(lines[start])
  const value = cells(lines[index])[header.indexOf('observable')]
  if (!['yes', 'no', 'partial'].includes(value)) throw new Error('Missing or unsupported browser observability in the risk table.')
  return value
}

function selectedPlan(planBytes, planEntry, targetPath, oracle) {
  const lines = textOf(planBytes).split(/\r?\n/)
  const start = lineOf(planEntry.locator) - 1
  let end = start + 1
  while (end < lines.length && !/^#{1,6}\s/.test(lines[end])) end++
  const section = lines.slice(start + 1, end)
  const fields = { steps: [], expected: [], file: [] }
  let field
  for (const line of section) {
    const value = line.trim()
    if (!value) continue
    const label = /^\*\*([^*:]+):\*\*\s*(.*)$/.exec(value)
    const expectation = /^[-*]\s+expect:\s*(.*)$/i.exec(value)
    if (label) {
      field = label[1].toLowerCase()
      if (Object.hasOwn(fields, field)) fields[field].push(label[2])
    } else if (expectation) {
      field = 'expected'
      fields.expected.push(expectation[1])
    } else if (/^\d+[.)]\s+/.test(value) && fields.steps.length) {
      field = 'steps'
      fields.steps.push(value.replace(/^\d+[.)]\s+/, ''))
    } else if (Object.hasOwn(fields, field)) {
      const fragments = fields[field]
      fragments[fragments.length - 1] = (fragments.at(-1) + ' ' + value).trim()
    }
  }
  if (fields.file.some(file => file.replace(/^`([^`]+)`$/, '$1') !== targetPath)) {
    throw new Error('Plan file differs from the selected mapping.')
  }
  if (!fields.steps.some(step => /[\p{L}\p{N}]/u.test(step))) throw new Error('The selected plan needs a concrete action under Steps.')
  if (fields.expected.some(expectation => /^GAP\b/i.test(expectation)) ||
    section.some(line => /^\s*(?:[-*]\s+)?GAP\s*[:–—-]/i.test(line))) {
    throw new Error('The selected plan has an unresolved evidence gap.')
  }
  if (!fields.expected.length || fields.expected.some(expectation => oracleText(expectation) !== oracleText(oracle))) {
    throw new Error('The selected plan expectation does not match the reviewed oracle.')
  }
  const block = lines.slice(start, end).join('\n').trimEnd()
  return { title: planEntry.title, locator: planEntry.locator, section: block, gaps: [], sha256: sha256(block) }
}

/** Read one existing, approved automation mapping at immutable local Git revisions. */
export async function readInvestigationMapping({ harnessRoot, repoRoot, repoRevision, investigationId, upstreamCase, targetPath }) {
  if (typeof investigationId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(investigationId) ||
      typeof upstreamCase !== 'string' || !/^TC-\d+$/i.test(upstreamCase)) {
    throw new Error('Supply a valid investigation ID and one upstream TC ID.')
  }
  if (typeof targetPath !== 'string' || /[\\:\x00-\x1f\x7f]/.test(targetPath) ||
    targetPath.split('/').some(part => !part || ['.', '..', '.git'].includes(part.toLowerCase())) ||
    !/\.(spec|test)\.(?:[cm]?[jt]sx?)$/.test(targetPath)) throw new Error('Supply a repository-relative Playwright spec path.')
  if (head(harnessRoot) !== HARNESS_REVISION) throw new Error('Check out QA Investigation Harness at the reviewed revision ' + HARNESS_REVISION + '.')
  const revision = repoRevision ?? head(repoRoot)
  if (!/^[0-9a-f]{40}$/.test(revision) || git(repoRoot, 'cat-file', '-t', revision).toString().trim() !== 'commit') {
    throw new Error('Expected a full consumer Git commit.')
  }
  const { buildCoverage } = await pinnedModule(harnessRoot, 'coverage-report.mjs', coverageDigest)
  const { buildTraceabilityMatrix } = await pinnedModule(harnessRoot, 'traceability-matrix.mjs', matrixDigest)
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'tesbo-investigation-'))
  try {
    const snapshot = await readSnapshot({ repoRoot, revision, investigationId, targetPath, temporaryRoot })
    const coverage = await buildCoverage(temporaryRoot, investigationId, null, { includeMatrixEvidence: true })
    const matrix = buildTraceabilityMatrix(coverage)
    const selected = matrix.rows.filter(row => sameId(row.case, upstreamCase))
    if (!selected.length || selected.some(row => row.mappingStatus !== 'current' || row.mappedTest !== targetPath)) {
      throw new Error('The selected case has no unambiguous current mapping to this file.')
    }
    const { mappings, risks, requirements, decisions, plans } = coverage.evidence
    const mapping = one(mappings.filter(item => sameId(item.tcId, upstreamCase)), 'case mapping')
    const risk = one(risks.filter(item => sameId(item.id, mapping.riskId)), 'mapped risk')
    const decision = one(decisions.filter(item => sameId(item.riskId, risk.id)), 'risk decision')
    if (risk.status !== 'APPROVED' || decision.decision !== 'APPROVED' || !risk.oracle || !risk.text ||
      decision.reviewed !== 'Risk: ' + risk.text + '; Oracle: ' + risk.oracle ||
      decisions.filter(item => sameId(item.id, decision.id)).length !== 1) {
      throw new Error('The selected risk and exact oracle need a unique explicit approval.')
    }
    const linkedRequirements = risk.requirementIds.map(id => one(requirements.filter(req => sameId(req.id, id)), 'referenced requirement ' + id))
    const dependencies = decision.dependency.split(/[;,]/).map(part => {
      const match = /^(investigation\.md|exploration\.md|flow-model\.md)@sha256:([a-f0-9]{64})$/i.exec(part.trim())
      if (!match) throw new Error('The decision needs an exact investigation evidence digest.')
      const file = snapshot.directory + match[1]
      const bytes = snapshot.files.get(file)
      if (!bytes || sha256(bytes) !== match[2].toLowerCase()) throw new Error('The reviewed evidence changed.')
      return { file, sha256: sha256(bytes) }
    })
    const riskPath = snapshot.directory + 'risks.md'
    const observability = browserObservability(textOf(snapshot.files.get(riskPath)), risk.locator)
    if (observability !== 'yes') throw new Error('The selected oracle requires an independent evidence reader.')
    const entry = one(plans.filter(item => sameId(item.tcId, upstreamCase)), 'plan entry')
    const plan = selectedPlan(snapshot.files.get(snapshot.planPath), entry, targetPath, risk.oracle)
    return {
      investigationId, upstreamCase: entry.tcId, targetPath, targetBlob: snapshot.targetOid, repoRevision: revision,
      harnessRevision: HARNESS_REVISION, plan,
      risks: [{ id: risk.id, text: risk.text, oracle: risk.oracle, observableFromBrowser: observability, locator: risk.locator,
        decisionId: decision.id, decisionLocator: decision.locator, mappingLocator: mapping.locator, dependencies, requirements: linkedRequirements }],
    }
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
}
