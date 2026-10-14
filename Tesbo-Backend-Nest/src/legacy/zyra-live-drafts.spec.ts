import { LegacyService } from "./legacy.service";
import { ZyraDraftStreamParser, runWithZyraDraftSink, runWithZyraLiveBatch, zyraLiveDraftFeed, type ZyraLiveBatch } from "./zyra-draft-stream";
import { ZyraTurnTraceRecorder } from "./zyra-turn-trace";
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
 * "[Zyra] Stream Main Test Case Review UI Progressively During Generation": test cases appeared only
 * after a whole batch was generated, parsed, staged and posted. Now each draft is read out of the
 * model's stream the moment it is complete (and only then) and staged straight into the batch's one
 * review batch — the row the review panel, Edit, Discard and Save all work on.
 */

type Body = Record<string, unknown>;

function makeLegacy(extraDb: Partial<DatabaseService> = {}): LegacyService {
  const db = { query: jest.fn(() => Promise.resolve({ rows: [] })), ...extraDb } as unknown as DatabaseService;
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

// ---------------------------------------------------------------------------------------------------
// Reading drafts out of the stream
// ---------------------------------------------------------------------------------------------------

describe("ZyraDraftStreamParser — each draft the moment it is complete, and only then", () => {
  const response = JSON.stringify({
    drafts: [
      { title: "Login with a valid password", stepsJson: "[{\"action\":\"Type {password}\"}]", tags: ["a"] },
      { title: "A quote \" and a brace } inside a string", steps: [{ action: "Nested { object }" }] },
      { title: "Third" }
    ]
  });

  it("returns nothing for a draft until its closing brace arrives, whatever the chunking", () => {
    for (const size of [1, 3, 7, 50, response.length]) {
      const parser = new ZyraDraftStreamParser();
      const seen: Body[] = [];
      for (let i = 0; i < response.length; i += size) seen.push(...parser.push(response.slice(i, i + size)).map((entry) => ({ ...entry.draft, at: entry.index })));
      expect(seen.map((d) => d.title)).toEqual(["Login with a valid password", "A quote \" and a brace } inside a string", "Third"]);
      expect(seen.map((d) => d.at)).toEqual([0, 1, 2]);
    }
  });

  it("a draft is emitted as soon as it closes, before the rest of the response exists", () => {
    const parser = new ZyraDraftStreamParser();
    const cut = response.indexOf("}", response.indexOf("tags")) + 1;
    expect(parser.push(response.slice(0, cut)).map((d) => d.draft.title)).toEqual(["Login with a valid password"]);
    expect(parser.push(response.slice(cut, cut + 20))).toEqual([]);
  });

  it("a stream cut off mid-draft never yields that draft", () => {
    const parser = new ZyraDraftStreamParser();
    const truncated = response.slice(0, response.indexOf("Third") + 3);
    expect(parser.push(truncated).map((d) => d.draft.title)).toEqual(["Login with a valid password", "A quote \" and a brace } inside a string"]);
  });

  it("skips a code fence or preamble, and reads only the drafts array", () => {
    const parser = new ZyraDraftStreamParser();
    const fenced = "Here you go:\n```json\n" + JSON.stringify({ reasoning: { title: "not a draft" }, drafts: [{ title: "Only me" }] }) + "\n```";
    expect(parser.push(fenced)).toEqual([{ draft: { title: "Only me" }, index: 0 }]);
  });

  it("an element that doesn't parse still counts, so the next one keeps the index the final parse gives it", () => {
    const parser = new ZyraDraftStreamParser();
    expect(parser.push('{"drafts":[{"title": bad},{"title":"Second"}]}')).toEqual([{ draft: { title: "Second" }, index: 1 }]);
  });
});

describe("zyraLiveDraftFeed — only when someone is listening", () => {
  it("is undefined without a sink, so no stream is parsed for nobody", () => {
    expect(zyraLiveDraftFeed()).toBeUndefined();
  });

  it("hands each completed draft to the sink in scope, and a throwing sink costs only the preview", () => {
    const seen: Body[] = [];
    runWithZyraDraftSink((draft) => {
      seen.push(draft);
      throw new Error("the page went away");
    }, () => {
      const feed = zyraLiveDraftFeed()!;
      expect(() => feed('{"drafts":[{"title":"A"},{"tit')).not.toThrow();
      feed('le":"B"}]}');
    });
    expect(seen.map((d) => d.title)).toEqual(["A", "B"]);
  });
});

describe("the Anthropic stream feeds live drafts while it is read, and returns the same response", () => {
  it("each text delta reaches the feed; the assembled text is unchanged", async () => {
    const payload = JSON.stringify({ drafts: [{ title: "One" }, { title: "Two" }] });
    const events = [
      { type: "message_start", message: { usage: { input_tokens: 10 } } },
      ...payload.match(/.{1,9}/g)!.map((text) => ({ type: "content_block_delta", delta: { type: "text_delta", text } })),
      { type: "message_delta", usage: { output_tokens: 5 } }
    ];
    const encoder = new TextEncoder();
    const body = (async function* () {
      for (const event of events) yield encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
    })();
    const seen: Body[] = [];
    const read = (LegacyService as unknown as { readAnthropicStream: (r: Response, onText?: (t: string) => void) => Promise<Body> }).readAnthropicStream;
    const result = await runWithZyraDraftSink((draft) => seen.push(draft), () => read({ body } as unknown as Response, zyraLiveDraftFeed()));
    expect(seen.map((d) => d.title)).toEqual(["One", "Two"]);
    expect((result.content as Array<{ text: string }>)[0].text).toBe(payload);
    expect(result.usage).toEqual({ input_tokens: 10, output_tokens: 5 });
  });
});

describe("the OpenAI stream is read into the plain response's shape", () => {
  it("joins the deltas, feeds them live, and keeps the final usage", async () => {
    const payload = JSON.stringify({ drafts: [{ title: "One" }] });
    const encoder = new TextEncoder();
    const lines = [
      ...payload.match(/.{1,5}/g)!.map((content) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}`),
      `data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 } })}`,
      "data: [DONE]"
    ];
    const body = (async function* () {
      for (const line of lines) yield encoder.encode(`${line}\n\n`);
    })();
    const seen: Body[] = [];
    const read = (LegacyService as unknown as { readOpenAiStream: (r: Response, onText?: (t: string) => void) => Promise<Body> }).readOpenAiStream;
    const result = await runWithZyraDraftSink((draft) => seen.push(draft), () => read({ body } as unknown as Response, zyraLiveDraftFeed()));
    expect(seen.map((d) => d.title)).toEqual(["One"]);
    expect((result.choices as Array<{ message: { content: string } }>)[0].message.content).toBe(payload);
    expect(result.usage).toEqual({ prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 });
  });
});

describe("a turn's live drafts go to the watching client and never into its trace", () => {
  it("forwards a draft, records no step for it", () => {
    const forwarded: unknown[][] = [];
    const recorder = new ZyraTurnTraceRecorder((...args) => forwarded.push(args));
    recorder.onStage("generating", { requestedCount: 5 });
    recorder.onStage("draft", { row: { title: "A" } }, "draft");
    expect(forwarded).toContainEqual(["draft", { row: { title: "A" } }, "draft"]);
    expect(recorder.finish().steps.map((step) => step.stage)).toEqual(["generating"]);
    expect(recorder.live).toBe(true);
    expect(new ZyraTurnTraceRecorder().live).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------------
// The live review batch
// ---------------------------------------------------------------------------------------------------

type Internals = {
  createZyraLiveBatch: (p: Body) => ZyraLiveBatch;
  applyZyraChatOperations: (projectId: string, userId: string | null, sessionId: string, operations: Body[], options?: Body) => Promise<Body>;
  generateZyraChatTestcasesWithAi: (params: Body) => Promise<Body>;
  generateZyraWithProvider: (params: Body) => Promise<Body>;
  zyraSimilarityFeedbackForDrafts: (...args: unknown[]) => Promise<Body>;
  recordZyraTokenUsage: (...args: unknown[]) => Promise<void>;
  rememberZyraTurn: (...args: unknown[]) => Promise<void>;
  recordZyraPendingReviewRequest: (...args: unknown[]) => Promise<void>;
  resolveZyraActor: (...args: unknown[]) => Promise<string>;
  zyraProjectCapabilities: (...args: unknown[]) => Promise<Body>;
  resolveOrCreateSuiteByName: (...args: unknown[]) => Promise<Body>;
  zyraMoveBreakdown: (...args: unknown[]) => Promise<unknown[]>;
  logProjectActivity: (...args: unknown[]) => Promise<void>;
};
const internals = (svc: LegacyService) => svc as unknown as Internals;

/*
 * One ai_generation_requests row behind a mutex-free stand-in: INSERT creates it, the append path's
 * SELECT … FOR UPDATE reads it and its UPDATE writes it, as the real statements do.
 */
function makeReviewDb(initial: { status?: string; activity?: Body[] } = {}) {
  const row = { id: "req-1", task_status: initial.status ?? "in_review", generated_payload: [] as Body[], activity_log: initial.activity ?? [], saved_count: 0 };
  let created = false;
  const query = jest.fn(async (sql: string, params: unknown[] = []) => {
    if (sql.includes("INSERT INTO ai_generation_requests")) {
      created = true;
      row.generated_payload = JSON.parse(String(params[4]));
      return { rows: [{ id: row.id }] };
    }
    if (sql.includes("FROM ai_generation_requests") && sql.includes("FOR UPDATE")) return { rows: created || initial.status ? [row] : [] };
    if (sql.includes("UPDATE ai_generation_requests") && sql.includes("generated_payload = $3")) {
      row.generated_payload = JSON.parse(String(params[2]));
      row.task_status = "in_review";
      return { rows: [] };
    }
    if (sql.includes("SELECT generated_payload, saved_count")) return { rows: [row] };
    return { rows: [] };
  });
  const svc = makeLegacy({ query, transaction: (fn: (client: { query: typeof query }) => unknown) => fn({ query }) } as unknown as Partial<DatabaseService>);
  jest.spyOn(internals(svc), "resolveZyraActor").mockResolvedValue("actor-1");
  jest.spyOn(internals(svc), "zyraProjectCapabilities").mockResolvedValue({ generation: true, knowledgeBase: true, testcaseStorage: true, suiteOperations: true });
  const suiteLookup = jest.spyOn(internals(svc), "resolveOrCreateSuiteByName").mockResolvedValue({ id: "suite-z", name: "Zyra generated test cases", created: false });
  jest.spyOn(internals(svc), "zyraMoveBreakdown").mockResolvedValue([]);
  jest.spyOn(internals(svc), "logProjectActivity").mockResolvedValue(undefined);
  const pending = jest.spyOn(internals(svc), "recordZyraPendingReviewRequest").mockResolvedValue(undefined);
  return { svc, row, query, suiteLookup, pending };
}

const createOp = (title: string): Body => ({ type: "create", draft: { title, stepsJson: "[]", priority: "P2" }, reason: "Generated by AI from Zyra chat context." });

describe("createZyraLiveBatch — one review batch, filled draft by draft", () => {
  it("the first draft creates the batch and announces it once; every later one is appended to it, in order", async () => {
    const { svc, row, suiteLookup } = makeReviewDb();
    const emitted: Body[] = [];
    const announced: string[] = [];
    const live = internals(svc).createZyraLiveBatch({
      projectId: "p1", userId: "u1", sessionId: "s1",
      emit: (event: Body) => emitted.push(event),
      onRowCreated: async (id: string) => { announced.push(id); }
    });
    live.total = 3;
    // Fired together, as parallel pieces do — staged one at a time, in the order they arrived.
    const rows = await Promise.all([live.stage(createOp("A"), 1), live.stage(createOp("B"), 2), live.stage(createOp("C"), null)]);
    expect(rows.map((r) => r?.draftIndex)).toEqual([0, 1, 2]);
    expect(row.generated_payload.map((entry) => (entry.draft as Body).title)).toEqual(["A", "B", "C"]);
    expect(announced).toEqual(["req-1"]);
    expect(emitted.map((e) => [e.reviewRequestId, e.staged, e.total, (e.row as Body).title])).toEqual([["req-1", 1, 3, "A"], ["req-1", 2, 3, "B"], ["req-1", 3, 3, "C"]]);
    expect(live.reviewRequestId()).toBe("req-1");
    expect(live.stagedScenarios()).toEqual([1, 2]);
    // The batch's suite is looked up once for all its drafts.
    expect(suiteLookup).toHaveBeenCalledTimes(1);
  });

  it("a batch the user closed with 'Discard all' takes nothing more", async () => {
    const { svc, row } = makeReviewDb({ status: "done", activity: [{ title: "Closed task" }] });
    const live = internals(svc).createZyraLiveBatch({ projectId: "p1", userId: "u1", sessionId: "s1", emit: () => undefined });
    // Pretend the batch already exists (it was closed after its first drafts).
    const stage = (title: string) => internals(svc).applyZyraChatOperations("p1", "u1", "s1", [createOp(title)], { appendTo: "req-1" });
    expect((await stage("Late draft")).appendClosed).toBe(true);
    expect(row.generated_payload).toEqual([]);
    expect(await live.stage(createOp("first"), null)).not.toBeNull(); // a fresh live batch still creates its own row
  });

  it("a batch emptied by a Save while generating is reopened for the drafts still coming", async () => {
    const { svc, row, pending } = makeReviewDb({ status: "done", activity: [{ title: "Saved testcase drafts" }] });
    const applied = await internals(svc).applyZyraChatOperations("p1", "u1", "s1", [createOp("Still coming")], { appendTo: "req-1" });
    expect(applied.appendClosed).toBe(false);
    expect((applied.testcases as Body[])[0]).toMatchObject({ draftIndex: 0, reviewRequestId: "req-1" });
    expect(row.task_status).toBe("in_review");
    expect(pending).toHaveBeenCalledWith("s1", "req-1");
  });

  it("a draft that fails to stage costs only itself", async () => {
    const { svc } = makeReviewDb();
    const live = internals(svc).createZyraLiveBatch({ projectId: "p1", userId: "u1", sessionId: "s1", emit: () => undefined });
    const apply = jest.spyOn(internals(svc), "applyZyraChatOperations");
    apply.mockRejectedValueOnce(new Error("connection reset"));
    expect(await live.stage(createOp("Lost"), null)).toBeNull();
    apply.mockRestore();
    expect(await live.stage(createOp("Kept"), null)).toMatchObject({ title: "Kept", draftIndex: 0 });
  });
});

describe("generateZyraChatTestcasesWithAi with a live batch — staged as written, never twice", () => {
  const draftJson = (title: string, scenario?: number) => ({ title, stepsJson: "[]", priority: "P2", ...(scenario ? { scenario } : {}) });

  function setup(opts: { similar?: (title: string) => boolean } = {}) {
    const { svc, row } = makeReviewDb();
    jest.spyOn(internals(svc), "recordZyraTokenUsage").mockResolvedValue(undefined);
    jest.spyOn(internals(svc), "rememberZyraTurn").mockResolvedValue(undefined);
    jest.spyOn(internals(svc), "zyraSimilarityFeedbackForDrafts").mockImplementation(async (_p: unknown, drafts: unknown) => {
      const list = drafts as Body[];
      return { feedback: null, matchesByIndex: list.map((d) => (opts.similar?.(String(d.title)) ? { testcaseId: "tc-old", cosineSimilarity: 0.9 } : null)) };
    });
    // The provider streams three drafts into whatever sink is listening, then returns the full parse.
    const provider = jest.spyOn(internals(svc), "generateZyraWithProvider").mockImplementation(async () => {
      const { zyraLiveDraftFeed: feed } = await import("./zyra-draft-stream");
      const text = JSON.stringify({ drafts: [draftJson("One", 1), draftJson("Two", 2), draftJson("Three", 3)] });
      feed()?.(text);
      return { drafts: [draftJson("One", 1), draftJson("Two", 2), draftJson("Three", 3)], usage: { input: 1, output: 1, total: 2, cached: 0 } };
    });
    const live = internals(svc).createZyraLiveBatch({ projectId: "p1", userId: "u1", sessionId: "s1", emit: () => undefined });
    const generate = () => runWithZyraLiveBatch(live, () => internals(svc).generateZyraChatTestcasesWithAi({
      projectId: "p1", userId: "u1", provider: "anthropic", model: "m", key: { api_key: "k" }, message: "Generate", knowledge: [], existingTestcases: [],
      jiraIssueKeys: [], requestedCount: 3, suites: [], jira: [], bugs: []
    }));
    return { svc, row, live, generate, provider };
  }

  it("every streamed draft is staged as it arrives, and the final parse adds nothing twice", async () => {
    const { svc, row, generate } = setup();
    const decision = await generate();
    expect(row.generated_payload.map((entry) => (entry.draft as Body).title)).toEqual(["One", "Two", "Three"]);
    expect(decision.liveStaged).toMatchObject({ reviewRequestId: "req-1", skip: [0, 1, 2] });
    const applied = await internals(svc).applyZyraChatOperations("p1", "u1", "s1", decision.operations as Body[], { live: decision.liveStaged });
    // The batch as it stands — one copy of each.
    expect((applied.testcases as Body[]).map((r) => r.title)).toEqual(["One", "Two", "Three"]);
    expect(row.generated_payload).toHaveLength(3);
  });

  it("a draft resembling an existing test case is held back and staged only with the final result", async () => {
    const { svc, row, generate } = setup({ similar: (title) => title === "Two" });
    const decision = await generate();
    // Held while the rest streams.
    expect(row.generated_payload.map((entry) => (entry.draft as Body).title)).toEqual(["One", "Three"]);
    expect(decision.liveStaged).toMatchObject({ skip: [0, 2] });
    await internals(svc).applyZyraChatOperations("p1", "u1", "s1", decision.operations as Body[], { live: decision.liveStaged });
    expect(row.generated_payload.map((entry) => ((entry.draft ?? entry.fields) as Body).title)).toEqual(["One", "Three", "Two"]);
  });

  it("without a live batch, nothing is streamed or staged early — the batch is staged whole, as before", async () => {
    const { svc, row } = setup();
    const decision = await internals(svc).generateZyraChatTestcasesWithAi({
      projectId: "p1", userId: "u1", provider: "anthropic", model: "m", key: { api_key: "k" }, message: "Generate", knowledge: [], existingTestcases: [],
      jiraIssueKeys: [], requestedCount: 3, suites: [], jira: [], bugs: []
    });
    expect(decision.liveStaged).toBeUndefined();
    expect(row.generated_payload).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------
// A NUL in model output must never reach the database
// ---------------------------------------------------------------------------------------------------

describe("model output with a NUL character is stored without it", () => {
  // 2026-10-13: a 100-draft batch failed at staging with "unsupported Unicode escape sequence" —
  // PostgreSQL rejects \u0000 in JSONB, and a null-byte input test had one in its test data.
  const strip = (LegacyService as unknown as { stripZyraNul: (text: string) => string }).stripZyraNul;
  const normalize = (svc: LegacyService, raw: string) =>
    (svc as unknown as { normalizeAiDrafts: (raw: unknown, count: number) => Body[] }).normalizeAiDrafts(raw, 10);

  it("drops a \\u0000 escape and a raw NUL, and leaves an escaped backslash's literal text alone", () => {
    expect(strip(String.raw`{"testData":"abc\u0000def"}`)).toBe(String.raw`{"testData":"abcdef"}`);
    expect(strip(String.raw`{"testData":"abc\U0000def"}`)).toBe(String.raw`{"testData":"abcdef"}`);
    expect(strip(`plain\u0000text`)).toBe("plaintext");
    // \\u0000 is a backslash followed by the text "u0000" — not a NUL, so it stays.
    expect(strip(String.raw`{"note":"path C:\\u0000"}`)).toBe(String.raw`{"note":"path C:\\u0000"}`);
    // An odd run of backslashes ends in a real escape: \\\u0000 is a backslash, then a NUL.
    expect(strip(String.raw`{"note":"\\\u0000x"}`)).toBe(String.raw`{"note":"\\x"}`);
  });

  it("a generated draft with a null-byte test value parses, and serializes to JSON PostgreSQL accepts", () => {
    const svc = makeLegacy();
    const raw = String.raw`{"drafts":[{"title":"Reject a username containing a null byte","stepsJson":"[{\"action\":\"Type admin\u0000x\"}]","testData":"username: admin\u0000x","priority":"P1"}]}`;
    const [draft] = normalize(svc, raw);
    expect(draft.title).toBe("Reject a username containing a null byte");
    expect(draft.testData).toBe("username: adminx");
    expect(JSON.stringify(draft)).not.toMatch(/\\u0000/);
    expect(JSON.stringify(draft)).not.toContain("\u0000");
  });

  // The second failure the same day: the NUL was inside a STEP. stepsJson is JSON inside a string, so
  // its \u0000 is `\\u0000` in the reply — text, not a NUL, at the outer level — and only became a NUL
  // when staging parsed the steps (safeSteps) into the JSONB payload.
  const safeSteps = (svc: LegacyService, value: unknown) => (svc as unknown as { safeSteps: (v: unknown) => unknown[] }).safeSteps(value);
  const reply = String.raw`{"drafts":[{"title":"Reject a null byte in the username field","stepsJson":"[{\"action\":\"Type admin\\u0000x in Username\",\"expectedResult\":\"Rejected\\u0000\"}]","testData":"","priority":"P1"}]}`;

  it("a NUL inside a draft's steps is gone before staging ever parses them", () => {
    const svc = makeLegacy();
    const [draft] = normalize(svc, reply);
    expect(String(draft.stepsJson)).not.toMatch(/\\u0000/);
    const steps = safeSteps(svc, draft.stepsJson);
    expect(steps).toEqual([{ action: "Type adminx in Username", expectedResult: "Rejected" }]);
    // What staging writes to JSONB — the exact payload that failed.
    expect(JSON.stringify({ stepsJson: steps })).not.toMatch(/\\u0000/);
  });

  it("safeSteps drops a NUL for every caller, not only Zyra (the MCP create tool funnels through it too)", () => {
    const svc = makeLegacy();
    expect(safeSteps(svc, String.raw`[{"action":"a\u0000b","expected":"c"}]`)).toEqual([{ action: "ab", expected: "c", expectedResult: "c" }]);
    expect(safeSteps(svc, [{ action: "x\u0000y" }])).toEqual([{ action: "xy", expectedResult: "" }]);
  });

  it("a parsed router or planner reply has no NUL at any depth", () => {
    const svc = makeLegacy();
    const parse = (raw: string) => (svc as unknown as { parseModelJson: (raw: string) => Body | null }).parseModelJson(raw);
    const parsed = parse(String.raw`{"reply":"ok\u0000","operations":[{"type":"create","draft":{"title":"t","stepsJson":"[{\"action\":\"a\\u0000\"}]"}}]}`)!;
    expect(parsed.reply).toBe("ok");
    expect(JSON.stringify(parsed)).not.toMatch(/\\u0000/);
  });
});
