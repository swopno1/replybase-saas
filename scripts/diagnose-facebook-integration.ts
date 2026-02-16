#!/usr/bin/env ts-node

/**
 * Facebook Page Integration Diagnostic Tool
 *
 * This script performs a comprehensive audit of the Facebook integration pipeline
 * to identify why the "Get Started" trigger did not execute the flow.
 *
 * Test User: amirhossain.limon@gmail.com
 * Facebook Page: "Dreamer"
 * Trigger: "Get Started"
 */

import { prisma } from "../lib/prisma";

const TEST_EMAIL = "amirhossain.limon@gmail.com";
const PAGE_NAME = "Dreamer";

interface DiagnosticReport {
  phase: string;
  status: "PASS" | "FAIL" | "WARN" | "INFO";
  message: string;
  data?: Record<string, unknown>;
  recommendation?: string;
}

const results: DiagnosticReport[] = [];

function log(
  phase: string,
  status: "PASS" | "FAIL" | "WARN" | "INFO",
  message: string,
  data?: Record<string, unknown> | null,
  recommendation?: string,
) {
  results.push({
    phase,
    status,
    message,
    data: data ?? undefined,
    recommendation,
  });

  const colors = {
    PASS: "\x1b[32m", // Green
    FAIL: "\x1b[31m", // Red
    WARN: "\x1b[33m", // Yellow
    INFO: "\x1b[36m", // Cyan
  };

  const reset = "\x1b[0m";
  console.log(`${colors[status]}[${phase}] ${status}${reset}: ${message}`);

  if (data) {
    console.log("  Data:", JSON.stringify(data, null, 2));
  }

  if (recommendation) {
    console.log(`  💡 Recommendation: ${recommendation}`);
  }

  console.log("");
}

async function phase1_AuthenticationVerification() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("🔎 PHASE 1 — AUTHENTICATION VERIFICATION");
  console.log("═══════════════════════════════════════════════════════════\n");

  // Step 1.1 - Find User
  const user = await prisma.user.findUnique({
    where: { email: TEST_EMAIL },
    include: {
      tenant: true,
      accounts: {
        where: { provider: "facebook" },
      },
    },
  });

  if (!user) {
    log(
      "AUTH",
      "FAIL",
      `User with email ${TEST_EMAIL} not found`,
      null,
      "Ensure the user has registered and completed onboarding",
    );
    return null;
  }

  log("AUTH", "PASS", "User found", {
    user_id: user.id,
    name: user.name,
    tenant_id: user.tenantId,
    has_facebook_account: user.accounts.length > 0,
  });

  // Step 1.2 - Validate Facebook OAuth
  if (user.accounts.length === 0) {
    log(
      "AUTH",
      "FAIL",
      "No Facebook OAuth account linked",
      null,
      "User needs to connect their Facebook account via /integrations/facebook",
    );
    return null;
  }

  const fbAccount = user.accounts[0];
  const tokenExpired =
    fbAccount.expires_at && fbAccount.expires_at * 1000 < Date.now();

  log(
    "AUTH",
    tokenExpired ? "WARN" : "PASS",
    "Facebook OAuth record found",
    {
      provider_account_id: fbAccount.providerAccountId,
      has_access_token: !!fbAccount.access_token,
      token_expired: tokenExpired,
      scopes: fbAccount.scope,
      expires_at: fbAccount.expires_at
        ? new Date(fbAccount.expires_at * 1000).toISOString()
        : "N/A",
    },
    tokenExpired ? "Token expired - user needs to re-authenticate" : undefined,
  );

  return { user, fbAccount };
}

