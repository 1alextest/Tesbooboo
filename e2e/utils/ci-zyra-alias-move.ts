import { expect, request as newRequest, test, type Page, type TestInfo } from "@playwright/test";
import { Client } from "pg";
import { verifyMoveReviewPreview } from "./zyra-reviewed-moves";
import { answerRepositorySnapshotSql } from "./zyra-answer-feedback";
import { startFakeAiServer } from "./fake-ai-server";
import { seedMoveRepository, settleMoveFixtures, type MoveFixture, type MoveRepositoryState } from "./zyra-move-feedback";
import { ALIAS_MOVE_MODES, verifyZyraAliasMove, type AliasMoveMode } from "./zyra-alias-move";

/** Only the caller's explicit loopback/disposable tesbo_ci target. */
export async function verifyCiZyraAliasMove(page: Page, api: string, web: string, projectId: string, otherProjectId: string, ownerId: string, testInfo: TestInfo) {
  const db = new Client({ connectionString: process.env.DATABASE_URL }), ai = await startFakeAiServer();
  const anonymous = await newRequest.newContext({ storageState: { cookies: [], origins: [] } });
  const base = `${api}/api/projects/${projectId}`, fixtures = new Map<string, MoveFixture>(), failures: unknown[] = [];
  const modes: AliasMoveMode[] = [...ALIAS_MOVE_MODES, "alias-plus-foreign"];
  let keyId = ""; await db.connect();
  const state = async () => (await db.query(answerRepositorySnapshotSql, [projectId])).rows[0] as MoveRepositoryState;
  const foreignState = async () => (await db.query(answerRepositorySnapshotSql, [otherProjectId])).rows[0] as MoveRepositoryState;
  try {
    for (const language of ["en", "ru"] as const) for (const mode of modes) {
      const label = `${language}-${mode}`; fixtures.set(label, await seedMoveRepository(page.request, base, label));
    }
    const foreign = await seedMoveRepository(page.request, `${api}/api/projects/${otherProjectId}`, "foreign alias control");
    await settleMoveFixtures([...fixtures.values()], state); await settleMoveFixtures([foreign], foreignState);
    const foreignBefore = await foreignState();
    const key = await page.request.post(`${api}/api/workspace/ai-keys`, { data: { name: `CI alias move ${projectId}`, provider: "openai",
      apiKey: "sk-ci-alias-not-a-real-key", baseUrl: ai.baseUrl.replace("host.docker.internal", "127.0.0.1") } });
    expect(key.status(), await key.text()).toBe(201); keyId = (await key.json()).id;
    const allocated = await page.request.post(`${api}/api/workspace/ai-keys/allocations`, { data: { projectId, workspaceAiKeyId: keyId } });
    expect(allocated.ok(), await allocated.text()).toBeTruthy();
    for (const language of ["en", "ru"] as const) for (const mode of modes) {
      const label = `${language}-${mode}`;
      await test.step(label, async () => {
        try {
          await verifyZyraAliasMove({ request: page.request, ai, base, ownerId, language, mode, fixture: fixtures.get(label)!, foreignId: foreign.firstId, state,
            beforeApply: async (preview) => {
              const missing = mode === "alias-plus-missing" || mode === "alias-plus-foreign";
              const warning = missing ? language === "en" ? "⚠️ 1 named test case(s) could not be moved." : "⚠️ Не удалось переместить названные тест-кейсы: 1." : undefined;
              await verifyMoveReviewPreview(page, web, projectId, preview, testInfo, `alias-${label}`, warning);
            },
            afterReply: async (evidence) => {
              await testInfo.attach(`alias-${label}-readback`, { body: JSON.stringify(evidence, null, 2), contentType: "application/json" });
            },
          });
          expect(await foreignState(), "alias accounting must never read targets into another project's write set").toEqual(foreignBefore);
        } catch (error) {
          failures.push(error); await testInfo.attach(`alias-${label}-failure`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
        }
      });
    }
    await test.step("capability and access refusals keep both project snapshots", async () => {
      const disabled = await page.request.patch(`${base}/agents/zyra/settings`, { data: { capabilities: { suiteOperations: false } } });
      expect(disabled.ok(), await disabled.text()).toBeTruthy();
      const created = await page.request.post(`${base}/agents/zyra/chat/sessions`, { data: { title: "CI alias refusals" } });
      expect(created.status(), await created.text()).toBe(201); const sessionId = (await created.json()).id;
      try {
        const before = await state(), calls = ai.requests.length, fixture = fixtures.get("en-alias-scalars")!;
        const untouched = before.cases.find((row) => row.id === fixture.secondId)!;
        for (const [client, url, status] of [
          [anonymous, `${base}/agents/zyra/chat/sessions/${sessionId}/messages`, 400],
          [page.request, `${api}/api/projects/${otherProjectId}/agents/zyra/chat/sessions/${sessionId}/messages`, 404],
        ] as const) {
          const denied = await client.post(url, { data: { message: "Move the requested case" } }); expect(denied.status(), await denied.text()).toBe(status);
        }
        expect(ai.requests.length).toBe(calls);
        ai.queueReply({ reply: "Moved the requested case.", action: "move_to_suite", actionType: "suite", testcases: [],
          operations: [{ type: "move_to_suite", suiteId: fixture.destinationId, testcaseId: fixture.secondId, externalId: untouched.external_id }] });
        const sent = await page.request.post(`${base}/agents/zyra/chat/sessions/${sessionId}/messages`, { data: { message: "Move the requested case" } });
        expect(sent.ok(), await sent.text()).toBeTruthy(); expect((await sent.json()).message.content).toContain("Suite operations (create, move/assign) is currently disabled");
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
  if (failures.length) throw new AggregateError(failures, `${failures.length} alias-move scenario(s) failed`);
}
