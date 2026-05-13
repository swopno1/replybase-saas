/**
 * ReplyBase Centralized Configuration
 * 
 * This file contains non-secret, static configuration for the application.
 * Environment variables should only be used to override these values in
 * specific environments (e.g., staging vs production).
 */

export const APP_CONFIG = {
  // --- Core Metadata ---
  meta: {
    name: "ReplyBase",
    url: process.env.NEXT_PUBLIC_APP_URL || "https://app.replybase.co.uk",
    baseUrl: process.env.NEXT_PUBLIC_BASE_URL || "https://app.replybase.co.uk",
    logLevel: process.env.LOG_LEVEL || "info",
    nodeEnv: process.env.NODE_ENV || "development",
    isDev: process.env.NODE_ENV === "development",
    isProd: process.env.NODE_ENV === "production",
    isBuild: process.env.NEXT_PHASE === "phase-production-build",
    strictDevLogin: process.env.STRICT_DEV_LOGIN === "true",
  },

  // --- Administration ---
  admin: {
    emails: (process.env.ADMIN_EMAILS || "replybase1@gmail.com").split(",").map(e => e.trim().toLowerCase()).filter(Boolean),
    initialEmail: process.env.INITIAL_ADMIN_EMAIL || "amirhossain.limon@gmail.com",
  },

  // --- AI Orchestration (DigitalOcean-Only Strategy) ---
  ai: {
    providers: {
      // All tasks default to DigitalOcean to use DIGITALOCEAN_AI_KEY
      chat: process.env.DEFAULT_CHAT_PROVIDER || "digitalocean",
      onboarding: process.env.DEFAULT_ONBOARDING_PROVIDER || "digitalocean", 
      analysis: process.env.DEFAULT_ANALYSIS_PROVIDER || "digitalocean",
      summary: process.env.DEFAULT_SUMMARY_PROVIDER || "digitalocean",
      default: process.env.DEFAULT_AI_PROVIDER || "digitalocean",
    },
    models: {
      openai: {
        main: process.env.AI_MODEL_OPENAI_MAIN || "gpt-oss-120b",
        utility: process.env.AI_MODEL_OPENAI_UTILITY || "gpt-5-nano",
        analysis: process.env.AI_MODEL_OPENAI_ANALYSIS || "qwen-3.5-397b",
      },
      anthropic: {
        main: process.env.AI_MODEL_ANTHROPIC_MAIN || "claude-sonnet-4.6",
      },
      digitalocean: {
        // DigitalOcean hosted models
        main: process.env.AI_MODEL_DO_MAIN || "gpt-oss-120b",
        premium: process.env.AI_MODEL_DO_PREMIUM || "llama-3.1-70b-instruct",
        utility: process.env.AI_MODEL_DO_UTILITY || "gpt-oss-20b",
      },
      gemini: {
        main: process.env.AI_MODEL_GEMINI_MAIN || "gemini-1.5-flash",
      },
    },
    baseUrl: process.env.DIGITALOCEAN_AI_BASE_URL || "https://inference.do-ai.run/v1",
  },

  // --- Webchat & Rollout ---
  webchat: {
    mitigationEnabled: process.env.WEBCHAT_BOT_MITIGATION_ENABLED !== "false",
    metricsEnabled: process.env.WEBCHAT_METRICS_ENABLED !== "false",
    rateLimitStore: process.env.WEBCHAT_RATE_LIMIT_STORE || "memory",
    rollout: {
      mode: (process.env.WEBCHAT_ROLLOUT_MODE || "ga").toLowerCase(),
      enabledTenants: (process.env.WEBCHAT_ENABLED_TENANT_IDS || "").split(",").map(id => id.trim()).filter(Boolean),
      disabledTenants: (process.env.WEBCHAT_DISABLED_TENANT_IDS || "").split(",").map(id => id.trim()).filter(Boolean),
      pilotTenants: (process.env.WEBCHAT_PILOT_TENANT_IDS || "").split(",").map(id => id.trim()).filter(Boolean),
      allowedPlans: (process.env.WEBCHAT_ALLOWED_PLAN_NAMES || "pro,business").split(",").map(p => p.trim().toLowerCase()).filter(Boolean),
    },
    constraints: {
      requireOrigin: process.env.WEBCHAT_REQUIRE_ORIGIN_OR_REFERER !== "false",
      strictMatch: process.env.WEBCHAT_STRICT_ORIGIN_REFERER_MATCH !== "false",
      allowWildcardInProd: process.env.WEBCHAT_ALLOW_WILDCARD_IN_PRODUCTION === "true",
    }
  },

  // --- KPI & Performance Thresholds ---
  kpi: {
    maxDaysFirstChannel: Number(process.env.KPI_MAX_DAYS_FIRST_CHANNEL) || 7,
    maxDaysFirstReply: Number(process.env.KPI_MAX_DAYS_FIRST_REPLY) || 3,
    maxWebhookFailureRate: Number(process.env.KPI_MAX_WEBHOOK_FAILURE_RATE) || 0.15,
    minEventAgeHours: Number(process.env.KPI_MIN_EVENT_AGE_HOURS) || 24,
  },

  // --- Marketing & Notifications ---
  email: {
    from: process.env.LEAD_NOTIFICATION_EMAIL_FROM || "ReplyBase Leads <noreply@replybase.co.uk>",
  },

  // --- Analytics ---
  analytics: {
    plausible: {
      src: process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_SRC || "https://analytics.replybase.co.uk/js/script.js",
      domain: process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN || "app.replybase.co.uk",
    },
    posthog: {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com",
    }
  }
} as const;
