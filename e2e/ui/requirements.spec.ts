import path from "node:path";
import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { dbControlAvailable, exec, literal, scalar } from "../utils/psql";
import { createApprovedTestcase } from "../utils/testcase-approval";
import {
  createProject,
  deleteProjects,
  screensApi,
  screensSuiteSkipReason,
  screensTenant,
  seedJiraRequirements,
  seedLinearRequirements,
  seedProviderKbFolder,
  uniqueSuffix,
} from "../utils/screens-tenant";

/*
 * The project Requirements page at /projects/:id/requirements — Jira/Linear ticket sync and the
 * cross-source coverage view.
 *
 * Regression coverage only, for now: a Jira connection is seeded straight into Postgres (the same
 * way DSH-A-12 in api/projects.spec.ts does) since there is no API route to connect one and a real
 * OAuth round trip can't be driven from Playwright. The rest of the page's happy path is exercised
 * indirectly by api/integrations.spec.ts (the aggregates it reads) and by navigation.spec.ts /
 * theme.spec.ts (that the screen renders and is reachable).
 */

const tenant = screensTenant();
const skipReason = screensSuiteSkipReason(tenant);

test.use({ storageState: path.join(__dirname, "../.auth/state-screens.json") });

test.describe("requirements page — truthful coverage reads", () => {
  test.skip(!!skipReason, skipReason ?? "");
  let api: APIRequestContext;
  test.beforeAll(async () => { api = await screensApi(); });
  test.afterAll(async () => { await api?.dispose(); });

  for (const denied of [false, true]) {
    test(`REQ-U-coverage ${denied ? "denied" : "unavailable"} links stay unknown while another source remains usable, and retry distinguishes empty success`, async ({ page }) => {
      test.skip(!dbControlAvailable(), "requires disposable source fixtures");
      const project = await createProject(api);
      const jiraKey = `E2EJ-${uniqueSuffix()}`;
      const linearKey = `E2EL-${uniqueSuffix()}`;
      let refuse = true;
      try {
        seedJiraRequirements(tenant!.organizationId, project.id, [jiraKey]);
        seedLinearRequirements(tenant!.organizationId, project.id, [linearKey]);
        const endpoint = `/api/projects/${project.id}/testcases/linked-jira-keys`;
        await page.route((url) => url.pathname === endpoint, async (route) => {
          if (!refuse) return route.continue();
          return route.fulfill({ status: denied ? 403 : 503, json: { error: denied ? "Coverage access denied" : "Coverage service unavailable" } });
        });
        await page.goto(`/projects/${project.id}/requirements`);
        const jiraRow = page.getByTestId("requirement-row").filter({ hasText: jiraKey });
        const linearRow = page.getByTestId("requirement-row").filter({ hasText: linearKey });
        await expect(page.getByTestId("requirement-link-warning")).toBeVisible();
        await expect(jiraRow.getByTestId("requirement-coverage-unknown")).toHaveText(denied ? "Access denied" : "Unavailable");
        await expect(jiraRow.getByText("Unknown", { exact: true })).toBeVisible();
        await expect(jiraRow.getByRole("button", { name: "Assign to Zyra" })).toBeDisabled();
        await expect(linearRow.getByText("Not started", { exact: true })).toBeVisible();
        await expect(linearRow.getByRole("button", { name: "Assign to Zyra" })).toBeEnabled();
        refuse = false;
        await page.getByRole("button", { name: "Retry coverage" }).click();
        await expect(page.getByTestId("requirement-link-warning")).toHaveCount(0);
        await expect(jiraRow.getByTestId("requirement-coverage-unknown")).toHaveCount(0);
        await expect(jiraRow.getByText("Not started", { exact: true })).toBeVisible();
        await expect(jiraRow.getByRole("button", { name: "Assign to Zyra" })).toBeEnabled();
      } finally { await deleteProjects(api, [project.id]); }
    });
  }
});

