"use client";

import { useRouter } from "next/navigation";
import { useParams } from "@/lib/routeParams";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { JSONContent } from "@tiptap/react";
import {
  IconDots,
  IconArrowLeft,
  IconArrowRight,
  IconCopy,
  IconTrash,
  IconHistory,
  IconLink,
  IconCheck,
  IconX,
  IconMessagePlus,
} from "@tabler/icons-react";
import {
  getKnowledgeDocument,
  updateKnowledgeDocument,
  duplicateKnowledgeDocument,
  deleteKnowledgeDocument,
  restoreKnowledgeDocumentVersion,
  approveAiMemory,
  rejectAiMemory,
  type KnowledgeDocument,
  type KnowledgeDocumentHistoryEntry,
  type KnowledgeBreadcrumbEntry,
  integrationProviderLabel,
} from "@/lib/api";
import { canModifyKnowledgeItem } from "@/lib/knowledge-permissions";
import { DocumentWriteCancelledError, DocumentWriteQueue } from "@/lib/documentWriteQueue";
import { Button, Input, Modal, PageLoader, StatusChip } from "@/components/ui";
import RichTextEditor from "@/components/knowledge-base/RichTextEditor";
import { DocumentComments } from "@/components/knowledge-base/DocumentComments";
import { ZyraMemoryEntries } from "@/components/knowledge-base/ZyraMemoryEntries";
import { ChangeHistoryList } from "@/components/knowledge-base/ChangeHistory";
import { blankDocumentFlagKey } from "@/lib/validation";
import { formatDateTime } from "@/lib/date";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/workflows";
import { useAppData } from "@/components/app/AppDataProvider";
import { useProjectData } from "@/components/project/ProjectDataProvider";

type SaveStatus = "saved" | "saving" | "unsaved";
type DocumentPayload = { contentJson: JSONContent; contentHtml: string; contentText: string };

// Keep in sync with MAX_REQUEST_BODY_SIZE / maxRequestBodySize in Tesbo-Backend-Nest/src/config/app-config.service.ts
const MAX_DOCUMENT_PAYLOAD_BYTES = 20 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** PostgreSQL jsonb can return object keys in a different order from the editor. */
function sameJsonValue(left: unknown, right: unknown): boolean {
  const ordered = (_key: string, value: unknown) => value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value;
  return JSON.stringify(left, ordered) === JSON.stringify(right, ordered);
}

function documentPayloadSize(payload: { contentJson: JSONContent; contentHtml: string; contentText: string } | null): number {
  if (!payload) return 0;
  return new Blob([JSON.stringify(payload.contentJson), payload.contentHtml, payload.contentText]).size;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  general: "General",
  api_note: "API Note",
  release_note: "Release Note",
  requirement_note: "Requirement",
  test_data_note: "Test Data",
};

function normalizeRole(role: string): "owner" | "manager" | "qa_engineer" {
  const n = (role ?? "").trim().toLowerCase().replace(/-/g, "_").replace(/ /g, "_");
  if (n === "owner") return "owner";
  if (n === "manager" || n === "admin" || n === "test_manager") return "manager";
  return "qa_engineer";
}

const FLASH_HIGHLIGHT_NAME = "kb-comment-flash";
const FLASH_HIGHLIGHT_STYLE_ID = "kb-comment-flash-style";

/**
 * Installs the ::highlight() rule the flash needs, once, on first use.
 *
 * This lives here rather than in globals.css because Turbopack's CSS parser doesn't recognise the
 * ::highlight() pseudo-element and fails the production build on it. Injecting it keeps the rule
 * away from build-time CSS parsing; var()/color-mix() still resolve against :root at runtime.
 * Only called once the Custom Highlight API has been feature-detected, so it never adds a rule
 * to a browser that couldn't use it anyway.
 */
