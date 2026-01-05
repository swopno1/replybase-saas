import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const updateChannelSchema = z.object({
  enabled: z.boolean().optional(),
  killSwitch: z.boolean().optional(),
  accessToken: z.string().optional(),
  config: z.record(z.any()).optional(),
});

// PATCH: Update channel (enable/disable, kill switch, etc.)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { botId: string; channelId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { botId, channelId } = params;

    // Verify ownership
    const bot = await prisma.bot.findFirst({
      where: { id: botId, userId },
    });

    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    const channel = await prisma.botChannel.findFirst({
      where: {
        id: channelId,
        botId,
      },
    });

    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    const body = await req.json();
    const validated = updateChannelSchema.parse(body);

    const updateData: any = {};
    if (validated.enabled !== undefined) updateData.enabled = validated.enabled;
    if (validated.killSwitch !== undefined) updateData.killSwitch = validated.killSwitch;
    if (validated.accessToken !== undefined) updateData.accessToken = validated.accessToken;
    if (validated.config !== undefined) updateData.config = validated.config;

    const updatedChannel = await prisma.botChannel.update({
      where: { id: channelId },
      data: updateData,
    });

    return NextResponse.json({ channel: updatedChannel });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[Channels API] Error updating channel:', error);
    return NextResponse.json(
      { error: 'Failed to update channel' },
      { status: 500 }
    );
  }
}

// DELETE: Delete channel
export async function DELETE(
  req: NextRequest,
  { params }: { params: { botId: string; channelId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const { botId, channelId } = params;

    // Verify ownership
    const bot = await prisma.bot.findFirst({
      where: { id: botId, userId },
    });

    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    await prisma.botChannel.delete({
      where: { id: channelId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Channels API] Error deleting channel:', error);
    return NextResponse.json(
      { error: 'Failed to delete channel' },
      { status: 500 }
    );
  }
}

