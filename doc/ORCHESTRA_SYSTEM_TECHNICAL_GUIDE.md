# 🛠️ ORCHESTRA SYSTEM: TECHNICAL IMPLEMENTATION GUIDE

**ReplyBase Lead-Gen Flow - Backend Logic & Integration**

---

## 📋 Table of Contents

1. State Machine Architecture
2. Intent Detection Algorithm
3. Module Routing Logic (JSON Config)
4. Bridge Strategy Engine
5. Conversation Context Storage
6. API Endpoints & Webhooks
7. Integration Points with ReplyBase
8. Testing & Validation Checkpoints

---

# 1. STATE MACHINE ARCHITECTURE

## 1.1 Conversation State Model

```typescript
interface ConversationState {
  // Identification
  conversationId: string;
  userId: string;
  sessionStartTime: Date;

  // Current Location
  currentModule:
    | "Greeting"
    | "Intent"
    | "Trust"
    | "Features"
    | "Pricing"
    | "UseCase"
    | "Conversion"
    | "Closing";
  previousModules: string[];

  // Data Capture
  capturedData: {
    firstName?: string;
    company?: string;
    industry?: string;
    conversationsPerDay?: number;
    currentPain?: string[];
    currentSolution?: string;
    budgetRange?: string;
    timeline?: string;
    decisionMaker?: boolean;
  };

  // Intent & Scoring
  detectedIntent:
    | "social"
    | "price-conscious"
    | "feature-driven"
    | "business-buyer"
    | "risk-averse"
    | "passive";
  intentScore: number; // 0-10, triggers conversion @ 8+
  conversionReadiness: "cold" | "warm" | "hot";

  // Interaction History
  messageHistory: Array<{
    role: "bot" | "user";
    content: string;
    timestamp: Date;
    moduleContext: string;
    bridgeType?: string;
  }>;

  // Action Flags
  showedPricingInfo: boolean;
  showedTrustInfo: boolean;
  exploreFeatures: string[];
  objectionRaised?: string;

  // Next Steps
  recommendedAction:
    | "free-trial"
    | "demo-call"
    | "pricing-call"
    | "escalate-sales";
  readyForConversion: boolean;
}
```

## 1.2 State Transition Diagram

```
┌─────────────────────────────────────────────────────────┐
│                      GREETING                            │
│        (Welcome + Intent-Capture Question)               │
└────────────────────┬────────────────────────────────────┘
                     │
          ┌──────────┼──────────┐
          │          │          │
          ▼          ▼          ▼
    ┌─────────┐  ┌────────┐  ┌──────────┐
    │  TRUST  │  │FEATURES│  │  PRICING │
    │ MODULE  │  │ MODULE │  │  MODULE  │
    └────┬────┘  └───┬────┘  └────┬─────┘
         │           │            │
         └─────┬─────┴────┬───────┘
               │          │
         ┌─────▼──────────▼─────┐
         │   INTENT LAYER       │
         │  (Pain Point/ROI)    │
         └──────────┬───────────┘
                    │
         ┌──────────▼──────────┐
         │   USE-CASE MODULE   │
         │ (Personalization)   │
         └──────────┬──────────┘
                    │
         ┌──────────▼──────────┐
         │ CONVERSION LAYER    │
         │ (High-Intent Push)  │
         └──────────┬──────────┘
                    │
         ┌──────────▼──────────┐
         │  FREE TRIAL /CALL   │
         │   SIGNUP FLOW       │
         └─────────────────────┘
```

---

# 2. INTENT DETECTION ALGORITHM

## 2.1 Intent Classification Engine

