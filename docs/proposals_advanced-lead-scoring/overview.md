# Strategic Proposal: Advanced AI Lead Scoring & Prioritization

## Overview
As ReplyBase scales, manual lead qualification becomes a bottleneck for growing sales teams. This proposal outlines a system that automatically scores and prioritizes leads based on conversational intent and business value markers extracted during AI interactions.

## Business Value
- **Increased Efficiency**: Sales agents focus on high-intent leads first, reducing time-to-close.
- **Improved Conversion**: Fast-tracking "hot" leads prevents drop-offs to competitors.
- **Tiered Engagement**: Enables differentiated automated follow-up strategies for low vs. high score leads.

## UX Impact
- **Prioritized CRM View**: A "Hot Leads" section or sortable "Score" column in the dashboard.
- **Visual Indicators**: Color-coded badges (e.g., 🔴 Hot, 🟡 Warm, 🔵 Cold) in the conversation list.
- **Instant Alerts**: High-score leads trigger priority notifications (Telegram/SMS).

## Technical Considerations
- **LLM Scoring Engine**: Add a scoring step to the `LeadService` extraction pipeline using the DigitalOcean AI infrastructure.
- **Scoring Schema**: Implement a 0-100 score field on the `Lead` model.
- **Asynchronous Processing**: Background workers handle scoring to maintain low message latency.

## Implementation Phases
1. **Phase 1: Basic Scoring Logic**: Regex and keyword-based scoring (e.g., "pricing", "demo", "buy").
2. **Phase 2: AI Intent Scoring**: LLM-driven analysis of sentiment and intent.
3. **Phase 3: CRM Integration**: UI updates to display scores and allow sorting.

## Rollout Strategy
- **Internal Beta**: Enable scoring for internal ReplyBase tenants first to calibrate AI weights.
- **Shadow Scoring**: Implement scoring in the background without exposing to users to verify accuracy.
- **Phased Opt-in**: Allow Pro-tier users to opt-in to the "AI Prioritization" dashboard.

## AI-readable Execution Prompts
```markdown
1.  **Modify Prisma Schema**: Add `score Int? @default(0)` to the `Lead` model in `prisma/schema.prisma`.
2.  **Update LeadService**: In `lib/services/lead-service.ts`, implement a `calculateLeadScore` method that uses `ai-fallback` patterns to categorize intent.
3.  **UI Integration**: In `app/(dashboard)/leads/page.tsx`, add a sortable "Priority" column that maps the numeric score to badge labels (Hot, Warm, Cold).
```

## Risks
- **Hallucinations**: AI might over-inflate score based on polite but non-committal language.
- **Latency**: Adding a scoring step might delay notifications if not properly offloaded to workers.
