import { pathToFileURL } from 'node:url';
export const REPO='1alextest/Tesbooboo';
export const CHECKS=[
 'workflow-lint','migration-names','mbt-symbolic-pilot','sdk-quality',
 'frontend-quality','backend-quality','architecture-quality',
 'api-mcp-contracts','database-integrity','transactional-concurrency',
 'playwright-smoke','dependency-audit','container-security',
 'codeql-javascript-typescript','current-tree-secrets','workflow-security',
 'secret-guard','reporter-safety','mutation-critical',
 'dependency-lock-integrity (sdk/playwright-reporter)',
 'dependency-lock-integrity (.)','dependency-lock-integrity (e2e)',
 'dependency-lock-integrity (Tesbo-Backend-Nest)',
 'dependency-lock-integrity (Tesbo-Frontend)'
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
export async function run(env=process.env,args=process.argv.slice(2)){
 if(env.GITHUB_REPOSITORY&&env.GITHUB_REPOSITORY!==REPO)throw Error('Wrong repository');
 const apply=args.includes('--apply'),phase=args.includes('--assurance')?'assurance':'foundation';
 if(apply&&(!env.GITHUB_RULESET_ADMIN_TOKEN||env.TESBO_RULESET_APPLY_CONFIRM!=='apply:'+REPO))
 throw Error('Admin token and exact explicit confirmation required');
 const token=apply?env.GITHUB_RULESET_ADMIN_TOKEN:env.GITHUB_TOKEN;
 if(apply&&phase==='assurance'){
  const gate=await api('/contents/.github/workflows/assurance-pr-gate.yml?ref=development',token);
  if(gate.type!=='file')throw Error('Trusted verifier workflow absent');
 }
 const list=await api('/rulesets',token),results=[];
 for(const branch of ['development','main']){
  const name='Protect '+branch+(branch==='main'?' — release only':'');
  const items=list.filter(x=>x.name===name&&x.target==='branch');
  if(items.length!==1)throw Error('Ambiguous live rule set for '+branch);
  let rule=await api('/rulesets/'+items[0].id,token);
  if(!exact(rule,branch))throw Error('Unsafe scope for '+branch);
  if(apply){
   await api('/rulesets/'+rule.id,token,'PUT',patch(rule,branch,phase));
   rule=await api('/rulesets/'+rule.id,token);
  }
  const errors=check(rule,branch,phase);
  results.push({branch,ruleId:rule.id,verified:errors.length===0,errors});
 }
 console.log(JSON.stringify({mode:apply?'applied-and-readback':'read-only',phase,results},null,2));
 if(results.some(x=>!x.verified))process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
 run().catch(e=>{console.error('Branch enforcement BLOCKED: '+e.message);process.exitCode=1});