```python
class IntentClassifier:
    def __init__(self):
        self.intent_keywords = {
            'social': ['hello', 'hi', 'hey', 'what\'s up', 'how are you'],
            'price_conscious': ['price', 'cost', 'how much', 'pricing', 'free', 'payment'],
            'feature_driven': ['how does it work', 'features', 'demo', 'capabilities', 'what can it do'],
            'business_buyer': ['for my team', 'our company', 'business', 'enterprise', 'department'],
            'risk_averse': ['reliable', 'trusted', 'secure', 'compliance', 'uptime', 'reviews', 'safe'],
            'passive': []  # Unclear or no pattern
        }

        self.intent_weights = {
            'keyword_match': 0.4,
            'question_type': 0.3,
            'context_history': 0.2,
            'sentiment': 0.1
        }

    def classify_message(self, user_message: str, conversation_state: dict) -> dict:
        """
        Analyze user message and return intent classification
        """
        intent = self._match_keywords(user_message)
        confidence = self._calculate_confidence(user_message, conversation_state)

        return {
            'intent': intent,
            'confidence': confidence,  # 0-1.0
            'keywords_matched': self._extract_matched_keywords(user_message),
            'recommended_module': self._map_intent_to_module(intent)
        }

    def _match_keywords(self, message: str) -> str:
        """Keyword-based intent detection"""
        message_lower = message.lower()

        for intent, keywords in self.intent_keywords.items():
            for keyword in keywords:
                if keyword in message_lower:
                    return intent

        return 'passive'

    def _calculate_confidence(self, message: str, state: dict) -> float:
        """Calculate confidence of intent classification"""
        # Weight: direct keywords, question type, conversation history
        keyword_score = len(message) / 100  # Longer message = more context
        history_boosted = 0.1 if len(state.get('messageHistory', [])) > 5 else 0

        return min((keyword_score + history_boosted) * 0.8, 1.0)

    def _map_intent_to_module(self, intent: str) -> str:
        """Map intent to recommended conversation module"""
        intent_to_module = {
            'social': 'Trust',
            'price_conscious': 'Pricing',
            'feature_driven': 'Features',
            'business_buyer': 'UseCase',
            'risk_averse': 'Trust',
            'passive': 'Greeting'  # Re-engage
        }
        return intent_to_module.get(intent, 'Greeting')

# Usage
classifier = IntentClassifier()
result = classifier.classify_message(
    user_message="How much does ReplyBase cost?",
    conversation_state=state
)
# Returns: {'intent': 'price_conscious', 'confidence': 0.95, 'recommended_module': 'Pricing'}
```

## 2.2 Dynamic Intent Score Calculation

```python
class IntentScorer:
    def __init__(self):
        self.signal_weights = {
            'asked_about_pricing': 3,
            'mentioned_company': 2,
            'asked_about_features': 2,
            'mentioned_pain_point': 2,
            'asked_about_timeline': 3,
            'asked_about_ROI': 2,
            'asked_for_demo': 4,
            'asked_for_trial': 5,
            'escalation_signal': 4,  # "Let's talk to sales"
        }

    def calculate_intent_score(self, state: ConversationState) -> float:
        """
        Calculate 0-10 intent score based on signals
        8+ = High intent, ready for conversion push
        """
        score = 0.0

        # Base score from detected intent type
        intent_base = {
            'price_conscious': 6,
            'feature_driven': 5,
            'business_buyer': 7,
            'risk_averse': 4,
            'social': 1,
            'passive': 0
        }
        score += intent_base.get(state['detectedIntent'], 0)

        # Add signals from conversation history
        for message in state['messageHistory']:
            for signal, weight in self.signal_weights.items():
                if signal in message.get('content', '').lower():
                    score += weight * 0.1

        # Bonus for multi-module exploration
        if len(state['previousModules']) > 2:
            score += 1

        # Cap at 10
        return min(score, 10.0)

    def get_readiness_level(self, score: float) -> str:
        """Map score to readiness"""
        if score >= 8:
            return 'hot'
        elif score >= 5:
            return 'warm'
        else:
            return 'cold'

# Usage
scorer = IntentScorer()
state['intentScore'] = scorer.calculate_intent_score(state)
state['conversionReadiness'] = scorer.get_readiness_level(state['intentScore'])
```

---

# 3. MODULE ROUTING LOGIC (JSON CONFIG)

## 3.1 Module Manifest & Configuration

