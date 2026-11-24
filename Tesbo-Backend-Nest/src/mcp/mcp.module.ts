import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { LegacyModule } from "../legacy/legacy.module";
import { PlanLimitsModule } from "../plan-limits/plan-limits.module";
import { GraphChangeReviewModule } from "../behavior-graph/graph-change-review.module";
import { McpController } from "./mcp.controller";
import { McpOAuthInteractionController } from "./mcp-oauth-interaction.controller";
import { McpService } from "./mcp.service";

/**
 * Tesbo MCP module: the in-process MCP server exposed over HTTP.
 * Reuses LegacyService for all data operations and the shared AuthMiddleware (via AuthModule)
 * for bearer-token resolution.
 */
@Module({
  imports: [LegacyModule, AuthModule, PlanLimitsModule, GraphChangeReviewModule],
  controllers: [McpController, McpOAuthInteractionController],
  providers: [McpService]
})
export class McpModule {}
