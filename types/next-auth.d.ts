import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      tenantId: string; // Added tenantId
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
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
