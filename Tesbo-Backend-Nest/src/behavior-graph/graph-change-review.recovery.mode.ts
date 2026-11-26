/**
 * Recovery execution scope is deliberately explicit and cluster-wide. The durable receipt and the
 * native notification row remain the source of truth; this file only decides which existing worker
 * may look at them.
 *
 * `off` is the safe default. `project` is for development/e2e and uses a separate queue so an older
 * instance still running the legacy global processor can never claim a project-scoped job. `global`
 * preserves the existing opt-in queue and scheduler.
 */
export type GraphQaRecoveryMode = "off" | "project" | "global";

export interface GraphRecoveryRegistration {
  /** Which existing BullMQ worker owns this scope. */
  queue: "global" | "project";
  scheduler: string;
  job: string;
  data: { projectId?: string };
}

export type GraphRecoveryRegistrationResult = GraphRecoveryRegistration | { error: string } | null;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isGraphRecoveryProjectId(value: string | null | undefined): value is string {
  return Boolean(value && UUID.test(value));
}

/**
 * `null` means register nothing. An error object makes the module fail closed with a warning rather
 * than silently widening `project` to the global sweep.
 */
export function graphRecoveryRegistration(
  mode: GraphQaRecoveryMode,
  projectId: string | null | undefined
): GraphRecoveryRegistrationResult {
  if (mode === "off") return null;
  if (mode === "global") {
    return { queue: "global", scheduler: "graph-qa-review-recovery-v1", job: "recover-committed-notifications", data: {} };
  }
  if (!isGraphRecoveryProjectId(projectId)) {
    return { error: "Project-scoped graph recovery requires TESBO_GRAPH_QA_RECOVERY_PROJECT_ID to be a UUID" };
  }
  return {
    queue: "project",
    scheduler: "graph-qa-review-recovery-scoped-v1",
    job: "recover-committed-notifications-for-project",
    data: { projectId }
  };
}
