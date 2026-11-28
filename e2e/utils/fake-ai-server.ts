import { createServer, type Server } from "node:http";
import { env } from "./env";

/*
 * A local stand-in for an OpenAI-compatible /v1/chat/completions endpoint, so a Zyra chat turn can
 * be driven through the REAL router and generation code (buildZyraChatDecision,
 * applyZyraChatOperations, zyraSaveAttempt) without a live provider call or spend.
 *
 * docs/e2e-coverage-waves.md, Wave 0 item 3 — the prerequisite api/zyra-chat-consistency.spec.ts's
 * own header names as missing: "the 'reply claimed 15, saved 10' half of the report is out of reach
 * until utils/fake-ai-server.ts exists". This is that file.
 *
 * Modelled directly on the embeddings stub in api/kb-embeddings.spec.ts (startEmbeddingStub) — same
 * reason for host.docker.internal (the backend runs in a container; `localhost`/`127.0.0.1` there is
 * the container, not this process), same 0.0.0.0 bind so the container's Docker bridge can reach it,
 * same per-test throwaway server. Generalized here into e2e/utils because more than one spec needs a
 * scripted model now (chat router + chat generation, in the same turn).
 *
 * Responses are scripted per test via queueReply(), served FIFO. A caller doesn't need to know
 * whether a given HTTP call is the chat router or a follow-up drafting call (buildZyraChatDecision
 * dispatches "create" to a second call, generateZyraChatTestcasesWithAi) — it queues as many
 * responses as the scenario needs, in the order the backend will make the calls, and this server
 * hands them out one per request.
 */

export interface FakeAiRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  /** Whether the backend asked for a streamed (server-sent events) reply. */
  stream?: boolean;
}

export interface FakeAiEmbeddingRequest {
  model: string;
  /** The texts the backend asked to embed, normalized to an array. */
  input: string[];
}

export interface FakeAiServer {
  /** Pass as `baseUrl` when creating a workspace AI key (provider "openai" or a custom gateway). */
  baseUrl: string;
  /**
   * The same endpoint as reached from wherever the backend runs: `baseUrl` for the containerized
   * local stack, loopback when the backend is a host process (every CI workflow).
   */
  backendBaseUrl: string;
  /** Direct HTTP endpoint for the test runner, even when the backend runs in Docker. */
  runnerBaseUrl: string;
  /** Every chat-completion request this server received, in arrival order — for asserting on what the backend sent. */
  requests: FakeAiRequest[];
  /**
   * Every POST .../embeddings this server received — kept apart from `requests` and the reply queue.
   * With an embeddings-capable provider ("openai"), the backend embeds the user's message for
   * knowledge-base search and embeds newly written KB documents in the background; before this
   * split those calls were served from the same FIFO queue and could consume a reply scripted for
   * the router. Answered 503 by default, so retrieval degrades to keyword search (it never throws) and
   * a test can assert whether a KB search was attempted at all by looking here.
   */
  embeddingRequests: FakeAiEmbeddingRequest[];
  /** Multipart transcription requests, isolated from chat and embedding fixtures. */
  transcriptionRequests: Array<{ contentType: string; body: string }>;
  /**
   * Queue one scripted chat-completion reply, consumed FIFO. `content` becomes
   * `choices[0].message.content` verbatim — pass the JSON envelope buildZyraChatDecision (or
   * generateZyraChatTestcasesWithAi) expects, as an object (JSON-stringified here) or a raw string
   * for a test that wants to exercise the "model returned prose instead of JSON" fallback.
   */
  queueReply(content: Record<string, unknown> | string): void;
  /** Queue one HTTP 200 JSON embedding response, separate from chat replies and endpoint failures. */
  queueEmbeddingReply(content: Record<string, unknown>): void;
  /** Set to a status code to make the NEXT call fail (consumed once), exercising the error path. */
  failNextWith(status: number, message?: string, endpoint?: "chat" | "embedding" | "transcription"): void;
  /**
   * Delays the NEXT call's response by `ms` (consumed once), so a test can deterministically observe
   * "this call is genuinely still in flight" — e.g. asserting that stopping a background batch plan
   * while one of its batches is mid-request lets that one finish but stops the next — without racing
   * real wall-clock timing against however fast this server happens to answer.
   */
  delayNextReplyMs(ms: number): void;
  /**
   * A reply for whichever request's prompt contains `match` — checked before the FIFO queue, in the
   * order queued, each consumed once. For calls the backend makes in parallel (a plan batch's pieces)
   * or interleaved with others (each generation's memory call), where FIFO order is not fixed.
   * `{ failStatus }` answers that request with that error status instead.
   */
  queueReplyMatching(match: string, reply: Record<string, unknown> | string | { failStatus: number; message?: string }): void;
  /**
   * A streamed reply (the request asked for `stream`) is sent in chunks; this pauses between them, so
   * a test can watch what the backend shows while a reply is still arriving. Lasts until reset().
   */
  setStreamChunkDelayMs(ms: number): void;
  /**
   * Clears the queued replies and the request log (`requests.length = 0` in place — existing
   * references to `ai.requests` keep working after a reset) and cancels any pending `failNextWith`.
   *
   * Found by review, before a real run ever caught it: `requests` is append-only for the life of
   * the server, and every describe block here shares ONE server instance across all its tests
   * (`fullyParallel: false` serialises them in one worker, so nothing else resets it between tests)
   * — every `expect(ai.requests.length).toBe(N)` assertion in this suite was actually asserting
   * against the CUMULATIVE count across every test that ran before it in the same file, not the
   * count for that one test. Call this in `beforeEach` for any describe block that asserts on
   * `ai.requests.length`.
   */
  reset(): void;
  close(): Promise<void>;
}

