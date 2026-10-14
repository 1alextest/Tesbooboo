import { LegacyService } from "./legacy.service";
import type { DatabaseService } from "../database/database.service";
import type { EmailService } from "../auth/email.service";
import type { PasswordService } from "../auth/password.service";
import type { AppConfigService } from "../config/app-config.service";
import type { StorageService } from "../storage/storage.service";
import type { RagIngestionService } from "../rag/rag-ingestion.service";
import type { RagRetrievalService } from "../rag/rag-retrieval.service";
import type { IntegrationSyncService } from "../integration-sync/integration-sync.service";
import type { ApiTokenService } from "../auth/api-token.service";
import type { PlanLimitsService } from "../plan-limits/plan-limits.service";
import type { CustomFieldsService } from "../custom-fields/custom-fields.service";
import type { CustomTagsService } from "../custom-tags/custom-tags.service";
import { RequestCacheService } from "../request-cache/request-cache.service";
import { ProjectLookupService } from "../request-cache/project-lookup.service";
import type { KbExtractionRunnerService } from "./kb-extraction-runner.service";
import { SuitesCacheService } from "../cache/suites-cache.service";
import { TestcasesListCacheService } from "../cache/testcases-list-cache.service";
import { ProjectOverviewCacheService } from "../cache/project-overview-cache.service";
import type Redis from "ioredis";

process.env.SECRETS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

/*
 * "Zyra is taking too much time in generating". The traces of a two-ticket plan (2026-10-13) put
 * ~400 s of a ~470 s batch in ONE generation call writing ~100 test cases as a single output stream,
 * and ~30 s in staging, which looked the batch's suite up once per draft. A plan batch is now written
 * by parallel calls of at most 25 scenarios each, and staging looks each suite up once.
 */

type Body = Record<string, unknown>;
type Query = jest.Mock<Promise<{ rows: Body[] }>, [string, unknown[]?]>;

function makeLegacy(query: Query = jest.fn(() => Promise.resolve({ rows: [] })) as unknown as Query): LegacyService {
  const db = { query } as unknown as DatabaseService;
  const requestCache = new RequestCacheService({} as unknown as AppConfigService);
  return new LegacyService(
    db,
    {} as unknown as EmailService,
    {} as unknown as PasswordService,
    {} as unknown as AppConfigService,
    {} as unknown as StorageService,
    {} as unknown as RagIngestionService,
    {} as unknown as RagRetrievalService,
    {} as unknown as IntegrationSyncService,
    {} as unknown as ApiTokenService,
    {} as unknown as PlanLimitsService,
    requestCache,
    new ProjectLookupService(db, requestCache),
    {} as unknown as KbExtractionRunnerService,
    new SuitesCacheService({} as unknown as Redis, {} as unknown as AppConfigService),
    new TestcasesListCacheService({} as unknown as Redis, {} as unknown as AppConfigService),
    new ProjectOverviewCacheService({} as unknown as Redis, {} as unknown as AppConfigService),
    {} as unknown as CustomFieldsService,
    {} as unknown as CustomTagsService
  );
}

type Usage = { input: number; output: number; total: number; cached: number };
type Internals = {
  generateZyraChunkedDrafts: (args: Body, input: Body, planBatch: { originalMessage: string; scenarios: string[] }) => Promise<{ result: { drafts: Body[]; usage: Usage }; matchesByIndex: unknown[] }>;
  generateZyraWithProvider: (params: { input: Body }) => Promise<{ drafts: Body[]; usage: Usage }>;
  zyraSimilarityFeedbackForDrafts: (projectId: string, drafts: Body[]) => Promise<{ feedback: string | null; matchesByIndex: unknown[] }>;
  recordZyraTokenUsage: (...args: unknown[]) => Promise<void>;
  applyZyraChatOperations: (projectId: string, userId: string, sessionId: string, operations: Body[]) => Promise<{ testcases: Body[]; activity: Array<{ title?: string }> }>;
  zyraProjectCapabilities: (projectId: string) => Promise<Body>;
  resolveZyraActor: (userId: string) => Promise<string>;
  getProjectSuite: (projectId: string, suiteId: string) => Promise<Body | null>;
  resolveOrCreateSuiteByName: (projectId: string, name: string) => Promise<Body>;
  logProjectActivity: (...args: unknown[]) => Promise<void>;
  recordZyraPendingReviewRequest: (...args: unknown[]) => Promise<void>;
};
const internals = (svc: LegacyService) => svc as unknown as Internals;
const statics = LegacyService as unknown as { zyraGenerationChunks: (scenarios: string[]) => string[][] };

const scenarios = (count: number) => Array.from({ length: count }, (_, i) => `Scenario ${i + 1}`);
const usage = (output: number): Usage => ({ input: 1000, output, total: 1000 + output, cached: 0 });
/** The scenario lines a generation call was handed (zyraBatchMessage numbers them "1. …"). */
const listed = (story: unknown) => String(story).split("\n").filter((line) => /^\d+\. Scenario/.test(line)).map((line) => line.replace(/^\d+\. /, ""));