async function phase2_PageConnectionValidation(tenantId: string) {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("🔎 PHASE 2 — PAGE CONNECTION VALIDATION");
  console.log("═══════════════════════════════════════════════════════════\n");

  // Find the "Dreamer" page
  const page = await prisma.facebookPage.findFirst({
    where: {
      tenantId,
      name: {
        contains: PAGE_NAME,
        mode: "insensitive",
      },
    },
  });

  if (!page) {
    log(
      "PAGE",
      "FAIL",
      `Page "${PAGE_NAME}" not found for tenant`,
      { tenantId },
      "Connect the Facebook page via /integrations/facebook",
    );
    return null;
  }

  log("PAGE", "PASS", "Facebook page found in database", {
    page_id: page.id,
    facebook_id: page.facebookId,
    name: page.name,
    has_access_token: !!page.accessToken,
    bot_id: page.botId,
    engine_connected: page.engineConnected,
    tenant_id: page.tenantId,
  });

  // Validate page subscription (would need Graph API call - showing structure)
  log(
    "PAGE",
    "INFO",
    "Page subscription validation requires Graph API call",
    {
      note: "Use GET /{page_id}/subscribed_apps to verify app subscription",
      required_fields: ["messages", "messaging_postbacks", "messaging_optins"],
    },
    "Ensure webhook subscription includes messaging_postbacks for GET_STARTED",
  );

  if (!page.engineConnected) {
    log(
      "PAGE",
      "WARN",
      "Page not connected to AI engine",
      null,
      "Enable AI connection via /ai-status page",
    );
  }

  if (!page.botId) {
    log(
      "PAGE",
      "WARN",
      "Page has no associated bot",
      null,
      "A bot should be auto-created when enabling AI",
    );
  }

  return page;
}

async function phase3_WebhookVerification() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("🔎 PHASE 3 — WEBHOOK VERIFICATION");
  console.log("═══════════════════════════════════════════════════════════\n");

  const webhookUrl = process.env.NEXTAUTH_URL + "/api/facebook/webhook";
  const verifyToken = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN;
  const appSecret = process.env.FACEBOOK_CLIENT_SECRET;

  log(
    "WEBHOOK",
    verifyToken ? "PASS" : "FAIL",
    "Webhook configuration check",
    {
      webhook_url: webhookUrl,
      verify_token_set: !!verifyToken,
      app_secret_set: !!appSecret,
      subscription_fields: [
        "messages",
        "messaging_postbacks", // Required for GET_STARTED
        "messaging_optins",
        "message_deliveries",
        "message_reads",
      ],
    },
    !verifyToken
      ? "Set FACEBOOK_WEBHOOK_VERIFY_TOKEN environment variable"
      : undefined,
  );

  log("WEBHOOK", "INFO", "Webhook event handling", {
    handler: "/app/api/facebook/webhook/route.ts",
    postback_handler: "handleMessagingEvent() -> handles postback events",
    get_started_detection: 'Postback events are treated as "Hi" message',
    note: "GET_STARTED payload is converted to initial greeting",
  });

  return { webhookUrl, verifyToken };
}

async function phase4_FlowValidation(pageId: string, tenantId: string) {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("🔎 PHASE 4 — FLOW VALIDATION");
  console.log("═══════════════════════════════════════════════════════════\n");

  // Find all flows for tenant
  const flows = await prisma.flow.findMany({
    where: { tenantId },
    include: {
      nodes: {
        orderBy: { order: "asc" },
      },
      assignments: {
        where: { pageId },
        include: {
          page: true,
        },
      },
    },
  });

  log(
    "FLOW",
    flows.length > 0 ? "INFO" : "WARN",
    `Found ${flows.length} flow(s) for tenant`,
    {
      total_flows: flows.length,
      active_flows: flows.filter((f) => f.isActive).length,
    },
    flows.length === 0 ? "Create a flow via /flows page" : undefined,
  );

  // Check for active flow assignment to the Dreamer page
  const assignedFlow = flows.find((f) =>
    f.assignments.some((a) => a.pageId === pageId && a.isActive),
  );

  if (!assignedFlow) {
    log(
      "FLOW",
      "FAIL",
      `No active flow assigned to page "${PAGE_NAME}"`,
      {
        available_flows: flows.map((f) => ({
          id: f.id,
          name: f.name,
          isActive: f.isActive,
        })),
      },
      "Assign a flow to the page via /flows/[id]/settings",
    );
    return null;
  }

  const activeAssignment = assignedFlow.assignments.find((a) => a.isActive);

  log("FLOW", "PASS", "Active flow assignment found", {
    flow_id: assignedFlow.id,
    flow_name: assignedFlow.name,
    flow_active: assignedFlow.isActive,
    flow_status: assignedFlow.isActive ? "ACTIVE" : "INACTIVE",
    assignment_id: activeAssignment?.id,
    assignment_active: activeAssignment?.isActive,
    node_count: assignedFlow.nodes.length,
    first_node: assignedFlow.nodes[0]
      ? {
          type: assignedFlow.nodes[0].type,
          content: assignedFlow.nodes[0].content,
        }
      : null,
  });

  if (!assignedFlow.isActive) {
    log(
      "FLOW",
      "FAIL",
      "Flow is NOT ACTIVE",
      null,
      "Activate the flow via /flows page (toggle active state)",
    );
    return null;
  }

  if (assignedFlow.nodes.length === 0) {
    log(
      "FLOW",
      "WARN",
      "",
      null,
      "Flow has no nodes - add message/input nodes via flow editor",
    );
  }

  return assignedFlow;
}

