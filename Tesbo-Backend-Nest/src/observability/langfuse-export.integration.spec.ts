/**
 * Actual Langfuse/OTel SDK -> loopback HTTP capture, without SDK/exporter mocks.
 * Proves the standalone helpers' serialized export contract, not Langfuse server
 * ingestion/UI, a deployed chat flow, provider calls, pricing, or database work.
 */
import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import { type AddressInfo } from "node:net";
import { fork, type ChildProcess } from "node:child_process";
import path from "node:path";

type OtlpAttribute = { key: string; value: { stringValue?: string; boolValue?: boolean } };
type OtlpSpan = {
  name: string;
  traceId: string;
  spanId: string;
  parentSpanId: string;
  attributes: OtlpAttribute[];
};
type OtlpExport = {
  resourceSpans: Array<{ scopeSpans: Array<{ scope: { name: string }; spans: OtlpSpan[] }> }>;
};
type CapturedRequest = { method?: string; path?: string; headers: IncomingHttpHeaders; raw: string; body: OtlpExport };

const INPUT_KEY = "sk-ant-synthetic_capture_input_12345";
const OUTPUT_KEY = "sk-synthetic_capture_output_12345";
const ERROR_TOKEN = "synthetic.capture.bearer.12345";
const DROPPED_METADATA = "synthetic-unapproved-metadata-must-not-export";
const PUBLIC_KEY = "capture-public-key-not-a-real-credential";
const SECRET_KEY = "capture-secret-key-not-a-real-credential";

function attributes(span: OtlpSpan): Record<string, string | boolean | undefined> {
  return Object.fromEntries(span.attributes.map(({ key, value }) => [key, value.stringValue ?? value.boolValue]));
}