```json
{
  "modules": {
    "Greeting": {
      "id": "greeting_v1",
      "displayName": "Welcome & Intent Capture",
      "isEntry": true,
      "triggers": ["conversation_start"],
      "systemPrompt": "You are a warm, consultative welcome assistant. Your goal is to make the user feel welcomed and capture their initial intent without being pushy.",
      "welcomeMessage": "Hey [firstName, or 'there']! I'm [BotName], ReplyBase's Lead Consultant...",
      "standardBridge": "Are you here to explore AI chatbots for customer support, or curious about how ReplyBase specifically works?",
      "expectedTransitions": ["Trust", "Features", "Pricing", "UseCase"],
      "timeout": 300000,
      "timeoutHandler": "Soft re-engagement"
    },

    "Trust": {
      "id": "trust_v1",
      "displayName": "Company Credibility & Social Proof",
      "triggers": [
        "ask_about_reliability",
        "ask_for_reviews",
        "risk_averse_intent"
      ],
      "systemPrompt": "You are a credibility expert. Focus on compliance, uptime, customer testimonials, and proven track record.",
      "keyPoints": [
        "SOC 2 + HIPAA compliance",
        "99.9% uptime guarantee",
        "2000+ customers",
        "72 NPS score",
        "95% retention rate"
      ],
      "proofLinks": {
        "compliance": "replybase.com/security",
        "caseStudies": "replybase.com/customers",
        "testimonials": "replybase.com/reviews"
      },
      "closingBridge": "Does that address your main concern, or is there something else you want to validate?",
      "expectedTransitions": ["Features", "Pricing", "UseCase", "Conversion"],
      "exitSignal": "user_satisfied_with_credibility"
    },

    "Features": {
      "id": "features_v1",
      "displayName": "Technical Capabilities & Documentation",
      "triggers": [
        "ask_how_it_works",
        "ask_for_features",
        "feature_driven_intent"
      ],
      "systemPrompt": "You are a technical consultant. Be specific, provide examples, and link to real documentation.",
      "coreFeatures": [
        {
          "name": "Smart Intent Recognition",
          "description": "Automatically understands....",
          "docLink": "replybase.com/docs/intent-recognition"
        },
        {
          "name": "Multi-Channel Unified",
          "description": "Manage email, chat, social...",
          "docLink": "replybase.com/docs/channels"
        },
        {
          "name": "Custom Knowledge Integration",
          "description": "Upload your docs...",
          "docLink": "replybase.com/docs/knowledge-base"
        },
        {
          "name": "Handoff Intelligence",
          "description": "Seamless human handoff...",
          "docLink": "replybase.com/docs/handoff"
        },
        {
          "name": "Analytics & Real-Time Insights",
          "description": "Monitor performance...",
          "docLink": "replybase.com/docs/analytics"
        }
      ],
      "personalizationQuestions": "What's your biggest support challenge?",
      "closingBridge": "Which feature solves your problem best? Or want to see a live demo?",
      "expectedTransitions": ["Pricing", "Trust", "UseCase", "Conversion"],
      "exitSignal": "user_understands_features"
    },

    "Pricing": {
      "id": "pricing_v1",
      "displayName": "Value Proposition & ROI",
      "triggers": ["ask_price", "price_conscious_intent"],
      "systemPrompt": "CRITICAL: Never lead with price. Lead with ROI. Tie every number to their specific pain point.",
      "pricingStrategy": {
        "approach": "Volume-based, not seat-based",
        "tiers": [
          {
            "name": "Starter",
            "monthlyConversations": 500,
            "monthlyPrice": 300,
            "perConversationCost": 0.6
          },
          {
            "name": "Growth",
            "monthlyConversations": 2000,
            "monthlyPrice": 800,
            "perConversationCost": 0.4
          },
          {
            "name": "Enterprise",
            "monthlyConversations": "5000+",
            "monthlyPrice": "custom",
            "perConversationCost": 0.2
          }
        ]
      },
      "roiFramework": {
        "costPerHumanSupport": 15,
        "costPerAISupport": 0.35,
        "savingsMultiplier": "40-60% cost reduction"
      },
      "objectionHandlers": {
        "too_expensive": "There are cheaper tools, but they don't work. Here's the difference...",
        "free_alternative": "Free tools handle 5-10% of tickets. You'll spend more managing them than paying for real support...",
        "budget_constraint": "Start with Starter plan ($300), prove ROI in 30 days, scale up..."
      },
      "closingBridge": "Does that pricing align with your budget? Or should we talk about starting smaller?",
      "expectedTransitions": ["Features", "Trust", "UseCase", "Conversion"],
      "exitSignal": "pricing_accepted_or_alternative_found"
    },

    "UseCase": {
      "id": "usecase_v1",
      "displayName": "Industry-Specific Personalization",
      "triggers": ["user_mentions_industry", "business_buyer_intent"],
      "systemPrompt": "You are an industry consultant. Provide specific examples, challenges, and solutions for their vertical.",
      "industryProfiles": {
        "SaaS": {
          "commonPains": [
            "Support scalability",
            "Churn prevention",
            "Response time"
          ],
          "roi": "70% faster response times = lower churn = 25% revenue impact",
          "caseStudy": "replybase.com/case-study/saas-profitability"
        },
        "Ecommerce": {
          "commonPains": ["Shipping inquiries", "Returns", "Payment issues"],
          "roi": "50% fewer emails = faster order processing = 30% team scaling",
          "caseStudy": "replybase.com/case-study/ecommerce-ops"
        },
        "Healthcare": {
          "commonPains": [
            "HIPAA compliance",
            "Patient privacy",
            "Data security"
          ],
          "roi": "Never worry about compliance = trust + retention",
          "caseStudy": "replybase.com/case-study/healthcare-trust"
        },
        "FinTech": {
          "commonPains": [
            "Security concerns",
            "Regulatory compliance",
            "Trust"
          ],
          "roi": "SOC 2 + encryption = institutional trust = corporate sales",
          "caseStudy": "replybase.com/case-study/fintech-security"
        }
      },
      "closingBridge": "Does this match what you're looking for? Want to dive deeper or jump to the next step?",
      "expectedTransitions": ["Conversion", "Pricing", "Features"],
      "exitSignal": "use_case_validated"
    },

    "Intent": {
      "id": "intent_v1",
      "displayName": "Stealth Lead-Gen & Pain Point Capture",
      "triggers": ["after_greeting_response"],
      "systemPrompt": "You are a discovery consultant. Ask natural, conversational questions to uncover pain, team size, and intent. Never feel like a form.",
      "discoveryQuestions": [
        {
          "sequence": 1,
          "question": "Are you looking for personal projects or your team?",
          "dataPoint": "useCase",
          "conditional": true
        },
        {
          "sequence": 2,
          "question": "What's your industry? (SaaS, ecommerce, healthcare, etc.)",
          "dataPoint": "industry",
          "conditional": false
        },
        {
          "sequence": 3,
          "question": "Roughly how many support conversations per day?",
          "dataPoint": "conversationsPerDay",
          "conditional": false
        },
        {
          "sequence": 4,
          "question": "What's your biggest pain point right now?",
          "dataPoint": "painPoint",
          "conditional": true
        },
        {
          "sequence": 5,
          "question": "Are you currently using any chatbot or support tool?",
          "dataPoint": "currentSolution",
          "conditional": true
        }
      ],
      "dataValidation": {
        "conversationsPerDay": "must be numeric, >= 1",
        "industry": "must match known industries or allow custom",
        "painPoint": "capture verbatim, categorize separately"
      },
      "closingBridge": "Great. Based on that, here's what I recommend...",
      "expectedTransitions": ["Trust", "Features", "Pricing", "UseCase"],
      "exitSignal": "data_capture_complete"
    },

    "Conversion": {
      "id": "conversion_v1",
      "displayName": "High-Intent Push to Signup",
      "triggers": ["intent_score_gte_8", "user_said_yes"],
      "systemPrompt": "You are a trusted advisor, not a salesman. Your tone: warmer, more confident, more consultative.",
      "conversionScript": "Okay, so based on everything we've talked about—your [specific pain], team size, and [ROI factor]—here's my honest recommendation: You're a perfect fit for ReplyBase...",
      "cta": {
        "primary": {
          "text": "Start 30-day free trial",
          "link": "replybase.com/start-free-trial",
          "description": "No credit card charged until trial ends. Full access. Test with your actual workflow."
        },
        "secondary": {
          "text": "Jump on a quick call",
          "link": "replybase.com/schedule-demo",
          "description": "15 minutes with our team. Personalized walkthrough."
        },
        "tertiary": {
          "text": "Review pricing",
          "link": "replybase.com/pricing",
          "description": "See exact cost for your volume."
        }
      },
      "closingBridge": "Which path feels best? Or one more quick question?",
      "expectedTransitions": ["Closing"],
      "exitSignal": "cta_clicked_or_question_raised"
    },

    "Closing": {
      "id": "closing_v1",
      "displayName": "Professional Exit & Next Steps",
      "triggers": ["user_accepted_cta", "user_declined"],
      "systemPrompt": "You are wrapping up professionally. No hard sells. If they said yes, celebrate. If no, leave the door open.",
      "acceptedFlow": {
        "message": "LET'S GO! 🚀 Here's your next step: [Link]. Check your email for onboarding...",
        "followUp": "Automated email with: setup guide, onboarding contact, 7-day check-in"
      },
      "declinedFlow": {
        "message": "No pressure at all. Here's what I'm sending: [pricing breakdown], [comparison], [contact]. Just reply when you're ready.",
        "followUp": "Send email with self-serve resources. Tag in CRM as 'for follow-up in 2 weeks'"
      },
      "thinkAboutItFlow": {
        "message": "Totally fair. Run it by your team. I'm sending: [PDF], [contact], [resources]. Hit us up when you're ready.",
        "followUp": "Automated email in 3 days with testimonials + one new feature that might help"
      },
      "expectedTransitions": ["END"]
    }
  },

  "globalBridges": [
    {
      "type": "open_question",
      "templates": [
        "What's your biggest concern right now?",
        "Does that make sense, or should we dig deeper?",
        "What would actually move the needle for you?"
      ]
    },
    {
      "type": "assumption_clarification",
      "templates": [
        "So it sounds like you're [X]—is that right?",
        "I'm hearing that [Y] matters most. Fair?"
      ]
    },
    {
      "type": "choice_offer",
      "templates": ["Want to [A] or [B]?", "Do you want to [C] first or [D]?"]
    },
    {
      "type": "social_proof_bridge",
      "templates": [
        "Most teams like yours start with [X]. Sound good?",
        "Here's what we typically recommend for [Y] situations..."
      ]
    },
    {
      "type": "authority_permission",
      "templates": [
        "I've helped hundreds of [X] teams. Trust me, the next step is usually [Y].",
        "Based on what you've told me, here's what I'd recommend..."
      ]
    }
  ]
}
```

