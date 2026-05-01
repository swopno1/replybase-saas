import { z } from "zod";

const envSchema = z.object({
  // CORE
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url(),

  // AUTH
  AUTH_SECRET: z.string().min(32),
  CHANNEL_CREDENTIALS_ENCRYPTION_KEY: z.string().min(32),
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
  NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PRO_PRICE_ID: z.string().optional(),
  NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID: z.string().optional(),

  // AI
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),

  // TELEGRAM
  TELEGRAM_TOKEN_ENCRYPTION_KEY: z.string().optional(),

  // REDIS
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // SECRETS & ADMIN
  API_SECRET_KEY: z.string().min(16),
  CRON_SECRET: z.string().min(16),
});

// Validate env vars
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", JSON.stringify(parsed.error.format(), null, 2));
  
  if (process.env.NODE_ENV === "production") {
    throw new Error("Invalid environment variables. Fix them before starting the app.");
  }
}

export const env = parsed.success ? parsed.data : (process.env as unknown as z.infer<typeof envSchema>);
