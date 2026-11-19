"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useParams } from "@/lib/routeParams";
import {
  listTestRuns,
  listTestRunSchedules,
  createTestRunSchedule,
  updateTestRunSchedule,
  deleteTestRunSchedule,
  runTestRunSchedule,
  type TestRunListItem,
  type TestRunSchedule,
} from "@/lib/api";
import { Button, Input, Card, Field, FieldLabel, FieldError, Modal, Select } from "@/components/ui";
import { PageHeader, StandardPageLayout, Breadcrumbs } from "@/components/workflows";
import { validateScheduleDays, validateScheduleLocalTime, validateScheduleRunAt } from "@/lib/validation";
import { formatDateTime } from "@/lib/date";
import { useAppData } from "@/components/app/AppDataProvider";
import { useProjectData } from "@/components/project/ProjectDataProvider";

/** The browser's own local "now", formatted for a datetime-local input's value/min attribute. */
function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function currentTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Every IANA zone the browser knows about, for the dropdown. */
function allTimezones(): string[] {
  try {
    const supportedValuesOf = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
    const zones = supportedValuesOf?.("timeZone");
    if (zones && zones.length > 0) return zones;
  } catch {
    // Intl.supportedValuesOf isn't available in every runtime — fall through to the fallback below.
  }
  return ["UTC"];
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** A schedule's type as a person reads it: the local rule includes the zone it is local to. */
function scheduleTypeLabel(schedule: TestRunSchedule): string {
  if (schedule.scheduleType === "one_time") return "One-time";
  if (schedule.scheduleType === "recurring") return `Every ${schedule.intervalMinutes}m`;
  const time = schedule.localTime ?? "—";
  if (schedule.scheduleType === "daily") return `Daily at ${time} (${schedule.timezone})`;
  const days =
    (schedule.daysOfWeek ?? []).map((day) => DAY_LABELS[day] ?? String(day)).join(", ") || "—";
  return `Weekly ${days} at ${time} (${schedule.timezone})`;
}

export default function ScheduleRunsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const { currentUser } = useAppData();
  const { project } = useProjectData();
  const projectName = String(project.name || "");

  const [runs, setRuns] = useState<TestRunListItem[]>([]);
  const [schedules, setSchedules] = useState<TestRunSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<TestRunSchedule | null>(null);

  const [name, setName] = useState("");
  const [cycleId, setCycleId] = useState("");
  const [scheduleType, setScheduleType] = useState<"one_time" | "recurring" | "daily" | "weekly">("one_time");
  const [runAt, setRunAt] = useState("");
  const [runAtError, setRunAtError] = useState("");
  const [intervalMinutes, setIntervalMinutes] = useState(1440);
  const [localTime, setLocalTime] = useState("09:00");
  const [localTimeError, setLocalTimeError] = useState("");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1]);
  const [daysError, setDaysError] = useState("");
  const [timezone, setTimezone] = useState<string>(currentTimezone);
  // Computed once at mount: the option list itself doesn't change, only which one is selected.
  const [timezoneOptions] = useState<string[]>(() => {
    const zones = allTimezones();
    const current = currentTimezone();
    return zones.includes(current) ? zones : [current, ...zones];
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [runList, scheduleList] = await Promise.all([
        listTestRuns(projectId),
        listTestRunSchedules(projectId),
      ]);
      setRuns(runList);
      setSchedules(scheduleList);
      if (!cycleId && runList.length > 0) {
        setCycleId(runList[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load schedules");
    } finally {
      setLoading(false);
    }
  }, [projectId, cycleId]);

  useEffect(() => {
    if (!currentUser) {
      router.replace("/login");
      return;
    }
    load();
  }, [router, load, projectId, currentUser]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !cycleId) return;
    setError(null);
    if (scheduleType === "one_time") {
      const runAtErr = validateScheduleRunAt(runAt);
      if (runAtErr) {
        setRunAtError(runAtErr);
        return;
      }
    }
    if (scheduleType === "daily" || scheduleType === "weekly") {
      const timeErr = validateScheduleLocalTime(localTime);
      if (timeErr) {
        setLocalTimeError(timeErr);
        return;
      }
      if (scheduleType === "weekly") {
        const daysErr = validateScheduleDays(daysOfWeek);
        if (daysErr) {
          setDaysError(daysErr);
          return;
        }
      }
    }
    setRunAtError("");
    setLocalTimeError("");
    setDaysError("");
    setSaving(true);
    try {
      await createTestRunSchedule(projectId, {
        cycleId,
        name: name.trim(),
        scheduleType,
        runAt: scheduleType === "one_time" ? new Date(runAt).toISOString() : undefined,
        intervalMinutes: scheduleType === "recurring" ? intervalMinutes : undefined,
        localTime: scheduleType === "daily" || scheduleType === "weekly" ? localTime : undefined,
        daysOfWeek: scheduleType === "weekly" ? daysOfWeek : undefined,
        timezone,
        enabled: true,
      });
      setName("");
      setRunAt("");
      setIntervalMinutes(1440);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create schedule");
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(item: TestRunSchedule) {
    try {
      await updateTestRunSchedule(item.id, { enabled: !item.enabled });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update schedule");
    }
  }

  async function removeSchedule(scheduleId: string) {
    try {
      await deleteTestRunSchedule(scheduleId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete schedule");
    }
  }

  /** Manual run: creates a Test Run now without changing the schedule's cadence. */
  async function runNow(schedule: TestRunSchedule) {
    setError(null);
    setNotice(null);
    try {
      const result = await runTestRunSchedule(schedule.id);
      setNotice(`Created run "${result.cycleName}".`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to run the schedule");
    }
  }

  return (
    <StandardPageLayout
      header={
        <PageHeader
          title="Schedule Test Run"
          subtitle="Create one-time or recurring reminders for planned test runs."
          breadcrumb={
            <Breadcrumbs
              items={[
                { label: "Projects", href: "/projects" },
                { label: projectName || "Project", href: `/projects/${projectId}/dashboard` },
                { label: "Test Runs", href: `/projects/${projectId}/cycles` },
                { label: "Schedule" },
              ]}
            />
          }
          actions={
            <Link
              href={`/projects/${projectId}/cycles`}
              className="inline-flex items-center justify-center h-10 rounded-xl px-4 text-sm font-medium border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-secondary)] transition-colors"
            >
              Back to Runs
            </Link>
          }
        />
      }
    >
      {error && (
        <div className="rounded-lg border border-[var(--error)]/30 bg-[var(--error-soft)] px-4 py-2 text-sm text-[var(--error-foreground)]">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-2 text-sm">
          {notice}
        </div>
      )}

      <Card className="p-5">
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">New Schedule</h2>
        <form onSubmit={onCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field>
            <FieldLabel>Schedule Name</FieldLabel>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nightly Smoke"
              required
            />
          </Field>
          <Field>
            <FieldLabel>Test Run</FieldLabel>
            <Select
              aria-label="Test Run"
              value={cycleId}
              onChange={(e) => setCycleId(e.target.value)}
              required
            >
              <option value="">Select a run</option>
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field>
            <FieldLabel>Schedule Type</FieldLabel>
            <Select
              aria-label="Schedule Type"
              value={scheduleType}
              onChange={(e) => {
                setScheduleType(e.target.value as "one_time" | "recurring" | "daily" | "weekly");
                setRunAtError("");
                setLocalTimeError("");
                setDaysError("");
              }}
            >
              <option value="one_time">One-time</option>
              <option value="recurring">Every N minutes</option>
              <option value="daily">Daily at a local time</option>
              <option value="weekly">Weekly on chosen days</option>
            </Select>
          </Field>
          <Field>
            <FieldLabel>Timezone</FieldLabel>
            <Select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            >
              {timezoneOptions.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </Select>
          </Field>
          {scheduleType === "one_time" ? (
            <div className="md:col-span-2">
              <Field>
                <FieldLabel>Run At</FieldLabel>
                <Input
                  aria-label="Run At"
                  type="datetime-local"
                  value={runAt}
                  min={toDatetimeLocalValue(new Date())}
                  onChange={(e) => {
                    setRunAt(e.target.value);
                    setRunAtError(validateScheduleRunAt(e.target.value));
                  }}
                  required
                />
                {runAtError && <FieldError>{runAtError}</FieldError>}
              </Field>
            </div>
          ) : scheduleType === "recurring" ? (
            <div className="md:col-span-2">
              <Field>
                <FieldLabel>Interval Minutes</FieldLabel>
                <Input
                  aria-label="Interval Minutes"
                  type="number"
                  min={1}
                  value={intervalMinutes}
                  onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                  required
                />
              </Field>
            </div>
          ) : (
            <div className="md:col-span-2 space-y-3">
              <Field>
                {/* The instant is resolved in the selected timezone, so DST is handled server-side. */}
                <FieldLabel>Local time ({timezone})</FieldLabel>
                <Input
                  aria-label="Local time"
                  type="time"
                  value={localTime}
                  onChange={(e) => {
                    setLocalTime(e.target.value);
                    setLocalTimeError(validateScheduleLocalTime(e.target.value));
                  }}
                  required
                />
                {localTimeError && <FieldError>{localTimeError}</FieldError>}
              </Field>
              {scheduleType === "weekly" && (
                <Field>
                  <FieldLabel>Days</FieldLabel>
                  <div className="flex flex-wrap gap-3">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label, day) => (
                      <label key={day} className="flex items-center gap-1 text-[12.5px]">
                        <input
                          type="checkbox"
                          checked={daysOfWeek.includes(day)}
                          onChange={(e) =>
                            setDaysOfWeek((current) =>
                              e.target.checked
                                ? [...current, day].sort((a, b) => a - b)
                                : current.filter((value) => value !== day)
                            )
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  {daysError && <FieldError>{daysError}</FieldError>}
                </Field>
              )}
            </div>
          )}
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Create Schedule"}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="px-5 py-3 border-b border-[var(--border-subtle)]">
          <h2 className="font-semibold text-[var(--foreground)]">Existing Schedules</h2>
        </div>
        {loading ? (
          <div className="p-5 text-sm text-[var(--muted)]">Loading...</div>
        ) : schedules.length === 0 ? (
          <div className="p-5 text-sm text-[var(--muted)]">No schedules created yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tesbo-table">
              <thead>
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Run</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Next Run</th>
                  <th className="px-4 py-3">Last Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((s) => {
                  const run = runs.find((r) => r.id === s.cycleId);
                  return (
                    <tr key={s.id}>
                      <td className="px-4 py-3">{s.name}</td>
                      <td className="px-4 py-3">{run?.name ?? s.cycleId}</td>
                      <td className="px-4 py-3">{scheduleTypeLabel(s)}</td>
                      <td className="px-4 py-3">{s.nextRunAt ? formatDateTime(s.nextRunAt) : "—"}</td>
                      <td className="px-4 py-3">{s.lastStatus ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button variant="secondary" size="sm" onClick={() => setEditing(s)}>
                            Edit
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => void runNow(s)}
                            disabled={s.isRunning}
                          >
                            {s.isRunning ? "Running…" : "Run now"}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => toggleEnabled(s)}
                          >
                            {s.enabled ? "Disable" : "Enable"}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => removeSchedule(s.id)}
                          >
                            Delete
                          </Button>
                        </div>
                        {s.lastError && <p className="text-xs text-[var(--error-foreground)] mt-1">{s.lastError}</p>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing && (
        <EditScheduleModal
          schedule={editing}
          timezoneOptions={timezoneOptions}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setNotice("Schedule updated.");
            void load();
          }}
        />
      )}
    </StandardPageLayout>
  );
}

type EditScheduleModalProps = {
  schedule: TestRunSchedule;
  timezoneOptions: string[];
  onClose: () => void;
  onSaved: () => void;
};

/** Edit only what changed, so saving a name does not silently shift a recurring schedule's cadence. */
function EditScheduleModal({ schedule, timezoneOptions, onClose, onSaved }: EditScheduleModalProps) {
  const [name, setName] = useState(schedule.name);
  const [scheduleType, setScheduleType] = useState(schedule.scheduleType);
  const [timezone, setTimezone] = useState(schedule.timezone);
  const [enabled, setEnabled] = useState(schedule.enabled);
  const [runAt, setRunAt] = useState(schedule.runAt ? toDatetimeLocalValue(new Date(schedule.runAt)) : "");
  const [intervalMinutes, setIntervalMinutes] = useState(schedule.intervalMinutes ?? 1440);
  const [localTime, setLocalTime] = useState(schedule.localTime ?? "09:00");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(schedule.daysOfWeek ?? [1]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const payload: {
      name?: string;
      scheduleType?: TestRunSchedule["scheduleType"];
      timezone?: string;
      enabled?: boolean;
      runAt?: string;
      intervalMinutes?: number;
      localTime?: string;
      daysOfWeek?: number[];
    } = {};
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Schedule name is required");
      return;
    }
    if (trimmed !== schedule.name) payload.name = trimmed;
    if (timezone !== schedule.timezone) payload.timezone = timezone;
    if (enabled !== schedule.enabled) payload.enabled = enabled;
    const typeChanged = scheduleType !== schedule.scheduleType;
    if (typeChanged) payload.scheduleType = scheduleType;
    const enabling = enabled && !schedule.enabled;

    if (scheduleType === "one_time") {
      const initial = schedule.runAt ? toDatetimeLocalValue(new Date(schedule.runAt)) : "";
      if (typeChanged || enabling || runAt !== initial) {
        const runAtErr = validateScheduleRunAt(runAt);
        if (runAtErr) {
          setError(runAtErr);
          return;
        }
        payload.runAt = new Date(runAt).toISOString();
      }
    } else if (scheduleType === "recurring") {
      if (typeChanged || intervalMinutes !== (schedule.intervalMinutes ?? 1440)) {
        payload.intervalMinutes = intervalMinutes;
      }
    } else {
      if (typeChanged || localTime !== (schedule.localTime ?? "09:00")) {
        const timeErr = validateScheduleLocalTime(localTime);
        if (timeErr) {
          setError(timeErr);
          return;
        }
        payload.localTime = localTime;
      }
      if (
        scheduleType === "weekly" &&
        (typeChanged || JSON.stringify(daysOfWeek) !== JSON.stringify(schedule.daysOfWeek ?? [1]))
      ) {
        const daysErr = validateScheduleDays(daysOfWeek);
        if (daysErr) {
          setError(daysErr);
          return;
        }
        payload.daysOfWeek = daysOfWeek;
      }
    }

    if (!Object.keys(payload).length) {
      onClose();
      return;
    }
    setBusy(true);
    try {
      await updateTestRunSchedule(schedule.id, payload);
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to update the schedule");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={busy ? () => {} : onClose} title="Edit schedule">
      <form onSubmit={submit} className="space-y-4">
        <Field>
          <FieldLabel>Schedule Name</FieldLabel>
          <Input aria-label="Edit schedule name" value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field>
          <FieldLabel>Test Run</FieldLabel>
          <p className="text-[13px] text-[var(--muted)]">{schedule.cycleName ?? schedule.cycleId}</p>
        </Field>
        <Field>
          <FieldLabel>Schedule Type</FieldLabel>
          <Select
            aria-label="Edit schedule type"
            value={scheduleType}
            onChange={(e) => setScheduleType(e.target.value as TestRunSchedule["scheduleType"])}
          >
            <option value="one_time">One-time</option>
            <option value="recurring">Every N minutes</option>
            <option value="daily">Daily at a local time</option>
            <option value="weekly">Weekly on chosen days</option>
          </Select>
        </Field>
        <Field>
          <FieldLabel>Timezone</FieldLabel>
          <Select aria-label="Edit timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
            {timezoneOptions.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </Select>
        </Field>
        {scheduleType === "one_time" ? (
          <Field>
            <FieldLabel>Run At</FieldLabel>
            <Input
              aria-label="Edit run at"
              type="datetime-local"
              value={runAt}
              min={toDatetimeLocalValue(new Date())}
              onChange={(e) => setRunAt(e.target.value)}
            />
          </Field>
        ) : scheduleType === "recurring" ? (
          <Field>
            <FieldLabel>Interval Minutes</FieldLabel>
            <Input
              aria-label="Edit interval minutes"
              type="number"
              min={1}
              value={intervalMinutes}
              onChange={(e) => setIntervalMinutes(Number(e.target.value))}
            />
          </Field>
        ) : (
          <>
            <Field>
              <FieldLabel>Local time ({timezone})</FieldLabel>
              <Input aria-label="Edit local time" type="time" value={localTime} onChange={(e) => setLocalTime(e.target.value)} />
            </Field>
            {scheduleType === "weekly" && (
              <Field>
                <FieldLabel>Days</FieldLabel>
                <div className="flex flex-wrap gap-3">
                  {DAY_LABELS.map((label, day) => (
                    <label key={day} className="flex items-center gap-1 text-[12.5px]">
                      <input
                        type="checkbox"
                        checked={daysOfWeek.includes(day)}
                        onChange={(e) =>
                          setDaysOfWeek((current) =>
                            e.target.checked
                              ? [...current, day].sort((a, b) => a - b)
                              : current.filter((value) => value !== day)
                          )
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </Field>
            )}
          </>
        )}
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Enabled
        </label>
        {error && <FieldError>{error}</FieldError>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save schedule"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
