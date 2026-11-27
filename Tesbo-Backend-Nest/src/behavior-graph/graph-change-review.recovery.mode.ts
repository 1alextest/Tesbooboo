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

// One definition shared by registration and dispatch. A job name that drifts between the scheduler
// and its processor is silently logged as unknown, so these constants are the identity contract.
export const GRAPH_QA_RECOVERY_QUEUE = "graph-qa-review-recovery";
export const GRAPH_QA_RECOVERY_JOB = "recover-committed-notifications";
export const GRAPH_QA_RECOVERY_SCHEDULER = "graph-qa-review-recovery-v1";
export const GRAPH_QA_RECOVERY_SCOPED_QUEUE = "graph-qa-review-recovery-scoped";
export const GRAPH_QA_RECOVERY_SCOPED_JOB = "recover-committed-notifications-for-project";
export const GRAPH_QA_RECOVERY_SCOPED_SCHEDULER = "graph-qa-review-recovery-scoped-v1";

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
    return { queue: "global", scheduler: GRAPH_QA_RECOVERY_SCHEDULER, job: GRAPH_QA_RECOVERY_JOB, data: {} };
  }
  if (!isGraphRecoveryProjectId(projectId)) {
    return { error: "Project-scoped graph recovery requires TESBO_GRAPH_QA_RECOVERY_PROJECT_ID to be a UUID" };
  }
  return {
    queue: "project",
    scheduler: GRAPH_QA_RECOVERY_SCOPED_SCHEDULER,
    job: GRAPH_QA_RECOVERY_SCOPED_JOB,
    data: { projectId }
  };
}
