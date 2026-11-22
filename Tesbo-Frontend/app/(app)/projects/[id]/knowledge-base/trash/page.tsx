"use client";

import Link from "next/link";
import { useParams } from "@/lib/routeParams";
import { useCallback, useEffect, useState } from "react";
import {
  getKnowledgeTrash,
  restoreKnowledgeDocument,
  restoreKnowledgeFolder,
  type KnowledgeTrash
} from "@/lib/api";
import { formatDate } from "@/lib/date";

type RestoreTarget = { kind: "folder" | "document"; id: string } | null;

/**
 * Trash lists what the project deleted and says honestly whether it can come back. Restoring a
 * folder brings back the folders and documents deleted with it; documents whose folder is still
 * deleted must wait for the folder; uploaded files are listed but cannot be restored because their
 * bytes were removed from storage on delete.
 */
export default function KnowledgeTrashPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [trash, setTrash] = useState<KnowledgeTrash | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<RestoreTarget>(null);

  const load = useCallback(async () => {
    try {
      setTrash(await getKnowledgeTrash(projectId));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load Trash.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function restore(kind: "folder" | "document", id: string, label: string) {
    setRestoring({ kind, id });
    setError(null);
    setNotice(null);
    try {
      if (kind === "folder") {
        const restored = await restoreKnowledgeFolder(projectId, id);
        const withDocuments = restored.restoredDocuments
          ? ` and ${restored.restoredDocuments} document${restored.restoredDocuments === 1 ? "" : "s"}`
          : "";
        setNotice(`Restored "${label}"${withDocuments}.`);
      } else {
        await restoreKnowledgeDocument(projectId, id);
        setNotice(`Restored "${label}".`);
      }
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not restore the item.");
    } finally {
      setRestoring(null);
    }
  }

  const total = trash ? trash.folders.length + trash.documents.length + trash.files.length : 0;

  return (
    <main className="space-y-5 p-5">
      <header className="space-y-1">
        <Link href={`/projects/${projectId}/knowledge-base`} className="text-[12px] text-[var(--accent-light)] hover:underline">
          ← Knowledge base
        </Link>
        <h1 className="text-xl font-semibold">Trash</h1>
        <p className="text-[12.5px] text-[var(--muted)]">
          {trash?.note ?? "Deleted folders, documents and files, and whether each can be restored."}
        </p>
      </header>

      {error && (
        <p role="alert" className="rounded border border-[var(--error)] bg-[var(--error-soft)] p-3 text-[12.5px] text-[var(--error-foreground)]">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded border border-[var(--border)] bg-[var(--surface-secondary)] p-3 text-[12.5px]">
          {notice}
        </p>
      )}

      {loading ? (
        <p className="text-[13px] text-[var(--muted)]">Loading Trash…</p>
      ) : total === 0 ? (
        <section className="rounded border border-[var(--border)] p-4">
          <h2 className="font-medium">Trash is empty</h2>
          <p className="mt-1 text-[12.5px] text-[var(--muted)]">Deleted folders, documents and files will appear here.</p>
        </section>
      ) : (
        <div className="space-y-6">
          <section aria-label="Deleted folders" className="space-y-2">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Folders ({trash?.folders.length ?? 0})
            </h2>
            {trash?.folders.length ? (
              <ul className="divide-y divide-[var(--border)] rounded border border-[var(--border)]">
                {trash.folders.map((folder) => (
                  <li key={folder.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-[12.5px]">
                    <div>
                      <p className="font-medium">{folder.name}</p>
                      <p className="text-[11.5px] text-[var(--muted)]">
                        {folder.parentName ? `in ${folder.parentName}` : "at the top level"} · deleted {formatDate(folder.deletedAt)}
                      </p>
                      {!folder.restorable && folder.unavailableReason && (
                        <p className="text-[11.5px] text-[var(--warning-foreground)]">{folder.unavailableReason}</p>
                      )}
                    </div>
                    {folder.restorable ? (
                      <button
                        type="button"
                        onClick={() => void restore("folder", folder.id, folder.name)}
                        disabled={restoring?.id === folder.id}
                        className="rounded border border-[var(--border)] px-2 py-1 text-[12px] hover:bg-[var(--surface-secondary)] disabled:opacity-60"
                      >
                        {restoring?.id === folder.id ? "Restoring…" : `Restore ${folder.name}`}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px] text-[var(--muted)]">No deleted folders.</p>
            )}
          </section>

          <section aria-label="Deleted documents" className="space-y-2">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Documents ({trash?.documents.length ?? 0})
            </h2>
            {trash?.documents.length ? (
              <ul className="divide-y divide-[var(--border)] rounded border border-[var(--border)]">
                {trash.documents.map((document) => (
                  <li key={document.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-[12.5px]">
                    <div>
                      <p className="font-medium">{document.title}</p>
                      <p className="text-[11.5px] text-[var(--muted)]">
                        {document.folderName ? `in ${document.folderName}` : "no folder"} · deleted {formatDate(document.deletedAt)}
                      </p>
                      {!document.restorable && document.unavailableReason && (
                        <p className="text-[11.5px] text-[var(--warning-foreground)]">{document.unavailableReason}</p>
                      )}
                    </div>
                    {document.restorable ? (
                      <button
                        type="button"
                        onClick={() => void restore("document", document.id, document.title)}
                        disabled={restoring?.id === document.id}
                        className="rounded border border-[var(--border)] px-2 py-1 text-[12px] hover:bg-[var(--surface-secondary)] disabled:opacity-60"
                      >
                        {restoring?.id === document.id ? "Restoring…" : `Restore ${document.title}`}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px] text-[var(--muted)]">No deleted documents.</p>
            )}
          </section>

          <section aria-label="Deleted files" className="space-y-2">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Files ({trash?.files.length ?? 0})
            </h2>
            {trash?.files.length ? (
              <ul className="divide-y divide-[var(--border)] rounded border border-[var(--border)]">
                {trash.files.map((file) => (
                  <li key={file.id} className="p-3 text-[12.5px]">
                    <p className="font-medium">{file.name}</p>
                    <p className="text-[11.5px] text-[var(--muted)]">
                      {file.folderName ? `in ${file.folderName}` : "no folder"} · deleted {formatDate(file.deletedAt)}
                    </p>
                    {file.unavailableReason && (
                      <p className="text-[11.5px] text-[var(--warning-foreground)]">{file.unavailableReason}</p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px] text-[var(--muted)]">No deleted files.</p>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
