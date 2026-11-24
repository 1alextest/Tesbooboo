import type { ZyraTask } from "@/lib/api";

type Pin = NonNullable<NonNullable<ZyraTask["skillContext"]>["assignments"]>[number];
type Criterion = { key: string; text: string; normative?: boolean };
type Selection = {
  linkId: string; requirementVersionId: string; testcaseId: string;
  testcaseRevision: string; testcaseApprovalRevision: string; criterionKeys: string[];
  originatingApprovedVersionId?: string; originatingLinkSkill?: Partial<Pin>;
  sourceTestcaseRevision?: string; sourceTestcaseApprovalRevision?: string | null;
  originatingCriteria?: Criterion[]; proposedCriteria?: Criterion[];
};

const isSelection = (value: unknown): value is Selection => {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<Selection>;
  return typeof item.linkId === "string" && typeof item.testcaseId === "string"
    && Array.isArray(item.criterionKeys);
};

function basisChanged(previous: Partial<Pin> | undefined, next: Partial<Pin> | undefined) {
  if (!previous || !next) return null;
  return ["assignmentId", "skillDocumentId", "skillVersionId", "contentDigest"].some(key =>
    previous[key as keyof Pin] !== next[key as keyof Pin]);
}

export function RequirementCarryForwardReview({ selections, skillContext }: {
  selections: unknown; skillContext: unknown;
}) {
  const selected = Array.isArray(selections) ? selections.filter(isSelection) : [];
  if (!selected.length) return null;
  const pin = skillContext as ZyraTask["skillContext"];
  const next = Array.isArray(pin?.assignments) ? pin.assignments.find(item =>
    item.target?.module === "requirements" && item.target.subtype === "functional"
    && item.target.operation === "requirement_case_link") : undefined;
  return (
    <section className="space-y-3 rounded-lg border border-[var(--border)] p-3" data-testid="requirement-carry-forward-review">
      <div>
        <h3 className="text-sm font-semibold text-[var(--foreground)]">Selected existing links for carry-forward</h3>
        <p className="mt-1 text-xs text-[var(--muted)]">Review the exact case, ordered criteria and Skill basis below. Only these selected groups may be rebound to this approved revision. Approval does not itself activate the links.</p>
      </div>
      {selected.map(item => {
        const previous = item.originatingLinkSkill;
        const changed = basisChanged(previous, next);
        return (
          <div key={item.linkId} className="space-y-2 border-t border-[var(--border)] pt-3" data-testid={"requirement-carry-forward-" + item.linkId}>
            <p className="font-medium text-sm text-[var(--foreground)]">Criteria: {item.criterionKeys.join(" → ")}</p>
            <p className="text-xs text-[var(--muted)]">{changed === null ? "Skill basis unavailable" : changed ? "Skill assignment or version changed — explicit review required" : "Same reviewed link Skill basis"}</p>
            <dl className="grid gap-2 text-xs md:grid-cols-2">
              {[
                ["Source link", item.linkId], ["Source requirement version", item.requirementVersionId],
                ["Originating approved version", item.originatingApprovedVersionId], ["Existing testcase", item.testcaseId],
                ["Source case revision", item.sourceTestcaseRevision], ["Reviewed case revision", item.testcaseRevision],
                ["Source approval revision", item.sourceTestcaseApprovalRevision], ["Reviewed approval revision", item.testcaseApprovalRevision],
              ].map(([label, value]) => <div key={label}><dt className="font-medium">{label}</dt><dd className="break-all text-[var(--muted)] font-mono">{value || "Not recorded"}</dd></div>)}
            </dl>
            <div className="grid gap-3 md:grid-cols-2">
              {([["Originating reviewed Skill", previous], ["Proposed reviewed Skill", next]] as const).map(([label, value]) =>
                <div key={label} className="rounded-md bg-[var(--surface-secondary)] p-2 text-xs">
                  <p className="font-medium">{label}</p>
                  {value ? <dl className="mt-1 space-y-1 break-all">
                    <div><dt>Assignment</dt><dd className="font-mono text-[var(--muted)]">{value.assignmentId}</dd></div>
                    <div><dt>Document</dt><dd className="font-mono text-[var(--muted)]">{value.skillDocumentId}</dd></div>
                    <div><dt>Version</dt><dd className="font-mono text-[var(--muted)]">{value.skillVersionId}</dd></div>
                    <div><dt>Content digest</dt><dd className="font-mono text-[var(--muted)]">{value.contentDigest}</dd></div>
                  </dl> : <p className="text-[var(--muted)]">Not available; cannot establish reviewed authority.</p>}
                </div>
              )}
            </div>
            {item.criterionKeys.map(key => {
              const old = item.originatingCriteria?.find(c => c.key === key);
              const proposed = item.proposedCriteria?.find(c => c.key === key);
              return <div key={key} className="text-xs space-y-1">
                <p className="font-medium">{key} · {old && proposed && old.text === proposed.text && old.normative === proposed.normative ? "Unchanged" : "Review criterion change"}</p>
                <div className="grid gap-2 md:grid-cols-2">
                  <div><p className="text-[var(--muted)]">Originating</p><p className="whitespace-pre-wrap break-words">{old?.text || "Not recorded"}{old?.normative === false ? " (context only)" : ""}</p></div>
                  <div><p className="text-[var(--muted)]">Proposed</p><p className="whitespace-pre-wrap break-words">{proposed?.text || "Not recorded"}{proposed?.normative === false ? " (context only)" : ""}</p></div>
                </div>
              </div>;
            })}
          </div>
        );
      })}
    </section>
  );
}
