"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getSession, signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import Link from "next/link";

type FeedbackTone = "info" | "success" | "error";

type AuthFeedback = {
  tone: FeedbackTone;
  title: string;
  message: string;
  instruction?: string;
};

function mapSignInError(error?: string | null): AuthFeedback {
  if (error === "CredentialsSignin") {
    return {
      tone: "error",
      title: "Auto sign-in failed",
      message: "Your account was created but credentials sign-in failed.",
      instruction: "Please go to login and sign in manually.",
    };
  }

  return {
    tone: "error",
    title: "Auto sign-in failed",
    message: error
      ? `Provider returned: ${error}`
      : "Your account was created but we could not sign you in.",
    instruction: "Go to login and sign in manually.",
  };
}

function FeedbackBanner({ feedback }: { feedback: AuthFeedback }) {
  const styles = {
    info: "border-blue-200 bg-blue-50 text-blue-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    error: "border-red-200 bg-red-50 text-red-900",
  };

  return (
    <div className={`rounded-md border p-3 text-sm ${styles[feedback.tone]}`}>
      <p className="font-medium">{feedback.title}</p>
      <p>{feedback.message}</p>
      {feedback.instruction ? <p>{feedback.instruction}</p> : null}
    </div>
  );
}

export default function RegisterPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<AuthFeedback | null>(null);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFeedback({
      tone: "info",
      title: "Creating account",
      message: "Saving your account details securely...",
    });

    try {
      const registerResponse = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          password,
        }),
      });

      const registerData = await registerResponse.json();

      if (!registerResponse.ok) {
        setFeedback({
          tone: "error",
          title: "Registration failed",
          message:
            registerData?.error || "Unable to create your account right now.",
          instruction:
            registerResponse.status === 409
              ? "This email is already registered. Try signing in instead."
              : "Check the form values and try again.",
        });
        return;
      }

      setFeedback({
        tone: "info",
        title: "Account created",
        message: "Signing you in automatically...",
      });

      const res = await signIn("credentials", {
        email,
        password,
        callbackUrl: "/",
        redirect: false,
      });

      if (res?.error) {
        setFeedback(mapSignInError(res.error));
        router.push("/auth/login");
        return;
      }

      setFeedback({
        tone: "info",
        title: "Checking session",
        message: "Verifying your new session before redirect...",
      });

      const session = await getSession();
      if (!session?.user) {
        setFeedback({
          tone: "error",
          title: "Session not available",
          message: "Account was created, but we could not load your session.",
          instruction:
            "Try login manually. If this persists, check AUTH_SECRET/NEXTAUTH_URL and browser cookies.",
        });
        router.push("/auth/login");
        return;
      }

      setFeedback({
        tone: "success",
        title: "Registration successful",
        message: "Your account is ready. Redirecting to dashboard...",
      });
      router.push("/");
      router.refresh();
    } catch {
      setFeedback({
        tone: "error",
        title: "Unexpected registration error",
        message: "We could not reach the registration service.",
        instruction: "Check your internet connection and try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    setIsLoading(true);
    signIn("google", { callbackUrl: "/" });
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Sign Up</CardTitle>
        <CardDescription>
          Enter your information to create an account
        </CardDescription>
      </CardHeader>

      <CardContent>
        <FieldGroup>
          <div className="grid gap-4">
            {feedback ? <FeedbackBanner feedback={feedback} /> : null}

            <form onSubmit={handleRegister} className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="first-name">First name</FieldLabel>
                  <Input
                    id="first-name"
                    placeholder="Max"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="last-name">Last name</FieldLabel>
                  <Input
                    id="last-name"
                    placeholder="Robinson"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-10 items-center justify-center"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </Field>
              <Field>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Creating account..." : "Create an account"}
                </Button>
              </Field>
            </form>
          </div>

          <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
            Or Login with your Apple or Google account
          </FieldSeparator>

          <Field>
            <Button variant="outline" type="button" disabled>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path
                  d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
                  fill="currentColor"
                />
              </svg>{" "}
              Coming Soon...
              {/* TODO: Change the text */}
              {/* Login with Apple */}
            </Button>
            <Button
              variant="outline"
              type="button"
              className="w-full"
              onClick={handleGoogleLogin}
              disabled={isLoading}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path
                  d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                  fill="currentColor"
                />
              </svg>
              Login with Google
            </Button>
          </Field>

          <FieldDescription className="text-center">
            Already have an account? <Link href="/auth/login">Sign in</Link>
          </FieldDescription>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
