import { randomBytes } from "node:crypto";
import { allowedChatGptCimdClientId, McpOAuthServer } from "./mcp-oauth-server";
import { DatabaseService } from "../database/database.service";

describe("Tesbo in-process OAuth issuer — default OFF, registered clients and CIMD boundaries", () => {
  const tracked = [
    "TESBO_MCP_OAUTH_ENABLED", "TESBO_MCP_OAUTH_DISCOVERY_PREVIEW",
    "TESBO_MCP_OAUTH_RESOURCE_ORIGIN", "TESBO_MCP_OAUTH_ISSUER",
    "TESBO_MCP_OAUTH_PRIVATE_JWKS", "TESBO_MCP_OAUTH_REGISTERED_CLIENTS",
    "TESBO_MCP_OAUTH_COOKIE_KEYS_JSON", "TESBO_MCP_OAUTH_CIMD_ENABLED"
  ] as const;
  const snapshot = Object.fromEntries(tracked.map(key => [key, process.env[key]]));
  afterEach(() => {
    for (const key of tracked) {
      const value = snapshot[key];
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });

  const fakeDb = { query: jest.fn() } as unknown as DatabaseService;
  const fakeApp = { getHttpAdapter: jest.fn() } as any;

  it("does not import or mount an issuer, call DB or issue tokens when OAuth is disabled", async () => {
    delete process.env.TESBO_MCP_OAUTH_ENABLED;
    const oauth = new McpOAuthServer(fakeDb);
    await expect(oauth.mount(fakeApp)).resolves.toBeUndefined();
    expect(oauth.enabled).toBe(false);
    expect(fakeApp.getHttpAdapter).not.toHaveBeenCalled();
    expect(fakeDb.query).not.toHaveBeenCalled();
    expect(await oauth.verifyAccessToken("forged")).toBeNull();
  });

  it("refuses to enable with unapproved HTTP issuer or missing signing/client keys", async () => {
    process.env.TESBO_MCP_OAUTH_ENABLED = "true";
    process.env.TESBO_MCP_OAUTH_ISSUER = "http://bad.example/oauth";
    process.env.TESBO_MCP_OAUTH_RESOURCE_ORIGIN = "https://tesbo.example";
    const a = new McpOAuthServer(fakeDb);
    await expect(a.mount(fakeApp)).rejects.toThrow(/HTTPS|canonical/);
    expect(a.enabled).toBe(false);
    expect(fakeApp.getHttpAdapter).not.toHaveBeenCalled();
    process.env.TESBO_MCP_OAUTH_ISSUER = "https://tesbo.example/oauth";
    delete process.env.TESBO_MCP_OAUTH_PRIVATE_JWKS;
    await expect(a.mount(fakeApp)).rejects.toThrow(/PRIVATE_JWKS/);
    expect(a.enabled).toBe(false);
  });

  it.each([
    "https://chatgpt.com/oauth/client.json",
    "https://chatgpt.com/oauth/af4b0bfe_123/client.json",
    "https://chatgpt.com/oauth/codex/client.json",
    "https://chatgpt.com/oauth/codex/conn-123/client.json"
  ])("permits documented ChatGPT CIMD identifier shape %s, not blanket host trust", url => {
    expect(allowedChatGptCimdClientId(url)).toBe(true);
  });

  it.each([
    "https://evil.example/oauth/client.json",
    "http://chatgpt.com/oauth/client.json",
    "https://chatgpt.com/../oauth/client.json",
    "https://chatgpt.com/oauth/admin/secrets/client.json",
    "https://chatgpt.com/oauth/client.json?callback=evil",
    "https://chatgpt.com/oauth/client.json#fragment",
    "https://user@chatgpt.com/oauth/client.json",
    "https://chatgpt.com:8443/oauth/client.json",
    "https://chatgpt.com.evil.example/oauth/client.json",
    "https://127.0.0.1/oauth/client.json",
    "https://169.254.169.254/oauth/client.json",
    "https://chatgpt.com/oauth/%2e%2e/client.json"
  ])("denies untrusted CIMD client metadata source %s", url => {
    expect(allowedChatGptCimdClientId(url)).toBe(false);
  });

  it("keeps private signing key configuration mandatory even when CIMD is enabled", async () => {
    process.env.TESBO_MCP_OAUTH_ENABLED = "true";
    process.env.TESBO_MCP_OAUTH_RESOURCE_ORIGIN = "https://tesbo.example";
    process.env.TESBO_MCP_OAUTH_ISSUER = "https://tesbo.example/oauth";
    process.env.TESBO_MCP_OAUTH_CIMD_ENABLED = "true";
    delete process.env.TESBO_MCP_OAUTH_PRIVATE_JWKS;
    const oauth = new McpOAuthServer(fakeDb);
    await expect(oauth.mount(fakeApp)).rejects.toThrow(/PRIVATE_JWKS/);
    expect(oauth.enabled).toBe(false);
  });
});
