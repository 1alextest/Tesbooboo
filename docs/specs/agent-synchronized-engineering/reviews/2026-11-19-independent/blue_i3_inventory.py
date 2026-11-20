import hashlib, json, re, subprocess
from pathlib import Path

BASE = Path('/workspace/scratch/fb086055b433')
SRC = BASE / 'tesbo-review-9519b56d'
NEW = BASE / 'tesbo-review-965a87a1'
def digest(data): return hashlib.sha256(data).hexdigest()
def git(*args): return subprocess.check_output(['git', '-C', str(SRC), *args], text=True).strip()
tracked = git('ls-files').splitlines()
literal = []
for name in tracked:
    if not name.startswith(('Tesbo-Backend-Nest/src/', 'Tesbo-Backend-Nest/migrations/', 'Tesbo-Frontend/')): continue
    if any(x in name for x in ('.spec.', '/__tests__/', '/node_modules/')): continue
    p = SRC / name
    try: lines = p.read_text().splitlines()
    except (UnicodeDecodeError, OSError): continue
    for n, line in enumerate(lines, 1):
        if 'ai_generation_requests' in line:
            literal.append({'path': name, 'line': n, 'text': line.strip()})

inputs = []
def add(p, scope):
    p = Path(p)
    b = p.read_bytes()
    inputs.append({'path': str(p.relative_to(BASE)), 'sha256': digest(b), 'bytes': len(b), 'scope': scope})
for p in sorted((BASE/'tesbo-canonical-inputs/extracted-v1.4.28').glob('0[0-7]_*.md')):
    add(p, 'section inventory and directly consulted relevant I3-Q/ASER clauses; not a full line-by-line audit')
add(BASE/'tesbo-canonical-inputs/creating a testing tool to make my job easier/Tesbo_Existing_Application_Baseline_v1.0.md', 'historical purpose, evidence/visual constraints and original-loop reconciliation consulted; no image or live audit')
for name in ['.kiro/steering/teams/blue-team-charter.md', '.kiro/steering/teams/review-orchestration.md', '.kiro/steering/teams/white-team-charter.md', 'docs/policies/governance/POL-GOVERNANCE-ASSURANCE-PORTABILITY/v001.md', 'docs/policies/governance/POL-GOVERNANCE-ASSURANCE-EVIDENCE/v001.md']:
    add(BASE/'assurance-method-inputs'/name, 'unchanged pinned method; Blue/orchestration/policies read; White applicable gate obligations')
for name in ['i3-native-owner-fit.md', 'white-i3-owner-admission.md', 'white-i3-owner-admission-inputs.json']:
    add(BASE/'assurance-working'/name, 'new design or actual White delta input; does not constitute implementation proof')
for name in ['blue-a.md','blue-b.md','blue-reconciliation.md','red-independent.md','red-grounding-and-reconciliation.md','grey-reconstruction-before-crosswalk.md','grey-independent.md','grey-independent-challenge.md','white-prearchitecture.md','receipt-provenance.md']:
    add(SRC/'docs/specs/agent-synchronized-engineering/reviews/2026-11-19-independent'/name, 'actual historical receipt; relevant ownership/negative-proof/qualified-finding scope consulted, not rerun')
source_names = set(x['path'] for x in literal)
source_names.update('Tesbo-Backend-Nest/'+n for n in [
 'src/legacy/legacy.controller.ts','src/mcp/mcp.service.ts','src/mcp/mcp.tools.ts','src/auth/api-token.service.ts','src/auth/api-token-rest.guard.ts','src/storage/storage.service.ts','src/automation/automation.service.ts','src/plan-limits/plan-limits.service.ts','src/legacy/notification-events.ts','src/common/testcase-publication.policy.ts','src/common/human-review-principal.ts',
 'migrations/V1_init_schema.sql','migrations/V2_test_cases_and_suites.sql','migrations/V5_api_tokens_webhooks.sql','migrations/V58_actors_identity.sql','migrations/V61_attachments_audit_logs_actor_fk.sql','migrations/V65_mcp_agent_actor.sql','migrations/V115_attachments_soft_delete.sql','package.json'])
source_names.update('Tesbo-Frontend/'+n for n in [
 'lib/api.ts','lib/zyraCacheSync.ts','app/globals.css','components/TopBar.tsx','components/agents/TaskQuickViewPanel.tsx','components/agents/ZyraChatReviewPanel.tsx','components/agents/ReviewBoard.tsx','app/(app)/projects/[id]/agents/page.tsx','app/(app)/projects/[id]/agents/tasks/page.tsx','app/(app)/projects/[id]/agents/tasks/[taskId]/page.tsx','app/(app)/projects/[id]/agents/zyra/settings/page.tsx','app/(app)/projects/[id]/agents/zyra/page.tsx','app/(app)/projects/[id]/requirements/page.tsx','app/(app)/projects/[id]/testcases/[tcId]/page.tsx','package.json'])
source_names.update(['AGENTS.md','CLAUDE.md','Tesbo-Frontend/AGENTS.md','package.json'])
freshness=[]
for name in sorted(source_names):
    p=SRC/name
    add(p, 'source discovery input; relevant cited functions/declarations or literal/caller inventory, not blanket whole-file correctness')
    q=NEW/name
    if q.exists():
        freshness.append({'path': name, 'at_9519': digest(p.read_bytes()), 'at_965a87a1': digest(q.read_bytes()), 'byte_identical': p.read_bytes()==q.read_bytes()})
old_api=(SRC/'Tesbo-Frontend/lib/api.ts').read_text().splitlines(keepends=True)
new_api=(NEW/'Tesbo-Frontend/lib/api.ts').read_text().splitlines(keepends=True)
api_prefix={'path':'Tesbo-Frontend/lib/api.ts','scope':'first 4900 lines, covering task/proposal definitions and functions, before Model Studio change hunk at old line4925','old_sha256':digest(''.join(old_api[:4900]).encode()),'new_sha256':digest(''.join(new_api[:4900]).encode()),'byte_identical':old_api[:4900]==new_api[:4900]}
out={'reviewer':'/root/blue_i3_allocation_delta','date':'2026-11-20','method_pin':'d83549c85a4dcd047fb40dc4fba4ec62737ab0fc','source_commit':git('rev-parse','HEAD'),'source_tree':git('rev-parse','HEAD^{tree}'),'source_clean':not bool(git('status','--porcelain')),'freshness_comparison_commit':'965a87a13d2669354598f8d4b912f36fdb148867','inputs':inputs,'literal_census':{'scope':'tracked backend production src/migrations and frontend; excludes .spec., __tests__, node_modules; comments retained; not external clients or runtime telemetry','occurrences':len(literal),'files':len(set(x['path'] for x in literal)),'matches':literal},'freshness':freshness,'task_api_scope_comparison':api_prefix,'evidence_level':'manual source/design review plus deterministic inventory/hash accounting; no application tests, database, services, browser or external clients','limitations':['No all-repository semantic audit or external consumer telemetry.','Inventory/hashing is not branch execution.','Historical reviewer evidence retains original pin.','Storage-compatible S3 conditional immutability and actual client image consumption not tested.','No formal two-member Blue quorum in this standalone receipt.']}
target=BASE/'assurance-working/blue-i3-allocation-inputs.json'
target.write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({'path':str(target),'sha256':digest(target.read_bytes()),'inputs':len(inputs),'literal_occurrences':len(literal),'literal_files':len(set(x['path'] for x in literal)),'freshness_changed':[x['path'] for x in freshness if not x['byte_identical']],'task_api_prefix_identical':api_prefix['byte_identical']},indent=2))
