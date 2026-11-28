import { BadRequestException, ForbiddenException, NotImplementedException } from "@nestjs/common";
import type { DatabaseService } from "../database/database.service";
import { makeLegacy } from "./test-helpers/legacy-service.fixture";
import { nativeProposalProducerIdentity, proposalDigest } from "./testcase-proposal-review";

describe("ordinary draft actions preserve the reviewed selection", () => {
  afterEach(() => jest.restoreAllMocks());

  function draftFixture() {
    let version = 0;
    const row: Record<string, any> = {
      id: task, project_id: project, provider: "fixture", task_kind: "legacy_generation_review", task_status: "in_review",
      generated_payload: ["A", "B", "C"].map(title => ({ opType: "create", draft: { title, stepsJson: "[]" } })),
      activity_log: [], save_events: [], saved_count: 0,
    };
    let afterCommit: (() => void) | undefined;
    const read = () => ({ ...structuredClone(row), proposal_snapshot: {
      taskId: task, projectId: project, version, taskStatus: row.task_status,
      operations: structuredClone(row.generated_payload), targets: [],
      dependencies: { revision: 0, customFields: [], customTags: [], suites: [] },
    } });
    const query = jest.fn(async (sql: string, values: unknown[] = []) => {
      if (sql.startsWith("SELECT r.*")) return { rows: [read()] };
      if (sql.includes("FROM ai_generation_requests")) return { rows: [structuredClone(row)] };
      if (sql.includes("UPDATE ai_generation_requests") && sql.includes("generated_payload = $3")) {
        row.generated_payload = JSON.parse(String(values[2]));
        if (sql.includes("activity_log = activity_log")) {
          const activity = values[sql.includes("saved_count+$4") ? 4 : 3];
          row.activity_log.push(...JSON.parse(String(activity)));
        }
        if (sql.includes("task_status = 'in_review'")) row.task_status = "in_review";
        version += 1;
        return { rows: [structuredClone(row)] };
      }
      return { rows: [] };
    });
    const transaction = jest.fn(async (work: (client: { query: typeof query }) => Promise<unknown>) => {
      const result = await work({ query });
      const next = afterCommit;
      afterCommit = undefined;
      next?.();
      return result;
    });
    const svc = makeLegacy({ query, transaction } as unknown as DatabaseService);
    jest.spyOn(svc, "requireProjectAccess").mockResolvedValue({ id: project, caller_role: "owner" } as never);
    const internals = svc as unknown as Record<string, any>;
    const mutate = (kind: "edit" | "delete", index: number, revision: unknown, fields = { title: "Changed" }) =>
      kind === "edit"
        ? internals.zyraEditDraft(project, user, task, index, { ...fields, expectedProposalRevision: revision }, human)
        : internals.zyraDeleteDraft(project, user, task, index, { expectedProposalRevision: revision }, human);
    return { svc, internals, row, query, transaction, mutate,
      review: () => svc.zyraTask(project, user, task),
      afterCommit: (callback: () => void) => { afterCommit = callback; },
      change: () => { version += 1; },
    };
  }

  it.each(["edit", "delete"] as const)("refuses a stale %s after an earlier draft was removed", async kind => {
    const f = draftFixture();
    const reviewed = await f.review();
    const removed = await f.mutate("delete", 0, reviewed.proposalRevision);
    expect(removed.drafts.map((draft: any) => draft.title)).toEqual(["B", "C"]);
    const before = structuredClone(f.row);
    await expect(f.mutate(kind, 1, reviewed.proposalRevision)).rejects.toMatchObject({ status: 409, response: { code: "PROPOSAL_REVIEW_CONFLICT" } });
    expect(f.row).toEqual(before);
    const fresh = await f.review();
    const result = await f.mutate(kind, 0, fresh.proposalRevision);
    expect(result.drafts.map((draft: any) => draft.title)).toEqual(kind === "edit" ? ["Changed", "C"] : ["C"]);
  });

  it.each(["edit", "delete"] as const)("requires a well-formed reviewed revision for %s", async kind => {
    for (const revision of [undefined, null, "", "bad", 1]) {
      const f = draftFixture();
      const before = structuredClone(f.row);
      await expect(f.mutate(kind, 0, revision)).rejects.toMatchObject({ status: 400, response: { code: "PROPOSAL_REVIEW_REQUIRED" } });
      expect(f.row).toEqual(before);
      expect(f.transaction).not.toHaveBeenCalled();
    }
  });

  it.each(["edit", "delete"] as const)("keeps a closed batch and its late-generation fence intact after %s", async kind => {
    const f = draftFixture();
    f.row.task_status = "done";
    f.row.activity_log = [{ title: "Closed task" }];
    const reviewed = await f.review();
    const before = structuredClone(f.row);
    await expect(f.mutate(kind, 0, reviewed.proposalRevision)).rejects.toMatchObject({ status: 409 });
    expect(f.row).toEqual(before);
    expect(await f.internals.appendZyraReviewProposals(project, "session", task, [{ opType: "create", draft: { title: "Late" } }]))
      .toEqual({ closed: true, base: 0 });
    expect(f.row).toEqual(before);
  });

  it("returns its own committed snapshot rather than adopting another actor's subsequent mutation", async () => {
    const f = draftFixture();
    const reviewed = await f.review();
    f.afterCommit(() => {
      f.row.generated_payload.unshift({ opType: "create", draft: { title: "Another actor" } });
      f.change();
    });
    const result = await f.mutate("delete", 0, reviewed.proposalRevision);
    expect(result.drafts.map((draft: any) => draft.title)).toEqual(["B", "C"]);
    const current = await f.review();
    expect(current.drafts.map((draft: any) => draft.title)).toEqual(["Another actor", "B", "C"]);
    expect(result.proposalRevision).not.toBe(current.proposalRevision);
    await expect(f.mutate("delete", 0, result.proposalRevision)).rejects.toMatchObject({ status: 409 });
    expect((await f.review()).drafts.map((draft: any) => draft.title)).toEqual(["Another actor", "B", "C"]);
  });
});

