import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { test } from "node:test";
import { analyzeArchitecture, roots } from "./check-architecture.mjs";

const require = createRequire(import.meta.url);
const policy = require("../.dependency-cruiser.cjs");

test("actual dependency parser resolves aliases, types, re-exports and literal loads before enforcing boundaries", async (t) => {
  const previous = process.cwd();
  const parent = process.platform === "win32" ? path.join(process.env.LOCALAPPDATA, "Temp", "opencode") : os.tmpdir();
  const fixture = fs.mkdtempSync(path.join(parent, "architecture fixture "));
  const write = (name, source) => {
    fs.mkdirSync(path.dirname(path.join(fixture, name)), { recursive: true });
    fs.writeFileSync(path.join(fixture, name), source);
  };
  try {
    write("Tesbo-Frontend/tsconfig.json", JSON.stringify({ compilerOptions: { paths: { "@/*": ["./*"] } } }));
    write("Tesbo-Frontend/app/page.tsx", "export const Page = 1;");
    write("Tesbo-Frontend/lib/api.ts", "export const api = 1;");
    write("Tesbo-Frontend/lib/value.ts", 'import { api } from "./api"; export type Value = typeof api;');
    write("Tesbo-Frontend/components/ui/index.ts", "export const PageLoader = 1;");
    write("Tesbo-Frontend/components/domain/Widget.tsx", "export const Widget = 1;");
    write("Tesbo-Frontend/components/domain/Bad.tsx", 'export { Page } from "@/app/page";');
    write("Tesbo-Frontend/components/reports/Bad.tsx", 'export { Page } from "@/app/page";');
    write("Tesbo-Frontend/components/ui/Bad.tsx", 'import { Widget } from "../domain/Widget";');
    write("Tesbo-Frontend/lib/routeParams.tsx", 'import { PageLoader } from "@/components/ui";');
    write("Tesbo-Frontend/lib/bad.ts", 'import { Widget } from "@/components/domain/Widget";');
    write("Tesbo-Frontend/lib/bad-route.ts", 'export { Page } from "../app/page";');
    write("Tesbo-Backend-Nest/src/config/value.ts", "export const value = 1;");
    write("Tesbo-Backend-Nest/tsconfig.json", JSON.stringify({
      compilerOptions: { baseUrl: ".", paths: { "@server/*": ["src/*"] } }
    }));
    write("Tesbo-Backend-Nest/src/feature/model.ts", "export type Feature = string;");
    write("Tesbo-Backend-Nest/src/legacy/legacy.service.ts", "export class LegacyService {}");
    write("Tesbo-Backend-Nest/src/legacy/notification-writer.ts", "export const notify = 1;");
    write("Tesbo-Backend-Nest/src/auth/api-token-rest.guard.ts", 'import { LegacyService } from "../legacy/legacy.service";');
    write("Tesbo-Backend-Nest/src/rag/allowed.ts", 'import { notify } from "../legacy/notification-writer";');
    write("Tesbo-Backend-Nest/src/rag/bad.ts", 'import { LegacyService } from "../legacy/legacy.service";');
    write("Tesbo-Backend-Nest/src/common/allowed.ts", 'import { value } from "../config/value";');
    write("Tesbo-Backend-Nest/src/common/bad.ts", 'import type {\n Feature\n} from "../feature/model";');
    write("Tesbo-Backend-Nest/src/common/aliased.ts", 'import type { Feature } from "@server/feature/model";');
    write("Tesbo-Backend-Nest/src/common/missing-alias.ts", 'import "@server/not-found";');
    write("Tesbo-Backend-Nest/src/common/value.spec.ts", "export const testOnly = 1;");
    write("Tesbo-Backend-Nest/src/common/production.ts", 'import helper = require("./value.spec");');
    write("Tesbo-Backend-Nest/src/common/allowed.spec.ts", 'import { testOnly } from "./value.spec";');
    write("Tesbo-Backend-Nest/src/common/bad-package.ts", 'export type { Value } from "../../../Tesbo-Frontend/lib/value";');
    write("Tesbo-Backend-Nest/src/common/missing.ts", 'import "./nonexistent";');
    write("Tesbo-Backend-Nest/src/common/comments.ts", '// import "./fiction";\nexport const text = \'import "./also-fiction"\';');
    write("sdk/playwright-reporter/src/bad.ts", 'import type { Feature } from "../../../Tesbo-Backend-Nest/src/feature/model";');
    write("sdk/playwright-reporter/test-support/helper.cjs", "module.exports = {};");
    write("sdk/playwright-reporter/src/bad-helper.ts", 'import helper = require("../test-support/helper.cjs");');
    write("sdk/playwright-reporter/tsconfig.json", "{}");
    write("sdk/playwright-reporter/scripts/tool.cjs", "module.exports = {};");
    write("sdk/playwright-reporter/src/bad-test-script.ts", 'const helper = require("../scripts/tool.cjs");');
    write("scripts/private.ts", "export const privateTool = 1;");
    write("sdk/playwright-reporter/src/bad-tool.ts", 'export { privateTool } from "../../../scripts/private";');
    write("e2e/ci-smoke.spec.ts", 'const client = import("../Tesbo-Frontend/lib/api");');
    write("e2e/tsconfig.json", "{}");
    write("e2e/other.spec.ts", 'export type { Value } from "../Tesbo-Frontend/lib/value";');
    write("e2e/utils/bad.ts", 'const spec = require("../other.spec");');
    process.chdir(fixture);
    const graph = await analyzeArchitecture(roots, policy);
    const violations = graph.summary.violations;
    const has = (rule, from) => violations.some((v) => v.rule.name === rule && v.from === from);
    const module = (name) => graph.modules.find((item) => item.source === name);

    await t.test("alias and relative route imports hit the same architectural boundary", () => {
      assert.ok(has("components-cannot-import-routes", "Tesbo-Frontend/components/domain/Bad.tsx"));
      assert.ok(has("library-cannot-import-routes", "Tesbo-Frontend/lib/bad-route.ts"));
    });
    await t.test("type-only dependencies and re-exports cannot escape package/infrastructure rules", () => {
      assert.ok(has("infrastructure-cannot-import-features", "Tesbo-Backend-Nest/src/common/bad.ts"));
      assert.ok(has("backend-package-boundary", "Tesbo-Backend-Nest/src/common/bad-package.ts"));
      assert.ok(has("sdk-package-boundary", "sdk/playwright-reporter/src/bad.ts"));
      assert.ok(has("sdk-package-boundary", "sdk/playwright-reporter/src/bad-tool.ts"));
      assert.ok(has("production-cannot-import-tests", "sdk/playwright-reporter/src/bad-helper.ts"));
    });
    await t.test("import-equals/CommonJS and dynamic imports are analyzed, not grep-matched", () => {
      assert.ok(has("production-cannot-import-tests", "Tesbo-Backend-Nest/src/common/production.ts"));
      assert.ok(has("e2e-helpers-cannot-import-specs", "e2e/utils/bad.ts"));
      assert.ok(module("e2e/ci-smoke.spec.ts").dependencies.some((d) => d.resolved === "Tesbo-Frontend/lib/api.ts"));
    });
    await t.test("UI primitives and upward library imports are constrained", () => {
      assert.ok(has("ui-primitives-cannot-import-domain-components", "Tesbo-Frontend/components/ui/Bad.tsx"));
      assert.ok(has("library-component-boundary", "Tesbo-Frontend/lib/bad.ts"));
    });
    await t.test("exact existing exceptions do not grant whole-directory exemptions", () => {
      for (const source of ["Tesbo-Frontend/lib/routeParams.tsx", "e2e/ci-smoke.spec.ts", "Tesbo-Backend-Nest/src/auth/api-token-rest.guard.ts"]) {
        assert.equal(violations.some((v) => v.from === source), false, source);
      }
      assert.ok(has("e2e-frontend-boundary", "e2e/other.spec.ts"));
      assert.ok(has("no-new-legacy-service-consumers", "Tesbo-Backend-Nest/src/rag/bad.ts"));
    });
    await t.test("neutral helpers and test-to-test imports remain legitimate reuse", () => {
      for (const source of ["Tesbo-Backend-Nest/src/common/allowed.ts", "Tesbo-Backend-Nest/src/common/allowed.spec.ts", "Tesbo-Backend-Nest/src/rag/allowed.ts"]) {
        assert.equal(violations.some((v) => v.from === source), false, source);
      }
    });
    await t.test("unresolved local imports fail, comments/string content create no fake edges", () => {
      assert.ok(has("unresolved-local-import", "Tesbo-Backend-Nest/src/common/missing.ts"));
      assert.equal(module("Tesbo-Backend-Nest/src/common/comments.ts").dependencies.length, 0);
    });
    await t.test("report screens and their forbidden imports remain part of the analyzed system", () => {
      assert.ok(module("Tesbo-Frontend/components/reports/Bad.tsx"));
      assert.ok(has("components-cannot-import-routes", "Tesbo-Frontend/components/reports/Bad.tsx"));
    });
    await t.test("each project's declared aliases resolve and missing aliases cannot become external npm leaves", () => {
      assert.ok(has("infrastructure-cannot-import-features", "Tesbo-Backend-Nest/src/common/aliased.ts"));
      assert.ok(module("Tesbo-Backend-Nest/src/common/aliased.ts").dependencies.some((d) => d.resolved === "Tesbo-Backend-Nest/src/feature/model.ts"));
      assert.ok(has("unresolved-local-import", "Tesbo-Backend-Nest/src/common/missing-alias.ts"));
    });
    await t.test("SDK production cannot depend on unpublished test-only package scripts", () => {
      assert.ok(has("production-cannot-import-tests", "sdk/playwright-reporter/src/bad-test-script.ts"));
    });
    await t.test("merged graphs retain authoritative outgoing edges and rebuild reverse metadata across project order", () => {
      assert.ok(module("Tesbo-Frontend/lib/value.ts").dependencies.some((d) => d.resolved === "Tesbo-Frontend/lib/api.ts"));
      assert.ok(module("Tesbo-Frontend/lib/value.ts").dependents.includes("Tesbo-Backend-Nest/src/common/bad-package.ts"));
      assert.ok(module("Tesbo-Frontend/lib/api.ts").dependents.includes("e2e/ci-smoke.spec.ts"));
      assert.ok(module("Tesbo-Frontend/lib/api.ts").dependents.includes("Tesbo-Frontend/lib/value.ts"));
    });
  } finally {
    process.chdir(previous);
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test("an empty architectural analysis cannot produce a green result", async () => {
  await assert.rejects(analyzeArchitecture([]), /no modules|no files|no input|invalid|empty/i);
});