test.describe("requirements page — unpublished native proposals", () => {
  let api: APIRequestContext;
  test.beforeAll(async () => {
    expect(tenant, "native proposal journeys require the existing disposable screens tenant").not.toBeNull();
    api = await screensApi();
  });
  test.afterAll(async () => { await api?.dispose(); });

  const proposalBody = () => ({ submissionKey: randomUUID(), title: `E2E native UI ${randomUUID()}`,
    description: "Persisted behavior proposal", criteria: [{ key: "AC-1", text: "The exact proposal can be reopened." }],
    rationale: "Make the review basis explicit", sourceRefs: [] });
  async function createProposal(projectId: string) {
    const response = await api.post(`/api/projects/${projectId}/requirements`, { data: proposalBody() });
    expect(response.status(), await response.text()).toBe(201);
    return response.json();
  }
  async function readProposal(projectId: string, requirementId: string) {
    const response = await api.get(`/api/projects/${projectId}/requirements/${requirementId}`);
    expect(response.status(), await response.text()).toBe(200);
    return response.json();
  }
  const detailPath = (projectId: string, requirementId: string) => `/projects/${projectId}/requirements?view=native&requirement=${requirementId}`;

  test("NREQ-U-01 a user without a provider connection saves, reopens and revises an unpublished requirement", async ({ page }) => {
    const project = await createProject(api);
    try {
      const title = `E2E new native proposal ${randomUUID()}`;
      await page.goto(`/projects/${project.id}/requirements?view=native`);
      const pane = page.getByTestId("native-requirement-proposals");
      await expect(pane).toBeVisible();
      await expect(pane.getByTestId("native-requirement-governance")).toContainText("Publication and approval are blocked");
      await pane.getByRole("button", { name: "New requirement proposal", exact: true }).click();
      const editor = page.getByRole("dialog", { name: "New requirement proposal", exact: true });
      await editor.getByLabel("Title", { exact: true }).fill(title);
      await editor.getByLabel("Description", { exact: true }).fill("The persisted description belongs to version one.");
      await editor.getByLabel("Criterion 1 text", { exact: true }).fill("Version one criterion is retrievable.");
      await editor.getByLabel("Rationale", { exact: true }).fill("Preserve review history.");
      await editor.getByRole("button", { name: "Add source", exact: true }).click();
      await editor.getByLabel("Source 1 label", { exact: true }).fill("Source specification");
      await editor.getByLabel("Source 1 URL", { exact: true }).fill("https://example.com/specification");
      const savedResponse = page.waitForResponse(response => new URL(response.url()).pathname === `/api/projects/${project.id}/requirements` && response.request().method() === "POST");
      await editor.getByRole("button", { name: "Save proposal", exact: true }).click();
      const response = await savedResponse;
      expect(response.status(), await response.text()).toBe(201);
      const created = await response.json();
      await expect(editor).toHaveCount(0);
      await expect(pane.getByRole("heading", { name: title, exact: true })).toBeVisible();
      const first = (await readProposal(project.id, created.requirement.id)).requirement.currentVersion;
      expect(first).toMatchObject({ title, description: "The persisted description belongs to version one.",
        criteria: [{ key: "AC-1", text: "Version one criterion is retrievable." }],
        sourceRefs: [{ label: "Source specification", url: "https://example.com/specification" }] });
      expect(created.requirement).toMatchObject({ identityKind: "proposal_task", taskId: created.requirement.id, nativeDocumentId: null });
      expect(first).toMatchObject({ identityKind: "proposal_operation", operationId: first.id, nativeVersionId: null });
      // The shared review is useful before any case is staged; it shows actual saved content.
      await pane.getByRole("link", { name: "Review this shared proposal task", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/agents/tasks/${created.requirement.taskId}`));
      const sharedReview = page.getByTestId("native-shared-proposal-review");
      await expect(sharedReview.getByRole("heading", { name: title, exact: true })).toBeVisible();
      await expect(sharedReview).toContainText("The persisted description belongs to version one.");
      await expect(sharedReview).toContainText("Version one criterion is retrievable.");
      await expect(sharedReview.getByRole("link", { name: "Source specification", exact: true })).toHaveAttribute("href", "https://example.com/specification");
      await expect(page.getByTestId("native-case-proposal-governance")).toContainText("Publication and approval are blocked");
      await page.goto(detailPath(project.id, created.requirement.id));
      await page.reload();
      await expect(pane.getByRole("heading", { name: title, exact: true })).toBeVisible();
      await pane.getByRole("button", { name: "Revise proposal", exact: true }).click();
      const revisionEditor = page.getByRole("dialog", { name: "Revise requirement proposal", exact: true });
      await revisionEditor.getByLabel("Title", { exact: true }).fill(`${title} revised`);
      await revisionEditor.getByLabel("Criterion 1 text", { exact: true }).fill("Version two criterion is retrievable.");
      await revisionEditor.getByRole("button", { name: "Save proposal", exact: true }).click();
      await expect(revisionEditor).toHaveCount(0);
      const current = await readProposal(project.id, created.requirement.id);
      expect(current.requirement.currentVersion.versionNumber).toBe(2);
      expect(current.versions.find((version: any) => version.id === first.id)).toEqual(first);
      await pane.getByRole("link", { name: "Version 1", exact: true }).click();
      await expect(pane.getByText("Historical proposal revision", { exact: true })).toBeVisible();
      await expect(pane.getByRole("heading", { name: title, exact: true })).toBeVisible();
      await expect(pane.getByText("Version one criterion is retrievable.", { exact: true })).toBeVisible();
      await pane.getByRole("link", { name: "Version 2 (current)", exact: true }).click();
      await expect(pane.getByRole("heading", { name: `${title} revised`, exact: true })).toBeVisible();
      await expect(pane.getByText("Unavailable", { exact: true })).toHaveCount(2);
      await expect(pane.getByText("Unavailable", { exact: true }).nth(0)).toBeVisible();
      await expect(pane.getByText("Unavailable", { exact: true }).nth(1)).toBeVisible();
    } finally { await deleteProjects(api, [project.id]); }
  });

  test("NREQ-U-02 a real stale-save refusal preserves the user's text until they explicitly choose the current base", async ({ page }) => {
    const project = await createProject(api);
    try {
      const initial = await createProposal(project.id);
      const version = initial.requirement.currentVersion;
      await page.goto(detailPath(project.id, initial.requirement.id));
      await page.getByRole("button", { name: "Revise proposal", exact: true }).click();
      const editor = page.getByRole("dialog", { name: "Revise requirement proposal", exact: true });
      const unsavedTitle = `My unsaved revision ${randomUUID()}`;
      await editor.getByLabel("Title", { exact: true }).fill(unsavedTitle);
      await editor.getByLabel("Criterion 1 text", { exact: true }).fill("My text must survive the conflict.");
      const competing = await api.post(`/api/projects/${project.id}/requirements/${initial.requirement.id}/revisions`, { data: {
        ...proposalBody(), title: "Another reviewer saved this version", expectedVersionId: version.id, expectedContentDigest: version.contentDigest,
      } });
      expect(competing.status(), await competing.text()).toBe(201);
      const current = await competing.json();
      const refused = page.waitForResponse(response => new URL(response.url()).pathname.endsWith(`/${initial.requirement.id}/revisions`) && response.request().method() === "POST");
      await editor.getByRole("button", { name: "Save proposal", exact: true }).click();
      expect((await refused).status()).toBe(409);
      await expect(editor.getByText("Your text is preserved. Review the current saved revision before choosing a new editing base.", { exact: true })).toBeVisible();
      await expect(editor.getByLabel("Title", { exact: true })).toHaveValue(unsavedTitle);
      await expect(editor.getByLabel("Criterion 1 text", { exact: true })).toHaveValue("My text must survive the conflict.");
      await expect(editor.getByRole("button", { name: "Save proposal", exact: true })).toBeDisabled();
      expect((await readProposal(project.id, initial.requirement.id)).requirement.currentVersion.id).toBe(current.requirement.currentVersion.id);
      await editor.getByRole("button", { name: "Review latest saved revision", exact: true }).click();
      await expect(editor.getByRole("heading", { name: "Another reviewer saved this version", exact: true })).toBeVisible();
      await editor.getByRole("button", { name: "Keep my text and use this base", exact: true }).click();
      await expect(editor.getByLabel("Title", { exact: true })).toHaveValue(unsavedTitle);
      await editor.getByRole("button", { name: "Save proposal", exact: true }).click();
      await expect(editor).toHaveCount(0);
      const reconciled = await readProposal(project.id, initial.requirement.id);
      expect(reconciled.requirement.currentVersion).toMatchObject({ title: unsavedTitle, versionNumber: 3, parentVersionId: current.requirement.currentVersion.id });
      expect(reconciled.versions).toHaveLength(3);
    } finally { await deleteProjects(api, [project.id]); }
  });

  test("NREQ-U-03 exact case association and case preparation use the existing review with publication disabled", async ({ page }) => {
    const project = await createProject(api);
    try {
      const proposal = await createProposal(project.id);
      const testcase = await createApprovedTestcase(api, project.id, { title: `E2E associated UI case ${randomUUID()}` });
      await page.goto(detailPath(project.id, proposal.requirement.id));
      const preparation = page.getByTestId("native-case-preparation");
      await preparation.getByLabel("Find an existing case", { exact: true }).fill(testcase.title);
      await preparation.getByRole("button", { name: "Search cases", exact: true }).click();
      await preparation.getByRole("button", { name: `${testcase.externalId}: ${testcase.title} (Approved)`, exact: true }).click();
      await expect(preparation.getByText(testcase.editRevision, { exact: true })).toBeVisible();
      await preparation.getByRole("checkbox", { name: "Use this saved testcase revision", exact: true }).check();
      await preparation.getByRole("checkbox", { name: "AC-1: The exact proposal can be reopened.", exact: true }).check();
      const associationResponse = page.waitForResponse(response => new URL(response.url()).pathname.endsWith(`/${proposal.requirement.id}/links`) && response.request().method() === "POST");
      await preparation.getByRole("button", { name: "Save proposed association", exact: true }).click();
      expect((await associationResponse).status()).toBe(201);
      await expect(page.getByText("Current proposal association", { exact: true })).toBeVisible();
      const associated = await readProposal(project.id, proposal.requirement.id);
      expect(associated.links[0]).toMatchObject({ testcaseId: testcase.id, testcaseRevision: testcase.editRevision,
        testcaseApprovalRevision: testcase.approvalRevision, requirementVersionId: proposal.requirement.currentVersion.id, criterionKeys: ["AC-1"] });
      const changed = await api.put(`/api/projects/${project.id}/testcases/${testcase.id}`, {
        data: { expectedRevision: testcase.editRevision, description: "The saved testcase changed after this association." },
      });
      expect(changed.status(), await changed.text()).toBe(200);
      const changedCaseResponse = await api.get(`/api/projects/${project.id}/testcases/${testcase.id}`);
      expect(changedCaseResponse.ok(), await changedCaseResponse.text()).toBe(true);
      const changedCase = await changedCaseResponse.json();
      // A semantic edit invalidates exact approval; reassociation must preserve that fact.
      expect(changedCase).toMatchObject({ status: "In Review", approvalCurrent: false });
      expect(changedCase.editRevision).not.toBe(testcase.editRevision);
      await page.reload();
      const originalAssociation = page.getByTestId(`native-requirement-association-${associated.links[0].id}`);
      await expect(originalAssociation.getByText("Stale association", { exact: true })).toBeVisible();
      const retirementResponse = page.waitForResponse(response => new URL(response.url()).pathname.endsWith(`/links/${associated.links[0].id}/retire`) && response.request().method() === "POST");
      await originalAssociation.getByRole("button", { name: "Retire proposed association", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Retire proposed association?", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Retire association", exact: true }).click();
      expect((await retirementResponse).status()).toBe(200);
      await expect(originalAssociation.getByText("Retired association", { exact: true })).toBeVisible();
      await preparation.getByLabel("Find an existing case", { exact: true }).fill(testcase.title);
      await preparation.getByRole("button", { name: "Search cases", exact: true }).click();
      await preparation.getByRole("button", { name: `${testcase.externalId}: ${testcase.title} (In Review)`, exact: true }).click();
      await preparation.getByRole("checkbox", { name: "Use this saved testcase revision", exact: true }).check();
      await preparation.getByRole("checkbox", { name: "AC-1: The exact proposal can be reopened.", exact: true }).check();
      await preparation.getByRole("button", { name: "Save proposed association", exact: true }).click();
      await expect(page.getByText("Current proposal association", { exact: true })).toBeVisible();
      const replacement = await readProposal(project.id, proposal.requirement.id);
      expect(replacement.links).toHaveLength(2);
      expect(replacement.links.find((link: any) => link.id === associated.links[0].id).retiredAt).not.toBeNull();
      expect(replacement.links.find((link: any) => !link.retiredAt)).toMatchObject({
        testcaseRevision: changedCase.editRevision, testcaseApprovalRevision: null,
        caseSnapshot: { approvalCurrent: false },
      });
      expect(replacement.coverage).toMatchObject({ proposedLinkCount: 1, currentProposedLinkCount: 1, staleProposedLinkCount: 0 });
      await preparation.getByLabel("Case proposal operation", { exact: true }).selectOption("create");
      const title = `E2E proposed UI case ${randomUUID()}`;
      await preparation.getByLabel("Case title", { exact: true }).fill(title);
      await preparation.getByLabel("Step 1 action", { exact: true }).fill("Open the saved requirement proposal.");
      await preparation.getByLabel("Step 1 expected result", { exact: true }).fill("Its exact criteria and revision are visible.");
      const stagedResponse = page.waitForResponse(response => new URL(response.url()).pathname.endsWith(`/${proposal.requirement.id}/case-proposals`) && response.request().method() === "POST");
      await preparation.getByRole("button", { name: "Stage case proposal", exact: true }).click();
      const response = await stagedResponse;
      expect(response.status(), await response.text()).toBe(201);
      const staged = await response.json();
      expect(staged.publication).toBe("unpublished");
      expect(staged.taskId).toBe(proposal.requirement.taskId);
      await preparation.getByRole("link", { name: "Open shared proposal review", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/agents/tasks/${staged.taskId}`));
      const governance = page.getByTestId("native-case-proposal-governance");
      await expect(governance).toContainText("Publication and approval are blocked");
      await expect(governance).toContainText(proposal.requirement.currentVersion.id);
      await expect(governance).toContainText(proposal.requirement.currentVersion.contentDigest);
      const sharedReview = page.getByTestId("native-shared-proposal-review");
      await expect(sharedReview.getByRole("heading", { name: proposal.requirement.currentVersion.title, exact: true })).toBeVisible();
      await expect(sharedReview.getByRole("heading", { name: "Proposed case association", exact: true })).toHaveCount(2);
      await expect(sharedReview).toContainText(changedCase.editRevision);
      await expect(sharedReview).toContainText(title);
      await expect(sharedReview).toContainText("Open the saved requirement proposal.");
      await expect(sharedReview).toContainText("Its exact criteria and revision are visible.");
      await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
      await expect(page.getByRole("button", { name: /Save selected/i })).toBeDisabled();
      const casesResponse = await api.get(`/api/projects/${project.id}/testcases`, { params: { search: title, limit: 500 } });
      expect(casesResponse.ok(), await casesResponse.text()).toBe(true);
      expect((await casesResponse.json()).filter((row: any) => row.title === title)).toEqual([]);
      expect((await readProposal(project.id, proposal.requirement.id)).caseProposals[0].id).toBe(staged.taskId);
    } finally { await deleteProjects(api, [project.id]); }
  });

  test("NREQ-U-04 losing a successful save response preserves the submission key and recovers one persisted proposal", async ({ page }) => {
    const project = await createProject(api);
    let loseResponse = true;
    const submittedKeys: string[] = [];
    try {
      await page.route(url => url.pathname === `/api/projects/${project.id}/requirements`, async route => {
        if (route.request().method() !== "POST") return route.continue();
        submittedKeys.push(route.request().postDataJSON().submissionKey);
        if (!loseResponse) return route.continue();
        const persisted = await route.fetch();
        expect(persisted.status(), await persisted.text()).toBe(201);
        await route.abort("failed");
      });
      await page.goto(`/projects/${project.id}/requirements?view=native`);
      await page.getByRole("button", { name: "New requirement proposal", exact: true }).click();
      const editor = page.getByRole("dialog", { name: "New requirement proposal", exact: true });
      const title = `E2E recovered native proposal ${randomUUID()}`;
      await editor.getByLabel("Title", { exact: true }).fill(title);
      await editor.getByLabel("Criterion 1 text", { exact: true }).fill("One proposal is stored even when its response is lost.");
      await editor.getByRole("button", { name: "Save proposal", exact: true }).click();
      await expect(editor.getByText(/The save outcome is unconfirmed/)).toBeVisible();
      await expect(editor.getByLabel("Title", { exact: true })).toHaveValue(title);
      await expect(editor.getByLabel("Title", { exact: true })).toBeDisabled();
      const before = await api.get(`/api/projects/${project.id}/requirements`);
      expect(before.ok(), await before.text()).toBe(true);
      const persisted = await before.json();
      expect(persisted.total).toBe(1);
      loseResponse = false;
      await editor.getByRole("button", { name: "Check saved submission", exact: true }).click();
      await expect(editor).toHaveCount(0);
      expect(new Set(submittedKeys).size).toBe(1);
      expect(submittedKeys.length).toBeGreaterThanOrEqual(2);
      const after = await api.get(`/api/projects/${project.id}/requirements`);
      expect(after.ok(), await after.text()).toBe(true);
      expect((await after.json()).list[0].id).toBe(persisted.list[0].id);
      expect((await readProposal(project.id, persisted.list[0].id)).versions).toHaveLength(1);
    } finally { await deleteProjects(api, [project.id]); }
  });

  test("NREQ-U-05 unavailable proposal reads show unknown availability and recover the persisted list on retry", async ({ page }) => {
    const project = await createProject(api);
    let unavailable = true;
    try {
      const proposal = await createProposal(project.id);
      await page.route(url => url.pathname === `/api/projects/${project.id}/requirements`, async route => {
        if (unavailable && route.request().method() === "GET") return route.fulfill({ status: 503, json: { error: "Proposal service unavailable" } });
        return route.continue();
      });
      await page.goto(`/projects/${project.id}/requirements?view=native`);
      const pane = page.getByTestId("native-requirement-proposals");
      await expect(pane.getByRole("alert")).toContainText("Proposal availability is unknown");
      await expect(pane.getByRole("button", { name: "New requirement proposal", exact: true })).toBeDisabled();
      await expect(pane.getByText("0 unpublished proposals", { exact: true })).toHaveCount(0);
      unavailable = false;
      await pane.getByRole("button", { name: "Refresh proposals", exact: true }).click();
      await expect(pane.getByRole("alert")).toHaveCount(0);
      await expect(pane.getByRole("link", { name: `${proposal.requirement.key}: ${proposal.requirement.currentVersion.title}`, exact: true })).toBeVisible();
      await expect(pane.getByRole("button", { name: "New requirement proposal", exact: true })).toBeEnabled();
    } finally { await deleteProjects(api, [project.id]); }
  });

  test("NREQ-U-06 a late detail reply cannot replace the requirement the user has opened", async ({ page }) => {
    const project = await createProject(api);
    let release: () => void = () => {};
    try {
      const first = await createProposal(project.id), second = await createProposal(project.id);
      let started: () => void = () => {};
      let completed: () => void = () => {};
      const requested = new Promise<void>(resolve => { started = resolve; });
      const held = new Promise<void>(resolve => { release = resolve; });
      const delivered = new Promise<void>(resolve => { completed = resolve; });
      await page.route(url => url.pathname === `/api/projects/${project.id}/requirements/${first.requirement.id}`, async route => {
        const response = await route.fetch();
        started(); await held;
        // The first request may be aborted by navigation; only its completion is being delayed.
        await route.fulfill({ response }).catch(() => {}).finally(completed);
      });
      await page.goto(`/projects/${project.id}/requirements?view=native`);
      const pane = page.getByTestId("native-requirement-proposals");
      await pane.getByRole("link", { name: `${first.requirement.key}: ${first.requirement.currentVersion.title}`, exact: true }).click();
      await requested;
      await pane.getByRole("link", { name: `${second.requirement.key}: ${second.requirement.currentVersion.title}`, exact: true }).click();
      await expect(pane.getByRole("heading", { name: second.requirement.currentVersion.title, exact: true })).toBeVisible();
      release();
      await delivered;
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      await expect(pane.getByRole("heading", { name: first.requirement.currentVersion.title, exact: true })).toHaveCount(0);
      await expect(pane.getByRole("heading", { name: second.requirement.currentVersion.title, exact: true })).toBeVisible();
    } finally { release(); await deleteProjects(api, [project.id]); }
  });

  test("NREQ-U-07 retirement preserves prepared fields and the original uncertain staging request across refresh", async ({ page }) => {
    const project = await createProject(api);
    let loseResponse = true;
    let originalTaskId = "";
    const submittedBodies: Array<Record<string, unknown>> = [];
    try {
      const proposal = await createProposal(project.id);
      const stagePath = `/api/projects/${project.id}/requirements/${proposal.requirement.id}/case-proposals`;
      await page.route(url => url.pathname === stagePath, async route => {
        if (route.request().method() !== "POST") return route.continue();
        submittedBodies.push(route.request().postDataJSON() as Record<string, unknown>);
        if (!loseResponse) return route.continue();
        const persisted = await route.fetch();
        expect(persisted.status(), await persisted.text()).toBe(201);
        const staged = await persisted.json();
        expect(staged.publication).toBe("unpublished");
        originalTaskId = staged.taskId;
        // The server stored this task; the browser must keep its exact uncertain submission.
        await route.abort("failed");
      });

      await page.goto(detailPath(project.id, proposal.requirement.id));
      const preparation = page.getByTestId("native-case-preparation");
      await preparation.getByLabel("Case proposal operation", { exact: true }).selectOption("create");
      const title = `E2E preserved retired preparation ${randomUUID()}`;
      const preparedFields = [
        ["Case title", title],
        ["Case purpose", "Keep the author's prepared purpose while retirement is reconciled."],
        ["Preconditions", "An exact requirement proposal revision is open."],
        ["Test data", "Use the saved criterion AC-1."],
        ["Postconditions and cleanup", "Leave all official cases unchanged."],
        ["Step 1 action", "Refresh after another author retires the requirement proposal."],
        ["Step 1 expected result", "The prepared text and original submission remain inspectable."],
        ["Reason for the proposed change", "Recover the existing task without publishing or duplicating it."],
      ] as const;
      for (const [label, value] of preparedFields) await preparation.getByLabel(label, { exact: true }).fill(value);
      const criterion = preparation.getByRole("checkbox", { name: "AC-1: The exact proposal can be reopened.", exact: true });
      await criterion.check();
      await preparation.getByRole("button", { name: "Stage case proposal", exact: true }).click();
      await expect(preparation.getByText("The outcome is unconfirmed. Your exact submission is preserved. Check the same submission before making another change.", { exact: true })).toBeVisible();
      expect(originalTaskId).not.toBe("");
      expect(submittedBodies).toHaveLength(1);
      expect(typeof submittedBodies[0].requestKey).toBe("string");

      // A separate request changes the owner while the browser is retaining uncertain work.
      const retiredResponse = await api.post(`/api/projects/${project.id}/requirements/${proposal.requirement.id}/retire`, { data: {
        expectedVersionId: proposal.requirement.currentVersion.id,
        expectedContentDigest: proposal.requirement.currentVersion.contentDigest,
      } });
      expect(retiredResponse.status(), await retiredResponse.text()).toBe(200);
      expect((await retiredResponse.json()).requirement.state).toBe("retired");
      await page.getByRole("button", { name: "Refresh proposals", exact: true }).click();
      const retiredNotice = preparation.getByTestId("native-case-preparation-retired");
      await expect(retiredNotice).toContainText("Your case-preparation text is preserved here in read-only form. New associations and case proposals are disabled.");
      await expect(retiredNotice).toContainText("Its exact request key and content will be reused.");
      for (const [label, value] of preparedFields) {
        await expect(preparation.getByLabel(label, { exact: true })).toHaveValue(value);
        await expect(preparation.getByLabel(label, { exact: true })).toBeDisabled();
      }
      await expect(criterion).toBeChecked();
      await expect(criterion).toBeDisabled();
      await expect(preparation.getByLabel("Case proposal operation", { exact: true })).toHaveValue("create");
      await expect(preparation.getByLabel("Case proposal operation", { exact: true })).toBeDisabled();
      const beforeRecovery = await readProposal(project.id, proposal.requirement.id);
      expect(beforeRecovery.caseProposals.map((item: { id: string }) => item.id)).toEqual([originalTaskId]);

      loseResponse = false;
      const recoveredResponse = page.waitForResponse(response => new URL(response.url()).pathname === stagePath && response.request().method() === "POST");
      await preparation.getByRole("button", { name: "Check saved submission", exact: true }).click();
      const response = await recoveredResponse;
      expect(response.status(), await response.text()).toBe(201);
      const recovered = await response.json();
      expect(recovered).toMatchObject({ taskId: originalTaskId, publication: "unpublished" });
      expect(recovered.task.publicationBlocked.code).toBe("SKILL_CONTEXT_UNAVAILABLE");
      expect(submittedBodies).toHaveLength(2);
      expect(submittedBodies[1]).toEqual(submittedBodies[0]);
      await expect(preparation.getByRole("button", { name: "Stage case proposal", exact: true })).toBeDisabled();
      await expect(preparation.getByRole("link", { name: "Open shared proposal review", exact: true })).toHaveAttribute("href", `/projects/${project.id}/agents/tasks/${originalTaskId}#proposal-operation-${recovered.task.proposalSubmission.operationId}`);
      for (const [label, value] of preparedFields) {
        await expect(preparation.getByLabel(label, { exact: true })).toHaveValue(value);
        await expect(preparation.getByLabel(label, { exact: true })).toBeDisabled();
      }
      const afterRecovery = await readProposal(project.id, proposal.requirement.id);
      expect(afterRecovery.requirement.state).toBe("retired");
      expect(afterRecovery.caseProposals.map((item: { id: string }) => item.id)).toEqual([originalTaskId]);
      expect(afterRecovery.links).toEqual([]);
      const officialCases = await api.get(`/api/projects/${project.id}/testcases`, { params: { search: title, limit: 500 } });
      expect(officialCases.ok(), await officialCases.text()).toBe(true);
      expect(await officialCases.json()).toEqual([]);
    } finally { await deleteProjects(api, [project.id]); }
  });

  test("NREQ-U-08 a lost association response replays the retired original until a deliberate new association", async ({ page }) => {
    const project = await createProject(api);
    let loseResponse = true;
    let originalLinkId = "";
    const submittedBodies: Array<Record<string, unknown>> = [];
    try {
      const proposal = await createProposal(project.id);
      const testcase = await createApprovedTestcase(api, project.id, { title: `E2E association recovery ${randomUUID()}` });
      const linkPath = `/api/projects/${project.id}/requirements/${proposal.requirement.id}/links`;
      await page.route(url => url.pathname === linkPath, async route => {
        if (route.request().method() !== "POST") return route.continue();
        submittedBodies.push(route.request().postDataJSON() as Record<string, unknown>);
        if (!loseResponse) return route.continue();
        const persisted = await route.fetch();
        expect(persisted.status(), await persisted.text()).toBe(201);
        const association = await persisted.json();
        originalLinkId = association.link.id;
        expect(association.submission).toEqual({ linkId: originalLinkId, replayed: false });
        await route.abort("failed");
      });

      await page.goto(detailPath(project.id, proposal.requirement.id));
      const preparation = page.getByTestId("native-case-preparation");
      await preparation.getByLabel("Find an existing case", { exact: true }).fill(testcase.title);
      await preparation.getByRole("button", { name: "Search cases", exact: true }).click();
      await preparation.getByRole("button", { name: `${testcase.externalId}: ${testcase.title} (Approved)`, exact: true }).click();
      await preparation.getByRole("checkbox", { name: "Use this saved testcase revision", exact: true }).check();
      await preparation.getByRole("checkbox", { name: "AC-1: The exact proposal can be reopened.", exact: true }).check();
      await preparation.getByRole("button", { name: "Save proposed association", exact: true }).click();
      await expect(preparation.getByText("The outcome is unconfirmed. Your exact submission is preserved. Check the same submission before making another change.", { exact: true })).toBeVisible();
      expect(originalLinkId).not.toBe("");
      expect(submittedBodies).toHaveLength(1);
      expect(typeof submittedBodies[0].submissionKey).toBe("string");

      const retiredResponse = await api.post(`${linkPath}/${originalLinkId}/retire`, { data: {} });
      expect(retiredResponse.status(), await retiredResponse.text()).toBe(200);
      expect((await retiredResponse.json()).link.retiredAt).not.toBeNull();
      expect((await readProposal(project.id, proposal.requirement.id)).requirement.state).toBe("draft");
      await page.getByRole("button", { name: "Refresh proposals", exact: true }).click();
      const originalRow = page.getByTestId(`native-requirement-association-${originalLinkId}`);
      await expect(originalRow.getByText("Retired association", { exact: true })).toBeVisible();
      await expect(preparation.getByRole("button", { name: "Check saved submission", exact: true })).toBeEnabled();

      loseResponse = false;
      const recoveredResponse = page.waitForResponse(response => new URL(response.url()).pathname === linkPath && response.request().method() === "POST");
      await preparation.getByRole("button", { name: "Check saved submission", exact: true }).click();
      const recovered = await recoveredResponse;
      expect(recovered.status(), await recovered.text()).toBe(201);
      const receipt = await recovered.json();
      expect(receipt.submission).toEqual({ linkId: originalLinkId, replayed: true });
      expect(receipt.link).toMatchObject({ id: originalLinkId, current: false });
      expect(receipt.link.retiredAt).not.toBeNull();
      expect(submittedBodies).toHaveLength(2);
      expect(submittedBodies[1]).toEqual(submittedBodies[0]);
      await expect(page.getByText("Association submission confirmed. The original association is retired and remains in history; no active association was restored.", { exact: true })).toBeVisible();
      const afterRecovery = await readProposal(project.id, proposal.requirement.id);
      expect(afterRecovery.requirement.state).toBe("draft");
      expect(afterRecovery.links).toHaveLength(1);
      expect(afterRecovery.links[0].id).toBe(originalLinkId);
      expect(afterRecovery.links[0].retiredAt).not.toBeNull();
      expect(afterRecovery.coverage).toMatchObject({ proposedLinkCount: 0, currentProposedLinkCount: 0 });
      expect(afterRecovery.caseProposals).toEqual([]);

      // Only this separate user action may create a replacement, using a fresh submission key.
      const replacementResponse = page.waitForResponse(response => new URL(response.url()).pathname === linkPath && response.request().method() === "POST");
      await preparation.getByRole("button", { name: "Save proposed association", exact: true }).click();
      const replaced = await replacementResponse;
      expect(replaced.status(), await replaced.text()).toBe(201);
      const replacement = await replaced.json();
      expect(replacement.submission.replayed).toBe(false);
      expect(replacement.link.id).not.toBe(originalLinkId);
      expect(replacement.link.current).toBe(true);
      expect(submittedBodies).toHaveLength(3);
      expect(submittedBodies[2].submissionKey).not.toBe(submittedBodies[0].submissionKey);
      const afterReplacement = await readProposal(project.id, proposal.requirement.id);
      expect(afterReplacement.links).toHaveLength(2);
      expect(afterReplacement.links.find((link: { id: string }) => link.id === originalLinkId).retiredAt).not.toBeNull();
      expect(afterReplacement.coverage).toMatchObject({ proposedLinkCount: 1, currentProposedLinkCount: 1 });
      expect(afterReplacement.caseProposals).toEqual([]);
      const savedCase = await api.get(`/api/projects/${project.id}/testcases/${testcase.id}`);
      expect(savedCase.ok(), await savedCase.text()).toBe(true);
      expect(await savedCase.json()).toMatchObject({ editRevision: testcase.editRevision, approvalRevision: testcase.approvalRevision, approvalCurrent: true });
    } finally { await deleteProjects(api, [project.id]); }
  });
  test("NREQ-U-09 a concurrent change stops bulk discard without retargeting the remaining selection", async ({ page }) => {
    const project = await createProject(api);
    try {
      const proposal = await createProposal(project.id);
      const titles = ["Other author's removal", "Selected candidate", "Unselected candidate", "First selected removal"]
        .map(name => `E2E ${name} ${randomUUID()}`);
      const stagedResponse = await api.post(`/api/projects/${project.id}/requirements/${proposal.requirement.id}/case-proposals`, { data: {
        requestKey: randomUUID(), title: "Bulk review conflict",
        requirementVersionId: proposal.requirement.currentVersion.id,
        requirementContentDigest: proposal.requirement.currentVersion.contentDigest,
        criterionKeys: ["AC-1"], operations: titles.map(title => ({ opType: "create", draft: { title } })),
      } });
      expect(stagedResponse.status(), await stagedResponse.text()).toBe(201);
      const staged = await stagedResponse.json();
      const taskPath = `/api/projects/${project.id}/agents/zyra/tasks/${staged.taskId}`;
      const reviewedResponse = await api.get(taskPath);
      expect(reviewedResponse.ok(), await reviewedResponse.text()).toBe(true);
      const reviewed = await reviewedResponse.json();
      const attemptedRevisions: Array<string | null> = [];
      let firstRemovalRevision = "";
      await page.route(url => url.pathname.startsWith(`${taskPath}/drafts/`), async route => {
        if (route.request().method() !== "DELETE") return route.continue();
        const url = new URL(route.request().url());
        attemptedRevisions.push(url.searchParams.get("expectedProposalRevision"));
        const response = await route.fetch();
        if (url.pathname.endsWith("/3")) {
          expect(response.status(), await response.text()).toBe(200);
          const firstRemoval = await response.json();
          firstRemovalRevision = firstRemoval.proposalRevision;
          // Commit another author's real removal before the browser receives its first receipt.
          const concurrent = await api.delete(`${taskPath}/drafts/0`, {
            params: { expectedProposalRevision: firstRemovalRevision },
          });
          expect(concurrent.status(), await concurrent.text()).toBe(200);
          expect((await concurrent.json()).drafts.map((draft: { title: string }) => draft.title)).toEqual([titles[1], titles[2]]);
        }
        await route.fulfill({ response });
      });

      await page.goto(`/projects/${project.id}/agents/tasks/${staged.taskId}`);
      const table = page.getByRole("table").filter({ has: page.getByRole("columnheader", { name: "Testcase", exact: true }) });
      await expect(table.getByText(titles[3], { exact: true })).toBeVisible();
      await table.getByRole("checkbox", { name: "Select testcase 2", exact: true }).check();
      await table.getByRole("checkbox", { name: "Select testcase 4", exact: true }).check();
      const refusedResponse = page.waitForResponse(response => new URL(response.url()).pathname === `${taskPath}/drafts/1` && response.request().method() === "DELETE");
      await page.getByRole("button", { name: "Delete selected", exact: true }).click();
      const refused = await refusedResponse;
      expect(refused.status(), await refused.text()).toBe(409);
      expect((await refused.json()).code).toBe("PROPOSAL_REVIEW_CONFLICT");
      expect(attemptedRevisions).toEqual([reviewed.proposalRevision, firstRemovalRevision]);
      await expect(page.getByRole("alert")).toContainText("The shared proposal changed since review.");
      await expect(table.getByText(titles[3], { exact: true })).toHaveCount(0);
      await expect(table.getByRole("checkbox", { name: "Select testcase 2", exact: true })).toBeChecked();
      await expect(table.getByText(titles[1], { exact: true })).toBeVisible();
      await expect(table.getByText(titles[2], { exact: true })).toBeVisible();
      const currentResponse = await api.get(taskPath);
      expect(currentResponse.ok(), await currentResponse.text()).toBe(true);
      const current = await currentResponse.json();
      expect(current.drafts.map((draft: { title: string }) => draft.title)).toEqual([titles[1], titles[2]]);
      expect(current.proposalSnapshot.stagedOperations).toEqual(expect.arrayContaining(reviewed.proposalSnapshot.stagedOperations));

      await page.reload();
      await expect(table.getByText(titles[0], { exact: true })).toHaveCount(0);
      await expect(table.getByText(titles[1], { exact: true })).toBeVisible();
      await expect(table.getByText(titles[2], { exact: true })).toBeVisible();
      await expect(table.getByRole("checkbox", { name: "Select testcase 1", exact: true })).not.toBeChecked();
      await expect(page.getByTestId("native-case-proposal-governance")).toContainText("Publication and approval are blocked");
      const officialCases = await api.get(`/api/projects/${project.id}/testcases`);
      expect(officialCases.ok(), await officialCases.text()).toBe(true);
      expect(await officialCases.json()).toEqual([]);
    } finally { await deleteProjects(api, [project.id]); }
  });
});

