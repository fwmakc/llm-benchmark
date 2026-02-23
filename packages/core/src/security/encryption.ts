import crypto from "crypto";
import keytar from "keytar";

const SERVICE = "llm-benchmark";
const ACCOUNT = "master-key";
const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;

let cachedKey: Buffer | null = null;

async function getMasterKey(): Promise<Buffer> {
  if (cachedKey) return cachedKey;

  let stored = await keytar.getPassword(SERVICE, ACCOUNT);

  if (!stored) {
    const key = crypto.randomBytes(KEY_BYTES).toString("base64");
    await keytar.setPassword(SERVICE, ACCOUNT, key);
    stored = key;
  }

  cachedKey = Buffer.from(stored, "base64");
  return cachedKey;
}

/**
 * Encrypts plaintext and returns a compact string: base64(iv):base64(tag):base64(ciphertext)
 * The master key never leaves the OS keychain.
 */
export async function encrypt(plaintext: string): Promise<string> {
  const key = await getMasterKey();
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(":");
}

/**
 * Decrypts a value produced by encrypt().
 */
export async function decrypt(stored: string): Promise<string> {
  const key = await getMasterKey();
  const parts = stored.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted value format");

  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return decipher.update(data) + decipher.final("utf8");
}

/** Clears the in-memory master key cache (e.g. for testing). */
export function clearKeyCache(): void {
  cachedKey = null;
}
