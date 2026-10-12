import { BadRequestException, ConflictException } from "@nestjs/common";
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
 * "[Zyra] Warn Users About the 100-Test-Case Limit When Generating for Multiple Tickets".
 *
 * A create naming many tickets was planned in one call capped at 100 scenarios for all of them, so
 * ~30 tickets came back as ~98 test cases and the reply said "all N scenarios are now covered". Above
 * an estimate of 60 (tickets × the project's per-task count) Zyra now asks first, with clickable
 * options; "all in batches" runs a plan that pages one ticket at a time and accounts for every ticket.
 */

type Body = Record<string, unknown>;
type Query = jest.Mock<Promise<{ rows: Body[] }>, [string, unknown[]?]>;

function makeLegacy(query: Query = jest.fn(() => Promise.resolve({ rows: [] })) as unknown as Query, extraDb: Partial<DatabaseService> = {}): LegacyService {
  const db = { query, ...extraDb } as unknown as DatabaseService;
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

type Options = { kind: string; choices: Array<{ id: string; label: string; description?: string; message?: string }>; answeredId?: string | null; context?: Body };
type Decision = { reply: string; actionType: string; operations: unknown[]; options?: Options };
type Scope = { ticketKeys: string[] | null; ticketCount: number; perTicket: number } | null;

type Internals = {
  chatTestcasePlan: (message: string, range: string, routed?: Body) => { requestedCount: number; testcaseRange?: string };
  zyraTicketScope: (projectId: string, message: string, plan: { requestedCount: number; testcaseRange?: string }, confidence?: string) => Promise<Scope>;
  zyraTicketScopeQuestion: (message: string, scope: NonNullable<Scope>, exhaustive: boolean, routedSuite: Body | null) => Decision;
  zyraTicketGroupDecision: (projectId: string, context: Body) => Promise<Decision>;
  zyraResolveChoice: (projectId: string, sessionId: string, rawChoice: unknown, message: string) => Promise<{ options: Options; choice: { id: string; message?: string } } | null>;
  zyraPlanScopedTicketRound: (params: Body) => Promise<{ scenarios: string[]; cursor: string | null; hasMore: boolean; tickets: number; emptyKeys?: string[] }>;
  generateZyraChatCreateDecision: (params: Body) => Promise<Decision>;
  continueZyraChatPlanInLanguage: (projectId: string, userId: string | null, sessionId: string, planId: string) => Promise<void>;
  zyraDecisionForChoice: (turn: Body, answer: { options: Options; choice: { id: string; label: string; message?: string } }, onStage?: unknown) => Promise<Decision>;
  buildZyraChatDecision: (...args: unknown[]) => Promise<Decision>;
  zyraProjectCapabilities: (projectId: string) => Promise<{ knowledgeBase: boolean }>;
  zyraSessionLanguage: (projectId: string, sessionId: string) => Promise<string>;
  startZyraChatPlan: (params: Body) => Promise<Decision>;
  generateZyraChatTestcasesWithAi: (params: Body) => Promise<Decision>;
  planZyraChatScenarios: (params: Body) => Promise<string[]>;
  existingTestcaseSnapshot: (...args: unknown[]) => Promise<unknown[]>;
  postZyraPlanMessage: (...args: unknown[]) => Promise<void>;
};

const internals = (svc: LegacyService) => svc as unknown as Internals;
const statics = LegacyService as unknown as {
  zyraPublicOptions: (raw: unknown) => Body | null;
  zyraTicketPlanSummary: (plan: Body, final: boolean) => string;
  zyraBatchTicketKeys: (batch: string[]) => string[];
};

const keys = (count: number) => Array.from({ length: count }, (_, i) => `QAB-${i + 1}`);

// ---------------------------------------------------------------------------------------------------
// When to ask
// ---------------------------------------------------------------------------------------------------

describe("zyraTicketScope — asks only above an estimate of 60 test cases", () => {
  const scopeFor = async (message: string, range: string, opts: { synced?: number; knowledgeBase?: boolean; confidence?: string; prefixes?: string[] } = {}) => {
    const query = jest.fn((sql: string, params: unknown[] = []) => {
      // Prefixes this project has synced tickets under — QAB unless a test says otherwise.
      if (sql.includes("AS prefix")) return Promise.resolve({ rows: (opts.prefixes ?? ["QAB"]).filter((p) => (params[1] as string[]).includes(p)).map((prefix) => ({ prefix })) });
      return Promise.resolve({ rows: [{ count: String(opts.synced ?? 0) }] });
    }) as unknown as Query;
    const svc = makeLegacy(query);
    jest.spyOn(internals(svc), "zyraProjectCapabilities").mockResolvedValue({ knowledgeBase: opts.knowledgeBase ?? true });
    const plan = internals(svc).chatTestcasePlan(message, range);
    return internals(svc).zyraTicketScope("p1", message, plan, opts.confidence);
  };

  it("asks for two named tickets at 50 per ticket (100 > 60)", async () => {
    expect(await scopeFor("Generate test cases for QAB-1 and QAB-2", "30-50")).toEqual({ ticketKeys: ["QAB-1", "QAB-2"], ticketCount: 2, perTicket: 50 });
  });

  it("does not ask for two tickets at 30 per ticket — 60 is not above the threshold", async () => {
    expect(await scopeFor("Generate test cases for QAB-1 and QAB-2", "10-30")).toBeNull();
  });

  it("at 10 per ticket asks from 7 tickets, not 6", async () => {
    expect(await scopeFor(`Generate test cases for ${keys(6).join(", ")}`, "1-10")).toBeNull();
    expect((await scopeFor(`Generate test cases for ${keys(7).join(", ")}`, "1-10"))?.ticketCount).toBe(7);
  });

  it("never asks about a single ticket, however large its budget", async () => {
    expect(await scopeFor("Generate all possible test cases for QAB-1", "30-50")).toBeNull();
  });

  it("an explicit count is the user's own budget and is never second-guessed", async () => {
    expect(await scopeFor(`Generate 20 test cases for ${keys(10).join(", ")}`, "30-50")).toBeNull();
  });

  it("does not count key-shaped words that are not this project's tickets", async () => {
    expect(await scopeFor("Generate test cases for UTF-8 and ISO-8859 encoding", "30-50")).toBeNull();
    // Mixed: only the real tickets count — here one, so nothing to ask.
    expect(await scopeFor("Generate test cases for QAB-1 with UTF-8 input", "30-50")).toBeNull();
    // An unsynced key under a known prefix still counts; it is reported as not synced later.
    expect((await scopeFor("Generate test cases for QAB-1 and QAB-999", "30-50"))?.ticketKeys).toEqual(["QAB-1", "QAB-999"]);
  });

  it("counts every synced ticket for 'all the tickets'", async () => {
    expect(await scopeFor("Generate test cases for all the Jira tickets", "30-50", { synced: 12 })).toEqual({ ticketKeys: null, ticketCount: 12, perTicket: 50 });
  });

  it("does not read 'the login requirement' as every ticket there is", async () => {
    expect(await scopeFor("Generate test cases for the login requirement", "30-50", { synced: 500 })).toBeNull();
  });

  it("does not ask about all tickets when the knowledge base is off, or a search matched strongly", async () => {
    expect(await scopeFor("Generate test cases for all the tickets", "30-50", { synced: 12, knowledgeBase: false })).toBeNull();
    expect(await scopeFor("Generate test cases for all the tickets", "30-50", { synced: 12, confidence: "strong" })).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------------
// The question and its options
// ---------------------------------------------------------------------------------------------------

describe("zyraTicketScopeQuestion — the two options, and what the client sees of them", () => {
  const question = () =>
    internals(makeLegacy()).zyraTicketScopeQuestion("Generate test cases for QAB-1 … QAB-30", { ticketKeys: keys(30), ticketCount: 30, perTicket: 50 }, false, { id: "s1", name: "Login" });

  it("is an answer that writes nothing, says why, and offers both options", () => {
    const decision = question();
    expect(decision.actionType).toBe("answer");
    expect(decision.operations).toEqual([]);
    expect(decision.reply).toMatch(/30 tickets/);
    expect(decision.reply).toMatch(/roughly 1500 test cases/);
    expect(decision.options?.choices.map((c) => c.label)).toEqual(["Generate in smaller batches", "Generate all tickets in batches"]);
    expect(decision.options?.choices[0].description).toMatch(/1–2 tickets at a time/);
  });

  it("keeps what acting on it needs server-side only", () => {
    const options = question().options!;
    expect(options.context).toMatchObject({ ticketKeys: keys(30), perTicket: 50, routedSuite: { id: "s1", name: "Login" } });
    const visible = statics.zyraPublicOptions(options);
    expect(visible).toEqual({ kind: "ticket_scope", choices: options.choices, answeredId: null });
    expect(JSON.stringify(visible)).not.toContain("originalMessage");
  });

  it("a message without options shows none", () => {
    expect(statics.zyraPublicOptions(null)).toBeNull();
  });
});

describe("zyraTicketGroupDecision — 'smaller batches' offers groups that never trip the question again", () => {
  it("one ticket per group at 50 per ticket, two at 30, with ready-to-send requests", async () => {
    const svc = makeLegacy();
    const fifty = await internals(svc).zyraTicketGroupDecision("p1", { ticketKeys: ["QAB-1", "QAB-2", "QAB-3"], perTicket: 50, exhaustive: true });
    expect(fifty.options?.choices.map((c) => c.label)).toEqual(["QAB-1", "QAB-2", "QAB-3"]);
    expect(fifty.options?.choices[0].message).toBe("Generate all possible test cases for QAB-1");
    const thirty = await internals(svc).zyraTicketGroupDecision("p1", { ticketKeys: ["QAB-1", "QAB-2", "QAB-3"], perTicket: 30, exhaustive: false });
    expect(thirty.options?.choices.map((c) => c.label)).toEqual(["QAB-1, QAB-2", "QAB-3"]);
    expect(thirty.options?.choices[0].message).toBe("Generate test cases for QAB-1 and QAB-2");
  });

  it("lists at most 10 groups and says how many there are", async () => {
    const decision = await internals(makeLegacy()).zyraTicketGroupDecision("p1", { ticketKeys: keys(30), perTicket: 50 });
    expect(decision.options?.choices).toHaveLength(10);
    expect(decision.reply).toMatch(/Showing the first 10 of 30 groups/);
  });

  it("with nothing synced for 'all tickets', says so rather than offering an empty list", async () => {
    const decision = await internals(makeLegacy()).zyraTicketGroupDecision("p1", { ticketKeys: null, perTicket: 50 });
    expect(decision.options).toBeUndefined();
    expect(decision.reply).toMatch(/None of these tickets is synced/);
  });
});

// ---------------------------------------------------------------------------------------------------
// Answering
// ---------------------------------------------------------------------------------------------------

describe("zyraResolveChoice — a click or a typed answer, acted on once", () => {
  const MESSAGE_ID = "11111111-1111-4111-8111-111111111111";
  const OTHER_ID = "22222222-2222-4222-8222-222222222222";
  const open = (): Options => ({
    kind: "ticket_scope",
    choices: [{ id: "smaller", label: "Generate in smaller batches" }, { id: "all", label: "Generate all tickets in batches" }],
    answeredId: null,
    context: { ticketKeys: ["QAB-1", "QAB-2"] }
  });
  function setup(latest: { id: string; options: Options | null } | null, claimSucceeds = true) {
    const query = jest.fn((sql: string, params: unknown[] = []) => {
      if (sql.startsWith("SELECT id, options")) return Promise.resolve({ rows: latest ? [latest] : [] });
      if (sql.includes("UPDATE zyra_chat_messages SET options")) {
        return Promise.resolve({ rows: claimSucceeds && latest?.options ? [{ options: { ...latest.options, answeredId: params[1] } }] : [] });
      }
      return Promise.resolve({ rows: [] });
    }) as unknown as Query;
    return { svc: makeLegacy(query), query };
  }
  const resolve = (svc: LegacyService, raw: unknown, message = "x") => internals(svc).zyraResolveChoice("p1", "s1", raw, message);

  it("a click on the latest open question resolves and marks it answered", async () => {
    const { svc, query } = setup({ id: MESSAGE_ID, options: open() });
    const result = await resolve(svc, { messageId: MESSAGE_ID, optionId: "all" });
    expect(result?.choice.id).toBe("all");
    expect(result?.options.answeredId).toBe("all");
    const update = query.mock.calls.find(([sql]) => sql.includes("UPDATE zyra_chat_messages SET options"))!;
    expect(update[0]).toMatch(/options->>'answeredId' IS NULL/);
  });

  it("a typed number or the exact label answers it; anything else is an ordinary message", async () => {
    expect((await resolve(setup({ id: MESSAGE_ID, options: open() }).svc, undefined, "2"))?.choice.id).toBe("all");
    expect((await resolve(setup({ id: MESSAGE_ID, options: open() }).svc, undefined, "generate in smaller batches."))?.choice.id).toBe("smaller");
    expect(await resolve(setup({ id: MESSAGE_ID, options: open() }).svc, undefined, "Generate tests for login")).toBeNull();
    expect(await resolve(setup({ id: MESSAGE_ID, options: open() }).svc, undefined, "3")).toBeNull();
  });

  it("a typed answer never reopens an answered question, and no question means nothing to answer", async () => {
    expect(await resolve(setup({ id: MESSAGE_ID, options: { ...open(), answeredId: "all" } }).svc, undefined, "1")).toBeNull();
    expect(await resolve(setup({ id: MESSAGE_ID, options: null }).svc, undefined, "1")).toBeNull();
  });

  it("refuses a click on a question that is not the latest, or already answered (409)", async () => {
    await expect(resolve(setup({ id: MESSAGE_ID, options: open() }).svc, { messageId: OTHER_ID, optionId: "all" })).rejects.toBeInstanceOf(ConflictException);
    await expect(resolve(setup({ id: MESSAGE_ID, options: { ...open(), answeredId: "smaller" } }).svc, { messageId: MESSAGE_ID, optionId: "all" })).rejects.toBeInstanceOf(ConflictException);
    // Lost the race between the read and the write: a second click on the same option.
    await expect(resolve(setup({ id: MESSAGE_ID, options: open() }, false).svc, { messageId: MESSAGE_ID, optionId: "all" })).rejects.toBeInstanceOf(ConflictException);
  });

  it("refuses a malformed choice or an unknown option (400)", async () => {
    const { svc } = setup({ id: MESSAGE_ID, options: open() });
    await expect(resolve(svc, { messageId: "not-a-uuid", optionId: "all" })).rejects.toBeInstanceOf(BadRequestException);
    await expect(resolve(svc, { messageId: MESSAGE_ID })).rejects.toBeInstanceOf(BadRequestException);
    await expect(resolve(svc, "all")).rejects.toBeInstanceOf(BadRequestException);
    await expect(resolve(svc, { messageId: MESSAGE_ID, optionId: "everything" })).rejects.toBeInstanceOf(BadRequestException);
  });
});

// ---------------------------------------------------------------------------------------------------
// The create path
// ---------------------------------------------------------------------------------------------------

describe("generateZyraChatCreateDecision — asks before generating, and plans once answered", () => {
  function setup() {
    // The project has synced QAB tickets, so QAB keys count as tickets (see zyraTicketScope).
    const svc = makeLegacy(jest.fn((sql: string) => Promise.resolve({ rows: sql.includes("AS prefix") ? [{ prefix: "QAB" }] : [] })) as unknown as Query);
    jest.spyOn(internals(svc), "zyraSessionLanguage").mockResolvedValue("en");
    jest.spyOn(internals(svc), "zyraProjectCapabilities").mockResolvedValue({ knowledgeBase: true });
    const plan = jest.spyOn(internals(svc), "startZyraChatPlan").mockResolvedValue({ reply: "planned", actionType: "create", operations: [] });
    const single = jest.spyOn(internals(svc), "generateZyraChatTestcasesWithAi").mockResolvedValue({ reply: "generated", actionType: "create", operations: [] });
    return { svc, plan, single };
  }
  const create = (svc: LegacyService, message: string, routedCount?: Body) =>
    internals(svc).generateZyraChatCreateDecision({
      projectId: "p1", userId: "u1", sessionId: "s1", provider: "openai", model: "m", key: {}, message, knowledge: [], existingTestcases: [],
      jiraIssueKeys: [], projectTestcaseRange: "30-50", suites: [], routedSuite: null, routedCount
    });

  it("many tickets: returns the question and generates nothing", async () => {
    const { svc, plan, single } = setup();
    const decision = await create(svc, `Generate test cases for ${keys(10).join(", ")}`);
    expect(decision.options?.kind).toBe("ticket_scope");
    expect(plan).not.toHaveBeenCalled();
    expect(single).not.toHaveBeenCalled();
  });

  it("answered 'all in batches': a ticket-scoped plan, not the question again", async () => {
    const { svc, plan } = setup();
    await create(svc, `Generate test cases for ${keys(10).join(", ")}`, { exhaustive: true, ticketScope: { ticketKeys: keys(10), perTicket: 50 } });
    expect(plan).toHaveBeenCalledTimes(1);
    expect(plan.mock.calls[0][0]).toMatchObject({ ticketScope: { ticketKeys: keys(10), perTicket: 50 } });
  });

  it("answered 'all in batches' for all the tickets: the existing paged plan, not the question again", async () => {
    const { svc, plan } = setup();
    const decision = await create(svc, "Generate all possible test cases for all the Jira tickets.", { exhaustive: true, scopeDecided: true });
    expect(decision.options).toBeUndefined();
    expect(plan).toHaveBeenCalledTimes(1);
    expect((plan.mock.calls[0][0] as Body).ticketScope).toBeUndefined();
  });

  it("one ticket: unchanged — generated straight away", async () => {
    const { svc, single } = setup();
    const decision = await create(svc, "Generate test cases for QAB-1");
    expect(decision.options).toBeUndefined();
    expect(single).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------------------------------
// Ticket-scoped planning
// ---------------------------------------------------------------------------------------------------

describe("zyraPlanScopedTicketRound — one ticket per round, each scenario labelled with its key", () => {
  function setup(rows: Body[], planned: string[]) {
    const query = jest.fn(() => Promise.resolve({ rows })) as unknown as Query;
    const svc = makeLegacy(query);
    const planner = jest.spyOn(internals(svc), "planZyraChatScenarios").mockResolvedValue(planned);
    jest.spyOn(internals(svc), "existingTestcaseSnapshot").mockResolvedValue([]);
    return { svc, query, planner };
  }
  const round = (svc: LegacyService, cursor: string | null) =>
    internals(svc).zyraPlanScopedTicketRound({ projectId: "p1", provider: "openai", model: "m", key: {}, message: "all of them", cursor, scope: { ticketKeys: ["QAB-1", "QAB-2"], perTicket: 30 } });

  it("reads only the selected tickets after the cursor, one at a time, with that ticket's own budget", async () => {
    const { svc, query, planner } = setup([{ id: "d1", title: "QAB-1: Login", content_text: "Body", ticket_key: "QAB-1" }], ["Valid login", "Locked account"]);
    const result = await round(svc, "d0");
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/= ANY\(\$2::text\[\]\)/);
    expect(sql).toMatch(/LIMIT 1/);
    expect(params).toEqual(["p1", ["QAB-1", "QAB-2"], "d0"]);
    const plannerCall = planner.mock.calls[0][0] as { maxScenarios: number; message: string };
    expect(plannerCall.maxScenarios).toBe(30);
    expect(plannerCall.message).toMatch(/for QAB-1 only/);
    expect(result).toEqual({ scenarios: ["[QAB-1] Valid login", "[QAB-1] Locked account"], cursor: "d1", hasMore: true, tickets: 1, emptyKeys: [] });
  });

  it("a ticket that plans nothing is named, not silently dropped", async () => {
    const { svc } = setup([{ id: "d2", title: "QAB-2: Logout", content_text: "", ticket_key: "QAB-2" }], []);
    expect((await round(svc, "d1")).emptyKeys).toEqual(["QAB-2"]);
  });

  it("past the last ticket the plan ends, with no planner call", async () => {
    const { svc, planner } = setup([], ["unused"]);
    expect(await round(svc, "d9")).toEqual({ scenarios: [], cursor: "d9", hasMore: false, tickets: 0, emptyKeys: [] });
    expect(planner).not.toHaveBeenCalled();
  });

  it("a batch's tickets are read back from those labels", () => {
    expect(statics.zyraBatchTicketKeys(["[QAB-1] a", "[qab-1] b", "[QAB-2] c", "no label"])).toEqual(["QAB-1", "QAB-2"]);
  });
});

describe("zyraTicketPlanSummary — every ticket accounted for", () => {
  it("progress while running", () => {
    expect(statics.zyraTicketPlanSummary({ ticketsTotal: 30, ticketsSynced: 28, ticketsDone: 5 }, false)).toMatch(/Tickets planned: 5 of 28/);
  });

  it("at the end: all processed, or which were not and why", () => {
    expect(statics.zyraTicketPlanSummary({ ticketsTotal: 3, unprocessedTickets: [] }, true)).toMatch(/All 3 ticket\(s\) processed/);
    const partial = statics.zyraTicketPlanSummary({
      ticketsTotal: 4,
      unprocessedTickets: [{ key: "QAB-3", reason: "not_synced" }, { key: "QAB-4", reason: "no_scenarios" }]
    }, true);
    expect(partial).toMatch(/2 of 4 ticket\(s\) got test cases/);
    expect(partial).toMatch(/- QAB-3 — not synced to Tesbo yet/);
    expect(partial).toMatch(/- QAB-4 — no new scenarios/);
  });

  it("lists at most 50 by name and counts the rest", () => {
    const unprocessed = keys(60).map((key) => ({ key, reason: "no_scenarios" }));
    const text = statics.zyraTicketPlanSummary({ ticketsTotal: 60, unprocessedTickets: unprocessed }, true);
    expect(text).toMatch(/…and 10 more\./);
    expect(text).not.toMatch(/QAB-51 —/);
  });
});

describe("a ticket-scoped plan never just stops", () => {
  it("posts the ticket summary when the last tickets planned nothing and the queue is empty", async () => {
    let activePlan: Body | null = {
      planId: "plan-1", status: "running", remainingScenarios: [], batchSize: 50, doneCount: 10, totalCount: 10, coveredCount: 10,
      ticketsHasMore: false, ticketScope: { ticketKeys: ["QAB-1", "QAB-2"], perTicket: 50 }, ticketsTotal: 2, ticketsSynced: 2, ticketsDone: 2,
      unprocessedTickets: [{ key: "QAB-2", reason: "no_scenarios" }]
    };
    const query = jest.fn((sql: string) => Promise.resolve({ rows: sql.includes("SELECT active_plan, language") ? [{ active_plan: activePlan, language: "en" }] : [] })) as unknown as Query;
    const transaction = jest.fn(async (fn: (client: { query: jest.Mock }) => Promise<unknown>) => fn({
      query: jest.fn((sql: string) => {
        if (sql.includes("SELECT active_plan") && sql.includes("FOR UPDATE")) return Promise.resolve({ rows: [{ active_plan: activePlan }] });
        if (sql.includes("SET active_plan = NULL")) activePlan = null;
        return Promise.resolve({ rows: [] });
      })
    }));
    const svc = makeLegacy(query, { transaction } as unknown as Partial<DatabaseService>);
    const posted: unknown[][] = [];
    jest.spyOn(internals(svc), "postZyraPlanMessage").mockImplementation(async (...args) => { posted.push(args); });

    await internals(svc).continueZyraChatPlanInLanguage("p1", "u1", "s1", "plan-1");

    expect(activePlan).toBeNull();
    expect(posted).toHaveLength(1);
    const reply = String(posted[0][4]);
    expect(reply).toMatch(/Finished working through the tickets/);
    expect(reply).toMatch(/1 of 2 ticket\(s\) got test cases/);
    expect(reply).toMatch(/QAB-2 — no new scenarios/);
  });
});

describe("zyraDecisionForChoice — what each answer runs", () => {
  const turn = { projectId: "p1", uid: "u1", sessionId: "s1", message: "2", userMessageId: "m1" };
  const scopeOptions = (ticketKeys: string[] | null): Options => ({
    kind: "ticket_scope",
    choices: [{ id: "smaller", label: "Generate in smaller batches" }, { id: "all", label: "Generate all tickets in batches" }],
    answeredId: "all",
    context: { originalMessage: "Generate test cases for the tickets", ticketKeys, perTicket: 50, exhaustive: false, routedSuite: { id: "s9", name: "Checkout" } }
  });
  function setup() {
    const svc = makeLegacy();
    const build = jest.spyOn(internals(svc), "buildZyraChatDecision").mockResolvedValue({ reply: "built", actionType: "create", operations: [] });
    return { svc, build };
  }

  it("'all' for named tickets re-runs the ORIGINAL request, routed, as a ticket-scoped plan", async () => {
    const { svc, build } = setup();
    await internals(svc).zyraDecisionForChoice(turn, { options: scopeOptions(["QAB-1", "QAB-2"]), choice: { id: "all", label: "Generate all tickets in batches" } });
    const [, , , message, userMessageId, resume] = build.mock.calls[0];
    expect(message).toBe("Generate test cases for the tickets");
    expect(userMessageId).toBe("m1");
    expect(resume).toEqual({
      routedSuite: { id: "s9", name: "Checkout" },
      routedCount: { exhaustive: true, scopeDecided: true, ticketScope: { ticketKeys: ["QAB-1", "QAB-2"], perTicket: 50 } }
    });
  });

  it("'all' for all the tickets is the paged plan — decided, with no ticket scope", async () => {
    const { svc, build } = setup();
    await internals(svc).zyraDecisionForChoice(turn, { options: scopeOptions(null), choice: { id: "all", label: "Generate all tickets in batches" } });
    expect((build.mock.calls[0][5] as Body).routedCount).toEqual({ exhaustive: true, scopeDecided: true });
  });

  it("'smaller batches' offers groups without calling the model", async () => {
    const { svc, build } = setup();
    const decision = await internals(svc).zyraDecisionForChoice(turn, { options: scopeOptions(["QAB-1", "QAB-2"]), choice: { id: "smaller", label: "Generate in smaller batches" } });
    expect(build).not.toHaveBeenCalled();
    expect(decision.options?.kind).toBe("ticket_group");
  });

  it("a picked group runs its own request, not the typed '1'", async () => {
    const { svc, build } = setup();
    const groups: Options = { kind: "ticket_group", choices: [{ id: "group-1", label: "QAB-1", message: "Generate test cases for QAB-1" }], answeredId: "group-1" };
    await internals(svc).zyraDecisionForChoice({ ...turn, message: "1" }, { options: groups, choice: groups.choices[0] });
    expect(build.mock.calls[0][3]).toBe("Generate test cases for QAB-1");
    expect(build.mock.calls[0][5]).toBeUndefined();
  });
});