const project = "00000000-0000-4000-8000-000000000001";
const user = "00000000-0000-4000-8000-000000000002";
const token = "00000000-0000-4000-8000-000000000003";
const task = "00000000-0000-4000-8000-000000000004";
const human = {kind:"human_session" as const};

describe("native testcase proposal review boundary", () => {
  const previousPreview = process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED;
  afterEach(() => {
    if (previousPreview === undefined) delete process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED;
    else process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED = previousPreview;
    jest.restoreAllMocks();
  });
  function fixture() {
    const query = jest.fn().mockResolvedValue({rows:[]});
    const transaction = jest.fn();
    const svc = makeLegacy({query,transaction} as unknown as DatabaseService);
    const access = jest.spyOn(svc,"requireProjectAccess").mockResolvedValue({id:project,caller_role:"owner"} as never);
    return {svc,query,transaction,access};
  }

  it("keeps the unaccepted external producer preview off without any persistence or provider call", async () => {
    delete process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED;
    const f=fixture();
    await expect(f.svc.stageTestcaseChanges(project,user,{requestKey:"off",operations:[{opType:"create",draft:{title:"Must stay unpublished"}}]},human)).rejects.toBeInstanceOf(NotImplementedException);
    expect(f.access).not.toHaveBeenCalled(); expect(f.query).not.toHaveBeenCalled(); expect(f.transaction).not.toHaveBeenCalled();
  });

  it.each(["testcase", "requirement"])("refuses forged OAuth principal for %s staging before any native transaction", async inlet => {
    process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED="1";
    const f=fixture();
    const args={requestKey:"forged-oauth",operations:[]};
    const forged={kind:"oauth_access",grantId:"forged",tokenId:token} as never;
    const attempt=inlet==="testcase"
      ? f.svc.stageTestcaseChanges(project,user,args,forged)
      : f.svc.stageRequirementChangeBundle(project,user,args,forged);
    await expect(attempt).rejects.toBeInstanceOf(ForbiddenException);
    expect(f.transaction).not.toHaveBeenCalled();
  });

  it.each([undefined,{kind:"api_token" as const}])("requires an explicit human principal before Save reads or writes: %j", async principal => {
    const f=fixture();
    await expect(f.svc.zyraSave(project,user,task,{expectedProposalRevision:"a".repeat(64),selectedDraftIndexes:[0]},principal)).rejects.toBeInstanceOf(ForbiddenException);
    expect(f.access).not.toHaveBeenCalled(); expect(f.transaction).not.toHaveBeenCalled();
  });

  it.each([undefined,null,[0,0],["0"],[-1],[0.5]])("rejects an implicit or ambiguous selection without opening a transaction: %j", async selection => {
    const f=fixture();
    await expect(f.svc.zyraSave(project,user,task,{expectedProposalRevision:"a".repeat(64),selectedDraftIndexes:selection},human)).rejects.toBeInstanceOf(BadRequestException);
    expect(f.transaction).not.toHaveBeenCalled();
  });

  it.each([undefined,"",123,"a".repeat(63)])("refuses a missing/malformed reviewed revision: %j", async revision => {
    const f=fixture();
    await expect(f.svc.zyraSave(project,user,task,{expectedProposalRevision:revision,selectedDraftIndexes:[0]},human)).rejects.toBeInstanceOf(BadRequestException);
    expect(f.transaction).not.toHaveBeenCalled();
  });

  it.each(["missing_current_membership","guest_project_role","unknown_workspace_role","token_write_revoked","mcp_grant_expired","mcp_tool_removed"])("rechecks current locked producer authority before any proposal write: %s",async reason=>{
    process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED="1";
    const f=fixture();
    const mcp=reason.startsWith("mcp_");
    const settings={externalMcpAccess:{enabled:true,revision:1,clients:[{
      tokenId:token,clientName:"Named proposal client",scopes:["read","write"],
      expiresAt:reason==="mcp_grant_expired" ? "2000-01-01T00:00:00Z" : null,
      allowedTools:reason==="mcp_tool_removed" ? ["list_testcases"] : null,
    }]}};
    const clientQuery=jest.fn(async(sql:string)=>{
      if(sql.startsWith("SELECT p.*"))return {rows:reason==="missing_current_membership" ? [] : [{id:project,settings,
        caller_role:reason==="guest_project_role" ? "guest" : "owner",workspace_role:reason==="unknown_workspace_role" ? "unexpected-role" : "owner"}]};
      if(sql.startsWith("SELECT scopes FROM api_tokens"))return {rows:[{scopes:reason==="token_write_revoked" ? "read" : "read,write"}]};
      return {rows:[]};
    });
    f.transaction.mockImplementation((work:(client:unknown)=>Promise<unknown>)=>work({query:clientQuery}));
    await expect(f.svc.stageTestcaseChanges(project,user,{requestKey:reason,operations:[{opType:"create",draft:{title:"Denied producer"}}]},
      {kind:"api_token",tokenId:token,transport:mcp ? "mcp" : "rest"})).rejects.toBeInstanceOf(ForbiddenException);
    expect(clientQuery.mock.calls.some(([sql])=>/INSERT INTO (testcases|suites|ai_generation_requests|audit_logs)/.test(sql))).toBe(false);
    const authorityQuery=clientQuery.mock.calls.find(([sql])=>sql.startsWith("SELECT p.*"))?.[0];
    expect(authorityQuery).toContain("u.active_organization_id=p.organization_id");
    expect(authorityQuery).toContain("FOR SHARE OF p,pm,om,u");
  });

  it("stages without a model key, preserves machine provenance, and deduplicates the normalized request", async () => {
    process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED="1";
    const f=fixture();
    let stored: Record<string,any> | undefined;
    const clientQuery=jest.fn(async (sql:string,values:unknown[]=[]) => {
      if (sql.startsWith("SELECT p.*")) return {rows:[{id:project,settings:{},caller_role:"owner",workspace_role:"owner"}]};
      if (sql.startsWith("SELECT scopes FROM api_tokens")) return {rows:[{scopes:"read,write"}]};
      if (sql.startsWith("SELECT id,proposal_request_digest")) return {rows:stored ? [stored] : []};
      if (sql.includes("INSERT INTO ai_generation_requests")) {
        stored={id:task,project_id:project,task_kind:"governed_proposal",provider:"external_proposal",generated_payload:JSON.parse(String(values[4])),proposal_request_digest:values[7],proposal_provenance:JSON.parse(String(values[8])),task_status:"in_review"};
        return {rows:[{id:task}]};
      }
      return {rows:[]};
    });
    f.transaction.mockImplementation((work:(client:unknown)=>Promise<unknown>)=>work({query:clientQuery}));
    f.query.mockImplementation(async (sql:string) => {
      if (!sql.startsWith("SELECT r.*")) throw new Error(`Unexpected query ${sql}`);
      return {rows:[{...stored,proposal_snapshot:{taskId:task,projectId:project,version:0,taskStatus:"in_review",operations:stored!.generated_payload,targets:[],dependencies:{revision:0,customFields:[],customTags:[],suites:[]}}}]};
    });
    const request={requestKey:"external-request-1",operations:[{opType:"create",draft:{title:"External draft",postconditions:"Saved state",steps:[{action:"Act",expectedResult:"Observe"}]}}]};
    const principal={kind:"api_token" as const,tokenId:token,transport:"rest" as const};
    const first=await f.svc.stageTestcaseChanges(project,user,request,principal);
    const repeated=await f.svc.stageTestcaseChanges(project,user,request,principal);
    expect(repeated.id).toBe(first.id);
    expect(first.proposalProvenance).toMatchObject({kind:"api_token",actorId:null,issuerId:user,tokenId:token});
    expect(first.proposalRevision).toBe(proposalDigest(first.proposalSnapshot));
    expect(first.proposalSnapshot.operations[0].draft).toMatchObject({postconditions:"Saved state",status:"Draft"});
    expect(clientQuery.mock.calls.filter(([sql])=>sql.includes("INSERT INTO ai_generation_requests"))).toHaveLength(1);
    expect(clientQuery.mock.calls.filter(([sql])=>sql.includes("INSERT INTO audit_logs"))[0][1]?.[1]).toBeNull();
    expect(clientQuery.mock.calls.some(([sql])=>/INSERT INTO (testcases|suites)|workspace_ai_keys/.test(sql))).toBe(false);
    await expect(f.svc.stageTestcaseChanges(project,user,{...request,operations:[{opType:"create",draft:{title:"Different"}}]},principal)).rejects.toMatchObject({status:409});
    expect(clientQuery.mock.calls.filter(([sql])=>sql.includes("INSERT INTO ai_generation_requests"))).toHaveLength(1);
    const prior=stored!;
    const readsBefore=f.query.mock.calls.length;
    for(const [kind,lane] of [["external_qa_work","external_qa_work"],["governed_proposal","external_document_proposal"],["legacy_generation_review","openai"]]){
      stored={...prior,task_kind:kind,provider:lane};
      await expect(f.svc.stageTestcaseChanges(project,user,request,principal)).rejects.toMatchObject({status:409,response:{code:"PROPOSAL_REQUEST_CONFLICT"}});
    }
    expect(f.query.mock.calls.length).toBe(readsBefore);
    expect(clientQuery.mock.calls.filter(([sql])=>sql.includes("INSERT INTO ai_generation_requests"))).toHaveLength(1);
  });
});

