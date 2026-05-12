# AI Humanization Audit

## Persona Definition
The ReplyBase AI is configured as a **"Consultative Sales Concierge"**.

## Evaluation against "Robot" Checklist
- [x] **Avoids "As an AI model..." phrases**: System prompt enforces a business persona.
- [x] **Context Awareness**: Remembers the user's `business_type` and `monthly_volume` throughout the turn.
- [x] **Interpolation**: Uses `contact_name_prefix` to add a personal touch to greeting nodes.
- [x] **Non-Linearity**: Handles topic changes (Scenario B) without breaking the flow state.

## Interaction Design
- **Typing Delays**: 300ms - 1500ms based on message length (simulated).
- **Conciseness**: AI responses are capped at 800 tokens to ensure readable chat bubbles.
- **CTA Hygiene**: Only pushes sales links when relevant to the user's inquiry level (High/Research intent logic).

---
*Conversational Design Review.*
