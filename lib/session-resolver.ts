import { prisma } from './prisma';

interface ResolveSessionResult {
    sessionId: string;
    conversationId: string;
    isNew: boolean;
}

/**
 * Resolves or creates a conversation session for a Facebook user on a specific page
 * @param pageId - Facebook Page ID
 * @param psid - Facebook User PSID (Page-Scoped ID)
 * @returns Session information including Botpress session ID
 */
export async function resolveSession(
    pageId: string,
    psid: string
): Promise<ResolveSessionResult> {
    const sessionId = `fb_${pageId}_${psid}`;

    // Try to find existing conversation
    let conversation = await prisma.conversation.findUnique({
        where: { sessionId },
        select: { id: true, sessionId: true },
    });

    if (conversation) {
        // Update last activity timestamp
        await prisma.conversation.update({
            where: { id: conversation.id },
            data: { lastActivityAt: new Date() },
        });

        return {
            sessionId: conversation.sessionId,
            conversationId: conversation.id,
            isNew: false,
        };
    }

    // Create new conversation
    conversation = await prisma.conversation.create({
        data: {
            facebookPageId: pageId,
            userPsid: psid,
            sessionId,
            lastActivityAt: new Date(),
        },
        select: { id: true, sessionId: true },
    });

    return {
        sessionId: conversation.sessionId,
        conversationId: conversation.id,
        isNew: true,
    };
}
