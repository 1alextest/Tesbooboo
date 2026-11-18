"use client";

import { useEffect, useState } from "react";
import { useParams } from "@/lib/routeParams";
import {
  archiveModelStudioModel,
  getModelStudioCoverage,
  getModelStudioModel,
  listModelStudioModels,
  type ModelStudioCoverage,
  type ModelStudioDetail,
  type ModelStudioModel,
  type ModelStudioRevision
} from "@/lib/api";
import { ModelDraftGraph } from "../agents/zyra/changes/ModelDraftGraph";
import { formatDate } from "@/lib/date";

/**
 * Read-only inspection of persisted expected-behavior drafts. This is the Phase A consumer: it
 * shows model identity, immutable revisions, the structural graph, and explicit case mappings.
 * It does not create, approve, activate, generate or execute anything; a mapping is not coverage.
 */
/**
 * Staleness is a review cue, not a status change: nothing here rewrites the case, the link or its
 * history. Superseded revisions are reported per revision so the counts cannot be mistaken for a
 * total across revisions (one case may be mapped on more than one older revision).
 */
function MappingStalenessNote({ staleness }: { staleness: ModelStudioCoverage["mappingStaleness"] }) {
  const parts: string[] = [];
  if (staleness.supersededRevisions.length) {
    const revisions = staleness.supersededRevisions
      .map((row) => `rev ${row.revisionNumber} (${row.linkedCases} ${row.linkedCases === 1 ? "case" : "cases"}${row.sameContentAsLatest ? ", same content" : ""})`)
      .join(", ");
    parts.push(`mappings target older model revisions: ${revisions}`);
  }
  if (staleness.testcasesChangedSinceLink) {
    parts.push(
      `${staleness.testcasesChangedSinceLink} ${staleness.testcasesChangedSinceLink === 1 ? "case has" : "cases have"} changed since the mapping was accepted`
    );
  }
  if (staleness.testcasesWithoutRecordedRevision) {
    parts.push(
      `${staleness.testcasesWithoutRecordedRevision} ${staleness.testcasesWithoutRecordedRevision === 1 ? "mapping has" : "mappings have"} no recorded case revision`
    );
  }
  if (staleness.deletedTestcases) {
    parts.push(`${staleness.deletedTestcases} mapped ${staleness.deletedTestcases === 1 ? "case is" : "cases are"} deleted`);
  }
  if (!parts.length) return null;
  return (
    <p role="status" className="mt-2 rounded border border-[var(--warning)] bg-[var(--warning-soft)] p-2 text-[11.5px] text-[var(--warning-foreground)]">
      Review the mapping basis: {parts.join("; ")}. {staleness.note}
    </p>
  );
}

