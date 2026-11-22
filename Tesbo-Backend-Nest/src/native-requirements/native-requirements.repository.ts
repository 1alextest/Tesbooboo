import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { PoolClient } from "pg";
import { DatabaseService } from "../database/database.service";
import type { LegacyService } from "../legacy/legacy.service";
import { proposalDigest, type TestcaseProposalPrincipal } from "../legacy/testcase-proposal-review";
import { TESTCASE_APPROVAL_CURRENT_SQL, TESTCASE_APPROVAL_REVISION_SQL, TESTCASE_EDIT_REVISION_SQL } from "../legacy/testcase-edit-revision";
import { requireHumanReviewPrincipal } from "../common/human-review-principal";
import {
  appendNativeProposalOperation, assertRequirementHead, closedObject, expectedRequirementHead, lockNativeRequirementBasis,
  nativeProposalProvenance, nativeRequirementBasis, nativeRequirementGovernance, nativeRequirementPublicationBlock,
  nativeRequirementsCapability, normalizeRequirementContent, REQUIREMENT_CONTENT_FIELDS, requirementDigest,
  requirementObjectId, requirementUuid, requireNativeRequirementsPreview
} from "./native-requirements.core";

type Body = Record<string, any>;
const BASIS_FIELDS = ["requirementVersionId", "requirementContentDigest", "criterionKeys"];

/** All IDs here name staging tasks/operations. Official KB identity and content are untouched. */
export class NativeRequirementsRepository {
  constructor(private readonly db: DatabaseService, private readonly legacy: LegacyService) {}

