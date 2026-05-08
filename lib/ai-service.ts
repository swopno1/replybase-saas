import { google, createGoogleGenerativeAI } from "@ai-sdk/google";
import { openai, createOpenAI } from "@ai-sdk/openai";
import { anthropic, createAnthropic } from "@ai-sdk/anthropic";
import { LanguageModel } from "ai";

export type AiProvider = "default" | "gemini" | "openai" | "anthropic";
export type AiTask = "onboarding" | "chat" | "general";

export interface GetAiModelOptions {
  provider: AiProvider;
  apiKey?: string;
  model?: string;
  planName?: string;
  task?: AiTask;
  isFallback?: boolean;
}

/**
 * Returns the appropriate AI model based on provider, optional custom model, task type, and plan.
 * If a custom API key is provided, it uses it for the specified provider.
 * "default" provider uses system-managed Gemini/Gemma models.
 */
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

  // Logic: Onboarding ALWAYS prefers higher reasoning models.
  // Chat fallback ALWAYS prefers high-speed, low-cost models.
  const isHighPriority = task === "onboarding" || isPro;

  switch (provider) {
    case "openai": {
      const client = createOpenAI({
        apiKey: apiKey || process.env.OPENAI_API_KEY,
      });
      return client(model || (isHighPriority ? "gpt-4o" : "gpt-4o-mini"));
    }

    case "anthropic": {
      const client = createAnthropic({
        apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
      });
      return client(
        model || (isHighPriority ? "claude-3-5-sonnet-latest" : "claude-3-haiku-latest"),
      );
    }

    case "gemini":
    case "default":
    default: {
      // System-managed Gemini/Gemma
      const client = createGoogleGenerativeAI({
        apiKey: apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      });

      // If this is a fallback request, use a high-RPM Gemini model
      if (isFallback) {
        return client("gemini-1.5-flash"); // High RPM, low cost fallback
      }

      // Task-specific defaults for the available Gemini versions
      let defaultModel = "gemini-1.5-flash"; 
      if (task === "onboarding") {
        defaultModel = "gemini-1.5-pro"; 
      }

      return client(model || defaultModel);
    }
  }
}
