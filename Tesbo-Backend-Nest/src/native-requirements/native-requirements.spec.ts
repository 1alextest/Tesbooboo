import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type { DatabaseService } from "../database/database.service";
import { makeLegacy } from "../legacy/test-helpers/legacy-service.fixture";
import { proposalDigest } from "../legacy/testcase-proposal-review";
import { NativeRequirementsRepository } from "./native-requirements.repository";
import {
  assertNativeRequirementPublicationAllowed, closedObject, lockNativeRequirementBasis, nativeRequirementBasis,
  nativeRequirementGovernance, nativeProposalProvenance, nativeRequirementsCapability, normalizeRequirementContent,
  requireNativeRequirementsPreview
} from "./native-requirements.core";

type Body = Record<string, any>;
const valid = () => ({ title: "Prevent duplicate transfers", description: "A repeated request has one effect.", criteria: [{ key: "AC-1", text: "The same request identity returns its first receipt." }] });

describe("unpublished native requirement contract", () => {
  const oldNative = process.env.TESBO_NATIVE_REQUIREMENTS_PREVIEW_ENABLED, oldCases = process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED;
  afterEach(() => {
    if (oldNative === undefined) delete process.env.TESBO_NATIVE_REQUIREMENTS_PREVIEW_ENABLED; else process.env.TESBO_NATIVE_REQUIREMENTS_PREVIEW_ENABLED = oldNative;
    if (oldCases === undefined) delete process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED; else process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED = oldCases;
  });

  it("a preview enables proposal preparation without granting approval or publication", () => {
    delete process.env.TESBO_NATIVE_REQUIREMENTS_PREVIEW_ENABLED;
    expect(() => requireNativeRequirementsPreview()).toThrow(expect.objectContaining({ status: 501 }));
    process.env.TESBO_NATIVE_REQUIREMENTS_PREVIEW_ENABLED = "1";
    process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED = "1";
    expect(nativeRequirementsCapability()).toEqual({ mode: "unpublished_proposals_only", enabled: true, skillResolution: "unavailable", canApprove: false, canPublishCases: false, canStageCaseProposals: true });
    for (const row of [{ proposal_governance: {} }, { proposal_current_requirement_operation_id: randomUUID() }, { proposal_operation_sequence: 1 }]) {
      expect(() => assertNativeRequirementPublicationAllowed(row)).toThrow(expect.objectContaining({ response: expect.objectContaining({ code: "SKILL_CONTEXT_UNAVAILABLE" }) }));
    }
    expect(() => assertNativeRequirementPublicationAllowed({ proposal_governance: null, proposal_current_requirement_operation_id: null, proposal_operation_sequence: 0 })).not.toThrow();
  });

  it("pins all normative content while canonicalizing omitted optional fields", () => {
    const first = normalizeRequirementContent(valid());
    const reordered = normalizeRequirementContent({ criteria: valid().criteria, description: valid().description, title: valid().title, rationale: "", sourceRefs: [] });
    expect(proposalDigest(first)).toBe(proposalDigest(reordered));
    const changed = normalizeRequirementContent({ ...valid(), criteria: [{ key: "AC-1", text: "A repeated request may execute again." }] });
    expect(proposalDigest(changed)).not.toBe(proposalDigest(first));
    expect(first.criteria[0].key).toBe(changed.criteria[0].key);
    expect(nativeRequirementGovernance()).toEqual({ policy: "unpublished_proposals_only", skillContext: { status: "unavailable", resolvedAt: null } });
  });

  it("canonicalizes explicit HTTP(S) source URLs before hashing and persistence", () => {
    const input = normalizeRequirementContent({ ...valid(), sourceRefs: [{ label: "Spec", url: "HTTPS://EXAMPLE.COM:443/spec" }] });
    const canonical = normalizeRequirementContent({ ...valid(), sourceRefs: [{ label: "Spec", url: "https://example.com/spec" }] });
    expect(input.sourceRefs).toEqual([{ label: "Spec", url: "https://example.com/spec" }]);
    expect(proposalDigest(input)).toBe(proposalDigest(canonical));
    const prefix = "https://example.com/", maxUrl = prefix + "a".repeat(2048 - prefix.length);
    expect(normalizeRequirementContent({ ...valid(), sourceRefs: [{ label: "Max", url: maxUrl }] }).sourceRefs[0].url).toHaveLength(2048);
  });

  it.each([
    { name: "shorthand", url: "https:example.com/spec" },
    { name: "single slash", url: "https:/example.com/spec" },
    { name: "empty authority", url: "https:///example.com/spec" },
    { name: "backslash", url: "https://example.com\\spec" },
    { name: "overlong normalized source", url: "https://example.com/" + "é".repeat(700) }
  ])(
    "refuses $name with a validation error", ({ url }) => {
      expect(() => normalizeRequirementContent({ ...valid(), sourceRefs: [{ label: "Spec", url }] })).toThrow(expect.objectContaining({ status: 400 }));
    }
  );

  it.each([
    { title: " " }, { title: "x".repeat(513) }, { description: null }, { rationale: false },
    { criteria: [] }, { criteria: new Array(101).fill({ key: "AC-1", text: "x" }) },
    { criteria: [{ key: "AC-1", text: "x" }, { key: "AC-1", text: "y" }] },
    { criteria: [{ key: "AC 1", text: "x" }] }, { criteria: [{ key: "AC-1", text: " " }] },
    { criteria: [{ key: "AC-1", text: "x", approval: "approved" }] },
    { sourceRefs: [{ label: "Spec", url: "javascript:alert(1)" }] },
    { sourceRefs: [{ label: "Spec", url: "https://user:password@example.invalid/spec" }] },
    { sourceRefs: [{ label: "Spec", url: "https://example.invalid/spec", authority: true }] }
  ])("refuses malformed or authority-smuggling content %p", override => {
    expect(() => normalizeRequirementContent({ ...valid(), ...override })).toThrow(expect.objectContaining({ status: 400 }));
  });

  it("rejects unknown payload authority and requires an exact unique criterion basis", () => {
    expect(() => closedObject({ title: "Proposal", skillContext: { status: "resolved" } }, ["title"])).toThrow();
    const basis = { requirementVersionId: randomUUID(), requirementContentDigest: "a".repeat(64), criterionKeys: ["AC-2", "AC-1"] };
    expect(nativeRequirementBasis(basis).criterionKeys).toEqual(["AC-1", "AC-2"]);
    for (const changed of [{ criterionKeys: [] }, { criterionKeys: ["AC-1", "AC-1"] }, { requirementContentDigest: "latest" }, { requirementVersionId: "latest" }]) {
      expect(() => nativeRequirementBasis({ ...basis, ...changed })).toThrow();
    }
  });

  it("recovers the exact retired association receipt after current authority and before changed-basis checks", async () => {
    process.env.TESBO_NATIVE_REQUIREMENTS_PREVIEW_ENABLED = "1";
    const projectId = randomUUID(), userId = randomUUID(), requirementId = randomUUID(), linkId = randomUUID();
    const principal = { kind: "human_session" as const, transport: "rest" as const };
    const request = { submissionKey: randomUUID(), requirementVersionId: randomUUID(), requirementContentDigest: "a".repeat(64), criterionKeys: ["AC-1"], testcaseId: randomUUID(), testcaseRevision: "b".repeat(64), testcaseApprovalRevision: null };
    const provenance = nativeProposalProvenance(userId, principal);
    const digest = proposalDigest({ projectId, requirementId, ...request, provenance });
    const order: string[] = [];
    const query = jest.fn(async (sql: string) => {
      order.push("receipt");
      if (!sql.includes("submission_key")) throw new Error("A receipt retry must not validate a later requirement/case basis");
      return { rows: [{ id: linkId, request_digest: digest }] };
    });
    const db = { transaction: (work: (client: PoolClient) => unknown) => work({ query } as unknown as PoolClient) } as unknown as DatabaseService;
    const legacy = makeLegacy(db);
    jest.spyOn(legacy, "requireProjectAccess").mockResolvedValue({ id: projectId } as never);
    jest.spyOn(legacy, "lockTestcaseSuiteWrites").mockImplementation(async () => { order.push("lock"); });
    const authority = jest.spyOn(legacy, "requireNativeRequirementAuthoringAuthority").mockImplementation(async () => { order.push("authority"); return {} as never; });
    const repository = new NativeRequirementsRepository(db, legacy);
    const retired = { id: linkId, retiredAt: "2026-11-22T00:00:00.000Z", current: false, staleReasons: ["LINK_RETIRED", "REQUIREMENT_VERSION_SUPERSEDED"] };
    const read = jest.spyOn(repository, "get").mockResolvedValue({ links: [retired], coverage: { currentProposedLinkCount: 0 } } as never);
    expect(await repository.associate(projectId, userId, requirementId, request, principal)).toMatchObject({ link: retired, submission: { linkId, replayed: true } });
    expect(order).toEqual(["lock", "authority", "receipt"]);
    query.mockClear(); read.mockClear();
    authority.mockRejectedValueOnce(Object.assign(new Error("Authority revoked"), { status: 403 }));
    await expect(repository.associate(projectId, userId, requirementId, request, principal)).rejects.toMatchObject({ status: 403 });
    expect(query).not.toHaveBeenCalled(); expect(read).not.toHaveBeenCalled();
    await expect(repository.associate(projectId, userId, requirementId, { ...request, criterionKeys: ["AC-2"] }, principal))
      .rejects.toMatchObject({ response: expect.objectContaining({ code: "SUBMISSION_KEY_REUSED" }) });
    await expect(repository.associate(projectId, userId, requirementId, request, { kind: "api_token", tokenId: randomUUID(), transport: "rest" }))
      .rejects.toMatchObject({ response: expect.objectContaining({ code: "SUBMISSION_KEY_REUSED" }) });
  });

  it("a version from another identity, stale version, or unknown criterion cannot become task context", async () => {
    const id = randomUUID(), versionId = randomUUID(), projectId = randomUUID();
    const basis = nativeRequirementBasis({ requirementVersionId: versionId, requirementContentDigest: "a".repeat(64), criterionKeys: ["AC-1"] });
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const client = { query } as unknown as PoolClient;
    await expect(lockNativeRequirementBasis(client, projectId, id, basis)).rejects.toMatchObject({ status: 404 });
    expect(query.mock.calls[0][1]).toEqual([id, projectId, versionId]);
    query.mockResolvedValue({ rows: [{ id, proposal_number: 1, current_version_id: randomUUID(), version_id: versionId, state: "draft", content_digest: basis.requirementContentDigest, criteria: valid().criteria }] });
    await expect(lockNativeRequirementBasis(client, projectId, id, basis)).rejects.toMatchObject({ response: expect.objectContaining({ code: "REQUIREMENT_STALE_REVISION" }) });
    query.mockResolvedValue({ rows: [{ id, proposal_number: 1, current_version_id: versionId, version_id: versionId, state: "draft", content_digest: basis.requirementContentDigest, criteria: [{ key: "AC-2", text: "Another obligation" }] }] });
    await expect(lockNativeRequirementBasis(client, projectId, id, basis)).rejects.toMatchObject({ status: 400 });
    query.mockResolvedValue({ rows: [{ id, proposal_number: 1, current_version_id: versionId, version_id: versionId, state: "draft", content_digest: basis.requirementContentDigest, criteria: valid().criteria }] });
    expect(await lockNativeRequirementBasis(client, projectId, id, basis)).toMatchObject({ requirement: { id, versionId, criterionKeys: ["AC-1"], criteria: valid().criteria }, publication: { status: "blocked", reason: "SKILL_CONTEXT_UNAVAILABLE" } });
  });

  it.each(["edit", "delete"] as const)("%s refuses a stale or missing task digest before interpreting a mutable draft index", async action => {
    const project = randomUUID(), user = randomUUID(), task = randomUUID();
    const query = jest.fn().mockResolvedValue({ rows: [{ id: task, project_id: project, task_status: "in_review",
      proposal_governance: nativeRequirementGovernance(), generated_payload: [{ opType: "create", draft: { title: "B" } }, { opType: "create", draft: { title: "C" } }] }] });
    const db = { transaction: (work: (client: PoolClient) => unknown) => work({ query } as unknown as PoolClient) } as unknown as DatabaseService;
    const service = makeLegacy(db);
    jest.spyOn(service, "requireProjectAccess").mockResolvedValue({ id: project } as never);
    jest.spyOn(service, "lockTestcaseSuiteWrites").mockResolvedValue(undefined);
    const review = jest.spyOn(service as unknown as Body, "readTestcaseProposal").mockResolvedValue({ proposal_review_revision: "b".repeat(64) });
    const mutate = (revision?: string) => action === "edit"
      ? service.zyraEditDraft(project, user, task, 1, { title: "Stale edit intended for B" }, { kind: "human_session" }, revision)
      : service.zyraDeleteDraft(project, user, task, 1, { kind: "human_session" }, revision);
    await expect(mutate("a".repeat(64))).rejects.toMatchObject({ response: expect.objectContaining({ code: "PROPOSAL_REVIEW_CONFLICT" }), status: 409 });
    expect(query.mock.calls).toHaveLength(1);
    expect(query.mock.calls[0][0]).toContain("FOR UPDATE");
    review.mockClear(); query.mockClear();
    await expect(mutate()).rejects.toMatchObject({ response: expect.objectContaining({ code: "PROPOSAL_REVIEW_REQUIRED" }), status: 400 });
    expect(review).not.toHaveBeenCalled();
    expect(query.mock.calls).toHaveLength(1);
  });

  it.each(["edit", "delete"] as const)("%s returns the exact under-lock result instead of silently rebasing a bulk selection", async action => {
    const project = randomUUID(), user = randomUUID(), task = randomUUID();
    let inTransaction = false;
    const query = jest.fn(async (sql: string) => sql.startsWith("SELECT") ? { rows: [{ id: task, project_id: project, task_status: "in_review",
      proposal_governance: nativeRequirementGovernance(), generated_payload: ["A", "B", "C"].map(title => ({ opType: "create", draft: { title } })) }] } : { rows: [] });
    const db = { transaction: async (work: (client: PoolClient) => unknown) => {
      inTransaction = true; const result = await work({ query } as unknown as PoolClient); inTransaction = false; return result;
    } } as unknown as DatabaseService;
    const service = makeLegacy(db), internals = service as unknown as Body;
    jest.spyOn(service, "requireProjectAccess").mockResolvedValue({ id: project } as never);
    jest.spyOn(service, "lockTestcaseSuiteWrites").mockResolvedValue(undefined);
    jest.spyOn(internals, "appendGovernedCaseDraftRevision").mockResolvedValue(undefined);
    let reads = 0;
    jest.spyOn(internals, "readTestcaseProposal").mockImplementation(async () => {
      expect(inTransaction).toBe(true); reads++;
      return { id: task, proposal_snapshot: {}, proposal_review_revision: reads === 1 ? "a".repeat(64) : "b".repeat(64) };
    });
    jest.spyOn(internals, "formatAiTask").mockImplementation(async (...args: unknown[]) => ({ id: task, proposalRevision: (args[0] as Body).proposal_review_revision }));
    const laterRead = jest.spyOn(service, "zyraTask").mockResolvedValue({ id: task, proposalRevision: "c".repeat(64) } as never);
    const response = action === "edit"
      ? await service.zyraEditDraft(project, user, task, 1, { title: "B reviewed" }, { kind: "human_session" }, "a".repeat(64))
      : await service.zyraDeleteDraft(project, user, task, 1, { kind: "human_session" }, "a".repeat(64));
    expect(response.proposalRevision).toBe("b".repeat(64));
    expect(laterRead).not.toHaveBeenCalled();
    expect(reads).toBe(2);
  });

  it.each(["zyraSave", "aiSave"] as const)("%s refuses the locked governed task before every publication side effect", async method => {
    process.env.TESBO_NATIVE_REQUIREMENTS_PREVIEW_ENABLED = "1";
    process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED = "1";
    const project = randomUUID(), user = randomUUID(), task = randomUUID();
    const statements: string[] = [];
    const client = { query: jest.fn(async (sql: string) => {
      statements.push(sql);
      if (sql.includes("pg_advisory_xact_lock")) return { rows: [] };
      if (sql.includes("SELECT * FROM ai_generation_requests")) return { rows: [{ id: task, task_status: "in_review", proposal_governance: nativeRequirementGovernance(), generated_payload: [{ opType: "create", draft: { title: "Must stay unpublished" } }], save_events: [] }] };
      throw new Error(`Unexpected write or read after refusal: ${sql}`);
    }) } as unknown as PoolClient;
    const db = { transaction: async (fn: (client: PoolClient) => Promise<unknown>) => fn(client) } as DatabaseService;
    const service = makeLegacy(db), internals = service as unknown as Body;
    jest.spyOn(service, "requireProjectAccess").mockResolvedValue({ id: project } as never);
    jest.spyOn(internals, "requireProposalAuthority").mockResolvedValue({ caller_role: "owner" });
    const audit = jest.spyOn(service, "logProjectActivity");
    await expect(service[method](project, user, task, { expectedProposalRevision: "a".repeat(64), selectedDraftIndexes: [0], suiteName: "Must not be created" }, { kind: "human_session" }))
      .rejects.toMatchObject({ response: expect.objectContaining({ code: "SKILL_CONTEXT_UNAVAILABLE" }) });
    expect(statements).toHaveLength(2);
    expect(statements[1]).toContain("FOR UPDATE");
    expect(audit).not.toHaveBeenCalled();
  });
});
