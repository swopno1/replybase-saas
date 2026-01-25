import { type DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      tenantId: string;
      subscriptionStatus: string; // Added subscriptionStatus
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    tenantId: string;
    subscriptionStatus?: string; // Optional on user object initially
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    tenantId: string;
    subscriptionStatus: string; // Added subscriptionStatus
  }
}
