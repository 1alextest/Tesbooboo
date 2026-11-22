/** Test-only native Node worker; loaded with the existing ts-node register hook. */
const assert = require("node:assert/strict");
const { recordStandaloneGeneration, recordStandaloneTool } = require("../ai-trace.ts");
const { tracedEmbeddingCall } = require("../embedding-trace.ts");
const { flushLangfuse, isTracingEnabled, startLangfuse, stopLangfuse } = require("../langfuse.ts");

async function capture() {
  const endpoint = new URL(process.env.LANGFUSE_BASE_URL);
  let networkAttempts = 0;
  if (process.env.CAPTURE_EXPECT_CLOUD_REFUSAL === "true") {
    assert.equal(endpoint.protocol, "https:");
    assert.match(endpoint.hostname, /^(?:us\.)?cloud\.langfuse\.com\.?$/);
    // A guard regression must never turn this negative fixture into an external request.
    const denyNetwork = () => {
      networkAttempts += 1;
      throw new Error("Cloud-refusal fixture forbids every network attempt");
    };
    require("node:http").request = denyNetwork;
    require("node:http").get = denyNetwork;
    require("node:https").request = denyNetwork;
    require("node:https").get = denyNetwork;
    globalThis.fetch = denyNetwork;
  } else {
    assert.equal(endpoint.protocol, "http:");
    assert.equal(endpoint.hostname, "127.0.0.1");
  }
  assert.equal(process.env.LANGFUSE_SEED_MODEL_PRICES, "false");

  await startLangfuse();
  try {
    if (process.env.CAPTURE_EXPECT_DISABLED === "true") {
      assert.equal(isTracingEnabled(), false, "tracing requires an explicit opt-in even when credentials exist");
      await recordStandaloneTool({
        traceSeed: "capture-disabled-message",
        name: "capture.disabled.tool",
        output: { preserved: true }
      });
      await flushLangfuse();
      process.send({ disabled: true });
      return;
    }
    assert.equal(isTracingEnabled(), true, "real SDK startup must succeed");
    const { createTraceId } = require("@langfuse/tracing");
    const primarySeed = "capture-native-message-one";
    const otherSeed = "capture-native-message-two";
    const metadata = {
      organizationId: "capture-organization",
      projectId: "capture-project",
      sessionId: "capture-session",
      userId: "capture-user",
      planId: "p".repeat(300),
      apiKey: "synthetic-unapproved-metadata-must-not-export",
      authorization: "Bearer synthetic.capture.bearer.12345"
    };
    await recordStandaloneGeneration({
      traceSeed: primarySeed,
      name: "capture.generation.success",
      provider: "synthetic-provider",
      model: "synthetic-model",
      input: { prompt: "synthetic input sk-ant-synthetic_capture_input_12345" },
      output: { answer: "synthetic output sk-synthetic_capture_output_12345" },
      usage: { input: 11, output: 7, cached: 3 },
      metadata
    });
    await recordStandaloneTool({
      traceSeed: primarySeed,
      name: "capture.tool.success",
      input: { authorization: "Bearer synthetic.capture.bearer.12345" },
      output: { completed: true, nested: { value: "sk-synthetic_capture_output_12345" } },
      metadata
    });
    await recordStandaloneGeneration({
      traceSeed: otherSeed,
      name: "capture.generation.failure",
      provider: "synthetic-provider",
      model: "synthetic-model",
      errorMessage: "synthetic provider failure sk-ant-synthetic_capture_input_12345",
      output: { partial: "sk-synthetic_capture_output_12345" },
      metadata: { ...metadata, sessionId: "capture-other-session", userId: "capture-other-user" }
    });
    await recordStandaloneTool({
      traceSeed: otherSeed,
      name: "capture.tool.failure",
      errorMessage: "synthetic operation failure Bearer synthetic.capture.bearer.12345",
      output: { partial: "sk-synthetic_capture_output_12345" },
      metadata: { ...metadata, sessionId: "capture-other-session", userId: "capture-other-user" }
    });
    const originalEmbeddingError = new Error("synthetic embedding failure sk-synthetic_capture_embedding_failure_12345 Bearer synthetic.capture.embedding.bearer.12345");
    let embeddingProviderCalls = 0;
    let embeddingRejectionPreserved = false;
    await assert.rejects(tracedEmbeddingCall({
      traceSeed: otherSeed,
      name: "capture.embedding.failure",
      projectId: "capture-project",
      organizationId: "capture-organization",
      provider: "synthetic-provider",
      model: "synthetic-embedding-model",
      inputCount: 1,
      inputSample: "synthetic embedding input sk-ant-synthetic_capture_input_12345"
    }, async () => {
      embeddingProviderCalls += 1;
      throw originalEmbeddingError;
    }), (error) => {
      embeddingRejectionPreserved = error === originalEmbeddingError;
      return embeddingRejectionPreserved;
    });
    assert.equal(embeddingProviderCalls, 1, "tracing must call the embedding provider exactly once");
    await flushLangfuse();
    process.send({
      primaryTraceId: await createTraceId(primarySeed),
      otherTraceId: await createTraceId(otherSeed),
      embeddingProviderCalls,
      embeddingRejectionPreserved
    });
  } finally {
    await stopLangfuse();
    assert.equal(isTracingEnabled(), false);
    assert.equal(networkAttempts, 0, "cloud refusal must happen before any request");
  }
}

void capture().then(
  () => process.disconnect(),
  (error) => { console.error(error); process.exitCode = 1; process.disconnect(); }
);
