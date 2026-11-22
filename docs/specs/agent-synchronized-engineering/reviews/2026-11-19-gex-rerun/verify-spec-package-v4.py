#!/usr/bin/env python3
"""Tesbo-bound mechanical documentation verifier; never a semantic/runtime gate."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import zipfile

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--input', type=Path, required=True)
p.add_argument('--baseline-zip', type=Path, required=True)
p.add_argument('--receipt', type=Path)
a = p.parse_args()
checks = []

def check(name, ok, detail):
    checks.append({'check': name, 'passed': bool(ok), 'detail': detail})

def digest(data):
    return hashlib.sha256(data).hexdigest()

manifest_bytes = (a.input / 'manifest.json').read_bytes()
m = json.loads(manifest_bytes)
names = ['00_README.md', '01_PRODUCT_REQUIREMENTS.md', '02_WORKFLOW_AND_UX_SPEC.md',
         '03_TECHNICAL_DESIGN.md', '04_MCP_API_CONTRACTS.md',
         '05_IMPLEMENTATION_BACKLOG_AND_TEST_PLAN.md', '06_IMPLEMENTATION_AGENT_BRIEF.md',
         '07_UI_DESIGN_TASKS.md']
views = ['AGENT_RULE_TEMPLATE.md', 'README.md', 'design.md', 'implementation-plan.md',
         'requirements.md', 'skills-governance.md']
expected = {'canonical/' + n for n in names} | {'views/' + n for n in views}
listed = [f['path'] for f in m['files']]
check('exact_manifest_members', set(listed) == expected and len(listed) == len(expected),
      {'expected': len(expected), 'actual': len(listed)})
check('exact_eight_canonical_files', sorted(x.name for x in (a.input/'canonical').glob('*.md')) == sorted(names), names)
for f in m['files']:
    b = (a.input/f['path']).read_bytes()
    check('frozen_bytes:' + f['path'], len(b) == f['bytes'] and digest(b) == f['sha256'],
          {'bytes':len(b), 'sha256':digest(b)})
check('baseline_archive_identity', digest(a.baseline_zip.read_bytes()) == m['canonical_input_archive_sha256'],
      digest(a.baseline_zip.read_bytes()))
oldrev = '1.4.35 — source convergence and method-adoption reconciliation; NOT FROZEN'
newrev = '1.4.36 — GEX-ASER-2026-11-19 final reconciliation; governed graph reasoning and principle-based learning; NOT FROZEN'
oldpointer = 'Read revision 1.4.28 below for ASER scope, exact canonical owners and contracts.'
newpointer = 'Read revisions 1.4.28 and 1.4.29 below for ASER scope, exact canonical owners, graph reasoning and method-learning contracts.'
marker = '## Revision 1.4.36'
idpattern = r'\b(?:FR|NFR|AC|T|QA|R-ASE|MBT-AC|MBT-C)-\d+\b'
with zipfile.ZipFile(a.baseline_zip) as z:
    check('baseline_eight_members', sorted(z.namelist()) == sorted(names), sorted(z.namelist()))
    for name in names:
        old = z.read(name).decode('utf-8')
        now = (a.input/'canonical'/name).read_text()
        expected_old = old.replace(oldrev, newrev, 1)
        check('historical_body_preserved:' + name, now.split(marker)[0].rstrip() == expected_old.rstrip(),
              'Only the exact current revision header substitution is permitted before the appended amendment; full incoming 1.4.35 body retained.')
        removed = sorted(set(re.findall(idpattern, old)) - set(re.findall(idpattern, now)))
        check('historical_identifiers_retained:' + name, not removed, {'removed':removed})
        delta = now[now.find(marker):] if marker in now else ''
        check('amendment_present:' + name, bool(delta), marker)
        check('no_unresolved_placeholder:' + name, '¤' not in delta, 'Appended amendment only; no inference about prose adequacy.')
        for target in re.findall(r'\]\(([^)\s]+)\)', delta):
            if re.match(r'^[a-zA-Z][a-zA-Z0-9+.-]*:', target) or target.startswith('#'):
                continue
            relative = target.split('#')[0]
            if relative.endswith('.md'):
                check('local_link:' + name + ':' + target, (a.input/'canonical'/relative).is_file(),
                      'Existence only; anchor meaning and semantic support require review.')
text = (a.input/'canonical'/'05_IMPLEMENTATION_BACKLOG_AND_TEST_PLAN.md').read_text()
counts = {}
for family, count in [('ASE-E2E',15),('ASE-FLOW',54),('SK-E2E',40),('ASE-INT',16)]:
    found = {int(i) for i in re.findall(r'^\|\s*' + re.escape(family) + r'-(\d+)\s*\|', text, re.M)}
    counts[family] = len(found)
    check('scenario_identifier_set:' + family, found == set(range(1,count+1)),
          {'unique_definition_rows':len(found), 'expected':count, 'ids':sorted(found)})
check('scenario_count', sum(counts.values()) == 125, counts)
for family, count in [('GEX-AC',8),('GA-AC',5)]:
    found={int(i) for i in re.findall(r'^\|\s*'+re.escape(family)+r'-(\d+)(?:\s|\|)',text,re.M)}
    check('supplementary_proof_set:'+family,found==set(range(1,count+1)),{'current_unique_ids':sorted(found),'expected':count,'note':'Historical superseded GA summaries are not counted twice; no execution inferred.'})
source = subprocess.run(['git','cat-file','-t',m['application_source_sha']],
                        cwd=m['application_source_git'], text=True, capture_output=True)
check('source_commit_accessible', source.returncode == 0 and source.stdout.strip() == 'commit',
      {'sha':m['application_source_sha'], 'git_exit':source.returncode})
result = {'verifier':'Tesbo documentation structural binding v4; concurrent 1.4.35 baseline',
          'input_manifest_sha256':digest(manifest_bytes), 'input_revision':m['revision'],
          'checks':checks, 'passed':all(c['passed'] for c in checks),
          'limits':['No semantic requirement-to-design-to-test completeness certification.',
                    'No application runtime, authentic UI, deployed source, human authority or efficacy proof.',
                    'No inference that an installed skill or source implementation satisfies a proposed contract.']}
if a.receipt:
    a.receipt.parent.mkdir(parents=True, exist_ok=True)
    a.receipt.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'passed':result['passed'], 'checks':len(checks),
                  'failed':[c for c in checks if not c['passed']],
                  'manifest_sha256':result['input_manifest_sha256'], 'counts':counts}))
sys.exit(0 if result['passed'] else 1)
