# DigitalOcean AI Migration & Future-Proofing Guide

This guide outlines the process for migrating to **DigitalOcean AI Inference** and maintaining a future-proof "Disruptor" model strategy.

---

## 1. Enrollment & Connectivity
1.  **Generate Keys**: Create a Model Access Key in the DO AI Console.
2.  **Base URL**: `https://inference.do-ai.run/v1` (OpenAI Compatible).

---

## 2. Environment Configuration (Task Routing)
Update your Coolify environment variables to establish the "Hybrid Baseline."

| Task Variable | Recommended Value |
| :--- | :--- |
| `DEFAULT_CHAT_PROVIDER` | `digitalocean` |
| `DEFAULT_ONBOARDING_PROVIDER` | `openai` (or `anthropic` for Sonnet 4.6) |
| `DEFAULT_ANALYSIS_PROVIDER` | `gemini` |
| `DEFAULT_SUMMARY_PROVIDER` | `digitalocean` (or `openai` for GPT-5 Nano) |

---

## 3. Swapping in Disruptor Models
The platform is designed to swap models without code changes. Use the following overrides in Coolify:

### To enable "Max Efficiency" Mode:
*   `DEFAULT_SUMMARY_PROVIDER=openai`
*   `AI_MODEL_OPENAI_MAIN=gpt-5-nano` (Target: $0.05/1M)

### To enable "Elite Chat" Mode:
*   `DEFAULT_CHAT_PROVIDER=openai`
*   `AI_MODEL_OPENAI_MAIN=gpt-oss-120b` (Target: Large reasoning, low cost)

---

## 4. Verification Checklist
- [ ] **TTFT Check**: Use Admin Simulation Lab to verify chat starts in <500ms.
- [ ] **Provider Fallback**: Disable the DO key temporarily and verify the system cascades to Gemini/OpenAI automatically.
- [ ] **Build Stability**: Ensure `pnpm run build` succeeds after any model ID changes.
