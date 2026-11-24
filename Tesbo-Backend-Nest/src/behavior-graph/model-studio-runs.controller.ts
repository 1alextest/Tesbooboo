import { Controller, Get, Param, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "../common/request.types";
import { ModelStudioRepository } from "./model-studio-repository";

/**
 * Read side of governed runs, addressed by the native cycle they created.
 *
 * The run detail page knows only its cycle id; this answers "was this run started from a model?"
 * without teaching the legacy run reader about the model domain. The response is an explicit
 * envelope — `{ provenance: null }` for an ordinary run — rather than a bare null, which Nest
 * serialises as an empty body and forces every caller to special-case a non-JSON response.
 */
@Controller("/api/projects/:projectId/model-studio")
export class ModelStudioRunsController {
  constructor(private readonly models: ModelStudioRepository) {}

  @Get("runs/by-cycle/:cycleId")
  async provenance(
    @Req() request: AuthenticatedRequest,
    @Param("projectId") projectId: string,
    @Param("cycleId") cycleId: string
  ) {
    return { provenance: await this.models.runProvenanceForUser(request.userId, projectId, cycleId) };
  }
}
