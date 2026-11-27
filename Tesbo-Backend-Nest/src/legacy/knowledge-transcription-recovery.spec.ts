import { makeLegacy } from "./test-helpers/legacy-service.fixture";

const PROJECT = "00000000-0000-4000-8000-000000000001";

function service(config: Record<string, unknown>) {
  const query = jest.fn().mockResolvedValue({ rows: [] });
  const svc = makeLegacy({ query } as never, { config: config as never });
  const sweep = jest.spyOn(
    svc as unknown as { resumeInterruptedKnowledgeTranscriptions: (projectId?: string) => Promise<void> },
    "resumeInterruptedKnowledgeTranscriptions"
  ).mockResolvedValue(undefined);
  return { svc, sweep };
}

describe("KB transcription background recovery scheduling", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("keeps automatic global startup dispatch and the five-minute sweep when unset", async () => {
    const { svc, sweep } = service({});
    await svc.onModuleInit();
    expect(sweep).toHaveBeenCalledTimes(1);
    expect(sweep).toHaveBeenLastCalledWith(undefined);
    expect(jest.getTimerCount()).toBe(1);

    jest.advanceTimersByTime(5 * 60 * 1000);
    expect(sweep).toHaveBeenCalledTimes(2);
    expect(sweep).toHaveBeenLastCalledWith(undefined);

    svc.onModuleDestroy();
    expect(jest.getTimerCount()).toBe(0);
    jest.advanceTimersByTime(5 * 60 * 1000);
    expect(sweep).toHaveBeenCalledTimes(2);
  });

  it("dispatches nothing at startup or on the timer in off mode", async () => {
    const { svc, sweep } = service({ kbTranscriptionRecoveryMode: "off" });
    await svc.onModuleInit();
    jest.advanceTimersByTime(10 * 60 * 1000);
    expect(sweep).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
    svc.onModuleDestroy();
  });

  it("constrains startup and every periodic run to the configured project", async () => {
    const { svc, sweep } = service({
      kbTranscriptionRecoveryMode: "project",
      kbTranscriptionRecoveryProjectId: PROJECT
    });
    await svc.onModuleInit();
    expect(sweep).toHaveBeenCalledWith(PROJECT);
    jest.advanceTimersByTime(5 * 60 * 1000);
    expect(sweep).toHaveBeenCalledTimes(2);
    expect(sweep).toHaveBeenLastCalledWith(PROJECT);
    svc.onModuleDestroy();
  });

  it("fails closed without startup dispatch or a timer when project mode lacks a UUID", async () => {
    const { svc, sweep } = service({
      kbTranscriptionRecoveryMode: "project",
      kbTranscriptionRecoveryProjectId: "not-a-uuid"
    });
    await svc.onModuleInit();
    jest.advanceTimersByTime(10 * 60 * 1000);
    expect(sweep).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
    svc.onModuleDestroy();
  });

  it("fails closed when an unexpected mode reaches the scheduler", async () => {
    const { svc, sweep } = service({ kbTranscriptionRecoveryMode: "everything" });
    await svc.onModuleInit();
    jest.advanceTimersByTime(10 * 60 * 1000);
    expect(sweep).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
    svc.onModuleDestroy();
  });

  it("registers once and keeps explicit global scope when startup runs twice", async () => {
    const { svc, sweep } = service({ kbTranscriptionRecoveryMode: "global" });
    await svc.onModuleInit();
    await svc.onModuleInit();
    expect(sweep).toHaveBeenCalledTimes(1);
    expect(sweep).toHaveBeenLastCalledWith(undefined);
    expect(jest.getTimerCount()).toBe(1);
    svc.onModuleDestroy();
  });
});
