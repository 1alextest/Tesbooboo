import { createHash, randomUUID } from "node:crypto";
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
import { TESTCASE_APPROVAL_CURRENT_SQL, TESTCASE_APPROVAL_REVISION_SQL, TESTCASE_EDIT_REVISION_SQL } from "./testcase-edit-revision";

const url=process.env.DATABASE_URL || "";
const human={kind:"human_session" as const};
type Body=Record<string,any>;

(/\/tesbo_ci(?:\?|$)/.test(url) ? describe : describe.skip)("native testcase proposal review — migrated PostgreSQL",()=>{
  let admin:Client,pool:Pool,project:string,user:string,token:string,foreignProject:string,org:string;
  const stamp=randomUUID(),applicationName=`proposal-review-${stamp}`;
  const previousPreview=process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED;
  beforeAll(async()=>{
    process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED="1";
    admin=new Client({connectionString:url});await admin.connect();
    pool=new Pool({connectionString:url,max:6,application_name:applicationName});
    user=(await admin.query("INSERT INTO users(email,name) VALUES ($1,'Proposal review QA') RETURNING id",[`proposal-${stamp}@tesbo.invalid`])).rows[0].id;
    org=(await admin.query("INSERT INTO organizations(name,slug) VALUES ('Proposal review QA',$1) RETURNING id",[`proposal-${stamp}`])).rows[0].id;
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
    internals.ragIngestion={enqueueEmbedding:jest.fn().mockResolvedValue(undefined)};
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
      versions:(await admin.query("SELECT v.id FROM knowledge_document_versions v JOIN knowledge_documents d ON d.id=v.document_id WHERE d.project_id=$1 ORDER BY v.id",[project])).rows,
      cases:(await admin.query("SELECT id FROM testcases WHERE project_id=$1 ORDER BY id",[project])).rows,
      approvals:(await admin.query("SELECT r.id FROM testcase_approval_receipts r JOIN testcases t ON t.id=r.testcase_id WHERE t.project_id=$1 ORDER BY r.id",[project])).rows
    });

    it("stages one inert, idempotent bundle whose reviewed revision cannot drift",async()=>{
      const before=await docCounts();
      const key=randomUUID(),operations=ops();
      const first=await stageBundle(operations,key);
      expect(first.requirementBundle).toHaveLength(3);
      expect(first.drafts).toEqual([]);
      expect(first.skillContext).toMatchObject({status:"unassigned"});
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
      const taskRowBefore=(await admin.query("SELECT * FROM ai_generation_requests WHERE id=$1",[staged.id])).rows;
      await expect(service().zyraCloseTask(project,user,staged.id,human)).rejects.toMatchObject({status:409,response:{code:"REQUIREMENT_BUNDLE_IMMUTABLE"}});
      await expect(service().zyraFeedback(project,user,staged.id,{feedback:"Regenerate the bundle"},human)).rejects.toMatchObject({status:409,response:{code:"REQUIREMENT_BUNDLE_IMMUTABLE"}});
      expect((await admin.query("SELECT * FROM ai_generation_requests WHERE id=$1",[staged.id])).rows).toEqual(taskRowBefore);
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
      // Project access resolves through the caller's active workspace, so a reviewer who only has a
      // project_members row would 404 before the role guard ran and prove the wrong refusal.
      await admin.query("INSERT INTO organization_members(organization_id,user_id,role) VALUES ($1,$2,'qa_engineer')",[org,reviewer]);
      await admin.query("UPDATE users SET active_organization_id=$2 WHERE id=$1",[reviewer,org]);
      await admin.query("INSERT INTO project_members(project_id,user_id,role) VALUES ($1,$2,'qa_engineer')",[project,reviewer]);
      const rejected=await stageBundle(ops());
      await expect(service().zyraCloseTask(project,reviewer,rejected.id,human)).rejects.toMatchObject({status:409,response:{code:"REQUIREMENT_BUNDLE_IMMUTABLE"}});
      await expect(service().zyraFeedback(project,reviewer,rejected.id,{feedback:"Bypass the review"},human)).rejects.toMatchObject({status:409,response:{code:"REQUIREMENT_BUNDLE_IMMUTABLE"}});
      await expect(service().rejectRequirementProposal(project,reviewer,rejected.id,{expectedProposalRevision:rejected.proposalRevision},human)).rejects.toMatchObject({status:403});
      const closed=await service().rejectRequirementProposal(project,user,rejected.id,{expectedProposalRevision:rejected.proposalRevision,reason:"Not acceptable yet"},human);
      expect(closed.taskStatus).toBe("done");
      expect(closed.activities.some((entry:Body)=>entry.title==="Rejected requirement change bundle")).toBe(true);
      expect(await service().rejectRequirementProposal(project,user,rejected.id,{expectedProposalRevision:rejected.proposalRevision,reason:"Not acceptable yet"},human)).toMatchObject({taskStatus:"done",replayed:true});
      const withdrawn=await stageBundle(ops());
      await expect(service().withdrawRequirementProposal(project,reviewer,withdrawn.id,{expectedProposalRevision:withdrawn.proposalRevision},human)).rejects.toMatchObject({status:403});
      await expect(service().withdrawRequirementProposal(project,user,withdrawn.id,{expectedProposalRevision:withdrawn.proposalRevision}, {kind:"api_token"} as never)).rejects.toMatchObject({status:403});
      const own=await service().withdrawRequirementProposal(project,user,withdrawn.id,{expectedProposalRevision:withdrawn.proposalRevision,reason:"Superseded"},human);
      expect(own.taskStatus).toBe("done");
      await admin.query("DELETE FROM project_members WHERE project_id=$1 AND user_id=$2",[project,reviewer]);
    });

    it.each(["todo", "in_review", "done"])("the shared provider failure writer leaves a %s bundle untouched",async status=>{
      const staged=await stageBundle(ops());
      await admin.query("UPDATE ai_generation_requests SET task_status=$2 WHERE id=$1",[staged.id,status]);
      const before=(await admin.query("SELECT * FROM ai_generation_requests WHERE id=$1",[staged.id])).rows;
      const officialBefore=await docCounts(),svc=service();
      await (svc as unknown as Body).markZyraTaskFailed(project,staged.id,"A queued worker could not read this bundle");
      expect((await admin.query("SELECT * FROM ai_generation_requests WHERE id=$1",[staged.id])).rows).toEqual(before);
      expect((svc as unknown as Body).notifyZyraTask).not.toHaveBeenCalled();
      expect(await docCounts()).toEqual(officialBefore);
    });

    it("recovers the same request after its document or suite changed without restaging",async()=>{
      const documentId=await requirementDoc("Retry base"),suiteId=await suite("Retry suite"),key=randomUUID();
      const operations=ops({documentId,expectedRevision:await revision(documentId)});
      (operations[1] as Body).draft.suiteId=suiteId;
      const staged=await stageBundle(operations,key),before=(await tasks()).rows.length;
      await admin.query("UPDATE knowledge_documents SET title='Newer native revision' WHERE id=$1",[documentId]);
      await admin.query("UPDATE suites SET deleted_at=now() WHERE id=$1",[suiteId]);
      const recovered=await stageBundle(operations,key);
      expect(recovered.id).toBe(staged.id);
      expect(recovered.requirementBundle).toEqual(staged.requirementBundle);
      expect((await tasks()).rows).toHaveLength(before);
      await expect(stageBundle(operations,randomUUID())).rejects.toMatchObject({status:409});
    });

    it("requires exact decision context and commits only one of competing reject/withdraw requests",async()=>{
      const staged=await stageBundle(ops()),before=await docCounts();
      await expect(service().rejectRequirementProposal(project,user,staged.id,{},human)).rejects.toMatchObject({status:400});
      await expect(service().withdrawRequirementProposal(project,user,staged.id,{expectedProposalRevision:"0".repeat(64)},human)).rejects.toMatchObject({status:409});
      const decision={expectedProposalRevision:staged.proposalRevision,reason:"Exact review"};
      const blocker=new Client({connectionString:url});
      await blocker.connect();await blocker.query("BEGIN");
      await blocker.query("SELECT pg_advisory_xact_lock(hashtext($1))",[`suite-tree:${project}`]);
      const attempts=Promise.allSettled([
        service().rejectRequirementProposal(project,user,staged.id,decision,human),
        service().withdrawRequirementProposal(project,user,staged.id,decision,human)
      ]);
      let results:Awaited<typeof attempts>;
      try{
        const deadline=Date.now()+5000;let waiting=0;
        while(Date.now()<deadline){
          waiting=Number((await admin.query("SELECT COUNT(*)::int AS waiting FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock' AND query LIKE '%pg_advisory_xact_lock%'",[applicationName])).rows[0].waiting);
          if(waiting===2)break;await new Promise(resolve=>setTimeout(resolve,20));
        }
        expect(waiting).toBe(2);
        await blocker.query("COMMIT");
        results=await attempts;
      }finally{
        await blocker.query("ROLLBACK");await attempts;await blocker.end();
      }
      expect(results.filter(result=>result.status==="fulfilled")).toHaveLength(1);
      expect(results.filter(result=>result.status==="rejected")).toEqual([expect.objectContaining({reason:expect.objectContaining({status:409})})]);
      const closed=await read(staged.id),receipt=closed.requirementDecision;
      expect(receipt).toMatchObject({proposalRevision:staged.proposalRevision,reviewedSnapshot:staged.proposalSnapshot});
      const retry=receipt.decision==="rejected"
        ? await service().rejectRequirementProposal(project,user,staged.id,decision,human)
        : await service().withdrawRequirementProposal(project,user,staged.id,decision,human);
      expect(retry).toMatchObject({replayed:true,requirementDecision:receipt});
      expect(closed.activities.filter((entry:Body)=>entry.kind==="requirement_bundle_decision")).toHaveLength(1);
      expect((await admin.query("SELECT id FROM audit_logs WHERE entity_id=$1 AND action IN ('requirement_proposal_rejected','requirement_proposal_withdrawn')",[staged.id])).rows).toHaveLength(1);
      expect(await docCounts()).toEqual(before);
    },15000);

    it("rejects a changed review dependency and rolls back the decision when its audit fails",async()=>{
      const staged=await stageBundle(ops());
      const changedSuite=await suite("Changed after review");
      await expect(service().rejectRequirementProposal(project,user,staged.id,{expectedProposalRevision:staged.proposalRevision},human)).rejects.toMatchObject({status:409});
      const current=await read(staged.id),before=(await admin.query("SELECT * FROM ai_generation_requests WHERE id=$1",[staged.id])).rows;
      const svc=service();
      jest.spyOn(svc,"logProjectActivity").mockRejectedValue(new Error("Decision audit failed"));
      await expect(svc.rejectRequirementProposal(project,user,staged.id,{expectedProposalRevision:current.proposalRevision},human)).rejects.toThrow("Decision audit failed");
      expect((await admin.query("SELECT * FROM ai_generation_requests WHERE id=$1",[staged.id])).rows).toEqual(before);
      await admin.query("DELETE FROM suites WHERE id=$1",[changedSuite]);
    });

    it.each(["role", "payload"])("rechecks current %s after waiting for the project mutation boundary",async change=>{
      const staged=await stageBundle(ops()),blocker=new Client({connectionString:url});
      await blocker.connect();await blocker.query("BEGIN");
      await blocker.query("SELECT pg_advisory_xact_lock(hashtext($1))",[`suite-tree:${project}`]);
      const attempt=service().rejectRequirementProposal(project,user,staged.id,{expectedProposalRevision:staged.proposalRevision},human).then(()=>null,(error:unknown)=>error);
      try{
        const deadline=Date.now()+5000;let waiting=false;
        while(Date.now()<deadline){
          waiting=!!(await admin.query("SELECT 1 FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock' AND query LIKE '%pg_advisory_xact_lock%'",[applicationName])).rowCount;
          if(waiting)break;await new Promise(resolve=>setTimeout(resolve,20));
        }
        expect(waiting).toBe(true);
        if(change==="role")await admin.query("UPDATE project_members SET role='qa_engineer' WHERE project_id=$1 AND user_id=$2",[project,user]);
        else await admin.query("UPDATE ai_generation_requests SET generated_payload=jsonb_set(generated_payload,'{0,title}','\"A different reviewed candidate\"'::jsonb) WHERE id=$1",[staged.id]);
        await blocker.query("COMMIT");
        expect(await attempt).toMatchObject({status:change==="role"?403:409});
        const current=await read(staged.id);
        expect(current).toMatchObject({taskStatus:"in_review",requirementDecision:null});
        if(change==="role")expect(current.proposalRevision).toBe(staged.proposalRevision);
        else expect(current.proposalRevision).not.toBe(staged.proposalRevision);
      }finally{
        await blocker.query("ROLLBACK");await attempt;await blocker.end();
        await admin.query("UPDATE project_members SET role='owner' WHERE project_id=$1 AND user_id=$2",[project,user]);
      }
    },15000);

    it("rechecks MCP consent after waiting and refuses even a committed request retry after revocation",async()=>{
      const originalSettings=(await admin.query("SELECT settings FROM projects WHERE id=$1",[project])).rows[0].settings;
      const access={enabled:true,revision:1,clients:[{tokenId:token,clientName:"Disposable bundle client",scopes:["read","write"],
        expiresAt:null,allowedTools:["stage_requirement_change_bundle"]}]};
      const principal={kind:"api_token",tokenId:token,transport:"mcp"},key=randomUUID(),operations=ops();
      const blocker=new Client({connectionString:url});
      let attempt:Promise<unknown>|undefined;
      await blocker.connect();
      try{
        await admin.query("UPDATE projects SET settings=jsonb_set(COALESCE(settings,'{}'::jsonb),'{externalMcpAccess}',$2::jsonb) WHERE id=$1",[project,JSON.stringify(access)]);
        const staged=await stageBundle(operations,key,principal);
        expect(staged).toMatchObject({taskStatus:"in_review",proposalProvenance:{kind:"api_token",tokenId:token}});
        const before=(await tasks()).rows;
        await blocker.query("BEGIN");
        await blocker.query("SELECT pg_advisory_xact_lock(hashtext($1))",[`suite-tree:${project}`]);
        attempt=stageBundle(ops(),randomUUID(),principal).then(()=>null,(error:unknown)=>error);
        const deadline=Date.now()+5000;let waiting=false;
        while(Date.now()<deadline){
          waiting=!!(await admin.query("SELECT 1 FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock' AND query LIKE '%pg_advisory_xact_lock%'",[applicationName])).rowCount;
          if(waiting)break;await new Promise(resolve=>setTimeout(resolve,20));
        }
        expect(waiting).toBe(true);
        await admin.query("UPDATE projects SET settings=jsonb_set(settings,'{externalMcpAccess}',$2::jsonb) WHERE id=$1",[project,JSON.stringify({...access,enabled:false,revision:2})]);
        await blocker.query("COMMIT");
        expect(await attempt).toMatchObject({status:403});
        await expect(stageBundle(operations,key,principal)).rejects.toMatchObject({status:403});
        expect((await tasks()).rows).toEqual(before);
      }finally{
        await blocker.query("ROLLBACK");if(attempt)await attempt;await blocker.end();
        await admin.query("UPDATE projects SET settings=$2::jsonb WHERE id=$1",[project,JSON.stringify(originalSettings)]);
      }
    },15000);

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

    const skillFor=async(module:string,subtype:string,operation:string)=>{
      const doc=await service().createSkillCandidate(project,user,{title:`Skill ${operation} ${randomUUID()}`,module,subtype,skillKey:`SKL-${randomUUID().replaceAll("-","").slice(0,10).toUpperCase()}`,instructions:"Require observable outcomes, exact sources and explicit uncertainty."});
      const submitted=await service().submitKnowledgeDocument(project,user,doc.id,{expectedRevision:doc.editRevision,submissionKey:randomUUID()},human);
      const approved=await service().approveSkillVersion(project,user,doc.id,{versionId:submitted.id},human);
      const assignment=await service().assignSkill(project,user,{skillDocumentId:doc.id,versionId:approved.approvedVersionId,module,subtype,operation},human);
      return {doc,versionId:approved.approvedVersionId as string,assignmentId:String(assignment.assignment.id)};
    };
    const publishSkills=async()=>{
      const requirement=await skillFor("requirements","functional","requirement_revision");
      await service().assignSkill(project,user,{skillDocumentId:requirement.doc.id,versionId:requirement.versionId,module:"requirements",subtype:"functional",operation:"requirement_case_link"},human);
      const cases=await skillFor("test_cases","manual","testcase_create");
      return {requirement,cases};
    };
    const cleanupSkills=async(ids:string[])=>{for(const id of ids){await admin.query("UPDATE knowledge_documents SET reviewed_version_id=NULL WHERE id=$1",[id]);await admin.query("DELETE FROM knowledge_documents WHERE id=$1",[id]);}};
    const cleanupRequirement=async(id:string)=>{
      if(!id)return;
      await admin.query("DELETE FROM requirement_case_links WHERE project_id=$1 AND requirement_id=$2",[project,id]);
      await admin.query("DELETE FROM requirement_profiles WHERE document_id=$1",[id]);
      await admin.query("UPDATE knowledge_documents SET reviewed_version_id=NULL WHERE id=$1",[id]);
      await admin.query("DELETE FROM knowledge_documents WHERE id=$1",[id]);
    };
    const bundleWrites=async(taskId:string)=>({
      task:(await admin.query("SELECT * FROM ai_generation_requests WHERE id=$1",[taskId])).rows,
      documents:(await admin.query("SELECT * FROM knowledge_documents WHERE project_id=$1 ORDER BY id",[project])).rows,
      versions:(await admin.query("SELECT v.* FROM knowledge_document_versions v JOIN knowledge_documents d ON d.id=v.document_id WHERE d.project_id=$1 ORDER BY v.id",[project])).rows,
      profiles:(await admin.query("SELECT * FROM requirement_profiles WHERE project_id=$1 ORDER BY document_id",[project])).rows,
      links:(await admin.query("SELECT * FROM requirement_case_links WHERE project_id=$1 ORDER BY id",[project])).rows,
      cases:(await nativeCases()).rows,
      approvals:(await admin.query("SELECT r.* FROM testcase_approval_receipts r JOIN testcases t ON t.id=r.testcase_id WHERE t.project_id=$1 ORDER BY r.id",[project])).rows,
      audit:(await admin.query("SELECT * FROM audit_logs WHERE project_id=$1 ORDER BY id",[project])).rows
    });
    const assignmentWrites=async()=>({
      assignments:(await admin.query("SELECT * FROM skill_assignments WHERE project_id=$1 ORDER BY id",[project])).rows,
      audit:(await admin.query("SELECT * FROM audit_logs WHERE project_id=$1 ORDER BY id",[project])).rows
    });
    const waitUntil=async(predicate:()=>boolean|Promise<boolean>)=>{
      const deadline=Date.now()+5000;
      while(Date.now()<deadline){if(await predicate())return true;await new Promise(resolve=>setTimeout(resolve,20));}
      return false;
    };
    const waitingOn=async(pattern:string)=>!!(await admin.query(
      "SELECT 1 FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock' AND query LIKE $2",
      [applicationName,pattern]
    )).rowCount;
    const revisionsOf=async(id:string)=>(await admin.query(
      `SELECT ${TESTCASE_EDIT_REVISION_SQL} AS edit_revision, ${TESTCASE_APPROVAL_REVISION_SQL} AS approval_revision, ${TESTCASE_APPROVAL_CURRENT_SQL} AS approval_current FROM testcases WHERE id=$1`,[id]
    )).rows[0] as Body;
    const attempt=async(caseId:string,approvalRevision:string,status:string,at:Date)=>{
      const run=(await admin.query("INSERT INTO cycles(project_id,name,source,status) VALUES ($1,$2,'manual','In Progress') RETURNING id",[project,`Coverage ${randomUUID()}`])).rows[0].id;
      const item=(await admin.query("INSERT INTO cycle_items(cycle_id,testcase_id,snapshot_approval_revision) VALUES ($1,$2,$3) RETURNING id",[run,caseId,approvalRevision])).rows[0].id;
      await admin.query("INSERT INTO executions(cycle_item_id,status,executed_by,executed_at) VALUES ($1,$2,$3,$4)",[item,status,user,at]);
    };

    it("resolves exact skills, applies atomically and reports authored/approved/executed/passing separately",async()=>{
      const skills=await publishSkills();
      const skillIds=[skills.requirement.doc.id,skills.cases.doc.id];
      let requirementId="";
      try{
        const staged=await stageBundle(ops());
        expect(staged.skillContext).toMatchObject({status:"resolved"});
        expect(staged.skillContext.assignments).toHaveLength(3);
        const applied=await service().applyRequirementProposal(project,user,staged.id,{expectedProposalRevision:staged.proposalRevision},human);
        expect(applied.replayed).toBe(false);
        requirementId=applied.receipt.requirement.documentId;
        const caseId=applied.receipt.testcase.id;
        expect(applied.receipt.link.testcaseApprovalRevision).toBeNull();
        expect((await admin.query("SELECT COUNT(*)::int AS n FROM knowledge_document_versions WHERE document_id=$1 AND snapshot_kind='submitted'",[requirementId])).rows[0].n).toBe(1);
        expect((await admin.query("SELECT COUNT(*)::int AS n FROM testcases WHERE id=$1 AND status='Draft'",[caseId])).rows[0].n).toBe(1);

        let coverage=await service().requirementCoverage(project,user,requirementId);
        expect(coverage.readings).toMatchObject({authored:true,approved:false,executed:false,passing:false});

        const approved=await service().approveRequirementVersion(project,user,requirementId,{versionId:applied.receipt.requirement.versionId},human);
        expect(approved.approvedVersionId).toBeTruthy();
        const approvedState=await bundleWrites(staged.id);
        const approvalRetry=await service().approveRequirementVersion(project,user,requirementId,{versionId:applied.receipt.requirement.versionId},human);
        expect(approvalRetry).toMatchObject({approvedVersionId:approved.approvedVersionId,replayed:true});
        expect(await bundleWrites(staged.id)).toEqual(approvedState);
        coverage=await service().requirementCoverage(project,user,requirementId);
        expect(coverage.readings).toMatchObject({authored:true,approved:false,executed:false,passing:false});

        const before=await revisionsOf(caseId);
        await service().approveTestCaseForUser(user,project,caseId,{expectedRevision:before.edit_revision,expectedApprovalRevision:before.approval_revision},human);
        const after=await revisionsOf(caseId);
        const reapplied=await service().reapplyRequirementCaseLink(project,user,requirementId,coverage.cases[0].linkId,{expectedCaseRevision:after.edit_revision,expectedApprovalRevision:after.approval_revision},human);
        expect(reapplied.replayed).toBe(false);
        coverage=await service().requirementCoverage(project,user,requirementId);
        expect(coverage.readings).toMatchObject({authored:true,approved:true,executed:false,passing:false});

        await attempt(caseId,after.approval_revision,"Passed",new Date());
        coverage=await service().requirementCoverage(project,user,requirementId);
        expect(coverage.readings).toMatchObject({approved:true,executed:true,passing:true,mixed:false});

        await attempt(caseId,after.approval_revision,"Failed",new Date(Date.now()+1000));
        coverage=await service().requirementCoverage(project,user,requirementId);
        expect(coverage.readings).toMatchObject({executed:true,passing:false,mixed:true});
        expect(coverage.cases[0].latestAttempt?.status).toBe("Failed");
      }finally{
        if(requirementId){
          await admin.query("DELETE FROM requirement_case_links WHERE project_id=$1 AND requirement_id=$2",[project,requirementId]);
          await admin.query("DELETE FROM requirement_profiles WHERE document_id=$1",[requirementId]);
          await admin.query("UPDATE knowledge_documents SET reviewed_version_id=NULL WHERE id=$1",[requirementId]);
          await admin.query("DELETE FROM knowledge_documents WHERE id=$1",[requirementId]);
        }
        await cleanupSkills(skillIds);
      }
    });

    it.each(["apply","approval"])("marks a resolved pin stale after revocation before %s and preserves every native write",async phase=>{
      const skills=await publishSkills();
      let requirementId="";
      try{
        const staged=await stageBundle(ops());
        expect(staged.skillContext.status).toBe("resolved");
        const applied=phase==="approval"
          ? await service().applyRequirementProposal(project,user,staged.id,{expectedProposalRevision:staged.proposalRevision},human)
          : null;
        if(applied)requirementId=applied.receipt.requirement.documentId;
        await service().deactivateSkillAssignment(project,user,skills.requirement.assignmentId,{},human);
        const before=await bundleWrites(staged.id);
        const pending=applied
          ? service().approveRequirementVersion(project,user,requirementId,{versionId:applied.receipt.requirement.versionId},human)
          : service().applyRequirementProposal(project,user,staged.id,{expectedProposalRevision:staged.proposalRevision},human);
        await expect(pending).rejects.toMatchObject({status:409,response:{code:"SKILL_CONTEXT_STALE",current:{status:"unassigned"}}});
        expect(await bundleWrites(staged.id)).toEqual(before);
      }finally{
        await cleanupRequirement(requirementId);
        await cleanupSkills([skills.requirement.doc.id,skills.cases.doc.id]);
      }
    });

    it("re-resolves after the project assignment lock wait and refuses the writer's replacement generation",async()=>{
      const skills=await publishSkills();
      const locker=new Client({connectionString:url});await locker.connect();
      let pending:Promise<Body>|undefined;
      try{
        const staged=await stageBundle(ops());
        const before=await bundleWrites(staged.id);
        await locker.query("BEGIN");
        await locker.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)",[`skill-assignments:${project}`]);
        pending=service().applyRequirementProposal(project,user,staged.id,{expectedProposalRevision:staged.proposalRevision},human)
          .then(value=>({value}),error=>({error}));
        expect(await waitUntil(()=>waitingOn("%pg_advisory_xact_lock%"))).toBe(true);
        await locker.query("UPDATE skill_assignments SET status='inactive',deactivated_by=$2,deactivated_at=now() WHERE id=$1",[skills.requirement.assignmentId,user]);
        const replacement=(await locker.query(
          `INSERT INTO skill_assignments(project_id,module,subtype,operation,skill_document_id,skill_version_id,assigned_by,precedence)
           SELECT project_id,module,subtype,operation,skill_document_id,skill_version_id,$2,precedence
             FROM skill_assignments WHERE id=$1 RETURNING id`,
          [skills.requirement.assignmentId,user]
        )).rows[0].id;
        await locker.query("COMMIT");
        const refusal=(await pending).error;
        expect(refusal).toMatchObject({status:409,response:{code:"SKILL_CONTEXT_STALE",current:{status:"resolved"}}});
        expect(refusal.response.current.assignments.some((assignment:Body)=>assignment.assignmentId===replacement)).toBe(true);
        expect(await bundleWrites(staged.id)).toEqual(before);
      }finally{
        await locker.query("ROLLBACK").catch(()=>undefined);
        if(pending)await pending;
        await locker.end();
        await cleanupSkills([skills.requirement.doc.id,skills.cases.doc.id]);
      }
    },15000);

    it.each([
      {name:"exact then wildcard",first:{subtype:"functional",operation:"requirement_revision"},next:{subtype:"*",operation:"*"}},
      {name:"wildcard then exact",first:{subtype:"*",operation:"*"},next:{subtype:"functional",operation:"requirement_revision"}}
    ])("rejects $name overlap and rolls back both insertion and replacement",async({first,next})=>{
      const skill=await skillFor("requirements",first.subtype,first.operation);
      try{
        const body={skillDocumentId:skill.doc.id,versionId:skill.versionId,module:"requirements",...next};
        const beforeInsert=await assignmentWrites();
        await expect(service().assignSkill(project,user,body,human))
          .rejects.toMatchObject({status:409,response:{code:"SKILL_ASSIGNMENT_CONFLICT"}});
        expect(await assignmentWrites()).toEqual(beforeInsert);

        // A pre-existing ambiguous scope also must not lose its old generation on a failed replacement.
        await admin.query(
          `INSERT INTO skill_assignments(project_id,module,subtype,operation,skill_document_id,skill_version_id,assigned_by)
           VALUES ($1,'requirements',$2,$3,$4,$5,$6)`,
          [project,next.subtype,next.operation,skill.doc.id,skill.versionId,user]
        );
        const beforeReplace=await assignmentWrites();
        await expect(service().assignSkill(project,user,body,human))
          .rejects.toMatchObject({status:409,response:{code:"SKILL_ASSIGNMENT_CONFLICT"}});
        expect(await assignmentWrites()).toEqual(beforeReplace);
      }finally{await cleanupSkills([skill.doc.id]);}
    });

    it("rechecks membership after an assignment-row wait before deactivation",async()=>{
      const skill=await skillFor("requirements","functional","requirement_revision");
      const locker=new Client({connectionString:url});await locker.connect();
      let pending:Promise<Body>|undefined;
      try{
        const before=await assignmentWrites();
        await locker.query("BEGIN");
        await locker.query("SELECT id FROM skill_assignments WHERE id=$1 FOR UPDATE",[skill.assignmentId]);
        pending=service().deactivateSkillAssignment(project,user,skill.assignmentId,{},human)
          .then(value=>({value}),error=>({error}));
        expect(await waitUntil(()=>waitingOn("%skill_assignments%FOR UPDATE%"))).toBe(true);
        await admin.query("DELETE FROM project_members WHERE project_id=$1 AND user_id=$2",[project,user]);
        await locker.query("COMMIT");
        expect((await pending).error).toMatchObject({status:403});
        expect(await assignmentWrites()).toEqual(before);
      }finally{
        await locker.query("ROLLBACK").catch(()=>undefined);
        if(pending)await pending;
        await locker.end();
        await admin.query("INSERT INTO project_members(project_id,user_id,role) VALUES ($1,$2,'owner') ON CONFLICT DO NOTHING",[project,user]);
        await cleanupSkills([skill.doc.id]);
      }
    },15000);

    it.each(["apply","approval"])("holds the resolved basis through %s commit before concurrent deactivation",async phase=>{
      const skills=await publishSkills();
      const svc=service(),internals=svc as unknown as Body;
      let requirementId="",checkpoint=false,deactivationFinished=false;
      let release=()=>{};
      const gate=new Promise<void>(resolve=>{release=()=>resolve();});
      let protectedCall:Promise<Body>|undefined,deactivation:Promise<Body>|undefined,barrier:jest.SpyInstance|undefined;
      try{
        const staged=await stageBundle(ops());
        const applied=phase==="approval"
          ? await service().applyRequirementProposal(project,user,staged.id,{expectedProposalRevision:staged.proposalRevision},human)
          : null;
        if(applied)requirementId=applied.receipt.requirement.documentId;
        // Both existing methods are awaited immediately after final Skills validation, before native writes.
        const method=phase==="apply"?"applyRequirementRevision":"writeKnowledgeGovernedVersion";
        const original=internals[method].bind(internals);
        barrier=jest.spyOn(internals,method).mockImplementation(async(...args:unknown[])=>{
          checkpoint=true;await gate;return original(...args);
        });
        protectedCall=(applied
          ? svc.approveRequirementVersion(project,user,requirementId,{versionId:applied.receipt.requirement.versionId},human)
          : svc.applyRequirementProposal(project,user,staged.id,{expectedProposalRevision:staged.proposalRevision},human))
          .then(value=>({value}),error=>({error}));
        expect(await waitUntil(()=>checkpoint)).toBe(true);
        const before=await bundleWrites(staged.id);
        deactivation=service().deactivateSkillAssignment(project,user,skills.requirement.assignmentId,{},human)
          .then(value=>{deactivationFinished=true;return {value};},error=>{deactivationFinished=true;return {error};});
        expect(await waitUntil(()=>waitingOn("%pg_advisory_xact_lock%"))).toBe(true);
        expect(deactivationFinished).toBe(false);
        expect((await admin.query("SELECT status FROM skill_assignments WHERE id=$1",[skills.requirement.assignmentId])).rows[0].status).toBe("active");
        expect(await bundleWrites(staged.id)).toEqual(before);
        release();
        const protectedResult=await protectedCall;
        expect(protectedResult.error).toBeUndefined();
        expect(protectedResult.value.replayed).toBe(false);
        if(phase==="apply")requirementId=protectedResult.value.receipt.requirement.documentId;
        else expect(protectedResult.value.approvedVersionId).toBeTruthy();
        expect((await admin.query("SELECT task_status FROM ai_generation_requests WHERE id=$1",[staged.id])).rows[0].task_status).toBe("done");
        expect((await deactivation).value).toMatchObject({assignment:{status:"inactive"},replayed:false});
        if(phase==="approval")expect((await admin.query("SELECT status FROM knowledge_documents WHERE id=$1",[requirementId])).rows[0].status).toBe("approved");
      }finally{
        release();
        if(protectedCall){const result=await protectedCall;if(phase==="apply"&&result.value)requirementId=result.value.receipt.requirement.documentId;}
        if(deactivation)await deactivation;
        barrier?.mockRestore();
        await cleanupRequirement(requirementId);
        await cleanupSkills([skills.requirement.doc.id,skills.cases.doc.id]);
      }
    },15000);

    it("serializes exact apply against a suite-owning rejection without a task/suite deadlock",async()=>{
      const skills=await publishSkills();
      const rejectService=service(),internals=rejectService as unknown as Body;
      let suiteHeld=false,release=()=>{};
      const gate=new Promise<void>(resolve=>{release=()=>resolve();});
      const original=internals.lockTestcaseSuiteWrites.bind(internals);
      const barrier=jest.spyOn(internals,"lockTestcaseSuiteWrites").mockImplementation(async(...args:unknown[])=>{
        await original(...args);suiteHeld=true;await gate;
      });
      let rejection:Promise<Body>|undefined,application:Promise<Body>|undefined;
      try{
        const staged=await stageBundle(ops()),before=await bundleWrites(staged.id);
        const decision={expectedProposalRevision:staged.proposalRevision,reason:"Competing exact decision"};
        rejection=rejectService.rejectRequirementProposal(project,user,staged.id,decision,human)
          .then(value=>({value}),error=>({error}));
        expect(await waitUntil(()=>suiteHeld)).toBe(true);
        application=service().applyRequirementProposal(project,user,staged.id,decision,human)
          .then(value=>({value}),error=>({error}));
        expect(await waitUntil(async()=>!!(await admin.query(
          `SELECT 1 FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid
            WHERE a.application_name=$1 AND l.locktype='advisory' AND NOT l.granted
              AND l.objid=(hashtext($2)::bigint & 4294967295)::oid`,
          [applicationName,`suite-tree:${project}`]
        )).rowCount)).toBe(true);
        release();
        const rejected=await rejection,applied=await application;
        expect(rejected.error).toBeUndefined();
        expect(rejected.value.replayed).toBe(false);
        expect(applied.error).toMatchObject({status:409,response:{code:"PROPOSAL_REVIEW_CONFLICT"}});
        const closed=await read(staged.id),after=await bundleWrites(staged.id);
        expect(closed.requirementDecision.decision).toBe("rejected");
        expect(closed.activities.filter((entry:Body)=>entry.kind==="requirement_bundle_decision")).toHaveLength(1);
        for(const key of ["documents","versions","profiles","links","cases","approvals"] as const)expect(after[key]).toEqual(before[key]);
        expect(after.task[0].save_events).toEqual(before.task[0].save_events);
        expect(after.audit.filter(row=>row.entity_id===staged.id&&["requirement_bundle_applied","requirement_proposal_rejected"].includes(row.action))).toHaveLength(1);
      }finally{
        release();
        if(rejection)await rejection;
        if(application){const result=await application;if(result.value)await cleanupRequirement(result.value.receipt.requirement.documentId);}
        barrier.mockRestore();
        await cleanupSkills([skills.requirement.doc.id,skills.cases.doc.id]);
      }
    },15000);

    it("requires explicit deactivation for type or Trash transitions and recovers hidden active history",async()=>{
      const skill=await skillFor("requirements","functional","requirement_revision");
      try{
        const before=await assignmentWrites();
        const documentBefore=(await admin.query("SELECT * FROM knowledge_documents WHERE id=$1",[skill.doc.id])).rows;
        await expect(service().updateKnowledgeDocument(project,user,skill.doc.id,{documentType:"general"}))
          .rejects.toMatchObject({status:409,response:{code:"SKILL_ASSIGNMENT_ACTIVE"}});
        await expect(service().deleteKnowledgeDocument(project,user,skill.doc.id))
          .rejects.toMatchObject({status:409,response:{code:"SKILL_ASSIGNMENT_ACTIVE"}});
        expect((await admin.query("SELECT * FROM knowledge_documents WHERE id=$1",[skill.doc.id])).rows).toEqual(documentBefore);
        expect(await assignmentWrites()).toEqual(before);

        // Model an existing hidden dependency; new guarded service paths cannot create this state.
        await admin.query("UPDATE knowledge_documents SET document_type='general' WHERE id=$1",[skill.doc.id]);
        await expect(service().deleteKnowledgeDocument(project,user,skill.doc.id))
          .rejects.toMatchObject({status:409,response:{code:"SKILL_ASSIGNMENT_ACTIVE"}});
        await expect(service().updateKnowledgeDocument(project,user,skill.doc.id,{documentType:"skill"}))
          .rejects.toMatchObject({status:409,response:{code:"SKILL_ASSIGNMENT_ACTIVE"}});
        await admin.query("UPDATE knowledge_documents SET is_deleted=true,deleted_at=now() WHERE id=$1",[skill.doc.id]);
        await expect(service().restoreKnowledgeDocument(project,user,skill.doc.id))
          .rejects.toMatchObject({status:409,response:{code:"SKILL_ASSIGNMENT_ACTIVE"}});
        await expect(admin.query("UPDATE skill_assignments SET status='inactive',operation='changed' WHERE id=$1",[skill.assignmentId]))
          .rejects.toMatchObject({code:"23514",message:expect.stringContaining("identity and pinned version are immutable")});

        expect(await service().deactivateSkillAssignment(project,user,skill.assignmentId,{},human))
          .toMatchObject({assignment:{id:skill.assignmentId,status:"inactive",skillVersionId:skill.versionId},replayed:false});
        await expect(admin.query("UPDATE skill_assignments SET status='active',deactivated_at=NULL,deactivated_by=NULL WHERE id=$1",[skill.assignmentId]))
          .rejects.toMatchObject({code:"23514",message:expect.stringContaining("cannot be reactivated")});
        await service().restoreKnowledgeDocument(project,user,skill.doc.id);
        await service().updateKnowledgeDocument(project,user,skill.doc.id,{documentType:"skill"});
        expect(await service().effectiveSkills(project,user,{module:"requirements",subtype:"functional",operation:"requirement_revision"}))
          .toMatchObject({status:"unassigned",assignments:[],digest:null});
        expect((await admin.query("SELECT id,status,skill_version_id FROM skill_assignments WHERE skill_document_id=$1",[skill.doc.id])).rows)
          .toEqual([{id:skill.assignmentId,status:"inactive",skill_version_id:skill.versionId}]);
      }finally{await cleanupSkills([skill.doc.id]);}
    });

    it("guards ancestor Trash and restore cascades by active assignment history regardless of document type",async()=>{
      const skill=await skillFor("requirements","functional","requirement_revision");
      const ancestor=await service().createKnowledgeFolder(project,user,{name:`Skill ancestor ${randomUUID().slice(0,8)}`});
      const descendant=await service().createKnowledgeFolder(project,user,{name:`Skill descendant ${randomUUID().slice(0,8)}`,parentFolderId:ancestor.id});
      const tree=async()=>({
        folders:(await admin.query("SELECT * FROM knowledge_folders WHERE id=ANY($1::uuid[]) ORDER BY id",[[ancestor.id,descendant.id]])).rows,
        document:(await admin.query("SELECT * FROM knowledge_documents WHERE id=$1",[skill.doc.id])).rows,
        assignments:await assignmentWrites()
      });
      try{
        await admin.query("UPDATE knowledge_documents SET folder_id=$2,document_type='general' WHERE id=$1",[skill.doc.id,descendant.id]);
        const beforeDelete=await tree();
        await expect(service().deleteKnowledgeFolder(project,user,ancestor.id))
          .rejects.toMatchObject({status:409,response:{code:"SKILL_ASSIGNMENT_ACTIVE"}});
        expect(await tree()).toEqual(beforeDelete);
        const deletedAt=(await admin.query("SELECT clock_timestamp()::text AS at")).rows[0].at;
        await admin.query("UPDATE knowledge_folders SET is_deleted=true,deleted_at=$2::timestamptz,deletion_reason='manual' WHERE id=ANY($1::uuid[])",[[ancestor.id,descendant.id],deletedAt]);
        await admin.query("UPDATE knowledge_documents SET is_deleted=true,deleted_at=$2::timestamptz WHERE id=$1",[skill.doc.id,deletedAt]);
        const beforeRestore=await tree();
        await expect(service().restoreKnowledgeFolder(project,user,ancestor.id))
          .rejects.toMatchObject({status:409,response:{code:"SKILL_ASSIGNMENT_ACTIVE"}});
        expect(await tree()).toEqual(beforeRestore);
        await service().deactivateSkillAssignment(project,user,skill.assignmentId,{},human);
        await service().restoreKnowledgeFolder(project,user,ancestor.id);
        expect((await admin.query("SELECT is_deleted FROM knowledge_documents WHERE id=$1",[skill.doc.id])).rows[0].is_deleted).toBe(false);
        expect((await admin.query("SELECT is_deleted FROM knowledge_folders WHERE id=ANY($1::uuid[])",[[ancestor.id,descendant.id]])).rows.every(row=>row.is_deleted===false)).toBe(true);
        await service().updateKnowledgeDocument(project,user,skill.doc.id,{documentType:"skill"});
        expect(await service().effectiveSkills(project,user,{module:"requirements",subtype:"functional",operation:"requirement_revision"}))
          .toMatchObject({status:"unassigned",assignments:[]});
      }finally{
        await cleanupSkills([skill.doc.id]);
        await admin.query("DELETE FROM knowledge_folders WHERE id=$1",[ancestor.id]);
      }
    });

    it("refuses unauthorized apply, ambiguous assignments, and recovers an exact apply retry without duplicate effects",async()=>{
      const skills=await publishSkills();
      let requirementId="";
      try{
        const reviewer=(await admin.query("INSERT INTO users(email,name) VALUES ($1,'Apply reviewer') RETURNING id",[`apply-reviewer-${randomUUID()}@tesbo.invalid`])).rows[0].id;
        await admin.query("INSERT INTO organization_members(organization_id,user_id,role) VALUES ($1,$2,'qa_engineer')",[org,reviewer]);
        await admin.query("UPDATE users SET active_organization_id=$2 WHERE id=$1",[reviewer,org]);
        await admin.query("INSERT INTO project_members(project_id,user_id,role) VALUES ($1,$2,'qa_engineer')",[project,reviewer]);
        const staged=await stageBundle(ops());
        await expect(service().applyRequirementProposal(project,reviewer,staged.id,{expectedProposalRevision:staged.proposalRevision},human)).rejects.toMatchObject({status:403});

        const wildcard=await admin.query(
          `INSERT INTO skill_assignments(project_id,module,subtype,operation,skill_document_id,skill_version_id,assigned_by)
           VALUES ($1,'requirements','*','requirement_revision',$2,$3,$4) RETURNING id`,
          [project,skills.requirement.doc.id,skills.requirement.versionId,user]
        );
        await expect(service().applyRequirementProposal(project,user,staged.id,{expectedProposalRevision:staged.proposalRevision},human))
          .rejects.toMatchObject({status:409,response:{code:"SKILL_ASSIGNMENT_CONFLICT"}});
        await admin.query("DELETE FROM skill_assignments WHERE id=$1",[wildcard.rows[0].id]);

        const applied=await service().applyRequirementProposal(project,user,staged.id,{expectedProposalRevision:staged.proposalRevision},human);
        requirementId=applied.receipt.requirement.documentId;
        const casesBefore=(await admin.query("SELECT COUNT(*)::int AS n FROM testcases WHERE project_id=$1 AND title=$2",[project,staged.requirementBundle[1].draft.title])).rows[0].n;
        const retried=await service().applyRequirementProposal(project,user,staged.id,{expectedProposalRevision:staged.proposalRevision},human);
        expect(retried.replayed).toBe(true);
        expect((await admin.query("SELECT COUNT(*)::int AS n FROM testcases WHERE project_id=$1 AND title=$2",[project,staged.requirementBundle[1].draft.title])).rows[0].n).toBe(casesBefore);
        await admin.query("DELETE FROM project_members WHERE project_id=$1 AND user_id=$2",[project,reviewer]);
      }finally{
        if(requirementId){
          await admin.query("DELETE FROM requirement_case_links WHERE project_id=$1 AND requirement_id=$2",[project,requirementId]);
          await admin.query("DELETE FROM requirement_profiles WHERE document_id=$1",[requirementId]);
          await admin.query("UPDATE knowledge_documents SET reviewed_version_id=NULL WHERE id=$1",[requirementId]);
          await admin.query("DELETE FROM knowledge_documents WHERE id=$1",[requirementId]);
        }
        await cleanupSkills([skills.requirement.doc.id,skills.cases.doc.id]);
      }
    });

    it("replays an omitted-key creation request and preserves original V161 digest rows",async()=>{
      const firstTitle=`Omitted key ${randomUUID()}`, firstKey=randomUUID();
      const firstOps={title:firstTitle,module:"requirements",subtype:"functional",instructions:"RULE-OMIT: one observable outcome.",requestKey:firstKey};
      const first=await service().createSkillCandidate(project,user,firstOps,{kind:"human_session"} as never);
      const retried=await service().createSkillCandidate(project,user,firstOps,{kind:"human_session"} as never);
      expect(retried.id).toBe(first.id);
      expect(retried.replayed).toBe(true);
      expect((await admin.query("SELECT COUNT(*)::int AS n FROM skill_profiles WHERE project_id=$1 AND creation_request_key=$2",[project,firstKey])).rows[0].n).toBe(1);
      await expect(service().createSkillCandidate(project,user,{...firstOps,instructions:"RULE-OMIT: changed content."},{kind:"human_session"} as never)).rejects.toMatchObject({status:409,response:{code:"SKILL_REQUEST_CONFLICT"}});

      const concurrentKey=randomUUID();
      const concurrentOps={title:`Concurrent omitted ${randomUUID()}`,module:"requirements",subtype:"functional",instructions:"RULE-CONCURRENT: one outcome.",requestKey:concurrentKey};
      const [left,right]=await Promise.all([
        service().createSkillCandidate(project,user,concurrentOps,{kind:"human_session"} as never),
        service().createSkillCandidate(project,user,concurrentOps,{kind:"human_session"} as never)
      ]);
      expect(left.id).toBe(right.id);
      expect([left.replayed,right.replayed].filter(Boolean)).toHaveLength(1);
      expect((await admin.query("SELECT COUNT(*)::int AS n FROM skill_profiles WHERE project_id=$1 AND creation_request_key=$2",[project,concurrentKey])).rows[0].n).toBe(1);

      const legacyTitle=`Legacy V161 ${randomUUID()}`, legacyKey=randomUUID();
      const legacyOps={title:legacyTitle,module:"requirements",subtype:"functional",instructions:"RULE-LEGACY: one outcome."};
      const legacy=await service().createSkillCandidate(project,user,legacyOps,{kind:"human_session"} as never);
      const generated=(await admin.query("SELECT skill_key FROM skill_profiles WHERE document_id=$1",[legacy.id])).rows[0].skill_key;
      const legacyDigest=createHash("sha256").update(JSON.stringify({title:legacyTitle,module:"requirements",subtype:"functional",skillKey:generated,instructions:legacyOps.instructions})).digest("hex");
      await admin.query("UPDATE skill_profiles SET creation_principal=$2,creation_request_key=$3,creation_request_digest=$4 WHERE document_id=$1",[legacy.id,`human_session:${user}`,legacyKey,legacyDigest]);
      const legacyReplay=await service().createSkillCandidate(project,user,{...legacyOps,requestKey:legacyKey},{kind:"human_session"} as never);
      expect(legacyReplay.id).toBe(legacy.id);
      expect(legacyReplay.replayed).toBe(true);
      await cleanupSkills([first.id,left.id,legacy.id]);
    });
  });
});
