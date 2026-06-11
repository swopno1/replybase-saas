const APP_CONFIG = {
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
        main: process.env.AI_MODEL_OPENAI_MAIN || "gpt-oss-120b",
        utility: process.env.AI_MODEL_OPENAI_UTILITY || "gpt-5-nano",
        premium: process.env.AI_MODEL_OPENAI_PREMIUM || "gpt-oss-120b",
      },
      digitalocean: {
        main: process.env.AI_MODEL_DO_MAIN || "gpt-oss-120b",
        utility: process.env.AI_MODEL_DO_UTILITY || "gpt-oss-20b",
        premium: process.env.AI_MODEL_DO_PREMIUM || "llama-3.1-70b-instruct",
      },
    },
    baseUrl: process.env.DIGITALOCEAN_AI_BASE_URL || "https://inference.do-ai.run/v1",
  }
};

function getModelDirectory() {
  const config = APP_CONFIG.ai.models;
  return {
    openai: config.openai,
    digitalocean: config.digitalocean,
  };
}

function getTaskRouting() {
  const providers = APP_CONFIG.ai.providers;
  return {
    chat: { provider: providers.chat },
    onboarding: { provider: providers.onboarding },
    summary: { provider: providers.summary },
    intent: { provider: providers.summary },
    general: { provider: providers.default }
  };
}

function logResolution(task, plan, isFallback = false) {
  const models = getModelDirectory();
  const routing = getTaskRouting();
  const taskConfig = routing[task] || routing.general;
  const provider = taskConfig.provider;

  const isPro = plan.includes("scale") || plan.includes("grow") || plan.includes("business");
  const isHighPriority = task === "onboarding" || isPro;
  const isUtilityTask = task === "intent" || task === "tagging" || task === "summary";

  let resolvedModel = "unknown";
  if (provider === "digitalocean") {
    if (isFallback) resolvedModel = models.digitalocean.main;
    else if (isHighPriority) resolvedModel = models.digitalocean.premium;
    else if (isUtilityTask) resolvedModel = models.digitalocean.utility;
    else resolvedModel = models.digitalocean.main;
  } else if (provider === "openai") {
    resolvedModel = isUtilityTask ? models.openai.utility : models.openai.main;
  }

  console.log(`Task: ${task.padEnd(12)} | Plan: ${plan.padEnd(8)} | Fallback: ${isFallback ? "Yes" : "No "} | Provider: ${provider.padEnd(12)} | Model: ${resolvedModel}`);
}

console.log("--- AI Model Resolution Audit ---");
console.log("Current Default Provider:", APP_CONFIG.ai.providers.default);
console.log("");

const tasks = ["chat", "onboarding", "summary", "intent", "general"];
const plans = ["free", "launch", "grow", "scale", "business"];

tasks.forEach(task => {
  plans.forEach(plan => {
    logResolution(task, plan, false);
  });
});

console.log("");
console.log("--- Fallback Scenarios ---");
logResolution("chat", "free", true);
logResolution("chat", "scale", true);

console.log("");
console.log("--- DigitalOcean Config ---");
console.log("Base URL:", APP_CONFIG.ai.baseUrl);
console.log("Main:", APP_CONFIG.ai.models.digitalocean.main);
console.log("Premium:", APP_CONFIG.ai.models.digitalocean.premium);
console.log("Utility:", APP_CONFIG.ai.models.digitalocean.utility);
