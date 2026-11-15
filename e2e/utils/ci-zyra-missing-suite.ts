import { expect, request as newRequest, test, type Page, type TestInfo } from "@playwright/test";
import { Client } from "pg";
import { answerRepositorySnapshotSql } from "./zyra-answer-feedback";
import { startFakeAiServer } from "./fake-ai-server";
import { seedMoveRepository, settleMoveFixtures, type MoveRepositoryState } from "./zyra-move-feedback";
import { MISSING_SUITE_MODES, seedMissingSuiteRepository, verifyZyraMissingSuite, type MissingSuiteFixture, type MissingSuiteMode } from "./zyra-missing-suite";
import { SUITE_OPERATION_ERROR } from "./zyra-suite-feedback";

/** Caller enforces loopback and disposable tesbo_ci; no shared/live inventory or writes. */
export async function verifyCiZyraMissingSuite(page: Page, api: string, web: string, projectId: string, otherProjectId: string, ownerId: string, testInfo: TestInfo) {
  const db = new Client({ connectionString: process.env.DATABASE_URL }), ai = await startFakeAiServer();
  const anonymous = await newRequest.newContext({ storageState: { cookies: [], origins: [] } });
  const base = `${api}/api/projects/${projectId}`, fixtures = new Map<string, MissingSuiteFixture>(), failures: unknown[] = [];
  const modes: MissingSuiteMode[] = [...MISSING_SUITE_MODES, "foreign"];
  let keyId = ""; await db.connect();
  const state = async () => (await db.query(answerRepositorySnapshotSql, [projectId])).rows[0] as MoveRepositoryState;
  const foreignState = async () => (await db.query(answerRepositorySnapshotSql, [otherProjectId])).rows[0] as MoveRepositoryState;
  try {
    for (const language of ["en", "ru"] as const) for (const mode of modes) {
      const label = `${language}-${mode}`, fixture = await seedMissingSuiteRepository(page.request, base, label);
      fixtures.set(label, fixture);
      if (mode === "deleted") {
        const deleted = await page.request.delete(`${api}/api/suites/${fixture.destinationId}`); expect(deleted.ok(), await deleted.text()).toBeTruthy();
      }
    }
    const foreign = await seedMoveRepository(page.request, `${api}/api/projects/${otherProjectId}`, "foreign destination control");
    await settleMoveFixtures([...fixtures.values()].flatMap((fixture) => [fixture, { ...fixture, firstId: fixture.blockedId }]), state);
    await settleMoveFixtures([foreign], foreignState); const foreignBefore = await foreignState();
    const key = await page.request.post(`${api}/api/workspace/ai-keys`, { data: { name: `CI missing suite ${projectId}`, provider: "openai",
      apiKey: "sk-ci-destination-not-a-real-key", baseUrl: ai.baseUrl.replace("host.docker.internal", "127.0.0.1") } });
    expect(key.status(), await key.text()).toBe(201); keyId = (await key.json()).id;
    const allocated = await page.request.post(`${api}/api/workspace/ai-keys/allocations`, { data: { projectId, workspaceAiKeyId: keyId } });
    expect(allocated.ok(), await allocated.text()).toBeTruthy();
    for (const language of ["en", "ru"] as const) for (const mode of modes) {
      const label = `${language}-${mode}`;
      await test.step(label, async () => {
        try {
          await verifyZyraMissingSuite({ request: page.request, ai, base, ownerId, language, mode, fixture: fixtures.get(label)!, foreignSuiteId: foreign.destinationId, state,
            afterReply: async (evidence) => {
              const foreignAfter = await foreignState(); expect(foreignAfter).toEqual(foreignBefore);
              await testInfo.attach(`destination-${label}-readback`, { body: JSON.stringify({ ...evidence, foreignBefore, foreignAfter }, null, 2), contentType: "application/json" });
              const trace = page.locator("[data-zyra-trace]");
              const verify = async () => {
                await expect(page.getByText(evidence.reply, { exact: true })).toBeVisible(); await expect(trace).toBeVisible();
                for (const id of evidence.movedIds) {
                  const row = evidence.before.cases.find((entry) => entry.id === id)!;
                  await expect(page.getByText(String(row.external_id), { exact: true })).toBeVisible();
                }
                expect.soft(await page.getByText(SUITE_OPERATION_ERROR[language], { exact: true }).count()).toBe(evidence.refused ? 1 : 0);
                expect.soft(await trace.getAttribute("data-zyra-trace")).toBe(evidence.refused ? "completed_with_errors" : "completed");
              };
              await page.goto(`${web}/projects/${projectId}/agents/zyra`); await verify(); await page.reload(); await verify();
              await testInfo.attach(`destination-${label}`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
              await trace.locator("summary").click();
              expect.soft(await trace.locator('[data-zyra-step="staging"]').getAttribute("data-zyra-step-status")).toBe(evidence.refused ? "failed" : "ok");
              await testInfo.attach(`destination-${label}-expanded`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
            },
          });
        } catch (error) {
          failures.push(error); await testInfo.attach(`destination-${label}-failure`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
        }
      });
    }
    await test.step("capability and access refusals retain both full snapshots", async () => {
      const disabled = await page.request.patch(`${base}/agents/zyra/settings`, { data: { capabilities: { suiteOperations: false } } });
      expect(disabled.ok(), await disabled.text()).toBeTruthy();
      const created = await page.request.post(`${base}/agents/zyra/chat/sessions`, { data: { title: "CI destination refusals" } });
      expect(created.status(), await created.text()).toBe(201); const sessionId = (await created.json()).id;
      try {
        const before = await state(), calls = ai.requests.length, fixture = fixtures.get("en-missing")!;
        for (const [client, url, status] of [
          [anonymous, `${base}/agents/zyra/chat/sessions/${sessionId}/messages`, 400],
          [page.request, `${api}/api/projects/${otherProjectId}/agents/zyra/chat/sessions/${sessionId}/messages`, 404],
        ] as const) {
          const denied = await client.post(url, { data: { message: "Move the requested case" } }); expect(denied.status(), await denied.text()).toBe(status);
        }
        expect(ai.requests.length).toBe(calls); expect(await state()).toEqual(before);
        ai.queueReply({ reply: "Moved the requested case.", action: "move_to_suite", actionType: "suite", testcases: [],
          operations: [{ type: "move_to_suite", suiteId: fixture.destinationId, testcaseId: fixture.blockedId }] });
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
  if (failures.length) throw new AggregateError(failures, `${failures.length} unavailable-destination scenario(s) failed`);
}