test.describe("requirements page — sync error banner", () => {
  test.skip(!!skipReason, skipReason ?? "");

  let api: APIRequestContext;
  test.beforeAll(async () => {
    api = await screensApi();
  });
  test.afterAll(async () => {
    await api?.dispose();
  });

  test("REQ-U-01 Dismiss actually clears a sync failure, not just a state nothing reads", async ({ page }) => {
    test.skip(!dbControlAvailable(), "needs psql access to seed a Jira connection (no API route connects one)");
    const project = await createProject(api);
    try {
      // Gives the project a connected Jira source, so the page renders the Sync button and takes
      // the error path this test exercises, without a real OAuth connection or a live Jira account.
      seedJiraRequirements(tenant!.organizationId, project.id, [`E2ESCR-${uniqueSuffix()}`]);

      let syncAttempts = 0;
      const syncPath = `/api/projects/${project.id}/jira/sync`;
      // route.abort("failed") reproduces the exact browser-level transport failure production
      // fetch() throws when a sync call can't complete (see ZYU-33/34 in zyra.spec.ts) — this is
      // what actually sets useSyncRun's own `error` state, the state the bug left Dismiss unable
      // to reach.
      await page.route(
        (url) => url.pathname === syncPath,
        async (route) => {
          syncAttempts++;
          await route.abort("failed");
        },
      );

      await page.goto(`/projects/${project.id}/requirements`);
      await page.getByRole("button", { name: "Sync Jira" }).click();

      const errorBanner = page.getByText(/Request outcome unconfirmed\. This action may already have been applied\./);
      await expect(errorBanner).toBeVisible();
      // The current shared HTTP owner retries reads only. A lost sync POST response must
      // remain unconfirmed and must not replay a potentially committed external action.
      expect(syncAttempts).toBe(1);

      await page.getByRole("button", { name: "Dismiss" }).click();
      // The regression: Dismiss used to clear only a `syncError` state nothing here ever set — the
      // error actually on screen came from useSyncRun's own `error`, which had no way to be cleared.
      await expect(errorBanner).toHaveCount(0);
    } finally {
      await deleteProjects(api, [project.id]);
    }
  });
});

