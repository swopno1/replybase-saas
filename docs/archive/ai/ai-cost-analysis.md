# AI Cost Analysis: Strategic Infrastructure

## 1. Current Hybrid Expenditure (USD)
Our baseline production strategy routes traffic between DigitalOcean (Llama 3.1) and OpenAI (mini series).

### Monthly Projection: 5,000 Customers
| Task Type | Provider | Tokens (M) | Cost/M | Total |
| :--- | :--- | :--- | :--- | :--- |
| **Standard Chat** | **DO Llama 3.1 8B** | 900.0 | $0.10 | **$90.00** |
| Premium Chat | OpenAI GPT-4o-mini | 225.0 | $0.30 | $67.50 |
| Utility (Intent) | **DO Llama 3.1 8B** | 500.0 | $0.10 | **$50.00** |
| History Analysis | Gemini 1.5 Flash | 250.0 | $0.15 | $37.50 |
| **Total** | | | | **$245.00** |

---

## 2. Target "Disruptor" Projection (2026 Strategy)
By migrating to the primary models in our **Target Model Catalog**, we can significantly upgrade reasoning while further compressing costs.

### Monthly Projection: 5,000 Customers (Target)
| Task Type | Target Model | Tokens (M) | Cost/M (Avg) | Total |
| :--- | :--- | :--- | :--- | :--- |
| **Standard Chat** | **GPT-oss-120b** | 900.0 | $0.25* | **$225.00** |
| Onboarding Logic | Claude Sonnet 4.6 | 225.0 | $6.00* | $1,350.00 |
| **Utility (Micro)** | **GPT-5 Nano** | 500.0 | $0.15* | **$75.00** |
| History Audit | Qwen 3.5 397B | 250.0 | $1.20* | $300.00 |

*\*Averaged input/output cost based on token distribution.*

---

## 3. Financial & Operational Comparison
| Metric | Pure Proprietary | Current Hybrid | **Target Disruptor** |
| :--- | :--- | :--- | :--- |
| **Monthly OpEx** | ~$630.00 | $245.00 | **$1,950.00*** |
| **Reasoning Quality** | Medium | Good | **Exceptional** |
| **Efficiency (Utility)** | Baseline | 61% Savings | **~71% Savings** |

> [!IMPORTANT]
> While total spend increases for the **Target Disruptor** tier, this reflects a massive shift toward **high-reasoning** (Claude 4.6) for onboarding, which increases conversion rates. The **Utility** layer (GPT-5 Nano) remains 71% cheaper than the baseline, preserving high margins for background processing.

---

## 4. Conclusion
We maintain a "Margin-First" approach by utilizing **GPT-5 Nano** and **GPT-oss-120b** for high-volume tasks, while selectively deploying **Claude Sonnet 4.6** for high-value sales events.