function ensureFlashHighlightStyle(): void {
  if (document.getElementById(FLASH_HIGHLIGHT_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = FLASH_HIGHLIGHT_STYLE_ID;
  style.textContent = `::highlight(${FLASH_HIGHLIGHT_NAME}){background-color:color-mix(in oklab, var(--warning) 35%, transparent);color:var(--foreground);}`;
  document.head.appendChild(style);
}

/** Flattens a container's text nodes so a quote spanning several elements can still be located. */
function textNodeMap(container: HTMLElement): { nodes: Text[]; text: string; starts: number[] } {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  const starts: number[] = [];
  let text = "";
  let node = walker.nextNode() as Text | null;
  while (node) {
    starts.push(text.length);
    nodes.push(node);
    text += node.data;
    node = walker.nextNode() as Text | null;
  }
  return { nodes, text, starts };
}

/** Maps an offset in the flattened text back to a (node, offset) pair. */
function locate(map: ReturnType<typeof textNodeMap>, offset: number): { node: Text; offset: number } | null {
  for (let i = map.nodes.length - 1; i >= 0; i -= 1) {
    if (offset >= map.starts[i]) return { node: map.nodes[i], offset: Math.min(offset - map.starts[i], map.nodes[i].data.length) };
  }
  return null;
}

/** The user's current selection, as a quote plus its offsets into the container's text. */
function readSelection(container: HTMLElement): { text: string; start: number; end: number } | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return null;
  const quote = selection.toString().replace(/\s+/g, " ").trim();
  if (quote.length < 2) return null;

  const before = document.createRange();
  before.selectNodeContents(container);
  before.setEnd(range.startContainer, range.startOffset);
  const start = before.toString().length;
  return { text: quote.slice(0, 2000), start, end: start + quote.length };
}

/**
 * Scrolls a quoted passage into view and briefly highlights it.
 *
 * Uses the CSS Custom Highlight API rather than wrapping the text in a <mark>: the body is
 * rendered by TipTap, and mutating its DOM would desync the editor. Where the API is missing the
 * passage still scrolls into view, just without the flash.
 */
function flashQuote(container: HTMLElement, quote: string, hint: number | null): boolean {
  const map = textNodeMap(container);
  const needle = quote.replace(/\s+/g, " ").trim();
  if (!needle) return false;

  // Prefer the occurrence nearest the stored offset, so repeated phrases resolve to the one that
  // was actually commented on.
  let index = -1;
  if (hint !== null) {
    const from = Math.max(0, hint - needle.length);
    index = map.text.indexOf(needle, from);
  }
  if (index === -1) index = map.text.indexOf(needle);
  if (index === -1) return false;

  const from = locate(map, index);
  const to = locate(map, index + needle.length);
  if (!from || !to) return false;

  const range = document.createRange();
  range.setStart(from.node, from.offset);
  range.setEnd(to.node, to.offset);

  const rect = range.getBoundingClientRect();
  window.scrollTo({ top: window.scrollY + rect.top - window.innerHeight / 3, behavior: "smooth" });

  const highlights = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights;
  const HighlightCtor = (window as unknown as { Highlight?: new (...ranges: Range[]) => unknown }).Highlight;
  if (highlights && HighlightCtor) {
    ensureFlashHighlightStyle();
    highlights.set(FLASH_HIGHLIGHT_NAME, new HighlightCtor(range));
    setTimeout(() => highlights.delete(FLASH_HIGHLIGHT_NAME), 2000);
  }
  return true;
}

export default function KnowledgeDocumentPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const documentId = params.documentId as string;
  const { currentUser } = useAppData();
  const { project, projectMembers } = useProjectData();
  const projectName = String(project.name || "");

  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<KnowledgeDocument | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<KnowledgeBreadcrumbEntry[]>([]);
  const [title, setTitle] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [error, setError] = useState<string | null>(null);
  const [canApprove, setCanApprove] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  // The version a "Restore" click is asking to confirm — null means no confirmation is showing.
  const [confirmTarget, setConfirmTarget] = useState<KnowledgeDocumentHistoryEntry | null>(null);
  const [restorePhase, setRestorePhase] = useState<"idle" | "restoring" | "error">("idle");
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [reviewPending, setReviewPending] = useState(false);
  const [reviewContextText, setReviewContextText] = useState("");
  // Bumped only when the editor's content must be force-replaced (a restore) — not on every
  // ordinary save, which would otherwise reset the caret/scroll position on every autosave tick.
  const [contentResetKey, setContentResetKey] = useState(0);
  const [linkCopied, setLinkCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  // The selection captured by the floating "Comment" button, handed to DocumentComments as the
  // anchor for the next thread.
  const [pendingAnchor, setPendingAnchor] = useState<{ text: string; start: number; end: number } | null>(null);
  const [selectionBubble, setSelectionBubble] = useState<{ top: number; left: number } | null>(null);
  const [anchorMissMessage, setAnchorMissMessage] = useState<string | null>(null);
  // Documents created from the "Blank document" template require both a title and content to
  // be saved, rather than the usual title-or-content rule (see knowledge-base/page.tsx).
  const [requireContentAndTitle, setRequireContentAndTitle] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestContent = useRef<DocumentPayload | null>(null);
  const pendingAutosave = useRef<((visible?: boolean) => void) | null>(null);
  const latestTitle = useRef("");
  const lastValidTitle = useRef("");
  const [titleError, setTitleError] = useState<string | null>(null);
  const editRevision = useRef(0);
  const writerRef = useRef<DocumentWriteQueue<KnowledgeDocument> | null>(null);
  // Synchronous double-submit guard for restore: state alone can't stop a second click that fires
  // before React re-renders the disabled button, so this is checked and set before any await.
  const restoreInFlightRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const writer = new DocumentWriteQueue<KnowledgeDocument>();
    writerRef.current = writer;
    editRevision.current = 0;
    restoreInFlightRef.current = false;
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = null;
      const pending = pendingAutosave.current;
      pendingAutosave.current = null;
      // This closure owns the original document, payload and failure generation. Drain it before
      // closing the old writer, without allowing its response to update the destination page.
      pending?.(false);
      writer.close();
      if (writerRef.current === writer) writerRef.current = null;
    };
  }, [projectId, documentId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!currentUser) {
        router.replace("/login");
        return;
      }
      setLoading(true);
      setCurrentUserId(currentUser.userId);
      try {
        const data = await getKnowledgeDocument(projectId, documentId);
        if (cancelled) return;
        // Keep the saved body available for explicit saves and title-only edits without relying
        // on the editor to emit a fake content update while its interaction mode is initialized.
        latestContent.current = {
          contentJson: (data.contentJson ?? null) as JSONContent,
          contentHtml: data.contentHtml ?? "",
          contentText: data.contentText ?? "",
        };
        latestTitle.current = data.title;
        lastValidTitle.current = data.title;
        writerRef.current?.initialize(data);
        setReviewContextText(data.contentText ?? "");
        setDoc(data);
        setBreadcrumb(data.breadcrumb);
        setTitle(data.title);
        setSaveStatus("saved");
        setError(null);
        setHistoryOpen(false);
        setConfirmTarget(null);
        setRestorePhase("idle");
        setRestoreError(null);
        try {
          setRequireContentAndTitle(window.localStorage.getItem(blankDocumentFlagKey(documentId)) === "1");
        } catch {
          // Private browsing / storage disabled — fall back to the default title-or-content rule.
        }
        const role = normalizeRole(projectMembers.find((m) => m.userId === currentUser.userId)?.role ?? "qa_engineer");
        setCanApprove(role === "owner" || role === "manager");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load document.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, documentId, currentUser]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  // Offers "Comment" whenever there's a selection inside the document body. Bound to selection
  // end (mouseup/keyup) rather than `selectionchange`, which fires on every extend of a drag.
  useEffect(() => {
    function onSelectionEnd() {
      const container = bodyRef.current;
      if (!container) return;
      const selected = readSelection(container);
      if (!selected) {
        setSelectionBubble(null);
        return;
      }
      const range = window.getSelection()?.getRangeAt(0);
      if (!range) return;
      const rect = range.getBoundingClientRect();
      const hostRect = container.getBoundingClientRect();
      setSelectionBubble({ top: rect.top - hostRect.top - 40, left: Math.max(0, rect.left - hostRect.left) });
    }
    document.addEventListener("mouseup", onSelectionEnd);
    document.addEventListener("keyup", onSelectionEnd);
    return () => {
      document.removeEventListener("mouseup", onSelectionEnd);
      document.removeEventListener("keyup", onSelectionEnd);
    };
  }, []);

  function captureSelection() {
    const container = bodyRef.current;
    if (!container) return;
    const selected = readSelection(container);
    if (!selected) return;
    setPendingAnchor(selected);
    setSelectionBubble(null);
    window.getSelection()?.removeAllRanges();
    document.getElementById("kb-comments")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function jumpToAnchor(anchorText: string) {
    const container = bodyRef.current;
    if (!container) return;
    const found = flashQuote(container, anchorText, null);
    // A re-synced body can drop the passage a comment was anchored to. Say so rather than
    // silently doing nothing.
    setAnchorMissMessage(found ? null : "That passage is no longer in this document — it was probably changed by a later sync.");
    if (found) setAnchorMissMessage(null);
  }

  function scheduleSave(nextTitle: string) {
    const writer = writerRef.current;
    if (!writer || restoreInFlightRef.current || doc?.id !== documentId) return;
    // A blank title must never be persisted. The editor keeps showing what the person typed so they
    // can fix it, but body edits continue to carry the last valid title.
    if (!nextTitle.trim()) {
      setTitleError("A document title is required");
      return;
    }
    setTitleError(null);
    setSaveStatus("unsaved");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const revision = editRevision.current;
    const generation = writer.capture();
    const payload = latestContent.current;
    const pending = (visible = true) => { void saveSnapshot(writer, nextTitle, payload, revision, generation, false, visible); };
    pendingAutosave.current = pending;
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      if (pendingAutosave.current === pending) pendingAutosave.current = null;
      pending();
    }, 1200);
  }

  function handleEditorUpdate(payload: { json: JSONContent; html: string; text: string }) {
    if (restoreInFlightRef.current || doc?.id !== documentId) return;
    latestContent.current = { contentJson: payload.json, contentHtml: payload.html, contentText: payload.text };
    setReviewContextText(payload.text);
    editRevision.current++;
    scheduleSave(latestTitle.current);
  }

  function handleTitleChange(value: string) {
    if (restoreInFlightRef.current || doc?.id !== documentId) return;
    if (!value.trim()) {
      setTitle(value);
      setTitleError("A document title is required");
      return;
    }
    setTitleError(null);
    lastValidTitle.current = value;
    latestTitle.current = value;
    editRevision.current++;
    setTitle(value);
    scheduleSave(value);
  }

  /** Restore the last valid title when a blank edit is abandoned, rather than persisting or losing it. */
  function handleTitleBlur() {
    if (title.trim()) return;
    setTitle(lastValidTitle.current);
    setTitleError(null);
  }

  async function handleManualSave() {
    const writer = writerRef.current;
    if (!writer || restoreInFlightRef.current || doc?.id !== documentId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    pendingAutosave.current = null;
    await saveSnapshot(writer, latestTitle.current, latestContent.current, editRevision.current, writer.capture(), true);
  }

  async function saveSnapshot(writer: DocumentWriteQueue<KnowledgeDocument>, nextTitle: string, payload: DocumentPayload | null, revision: number, generation: number, explicit: boolean, visible = true) {
    // Applies to every save path (autosave, manual save and retries), not only the title handler.
    if (!nextTitle.trim()) {
      setTitleError("A document title is required");
      return;
    }
    const size = documentPayloadSize(payload);
    if (size > MAX_DOCUMENT_PAYLOAD_BYTES) {
      if (visible) setError(
        `This document is ${formatFileSize(size)}, which is over the ${formatFileSize(MAX_DOCUMENT_PAYLOAD_BYTES)} limit we currently support. Split it into smaller documents to save.`
      );
      if (visible) setSaveStatus("unsaved");
      return;
    }
    const missingTitle = !nextTitle.trim();
    const missingContent = !(payload?.contentText ?? "").trim();
    if (requireContentAndTitle ? missingTitle || missingContent : missingTitle && missingContent) {
      if (visible && explicit) setError(
        requireContentAndTitle
          ? "This document needs both a title and content before it can be saved."
          : "A document needs a title or some content — it can't be saved blank."
      );
      if (visible) setSaveStatus("unsaved");
      return;
    }
    if (visible) setSaveStatus("saving");
    try {
      const updated = await writer.save(revision, async () => {
        const acknowledged = writer.acknowledged;
        if (writer.needsReadback) {
          // A lost ACK may already have committed. Only a NEW explicit Save may reconcile it;
          // debounced/queued edits never replay an uncertain mutation or adopt another edit.
          if (!explicit) throw new Error("Check the saved document with Save before retrying your retained changes.");
          const current = await getKnowledgeDocument(projectId, documentId);
          if (current.title === nextTitle.trim() &&
              sameJsonValue(current.contentJson, payload?.contentJson ?? null) &&
              (current.contentHtml ?? "") === (payload?.contentHtml ?? "") &&
              (current.contentText ?? "") === (payload?.contentText ?? "")) {
            return current; // Exact desired content independently read back; no duplicate write.
          }
          if (!acknowledged?.editRevision || current.editRevision !== acknowledged.editRevision) {
            throw new Error("This document changed while the save was unconfirmed. Your draft is still here. Copy your draft before reloading to compare with the saved document.");
          }
        }
        return updateKnowledgeDocument(projectId, documentId, {
          title: nextTitle,
          contentJson: payload?.contentJson,
          contentHtml: payload?.contentHtml,
          contentText: payload?.contentText,
          expectedRevision: acknowledged?.editRevision,
        });
      }, generation);
      if (!visible || !isMountedRef.current || writerRef.current !== writer || revision !== editRevision.current || restoreInFlightRef.current) return;
      setDoc(updated);
      setSaveStatus("saved");
      setError(null);
    } catch (err) {
      if (!visible || err instanceof DocumentWriteCancelledError || !isMountedRef.current || writerRef.current !== writer || revision !== editRevision.current || restoreInFlightRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to save document.");
      setSaveStatus("unsaved");
    }
  }

  async function handleDuplicate() {
    if (restoreInFlightRef.current) return;
    try {
      const dup = await duplicateKnowledgeDocument(projectId, documentId);
      router.push(`/projects/${projectId}/knowledge-base/documents/${dup.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to duplicate document.");
    }
  }

  async function handleDelete() {
    if (restoreInFlightRef.current) return;
    if (!window.confirm(`Delete "${title}"? It will be moved to trash.`)) return;
    try {
      await deleteKnowledgeDocument(projectId, documentId);
      router.push(`/projects/${projectId}/knowledge-base`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete document.");
    }
  }

  function openHistory() {
    setHistoryOpen(true);
    setConfirmTarget(null);
    setRestorePhase("idle");
    setRestoreError(null);
    // ChangeHistoryList fetches its own timeline (mirror sync log or manual version diffs) —
    // nothing to preload here.
  }

  // Restore is a two-step action: this only opens the confirmation, it never calls the API. Only a
  // manual document's version-diff entries ever carry a versionId (see ChangeHistoryList), so this
  // is only ever reachable for those.
  function requestRestoreVersion(entry: KnowledgeDocumentHistoryEntry) {
    if (restoreInFlightRef.current || !entry.versionId) return; // one confirmation/restore/review in flight at a time
    setConfirmTarget(entry);
    setRestorePhase("idle");
    setRestoreError(null);
  }

  function cancelRestoreVersion() {
    if (restorePhase === "restoring") return; // nothing to abandon safely mid-request
    setConfirmTarget(null);
    setRestoreError(null);
  }

  // Guards the history Modal's own close (Escape / backdrop click) the same way: closing while a
  // restore is in flight would leave the confirm dialog gone but the request still resolving into
  // state nothing is listening to render correctly.
  function closeHistoryModal() {
    if (restorePhase === "restoring") return;
    setHistoryOpen(false);
    setConfirmTarget(null);
    setRestoreError(null);
  }

  async function confirmRestoreVersion() {
    const writer = writerRef.current;
    if (!confirmTarget || !writer || restoreInFlightRef.current || doc?.id !== documentId) return;
    restoreInFlightRef.current = true;
    setRestorePhase("restoring");
    setRestoreError(null);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    pendingAutosave.current = null; // Only a confirmed restore replaces the unsent debounce draft.
    try {
      // Drain earlier in-flight/queued writes before sending the restore. If one fails after this
      // confirmation, the queue rejects the barrier instead of blindly sending another mutation.
      const updated = await writer.restore(() => restoreKnowledgeDocumentVersion(projectId, documentId, confirmTarget.versionId!, writer.acknowledged?.editRevision));
      if (!isMountedRef.current || writerRef.current !== writer) return;
      latestContent.current = {
        contentJson: (updated.contentJson ?? null) as JSONContent,
        contentHtml: updated.contentHtml ?? "",
        contentText: updated.contentText ?? "",
      };
      latestTitle.current = updated.title;
      lastValidTitle.current = updated.title;
      setReviewContextText(updated.contentText ?? "");
      editRevision.current++;
      setDoc(updated);
      setTitle(updated.title);
      setSaveStatus("saved");
      setError(null);
      // Forces the TipTap instance to actually re-render the restored body — see RichTextEditor,
      // which otherwise only consumes `contentJson`/`contentHtml` once, at mount.
      setContentResetKey((k) => k + 1);
      setConfirmTarget(null);
      setRestorePhase("idle");
      setHistoryOpen(false);
    } catch (err) {
      if (!isMountedRef.current || writerRef.current !== writer) return;
      setSaveStatus("unsaved");
      setRestorePhase("error");
      setRestoreError(err instanceof Error ? err.message : "Failed to restore version.");
    } finally {
      if (writerRef.current === writer) restoreInFlightRef.current = false;
    }
  }

  async function handleApprove() {
    await handleReview("approved");
  }

  async function handleReject() {
    await handleReview("rejected");
  }

  async function handleReview(decision: "approved" | "rejected") {
    const writer = writerRef.current;
    if (!writer || restoreInFlightRef.current || doc?.id !== documentId) return;
    if (!title.trim() || titleError || documentPayloadSize(latestContent.current) > MAX_DOCUMENT_PAYLOAD_BYTES ||
        (requireContentAndTitle && !latestContent.current?.contentText.trim())) {
      setError("Finish saving a valid document before reviewing it.");
      return;
    }
    if (saveStatus === "unsaved" && !pendingAutosave.current) {
      setError("Save your changes successfully before reviewing this document.");
      return;
    }
    restoreInFlightRef.current = true; // The same queue barrier also fences edits during review.
    setReviewPending(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    const pending = pendingAutosave.current;
    pendingAutosave.current = null;
    pending?.();
    try {
      const updated = await writer.restore(() => {
        const saved = writer.acknowledged;
        if (saved?.id !== documentId || !saved.editRevision) throw new Error("Reload this document before reviewing it.");
        return decision === "approved"
          ? approveAiMemory(projectId, documentId, saved.editRevision)
          : rejectAiMemory(projectId, documentId, saved.editRevision);
      });
      if (!isMountedRef.current || writerRef.current !== writer) return;
      setDoc(updated);
      setSaveStatus("saved");
      setError(null);
    } catch (err) {
      if (!isMountedRef.current || writerRef.current !== writer) return;
      // A failed queued save leaves the visible draft uncommitted. A second review click
      // must not approve the older persisted copy after the queue barrier is released.
      setSaveStatus("unsaved");
      setError(err instanceof Error ? err.message : "Could not record this review. Reload and check its current state.");
    } finally {
      if (writerRef.current === writer) {
        restoreInFlightRef.current = false;
        setReviewPending(false);
      }
    }
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1500);
    });
  }

  if (loading || !doc || doc.id !== documentId) {
    return <PageLoader variant="screen" />;
  }

  const isAiMemory = doc.documentType === "ai_memory";
  const hasExactMemoryReview = doc.reviewBinding === "exact_snapshot";
  const memoryNeedsReview = isAiMemory && (!hasExactMemoryReview || (doc.status !== "approved" && doc.status !== "rejected"));
  // Provider mirrors are rewritten wholesale by each sync, so the editor is locked and the API
  // rejects updates. Comments are the writable channel — they're stored apart from the body.
  const isSyncedMirror = doc.isReadOnly && doc.sourceRole === "mirror";
  const providerLabel = integrationProviderLabel(doc.sourceProvider);
  // Zyra's own memory (flagged by the API): readable by everyone, but its body is never free-form
  // editable — Zyra reads it back as context. Owners/managers correct or remove single entries in
  // ZyraMemoryEntries instead; the API refuses direct content edits and version restores too.
  const isZyraMemory = Boolean(doc.isManagedByZyra);
  const bodyLocked = isSyncedMirror || isZyraMemory;
  // The API's rule for delete (kbRequireMutateAccess): owner/manager, or this document's creator.
  // canApprove is exactly "owner or manager" for this project.
  const canModifyDoc = canModifyKnowledgeItem(canApprove, doc.createdBy, currentUserId);

  // Update History is the same data and component everywhere — the Knowledge Base list's
  // info-icon popover and this modal never drift into showing different things for the same
  // document, whether it's a synced mirror or a manually-created one. Only the confirmation step
  // below is specific to this modal.
  let historyModalBody: React.ReactNode;
  if (confirmTarget) {
    historyModalBody = (
      <div className="space-y-4">
        <p className="text-[13px] text-[var(--foreground)]">
          Restore to the version from <span className="font-medium">{formatDateTime(confirmTarget.createdAt)}</span>?
          The current content will be saved as a new version first, so this can be undone.
        </p>
        {restorePhase === "error" && restoreError && (
          <div className="flex items-center justify-between rounded-lg border border-[var(--error)]/30 bg-[var(--error-soft)] px-3 py-2 text-[13px] text-[var(--error-foreground)]">
            <span>{restoreError}</span>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={cancelRestoreVersion} disabled={restorePhase === "restoring"}>
            Cancel
          </Button>
          <Button size="sm" variant="danger" onClick={confirmRestoreVersion} disabled={restorePhase === "restoring"}>
            {restorePhase === "restoring" ? "Restoring…" : "Restore"}
          </Button>
        </div>
      </div>
    );
  } else {
    // The confirmation step above is a separate modal body, not an in-list "Restoring…" state —
    // by the time a restore is actually in flight this branch isn't rendered at all.
    historyModalBody = (
      <ChangeHistoryList projectId={projectId} documentId={documentId} showHeading={false} onRestoreVersion={isZyraMemory ? undefined : requestRestoreVersion} />
    );
  }

  const parentFolder = breadcrumb[breadcrumb.length - 1];
  const rootFolder = breadcrumb[0];
  const breadcrumbItems: BreadcrumbItem[] = [
    { label: "Projects", href: "/projects" },
    { label: projectName || "Project", href: `/projects/${projectId}/dashboard` },
    { label: "Knowledge base", href: `/projects/${projectId}/knowledge-base` },
    ...breadcrumb.map((b) => ({ label: b.name, href: `/projects/${projectId}/knowledge-base?folder=${b.id}` })),
    { label: title || "Untitled" },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-3 flex items-center justify-between gap-3">
        <Breadcrumbs items={breadcrumbItems} />
        {parentFolder && (
          <Link
            href={`/projects/${projectId}/knowledge-base?folder=${parentFolder.id}`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-[6px] border border-[var(--border)] px-3 py-1.5 text-[13px] font-medium text-[var(--foreground)] hover:bg-[var(--surface-secondary)]"
          >
            <IconArrowLeft size={14} /> Back to {parentFolder.id === rootFolder?.id ? "Knowledge base" : parentFolder.name}
          </Link>
        )}
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-[var(--error)]/30 bg-[var(--error-soft)] px-4 py-2.5 text-sm text-[var(--error-foreground)]">
          <span>{error}</span>
          <button onClick={() => setError(null)}><IconX size={16} /></button>
        </div>
      )}

      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            onBlur={handleTitleBlur}
            readOnly={bodyLocked || restorePhase === "restoring" || reviewPending}
            className={`!h-auto w-full border-0 !bg-transparent px-0 text-[26px] font-semibold shadow-none focus:ring-0 ${
              bodyLocked ? "cursor-default" : ""
            }`}
            placeholder="Untitled document"
          />
          {titleError && (
            <p role="alert" className="mt-1 text-[12px] text-[var(--error-foreground)]">
              {titleError}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isSyncedMirror && (
            <StatusChip tone="info" dot>
              Synced from {providerLabel}
            </StatusChip>
          )}
          {isAiMemory && (
            <StatusChip tone={hasExactMemoryReview && doc.status === "approved" ? "success" : hasExactMemoryReview && doc.status === "rejected" ? "error" : "draft"} dot>
              {memoryNeedsReview ? "Review required" : doc.status === "approved" ? "Approved memory" : "Rejected"}
            </StatusChip>
          )}
          {!isAiMemory && (
            <span className="rounded-[4px] bg-[var(--surface-secondary)] px-2 py-0.5 font-mono text-[11px] font-medium text-[var(--accent-light)]">
              {DOC_TYPE_LABELS[doc.documentType] || "Document"}
            </span>
          )}
          {!bodyLocked && (
            <span className="text-[12px] text-[var(--muted-soft)]">
              {saveStatus === "saving" ? "Saving…" : saveStatus === "unsaved" ? "Unsaved changes" : "Saved"}
            </span>
          )}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="More actions"
              className="rounded-[6px] border border-[var(--border)] p-2 hover:bg-[var(--surface-secondary)]"
            >
              <IconDots size={16} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-20 mt-1 min-w-[180px] rounded-[8px] border border-[var(--border)] bg-[var(--surface-overlay)] py-1 shadow-[var(--shadow-elevated)]">
                <button onClick={handleDuplicate} disabled={restorePhase === "restoring" || reviewPending} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-[var(--surface-secondary)]">
                  <IconCopy size={14} /> Duplicate
                </button>
                <button onClick={openHistory} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-[var(--surface-secondary)]">
                  <IconHistory size={14} /> View history
                </button>
                <button onClick={handleCopyLink} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-[var(--surface-secondary)]">
                  <IconLink size={14} /> {linkCopied ? "Copied!" : "Copy link"}
                </button>
                {!isZyraMemory && canModifyDoc && (
                  <button onClick={handleDelete} disabled={restorePhase === "restoring" || reviewPending} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-[var(--error-foreground)] hover:bg-[var(--error-soft)]">
                    <IconTrash size={14} /> Delete
                  </button>
                )}
              </div>
            )}
          </div>
          {!bodyLocked && (
            <Button variant="secondary" size="sm" onClick={handleManualSave} disabled={restorePhase === "restoring" || reviewPending}>Save</Button>
          )}
        </div>
      </div>

      {/* The "why does this document look like this?" banner: what wrote it, who ran that sync,
          when, and where to put your own notes instead. */}
      {isSyncedMirror && (
        <div className="mb-4 rounded-[10px] border border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-3">
          <p className="text-[13px] text-[var(--foreground)]">
            Read-only — this document is written by the {providerLabel} integration and is replaced on every sync.
          </p>
          <p className="mt-1 text-[12px] text-[var(--muted)]">
            {doc.syncedByName ? `Last synced by ${doc.syncedByName}` : "Last synced"}
            {doc.sourceSyncedAt ? ` on ${formatDateTime(doc.sourceSyncedAt)}` : ""}
            {". "}
            The body is read-only, but comments are not — select any passage to comment on it, or{" "}
            <button
              type="button"
              onClick={() => document.getElementById("kb-comments")?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="text-[var(--accent-light)] underline hover:no-underline"
            >
              add a comment below
            </button>
            . Comments are stored separately, so a sync never overwrites them.
          </p>
          {doc.sourceUrl && (
            <a
              href={doc.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-[var(--accent-light)] hover:underline"
            >
              Open in {providerLabel} <IconArrowRight size={13} />
            </a>
          )}
        </div>
      )}

      {isZyraMemory && (
        <div data-testid="zyra-memory-banner" className="mb-4 rounded-[10px] border border-[var(--ai-border)] bg-[var(--ai-soft)] px-4 py-3">
          <p className="text-[13px] text-[var(--ai-primary)]">
            Managed by Zyra — it reads this memory as context for every response and test-case generation, so it can&apos;t be edited directly.
          </p>
          <p className="mt-1 text-[12px] text-[var(--muted)]">
            {canApprove
              ? "As a project owner or manager, you can correct or remove individual entries below. Every change is kept in View history."
              : "Only project owners and managers can correct or remove entries. You can still comment on it."}
          </p>
        </div>
      )}

      {memoryNeedsReview && (
        <div className="mb-4 rounded-[10px] border border-[var(--ai-border)] bg-[var(--ai-soft)] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] text-[var(--ai-primary)]">{doc.reviewBinding === "legacy_unverified" ? "This document has a legacy approval without an exact review receipt. It is excluded from AI context until an owner or manager reviews it again." : "This is AI-generated memory. Review before it's trusted as context."}</p>
            {canApprove && <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={handleReject} disabled={reviewPending}><IconX size={14} /> Reject</Button>
              <Button size="sm" onClick={handleApprove} disabled={reviewPending}><IconCheck size={14} /> {reviewPending ? "Recording review…" : "Approve"}</Button>
            </div>}
          </div>
          <p className="mt-3 text-[12px] font-medium">Text supplied as AI context</p>
          <pre tabIndex={0} aria-label="Text supplied as AI context" className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded border border-[var(--border)] bg-[var(--surface)] p-3 text-[12px]">{reviewContextText || "No context text."}</pre>
          {saveStatus !== "saved" && <p className="mt-1 text-[12px] text-[var(--muted)]">Includes your pending edits. They must save successfully before this review is recorded.</p>}
        </div>
      )}

      {anchorMissMessage && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-[var(--warning)]/30 bg-[var(--warning-soft)] px-4 py-2.5 text-[13px] text-[var(--warning-foreground)]">
          <span>{anchorMissMessage}</span>
          <button onClick={() => setAnchorMissMessage(null)}><IconX size={15} /></button>
        </div>
      )}

      <div ref={bodyRef} className="relative">
        {selectionBubble && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={captureSelection}
            style={{ top: selectionBubble.top, left: selectionBubble.left }}
            className="absolute z-20 inline-flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface-overlay)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--foreground)] shadow-[var(--shadow-elevated)] hover:bg-[var(--surface-secondary)]"
          >
            <IconMessagePlus size={14} /> Comment
          </button>
        )}
        {isZyraMemory ? (
          <ZyraMemoryEntries
            projectId={projectId}
            documentId={documentId}
            memory={doc.zyraMemory ?? { unstructured: "", entries: [] }}
            canManage={canApprove}
            onUpdated={(updated) => setDoc((prev) => (prev ? { ...prev, ...updated } : updated))}
          />
        ) : (
          <RichTextEditor
            contentJson={doc.contentJson as JSONContent | null}
            contentHtml={doc.contentHtml}
            editable={!isSyncedMirror && restorePhase !== "restoring" && !reviewPending}
            onUpdate={handleEditorUpdate}
            resetKey={contentResetKey}
          />
        )}
      </div>

      <div id="kb-comments">
        <DocumentComments
          projectId={projectId}
          documentId={documentId}
          currentUserId={currentUserId}
          canModerate={canApprove}
          pendingAnchor={pendingAnchor}
          onAnchorConsumed={() => setPendingAnchor(null)}
          onAnchorClick={jumpToAnchor}
        />
      </div>

      <Modal open={historyOpen} onClose={closeHistoryModal} title="Update History">
        {historyModalBody}
      </Modal>
    </div>
  );
}
