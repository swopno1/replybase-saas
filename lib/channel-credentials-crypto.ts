import crypto from "crypto";

const DEFAULT_ALGORITHM = "aes-256-gcm";

function getCredentialEncryptionKey(): Buffer {
  const keyMaterial =
    process.env.CHANNEL_CREDENTIALS_ENCRYPTION_KEY || process.env.AUTH_SECRET;

  if (!keyMaterial) {
    throw new Error(
      "Missing CHANNEL_CREDENTIALS_ENCRYPTION_KEY (or AUTH_SECRET) for channel credential encryption",
    );
  }

  return crypto.createHash("sha256").update(keyMaterial).digest();
}

export function encryptChannelCredentialPayload(payload: string): string {
  const key = getCredentialEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(DEFAULT_ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(payload, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

export function decryptChannelCredentialPayload(payload: string): string {
  const key = getCredentialEncryptionKey();
  const parts = payload.split(":");

  if (parts.length !== 3) {
    throw new Error("Invalid encrypted channel credential payload format");
  }

  const [ivB64, authTagB64, encryptedB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const encrypted = Buffer.from(encryptedB64, "base64");

  const decipher = crypto.createDecipheriv(DEFAULT_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    "utf8",
  );
}
