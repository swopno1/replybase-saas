/**
 * Facebook Send API Client
 * Sends messages to Facebook Messenger users via the Send API
 */

import { generateAppSecretProof } from "@/lib/facebook-utils";

const FACEBOOK_GRAPH_API_VERSION = "v18.0";
const FACEBOOK_GRAPH_URL = `https://graph.facebook.com/${FACEBOOK_GRAPH_API_VERSION}`;

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
    const url = new URL(`${FACEBOOK_GRAPH_URL}/me/messages`);
    url.searchParams.set("access_token", pageAccessToken);

    const appSecret = process.env.FACEBOOK_CLIENT_SECRET;
    if (appSecret) {
      url.searchParams.set(
        "appsecret_proof",
        generateAppSecretProof(pageAccessToken, appSecret),
      );
    }

    const response = await fetch(url.toString(), {
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
    const url = new URL(`${FACEBOOK_GRAPH_URL}/me/messages`);
    url.searchParams.set("access_token", pageAccessToken);

    const appSecret = process.env.FACEBOOK_CLIENT_SECRET;
    if (appSecret) {
      url.searchParams.set(
        "appsecret_proof",
        generateAppSecretProof(pageAccessToken, appSecret),
      );
    }

    const response = await fetch(url.toString(), {
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