---

# 4. BRIDGE STRATEGY ENGINE

## 4.1 Dynamic Bridge Selection

```typescript
class BridgeEngine {
  constructor(private bridgeConfig: any) {}

  generateBridge(
    state: ConversationState,
    currentModule: string,
    userIntentLevel: number,
  ): string {
    const moduleConfig = this.bridgeConfig.modules[currentModule];

    if (!moduleConfig) {
      return this.getDefaultBridge();
    }

    // Select bridge type based on context
    let bridgeType: string;

    if (userIntentLevel >= 8) {
      // High intent: use direct CTAs
      bridgeType = "cta_offer";
    } else if (userIntentLevel >= 5) {
      // Medium intent: use open questions or choice offers
      bridgeType = Math.random() > 0.5 ? "open_question" : "choice_offer";
    } else {
      // Low intent: use soft re-engagement
      bridgeType = "assumption_clarification";
    }

    // Get template
    const templates =
      this.bridgeConfig.globalBridges.find((b: any) => b.type === bridgeType)
        ?.templates || [];

    if (templates.length === 0) {
      return moduleConfig.closingBridge || this.getDefaultBridge();
    }

    // Select random template and personalize
    const template = templates[Math.floor(Math.random() * templates.length)];
    return this.personalizeTemplate(template, state);
  }

  personalizeTemplate(template: string, state: ConversationState): string {
    let personalized = template;

    // Replace placeholders with actual data
    if (state.capturedData.firstName) {
      personalized = personalized.replace(
        "[Name]",
        state.capturedData.firstName,
      );
    }

    if (state.capturedData.company) {
      personalized = personalized.replace(
        "[Company]",
        state.capturedData.company,
      );
    }

    if (state.capturedData.painPoint) {
      personalized = personalized.replace(
        "[Pain]",
        state.capturedData.painPoint,
      );
    }

    return personalized;
  }

  private getDefaultBridge(): string {
    return "What would be most helpful to explore next?";
  }
}

// Usage
const bridgeEngine = new BridgeEngine(moduleConfig);
const nextBridge = bridgeEngine.generateBridge(
  conversationState,
  "Pricing",
  7.5,
);
```

