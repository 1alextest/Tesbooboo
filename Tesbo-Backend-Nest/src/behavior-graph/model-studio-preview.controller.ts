import { Body, Controller, HttpCode, Post, Req, Param } from "@nestjs/common";
import type { AuthenticatedRequest } from "../common/request.types";
import { ModelStudioPreview } from "./model-studio-preview";

@Controller("/api/projects/:projectId/agents/zyra/changes/model-preview")
export class ModelStudioPreviewController {
  constructor(private readonly preview: ModelStudioPreview) {}

  @Post()
  @HttpCode(200)
  model(@Req() request: AuthenticatedRequest, @Param("projectId") projectId: string, @Body() input: unknown) {
    return this.preview.previewForUser(request.userId, projectId, input);
  }
}
