import { Module } from "@nestjs/common";
import { AppConfigService } from "../config/app-config.service";
import { LegacyModule } from "../legacy/legacy.module";
import { GraphChangeReviewDelivery } from "./graph-change-review.delivery";
import { DatabaseService } from "../database/database.service";
import { CurrentCacheGraphReader } from "./current-cache-graph.reader";
import { CurrentCacheGraphHistory } from "./current-cache-graph.history";
import {
  ProjectSourceBindingReader,
  type ApprovedSourceRegistry
} from "./project-source-binding";
import { ProjectSourceGraphCoordinator } from "./project-source-graph.coordinator";
import { GraphChangeReviewController } from "./graph-change-review.controller";

/** Server-admin configuration only. No filesystem root comes from REST/MCP. */
export function parseApprovedSourceCheckouts(raw: string): ApprovedSourceRegistry {
  if (!raw.trim()) return Object.freeze({});
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error("Invalid graph source registry JSON"); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid graph source registry");
  }
  const rows = Object.entries(parsed);
  if (rows.length > 50) throw new Error("Too many approved graph checkouts");
  const registry: Record<string, { root: string; repositoryId: string }> = Object.create(null) as Record<string, { root: string; repositoryId: string }>;
  for (const [key, value] of rows) {
    const row = value as { root?: unknown; repositoryId?: unknown } | null;
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(key) || ["__proto__", "constructor", "prototype"].includes(key) || !row || typeof row !== "object" ||
        Object.keys(row).sort().join(",") !== "repositoryId,root" ||
        typeof row.root !== "string" || !row.root.startsWith("/") ||
        row.root.includes("\0") || row.root.includes("..") ||
        typeof row.repositoryId !== "string" ||
        !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(row.repositoryId)) {
      throw new Error("Invalid approved graph checkout entry");
    }
    registry[key] = Object.freeze({ root: row.root, repositoryId: row.repositoryId });
  }
  return Object.freeze(registry);
}

@Module({
  imports: [LegacyModule],
  controllers: [GraphChangeReviewController],
  providers: [
    CurrentCacheGraphReader,
    CurrentCacheGraphHistory,
    GraphChangeReviewDelivery,
    {
      provide: ProjectSourceBindingReader,
      inject: [DatabaseService, AppConfigService],
      useFactory: (db: DatabaseService, config: AppConfigService) =>
        new ProjectSourceBindingReader(db, parseApprovedSourceCheckouts(config.graphApprovedCheckoutsJson))
    },
    {
      provide: ProjectSourceGraphCoordinator,
      inject: [ProjectSourceBindingReader, CurrentCacheGraphHistory],
      useFactory: (bindings: ProjectSourceBindingReader, history: CurrentCacheGraphHistory) =>
        new ProjectSourceGraphCoordinator(bindings, history)
    }
  ]
})
export class GraphChangeReviewModule {}
