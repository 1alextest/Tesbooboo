import { expect, request as newRequest, test, type Page, type TestInfo } from "@playwright/test";
import { Client } from "pg";
import { startFakeAiServer } from "./fake-ai-server";
import { answerRepositorySnapshotSql } from "./zyra-answer-feedback";
import { seedMoveRepository, settleMoveFixtures, type MoveFixture, type MoveRepositoryState } from "./zyra-move-feedback";
import { SINGLE_MOVE_SELECTORS, verifyZyraSingleMove } from "./zyra-single-move";

/** Caller checks loopback/disposable tesbo_ci; no shared/live target is accepted. */
export async function verifyCiZyraSingleMove(page: Page, api: string, web: string, projectId: string, otherProjectId: string, ownerId: string, testInfo: TestInfo) {
  const db = new Client({ connectionString: process.env.DATABASE_URL }), ai = await startFakeAiServer();
  const anonymous = await newRequest.newContext({ storageState: { cookies: [], origins: [] } });
  const base = `${api}/api/projects/${projectId}`, fixtures = new Map<string, MoveFixture>(), failures: unknown[] = [];
  let keyId = "";
  await db.connect();
  const state = async () => (await db.query(answerRepositorySnapshotSql, [projectId])).rows[0] as MoveRepositoryState;
  const foreignState = async () => (await db.query(answerRepositorySnapshotSql, [otherProjectId])).rows[0] as MoveRepositoryState;
  try {
    for (const language of ["en", "ru"] as const) for (const selector of SINGLE_MOVE_SELECTORS) {
      const label = `${language}-${selector}`; fixtures.set(label, await seedMoveRepository(page.request, base, label));
    }
    const foreign = await seedMoveRepository(page.request, `${api}/api/projects/${otherProjectId}`, "foreign single-move control");
    await settleMoveFixtures([...fixtures.values()], state); await settleMoveFixtures([foreign], foreignState);
    const foreignBefore = await foreignState();
    const key = await page.request.post(`${api}/api/workspace/ai-keys`, { data: { name: `CI single move ${projectId}`, provider: "openai",
      apiKey: "sk-ci-single-move-not-a-real-key", baseUrl: ai.baseUrl.replace("host.docker.internal", "127.0.0.1") } });
    expect(key.status(), await key.text()).toBe(201); keyId = (await key.json()).id;
    const allocation = await page.request.post(`${api}/api/workspace/ai-keys/allocations`, { data: { projectId, workspaceAiKeyId: keyId } });
    expect(allocation.ok(), await allocation.text()).toBeTruthy();
    for (const language of ["en", "ru"] as const) for (const selector of SINGLE_MOVE_SELECTORS) {
      const label = `${language}-${selector}`;
      await test.step(label, async () => {
        try {
          await verifyZyraSingleMove({ request: page.request, ai, base, ownerId, language, selector, fixture: fixtures.get(label)!, state,
            afterReply: async (evidence) => {
              await testInfo.attach(`single-${label}-readback`, { body: JSON.stringify(evidence, null, 2), contentType: "application/json" });
              const verify = async () => {
                await expect(page.getByText(evidence.reply, { exact: true })).toBeVisible();
                expect.soft(await page.getByText(evidence.externalId, { exact: true }).count()).toBe(1);
                expect.soft(await page.getByText(/⚠️ Nothing was saved\.|⚠️ Ничего не сохранено\./).count()).toBe(0);
              };
              await page.goto(`${web}/projects/${projectId}/agents/zyra`); await verify(); await page.reload(); await verify();
              await testInfo.attach(`single-${label}`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
            },
          });
        } catch (error) {
          failures.push(error);
          await testInfo.attach(`single-${label}-failure`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
        }
      });
    }
    for (const selector of ["foreign-id", "missing-id", "invalid-id"] as const) {
      await test.step(`negative-${selector}`, async () => {
        await verifyZyraSingleMove({ request: page.request, ai, base, ownerId, language: "en", selector, fixture: fixtures.get("en-testcaseId")!, foreignId: foreign.firstId, state,
          afterReply: async (evidence) => { await testInfo.attach(`single-negative-${selector}-readback`, { body: JSON.stringify(evidence, null, 2), contentType: "application/json" }); } });
        expect(await foreignState(), "no scalar selector may escape the current project").toEqual(foreignBefore);
      });
    }
    await test.step("capability and access refusals preserve both projects", async () => {
      const disabled = await page.request.patch(`${base}/agents/zyra/settings`, { data: { capabilities: { suiteOperations: false } } });
      expect(disabled.ok(), await disabled.text()).toBeTruthy();
      const created = await page.request.post(`${base}/agents/zyra/chat/sessions`, { data: { title: "CI single move refusals" } });
      expect(created.status(), await created.text()).toBe(201); const sessionId = (await created.json()).id;
      try {
        const before = await state(), calls = ai.requests.length, fixture = fixtures.get("en-externalId")!;
        for (const [client, url, status] of [
          [anonymous, `${base}/agents/zyra/chat/sessions/${sessionId}/messages`, 400],
          [page.request, `${api}/api/projects/${otherProjectId}/agents/zyra/chat/sessions/${sessionId}/messages`, 404],
        ] as const) {
          const denied = await client.post(url, { data: { message: "Move the requested test case" } }); expect(denied.status(), await denied.text()).toBe(status);
        }
        expect(ai.requests.length).toBe(calls);
        // This case is still in its source suite: the disabled scalar must not move it.
        ai.queueReply({ reply: "Moved the requested test case.", action: "move_to_suite", actionType: "suite",
          operations: [{ type: "move_to_suite", suiteId: fixture.destinationId, testcaseId: fixture.secondId }], testcases: [] });
        const sent = await page.request.post(`${base}/agents/zyra/chat/sessions/${sessionId}/messages`, { data: { message: "Move the requested test case" } });
        expect(sent.ok(), await sent.text()).toBeTruthy();
        expect((await sent.json()).message.content).toContain("Suite operations (create, move/assign) is currently disabled");
        expect(ai.requests.length).toBe(calls + 1); expect(await state()).toEqual(before); expect(await foreignState()).toEqual(foreignBefore);
      } finally {
        const deleted = await page.request.delete(`${base}/agents/zyra/chat/sessions/${sessionId}`); expect(deleted.ok(), await deleted.text()).toBeTruthy();
        const restored = await page.request.patch(`${base}/agents/zyra/settings`, { data: { capabilities: { suiteOperations: true } } }); expect(restored.ok(), await restored.text()).toBeTruthy();
      }
    });
  } finally {
    try {
      if (keyId) {
        await db.query("DELETE FROM project_ai_key_allocations WHERE project_id=$1 AND workspace_ai_key_id=$2", [projectId, keyId]);
        const deleted = await page.request.delete(`${api}/api/workspace/ai-keys/${keyId}`); expect(deleted.ok(), await deleted.text()).toBeTruthy();
      }
    } finally { await anonymous.dispose(); await ai.close(); await db.end(); }
  }
  if (failures.length) throw new AggregateError(failures, `${failures.length} single-move scenario(s) failed`);
}
