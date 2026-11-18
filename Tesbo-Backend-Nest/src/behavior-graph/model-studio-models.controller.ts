import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "../common/request.types";
import { ModelStudioRepository } from "./model-studio-repository";

/**
 * Persisted expected-model drafts and explicit mappings. Generation returns proposals only; there is
 * no approval, activation or target-execution route — those remain later phases and separate owners.
 * Archiving retires a model as a whole while keeping its revisions and mappings as history.
 */
@Controller("/api/projects/:projectId/model-studio/models")
export class ModelStudioModelsController {
  constructor(private readonly models: ModelStudioRepository) {}

  @Get()
  list(@Req() request: AuthenticatedRequest, @Param("projectId") projectId: string) {
    return this.models.listModelsForUser(request.userId, projectId);
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Param("projectId") projectId: string, @Body() body: Record<string, any>) {
    return this.models.createModelForUser(request.userId, projectId, body);
  }

  @Get(":modelId")
  get(@Req() request: AuthenticatedRequest, @Param("projectId") projectId: string, @Param("modelId") modelId: string) {
    return this.models.getModelForUser(request.userId, projectId, modelId);
  }

  @Delete(":modelId")
  archive(@Req() request: AuthenticatedRequest, @Param("projectId") projectId: string, @Param("modelId") modelId: string) {
    return this.models.archiveModelForUser(request.userId, projectId, modelId);
  }

  @Post(":modelId/revisions")
  saveRevision(
    @Req() request: AuthenticatedRequest,
    @Param("projectId") projectId: string,
    @Param("modelId") modelId: string,
    @Body() body: Record<string, any>
  ) {
    return this.models.saveRevisionForUser(request.userId, projectId, modelId, body);
  }

  @Post(":modelId/revisions/:revisionId/links")
  linkCase(
    @Req() request: AuthenticatedRequest,
    @Param("projectId") projectId: string,
    @Param("modelId") modelId: string,
    @Param("revisionId") revisionId: string,
    @Body() body: Record<string, any>
  ) {
    return this.models.linkCaseForUser(request.userId, projectId, modelId, revisionId, body);
  }

  @Delete(":modelId/revisions/:revisionId/links/:linkId")
  unlinkCase(
    @Req() request: AuthenticatedRequest,
    @Param("projectId") projectId: string,
    @Param("modelId") modelId: string,
    @Param("revisionId") revisionId: string,
    @Param("linkId") linkId: string
  ) {
    return this.models.unlinkCaseForUser(request.userId, projectId, modelId, revisionId, linkId);
  }

  @Get(":modelId/coverage")
  coverage(@Req() request: AuthenticatedRequest, @Param("projectId") projectId: string, @Param("modelId") modelId: string) {
    return this.models.coverageForUser(request.userId, projectId, modelId);
  }

  @Post(":modelId/revisions/:revisionId/generate")
  @HttpCode(200)
  generate(
    @Req() request: AuthenticatedRequest,
    @Param("projectId") projectId: string,
    @Param("modelId") modelId: string,
    @Param("revisionId") revisionId: string,
    @Body() body: Record<string, any>
  ) {
    return this.models.generateForUser(request.userId, projectId, modelId, revisionId, body);
  }
}
