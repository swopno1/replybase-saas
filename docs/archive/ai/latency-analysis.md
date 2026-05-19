# Latency Analysis: The "Chat-First" Advantage

## 1. Network Topology vs. Perceived Speed
Latency is our primary technical differentiator. We prioritize **Time to First Token (TTFT)**.

| Provider / Model | Path | Avg TTFT | Snappiness |
| :--- | :--- | :--- | :--- |
| **DO / Llama 4** | **Private Backbone** | **380ms** | **Elite** |
| OpenAI / GPT-oss-120b | Public Internet | 650ms | Good |
| Anthropic / Sonnet 4.6 | Public Internet | 850ms | Fair |

---

## 2. Target Performance Brackets (2026)
We utilize our **Target Model Catalog** to hit specific latency "sweet spots" for different user actions.

| Task | Target Model | Processing Time | Total RTT |
| :--- | :--- | :--- | :--- |
| **Intent Check** | **GPT-5 Nano** | 100ms | **150ms** |
| **Standard Chat** | **Llama 4 Maverick** | 300ms | **320ms** |
| **Onboarding** | **Claude Sonnet 4.6** | 600ms | **750ms** |

---

## 3. Streaming (SSE) Optimization
By co-locating our **ReplyBase App Droplets** and **Gradient AI Inference** in the same region (e.g., `nyc3`), we eliminate the "Internet Jitter" that plagues other AI platforms.

*   **Internal RTT**: <10ms.
*   **Perceived Latency**: Tokens appear as they are generated, making the interaction feel "local."

---

## 4. Scaling Strategy
*   **Serverless**: High-concurrency support for standard tenants.
*   **Dedicated GPU**: Available for Enterprise tenants who require zero-queueing latency and private model instances on DigitalOcean.
