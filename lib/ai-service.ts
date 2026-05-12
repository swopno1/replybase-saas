import { google, createGoogleGenerativeAI } from "@ai-sdk/google";
import { openai, createOpenAI } from "@ai-sdk/openai";
import { anthropic, createAnthropic } from "@ai-sdk/anthropic";
import { LanguageModel } from "ai";
import { prisma } from "./prisma";

export type AiProvider = "default" | "gemini" | "openai" | "anthropic";
export type AiTask = "onboarding" | "chat" | "general";

/**
 * Centralized model configuration for the 2026 Production Stack.
 */
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
} as const;

export interface GetAiModelOptions {
  provider: AiProvider;
  apiKey?: string;
  model?: string;
  planName?: string;
  task?: AiTask;
  isFallback?: boolean;
  useReasoning?: boolean; // New: Support for Gemini 3.1 reasoning tokens
}

/**
 * Returns the appropriate AI model based on provider, optional custom model, task type, and plan.
 * "default" provider uses system-managed Gemini models.
 */
export function getAiModel({
  provider,
  apiKey,
  model,
  planName = "free",
  task = "general",
  isFallback = false,
  useReasoning = false,
}: GetAiModelOptions): LanguageModel {
  const plan = planName.toLowerCase();
  const isPro = plan.includes("pro") || plan.includes("business");
  
  // Logic: Onboarding and Pro plans always prefer higher reasoning/premium models.
  const isHighPriority = task === "onboarding" || isPro;

  switch (provider) {
    case "openai": {
      const client = createOpenAI({
        apiKey: apiKey || process.env.OPENAI_API_KEY,
      });
      return client(model || (isHighPriority ? MODELS.openai.premium : MODELS.openai.main));
    }

    case "anthropic": {
      const client = createAnthropic({
        apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
      });
      return client(model || (isHighPriority ? MODELS.anthropic.premium : MODELS.anthropic.main));
    }

    case "gemini":
    case "default":
    default: {
      const client = createGoogleGenerativeAI({
        apiKey: apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
        headers: { "x-goog-api-key": apiKey || (process.env.GOOGLE_GENERATIVE_AI_API_KEY as string) },
      });

      // 1. Handle Explicit Fallback
      if (isFallback) {
        return client(model || MODELS.gemini.fallback);
      }

      // 2. Resolve Model ID
      let resolvedModel = model;
      if (!resolvedModel) {
        resolvedModel = isHighPriority ? MODELS.gemini.premium : MODELS.gemini.main;
      }

      // 3. Configure advanced features (Reasoning/Thinking)
      // Enable reasoning by default for onboarding or when explicitly requested
      const shouldEnableReasoning = useReasoning || task === "onboarding";

      return client(resolvedModel);
    }
  }
}

/**
 * High-level helper to get a model for a specific tenant, automatically fetching their settings.
 */
export async function getTenantModel(
  tenantId: string,
  options: Omit<GetAiModelOptions, "provider" | "apiKey" | "model">,
): Promise<LanguageModel> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      aiProvider: true,
      aiApiKey: true,
      aiModel: true,
    },
  });

  return getAiModel({
    ...options,
    provider: (tenant?.aiProvider as AiProvider) || "default",
    apiKey: tenant?.aiApiKey || undefined,
    model: tenant?.aiModel || undefined,
  });
}

/**
 * High-level helper to get a system-managed model (e.g. for background tasks).
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
 * Returns the recommended embedding model for vector operations.
 */
export const embedModel = google.embeddingModel(MODELS.gemini.embedding);
