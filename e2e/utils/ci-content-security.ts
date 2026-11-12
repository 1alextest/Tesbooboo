import { errors, expect, test, type Locator, type Page, type Request, type TestInfo } from "@playwright/test";
import { Client } from "pg";
import * as XLSX from "xlsx";

async function paste(editor: Locator, text: string, html?: string) {
  await editor.focus(); // Do not move the caret after the caller deliberately selected the end.
  await editor.evaluate((element, data) => {
    const clipboard = new DataTransfer();
    clipboard.setData("text/plain", data.text);
    if (data.html) clipboard.setData("text/html", data.html);
    element.dispatchEvent(new ClipboardEvent("paste", { clipboardData: clipboard, bubbles: true, cancelable: true }));
  }, { text, html });
}

/** Reuses the existing smoke's authenticated disposable project; no fabricated API responses. */
export async function verifyContentSecurity(page: Page, api: string, web: string, projectId: string, testInfo: TestInfo) {
  const request = page.request;
  const importDialog = page.getByRole("dialog", { name: "Import Test Cases", exact: true });
  const base = `${api}/api/projects/${projectId}`;
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  let documentId = "";
  let bugId = "";
  const importedIds: string[] = [];
  const failures: unknown[] = [];
  // These journeys have separate fixtures. Report all independent failures in one CI run, but
  // always reject the test afterward; catching here must never turn a failed check into green.
  const checkedStep = async (name: string, run: () => Promise<void>) => {
    try {
      await test.step(name, run);
    } catch (error) {
      failures.push(error);
      await testInfo.attach(`content-flow-failure-${failures.length}`, { body: await page.screenshot(), contentType: "image/png" });
    }
  };
  await db.connect();
  try {
    await checkedStep("patched knowledge editor preserves Markdown/table/task/link content through save and reload", async () => {
      const root = await request.get(`${base}/knowledge-base/folders/tree`);
      expect(root.ok(), await root.text()).toBeTruthy();
      const created = await request.post(`${base}/knowledge-base/documents`, {
        data: { title: "CI patched rich content", folderId: (await root.json()).id, documentType: "general" },
      });
      expect(created.ok(), await created.text()).toBeTruthy();
      documentId = (await created.json()).id;
      await page.goto(`${web}/projects/${projectId}/knowledge-base/documents/${documentId}`);
      const editor = page.locator(".ProseMirror").first();
      await expect(editor).toBeVisible();
      await paste(editor, "## Patched editor\n\n**Preserved bold** and `literal code`\n\n- [x] Checked item\n- [ ] Open item\n\n| Name | Value |\n| --- | --- |\n| café 漢字 | preserved |\n\n[Safe link](https://example.invalid/control)");
      await expect(editor.locator("h2")).toHaveText("Patched editor");
      await expect(editor.locator("strong")).toHaveText("Preserved bold");
      await expect(editor.locator("table")).toContainText("café 漢字");
      await expect(editor.getByRole("checkbox")).toHaveCount(2);
      await expect(editor.getByRole("checkbox", { name: "Task item checkbox for Checked item", exact: true })).toBeChecked();
      await expect(editor.getByRole("checkbox", { name: "Task item checkbox for Open item", exact: true })).not.toBeChecked();
      await expect(editor.getByRole("link", { name: "Safe link" })).toHaveAttribute("href", "https://example.invalid/control");

      // Exercise the actual HTML paste boundary too. Harmless local sentinels, no exfiltration or
      // external resource. This is a boundary regression, not a claim to reproduce every CVE path.
      await editor.press("ControlOrMeta+End");
      await paste(editor, "Untrusted paste", '<p><strong>Untrusted paste</strong><img src="data:image/png;base64,broken" onerror="window.__tesboContentProbe=1"><a href="javascript:window.__tesboContentProbe=2">unsafe link</a><script>window.__tesboContentProbe=3</script></p>');
      await expect(editor).toContainText("Untrusted paste");
      await expect(editor.locator('script, [onerror], a[href^="javascript:"]')).toHaveCount(0);
      expect(await page.evaluate(() => Reflect.get(window, "__tesboContentProbe"))).toBeUndefined();
      await page.getByRole("button", { name: "Save", exact: true }).click();
      const stored = async () => (await db.query("SELECT content_json, content_html, content_text, updated_at FROM knowledge_documents WHERE id = $1", [documentId])).rows[0];
      await expect.poll(async () => (await stored()).content_html).toContain("Untrusted paste");
      const beforeReload = await stored();
      expect(beforeReload.content_html).toContain("<strong>Preserved bold</strong>");
      expect(beforeReload.content_html).not.toMatch(/<script|\sonerror=|href="javascript:/i);
      const versions = async () => (await db.query("SELECT * FROM knowledge_document_versions WHERE document_id = $1 ORDER BY id", [documentId])).rows;
      const beforeVersions = await versions();
      const saves: string[] = [];
      const isSave = (request: Request) => request.method() === "PATCH" && request.url() === `${base}/knowledge-base/documents/${documentId}`;
      const observe = (request: Request) => { if (isSave(request)) saves.push(request.url()); };
      page.on("request", observe);
      try {
        // Existing Blank-document rule requires both title and body; an unchanged explicit save
        // must still have the loaded body after initialization stops emitting fake content edits.
        await page.evaluate((id) => localStorage.setItem(`kb-blank-doc:${id}`, "1"), documentId);
        await page.reload();
        await expect(page.locator(".ProseMirror").first()).toContainText("Untrusted paste");
        await expect(page.locator(".ProseMirror table")).toContainText("café 漢字");
        await expect(page.locator(".ProseMirror").first().getByRole("checkbox", { name: "Task item checkbox for Checked item", exact: true })).toBeChecked();
        await expect(page.locator(".ProseMirror").first().getByRole("checkbox", { name: "Task item checkbox for Open item", exact: true })).not.toBeChecked();
        await expect(page.getByText("Saved", { exact: true })).toBeVisible();
        // Observe absence beyond the actual 1200ms autosave debounce, starting AFTER hydration.
        // The listener above also records an earlier save during reload; no blind sleep/retry.
        const saved = await page.waitForRequest(isSave, { timeout: 1600 }).then(() => true, (error: unknown) => {
          if (error instanceof errors.TimeoutError) return false;
          throw error;
        });
        expect(saved).toBe(false);
        expect(saves).toEqual([]);
        expect(await stored()).toEqual(beforeReload);
        expect(await versions()).toEqual(beforeVersions);
      } finally {
        page.off("request", observe);
      }
      const explicitSave = page.waitForResponse((response) => isSave(response.request()));
      await page.getByRole("button", { name: "Save", exact: true }).click();
      const response = await explicitSave;
      expect(response.ok(), await response.text()).toBeTruthy();
      expect(await stored()).toMatchObject({ content_json: beforeReload.content_json, content_html: beforeReload.content_html, content_text: beforeReload.content_text });
      await expect(page.getByText("Saved", { exact: true })).toBeVisible();
      await page.evaluate((id) => localStorage.removeItem(`kb-blank-doc:${id}`), documentId);
      expect(await page.evaluate(() => Reflect.get(window, "__tesboContentProbe"))).toBeUndefined();
      await testInfo.attach("patched-knowledge-editor", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    });

    await checkedStep("patched bug comment editor retains Markdown serialization and does not persist executable pasted HTML", async () => {
      const created = await request.post(`${base}/bugs`, { data: { title: "CI patched comment control" } });
      expect(created.ok(), await created.text()).toBeTruthy();
      bugId = (await created.json()).id;
      await page.goto(`${web}/projects/${projectId}/bugs/${bugId}`);
      await page.getByTestId("bug-comment-open").click();
      const editor = page.getByRole("textbox", { name: "Add a comment", exact: true });
      await expect(editor).toBeVisible();
      await paste(editor, "**Comment bold** and [Comment link](https://example.invalid/comment)\n- preserved item");
      await expect(editor.locator("strong")).toHaveText("Comment bold");
      await editor.press("ControlOrMeta+End");
      await paste(editor, "HTML control", '<p><em>HTML control</em><img src="data:image/png;base64,broken" onerror="window.__tesboContentProbe=4"><script>window.__tesboContentProbe=5</script></p>');
      await expect(editor.locator("script, [onerror]")).toHaveCount(0);
      expect(await page.evaluate(() => Reflect.get(window, "__tesboContentProbe"))).toBeUndefined();
      await page.getByRole("button", { name: "Add Comment", exact: true }).click();
      const comments = async () => (await db.query("SELECT body FROM bug_comments WHERE bug_id = $1 AND is_deleted = false ORDER BY created_at", [bugId])).rows;
      await expect.poll(async () => (await comments()).length).toBe(1);
      const beforeReload = await comments();
      expect(beforeReload[0].body).toContain("**Comment bold**");
      expect(beforeReload[0].body).toContain("[Comment link](https://example.invalid/comment)");
      expect(beforeReload[0].body).toContain("HTML control");
      expect(beforeReload[0].body).not.toMatch(/<script|onerror=/i);
      await page.reload();
      await expect(page.locator("strong").filter({ hasText: "Comment bold" })).toBeVisible();
      expect(await comments()).toEqual(beforeReload);
      await testInfo.attach("patched-comment-editor", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
    });

    await checkedStep("rejected file types and a cancelled preview never create test cases", async () => {
      const rows = async () => (await db.query("SELECT * FROM testcases WHERE project_id = $1 AND deleted_at IS NULL ORDER BY id", [projectId])).rows;
      const before = await rows();
      await page.goto(`${web}/projects/${projectId}/testcases`);
      await page.getByRole("button", { name: "Import", exact: true }).click();
      await importDialog.locator('input[type="file"]').setInputFiles({ name: "rejected.pdf", mimeType: "application/pdf", buffer: Buffer.from("synthetic unsupported file") });
      await expect(importDialog.getByText('Unsupported file format ".pdf". Please upload a .csv, .xlsx, or .xls file.')).toBeVisible();
      await expect(importDialog.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
      expect(await rows()).toEqual(before);
      await importDialog.locator('input[type="file"]').setInputFiles({ name: "cancel.csv", mimeType: "text/csv", buffer: Buffer.from("Title\nCI cancelled import must not persist\n") });
      await importDialog.getByRole("button", { name: "Next", exact: true }).click();
      await expect(importDialog.getByText("Map your file columns to test case fields.")).toBeVisible();
      expect(await rows()).toEqual(before);
      await importDialog.getByRole("button", { name: "Back", exact: true }).click();
      await importDialog.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(importDialog).toHaveCount(0);
      expect(await rows()).toEqual(before);
    });

    for (const format of ["csv", "csv-1251", "xlsx", "xls"]) {
      await checkedStep(`patched ${format} importer maps, persists and reloads Unicode/steps without importing the unselected sheet`, async () => {
        const title = format === "csv-1251" ? "CI legacy Привет" : `CI ${format} Привет café 漢字`;
        const description = format === "csv-1251" ? "Привет" : "Quoted, multiline\nsecond line";
        const rows = [["Title", "Description", "Steps"], [title, description, "Open => Visible"]];
        let buffer: Buffer;
        if (format === "csv") buffer = Buffer.from(`Title,Description,Steps\r\n"${title}","${description}",Open => Visible\r\n`);
        else if (format === "csv-1251") {
          // The only non-ASCII fixture word is Привет; encode its six Windows-1251 bytes explicitly.
          const legacy = (value: string) => Buffer.concat(value.split("Привет").flatMap((part, index) => index ? [Buffer.from([0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2]), Buffer.from(part)] : [Buffer.from(part)]));
          buffer = legacy(`Title,Description,Steps\r\n${title},${description},Open => Visible\r\n`);
        } else {
          const workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Title"], ["CI unselected sheet must not persist"]]), "Control");
          XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Cases");
          buffer = XLSX.write(workbook, { type: "buffer", bookType: format === "xls" ? "biff8" : "xlsx" }) as Buffer;
        }
        const before = (await db.query("SELECT * FROM testcases WHERE project_id = $1 AND deleted_at IS NULL ORDER BY id", [projectId])).rows;
        await page.goto(`${web}/projects/${projectId}/testcases`);
        await page.getByRole("button", { name: "Import", exact: true }).click();
        await importDialog.locator('input[type="file"]').setInputFiles({ name: `security.${format.startsWith("csv") ? "csv" : format}`, mimeType: format.startsWith("csv") ? "text/csv" : "application/octet-stream", buffer });
        await importDialog.getByRole("button", { name: "Next", exact: true }).click();
        await expect(importDialog.getByText("Map your file columns to test case fields.")).toBeVisible();
        if (!format.startsWith("csv")) {
          // Real worksheet selection remaps headers. Both sheets are title-bearing on purpose.
          await importDialog.locator('select').filter({ has: page.locator('option[value="Cases"]') }).selectOption("Cases");
        }
        expect((await db.query("SELECT * FROM testcases WHERE project_id = $1 AND deleted_at IS NULL ORDER BY id", [projectId])).rows).toEqual(before);
        await importDialog.getByRole("button", { name: "Import 1 rows", exact: true }).click();
        await expect(importDialog.getByText("Import complete.", { exact: true })).toBeVisible();
        const stored = (await db.query("SELECT id, title, description, steps FROM testcases WHERE project_id = $1 AND deleted_at IS NULL AND title = $2", [projectId, title])).rows;
        importedIds.push(...stored.map((row) => row.id));
        expect(stored).toHaveLength(1);
        expect(stored[0]).toMatchObject({ title, description });
        expect(stored[0].steps).toEqual(expect.arrayContaining([expect.objectContaining({ action: "Open", expectedResult: "Visible" })]));
        const after = (await db.query("SELECT * FROM testcases WHERE project_id = $1 AND deleted_at IS NULL ORDER BY id", [projectId])).rows;
        expect(after).toHaveLength(before.length + 1);
        expect(after.filter((row) => row.id !== stored[0].id)).toEqual(before);
        await importDialog.getByRole("button", { name: "Done", exact: true }).click();
        await expect(importDialog).toHaveCount(0);
        await page.reload();
        await expect(page.getByRole("button", { name: title, exact: true })).toBeVisible();
        if (format === "xls") await testInfo.attach("patched-legacy-xls-import", { body: await page.screenshot(), contentType: "image/png" });
      });
    }
    if (failures.length) throw new AggregateError(failures, `${failures.length} content-security journeys failed; see the failed steps and captures`);
  } finally {
    if (documentId) await request.delete(`${base}/knowledge-base/documents/${documentId}`, { failOnStatusCode: false });
    if (bugId) await request.delete(`${api}/api/bugs/${bugId}`, { failOnStatusCode: false });
    for (const id of importedIds) await request.delete(`${base}/testcases/${id}`, { failOnStatusCode: false });
    await db.end();
  }
}
