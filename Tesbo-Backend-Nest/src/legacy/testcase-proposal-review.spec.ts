import { BadRequestException, ForbiddenException, NotImplementedException } from "@nestjs/common";
import type { DatabaseService } from "../database/database.service";
import { makeLegacy } from "./test-helpers/legacy-service.fixture";
import { proposalDigest } from "./testcase-proposal-review";

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
        stored={id:task,project_id:project,generated_payload:JSON.parse(String(values[4])),proposal_request_digest:values[7],proposal_provenance:JSON.parse(String(values[8])),task_status:"in_review"};
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
  });
});
