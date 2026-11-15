import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { Logger } from "@nestjs/common";
import { GraphChangeReviewRecovery } from "./graph-change-review.recovery";

export const GRAPH_QA_RECOVERY_QUEUE = "graph-qa-review-recovery";
export const GRAPH_QA_RECOVERY_JOB = "recover-committed-notifications";
export const GRAPH_QA_RECOVERY_SCHEDULER = "graph-qa-review-recovery-v1";

@Processor(GRAPH_QA_RECOVERY_QUEUE)
export class GraphReviewRecoveryProcessor extends WorkerHost {
  private readonly logger = new Logger(GraphReviewRecoveryProcessor.name);

  constructor(private readonly recovery: GraphChangeReviewRecovery) { super(); }

  async process(job: Job): Promise<unknown> {
    if (job.name !== GRAPH_QA_RECOVERY_JOB) {
      this.logger.warn(`Unknown graph notification recovery job: ${job.name}`);
      return null;
    }
    return this.recovery.runOnce();
  }
}
