import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { Logger } from "@nestjs/common";
import { AppConfigService } from "../config/app-config.service";
import { GraphChangeReviewRecovery } from "./graph-change-review.recovery";
import {
  GRAPH_QA_RECOVERY_JOB,
  GRAPH_QA_RECOVERY_QUEUE,
  GRAPH_QA_RECOVERY_SCHEDULER,
  GRAPH_QA_RECOVERY_SCOPED_JOB,
  GRAPH_QA_RECOVERY_SCOPED_QUEUE,
  GRAPH_QA_RECOVERY_SCOPED_SCHEDULER,
  isGraphRecoveryProjectId
} from "./graph-change-review.recovery.mode";

export {
  GRAPH_QA_RECOVERY_JOB,
  GRAPH_QA_RECOVERY_QUEUE,
  GRAPH_QA_RECOVERY_SCHEDULER,
  GRAPH_QA_RECOVERY_SCOPED_JOB,
  GRAPH_QA_RECOVERY_SCOPED_QUEUE,
  GRAPH_QA_RECOVERY_SCOPED_SCHEDULER
};

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
    // The legacy queue is global-only. A project payload here would be a scope defect, not a
    // reason to fall back to every project.
    const requested = (job.data as { projectId?: unknown } | null)?.projectId;
    if (requested !== undefined) {
      this.logger.warn("Global graph recovery job carried a project scope; refusing");
      return null;
    }
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
    if (this.config.graphQaRecoveryMode !== "project") {
      this.logger.warn("Project graph recovery job claimed by an instance not in project mode; refusing");
      return null;
    }
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
