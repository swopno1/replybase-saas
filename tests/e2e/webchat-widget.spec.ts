import { expect, test } from "@playwright/test";

async function mockWebchatApis(page: Parameters<typeof test>[0]["page"]) {
  await page.route("**/api/webchat/config**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        channelId: "chan_e2e",
        botId: "bot_e2e",
        siteId: "site_e2e",
        publicKey: "wpk_e2e_public_key",
        initChallenge: { token: "challenge_e2e" },
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
}

function storageKey(publicKey = "wpk_e2e_public_key") {
  return `replybase_webchat_session:${publicKey}`;
}

test.describe("Webchat widget", () => {
  test("opens widget and sends message via mocked webchat APIs", async ({
    page,
  }) => {
    await mockWebchatApis(page);

    await page.goto("/webchat-e2e");
    await expect(page.getByTestId("e2e-status")).toHaveText("ready");

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

    await expect(page.getByText("Mocked bot reply")).toBeVisible();
  });

  test("shows origin error when config request is blocked", async ({
    page,
  }) => {
    await page.route("**/api/webchat/config**", async (route) => {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ error: "Origin not allowed" }),
      });
    });

    await page.goto("/webchat-e2e");
    await expect(page.getByTestId("e2e-status")).toHaveText("ready");

    await page.locator("#replybase-webchat-root .rb-button").click();

    await expect(page.getByText("Origin not allowed")).toBeVisible();
  });

  test("requires consent before initialization and recovers after consent event", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      (window as typeof window & { e2eConsent?: boolean }).e2eConsent = false;
    });
    await mockWebchatApis(page);

    await page.goto(
      "/webchat-e2e?cookieConsent=required&cookieConsentCheck=e2eConsent",
    );
    await expect(page.getByTestId("e2e-status")).toHaveText("ready");

    await page.locator("#replybase-webchat-root .rb-button").click();

    await expect(
      page.getByText(
        "Cookie consent is required before webchat can store session data or connect to the ReplyBase runtime.",
      ),
    ).toBeVisible();
    await expect(
      page.locator("#replybase-webchat-root .rb-input"),
    ).toBeDisabled();

    await page.evaluate(() => {
      (window as typeof window & { e2eConsent?: boolean }).e2eConsent = true;
      window.dispatchEvent(new Event("replybase:webchat-consent-updated"));
    });

    await expect(
      page.locator("#replybase-webchat-root .rb-input"),
    ).toBeEnabled();
    await expect(page.getByText("Welcome from mocked config")).toBeVisible();
  });

  test("uses fullscreen mobile mode when configured", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockWebchatApis(page);

    await page.goto("/webchat-e2e?mobileMode=fullscreen");
    await expect(page.getByTestId("e2e-status")).toHaveText("ready");

    const host = page.locator("#replybase-webchat-root");
    await expect(host).toHaveAttribute("data-mobile-fullscreen", "true");

    await page.locator("#replybase-webchat-root .rb-button").click();
    await expect(host).toHaveAttribute("data-open", "true");
    await expect(page.locator("#replybase-webchat-root .rb-panel")).toHaveClass(
      /open/,
    );
  });

  test("reuses stored visitorId on subsequent init after reload", async ({
    page,
  }) => {
    const initPayloads: Array<Record<string, unknown>> = [];

    await page.route("**/api/webchat/config**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          channelId: "chan_e2e",
          botId: "bot_e2e",
          siteId: "site_e2e",
          publicKey: "wpk_e2e_public_key",
          initChallenge: { token: "challenge_e2e" },
          telemetry: { mode: "off", sampleRates: {} },
          config: {
            title: "E2E Assistant",
            welcomeMessage: "Welcome from mocked config",
          },
        }),
      });
    });

    await page.route("**/api/webchat/init", async (route) => {
      const payload = route.request().postDataJSON() as Record<string, unknown>;
      initPayloads.push(payload);

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
    await expect(page.getByTestId("e2e-status")).toHaveText("ready");
    await page.locator("#replybase-webchat-root .rb-button").click();

    await expect.poll(() => initPayloads.length).toBe(1);
    await expect
      .poll(() =>
        page.evaluate((key) => window.localStorage.getItem(key), storageKey()),
      )
      .not.toBeNull();

    await page.reload();
    await expect(page.getByTestId("e2e-status")).toHaveText("ready");
    await page.locator("#replybase-webchat-root .rb-button").click();

    await expect.poll(() => initPayloads.length).toBe(2);
    expect(initPayloads[0].visitorId).toBeUndefined();
    expect(initPayloads[1].visitorId).toBe("visitor_e2e");
  });

  test("emits telemetry events for open, typing, message, and close", async ({
    page,
  }) => {
    const eventPayloads: Array<Record<string, unknown>> = [];
    await mockWebchatApis(page);

    await page.unroute("**/api/webchat/events");
    await page.route("**/api/webchat/events", async (route) => {
      eventPayloads.push(
        route.request().postDataJSON() as Record<string, unknown>,
      );
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, sampled: true, sampleRate: 1 }),
      });
    });

    await page.goto("/webchat-e2e");
    await expect(page.getByTestId("e2e-status")).toHaveText("ready");

    await page.locator("#replybase-webchat-root .rb-button").click();
    const input = page.locator("#replybase-webchat-root .rb-input");
    await input.click();
    await input.type("Hello from Playwright telemetry");
    await page.locator("#replybase-webchat-root .rb-send").click();
    await page.locator("#replybase-webchat-root .rb-close").click();

    await expect.poll(() => eventPayloads.length).toBeGreaterThanOrEqual(4);

    const eventTypes = eventPayloads.map((payload) => payload.type);
    expect(eventTypes).toContain("OPEN");
    expect(eventTypes).toContain("TYPING");
    expect(eventTypes).toContain("MESSAGE");
    expect(eventTypes).toContain("CLOSE");
  });

  test("shows rollout-denied error when init is blocked by rollout policy", async ({
    page,
  }) => {
    await page.route("**/api/webchat/config**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          channelId: "chan_e2e",
          botId: "bot_e2e",
          siteId: "site_e2e",
          publicKey: "wpk_e2e_public_key",
          initChallenge: { token: "challenge_e2e" },
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
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Webchat is not enabled for this tenant",
          reason: "pilot_only",
        }),
      });
    });

    await page.goto("/webchat-e2e");
    await expect(page.getByTestId("e2e-status")).toHaveText("ready");
    await page.locator("#replybase-webchat-root .rb-button").click();

    await expect(
      page.getByText("Webchat is not enabled for this tenant"),
    ).toBeVisible();
  });
});
