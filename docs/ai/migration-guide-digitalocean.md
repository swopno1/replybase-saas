# DigitalOcean AI Migration & Future-Proofing Guide

This guide outlines the process for migrating to **DigitalOcean AI Inference** and configuring the platform with our **Primary** target models for maximum performance and efficiency.

---

## 1. Enrollment & Connectivity
1.  **Generate Keys**: Create a Model Access Key in the DigitalOcean AI Console.
2.  **Base URL**: `https://inference.do-ai.run/v1` (OpenAI Compatible).

---

## 2. Environment Configuration (Primary Task Routing)
Update your Coolify environment variables to establish the primary orchestration logic.

| Task Variable | Recommended Primary Model | Provider |
| :--- | :--- | :--- |
| `DEFAULT_CHAT_PROVIDER` | **GPT-oss-120b** | `openai` |
| `DEFAULT_ONBOARDING_PROVIDER` | **Claude Sonnet 4.6** | `anthropic` |
| `DEFAULT_ANALYSIS_PROVIDER` | **Qwen 3.5 397B** | `openai` (or Qwen API) |
| `DEFAULT_SUMMARY_PROVIDER` | **GPT-5 Nano** | `openai` |

---

## 3. Specific Model ID Configuration
Ensure the following Model ID overrides are set in your environment to point to the primary catalog selections:

| Env Variable | Value |
| :--- | :--- |
| `AI_MODEL_OPENAI_MAIN` | `gpt-oss-120b` |
| `AI_MODEL_OPENAI_UTILITY` | `gpt-5-nano` |
| `AI_MODEL_ANTHROPIC_MAIN` | `claude-sonnet-4.6` |
| `AI_MODEL_DO_MAIN` | `llama-3.1-8b-instruct` (Internal Fallback) |

---

## 4. Operational Modes
The platform supports specialized modes by overriding the primary providers:

### "Max Margin" Mode (Utility Focus)
*   **Purpose**: Near-zero cost for background tasks.
*   **Setting**: `DEFAULT_SUMMARY_PROVIDER=openai` + `AI_MODEL_OPENAI_UTILITY=gpt-5-nano`.

### "Elite Reasoning" Mode (Onboarding Focus)
*   **Purpose**: Flawless bot flow generation.
*   **Setting**: `DEFAULT_ONBOARDING_PROVIDER=anthropic` + `AI_MODEL_ANTHROPIC_MAIN=claude-sonnet-4.6`.

---

## 5. Verification & Health Checks
- [ ] **Connectivity**: Run `npx tsx scripts/test-chatbot.js --provider=openai` to verify GPT-oss-120b connectivity.
- [ ] **Latency**: Ensure Chat TTFT (Time To First Token) is **<500ms** in the Admin Simulation Lab.
- [ ] **Fallback**: Temporarily disable the OpenAI key to verify the system cascades to **DigitalOcean (Llama 3.1)** automatically.
