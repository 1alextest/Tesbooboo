import { expect, request as newRequest, test, type Page, type TestInfo } from "@playwright/test";
import { Client } from "pg";
import { verifyZyraReviewCloseFeedback } from "./zyra-review-feedback";

/** Called only after the smoke's loopback + disposable tesbo_ci checks. */
export async function verifyCiZyraReviewFeedback(page: Page, api: string, web: string, projectId: string, otherProjectId: string, ownerId: string, testInfo: TestInfo) {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  const anonymous = await newRequest.newContext({ storageState: { cookies: [], origins: [] } });
  const base = `${api}/api/projects/${projectId}`;
  const failures: unknown[] = [];
  await db.connect();
  // One PostgreSQL statement: cases and history must share a snapshot, not straddle a worker commit.
  const repositorySnapshot = async () => (await db.query(`SELECT
    COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) FROM testcases t WHERE t.project_id=$1),'[]'::jsonb) AS cases,
    COALESCE((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.testcase_id,v.version) FROM testcase_versions v
      JOIN testcases t ON t.id=v.testcase_id WHERE t.project_id=$1),'[]'::jsonb) AS history`, [projectId])).rows[0] as { cases: Record<string, unknown>[]; history: unknown[] };
  try {
    for (const language of ["en", "ru"] as const) {
      for (const saveFirst of [true, false]) {
        const label = `${language}-${saveFirst ? "partial-save" : "unsaved"}`;
        await test.step(label, async () => {
          let sessionId = "", taskId = "";
          try {
            const titles = [`CI Zyra ${label} saved candidate`, `CI Zyra ${label} unsaved candidate`];
            const entries = titles.map((title) => ({ opType: "create", draft: {
              suiteId: null, title, description: "Keep review meaning", preconditions: "A staged proposal",
              stepsJson: JSON.stringify([{ stepNumber: 1, action: "Review the proposal", expectedResult: "Only selected drafts are saved" }]),
              testData: "fixture: staged", priority: "P2",
            } }));
            sessionId = (await db.query("INSERT INTO zyra_chat_sessions (project_id,user_id,title,language) VALUES ($1,$2,$3,$4) RETURNING id", [projectId, ownerId, `CI Zyra ${label}`, language])).rows[0].id;
            taskId = (await db.query(`INSERT INTO ai_generation_requests
              (project_id,requested_by,provider,model,user_story,requested_count,generated_count,generated_payload,agent_name,task_status,chat_session_id,language)
              VALUES ($1,$2,'zyra_chat','fixture','CI staged proposal',2,2,$3::jsonb,'Zyra the Test Generator','in_review',$4,$5) RETURNING id`,
            [projectId, ownerId, JSON.stringify(entries), sessionId, language])).rows[0].id;
            // Arrange generation output, never fabricate a save result. All writes below go through Nest.
            const rows = entries.map((entry, draftIndex) => ({
              ...entry.draft, action: "proposed-create", draftIndex, reviewRequestId: taskId,
            }));
            await db.query(`INSERT INTO zyra_chat_messages (session_id,project_id,user_id,role,content,status,testcases,activity,review_request_id)
              VALUES ($1,$2,$3,'assistant','CI staged proposals','completed',$4::jsonb,'[]'::jsonb,$5)`, [sessionId, projectId, ownerId, JSON.stringify(rows), taskId]);
            const taskUrl = `${base}/agents/zyra/tasks/${taskId}`;
            const beforeAccess = (await db.query("SELECT * FROM ai_generation_requests WHERE id=$1", [taskId])).rows;
            const denied = await anonymous.post(`${taskUrl}/close`);
            expect(denied.ok(), "an unauthenticated close must be refused").toBe(false);
            const foreign = await page.request.post(`${api}/api/projects/${otherProjectId}/agents/zyra/tasks/${taskId}/close`);
            expect(foreign.status()).toBe(404);
            expect((await db.query("SELECT * FROM ai_generation_requests WHERE id=$1", [taskId])).rows).toEqual(beforeAccess);
            await page.goto(`${web}/projects/${projectId}/agents/zyra`);
            await expect(page.getByText(titles[1], { exact: true })).toBeVisible();
            await verifyZyraReviewCloseFeedback({
              page, request: page.request, taskUrl, language, saveFirst, repositorySnapshot,
              settleSavedCases: async (ids) => {
                await expect.poll(async () => (await db.query(`SELECT COUNT(*)::int AS settled FROM testcases t
                  WHERE t.id=ANY($1::uuid[]) AND t.embedding_status='pending' AND EXISTS
                    (SELECT 1 FROM testcase_versions v WHERE v.testcase_id=t.id AND v.snapshot->>'embedding_status'='queued')`, [ids])).rows[0].settled,
                { message: "keyless save embedding bookkeeping must finish before the close baseline" }).toBe(ids.length);
              },
              capture: async (stage) => { await testInfo.attach(`zyra-${label}-${stage}`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" }); },
            });
            const stored = await repositorySnapshot();
            const saved = stored.cases.filter((row) => titles.includes(String(row.title)));
            expect(saved.map((row) => row.title)).toEqual(saveFirst ? [titles[0]] : []);
            if (saveFirst) expect(saved[0]).toMatchObject({ status: "Draft", description: "Keep review meaning", test_data: "fixture: staged" });
            const task = (await db.query("SELECT * FROM ai_generation_requests WHERE id=$1", [taskId])).rows[0];
            expect(task).toMatchObject({ task_status: "done", saved_count: saveFirst ? 1 : 0 });
            expect(task.generated_payload).toEqual(saveFirst ? entries.slice(1) : entries);
            expect(task.activity_log.filter((entry: { title?: string }) => entry.title === "Closed task")).toHaveLength(1);
          } catch (error) {
            failures.push(error);
            await testInfo.attach(`zyra-${label}-failure`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
          } finally {
            if (taskId) await db.query("DELETE FROM ai_generation_requests WHERE id=$1 AND project_id=$2", [taskId, projectId]);
            if (sessionId) {
              const deleted = await page.request.delete(`${base}/agents/zyra/chat/sessions/${sessionId}`);
              expect(deleted.ok(), await deleted.text()).toBeTruthy();
            }
          }
        });
      }
    }
  } finally {
    await anonymous.dispose();
    await db.end();
  }
  if (failures.length) throw new AggregateError(failures, `${failures.length} Zyra review scenario(s) failed`);
}
