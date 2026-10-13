import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";
import { REVIEW_BOARD_JOB, REVIEW_BOARD_QUEUE } from "./review-board.constants";
import { ReviewBoardService } from "./review-board.service";

/** Thin BullMQ boundary. runAnalysis records its own failures on the run row and never throws. */
@Processor(REVIEW_BOARD_QUEUE)
export class ReviewBoardProcessor extends WorkerHost {
  private readonly logger = new Logger(ReviewBoardProcessor.name);

  constructor(private readonly service: ReviewBoardService) {
    super();
  }

  async process(job: Job<{ runId: string }>): Promise<void> {
    if (job.name !== REVIEW_BOARD_JOB) {
      this.logger.warn(`Unknown review-board job name: ${job.name}`);
      return;
    }
    await this.service.runAnalysis(job.data.runId);
  }
}
