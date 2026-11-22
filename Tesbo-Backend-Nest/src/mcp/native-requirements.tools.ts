import { HttpException } from "@nestjs/common";
import { requireNativeRequirementsPreview } from "../native-requirements/native-requirements.core";
import { McpError, RpcCode, type McpTool, type McpToolContext } from "./mcp.types";

const uuid = { type: "string", format: "uuid" };
const digest = { type: "string", pattern: "^[a-f0-9]{64}$" };
const criterionKey = { type: "string", pattern: "^[A-Za-z][A-Za-z0-9_.-]{0,63}$" };
const requirementId = { ...uuid, description: "Shared proposal task UUID returned by list_requirements or create_requirement; not a published Knowledge Base document ID." };
const content = {
  title: { type: "string", minLength: 1, maxLength: 512 },
  description: { type: "string", maxLength: 20000 },
  criteria: { type: "array", minItems: 1, maxItems: 100, items: {
    type: "object", additionalProperties: false, required: ["key", "text"],
    properties: { key: criterionKey, text: { type: "string", minLength: 1, maxLength: 4000 } }
  } },
  rationale: { type: "string", maxLength: 4000 },
  sourceRefs: { type: "array", maxItems: 50, description: "Attributable source citations, not approved requirement or execution evidence.", items: {
    type: "object", additionalProperties: false, required: ["label", "url"], properties: {
      label: { type: "string", minLength: 1, maxLength: 200 },
      url: { type: "string", minLength: 1, maxLength: 2048, pattern: "^[Hh][Tt][Tt][Pp][Ss]?://", description: "Absolute HTTP(S) URL without embedded credentials or backslashes. The domain owner stores its canonical URL representation." }
    }
  } }
};
const proposalOperationId = { ...uuid, description: "Immutable staged requirement operation UUID, not a Knowledge Base version ID." };
const currentHead = { expectedVersionId: proposalOperationId, expectedContentDigest: digest };
const basis = {
  requirementVersionId: proposalOperationId,
  requirementContentDigest: digest,
  criterionKeys: { type: "array", minItems: 1, maxItems: 100, uniqueItems: true, items: criterionKey }
};

function principal(ctx: McpToolContext) {
  if (!ctx.tokenId || !ctx.userId) throw new McpError(RpcCode.ProjectScopeDenied, "An authenticated project credential is required");
  if (!ctx.actorId) throw new McpError(RpcCode.ToolExecutionError,
    "The MCP agent identity is unavailable; no requirement proposal was changed", { code: "AGENT_IDENTITY_UNAVAILABLE" });
  return { kind: "api_token" as const, transport: "mcp" as const, tokenId: ctx.tokenId, actorId: ctx.actorId };
}

function id(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)) {
    throw new McpError(RpcCode.InvalidParams, `${key} must be a UUID`);
  }
  return value;
}

function withoutIds(args: Record<string, unknown>): Record<string, unknown> {
  const { requirementId: _requirementId, linkId: _linkId, ...body } = args;
  return body;
}

/** Keep cached calls and discovery subject to the same server-owned availability gate. */
export function assertNativeRequirementToolAvailable(): void {
  try { requireNativeRequirementsPreview(); } catch (error) {
    if (error instanceof HttpException) {
      const response = error.getResponse() as Record<string, unknown>;
      throw new McpError(RpcCode.ToolExecutionError, String(response.error || error.message), {
        httpStatus: error.getStatus(), code: response.code, reason: response.reason
      });
    }
    throw error;
  }
}

/** These adapters own no requirement state or governance rule. Both transports use Legacy's
 * narrow facades and the same repository. Caller identity and project never come from arguments.
 * The testcase-operation vocabulary/normalizer are the existing staging adapter's own values.
 */
