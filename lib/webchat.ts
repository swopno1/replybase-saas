import { randomBytes, randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sanitizeWebchatMetadataForRetention } from "@/lib/webchat-privacy";

type InitContactInput = {
  name?: string;
  email?: string;
  phone?: string;
};

type ActiveWebChannel = {
  id: string;
  name: string;
  config: Prisma.JsonValue;
  bot: {
    id: string;
    tenantId: string;
  };
};

export type ActiveWebChatSite = {
  id: string;
  name: string;
  publicKey: string;
  secretKey: string;
  channelId: string | null;
  allowedDomains: Prisma.JsonValue;
  isActive: boolean;
  themeConfig: Prisma.JsonValue;
  bot: {
    id: string;
    tenantId: string;
  };
};

type DbWebChatSiteWithBot = Prisma.WebChatSiteGetPayload<{
  include: {
    bot: {
      select: {
        id: true;
        tenantId: true;
      };
    };
  };
}>;

function toActiveWebChatSite(site: DbWebChatSiteWithBot): ActiveWebChatSite {
  return {
    id: site.id,
    name: site.name,
    publicKey: site.publicKey,
    secretKey: site.secretKey,
    channelId: site.channelId,
    allowedDomains: site.allowedDomains,
    isActive: site.isActive,
    themeConfig: site.themeConfig,
    bot: site.bot,
  };
}

function getPrimaryAllowedDomain(metadata?: Record<string, unknown>) {
  const origin =
    typeof metadata?.origin === "string" ? metadata.origin.trim() : "";
  if (!origin) {
    return [];
  }
  return [origin];
}

function generatePublicKey() {
  return `wpk_${randomBytes(16).toString("hex")}`;
}

function generateSecretKey() {
  return `wsk_${randomBytes(32).toString("hex")}`;
}

