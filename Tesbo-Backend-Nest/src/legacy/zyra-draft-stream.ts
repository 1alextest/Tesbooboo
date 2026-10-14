import { AsyncLocalStorage } from "async_hooks";

/*
 * Live drafts: test cases added to the review batch as the model finishes writing each one, instead of
 * only once the whole batch is parsed and staged ("[Zyra] Stream Main Test Case Review UI
 * Progressively During Generation").
 *
 *   - ZyraDraftStreamParser reads the model's streamed `{"drafts":[…]}` text as it arrives and hands
 *     back each draft object — with its position in the array — the moment its closing brace does.
 *     Only whole, parseable objects come out: a draft still being written, or one cut off by a failed
 *     stream, never does.
 *
 *   - The draft sink receives those drafts for one generation call. generateZyraChatTestcasesWithAi
 *     sets it around each call when a live batch is in scope.
 *
 *   - The live batch (ZyraLiveBatch) is the review batch being filled: set once where Zyra work starts
 *     — a watched chat turn, a background plan batch — and read where drafts are produced, rather than
 *     threaded through every signature in between. It stages each draft through the normal staging
 *     path (applyZyraChatOperations) into one ai_generation_requests row, so what the review panel
 *     shows is what Save saves. No live batch (an API/MCP caller, a test) means no parsing and the
 *     batch is staged whole at the end, exactly as before.
 */

export type ZyraDraftSink = (draft: Record<string, unknown>, index: number) => void;

const sinkStore = new AsyncLocalStorage<ZyraDraftSink | undefined>();

export function runWithZyraDraftSink<T>(sink: ZyraDraftSink, fn: () => T): T {
  return sinkStore.run(sink, fn);
}

/** For a call whose output must not reach the live batch (a revision of drafts already decided). */
export function runWithoutZyraDraftSink<T>(fn: () => T): T {
  return sinkStore.run(undefined, fn);
}

export function zyraDraftSink(): ZyraDraftSink | undefined {
  return sinkStore.getStore();
}

/** The review batch being filled while generation runs — see LegacyService.createZyraLiveBatch. */
export interface ZyraLiveBatch {
  /** How many test cases this batch was asked for — the "of N" in progress. */
  total: number;
  /** Stages one create operation; resolves to the staged review row, or null when nothing was staged. */
  stage(operation: Record<string, unknown>, scenario: number | null): Promise<Record<string, unknown> | null>;
  /** Registers in-flight work the batch must wait for before it is reconciled. */
  track(work: Promise<unknown>): void;
  /** Resolves once every tracked draft has been staged or dropped. */
  idle(): Promise<void>;
  /** The review batch's id, once its first draft created it. */
  reviewRequestId(): string | null;
  /** Activity of the drafts staged since the last call, for the turn's own activity log. */
  takeActivity(): Array<Record<string, unknown>>;
  /** Batch-wide scenario numbers (1-based) of the drafts staged so far. */
  stagedScenarios(): number[];
  stagedCount(): number;
}

const liveStore = new AsyncLocalStorage<ZyraLiveBatch | undefined>();

export function runWithZyraLiveBatch<T>(batch: ZyraLiveBatch | undefined, fn: () => T): T {
  return liveStore.run(batch, fn);
}

export function zyraLiveBatch(): ZyraLiveBatch | undefined {
  return liveStore.getStore();
}

/**
 * Incremental reader for one streamed generation response. Tracks JSON structure (objects, arrays,
 * strings and their escapes) across arbitrary chunk boundaries, finds the top-level "drafts" array,
 * and returns every element object completed by the text pushed so far, with its index in that array
 * (counting every element, so an index matches the final parse's). Text outside the JSON (a code
 * fence, a preamble) is skipped. Never throws: an element that does not parse is dropped here and left
 * to the final parse to judge.
 */
export class ZyraDraftStreamParser {
  private text = "";
  private index = 0;
  private readonly stack: Array<"object" | "array"> = [];
  private inString = false;
  private escaped = false;
  private stringStart = -1;
  private lastTopLevelKey: string | null = null;
  // Stack depth of the open "drafts" array, or -1; where the element being read starts; elements seen.
  private draftsDepth = -1;
  private draftStart = -1;
  private elements = 0;

  push(chunk: string): Array<{ draft: Record<string, unknown>; index: number }> {
    this.text += chunk;
    const done: Array<{ draft: Record<string, unknown>; index: number }> = [];
    for (; this.index < this.text.length; this.index++) {
      const ch = this.text[this.index];
      if (this.inString) {
        if (this.escaped) this.escaped = false;
        else if (ch === "\\") this.escaped = true;
        else if (ch === '"') {
          this.inString = false;
          // A string directly inside the top-level object is a key or a value; the key before "[" is what counts.
          if (this.stack.length === 1) this.lastTopLevelKey = this.text.slice(this.stringStart + 1, this.index);
        }
        continue;
      }
      if (ch === '"') {
        if (!this.stack.length) continue;
        this.inString = true;
        this.stringStart = this.index;
      } else if (ch === "{") {
        if (this.draftsDepth >= 0 && this.stack.length === this.draftsDepth) this.draftStart = this.index;
        this.stack.push("object");
      } else if (ch === "[") {
        if (!this.stack.length) continue;
        this.stack.push("array");
        if (this.draftsDepth < 0 && this.stack.length === 2 && this.lastTopLevelKey === "drafts") this.draftsDepth = 2;
      } else if (ch === "}" || ch === "]") {
        if (!this.stack.length) continue;
        this.stack.pop();
        if (ch === "]" && this.draftsDepth > this.stack.length) this.draftsDepth = -1;
        if (ch === "}" && this.draftStart >= 0 && this.stack.length === this.draftsDepth) {
          const elementIndex = this.elements++;
          try {
            const parsed = JSON.parse(this.text.slice(this.draftStart, this.index + 1)) as unknown;
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) done.push({ draft: parsed as Record<string, unknown>, index: elementIndex });
          } catch {
            // Not valid on its own — the final parse decides what it was.
          }
          this.draftStart = -1;
        }
      }
    }
    return done;
  }
}

/**
 * A text feed for one streamed response when a sink is listening, else undefined (so a caller can
 * skip asking for a stream at all). Each draft the parser completes goes to the sink; a sink that
 * throws costs the live view, never the generation.
 */
export function zyraLiveDraftFeed(): ((text: string) => void) | undefined {
  const sink = zyraDraftSink();
  if (!sink) return undefined;
  const parser = new ZyraDraftStreamParser();
  return (text) => {
    for (const { draft, index } of parser.push(text)) {
      try {
        sink(draft, index);
      } catch {
        // A live preview is best-effort.
      }
    }
  };
}
