"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
    Loader2,
    Save,
    Sparkles,
    Target,
    ChevronDown,
    Bot,
    Info,
    Terminal,
    Zap
} from "lucide-react";
import { toast } from "sonner";
import {
    OnboardingData,
    OnboardingSummary,
    CONVERSION_GOALS,
    PREFERRED_CTAS,
    BOT_PERSONALITIES,
    ESCALATION_PREFERENCES
} from "@/types/shared/onboarding";

const INDUSTRIES = [
  "Real Estate",
  "E-commerce & Retail",
  "Professional Services",
  "Home Services & Trades",
  "Healthcare & Wellness",
  "Software & Technology",
  "Travel & Hospitality",
  "Education & Coaching",
  "Marketing & Agency",
  "Other"
];

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

interface AiOnboardingTabProps {
  subscriberId: string;
  tenantData: {
    name: string;
    onboardingData?: {
      raw?: OnboardingData;
      summary?: OnboardingSummary;
    } | null;
  };
}

export function AiOnboardingTab({ subscriberId, tenantData }: AiOnboardingTabProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<OnboardingData | null>(tenantData.onboardingData?.raw || null);
  const [summary, setSummary] = useState<OnboardingSummary | null>(tenantData.onboardingData?.summary || null);

  const handleUpdateData = (section: keyof OnboardingData, field: string, value: string | string[]) => {
    if (!data) return;
    setData({
      ...data,
      [section]: {
        ...data[section],
        [field]: value,
      },
    });
  };

  const handleSaveAndReonboard = async () => {
    if (!data) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/subscribers/${subscriberId}/re-onboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const result = await response.json();
        setSummary(result.summary);
        toast.success("Onboarding data updated and AI context regenerated!");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to update onboarding data");
      }
    } catch (error) {
      console.error("Error re-onboarding:", error);
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (!data) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>No Onboarding Data</CardTitle>
                <CardDescription>This tenant has not completed the onboarding process yet.</CardDescription>
            </CardHeader>
            <CardContent>
                <Button onClick={() => setData({
                    business: { name: "", company: tenantData.name, industry: "Other", subIndustry: "", website: "", businessModel: "B2B" },
                    offer: { description: "", targetCustomers: [], mainProducts: "" },
                    chatbotGoals: { conversionGoal: "lead_capture", preferredCta: "email", botPersonality: "friendly", escalationPreference: "email" },
                    context: { commonQuestions: "", otherInfo: "" },
                })}>
                    Initialize Onboarding Data
                </Button>
            </CardContent>
        </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-indigo-500" />
                Business Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Admin Name</Label>
                  <Input
                    value={data.business.name}
                    onChange={(e) => handleUpdateData("business", "name", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input
                    value={data.business.company}
                    onChange={(e) => handleUpdateData("business", "company", e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Industry</Label>
                  <Select
                    value={data.business.industry}
                    onValueChange={(val) => handleUpdateData("business", "industry", val)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Sub-Industry</Label>
                  <Input
                    value={data.business.subIndustry || ""}
                    onChange={(e) => handleUpdateData("business", "subIndustry", e.target.value)}
                    placeholder="e.g. SaaS, Cleaning, Dental..."
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Business Model</Label>
                <Select
                  value={data.business.businessModel}
                  onValueChange={(val) => handleUpdateData("business", "businessModel", val)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BUSINESS_MODELS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Website</Label>
                <Input
                    value={data.business.website || ""}
                    onChange={(e) => handleUpdateData("business", "website", e.target.value)}
                    placeholder="https://..."
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                Offer & Audience
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>What they offer</Label>
                <Textarea
                    value={data.offer.description}
                    onChange={(e) => handleUpdateData("offer", "description", e.target.value)}
                    rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Main Products/Services</Label>
                <Textarea
                    value={data.offer.mainProducts}
                    onChange={(e) => handleUpdateData("offer", "mainProducts", e.target.value)}
                    rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Target Customers</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between font-normal">
                      <span className="truncate">
                        {data.offer.targetCustomers.length > 0
                            ? data.offer.targetCustomers.join(", ")
                            : "Select customers"}
                      </span>
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-full min-w-[300px]">
                    {CUSTOMER_TYPES.map((type) => (
                      <DropdownMenuCheckboxItem
                        key={type}
                        checked={data.offer.targetCustomers.includes(type)}
                        onCheckedChange={(checked) => {
                          const current = data.offer.targetCustomers;
                          const next = checked
                            ? [...current, type]
                            : current.filter((t: string) => t !== type);
                          handleUpdateData("offer", "targetCustomers", next);
                        }}
                      >
                        {type}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-blue-500" />
                Chatbot Goals & Personality
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Conversion Goal</Label>
                  <Select
                    value={data.chatbotGoals.conversionGoal}
                    onValueChange={(val) => handleUpdateData("chatbotGoals", "conversionGoal", val)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONVERSION_GOALS.map(g => <SelectItem key={g} value={g} className="capitalize">{g.replace("_", " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Preferred CTA</Label>
                  <Select
                    value={data.chatbotGoals.preferredCta}
                    onValueChange={(val) => handleUpdateData("chatbotGoals", "preferredCta", val)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PREFERRED_CTAS.map(c => <SelectItem key={c} value={c} className="capitalize">{c.replace("_", " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Bot Personality</Label>
                  <Select
                    value={data.chatbotGoals.botPersonality}
                    onValueChange={(val) => handleUpdateData("chatbotGoals", "botPersonality", val)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BOT_PERSONALITIES.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Escalation Preference</Label>
                  <Select
                    value={data.chatbotGoals.escalationPreference}
                    onValueChange={(val) => handleUpdateData("chatbotGoals", "escalationPreference", val)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ESCALATION_PREFERENCES.map(e => <SelectItem key={e} value={e} className="capitalize">{e.replace("_", " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-gray-500" />
                Additional Context
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Common Questions</Label>
                <Textarea
                    value={data.context.commonQuestions}
                    onChange={(e) => handleUpdateData("context", "commonQuestions", e.target.value)}
                    rows={4}
                    placeholder="List common questions and answers..."
                />
              </div>
              <div className="space-y-2">
                <Label>Other Info</Label>
                <Textarea
                    value={data.context.otherInfo || ""}
                    onChange={(e) => handleUpdateData("context", "otherInfo", e.target.value)}
                    rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end pt-4">
            <Button
                size="lg"
                className="w-full bg-indigo-600 hover:bg-indigo-700 shadow-lg"
                onClick={handleSaveAndReonboard}
                disabled={loading}
            >
                {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
                Save & Regenerate AI Context
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <Card className="border-indigo-100 bg-indigo-50/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-indigo-900">
                <Sparkles className="h-5 w-5 text-indigo-500" />
                AI Generated Summary
              </CardTitle>
              <CardDescription>How the AI perceives this business</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!summary ? (
                <div className="py-12 text-center text-muted-foreground italic">
                    Click &quot;Save & Regenerate&quot; to generate the AI summary.
                </div>
              ) : (
                <div className="space-y-4">
                    <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-indigo-600">Company Profile</Label>
                        <p className="text-sm leading-relaxed">{summary.companyProfile}</p>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-indigo-600">Target Audience</Label>
                        <p className="text-sm">{summary.targetAudience}</p>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-indigo-600">Key Offerings</Label>
                        <p className="text-sm">{summary.keyOfferings}</p>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-indigo-600">Tone & Voice</Label>
                        <p className="text-sm">{summary.toneAndVoice}</p>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-indigo-600">Common Queries Knowledge</Label>
                        <div className="bg-white/50 border border-indigo-100 rounded-md p-3 text-xs whitespace-pre-wrap font-mono">
                            {summary.commonQueries}
                        </div>
                    </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-gray-200 bg-gray-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="h-5 w-5 text-gray-500" />
                System Prompt Preview
              </CardTitle>
              <CardDescription>Grounded prompt used for AI replies</CardDescription>
            </CardHeader>
            <CardContent>
                {!summary ? (
                    <div className="py-8 text-center text-muted-foreground italic text-sm">
                        Generate a summary first to see the system prompt.
                    </div>
                ) : (
                    <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-[10px] overflow-x-auto whitespace-pre-wrap">
{ `You are an AI assistant for ${summary.companyProfile || "this business"}.
You help customers with questions about ${summary.keyOfferings || "our products and services"}.

TONE: ${summary.toneAndVoice}

RULES:
- Keep responses under 3 sentences maximum
- Be helpful but concise
- NEVER make up prices, availability, policies, or commitments
- NEVER promise specific timelines unless explicitly stated in your knowledge
- ${summary.escalationPreference === "none"
    ? "If you can't answer, say \"I'll have our team look into this and get back to you.\""
    : summary.escalationPreference === "live_chat"
      ? "If you can't answer, say \"Let me connect you with a team member who can help.\""
      : summary.escalationPreference === "phone"
        ? "If you can't answer, say \"I'd recommend speaking with our team directly — they can help you right away.\""
        : "If you can't answer, say \"I'll have our team follow up with you by email shortly.\""}

COMMON QUESTIONS YOU CAN ANSWER:
${summary.commonQueries}

- For anything outside your knowledge, politely redirect to the team` }
                    </div>
                )}
                <div className="mt-4 flex items-start gap-2 text-[10px] text-muted-foreground bg-white p-2 rounded border">
                    <Info className="h-3 w-3 mt-0.5 shrink-0" />
                    <p>This prompt is dynamically generated from the summary above and is used by the AI Fallback system to ensure grounded, safe, and professional responses.</p>
                </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
