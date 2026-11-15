import { Controller, Get, HttpCode, Param, Post, Query, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "../common/request.types";
import { CurrentCacheGraphHistory } from "./current-cache-graph.history";
import { ProjectSourceGraphCoordinator } from "./project-source-graph.coordinator";

/**
 * Native Zyra project review surface over the existing graph_history ledger.
 * Human members and project-scoped API tokens use their existing auth guards.
 * No request-provided source manifest, repo location, approval or test result.
 */
@Controller("/api/projects/:projectId/agents/zyra/changes")
export class GraphChangeReviewController {
  constructor(
    private readonly history: CurrentCacheGraphHistory,
    private readonly coordinator: ProjectSourceGraphCoordinator
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

  @Post("capture")
  @HttpCode(200)
  async capture(@Req() request: AuthenticatedRequest, @Param("projectId") projectId: string) {
    // No client-proposed semantics. This operation observes configured source
    // bytes and persists one native/implementation graph revision if changed.
    return this.coordinator.captureForUser(request.userId, projectId);
  }
}
