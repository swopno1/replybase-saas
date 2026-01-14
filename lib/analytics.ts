import { prisma } from "./prisma";
import { ConversationStatus } from "@prisma/client";

export async function getConversationsPerBot(tenantId: string) {
  const conversationsPerBot = await prisma.crmConversation.groupBy({
    by: ["botId"],
    where: {
      contact: {
        tenantId,
      },
    },
    _count: {
      _all: true,
    },
  });

  // also get the bot names
  const bots = await prisma.bot.findMany({
    where: {
      id: {
        in: conversationsPerBot.map((b) => b.botId).filter(Boolean) as string[],
      },
    },
    select: {
      id: true,
      name: true,
    },
  });

  return conversationsPerBot.map((b) => {
    const bot = bots.find((bot) => bot.id === b.botId);
    return {
      bot: bot?.name || "Unassigned",
      count: b._count._all,
    };
  });
}

export async function getMessagesPerChannel(tenantId: string) {
  const conversations = await prisma.crmConversation.findMany({
    where: {
      contact: {
        tenantId,
      },
    },
    select: {
      channel: true,
      _count: {
        select: {
          messages: true,
        },
      },
    },
  });

  const messagesPerChannel = conversations.reduce((acc, c) => {
    const channel = c.channel;
    const count = c._count.messages;
    if (acc[channel]) {
      acc[channel] += count;
    } else {
      acc[channel] = count;
    }
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(messagesPerChannel).map(([channel, count]) => ({
    channel,
    count,
  }));
}

export async function getAiVsHumanRatio(tenantId: string) {
  const messages = await prisma.crmMessage.groupBy({
    by: ["source"],
    where: {
      conversation: {
        contact: {
          tenantId,
        },
      },
    },
    _count: {
      _all: true,
    },
  });

  const aiMessages = messages.find((m) => m.source === "ai")?._count._all || 0;
  const humanMessages =
    messages.find((m) => m.source === "human")?._count._all || 0;

  const total = aiMessages + humanMessages;
  if (total === 0) {
    return {
      ai: 0,
      human: 0,
    };
  }

  return {
    ai: (aiMessages / total) * 100,
    human: (humanMessages / total) * 100,
  };
}

export async function getResolutionTime(tenantId: string) {
  const conversations = await prisma.crmConversation.findMany({
    where: {
      contact: {
        tenantId,
      },
      status: ConversationStatus.CLOSED,
    },
    include: {
      messages: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  if (conversations.length === 0) {
    return 0;
  }

  const resolutionTimes = conversations
    .map((c) => {
      if (c.messages.length < 2) {
        return 0;
      }
      const firstMessage = c.messages[0];
      const lastMessage = c.messages[c.messages.length - 1];
      return (
        lastMessage.createdAt.getTime() - firstMessage.createdAt.getTime()
      );
    })
    .filter((t) => t > 0);

  if (resolutionTimes.length === 0) {
    return 0;
  }

  const totalResolutionTime = resolutionTimes.reduce((a, b) => a + b, 0);
  return totalResolutionTime / resolutionTimes.length;
}
