import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const requireFrontend = createRequire(new URL("../Tesbo-Frontend/package.json", import.meta.url));
const ts = requireFrontend("typescript");
const source = readFileSync(new URL("../Tesbo-Frontend/lib/documentWriteQueue.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { DocumentWriteQueue, DocumentWriteCancelledError } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test("different save revisions serialize without overlapping their writers", async () => {
  const queue = new DocumentWriteQueue(), first = deferred(), started = deferred(), calls = [];
  const a = queue.save(1, async () => { calls.push("first"); started.resolve(); return first.promise; });
  await started.promise;
  const b = queue.save(2, async () => { calls.push("second"); return "B"; });
  await Promise.resolve();
  assert.deepEqual(calls, ["first"]);
  first.resolve("A");
  assert.deepEqual(await Promise.all([a, b]), ["A", "B"]);
  assert.deepEqual(calls, ["first", "second"]);
});

test("same in-flight revision shares one write, but an explicit later save remains a new command", async () => {
  const queue = new DocumentWriteQueue(), first = deferred();
  let calls = 0;
  const a = queue.save(1, async () => { calls++; return first.promise; });
  const b = queue.save(1, async () => { calls++; return "must not run"; });
  assert.equal(a, b);
  first.resolve("first"); await a;
  assert.equal(await queue.save(1, async () => { calls++; return "explicit later"; }), "explicit later");
  assert.equal(calls, 2);
});

test("restore drains prior saves, blocks later saves synchronously, then permits new edits", async () => {
  const queue = new DocumentWriteQueue(), first = deferred(), calls = [];
  const a = queue.save(1, async () => { calls.push("save"); return first.promise; });
  const restored = queue.restore(async () => { calls.push("restore"); return "restored"; });
  await assert.rejects(queue.save(2, async () => "must not run"), DocumentWriteCancelledError);
  await Promise.resolve(); assert.deepEqual(calls, ["save"]);
  first.resolve("old draft"); await a;
  assert.equal(await restored, "restored");
  assert.equal(await queue.save(3, async () => "new edit"), "new edit");
  assert.deepEqual(calls, ["save", "restore"]);
});

test("a prior failed write prevents an already-confirmed restore from being dispatched", async () => {
  const queue = new DocumentWriteQueue(), first = deferred(), error = new Error("Request outcome unconfirmed");
  const a = queue.save(1, () => first.promise);
  let calls = 0;
  const restored = queue.restore(async () => { calls++; return "must not run"; });
  const refusedA = assert.rejects(a, (e) => e === error), refusedRestore = assert.rejects(restored, (e) => e === error);
  first.reject(error);
  await Promise.all([refusedA, refusedRestore]);
  assert.equal(calls, 0);
  assert.equal(await queue.restore(async () => { calls++; return "explicit later restore"; }), "explicit later restore");
  assert.equal(calls, 1);
});

test("queued saves are not automatically sent after an earlier failed write", async () => {
  const queue = new DocumentWriteQueue(), first = deferred(), error = new Error("server refusal");
  const a = queue.save(1, () => first.promise);
  let calls = 0;
  const b = queue.save(2, async () => { calls++; return "must not run"; });
  const refusedA = assert.rejects(a, (e) => e === error), refusedB = assert.rejects(b, (e) => e === error);
  first.reject(error); await Promise.all([refusedA, refusedB]);
  assert.equal(calls, 0);
  assert.equal(await queue.save(2, async () => "explicit later save"), "explicit later save");
});

test("a debounce ticket captured before failure cannot dispatch afterward; a genuinely new edit can", async () => {
  const queue = new DocumentWriteQueue(), ticket = queue.capture();
  await assert.rejects(queue.save(1, async () => { throw new Error("failed"); }));
  let calls = 0;
  await assert.rejects(queue.save(2, async () => { calls++; return "stale timer"; }, ticket));
  assert.equal(calls, 0);
  assert.equal(await queue.save(3, async () => { calls++; return "new edit"; }, queue.capture()), "new edit");
  assert.equal(calls, 1);
});

test("closing drains already-requested edits and rejects new submissions", async () => {
  const queue = new DocumentWriteQueue(), first = deferred(), started = deferred();
  const a = queue.save(1, async () => { started.resolve(); return first.promise; });
  await started.promise;
  let calls = 0;
  const b = queue.save(2, async () => { calls++; return "queued edit"; });
  queue.close(); first.resolve("already applied");
  assert.equal(await a, "already applied"); assert.equal(await b, "queued edit");
  await assert.rejects(queue.save(3, async () => "must not run"), DocumentWriteCancelledError);
  await assert.rejects(queue.restore(async () => "must not run"), DocumentWriteCancelledError);
  assert.equal(calls, 1);
});

test("a failed restore clears its barrier and can be explicitly resubmitted once", async () => {
  const queue = new DocumentWriteQueue();
  let calls = 0;
  await assert.rejects(queue.restore(async () => { calls++; throw new Error("refused"); }));
  assert.equal(await queue.restore(async () => { calls++; return "explicit retry"; }), "explicit retry");
  assert.equal(calls, 2);
});

test("two restore submissions cannot overlap or turn into two queued restores", async () => {
  const queue = new DocumentWriteQueue(), pending = deferred();
  const a = queue.restore(() => pending.promise);
  await assert.rejects(queue.restore(async () => "must not run"), DocumentWriteCancelledError);
  pending.resolve("restored"); assert.equal(await a, "restored");
});

test("a synchronous writer failure is observable and does not strand later explicit work", async () => {
  const queue = new DocumentWriteQueue();
  await assert.rejects(queue.save(1, () => { throw new Error("sync fault"); }), /sync fault/);
  assert.equal(await queue.save(2, async () => "later explicit edit"), "later explicit edit");
});

test("independent documents have independent ordering and failure state", async () => {
  const a = new DocumentWriteQueue(), b = new DocumentWriteQueue(), pending = deferred();
  const writing = a.save(1, () => pending.promise);
  assert.equal(await b.save(1, async () => "other document"), "other document");
  pending.resolve("first document"); assert.equal(await writing, "first document");
});
