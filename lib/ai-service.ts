import { google, createGoogleGenerativeAI } from "@ai-sdk/google";
import { openai, createOpenAI } from "@ai-sdk/openai";
import { anthropic, createAnthropic } from "@ai-sdk/anthropic";
import { LanguageModel } from "ai";
import { prisma } from "./prisma";

// --- 1. TYPES & SCHEMA ---
export type AiProvider = "default" | "gemini" | "openai" | "anthropic" | "digitalocean";
export type AiTask = "onboarding" | "chat" | "general" | "summary" | "tagging" | "intent" | "analysis";

export interface GetAiModelOptions {
  provider: AiProvider;
  apiKey?: string;
  model?: string;
  planName?: string;
  task?: AiTask;
  isFallback?: boolean;
}

// --- 2. THE MODEL DIRECTORY (PROVIDER IDs) ---
const MODELS = {
  gemini: {
    main: "gemini-1.5-flash",
    premium: "gemini-1.5-pro",
    fallback: "gemini-1.5-flash",
    embedding: "text-embedding-004",
  },
  openai: {
    main: "gpt-4o-mini",
    premium: "gpt-4o",
  },
  anthropic: {
    main: "claude-3-haiku-latest",
    premium: "claude-3-5-sonnet-latest",
  },
  digitalocean: {
    main: "meta-llama-3-8b",
    premium: "meta-llama-3-70b",
  }
} as const;

// --- 3. THE ROUTING TABLE (ORCHESTRATION RULES) ---
// This defines which provider/model is used for which task by default.
const TASK_ROUTING: Record<AiTask, { provider: AiProvider; model: string; priority: string }> = {
  chat: {
    provider: "digitalocean",
    model: MODELS.digitalocean.main,
    priority: "latency",
  },
  onboarding: {
    provider: "openai",
    model: MODELS.openai.premium,
    priority: "reasoning",
  },
  summary: {
    provider: "digitalocean",
    model: MODELS.digitalocean.main,
    priority: "cost",
  },
  tagging: {
    provider: "digitalocean",
    model: MODELS.digitalocean.main,
    priority: "latency",
  },
  intent: {
    provider: "digitalocean",
    model: MODELS.digitalocean.main,
    priority: "latency",
  },
  analysis: {
    provider: "gemini",
    model: MODELS.gemini.main,
    priority: "context",
  },
  general: {
    provider: "digitalocean",
    model: MODELS.digitalocean.main,
    priority: "latency",
  }
};

// --- 4. THE CORE EXECUTION ENGINE ---
export function getAiModel({
  provider,
  apiKey,
  model,
  planName = "free",
  task = "general",
  isFallback = false,
}: GetAiModelOptions): LanguageModel {
  const plan = planName.toLowerCase();
  const isPro = plan.includes("pro") || plan.includes("business");

  // A. Resolve System Defaults if provider is "default"
  let resolvedProvider = provider;
  let resolvedModel = model;

  if (provider === "default") {
    const config = TASK_ROUTING[task] || TASK_ROUTING.general;
    resolvedProvider = config.provider;
    resolvedModel = resolvedModel || config.model;
  }

  // B. Priority Logic: Pro plans and Onboarding always prefer premium models.
  const isHighPriority = task === "onboarding" || isPro;

  // C. Initialize Provider SDKs
  switch (resolvedProvider) {
    case "digitalocean": {
      const client = createOpenAI({
        apiKey: apiKey || process.env.DIGITALOCEAN_AI_KEY,
        baseURL: process.env.DIGITALOCEAN_AI_BASE_URL || "https://inference.do-ai.run/v1",
      });
      return client(resolvedModel || (isHighPriority ? MODELS.digitalocean.premium : MODELS.digitalocean.main));
    }

    case "openai": {
      const client = createOpenAI({
        apiKey: apiKey || process.env.OPENAI_API_KEY,
      });
      return client(resolvedModel || (isHighPriority ? MODELS.openai.premium : MODELS.openai.main));
    }

    case "anthropic": {
      const client = createAnthropic({
        apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
      });
      return client(resolvedModel || (isHighPriority ? MODELS.anthropic.premium : MODELS.anthropic.main));
    }

    case "gemini":
    default: {
      const client = createGoogleGenerativeAI({
        apiKey: apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      });

      if (isFallback) return client(resolvedModel || MODELS.gemini.fallback);
      
      if (!resolvedModel) {
        resolvedModel = isHighPriority ? MODELS.gemini.premium : MODELS.gemini.main;
      }
      return client(resolvedModel);
    }
  }
}

// --- 5. HIGH-LEVEL HELPERS ---

/**
 * Gets a model for a specific tenant, respecting their custom API settings if provided.
 */
export async function getTenantModel(
  tenantId: string,
  options: Omit<GetAiModelOptions, "provider" | "apiKey" | "model">,
): Promise<LanguageModel> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { aiProvider: true, aiApiKey: true, aiModel: true },
  });

  return getAiModel({
    ...options,
    provider: (tenant?.aiProvider as AiProvider) || "default",
    apiKey: tenant?.aiApiKey || undefined,
    model: tenant?.aiModel || undefined,
  });
}

/**
 * Gets a system-managed model (e.g. for background automation) based on task config.
 */
export function getSystemModel(
  options: Omit<GetAiModelOptions, "provider" | "apiKey" | "model">,
): LanguageModel {
  return getAiModel({
    ...options,
    provider: "default",
  });
}

/**
 * Standard embedding model for vector operations.
 */
export const embedModel = google.embeddingModel(MODELS.gemini.embedding);