/*
 * The Requirements table's Zyra Status column: a persistent, always-on label for where a
 * requirement sits in the Zyra generation pipeline — "Not started" before any task exists,
 * through the in-flight statuses, to "Done" once accepted. Before this column existed, the same
 * information (ai_generation_requests.task_status) only ever appeared next to "View task" in the
 * Action column, and only while a task was neither brand new nor finished — see activeTaskFor in
 * app/(app)/projects/[id]/requirements/page.tsx. This suite exercises exactly the states that used
 * to render nothing at all, plus the one place a copy/paste of that lookup would silently read the
 * wrong provider's map (REQ-U-04).
 */
test.describe("requirements page — Zyra status label", () => {
  test.skip(!!skipReason, skipReason ?? "");

  let api: APIRequestContext;
  let ownerId: string;
  test.beforeAll(async () => {
    api = await screensApi();
    ownerId = scalar(`SELECT id FROM users WHERE email = ${literal(tenant!.email)};`);
  });
  test.afterAll(async () => {
    await api?.dispose();
  });

  /** legacy.service.ts ZYRA_AGENT_NAME. zyraTaskStatusesByIssueKey filters on it. */
  const ZYRA_AGENT_NAME = "Zyra the Test Generator";

  /**
   * Seeds a Zyra task-board row (ai_generation_requests) against one issue key, so the
   * Requirements page's persistent Zyra Status column has a real task_status to read instead of
   * falling back to "Not started" — without driving a real AI generation run. Mirrors seedTask()
   * in ui/zyra.spec.ts.
   */
  function seedZyraTaskStatus(projectId: string, source: "jira" | "linear", key: string, status: string): void {
    const column = source === "jira" ? "jira_issue_keys" : "linear_issue_keys";
    const userStory = `E2E Zyra Status ${key} ${uniqueSuffix()}`;
    exec(
      `INSERT INTO ai_generation_requests (project_id, requested_by, provider, user_story, agent_name, task_status, ${column}) ` +
        `VALUES (${literal(projectId)}, ${literal(ownerId)}, 'openai', ${literal(userStory)}, ` +
        `${literal(ZYRA_AGENT_NAME)}, ${literal(status)}, ${literal(JSON.stringify([key]))}::jsonb);`,
    );
  }

  test(
    "REQ-U-02 the Zyra status label is always shown, including before a task starts and after it finishes",
    async ({ page }) => {
      test.skip(!dbControlAvailable(), "needs psql access to seed jira_tickets and ai_generation_requests directly");
      const project = await createProject(api);
      try {
        const notStarted = `E2ESCR-${uniqueSuffix()}`;
        const inProgress = `E2ESCR-${uniqueSuffix()}`;
        const accepted = `E2ESCR-${uniqueSuffix()}`;
        seedJiraRequirements(tenant!.organizationId, project.id, [notStarted, inProgress, accepted]);
        seedZyraTaskStatus(project.id, "jira", inProgress, "in_progress");
        // "accepted" is what the review-accept action actually writes; normalizeTaskStatus maps it
        // to "done" — this is the exact state the badge used to disappear for entirely.
        seedZyraTaskStatus(project.id, "jira", accepted, "accepted");

        await page.goto(`/projects/${project.id}/requirements`);

        const notStartedRow = page.locator("tr", { hasText: notStarted });
        await expect(notStartedRow.getByText("Not started", { exact: true })).toBeVisible();

        const inProgressRow = page.locator("tr", { hasText: inProgress });
        // Only ONE badge with this text renders in the row now — the dedicated column replaced
        // the Action column's own copy rather than sitting alongside it.
        await expect(inProgressRow.getByText("In Progress", { exact: true })).toHaveCount(1);
        await expect(inProgressRow.getByRole("link", { name: "View task" })).toBeVisible();

        const acceptedRow = page.locator("tr", { hasText: accepted });
        await expect(acceptedRow.getByText("Done", { exact: true })).toBeVisible();
        // Done is terminal for activeTaskFor, so the Action column falls back to "Assign to Zyra"
        // (this ticket was never linked to a saved testcase) rather than a stale "View task" link.
        await expect(acceptedRow.getByRole("button", { name: "Assign to Zyra" })).toBeVisible();
      } finally {
        await deleteProjects(api, [project.id]);
      }
    },
  );

  test(
    "REQ-U-03 failed and rejected Zyra tasks still surface a real status, not silence",
    async ({ page }) => {
      test.skip(!dbControlAvailable(), "needs psql access to seed jira_tickets and ai_generation_requests directly");
      const project = await createProject(api);
      try {
        const failed = `E2ESCR-${uniqueSuffix()}`;
        const rejected = `E2ESCR-${uniqueSuffix()}`;
        seedJiraRequirements(tenant!.organizationId, project.id, [failed, rejected]);
        seedZyraTaskStatus(project.id, "jira", failed, "failed");
        // "rejected" normalizes to "todo" (taskStatusLabel -> "To Do") — the reviewer sent the
        // draft back, so the pipeline reads as restarted rather than finished.
        seedZyraTaskStatus(project.id, "jira", rejected, "rejected");

        await page.goto(`/projects/${project.id}/requirements`);

        await expect(page.locator("tr", { hasText: failed }).getByText("Failed", { exact: true })).toBeVisible();
        await expect(page.locator("tr", { hasText: rejected }).getByText("To Do", { exact: true })).toBeVisible();
      } finally {
        await deleteProjects(api, [project.id]);
      }
    },
  );

  test(
    "REQ-U-04 the label reads the matching provider's task map — a Jira and a Linear ticket sharing a key don't cross-contaminate",
    async ({ page }) => {
      test.skip(!dbControlAvailable(), "needs psql access to seed tickets and ai_generation_requests directly");
      const project = await createProject(api);
      try {
        const sharedKey = `E2ESCR-${uniqueSuffix()}`;
        seedJiraRequirements(tenant!.organizationId, project.id, [sharedKey]);
        seedLinearRequirements(tenant!.organizationId, project.id, [sharedKey]);
        seedZyraTaskStatus(project.id, "jira", sharedKey, "in_review");
        seedZyraTaskStatus(project.id, "linear", sharedKey, "failed");

        await page.goto(`/projects/${project.id}/requirements`);
        // Both providers are connected once this test's Linear connection lands, so the page opens
        // on "All Sources" — both rows for the same key sit side by side, told apart only by their
        // source badge. A lookup that read the wrong provider's map would show the same status on
        // both rows, or the right label on the wrong row.
        const rows = page.locator("tr", { hasText: sharedKey });
        await expect(rows).toHaveCount(2);
        await expect(rows.filter({ hasText: "In Review" })).toHaveCount(1);
        await expect(rows.filter({ hasText: "Failed" })).toHaveCount(1);
      } finally {
        await deleteProjects(api, [project.id]);
      }
    },
  );
});

