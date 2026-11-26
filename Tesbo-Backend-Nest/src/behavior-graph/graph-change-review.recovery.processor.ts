import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { Logger } from "@nestjs/common";
import { AppConfigService } from "../config/app-config.service";
import { GraphChangeReviewRecovery } from "./graph-change-review.recovery";
import { isGraphRecoveryProjectId } from "./graph-change-review.recovery.mode";

export const GRAPH_QA_RECOVERY_QUEUE = "graph-qa-review-recovery";
export const GRAPH_QA_RECOVERY_JOB = "recover-committed-notifications";
export const GRAPH_QA_RECOVERY_SCHEDULER = "graph-qa-review-recovery-v1";
// Project-scoped recovery uses its own queue on purpose: an older instance that only knows the
// legacy global queue can never claim a job whose data names one project.
export const GRAPH_QA_RECOVERY_SCOPED_QUEUE = "graph-qa-review-recovery-scoped";
export const GRAPH_QA_RECOVERY_SCOPED_JOB = "recover-committed-notifications-for-project";

@Processor(GRAPH_QA_RECOVERY_QUEUE)
export class GraphReviewRecoveryProcessor extends WorkerHost {
  private readonly logger = new Logger(GraphReviewRecoveryProcessor.name);

  constructor(
    private readonly recovery: GraphChangeReviewRecovery,
    private readonly config: AppConfigService
  ) { super(); }

  async process(job: Job): Promise<unknown> {
    if (job.name !== GRAPH_QA_RECOVERY_JOB) {
      this.logger.warn(`Unknown graph notification recovery job: ${job.name}`);
      return null;
    }
    // A previously queued job must not run after an operator disables or narrows recovery.
    if (this.config.graphQaRecoveryMode !== "global") return null;
    return this.recovery.runOnce();
  }
}

@Processor(GRAPH_QA_RECOVERY_SCOPED_QUEUE)
export class GraphReviewScopedRecoveryProcessor extends WorkerHost {
  private readonly logger = new Logger(GraphReviewScopedRecoveryProcessor.name);

  constructor(
    private readonly recovery: GraphChangeReviewRecovery,
    private readonly config: AppConfigService
  ) { super(); }

  async process(job: Job): Promise<unknown> {
    if (job.name !== GRAPH_QA_RECOVERY_SCOPED_JOB) {
      this.logger.warn(`Unknown project graph notification recovery job: ${job.name}`);
      return null;
    }
    if (this.config.graphQaRecoveryMode !== "project") return null;
    const configured = this.config.graphQaRecoveryProjectId;
    if (!isGraphRecoveryProjectId(configured)) return null;
    // A scheduler left behind by an earlier scope is refused rather than widened to another project.
    const requested = (job.data as { projectId?: unknown } | null)?.projectId;
    if (requested !== configured) {
      this.logger.warn("Project graph recovery job does not match the configured project; refusing");
      return null;
    }
    return this.recovery.runOnce(configured);
  }
}
