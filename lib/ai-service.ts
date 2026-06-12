import { google, createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { LanguageModel } from "ai";
import { prisma } from "./prisma";
import { APP_CONFIG } from "./config";
import * as Sentry from "@sentry/nextjs";

export type AiProvider =
  | "default"
  | "gemini"
  | "openai"
  | "anthropic"
  | "digitalocean";
export type AiTask =
  | "onboarding"
  | "chat"
  | "general"
  | "summary"
  | "tagging"
  | "intent"
  | "analysis";

export interface GetAiModelOptions {
  provider: AiProvider;
  apiKey?: string;
  model?: string;
  planName?: string;
  task?: AiTask;
  isFallback?: boolean;
}

export function getModelDirectory() {
  const config = APP_CONFIG.ai.models;
  return {
    gemini: {
      main: config.gemini.main,
      utility: config.gemini.utility,
      premium: config.gemini.premium,
      analysis: config.gemini.analysis,
      fallback: config.gemini.main,
      embedding: "text-embedding-004",
    },
    openai: {
      main: config.openai.main,
      utility: config.openai.utility,
      premium: config.openai.premium,
      analysis: config.openai.analysis,
    },
    anthropic: {
      main: config.anthropic.main,
      utility: config.anthropic.utility,
      premium: config.anthropic.premium,
      analysis: config.anthropic.analysis,
    },
    digitalocean: {
      main: config.digitalocean.main,
      utility: config.digitalocean.utility,
      premium: config.digitalocean.premium,
      analysis: config.digitalocean.analysis,
      fallback: config.digitalocean.main,
    },
  };
}

export function getTaskRouting(): Record<
  AiTask,
  { provider: AiProvider; modelId?: string }
> {
  const providers = APP_CONFIG.ai.providers;
  return {
    chat: { provider: providers.chat as AiProvider },
    onboarding: { provider: providers.onboarding as AiProvider },
    summary: { provider: providers.summary as AiProvider },
    tagging: { provider: providers.summary as AiProvider },
    intent: { provider: providers.summary as AiProvider },
    analysis: { provider: providers.analysis as AiProvider },
    general: { provider: providers.default as AiProvider },
  };
}

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
  const isPro =
    plan.includes("scale") ||
    plan.includes("pro") ||
    plan.includes("grow") ||
    plan.includes("business");
  const isHighPriority = task === "onboarding" || isPro;
  const isUtilityTask =
    task === "intent" || task === "tagging" || task === "summary";
  const isAnalysisTask = task === "analysis";

  const models = getModelDirectory();
  const routing = getTaskRouting();

  let effectiveProvider = provider;
  let effectiveModel = manualModel;

  if (provider === "default") {
    const taskConfig = routing[task] || routing.general;
    effectiveProvider = taskConfig.provider;
    effectiveModel = effectiveModel || taskConfig.modelId;
  }

  let modelInstance: LanguageModel;

  switch (effectiveProvider) {
    case "openai": {
      const client = createOpenAI({
        apiKey: apiKey || process.env.OPENAI_API_KEY,
      });
      let defaultModel = models.openai.main;
      if (isAnalysisTask) defaultModel = models.openai.analysis;
      else if (isUtilityTask) defaultModel = models.openai.utility;
      modelInstance = client(effectiveModel || defaultModel);
      break;
    }

    case "anthropic": {
      const client = createAnthropic({
        apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
      });
      let defaultModel = models.anthropic.main;
      if (isAnalysisTask) defaultModel = models.anthropic.analysis;
      else if (isUtilityTask) defaultModel = models.anthropic.utility;
      else if (isHighPriority) defaultModel = models.anthropic.premium;
      modelInstance = client(effectiveModel || defaultModel);
      break;
    }

    case "gemini": {
      const client = createGoogleGenerativeAI({
        apiKey: apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      });
      let defaultModel = models.gemini.main;
      if (isAnalysisTask) defaultModel = models.gemini.analysis;
      else if (isUtilityTask) defaultModel = models.gemini.utility;
      else if (isHighPriority) defaultModel = models.gemini.premium;
      modelInstance = client(effectiveModel || defaultModel);
      break;
    }

    case "digitalocean":
    default: {
      const client = createOpenAI({
        baseURL: APP_CONFIG.ai.baseUrl,
        apiKey:
          apiKey ||
          process.env.DIGITALOCEAN_AI_KEY ||
          process.env.DIGITALOCEAN_TOKEN,
      } as any);

      let defaultModel = models.digitalocean.main;
      if (isFallback) defaultModel = models.digitalocean.main;
      else if (isAnalysisTask) defaultModel = models.digitalocean.analysis;
      else if (isUtilityTask) defaultModel = models.digitalocean.utility;
      else if (isHighPriority) defaultModel = models.digitalocean.premium;

      modelInstance = client.chat(effectiveModel || defaultModel);
      break;
    }
  }

  return Sentry.withActiveSpan(
    Sentry.startInactiveSpan({
      name: `AI Invocation - ${task}`,
      op: "ai.invocation",
      attributes: {
        "ai.provider": effectiveProvider,
        "ai.model": effectiveModel || "auto",
        "ai.task": task,
        "ai.is_fallback": isFallback,
        "ai.is_pro": isPro,
      },
    }),
    () => {
      Sentry.setTag("ai.provider", effectiveProvider);
      Sentry.setTag("ai.model", effectiveModel || "auto");
      Sentry.setTag("ai.task", task);
      Sentry.setTag("ai.is_fallback", isFallback);
      return modelInstance;
    },
  );
}

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

export function getSystemModel(
  options: Omit<GetAiModelOptions, "provider" | "apiKey" | "model">,
): LanguageModel {
  return getAiModel({ ...options, provider: "default" });
}

export const embedModel = google.embeddingModel(
  getModelDirectory().gemini.embedding,
);
