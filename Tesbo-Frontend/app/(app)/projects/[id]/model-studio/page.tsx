"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "@/lib/routeParams";
import {
  approveModelStudioRevision,
  archiveModelStudioModel,
  createModelStudioCases,
  createModelStudioModel,
  generateModelStudioPaths,
  getModelStudioCoverage,
  getModelStudioModel,
  getTestCase,
  linkModelStudioCase,
  listModelStudioModels,
  saveModelStudioRevision,
  unlinkModelStudioCase,
  type ModelStudioCoverage,
  type ModelStudioDetail,
  type ModelStudioGeneratedPath,
  type ModelStudioModel,
  type ModelStudioRevision
} from "@/lib/api";
import { ModelDraftGraph } from "../agents/zyra/changes/ModelDraftGraph";
import {
  EMPTY_MODEL,
  LinkCaseModal,
  ModelDefinitionModal,
  modelElements,
  toModelDefinition,
  type ModelDefinition
} from "@/components/model-studio/ModelStudioAuthoring";
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
  // Bumped after any write so the model list, detail and coverage re-read together.
  const [reloadToken, setReloadToken] = useState(0);
  const [definitionModal, setDefinitionModal] = useState<"create" | "revision" | null>(null);
  const [authorBusy, setAuthorBusy] = useState(false);
  const [authorError, setAuthorError] = useState<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [mappingBusy, setMappingBusy] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [proposals, setProposals] = useState<ModelStudioGeneratedPath[]>([]);
  const [proposalsBusy, setProposalsBusy] = useState(false);
  const [proposalsError, setProposalsError] = useState<string | null>(null);
  const [selectedDigests, setSelectedDigests] = useState<string[]>([]);
  const [casesBusy, setCasesBusy] = useState(false);
  const [casesNotice, setCasesNotice] = useState<string | null>(null);

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
  }, [projectId, reloadToken]);

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
  }, [projectId, selectedModelId, reloadToken]);

  // Keyed to the current selection so a previous model's response cannot render under a new one.
  const currentDetail = detail && detail.id === selectedModelId ? detail : null;
  const currentCoverage = coverage && coverage.modelId === selectedModelId ? coverage : null;
  // Mappings are stored per immutable revision; the coverage read and every authoring action below
  // target the current head, so the latest revision is what "Link case" is relative to.
  const latestRevision = currentDetail?.revisions[0] ?? null;
  const latestDefinition = latestRevision?.content ? toModelDefinition(latestRevision.content) : null;

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

  async function createModel({ name, definition }: { name: string; definition: ModelDefinition }) {
    setAuthorBusy(true);
    setAuthorError(null);
    try {
      const created = await createModelStudioModel(projectId, { name, model: definition });
      setDefinitionModal(null);
      setReloadToken((token) => token + 1);
      setSelectedModelId(created.id);
    } catch (cause) {
      setAuthorError(cause instanceof Error ? cause.message : "Could not create the model.");
    } finally {
      setAuthorBusy(false);
    }
  }

  async function saveRevision({ definition }: { name: string; definition: ModelDefinition }) {
    if (!currentDetail || !latestRevision) return;
    setAuthorBusy(true);
    setAuthorError(null);
    try {
      await saveModelStudioRevision(projectId, currentDetail.id, {
        baseRevisionId: latestRevision.id,
        model: definition
      });
      setDefinitionModal(null);
      setReloadToken((token) => token + 1);
    } catch (cause) {
      // A STALE_BASE refusal means another edit landed first; keep the draft open and say so.
      setAuthorError(cause instanceof Error ? cause.message : "Could not save the revision.");
    } finally {
      setAuthorBusy(false);
    }
  }

  async function linkCase({ testcaseId, elementIds }: { testcaseId: string; elementIds: string[] }) {
    if (!currentDetail || !latestRevision) return;
    setLinkBusy(true);
    setLinkError(null);
    try {
      // Record the case revision the mapping was accepted against, so a later edit is visible as
      // changed-since-link rather than silently treated as current.
      const testcase = await getTestCase(projectId, testcaseId);
      const testcaseRevision = typeof testcase.editRevision === "string" ? testcase.editRevision : undefined;
      await linkModelStudioCase(projectId, currentDetail.id, latestRevision.id, {
        testcaseId,
        elementIds,
        testcaseRevision
      });
      setLinkOpen(false);
      setReloadToken((token) => token + 1);
    } catch (cause) {
      setLinkError(cause instanceof Error ? cause.message : "Could not link the case.");
    } finally {
      setLinkBusy(false);
    }
  }

  async function unlinkCase(linkId: string) {
    if (!currentDetail || !currentCoverage) return;
    setMappingBusy(linkId);
    try {
      await unlinkModelStudioCase(projectId, currentDetail.id, currentCoverage.revisionId, linkId);
      setReloadToken((token) => token + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not remove the mapping.");
    } finally {
      setMappingBusy(null);
    }
  }

  async function approveRevision() {
    if (!currentDetail || !latestRevision) return;
    const confirmed = window.confirm(
      `Approve revision ${latestRevision.revisionNumber} (content ${latestRevision.contentHash.slice(0, 12)}…)? ` +
        "Approval is a human decision; it is not execution evidence."
    );
    if (!confirmed) return;
    setApproving(true);
    try {
      await approveModelStudioRevision(projectId, currentDetail.id, latestRevision.id, latestRevision.contentHash);
      setReloadToken((token) => token + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not approve the revision.");
    } finally {
      setApproving(false);
    }
  }

  async function generateProposals() {
    if (!currentDetail || !latestRevision) return;
    setProposalsBusy(true);
    setProposalsError(null);
    setCasesNotice(null);
    try {
      const result = await generateModelStudioPaths(projectId, currentDetail.id, latestRevision.id, {
        strategy: "edge_coverage",
        maxPaths: 20,
        maxDepth: 12
      });
      setProposals(result.paths);
      setSelectedDigests([]);
    } catch (cause) {
      setProposalsError(cause instanceof Error ? cause.message : "Could not generate proposals.");
    } finally {
      setProposalsBusy(false);
    }
  }

  async function createCasesFromProposals() {
    if (!currentDetail || !latestRevision || !selectedDigests.length) return;
    setCasesBusy(true);
    setProposalsError(null);
    try {
      // The same generation inputs are sent again: the server regenerates the proposals and accepts
      // only their digests, so a fabricated path cannot become a case.
      const result = await createModelStudioCases(projectId, currentDetail.id, latestRevision.id, {
        digests: selectedDigests,
        strategy: "edge_coverage",
        maxPaths: 20,
        maxDepth: 12
      });
      setCasesNotice(
        `Created ${result.created} draft case${result.created === 1 ? "" : "s"}` +
          (result.skipped ? `; ${result.skipped} already existed` : "") +
          "."
      );
      setSelectedDigests([]);
      setReloadToken((token) => token + 1);
    } catch (cause) {
      setProposalsError(cause instanceof Error ? cause.message : "Could not create draft cases.");
    } finally {
      setCasesBusy(false);
    }
  }

  const revision: ModelStudioRevision | null =
    currentDetail?.revisions.find((row) => row.id === revisionId) ?? currentDetail?.revisions[0] ?? null;
  const preview = revision?.preview ?? null;

  return (
    <main className="space-y-5 p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Model Studio</h1>
          <p className="text-[12.5px] text-[var(--muted)]">
            Expected behavior, persisted as draft revisions. A model is not approved, execution evidence
            or verified coverage.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setAuthorError(null);
            setDefinitionModal("create");
          }}
          className="rounded border border-[var(--border)] px-3 py-1.5 text-[12.5px] hover:bg-[var(--surface-secondary)]"
        >
          New model
        </button>
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
            Describe the expected behavior as states and transitions. Saving creates draft revision 1;
            it is not approved, coverage or runtime evidence.
          </p>
          <button
            type="button"
            onClick={() => {
              setAuthorError(null);
              setDefinitionModal("create");
            }}
            className="mt-3 rounded border border-[var(--border)] px-3 py-1.5 text-[12.5px] hover:bg-[var(--surface-secondary)]"
          >
            Create the first model
          </button>
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
                  {latestRevision &&
                    (latestRevision.approval.status === "APPROVED" ? (
                      <span className="text-[11.5px] text-[var(--muted)]">
                        Approved rev {latestRevision.revisionNumber}
                        {latestRevision.approval.approvedAt ? ` · ${formatDate(latestRevision.approval.approvedAt)}` : ""}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void approveRevision()}
                        disabled={approving}
                        className="rounded border border-[var(--border)] px-2 py-1 text-[12px] hover:bg-[var(--surface-secondary)] disabled:opacity-60"
                      >
                        {approving ? "Approving…" : `Approve revision ${latestRevision.revisionNumber}`}
                      </button>
                    ))}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthorError(null);
                      setDefinitionModal("revision");
                    }}
                    disabled={!latestRevision || !latestDefinition}
                    className="rounded border border-[var(--border)] px-2 py-1 text-[12px] hover:bg-[var(--surface-secondary)] disabled:opacity-60"
                  >
                    New revision
                  </button>
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

              {latestRevision && (
                <section aria-label="Path proposals" className="rounded border border-[var(--border)] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-medium">Path proposals</h3>
                    <button
                      type="button"
                      onClick={() => void generateProposals()}
                      disabled={proposalsBusy}
                      className="rounded border border-[var(--border)] px-2 py-1 text-[12px] hover:bg-[var(--surface-secondary)] disabled:opacity-60"
                    >
                      {proposalsBusy ? "Generating…" : "Generate paths"}
                    </button>
                  </div>
                  <p className="mt-1 text-[11.5px] text-[var(--muted)]">
                    Bounded proposals over the latest revision. They are not tests, coverage or execution
                    evidence; only an approved revision can turn them into Draft cases.
                  </p>
                  {proposalsError && (
                    <p role="alert" className="mt-2 text-[12px] text-[var(--error-foreground)]">
                      {proposalsError}
                    </p>
                  )}
                  {proposals.length > 0 && (
                    <>
                      <ul className="mt-2 space-y-1 text-[12px]">
                        {proposals.map((path) => (
                          <li key={path.digest} className="flex flex-wrap items-center gap-2">
                            <input
                              type="checkbox"
                              aria-label={`Select path ${path.digest.slice(0, 10)}`}
                              checked={selectedDigests.includes(path.digest)}
                              onChange={(event) =>
                                setSelectedDigests((current) =>
                                  event.target.checked
                                    ? [...current, path.digest]
                                    : current.filter((digest) => digest !== path.digest)
                                )
                              }
                            />
                            <span className="font-mono text-[11px] text-[var(--muted)]">
                              {path.digest.slice(0, 10)}
                            </span>
                            <span>{path.transitionIds.join(" → ")}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => void createCasesFromProposals()}
                          disabled={
                            casesBusy || !selectedDigests.length || latestRevision.approval.status !== "APPROVED"
                          }
                          className="rounded border border-[var(--border)] px-2 py-1 text-[12px] hover:bg-[var(--surface-secondary)] disabled:opacity-60"
                        >
                          {casesBusy ? "Creating…" : "Create draft cases"}
                        </button>
                        {latestRevision.approval.status !== "APPROVED" && (
                          <span className="text-[11.5px] text-[var(--muted)]">
                            Approve the latest revision to create draft cases from these proposals.
                          </span>
                        )}
                      </div>
                    </>
                  )}
                  {casesNotice && (
                    <p role="status" className="mt-2 rounded border border-[var(--border)] bg-[var(--surface-secondary)] p-2 text-[12px]">
                      {casesNotice}
                    </p>
                  )}
                  {currentCoverage && currentCoverage.generatedCases.length > 0 && (
                    <div className="mt-3">
                      <h4 className="text-[12px] font-semibold">Generated cases</h4>
                      <ul className="mt-1 space-y-1 text-[12px]">
                        {currentCoverage.generatedCases.map((generatedCase) => (
                          <li
                            key={generatedCase.testcaseId}
                            className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] py-1"
                          >
                            <Link
                              href={`/projects/${projectId}/testcases/${generatedCase.testcaseId}`}
                              className="text-[var(--accent-light)] hover:underline"
                            >
                              {generatedCase.testcaseTitle}
                            </Link>
                            <span className="text-[11px] text-[var(--muted)]">
                              {generatedCase.testcaseStatus ?? "deleted"}
                              {generatedCase.caseDeleted ? " · deleted" : ""} · path{" "}
                              {generatedCase.pathDigest.slice(0, 10)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              )}

              <section aria-label="Case mappings" className="rounded border border-[var(--border)] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-medium">Case mappings</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setLinkError(null);
                      setLinkOpen(true);
                    }}
                    disabled={!latestRevision || !latestDefinition}
                    className="rounded border border-[var(--border)] px-2 py-1 text-[12px] hover:bg-[var(--surface-secondary)] disabled:opacity-60"
                  >
                    Link case
                  </button>
                </div>
                <p className="mt-1 text-[11.5px] text-[var(--muted)]">
                  A linked case is an accepted mapping, not execution or verified coverage. Mappings are
                  stored per revision; this list is the latest revision&apos;s.
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
                    {currentCoverage.links.length > 0 && (
                      <ul aria-label="Linked cases" className="mt-3 space-y-1 text-[12px]">
                        {currentCoverage.links.map((link) => (
                          <li
                            key={link.id}
                            className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] py-1"
                          >
                            <span>
                              {link.testcaseTitle}
                              <span className="ml-2 font-mono text-[11px] text-[var(--muted)]">
                                {link.elementIds.join(", ")}
                              </span>
                              {link.caseDeleted && (
                                <span className="ml-2 text-[var(--warning-foreground)]">deleted case</span>
                              )}
                              {link.caseChangedSinceLink && (
                                <span className="ml-2 text-[var(--warning-foreground)]">changed since linked</span>
                              )}
                            </span>
                            <button
                              type="button"
                              onClick={() => void unlinkCase(link.id)}
                              disabled={mappingBusy === link.id}
                              className="rounded border border-[var(--border)] px-2 py-0.5 text-[11.5px] hover:bg-[var(--surface-secondary)] disabled:opacity-60"
                            >
                              {mappingBusy === link.id ? "Removing…" : "Unlink"}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {currentCoverage.caseEvidence.length > 0 && (
                      <div className="mt-3">
                        <h4 className="text-[12px] font-semibold">Observed case results</h4>
                        <ul className="mt-1 space-y-1 text-[12px]">
                          {currentCoverage.caseEvidence.map((evidence) => (
                            <li
                              key={evidence.testcaseId}
                              className="flex flex-wrap justify-between gap-2 border-b border-[var(--border)] py-1"
                            >
                              <span>{evidence.testcaseTitle}</span>
                              <span>
                                {evidence.latestStatus ?? "never run"}
                                {Object.keys(evidence.statusCounts).length > 0 &&
                                  ` · ${Object.entries(evidence.statusCounts)
                                    .map(([status, count]) => `${status} ${count}`)
                                    .join(", ")}`}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <p className="mt-1 text-[11px] text-[var(--muted)]">{currentCoverage.evidenceNote}</p>
                      </div>
                    )}
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

      {definitionModal && (
        <ModelDefinitionModal
          mode={definitionModal}
          initialName={definitionModal === "revision" ? currentDetail?.name : ""}
          initial={(definitionModal === "revision" ? latestDefinition : null) ?? EMPTY_MODEL}
          baseRevisionNumber={latestRevision?.revisionNumber}
          busy={authorBusy}
          error={authorError}
          onClose={() => {
            if (!authorBusy) setDefinitionModal(null);
          }}
          onSave={(value) => {
            void (definitionModal === "create" ? createModel(value) : saveRevision(value));
          }}
        />
      )}

      {linkOpen && latestDefinition && (
        <LinkCaseModal
          projectId={projectId}
          elements={modelElements(latestDefinition)}
          busy={linkBusy}
          error={linkError}
          onClose={() => {
            if (!linkBusy) setLinkOpen(false);
          }}
          onLink={(value) => {
            void linkCase(value);
          }}
        />
      )}
    </main>
  );
}
