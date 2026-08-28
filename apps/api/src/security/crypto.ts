import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

function encryptionKey(): Buffer {
  const raw = process.env.DEV_ENCRYPTION_KEY_B64;
  const resolved = raw ?? (process.env.NODE_ENV !== "production" ? "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" : undefined);
  if (!resolved) throw new Error("DEV_ENCRYPTION_KEY_B64 is required");
  const key = Buffer.from(resolved, "base64");
  if (key.length !== 32) throw new Error("DEV_ENCRYPTION_KEY_B64 must decode to 32 bytes");
  return key;
}
export function encryptText(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}
export function decryptText(value: string): string {
  const payload = Buffer.from(value, "base64url");
  const iv = payload.subarray(0, 12); const tag = payload.subarray(12, 28); const encrypted = payload.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv); decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
export function encryptBytes(value: Buffer | Uint8Array): Buffer {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(value)), cipher.final()]); const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
}
export function decryptBytes(value: Buffer | Uint8Array): Buffer {
  const payload = Buffer.from(value); const iv = payload.subarray(0,12), tag = payload.subarray(12,28), encrypted = payload.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv); decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}
export function blindIndex(value: string): string {
  const key = process.env.DEV_BLIND_INDEX_KEY ?? (process.env.NODE_ENV !== "production" ? "proofline-local-blind-index-key" : undefined);
  if (!key) throw new Error("DEV_BLIND_INDEX_KEY is required");
  return createHmac("sha256", key).update(value.trim().toLowerCase()).digest("hex");
}
export function sha256(value: string): string { return createHash("sha256").update(value).digest("hex"); }
export function randomPseudonym(): string { return `p_${randomBytes(8).toString("hex")}`; }
