import crypto from "crypto";

function getEncryptionKey(): Buffer {
  const keyMaterial =
    process.env.TELEGRAM_TOKEN_ENCRYPTION_KEY || process.env.AUTH_SECRET;

  if (!keyMaterial) {
    throw new Error(
      "Missing TELEGRAM_TOKEN_ENCRYPTION_KEY (or AUTH_SECRET) for Telegram token encryption",
    );
  }

  // Derive a stable 32-byte key for AES-256.
  return crypto.createHash("sha256").update(keyMaterial).digest();
}

export function encryptTelegramToken(plainToken: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plainToken, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

export function decryptTelegramToken(encryptedToken: string): string {
  const key = getEncryptionKey();
  const parts = encryptedToken.split(":");

  if (parts.length !== 3) {
    throw new Error("Invalid encrypted telegram token format");
  }

  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const encrypted = Buffer.from(dataB64, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);

  return plain.toString("utf8");
}
