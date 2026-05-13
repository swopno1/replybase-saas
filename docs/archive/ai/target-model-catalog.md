# Target AI Model Catalog (2026 Strategy)

This document identifies the primary and secondary target models for each ReplyBase workload, selected from the latest disruptive model catalog for maximum margin and performance.

---

## 1. Chat Engine (The Latency Winner)
*Purpose: Real-time customer support chat, high-frequency interaction.*

*   **Primary: OpenAI GPT-oss-120b**
    *   **Cost**: $0.10/1M (In) | $0.70/1M (Out)
    *   **Rationale**: Large-model reasoning at small-model prices. Ideal for maintaining "human-like" conversation with near-zero latency on DigitalOcean.
*   **Secondary: Llama 4 Maverick**
    *   **Cost**: $0.25/1M (In) | $0.87/1M (Out)
    *   **Rationale**: The next-gen performance leader for open-weights, providing a robust fallback to proprietary models.

---

## 2. Reasoning & Onboarding (The Intelligence Winner)
*Purpose: Complex flow generation, sales objection handling, and multi-step conversion logic.*

*   **Primary: Anthropic Claude Sonnet 4.6**
    *   **Cost**: $3.00/1M (In) | $15.00/1M (Out)
    *   **Rationale**: The gold standard for instruction following. Essential for generating precise bot flows from customer unstructured data.
*   **Secondary: OpenAI o3 mini**
    *   **Cost**: $1.10/1M (In) | $4.40/1M (Out)
    *   **Rationale**: High-reasoning "thinking" model at a significantly lower price point than GPT-5 or Claude Opus.

---

## 3. Utility & Micro-Tasks (The Efficiency Winner)
*Purpose: Intent detection, entity extraction, lead tagging, and summarization.*

*   **Primary: OpenAI GPT-5 Nano**
    *   **Cost**: $0.05/1M (In) | $0.40/1M (Out)
    *   **Rationale**: Disruptive utility pricing. Allows us to run AI on every single incoming message for routing without impacting margins.
*   **Secondary: OpenAI GPT-oss-20b**
    *   **Cost**: $0.05/1M (In) | $0.45/1M (Out)
    *   **Rationale**: Direct performance competitor to Nano, useful for load-balancing background extraction tasks.

---

## 4. Analytics & Big Data (The Capacity Winner)
*Purpose: Historical conversation audits, long-context retrieval, and business insight generation.*

*   **Primary: Qwen 3.5 397B A17B**
    *   **Cost**: $0.55/1M (In) | $3.50/1M (Out)
    *   **Rationale**: Massive intelligence for processing months of historical context to find sales patterns.
*   **Secondary: Deepseek V4 Pro**
    *   **Cost**: $1.74/1M (In) | $3.48/1M (Out)
    *   **Rationale**: High-reliability extraction for enterprise-grade reporting.

---

## 5. Specialized Multimodal (The Vision Winner)
*Purpose: Processing user screenshots and rich media within the chat.*

*   **Primary: OpenAI GPT Image 1.5**
    *   **Cost**: $5.00/1M (In) | $10.00/1M (Out)
    *   **Rationale**: Best-in-class vision for debugging customer issues via screenshots.
*   **Secondary: Nemotron 3 Nano Omni**
    *   **Cost**: $0.50/1M (In) | $0.90/1M (Out)
    *   **Rationale**: Ultra-fast multimodal model for basic image/audio recognition tasks.
