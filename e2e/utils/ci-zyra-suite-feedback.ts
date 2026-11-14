import { expect, request as newRequest, test, type Page, type TestInfo } from "@playwright/test";
import { Client } from "pg";
import { startFakeAiServer } from "./fake-ai-server";
import { verifyZyraSuiteTurn, withSuiteInsertFailure, type SuiteFeedbackState } from "./zyra-suite-feedback";

/** Only the caller's loopback/disposable tesbo_ci installation; never a live provider or shared DB. */
export async function verifyCiZyraSuiteFeedback(page: Page, api: string, web: string, projectId: string, otherProjectId: string, ownerId: string, testInfo: TestInfo) {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  const ai = await startFakeAiServer();
  const anonymous = await newRequest.newContext({ storageState: { cookies: [], origins: [] } });
  const base = `${api}/api/projects/${projectId}`;
  const failures: unknown[] = [];
  let keyId = "";
  await db.connect();
  const state = async () => (await db.query(`SELECT
    COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id) FROM suites s WHERE s.project_id=$1),'[]'::jsonb) AS suites,
    COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) FROM testcases t WHERE t.project_id=$1),'[]'::jsonb) AS cases,
    COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM ai_generation_requests r WHERE r.project_id=$1),'[]'::jsonb) AS reviews,
    COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.created_at,a.id) FROM audit_logs a
      WHERE a.project_id=$1 AND a.action='zyra_suite_created'),'[]'::jsonb) AS audit`, [projectId])).rows[0] as SuiteFeedbackState;
  try {
    const key = await page.request.post(`${api}/api/workspace/ai-keys`, { data: {
      name: `CI suite feedback ${projectId}`, provider: "openai", apiKey: "sk-ci-suite-feedback-not-a-real-key",
      baseUrl: ai.baseUrl.replace("host.docker.internal", "127.0.0.1"),
    } });
    expect(key.status(), await key.text()).toBe(201); keyId = (await key.json()).id;
    const allocated = await page.request.post(`${api}/api/workspace/ai-keys/allocations`, { data: { projectId, workspaceAiKeyId: keyId } });
    expect(allocated.ok(), await allocated.text()).toBeTruthy();

    for (const language of ["en", "ru"] as const) {
      for (const mode of ["failed", "partial", "created", "reused"] as const) {
        await test.step(`${language}-${mode}`, async () => {
          const label = `${language}-${mode}`;
          const faultName = `CI ${label} failed suite`;
          const names = mode === "failed" ? [faultName] : mode === "partial" ? [`CI ${label} kept suite`, faultName] : [`CI ${label} suite`];
          try {
            if (mode === "reused") {
              const seeded = await page.request.post(`${base}/suites`, { data: { name: names[0] } });
              expect(seeded.status(), await seeded.text()).toBe(201);
            }
            const run = () => verifyZyraSuiteTurn({
              request: page.request, ai, base, language, mode, names, state, ownerId,
              afterReply: async (sessionId, reply, warning) => {
                const read = await page.request.get(`${base}/agents/zyra/chat/sessions/${sessionId}`);
                expect(read.ok(), await read.text()).toBeTruthy();
                const session = await read.json();
                await testInfo.attach(`suite-${label}-stored-trace`, {
                  body: JSON.stringify({ language: session.language, messages: session.messages.map((message: Record<string, unknown>) => ({
                    role: message.role, content: message.content, trace: message.trace, activity: message.activity,
                  })) }, null, 2), contentType: "application/json",
                });
                const noCaseChanges = language === "en" ? "no test case changes" : "нет изменений тест-кейсов";
                const trace = page.locator("[data-zyra-trace]");
                const verifyTrace = async () => {
                  await expect(trace).toBeVisible();
                  // The settled trace and message render together. Snapshot known-final values so
                  // expected red mismatches do not spend a timeout per assertion or skip controls.
                  expect.soft(await trace.getAttribute("data-zyra-trace")).toBe(warning ? "completed_with_errors" : "completed");
                  const summary = await trace.locator("summary").innerText();
                  expect.soft(summary).toContain(warning ? "[DONE · WITH ERRORS]" : "[DONE]");
                  expect.soft(summary).toContain(noCaseChanges);
                };
                await page.goto(`${web}/projects/${projectId}/agents/zyra`);
                await expect(page.getByText(reply, { exact: true })).toBeVisible();
                if (warning) await expect.soft(page.getByText(warning, { exact: true })).toBeVisible();
                await verifyTrace();
                await page.reload();
                await expect(page.getByText(reply, { exact: true })).toBeVisible();
                await verifyTrace();
                await testInfo.attach(`suite-${label}`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
                await trace.locator("summary").click();
                expect.soft(await trace.locator('[data-zyra-step="staging"]').getAttribute("data-zyra-step-status")).toBe(warning ? "failed" : "ok");
                expect.soft(await trace.locator('[data-zyra-step="finalizing"]').innerText()).toContain(noCaseChanges);
                await testInfo.attach(`suite-${label}-expanded`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
              },
            });
            if (mode === "failed" || mode === "partial") {
              await withSuiteInsertFailure(projectId, faultName, async (sql) => { await db.query(sql); }, run);
            } else await run();
          } catch (error) {
            failures.push(error);
            await testInfo.attach(`suite-${label}-failure`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
          }
        });
      }
    }

    await test.step("capability and access refusals do not reach a suite writer", async () => {
      const disabled = await page.request.patch(`${base}/agents/zyra/settings`, { data: { capabilities: { suiteOperations: false } } });
      expect(disabled.ok(), await disabled.text()).toBeTruthy();
      const session = await page.request.post(`${base}/agents/zyra/chat/sessions`, { data: { title: "CI suite refusals" } });
      expect(session.status(), await session.text()).toBe(201);
      const sessionId = (await session.json()).id;
      try {
        const before = await state(), calls = ai.requests.length;
        for (const [client, url, status] of [
          [anonymous, `${base}/agents/zyra/chat/sessions/${sessionId}/messages`, 400],
          [page.request, `${api}/api/projects/${otherProjectId}/agents/zyra/chat/sessions/${sessionId}/messages`, 404],
        ] as const) {
          const denied = await client.post(url, { data: { message: "Create a suite" } });
          expect(denied.status(), await denied.text()).toBe(status);
        }
        expect(ai.requests.length).toBe(calls);
        expect(await state()).toEqual(before);
        ai.queueReply({ reply: "Created the suite.", action: "create_suite", actionType: "suite", operations: [{ type: "create_suite", suiteName: "CI disabled suite" }], testcases: [] });
        const sent = await page.request.post(`${base}/agents/zyra/chat/sessions/${sessionId}/messages`, { data: { message: "Create a suite" } });
        expect(sent.ok(), await sent.text()).toBeTruthy();
        expect((await sent.json()).message.content).toContain("Suite operations (create, move/assign) is currently disabled");
        expect(ai.requests.length).toBe(calls + 1);
        expect(await state()).toEqual(before);
      } finally {
        const deleted = await page.request.delete(`${base}/agents/zyra/chat/sessions/${sessionId}`);
        expect(deleted.ok(), await deleted.text()).toBeTruthy();
        const restored = await page.request.patch(`${base}/agents/zyra/settings`, { data: { capabilities: { suiteOperations: true } } });
        expect(restored.ok(), await restored.text()).toBeTruthy();
      }
    });
    const namespace = `e2e_zyra_suite_${projectId.replace(/-/g, "")}_%`;
    expect((await db.query("SELECT proname FROM pg_proc WHERE proname LIKE $1", [namespace])).rows).toEqual([]);
    expect((await db.query("SELECT tgname FROM pg_trigger WHERE tgname LIKE $1", [namespace])).rows).toEqual([]);
  } finally {
    try {
      if (keyId) {
        await db.query("DELETE FROM project_ai_key_allocations WHERE project_id=$1 AND workspace_ai_key_id=$2", [projectId, keyId]);
        const deleted = await page.request.delete(`${api}/api/workspace/ai-keys/${keyId}`);
        expect(deleted.ok(), await deleted.text()).toBeTruthy();
      }
    } finally {
      await anonymous.dispose(); await ai.close(); await db.end();
    }
  }
  if (failures.length) throw new AggregateError(failures, `${failures.length} suite feedback scenario(s) failed`);
}