async function phase5_ExecutionEngineTrace(pageId: string) {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("🔎 PHASE 5 — EXECUTION ENGINE TRACE");
  console.log("═══════════════════════════════════════════════════════════\n");

  log("ENGINE", "INFO", "Message handling pipeline analysis", {
    path: [
      "1. Webhook receives POST",
      "2. handleMessagingEvent(event)",
      "3. Handle postback: GET_STARTED",
      '4. Convert to message: "Hi"',
      '5. handleMessage(senderPsid, pageId, "Hi")',
      "6. Find facebookPage by pageId",
      "7. Check onboarding flow",
      "8. Check FlowExecutionEngine.executeFlow()",
      "9. Fall back to default bot flow or AI engine",
    ],
    critical_check: "FlowExecutionEngine.executeFlow() at step 8",
    code_location: "/app/api/facebook/webhook/route.ts:306",
  });

  // Check for recent flow sessions
  const recentSessions = await prisma.flowSession.findMany({
    where: { pageId },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: {
      flow: {
        select: { name: true },
      },
    },
  });

  log(
    "ENGINE",
    recentSessions.length > 0 ? "INFO" : "WARN",
    `Found ${recentSessions.length} recent flow session(s)`,
    {
      sessions: recentSessions.map((s) => ({
        id: s.id,
        user_id: s.userId,
        flow_name: s.flow.name,
        is_active: s.isActive,
        current_node: s.currentNodeId,
        created_at: s.createdAt,
        completed_at: s.completedAt,
      })),
    },
    recentSessions.length === 0
      ? "No flow executions detected - flow may not be triggering"
      : undefined,
  );

  // Check execution logic
  log("ENGINE", "INFO", "Flow execution trigger logic", {
    location: "/lib/flow-execution-engine.ts:56",
    trigger_check: [
      "1. Find active FlowAssignment for pageId",
      "2. Check flow.isActive = true",
      "3. Create or continue FlowSession",
      "4. Execute node based on type",
    ],
    failure_points: [
      "No active assignment found",
      "Flow not active",
      "Session state mismatch",
      "Node execution error",
    ],
  });

  return recentSessions;
}

