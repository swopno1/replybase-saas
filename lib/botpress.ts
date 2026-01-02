
const BP_URL = process.env.BP_BASE_URL || "http://replybase-botpress:3002"; // Internal Docker URL preferred if server-side
const BP_TOKEN = process.env.BOTPRESS_ADMIN_TOKEN;

export class BotpressService {

    private static get headers() {
        return {
            "Authorization": `Bearer ${BP_TOKEN}`,
            "Content-Type": "application/json"
        };
    }

    static async getHealth() {
        try {
            // Using internal URL for server-side calls
            const url = "http://replybase-botpress:3002/api/v1/info";
            const res = await fetch(url, {
                headers: this.headers,
                next: { revalidate: 0 }
            });
            if (!res.ok) throw new Error(`Status ${res.status}`);
            return await res.json();
        } catch (error) {
            console.error("Botpress Health Check Failed:", error);
            return null;
        }
    }

    static async configureMessenger(botId: string, config: any) {
        const url = `http://replybase-botpress:3002/api/v1/admin/bots/${botId}/config/channel-messenger`;
        const res = await fetch(url, {
            method: "POST",
            headers: this.headers,
            body: JSON.stringify({
                ...config,
                enabled: true
            })
        });
        if (!res.ok) {
            const txt = await res.text();
            throw new Error(txt);
        }
        return true;
    }
}
