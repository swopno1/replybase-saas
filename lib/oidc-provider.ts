import Provider from "oidc-provider";
import { PrismaOIDCAdapter } from "@/lib/oidc-adapter";
import { prisma } from "@/lib/prisma";

// ISSUER must be the full URL of the SaaS app (Identity Provider)
const ISSUER = process.env.NEXT_PUBLIC_APP_URL || "https://app.replybase.co.uk";

// Helper to find account with proper subscription validation
const findAccount = async (ctx: any, id: string) => {
    const user = await prisma.user.findUnique({
        where: { id },
        include: {
            tenant: {
                include: {
                    subscriptions: {
                        include: {
                            plan: true
                        },
                        where: {
                            status: 'active' // Get active subscription
                        }
                    }
                }
            }
        }
    });

    if (!user) return undefined;

    // NOTE: In this schema, `tenant.subscriptions` is a single optional Subscription (despite the plural name)
    const subscription = user.tenant?.subscriptions ?? null;

    // STRICT GATING: If no active subscription is found, deny access
    if (!subscription || subscription.status !== 'active') {
        console.warn(`[OIDC] User ${id} denied access. No active subscription.`);
        return undefined; // This causes 'account not found' or interaction failure in OIDC
    }

    // Normalize plan name to match requirements: "starter | pro | enterprise"
    const planName = subscription.plan.name.toLowerCase();
    const normalizedPlan = ['starter', 'pro', 'enterprise'].includes(planName) 
        ? planName 
        : 'starter'; // Default fallback

    return {
        accountId: id,
        async claims(use: string, scope: string) {
            // Return required claims as specified in Phase 1 requirements
            // Note: 'iss' and 'aud' are automatically set by oidc-provider based on issuer and client_id
            return {
                sub: id,
                email: user.email || '',
                email_verified: !!user.emailVerified,
                name: user.name || '',
                // Custom claims required by Phase 1
                plan: normalizedPlan,
                subscription_status: subscription.status, // Must be 'active' at this point
                tenantId: user.tenantId,
            };
        },
    };
};

let oidcProvider: Provider | null = null;

export default function getOidcProvider() {
    if (oidcProvider) {
        return oidcProvider;
    }

    const configuration = {
        adapter: PrismaOIDCAdapter,
        clients: [
            {
                client_id: process.env.TYPEBOT_OIDC_CLIENT_ID || "typebot-engine",
                client_secret: process.env.TYPEBOT_OIDC_CLIENT_SECRET || "typebot-secret",
                grant_types: ["authorization_code", "refresh_token"],
                redirect_uris: [
                    process.env.TYPEBOT_CALLBACK_URL || "https://engine.replybase.co.uk/api/auth/oauth/generic-oidc/callback",
                ],
                // Include custom scopes for plan and subscription_status
                scope: "openid email profile plan subscription_status",
            },
        ],
        pkce: {
            required: () => false, // Typebot supports PKCE but not required for MVP
        },
        interactions: {
            url(ctx: any, interaction: any) {
                return `/api/oidc/interaction/${interaction.uid}`;
            },
        },
        cookies: {
            keys: [process.env.OIDC_COOKIE_KEY || "insecure-default-key-change-me"],
        },
        jwks: getJwks(),
        features: {
            devInteractions: { enabled: false },
        },
        findAccount,
        // Register custom claims for plan and subscription_status
        claims: {
            email: ["email", "email_verified"],
            profile: ["name"],
            // Custom claims for Phase 1 requirements
            plan: ["plan"],
            subscription_status: ["subscription_status"],
        },
    };

    // FIX: Minimal config for valid start without throwing JWKS errors immediately if just testing
    // We need a real key. 
    // Strategy: Don't initialize with static keys in code. Use process.env.JWKS or rely on 'kty' generation script.
    // We will assume dev mode for now to let it auto-generate validation keys if possible?
    // No, `oidc-provider` only auto-generates in dev mode.

    oidcProvider = new Provider(ISSUER + "/api/oidc", configuration as any);

    // Trust proxy for secure cookies behind reverse proxy
    oidcProvider.proxy = true;

    return oidcProvider;
}

function getJwks() {
    const jwksEnv = process.env.OIDC_JWKS;
    if (!jwksEnv) {
        console.warn("OIDC_JWKS not set. Provider may fail in production.");
        return undefined;
    }

    try {
        // Try parsing as raw JSON first
        return JSON.parse(jwksEnv);
    } catch (e) {
        // If fail, try Base64 decode
        try {
            const decoded = Buffer.from(jwksEnv, 'base64').toString('utf-8');
            return JSON.parse(decoded);
        } catch (e2) {
            console.error("Failed to parse OIDC_JWKS as JSON or Base64 JSON.");
            return undefined;
        }
    }
}
