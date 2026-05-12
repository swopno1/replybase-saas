# Latency Analysis: AI Inference

## Objectives
Minimize the "Time to First Token" (TTFT) for Webchat and WhatsApp users to maintain engagement.

## Benchmarks (Target)
- **DO Llama 3.1 8B**: < 300ms TTFT
- **DO Llama 3.1 70B**: < 600ms TTFT
- **GPT-4o-mini**: < 400ms TTFT

## Latency Reduction Strategies
1. **Regional Proximity**: Deploying ReplyBase App in DO `lon1` (London) and using Inference in the same region where available.
2. **Streaming**: Always use `streamText` from Vercel AI SDK to show immediate progress.
3. **Prompt Caching**: Utilize DigitalOcean's prompt caching features (if supported) for large system prompts in `ai-fallback.ts`.
4. **Small Models for Extraction**: Use 8B models for `generateObject` tasks to ensure rapid JSON extraction.
# Latency Analysis: The "Chat-First" Infrastructure Advantage

## 1. Why Latency Kills Chat Support
In a real-time support context, user engagement drops significantly after 1,000ms of waiting. To achieve a "seamless" feel, we target a **Time to First Token (TTFT) of <500ms**.

---

## 2. Network Topology Comparison

### Public API Routing (OpenAI / Gemini)
- **Path**: Droplet -> Public Gateway -> Multiple ISPs -> Provider Load Balancer -> Inference Engine.
- **Variable Latency (Jitter)**: 120ms to 400ms just for the network round-trip.
- **Risk**: Performance degradation during global traffic spikes.

### DigitalOcean Gradient (Internal)
- **Path**: Droplet -> DO Private Backbone -> Gradient Inference Engine.
- **Fixed Latency**: **10ms to 40ms**.
- **Advantage**: Bypasses the "Internet Noise." The application and the AI are in the same region (e.g., NYC3).

---

## 3. TTFT (Time to First Token) Deep Dive
The most critical metric for "Perceived Snappiness."

| Metric | OpenAI (Public) | DigitalOcean (Internal) | Improvement |
| :--- | :--- | :--- | :--- |
| **Network RTT** | 150ms | **20ms** | **86% Lower** |
| **Model Init (8B)** | 400ms | **400ms** | Same |
| **Total TTFT** | **550ms** | **420ms** | **23% Faster** |

**Note**: During peak internet congestion, the OpenAI RTT can spike to 500ms+, pushing the total TTFT over 1 second. DigitalOcean's internal latency remains stable.

---

## 4. Throughput & Perceived Speed
By leveraging **Streaming (SSE)** on DigitalOcean:
1.  User sends message.
2.  DO internal network handles the request in <20ms.
3.  Llama 3 8B starts streaming the first token in ~400ms.
4.  **First word appears on user's screen in ~420ms.**

This performance profile makes the AI feel "locally hosted" and instantaneous, which is a key differentiator for the ReplyBase Webchat widget.

---

## 5. Regional Optimization Strategy
To further reduce latency, ReplyBase should:
-   **Co-locate**: Ensure that production Droplets and Gradient Inference are in the same region.
-   **Reserved Inference**: For high-volume Enterprise tenants, move from Serverless to **Dedicated GPU Inference** to eliminate cold-start/queueing delays entirely.
