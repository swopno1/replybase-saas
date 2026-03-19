# Bot vs Flow Guide (Current Model)

Last updated: 2026-03-19

## 1. Canonical Model

In ReplyBase, Bot and Flow are different layers:

- Bot: routing container and ownership boundary for channels.
- Channel: integration endpoint attached to a bot (web, facebook, telegram).
- Flow: deterministic conversation logic (nodes and transitions).
- AI engine: generative response layer used when policy requires AI.

## 2. Practical Difference

Use Bot when you need to decide ownership, channel mapping, and runtime policy.
Use Flow when you need predictable, scripted, multi-step behavior.
Use AI when open-ended responses are needed.

## 3. Runtime Behavior by Channel (Current)

- Facebook: flow-first path exists, then onboarding or AI/default flow paths.
- Telegram: command handling and AI path are active; flow assignment parity is pending.
- Webchat: flow-first using bot entryFlow, then AI fallback.

This is why we are standardizing runtime policy and flow assignment across channels.

## 4. Recommended Operator Decision Tree

1. Need deterministic script or qualification steps?

- Choose Flow-first mode.

2. Need open-ended responses for diverse questions?

- Choose AI mode with guardrails.

3. Need reliability with safe fallback?

- Choose Flow then AI fallback.

## 5. Product Direction (Aligned with Product_Details)

- P0: unify runtime policy visibility and terminology.
- P1: make flow assignment channel-agnostic.
- P1: split system health from runtime behavior settings.
- P2: only then expand to TikTok staged rollout.

See:

- [../Product_Details/Overview.md](../Product_Details/Overview.md)
- [../Product_Details/todo/P0_Product_Clarity_and_Runtime_Model.md](../Product_Details/todo/P0_Product_Clarity_and_Runtime_Model.md)
- [../Product_Details/todo/P1_Channel_Parity_and_Flow_Assignment.md](../Product_Details/todo/P1_Channel_Parity_and_Flow_Assignment.md)

**Your Flow system works independently of Bots.**

- Clicking "Get Started" triggers Flow immediately ✅
- Bot is optional for AI features and external builder
- You can use Flows without ever creating a Bot
- Bot creation enables Typebot integration later

**The fix I applied**: Moved Flow execution BEFORE AI engine check, so flows work regardless of bot/AI status.

---

**Need help?** Check the specific troubleshooting section above for your issue.
