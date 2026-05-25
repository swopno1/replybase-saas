import { z } from "zod";

const envSchema = z.object({
  // CORE
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url(),

  // AUTH
  AUTH_SECRET: z.string().min(32),
  CHANNEL_CREDENTIALS_ENCRYPTION_KEY: z.string().min(32).optional(),
  NEXTAUTH_URL: z.string().url(),

  // OAUTH
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  FACEBOOK_CLIENT_ID: z.string().optional(),
  FACEBOOK_CLIENT_SECRET: z.string().optional(),
  FACEBOOK_WEBHOOK_VERIFY_TOKEN: z.string().optional(),

  // DATABASE
  DATABASE_URL: z.string().url().refine(
    (url) => url.startsWith("postgresql://") || url.startsWith("postgres://"),
    { message: "DATABASE_URL must start with postgresql:// or postgres://" }
  ),

  // STRIPE
  STRIPE_SECRET_KEY: z.string().min(1).refine(
    (s) => !s.includes("REPLACE_WITH"),
    { message: "STRIPE_SECRET_KEY still has placeholder value" }
  ),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).refine(
    (s) => !s.includes("REPLACE_WITH"),
    { message: "STRIPE_WEBHOOK_SECRET still has placeholder value" }
  ),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),

  // Monthly Price IDs
  NEXT_PUBLIC_STRIPE_LAUNCH_PRICE_ID: z.string().optional(),
  NEXT_PUBLIC_STRIPE_GROW_PRICE_ID: z.string().optional(),
  NEXT_PUBLIC_STRIPE_SCALE_PRICE_ID: z.string().optional(),
  NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID: z.string().optional(),

  // Annual Price IDs
  NEXT_PUBLIC_STRIPE_LAUNCH_ANNUAL_PRICE_ID: z.string().optional(),
  NEXT_PUBLIC_STRIPE_GROW_ANNUAL_PRICE_ID: z.string().optional(),
  NEXT_PUBLIC_STRIPE_SCALE_ANNUAL_PRICE_ID: z.string().optional(),
  NEXT_PUBLIC_STRIPE_BUSINESS_ANNUAL_PRICE_ID: z.string().optional(),

  // CHANNELS
  NEXT_PUBLIC_CHANNEL_CONFIG_OVERRIDES_JSON: z.string().optional(),

  // AI
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
  DIGITALOCEAN_AI_KEY: z.string().optional(),
  DIGITALOCEAN_TOKEN: z.string().optional(), // Legacy support

  // TELEGRAM
  TELEGRAM_TOKEN_ENCRYPTION_KEY: z.string().optional(),

  // REDIS
  UPSTASH_REDIS_REST_URL: z.preprocess((val) => (val === "" ? undefined : val), z.string().url().optional()),
  UPSTASH_REDIS_REST_TOKEN: z.preprocess((val) => (val === "" ? undefined : val), z.string().optional()),

  // SECRETS & ADMIN
  API_SECRET_KEY: z.string().min(16).optional(),
  CRON_SECRET: z.string().min(16).optional(),
});

// Validate env vars
const isServer = typeof window === "undefined";
const isBuildTime = process.env.NEXT_PHASE === "phase-production-build" || process.env.CI === "true";

// Schema for public variables exposed to the client
const clientEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_STRIPE_LAUNCH_PRICE_ID: z.string().optional(),
  NEXT_PUBLIC_STRIPE_GROW_PRICE_ID: z.string().optional(),
  NEXT_PUBLIC_STRIPE_SCALE_PRICE_ID: z.string().optional(),
  NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID: z.string().optional(),
  NEXT_PUBLIC_STRIPE_LAUNCH_ANNUAL_PRICE_ID: z.string().optional(),
  NEXT_PUBLIC_STRIPE_GROW_ANNUAL_PRICE_ID: z.string().optional(),
  NEXT_PUBLIC_STRIPE_SCALE_ANNUAL_PRICE_ID: z.string().optional(),
  NEXT_PUBLIC_STRIPE_BUSINESS_ANNUAL_PRICE_ID: z.string().optional(),
  NEXT_PUBLIC_CHANNEL_CONFIG_OVERRIDES_JSON: z.string().optional(),
});

const parsed = isServer 
  ? envSchema.safeParse(process.env) 
  : clientEnvSchema.safeParse({
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      NEXT_PUBLIC_STRIPE_LAUNCH_PRICE_ID: process.env.NEXT_PUBLIC_STRIPE_LAUNCH_PRICE_ID,
      NEXT_PUBLIC_STRIPE_GROW_PRICE_ID: process.env.NEXT_PUBLIC_STRIPE_GROW_PRICE_ID,
      NEXT_PUBLIC_STRIPE_SCALE_PRICE_ID: process.env.NEXT_PUBLIC_STRIPE_SCALE_PRICE_ID,
      NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID: process.env.NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID,
      NEXT_PUBLIC_STRIPE_LAUNCH_ANNUAL_PRICE_ID: process.env.NEXT_PUBLIC_STRIPE_LAUNCH_ANNUAL_PRICE_ID,
      NEXT_PUBLIC_STRIPE_GROW_ANNUAL_PRICE_ID: process.env.NEXT_PUBLIC_STRIPE_GROW_ANNUAL_PRICE_ID,
      NEXT_PUBLIC_STRIPE_SCALE_ANNUAL_PRICE_ID: process.env.NEXT_PUBLIC_STRIPE_SCALE_ANNUAL_PRICE_ID,
      NEXT_PUBLIC_STRIPE_BUSINESS_ANNUAL_PRICE_ID: process.env.NEXT_PUBLIC_STRIPE_BUSINESS_ANNUAL_PRICE_ID,
      NEXT_PUBLIC_CHANNEL_CONFIG_OVERRIDES_JSON: process.env.NEXT_PUBLIC_CHANNEL_CONFIG_OVERRIDES_JSON,
    });

if (!parsed.success) {
  if (!isBuildTime) {
    console.error("❌ Invalid environment variables:", JSON.stringify(parsed.error.format(), null, 2));
    
    if (process.env.NODE_ENV === "production" && isServer) {
      throw new Error("Invalid environment variables. Fix them before starting the app.");
    }
  } else {
    console.warn("⚠️  Some environment variables are missing during build time. This is expected in some CI/Docker environments.");
  }
}

export const env = (parsed.success ? parsed.data : process.env) as unknown as z.infer<typeof envSchema>;
