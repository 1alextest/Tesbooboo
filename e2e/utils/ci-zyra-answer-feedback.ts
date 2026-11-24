import { expect, request as newRequest, test, type Page, type TestInfo } from "@playwright/test";
import { Client } from "pg";
import { startFakeAiServer } from "./fake-ai-server";
import { ANSWER_MODES, answerRepositorySnapshotSql, seedAnswerRepository, verifyZyraAnswerTurn, type AnswerRepositoryState } from "./zyra-answer-feedback";

/** Called only after the outer smoke's loopback + disposable tesbo_ci checks. */
export async function verifyCiZyraAnswerFeedback(page: Page, api: string, web: string, projectId: string, otherProjectId: string, testInfo: TestInfo) {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  const ai = await startFakeAiServer();
  const anonymous = await newRequest.newContext({ storageState: { cookies: [], origins: [] } });
  const base = `${api}/api/projects/${projectId}`, failures: unknown[] = [];
  let keyId = "";
  await db.connect();
  const state = async () => (await db.query(answerRepositorySnapshotSql, [projectId])).rows[0] as AnswerRepositoryState;
  try {
    await seedAnswerRepository(page.request, base, state);
    const key = await page.request.post(`${api}/api/workspace/ai-keys`, { data: {
      name: `CI answer feedback ${projectId}`, provider: "openai", apiKey: "sk-ci-answer-feedback-not-a-real-key",
      baseUrl: ai.baseUrl.replace("host.docker.internal", "127.0.0.1"),
    } });
    expect(key.status(), await key.text()).toBe(201); keyId = (await key.json()).id;
    const allocated = await page.request.post(`${api}/api/workspace/ai-keys/allocations`, { data: { projectId, workspaceAiKeyId: keyId } });
    expect(allocated.ok(), await allocated.text()).toBeTruthy();
    for (const language of ["en", "ru"] as const) for (const mode of ANSWER_MODES) {
      const label = `${language}-${mode}`;
      await test.step(label, async () => {
        try {
          await verifyZyraAnswerTurn({ request: page.request, ai, base, language, mode, state,
            afterReply: async (evidence) => {
              await testInfo.attach(`answer-${label}-readback`, { body: JSON.stringify(evidence, null, 2), contentType: "application/json" });
              const banner = page.getByText(language === "en" ? "Sorry! Nothing was saved." : "Извините! Ничего не сохранено.", { exact: true });
              const verify = async () => {
                await expect(page.getByText(evidence.reply, { exact: true })).toBeVisible();
                expect.soft(await banner.count()).toBe(evidence.warning ? 1 : 0);
              };
              await page.goto(`${web}/projects/${projectId}/agents/zyra`);
              await verify(); await page.reload(); await verify();
              await testInfo.attach(`answer-${label}`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
            },
          });
        } catch (error) {
          failures.push(error);
          await testInfo.attach(`answer-${label}-failure`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
        }
      });
    }
    await test.step("answer access refusals do not call the provider or change repository state", async () => {
      const session = await page.request.post(`${base}/agents/zyra/chat/sessions`, { data: { title: "CI answer refusals" } });
      expect(session.status(), await session.text()).toBe(201);
      const sessionId = (await session.json()).id;
      try {
        const before = await state(), calls = ai.requests.length;
        for (const [client, url, status] of [
          [anonymous, `${base}/agents/zyra/chat/sessions/${sessionId}/messages`, 400],
          [page.request, `${api}/api/projects/${otherProjectId}/agents/zyra/chat/sessions/${sessionId}/messages`, 404],
        ] as const) {
          const denied = await client.post(url, { data: { message: "Where can I find saved test cases?" }, failOnStatusCode: false });
          expect(denied.status(), await denied.text()).toBe(status);
        }
        expect(ai.requests.length).toBe(calls); expect(await state()).toEqual(before);
      } finally {
        const deleted = await page.request.delete(`${base}/agents/zyra/chat/sessions/${sessionId}`, { failOnStatusCode: false });
        expect(deleted.ok(), await deleted.text()).toBeTruthy();
      }
    });
  } finally {
    try {
      if (keyId) {
        await db.query("DELETE FROM project_ai_key_allocations WHERE project_id=$1 AND workspace_ai_key_id=$2", [projectId, keyId]);
        const deleted = await page.request.delete(`${api}/api/workspace/ai-keys/${keyId}`, { failOnStatusCode: false });
        expect(deleted.ok(), await deleted.text()).toBeTruthy();
      }
    } finally { await anonymous.dispose(); await ai.close(); await db.end(); }
  }
  if (failures.length) throw new AggregateError(failures, `${failures.length} answer feedback scenario(s) failed`);
}
