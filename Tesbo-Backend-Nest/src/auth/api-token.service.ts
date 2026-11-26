import { BadRequestException, ForbiddenException, Injectable, Logger } from "@nestjs/common";
import { createHash, randomBytes } from "crypto";
import { DatabaseService } from "../database/database.service";

/**
 * Result of authenticating a raw API token presented as a bearer credential.
 * Carries the identity/scope needed by the bearer auth path in AuthMiddleware
 * (and, later, by the MCP module) to attribute and authorize machine calls.
 */
export interface ApiTokenPrincipal {
  tokenId: string;
  userId: string | null;
  projectId: string | null;
  scopes: string[];
}

/** Public (never-secret) shape of a token row returned to API clients. */
export interface ApiTokenSummary {
  id: string;
  name: string;
  scopes: string[];
  tokenPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

/**
 * Shared current-generation predicate for a token row aliased as t.
 * The both-null branch is compatibility for pre-migration keys only; do not
 * infer their issuance generation from current membership. CL-D1 must be
 * resolved before claiming complete lifecycle enforcement or rollout.
 */
export const API_TOKEN_CURRENT_GENERATION_SQL = `(
  (t.project_membership_id IS NULL AND t.organization_membership_id IS NULL)
  OR EXISTS (
    SELECT 1 FROM projects gp
    JOIN project_members pm ON pm.project_id = gp.id AND pm.user_id = t.user_id
      AND pm.id = t.project_membership_id
    JOIN organization_members om ON om.organization_id = gp.organization_id
      AND om.user_id = t.user_id AND om.id = t.organization_membership_id
    WHERE gp.id = t.project_id AND gp.archived_at IS NULL
  )
)`;

const TOKEN_PREFIX = "tsbo_";
const RAW_TOKEN_BYTES = 24;
const VALID_SCOPES = new Set(["read", "write"]);

/**
 * One parser for API-token scopes, shared by issuance and the project role gate.
 *
 * Existing UI sends explicit selections. Missing input is read-only; invalid or empty selections
 * must never silently grant write access, and an unknown value must be rejected rather than
 * dropped into a token with broader scope than the caller asked for.
 */
export function normalizeApiTokenScopes(input: unknown): string[] {
  if (input === undefined || input === null) return ["read"];
  if (!Array.isArray(input) && typeof input !== "string") {
    throw new BadRequestException({ error: "scopes must be an array or comma-separated string" });
  }
  const requested = Array.isArray(input)
    ? input.map((s) => (typeof s === "string" ? s.trim().toLowerCase() : ""))
    : input.split(",").map((s) => s.trim().toLowerCase());
  if (!requested.length || requested.some((s) => !VALID_SCOPES.has(s))) {
    throw new BadRequestException({ error: "scopes must contain only read and/or write" });
  }
  return Array.from(new Set(requested));
}

/**
 * Issues, lists, revokes and validates project-scoped API tokens.
 *
 * Storage model (migrations/V5_api_tokens_webhooks.sql): only a SHA-256 hash of
 * the token is ever persisted (token_hash, 64 hex chars). The raw token is
 * returned exactly once at creation time and is otherwise unrecoverable.
 *
 * This is the auth foundation the "Tesbo MCP" card builds on: the MCP module
 * (next slice) will consume ApiTokenPrincipal to authenticate machine clients
 * and attribute their writes to a dedicated actor.
 */
@Injectable()
export class ApiTokenService {
  private readonly logger = new Logger(ApiTokenService.name);

  constructor(private readonly db: DatabaseService) {}

  /** Deterministic one-way hash used for both storage and lookup. */
  hashToken(rawToken: string): string {
    return createHash("sha256").update(rawToken, "utf8").digest("hex");
  }

  /** Generates a fresh, prefixed, high-entropy raw token. */
  generateRawToken(): string {
    return TOKEN_PREFIX + randomBytes(RAW_TOKEN_BYTES).toString("hex");
  }

  /**
   * Whether the token exists in this project and who issued it. `userId` is nullable: a legacy
   * token can outlive its issuer (user_id REFERENCES users ON DELETE CASCADE, but older rows were
   * created before the issuer was always recorded). Existence and issuer are separate answers so a
   * null issuer is not mistaken for "token not found".
   */
  async issuerOf(projectId: string, tokenId: string): Promise<{ exists: boolean; userId: string | null }> {
    const res = await this.db.query("SELECT user_id FROM api_tokens WHERE id = $1 AND project_id = $2", [tokenId, projectId]);
    const row = res.rows[0] as { user_id: string | null } | undefined;
    return { exists: Boolean(row), userId: row?.user_id ?? null };
  }

