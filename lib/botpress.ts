const BP_URL = process.env.AI_ENGINE_URL || "http://localhost:3000";
const BP_TOKEN = process.env.BOTPRESS_TOKEN; // SaaS Service Token

export interface BotpressConverseResponse {
  responses: Array<{
    type: string;
    text: string;
    [key: string]: any;
  }>;
}

export class BotpressService {
  private static get headers() {
    return {
      Authorization: `Bearer ${BP_TOKEN}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * STRICT HEALTH CHECK
   * Target: GET /
   * Expected: 200 "quack!"
   * 
   * @returns true if healthy, false otherwise
   */
  static async getHealth(): Promise<boolean> {
    try {
      console.log(`[Botpress] Checking health at: ${BP_URL}/`);
      const res = await fetch(`${BP_URL}/`, {
        method: "GET",
        next: { revalidate: 0 },
      });

      if (!res.ok) {
        console.error(`[Botpress] Health check failed: ${res.status} ${res.statusText}`);
        return false;
      }

      const text = await res.text();
      // Valid Botpress v12 root response
      if (text.includes("quack!")) {
        console.log(`[Botpress] Health check passed: quack!`);
        return true;
      }

      console.error(`[Botpress] Invalid response body: ${text.substring(0, 50)}...`);
      return false;
    } catch (error) {
      console.error(`[Botpress] Health check connection error:`, error);
      return false;
    }
  }

  /**
   * CONVERSE API
   * Endpoint: POST /api/v1/bots/{botId}/converse/{conversationId}
   * ID Strategy: {userId}:{botId} (Deterministic)
   */
  static async converse(
    botId: string,
    userId: string,
    text: string
  ): Promise<BotpressConverseResponse> {
    const conversationId = `${userId}:${botId}`;
    const url = `${BP_URL}/api/v1/bots/${botId}/converse/${conversationId}`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({
          type: "text",
          text: text,
        }),
      });

      if (!res.ok) {
        throw new Error(`Botpress Converse Error: ${res.status} ${await res.text()}`);
      }

      return await res.json();
    } catch (error) {
      console.error("[Botpress] Converse error:", error);
      throw error;
    }
  }
}
