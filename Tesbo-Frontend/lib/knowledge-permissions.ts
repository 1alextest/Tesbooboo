/**
 * Mirrors the API's kbRequireMutateAccess (legacy.service.ts): owners and managers may rename,
 * move, edit or delete any knowledge-base item; anyone else only an item they created. The API
 * enforces this regardless — the UI uses it to stop offering actions that would only be refused,
 * after a confirmation, with "You can only modify items you created".
 *
 * `creatorId` is the item's createdBy (folders, documents) or uploadedBy (files) — the field the
 * API checks for that item type.
 */
/** A project_members.role value is owner or manager — same normalisation as the API's normalizeRole. */
export function isKnowledgeOwnerOrManager(role: string | null | undefined): boolean {
  const n = (role ?? "").trim().toLowerCase().replace(/-/g, "_").replace(/ /g, "_");
  return n === "owner" || ["manager", "admin", "test_manager"].includes(n);
}

export function canModifyKnowledgeItem(
  isOwnerOrManager: boolean,
  creatorId: string | null | undefined,
  currentUserId: string | null | undefined
): boolean {
  if (isOwnerOrManager) return true;
  return Boolean(creatorId && currentUserId && creatorId === currentUserId);
}