async function phase6_TypebotBotGeneration(pageData: {
  id: string;
  botId: string | null;
  name: string;
}) {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("🔎 PHASE 6 — TYPEBOT / BOT GENERATION LOGIC");
  console.log("═══════════════════════════════════════════════════════════\n");

  if (!pageData.botId) {
    log(
      "BOT",
      "WARN",
      "No bot associated with page",
      null,
      "Bot should be auto-created when enabling AI engine",
    );
    return null;
  }

  const bot = await prisma.bot.findUnique({
    where: { id: pageData.botId },
    include: {
      channels: true,
    },
  });

  if (!bot) {
    log(
      "BOT",
      "FAIL",
      "Bot record not found",
      { botId: pageData.botId },
      "Recreate bot by toggling AI connection",
    );
    return null;
  }

  log("BOT", "PASS", "Bot instance found", {
    bot_id: bot.id,
    name: bot.name,
    enabled: bot.enabled,
    tenant_id: bot.tenantId,
    channels: bot.channels.length,
    entry_flow: bot.entryFlow,
  });

  log("BOT", "INFO", "Bot activation architecture", {
    note: "Flow Builder system is INDEPENDENT of Typebot",
    flow_storage: "Stored in flows/flow_nodes tables",
    execution: "Internal FlowExecutionEngine (not Typebot)",
    typebot_usage: "Only used if AI engine is called for custom responses",
    get_started_path: "Webhook -> Flow Engine -> Send message",
  });

  return bot;
}

async function phase7_MessageDeliveryCheck(pageId: string) {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("🔎 PHASE 7 — MESSAGE DELIVERY CHECK");
  console.log("═══════════════════════════════════════════════════════════\n");

  // Check recent messages
  const recentMessages = await prisma.crmMessage.findMany({
    where: {
      conversation: {
        facebookPageId: pageId,
      },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      conversation: {
        include: {
          contact: true,
        },
      },
    },
  });

  log(
    "MESSAGE",
    recentMessages.length > 0 ? "INFO" : "WARN",
    `Found ${recentMessages.length} recent message(s)`,
    {
      messages: recentMessages.map((m) => ({
        direction: m.direction,
        content: m.content.substring(0, 50),
        source: m.source,
        contact: m.conversation.contact.name,
        created_at: m.createdAt,
      })),
    },
    recentMessages.length === 0
      ? "No messages logged - webhook may not be receiving events"
      : undefined,
  );

  // Find GET_STARTED attempts
  const getStartedMessages = recentMessages.filter(
    (m) =>
      m.content.toLowerCase().includes("get started") ||
      m.content.toLowerCase() === "hi",
  );

  if (getStartedMessages.length > 0) {
    log("MESSAGE", "INFO", "GET_STARTED attempts detected", {
      count: getStartedMessages.length,
      latest: getStartedMessages[0],
    });
  } else {
    log(
      "MESSAGE",
      "WARN",
      "No GET_STARTED messages logged",
      null,
      "Postback may not be triggering or webhook not receiving events",
    );
  }

  return recentMessages;
}

async function phase8_DatabaseStateSnapshot(data: Record<string, unknown>) {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("🔎 PHASE 8 — DATABASE STATE SNAPSHOT");
  console.log("═══════════════════════════════════════════════════════════\n");

  const snapshot = {
    USER: {
      user_id: (data.user as { id?: string })?.id,
      tenant_id: (data.user as { tenantId?: string })?.tenantId,
      fb_user_id: (data.fbAccount as { providerAccountId?: string })
        ?.providerAccountId,
    },
    PAGE: {
      page_id: (data.page as { id?: string })?.id,
      page_token_valid: !!(data.page as { accessToken?: string })?.accessToken,
      engine_connected: (data.page as { engineConnected?: boolean })
        ?.engineConnected,
      bot_id: (data.page as { botId?: string })?.botId,
    },
    FLOW: {
      flow_id: (data.flow as { id?: string })?.id,
      active: (data.flow as { isActive?: boolean })?.isActive,
      assigned: !!(data.flow as { assignments?: unknown[] })?.assignments
        ?.length,
      trigger_type: "N/A - Flow Builder uses sequential nodes",
      node_count: (data.flow as { nodes?: unknown[] })?.nodes?.length || 0,
    },
    BOT: {
      bot_id: (data.bot as { id?: string })?.id,
      deployed: (data.bot as { enabled?: boolean })?.enabled,
      endpoint: "Internal execution (not external endpoint)",
    },
    WEBHOOK: {
      configured: !!process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN,
      url: process.env.NEXTAUTH_URL + "/api/facebook/webhook",
    },
    EXECUTION: {
      recent_sessions: (data.sessions as unknown[] | undefined)?.length || 0,
      recent_messages: (data.messages as unknown[] | undefined)?.length || 0,
    },
  };

  console.log(JSON.stringify(snapshot, null, 2));
  log("SNAPSHOT", "INFO", "Database state captured", snapshot);

  return snapshot;
}