  private toSummary(row: {
    id: string;
    name: string;
    scopes: string | null;
    token_hash: string;
    last_used_at: string | null;
    created_at: string;
  }): ApiTokenSummary {
    return {
      id: row.id,
      name: row.name,
      scopes: (row.scopes || "").split(",").map((s) => s.trim()).filter(Boolean),
      // A stable, non-reversible hint so UIs can distinguish tokens without the secret.
      tokenPrefix: `${TOKEN_PREFIX}…${row.token_hash.slice(-6)}`,
      lastUsedAt: row.last_used_at,
      createdAt: row.created_at
    };
  }

  async listTokens(projectId: string): Promise<ApiTokenSummary[]> {
    const res = await this.db.query(
      `SELECT id, name, scopes, token_hash, last_used_at, created_at
       FROM api_tokens WHERE project_id = $1 ORDER BY created_at DESC`,
      [projectId]
    );
    return res.rows.map((row) => this.toSummary(row as never));
  }

  /**
   * Creates a token for a project. Returns the summary plus the raw `token`,
   * which is shown to the caller exactly once and never stored in plaintext.
   */
  async issueToken(
    userId: string | null,
    projectId: string,
    name: string,
    scopesInput?: unknown
  ): Promise<ApiTokenSummary & { token: string }> {
    const scopes = normalizeApiTokenScopes(scopesInput).join(",");
    const rawToken = this.generateRawToken();
    const tokenHash = this.hashToken(rawToken);
    const res = await this.db.query(
       `INSERT INTO api_tokens (user_id, project_id, name, token_hash, scopes,
          project_membership_id, organization_membership_id)
       SELECT $1, $2, $3, $4, $5::text, pm.id, om.id
         FROM projects p
         JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $1
         JOIN organization_members om ON om.organization_id = p.organization_id AND om.user_id = $1
        WHERE p.id = $2 AND p.archived_at IS NULL
          AND (NOT ('write' = ANY(string_to_array($5::text, ',')))
            OR replace(replace(lower(btrim(pm.role::text)), '-', '_'), ' ', '_')
              IN ('owner', 'manager', 'admin', 'test_manager'))
        FOR SHARE OF p, pm, om
       RETURNING id, name, scopes, token_hash, last_used_at, created_at`,
      [userId, projectId, name, tokenHash, scopes]
    );
    if (!res.rows[0]) {
      // The locked SELECT rechecks the current project role after a concurrent update.
      // Never return a write credential when membership or issuance authority vanished.
      if (scopes.split(",").includes("write")) {
        throw new ForbiddenException({ error: "Current project owner or manager authority is required to issue a write-scoped credential" });
      }
      throw new BadRequestException({ error: "Current project membership is required to issue a credential" });
    }
    return { ...this.toSummary(res.rows[0] as never), token: rawToken };
  }

  /** Deletes a token belonging to the given project. Returns whether a row was removed. */
  async revokeToken(projectId: string, tokenId: string): Promise<boolean> {
    const res = await this.db.query(
      `DELETE FROM api_tokens WHERE id = $1 AND project_id = $2`,
      [tokenId, projectId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Validates a raw bearer token. On success returns the principal and
   * records last_used_at; returns null for any unknown/blank token.
   */
  async authenticate(rawToken: string | null | undefined): Promise<ApiTokenPrincipal | null> {
    const token = String(rawToken ?? "").trim();
    if (!token) return null;
    const tokenHash = this.hashToken(token);
    const res = await this.db.query(
       `SELECT t.id, t.user_id, t.project_id, t.scopes FROM api_tokens t
        WHERE t.token_hash = $1 AND ${API_TOKEN_CURRENT_GENERATION_SQL} LIMIT 1`,
      [tokenHash]
    );
    const row = res.rows[0] as
      | { id: string; user_id: string | null; project_id: string | null; scopes: string | null }
      | undefined;
    if (!row) return null;
    // Best-effort usage stamp; never block auth on the update.
    this.db
      .query(`UPDATE api_tokens SET last_used_at = now() WHERE id = $1`, [row.id])
      .catch((err) => this.logger.warn(`Failed to update last_used_at for token ${row.id}: ${err}`));
    return {
      tokenId: row.id,
      userId: row.user_id,
      projectId: row.project_id,
      scopes: (row.scopes || "").split(",").map((s) => s.trim()).filter(Boolean)
    };
  }
}
