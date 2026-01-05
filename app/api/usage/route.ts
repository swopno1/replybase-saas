import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { getUserUsage, getUserLimits } from '@/lib/subscription';

// GET: Get usage statistics
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;

    const [usage, limits] = await Promise.all([
      getUserUsage(userId),
      getUserLimits(userId),
    ]);

    return NextResponse.json({
      usage,
      limits,
      percentages: {
        dailyMessages: Math.min(100, (usage.dailyMessages / limits.dailyMessageLimit) * 100),
        monthlyMessages: Math.min(100, (usage.monthlyMessages / limits.monthlyMessageLimit) * 100),
        dailyFlowExecutions: Math.min(100, (usage.dailyFlowExecutions / limits.flowExecutionCap) * 100),
      },
    });
  } catch (error) {
    console.error('[Usage API] Error fetching usage:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage statistics' },
      { status: 500 }
    );
  }
}

