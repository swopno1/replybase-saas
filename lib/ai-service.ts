import { google, createGoogleGenerativeAI } from "@ai-sdk/google";
import { openai, createOpenAI } from "@ai-sdk/openai";
import { anthropic, createAnthropic } from "@ai-sdk/anthropic";
import { LanguageModel } from "ai";
import { prisma } from "./prisma";
import logger from "./logger";

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

/**
 * Resolves the model configuration at runtime to allow for environment variable overrides.
 * This centralizes all model IDs in one place.
 */
export function getModelDirectory() {
  return {
    gemini: {
      main: process.env.AI_MODEL_GEMINI_MAIN || "gemini-1.5-flash",
      premium: process.env.AI_MODEL_GEMINI_PREMIUM || "gemini-1.5-pro",
      fallback: process.env.AI_MODEL_GEMINI_FALLBACK || "gemini-1.5-flash",
      embedding: "text-embedding-004",
    },
    openai: {
      main: process.env.AI_MODEL_OPENAI_MAIN || "gpt-4o-mini",
      premium: process.env.AI_MODEL_OPENAI_PREMIUM || "gpt-4o",
    },
    anthropic: {
      main: process.env.AI_MODEL_ANTHROPIC_MAIN || "claude-3-haiku-latest",
      premium: process.env.AI_MODEL_ANTHROPIC_PREMIUM || "claude-3-5-sonnet-latest",
    },
    digitalocean: {
      main: process.env.AI_MODEL_DO_MAIN || "meta-llama-3.1-8b-instruct",
      premium: process.env.AI_MODEL_DO_PREMIUM || "meta-llama-3.1-70b-instruct",
      fallback: process.env.AI_MODEL_DO_FALLBACK || "meta-llama-3.1-8b-instruct",
    },
  };
}

/**
 * Defines the default provider and model for each task type.
 * This allows us to shift workloads globally without changing business logic.
 */
export function getTaskRouting(): Record<AiTask, { provider: AiProvider; modelId?: string }> {
  return {
    chat: {
      provider: (process.env.DEFAULT_CHAT_PROVIDER as AiProvider) || "digitalocean",
      modelId: process.env.DEFAULT_CHAT_MODEL, 
    },
    onboarding: {
      provider: (process.env.DEFAULT_ONBOARDING_PROVIDER as AiProvider) || "openai",
      modelId: process.env.DEFAULT_ONBOARDING_MODEL,
    },
    summary: {
      provider: (process.env.DEFAULT_SUMMARY_PROVIDER as AiProvider) || "digitalocean",
    },
    tagging: {
      provider: (process.env.DEFAULT_TAGGING_PROVIDER as AiProvider) || "digitalocean",
    },
    intent: {
      provider: (process.env.DEFAULT_INTENT_PROVIDER as AiProvider) || "digitalocean",
    },
    analysis: {
      provider: (process.env.DEFAULT_ANALYSIS_PROVIDER as AiProvider) || "gemini",
    },
    general: {
      provider: (process.env.DEFAULT_AI_PROVIDER as AiProvider) || "gemini",
    }
  };
}

// --- 2. THE CORE EXECUTION ENGINE ---

/**
 * The primary factory function for creating AI models.
 * It handles provider initialization, task-based routing, and plan-based scaling.
 */
export function getAiModel(options: GetAiModelOptions): LanguageModel {
  const {
    provider,
    apiKey,
    model: manualModel,
    planName = "free",
    task = "general",
    isFallback = false,
  } = options;

  const plan = planName.toLowerCase();
  const isPro = plan.includes("pro") || plan.includes("business");
  const isHighPriority = task === "onboarding" || isPro;
  
  const models = getModelDirectory();
  const routing = getTaskRouting();

  // A. Resolve "default" provider and model
  let effectiveProvider = provider;
  let effectiveModel = manualModel;

  if (provider === "default") {
    const taskConfig = routing[task] || routing.general;
    effectiveProvider = taskConfig.provider;
    effectiveModel = effectiveModel || taskConfig.modelId;
  }

  // B. Initialize Provider SDKs
  let modelInstance: LanguageModel;

  switch (effectiveProvider) {
    case "digitalocean": {
      // DigitalOcean AI Inference is OpenAI-compatible
      const client = createOpenAI({
        baseURL: process.env.DIGITALOCEAN_AI_BASE_URL || "https://inference.do-ai.run/v1",
        apiKey: apiKey || process.env.DIGITALOCEAN_AI_KEY || process.env.DIGITALOCEAN_TOKEN,
      });

      const defaultModel = isFallback 
        ? models.digitalocean.fallback 
        : (isHighPriority ? models.digitalocean.premium : models.digitalocean.main);

      modelInstance = client(effectiveModel || defaultModel);
      break;
    }

    case "openai": {
      const client = createOpenAI({
        apiKey: apiKey || process.env.OPENAI_API_KEY,
      });
      modelInstance = client(effectiveModel || (isHighPriority ? models.openai.premium : models.openai.main));
      break;
    }

    case "anthropic": {
      const client = createAnthropic({
        apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
      });
      modelInstance = client(effectiveModel || (isHighPriority ? models.anthropic.premium : models.anthropic.main));
      break;
    }

    case "gemini":
    default: {
      const client = createGoogleGenerativeAI({
        apiKey: apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      });

      if (isFallback) {
        modelInstance = client(effectiveModel || models.gemini.fallback);
      } else {
        modelInstance = client(effectiveModel || (isHighPriority ? models.gemini.premium : models.gemini.main));
      }
      break;
    }
  }

  logger.debug({ 
    task, 
    provider: effectiveProvider, 
    model: effectiveModel || "auto", 
    isPro, 
    isFallback 
  }, "[AiService] Model Resolved");

  return modelInstance;
}

// --- 3. HIGH-LEVEL HELPERS ---

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
export const embedModel = google.embeddingModel(getModelDirectory().gemini.embedding);
