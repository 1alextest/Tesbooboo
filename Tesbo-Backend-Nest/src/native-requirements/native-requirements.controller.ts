import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "../common/request.types";
import { LegacyService } from "../legacy/legacy.service";
import type { TestcaseProposalPrincipal } from "../legacy/testcase-proposal-review";
import { closedObject } from "./native-requirements.core";

/** Transports delegate to one native owner; no route accepts authority claims from payload fields. */
@Controller("/api/projects/:projectId/requirements")
export class NativeRequirementsController {
  constructor(private readonly legacy: LegacyService) {}

  private principal(request: AuthenticatedRequest): TestcaseProposalPrincipal {
    return { kind: request.apiToken ? "api_token" : "human_session", tokenId: request.apiToken?.tokenId, transport: "rest" };
  }

  @Get()
  list(@Req() request: AuthenticatedRequest, @Param("projectId") projectId: string, @Query() query: Record<string, any>) {
    return this.legacy.listNativeRequirements(projectId, request.userId, query);
  }

  @Get("capabilities")
  capabilities(@Req() request: AuthenticatedRequest, @Param("projectId") projectId: string) {
    return this.legacy.nativeRequirementsCapabilities(projectId, request.userId);
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Param("projectId") projectId: string, @Body() body: Record<string, any>) {
    return this.legacy.createNativeRequirement(projectId, request.userId, body, this.principal(request));
  }

  @Get(":requirementId")
  get(@Req() request: AuthenticatedRequest, @Param("projectId") projectId: string, @Param("requirementId") requirementId: string) {
    return this.legacy.getNativeRequirement(projectId, request.userId, requirementId);
  }

  @Get(":requirementId/coverage")
  coverage(@Req() request: AuthenticatedRequest, @Param("projectId") projectId: string, @Param("requirementId") requirementId: string) {
    return this.legacy.getNativeRequirementCoverage(projectId, request.userId, requirementId);
  }

  @Post(":requirementId/revisions")
  revise(@Req() request: AuthenticatedRequest, @Param("projectId") projectId: string, @Param("requirementId") requirementId: string, @Body() body: Record<string, any>) {
    return this.legacy.addNativeRequirementRevision(projectId, request.userId, requirementId, body, this.principal(request));
  }

  @Post(":requirementId/retire")
  @HttpCode(200)
  retire(@Req() request: AuthenticatedRequest, @Param("projectId") projectId: string, @Param("requirementId") requirementId: string, @Body() body: Record<string, any>) {
    return this.legacy.retireNativeRequirement(projectId, request.userId, requirementId, body, this.principal(request));
  }

  @Post(":requirementId/links")
  associate(@Req() request: AuthenticatedRequest, @Param("projectId") projectId: string, @Param("requirementId") requirementId: string, @Body() body: Record<string, any>) {
    return this.legacy.linkNativeRequirementCase(projectId, request.userId, requirementId, body, this.principal(request));
  }

  @Post(":requirementId/links/:linkId/retire")
  @HttpCode(200)
  retireLink(@Req() request: AuthenticatedRequest, @Param("projectId") projectId: string, @Param("requirementId") requirementId: string, @Param("linkId") linkId: string, @Body() body: Record<string, any>) {
    closedObject(body, []);
    return this.legacy.retireNativeRequirementCaseLink(projectId, request.userId, requirementId, linkId, this.principal(request));
  }

  @Post(":requirementId/case-proposals")
  stage(@Req() request: AuthenticatedRequest, @Param("projectId") projectId: string, @Param("requirementId") requirementId: string, @Body() body: Record<string, any>) {
    return this.legacy.stageNativeRequirementTestcaseChanges(projectId, request.userId, requirementId, body, this.principal(request));
  }

  @Post(":requirementId/revisions/:versionId/approve")
  approve(@Req() request: AuthenticatedRequest, @Param("projectId") projectId: string, @Param("requirementId") requirementId: string, @Param("versionId") versionId: string, @Body() body: Record<string, any>) {
    return this.legacy.approveNativeRequirement(projectId, request.userId, requirementId, versionId, body, this.principal(request));
  }
}
