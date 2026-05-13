# Latency Analysis: The "Chat-First" Advantage

## 1. Network Topology vs. Perceived Speed
Latency is the #1 churn driver for AI chatbots. We prioritize **Time to First Token (TTFT)** as our core technical KPI.

| Provider | Path | Avg TTFT | Snappiness Rating |
| :--- | :--- | :--- | :--- |
| **DigitalOcean** | **Private Backbone** | **380ms** | **Elite** |
| OpenAI (Public) | Public Internet | 650ms | Good |
| Google (Public) | Public Internet | 900ms | Fair |

---

## 2. Next-Gen Model Latency Targets
With the release of "Nano" and "Flash" disruptor models, we are targeting a sub-300ms experience for background tasks.

| Task | Target Model | Est. Processing Time | Total RTT |
| :--- | :--- | :--- | :--- |
| **Intent Extraction** | **GPT-5 Nano** | 100ms | **150ms** |
| **Standard Chat** | **Llama 4 Maverick** | 300ms | **320ms** |
| **Complex Logic** | **Claude Sonnet 4.6** | 600ms | **750ms** |

---

## 3. Streaming (SSE) Implementation
By using Server-Sent Events (SSE) directly from our DigitalOcean backbone:
1.  **Eliminate Buffer Latency**: Tokens are sent as they are generated.
2.  **Increase Perceived Speed**: Users see text appearing within 0.4 seconds, satisfying the "instant response" psychology.

---

## 4. Regional Optimization
We co-locate our **ReplyBase App Droplets** and **Gradient AI Inference** in the same DO region (e.g., `nyc3`). This reduces the network hop to <10ms, making the infrastructure feel "monolithic" despite being a distributed AI system.
