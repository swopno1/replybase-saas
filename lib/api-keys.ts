import { randomBytes, createHash } from "crypto";

/**
 * Generate a new API key with a prefix.
 * Example: rb_live_3f7a1b...
 */
export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const prefix = "rb_live_";
  const randomPart = randomBytes(32).toString("hex");
  const key = `${prefix}${randomPart}`;
  const hash = hashApiKey(key);

  return { key, hash, prefix };
}

/**
 * Hash an API key for secure storage.
 */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Validate a key against its hash.
 */
export function validateApiKey(key: string, hash: string): boolean {
  return hashApiKey(key) === hash;
}
