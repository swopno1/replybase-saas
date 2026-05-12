# Migration Guide: DigitalOcean AI Inference

## Phase 1: Environment Setup
1. Generate a **Model Access Key** in the DigitalOcean Control Panel.
2. Add `DIGITALOCEAN_TOKEN` to the production environment variables.
3. Set `DEFAULT_AI_PROVIDER=digitalocean`.

## Phase 2: Service Layer Update
1. Modify `lib/ai-service.ts` to include the `digitalocean` provider.
2. Update `getAiModel` to handle the `openai` client with the DO base URL.

## Phase 3: Testing & Validation
1. Run local tests using `scripts/test-chatbot.js` pointing to the DO provider.
2. Monitor `webhook_logs` for any AI-related failures.

## Phase 4: Rollout
1. Deploy to Staging.
2. Verify Llama 3.1 performance for "Chat Fallback".
3. Promote to Production.

## Rollback Plan
If DO Inference experiences downtime or significant regression in quality:
1. Change `DEFAULT_AI_PROVIDER` back to `gemini` (default).
2. Restart the app/workers.
