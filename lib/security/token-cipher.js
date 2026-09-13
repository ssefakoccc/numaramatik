import "server-only";
import crypto from "crypto";

/**
 * Derives a 32-byte Buffer key from TELEGRAM_TOKEN_ENCRYPTION_KEY.
 * Fails closed if missing or invalid; NO hardcoded fallback key.
 */
function getEncryptionKey() {
  const raw = process.env.TELEGRAM_TOKEN_ENCRYPTION_KEY;
  if (!raw || typeof raw !== "string") {
    throw new Error("[Security] TELEGRAM_TOKEN_ENCRYPTION_KEY is required and missing.");
  }

  const trimmed = raw.trim();
  if (trimmed.length === 64 && /^[0-9a-fA-F]+$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }

  const b64 = Buffer.from(trimmed, "base64");
  if (b64.length === 32) {
    return b64;
  }

  const utf8 = Buffer.from(trimmed, "utf8");
  if (utf8.length === 32) {
    return utf8;
  }

  throw new Error("[Security] TELEGRAM_TOKEN_ENCRYPTION_KEY must be a valid 32-byte key (64 hex characters or 32-byte base64).");
}

/**
 * Encrypts a plain token using AES-256-GCM with a fresh random 12-byte IV.
 */
export function encryptBotToken(plainToken) {
  if (!plainToken || typeof plainToken !== "string") {
    throw new Error("Invalid token to encrypt");
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  let ciphertext = cipher.update(plainToken, "utf8", "hex");
  ciphertext += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return {
    ciphertext,
    iv: iv.toString("hex"),
    authTag,
  };
}

/**
 * Decrypts ciphertext using AES-256-GCM. Throws if auth tag mismatch or tampering.
 */
export function decryptBotToken(ciphertext, ivHex, authTagHex) {
  if (!ciphertext || !ivHex || !authTagHex) {
    throw new Error("Missing parameters for decryption");
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
