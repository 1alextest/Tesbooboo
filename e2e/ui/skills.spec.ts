import { expect, request as newRequest, test, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { env } from "../utils/env";
import { exec, literal, scalar } from "../utils/psql";
import { issueMcpTestToken } from "../utils/mcp-access";
import { loginAs, provisionRbacTenant, rbacSuiteSkipReason, writeStorageState, type RbacTenant } from "../utils/rbac-tenant";

/*
 * Governed Skills operator surface. The owner configures approved skill versions and project
 * assignments from the native Settings tab; an API credential (standing in for the coding agent)
 * stages a typed bundle; the owner reviews and applies it from the native task page.
 *
 * The DB readback distinguishes fixture setup from the human decisions: candidates and submissions
 * are UI actions, staging is the agent's token, and apply/approval are the owner's human session.
 */
test.describe("governed skills operator journey (UI)", () => {
  let tenant: RbacTenant | null = null;
  let ownerApi: APIRequestContext;
  let qaApi: APIRequestContext;
  const states = new Map<string, string>();

  test.beforeAll(async () => {
    tenant = await provisionRbacTenant("skills-ui");
    if (!tenant) return;
    ownerApi = await loginAs(tenant.owner);
    qaApi = await loginAs(tenant.qa);
    states.set("owner", await writeStorageState(tenant.owner, "skills-ui-owner"));
    states.set("qa", await writeStorageState(tenant.qa, "skills-ui-qa"));
  });

  test.afterAll(async () => {
    if (ownerApi) await ownerApi.dispose();
    if (qaApi) await qaApi.dispose();
  });

  test.beforeEach(() => {
    const reason = rbacSuiteSkipReason(tenant);
    test.skip(reason !== null, reason ?? "");
  });

  async function open(browser: Browser, path: string, as: "owner" | "qa" = "owner"): Promise<Page> {
    const context = await browser.newContext({ storageState: states.get(as) });
    const page = await context.newPage();
    await page.goto(`/projects/${tenant!.mainProjectId}${path}`);
    return page;
  }

  function base() {
    return `/api/projects/${tenant!.mainProjectId}`;
  }

  async function apiSkill(module: string, subtype: string, operation: string) {
    const created = await ownerApi.post(`${base()}/skills`, { data: {
      title: `API governed skill ${operation} ${randomUUID()}`, module, subtype,
      skillKey: `SKL-${randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`,
      instructions: "Require observable outcomes and exact reviewed sources."
    } });
    expect(created.ok(), await created.text()).toBe(true);
    const doc = await created.json();
    const submitted = await ownerApi.post(`${base()}/knowledge-base/documents/${doc.id}/submissions`, {
      data: { expectedRevision: doc.editRevision, submissionKey: randomUUID() }
    });
    expect(submitted.ok(), await submitted.text()).toBe(true);
    const version = await submitted.json();
    const approved = await ownerApi.patch(`${base()}/skills/${doc.id}/approve`, { data: { versionId: version.id } });
    expect(approved.ok(), await approved.text()).toBe(true);
    const approval = await approved.json();
    const assignment = await ownerApi.post(`${base()}/skill-assignments`, { data: {
      skillDocumentId: doc.id, versionId: approval.approvedVersionId, module, subtype, operation
    } });
    expect(assignment.ok(), await assignment.text()).toBe(true);
    return { documentId: doc.id as string, submittedVersionId: version.id as string, approvedVersionId: approval.approvedVersionId as string, assignmentId: String((await assignment.json()).assignment.id) };
  }

  async function uiSkill(page: Page, title: string, key: string, module: string, subtype: string) {
    await page.getByTestId("skill-title").fill(title);
    await page.getByTestId("skill-key").fill(key);
    await page.getByTestId("skill-module").selectOption(module);
    await page.getByTestId("skill-subtype").fill(subtype);
    await page.getByTestId("skill-instructions").fill("Author requirements with observable criteria and exact citations.");
    await page.getByTestId("skill-create-submit").click();
    await expect(page.getByText(/Skill candidate submitted as version/)).toBeVisible();
    const card = page.locator('[data-testid^="skill-"]').filter({ hasText: title }).first();
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: /Approve submitted v/ }).click();
    await expect(page.getByText(new RegExp(`Approved ${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`))).toBeVisible();
  }

  test("owner configures skills and assignments, an agent stages, and the owner publishes the exact bundle", async ({ browser }) => {
    const suffix = Date.now();
    const requirementTitle = `UI requirement skill ${suffix}`;
    const requirementKey = `REQ-UI-${String(suffix).slice(-6)}`;
    const caseTitle = `UI case skill ${suffix}`;
    const caseKey = `TC-UI-${String(suffix).slice(-6)}`;
    let taskId = "";
    let requirementId = "";
    const skillDocs: string[] = [];
    try {
      const page = await open(browser, "/settings/skills");
      await expect(page.getByTestId("skills-settings")).toBeVisible();

      await uiSkill(page, requirementTitle, requirementKey, "requirements", "functional");
      await uiSkill(page, caseTitle, caseKey, "test_cases", "manual");
      const createdSkills = scalar(`SELECT COALESCE(string_agg(id::text, ','),'') FROM knowledge_documents
        WHERE project_id=${literal(tenant!.mainProjectId)} AND document_type='skill'
          AND title IN (${literal(requirementTitle)},${literal(caseTitle)});`);
      if (createdSkills) skillDocs.push(...createdSkills.split(","));

      const assign = async (key: string, module: string, subtype: string, operation: string) => {
        await page.getByTestId("skill-assignment-skill").selectOption({ label: `${key} (${module}/${subtype})` });
        await page.getByTestId("skill-assignment-module").fill(module);
        await page.getByTestId("skill-assignment-subtype").fill(subtype);
        await page.getByTestId("skill-assignment-operation").fill(operation);
        await page.getByTestId("skill-assign").click();
        await expect(page.getByText(/Assigned /)).toBeVisible();
      };
      await assign(requirementKey, "requirements", "functional", "requirement_revision");
      await assign(requirementKey, "requirements", "functional", "requirement_case_link");
      await assign(caseKey, "test_cases", "manual", "testcase_create");
      for (const operation of ["requirement_revision", "requirement_case_link", "testcase_create"]) {
        await expect(page.getByTestId(`skill-readiness-${operation}`)).toContainText("Effective");
      }

      const tokenResponse = await issueMcpTestToken(ownerApi, `${base()}/apikeys`, { data: {
        name: `Skills UI agent ${suffix}`, scopes: ["read", "write"]
      } });
      expect(tokenResponse.ok(), await tokenResponse.text()).toBe(true);
      const token = await tokenResponse.json();
      const mcp = await newRequest.newContext({ baseURL: env.apiBaseUrl, storageState: { cookies: [], origins: [] } });
      try {
        const requirementOperationId = randomUUID(), testcaseOperationId = randomUUID();
        const stagedResponse = await mcp.post(`${base()}/mcp`, {
          headers: { Authorization: `Bearer ${token.token}` },
          data: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "stage_requirement_change_bundle", arguments: {
            requestKey: `skills-ui-agent-${suffix}`, title: `Agent bundle ${suffix}`,
            operations: [
              { opType: "requirement_revision", operationId: requirementOperationId, title: `Governed requirement ${suffix}`,
                description: "Staged by the agent credential.", criteria: [{ key: "AC-1", text: "The obligation is observable" }] },
              { opType: "testcase_create", operationId: testcaseOperationId, draft: { title: `Governed case ${suffix}` } },
              { opType: "requirement_case_link", operationId: randomUUID(), requirementOperationId, testcaseOperationId, criterionKeys: ["AC-1"] }
            ]
          } } }
        });
        expect(stagedResponse.ok(), await stagedResponse.text()).toBe(true);
        const stagedBody = await stagedResponse.json();
        expect(stagedBody.error, JSON.stringify(stagedBody.error)).toBeUndefined();
        const staged = JSON.parse(stagedBody.result.content[0].text);
        taskId = staged.taskId;
        expect(staged.skillContext).toMatchObject({ status: "resolved" });
        expect(staged.task.proposalRevision).toMatch(/^[a-f0-9]{64}$/);

        const taskPage = await open(browser, `/agents/tasks/${taskId}`);
        const panel = taskPage.getByTestId("requirement-change-bundle");
        await expect(panel).toBeVisible();
        await expect(panel.getByTestId("requirement-bundle-skills")).toContainText("requirements/functional/requirement_revision");
        const apply = panel.getByTestId("requirement-bundle-apply");
        await expect(apply).toBeVisible();
        await apply.click();
        await expect(apply).toHaveCount(0);
        await expect(taskPage.getByText(/Requirement change bundle applied as an immutable submitted version/)).toBeVisible();

        const caseName = `Governed case ${suffix}`;
        const requirementName = `Governed requirement ${suffix}`;
        requirementId = scalar(`SELECT id FROM knowledge_documents WHERE project_id=${literal(tenant!.mainProjectId)} AND title=${literal(requirementName)};`);
        expect(requirementId).not.toBe("");
        expect(scalar(`SELECT COUNT(*)::int FROM knowledge_document_versions WHERE document_id=${literal(requirementId)} AND snapshot_kind='submitted';`)).toBe("1");
        expect(scalar(`SELECT status FROM testcases WHERE project_id=${literal(tenant!.mainProjectId)} AND title=${literal(caseName)};`)).toBe("Draft");
        expect(scalar(`SELECT COUNT(*)::int FROM requirement_case_links WHERE project_id=${literal(tenant!.mainProjectId)} AND requirement_id=${literal(requirementId)} AND state='active';`)).toBe("1");

        const receipt = JSON.parse(scalar(`SELECT (SELECT value FROM jsonb_array_elements(save_events) WHERE value->>'action'='requirement_bundle_apply' LIMIT 1)::text FROM ai_generation_requests WHERE id=${literal(taskId)};`) || "null");
        expect(receipt, "apply receipt").toBeTruthy();
        expect(receipt.reviewerId).toBe(tenant!.owner.userId);
        expect(receipt.proposalRevision).toBe(staged.task.proposalRevision);
        expect(receipt.skillContext).toMatchObject({ status: "resolved" });
        expect(receipt.skillContext.assignments).toHaveLength(3);
        expect(receipt.requirement.documentId).toBe(requirementId);

        const approved = await ownerApi.post(`${base()}/requirements/${requirementId}/approve`, { data: { versionId: receipt.requirement.versionId } });
        expect(approved.ok(), await approved.text()).toBe(true);
        const approvedVersion = JSON.parse(scalar(`SELECT row_to_json(v)::text FROM knowledge_document_versions v
          JOIN knowledge_documents d ON d.id=v.document_id AND d.reviewed_version_id=v.id
          WHERE d.id=${literal(requirementId)};`));
        expect(approvedVersion.snapshot_kind).toBe("approved");
        expect(approvedVersion.snapshot_metadata.actorId).toBe(tenant!.owner.userId);
        expect(approvedVersion.snapshot_metadata.actorKind).toBe("human_session");
        expect(approvedVersion.snapshot_metadata.sourceVersionId).toBe(receipt.requirement.versionId);

        const coverage = await (await ownerApi.get(`${base()}/requirements/${requirementId}/coverage`)).json();
        expect(coverage.readings).toMatchObject({ authored: true, approved: false, executed: false, passing: false });
      } finally {
        await mcp.dispose();
      }
    } finally {
      if (taskId) exec(`DELETE FROM ai_generation_requests WHERE id=${literal(taskId)} AND project_id=${literal(tenant!.mainProjectId)};`);
      if (requirementId) {
        exec(`DELETE FROM requirement_case_links WHERE project_id=${literal(tenant!.mainProjectId)} AND requirement_id=${literal(requirementId)};`);
        exec(`DELETE FROM requirement_profiles WHERE document_id=${literal(requirementId)};`);
        exec(`UPDATE knowledge_documents SET reviewed_version_id=NULL WHERE id=${literal(requirementId)};`);
        exec(`DELETE FROM knowledge_documents WHERE id=${literal(requirementId)} AND project_id=${literal(tenant!.mainProjectId)};`);
      }
      exec(`DELETE FROM testcases WHERE project_id=${literal(tenant!.mainProjectId)} AND title=${literal(`Governed case ${suffix}`)};`);
      for (const id of skillDocs) {
        exec(`UPDATE knowledge_documents SET reviewed_version_id=NULL WHERE id=${literal(id)};`);
        exec(`DELETE FROM knowledge_documents WHERE id=${literal(id)} AND project_id=${literal(tenant!.mainProjectId)};`);
      }
    }
  });

  test("approval of the wrong revision and unauthorized assignment changes are refused", async ({ browser }) => {
    const suffix = Date.now();
    const skill = await apiSkill("requirements", "functional", "requirement_revision");
    try {
      const wrong = await ownerApi.patch(`${base()}/skills/${skill.documentId}/approve`, { data: { versionId: randomUUID() } });
      expect(wrong.status()).toBe(400);

      const qaAssign = await qaApi.post(`${base()}/skill-assignments`, { data: {
        skillDocumentId: skill.documentId, versionId: skill.approvedVersionId,
        module: "requirements", subtype: "functional", operation: "requirement_case_link"
      } });
      expect(qaAssign.status()).toBe(403);
      const qaApprove = await qaApi.patch(`${base()}/skills/${skill.documentId}/approve`, { data: { versionId: skill.submittedVersionId } });
      expect(qaApprove.status()).toBe(403);
      const qaRevoke = await qaApi.patch(`${base()}/skill-assignments/${skill.assignmentId}/deactivate`, { data: {} });
      expect(qaRevoke.status()).toBe(403);

      const page = await open(browser, "/settings/skills", "qa");
      await expect(page.getByTestId("skills-settings")).toBeVisible();
      await expect(page.getByTestId("skill-assignment-form")).toHaveCount(0);
      await expect(page.getByTestId(`skill-assignment-${skill.assignmentId}`)).toBeVisible();
      await expect(page.getByTestId(`skill-revoke-${skill.assignmentId}`)).toHaveCount(0);
      await expect(page.locator('[data-testid^="skill-approve-"]')).toHaveCount(0);
    } finally {
      exec(`UPDATE knowledge_documents SET reviewed_version_id=NULL WHERE id=${literal(skill.documentId)};`);
      exec(`DELETE FROM knowledge_documents WHERE id=${literal(skill.documentId)} AND project_id=${literal(tenant!.mainProjectId)};`);
    }
  });
});
