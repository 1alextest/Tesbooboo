import type { SourceConceptObservation } from "./implementation-observation-graph";
import { CurrentCacheGraphHistory, type PersistedGraphObservation } from "./current-cache-graph.history";
import { ProjectSourceBindingReader } from "./project-source-binding";

/**
 * Internal authenticated user-triggered vertical slice:
 * approved project binding -> immutable Git blobs -> native cached requirements
 * and canonical cases -> one versioned history/receipt transaction.
 *
 * No arbitrary MCP paths, automatic worker identity, new approval system or
 * notification send. A source change is not a failed test.
 */
export class ProjectSourceGraphCoordinator {
  constructor(
    private readonly bindings: ProjectSourceBindingReader,
    private readonly history: CurrentCacheGraphHistory
  ) {}

  async captureForUser(
    userId: string | null | undefined,
    projectId: string,
    proposedConcepts: readonly SourceConceptObservation[] = []
  ): Promise<PersistedGraphObservation> {
    const verified = await this.bindings.verifyForUser(userId, projectId, proposedConcepts);
    return this.history.captureVerifiedImplementationForUser(userId, projectId, verified);
  }
}
