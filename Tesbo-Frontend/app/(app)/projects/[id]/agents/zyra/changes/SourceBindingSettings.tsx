"use client";

import { useEffect, useState } from "react";
import {
  getZyraGraphSourceBinding, setZyraGraphSourceBinding,
  type GraphSourceBinding
} from "@/lib/api";

const EMPTY: GraphSourceBinding = {
  repositoryId: "", checkoutKey: "", refName: "development", selectionPrefixes: [], enabled: false
};

/**
 * Reuses the native Zyra change review, not a separate repository manager.
 * The backend never exposes the approved checkout root or credentials.
 */
export function SourceBindingSettings({ projectId }: { projectId: string }) {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [form, setForm] = useState<GraphSourceBinding>({ ...EMPTY });
  const [prefixText, setPrefixText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setAuthorized(false);
    void getZyraGraphSourceBinding(projectId).then((response) => {
      if (!alive) return;
      setAuthorized(true);
      setConfigured(response.configured);
      setForm(response.binding ?? { ...EMPTY });
      setPrefixText(response.binding?.selectionPrefixes.join("\n") ?? "");
      setError(null);
    }).catch((cause) => {
      if (!alive) return;
      // Non-owners should not see the administrative setup form.
      // This is presentation only; server-side ownership remains mandatory.
      const message = cause instanceof Error ? cause.message : "Could not load source settings";
      // Any failed authorization read must fail closed. A temporary 5xx is
      // not permission to render an administrative form for an unknown user.
      setAuthorized(false);
      if (!/403|forbidden|permission|project owner required/i.test(message)) {
        setError(message);
      }
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [projectId]);

  if (loading) return null;
  if (!authorized) {
    return error ? <p role="alert" className="text-sm">
      Source binding settings could not be loaded: {error}
    </p> : null;
  }

  async function save() {
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      const data = {
        ...form,
        selectionPrefixes: prefixText.trim()
          ? prefixText.split(/\r?\n/).map((part) => part.trim())
          : []
      };
      const response = await setZyraGraphSourceBinding(projectId, data);
      setConfigured(response.configured);
      if (response.binding) {
        setForm(response.binding);
        setPrefixText(response.binding.selectionPrefixes.join("\n"));
      }
      setNotice(response.binding?.enabled
        ? "Approved source binding saved. Capture still requires a valid server checkout."
        : "Source binding saved as disabled; graph capture is unavailable until enabled.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Source binding could not be saved");
    } finally { setSaving(false); }
  }

  return (
    <details className="rounded-lg border border-[var(--border)] p-4 text-sm" data-testid="zyra-source-binding">
      <summary className="cursor-pointer font-semibold">Project source binding (owners)</summary>
      <div className="mt-3 space-y-3">
        <p className="text-[var(--muted)]">
          {configured ? "A project source binding exists." : "No project source binding has been configured."}
          {" "}Only an approved server checkout key can be used. Filesystem roots and credentials
          cannot be entered here. An empty selection checks the entire repository within source limits.
        </p>
        <label className="block">
          Repository identity (owner/repository)
          <input aria-label="Source repository identity" value={form.repositoryId}
            onChange={(event) => setForm({ ...form, repositoryId: event.target.value })}
            className="mt-1 w-full rounded border border-[var(--border)] bg-transparent p-2" />
        </label>
        <label className="block">
          Server-approved checkout key
          <input aria-label="Approved checkout key" value={form.checkoutKey}
            onChange={(event) => setForm({ ...form, checkoutKey: event.target.value })}
            className="mt-1 w-full rounded border border-[var(--border)] bg-transparent p-2" />
        </label>
        <label className="block">
          Git ref
          <input aria-label="Source Git ref" value={form.refName}
            onChange={(event) => setForm({ ...form, refName: event.target.value })}
            className="mt-1 w-full rounded border border-[var(--border)] bg-transparent p-2" />
        </label>
        <label className="block">
          Source selection prefixes (one relative path per line)
          <textarea aria-label="Source selection prefixes" value={prefixText}
            onChange={(event) => setPrefixText(event.target.value)} rows={3}
            className="mt-1 w-full rounded border border-[var(--border)] bg-transparent p-2" />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.enabled}
            onChange={(event) => setForm({ ...form, enabled: event.target.checked })} />
          Enable configured source capture
        </label>
        {error && <p role="alert" className="text-[var(--destructive)]">{error}</p>}
        {notice && <p role="status">{notice}</p>}
        <button type="button" disabled={saving} onClick={() => void save()}
          className="rounded border border-[var(--border)] px-4 py-2 disabled:opacity-60">
          {saving ? "Saving source binding…" : "Save source binding"}
        </button>
      </div>
    </details>
  );
}
