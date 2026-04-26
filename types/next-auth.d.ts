import { type DefaultSession } from "next-auth";
import { type UserRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      tenantId: string;
      subscriptionStatus: string;
      isAdmin: boolean;
      role: UserRole;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    tenantId: string;
    subscriptionStatus?: string;
    role?: UserRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    tenantId: string;
    subscriptionStatus: string;
    isAdmin: boolean;
    role: UserRole;
  }
}
