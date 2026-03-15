#!/usr/bin/env npx ts-node --skip-project

/**
 * Telegram Integration — E2E Test Suite
 *
 * Tests the complete Telegram integration stack without requiring real Telegram
 * credentials (basic mode), with optional live Telegram API checks when
 * environment variables are supplied.
 *
 * Usage:
 *   npx ts-node scripts/test-telegram.ts
 *
 * Optional environment variables:
 *   BASE_URL              – Running ReplyBase instance (default: http://localhost:3000)
 *   SESSION_COOKIE        – Authenticated session cookie value for protected endpoints
 *   TELEGRAM_TEST_TOKEN   – Real Telegram bot token for live API connectivity check
 *   TELEGRAM_TEST_CHAT_ID – Chat ID to send a test message to (requires TELEGRAM_TEST_TOKEN)
 *   TELEGRAM_TEST_CHANNEL_ID – Existing connected channel ID for webhook simulation
 *   TELEGRAM_TEST_SECRET  – Webhook secret for that channel (to test valid delivery)
 */

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const SESSION_COOKIE = process.env.SESSION_COOKIE ?? "";
const TELEGRAM_TEST_TOKEN = process.env.TELEGRAM_TEST_TOKEN ?? "";
const TELEGRAM_TEST_CHAT_ID = process.env.TELEGRAM_TEST_CHAT_ID ?? "";
const TELEGRAM_TEST_CHANNEL_ID = process.env.TELEGRAM_TEST_CHANNEL_ID ?? "";
const TELEGRAM_TEST_SECRET = process.env.TELEGRAM_TEST_SECRET ?? "";

// ─── helpers ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function ok(label: string) {
  passed++;
  console.log(`  ✓  ${label}`);
}

function fail(label: string, detail?: unknown) {
  failed++;
  failures.push(label);
  const extra = detail !== undefined ? ` → ${JSON.stringify(detail)}` : "";
  console.error(`  ✗  ${label}${extra}`);
}

