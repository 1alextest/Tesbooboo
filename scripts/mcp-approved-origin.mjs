/**
 * Local token-to-origin binding for privileged MCP probes.
 *
 * The HTTPS endpoint is a runtime parameter, but it must match a separately
 * operator-approved origin stored beside the token in "tesbo-approved-origin".
 * On POSIX neither file can be symlinked, group/world accessible, or owned by
 * a different principal. An arbitrary copied URL must never receive the token.
 *
 * Windows callers must additionally protect these two files using Windows ACLs;
 * POSIX ownership/mode checks are not a substitute for native Windows ACLs.
 */
import { lstatSync, readFileSync } from "node:fs";
import path from "node:path";

function privateRegularFile(file, label) {
  let stat;
  try { stat = lstatSync(file); } catch { throw new Error(`${label} unavailable`); }
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`${label} must be a regular file, not a link`);
  if (process.platform !== "win32") {
    if ((stat.mode & 0o077) !== 0) throw new Error(`${label} must be private (chmod 600)`);
    if (typeof process.getuid === "function" && stat.uid !== process.getuid()) {
      throw new Error(`${label} must be owned by the current user`);
    }
  }
}

export function requireApprovedMcpEndpoint(rawUrl, tokenFile) {
  if (typeof rawUrl !== "string" || typeof tokenFile !== "string" || !tokenFile.trim()) {
    throw new Error("MCP endpoint or token file is missing");
  }
  let endpoint;
  try {
    endpoint = new URL(rawUrl);
    if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password ||
        endpoint.hash || endpoint.search ||
        !/^\/api\/projects\/[^/]+\/mcp\/?$/.test(endpoint.pathname)) {
      throw new Error("invalid endpoint");
    }
  } catch {
    throw new Error("MCP endpoint must be HTTPS and project-scoped without embedded credentials");
  }
  privateRegularFile(tokenFile, "MCP credential file");
  const approvedOriginFile = path.join(path.dirname(tokenFile), "tesbo-approved-origin");
  privateRegularFile(approvedOriginFile, "MCP approved-origin file");
  let approved;
  try {
    approved = readFileSync(approvedOriginFile, "utf8").trim();
    const authority = new URL(approved);
    if (authority.protocol !== "https:" || authority.username || authority.password ||
        authority.search || authority.hash || authority.origin !== approved) {
      throw new Error("invalid approved-origin");
    }
  } catch {
    throw new Error("MCP approved-origin file must contain one exact HTTPS origin");
  }
  if (endpoint.origin !== approved) {
    throw new Error("MCP endpoint origin differs from the private approved-origin file");
  }
  return endpoint;
}

/** Read the bearer from the same private file whose origin policy was checked. */
export function readApprovedMcpCredential(rawUrl, tokenFile) {
  const endpoint = requireApprovedMcpEndpoint(rawUrl, tokenFile);
  let token;
  try {
    token = readFileSync(tokenFile, "utf8").trim();
  } catch {
    throw new Error("MCP credential file is unreadable");
  }
  if (!token) throw new Error("MCP credential file is empty");
  // RFC 6750 section 2.1 bearer syntax. In particular, reject control characters
  // before native header validation can include the credential in an exception.
  if (!/^[A-Za-z0-9._~+\/-]+=*$/.test(token)) {
    throw new Error("MCP credential file contains an invalid bearer value");
  }
  return { endpoint, token };
}