async function phase9_RootCauseAnalysis() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("🔎 PHASE 9 — ROOT CAUSE ANALYSIS");
  console.log("═══════════════════════════════════════════════════════════\n");

  const failures = results.filter((r) => r.status === "FAIL");
  const warnings = results.filter((r) => r.status === "WARN");

  if (failures.length === 0) {
    log("ANALYSIS", "INFO", "No critical failures detected", {
      warnings: warnings.length,
      potential_issues: warnings.map((w) => w.message),
    });
  } else {
    log("ANALYSIS", "FAIL", "Critical failures identified", {
      failure_count: failures.length,
      failures: failures.map((f) => ({
        phase: f.phase,
        message: f.message,
        recommendation: f.recommendation,
      })),
    });
  }

  // Common failure patterns
  const patterns = {
    no_flow_assigned: failures.some((f) =>
      f.message.includes("No active flow assigned"),
    ),
    flow_inactive: failures.some((f) =>
      f.message.includes("Flow is NOT ACTIVE"),
    ),
    no_page_connection: failures.some((f) =>
      f.message.includes("not found for tenant"),
    ),
    no_oauth: failures.some((f) => f.message.includes("No Facebook OAuth")),
  };

  log("ANALYSIS", "INFO", "Failure pattern detection", patterns);

  return patterns;
}

async function phase10_FinalValidation() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("🔎 PHASE 10 — FINAL VALIDATION & RECOMMENDATIONS");
  console.log("═══════════════════════════════════════════════════════════\n");

  const criticalQuestions = {
    q1: "Does activating a flow automatically generate a bot?",
    a1: "No - Bots and Flows are separate. Bot is created when enabling AI on page.",

    q2: "Is the flow compiled before assignment?",
    a2: "No compilation needed - flows are stored as DB records and executed dynamically.",

    q3: "Is page assigned before activation?",
    a3: "Order does not matter - both flow.isActive and assignment.isActive must be true.",

    q4: "Is GET_STARTED registered as a postback?",
    a4: 'Yes - webhook handles postback events and converts to "Hi" message.',

    q5: "Is Typebot actually required or redundant?",
    a5: "For Flow Builder: Redundant. Typebot only used for AI engine responses, not flows.",
  };

  Object.entries(criticalQuestions).forEach(([key, value]) => {
    if (key.startsWith("q")) {
      const answerKey = key.replace("q", "a");
      console.log(`${value}`);
      console.log(
        `  ${criticalQuestions[answerKey as keyof typeof criticalQuestions]}\n`,
      );
    }
  });

  log("VALIDATION", "INFO", "Critical questions answered", criticalQuestions);
}

