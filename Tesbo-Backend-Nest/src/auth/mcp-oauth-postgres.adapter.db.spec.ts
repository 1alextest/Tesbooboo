import { randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { DatabaseService } from "../database/database.service";
import { oauthReferenceFingerprint } from "../common/crypto.util";
import { createMcpOAuthPostgresAdapter } from "./mcp-oauth-postgres.adapter";

/**
 * A true migrated-PostgreSQL regression. Never connect to a user or production
 * project; these tests run only on the disposable database /tesbo_ci.
 */
const url = process.env.DATABASE_URL || "";
(/\/tesbo_ci(?:\?|$)/.test(url) ? describe : describe.skip)(
  "OAuth provider state — encrypted PostgreSQL, feature OFF", () => {
    let pool: Pool;
    let db: DatabaseService;
    const unique = randomUUID();
    const originalEncryptionKey = process.env.SECRETS_ENCRYPTION_KEY;

    beforeAll(() => {
      process.env.SECRETS_ENCRYPTION_KEY ||= randomBytes(32).toString("base64");
      pool = new Pool({ connectionString: url, max: 8, application_name: `oauth-adapter-${unique}` });
      db = new DatabaseService(pool);
    });

    afterAll(async () => {
      await pool?.end();
      if (originalEncryptionKey === undefined) delete process.env.SECRETS_ENCRYPTION_KEY;
      else process.env.SECRETS_ENCRYPTION_KEY = originalEncryptionKey;
    });

    const id = (label: string) => `${unique}:${label}`;
    const adapter = (model: string) => new (createMcpOAuthPostgresAdapter(db))(model);

    it("encrypts provider payload and blind-indexes all stored identifiers", async () => {
      const credential = id("auth-code");
      const grant = id("private-grant");
      const secret = id("highly-confidential-test-only-secret");
      const value = { grantId: grant, codeChallenge: id("verifier"), secret, accountId: id("account") };
      await adapter("AuthorizationCode").upsert(credential, value, 90);
      expect(await adapter("AuthorizationCode").find(credential)).toEqual(value);
      const row = (await db.query(
        "SELECT id_fingerprint,encrypted_payload,grant_fingerprint,expires_at FROM mcp_oauth_provider_artifacts WHERE model=$1 AND id_fingerprint=$2",
        ["AuthorizationCode", oauthReferenceFingerprint("oauth:AuthorizationCode:id", credential)]
      )).rows[0];
      expect(row.id_fingerprint).toMatch(/^[a-f0-9]{64}$/);
      expect(row.id_fingerprint).not.toBe(credential);
      expect(row.grant_fingerprint).not.toBe(grant);
      expect(row.encrypted_payload).toMatch(/^enc:v1:/);
      expect(row.encrypted_payload).not.toContain(secret);
      expect(row.encrypted_payload).not.toContain(credential);
      expect(row.expires_at).toBeTruthy();
      await adapter("AuthorizationCode").destroy(credential);
    });

    it("shares protocol state across independent adapter instances and supports indexed lookups", async () => {
      const sessionId = id("session");
      const uid = id("session-uid");
      const codeId = id("device-code");
      const userCode = id("short-user-code");
      const session = { uid, accountId: id("account"), state: { scope: "read" } };
      const device = { userCode, accountId: id("account"), grantId: id("grant"), kind: "DeviceCode" };
      await adapter("Session").upsert(sessionId, session, 90);
      await adapter("DeviceCode").upsert(codeId, device, 90);
      expect(await adapter("Session").findByUid(uid)).toEqual(session);
      expect(await adapter("DeviceCode").findByUserCode(userCode)).toEqual(device);
      expect(await adapter("Session").find(codeId)).toBeUndefined();
      expect(await adapter("DeviceCode").findByUid(uid)).toBeUndefined();
      await adapter("Session").destroy(sessionId);
      await adapter("DeviceCode").destroy(codeId);
    });

    it("consumes an authorization code exactly once across concurrent database connections", async () => {
      const credential = id("consumed-code");
      await adapter("AuthorizationCode").upsert(credential, { grantId: id("grant") }, 90);
      const a = adapter("AuthorizationCode"), b = adapter("AuthorizationCode");
      const attempts = await Promise.allSettled([a.consume(credential), b.consume(credential)]);
      expect(attempts.map(x => x.status).sort()).toEqual(["fulfilled", "rejected"]);
      const result = await a.find(credential);
      expect(result?.consumed).toEqual(expect.any(Number));
      await expect(b.consume(credential)).rejects.toThrow(/consumed/);
      await expect(b.upsert(credential, { grantId: id("grant") }, 90)).rejects.toThrow(/consumed|replayed/);
      await a.destroy(credential);
    });

    it("rejects concurrent replay-detection inserts, but permits reuse after expiry", async () => {
      const marker = id("replay-marker");
      const a = adapter("ReplayDetection"), b = adapter("ReplayDetection");
      const attempts = await Promise.allSettled([
        a.upsert(marker, { kind: "ReplayDetection" }, 120),
        b.upsert(marker, { kind: "ReplayDetection" }, 120)
      ]);
      expect(attempts.map(x => x.status).sort()).toEqual(["fulfilled", "rejected"]);
      expect(await a.find(marker)).toEqual({ kind: "ReplayDetection" });
      await a.destroy(marker);
      await a.upsert(marker, { kind: "ReplayDetection" }, 0);
      expect(await a.find(marker)).toBeUndefined();
      await b.upsert(marker, { kind: "ReplayDetection", retried: true }, 60);
      expect(await a.find(marker)).toEqual({ kind: "ReplayDetection", retried: true });
      await a.destroy(marker);
    });

    it("revokeByGrantId removes only this model's current grant-linked records", async () => {
      const grant = id("revoked-grant");
      const linked = id("refresh-grant-linked");
      const unrelated = id("refresh-unrelated");
      const otherModel = id("code-grant-linked");
      await adapter("RefreshToken").upsert(linked, { grantId: grant, rotations: 0 }, 120);
      await adapter("RefreshToken").upsert(unrelated, { grantId: id("other-grant") }, 120);
      await adapter("AuthorizationCode").upsert(otherModel, { grantId: grant }, 120);
      await adapter("RefreshToken").revokeByGrantId(grant);
      expect(await adapter("RefreshToken").find(linked)).toBeUndefined();
      expect(await adapter("RefreshToken").find(unrelated)).toBeDefined();
      expect(await adapter("AuthorizationCode").find(otherModel)).toBeDefined();
      await adapter("RefreshToken").destroy(unrelated);
      await adapter("AuthorizationCode").destroy(otherModel);
    });

    it("requires bounded protocol state, model identity and expiry without writes", async () => {
      expect(() => adapter("Invalid Model Name")).toThrow(/model/);
      await expect(adapter("AuthorizationCode").upsert(id("no-expiry"), {})).rejects.toThrow(/expiration/);
      await expect(adapter("AuthorizationCode").upsert(id("negative-expiry"), {}, -1)).rejects.toThrow(/expiration/);
      await expect(adapter("Session").upsert(id("bad-payload"), [] as never, 60)).rejects.toThrow(/state/);
      await expect(adapter("Session").upsert(id("oversize"), { secret: "a".repeat(262144) }, 60)).rejects.toThrow(/limit/);
      expect(await adapter("AuthorizationCode").find(id("no-expiry"))).toBeUndefined();
    });

    it("fails closed if encrypted state is tampered with, rather than returning a partial credential", async () => {
      const credential=id("tampered");
      const session=adapter("Session");
      await session.upsert(credential, { accountId: id("account") }, 60);
      const fingerprint=oauthReferenceFingerprint("oauth:Session:id",credential);
      await db.query(
        "UPDATE mcp_oauth_provider_artifacts SET encrypted_payload='enc:v1:Zm9yZ2Vk' WHERE model='Session' AND id_fingerprint=$1",
        [fingerprint]
      );
      await expect(session.find(credential)).rejects.toThrow();
      await session.destroy(credential);
    });
  }
);
