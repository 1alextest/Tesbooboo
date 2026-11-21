import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "../common/request.types";
import { SchedulesService } from "./schedules.service";

/**
 * Persisted run schedules. A due schedule creates a new Test Run; it never rewrites the scheduled
 * run's own results. The worker that fires them lives in SchedulesService.
 */
@Controller()
export class SchedulesController {
  constructor(private readonly schedules: SchedulesService) {}

  @Get("/api/projects/:projectId/cycles/schedules")
  list(@Req() req: AuthenticatedRequest, @Param("projectId") projectId: string) {
    return this.schedules.listForUser(req.userId, projectId);
  }

  @Post("/api/projects/:projectId/cycles/schedules")
  create(@Req() req: AuthenticatedRequest, @Param("projectId") projectId: string, @Body() body: Record<string, any>) {
    return this.schedules.createForUser(req.userId, projectId, body);
  }

  @Patch("/api/cycles/schedules/:scheduleId")
  update(
    @Req() req: AuthenticatedRequest,
    @Param("scheduleId") scheduleId: string,
    @Body() body: Record<string, any>
  ) {
    return this.schedules.updateForUser(req.userId, scheduleId, body);
  }

  @Delete("/api/cycles/schedules/:scheduleId")
  @HttpCode(200)
  remove(@Req() req: AuthenticatedRequest, @Param("scheduleId") scheduleId: string) {
    return this.schedules.deleteForUser(req.userId, scheduleId);
  }

  @Post("/api/cycles/schedules/:scheduleId/run")
  @HttpCode(200)
  runNow(@Req() req: AuthenticatedRequest, @Param("scheduleId") scheduleId: string) {
    return this.schedules.runNowForUser(req.userId, scheduleId);
  }
}
