import { prisma } from './prisma';

export interface ExecutionLogData {
  botId: string;
  userId: string;
  sessionId?: string;
  flowName?: string;
  nodeId?: string;
  direction: 'inbound' | 'outbound';
  status: 'success' | 'error' | 'timeout' | 'rate_limited';
  errorMessage?: string;
  executionTime?: number;
  input?: string;
  output?: string;
}

/**
 * Log bot execution event
 */
export async function logExecution(data: ExecutionLogData) {
  try {
    await prisma.executionLog.create({
      data: {
        botId: data.botId,
        userId: data.userId,
        sessionId: data.sessionId || null,
        flowName: data.flowName || null,
        nodeId: data.nodeId || null,
        direction: data.direction,
        status: data.status,
        errorMessage: data.errorMessage || null,
        executionTime: data.executionTime || null,
        input: data.input || null,
        output: data.output || null,
      },
    });
  } catch (error) {
    console.error('[ExecutionLogger] Error logging execution:', error);
    // Don't throw - logging failures shouldn't break the app
  }
}

/**
 * Get execution logs for a bot
 */
export async function getExecutionLogs(
  botId: string,
  limit: number = 100,
  offset: number = 0
) {
  return prisma.executionLog.findMany({
    where: { botId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
    select: {
      id: true,
      sessionId: true,
      flowName: true,
      nodeId: true,
      direction: true,
      status: true,
      errorMessage: true,
      executionTime: true,
      createdAt: true,
    },
  });
}

/**
 * Get execution logs for a user
 */
export async function getUserExecutionLogs(
  userId: string,
  limit: number = 100,
  offset: number = 0
) {
  return prisma.executionLog.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
    select: {
      id: true,
      botId: true,
      sessionId: true,
      flowName: true,
      nodeId: true,
      direction: true,
      status: true,
      errorMessage: true,
      executionTime: true,
      createdAt: true,
      bot: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

