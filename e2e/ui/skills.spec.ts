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

  async function open(browser: Browser, path: string, as: "owner" | "qa" = "owner", options?: { projectRef?: string; beforeNavigate?: (page: Page) => Promise<void> }): Promise<Page> {
    const context = await browser.newContext({ storageState: states.get(as) });
    openedContexts.add(context);
    context.on("close", () => openedContexts.delete(context));
    const page = await context.newPage();
    await options?.beforeNavigate?.(page);
    await page.goto(`/projects/${options?.projectRef || tenant!.mainProjectId}${path}`);
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

  async function assignDoc(documentId: string, versionId: string, operation: string, precedence = 0) {
    const assigned = await ownerApi.post(`${base()}/skill-assignments`, { data: {
      skillDocumentId: documentId, versionId, module: "requirements", subtype: "functional", operation, precedence
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
    await page.getByRole("tab", { name: /^Library/ }).click();
    if (await page.getByTestId("skill-candidate-open").isVisible()) await page.getByTestId("skill-candidate-open").click();
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
    await page.getByRole("tab", { name: /^Library/ }).click();
    if (await page.getByTestId("skill-candidate-open").isVisible()) await page.getByTestId("skill-candidate-open").click();
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
    await page.getByRole("button", { name: "Close review", exact: true }).click();
  }

  test("library discovery opens exact dated history without changing approvals or assignments", async ({ browser }) => {
    const fixture = await reviewFixture();
    try {
      const before = scalar(`SELECT jsonb_build_object('versions', (SELECT COUNT(*) FROM knowledge_document_versions WHERE document_id=${literal(fixture.documentId)}),
        'approved', d.reviewed_version_id, 'assignments', (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM skill_assignments a WHERE a.skill_document_id=d.id))::text
        FROM knowledge_documents d WHERE d.id=${literal(fixture.documentId)};`);
      const page = await open(browser, "/settings/skills");
      await expect(page.getByRole("tab", { name: /^Library/ })).toHaveAttribute("aria-selected", "true");
      await page.getByTestId("skill-library-search").fill("RULE-V3");
      await page.getByTestId("skill-library-module-filter").selectOption("requirements");
      await page.getByTestId("skill-library-subtype-filter").selectOption("functional");
      await page.getByTestId("skill-library-assignment-filter").selectOption("assigned");
      await page.getByTestId("skill-library-review-filter").selectOption("awaiting_review");
      await expect(page.getByTestId(`skill-${fixture.documentId}`)).toBeVisible();
      await expect(page.getByTestId("skill-library-result-count")).toContainText("1 result");
      const latest = page.getByTestId(`skill-open-latest-${fixture.documentId}`);
      await latest.click();
      await expect(page.getByTestId("skill-review-version")).toContainText(`v${fixture.v3.versionNumber}`);
      await expect(page.getByTestId("skill-review-content")).toContainText("RULE-V3");
      await expect(page.getByTestId("skill-review-approve")).toHaveCount(0);
      await page.getByRole("button", { name: "Close review", exact: true }).click();
      await expect(latest).toBeFocused();

      const history = page.getByTestId(`skill-history-${fixture.documentId}`);
      await history.getByText(/Version history/, { exact: false }).click();
      await page.getByTestId("skill-history-sort").selectOption("oldest");
      const rows = history.locator('[data-skill-history-version]');
      await expect(rows.first()).toHaveAttribute("data-skill-history-version", fixture.v1.id);
      await expect(rows.last()).toHaveAttribute("data-skill-history-version", fixture.v3.id);
      await expect(history.getByTestId(`skill-saved-at-${fixture.a1.id}`)).toHaveAttribute("datetime", fixture.a1.createdAt);
      await expect(history.getByTestId(`skill-submitted-at-${fixture.a1.id}`)).toHaveAttribute("datetime", fixture.v1.createdAt);
      const view = history.getByTestId(`skill-history-view-${fixture.v1.id}`);
      await view.click();
      await expect(page.getByTestId("skill-review-content")).toContainText("RULE-BASE");
      await expect(page.getByTestId("skill-review-content")).not.toContainText("RULE-V3");
      await expect(page.getByTestId("skill-review-approve")).toHaveCount(0);
      await page.getByRole("button", { name: "Close review", exact: true }).click();
      await expect(view).toBeFocused();
      await expect(page.getByTestId("skill-library-search")).toHaveValue("RULE-V3");
      await expect(page.getByTestId("skill-history-sort")).toHaveValue("oldest");
      await expect(history).toHaveAttribute("open", "");
      const after = scalar(`SELECT jsonb_build_object('versions', (SELECT COUNT(*) FROM knowledge_document_versions WHERE document_id=${literal(fixture.documentId)}),
        'approved', d.reviewed_version_id, 'assignments', (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM skill_assignments a WHERE a.skill_document_id=d.id))::text
        FROM knowledge_documents d WHERE d.id=${literal(fixture.documentId)};`);
      expect(after).toBe(before);
    } finally {
      await cleanupSkill(fixture.documentId);
    }
  });

  test("library filters distinguish an empty result and retain a candidate when its form closes", async ({ browser }) => {
    const suffix = randomUUID().slice(0, 8);
    const doc = await createSkillDoc(`Library filter ${suffix}`, `FILTER-${suffix}`, `SEARCH-INSTRUCTIONS-${suffix}`);
    let policyId = "";
    try {
      const policy = await ownerApi.post(`${base()}/skills`, { data: { title: `Policy library ${suffix}`, module: "policies", subtype: "security", instructions: `POLICY-ONLY-${suffix}` } });
      expect(policy.ok(), await policy.text()).toBe(true);
      policyId = (await policy.json()).id;
      const page = await open(browser, "/settings/skills");
      await page.getByTestId("skill-library-search").fill(`SEARCH-INSTRUCTIONS-${suffix}`);
      await expect(page.getByTestId("skill-library-result-count")).toContainText("1 result");
      await page.getByTestId("skill-library-module-filter").selectOption("policies");
      await expect(page.getByTestId("skill-library-result-count")).toContainText("0 results");
      await expect(page.getByTestId("skill-library-empty")).toContainText("No skills match");
      await page.getByTestId("skill-library-clear").click();
      await expect(page.getByTestId(`skill-${doc.id}`)).toBeVisible();
      await page.getByTestId("skill-library-module-filter").selectOption("policies");
      await expect(page.getByTestId(`skill-${policyId}`)).toBeVisible();
      await expect(page.getByTestId(`skill-${doc.id}`)).toHaveCount(0);
      await page.getByTestId("skill-library-clear").click();
      await page.getByTestId("skill-candidate-open").click();
      expect(await page.getByTestId("skill-module").locator("option").evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value)))
        .toEqual(["requirements", "test_cases", "user_manuals", "policies", "tasks_issues", "files_evidence", "skills"]);
      await page.getByTestId("skill-title").fill(`Unsent candidate ${suffix}`);
      await page.getByTestId("skill-instructions").fill("Preserve this unsent work across disclosure and tabs.");
      await page.getByTestId("skill-candidate-close").click();
      await page.getByRole("tab", { name: /^Assignments/ }).click();
      await page.getByRole("tab", { name: /^Library/ }).click();
      await page.getByTestId("skill-candidate-open").click();
      await expect(page.getByTestId("skill-title")).toHaveValue(`Unsent candidate ${suffix}`);
      await expect(page.getByTestId("skill-instructions")).toHaveValue("Preserve this unsent work across disclosure and tabs.");
      expect(scalar(`SELECT COUNT(*) FROM knowledge_documents WHERE project_id=${literal(tenant!.mainProjectId)} AND title=${literal(`Unsent candidate ${suffix}`)};`)).toBe("0");
      await page.route(`**${base()}/skills`, (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Injected inventory unavailable" }) }));
      await page.getByTestId("skills-refresh").click();
      await expect(page.getByTestId("skill-library-result-count")).toContainText("Inventory unavailable");
      await expect(page.getByTestId("skill-library-empty")).toHaveCount(0);
      await expect(page.getByTestId("skill-title")).toHaveValue(`Unsent candidate ${suffix}`);
    } finally { if (policyId) await cleanupSkill(policyId); await cleanupSkill(doc.id); }
  });

  test("one exact older approved version is assigned atomically and an already satisfied generation is retained", async ({ browser }) => {
    const fixture = await reviewFixture();
    try {
      // Existing native clients can set precedence. This form has no priority edit and must
      // preserve that fact when the selected version is already satisfied.
      const prioritized = await assignDoc(fixture.documentId, fixture.a1.id, "requirement_revision", 17);
      fixture.assignmentId = String(prioritized.assignment.id);
      const beforeRead = await ownerApi.get(`${base()}/skills/effective?module=requirements&subtype=functional&operation=requirement_revision`);
      expect(beforeRead.ok(), await beforeRead.text()).toBe(true);
      const beforeResolution = await beforeRead.json();
      expect(beforeResolution).toMatchObject({ status: "resolved", assignments: [{ assignmentId: fixture.assignmentId }] });
      expect(beforeResolution.digest).toMatch(/^[a-f0-9]{64}$/);
      const page = await open(browser, "/settings/skills");
      const history = page.getByTestId(`skill-history-${fixture.documentId}`);
      await history.getByText(/Version history/).click();
      await test.info().attach("skills-library-history-native", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
      await history.getByTestId(`skill-history-view-${fixture.a1.id}`).click();
      await expect(page.getByTestId("skill-review-version")).toContainText(fixture.a1.id);
      await test.info().attach("skills-exact-version-native-desktop", { body: await page.screenshot(), contentType: "image/png" });
      await page.getByRole("tab", { name: /^Assignments/ }).click();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("tab", { name: /^Assignments/ })).toBeFocused();
      await page.getByRole("tab", { name: /^Library/ }).click();
      await history.getByTestId(`skill-history-view-${fixture.a1.id}`).click();
      const desktop = page.viewportSize()!;
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.getByRole("dialog", { name: /Inspect saved/ })).toBeVisible();
      await expect(page.getByRole("button", { name: "Close review", exact: true })).toBeVisible();
      await test.info().attach("skills-exact-version-native-narrow", { body: await page.screenshot(), contentType: "image/png" });
      await page.keyboard.press("Escape");
      await expect(history.getByTestId(`skill-history-view-${fixture.a1.id}`)).toBeFocused();
      await page.setViewportSize(desktop);
      await history.getByTestId(`skill-history-view-${fixture.a1.id}`).click();
      await page.getByTestId("skill-review-assign").click();
      await expect(page.getByRole("tab", { name: /^Assignments/ })).toHaveAttribute("aria-selected", "true");
      await expect(page.getByTestId("skill-assignment-version")).toHaveValue(fixture.a1.id);
      await page.getByTestId("skill-target-requirement_revision").check();
      await page.getByTestId("skill-target-requirement_case_link").check();
      await expect(page.getByTestId("skill-assignment-preview")).toContainText("Already satisfied");
      await expect(page.getByTestId("skill-assignment-preview")).toContainText("recorded priority 17 retained");
      await test.info().attach("skills-assignment-preview-native", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
      const saved = page.waitForResponse((response) => response.url().endsWith("/skill-assignment-batches") && response.request().method() === "POST");
      await page.getByTestId("skill-assign").click();
      const response = await saved;
      expect(response.ok(), await response.text()).toBe(true);
      const { receipt } = await response.json();
      expect(receipt.skillVersionId).toBe(fixture.a1.id);
      expect(receipt.targets).toHaveLength(2);
      expect(receipt.targets.find((entry: { target: { operation: string } }) => entry.target.operation === "requirement_revision"))
        .toMatchObject({ outcome: "already_satisfied", before: { id: fixture.assignmentId, precedence: 17 }, after: { id: fixture.assignmentId, precedence: 17 } });
      await expect(page.getByTestId("skill-assignment-receipt")).toContainText(receipt.requestKey);
      const ledger = await (await ownerApi.get(`${base()}/skill-assignments`)).json();
      const active = ledger.list.filter((entry: { skillDocumentId: string; status: string }) => entry.skillDocumentId === fixture.documentId && entry.status === "active");
      expect(active).toHaveLength(2);
      expect(active.every((entry: { skillVersionId: string }) => entry.skillVersionId === fixture.a1.id)).toBe(true);
      expect(active.find((entry: { id: string }) => entry.id === fixture.assignmentId)).toMatchObject({ precedence: 17 });
      const afterRead = await ownerApi.get(`${base()}/skills/effective?module=requirements&subtype=functional&operation=requirement_revision`);
      expect(afterRead.ok(), await afterRead.text()).toBe(true);
      const afterResolution = await afterRead.json();
      expect(afterResolution).toMatchObject({ status: "resolved", assignments: [{ assignmentId: fixture.assignmentId }] });
      expect(afterResolution.digest).toBe(beforeResolution.digest);
      expect(scalar(`SELECT reviewed_version_id FROM knowledge_documents WHERE id=${literal(fixture.documentId)};`)).toBe(fixture.a2.id);
      // Revoke the displayed generation, even when a neighboring binding has the same version.
      await page.getByTestId(`skill-revoke-${fixture.assignmentId}`).click();
      await expect(page.getByTestId(`skill-assignment-${fixture.assignmentId}`)).toContainText("revoked");
      const neighbor = active.find((entry: { id: string }) => entry.id !== fixture.assignmentId);
      expect(scalar(`SELECT status FROM skill_assignments WHERE id=${literal(neighbor.id)};`)).toBe("active");
    } finally { await cleanupSkill(fixture.documentId); }
  });

  test("a stale batch preserves selected targets until the owner reviews the refreshed generations", async ({ browser }) => {
    const fixture = await reviewFixture();
    try {
      const page = await open(browser, "/settings/skills");
      await page.getByRole("tab", { name: /^Assignments/ }).click();
      await page.getByTestId("skill-assignment-open").click();
      await page.getByTestId("skill-assignment-skill").selectOption(fixture.documentId);
      await page.getByTestId("skill-assignment-version").selectOption(fixture.a2.id);
      await page.getByTestId("skill-target-requirement_revision").check();
      await page.getByTestId("skill-target-requirement_case_link").check();
      const replacement = await assignDoc(fixture.documentId, fixture.a2.id, "requirement_revision");
      const refused = page.waitForResponse((response) => response.url().endsWith("/skill-assignment-batches") && response.request().method() === "POST");
      await page.getByTestId("skill-assign").click();
      expect((await refused).status()).toBe(409);
      await expect(page.getByTestId("skill-assignment-error")).toContainText(/changed|stale|review/i);
      await expect(page.getByTestId("skill-target-requirement_case_link")).toBeChecked();
      expect(scalar(`SELECT COUNT(*) FROM skill_assignments WHERE skill_document_id=${literal(fixture.documentId)} AND operation='requirement_case_link';`)).toBe("0");
      await page.getByTestId("skill-assignment-review-targets").click();
      await expect(page.getByTestId("skill-assignment-preview")).toContainText(replacement.assignment.id);
      await page.getByTestId("skill-assign").click();
      await expect(page.getByTestId("skill-assignment-receipt")).toBeVisible();
      expect(scalar(`SELECT COUNT(*) FROM skill_assignments WHERE skill_document_id=${literal(fixture.documentId)} AND status='active';`)).toBe("2");
    } finally { await cleanupSkill(fixture.documentId); }
  });

  test("an approved skill outside Work Package A keeps its module and accepts an explicit custom context", async ({ browser }) => {
    const suffix = randomUUID().slice(0, 8);
    let documentId = "";
    try {
      const created = await ownerApi.post(`${base()}/skills`, { data: {
        title: `Custom policy skill ${suffix}`, module: "policies", subtype: "security", instructions: "Require an explicit review context for policy revisions."
      } });
      expect(created.ok(), await created.text()).toBe(true);
      const doc = await created.json();
      documentId = doc.id;
      const submitted = await submitDoc(doc);
      const approved = await approveDoc(doc.id, submitted.id);
      const page = await open(browser, "/settings/skills");
      await page.getByRole("tab", { name: /^Assignments/ }).click();
      await page.getByTestId("skill-assignment-open").click();
      await page.getByTestId("skill-assignment-skill").selectOption(doc.id);
      await expect(page.getByTestId("skill-assignment-module")).toHaveValue("policies");
      await expect(page.getByTestId("skill-assignment-module")).toBeDisabled();
      await expect(page.getByTestId("skill-target-requirement_revision")).toHaveCount(0);
      await expect(page.getByTestId("skill-target-testcase_create")).toHaveCount(0);
      await page.getByTestId("skill-assignment-subtype").fill("security");
      await page.getByTestId("skill-assignment-operation").fill(`policy_review_${suffix}`);
      await page.getByTestId("skill-assignment-add-target").click();
      await page.getByTestId("skill-assign").click();
      await expect(page.getByTestId("skill-assignment-receipt")).toContainText(`policy_review_${suffix}`);
      const effective = await ownerApi.get(`${base()}/skills/effective?module=policies&subtype=security&operation=policy_review_${suffix}`);
      expect(effective.ok(), await effective.text()).toBe(true);
      expect(await effective.json()).toMatchObject({ status: "resolved", assignments: [{ skillDocumentId: doc.id, skillVersionId: approved.id }] });
      const neighbor = await ownerApi.get(`${base()}/skills/effective?module=policies&subtype=security&operation=untouched_${suffix}`);
      expect(neighbor.ok(), await neighbor.text()).toBe(true);
      expect(await neighbor.json()).toMatchObject({ status: "unassigned", assignments: [] });
    } finally { if (documentId) await cleanupSkill(documentId); }
  });

  test("a lost batch response survives UUID normalization and reload without another assignment write", async ({ browser }) => {
    const fixture = await reviewFixture();
    let writes = 0;
    let nativeReceipt: { requestKey: string; id: string } | undefined;
    let releaseRouting!: () => void;
    let routingReached!: () => void;
    let routingDelivered!: () => void;
    const routingGate = new Promise<void>((resolve) => { releaseRouting = resolve; });
    const routingSeen = new Promise<void>((resolve) => { routingReached = resolve; });
    const routingDone = new Promise<void>((resolve) => { routingDelivered = resolve; });
    const batchEndpoint = new RegExp(`${base()}/skill-assignment-batches$`, "i");
    const receiptEndpoint = new RegExp(`${base()}/skill-assignment-batches/[^/?]+$`, "i");
    try {
      const upperProject = tenant!.mainProjectId.toUpperCase();
      const page = await open(browser, "/settings/skills", "owner", { projectRef: upperProject, beforeNavigate: async (page) => {
        // The provider renders UUID links immediately. Hold its real canonical response until
        // this same project already has an unresolved assignment request.
        await page.route("**/api/route-resolve?**", async (route) => {
          if (new URL(route.request().url()).searchParams.get("project") !== upperProject) return route.continue();
          const response = await route.fetch();
          expect(response.ok(), await response.text()).toBe(true);
          routingReached();
          await routingGate;
          await route.fulfill({ response });
          routingDelivered();
        });
      } });
      await routingSeen;
      await page.getByRole("tab", { name: /^Assignments/ }).click();
      await page.getByTestId("skill-assignment-open").click();
      await page.getByTestId("skill-assignment-skill").selectOption(fixture.documentId);
      await page.getByTestId("skill-target-requirement_case_link").check();
      await page.route(batchEndpoint, async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        writes++;
        const response = await route.fetch();
        expect(response.ok(), await response.text()).toBe(true);
        nativeReceipt = (await response.json()).receipt;
        await route.abort("connectionfailed");
      });
      await page.route(receiptEndpoint, (route) => route.fulfill({
        status: 503, contentType: "application/json", body: JSON.stringify({ error: "Injected receipt read unavailable" })
      }));
      await page.getByTestId("skill-assign").click();
      await expect(page.getByTestId("skill-assignment-pending")).toContainText(/unconfirmed|could not be confirmed/i);
      await expect(page.getByTestId("skill-assignment-recover")).toBeEnabled();
      expect(nativeReceipt).toBeTruthy();
      releaseRouting();
      await routingDone;
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      await expect(page.getByTestId("skill-assignment-pending")).toContainText(nativeReceipt!.requestKey);
      await page.unroute(receiptEndpoint);
      await page.reload();
      await page.getByRole("tab", { name: /^Assignments/ }).click();
      await expect(page.getByTestId("skill-assignment-receipt")).toContainText(nativeReceipt!.requestKey);
      expect(writes).toBe(1);
      expect(scalar(`SELECT COUNT(*) FROM skill_assignments WHERE skill_document_id=${literal(fixture.documentId)} AND operation='requirement_case_link';`)).toBe("1");
    } finally { releaseRouting(); await cleanupSkill(fixture.documentId); }
  });

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

      await page.getByRole("tab", { name: /^Assignments/ }).click();
      await page.getByTestId("skill-assignment-open").click();
      const assign = async (key: string, module: string, subtype: string, operation: string) => {
        await page.getByTestId("skill-assignment-skill").selectOption({ label: `${key} (${module}/${subtype})` });
        await expect(page.getByTestId("skill-assignment-module")).toHaveValue(module);
        await expect(page.getByTestId("skill-assignment-module")).toBeDisabled();
        await page.getByTestId("skill-assignment-subtype").fill(subtype);
        await page.getByTestId("skill-assignment-operation").fill(operation);
        await page.getByTestId("skill-assignment-add-target").click();
        const skillDocumentId = await page.getByTestId("skill-assignment-skill").inputValue();
        const versionId = await page.getByTestId("skill-assignment-version").inputValue();
        // Ledger rows also say "Assigned by". Confirm this command's receipt, so neither
        // a neighboring assignment nor the previous helper call can acknowledge this save.
        const saved = page.waitForResponse((response) => response.request().method() === "POST"
          && new URL(response.url()).pathname === `${base()}/skill-assignment-batches`);
        await page.getByTestId("skill-assign").click();
        const response = await saved;
        expect(response.ok(), await response.text()).toBe(true);
        const command = response.request().postDataJSON();
        expect(command).toMatchObject({ skillDocumentId, versionId, targets: [{ module, subtype, operation }] });
        expect(command.targets).toHaveLength(1);
        const { receipt, replayed } = await response.json();
        expect(replayed).toBe(false);
        expect(receipt).toMatchObject({
          requestKey: command.requestKey, projectId: tenant!.mainProjectId, actorId: tenant!.owner.userId,
          principalKind: "human_session", skillDocumentId, skillVersionId: versionId,
          targets: [{ target: { module, subtype, operation }, after: { skillDocumentId, skillVersionId: versionId, status: "active" } }]
        });
        expect(receipt.targets).toHaveLength(1);
        const target = receipt.targets[0];
        expect(["added", "replaced", "already_satisfied"]).toContain(target.outcome);
        const displayed = page.getByTestId("skill-assignment-receipt");
        await expect(displayed).toBeVisible();
        await expect(displayed).toContainText(`Request: ${command.requestKey} · version: ${versionId}`);
        await expect(displayed).toContainText(`Content digest: ${receipt.contentDigest}`);
        await expect(displayed).toContainText(`${module} / ${subtype} / ${operation}: ${target.outcome.replaceAll("_", " ")} · generation ${target.after.id}`);
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

  type ActivationFixture = {
    taskId: string; requirementId: string; submittedVersionId: string; approvedVersionId: string;
    caseId: string; caseBasis: { editRevision: string; approvalRevision: string };
    groups: { selected: string; reversed: string; other: string }; extraTaskIds: string[];
  };

  async function attachActivationView(page: Page, name: string) {
    const screenshotPath = test.info().outputPath(name + ".png");
    const panel = page.getByTestId("requirement-review-panel");
    const main = page.locator(".tesbo-app-shell > main");
    const originalViewport = page.viewportSize();
    if (!originalViewport) throw new Error("Activation captures require the configured desktop viewport.");
    const originalScroll = await main.evaluate(element => ({ top: element.scrollTop, left: element.scrollLeft }));
    const panelHeight = await panel.evaluate(element => element.getBoundingClientRect().height);
    const headerHeight = await main.locator(":scope > header").evaluate(element => element.getBoundingClientRect().height);
    // The app scrolls main inside h-screen. A locator capture alone cannot reveal the parts
    // clipped by that ancestor. Keep desktop width and temporarily fit the panel below its header.
    const captureViewport = { width: originalViewport.width,
      height: Math.max(originalViewport.height, Math.ceil(panelHeight + headerHeight + 32)) };
    try {
      await page.setViewportSize(captureViewport);
      await panel.evaluate(element => {
        const scroller = element.closest("main")!;
        const header = scroller.querySelector(":scope > header")!;
        scroller.scrollTo({ left: scroller.scrollLeft, behavior: "instant",
          top: scroller.scrollTop + element.getBoundingClientRect().top - scroller.getBoundingClientRect().top
            - header.getBoundingClientRect().height - 16 });
      });
      const geometry = await panel.evaluate(element => {
        const rect = element.getBoundingClientRect();
        const panelBounds = { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
        const clippedBy: string[] = [];
        const clippingAncestors = [];
        const outside = (clip: typeof panelBounds, x: boolean, y: boolean) =>
          (x && (rect.left < clip.left - 0.5 || rect.right > clip.right + 0.5)) ||
          (y && (rect.top < clip.top - 0.5 || rect.bottom > clip.bottom + 0.5));
        if (rect.width <= 0 || rect.height <= 0) clippedBy.push("empty panel");
        if (outside({ left: 0, top: 0, right: innerWidth, bottom: innerHeight }, true, true)) clippedBy.push("viewport");
        for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
          const style = getComputedStyle(ancestor);
          const clipsX = /^(auto|scroll|hidden|clip)$/.test(style.overflowX);
          const clipsY = /^(auto|scroll|hidden|clip)$/.test(style.overflowY);
          if (!clipsX && !clipsY) continue;
          const bounds = ancestor.getBoundingClientRect();
          const clip = { left: bounds.left + ancestor.clientLeft, top: bounds.top + ancestor.clientTop,
            right: bounds.left + ancestor.clientLeft + ancestor.clientWidth,
            bottom: bounds.top + ancestor.clientTop + ancestor.clientHeight };
          clippingAncestors.push({ tag: ancestor.tagName, overflowX: style.overflowX, overflowY: style.overflowY, clip });
          if (outside(clip, clipsX, clipsY)) clippedBy.push(ancestor.tagName + " overflow");
        }
        const header = element.closest("main")!.querySelector(":scope > header")!.getBoundingClientRect();
        if (rect.top < header.bottom - 0.5) clippedBy.push("sticky header");
        return { viewport: { width: innerWidth, height: innerHeight }, panelBounds,
          stickyHeaderBottom: header.bottom, clippingAncestors, clippedBy };
      });
      await test.info().attach(name + "-geometry", { contentType: "application/json",
        body: JSON.stringify({ scope: "Desktop width with temporary expanded height", originalViewport, captureViewport, geometry }, null, 2) });
      expect(geometry.clippedBy, "The complete activation panel must fit before its evidence capture").toEqual([]);
      await panel.screenshot({ path: screenshotPath });
      await test.info().attach(name, { path: screenshotPath, contentType: "image/png" });
    } finally {
      await page.setViewportSize(originalViewport);
      await main.evaluate((element, position) => element.scrollTo({ ...position, behavior: "instant" }), originalScroll);
    }
  }

  async function withActivationFixture(run: (fixture: ActivationFixture) => Promise<void>) {
    const suffix = randomUUID();
    const skillDocs: string[] = [], taskIds: string[] = [];
    let requirementId = "", caseId = "";
    try {
      for (const [module, subtype, operation] of [
        ["requirements", "functional", "requirement_revision"],
        ["requirements", "functional", "requirement_case_link"],
        ["test_cases", "manual", "testcase_create"],
      ]) skillDocs.push((await apiSkill(module, subtype, operation)).documentId);
      const requirementOperationId = randomUUID(), testcaseOperationId = randomUUID();
      const stagedResponse = await ownerApi.post(base() + "/requirements/proposals", { data: {
        requestKey: "activation-recovery-" + suffix, title: "Activation recovery " + suffix,
        operations: [
          { opType: "requirement_revision", operationId: requirementOperationId,
            title: "Activation requirement " + suffix, description: "Native ordered-group recovery fixture.",
            criteria: ["AC-1", "AC-2", "AC-3"].map(key => ({ key, text: "Observable obligation " + key })) },
          { opType: "testcase_create", operationId: testcaseOperationId,
            draft: { title: "Activation case " + suffix } },
          { opType: "requirement_case_link", operationId: randomUUID(), requirementOperationId,
            testcaseOperationId, criterionKeys: ["AC-1", "AC-2"] },
        ],
      } });
      expect(stagedResponse.ok(), await stagedResponse.text()).toBe(true);
      const staged = await stagedResponse.json();
      taskIds.push(staged.id);
      const appliedResponse = await ownerApi.post(base() + "/requirements/proposals/" + staged.id + "/apply",
        { data: { expectedProposalRevision: staged.proposalRevision } });
      expect(appliedResponse.ok(), await appliedResponse.text()).toBe(true);
      const applied = await appliedResponse.json();
      requirementId = applied.receipt.requirement.documentId;
      caseId = applied.receipt.testcase.id;
      const submittedVersionId = String(applied.receipt.requirement.versionId);
      const approved = await ownerApi.post(base() + "/requirements/" + requirementId + "/approve",
        { data: { versionId: submittedVersionId } });
      expect(approved.ok(), await approved.text()).toBe(true);
      const approvedVersionId = String((await approved.json()).approvedVersionId);
      const beforeCase = await (await ownerApi.get(base() + "/testcases/" + caseId)).json();
      const approvedCase = await ownerApi.post(base() + "/testcases/" + caseId + "/approve",
        { data: { expectedRevision: beforeCase.editRevision, expectedApprovalRevision: beforeCase.approvalRevision } });
      expect(approvedCase.ok(), await approvedCase.text()).toBe(true);
      const caseBasis = await (await ownerApi.get(base() + "/testcases/" + caseId)).json();
      // The current bundle creates one link. Seed two valid neighboring groups only in this
      // suite's disposable tenant, copying the real native link's provenance and stored basis.
      // Array order is part of today's identity; the reversed neighbor must stay untouched.
      for (const keys of [["AC-2", "AC-1"], ["AC-3"]]) {
        exec("INSERT INTO requirement_case_links " +
          "(project_id,requirement_id,requirement_version_id,criterion_keys,testcase_id,testcase_revision," +
          "testcase_approval_revision,state,proposed_by,applied_by,applied_at) " +
          "SELECT project_id,requirement_id,requirement_version_id,ARRAY[" + keys.map(literal).join(",") + "]::text[]," +
          "testcase_id,testcase_revision,testcase_approval_revision,state,proposed_by,applied_by,applied_at " +
          "FROM requirement_case_links WHERE project_id=" + literal(tenant!.mainProjectId) +
          " AND requirement_id=" + literal(requirementId) + " AND requirement_version_id=" + literal(approvedVersionId) +
          " AND state='active' AND criterion_keys=ARRAY['AC-1','AC-2']::text[];");
      }
      await run({ taskId: staged.id, requirementId, submittedVersionId, approvedVersionId, caseId, caseBasis,
        groups: { selected: caseId + "::AC-1::AC-2", reversed: caseId + "::AC-2::AC-1", other: caseId + "::AC-3" },
        extraTaskIds: taskIds });
    } finally {
      for (const id of taskIds) exec("DELETE FROM ai_generation_requests WHERE id=" + literal(id) + " AND project_id=" + literal(tenant!.mainProjectId) + ";");
      if (requirementId) {
        exec("DELETE FROM requirement_case_links WHERE project_id=" + literal(tenant!.mainProjectId) + " AND requirement_id=" + literal(requirementId) + ";");
        exec("DELETE FROM requirement_profiles WHERE document_id=" + literal(requirementId) + ";");
        exec("UPDATE knowledge_documents SET reviewed_version_id=NULL WHERE id=" + literal(requirementId) + ";");
        exec("DELETE FROM knowledge_documents WHERE id=" + literal(requirementId) + " AND project_id=" + literal(tenant!.mainProjectId) + ";");
      }
      if (caseId) exec("DELETE FROM testcases WHERE id=" + literal(caseId) + " AND project_id=" + literal(tenant!.mainProjectId) + ";");
      for (const id of skillDocs) {
        exec("DELETE FROM skill_assignments WHERE project_id=" + literal(tenant!.mainProjectId) + " AND skill_document_id=" + literal(id) + ";");
        exec("UPDATE knowledge_documents SET reviewed_version_id=NULL WHERE id=" + literal(id) + ";");
        exec("DELETE FROM knowledge_documents WHERE id=" + literal(id) + " AND project_id=" + literal(tenant!.mainProjectId) + ";");
      }
    }
  }

  async function approveNewRequirementBasis(f: ActivationFixture, selection?: { linkId: string; requirementVersionId: string; criterionKeys: string[] }): Promise<string> {
    const doc = await (await ownerApi.get(base() + "/knowledge-base/documents/" + f.requirementId)).json();
    const stagedResponse = await ownerApi.post(base() + "/requirements/proposals", { data: {
      requestKey: "newer-activation-basis-" + randomUUID(), title: "Newer activation requirement",
      operations: [{ opType: "requirement_revision", operationId: randomUUID(), documentId: f.requirementId,
        expectedRevision: doc.editRevision, title: "Newer activation requirement " + randomUUID(),
        criteria: ["AC-1", "AC-2", "AC-3"].map(key => ({ key, text: "Updated obligation " + key })),
        ...(selection ? { carryForwardLinks: [{ ...selection, testcaseId: f.caseId,
          testcaseRevision: f.caseBasis.editRevision, testcaseApprovalRevision: f.caseBasis.approvalRevision }] } : {}) }],
    } });
    expect(stagedResponse.ok(), await stagedResponse.text()).toBe(true);
    const staged = await stagedResponse.json();
    f.extraTaskIds.push(staged.id);
    const applied = await ownerApi.post(base() + "/requirements/proposals/" + staged.id + "/apply",
      { data: { expectedProposalRevision: staged.proposalRevision } });
    expect(applied.ok(), await applied.text()).toBe(true);
    const appliedBody = await applied.json();
    const approved = await ownerApi.post(base() + "/requirements/" + f.requirementId + "/approve",
      { data: { versionId: appliedBody.receipt.requirement.versionId } });
    expect(approved.ok(), await approved.text()).toBe(true);
    return String((await approved.json()).approvedVersionId);
  }

  test("explicit carry-forward is visible in both reviews and authorizes only the selected group", async ({ browser }) => {
    await withActivationFixture(async f => {
      const coverageUrl = base() + "/requirements/" + f.requirementId + "/coverage";
      const initial = await (await ownerApi.get(coverageUrl)).json();
      const source = initial.cases.find((entry: { requirementVersionId: string; criterionKeys: string[] }) =>
        entry.requirementVersionId === f.approvedVersionId && entry.criterionKeys.join("::") === "AC-1::AC-2");
      const neighbor = initial.cases.find((entry: { requirementVersionId: string; criterionKeys: string[] }) =>
        entry.requirementVersionId === f.approvedVersionId && entry.criterionKeys.join("::") === "AC-2::AC-1");
      expect(source).toBeTruthy();
      expect(neighbor).toBeTruthy();
      const doc = await (await ownerApi.get(base() + "/knowledge-base/documents/" + f.requirementId)).json();
      const stage = await ownerApi.post(base() + "/requirements/proposals", { data: {
        requestKey: randomUUID(), title: "Explicit carry-forward review",
        operations: [{ opType: "requirement_revision", operationId: randomUUID(), documentId: f.requirementId,
          expectedRevision: doc.editRevision, title: "Reviewed carry-forward " + randomUUID(),
          criteria: ["AC-1", "AC-2", "AC-3"].map(key => ({ key, text: "Changed meaning " + key })),
          carryForwardLinks: [{ linkId: source.linkId, requirementVersionId: source.requirementVersionId,
            testcaseId: f.caseId, testcaseRevision: f.caseBasis.editRevision,
            testcaseApprovalRevision: f.caseBasis.approvalRevision, criterionKeys: source.criterionKeys }] }]
      } });
      expect(stage.ok(), await stage.text()).toBe(true);
      const task = await stage.json();
      f.extraTaskIds.push(task.id);
      const page = await open(browser, "/agents/tasks/" + task.id);
      const selected = page.getByTestId("requirement-change-bundle").getByTestId("requirement-carry-forward-" + source.linkId);
      await expect(selected).toContainText("AC-1 → AC-2");
      await expect(selected).toContainText(f.caseBasis.approvalRevision);
      await expect(selected).toContainText("Originating reviewed Skill");
      await expect(selected).toContainText("Changed meaning AC-1");
      await expect(page.getByTestId("requirement-change-bundle").getByTestId("requirement-carry-forward-" + neighbor.linkId)).toHaveCount(0);
      const appliedResponse = page.waitForResponse(response => response.request().method() === "POST" && response.url().includes("/proposals/" + task.id + "/apply"));
      await page.getByTestId("requirement-bundle-apply").click();
      const applied = await appliedResponse;
      expect(applied.ok(), await applied.text()).toBe(true);
      const receipt = await applied.json();
      expect(receipt.receipt.testcase).toBeNull();
      const versionReview = page.getByTestId("requirement-review-panel");
      await expect(versionReview.getByTestId("requirement-carry-forward-" + source.linkId)).toContainText("Same reviewed link Skill basis");
      await expect(versionReview.getByTestId("requirement-carry-forward-" + source.linkId)).toContainText("Changed meaning AC-2");
      const approvedResponse = page.waitForResponse(response => response.request().method() === "POST" && response.url().endsWith("/requirements/" + f.requirementId + "/approve"));
      await page.getByTestId("requirement-review-approve").click();
      const approved = await approvedResponse;
      expect(approved.ok(), await approved.text()).toBe(true);
      const approval = await approved.json();
      const revisions = { expectedRequirementVersionId: approval.approvedVersionId, expectedCaseRevision: f.caseBasis.editRevision,
        expectedApprovalRevision: f.caseBasis.approvalRevision };
      const neighborRefusal = await ownerApi.post(base() + "/requirements/" + f.requirementId + "/links/" + neighbor.linkId + "/reapply", { data: revisions });
      expect(neighborRefusal.status()).toBe(409);
      expect((await neighborRefusal.json()).code).toBe("SKILL_LINK_REVIEW_REQUIRED");
      const pending = await (await ownerApi.get(coverageUrl)).json();
      expect(pending.cases).toHaveLength(0);
      expect(pending.readings.authored).toBe(false);
      expect(pending.pendingCarryForwardCases).toEqual([expect.objectContaining({ linkId: source.linkId, authored: false, approved: false })]);
      await expect(page.getByTestId("requirement-coverage-case-" + f.groups.reversed)).toHaveCount(0);
      await expect(page.getByTestId("requirement-coverage-case-" + f.groups.selected)).toContainText("pending activation");
      const activationResponse = page.waitForResponse(response => response.request().method() === "POST" &&
        response.url().endsWith("/links/" + source.linkId + "/reapply"));
      await page.getByTestId("requirement-link-activate-" + f.groups.selected).click();
      const activation = await activationResponse;
      expect(activation.ok(), await activation.text()).toBe(true);
      const activated = await activation.json();
      expect(activated.link).toMatchObject({ testcaseId: f.caseId, requirementVersionId: approval.approvedVersionId, criterionKeys: source.criterionKeys });
      await page.reload();
      await expect(page.getByTestId("requirement-link-state-" + f.groups.selected)).toContainText("active on the approved requirement version");
      await expect(page.getByTestId("requirement-review-panel").getByTestId("requirement-carry-forward-" + source.linkId)).toContainText(f.caseId);
    });
  });

  test("activation recovery retains two uncertain ordered groups and verifies their exact native outcomes", async ({ browser }) => {
    await withActivationFixture(async f => {
      const coverageUrl = base() + "/requirements/" + f.requirementId + "/coverage";
      const coveragePattern = "**" + coverageUrl;
      const beforeResponse = await ownerApi.get(coverageUrl);
      expect(beforeResponse.ok(), await beforeResponse.text()).toBe(true);
      const before = await beforeResponse.json();
      const reversedBefore = scalar("SELECT to_jsonb(l)::text FROM requirement_case_links l WHERE requirement_id=" +
        literal(f.requirementId) + " AND criterion_keys=ARRAY['AC-2','AC-1']::text[];");
      const snapshot = () => scalar("SELECT json_build_object(" +
        "'links',(SELECT json_agg(to_jsonb(l) ORDER BY id) FROM requirement_case_links l WHERE requirement_id=" + literal(f.requirementId) + ")," +
        "'audit',(SELECT json_agg(to_jsonb(a) ORDER BY id) FROM audit_logs a WHERE entity_name=" + literal(f.requirementId) +
        " AND action='requirement_link_reapplied'))::text;");
      const page = await open(browser, "/agents/tasks/" + f.taskId);
      const activationPosts: string[] = [];
      page.on("request", request => {
        if (request.method() === "POST" && request.url().includes(base() + "/requirements/" + f.requirementId + "/links/") &&
          request.url().endsWith("/reapply")) activationPosts.push(request.url());
      });
      for (const group of Object.values(f.groups)) await expect(page.getByTestId("requirement-link-activate-" + group)).toBeEnabled();
      // Deliver the already captured REAL native response to model a delayed/stale read. Only
      // delivery is controlled: actual activation writes and subsequent verification are native.
      await page.route(coveragePattern, route => route.fulfill({ response: beforeResponse }));
      const payloads: Record<string, unknown>[] = [];
      for (const [index, group] of [f.groups.selected, f.groups.other].entries()) {
        const keys = group === f.groups.selected ? ["AC-1", "AC-2"] : ["AC-3"];
        const link = before.cases.find((entry: { criterionKeys: string[]; requirementVersionId: string }) =>
          entry.requirementVersionId === f.approvedVersionId && JSON.stringify(entry.criterionKeys) === JSON.stringify(keys));
        expect(link).toBeTruthy();
        await page.route("**" + base() + "/requirements/" + f.requirementId + "/links/" + link.linkId + "/reapply", async route => {
          payloads.push(route.request().postDataJSON());
          const actual = await route.fetch();
          expect(actual.ok(), await actual.text()).toBe(true);
          if (index === 0) await route.abort("failed");
          else await route.fulfill({ status: 503, json: { error: "Response lost after native commit" } });
        });
        await page.getByTestId("requirement-link-activate-" + group).click();
        await expect(page.getByTestId("requirement-link-error-" + group)).toContainText("could not be confirmed");
        await expect(page.getByTestId("requirement-link-notice-" + group)).toHaveCount(0);
        await expect(page.getByTestId("requirement-link-activate-" + f.groups.reversed)).toBeEnabled();
      }
      await expect(page.getByTestId("requirement-link-error-" + f.groups.selected)).toContainText("could not be confirmed");
      await expect(page.getByTestId("requirement-link-error-" + f.groups.other)).toContainText("could not be confirmed");
      await attachActivationView(page, "activation-two-unconfirmed-groups");
      expect(activationPosts).toHaveLength(2);
      const beforeVerify = snapshot();
      await page.unroute(coveragePattern);
      await page.getByRole("button", { name: "Verify activation outcomes", exact: true }).click();
      for (const group of [f.groups.selected, f.groups.other]) {
        await expect(page.getByTestId("requirement-link-notice-" + group)).toContainText("verified after an unconfirmed response");
        await expect(page.getByTestId("requirement-link-error-" + group)).toHaveCount(0);
      }
      for (const payload of payloads) expect(payload).toMatchObject({
        expectedRequirementVersionId: f.approvedVersionId,
        expectedCaseRevision: f.caseBasis.editRevision, expectedApprovalRevision: f.caseBasis.approvalRevision,
      });
      const after = await (await ownerApi.get(coverageUrl)).json();
      for (const keys of [["AC-1", "AC-2"], ["AC-3"]]) {
        const links = after.cases.filter((entry: { criterionKeys: string[] }) => JSON.stringify(entry.criterionKeys) === JSON.stringify(keys));
        expect(links).toHaveLength(1);
        expect(links[0]).toMatchObject({ approved: true, requirementVersionId: f.approvedVersionId,
          testcaseRevision: f.caseBasis.editRevision, testcaseApprovalRevision: f.caseBasis.approvalRevision });
      }
      expect(scalar("SELECT to_jsonb(l)::text FROM requirement_case_links l WHERE requirement_id=" +
        literal(f.requirementId) + " AND criterion_keys=ARRAY['AC-2','AC-1']::text[];")).toBe(reversedBefore);
      await expect(page.getByTestId("requirement-link-activate-" + f.groups.reversed)).toBeEnabled();
      // Verification must only read: even a harmless replay POST would break this contract.
      expect(activationPosts).toHaveLength(2);
      expect(snapshot()).toBe(beforeVerify);
      await attachActivationView(page, "activation-two-exact-outcomes-confirmed");

      // Keep the displayed basis stale while a real edit invalidates the case approval. The
      // untouched reversed group provides the existing action that refuses and refreshes it.
      const changed = await ownerApi.put(base() + "/testcases/" + f.caseId,
        { data: { title: "Unapproved later activation case " + randomUUID(), expectedRevision: f.caseBasis.editRevision } });
      expect(changed.ok(), await changed.text()).toBe(true);
      const reversedLink = after.cases.find((entry: { criterionKeys: string[] }) => entry.criterionKeys.join("::") === "AC-2::AC-1");
      expect(reversedLink).toBeTruthy();
      const refusedPromise = page.waitForResponse(response => response.request().method() === "POST" &&
        response.url().endsWith("/requirements/" + f.requirementId + "/links/" + reversedLink.linkId + "/reapply"));
      await page.getByTestId("requirement-link-activate-" + f.groups.reversed).click();
      const refused = await refusedPromise;
      expect(refused.status()).toBe(409);
      expect(await refused.json()).toMatchObject({ code: "CASE_REVISION_CONFLICT" });
      expect(refused.request().postDataJSON()).toMatchObject({ expectedRequirementVersionId: f.approvedVersionId,
        expectedCaseRevision: f.caseBasis.editRevision, expectedApprovalRevision: f.caseBasis.approvalRevision });
      await expect(page.getByTestId("requirement-link-error-" + f.groups.reversed)).toContainText("changed since this revision was read");
      for (const group of [f.groups.selected, f.groups.other]) {
        await expect(page.getByTestId("requirement-link-state-" + group)).toContainText("not active on the approved requirement version");
        await expect(page.getByTestId("requirement-link-notice-" + group)).toHaveCount(0);
      }
      const afterEditResponse = await ownerApi.get(coverageUrl);
      expect(afterEditResponse.ok(), await afterEditResponse.text()).toBe(true);
      const afterEdit = await afterEditResponse.json();
      for (const keys of [["AC-1", "AC-2"], ["AC-3"]]) {
        const confirmed = after.cases.find((entry: { criterionKeys: string[] }) => JSON.stringify(entry.criterionKeys) === JSON.stringify(keys));
        const current = afterEdit.cases.filter((entry: { criterionKeys: string[] }) => JSON.stringify(entry.criterionKeys) === JSON.stringify(keys));
        expect(current).toHaveLength(1);
        expect(current[0]).toMatchObject({ linkId: confirmed.linkId, approved: false, requirementVersionId: f.approvedVersionId,
          testcaseRevision: f.caseBasis.editRevision, testcaseApprovalRevision: f.caseBasis.approvalRevision });
      }
      expect(activationPosts).toHaveLength(3);
      expect(snapshot()).toBe(beforeVerify);
      await attachActivationView(page, "activation-notices-cleared-after-case-edit");
    });
  });

  for (const movedBasis of ["case", "requirement"] as const) {
    test("activation recovery does not confirm an earlier 503 from a different " + movedBasis + " approval basis", async ({ browser }) => {
      await withActivationFixture(async f => {
        const coverageUrl = base() + "/requirements/" + f.requirementId + "/coverage";
        const initial = await (await ownerApi.get(coverageUrl)).json();
        const link = initial.cases.find((entry: { requirementVersionId: string; criterionKeys: string[] }) =>
          entry.requirementVersionId === f.approvedVersionId && entry.criterionKeys.join("::") === "AC-1::AC-2");
        expect(link).toBeTruthy();
        const page = await open(browser, "/agents/tasks/" + f.taskId);
        const reapplyUrl = base() + "/requirements/" + f.requirementId + "/links/" + link.linkId + "/reapply";
        const beforeRows = scalar("SELECT jsonb_agg(to_jsonb(l) ORDER BY id)::text FROM requirement_case_links l WHERE requirement_id=" + literal(f.requirementId) + ";");
        // This 503 never reaches the service; verify no commit before the other actor proceeds.
        await page.route("**" + reapplyUrl, route => route.fulfill({ status: 503, json: { error: "Activation service unavailable" } }));
        await page.getByTestId("requirement-link-activate-" + f.groups.selected).click();
        await expect(page.getByTestId("requirement-link-error-" + f.groups.selected)).toContainText("could not be confirmed");
        await expect(page.getByTestId("requirement-link-notice-" + f.groups.selected)).toHaveCount(0);
        expect(scalar("SELECT jsonb_agg(to_jsonb(l) ORDER BY id)::text FROM requirement_case_links l WHERE requirement_id=" + literal(f.requirementId) + ";")).toBe(beforeRows);

        let requirementVersionId = f.approvedVersionId, caseBasis = f.caseBasis;
        if (movedBasis === "case") {
          const changed = await ownerApi.put(base() + "/testcases/" + f.caseId,
            { data: { title: "Later approved activation case " + randomUUID(), expectedRevision: caseBasis.editRevision } });
          expect(changed.ok(), await changed.text()).toBe(true);
          const current = await (await ownerApi.get(base() + "/testcases/" + f.caseId)).json();
          const approved = await ownerApi.post(base() + "/testcases/" + f.caseId + "/approve",
            { data: { expectedRevision: current.editRevision, expectedApprovalRevision: current.approvalRevision } });
          expect(approved.ok(), await approved.text()).toBe(true);
          caseBasis = await (await ownerApi.get(base() + "/testcases/" + f.caseId)).json();
          expect(caseBasis.editRevision).not.toBe(f.caseBasis.editRevision);
        } else {
          requirementVersionId = await approveNewRequirementBasis(f, { linkId: link.linkId,
            requirementVersionId: link.requirementVersionId, criterionKeys: link.criterionKeys });
          expect(requirementVersionId).not.toBe(f.approvedVersionId);
        }
        // A separate actual human API action activates the NEW basis. It must never prove that
        // the earlier browser request committed on its captured requirement/case revisions.
        const activated = await ownerApi.post(reapplyUrl, { data: { expectedRequirementVersionId: requirementVersionId,
          expectedCaseRevision: caseBasis.editRevision, expectedApprovalRevision: caseBasis.approvalRevision } });
        expect(activated.ok(), await activated.text()).toBe(true);
        const activatedBody = await activated.json();
        await page.getByRole("button", { name: "Verify activation outcomes", exact: true }).click();
        await expect(page.getByTestId("requirement-link-state-" + f.groups.selected)).toContainText("active on the approved requirement version");
        await expect(page.getByTestId("requirement-link-error-" + f.groups.selected)).toContainText("could not be confirmed");
        await expect(page.getByTestId("requirement-link-notice-" + f.groups.selected)).toHaveCount(0);
        const after = await (await ownerApi.get(coverageUrl)).json();
        expect(after.cases.find((entry: { linkId: string }) => entry.linkId === activatedBody.link.id))
          .toMatchObject({ approved: true, requirementVersionId, testcaseRevision: caseBasis.editRevision,
            testcaseApprovalRevision: caseBasis.approvalRevision });
        await attachActivationView(page, "activation-unconfirmed-after-new-" + movedBasis + "-basis");
      });
    });
  }

  test("activation refuses the displayed stale requirement basis and preserves its error after the group disappears", async ({ browser }) => {
    await withActivationFixture(async f => {
      const page = await open(browser, "/agents/tasks/" + f.taskId);
      await expect(page.getByTestId("requirement-link-activate-" + f.groups.selected)).toBeEnabled();
      const newerVersion = await approveNewRequirementBasis(f);
      expect(newerVersion).not.toBe(f.approvedVersionId);
      const snapshot = () => scalar("SELECT json_build_object(" +
        "'links',(SELECT json_agg(to_jsonb(l) ORDER BY id) FROM requirement_case_links l WHERE requirement_id=" + literal(f.requirementId) + ")," +
        "'audit',(SELECT json_agg(to_jsonb(a) ORDER BY id) FROM audit_logs a WHERE entity_name=" + literal(f.requirementId) +
        " AND action='requirement_link_reapplied'))::text;");
      const before = snapshot();
      await page.getByTestId("requirement-link-activate-" + f.groups.selected).click();
      await expect(page.getByTestId("requirement-link-error-" + f.groups.selected)).toContainText("approved requirement version changed");
      await expect(page.getByTestId("requirement-coverage-approved-version")).toContainText(newerVersion);
      await expect(page.getByTestId("requirement-coverage-case-" + f.groups.selected)).toHaveCount(0);
      await expect(page.getByTestId("requirement-link-error-" + f.groups.selected)).toBeVisible();
      await expect(page.getByTestId("requirement-link-notice-" + f.groups.selected)).toHaveCount(0);
      expect(snapshot()).toBe(before);
      await attachActivationView(page, "activation-stale-requirement-error-without-current-group");
    });
  });

  test("activation accepts documented manager role aliases and still refuses a QA reader without writes", async ({ browser }) => {
    await withActivationFixture(async f => {
      const snapshot = () => scalar("SELECT jsonb_agg(to_jsonb(l) ORDER BY id)::text FROM requirement_case_links l WHERE requirement_id=" + literal(f.requirementId) + ";");
      try {
        // FEATURE_DOCUMENTATION's role contract and the existing project/KB role parser define
        // these as manager aliases. The earlier raw-role-denial expectation was the wrong oracle.
        for (const [role, group] of [["admin", f.groups.selected], ["test_manager", f.groups.other]]) {
          exec("UPDATE project_members SET role=" + literal(role) + " WHERE project_id=" +
            literal(tenant!.mainProjectId) + " AND user_id=" + literal(tenant!.qa.userId) + ";");
          const page = await open(browser, "/agents/tasks/" + f.taskId, "qa");
          await expect(page.getByTestId("requirement-link-activate-" + group)).toBeEnabled();
          const responsePromise = page.waitForResponse(response =>
            response.request().method() === "POST" && response.url().includes("/requirements/" + f.requirementId + "/links/") &&
            response.url().endsWith("/reapply"));
          await page.getByTestId("requirement-link-activate-" + group).click();
          const activated = await responsePromise;
          expect(activated.ok(), await activated.text()).toBe(true);
          const result = await activated.json();
          await expect(page.getByTestId("requirement-link-notice-" + group)).toContainText(result.link.id);
          expect(result.link).toMatchObject({ state: "active", requirementVersionId: f.approvedVersionId,
            testcaseRevision: f.caseBasis.editRevision, testcaseApprovalRevision: f.caseBasis.approvalRevision });
          expect(scalar("SELECT applied_by FROM requirement_case_links WHERE id=" + literal(result.link.id) + ";")).toBe(tenant!.qa.userId);
          expect(scalar("SELECT COUNT(*)::int FROM audit_logs WHERE action='requirement_link_reapplied' AND entity_id=" +
            literal(result.link.id) + " AND actor_id=" + literal(tenant!.qa.userId) + ";")).toBe("1");
          await page.close();
        }
      } finally {
        exec("UPDATE project_members SET role='qa_engineer' WHERE project_id=" + literal(tenant!.mainProjectId) +
          " AND user_id=" + literal(tenant!.qa.userId) + ";");
      }
      const beforeRows = snapshot();
      const beforeAudit = scalar("SELECT COUNT(*)::int FROM audit_logs WHERE entity_name=" + literal(f.requirementId) + " AND action='requirement_link_reapplied';");
      const qaPage = await open(browser, "/agents/tasks/" + f.taskId, "qa");
      await expect(qaPage.getByTestId("requirement-link-readonly-" + f.groups.reversed)).toBeVisible();
      await expect(qaPage.getByTestId("requirement-link-activate-" + f.groups.reversed)).toHaveCount(0);
      const coverage = await (await qaApi.get(base() + "/requirements/" + f.requirementId + "/coverage")).json();
      const link = coverage.cases.find((entry: { criterionKeys: string[] }) => entry.criterionKeys.join("::") === "AC-2::AC-1");
      const refused = await qaApi.post(base() + "/requirements/" + f.requirementId + "/links/" + link.linkId + "/reapply",
        { data: { expectedRequirementVersionId: f.approvedVersionId,
          expectedCaseRevision: f.caseBasis.editRevision, expectedApprovalRevision: f.caseBasis.approvalRevision } });
      expect(refused.status()).toBe(403);
      expect(snapshot()).toBe(beforeRows);
      expect(scalar("SELECT COUNT(*)::int FROM audit_logs WHERE entity_name=" + literal(f.requirementId) + " AND action='requirement_link_reapplied';")).toBe(beforeAudit);
    });
  });

  test("bundle apply accepts documented legacy manager aliases and refuses a QA reader without publishing", async ({ browser }) => {
    const suffix = randomUUID();
    const skillDocs: string[] = [];
    const taskIds: string[] = [];
    const requirementIds: string[] = [];
    const caseIds: string[] = [];
    try {
      for (const [module, subtype, operation] of [
        ["requirements", "functional", "requirement_revision"],
        ["requirements", "functional", "requirement_case_link"],
        ["test_cases", "manual", "testcase_create"],
      ]) skillDocs.push((await apiSkill(module, subtype, operation)).documentId);

      const stage = async () => {
        const requirementOperationId = randomUUID(), testcaseOperationId = randomUUID();
        const response = await ownerApi.post(base() + "/requirements/proposals", { data: {
          requestKey: `apply-role-${suffix}-${randomUUID()}`, title: `Apply role bundle ${suffix}`,
          operations: [
            { opType: "requirement_revision", operationId: requirementOperationId,
              title: `Apply role requirement ${suffix}`, description: "Legacy-role apply fixture.",
              criteria: [{ key: "AC-1", text: "The obligation is observable" }] },
            { opType: "testcase_create", operationId: testcaseOperationId, draft: { title: `Apply role case ${suffix}` } },
            { opType: "requirement_case_link", operationId: randomUUID(), requirementOperationId, testcaseOperationId, criterionKeys: ["AC-1"] },
          ],
        } });
        expect(response.ok(), await response.text()).toBe(true);
        const staged = await response.json();
        taskIds.push(staged.id);
        return staged;
      };

      // The role parser treats both legacy names as the manager interpretation, at the HTTP
      // boundary the browser actually calls — not only in the DB service spec.
      for (const role of ["admin", "test_manager"]) {
        const staged = await stage();
        exec("UPDATE project_members SET role=" + literal(role) + " WHERE project_id=" +
          literal(tenant!.mainProjectId) + " AND user_id=" + literal(tenant!.qa.userId) + ";");
        const page = await open(browser, "/agents/tasks/" + staged.id, "qa");
        const responsePromise = page.waitForResponse(response =>
          response.request().method() === "POST" && response.url().includes("/proposals/" + staged.id + "/apply"));
        await page.getByTestId("requirement-bundle-apply").click();
        const appliedResponse = await responsePromise;
        expect(appliedResponse.status(), await appliedResponse.text()).toBe(201);
        const applied = await appliedResponse.json();
        // The browser session's identity, not merely the owner's, is what the apply receipt names.
        expect(applied.receipt.reviewerId).toBe(tenant!.qa.userId);
        requirementIds.push(applied.receipt.requirement.documentId);
        caseIds.push(applied.receipt.testcase.id);
        await page.reload();
        await expect(page.getByTestId("requirement-bundle-publication-gate")).toContainText("This bundle is published");
        await page.close();
      }

      // A raw QA reader still gets the same refusal, and the bundle stays unpublished.
      exec("UPDATE project_members SET role='qa_engineer' WHERE project_id=" + literal(tenant!.mainProjectId) +
        " AND user_id=" + literal(tenant!.qa.userId) + ";");
      const refused = await stage();
      const requirementRows = () => scalar("SELECT COUNT(*)::int FROM knowledge_documents WHERE project_id=" +
        literal(tenant!.mainProjectId) + " AND title=" + literal(`Apply role requirement ${suffix}`) + ";");
      const caseRows = () => scalar("SELECT COUNT(*)::int FROM testcases WHERE project_id=" +
        literal(tenant!.mainProjectId) + " AND title=" + literal(`Apply role case ${suffix}`) + ";");
      const linkRows = () => scalar("SELECT COUNT(*)::int FROM requirement_case_links l JOIN knowledge_documents d " +
        "ON d.id=l.requirement_id AND d.project_id=l.project_id WHERE l.project_id=" + literal(tenant!.mainProjectId) +
        " AND d.title=" + literal(`Apply role requirement ${suffix}`) + ";");
      const beforeRefusal = { requirements: requirementRows(), cases: caseRows(), links: linkRows() };
      const page = await open(browser, "/agents/tasks/" + refused.id, "qa");
      const refusedPromise = page.waitForResponse(response =>
        response.request().method() === "POST" && response.url().includes("/proposals/" + refused.id + "/apply"));
      await page.getByTestId("requirement-bundle-apply").click();
      expect((await refusedPromise).status()).toBe(403);
      expect(scalar("SELECT task_status FROM ai_generation_requests WHERE id=" + literal(refused.id) + ";")).toBe("in_review");
      // The two legacy applies above share this title; the refusal must add nothing.
      expect({ requirements: requirementRows(), cases: caseRows(), links: linkRows() }).toEqual(beforeRefusal);
      await page.close();
    } finally {
      exec("UPDATE project_members SET role='qa_engineer' WHERE project_id=" + literal(tenant!.mainProjectId) +
        " AND user_id=" + literal(tenant!.qa.userId) + ";");
      for (const id of taskIds) exec("DELETE FROM ai_generation_requests WHERE id=" + literal(id) + " AND project_id=" + literal(tenant!.mainProjectId) + ";");
      for (const id of requirementIds) {
        exec("DELETE FROM requirement_case_links WHERE project_id=" + literal(tenant!.mainProjectId) + " AND requirement_id=" + literal(id) + ";");
        exec("DELETE FROM requirement_profiles WHERE document_id=" + literal(id) + ";");
        exec("UPDATE knowledge_documents SET reviewed_version_id=NULL WHERE id=" + literal(id) + ";");
        exec("DELETE FROM knowledge_documents WHERE id=" + literal(id) + " AND project_id=" + literal(tenant!.mainProjectId) + ";");
      }
      for (const id of caseIds) exec("DELETE FROM testcases WHERE id=" + literal(id) + " AND project_id=" + literal(tenant!.mainProjectId) + ";");
      for (const id of skillDocs) {
        exec("DELETE FROM skill_assignments WHERE project_id=" + literal(tenant!.mainProjectId) + " AND skill_document_id=" + literal(id) + ";");
        exec("UPDATE knowledge_documents SET reviewed_version_id=NULL WHERE id=" + literal(id) + ";");
        exec("DELETE FROM knowledge_documents WHERE id=" + literal(id) + " AND project_id=" + literal(tenant!.mainProjectId) + ";");
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
            description: "Fixture for the task review surface.", criteria: [
              { key: "AC-1", text: "The obligation is observable" },
              { key: "AC-2", text: "A second criterion supports distinct ordered link groups" },
            ] },
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
      const caseGroup = `${caseId}::AC-1`;

      const page = await open(browser, `/agents/tasks/${taskId}`);
      await expect(page.getByTestId("requirement-change-bundle")).toContainText("Applied. The persisted apply receipt");
      const review = page.getByTestId("requirement-review-panel");
      await expect(review).toBeVisible();
      // Activation is not offered until the exact requirement version is approved.
      await expect(page.getByTestId(`requirement-link-requirement-unapproved-${caseGroup}`)).toBeVisible();
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

      // Case approval is a separate human action. Keep it via the API in this fixture, then use
      // the review surface for the explicitly separate link activation.
      const caseBefore = await (await ownerApi.get(`${base()}/testcases/${caseId}`)).json();
      const approvedCase = await ownerApi.post(`${base()}/testcases/${caseId}/approve`, {
        data: { expectedRevision: caseBefore.editRevision, expectedApprovalRevision: caseBefore.approvalRevision }
      });
      expect(approvedCase.ok(), await approvedCase.text()).toBe(true);
      const caseAfter = await (await ownerApi.get(`${base()}/testcases/${caseId}`)).json();
      await page.reload();
      const caseLinkState = page.getByTestId(`requirement-link-state-${caseGroup}`);
      await expect(caseLinkState).toContainText("not active on the approved requirement version");
      await expect(page.getByTestId(`requirement-link-case-revision-${caseGroup}`)).toContainText(caseAfter.editRevision);
      await expect(page.getByTestId(`requirement-link-case-revision-${caseGroup}`)).toContainText(caseAfter.approvalRevision);
      await expect(page.getByTestId(`requirement-link-activate-${caseGroup}`)).toBeVisible();

      // A reader can inspect the exact revisions but cannot activate.
      const qaActivation = await open(browser, `/agents/tasks/${taskId}`, "qa");
      await expect(qaActivation.getByTestId(`requirement-link-readonly-${caseGroup}`)).toBeVisible();
      await expect(qaActivation.getByTestId(`requirement-link-activate-${caseGroup}`)).toHaveCount(0);
      await qaActivation.close();

      // Stale case revision: change the case after the exact revision was read; activation is
      // refused and the surface re-reads the current state.
      const changedCase = await ownerApi.put(`${base()}/testcases/${caseId}`, {
        data: { title: `${caseTitle} changed`, expectedRevision: caseAfter.editRevision }
      });
      expect(changedCase.ok(), await changedCase.text()).toBe(true);
      await page.getByTestId(`requirement-link-activate-${caseGroup}`).click();
      await expect(page.getByTestId(`requirement-link-error-${caseGroup}`)).toContainText("changed since this revision");
      // Requirement approval copies the link onto the approved version; both generations stay
      // active until a successful activation retires them. A refused activation writes neither.
      expect(scalar(`SELECT COUNT(*)::int FROM requirement_case_links WHERE project_id=${literal(tenant!.mainProjectId)} AND requirement_id=${literal(requirementId)} AND state='active';`)).toBe("2");

      // Restore the exact title and, if the edit invalidated approval, re-approve the current case
      // revision before the real activation.
      const changedAfter = await (await ownerApi.get(`${base()}/testcases/${caseId}`)).json();
      const restoredCase = await ownerApi.put(`${base()}/testcases/${caseId}`, {
        data: { title: caseTitle, expectedRevision: changedAfter.editRevision }
      });
      expect(restoredCase.ok(), await restoredCase.text()).toBe(true);
      let restoredCaseRecord = await (await ownerApi.get(`${base()}/testcases/${caseId}`)).json();
      if (!restoredCaseRecord.approvalCurrent) {
        const reapproved = await ownerApi.post(`${base()}/testcases/${caseId}/approve`, {
          data: { expectedRevision: restoredCaseRecord.editRevision, expectedApprovalRevision: restoredCaseRecord.approvalRevision }
        });
        expect(reapproved.ok(), await reapproved.text()).toBe(true);
        restoredCaseRecord = await (await ownerApi.get(`${base()}/testcases/${caseId}`)).json();
      }
      const caseReady = restoredCaseRecord;
      await page.reload();
      await expect(page.getByTestId(`requirement-link-case-revision-${caseGroup}`)).toContainText(caseReady.editRevision);
      await expect(page.getByTestId(`requirement-link-activate-${caseGroup}`)).toBeVisible();

      // Lost activation response: hold the reconciliation coverage read, prove no success is
      // claimed, then reconcile the single active link from authoritative coverage.
      const linkBefore = await (await ownerApi.get(`${base()}/requirements/${requirementId}/coverage`)).json();
      // The surface prefers the link generation on the approved requirement version.
      const activeLink = linkBefore.cases.find((item: Record<string, any>) =>
        item.testcaseId === caseId && item.requirementVersionId === linkBefore.approvedVersionId)
        || linkBefore.cases.find((item: Record<string, any>) => item.testcaseId === caseId);
      expect(activeLink, "active link before activation").toBeTruthy();
      const reapplyEndpoint = `**/api/projects/${tenant!.mainProjectId}/requirements/${requirementId}/links/${activeLink.linkId}/reapply`;
      const coverageHoldEndpoint = `**/api/projects/${tenant!.mainProjectId}/requirements/${requirementId}/coverage`;
      let holdCoverage = false;
      let releaseCoverage!: () => void;
      let coverageHeld!: () => void;
      const activationHeld = new Promise<void>((resolve) => { coverageHeld = resolve; });
      const activationRelease = new Promise<void>((resolve) => { releaseCoverage = resolve; });
      await page.route(coverageHoldEndpoint, async (route) => {
        if (!holdCoverage) return route.continue();
        holdCoverage = false;
        coverageHeld();
        await activationRelease;
        return route.continue();
      });
      await page.route(reapplyEndpoint, async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        const actual = await route.fetch();
        expect(actual.ok(), await actual.text()).toBe(true);
        holdCoverage = true;
        await route.abort("failed");
      });
      await page.getByTestId(`requirement-link-activate-${caseGroup}`).click();
      await activationHeld;
      await expect(page.getByTestId(`requirement-link-error-${caseGroup}`)).toContainText("could not be confirmed");
      await expect(page.getByTestId(`requirement-link-notice-${caseGroup}`)).toHaveCount(0);
      releaseCoverage();
      await expect(page.getByTestId(`requirement-link-notice-${caseGroup}`)).toContainText("verified after an unconfirmed response");
      await expect(page.getByTestId(`requirement-link-error-${caseGroup}`)).toHaveCount(0);
      await expect(page.getByTestId("requirement-coverage-readings")).toContainText("Approved: yes");
      expect(scalar(`SELECT COUNT(*)::int FROM requirement_case_links WHERE project_id=${literal(tenant!.mainProjectId)} AND requirement_id=${literal(requirementId)} AND state='active';`)).toBe("1");
      const active = scalar(`SELECT id FROM requirement_case_links WHERE project_id=${literal(tenant!.mainProjectId)} AND requirement_id=${literal(requirementId)} AND state='active';`);
      expect(scalar(`SELECT testcase_revision FROM requirement_case_links WHERE id=${literal(active)};`)).toBe(caseReady.editRevision);
      expect(scalar(`SELECT testcase_approval_revision FROM requirement_case_links WHERE id=${literal(active)};`)).toBe(caseReady.approvalRevision);
      await page.unroute(coverageHoldEndpoint);
      await page.unroute(reapplyEndpoint);

      // Reload reads the resulting link and coverage state back.
      await page.reload();
      await expect(page.getByTestId(`requirement-link-state-${caseGroup}`)).toContainText("active on the approved requirement version");
      await expect(page.getByTestId(`requirement-link-activate-${caseGroup}`)).toHaveCount(0);
      await expect(page.getByTestId("requirement-coverage-link-id")).toContainText(active);
      await expect(page.getByTestId("requirement-coverage-readings")).toContainText("Approved: yes");

      const runId = scalar(`INSERT INTO cycles(project_id,name) VALUES (${literal(tenant!.mainProjectId)},${literal(`UI review coverage ${suffix}`)}) RETURNING id;`);
      cycleIds.push(runId);
      const itemId = scalar(`INSERT INTO cycle_items(cycle_id,testcase_id,snapshot_approval_revision) VALUES (${literal(runId)},${literal(caseId)},${literal(caseReady.approvalRevision)}) RETURNING id;`);
      const executionId = scalar(`INSERT INTO executions(cycle_item_id,status,executed_by,executed_at)
        SELECT ${literal(itemId)},'Passed',pm.user_id,now() FROM project_members pm
         WHERE pm.project_id=${literal(tenant!.mainProjectId)}
         ORDER BY CASE pm.role WHEN 'owner' THEN 0 ELSE 1 END, pm.user_id LIMIT 1 RETURNING id;`);
      await page.reload();
      await expect(page.getByTestId("requirement-coverage-readings")).toContainText("Approved: yes");
      await expect(page.getByTestId("requirement-coverage-readings")).toContainText("Executed: yes");
      await expect(page.getByTestId("requirement-coverage-readings")).toContainText("Passing: yes");
      await expect(page.getByTestId("requirement-coverage-execution-link")).toHaveAttribute("href", new RegExp(`cycles/${runId}/execute/${executionId}`));

      // Multiple criterion groups, including a reversed array order, are distinct. A 5xx on one
      // group must stay associated with that group, leave the others untouched, and a retry must
      // activate only its own exact group.
      const groupBLink = scalar(`INSERT INTO requirement_case_links
        (project_id,requirement_id,requirement_version_id,criterion_keys,testcase_id,testcase_revision,testcase_approval_revision,state,proposed_by,applied_by,applied_at)
        VALUES (${literal(tenant!.mainProjectId)},${literal(requirementId)},${literal(linkBefore.approvedVersionId)},
          ARRAY['AC-1','AC-2']::text[],${literal(caseId)},${literal("0".repeat(64))},NULL,'active',
          ${literal(tenant!.owner.userId)},${literal(tenant!.owner.userId)},now()) RETURNING id;`);
      const groupCLink = scalar(`INSERT INTO requirement_case_links
        (project_id,requirement_id,requirement_version_id,criterion_keys,testcase_id,testcase_revision,testcase_approval_revision,state,proposed_by,applied_by,applied_at)
        VALUES (${literal(tenant!.mainProjectId)},${literal(requirementId)},${literal(linkBefore.approvedVersionId)},
          ARRAY['AC-2','AC-1']::text[],${literal(caseId)},${literal("0".repeat(64))},NULL,'active',
          ${literal(tenant!.owner.userId)},${literal(tenant!.owner.userId)},now()) RETURNING id;`);
      const groupB = `${caseId}::AC-1::AC-2`;
      const groupC = `${caseId}::AC-2::AC-1`;
      const groupBEndpoint = `**/api/projects/${tenant!.mainProjectId}/requirements/${requirementId}/links/${groupBLink}/reapply`;
      const groupCEndpoint = `**/api/projects/${tenant!.mainProjectId}/requirements/${requirementId}/links/${groupCLink}/reapply`;
      await page.reload();
      await expect(page.getByTestId(`requirement-link-state-${groupB}`)).toContainText("not active on the approved requirement version");
      await expect(page.getByTestId(`requirement-link-state-${groupC}`)).toContainText("not active on the approved requirement version");
      await expect(page.getByTestId(`requirement-link-state-${groupB}`)).toContainText("Activation is needed because");
      await expect(page.getByTestId(`requirement-link-activate-${groupB}`)).toBeVisible();
      await expect(page.getByTestId(`requirement-link-activate-${groupC}`)).toBeVisible();

      await page.route(groupBEndpoint, (route) => route.fulfill({ status: 503, json: { error: "Activation service unavailable" } }));
      await page.route(groupCEndpoint, (route) => route.fulfill({ status: 503, json: { error: "Activation service unavailable" } }));
      await page.getByTestId(`requirement-link-activate-${groupB}`).click();
      await expect(page.getByTestId(`requirement-link-error-${groupB}`)).toContainText("could not be confirmed");
      await page.getByTestId(`requirement-link-activate-${groupC}`).click();
      await expect(page.getByTestId(`requirement-link-error-${groupC}`)).toContainText("could not be confirmed");
      // The first group's uncertain outcome is still present after the second group errors.
      await expect(page.getByTestId(`requirement-link-error-${groupB}`)).toBeVisible();
      await expect(page.getByTestId(`requirement-link-notice-${groupB}`)).toHaveCount(0);
      await expect(page.getByTestId(`requirement-link-notice-${groupC}`)).toHaveCount(0);
      expect(scalar(`SELECT COUNT(*)::int FROM requirement_case_links WHERE id IN (${literal(groupBLink)},${literal(groupCLink)}) AND state='active';`)).toBe("2");

      await page.unroute(groupBEndpoint);
      await page.unroute(groupCEndpoint);
      await page.getByTestId(`requirement-link-activate-${groupB}`).click();
      await expect(page.getByTestId(`requirement-link-notice-${groupB}`)).toBeVisible();
      await page.getByTestId(`requirement-link-activate-${groupC}`).click();
      await expect(page.getByTestId(`requirement-link-notice-${groupC}`)).toBeVisible();
      await expect(page.getByTestId(`requirement-link-notice-${groupB}`)).toBeVisible();
      await expect(page.getByTestId(`requirement-link-state-${caseGroup}`)).toContainText("active on the approved requirement version");
      const groupBActive = scalar(`SELECT id FROM requirement_case_links WHERE project_id=${literal(tenant!.mainProjectId)} AND requirement_id=${literal(requirementId)} AND testcase_id=${literal(caseId)} AND criterion_keys=ARRAY['AC-1','AC-2']::text[] AND state='active';`);
      const groupCActive = scalar(`SELECT id FROM requirement_case_links WHERE project_id=${literal(tenant!.mainProjectId)} AND requirement_id=${literal(requirementId)} AND testcase_id=${literal(caseId)} AND criterion_keys=ARRAY['AC-2','AC-1']::text[] AND state='active';`);
      expect(groupBActive).not.toBe(groupBLink);
      expect(groupCActive).not.toBe(groupCLink);
      expect(scalar(`SELECT state FROM requirement_case_links WHERE id=${literal(active)};`)).toBe("active");
      expect(scalar(`SELECT COUNT(*)::int FROM requirement_case_links WHERE project_id=${literal(tenant!.mainProjectId)} AND requirement_id=${literal(requirementId)} AND state='active';`)).toBe("3");

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
      await page.getByRole("tab", { name: /^Assignments/ }).click();
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
          const refresh = page.getByTestId("skills-refresh");
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
      await page.getByRole("tab", { name: /^Assignments/ }).click();
      await expect(page.getByTestId("skill-history-unavailable")).toBeVisible();
      await expect(page.getByTestId("skill-readiness-requirement_revision")).toContainText("Unavailable");
      await page.getByTestId("skill-review-current").click();
      await expect(page.getByTestId("skill-review-content")).toContainText("RULE-V2");
      await expect(page.getByTestId("skill-review-approve")).toBeDisabled();
      await page.unroute(`**${base()}/skills`);
      await page.getByTestId("skills-refresh").click();
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
      const refresh = page.getByTestId("skills-refresh");
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
      const refresh = page.getByTestId("skills-refresh");
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
      await page.getByTestId("skill-library-search").fill("RULE-HTML-ONLY");
      await expect(page.getByTestId(`skill-${doc.id}`)).toBeVisible();
      await expect(page.getByTestId("skill-library-result-count")).toContainText("1 result");
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
      const refresh = page.getByTestId("skills-refresh");
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
    const requestKeys: string[] = [];
    try {
      const page = await open(browser, "/settings/skills");
      page.on("request", (request) => {
        if (request.method() === "POST" && new URL(request.url()).pathname === `${base()}/skills`) requestKeys.push(request.postDataJSON().requestKey);
      });
      const endpoint = `**/api/projects/${tenant!.mainProjectId}/skills`;
      await page.route(endpoint, async (route) => {
        if (route.request().method() !== "POST" || dropped) return route.continue();
        dropped = true;
        const response = await route.fetch(); // the native creation commits
        createdSkillKey = (await response.json()).skillKey;
        await route.abort(); // ...but the client never receives the response
      });
      await page.getByTestId("skill-candidate-open").click();
      await page.getByTestId("skill-title").fill(title);
      await page.getByTestId("skill-subtype").fill("functional");
      await page.getByTestId("skill-instructions").fill("RULE-LOST: preserve one candidate across an uncertain creation response.");
      await page.getByTestId("skill-create-submit").click();
      await expect(page.getByTestId("skill-create-submit")).toBeEnabled();
      await expect(page.getByTestId("skill-title")).toHaveValue(title);
      await page.unroute(endpoint);
      await page.getByTestId("skill-candidate-close").click();
      await page.reload();
      await page.getByTestId("skill-candidate-open").click();
      await expect(page.getByTestId("skill-title")).toHaveValue(title);
      await expect(page.getByTestId("skill-instructions")).toHaveValue("RULE-LOST: preserve one candidate across an uncertain creation response.");
      await page.getByTestId("skill-create-submit").click();
      await expect(page.getByText(/Skill candidate submitted as version/)).toBeVisible();
      expect(dropped).toBe(true);
      expect(requestKeys).toHaveLength(2);
      expect(requestKeys[0]).toMatch(/^[a-f0-9-]{36}$/);
      expect(requestKeys[1]).toBe(requestKeys[0]);
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

  test("a coding agent stages a pinned-Skill manual candidate and an owner applies a native draft", async ({ browser }) => {
    const suffix = randomUUID();
    const skill = await apiSkill("user_manuals", "internal", "manual_revision");
    const metadata = {
      schemaVersion: "tesbo-governed-document/1", audience: "internal", subtype: "manual", confidentiality: "internal",
      distribution: "internal", sourceAuthority: { kind: "internal", label: "Project owner", reference: null },
      effectivity: { from: null, to: null }, enforcementRefs: [],
    };
    const created = await ownerApi.post(`${base()}/knowledge-base/documents`, { data: {
      title: `Agent manual target ${suffix}`, folderId: (await (await ownerApi.get(`${base()}/knowledge-base/folders/tree`)).json()).id,
      documentType: "user_manual", contentText: "Base manual body", contentHtml: "<p>Base manual body</p>",
      contentJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Base manual body" }] }] },
      governedMetadata: metadata,
    } });
    expect(created.ok(), await created.text()).toBe(true);
    const target = await created.json();
    const issued = await ownerApi.post(`${base()}/apikeys`, { data: { name: `Agent document proposal ${suffix}`, scopes: ["read", "write"] } });
    expect(issued.ok(), await issued.text()).toBe(true);
    const token = await issued.json();
    const tasks: string[] = [];
    try {
      const stagedResponse = await ownerApi.post(`${base()}/knowledge-base/document-proposals`, {
        headers: { Authorization: `Bearer ${token.token}` },
        data: {
          requestKey: `agent-manual-${suffix}`, operation: "update", documentId: target.id, expectedRevision: target.editRevision,
          document: { title: `${target.title} revised`, contentText: "Revised manual body", contentHtml: "<p>Revised manual body</p>",
            contentJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Revised manual body" }] }] },
            governedMetadata: { ...metadata, confidentiality: "confidential" } },
          reason: "Security update",
        },
      });
      expect(stagedResponse.ok(), await stagedResponse.text()).toBe(true);
      const staged = await stagedResponse.json();
      tasks.push(staged.id);
      expect(staged.skillContext).toMatchObject({ status: "resolved" });
      const before = await (await ownerApi.get(`${base()}/knowledge-base/documents/${target.id}`)).json();
      expect(before).toMatchObject({ contentText: "Base manual body", status: "draft", editRevision: target.editRevision });
      // A project member without the owner/manager role cannot decide the candidate.
      const qaApply = await qaApi.post(`${base()}/knowledge-base/document-proposals/${staged.id}/apply`, {
        data: { expectedProposalRevision: staged.proposalRevision }, failOnStatusCode: false,
      });
      expect(qaApply.status()).toBe(403);
      // The generic draft editor is not the owner/manager decision surface either.
      const genericDelete = await ownerApi.delete(`${base()}/agents/zyra/tasks/${staged.id}/drafts/0`, { failOnStatusCode: false });
      expect(genericDelete.status()).toBe(409);
      expect((await genericDelete.json()).code).toBe("MANAGED_DOCUMENT_PROPOSAL_IMMUTABLE");

      const page = await open(browser, `/agents/tasks/${staged.id}`);
      const panel = page.getByTestId("managed-document-proposal");
      await expect(panel).toBeVisible();
      await expect(panel).toContainText("Proposed governed manual");
      await expect(panel).toContainText("Revised manual body");
      await expect(panel).toContainText("Skill: current");
      await page.getByTestId("managed-document-apply").click();
      await expect(page.getByTestId("managed-document-apply-receipt")).toContainText("native Draft");
      const applied = await (await ownerApi.get(`${base()}/knowledge-base/documents/${target.id}`)).json();
      expect(applied).toMatchObject({ contentText: "Revised manual body", status: "draft", reviewedVersionId: null });
      expect(applied.governedMetadata).toMatchObject({ confidentiality: "confidential" });
      // The full representation set is applied together, so every surface shows the same Draft.
      expect(applied.contentHtml).toBe("<p>Revised manual body</p>");
      expect(applied.contentJson).toEqual({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Revised manual body" }] }] });
      await expect(panel).toContainText("Producer: api_token");

      const staleResponse = await ownerApi.post(`${base()}/knowledge-base/document-proposals`, {
        headers: { Authorization: `Bearer ${token.token}` },
        data: {
          requestKey: `agent-manual-stale-${suffix}`, operation: "update", documentId: target.id,
          expectedRevision: applied.editRevision,
          document: { title: `${target.title} stale`, contentText: "Stale body", contentHtml: "<p>Stale body</p>",
            contentJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Stale body" }] }] },
            governedMetadata: metadata },
        },
      });
      expect(staleResponse.ok(), await staleResponse.text()).toBe(true);
      const stale = await staleResponse.json();
      tasks.push(stale.id);
      const revoked = await ownerApi.patch(`${base()}/skill-assignments/${skill.assignmentId}/deactivate`, { data: {} });
      expect(revoked.ok(), await revoked.text()).toBe(true);
      const stalePage = await open(browser, `/agents/tasks/${stale.id}`);
      await expect(stalePage.getByTestId("managed-document-proposal")).toContainText("Skill: stale");
      await expect(stalePage.getByTestId("managed-document-apply")).toBeDisabled();
      await expect(stalePage.getByTestId("managed-document-proposal")).toContainText("Apply is blocked");
      // The disabled button is not the boundary: a direct decision is refused server-side too.
      const staleDecision = await ownerApi.post(`${base()}/knowledge-base/document-proposals/${stale.id}/apply`, {
        data: { expectedProposalRevision: stale.proposalRevision }, failOnStatusCode: false,
      });
      expect(staleDecision.status()).toBe(409);
      expect((await staleDecision.json()).code).toBe("DOCUMENT_PROPOSAL_SKILL_STALE");
      expect((await (await ownerApi.get(`${base()}/knowledge-base/documents/${target.id}`)).json()).contentText).toBe("Revised manual body");
    } finally {
      for (const id of tasks) exec(`DELETE FROM ai_generation_requests WHERE id=${literal(id)} AND project_id=${literal(tenant!.mainProjectId)};`);
      await ownerApi.delete(`${base()}/apikeys/${token.id}`, { failOnStatusCode: false });
      exec(`UPDATE knowledge_documents SET reviewed_version_id=NULL WHERE id=${literal(target.id)};`);
      exec(`DELETE FROM knowledge_documents WHERE id=${literal(target.id)} AND project_id=${literal(tenant!.mainProjectId)};`);
      await cleanupSkill(skill.documentId);
    }
  });

  test("an owner discovers, pages, opens and applies pending document proposals from Tasks", async ({ browser }) => {
    const suffix = randomUUID().slice(0, 8);
    const skill = await apiSkill("user_manuals", "internal", "manual_revision");
    const metadata = {
      schemaVersion: "tesbo-governed-document/1", audience: "internal", subtype: "manual", confidentiality: "internal",
      distribution: "internal", sourceAuthority: { kind: "internal", label: "Project owner", reference: null },
      effectivity: { from: null, to: null }, enforcementRefs: [],
    };
    const created = await ownerApi.post(`${base()}/knowledge-base/documents`, { data: {
      title: `Discovery manual ${suffix}`, folderId: (await (await ownerApi.get(`${base()}/knowledge-base/folders/tree`)).json()).id,
      documentType: "user_manual", contentText: "Base discovery body", contentHtml: "<p>Base discovery body</p>",
      contentJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Base discovery body" }] }] },
      governedMetadata: metadata,
    } });
    expect(created.ok(), await created.text()).toBe(true);
    const target = await created.json();
    const issued = await ownerApi.post(`${base()}/apikeys`, { data: { name: `Discovery agent ${suffix}`, scopes: ["read", "write"] } });
    expect(issued.ok(), await issued.text()).toBe(true);
    const token = await issued.json();
    const tasks: string[] = [];
    try {
      for (let index = 0; index < 11; index++) {
        const staged = await ownerApi.post(`${base()}/knowledge-base/document-proposals`, {
          headers: { Authorization: `Bearer ${token.token}` },
          data: {
            requestKey: `discovery-${suffix}-${index}`, operation: "update", documentId: target.id,
            expectedRevision: target.editRevision,
            document: { title: `Discovery ${suffix} v${index}`, governedMetadata: metadata },
            reason: `Discovery candidate ${index}`,
          },
        });
        expect(staged.ok(), await staged.text()).toBe(true);
        tasks.push((await staged.json()).id);
      }

      const page = await open(browser, "/agents/tasks");
      await page.getByRole("tab", { name: "Document proposals" }).click();
      await expect(page.getByTestId("managed-document-proposals")).toBeVisible();
      await page.getByTestId("managed-document-search").fill(suffix);
      await page.getByTestId("managed-document-search-submit").click();
      await expect(page.getByTestId("managed-document-range")).toContainText("Showing 1–10 of 11");
      // A limited page is labelled as such and the next page is reachable.
      await page.getByTestId("managed-document-next").click();
      await expect(page.getByTestId("managed-document-range")).toContainText("Showing 11–11 of 11");
      await expect(page.getByTestId("managed-document-next")).toBeDisabled();
      await page.getByTestId("managed-document-prev").click();
      await expect(page.getByTestId("managed-document-range")).toContainText("Showing 1–10 of 11");

      await page.getByTestId("managed-document-type-filter").selectOption("policy");
      await expect(page.getByTestId("managed-document-empty")).toBeVisible();
      await page.getByTestId("managed-document-type-filter").selectOption("");
      await page.getByTestId("managed-document-operation-filter").selectOption("create");
      await expect(page.getByTestId("managed-document-empty")).toBeVisible();
      await page.getByTestId("managed-document-operation-filter").selectOption("");
      await page.getByTestId("managed-document-status-filter").selectOption("failed");
      await expect(page.getByTestId("managed-document-empty")).toBeVisible();
      await page.getByTestId("managed-document-status-filter").selectOption("pending");
      await expect(page.getByTestId("managed-document-range")).toContainText("Showing 1–10 of 11");

      const firstCard = page.getByTestId("managed-document-card").first();
      await expect(firstCard).toContainText("Manual");
      await expect(firstCard).toContainText("Update");
      await expect(firstCard).toContainText("API token");
      // The owner positive branch: no authority blocker while Skill and target are current.
      await expect(firstCard).toContainText("Apply is currently permitted");
      await firstCard.getByTestId("managed-document-open").click();
      await expect(page.getByTestId("managed-document-proposal")).toBeVisible();
      await expect(page.getByTestId("managed-document-proposal")).toContainText("Proposed governed manual");
      await page.getByTestId("managed-document-apply").click();
      await expect(page.getByTestId("managed-document-apply-receipt")).toContainText("native Draft");
      await expect(page.getByTestId("managed-document-apply-receipt").getByRole("link")).toHaveAttribute("href", /knowledge-base\/documents\//);

      // Returning re-reads the pending set: the applied candidate is gone, and the remaining
      // candidates are visibly based on the pre-apply target revision.
      await page.goto(`/projects/${tenant!.mainProjectId}/agents/tasks`);
      await page.getByRole("tab", { name: "Document proposals" }).click();
      await page.getByTestId("managed-document-search").fill(suffix);
      await page.getByTestId("managed-document-search-submit").click();
      await expect(page.getByTestId("managed-document-range")).toContainText("Showing 1–10 of 10");
      await expect(page.getByTestId("managed-document-card").first().getByTestId("managed-document-blockers")).toContainText("Target document changed since staging");
      // The detail surface agrees and refuses the doomed apply before the server does.
      await page.getByTestId("managed-document-card").first().getByTestId("managed-document-open").click();
      await expect(page.getByTestId("managed-document-target-blocker")).toContainText("target document changed");
      await expect(page.getByTestId("managed-document-apply")).toBeDisabled();
      await page.goto(`/projects/${tenant!.mainProjectId}/agents/tasks`);
      await page.getByRole("tab", { name: "Document proposals" }).click();
      await page.getByTestId("managed-document-search").fill(suffix);
      await page.getByTestId("managed-document-search-submit").click();
      await expect(page.getByTestId("managed-document-card").first().getByTestId("managed-document-blockers")).toContainText("Target document changed since staging");

      // A deactivated Skill basis is surfaced as an explicit blocker.
      const revoked = await ownerApi.patch(`${base()}/skill-assignments/${skill.assignmentId}/deactivate`, { data: {} });
      expect(revoked.ok(), await revoked.text()).toBe(true);
      await page.getByTestId("managed-document-refresh").click();
      await expect(page.getByTestId("managed-document-card").first()).toContainText("Skill: stale");
      await expect(page.getByTestId("managed-document-card").first().getByTestId("managed-document-blockers")).toContainText("Skill basis is stale");

      // A project member without the owner/manager role sees the authority blocker on the same cards.
      const qaPage = await open(browser, "/agents/tasks", "qa");
      await qaPage.getByRole("tab", { name: "Document proposals" }).click();
      await qaPage.getByTestId("managed-document-search").fill(suffix);
      await qaPage.getByTestId("managed-document-search-submit").click();
      await expect(qaPage.getByTestId("managed-document-card").first().getByTestId("managed-document-blockers")).toContainText("Only a project owner or manager");
    } finally {
      for (const id of tasks) exec(`DELETE FROM ai_generation_requests WHERE id=${literal(id)} AND project_id=${literal(tenant!.mainProjectId)};`);
      await ownerApi.delete(`${base()}/apikeys/${token.id}`, { failOnStatusCode: false });
      exec(`UPDATE knowledge_documents SET reviewed_version_id=NULL WHERE id=${literal(target.id)};`);
      exec(`DELETE FROM knowledge_documents WHERE id=${literal(target.id)} AND project_id=${literal(tenant!.mainProjectId)};`);
      await cleanupSkill(skill.documentId);
    }
  });

  test("a proposal comparison distinguishes inherited, cleared and new-document fields", async ({ browser }) => {
    const suffix = randomUUID().slice(0, 8);
    const skill = await apiSkill("user_manuals", "internal", "manual_revision");
    const metadata = {
      schemaVersion: "tesbo-governed-document/1", audience: "internal", subtype: "manual", confidentiality: "internal",
      distribution: "internal", sourceAuthority: { kind: "internal", label: "Project owner", reference: null },
      effectivity: { from: null, to: null }, enforcementRefs: [],
    };
    const root = (await (await ownerApi.get(`${base()}/knowledge-base/folders/tree`)).json()).id;
    const created = await ownerApi.post(`${base()}/knowledge-base/documents`, { data: {
      title: `Comparison target ${suffix}`, folderId: root, documentType: "user_manual",
      contentText: "Base compare text", contentHtml: "<p>Base compare text</p>",
      contentJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Base compare text" }] }] },
      governedMetadata: metadata,
    } });
    expect(created.ok(), await created.text()).toBe(true);
    const target = await created.json();
    const issued = await ownerApi.post(`${base()}/apikeys`, { data: { name: `Comparison agent ${suffix}`, scopes: ["read", "write"] } });
    expect(issued.ok(), await issued.text()).toBe(true);
    const token = await issued.json();
    const tasks: string[] = [];
    try {
      const stage = async (body: Record<string, unknown>) => {
        const response = await ownerApi.post(`${base()}/knowledge-base/document-proposals`, {
          headers: { Authorization: `Bearer ${token.token}` }, data: body,
        });
        expect(response.ok(), await response.text()).toBe(true);
        const task = await response.json();
        tasks.push(task.id);
        return task;
      };
      // Omitted text/HTML/JSON: the pinned base is inherited, while title and metadata change.
      const inherited = await stage({
        requestKey: `cmp-inherited-${suffix}`, operation: "update", documentId: target.id, expectedRevision: target.editRevision,
        document: { title: `Inherited ${suffix}`, governedMetadata: { ...metadata, confidentiality: "confidential" } },
      });
      // Explicit nulls in all three representations are a clear, not an omission.
      const cleared = await stage({
        requestKey: `cmp-cleared-${suffix}`, operation: "update", documentId: target.id, expectedRevision: target.editRevision,
        document: { title: `Cleared ${suffix}`, contentText: null, contentHtml: null, contentJson: null, governedMetadata: metadata },
      });
      const newDocument = await stage({
        requestKey: `cmp-create-${suffix}`, operation: "create", documentType: "user_manual", folderId: root,
        document: { title: `New manual ${suffix}`, contentText: "New body", contentHtml: "<p>New body</p>",
          contentJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "New body" }] }] },
          governedMetadata: metadata },
      });
      const longText = `LONG-START ${"x".repeat(5000)} LONG-END`;
      const longCandidate = await stage({
        requestKey: `cmp-long-${suffix}`, operation: "update", documentId: target.id, expectedRevision: target.editRevision,
        document: { title: `Long ${suffix}`, contentText: longText, contentHtml: `<p>${longText}</p>`,
          contentJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: longText }] }] },
          governedMetadata: metadata },
      });
      const metadataOnly = await stage({
        requestKey: `cmp-metadata-${suffix}`, operation: "update", documentId: target.id, expectedRevision: target.editRevision,
        document: { title: target.title, governedMetadata: { ...metadata, distribution: "external" } },
      });
      const emptyCreate = await stage({
        requestKey: `cmp-empty-create-${suffix}`, operation: "create", documentType: "user_manual", folderId: root,
        document: { title: `Empty new manual ${suffix}`, governedMetadata: metadata },
      });

      const inheritedPage = await open(browser, `/agents/tasks/${inherited.id}`);
      const inheritedComparison = inheritedPage.getByTestId("managed-document-comparison");
      await expect(inheritedComparison).toBeVisible();
      await expect(inheritedPage.getByTestId("managed-document-comparison-field-text")).toHaveAttribute("data-status", "inherited");
      await expect(inheritedPage.getByTestId("managed-document-comparison-field-html")).toHaveAttribute("data-status", "inherited");
      await expect(inheritedPage.getByTestId("managed-document-comparison-field-json")).toHaveAttribute("data-status", "inherited");
      await expect(inheritedPage.getByTestId("managed-document-comparison-field-title")).toHaveAttribute("data-status", "changed");
      await expect(inheritedPage.getByTestId("managed-document-comparison-field-metadata")).toHaveAttribute("data-status", "changed");
      await expect(inheritedComparison).toContainText("Not supplied by the proposal; the pinned base value is retained on apply.");

      const clearedPage = await open(browser, `/agents/tasks/${cleared.id}`);
      await expect(clearedPage.getByTestId("managed-document-comparison-field-text")).toHaveAttribute("data-status", "cleared");
      await expect(clearedPage.getByTestId("managed-document-comparison-field-html")).toHaveAttribute("data-status", "cleared");
      const clearedJson = clearedPage.getByTestId("managed-document-comparison-field-json");
      await expect(clearedJson).toHaveAttribute("data-status", "cleared");
      await clearedJson.getByText("Complete exact values for Editor JSON", { exact: true }).click();
      await expect(clearedPage.getByTestId("managed-document-comparison-old-json")).toContainText("Base compare text");
      await expect(clearedPage.getByTestId("managed-document-comparison-new-json")).toHaveText("Not stored");

      const createPage = await open(browser, `/agents/tasks/${newDocument.id}`);
      const createComparison = createPage.getByTestId("managed-document-comparison");
      await expect(createComparison).toContainText("New governed document");
      await expect(createPage.getByTestId("managed-document-comparison-base-identity")).toHaveText("—");
      await expect(createPage.getByTestId("managed-document-comparison-field-title")).toHaveAttribute("data-status", "added");
      await expect(createPage.getByTestId("managed-document-comparison-field-text")).toHaveAttribute("data-status", "added");
      await expect(createPage.getByTestId("managed-document-comparison-field-json")).toHaveAttribute("data-status", "added");

      const longPage = await open(browser, `/agents/tasks/${longCandidate.id}`);
      await expect(longPage.getByTestId("managed-document-comparison-field-text")).toContainText("Excerpt bounded");
      await expect(longPage.getByTestId("managed-document-comparison-new-text")).toContainText("LONG-END");
      await expect(longPage.getByTestId("managed-document-comparison-field-text")).not.toContainText("without a visible line difference");

      const metadataPage = await open(browser, `/agents/tasks/${metadataOnly.id}`);
      await expect(metadataPage.getByTestId("managed-document-comparison-summary")).toContainText("Metadata only");
      await expect(metadataPage.getByTestId("managed-document-comparison-summary")).toContainText("1 changed field");
      await expect(metadataPage.getByTestId("managed-document-comparison-field-text")).toHaveAttribute("data-status", "inherited");

      const emptyCreatePage = await open(browser, `/agents/tasks/${emptyCreate.id}`);
      await expect(emptyCreatePage.getByTestId("managed-document-comparison-base-identity")).toHaveText("—");
      await expect(emptyCreatePage.getByTestId("managed-document-comparison-field-text")).not.toHaveAttribute("data-status", "inherited");
      await expect(emptyCreatePage.getByTestId("managed-document-comparison-field-html")).not.toHaveAttribute("data-status", "inherited");
      await expect(emptyCreatePage.getByTestId("managed-document-comparison-field-json")).not.toHaveAttribute("data-status", "inherited");
    } finally {
      for (const id of tasks) exec(`DELETE FROM ai_generation_requests WHERE id=${literal(id)} AND project_id=${literal(tenant!.mainProjectId)};`);
      await ownerApi.delete(`${base()}/apikeys/${token.id}`, { failOnStatusCode: false });
      exec(`UPDATE knowledge_documents SET reviewed_version_id=NULL WHERE id=${literal(target.id)};`);
      exec(`DELETE FROM knowledge_documents WHERE id=${literal(target.id)} AND project_id=${literal(tenant!.mainProjectId)};`);
      await cleanupSkill(skill.documentId);
    }
  });
});
