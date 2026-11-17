/**
 * Static selection/evidence only. Never imports product code, Playwright, fixtures,
 * environment files or runtime .auth state. Exit 0 means a plan, NOT passing tests.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { resolveBase, changedPaths as gitChangedPaths } from "./git-quality.mjs";

const GROUPS = ["api", "ui", "regression", "smoke"];
const sorted = values => [...new Set(values)].sort();
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const own = (value, key) => Object.hasOwn(value, key);

export class ImpactInputError extends Error {
  constructor(message) {
    super(message);
    this.name = "ImpactInputError";
  }
}

function requireInput(condition, message) {
  if (!condition) throw new ImpactInputError(message);
}

export function normalizePath(value) {
  requireInput(typeof value === "string" && value.trim().length > 0, "Expected a non-empty repository-relative path.");
  const normalized = value.replaceAll("\\", "/").replace(/^(?:\.\/)+/, "");
  requireInput(!/^(?:\/|[a-z]:)/i.test(normalized) && !/[\x00-\x1f\x7f]/.test(normalized),
    `Unsafe repository path: ${JSON.stringify(value)}`);
  const parts = normalized.split("/").filter(part => part !== "." && part !== "");
  requireInput(parts.length > 0 && !parts.includes(".."), `Path escapes the repository: ${JSON.stringify(value)}`);
  return parts.join("/");
}

function sensitivePath(value) {
  return normalizePath(value).split("/").some(segment => {
    const part = segment.toLowerCase();
    return part === ".auth" || (/^\.env(?:\.|$)/.test(part) && !part.endsWith(".example"));
  });
}

// Only *, ** and ? are special; Next.js [id] and (app) segments are literal.
export function matchesPattern(filename, pattern) {
  const input = normalizePath(pattern);
  let expression = "^";
  for (let i = 0; i < input.length; i++) {
    if (input[i] === "*" && input[i + 1] === "*") {
      i++;
      if (input[i + 1] === "/") {
        expression += "(?:.*/)?";
        i++;
      } else expression += ".*";
    } else if (input[i] === "*") expression += "[^/]*";
    else if (input[i] === "?") expression += "[^/]";
    else expression += input[i].replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
  }
  return new RegExp(expression + "$").test(normalizePath(filename));
}

function fields(value, allowed, label) {
  requireInput(object(value), `${label} must be an object.`);
  for (const key of Object.keys(value)) requireInput(allowed.includes(key), `${label}: unknown field ${key}.`);
}

function strings(value, label, nonEmpty = false) {
  requireInput(Array.isArray(value) && (!nonEmpty || value.length > 0) &&
    value.every(item => typeof item === "string" && item.trim().length > 0), `${label} must be an array of non-empty strings.`);
}

function text(value, label) {
  requireInput(typeof value === "string" && value.trim().length > 0, `${label} must be non-empty text.`);
}

function specGroup(filename) {
  if (/^e2e\/api\/.+\.spec\.ts$/.test(filename)) return "api";
  if (/^e2e\/ui\/.+\.spec\.ts$/.test(filename)) return "ui";
  if (/^e2e\/regression\/(?:api|ui)\/.+\.spec\.ts$/.test(filename)) return "regression";
  if (filename === "e2e/ci-smoke.spec.ts") return "smoke";
  return null;
}

