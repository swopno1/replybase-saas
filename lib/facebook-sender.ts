/**
 * Facebook Send API Client
 * Sends messages to Facebook Messenger users via the Send API
 */

import { getFacebookGraphUrl } from "@/lib/server/facebook-utils";

interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Sends a sender action (typing indicator or read receipt) to a Facebook Messenger user
 */
export async function sendFacebookSenderAction(
  pageAccessToken: string,
  recipientPsid: string,
  action: "typing_on" | "typing_off" | "mark_seen",
): Promise<boolean> {
  try {
    const url = getFacebookGraphUrl("me/messages", pageAccessToken);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientPsid },
        sender_action: action,
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Sends a text message to a Facebook Messenger user
 * @param pageAccessToken - Page Access Token for the Facebook Page
 * @param recipientPsid - Facebook User PSID (Page-Scoped ID)
 * @param text - Message text to send
 * @returns Result indicating success or failure
 */
export async function sendTextMessage(
  pageAccessToken: string,
  recipientPsid: string,
  text: string,
): Promise<SendMessageResult> {
  try {
    const url = getFacebookGraphUrl("me/messages", pageAccessToken);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: { id: recipientPsid },
        message: { text },
        messaging_type: "RESPONSE",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Facebook Send API] Error:", errorText);
      return {
        success: false,
        error: `Facebook API error: ${response.status} - ${errorText}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      messageId: data.message_id,
    };
  } catch (error) {
    console.error("[Facebook Send API] Exception:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
