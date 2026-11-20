"""Tesbo document verification binding v6; cumulative assertions remain distinct from test identities."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def git_blob(data):
    return hashlib.sha1(f"blob {len(data)}\0".encode() + data).hexdigest()


def headings(text):
    counts = Counter()
    anchors = set(re.findall(r'<a\s+(?:name|id)=["\']([^"\']+)', text))
    in_fence = False
    for line in text.splitlines():
        if line.lstrip().startswith(('```', '~~~')):
            in_fence = not in_fence
        if in_fence:
            continue
        match = re.match(r'^#{1,6}\s+(.+?)\s*#*$', line)
        if not match:
            continue
        title = re.sub(r'<[^>]+>', '', match.group(1))
        slug = ''.join(c for c in title.lower() if c.isalnum() or c in '_- ')
        slug = slug.replace(' ', '-')
        suffix = counts[slug]
        anchors.add(slug + (f'-{suffix}' if suffix else ''))
        counts[slug] += 1
    return anchors


parser = argparse.ArgumentParser()
parser.add_argument('--candidate', required=True, type=Path)
parser.add_argument('--baseline', required=True, type=Path)
parser.add_argument('--workspace', required=True, type=Path)
parser.add_argument('--output', required=True, type=Path)
args = parser.parse_args()
failures = []
checks = []
files = []


def require(condition, name, details=None):
    checks.append({'check': name, 'passed': bool(condition), 'details': details})
    if not condition:
        failures.append(name)


expected = [
    '00_README.md', '01_PRODUCT_REQUIREMENTS.md', '02_WORKFLOW_AND_UX_SPEC.md',
    '03_TECHNICAL_DESIGN.md', '04_MCP_API_CONTRACTS.md',
    '05_IMPLEMENTATION_BACKLOG_AND_TEST_PLAN.md', '06_IMPLEMENTATION_AGENT_BRIEF.md',
    '07_UI_DESIGN_TASKS.md',
]
expected_views = [
    'AGENT_RULE_TEMPLATE.md', 'README.md', 'design.md',
    'implementation-plan.md', 'requirements.md', 'skills-governance.md',
]
require(sorted(p.name for p in (args.candidate / 'canonical').glob('*.md')) == expected,
        'exactly eight canonical files')
require(sorted(p.name for p in (args.candidate / 'views').glob('*.md')) == expected_views,
        'exactly six subordinate root views')
id_pattern = re.compile(r'\b(?:[A-Z]{1,10}(?:-[A-Z]{1,10})*-\d{1,5}[A-Z]?|T\d{3,4})\b')
texts = {}
baseline_texts = {}
for folder, names in [('canonical', expected), ('views', expected_views)]:
    for name in names:
        path = args.candidate / folder / name
        raw = path.read_bytes()
        text = raw.decode('utf-8')
        texts[f'{folder}/{name}'] = text
        old = (args.baseline / folder / name).read_text()
        baseline_texts[f'{folder}/{name}'] = old
        removed = sorted(set(id_pattern.findall(old)) - set(id_pattern.findall(text)))
        require(not removed, f'preserved identifiers: {folder}/{name}', removed)
        require('1.4.38' in '\n'.join(text.splitlines()[:7]), f'current revision header: {folder}/{name}')
        require('NOT FROZEN' in '\n'.join(text.splitlines()[:7]), f'unfrozen header: {folder}/{name}')
        files.append({'path': f'{folder}/{name}', 'bytes': len(raw), 'sha256': sha256(raw)})

test_plan = texts['canonical/05_IMPLEMENTATION_BACKLOG_AND_TEST_PLAN.md']
definitions = re.findall(r'^\| ((?:ASE-(?:E2E|FLOW|INT)|SK-E2E)-\d+) \|', test_plan, re.M)
counts = Counter(definitions)
duplicates = {key: value for key, value in counts.items() if value > 1}
families = {family: sum(key.startswith(family + '-') for key in counts)
            for family in ['ASE-E2E', 'ASE-FLOW', 'SK-E2E', 'ASE-INT']}
require(not duplicates, 'canonical scenario definitions unique', duplicates)
require(families == {'ASE-E2E': 15, 'ASE-FLOW': 54, 'SK-E2E': 40, 'ASE-INT': 16},
        '125 planned scoped ASER definitions', families)
# A definition identity, an alias identity and a cumulative assertion are
# separate accounting units. Never discard an older assertion to force a count.
def assertion_rows(text, family, quoted=False):
    prefix = r'(?:Proposed alias )?`' if quoted else ''
    suffix = r'` \|' if quoted else r'(?=[\s|])'
    pattern = r'^\| ' + prefix + r'(' + re.escape(family) + r'-\d+)' + suffix + r'.*$'
    return [(match.group(1), match.group(0)) for match in re.finditer(pattern, text, re.M)]


def row_strings(rows):
    return [row for _, row in rows]


def rows_preserved(required_rows, actual_rows, label):
    missing = sorted(set(row_strings(required_rows)) - set(row_strings(actual_rows)))
    require(not missing, label, {'expected_distinct_assertions': len(set(row_strings(required_rows))),
                                'missing_assertions': missing})


skill_alias_records = assertion_rows(test_plan, 'SK-E2E', quoted=True)
canonical_aliases = row_strings(skill_alias_records)
skill_alias_counts = Counter(identifier for identifier, _ in skill_alias_records)
require(set(skill_alias_counts) == {f'SK-E2E-{i}' for i in range(41,45)},
        'four Skill proposal alias identities retained', dict(skill_alias_counts))
require(len(canonical_aliases) == len(set(canonical_aliases)) == 8 and set(skill_alias_counts.values()) == {2},
        'eight cumulative Skill alias assertion rows across both retained generations',
        {'assertion_rows': len(canonical_aliases), 'rows_per_alias': dict(skill_alias_counts)})
for name in ['skills-governance.md', 'implementation-plan.md']:
    text = texts['views/' + name]
    rows_preserved(skill_alias_records, assertion_rows(text, 'SK-E2E', quoted=True),
                   f'all eight Skill alias allocations agree: {name}')
    require(not re.search(r'^\| SK-E2E-4[1-4] \|', text, re.M), f'aliases not duplicate definitions: {name}')


supplemental_records = assertion_rows(test_plan, 'GEX-AC')
supplemental = row_strings(supplemental_records)
require(len(supplemental) == 8 and len(set(supplemental)) == 8
        and {identifier for identifier, _ in supplemental_records} == {f'GEX-AC-{i:02d}' for i in range(1, 9)},
        'eight retained supplemental GEX-AC proof obligations',
        {'assertion_rows': len(supplemental), 'unique_ids': sorted({identifier for identifier, _ in supplemental_records})})
rows_preserved(supplemental_records, assertion_rows(texts['views/implementation-plan.md'], 'GEX-AC'),
               'supplemental GEX-AC obligations mirrored')

semantic_records = assertion_rows(test_plan, 'GEX-SEM', quoted=True)
semantic_aliases = row_strings(semantic_records)
semantic_ids = {identifier for identifier, _ in semantic_records}
require(semantic_ids == {f'GEX-SEM-{i:02d}' for i in range(1, 9)},
        'eight semantic proposal alias identities retained',
        {'unique_aliases': sorted(semantic_ids), 'cumulative_assertion_rows': len(semantic_aliases)})
require(len(semantic_aliases) == len(set(semantic_aliases)),
        'semantic cumulative rows are distinct assertions, not duplicate rows')
rows_preserved(semantic_records, assertion_rows(texts['views/implementation-plan.md'], 'GEX-SEM', quoted=True),
               'all semantic proposal allocation assertions mirrored')

ga_records = assertion_rows(test_plan, 'GA-AC')
ga_rows = row_strings(ga_records)
ga_counts = Counter(identifier for identifier, _ in ga_records)
require(set(ga_counts) == {f'GA-AC-{i:02d}' for i in range(1, 6)},
        'five unique Graph Analytics acceptance IDs', dict(ga_counts))
require(len(ga_rows) == 15 and len(set(ga_rows)) == 15 and set(ga_counts.values()) == {3},
        'fifteen cumulative GA assertions across revisions33/35/37',
        {'assertion_rows': len(ga_rows), 'distinct_assertion_rows': len(set(ga_rows)), 'rows_per_id': dict(ga_counts)})
rows_preserved(ga_records, assertion_rows(texts['views/implementation-plan.md'], 'GA-AC'),
               'all fifteen cumulative GA acceptance assertions mirrored')

discovery_records = assertion_rows(test_plan, 'GEX-DISC', quoted=True)
discovery_aliases = row_strings(discovery_records)
discovery_ids = {identifier for identifier, _ in discovery_records}
require(discovery_ids == {f'GEX-DISC-{i:02d}' for i in range(1, 6)},
        'five discovery alias identities without new definitions',
        {'unique_aliases': sorted(discovery_ids), 'cumulative_assertion_rows': len(discovery_aliases)})
require(len(discovery_aliases) == len(set(discovery_aliases)),
        'discovery cumulative rows are distinct assertions, not duplicate rows')
rows_preserved(discovery_records, assertion_rows(texts['views/implementation-plan.md'], 'GEX-DISC', quoted=True),
               'all discovery alias allocation assertions mirrored')

historical_plan_path = args.workspace / 'input-v35-candidate3/canonical/05_IMPLEMENTATION_BACKLOG_AND_TEST_PLAN.md'
historical_plan = historical_plan_path.read_text()
for label, old_plan in [('incoming saved37', baseline_texts['canonical/05_IMPLEMENTATION_BACKLOG_AND_TEST_PLAN.md']),
                        ('historical continuation35', historical_plan)]:
    for family, quoted, records in [('GEX-AC', False, supplemental_records), ('GA-AC', False, ga_records),
                                    ('GEX-SEM', True, semantic_records), ('GEX-DISC', True, discovery_records),
                                    ('SK-E2E', True, skill_alias_records)]:
        rows_preserved(assertion_rows(old_plan, family, quoted), records,
                       f'preserved {label} {family} assertion rows')

for key in ['canonical/05_IMPLEMENTATION_BACKLOG_AND_TEST_PLAN.md',
            'views/implementation-plan.md', 'views/skills-governance.md']:
    unquoted = re.findall(r'^\| (?:GEX-SEM-\d+|GEX-DISC-\d+|SK-E2E-4[1-4]) \|.*$', texts[key], re.M)
    require(not unquoted, f'proposal aliases do not become unquoted definition rows: {key}', unquoted)

# Check the actual Markdown table shape of the scoped assertion rows. A row
# copied under an incompatible header is not a usable mirror.
def table_shape_issues(text):
    issues = []
    expected_columns = None
    previous_columns = None
    in_table = False
    for line_number, line in enumerate(text.splitlines(), 1):
        if not line.startswith('|'):
            expected_columns = previous_columns = None
            in_table = False
            continue
        cells = re.split(r'(?<!\\)\|', line.strip())[1:-1]
        count = len(cells)
        if cells and all(re.fullmatch(r'\s*:?-{3,}:?\s*', cell) for cell in cells):
            expected_columns = count
            if previous_columns != count:
                issues.append({'line': line_number, 'reason': 'table header/separator column mismatch'})
            in_table = True
        elif re.match(r'^\| (?:GA-AC-\d+|`(?:GEX-SEM|GEX-DISC|SK-E2E)-\d+`)', line):
            if not in_table or expected_columns != count:
                issues.append({'line': line_number, 'expected_columns': expected_columns,
                               'actual_columns': count, 'row': line})
        previous_columns = count
    return issues

for key in ['canonical/05_IMPLEMENTATION_BACKLOG_AND_TEST_PLAN.md', 'views/implementation-plan.md']:
    issues = table_shape_issues(texts[key])
    require(not issues, f'cumulative assertion table shape: {key}', issues)

# These are bounded text-contract checks. Matching wording is not proof of
# correct implementation, authority, runtime behavior or semantic completeness.
def paragraph_with(text, needle):
    return next((paragraph for paragraph in text.split('\n\n') if needle in paragraph), '')


prd = texts['canonical/01_PRODUCT_REQUIREMENTS.md']
design = texts['canonical/03_TECHNICAL_DESIGN.md']
api = texts['canonical/04_MCP_API_CONTRACTS.md']
axes = paragraph_with(prd, 'Maintain independent axes for applicability')
axis_terms = ['applicability', 'evidence sufficiency', 'observed outcome', 'native impact disposition',
              'mixed', 'cannot establish a met obligation', 'does not erase the original failure']
require(bool(axes) and all(term in axes for term in axis_terms),
        'independent GA applicability/evidence/outcome/impact axes retained',
        {'required_terms': axis_terms, 'missing_terms': [term for term in axis_terms if term not in axes]})

golden = next((row for identifier, row in ga_records if identifier == 'GA-AC-02' and 'Golden mixed project:' in row), '')
golden_terms = ['A modeled PASS plus equivalent approved policy', 'B unmapped policy verified FAIL',
                'C model obligation with no run', 'D unresolved governing conflict',
                'Before withdrawal: 3 known eligible, 2 verified, 1 met, 1 conflict outside known denominator',
                'scope incomplete', 'Withdrawal produces 4 known eligible',
                'A model and A policy distinct; policy has no applicable execution',
                '2 verified, 1 met, 1 conflict; historical snapshot retains prior counts']
require(bool(golden) and all(term in golden for term in golden_terms),
        'GA golden denominator fixture preserves3-2-1-1 then4-2-1-1 after equivalence withdrawal',
        {'required_terms': golden_terms, 'missing_terms': [term for term in golden_terms if term not in golden]})

equivalence = paragraph_with(design, 'Requirements/Policy and Model Studio retain their source authority.')
equivalence_terms = ['versioned, reviewed equivalence decision', 'withdrawal or supersession recomputes current projections',
                     'invalidates affected handoffs', 'history retains the previous decision',
                     'Unresolved authority conflicts remain a separate unknown partition',
                     'verified FAIL and mixed evidence increment verified, never met']
require(bool(equivalence) and all(term in equivalence for term in equivalence_terms),
        'equivalence withdrawal and conflict/evidence denominator boundaries retained',
        {'missing_terms': [term for term in equivalence_terms if term not in equivalence]})

grant = paragraph_with(api, 'Initial Graph Analytics entry uses authorized native human project sessions.')
grant_terms = ['Existing read-only API tokens receive no graph metadata under AC-092',
               'later credentialed surfaces require explicit grant contracts',
               'Bind cursors, caches and receipts to effective grant and authorized visible scope',
               'A hidden-only update preserves continuation and visible freshness',
               'Permission loss invalidates subsequent access',
               'Recheck at deferred delivery for both AI and native attachment reads']
require(bool(grant) and all(term in grant for term in grant_terms),
        'GA native human entry and effective visible grant scope retained',
        {'missing_terms': [term for term in grant_terms if term not in grant]})

frontier = paragraph_with(design, 'reconcile the assessed frontier against independent change and mapped-consumer input')
frontier_terms = ['downstream consumers and applicable guards', 'known omissions', 'justified exclusions and termination',
                  'reviewed completeness witness', 'exact scope, captures, authority and extraction profile',
                  'no independently supported, disclosable witness', 'keep the result limited',
                  'identical treatment for absent and restricted proof',
                  'Invalidate the witness on material dependency or authority changes']
require(bool(frontier) and all(term in frontier for term in frontier_terms),
        'bounded frontier witness has independent scope and invalidation conditions',
        {'missing_terms': [term for term in frontier_terms if term not in frontier]})
frontier_fixture = next((row for identifier, row in ga_records if identifier == 'GA-AC-04' and 'bounded frontier witness' in row), '')
frontier_fixture_terms = ['Independently declared downstream consumer silently omitted by extractor must yield limited/unknown',
                          'genuine unaffected control with valid bounded frontier witness permits scoped no impact']
require(bool(frontier_fixture) and all(term in frontier_fixture for term in frontier_fixture_terms),
        'bounded frontier proof keeps omitted-consumer and unaffected controls',
        {'missing_terms': [term for term in frontier_fixture_terms if term not in frontier_fixture]})

owner_heading = '### Equivalence decision owner qualification — revision 1.4.38'
owner_terms = ['authoritative Requirements, Policy or Model record owners',
               'A Change Packet remains a derived projection under R-ASE-01 and ASER-C02',
               'it owns no approval authority, authoritative equivalence store or independent persistence lifecycle',
               'Only an explicitly permitted human decision',
               'exact governing revisions, scope and authority',
               'Withdrawal or supersession invalidates affected current projections and handoffs',
               'retaining the original historical decision and receipts']
owner_blocks = {}
for key in ['canonical/03_TECHNICAL_DESIGN.md', 'canonical/04_MCP_API_CONTRACTS.md', 'views/design.md']:
    text = texts[key]
    block = text.split(owner_heading + '\n', 1)[1].split('\n### ', 1)[0].split('\n## ', 1)[0].strip() if owner_heading + '\n' in text else ''
    owner_blocks[key] = block
    require(bool(block) and all(term in block for term in owner_terms),
            f'Change Packet has no independent approval authority: {key}',
            {'missing_terms': [term for term in owner_terms if term not in block]})
require(len(set(owner_blocks.values())) == 1 and all(owner_blocks.values()),
        'equivalence decision owner qualification mirrors agree')

require('Use the same eight canonical files at revision 1.4.38' in texts['views/implementation-plan.md'],
        'operative implementation instruction names current revision')
require('For any governed Model Studio or Skill-assisted operation' not in texts['views/skills-governance.md']
        and 'approved inactive model revision' in texts['views/skills-governance.md'],
        'historical model exception is retained')
require('`record_execution_result` / `update_execution_result`' in texts['canonical/03_TECHNICAL_DESIGN.md'],
        'source result-tool locator uses inspected name')

view_link_issues = []
for name in expected_views:
    text = texts['views/' + name]
    for match in re.finditer(r'(?<!!)\[[^\]\n]*\]\(([^\s)]+)(?:\s+"[^"\n]*")?\)', text):
        link = match.group(1).strip('<>')
        parsed = urlsplit(link)
        if parsed.scheme or parsed.netloc:
            continue
        target_name = parsed.path.removeprefix('./') if parsed.path else name
        if target_name not in expected_views:
            continue  # Nonlocal repository/library links require their own source binding.
        if parsed.fragment and unquote(parsed.fragment) not in headings(texts['views/' + target_name]):
            view_link_issues.append({'file': name, 'link': link, 'reason': 'missing sibling anchor'})
require(not view_link_issues, 'subordinate sibling links and anchors resolve', view_link_issues)

canonical_method = texts['canonical/06_IMPLEMENTATION_AGENT_BRIEF.md'].split(
    '### Portable method for discovery and principle distillation\n', 1)[1].split(
    '\n### Independent application and review boundary', 1)[0].strip()
view_method = texts['views/skills-governance.md'].split(
    '### 13.4.1 Portable method for discovery and principle distillation\n', 1)[1].split(
    '\n### AI-powered graph analysis method and skill-composition proposal', 1)[0].strip()
require(canonical_method.replace('owned by this canonical brief', 'owned by canonical 06') == view_method,
        'portable method mirror matches canonical owner')

canonical_map = texts['canonical/03_TECHNICAL_DESIGN.md'].split(
    '#### 18.2.1 Native Model Studio convergence and source maturity\n', 1)[1].split(
    '\n#### 18.3 Invariants', 1)[0].strip()
require(canonical_map in texts['views/design.md'], 'current source convergence mirror matches canonical owner')

link_issues = []
for name in expected:
    path = args.candidate / 'canonical' / name
    text = texts['canonical/' + name]
    for match in re.finditer(r'(?<!!)\[[^\]\n]*\]\(([^\s)]+)(?:\s+"[^"\n]*")?\)', text):
        link = match.group(1).strip('<>')
        parsed = urlsplit(link)
        if parsed.scheme or parsed.netloc:
            continue
        target = path.parent / unquote(parsed.path) if parsed.path else path
        if not target.is_file():
            link_issues.append({'file': name, 'link': link, 'reason': 'missing file'})
        elif parsed.fragment and target.suffix == '.md' and unquote(parsed.fragment) not in headings(target.read_text()):
            link_issues.append({'file': name, 'link': link, 'reason': 'missing anchor'})
require(not link_issues, 'canonical relative links and anchors resolve', link_issues)

integrity_inputs = [
    ('frozen candidate-1', args.workspace / 'input-v31/manifest.json', args.workspace / 'input-v31'),
    ('current source cache', args.workspace / 'verification/source419-manifest.json', args.workspace / 'source419'),
    ('current frontend source supplement', args.workspace / 'verification/source419-frontend-manifest.json',
     args.workspace / 'source419-frontend'),
    ('recovered method pack', args.workspace / 'method-inputs/repository-d83549c8/manifest.json',
     args.workspace / 'method-inputs/repository-d83549c8'),
    ('original method artifacts', args.workspace / 'method-inputs/manifest.json', args.workspace / 'method-inputs'),
    ('historical continuation35 candidate3', args.workspace / 'input-v35-candidate3/manifest.json', args.workspace / 'input-v35-candidate3'),
]
if (args.candidate / 'manifest.json').is_file() and args.candidate != args.workspace / 'input-v31':
    integrity_inputs.append(('current candidate snapshot', args.candidate / 'manifest.json', args.candidate))
for label, manifest_path, root in integrity_inputs:
    manifest = json.loads(manifest_path.read_text())
    mismatch = []
    for item in manifest['files']:
        path = root / item['path']
        if not path.is_file():
            mismatch.append({'path': item['path'], 'reason': 'missing'})
            continue
        raw = path.read_bytes()
        if sha256(raw) != item['sha256'] or len(raw) != item['bytes']:
            mismatch.append({'path': item['path'], 'reason': 'bytes/digest mismatch'})
        if item.get('git_blob') and git_blob(raw) != item['git_blob']:
            mismatch.append({'path': item['path'], 'reason': 'Git blob mismatch'})
    require(not mismatch, f'input integrity: {label}', {'checked_files': len(manifest['files']), 'mismatches': mismatch})

result = {
    'verifier': 'Tesbo specification document binding v6',
    'scope': 'Document structure, declared mirrors, identifier continuity and exact input bytes only',
    'limits': 'No semantic completeness, R-D-T sufficiency, source behavior, runtime, UI, approval, Skill efficacy or freeze verdict',
    'candidate': str(args.candidate), 'baseline': str(args.baseline),
    'candidate_manifest_sha256': sha256((args.candidate / 'manifest.json').read_bytes()) if (args.candidate / 'manifest.json').is_file() else None,
    'baseline_manifest_sha256': sha256((args.baseline / 'manifest.json').read_bytes()) if (args.baseline / 'manifest.json').is_file() else None,
    'count_units': {'ASER_unique_definitions': sum(families.values()), 'GEX_AC_unique_ids': len(supplemental_records),
                    'GA_unique_ids': len(ga_counts), 'GA_cumulative_assertion_rows': len(ga_rows),
                    'SEM_unique_aliases': len(semantic_ids), 'SEM_cumulative_assertion_rows': len(semantic_aliases),
                    'SK_unique_aliases': len(skill_alias_counts),
        'SK_cumulative_assertion_rows': len(canonical_aliases), 'DISC_unique_aliases': len(discovery_ids),
                    'DISC_cumulative_assertion_rows': len(discovery_aliases)},
    'passed': not failures, 'failed_checks': failures, 'checks': checks, 'candidate_files': files,
}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'passed': not failures, 'checks': len(checks), 'failed_checks': failures,
                  'scenario_counts': families, 'supplemental_GEX_AC': len(supplemental), 'current_GA_AC_unique_ids': len(ga_counts), 'GA_cumulative_assertion_rows': len(ga_rows), 'skill_aliases': len(skill_alias_counts), 'skill_alias_assertion_rows': len(canonical_aliases),
                  'semantic_aliases': len(semantic_ids), 'semantic_assertion_rows': len(semantic_aliases), 'discovery_aliases': len(discovery_ids), 'discovery_assertion_rows': len(discovery_aliases), 'output': str(args.output)}, indent=2))
sys.exit(0 if not failures else 1)