async function get(
  path: string,
  auth = false,
): Promise<{ status: number; body: unknown }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (auth && SESSION_COOKIE) headers["Cookie"] = SESSION_COOKIE;
  const res = await fetch(`${BASE_URL}${path}`, { headers });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function post(
  path: string,
  payload: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

// ─── individual tests ─────────────────────────────────────────────────────────

async function testHealth() {
  console.log("\n[1] Health endpoint");
  const { status, body } = await get("/api/telegram/health");
  if (status === 200) {
    ok("GET /api/telegram/health returns 200");
  } else {
    fail("GET /api/telegram/health returns 200", { status, body });
  }
  const b = body as Record<string, unknown>;
  if (b?.status === "ok" && b?.service === "telegram") {
    ok("Health response has expected shape");
  } else {
    fail("Health response has expected shape", body);
  }
}

async function testUnauthenticatedAccess() {
  console.log(
    "\n[2] Unauthenticated access — all management endpoints must return 401",
  );

  const endpoints: Array<[string, string, unknown]> = [
    ["GET", "/api/telegram/status", null],
    ["POST", "/api/telegram/connect", { botId: "x", botToken: "fake" }],
    ["POST", "/api/telegram/disconnect", { channelId: "x" }],
    ["POST", "/api/telegram/reconnect", { channelId: "x" }],
    ["GET", "/api/telegram/logs?channelId=x", null],
  ];

  for (const [method, path, payload] of endpoints) {
    const { status } =
      method === "GET"
        ? await get(path, false)
        : await post(path, payload ?? {});
    if (status === 401) {
      ok(`${method} ${path} → 401 without auth`);
    } else {
      fail(`${method} ${path} → 401 without auth`, { status });
    }
  }
}

async function testWebhookEndpoint() {
  console.log("\n[3] Webhook endpoint behavior");

  // POST to a non-existent channel ID — should silently succeed (200) to avoid
  // Telegram retry storms, never 4xx/5xx external errors.
  const { status: s1 } = await post(
    "/api/telegram/webhook/00000000-0000-0000-0000-000000000000",
    {
      update_id: 1,
      message: {
        message_id: 1,
        text: "hello",
        chat: { id: 1 },
        from: { id: 1 },
      },
    },
  );
  if (s1 === 200) {
    ok("Webhook with unknown channelId returns 200 (silent ignore)");
  } else {
    fail("Webhook with unknown channelId returns 200 (silent ignore)", {
      status: s1,
    });
  }

  // Missing body (empty JSON object) — should not throw 500.
  const { status: s2 } = await post(
    "/api/telegram/webhook/00000000-0000-0000-0000-000000000000",
    {},
  );
  if (s2 === 200) {
    ok("Webhook with empty body returns 200");
  } else {
    fail("Webhook with empty body returns 200", { status: s2 });
  }

  // Test invalid secret against a known channel (if TEST_CHANNEL_ID is provided).
  if (TELEGRAM_TEST_CHANNEL_ID && TELEGRAM_TEST_SECRET) {
    const { status: s3 } = await post(
      `/api/telegram/webhook/${TELEGRAM_TEST_CHANNEL_ID}`,
      {
        update_id: 99999,
        message: {
          message_id: 1,
          text: "test",
          chat: { id: 1 },
          from: { id: 1 },
        },
      },
      { "x-telegram-bot-api-secret-token": "wrong-secret" },
    );
    if (s3 === 403) {
      ok("Webhook with wrong secret returns 403");
    } else {
      fail("Webhook with wrong secret returns 403", { status: s3 });
    }

    const { status: s4 } = await post(
      `/api/telegram/webhook/${TELEGRAM_TEST_CHANNEL_ID}`,
      {
        update_id: 99998,
        message: {
          message_id: 2,
          text: "ping",
          chat: { id: 1 },
          from: { id: 1, first_name: "Test" },
        },
      },
      { "x-telegram-bot-api-secret-token": TELEGRAM_TEST_SECRET },
    );
    if (s4 === 200) {
      ok("Webhook with correct secret returns 200");
    } else {
      fail("Webhook with correct secret returns 200", { status: s4 });
    }
  } else {
    console.log(
      "  –  Skipping secret-validation checks (TELEGRAM_TEST_CHANNEL_ID / TELEGRAM_TEST_SECRET not set)",
    );
  }
}

async function testCryptoRoundtrip() {
  console.log("\n[4] Token encryption round-trip");

  // Dynamic import to avoid top-level env dependency.
  const plainToken = "123456789:AAFake_Token_For_Testing_Only_Not_Real";

  // We can only run this if the encryption key is available.
  if (!process.env.TELEGRAM_TOKEN_ENCRYPTION_KEY && !process.env.AUTH_SECRET) {
    console.log(
      "  –  Skipping crypto round-trip (TELEGRAM_TOKEN_ENCRYPTION_KEY / AUTH_SECRET not set)",
    );
    return;
  }

  try {
    // Import inline so ts-node can resolve from the project root.
    const { encryptTelegramToken, decryptTelegramToken } =
      await import("../lib/telegram-crypto");

    const encrypted = encryptTelegramToken(plainToken);
    if (typeof encrypted === "string" && encrypted.split(":").length === 3) {
      ok("Encrypted token has expected iv:tag:data format");
    } else {
      fail("Encrypted token has expected iv:tag:data format", { encrypted });
      return;
    }

    const decrypted = decryptTelegramToken(encrypted);
    if (decrypted === plainToken) {
      ok("Decrypted token matches original");
    } else {
      fail("Decrypted token matches original");
    }

    // Tampering detection — flip one character in the ciphertext.
    const parts = encrypted.split(":");
    const tampered =
      parts[0] + ":" + parts[1] + ":" + (parts[2]!.slice(0, -1) + "X");
    try {
      decryptTelegramToken(tampered);
      fail("Tampered ciphertext should throw");
    } catch {
      ok("Tampered ciphertext throws (GCM authentication tag check)");
    }
  } catch (err) {
    fail("Crypto round-trip import/execution", err);
  }
}

async function testLiveTelegramAPI() {
  if (!TELEGRAM_TEST_TOKEN) {
    console.log(
      "\n[5] Live Telegram API — skipped (TELEGRAM_TEST_TOKEN not set)",
    );
    return;
  }

  console.log("\n[5] Live Telegram API (requires real bot token)");

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_TEST_TOKEN}/getMe`,
      { method: "POST", signal: AbortSignal.timeout(10_000) },
    );
    const data = (await res.json()) as Record<string, unknown>;
    if (data.ok && (data.result as Record<string, unknown>)?.is_bot === true) {
      const profile = data.result as Record<string, unknown>;
      ok(`getMe succeeded — bot: @${profile.username} (id: ${profile.id})`);
    } else {
      fail("getMe response.ok is true and result.is_bot is true", data);
    }
  } catch (err) {
    fail("getMe HTTP call succeeded", err);
  }

  if (TELEGRAM_TEST_CHAT_ID) {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_TEST_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: TELEGRAM_TEST_CHAT_ID,
            text: `[ReplyBase E2E] Telegram integration test — ${new Date().toISOString()}`,
          }),
          signal: AbortSignal.timeout(10_000),
        },
      );
      const data = (await res.json()) as Record<string, unknown>;
      if (data.ok) {
        ok(`sendMessage to chat ${TELEGRAM_TEST_CHAT_ID} succeeded`);
      } else {
        fail(`sendMessage to chat ${TELEGRAM_TEST_CHAT_ID} succeeded`, data);
      }
    } catch (err) {
      fail("sendMessage HTTP call succeeded", err);
    }
  } else {
    console.log(
      "  –  Skipping sendMessage test (TELEGRAM_TEST_CHAT_ID not set)",
    );
  }
}

async function testWebhookInfoEndpoint() {
  if (!SESSION_COOKIE) {
    console.log(
      "\n[6] Authenticated status endpoint — skipped (SESSION_COOKIE not set)",
    );
    return;
  }

  console.log("\n[6] Authenticated status endpoint");
  const { status, body } = await get("/api/telegram/status", true);
  if (status === 200) {
    ok("GET /api/telegram/status with auth returns 200");
  } else {
    fail("GET /api/telegram/status with auth returns 200", { status, body });
  }

  const b = body as Record<string, unknown>;
  if (typeof b?.connected === "boolean") {
    ok("Status response has 'connected' field");
  } else {
    fail("Status response has 'connected' field", body);
  }
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  Telegram Integration — E2E Test Suite");
  console.log(`  Target: ${BASE_URL}`);
  console.log("═══════════════════════════════════════════════════════");

  await testHealth();
  await testUnauthenticatedAccess();
  await testWebhookEndpoint();
  await testCryptoRoundtrip();
  await testLiveTelegramAPI();
  await testWebhookInfoEndpoint();

  console.log("\n═══════════════════════════════════════════════════════");
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.error("\n  Failed tests:");
    failures.forEach((f) => console.error(`    ✗  ${f}`));
  }
  console.log("═══════════════════════════════════════════════════════\n");

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error running test suite:", err);
  process.exit(1);
});
