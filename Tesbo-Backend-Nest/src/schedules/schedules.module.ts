import { Module } from "@nestjs/common";
import { LegacyModule } from "../legacy/legacy.module";
import { SchedulesController } from "./schedules.controller";
import { SchedulesService } from "./schedules.service";

@Module({
  imports: [LegacyModule],
  controllers: [SchedulesController],
  providers: [SchedulesService]
})
export class SchedulesModule {}
