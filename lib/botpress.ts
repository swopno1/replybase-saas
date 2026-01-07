const BP_URL =
  process.env.BOTPRESS_URL ||
  process.env.BP_BASE_URL ||
  (process.env.NODE_ENV === "production"
    ? "http://replybase-botpress:3002"
    : "http://localhost:3002");

const BP_TOKEN = process.env.BOTPRESS_ADMIN_TOKEN;

export class BotpressService {
  private static get headers() {
    return {
      Authorization: `Bearer ${BP_TOKEN}`,
      "Content-Type": "application/json",
    };
  }

  static async getHealth() {
    const candidates = [
      `${BP_URL}/api/v1/info`,
      `${BP_URL}/api/v1/admin/status`,
    ];
    for (const url of candidates) {
      try {
        const res = await fetch(url, {
          headers: this.headers,
          next: { revalidate: 0 },
        });
        if (!res.ok) continue; // try next
        return await res.json();
      } catch {
        continue; // non-blocking
      }
    }
    return null; // offline but app continues
  }

  static async configureMessenger(botId: string, config: any) {
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
