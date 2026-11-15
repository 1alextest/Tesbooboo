import { expect, request as newRequest, test, type Page, type TestInfo } from "@playwright/test";
import { Client } from "pg";
import { startFakeAiServer } from "./fake-ai-server";
import { answerRepositorySnapshotSql } from "./zyra-answer-feedback";
import { SUITE_OPERATION_ERROR } from "./zyra-suite-feedback";
import { MOVE_MODES, seedMoveRepository, settleMoveFixtures, verifyZyraMoveTurn, withMoveUpdateFailure, type MoveFixture, type MoveRepositoryState } from "./zyra-move-feedback";

/** Caller enforces loopback URLs and disposable tesbo_ci; never a shared/live-data inventory. */
export async function verifyCiZyraMoveFeedback(page: Page, api: string, web: string, projectId: string, otherProjectId: string, ownerId: string, testInfo: TestInfo) {
  const db = new Client({ connectionString: process.env.DATABASE_URL }), ai = await startFakeAiServer();
  const anonymous = await newRequest.newContext({ storageState: { cookies: [], origins: [] } });
  const base = `${api}/api/projects/${projectId}`, failures: unknown[] = [], fixtures = new Map<string, MoveFixture>();
  let keyId = "";
  await db.connect();
  const state = async () => (await db.query(answerRepositorySnapshotSql, [projectId])).rows[0] as MoveRepositoryState;
  try {
    for (const language of ["en", "ru"] as const) for (const mode of MOVE_MODES) {
      const label = `${language}-${mode}`;
      fixtures.set(label, await seedMoveRepository(page.request, base, label));
    }
    await settleMoveFixtures([...fixtures.values()], state);
    const key = await page.request.post(`${api}/api/workspace/ai-keys`, { data: {
      name: `CI move feedback ${projectId}`, provider: "openai", apiKey: "sk-ci-move-feedback-not-a-real-key",
      baseUrl: ai.baseUrl.replace("host.docker.internal", "127.0.0.1"),
    } });
    expect(key.status(), await key.text()).toBe(201); keyId = (await key.json()).id;
    const allocated = await page.request.post(`${api}/api/workspace/ai-keys/allocations`, { data: { projectId, workspaceAiKeyId: keyId } });
    expect(allocated.ok(), await allocated.text()).toBeTruthy();
    for (const language of ["en", "ru"] as const) for (const mode of MOVE_MODES) {
      const label = `${language}-${mode}`, fixture = fixtures.get(label)!;
      await test.step(label, async () => {
        try {
          const run = () => verifyZyraMoveTurn({ request: page.request, ai, base, ownerId, language, mode, fixture, state,
            afterReply: async (evidence) => {
              await testInfo.attach(`move-${label}-readback`, { body: JSON.stringify(evidence, null, 2), contentType: "application/json" });
              const trace = page.locator("[data-zyra-trace]"), failed = mode === "failed" || mode === "partial";
              const verify = async () => {
                await expect(page.getByText(evidence.reply, { exact: true })).toBeVisible();
                await expect(trace).toBeVisible();
                expect.soft(await page.getByText(SUITE_OPERATION_ERROR[language], { exact: true }).count()).toBe(failed ? 1 : 0);
                expect.soft(await trace.getAttribute("data-zyra-trace")).toBe(failed ? "completed_with_errors" : "completed");
              };
              await page.goto(`${web}/projects/${projectId}/agents/zyra`); await verify();
              await page.reload(); await verify();
              await testInfo.attach(`move-${label}`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
              await trace.locator("summary").click();
              expect.soft(await trace.locator('[data-zyra-step="staging"]').getAttribute("data-zyra-step-status")).toBe(failed ? "failed" : "ok");
              await testInfo.attach(`move-${label}-expanded`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
            },
          });
          if (mode === "failed" || mode === "partial") await withMoveUpdateFailure(projectId, fixture.secondId, async (sql) => { await db.query(sql); }, run);
          else await run();
        } catch (error) {
          failures.push(error);
          await testInfo.attach(`move-${label}-failure`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
        }
      });
    }
    await test.step("suite capability and access refusals do not write or retry moves", async () => {
      const disabled = await page.request.patch(`${base}/agents/zyra/settings`, { data: { capabilities: { suiteOperations: false } } });
      expect(disabled.ok(), await disabled.text()).toBeTruthy();
      const session = await page.request.post(`${base}/agents/zyra/chat/sessions`, { data: { title: "CI move refusals" } });
      expect(session.status(), await session.text()).toBe(201); const sessionId = (await session.json()).id;
      try {
        const before = await state(), calls = ai.requests.length, fixture = fixtures.get("en-failed")!;
        for (const [client, url, status] of [
          [anonymous, `${base}/agents/zyra/chat/sessions/${sessionId}/messages`, 400],
          [page.request, `${api}/api/projects/${otherProjectId}/agents/zyra/chat/sessions/${sessionId}/messages`, 404],
        ] as const) {
          const refused = await client.post(url, { data: { message: "Move the test cases" } });
          expect(refused.status(), await refused.text()).toBe(status);
        }
        expect(ai.requests.length).toBe(calls); expect(await state()).toEqual(before);
        ai.queueReply({ reply: "Moved the test cases.", action: "move_to_suite", actionType: "suite", operations: [{ type: "move_to_suite", testcaseIds: [fixture.firstId], suiteId: fixture.destinationId }], testcases: [] });
        const sent = await page.request.post(`${base}/agents/zyra/chat/sessions/${sessionId}/messages`, { data: { message: "Move the test cases" } });
        expect(sent.ok(), await sent.text()).toBeTruthy();
        expect((await sent.json()).message.content).toContain("Suite operations (create, move/assign) is currently disabled");
        expect(ai.requests.length).toBe(calls + 1); expect(await state()).toEqual(before);
      } finally {
        const deleted = await page.request.delete(`${base}/agents/zyra/chat/sessions/${sessionId}`);
        expect(deleted.ok(), await deleted.text()).toBeTruthy();
        const restored = await page.request.patch(`${base}/agents/zyra/settings`, { data: { capabilities: { suiteOperations: true } } });
        expect(restored.ok(), await restored.text()).toBeTruthy();
      }
    });
    const namespace = `e2e_zyra_move_${projectId.replace(/-/g, "")}_%`;
    expect((await db.query("SELECT proname FROM pg_proc WHERE proname LIKE $1", [namespace])).rows).toEqual([]);
    expect((await db.query("SELECT tgname FROM pg_trigger WHERE tgname LIKE $1", [namespace])).rows).toEqual([]);
  } finally {
    try {
      if (keyId) {
        await db.query("DELETE FROM project_ai_key_allocations WHERE project_id=$1 AND workspace_ai_key_id=$2", [projectId, keyId]);
        const deleted = await page.request.delete(`${api}/api/workspace/ai-keys/${keyId}`);
        expect(deleted.ok(), await deleted.text()).toBeTruthy();
      }
    } finally { await anonymous.dispose(); await ai.close(); await db.end(); }
  }
  if (failures.length) throw new AggregateError(failures, `${failures.length} move feedback scenario(s) failed`);
}
