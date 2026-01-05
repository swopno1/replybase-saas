import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { getUserLimits } from '@/lib/subscription';

const createChannelSchema = z.object({
  type: z.enum(['facebook', 'whatsapp', 'web']),
  channelId: z.string().min(1),
  accessToken: z.string().optional(),
  config: z.record(z.any()).optional(),
});

// GET: List channels for a bot
export async function GET(
  req: NextRequest,
  { params }: { params: { botId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const botId = params.botId;

    // Verify ownership
    const bot = await prisma.bot.findFirst({
      where: { id: botId, userId },
    });

    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    const channels = await prisma.botChannel.findMany({
      where: { botId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ channels });
  } catch (error) {
    console.error('[Channels API] Error fetching channels:', error);
    return NextResponse.json(
      { error: 'Failed to fetch channels' },
      { status: 500 }
    );
  }
}

// POST: Create a new channel
export async function POST(
  req: NextRequest,
  { params }: { params: { botId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const botId = params.botId;

    // Verify ownership
    const bot = await prisma.bot.findFirst({
      where: { id: botId, userId },
    });

    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    // Check channel limit
    const limits = await getUserLimits(userId);
    const channelCount = await prisma.botChannel.count({
      where: { botId },
    });

    if (channelCount >= limits.maxChannelsPerBot) {
      return NextResponse.json(
        { error: `Channel limit reached (max ${limits.maxChannelsPerBot} per bot)` },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validated = createChannelSchema.parse(body);

    const channel = await prisma.botChannel.create({
      data: {
        botId,
        type: validated.type,
        channelId: validated.channelId,
        accessToken: validated.accessToken || null,
        config: validated.config || {},
        enabled: true,
        killSwitch: false,
      },
    });

    return NextResponse.json({ channel }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[Channels API] Error creating channel:', error);
    return NextResponse.json(
      { error: 'Failed to create channel' },
      { status: 500 }
    );
  }
}

