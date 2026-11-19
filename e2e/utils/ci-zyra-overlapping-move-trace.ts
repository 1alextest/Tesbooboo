import { expect, request as newRequest, test, type Page, type TestInfo } from "@playwright/test";
import { Client } from "pg";
import { verifyMoveReviewPreview } from "./zyra-reviewed-moves";
import { answerRepositorySnapshotSql } from "./zyra-answer-feedback";
import { startFakeAiServer } from "./fake-ai-server";
import { seedMoveRepository, settleMoveFixtures, type MoveRepositoryState } from "./zyra-move-feedback";
import { OVERLAPPING_MOVE_MODES, seedOverlappingMoveRepository, verifyZyraOverlappingMoveTrace, type OverlappingMoveFixture } from "./zyra-overlapping-move-trace";

/** Only the caller's explicit loopback/disposable tesbo_ci target; no shared/live inventory. */
export async function verifyCiZyraOverlappingMoveTrace(page: Page, api: string, web: string, projectId: string, otherProjectId: string, ownerId: string, testInfo: TestInfo) {
  const db = new Client({ connectionString: process.env.DATABASE_URL }), ai = await startFakeAiServer();
  const anonymous = await newRequest.newContext({ storageState: { cookies: [], origins: [] } });
  const base = `${api}/api/projects/${projectId}`, fixtures = new Map<string, OverlappingMoveFixture>(), failures: unknown[] = [];
  let keyId = ""; await db.connect();
  const state = async () => (await db.query(answerRepositorySnapshotSql, [projectId])).rows[0] as MoveRepositoryState;
  const foreignState = async () => (await db.query(answerRepositorySnapshotSql, [otherProjectId])).rows[0] as MoveRepositoryState;
  try {
    for (const language of ["en", "ru"] as const) for (const mode of OVERLAPPING_MOVE_MODES) {
      const label = `${language}-${mode}`; fixtures.set(label, await seedOverlappingMoveRepository(page.request, base, label, mode));
    }
    const foreign = await seedMoveRepository(page.request, `${api}/api/projects/${otherProjectId}`, "foreign overlapping-move control");
    await settleMoveFixtures([...fixtures.values()].flatMap(({ first, last }) => [first, last]
      .flatMap((group) => group.allIds.map((id) => ({ ...group, firstId: id, secondId: id })))), state);
    await settleMoveFixtures([foreign], foreignState); const foreignBefore = await foreignState();
    const key = await page.request.post(`${api}/api/workspace/ai-keys`, { data: { name: `CI overlapping move trace ${projectId}`, provider: "openai",
      apiKey: "sk-ci-overlapping-move-trace-not-a-real-key", baseUrl: ai.baseUrl.replace("host.docker.internal", "127.0.0.1") } });
    expect(key.status(), await key.text()).toBe(201); keyId = (await key.json()).id;
    const allocated = await page.request.post(`${api}/api/workspace/ai-keys/allocations`, { data: { projectId, workspaceAiKeyId: keyId } });
    expect(allocated.ok(), await allocated.text()).toBeTruthy();
    for (const language of ["en", "ru"] as const) for (const mode of OVERLAPPING_MOVE_MODES) {
      const label = `${language}-${mode}`;
      await test.step(label, async () => {
        try {
          await verifyZyraOverlappingMoveTrace({ request: page.request, ai, base, ownerId, language, mode, fixture: fixtures.get(label)!, state,
            beforeApply: async (preview) => verifyMoveReviewPreview(page, web, projectId, preview, testInfo, `overlapping-move-${label}`),
            afterReply: async (evidence) => {
              const foreignAfter = await foreignState(); expect(foreignAfter).toEqual(foreignBefore);
              await testInfo.attach(`overlapping-move-${label}-readback`, { body: JSON.stringify({ ...evidence, foreignBefore, foreignAfter }, null, 2), contentType: "application/json" });
            },
          });
        } catch (error) {
          failures.push(error); await testInfo.attach(`overlapping-move-${label}-failure`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
        }
      });
    }
    await test.step("capability and access refusals preserve both complete snapshots", async () => {
      const disabled = await page.request.patch(`${base}/agents/zyra/settings`, { data: { capabilities: { suiteOperations: false } } });
      expect(disabled.ok(), await disabled.text()).toBeTruthy();
      const created = await page.request.post(`${base}/agents/zyra/chat/sessions`, { data: { title: "CI overlapping move refusals" } });
      expect(created.status(), await created.text()).toBe(201); const sessionId = (await created.json()).id;
      try {
        const before = await state(), calls = ai.requests.length, fixture = fixtures.get("en-overlap")!;
        for (const [client, url, status] of [
          [anonymous, `${base}/agents/zyra/chat/sessions/${sessionId}/messages`, 400],
          [page.request, `${api}/api/projects/${otherProjectId}/agents/zyra/chat/sessions/${sessionId}/messages`, 404],
        ] as const) {
          const denied = await client.post(url, { data: { message: "Apply both requested suite moves" } }); expect(denied.status(), await denied.text()).toBe(status);
        }
        expect(ai.requests.length).toBe(calls); expect(await state()).toEqual(before); expect(await foreignState()).toEqual(foreignBefore);
        ai.queueReply({ reply: "Applied the requested suite moves.", action: "move_to_suite", actionType: "suite", testcases: [],
          operations: [fixture.first, fixture.last].map((group) => ({ type: "move_to_suite", suiteId: group.destinationId, testcaseIds: group.targetIds })) });
        const sent = await page.request.post(`${base}/agents/zyra/chat/sessions/${sessionId}/messages`, { data: { message: "Apply both requested suite moves" } });
        expect(sent.ok(), await sent.text()).toBeTruthy(); expect((await sent.json()).message.content).toContain("Suite operations (create, move/assign) is currently disabled");
        expect(ai.requests.length).toBe(calls + 1); expect(await state()).toEqual(before); expect(await foreignState()).toEqual(foreignBefore);
      } finally {
        const deleted = await page.request.delete(`${base}/agents/zyra/chat/sessions/${sessionId}`, { failOnStatusCode: false }); expect(deleted.ok(), await deleted.text()).toBeTruthy();
        const restored = await page.request.patch(`${base}/agents/zyra/settings`, { data: { capabilities: { suiteOperations: true } } }); expect(restored.ok(), await restored.text()).toBeTruthy();
      }
    });
  } finally {
    try {
      if (keyId) {
        await db.query("DELETE FROM project_ai_key_allocations WHERE project_id=$1 AND workspace_ai_key_id=$2", [projectId, keyId]);
        const deleted = await page.request.delete(`${api}/api/workspace/ai-keys/${keyId}`, { failOnStatusCode: false }); expect(deleted.ok(), await deleted.text()).toBeTruthy();
      }
    } finally { await anonymous.dispose(); await ai.close(); await db.end(); }
  }
  if (failures.length) throw new AggregateError(failures, `${failures.length} overlapping-move scenario(s) failed`);
}
