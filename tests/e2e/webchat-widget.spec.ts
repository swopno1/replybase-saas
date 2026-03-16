import { expect, test } from "@playwright/test";

test.describe("Webchat widget", () => {
  test("opens widget and sends message via mocked webchat APIs", async ({ page }) => {
    await page.route("**/api/webchat/config**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          channelId: "chan_e2e",
          botId: "bot_e2e",
          siteId: "site_e2e",
          publicKey: "wpk_e2e_public_key",
          initChallenge: "challenge_e2e",
          telemetry: { mode: "off", sampleRates: {} },
          config: {
            title: "E2E Assistant",
            welcomeMessage: "Welcome from mocked config",
          },
        }),
      });
    });

    await page.route("**/api/webchat/init", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          token: "token_e2e",
          visitorId: "visitor_e2e",
          conversationId: "conv_e2e",
          webChatSessionId: "session_e2e",
          channelId: "chan_e2e",
          botId: "bot_e2e",
          siteId: "site_e2e",
          publicKey: "wpk_e2e_public_key",
          config: {
            title: "E2E Assistant",
            welcomeMessage: "Welcome from mocked init",
          },
          expiresIn: 86400,
        }),
      });
    });

    await page.route("**/api/webchat/message", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          conversationId: "conv_e2e",
          responses: [{ type: "text", text: "Mocked bot reply" }],
          meta: { mode: "ai" },
        }),
      });
    });

    await page.route("**/api/webchat/events", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, sampled: true, sampleRate: 1 }),
      });
    });

    await page.goto("/webchat-e2e");

    const host = page.locator("#replybase-webchat-root");
    await expect(host).toBeVisible();

    const launcher = page.locator("#replybase-webchat-root .rb-button");
    await launcher.click();

    const panel = page.locator("#replybase-webchat-root .rb-panel");
    await expect(panel).toHaveClass(/open/);

    const input = page.locator("#replybase-webchat-root .rb-input");
    await input.fill("Hello from Playwright");

    const send = page.locator("#replybase-webchat-root .rb-send");
    await send.click();

    await expect(
      page.locator("#replybase-webchat-root .rb-message.user"),
    ).toContainText("Hello from Playwright");

    await expect(
      page.locator("#replybase-webchat-root .rb-message.bot"),
    ).toContainText("Mocked bot reply");
  });
});
