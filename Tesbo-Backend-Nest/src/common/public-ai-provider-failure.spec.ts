import { publicAiProviderFailure } from "./public-ai-provider-failure";
import { HttpException } from "@nestjs/common";

const CANARY = "sk-e2e-observation-provider-error-12345";

describe("provider errors are never a reply, progress, trace or activity template", () => {
  it.each([
    [new Error(`Synthetic provider failure ${CANARY}`), "AI provider request failed"],
    [new HttpException({ error: `Synthetic provider failure ${CANARY}`, detail: CANARY }, 500), "AI provider is unavailable"],
    [new HttpException({ message: `Forbidden ${CANARY}` }, 403), "AI provider denied"],
    [new HttpException({ message: `Invalid key ${CANARY}` }, 401), "AI provider authentication failed"],
    [new HttpException({ error: CANARY }, 429), "AI provider is rate-limited"],
    [{ response: { status: 504 }, message: CANARY }, "AI provider timed out"],
    [{ statusCode: 400, detail: `authorization: Bearer ${CANARY}` }, "AI provider rejected"],
    [{ code: "ETIMEDOUT", message: CANARY }, "AI provider timed out"],
    [CANARY, "AI provider request failed"],
    [null, "AI provider request failed"]
  ])("classifies without reflecting a provider error or request credential", (error, outcome) => {
    const text = publicAiProviderFailure(error);
    expect(text).toContain(outcome);
    expect(text).not.toContain(CANARY);
    expect(text).not.toContain("Synthetic provider");
    expect(text).not.toContain("Bearer");
  });

  it("never invokes untrusted toString, nested response text or getResponse", () => {
    const getResponse = jest.fn(() => ({ detail: CANARY }));
    const toString = jest.fn(() => CANARY);
    const err = { getStatus: () => 500, getResponse, message: CANARY, toString };
    expect(publicAiProviderFailure(err)).toBe("AI provider is unavailable. Please retry later.");
    expect(getResponse).not.toHaveBeenCalled();
    expect(toString).not.toHaveBeenCalled();
  });

  it("unknown status, malicious getters and unsupported types fail closed", () => {
    const text = publicAiProviderFailure({
      getStatus: () => { throw new Error(`untrusted ${CANARY}`); },
      message: CANARY, name: "UnknownError"
    });
    expect(text).toBe("AI provider request failed. Please try again.");
    const other = publicAiProviderFailure({ status: "500", message: CANARY });
    expect(other).not.toContain(CANARY);
  });
});
