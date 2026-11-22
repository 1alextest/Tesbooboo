import { randomUUID } from "node:crypto";
import { Client, Pool } from "pg";
import { DatabaseService } from "../database/database.service";
import { CustomFieldsService } from "../custom-fields/custom-fields.service";
import { CustomTagsService } from "../custom-tags/custom-tags.service";
import type { PlanLimitsService } from "../plan-limits/plan-limits.service";
import { ProjectLookupService } from "../request-cache/project-lookup.service";
import { RequestCacheService } from "../request-cache/request-cache.service";
import type { AppConfigService } from "../config/app-config.service";
import { makeLegacy } from "./test-helpers/legacy-service.fixture";
import { KNOWLEDGE_DOCUMENT_REVISION_SQL } from "./knowledge-document-revision";

const url=process.env.DATABASE_URL || "";
const human={kind:"human_session" as const};
type Body=Record<string,any>;

(/\/tesbo_ci(?:\?|$)/.test(url) ? describe : describe.skip)("native testcase proposal review — migrated PostgreSQL",()=>{
  let admin:Client,pool:Pool,project:string,user:string,token:string,foreignProject:string;
  const stamp=randomUUID(),applicationName=`proposal-review-${stamp}`;
  const previousPreview=process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED;
  beforeAll(async()=>{
    process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED="1";
    admin=new Client({connectionString:url});await admin.connect();
    pool=new Pool({connectionString:url,max:6,application_name:applicationName});
    user=(await admin.query("INSERT INTO users(email,name) VALUES ($1,'Proposal review QA') RETURNING id",[`proposal-${stamp}@tesbo.invalid`])).rows[0].id;
    const org=(await admin.query("INSERT INTO organizations(name,slug) VALUES ('Proposal review QA',$1) RETURNING id",[`proposal-${stamp}`])).rows[0].id;
    project=(await admin.query("INSERT INTO projects(organization_id,key,name) VALUES ($1,'PVR','Proposal review QA') RETURNING id",[org])).rows[0].id;
    foreignProject=(await admin.query("INSERT INTO projects(organization_id,key,name) VALUES ($1,'PVF','Unrelated proposal project') RETURNING id",[org])).rows[0].id;
    await admin.query("INSERT INTO organization_members(organization_id,user_id,role) VALUES ($1,$2,'owner')",[org,user]);
    await admin.query("INSERT INTO project_members(project_id,user_id,role) VALUES ($1,$2,'owner')",[project,user]);
    await admin.query("UPDATE users SET active_organization_id=$2 WHERE id=$1",[user,org]);
    token=(await admin.query("INSERT INTO api_tokens(user_id,project_id,name,token_hash,scopes) VALUES ($1,$2,'Disposable proposal producer',$3,'read,write') RETURNING id",[user,project,randomUUID().replaceAll("-","").repeat(2)])).rows[0].id;
  });
  afterAll(async()=>{
    if(previousPreview===undefined)delete process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED;else process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED=previousPreview;
    await pool?.end();await admin?.end();
  });
  function service(){
    const db=new DatabaseService(pool),svc=makeLegacy(db);
    const internals=svc as unknown as Body;
    const plans={assertCustomFieldsEnabled:jest.fn().mockResolvedValue(undefined)} as unknown as PlanLimitsService;
    internals.customFields=new CustomFieldsService(db,plans,new ProjectLookupService(db,new RequestCacheService({} as AppConfigService)),svc);
    internals.customTags=new CustomTagsService(db,svc,internals.testcasesListCache);
    jest.spyOn(internals,"enqueueTestcaseEmbedding").mockReturnValue(undefined);
    jest.spyOn(internals,"notifyZyraTask").mockResolvedValue(undefined);
    jest.spyOn(internals,"queueZyraTicketComments").mockResolvedValue(undefined);
    return svc;
  }
  const nativeCases=()=>admin.query("SELECT * FROM testcases WHERE project_id=$1 ORDER BY id",[project]);
  const tasks=()=>admin.query("SELECT * FROM ai_generation_requests WHERE project_id=$1 ORDER BY id",[project]);
  const stage=(operations:Body[],requestKey=randomUUID(),principal:Body=human)=>service().stageTestcaseChanges(project,user,{requestKey,operations},principal as never);
  const read=(id:string)=>service().zyraTask(project,user,id);
  const save=(review:Body,indexes:number[],extra:Body={},svc=service())=>svc.zyraSave(project,user,review.id,{expectedProposalRevision:review.proposalRevision,selectedDraftIndexes:indexes,...extra},human);
  const suite=async(name:string)=>(await admin.query("INSERT INTO suites(project_id,name) VALUES ($1,$2) RETURNING id",[project,`${name} ${randomUUID()}`])).rows[0].id as string;

  it("default-off preview has no persisted effects and same-key content replay is bounded",async()=>{
    const before=(await tasks()).rows,casesBefore=(await nativeCases()).rows;
    process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED="0";
    try{await expect(stage([{opType:"create",draft:{title:"Preview remains off"}}])).rejects.toMatchObject({status:501});}
    finally{process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED="1";}
    expect((await tasks()).rows).toEqual(before);expect((await nativeCases()).rows).toEqual(casesBefore);
    const key=randomUUID(),operations=[{opType:"create",draft:{title:"Unpublished external case"}}];
    const first=await stage(operations,key,{kind:"api_token",tokenId:token,transport:"rest"});
    const repeated=await stage(operations,key,{kind:"api_token",tokenId:token,transport:"rest"});
    expect(repeated.id).toBe(first.id);expect(first.proposalProvenance).toMatchObject({kind:"api_token",tokenId:token,issuerId:user,actorId:null});
    await expect(stage([{opType:"create",draft:{title:"Changed request"}}],key,{kind:"api_token",tokenId:token,transport:"rest"})).rejects.toMatchObject({status:409});
    expect((await nativeCases()).rows).toEqual(casesBefore);
  });

  it("publishes only explicit selected operations with atomic human receipts, truthful totals and retry recovery",async()=>{
    const review=await stage([{opType:"create",draft:{title:"First selected case",postconditions:"Exact postcondition"}},{opType:"create",draft:{title:"Still pending case"}}]);
    const before=(await nativeCases()).rows;
    await expect(service().zyraSave(project,user,review.id,{expectedProposalRevision:review.proposalRevision,selectedDraftIndexes:[0]},{kind:"api_token"})).rejects.toMatchObject({status:403});
    for(const body of [{selectedDraftIndexes:[0]},{expectedProposalRevision:review.proposalRevision},{expectedProposalRevision:review.proposalRevision,selectedDraftIndexes:[0,0]},{expectedProposalRevision:review.proposalRevision,selectedDraftIndexes:[9]}]){
      await expect(service().zyraSave(project,user,review.id,body,human)).rejects.toMatchObject({status:400});
    }
    expect((await nativeCases()).rows).toEqual(before);
    const first=await save(review,[0]);
    expect(first).toMatchObject({savedCount:1,remaining:1,replayed:false});
    expect(first.testcases[0]).toMatchObject({status:"Draft",createdBy:user,postconditions:"Exact postcondition"});
    expect(first.saveReceipt).toMatchObject({principalKind:"human_session",reviewerId:user,proposalRevision:review.proposalRevision,selectedDraftIndexes:[0],reviewedSnapshot:review.proposalSnapshot});
    const pending=await read(review.id);expect(pending).toMatchObject({taskStatus:"in_review",generatedCount:2,savedCount:1});expect(pending.drafts).toHaveLength(1);
    const after=(await nativeCases()).rows;
    const retry=await save(review,[0]);expect(retry.replayed).toBe(true);expect(retry.saveReceipt?.id).toBe(first.saveReceipt?.id);expect((await nativeCases()).rows).toEqual(after);
    expect((await admin.query("SELECT id FROM audit_logs WHERE entity_id=$1 AND action='testcase_proposals_applied'",[review.id])).rows).toHaveLength(1);
    await save(pending,[0]);expect(await read(review.id)).toMatchObject({taskStatus:"done",generatedCount:2,savedCount:2,drafts:[]});
  });

  it("keeps committed review receipts and trusted producer identity immutable without promoting legacy rows",async()=>{
    const review=await stage([{opType:"create",draft:{title:"Immutable receipt"}},{opType:"create",draft:{title:"Discardable remaining proposal"}}]);
    await save(review,[0]);
    const before=(await admin.query("SELECT save_events,proposal_provenance,proposal_request_key,proposal_request_digest FROM ai_generation_requests WHERE id=$1",[review.id])).rows[0];
    for(const assignment of [
      "save_events='[]'::jsonb",
      "save_events=jsonb_set(save_events,'{0,reviewerId}','\"forged-reviewer\"'::jsonb)",
      "proposal_provenance='{}'::jsonb",
      "proposal_request_key='rewritten-key'",
      "proposal_request_digest=repeat('a',64)",
    ]){
      await expect(admin.query(`UPDATE ai_generation_requests SET ${assignment} WHERE id=$1`,[review.id])).rejects.toThrow(/immutable/);
    }
    expect((await admin.query("SELECT save_events,proposal_provenance,proposal_request_key,proposal_request_digest FROM ai_generation_requests WHERE id=$1",[review.id])).rows[0]).toEqual(before);
    const deleted=await service().zyraDeleteDraft(project,user,review.id,0,human);
    expect(deleted).toMatchObject({generatedCount:2,savedCount:1,drafts:[]});
    expect(deleted.proposalRevision).toMatch(/^[a-f0-9]{64}$/);
    expect(deleted.proposalSnapshot).toEqual((await read(review.id)).proposalSnapshot);
    const legacy=(await admin.query("INSERT INTO ai_generation_requests(project_id,requested_by,provider,model,user_story,requested_count,generated_count,generated_payload,task_status) VALUES ($1,$2,'legacy','none','Unobserved legacy producer',1,1,'[]'::jsonb,'in_review') RETURNING id",[project,user])).rows[0].id;
    await expect(admin.query("UPDATE ai_generation_requests SET proposal_provenance=$2::jsonb WHERE id=$1",[legacy,JSON.stringify({kind:"human_session",actorId:user})])).rejects.toThrow(/immutable/);
  });

  it.each(["preserve","none","existing","new"])("binds the human suite choice (%s) and keeps the staged default distinct",async choice=>{
    const a=await suite("Staged suite"),b=await suite("Chosen suite"),newName=`Reviewed new suite ${randomUUID()}`;
    const review=await stage([{opType:"create",draft:{title:`Suite choice ${choice}`,suiteId:a}}]);
    const parameters=choice==="none" ? {suiteId:null} : choice==="existing" ? {suiteId:b} : choice==="new" ? {suiteName:newName} : {};
    const result=await save(review,[0],parameters);
    const expected=choice==="preserve" ? a : choice==="none" ? null : choice==="existing" ? b : (await admin.query("SELECT id FROM suites WHERE project_id=$1 AND name=$2",[project,newName])).rows[0].id;
    expect(result.testcases[0].suiteId).toBe(expected);
    expect(result.saveReceipt?.applyParameters).toMatchObject({suiteIdProvided:choice==="none"||choice==="existing",suiteNameProvided:choice==="new"});
  });

  it("rejects a changed proposal or dependency before creating a chosen suite",async()=>{
    const review=await stage([{opType:"create",draft:{title:"Original proposal",steps:[{action:"Preserve",expectedResult:"Still visible"}]}}]);
    const edited=await service().zyraEditDraft(project,user,review.id,0,{title:"Changed proposal"},human);
    const name=`No orphan ${randomUUID()}`,before=(await nativeCases()).rows;
    await expect(save(review,[0],{suiteName:name})).rejects.toMatchObject({status:409});
    expect((await nativeCases()).rows).toEqual(before);expect((await admin.query("SELECT id FROM suites WHERE project_id=$1 AND name=$2",[project,name])).rows).toHaveLength(0);
    const fresh=await read(review.id);
    expect(edited.proposalRevision).toMatch(/^[a-f0-9]{64}$/);
    expect(edited.proposalRevision).toBe(fresh.proposalRevision);
    expect(edited.proposalSnapshot).toEqual(fresh.proposalSnapshot);
    expect(fresh.proposalSnapshot.operations[0].draft.steps).toContain("Preserve");
    const field=(await admin.query("INSERT INTO custom_field_definitions(project_id,key,name,field_type) VALUES ($1,$2,'Changed review dependency','text') RETURNING id",[project,randomUUID()])).rows[0].id;
    await expect(save(fresh,[0],{suiteName:name})).rejects.toMatchObject({status:409});
    await admin.query("DELETE FROM custom_field_definitions WHERE id=$1",[field]);
    const current=await read(review.id);expect(current.proposalRevision).not.toBe(fresh.proposalRevision);
    await save(current,[0],{suiteName:name});
  });

  it("validates target edit plus semantic binding, foreign targets and current authoring role",async()=>{
    const created=await save(await stage([{opType:"create",draft:{title:"Baseline target"}}]),[0]);
    const id=created.testcases[0].id,target=await service().getTestCaseForUser(user,project,id);
    const proposal=await stage([{opType:"update",testcaseId:id,expectedRevision:target.editRevision,fields:{description:"Selected change"}}]);
    await admin.query("UPDATE testcases SET title='Later edit' WHERE id=$1",[id]);
    await expect(save(proposal,[0])).rejects.toMatchObject({status:409});
    await expect(save(await read(proposal.id),[0])).rejects.toMatchObject({status:409}); // Refreshed UI cannot silently rebase a staged target.
    const foreign=(await admin.query("INSERT INTO testcases(project_id,external_id,title) VALUES ($1,$2,'Foreign target') RETURNING id",[foreignProject,randomUUID().slice(0,20)])).rows[0].id;
    await expect(stage([{opType:"archive",testcaseId:foreign,expectedRevision:"a".repeat(64)}])).rejects.toMatchObject({status:404});
    const simple=await stage([{opType:"create",draft:{title:"Role protected"}}]);
    await admin.query("UPDATE project_members SET role='guest' WHERE project_id=$1 AND user_id=$2",[project,user]);
    try{await expect(save(simple,[0])).rejects.toMatchObject({status:403});}
    finally{await admin.query("UPDATE project_members SET role='owner' WHERE project_id=$1 AND user_id=$2",[project,user]);}
  });

  it("rolls back selected cases, suite creation, audit and receipt on mandatory audit failure",async()=>{
    const review=await stage([{opType:"create",draft:{title:"Atomic first"}},{opType:"create",draft:{title:"Atomic second"}}]);
    const before=(await nativeCases()).rows,taskBefore=(await admin.query("SELECT * FROM ai_generation_requests WHERE id=$1",[review.id])).rows;
    const svc=service(),original=svc.logProjectActivity.bind(svc),name=`Rolled back suite ${randomUUID()}`;
    const audit=jest.spyOn(svc,"logProjectActivity").mockImplementation(async(...args)=>{
      if(args[2]==="testcase_proposals_applied")throw new Error("Mandatory decision audit unavailable");
      return original(...args);
    });
    await expect(save(review,[0,1],{suiteName:name},svc)).rejects.toThrow("Mandatory decision audit unavailable");
    expect((await nativeCases()).rows).toEqual(before);expect((await admin.query("SELECT * FROM ai_generation_requests WHERE id=$1",[review.id])).rows).toEqual(taskBefore);
    expect((await admin.query("SELECT id FROM suites WHERE project_id=$1 AND name=$2",[project,name])).rows).toHaveLength(0);
    expect((await admin.query("SELECT id FROM audit_logs WHERE diff->>'taskId'=$1",[review.id])).rows).toHaveLength(0);
    audit.mockRestore();await save(review,[0,1],{suiteName:name});
  });

  it.each(["native","proposal"])("preserves accepted run identity when a %s edit renames the current case",async route=>{
    const svc=service(),created=await svc.createTestCase(project,user,{title:"Accepted run identity",status:"Draft"});
    const approve=async()=>{
      const current=await svc.getTestCaseForUser(user,project,created.id);
      await svc.approveTestCaseForUser(user,project,created.id,{
        expectedRevision:current.editRevision,expectedApprovalRevision:current.approvalRevision
      },human);
      return svc.getTestCaseForUser(user,project,created.id);
    };
    const original=await approve();
    const run=await svc.createCycleWithTestcasesForUser(user,project,{name:"Original selected case",testcaseIds:[created.id]});
    const evidence=async()=>({
      run:(await admin.query("SELECT * FROM cycles WHERE id=$1",[run.cycle.id])).rows,
      items:(await admin.query("SELECT * FROM cycle_items WHERE cycle_id=$1 ORDER BY id",[run.cycle.id])).rows,
      executions:(await admin.query("SELECT e.* FROM executions e JOIN cycle_items i ON i.id=e.cycle_item_id WHERE i.cycle_id=$1 ORDER BY e.id",[run.cycle.id])).rows
    });
    // external_id is limited to 32 characters; a full hyphenless UUID would exceed it before the
    // rename under test ever runs.
    const before=await evidence(),renamed=`REN-${randomUUID().replaceAll("-","").slice(0,20)}`;
    expect(before.items).toHaveLength(1);
    expect(before.items[0]).toMatchObject({snapshot_external_id:original.externalId,snapshot_approval_revision:original.approvalRevision});
    if(route==="native") await svc.updateTestCaseForUser(user,project,created.id,{externalId:renamed,expectedRevision:original.editRevision});
    else await save(await stage([{opType:"update",testcaseId:created.id,expectedRevision:original.editRevision,fields:{externalId:renamed}}]),[0]);
    const current=await svc.getTestCaseForUser(user,project,created.id);
    expect(current).toMatchObject({id:created.id,externalId:renamed,status:"In Review"});
    expect(await evidence()).toEqual(before);
    const reviewed=await approve();
    const next=await svc.createCycleWithTestcasesForUser(user,project,{name:"New selected case",testcaseIds:[created.id]});
    expect((await admin.query("SELECT * FROM cycle_items WHERE cycle_id=$1",[next.cycle.id])).rows).toEqual([
      expect.objectContaining({testcase_id:created.id,snapshot_external_id:renamed,snapshot_approval_revision:reviewed.approvalRevision})
    ]);
    expect(await evidence()).toEqual(before);
  });

  it("waits for a live dependency writer, then rejects the old coherent review without effects",async()=>{
    // custom_tags.name is varchar(40): a hyphenated UUID plus "Before " fails during setup,
    // before the transaction race can run. Keep the unique suffix within the native limit.
    const tagSuffix=randomUUID().replaceAll("-","");
    const tag=(await admin.query("INSERT INTO custom_tags(project_id,name) VALUES ($1,$2) RETURNING id",[project,`Before ${tagSuffix}`])).rows[0].id;
    const review=await stage([{opType:"create",draft:{title:"Concurrent definition",customTagIds:[tag]}}]),before=(await nativeCases()).rows;
    const blocker=new Client({connectionString:url});await blocker.connect();await blocker.query("BEGIN");
    await blocker.query("UPDATE custom_tags SET name=$2 WHERE id=$1",[tag,`After ${tagSuffix}`]);
    const attempt=save(review,[0]).then(()=>null,(error:unknown)=>error);
    try{
      const deadline=Date.now()+5000;let waiting=false;
      while(Date.now()<deadline){
        waiting=!!(await admin.query("SELECT 1 FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock' AND query LIKE '%project_members%'",[applicationName])).rowCount;
        if(waiting)break;await new Promise(resolve=>setTimeout(resolve,20));
      }
      expect(waiting).toBe(true);await blocker.query("COMMIT");
      expect(await attempt).toMatchObject({status:409});expect((await nativeCases()).rows).toEqual(before);
    }finally{await blocker.query("ROLLBACK");await attempt;await blocker.end();}
  },15000);

  /*
   * Work Package A Slice 1 — requirement change bundles are staging-only. These tests prove the
   * reviewed payload is the single authoritative JSON, that retries cannot change it, that the
   * Skills gate refuses publication with zero native writes, and that rejection/withdrawal and
   * project/lineage checks work without inventing official records.
   */
  describe("requirement change bundle staging",()=>{
    const requirementDoc=async(title="Base requirement",extra:Body={})=>{
      const folder=(await admin.query("SELECT id FROM knowledge_folders WHERE project_id=$1 LIMIT 1",[project])).rows[0]?.id
        || (await admin.query("INSERT INTO knowledge_folders(organization_id,project_id,name,is_root) SELECT organization_id,id,'Knowledge base',true FROM projects WHERE id=$1 RETURNING id",[project])).rows[0].id;
      const cols=Object.keys(extra), vals=Object.values(extra).map((value)=>JSON.stringify(value));
      const base=(await admin.query(
        `INSERT INTO knowledge_documents(organization_id,project_id,folder_id,title,content_json,content_html,content_text,document_type,status,created_by,updated_by)
         SELECT organization_id,id,$4,$2,'{}'::jsonb,'<p>body</p>','body','requirement_note','draft',$3,$3 FROM projects WHERE id=$1 RETURNING id`,
        [project,`${title} ${randomUUID()}`,user,folder])).rows[0].id;
      if(cols.length) await admin.query(`UPDATE knowledge_documents SET ${cols.map((col,i)=>`${col}=$${i+2}`).join(",")} WHERE id=$1`,[base,...vals]);
      return base as string;
    };
    const revision=async(id:string)=>String((await admin.query(`SELECT ${KNOWLEDGE_DOCUMENT_REVISION_SQL} AS edit_revision FROM knowledge_documents WHERE id=$1`,[id])).rows[0].edit_revision);
    const ops=(overrides:Body={})=>{
      const requirementOperationId=randomUUID(),testcaseOperationId=randomUUID();
      const criteria=overrides.criteria||[{key:"AC-1",text:"The first obligation"},{key:"AC-2",text:"The second obligation"}];
      return [
        {opType:"requirement_revision",operationId:requirementOperationId,
          ...(overrides.documentId?{documentId:overrides.documentId}:{}),...(overrides.expectedRevision?{expectedRevision:overrides.expectedRevision}:{}),
          title:overrides.title||`Native requirement ${randomUUID()}`,description:"Requirement description",criteria},
        {opType:"testcase_create",operationId:testcaseOperationId,draft:{title:`Bundle case ${randomUUID()}`,description:"Candidate case"}},
        {opType:"requirement_case_link",operationId:randomUUID(),requirementOperationId,testcaseOperationId,
          criterionKeys:overrides.criterionKeys||[criteria[0].key]}
      ];
    };
    const stageBundle=(operations:Body[],key=randomUUID(),principal:Body={kind:"api_token",tokenId:token,transport:"rest"})=>
      service().stageRequirementChangeBundle(project,user,{requestKey:key,operations},principal as never);
    const docCounts=async()=>({
      documents:(await admin.query("SELECT id FROM knowledge_documents WHERE project_id=$1 ORDER BY id",[project])).rows,
      versions:(await admin.query("SELECT id FROM knowledge_document_versions v JOIN knowledge_documents d ON d.id=v.document_id WHERE d.project_id=$1 ORDER BY v.id",[project])).rows,
      cases:(await admin.query("SELECT id FROM testcases WHERE project_id=$1 ORDER BY id",[project])).rows,
      approvals:(await admin.query("SELECT r.id FROM testcase_approval_receipts r JOIN testcases t ON t.id=r.testcase_id WHERE t.project_id=$1 ORDER BY r.id",[project])).rows
    });

    it("stages one inert, idempotent bundle whose reviewed revision cannot drift",async()=>{
      const before=await docCounts();
      const key=randomUUID(),operations=ops();
      const first=await stageBundle(operations,key);
      expect(first.requirementBundle).toHaveLength(3);
      expect(first.drafts).toEqual([]);
      expect(first.skillContext).toMatchObject({status:"unavailable"});
      expect(first.proposalRevision).toMatch(/^[a-f0-9]{64}$/);
      expect(first.taskStatus).toBe("in_review");
      expect((first.proposalSnapshot as Body).operations).toHaveLength(3);
      expect(await docCounts()).toEqual(before);
      const retried=await stageBundle(operations,key);
      expect(retried.id).toBe(first.id);
      expect(retried.proposalRevision).toBe(first.proposalRevision);
      await expect(stageBundle(ops(),key)).rejects.toMatchObject({status:409});
      expect((await read(first.id)).proposalRevision).toBe(first.proposalRevision);
      expect(await docCounts()).toEqual(before);
    });

    it("binds an existing requirement document to its exact revision and preserves external ownership",async()=>{
      const documentId=await requirementDoc("Revision base");
      const editRevision=await revision(documentId);
      const before=await docCounts();
      await expect(stageBundle(ops({documentId,expectedRevision:"0".repeat(64)}))).rejects.toMatchObject({status:409});
      expect(await docCounts()).toEqual(before);
      const staged=await stageBundle(ops({documentId,expectedRevision:editRevision}));
      expect(staged.requirementBundle?.find((entry:Body)=>entry.opType==="requirement_revision")).toMatchObject({documentId,expectedRevision:editRevision});
      const mirror=await requirementDoc("Provider mirror",{source_provider:"jira",source_external_id:`mirror-${randomUUID()}`,source_role:"mirror",is_read_only:true});
      await expect(stageBundle(ops({documentId:mirror,expectedRevision:await revision(mirror)}))).rejects.toMatchObject({status:409});
      await expect(stageBundle(ops({documentId:randomUUID(),expectedRevision:"a".repeat(64)}))).rejects.toMatchObject({status:404});
    });

    it("refuses malformed bundles without writing a task",async()=>{
      const before=(await tasks()).rows;
      const operations=ops();
      await expect(stageBundle([operations[0]] as Body[])).resolves.toMatchObject({taskStatus:"in_review"}); // revision-only is allowed
      const linkOnly=operations[2] as Body;
      await expect(stageBundle([operations[0],linkOnly])).rejects.toMatchObject({status:400});
      await expect(stageBundle(ops({criterionKeys:["AC-9"]}))).rejects.toMatchObject({status:400});
      const duplicated=[...ops(),{...operations[0]}];
      await expect(stageBundle(duplicated)).rejects.toMatchObject({status:400});
      expect((await tasks()).rows.filter((row:Body)=>!before.some((old:Body)=>old.id===row.id))).toHaveLength(1);
    });

    it("blocks publication before any write and freezes the bundle against draft edits",async()=>{
      const staged=await stageBundle(ops());
      const before=await docCounts(),taskBefore=(await tasks()).rows.length;
      await expect(save(staged,[0])).rejects.toMatchObject({status:409,response:{code:"SKILL_CONTEXT_UNAVAILABLE"}});
      await expect(service().zyraDeleteDraft(project,user,staged.id,0,human)).rejects.toMatchObject({status:409});
      await expect(service().zyraEditDraft(project,user,staged.id,0,{title:"Tampered"},human)).rejects.toMatchObject({status:409});
      expect(await docCounts()).toEqual(before);
      expect((await tasks()).rows).toHaveLength(taskBefore);
      const current=await read(staged.id);
      expect(current.taskStatus).toBe("in_review");
      expect(current.proposalRevision).toBe(staged.proposalRevision);
      expect((await admin.query("SELECT save_events FROM ai_generation_requests WHERE id=$1",[staged.id])).rows[0].save_events).toEqual([]);
      expect((await docCounts()).approvals).toEqual(before.approvals);
    });

    it("authorizes rejection and withdrawal without publishing",async()=>{
      const reviewer=(await admin.query("INSERT INTO users(email,name) VALUES ($1,'Bundle reviewer') RETURNING id",[`bundle-reviewer-${randomUUID()}@tesbo.invalid`])).rows[0].id;
      await admin.query("INSERT INTO project_members(project_id,user_id,role) VALUES ($1,$2,'qa_engineer')",[project,reviewer]);
      const rejected=await stageBundle(ops());
      await expect(service().rejectRequirementProposal(project,reviewer,rejected.id,{},human)).rejects.toMatchObject({status:403});
      const closed=await service().rejectRequirementProposal(project,user,rejected.id,{reason:"Not acceptable yet"},human);
      expect(closed.taskStatus).toBe("done");
      expect(closed.activities.some((entry:Body)=>entry.title==="Rejected requirement change bundle")).toBe(true);
      expect(await service().rejectRequirementProposal(project,user,rejected.id,{},human)).toMatchObject({taskStatus:"done"});
      const withdrawn=await stageBundle(ops());
      await expect(service().withdrawRequirementProposal(project,reviewer,withdrawn.id,{},human)).rejects.toMatchObject({status:403});
      await expect(service().withdrawRequirementProposal(project,user,withdrawn.id,{}, {kind:"api_token"} as never)).rejects.toMatchObject({status:403});
      const own=await service().withdrawRequirementProposal(project,user,withdrawn.id,{reason:"Superseded"},human);
      expect(own.taskStatus).toBe("done");
      await admin.query("DELETE FROM project_members WHERE project_id=$1 AND user_id=$2",[project,reviewer]);
    });

    it("isolates bundles by project and rejects mismatched link references",async()=>{
      const foreignUser=(await admin.query("INSERT INTO users(email,name) VALUES ($1,'Foreign bundle user') RETURNING id",[`foreign-bundle-${randomUUID()}@tesbo.invalid`])).rows[0].id;
      await admin.query("INSERT INTO project_members(project_id,user_id,role) VALUES ($1,$2,'owner')",[foreignProject,foreignUser]);
      await expect(service().stageRequirementChangeBundle(foreignProject,user,{requestKey:randomUUID(),operations:ops()},{kind:"human_session"} as never)).rejects.toMatchObject({status:404});
      const staged=await stageBundle(ops());
      await expect(service().requirementProposalTask(foreignProject,foreignUser,staged.id)).rejects.toMatchObject({status:404});
      const broken=ops();
      (broken[2] as Body).testcaseOperationId=randomUUID();
      await expect(stageBundle(broken)).rejects.toMatchObject({status:400});
      await admin.query("DELETE FROM project_members WHERE project_id=$1 AND user_id=$2",[foreignProject,foreignUser]);
    });
  });
});