/** Pure validation against an explicit inventory of checked-in, existing files. */
export function validateConfig(config, availablePaths) {
  fields(config, ["version", "policy", "checks", "domains", "rules", "sharedRisks", "nonProduct"], "Config");
  requireInput(config.version === 1, "Unsupported test-impact config version.");
  text(config.policy, "Config policy");
  requireInput(Array.isArray(availablePaths), "A checked-in existing-file inventory is required.");
  const available = new Set(availablePaths.map(normalizePath));
  requireInput(object(config.checks) && Object.keys(config.checks).length > 0, "Config checks are missing.");
  requireInput(object(config.domains) && Object.keys(config.domains).length > 0, "Config domains are missing.");
  const evidence = new Set();
  const evidencePath = value => {
    const filename = normalizePath(value);
    requireInput(filename === value && !sensitivePath(filename), `Invalid/sensitive evidence path: ${value}`);
    requireInput(available.has(filename), `Mapped evidence file is not checked in or is missing: ${filename}`);
    evidence.add(filename);
  };
  const id = value => requireInput(/^[a-z][a-z0-9-]*$/.test(value), `Invalid mapping identifier: ${value}`);
  for (const [key, check] of Object.entries(config.checks)) {
    id(key);
    fields(check, ["workflow", "job", "description", "evidence", "requiredBackendSuites"], `Check ${key}`);
    text(check.description, `Check ${key} description`);
    text(check.job, `Check ${key} job`);
    requireInput(/^\.github\/workflows\/[^/]+\.ya?ml$/.test(check.workflow), `Invalid workflow for ${key}.`);
    evidencePath(check.workflow);
    strings(check.evidence, `Check ${key} evidence`);
    check.evidence.forEach(evidencePath);
    if (check.requiredBackendSuites !== undefined) {
      strings(check.requiredBackendSuites, `Check ${key} requiredBackendSuites`, true);
      requireInput(new Set(check.requiredBackendSuites).size === check.requiredBackendSuites.length,
        `Check ${key} has duplicate required backend suites.`);
      for (const suite of check.requiredBackendSuites) {
        requireInput(/^Tesbo-Backend-Nest\/src\/.+\.spec\.ts$/.test(suite),
          `Check ${key} has an invalid required backend suite: ${suite}`);
        evidencePath(suite);
      }
    }
  }
  const checkRefs = (refs, label) => {
    strings(refs, label);
    for (const ref of refs) requireInput(own(config.checks, ref), `${label}: unknown check ${ref}.`);
  };
  for (const [key, domain] of Object.entries(config.domains)) {
    id(key);
    fields(domain, ["description", "specs", "checks", "review"], `Domain ${key}`);
    text(domain.description, `Domain ${key} description`);
    strings(domain.specs, `Domain ${key} specs`);
    for (const spec of domain.specs) {
      requireInput(specGroup(spec), `Domain ${key} has an invalid E2E spec: ${spec}`);
      evidencePath(spec);
    }
    checkRefs(domain.checks, `Domain ${key} checks`);
    if (domain.review !== undefined) strings(domain.review, `Domain ${key} review`);
  }
  const ruleIds = new Set();
  for (const kind of ["rules", "sharedRisks", "nonProduct"]) {
    requireInput(Array.isArray(config[kind]) && (kind !== "rules" || config[kind].length > 0), `Config ${kind} is missing.`);
    for (const rule of config[kind]) {
      fields(rule, kind === "nonProduct" ? ["id", "patterns", "reason", "checks"] :
        ["id", "patterns", "reason", "domains", ...(kind === "sharedRisks" ? ["changedOnly"] : [])], kind);
      if (rule.changedOnly !== undefined) requireInput(typeof rule.changedOnly === "boolean", `Rule ${rule.id} changedOnly must be boolean.`);
      id(rule.id);
      requireInput(!ruleIds.has(rule.id), `Duplicate mapping identifier: ${rule.id}`);
      ruleIds.add(rule.id);
      text(rule.reason, `Rule ${rule.id} reason`);
      strings(rule.patterns, `Rule ${rule.id} patterns`, true);
      rule.patterns.forEach(pattern => requireInput(normalizePath(pattern) === pattern, `Invalid pattern: ${pattern}`));
      if (kind === "nonProduct") checkRefs(rule.checks, `Rule ${rule.id} checks`);
      else {
        strings(rule.domains, `Rule ${rule.id} domains`, true);
        for (const ref of rule.domains) requireInput(ref === "*" || own(config.domains, ref), `Unknown domain ${ref} in ${rule.id}.`);
      }
    }
  }
  return sorted(evidence);
}

