import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post, Query, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "../common/request.types";
import { CurrentCacheGraphHistory } from "./current-cache-graph.history";
import { ProjectSourceGraphCoordinator } from "./project-source-graph.coordinator";
import { GraphChangeReviewDelivery } from "./graph-change-review.delivery";

/**
 * Native Zyra project review surface over the existing graph_history ledger.
 * Human members and project-scoped API tokens use their existing auth guards.
 * No request-provided source manifest, repo location, approval or test result.
 */
@Controller("/api/projects/:projectId/agents/zyra/changes")
export class GraphChangeReviewController {
  constructor(
    private readonly history: CurrentCacheGraphHistory,
    private readonly coordinator: ProjectSourceGraphCoordinator,
    private readonly delivery: GraphChangeReviewDelivery
  ) {}

  @Get()
  async list(
    @Req() request: AuthenticatedRequest,
    @Param("projectId") projectId: string,
    @Query("limit") rawLimit?: string,
    @Query("beforeId") beforeId?: string
  ) {
    const limit = rawLimit === undefined ? 25 : Number(rawLimit);
    // The history service rejects non-integers and out-of-bounds cursors.
    return { entries: await this.history.listForUser(request.userId, projectId, limit, beforeId) };
  }

  @Post(":historyId/notify")
  @HttpCode(200)
  retryNotification(
    @Req() request: AuthenticatedRequest,
    @Param("projectId") projectId: string,
    @Param("historyId") historyId: string
  ) {
    return this.delivery.deliverForUser(request.userId, projectId, historyId);
  }

  @Post("capture")
  @HttpCode(200)
  async capture(@Req() request: AuthenticatedRequest, @Param("projectId") projectId: string, @Body() body?: Record<string, unknown>) {
    if (body && (typeof body !== "object" || Array.isArray(body) || Object.keys(body).length > 0)) {
      throw new BadRequestException({ error: "Capture accepts no client source manifest or result assertions" });
    }
    // No client-proposed semantics. This operation observes configured source
    // bytes and persists one native/implementation graph revision if changed.
    const observation = await this.coordinator.captureForUser(request.userId, projectId);
    const delivery = observation.reviewReceipt
      ? await this.delivery.deliverForUser(request.userId, projectId, observation.id)
      : null;
    return { ...observation, delivery };
  }
}
