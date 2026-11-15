import { ConflictException, ForbiddenException } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { LocalPinnedGitSourceReader } from "./local-pinned-git-source";
import {
  VerifiedPinnedSource,
  type SourceVerificationRequest
} from "./implementation-source-verifier";
import type { SourceConceptObservation } from "./implementation-observation-graph";

/**
 * Installed by an administrator in server configuration. Never load checkout
 * paths, credentials or repository IDs from a tool/client request.
 */
export interface ApprovedSourceCheckout {
  repositoryId: string;
  root: string;
}
export type ApprovedSourceRegistry = Readonly<Record<string, ApprovedSourceCheckout>>;

export interface ProjectSourceBinding {
  projectId: string;
  repositoryId: string;
  checkoutKey: string;
  refName: string;
  selectionPrefixes: string[];
}

/**
 * Internal project-authorized binding lookup. No controller or MCP registration.
 * Membership and the binding are selected by one DB statement; missing/disabled
 * bindings are not confused with an empty inventory.
 */
export class ProjectSourceBindingReader {
  constructor(
    private readonly db: DatabaseService,
    private readonly approved: ApprovedSourceRegistry
  ) {}

  async resolveForUser(userId: string | null | undefined, projectId: string): Promise<{
    binding: ProjectSourceBinding;
    checkout: ApprovedSourceCheckout;
  }> {
    if (!userId) throw new ForbiddenException({ error: "Authenticated project member required" });
    const response = await this.db.query<{
      authorized: boolean;
      repository_id: string | null;
      checkout_key: string | null;
      ref_name: string | null;
      selection_prefixes: string[] | null;
    }>(
      `WITH allowed AS MATERIALIZED (
         SELECT DISTINCT p.id FROM projects p
           JOIN project_members pm ON pm.project_id=p.id AND pm.user_id=$2::uuid
           JOIN organization_members om ON om.organization_id=p.organization_id AND om.user_id=$2::uuid
          WHERE p.id=$1::uuid
            AND (to_jsonb(p)->>'deleted_at') IS NULL
            AND (to_jsonb(p)->>'archived_at') IS NULL
            AND COALESCE((to_jsonb(p)->>'is_archived')::boolean, false)=false
            AND (to_jsonb(pm)->>'deleted_at') IS NULL
            AND (to_jsonb(om)->>'deleted_at') IS NULL
       )
       SELECT EXISTS(SELECT 1 FROM allowed) AS authorized,
         (SELECT b.repository_id FROM project_source_bindings b JOIN allowed a ON a.id=b.project_id
           WHERE b.enabled=true) AS repository_id,
         (SELECT b.checkout_key FROM project_source_bindings b JOIN allowed a ON a.id=b.project_id
           WHERE b.enabled=true) AS checkout_key,
         (SELECT b.ref_name FROM project_source_bindings b JOIN allowed a ON a.id=b.project_id
           WHERE b.enabled=true) AS ref_name,
         (SELECT b.selection_prefixes FROM project_source_bindings b JOIN allowed a ON a.id=b.project_id
           WHERE b.enabled=true) AS selection_prefixes`,
      [projectId, userId]
    );
    const row = response.rows[0];
    if (!row?.authorized) throw new ForbiddenException({ error: "Project membership required for source access" });
    if (!row.repository_id || !row.checkout_key || !row.ref_name || !row.selection_prefixes) {
      throw new ConflictException({ error: "Project source binding is not enabled or configured" });
    }
    const checkout = Object.prototype.hasOwnProperty.call(this.approved, row.checkout_key)
      ? this.approved[row.checkout_key] : undefined;
    if (!checkout?.root || checkout.repositoryId !== row.repository_id) {
      throw new ConflictException({ error: "Project source binding has no approved checkout" });
    }
    return {
      binding: {
        projectId, repositoryId: row.repository_id, checkoutKey: row.checkout_key,
        refName: row.ref_name, selectionPrefixes: row.selection_prefixes
      },
      checkout
    };
  }

  /**
   * Pinned source bytes are re-read by a checkout created ONLY from the
   * approved server registry. Proposed concept labels remain unverified.
   */
  async verifyForUser(
    userId: string | null | undefined,
    projectId: string,
    proposedConcepts: readonly SourceConceptObservation[] = []
  ): Promise<{
    binding: ProjectSourceBinding;
    observation: VerifiedPinnedSource;
    /** Rechecked AFTER the history writer acquires the project lock. */
    revalidatePinnedRef: () => Promise<boolean>;
  }> {
    const { binding, checkout } = await this.resolveForUser(userId, projectId);
    const reader = await LocalPinnedGitSourceReader.fromConfiguredCheckout(binding.repositoryId, checkout.root);
    const pinned = await reader.resolveRef(binding.refName);
    const request: SourceVerificationRequest = {
      projectId, refName: binding.refName, expectedCommitSha: pinned,
      proposedConcepts, selectionPrefixes: binding.selectionPrefixes
    };
    const observation = await VerifiedPinnedSource.capture(reader, request);
    return {
      binding, observation,
      revalidatePinnedRef: async () =>
        (await reader.resolveRef(binding.refName)) === observation.value.commitSha
    };
  }
}
