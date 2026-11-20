import { ModelStudioRepository } from '/workspace/scratch/fb086055b433/tesbo-review-9519b56d/Tesbo-Backend-Nest/src/behavior-graph/model-studio-repository';
import { makeLegacy } from '/workspace/scratch/fb086055b433/tesbo-review-9519b56d/Tesbo-Backend-Nest/src/legacy/test-helpers/legacy-service.fixture';

// Reviewer-authored controlled probes. All persistence and membership collaborators are mocks.
// These are discriminating contract checks, never real database/browser/HTTP proof.
const uid='00000000-0000-4000-8000-000000000001', project='00000000-0000-4000-8000-000000000002';
const model='00000000-0000-4000-8000-000000000003', revision='00000000-0000-4000-8000-000000000004';
const caseId='00000000-0000-4000-8000-000000000005', runId='00000000-0000-4000-8000-000000000006';
const bugId='00000000-0000-4000-8000-000000000007', executionId='00000000-0000-4000-8000-000000000008';

it.each(['manual','automation'])('canonical Bug association preserves an open %s execution outcome', async source => {
  const state={status:'Passed',executedBy:'original tester',executedAt:'original time'};
  const query=jest.fn(async (sql:string) => {
    if(sql.includes('SELECT c.id, c.source, c.closed_at FROM cycles')) return {rows:[{id:runId,source,closed_at:null}]};
    if(sql.includes('SELECT e.id, e.status, e.assignee_id')) return {rows:[{id:executionId,status:state.status,assignee_id:null,testcase_title:'Existing passed case'}]};
    if(sql.includes("UPDATE executions SET status = 'Failed'")) {state.status='Failed';state.executedBy=uid;state.executedAt='new time';}
    return {rows:[],rowCount:1};
  });
  const service=makeLegacy({query,transaction:async(work:any)=>work({query})} as never);
  jest.spyOn(service as any,'requireBugAccess').mockResolvedValue(project);
  jest.spyOn(service as any,'lockBugLinkTargets').mockResolvedValue(()=>{});
  jest.spyOn(service as any,'lockBugLinksOwner').mockResolvedValue([]);
  const association=jest.spyOn(service as any,'replaceBugLinks').mockResolvedValue(undefined);
  jest.spyOn(service,'getBug').mockResolvedValue({id:bugId} as never);
  jest.spyOn(service,'logProjectActivity').mockResolvedValue(undefined);
  jest.spyOn(service as any,'notifyExecutionChange').mockResolvedValue(undefined);
  const before={...state};
  await service.addBugLink(uid,bugId,{testcaseId:caseId,cycleId:runId,executionId});
  expect(association).toHaveBeenCalledTimes(1);
  // Canonical 00_README v1.4.28 lines 301, 303, 329: association is not a status correction.
  expect(state).toEqual(before);
});

it('accepted model mapping cannot silently use a later case revision', async () => {
  const mappingRevision='a'.repeat(64), currentRevision='b'.repeat(64), modelHash='c'.repeat(64);
  const query=jest.fn(async (sql:string, values:any[] = []) => {
    if(sql.includes('FROM mbt_models')) return {rows:[{id:model,name:'Independent mapping probe'}]};
    if(sql.includes('FROM mbt_model_revisions')) return {rows:[{id:revision,content_hash:modelHash,revision_number:1}]};
    if(sql.includes('FROM mbt_model_approvals')) return {rows:[{id:'approval',content_hash:modelHash}]};
    if(sql.includes('FROM mbt_generated_cases')) return {rows:[]};
    if(sql.includes('FROM mbt_model_case_links')) return {rows:[{id:'link-event-A',testcase_id:caseId,testcase_revision:mappingRevision,element_ids:['submit'],title:'Case A',status:'Approved',deleted:false}]};
    if(sql.includes('FROM testcases')) return {rows:[{id:caseId,title:'Reviewed Case B',status:'Approved',deleted:false,edit_revision:currentRevision}]};
    if(sql.includes('INSERT INTO mbt_model_runs')) return {rows:[{id:'manifest',project_id:project,model_id:model,model_revision_id:revision,approval_id:'approval',content_hash:modelHash,cycle_id:runId,manifest:JSON.parse(values[7])}]};
    throw new Error('Unexpected SQL '+sql);
  });
  const nativeWrite=jest.fn(async()=>({cycle:{id:runId,name:'Native run'},requested:1,added:1,skipped:0}));
  const repository=new ModelStudioRepository({transaction:async(work:any)=>work({query})} as never,{requireProjectAccess:async()=>({id:project}),createCycleWithTestcasesForUser:nativeWrite} as never);
  // Proposed MBT-C05 defines this exact reliance failure; binding native receipt for B is assumed valid.
  await expect(repository.dispatchRunForUser(uid,project,model,revision,{caseIds:[caseId]})).rejects.toMatchObject({status:409});
  expect(nativeWrite).not.toHaveBeenCalled();
});