export function buildNativeRequirementTools(
  operationsSchema: Record<string, unknown>,
  normalizeOperations: (value: unknown) => unknown
): McpTool[] {
  const tools: McpTool[] = [
    {
      name: "list_requirements", requiredScope: "read",
      description: "List this project's unpublished native requirement proposals and capability limits. No external tracker connection is needed. These are proposals, not approved normative requirements; provider mirrors remain separate. Pagination uses limit/offset; includeRetired exposes retained history.",
      inputSchema: { type: "object", additionalProperties: false, properties: {
        limit: { type: "integer", minimum: 1, maximum: 100 }, offset: { type: "integer", minimum: 0 }, includeRetired: { type: "boolean" }
      } },
      handler: (args, ctx) => ctx.legacy.listNativeRequirements(ctx.projectId, ctx.userId, args)
    },
    {
      name: "get_requirement", requiredScope: "read",
      description: "Read an unpublished native requirement proposal, its immutable staged operation history, exact proposed case associations and shared review task. IDs explicitly identify proposal tasks/operations; nativeDocumentId and nativeVersionId remain null. Approval is blocked while effective skill authority is unavailable. Execution/passing applicability is unavailable; historical case results do not certify this requirement.",
      inputSchema: { type: "object", additionalProperties: false, required: ["requirementId"], properties: { requirementId } },
      handler: (args, ctx) => ctx.legacy.getNativeRequirement(ctx.projectId, ctx.userId, id(args, "requirementId"))
    },
    {
      name: "create_requirement", requiredScope: "write",
      description: "Stage a requirement candidate with immutable acceptance criteria, rationale and source citations in the existing shared proposal task. Supply a new UUID submissionKey; retry only the identical request with the same key after an uncertain response. Returns a provisional REQ-PROP key, proposal task/operation identities and unavailable skill context. No Knowledge Base document or version is created. This does not publish or approve a requirement or testcase.",
      inputSchema: { type: "object", additionalProperties: false, required: ["submissionKey", "title", "criteria"], properties: { submissionKey: uuid, ...content } },
      handler: (args, ctx) => ctx.legacy.createNativeRequirement(ctx.projectId, ctx.userId, args, principal(ctx))
    },
    {
      name: "add_requirement_revision", requiredScope: "write",
      description: "Append an immutable requirement candidate iteration to the same shared proposal task. Send its current expectedVersionId and expectedContentDigest, a new UUID submissionKey and the full replacement content. A stale basis is refused; preserve your draft and inspect the current version before resolving it. Earlier versions and associations remain historical.",
      inputSchema: { type: "object", additionalProperties: false,
        required: ["requirementId", "submissionKey", "expectedVersionId", "expectedContentDigest", "title", "criteria"],
        properties: { requirementId, submissionKey: uuid, ...currentHead, ...content } },
      handler: (args, ctx) => ctx.legacy.addNativeRequirementRevision(ctx.projectId, ctx.userId, id(args, "requirementId"), withoutIds(args), principal(ctx))
    },
    {
      name: "link_requirement_case", requiredScope: "write",
      description: "Stage an inert criterion-to-case link intent in the same shared proposal task using a new UUID submissionKey. Retry only the identical submission: recovery returns its original association even if later retired or stale. A deliberate new association needs a new key. Pin the requirement version/digest, criterion keys and current get_testcase editRevision plus approvalRevision (explicit null when absent). This does not edit or approve the case, publish the requirement, or grant execution coverage.",
      inputSchema: { type: "object", additionalProperties: false,
        required: ["requirementId", "submissionKey", "requirementVersionId", "requirementContentDigest", "criterionKeys", "testcaseId", "testcaseRevision", "testcaseApprovalRevision"],
        properties: { requirementId, submissionKey: uuid, ...basis, testcaseId: uuid, testcaseRevision: digest,
          testcaseApprovalRevision: { anyOf: [digest, { type: "null" }] } } },
      handler: (args, ctx) => ctx.legacy.linkNativeRequirementCase(ctx.projectId, ctx.userId, id(args, "requirementId"), withoutIds(args), principal(ctx))
    },
    {
      name: "retire_requirement_case_link", requiredScope: "write",
      description: "Retire a proposed case association while preserving its exact historical basis. Repeating retirement is safe. This does not archive a testcase or change its results.",
      inputSchema: { type: "object", additionalProperties: false, required: ["requirementId", "linkId"], properties: { requirementId, linkId: uuid } },
      handler: (args, ctx) => ctx.legacy.retireNativeRequirementCaseLink(ctx.projectId, ctx.userId, id(args, "requirementId"), id(args, "linkId"), principal(ctx))
    },
    {
      name: "retire_requirement", requiredScope: "write",
      description: "Retire an unpublished requirement proposal using the exact current version/digest. History, associations and staged tasks remain readable. Retirement does not delete or approve official cases, executions or provider requirements.",
      inputSchema: { type: "object", additionalProperties: false, required: ["requirementId", "expectedVersionId", "expectedContentDigest"],
        properties: { requirementId, ...currentHead } },
      handler: (args, ctx) => ctx.legacy.retireNativeRequirement(ctx.projectId, ctx.userId, id(args, "requirementId"), withoutIds(args), principal(ctx))
    },
    {
      name: "get_requirement_coverage", requiredScope: "read",
      description: "Read proposed association counts and explicit stale reasons for a native requirement proposal. Approval remains blocked (eligibleCount 0). Execution/passing applicability is unavailable (eligibleCount null), never inferred from old case results or a new link. These are separate facts, not a claim of governed coverage.",
      inputSchema: { type: "object", additionalProperties: false, required: ["requirementId"], properties: { requirementId } },
      handler: (args, ctx) => ctx.legacy.getNativeRequirementCoverage(ctx.projectId, ctx.userId, id(args, "requirementId"))
    },
    {
      name: "stage_requirement_testcase_changes", requiredScope: "write", proposalPreviewOnly: true,
      description: "Stage create/update/archive testcase candidates against an exact requirement candidate operation/digest and criterion set in the SAME shared Tesbo review task. The returned taskId equals requirementId; no second task or official requirement is allocated. Requires both advertised proposal capabilities. Uses the same operation fields and requestKey rules as stage_testcase_changes. The server pins immutable unavailable skill context: human and machine Save calls fail with SKILL_CONTEXT_UNAVAILABLE until an authorized effective-skill policy is implemented. No official cases, approvals or execution coverage are created.",
      inputSchema: { type: "object", additionalProperties: false,
        required: ["requirementId", "requirementVersionId", "requirementContentDigest", "criterionKeys", "requestKey", "operations"],
        properties: { requirementId, ...basis, requestKey: { type: "string", minLength: 1, maxLength: 160 }, title: { type: "string", minLength: 1, maxLength: 512 }, operations: operationsSchema } },
      handler: (args, ctx) => ctx.legacy.stageNativeRequirementTestcaseChanges(ctx.projectId, ctx.userId, id(args, "requirementId"),
        { ...withoutIds(args), operations: normalizeOperations(args.operations) }, principal(ctx))
    }
  ];
  return tools.map(tool => ({
    ...tool, nativeRequirementsPreviewOnly: true,
    handler: async (args, ctx) => {
      try {
        assertNativeRequirementToolAvailable();
        const properties = tool.inputSchema.properties as Record<string, unknown>;
        if (Object.keys(args).some(key => !Object.prototype.hasOwnProperty.call(properties, key))) {
          throw new McpError(RpcCode.InvalidParams,
            "Only the advertised proposal fields are accepted; project, principal and governance are server-owned");
        }
        return await tool.handler(args, ctx);
      } catch (error) {
        if (error instanceof HttpException) {
          const response = error.getResponse();
          const details = response && typeof response === "object" ? response as Record<string, unknown> : {};
          throw new McpError(RpcCode.ToolExecutionError, String(details.error || details.message || error.message), {
            httpStatus: error.getStatus(), ...(details.code ? { code: details.code } : {}), ...(details.reason ? { reason: details.reason } : {})
          });
        }
        throw error;
      }
    }
  }));
}
