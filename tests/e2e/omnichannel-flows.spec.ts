import { expect, test, type Page } from "@playwright/test";

// --- FLOW A: Lead Generation ---
test.describe("Omnichannel Flow A — Lead Generation", () => {
  test("User arrives on webchat, AI greets, and lead is captured", async ({ page }) => {
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    // 1. Mock the backend APIs to return realistic responses
    await page.route("**/api/webchat/config?*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          channelId: "chan_lead_gen",
          botId: "bot_lead_gen",
          publicKey: "wpk_lead_gen",
          initChallenge: { token: "challenge_1" },
          config: { title: "ReplyBase Lead Gen", welcomeMessage: "Hi! How can I help you today?" }
        })
      });
    });

    await page.route("**/api/webchat/init", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          token: "session_token_1",
          visitorId: "visitor_lead_1",
          conversationId: "conv_lead_1",
          botId: "bot_lead_gen",
          config: { welcomeMessage: "Hi! How can I help you today?" }
        })
      });
    });

    // 2. Visit the E2E page
    await page.goto("/webchat-e2e?publicKey=wpk_lead_gen");
    await expect(page.getByTestId("e2e-status")).toHaveText("ready", { timeout: 15000 });

    // 3. Open widget and verify greeting
    const host = page.locator("#replybase-webchat-root");
    await host.locator(".rb-button").click();
    await expect(page.getByText("Hi! How can I help you today?")).toBeVisible();

    // 4. Send a lead-related message
    await page.route("**/api/webchat/message", async (route) => {
      const { message } = route.request().postDataJSON();
      const lower = message.toLowerCase();
      if (lower.includes("pricing")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            responses: [{ type: "text", text: "Our pricing starts at $29/mo. Would you like to start a trial?" }],
            meta: { leadStatus: "interested" }
          })
        });
      } else if (lower.includes("yes") || lower.includes("trial")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            responses: [{ type: "text", text: "Great! Please provide your email to continue." }],
            meta: { leadStatus: "interested" }
          })
        });
      } else if (lower.includes("@")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            responses: [{ type: "text", text: "Thanks! I've created your trial account. You can complete checkout here: https://stripe.com/test-checkout" }],
            meta: { leadStatus: "converted", email: "test@example.com" }
          })
        });
      }
    });

    const input = host.locator(".rb-input");
    await input.fill("Tell me about pricing");
    await host.locator(".rb-send").click();
    await expect(page.getByText("Our pricing starts at $29/mo")).toBeVisible();

    await input.fill("Yes, I'd like a trial");
    await host.locator(".rb-send").click();
    await expect(page.getByText("Please provide your email")).toBeVisible();

    await input.fill("test@example.com");
    await host.locator(".rb-send").click();
    await expect(page.getByText("complete checkout here")).toBeVisible();
    await expect(page.getByText("https://stripe.com/test-checkout")).toBeVisible();
  });
});

// --- FLOW B: Support & Escalation ---
test.describe("Omnichannel Flow B — Support Escalation", () => {
    test("User asks support question, AI answers, then escalates to human", async ({ page }) => {
        await page.route("**/api/webchat/config?*", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    channelId: "chan_support",
                    botId: "bot_support",
                    publicKey: "wpk_support",
                    initChallenge: { token: "challenge_2" },
                    config: { title: "Support Bot", welcomeMessage: "How can I assist you?" }
                })
            });
        });
        
        await page.route("**/api/webchat/init", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    token: "session_token_2",
                    visitorId: "visitor_support_1",
                    conversationId: "conv_support_1",
                    botId: "bot_support"
                })
            });
        });

        await page.goto("/webchat-e2e?publicKey=wpk_support");
        await expect(page.getByTestId("e2e-status")).toHaveText("ready", { timeout: 15000 });
        const host = page.locator("#replybase-webchat-root");
        await host.locator(".rb-button").click();

        await page.route("**/api/webchat/message", async (route) => {
            const { message } = route.request().postDataJSON();
            if (message.includes("reset password")) {
                await route.fulfill({
                    status: 200,
                    body: JSON.stringify({
                        responses: [{ type: "text", text: "You can reset your password in Settings. Did that help?" }]
                    })
                });
            } else if (message.includes("talk to a human")) {
                await route.fulfill({
                    status: 200,
                    body: JSON.stringify({
                        responses: [{ type: "text", text: "Sure! I'm connecting you with a support agent. Please wait..." }],
                        meta: { handoff: true }
                    })
                });
            }
        });

        const input = host.locator(".rb-input");
        await input.fill("How do I reset password?");
        await host.locator(".rb-send").click();
        await expect(page.getByText("You can reset your password in Settings")).toBeVisible();

        await input.fill("I want to talk to a human");
        await host.locator(".rb-send").click();
        await expect(page.getByText("connecting you with a support agent")).toBeVisible();
    });
});
