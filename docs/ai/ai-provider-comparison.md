# AI Provider Comparison Matrix: Target Selections

| Feature | OpenAI (Target) | Anthropic (Target) | DigitalOcean (Baseline) |
| :--- | :--- | :--- | :--- |
| **Primary Models** | **GPT-oss-120b**, GPT-5 Nano | **Claude Sonnet 4.6**, o3 mini* | Llama 4 Maverick |
| **Latency** | Ultra Fast (Nano) | Fast | **Instant (Intra-DC)** |
| **Cost** | **Ultra Low (Disruptor)** | High | Very Low |
| **Reasoning** | Exceptional (GPT-oss) | **Best-in-Class (Sonnet)** | High (Llama 4) |
| **Integration** | OpenAI SDK | Anthropic SDK | OpenAI SDK (Comp) |

*\*o3 mini is listed as an Anthropic-category competitor for reasoning tasks.*

---

## 1. Workload Mapping

### The "Chat Engine" (Latency Priority)
*   **Target 1: GPT-oss-120b** (Proprietary Disruptor)
*   **Target 2: Llama 4 Maverick** (Open-Weights Leader)
*   **Rationale**: These models provide the best "snappiness" for customer-facing webchat.

### The "Onboarding Brain" (Intelligence Priority)
*   **Target 1: Claude Sonnet 4.6** (Precision Leader)
*   **Target 2: OpenAI o3 mini** (Reasoning-for-Value)
*   **Rationale**: Used for generating bot flows and handling complex sales objections.

### The "Utility Layer" (Cost Priority)
*   **Target 1: GPT-5 Nano** (Extreme Efficiency)
*   **Target 2: GPT-oss-20b** (Disruptive Utility)
*   **Rationale**: Used for running background intent analysis on every incoming message.

---

## 2. Final Strategic Ranking
1.  **Latency Layer**: DigitalOcean (Internal Network Advantage)
2.  **Efficiency Layer**: OpenAI Disruptor Series (GPT-oss, Nano)
3.  **Intelligence Layer**: Anthropic Claude (Sonnet 4.x)
