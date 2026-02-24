import { describe, it, expect, vi, beforeEach } from "vitest";
import { encrypt, decrypt, clearKeyCache } from "./encryption.js";

// In-memory keytar store: service → account → password
const keytarStore = new Map<string, string>();

vi.mock("keytar", () => ({
  default: {
    getPassword: vi.fn(async (service: string, account: string): Promise<string | null> => {
      return keytarStore.get(`${service}:${account}`) ?? null;
    }),
    setPassword: vi.fn(async (service: string, account: string, password: string): Promise<void> => {
      keytarStore.set(`${service}:${account}`, password);
    }),
  },
}));

beforeEach(() => {
  // Clear in-memory store and key cache before each test for isolation
  keytarStore.clear();
  clearKeyCache();
});

describe("encrypt / decrypt", () => {
  it("encrypt / decrypt — round-trip returns original plaintext", async () => {
    const plaintext = "my-secret-api-key";
    const ciphertext = await encrypt(plaintext);
    const result = await decrypt(ciphertext);
    expect(result).toBe(plaintext);
  });

  it("encrypt — produces different ciphertext each call (random IV)", async () => {
    const plaintext = "same-input";
    const first = await encrypt(plaintext);
    const second = await encrypt(plaintext);
    // Each call uses a fresh random IV so the output must differ
    expect(first).not.toBe(second);
  });

  it("decrypt — throws on malformed string (not 3 colon-separated segments)", async () => {
    await expect(decrypt("no-colons")).rejects.toThrow("Invalid encrypted value format");
  });

  it("decrypt — throws on tampered ciphertext", async () => {
    const plaintext = "tamper-test";
    const ciphertext = await encrypt(plaintext);

    // Replace the ciphertext portion (third segment) with garbage
    const parts = ciphertext.split(":");
    parts[2] = Buffer.from("corrupted-data").toString("base64");
    const tampered = parts.join(":");

    await expect(decrypt(tampered)).rejects.toThrow();
  });

  it("clearKeyCache — subsequent encrypt fetches key again", async () => {
    // Encrypt once to populate the cache
    const plaintext = "cache-test";
    const first = await encrypt(plaintext);

    // Clear the in-memory cache
    clearKeyCache();

    // Encrypt again — getMasterKey will re-read from the store
    const second = await encrypt(plaintext);

    // Both should still decrypt correctly (same key was re-fetched from store)
    expect(await decrypt(first)).toBe(plaintext);
    expect(await decrypt(second)).toBe(plaintext);
  });
});
