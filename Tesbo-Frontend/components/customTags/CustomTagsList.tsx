"use client";

import { useState } from "react";
import { IconPencil, IconTrash } from "@tabler/icons-react";
import { createCustomTag, deleteCustomTag, updateCustomTag, CUSTOM_TAG_NAME_MAX_LENGTH, type CustomTag } from "@/lib/api";
import { Button, Field, FieldError, Input, Modal } from "@/components/ui";

export default function CustomTagsList({
  projectId,
  tags,
  onChanged,
}: {
  projectId: string;
  tags: CustomTag[];
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CustomTag | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // One row at a time is in edit mode; the others keep their edit/delete actions.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  function nameError(value: string): string | null {
    if (!value) return "Tag name is required.";
    if (value.length > CUSTOM_TAG_NAME_MAX_LENGTH) return `Tag name must be ${CUSTOM_TAG_NAME_MAX_LENGTH} characters or fewer.`;
    return null;
  }

  function startEdit(tag: CustomTag) {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  async function saveEdit(tag: CustomTag) {
    const trimmed = editName.trim();
    const invalid = nameError(trimmed);
    if (invalid) {
      setEditError(invalid);
      return;
    }
    if (trimmed === tag.name) {
      cancelEdit();
      return;
    }
    setBusyId(tag.id);
    setEditError(null);
    try {
      await updateCustomTag(projectId, tag.id, { name: trimmed });
      setEditingId(null);
      onChanged();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to rename tag.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    const invalid = nameError(trimmed);
    if (invalid) {
      setAddError(invalid);
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      await createCustomTag(projectId, { name: trimmed });
      setName("");
      onChanged();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to create tag.");
    } finally {
      setAdding(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setBusyId(target.id);
    setDeleteError(null);
    try {
      await deleteCustomTag(projectId, target.id);
      setDeleteTarget(null);
      onChanged();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete tag.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <form onSubmit={handleAdd} className="flex shrink-0 items-start gap-2">
        <Field className="flex-1">
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Regression, Smoke, Flaky"
            maxLength={CUSTOM_TAG_NAME_MAX_LENGTH}
          />
          {addError && <FieldError>{addError}</FieldError>}
        </Field>
        <Button type="submit" disabled={adding}>
          Add tag
        </Button>
      </form>

      {tags.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No custom tags yet. Add one above to start tagging test cases.</p>
      ) : (
        // A grid of compact cells, each tag's actions beside its own name — a full-width row per tag
        // left a wide empty gap between the two. Sized to its rows, not stretched to the page:
        // min-h-0 + overflow still let it shrink and scroll inside the viewport-pinned page.
        <ul className="grid min-h-0 grid-cols-1 content-start gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
          {tags.map((tag) =>
            editingId === tag.id ? (
              <li key={tag.id} className="rounded-lg border border-[var(--border)] px-2 py-1.5">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveEdit(tag);
                  }}
                  className="flex items-start gap-1.5"
                >
                  <Field className="min-w-0 flex-1">
                    <Input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") cancelEdit();
                      }}
                      aria-label={`New name for tag ${tag.name}`}
                      maxLength={CUSTOM_TAG_NAME_MAX_LENGTH}
                      autoFocus
                    />
                    {editError && <FieldError>{editError}</FieldError>}
                  </Field>
                  <Button type="submit" size="sm" disabled={busyId === tag.id}>
                    Save
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={cancelEdit}>
                    Cancel
                  </Button>
                </form>
              </li>
            ) : (
              <li key={tag.id} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] py-1 pl-3 pr-1">
                <span className="min-w-0 truncate text-sm font-medium text-[var(--foreground)]" title={tag.name}>
                  {tag.name}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label={`Edit tag ${tag.name}`}
                    onClick={() => startEdit(tag)}
                    disabled={busyId === tag.id}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)]"
                  >
                    <IconPencil size={16} stroke={1.75} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete tag ${tag.name}`}
                    onClick={() => setDeleteTarget(tag)}
                    disabled={busyId === tag.id}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-secondary)] hover:text-[var(--error-foreground)]"
                  >
                    <IconTrash size={16} stroke={1.75} />
                  </button>
                </div>
              </li>
            )
          )}
        </ul>
      )}

      <Modal open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="Delete custom tag">
        <div className="space-y-4">
          <p className="text-sm text-[var(--muted)]">
            Delete &quot;{deleteTarget?.name}&quot;? It will be removed from every test case it&apos;s currently assigned to. This cannot be undone.
          </p>
          {deleteError && <p className="text-sm text-[var(--error-foreground)]">{deleteError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={confirmDelete} disabled={busyId === deleteTarget?.id}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
