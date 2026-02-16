import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import CredentialsProvider from "next-auth/providers/credentials";
import type { AdapterUser } from "next-auth/adapters";
import { PrismaAdapter } from "next-auth-prisma-adapter";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  adapter: {
    ...PrismaAdapter(prisma),
    createUser: async (data: Omit<AdapterUser, "id">) => {
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
        },
      });
      return user as unknown as AdapterUser;
    },
  },
  providers: [
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID as string,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET as string,
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          scope: "email,public_profile,pages_show_list,pages_messaging",
        },
      },
    }),
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
        // TODO: Backend integration for email/password authentication
        // This is a placeholder. In a real application, you would validate
        // the credentials against your database.
        if (
          credentials?.email === "test@example.com" &&
          credentials?.password === "password"
        ) {
          return {
            id: "1",
            name: "Test User",
            email: "test@example.com",
            tenantId: "test-tenant",
          };
        }
        return null;
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
          select: { tenantId: true },
        });

        token.id = user.id;
        token.tenantId = dbUser?.tenantId || "";

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
                currency: "USD",
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
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.AUTH_SECRET,
};