function externalGraphEntry(entry, filename) {
  if (entry.coreModule === true || filename.split("/").includes("node_modules")) return true;
  // dependency-cruiser can intentionally leave installed/bare npm packages
  // unfollowed. Internal aliases such as @/..., relative imports and repository
  // roots must NEVER be mistaken for such external leaf records.
  return entry.couldNotResolve === true && entry.followable === false &&
    Array.isArray(entry.dependencyTypes) && entry.dependencyTypes.includes("unknown") &&
    /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9._-]+)*$/.test(filename) &&
    !/^(?:sdk|scripts|e2e|src|app|lib)\//.test(filename);
}

function projectAliasRules(graph) {
  if (!own(graph, "quality")) return [];
  requireInput(object(graph.quality), "Graph quality metadata must be an object.");
  if (!own(graph.quality, "projectAliases")) return [];
  requireInput(Array.isArray(graph.quality.projectAliases), "Graph quality.projectAliases must be an array.");
  const roots = new Set();
  const rules = graph.quality.projectAliases.map(entry => {
    fields(entry, ["root", "patterns"], "Graph project alias metadata");
    const root = normalizePath(entry.root);
    requireInput(!/[*?]/.test(root) && !sensitivePath(root) && !roots.has(root),
      `Invalid/duplicate graph alias project root: ${root}`);
    roots.add(root);
    strings(entry.patterns, `Graph alias patterns for ${root}`);
    const patterns = sorted(entry.patterns).map(pattern => {
      requireInput(normalizePath(pattern) === pattern && pattern.split("*").length <= 2,
        `Invalid graph alias pattern for ${root}: ${JSON.stringify(pattern)}`);
      // TypeScript paths keys have at most one wildcard; it can span several
      // path segments, unlike a filesystem glob's single-segment "*".
      const expression = pattern.split("*").map(part => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*");
      return new RegExp(`^${expression}$`);
    });
    return { root, patterns };
  });
  // If project roots nest, the importing module's most specific project owns
  // its aliases. Never union aliases from unrelated or enclosing projects.
  return rules.sort((a, b) => b.root.length - a.root.length || (a.root < b.root ? -1 : a.root > b.root ? 1 : 0));
}

/** dependency-cruiser JSON with repository-relative resolved internal paths. */
export function parseGraph(graph) {
  requireInput(object(graph) && Array.isArray(graph.modules) && graph.modules.length > 0,
    "Graph must contain a non-empty dependency-cruiser modules array.");
  const aliases = projectAliasRules(graph);
  const reverse = new Map();
  const sources = new Set();
  const node = filename => {
    if (!reverse.has(filename)) reverse.set(filename, new Set());
  };
  for (const module of graph.modules) {
    requireInput(object(module), "Graph module must be an object.");
    const source = normalizePath(module.source);
    requireInput(Array.isArray(module.dependencies), `Graph dependencies missing for ${source}.`);
    if (externalGraphEntry(module, source)) continue;
    requireInput(!module.couldNotResolve, `Unresolved internal graph source: ${source}`);
    requireInput(!sensitivePath(source) && !sources.has(source), `Sensitive/duplicate graph source: ${source}`);
    sources.add(source);
    node(source);
    const sourceAliases = aliases.find(entry => source.startsWith(`${entry.root}/`))?.patterns ?? [];
    for (const dependency of module.dependencies) {
      requireInput(object(dependency), `Invalid graph dependency in ${source}.`);
      const declaredAlias = sourceAliases.some(pattern =>
        [dependency.module, dependency.resolved].some(specifier => typeof specifier === "string" && pattern.test(specifier)));
      requireInput(!(dependency.couldNotResolve && declaredAlias),
        `Unresolved declared project alias in ${source}: ${dependency.module ?? dependency.resolved}`);
      if (dependency.coreModule === true) continue;
      if (typeof dependency.resolved === "string" && externalGraphEntry(dependency, dependency.resolved)) continue;
      requireInput(!dependency.couldNotResolve, `Unresolved graph dependency in ${source}: ${dependency.module}`);
      requireInput(typeof dependency.resolved === "string" && dependency.resolved.length > 0,
        `Graph dependency lacks a resolved path in ${source}.`);
      const resolved = normalizePath(dependency.resolved);
      if (resolved.split("/").includes("node_modules")) continue;
      requireInput(!sensitivePath(resolved), `Sensitive graph dependency in ${source}.`);
      node(resolved);
      reverse.get(resolved).add(source);
    }
  }
  requireInput(sources.size > 0, "Graph contains no internal repository modules.");
  return reverse;
}

export function affectedConsumers(changedPaths, graph) {
  const reverse = parseGraph(graph);
  const changed = sorted(changedPaths.map(normalizePath));
  const seen = new Set(changed);
  const queue = [...changed];
  for (let i = 0; i < queue.length; i++) {
    for (const consumer of sorted(reverse.get(queue[i]) ?? [])) {
      if (!seen.has(consumer)) {
        seen.add(consumer);
        queue.push(consumer);
      }
    }
  }
  return {
    consumers: sorted([...seen].filter(filename => !changed.includes(filename))),
    missingPaths: changed.filter(filename => !reverse.has(filename))
  };
}

/** Pure deterministic planner. A valid plan is deliberately not a semantic verification verdict. */
export function planImpact({ changedPaths, config, availablePaths, graph, verifiedEmptyGitDiff = false }) {
  validateConfig(config, availablePaths);
  requireInput(typeof verifiedEmptyGitDiff === "boolean", "Verified-empty Git provenance must be boolean.");
  strings(changedPaths, "Changed paths", !verifiedEmptyGitDiff);
  requireInput(!verifiedEmptyGitDiff || changedPaths.length === 0, "Verified-empty Git provenance cannot accompany changed paths.");
  const changed = sorted(changedPaths.map(normalizePath));
  const closure = graph === undefined ? { consumers: [], missingPaths: [] } : affectedConsumers(changed, graph);
  const owners = new Set();
  const risks = new Set();
  const required = new Set();
  const rationale = [];
  const nonProductPaths = [];
  const unmappedPaths = [];
  const diagnostics = [];
  let productPathCount = 0;
  const expand = refs => sorted(refs.flatMap(ref => ref === "*" ? Object.keys(config.domains) : [ref]));
  for (const filename of sorted([...changed, ...closure.consumers])) {
    const source = changed.includes(filename) ? "changed" : "consumer";
    const nonProduct = config.nonProduct.filter(rule => rule.patterns.some(pattern => matchesPattern(filename, pattern)));
    if (nonProduct.length) {
      nonProductPaths.push({ path: filename, source, classifications: sorted(nonProduct.map(rule => rule.id)) });
      for (const rule of nonProduct) {
        rule.checks.forEach(check => required.add(check));
        rationale.push({ path: filename, source, rule: rule.id, kind: "non-product", domains: [], reason: rule.reason });
      }
      continue;
    }
    productPathCount++;
    const matches = config.rules.filter(rule => rule.patterns.some(pattern => matchesPattern(filename, pattern)));
    if (matches.length === 0) {
      unmappedPaths.push(filename);
      diagnostics.push({ code: "UNMAPPED_PRODUCT_PATH", path: filename,
        message: "Review required: no owning-domain mapping. Dependency reachability cannot certify semantic verification." });
    }
    for (const [kind, rules, target] of [
      ["owner", matches, owners],
      ["shared-risk", config.sharedRisks.filter(rule => (!rule.changedOnly || source === "changed") &&
        rule.patterns.some(pattern => matchesPattern(filename, pattern))), risks]
    ]) {
      for (const rule of rules) {
        const domains = expand(rule.domains);
        domains.forEach(domain => target.add(domain));
        rationale.push({ path: filename, source, rule: rule.id, kind, domains, reason: rule.reason });
      }
    }
  }
  const domainNames = sorted([...owners, ...risks]);
  const selectedSpecs = Object.fromEntries(GROUPS.map(group => [group, []]));
  for (const name of domainNames) {
    const domain = config.domains[name];
    domain.specs.forEach(spec => selectedSpecs[specGroup(spec)].push(spec));
    domain.checks.forEach(check => required.add(check));
    for (const message of domain.review ?? []) diagnostics.push({ code: "DOMAIN_EVIDENCE_GAP", domain: name, message });
  }
  for (const group of GROUPS) selectedSpecs[group] = sorted(selectedSpecs[group]);
  const selectedSpecFileCount = Object.values(selectedSpecs).reduce((count, specs) => count + specs.length, 0);
  if (productPathCount > 0 && selectedSpecFileCount === 0) diagnostics.push({
    code: "ZERO_PRODUCT_SELECTION", message: "Review required: product impact selected zero E2E spec files; this is never a green result."
  });
  for (const filename of closure.missingPaths.filter(filename => /\.[cm]?[jt]sx?$/.test(filename) && !nonProductPaths.some(item => item.path === filename))) {
    diagnostics.push({ code: "GRAPH_PATH_NOT_PRESENT", path: filename,
      message: "Review required: changed module is absent from the supplied graph (possibly new, deleted or stale); consumer closure is incomplete." });
  }
  const requiredChecks = sorted(required).map(id => ({ id, ...config.checks[id],
    evidence: sorted([...config.checks[id].evidence, ...(config.checks[id].requiredBackendSuites ?? [])]) }));
  const checkSpecs = sorted(requiredChecks.flatMap(check => check.evidence).filter(filename => /\.(?:spec|test)\.[cm]?[jt]sx?$/.test(filename)));
  return {
    version: 1,
    status: diagnostics.length ? "review-required" : verifiedEmptyGitDiff ? "no-changes" : productPathCount ? "selection-only" : "non-product",
    verification: {
      status: "not-run",
      executedTestCount: null,
      selectedTestCount: null,
      note: verifiedEmptyGitDiff
        ? "Verified Git comparison contained no changed tracked paths. No product coverage is claimed; no tests were collected or run."
        : "Static spec-file selection only; no test collection or execution occurred. This does not prove semantic coverage or require editing every affected area."
    },
    changedPaths: changed,
    graph: { provided: graph !== undefined, missingChangedModules: closure.missingPaths },
    affectedConsumers: closure.consumers,
    owningDomains: sorted(owners),
    sharedRiskDomains: sorted(risks),
    domains: domainNames.map(id => ({ id, description: config.domains[id].description })),
    requiredChecks,
    selectedSpecs,
    counts: {
      selectedSpecFileCount,
      selectedSpecFilesByKind: Object.fromEntries(GROUPS.map(group => [group, selectedSpecs[group].length])),
      requiredCheckSpecFileCount: checkSpecs.length
    },
    rationale: rationale.sort((a, b) => JSON.stringify(a) < JSON.stringify(b) ? -1 : JSON.stringify(a) > JSON.stringify(b) ? 1 : 0),
    nonProductPaths,
    unmappedPaths: sorted(unmappedPaths),
    diagnostics: diagnostics.sort((a, b) => JSON.stringify(a) < JSON.stringify(b) ? -1 : JSON.stringify(a) > JSON.stringify(b) ? 1 : 0),
    limitations: [
      config.policy,
      "Mappings are conservative, additive selection hints, not proof that every relevant scenario exists or passed.",
      graph === undefined ? "No dependency graph supplied; only configured path/shared-risk mappings were used." :
        "Graph reachability follows resolved internal static imports only; external npm/core leaves are not followed. SQL, HTTP, queue, dynamic and external consumers still require domain review.",
      "Spec counts are static file counts, not Playwright test counts. Existing CI jobs may run only subsets; selected full specs remain a separate execution obligation.",
      "Repository HEAD/base identity is input provenance, not proof of the effective worktree contents or any deployed/running build."
    ]
  };
}

const md = value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll("\\", "\\\\").replaceAll("`", "\\`").replaceAll("|", "\\|").replaceAll("\n", " ");

export function formatMarkdown(plan) {
  const list = values => values.length ? values.map(value => `- ${md(value)}`).join("\n") : "- None";
  const lines = ["# Test impact plan", "", `Status: **${md(plan.status)}**`, "",
    "**Selection only — tests NOT RUN.** Static spec-file counts are not executed test counts.",
    "Affected areas are review/test obligations, not instructions to edit every area.", ""];
  if (plan.status === "invalid-input") return [...lines, "## Diagnostics", list(plan.diagnostics.map(item => item.message)), ""].join("\n");
  if (plan.status === "no-changes") lines.push("Verified Git comparison: no changed tracked paths. No product coverage is claimed.", "");
  lines.push(`Selected E2E spec files: **${plan.counts.selectedSpecFileCount}**. Selected/executed test counts: **unknown / not run**.`,
    `Required-check spec files (separate static inventory): ${plan.counts.requiredCheckSpecFileCount}.`, "",
    "## Changed paths", list(plan.changedPaths), "", "## Affected consumers", list(plan.affectedConsumers), "",
    "## Owning domains", list(plan.owningDomains), "", "## Additive shared-risk domains", list(plan.sharedRiskDomains), "",
    "## Required checks", list(plan.requiredChecks.map(check => `${check.id} — ${check.workflow} / ${check.job}: ${check.description}; evidence: ${check.evidence.join(", ") || "workflow steps"}`)));
  for (const group of GROUPS) lines.push("", `## Selected ${group} specs (${plan.selectedSpecs[group].length} files)`, list(plan.selectedSpecs[group]));
  lines.push("", "## Rationale", list(plan.rationale.map(item => `${item.path} [${item.source}; ${item.rule}; ${item.kind}] → ${item.domains.join(", ") || "non-product"}: ${item.reason}`)),
    "", "## Unmapped paths", list(plan.unmappedPaths), "", "## Review diagnostics",
    list(plan.diagnostics.map(item => `${item.code}${item.path ? ` (${item.path})` : ""}${item.domain ? ` (${item.domain})` : ""}: ${item.message}`)),
    "", "## Limitations", list(plan.limitations), "");
  return lines.join("\n");
}

export function parseNulPaths(output) {
  requireInput(typeof output === "string" && (output === "" || output.endsWith("\0")), "Git path output must be NUL-delimited.");
  return sorted(output.split("\0").filter(Boolean).map(normalizePath));
}

export function parseArgs(args) {
  const options = { paths: [], format: "json" };
  const flags = new Map([["--base", "base"], ["--graph", "graph"], ["--config", "config"], ["--format", "format"], ["--output", "output"]]);
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--") {
      options.paths.push(...args.slice(i + 1));
      break;
    }
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--path") {
      requireInput(args[i + 1] !== undefined && !args[i + 1].startsWith("--"), "--path needs a value.");
      options.paths.push(args[++i]);
    } else if (flags.has(arg)) {
      requireInput(!seen.has(arg) && args[i + 1] !== undefined && !args[i + 1].startsWith("--"), `${arg} needs exactly one value.`);
      seen.add(arg);
      options[flags.get(arg)] = args[++i];
    } else {
      requireInput(!arg.startsWith("-"), `Unknown option: ${arg}`);
      options.paths.push(arg);
    }
  }
  requireInput(["json", "markdown"].includes(options.format), "--format must be json or markdown.");
  requireInput(!(options.base !== undefined && options.paths.length > 0), "Use explicit changed paths OR --base, not both.");
  if (!options.help) requireInput(options.base !== undefined || options.paths.length > 0, "Changed paths or --base are required; an empty plan is not a pass.");
  if (options.base !== undefined) requireInput(options.base.trim().length > 0 && !options.base.startsWith("-") && !/[\x00-\x1f\x7f]/.test(options.base), "Invalid base ref.");
  return options;
}

