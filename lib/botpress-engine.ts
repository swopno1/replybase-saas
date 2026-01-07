/**
 * Botpress Engine Adapter
 * Handles communication with Botpress for AI conversation
 */

const BP_INTERNAL_URL = 'http://replybase-botpress:3002';
const BP_TOKEN = process.env.BOTPRESS_ADMIN_TOKEN;
const ENGINE_TIMEOUT_MS = 10000; // 10 seconds

interface BotpressResponse {
    responses: Array<{
        type: string;
        text?: string;
        [key: string]: unknown;
    }>;
    [key: string]: unknown;
}

interface SendMessageResult {
    success: boolean;
    text?: string;
    error?: string;
}

/**
 * Sends a user message to Botpress and extracts the text reply
 * @param botId - Botpress bot ID
 * @param sessionId - Unique session ID for the conversation
 * @param text - User's message text
 * @returns Extracted text reply or error
 */
export async function sendMessage(
    botId: string,
    sessionId: string,
    text: string
): Promise<SendMessageResult> {
    try {
        const url = `${BP_INTERNAL_URL}/api/v1/bots/${botId}/converse/${sessionId}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), ENGINE_TIMEOUT_MS);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${BP_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type: 'text',
                text,
            }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Botpress Engine] Error:', errorText);
            return {
                success: false,
                error: `Botpress API error: ${response.status} - ${errorText}`,
            };
        }

        const data: BotpressResponse = await response.json();

        // Extract first text response
        const textResponse = data.responses?.find((r) => r.type === 'text' && r.text);

        if (!textResponse || !textResponse.text) {
            console.warn('[Botpress Engine] No text response found in:', data);
            return {
                success: false,
                error: 'No text response from engine',
            };
        }

        return {
            success: true,
            text: textResponse.text,
        };
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            console.error('[Botpress Engine] Timeout after', ENGINE_TIMEOUT_MS, 'ms');
            return {
                success: false,
                error: 'Engine timeout',
            };
        }

        console.error('[Botpress Engine] Exception:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}