describe("zyraGenerationChunks — the fewest even chunks of at most 25, in order", () => {
  it.each([
    [100, [25, 25, 25, 25]],
    [101, [21, 21, 21, 21, 17]],
    [30, [15, 15]],
    [26, [13, 13]]
  ])("%i scenarios", (count, sizes) => {
    const chunks = statics.zyraGenerationChunks(scenarios(count));
    expect(chunks.map((chunk) => chunk.length)).toEqual(sizes);
    expect(chunks.flat()).toEqual(scenarios(count));
  });
});

describe("generateZyraChunkedDrafts — a plan batch written by parallel calls", () => {
  const args = { provider: "anthropic", model: "m", apiKey: "k", projectId: "p1" };
  const input = { story: "unused", requestedCount: 100, testcaseRange: "all", knowledge: [], jira: [], existingTestcases: [] };

  function setup(flaggedChunk?: number) {
    const svc = makeLegacy();
    let started = 0;
    let release: () => void = () => undefined;
    const allStarted = new Promise<void>((resolve) => { release = resolve; });
    const generate = jest.spyOn(internals(svc), "generateZyraWithProvider").mockImplementation(async ({ input: chunkInput }) => {
      const mine = listed(chunkInput.story);
      started += 1;
      if (started === 4) release();
      // Every call waits until all four have started: this only resolves if they run concurrently.
      await allStarted;
      const revised = Boolean(chunkInput.feedback);
      return {
        drafts: mine.map((scenario, i) => ({ title: `${revised ? "Revised " : ""}${scenario}`, scenario: i + 1 })),
        usage: usage(revised ? 50 : 100)
      };
    });
    jest.spyOn(internals(svc), "recordZyraTokenUsage").mockResolvedValue(undefined);
    jest.spyOn(internals(svc), "zyraSimilarityFeedbackForDrafts").mockImplementation(async (_p, drafts) => {
      const chunk = Number(/Scenario (\d+)/.exec(String(drafts[0]?.title))?.[1] ?? 0) <= 25 ? 0 : Math.ceil(Number(/Scenario (\d+)/.exec(String(drafts[0]?.title))?.[1]) / 25) - 1;
      const flagged = chunk === flaggedChunk && !String(drafts[0]?.title).startsWith("Revised");
      return { feedback: flagged ? "An existing test case appears to cover your draft" : null, matchesByIndex: drafts.map((_, i) => (flagged && i === 0 ? { testcaseId: "tc-1", cosineSimilarity: 0.9 } : null)) };
    });
    return { svc, generate };
  }

  it("runs the chunks at once, each handed only its own scenarios, and merges them back in scenario order", async () => {
    const { svc, generate } = setup();
    const { result } = await internals(svc).generateZyraChunkedDrafts(args, input, { originalMessage: "All possible for KAN-1", scenarios: scenarios(100) });
    expect(generate).toHaveBeenCalledTimes(4);
    const handed = generate.mock.calls.map(([call]) => listed(call.input.story));
    expect(handed).toEqual([scenarios(100).slice(0, 25), scenarios(100).slice(25, 50), scenarios(100).slice(50, 75), scenarios(100).slice(75)]);
    for (const [call] of generate.mock.calls) {
      expect(String(call.input.story)).toContain("All possible for KAN-1");
      expect(call.input.requestedCount).toBe(25);
    }
    expect(result.drafts.map((d) => d.title)).toEqual(scenarios(100));
    // Numbered against the whole batch, so a missing scenario is still found and retried.
    expect(result.drafts.map((d) => d.scenario)).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
    expect(result.usage).toEqual({ input: 4000, output: 400, total: 4400, cached: 0 });
  });

  it("a flagged draft revises only its own chunk, not the whole batch", async () => {
    const { svc, generate } = setup(2);
    const { result, matchesByIndex } = await internals(svc).generateZyraChunkedDrafts(args, input, { originalMessage: "x", scenarios: scenarios(100) });
    // Four drafting calls plus one revision — before, any flag regenerated all 100 in one more call.
    expect(generate).toHaveBeenCalledTimes(5);
    const revision = generate.mock.calls.find(([call]) => call.input.feedback)!;
    expect(listed(revision[0].input.story)).toEqual(scenarios(100).slice(50, 75));
    expect(result.drafts.slice(50, 75).every((d) => String(d.title).startsWith("Revised"))).toBe(true);
    expect(result.drafts.slice(0, 50).some((d) => String(d.title).startsWith("Revised"))).toBe(false);
    // The match stays on the flagged chunk's first draft, at its position in the whole batch.
    expect(matchesByIndex[50]).toEqual({ testcaseId: "tc-1", cosineSimilarity: 0.9 });
    expect(matchesByIndex.filter(Boolean)).toHaveLength(1);
  });

  it("a scenario number outside its chunk is left unmapped, never attributed to another chunk's scenario", async () => {
    const svc = makeLegacy();
    jest.spyOn(internals(svc), "generateZyraWithProvider").mockImplementation(async ({ input: chunkInput }) => ({
      drafts: listed(chunkInput.story).map((title, i) => ({ title, scenario: i === 0 ? 99 : i + 1 })),
      usage: usage(10)
    }));
    jest.spyOn(internals(svc), "recordZyraTokenUsage").mockResolvedValue(undefined);
    jest.spyOn(internals(svc), "zyraSimilarityFeedbackForDrafts").mockResolvedValue({ feedback: null, matchesByIndex: [] });
    const { result } = await internals(svc).generateZyraChunkedDrafts(args, input, { originalMessage: "x", scenarios: scenarios(30) });
    expect(result.drafts[0].scenario).toBeUndefined();
    expect(result.drafts[15].scenario).toBeUndefined();
    expect(result.drafts[1].scenario).toBe(2);
    expect(result.drafts[16].scenario).toBe(17);
  });

  it("a failed chunk fails the batch, as a failed single call did", async () => {
    const svc = makeLegacy();
    jest.spyOn(internals(svc), "generateZyraWithProvider")
      .mockResolvedValueOnce({ drafts: [], usage: usage(1) })
      .mockRejectedValueOnce(new Error("provider overloaded"));
    jest.spyOn(internals(svc), "recordZyraTokenUsage").mockResolvedValue(undefined);
    jest.spyOn(internals(svc), "zyraSimilarityFeedbackForDrafts").mockResolvedValue({ feedback: null, matchesByIndex: [] });
    await expect(internals(svc).generateZyraChunkedDrafts(args, input, { originalMessage: "x", scenarios: scenarios(50) })).rejects.toThrow("provider overloaded");
  });

  it("a failed chunk is reported only once the other chunks have finished, so none is still writing into the batch", async () => {
    const svc = makeLegacy();
    let slowFinished = false;
    jest.spyOn(internals(svc), "generateZyraWithProvider")
      .mockImplementationOnce(async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        slowFinished = true;
        return { drafts: [], usage: usage(1) };
      })
      .mockRejectedValueOnce(new Error("provider overloaded"));
    jest.spyOn(internals(svc), "recordZyraTokenUsage").mockResolvedValue(undefined);
    jest.spyOn(internals(svc), "zyraSimilarityFeedbackForDrafts").mockResolvedValue({ feedback: null, matchesByIndex: [] });
    await expect(internals(svc).generateZyraChunkedDrafts(args, input, { originalMessage: "x", scenarios: scenarios(50) })).rejects.toThrow("provider overloaded");
    expect(slowFinished).toBe(true);
  });
});

