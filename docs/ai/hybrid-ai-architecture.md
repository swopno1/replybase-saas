# Hybrid AI Architecture for ReplyBase

## Concept
ReplyBase will utilize a **Hybrid-Provider Strategy** to balance cost, performance, and reliability.

## Architecture Layers
1. **Layer 1: Deterministic (Regex/Logic)**
   - Handled in `ai-fallback.ts`. Cost: $0.
2. **Layer 2: Fast Utility (DigitalOcean Llama 3.1 8B)**
   - Tasks: Intent detection, entity extraction (business type, volume).
   - Goal: < 500ms response time.
3. **Layer 3: Generative Chat (DigitalOcean Llama 3.1 70B)**
   - Tasks: General customer support chat for Free/Starter plans.
4. **Layer 4: Premium Reasoning (Claude 3.5 / GPT-4o)**
   - Tasks: Onboarding flow generation, Pro/Business tenant chats.
5. **Layer 5: Emergency Fallback (Gemini 1.5 Flash)**
   - Triggered when primary providers (DO/OpenAI) fail.

## Implementation Path
- **Provider Switching**: Controlled via `lib/ai-service.ts`.
- **Tenant Overrides**: Individual tenants can bring their own API keys for OpenAI/Anthropic.
