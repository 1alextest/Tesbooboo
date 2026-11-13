/** A bounded, cookie-free check against the existing project MCP endpoint, not a client certification. */
export const MCP_CHECK_TIMEOUT_MS = 10_000;

class CheckError extends Error {}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const malformed = () => new CheckError("Endpoint returned an unexpected MCP response. Check the configured API URL.");

export async function checkMcpConnection(
  endpoint: string,
  projectId: string,
  token: string,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<number> {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  const timeout = setTimeout(() => { timedOut = true; abort(); }, MCP_CHECK_TIMEOUT_MS);
  async function rpc(id: number, method: string, params?: Record<string, unknown>): Promise<Record<string, unknown>> {
    const response = await fetcher(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, ...(params ? { params } : {}) }),
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new CheckError(response.status === 401 || response.status === 403
        ? "Token was rejected or does not have access to this project."
        : `API endpoint returned HTTP ${response.status}. Check the configured API URL.`);
    }
    const body: unknown = await response.json();
    if (!object(body) || body.jsonrpc !== "2.0" || body.id !== id) throw malformed();
    // Tesbo returns JSON-RPC errors even with HTTP 201. Never echo remote text/credentials.
    if ("error" in body) {
      const code = object(body.error) ? body.error.code : undefined;
      throw new CheckError(code === -32001 ? "Token does not have access to this project."
        : code === -32002 ? "Read permission was not verified. Use a token with Read scope."
          : "MCP returned an error; the connection was not verified.");
    }
    if (!object(body.result)) throw malformed();
    return body.result;
  }
  try {
    const { tools } = await rpc(1, "tools/list");
    if (!Array.isArray(tools) || !tools.length || tools.some((tool) => !object(tool) || typeof tool.name !== "string" || !tool.name || !object(tool.inputSchema)) ||
      new Set(tools.map((tool) => tool.name)).size !== tools.length || !tools.some((tool) => tool.name === "list_projects")) throw malformed();
    // Discovery includes every tool regardless of scope. A genuine read verifies Read and project identity.
    const read = await rpc(2, "tools/call", { name: "list_projects", arguments: {} });
    if (read.isError === true) throw new CheckError("The project read failed; Read permission was not verified.");
    if (read.isError !== false || !Array.isArray(read.content) || read.content.length !== 1 || !object(read.content[0]) ||
      read.content[0].type !== "text" || typeof read.content[0].text !== "string") throw malformed();
    const data: unknown = JSON.parse(read.content[0].text);
    if (!object(data) || !Array.isArray(data.projects) || data.projects.length !== 1 || !object(data.projects[0]) || data.projects[0].id !== projectId) throw malformed();
    return tools.length;
  } catch (error) {
    if (timedOut) throw new CheckError("Connection check timed out after 10 seconds. Check API URL and network, then try again.");
    if (error instanceof CheckError) throw error;
    throw new CheckError("Connection could not be verified from this browser. Check API URL, network/CORS, redirects, and token; or run opencode mcp list.");
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", abort);
  }
}