function gitRunner(root) {
  return args => {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
    requireInput(!result.error && result.status === 0, `Git command failed (${args[0]}): ${result.error?.message || result.stderr?.trim() || result.status}`);
    return result.stdout;
  };
}

/** Reuse the repository's single Git ref/diff owner; inject only for unit tests. */
export function changedPathsFromGit({ base, cwd = process.cwd(), resolve = resolveBase, readChanges = gitChangedPaths }) {
  requireInput(typeof base === "string" && base.trim().length > 0 && !base.startsWith("-") && !/[\x00-\x1f\x7f]/.test(base), "Invalid base ref.");
  const baseCommit = resolve(base, { cwd });
  requireInput(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(baseCommit), "Git did not resolve the merge base to a commit ID.");
  const changed = readChanges(baseCommit, { cwd });
  strings(changed, "Git changed paths");
  return { paths: sorted(changed.map(normalizePath)), baseCommit };
}

function readJson(filename, label) {
  try {
    const realPath = fs.realpathSync(filename);
    for (const input of [filename, realPath]) {
      requireInput(!sensitivePath(path.basename(input)) &&
        !input.replaceAll("\\", "/").split("/").some(segment => segment.toLowerCase() === ".auth"),
      `${label} cannot read environment or runtime .auth files.`);
    }
    return JSON.parse(fs.readFileSync(realPath, "utf8"));
  } catch (error) {
    if (error instanceof ImpactInputError) throw error;
    throw new ImpactInputError(`Cannot read valid ${label} JSON: ${error.message}`);
  }
}