/*
 * "View in Knowledge base" used to always link to the KB root, regardless of which Requirements
 * tab (Jira / Linear / All Sources) was active. It now resolves the provider's own KB folder — the
 * "Jira" / "Linear" folder a real sync creates under the root via ensureProviderFolder — and links
 * straight into it, falling back to the root only when that folder doesn't exist yet (no sync has
 * run) or when "All Sources" is active, since there is no single provider folder to point at there.
 */
test.describe("requirements page — View in Knowledge base follows the active source", () => {
  test.skip(!!skipReason, skipReason ?? "");

  let api: APIRequestContext;
  test.beforeAll(async () => {
    api = await screensApi();
  });
  test.afterAll(async () => {
    await api?.dispose();
  });

  test("REQ-U-05 the Jira tab links into the Jira KB folder, not the KB root", async ({ page }) => {
    test.skip(!dbControlAvailable(), "needs psql access to seed a Jira connection and its KB folder");
    const project = await createProject(api);
    try {
      seedJiraRequirements(tenant!.organizationId, project.id, [`E2ESCR-${uniqueSuffix()}`]);
      const jiraFolderId = seedProviderKbFolder(tenant!.organizationId, project.id, "jira");

      // Only Jira is connected, so the page opens straight on that tab — there's no "All Sources"
      // tab to sit under with a single provider.
      await page.goto(`/projects/${project.id}/requirements`);
      // One tracker connected: no aggregate tab at all, just that tracker's own tab, named for it.
      await expect(page.getByTestId("requirements-source-tab-jira")).toContainText("Jira");
      await expect(page.getByTestId("requirements-source-tab-all")).toHaveCount(0);
      const link = page.getByTestId("view-in-knowledge-base-link");
      await expect(link).toHaveAttribute("href", `/projects/${project.id}/knowledge-base?folder=${jiraFolderId}`);

      await link.click();
      await expect(page.getByRole("heading", { name: "Jira", exact: true })).toBeVisible();
    } finally {
      await deleteProjects(api, [project.id]);
    }
  });

  test("REQ-U-06 the Linear tab links into the Linear KB folder, not the KB root", async ({ page }) => {
    test.skip(!dbControlAvailable(), "needs psql access to seed a Linear connection and its KB folder");
    const project = await createProject(api);
    try {
      seedLinearRequirements(tenant!.organizationId, project.id, [`E2ESCR-${uniqueSuffix()}`]);
      const linearFolderId = seedProviderKbFolder(tenant!.organizationId, project.id, "linear");

      await page.goto(`/projects/${project.id}/requirements`);
      const link = page.getByTestId("view-in-knowledge-base-link");
      await expect(link).toHaveAttribute("href", `/projects/${project.id}/knowledge-base?folder=${linearFolderId}`);

      await link.click();
      await expect(page.getByRole("heading", { name: "Linear", exact: true })).toBeVisible();
    } finally {
      await deleteProjects(api, [project.id]);
    }
  });

  test(
    "REQ-U-07 All Sources links to the KB root, and switching tabs repoints the link without a reload",
    async ({ page }) => {
      test.skip(!dbControlAvailable(), "needs psql access to seed both connections and their KB folders");
      const project = await createProject(api);
      try {
        seedJiraRequirements(tenant!.organizationId, project.id, [`E2ESCR-${uniqueSuffix()}`]);
        seedLinearRequirements(tenant!.organizationId, project.id, [`E2ESCR-${uniqueSuffix()}`]);
        const jiraFolderId = seedProviderKbFolder(tenant!.organizationId, project.id, "jira");
        const linearFolderId = seedProviderKbFolder(tenant!.organizationId, project.id, "linear");

        // Both providers connected -> the page opens on "All Sources".
        await page.goto(`/projects/${project.id}/requirements`);
        // Two or more connected: the aggregate tab reads "Sources".
        const allTab = page.getByTestId("requirements-source-tab-all");
        await expect(allTab).toContainText("Sources");
        await expect(allTab).not.toContainText("All");
        const link = page.getByTestId("view-in-knowledge-base-link");
        await expect(link).toHaveAttribute("href", `/projects/${project.id}/knowledge-base`);

        await page.getByTestId("requirements-source-tab-jira").click();
        await expect(link).toHaveAttribute("href", `/projects/${project.id}/knowledge-base?folder=${jiraFolderId}`);

        await page.getByTestId("requirements-source-tab-linear").click();
        await expect(link).toHaveAttribute("href", `/projects/${project.id}/knowledge-base?folder=${linearFolderId}`);

        await page.getByTestId("requirements-source-tab-all").click();
        await expect(link).toHaveAttribute("href", `/projects/${project.id}/knowledge-base`);
      } finally {
        await deleteProjects(api, [project.id]);
      }
    },
  );

  test(
    "REQ-U-08 falls back to the KB root when the active provider has no KB folder yet (no sync has run)",
    async ({ page }) => {
      test.skip(!dbControlAvailable(), "needs psql access to seed a Jira connection without its KB folder");
      const project = await createProject(api);
      try {
        seedJiraRequirements(tenant!.organizationId, project.id, [`E2ESCR-${uniqueSuffix()}`]);
        // Deliberately no seedProviderKbFolder call: the "Jira" folder doesn't exist yet, exactly
        // as before that project's first sync has ever run.

        await page.goto(`/projects/${project.id}/requirements`);
        const link = page.getByTestId("view-in-knowledge-base-link");
        await expect(link).toHaveAttribute("href", `/projects/${project.id}/knowledge-base`);
      } finally {
        await deleteProjects(api, [project.id]);
      }
    },
  );
});