export async function rotateWebChatSiteCredentials(params: {
  siteId: string;
  rotatePublicKey?: boolean;
  rotateSecretKey?: boolean;
}) {
  const rotatePublicKey = Boolean(params.rotatePublicKey);
  const rotateSecretKey = Boolean(params.rotateSecretKey);

  if (!rotatePublicKey && !rotateSecretKey) {
    return prisma.webChatSite.findUnique({
      where: { id: params.siteId },
    });
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.webChatSite.update({
        where: { id: params.siteId },
        data: {
          ...(rotatePublicKey ? { publicKey: generatePublicKey() } : {}),
          ...(rotateSecretKey ? { secretKey: generateSecretKey() } : {}),
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("Failed to rotate webchat site credentials");
}

function normalizeOrigin(urlLike: string) {
  try {
    return new URL(urlLike).origin.toLowerCase();
  } catch {
    return "";
  }
}

export function normalizeAllowedDomain(urlLike: string) {
  return normalizeOrigin(urlLike);
}

export function normalizeAllowedDomains(values: string[]) {
  return Array.from(
    new Set(
      values.map((value) => normalizeAllowedDomain(value)).filter(Boolean),
    ),
  );
}

function getAllowedDomainList(value: Prisma.JsonValue) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return normalizeAllowedDomains(
    value.filter((entry): entry is string => typeof entry === "string"),
  );
}

export function isOriginAllowedForSite(
  site: Pick<ActiveWebChatSite, "allowedDomains">,
  origin?: string | null,
  referer?: string | null,
) {
  const allowlist = getAllowedDomainList(site.allowedDomains);
  if (allowlist.length === 0) {
    return true;
  }

  const normalizedOrigin = origin ? normalizeOrigin(origin) : "";
  const normalizedRefererOrigin = referer ? normalizeOrigin(referer) : "";

  if (normalizedOrigin && allowlist.includes(normalizedOrigin)) {
    return true;
  }

  if (normalizedRefererOrigin && allowlist.includes(normalizedRefererOrigin)) {
    return true;
  }

  return false;
}

export async function findActiveWebChannel(input: {
  channelId?: string;
  botId?: string;
}): Promise<ActiveWebChannel | null> {
  if (input.channelId) {
    const channel = await prisma.channel.findFirst({
      where: {
        id: input.channelId,
        type: "web",
        isActive: true,
        enabled: true,
      },
      include: {
        bot: {
          select: {
            id: true,
            tenantId: true,
          },
        },
      },
    });

    if (!channel) {
      return null;
    }

    return {
      id: channel.id,
      name: channel.name,
      config: channel.config,
      bot: channel.bot,
    };
  }

  if (!input.botId) {
    return null;
  }

  const channel = await prisma.channel.findFirst({
    where: {
      botId: input.botId,
      type: "web",
      isActive: true,
      enabled: true,
    },
    orderBy: {
      createdAt: "asc",
    },
    include: {
      bot: {
        select: {
          id: true,
          tenantId: true,
        },
      },
    },
  });

  if (!channel) {
    return null;
  }

  return {
    id: channel.id,
    name: channel.name,
    config: channel.config,
    bot: channel.bot,
  };
}

export async function getOrCreateWebChatSite(params: {
  channelId: string;
  botId: string;
  tenantId: string;
  name: string;
  themeConfig?: Prisma.JsonObject;
  metadata?: Record<string, unknown>;
}) {
  const existingSite = await prisma.webChatSite.findUnique({
    where: { channelId: params.channelId },
    include: {
      bot: {
        select: {
          id: true,
          tenantId: true,
        },
      },
    },
  });

  if (existingSite) {
    return toActiveWebChatSite(existingSite);
  }

  try {
    const createdSite = await prisma.webChatSite.create({
      data: {
        channelId: params.channelId,
        botId: params.botId,
        tenantId: params.tenantId,
        name: params.name,
        publicKey: generatePublicKey(),
        secretKey: generateSecretKey(),
        allowedDomains: getPrimaryAllowedDomain(params.metadata),
        themeConfig: params.themeConfig || {},
        isActive: true,
      },
      include: {
        bot: {
          select: {
            id: true,
            tenantId: true,
          },
        },
      },
    });

    return toActiveWebChatSite(createdSite);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const site = await prisma.webChatSite.findUniqueOrThrow({
        where: { channelId: params.channelId },
        include: {
          bot: {
            select: { id: true, tenantId: true },
          },
        },
      });
      return toActiveWebChatSite(site);
    }
    throw error;
  }
}

export async function findActiveWebChatSite(input: {
  publicKey?: string;
  channelId?: string;
  botId?: string;
}): Promise<ActiveWebChatSite | null> {
  if (input.publicKey) {
    const site = await prisma.webChatSite.findFirst({
      where: {
        publicKey: input.publicKey,
        isActive: true,
      },
      include: {
        bot: {
          select: {
            id: true,
            tenantId: true,
          },
        },
      },
    });

    if (!site) {
      return null;
    }

    return toActiveWebChatSite(site);
  }

  if (!input.channelId && !input.botId) {
    return null;
  }

  const site = await prisma.webChatSite.findFirst({
    where: {
      channelId: input.channelId,
      botId: input.botId,
      isActive: true,
    },
    orderBy: {
      createdAt: "asc",
    },
    include: {
      bot: {
        select: {
          id: true,
          tenantId: true,
        },
      },
    },
  });

  if (!site) {
    return null;
  }

  return toActiveWebChatSite(site);
}

export async function resolveWebchatVisitorSession(params: {
  siteId: string;
  botId: string;
  tenantId: string;
  channelId?: string;
  visitorId?: string;
  contact?: InitContactInput;
  metadata?: Record<string, unknown>;
}) {
  const visitorId = params.visitorId || randomUUID();

  let contact = await prisma.contact.findFirst({
    where: {
      tenantId: params.tenantId,
      identities: {
        some: {
          type: "webchat_visitor_id",
          value: visitorId,
        },
      },
    },
  });

  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        tenantId: params.tenantId,
        name: params.contact?.name,
        email: params.contact?.email,
        phone: params.contact?.phone,
        identities: {
          create: {
            type: "webchat_visitor_id",
            value: visitorId,
          },
        },
      },
    });
  }

  const updates: Record<string, string> = {};
  if (params.contact?.name && params.contact.name !== contact.name) {
    updates.name = params.contact.name;
  }
  if (params.contact?.email && params.contact.email !== contact.email) {
    updates.email = params.contact.email;
  }
  if (params.contact?.phone && params.contact.phone !== contact.phone) {
    updates.phone = params.contact.phone;
  }

  if (Object.keys(updates).length > 0) {
    try {
      contact = await prisma.contact.update({
        where: { id: contact.id },
        data: updates,
      });
    } catch {
      // Ignore uniqueness conflicts on optional contact fields in anonymous chat flows.
    }
  }

  let conversation = await prisma.crmConversation.findFirst({
    where: {
      contactId: contact.id,
      botId: params.botId,
      channel: "web",
    },
  });

  if (!conversation) {
    const sanitizedMetadata = sanitizeWebchatMetadataForRetention(
      params.metadata || {},
    );

    conversation = await prisma.crmConversation.create({
      data: {
        contactId: contact.id,
        botId: params.botId,
        channel: "web",
        metadata: {
          siteId: params.siteId,
          ...(params.channelId ? { channelId: params.channelId } : {}),
          ...sanitizedMetadata,
        } as Prisma.InputJsonValue,
      },
    });
  }

  const existingSession = await prisma.webChatSession.findUnique({
    where: {
      siteId_visitorId: {
        siteId: params.siteId,
        visitorId,
      },
    },
  });

  const sessionMetadata = sanitizeWebchatMetadataForRetention(
    params.metadata || {},
  ) as Prisma.InputJsonValue;

  const webChatSession = existingSession
    ? await prisma.webChatSession.update({
      where: { id: existingSession.id },
      data: {
        conversationId: conversation.id,
        lastSeenAt: new Date(),
        fingerprint:
          typeof params.metadata?.fingerprint === "string"
            ? params.metadata.fingerprint
            : existingSession.fingerprint,
        metadata: sessionMetadata,
      },
    })
    : await prisma.webChatSession.create({
      data: {
        siteId: params.siteId,
        conversationId: conversation.id,
        visitorId,
        fingerprint:
          typeof params.metadata?.fingerprint === "string"
            ? params.metadata.fingerprint
            : null,
        metadata: sessionMetadata,
        lastSeenAt: new Date(),
      },
    });

  return {
    visitorId,
    contact,
    conversation,
    webChatSession,
  };
}
