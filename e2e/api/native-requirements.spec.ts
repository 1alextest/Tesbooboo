import path from "node:path";
import { randomUUID } from "node:crypto";
import { expect, request as requests, test, type APIRequestContext, type APIResponse } from "@playwright/test";
import { env } from "../utils/env";
import { createApprovedTestcase } from "../utils/testcase-approval";
import { testcaseEditState } from "../utils/testcase-edit-state";
import {
  addProjectMember, createProject, deleteProjects, removeWorkspaceMember,
  screensApi, screensTenant, seedWorkspaceMember,
} from "../utils/screens-tenant";

/*
 * R-ASE-04/05/06/14/25: persisted proposals are useful without claiming normative approval.
 * Every fixture is a new project in the existing disposable screens tenant. No tenant plan or
 * shared member is changed; billing-lock coverage lives with the existing billing-lifecycle owner.
 * The disabled companion is the SAME CI build with only the feature flag unset. It is required,
 * rather than a conditional skip that could silently lose the default-off HTTP boundary.
 */
test.describe("native requirement proposals", () => {
  let api: APIRequestContext;
  let anonymous: APIRequestContext;
  let otherTenant: APIRequestContext;

  test.beforeAll(async () => {
    expect(screensTenant(), "requires the existing disposable screens tenant from global setup").not.toBeNull();
    api = await screensApi();
    anonymous = await requests.newContext({ baseURL: env.apiBaseUrl, storageState: { cookies: [], origins: [] } });
    otherTenant = await requests.newContext({ baseURL: env.apiBaseUrl, storageState: path.join(__dirname, "../.auth/state-b.json") });
  });
  test.afterAll(async () => {
    await Promise.all([api, anonymous, otherTenant].filter(Boolean).map(context => context.dispose()));
  });

  const base = (projectId: string) => `/api/projects/${projectId}/requirements`;
  const content = (title = `E2E requirement ${randomUUID()}`) => ({
    submissionKey: randomUUID(), title, description: "A user can inspect the exact saved behavior.",
    criteria: [{ key: "AC-1", text: "The saved proposal is independently retrievable." }],
    rationale: "Preserve the review basis", sourceRefs: [{ label: "Reference specification", url: "https://example.com/specification" }],
  });
  async function json(response: APIResponse, status = 200) {
    expect(response.status(), await response.text()).toBe(status);
    return response.json();
  }
  async function create(projectId: string, values: Record<string, unknown> = {}) {
    const created = await json(await api.post(base(projectId), { data: { ...content(), ...values } }), 201);
    expect(created.submission).toMatchObject({ versionId: created.requirement.currentVersion.id, replayed: false });
    expect(created.requirement).toMatchObject({ identityKind: "proposal_task", taskId: created.requirement.id, nativeDocumentId: null });
    expect(created.requirement.currentVersion).toMatchObject({ identityKind: "proposal_operation", operationId: created.submission.versionId, nativeVersionId: null });
    return proposalDetail(created);
  }
  function proposalDetail(result: any) {
    const { submission: _submission, ...detail } = result;
    return detail;
  }
  async function read(projectId: string, requirementId: string) {
    return json(await api.get(`${base(projectId)}/${requirementId}`));
  }
  function revisionBody(detail: any, values: Record<string, unknown> = {}) {
    const version = detail.requirement.currentVersion;
    return {
      ...content(version.title), description: version.description, criteria: version.criteria,
      rationale: version.rationale, sourceRefs: version.sourceRefs,
      expectedVersionId: version.id, expectedContentDigest: version.contentDigest, ...values,
    };
  }
  function basis(detail: any) {
    const version = detail.requirement.currentVersion;
    return { requirementVersionId: version.id, requirementContentDigest: version.contentDigest, criterionKeys: [version.criteria[0].key] };
  }
  function unavailableCoverage(value: any) {
    expect(value.approval).toEqual({ status: "blocked", eligibleCount: 0, reason: "SKILL_CONTEXT_UNAVAILABLE" });
    expect(value.execution).toMatchObject({ status: "unavailable", eligibleCount: null });
    expect(value.passing).toMatchObject({ status: "unavailable", eligibleCount: null });
  }
  async function caseState(projectId: string, testcaseId: string) {
    return json(await api.get(`/api/projects/${projectId}/testcases/${testcaseId}`));
  }
  async function associate(projectId: string, detail: any, testcase: any, submissionKey = randomUUID()) {
    return json(await api.post(`${base(projectId)}/${detail.requirement.id}/links`, { data: {
      submissionKey, ...basis(detail), testcaseId: testcase.id, testcaseRevision: testcase.editRevision,
      testcaseApprovalRevision: testcase.approvalCurrent ? testcase.approvalRevision : null,
    } }), 201);
  }

  test("NREQ-A-01 a proposal without a provider connection persists exact content and immutable revision history", async () => {
    const project = await createProject(api);
    try {
      const kbPath = `/api/projects/${project.id}/knowledge-base/documents`;
      const knowledgeBefore = await json(await api.get(kbPath));
      const empty = await json(await api.get(base(project.id)));
      expect(empty).toMatchObject({ list: [], total: 0, capability: {
        mode: "unpublished_proposals_only", enabled: true, skillResolution: "unavailable", canApprove: false, canPublishCases: false,
      } });
      const submitted = content(`E2E checkout • revisión ${randomUUID()}`);
      const initial = await create(project.id, submitted);
      const first = initial.requirement.currentVersion;
      expect(initial.requirement).toMatchObject({ projectId: project.id, state: "draft", publication: "unpublished" });
      expect(initial.requirement.key).toMatch(/^REQ-PROP-[a-f0-9]{8}$/);
      expect(first).toMatchObject({ versionNumber: 1, parentVersionId: null, title: submitted.title, criteria: submitted.criteria,
        rationale: submitted.rationale, sourceRefs: submitted.sourceRefs,
        governance: { policy: "unpublished_proposals_only", skillContext: { status: "unavailable", resolvedAt: null } } });
      expect(first.contentDigest).toMatch(/^[a-f0-9]{64}$/);
      expect(first.createdBy).toEqual(expect.any(String));
      expect(await read(project.id, initial.requirement.id)).toEqual(initial);
      // A requirement-only candidate is already reviewable in the existing task owner.
      // Its provisional identity must never masquerade as a published KB document/version.
      const taskPath = `/api/projects/${project.id}/agents/zyra/tasks/${initial.requirement.taskId}`;
      const firstTask = await json(await api.get(taskPath));
      expect(firstTask.id).toBe(initial.requirement.id);
      expect(firstTask.drafts).toEqual([]);
      expect(firstTask.publicationBlocked.code).toBe("SKILL_CONTEXT_UNAVAILABLE");
      expect(firstTask.proposalSnapshot.stagedOperations).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: first.operationId, identityKind: "proposal_operation", operationKind: "requirement_revision",
          payload: expect.objectContaining({ title: submitted.title, criteria: submitted.criteria }) }),
      ]));
      expect((await api.get(`${kbPath}/${initial.requirement.id}`)).status()).toBe(404);
      const revised = proposalDetail(await json(await api.post(`${base(project.id)}/${initial.requirement.id}/revisions`, {
        data: revisionBody(initial, { title: `${submitted.title} revised`, criteria: [{ key: "AC-1", text: "The revised behavior is independently retrievable." }] }),
      }), 201));
      expect(revised.requirement.currentVersion).toMatchObject({ versionNumber: 2, parentVersionId: first.id });
      expect(revised.requirement.currentVersion.contentDigest).not.toBe(first.contentDigest);
      expect(revised.versions).toHaveLength(2);
      expect(revised.versions.find((version: any) => version.id === first.id)).toEqual(first);
      const reopened = await read(project.id, initial.requirement.id);
      expect(reopened).toEqual(revised);
      const revisedTask = await json(await api.get(taskPath));
      expect(revisedTask.proposalRevision).not.toBe(firstTask.proposalRevision);
      expect(revisedTask.proposalSnapshot.stagedOperations.filter((operation: any) => operation.operationKind === "requirement_revision")).toHaveLength(2);
      expect(revisedTask.proposalSnapshot.stagedOperations.find((operation: any) => operation.id === first.operationId))
        .toEqual(firstTask.proposalSnapshot.stagedOperations.find((operation: any) => operation.id === first.operationId));
      expect(await json(await api.get(kbPath))).toEqual(knowledgeBefore);
      const list = await json(await api.get(base(project.id)));
      expect(list.total).toBe(1);
      expect(list.list[0].currentVersion.id).toBe(revised.requirement.currentVersion.id);
      expect(await json(await api.get(base(project.id), { params: { limit: 1, offset: 1 } }))).toMatchObject({ list: [], total: 1 });
      const invalidQueries: Array<Record<string, string | number | boolean>> = [{ limit: 0 }, { limit: 101 }, { offset: -1 }, { offset: "1.5" }, { includeRetired: "sometimes" }];
      for (const params of invalidQueries) {
        expect((await api.get(base(project.id), { params })).status()).toBe(400);
      }
      unavailableCoverage(reopened.coverage);
    } finally { await deleteProjects(api, [project.id]); }
  });

  test("NREQ-A-02 duplicate and concurrent submissions share one identity while changed-key content is refused", async () => {
    const project = await createProject(api);
    try {
      const body = content();
      const replies = await Promise.all([api.post(base(project.id), { data: body }), api.post(base(project.id), { data: body })]);
      const details = await Promise.all(replies.map(response => json(response, 201)));
      expect(details[0].requirement.id).toBe(details[1].requirement.id);
      expect(details[0].requirement.currentVersion.id).toBe(details[1].requirement.currentVersion.id);
      expect(details.map(detail => detail.submission.replayed).sort()).toEqual([false, true]);
      const collision = await api.post(base(project.id), { data: { ...body, title: "Different content under the old key" } });
      expect(await json(collision, 409)).toMatchObject({ code: "SUBMISSION_KEY_REUSED" });
      expect((await read(project.id, details[0].requirement.id)).versions).toHaveLength(1);
      expect((await json(await api.get(base(project.id)))).total).toBe(1);
      const revised = await json(await api.post(`${base(project.id)}/${details[0].requirement.id}/revisions`, {
        data: revisionBody(details[0], { title: `${body.title} later revision` }),
      }), 201);
      const replay = await json(await api.post(base(project.id), { data: body }), 201);
      expect(replay.submission).toMatchObject({ replayed: true, versionId: details[0].requirement.currentVersion.id });
      expect(replay.requirement.currentVersion.id).toBe(revised.requirement.currentVersion.id);
    } finally { await deleteProjects(api, [project.id]); }
  });

  test("NREQ-A-03 two editors cannot replace each other's revision and stale writes preserve saved history", async () => {
    const project = await createProject(api);
    try {
      const original = await create(project.id);
      const endpoint = `${base(project.id)}/${original.requirement.id}/revisions`;
      const alternatives = [revisionBody(original, { title: "First editor" }), revisionBody(original, { title: "Second editor" })];
      const responses = await Promise.all(alternatives.map(data => api.post(endpoint, { data })));
      expect(responses.map(response => response.status()).sort()).toEqual([201, 409]);
      const committed = await read(project.id, original.requirement.id);
      expect(committed.versions).toHaveLength(2);
      expect(committed.versions.find((version: any) => version.id === original.requirement.currentVersion.id)).toEqual(original.requirement.currentVersion);
      const refusal = await json(await api.post(endpoint, { data: revisionBody(original, { title: "Late overwrite" }) }), 409);
      expect(refusal.code).toBe("REQUIREMENT_STALE_REVISION");
      expect(await read(project.id, original.requirement.id)).toEqual(committed);
      const successfulBody = alternatives[responses.findIndex(response => response.status() === 201)];
      expect((await json(await api.post(endpoint, { data: successfulBody }), 201)).requirement.currentVersion.id)
        .toBe(committed.requirement.currentVersion.id);
    } finally { await deleteProjects(api, [project.id]); }
  });

  test("NREQ-A-04 malformed, empty, overlong and forged-governance input writes no proposal", async () => {
    const project = await createProject(api);
    try {
      const valid = content();
      const invalid = [
        {}, { ...valid, submissionKey: "not-a-uuid" }, { ...valid, title: " " }, { ...valid, title: null },
        { ...valid, title: 3 }, { ...valid, title: "x".repeat(513) }, { ...valid, description: "x".repeat(20001) },
        { ...valid, criteria: [] }, { ...valid, criteria: null }, { ...valid, criteria: [{ key: "AC-1", text: " " }] },
        { ...valid, criteria: [{ key: "AC-1", text: "One" }, { key: "AC-1", text: "Two" }] },
        { ...valid, criteria: Array.from({ length: 101 }, (_, index) => ({ key: `AC-${index}`, text: "Too many" })) },
        { ...valid, sourceRefs: [{ label: "Unsafe", url: "javascript:alert(1)" }] },
        { ...valid, governance: { policy: "publish_without_skills", skillContext: { status: "resolved" } } },
      ];
      for (const data of invalid) expect((await api.post(base(project.id), { data })).status(), JSON.stringify(data).slice(0, 160)).toBe(400);
      expect((await json(await api.get(base(project.id)))).total).toBe(0);
      const boundary = await create(project.id, { title: "x".repeat(512), criteria: [{ key: "A", text: "x".repeat(4000) }] });
      expect(boundary.requirement.currentVersion.title).toHaveLength(512);
      expect(boundary.requirement.currentVersion.criteria[0].text).toHaveLength(4000);
    } finally { await deleteProjects(api, [project.id]); }
  });

  test("NREQ-A-05 anonymous and other-tenant callers cannot read, revise, retire or associate a known identity", async () => {
    const project = await createProject(api);
    try {
      const original = await create(project.id);
      const endpoint = `${base(project.id)}/${original.requirement.id}`;
      for (const actor of [anonymous, otherTenant]) {
        for (const response of [
          await actor.get(base(project.id)), await actor.get(endpoint), await actor.get(`${endpoint}/coverage`),
          await actor.post(base(project.id), { data: content() }),
          await actor.post(`${endpoint}/revisions`, { data: revisionBody(original) }),
          await actor.post(`${endpoint}/retire`, { data: { expectedVersionId: original.requirement.currentVersion.id, expectedContentDigest: original.requirement.currentVersion.contentDigest } }),
          await actor.post(`${endpoint}/links`, { data: { submissionKey: randomUUID(), ...basis(original), testcaseId: randomUUID(), testcaseRevision: "a".repeat(64), testcaseApprovalRevision: null } }),
        ]) expect([401, 403, 404], await response.text()).toContain(response.status());
      }
      expect(await read(project.id, original.requirement.id)).toEqual(original);
      expect((await json(await api.get(base(project.id)))).total).toBe(1);
    } finally { await deleteProjects(api, [project.id]); }
  });

  test("NREQ-A-06 project tokens preserve scope and neither a machine nor a project member can claim approval", async () => {
    const project = await createProject(api);
    const credentials: any[] = [];
    let member: Awaited<ReturnType<typeof seedWorkspaceMember>> | undefined;
    let memberApi: APIRequestContext | undefined;
    try {
      const original = await create(project.id);
      for (const scopes of [["read"], ["read", "write"]]) {
        credentials.push(await json(await api.post(`/api/projects/${project.id}/apikeys`, { data: { name: `Requirement token ${randomUUID()}`, scopes } }), 201));
      }
      const readOnly = { Authorization: `Bearer ${credentials[0].token}` };
      const write = { Authorization: `Bearer ${credentials[1].token}` };
      expect((await anonymous.get(base(project.id), { headers: readOnly })).status()).toBe(200);
      expect((await anonymous.post(base(project.id), { headers: readOnly, data: content() })).status()).toBe(403);
      const machineDraft = await json(await anonymous.post(base(project.id), { headers: write, data: content() }), 201);
      expect(machineDraft.requirement.publication).toBe("unpublished");
      const approveUrl = `${base(project.id)}/${original.requirement.id}/revisions/${original.requirement.currentVersion.id}/approve`;
      const approvalBody = { expectedContentDigest: original.requirement.currentVersion.contentDigest };
      expect((await anonymous.post(approveUrl, { headers: write, data: approvalBody })).status()).toBe(403);
      member = await seedWorkspaceMember(screensTenant()!.organizationId, "member");
      await addProjectMember(api, project.id, member.userId, "qa_engineer");
      memberApi = await requests.newContext({ baseURL: env.apiBaseUrl, storageState: member.storageStatePath });
      expect((await memberApi.get(base(project.id))).status()).toBe(200);
      expect((await memberApi.post(approveUrl, { data: approvalBody })).status()).toBe(403);
      expect(await json(await api.post(approveUrl, { data: approvalBody }), 403)).toMatchObject({ code: "SKILL_CONTEXT_UNAVAILABLE" });
      expect(await read(project.id, original.requirement.id)).toEqual(original);
    } finally {
      for (const token of credentials) await api.delete(`/api/projects/${project.id}/apikeys/${token.id}`, { failOnStatusCode: false });
      await memberApi?.dispose();
      if (member) removeWorkspaceMember(member.userId, member.storageStatePath);
      await deleteProjects(api, [project.id]);
    }
  });

  test("NREQ-A-07 associations pin exact criteria and case revisions, expose staleness, and preserve retired history", async () => {
    const project = await createProject(api);
    const foreign = await createProject(api);
    try {
      const proposal = await create(project.id);
      const testcase = await createApprovedTestcase(api, project.id, { title: `E2E associated case ${randomUUID()}` });
      const foreignCase = await createApprovedTestcase(api, foreign.id, { title: `E2E foreign case ${randomUUID()}` });
      const endpoint = `${base(project.id)}/${proposal.requirement.id}/links`;
      const associationKey = randomUUID();
      const linked = await associate(project.id, proposal, testcase, associationKey);
      expect(linked.coverage).toMatchObject({ proposedLinkCount: 1, currentProposedLinkCount: 1, staleProposedLinkCount: 0 });
      unavailableCoverage(linked.coverage);
      expect((await associate(project.id, proposal, testcase, associationKey)).link.id).toBe(linked.link.id);
      const wrongCriterion = await api.post(endpoint, { data: { submissionKey: randomUUID(), ...basis(proposal), criterionKeys: ["MISSING"], testcaseId: testcase.id, testcaseRevision: testcase.editRevision, testcaseApprovalRevision: testcase.approvalRevision } });
      expect(wrongCriterion.status()).toBe(400);
      const wrongProject = await api.post(endpoint, { data: { submissionKey: randomUUID(), ...basis(proposal), testcaseId: foreignCase.id, testcaseRevision: foreignCase.editRevision, testcaseApprovalRevision: foreignCase.approvalRevision } });
      expect(wrongProject.status()).toBe(404);
      expect((await read(project.id, proposal.requirement.id)).links).toHaveLength(1);
      await json(await api.put(`/api/projects/${project.id}/testcases/${testcase.id}`, { data: { expectedRevision: testcase.editRevision, description: "Changed case meaning" } }));
      const stale = await json(await api.get(`${base(project.id)}/${proposal.requirement.id}/coverage`));
      expect(stale).toMatchObject({ proposedLinkCount: 1, currentProposedLinkCount: 0, staleProposedLinkCount: 1 });
      unavailableCoverage(stale);
      const oldCase = await api.post(endpoint, { data: { submissionKey: randomUUID(), ...basis(proposal), testcaseId: testcase.id, testcaseRevision: testcase.editRevision, testcaseApprovalRevision: testcase.approvalRevision } });
      expect(await json(oldCase, 409)).toMatchObject({ code: "TESTCASE_REVISION_CHANGED" });
      const retired = await json(await api.post(`${endpoint}/${linked.link.id}/retire`, { data: {} }));
      expect((await json(await api.post(`${endpoint}/${linked.link.id}/retire`, { data: {} }))).link).toEqual(retired.link);
      expect((await read(project.id, proposal.requirement.id)).links).toHaveLength(1);
      // Recover the original operation after later retirement and a changed case basis.
      // An uncertain-response recovery must never create a replacement active association.
      const recovered = await associate(project.id, proposal, testcase, associationKey);
      expect(recovered.submission).toEqual({ linkId: linked.link.id, replayed: true });
      expect(recovered.link).toEqual(retired.link);
      expect(recovered.coverage.proposedLinkCount).toBe(0);
      expect((await read(project.id, proposal.requirement.id)).links).toHaveLength(1);
      const latestCase = await caseState(project.id, testcase.id);
      const replacement = await associate(project.id, proposal, latestCase);
      expect(replacement.link.id).not.toBe(linked.link.id);
      expect(replacement.coverage).toMatchObject({ proposedLinkCount: 1, currentProposedLinkCount: 1, staleProposedLinkCount: 0 });
      const history = await read(project.id, proposal.requirement.id);
      expect(history.links).toHaveLength(2);
      expect(history.links.find((link: any) => link.id === linked.link.id).caseSnapshot).toEqual(linked.link.caseSnapshot);
    } finally { await deleteProjects(api, [project.id, foreign.id]); }
  });

  test("NREQ-A-08 a version from another requirement cannot be attached to a known identity", async () => {
    const project = await createProject(api);
    try {
      const first = await create(project.id), second = await create(project.id);
      const testcase = await createApprovedTestcase(api, project.id, { title: `E2E exact identity ${randomUUID()}` });
      const refused = await api.post(`${base(project.id)}/${first.requirement.id}/links`, { data: {
        submissionKey: randomUUID(), ...basis(second), testcaseId: testcase.id, testcaseRevision: testcase.editRevision, testcaseApprovalRevision: testcase.approvalRevision,
      } });
      expect([404, 409], await refused.text()).toContain(refused.status());
      expect((await read(project.id, first.requirement.id)).links).toHaveLength(0);
      expect((await read(project.id, second.requirement.id)).links).toHaveLength(0);
    } finally { await deleteProjects(api, [project.id]); }
  });

  test("NREQ-A-09 staged create, update and archive candidates cannot publish through direct Save or edited drafts", async () => {
    const project = await createProject(api);
    try {
      const proposal = await create(project.id);
      const updateTarget = await createApprovedTestcase(api, project.id, { title: `E2E preserve updated target ${randomUUID()}` });
      const archiveTarget = await createApprovedTestcase(api, project.id, { title: `E2E preserve archive target ${randomUUID()}` });
      const before = await Promise.all([updateTarget.id, archiveTarget.id].map(id => caseState(project.id, id).then(testcaseEditState)));
      const newTitle = `E2E unpublished candidate ${randomUUID()}`;
      const body = { ...basis(proposal), requestKey: randomUUID(), title: "Requirement-bound case changes", operations: [
        { opType: "create", draft: { title: newTitle } },
        { opType: "update", testcaseId: updateTarget.id, expectedRevision: updateTarget.editRevision, fields: { description: "A candidate change only" } },
        { opType: "archive", testcaseId: archiveTarget.id, expectedRevision: archiveTarget.editRevision, fields: {} },
      ] };
      const endpoint = `${base(project.id)}/${proposal.requirement.id}/case-proposals`;
      const staged = await json(await api.post(endpoint, { data: body }), 201);
      expect(staged).toMatchObject({ publication: "unpublished", taskId: staged.task.id });
      expect(staged.taskId).toBe(proposal.requirement.taskId);
      expect(staged.taskId).toBe(proposal.requirement.id);
      expect(staged.reviewPath).toContain(staged.taskId);
      expect((await json(await api.post(endpoint, { data: body }), 201)).taskId).toBe(staged.taskId);
      const taskEndpoint = `/api/projects/${project.id}/agents/zyra/tasks/${staged.taskId}`;
      const reviewed = await json(await api.get(taskEndpoint));
      expect(reviewed.proposalSnapshot.operations).toHaveLength(3);
      expect(reviewed.proposalSnapshot.stagedOperations.map((operation: any) => operation.operationKind))
        .toEqual(expect.arrayContaining(["requirement_revision", "testcase_revision"]));
      const originalRequirementOperation = reviewed.proposalSnapshot.stagedOperations.find((operation: any) => operation.id === proposal.requirement.currentVersion.operationId);
      expect(originalRequirementOperation.payload).toMatchObject({ title: proposal.requirement.currentVersion.title, criteria: proposal.requirement.currentVersion.criteria });
      expect(reviewed.proposalGovernance).toMatchObject({
        policy: "unpublished_proposals_only", skillContext: { status: "unavailable", resolvedAt: null },
        requirement: { id: proposal.requirement.id, versionId: proposal.requirement.currentVersion.id,
          contentDigest: proposal.requirement.currentVersion.contentDigest, criterionKeys: ["AC-1"],
          criteria: proposal.requirement.currentVersion.criteria },
      });
      expect(reviewed.publicationBlocked).toMatchObject({ code: "SKILL_CONTEXT_UNAVAILABLE" });
      const suiteName = `E2E forbidden publication suite ${randomUUID()}`;
      const save = async (revision: string, selectedDraftIndexes = [0, 1, 2]) => {
        for (const route of [`${taskEndpoint}/save`, `/api/projects/${project.id}/ai/generation-history/${staged.taskId}/save`]) {
          const response = await api.post(route, { data: { expectedProposalRevision: revision, selectedDraftIndexes, suiteName } });
          expect(await json(response, 403)).toMatchObject({ code: "SKILL_CONTEXT_UNAVAILABLE" });
        }
      };
      await save(reviewed.proposalRevision);
      const edited = await json(await api.patch(`${taskEndpoint}/drafts/0`, {
        params: { expectedProposalRevision: reviewed.proposalRevision }, data: { title: `${newTitle} edited` },
      }));
      expect(edited.proposalRevision).not.toBe(reviewed.proposalRevision);
      expect(edited.proposalGovernance).toEqual(reviewed.proposalGovernance);
      expect(edited.proposalSnapshot.stagedOperations.find((operation: any) => operation.id === originalRequirementOperation.id)).toEqual(originalRequirementOperation);
      expect(edited.proposalSnapshot.stagedOperations).toEqual(expect.arrayContaining(reviewed.proposalSnapshot.stagedOperations));
      await save(edited.proposalRevision);
      const reset = await api.post(`${taskEndpoint}/feedback`, { data: { feedback: "Regenerate these proposals without the requirement context." } });
      expect(await json(reset, 403)).toMatchObject({ code: "SKILL_CONTEXT_UNAVAILABLE" });
      const afterRefusedReset = await json(await api.get(taskEndpoint));
      expect(afterRefusedReset.proposalSnapshot).toEqual(edited.proposalSnapshot);
      expect(afterRefusedReset.proposalGovernance).toEqual(reviewed.proposalGovernance);
      const discarded = await json(await api.delete(`${taskEndpoint}/drafts/2`, { params: { expectedProposalRevision: edited.proposalRevision } }));
      expect(discarded.proposalGovernance).toEqual(reviewed.proposalGovernance);
      expect(discarded.proposalSnapshot.operations).toHaveLength(2);
      expect(discarded.proposalSnapshot.stagedOperations).toEqual(expect.arrayContaining(edited.proposalSnapshot.stagedOperations));
      await save(discarded.proposalRevision, [0, 1]);
      expect(await Promise.all([updateTarget.id, archiveTarget.id].map(id => caseState(project.id, id).then(testcaseEditState)))).toEqual(before);
      const cases = await json(await api.get(`/api/projects/${project.id}/testcases`, { params: { includeArchived: true, limit: 500 } }));
      expect(cases).toHaveLength(2);
      const suites = await json(await api.get(`/api/projects/${project.id}/suites`));
      expect(suites.some((suite: any) => suite.name === suiteName)).toBe(false);
      expect((await read(project.id, proposal.requirement.id)).caseProposals).toHaveLength(1);
      await json(await api.post(`${taskEndpoint}/close`, { data: {} }), 201);
      const closed = await json(await api.get(taskEndpoint));
      expect(closed.taskStatus).toBe("done");
      expect(closed.proposalGovernance).toEqual(reviewed.proposalGovernance);
      expect(await Promise.all([updateTarget.id, archiveTarget.id].map(id => caseState(project.id, id).then(testcaseEditState)))).toEqual(before);
    } finally { await deleteProjects(api, [project.id]); }
  });

  test("NREQ-A-10 an old passing execution stays historical after a requirement change and exact relinking", async () => {
    const project = await createProject(api);
    try {
      const original = await create(project.id);
      const testcase = await createApprovedTestcase(api, project.id, { title: `E2E historical pass ${randomUUID()}` });
      await associate(project.id, original, testcase);
      const cycle = await json(await api.post(`/api/projects/${project.id}/cycles`, { data: { name: `E2E historical requirement run ${randomUUID()}` } }), 201);
      await json(await api.post(`/api/cycles/${cycle.id}/testcases`, { data: { testcaseIds: [testcase.id] } }), 201);
      const executions = await json(await api.get(`/api/cycles/${cycle.id}/executions`));
      const execution = executions.find((row: any) => row.testcaseId === testcase.id);
      expect(execution).toBeDefined();
      await json(await api.patch(`/api/cycles/${cycle.id}/executions/${execution.id}`, { data: { status: "Passed" } }));
      const revised = await json(await api.post(`${base(project.id)}/${original.requirement.id}/revisions`, {
        data: revisionBody(original, { criteria: [{ key: "AC-1", text: "A new behavior not exercised by the old run." }] }),
      }), 201);
      expect(revised.coverage).toMatchObject({ proposedLinkCount: 1, currentProposedLinkCount: 0, staleProposedLinkCount: 1 });
      const currentCase = await caseState(project.id, testcase.id);
      await associate(project.id, revised, currentCase);
      const coverage = await json(await api.get(`${base(project.id)}/${original.requirement.id}/coverage`));
      expect(coverage).toMatchObject({ proposedLinkCount: 2, currentProposedLinkCount: 1, staleProposedLinkCount: 1 });
      unavailableCoverage(coverage);
      const history = await json(await api.get(`/api/cycles/${cycle.id}/executions`));
      expect(history.find((row: any) => row.id === execution.id).status).toBe("Passed");
      expect((await caseState(project.id, testcase.id)).approvalRevision).toBe(testcase.approvalRevision);
    } finally { await deleteProjects(api, [project.id]); }
  });

  test("NREQ-A-11 retirement preserves the immutable history and project archive makes the proposal inaccessible", async () => {
    const project = await createProject(api);
    try {
      const proposal = await create(project.id);
      const endpoint = `${base(project.id)}/${proposal.requirement.id}`;
      const retireBody = { expectedVersionId: proposal.requirement.currentVersion.id, expectedContentDigest: proposal.requirement.currentVersion.contentDigest };
      const retired = await json(await api.post(`${endpoint}/retire`, { data: retireBody }));
      expect(retired.requirement.state).toBe("retired");
      expect(retired.versions).toEqual(proposal.versions);
      expect(await json(await api.post(`${endpoint}/retire`, { data: retireBody }))).toEqual(retired);
      expect((await json(await api.get(base(project.id)))).total).toBe(0);
      expect((await json(await api.get(base(project.id), { params: { includeRetired: true } }))).list).toHaveLength(1);
      const revise = await api.post(`${endpoint}/revisions`, { data: revisionBody(retired) });
      expect(revise.status()).toBe(409);
      expect(await read(project.id, proposal.requirement.id)).toEqual(retired);
      const archived = await api.delete(`/api/projects/${project.id}`);
      expect(archived.ok(), await archived.text()).toBe(true);
      expect((await api.get(endpoint)).status()).toBe(404);
    } finally { await deleteProjects(api, [project.id]); }
  });

  test("NREQ-A-12 the same built application with preview disabled reads truthfully and refuses every proposal mutation", async () => {
    const disabledOrigin = process.env.E2E_NATIVE_REQUIREMENTS_DISABLED_API_URL;
    expect(disabledOrigin, "requires the explicit default-off companion of the isolated CI backend").toBeTruthy();
    const disabled = await requests.newContext({ baseURL: disabledOrigin!, storageState: path.join(__dirname, "../.auth/state-screens.json") });
    const project = await createProject(api);
    try {
      const proposal = await create(project.id);
      const list = await json(await disabled.get(base(project.id)));
      expect(list.capability).toMatchObject({ enabled: false, canStageCaseProposals: false, canApprove: false, canPublishCases: false });
      const endpoint = `${base(project.id)}/${proposal.requirement.id}`;
      for (const [route, data] of [
        [base(project.id), content()], [endpoint + "/revisions", revisionBody(proposal)],
        [endpoint + "/links", { submissionKey: randomUUID(), ...basis(proposal), testcaseId: randomUUID(), testcaseRevision: "a".repeat(64), testcaseApprovalRevision: null }],
        [endpoint + `/links/${randomUUID()}/retire`, {}],
        [endpoint + "/case-proposals", { ...basis(proposal), requestKey: randomUUID(), operations: [{ opType: "create", draft: { title: "Must remain absent" } }] }],
        [endpoint + "/retire", { expectedVersionId: proposal.requirement.currentVersion.id, expectedContentDigest: proposal.requirement.currentVersion.contentDigest }],
        [endpoint + `/revisions/${proposal.requirement.currentVersion.id}/approve`, { expectedContentDigest: proposal.requirement.currentVersion.contentDigest }],
      ] as const) {
        const refused = await disabled.post(route, { data });
        expect(await json(refused, 501)).toMatchObject({ code: "capability_unavailable" });
      }
      expect(await read(project.id, proposal.requirement.id)).toEqual(proposal);
      expect((await json(await api.get(base(project.id)))).total).toBe(1);
    } finally { await disabled.dispose(); await deleteProjects(api, [project.id]); }
  });

  test("NREQ-A-13 concurrent case submissions retain every candidate in one shared task and replay adds none", async () => {
    const project = await createProject(api);
    try {
      const proposal = await create(project.id);
      const endpoint = `${base(project.id)}/${proposal.requirement.id}/case-proposals`;
      const submissions = ["First author's candidate", "Second author's candidate"].map(title => ({
        ...basis(proposal), requestKey: randomUUID(), title,
        operations: [{ opType: "create", draft: { title: `${title} ${randomUUID()}` } }],
      }));
      const responses = await Promise.all(submissions.map(data => api.post(endpoint, { data })));
      const accepted = await Promise.all(responses.map(response => json(response, 201)));
      for (const result of accepted) {
        expect(result.taskId).toBe(proposal.requirement.taskId);
        expect(result.task.proposalSubmission).toMatchObject({ operationId: expect.any(String), replayed: false });
      }
      const taskPath = `/api/projects/${project.id}/agents/zyra/tasks/${proposal.requirement.taskId}`;
      const beforeReplay = await json(await api.get(taskPath));
      expect(beforeReplay.proposalSnapshot.operations.map((operation: any) => operation.draft.title).sort())
        .toEqual(submissions.map(submission => submission.operations[0].draft.title).sort());
      expect(beforeReplay.proposalSnapshot.stagedOperations.filter((operation: any) => operation.operationKind === "testcase_revision")).toHaveLength(2);
      for (const [index, submission] of submissions.entries()) {
        const replay = await json(await api.post(endpoint, { data: submission }), 201);
        expect(replay.taskId).toBe(proposal.requirement.taskId);
        expect(replay.task.proposalSubmission).toEqual({ operationId: accepted[index].task.proposalSubmission.operationId, replayed: true });
      }
      const collision = await api.post(endpoint, { data: {
        ...submissions[0], operations: [{ opType: "create", draft: { title: "Attempted replacement under an accepted key" } }],
      } });
      expect(collision.status(), await collision.text()).toBe(409);
      expect((await collision.json()).code).toBe("PROPOSAL_REQUEST_CONFLICT");
      const afterReplay = await json(await api.get(taskPath));
      expect(afterReplay.proposalSnapshot).toEqual(beforeReplay.proposalSnapshot);
      expect(afterReplay.proposalRevision).toBe(beforeReplay.proposalRevision);
      expect((await read(project.id, proposal.requirement.id)).caseProposals).toHaveLength(1);
      expect(await json(await api.get(`/api/projects/${project.id}/testcases`))).toEqual([]);
      expect(afterReplay.publicationBlocked.code).toBe("SKILL_CONTEXT_UNAVAILABLE");
    } finally { await deleteProjects(api, [project.id]); }
  });

  test("NREQ-A-14 stale reviewed indexes cannot edit or discard another candidate after the shared proposal changes", async () => {
    const project = await createProject(api);
    try {
      const proposal = await create(project.id);
      const titles = ["First", "Intended", "Must remain"].map(name => `E2E ${name} candidate ${randomUUID()}`);
      const staged = await json(await api.post(`${base(project.id)}/${proposal.requirement.id}/case-proposals`, { data: {
        ...basis(proposal), requestKey: randomUUID(), title: "Review before changing a candidate",
        operations: titles.map(title => ({ opType: "create", draft: { title } })),
      } }), 201);
      const taskPath = `/api/projects/${project.id}/agents/zyra/tasks/${staged.taskId}`;
      const reviewed = await json(await api.get(taskPath));
      const invalidReviewParams: Array<Record<string, string>> = [{}, { expectedProposalRevision: "not-a-review-revision" }];
      for (const params of invalidReviewParams) {
        expect(await json(await api.patch(`${taskPath}/drafts/1`, { params, data: { title: "Unreviewed edit" } }), 400))
          .toMatchObject({ code: "PROPOSAL_REVIEW_REQUIRED" });
        expect(await json(await api.delete(`${taskPath}/drafts/1`, { params }), 400))
          .toMatchObject({ code: "PROPOSAL_REVIEW_REQUIRED" });
      }
      expect((await json(await api.get(taskPath))).proposalSnapshot).toEqual(reviewed.proposalSnapshot);

      // Another tab removes index zero. The first tab's index one now names a different case.
      const removed = await json(await api.delete(`${taskPath}/drafts/0`, {
        params: { expectedProposalRevision: reviewed.proposalRevision },
      }));
      expect(removed.drafts.map((draft: any) => draft.title)).toEqual(titles.slice(1));
      expect(removed.proposalRevision).not.toBe(reviewed.proposalRevision);
      const staleParams = { expectedProposalRevision: reviewed.proposalRevision };
      expect(await json(await api.patch(`${taskPath}/drafts/1`, { params: staleParams, data: { title: "Wrong candidate must not change" } }), 409))
        .toMatchObject({ code: "PROPOSAL_REVIEW_CONFLICT" });
      expect(await json(await api.delete(`${taskPath}/drafts/1`, { params: staleParams }), 409))
        .toMatchObject({ code: "PROPOSAL_REVIEW_CONFLICT" });
      const afterRefusal = await json(await api.get(taskPath));
      expect(afterRefusal.proposalSnapshot).toEqual(removed.proposalSnapshot);
      expect(afterRefusal.proposalRevision).toBe(removed.proposalRevision);

      const edited = await json(await api.patch(`${taskPath}/drafts/0`, {
        params: { expectedProposalRevision: removed.proposalRevision }, data: { title: `${titles[1]} reviewed edit` },
      }));
      expect(edited.drafts.map((draft: any) => draft.title)).toEqual([`${titles[1]} reviewed edit`, titles[2]]);
      // The shared review also covers the requirement basis, even when no case index moves.
      await json(await api.post(`${base(project.id)}/${proposal.requirement.id}/revisions`, {
        data: revisionBody(proposal, { description: "Requirement context changed in another tab." }),
      }), 201);
      const changedBasis = await json(await api.get(taskPath));
      expect(changedBasis.proposalRevision).not.toBe(edited.proposalRevision);
      expect(await json(await api.delete(`${taskPath}/drafts/0`, {
        params: { expectedProposalRevision: edited.proposalRevision },
      }), 409)).toMatchObject({ code: "PROPOSAL_REVIEW_CONFLICT" });
      expect((await json(await api.get(taskPath))).proposalSnapshot).toEqual(changedBasis.proposalSnapshot);
      const current = await json(await api.delete(`${taskPath}/drafts/0`, {
        params: { expectedProposalRevision: changedBasis.proposalRevision },
      }));
      expect(current.drafts.map((draft: any) => draft.title)).toEqual([titles[2]]);
      expect(current.proposalSnapshot.stagedOperations).toEqual(expect.arrayContaining(edited.proposalSnapshot.stagedOperations));
      expect(current.publicationBlocked.code).toBe("SKILL_CONTEXT_UNAVAILABLE");
      expect(await json(await api.get(`/api/projects/${project.id}/testcases`))).toEqual([]);
    } finally { await deleteProjects(api, [project.id]); }
  });
});
