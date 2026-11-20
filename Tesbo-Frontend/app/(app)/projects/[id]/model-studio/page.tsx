"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useParams } from "@/lib/routeParams";
import {
  approveModelStudioRevision,
  archiveModelStudioModel,
  createModelStudioCases,
  createModelStudioModel,
  dispatchModelStudioRun,
  generateModelStudioPaths,
  getModelStudioCoverage,
  getModelStudioModel,
  getModelStudioRunProvenance,
  getTestRun,
  getTestCase,
  listCycleExecutions,
  linkModelStudioCase,
  listModelStudioModels,
  listTestRuns,
  MutationOutcomeUnknownError,
  saveModelStudioRevision,
  unlinkModelStudioCase,
  type ModelStudioCoverage,
  type ModelStudioDetail,
  type ModelStudioGeneratedPath,
  type ModelStudioModel,
  type ModelStudioRevision,
  type TestRunListItem
} from "@/lib/api";
import { useAppData } from "@/components/app/AppDataProvider";
import { clearModelRunIntent, modelRunIntentKey, readModelRunIntent, writeModelRunIntent,
  type ModelRunIntent } from "@/components/model-studio/model-run-intent";
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
 * Model Studio: expected behavior, immutable revisions, explicit case mappings, human approval,
 * bounded path proposals, Draft-case generation, and governed dispatch of an approved revision into
 * a native Test Run. A mapping is not execution or verified coverage; a dispatched run's results are
 * case outcomes, reported per element without claiming behavioral conformance.
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
  const { currentUser } = useAppData();
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.id as string;
  // `?model=` deep-links from a governed run's provenance line. When it names a model in this
  // project, that model is selected; otherwise the existing first-model default applies.
  const requestedModelId = searchParams.get("model") ?? "";
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
  const [excludedRunCaseIds, setExcludedRunCaseIds] = useState<string[]>([]);
  const [runName, setRunName] = useState("");
  const [runEnvironment, setRunEnvironment] = useState("");
  const [runBusy, setRunBusy] = useState(false);
  const [runError, setRunErrorState] = useState<{ key: string; message: string } | null>(null);
  const [runNotice, setRunNotice] = useState<{ key: string; text: string; href: string; linkText: string } | null>(null);
  // Match ReviewCaseRunSetup's synchronous guard: React state alone cannot stop two click events
  // before its disabled button renders. The persisted marker also survives reload during POST.
  const runSubmitting = useRef(false);
  const principalId = currentUser?.userId ?? "";
  const runScope = { projectId, modelId: selectedModelId, principalId };
  const runScopeKey = modelRunIntentKey(runScope);
  const visibleRunScope = useRef(runScopeKey);
  const [runRecovery, setRunRecovery] = useState<{ key: string; intent: ModelRunIntent | null; error: string | null }>({ key: "", intent: null, error: null });
  const pendingRunIntent = runRecovery.key === runScopeKey ? runRecovery.intent : null;
  const runRecoveryReady = runRecovery.key === runScopeKey && !runRecovery.error && !!principalId;
  const [runInspection, setRunInspection] = useState<{ intentId: string; runs: TestRunListItem[] } | null>(null);
  const [inspectingRuns, setInspectingRuns] = useState(false);
  const [duplicateAcknowledged, setDuplicateAcknowledged] = useState(false);
  const [reconcilingRunId, setReconcilingRunId] = useState<string | null>(null);

  function setRunError(message: string | null) {
    setRunErrorState((current) => message ? { key: runScopeKey, message }
      : current?.key === runScopeKey ? null : current);
  }

  useEffect(() => {
    const scope = { projectId, modelId: selectedModelId, principalId };
    const key = modelRunIntentKey(scope);
    visibleRunScope.current = key;
    const read = () => {
      try {
        const intent = readModelRunIntent(window.localStorage, scope);
        setRunRecovery({ key, intent, error: null });
      } catch {
        setRunRecovery({ key, intent: null, error: "This browser could not read the saved run request. Inspect native Test Runs and restore site storage before starting another request." });
      }
      setRunInspection(null);
      setDuplicateAcknowledged(false);
    };
    read();
    const changed = (event: StorageEvent) => { if (event.key === key || event.key === null) read(); };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [projectId, selectedModelId, principalId]);

  useEffect(() => {
    let active = true;
    void listModelStudioModels(projectId)
      .then((rows) => {
        if (!active) return;
        setError(null);
        setModels(rows);
        setSelectedModelId((current) => {
          if (requestedModelId && rows.some((row) => row.id === requestedModelId)) return requestedModelId;
          return rows.some((row) => row.id === current) ? current : rows[0]?.id || "";
        });
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
  }, [projectId, reloadToken, requestedModelId]);

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

  /*
   * The cases a governed run may include: those this revision generated and those explicitly linked
   * to it, deduped by case. Status is read live from the repository — a Draft or deleted case is
   * listed with its reason but cannot be selected, and the server refuses it as well.
   */
  const eligibleRunCases = (() => {
    type EligibleRunCase = {
      testcaseId: string;
      title: string;
      status: string | null;
      deleted: boolean;
      sources: string[];
    };
    if (!currentCoverage) return [] as EligibleRunCase[];
    const byId = new Map<string, EligibleRunCase>();
    for (const generatedCase of currentCoverage.generatedCases) {
      byId.set(generatedCase.testcaseId, {
        testcaseId: generatedCase.testcaseId,
        title: generatedCase.testcaseTitle,
        status: generatedCase.testcaseStatus,
        deleted: generatedCase.caseDeleted,
        sources: ["generated"]
      });
    }
    for (const link of currentCoverage.links) {
      const existing = byId.get(link.testcaseId);
      if (existing) {
        if (!existing.sources.includes("linked")) existing.sources.push("linked");
        existing.deleted = existing.deleted || link.caseDeleted;
        existing.status = existing.status ?? link.testcaseStatus;
      } else {
        byId.set(link.testcaseId, {
          testcaseId: link.testcaseId,
          title: link.testcaseTitle,
          status: link.testcaseStatus,
          deleted: link.caseDeleted,
          sources: ["linked"]
        });
      }
    }
    return [...byId.values()];
  })();
  const approvedRunCaseIds = eligibleRunCases
    .filter((entry) => !entry.deleted && entry.status === "Approved")
    .map((entry) => entry.testcaseId);
  const selectedRunCaseIds = approvedRunCaseIds.filter((id) => !excludedRunCaseIds.includes(id));

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

  /*
   * Starts a native Test Run from the approved latest revision. The selection is sent explicitly so
   * the server refuses anything that is not an Approved case of this revision; the created run is an
   * ordinary Test Run, linked back here.
   */
  function clearResolvedRunIntent(intent: ModelRunIntent) {
    try {
      clearModelRunIntent(window.localStorage, intent, intent.id);
      const remaining = readModelRunIntent(window.localStorage, intent);
      setRunRecovery((current) => current.key === modelRunIntentKey(intent) ? { ...current, intent: remaining } : current);
    } catch {
      // The server response remains confirmed even if browser storage fails afterward. Block new
      // creates without relabeling that successful response or known refusal as an unknown write.
      setRunRecovery((current) => current.key === modelRunIntentKey(intent) ? { ...current, intent: null,
        error: "This request has been resolved, but the browser could not clear its saved request. Restore site storage and inspect native Test Runs before starting another request." } : current);
    }
  }

  async function dispatchModelRun() {
    if (!currentDetail || !currentCoverage || !latestRevision) return;
    if (latestRevision.approval.status !== "APPROVED" || !selectedRunCaseIds.length || runBusy ||
        runSubmitting.current || !runRecoveryReady || pendingRunIntent) return;
    runSubmitting.current = true;
    const intent: ModelRunIntent = {
      version: 1, id: crypto.randomUUID(), ...runScope, modelName: currentDetail.name,
      revisionId: latestRevision.id, revisionNumber: latestRevision.revisionNumber,
      contentHash: latestRevision.contentHash, requestedAt: new Date().toISOString(), outcome: "OUTCOME_UNKNOWN",
      request: { caseIds: [...selectedRunCaseIds], ...(runName.trim() ? { name: runName.trim() } : {}),
        ...(runEnvironment.trim() ? { environment: runEnvironment.trim() } : {}) },
    };
    // Persist BEFORE calling the non-idempotent owner. Failed storage means no POST is sent.
    try {
      const existing = readModelRunIntent(window.localStorage, runScope);
      if (existing) {
        setRunRecovery({ key: runScopeKey, intent: existing, error: null });
        runSubmitting.current = false;
        return;
      }
      writeModelRunIntent(window.localStorage, intent);
      setRunRecovery({ key: runScopeKey, intent, error: null });
    } catch {
      setRunError("This browser could not preserve the run request across reload. Enable site storage before starting it. No run request was sent.");
      runSubmitting.current = false;
      return;
    }
    setRunBusy(true);
    setRunError(null);
    setRunNotice(null);
    try {
      const result = await dispatchModelStudioRun(projectId, currentDetail.id, latestRevision.id, intent.request);
      clearResolvedRunIntent(intent);
      // Model navigation stays available during a request. Settle the original intent even after
      // navigation, but never reset the new model's form, errors, selection or inspection state.
      if (visibleRunScope.current !== runScopeKey) return;
      setRunNotice({
        key: runScopeKey,
        text: "Created run",
        href: `/projects/${projectId}/cycles/${result.cycleId}`,
        linkText: result.run.name
      });
      setRunName("");
      setRunEnvironment("");
      setReloadToken((token) => token + 1);
    } catch (cause) {
      if (cause instanceof MutationOutcomeUnknownError) {
        // Keep the marker and exact original request. Inspection is read-only; neither a reload
        // nor a similar name proves that this create failed or authorizes another POST.
        if (visibleRunScope.current === runScopeKey) setRunError(null);
      } else {
        // The shared dispatch adapter returns ordinary errors only for confirmed 4xx refusals.
        // Clear only this request, preserving the form so a stale mapping can be reviewed.
        clearResolvedRunIntent(intent);
        if (visibleRunScope.current === runScopeKey) setRunError(cause instanceof Error ? cause.message : "Could not start the run.");
      }
    } finally {
      runSubmitting.current = false;
      setRunBusy(false);
    }
  }

  async function inspectExistingRuns() {
    if (!pendingRunIntent || inspectingRuns) return;
    setInspectingRuns(true);
    setRunInspection(null);
    setDuplicateAcknowledged(false);
    setRunError(null);
    try {
      const runs = await listTestRuns(projectId);
      if (visibleRunScope.current === runScopeKey) setRunInspection({ intentId: pendingRunIntent.id, runs });
    } catch (cause) {
      if (visibleRunScope.current === runScopeKey) setRunError(cause instanceof Error ? cause.message : "Could not inspect native runs. The outcome is still unknown.");
    } finally { setInspectingRuns(false); }
  }

  async function selectInspectedRun(cycleId: string) {
    if (!pendingRunIntent || runInspection?.intentId !== pendingRunIntent.id || reconcilingRunId) return;
    setReconcilingRunId(cycleId);
    setRunError(null);
    try {
      // A person identifies the candidate. Independently read the native owner and its immutable
      // model basis; matching a title alone is never reconciliation or inferred attachment.
      const [run, provenance, executions] = await Promise.all([
        getTestRun(cycleId), getModelStudioRunProvenance(projectId, cycleId), listCycleExecutions(cycleId),
      ]);
      const actualCases = [...new Set(executions.map((entry) => entry.testcaseId))].sort();
      if (run.projectId !== projectId || provenance?.modelId !== pendingRunIntent.modelId ||
          provenance.modelRevisionId !== pendingRunIntent.revisionId || provenance.contentHash !== pendingRunIntent.contentHash ||
          JSON.stringify(actualCases) !== JSON.stringify([...pendingRunIntent.request.caseIds].sort()) ||
          (pendingRunIntent.request.name !== undefined && run.name !== pendingRunIntent.request.name) ||
          (run.environment ?? "") !== (pendingRunIntent.request.environment ?? "")) {
        throw new Error("This native run does not match the saved model revision, cases and request context. The request outcome remains unknown.");
      }
      clearResolvedRunIntent(pendingRunIntent);
      if (visibleRunScope.current !== runScopeKey) return;
      setRunNotice({ key: runScopeKey, text: "Using the native run you identified; its model basis and cases were read back.",
        href: `/projects/${projectId}/cycles/${cycleId}`, linkText: run.name });
      setRunInspection(null);
      setDuplicateAcknowledged(false);
      setReloadToken((token) => token + 1);
    } catch (cause) {
      if (visibleRunScope.current === runScopeKey) setRunError(cause instanceof Error ? cause.message : "Could not verify the selected native run. The request outcome remains unknown.");
    } finally { setReconcilingRunId(null); }
  }

  function allowSeparateRunRequest() {
    if (!pendingRunIntent || runInspection?.intentId !== pendingRunIntent.id || !duplicateAcknowledged || runBusy) return;
    try {
      clearModelRunIntent(window.localStorage, runScope, pendingRunIntent.id);
      setRunName(pendingRunIntent.request.name ?? "");
      setRunEnvironment(pendingRunIntent.request.environment ?? "");
      setExcludedRunCaseIds(approvedRunCaseIds.filter((id) => !pendingRunIntent.request.caseIds.includes(id)));
      setRunRecovery((current) => current.key === runScopeKey && current.intent?.id === pendingRunIntent.id ? { ...current, intent: null } : current);
      setRunInspection(null);
      setDuplicateAcknowledged(false);
      setRunNotice({ key: runScopeKey, text: "The previous request remains unconfirmed. Starting now creates a separate request and may duplicate that run.",
        href: `/projects/${projectId}/cycles`, linkText: "Native Test Runs" });
      setRunError(null);
    } catch { setRunError("The saved request could not be released. No new request was sent."); }
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
                onClick={() => {
                  visibleRunScope.current = modelRunIntentKey({ ...runScope, modelId: model.id });
                  setSelectedModelId(model.id);
                }}
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
                    Expected model · {revision.status} ·{" "}
                    {revision.approval.status === "APPROVED" ? "Approved" : "Not approved"} · Runtime evidence:{" "}
                    {currentCoverage?.executionAssertion === "governed-runs" ? "governed runs" : "none"}
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

              <section aria-label="Model runs" className="rounded border border-[var(--border)] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-medium">Model runs</h3>
                  {currentCoverage && (
                    <span className="text-[11.5px] text-[var(--muted)]">
                      {currentCoverage.executionAssertion === "governed-runs"
                        ? "Runtime evidence: governed runs"
                        : "Runtime evidence: none"}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11.5px] text-[var(--muted)]">
                  A run starts only from the model&apos;s current, approved revision, and only with Approved
                  cases that belong to it. Results are case outcomes — not proof that the modeled behavior
                  is correct.
                </p>
                {pendingRunIntent && !runBusy && (
                  <section aria-label="Run request recovery" data-outcome="OUTCOME_UNKNOWN"
                    className="mt-3 space-y-2 rounded border border-[var(--warning)] bg-[var(--warning-soft)] p-3 text-[12px]">
                    <p role="alert">
                      <strong>Run creation outcome unknown.</strong> The request may already have committed.
                      Starting another run is blocked until you inspect native Test Runs. A matching name is
                      only a candidate, not proof that it came from this request.
                    </p>
                    <p>
                      Requested {formatDate(pendingRunIntent.requestedAt)}: {pendingRunIntent.modelName}, revision {pendingRunIntent.revisionNumber};{" "}
                      {pendingRunIntent.request.caseIds.length} case{pendingRunIntent.request.caseIds.length === 1 ? "" : "s"}.
                    </p>
                    <p>Run name: <strong>{pendingRunIntent.request.name ?? "Default from the model and revision"}</strong>.{" "}
                      Environment: {pendingRunIntent.request.environment || "Not specified"}.</p>
                    <details>
                      <summary className="cursor-pointer">Saved request details</summary>
                      <p className="break-all">Model revision: {pendingRunIntent.revisionId}. Content: {pendingRunIntent.contentHash}.</p>
                      <p className="break-all">Request reference: {pendingRunIntent.id}. This browser reference is not a server receipt.</p>
                      <ul aria-label="Requested case identifiers">{pendingRunIntent.request.caseIds.map((id) => <li key={id}>{id}</li>)}</ul>
                    </details>
                    <div className="flex flex-wrap items-center gap-3">
                      <button type="button" onClick={() => void inspectExistingRuns()} disabled={inspectingRuns || !!reconcilingRunId}
                        className="rounded border border-[var(--border)] px-2 py-1 disabled:opacity-60">
                        {inspectingRuns ? "Inspecting runs…" : "Inspect existing runs"}
                      </button>
                      <Link href={`/projects/${projectId}/cycles`} target="_blank" rel="noopener noreferrer" className="underline">Open native Test Runs</Link>
                    </div>
                    {runInspection?.intentId === pendingRunIntent.id && (
                      <div className="space-y-2">
                        <p>Native run readback completed. Inspect a candidate and identify it explicitly; this list alone does not settle the request.</p>
                        {runInspection.runs.length ? (
                          <ul aria-label="Native runs to inspect" className="space-y-2">
                            {[...runInspection.runs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20).map((run) => (
                              <li key={run.id} className="flex flex-wrap items-center gap-2">
                                <Link href={`/projects/${projectId}/cycles/${run.id}`} target="_blank" rel="noopener noreferrer" className="underline">{run.name}</Link>
                                <span>{run.externalId} · {formatDate(run.createdAt)} · {run.totalCases} cases · {run.environment || "No environment"}</span>
                                <button type="button" disabled={!!reconcilingRunId} onClick={() => void selectInspectedRun(run.id)}
                                  aria-label={`Use inspected run ${run.name}`} className="rounded border border-[var(--border)] px-2 py-1 disabled:opacity-60">
                                  {reconcilingRunId === run.id ? "Checking run…" : "I identified this run"}
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : <p>No native runs were returned. A delayed request may still commit; this is not proof of failure.</p>}
                        {runInspection.runs.length > 20 && <p>Showing the latest 20 of {runInspection.runs.length} runs. Inspect the full native Test Runs list as well.</p>}
                        <label className="flex items-start gap-2">
                          <input type="checkbox" checked={duplicateAcknowledged}
                            onChange={(event) => setDuplicateAcknowledged(event.target.checked)} disabled={!!reconcilingRunId} />
                          I inspected native runs and understand a separate new request may create a duplicate.
                        </label>
                        <button type="button" disabled={!duplicateAcknowledged || !!reconcilingRunId}
                          onClick={allowSeparateRunRequest} className="rounded border border-[var(--border)] px-2 py-1 disabled:opacity-60">
                          Allow a separate new request
                        </button>
                      </div>
                    )}
                  </section>
                )}
                {runRecovery.key === runScopeKey && runRecovery.error && (
                  <p role="alert" className="mt-2 text-[12px] text-[var(--error-foreground)]">{runRecovery.error}{" "}
                    <Link href={`/projects/${projectId}/cycles`} className="underline">Open native Test Runs</Link>
                  </p>
                )}
                {!latestRevision ? (
                  <p className="mt-2 text-[12px] text-[var(--muted)]">This model has no revision to run.</p>
                ) : latestRevision.approval.status !== "APPROVED" ? (
                  <p className="mt-2 text-[12px] text-[var(--muted)]">
                    Approve revision {latestRevision.revisionNumber} to run it.
                  </p>
                ) : (
                  <>
                    {eligibleRunCases.length === 0 ? (
                      <p className="mt-2 text-[12px] text-[var(--muted)]">
                        No cases belong to this revision yet. Generate cases from its proposals or link
                        existing cases.
                      </p>
                    ) : (
                      <ul aria-label="Eligible model cases" className="mt-2 space-y-1 text-[12px]">
                        {eligibleRunCases.map((entry) => {
                          const selectable = !entry.deleted && entry.status === "Approved";
                          const checked = pendingRunIntent ? pendingRunIntent.request.caseIds.includes(entry.testcaseId)
                            : selectable && !excludedRunCaseIds.includes(entry.testcaseId);
                          return (
                            <li
                              key={entry.testcaseId}
                              className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] py-1"
                            >
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  aria-label={`Include ${entry.title}`}
                                  disabled={!selectable || runBusy || !!pendingRunIntent || !runRecoveryReady}
                                  checked={checked}
                                  onChange={(event) =>
                                    setExcludedRunCaseIds((current) =>
                                      event.target.checked
                                        ? current.filter((id) => id !== entry.testcaseId)
                                        : [...current, entry.testcaseId]
                                    )
                                  }
                                />
                                <Link
                                  href={`/projects/${projectId}/testcases/${entry.testcaseId}`}
                                  className="text-[var(--accent-light)] hover:underline"
                                >
                                  {entry.title}
                                </Link>
                              </label>
                              <span className="text-[11px] text-[var(--muted)]">
                                {entry.deleted ? "deleted" : (entry.status ?? "unknown")} ·{" "}
                                {entry.sources.join(" + ")}
                                {!selectable && !entry.deleted ? " · approve it to include it" : ""}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <label className="text-[12px] text-[var(--muted)]">
                        Run name (optional)
                        <input
                          value={pendingRunIntent ? pendingRunIntent.request.name ?? "" : runName}
                          disabled={runBusy || !!pendingRunIntent || !runRecoveryReady}
                          onChange={(event) => setRunName(event.target.value)}
                          placeholder="Defaults to the model and revision"
                          className="mt-1 block w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-[12px] text-[var(--foreground)]"
                        />
                      </label>
                      <label className="text-[12px] text-[var(--muted)]">
                        Environment (optional)
                        <input
                          value={pendingRunIntent ? pendingRunIntent.request.environment ?? "" : runEnvironment}
                          disabled={runBusy || !!pendingRunIntent || !runRecoveryReady}
                          onChange={(event) => setRunEnvironment(event.target.value)}
                          className="mt-1 block w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-[12px] text-[var(--foreground)]"
                        />
                      </label>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => void dispatchModelRun()}
                        disabled={runBusy || !selectedRunCaseIds.length || !!pendingRunIntent || !runRecoveryReady}
                        className="rounded border border-[var(--border)] px-2 py-1 text-[12px] hover:bg-[var(--surface-secondary)] disabled:opacity-60"
                      >
                        {runBusy
                          ? "Starting…"
                          : `Start run with ${selectedRunCaseIds.length} case${selectedRunCaseIds.length === 1 ? "" : "s"}`}
                      </button>
                      {!selectedRunCaseIds.length && eligibleRunCases.length > 0 && (
                        <span className="text-[11.5px] text-[var(--muted)]">
                          Select at least one Approved case.
                        </span>
                      )}
                    </div>
                  </>
                )}
                {runError?.key === runScopeKey && <p role="alert" className="mt-2 text-[12px] text-[var(--error-foreground)]">{runError.message}</p>}
                {runNotice?.key === runScopeKey && (
                  <p role="status" className="mt-2 rounded border border-[var(--border)] bg-[var(--surface-secondary)] p-2 text-[12px]">
                    {runNotice.text}{" "}<Link href={runNotice.href} className="text-[var(--accent-light)] hover:underline">{runNotice.linkText}</Link>
                  </p>
                )}
                {currentCoverage && currentCoverage.governedRuns.length > 0 && (
                  <div className="mt-3">
                    <h4 className="text-[12px] font-semibold">Governed runs</h4>
                    <ul className="mt-1 space-y-1 text-[12px]">
                      {currentCoverage.governedRuns.map((run) => (
                        <li
                          key={run.id}
                          className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] py-1"
                        >
                          <Link
                            href={`/projects/${projectId}/cycles/${run.cycleId}`}
                            className="text-[var(--accent-light)] hover:underline"
                          >
                            {run.name}
                          </Link>
                          <span className="text-[11px] text-[var(--muted)]">
                            {formatDate(run.createdAt)} · {run.caseCount} case{run.caseCount === 1 ? "" : "s"}
                            {run.runDeleted ? " · run deleted" : ""}
                            {Object.keys(run.statusCounts).length > 0 &&
                              ` · ${Object.entries(run.statusCounts)
                                .map(([status, count]) => `${status} ${count}`)
                                .join(", ")}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {currentCoverage && currentCoverage.observedByElement.length > 0 && (
                  <div className="mt-3">
                    <h4 className="text-[12px] font-semibold">Observed results by element</h4>
                    <ul aria-label="Observed results by element" className="mt-1 space-y-1 text-[12px]">
                      {currentCoverage.observedByElement.map((entry) => (
                        <li
                          key={entry.elementId}
                          className="flex items-center justify-between gap-3 border-b border-[var(--border)] py-1"
                        >
                          <span className="font-mono">{entry.elementId}</span>
                          <span className="text-[11px] text-[var(--muted)]">
                            {Object.entries(entry.statusCounts)
                              .map(([status, count]) => `${status} ${count}`)
                              .join(", ")}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-1 text-[11px] text-[var(--muted)]">
                      Case outcomes from governed runs, grouped by model element. Not behavioral coverage or
                      verification.
                    </p>
                  </div>
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
