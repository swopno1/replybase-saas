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

  // --- Infrastructure ---
  infra: {
    redisUrl: process.env.REDIS_URL || (process.env.NODE_ENV === "production" ? "" : "redis://localhost:6379"),
    upstash: {
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    }
  },

  // --- Administration ---
  admin: {
    emails: (process.env.ADMIN_EMAILS || "replybase1@gmail.com").split(",").map(e => e.trim().toLowerCase()).filter(Boolean),
    initialEmail: process.env.INITIAL_ADMIN_EMAIL || "amirhossain.limon@gmail.com",
  },

  // --- AI Orchestration (Standardized Multi-Provider) ---
  ai: {
    providers: {
      chat: process.env.DEFAULT_CHAT_PROVIDER || "digitalocean",
      onboarding: process.env.DEFAULT_ONBOARDING_PROVIDER || "digitalocean",
      analysis: process.env.DEFAULT_ANALYSIS_PROVIDER || "digitalocean",
      summary: process.env.DEFAULT_SUMMARY_PROVIDER || "digitalocean",
      default: process.env.DEFAULT_AI_PROVIDER || "digitalocean",
    },
    models: {
      openai: {
        main: process.env.AI_MODEL_OPENAI_MAIN || "openai-gpt-oss-120b",
        utility: process.env.AI_MODEL_OPENAI_UTILITY || "openai-o3-mini",
        premium: process.env.AI_MODEL_OPENAI_PREMIUM || "openai-gpt-oss-120b",
        analysis: process.env.AI_MODEL_OPENAI_ANALYSIS || "openai-o3-mini",
      },
      anthropic: {
        main: process.env.AI_MODEL_ANTHROPIC_MAIN || "claude-3-5-sonnet-latest",
        utility: process.env.AI_MODEL_ANTHROPIC_UTILITY || "claude-3-haiku-latest",
        premium: process.env.AI_MODEL_ANTHROPIC_PREMIUM || "claude-3-5-sonnet-latest",
        analysis: process.env.AI_MODEL_ANTHROPIC_ANALYSIS || "claude-3-5-sonnet-latest",
      },
      digitalocean: {
        // FIXED: Using exact IDs from DO documentation examples
        main: process.env.AI_MODEL_DO_MAIN || "openai-gpt-oss-120b",
        utility: process.env.AI_MODEL_DO_UTILITY || "openai-gpt-oss-20b",
        premium: process.env.AI_MODEL_DO_PREMIUM || "openai-gpt-oss-120b",
        analysis: process.env.AI_MODEL_DO_ANALYSIS || "gemma-4-31B-it",
      },
      gemini: {
        main: process.env.AI_MODEL_GEMINI_MAIN || "gemini-2.0-flash",
        premium: process.env.AI_MODEL_GEMINI_PREMIUM || "gemini-2.0-pro-exp-02-05",
        utility: process.env.AI_MODEL_GEMINI_UTILITY || "gemini-1.5-flash",
        analysis: process.env.AI_MODEL_GEMINI_ANALYSIS || "gemini-2.0-flash-lite-preview",
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
      mode: (process.env.WEBCHAT_ROLLOUT_MODE || "off").toLowerCase(),
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
      src: process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_SRC || "https://engine.replybase.co.uk/js/script.js",
      domain: process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN || "app.replybase.co.uk",
    },
    posthog: {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com",
    }
  }
} as const;
