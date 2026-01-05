import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { getUserExecutionLogs } from '@/lib/execution-logger';

// GET: Get execution logs
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;

    const searchParams = req.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    const logs = await getUserExecutionLogs(userId, limit, offset);

    return NextResponse.json({ logs });
  } catch (error) {
    console.error('[Execution Logs API] Error fetching logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch execution logs' },
      { status: 500 }
    );
  }
}

