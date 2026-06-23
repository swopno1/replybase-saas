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
import { APP_CONFIG } from "@/lib/config";

type FacebookProfile = {
  id: string;
  name?: string;
  picture?: { data?: { url?: string } };
};

export const authOptions: NextAuthOptions = {
  adapter: {
    ...PrismaAdapter(prisma),
    createUser: async (data: Omit<AdapterUser, "id">) => {
      const isInitialAdmin = data.email && (
        data.email.toLowerCase() === APP_CONFIG.admin.initialEmail.toLowerCase() ||
        APP_CONFIG.admin.emails.includes(data.email.toLowerCase())
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
                  "public_profile,pages_show_list,pages_manage_metadata,pages_messaging,business_management",
              },
            },
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
      if (APP_CONFIG.meta.strictDevLogin) {
        const allowedEmails = ["replybase1@gmail.com", "amirhossain.limon@gmail.com"];
        const userEmail = user?.email?.toLowerCase().trim();

        if (!userEmail || !allowedEmails.includes(userEmail)) {
          console.warn(`[STRICT LOGIN] Blocked login attempt from: ${userEmail}`);
          return false;
        }
      }

      // Block credential sign-ins for users who haven't verified their email yet.
      // Only applies to accounts that went through the credential registration flow
      // (identified by a pending EMAIL_VERIFY token). Existing users without a token
      // are grandfathered through regardless of emailVerified state.
      if (account?.provider === "credentials" && user?.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: {
            emailVerified: true,
            userTokens: {
              where: { type: "EMAIL_VERIFY" },
              select: { id: true },
            },
          },
        });

        if (!dbUser?.emailVerified && (dbUser?.userTokens.length ?? 0) > 0) {
          return false;
        }
      }

      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { tenantId: true, isAdmin: true, role: true },
        });

        token.id = user.id;
        token.tenantId = dbUser?.tenantId || "";
        token.isAdmin = dbUser?.isAdmin ?? false;
        token.role = dbUser?.role || "USER";
        token.lastSubscriptionCheck = Date.now();

        if (token.isAdmin || token.role === "SUPERADMIN") {
          try {
            const { cookies } = await import("next/headers");
            const cookieStore = await cookies();
            const impersonatedId = cookieStore.get("replybase_impersonation_target")?.value;
            if (impersonatedId) {
              token.originalTenantId = token.tenantId;
              token.tenantId = impersonatedId;
              token.isImpersonating = true;
            }
          } catch (e) {}
        }

        if (token.tenantId) {
          token.subscriptionStatus = await getTenantSubscriptionStatus(token.tenantId as string);
        } else {
          token.subscriptionStatus = "inactive";
        }
      } else {
        const now = Date.now();
        const lastCheck = (token.lastSubscriptionCheck as number) || 0;
        const FIFTEEN_MINUTES = 15 * 60 * 1000;

        if (now - lastCheck > FIFTEEN_MINUTES && token.tenantId) {
          token.subscriptionStatus = await getTenantSubscriptionStatus(token.tenantId as string);
          token.lastSubscriptionCheck = now;
        }
      }

      // Handle Facebook token updates
      if (account && account.provider === "facebook" && token.id && account.access_token) {
        try {
          const longLivedToken = await exchangeLongLivedToken(account.access_token);
          const tokenToSave = longLivedToken || account.access_token;
          await prisma.account.updateMany({
            where: { userId: token.id as string, provider: "facebook" },
            data: { access_token: tokenToSave },
          });
        } catch (error) {
          console.error("[NextAuth] Failed to update Facebook token:", error);
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
        session.user.role = token.role as any;
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
