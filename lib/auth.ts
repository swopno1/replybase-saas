import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import CredentialsProvider from "next-auth/providers/credentials";
import type { AdapterUser } from "next-auth/adapters";
import { PrismaAdapter } from "next-auth-prisma-adapter";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { isChannelEnabled } from "@/lib/channel-config";
import { generateAppSecretProof } from "@/lib/facebook-utils";

type FacebookProfile = {
  id: string;
  name?: string;
  picture?: { data?: { url?: string } };
};

export const authOptions: NextAuthOptions = {
  adapter: {
    ...PrismaAdapter(prisma),
    createUser: async (data: Omit<AdapterUser, "id">) => {
      const existingUsers = await prisma.user.count();

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
          // Bootstrap a platform admin if this is the first account.
          isAdmin: existingUsers === 0,
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
                  "public_profile,pages_show_list,pages_manage_metadata,pages_read_engagement,pages_messaging",
              },
            },
            // Business app flow should not request `email`; requesting it in
            // userinfo can cause a 400 OAuth callback error.
            userinfo: {
              async request({ tokens }) {
                const accessToken = tokens.access_token;
                if (!accessToken) {
                  throw new Error(
                    "Facebook OAuth callback missing access token",
                  );
                }

                const url = new URL("https://graph.facebook.com/me");
                url.searchParams.set("fields", "id,name,picture{url}");
                const appSecret = process.env.FACEBOOK_CLIENT_SECRET;
                if (appSecret) {
                  url.searchParams.set(
                    "appsecret_proof",
                    generateAppSecretProof(accessToken, appSecret),
                  );
                }

                const response = await fetch(url.toString(), {
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                  },
                });

                const raw = await response.text();
                if (!response.ok) {
                  console.error("[Facebook OAuth] Userinfo request failed", {
                    status: response.status,
                    body: raw,
                  });
                  throw new Error(
                    `Facebook userinfo failed with ${response.status}`,
                  );
                }

                try {
                  return JSON.parse(raw) as FacebookProfile;
                } catch {
                  console.error("[Facebook OAuth] Userinfo JSON parse failed", {
                    body: raw,
                  });
                  throw new Error("Facebook userinfo returned invalid JSON");
                }
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
      allowDangerousEmailAccountLinking: true,
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
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Fetch user with tenant to get tenantId
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { tenantId: true, isAdmin: true },
        });

        token.id = user.id;
        token.tenantId = dbUser?.tenantId || "";
        token.isAdmin = dbUser?.isAdmin ?? false;

        // Fetch subscription status separately to avoid complex nested includes typing issues
        if (dbUser?.tenantId) {
          let tenantSub = await prisma.subscription.findFirst({
            where: { tenantId: dbUser.tenantId },
            orderBy: { createdAt: "desc" },
          });

          // If no subscription exists, create a free plan subscription
          if (!tenantSub) {
            const freePlan = await prisma.plan.upsert({
              where: { name: "free" },
              update: {},
              create: {
                name: "free",
                displayName: "Free",
                price: 0,
                currency: "GBP",
              },
            });

            const now = Date.now();
            const trialEndsAt = new Date(now + 14 * 24 * 60 * 60 * 1000);
            const currentPeriodEnd = new Date(now + 30 * 24 * 60 * 60 * 1000);

            tenantSub = await prisma.subscription.upsert({
              where: { tenantId: dbUser.tenantId },
              update: {},
              create: {
                tenantId: dbUser.tenantId,
                planId: freePlan.id,
                stripeId: `free_${dbUser.tenantId}`,
                status: "active",
                currentPeriodStart: new Date(),
                currentPeriodEnd,
                trialEndsAt,
              },
            });
          }

          token.subscriptionStatus = tenantSub?.status || "active";
        } else {
          token.subscriptionStatus = "inactive";
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
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/login",
  },
  secret: process.env.AUTH_SECRET,
};
