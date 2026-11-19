import { Controller, Get, Param, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "../common/request.types";
import { ModelStudioRepository } from "./model-studio-repository";

/**
 * Read side of governed runs, addressed by the native cycle they created.
 *
 * The run detail page knows only its cycle id; this answers "was this run started from a model?"
 * without teaching the legacy run reader about the model domain. An ordinary run is 200 with a
 * null body, so the caller can render nothing rather than treating ordinary runs as errors.
 */
@Controller("/api/projects/:projectId/model-studio")
export class ModelStudioRunsController {
  constructor(private readonly models: ModelStudioRepository) {}

  @Get("runs/by-cycle/:cycleId")
  provenance(
    @Req() request: AuthenticatedRequest,
    @Param("projectId") projectId: string,
    @Param("cycleId") cycleId: string
  ) {
    return this.models.runProvenanceForUser(request.userId, projectId, cycleId);
  }
}
