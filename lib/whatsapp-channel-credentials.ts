import { Prisma } from "@prisma/client";
import {
  decryptChannelCredentialPayload,
  encryptChannelCredentialPayload,
} from "@/lib/channel-credentials-crypto";
import {
  type WhatsAppProvider,
  type WhatsAppProviderCredentials,
} from "@/lib/whatsapp-provider";

type WhatsAppCredentialEnvelope = {
  provider: WhatsAppProvider;
  credentials: WhatsAppProviderCredentials;
  updatedAt: string;
};

export function encryptWhatsAppCredentialEnvelope(input: {
  provider: WhatsAppProvider;
  credentials: WhatsAppProviderCredentials;
}): string {
  const envelope: WhatsAppCredentialEnvelope = {
    provider: input.provider,
    credentials: input.credentials,
    updatedAt: new Date().toISOString(),
  };

  return encryptChannelCredentialPayload(JSON.stringify(envelope));
}

export function decryptWhatsAppCredentialEnvelope(
  encryptedPayload: string,
): WhatsAppCredentialEnvelope {
  const decrypted = decryptChannelCredentialPayload(encryptedPayload);
  const parsed = JSON.parse(decrypted) as WhatsAppCredentialEnvelope;

  if (!parsed?.provider || !parsed?.credentials) {
    throw new Error("Invalid WhatsApp credential payload");
  }

  return parsed;
}

export function getStringFromJsonConfig(
  config: Prisma.JsonObject | null,
  key: string,
): string | null {
  const value = config?.[key];
  if (typeof value === "string") {
    return value;
  }

  return null;
}