export function runCli(args = process.argv.slice(2), { cwd = process.cwd(), stdout = process.stdout, stderr = process.stderr } = {}) {
  let options;
  let plan;
  let exitCode = 0;
  try {
    options = parseArgs(args);
    if (options.help) {
      stdout.write("Usage: node scripts/test-impact.mjs [--path] <repo-relative-path>... | --base <git-ref>\n" +
        "  [--graph graph.json] [--config config.json] [--format json|markdown] [--output artifact]\n" +
        "Base mode compares the verified merge base to the tracked worktree; never includes untracked files.\n" +
        "A verified empty base comparison reports no-changes, not product coverage; explicit changed paths cannot be empty.\n" +
        "Exit 0: selection-only/non-product/no-changes, 1: review-required, 2: invalid input. No tests run.\n");
      return 0;
    }
    const root = gitRunner(cwd)(["rev-parse", "--show-toplevel"]).trim();
    const runGit = gitRunner(root);
    const config = readJson(options.config ? path.resolve(cwd, options.config) : path.join(root, ".github/test-impact.json"), "config");
    const tracked = parseNulPaths(runGit(["ls-files", "--cached", "-z", "--"]));
    const evidence = validateConfig(config, tracked);
    // Stat ONLY the configured evidence; never scan/read runtime directories.
    for (const filename of evidence) {
      let isFile = false;
      try { isFile = fs.lstatSync(path.join(root, filename)).isFile(); } catch { /* missing evidence fails closed below */ }
      requireInput(isFile, `Mapped evidence file is missing or not a regular file: ${filename}`);
    }
    const graph = options.graph === undefined ? undefined : readJson(path.resolve(cwd, options.graph), "graph");
    const headCommit = runGit(["rev-parse", "--verify", "--end-of-options", "HEAD^{commit}"]).trim();
    const selection = options.base === undefined ? { paths: options.paths.map(normalizePath) }
      : changedPathsFromGit({ base: options.base, cwd: root });
    plan = planImpact({ changedPaths: selection.paths, config, availablePaths: tracked, graph,
      verifiedEmptyGitDiff: options.base !== undefined && selection.paths.length === 0 });
    plan.input = {
      mode: options.base === undefined ? "explicit-paths" : "git-base",
      headCommit,
      ...(options.base === undefined ? {} : { baseRef: options.base, baseCommit: selection.baseCommit,
        trackedWorktreeIncluded: true, untrackedFilesIncluded: false }),
      graph: options.graph ?? null
    };
    exitCode = plan.status === "review-required" ? 1 : 0;
  } catch (error) {
    exitCode = 2;
    plan = { version: 1, status: "invalid-input", verification: { status: "not-run", executedTestCount: null },
      diagnostics: [{ code: "INVALID_INPUT", message: error.message }] };
    stderr.write(`test-impact: ${error.message}\n`);
  }
  const output = options?.format === "markdown" ? formatMarkdown(plan) : JSON.stringify(plan, null, 2) + "\n";
  try {
    if (options?.output) fs.writeFileSync(path.resolve(cwd, options.output), output, { encoding: "utf8", flag: "wx" });
    else stdout.write(output);
  } catch (error) {
    stderr.write(`test-impact: cannot create artifact (existing files are never overwritten): ${error.message}\n`);
    return 2;
  }
  return exitCode;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = runCli();
}
