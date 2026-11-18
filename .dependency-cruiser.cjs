/*
 * Enforce observed architecture, not an invented layer system. Existing Nest
 * forwardRef cycles remain visible in the graph but are not blanket failures.
 * This graph is also the input to the conservative test-impact planner.
 */
const testCode = "(^|/)(test-helpers|test-support|__tests__|fixtures)/|^sdk/playwright-reporter/scripts/|\\.(spec|test)\\.[cm]?[jt]sx?$";
const backend = "^Tesbo-Backend-Nest/src/";
const frontend = "^Tesbo-Frontend/";
const sdk = "^sdk/playwright-reporter/src/";
const infrastructure = `${backend}(common|config|database|storage|cache|request-cache|observability)/`;

// Current service consumers, inventoried on development. This is not permission
// to add a second business implementation. New edges need an architecture review.
const legacyConsumers = [
  "auth/api-token-rest.guard.ts",
  "automation/automation.controller.ts",
  "automation/automation.service.ts",
  "behavior-graph/current-cache-graph.reader.ts",
  "behavior-graph/graph-change-review.delivery.ts",
  "behavior-graph/graph-review-run-links.ts",
  "behavior-graph/model-studio-preview.ts",
  "behavior-graph/model-studio-repository.ts",
  "billing/billing.service.ts",
  "custom-fields/custom-fields.service.ts",
  "custom-tags/custom-tags.service.ts",
  "legacy/legacy.controller.ts",
  "legacy/legacy.module.ts",
  "legacy/plan-run-write-lock.guard.ts",
  "legacy/signup.service.ts",
  "mcp/mcp.service.ts",
  "mcp/mcp.tools.ts",
  "mcp/mcp.types.ts",
  "review-board/review-board.service.ts",
  // Run schedules: project authorization and the Approved-only run-clone writer are owned by
  // LegacyService; schedule validation and the worker live in the schedules module.
  "schedules/schedules.service.ts",
  "zyra-archive-sweep/zyra-archive-sweep.service.ts"
];
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const knownLegacy = `^Tesbo-Backend-Nest/src/(${legacyConsumers.map(escape).join("|")})$`;
const rule = (name, comment, from, to) => ({ name, comment, severity: "error", from, to });

module.exports = {
  forbidden: [
    rule("backend-package-boundary", "Backend uses protocols, not frontend/SDK/test implementation imports.",
      { path: backend, pathNot: testCode }, { dependencyTypes: ["local"], pathNot: "^Tesbo-Backend-Nest/" }),
    rule("frontend-package-boundary", "Frontend consumes the API, not backend/SDK/test private source.",
      { path: frontend, pathNot: testCode }, { dependencyTypes: ["local"], pathNot: frontend }),
    rule("sdk-package-boundary", "The publishable SDK must work without this repository's applications.",
      { path: sdk, pathNot: testCode }, { dependencyTypes: ["local"], pathNot: "^sdk/playwright-reporter/" }),
    rule("production-cannot-import-tests", "Tests may depend on production code, not the reverse.",
      { path: `(${backend}|${frontend}|${sdk})`, pathNot: testCode }, { path: testCode }),
    rule("infrastructure-cannot-import-features", "Neutral infrastructure must not depend on feature services.",
      { path: infrastructure, pathNot: testCode }, { path: backend, pathNot: infrastructure }),
    rule("components-cannot-import-routes", "Reusable components must not depend on Next application composition.",
      { path: "^Tesbo-Frontend/components/" }, { path: "^Tesbo-Frontend/app/" }),
    rule("ui-primitives-cannot-import-domain-components", "UI primitives may use neutral lib data, not domain components.",
      { path: "^Tesbo-Frontend/components/ui/" }, { path: "^Tesbo-Frontend/(app/|components/(?!ui/))" }),
    rule("library-cannot-import-routes", "Library helpers must not import application pages/layouts.",
      { path: "^Tesbo-Frontend/lib/" }, { path: "^Tesbo-Frontend/app/" }),
    rule("library-component-boundary", "Only the existing route-parameter loading provider has this upward edge.",
      { path: "^Tesbo-Frontend/lib/", pathNot: "^Tesbo-Frontend/lib/routeParams\\.tsx$" },
      { path: "^Tesbo-Frontend/components/" }),
    rule("route-params-component-exception", "The existing provider imports PageLoader through the UI barrel, not arbitrary components.",
      { path: "^Tesbo-Frontend/lib/routeParams\\.tsx$" },
      { path: "^Tesbo-Frontend/components/", pathNot: "^Tesbo-Frontend/components/ui/index\\.ts$" }),
    rule("e2e-helpers-cannot-import-specs", "Test support must not execute specs as dependencies.",
      { path: "^e2e/(utils|fixtures)/" }, { path: "^e2e/.*\\.(spec|test)\\.ts$" }),
    rule("e2e-backend-boundary", "Exercise backend behavior through HTTP, not private service imports.",
      { path: "^e2e/" }, { path: backend }),
    rule("e2e-frontend-boundary", "The one transport smoke contract is the explicit frontend import exception.",
      { path: "^e2e/", pathNot: "^e2e/ci-smoke\\.spec\\.ts$" }, { path: frontend }),
    rule("smoke-frontend-exception", "The smoke contract may import the API client only.",
      { path: "^e2e/ci-smoke\\.spec\\.ts$" },
      { path: frontend, pathNot: "^Tesbo-Frontend/lib/api\\.ts$" }),
    rule("e2e-sdk-source-boundary", "Reporter integration must consume the built/packed SDK, not private source.",
      { path: "^e2e/" }, { path: sdk }),
    rule("no-new-legacy-service-consumers", "Reuse neutral helpers; new dependencies on the monolith need explicit review.",
      { path: backend, pathNot: `${testCode}|${knownLegacy}` },
      { path: "^Tesbo-Backend-Nest/src/legacy/legacy\\.service\\.ts$" }),
    rule("unresolved-local-import", "An unresolved relative/alias import makes architectural analysis incomplete.",
      {}, { couldNotResolve: true, path: "^(\\.|@/)" })
  ],
  options: {
    doNotFollow: { path: "(^|/)node_modules/" },
    exclude: { path: "(^|/)node_modules/|^(reports/quality/|Tesbo-Frontend/\\.next/|Tesbo-Backend-Nest/(dist/|\\.stryker-tmp/|reports/mutation/)|sdk/playwright-reporter/(dist/|dist-test/)|e2e/(\\.auth/|test-results/|playwright-report[^/]*/))" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      extensions: [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs", ".json"],
      conditionNames: ["import", "require", "node", "default"]
    }
  }
};
