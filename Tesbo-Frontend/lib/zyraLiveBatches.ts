import type { ZyraChatTestcaseRow } from "@/lib/api";

/*
 * Live updates for Zyra review batches that are still being generated ("[Zyra] Stream Main Test Case
 * Review UI Progressively During Generation"). The chat page receives them on its turn and plan event
 * streams and publishes them here, keyed by the batch's review id; each ZyraChatReviewPanel showing
 * that batch subscribes. The server stays the source of truth — a panel that misses an event, or sees
 * one it can't place, re-reads the batch.
 *
 * Also keeps a panel's selection across remounts, so the panel shown while a turn is running and the
 * one in the turn's reply (the same batch) don't make the user re-select.
 */

export type ZyraLiveBatchEvent =
  | { kind: "draft"; row: ZyraChatTestcaseRow; staged: number; total: number }
  | { kind: "done" };

type Listener = (event: ZyraLiveBatchEvent) => void;

const listeners = new Map<string, Set<Listener>>();
const progress = new Map<string, { staged: number; total: number; done: boolean }>();
const selections = new Map<string, { selected: number[]; count: number }>();

export function publishZyraLiveBatch(reviewRequestId: string, event: ZyraLiveBatchEvent): void {
  if (event.kind === "draft") progress.set(reviewRequestId, { staged: event.staged, total: event.total, done: false });
  else {
    const current = progress.get(reviewRequestId);
    if (current) progress.set(reviewRequestId, { ...current, done: true });
  }
  listeners.get(reviewRequestId)?.forEach((listener) => {
    try {
      listener(event);
    } catch {
      // One panel's failure never stops another's update.
    }
  });
}

export function subscribeZyraLiveBatch(reviewRequestId: string, listener: Listener): () => void {
  const set = listeners.get(reviewRequestId) ?? new Set<Listener>();
  set.add(listener);
  listeners.set(reviewRequestId, set);
  return () => {
    set.delete(listener);
    if (!set.size) listeners.delete(reviewRequestId);
  };
}

/** The latest progress seen for a batch still being generated, or null when none is known. */
export function zyraLiveBatchProgress(reviewRequestId: string): { staged: number; total: number } | null {
  const current = progress.get(reviewRequestId);
  return current && !current.done ? { staged: current.staged, total: current.total } : null;
}

export function rememberZyraSelection(reviewRequestId: string, selected: number[], count: number): void {
  selections.set(reviewRequestId, { selected, count });
}

export function recallZyraSelection(reviewRequestId: string): { selected: number[]; count: number } | null {
  return selections.get(reviewRequestId) ?? null;
}
