"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, getProjectMcpAccess, listApiKeys, updateProjectMcpAccess, type ApiToken, type ApiMcpClientGrant, type McpClientGrant, type OAuthMcpClientGrant, type ProjectMcpAccess, type MyMcpOAuthConsent, listMyMcpOAuthConsents, revokeMyMcpOAuthConsent } from "@/lib/api";
import { Button, Card, Field, FieldLabel, Input } from "@/components/ui";

function clientGrantIdentity(client: McpClientGrant): string {
  return "tokenId" in client ? `api:${client.tokenId}` : `oauth:${client.oauthClientId}`;
}

type ExternalMcpAccessPanelProps = { projectId: string; canManage: boolean; refreshKey?: number };

export function ExternalMcpAccessPanel(props: ExternalMcpAccessPanelProps) {
  // A project change must not reuse credentials, pending form input, notices or a save from another project.
  return <div key={props.projectId} className="space-y-4"><MyOAuthConsentHistory projectId={props.projectId} refreshKey={props.refreshKey ?? 0} /><ProjectMcpAccessPanel {...props} /></div>;
}

/**
 * Individual user's consent records. The server returns only the authenticated
 * session owner's rows; client labels are never used as authority.
 * No stored consent is evidence of a currently running external application.
 */
function MyOAuthConsentHistory({ projectId, refreshKey }: { projectId: string; refreshKey: number }) {
  const [rows, setRows] = useState<MyMcpOAuthConsent[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const generationRef = useRef<{ active: boolean } | null>(null);
  const pendingRef = useRef(false);

  useEffect(() => {
    const generation = { active: true };
    generationRef.current = generation;
    pendingRef.current = false;
    setRows(null); setTruncated(false); setLoading(true);
    setBusyId(null); setError(null); setNotice(null);
    listMyMcpOAuthConsents(projectId).then(result => {
      if (!generation.active || generationRef.current !== generation) return;
      setRows(result.consents); setTruncated(result.truncated);
    }).catch(reason => {
      if (generation.active && generationRef.current === generation) {
        setError(reason instanceof Error ? reason.message : "Consent history could not be loaded.");
      }
    }).finally(() => {
      if (generation.active && generationRef.current === generation) setLoading(false);
    });
    return () => { generation.active = false; };
  }, [projectId, refreshKey, reload]);

  async function disconnect(consent: MyMcpOAuthConsent) {
    if (pendingRef.current || loading || !rows) return;
    const generation = generationRef.current;
    if (!generation?.active) return;
    pendingRef.current = true;
    setBusyId(consent.id); setError(null); setNotice(null);
    try {
      const result = await revokeMyMcpOAuthConsent(projectId, consent.id);
      if (!generation.active || generationRef.current !== generation) return;
      if (result.status !== "revoked" || result.id !== consent.id) throw Error("Revocation result did not match this consent.");
      setRows(current => current?.map(row => row.id === consent.id ?
        { ...row, status: "revoked" } : row) ?? null);
      setNotice("This consent has been revoked. The previously issued OAuth grant cannot be used again.");
    } catch (reason) {
      if (!generation.active || generationRef.current !== generation) return;
      // A failed response may hide a committed revoke; do not claim either state.
      setRows(null);
      setError(reason instanceof Error ? reason.message : "Could not confirm the outcome. Reload to verify.");
    } finally {
      if (generation.active && generationRef.current === generation) {
        pendingRef.current = false; setBusyId(null);
      }
    }
  }

  return <Card className="space-y-3 p-4" aria-labelledby="my-oauth-consents-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 id="my-oauth-consents-title" className="font-semibold">Your OAuth consent history</h3>
        <p className="text-sm text-[var(--muted)]">These are consent records for your Tesbo account in this project, not proof that an app is online. You can revoke your own consent without changing the project owner's client approval.</p>
      </div>
      <Button variant="secondary" disabled={loading || busyId !== null}
        onClick={() => setReload(x => x + 1)}>Reload history</Button>
    </div>
    {loading && <p role="status">Loading your OAuth consent history…</p>}
    {error && <p role="alert" className="text-sm text-[var(--error-foreground)]">{error}</p>}
    {notice && <p role="status" className="text-sm">{notice}</p>}
    {rows && rows.length === 0 && <p className="text-sm text-[var(--muted)]">You have not authorized an OAuth client for this project.</p>}
    {rows && rows.length > 0 && <ul className="space-y-2" aria-label="Your OAuth consent records">
      {rows.map(consent => {
        const stateLabel = consent.status === "revoked" ? "Revoked" :
          consent.status === "reconsent_required" ? "Reauthorization required" : "Consent recorded (not live status)";
        return <li key={consent.id} className="space-y-1 rounded-lg border border-[var(--border)] p-3 text-sm">
          <p className="font-medium break-words">{consent.clientName}</p>
          <p className="break-all text-[var(--muted)]">{consent.clientId}</p>
          <p>State: {stateLabel}</p>
          <p className="text-[var(--muted)]">Approved resource: {consent.resource}</p>
          <p className="text-[var(--muted)]">Consent recorded: {new Date(consent.createdAt).toLocaleString()}</p>
          {consent.status !== "revoked" && <Button variant="secondary" disabled={busyId !== null}
            onClick={() => void disconnect(consent)}>
            {busyId === consent.id ? "Revoking…" : "Revoke my consent"}
          </Button>}
        </li>;
      })}
    </ul>}
    {truncated && <p className="text-sm text-[var(--muted)]">Only the 50 most recent consent records are shown. Older history is retained but not displayed here.</p>}
  </Card>;
}

function ProjectMcpAccessPanel({ projectId, canManage, refreshKey = 0 }: ExternalMcpAccessPanelProps) {
  const [access, setAccess] = useState<ProjectMcpAccess | null>(null);
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [tokenId, setTokenId] = useState("");
  const [clientName, setClientName] = useState("");
  const [allowWrite, setAllowWrite] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [tools, setTools] = useState("");
  const [oauthClientId, setOauthClientId] = useState("");
  const [oauthClientName, setOauthClientName] = useState("");
  const [oauthExpiresAt, setOauthExpiresAt] = useState("");
  const requestGeneration = useRef<{ active: boolean } | null>(null);
  const pendingSave = useRef<{ active: boolean } | null>(null);

  useEffect(() => {
    const generation = { active: true };
    requestGeneration.current = generation;
    const current = () => generation.active && requestGeneration.current === generation;
    pendingSave.current = null;
    setAccess(null); setTokens([]); setError(null); setNotice(null); setSaving(false);
    setTokenId(""); setClientName(""); setAllowWrite(false); setExpiresAt(""); setTools("");
    setOauthClientId(""); setOauthClientName(""); setOauthExpiresAt("");
    setLoading(canManage);
    if (!canManage) return () => { generation.active = false; };
    Promise.all([getProjectMcpAccess(projectId), listApiKeys(projectId)]).then(([next, nextTokens]) => {
      if (!current()) return;
      setAccess(next); setTokens(nextTokens); setError(null);
    }).catch(reason => {
      if (current()) setError(reason instanceof Error ? reason.message : "External access settings could not be loaded.");
    }).finally(() => { if (current()) setLoading(false); });
    // Invalidate both loads and saves when the project, permission or refresh generation ends.
    return () => { generation.active = false; };
  }, [projectId, canManage, refreshKey, reloadKey]);

  const save = useCallback(async (next: ProjectMcpAccess, message: string) => {
    if (!canManage || !access || loading || saving || pendingSave.current !== null) return false;
    const generation = requestGeneration.current;
    if (!generation?.active) return false;
    pendingSave.current = generation;
    setSaving(true); setError(null); setNotice(null);
    try {
      const saved = await updateProjectMcpAccess(projectId, next);
      if (!generation.active || requestGeneration.current !== generation) return false;
      setAccess(saved); setNotice(message);
      return true;
    } catch (reason) {
      if (!generation.active || requestGeneration.current !== generation) return false;
      // A stale revision or uncertain network outcome requires a new authoritative read before another mutation.
      setAccess(null); setTokens([]);
      setError(reason instanceof ApiError ? reason.message : "The save outcome could not be confirmed. Reload access settings before trying again.");
      return false;
    } finally {
      if (generation.active && requestGeneration.current === generation) {
        pendingSave.current = null; setSaving(false);
      }
    }
  }, [projectId, canManage, access, loading, saving]);

  async function addClient(event: FormEvent) {
    event.preventDefault();
    if (!access || saving || loading) return;
    const token = tokens.find(item => item.id === tokenId);
    if (!token || !clientName.trim()) { setError("Choose a current API token and enter the client name."); return; }
    const scopes: ApiMcpClientGrant["scopes"] = [];
    if (token.scopes.includes("read")) scopes.push("read");
    if (allowWrite && token.scopes.includes("write")) scopes.push("write");
    if (!scopes.length) { setError("Choose a credential with read access, or explicitly allow its write access."); return; }
    const grant: McpClientGrant = {
      tokenId, clientName: clientName.trim(), scopes,
      allowedTools: tools.trim() ? tools.split(",").map(name => name.trim()).filter(Boolean) : null,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null
    };
    if (await save({ ...access, clients: [...access.clients, grant] }, "Client approved. It can connect only while external MCP access is enabled.")) {
      setTokenId(""); setClientName(""); setAllowWrite(false); setExpiresAt(""); setTools("");
    }
  }

  async function addOauthClient(event: FormEvent) {
    event.preventDefault();
    if (!access || saving || loading || !canManage) return;
    const candidate = oauthClientId.trim();
    let parsed: URL;
    try { parsed = new URL(candidate); } catch { setError("Enter the canonical HTTPS URL of the OAuth client metadata document."); return; }
    if (candidate !== parsed.href || parsed.protocol !== "https:" || parsed.username || parsed.password ||
        parsed.hash || parsed.search || parsed.hostname === "localhost" || !oauthClientName.trim()) {
      setError("The OAuth client ID must be a canonical HTTPS URL and the client must have a name.");
      return;
    }
    if (access.clients.some(client => clientGrantIdentity(client) === `oauth:${candidate}`)) {
      setError("That OAuth client already has a project grant.");
      return;
    }
    const grant: OAuthMcpClientGrant = {
      kind: "oauth_client", oauthClientId: candidate, clientName: oauthClientName.trim(),
      scopes: ["read"], allowedTools: null,
      expiresAt: oauthExpiresAt ? new Date(oauthExpiresAt).toISOString() : null
    };
    if (await save({ ...access, clients: [...access.clients, grant] },
      "Read-only OAuth client identity preapproved. This is not a connection; the user must still complete login and consent.")) {
      setOauthClientId(""); setOauthClientName(""); setOauthExpiresAt("");
    }
  }

  if (!canManage) return <p className="text-sm text-[var(--muted)]">A project owner or manager must enable external MCP access and approve each client credential.</p>;
  const availableTokens = tokens.filter(token => !access?.clients.some(client => "tokenId" in client && client.tokenId === token.id));
  const selectedToken = tokens.find(token => token.id === tokenId);

  return <Card className="space-y-4 p-4" aria-labelledby="external-mcp-heading">
    <div>
      <h2 id="external-mcp-heading" className="font-semibold">External AI &amp; MCP Access</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">Access starts off. Enabling it allows only the named credentials approved below. Disabling it blocks subsequent MCP requests from analysts and executor agents; native Tesbo work remains available.</p>
    </div>
    {loading && <p role="status">Loading external access…</p>}
    {error && <div role="alert" className="text-sm text-[var(--error-foreground)]">
      <p>{error}</p>
      <Button variant="secondary" disabled={saving || loading} onClick={() => setReloadKey(key => key + 1)}>Reload access settings</Button>
    </div>}
    {notice && <p role="status" className="text-sm">{notice}</p>}
    {access && <>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium">External MCP: {access.enabled ? "On" : "Off"}</span>
        <Button disabled={saving || loading} variant={access.enabled ? "secondary" : "primary"}
          onClick={() => void save({ ...access, enabled: !access.enabled }, access.enabled ? "External MCP access disabled. Subsequent requests are blocked." : "External MCP access enabled for approved credentials.")}>
          {access.enabled ? "Disable external MCP" : "Enable external MCP"}
        </Button>
      </div>
      <ul className="space-y-3" aria-label="Approved MCP clients">
        {access.clients.map(client => {
          const isOauth = "kind" in client && client.kind === "oauth_client";
          const token = "tokenId" in client ? tokens.find(item => item.id === client.tokenId) : undefined;
          return <li key={clientGrantIdentity(client)} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-[var(--border)] p-3">
            <div className="min-w-0 text-sm">
              <p className="font-semibold break-words">{client.clientName}</p>
              <p className="text-[var(--muted)]">{isOauth ? `OAuth identity preapproved (not connected): ${"oauthClientId" in client ? client.oauthClientId : ""}` : token ? `${token.name} · ${token.tokenPrefix}` : "Credential revoked or unavailable"}</p>
              <p>{client.scopes.join(" + ")} · {client.allowedTools ? `Tools: ${client.allowedTools.join(", ")}` : "All tools within these scopes"}</p>
              <p>{client.expiresAt ? `Expires ${new Date(client.expiresAt).toLocaleString()}` : "No grant expiry set"}</p>
              {token && <p className="text-[var(--muted)]">Credential last used: {token.lastUsedAt ? new Date(token.lastUsedAt).toLocaleString() : "Never"}</p>}
            </div>
            <Button variant="secondary" disabled={saving || loading} onClick={() => void save({ ...access, clients: access.clients.filter(item => clientGrantIdentity(item) !== clientGrantIdentity(client)) }, "Client access revoked. Subsequent MCP requests are blocked.")}>Revoke {client.clientName}</Button>
          </li>;
        })}
      </ul>
      {access.clients.length === 0 && <p className="text-sm text-[var(--muted)]">No client credentials are approved.</p>}
      <form onSubmit={addClient} className="space-y-3 border-t border-[var(--border)] pt-4">
        <h3 className="text-sm font-semibold">Approve a named client</h3>
        <Field><FieldLabel htmlFor="mcp-client-token">API credential</FieldLabel>
          <select id="mcp-client-token" value={tokenId} disabled={saving || loading} onChange={event => { setTokenId(event.target.value); setAllowWrite(false); }} className="w-full rounded border border-[var(--border)] bg-[var(--surface)] p-2 text-sm">
            <option value="">Select a credential</option>
            {availableTokens.map(token => <option key={token.id} value={token.id}>{token.name} ({token.tokenPrefix})</option>)}
          </select>
          {!availableTokens.length && <p className="text-sm text-[var(--muted)]">Create a separate API token for each client, then reload these settings.</p>}
        </Field>
        <Field><FieldLabel htmlFor="mcp-client-name">Client name</FieldLabel><Input id="mcp-client-name" value={clientName} maxLength={100} disabled={saving || loading} onChange={event => setClientName(event.target.value)} placeholder="For example, QA OpenCode" /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={allowWrite} disabled={saving || loading || !selectedToken?.scopes.includes("write")} onChange={event => setAllowWrite(event.target.checked)} /> Allow write tools within this credential&apos;s existing permissions</label>
        <Field><FieldLabel htmlFor="mcp-client-expiry">Grant expiry (optional)</FieldLabel><Input id="mcp-client-expiry" type="datetime-local" value={expiresAt} disabled={saving || loading} onChange={event => setExpiresAt(event.target.value)} /></Field>
        <Field><FieldLabel htmlFor="mcp-client-tools">Limit to specific tool names (optional, separated by commas)</FieldLabel><Input id="mcp-client-tools" value={tools} disabled={saving || loading} onChange={event => setTools(event.target.value)} placeholder="list_projects, list_testcases" /></Field>
        <p className="text-xs text-[var(--muted)]">The grant is bound to this credential, not to a name supplied by the connecting app. Use a different credential for each client.</p>
        <Button type="submit" disabled={saving || loading || !tokenId || !clientName.trim()}>Approve client</Button>
        <Button type="button" variant="secondary" disabled={saving || loading} onClick={() => setReloadKey(key => key + 1)}>Reload credentials</Button>
      </form>
      <form onSubmit={addOauthClient} className="space-y-3 border-t border-[var(--border)] pt-4" aria-labelledby="oauth-client-grant-title">
        <h3 id="oauth-client-grant-title" className="font-semibold">Preapprove an OAuth client — read only</h3>
        <p className="text-sm text-[var(--muted)]">
          This approves a client identity in the existing project policy. It does not connect the app,
          grant consent on a user&apos;s behalf, issue an OAuth token, or permit publishing test cases.
          Each user must separately authorize access when OAuth becomes available.
        </p>
        <Field><FieldLabel htmlFor="mcp-oauth-client-id">OAuth client ID metadata URL (HTTPS)</FieldLabel>
          <Input id="mcp-oauth-client-id" type="url" value={oauthClientId} maxLength={2048}
            disabled={saving || loading} onChange={event => setOauthClientId(event.target.value)}
            placeholder="https://client.example/oauth/client.json" />
        </Field>
        <Field><FieldLabel htmlFor="mcp-oauth-client-name">Client label</FieldLabel>
          <Input id="mcp-oauth-client-name" value={oauthClientName} maxLength={100}
            disabled={saving || loading} onChange={event => setOauthClientName(event.target.value)}
            placeholder="Read-only QA client" />
        </Field>
        <Field><FieldLabel htmlFor="mcp-oauth-client-expiry">Project approval expiry (optional)</FieldLabel>
          <Input id="mcp-oauth-client-expiry" type="datetime-local" value={oauthExpiresAt}
            disabled={saving || loading} onChange={event => setOauthExpiresAt(event.target.value)} />
        </Field>
        <p className="text-xs text-[var(--muted)]">Read-only scope only. Client metadata must be verified during the future OAuth handshake; this label is not evidence of client authenticity.</p>
        <Button type="submit" disabled={saving || loading || !oauthClientId.trim() || !oauthClientName.trim()}>
          Preapprove read-only client
        </Button>
      </form>
    </>}
  </Card>;
}
