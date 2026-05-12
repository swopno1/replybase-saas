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
# DigitalOcean AI Migration Guide

This guide outlines the step-by-step process for migrating ReplyBase AI workloads from OpenAI/Gemini to **DigitalOcean Gradient (AI Platform)**.

## 1. Enrollment & Key Generation
Before updating the application, you must enable the AI services in your DigitalOcean account.

1.  **Login to DigitalOcean**: [cloud.digitalocean.com](https://cloud.digitalocean.com)
2.  **Navigate to AI Platform**: Click on "AI" in the left sidebar.
3.  **Enroll in Gradient**: If prompted, enroll in the "Gradient AI Platform" or "GenAI Platform" preview/public release.
4.  **Create Model Access Key**:
    *   Go to **Settings** within the AI section.
    *   Navigate to **Access Keys**.
    *   Generate a new **Model Access Key**.
    *   **Important**: Copy this key immediately; it will not be shown again.

---

## 2. Environment Configuration (Coolify)
Update your environment variables in the Coolify dashboard for the ReplyBase project.

### Required Environment Variables
| Variable | Value / Description |
| :--- | :--- |
| `DIGITALOCEAN_AI_KEY` | The Model Access Key generated in Step 1. |
| `DIGITALOCEAN_AI_BASE_URL` | `https://inference.do-ai.run/v1` |
| `AI_STRATEGY` | `hybrid` (Optional, if using our custom router) |

---


### Step 3: Deployment
1.  Commit changes to the repository.
2.  Trigger a deployment in Coolify.
3.  Verify the new environment variables are active.

### Step 4: Verification
Use the **Admin Simulation Lab** (once implemented) or internal test accounts to verify:
- [ ] TTFT (Time To First Token) is < 500ms.
- [ ] No network timeouts between the Droplet and the AI Inference engine.
- [ ] Correct model is being used for the specific task.

---

## 5. Tips & Tricks for DigitalOcean AI
- **Streaming is Mandatory**: For the best UX on DO, always enable streaming. Since the network latency is low, the perceived speed is significantly higher when tokens start appearing instantly.
- **Regional Co-location**: Ensure your Droplet is in the same region as your AI inference (e.g., NYC, SFO, AMS). Check the DO dashboard for "Regional Availability" of specific models.
- **Quantization**: If self-hosting via GPU Droplets later, use 4-bit or 8-bit quantization to fit larger models on smaller GPUs without significant quality loss.
- **Fallback Logic**: Always implement a fallback to OpenAI in your `AiService` in case of rate limits or temporary outages on the Gradient platform.