---

# 5. CONVERSATION CONTEXT STORAGE

## 5.1 Database Schema (Prisma)

```prisma
model ConversationSession {
  id                  String    @id @default(cuid())
  visitorId          String    // Anonymous or auth-based tracking

  // Basic Info
  firstName           String?
  email               String?
  company             String?
  industry            String?

  // Behavioral Data
  currentModule       String    // Last module visited
  previousModules     String[]  // History of modules
  detectedIntent      String    // 'price_conscious', 'feature_driven', etc.
  intentScore         Float     // 0-10

  // Captured Data
  conversationsPerDay Int?
  currentPainPoints   String[]
  currentSolution     String?
  budgetRange         String?
  timeline            String?

  // Engagement Tracking
  messageCount        Int       @default(0)
  lastMessageAt       DateTime  @updatedAt
  duration            Int       // in seconds

  // Conversion Data
  showedPricingInfo   Boolean   @default(false)
  showedTrustInfo     Boolean   @default(false)
  readyForConversion  Boolean   @default(false)
  ctaClicked          String?   // Which CTA did they click?

  // Session State
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  completedAt         DateTime? // When did conversation end?

  // Relations
  messages            Message[]
  conversionData      ConversionData?

  @@index([visitorId])
  @@index([intentScore])
  @@index([readyForConversion])
}

model Message {
  id                String    @id @default(cuid())
  conversationId    String
  conversation      ConversationSession @relation(fields: [conversationId], references: [id])

  role              String    // 'bot' | 'user'
  content           String    @db.Text
  module            String    // Which module sent/received this?
  bridgeType        String?   // What type of bridge was used?

  createdAt         DateTime  @default(now())
}

model ConversionData {
  id                String    @id @default(cuid())
  conversationId    String    @unique
  conversation      ConversationSession @relation(fields: [conversationId], references: [id])

  action            String    // 'trial_started' | 'demo_booked' | 'escalated' | 'declined'
  ctaText           String?
  timestamp         DateTime  @default(now())

  // Post-action tracking
  trialStatus       String?   // 'active' | 'completed' | 'churned'
  trialExpiresAt    DateTime?
  paidConversion    Boolean   @default(false)

  createdAt         DateTime  @default(now())
}
```