describe("standalone observability helpers through the installed Langfuse HTTP exporter", () => {
  const captured: CapturedRequest[] = [];
  const captureErrors: string[] = [];
  let server: Server | undefined;
  let worker: ChildProcess | undefined;
  let spans: OtlpSpan[] = [];
  let expectedTraceId: string;
  let otherTraceId: string;

  function spanNamed(name: string): OtlpSpan {
    const found = spans.filter((span) => span.name === name);
    expect(found).toHaveLength(1);
    return found[0];
  }

  beforeAll(async () => {
    server = createServer((request, response) => {
      const chunks: Buffer[] = [];
      let size = 0;
      request.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > 64 * 1024) {
          captureErrors.push("capture request exceeded the synthetic fixture bound");
          request.destroy();
          return;
        }
        chunks.push(chunk);
      });
      request.on("error", (error) => captureErrors.push(error.message));
      request.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        try {
          captured.push({ method: request.method, path: request.url, headers: request.headers, raw, body: JSON.parse(raw) as OtlpExport });
          response.writeHead(200, { "content-type": "application/json" });
          response.end("{}");
        } catch {
          captureErrors.push("exporter did not send a JSON OTLP request");
          response.writeHead(400);
          response.end();
        }
      });
    });
    await new Promise<void>((resolve, reject) => {
      server!.once("error", reject);
      server!.listen(0, "127.0.0.1", () => {
        server!.off("error", reject);
        resolve();
      });
    });
    const port = (server.address() as AddressInfo).port;
    // A native Node child avoids Jest's VM dynamic-import restriction in the
    // real OTel transport. Its explicit environment inherits no credentials,
    // external exporters, proxy settings, samplers or resource metadata.
    const backendRoot = path.resolve(__dirname, "../..");
    const environment: NodeJS.ProcessEnv = {
      NODE_ENV: "test",
      TS_NODE_PROJECT: path.join(backendRoot, "tsconfig.json"),
      LANGFUSE_PUBLIC_KEY: PUBLIC_KEY,
      LANGFUSE_SECRET_KEY: SECRET_KEY,
      LANGFUSE_BASE_URL: `http://127.0.0.1:${port}`,
      LANGFUSE_ENVIRONMENT: "local-sdk-capture-test",
      LANGFUSE_ALLOW_CLOUD: "false",
      LANGFUSE_SEED_MODEL_PRICES: "false",
      LANGFUSE_MEDIA_UPLOAD_ENABLED: "false",
      LANGFUSE_FLUSH_INTERVAL: "60",
      LANGFUSE_TIMEOUT: "2",
      OTEL_TRACES_EXPORTER: "none",
      OTEL_METRICS_EXPORTER: "none",
      OTEL_LOGS_EXPORTER: "none",
      OTEL_NODE_RESOURCE_DETECTORS: "none"
    };
    await new Promise<void>((resolve, reject) => {
      let output = "";
      worker = fork(path.join(__dirname, "test-support/langfuse-export.capture.cjs"), [], {
        cwd: backendRoot,
        env: environment,
        execArgv: ["--require", require.resolve("ts-node/register/transpile-only")],
        stdio: ["ignore", "pipe", "pipe", "ipc"]
      });
      const deadline = setTimeout(() => {
        worker?.kill();
        reject(new Error(`SDK capture worker exceeded 12 seconds\n${output}`));
      }, 12_000);
      worker.stdout?.on("data", (chunk: Buffer) => { output += chunk.toString(); });
      worker.stderr?.on("data", (chunk: Buffer) => { output += chunk.toString(); });
      worker.on("message", (message: { primaryTraceId?: string; otherTraceId?: string }) => {
        if (message.primaryTraceId && message.otherTraceId) {
          expectedTraceId = message.primaryTraceId;
          otherTraceId = message.otherTraceId;
        }
      });
      worker.once("error", (error) => { clearTimeout(deadline); reject(error); });
      worker.once("close", (code, signal) => {
        clearTimeout(deadline);
        if (code === 0 && expectedTraceId && otherTraceId) resolve();
        else reject(new Error(`SDK capture worker failed (${code ?? signal})\n${output}`));
      });
    });
    expect(captureErrors).toEqual([]);
    expect(captured.length).toBeGreaterThan(0);
    spans = captured.flatMap(({ body }) => body.resourceSpans.flatMap(({ scopeSpans }) => scopeSpans.flatMap(({ spans: rows }) => rows)));
  }, 15_000);

  afterAll(async () => {
    if (worker && worker.exitCode === null && worker.signalCode === null) worker.kill();
    if (server?.listening) {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
    }
  }, 10_000);

  it("flushes four real SDK observations as OTLP/HTTP to the loopback capture", () => {
    expect(spans).toHaveLength(4);
    for (const request of captured) {
      expect(request.method).toBe("POST");
      expect(request.path).toBe("/api/public/otel/v1/traces");
      expect(request.headers["content-type"]).toContain("application/json");
      expect(request.headers.authorization).toBe(`Basic ${Buffer.from(`${PUBLIC_KEY}:${SECRET_KEY}`).toString("base64")}`);
      expect(request.headers["x-langfuse-sdk-name"]).toBe("javascript");
      expect(request.body.resourceSpans.every(({ scopeSpans }) => scopeSpans.every(({ scope }) => scope.name === "langfuse-sdk"))).toBe(true);
    }
  });

  it("exports native deterministic trace, session and user identity on each standalone observation", () => {
    expect(expectedTraceId).toMatch(/^[0-9a-f]{32}$/);
    expect(otherTraceId).not.toBe(expectedTraceId);
    expect(new Set(spans.map(({ spanId }) => spanId)).size).toBe(4);
    for (const span of spans) {
      const failure = span.name.endsWith("failure");
      expect(span.traceId).toBe(failure ? otherTraceId : expectedTraceId);
      expect(span.spanId).toMatch(/^[0-9a-f]{16}$/);
      expect(span.parentSpanId).toBe("0000000000000001");
      const attrs = attributes(span);
      expect(attrs["session.id"]).toBe(failure ? "capture-other-session" : "capture-session");
      expect(attrs["user.id"]).toBe(failure ? "capture-other-user" : "capture-user");
      expect(attrs["langfuse.observation.type"]).toBe(span.name.includes("generation") ? "generation" : "tool");
    }
    const generation = attributes(spanNamed("capture.generation.success"));
    expect(generation["langfuse.observation.model.name"]).toBe("synthetic-model");
    expect(JSON.parse(String(generation["langfuse.observation.usage_details"]))).toEqual({ input: 11, output: 7 });
    expect(generation["langfuse.observation.metadata.cachedInputTokens"]).toBe("3");
  });

  it("masks serialized input/output/error content and excludes non-allowlisted metadata before export", () => {
    const wirePayload = captured.map(({ raw }) => raw).join("\n");
    for (const secret of [INPUT_KEY, OUTPUT_KEY, ERROR_TOKEN, DROPPED_METADATA]) expect(wirePayload).not.toContain(secret);
    for (const span of spans) {
      const attrs = attributes(span);
      expect(attrs["langfuse.observation.metadata.projectId"]).toBe("capture-project");
      expect(attrs["langfuse.observation.metadata.planId"]).toBe(`${"p".repeat(199)}…`);
      expect(attrs).not.toHaveProperty("langfuse.observation.metadata.apiKey");
      expect(attrs).not.toHaveProperty("langfuse.observation.metadata.authorization");
      expect(String(attrs["langfuse.observation.output"])).toContain("[REDACTED_KEY]");
      if (span.name.endsWith("failure")) {
        expect(attrs["langfuse.observation.level"]).toBe("ERROR");
        expect(attrs["langfuse.observation.status_message"]).toBe("Operation failed (details in masked output)");
        expect(JSON.parse(String(attrs["langfuse.observation.output"]))).toHaveProperty("error");
      }
    }
    expect(String(attributes(spanNamed("capture.generation.success"))["langfuse.observation.input"])).toContain("[REDACTED_KEY]");
    expect(String(attributes(spanNamed("capture.tool.success"))["langfuse.observation.input"])).toContain("Bearer [REDACTED]");
    expect(String(attributes(spanNamed("capture.tool.failure"))["langfuse.observation.output"])).toContain("Bearer [REDACTED]");
  });
});