describe("requirement bundle lifecycle boundary", () => {
  const previousPreview = process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED;
  const operation = "00000000-0000-4000-8000-000000000005";
  const operations = [{ opType: "requirement_revision", operationId: operation, title: "Reviewed requirement",
    criteria: [{ key: "AC-1", text: "The observed obligation" }] }];
  afterEach(() => {
    if (previousPreview === undefined) delete process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED;
    else process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED = previousPreview;
    jest.restoreAllMocks();
  });

  function fixture() {
    const row: Record<string,any> = { id: task, project_id: project, requested_by: user,
      provider: "external_requirement_proposal", task_kind: "governed_proposal", task_status: "in_review", generated_payload: operations,
      activity_log: [], save_events: [], proposal_provenance: { issuerId: user } };
    const query = jest.fn(async (sql: string, _values: unknown[] = []) => {
      if (sql.includes("FROM ai_generation_requests")) return { rows: [row], rowCount: 1 };
      if (sql.includes("SELECT role FROM project_members")) return { rows: [{role:"owner"}], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const transaction = jest.fn((work: (client: unknown) => Promise<unknown>) => work({query}));
    const svc = makeLegacy({query, transaction} as unknown as DatabaseService);
    jest.spyOn(svc,"requireProjectAccess").mockResolvedValue({id:project,caller_role:"owner"} as never);
    return { svc, internals: svc as unknown as Record<string,any>, row, query, transaction };
  }

  it.each(["feedback", "close", "append", "suite"])("refuses the generic %s writer before mutation or a provider call", async writer => {
    const f = fixture();
    const before = JSON.stringify(f.row);
    const provider = jest.spyOn(f.internals,"generateZyraWithProvider").mockResolvedValue({drafts:[]});
    const attempt = writer === "feedback" ? f.svc.zyraFeedback(project,user,task,{feedback:"Regenerate"},human)
      : writer === "close" ? f.svc.zyraCloseTask(project,user,task,human)
        : writer === "append" ? f.internals.appendZyraReviewProposals(project,"session",task,[{opType:"create",draft:{title:"Replace"}}])
          : f.internals.patchZyraPendingBatchSuite(project,task,null);
    await expect(attempt).rejects.toMatchObject({status:409,response:{code:"REQUIREMENT_BUNDLE_IMMUTABLE"}});
    expect(JSON.stringify(f.row)).toBe(before);
    expect(provider).not.toHaveBeenCalled();
    expect(f.query.mock.calls.some(([sql])=>/UPDATE |INSERT |workspace_ai_keys/.test(sql))).toBe(false);
  });

  it("retains the ordinary task close action", async () => {
    const f=fixture(); f.row.provider="openai"; f.row.task_kind="legacy_generation_review"; f.row.generated_payload=[{title:"Ordinary draft"}];
    f.query.mockImplementation(async sql => {
      if(sql.startsWith("UPDATE ai_generation_requests")) f.row.task_status="done";
      return {rows:[f.row],rowCount:1};
    });
    jest.spyOn(f.internals,"notifyZyraTask").mockResolvedValue(undefined);
    await expect(f.svc.zyraCloseTask(project,user,task,human)).resolves.toMatchObject({taskStatus:"done"});
    expect(f.query.mock.calls.filter(([sql])=>sql.startsWith("UPDATE ai_generation_requests"))).toHaveLength(1);
  });

  it.each(["generation", "feedback"])("does not resume a queued %s provider job for a bundle", async kind => {
    const f=fixture();
    const provider=jest.spyOn(f.internals,"generateZyraWithProvider").mockResolvedValue({drafts:[]});
    if(kind==="generation")await f.internals.processZyraTask(project,task,{userId:user});
    else await f.internals.processZyraFeedback(project,task,{});
    expect(provider).not.toHaveBeenCalled();
    expect(f.query.mock.calls.some(([sql])=>/UPDATE |INSERT |workspace_ai_keys/.test(sql))).toBe(false);
  });

  // Synthetic future-kind rows exercise the application boundary while the
  // database producer remains closed.
  it.each([
    ["external_qa_work", "external_qa_work"],
    ["governed_proposal", "external_document_proposal"],
    ["unknown", "openai"],
    [undefined, "openai"]
  ])("refuses provider workers for kind %s / provider %s", async (kind, lane) => {
    const f=fixture(); f.row.task_kind=kind; f.row.provider=lane;
    f.row.generated_payload=[]; f.row.task_status="todo";
    const before=JSON.stringify(f.row);
    const provider=jest.spyOn(f.internals,"generateZyraWithProvider").mockResolvedValue({drafts:[]});
    const notify=jest.spyOn(f.internals,"notifyZyraTask").mockResolvedValue(undefined);
    await f.internals.processZyraTask(project,task,{userId:user});
    await f.internals.processZyraFeedback(project,task,{});
    await f.internals.markZyraTaskFailed(project,task,"Obsolete generation worker");
    await f.internals.markZyraTaskFailed(project,task,"Obsolete feedback worker",true);
    expect(JSON.stringify(f.row)).toBe(before);
    expect(f.query.mock.calls.some(([sql])=>/UPDATE |INSERT |workspace_ai_keys/.test(sql))).toBe(false);
    expect(provider).not.toHaveBeenCalled(); expect(notify).not.toHaveBeenCalled();
  });

  it("rejects generic feedback for a future external task before provider allocation", async () => {
    const f=fixture(); f.row.task_kind="external_qa_work"; f.row.provider="external_qa_work"; f.row.generated_payload=[];
    const before=JSON.stringify(f.row);
    await expect(f.svc.zyraFeedback(project,user,task,{feedback:"Retry"},human)).rejects.toMatchObject({status:409,response:{code:"TASK_KIND_NOT_ADMITTED"}});
    expect(JSON.stringify(f.row)).toBe(before);
    expect(f.query.mock.calls.some(([sql])=>/UPDATE |INSERT |workspace_ai_keys/.test(sql))).toBe(false);
  });

  it("keeps governed testcase feedback distinct from initial legacy generation", async () => {
    const f=fixture(); f.row.task_kind="governed_proposal"; f.row.provider="external_proposal"; f.row.generated_payload=[];
    expect(f.internals.isLegacyProviderTask(f.row)).toBe(false);
    expect(f.internals.isLegacyProviderTask(f.row,true)).toBe(true);
    const provider=jest.spyOn(f.internals,"generateZyraWithProvider").mockResolvedValue({drafts:[]});
    await f.internals.processZyraTask(project,task,{userId:user});
    expect(provider).not.toHaveBeenCalled();
    expect(f.query.mock.calls.some(([sql])=>/UPDATE |INSERT |workspace_ai_keys/.test(sql))).toBe(false);
  });

  function failureFixture(status: string, failFirstRead=false) {
    const f=fixture();f.row.task_status=status;
    let initialLookup=failFirstRead;
    f.query.mockImplementation(async(sql,values=[])=>{
      if(sql.includes("FROM ai_generation_requests")){
        if(initialLookup){initialLookup=false;throw new Error("Transient task lookup failure");}
        return {rows:[f.row],rowCount:1};
      }
      if(sql.startsWith("UPDATE ai_generation_requests")){
        if(sql.includes("SET task_status = 'failed'")){
          if(!["todo","in_progress"].includes(f.row.task_status))return {rows:[],rowCount:0};
          f.row.task_status="failed";
        }
        f.row.activity_log.push(...JSON.parse(String(values[2])));
        return {rows:[f.row],rowCount:1};
      }
      return {rows:[],rowCount:0};
    });
    const notify=jest.spyOn(f.internals,"notifyZyraTask").mockResolvedValue(undefined);
    const provider=jest.spyOn(f.internals,"generateZyraWithProvider").mockResolvedValue({drafts:[]});
    jest.spyOn(f.internals.logger,"error").mockImplementation(()=>undefined);
    return {...f,notify,provider};
  }

  it.each(["generation", "feedback"].flatMap(kind=>["todo", "in_review", "done"].map(status=>({kind,status}))))(
    "keeps a $status bundle unchanged after the queued $kind worker's first lookup fails", async({kind,status})=>{
      const f=failureFixture(status,true),before=JSON.stringify(f.row);
      if(kind==="generation")await f.internals.processZyraTask(project,task,{userId:user});
      else await f.internals.processZyraFeedback(project,task,{});
      expect(JSON.stringify(f.row)).toBe(before);
      expect(f.query.mock.calls.some(([sql])=>/UPDATE |INSERT |workspace_ai_keys/.test(sql))).toBe(false);
      expect(f.provider).not.toHaveBeenCalled();expect(f.notify).not.toHaveBeenCalled();
    }
  );

  it("does not let an initial generation failure mutate a governed testcase proposal, while preserving admitted feedback failure handling", async()=>{
    const f=failureFixture("todo"); f.row.provider="external_proposal"; f.row.generated_payload=[];
    const before=JSON.stringify(f.row);
    await f.internals.markZyraTaskFailed(project,task,"Obsolete generation worker");
    expect(JSON.stringify(f.row)).toBe(before);
    expect(f.query.mock.calls.some(([sql])=>/UPDATE |INSERT /.test(sql))).toBe(false);
    expect(f.notify).not.toHaveBeenCalled();
    await f.internals.markZyraTaskFailed(project,task,"Admitted feedback failed",true);
    expect(f.row.task_status).toBe("failed");
    expect(f.row.activity_log).toHaveLength(1);
    expect(f.notify).toHaveBeenCalledTimes(1);
  });

  it("the shared failure writer preserves an external bundle even after its typed payload was damaged",async()=>{
    const f=failureFixture("in_progress");f.row.generated_payload=[];
    const before=JSON.stringify(f.row);
    await f.internals.markZyraTaskFailed(project,task,"Obsolete worker failure");
    expect(JSON.stringify(f.row)).toBe(before);
    expect(f.query.mock.calls.some(([sql])=>/UPDATE |INSERT /.test(sql))).toBe(false);
    expect(f.notify).not.toHaveBeenCalled();
  });

  it.each(["todo", "in_progress", "done"])("preserves ordinary %s failure handling and notification semantics",async status=>{
    const f=failureFixture(status);f.row.provider="openai";f.row.task_kind="legacy_generation_review";f.row.generated_payload=[{title:"Ordinary draft"}];
    await f.internals.markZyraTaskFailed(project,task,"Provider refused this ordinary task");
    expect(f.row.task_status).toBe(status==="done"?"done":"failed");
    expect(f.row.activity_log).toHaveLength(1);
    expect(f.row.activity_log[0].title).toBe(status==="done"?"Generation failed after task was already updated":"Generation failed");
    expect(f.notify).toHaveBeenCalledTimes(status==="done"?0:1);
  });

  it("retains ordinary task feedback and never regenerates a damaged external bundle", async () => {
    const f=fixture();
    f.row.generated_payload=[];
    await expect(f.svc.zyraFeedback(project,user,task,{feedback:"Retry"},human)).rejects.toMatchObject({status:409});
    f.row.provider="openai";f.row.task_kind="legacy_generation_review";f.row.generated_payload=[{title:"Existing testcase draft"}];
    f.query.mockImplementation(async sql=>{
      if(sql.includes("FROM project_ai_key_allocations"))return {rows:[{provider:"openai",default_model:"gpt-4o",api_key:"synthetic-unused"}],rowCount:1};
      if(sql.startsWith("UPDATE ai_generation_requests"))f.row.task_status="todo";
      return {rows:[f.row],rowCount:1};
    });
    jest.spyOn(f.internals,"zyraAgentSettings").mockResolvedValue({testcaseRange:"1-10"});
    const regeneration=jest.spyOn(f.internals,"processZyraFeedback").mockResolvedValue(undefined);
    await expect(f.svc.zyraFeedback(project,user,task,{feedback:"More boundary cases"},human)).resolves.toMatchObject({task:{taskStatus:"todo"}});
    expect(regeneration).toHaveBeenCalledTimes(1);
  });

  function decisionFixture() {
    const f=fixture();
    f.row.proposal_revision=0;
    const authority:Record<string,any>={id:project,caller_role:"owner",workspace_role:"owner",settings:{}};
    f.query.mockImplementation(async(sql,values=[])=>{
      if(sql.startsWith("SELECT p.*"))return {rows:authority.revoked?[]:[authority],rowCount:authority.revoked?0:1};
      if(sql.startsWith("SELECT r.*"))return {rows:[{...f.row,proposal_snapshot:{taskId:task,projectId:project,
        version:f.row.proposal_revision,taskStatus:f.row.task_status,operations:JSON.parse(JSON.stringify(f.row.generated_payload)),targets:[],dependencies:{}}}],rowCount:1};
      if(sql.includes("SELECT * FROM ai_generation_requests"))return {rows:[f.row],rowCount:1};
      if(sql.startsWith("UPDATE ai_generation_requests")){
        f.row.task_status="done";f.row.activity_log.push(...JSON.parse(String(values[2])));f.row.proposal_revision++;
        return {rows:[f.row],rowCount:1};
      }
      return {rows:[],rowCount:0};
    });
    return {...f,authority};
  }

  it("records an exact decision, replays it truthfully and refuses an opposite or altered decision", async()=>{
    const f=decisionFixture(),review=await f.svc.zyraTask(project,user,task);
    const body={expectedProposalRevision:review.proposalRevision,reason:"Needs revision"};
    const closed=await f.svc.rejectRequirementProposal(project,user,task,body,human);
    expect(closed).toMatchObject({taskStatus:"done",replayed:false,requirementDecision:{decision:"rejected",proposalRevision:review.proposalRevision,reason:"Needs revision"}});
    expect(closed.proposalRevision).not.toBe(review.proposalRevision);
    expect(closed.requirementDecision.reviewedSnapshot).toEqual(review.proposalSnapshot);
    expect(await f.svc.rejectRequirementProposal(project,user,task,body,human)).toMatchObject({replayed:true,requirementDecision:closed.requirementDecision});
    await expect(f.svc.withdrawRequirementProposal(project,user,task,body,human)).rejects.toMatchObject({status:409});
    await expect(f.svc.rejectRequirementProposal(project,user,task,{...body,reason:"Different decision text"},human)).rejects.toMatchObject({status:409});
    expect(f.row.activity_log).toHaveLength(1);
    expect(f.query.mock.calls.filter(([sql])=>sql.startsWith("UPDATE ai_generation_requests"))).toHaveLength(1);
  });

  it("refuses stale payloads and current role loss before appending a decision", async()=>{
    const f=decisionFixture(),review=await f.svc.zyraTask(project,user,task);
    const body={expectedProposalRevision:review.proposalRevision};
    f.row.generated_payload=operations.map(entry=>({...entry,title:"Changed after review"}));
    f.row.proposal_revision++;
    await expect(f.svc.rejectRequirementProposal(project,user,task,body,human)).rejects.toMatchObject({status:409});
    const current=await f.svc.zyraTask(project,user,task);
    f.authority.caller_role="qa_engineer";
    await expect(f.svc.rejectRequirementProposal(project,user,task,{expectedProposalRevision:current.proposalRevision},human)).rejects.toMatchObject({status:403});
    f.authority.revoked=true;
    await expect(f.svc.withdrawRequirementProposal(project,user,task,{expectedProposalRevision:current.proposalRevision},human)).rejects.toMatchObject({status:403});
    expect(f.query.mock.calls.some(([sql])=>/UPDATE |INSERT /.test(sql))).toBe(false);
    expect(f.row.activity_log).toEqual([]);
  });

  it.each(["reject", "withdraw"])("requires the exact reviewed revision before a %s decision", async decision => {
    const f=fixture();
    const attempt=decision==="reject" ? f.svc.rejectRequirementProposal(project,user,task,{},human)
      : f.svc.withdrawRequirementProposal(project,user,task,{},human);
    await expect(attempt).rejects.toMatchObject({status:400,response:{code:"PROPOSAL_REVIEW_REQUIRED"}});
    expect(f.transaction).not.toHaveBeenCalled();
  });

  it.each(["disabled", "expired", "tool_removed", "write_removed"])("rechecks current MCP bundle consent: %s", async reason => {
    process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED="1";
    const f=fixture();
    f.query.mockImplementation(async sql => {
      if(sql.startsWith("SELECT p.*"))return {rows:[{id:project,caller_role:"owner",workspace_role:"owner",settings:{externalMcpAccess:{
        enabled:reason!=="disabled",revision:1,clients:[{tokenId:token,clientName:"Bundle producer",
          scopes:reason==="write_removed"?["read"]:["read","write"],
          expiresAt:reason==="expired"?"2000-01-01T00:00:00Z":null,
          allowedTools:reason==="tool_removed"?["list_testcases"]:null}]
      }}}],rowCount:1};
      if(sql.startsWith("SELECT scopes FROM api_tokens"))return {rows:[{scopes:"read,write"}],rowCount:1};
      if(sql.includes("INSERT INTO ai_generation_requests"))return {rows:[{id:task}],rowCount:1};
      return {rows:[],rowCount:0};
    });
    jest.spyOn(f.svc,"zyraTask").mockResolvedValue({id:task} as never);
    await expect(f.svc.stageRequirementChangeBundle(project,user,{requestKey:"revoked",operations},
      {kind:"api_token",tokenId:token,transport:"mcp"})).rejects.toBeInstanceOf(ForbiddenException);
    expect(f.query.mock.calls.some(([sql])=>/INSERT |UPDATE /.test(sql))).toBe(false);
  });

  it("recovers the committed staging receipt before revalidating mutable document references", async () => {
    process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED="1";
    const f=fixture();
    const principal={kind:"api_token" as const,tokenId:token,transport:"rest" as const};
    const withBase=[{...operations[0],documentId:"00000000-0000-4000-8000-000000000006",expectedRevision:"a".repeat(64)}];
    // Use the product normalizer to represent a prior successful request; this does not approve its contents.
    const normalized=f.internals.normalizeRequirementBundle(withBase).operations;
    f.query.mockImplementation(async sql => {
      if(sql.startsWith("SELECT p.*"))return {rows:[{id:project,caller_role:"owner",workspace_role:"owner",settings:{}}],rowCount:1};
      if(sql.startsWith("SELECT scopes FROM api_tokens"))return {rows:[{scopes:"read,write"}],rowCount:1};
      if(sql.startsWith("SELECT id,proposal_request_digest"))return {rows:[{id:task,task_kind:"governed_proposal",provider:"external_requirement_proposal",proposal_request_digest:proposalDigest({title:"Prior staged request",operations:normalized})}],rowCount:1};
      return {rows:[],rowCount:0};
    });
    const validate=jest.spyOn(f.internals,"assertRequirementDocumentBase").mockRejectedValue(new Error("The live document has changed"));
    jest.spyOn(f.svc,"zyraTask").mockResolvedValue({id:task} as never);
    await expect(f.svc.stageRequirementChangeBundle(project,user,{requestKey:"lost-response",title:"Prior staged request",operations:withBase},principal)).resolves.toMatchObject({id:task});
    expect(validate).not.toHaveBeenCalled();
    expect(f.query.mock.calls.some(([sql])=>/INSERT |UPDATE /.test(sql))).toBe(false);
  });
});

describe("native proposal producer identity — stable review/replay lineage", () => {
  it("preserves the exact API-token provenance and principalKey for case and requirement staging", () => {
    const source = { kind: "api_token" as const, tokenId: token, actorId: "mcp-actor", transport: "mcp" as const };
    const result = nativeProposalProducerIdentity(source, user);
    expect(result).toEqual({
      principalKey: `api_token:${token}`,
      producerActorId: "mcp-actor",
      provenance: { kind: "api_token", principalKey: `api_token:${token}`,
        issuerId: user, tokenId: token, actorId: "mcp-actor" },
      activityActor: "agent"
    });
    expect(source).toEqual({ kind: "api_token", tokenId: token, actorId: "mcp-actor", transport: "mcp" });
  });

  it("preserves a null API-token actor without inventing a human approver", () => {
    const result = nativeProposalProducerIdentity({ kind: "api_token", tokenId: token }, user);
    expect(result.provenance).toEqual({ kind: "api_token", principalKey: `api_token:${token}`,
      issuerId: user, tokenId: token, actorId: null });
    expect(result.producerActorId).toBeNull();
    expect(result.activityActor).toBe("agent");
  });

  it("continues to attribute human-session proposals to the actual user", () => {
    const result = nativeProposalProducerIdentity({ kind: "human_session" }, user);
    expect(result).toEqual({ principalKey: `human_session:${user}`, producerActorId: user,
      provenance: { kind: "human_session", principalKey: `human_session:${user}`,
        issuerId: user, tokenId: null, actorId: user },
      activityActor: "user" });
  });

  it("refuses a new OAuth kind rather than silently fabricating API-token provenance", () => {
    expect(() => nativeProposalProducerIdentity(
      { kind: "oauth_access", grantId: "forged" } as never, user
    )).toThrow(ForbiddenException);
  });

  it.each([undefined, "", "not-a-token-uuid"])("fails closed on missing or malformed API-token identity: %p", tokenId => {
    expect(() => nativeProposalProducerIdentity({ kind: "api_token", tokenId }, user)).toThrow(ForbiddenException);
  });

  it("keeps identity stable across equivalent retries, distinct across producer kinds", () => {
    const first = nativeProposalProducerIdentity({ kind: "api_token", tokenId: token, transport: "rest" }, user);
    const retry = nativeProposalProducerIdentity({ kind: "api_token", tokenId: token, transport: "mcp" }, user);
    const humanSource = nativeProposalProducerIdentity({ kind: "human_session" }, user);
    expect(first.principalKey).toBe(retry.principalKey);
    expect(first.provenance).toEqual(retry.provenance);
    expect(humanSource.principalKey).not.toBe(first.principalKey);
  });
});



describe("native task kind read boundary", () => {
  const previousPreview = process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED;
  afterEach(() => {
    if (previousPreview === undefined) delete process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED;
    else process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED = previousPreview;
    jest.restoreAllMocks();
  });
  function fixture() {
    const query = jest.fn(async (_sql: string, _values: unknown[] = []) => ({rows:[]}));
    const svc=makeLegacy({query,transaction:jest.fn()} as unknown as DatabaseService);
    jest.spyOn(svc,"requireProjectAccess").mockResolvedValue({id:project,caller_role:"owner"} as never);
    return {svc,query};
  }
  it.each(["history","testcase","requirement","detail"])("scopes %s to existing review kinds at the query boundary", async (surface) => {
    const f=fixture();
    if(surface==="history") await expect(f.svc.aiHistory(project,user,{limit:2,offset:1})).resolves.toEqual({list:[]});
    else if(surface==="testcase") await expect(f.svc.listTestcaseProposals(project,user,{limit:2,offset:1})).resolves.toEqual({list:[]});
    else if(surface==="requirement") await expect(f.svc.listRequirementProposals(project,user,{limit:2,offset:1})).resolves.toEqual({list:[]});
    else await expect(f.svc.zyraTask(project,user,task)).rejects.toMatchObject({status:404});
    const [sql,params]=f.query.mock.calls.find(([sql])=>sql.includes("FROM ai_generation_requests"))!;
    expect(sql).toContain("task_kind IN ('legacy_generation_review','governed_proposal')");
    if(surface==="detail"){
      expect(sql).toContain("r.id=$1 AND r.project_id=$2 AND r.task_kind");
      expect(params).toEqual([task,project]);
    } else {
      expect(sql.indexOf("task_kind IN")).toBeLessThan(sql.indexOf("LIMIT"));
      expect(params?.slice(0,3)).toEqual([project,2,1]);
    }
    if(surface==="history") expect(sql).toContain("provider IS DISTINCT FROM 'external_document_proposal'");
    if(surface==="testcase") expect(sql).toContain("provider IS DISTINCT FROM 'external_document_proposal'");
    if(surface==="requirement") expect(sql).toContain("generated_payload @>");
  });
  it("uses the governed document subtype for both the page and empty-page count",async()=>{
    process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED="1";
    const f=fixture();
    await expect(f.svc.listManagedDocumentProposals(project,user,{limit:2,offset:1})).resolves.toMatchObject({list:[],total:0});
    const queries=f.query.mock.calls.filter(([sql])=>sql.includes("FROM ai_generation_requests"));
    expect(queries).toHaveLength(2);
    for(const [sql,params] of queries){
      expect(sql).toContain("task_kind='governed_proposal'");
      expect(sql).toContain("provider='external_document_proposal'");
      expect(params?.[0]).toBe(project);
    }
  });
});


describe("native task kind mutation boundary", () => {
  afterEach(() => jest.restoreAllMocks());
  function fixture() {
    // Future external rows cannot be inserted with the current producer fence.
    // Model the SQL-filtered result, and assert the actual ownership predicate.
    const query=jest.fn(async (_sql:string,_values:unknown[]=[])=>({rows:[],rowCount:0}));
    const transaction=jest.fn((work:(client:unknown)=>Promise<unknown>)=>work({query}));
    const svc=makeLegacy({query,transaction} as unknown as DatabaseService);
    jest.spyOn(svc,"requireProjectAccess").mockResolvedValue({id:project,caller_role:"owner"} as never);
    return {svc,query,internals:svc as unknown as Record<string,any>};
  }
  it.each(["delete","edit","close","append","suite"])("refuses a filtered task before %s changes any row",async(surface)=>{
    const f=fixture();
    const attempt=surface==="delete"?f.svc.zyraDeleteDraft(project,user,task,0,{expectedProposalRevision:"a".repeat(64)},human)
      :surface==="edit"?f.svc.zyraEditDraft(project,user,task,0,{title:"Changed",expectedProposalRevision:"a".repeat(64)},human)
      :surface==="close"?f.svc.zyraCloseTask(project,user,task,human)
      :surface==="append"?f.internals.appendZyraReviewProposals(project,"session",task,[{opType:"create"}])
      :f.internals.patchZyraPendingBatchSuite(project,task,null);
    if(surface==="append")await expect(attempt).resolves.toEqual({closed:true,base:0});
    else if(surface==="suite")await expect(attempt).resolves.toBeNull();
    else await expect(attempt).rejects.toMatchObject({status:404});
    const [sql,params]=f.query.mock.calls.find(([sql])=>sql.includes("FROM ai_generation_requests"))!;
    expect(sql).toContain("task_kind IN ('legacy_generation_review','governed_proposal')");
    expect(params).toEqual([task,project]);
    expect(f.query.mock.calls.some(([sql])=>/^UPDATE |^INSERT /.test(sql))).toBe(false);
  });
  it("scopes late activity and requester notification to testcase review lanes",async()=>{
    const f=fixture();
    const notify=jest.spyOn(f.internals,"notifyUsers").mockResolvedValue(undefined);
    await f.internals.appendZyraTaskActivity(project,task,"Late result","No mutation of other task kinds");
    await f.internals.notifyZyraTask(project,task,"ready");
    const queries=f.query.mock.calls.filter(([sql])=>sql.includes("ai_generation_requests"));
    expect(queries).toHaveLength(2);
    for(const [sql,params] of queries){
      expect(sql).toContain("task_kind = 'legacy_generation_review'");
      expect(sql).toContain("task_kind = 'governed_proposal' AND provider = 'external_proposal'");
      expect(params?.slice(0,2)).toEqual([task,project]);
    }
    expect(notify).not.toHaveBeenCalled();
  });
});


describe("governed proposal replay ownership", () => {
  it.each(["external_proposal","external_requirement_proposal","external_document_proposal"])("requires the exact governed producer %s in addition to digest",provider=>{
    const query=jest.fn(),transaction=jest.fn();
    const svc=makeLegacy({query,transaction} as unknown as DatabaseService);
    const guard=(svc as unknown as Record<string,any>).assertNativeProposalRequestReplay.bind(svc);
    const digest="a".repeat(64), row={task_kind:"governed_proposal",provider,proposal_request_digest:digest};
    expect(()=>guard(row,digest,provider)).not.toThrow();
    expect(()=>guard({...row,task_kind:"external_qa_work"},digest,provider)).toThrow();
    expect(()=>guard({...row,task_kind:undefined},digest,provider)).toThrow();
    expect(()=>guard({...row,provider:"unrelated_provider"},digest,provider)).toThrow();
    expect(()=>guard({...row,proposal_request_digest:"b".repeat(64)},digest,provider)).toThrow();
    expect(query).not.toHaveBeenCalled(); expect(transaction).not.toHaveBeenCalled();
  });
});