export default function ModelStudioPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [models, setModels] = useState<ModelStudioModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [detail, setDetail] = useState<ModelStudioDetail | null>(null);
  const [revisionId, setRevisionId] = useState("");
  const [coverage, setCoverage] = useState<ModelStudioCoverage | null>(null);
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void listModelStudioModels(projectId)
      .then((rows) => {
        if (!active) return;
        setError(null);
        setModels(rows);
        setSelectedModelId((current) => (rows.some((row) => row.id === current) ? current : rows[0]?.id || ""));
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load models.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [projectId]);

  useEffect(() => {
    if (!selectedModelId) return;
    let active = true;
    void getModelStudioModel(projectId, selectedModelId)
      .then((model) => {
        if (!active) return;
        setError(null);
        setDetail(model);
        setRevisionId(model.revisions[0]?.id ?? "");
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load the model.");
      });
    void getModelStudioCoverage(projectId, selectedModelId)
      .then((value) => {
        if (active) setCoverage(value);
      })
      .catch(() => {
        if (active) setCoverage(null);
      });
    return () => {
      active = false;
    };
  }, [projectId, selectedModelId]);

  // Keyed to the current selection so a previous model's response cannot render under a new one.
  const currentDetail = detail && detail.id === selectedModelId ? detail : null;
  const currentCoverage = coverage && coverage.modelId === selectedModelId ? coverage : null;

  /**
   * Archiving retires the whole model, so it is confirmed and never implicit. Revisions and case
   * mappings stay stored as history; only the list and detail surfaces stop offering the model.
   */
  async function archiveSelectedModel() {
    if (!currentDetail) return;
    const name = currentDetail.name;
    if (
      !window.confirm(
        `Archive "${name}"? It will be removed from Model Studio; its revisions and case mappings remain stored as history.`
      )
    ) {
      return;
    }
    setArchiving(true);
    try {
      await archiveModelStudioModel(projectId, currentDetail.id);
      const remaining = models.filter((model) => model.id !== currentDetail.id);
      setModels(remaining);
      setSelectedModelId(remaining[0]?.id ?? "");
      setDetail(null);
      setCoverage(null);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not archive the model.");
    } finally {
      setArchiving(false);
    }
  }

  const revision: ModelStudioRevision | null =
    currentDetail?.revisions.find((row) => row.id === revisionId) ?? currentDetail?.revisions[0] ?? null;
  const preview = revision?.preview ?? null;

  return (
    <main className="space-y-5 p-5">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Model Studio</h1>
        <p className="text-[12.5px] text-[var(--muted)]">
          Expected behavior, persisted as draft revisions. A model is not approved, execution evidence
          or verified coverage.
        </p>
      </header>

      {error && (
        <p role="alert" className="rounded border border-[var(--border)] bg-[var(--surface-secondary)] p-3 text-[12.5px] text-[var(--error-foreground)]">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-[13px] text-[var(--muted)]">Loading models…</p>
      ) : models.length === 0 ? (
        <section className="rounded border border-[var(--border)] p-4">
          <h2 className="font-medium">No persisted models yet</h2>
          <p className="mt-1 text-[12.5px] text-[var(--muted)]">
            This inspection surface lists models created through the REST/MCP API. Creation and editing
            in the studio are the next increment.
          </p>
        </section>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <nav aria-label="Models" className="space-y-1 rounded border border-[var(--border)] p-2">
            {models.map((model) => (
              <button
                key={model.id}
                type="button"
                onClick={() => setSelectedModelId(model.id)}
                aria-current={model.id === selectedModelId ? "true" : undefined}
                className={`block w-full rounded px-2 py-1.5 text-left text-[12.5px] ${
                  model.id === selectedModelId
                    ? "bg-[var(--brand-soft)] text-[var(--accent-light)]"
                    : "hover:bg-[var(--surface-secondary)]"
                }`}
              >
                <span className="block font-medium">{model.name}</span>
                <span className="block text-[11px] text-[var(--muted)]">
                  rev {model.latestRevision?.revisionNumber ?? "—"} · {model.latestRevision?.status ?? "draft"}
                </span>
              </button>
            ))}
          </nav>

          {currentDetail && revision && (
            <section className="min-w-0 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{currentDetail.name}</h2>
                  <p className="mt-1 text-[12px] text-[var(--muted)]">
                    Expected model · Draft · Not approved · Runtime evidence: none
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void archiveSelectedModel()}
                    disabled={archiving}
                    className="rounded border border-[var(--border)] px-2 py-1 text-[12px] text-[var(--error-foreground)] hover:bg-[var(--surface-secondary)] disabled:opacity-60"
                  >
                    {archiving ? "Archiving…" : "Archive model"}
                  </button>
                  <label className="text-[12px] text-[var(--muted)]">
                    Revision
                    <select
                      value={revision.id}
                      onChange={(event) => setRevisionId(event.target.value)}
                      className="ml-2 rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-[12px] text-[var(--foreground)]"
                    >
                      {currentDetail.revisions.map((row) => (
                        <option key={row.id} value={row.id}>
                          rev {row.revisionNumber} · {row.status}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <dl className="grid gap-2 text-[12px] sm:grid-cols-2">
                <div>
                  <dt className="text-[var(--muted)]">Content hash</dt>
                  <dd className="break-all font-mono">{revision.contentHash}</dd>
                </div>
                <div>
                  <dt className="text-[var(--muted)]">Created</dt>
                  <dd>{formatDate(revision.createdAt)}</dd>
                </div>
              </dl>

              {preview ? (
                <>
                  <ModelDraftGraph preview={preview} />
                  <section aria-label="Model elements" className="grid gap-4 xl:grid-cols-2">
                    <div className="overflow-x-auto rounded border border-[var(--border)]">
                      <table className="w-full text-left text-[12px]">
                        <caption className="p-2 text-left font-medium">States</caption>
                        <thead>
                          <tr>
                            <th className="p-2">ID</th>
                            <th className="p-2">Label</th>
                            <th className="p-2">Reachable</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.states.map((state) => (
                            <tr key={state.id} className="border-t border-[var(--border)]">
                              <td className="p-2 font-mono">{state.id}</td>
                              <td className="p-2">{state.label}</td>
                              <td className="p-2">{state.reachable ? "yes" : "no"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="overflow-x-auto rounded border border-[var(--border)]">
                      <table className="w-full text-left text-[12px]">
                        <caption className="p-2 text-left font-medium">Transitions</caption>
                        <thead>
                          <tr>
                            <th className="p-2">ID</th>
                            <th className="p-2">From → to</th>
                            <th className="p-2">Action</th>
                            <th className="p-2">Expected observation</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.transitions.map((edge) => (
                            <tr key={edge.id} className="border-t border-[var(--border)]">
                              <td className="p-2 font-mono">{edge.id}</td>
                              <td className="p-2 font-mono">
                                {edge.from} → {edge.to}
                              </td>
                              <td className="p-2">{edge.action}</td>
                              <td className="p-2">{edge.expectedObservation}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </>
              ) : (
                <p className="text-[12.5px] text-[var(--muted)]">This revision has no renderable preview.</p>
              )}

              <section aria-label="Case mappings" className="rounded border border-[var(--border)] p-3">
                <h3 className="font-medium">Case mappings</h3>
                <p className="mt-1 text-[11.5px] text-[var(--muted)]">
                  A linked case is an accepted mapping, not execution or verified coverage.
                </p>
                {currentCoverage ? (
                  <>
                    <ul className="mt-2 grid gap-1 text-[12px] sm:grid-cols-2">
                      {currentCoverage.elements.map((element) => (
                        <li key={element.id} className="flex justify-between gap-3 border-b border-[var(--border)] py-1">
                          <span className="font-mono">{element.id}</span>
                          <span>{element.linkedCases} linked</span>
                        </li>
                      ))}
                    </ul>
                    <MappingStalenessNote staleness={currentCoverage.mappingStaleness} />
                  </>
                ) : (
                  <p className="mt-2 text-[12px] text-[var(--muted)]">Coverage is unavailable.</p>
                )}
              </section>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
