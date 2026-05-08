"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
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
import { Loader2, ChevronDown, Sparkles, Target, MessageSquare, Zap, Phone, Mail, Globe, Calendar, Users, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { OnboardingData } from "@/types/shared/onboarding";

// ─── Step Configuration ─────────────────────────────────────────────────────

const STAGES = [
  "Your Business",
  "Your Offer",
  "Chatbot Goals",
  "Finishing Touches",
];

// ─── Selection Options ──────────────────────────────────────────────────────

const INDUSTRIES_WITH_SUBCATEGORIES: Record<string, string[]> = {
  "Real Estate": ["Agencies", "Property Management", "Commercial", "Other"],
  "E-commerce & Retail": ["Direct to Consumer (D2C)", "B2B Wholesale", "Dropshipping", "Brick & Mortar", "Other"],
  "Professional Services": ["Law", "Consulting", "Accounting & Finance", "Insurance", "Other"],
  "Home Services & Trades": ["Plumbing/HVAC", "Cleaning", "Landscaping", "Construction/Remodeling", "Other"],
  "Healthcare & Wellness": ["Clinics/Dental", "Fitness/Gyms", "MedSpas & Salons", "Mental Health", "Other"],
  "Software & Technology": ["SaaS", "IT Services", "App Development", "Hardware", "Other"],
  "Travel & Hospitality": ["Hotels/Resorts", "Tour Operators", "Restaurants & Cafes", "Event Planning", "Other"],
  "Education & Coaching": ["Online Courses", "Tutoring", "Business Coaching", "Schools/Universities", "Other"],
  "Marketing & Agency": ["Digital Marketing", "SEO/Content", "PR/Communications", "Lead Generation", "Other"],
  "Other": ["Other"]
};

const BUSINESS_MODELS = ["B2B", "B2C", "Marketplace", "Nonprofit", "Other"];

const CUSTOMER_TYPES = [
  "Local Consumers (B2C)",
  "Online Shoppers (B2C)",
  "Small & Medium Businesses (B2B)",
  "Enterprise Corporations (B2B)",
  "Startups & Founders",
  "Agencies & Freelancers",
  "Real Estate Buyers/Renters",
  "Patients & Clients",
  "Other"
];

const CONVERSION_GOAL_OPTIONS = [
  { value: "lead_capture", label: "Capture Leads", description: "Collect contact details from interested visitors", icon: Users },
  { value: "booking", label: "Book Appointments", description: "Get visitors to schedule a call or visit", icon: Calendar },
  { value: "support", label: "Customer Support", description: "Answer questions and resolve issues", icon: MessageSquare },
  { value: "sales", label: "Drive Sales", description: "Guide visitors toward making a purchase", icon: Zap },
  { value: "engagement", label: "Engage & Inform", description: "Share info and keep visitors engaged", icon: Globe },
] as const;

const CTA_OPTIONS = [
  { value: "call", label: "Phone Call", icon: Phone },
  { value: "whatsapp", label: "WhatsApp", icon: MessageSquare },
  { value: "email", label: "Email", icon: Mail },
  { value: "form", label: "Contact Form", icon: Target },
  { value: "booking_link", label: "Booking Link", icon: Calendar },
] as const;

const PERSONALITY_OPTIONS = [
  { value: "professional", label: "Professional", description: "Clear, confident, no slang" },
  { value: "friendly", label: "Friendly", description: "Warm, approachable, light emojis" },
  { value: "casual", label: "Casual", description: "Relaxed, informal, emoji-rich" },
  { value: "luxury", label: "Luxury", description: "Elegant, refined, exclusive" },
] as const;

const ESCALATION_OPTIONS = [
  { value: "email", label: "Email follow-up" },
  { value: "phone", label: "Phone callback" },
  { value: "live_chat", label: "Live chat handoff" },
  { value: "none", label: "No escalation needed" },
] as const;

// ─── Initial Data ───────────────────────────────────────────────────────────

const INITIAL_DATA: OnboardingData = {
  business: { name: "", company: "", industry: "", subIndustry: "", website: "", businessModel: "" },
  offer: { description: "", targetCustomers: [], mainProducts: "" },
  chatbotGoals: { conversionGoal: "lead_capture", preferredCta: "email", botPersonality: "friendly", escalationPreference: "email" },
  context: { commonQuestions: "", otherInfo: "" },
};

// ─── Component ──────────────────────────────────────────────────────────────

export function OnboardingModal({
  isOpen,
  initialStep = 0,
  initialData = null,
}: {
  isOpen: boolean;
  initialStep?: number;
  initialData?: OnboardingData | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(initialStep);
  const { data: session } = useSession();
  const [data, setData] = useState<OnboardingData>(
    initialData?.business ? initialData : INITIAL_DATA
  );
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(isOpen);

  // Pre-fill name from session
  useEffect(() => {
    if (session?.user?.name && !data.business.name) {
      updateData("business", "name", session.user.name);
    }
  }, [session?.user?.name, data.business.name]);

  const updateData = <T extends keyof OnboardingData, F extends keyof OnboardingData[T]>(
    section: T,
    field: F,
    value: OnboardingData[T][F]
  ) => {
    setData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
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

  const isStepValid = () => {
    switch (step) {
      case 0:
        return !!data.business.name && !!data.business.company && !!data.business.industry && !!data.business.businessModel;
      case 1:
        return !!data.offer.description && !!data.offer.mainProducts;
      case 2:
        return !!data.chatbotGoals.conversionGoal && !!data.chatbotGoals.preferredCta;
      case 3:
        return true; // optional step
      default:
        return true;
    }
  };

  const handleNext = async () => {
    if (!isStepValid()) {
      toast.error("Please fill in all required fields to proceed.");
      return;
    }

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
            "We're building your custom chatbot flow — it'll be ready in seconds!",
          );
          setOpen(false);
          router.refresh();
        } else {
          const errorData = await res.json();
          console.error("Onboarding failed:", errorData);
          toast.error(errorData.error || "Failed to complete onboarding");
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

  const CharacterCount = ({ current, max, softMax }: { current: number; max: number; softMax?: number }) => {
    const isOverSoft = softMax && current > softMax;
    const isOverHard = current >= max;

    return (
      <div className={cn(
        "text-[10px] mt-1 flex justify-end items-center gap-1.5 transition-colors",
        isOverHard ? "text-destructive font-bold" : isOverSoft ? "text-amber-500" : "text-muted-foreground/50"
      )}>
        {isOverSoft && !isOverHard && <AlertCircle className="h-2.5 w-2.5" />}
        <span>{current.toLocaleString()} / {max.toLocaleString()}</span>
        {isOverSoft && !isOverHard && <span>(Getting long, try to keep it concise)</span>}
      </div>
    );
  };

  // ─── Step Renderers ─────────────────────────────────────────────────────────

  const renderStep0_Business = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        <Label htmlFor="name" className="text-xs uppercase tracking-widest text-primary/70">
          Your Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          className="bg-background/50 border-primary/20 focus:border-primary/50 transition-all"
          value={data.business.name || ""}
          onChange={(e) => updateData("business", "name", e.target.value)}
          placeholder="John Doe"
          maxLength={100}
        />
        <CharacterCount current={data.business.name.length} max={100} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="company" className="text-xs uppercase tracking-widest text-primary/70">
          Company Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="company"
          className="bg-background/50 border-primary/20 focus:border-primary/50 transition-all"
          value={data.business.company || ""}
          onChange={(e) => updateData("business", "company", e.target.value)}
          placeholder="Acme Inc."
          maxLength={100}
        />
        <CharacterCount current={data.business.company.length} max={100} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="industry" className="text-xs uppercase tracking-widest text-primary/70">
          Industry <span className="text-destructive">*</span>
        </Label>
        <Select
          value={data.business.industry || ""}
          onValueChange={(val) => {
            updateData("business", "industry", val);
            updateData("business", "subIndustry", "");
          }}
        >
          <SelectTrigger className="bg-background/50 border-primary/20">
            <SelectValue placeholder="Select industry" />
          </SelectTrigger>
          <SelectContent>
            {Object.keys(INDUSTRIES_WITH_SUBCATEGORIES).map((ind) => (
              <SelectItem key={ind} value={ind}>{ind}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {data.business.industry && (
        <div className="space-y-2 animate-in fade-in duration-300">
          <Label htmlFor="subIndustry" className="text-xs uppercase tracking-widest text-primary/70">
            Sub-Category
          </Label>
          <Select
            value={data.business.subIndustry || ""}
            onValueChange={(val) => updateData("business", "subIndustry", val)}
          >
            <SelectTrigger className="bg-background/50 border-primary/20">
              <SelectValue placeholder="Select specialization" />
            </SelectTrigger>
            <SelectContent>
              {INDUSTRIES_WITH_SUBCATEGORIES[data.business.industry]?.map((sub) => (
                <SelectItem key={sub} value={sub}>{sub}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="businessModel" className="text-xs uppercase tracking-widest text-primary/70">
          Business Model <span className="text-destructive">*</span>
        </Label>
        <Select
          value={data.business.businessModel || ""}
          onValueChange={(val) => updateData("business", "businessModel", val)}
        >
          <SelectTrigger className="bg-background/50 border-primary/20">
            <SelectValue placeholder="Select model" />
          </SelectTrigger>
          <SelectContent>
            {BUSINESS_MODELS.map((model) => (
              <SelectItem key={model} value={model}>{model}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="website" className="text-xs uppercase tracking-widest text-primary/70">
          Website (Optional)
        </Label>
        <Input
          id="website"
          className="bg-background/50 border-primary/20 focus:border-primary/50 transition-all"
          value={data.business.website || ""}
          onChange={(e) => updateData("business", "website", e.target.value)}
          placeholder="https://example.com"
          maxLength={255}
        />
        <CharacterCount current={(data.business.website || "").length} max={255} />
      </div>
    </div>
  );

  const renderStep1_Offer = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        <Label htmlFor="description" className="text-xs uppercase tracking-widest text-primary/70">
          What do you sell/offer? <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="description"
          className="bg-background/50 border-primary/20 min-h-[100px]"
          value={data.offer.description || ""}
          onChange={(e) => updateData("offer", "description", e.target.value)}
          placeholder="Describe your main products or services..."
          maxLength={5000}
        />
        <CharacterCount current={data.offer.description.length} max={5000} softMax={3000} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="mainProducts" className="text-xs uppercase tracking-widest text-primary/70">
          Main products/services <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="mainProducts"
          className="bg-background/50 border-primary/20 min-h-[80px]"
          value={data.offer.mainProducts || ""}
          onChange={(e) => updateData("offer", "mainProducts", e.target.value)}
          placeholder="List your top products and their key features..."
          maxLength={5000}
        />
        <CharacterCount current={data.offer.mainProducts.length} max={5000} softMax={3000} />
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
                {data.offer.targetCustomers.length
                  ? data.offer.targetCustomers.join(", ")
                  : "Select customer types"}
              </span>
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)]">
            {CUSTOMER_TYPES.map((type) => (
              <DropdownMenuCheckboxItem
                key={type}
                checked={data.offer.targetCustomers.includes(type)}
                onCheckedChange={(checked) => {
                  const current = data.offer.targetCustomers;
                  const next = checked
                    ? [...current, type]
                    : current.filter((t: string) => t !== type);
                  updateData("offer", "targetCustomers", next);
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

  const renderStep2_Goals = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Conversion Goal */}
      <div className="space-y-3">
        <Label className="text-xs uppercase tracking-widest text-primary/70">
          What should your chatbot focus on? <span className="text-destructive">*</span>
        </Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {CONVERSION_GOAL_OPTIONS.map(({ value, label, description, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => updateData("chatbotGoals", "conversionGoal", value)}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-3 text-left transition-all duration-200",
                data.chatbotGoals.conversionGoal === value
                  ? "border-primary bg-primary/5 ring-2 ring-primary/30 shadow-sm"
                  : "border-border/50 hover:border-primary/30 hover:bg-muted/30"
              )}
            >
              <Icon className={cn(
                "h-4 w-4 mt-0.5 shrink-0",
                data.chatbotGoals.conversionGoal === value ? "text-primary" : "text-muted-foreground"
              )} />
              <div>
                <div className="text-sm font-medium">{label}</div>
                <div className="text-xs text-muted-foreground">{description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Preferred CTA */}
      <div className="space-y-3">
        <Label className="text-xs uppercase tracking-widest text-primary/70">
          How should leads contact you? <span className="text-destructive">*</span>
        </Label>
        <div className="flex flex-wrap gap-2">
          {CTA_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => updateData("chatbotGoals", "preferredCta", value)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all duration-200",
                data.chatbotGoals.preferredCta === value
                  ? "border-primary bg-primary/5 text-primary font-medium ring-1 ring-primary/30"
                  : "border-border/50 text-muted-foreground hover:border-primary/30"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Bot Personality */}
      <div className="space-y-3">
        <Label className="text-xs uppercase tracking-widest text-primary/70">
          Chatbot personality
        </Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PERSONALITY_OPTIONS.map(({ value, label, description }) => (
            <button
              key={value}
              type="button"
              onClick={() => updateData("chatbotGoals", "botPersonality", value)}
              className={cn(
                "rounded-lg border p-2.5 text-center transition-all duration-200",
                data.chatbotGoals.botPersonality === value
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "border-border/50 hover:border-primary/30"
              )}
            >
              <div className="text-sm font-medium">{label}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Escalation */}
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-widest text-primary/70">
          When the bot can&apos;t help, what happens?
        </Label>
        <Select
          value={data.chatbotGoals.escalationPreference}
          onValueChange={(val) =>
            updateData("chatbotGoals", "escalationPreference", val as OnboardingData["chatbotGoals"]["escalationPreference"])
          }
        >
          <SelectTrigger className="bg-background/50 border-primary/20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ESCALATION_OPTIONS.map(({ value, label }) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const renderStep3_Context = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-2">
        <Label htmlFor="commonQuestions" className="text-xs uppercase tracking-widest text-primary/70">
          What do customers ask most often?
        </Label>
        <Textarea
          id="commonQuestions"
          className="bg-background/50 border-primary/20 min-h-[120px]"
          value={data.context.commonQuestions || ""}
          onChange={(e) => updateData("context", "commonQuestions", e.target.value)}
          placeholder="e.g. What are your prices? Do you offer refunds? How long does delivery take?"
          maxLength={5000}
        />
        <CharacterCount current={data.context.commonQuestions.length} max={5000} softMax={3000} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="otherInfo" className="text-xs uppercase tracking-widest text-primary/70">
          Anything else the AI should know?
        </Label>
        <Textarea
          id="otherInfo"
          className="bg-background/50 border-primary/20 min-h-[100px]"
          value={data.context.otherInfo || ""}
          onChange={(e) => updateData("context", "otherInfo", e.target.value)}
          placeholder="Any other details to help personalize your chatbot..."
          maxLength={5000}
        />
        <CharacterCount current={(data.context.otherInfo || "").length} max={5000} softMax={3000} />
      </div>
      <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/10">
        <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground leading-relaxed">
          Based on your answers, we&apos;ll generate a custom chatbot flow
          tailored to your <strong>{data.business.industry || "industry"}</strong> business
          with a focus on <strong>{CONVERSION_GOAL_OPTIONS.find(g => g.value === data.chatbotGoals.conversionGoal)?.label?.toLowerCase() || "your goals"}</strong>.
        </p>
      </div>
    </div>
  );

  const renderStage = () => {
    switch (step) {
      case 0: return renderStep0_Business();
      case 1: return renderStep1_Offer();
      case 2: return renderStep2_Goals();
      case 3: return renderStep3_Context();
      default: return null;
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

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
              {step === 0 && "Tell us about your business so we can build the perfect chatbot."}
              {step === 1 && "Describe what you offer so your chatbot speaks your language."}
              {step === 2 && "Define what your chatbot should achieve and how it should behave."}
              {step === 3 && "Add context to make your chatbot even smarter."}
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
                  Previous
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={loading}
                  className="min-w-[140px] bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_-5px_rgba(var(--primary),0.5)] transition-all active:scale-95"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {step === STAGES.length - 1 ? "Build My Chatbot" : "Continue"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
