import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const updateBotSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  enabled: z.boolean().optional(),
  entryFlow: z.string().optional(),
  welcomeMessage: z.string().max(1000).optional(),
  triggers: z.array(z.string()).optional(),
});

// GET: Get bot details
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

    const bot = await prisma.bot.findFirst({
      where: {
        id: botId,
        userId, // Ensure user owns the bot
      },
      include: {
        channels: true,
        _count: {
          select: {
            executionLogs: true,
          },
        },
      },
    });

    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    return NextResponse.json({ bot });
  } catch (error) {
    console.error('[Bots API] Error fetching bot:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bot' },
      { status: 500 }
    );
  }
}

// PATCH: Update bot
export async function PATCH(
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
    const existingBot = await prisma.bot.findFirst({
      where: { id: botId, userId },
    });

    if (!existingBot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    const body = await req.json();
    const validated = updateBotSchema.parse(body);

    const updateData: any = {};
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.description !== undefined) updateData.description = validated.description;
    if (validated.enabled !== undefined) updateData.enabled = validated.enabled;
    if (validated.entryFlow !== undefined) updateData.entryFlow = validated.entryFlow;
    if (validated.welcomeMessage !== undefined) updateData.welcomeMessage = validated.welcomeMessage;
    if (validated.triggers !== undefined) updateData.triggers = validated.triggers;

    const bot = await prisma.bot.update({
      where: { id: botId },
      data: updateData,
      include: {
        channels: true,
      },
    });

    return NextResponse.json({ bot });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[Bots API] Error updating bot:', error);
    return NextResponse.json(
      { error: 'Failed to update bot' },
      { status: 500 }
    );
  }
}

// DELETE: Delete bot
export async function DELETE(
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
    const existingBot = await prisma.bot.findFirst({
      where: { id: botId, userId },
    });

    if (!existingBot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    await prisma.bot.delete({
      where: { id: botId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Bots API] Error deleting bot:', error);
    return NextResponse.json(
      { error: 'Failed to delete bot' },
      { status: 500 }
    );
  }
}

