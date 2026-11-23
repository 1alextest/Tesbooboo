import { expect, request as newRequest, test, type APIRequestContext, type APIResponse, type Browser, type BrowserContext, type Page } from "@playwright/test";
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
  const openedContexts = new Set<BrowserContext>();

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

  test.afterEach(async () => {
    // Each attempt owns its pages; old QA/owner pages must not pollute later failure artifacts.
    for (const context of openedContexts) await context.close();
  });

  test.beforeEach(() => {
    const reason = rbacSuiteSkipReason(tenant);
    test.skip(reason !== null, reason ?? "");
  });

  async function open(browser: Browser, path: string, as: "owner" | "qa" = "owner"): Promise<Page> {
    const context = await browser.newContext({ storageState: states.get(as) });
    openedContexts.add(context);
    context.on("close", () => openedContexts.delete(context));
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

  async function createSkillDoc(title: string, key: string, instructions: string, api: APIRequestContext = ownerApi) {
    const created = await api.post(`${base()}/skills`, { data: {
      title, module: "requirements", subtype: "functional", skillKey: key, instructions
    } });
    expect(created.ok(), await created.text()).toBe(true);
    return created.json();
  }

  async function submitDoc(doc: { id: string; editRevision: string }) {
    const submitted = await ownerApi.post(`${base()}/knowledge-base/documents/${doc.id}/submissions`, {
      data: { expectedRevision: doc.editRevision, submissionKey: randomUUID() }
    });
    expect(submitted.ok(), await submitted.text()).toBe(true);
    return submitted.json();
  }

  async function updateDoc(doc: { id: string; title: string }, instructions: string) {
    const updated = await ownerApi.patch(`${base()}/knowledge-base/documents/${doc.id}`, { data: {
      contentJson: { schemaVersion: "tesbo-skill/1", module: "requirements", subtype: "functional", instructions },
      contentText: `${doc.title}\n\n${instructions}`,
      contentHtml: `<h1>${doc.title}</h1><pre>${instructions}</pre>`
    } });
    expect(updated.ok(), await updated.text()).toBe(true);
    return updated.json() as Promise<{ id: string; title: string; editRevision: string }>;
  }

  async function approveDoc(documentId: string, versionId: string) {
    const approved = await ownerApi.patch(`${base()}/skills/${documentId}/approve`, { data: { versionId } });
    expect(approved.ok(), await approved.text()).toBe(true);
    const receipt = await approved.json();
    const snapshot = await ownerApi.get(`${base()}/knowledge-base/documents/${documentId}/versions/${receipt.approvedVersionId}`);
    expect(snapshot.ok(), await snapshot.text()).toBe(true);
    const version = await snapshot.json();
    expect(version.id).not.toBe(versionId);
    expect(version).toMatchObject({ snapshotKind: "approved", snapshotMetadata: { sourceVersionId: versionId } });
    return version;
  }

  async function assignDoc(documentId: string, versionId: string, operation: string) {
    const assigned = await ownerApi.post(`${base()}/skill-assignments`, { data: {
      skillDocumentId: documentId, versionId, module: "requirements", subtype: "functional", operation
    } });
    expect(assigned.ok(), await assigned.text()).toBe(true);
    return assigned.json();
  }

  /** Three submissions, with separate approved snapshots: a1 assigned, a2 unassigned. */
  async function reviewFixture() {
    const suffix = randomUUID();
    const title = `Review fixture ${suffix}`;
    const key = `REV-${suffix.replaceAll("-", "").slice(0, 10).toUpperCase()}`;
    const baseRule = "RULE-BASE: state the role, test data and observable result.";
    const doc = await createSkillDoc(title, key, baseRule);
    try {
      const v1 = await submitDoc(doc);
      const a1 = await approveDoc(doc.id, v1.id);
      const assignment = await assignDoc(doc.id, a1.id, "requirement_revision");
      const v2Doc = await updateDoc(doc, `${baseRule}\nRULE-V2-ONLY: require the reviewer to inspect the previous version.`);
      const v2 = await submitDoc(v2Doc);
      const a2 = await approveDoc(doc.id, v2.id);
      const v3Doc = await updateDoc(doc, `${baseRule}\nRULE-V3: reject stale approvals and name the unchanged assignment.`);
      const v3 = await submitDoc(v3Doc);
      return { documentId: doc.id as string, title, key, v1, v2, v3, a1, a2, assignmentId: String(assignment.assignment.id) };
    } catch (error) {
      await cleanupSkill(doc.id);
      throw error;
    }
  }

  async function cleanupSkill(documentId: string) {
    exec(`UPDATE knowledge_documents SET reviewed_version_id=NULL WHERE id=${literal(documentId)};`);
    exec(`DELETE FROM knowledge_documents WHERE id=${literal(documentId)} AND project_id=${literal(tenant!.mainProjectId)};`);
  }

  function candidateRecoveryState(documentId: string, title: string) {
    return JSON.parse(scalar(`SELECT jsonb_build_object(
      'documentIds', (SELECT COALESCE(jsonb_agg(id ORDER BY id), '[]'::jsonb) FROM knowledge_documents
        WHERE project_id=${literal(tenant!.mainProjectId)} AND document_type='skill' AND title=${literal(title)}),
      'profileCount', (SELECT COUNT(*) FROM skill_profiles WHERE project_id=${literal(tenant!.mainProjectId)} AND document_id=d.id),
      'submittedCount', (SELECT COUNT(*) FROM knowledge_document_versions WHERE document_id=d.id AND snapshot_kind='submitted'),
      'approvedCount', (SELECT COUNT(*) FROM knowledge_document_versions WHERE document_id=d.id AND snapshot_kind='approved'),
      'assignmentCount', (SELECT COUNT(*) FROM skill_assignments WHERE project_id=${literal(tenant!.mainProjectId)} AND skill_document_id=d.id),
      'reviewedVersionId', d.reviewed_version_id,
      'payload', jsonb_build_object('id',d.id,'title',d.title,'contentJson',d.content_json,
        'contentText',d.content_text,'contentHtml',d.content_html,'skillKey',p.skill_key,'module',p.module,'subtype',p.subtype)
      )::text FROM knowledge_documents d JOIN skill_profiles p ON p.document_id=d.id
      WHERE d.id=${literal(documentId)} AND d.project_id=${literal(tenant!.mainProjectId)};`));
  }

  async function cleanupCandidatesWithTitle(title: string) {
    // If the regression creates a duplicate, clean up every uniquely named test candidate too.
    const ids = scalar(`SELECT COALESCE(string_agg(id::text, ','), '') FROM knowledge_documents
      WHERE project_id=${literal(tenant!.mainProjectId)} AND document_type='skill' AND title=${literal(title)};`);
    for (const id of ids.split(",").filter(Boolean)) await cleanupSkill(id);
  }

  async function fillCandidate(page: Page, title: string, key: string, instructions: string) {
    await page.getByTestId("skill-title").fill(title);
    await page.getByTestId("skill-key").fill(key);
    await page.getByTestId("skill-module").selectOption("requirements");
    await page.getByTestId("skill-subtype").fill("functional");
    await page.getByTestId("skill-instructions").fill(instructions);
  }

  /** Delay one real immutable-version response; subsequent requests remain independent. */
  async function holdVersion(page: Page, documentId: string, versionId: string) {
    const url = `/knowledge-base/documents/${documentId}/versions/${versionId}`;
    let release!: () => void;
    let reached!: () => void;
    let held = false;
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    const seen = new Promise<void>((resolve) => { reached = resolve; });
    await page.route(`**${url}`, async (route) => {
      if (!held) {
        held = true;
        reached();
        await barrier;
      }
      await route.continue();
    });
    return { url, seen, release };
  }

  async function releaseVersion(page: Page, gate: Awaited<ReturnType<typeof holdVersion>>) {
    const received = page.waitForResponse((response) => response.url().endsWith(gate.url));
    gate.release();
    await (await received).finished();
    // Allow the response callback and React commit to finish; no arbitrary timing sleep.
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
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
    await card.getByRole("button", { name: /Review submitted v/ }).click();
    await expect(page.getByTestId("skill-review-content")).toContainText("Author requirements with observable criteria and exact citations.");
    await page.getByTestId("skill-review-panel").getByTestId("skill-review-approve").click();
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

  test("owner reopens, approves and reads coverage from the task surface while QA, stale and lost responses stay truthful", async ({ browser }) => {
    const suffix = Date.now();
    const title = `Task review requirement ${suffix}`;
    const caseTitle = `Task review case ${suffix}`;
    const skillDocs: string[] = [];
    const cycleIds: string[] = [];
    let taskId = "";
    let requirementId = "";
    let requirementVersionId = "";
    let caseId = "";
    try {
      // Fixture setup through the same native API the product uses; the review itself is the UI.
      const requirementSkill = await apiSkill("requirements", "functional", "requirement_revision");
      skillDocs.push(requirementSkill.documentId);
      const linkSkill = await apiSkill("requirements", "functional", "requirement_case_link");
      skillDocs.push(linkSkill.documentId);
      const caseSkill = await apiSkill("test_cases", "manual", "testcase_create");
      skillDocs.push(caseSkill.documentId);

      const requirementOperationId = randomUUID(), testcaseOperationId = randomUUID();
      const stagedResponse = await ownerApi.post(`${base()}/requirements/proposals`, { data: {
        requestKey: `ui-task-review-${suffix}`, title: `UI task review bundle ${suffix}`,
        operations: [
          { opType: "requirement_revision", operationId: requirementOperationId, title,
            description: "Fixture for the task review surface.", criteria: [{ key: "AC-1", text: "The obligation is observable" }] },
          { opType: "testcase_create", operationId: testcaseOperationId, draft: { title: caseTitle } },
          { opType: "requirement_case_link", operationId: randomUUID(), requirementOperationId, testcaseOperationId, criterionKeys: ["AC-1"] }
        ]
      } });
      expect(stagedResponse.ok(), await stagedResponse.text()).toBe(true);
      const staged = await stagedResponse.json();
      taskId = staged.id;
      expect(staged.skillContext).toMatchObject({ status: "resolved" });
      const appliedResponse = await ownerApi.post(`${base()}/requirements/proposals/${taskId}/apply`, { data: { expectedProposalRevision: staged.proposalRevision } });
      expect(appliedResponse.ok(), await appliedResponse.text()).toBe(true);
      const applied = await appliedResponse.json();
      requirementId = applied.receipt.requirement.documentId;
      requirementVersionId = applied.receipt.requirement.versionId;
      caseId = applied.receipt.testcase.id;

      const page = await open(browser, `/agents/tasks/${taskId}`);
      const review = page.getByTestId("requirement-review-panel");
      await expect(review).toBeVisible();
      await expect(review.getByTestId("requirement-review-version")).toContainText(requirementVersionId);
      await expect(review.getByTestId("requirement-review-criteria")).toContainText("The obligation is observable");
      await expect(review.getByTestId("requirement-review-approve")).toBeVisible();
      await expect(review.getByTestId("requirement-coverage-readings")).toContainText("Authored: yes");
      await expect(review.getByTestId("requirement-coverage-readings")).toContainText("Approved: no");
      await expect(review.getByTestId("requirement-coverage-case-link")).toHaveAttribute("href", new RegExp(`testcases\\?search=${encodeURIComponent(caseTitle)}`));

      // Reload reopens the exact version from the persisted task receipt.
      await page.reload();
      await expect(page.getByTestId("requirement-review-version")).toContainText(requirementVersionId);
      await expect(page.getByTestId("requirement-review-approve")).toBeVisible();

      // A reader can inspect the review and the coverage but cannot approve.
      const qaPage = await open(browser, `/agents/tasks/${taskId}`, "qa");
      await expect(qaPage.getByTestId("requirement-review-readonly")).toBeVisible();
      await expect(qaPage.getByTestId("requirement-review-approve")).toHaveCount(0);
      const qaApprove = await qaApi.post(`${base()}/requirements/${requirementId}/approve`, { data: { versionId: requirementVersionId } });
      expect(qaApprove.status()).toBe(403);
      await qaPage.close();

      // A failed exact-version load disables approval and offers a retry; approval returns only
      // after the required content loads successfully.
      const versionEndpoint = `**/api/projects/${tenant!.mainProjectId}/knowledge-base/documents/${requirementId}/versions/${requirementVersionId}`;
      await page.route(versionEndpoint, (route) => route.fulfill({ status: 503, json: { error: "Version read unavailable" } }));
      await page.reload();
      await expect(page.getByTestId("requirement-review-error")).toBeVisible();
      await expect(page.getByTestId("requirement-review-approve")).toHaveCount(0);
      await page.unroute(versionEndpoint);
      await page.getByTestId("requirement-review-retry").click();
      await expect(page.getByTestId("requirement-review-approve")).toBeVisible();

      // Stale: the document moved on after the version was submitted. The old version is refused,
      // and the UI does not claim approval.
      const changed = await ownerApi.patch(`${base()}/knowledge-base/documents/${requirementId}`, { data: { title: `${title} changed` } });
      expect(changed.ok(), await changed.text()).toBe(true);
      await page.getByTestId("requirement-review-approve").click();
      await expect(page.getByTestId("requirement-review-approval-error")).toContainText("changed after this version was submitted");
      await expect(page.getByTestId("requirement-review-approved")).toHaveCount(0);
      expect(scalar(`SELECT COUNT(*)::int FROM knowledge_document_versions WHERE document_id=${literal(requirementId)} AND snapshot_kind='approved';`)).toBe("0");
      const restored = await ownerApi.patch(`${base()}/knowledge-base/documents/${requirementId}`, { data: { title } });
      expect(restored.ok(), await restored.text()).toBe(true);

      // Lost approval response: hold the reconciliation read so the unconfirmed state is stable,
      // then prove the single commit is visible only after the authoritative re-read.
      let holdContent = false;
      let releaseContent!: () => void;
      let contentHeld!: () => void;
      const held = new Promise<void>((resolve) => { contentHeld = resolve; });
      const release = new Promise<void>((resolve) => { releaseContent = resolve; });
      const documentEndpoint = `**/api/projects/${tenant!.mainProjectId}/knowledge-base/documents/${requirementId}`;
      const approveEndpoint = `**/api/projects/${tenant!.mainProjectId}/requirements/${requirementId}/approve`;
      await page.route(documentEndpoint, async (route) => {
        if (!holdContent) return route.continue();
        holdContent = false;
        contentHeld();
        await release;
        return route.continue();
      });
      await page.route(approveEndpoint, async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        const actual = await route.fetch();
        expect(actual.ok(), await actual.text()).toBe(true);
        holdContent = true;
        await route.abort("failed");
      });
      await page.getByTestId("requirement-review-approve").click();
      await held;
      await expect(page.getByTestId("requirement-review-approval-error")).toContainText("could not be confirmed");
      await expect(page.getByTestId("requirement-review-approved")).toHaveCount(0);
      releaseContent();
      await expect(page.getByTestId("requirement-review-approved")).toBeVisible();
      await expect(page.getByTestId("requirement-review-approval-error")).toHaveCount(0);
      expect(scalar(`SELECT COUNT(*)::int FROM knowledge_document_versions WHERE document_id=${literal(requirementId)} AND snapshot_kind='approved' AND snapshot_metadata->>'sourceVersionId'=${literal(requirementVersionId)};`)).toBe("1");
      await page.unroute(documentEndpoint);
      await page.unroute(approveEndpoint);

      // Coverage follows the persisted state: approving the case and re-applying its exact basis
      // turns approved/executed/passing on, with a link to the real execution evidence.
      const caseBefore = await (await ownerApi.get(`${base()}/testcases/${caseId}`)).json();
      const approvedCase = await ownerApi.post(`${base()}/testcases/${caseId}/approve`, {
        data: { expectedRevision: caseBefore.editRevision, expectedApprovalRevision: caseBefore.approvalRevision }
      });
      expect(approvedCase.ok(), await approvedCase.text()).toBe(true);
      const caseAfter = await (await ownerApi.get(`${base()}/testcases/${caseId}`)).json();
      const beforeReapply = await (await ownerApi.get(`${base()}/requirements/${requirementId}/coverage`)).json();
      const link = beforeReapply.cases.find((item: Record<string, any>) => item.requirementVersionId === beforeReapply.approvedVersionId) || beforeReapply.cases[0];
      const reapplied = await ownerApi.post(`${base()}/requirements/${requirementId}/links/${link.linkId}/reapply`, {
        data: { expectedCaseRevision: caseAfter.editRevision, expectedApprovalRevision: caseAfter.approvalRevision }
      });
      expect(reapplied.ok(), await reapplied.text()).toBe(true);
      const runId = scalar(`INSERT INTO cycles(project_id,name) VALUES (${literal(tenant!.mainProjectId)},${literal(`UI review coverage ${suffix}`)}) RETURNING id;`);
      cycleIds.push(runId);
      const itemId = scalar(`INSERT INTO cycle_items(cycle_id,testcase_id,snapshot_approval_revision) VALUES (${literal(runId)},${literal(caseId)},${literal(caseAfter.approvalRevision)}) RETURNING id;`);
      const executionId = scalar(`INSERT INTO executions(cycle_item_id,status,executed_by,executed_at)
        SELECT ${literal(itemId)},'Passed',pm.user_id,now() FROM project_members pm
         WHERE pm.project_id=${literal(tenant!.mainProjectId)}
         ORDER BY CASE pm.role WHEN 'owner' THEN 0 ELSE 1 END, pm.user_id LIMIT 1 RETURNING id;`);
      await page.reload();
      await expect(page.getByTestId("requirement-coverage-readings")).toContainText("Approved: yes");
      await expect(page.getByTestId("requirement-coverage-readings")).toContainText("Executed: yes");
      await expect(page.getByTestId("requirement-coverage-readings")).toContainText("Passing: yes");
      await expect(page.getByTestId("requirement-coverage-execution-link")).toHaveAttribute("href", new RegExp(`cycles/${runId}/execute/${executionId}`));

      // A successful zero and an unavailable read are different states.
      exec(`UPDATE requirement_case_links SET state='retired' WHERE project_id=${literal(tenant!.mainProjectId)} AND requirement_id=${literal(requirementId)};`);
      await page.reload();
      await expect(page.getByTestId("requirement-coverage-empty")).toBeVisible();
      await expect(page.getByTestId("requirement-coverage-unavailable")).toHaveCount(0);

      const coverageEndpoint = `**/api/projects/${tenant!.mainProjectId}/requirements/${requirementId}/coverage`;
      await page.route(coverageEndpoint, (route) => route.fulfill({ status: 503, json: { error: "Coverage service unavailable" } }));
      await page.reload();
      await expect(page.getByTestId("requirement-coverage-unavailable")).toBeVisible();
      await expect(page.getByTestId("requirement-coverage-empty")).toHaveCount(0);
      await page.unroute(coverageEndpoint);
      await page.getByTestId("requirement-coverage-retry").click();
      await expect(page.getByTestId("requirement-coverage-empty")).toBeVisible();

      // The supporting-case link lands on the repository with the case search applied.
      const search = encodeURIComponent(caseTitle);
      await page.goto(`/projects/${tenant!.mainProjectId}/testcases?search=${search}`);
      await expect(page.getByPlaceholder("Search by ID, title, or type")).toHaveValue(caseTitle);
      await expect(page.getByText(caseTitle).first()).toBeVisible();
      await page.getByRole("button", { name: "Clear search" }).click();
      await expect(page.getByPlaceholder("Search by ID, title, or type")).toHaveValue("");
      await expect(page).not.toHaveURL(/[?&]search=/);
    } finally {
      if (taskId) exec(`DELETE FROM ai_generation_requests WHERE id=${literal(taskId)} AND project_id=${literal(tenant!.mainProjectId)};`);
      if (requirementId) {
        exec(`DELETE FROM requirement_case_links WHERE project_id=${literal(tenant!.mainProjectId)} AND requirement_id=${literal(requirementId)};`);
        exec(`DELETE FROM requirement_profiles WHERE document_id=${literal(requirementId)};`);
        exec(`UPDATE knowledge_documents SET reviewed_version_id=NULL WHERE id=${literal(requirementId)};`);
        exec(`DELETE FROM knowledge_documents WHERE id=${literal(requirementId)} AND project_id=${literal(tenant!.mainProjectId)};`);
      }
      // Executions reference cycle items, and cycle items reference the case; tear those down
      // before deleting the case itself.
      for (const id of cycleIds) {
        exec(`DELETE FROM executions WHERE cycle_item_id IN (SELECT id FROM cycle_items WHERE cycle_id=${literal(id)});`);
        exec(`DELETE FROM cycle_items WHERE cycle_id=${literal(id)};`);
        exec(`DELETE FROM cycles WHERE id=${literal(id)} AND project_id=${literal(tenant!.mainProjectId)};`);
      }
      exec(`DELETE FROM testcases WHERE project_id=${literal(tenant!.mainProjectId)} AND title=${literal(caseTitle)};`);
      for (const id of skillDocs) {
        exec(`DELETE FROM skill_assignments WHERE project_id=${literal(tenant!.mainProjectId)} AND skill_document_id=${literal(id)};`);
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

  test("a duplicate skill key is refused without creating a second candidate", async () => {
    const suffix = Date.now();
    const skillKey = `PILOT-DUP-${String(suffix).slice(-8)}`;
    const firstTitle = `Pilot key owner ${suffix}`;
    const secondTitle = `Pilot duplicate ${suffix}`;
    let documentId = "";
    try {
      const first = await ownerApi.post(`${base()}/skills`, { data: {
        title: firstTitle, module: "requirements", subtype: "functional", skillKey,
        instructions: "Require observable criteria and an unchanged-state result for rejected transitions."
      } });
      expect(first.ok(), await first.text()).toBe(true);
      documentId = (await first.json()).id;
      const duplicate = await ownerApi.post(`${base()}/skills`, { data: {
        title: secondTitle, module: "requirements", subtype: "functional", skillKey,
        instructions: "This second candidate must never exist."
      } });
      expect(duplicate.status()).toBe(409);
      expect(await duplicate.json()).toMatchObject({ code: "SKILL_KEY_CONFLICT" });
      expect(scalar(`SELECT COUNT(*)::int FROM skill_profiles WHERE project_id=${literal(tenant!.mainProjectId)} AND skill_key=${literal(skillKey)};`)).toBe("1");
      expect(scalar(`SELECT COUNT(*)::int FROM knowledge_documents WHERE project_id=${literal(tenant!.mainProjectId)} AND title IN (${literal(firstTitle)},${literal(secondTitle)});`)).toBe("1");
    } finally {
      if (documentId) {
        exec(`UPDATE knowledge_documents SET reviewed_version_id=NULL WHERE id=${literal(documentId)};`);
        exec(`DELETE FROM knowledge_documents WHERE id=${literal(documentId)} AND project_id=${literal(tenant!.mainProjectId)};`);
      }
    }
  });

  for (const keyMode of ["explicit", "automatic"] as const) {
    test(`a saved candidate with an ${keyMode} key recovers submission failure without another creation`, async ({ browser }) => {
      const suffix = randomUUID();
      const title = `Submission recovery ${keyMode} ${suffix}`;
      const instructions = "RULE-RECOVERY: preserve this saved candidate and its exact instructions when submission fails.";
      const key = keyMode === "explicit" ? `RECOVER-${suffix.slice(0, 8)}` : "";
      let page: Page | undefined;
      let createRequests = 0;
      let submitRequests = 0;
      try {
        page = await open(browser, "/settings/skills");
        page.on("request", (request) => {
          if (request.method() === "POST" && new URL(request.url()).pathname === `${base()}/skills`) createRequests++;
        });
        await page.route("**/knowledge-base/documents/*/submissions", async (route) => {
          if (route.request().method() !== "POST") return route.continue();
          submitRequests++;
          if (submitRequests === 1) {
            // Creation reached the real API; this first submission definitely did not.
            return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Injected submission unavailable" }) });
          }
          await route.continue();
        });
        await fillCandidate(page, title, key, instructions);
        const created = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === `${base()}/skills`);
        const refused = page.waitForResponse((response) => response.url().endsWith("/submissions") && response.status() === 503);
        await page.getByTestId("skill-create-submit").click();
        const response = await created;
        expect(response.ok(), await response.text()).toBe(true);
        const documentId = String((await response.json()).id);
        await refused;
        const saved = candidateRecoveryState(documentId, title);
        expect(saved).toMatchObject({ documentIds: [documentId], profileCount: 1, submittedCount: 0,
          approvedCount: 0, assignmentCount: 0, reviewedVersionId: null });

        // The page must expose the committed candidate before a reload, then recover from native
        // state after reload rather than depending on an in-memory create response.
        const card = page.getByTestId(`skill-${documentId}`);
        await expect(card).toBeVisible();
        for (const field of ["skill-title", "skill-key", "skill-instructions"]) {
          await expect(page.getByTestId(field)).toHaveValue("");
        }
        await expect(page.getByTestId("skill-create-submit")).toBeDisabled();
        await page.reload();
        await expect(card).toBeVisible();
        const submitted = page.waitForResponse((result) => result.request().method() === "POST" && result.url().endsWith(`/documents/${documentId}/submissions`));
        await card.getByRole("button", { name: "Submit draft", exact: true }).click();
        const submission = await submitted;
        expect(submission.ok(), await submission.text()).toBe(true);
        await expect(card.getByRole("button", { name: /Review submitted v/ })).toBeVisible();
        expect(createRequests).toBe(1);
        expect(submitRequests).toBe(2);
        expect(candidateRecoveryState(documentId, title)).toEqual({ ...saved, submittedCount: 1 });
        await card.getByRole("button", { name: /Review submitted v/ }).click();
        await expect(page.getByTestId("skill-review-content")).toContainText(instructions);
      } finally {
        await page?.context().close();
        await cleanupCandidatesWithTitle(title);
      }
    });
  }

  for (const failReconciliationRead of [false, true]) {
    test(`a lost submission response ${failReconciliationRead ? "waits for an available read before reconciling" : "reconciles"} the saved candidate without replaying writes`, async ({ browser }) => {
      const title = `Lost submission ${randomUUID()}`;
      const instructions = "RULE-LOST-SUBMISSION: inspect the real submitted snapshot before attempting another write.";
      let page: Page | undefined;
      let createRequests = 0;
      let submitRequests = 0;
      let blockLibraryReads = false;
      let refusedReads = 0;
      let submittedVersionId = "";
      let release!: () => void;
      let committed!: () => void;
      const delivery = new Promise<void>((resolve) => { release = resolve; });
      const receiptWritten = new Promise<void>((resolve) => { committed = resolve; });
      try {
        page = await open(browser, "/settings/skills");
        await expect(page.getByText("Loading skills…", { exact: true })).toHaveCount(0);
        page.on("request", (request) => {
          if (request.method() === "POST" && new URL(request.url()).pathname === `${base()}/skills`) createRequests++;
        });
        await page.route(`**${base()}/skills`, async (route) => {
          if (route.request().method() === "GET" && blockLibraryReads) {
            refusedReads++;
            return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Injected reconciliation unavailable" }) });
          }
          await route.continue();
        });
        await page.route("**/knowledge-base/documents/*/submissions", async (route) => {
          if (route.request().method() !== "POST") return route.continue();
          submitRequests++;
          const actual = await route.fetch();
          expect(actual.ok(), await actual.text()).toBe(true);
          submittedVersionId = String((await actual.json()).id);
          committed();
          await delivery;
          await route.abort("failed");
        });
        await fillCandidate(page, title, "", instructions);
        const created = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === `${base()}/skills`);
        await page.getByTestId("skill-create-submit").click();
        const response = await created;
        expect(response.ok(), await response.text()).toBe(true);
        const documentId = String((await response.json()).id);
        await receiptWritten;
        const committedState = candidateRecoveryState(documentId, title);
        expect(committedState).toMatchObject({ documentIds: [documentId], profileCount: 1, submittedCount: 1,
          approvedCount: 0, assignmentCount: 0, reviewedVersionId: null });
        await expect(page.getByTestId("skill-create-submit")).toBeDisabled();
        for (const field of ["skill-title", "skill-key", "skill-module", "skill-subtype", "skill-instructions"]) {
          await expect(page.getByTestId(field)).toBeDisabled();
        }
        blockLibraryReads = failReconciliationRead;
        release();

        const card = page.getByTestId(`skill-${documentId}`);
        if (failReconciliationRead) {
          await expect(page.getByTestId("skill-library-unavailable")).toBeVisible();
          await expect(page.getByRole("button", { name: "Submit draft", exact: true })).toHaveCount(0);
          const refresh = page.getByTestId("skill-readiness").getByRole("button", { name: "Refresh" });
          const refusedRead = page.waitForResponse((result) => result.request().method() === "GET" && new URL(result.url()).pathname === `${base()}/skills` && result.status() === 503);
          await refresh.click();
          await refusedRead;
          await expect(refresh).toBeEnabled();
          await expect(page.getByTestId("skill-library-unavailable")).toBeVisible();
          expect(refusedReads).toBeGreaterThanOrEqual(2);
          expect(createRequests).toBe(1);
          expect(submitRequests).toBe(1);
          expect(candidateRecoveryState(documentId, title)).toEqual(committedState);
          blockLibraryReads = false;
          await refresh.click();
        }
        await expect(card.getByRole("button", { name: /Review submitted v/ })).toBeVisible();
        await expect(card.getByRole("button", { name: "Submit draft", exact: true })).toHaveCount(0);
        await page.reload();
        await expect(card.getByRole("button", { name: /Review submitted v/ })).toBeVisible();
        expect(createRequests).toBe(1);
        expect(submitRequests).toBe(1);
        expect(candidateRecoveryState(documentId, title)).toEqual(committedState);
        const library = await ownerApi.get(`${base()}/skills`);
        expect(library.ok(), await library.text()).toBe(true);
        expect((await library.json()).skills.find((skill: { id: string }) => skill.id === documentId)).toMatchObject({
          submittedVersionId, approvedVersionId: null, assignments: []
        });
        await card.getByRole("button", { name: /Review submitted v/ }).click();
        await expect(page.getByTestId("skill-review-content")).toContainText(instructions);
      } finally {
        release();
        await page?.context().close();
        await cleanupCandidatesWithTitle(title);
      }
    });
  }

  test("a delayed native draft read after a lost submission response resumes the original receipt after reload", async ({ browser }) => {
    const title = `Delayed draft recovery ${randomUUID()}`;
    const instructions = "RULE-DELAYED-DRAFT: a resumed submission must retain its original receipt and one audit entry.";
    let page: Page | undefined;
    let draftResponse: APIResponse | undefined;
    let replayDraft = false;
    let draftReadDeliveries = 0;
    let createRequests = 0;
    let submitRequests = 0;
    let originalReceipt: { id: string; versionNumber: number } | undefined;
    let release!: () => void;
    let committed!: () => void;
    const delivery = new Promise<void>((resolve) => { release = resolve; });
    const receiptWritten = new Promise<void>((resolve) => { committed = resolve; });
    try {
      page = await open(browser, "/settings/skills");
      await expect(page.getByText("Loading skills…", { exact: true })).toHaveCount(0);
      page.on("request", (request) => {
        if (request.method() === "POST" && new URL(request.url()).pathname === `${base()}/skills`) createRequests++;
      });
      await page.route(`**${base()}/skills`, async (route) => {
        if (route.request().method() === "GET" && replayDraft && draftResponse) {
          draftReadDeliveries++;
          // Deliver the intact native response captured below before the first submission. This
          // models a late read; no Skill, version, timestamp or response body is manufactured.
          return route.fulfill({ response: draftResponse });
        }
        await route.continue();
      });
      await page.route("**/knowledge-base/documents/*/submissions", async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        submitRequests++;
        if (submitRequests === 1) {
          const documentId = new URL(route.request().url()).pathname.split("/").at(-2)!;
          draftResponse = await ownerApi.get(`${base()}/skills`);
          expect(draftResponse.ok(), await draftResponse.text()).toBe(true);
          const draft = (await draftResponse.json()).skills.find((skill: { id: string }) => skill.id === documentId);
          expect(draft).toMatchObject({ id: documentId, title, submittedVersionId: null,
            approvedVersionId: null, versions: [], assignments: [] });
          const actual = await route.fetch();
          expect(actual.ok(), await actual.text()).toBe(true);
          originalReceipt = await actual.json();
          committed();
          await delivery;
          return route.abort("failed");
        }
        const actual = await route.fetch();
        replayDraft = false;
        await route.fulfill({ response: actual });
      });
      await fillCandidate(page, title, "", instructions);
      const created = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === `${base()}/skills`);
      await page.getByTestId("skill-create-submit").click();
      const response = await created;
      expect(response.ok(), await response.text()).toBe(true);
      const documentId = String((await response.json()).id);
      await receiptWritten;
      const committedState = candidateRecoveryState(documentId, title);
      expect(committedState).toMatchObject({ documentIds: [documentId], profileCount: 1, submittedCount: 1,
        approvedCount: 0, assignmentCount: 0, reviewedVersionId: null });
      const submissionAudits = () => JSON.parse(scalar(`SELECT COALESCE(jsonb_agg(
        jsonb_build_object('id', id, 'versionId', diff->>'versionId') ORDER BY id), '[]'::jsonb)::text
        FROM audit_logs WHERE project_id=${literal(tenant!.mainProjectId)} AND entity_id=${literal(documentId)}
          AND entity_type='knowledge_document' AND action='submitted';`));
      const originalAudits = submissionAudits();
      expect(originalAudits).toHaveLength(1);
      expect(originalAudits[0]).toMatchObject({ versionId: originalReceipt!.id });
      for (const field of ["skill-title", "skill-key", "skill-module", "skill-subtype", "skill-instructions"]) {
        await expect(page.getByTestId(field)).toBeDisabled();
      }
      replayDraft = true;
      release();
      const card = page.getByTestId(`skill-${documentId}`);
      await expect(card.getByRole("button", { name: "Submit draft", exact: true })).toBeVisible();
      await page.reload();
      await expect(card.getByRole("button", { name: "Submit draft", exact: true })).toBeVisible();
      expect(draftReadDeliveries).toBeGreaterThanOrEqual(2);
      const resumed = page.waitForResponse((result) => result.request().method() === "POST" && result.url().endsWith(`/documents/${documentId}/submissions`));
      await card.getByRole("button", { name: "Submit draft", exact: true }).click();
      const replay = await resumed;
      expect(replay.ok(), await replay.text()).toBe(true);
      expect(await replay.json()).toMatchObject({ id: originalReceipt!.id, versionNumber: originalReceipt!.versionNumber });
      await expect(card.getByRole("button", { name: /Review submitted v/ })).toBeVisible();
      expect(createRequests).toBe(1);
      expect(submitRequests).toBe(2);
      expect(candidateRecoveryState(documentId, title)).toEqual(committedState);
      expect(submissionAudits()).toEqual(originalAudits);
      await card.getByRole("button", { name: /Review submitted v/ }).click();
      await expect(page.getByTestId("skill-review-content")).toContainText(instructions);
    } finally {
      release();
      await page?.context().close();
      await cleanupCandidatesWithTitle(title);
    }
  });

  test("QA can submit their own writable draft but cannot submit another creator's or a read-only candidate", async ({ browser }) => {
    const suffix = randomUUID().slice(0, 8);
    const records: { id: string; title: string; editRevision: string }[] = [];
    let page: Page | undefined;
    try {
      const own = await createSkillDoc(`QA own draft ${suffix}`, `QA-OWN-${suffix}`, "RULE-QA: submit my saved candidate without approving or assigning it.", qaApi);
      records.push(own);
      const other = await createSkillDoc(`Other creator draft ${suffix}`, `QA-OTHER-${suffix}`, "RULE-OTHER: only the existing native mutation authority can submit this candidate.");
      records.push(other);
      const readOnly = await createSkillDoc(`QA read-only draft ${suffix}`, `QA-MIRROR-${suffix}`, "RULE-MIRROR: provider-owned content remains read-only.", qaApi);
      records.push(readOnly);
      // Provider sync sets these native fields. As in the existing KB-A-48 fixture, arrange only
      // this disposable candidate; no live integration or foreign project record is changed.
      exec(`UPDATE knowledge_documents SET is_read_only=true, source_provider='jira'
        WHERE id=${literal(readOnly.id)} AND project_id=${literal(tenant!.mainProjectId)};`);
      const mirror = await qaApi.get(`${base()}/knowledge-base/documents/${readOnly.id}`);
      expect(mirror.ok(), await mirror.text()).toBe(true);
      const nativeMirror = await mirror.json();
      expect(nativeMirror).toMatchObject({ id: readOnly.id, isReadOnly: true, sourceProvider: "jira" });
      const ownBefore = candidateRecoveryState(own.id, own.title);
      const otherBefore = candidateRecoveryState(other.id, other.title);
      const mirrorBefore = candidateRecoveryState(readOnly.id, readOnly.title);
      for (const state of [ownBefore, otherBefore, mirrorBefore]) {
        expect(state).toMatchObject({ submittedCount: 0, approvedCount: 0, assignmentCount: 0, reviewedVersionId: null });
      }
      page = await open(browser, "/settings/skills", "qa");
      const ownCard = page.getByTestId(`skill-${own.id}`);
      await expect(ownCard.getByRole("button", { name: "Submit draft", exact: true })).toBeEnabled();
      await expect(page.getByTestId(`skill-${other.id}`)).toBeVisible();
      await expect(page.getByTestId(`skill-${other.id}`).getByRole("button", { name: "Submit draft", exact: true })).toHaveCount(0);
      await expect(page.getByTestId(`skill-${readOnly.id}`)).toBeVisible();
      await expect(page.getByTestId(`skill-${readOnly.id}`).getByRole("button", { name: "Submit draft", exact: true })).toHaveCount(0);

      const foreign = await qaApi.post(`${base()}/knowledge-base/documents/${other.id}/submissions`, {
        data: { expectedRevision: other.editRevision, submissionKey: randomUUID() }
      });
      expect(foreign.status()).toBe(403);
      expect(await foreign.json()).toMatchObject({ error: "You can only modify items you created" });
      const mirrored = await qaApi.post(`${base()}/knowledge-base/documents/${readOnly.id}/submissions`, {
        data: { expectedRevision: nativeMirror.editRevision, submissionKey: randomUUID() }
      });
      expect(mirrored.status()).toBe(400);
      expect((await mirrored.json()).error).toContain("its body can't be edited");
      const submitted = page.waitForResponse((response) => response.request().method() === "POST" && response.url().endsWith(`/documents/${own.id}/submissions`));
      await ownCard.getByRole("button", { name: "Submit draft", exact: true }).click();
      const receipt = await submitted;
      expect(receipt.ok(), await receipt.text()).toBe(true);
      await expect(ownCard.getByRole("button", { name: /Review submitted v/ })).toBeVisible();
      expect(candidateRecoveryState(own.id, own.title)).toEqual({ ...ownBefore, submittedCount: 1 });
      expect(candidateRecoveryState(other.id, other.title)).toEqual(otherBefore);
      expect(candidateRecoveryState(readOnly.id, readOnly.title)).toEqual(mirrorBefore);
      await ownCard.getByRole("button", { name: /Review submitted v/ }).click();
      await expect(page.getByTestId("skill-review-content")).toContainText("RULE-QA");
      await expect(page.getByTestId("skill-review-approve")).toHaveCount(0);
      await expect(page.getByTestId("skill-assignment-form")).toHaveCount(0);
    } finally {
      await page?.context().close();
      for (const record of records) await cleanupSkill(record.id);
    }
  });

  test("owner reviews submitted content against prior and active approved snapshots without changing assignments", async ({ browser }) => {
    const fixture = await reviewFixture();
    try {
      const page = await open(browser, "/settings/skills");
      await page.getByTestId(`skill-review-open-${fixture.documentId}`).click();
      const panel = page.getByTestId("skill-review-panel");
      await expect(panel).toBeVisible();
      await expect(page.getByTestId("skill-review-content")).toContainText("RULE-V3");
      await expect(page.getByTestId("skill-review-content")).not.toContainText("RULE-V2-ONLY");
      await expect(page.getByTestId("skill-review-version")).toContainText(`v${fixture.v3.versionNumber}`);
      await expect(page.getByTestId("skill-timeline")).toContainText(`v${fixture.v2.versionNumber}`);
      await expect(page.getByTestId("skill-review-assignments")).toContainText(`v${fixture.a1.versionNumber} active`);

      await page.getByTestId("skill-review-compare-previous").click();
      const diff = page.locator('[data-testid="skill-diff"]');
      await expect(diff.locator('[data-diff="remove"]').filter({ hasText: "RULE-V2-ONLY" }).first()).toBeVisible();
      await expect(diff.locator('[data-diff="add"]').filter({ hasText: "RULE-V3" }).first()).toBeVisible();

      await page.getByTestId("skill-compare-target").selectOption("active");
      await expect(page.getByTestId("skill-compare-context")).toBeVisible();
      await page.getByTestId("skill-compare-target-run").click();
      await expect(page.locator('[data-testid="skill-diff"]')).toContainText(`v${fixture.a1.versionNumber}`);

      await page.getByTestId("skill-review-approve").click();
      await expect(page.getByText(new RegExp(`Approved .* version ${fixture.v3.versionNumber}`))).toBeVisible();
      const library = await (await ownerApi.get(`${base()}/skills`)).json();
      const skill = library.skills.find((entry: { id: string }) => entry.id === fixture.documentId);
      expect(skill.approvedVersionId).not.toBe(fixture.v3.id);
      expect(skill.versions.find((entry: { id: string }) => entry.id === skill.approvedVersionId))
        .toMatchObject({ kind: "approved", sourceVersionId: fixture.v3.id });
      const ledger = await (await ownerApi.get(`${base()}/skill-assignments`)).json();
      const active = ledger.list.filter((entry: { skillDocumentId: string; status: string }) => entry.skillDocumentId === fixture.documentId && entry.status === "active");
      expect(active).toHaveLength(1);
      expect(active[0].skillVersionId).toBe(fixture.a1.id);
      await expect(page.getByTestId(`skill-${fixture.documentId}`)).not.toContainText("awaiting review");
      await expect(page.getByTestId("skill-review-approve")).toHaveCount(0);
      await expect(page.getByTestId("skill-review-panel")).toContainText(`Approved as v${skill.versions.find((entry: { id: string }) => entry.id === skill.approvedVersionId).versionNumber}`);
    } finally {
      await cleanupSkill(fixture.documentId);
    }
  });

  test("a first submission explains there is no earlier version and a QA reader cannot approve", async ({ browser }) => {
    const suffix = randomUUID();
    const doc = await createSkillDoc(`First submission ${suffix}`, `FIRST-${suffix.replaceAll("-", "").slice(0, 8).toUpperCase()}`,
      "RULE-FIRST: state the required role and one observable result.");
    const version = await submitDoc(doc);
    try {
      const page = await open(browser, "/settings/skills", "qa");
      await page.getByTestId(`skill-review-open-${doc.id}`).click();
      await expect(page.getByTestId("skill-review-content")).toContainText("RULE-FIRST");
      await expect(page.getByTestId("skill-review-first")).toContainText("no earlier version");
      await expect(page.getByTestId("skill-review-approve")).toHaveCount(0);
      await expect(page.getByTestId("skill-timeline")).toContainText(`v${version.versionNumber}`);
    } finally {
      await cleanupSkill(doc.id);
    }
  });

  test("a failed content load has a retry, and a newer submission refuses the stale approval", async ({ browser }) => {
    const suffix = randomUUID();
    const doc = await createSkillDoc(`Stale review ${suffix}`, `STALE-${suffix.replaceAll("-", "").slice(0, 8).toUpperCase()}`,
      "RULE-V1: the first submitted rule.");
    const v1 = await submitDoc(doc);
    try {
      const page = await open(browser, "/settings/skills");
      await page.route(`**/knowledge-base/documents/${doc.id}/versions/${v1.id}`, (route) => route.fulfill({
        status: 500, contentType: "application/json", body: JSON.stringify({ error: "Injected content load failure" })
      }));
      await page.getByTestId(`skill-review-open-${doc.id}`).click();
      await expect(page.getByTestId("skill-review-error")).toContainText("Injected content load failure");
      await page.unroute(`**/knowledge-base/documents/${doc.id}/versions/${v1.id}`);
      await page.getByTestId("skill-review-retry").click();
      await expect(page.getByTestId("skill-review-content")).toContainText("RULE-V1");

      const v2Doc = await updateDoc(doc, "RULE-V2: a newer submission replaced the reviewed content.");
      const v2 = await submitDoc(v2Doc);
      // The typed refusal still identifies the exact replacement if library refresh fails.
      await page.route(`**${base()}/skills`, (route) => route.fulfill({
        status: 503, contentType: "application/json", body: JSON.stringify({ error: "Injected library refresh failure" })
      }));
      await page.getByTestId("skill-review-approve").click();
      await expect(page.getByTestId("skill-review-superseded")).toBeVisible();
      await expect(page.getByTestId("skill-library-unavailable")).toBeVisible();
      await expect(page.getByTestId("skill-history-unavailable")).toBeVisible();
      await expect(page.getByTestId("skill-readiness-requirement_revision")).toContainText("Unavailable");
      await page.getByTestId("skill-review-current").click();
      await expect(page.getByTestId("skill-review-content")).toContainText("RULE-V2");
      await expect(page.getByTestId("skill-review-approve")).toBeDisabled();
      await page.unroute(`**${base()}/skills`);
      await page.getByTestId("skill-readiness").getByRole("button", { name: "Refresh" }).click();
      await expect(page.getByTestId("skill-review-approve")).toBeEnabled();
      await page.getByTestId("skill-review-approve").click();
      await expect(page.getByText(new RegExp(`Approved .* version ${v2.versionNumber}`))).toBeVisible();
      const library = await (await ownerApi.get(`${base()}/skills`)).json();
      const skill = library.skills.find((entry: { id: string }) => entry.id === doc.id);
      expect(skill.approvedVersionId).not.toBe(v2.id);
      expect(skill.versions.find((entry: { id: string }) => entry.id === skill.approvedVersionId))
        .toMatchObject({ kind: "approved", sourceVersionId: v2.id });
    } finally {
      await cleanupSkill(doc.id);
    }
  });

  test("different active versions across contexts are selectable for comparison", async ({ browser }) => {
    const suffix = randomUUID();
    const doc = await createSkillDoc(`Context compare ${suffix}`, `CTX-${suffix.replaceAll("-", "").slice(0, 8).toUpperCase()}`,
      "RULE-CTX-V1: base context rule.");
    try {
      const v1 = await submitDoc(doc);
      const a1 = await approveDoc(doc.id, v1.id);
      await assignDoc(doc.id, a1.id, "requirement_revision");
      const v2Doc = await updateDoc(doc, "RULE-CTX-V2: linked-case context rule.");
      const v2 = await submitDoc(v2Doc);
      const a2 = await approveDoc(doc.id, v2.id);
      await assignDoc(doc.id, a2.id, "requirement_case_link");
      const v3Doc = await updateDoc(doc, "RULE-CTX-V3: candidate rule.");
      await submitDoc(v3Doc);
      const page = await open(browser, "/settings/skills");
      await page.getByTestId(`skill-review-open-${doc.id}`).click();
      await expect(page.getByTestId("skill-review-assignments")).toContainText(`v${a1.versionNumber} active`);
      await expect(page.getByTestId("skill-review-assignments")).toContainText(`v${a2.versionNumber} active`);
      await page.getByTestId("skill-compare-target").selectOption("active");
      const context = page.getByTestId("skill-compare-context");
      await expect(context.locator("option")).toHaveCount(2);
      const labels = await context.locator("option").allTextContents();
      await context.selectOption({ label: labels.find((label) => label.includes("requirement_case_link"))! });
      await page.getByTestId("skill-compare-target-run").click();
      await expect(page.locator('[data-testid="skill-diff"]')).toContainText(`v${a2.versionNumber}`);
      await context.selectOption({ label: labels.find((label) => label.includes("requirement_revision"))! });
      await page.getByTestId("skill-compare-target-run").click();
      await expect(page.locator('[data-testid="skill-diff"]')).toContainText(`v${a1.versionNumber}`);
      await expect(page.getByTestId("skill-diff")).toContainText("Active version for requirements / functional / requirement_revision");
      await assignDoc(doc.id, a2.id, "requirement_revision");
      const refresh = page.getByTestId("skill-readiness").getByRole("button", { name: "Refresh" });
      await refresh.click();
      await expect(refresh).toBeEnabled();
      await expect(page.getByTestId("skill-diff")).toHaveCount(0);
      await expect(page.getByTestId("skill-review-assignments")).not.toContainText(`v${a1.versionNumber} active`);
      await page.getByTestId("skill-compare-target-run").click();
      await expect(page.getByTestId("skill-diff")).toContainText(`v${a2.versionNumber}`);
    } finally {
      await cleanupSkill(doc.id);
    }
  });
  test("late review responses cannot replace a different Skill or a reopened review", async ({ browser }) => {
    const suffix = randomUUID().slice(0, 8);
    const a = await createSkillDoc(`Held review A ${suffix}`, `HOLD-A-${suffix}`, "RULE-HELD-A: belongs only to Skill A.");
    let b: { id: string } | undefined;
    let page: Page | undefined;
    let gate: Awaited<ReturnType<typeof holdVersion>> | undefined;
    try {
      const av = await submitDoc(a);
      b = await createSkillDoc(`Current review B ${suffix}`, `HOLD-B-${suffix}`, "RULE-CURRENT-B: belongs only to Skill B.");
      await submitDoc(b as { id: string; editRevision: string });
      page = await open(browser, "/settings/skills");
      for (const closeFirst of [false, true]) {
        await test.step(closeFirst ? "Close held A, reopen B, then deliver A" : "Switch from held A to B, then deliver A", async () => {
          gate = await holdVersion(page!, a.id, av.id);
          await page!.getByTestId(`skill-review-open-${a.id}`).click();
          await gate.seen;
          if (closeFirst) await page!.getByRole("button", { name: "Close review" }).click();
          await page!.getByTestId(`skill-review-open-${b!.id}`).click();
          await expect(page!.getByTestId("skill-review-content")).toContainText("RULE-CURRENT-B");
          await releaseVersion(page!, gate);
          await expect(page!.getByTestId("skill-review-panel").getByRole("heading", { level: 2 })).toContainText(`Current review B ${suffix}`);
          await expect(page!.getByTestId("skill-review-content")).toContainText("RULE-CURRENT-B");
          await expect(page!.getByTestId("skill-review-content")).not.toContainText("RULE-HELD-A");
          await page!.unroute(`**${gate.url}`);
        });
      }
    } finally {
      gate?.release();
      await page?.context().close();
      await cleanupSkill(a.id);
      if (b) await cleanupSkill(b.id);
    }
  });

  test("late comparison and full-version reads cannot overwrite the selected versions", async ({ browser }) => {
    const fixture = await reviewFixture();
    let page: Page | undefined;
    let gate: Awaited<ReturnType<typeof holdVersion>> | undefined;
    try {
      page = await open(browser, "/settings/skills");
      await page.getByTestId(`skill-review-open-${fixture.documentId}`).click();
      await expect(page.getByTestId("skill-diff")).toBeVisible();
      gate = await holdVersion(page, fixture.documentId, fixture.a1.id);
      await page.getByTestId("skill-compare-target").selectOption("active");
      await page.getByTestId("skill-compare-target-run").click();
      await gate.seen;
      await page.getByTestId("skill-compare-target").selectOption("latestApproved");
      await page.getByTestId("skill-compare-target-run").click();
      await expect(page.getByTestId("skill-diff")).toContainText(`v${fixture.a2.versionNumber}`);
      await releaseVersion(page, gate);
      await expect(page.getByTestId("skill-diff")).toContainText(`v${fixture.a2.versionNumber}`);
      await expect(page.getByTestId("skill-diff")).toContainText("Latest approved version");
      await page.unroute(`**${gate.url}`);

      gate = await holdVersion(page, fixture.documentId, fixture.v1.id);
      await page.getByTestId(`skill-version-open-${fixture.v1.id}`).click();
      await gate.seen;
      await page.getByTestId(`skill-version-open-${fixture.v2.id}`).click();
      await expect(page.getByTestId("skill-version-full")).toContainText("RULE-V2-ONLY");
      await releaseVersion(page, gate);
      await expect(page.getByTestId("skill-version-full")).toContainText(`Full v${fixture.v2.versionNumber}`);
      await expect(page.getByTestId("skill-version-full")).toContainText("RULE-V2-ONLY");
    } finally {
      gate?.release();
      await page?.context().close();
      await cleanupSkill(fixture.documentId);
    }
  });

  test("a document-edit refusal remains visible after refresh without creating approval", async ({ browser }) => {
    const suffix = randomUUID().slice(0, 8);
    const doc = await createSkillDoc(`Changed review ${suffix}`, `EDIT-${suffix}`, "RULE-SUBMITTED: inspect this exact text.");
    let page: Page | undefined;
    try {
      await submitDoc(doc);
      page = await open(browser, "/settings/skills");
      await page.getByTestId(`skill-review-open-${doc.id}`).click();
      await expect(page.getByTestId("skill-review-content")).toContainText("RULE-SUBMITTED");
      await updateDoc(doc, "RULE-EDITED: this change has not been submitted.");
      const refused = page.waitForResponse((response) => response.url().endsWith(`/skills/${doc.id}/approve`));
      await page.getByTestId("skill-review-approve").click();
      const response = await refused;
      expect(response.status()).toBe(409);
      expect(await response.json()).toMatchObject({ code: "DOCUMENT_REVISION_CONFLICT" });
      const refresh = page.getByTestId("skill-readiness").getByRole("button", { name: "Refresh" });
      await expect(refresh).toBeEnabled();
      await refresh.click();
      await expect(refresh).toBeEnabled();
      await expect(page.getByTestId("skill-review-action-error")).toContainText(/changed|submit/i);
      expect(scalar(`SELECT COUNT(*)::int FROM knowledge_document_versions WHERE document_id=${literal(doc.id)} AND snapshot_kind='approved';`)).toBe("0");
      expect(scalar(`SELECT COALESCE(reviewed_version_id::text,'') FROM knowledge_documents WHERE id=${literal(doc.id)};`)).toBe("");
      const removed = await ownerApi.delete(`${base()}/knowledge-base/documents/${doc.id}`);
      expect(removed.ok(), await removed.text()).toBe(true);
      const missing = page.waitForResponse((result) => result.url().endsWith(`/skills/${doc.id}/approve`));
      await page.getByTestId("skill-review-approve").click();
      expect((await missing).status()).toBe(404);
      await expect(page.getByTestId(`skill-${doc.id}`)).toHaveCount(0);
      await expect(page.getByTestId("skill-review-action-error")).toContainText(/not found/i);
      await page.getByRole("button", { name: "Dismiss review message" }).click();
      await expect(page.getByTestId("skill-review-action-error")).toHaveCount(0);
    } finally {
      await page?.context().close();
      await cleanupSkill(doc.id);
    }
  });

  test("a lost approval response stays unconfirmed and reconciles one actual approved snapshot", async ({ browser }) => {
    const suffix = randomUUID().slice(0, 8);
    const doc = await createSkillDoc(`Unknown approval ${suffix}`, `UNKNOWN-${suffix}`, "RULE-UNKNOWN: reconcile the server receipt before retrying.");
    let page: Page | undefined;
    let requests = 0;
    let release!: () => void;
    let committed!: () => void;
    const delivery = new Promise<void>((resolve) => { release = resolve; });
    const receiptWritten = new Promise<void>((resolve) => { committed = resolve; });
    try {
      const submitted = await submitDoc(doc);
      page = await open(browser, "/settings/skills");
      await page.getByTestId(`skill-review-open-${doc.id}`).click();
      await expect(page.getByTestId("skill-review-content")).toContainText("RULE-UNKNOWN");
      await page.route(`**/skills/${doc.id}/approve`, async (route) => {
        requests++;
        const actual = await route.fetch();
        expect(actual.ok(), await actual.text()).toBe(true);
        committed();
        await delivery;
        await route.abort("failed");
      });
      await page.getByTestId("skill-review-approve").click();
      await receiptWritten;
      await expect(page.getByRole("button", { name: "Close review" })).toBeDisabled();
      await expect(page.getByTestId(`skill-review-open-${doc.id}`)).toBeDisabled();
      release();
      await expect(page.getByTestId("skill-review-action-error")).toContainText("Request outcome unconfirmed");
      await expect(page.getByTestId("skill-review-panel")).toContainText("Approved as v");
      await expect(page.getByTestId("skill-review-approve")).toHaveCount(0);
      expect(requests).toBe(1);
      expect(scalar(`SELECT COUNT(*)::int FROM knowledge_document_versions WHERE document_id=${literal(doc.id)} AND snapshot_kind='approved' AND snapshot_metadata->>'sourceVersionId'=${literal(submitted.id)};`)).toBe("1");
    } finally {
      release();
      await page?.context().close();
      await cleanupSkill(doc.id);
    }
  });

  test("stored JSON and HTML changes are reviewable and diffed even when plain text is unchanged", async ({ browser }) => {
    const suffix = randomUUID().slice(0, 8);
    const doc = await createSkillDoc(`Stored fields ${suffix}`, `FIELDS-${suffix}`, "RULE-TEXT: unchanged plain instructions.");
    let page: Page | undefined;
    try {
      await submitDoc(doc);
      const updated = await ownerApi.patch(`${base()}/knowledge-base/documents/${doc.id}`, { data: {
        contentJson: { schemaVersion: "tesbo-skill/1", module: "requirements", subtype: "functional", instructions: "RULE-JSON-ONLY: inspect this stored change." },
        contentHtml: '<p>RULE-HTML-ONLY: inspect source safely.</p><script>window.skillReviewExecuted = true</script>'
      } });
      expect(updated.ok(), await updated.text()).toBe(true);
      await submitDoc(await updated.json());
      page = await open(browser, "/settings/skills");
      await page.getByTestId(`skill-review-open-${doc.id}`).click();
      await expect(page.getByTestId("skill-review-content")).toContainText("RULE-TEXT");
      await expect(page.getByTestId("skill-review-content")).toContainText("RULE-JSON-ONLY");
      await expect(page.getByTestId("skill-review-content")).toContainText("RULE-HTML-ONLY");
      await expect(page.getByTestId("skill-review-content")).toContainText('<p>RULE-HTML-ONLY: inspect source safely.</p><script>window.skillReviewExecuted = true</script>');
      await expect(page.getByTestId("skill-review-content").locator("p, script")).toHaveCount(0);
      await expect(page.getByTestId("skill-diff").locator('[data-diff="add"]').filter({ hasText: "RULE-JSON-ONLY" }).first()).toBeVisible();
      await expect(page.getByTestId("skill-diff").locator('[data-diff="add"]').filter({ hasText: "RULE-HTML-ONLY" }).first()).toBeVisible();
      expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).skillReviewExecuted)).toBeUndefined();

      // A stored marker-like string must remain distinguishable from an absent field.
      const marker = await ownerApi.patch(`${base()}/knowledge-base/documents/${doc.id}`, { data: { contentText: "(not stored)" } });
      expect(marker.ok(), await marker.text()).toBe(true);
      await submitDoc(await marker.json());
      const absent = await ownerApi.patch(`${base()}/knowledge-base/documents/${doc.id}`, { data: { contentText: null } });
      expect(absent.ok(), await absent.text()).toBe(true);
      await submitDoc(await absent.json());
      const refresh = page.getByTestId("skill-readiness").getByRole("button", { name: "Refresh" });
      await refresh.click();
      await expect(refresh).toBeEnabled();
      await page.getByTestId(`skill-review-open-${doc.id}`).click();
      await expect(page.getByTestId("skill-diff").locator('[data-diff="remove"]').filter({ hasText: "Plain text (stored)" })).toBeVisible();
      await expect(page.getByTestId("skill-diff").locator('[data-diff="add"]').filter({ hasText: "Plain text (not stored)" })).toBeVisible();
    } finally {
      await page?.context().close();
      await cleanupSkill(doc.id);
    }
  });

  test("stored field headings cannot hide a change between plain text and HTML", async ({ browser }) => {
    const suffix = randomUUID().slice(0, 8);
    const doc = await createSkillDoc(`Field boundaries ${suffix}`, `BOUNDARY-${suffix}`, "RULE-BOUNDARY: inspect each stored field.");
    let page: Page | undefined;
    try {
      // JSONB can reorder keys. Construct the collision from native stored JSON, not input order.
      const stored = await ownerApi.get(`${base()}/knowledge-base/documents/${doc.id}`);
      expect(stored.ok(), await stored.text()).toBe(true);
      const instructions = (await stored.json()).contentJson;
      const storedJson = JSON.stringify(instructions, null, 2);
      const boundary = `\n\nStructured instructions (JSON)\n${storedJson}\n\nHTML source (stored; displayed as text)\n`;
      const beforeText = `RULE-TEXT-START${boundary}RULE-MOVED`;
      const afterText = "RULE-TEXT-START";
      const beforeHtml = "RULE-HTML-END";
      const afterHtml = `RULE-MOVED${boundary}RULE-HTML-END`;
      const before = await ownerApi.patch(`${base()}/knowledge-base/documents/${doc.id}`, { data: {
        contentText: beforeText, contentJson: instructions, contentHtml: beforeHtml
      } });
      expect(before.ok(), await before.text()).toBe(true);
      const first = await submitDoc(await before.json());
      const after = await ownerApi.patch(`${base()}/knowledge-base/documents/${doc.id}`, { data: {
        contentText: afterText, contentJson: instructions, contentHtml: afterHtml
      } });
      expect(after.ok(), await after.text()).toBe(true);
      const second = await submitDoc(await after.json());
      for (const version of [first, second]) {
        const saved = await ownerApi.get(`${base()}/knowledge-base/documents/${doc.id}/versions/${version.id}`);
        expect(saved.ok(), await saved.text()).toBe(true);
        expect(JSON.stringify((await saved.json()).contentJson, null, 2)).toBe(storedJson);
      }
      page = await open(browser, "/settings/skills");
      await page.getByTestId(`skill-review-open-${doc.id}`).click();
      const content = page.getByTestId("skill-review-content");
      await expect(content).toContainText("RULE-TEXT-START");
      await expect(page.getByTestId("skill-diff").locator('[data-diff="remove"]').first()).toBeVisible();
      await expect(page.getByTestId("skill-diff").locator('[data-diff="add"]').first()).toBeVisible();
      await expect(content.locator('[data-skill-field="text"] pre')).toHaveText(afterText);
      await expect(content.locator('[data-skill-field="html"] pre')).toHaveText(afterHtml);
      expect(await content.locator('[data-skill-field="text"] pre').textContent()).toBe(afterText);
      expect(await content.locator('[data-skill-field="html"] pre').textContent()).toBe(afterHtml);
      await expect(content.locator("h4")).toHaveCount(5);
    } finally {
      await page?.context().close();
      await cleanupSkill(doc.id);
    }
  });

  test("long multiline versions use a bounded comparison and retain both complete contents", async ({ browser }) => {
    const suffix = randomUUID().slice(0, 8);
    const instructions = Array.from({ length: 900 }, (_, i) => `Rule ${i}`).join("\n");
    const doc = await createSkillDoc(`Long review ${suffix}`, `LONG-${suffix}`, `${instructions}\nRULE-LONG-OLD-END`);
    let page: Page | undefined;
    try {
      await submitDoc(doc);
      await submitDoc(await updateDoc(doc, `${instructions.replaceAll("Rule", "Check")}\nRULE-LONG-NEW-END`));
      page = await open(browser, "/settings/skills");
      await page.getByTestId(`skill-review-open-${doc.id}`).click();
      await expect(page.getByTestId("skill-diff-fallback")).toContainText("Full versions are shown");
      await expect(page.getByTestId("skill-diff-before")).toContainText("RULE-LONG-OLD-END");
      await expect(page.getByTestId("skill-diff-after")).toContainText("RULE-LONG-NEW-END");
      await expect(page.getByTestId("skill-review-content")).toContainText("RULE-LONG-NEW-END");
      await expect(page.getByTestId("skill-review-approve")).toBeEnabled();
    } finally {
      await page?.context().close();
      await cleanupSkill(doc.id);
    }
  });

  test("a newer submission with identical content supersedes the older ID without approval or assignment writes", async () => {
    const suffix = randomUUID().slice(0, 8);
    const doc = await createSkillDoc(`Same-content submission ${suffix}`, `SAME-${suffix}`, "RULE-SAME: content equality does not select the reviewed version.");
    try {
      const first = await submitDoc(doc);
      const currentResponse = await ownerApi.get(`${base()}/knowledge-base/documents/${doc.id}`);
      expect(currentResponse.ok(), await currentResponse.text()).toBe(true);
      const second = await submitDoc(await currentResponse.json());
      expect(first.snapshotMetadata.contentDigest).toBe(second.snapshotMetadata.contentDigest);
      const stale = await ownerApi.patch(`${base()}/skills/${doc.id}/approve`, { data: { versionId: first.id } });
      expect(stale.status()).toBe(409);
      expect(await stale.json()).toMatchObject({ code: "SKILL_VERSION_SUPERSEDED", currentVersionId: second.id, currentVersionNumber: second.versionNumber });
      expect(scalar(`SELECT COUNT(*)::int FROM knowledge_document_versions WHERE document_id=${literal(doc.id)} AND snapshot_kind='approved';`)).toBe("0");
      expect(scalar(`SELECT COALESCE(reviewed_version_id::text,'') FROM knowledge_documents WHERE id=${literal(doc.id)};`)).toBe("");
      expect(scalar(`SELECT COUNT(*)::int FROM skill_assignments WHERE skill_document_id=${literal(doc.id)};`)).toBe("0");
    } finally {
      await cleanupSkill(doc.id);
    }
  });

  test("candidate creation retries by requestKey without duplicating a candidate", async () => {
    const suffix = randomUUID();
    const title = `Idempotent creation ${suffix}`;
    const skillKey = `IDEMP-${suffix.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
    const requestKey = randomUUID();
    let documentId = "";
    try {
      const payload = { title, module: "requirements", subtype: "functional", skillKey,
        instructions: "RULE-IDEMP: require one observable outcome.", requestKey };
      const first = await ownerApi.post(`${base()}/skills`, { data: payload });
      expect(first.ok(), await first.text()).toBe(true);
      const created = await first.json();
      documentId = created.id;
      expect(created.replayed).toBe(false);

      const retry = await ownerApi.post(`${base()}/skills`, { data: payload });
      expect(retry.ok(), await retry.text()).toBe(true);
      const replayed = await retry.json();
      expect(replayed.id).toBe(documentId);
      expect(replayed.replayed).toBe(true);

      const changed = await ownerApi.post(`${base()}/skills`, { data: { ...payload, instructions: "RULE-IDEMP: different content under the same key." } });
      expect(changed.status()).toBe(409);
      expect(await changed.json()).toMatchObject({ code: "SKILL_REQUEST_CONFLICT" });
      expect(scalar(`SELECT COUNT(*)::int FROM skill_profiles WHERE project_id=${literal(tenant!.mainProjectId)} AND skill_key=${literal(skillKey)};`)).toBe("1");
      expect(scalar(`SELECT COUNT(*)::int FROM knowledge_documents WHERE project_id=${literal(tenant!.mainProjectId)} AND title=${literal(title)};`)).toBe("1");
    } finally {
      if (documentId) await cleanupSkill(documentId);
    }
  });

  test("a lost creation response is recovered by retrying the same form request", async ({ browser }) => {
    const suffix = randomUUID();
    const title = `Lost creation response ${suffix}`;
    let dropped = false;
    let documentId = "";
    let createdSkillKey = "";
    try {
      const page = await open(browser, "/settings/skills");
      const endpoint = `**/api/projects/${tenant!.mainProjectId}/skills`;
      await page.route(endpoint, async (route) => {
        if (route.request().method() !== "POST" || dropped) return route.continue();
        dropped = true;
        const response = await route.fetch(); // the native creation commits
        createdSkillKey = (await response.json()).skillKey;
        await route.abort(); // ...but the client never receives the response
      });
      await page.getByTestId("skill-title").fill(title);
      await page.getByTestId("skill-subtype").fill("functional");
      await page.getByTestId("skill-instructions").fill("RULE-LOST: preserve one candidate across an uncertain creation response.");
      await page.getByTestId("skill-create-submit").click();
      await expect(page.getByTestId("skill-create-submit")).toBeEnabled();
      await expect(page.getByTestId("skill-title")).toHaveValue(title);
      await page.unroute(endpoint);
      await page.getByTestId("skill-create-submit").click();
      await expect(page.getByText(/Skill candidate submitted as version/)).toBeVisible();
      expect(dropped).toBe(true);
      documentId = scalar(`SELECT id FROM knowledge_documents WHERE project_id=${literal(tenant!.mainProjectId)} AND title=${literal(title)};`);
      expect(documentId).not.toBe("");
      expect(createdSkillKey).toMatch(/^SKL-/);
      expect(scalar(`SELECT sp.skill_key FROM skill_profiles sp JOIN knowledge_documents d ON d.id=sp.document_id WHERE d.project_id=${literal(tenant!.mainProjectId)} AND d.title=${literal(title)};`)).toBe(createdSkillKey);
      expect(scalar(`SELECT COUNT(*)::int FROM skill_profiles sp JOIN knowledge_documents d ON d.id=sp.document_id WHERE d.project_id=${literal(tenant!.mainProjectId)} AND d.title=${literal(title)};`)).toBe("1");
      expect(scalar(`SELECT COUNT(*)::int FROM knowledge_documents WHERE project_id=${literal(tenant!.mainProjectId)} AND title=${literal(title)};`)).toBe("1");
      expect(scalar(`SELECT COUNT(*)::int FROM knowledge_document_versions WHERE document_id=${literal(documentId)} AND snapshot_kind='submitted';`)).toBe("1");
    } finally {
      await cleanupCandidatesWithTitle(title);
    }
  });
});