export async function startFakeAiServer(): Promise<FakeAiServer> {
  const queue: string[] = [];
  const requests: FakeAiRequest[] = [];
  const embeddingRequests: FakeAiEmbeddingRequest[] = [];
  const embeddingReplies: string[] = [];
  const transcriptionRequests: Array<{ contentType: string; body: string }> = [];
  const endpointFailures = new Map<string, { status: number; message: string }>();
  let failStatus: number | null = null;
  let failMessage = "stubbed provider failure";
  let delayMs: number | null = null;
  let streamChunkDelayMs = 0;
  const matched: Array<{ match: string; reply: string | { failStatus: number; message?: string } }> = [];

  const server: Server = createServer((req, res) => {
    if (req.method !== "POST") {
      res.writeHead(404).end();
      return;
    }
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      if ((req.url || "").split("?")[0].endsWith("/audio/transcriptions")) {
        transcriptionRequests.push({ contentType: String(req.headers["content-type"] || ""), body: raw });
        const failure = endpointFailures.get("transcription") ?? { status: 503, message: "fake-ai-server does not serve transcription" };
        endpointFailures.delete("transcription");
        res.writeHead(failure.status, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: { message: failure.message } }));
        return;
      }
      if ((req.url || "").split("?")[0].endsWith("/embeddings")) {
        // Never consumes the chat reply queue, a pending failNextWith, or a pending delay.
        let parsed: { model?: unknown; input?: unknown } = {};
        try {
          parsed = JSON.parse(raw || "{}");
        } catch {
          // Logged with no input — still counts as "an embeddings call was attempted".
        }
        const input = Array.isArray(parsed.input) ? parsed.input.map(String) : parsed.input === undefined ? [] : [String(parsed.input)];
        embeddingRequests.push({ model: String(parsed.model || ""), input });
        const scriptedFailure = endpointFailures.get("embedding");
        endpointFailures.delete("embedding");
        // Like chat, a one-shot failure takes precedence without consuming a queued reply.
        if (!scriptedFailure && embeddingReplies.length) {
          res.writeHead(200, { "content-type": "application/json" });
          res.end(embeddingReplies.shift());
          return;
        }
        const failure = scriptedFailure ?? { status: 503, message: "fake-ai-server does not serve embeddings" };
        res.writeHead(failure.status, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: { message: failure.message } }));
        return;
      }
      const thisDelay = delayMs;
      delayMs = null;
      let body: FakeAiRequest;
      try {
        body = JSON.parse(raw || "{}");
      } catch {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: { message: "invalid JSON body" } }));
        return;
      }
      // Logged the moment the request body has fully arrived, BEFORE any delay — this is what makes
      // delayNextReplyMs useful: a test can poll `ai.requests.length` to learn "this call has
      // definitely started" and act (e.g. call stop-plan) while the RESPONSE is still being held
      // back, rather than only finding out once it's too late to matter.
      requests.push({ model: String(body.model || ""), messages: Array.isArray(body.messages) ? body.messages : [], stream: body.stream === true });
      const prompt = JSON.stringify(body.messages ?? []);
      const matchIndex = matched.findIndex((entry) => prompt.includes(entry.match));
      const matchedReply = matchIndex >= 0 ? matched.splice(matchIndex, 1)[0].reply : undefined;
      // Reserve the outcome at request arrival, not response delivery. Otherwise a
      // later fast request steals the delayed request's FIFO reply or one-shot error.
      const matchedFailure = matchedReply !== undefined && typeof matchedReply !== "string" ? matchedReply : undefined;
      const failure = matchedFailure
        ? { status: matchedFailure.failStatus, message: matchedFailure.message || "stubbed provider failure" }
        : failStatus !== null ? { status: failStatus, message: failMessage } : undefined;
      if (!matchedFailure && failStatus !== null) failStatus = null;
      const next = failure ? undefined : typeof matchedReply === "string" ? matchedReply : queue.shift();
      const respond = () => {
        if (failure) {
          res.writeHead(failure.status, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: { message: failure.message } }));
          return;
        }
        const content = next ?? JSON.stringify({
          reply: "fake-ai-server: no scripted response was queued for this call.",
          reasoningSummary: "fake-ai-server exhausted its queue.",
          action: "answer",
          actionType: "answer",
          operations: [],
          testcases: []
        });
        if (body.stream === true) {
          // The OpenAI streaming shape: content deltas, then a usage-only chunk, then [DONE].
          res.writeHead(200, { "content-type": "text/event-stream" });
          const pieces = content.match(/[\s\S]{1,200}/g) ?? [""];
          const events = [
            ...pieces.map((delta) => ({ id: "fake-chatcmpl", object: "chat.completion.chunk", choices: [{ index: 0, delta: { content: delta } }] })),
            { id: "fake-chatcmpl", object: "chat.completion.chunk", choices: [], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }
          ];
          const send = (index: number) => {
            if (index >= events.length) {
              res.end("data: [DONE]\n\n");
              return;
            }
            res.write(`data: ${JSON.stringify(events[index])}\n\n`);
            if (streamChunkDelayMs > 0) setTimeout(() => send(index + 1), streamChunkDelayMs);
            else send(index + 1);
          };
          send(0);
          return;
        }
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({
          id: "fake-chatcmpl",
          object: "chat.completion",
          choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
        }));
      };
      if (thisDelay && thisDelay > 0) setTimeout(respond, thisDelay);
      else respond();
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "0.0.0.0", resolve));
  const port = (server.address() as { port: number }).port;
  const runnerBaseUrl = `http://127.0.0.1:${port}/v1`;
  const baseUrl = `http://host.docker.internal:${port}/v1`;

  return {
    baseUrl,
    backendBaseUrl: env.ci ? runnerBaseUrl : baseUrl,
    runnerBaseUrl,
    requests,
    embeddingRequests,
    transcriptionRequests,
    queueReply(content) {
      queue.push(typeof content === "string" ? content : JSON.stringify(content));
    },
    queueEmbeddingReply(content) {
      embeddingReplies.push(JSON.stringify(content));
    },
    failNextWith(status, message, endpoint = "chat") {
      if (endpoint !== "chat") {
        endpointFailures.set(endpoint, { status, message: message || "stubbed provider failure" });
        return;
      }
      failStatus = status;
      if (message) failMessage = message;
    },
    delayNextReplyMs(ms) {
      delayMs = ms;
    },
    queueReplyMatching(match, reply) {
      matched.push({ match, reply: typeof reply === "string" ? reply : "failStatus" in reply ? (reply as { failStatus: number; message?: string }) : JSON.stringify(reply) });
    },
    setStreamChunkDelayMs(ms) {
      streamChunkDelayMs = ms;
    },
    reset() {
      queue.length = 0;
      requests.length = 0;
      embeddingRequests.length = 0;
      embeddingReplies.length = 0;
      transcriptionRequests.length = 0;
      endpointFailures.clear();
      failStatus = null;
      failMessage = "stubbed provider failure";
      delayMs = null;
      matched.length = 0;
      streamChunkDelayMs = 0;
    },
    close() {
      return new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  };
}
