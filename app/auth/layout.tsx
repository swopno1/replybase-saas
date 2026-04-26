import { FieldDescription } from "@/components/ui/field";
import { Logo } from "@/components/Logo";
import { BackButton } from "@/components/back-button";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <BackButton />
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Logo className="flex items-center gap-2 self-center font-medium" />
        <div className="flex flex-col gap-6">
          {children}
          <FieldDescription className="px-6 text-center">
            By creating an account, you agree to our{" "}
            <a href="https://replybase.co.uk/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a> and{" "}
            <a href="https://replybase.co.uk/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
          </FieldDescription>
        </div>
      </div>
    </div>
  );
}
