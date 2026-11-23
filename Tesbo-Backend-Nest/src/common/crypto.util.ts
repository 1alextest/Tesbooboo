import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const PREFIX = "enc:v1:";

let cachedKey: Buffer | null = null;

function loadKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = (process.env.SECRETS_ENCRYPTION_KEY || "").trim();
  if (!raw) {
    throw new Error(
      "SECRETS_ENCRYPTION_KEY is not set. Generate one with: openssl rand -base64 32"
    );
  }
  const key = raw.length === 64 && /^[0-9a-fA-F]+$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `SECRETS_ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes (got ${key.length}). Generate one with: openssl rand -base64 32`
    );
  }
  cachedKey = key;
  return key;
}

export function assertEncryptionKeyConfigured(): void {
  loadKey();
}

export function isEncryptedSecret(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export function encryptSecret(plaintext: string): string {
  if (!plaintext) return plaintext;
  const key = loadKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decryptSecret(stored: string): string {
  if (!stored || !isEncryptedSecret(stored)) return stored;
  const key = loadKey();
  const packed = Buffer.from(stored.slice(PREFIX.length), "base64");
  const iv = packed.subarray(0, IV_LENGTH);
  const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/**
 * Stable, domain-separated lookup for confidential OAuth adapter references.
 * Reuses the mandatory secret-encryption key, but derives an independent HMAC
 * subkey: low-entropy user codes and token IDs are not stored as clear text or
 * unsalted SHA-256. Key rotation must migrate BOTH ciphertext and these indexes.
 */
let oauthReferenceKey: Buffer | null = null;
export function oauthReferenceFingerprint(namespace: string, value: string): string {
  if (!namespace || !/^[a-zA-Z0-9:_-]{1,128}$/.test(namespace) ||
      typeof value !== "string" || !value || Buffer.byteLength(value, "utf8") > 8192) {
    throw new Error("Invalid OAuth adapter reference");
  }
  if (!oauthReferenceKey) {
    oauthReferenceKey = Buffer.from(hkdfSync("sha256", loadKey(),
      Buffer.from("tesbo-oauth-adapter-index-v1"), Buffer.from("reference-fingerprint-v1"), 32));
  }
  return createHmac("sha256", oauthReferenceKey)
    .update(namespace, "utf8").update("\\0").update(value, "utf8")
    .digest("hex");
}
