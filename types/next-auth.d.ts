import { type DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      tenantId: string; // Added tenantId
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    tenantId: string; // Added tenantId
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    tenantId: string; // Added tenantId
  }
}
