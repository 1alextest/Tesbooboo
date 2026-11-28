const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const cp = require('node:child_process');
const deps = '/workspace/scratch/fb086055b433/Tesbooboo/Tesbo-Backend-Nest/node_modules';
const ts = require(path.join(deps, 'typescript'));
const nest = require(path.join(deps, '@nestjs/common'));
const root = '/workspace/scratch/fb086055b433/tesbo-review-integration';
function load(relative, overrides={}) {
  const filename = path.join(root, relative);
  const exports = {};
  const source = fs.readFileSync(filename, 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true,emitDecoratorMetadata:false} }).outputText;
  const loader = (name) => {
    if (Object.hasOwn(overrides,name)) return overrides[name];
    if (name==='@nestjs/common') return nest;
    if (name.startsWith('node:') || ['crypto','path'].includes(name)) return require(name);
    if (name.startsWith('.')) return load(path.relative(root,path.resolve(path.dirname(filename),name+'.ts')),overrides);
    return require(path.join(deps,name));
  };
  vm.runInNewContext(code, {exports,require:loader,process:{env:{}},console,Buffer,URL,setTimeout,clearTimeout}, {filename});
  return exports;
}
const project='00000000-0000-4000-8000-000000000002', user='00000000-0000-4000-8000-000000000001';
const model='00000000-0000-4000-8000-000000000003', revision='00000000-0000-4000-8000-000000000004', hash='a'.repeat(64);
(async()=>{
 const stubs={'../legacy/legacy.service':{LegacyService:class{}},'../database/database.service':{DatabaseService:class{}}};
 const {ApiTokenRestGuard}=load('Tesbo-Backend-Nest/src/auth/api-token-rest.guard.ts',stubs);
 const guard=new ApiTokenRestGuard({requireProjectAccess:async()=>({id:project})});
 const context=(suffix)=>({switchToHttp:()=>({getRequest:()=>({method:'POST',path:`/api/projects/${project}${suffix}`,apiToken:{projectId:project,userId:user,scopes:['read','write']}})})});
 const result=[];
 for(const suffix of [`/testcases`,`/model-studio/models/${model}/revisions/${revision}/approve`,`/model-studio/models/${model}/revisions/${revision}/candidates`]){
   try {result.push({suffix,allowed:await guard.canActivate(context(suffix))});}
   catch(e){result.push({suffix,allowed:false,status:e.getStatus(),code:e.getResponse().code});}
 }
 assert.equal(result[0].allowed,false); assert.equal(result[1].allowed,true); assert.equal(result[2].allowed,true);
 const approvalWrites=[];
 const row={id:revision,model_id:model,content_hash:hash,revision_number:1,status:'draft',created_at:'fixture'};
 const query=async(sql,values)=>{
   if(sql.includes('FROM mbt_models'))return {rows:[{id:model,name:'Fixture'}]};
   if(sql.includes('INSERT INTO mbt_model_approvals')){approvalWrites.push(values);return {rows:[{id:'approval',model_revision_id:revision,content_hash:hash,approved_by:values[4]}]};}
   if(sql.startsWith('UPDATE mbt_model_revisions')){row.status='approved';return {rows:[]};}
   if(sql.includes('FROM mbt_model_revisions'))return {rows:[row]};
   throw new Error('Unexpected SQL: '+sql);
 };
 const {ModelStudioRepository}=load('Tesbo-Backend-Nest/src/behavior-graph/model-studio-repository.ts',stubs);
 const repo=new ModelStudioRepository({transaction:fn=>fn({query})},{requireProjectAccess:async()=>({id:project})});
 const approved=await repo.approveRevisionForUser(user,project,model,revision,{expectedHash:hash});
 assert.equal(approvalWrites.length,1);assert.equal(approved.approval.approvedBy,user);
 console.log(JSON.stringify({probe:'machine Model Studio approval entrance',evidence:'EXECUTED isolated production guard/service with mocked DB and membership; not HTTP/DB/runtime proof',routes:result,approvalWithoutPrincipal:approved.approval},null,2));

 async function observeMigrator(source,directCli){
   const effects=[],pools=[],env={};const module={};
   const imports={crypto:{},dotenv:{config:()=>effects.push('dotenv')},path,
     fs:{existsSync:filename=>{effects.push('filesystem');return !filename.endsWith('.env');},readdirSync:()=>{effects.push('migration listing');return[];}},
     pg:{Pool:class{constructor(options){effects.push('pool');pools.push(options);}async connect(){effects.push('connect');throw new Error('synthetic refusal; no database');}}}};
   const loader=Object.assign(name=>{if(!(name in imports))throw new Error(name);return imports[name];},{main:directCli?module:{}});
   const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
   vm.runInNewContext(js,{require:loader,module,exports:{},URL,process:{env,cwd:()=>'/synthetic',exit:()=>effects.push('exit')},console:{error:()=>effects.push('error'),log:()=>{},warn:()=>{}}});
   await new Promise(resolve=>setImmediate(resolve));return{effects,pools};
 }
 const relative='Tesbo-Backend-Nest/src/database/migrate.ts';
 const baseline=cp.execFileSync('git',['show',`6897f989b055a955280f810c7daace86f74057fa:${relative}`],{cwd:root,encoding:'utf8'});
 const target=fs.readFileSync(path.join(root,relative),'utf8');
 const migration={baselineImport:await observeMigrator(baseline,false),targetImport:await observeMigrator(target,false),baselineMissingConfigCLI:await observeMigrator(baseline,true),targetMissingConfigCLI:await observeMigrator(target,true)};
 assert.deepEqual(migration.baselineImport.effects,[]);
 assert.equal(migration.baselineMissingConfigCLI.pools.length,0);
 assert.equal(migration.targetImport.pools[0].connectionString,'postgresql://localhost:5432/tesbo');
 assert.equal(migration.targetMissingConfigCLI.pools[0].connectionString,'postgresql://localhost:5432/tesbo');
 console.log(JSON.stringify({probe:'inherited migration-runner ancestry gap; not authored PR deletion',evidence:'EXECUTED production source transpiled in VM; all filesystem/dotenv/pg/process effects mocked; no database or network',...migration},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