/*
 * The sync panel's project label. It used to show the mapping's key — a Linear Project's opaque
 * slugId ("4081f3c6e1df", V95) or a Jira key ("KAN") — and now shows the mapped name
 * (remote_project_name, V126) with the key as the hover tooltip, falling back to the key for runs
 * recorded before the name was stored. The run is seeded directly: a real sync would call the
 * provider's live API (see api/integrations.spec.ts's file header).
 */
test.describe("requirements page — sync panel names the project", () => {
  test.skip(!!skipReason, skipReason ?? "");

  let api: APIRequestContext;
  test.beforeAll(async () => {
    api = await screensApi();
  });
  test.afterAll(async () => {
    await api?.dispose();
  });

  function seedSyncRun(provider: "jira" | "linear", projectId: string, key: string, name: string | null): void {
    exec(
      "INSERT INTO integration_sync_runs (organization_id, project_id, provider, status, stage, trigger_source, " +
        "remote_project_key, remote_project_name, error, started_at, finished_at) VALUES (" +
        `${literal(tenant!.organizationId)}, ${literal(projectId)}, ${literal(provider)}, 'succeeded', 'done', 'manual', ` +
        `${literal(key)}, ${name === null ? "NULL" : literal(name)}, ` +
        `${literal(`No changes in ${name ?? key} since the last sync.`)}, now(), now());`,
    );
  }

  test("REQ-U-09 a Linear sync shows the project name, with the slugId only as the tooltip", async ({ page }) => {
    test.skip(!dbControlAvailable(), "needs psql access to seed a Linear connection and a sync run");
    const project = await createProject(api);
    const slug = `e2e${uniqueSuffix()}`; // shaped like a Linear slugId: opaque, lowercase, no spaces
    const name = `E2E Orange HRMS ${uniqueSuffix()}`;
    try {
      seedLinearRequirements(tenant!.organizationId, project.id, [`E2ESCR-${uniqueSuffix()}`]);
      seedSyncRun("linear", project.id, slug, name);

      await page.goto(`/projects/${project.id}/requirements`);
      const panel = page.getByRole("status").filter({ hasText: "Linear sync complete" });
      const chip = panel.getByTestId("sync-run-remote");
      await expect(chip).toHaveText(name);
      await expect(chip).toHaveAttribute("title", slug);
      await expect(panel).toContainText(`No changes in ${name} since the last sync.`);
      // The reported defect: the opaque slugId was the visible label.
      await expect(panel.getByText(slug, { exact: true })).toHaveCount(0);
    } finally {
      exec(`DELETE FROM integration_sync_runs WHERE project_id = ${literal(project.id)};`);
      await deleteProjects(api, [project.id]);
    }
  });

  test("REQ-U-10 a Linear sync recorded before names were stored falls back to its key", async ({ page }) => {
    test.skip(!dbControlAvailable(), "needs psql access to seed a Linear connection and a sync run");
    const project = await createProject(api);
    const slug = `e2e${uniqueSuffix()}`; // shaped like a Linear slugId: opaque, lowercase, no spaces
    try {
      seedLinearRequirements(tenant!.organizationId, project.id, [`E2ESCR-${uniqueSuffix()}`]);
      seedSyncRun("linear", project.id, slug, null);

      await page.goto(`/projects/${project.id}/requirements`);
      const panel = page.getByRole("status").filter({ hasText: "Linear sync complete" });
      await expect(panel.getByTestId("sync-run-remote")).toHaveText(slug);
    } finally {
      exec(`DELETE FROM integration_sync_runs WHERE project_id = ${literal(project.id)};`);
      await deleteProjects(api, [project.id]);
    }
  });

  // The same defect on Jira: the panel labelled a sync "KAN" rather than the project's name.
  test("REQ-U-16 a Jira sync shows the project name, with the key only as the tooltip", async ({ page }) => {
    test.skip(!dbControlAvailable(), "needs psql access to seed a Jira connection and a sync run");
    const project = await createProject(api);
    const key = `E2EK${uniqueSuffix()}`;
    const name = `E2E QA Demo ${uniqueSuffix()}`;
    try {
      seedJiraRequirements(tenant!.organizationId, project.id, [`E2ESCR-${uniqueSuffix()}`]);
      seedSyncRun("jira", project.id, key, name);

      await page.goto(`/projects/${project.id}/requirements`);
      const panel = page.getByRole("status").filter({ hasText: "Jira sync complete" });
      const chip = panel.getByTestId("sync-run-remote");
      await expect(chip).toHaveText(name);
      await expect(chip).toHaveAttribute("title", key);
      await expect(panel).toContainText(`No changes in ${name} since the last sync.`);
      await expect(panel.getByText(key, { exact: true })).toHaveCount(0);
    } finally {
      exec(`DELETE FROM integration_sync_runs WHERE project_id = ${literal(project.id)};`);
      await deleteProjects(api, [project.id]);
    }
  });

  test("REQ-U-17 a Jira sync recorded before names were stored falls back to its key", async ({ page }) => {
    test.skip(!dbControlAvailable(), "needs psql access to seed a Jira connection and a sync run");
    const project = await createProject(api);
    const key = `E2EK${uniqueSuffix()}`;
    try {
      seedJiraRequirements(tenant!.organizationId, project.id, [`E2ESCR-${uniqueSuffix()}`]);
      seedSyncRun("jira", project.id, key, null);

      await page.goto(`/projects/${project.id}/requirements`);
      const panel = page.getByRole("status").filter({ hasText: "Jira sync complete" });
      await expect(panel.getByTestId("sync-run-remote")).toHaveText(key);
    } finally {
      exec(`DELETE FROM integration_sync_runs WHERE project_id = ${literal(project.id)};`);
      await deleteProjects(api, [project.id]);
    }
  });
});

