import { google, createGoogleGenerativeAI } from "@ai-sdk/google";
import { openai, createOpenAI } from "@ai-sdk/openai";
import { anthropic, createAnthropic } from "@ai-sdk/anthropic";
import { LanguageModel } from "ai";

export type AiProvider = "gemini" | "openai" | "anthropic";

export interface GetAiModelOptions {
  provider: AiProvider;
  apiKey?: string;
  planName?: string;
}

/**
 * Returns the appropriate AI model based on provider and plan.
 * If a custom API key is provided, it uses it for OpenAI and Anthropic.
 * Gemini currently uses the system-wide key from environment variables.
 */
export function getAiModel({
  provider,
  apiKey,
  planName = "free",
}: GetAiModelOptions): LanguageModel {
  const plan = planName.toLowerCase();
  const isPro = plan.includes("pro") || plan.includes("business");

  switch (provider) {
    case "openai": {
      const client = createOpenAI({
        apiKey: apiKey || process.env.OPENAI_API_KEY,
      });
      return client(isPro ? "gpt-4o" : "gpt-4o-mini");
    }

    case "anthropic": {
      const client = createAnthropic({
        apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
      });
      return client(
        isPro ? "claude-3-5-sonnet-latest" : "claude-3-haiku-latest",
      );
    }

    case "gemini":
    default: {
      const client = createGoogleGenerativeAI({
        apiKey: apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      });
      return client(isPro ? "gemini-1.5-pro" : "gemini-1.5-flash");
    }
  }
}
