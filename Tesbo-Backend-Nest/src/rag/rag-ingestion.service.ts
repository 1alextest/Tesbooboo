import { randomUUID } from "node:crypto";
import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { Queue } from "bullmq";
import { DatabaseService } from "../database/database.service";
import { RAG_EMBEDDING_JOB_NAME, RAG_EMBEDDING_QUEUE, RAG_TESTCASE_EMBEDDING_JOB_NAME } from "./rag.constants";
import { EmbeddingJobPayload, TestcaseEmbeddingJobPayload } from "./rag.types";

// Producer side of the embedding pipeline. Enqueue calls are meant to be fired
// fire-and-forget (`void this.ragIngestion.enqueueEmbedding(...).catch(() => undefined)`)
// from the same write sites that already insert/update knowledge_documents/knowledge_files.
@Injectable()
export class RagIngestionService {
  private readonly logger = new Logger(RagIngestionService.name);

  constructor(
    @InjectQueue(RAG_EMBEDDING_QUEUE) private readonly queue: Queue<EmbeddingJobPayload | TestcaseEmbeddingJobPayload>,
    private readonly db: DatabaseService
  ) {}

  async enqueueEmbedding(payload: EmbeddingJobPayload): Promise<void> {
    const table = payload.sourceType === "document" ? "knowledge_documents" : "knowledge_files";
    const queued = await this.db
      .query<{ generation: string }>(
        `UPDATE ${table} SET embedding_status = 'queued' WHERE id = $1 AND project_id = $2
         RETURNING (extract(epoch FROM now()) * 1000)::bigint::text AS generation`,
        [payload.sourceId, payload.projectId]
      )
      .catch(() => undefined);

    // The jobId carries this write's generation (see the testcase counterpart below). A fixed
    // jobId dedupes against EVERY job that still exists with that id — including completed jobs,
    // which removeOnComplete retains. An edit after the first embedding therefore had its add
    // silently dropped while the row was already marked 'queued', so the embedding never
    // refreshed and the row never returned to 'pending'. A generation-scoped id still coalesces
    // concurrent enqueues for the same write, but the next edit mints a new id and really runs.
    // BullMQ job IDs can't contain ":" (used internally as a Redis key delimiter), hence "-".
    const generation = queued?.rows[0]?.generation ?? randomUUID();
    await this.queue.add(RAG_EMBEDDING_JOB_NAME, payload, {
      jobId: `${payload.sourceType}-${payload.sourceId}-${generation}`,
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 1000 }
    }).catch((err) => {
      this.logger.warn(`Failed to enqueue embedding job for ${payload.sourceType}:${payload.sourceId}: ${err instanceof Error ? err.message : err}`);
    });
  }

  // Test-case counterpart of enqueueEmbedding, on the same queue/worker/retry config — see
  // RAG_TESTCASE_EMBEDDING_JOB_NAME's comment for why this doesn't get its own queue. Meant to be
  // called fire-and-forget from LegacyService's testcase write paths (createTestCase/
  // updateTestCase/patchTestCaseFromZyra — see legacy.service.ts's enqueueTestcaseEmbedding
  // wrapper), the same way enqueueEmbedding already is for knowledge_documents/knowledge_files.
  //
  // Deliberately NOT called from bulkCreateTestCases (CSV/API import) or
  // zyraBatchInsertTestCases (staged Zyra drafts, which write to ai_generation_requests, not
  // testcases, until a save is confirmed) — out of scope for this pass. Those paths leave newly
  // created rows at embedding_status='pending' (the column default) until either widened into
  // this hook or covered by a future backfill decision.
  async enqueueTestcaseEmbedding(payload: TestcaseEmbeddingJobPayload): Promise<void> {
    const queued = await this.db
      .query<{ generation: string }>(
        `UPDATE testcases SET embedding_status = 'queued', embedding_queued_at = now()
         WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL
         RETURNING (extract(epoch FROM embedding_queued_at) * 1000)::bigint::text AS generation`,
        [payload.testcaseId, payload.projectId]
      )
      .catch(() => undefined);

    // The enqueue timestamp doubles as the job-id generation. A fixed `testcase-<id>` jobId is
    // deduped against the completed create-job that removeOnComplete still retains, so editing
    // a case marked it 'queued' and then silently dropped the job: no refresh, and a row stuck
    // out of 'pending' forever. Generation-scoping keeps concurrent enqueues for one write
    // coalesced while letting the next edit enqueue a genuinely new job.
    const generation = queued?.rows[0]?.generation ?? randomUUID();
    await this.queue.add(RAG_TESTCASE_EMBEDDING_JOB_NAME, payload, {
      jobId: `testcase-${payload.testcaseId}-${generation}`,
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 1000 }
    }).catch((err) => {
      this.logger.warn(`Failed to enqueue testcase embedding job for testcase:${payload.testcaseId}: ${err instanceof Error ? err.message : err}`);
    });
  }

  // Re-enqueues anything left in an in-progress status after a restart/crash — same
  // self-healing idiom as resumeInterruptedZyraChatPlans (legacy.service.ts). Safe to call
  // repeatedly: while a source's job is still waiting/active the same generation coalesces the
  // duplicate add; once it has completed, a repeat mints a new generation and re-embeds rather
  // than silently doing nothing (the failure mode a fixed jobId caused).
  async resumeInterruptedEmbeddings(): Promise<void> {
    const docs = await this.db
      .query<{ id: string; project_id: string; organization_id: string }>(
        // Governed manuals/policies are under an exposure hold: they are never embedded until a
        // human owner accepts a distribution policy for them, so a restart must not requeue them.
        "SELECT id, project_id, organization_id FROM knowledge_documents WHERE embedding_status IN ('pending','queued','processing') AND is_deleted = false AND document_type NOT IN ('user_manual','policy')"
      )
      .catch(() => ({ rows: [] as Array<{ id: string; project_id: string; organization_id: string }> }));
    const files = await this.db
      .query<{ id: string; project_id: string; organization_id: string }>(
        `SELECT id, project_id, organization_id FROM knowledge_files
         WHERE embedding_status IN ('pending','queued','processing') AND is_deleted = false
           AND (extraction_status IN ('ready','unsupported') OR extraction_status IS NULL)`
      )
      .catch(() => ({ rows: [] as Array<{ id: string; project_id: string; organization_id: string }> }));

    for (const row of docs.rows) {
      await this.enqueueEmbedding({ organizationId: row.organization_id, projectId: row.project_id, sourceType: "document", sourceId: row.id, reason: "reindex" });
    }
    for (const row of files.rows) {
      await this.enqueueEmbedding({ organizationId: row.organization_id, projectId: row.project_id, sourceType: "file", sourceId: row.id, reason: "reindex" });
    }
  }
}
