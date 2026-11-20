import { ForbiddenException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import type { AddressInfo } from 'node:net';
import { ModelStudioModelsController } from '/workspace/scratch/fb086055b433/tesbo-review-3ebda243/Tesbo-Backend-Nest/src/behavior-graph/model-studio-models.controller';
import { ModelStudioRepository } from '/workspace/scratch/fb086055b433/tesbo-review-3ebda243/Tesbo-Backend-Nest/src/behavior-graph/model-studio-repository';
import { ApiTokenRestGuard } from '/workspace/scratch/fb086055b433/tesbo-review-3ebda243/Tesbo-Backend-Nest/src/auth/api-token-rest.guard';
import { LegacyService } from '/workspace/scratch/fb086055b433/tesbo-review-3ebda243/Tesbo-Backend-Nest/src/legacy/legacy.service';

// Reviewer-authored real Nest/HTTP/controller/guard/repository check. Authentication identity and
// persistence are injected fixtures; no real token parsing, session, database or browser is exercised.
const user='00000000-0000-4000-8000-000000000001', project='00000000-0000-4000-8000-000000000002';
const model='00000000-0000-4000-8000-000000000003', revision='00000000-0000-4000-8000-000000000004';
const testcase='00000000-0000-4000-8000-000000000005', hash='a'.repeat(64);
const definition={schemaVersion:'tesbo-fsm-draft/1',semantics:'SEQUENTIAL_FSM',initialStateId:'start',states:[{id:'start',label:'Start'},{id:'done',label:'Done'}],transitions:[{id:'finish',from:'start',to:'done',action:'Submit',expectedObservation:'Accepted'}]};
let app:INestApplication, base:string;
let approved=false, member=true;
const records={approvals:[] as unknown[],cases:[] as any[],mappings:[] as unknown[]};
const query=jest.fn(async(sql:string,values:any[]=[])=>{
  if(sql.includes('FROM mbt_models'))return{rows:[{id:model,name:'HTTP fixture'}]};
  if(sql.includes('FROM mbt_model_revisions'))return{rows:[{id:revision,model_id:model,content_hash:hash,content:definition,revision_number:1,status:approved?'approved':'draft',model_name:'HTTP fixture'}]};
  if(sql.includes('INSERT INTO mbt_model_approvals')){approved=true;records.approvals.push(values);return{rows:[{id:'approval',model_revision_id:revision,content_hash:hash,approved_by:user}]};}
  if(sql.includes('FROM mbt_model_approvals'))return{rows:approved?[{id:'approval',model_revision_id:revision,content_hash:hash,approved_by:user}]:[]};
  if(sql.includes('UPDATE mbt_model_revisions')||sql.includes('pg_advisory_xact_lock'))return{rows:[],rowCount:1};
  if(sql.includes('SELECT testcase_id FROM mbt_generated_cases'))return{rows:[]};
  if(sql.includes('INSERT INTO mbt_generated_cases')){records.mappings.push(values);return{rows:[],rowCount:1};}
  throw new Error('Unexpected SQL '+sql);
});
const access=jest.fn(async()=>{if(!member)throw new ForbiddenException('revoked');return{id:project};});
const legacy={requireProjectAccess:access,createTestCase:jest.fn(async(_project:string,_user:string,body:any)=>{records.cases.push(body);return{id:testcase,...body};})};
const repository=new ModelStudioRepository({query,transaction:async(work:any)=>work({query})} as never,legacy as never);
const noEffects=()=>expect(records).toEqual({approvals:[],cases:[],mappings:[]});
async function request(route:string,principal:'human'|'read'|'write'|'anonymous',body:any={}){
 const response=await fetch(`${base}/api/projects/${project}/model-studio/models/${model}/revisions/${revision}/${route}`,{method:'POST',headers:{'content-type':'application/json','x-test-principal':principal},body:JSON.stringify(body)});
 return{status:response.status,body:await response.json()};
}
beforeAll(async()=>{
 const module=await Test.createTestingModule({controllers:[ModelStudioModelsController],providers:[{provide:ModelStudioRepository,useValue:repository},{provide:LegacyService,useValue:legacy},{provide:APP_GUARD,useClass:ApiTokenRestGuard}]}).compile();
 app=module.createNestApplication();
 app.use((req:any,_res:any,next:()=>void)=>{const p=req.headers['x-test-principal'];req.userId=p==='anonymous'?null:user;if(p==='read'||p==='write')req.apiToken={tokenId:'fixture',projectId:project,userId:user,scopes:[p]};next();});
 await app.listen(0,'127.0.0.1');base=`http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
});
afterAll(async()=>{await app?.close();});
beforeEach(()=>{approved=false;member=true;records.approvals=[];records.cases=[];records.mappings=[];query.mockClear();access.mockClear();legacy.createTestCase.mockClear();});

it.each(['approve','candidates'])('actual HTTP %s refuses read/write credentials despite body identity claims',async route=>{
 for(const principal of ['read','write'] as const){const r=await request(route,principal,{expectedHash:hash,principal:{kind:'human_session'},approvedBy:user});expect(r).toMatchObject({status:403,body:{code:'HUMAN_PUBLICATION_REQUIRED'}});}
 noEffects();expect(query).not.toHaveBeenCalled();expect(access).not.toHaveBeenCalled();
});
it.each(['approve','candidates'])('actual HTTP %s refuses anonymous and revoked human identities',async route=>{
 expect((await request(route,'anonymous',{expectedHash:hash})).status).toBe(403);member=false;expect((await request(route,'human',{expectedHash:hash})).status).toBe(403);noEffects();expect(query).not.toHaveBeenCalled();
});
it('human HTTP review and candidate publication work while machine generation remains usable',async()=>{
 const approval=await request('approve','human',{expectedHash:hash});expect(approval.status).toBe(201);expect(records.approvals).toHaveLength(1);
 const generation={strategy:'edge_coverage',maxPaths:20,maxDepth:12};
 const generated=await request('generate','write',generation);expect(generated.status).toBe(200);expect(generated.body.paths.length).toBeGreaterThan(0);
 const candidate=await request('candidates','human',{...generation,digests:[generated.body.paths[0].digest]});expect(candidate).toMatchObject({status:201,body:{created:1,skipped:0}});
 expect(records.cases).toHaveLength(1);expect(records.cases[0].status).toBe('Draft');expect(records.mappings).toHaveLength(1);
});
it.each([undefined,{kind:'api_token'}])('shared domain owners reject missing or machine principal %j',async principal=>{
 for(const method of ['approveRevisionForUser','createCasesFromPathsForUser'] as const)await expect(repository[method](user,project,model,revision,{expectedHash:hash,principal:{kind:'human_session'}},principal as never)).rejects.toMatchObject({status:403,response:{code:'HUMAN_REVIEW_REQUIRED'}});
 noEffects();expect(query).not.toHaveBeenCalled();expect(access).not.toHaveBeenCalled();
});
