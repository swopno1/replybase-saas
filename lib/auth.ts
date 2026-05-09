import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import CredentialsProvider from "next-auth/providers/credentials";
import type { AdapterUser } from "next-auth/adapters";
import { PrismaAdapter } from "next-auth-prisma-adapter";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/server/password";
import { getTenantSubscriptionStatus } from "@/lib/subscription";
import { exchangeLongLivedToken } from "@/lib/server/facebook-utils";
import { isChannelEnabled } from "@/lib/channel-config";
import { generateAppSecretProof } from "@/lib/server/facebook-utils";

type FacebookProfile = {
  id: string;
  name?: string;
  picture?: { data?: { url?: string } };
};

export const authOptions: NextAuthOptions = {
  adapter: {
    ...PrismaAdapter(prisma),
    createUser: async (data: Omit<AdapterUser, "id">) => {
      const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase());
      const isInitialAdmin = data.email && (
        data.email.toLowerCase() === process.env.INITIAL_ADMIN_EMAIL?.toLowerCase() ||
        adminEmails.includes(data.email.toLowerCase())
      );

      // Create tenant first
      const tenant = await prisma.tenant.create({
        data: {
          name: `${data.name || "User"}'s Workspace`,
        },
      });
      // Create user with tenantId
      const user = await prisma.user.create({
        data: {
          ...data,
          tenantId: tenant.id,
          // Bootstrap a platform admin based on environment configuration.
          isAdmin: Boolean(isInitialAdmin),
          role: isInitialAdmin ? "SUPERADMIN" : "USER",
        },
      });
      return user as unknown as AdapterUser;
    },
  },
  providers: [
    ...(isChannelEnabled("facebook")
      ? [
          FacebookProvider({
            clientId: process.env.FACEBOOK_CLIENT_ID as string,
            clientSecret: process.env.FACEBOOK_CLIENT_SECRET as string,
            allowDangerousEmailAccountLinking: true,
            authorization: {
              params: {
                scope:
                  "public_profile,pages_show_list,pages_manage_metadata,pages_messaging",
              },
            },
            // Business app flow must not request `email` and must use a
            // custom request fn so the token is passed as Authorization: Bearer
            // (not via the OIDC client). appsecret_proof is required when
            // "Require App Secret" is enabled in Meta app settings.
            userinfo: {
              async request({ tokens }: { tokens: { access_token?: string } }) {
                const appSecret = process.env.FACEBOOK_CLIENT_SECRET as string;
                const proof = generateAppSecretProof(
                  tokens.access_token!,
                  appSecret,
                );
                const url = `https://graph.facebook.com/me?fields=id,name,picture{url}&appsecret_proof=${proof}`;
                const res = await fetch(url, {
                  headers: {
                    Authorization: `Bearer ${tokens.access_token}`,
                  },
                });
                if (!res.ok) {
                  throw new Error(
                    `Facebook userinfo error: ${res.status} ${await res.text()}`,
                  );
                }
                return res.json();
              },
            },
            profile(profile: FacebookProfile) {
              return {
                id: profile.id,
                name: profile.name ?? null,
                email: null,
                image: profile.picture?.data?.url ?? null,
                tenantId: "",
              };
            },
          }),
        ]
      : []),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      allowDangerousEmailAccountLinking: false,
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: {
          label: "Email",
          type: "text",
          placeholder: "jsmith@example.com",
        },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
          select: {
            id: true,
            name: true,
            email: true,
            tenantId: true,
            passwordHash: true,
            isAdmin: true,
            role: true,
          },
        });

        if (!user?.passwordHash) {
          return null;
        }

        const isValid = await verifyPassword(
          credentials.password,
          user.passwordHash,
        );

        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          tenantId: user.tenantId,
          role: user.role,
          isAdmin: user.isAdmin,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user, account }) {
      // Strict dev-only login rule to prevent unauthorized access to dev versions
      // This is controlled by environment variables to ensure it doesn't affect main/prod
      if (process.env.STRICT_DEV_LOGIN === "true") {
        const allowedEmails = ["replybase1@gmail.com", "amirhossain.limon@gmail.com"];
        const userEmail = user?.email?.toLowerCase().trim();
        
        if (!userEmail || !allowedEmails.includes(userEmail)) {
          console.warn(`[STRICT LOGIN] Blocked login attempt from: ${userEmail}`);
          return false; // Deny login
        }
      }

      // HOTFIX: NextAuth Prisma adapter does not update the access_token of an existing account 
      // when a user re-authenticates. We must manually update it to prevent stale token errors (Subcode 460).
      if (account && account.provider === "facebook" && user?.id && account.access_token) {
        try {
          // PRODUCTION GRADE: Exchange short-lived token for a long-lived one (60 days)
          const longLivedToken = await exchangeLongLivedToken(account.access_token);
          const tokenToSave = longLivedToken || account.access_token;

          await prisma.account.updateMany({
            where: { userId: user.id, provider: "facebook" },
            data: {
              access_token: tokenToSave,
              providerAccountId: account.providerAccountId,
            },
          });
        } catch (error) {
          console.error("[NextAuth] Failed to update Facebook token:", error);
        }
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        // Fetch user with tenant to get tenantId
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { tenantId: true, isAdmin: true, role: true },
        });

        token.id = user.id;
        token.tenantId = dbUser?.tenantId || "";
        token.isAdmin = dbUser?.isAdmin ?? false;
        token.role = dbUser?.role || "USER";
        token.lastSubscriptionCheck = Date.now();

        // --- IMPERSONATION LOGIC ---
        // If the user is an admin, check for impersonation cookie
        if (token.isAdmin || token.role === "SUPERADMIN") {
          try {
            const { cookies } = await import("next/headers");
            const cookieStore = await cookies();
            const impersonatedId = cookieStore.get("replybase_impersonation_target")?.value;
            if (impersonatedId) {
              token.originalTenantId = token.tenantId; // Store original for switching back
              token.tenantId = impersonatedId;
              token.isImpersonating = true;
            }
          } catch (e) {
            // Silently fail if cookies() is not available in this context
          }
        }

        // Fetch subscription status separately to avoid complex nested includes typing issues
        if (token.tenantId) {
          token.subscriptionStatus = await getTenantSubscriptionStatus(token.tenantId as string);
        } else {
          token.subscriptionStatus = "inactive";
        }
      } else {
        // Refresh subscription status if token is more than 15 minutes old
        const now = Date.now();
        const lastCheck = (token.lastSubscriptionCheck as number) || 0;
        const FIFTEEN_MINUTES = 15 * 60 * 1000;

        if (now - lastCheck > FIFTEEN_MINUTES && token.tenantId) {
          token.subscriptionStatus = await getTenantSubscriptionStatus(token.tenantId as string);
          token.lastSubscriptionCheck = now;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.tenantId = token.tenantId as string;
        session.user.subscriptionStatus = token.subscriptionStatus as string;
        session.user.isAdmin = token.isAdmin as boolean;
        session.user.role = token.role as any; // Cast to any to satisfy next-auth's loose session typing, or use import if needed
        session.user.isImpersonating = token.isImpersonating as boolean;
        session.user.originalTenantId = token.originalTenantId as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/login",
  },
  secret: process.env.AUTH_SECRET,
};
