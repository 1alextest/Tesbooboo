import { errors, expect, test, type Locator, type Page, type Request, type Route, type TestInfo } from "@playwright/test";
import { Client } from "pg";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  // Gates are also awaited below. Attach a handler now so a route fault cannot become an
  // unhandled rejection while its caller is still driving the UI toward that gate.
  void promise.catch(() => undefined);
  return { promise, resolve, reject };
}

/** Hold one real HTTP request before delivery or after Nest has returned its committed result. */
async function hold(page: Page, url: string, method: string, stage: "delivery" | "ack", drop = false) {
  const ready = deferred(), release = deferred(), done = deferred();
  let entered = false;
  const handler = async (route: Route) => {
    if (route.request().method() !== method || entered) { await route.continue(); return; }
    entered = true;
    try {
      if (stage === "delivery") { ready.resolve(); await release.promise; }
      const response = await route.fetch({ maxRetries: 0 });
      expect(response.ok(), await response.text()).toBeTruthy();
      if (stage === "ack") { ready.resolve(); await release.promise; }
      if (drop) await route.abort("failed");
      else await route.fulfill({ response });
      done.resolve();
    } catch (error) {
      ready.reject(error); done.reject(error);
    }
  };
  await page.route(url, handler);
  return {
    ready: ready.promise,
    async finish() { release.resolve(); await done.promise; },
    async close() {
      release.resolve();
      try { if (entered) await done.promise; }
      finally { await page.unroute(url, handler); }
    },
  };
}

async function doubleClickSynchronously(button: Locator) {
  await button.evaluate((element) => { (element as HTMLButtonElement).click(); (element as HTMLButtonElement).click(); });
}

async function expectNoRequest(page: Page, predicate: (request: Request) => boolean) {
  // An observation window beyond the actual 1200ms debounce, not a blind sleep or a retry.
  const dispatched = await page.waitForRequest(predicate, { timeout: 1600 }).then(() => true, (error: unknown) => {
    if (error instanceof errors.TimeoutError) return false;
    throw error;
  });
  expect(dispatched, "no automatic mutation may be dispatched in the debounce observation window").toBe(false);
}

const content = (text: string) => ({
  contentJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] },
  contentHtml: `<p>${text}</p>`, contentText: text,
});

