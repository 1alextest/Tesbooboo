/** Compare every case-detail field except asynchronous embedding progress/time.
 * Keep editRevision, attribution, identity and all authored fields in the oracle.
 */
export function testcaseEditState(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).filter(([key]) =>
    !["embeddingStatus", "embeddingContentHash", "updatedAt"].includes(key)));
}
