import { expect, request as newRequest, type Page, type TestInfo } from "@playwright/test";
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";

/** Extends ci-smoke's safety-checked, disposable bootstrap; never targets a shared tenant. */
export async function verifyProductionReporter(page: Page, api: string, web: string, projectId: string, testInfo: TestInfo) {
  for (const target of [api, web, process.env.DATABASE_URL!]) {
    expect(["localhost", "127.0.0.1"]).toContain(new URL(target).hostname);
  }
  expect(new URL(process.env.DATABASE_URL!).pathname).toBe("/tesbo_ci");
  const request = page.request;
  const anonymous = await newRequest.newContext({ storageState: { cookies: [], origins: [] } });
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  const base = `${api}/api/projects/${projectId}`;
  const cases: Array<{ id: string; externalId: string }> = [];
  const tokens: Array<{ id: string; token: string }> = [];
  const name = "CI production reporter round trip";
  let manualId = "";
  let bugId = "";
  await db.connect();
  try {
    for (const title of ["reporter pass", "reporter failure", "reporter skip"]) {
      const response = await request.post(`${base}/testcases`, { data: { title } });
      expect(response.ok(), await response.text()).toBeTruthy();
      cases.push(await response.json());
    }
    for (const scope of ["write", "read"]) {
      const response = await request.post(`${base}/apikeys`, { data: { name: `CI reporter ${scope}`, scopes: [scope] } });
      expect(response.ok(), await response.text()).toBeTruthy();
      tokens.push(await response.json());
    }

    // Execute the production artifact in a real Playwright child, not reporter hooks or a fake HTTP server.
    const artifact = path.resolve(__dirname, "../../sdk/playwright-reporter/dist/index.js");
    expect((await readFile(artifact)).length).toBeGreaterThan(0); // Missing build must fail, not skip.
    const dir = testInfo.outputPath("reporter-fixture");
    await mkdir(dir, { recursive: true });
    const config = path.join(dir, "playwright.config.cjs");
    await writeFile(config, `module.exports = { testDir: __dirname, testMatch: 'reporter.spec.cjs', workers: 1, retries: 0, outputDir: ${JSON.stringify(path.join(dir, "results"))}, reporter: [['list'], [${JSON.stringify(artifact)}, { runName: ${JSON.stringify(name)}, requireConfig: true, strict: true, retries: 0, timeoutMs: 10000 }]] };`);
    await writeFile(path.join(dir, "reporter.spec.cjs"), `
const { test, expect } = require(${JSON.stringify(require.resolve("@playwright/test"))});
const fs = require('node:fs/promises');
test('passing reporter control', { tag: '@tesbo.testId("${cases[0].externalId}")' }, () => { expect(2 + 2).toBe(4); });
test('intentional reporter failure', { tag: '@tesbo.testId("${cases[1].externalId}")' }, async ({}, info) => {
  const log = info.outputPath('failure.log');
  await fs.writeFile(log, 'CI real reporter failure evidence');
  await info.attach('failure log', { path: log, contentType: 'text/plain' });
  throw new Error('Intentional CI reporter failure');
});
test.skip('skipped reporter control', { tag: '@tesbo.testId("${cases[2].externalId}")' }, () => {});
`);
    // One invocation uses the real CI identity. Do not invent a provider/run id or touch global env.
    const child = await new Promise<{ code: number; output: string }>((resolve, reject) => {
      execFile(process.execPath, [require.resolve("@playwright/test/cli"), "test", "--config", config], {
        cwd: dir, timeout: 60_000, maxBuffer: 1_048_576,
        env: { ...process.env, FORCE_COLOR: "0", TESBO_BASE_URL: api, TESBO_PROJECT_ID: projectId, TESBO_API_TOKEN: tokens[0].token }
      }, (error, stdout, stderr) => {
        if (error && (error.killed || typeof error.code !== "number")) { reject(new Error("Reporter child failed to execute or timed out")); return; }
        resolve({ code: error?.code as number ?? 0, output: `${stdout}\n${stderr}`.split(tokens[0].token).join("[redacted]") });
      });
    });
    await testInfo.attach("production-reporter-child", { body: child.output, contentType: "text/plain" });
    expect(child.code, child.output).toBe(1); // The deliberate test failure, never an ingest/config failure.
    expect(child.output).toContain("Intentional CI reporter failure");
    expect(child.output).toMatch(/closed \(completed\): 1 passed, 1 failed, 1 skipped/);
    expect(child.output).not.toMatch(/closure unconfirmed|request\(s\) to Tesbo failed|could not create the run/);

    const runs = (await db.query("SELECT * FROM cycles WHERE project_id = $1 AND name = $2 AND deleted_at IS NULL", [projectId, name])).rows;
    expect(runs).toHaveLength(1);
    const runId = runs[0].id as string;
    expect(runs[0]).toMatchObject({ source: "automation", status: "Completed", close_status: "completed" });
    expect(runs[0].closed_at).not.toBeNull();
    const sealed = async () => ({
      run: (await db.query("SELECT * FROM cycles WHERE id = $1", [runId])).rows,
      items: (await db.query("SELECT * FROM cycle_items WHERE cycle_id = $1 ORDER BY id", [runId])).rows,
      results: (await db.query("SELECT e.*, ci.testcase_id FROM executions e JOIN cycle_items ci ON ci.id = e.cycle_item_id WHERE ci.cycle_id = $1 ORDER BY e.id", [runId])).rows,
      evidence: (await db.query("SELECT a.* FROM attachments a JOIN executions e ON e.id = a.entity_id JOIN cycle_items ci ON ci.id = e.cycle_item_id WHERE a.project_id = $1 AND a.entity_type = 'execution' AND ci.cycle_id = $2 ORDER BY a.id", [projectId, runId])).rows
    });
    const before = await sealed();
    expect(before.results).toHaveLength(3);
    for (const [index, status] of ["Passed", "Failed", "Skipped"].entries()) {
      expect(before.results.find((row) => row.testcase_id === cases[index].id)).toMatchObject({ status, reported_by: "automation", retry_count: 0 });
    }
    const failed = before.results.find((row) => row.testcase_id === cases[1].id)!;
    expect(failed.error_message).toContain("Intentional CI reporter failure");
    expect(before.evidence).toHaveLength(1);
    expect(before.evidence[0]).toMatchObject({ entity_id: failed.id, evidence_kind: "log", file_name: "failure.log" });

    const mcp = async (scope: number, tool: string, args: Record<string, unknown>) => {
      const response = await anonymous.post(`${base}/mcp`, {
        headers: { Authorization: `Bearer ${tokens[scope].token}` },
        data: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: tool, arguments: args } }
      });
      expect(response.ok(), await response.text()).toBeTruthy();
      return response.json();
    };
    const read = await mcp(0, "get_execution", { executionId: failed.id });
    expect(read.error).toBeUndefined();
    expect(JSON.parse(read.result.content[0].text)).toMatchObject({ id: failed.id, status: "Failed" });
    const readonly = await mcp(1, "record_execution_result", { executionId: failed.id, status: "Passed" });
    expect(readonly.error).toBeDefined();
    const denied = await anonymous.post(`${base}/automation/runs/${runId}/results`, {
      headers: { Authorization: `Bearer ${tokens[1].token}` }, data: { caseId: cases[1].externalId, status: "pass", retryCount: 1 }
    });
    expect(denied.status()).toBe(403);
    const late = await request.post(`${base}/automation/runs/${runId}/results`, { data: { caseId: cases[1].externalId, status: "pass", retryCount: 1 } });
    expect(late.status()).toBe(409);
    expect(await sealed()).toEqual(before);

    // MCP bulk deliberately reports per-item outcomes, unlike the REST whole-selection UI.
    const manual = await request.post(`${base}/cycles`, { data: { name: "CI reporter manual control" } });
    expect(manual.ok(), await manual.text()).toBeTruthy();
    manualId = (await manual.json()).id;
    const attached = await request.post(`${api}/api/cycles/${manualId}/testcases`, { data: { testcaseIds: [cases[0].id] } });
    expect(attached.ok(), await attached.text()).toBeTruthy();
    const manualExecution = (await db.query("SELECT e.id FROM executions e JOIN cycle_items ci ON ci.id = e.cycle_item_id WHERE ci.cycle_id = $1", [manualId])).rows[0].id;
    const bulk = await mcp(0, "bulk_record_execution_results", { results: [{ executionId: manualExecution, status: "Failed" }, { executionId: failed.id, status: "Passed" }] });
    expect(bulk.error).toBeUndefined();
    expect(JSON.parse(bulk.result.content[0].text)).toMatchObject({ total: 2, succeeded: 1, failed: 1, results: [{ index: 0, ok: true }, { index: 1, ok: false }] });
    expect((await db.query("SELECT status FROM executions WHERE id = $1", [manualExecution])).rows[0].status).toBe("Failed");
    expect(await sealed()).toEqual(before);
    const bug = await mcp(0, "create_bug", { title: "CI reporter linked finding", links: [{ testcaseId: cases[1].id, cycleId: runId, executionId: failed.id }] });
    expect(bug.error).toBeUndefined();
    bugId = JSON.parse(bug.result.content[0].text).id;
    expect(bugId).toBeTruthy();
    expect(await sealed()).toEqual(before);
    const closed = await request.patch(`${base}/automation/runs/${runId}/close`, { data: { status: "completed" } });
    expect(closed.ok(), await closed.text()).toBeTruthy();
    expect(await closed.json()).toMatchObject({ alreadyClosed: true, closeStatus: "completed", summary: { total: 3, passed: 1, failed: 1, skipped: 1 } });
    expect(await sealed()).toEqual(before);

    await page.goto(`${web}/projects/${projectId}/cycles/${runId}/execute/${failed.id}`);
    await expect(page.getByLabel("Bug Title", { exact: true })).toHaveValue("CI reporter linked finding");
    await expect(page.getByRole("button", { name: "Failed", exact: true })).toHaveClass(/bg-\[var\(--error\)\]/);
    await page.reload();
    await expect(page.getByLabel("Bug Title", { exact: true })).toHaveValue("CI reporter linked finding");
    await testInfo.attach("production-reporter-browser-readback", { body: await page.screenshot(), contentType: "image/png" });
    expect(await sealed()).toEqual(before);
  } finally {
    // Only soft-delete our synthetic resources. Preserve their audit/provenance until service teardown.
    if (bugId) await request.delete(`${api}/api/bugs/${bugId}`, { failOnStatusCode: false });
    const created = await db.query("SELECT id FROM cycles WHERE project_id = $1 AND name = $2 AND deleted_at IS NULL", [projectId, name]);
    for (const row of created.rows) await request.delete(`${api}/api/cycles/${row.id}`, { failOnStatusCode: false });
    if (manualId) await request.delete(`${api}/api/cycles/${manualId}`, { failOnStatusCode: false });
    for (const token of tokens) await request.delete(`${base}/apikeys/${token.id}`, { failOnStatusCode: false });
    for (const testcase of cases) await request.delete(`${base}/testcases/${testcase.id}`, { failOnStatusCode: false });
    await anonymous.dispose();
    await db.end();
  }
}
