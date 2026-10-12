import { avatarColor } from "@/lib/avatarColors";
import { formatDate as formatDateShared } from "@/lib/date";

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function statusTone(status: string): "neutral" | "brand" | "ai" | "success" | "warning" | "error" | "info" {
  switch (status) {
    case "Planning":
      return "warning";
    case "In Progress":
      return "info";
    case "Completed":
      return "success";
    default:
      return "neutral";
  }
}

export function formatDuration(startedAt: string | null, endedAt: string | null): string {
  if (!startedAt) return "—";
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return "—";
  const totalMinutes = Math.round((end - start) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export const formatDate = formatDateShared;

/** Work time from a millisecond total: "2d 12h", "3h 5m", "40m". Under a minute reads "<1m". */
export function formatSpent(ms: number | null | undefined): string {
  if (ms == null || ms < 0) return "—";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "<1m";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

export function RunTags({ tags }: { tags?: string[] | null }) {
  if (!tags?.length) return null;
  return (
    <span className="flex flex-wrap items-center gap-1" data-testid="run-tags">
      {tags.map((tag) => (
        <span key={tag} className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] text-[var(--muted)]">
          {tag}
        </span>
      ))}
    </span>
  );
}

export function RunAvatar({ name }: { name: string }) {
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold tracking-wide text-white"
      style={{ background: avatarColor(name) }}
    >
      {getInitials(name)}
    </div>
  );
}

export function RunProgressBar({
  passed,
  failed,
  blocked,
  skipped,
  total,
}: {
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  total: number;
}) {
  const pct = (n: number) => `${total ? (n / total) * 100 : 0}%`;
  return (
    <div className="flex h-[5px] gap-0.5 overflow-hidden rounded-full bg-[var(--surface-secondary)]">
      {passed > 0 && <div className="h-full" style={{ width: pct(passed), background: "var(--status-pass-dot)" }} />}
      {failed > 0 && <div className="h-full" style={{ width: pct(failed), background: "var(--status-fail-dot)" }} />}
      {blocked > 0 && <div className="h-full" style={{ width: pct(blocked), background: "var(--status-blocked-dot)" }} />}
      {skipped > 0 && <div className="h-full" style={{ width: pct(skipped), background: "var(--status-skipped-dot)" }} />}
    </div>
  );
}
