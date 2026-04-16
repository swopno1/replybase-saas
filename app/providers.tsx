"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { ConfirmationProvider } from "@/components/ui/confirmation-provider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ConfirmationProvider>
        {children}
        <Toaster />
      </ConfirmationProvider>
    </SessionProvider>
  );
}
