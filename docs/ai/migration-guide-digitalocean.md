# DigitalOcean AI Migration Guide

This guide outlines the step-by-step process for migrating ReplyBase AI workloads from OpenAI/Gemini to **DigitalOcean AI Inference (Gradient)**.

---

## 1. Enrollment & Key Generation
Before updating the application, you must enable the AI services in your DigitalOcean account.

1.  **Login to DigitalOcean**: [cloud.digitalocean.com](https://cloud.digitalocean.com)
2.  **Navigate to AI Platform**: Click on **AI** in the left sidebar.
3.  **Create Model Access Key**:
    *   Go to **Settings** within the AI section.
    *   Navigate to **Access Keys**.
    *   Generate a new **Model Access Key**.
    *   **Important**: Copy this key immediately; it will not be shown again.

---

## 2. Environment Configuration (Coolify)
Update your environment variables in the Coolify dashboard for the ReplyBase project.

### Core Connectivity
| Variable | Value / Description |
| :--- | :--- |
| `DIGITALOCEAN_AI_KEY` | The Model Access Key generated in Step 1. |
| `DIGITALOCEAN_AI_BASE_URL` | `https://inference.do-ai.run/v1` |

### Task-Based Routing (Hybrid Strategy)
The platform now supports global task routing via environment variables.
| Variable | Recommended Value |
| :--- | :--- |
| `DEFAULT_CHAT_PROVIDER` | `digitalocean` (Low Latency) |
| `DEFAULT_ONBOARDING_PROVIDER` | `openai` (High Reasoning) |
| `DEFAULT_ANALYSIS_PROVIDER` | `gemini` (Large Context) |
| `DEFAULT_SUMMARY_PROVIDER` | `digitalocean` (Cost Efficiency) |
| `DEFAULT_AI_PROVIDER` | `digitalocean` (System Fallback) |

### Model ID Overrides (Optional)
| Variable | Default Value |
| :--- | :--- |
| `AI_MODEL_DO_MAIN` | `llama-3.1-8b-instruct` |
| `AI_MODEL_DO_PREMIUM` | `llama-3.1-70b-instruct` |

---

## 3. Future-Proofing: Next-Gen Model Integration
As the AI landscape evolves, you can swap the internal models for "Disruptor" models by updating the following environment variables:

| Goal | Target Model | Env Overrides |
| :--- | :--- | :--- |
| **Max Cost Savings** | **GPT-oss-20b** | `DEFAULT_SUMMARY_PROVIDER=openai`, `AI_MODEL_OPENAI_MAIN=gpt-oss-20b` |
| **Highest Reasoning** | **Claude Sonnet 4.6** | `DEFAULT_ONBOARDING_PROVIDER=anthropic`, `AI_MODEL_ANTHROPIC_MAIN=claude-sonnet-4.6` |
| **Disruptive Chat** | **GPT-oss-120b** | `DEFAULT_CHAT_PROVIDER=openai`, `AI_MODEL_OPENAI_MAIN=gpt-oss-120b` |

---

## 4. Application Architecture
We use a unified service file to define model IDs, provider initialization, and task-based routing logic.

**File**: `lib/ai-service.ts`

### Why this architecture?
1.  **Zero-Downtime Switching**: Change a provider globally just by updating an ENV var in Coolify.
2.  **Plan-Based Scaling**: Pro/Business users automatically get premium models (e.g., Llama 70B or GPT-4o) while Free users use cost-efficient models (e.g., Llama 8B).
3.  **Intra-DC Latency**: By using `digitalocean` as the `DEFAULT_CHAT_PROVIDER`, we minimize "Network Tax" by keeping traffic within the DO ecosystem.

---

## 5. Verification & Testing

### Step 1: Connectivity Test
Run the test script to ensure your `DIGITALOCEAN_AI_KEY` is working:
```bash
npx tsx scripts/test-chatbot.js --provider=digitalocean
```

### Step 2: TTFT Check
Use the **Admin Simulation Lab** or browser dev tools to verify:
- [ ] **TTFT (Time To First Token)** is < 500ms.
- [ ] **Response Quality**: Verify Llama 3.1 8B handles intent extraction correctly.

---

## 6. Rollback Plan
If DigitalOcean experiences downtime or significant regression:
1.  In Coolify, change `DEFAULT_CHAT_PROVIDER` to `openai` or `gemini`.
2.  Redeploy/Restart the application.
3.  The system will immediately route all chat traffic to the fallback provider.
