import { BullModule, InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { Logger, Module, OnModuleInit } from "@nestjs/common";
import { AppConfigService } from "../config/app-config.service";
import { LegacyModule } from "../legacy/legacy.module";
import { StorageModule } from "../storage/storage.module";
import { GraphChangeReviewDelivery } from "./graph-change-review.delivery";
import { GraphReviewRunLinks } from "./graph-review-run-links";
import { GraphChangeReviewRecovery } from "./graph-change-review.recovery";
import {
  GraphReviewRecoveryProcessor,
  GraphReviewScopedRecoveryProcessor,
  GRAPH_QA_RECOVERY_QUEUE,
  GRAPH_QA_RECOVERY_SCOPED_QUEUE
} from "./graph-change-review.recovery.processor";
import { graphRecoveryRegistration } from "./graph-change-review.recovery.mode";
import { DatabaseService } from "../database/database.service";
import { CurrentCacheGraphReader } from "./current-cache-graph.reader";
import { CurrentCacheGraphHistory } from "./current-cache-graph.history";
import {
  ProjectSourceBindingReader,
  type ApprovedSourceRegistry
} from "./project-source-binding";
import { ProjectSourceGraphCoordinator } from "./project-source-graph.coordinator";
import { ProjectSourceBindingManagement } from "./project-source-binding.management";
import { GraphChangeReviewController } from "./graph-change-review.controller";
import { ModelStudioPreview } from "./model-studio-preview";
import { ModelStudioPreviewController } from "./model-studio-preview.controller";
import { ModelStudioRepository } from "./model-studio-repository";
import { ModelStudioModelsController } from "./model-studio-models.controller";
import { ModelStudioRunsController } from "./model-studio-runs.controller";

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
  imports: [
    LegacyModule,
    StorageModule,
    BullModule.registerQueue({ name: GRAPH_QA_RECOVERY_QUEUE }, { name: GRAPH_QA_RECOVERY_SCOPED_QUEUE })
  ],
  controllers: [
    GraphChangeReviewController,
    ModelStudioPreviewController,
    ModelStudioModelsController,
    ModelStudioRunsController
  ],
  providers: [
    CurrentCacheGraphReader,
    ModelStudioPreview,
    ModelStudioRepository,
    CurrentCacheGraphHistory,
    GraphChangeReviewDelivery,
    GraphReviewRunLinks,
    GraphChangeReviewRecovery,
    GraphReviewRecoveryProcessor,
    GraphReviewScopedRecoveryProcessor,
    ProjectSourceBindingManagement,
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
  ],
  exports: [ProjectSourceGraphCoordinator, GraphChangeReviewDelivery, ModelStudioPreview, ModelStudioRepository]
})
export class GraphChangeReviewModule implements OnModuleInit {
  private readonly logger = new Logger(GraphChangeReviewModule.name);

  constructor(
    @InjectQueue(GRAPH_QA_RECOVERY_QUEUE) private readonly recoveryQueue: Queue,
    @InjectQueue(GRAPH_QA_RECOVERY_SCOPED_QUEUE) private readonly scopedRecoveryQueue: Queue,
    private readonly config: AppConfigService
  ) {}

  async onModuleInit(): Promise<void> {
    // Redis scheduler registration is cluster-wide. A disabled instance must
    // never delete the shared scheduler while other instances remain enabled.
    // The processors themselves refuse jobs whose scope does not match this instance.
    const registration = graphRecoveryRegistration(
      this.config.graphQaRecoveryMode,
      this.config.graphQaRecoveryProjectId
    );
    if (!registration) return;
    if ("error" in registration) {
      // Fail closed: an incomplete project scope must not degrade into a global sweep.
      this.logger.warn(registration.error);
      return;
    }
    const queue = registration.queue === "project" ? this.scopedRecoveryQueue : this.recoveryQueue;
    await queue.upsertJobScheduler(
      registration.scheduler,
      { pattern: "*/10 * * * *", tz: "UTC" },
      { name: registration.job, data: registration.data }
    ).then(() => this.logger.log(
      `QA review notification recovery registered every 10 minutes (${registration.queue} scope)`
    )).catch((error: unknown) => this.logger.warn(`Recovery scheduler registration failed: ${String(error)}`));
  }
}
