import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post, Query, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "../common/request.types";
import { CurrentCacheGraphHistory } from "./current-cache-graph.history";
import { ProjectSourceGraphCoordinator } from "./project-source-graph.coordinator";
import { GraphChangeReviewDelivery } from "./graph-change-review.delivery";
import { ProjectSourceBindingManagement } from "./project-source-binding.management";
import { GraphReviewRunLinks } from "./graph-review-run-links";

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
    private readonly delivery: GraphChangeReviewDelivery,
    private readonly sourceManagement: ProjectSourceBindingManagement,
    private readonly runLinks: GraphReviewRunLinks
  ) {}

  @Get("source-binding")
  getSourceBinding(@Req() request: AuthenticatedRequest, @Param("projectId") projectId: string) {
    return this.sourceManagement.getForOwner(request.userId, projectId);
  }

  @Post("source-binding")
  @HttpCode(200)
  setSourceBinding(
    @Req() request: AuthenticatedRequest, @Param("projectId") projectId: string, @Body() body: unknown
  ) {
    return this.sourceManagement.setForOwner(request.userId, projectId, body);
  }

  @Get()
  async list(
    @Req() request: AuthenticatedRequest,
    @Param("projectId") projectId: string,
    @Query("limit") rawLimit?: unknown,
    @Query("beforeId") beforeId?: unknown
  ) {
    const limit = rawLimit === undefined ? 25 : typeof rawLimit === "string" ? Number(rawLimit) : NaN;
    // Query parsers can return arrays/objects. Keep malformed limits invalid
    // without coercing them, and retain the history service's auth-first guard.
    return { entries: await this.history.listForUser(request.userId, projectId, limit, beforeId) };
  }

  @Get(":historyId/runs")
  listLinkedRuns(
    @Req() request: AuthenticatedRequest,
    @Param("projectId") projectId: string,
    @Param("historyId") historyId: string,
    @Query("verifyEvidenceBytes") verifyEvidenceBytes?: unknown
  ) {
    // Opt-in and strict: each check costs a storage HEAD/stat, so a typo must not silently
    // enable or disable it. Only the literal "true" turns verification on.
    if (verifyEvidenceBytes !== undefined && verifyEvidenceBytes !== "true" && verifyEvidenceBytes !== "false") {
      throw new BadRequestException({ error: "verifyEvidenceBytes must be true or false" });
    }
    return this.runLinks.listForUser(request.userId, projectId, historyId, {
      verifyEvidenceBytes: verifyEvidenceBytes === "true"
    });
  }

  @Post(":historyId/runs/:cycleId/link")
  @HttpCode(200)
  linkRunCases(
    @Req() request: AuthenticatedRequest,
    @Param("projectId") projectId: string,
    @Param("historyId") historyId: string,
    @Param("cycleId") cycleId: string,
    @Body() body: unknown
  ) {
    return this.runLinks.linkForUser(request.userId, projectId, historyId, cycleId, body);
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