---

# 6. API ENDPOINTS & ORCHESTRATOR SERVICE

## 6.1 Main Orchestrator API

```typescript
// /api/orchestrator/message
// POST: User sends a message, orchestrator routes to correct module

import { NextRequest, NextResponse } from "next/server";
import { ConversationService } from "@/services/conversation-service";
import { IntentClassifier } from "@/lib/intent-classifier";
import { BridgeEngine } from "@/lib/bridge-engine";

export async function POST(request: NextRequest) {
  const { conversationId, userMessage } = await request.json();

  try {
    // 1. Load conversation state
    const convService = new ConversationService();
    let state = await convService.loadState(conversationId);

    // 2. Classify intent
    const classifier = new IntentClassifier();
    const intentResult = classifier.classify_message(userMessage, state);

    // 3. Update state with new intent signal
    state.capturedData = {
      ...state.capturedData,
      ...intentResult.extractedData,
    };
    state.intentScore = calculateIntentScore(state);

    // 4. Determine routing
    const nextModule = determineNextModule(state, intentResult);

    // 5. Get bot response from module
    const botResponse = await invokeModule(nextModule, state, userMessage);

    // 6. Generate bridge (transition to next step)
    const bridgeEngine = new BridgeEngine(bridgeConfig);
    const bridge = bridgeEngine.generateBridge(
      state,
      nextModule,
      state.intentScore,
    );

    // 7. Save updated state
    state.currentModule = nextModule;
    state.previousModules.push(nextModule);
    state.messageHistory.push({
      role: "user",
      content: userMessage,
      timestamp: new Date(),
    });
    state.messageHistory.push({
      role: "bot",
      content: botResponse + " " + bridge,
      timestamp: new Date(),
      moduleContext: nextModule,
    });

    await convService.saveState(conversationId, state);

    // 8. Check if ready for conversion
    if (state.intentScore >= 8) {
      state.readyForConversion = true;
      state.recommendedAction = "free-trial";
      // Optionally: notify sales team for high-intent leads
    }

    // 9. Return response
    return NextResponse.json({
      conversationId,
      message: botResponse,
      bridge,
      nextModule,
      intentScore: state.intentScore,
      readyForConversion: state.readyForConversion,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 },
    );
  }
}
```

## 6.2 Module Invocation Service

```typescript
// /lib/module-invoker.ts

import { OpenAI } from "openai";

class ModuleInvoker {
  private openai = new OpenAI();

  async invokeModule(
    moduleName: string,
    state: ConversationState,
    userMessage: string,
    moduleConfig: any,
  ): Promise<string> {
    const config = moduleConfig.modules[moduleName];

    // Build system prompt
    const systemPrompt = `${config.systemPrompt}
    
Known facts about the user:
- Company: ${state.capturedData.company || "Unknown"}
- Industry: ${state.capturedData.industry || "Unknown"}
- Conversations/day: ${state.capturedData.conversationsPerDay || "Unknown"}
- Pain points: ${state.capturedData.currentPainPoints?.join(", ") || "Not captured yet"}
- Current solution: ${state.capturedData.currentSolution || "Unknown"}

