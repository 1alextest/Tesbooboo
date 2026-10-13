import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { LegacyModule } from "../legacy/legacy.module";
import { PlanLimitsModule } from "../plan-limits/plan-limits.module";
import { REVIEW_BOARD_QUEUE } from "./review-board.constants";
import { ReviewBoardController } from "./review-board.controller";
import { ReviewBoardProcessor } from "./review-board.processor";
import { ReviewBoardService } from "./review-board.service";

@Module({
  imports: [BullModule.registerQueue({ name: REVIEW_BOARD_QUEUE }), LegacyModule, PlanLimitsModule],
  controllers: [ReviewBoardController],
  providers: [ReviewBoardService, ReviewBoardProcessor]
})
export class ReviewBoardModule {}