async function generateReport() {
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("📊 DIAGNOSTIC REPORT SUMMARY");
  console.log("═══════════════════════════════════════════════════════════\n");

  const passCount = results.filter((r) => r.status === "PASS").length;
  const failCount = results.filter((r) => r.status === "FAIL").length;
  const warnCount = results.filter((r) => r.status === "WARN").length;
  const infoCount = results.filter((r) => r.status === "INFO").length;

  console.log(`✅ PASS: ${passCount}`);
  console.log(`❌ FAIL: ${failCount}`);
  console.log(`⚠️  WARN: ${warnCount}`);
  console.log(`ℹ️  INFO: ${infoCount}`);
  console.log("");

  if (failCount > 0) {
    console.log("🔴 CRITICAL FAILURES:\n");
    results
      .filter((r) => r.status === "FAIL")
      .forEach((r) => {
        console.log(`[${r.phase}] ${r.message}`);
        if (r.recommendation) {
          console.log(`  → ${r.recommendation}`);
        }
        console.log("");
      });
  }

  if (warnCount > 0) {
    console.log("🟡 WARNINGS:\n");
    results
      .filter((r) => r.status === "WARN")
      .forEach((r) => {
        console.log(`[${r.phase}] ${r.message}`);
        if (r.recommendation) {
          console.log(`  → ${r.recommendation}`);
        }
        console.log("");
      });
  }

  // Production-ready flow activation lifecycle
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("✨ RECOMMENDED FLOW ACTIVATION LIFECYCLE");
  console.log("═══════════════════════════════════════════════════════════\n");

  console.log(`1. Create Flow
   POST /api/flows
   → Creates flow record with nodes

2. Configure Flow Nodes
   PUT /api/flows/:id
   → Add message, input, condition, action nodes

3. Assign to Page
   POST /api/flows/:id/assign
   → Links flow to Facebook page
   → Deactivates previous assignment on same page

4. Activate Flow
   PUT /api/flows/:id { isActive: true }
   → Enables flow for execution

5. Test Webhook
   Send test message or GET_STARTED from page
   → FlowExecutionEngine.executeFlow() triggers
   → Creates FlowSession
   → Executes nodes sequentially

6. Monitor
   Check flow_sessions table
   Check crm_messages table
   Review execution logs
`);
}

async function main() {
  console.log("\n");
  console.log(
    "███████╗ █████╗  ██████╗███████╗██████╗  ██████╗  ██████╗ ██╗  ██╗",
  );
  console.log(
    "██╔════╝██╔══██╗██╔════╝██╔════╝██╔══██╗██╔═══██╗██╔═══██╗██║ ██╔╝",
  );
  console.log(
    "█████╗  ███████║██║     █████╗  ██████╔╝██║   ██║██║   ██║█████╔╝ ",
  );
  console.log(
    "██╔══╝  ██╔══██║██║     ██╔══╝  ██╔══██╗██║   ██║██║   ██║██╔═██╗ ",
  );
  console.log(
    "██║     ██║  ██║╚██████╗███████╗██████╔╝╚██████╔╝╚██████╔╝██║  ██╗",
  );
  console.log(
    "╚═╝     ╚═╝  ╚═╝ ╚═════╝╚══════╝╚═════╝  ╚═════╝  ╚═════╝ ╚═╝  ╚═╝",
  );
  console.log("");
  console.log("        DIAGNOSTIC TOOL FOR MESSENGER INTEGRATION");
  console.log("");
  console.log(`Test User: ${TEST_EMAIL}`);
  console.log(`Page Name: ${PAGE_NAME}`);
  console.log(`Trigger: GET_STARTED\n`);

  try {
    // Phase 1: Authentication
    const authData = await phase1_AuthenticationVerification();
    if (!authData) {
      console.log("\n❌ Cannot proceed - authentication failed\n");
      await generateReport();
      return;
    }

    // Phase 2: Page Connection
    const page = await phase2_PageConnectionValidation(authData.user.tenantId);
    if (!page) {
      console.log("\n❌ Cannot proceed - page not connected\n");
      await generateReport();
      return;
    }

    // Phase 3: Webhook
    await phase3_WebhookVerification();

    // Phase 4: Flow
    const flow = await phase4_FlowValidation(page.id, authData.user.tenantId);

    // Phase 5: Execution Engine
    const sessions = await phase5_ExecutionEngineTrace(page.id);

    // Phase 6: Bot Generation
    const bot = await phase6_TypebotBotGeneration(page);

    // Phase 7: Message Delivery
    const messages = await phase7_MessageDeliveryCheck(page.id);

    // Phase 8: Snapshot
    await phase8_DatabaseStateSnapshot({
      user: authData.user,
      fbAccount: authData.fbAccount,
      page,
      flow,
      bot,
      sessions,
      messages,
    });

    // Phase 9: Root Cause
    await phase9_RootCauseAnalysis();

    // Phase 10: Final Validation
    await phase10_FinalValidation();

    // Generate Report
    await generateReport();
  } catch (error) {
    console.error("\n❌ Fatal error during diagnosis:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