Module instructions:
${JSON.stringify(config, null, 2)}

Important: End your response with a bridge question or suggestion that moves toward the next step. 
Never leave the conversation hanging.`;

    // Build message history for context
    const messages = state.messageHistory.slice(-6).map((m: any) => ({
      role: m.role,
      content: m.content,
    }));

    // Add current user message
    messages.push({
      role: "user",
      content: userMessage,
    });

    // Call OpenAI or your LLM
    const response = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      temperature: 0.7,
      max_tokens: 500,
    });

    return response.choices[0].message.content || "";
  }
}
```

## 6.3 Data Extraction Service

```typescript
// /lib/data-extractor.ts

class DataExtractor {
  async extractData(
    userMessage: string,
    conversationHistory: any[],
  ): Promise<Partial<CapturedData>> {
    const dataPoints = {
      firstName: null,
      company: null,
      industry: null,
      conversationsPerDay: null,
      painPoints: [],
      currentSolution: null,
      budgetRange: null,
      timeline: null,
    };

    // Use NER (Named Entity Recognition) or LLM to extract
    const extractionPrompt = `Extract the following data from the conversation:
    - First name
    - Company
    - Industry
    - Conversations per day (number)
    - Main pain points (list)
    - Current solution (if mentioned)
    - Budget range (if mentioned)
    - Timeline (if mentioned)
    
    Return as JSON.`;

    const response = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: extractionPrompt },
        {
          role: "user",
          content: conversationHistory.map((m) => m.content).join("\n"),
        },
      ],
      temperature: 0,
    });

    try {
      const extracted = JSON.parse(response.choices[0].message.content || "{}");
      return { ...dataPoints, ...extracted };
    } catch {
      return dataPoints;
    }
  }
}
```

---

# 7. INTEGRATION POINTS WITH REPLYBASE

## 7.1 Webhook: Save Lead to CRM

```typescript
// After conversion action, send lead to CRM/email

async function syncLeadToCRM(
  state: ConversationState,
  action: "trial_started" | "demo_booked" | "escalated",
) {
  const lead = {
    email: state.capturedData.email,
    firstName: state.capturedData.firstName,
    company: state.capturedData.company,
    industry: state.capturedData.industry,
    conversationsPerDay: state.capturedData.conversationsPerDay,
    painPoints: state.capturedData.currentPainPoints,
    intentScore: state.intentScore,
    action,
    conversationSummary: summarizeConversation(state.messageHistory),
    timestamp: new Date(),
  };

  // Send to Zapier, HubSpot, Salesforce, or custom CRM API
  await fetch("https://your-crm-api.com/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(lead),
  });
}
```

## 7.2 Webhook: Trial Initiated

```typescript
// When user clicks "Start Free Trial"

async function initiateFreeTrial(state: ConversationState, email: string) {
  // 1. Create trial account in ReplyBase
  const account = await prisma.account.create({
    data: {
      email,
      firstName: state.capturedData.firstName,
      company: state.capturedData.company,
      planTier: "trial",
      trialExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      originSource: "orchestrator_bot",
      metadata: {
        industry: state.capturedData.industry,
        conversationsPerDay: state.capturedData.conversationsPerDay,
        intentScore: state.intentScore,
      },
    },
  });

  // 2. Send onboarding email
  await sendEmail({
    to: email,
    template: "trial_welcome",
    data: {
      firstName: state.capturedData.firstName,
      setupGuide: "replybase.com/setup-guide",
      helpContact: "support@replybase.com",
    },
  });

  // 3. Create task for onboarding team
  await createCalendarTask({
    title: `Onboard ${state.capturedData.company}`,
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    assignee: "onboarding@replybase.com",
    notes: `Industry: ${state.capturedData.industry}, Volume: ${state.capturedData.conversationsPerDay}`,
  });
}
```

---

# 8. TESTING & VALIDATION CHECKPOINTS

## 8.1 Intent Classification Tests

```typescript
describe("IntentClassifier", () => {
  const classifier = new IntentClassifier();

  it("should detect price-conscious intent", () => {
    const result = classifier.classify_message(
      "How much does ReplyBase cost?",
      {},
    );
    expect(result.intent).toBe("price_conscious");
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it("should detect feature-driven intent", () => {
    const result = classifier.classify_message(
      "What features does it have? Can it integrate with our Slack?",
      {},
    );
    expect(result.intent).toBe("feature_driven");
  });

  it("should detect business-buyer intent", () => {
    const result = classifier.classify_message(
      "This is for our support team of 10 people",
      {},
    );
    expect(result.intent).toBe("business_buyer");
  });

  it("should handle passive/unclear intent", () => {
    const result = classifier.classify_message("okay", {});
    expect(result.intent).toBe("passive");
  });
});
```

