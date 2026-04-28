"use client";

import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OnboardingProgress } from "./onboarding-ui";
import { toast } from "sonner";
import { Loader2, ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const STAGES = [
  "KYC",
  "Business Basics",
  "Product/Service",
  "Specifics",
  "Support & Sales",
  "Additional Context",
];

const INDUSTRIES = [
  "SaaS",
  "E-commerce",
  "Agency",
  "Healthcare",
  "Education",
  "Retail",
  "Other",
];
const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-1000", "1000+"];
const BUSINESS_MODELS = ["B2B", "B2C", "Marketplace", "Nonprofit", "Other"];
const CUSTOMER_TYPES = [
  "Small Businesses",
  "Enterprises",
  "Consumers",
  "Startups",
  "Agencies",
  "Other",
];

export interface OnboardingKYC {
  name?: string;
  company?: string;
  contactInfo?: string;
  location?: string;
}

export interface OnboardingBusinessBasics {
  industry?: string;
  companySize?: string;
  website?: string;
  businessModel?: string;
}

export interface OnboardingProductDetails {
  offer?: string;
  targetCustomers?: string[] | string;
}

export interface OnboardingProductSpecifics {
  mainProducts?: string;
  pricing?: string;
  usps?: string;
}

export interface OnboardingSupportSales {
  commonQuestions?: string;
  painPoints?: string;
  salesProcess?: string;
}

export interface OnboardingAdditionalContext {
  otherInfo?: string;
}

export interface OnboardingData {
  kyc?: OnboardingKYC;
  businessBasics?: OnboardingBusinessBasics;
  productDetails?: OnboardingProductDetails;
  productSpecifics?: OnboardingProductSpecifics;
  supportSales?: OnboardingSupportSales;
  additionalContext?: OnboardingAdditionalContext;
  [key: string]: unknown;
}

export function OnboardingModal({
  isOpen,
  initialStep = 0,
  initialData = {},
}: {
  isOpen: boolean;
  initialStep?: number;
  initialData?: Record<string, unknown>;
}) {
  const router = useRouter();
  const [step, setStep] = useState(initialStep);
  const [data, setData] = useState<Record<string, unknown>>(initialData);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(isOpen);

  const updateData = (section: string, field: string, value: unknown) => {
    setData((prev: Record<string, unknown>) => ({
      ...prev,
      [section]: {
        ...((prev[section] as Record<string, unknown>) || {}),
        [field]: value,
      },
    }));
  };

  // Sync open state with initial isOpen prop
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setOpen(isOpen);
    setPrevIsOpen(isOpen);
  }

  const saveProgress = async (nextStep?: number) => {
    try {
      await fetch("/api/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: nextStep ?? step, data }),
      });
    } catch (_error) {
      console.error("Failed to save progress");
    }
  };

  const handleNext = async () => {
    if (step < STAGES.length - 1) {
      setLoading(true);
      try {
        await saveProgress(step + 1);
        setStep(step + 1);
      } catch (_error) {
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
          toast.success(
            "We’re preparing a custom chatbot flow for you based on your details.",
          );
          setOpen(false);
          router.refresh();
        } else {
          toast.error("Failed to complete onboarding");
        }
      } catch (_error) {
        toast.error("An error occurred");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      saveProgress();
    }
    setOpen(newOpen);
  };

  const renderStage = () => {
    switch (step) {
      case 0:
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-2">
              <Label
                htmlFor="name"
                className="text-xs uppercase tracking-widest text-primary/70"
              >
                Your Name
              </Label>
              <Input
                id="name"
                className="bg-background/50 border-primary/20 focus:border-primary/50 transition-all"
                value={data.kyc?.name || ""}
                onChange={(e) => updateData("kyc", "name", e.target.value)}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="company"
                className="text-xs uppercase tracking-widest text-primary/70"
              >
                Company Name
              </Label>
              <Input
                id="company"
                className="bg-background/50 border-primary/20 focus:border-primary/50 transition-all"
                value={data.kyc?.company || ""}
                onChange={(e) => updateData("kyc", "company", e.target.value)}
                placeholder="Acme Inc."
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="contactInfo"
                className="text-xs uppercase tracking-widest text-primary/70"
              >
                Contact Info
              </Label>
              <Input
                id="contactInfo"
                className="bg-background/50 border-primary/20 focus:border-primary/50 transition-all"
                value={data.kyc?.contactInfo || ""}
                onChange={(e) =>
                  updateData("kyc", "contactInfo", e.target.value)
                }
                placeholder="john@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="location"
                className="text-xs uppercase tracking-widest text-primary/70"
              >
                Location
              </Label>
              <Input
                id="location"
                className="bg-background/50 border-primary/20 focus:border-primary/50 transition-all"
                value={data.kyc?.location || ""}
                onChange={(e) => updateData("kyc", "location", e.target.value)}
                placeholder="London, UK"
              />
            </div>
          </div>
        );
      case 1:
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-2">
              <Label
                htmlFor="industry"
                className="text-xs uppercase tracking-widest text-primary/70"
              >
                Industry
              </Label>
              <Select
                value={data.businessBasics?.industry || ""}
                onValueChange={(val) =>
                  updateData("businessBasics", "industry", val)
                }
              >
                <SelectTrigger className="bg-background/50 border-primary/20">
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((ind) => (
                    <SelectItem key={ind} value={ind}>
                      {ind}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="companySize"
                className="text-xs uppercase tracking-widest text-primary/70"
              >
                Company Size
              </Label>
              <Select
                value={data.businessBasics?.companySize || ""}
                onValueChange={(val) =>
                  updateData("businessBasics", "companySize", val)
                }
              >
                <SelectTrigger className="bg-background/50 border-primary/20">
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  {COMPANY_SIZES.map((size) => (
                    <SelectItem key={size} value={size}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="website"
                className="text-xs uppercase tracking-widest text-primary/70"
              >
                Website (Optional)
              </Label>
              <Input
                id="website"
                className="bg-background/50 border-primary/20 focus:border-primary/50 transition-all"
                value={data.businessBasics?.website || ""}
                onChange={(e) =>
                  updateData("businessBasics", "website", e.target.value)
                }
                placeholder="https://example.com"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="businessModel"
                className="text-xs uppercase tracking-widest text-primary/70"
              >
                Business Model
              </Label>
              <Select
                value={data.businessBasics?.businessModel || ""}
                onValueChange={(val) =>
                  updateData("businessBasics", "businessModel", val)
                }
              >
                <SelectTrigger className="bg-background/50 border-primary/20">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {BUSINESS_MODELS.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-2">
              <Label
                htmlFor="offer"
                className="text-xs uppercase tracking-widest text-primary/70"
              >
                What do you sell/offer?
              </Label>
              <Textarea
                id="offer"
                className="bg-background/50 border-primary/20 min-h-[100px]"
                value={data.productDetails?.offer || ""}
                onChange={(e) =>
                  updateData("productDetails", "offer", e.target.value)
                }
                placeholder="Describe your main products or services..."
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-widest text-primary/70">
                Who are your customers?
              </Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between bg-background/50 border-primary/20 font-normal"
                  >
                    <span className="truncate">
                      {Array.isArray(data.productDetails?.targetCustomers) &&
                      data.productDetails.targetCustomers.length
                        ? data.productDetails.targetCustomers.join(", ")
                        : typeof data.productDetails?.targetCustomers ===
                              "string" && data.productDetails.targetCustomers
                          ? data.productDetails.targetCustomers
                          : "Select customer types"}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)]">
                  {CUSTOMER_TYPES.map((type) => (
                    <DropdownMenuCheckboxItem
                      key={type}
                      checked={data.productDetails?.targetCustomers?.includes(
                        type,
                      )}
                      onCheckedChange={(checked) => {
                        const currentRaw = data.productDetails?.targetCustomers;
                        const current = Array.isArray(currentRaw)
                          ? currentRaw
                          : typeof currentRaw === "string"
                            ? [currentRaw]
                            : [];
                        const next = checked
                          ? [...current, type]
                          : current.filter((t: string) => t !== type);
                        updateData("productDetails", "targetCustomers", next);
                      }}
                    >
                      {type}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-2">
              <Label
                htmlFor="mainProducts"
                className="text-xs uppercase tracking-widest text-primary/70"
              >
                Main products/services details
              </Label>
              <Textarea
                id="mainProducts"
                className="bg-background/50 border-primary/20 min-h-[80px]"
                value={data.productSpecifics?.mainProducts || ""}
                onChange={(e) =>
                  updateData("productSpecifics", "mainProducts", e.target.value)
                }
                placeholder="List top products and their features..."
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="pricing"
                className="text-xs uppercase tracking-widest text-primary/70"
              >
                Pricing Information
              </Label>
              <Input
                id="pricing"
                className="bg-background/50 border-primary/20"
                value={data.productSpecifics?.pricing || ""}
                onChange={(e) =>
                  updateData("productSpecifics", "pricing", e.target.value)
                }
                placeholder="Optional: starting from $X, subscription-based..."
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="usps"
                className="text-xs uppercase tracking-widest text-primary/70"
              >
                What makes you unique? (USPs)
              </Label>
              <Textarea
                id="usps"
                className="bg-background/50 border-primary/20 min-h-[80px]"
                value={data.productSpecifics?.usps || ""}
                onChange={(e) =>
                  updateData("productSpecifics", "usps", e.target.value)
                }
                placeholder="Why should customers choose you?"
              />
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-2">
              <Label
                htmlFor="commonQuestions"
                className="text-xs uppercase tracking-widest text-primary/70"
              >
                Typical customer questions
              </Label>
              <Textarea
                id="commonQuestions"
                className="bg-background/50 border-primary/20 min-h-[80px]"
                value={data.supportSales?.commonQuestions || ""}
                onChange={(e) =>
                  updateData("supportSales", "commonQuestions", e.target.value)
                }
                placeholder="What do customers ask most often?"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="painPoints"
                className="text-xs uppercase tracking-widest text-primary/70"
              >
                Customer pain points
              </Label>
              <Textarea
                id="painPoints"
                className="bg-background/50 border-primary/20 min-h-[80px]"
                value={data.supportSales?.painPoints || ""}
                onChange={(e) =>
                  updateData("supportSales", "painPoints", e.target.value)
                }
                placeholder="What problems are your customers trying to solve?"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="salesProcess"
                className="text-xs uppercase tracking-widest text-primary/70"
              >
                Your sales process
              </Label>
              <Textarea
                id="salesProcess"
                className="bg-background/50 border-primary/20 min-h-[80px]"
                value={data.supportSales?.salesProcess || ""}
                onChange={(e) =>
                  updateData("supportSales", "salesProcess", e.target.value)
                }
                placeholder="How do you usually close a deal?"
              />
            </div>
          </div>
        );
      case 5:
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-2">
              <Label
                htmlFor="otherInfo"
                className="text-xs uppercase tracking-widest text-primary/70"
              >
                Anything else?
              </Label>
              <Textarea
                id="otherInfo"
                className="bg-background/50 border-primary/20 min-h-[150px]"
                value={data.additionalContext?.otherInfo || ""}
                onChange={(e) =>
                  updateData("additionalContext", "otherInfo", e.target.value)
                }
                placeholder="Any other details to help personalize your chatbot..."
              />
            </div>
            <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/10">
              <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                We collect these details to build your custom chatbot and
                provide accurate, relevant responses for your business.
              </p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          "sm:max-w-[800px] lg:min-h-[650px] lg:h-[650px] border-primary/20 bg-background/95 backdrop-blur-xl shadow-[0_0_50px_-12px_rgba(var(--primary),0.3)]",
          "after:absolute after:inset-0 after:z-[-1] after:bg-[radial-gradient(circle_at_50%_-20%,rgba(var(--primary),0.15),transparent_70%)] transition-all duration-300",
        )}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <div className="relative z-10 h-full flex flex-col">
          <DialogHeader className="mb-8 shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <DialogTitle className="text-2xl font-bold tracking-tight">
                Configure Your Intelligence
              </DialogTitle>
            </div>
            <DialogDescription className="text-base text-muted-foreground/80">
              Initializing neural parameters to align the AI assistant with your
              business DNA.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-[250px_1fr] gap-10 flex-1 overflow-hidden">
            <div className="space-y-8 lg:border-r lg:border-primary/10 lg:pr-10">
              <OnboardingProgress
                currentStep={step + 1}
                totalSteps={STAGES.length}
                stepName={STAGES[step]}
              />

              <div className="hidden lg:block space-y-4">
                {STAGES.map((s, i) => (
                  <div
                    key={s}
                    className={cn(
                      "flex items-center gap-3 transition-all duration-300",
                      i === step
                        ? "text-primary opacity-100"
                        : i < step
                          ? "text-primary/50 opacity-100"
                          : "text-muted-foreground opacity-40",
                    )}
                  >
                    <div
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        i === step
                          ? "bg-primary shadow-[0_0_8px_rgba(var(--primary),0.8)]"
                          : "bg-current",
                      )}
                    />
                    <span className="text-xs font-bold uppercase tracking-widest">
                      {s}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col h-full overflow-hidden">
              <div className="flex-1 overflow-y-auto pr-2">
                {renderStage()}
              </div>

              <div className="flex justify-between items-center gap-4 mt-auto pt-6 border-t border-primary/10 shrink-0">
                <Button
                  variant="ghost"
                  onClick={() => setStep(Math.max(0, step - 1))}
                  disabled={step === 0 || loading}
                  className="hover:bg-primary/5 text-muted-foreground"
                >
                  Previous Phase
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={loading}
                  className="min-w-[140px] bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_-5px_rgba(var(--primary),0.5)] transition-all active:scale-95"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {step === STAGES.length - 1 ? "Initialize AI" : "Next Phase"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
