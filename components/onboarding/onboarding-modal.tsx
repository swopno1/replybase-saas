"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { OnboardingProgress } from "./onboarding-ui";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const STAGES = [
  "KYC",
  "Business Basics",
  "Product/Service",
  "Specifics",
  "Support & Sales",
  "Additional Context",
];

export function OnboardingModal({
  isOpen,
  initialStep = 0,
  initialData = {}
}: {
  isOpen: boolean;
  initialStep?: number;
  initialData?: any;
}) {
  const router = useRouter();
  const [step, setStep] = useState(initialStep);
  const [data, setData] = useState<any>(initialData);
  const [loading, setLoading] = useState(false);

  const updateData = (section: string, field: string, value: string) => {
    setData((prev: any) => ({
      ...prev,
      [section]: {
        ...(prev[section] || {}),
        [field]: value,
      },
    }));
  };

  const handleNext = async () => {
    if (step < STAGES.length - 1) {
      setLoading(true);
      try {
        await fetch("/api/onboarding", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ step: step + 1, data }),
        });
        setStep(step + 1);
      } catch (error) {
        toast.error("Failed to save progress");
      } finally {
        setLoading(false);
      }
    } else {
      // Complete onboarding
      setLoading(true);
      try {
        const res = await fetch("/api/onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (res.ok) {
          toast.success("We’re preparing a custom chatbot flow for you based on your details.");
          router.refresh();
        } else {
          toast.error("Failed to complete onboarding");
        }
      } catch (error) {
        toast.error("An error occurred");
      } finally {
        setLoading(false);
      }
    }
  };

  const renderStage = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Your Name</Label>
              <Input
                id="name"
                value={data.kyc?.name || ""}
                onChange={(e) => updateData("kyc", "name", e.target.value)}
                placeholder="John Doe"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="company">Company Name</Label>
              <Input
                id="company"
                value={data.kyc?.company || ""}
                onChange={(e) => updateData("kyc", "company", e.target.value)}
                placeholder="Acme Inc."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contactInfo">Contact Info (Email/Phone)</Label>
              <Input
                id="contactInfo"
                value={data.kyc?.contactInfo || ""}
                onChange={(e) => updateData("kyc", "contactInfo", e.target.value)}
                placeholder="john@example.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={data.kyc?.location || ""}
                onChange={(e) => updateData("kyc", "location", e.target.value)}
                placeholder="London, UK"
              />
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="industry">Industry</Label>
              <Input
                id="industry"
                value={data.businessBasics?.industry || ""}
                onChange={(e) => updateData("businessBasics", "industry", e.target.value)}
                placeholder="Real Estate, SaaS, Retail..."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="companySize">Company Size</Label>
              <Input
                id="companySize"
                value={data.businessBasics?.companySize || ""}
                onChange={(e) => updateData("businessBasics", "companySize", e.target.value)}
                placeholder="1-10, 11-50, 50+..."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="website">Website (Optional)</Label>
              <Input
                id="website"
                value={data.businessBasics?.website || ""}
                onChange={(e) => updateData("businessBasics", "website", e.target.value)}
                placeholder="https://example.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="businessModel">Business Model</Label>
              <Input
                id="businessModel"
                value={data.businessBasics?.businessModel || ""}
                onChange={(e) => updateData("businessBasics", "businessModel", e.target.value)}
                placeholder="B2B, B2C, Marketplace..."
              />
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="offer">What do you sell/offer?</Label>
              <Textarea
                id="offer"
                value={data.productDetails?.offer || ""}
                onChange={(e) => updateData("productDetails", "offer", e.target.value)}
                placeholder="Describe your main products or services..."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="targetCustomers">Who are your customers?</Label>
              <Textarea
                id="targetCustomers"
                value={data.productDetails?.targetCustomers || ""}
                onChange={(e) => updateData("productDetails", "targetCustomers", e.target.value)}
                placeholder="Small businesses, homeowners, tech enthusiasts..."
              />
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="mainProducts">Main products/services details</Label>
              <Textarea
                id="mainProducts"
                value={data.productSpecifics?.mainProducts || ""}
                onChange={(e) => updateData("productSpecifics", "mainProducts", e.target.value)}
                placeholder="List top products and their features..."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pricing">Pricing Information</Label>
              <Input
                id="pricing"
                value={data.productSpecifics?.pricing || ""}
                onChange={(e) => updateData("productSpecifics", "pricing", e.target.value)}
                placeholder="Optional: starting from $X, subscription-based..."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="usps">What makes you unique? (USPs)</Label>
              <Textarea
                id="usps"
                value={data.productSpecifics?.usps || ""}
                onChange={(e) => updateData("productSpecifics", "usps", e.target.value)}
                placeholder="Why should customers choose you?"
              />
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="commonQuestions">Typical customer questions</Label>
              <Textarea
                id="commonQuestions"
                value={data.supportSales?.commonQuestions || ""}
                onChange={(e) => updateData("supportSales", "commonQuestions", e.target.value)}
                placeholder="What do customers ask most often?"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="painPoints">Customer pain points</Label>
              <Textarea
                id="painPoints"
                value={data.supportSales?.painPoints || ""}
                onChange={(e) => updateData("supportSales", "painPoints", e.target.value)}
                placeholder="What problems are your customers trying to solve?"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="salesProcess">Your sales process</Label>
              <Textarea
                id="salesProcess"
                value={data.supportSales?.salesProcess || ""}
                onChange={(e) => updateData("supportSales", "salesProcess", e.target.value)}
                placeholder="How do you usually close a deal?"
              />
            </div>
          </div>
        );
      case 5:
        return (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="otherInfo">Anything else?</Label>
              <Textarea
                id="otherInfo"
                value={data.additionalContext?.otherInfo || ""}
                onChange={(e) => updateData("additionalContext", "otherInfo", e.target.value)}
                placeholder="Any other details to help personalize your chatbot..."
              />
            </div>
            <p className="text-sm text-muted-foreground italic">
              "We collect these details to build your custom chatbot and provide accurate, relevant responses for your business."
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => { }}>
      <DialogContent className="sm:max-w-[500px]" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Setup Your AI Assistant</DialogTitle>
          <DialogDescription>
            Help us understand your business to create a personalized experience.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <OnboardingProgress
            currentStep={step + 1}
            totalSteps={STAGES.length}
            stepName={STAGES[step]}
          />
        </div>

        <div className="max-h-[400px] overflow-y-auto px-1">
          {renderStage()}
        </div>

        <div className="flex justify-between gap-3 mt-6">
          <Button
            variant="outline"
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0 || loading}
          >
            Back
          </Button>
          <Button onClick={handleNext} disabled={loading} className="min-w-[100px]">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {step === STAGES.length - 1 ? "Finish" : "Next"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