/*
 * The expanded-row Description used to print Linear's Markdown verbatim ("### LIN-05 ...",
 * "**Module:** Claim"), because Linear stores descriptions as Markdown and the row rendered them
 * as a plain <p>. Linear descriptions now go through lib/markdown.ts renderMarkdown(); Jira's stay
 * plain text, since the backend already flattens Jira's ADF to text (jiraDescriptionToText) and
 * that renderer would turn snake_case into italics.
 *
 * The row is expanded by clicking its summary cell — the key cell is a link that stops propagation,
 * so clicking it opens the provider instead of toggling the detail row.
 */
test.describe("requirements page — ticket description rendering", () => {
  test.skip(!!skipReason, skipReason ?? "");

  let api: APIRequestContext;
  test.beforeAll(async () => {
    api = await screensApi();
  });
  test.afterAll(async () => {
    await api?.dispose();
  });

  async function openDescription(page: import("@playwright/test").Page, projectId: string, key: string) {
    await page.goto(`/projects/${projectId}/requirements`);
    await page.getByText(`Requirement ${key}`, { exact: true }).click();
    return page.getByTestId("ticket-description");
  }

  test("REQ-U-11 a Linear description renders its Markdown instead of printing it raw", async ({ page }) => {
    test.skip(!dbControlAvailable(), "needs psql access to seed linear_tickets directly");
    const project = await createProject(api);
    try {
      const key = `E2ESCR-${uniqueSuffix()}`;
      // Shaped like the reported ticket (LIN-05), which is exactly what a Linear sync stores.
      const markdown = [
        "### LIN-05: Submit an Expense Claim",
        "",
        "**Module:** Claim",
        "**Priority:** Medium",
        "",
        "**Acceptance Criteria:**",
        "- Employee can attach a receipt",
        "- Claim total is validated",
        "",
        "See [the spec](https://example.com/spec).",
      ].join("\n");
      seedLinearRequirements(tenant!.organizationId, project.id, [key], { [key]: markdown });

      const desc = await openDescription(page, project.id, key);
      await expect(desc.locator("h3")).toHaveText("LIN-05: Submit an Expense Claim");
      await expect(desc.locator("strong", { hasText: "Module:" })).toBeVisible();
      await expect(desc.locator("strong", { hasText: "Acceptance Criteria:" })).toBeVisible();
      await expect(desc.locator("li")).toHaveText(["Employee can attach a receipt", "Claim total is validated"]);
      const link = desc.getByRole("link", { name: "the spec" });
      await expect(link).toHaveAttribute("href", "https://example.com/spec");
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", /noopener/);
      // The reported defect: the raw markers were the visible text.
      await expect(desc).not.toContainText("###");
      await expect(desc).not.toContainText("**");
    } finally {
      await deleteProjects(api, [project.id]);
    }
  });

  test("REQ-U-12 HTML inside a Linear description is shown as text and never executes", async ({ page }) => {
    test.skip(!dbControlAvailable(), "needs psql access to seed linear_tickets directly");
    const project = await createProject(api);
    try {
      const key = `E2ESCR-${uniqueSuffix()}`;
      const payload = [
        `<img src=x onerror="window.__reqDescXss=1">`,
        `<script>window.__reqDescXss=1</script>`,
        `[click me](javascript:window.__reqDescXss=1)`,
        `[breakout](https://a.test/" onmouseover="window.__reqDescXss=1" x=")`,
      ].join("\n");
      seedLinearRequirements(tenant!.organizationId, project.id, [key], { [key]: payload });

      const desc = await openDescription(page, project.id, key);
      await expect(desc).toContainText(`<img src=x onerror=`);
      await expect(desc).toContainText(`<script>`);
      await expect(desc.locator("img, script")).toHaveCount(0);
      // renderMarkdown only links http(s) URLs, so the javascript: link must stay plain text.
      await expect(desc.locator('a[href^="javascript:"]')).toHaveCount(0);
      // The quote-breakout attempt must not have produced a live event-handler attribute.
      await expect(desc.locator("[onmouseover], [onerror]")).toHaveCount(0);
      await desc.hover();
      expect(await page.evaluate(() => (window as unknown as { __reqDescXss?: number }).__reqDescXss)).toBeUndefined();
    } finally {
      await deleteProjects(api, [project.id]);
    }
  });

  test("REQ-U-13 a Jira description stays literal plain text — snake_case is not italicised", async ({ page }) => {
    test.skip(!dbControlAvailable(), "needs psql access to seed jira_tickets directly");
    const project = await createProject(api);
    try {
      const key = `E2ESCR-${uniqueSuffix()}`;
      const text = "Validate the user_account_id field\n**kept literally**\nline three";
      seedJiraRequirements(tenant!.organizationId, project.id, [key], { [key]: text });

      const desc = await openDescription(page, project.id, key);
      await expect(desc).toContainText("user_account_id");
      await expect(desc).toContainText("**kept literally**");
      await expect(desc.locator("em, strong, h1, h2, h3, li")).toHaveCount(0);
      // whitespace-pre-wrap keeps Jira's line breaks, which a plain <p> would otherwise collapse.
      expect(await desc.innerText()).toContain("field\n**kept literally**\nline three");
    } finally {
      await deleteProjects(api, [project.id]);
    }
  });

  test("REQ-U-14 a ticket with no description shows no Description block, but the row still expands", async ({ page }) => {
    test.skip(!dbControlAvailable(), "needs psql access to seed linear_tickets directly");
    const project = await createProject(api);
    try {
      const key = `E2ESCR-${uniqueSuffix()}`;
      seedLinearRequirements(tenant!.organizationId, project.id, [key]); // description left NULL

      const desc = await openDescription(page, project.id, key);
      await expect(page.getByRole("link", { name: "Open in Linear →" })).toBeVisible();
      await expect(desc).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Description", exact: true })).toHaveCount(0);
    } finally {
      await deleteProjects(api, [project.id]);
    }
  });

  test("REQ-U-15 a long Linear description scrolls inside its capped box instead of stretching the row", async ({ page }) => {
    test.skip(!dbControlAvailable(), "needs psql access to seed linear_tickets directly");
    const project = await createProject(api);
    try {
      const key = `E2ESCR-${uniqueSuffix()}`;
      const long = ["### Long ticket", ...Array.from({ length: 80 }, (_, i) => `- Criterion ${i + 1}`)].join("\n");
      seedLinearRequirements(tenant!.organizationId, project.id, [key], { [key]: long });

      const desc = await openDescription(page, project.id, key);
      await expect(desc.locator("li")).toHaveCount(80);
      // max-h-48 = 12rem = 192px.
      const box = await desc.evaluate((el) => ({ h: el.clientHeight, sh: el.scrollHeight }));
      expect(box.h).toBeLessThanOrEqual(192);
      expect(box.sh).toBeGreaterThan(box.h);
    } finally {
      await deleteProjects(api, [project.id]);
    }
  });
});
