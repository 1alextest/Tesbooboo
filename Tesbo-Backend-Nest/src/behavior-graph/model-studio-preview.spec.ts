import { previewDraftModel } from "./model-studio-preview.core";
import { ModelStudioPreview } from "./model-studio-preview";
import { ModelStudioPreviewController } from "./model-studio-preview.controller";

function draft() {
  return { schemaVersion: "tesbo-fsm-draft/1", semantics: "SEQUENTIAL_FSM", initialStateId: "draft",
    states: [{ id: "draft", label: "Draft" }, { id: "approved", label: "Approved" }],
    transitions: [{ id: "approve", from: "draft", to: "approved", action: "Approve", expectedObservation: "Approval recorded" }] };
}

describe("native Model Studio structural draft preview", () => {
  it("returns deterministic unapproved structure without runtime/coverage authority", () => {
    const before = draft();
    const preview = previewDraftModel(before);
    expect(preview).toMatchObject({ status: "DRAFT_PREVIEW", approval: "NOT_APPROVED", sourceAuthority: "UNVERIFIED", runtimeEvidence: "NONE", modelId: null, modelRevisionId: null });
    expect(preview.capabilities).toEqual({ persistence: false, publication: false, activation: false, pathGeneration: false, targetExecution: false });
    const reordered = draft(); reordered.states.reverse();
    expect(previewDraftModel(reordered)).toEqual(preview);
    expect(before).toEqual(draft());
    expect(preview).not.toHaveProperty("coverage");
    expect(preview).not.toHaveProperty("paths");
  });
  it.each([null, [], {}, { ...draft(), approved: true }, { ...draft(), modelId: "forged" },
    { ...draft(), variables: [] }, { ...draft(), states: [] }, { ...draft(), initialStateId: "missing" },
    { ...draft(), states: [...draft().states, draft().states[0]] },
    { ...draft(), transitions: [...draft().transitions, draft().transitions[0]] },
    { ...draft(), transitions: [{ ...draft().transitions[0], to: "missing" }] },
    { ...draft(), transitions: [{ ...draft().transitions[0], expectedObservation: " " }] },
    { ...draft(), transitions: [{ ...draft().transitions[0], guard: "eval()" }] },
    { ...draft(), states: Array.from({ length: 33 }, (_, i) => ({ id: `s${i}`, label: "State" })) },
    { ...draft(), transitions: Array.from({ length: 65 }, (_, i) => ({ ...draft().transitions[0], id: `t${i}` })) },
    { ...draft(), states: [{ id: "draft", label: "x".repeat(121) }] }
  ])("refuses malformed, oversized, executable or authority-bearing payload %#", value => {
    expect(() => previewDraftModel(value)).toThrow(expect.objectContaining({ code: "INVALID_MODEL" }));
  });
  it.each(["EFSM", "CONCURRENT", "TEMPORAL", "EVENTUAL"])("refuses unsupported %s semantics explicitly", semantics => {
    expect(() => previewDraftModel({ ...draft(), semantics })).toThrow(expect.objectContaining({ code: "UNSUPPORTED_SEMANTICS" }));
  });
  it("retains unreachable diagnostics and handles finite cycles without path enumeration", () => {
    const value = draft(); value.states.push({ id: "unreachable", label: "Unreachable" });
    value.transitions.push({ id: "retry", from: "approved", to: "draft", action: "Retry", expectedObservation: "Draft restored" });
    const p = previewDraftModel(value);
    expect(p.states.find(s => s.id === "unreachable")?.reachable).toBe(false);
    expect(p.diagnostics).toContainEqual({ code: "UNREACHABLE_STATE", elementId: "unreachable" });
    expect(p.states.filter(s => s.reachable)).toHaveLength(2);
    expect(previewDraftModel({ ...draft(), transitions: [] }).diagnostics).toContainEqual({ code: "TERMINAL_STATE", elementId: "draft" });
  });
});

describe("native preview authorization and opt-in wiring", () => {
  const previous = process.env.TESBO_MODEL_PREVIEW_ENABLED;
  beforeEach(() => { process.env.TESBO_MODEL_PREVIEW_ENABLED = "1"; });
  afterEach(() => {
    if (previous === undefined) delete process.env.TESBO_MODEL_PREVIEW_ENABLED;
    else process.env.TESBO_MODEL_PREVIEW_ENABLED = previous;
  });
  function setup(allowed = true) {
    const query = jest.fn().mockResolvedValue({ rows: [{ allowed }] });
    const requireProjectAccess = jest.fn().mockResolvedValue({ organization_id: "org" });
    const service = new ModelStudioPreview({ query } as never, { requireProjectAccess } as never);
    return { query, requireProjectAccess, service };
  }
  it("checks authenticated native access ahead of body and feature diagnostics", async () => {
    const s = setup();
    await expect(s.service.previewForUser(null, "project", {})).rejects.toMatchObject({ status: 403 });
    expect(s.requireProjectAccess).not.toHaveBeenCalled(); expect(s.query).not.toHaveBeenCalled();
    s.requireProjectAccess.mockRejectedValue({ status: 403 });
    await expect(s.service.previewForUser("user", "project", {})).rejects.toMatchObject({ status: 403 });
    expect(s.query).not.toHaveBeenCalled();
  });
  it("is unavailable by default without widening project authority", async () => {
    delete process.env.TESBO_MODEL_PREVIEW_ENABLED;
    const s = setup();
    await expect(s.service.previewForUser("user", "project", draft())).rejects.toMatchObject({ status: 503, response: { code: "MODEL_PREVIEW_DISABLED" } });
    expect(s.query).not.toHaveBeenCalled();
  });
  it("refuses revocation or archive before returning computed structure", async () => {
    const s = setup(false);
    await expect(s.service.previewForUser("user", "project", draft())).rejects.toMatchObject({ status: 403 });
    expect(s.query).toHaveBeenCalledWith(expect.stringContaining("JOIN organization_members"), ["project", "org", "user"]);
    expect(s.query.mock.calls[0][0]).not.toMatch(/INSERT|UPDATE|DELETE/);
  });
  it("maps model errors to typed 400/422 and routes actual authenticated identity", async () => {
    const s = setup(); const controller = new ModelStudioPreviewController(s.service);
    await expect(controller.model({ userId: "user" } as never, "project", draft())).resolves.toMatchObject({ approval: "NOT_APPROVED" });
    await expect(controller.model({ userId: "user" } as never, "project", {})).rejects.toMatchObject({ status: 400, response: { code: "INVALID_MODEL" } });
    await expect(controller.model({ userId: "user" } as never, "project", { ...draft(), semantics: "CONCURRENT" })).rejects.toMatchObject({ status: 422, response: { code: "UNSUPPORTED_SEMANTICS" } });
    expect(s.requireProjectAccess).toHaveBeenCalledWith("user", "project");
  });
});


it("visits all 32 allowed states and 64 edges under the explicit traversal cap", () => {
  const states = Array.from({ length: 32 }, (_, i) => ({ id: `s${i}`, label: `State ${i}` }));
  const transitions = Array.from({ length: 64 }, (_, i) => ({ id: `t${i}`, from: `s${i % 32}`, to: `s${(i + 1) % 32}`,
    action: "Next", expectedObservation: "Next state visible" }));
  const result = previewDraftModel({ schemaVersion: "tesbo-fsm-draft/1", semantics: "SEQUENTIAL_FSM", initialStateId: "s0", states, transitions });
  expect(result.states.filter(state => state.reachable)).toHaveLength(32);
  expect(result.transitions.filter(edge => edge.reachable)).toHaveLength(64);
  expect(result.diagnostics).toEqual([]);
});
