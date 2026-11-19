/** Machine credentials may stage proposals, but cannot publish official case content or its dependencies. */
export const DIRECT_TESTCASE_PUBLISHERS = new Set([
  "create_testcase", "update_testcase", "archive_testcase", "restore_testcase", "duplicate_testcase",
  "bulk_create_testcases", "bulk_update_testcases", "bulk_archive_testcases",
  "link_requirement_to_testcase", "unlink_requirement_from_testcase", "clone_test_suite"
]);

export function isDirectTestcasePublisher(name: string): boolean {
  return DIRECT_TESTCASE_PUBLISHERS.has(name);
}

/** Server-only opt-in for isolated verification; this is not governed-writer production acceptance. */
export function proposalReviewPreviewEnabled(): boolean {
  return process.env.TESBO_PROPOSAL_REVIEW_PREVIEW_ENABLED === "1";
}

export function humanPublicationRequired(projectId: string) {
  const stagingAvailable = proposalReviewPreviewEnabled();
  return {
    code: "HUMAN_PUBLICATION_REQUIRED",
    error: stagingAvailable
      ? "Machine clients cannot publish official testcase changes. Use stage_testcase_changes, then have a human review and save the exact selected proposals. Dependency and suite changes require their native human editing action."
      : "Machine clients cannot publish official testcase changes. The proposal review preview is unavailable on this deployment. Use native human editing; no machine apply or approval is available.",
    stagingAvailable,
    stageTool: stagingAvailable ? "stage_testcase_changes" : null,
    stageEndpoint: stagingAvailable ? `/api/projects/${projectId}/agents/zyra/tasks/proposals` : null,
    reviewPath: `/projects/${projectId}/agents/tasks`
  };
}

/** Actual mutating native routes; POST searches, previews, exports and evidence intake are not blanket-blocked. */
export function isProtectedTestcaseRestWrite(method: string, projectSuffix: string): boolean {
  const verb = method.toUpperCase();
  const suffix = projectSuffix.replace(/\/$/, "").toLowerCase();
  if (verb === "POST") return [
    /^\/testcases$/,
    /^\/testcases\/(?:bulk-create|bulk-update|bulk-delete|import)$/,
    /^\/testcases\/[^/]+\/(?:duplicate|approve)$/,
    /^\/custom-tags$/,
    /^\/custom-fields\/definitions(?:\/reorder|\/[^/]+\/(?:options|restore))?$/,
    /^\/review-board\/recommendations\/[^/]+\/(?:keep|edit|remove)$/,
    /^\/ai\/generation-history\/[^/]+\/save$/,
    /^\/agents\/zyra\/tasks\/[^/]+\/(?:save|close)$/
  ].some(route => route.test(suffix));
  if (verb === "PUT") return /^\/testcases\/[^/]+(?:\/custom-field-values)?$/.test(suffix);
  if (verb === "PATCH") return [
    /^\/custom-tags\/[^/]+$/,
    /^\/custom-fields\/definitions\/[^/]+(?:\/status|\/options\/[^/]+)?$/
  ].some(route => route.test(suffix));
  if (verb === "DELETE") return [
    /^\/testcases\/[^/]+$/,
    /^\/custom-tags\/[^/]+$/,
    /^\/custom-fields\/definitions\/[^/]+$/
  ].some(route => route.test(suffix));
  return false;
}
