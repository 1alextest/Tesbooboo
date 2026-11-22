import { randomUUID } from "node:crypto";
import { Client, Pool } from "pg";
import { ForbiddenException } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import type { PlanLimitsService } from "../plan-limits/plan-limits.service";
import { makeLegacy } from "../legacy/test-helpers/legacy-service.fixture";
import { TESTCASE_APPROVAL_CURRENT_SQL, TESTCASE_APPROVAL_REVISION_SQL, TESTCASE_EDIT_REVISION_SQL } from "../legacy/testcase-edit-revision";
import { nativeRequirementGovernance } from "./native-requirements.core";

const url = process.env.DATABASE_URL || "";
const human = { kind: "human_session" as const, transport: "rest" as const };
type Body = Record<string, any>;

// Matches the existing migrated-PostgreSQL contract lane. Never falls back to another database.
(/\/tesbo_ci(?:\?|$)/.test(url) ? describe : describe.skip)("native requirement proposals — migrated PostgreSQL", () => {
  let admin: Client, pool: Pool, project: string, foreignProject: string, user: string, token: string, agent: string, organization: string;
  const stamp = randomUUID();
  const oldNative = process.env.TESBO_NATIVE_REQUIREMENTS_PREVIEW_ENABLED, oldCases = process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED;
  const plans = { assertProjectWritable: jest.fn().mockResolvedValue(undefined) };

  beforeAll(async () => {
    process.env.TESBO_NATIVE_REQUIREMENTS_PREVIEW_ENABLED = "1";
    process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED = "1";
    admin = new Client({ connectionString: url }); await admin.connect();
    pool = new Pool({ connectionString: url, max: 6, application_name: `native-requirements-${stamp}` });
    user = (await admin.query("INSERT INTO users(email,name) VALUES ($1,'Requirement QA') RETURNING id", [`requirement-${stamp}@tesbo.invalid`])).rows[0].id;
    agent = (await admin.query("INSERT INTO agents(slug,display_name) VALUES ($1,'Requirement agent') RETURNING id", [`req-${stamp}`])).rows[0].id;
    organization = (await admin.query("INSERT INTO organizations(name,slug) VALUES ('Requirement QA',$1) RETURNING id", [`requirements-${stamp}`])).rows[0].id;
    project = (await admin.query("INSERT INTO projects(organization_id,key,name) VALUES ($1,'RQP','Requirement QA') RETURNING id", [organization])).rows[0].id;
    foreignProject = (await admin.query("INSERT INTO projects(organization_id,key,name) VALUES ($1,'RQF','Other requirement project') RETURNING id", [organization])).rows[0].id;
    await admin.query("INSERT INTO organization_members(organization_id,user_id,role) VALUES ($1,$2,'owner')", [organization, user]);
    await admin.query("INSERT INTO project_members(project_id,user_id,role) VALUES ($1,$3,'owner'),($2,$3,'owner')", [project, foreignProject, user]);
    await admin.query("UPDATE users SET active_organization_id=$2 WHERE id=$1", [user, organization]);
    token = (await admin.query("INSERT INTO api_tokens(user_id,project_id,name,token_hash,scopes) VALUES ($1,$2,'Requirement producer',$3,'read,write') RETURNING id", [user, project, randomUUID().replaceAll("-", "").repeat(2)])).rows[0].id;
  });
  afterAll(async () => {
    if (oldNative === undefined) delete process.env.TESBO_NATIVE_REQUIREMENTS_PREVIEW_ENABLED; else process.env.TESBO_NATIVE_REQUIREMENTS_PREVIEW_ENABLED = oldNative;
    if (oldCases === undefined) delete process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED; else process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED = oldCases;
    await pool?.end(); await admin?.end();
  });
  function service() {
    const svc = makeLegacy(new DatabaseService(pool), { planLimits: plans as unknown as PlanLimitsService });
    jest.spyOn(svc as unknown as Body, "enqueueTestcaseEmbedding").mockReturnValue(undefined);
    jest.spyOn(svc as unknown as Body, "notifyZyraTask").mockResolvedValue(undefined);
    jest.spyOn(svc as unknown as Body, "queueZyraTicketComments").mockResolvedValue(undefined);
    return svc;
  }
  const content = () => ({ submissionKey: randomUUID(), title: `Requirement ${randomUUID()}`, description: "An exact obligation.", criteria: [{ key: "AC-1", text: "A repeated request preserves the first result." }, { key: "AC-2", text: "A changed payload is refused." }], rationale: "Stable retries", sourceRefs: [{ label: "Normative source", url: "https://example.invalid/spec#retries" }] });
  const create = (body = content(), principal: Body = human, target = project) => service().createNativeRequirement(target, user, body, principal as never);
  const head = (detail: Body) => ({ expectedVersionId: detail.requirement.currentVersion.id, expectedContentDigest: detail.requirement.currentVersion.contentDigest });
  const basis = (detail: Body) => ({ requirementVersionId: detail.requirement.currentVersion.id, requirementContentDigest: detail.requirement.currentVersion.contentDigest, criterionKeys: ["AC-1"] });
  const revise = (detail: Body, overrides: Body = {}) => service().addNativeRequirementRevision(project, user, detail.requirement.id, { ...content(), ...head(detail), ...overrides }, human);
  const caseRow = async (id: string) => (await admin.query(`SELECT testcases.*,${TESTCASE_EDIT_REVISION_SQL} AS edit_revision,
    ${TESTCASE_APPROVAL_REVISION_SQL} AS approval_revision,${TESTCASE_APPROVAL_CURRENT_SQL} AS approval_current FROM testcases WHERE id=$1`, [id])).rows[0];
  const newCase = async (target = project) => (await admin.query("INSERT INTO testcases(project_id,external_id,title,status) VALUES ($1,$2,'Existing native case','Draft') RETURNING id", [target, `RQC-${randomUUID().slice(0, 8)}`])).rows[0].id as string;
  const associate = async (detail: Body, id: string, principal: Body = human, submissionKey = randomUUID()) => {
    const row = await caseRow(id);
    return service().linkNativeRequirementCase(project, user, detail.requirement.id, { submissionKey, ...basis(detail), testcaseId: id, testcaseRevision: row.edit_revision, testcaseApprovalRevision: row.approval_current ? row.approval_revision : null }, principal as never);
  };
  const denied = () => admin.query("SELECT * FROM audit_logs WHERE project_id=$1 AND action='requirement_proposal_rejected' ORDER BY created_at,id", [project]);
  const allProposals = () => admin.query("SELECT * FROM ai_generation_requests WHERE project_id=$1 AND proposal_governance IS NOT NULL ORDER BY id", [project]);

  it("keeps all authored candidates in one staging owner and leaves official KB facts untouched", async () => {
    const beforeDocuments = (await admin.query("SELECT * FROM knowledge_documents WHERE project_id=$1 ORDER BY id", [project])).rows;
    const beforeVersions = (await admin.query("SELECT v.* FROM knowledge_document_versions v JOIN knowledge_documents d ON d.id=v.document_id WHERE d.project_id=$1 ORDER BY v.id", [project])).rows;
    const first = await create(), svc = service();
    const task = await svc.zyraTask(project, user, first.requirement.id);
    expect(task.drafts).toHaveLength(0);
    expect(task.proposalSnapshot.stagedOperations).toHaveLength(1);
    expect(task.proposalSnapshot.requirement).toMatchObject({ taskId: first.requirement.id, identityKind: "proposal_task", nativeDocumentId: null, nativeVersionId: null });
    const version = first.requirement.currentVersion;
    expect(version).toMatchObject({ identityKind: "proposal_operation", nativeVersionId: null,
      provenance: { sourceContext: { status: "unavailable", reason: "TARGET_SOURCE_COMMIT_NOT_SUPPLIED" } } });
    const dbDigest = (await admin.query("SELECT encode(sha256(convert_to(payload::TEXT,'UTF8')),'hex') AS digest FROM proposal_operations WHERE id=$1", [version.id])).rows[0].digest;
    expect(version.contentDigest).toBe(dbDigest);
    const next = await revise(first), changedTask = await svc.zyraTask(project, user, first.requirement.id);
    expect(changedTask.proposalRevision).not.toBe(task.proposalRevision);
    expect(changedTask.proposalSnapshot.stagedOperations[0]).toEqual(task.proposalSnapshot.stagedOperations[0]);
    expect(changedTask.proposalSnapshot.stagedOperations).toHaveLength(2);
    expect((await admin.query("SELECT * FROM knowledge_documents WHERE project_id=$1 ORDER BY id", [project])).rows).toEqual(beforeDocuments);
    expect((await admin.query("SELECT v.* FROM knowledge_document_versions v JOIN knowledge_documents d ON d.id=v.document_id WHERE d.project_id=$1 ORDER BY v.id", [project])).rows).toEqual(beforeVersions);
    expect(next.requirement.id).toBe(first.requirement.id);
    expect((await admin.query("SELECT to_regclass('requirements') AS requirements,to_regclass('requirement_versions') AS versions,to_regclass('requirement_case_links') AS links")).rows[0])
      .toEqual({ requirements: null, versions: null, links: null });
  });

  it("default-off preview refuses writes and reports availability without hiding stored history", async () => {
    const before = (await allProposals()).rows;
    process.env.TESBO_NATIVE_REQUIREMENTS_PREVIEW_ENABLED = "0";
    try {
      await expect(create()).rejects.toMatchObject({ status: 501 });
      expect((await service().listNativeRequirements(project, user)).capability.enabled).toBe(false);
      expect((await allProposals()).rows).toEqual(before);
    } finally { process.env.TESBO_NATIVE_REQUIREMENTS_PREVIEW_ENABLED = "1"; }
  });

  it("persists canonical uppercase-scheme sources and rejects URL shorthand before database writes", async () => {
    const input = { ...content(), sourceRefs: [{ label: "Case-preserving path", url: "HTTPS://EXAMPLE.COM:443/Spec" }] };
    const saved = await create(input);
    expect(saved.requirement.currentVersion.sourceRefs).toEqual([{ label: "Case-preserving path", url: "https://example.com/Spec" }]);
    const stored = (await admin.query("SELECT payload->'sourceRefs' AS source_refs,valid_requirement_sources(payload->'sourceRefs') AS valid FROM proposal_operations WHERE id=$1", [saved.submission.versionId])).rows[0];
    expect(stored).toEqual({ source_refs: saved.requirement.currentVersion.sourceRefs, valid: true });
    const replay = await create({ ...input, sourceRefs: [{ label: "Case-preserving path", url: "https://example.com/Spec" }] });
    expect(replay.submission).toEqual({ versionId: saved.submission.versionId, replayed: true });
    const before = (await allProposals()).rows;
    for (const url of ["https:example.com/spec", "https://example.com\\spec", "https://example.com/" + "é".repeat(700)]) {
      await expect(create({ ...content(), sourceRefs: [{ label: "Invalid source", url }] })).rejects.toMatchObject({ status: 400 });
    }
    expect((await allProposals()).rows).toEqual(before);
  });

  it("persists stable identity and exact submission receipts across revisions and concurrent stale writers", async () => {
    const body = content(), first = await create(body);
    expect(first.requirement).toMatchObject({ key: expect.stringMatching(/^REQ-PROP-[a-f0-9]{8}$/), identityKind: "proposal_task", nativeDocumentId: null, publication: "unpublished", state: "draft" });
    expect(first.requirement.currentVersion).toMatchObject({ versionNumber: 1, parentVersionId: null, criteria: body.criteria, governance: nativeRequirementGovernance(), provenance: { kind: "human_session", actorId: user } });
    expect((await create(body)).submission).toEqual({ versionId: first.submission.versionId, replayed: true });
    await expect(create({ ...body, title: "Different request" })).rejects.toMatchObject({ response: expect.objectContaining({ code: "SUBMISSION_KEY_REUSED" }) });
    const secondInput = { ...content(), ...head(first), criteria: [{ key: "AC-1", text: "The changed obligation requires a fresh applicability decision." }] };
    const second = await service().addNativeRequirementRevision(project, user, first.requirement.id, secondInput, human);
    expect(second.requirement.id).toBe(first.requirement.id);
    expect(second.requirement.currentVersion).toMatchObject({ versionNumber: 2, parentVersionId: first.submission.versionId, criteria: secondInput.criteria });
    expect(second.versions.find(row => row.id === first.submission.versionId)).toEqual(first.versions[0]);
    const contenders = await Promise.allSettled([revise(second), revise(second)]);
    expect(contenders.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(contenders.filter(result => result.status === "rejected")).toHaveLength(1);
    const replay = await service().addNativeRequirementRevision(project, user, first.requirement.id, secondInput, human);
    expect(replay.submission).toEqual({ versionId: second.submission.versionId, replayed: true });
    expect(replay.requirement.currentVersion.versionNumber).toBe(3);
    await expect(admin.query("UPDATE proposal_operations SET payload=jsonb_set(payload,'{title}','\"History rewritten\"'::JSONB) WHERE id=$1", [first.submission.versionId])).rejects.toThrow(/immutable/);
    await expect(admin.query("DELETE FROM proposal_operations WHERE id=$1", [first.submission.versionId])).rejects.toThrow(/immutable/);
  });

  it("audits scoped refusal reasons without accepted effects, request content or foreign record metadata", async () => {
    const first = await create(), second = await revise(first), before = (await allProposals()).rows;
    const auditBefore = new Set((await denied()).rows.map(row => row.id));
    await expect(revise(first)).rejects.toMatchObject({ status: 409 });
    const foreign = await newCase(foreignProject), foreignCase = await caseRow(foreign);
    await expect(service().linkNativeRequirementCase(project, user, second.requirement.id, { submissionKey: randomUUID(), ...basis(second), testcaseId: foreign, testcaseRevision: foreignCase.edit_revision, testcaseApprovalRevision: null }, human)).rejects.toMatchObject({ status: 404 });
    await expect(service().approveNativeRequirement(project, user, second.requirement.id, second.requirement.currentVersion.id, { expectedContentDigest: second.requirement.currentVersion.contentDigest }, { kind: "api_token", tokenId: token, transport: "rest" })).rejects.toMatchObject({ response: expect.objectContaining({ code: "HUMAN_REVIEW_REQUIRED" }) });
    await expect(service().createNativeRequirement(project, user, { ...content(), provenance: { actorId: user }, sourceRefs: [{ label: "Private source", url: "https://private.invalid/sensitive-source" }] }, human)).rejects.toMatchObject({ status: 400 });
    const collision = content(); await create(collision);
    const accepted = (await allProposals()).rows;
    await expect(create({ ...collision, description: "modified private payload" })).rejects.toMatchObject({ response: expect.objectContaining({ code: "SUBMISSION_KEY_REUSED" }) });
    expect((await allProposals()).rows).toEqual(accepted);
    expect(accepted.length).toBe(before.length + 1);
    const receipts = (await denied()).rows.filter(row => !auditBefore.has(row.id));
    expect(receipts).toHaveLength(5);
    expect(receipts.map(row => row.diff.code)).toEqual(expect.arrayContaining(["REQUIREMENT_STALE_REVISION", "HUMAN_REVIEW_REQUIRED", "SUBMISSION_KEY_REUSED"]));
    expect(JSON.stringify(receipts)).not.toContain("private.invalid");
    expect(JSON.stringify(receipts)).not.toContain("modified private payload");
    expect(JSON.stringify(receipts)).not.toContain(foreign);
    const machineReceipt = receipts.find(row => row.diff.code === "HUMAN_REVIEW_REQUIRED");
    expect(machineReceipt).toMatchObject({ actor_id: null, diff: { provenance: { kind: "api_token", issuerId: user, tokenId: token, actorId: null } } });
  });

  it("refuses roles, current token scope and entitlement without creating a proposal", async () => {
    const before = (await allProposals()).rows;
    await admin.query("UPDATE project_members SET role='guest' WHERE project_id=$1 AND user_id=$2", [project, user]);
    try { await expect(create()).rejects.toMatchObject({ status: 403 }); }
    finally { await admin.query("UPDATE project_members SET role='owner' WHERE project_id=$1 AND user_id=$2", [project, user]); }
    await admin.query("UPDATE api_tokens SET scopes='read' WHERE id=$1", [token]);
    try { await expect(create(content(), { kind: "api_token", tokenId: token, transport: "rest" })).rejects.toMatchObject({ status: 403 }); }
    finally { await admin.query("UPDATE api_tokens SET scopes='read,write' WHERE id=$1", [token]); }
    plans.assertProjectWritable.mockRejectedValueOnce(new ForbiddenException({ error: "Project is read-only" }));
    await expect(create()).rejects.toMatchObject({ status: 403 });
    expect((await allProposals()).rows).toEqual(before);
  });

  it("keeps token issuer separate from actor for versions, associations and retirement", async () => {
    const rest = { kind: "api_token", tokenId: token, transport: "rest" };
    const first = await create(content(), rest);
    expect(first.requirement.currentVersion).toMatchObject({ createdBy: null, provenance: { kind: "api_token", issuerId: user, tokenId: token, actorId: null, transport: "rest" } });
    const link = await associate(first, await newCase(), rest);
    expect(link.link).toMatchObject({ createdBy: null, provenance: { issuerId: user, actorId: null, tokenId: token } });
    const retired = await service().retireNativeRequirementCaseLink(project, user, first.requirement.id, link.link.id, rest as never);
    expect(retired.link.retirementProvenance).toMatchObject({ kind: "api_token", actorId: null, issuerId: user });
    const grant = { enabled: true, revision: 1, clients: [{ tokenId: token, clientName: "Native requirement agent", scopes: ["read", "write"], allowedTools: ["create_requirement"], expiresAt: null }] };
    await admin.query("UPDATE projects SET settings=jsonb_set(COALESCE(settings,'{}'::JSONB),'{externalMcpAccess}',$2::JSONB) WHERE id=$1", [project, JSON.stringify(grant)]);
    const mcp = await create(content(), { kind: "api_token", tokenId: token, actorId: agent, transport: "mcp" });
    expect(mcp.requirement.currentVersion).toMatchObject({ createdBy: agent, provenance: { issuerId: user, actorId: agent, transport: "mcp" } });
    const events = (await admin.query("SELECT actor_id,diff FROM audit_logs WHERE entity_id=$1 AND action='requirement_proposal_created'", [mcp.requirement.id])).rows;
    expect(events).toHaveLength(1); expect(events[0]).toMatchObject({ actor_id: agent, diff: { provenance: { actorId: agent, issuerId: user } } });
  });

  it("preserves proposed associations and refuses to credit historical passing executions after revision or relinking", async () => {
    const first = await create(), testcaseId = await newCase(), svc = service();
    const draft = await caseRow(testcaseId);
    await svc.approveTestCaseForUser(user, project, testcaseId, { expectedRevision: draft.edit_revision, expectedApprovalRevision: draft.approval_revision }, human);
    const run = await svc.createCycleWithTestcasesForUser(user, project, { name: `Historical run ${randomUUID()}`, buildVersion: "older-build", testcaseIds: [testcaseId] });
    const occurrence = (await admin.query("SELECT id FROM cycle_items WHERE cycle_id=$1", [run.cycle.id])).rows[0].id;
    await admin.query("UPDATE executions SET status='Passed',executed_at=now(),executed_by=$2 WHERE cycle_item_id=$1", [occurrence, user]);
    const submissionKey = randomUUID(), firstLink = await associate(first, testcaseId, human, submissionKey), sameLink = await associate(first, testcaseId, human, submissionKey);
    expect(sameLink.link.id).toBe(firstLink.link.id);
    const second = await revise(first), relink = await associate(second, testcaseId);
    expect(relink.coverage).toMatchObject({ proposedLinkCount: 2, currentProposedLinkCount: 1, staleProposedLinkCount: 1,
      approval: { status: "blocked", eligibleCount: 0 }, execution: { status: "unavailable", eligibleCount: null }, passing: { status: "unavailable", eligibleCount: null } });
    expect((await admin.query("SELECT status FROM executions WHERE cycle_item_id=$1", [occurrence])).rows[0].status).toBe("Passed");
    await admin.query("UPDATE testcases SET title='Changed after association' WHERE id=$1", [testcaseId]);
    const stale = await svc.getNativeRequirement(project, user, first.requirement.id);
    expect(stale.links.find(link => link.id === relink.link.id)?.staleReasons).toContain("CASE_REVISION_CHANGED");
    await admin.query("UPDATE testcases SET status='Archived' WHERE id=$1", [testcaseId]);
    expect((await svc.getNativeRequirement(project, user, first.requirement.id)).coverage.staleReasons).toContain("CASE_ARCHIVED");
    // The proposed association remains a staging operation; testcase lifecycle never deletes its immutable snapshot.
    const storedLinks = (await admin.query("SELECT id FROM proposal_operations WHERE task_id=$1 AND operation_kind='requirement_case_link'", [first.requirement.id])).rows;
    expect(storedLinks).toHaveLength(2);
    expect((await svc.getNativeRequirement(project, user, first.requirement.id)).links).toHaveLength(2);
  });

  it("recovers a committed association after another author retires it without reactivating or rebasing the old request", async () => {
    const first = await create(), testcaseId = await newCase(), originalCase = await caseRow(testcaseId), svc = service();
    const request = { submissionKey: randomUUID(), ...basis(first), testcaseId, testcaseRevision: originalCase.edit_revision, testcaseApprovalRevision: null };
    const committed = await svc.linkNativeRequirementCase(project, user, first.requirement.id, request, human);
    expect(committed.submission).toEqual({ linkId: committed.link.id, replayed: false });
    const otherAuthor = (await admin.query("INSERT INTO users(email,name,active_organization_id) VALUES ($1,'Association reviewer',$2) RETURNING id", [`association-${randomUUID()}@tesbo.invalid`, organization])).rows[0].id;
    await admin.query("INSERT INTO organization_members(organization_id,user_id,role) VALUES ($1,$2,'manager')", [organization, otherAuthor]);
    await admin.query("INSERT INTO project_members(project_id,user_id,role) VALUES ($1,$2,'manager')", [project, otherAuthor]);
    await svc.retireNativeRequirementCaseLink(project, otherAuthor, first.requirement.id, committed.link.id, human);
    // A different submission key cannot multiply the same withdrawal or duplicate the read model.
    await expect(admin.query(`INSERT INTO proposal_operations(task_id,project_id,operation_sequence,operation_kind,target_operation_id,payload,content_digest,submission_key,request_digest,provenance,created_by)
      SELECT w.task_id,w.project_id,r.proposal_operation_sequence+1,w.operation_kind,w.target_operation_id,w.payload,w.content_digest,$2,w.request_digest,w.provenance,w.created_by
      FROM proposal_operations w JOIN ai_generation_requests r ON r.id=w.task_id WHERE w.target_operation_id=$1 AND w.operation_kind='withdraw_link'`,
      [committed.link.id, `duplicate-withdrawal:${randomUUID()}`])).rejects.toMatchObject({ constraint: "proposal_link_withdrawal_once" });
    expect((await svc.getNativeRequirement(project, user, first.requirement.id)).links).toHaveLength(1);
    const changedRequirement = await revise(first);
    await admin.query("UPDATE testcases SET title='Changed while the original response was lost' WHERE id=$1", [testcaseId]);
    const replay = await svc.linkNativeRequirementCase(project, user, first.requirement.id, request, human);
    expect(replay.submission).toEqual({ linkId: committed.link.id, replayed: true });
    expect(replay.link).toMatchObject({ id: committed.link.id, current: false, retiredBy: otherAuthor, retiredAt: expect.any(Date) });
    expect(replay.coverage).toMatchObject({ proposedLinkCount: 0, currentProposedLinkCount: 0 });
    expect((await admin.query("SELECT id FROM proposal_operations WHERE task_id=$1 AND operation_kind='requirement_case_link'", [first.requirement.id])).rows).toEqual([{ id: committed.link.id }]);
    await expect(svc.linkNativeRequirementCase(project, user, first.requirement.id, { ...request, criterionKeys: ["AC-2"] }, human)).rejects.toMatchObject({ response: expect.objectContaining({ code: "SUBMISSION_KEY_REUSED" }) });
    await expect(svc.linkNativeRequirementCase(project, otherAuthor, first.requirement.id, request, human)).rejects.toMatchObject({ response: expect.objectContaining({ code: "SUBMISSION_KEY_REUSED" }) });
    await admin.query("UPDATE project_members SET role='guest' WHERE project_id=$1 AND user_id=$2", [project, user]);
    try { await expect(svc.linkNativeRequirementCase(project, user, first.requirement.id, request, human)).rejects.toMatchObject({ status: 403 }); }
    finally { await admin.query("UPDATE project_members SET role='owner' WHERE project_id=$1 AND user_id=$2", [project, user]); }
    const deliberatelyRelinked = await associate(changedRequirement, testcaseId);
    expect(deliberatelyRelinked.submission.replayed).toBe(false);
    expect(deliberatelyRelinked.link.id).not.toBe(committed.link.id);
    const duplicateKey = randomUUID();
    await expect(associate(changedRequirement, testcaseId, human, duplicateKey)).rejects.toMatchObject({ response: expect.objectContaining({ code: "REQUIREMENT_LINK_EXISTS" }) });
    expect((await admin.query("SELECT id FROM proposal_operations WHERE task_id=$1 AND submission_key='link:'||$2", [first.requirement.id, duplicateKey])).rows).toHaveLength(0);
    await expect(admin.query("UPDATE proposal_operations SET submission_key=$2 WHERE id=$1", [committed.link.id, randomUUID()])).rejects.toThrow(/immutable/);
  });

  it("enforces cross-identity foreign keys, JSON shape and immutable governance at the database boundary", async () => {
    const first = await create(), other = await create(content(), human, foreignProject), id = await newCase();
    const link = await associate(first, id);
    const sibling = await create();
    const targetCase = await caseRow(id);
    await expect(service().linkNativeRequirementCase(project, user, first.requirement.id, { submissionKey: randomUUID(), ...basis(sibling), testcaseId: id,
      testcaseRevision: targetCase.edit_revision, testcaseApprovalRevision: null }, human)).rejects.toMatchObject({ response: expect.objectContaining({ code: "REQUIREMENT_LINEAGE_MISMATCH" }) });
    await expect(admin.query("UPDATE proposal_operations SET task_id=$2 WHERE id=$1", [link.link.id, other.requirement.id])).rejects.toThrow(/immutable/);
    const constraint = (await admin.query("SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conname='proposal_current_requirement_scope'")).rows[0].definition;
    expect(constraint).toContain("FOREIGN KEY (proposal_current_requirement_operation_id, id, project_id)");
    for (const malformed of [{}, { policy: "unpublished_proposals_only" }, { ...nativeRequirementGovernance(), requirement: { id: first.requirement.id, versionId: first.requirement.currentVersion.id } }]) {
      await expect(admin.query(`INSERT INTO ai_generation_requests(project_id,requested_by,provider,user_story,requested_count,generated_count,generated_payload,
        proposal_governance) VALUES ($1,$2,'external_proposal','Malformed governance',0,0,'[]'::JSONB,$3::JSONB)`,
      [project, user, JSON.stringify(malformed)])).rejects.toMatchObject({ constraint: "proposal_task_governance" });
    }
    const operationBefore = (await admin.query("SELECT * FROM proposal_operations WHERE task_id=$1 ORDER BY operation_sequence", [first.requirement.id])).rows;
    const current = operationBefore[0];
    await expect(admin.query(`INSERT INTO proposal_operations(task_id,project_id,operation_sequence,operation_kind,requirement_operation_id,payload,content_digest,submission_key,request_digest,provenance)
      SELECT $1,$2,(SELECT proposal_operation_sequence+1 FROM ai_generation_requests WHERE id=$1),'requirement_case_link',$3,$4::JSONB,$5,$6,$5,$7::JSONB`,
      [first.requirement.id, project, other.requirement.currentVersion.id, JSON.stringify({ ...basis(other), testcaseId: id }), "0".repeat(64), randomUUID(), JSON.stringify(current.provenance)]))
      .rejects.toThrow(/lineage mismatch/);
    expect((await admin.query("SELECT * FROM proposal_operations WHERE task_id=$1 ORDER BY operation_sequence", [first.requirement.id])).rows).toEqual(operationBefore);
    await expect(admin.query("UPDATE ai_generation_requests SET generated_payload='[]'::JSONB,proposal_current_requirement_operation_id=$2 WHERE id=$1", [first.requirement.id, other.requirement.currentVersion.id]))
      .rejects.toThrow(/projections must follow/);
    expect((await admin.query("SELECT valid_requirement_criteria($1::JSONB) AS valid", [JSON.stringify([{ key: "AC-1", text: "One" }, { key: "AC-1", text: "Two" }])])).rows[0].valid).toBe(false);
    expect((await admin.query("SELECT valid_requirement_criteria($1::JSONB) AS valid", [JSON.stringify([{ key: "AC-1" }])])).rows[0].valid).toBe(false);
    expect((await admin.query("SELECT valid_requirement_sources($1::JSONB) AS valid", [JSON.stringify([{ label: "Spec", url: "javascript:alert(1)" }])])).rows[0].valid).toBe(false);
    expect((await admin.query("SELECT valid_requirement_sources('[]'::JSONB) AS valid")).rows[0].valid).toBe(true);
  });

  it("stages native cases in the existing task, preserves exact context through edits and blocks every apply/reset route", async () => {
    const first = await create(), testcaseId = await newCase(), row = await caseRow(testcaseId), svc = service();
    const request = { ...basis(first), requestKey: randomUUID(), title: "Requirement-bound case changes", operations: [
      { opType: "create", draft: { title: "Unpublished new case" } },
      { opType: "update", testcaseId, expectedRevision: row.edit_revision, fields: { description: "Unpublished correction" } }
    ] };
    const before = (await admin.query("SELECT * FROM testcases WHERE project_id=$1 ORDER BY id", [project])).rows;
    const staged = await svc.stageNativeRequirementTestcaseChanges(project, user, first.requirement.id, request, human);
    const replay = await svc.stageNativeRequirementTestcaseChanges(project, user, first.requirement.id, request, human);
    expect(replay.taskId).toBe(staged.taskId);
    expect(staged.taskId).toBe(first.requirement.id);
    expect(staged.task.proposalSnapshot.stagedOperations.map((op: Body) => op.operationKind)).toEqual(["requirement_revision", "testcase_revision"]);
    expect(staged.task).toMatchObject({ proposalGovernance: { requirement: { id: first.requirement.id, versionId: first.requirement.currentVersion.id, criterionKeys: ["AC-1"] }, skillContext: { status: "unavailable" } }, publicationBlocked: { code: "SKILL_CONTEXT_UNAVAILABLE" } });
    expect(staged.task.proposalSnapshot.governance).toEqual(staged.task.proposalGovernance);
    const auditBefore = (await admin.query("SELECT id FROM audit_logs WHERE project_id=$1 AND action='testcase_proposals_applied'", [project])).rows;
    for (const apply of [svc.zyraSave.bind(svc), svc.aiSave.bind(svc)]) {
      await expect(apply(project, user, staged.taskId, { expectedProposalRevision: staged.task.proposalRevision, selectedDraftIndexes: [0], suiteName: `No governed suite ${stamp}` }, human)).rejects.toMatchObject({ response: expect.objectContaining({ code: "SKILL_CONTEXT_UNAVAILABLE" }) });
    }
    expect((await admin.query("SELECT id FROM suites WHERE project_id=$1 AND name=$2", [project, `No governed suite ${stamp}`])).rows).toHaveLength(0);
    expect((await admin.query("SELECT * FROM testcases WHERE project_id=$1 ORDER BY id", [project])).rows).toEqual(before);
    expect((await admin.query("SELECT id FROM audit_logs WHERE project_id=$1 AND action='testcase_proposals_applied'", [project])).rows).toEqual(auditBefore);
    await expect(svc.zyraFeedback(project, user, staged.taskId, { feedback: "Regenerate without context" }, human)).rejects.toMatchObject({ status: 403 });
    const edited = await svc.zyraEditDraft(project, user, staged.taskId, 0, { title: "Still unpublished" }, human, staged.task.proposalRevision);
    expect(edited.proposalGovernance).toEqual(staged.task.proposalGovernance);
    expect(edited.proposalRevision).not.toBe(staged.task.proposalRevision);
    const discarded = await svc.zyraDeleteDraft(project, user, staged.taskId, 1, human, edited.proposalRevision);
    expect(discarded.proposalGovernance).toEqual(staged.task.proposalGovernance);
    for (const assignment of ["proposal_governance=NULL,proposal_current_requirement_operation_id=NULL", "proposal_governance='{}'::JSONB"]) {
      await expect(admin.query(`UPDATE ai_generation_requests SET ${assignment} WHERE id=$1`, [staged.taskId])).rejects.toThrow(/immutable/);
    }
    const closed = await svc.zyraCloseTask(project, user, staged.taskId, human);
    expect(closed.proposalGovernance).toEqual(staged.task.proposalGovernance);
    expect((await admin.query("SELECT save_events FROM ai_generation_requests WHERE id=$1", [staged.taskId])).rows[0].save_events).toEqual([]);
  });

  it("refuses stale index edits and removals after another reviewer removes an earlier candidate", async () => {
    const first = await create(), svc = service();
    const staged = await svc.stageNativeRequirementTestcaseChanges(project, user, first.requirement.id, { ...basis(first), requestKey: randomUUID(),
      operations: ["A", "B", "C"].map(title => ({ opType: "create", draft: { title } })) }, human);
    const removed = await svc.zyraDeleteDraft(project, user, first.requirement.id, 0, human, staged.task.proposalRevision);
    const before = (await admin.query("SELECT * FROM proposal_operations WHERE task_id=$1 ORDER BY operation_sequence", [first.requirement.id])).rows;
    await expect(svc.zyraEditDraft(project, user, first.requirement.id, 1, { title: "Wrong target" }, human, staged.task.proposalRevision))
      .rejects.toMatchObject({ response: expect.objectContaining({ code: "PROPOSAL_REVIEW_CONFLICT" }), status: 409 });
    await expect(svc.zyraDeleteDraft(project, user, first.requirement.id, 1, human, staged.task.proposalRevision))
      .rejects.toMatchObject({ response: expect.objectContaining({ code: "PROPOSAL_REVIEW_CONFLICT" }), status: 409 });
    await expect(svc.zyraDeleteDraft(project, user, first.requirement.id, 1, human))
      .rejects.toMatchObject({ response: expect.objectContaining({ code: "PROPOSAL_REVIEW_REQUIRED" }), status: 400 });
    expect((await admin.query("SELECT * FROM proposal_operations WHERE task_id=$1 ORDER BY operation_sequence", [first.requirement.id])).rows).toEqual(before);
    expect((await svc.zyraTask(project, user, first.requirement.id)).drafts.map((draft: Body) => draft.title)).toEqual(["B", "C"]);
    const fresh = await svc.zyraEditDraft(project, user, first.requirement.id, 1, { title: "C reviewed explicitly" }, human, removed.proposalRevision);
    expect(fresh.drafts.map((draft: Body) => draft.title)).toEqual(["B", "C reviewed explicitly"]);
  });

  it("serializes independent case submissions in the same task and recovers their original immutable receipts", async () => {
    const first = await create(), svc = service();
    const a = { ...basis(first), requestKey: randomUUID(), operations: [{ opType: "create", draft: { title: "First independent proposal" } }] };
    const b = { ...basis(first), requestKey: randomUUID(), operations: [{ opType: "create", draft: { title: "Second independent proposal" } }] };
    const [one, two] = await Promise.all([
      svc.stageNativeRequirementTestcaseChanges(project, user, first.requirement.id, a, human),
      svc.stageNativeRequirementTestcaseChanges(project, user, first.requirement.id, b, human)
    ]);
    expect(one.taskId).toBe(first.requirement.id); expect(two.taskId).toBe(first.requirement.id);
    const current = await svc.zyraTask(project, user, first.requirement.id);
    expect(current.drafts).toHaveLength(2);
    expect(current.proposalSnapshot.stagedOperations.map((op: Body) => op.operationKind)).toEqual(["requirement_revision", "testcase_revision", "testcase_revision"]);
    const aOperation = one.task.proposalSubmission.operationId;
    await revise(first);
    const replay = await svc.stageNativeRequirementTestcaseChanges(project, user, first.requirement.id, a, human);
    expect(replay.task.proposalSubmission).toEqual({ operationId: aOperation, replayed: true });
    expect(replay.task.drafts).toHaveLength(2);
    await expect(svc.stageNativeRequirementTestcaseChanges(project, user, first.requirement.id,
      { ...a, operations: [{ opType: "create", draft: { title: "Changed replay" } }] }, human)).rejects.toMatchObject({ response: expect.objectContaining({ code: "PROPOSAL_REQUEST_CONFLICT" }) });
    await expect(admin.query("UPDATE ai_generation_requests SET generated_payload='[]'::JSONB WHERE id=$1", [first.requirement.id])).rejects.toThrow(/projections must follow/);
    await expect(admin.query("UPDATE ai_generation_requests SET task_status='done' WHERE id=$1", [first.requirement.id])).rejects.toThrow(/projections must follow/);
    expect((await svc.zyraTask(project, user, first.requirement.id)).drafts).toHaveLength(2);
  });

  it("rolls back accepted state when its mandatory audit fails and surfaces a failed denial receipt", async () => {
    const before = (await allProposals()).rows, svc = service();
    jest.spyOn(svc, "logProjectActivity").mockRejectedValue(new Error("Audit fixture failure"));
    await expect(svc.createNativeRequirement(project, user, content(), human)).rejects.toThrow("Audit fixture failure");
    expect((await allProposals()).rows).toEqual(before);
    await expect(svc.createNativeRequirement(project, user, { ...content(), principal: "forged" }, human)).rejects.toMatchObject({ response: expect.objectContaining({ code: "REQUIREMENT_DENIAL_AUDIT_UNAVAILABLE" }), status: 503 });
    expect((await allProposals()).rows).toEqual(before);
  });

  it("retires proposals without deleting history and allows only the existing project cascade to remove them", async () => {
    const first = await create(), retired = await service().retireNativeRequirement(project, user, first.requirement.id, head(first), human);
    expect(retired.requirement).toMatchObject({ state: "retired", retirementProvenance: { kind: "human_session", actorId: user } });
    expect(retired.versions).toEqual(first.versions);
    await expect(revise(retired)).rejects.toMatchObject({ response: expect.objectContaining({ code: "REQUIREMENT_RETIRED" }) });
    const disposable = (await admin.query("INSERT INTO projects(organization_id,key,name) VALUES ($1,'RQD','Disposable proposal cascade') RETURNING id", [organization])).rows[0].id;
    await admin.query("INSERT INTO project_members(project_id,user_id,role) VALUES ($1,$2,'owner')", [disposable, user]);
    const proposal = await create(content(), human, disposable);
    await expect(admin.query("DELETE FROM ai_generation_requests WHERE id=$1", [proposal.requirement.id])).rejects.toThrow(/withdraw instead/);
    await admin.query("DELETE FROM projects WHERE id=$1", [disposable]);
    expect((await admin.query("SELECT id FROM ai_generation_requests WHERE project_id=$1 AND proposal_governance IS NOT NULL", [disposable])).rows).toHaveLength(0);
    expect((await admin.query("SELECT id FROM proposal_operations WHERE project_id=$1", [disposable])).rows).toHaveLength(0);
  });
});
