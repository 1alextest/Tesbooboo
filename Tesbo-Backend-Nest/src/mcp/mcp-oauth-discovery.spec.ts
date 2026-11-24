import { NotFoundException, UnauthorizedException } from "@nestjs/common";
import type { Response } from "express";
import type { AuthenticatedRequest } from "../common/request.types";
import { McpController } from "./mcp.controller";
import { McpService } from "./mcp.service";
import {
  mcpOAuthDiscoveryPolicy,
  mcpOAuthResource,
  mcpOAuthProtectedResourceMetadata,
  mcpOAuthProtectedResourceMetadataUri,
  mcpOAuthUnauthorizedChallenge
} from "./mcp-oauth-discovery";

const PROJECT = "11111111-1111-4111-8111-111111111111";
const RESOURCE = `https://tesbo.example/api/projects/${PROJECT}/mcp`;
const META = `https://tesbo.example/.well-known/oauth-protected-resource/api/projects/${PROJECT}/mcp`;
const env = {
  TESBO_MCP_OAUTH_DISCOVERY_PREVIEW: "true",
  TESBO_MCP_OAUTH_ISSUER: "https://tesbo-auth.example/oidc",
  TESBO_MCP_OAUTH_RESOURCE_ORIGIN: "https://tesbo.example"
};

describe("Tesbo MCP OAuth resource metadata — preview OFF by default", () => {
  const original = {
    TESBO_MCP_OAUTH_DISCOVERY_PREVIEW: process.env.TESBO_MCP_OAUTH_DISCOVERY_PREVIEW,
    TESBO_MCP_OAUTH_ISSUER: process.env.TESBO_MCP_OAUTH_ISSUER,
    TESBO_MCP_OAUTH_RESOURCE_ORIGIN: process.env.TESBO_MCP_OAUTH_RESOURCE_ORIGIN
  };
  afterEach(() => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("does not advertise OAuth for absent, false, or misleading enablement settings", () => {
    for (const value of [undefined, "", "false", "TRUE", "1", "yes"]) {
      const config = mcpOAuthDiscoveryPolicy({ ...env, TESBO_MCP_OAUTH_DISCOVERY_PREVIEW: value } as NodeJS.ProcessEnv);
      expect(config).toBeNull();
    }
  });

  it("constructs the exact project-scoped RFC 9728 discovery and bearer challenge", () => {
    const policy = mcpOAuthDiscoveryPolicy(env as NodeJS.ProcessEnv);
    expect(policy).not.toBeNull();
    expect(mcpOAuthResource(policy!, PROJECT)).toBe(RESOURCE);
    expect(mcpOAuthProtectedResourceMetadataUri(policy!, PROJECT)).toBe(META);
    expect(mcpOAuthProtectedResourceMetadata(policy!, PROJECT)).toEqual({
      resource: RESOURCE,
      authorization_servers: ["https://tesbo-auth.example/oidc"],
      scopes_supported: ["mcp:read"],
      bearer_methods_supported: ["header"],
      resource_documentation: RESOURCE
    });
    expect(mcpOAuthUnauthorizedChallenge(policy!, PROJECT)).toBe(
      `Bearer resource_metadata="${META}", scope="mcp:read"`
    );
  });

  it.each([
    ["http://tesbo-auth.example", "https://tesbo.example"],
    ["https://user:pass@tesbo-auth.example", "https://tesbo.example"],
    ["https://tesbo-auth.example/oidc?client=x", "https://tesbo.example"],
    ["https://tesbo-auth.example/oidc#fragment", "https://tesbo.example"],
    ["https://tesbo-auth.example:8443/oidc", "https://tesbo.example"],
    ["https://tesbo-auth.example/oidc/", "https://tesbo.example"],
    ["https://tesbo-auth.example/oidc", "http://tesbo.example"],
    ["https://tesbo-auth.example/oidc", "https://tesbo.example/path"],
    ["https://tesbo-auth.example/oidc", "https://localhost"],
    ["https://tesbo-auth.example/oidc", "https://tesbo.example/"]
  ])("fails closed on a noncanonical issuer %s or resource origin %s", (issuer, origin) => {
    expect(() => mcpOAuthDiscoveryPolicy({
      ...env,
      TESBO_MCP_OAUTH_ISSUER: issuer,
      TESBO_MCP_OAUTH_RESOURCE_ORIGIN: origin
    } as NodeJS.ProcessEnv)).toThrow();
  });

  it.each([
    "00000000-0000-0000-0000-000000000000/",
    "../admin",
    "11111111-1111-4111-8111-111111111111?code=secret",
    "11111111-1111-4111-8111-11111111111X",
    "11111111-1111-4111-8111-11111111111",
    ""
  ])("rejects ambiguous or malformed project resource %s without reflecting it", projectId => {
    const policy = mcpOAuthDiscoveryPolicy(env as NodeJS.ProcessEnv)!;
    expect(() => mcpOAuthResource(policy, projectId)).toThrow();
    expect(() => mcpOAuthUnauthorizedChallenge(policy, projectId)).toThrow();
  });

  it("serves a preview only when explicitly enabled; no OAuth principal or token is accepted", async () => {
    const ctrl = new McpController({} as McpService);
    delete process.env.TESBO_MCP_OAUTH_DISCOVERY_PREVIEW;
    expect(() => ctrl.protectedResourceMetadata(PROJECT)).toThrow(NotFoundException);
    Object.assign(process.env, env);
    expect(ctrl.protectedResourceMetadata(PROJECT).authorization_servers).toEqual(["https://tesbo-auth.example/oidc"]);
    expect(() => ctrl.protectedResourceMetadata("forged")).toThrow(NotFoundException);
    const req = { apiToken: null, userId: "browser-user" } as AuthenticatedRequest;
    const setHeader = jest.fn();
    const res = { setHeader } as unknown as Response;
    await expect(ctrl.handle(req, res, PROJECT, {})).rejects.toThrow(UnauthorizedException);
    expect(setHeader).toHaveBeenCalledWith(
      "WWW-Authenticate", `Bearer resource_metadata="${META}", scope="mcp:read"`
    );
  });

  it("never sends a project-specific OAuth challenge from shared /api/mcp", async () => {
    Object.assign(process.env, env);
    const ctrl = new McpController({} as McpService);
    const setHeader = jest.fn();
    await expect(ctrl.handleForToken({ apiToken: null } as AuthenticatedRequest,
      { setHeader } as unknown as Response, {})).rejects.toThrow(UnauthorizedException);
    expect(setHeader).not.toHaveBeenCalled();
  });
});
