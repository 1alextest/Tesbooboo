"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { listNativeRetests, type NativeRetestManifest } from "@/lib/api";
import { formatDate } from "@/lib/date";
import { Button } from "@/components/ui";

/** Shared by the native Run drawer and full execution page; never substitutes for a new result. */
export function RetestSourceObservation({ manifest, executionId }: { manifest: NativeRetestManifest; executionId: string }) {
  const source = manifest.occurrences.find(item => item.executionId === executionId);
  if (!source) return null;
  const status = String(source.sourceResult.status || "Unknown");
  const actual = String(source.sourceResult.actual_result || "");
  const href = `/projects/${manifest.projectId}/cycles/${manifest.sourceCycleId}/execute/${source.sourceExecutionId}`;
  return (
    <section data-testid="retest-source-observation" aria-label="Source observation" className="rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] p-3 text-[13px]">
      <p className="font-medium text-[var(--foreground)]">Source result when this retest was created</p>
      <p className="mt-1 text-[var(--muted)]">
        <Link href={href} className="text-[var(--accent-light)] hover:underline">{manifest.sourceRun.name} — {source.sourceTitle || source.sourceExternalId}</Link>
        {" · "}{status}{" · captured "}{formatDate(manifest.createdAt)}
      </p>
      {actual && <p className="mt-2 whitespace-pre-wrap break-words text-[var(--foreground)]">{actual}</p>}
      <p className="mt-2 text-[12px] text-[var(--muted)]">
        {source.sourceEvidence.length} prior evidence file{source.sourceEvidence.length === 1 ? "" : "s"}
        {" · "}{source.sourceBugLinks.length} prior defect link{source.sourceBugLinks.length === 1 ? "" : "s"}
        {". Open the source observation to inspect its evidence and current availability."}
      </p>
      {source.sourceDefinitionBasis !== "reviewed_snapshot" && <p className="mt-1 text-[12px] text-[var(--muted)]">The source snapshot has no verified approval identity.</p>}
    </section>
  );
}

export function RetestRunOrigin({ manifest }: { manifest: NativeRetestManifest }) {
  return (
    <p data-testid="run-retest-origin" className="mt-2 text-[12px] text-[var(--muted)]">
      Retest of{" "}<Link href={`/projects/${manifest.projectId}/cycles/${manifest.sourceCycleId}`} className="text-[var(--accent-light)] hover:underline">{manifest.sourceRun.name}</Link>
      {" · "}{manifest.occurrences.length} originally selected case{manifest.occurrences.length === 1 ? "" : "s"}
      {" · later additions are outside this retest selection"}
    </p>
  );
}

/** A failed lineage read stays unavailable; it never becomes an empty list. */
export function RetestRunChildren({ projectId, cycleId, userId }: { projectId: string; cycleId: string; userId: string }) {
  const [children, setChildren] = useState<Awaited<ReturnType<typeof listNativeRetests>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const scope = `${userId}:${projectId}:${cycleId}`;
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      const value = await listNativeRetests(cycleId);
      if (currentScope.current === scope && request === generation.current) setChildren(value);
    } catch (failure) {
      if (currentScope.current === scope && request === generation.current) setError(failure instanceof Error ? failure.message : "Retests could not be loaded.");
    } finally {
      if (currentScope.current === scope && request === generation.current) setLoading(false);
    }
  }, [cycleId, scope]);
  useEffect(() => {
    setChildren(null);
    void load();
    return () => { generation.current += 1; };
  }, [load]);
  return <section aria-label="Retests of this Run" data-testid="run-retests" className="mt-2 text-[12px]">
    {loading && <p role="status" className="text-[var(--muted)]">Loading retests…</p>}
    {error && <div className="flex flex-wrap items-center gap-2"><p role="alert" className="text-[var(--error-foreground)]">Retests are unavailable. {error}</p><Button variant="secondary" onClick={() => void load()}>Retry retests</Button></div>}
    {!loading && !error && children?.length === 0 && <p className="text-[var(--muted)]">No retests recorded for this Run.</p>}
    {children && children.length > 0 && <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="font-medium">Retests{error || loading ? " (last loaded)" : ""}:</span>
      {children.map(child => <Link key={child.id} className="text-[var(--accent-light)] hover:underline" href={`/projects/${projectId}/cycles/${child.id}`}>
        {child.name}{" · "}{child.status}
      </Link>)}
    </div>}
  </section>;
}