/** Uses only the smoke's loopback, disposable tesbo_ci installation and genuine session. */
export async function verifyDocumentWrites(page: Page, api: string, web: string, projectId: string, testInfo: TestInfo) {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  const base = `${api}/api/projects/${projectId}/knowledge-base`;
  const failures: unknown[] = [];
  const calls: Array<{ method: string; url: string }> = [];
  const observe = (request: Request) => {
    if (["PATCH", "POST"].includes(request.method()) && request.url().startsWith(`${base}/documents/`)) {
      calls.push({ method: request.method(), url: request.url() });
    }
  };
  const editor = () => page.locator(".ProseMirror").first();
  const title = () => page.getByPlaceholder("Untitled document", { exact: true });
  const panel = () => page.getByRole("heading", { name: "Update History", exact: true }).locator("..");
  const save = () => page.getByRole("button", { name: "Save", exact: true });
  const checked = async (name: string, run: () => Promise<void>) => {
    try { await test.step(name, run); }
    catch (error) {
      failures.push(error);
      await testInfo.attach(`document-write-failure-${failures.length}`, { body: await page.screenshot(), contentType: "image/png" });
    }
  };
  const capture = async (name: string) => testInfo.attach(name, { body: await page.screenshot(), contentType: "image/png" });
  const count = (url: string, method: string) => calls.filter((call) => call.url === url && call.method === method).length;
  const state = async (id: string) => ({
    // Deliberately exclude asynchronous embedding-worker bookkeeping, not editable metadata.
    doc: (await db.query(`SELECT id, project_id, folder_id, title, content_json, content_html, content_text,
      document_type, status, is_read_only, source_provider, source_role, created_by, updated_by,
      reviewed_by, reviewed_at, is_deleted, created_at, updated_at, deleted_at FROM knowledge_documents WHERE id = $1`, [id])).rows[0],
    versions: (await db.query("SELECT * FROM knowledge_document_versions WHERE document_id = $1 ORDER BY version_number", [id])).rows,
    comments: (await db.query("SELECT * FROM knowledge_document_comments WHERE document_id = $1 ORDER BY id", [id])).rows,
    audit: (await db.query("SELECT * FROM audit_logs WHERE project_id = $1 AND entity_id::text = $2 ORDER BY id", [projectId, id])).rows,
  });
  await db.connect();
  page.on("request", observe);
  try {
    const root = await page.request.get(`${base}/folders/tree`);
    expect(root.ok(), await root.text()).toBeTruthy();
    const folderId = (await root.json()).id;
    let sequence = 0;
    async function fixture(label: string) {
      const originalTitle = `CI write ${++sequence} ${label} original`, originalBody = `Earlier body ${sequence}`;
      const currentTitle = `CI write ${sequence} ${label} current`, currentBody = `Current body ${sequence}`;
      const created = await page.request.post(`${base}/documents`, { data: { folderId, title: originalTitle, ...content(originalBody) } });
      expect(created.ok(), await created.text()).toBeTruthy();
      const id = (await created.json()).id as string;
      const url = `${base}/documents/${id}`, restoreUrl = `${url}/restore-version`;
      const updated = await page.request.patch(url, { data: { title: currentTitle, ...content(currentBody) } });
      expect(updated.ok(), await updated.text()).toBeTruthy();
      const before = await state(id);
      expect(before.versions).toHaveLength(1);
      return { id, url, restoreUrl, originalTitle, originalBody, currentTitle, currentBody, before,
        isSave: (request: Request) => request.url() === url && request.method() === "PATCH",
        isWrite: (request: Request) => [url, restoreUrl].includes(request.url()) && ["PATCH", "POST"].includes(request.method()),
      };
    }
    async function open(doc: Awaited<ReturnType<typeof fixture>>) {
      await page.goto(`${web}/projects/${projectId}/knowledge-base/documents/${doc.id}`);
      await expect(title()).toHaveValue(doc.currentTitle);
      await expect(editor()).toHaveText(doc.currentBody);
      await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    }
    async function confirmPanel() {
      await page.getByRole("button", { name: "More actions", exact: true }).click();
      await page.getByRole("button", { name: "View history", exact: true }).click();
      await panel().getByRole("button", { name: "Restore", exact: true }).first().click();
      await expect(panel()).toContainText("Restore to the version from");
      return panel();
    }
    async function restored(doc: Awaited<ReturnType<typeof fixture>>) {
      await expect(page.getByRole("heading", { name: "Update History", exact: true })).toHaveCount(0);
      await expect(title()).toHaveValue(doc.originalTitle);
      await expect(editor()).toHaveText(doc.originalBody);
      await expect(page.getByText("Saved", { exact: true })).toBeVisible();
      expect((await state(doc.id)).doc).toMatchObject({ title: doc.originalTitle, content_text: doc.originalBody, folder_id: folderId });
    }

    const control = await fixture("unselected control");
    await checked("a held PATCH drains once before a double-confirmed restore; restoration emits no autosave", async () => {
      const doc = await fixture("delivery barrier");
      await open(doc);
      const gate = await hold(page, doc.url, "PATCH", "delivery");
      try {
        await editor().fill("Draft delivered before restore");
        await doubleClickSynchronously(save());
        await gate.ready;
        const dialog = await confirmPanel();
        await doubleClickSynchronously(dialog.getByRole("button", { name: "Restore", exact: true }));
        await expect(dialog.getByRole("button", { name: "Restoring…", exact: true })).toBeDisabled();
        await expect(title()).toHaveAttribute("readonly", "");
        await expect(editor()).toHaveAttribute("contenteditable", "false");
        await expectNoRequest(page, (request) => request.url() === doc.restoreUrl && request.method() === "POST");
        expect(count(doc.url, "PATCH")).toBe(1);
        expect(await state(doc.id)).toEqual(doc.before);
        await capture("document-save-restore-delivery-barrier");
        await gate.finish();
        await restored(doc);
        expect(count(doc.restoreUrl, "POST")).toBe(1);
        const after = await state(doc.id);
        expect(after.versions).toHaveLength(2);
        expect(after.versions[1].content_text).toBe("Draft delivered before restore");
        expect(after.comments).toEqual(doc.before.comments);
        await expectNoRequest(page, doc.isWrite);
        expect(await state(doc.id)).toEqual(after);
        expect(count(doc.url, "PATCH")).toBe(1);
        await page.reload();
        await expect(editor()).toHaveText(doc.originalBody);
        await expectNoRequest(page, doc.isWrite);
        expect(await state(doc.id)).toEqual(after);
        await capture("document-restored-without-second-autosave");
      } finally { await gate.close(); }
    });

    await checked("a delayed committed save ACK cannot mark newer edits saved or reset the draft", async () => {
      const doc = await fixture("stale acknowledgement");
      await open(doc);
      const first = await hold(page, doc.url, "PATCH", "ack");
      let second: Awaited<ReturnType<typeof hold>> | undefined;
      try {
        await title().fill("First committed title");
        await editor().fill("First committed body");
        await save().click(); await first.ready;
        expect((await state(doc.id)).doc).toMatchObject({ title: "First committed title", content_text: "First committed body" });
        second = await hold(page, doc.url, "PATCH", "ack");
        await title().fill("Newer unsaved title");
        await editor().fill("Newer unsaved body");
        await expectNoRequest(page, doc.isSave); // Its debounce queues behind the first ACK.
        expect(count(doc.url, "PATCH")).toBe(1);
        await first.finish(); await second.ready;
        await expect(title()).toHaveValue("Newer unsaved title");
        await expect(editor()).toHaveText("Newer unsaved body");
        await expect(page.getByText("Saved", { exact: true })).toHaveCount(0);
        await expect(page.getByText("Saving…", { exact: true })).toBeVisible();
        await capture("document-newer-draft-awaiting-own-ack");
        await second.finish();
        await expect(page.getByText("Saved", { exact: true })).toBeVisible();
        expect(count(doc.url, "PATCH")).toBe(2);
        const after = await state(doc.id);
        expect(after.doc).toMatchObject({ title: "Newer unsaved title", content_text: "Newer unsaved body", folder_id: folderId });
        expect(after.versions).toHaveLength(1); // Existing coalescing window, not per-keystroke snapshots.
        await page.reload();
        await expect(title()).toHaveValue("Newer unsaved title");
        await expect(editor()).toHaveText("Newer unsaved body");
        expect(await state(doc.id)).toEqual(after);
      } finally { if (second) await second.close(); await first.close(); }
    });

    await checked("a lost successful save ACK blocks an already-queued restore and retains explicit recovery", async () => {
      const doc = await fixture("uncertain save");
      await open(doc);
      const gate = await hold(page, doc.url, "PATCH", "ack", true);
      try {
        await editor().fill("Retained draft after uncertain ACK");
        await save().click(); await gate.ready;
        const committed = await state(doc.id);
        expect(committed.doc.content_text).toBe("Retained draft after uncertain ACK");
        const dialog = await confirmPanel();
        await dialog.getByRole("button", { name: "Restore", exact: true }).click();
        await gate.finish();
        await expect(dialog).toContainText(/outcome unconfirmed/i);
        await expect(dialog.getByRole("button", { name: "Restore", exact: true })).toBeEnabled();
        await expect(editor()).toHaveText("Retained draft after uncertain ACK");
        await expect(page.getByText("Unsaved changes", { exact: true })).toBeVisible();
        await expectNoRequest(page, doc.isWrite);
        expect(count(doc.url, "PATCH")).toBe(1); expect(count(doc.restoreUrl, "POST")).toBe(0);
        expect(await state(doc.id)).toEqual(committed);
        await capture("document-uncertain-save-blocks-queued-restore");
        await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
        await page.keyboard.press("Escape");
        // Check the real saved state before a NEW explicit action. No automatic mutation retry.
        const readback = await page.request.get(doc.url);
        expect((await readback.json()).contentText).toBe("Retained draft after uncertain ACK");
        const saved = page.waitForResponse((response) => doc.isSave(response.request()));
        await doubleClickSynchronously(save());
        expect((await saved).ok()).toBeTruthy();
        await expect(page.getByText("Saved", { exact: true })).toBeVisible();
        expect(count(doc.url, "PATCH")).toBe(2);
        const retryDialog = await confirmPanel();
        await retryDialog.getByRole("button", { name: "Restore", exact: true }).click();
        await restored(doc);
        expect(count(doc.restoreUrl, "POST")).toBe(1);
        await expectNoRequest(page, doc.isWrite);
      } finally { await gate.close(); }
    });

    await checked("a server-side read-only transition refuses restore with history, associations and audit unchanged", async () => {
      const doc = await fixture("read-only transition");
      await open(doc);
      const dialog = await confirmPanel();
      await db.query("UPDATE knowledge_documents SET is_read_only = true, source_provider = 'notion', source_role = 'mirror' WHERE id = $1", [doc.id]);
      const before = await state(doc.id);
      const response = page.waitForResponse((result) => result.url() === doc.restoreUrl && result.request().method() === "POST");
      await doubleClickSynchronously(dialog.getByRole("button", { name: "Restore", exact: true }));
      expect((await response).status()).toBe(400);
      await expect(dialog).toContainText(/synced from Notion/);
      await expect(editor()).toHaveText(doc.currentBody);
      expect(count(doc.restoreUrl, "POST")).toBe(1);
      expect(await state(doc.id)).toEqual(before);
      await expectNoRequest(page, doc.isWrite);
      await capture("document-read-only-restore-refusal");
      await page.reload();
      await expect(title()).toHaveAttribute("readonly", "");
      await expect(editor()).toHaveAttribute("contenteditable", "false");
      await expect(save()).toHaveCount(0);
      expect(await state(doc.id)).toEqual(before);
    });

    for (const kind of ["debounced", "queued"]) {
      await checked(`client navigation drains the ${kind} edit to its original document without touching the destination`, async () => {
        const doc = await fixture(`navigation ${kind}`);
        await open(doc);
        const gate = await hold(page, doc.url, "PATCH", kind === "queued" ? "ack" : "delivery");
        try {
          await page.evaluate(() => Reflect.set(window, "__tesboDocumentNavigation", "same-client-document"));
          if (kind === "queued") {
            await editor().fill("First navigation write");
            await save().click(); await gate.ready;
          }
          await editor().fill(`Preserved ${kind} navigation draft`);
          if (kind === "queued") await save().click();
          else expect(count(doc.url, "PATCH"), "exercise the unsent debounce, not an already-submitted save").toBe(0);
          await page.getByRole("link", { name: "Back to Knowledge base", exact: true }).click();
          await page.getByRole("button", { name: control.currentTitle, exact: true }).click();
          await expect(title()).toHaveValue(control.currentTitle);
          await expect(editor()).toHaveText(control.currentBody);
          expect(await page.evaluate(() => Reflect.get(window, "__tesboDocumentNavigation"))).toBe("same-client-document");
          await gate.ready;
          await gate.finish();
          await expect.poll(async () => (await state(doc.id)).doc.content_text).toBe(`Preserved ${kind} navigation draft`);
          await expectNoRequest(page, control.isWrite);
          expect(count(doc.url, "PATCH")).toBe(kind === "queued" ? 2 : 1);
          expect(await state(control.id)).toEqual(control.before);
          await expect(title()).toHaveValue(control.currentTitle);
          await expect(editor()).toHaveText(control.currentBody);
          await capture(`document-${kind}-navigation-preserved`);
        } finally { await gate.close(); }
      });
    }

    await checked("a late document load cannot replace another document reached through client navigation", async () => {
      const doc = await fixture("stale load");
      await open(control);
      await page.getByRole("link", { name: "Back to Knowledge base", exact: true }).click();
      const gate = await hold(page, doc.url, "GET", "ack");
      try {
        await page.getByRole("button", { name: doc.currentTitle, exact: true }).click();
        await gate.ready;
        await page.locator(`a[href="/projects/${projectId}/knowledge-base"]`).first().click();
        await page.getByRole("button", { name: control.currentTitle, exact: true }).click();
        await expect(title()).toHaveValue(control.currentTitle);
        await gate.finish();
        await expectNoRequest(page, (request) => doc.isWrite(request) || control.isWrite(request));
        await expect(title()).toHaveValue(control.currentTitle);
        await expect(editor()).toHaveText(control.currentBody);
        expect(await state(doc.id)).toEqual(doc.before);
        expect(await state(control.id)).toEqual(control.before);
      } finally { await gate.close(); }
    });

    await checked("cancelling restore preserves the pending debounce; only confirmation replaces an unsent draft", async () => {
      const doc = await fixture("unsent draft");
      await open(doc);
      // Freeze browser timers only for this final journey so the exact unsent-debounce boundary
      // is deterministic. Nest/PostgreSQL and every HTTP response remain real and unmodified.
      await page.clock.install();
      await page.clock.pauseAt(new Date());
      try {
        await editor().fill("Draft preserved by Cancel");
        const dialog = await confirmPanel();
        await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
        await page.keyboard.press("Escape");
        const saved = page.waitForResponse((response) => doc.isSave(response.request()));
        await page.clock.runFor(1300);
        expect((await saved).ok()).toBeTruthy();
        await expect(page.getByText("Saved", { exact: true })).toBeVisible();
        expect((await state(doc.id)).doc.content_text).toBe("Draft preserved by Cancel");
        await editor().fill("Unsent draft replaced only by confirmation");
        const confirmed = await confirmPanel();
        await confirmed.getByRole("button", { name: "Restore", exact: true }).click();
        await restored(doc);
        const after = await state(doc.id);
        expect(after.versions[1].content_text).toBe("Draft preserved by Cancel");
        await page.clock.runFor(1600);
        expect(count(doc.url, "PATCH")).toBe(1);
        expect(count(doc.restoreUrl, "POST")).toBe(1);
        expect(await state(doc.id)).toEqual(after);
      } finally { await page.clock.resume(); }
    });

    expect(await state(control.id)).toEqual(control.before);
    if (failures.length) throw new AggregateError(failures, `${failures.length} document-write journeys failed; see steps and captures`);
  } finally {
    page.off("request", observe);
    // Retain these isolated synthetic documents, versions and immutable audit provenance until
    // disposable PostgreSQL teardown. There is no production/historical cleanup in this helper.
    await db.end();
  }
}
