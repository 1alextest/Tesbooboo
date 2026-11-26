import { createHash, randomUUID } from "node:crypto";
import { Client, Pool } from "pg";
import { DatabaseService } from "../database/database.service";
import { ApiTokenService } from "../auth/api-token.service";
import { CustomFieldsService } from "../custom-fields/custom-fields.service";
import { CustomTagsService } from "../custom-tags/custom-tags.service";
import type { PlanLimitsService } from "../plan-limits/plan-limits.service";
import { ProjectLookupService } from "../request-cache/project-lookup.service";
import { RequestCacheService } from "../request-cache/request-cache.service";
import type { AppConfigService } from "../config/app-config.service";
import { makeLegacy } from "./test-helpers/legacy-service.fixture";
import { KNOWLEDGE_DOCUMENT_REVISION_SQL, knowledgeDocumentAiContextSql } from "./knowledge-document-revision";
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
    internals.customFields=new CustomFieldsService(db,plans,new ProjectLookupService(db,new RequestCacheService({} as AppConfigService)),svc,internals.testcasesListCache);
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

  it("refuses a producer revoked while its staging request waits for the suite-write boundary", async () => {
    const tokenId=(await admin.query(
      "INSERT INTO api_tokens(user_id,project_id,name,token_hash,scopes) VALUES ($1,$2,'Revocation barrier producer',$3,'read,write') RETURNING id",
      [user,project,randomUUID().replaceAll("-","").repeat(2)]
    )).rows[0].id as string;
    const blocker=new Client({connectionString:url});
    let attempt:Promise<unknown>|undefined;
    await blocker.connect();
    const before=(await tasks()).rows;
    const caseRows=(await nativeCases()).rows;
    try {
      await blocker.query("BEGIN");
      await blocker.query("SELECT pg_advisory_xact_lock(hashtext($1))",[`suite-tree:${project}`]);
      attempt=stage([{opType:"create",draft:{title:"Revoked token cannot stage"}}],randomUUID(),
        {kind:"api_token",tokenId,transport:"rest"}).then(()=>null,(error:unknown)=>error);
      const deadline=Date.now()+5000;let waiting=false;
      while(Date.now()<deadline){
        waiting=!!(await admin.query(
          "SELECT 1 FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock' AND query LIKE '%pg_advisory_xact_lock%'",
          [applicationName])).rowCount;
        if(waiting)break;
        await new Promise(resolve=>setTimeout(resolve,20));
      }
      expect(waiting).toBe(true);
      await admin.query("DELETE FROM api_tokens WHERE id=$1 AND project_id=$2",[tokenId,project]);
      await blocker.query("COMMIT");
      expect(await attempt).toMatchObject({status:403});
      expect((await tasks()).rows).toEqual(before);
      expect((await nativeCases()).rows).toEqual(caseRows);
    } finally {
      await blocker.query("ROLLBACK");
      if(attempt)await attempt;
      await blocker.end();
      await admin.query("DELETE FROM api_tokens WHERE id=$1 AND project_id=$2",[tokenId,project]);
    }
  },15000);

  it.each(["project","organization"] as const)("CL-T10 generation replacement while native staging waits (%s)", async membership => {
    const issuer = new ApiTokenService(new DatabaseService(pool));
    const old = await issuer.issueToken(user,project,"Native generation barrier",["read","write"]);
    const oldPrincipal = {kind:"api_token",tokenId:old.id,transport:"rest"};
    const blocker = new Client({connectionString:url});
    let attempt:Promise<unknown>|undefined, freshId:string|undefined;
    await blocker.connect();
    const before = (await tasks()).rows;
    const casesBefore = (await nativeCases()).rows;
    const operations = [{opType:"create",draft:{title:"Retired generation cannot stage"}}];
    const key = randomUUID();
    const restore = async () => {
      await admin.query("INSERT INTO organization_members(organization_id,user_id,role) VALUES ($1,$2,'owner') ON CONFLICT DO NOTHING",[org,user]);
      await admin.query("INSERT INTO project_members(project_id,user_id,role) VALUES ($1,$2,'owner') ON CONFLICT DO NOTHING",[project,user]);
    };
    try {
      await blocker.query("BEGIN");
      await blocker.query("SELECT pg_advisory_xact_lock(hashtext($1))",[`suite-tree:${project}`]);
      attempt = stage(operations,key,oldPrincipal).then(()=>null,(error:unknown)=>error);
      const deadline=Date.now()+5000; let waiting=false;
      while(Date.now()<deadline){
        waiting=!!(await admin.query(
          "SELECT 1 FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock' AND query LIKE '%pg_advisory_xact_lock%'",
          [applicationName])).rowCount;
        if(waiting)break;
        await new Promise(resolve=>setTimeout(resolve,20));
      }
      expect(waiting).toBe(true);
      const removed = membership==="project"
        ? await admin.query("DELETE FROM project_members WHERE project_id=$1 AND user_id=$2 RETURNING id",[project,user])
        : await admin.query("DELETE FROM organization_members WHERE organization_id=$1 AND user_id=$2 RETURNING id",[org,user]);
      expect(removed.rowCount).toBe(1);
      await restore();
      // The original token and the current member both still exist. This isolates generation
      // continuity from ordinary absent-membership or deleted-token refusal.
      expect((await admin.query("SELECT id FROM api_tokens WHERE id=$1",[old.id])).rowCount).toBe(1);
      await blocker.query("COMMIT");
      expect(await attempt).toMatchObject({status:403});
      expect((await tasks()).rows).toEqual(before);
      expect((await nativeCases()).rows).toEqual(casesBefore);
      await expect(stage(operations,key,oldPrincipal)).rejects.toMatchObject({status:403});
      const fresh = await issuer.issueToken(user,project,"Fresh generation control",["read","write"]);
      freshId=fresh.id;
      const freshPrincipal = {kind:"api_token",tokenId:fresh.id,transport:"rest"};
      const freshTask = await stage(operations,key,freshPrincipal);
      expect(freshTask.proposalProvenance).toMatchObject({kind:"api_token",tokenId:fresh.id,issuerId:user});
      expect((await stage(operations,key,freshPrincipal)).id).toBe(freshTask.id);
      await expect(stage(operations,key,oldPrincipal)).rejects.toMatchObject({status:403});
      expect((await nativeCases()).rows).toEqual(casesBefore);
    } finally {
      await blocker.query("ROLLBACK");
      if(attempt)await attempt;
      await blocker.end();
      await restore();
      await admin.query("DELETE FROM api_tokens WHERE id=$1 AND project_id=$2",[old.id,project]);
      if(freshId)await admin.query("DELETE FROM api_tokens WHERE id=$1 AND project_id=$2",[freshId,project]);
    }
  },15000);

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

    // CL-T10 exercises each public native staging inlet, not only the shared
    // predicate through testcase staging. The document inlet has no suite lock.
    it.each([
      ["requirement","project"], ["requirement","organization"],
      ["user_manual","project"], ["user_manual","organization"],
      ["policy","project"], ["policy","organization"],
    ] as const)("CL-T10 generation replacement at %s staging (%s)",async(inlet,membership)=>{
      const issuer=new ApiTokenService(new DatabaseService(pool));
      const old=await issuer.issueToken(user,project,"Retired native inlet generation",["read","write"]);
      const oldPrincipal={kind:"api_token" as const,tokenId:old.id,transport:"rest" as const};
      const blocker=new Client({connectionString:url});await blocker.connect();
      let attempt:Promise<unknown>|undefined,freshId:string|undefined;
      const key=randomUUID(),operations=ops();
      const folder=(await admin.query("SELECT id FROM knowledge_folders WHERE project_id=$1 AND is_deleted=false LIMIT 1",[project])).rows[0]?.id
        || (await admin.query("INSERT INTO knowledge_folders(organization_id,project_id,name,is_root) SELECT organization_id,id,'Knowledge base',true FROM projects WHERE id=$1 RETURNING id",[project])).rows[0].id;
      const metadata={schemaVersion:"tesbo-governed-document/1",audience:"internal",
        subtype:inlet==="policy"?"policy":"manual",confidentiality:"internal",distribution:"internal",
        sourceAuthority:{kind:"internal",label:"Project owner",reference:null},
        effectivity:{from:null,to:null},enforcementRefs:inlet==="policy"?["ACME-1"]:[]};
      const body={requestKey:key,operation:"create",folderId:folder,
        document:{title:`Generation boundary ${key}`,contentText:"Candidate body",contentHtml:"<p>Candidate body</p>",
          contentJson:{type:"doc",content:[{type:"paragraph",content:[{type:"text",text:"Candidate body"}]}]},
          governedMetadata:metadata},reason:"Generation continuity regression"};
      const submit=(principal:typeof oldPrincipal)=>inlet==="requirement"
        ? stageBundle(operations,key,principal)
        : service().stageManagedDocumentProposal(project,user,body,principal,inlet);
      const restore=async()=>{
        await admin.query("INSERT INTO organization_members(organization_id,user_id,role) VALUES ($1,$2,'owner') ON CONFLICT DO NOTHING",[org,user]);
        await admin.query("INSERT INTO project_members(project_id,user_id,role) VALUES ($1,$2,'owner') ON CONFLICT DO NOTHING",[project,user]);
      };
      try{
        const before=(await tasks()).rows,officialBefore=await docCounts();
        await blocker.query("BEGIN");
        await blocker.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)",[`skill-assignments:${project}`]);
        attempt=submit(oldPrincipal).then(()=>null,(error:unknown)=>error);
        const deadline=Date.now()+5000;let waiting=false;
        while(Date.now()<deadline){
          waiting=!!(await admin.query(
            "SELECT 1 FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock' AND query LIKE '%pg_advisory_xact_lock%'",
            [applicationName])).rowCount;
          if(waiting)break;
          await new Promise(resolve=>setTimeout(resolve,20));
        }
        expect(waiting).toBe(true);
        const removed=membership==="project"
          ? await admin.query("DELETE FROM project_members WHERE project_id=$1 AND user_id=$2 RETURNING id",[project,user])
          : await admin.query("DELETE FROM organization_members WHERE organization_id=$1 AND user_id=$2 RETURNING id",[org,user]);
        expect(removed.rowCount).toBe(1);
        await restore();
        expect((await admin.query("SELECT id FROM api_tokens WHERE id=$1",[old.id])).rowCount).toBe(1);
        await blocker.query("COMMIT");
        expect(await attempt).toMatchObject({status:403});
        expect((await tasks()).rows).toEqual(before);
        expect(await docCounts()).toEqual(officialBefore);
        await expect(submit(oldPrincipal)).rejects.toMatchObject({status:403});
        const fresh=await issuer.issueToken(user,project,"Current native inlet generation",["read","write"]);
        freshId=fresh.id;
        const freshPrincipal={...oldPrincipal,tokenId:fresh.id};
        const staged=await submit(freshPrincipal);
        expect(staged).toMatchObject({taskStatus:"in_review",proposalProvenance:{kind:"api_token",tokenId:fresh.id,issuerId:user}});
        expect((await submit(freshPrincipal)).id).toBe(staged.id);
        await expect(submit(oldPrincipal)).rejects.toMatchObject({status:403});
        expect((await tasks()).rows.filter(row=>!before.some(previous=>previous.id===row.id))).toHaveLength(1);
        expect(await docCounts()).toEqual(officialBefore);
      }finally{
        await blocker.query("ROLLBACK");
        if(attempt)await attempt;
        await blocker.end();
        await restore();
        await admin.query("DELETE FROM api_tokens WHERE id=$1 AND project_id=$2",[old.id,project]);
        if(freshId)await admin.query("DELETE FROM api_tokens WHERE id=$1 AND project_id=$2",[freshId,project]);
      }
    },15000);

    it("serializes a shared producer requestKey across testcase and requirement proposal inlets",async()=>{
      const key=randomUUID();
      const principal={kind:"api_token",tokenId:token,transport:"rest"};
      const before=(await tasks()).rows;
      const beforeOfficial=await docCounts();
      const outcomes=await Promise.allSettled([
        stage([{opType:"create",draft:{title:"Case inlet competing for shared request key"}}],key,principal),
        stageBundle(ops(),key,principal)
      ]);
      const committed=outcomes.filter(item=>item.status==="fulfilled");
      const refused=outcomes.filter(item=>item.status==="rejected") as PromiseRejectedResult[];
      expect(committed).toHaveLength(1);
      expect(refused).toHaveLength(1);
      expect(refused[0].reason).toMatchObject({status:409});
      const added=(await tasks()).rows.filter(row=>!before.some(previous=>previous.id===row.id));
      expect(added).toHaveLength(1);
      expect(added[0].proposal_provenance).toMatchObject({
        kind:"api_token",principalKey:`api_token:${token}`,issuerId:user,tokenId:token
      });
      expect(await docCounts()).toEqual(beforeOfficial);
    },15000);

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
    const waitingLockers=async()=>Number((await admin.query(
      "SELECT COUNT(*)::int AS n FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock'",
      [applicationName]
    )).rows[0].n);
    const revisionsOf=async(id:string)=>(await admin.query(
      `SELECT ${TESTCASE_EDIT_REVISION_SQL} AS edit_revision, ${TESTCASE_APPROVAL_REVISION_SQL} AS approval_revision, ${TESTCASE_APPROVAL_CURRENT_SQL} AS approval_current FROM testcases WHERE id=$1`,[id]
    )).rows[0] as Body;
    const attempt=async(caseId:string,approvalRevision:string,status:string,at:Date)=>{
      const run=(await admin.query("INSERT INTO cycles(project_id,name,source,status) VALUES ($1,$2,'manual','In Progress') RETURNING id",[project,`Coverage ${randomUUID()}`])).rows[0].id;
      const item=(await admin.query("INSERT INTO cycle_items(cycle_id,testcase_id,snapshot_approval_revision) VALUES ($1,$2,$3) RETURNING id",[run,caseId,approvalRevision])).rows[0].id;
      const execution=(await admin.query("INSERT INTO executions(cycle_item_id,status,executed_by,executed_at) VALUES ($1,$2,$3,$4) RETURNING id",[item,status,user,at])).rows[0].id;
      return {executionId:String(execution),cycleId:String(run)};
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
        // The task surface reopens this exact version after a reload from the bounded receipt,
        // never by re-deriving it from the (mutable) requirement document.
        const reloaded=await service().requirementProposalTask(project,user,staged.id);
        expect(reloaded.requirementApplyReceipt).toMatchObject({
          requirement:{documentId:requirementId,versionId:applied.receipt.requirement.versionId,versionNumber:applied.receipt.requirement.versionNumber},
          testcase:{id:caseId},
          link:{id:applied.receipt.link.id}
        });
        expect(reloaded.requirementApplyReceipt).not.toHaveProperty("proposalSnapshot");
        expect(reloaded.requirementApplyReceipt).not.toHaveProperty("decisionKey");
        expect((await admin.query("SELECT COUNT(*)::int AS n FROM knowledge_document_versions WHERE document_id=$1 AND snapshot_kind='submitted'",[requirementId])).rows[0].n).toBe(1);
        expect((await admin.query("SELECT COUNT(*)::int AS n FROM testcases WHERE id=$1 AND status='Draft'",[caseId])).rows[0].n).toBe(1);

        let coverage=await service().requirementCoverage(project,user,requirementId);
        expect(coverage.readings).toMatchObject({authored:true,approved:false,executed:false,passing:false});
        const appliedCaseRevision=await revisionsOf(caseId);
        expect(coverage.cases[0]).toMatchObject({testcaseRevision:appliedCaseRevision.edit_revision,testcaseApprovalRevision:null});

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

        const passedAttempt=await attempt(caseId,after.approval_revision,"Passed",new Date());
        coverage=await service().requirementCoverage(project,user,requirementId);
        expect(coverage.readings).toMatchObject({approved:true,executed:true,passing:true,mixed:false});
        expect(coverage.cases[0].latestAttempt).toMatchObject({status:"Passed",executionId:passedAttempt.executionId,cycleId:passedAttempt.cycleId});

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

    it("uses the normalized owner/manager role for bundle apply at both authorization points",async()=>{
      const skills=await publishSkills();
      const skillIds=[skills.requirement.doc.id,skills.cases.doc.id];
      const taskIds:string[]=[];
      let requirementId="";
      let adminRequirementId="";
      let appliedCaseId="";
      let adminCaseId="";
      let legacyId="";
      const addMember=async(role:string,label:string)=>{
        const id=(await admin.query("INSERT INTO users(email,name) VALUES ($1,$2) RETURNING id",[`apply-${label.replaceAll(" ","-")}-${randomUUID()}@tesbo.invalid`,label])).rows[0].id;
        await admin.query("INSERT INTO organization_members(organization_id,user_id,role) VALUES ($1,$2,'qa_engineer')",[org,id]);
        await admin.query("INSERT INTO project_members(project_id,user_id,role) VALUES ($1,$2,$3)",[project,id,role]);
        return id as string;
      };
      try{
        legacyId=await addMember("test_manager","Legacy apply manager");

        const legacyBundle=await stageBundle(ops()); taskIds.push(legacyBundle.id);
        const applied=await service().applyRequirementProposal(project,legacyId,legacyBundle.id,
          {expectedProposalRevision:legacyBundle.proposalRevision},human);
        expect(applied.replayed).toBe(false);
        requirementId=applied.receipt.requirement.documentId;
        appliedCaseId=applied.receipt.testcase.id;
        expect(applied.receipt.reviewerId).toBe(legacyId);

        // The other documented legacy alias maps to the same manager interpretation.
        await admin.query("UPDATE project_members SET role='admin' WHERE project_id=$1 AND user_id=$2",[project,legacyId]);
        const adminBundle=await stageBundle(ops()); taskIds.push(adminBundle.id);
        const adminApplied=await service().applyRequirementProposal(project,legacyId,adminBundle.id,
          {expectedProposalRevision:adminBundle.proposalRevision},human);
        adminRequirementId=adminApplied.receipt.requirement.documentId;
        adminCaseId=adminApplied.receipt.testcase.id;
        expect(adminApplied.replayed).toBe(false);
        await admin.query("UPDATE project_members SET role='test_manager' WHERE project_id=$1 AND user_id=$2",[project,legacyId]);

        // Hold the task row after the initial authorization check, change the role, then release:
        // the post-wait check must re-read and normalize the current role.
        const waitBundle=await stageBundle(ops()); taskIds.push(waitBundle.id);
        const beforeWait=await bundleWrites(waitBundle.id);
        const blocker=new Client({connectionString:url}); await blocker.connect();
        let pending:Promise<{v?:Body;e?:Body}>|undefined;
        try{
          await blocker.query("BEGIN");
          await blocker.query("SELECT id FROM ai_generation_requests WHERE id=$1 FOR UPDATE",[waitBundle.id]);
          pending=service().applyRequirementProposal(project,legacyId,waitBundle.id,
            {expectedProposalRevision:waitBundle.proposalRevision},human).then(v=>({v}),e=>({e}));
          // The suite shares a busy disposable PostgreSQL instance; wait longer than the generic
          // polling helper so we observe the actual post-initial-lock wait, then release promptly.
          const lockDeadline=Date.now()+30000;
          let sawWait=false;
          while(Date.now()<lockDeadline){
            if(await waitingOn("%ai_generation_requests%FOR UPDATE%")){sawWait=true;break;}
            await new Promise(resolve=>setTimeout(resolve,50));
          }
          expect(sawWait).toBe(true);
          await admin.query("UPDATE project_members SET role='qa_engineer' WHERE project_id=$1 AND user_id=$2",[project,legacyId]);
          await blocker.query("COMMIT");
          const settled=await Promise.race([
            pending,
            new Promise<{e?:Body}>((resolve)=>setTimeout(()=>resolve({e:{status:0,code:"TEST_WAIT_TIMEOUT"}}),30000))
          ]);
          expect(settled.e).toMatchObject({status:403});
        }finally{
          await blocker.query("ROLLBACK").catch(()=>undefined);
          if(pending) await Promise.race([pending,new Promise(resolve=>setTimeout(resolve,5000))]);
          await blocker.end();
        }
        expect((await admin.query("SELECT task_status FROM ai_generation_requests WHERE id=$1",[waitBundle.id])).rows[0].task_status).toBe("in_review");
        const afterWait=await bundleWrites(waitBundle.id);
        expect({documents:afterWait.documents,cases:afterWait.cases,links:afterWait.links})
          .toEqual({documents:beforeWait.documents,cases:beforeWait.cases,links:beforeWait.links});

        // Rejection is the same authority decision as approval; a legacy alias can reject, and
        // the refusal leaves no requirement, case or link behind.
        await admin.query("UPDATE project_members SET role='test_manager' WHERE project_id=$1 AND user_id=$2",[project,legacyId]);
        const rejectionBundle=await stageBundle(ops()); taskIds.push(rejectionBundle.id);
        const beforeRejection=await bundleWrites(rejectionBundle.id);
        await service().rejectRequirementProposal(project,legacyId,rejectionBundle.id,
          {expectedProposalRevision:rejectionBundle.proposalRevision,reason:"Legacy role rejection"},human);
        expect((await admin.query("SELECT task_status FROM ai_generation_requests WHERE id=$1",[rejectionBundle.id])).rows[0].task_status).toBe("done");
        const afterRejection=await bundleWrites(rejectionBundle.id);
        expect({documents:afterRejection.documents,cases:afterRejection.cases,links:afterRejection.links})
          .toEqual({documents:beforeRejection.documents,cases:beforeRejection.cases,links:beforeRejection.links});
      }finally{
        for(const id of taskIds) await admin.query("DELETE FROM ai_generation_requests WHERE id=$1",[id]);
        if(requirementId) await cleanupRequirement(requirementId);
        if(adminRequirementId) await cleanupRequirement(adminRequirementId);
        for(const id of [appliedCaseId,adminCaseId].filter(Boolean))
          await admin.query("DELETE FROM testcases WHERE id=$1 AND project_id=$2",[id,project]);
        for(const id of [legacyId].filter(Boolean)){
          await admin.query("DELETE FROM project_members WHERE project_id=$1 AND user_id=$2",[project,id]);
          await admin.query("DELETE FROM organization_members WHERE organization_id=$1 AND user_id=$2",[org,id]);
          await admin.query("DELETE FROM users WHERE id=$1",[id]);
        }
        await cleanupSkills(skillIds);
      }
    },120000);

    it("re-reads the project's proposal capability after the task wait",async()=>{
      const skills=await publishSkills();
      const skillIds=[skills.requirement.doc.id,skills.cases.doc.id];
      let taskId="";
      let pending:Promise<{v?:Body;e?:Body}>|undefined;
      const blocker=new Client({connectionString:url}); await blocker.connect();
      const before=(await admin.query("SELECT settings FROM projects WHERE id=$1",[project])).rows[0].settings;
      try{
        const bundle=await stageBundle(ops()); taskId=bundle.id;
        const beforeCapability=await bundleWrites(bundle.id);
        await blocker.query("BEGIN");
        await blocker.query("SELECT id FROM ai_generation_requests WHERE id=$1 FOR UPDATE",[taskId]);
        pending=service().applyRequirementProposal(project,user,taskId,
          {expectedProposalRevision:bundle.proposalRevision},human).then(v=>({v}),e=>({e}));
        const deadline=Date.now()+30000;
        let sawWait=false;
        while(Date.now()<deadline){
          if(await waitingOn("%ai_generation_requests%FOR UPDATE%")){sawWait=true;break;}
          await new Promise(resolve=>setTimeout(resolve,50));
        }
        expect(sawWait).toBe(true);
        // The initial preflight saw the capability enabled; disable it while the apply waits.
        // Replace each intermediate object explicitly: jsonb_set does not create a path through a
        // JSON null intermediate, which would leave the setting unchanged and pass for the wrong reason.
        await admin.query(
          `UPDATE projects SET settings=jsonb_set(COALESCE(settings,'{}'::jsonb),'{zyraAgent}',
             jsonb_set(COALESCE(settings->'zyraAgent','{}'::jsonb),'{capabilities}',
               jsonb_set(COALESCE(settings#>'{zyraAgent,capabilities}','{}'::jsonb),'{testcaseStorage}','false'::jsonb,true),true),true)
           WHERE id=$1`,
          [project]);
        expect((await admin.query("SELECT settings FROM projects WHERE id=$1",[project])).rows[0].settings)
          .toMatchObject({zyraAgent:{capabilities:{testcaseStorage:false}}});
        await blocker.query("COMMIT");
        const settled=await Promise.race([
          pending,
          new Promise<{e?:Body}>((resolve)=>setTimeout(()=>resolve({e:{status:0,code:"TEST_WAIT_TIMEOUT"}}),30000))
        ]);
        expect(settled.e).toMatchObject({status:403});
        expect((await admin.query("SELECT task_status FROM ai_generation_requests WHERE id=$1",[taskId])).rows[0].task_status).toBe("in_review");
        const afterCapability=await bundleWrites(bundle.id);
        expect({documents:afterCapability.documents,cases:afterCapability.cases,links:afterCapability.links})
          .toEqual({documents:beforeCapability.documents,cases:beforeCapability.cases,links:beforeCapability.links});
      }finally{
        await blocker.query("ROLLBACK").catch(()=>undefined);
        if(pending) await Promise.race([pending,new Promise(resolve=>setTimeout(resolve,5000))]);
        await blocker.end();
        await admin.query("UPDATE projects SET settings=$2::jsonb WHERE id=$1",[project,JSON.stringify(before ?? {})]);
        if(taskId) await admin.query("DELETE FROM ai_generation_requests WHERE id=$1",[taskId]);
        await cleanupSkills(skillIds);
      }
    },120000);

    it("refuses activation until the requirement version is approved",async()=>{
      const skills=await publishSkills();
      const skillIds=[skills.requirement.doc.id,skills.cases.doc.id];
      let requirementId="";
      let caseId="";
      try{
        const staged=await stageBundle(ops());
        const applied=await service().applyRequirementProposal(project,user,staged.id,{expectedProposalRevision:staged.proposalRevision},human);
        requirementId=applied.receipt.requirement.documentId;
        caseId=applied.receipt.testcase.id;
        const caseBefore=await revisionsOf(caseId);
        await service().approveTestCaseForUser(user,project,caseId,{expectedRevision:caseBefore.edit_revision,expectedApprovalRevision:caseBefore.approval_revision},human);
        const caseApproved=await revisionsOf(caseId);
        const before=await admin.query("SELECT id,state,testcase_revision,testcase_approval_revision FROM requirement_case_links WHERE project_id=$1 AND requirement_id=$2 ORDER BY id",[project,requirementId]);
        await expect(service().reapplyRequirementCaseLink(project,user,requirementId,
          String((await admin.query("SELECT id FROM requirement_case_links WHERE project_id=$1 AND requirement_id=$2 LIMIT 1",[project,requirementId])).rows[0].id),
          {expectedCaseRevision:caseApproved.edit_revision,expectedApprovalRevision:caseApproved.approval_revision},human))
          .rejects.toMatchObject({status:409,response:{code:"REQUIREMENT_NOT_APPROVED"}});
        const after=await admin.query("SELECT id,state,testcase_revision,testcase_approval_revision FROM requirement_case_links WHERE project_id=$1 AND requirement_id=$2 ORDER BY id",[project,requirementId]);
        expect(after.rows).toEqual(before.rows);
      }finally{
        if(requirementId) await cleanupRequirement(requirementId);
        await cleanupSkills(skillIds);
      }
    });

    it("refuses link activation on an unapproved or changed case without changing the active link",async()=>{
      const skills=await publishSkills();
      const skillIds=[skills.requirement.doc.id,skills.cases.doc.id];
      let requirementId="";
      let caseId="";
      let readerId="";
      let legacyRoleId="";
      try{
        const staged=await stageBundle(ops());
        expect(staged.skillContext).toMatchObject({status:"resolved"});
        const applied=await service().applyRequirementProposal(project,user,staged.id,{expectedProposalRevision:staged.proposalRevision},human);
        requirementId=applied.receipt.requirement.documentId;
        caseId=applied.receipt.testcase.id;
        await service().approveRequirementVersion(project,user,requirementId,{versionId:applied.receipt.requirement.versionId},human);
        let coverage=await service().requirementCoverage(project,user,requirementId);
        // Approval preserves the submitted link and creates its exact approved-version generation.
        expect(coverage.cases).toHaveLength(2);
        const link=coverage.cases[0];
        const before=await revisionsOf(caseId);
        const beforeCaseCheck=await admin.query("SELECT id,state,testcase_revision,testcase_approval_revision FROM requirement_case_links WHERE project_id=$1 AND requirement_id=$2 ORDER BY id",[project,requirementId]);
        // A valid-shaped approval revision cannot make an unapproved case current, even though
        // the requirement is now approved and both link generations are present.
        await expect(service().reapplyRequirementCaseLink(project,user,requirementId,link.linkId,
          {expectedCaseRevision:before.edit_revision,expectedApprovalRevision:"0".repeat(64)},human))
          .rejects.toMatchObject({status:409,response:{code:"CASE_NOT_APPROVED"}});
        const afterCaseCheck=await admin.query("SELECT id,state,testcase_revision,testcase_approval_revision FROM requirement_case_links WHERE project_id=$1 AND requirement_id=$2 ORDER BY id",[project,requirementId]);
        expect(afterCaseCheck.rows).toEqual(beforeCaseCheck.rows);

        const caseBeforeApproval=await revisionsOf(caseId);
        await service().approveTestCaseForUser(user,project,caseId,{expectedRevision:caseBeforeApproval.edit_revision,expectedApprovalRevision:caseBeforeApproval.approval_revision},human);
        const caseAfter=await revisionsOf(caseId);
        await service().updateTestCaseForUser(user,project,caseId,{title:`Changed ${randomUUID()}`,expectedRevision:caseAfter.edit_revision});
        const changed=await revisionsOf(caseId);
        expect(changed.edit_revision).not.toBe(caseAfter.edit_revision);
        // Approval copied the link onto the approved version, so capture the complete generation set
        // and prove the refused activation writes nothing.
        const beforeStale=await admin.query("SELECT id,state,testcase_revision,testcase_approval_revision FROM requirement_case_links WHERE project_id=$1 AND requirement_id=$2 ORDER BY id",[project,requirementId]);
        await expect(service().reapplyRequirementCaseLink(project,user,requirementId,link.linkId,
          {expectedCaseRevision:caseAfter.edit_revision,expectedApprovalRevision:caseAfter.approval_revision},human))
          .rejects.toMatchObject({status:409,response:{code:"CASE_REVISION_CONFLICT"}});
        const afterStale=await admin.query("SELECT id,state,testcase_revision,testcase_approval_revision FROM requirement_case_links WHERE project_id=$1 AND requirement_id=$2 ORDER BY id",[project,requirementId]);
        expect(afterStale.rows).toEqual(beforeStale.rows);
        coverage=await service().requirementCoverage(project,user,requirementId);
        expect(coverage.readings.approved).toBe(false);

        // Missing link and an inactive link are separate refusals; a reader cannot activate.
        await expect(service().reapplyRequirementCaseLink(project,user,requirementId,randomUUID(),
          {expectedCaseRevision:caseAfter.edit_revision,expectedApprovalRevision:caseAfter.approval_revision},human))
          .rejects.toMatchObject({status:404});
        readerId=(await admin.query("INSERT INTO users(email,name,active_organization_id) VALUES ($1,'Link activation reader',$2) RETURNING id",[`link-reader-${randomUUID()}@tesbo.invalid`,org])).rows[0].id;
        await admin.query("INSERT INTO organization_members(organization_id,user_id,role) VALUES ($1,$2,'qa_engineer')",[org,readerId]);
        await admin.query("INSERT INTO project_members(project_id,user_id,role) VALUES ($1,$2,'qa_engineer')",[project,readerId]);
        expect((await service().requireProjectAccess(readerId,project)).caller_role).toBe("qa_engineer");
        await expect(service().reapplyRequirementCaseLink(project,readerId,requirementId,link.linkId,
          {expectedCaseRevision:caseAfter.edit_revision,expectedApprovalRevision:caseAfter.approval_revision},human))
          .rejects.toMatchObject({status:403});

        // A legacy project role normalizes to manager, matching requirement approval and the
        // surface's affordance. The missing link gives a 404 once authorization passes; raw
        // role matching would return 403.
        legacyRoleId=(await admin.query("INSERT INTO users(email,name,active_organization_id) VALUES ($1,'Legacy link manager',$2) RETURNING id",[`link-legacy-${randomUUID()}@tesbo.invalid`,org])).rows[0].id;
        await admin.query("INSERT INTO organization_members(organization_id,user_id,role) VALUES ($1,$2,'qa_engineer')",[org,legacyRoleId]);
        await admin.query("INSERT INTO project_members(project_id,user_id,role) VALUES ($1,$2,'test_manager')",[project,legacyRoleId]);
        const legacyRole=(await service().requireProjectAccess(legacyRoleId,project)).caller_role;
        expect(legacyRole).toBe("test_manager");
        expect(service().normalizeRole(legacyRole)).toBe("manager");
        await expect(service().reapplyRequirementCaseLink(project,legacyRoleId,requirementId,randomUUID(),
          {expectedCaseRevision:caseAfter.edit_revision,expectedApprovalRevision:caseAfter.approval_revision},human))
          .rejects.toMatchObject({status:404});

        await admin.query("UPDATE requirement_case_links SET state='retired' WHERE project_id=$1 AND requirement_id=$2",[project,requirementId]);
        await expect(service().reapplyRequirementCaseLink(project,user,requirementId,link.linkId,
          {expectedCaseRevision:"1".repeat(64),expectedApprovalRevision:"1".repeat(64)},human))
          .rejects.toMatchObject({status:409,response:{code:"LINK_NOT_ACTIVE"}});
      }finally{
        if(requirementId) await cleanupRequirement(requirementId);
        for(const fixtureUserId of [readerId,legacyRoleId].filter(Boolean)){
          await admin.query("DELETE FROM project_members WHERE project_id=$1 AND user_id=$2",[project,fixtureUserId]);
          await admin.query("DELETE FROM organization_members WHERE organization_id=$1 AND user_id=$2",[org,fixtureUserId]);
          await admin.query("DELETE FROM users WHERE id=$1",[fixtureUserId]);
        }
        await cleanupSkills(skillIds);
      }
    });

    it.each(["fresh","replay"])("refuses %s activation after its reviewed link Skill assignment is revoked",async phase=>{
      const skills=await publishSkills();
      const skillIds=[skills.requirement.doc.id,skills.cases.doc.id];
      let requirementId="",caseId="",taskId="";
      try{
        const staged=await stageBundle(ops());taskId=staged.id;
        const applied=await service().applyRequirementProposal(project,user,staged.id,{expectedProposalRevision:staged.proposalRevision},human);
        requirementId=applied.receipt.requirement.documentId;caseId=applied.receipt.testcase.id;
        const approval=await service().approveRequirementVersion(project,user,requirementId,{versionId:applied.receipt.requirement.versionId},human);
        const before=await revisionsOf(caseId);
        await service().approveTestCaseForUser(user,project,caseId,{expectedRevision:before.edit_revision,expectedApprovalRevision:before.approval_revision},human);
        const current=await revisionsOf(caseId);
        expect(current.approval_current).toBe(true);
        const request={expectedCaseRevision:current.edit_revision,expectedApprovalRevision:current.approval_revision,
          expectedRequirementVersionId:approval.approvedVersionId};
        const sourceLinkId=String(applied.receipt.link.id);
        if(phase==="replay"){
          const first=await service().reapplyRequirementCaseLink(project,user,requirementId,sourceLinkId,request,human);
          expect(first).toMatchObject({replayed:false,link:{requirementVersionId:approval.approvedVersionId}});
          expect(await service().reapplyRequirementCaseLink(project,user,requirementId,sourceLinkId,request,human))
            .toEqual({...first,replayed:true});
        }
        const linkAssignments=(await admin.query(
          "SELECT id FROM skill_assignments WHERE project_id=$1 AND module='requirements' AND subtype='functional' AND operation='requirement_case_link' AND status='active'",
          [project])).rows;
        expect(linkAssignments).toHaveLength(1);
        await service().deactivateSkillAssignment(project,user,String(linkAssignments[0].id),{},human);
        const preserved=await bundleWrites(taskId);
        const beforeCoverage=await service().requirementCoverage(project,user,requirementId);
        await expect(service().reapplyRequirementCaseLink(project,user,requirementId,sourceLinkId,request,human))
          .rejects.toMatchObject({status:409,response:{code:"SKILL_CONTEXT_STALE"}});
        expect(await bundleWrites(taskId)).toEqual(preserved);
        expect(await service().requirementCoverage(project,user,requirementId)).toEqual(beforeCoverage);
      }finally{
        if(requirementId)await cleanupRequirement(requirementId);
        if(taskId)await admin.query("DELETE FROM ai_generation_requests WHERE id=$1 AND project_id=$2",[taskId,project]);
        if(caseId)await admin.query("DELETE FROM testcases WHERE id=$1 AND project_id=$2",[caseId,project]);
        await cleanupSkills(skillIds);
      }
    });

    it.each(["activation","revocation"])("serializes link activation when %s obtains the Skill lock first",async winner=>{
      const skills=await publishSkills();
      const activationService=service(),revocationService=service();
      let requirementId="",caseId="",taskId="",checkpoint=false,secondFinished=false,release=()=>{};
      const gate=new Promise<void>(resolve=>{release=resolve;});
      let activation:Promise<Body>|undefined,revocation:Promise<Body>|undefined,barrier:jest.SpyInstance|undefined;
      try{
        const staged=await stageBundle(ops());taskId=staged.id;
        const applied=await service().applyRequirementProposal(project,user,taskId,{expectedProposalRevision:staged.proposalRevision},human);
        requirementId=applied.receipt.requirement.documentId;caseId=applied.receipt.testcase.id;
        const approval=await service().approveRequirementVersion(project,user,requirementId,{versionId:applied.receipt.requirement.versionId},human);
        const before=await revisionsOf(caseId);
        await service().approveTestCaseForUser(user,project,caseId,{expectedRevision:before.edit_revision,expectedApprovalRevision:before.approval_revision},human);
        const current=await revisionsOf(caseId);
        const request={expectedCaseRevision:current.edit_revision,expectedApprovalRevision:current.approval_revision,
          expectedRequirementVersionId:approval.approvedVersionId};
        const sourceLinkId=String(applied.receipt.link.id);
        const linkAssignments=(await admin.query(
          "SELECT id FROM skill_assignments WHERE project_id=$1 AND module='requirements' AND subtype='functional' AND operation='requirement_case_link' AND status='active'",[project])).rows;
        expect(linkAssignments).toHaveLength(1);
        const assignmentId=String(linkAssignments[0].id);
        const internals=(winner==="activation"?activationService:revocationService) as unknown as Body;
        const method=winner==="activation"?"assertRequirementLinkAuthority":"lockSkillAssignments";
        const original=internals[method].bind(internals);
        barrier=jest.spyOn(internals,method).mockImplementation(async(...args:unknown[])=>{
          const result=await original(...args);checkpoint=true;await gate;return result;
        });
        const activate=()=>activationService.reapplyRequirementCaseLink(project,user,requirementId,sourceLinkId,request,human)
          .then(value=>({value}),error=>({error})).finally(()=>{if(winner==="revocation")secondFinished=true;});
        const revoke=()=>revocationService.deactivateSkillAssignment(project,user,assignmentId,{},human)
          .then(value=>({value}),error=>({error})).finally(()=>{if(winner==="activation")secondFinished=true;});
        if(winner==="activation")activation=activate();else revocation=revoke();
        expect(await waitUntil(()=>checkpoint)).toBe(true);
        const baseline=await bundleWrites(taskId);
        if(winner==="activation")revocation=revoke();else activation=activate();
        expect(await waitUntil(()=>waitingOn("%pg_advisory_xact_lock%"))).toBe(true);
        expect(secondFinished).toBe(false);
        expect(await bundleWrites(taskId)).toEqual(baseline);
        release();
        const activated=await activation!,revoked=await revocation!;
        expect(revoked.error).toBeUndefined();
        expect(revoked.value).toMatchObject({assignment:{status:"inactive"},replayed:false});
        const settled=await bundleWrites(taskId);
        if(winner==="activation"){
          expect(activated.error).toBeUndefined();
          expect(activated.value).toMatchObject({replayed:false,link:{requirementVersionId:approval.approvedVersionId}});
          expect(settled.links.filter(row=>row.id===activated.value.link.id)).toHaveLength(1);
        }else{
          expect(activated.error).toMatchObject({status:409,response:{code:"SKILL_CONTEXT_STALE"}});
          for(const key of ["documents","versions","profiles","links","cases","approvals"] as const)expect(settled[key]).toEqual(baseline[key]);
        }
        await expect(service().reapplyRequirementCaseLink(project,user,requirementId,sourceLinkId,request,human))
          .rejects.toMatchObject({status:409,response:{code:"SKILL_CONTEXT_STALE"}});
        expect(await bundleWrites(taskId)).toEqual(settled);
      }finally{
        release();if(activation)await activation;if(revocation)await revocation;barrier?.mockRestore();
        if(requirementId)await cleanupRequirement(requirementId);
        if(taskId)await admin.query("DELETE FROM ai_generation_requests WHERE id=$1 AND project_id=$2",[taskId,project]);
        if(caseId)await admin.query("DELETE FROM testcases WHERE id=$1 AND project_id=$2",[caseId,project]);
        await cleanupSkills([skills.requirement.doc.id,skills.cases.doc.id]);
      }
    },15000);

    it("replays activation only against the current approved requirement version",async()=>{
      const skills=await publishSkills();
      const skillIds=[skills.requirement.doc.id,skills.cases.doc.id];
      let requirementId="";
      let caseId="";
      const taskIds:string[]=[];
      try{
        const staged=await stageBundle(ops());taskIds.push(staged.id);
        const applied=await service().applyRequirementProposal(project,user,staged.id,{expectedProposalRevision:staged.proposalRevision},human);
        requirementId=applied.receipt.requirement.documentId;
        caseId=applied.receipt.testcase.id;
        await service().approveRequirementVersion(project,user,requirementId,{versionId:applied.receipt.requirement.versionId},human);
        const caseBefore=await revisionsOf(caseId);
        await service().approveTestCaseForUser(user,project,caseId,{expectedRevision:caseBefore.edit_revision,expectedApprovalRevision:caseBefore.approval_revision},human);
        const caseAfter=await revisionsOf(caseId);
        const coverage=await service().requirementCoverage(project,user,requirementId);
        const original=coverage.cases.find((item:Body)=>item.requirementVersionId===coverage.latestSubmittedVersionId)||coverage.cases[0];
        // The lost-response activation commits a new link on approved v1.
        const activated=await service().reapplyRequirementCaseLink(project,user,requirementId,original.linkId,
          {expectedCaseRevision:caseAfter.edit_revision,expectedApprovalRevision:caseAfter.approval_revision},human);
        expect(activated.replayed).toBe(false);
        const lostLink=String(activated.link.id);
        const lostVersion=String(activated.link.requirementVersionId);

        // A newer requirement version is staged/applied/approved after the lost response. This
        // native path carries the pinned skill context into the submitted version.
        const v2Title=`Replay v2 ${randomUUID()}`;
        const stagedV2=await service().stageRequirementChangeBundle(project,user,{
          requestKey:randomUUID(), title:v2Title,
          operations:[{opType:"requirement_revision",operationId:randomUUID(),documentId:requirementId,
            expectedRevision:await revision(requirementId),title:v2Title,description:"Newer requirement content",
            criteria:[{key:"AC-1",text:"Newer obligation"}]}]
        },{kind:"api_token",tokenId:token,transport:"rest"} as never);
        taskIds.push(stagedV2.id);
        const appliedV2=await service().applyRequirementProposal(project,user,stagedV2.id,{expectedProposalRevision:stagedV2.proposalRevision},human);
        const approvedV2=await service().approveRequirementVersion(project,user,requirementId,{versionId:appliedV2.receipt.requirement.versionId},human);

        // Retrying the inactive original link must not replay the v1 generation after v2 approval.
        const before=await admin.query("SELECT id,state,requirement_version_id,testcase_revision,testcase_approval_revision FROM requirement_case_links WHERE project_id=$1 AND requirement_id=$2 ORDER BY id",[project,requirementId]);
        await expect(service().reapplyRequirementCaseLink(project,user,requirementId,original.linkId,
          {expectedCaseRevision:caseAfter.edit_revision,expectedApprovalRevision:caseAfter.approval_revision},human))
          .rejects.toMatchObject({status:409,response:{code:"LINK_NOT_ACTIVE"}});
        const after=await admin.query("SELECT id,state,requirement_version_id,testcase_revision,testcase_approval_revision FROM requirement_case_links WHERE project_id=$1 AND requirement_id=$2 ORDER BY id",[project,requirementId]);
        expect(after.rows).toEqual(before.rows);
        expect(after.rows.find(row=>String(row.id)===lostLink)).toMatchObject({state:"active",requirement_version_id:lostVersion});

        // A requirement-only approval does not confer reviewed authority to carry an old link.
        // The positive intentional-rebind journey must use the explicit selected carry-forward
        // scope in the revised contract; do not remove that use case when implementing the guard.
        const preserved=await bundleWrites(stagedV2.id);
        await expect(service().reapplyRequirementCaseLink(project,user,requirementId,lostLink,
          {expectedCaseRevision:caseAfter.edit_revision,expectedApprovalRevision:caseAfter.approval_revision,
            expectedRequirementVersionId:approvedV2.approvedVersionId},human))
          .rejects.toMatchObject({status:409,response:{code:"SKILL_LINK_REVIEW_REQUIRED"}});
        expect(await bundleWrites(stagedV2.id)).toEqual(preserved);
        expect((await admin.query("SELECT id,state,requirement_version_id FROM requirement_case_links WHERE id=$1",[lostLink])).rows[0])
          .toMatchObject({id:lostLink,state:"active",requirement_version_id:lostVersion});
        // A fresh, explicitly selected scope restores the intentional rebind without duplicating
        // the testcase or conferring authority on an unselected neighboring group.
        const neighboring=(await admin.query(
          `INSERT INTO requirement_case_links
             (project_id,requirement_id,requirement_version_id,criterion_keys,testcase_id,testcase_revision,testcase_approval_revision,state,proposed_by,applied_by,applied_at)
           VALUES ($1,$2,$3,ARRAY['AC-2']::text[],$4,$5,$6,'active',$7,$7,now()) RETURNING *`,
          [project,requirementId,lostVersion,caseId,caseAfter.edit_revision,caseAfter.approval_revision,user])).rows[0];
        const selection={linkId:lostLink,requirementVersionId:lostVersion,testcaseId:caseId,
          testcaseRevision:caseAfter.edit_revision,testcaseApprovalRevision:caseAfter.approval_revision,criterionKeys:original.criterionKeys};
        const revisionOperation={opType:"requirement_revision",operationId:randomUUID(),documentId:requirementId,
          expectedRevision:await revision(requirementId),title:`Explicit rebind ${randomUUID()}`,
          criteria:[{key:"AC-1",text:"Reviewed updated obligation"},{key:"AC-2",text:"Neighbor remains distinct"}],carryForwardLinks:[selection]};
        // Malformed/foreign/duplicate selections cannot publish a task.
        for(const {carryForwardLinks,status} of [
          {carryForwardLinks:[{...selection,originatingLinkSkill:{assignmentId:randomUUID()}}],status:400},
          {carryForwardLinks:[selection,selection],status:400},
          {carryForwardLinks:[{...selection,linkId:randomUUID()}],status:409},
          {carryForwardLinks:[{...selection,criterionKeys:["AC-2"]}],status:409}
        ]){
          const beforeInvalid=await bundleWrites(stagedV2.id);
          const beforeTasks=(await admin.query("SELECT id FROM ai_generation_requests WHERE project_id=$1 ORDER BY id",[project])).rows;
          await expect(stageBundle([{...revisionOperation,carryForwardLinks}])).rejects.toMatchObject({status});
          expect(await bundleWrites(stagedV2.id)).toEqual(beforeInvalid);
          expect((await admin.query("SELECT id FROM ai_generation_requests WHERE project_id=$1 ORDER BY id",[project])).rows).toEqual(beforeTasks);
        }
        const v3=await stageBundle([revisionOperation]);taskIds.push(v3.id);
        expect(v3.skillContext.assignments.map((a:Body)=>a.target.operation).sort()).toEqual(["requirement_case_link","requirement_revision"]);
        expect(v3.requirementBundle[0].carryForwardLinks[0]).toMatchObject({...selection,originatingApprovedVersionId:lostVersion,
          originatingLinkSkill:{skillVersionId:skills.requirement.versionId}});
        const beforeApplyCases=(await nativeCases()).rows;
        const v3Applied=await service().applyRequirementProposal(project,user,v3.id,{expectedProposalRevision:v3.proposalRevision},human);
        expect(v3Applied.receipt.testcase).toBeNull();
        const v3Approved=await service().approveRequirementVersion(project,user,requirementId,{versionId:v3Applied.receipt.requirement.versionId},human);
        const approvedMetadata=(await admin.query("SELECT snapshot_metadata FROM knowledge_document_versions WHERE id=$1",[v3Approved.approvedVersionId])).rows[0].snapshot_metadata;
        expect(approvedMetadata.carryForwardLinks).toEqual(v3.requirementBundle[0].carryForwardLinks);
        expect((await nativeCases()).rows).toEqual(beforeApplyCases);
        const request={expectedCaseRevision:caseAfter.edit_revision,expectedApprovalRevision:caseAfter.approval_revision,
          expectedRequirementVersionId:v3Approved.approvedVersionId};
        const unselected=await bundleWrites(v3.id);
        await expect(service().reapplyRequirementCaseLink(project,user,requirementId,String(neighboring.id),request,human))
          .rejects.toMatchObject({status:409,response:{code:"SKILL_LINK_REVIEW_REQUIRED"}});
        expect(await bundleWrites(v3.id)).toEqual(unselected);
        const rebound=await service().reapplyRequirementCaseLink(project,user,requirementId,lostLink,request,human);
        expect(rebound).toMatchObject({replayed:false,link:{requirementVersionId:v3Approved.approvedVersionId,testcaseId:caseId,criterionKeys:selection.criterionKeys}});
        const reboundState=await bundleWrites(v3.id);
        expect(await service().reapplyRequirementCaseLink(project,user,requirementId,lostLink,request,human))
          .toEqual({...rebound,replayed:true});
        expect(await bundleWrites(v3.id)).toEqual(reboundState);
        expect((await admin.query("SELECT * FROM requirement_case_links WHERE id=$1",[neighboring.id])).rows[0]).toEqual(neighboring);
        expect((await nativeCases()).rows).toEqual(beforeApplyCases);
      }finally{
        if(requirementId) await cleanupRequirement(requirementId);
        for(const id of taskIds) await admin.query("DELETE FROM ai_generation_requests WHERE id=$1 AND project_id=$2",[id,project]);
        if(caseId) await admin.query("DELETE FROM testcases WHERE id=$1 AND project_id=$2",[caseId,project]);
        await cleanupSkills(skillIds);
      }
    });

    it("activates one exact criterion group without retiring a different array order",async()=>{
      const skills=await publishSkills();
      const skillIds=[skills.requirement.doc.id,skills.cases.doc.id];
      let requirementId="";
      let caseId="";
      try{
        const staged=await stageBundle(ops());
        const applied=await service().applyRequirementProposal(project,user,staged.id,{expectedProposalRevision:staged.proposalRevision},human);
        requirementId=applied.receipt.requirement.documentId;
        caseId=applied.receipt.testcase.id;
        await service().approveRequirementVersion(project,user,requirementId,{versionId:applied.receipt.requirement.versionId},human);
        const caseBefore=await revisionsOf(caseId);
        await service().approveTestCaseForUser(user,project,caseId,{expectedRevision:caseBefore.edit_revision,expectedApprovalRevision:caseBefore.approval_revision},human);
        const caseAfter=await revisionsOf(caseId);
        const approvedVersion=String((await admin.query("SELECT reviewed_version_id FROM knowledge_documents WHERE id=$1",[requirementId])).rows[0].reviewed_version_id);
        const insert=async(keys:string[])=>String((await admin.query(
          `INSERT INTO requirement_case_links
             (project_id,requirement_id,requirement_version_id,criterion_keys,testcase_id,testcase_revision,testcase_approval_revision,state,proposed_by,applied_by,applied_at)
           VALUES ($1,$2,$3,$4::text[],$5,$6,$7,'active',$8,$8,now()) RETURNING id`,
          [project,requirementId,approvedVersion,keys,caseId,caseAfter.edit_revision,caseAfter.approval_revision,user]
        )).rows[0].id);
        const groupA=await insert(["AC-1","AC-2"]);
        const groupB=await insert(["AC-2","AC-1"]);
        const otherBefore=await admin.query("SELECT id,state,criterion_keys FROM requirement_case_links WHERE id=$1",[groupB]);
        const activated=await service().reapplyRequirementCaseLink(project,user,requirementId,groupA,
          {expectedCaseRevision:caseAfter.edit_revision,expectedApprovalRevision:caseAfter.approval_revision},human);
        expect(activated.replayed).toBe(false);
        expect(activated.link.criterionKeys).toEqual(["AC-1","AC-2"]);
        expect((await admin.query("SELECT state FROM requirement_case_links WHERE id=$1",[groupA])).rows[0].state).toBe("retired");
        const otherAfter=await admin.query("SELECT id,state,criterion_keys FROM requirement_case_links WHERE id=$1",[groupB]);
        expect(otherAfter.rows).toEqual(otherBefore.rows);
        const active=await admin.query("SELECT id,criterion_keys FROM requirement_case_links WHERE project_id=$1 AND requirement_id=$2 AND testcase_id=$3 AND state='active' ORDER BY id",[project,requirementId,caseId]);
        expect(active.rows.some(row=>String(row.id)===String(activated.link.id)&&JSON.stringify(row.criterion_keys)===JSON.stringify(["AC-1","AC-2"]))).toBe(true);
        expect(active.rows.some(row=>String(row.id)===groupB&&JSON.stringify(row.criterion_keys)===JSON.stringify(["AC-2","AC-1"]))).toBe(true);
      }finally{
        if(requirementId) await cleanupRequirement(requirementId);
        await cleanupSkills(skillIds);
      }
    });

    it.each(["unapproved","superseded"])("does not replay an activation after its requirement basis becomes %s",async basis=>{
      const skills=await publishSkills();
      const skillIds=[skills.requirement.doc.id,skills.cases.doc.id];
      const taskIds:string[]=[];
      let requirementId="",caseId="";
      try{
        const staged=await stageBundle(ops());taskIds.push(staged.id);
        const applied=await service().applyRequirementProposal(project,user,staged.id,{expectedProposalRevision:staged.proposalRevision},human);
        requirementId=applied.receipt.requirement.documentId;caseId=applied.receipt.testcase.id;
        const approval=await service().approveRequirementVersion(project,user,requirementId,{versionId:applied.receipt.requirement.versionId},human);
        const before=await revisionsOf(caseId);
        await service().approveTestCaseForUser(user,project,caseId,{expectedRevision:before.edit_revision,expectedApprovalRevision:before.approval_revision},human);
        const current=await revisionsOf(caseId);
        const revisions={expectedCaseRevision:current.edit_revision,expectedApprovalRevision:current.approval_revision};
        const activated=await service().reapplyRequirementCaseLink(project,user,requirementId,applied.receipt.link.id,
          {...revisions,expectedRequirementVersionId:approval.approvedVersionId},human);
        expect(activated).toMatchObject({replayed:false,link:{requirementVersionId:approval.approvedVersionId}});

        // A lost-response retry on the unchanged exact basis returns the same link and one audit.
        const afterActivation=await bundleWrites(staged.id);
        const retry=await service().reapplyRequirementCaseLink(project,user,requirementId,applied.receipt.link.id,
          {...revisions,expectedRequirementVersionId:approval.approvedVersionId},human);
        expect(retry).toEqual({...activated,replayed:true});
        expect(await bundleWrites(staged.id)).toEqual(afterActivation);
        expect((await admin.query("SELECT id FROM audit_logs WHERE project_id=$1 AND action='requirement_link_reapplied' AND entity_name=$2",[project,requirementId])).rows).toHaveLength(1);

        // Use the real governed revision path: applying clears approval, and approving the new
        // requirement must not silently move the old case/link onto the new meaning.
        const revisionOperations=ops({documentId:requirementId,expectedRevision:await revision(requirementId),title:`Changed requirement ${randomUUID()}`}).slice(0,1);
        const changed=await stageBundle(revisionOperations);taskIds.push(changed.id);
        const revised=await service().applyRequirementProposal(project,user,changed.id,{expectedProposalRevision:changed.proposalRevision},human);
        if(basis==="superseded"){
          const next=await service().approveRequirementVersion(project,user,requirementId,{versionId:revised.receipt.requirement.versionId},human);
          expect(next.approvedVersionId).not.toBe(approval.approvedVersionId);
        }
        const preserved=await bundleWrites(changed.id);
        // This is the legacy request shape. It may not mistake the still-readable old active
        // generation for a replay on the requirement's absent/new current approval.
        await expect(service().reapplyRequirementCaseLink(project,user,requirementId,applied.receipt.link.id,revisions,human))
          .rejects.toMatchObject({status:409,response:{code:basis==="unapproved"?"REQUIREMENT_NOT_APPROVED":"LINK_NOT_ACTIVE"}});
        expect(await bundleWrites(changed.id)).toEqual(preserved);
        expect((await admin.query("SELECT * FROM requirement_case_links WHERE id=$1",[activated.link.id])).rows[0])
          .toEqual(afterActivation.links.find((row:Body)=>row.id===activated.link.id));
      }finally{
        if(requirementId)await cleanupRequirement(requirementId);
        for(const id of taskIds)await admin.query("DELETE FROM ai_generation_requests WHERE id=$1 AND project_id=$2",[id,project]);
        if(caseId)await admin.query("DELETE FROM testcases WHERE id=$1 AND project_id=$2",[caseId,project]);
        await cleanupSkills(skillIds);
      }
    });

    it.each(["edited","missing-approval-receipt"])("does not replay a retired link when the current case is %s",async change=>{
      const skills=await publishSkills();
      const skillIds=[skills.requirement.doc.id,skills.cases.doc.id];
      let requirementId="",caseId="",taskId="";
      try{
        const staged=await stageBundle(ops());taskId=staged.id;
        const applied=await service().applyRequirementProposal(project,user,staged.id,{expectedProposalRevision:staged.proposalRevision},human);
        requirementId=applied.receipt.requirement.documentId;caseId=applied.receipt.testcase.id;
        const approval=await service().approveRequirementVersion(project,user,requirementId,{versionId:applied.receipt.requirement.versionId},human);
        const before=await revisionsOf(caseId);
        await service().approveTestCaseForUser(user,project,caseId,{expectedRevision:before.edit_revision,expectedApprovalRevision:before.approval_revision},human);
        const reviewed=await revisionsOf(caseId);
        const request={expectedCaseRevision:reviewed.edit_revision,expectedApprovalRevision:reviewed.approval_revision,
          expectedRequirementVersionId:approval.approvedVersionId};
        const activated=await service().reapplyRequirementCaseLink(project,user,requirementId,applied.receipt.link.id,request,human);
        const afterActivation=await bundleWrites(staged.id);
        expect(await service().reapplyRequirementCaseLink(project,user,requirementId,applied.receipt.link.id,request,human))
          .toEqual({...activated,replayed:true});
        expect(await bundleWrites(staged.id)).toEqual(afterActivation);
        if(change==="edited"){
          await service().updateTestCaseForUser(user,project,caseId,{title:`Changed after activation ${randomUUID()}`,expectedRevision:reviewed.edit_revision});
          expect((await revisionsOf(caseId)).edit_revision).not.toBe(reviewed.edit_revision);
        }else{
          // Deliberate migrated-DB integrity fixture: no native revoke API preserves the edit hash.
          // Remove only this disposable case's receipt to model a legacy/missing approval binding;
          // the replay must fail closed even though its old case row and link revisions still match.
          await admin.query("DELETE FROM testcase_approval_receipts WHERE testcase_id=$1 AND project_id=$2 AND semantic_revision=$3",[caseId,project,reviewed.approval_revision]);
          expect(await revisionsOf(caseId)).toMatchObject({edit_revision:reviewed.edit_revision,
            approval_revision:reviewed.approval_revision,approval_current:false});
        }
        const preserved=await bundleWrites(staged.id);
        const expectedCode=change==="edited"?"CASE_REVISION_CONFLICT":"CASE_NOT_APPROVED";
        await expect(service().reapplyRequirementCaseLink(project,user,requirementId,applied.receipt.link.id,request,human))
          .rejects.toMatchObject({status:409,response:{code:expectedCode}});
        expect(await bundleWrites(staged.id)).toEqual(preserved);
        if(change==="edited"){
          const changed=await revisionsOf(caseId);
          await service().approveTestCaseForUser(user,project,caseId,{expectedRevision:changed.edit_revision,expectedApprovalRevision:changed.approval_revision},human);
          const reapproved=await bundleWrites(staged.id);
          await expect(service().reapplyRequirementCaseLink(project,user,requirementId,applied.receipt.link.id,request,human))
            .rejects.toMatchObject({status:409,response:{code:"CASE_REVISION_CONFLICT"}});
          expect(await bundleWrites(staged.id)).toEqual(reapproved);
        }
        expect((await admin.query("SELECT * FROM requirement_case_links WHERE id=$1",[activated.link.id])).rows[0])
          .toEqual(afterActivation.links.find((row:Body)=>row.id===activated.link.id));
      }finally{
        if(requirementId)await cleanupRequirement(requirementId);
        if(taskId)await admin.query("DELETE FROM ai_generation_requests WHERE id=$1 AND project_id=$2",[taskId,project]);
        if(caseId)await admin.query("DELETE FROM testcases WHERE id=$1 AND project_id=$2",[caseId,project]);
        await cleanupSkills(skillIds);
      }
    });

    it("refuses a changed displayed requirement version before retiring links or reaching criterion validation",async()=>{
      const skills=await publishSkills();
      const skillIds=[skills.requirement.doc.id,skills.cases.doc.id];
      const taskIds:string[]=[];
      let requirementId="",caseId="";
      try{
        const staged=await stageBundle(ops());taskIds.push(staged.id);
        const applied=await service().applyRequirementProposal(project,user,staged.id,{expectedProposalRevision:staged.proposalRevision},human);
        requirementId=applied.receipt.requirement.documentId;caseId=applied.receipt.testcase.id;
        const reviewed=await service().approveRequirementVersion(project,user,requirementId,{versionId:applied.receipt.requirement.versionId},human);
        const before=await revisionsOf(caseId);
        await service().approveTestCaseForUser(user,project,caseId,{expectedRevision:before.edit_revision,expectedApprovalRevision:before.approval_revision},human);
        const current=await revisionsOf(caseId);

        // A second human replaces the reviewed meaning and removes the selected criterion while
        // the first human still has the old approval open. This must be a semantic stale-review
        // refusal, not an attempted rebind followed by the DB's 23514 constraint failure.
        const changed=await stageBundle(ops({documentId:requirementId,expectedRevision:await revision(requirementId),
          criteria:[{key:"AC-2",text:"Only the second obligation remains"}]}).slice(0,1));taskIds.push(changed.id);
        const revised=await service().applyRequirementProposal(project,user,changed.id,{expectedProposalRevision:changed.proposalRevision},human);
        await service().approveRequirementVersion(project,user,requirementId,{versionId:revised.receipt.requirement.versionId},human);
        const preserved=await bundleWrites(changed.id);
        await expect(service().reapplyRequirementCaseLink(project,user,requirementId,applied.receipt.link.id,
          {expectedCaseRevision:current.edit_revision,expectedApprovalRevision:current.approval_revision,
            expectedRequirementVersionId:reviewed.approvedVersionId},human))
          .rejects.toMatchObject({status:409,response:{code:"REQUIREMENT_VERSION_CONFLICT"}});
        expect(await bundleWrites(changed.id)).toEqual(preserved);
      }finally{
        if(requirementId)await cleanupRequirement(requirementId);
        for(const id of taskIds)await admin.query("DELETE FROM ai_generation_requests WHERE id=$1 AND project_id=$2",[id,project]);
        if(caseId)await admin.query("DELETE FROM testcases WHERE id=$1 AND project_id=$2",[caseId,project]);
        await cleanupSkills(skillIds);
      }
    });

    it("validates an explicitly supplied requirement basis while preserving successful legacy activation",async()=>{
      const skills=await publishSkills();
      const skillIds=[skills.requirement.doc.id,skills.cases.doc.id];
      let requirementId="",caseId="",taskId="";
      try{
        const staged=await stageBundle(ops());taskId=staged.id;
        const applied=await service().applyRequirementProposal(project,user,staged.id,{expectedProposalRevision:staged.proposalRevision},human);
        requirementId=applied.receipt.requirement.documentId;caseId=applied.receipt.testcase.id;
        const approved=await service().approveRequirementVersion(project,user,requirementId,{versionId:applied.receipt.requirement.versionId},human);
        const before=await revisionsOf(caseId);
        await service().approveTestCaseForUser(user,project,caseId,{expectedRevision:before.edit_revision,expectedApprovalRevision:before.approval_revision},human);
        const current=await revisionsOf(caseId);
        const revisions={expectedCaseRevision:current.edit_revision,expectedApprovalRevision:current.approval_revision};
        const preserved=await bundleWrites(staged.id);
        for(const invalid of ["",null,17,{},[approved.approvedVersionId],"not-a-version"]){
          await expect(service().reapplyRequirementCaseLink(project,user,requirementId,applied.receipt.link.id,
            {...revisions,expectedRequirementVersionId:invalid},human)).rejects.toMatchObject({status:400});
          expect(await bundleWrites(staged.id)).toEqual(preserved);
        }
        const activated=await service().reapplyRequirementCaseLink(project,user,requirementId,applied.receipt.link.id,revisions,human);
        expect(activated).toMatchObject({replayed:false,link:{requirementVersionId:approved.approvedVersionId,
          testcaseRevision:current.edit_revision,testcaseApprovalRevision:current.approval_revision}});
      }finally{
        if(requirementId)await cleanupRequirement(requirementId);
        if(taskId)await admin.query("DELETE FROM ai_generation_requests WHERE id=$1 AND project_id=$2",[taskId,project]);
        if(caseId)await admin.query("DELETE FROM testcases WHERE id=$1 AND project_id=$2",[caseId,project]);
        await cleanupSkills(skillIds);
      }
    });

    it("activates only the selected ordered criterion group and exposes each persisted case basis",async()=>{
      const skills=await publishSkills();
      const skillIds=[skills.requirement.doc.id,skills.cases.doc.id];
      let requirementId="",caseId="",taskId="";
      try{
        const criteria=[{key:"AC-1",text:"First obligation"},{key:"AC-2",text:"Second obligation"},{key:"AC-3",text:"Independent obligation"}];
        const staged=await stageBundle(ops({criteria,criterionKeys:["AC-1","AC-2"]}));taskId=staged.id;
        const applied=await service().applyRequirementProposal(project,user,staged.id,{expectedProposalRevision:staged.proposalRevision},human);
        requirementId=applied.receipt.requirement.documentId;caseId=applied.receipt.testcase.id;
        const approval=await service().approveRequirementVersion(project,user,requirementId,{versionId:applied.receipt.requirement.versionId},human);
        const selected=(await admin.query("SELECT * FROM requirement_case_links WHERE requirement_id=$1 AND requirement_version_id=$2",[requirementId,approval.approvedVersionId])).rows[0];
        // These are migrated-DB fixtures, not a new public link writer. Current identity preserves
        // array order (including the reversed-order neighbor); changing that needs its own contract.
        const neighbors:Body[]=[];
        for(const keys of [["AC-3"],["AC-2","AC-1"]]){
          neighbors.push((await admin.query(
            `INSERT INTO requirement_case_links
               (project_id,requirement_id,requirement_version_id,criterion_keys,testcase_id,testcase_revision,testcase_approval_revision,state,proposed_by,applied_by,applied_at)
             SELECT project_id,requirement_id,requirement_version_id,$2::text[],testcase_id,testcase_revision,testcase_approval_revision,state,proposed_by,applied_by,applied_at
               FROM requirement_case_links WHERE id=$1 RETURNING *`,[selected.id,keys])).rows[0]);
        }
        const before=await revisionsOf(caseId);
        await service().approveTestCaseForUser(user,project,caseId,{expectedRevision:before.edit_revision,expectedApprovalRevision:before.approval_revision},human);
        const current=await revisionsOf(caseId);
        const request={expectedCaseRevision:current.edit_revision,expectedApprovalRevision:current.approval_revision,
          expectedRequirementVersionId:approval.approvedVersionId};
        const activated=await service().reapplyRequirementCaseLink(project,user,requirementId,selected.id,request,human);
        expect(activated).toMatchObject({replayed:false,link:{criterionKeys:["AC-1","AC-2"],requirementVersionId:approval.approvedVersionId}});
        for(const neighbor of neighbors){
          expect((await admin.query("SELECT * FROM requirement_case_links WHERE id=$1",[neighbor.id])).rows[0]).toEqual(neighbor);
        }
        const active=(await admin.query("SELECT * FROM requirement_case_links WHERE requirement_id=$1 AND state='active' ORDER BY id",[requirementId])).rows;
        expect(active).toHaveLength(3);
        expect(active.filter((row:Body)=>JSON.stringify(row.criterion_keys)===JSON.stringify(["AC-1","AC-2"])))
          .toEqual([expect.objectContaining({id:activated.link.id})]);
        const preserved=await bundleWrites(staged.id);
        expect(await service().reapplyRequirementCaseLink(project,user,requirementId,selected.id,request,human))
          .toEqual({...activated,replayed:true});
        expect(await bundleWrites(staged.id)).toEqual(preserved);
        const coverage=await service().requirementCoverage(project,user,requirementId);
        expect(coverage.cases.find((row:Body)=>row.linkId===activated.link.id)).toMatchObject({approved:true,
          testcaseRevision:current.edit_revision,testcaseApprovalRevision:current.approval_revision});
        for(const neighbor of neighbors){
          expect(coverage.cases.find((row:Body)=>row.linkId===neighbor.id)).toMatchObject({approved:false,
            testcaseRevision:neighbor.testcase_revision,testcaseApprovalRevision:null});
        }
      }finally{
        if(requirementId)await cleanupRequirement(requirementId);
        if(taskId)await admin.query("DELETE FROM ai_generation_requests WHERE id=$1 AND project_id=$2",[taskId,project]);
        if(caseId)await admin.query("DELETE FROM testcases WHERE id=$1 AND project_id=$2",[caseId,project]);
        await cleanupSkills(skillIds);
      }
    });

    it("governs manual/policy metadata and exact submitted versions without Zyra exposure",async()=>{
      const folder=(await admin.query("SELECT id FROM knowledge_folders WHERE project_id=$1 LIMIT 1",[project])).rows[0]?.id
        || (await admin.query("INSERT INTO knowledge_folders(organization_id,project_id,name,is_root) SELECT organization_id,id,'Knowledge base',true FROM projects WHERE id=$1 RETURNING id",[project])).rows[0].id;
      const metadata={schemaVersion:"tesbo-governed-document/1",audience:"internal",subtype:"manual",confidentiality:"internal",
        distribution:"internal",sourceAuthority:{kind:"internal",label:"Project owner",reference:null},
        effectivity:{from:"2026-01-01",to:null},enforcementRefs:[]};
      let docId="";
      let duplicateId="";
      let legacyId="";
      let qaId="";
      try{
        const created=await service().createKnowledgeDocument(project,user,{folderId:folder,title:`Governed manual ${randomUUID()}`,
          documentType:"user_manual",contentText:"Manual body",contentHtml:"<p>Manual body</p>",governedMetadata:metadata});
        docId=created.id;
        expect(created.governedMetadata).toMatchObject({audience:"internal",subtype:"manual",confidentiality:"internal"});
        // Exposure hold: the row is terminally unsupported so neither the boot sweep nor an
        // explicitly queued job can send confidential text to an embedding provider.
        expect((await admin.query("SELECT embedding_status FROM knowledge_documents WHERE id=$1",[docId])).rows[0].embedding_status)
          .toBe("unsupported");
        // Draft governed content is excluded by the type filter, not merely because an approval
        // snapshot is absent from the AI-context predicate.
        const exposedDraft=await admin.query(`SELECT COUNT(*)::int AS n FROM knowledge_documents WHERE id=$1 AND ${knowledgeDocumentAiContextSql()}`,[docId]);
        expect(exposedDraft.rows[0].n).toBe(0);

        await expect(service().createKnowledgeDocument(project,user,{folderId:folder,title:`Invalid manual ${randomUUID()}`,
          documentType:"user_manual",governedMetadata:{...metadata,audience:"nope"}})).rejects.toMatchObject({status:400});
        await expect(service().createKnowledgeDocument(project,user,{folderId:folder,title:`Missing metadata ${randomUUID()}`,
          documentType:"user_manual"})).rejects.toMatchObject({status:400});
        await expect(service().createKnowledgeDocument(project,user,{folderId:folder,title:`Unknown metadata key ${randomUUID()}`,
          documentType:"user_manual",governedMetadata:{...metadata,unexpected:true}})).rejects.toMatchObject({status:400});
        await expect(service().createKnowledgeDocument(project,user,{folderId:folder,title:`Impossible date ${randomUUID()}`,
          documentType:"user_manual",governedMetadata:{...metadata,effectivity:{from:"2026-02-31",to:null}}})).rejects.toMatchObject({status:400});
        await expect(service().createKnowledgeDocument(project,user,{folderId:folder,title:`Inverted effectivity ${randomUUID()}`,
          documentType:"user_manual",governedMetadata:{...metadata,effectivity:{from:"2026-06-01",to:"2026-01-01"}}})).rejects.toMatchObject({status:400});
        await expect(service().createKnowledgeDocument(project,user,{folderId:folder,title:`Manual enforcement ${randomUUID()}`,
          documentType:"user_manual",governedMetadata:{...metadata,enforcementRefs:["ACME-1"]}})).rejects.toMatchObject({status:400});

        const duplicate=await service().duplicateKnowledgeDocument(project,user,docId);
        duplicateId=duplicate.id;
        expect(duplicate.governedMetadata).toMatchObject({audience:"internal",subtype:"manual",confidentiality:"internal",distribution:"internal"});
        expect((await admin.query("SELECT embedding_status FROM knowledge_documents WHERE id=$1",[duplicateId])).rows[0].embedding_status)
          .toBe("unsupported");

        const submitted=await service().submitKnowledgeDocument(project,user,docId,
          {expectedRevision:created.editRevision,submissionKey:randomUUID()},human);
        const detail=await service().getKnowledgeDocumentVersion(project,user,docId,submitted.id);
        expect(detail.snapshotMetadata).toMatchObject({governedMetadata:{audience:"internal",subtype:"manual"}});

        qaId=(await admin.query("INSERT INTO users(email,name) VALUES ($1,'Governed docs reader') RETURNING id",[`governed-reader-${randomUUID()}@tesbo.invalid`])).rows[0].id;
        await admin.query("INSERT INTO organization_members(organization_id,user_id,role) VALUES ($1,$2,'qa_engineer')",[org,qaId]);
        await admin.query("INSERT INTO project_members(project_id,user_id,role) VALUES ($1,$2,'qa_engineer')",[project,qaId]);
        await expect(service().approveGovernedKnowledgeDocument(project,qaId,docId,{versionId:submitted.id},human))
          .rejects.toMatchObject({status:403});

        const changed=await service().updateKnowledgeDocument(project,user,docId,
          {governedMetadata:{...metadata,confidentiality:"confidential"},expectedRevision:created.editRevision});
        await expect(service().approveGovernedKnowledgeDocument(project,user,docId,{versionId:submitted.id},human))
          .rejects.toMatchObject({status:409,response:{code:"DOCUMENT_REVISION_CONFLICT"}});
        await service().updateKnowledgeDocument(project,user,docId,
          {governedMetadata:metadata,expectedRevision:changed.editRevision});
        const approved=await service().approveGovernedKnowledgeDocument(project,user,docId,{versionId:submitted.id},human);
        expect(approved).toMatchObject({status:"approved",sourceVersionId:submitted.id,replayed:false});
        expect(approved.reviewedVersionId).toBe(approved.decidedVersionId);
        const retry=await service().approveGovernedKnowledgeDocument(project,user,docId,{versionId:submitted.id},human);
        expect(retry).toMatchObject({decidedVersionId:approved.decidedVersionId,replayed:true});
        // Approval alone must not expose the manual to Zyra/RAG. Assert while the document is
        // actually approved: doing this only after a rejection would pass for the wrong reason.
        const exposedApproved=await admin.query(`SELECT COUNT(*)::int AS n FROM knowledge_documents WHERE id=$1 AND ${knowledgeDocumentAiContextSql()}`,[docId]);
        expect(exposedApproved.rows[0].n).toBe(0);

        // A later rejection must supersede the earlier approval as the current decision. The
        // snapshot is bound to the exact newly submitted version, not to the document's latest
        // content at review time.
        const current=await service().getKnowledgeDocument(project,user,docId);
        const edited=await service().updateKnowledgeDocument(project,user,docId,
          {contentText:"Manual body revised",contentHtml:"<p>Manual body revised</p>",expectedRevision:current.editRevision});
        const second=await service().submitKnowledgeDocument(project,user,docId,
          {expectedRevision:edited.editRevision,submissionKey:randomUUID()},human);
        const rejected=await service().rejectGovernedKnowledgeDocument(project,user,docId,
          {versionId:second.id,reason:"Effectivity is out of date"},human);
        expect(rejected).toMatchObject({status:"rejected",sourceVersionId:second.id,replayed:false});
        const rejectedRetry=await service().rejectGovernedKnowledgeDocument(project,user,docId,
          {versionId:second.id,reason:"Effectivity is out of date"},human);
        expect(rejectedRetry).toMatchObject({decidedVersionId:rejected.decidedVersionId,replayed:true});
        const decisions=await admin.query(
          `SELECT snapshot_kind,snapshot_metadata->>'sourceVersionId' AS source_version_id,version_number
             FROM knowledge_document_versions WHERE document_id=$1 AND snapshot_kind IN ('approved','rejected')
            ORDER BY version_number`,[docId]);
        expect(decisions.rows.map(row=>row.snapshot_kind)).toEqual(["approved","rejected"]);
        expect(decisions.rows[1]).toMatchObject({snapshot_kind:"rejected",source_version_id:second.id});
        expect((await admin.query("SELECT status,reviewed_version_id FROM knowledge_documents WHERE id=$1",[docId])).rows[0])
          .toMatchObject({status:"rejected",reviewed_version_id:rejected.decidedVersionId});

        const exposed=await admin.query(`SELECT COUNT(*)::int AS n FROM knowledge_documents WHERE id=$1 AND ${knowledgeDocumentAiContextSql()}`,[docId]);
        expect(exposed.rows[0].n).toBe(0);
        // A rejected document must be edited back to draft before another submission. Two identical
        // submissions then bind to different exact versions; approving the older one must not leave
        // the latest submission showing as undecided.
        const rejectedState=await service().getKnowledgeDocument(project,user,docId);
        await expect(service().submitKnowledgeDocument(project,user,docId,
          {expectedRevision:rejectedState.editRevision,submissionKey:randomUUID()},human))
          .rejects.toMatchObject({status:409,response:{code:"DOCUMENT_NOT_DRAFT"}});
        const reopened=await service().updateKnowledgeDocument(project,user,docId,
          {contentText:"Manual body reopened",expectedRevision:rejectedState.editRevision});
        const older=await service().submitKnowledgeDocument(project,user,docId,
          {expectedRevision:reopened.editRevision,submissionKey:randomUUID()},human);
        await service().submitKnowledgeDocument(project,user,docId,
          {expectedRevision:reopened.editRevision,submissionKey:randomUUID()},human);
        await expect(service().approveGovernedKnowledgeDocument(project,user,docId,{versionId:older.id},human))
          .rejects.toMatchObject({status:409,response:{code:"GOVERNED_VERSION_SUPERSEDED"}});
        await expect(service().updateKnowledgeDocument(project,user,docId,
          {documentType:"general",expectedRevision:reopened.editRevision}))
          .rejects.toMatchObject({status:400});

        legacyId=(await service().createKnowledgeDocument(project,user,{folderId:folder,title:`Legacy general ${randomUUID()}`,documentType:"general",contentText:"Legacy"})).id;
        await expect(service().approveGovernedKnowledgeDocument(project,user,legacyId,{versionId:submitted.id},human))
          .rejects.toMatchObject({status:400});
      }finally{
        for(const id of [docId,duplicateId,legacyId].filter(Boolean)){
          await admin.query("UPDATE knowledge_documents SET reviewed_version_id=NULL WHERE id=$1",[id]);
          await admin.query("DELETE FROM knowledge_document_versions WHERE document_id=$1",[id]);
          await admin.query("DELETE FROM knowledge_documents WHERE id=$1",[id]);
        }
        if(qaId){
          await admin.query("DELETE FROM project_members WHERE project_id=$1 AND user_id=$2",[project,qaId]);
          await admin.query("DELETE FROM organization_members WHERE organization_id=$1 AND user_id=$2",[org,qaId]);
          await admin.query("DELETE FROM users WHERE id=$1",[qaId]);
        }
      }
    });

    it("rechecks the agent restriction against a document that becomes governed while a token operation waits",async()=>{
      const folder=(await admin.query("SELECT id FROM knowledge_folders WHERE project_id=$1 LIMIT 1",[project])).rows[0]?.id
        || (await admin.query("INSERT INTO knowledge_folders(organization_id,project_id,name,is_root) SELECT organization_id,id,'Knowledge base',true FROM projects WHERE id=$1 RETURNING id",[project])).rows[0].id;
      const otherFolder=(await admin.query("INSERT INTO knowledge_folders(organization_id,project_id,name) SELECT organization_id,id,$2 FROM projects WHERE id=$1 RETURNING id",[project,`Race target ${randomUUID()}`])).rows[0].id;
      const metadata={schemaVersion:"tesbo-governed-document/1",audience:"internal",subtype:"manual",confidentiality:"internal",
        distribution:"internal",sourceAuthority:{kind:"internal",label:"Project owner",reference:null},
        effectivity:{from:null,to:null},enforcementRefs:[]};
      const blocker=new Client({connectionString:url}); await blocker.connect();
      const docIds:string[]=[];
      const makeDoc=async(title:string)=>service().createKnowledgeDocument(project,user,{folderId:folder,title,contentText:`${title} body`});
      const race=async(docId:string,expectedRevision:string,operation:()=>Promise<Body>)=>{
        await blocker.query("BEGIN");
        await blocker.query("SELECT id FROM knowledge_documents WHERE id=$1 FOR UPDATE",[docId]);
        const conversion=service().updateKnowledgeDocument(project,user,docId,
          {documentType:"user_manual",governedMetadata:metadata,expectedRevision});
        expect(await waitUntil(async()=>(await waitingLockers())>=1)).toBe(true);
        const pending=operation().then(value=>({value,error:undefined as Body|undefined}),error=>({value:undefined as Body|undefined,error:error as Body}));
        // Both the conversion and the token operation must be visibly blocked before release:
        // otherwise the token call may not have passed its pre-lock read and a pre-lock 403
        // would pass for the in-lock recheck.
        expect(await waitUntil(async()=>(await waitingLockers())>=2)).toBe(true);
        await blocker.query("COMMIT");
        await conversion;
        expect((await pending).error).toMatchObject({status:403});
      };
      try{
        const moveDoc=await makeDoc(`Race move ${randomUUID()}`); docIds.push(moveDoc.id);
        await race(moveDoc.id,moveDoc.editRevision,
          ()=>service().moveKnowledgeDocument(project,user,moveDoc.id,{folderId:otherFolder},{kind:"api_token"}));
        expect((await admin.query("SELECT folder_id,document_type FROM knowledge_documents WHERE id=$1",[moveDoc.id])).rows[0])
          .toEqual({folder_id:folder,document_type:"user_manual"});
        expect((await admin.query("SELECT COUNT(*)::int AS n FROM audit_logs WHERE entity_id=$1 AND action='moved'",[moveDoc.id])).rows[0].n).toBe(0);

        const restoreDoc=await makeDoc(`Race restore ${randomUUID()}`); docIds.push(restoreDoc.id);
        const changed=await service().updateKnowledgeDocument(project,user,restoreDoc.id,
          {contentText:"Changed restore body",expectedRevision:restoreDoc.editRevision});
        const originalVersion=(await admin.query(
          "SELECT id FROM knowledge_document_versions WHERE document_id=$1 ORDER BY version_number LIMIT 1",[restoreDoc.id]
        )).rows[0]?.id;
        const version=await service().submitKnowledgeDocument(project,user,restoreDoc.id,
          {expectedRevision:changed.editRevision,submissionKey:randomUUID()},human);
        expect(version.contentText).toBe("Changed restore body");
        const versionsBefore=(await admin.query("SELECT COUNT(*)::int AS n FROM knowledge_document_versions WHERE document_id=$1",[restoreDoc.id])).rows[0].n;
        await race(restoreDoc.id,changed.editRevision,
          ()=>service().restoreKnowledgeDocumentVersion(project,user,restoreDoc.id,{versionId:originalVersion},{kind:"api_token"}));
        expect((await service().getKnowledgeDocument(project,user,restoreDoc.id)).contentText).toBe("Changed restore body");
        // The owner conversion itself writes one autosave snapshot (metadata changed); the refused
        // restore must not add another.
        expect((await admin.query("SELECT COUNT(*)::int AS n FROM knowledge_document_versions WHERE document_id=$1",[restoreDoc.id])).rows[0].n).toBe(versionsBefore+1);
        expect((await admin.query("SELECT COUNT(*)::int AS n FROM audit_logs WHERE entity_id=$1 AND action='restored_version'",[restoreDoc.id])).rows[0].n).toBe(0);

        const duplicateDoc=await makeDoc(`Race duplicate ${randomUUID()}`); docIds.push(duplicateDoc.id);
        await race(duplicateDoc.id,duplicateDoc.editRevision,
          ()=>service().duplicateKnowledgeDocument(project,user,duplicateDoc.id,{kind:"api_token"}));
        expect((await admin.query("SELECT COUNT(*)::int AS n FROM knowledge_documents WHERE project_id=$1 AND title=$2",[project,`${duplicateDoc.title} (copy)`])).rows[0].n).toBe(0);
      }finally{
        await blocker.query("ROLLBACK").catch(()=>undefined);
        await blocker.end();
        for(const id of docIds){
          await admin.query("UPDATE knowledge_documents SET reviewed_version_id=NULL WHERE id=$1",[id]);
          await admin.query("DELETE FROM knowledge_document_versions WHERE document_id=$1",[id]);
          await admin.query("DELETE FROM knowledge_documents WHERE id=$1",[id]);
        }
        await admin.query("DELETE FROM knowledge_folders WHERE id=$1",[otherFolder]);
      }
    },120000);

    it("stages an agent manual candidate with a pinned Skill and applies only a native draft",async()=>{
      const folder=(await admin.query("SELECT id FROM knowledge_folders WHERE project_id=$1 LIMIT 1",[project])).rows[0]?.id
        || (await admin.query("INSERT INTO knowledge_folders(organization_id,project_id,name,is_root) SELECT organization_id,id,'Knowledge base',true FROM projects WHERE id=$1 RETURNING id",[project])).rows[0].id;
      const metadata={schemaVersion:"tesbo-governed-document/1",audience:"internal",subtype:"manual",confidentiality:"internal",
        distribution:"internal",sourceAuthority:{kind:"internal",label:"Project owner",reference:null},
        effectivity:{from:null,to:null},enforcementRefs:[]};
      const skillIds:string[]=[];
      let targetId="",createdId="",taskId="",createTaskId="",staleTaskId="",changedTaskId="";
      try{
        const skill=await skillFor("user_manuals","internal","manual_revision"); skillIds.push(skill.doc.id);
        const target=await service().createKnowledgeDocument(project,user,{folderId:folder,title:`Agent manual ${randomUUID()}`,
          documentType:"user_manual",contentText:"Base body",contentHtml:"<p>Base body</p>",governedMetadata:metadata});
        targetId=target.id;
        const producer={kind:"api_token" as const,transport:"rest" as const,tokenId:token};
        const staged=await service().stageManagedDocumentProposal(project,user,{
          requestKey:randomUUID(),operation:"update",documentId:targetId,expectedRevision:target.editRevision,
          document:{title:`${target.title} revised`,contentText:"Revised body",contentHtml:"<p>Revised body</p>",
            contentJson:{type:"doc",content:[{type:"paragraph",content:[{type:"text",text:"Revised body"}]}]},
            governedMetadata:{...metadata,confidentiality:"confidential"}},reason:"Security update"
        },producer);
        taskId=staged.id;
        expect(staged).toMatchObject({taskStatus:"in_review",skillContext:{status:"resolved"}});
        const view=await service().managedDocumentProposalTask(project,user,taskId);
        expect(view.managedDocumentProposal).toMatchObject({operation:"update",documentType:"user_manual",
          target:{documentId:targetId,editRevision:target.editRevision},skillApplicability:{status:"current"}});
        expect(view.managedDocumentProposal.proposed).toMatchObject({contentText:"Revised body",governedMetadata:{confidentiality:"confidential"}});
        expect(view.managedDocumentProposal.diff.summary).toBeTruthy();
        const untouched=(await admin.query(`SELECT content_text,governed_metadata,status,${KNOWLEDGE_DOCUMENT_REVISION_SQL} AS r FROM knowledge_documents WHERE id=$1`,[targetId])).rows[0];
        expect(untouched).toMatchObject({content_text:"Base body",status:"draft",r:target.editRevision});
        await expect(service().applyManagedDocumentProposal(project,user,taskId,{expectedProposalRevision:view.proposalRevision},
          {kind:"api_token"})).rejects.toMatchObject({status:403,response:{code:"HUMAN_REVIEW_REQUIRED"}});
        await expect(service().applyManagedDocumentProposal(project,user,taskId,{expectedProposalRevision:view.proposalRevision},human))
          .resolves.toMatchObject({taskStatus:"done",replayed:false,receipt:{document:{documentId:targetId,status:"draft"}}});
        const after=await admin.query("SELECT content_text,governed_metadata,status,reviewed_version_id FROM knowledge_documents WHERE id=$1",[targetId]);
        expect(after.rows[0]).toMatchObject({content_text:"Revised body",status:"draft",reviewed_version_id:null});
        expect(after.rows[0].governed_metadata).toMatchObject({confidentiality:"confidential"});
        const versionsAfter=(await admin.query("SELECT COUNT(*)::int AS n FROM knowledge_document_versions WHERE document_id=$1",[targetId])).rows[0].n;
        expect(await service().applyManagedDocumentProposal(project,user,taskId,{expectedProposalRevision:view.proposalRevision},human))
          .toMatchObject({taskStatus:"done",replayed:true});
        expect((await admin.query("SELECT COUNT(*)::int AS n FROM knowledge_document_versions WHERE document_id=$1",[targetId])).rows[0].n).toBe(versionsAfter);

        const policySkill=await skillFor("policies","internal","policy_revision"); skillIds.push(policySkill.doc.id);
        const createStaged=await service().stageManagedDocumentProposal(project,user,{
          requestKey:randomUUID(),operation:"create",folderId:folder,
          document:{title:`Agent policy ${randomUUID()}`,contentText:"Policy draft",contentHtml:"<p>Policy draft</p>",
            contentJson:{type:"doc",content:[{type:"paragraph",content:[{type:"text",text:"Policy draft"}]}]},
            governedMetadata:{...metadata,subtype:"policy",enforcementRefs:["ACME-1"]}},reason:"New policy"
        },producer,"policy");
        createTaskId=createStaged.id;
        const createView=await service().managedDocumentProposalTask(project,user,createStaged.id);
        const created=await service().applyManagedDocumentProposal(project,user,createStaged.id,{expectedProposalRevision:createView.proposalRevision},human);
        createdId=created.receipt.document.documentId;
        expect((await admin.query("SELECT document_type,status,governed_metadata,embedding_status FROM knowledge_documents WHERE id=$1",[createdId])).rows[0])
          .toMatchObject({document_type:"policy",status:"draft",embedding_status:"unsupported",governed_metadata:{subtype:"policy",enforcementRefs:["ACME-1"]}});

        const staleStaged=await service().stageManagedDocumentProposal(project,user,{
          requestKey:randomUUID(),operation:"update",documentId:targetId,
          expectedRevision:(await service().getKnowledgeDocument(project,user,targetId)).editRevision,
          document:{title:`${target.title} stale`,contentText:"Stale body",contentHtml:"<p>Stale body</p>",
            contentJson:{type:"doc",content:[{type:"paragraph",content:[{type:"text",text:"Stale body"}]}]},governedMetadata:metadata}
        },producer);
        staleTaskId=staleStaged.id;
        const staleView=await service().managedDocumentProposalTask(project,user,staleTaskId);
        await service().deactivateSkillAssignment(project,user,skill.assignmentId,{},human);
        await expect(service().applyManagedDocumentProposal(project,user,staleTaskId,{expectedProposalRevision:staleView.proposalRevision},human))
          .rejects.toMatchObject({status:409,response:{code:"DOCUMENT_PROPOSAL_SKILL_STALE",applicability:"stale"}});
        expect((await admin.query("SELECT content_text FROM knowledge_documents WHERE id=$1",[targetId])).rows[0].content_text).toBe("Revised body");

        const restaffedSkill=await skillFor("user_manuals","internal","manual_revision"); skillIds.push(restaffedSkill.doc.id);
        const changedStaged=await service().stageManagedDocumentProposal(project,user,{
          requestKey:randomUUID(),operation:"update",documentId:targetId,
          expectedRevision:(await service().getKnowledgeDocument(project,user,targetId)).editRevision,
          document:{title:`${target.title} changed`,contentText:"Changed body",contentHtml:"<p>Changed body</p>",
            contentJson:{type:"doc",content:[{type:"paragraph",content:[{type:"text",text:"Changed body"}]}]},governedMetadata:metadata}
        },producer);
        changedTaskId=changedStaged.id;
        const changedView=await service().managedDocumentProposalTask(project,user,changedTaskId);
        await service().updateKnowledgeDocument(project,user,targetId,
          {contentText:"Concurrent edit",expectedRevision:(await service().getKnowledgeDocument(project,user,targetId)).editRevision});
        await expect(service().applyManagedDocumentProposal(project,user,changedTaskId,{expectedProposalRevision:changedView.proposalRevision},human))
          .rejects.toMatchObject({status:409,response:{code:"PROPOSAL_TARGET_CONFLICT"}});
        expect((await admin.query("SELECT content_text FROM knowledge_documents WHERE id=$1",[targetId])).rows[0].content_text).toBe("Concurrent edit");

        // With the preview capability off, the dedicated routes refuse and the generic read must
        // not become a side door to the same unpublished governed content, receipts or Skill basis.
        const priorPreview=process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED;
        try{
          process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED="0";
          await expect(service().managedDocumentProposalTask(project,user,changedTaskId))
            .rejects.toMatchObject({status:501});
          const redacted=await service().zyraTask(project,user,changedTaskId);
          expect(redacted.generatedPayload).toBeUndefined();
          expect(redacted.proposalSnapshot).toBeUndefined();
          expect(redacted.proposalRevision).toBeUndefined();
          expect(redacted.saveEvents).toBeUndefined();
          expect(redacted.skillContext).toBeUndefined();
          expect(redacted.proposalReviewRevision).toBeUndefined();
          expect(redacted.proposalProvenance).toBeUndefined();
          expect(redacted.proposalRequestKey).toBeUndefined();
          expect(redacted.proposalRequestDigest).toBeUndefined();
          expect(redacted.activityLog).toBeUndefined();
          expect(redacted.sourceSummary).toBeUndefined();
          expect(redacted.managedDocumentProposalEntries).toBeUndefined();
          expect(redacted.managedDocumentProposal).toBeUndefined();
          expect(redacted.activities).toEqual([]);
          expect(redacted.sources).toEqual([]);
          const history=await service().aiHistory(project,user,{limit:"100"});
          expect(history.list.some((entry:Body)=>entry.id===changedTaskId)).toBe(false);
        }finally{
          if(priorPreview===undefined) delete process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED;
          else process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED=priorPreview;
        }
      }finally{
        for(const id of [targetId,createdId].filter(Boolean)){
          await admin.query("UPDATE knowledge_documents SET reviewed_version_id=NULL WHERE id=$1",[id]);
          await admin.query("DELETE FROM knowledge_document_versions WHERE document_id=$1",[id]);
          await admin.query("DELETE FROM knowledge_documents WHERE id=$1",[id]);
        }
        for(const id of [taskId,createTaskId,staleTaskId,changedTaskId].filter(Boolean)) await admin.query("DELETE FROM ai_generation_requests WHERE id=$1",[id]);
        await cleanupSkills(skillIds);
      }
    },120000);

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

    it("replays omitted and explicit-key creation requests while preserving V161 rows",async()=>{
      const created:string[]=[];
      try{
        const firstTitle=`Omitted key ${randomUUID()}`, firstKey=randomUUID();
        const firstOps={title:firstTitle,module:"requirements",subtype:"functional",instructions:"RULE-OMIT: one observable outcome.",requestKey:firstKey};
        const first=await service().createSkillCandidate(project,user,firstOps,{kind:"human_session"} as never);
        created.push(first.id);
        const retried=await service().createSkillCandidate(project,user,firstOps,{kind:"human_session"} as never);
        expect(retried.id).toBe(first.id);
        expect(retried.replayed).toBe(true);
        expect(retried.skillKey).toBe(first.skillKey);
        expect(first.skillKey).not.toBe("null");
        expect((await admin.query("SELECT COUNT(*)::int AS n FROM skill_profiles WHERE project_id=$1 AND creation_request_key=$2",[project,firstKey])).rows[0].n).toBe(1);
        await expect(service().createSkillCandidate(project,user,{...firstOps,instructions:"RULE-OMIT: changed content."},{kind:"human_session"} as never)).rejects.toMatchObject({status:409,response:{code:"SKILL_REQUEST_CONFLICT"}});

        const explicitKey=randomUUID(), explicitTitle=`Explicit key ${randomUUID()}`;
        const explicitOps={title:explicitTitle,module:"requirements",subtype:"functional",skillKey:`EXPLICIT-${explicitKey.slice(0,8)}`,instructions:"RULE-EXPLICIT: one outcome.",requestKey:explicitKey};
        const explicit=await service().createSkillCandidate(project,user,explicitOps,{kind:"human_session"} as never);
        created.push(explicit.id);
        const explicitReplay=await service().createSkillCandidate(project,user,explicitOps,{kind:"human_session"} as never);
        expect(explicitReplay.id).toBe(explicit.id);
        expect(explicitReplay.skillKey).toBe(explicit.skillKey);
        await expect(service().createSkillCandidate(project,user,{...explicitOps,skillKey:undefined},{kind:"human_session"} as never)).rejects.toMatchObject({status:409,response:{code:"SKILL_REQUEST_CONFLICT"}});

        await expect(service().createSkillCandidate(project,user,{title:`Empty request ${randomUUID()}`,module:"requirements",subtype:"functional",instructions:"RULE-EMPTY-REQUEST: one outcome.",requestKey:""},{kind:"human_session"} as never)).rejects.toMatchObject({status:400});
        await expect(service().createSkillCandidate(project,user,{title:`Blank key ${randomUUID()}`,module:"requirements",subtype:"functional",skillKey:"   ",instructions:"RULE-BLANK-KEY: one outcome.",requestKey:randomUUID()},{kind:"human_session"} as never)).rejects.toMatchObject({status:400});
        await expect(service().createSkillCandidate(project,user,{title:`Empty key ${randomUUID()}`,module:"requirements",subtype:"functional",skillKey:"",instructions:"RULE-EMPTY-KEY: one outcome.",requestKey:randomUUID()},{kind:"human_session"} as never)).rejects.toMatchObject({status:400});

        const falsyKey=randomUUID(), falsyTitle=`Falsy key ${randomUUID()}`;
        const falsy=await service().createSkillCandidate(project,user,{title:falsyTitle,module:"requirements",subtype:"functional",skillKey:false as never,instructions:"RULE-FALSY: one outcome.",requestKey:falsyKey},{kind:"human_session"} as never);
        created.push(falsy.id);
        expect(falsy.skillKey).not.toBe("false");
        const falsyReplay=await service().createSkillCandidate(project,user,{title:falsyTitle,module:"requirements",subtype:"functional",instructions:"RULE-FALSY: one outcome.",requestKey:falsyKey},{kind:"human_session"} as never);
        expect(falsyReplay.id).toBe(falsy.id);
        expect(falsyReplay.skillKey).toBe(falsy.skillKey);

        const nullKey=randomUUID(), nullTitle=`Null key ${randomUUID()}`;
        const nullOps={title:nullTitle,module:"requirements",subtype:"functional",skillKey:null as unknown as string,instructions:"RULE-NULL: one outcome.",requestKey:nullKey};
        const nullCandidate=await service().createSkillCandidate(project,user,nullOps,{kind:"human_session"} as never);
        created.push(nullCandidate.id);
        expect(nullCandidate.skillKey).not.toBe("null");
        const nullReplay=await service().createSkillCandidate(project,user,{...nullOps,skillKey:undefined},{kind:"human_session"} as never);
        expect(nullReplay.id).toBe(nullCandidate.id);
        expect(nullReplay.skillKey).toBe(nullCandidate.skillKey);

        const concurrentKey=randomUUID();
        const concurrentOps={title:`Concurrent omitted ${randomUUID()}`,module:"requirements",subtype:"functional",instructions:"RULE-CONCURRENT: one outcome.",requestKey:concurrentKey};
        const [left,right]=await Promise.all([
          service().createSkillCandidate(project,user,concurrentOps,{kind:"human_session"} as never),
          service().createSkillCandidate(project,user,concurrentOps,{kind:"human_session"} as never)
        ]);
        created.push(left.id);
        expect(left.id).toBe(right.id);
        expect(left.skillKey).toBe(right.skillKey);
        expect([left.replayed,right.replayed].filter(Boolean)).toHaveLength(1);
        expect((await admin.query("SELECT COUNT(*)::int AS n FROM skill_profiles WHERE project_id=$1 AND creation_request_key=$2",[project,concurrentKey])).rows[0].n).toBe(1);

        const legacyTitle=`Legacy V161 ${randomUUID()}`, legacyKey=randomUUID();
        const legacyOps={title:legacyTitle,module:"requirements",subtype:"functional",instructions:"RULE-LEGACY: one outcome."};
        const legacy=await service().createSkillCandidate(project,user,legacyOps,{kind:"human_session"} as never);
        created.push(legacy.id);
        const generated=(await admin.query("SELECT skill_key FROM skill_profiles WHERE document_id=$1",[legacy.id])).rows[0].skill_key;
        const legacyDigest=createHash("sha256").update(JSON.stringify({title:legacyTitle,module:"requirements",subtype:"functional",skillKey:generated,instructions:legacyOps.instructions})).digest("hex");
        await admin.query("UPDATE skill_profiles SET creation_principal=$2,creation_request_key=$3,creation_request_digest=$4,creation_basis_version=1 WHERE document_id=$1",[legacy.id,`human_session:${user}`,legacyKey,legacyDigest]);
        const legacyReplay=await service().createSkillCandidate(project,user,{...legacyOps,requestKey:legacyKey},{kind:"human_session"} as never);
        expect(legacyReplay.id).toBe(legacy.id);
        expect(legacyReplay.replayed).toBe(true);
        expect(legacyReplay.skillKey).toBe(generated);
      }finally{
        await cleanupSkills(created);
      }
    });

    describe("atomic Skills assignment commands",()=>{
      const target=(operation:string,expectedAssignmentId:string|null=null,extra:Body={})=>({module:"requirements",subtype:"functional",operation,expectedAssignmentId,...extra});
      const batch=(body:Body,svc=service(),actor=user,principal:Body=human,projectId=project)=>(svc as unknown as Body).assignSkillBatch(projectId,actor,body,principal);
      const receipt=(key:string,actor=user,principal:Body=human,projectId=project)=>(service() as unknown as Body).skillAssignmentBatch(projectId,actor,key,principal);
      const command=(skill:Body,targets:Body[])=>({requestKey:randomUUID(),skillDocumentId:skill.doc.id,versionId:skill.versionId,targets});
      const snapshot=async()=>({...(await assignmentWrites()),requests:(await admin.query("SELECT * FROM skill_assignment_requests WHERE project_id=$1 ORDER BY id",[project])).rows});
      const approved=async()=>{
        const doc=await service().createSkillCandidate(project,user,{title:`Batch Skill ${randomUUID()}`,module:"requirements",subtype:"functional",instructions:"RULE-BATCH: retain exact outcomes and unchanged neighbors."},human);
        const submitted=await service().submitKnowledgeDocument(project,user,doc.id,{expectedRevision:doc.editRevision,submissionKey:randomUUID()},human);
        const reviewed=await service().approveSkillVersion(project,user,doc.id,{versionId:submitted.id},human);
        return {doc,versionId:String(reviewed.approvedVersionId)};
      };
      const active=async()=> (await admin.query("SELECT * FROM skill_assignments WHERE project_id=$1 AND status='active' ORDER BY id",[project])).rows;

      it("commits mixed additions and replacements as one exact receipt while preserving unselected neighbors",async()=>{
        const old=await skillFor("requirements","functional","requirement_revision"),next=await approved();
        const neighbor=await skillFor("test_cases","manual","testcase_create");
        try{
          const custom=await service().assignSkill(project,user,{skillDocumentId:old.doc.id,versionId:old.versionId,module:"requirements",subtype:"functional",operation:"unselected_custom",precedence:17},human);
          const neighborIds=[neighbor.assignmentId,String(custom.assignment.id)];
          const neighborsBefore=(await admin.query("SELECT * FROM skill_assignments WHERE id=ANY($1::uuid[]) ORDER BY id",[neighborIds])).rows;
          const input=command(next,[target("requirement_revision",old.assignmentId,{precedence:8}),target("requirement_case_link")]);
          const result=await batch(input);
          expect(result.replayed).toBe(false);
          expect(result.receipt).toMatchObject({schemaVersion:1,requestKey:input.requestKey,projectId:project,skillDocumentId:next.doc.id,skillVersionId:next.versionId,actorId:user,principalKind:"human_session"});
          expect(result.receipt.requestDigest).toMatch(/^[a-f0-9]{64}$/);
          expect(result.receipt.contentDigest).toMatch(/^[a-f0-9]{64}$/);
          const revision=result.receipt.targets.find((item:Body)=>item.target.operation==="requirement_revision");
          const link=result.receipt.targets.find((item:Body)=>item.target.operation==="requirement_case_link");
          expect(revision).toMatchObject({outcome:"replaced",before:{id:old.assignmentId,status:"active"},after:{skillDocumentId:next.doc.id,skillVersionId:next.versionId,status:"active",precedence:8},priorDeactivation:{assignmentId:old.assignmentId,actorId:user,at:result.receipt.committedAt}});
          expect(link).toMatchObject({outcome:"added",before:null,after:{skillVersionId:next.versionId,status:"active",precedence:0}});
          const retired=(await admin.query("SELECT * FROM skill_assignments WHERE id=$1",[old.assignmentId])).rows[0];
          expect(retired.status).toBe("inactive");expect(retired.deactivated_by).toBe(user);expect(retired.deactivated_at.toISOString()).toBe(result.receipt.committedAt);
          expect((await admin.query("SELECT * FROM skill_assignments WHERE id=ANY($1::uuid[]) ORDER BY id",[neighborIds])).rows).toEqual(neighborsBefore);
          expect((await receipt(input.requestKey)).receipt).toEqual(result.receipt);
          expect((await admin.query("SELECT COUNT(*)::int AS n FROM skill_assignment_requests WHERE project_id=$1 AND request_key=$2",[project,input.requestKey])).rows[0].n).toBe(1);
          expect((await admin.query("SELECT diff FROM audit_logs WHERE project_id=$1 AND action='skill_assignment_batch_committed' AND entity_id=$2",[project,result.receipt.id])).rows).toHaveLength(1);
          const activity=await service().listActivityForUser(user,project,{entityType:"skill_assignment_request",entityId:result.receipt.id});
          expect(activity.total).toBe(1);
          expect(JSON.parse(activity.list[0].diff)).toEqual({receiptId:result.receipt.id,skillDocumentId:next.doc.id,versionId:next.versionId,targetCount:2});
          expect(JSON.stringify(activity)).not.toContain(input.requestKey);
        }finally{await cleanupSkills([old.doc.id,next.doc.id,neighbor.doc.id]);}
      });

      it("keeps satisfied generation IDs and digests, including mixed satisfied/added selections and legacy repeated writes",async()=>{
        const skill=await skillFor("requirements","functional","requirement_revision");
        try{
          const pin=await service().effectiveSkills(project,user,{});
          const prior=(await active()).find((row:Body)=>row.id===skill.assignmentId);
          const input=command(skill,[target("requirement_revision",skill.assignmentId),target("requirement_case_link")]);
          const result=await batch(input);
          expect(result.receipt.targets.find((item:Body)=>item.target.operation==="requirement_revision")).toMatchObject({outcome:"already_satisfied",before:{id:skill.assignmentId},after:{id:skill.assignmentId}});
          expect((await active()).find((row:Body)=>row.id===skill.assignmentId)).toEqual(prior);
          expect((await service().effectiveSkills(project,user,{})).digest).toBe(pin.digest);
          const allSatisfied=command(skill,result.receipt.targets.map((item:Body)=>target(item.target.operation,item.after.id)));
          const rowsBefore=(await snapshot()).assignments;
          const unchanged=await batch(allSatisfied);
          expect(unchanged.receipt.targets.every((item:Body)=>item.outcome==="already_satisfied")).toBe(true);
          expect((await snapshot()).assignments).toEqual(rowsBefore);
          const legacyBody={skillDocumentId:skill.doc.id,versionId:skill.versionId,module:"requirements",subtype:"functional",operation:"legacy_retry"};
          const first=await service().assignSkill(project,user,legacyBody,human),second=await service().assignSkill(project,user,legacyBody,human);
          expect(first.assignment.id).not.toBe(second.assignment.id);
        }finally{await cleanupSkills([skill.doc.id]);}
      });

      it("replays normalized reordered intent once, rejects changed intent and preserves the historical receipt after retirement",async()=>{
        const skill=await approved();
        try{
          const input=command(skill,[target("requirement_revision"),target("requirement_case_link")]);
          const first=await batch(input);
          const committed=await snapshot();
          const reordered={...input,targets:[...input.targets].reverse().map((item:Body)=>({...item,module:` ${item.module} `,subtype:` ${item.subtype} `,operation:` ${item.operation} `,precedence:0}))};
          expect(await batch(reordered)).toEqual({receipt:first.receipt,replayed:true});
          expect(await snapshot()).toEqual(committed);
          await expect(batch({...input,targets:[target("requirement_revision",null,{precedence:9}),target("requirement_case_link")]})).rejects.toMatchObject({status:409,response:{code:"SKILL_ASSIGNMENT_REQUEST_CONFLICT"}});
          expect(await snapshot()).toEqual(committed);
          for(const item of first.receipt.targets)await service().deactivateSkillAssignment(project,user,item.after.id,{},human);
          await admin.query("UPDATE knowledge_documents SET is_deleted=true WHERE id=$1",[skill.doc.id]);
          const retired=await snapshot();
          expect(await batch(input)).toEqual({receipt:first.receipt,replayed:true});
          expect((await receipt(input.requestKey)).receipt).toEqual(first.receipt);
          expect(await snapshot()).toEqual(retired);
          expect((await service().effectiveSkills(project,user,{})).status).toBe("unassigned");
          await expect(admin.query("UPDATE skill_assignment_requests SET receipt=receipt||'{\"changed\":true}'::jsonb WHERE project_id=$1 AND request_key=$2",[project,input.requestKey])).rejects.toThrow(/immutable/i);
          await expect(admin.query("DELETE FROM skill_assignment_requests WHERE project_id=$1 AND request_key=$2",[project,input.requestKey])).rejects.toThrow(/immutable/i);
        }finally{await cleanupSkills([skill.doc.id]);}
      });

      it("converges concurrent identical commands and refuses a competing command's stale expected generation",async()=>{
        const skill=await approved();
        try{
          const input=command(skill,[target("requirement_revision"),target("requirement_case_link")]);
          const [left,right]=await Promise.all([batch(input),batch({...input,targets:[...input.targets].reverse()})]);
          expect(left.receipt).toEqual(right.receipt);expect([left.replayed,right.replayed].filter(Boolean)).toHaveLength(1);
          const before=await snapshot();
          await expect(batch({...input,requestKey:randomUUID()})).rejects.toMatchObject({status:409,response:{code:"SKILL_ASSIGNMENT_STALE"}});
          expect(await snapshot()).toEqual(before);
          expect((await active()).filter((row:Body)=>row.skill_document_id===skill.doc.id)).toHaveLength(2);
        }finally{await cleanupSkills([skill.doc.id]);}
      });

      it("refuses stale expected IDs for any selected target without replacing the others",async()=>{
        const old=await skillFor("requirements","functional","requirement_revision"),next=await approved();
        try{
          for(const expected of [null,randomUUID()]){
            const before=await snapshot();
            await expect(batch(command(next,[target("requirement_revision",expected),target("requirement_case_link")]))).rejects.toMatchObject({status:409,response:{code:"SKILL_ASSIGNMENT_STALE"}});
            expect(await snapshot()).toEqual(before);
          }
        }finally{await cleanupSkills([old.doc.id,next.doc.id]);}
      });

      it("refuses selected or existing wildcard overlap atomically without implicit cleanup",async()=>{
        const skill=await approved();
        try{
          const before=await snapshot();
          await expect(batch(command(skill,[target("*",null,{subtype:"*"}),target("requirement_revision")]))).rejects.toMatchObject({status:409,response:{code:"SKILL_ASSIGNMENT_CONFLICT"}});
          expect(await snapshot()).toEqual(before);
          const wildcard=await service().assignSkill(project,user,{skillDocumentId:skill.doc.id,versionId:skill.versionId,module:"requirements",subtype:"*",operation:"*",precedence:999},human);
          const assigned=await snapshot();
          await expect(batch(command(skill,[target("requirement_revision"),target("requirement_case_link")]))).rejects.toMatchObject({status:409,response:{code:"SKILL_ASSIGNMENT_CONFLICT"}});
          expect(await snapshot()).toEqual(assigned);
          expect((await active()).some((row:Body)=>row.id===wildcard.assignment.id)).toBe(true);
        }finally{await cleanupSkills([skill.doc.id]);}
      });

      it("rejects malformed, incomplete, duplicate and over-limit selections before any effects",async()=>{
        const skill=await approved();
        try{
          const good=command(skill,[target("requirement_revision")]);
          const invalid=[
            null,[],false,"assignment",
            {...good,requestKey:null},{...good,requestKey:1},{...good,skillDocumentId:null},{...good,versionId:{}},
            {...good,requestKey:"not-a-uuid"},{...good,targets:[]},{...good,targets:Array.from({length:51},(_,i)=>target(`custom_${i}`))},
            {...good,targets:null},{...good,targets:[null]},{...good,targets:[[]]},{...good,targets:[false]},
            {...good,targets:[target("requirement_revision"),target(" requirement_revision ")]},
            {...good,targets:[{module:"requirements",subtype:"functional",operation:"requirement_revision"}]},
            {...good,targets:[target("",null),target("*")]},
            {...good,targets:[target("requirement_revision",null,{precedence:"1"})]},
            ...[null,false,1.5,-1001,1001].map(precedence=>({...good,targets:[target("requirement_revision",null,{precedence})]})),
            {...good,targets:[target("requirement_revision",null,{subtype:null})]},
            {...good,targets:[target("requirement_revision",null,{subtype:" "})]},
            {...good,targets:[target("requirement_revision","not-a-uuid")]},
            {...good,targets:[target("requirement_revision",null,{subtype:"x".repeat(33)})]},
            {...good,targets:[target("x".repeat(65))]},
            {...good,targets:[target("requirement_revision",null,{module:"unknown"})]},
            {...good,targets:[target("requirement_revision",null,{module:"test_cases"})]}
          ];
          const before=await snapshot();
          for(const input of invalid){await expect(batch(input as Body)).rejects.toMatchObject({status:400});expect(await snapshot()).toEqual(before);}
          const submitted=(await admin.query("SELECT id FROM knowledge_document_versions WHERE document_id=$1 AND snapshot_kind='submitted' ORDER BY version_number DESC LIMIT 1",[skill.doc.id])).rows[0].id;
          await expect(batch({...good,versionId:submitted})).rejects.toMatchObject({status:400});
          await expect(batch({...good,skillDocumentId:randomUUID()})).rejects.toMatchObject({status:404});
          expect(await snapshot()).toEqual(before);
        }finally{await cleanupSkills([skill.doc.id]);}
      });

      it("accepts the bounded fifty-target custom scope contract and rejects a foreign document/version",async()=>{
        const skill=await approved(),other=await approved();
        try{
          const before=await snapshot();
          await expect(batch({...command(skill,[target("requirement_revision")]),versionId:other.versionId})).rejects.toMatchObject({status:400});
          expect(await snapshot()).toEqual(before);
          const result=await batch(command(skill,Array.from({length:50},(_,i)=>target(`custom_${i}`))));
          expect(result.receipt.targets).toHaveLength(50);
          expect((await active()).filter((row:Body)=>row.skill_document_id===skill.doc.id)).toHaveLength(50);
        }finally{await cleanupSkills([skill.doc.id,other.doc.id]);}
      });

      it("normalizes UUID spelling and scope defaults while preserving immutable command bindings after Skill deletion",async()=>{
        const skill=await approved();
        try{
          const input=command(skill,[target("uuid_scope",null,{precedence:-1000})]);
          const upper={...input,requestKey:` ${input.requestKey.toUpperCase()} `,skillDocumentId:skill.doc.id.toUpperCase(),versionId:skill.versionId.toUpperCase()};
          const [first,concurrent]=await Promise.all([batch(input),batch(upper,service(),user,human,project.toUpperCase())]);
          expect(concurrent.receipt).toEqual(first.receipt);
          expect([first.replayed,concurrent.replayed].filter(Boolean)).toHaveLength(1);
          expect(first.receipt.requestKey).toBe(input.requestKey);
          expect(await batch(input)).toEqual({receipt:first.receipt,replayed:true});
          expect((await receipt(input.requestKey.toUpperCase())).receipt).toEqual(first.receipt);
          await expect(receipt(randomUUID())).rejects.toMatchObject({status:404});
          await expect(receipt("invalid")).rejects.toMatchObject({status:400});
          for(const mutation of ["requested_by=gen_random_uuid()","request_key=gen_random_uuid()","request_digest=repeat('f',64)","content_digest=repeat('e',64)","committed_at=now()"]){
            await expect(admin.query(`UPDATE skill_assignment_requests SET ${mutation} WHERE id=$1`,[first.receipt.id])).rejects.toThrow(/immutable/i);
          }
          await expect(admin.query(
            `INSERT INTO skill_assignment_requests(id,project_id,request_key,request_digest,requested_by,skill_document_id,skill_version_id,content_digest,committed_at,receipt)
             SELECT gen_random_uuid(),project_id,gen_random_uuid(),request_digest,requested_by,skill_document_id,skill_version_id,content_digest,committed_at,receipt
             FROM skill_assignment_requests WHERE id=$1`,[first.receipt.id]
          )).rejects.toMatchObject({code:"23514"});
          await cleanupSkills([skill.doc.id]);
          const removed=await snapshot();
          expect(await batch(input)).toEqual({receipt:first.receipt,replayed:true});
          expect((await receipt(input.requestKey)).receipt).toEqual(first.receipt);
          expect(await snapshot()).toEqual(removed);
        }finally{await cleanupSkills([skill.doc.id]);}
      });

      it("preserves native project archival and denies recovery or replay while the project is archived",async()=>{
        const skill=await approved();
        try{
          const input=command(skill,[target("archive_scope",null,{precedence:1000})]);
          const committed=await batch(input);
          await service().deleteProjectForUser(user,project);
          expect((await admin.query("SELECT archived_at FROM projects WHERE id=$1",[project])).rows[0].archived_at).not.toBeNull();
          const archived=await snapshot();
          await expect(batch(input)).rejects.toMatchObject({status:404});
          await expect(receipt(input.requestKey)).rejects.toMatchObject({status:403});
          expect(await snapshot()).toEqual(archived);
          expect((await admin.query("SELECT receipt FROM skill_assignment_requests WHERE id=$1",[committed.receipt.id])).rows[0].receipt).toEqual(committed.receipt);
        }finally{
          await admin.query("UPDATE projects SET archived_at=NULL WHERE id=$1",[project]);
          await cleanupSkills([skill.doc.id]);
        }
      });

      it("assigns an older approved identity without changing the latest approved pointer",async()=>{
        const skill=await approved();
        try{
          await admin.query("UPDATE knowledge_documents SET content_text='RULE-NEW: a different reviewed instruction.',status='draft',reviewed_version_id=NULL WHERE id=$1",[skill.doc.id]);
          const draft=await service().getKnowledgeDocument(project,user,skill.doc.id);
          const submitted=await service().submitKnowledgeDocument(project,user,skill.doc.id,{expectedRevision:draft.editRevision,submissionKey:randomUUID()},human);
          const newer=await service().approveSkillVersion(project,user,skill.doc.id,{versionId:submitted.id},human);
          expect(newer.approvedVersionId).not.toBe(skill.versionId);expect(newer.approvedVersionId).not.toBe(submitted.id);
          const result=await batch(command(skill,[target("requirement_revision"),target("requirement_case_link")]));
          expect(result.receipt.skillVersionId).toBe(skill.versionId);
          expect(result.receipt.targets.every((item:Body)=>item.after.skillVersionId===skill.versionId)).toBe(true);
          expect((await admin.query("SELECT reviewed_version_id FROM knowledge_documents WHERE id=$1",[skill.doc.id])).rows[0].reviewed_version_id).toBe(newer.approvedVersionId);
        }finally{await cleanupSkills([skill.doc.id]);}
      });

      it("rechecks current human authority on writes and receipt retries without leaking another actor's command",async()=>{
        const skill=await approved();
        const other=(await admin.query("INSERT INTO users(email,name,active_organization_id) VALUES ($1,'Other governor',$2) RETURNING id",[`batch-${randomUUID()}@tesbo.invalid`,org])).rows[0].id;
        await admin.query("INSERT INTO organization_members(organization_id,user_id,role) VALUES ($1,$2,'owner')",[org,other]);
        await admin.query("INSERT INTO project_members(project_id,user_id,role) VALUES ($1,$2,'owner')",[project,other]);
        try{
          const input=command(skill,[target("requirement_revision")]);
          const committed=await batch(input),before=await snapshot();
          await expect(batch(input,service(),user,{kind:"api_token"})).rejects.toMatchObject({status:403,response:{code:"HUMAN_REVIEW_REQUIRED"}});
          await expect(receipt(input.requestKey,user,{kind:"api_token"})).rejects.toMatchObject({status:403});
          await expect(batch(input,service(),other)).rejects.toMatchObject({status:409,response:{code:"SKILL_ASSIGNMENT_REQUEST_CONFLICT"}});
          await expect(receipt(input.requestKey,other)).rejects.toMatchObject({status:404});
          await expect(receipt(input.requestKey,user,human,foreignProject)).rejects.toMatchObject({status:403});
          await admin.query("UPDATE project_members SET role='qa_engineer' WHERE project_id=$1 AND user_id=$2",[project,user]);
          await expect(batch(input)).rejects.toMatchObject({status:403});
          await expect(receipt(input.requestKey)).rejects.toMatchObject({status:403});
          expect(await snapshot()).toEqual(before);
          await admin.query("UPDATE project_members SET role='owner' WHERE project_id=$1 AND user_id=$2",[project,user]);
          expect((await receipt(input.requestKey)).receipt.id).toBe(committed.receipt.id);
        }finally{
          await admin.query("UPDATE project_members SET role='owner' WHERE project_id=$1 AND user_id=$2",[project,user]);
          await admin.query("DELETE FROM project_members WHERE project_id=$1 AND user_id=$2",[project,other]);
          await cleanupSkills([skill.doc.id]);
        }
      });

      it.each(["generation","authority"])("revalidates %s after waiting at the shared project mutation boundary",async change=>{
        const old=await skillFor("requirements","functional","requirement_revision"),next=await approved();
        const locker=new Client({connectionString:url});await locker.connect();let pending:Promise<Body>|undefined;
        try{
          await locker.query("BEGIN");await locker.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)",[`skill-assignments:${project}`]);
          pending=batch(command(next,[target("requirement_revision",old.assignmentId),target("requirement_case_link")])).then((value:Body)=>({value}),(error:Body)=>({error}));
          expect(await waitUntil(()=>waitingOn("%pg_advisory_xact_lock%"))).toBe(true);
          if(change==="generation"){
            await locker.query("UPDATE skill_assignments SET status='inactive',deactivated_by=$2,deactivated_at=now() WHERE id=$1",[old.assignmentId,user]);
            await locker.query("INSERT INTO skill_assignments(project_id,module,subtype,operation,skill_document_id,skill_version_id,assigned_by) SELECT project_id,module,subtype,operation,skill_document_id,skill_version_id,$2 FROM skill_assignments WHERE id=$1",[old.assignmentId,user]);
          }else await admin.query("UPDATE project_members SET role='qa_engineer' WHERE project_id=$1 AND user_id=$2",[project,user]);
          await locker.query("COMMIT");const before=await snapshot();
          expect((await pending!).error).toMatchObject(change==="generation"?{status:409,response:{code:"SKILL_ASSIGNMENT_STALE"}}:{status:403});
          expect(await snapshot()).toEqual(before);
        }finally{
          await locker.query("ROLLBACK").catch(()=>undefined);if(pending)await pending;await locker.end();
          await admin.query("UPDATE project_members SET role='owner' WHERE project_id=$1 AND user_id=$2",[project,user]);
          await cleanupSkills([old.doc.id,next.doc.id]);
        }
      },15000);

      it("serializes alternate project UUID spellings before rechecking human authority",async()=>{
        const skill=await approved();
        const locker=new Client({connectionString:url});await locker.connect();let pending:Promise<Body>|undefined;
        try{
          await locker.query("BEGIN");
          await locker.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)",[`skill-assignments:${project}`]);
          const input=command(skill,[target("uppercase_project")]);
          pending=batch(input,service(),user,human,project.toUpperCase()).then((value:Body)=>({value}),(error:Body)=>({error}));
          expect(await waitUntil(()=>waitingOn("%pg_advisory_xact_lock%"))).toBe(true);
          await admin.query("UPDATE project_members SET role='qa_engineer' WHERE project_id=$1 AND user_id=$2",[project,user]);
          await locker.query("COMMIT");
          const before=await snapshot();
          expect((await pending!).error).toMatchObject({status:403});
          expect(await snapshot()).toEqual(before);
        }finally{
          await locker.query("ROLLBACK").catch(()=>undefined);if(pending)await pending;await locker.end();
          await admin.query("UPDATE project_members SET role='owner' WHERE project_id=$1 AND user_id=$2",[project,user]);
          await cleanupSkills([skill.doc.id]);
        }
      },15000);

      it.each(["second_assignment","receipt","audit"])("rolls back every selected effect when the mandatory %s write fails",async failure=>{
        const old=await skillFor("requirements","functional","requirement_revision"),next=await approved();
        const name=`batch_refuse_${randomUUID().replaceAll("-","")}`;
        const table=failure==="second_assignment"?"skill_assignments":failure==="receipt"?"skill_assignment_requests":"audit_logs";
        const condition=failure==="second_assignment"?" AND NEW.operation='requirement_revision'":failure==="audit"?" AND NEW.action='skill_assignment_batch_committed'":"";
        try{
          const before=await snapshot();
          await admin.query(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.project_id='${project}'::uuid${condition} THEN RAISE EXCEPTION 'forced batch mandatory write failure'; END IF; RETURN NEW; END $$`);
          await admin.query(`CREATE TRIGGER ${name} BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION ${name}()`);
          await expect(batch(command(next,[target("requirement_revision",old.assignmentId),target("requirement_case_link")]))).rejects.toThrow(/forced batch mandatory write failure/);
          expect(await snapshot()).toEqual(before);
        }finally{
          await admin.query(`DROP TRIGGER IF EXISTS ${name} ON ${table}`);await admin.query(`DROP FUNCTION IF EXISTS ${name}()`);
          await cleanupSkills([old.doc.id,next.doc.id]);
        }
      });
    });
  });
});