describe("applyZyraChatOperations — a batch's suite is looked up once, not once per draft", () => {
  function setup() {
    const query = jest.fn(() => Promise.resolve({ rows: [{ id: "req-1" }] })) as unknown as Query;
    const svc = makeLegacy(query);
    jest.spyOn(internals(svc), "zyraProjectCapabilities").mockResolvedValue({ generation: true, knowledgeBase: true, testcaseStorage: true, suiteOperations: true });
    jest.spyOn(internals(svc), "resolveZyraActor").mockResolvedValue("actor-1");
    jest.spyOn(internals(svc), "recordZyraPendingReviewRequest").mockResolvedValue(undefined);
    const log = jest.spyOn(internals(svc), "logProjectActivity").mockResolvedValue(undefined);
    // The staged drafts, as written to ai_generation_requests — where each one's suite is kept.
    const stagedSuites = (): unknown[] => {
      const staged = query.mock.calls
        .flatMap(([, params]) => params ?? [])
        .find((param) => typeof param === "string" && param.includes('"opType":"create"'));
      return (JSON.parse(String(staged)) as Array<{ draft: { suiteId: unknown } }>).map((entry) => entry.draft.suiteId);
    };
    return { svc, log, stagedSuites };
  }
  const creates = (count: number, extra: Body = {}) =>
    Array.from({ length: count }, (_, i) => ({ type: "create", draft: { title: `Draft ${i + 1}`, stepsJson: "[]" }, ...extra }));

  it("one lookup for a named suite id, and every draft still files into it", async () => {
    const { svc, stagedSuites } = setup();
    const lookup = jest.spyOn(internals(svc), "getProjectSuite").mockResolvedValue({ id: "suite-9", name: "Checkout" });
    const applied = await internals(svc).applyZyraChatOperations("p1", "u1", "s1", creates(5, { suiteId: "suite-9" }));
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(applied.testcases).toHaveLength(5);
    expect(stagedSuites()).toEqual(Array(5).fill("suite-9"));
  });

  it("one lookup for Zyra's own drafts suite; created once, reported and logged once", async () => {
    const { svc, log, stagedSuites } = setup();
    const resolve = jest.spyOn(internals(svc), "resolveOrCreateSuiteByName").mockResolvedValue({ id: "suite-z", name: "Zyra generated test cases", created: true });
    const applied = await internals(svc).applyZyraChatOperations("p1", "u1", "s1", creates(5));
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(stagedSuites()).toEqual(Array(5).fill("suite-z"));
    expect(applied.activity.filter((a) => a.title === "Created suite")).toHaveLength(1);
    expect(log.mock.calls.filter(([, , action]) => action === "zyra_suite_created")).toHaveLength(1);
  });
});
