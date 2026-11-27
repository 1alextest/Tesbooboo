import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";
import { env } from "../utils/env";
import { createApprovedTestcase } from "../utils/testcase-approval";

const runExecutable = promisify(execFile);
const stored = JSON.parse(fs.readFileSync(path.join(__dirname, "../.auth/context.json"), "utf8")) as { projectId: string };
const originRepo = "1alextest/Tesbooboo";
const referenceOracle = "The requirement exposes exactly one current approved link for the selected case and criteria.";

/**
 * End-to-end reporter seam, not a claim of human approval of a live requirement:
 * the case is Draft then approved through the real native API by the disposable
 * test actor; the handoff's requirement/receipt/link are synthetic, identified
 * as such. A separate governed scenario must exercise a real approved packet.
 */
test("AUT-HANDOFF-01 generated Playwright assertion reaches native Run, execution and evidence on pass and fault", async ({ request: human }) => {
  test.setTimeout(240_000);
  const projectId = stored.projectId;
  const runIds: string[] = [];
  let testcaseId: string | undefined;
  let credentialId: string | undefined;
  let temp: string | undefined;

  const requirementId = randomUUID();
  const requirementVersionId = randomUUID();
  const linkId = randomUUID();
  const targetRevision = "c".repeat(40);
  let currentCase: any;
  const server = createServer((req, res) => {
    const row = {
      linkId, testcaseId, requirementVersionId, criterionKeys: ["AC-1"], approved: true,
      testcaseRevision: currentCase?.editRevision, testcaseApprovalRevision: currentCase?.approvalRevision,
    };
    const cases = req.url === "/fault" ? [row, { ...row, linkId: randomUUID() }] : [row];
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ requirementId, approvedVersionId: requirementVersionId, cases }));
  });

  try {
    currentCase = await createApprovedTestcase(human, projectId, {
      title: "Disposable generated reporter " + Date.now(),
      automationRepo: originRepo,
      automationPath: "tests/journey.spec.mjs",
      automationFramework: "Playwright",
    });
    testcaseId = currentCase.id;
    expect(currentCase.status).toBe("Approved");
    expect(currentCase.externalId).toBeTruthy();
    expect(currentCase.editRevision).toMatch(/^[a-f0-9]{64}$/);
    expect(currentCase.approvalRevision).toMatch(/^[a-f0-9]{64}$/);

    const issued = await human.post("/api/projects/" + projectId + "/apikeys", {
      data: { name: "Disposable reporter " + Date.now(), scopes: ["read", "write"] },
    });
    expect(issued.ok(), "The native disposable token must be issued").toBe(true);
    const credential = await issued.json();
    credentialId = credential.id;
    expect(credential.token).toBeTruthy();

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const coverageOrigin = "http://127.0.0.1:" + (server.address() as AddressInfo).port;

    const packetBody = {
      schemaVersion: 1, purpose: "prepare_automation_change",
      native: {
        projectId, taskId: randomUUID(), receiptId: randomUUID(),
        proposalRevision: "a".repeat(64), selectedIndex: 0,
        requirementId, requirementVersionId, linkId,
        testcaseId, testcaseRevision: currentCase.editRevision,
        testcaseApprovalRevision: currentCase.approvalRevision,
        criterionKeys: ["AC-1"], criteria: [{ key: "AC-1", text: "Exactly one current approved case link" }],
        testcase: {
          id: testcaseId, externalId: currentCase.externalId, title: currentCase.title,
          automationRepo: originRepo, automationPath: "tests/journey.spec.mjs",
          automationFramework: "Playwright", automationTestName: "Generated native reporter verification",
        },
      },
      target: { repository: originRepo, branch: "development", revision: targetRevision, path: "tests/journey.spec.mjs" },
      investigation: {
        id: "CONTROLLED-AUT-HANDOFF", upstreamCase: "DISPOSABLE-01",
        targetPath: "tests/journey.spec.mjs", targetBlob: "d".repeat(40),
        repoRevision: targetRevision, harnessRevision: "a468921c2bead820520a97df897168487b2b4985",
        risks: [{ id: "R1", oracle: referenceOracle }],
      },
    };
    const selectionDigest = createHash("sha256").update(JSON.stringify(packetBody)).digest("hex");
    const packet = { ...packetBody, selectionDigest };

    // The packet is passed through the actual reference generator, not a
    // handwritten imitation of its test or its Tesbo reporter marker.
    temp = await mkdtemp(path.join(__dirname, "../.native-handoff-"));
    const packetPath = path.join(temp, "packet.json");
    const evidencePath = path.join(temp, "approved-handoff-evidence.json");
    await writeFile(packetPath, JSON.stringify(packet));
    await writeFile(evidencePath, JSON.stringify({ selectionDigest, target: packet.target }));
    const generatorUrl = pathToFileURL(path.resolve(__dirname, "../../scripts/qa-handoff-generated-change.mjs")).href;
    const generatorScript = [
      "import fs from 'node:fs';",
      "import path from 'node:path';",
      "import { writeGeneratedChange } from " + JSON.stringify(generatorUrl) + ";",
      "const packet = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));",
      "const item = writeGeneratedChange(packet, process.argv[2]);",
      "fs.mkdirSync(path.dirname(item.path), {recursive: true});",
      "fs.writeFileSync(item.path, item.content);",
    ].join("\n");
    await runExecutable(process.execPath, ["--input-type=module", "-e", generatorScript, packetPath, temp], {
      cwd: temp, timeout: 30_000,
    });

    const reporterPath = path.resolve(__dirname, "../../sdk/playwright-reporter/dist/index.js");
    const cliPath = path.resolve(__dirname, "../node_modules/@playwright/test/cli.js");
    const config = [
      "import { defineConfig } from '@playwright/test';",
      "export default defineConfig({",
      " testDir: '.', testMatch: '**/*.spec.mjs', workers: 1, retries: 0, timeout: 30000,",
      " reporter: [['list'], ['json', { outputFile: 'report.json' }],",
      "  [" + JSON.stringify(reporterPath) + ", { strict: true, requireConfig: true,",
      "   attachEvidence: 'always', runName: 'Disposable approved-handoff reporter proof' }]],",
      "});",
    ].join("\n");
    await writeFile(path.join(temp, "playwright.config.mjs"), config);
    await mkdir(path.join(temp, "tests"), { recursive: true });

    async function execute(pathname: "/good" | "/fault", expectedPass: boolean) {
      const childEnv = {
        ...process.env,
        GITHUB_ACTIONS: "", GITHUB_RUN_ID: "", // two distinct native Runs, not shards of the CI run
        TESBO_BASE_URL: env.apiBaseUrl, TESBO_PROJECT_ID: projectId, TESBO_API_TOKEN: credential.token,
        TESBO_JOURNEY_API_ORIGIN: coverageOrigin, TESBO_JOURNEY_COVERAGE_URL: coverageOrigin + pathname,
        TESBO_JOURNEY_TOKEN: "disposable-loopback-control", TESBO_JOURNEY_EVIDENCE_PATH: evidencePath,
        NO_PROXY: "127.0.0.1,localhost", no_proxy: "127.0.0.1,localhost",
      };
      let succeeded = false;
      let stdout = "";
      try {
        const output = await runExecutable(process.execPath, [
          cliPath, "test", "tests/journey.spec.mjs", "--config=playwright.config.mjs",
        ], { cwd: temp!, env: childEnv, timeout: 90_000 });
        stdout = output.stdout;
        succeeded = true;
      } catch (error) {
        stdout = String((error as { stdout?: string }).stdout ?? "");
      }
      expect(succeeded, "The generated assertion should distinguish the controlled " + pathname).toBe(expectedPass);
      const match = /\[tesbo\] reporting 1 linked test\(s\) to run ([0-9a-f-]{36})/i.exec(stdout);
      expect(match, "The existing Tesbo reporter must create a real native Run").not.toBeNull();
      const runId = match![1];
      runIds.push(runId);

      const nativeRead = await human.get("/api/projects/" + projectId + "/automation/runs/" + runId);
      expect(nativeRead.ok(), "The reporter-created Run must be readable through the existing API").toBe(true);
      const detail = await nativeRead.json();
      expect(detail.summary.total).toBe(1);
      expect(detail.summary[expectedPass ? "passed" : "failed"]).toBe(1);
      const row = detail.results.find((item: any) => item.caseId === currentCase.externalId);
      expect(row, "Exactly the native approved case must receive the execution").toBeTruthy();
      expect(row.status).toBe(expectedPass ? "Passed" : "Failed");
      expect(row.reportedBy).toBe("automation");
      expect(row.evidence).toHaveLength(1);
      expect(row.evidence[0].kind).toBe("log");

      const regularRead = await human.get("/api/cycles/" + runId + "/executions");
      expect(regularRead.ok()).toBe(true);
      const executions = await regularRead.json();
      expect(executions).toHaveLength(1);
      expect(executions[0]).toMatchObject({ externalId: currentCase.externalId, reportedBy: "automation" });
      expect(executions[0].evidenceCount).toBe(1);

      const fileRead = await human.get("/api/cycles/" + runId + "/executions/" + row.executionId
        + "/attachments/" + row.evidence[0].id + "/download");
      expect(fileRead.ok(), "Native evidence must be retrievable, not merely listed").toBe(true);
      expect(Buffer.from(await fileRead.body())).toEqual(await readFile(evidencePath));
      const output = JSON.parse(await readFile(path.join(temp!, "report.json"), "utf8"));
      expect(output.stats[expectedPass ? "expected" : "unexpected"]).toBe(1);
      return runId;
    }

    const correctRun = await execute("/good", true);
    const defectRun = await execute("/fault", false);
    expect(defectRun).not.toBe(correctRun);
  } finally {
    if (server.listening) await new Promise<void>(resolve => server.close(() => resolve()));
    for (const runId of runIds) {
      await human.delete("/api/cycles/" + runId, { failOnStatusCode: false });
    }
    if (testcaseId) await human.delete("/api/projects/" + projectId + "/testcases/" + testcaseId,
      { failOnStatusCode: false });
    if (credentialId) await human.delete("/api/projects/" + projectId + "/apikeys/" + credentialId,
      { failOnStatusCode: false });
    if (temp) await rm(temp, { recursive: true, force: true });
  }
});
