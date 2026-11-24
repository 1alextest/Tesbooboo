/*
 * Regression coverage for the enqueue generation in the job id.
 *
 * The bug this pins: BullMQ dedupes an add against EVERY job with the same jobId that still
 * exists, including completed ones retained by removeOnComplete. With a fixed `testcase-<id>`
 * id, editing a case after its create-job completed left the row at embedding_status='queued'
 * (the status UPDATE ran) while the add was silently dropped — no embedding refresh and no
 * return to 'pending'. The e2e fixture in e2e/utils/zyra-answer-feedback.ts exposed it in CI.
 *
 * These tests use a mocked queue so they assert our side of the contract: each write generation
 * gets its own id, and only enqueues sharing a generation coalesce.
 */

import type { Queue } from "bullmq";
import type { DatabaseService } from "../database/database.service";
import { RagIngestionService } from "./rag-ingestion.service";
import { RAG_EMBEDDING_JOB_NAME, RAG_TESTCASE_EMBEDDING_JOB_NAME } from "./rag.constants";

function fixture(generations: string[]) {
  const query = jest.fn();
  for (const generation of generations) query.mockResolvedValueOnce({ rows: [{ generation }] });
  const add = jest.fn().mockResolvedValue(undefined);
  const service = new RagIngestionService(
    { add } as unknown as Queue,
    { query } as unknown as DatabaseService
  );
  return { service, query, add };
}

function jobIds(add: jest.Mock): string[] {
  return add.mock.calls.map(([, , options]) => (options as { jobId: string }).jobId);
}

describe("RagIngestionService — enqueue generations", () => {
  it("gives a later testcase edit a different job id from the create", async () => {
    const { service, add } = fixture(["1000", "2000"]);

    await service.enqueueTestcaseEmbedding({ projectId: "p", testcaseId: "t", reason: "created" });
    await service.enqueueTestcaseEmbedding({ projectId: "p", testcaseId: "t", reason: "updated" });

    expect(add.mock.calls.map(([name]) => name)).toEqual([RAG_TESTCASE_EMBEDDING_JOB_NAME, RAG_TESTCASE_EMBEDDING_JOB_NAME]);
    expect(jobIds(add)).toEqual(["testcase-t-1000", "testcase-t-2000"]);
  });

  it("coalesces concurrent testcase enqueues for the same write generation", async () => {
    const { service, add } = fixture(["1000", "1000"]);

    await service.enqueueTestcaseEmbedding({ projectId: "p", testcaseId: "t", reason: "created" });
    await service.enqueueTestcaseEmbedding({ projectId: "p", testcaseId: "t", reason: "updated" });

    expect(jobIds(add)).toEqual(["testcase-t-1000", "testcase-t-1000"]);
  });

  it("records the durable enqueue signal in the same statement that mints the id", async () => {
    const { service, query } = fixture(["1000"]);

    await service.enqueueTestcaseEmbedding({ projectId: "p", testcaseId: "t", reason: "created" });

    const [sql] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("embedding_status = 'queued', embedding_queued_at = now()");
    expect(sql).toContain("RETURNING (extract(epoch FROM embedding_queued_at) * 1000)::bigint::text AS generation");
  });

  it("gives a later document edit a different job id from the first enqueue", async () => {
    const { service, add } = fixture(["1000", "2000"]);

    await service.enqueueEmbedding({ organizationId: "o", projectId: "p", sourceType: "document", sourceId: "d", reason: "created" });
    await service.enqueueEmbedding({ organizationId: "o", projectId: "p", sourceType: "document", sourceId: "d", reason: "updated" });

    expect(add.mock.calls.map(([name]) => name)).toEqual([RAG_EMBEDDING_JOB_NAME, RAG_EMBEDDING_JOB_NAME]);
    expect(jobIds(add)).toEqual(["document-d-1000", "document-d-2000"]);
  });

  it("never re-enqueues governed manuals or policies from the boot-time sweep", async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const add = jest.fn().mockResolvedValue(undefined);
    const service = new RagIngestionService(
      { add } as unknown as Queue,
      { query } as unknown as DatabaseService
    );

    await service.resumeInterruptedEmbeddings();

    const [documentsSql] = query.mock.calls[0] as [string, unknown[]];
    expect(documentsSql).toContain("document_type NOT IN ('user_manual','policy')");
    expect(add).not.toHaveBeenCalled();
  });

  it("still enqueues with a fresh id when the status update fails or finds no row", async () => {
    const query = jest.fn().mockRejectedValueOnce(new Error("db down")).mockResolvedValueOnce({ rows: [] });
    const add = jest.fn().mockResolvedValue(undefined);
    const service = new RagIngestionService(
      { add } as unknown as Queue,
      { query } as unknown as DatabaseService
    );

    await service.enqueueTestcaseEmbedding({ projectId: "p", testcaseId: "t", reason: "created" });
    await service.enqueueTestcaseEmbedding({ projectId: "p", testcaseId: "t", reason: "updated" });

    const ids = jobIds(add);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toMatch(/^testcase-t-[0-9a-f-]+$/);
    expect(ids[1]).toMatch(/^testcase-t-[0-9a-f-]+$/);
    expect(ids[0]).not.toBe(ids[1]);
  });
});
