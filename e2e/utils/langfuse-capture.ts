import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";

/** Synthetic OTLP/HTTP receiver for the existing disposable CI application. No server ingestion claim. */
export type OtlpSpan = {
  name: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  attributes: Array<{ key: string; value: { stringValue?: string; boolValue?: boolean; intValue?: string; doubleValue?: number } }>;
};

type OtlpPayload = { resourceSpans: Array<{ scopeSpans: Array<{ spans: OtlpSpan[] }> }> };
export type CapturedExport = { raw: string; spans: OtlpSpan[]; responseStatus: 200 | 401 | 500 };

export interface LangfuseCapture {
  exports: CapturedExport[];
  errors: string[];
  respondWith(status: 200 | 401 | 500): void;
  close(): Promise<void>;
}

export function spanAttributes(span: OtlpSpan): Record<string, string | boolean | number | undefined> {
  return Object.fromEntries(span.attributes.map(({ key, value }) => [key, value.stringValue ?? value.boolValue ?? value.intValue ?? value.doubleValue]));
}

/** The installed SDK's documented createTraceId(seed) contract: first 128 bits of SHA-256. */
export function messageTraceId(messageId: string): string {
  return createHash("sha256").update(messageId, "utf8").digest("hex").slice(0, 32);
}

export async function startLangfuseCapture(port: number): Promise<LangfuseCapture> {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error("E2E_LANGFUSE_CAPTURE_PORT must name an explicit unprivileged loopback port");
  }
  const exports: CapturedExport[] = [];
  const errors: string[] = [];
  let responseStatus: 200 | 401 | 500 = 200;
  const server: Server = createServer((request, response) => {
    // Never proxy or redirect. This fixture cannot publish outside its own process.
    if (request.method !== "POST" || request.url !== "/api/public/otel/v1/traces") {
      errors.push("unexpected exporter method or path");
      response.writeHead(404).end();
      return;
    }
    const chunks: Buffer[] = [];
    let bytes = 0;
    request.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 2 * 1024 * 1024) {
        errors.push("synthetic export exceeded the 2 MiB request bound");
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("error", () => errors.push("export request ended before its complete body"));
    request.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      try {
        if (!String(request.headers["content-type"] ?? "").includes("application/json")) {
          throw new Error("expected JSON OTLP");
        }
        const payload = JSON.parse(raw) as OtlpPayload;
        const spans = payload.resourceSpans.flatMap(({ scopeSpans }) => scopeSpans.flatMap(({ spans }) => spans));
        if (!Array.isArray(spans) || spans.some((span) => !span.name || !span.traceId || !Array.isArray(span.attributes))) {
          throw new Error("invalid OTLP span shape");
        }
        if (exports.length >= 512) throw new Error("synthetic export exceeded its 512 request bound");
        exports.push({ raw, spans, responseStatus });
        response.writeHead(responseStatus, { "content-type": "application/json" });
        response.end(responseStatus === 200 ? "{}" : JSON.stringify({ error: "synthetic observability failure" }));
      } catch {
        errors.push("invalid or oversized synthetic OTLP export");
        response.writeHead(400).end();
      }
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  return {
    exports,
    errors,
    respondWith(status) { responseStatus = status; },
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    },
  };
}
