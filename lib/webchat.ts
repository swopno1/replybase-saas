import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const WEBCHAT_CHANNEL_TYPE_VALUES = ["web", "Web"];

type InitContactInput = {
  name?: string;
  email?: string;
  phone?: string;
};

export async function findActiveWebChannel(input: {
  channelId?: string;
  botId?: string;
}) {
  if (input.channelId) {
    return prisma.channel.findFirst({
      where: {
        id: input.channelId,
        type: { in: WEBCHAT_CHANNEL_TYPE_VALUES },
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
  }

  if (!input.botId) {
    return null;
  }

  return prisma.channel.findFirst({
    where: {
      botId: input.botId,
      type: { in: WEBCHAT_CHANNEL_TYPE_VALUES },
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
}

export async function resolveWebchatVisitorSession(params: {
  botId: string;
  tenantId: string;
  channelId: string;
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
    conversation = await prisma.crmConversation.create({
      data: {
        contactId: contact.id,
        botId: params.botId,
        channel: "web",
        metadata: {
          channelId: params.channelId,
          ...(params.metadata || {}),
        } as Prisma.InputJsonValue,
      },
    });
  }

  return {
    visitorId,
    contact,
    conversation,
  };
}
