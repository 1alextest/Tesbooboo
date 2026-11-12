/** Per-mounted-document ordering, not a global mutation retry or server idempotency policy. */
export class DocumentWriteCancelledError extends Error {}

export class DocumentWriteQueue<Result> {
  private tail: Promise<unknown> = Promise.resolve();
  private saves = new Map<number, { generation: number; result: Promise<Result> }>();
  private generation = 0;
  private failure: unknown;
  private restoring = false;
  private closed = false;

  /** Capture when an edit/explicit action occurs, not when its debounce eventually fires. */
  capture(): number {
    return this.generation;
  }

  save(revision: number, write: () => Promise<Result>, generation = this.capture()): Promise<Result> {
    if (this.closed || this.restoring) return Promise.reject(new DocumentWriteCancelledError("Document writer is unavailable during restore or navigation."));
    const pending = this.saves.get(revision);
    if (pending?.generation === generation) return pending.result; // Same local revision in flight.
    const result = this.enqueue(write, generation);
    this.saves.set(revision, { generation, result });
    const clear = () => { if (this.saves.get(revision)?.result === result) this.saves.delete(revision); };
    void result.then(clear, clear);
    return result;
  }

  restore(write: () => Promise<Result>): Promise<Result> {
    if (this.closed || this.restoring) return Promise.reject(new DocumentWriteCancelledError("A document restore is already pending or the page has closed."));
    this.restoring = true; // Barrier is synchronous, ahead of React's disabled controls.
    const result = this.enqueue(write, this.capture());
    void result.then(() => { this.restoring = false; }, () => { this.restoring = false; });
    return result;
  }

  close(): void {
    // Navigation refuses new submissions, but drains previously requested work to its original
    // document. Closing the page must not silently discard a queued user edit.
    this.closed = true;
  }

  private enqueue(write: () => Promise<Result>, generation: number): Promise<Result> {
    const result = this.tail.then(async () => {
      // Do not start an already-queued command after an earlier write fails (its outcome may be
      // unconfirmed). A NEW edit or explicit action after the failure captures the new generation.
      if (generation !== this.generation) throw this.failure;
      try {
        return await write(); // Exactly one invocation; no automatic resubmission/retry.
      } catch (error) {
        this.failure = error;
        this.generation++;
        throw error;
      }
    });
    this.tail = result.then(() => undefined, () => undefined);
    return result;
  }
}
