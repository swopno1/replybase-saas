import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, Zap } from "lucide-react";

interface PlanCardProps {
  name: string;
  price: number;
  description: string;
  features: string[];
  isPopular?: boolean;
  onSelect?: () => void;
}

export function PlanCard({
  name,
  price,
  description,
  features,
  isPopular,
  onSelect,
}: PlanCardProps) {
  return (
    <Card
      className={`relative ${isPopular ? "border-primary ring-2 ring-primary" : ""}`}
    >
      {isPopular && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-semibold">
            Most Popular
          </span>
        </div>
      )}
      <CardHeader>
        <CardTitle>{name}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <div className="text-3xl font-bold">${price}</div>
          <p className="text-xs text-muted-foreground mt-1">/month</p>
        </div>

        <ul className="space-y-3">
          {features.map((feature, i) => (
            <li key={i} className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-sm">{feature}</span>
            </li>
          ))}
        </ul>

        <Button
          onClick={onSelect}
          className="w-full"
          variant={isPopular ? "default" : "outline"}
        >
          Select {name}
        </Button>
      </CardContent>
    </Card>
  );
}

interface OnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
  stepName: string;
}

export function OnboardingProgress({
  currentStep,
  totalSteps,
  stepName,
}: OnboardingProgressProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{stepName}</span>
        <span className="text-xs text-muted-foreground">
          {currentStep} of {totalSteps}
        </span>
      </div>
      <div className="w-full bg-muted rounded-full h-2">
        <div
          className="bg-primary h-2 rounded-full transition-all"
          style={{ width: `${(currentStep / totalSteps) * 100}%` }}
        />
      </div>
    </div>
  );
}

interface DemoTemplateCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  selected?: boolean;
  onSelect?: () => void;
}

export function DemoTemplateCard({
  title,
  description,
  icon,
  selected,
  onSelect,
}: DemoTemplateCardProps) {
  return (
    <Card
      className={`cursor-pointer transition-all ${
        selected
          ? "border-primary ring-2 ring-primary bg-primary/5"
          : "hover:border-primary"
      }`}
      onClick={onSelect}
    >
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div className="text-3xl">{icon}</div>
          <div className="flex-1">
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface OnboardingFormProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  onSubmit: (e: React.FormEvent) => void;
  isLoading?: boolean;
  submitLabel?: string;
}

export function OnboardingForm({
  title,
  description,
  children,
  onSubmit,
  isLoading,
  submitLabel = "Continue",
}: OnboardingFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{title}</h2>
        {description && (
          <p className="text-muted-foreground mt-2">{description}</p>
        )}
      </div>

      <div className="space-y-4">{children}</div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Loading..." : submitLabel}
      </Button>
    </form>
  );
}

interface StepIndicatorProps {
  steps: string[];
  currentStep: number;
}

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-between mb-8">
      {steps.map((step, index) => (
        <div key={index} className="flex items-center">
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full font-semibold text-sm transition-all ${
              index <= currentStep
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {index + 1}
          </div>
          {index < steps.length - 1 && (
            <div
              className={`h-1 w-12 mx-2 transition-all ${
                index < currentStep ? "bg-primary" : "bg-muted"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

interface TrialVsPaymentProps {
  onTrialClick: () => void;
  onPaymentClick: () => void;
  isLoading?: boolean;
}

export function TrialVsPayment({
  onTrialClick,
  onPaymentClick,
  isLoading,
}: TrialVsPaymentProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card
        className="border-2 hover:border-primary transition-colors cursor-pointer"
        onClick={onTrialClick}
      >
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-500" />
                <h3 className="font-semibold">Free Trial</h3>
              </div>
              <p className="text-2xl font-bold">14 Days</p>
              <p className="text-sm text-muted-foreground">
                No credit card charged until trial ends
              </p>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Full access to all features
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Pre-built demo templates
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Personalized onboarding
              </li>
            </ul>
            <Button className="w-full" variant="outline" disabled={isLoading}>
              Start Free Trial
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card
        className="border-2 border-primary hover:border-primary transition-colors cursor-pointer"
        onClick={onPaymentClick}
      >
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                <h3 className="font-semibold">Start Now</h3>
              </div>
              <p className="text-2xl font-bold">Pay Monthly</p>
              <p className="text-sm text-muted-foreground">
                Start with your selected plan
              </p>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Activate immediately
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Full premium support
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Cancel anytime
              </li>
            </ul>
            <Button className="w-full" disabled={isLoading}>
              Proceed to Payment
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
