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
import { getSession, signIn, useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import Link from "next/link";
import { setClarityTags, trackEvent } from "@/lib/client-analytics";

type FeedbackTone = "info" | "success" | "error";

type AuthFeedback = {
  tone: FeedbackTone;
  title: string;
  message: string;
  instruction?: string;
};

type SignupPlanIntent = "free" | "starter" | "pro" | "business";

function parseSignupPlanIntent(value?: string | null): SignupPlanIntent | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (
    normalized === "free" ||
    normalized === "starter" ||
    normalized === "pro" ||
    normalized === "business"
  ) {
    return normalized;
  }

  return null;
}

function parseSignupSourceIntent(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9_-]{2,48}$/.test(normalized)) {
    return null;
  }

  return normalized;
}

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

function mapNextAuthError(error?: string | null): AuthFeedback {
  if (!error) {
    return {
      tone: "error",
      title: "Sign in failed",
      message: "We could not complete your sign in.",
      instruction: "Please try again in a moment.",
    };
  }

  if (error === "CredentialsSignin") {
    return {
      tone: "error",
      title: "Invalid email or password",
      message: "The credentials you entered do not match an account.",
      instruction:
        "Check your email/password and try again, or use 'Forgot your password?'.",
    };
  }

  if (error === "AccessDenied") {
    return {
      tone: "error",
      title: "Access denied",
      message: "Your account is not allowed to sign in.",
      instruction: "Contact support if you believe this is a mistake.",
    };
  }

  return {
    tone: "error",
    title: "Authentication error",
    message: `Provider returned: ${error}`,
    instruction: "Try again. If this keeps happening, contact support.",
  };
}

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<AuthFeedback | null>(null);
  const { status } = useSession();
  const router = useRouter();

  const sessionFeedback = useMemo(() => {
    if (status === "loading") {
      return {
        tone: "info",
        title: "Checking session",
        message: "Please wait while we verify your authentication state.",
      } as AuthFeedback;
    }

    return null;
  }, [status]);

  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFeedback({
      tone: "info",
      title: "Signing in",
      message: "Checking your credentials and creating your session.",
    });

    try {
      const res = await signIn("credentials", {
        email,
        password,
        callbackUrl: "/",
        redirect: false,
      });

      if (res?.error) {
        setFeedback(mapNextAuthError(res.error));
        return;
      }

      setFeedback({
        tone: "info",
        title: "Sign in successful",
        message: "Verifying session before redirecting...",
      });

      const session = await getSession();
      if (!session?.user) {
        setFeedback({
          tone: "error",
          title: "Session was not established",
          message: "Login was accepted but no active session is available.",
          instruction:
            "Refresh the page and try again. If it persists, check AUTH_SECRET/NEXTAUTH_URL and browser cookie settings.",
        });
        return;
      }

      setFeedback({
        tone: "success",
        title: "Signed in",
        message: "Authentication complete. Redirecting to your dashboard...",
      });
      router.push("/");
      router.refresh();
    } catch {
      setFeedback({
        tone: "error",
        title: "Unexpected sign-in error",
        message: "We could not reach the authentication service.",
        instruction: "Check your connection and try again.",
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
        <CardTitle className="text-xl">Welcome back</CardTitle>
        <CardDescription>Sign in to your account to continue.</CardDescription>
      </CardHeader>

      <CardContent>
        <FieldGroup>
          {feedback ? <FeedbackBanner feedback={feedback} /> : null}
          {!feedback && sessionFeedback ? (
            <FeedbackBanner feedback={sessionFeedback} />
          ) : null}

          <form onSubmit={handleCredentialsLogin} className="grid gap-4">
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
              <div className="flex items-center">
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Link
                  href="/auth/forgot-password"
                  className="ml-auto text-sm underline-offset-4 hover:underline"
                >
                  Forgot your password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-10 items-center justify-center"
                  aria-label={showPassword ? "Hide password" : "Show password"}
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
                {isLoading ? "Signing in..." : "Sign in"}
              </Button>
            </Field>
          </form>

          <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
            Or continue with
          </FieldSeparator>

          <Field>
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
              Continue with Google
            </Button>
          </Field>

          <FieldDescription className="text-center">
            Don&apos;t have an account?{" "}
            <Link href="/auth/register">Sign up</Link>
          </FieldDescription>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

export function RegisterForm() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<AuthFeedback | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const signupPlanIntent = useMemo(
    () => parseSignupPlanIntent(searchParams.get("plan")),
    [searchParams],
  );
  const signupSourceIntent = useMemo(
    () => parseSignupSourceIntent(searchParams.get("source")),
    [searchParams],
  );

  const signupPlanLabel = useMemo(() => {
    if (signupPlanIntent === "free") return "Free";
    if (signupPlanIntent === "starter") return "Starter";
    if (signupPlanIntent === "pro") return "Pro";
    if (signupPlanIntent === "business") return "Business";
    return null;
  }, [signupPlanIntent]);

  useEffect(() => {
    setClarityTags({
      page_type: "signup",
      funnel_step: "signup",
    });
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    trackEvent("signup_started", {
      onceKey: `signup_started:${email.trim().toLowerCase() || "unknown"}`,
      onceScope: "session",
      properties: {
        method: "credentials",
        source: signupSourceIntent || "direct",
        plan: signupPlanIntent || "unknown",
      },
    });

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
          signupPlanIntent,
          signupSourceIntent,
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

      trackEvent("signup_completed", {
        onceKey: `signup_completed:${email.trim().toLowerCase() || "unknown"}`,
        onceScope: "local",
        properties: {
          method: "credentials",
          source: signupSourceIntent || "direct",
          plan: signupPlanIntent || "unknown",
        },
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
    trackEvent("signup_started", {
      properties: {
        method: "google",
        source: signupSourceIntent || "direct",
        plan: signupPlanIntent || "unknown",
      },
    });

    setIsLoading(true);
    signIn("google", { callbackUrl: "/" });
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-4 py-1.5 text-xs font-semibold text-emerald-700">
          🎁 14-day free trial &middot; No credit card required
        </div>
        {signupPlanLabel ? (
          <p className="mb-2 text-xs text-muted-foreground">
            We&apos;ll preselect{" "}
            <span className="font-semibold">{signupPlanLabel}</span> during
            onboarding.
          </p>
        ) : null}
        <CardTitle className="text-xl">Create your free account</CardTitle>
        <CardDescription>
          Start capturing leads and replying instantly — setup takes under 5
          minutes.
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
                <p className="text-xs text-muted-foreground mt-1">
                  At least 8 characters
                </p>
              </Field>
              <Field>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Creating account..." : "Create an account"}
                </Button>
              </Field>
            </form>
          </div>

          <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
            Or continue with
          </FieldSeparator>

          <Field>
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
              Continue with Google
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
