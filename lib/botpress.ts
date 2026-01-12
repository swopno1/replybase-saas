const BP_URL = process.env.AI_ENGINE_URL || "http://localhost:3001";

const BP_TOKEN = process.env.BOTPRESS_ADMIN_TOKEN;

export type BotpressMessengerConfig = {
  pageId: string;
  accessToken: string;
  appSecret: string;
  verifyToken: string;
};
export class BotpressService {
  private static get headers() {
    return {
      Authorization: `Bearer ${BP_TOKEN}`,
      "Content-Type": "application/json",
    };
  }

  static async getHealth() {
    const candidates = [
      `${BP_URL}/status`, // Common v12 health check
      `${BP_URL}/api/v1/info`,
      `${BP_URL}/api/v1/admin/server/status`, // v12 Admin status
    ];
    for (const url of candidates) {
      try {
        console.log(`[Botpress] Checking health at: ${url}`);
        const res = await fetch(url, {
          headers: this.headers,
          next: { revalidate: 0 },
        });
        if (!res.ok) {
          console.error(`[Botpress] Health check failed at ${url}: ${res.status} ${res.statusText}`);
          continue;
        }
        const data = await res.json();
        console.log(`[Botpress] Health check passed at ${url}`);
        return data;
      } catch (error) {
        console.error(`[Botpress] Health check connection error at ${url}:`, error);
        continue;
      }
    }
    return null; // offline but app continues
  }

  static async configureMessenger(
    botId: string,
    config: BotpressMessengerConfig
  ) {
    const url = `${BP_URL}/api/v1/admin/bots/${botId}/config/channel-messenger`;
    const res = await fetch(url, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ ...config, enabled: true }),
    });
    if (!res.ok) throw new Error(await res.text());
    return true;
  }
}
