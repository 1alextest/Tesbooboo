import { expect, type APIRequestContext } from "@playwright/test";

/** Explicit human consent for disposable test credentials; production tokens are never opted in automatically. */
export async function approveMcpTestClient(owner: APIRequestContext, projectId: string, token: { id: string; name?: string; scopes: string[] }, apiOrigin = "") {
  const projectEndpoint = `${apiOrigin.replace(/\/$/, "")}/api/projects/${projectId}`;
  for (let attempt = 0; attempt < 10; attempt++) {
    const currentResponse = await owner.get(`${projectEndpoint}/mcp-access`);
    expect(currentResponse.ok(), await currentResponse.text()).toBeTruthy();
    const current = await currentResponse.json();
    const tokenResponse = await owner.get(`${projectEndpoint}/apikeys`);
    expect(tokenResponse.ok(), await tokenResponse.text()).toBeTruthy();
    const activeIds = new Set((await tokenResponse.json()).map((item: { id: string }) => item.id));
    const clients = current.clients.filter((client: { tokenId: string }) => activeIds.has(client.tokenId) && client.tokenId !== token.id);
    clients.push({ tokenId: token.id, clientName: token.name || "E2E explicitly approved client", scopes: token.scopes, allowedTools: null, expiresAt: null });
    const response = await owner.put(`${projectEndpoint}/mcp-access`, { data: { ...current, enabled: true, clients } });
    // Another test can approve its distinct credential concurrently. Re-read the current revision
    // and merge only this test's grant; never replay a stale whole-policy write blindly.
    if (response.status() === 409) continue;
    expect(response.ok(), await response.text()).toBeTruthy();
    return;
  }
  throw new Error("MCP test fixture consent remained conflicted after ten current-revision attempts");
}

export async function issueMcpTestToken(owner: APIRequestContext, url: string, options: Parameters<APIRequestContext["post"]>[1]) {
  const parsed = new URL(url, "http://fixture.invalid");
  const match = /^\/api\/projects\/([^/]+)\/apikeys$/.exec(parsed.pathname);
  if (!match) throw new Error("MCP fixture requires a project token endpoint");
  const response = await owner.post(url, options);
  if (response.ok()) await approveMcpTestClient(owner, match[1], await response.json(),
    /^https?:\/\//.test(url) ? parsed.origin : "");
  return response;
}
