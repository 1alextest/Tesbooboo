import type { DatabaseService } from "../database/database.service";
import { decryptSecret, encryptSecret, oauthReferenceFingerprint } from "../common/crypto.util";

/**
 * Feature-OFF persistence adapter for a future vetted authorization server.
 *
 * Implements the oidc-provider v9 adapter API without importing the ESM
 * provider into Tesbo's CommonJS production build. Instantiation is inert:
 * no controller, token issuer or OAuth verifier is registered by this module.
 * Existing Tesbo accounts, browser sessions and MCP owner-managed grants are
 * not stored or represented here.
 */
export type ProviderRecord = Record<string, unknown>;
type StoredRow = { encrypted_payload: string; consumed_at: Date | string | null };

const MAX_PAYLOAD_BYTES = 256 * 1024;
const TOKEN_MODELS = new Set([
  "AccessToken", "AuthorizationCode", "RefreshToken", "ClientCredentials",
  "InitialAccessToken", "RegistrationAccessToken", "DeviceCode", "Interaction",
  "Session", "ReplayDetection", "BackchannelAuthenticationRequest",
  "PreAuthorizedCode", "PushedAuthorizationRequest"
]);

function optionalReference(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !value || Buffer.byteLength(value, "utf8") > 8192) {
    throw new Error("Invalid OAuth adapter reference");
  }
  return value;
}

function validatedPayload(value: unknown): ProviderRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid OAuth provider state");
  }
  return value as ProviderRecord;
}

function expiresAt(model: string, lifetimeSeconds?: number): string | null {
  if (lifetimeSeconds === undefined || lifetimeSeconds === null) {
    // A server's long-lived client and grant registrations need explicit
    // revocation; bearer and ephemeral protocol credentials may not be eternal.
    if (TOKEN_MODELS.has(model)) throw new Error("OAuth temporary state needs an expiration");
    return null;
  }
  if (!Number.isSafeInteger(lifetimeSeconds) || lifetimeSeconds < 0) {
    throw new Error("Invalid OAuth provider expiration");
  }
  const limit = Date.now() + lifetimeSeconds * 1000;
  if (!Number.isFinite(limit) || limit > 8.64e15) throw new Error("Invalid OAuth provider expiration");
  return new Date(limit).toISOString();
}

export function createMcpOAuthPostgresAdapter(db: Pick<DatabaseService, "query">) {
  return class McpOAuthPostgresAdapter {
    private readonly model: string;

    constructor(model: string) {
      if (typeof model !== "string" || !/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(model)) {
        throw new Error("Invalid OAuth adapter model");
      }
      this.model = model;
    }

    private fingerprint(key: "id" | "grant" | "uid" | "user-code", value: string): string {
      return oauthReferenceFingerprint(`oauth:${this.model}:${key}`, value);
    }

    private async read(where: string, value: string): Promise<ProviderRecord | undefined> {
      const row = (await db.query<StoredRow>(
        `SELECT encrypted_payload, consumed_at FROM mcp_oauth_provider_artifacts
         WHERE model=$1 AND ${where}=$2 AND (expires_at IS NULL OR expires_at > now())
         LIMIT 1`,
        [this.model, this.fingerprint(where === "id_fingerprint" ? "id" :
          where === "uid_fingerprint" ? "uid" : "user-code", value)]
      )).rows[0];
      if (!row) return undefined;
      const payload = validatedPayload(JSON.parse(decryptSecret(row.encrypted_payload)) as unknown);
      return row.consumed_at ? { ...payload, consumed: Math.trunc(new Date(row.consumed_at).getTime() / 1000) } : payload;
    }

    async upsert(id: string, input: ProviderRecord, expiresIn?: number): Promise<void> {
      const ref = optionalReference(id);
      if (!ref) throw new Error("Missing OAuth adapter reference");
      const payload = validatedPayload(input);
      const serialized = JSON.stringify(payload);
      if (Buffer.byteLength(serialized, "utf8") > MAX_PAYLOAD_BYTES) {
        throw new Error("OAuth provider state exceeds storage limit");
      }
      const until = expiresAt(this.model, expiresIn);
      const grant = optionalReference(payload.grantId);
      const uid = optionalReference(payload.uid);
      const code = optionalReference(payload.userCode);
      const insert = `INSERT INTO mcp_oauth_provider_artifacts
        (model,id_fingerprint,encrypted_payload,expires_at,grant_fingerprint,uid_fingerprint,user_code_fingerprint)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (model,id_fingerprint) DO UPDATE SET
          encrypted_payload=EXCLUDED.encrypted_payload,
          expires_at=EXCLUDED.expires_at,
          grant_fingerprint=EXCLUDED.grant_fingerprint,
          uid_fingerprint=EXCLUDED.uid_fingerprint,
          user_code_fingerprint=EXCLUDED.user_code_fingerprint,
          consumed_at=NULL,
          updated_at=now()
        WHERE ${this.model === "ReplayDetection"
          ? "mcp_oauth_provider_artifacts.expires_at <= now()"
          : "(mcp_oauth_provider_artifacts.consumed_at IS NULL OR mcp_oauth_provider_artifacts.expires_at <= now())"}
        RETURNING id_fingerprint`;
      const result = await db.query(insert, [
        this.model, this.fingerprint("id", ref), encryptSecret(serialized), until,
        grant ? this.fingerprint("grant", grant) : null,
        uid ? this.fingerprint("uid", uid) : null,
        code ? this.fingerprint("user-code", code) : null
      ]);
      if (result.rows.length !== 1) {
        throw new Error("OAuth provider state already consumed or replayed");
      }
    }

    async find(id: string): Promise<ProviderRecord | undefined> {
      const ref = optionalReference(id);
      return ref ? this.read("id_fingerprint", ref) : undefined;
    }

    async findByUid(uid: string): Promise<ProviderRecord | undefined> {
      const ref = optionalReference(uid);
      return ref ? this.read("uid_fingerprint", ref) : undefined;
    }

    async findByUserCode(userCode: string): Promise<ProviderRecord | undefined> {
      const ref = optionalReference(userCode);
      return ref ? this.read("user_code_fingerprint", ref) : undefined;
    }

    async consume(id: string): Promise<void> {
      const ref = optionalReference(id);
      if (!ref) throw new Error("Missing OAuth adapter reference");
      const consumed = await db.query(
        `UPDATE mcp_oauth_provider_artifacts SET consumed_at=clock_timestamp(), updated_at=now()
         WHERE model=$1 AND id_fingerprint=$2 AND consumed_at IS NULL
           AND (expires_at IS NULL OR expires_at > now()) RETURNING id_fingerprint`,
        [this.model, this.fingerprint("id", ref)]
      );
      if (consumed.rows.length !== 1) {
        throw new Error("OAuth provider state already consumed, expired or missing");
      }
    }

    async destroy(id: string): Promise<void> {
      const ref = optionalReference(id);
      if (!ref) return;
      await db.query("DELETE FROM mcp_oauth_provider_artifacts WHERE model=$1 AND id_fingerprint=$2",
        [this.model, this.fingerprint("id", ref)]);
    }

    async revokeByGrantId(grantId: string): Promise<void> {
      const ref = optionalReference(grantId);
      if (!ref) return;
      await db.query(
        "DELETE FROM mcp_oauth_provider_artifacts WHERE model=$1 AND grant_fingerprint=$2",
        [this.model, this.fingerprint("grant", ref)]
      );
    }
  };
}
