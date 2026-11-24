import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { cruise } from "dependency-cruiser";
import extractTSConfig from "dependency-cruiser/config-utl/extract-ts-config";

const require = createRequire(import.meta.url);
const projects = [
  { root: "Tesbo-Backend-Nest", inputs: ["Tesbo-Backend-Nest/src"] },
  { root: "Tesbo-Frontend", inputs: ["Tesbo-Frontend/app", "Tesbo-Frontend/components", "Tesbo-Frontend/lib"] },
  { root: "sdk/playwright-reporter", inputs: ["sdk/playwright-reporter/src"] },
  { root: "e2e", inputs: ["e2e"] }
];
export const roots = projects.flatMap(({ inputs }) => inputs);
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** One established parser/resolver and one graph for both boundaries and impact. */
export async function analyzeArchitecture(inputs = roots, config = require("../.dependency-cruiser.cjs")) {
  if (!inputs.length) throw new Error("No input modules; refusing an empty architecture result.");
  const { enhancedResolveOptions, ...options } = config.options;
  const modules = new Map();
  const violations = new Map();
  const projectAliases = [];
  for (const project of projects) {
    const selected = inputs.filter((input) => input === project.root || input.startsWith(`${project.root}/`));
    if (!selected.length) continue;
    const filename = `${project.root}/tsconfig.json`;
    const tsConfig = extractTSConfig(filename);
    const patterns = Object.keys(tsConfig.options?.paths || {});
    projectAliases.push({ root: project.root, patterns });
    const aliasRegex = patterns.map((pattern) => `${escape(pattern).replaceAll("\\*", ".*")}$`).join("|");
    const forbidden = config.forbidden.map((rule) => rule.name === "unresolved-local-import" && aliasRegex
      ? { ...rule, to: { ...rule.to, path: `${rule.to.path}|^(?:${aliasRegex})` } } : rule);
    // Resolve each package with its own compiler configuration. Keep cross-package
    // edges for policy validation, but let the target package own their traversal.
    const result = await cruise(selected, {
      ...options,
      tsConfig: { fileName: filename },
      doNotFollow: { path: `${options.doNotFollow.path}|^(?!${escape(project.root)}/)` },
      outputType: "json",
      validate: true,
      ruleSet: { forbidden }
    }, enhancedResolveOptions, { tsConfig });
    const graph = typeof result.output === "string" ? JSON.parse(result.output) : result.output;
    if (!Array.isArray(graph?.modules) || graph.modules.length === 0 || !Array.isArray(graph?.summary?.violations)) {
      throw new Error(`Architecture analyzer produced no modules or an invalid ${project.root} report.`);
    }
    for (const module of graph.modules) {
      const previous = modules.get(module.source);
      if (!previous || previous.matchesDoNotFollow && !module.matchesDoNotFollow) modules.set(module.source, module);
    }
    for (const violation of graph.summary.violations) {
      violations.set(JSON.stringify([violation.rule.name, violation.from, violation.to]), violation);
    }
  }
  if (!modules.size || inputs.some((input) => !projects.some(({ root }) => input === root || input.startsWith(`${root}/`)))) {
    throw new Error("Unmapped/empty architecture input; every source project needs its own resolver.");
  }
  const nodes = [...modules.values()].sort((a, b) => a.source.localeCompare(b.source));
  // Project-local reverse metadata is incomplete after merging cross-package
  // leaves. Rebuild it from the authoritative outgoing edges, like impact does.
  const dependents = new Map(nodes.map((module) => [module.source, new Set()]));
  for (const module of nodes) {
    for (const dependency of module.dependencies) dependents.get(dependency.resolved)?.add(module.source);
  }
  for (const module of nodes) module.dependents = [...dependents.get(module.source)].sort();
  const problems = [...violations.values()].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const counts = { error: 0, warn: 0, info: 0, ignore: 0 };
  for (const { rule } of problems) counts[rule.severity]++;
  return {
    modules: nodes,
    summary: {
      violations: problems, ...counts, advisedExitCode: counts.error ? 1 : 0,
      totalCruised: nodes.length,
      totalDependenciesCruised: nodes.reduce((count, module) => count + module.dependencies.length, 0)
    },
    quality: { projectAliases, note: "Merged dependency-cruiser graphs; each project uses its own TypeScript configuration." }
  };
}

export async function main() {
  const graph = await analyzeArchitecture();
  fs.mkdirSync("reports/quality", { recursive: true });
  fs.writeFileSync("reports/quality/dependencies.json", JSON.stringify(graph, null, 2) + "\n");
  const errors = graph.summary.violations.filter(({ rule }) => rule.severity === "error");
  for (const { from, to, rule } of errors) console.error(`[${rule.name}] ${from} -> ${to}`);
  console.log(`Architecture: ${graph.modules.length} modules analyzed; ${errors.length} forbidden edges. Graph is static evidence, not runtime verification.`);
  if (errors.length) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