  private async access(projectId: string, userId: string | null | undefined): Promise<string> {
    if (!userId) throw new ForbiddenException({ error: "Project membership required" });
    await this.legacy.requireProjectAccess(userId, projectId);
    return userId;
  }
  private async writer(client: PoolClient, projectId: string, uid: string, principal: TestcaseProposalPrincipal, tool: string) {
    await this.legacy.lockTestcaseSuiteWrites(client, projectId);
    return this.legacy.requireNativeRequirementAuthoringAuthority(client, projectId, uid, principal, tool);
  }
  private version(row: Body) {
    return { ...row.payload, id: row.id, operationId: row.id, identityKind: "proposal_operation", nativeVersionId: null,
      requirementId: row.task_id, taskId: row.task_id, versionNumber: Number(row.version_number), parentVersionId: row.parent_operation_id,
      contentDigest: row.content_digest, governance: nativeRequirementGovernance(), provenance: row.provenance,
      createdBy: row.created_by, createdAt: row.created_at };
  }
  private requirement(row: Body) {
    return { id: row.id, taskId: row.id, identityKind: "proposal_task", nativeDocumentId: null,
      key: `REQ-PROP-${String(row.id).slice(0, 8)}`, projectId: row.project_id, state: row.state, publication: "unpublished",
      currentVersion: this.version(row.current_version), createdAt: row.created_at, updatedAt: row.updated_at,
      retirementProvenance: row.retirement_provenance ?? null };
  }
  private async row(client: PoolClient, projectId: string, id: string, lock = false) {
    const result = await client.query(`SELECT r.*,r.proposal_current_requirement_operation_id AS current_version_id,
      CASE WHEN r.task_status='done' THEN 'retired' ELSE 'draft' END AS state,v.content_digest,
      to_jsonb(v)||jsonb_build_object('version_number',(SELECT count(*) FROM proposal_operations h
        WHERE h.task_id=r.id AND h.operation_kind='requirement_revision' AND h.operation_sequence<=v.operation_sequence)) AS current_version,
      (SELECT w.provenance FROM proposal_operations w WHERE w.task_id=r.id AND w.operation_kind='withdraw_requirement') AS retirement_provenance
      FROM ai_generation_requests r JOIN proposal_operations v ON v.id=r.proposal_current_requirement_operation_id
        AND v.task_id=r.id AND v.project_id=r.project_id AND v.operation_kind='requirement_revision'
      WHERE r.id=$1 AND r.project_id=$2 AND r.proposal_governance IS NOT NULL${lock ? " FOR UPDATE OF r" : ""}`, [id, projectId]);
    if (!result.rows[0]) throw new NotFoundException({ error: "Requirement proposal task not found" });
    return result.rows[0] as Body;
  }
  private async linkRows(client: PoolClient, projectId: string, id: string) {
    return (await client.query(`SELECT l.*,w.created_at AS retired_at,w.created_by AS retired_by,w.provenance AS retirement_provenance,
      CASE WHEN testcases.id IS NULL THEN NULL ELSE jsonb_build_object('id',testcases.id,'externalId',testcases.external_id,
      'title',testcases.title,'status',testcases.status,'editRevision',${TESTCASE_EDIT_REVISION_SQL},
      'approvalRevision',${TESTCASE_APPROVAL_REVISION_SQL},'approvalCurrent',${TESTCASE_APPROVAL_CURRENT_SQL},'deletedAt',testcases.deleted_at) END AS current_case
      FROM proposal_operations l LEFT JOIN testcases ON testcases.id=(l.payload->>'testcaseId')::UUID AND testcases.project_id=l.project_id
      LEFT JOIN proposal_operations w ON w.target_operation_id=l.id AND w.task_id=l.task_id AND w.operation_kind='withdraw_link'
      WHERE l.project_id=$1 AND l.task_id=$2 AND l.operation_kind='requirement_case_link' ORDER BY l.operation_sequence`, [projectId, id])).rows;
  }
  private link(row: Body, requirement: Body) {
    const p = row.payload, currentCase = row.current_case as Body | null, staleReasons: string[] = [];
    if (row.retired_at) staleReasons.push("LINK_RETIRED");
    if (requirement.state === "retired") staleReasons.push("REQUIREMENT_RETIRED");
    if (p.requirementVersionId !== requirement.current_version_id) staleReasons.push("REQUIREMENT_VERSION_SUPERSEDED");
    if (!currentCase) staleReasons.push("CASE_UNAVAILABLE");
    else {
      if (currentCase.status === "Archived" || currentCase.deletedAt) staleReasons.push("CASE_ARCHIVED");
      if (p.testcaseRevision !== currentCase.editRevision) staleReasons.push("CASE_REVISION_CHANGED");
      if (p.caseSnapshot.approvalRevision !== currentCase.approvalRevision || p.caseSnapshot.approvalCurrent !== currentCase.approvalCurrent) staleReasons.push("CASE_APPROVAL_CHANGED");
    }
    return { ...p, id: row.id, operationId: row.id, identityKind: "proposal_operation", state: row.retired_at ? "withdrawn" : "proposed",
      requirementId: row.task_id, taskId: row.task_id, nativeLinkId: null, governance: nativeRequirementGovernance(),
      provenance: row.provenance, createdAt: row.created_at, createdBy: row.created_by, retiredAt: row.retired_at ?? null,
      retiredBy: row.retired_by ?? null, retirementProvenance: row.retirement_provenance ?? null,
      current: staleReasons.length === 0, staleReasons, case: currentCase };
  }
  private coverage(requirement: Body, links: ReturnType<NativeRequirementsRepository["link"]>[]) {
    const active = links.filter(link => !link.retiredAt);
    return { requirementId: requirement.id, taskId: requirement.id, requirementVersionId: requirement.current_version_id,
      identityKind: "proposal_task", proposedLinkCount: active.length, currentProposedLinkCount: active.filter(link => link.current).length,
      staleProposedLinkCount: active.filter(link => !link.current).length,
      staleReasons: [...new Set(active.flatMap(link => link.staleReasons))].sort(),
      approval: { status: "blocked", eligibleCount: 0, reason: "SKILL_CONTEXT_UNAVAILABLE" },
      execution: { status: "unavailable", eligibleCount: null, reason: "REQUIREMENT_EXECUTION_APPLICABILITY_UNAVAILABLE" },
      passing: { status: "unavailable", eligibleCount: null, reason: "REQUIREMENT_EXECUTION_APPLICABILITY_UNAVAILABLE" } };
  }
  async capabilities(projectId: string, userId: string | null | undefined) {
    await this.access(projectId, userId); return nativeRequirementsCapability();
  }
  async list(projectId: string, userId: string | null | undefined, raw: Body = {}) {
    await this.access(projectId, userId);
    const query = closedObject(raw, ["limit", "offset", "includeRetired"], "query");
    const integer = (value: unknown, fallback: number, max: number, min: number) => {
      if (value === undefined) return fallback;
      if ((typeof value !== "number" && typeof value !== "string") || !/^(0|[1-9][0-9]*)$/.test(String(value))) throw new BadRequestException({ error: "Pagination must use whole non-negative numbers" });
      const number = Number(value);
      if (!Number.isSafeInteger(number) || number < min || number > max) throw new BadRequestException({ error: "Pagination is outside its supported range" });
      return number;
    };
    const limit = integer(query.limit, 25, 100, 1), offset = integer(query.offset, 0, Number.MAX_SAFE_INTEGER, 0);
    if (query.includeRetired !== undefined && ![true, false, "true", "false"].includes(query.includeRetired)) throw new BadRequestException({ error: "includeRetired must be a boolean" });
    return this.db.transaction(async client => {
      await client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const ids = await client.query(`SELECT id FROM ai_generation_requests WHERE project_id=$1 AND proposal_governance IS NOT NULL
        AND ($2::BOOLEAN OR task_status='in_review') ORDER BY updated_at DESC,id LIMIT $3 OFFSET $4`, [projectId, query.includeRetired === true || query.includeRetired === "true", limit, offset]);
      const count = await client.query(`SELECT count(*)::INT AS total FROM ai_generation_requests WHERE project_id=$1
        AND proposal_governance IS NOT NULL AND ($2::BOOLEAN OR task_status='in_review')`, [projectId, query.includeRetired === true || query.includeRetired === "true"]);
      const list = [];
      for (const item of ids.rows) list.push(this.requirement(await this.row(client, projectId, item.id)));
      return { list, total: count.rows[0].total as number, capability: nativeRequirementsCapability() };
    });
  }
  async get(projectId: string, userId: string | null | undefined, rawId: string) {
    const uid = await this.access(projectId, userId), id = requirementObjectId(rawId);
    return this.db.transaction(async client => {
      await client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const row = await this.row(client, projectId, id);
      const versions = (await client.query(`SELECT o.*,row_number() OVER(ORDER BY operation_sequence) AS version_number
        FROM proposal_operations o WHERE task_id=$1 AND project_id=$2 AND operation_kind='requirement_revision' ORDER BY operation_sequence DESC`, [id, projectId])).rows;
      const links = (await this.linkRows(client, projectId, id)).map(link => this.link(link, row));
      const cases = (await client.query("SELECT * FROM proposal_operations WHERE task_id=$1 AND project_id=$2 AND operation_kind='testcase_revision' ORDER BY operation_sequence DESC LIMIT 1", [id, projectId])).rows[0];
      return { requirement: this.requirement(row), versions: versions.map(version => this.version(version)), links,
        caseProposals: cases ? [{ id, taskId: id, taskStatus: row.task_status, title: row.user_story,
          requirementVersionId: cases.requirement_operation_id, criterionKeys: cases.payload.requirement.criterionKeys,
          createdAt: cases.created_at, reviewPath: `/projects/${projectId}/agents/tasks/${id}` }] : [],
        coverage: this.coverage(row, links), capability: nativeRequirementsCapability() };
    });
  }
  async getCoverage(projectId: string, userId: string | null | undefined, id: string) { return (await this.get(projectId, userId, id)).coverage; }
  private async receipt(client: PoolClient, projectId: string, id: string, key: string, digest: string) {
    const row = (await client.query("SELECT id,request_digest FROM proposal_operations WHERE task_id=$1 AND project_id=$2 AND submission_key=$3", [id, projectId, key])).rows[0];
    if (row && row.request_digest !== digest) throw new ConflictException({ code: "SUBMISSION_KEY_REUSED", error: "This submission key identifies different content, basis or principal" });
    return row;
  }
  async create(projectId: string, userId: string | null | undefined, raw: Body, principal: TestcaseProposalPrincipal) {
    requireNativeRequirementsPreview();
    const uid = await this.access(projectId, userId), body = closedObject(raw, ["submissionKey", ...REQUIREMENT_CONTENT_FIELDS]);
    const submissionKey = requirementUuid(body.submissionKey, "submissionKey"), content = normalizeRequirementContent(body);
    const receipt = await this.db.transaction(async client => {
      await this.writer(client, projectId, uid, principal, "create_requirement");
      const provenance = nativeProposalProvenance(uid, principal), digest = proposalDigest({ content, provenance });
      const key = `requirement:${submissionKey}`;
      const prior = (await client.query(`SELECT r.id,r.proposal_request_digest,o.id AS version_id FROM ai_generation_requests r
        JOIN proposal_operations o ON o.task_id=r.id AND o.operation_sequence=1
        WHERE r.project_id=$1 AND r.proposal_request_key=$2 AND r.proposal_governance IS NOT NULL`, [projectId, key])).rows[0];
      if (prior) {
        if (prior.proposal_request_digest !== digest) throw new ConflictException({ code: "SUBMISSION_KEY_REUSED", error: "This submission key identifies different content or principal" });
        return { id: String(prior.id), versionId: String(prior.version_id), replayed: true };
      }
      const task = (await client.query(`INSERT INTO ai_generation_requests(project_id,requested_by,provider,user_story,requested_count,generated_count,
        generated_payload,task_status,proposal_request_key,proposal_request_digest,proposal_provenance,proposal_governance)
        VALUES($1,$2,'external_proposal',$3,0,0,'[]'::JSONB,'in_review',$4,$5,$6::JSONB,$7::JSONB) RETURNING id`,
      [projectId, uid, content.title, key, digest, JSON.stringify(provenance), JSON.stringify(nativeRequirementGovernance())])).rows[0];
      const operation = await appendNativeProposalOperation(client, projectId, task.id, "requirement_revision", content, provenance, key, digest);
      await this.legacy.logProjectActivity(projectId, provenance.actorId, "requirement_proposal_created", "ai_generation_request", task.id, content.title,
        { operationId: operation.id, contentDigest: operation.content_digest, provenance, governance: nativeRequirementGovernance() }, client);
      return { id: String(task.id), versionId: String(operation.id), replayed: false };
    });
    return { ...await this.get(projectId, uid, receipt.id), submission: { versionId: receipt.versionId, replayed: receipt.replayed } };
  }
  async revise(projectId: string, userId: string | null | undefined, rawId: string, raw: Body, principal: TestcaseProposalPrincipal) {
    requireNativeRequirementsPreview();
    const uid = await this.access(projectId, userId), id = requirementObjectId(rawId);
    const body = closedObject(raw, ["submissionKey", "expectedVersionId", "expectedContentDigest", ...REQUIREMENT_CONTENT_FIELDS]);
    const submissionKey = requirementUuid(body.submissionKey, "submissionKey"), content = normalizeRequirementContent(body), head = expectedRequirementHead(body);
    const receipt = await this.db.transaction(async client => {
      await this.writer(client, projectId, uid, principal, "add_requirement_revision");
      const row = await this.row(client, projectId, id, true), provenance = nativeProposalProvenance(uid, principal), digest = proposalDigest({ content, head, provenance });
      const prior = await this.receipt(client, projectId, id, `revision:${submissionKey}`, digest);
      if (prior) return { versionId: String(prior.id), replayed: true };
      if (row.state !== "draft") throw new ConflictException({ code: "REQUIREMENT_RETIRED", error: "This requirement proposal is withdrawn" });
      assertRequirementHead(row, head);
      const op = await appendNativeProposalOperation(client, projectId, id, "requirement_revision", content, provenance, `revision:${submissionKey}`, digest, { parentOperationId: row.current_version_id });
      await this.legacy.logProjectActivity(projectId, provenance.actorId, "requirement_proposal_revised", "ai_generation_request", id, content.title,
        { previousOperationId: row.current_version_id, operationId: op.id, contentDigest: op.content_digest, provenance }, client);
      return { versionId: String(op.id), replayed: false };
    });
    return { ...await this.get(projectId, uid, id), submission: receipt };
  }
  private withdrawalAuthority(authority: Body, original: Body, provenance: Body, principal: TestcaseProposalPrincipal) {
    if (original.principalKey === provenance.principalKey) return;
    requireHumanReviewPrincipal(principal);
    if (!["owner", "manager"].includes(this.legacy.parseRole(authority.caller_role) || "")) throw new ForbiddenException({ error: "Withdrawing another author's proposal requires a project owner or manager" });
  }
  async retire(projectId: string, userId: string | null | undefined, rawId: string, raw: Body, principal: TestcaseProposalPrincipal) {
    requireNativeRequirementsPreview();
    const uid = await this.access(projectId, userId), id = requirementObjectId(rawId), head = expectedRequirementHead(closedObject(raw, ["expectedVersionId", "expectedContentDigest"]));
    await this.db.transaction(async client => {
      const authority = await this.writer(client, projectId, uid, principal, "retire_requirement"), row = await this.row(client, projectId, id, true), provenance = nativeProposalProvenance(uid, principal);
      this.withdrawalAuthority(authority, row.proposal_provenance, provenance, principal);
      assertRequirementHead(row, head);
      if (row.state === "retired") return;
      await appendNativeProposalOperation(client, projectId, id, "withdraw_requirement", { reason: "Author or authorized reviewer withdrew the staged proposal" }, provenance, "withdraw_requirement", proposalDigest({ head, provenance }));
      await this.legacy.logProjectActivity(projectId, provenance.actorId, "requirement_proposal_retired", "ai_generation_request", id, null, { provenance }, client);
    });
    return this.get(projectId, uid, id);
  }
  async associate(projectId: string, userId: string | null | undefined, rawId: string, raw: Body, principal: TestcaseProposalPrincipal) {
    requireNativeRequirementsPreview();
    const uid = await this.access(projectId, userId), id = requirementObjectId(rawId);
    const body = closedObject(raw, ["submissionKey", ...BASIS_FIELDS, "testcaseId", "testcaseRevision", "testcaseApprovalRevision"]);
    const submissionKey = requirementUuid(body.submissionKey, "submissionKey"), basis = nativeRequirementBasis(body);
    const testcaseId = requirementUuid(body.testcaseId, "testcaseId"), testcaseRevision = requirementDigest(body.testcaseRevision, "testcaseRevision");
    const approvalRevision = body.testcaseApprovalRevision === null ? null : requirementDigest(body.testcaseApprovalRevision, "testcaseApprovalRevision");
    const receipt = await this.db.transaction(async client => {
      await this.writer(client, projectId, uid, principal, "link_requirement_case");
      const provenance = nativeProposalProvenance(uid, principal);
      const digest = proposalDigest({ projectId, requirementId: id, submissionKey, ...basis, testcaseId, testcaseRevision, testcaseApprovalRevision: approvalRevision, provenance });
      const prior = await this.receipt(client, projectId, id, `link:${submissionKey}`, digest);
      if (prior) return { linkId: String(prior.id), replayed: true };
      const governance = await lockNativeRequirementBasis(client, projectId, id, basis);
      const testcase = (await client.query(`SELECT testcases.*,${TESTCASE_EDIT_REVISION_SQL} AS edit_revision,
        ${TESTCASE_APPROVAL_REVISION_SQL} AS approval_revision,${TESTCASE_APPROVAL_CURRENT_SQL} AS approval_current,testcase_approval_snapshot(id) AS reviewed_snapshot
        FROM testcases WHERE id=$1 AND project_id=$2 AND deleted_at IS NULL FOR SHARE`, [testcaseId, projectId])).rows[0];
      if (!testcase) throw new NotFoundException({ error: "Testcase not found in this project" });
      if (testcase.status === "Archived") throw new ConflictException({ code: "CASE_ARCHIVED", error: "An archived testcase cannot receive a new proposal association" });
      if (testcase.edit_revision !== testcaseRevision || (testcase.approval_current ? testcase.approval_revision : null) !== approvalRevision) throw new ConflictException({ code: "CASE_REVISION_CHANGED", error: "The exact current testcase and approval revisions are required" });
      const duplicate = await client.query(`SELECT 1 FROM proposal_operations l WHERE l.task_id=$1 AND l.operation_kind='requirement_case_link'
        AND l.requirement_operation_id=$2 AND l.payload->>'testcaseId'=$3 AND l.payload->'criterionKeys'=$4::JSONB
        AND NOT EXISTS(SELECT 1 FROM proposal_operations w WHERE w.target_operation_id=l.id AND w.operation_kind='withdraw_link')`, [id, basis.requirementVersionId, testcaseId, JSON.stringify(basis.criterionKeys)]);
      if (duplicate.rows.length) throw new ConflictException({ code: "REQUIREMENT_LINK_EXISTS", error: "This association is already proposed; withdraw it before submitting a replacement" });
      const caseSnapshot = { id: testcase.id, externalId: testcase.external_id, title: testcase.title, status: testcase.status,
        editRevision: testcase.edit_revision, approvalRevision: testcase.approval_revision, approvalCurrent: testcase.approval_current, reviewedSnapshot: testcase.reviewed_snapshot };
      const op = await appendNativeProposalOperation(client, projectId, id, "requirement_case_link",
        { submissionKey, ...basis, testcaseId, testcaseRevision, testcaseApprovalRevision: approvalRevision, caseSnapshot }, provenance, `link:${submissionKey}`, digest,
        { requirementOperationId: basis.requirementVersionId });
      await this.legacy.logProjectActivity(projectId, provenance.actorId, "requirement_case_association_proposed", "ai_generation_request", id, governance.requirement.key,
        { operationId: op.id, ...basis, testcaseId, testcaseRevision, provenance }, client);
      return { linkId: String(op.id), replayed: false };
    });
    const detail = await this.get(projectId, uid, id);
    return { link: detail.links.find(link => link.id === receipt.linkId)!, coverage: detail.coverage, submission: receipt };
  }
  async retireLink(projectId: string, userId: string | null | undefined, rawId: string, rawLinkId: string, principal: TestcaseProposalPrincipal) {
    requireNativeRequirementsPreview();
    const uid = await this.access(projectId, userId), id = requirementObjectId(rawId), linkId = requirementObjectId(rawLinkId);
    await this.db.transaction(async client => {
      const authority = await this.writer(client, projectId, uid, principal, "retire_requirement_case_link");
      const task = await this.row(client, projectId, id, true), provenance = nativeProposalProvenance(uid, principal);
      const link = (await client.query("SELECT * FROM proposal_operations WHERE id=$1 AND task_id=$2 AND project_id=$3 AND operation_kind='requirement_case_link'", [linkId, id, projectId])).rows[0];
      if (!link) throw new NotFoundException({ error: "Proposed association not found" });
      this.withdrawalAuthority(authority, link.provenance, provenance, principal);
      if ((await client.query("SELECT 1 FROM proposal_operations WHERE task_id=$1 AND target_operation_id=$2 AND operation_kind='withdraw_link'", [id, linkId])).rows.length) return;
      if (task.state === "retired") throw new ConflictException({ code: "REQUIREMENT_RETIRED", error: "This requirement proposal is withdrawn" });
      await appendNativeProposalOperation(client, projectId, id, "withdraw_link", { reason: "Author or authorized reviewer withdrew the proposed association" }, provenance,
        `withdraw_link:${linkId}`, proposalDigest({ linkId, provenance }), { targetOperationId: linkId });
      await this.legacy.logProjectActivity(projectId, provenance.actorId, "requirement_case_association_retired", "ai_generation_request", id, null, { linkId, provenance }, client);
    });
    const detail = await this.get(projectId, uid, id);
    return { link: detail.links.find(link => link.id === linkId)!, coverage: detail.coverage };
  }
  async stage(projectId: string, userId: string | null | undefined, rawId: string, raw: Body, principal: TestcaseProposalPrincipal) {
    requireNativeRequirementsPreview();
    const uid = await this.access(projectId, userId), id = requirementObjectId(rawId);
    const body = closedObject(raw, [...BASIS_FIELDS, "requestKey", "title", "operations"]), basis = nativeRequirementBasis(body);
    const task = await this.legacy.stageTestcaseChanges(projectId, uid, { requestKey: body.requestKey, title: body.title,
      operations: body.operations, requirementContext: { requirementId: id, ...basis } }, principal);
    return { publication: "unpublished", taskId: task.id, task, reviewPath: `/projects/${projectId}/agents/tasks/${task.id}` };
  }
  async refuseApproval(projectId: string, userId: string | null | undefined, rawId: string, rawVersionId: string, body: Body, principal: TestcaseProposalPrincipal) {
    requireHumanReviewPrincipal(principal); requireNativeRequirementsPreview();
    const uid = await this.access(projectId, userId), id = requirementObjectId(rawId), versionId = requirementObjectId(rawVersionId);
    closedObject(body, ["expectedContentDigest"]); requirementDigest(body.expectedContentDigest, "expectedContentDigest");
    await this.db.transaction(async client => {
      const authority = await this.writer(client, projectId, uid, principal, "approve_requirement");
      if (!["owner", "manager"].includes(this.legacy.parseRole(authority.caller_role) || "")) throw new ForbiddenException({ error: "Requirement approval requires a project owner or manager" });
      const row = await this.row(client, projectId, id, true);
      if (!(await client.query("SELECT 1 FROM proposal_operations WHERE id=$1 AND task_id=$2 AND project_id=$3 AND operation_kind='requirement_revision'", [versionId, id, projectId])).rows.length) throw new NotFoundException({ error: "Requirement proposal iteration not found" });
      assertRequirementHead(row, { expectedVersionId: versionId, expectedContentDigest: body.expectedContentDigest });
      throw new ForbiddenException(nativeRequirementPublicationBlock());
    });
  }
}
