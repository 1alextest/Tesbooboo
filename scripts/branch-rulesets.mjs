import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
export const REPO='1alextest/Tesbooboo';
// The activation owner intentionally accepts a bounded, reviewed source contract instead of
// trying to interpret arbitrary YAML, expressions, reusable workflows or dynamic matrices.
// These exact files have unfiltered pull_request triggers for both target branches. Their
// literal job names and the five directory matrix values produce the contexts below.
// Reviewed source: 9f506df2b6fae0f74e2ae2c5172b9ef865ef2457, with the smoke workflow
// from 8becc53fae3fe6eb299f00c07e278647d4370be3. Contexts are defined here once.
// A workflow edit (including a same-name job edit) requires source review and pin reconciliation.
// Pins/active metadata establish installed configuration, not successful live check publication,
// a unique GitHub Actions producer identity, or proof that GitHub denies an unauthorized merge.
export const WORKFLOW_SOURCES=[
 {path:'.github/workflows/ci-hygiene.yml',sha:'a7b62c3ca45e0de84fb083b90c4500e1e4bc619f',
  contexts:['workflow-lint','migration-names','mbt-symbolic-pilot']},
 {path:'.github/workflows/core-quality.yml',sha:'65082b4edda7cd5dc7194ae0c0f590d0b04f7a8f',
  contexts:['sdk-quality','frontend-quality','backend-quality','architecture-quality']},
 {path:'.github/workflows/behavioral-quality.yml',sha:'39161db0ed9758a7c4161555a0b26d7679438fa7',
  contexts:['api-mcp-contracts','database-integrity','transactional-concurrency']},
 {path:'.github/workflows/smoke-security-quality.yml',sha:'1fe6478b188c0bb5dce20c6b756058a2ed7f232d',
  contexts:['playwright-smoke','dependency-audit','container-security']},
 {path:'.github/workflows/security-analysis.yml',sha:'39249b3ae3702887e51bafbd5d26ea4d7b6befad',
  contexts:['codeql-javascript-typescript','dependency-lock-integrity (sdk/playwright-reporter)',
   'dependency-lock-integrity (.)','dependency-lock-integrity (e2e)',
   'dependency-lock-integrity (Tesbo-Backend-Nest)','dependency-lock-integrity (Tesbo-Frontend)']},
 {path:'.github/workflows/free-repository-security.yml',sha:'e4df5ba14a6ef12a2ff3eee3a1d19e1002c6e22e',
  contexts:['current-tree-secrets','workflow-security']},
 {path:'.github/workflows/repository-secret-guard.yml',sha:'3e30e6abdd3c0ea15f74f036b0ef70c3e6eada1f',
  contexts:['secret-guard','reporter-safety']},
 {path:'.github/workflows/mutation-quality.yml',sha:'d5d62ede4ffae82d9bf85194902c5939a353867b',
  contexts:['mutation-critical']}
];
export const CHECKS=WORKFLOW_SOURCES.flatMap(source=>source.contexts);
// Runtime dependency closure: the publisher imports the verifier, which reads this policy.
// Tests and fixtures are not runtime imports. Never execute retrieved branch code here.
const PUBLISHER_SOURCES=[
 {path:'.github/workflows/assurance-pr-gate.yml',sha:'3910a61102a8765876f5134475be1a2e1506da63'},
 {path:'.github/assurance-policy.json',sha:'9b396e0aa7160b68453e99273a9ef285ea02f125'},
 {path:'scripts/assurance-pr-gate.mjs',sha:'ade522787581b2124d45c455c79ae833a6edaa2c'},
 {path:'scripts/publish-assurance-status.mjs',sha:'856d664b0f6165ae6ffbfc75394866bd9c2379cf'}
];
export const required=phase=>phase==='foundation'?CHECKS:phase==='assurance'?[...CHECKS,'specification-assurance']:(()=>{throw Error('Invalid phase')})();
export function exact(rule,branch){
 const x=rule?.conditions?.ref_name;
 return rule?.source===REPO&&rule?.target==='branch'&&rule?.enforcement==='active'&&
 Array.isArray(rule.bypass_actors)&&rule.bypass_actors.length===0&&
 x?.include?.length===1&&x.include[0]==='refs/heads/'+branch&&x.exclude?.length===0;
}
export function check(rule,branch,phase='foundation'){
 if(!exact(rule,branch))return ['scope, enforcement or bypass invalid'];
 const by=new Map((rule.rules||[]).map(x=>[x.type,x.parameters||{}])),fail=[];
 for(const x of ['deletion','non_fast_forward'])if(!by.has(x))fail.push('missing '+x);
 const pr=by.get('pull_request');
 if(!(pr?.required_approving_review_count>=1))fail.push('no required review');
 if(pr?.dismiss_stale_reviews_on_push!==true)fail.push('stale reviews not dismissed');
 if(pr?.require_last_push_approval!==true)fail.push('last push not reviewed');
 if(pr?.required_review_thread_resolution!==true)fail.push('open threads not blocked');
 const st=by.get('required_status_checks');
 if(st?.strict_required_status_checks_policy!==true)fail.push('not up to date');
 const actual=new Set((st?.required_status_checks||[]).map(x=>x.context));
 for(const name of required(phase))if(!actual.has(name))fail.push('missing check '+name);
 return fail;
}
export function patch(rule,branch,phase='foundation'){
 if(!exact(rule,branch))throw Error('Refuse unexpected GitHub ruleset');
 const types=new Set(rule.rules.map(x=>x.type));
 if(!['deletion','non_fast_forward','pull_request','required_status_checks'].every(x=>types.has(x)))
 throw Error('Required owner protection type missing');
 const rules=rule.rules.map(x=>{
  if(x.type==='pull_request')return {...x,parameters:{...x.parameters,required_approving_review_count:Math.max(1,x.parameters.required_approving_review_count||0),dismiss_stale_reviews_on_push:true,require_last_push_approval:true,required_review_thread_resolution:true}};
  if(x.type==='required_status_checks'){
   const map=new Map((x.parameters.required_status_checks||[]).map(c=>[c.context,c]));
   for(const context of required(phase))if(!map.has(context))map.set(context,{context});
   return {...x,parameters:{...x.parameters,strict_required_status_checks_policy:true,required_status_checks:[...map.values()]}};
  }
  return x;
 });
 return {name:rule.name,target:'branch',enforcement:'active',conditions:rule.conditions,bypass_actors:[],rules};
}
async function api(path,token,method='GET',data){
 const headers={'accept':'application/vnd.github+json','x-github-api-version':'2022-11-28'};
 if(token)headers.authorization='Bearer '+token;
 if(data)headers['content-type']='application/json';
 const res=await fetch('https://api.github.com/repos/'+REPO+path,{method,headers,...(data?{body:JSON.stringify(data)}:{})});
 if(!res.ok)throw Error('Ruleset API '+method+' HTTP '+res.status);
 return res.json();
}
const gitSha=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
async function repository(token){
 const repo=await api('',token);
 if(repo.full_name!==REPO||typeof repo.default_branch!=='string'||!repo.default_branch||
    repo.default_branch.split('/').some(part=>!part||part==='.'||part==='..'))
  throw Error('Invalid repository default-branch readback');
 return repo;
}
async function sourceRef(branch,token){
 const ref=await api('/git/ref/heads/'+branch.split('/').map(encodeURIComponent).join('/'),token);
 if(ref.ref!=='refs/heads/'+branch||ref.object?.type!=='commit'||!gitSha(ref.object.sha))
  throw Error('Invalid source ref for '+branch);
 return ref.object.sha;
}
async function sourceTree(branch,token){
 const sha=await sourceRef(branch,token),commit=await api('/git/commits/'+sha,token);
 if(commit.sha!==sha||!gitSha(commit.tree?.sha))throw Error('Invalid source commit for '+branch);
 const tree=await api('/git/trees/'+commit.tree.sha+'?recursive=1',token);
 if(tree.sha!==commit.tree.sha||tree.truncated!==false||!Array.isArray(tree.tree))
  throw Error('Incomplete immutable tree inventory for '+branch);
 const entries=new Map();
 for(const entry of tree.tree){
  if(typeof entry?.path!=='string'||!entry.path||entries.has(entry.path)||!gitSha(entry.sha))
   throw Error('Malformed or duplicate tree inventory for '+branch);
  entries.set(entry.path,entry);
 }
 return {branch,sha,tree:commit.tree.sha,entries};
}
function requireSources(source,expected,label){
 for(const pin of expected){
  const entry=source.entries.get(pin.path);
  if(entry?.type!=='blob'||entry.mode!=='100644'||entry.sha!==pin.sha)
   throw Error('Required '+label+' source missing or changed on '+source.branch+': '+pin.path+
    '; review and reconcile the source pins before activation');
 }
}
async function preflight(plans,phase,token){
 const repo=await repository(token),sources=new Map();
 const getSource=async branch=>{
  if(!sources.has(branch))sources.set(branch,await sourceTree(branch,token));
  return sources.get(branch);
 };
 let publisher;
 if(phase==='assurance'){
  publisher=await getSource(repo.default_branch);
  requireSources(publisher,PUBLISHER_SOURCES,'publisher');
 }
 for(const {branch} of plans)requireSources(await getSource(branch),WORKFLOW_SOURCES,'CI context');
 // Native active state is only availability evidence. In particular, a shared Actions app ID
 // is not accepted as authentication of this particular publisher or its emitted check.
 const workflowPaths=WORKFLOW_SOURCES.map(source=>source.path);
 if(publisher)workflowPaths.push(PUBLISHER_SOURCES[0].path);
 for(const path of workflowPaths){
  const workflow=await api('/actions/workflows/'+encodeURIComponent(path.split('/').at(-1)),token);
  if(workflow.path!==path||workflow.state!=='active')
   throw Error('Required workflow is not active or its path changed: '+path);
 }
 // Collect and validate BOTH branch plans before any PUT. Recheck observed inputs immediately
 // before writing. GitHub provides no cross-ruleset transaction/CAS: a later race or failed PUT
 // can still leave partial application, so successful readback and live rollout proof remain required.
 if(phase==='assurance'&&(await repository(token)).default_branch!==repo.default_branch)
  throw Error('Repository default branch changed during activation preflight');
 for(const source of sources.values()){
  if(await sourceRef(source.branch,token)!==source.sha)
   throw Error('Source ref changed during activation preflight: '+source.branch);
 }
 for(const {branch,rule} of plans){
  if(!isDeepStrictEqual(await api('/rulesets/'+rule.id,token),rule))
   throw Error('Ruleset changed during activation preflight: '+branch);
 }
 return {
  sources:[...sources.values()].map(({branch,sha,tree})=>({branch,sha,tree})),
  ...(publisher?{publisherBranch:publisher.branch}:{}),
  scope:'reviewed installed sources and workflow availability; live publication/enforcement not verified'
 };
}
export async function run(env=process.env,args=process.argv.slice(2)){
 if(env.GITHUB_REPOSITORY&&env.GITHUB_REPOSITORY!==REPO)throw Error('Wrong repository');
 const apply=args.includes('--apply'),phase=args.includes('--assurance')?'assurance':'foundation';
 if(apply&&(!env.GITHUB_RULESET_ADMIN_TOKEN||env.TESBO_RULESET_APPLY_CONFIRM!=='apply:'+REPO))
 throw Error('Admin token and exact explicit confirmation required');
 const token=apply?env.GITHUB_RULESET_ADMIN_TOKEN:env.GITHUB_TOKEN;
 const list=await api('/rulesets',token),results=[],plans=[];
 for(const branch of ['development','main']){
  const name='Protect '+branch+(branch==='main'?' — release only':'');
  const items=list.filter(x=>x.name===name&&x.target==='branch');
  if(items.length!==1)throw Error('Ambiguous live rule set for '+branch);
  const rule=await api('/rulesets/'+items[0].id,token);
  if(!exact(rule,branch))throw Error('Unsafe scope for '+branch);
  // Existing unrelated required contexts remain unchanged. This preflight covers the
  // contexts introduced by this command; it does not redefine another producer's contract.
  plans.push({branch,rule,...(apply?{payload:patch(rule,branch,phase)}:{})});
 }
 const installation=apply?await preflight(plans,phase,token):undefined;
 for(const plan of plans){
  const {branch}=plan;
  let {rule}=plan;
  if(apply){
   await api('/rulesets/'+rule.id,token,'PUT',plan.payload);
   rule=await api('/rulesets/'+rule.id,token);
  }
  const errors=check(rule,branch,phase);
  results.push({branch,ruleId:rule.id,verified:errors.length===0,errors});
 }
 console.log(JSON.stringify({mode:apply?'applied-and-readback':'read-only',phase,results,
  ...(installation?{installation}:{})},null,2));
 if(results.some(x=>!x.verified))process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
 run().catch(e=>{console.error('Branch enforcement BLOCKED: '+e.message);process.exitCode=1});
