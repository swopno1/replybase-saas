import { google, createGoogleGenerativeAI } from "@ai-sdk/google";
import { openai, createOpenAI } from "@ai-sdk/openai";
import { anthropic, createAnthropic } from "@ai-sdk/anthropic";
import { LanguageModel } from "ai";
import { prisma } from "./prisma";

export type AiProvider = "default" | "gemini" | "openai" | "anthropic" | "digitalocean";
export type AiTask = "onboarding" | "chat" | "general";

/**
 * Resolves the model configuration at runtime to allow for environment variable overrides.
 */
function getModelConfig() {
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
      main: process.env.AI_MODEL_DO_MAIN || "llama-3.1-8b-instruct",
      premium: process.env.AI_MODEL_DO_PREMIUM || "llama-3.1-70b-instruct",
      fallback: process.env.AI_MODEL_DO_FALLBACK || "llama-3.1-8b-instruct",
    },
  };
}

export interface GetAiModelOptions {
  provider: AiProvider;
  apiKey?: string;
  model?: string;
  planName?: string;
  task?: AiTask;
  isFallback?: boolean;
  useReasoning?: boolean; // Support for Reasoning/Thinking models
}

/**
 * Returns the appropriate AI model based on provider, optional custom model, task type, and plan.
 * "default" provider can be configured via DEFAULT_AI_PROVIDER env var (defaults to gemini).
 */
export function getAiModel(options: GetAiModelOptions): LanguageModel {
  const {
    provider,
    apiKey,
    model: manualModel,
    planName = "free",
    task = "general",
    isFallback = false,
    useReasoning = false,
  } = options;

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
  const config = getModelConfig();

  // Resolve "default" provider
  let effectiveProvider = provider;
  if (provider === "default") {
    effectiveProvider = (process.env.DEFAULT_AI_PROVIDER as AiProvider) || "gemini";
    // Avoid infinite loop if DEFAULT_AI_PROVIDER is set to "default"
    if (effectiveProvider === "default") effectiveProvider = "gemini";
  }

  switch (effectiveProvider) {
    case "openai": {
      const client = createOpenAI({
        apiKey: apiKey || process.env.OPENAI_API_KEY,
      });
      return client(manualModel || (isHighPriority ? config.openai.premium : config.openai.main));
    }

    case "anthropic": {
      const client = createAnthropic({
        apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
      });
      return client(manualModel || (isHighPriority ? config.anthropic.premium : config.anthropic.main));
    }

    case "digitalocean": {
      // DigitalOcean AI Inference is OpenAI-compatible
      const client = createOpenAI({
        baseURL: "https://inference.do-ai.run/v1",
        apiKey: apiKey || process.env.DIGITALOCEAN_TOKEN,
      });

      const doModelId = isFallback
        ? config.digitalocean.fallback
        : (isHighPriority ? config.digitalocean.premium : config.digitalocean.main);

      return client(manualModel || doModelId);
    }

    case "gemini":
    default: {
      const client = createGoogleGenerativeAI({
        apiKey: apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      });

      // 1. Handle Explicit Fallback
      if (isFallback) {
        return client(manualModel || config.gemini.fallback);
      }

      // 2. Resolve Model ID
      let resolvedModel = manualModel;
      if (!resolvedModel) {
        resolvedModel = isHighPriority ? config.gemini.premium : config.gemini.main;
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
export const embedModel = google.embeddingModel(getModelConfig().gemini.embedding);