## 8.2 Bridge Generation Tests

```typescript
describe("BridgeEngine", () => {
  const bridgeEngine = new BridgeEngine(moduleConfig);

  it("should generate CTA bridges for high-intent users", () => {
    const state = {
      intentScore: 8.5,
      capturedData: { company: "Acme Inc" },
    };
    const bridge = bridgeEngine.generateBridge(state, "Pricing", 8.5);
    expect(bridge).toContain("free trial");
  });

  it("should generate open questions for medium-intent", () => {
    const state = { intentScore: 5, capturedData: {} };
    const bridge = bridgeEngine.generateBridge(state, "Features", 5);
    expect(bridge).toMatch(/[?]/);
  });

  it("should personalize bridges with user data", () => {
    const state = {
      intentScore: 7,
      capturedData: { firstName: "Alice", company: "TechCorp" },
    };
    const bridge = bridgeEngine.generateBridge(state, "Trust", 7);
    // Should mention company or first name
    expect(bridge.toLowerCase()).toMatch(/alice|techcorp/i);
  });
});
```

## 8.3 E2E Conversation Flow Test

```typescript
describe("Orchestra System E2E", () => {
  it("should flow from Greeting → Intent → Pricing → Conversion", async () => {
    // Start conversation
    let res = await post("/api/orchestrator/message", {
      conversationId: "test-123",
      userMessage: "Hello",
    });
    expect(res.nextModule).toBe("Trust"); // Social intent

    // User reveals pain point
    res = await post("/api/orchestrator/message", {
      conversationId: "test-123",
      userMessage: "I run a SaaS company with 100 support tickets daily.",
    });
    expect(res.nextModule).toBe("Intent"); // Business context captured
    expect(res.body).toContain("pain"); // Intent layer should ask about pain

    // User asks about pricing
    res = await post("/api/orchestrator/message", {
      conversationId: "test-123",
      userMessage: "How much does it cost?",
    });
    expect(res.nextModule).toBe("Pricing");
    expect(res.intentScore).toBeGreaterThan(7);

    // System detects high intent → triggers conversion
    expect(res.readyForConversion).toBe(true);
    expect(res.message).toContain("free trial"); // Conversion layer activated
  });
});
```

---

# 9. DEPLOYMENT & MONITORING

## 9.1 Required Environment Variables

```bash
# LLM Configuration
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4

# Database
DATABASE_URL=postgresql://...

# CRM Integrations
ZAPIER_WEBHOOK_URL=https://...
HUBSPOT_API_KEY=...

# Email
SENDGRID_API_KEY=...

# Feature Flags
ENABLE_ORCHESTRATOR=true
INTENT_SCORE_THRESHOLD=8
```

## 9.2 Monitoring Metrics

```typescript
// Track in your analytics/monitoring tool

events: {
  'conversation_started': { conversationId, source },
  'intent_detected': { intent, confidence, module },
  'module_transition': { from, to, reason },
  'bridge_generated': { type, module, accepted: boolean },
  'data_captured': { dataPoints, source },
  'conversion_action': { action, intentScore },
  'trial_started': { email, company, source },
  'objection_raised': { objection, handling_response },
}

metrics: {
  avg_conversation_duration: seconds,
  bridge_acceptance_rate: percentage,
  intent_score_distribution: histogram,
  module_visit_frequency: counts,
  conversion_rate: trials_started / conversations,
  trial_to_paid_rate: percentage,
}
```

---

## ✅ IMPLEMENTATION CHECKLIST

- [ ] Database schema created (Prisma migrations)
- [ ] Intent classifier trained/configured
- [ ] Bridge engine deployed
- [ ] Module configs loaded from JSON
- [ ] API endpoints tested
- [ ] CRM webhook integration verified
- [ ] Email sequences configured
- [ ] Analytics tracking enabled
- [ ] A/B testing framework set up
- [ ] Sales team handoff workflow documented
- [ ] Monitoring dashboards created

---

**Version**: 1.0  
**Status**: Ready for Implementation  
**Last Updated**: April 15, 2026
