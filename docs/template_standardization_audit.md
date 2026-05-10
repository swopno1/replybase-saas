# Template Standardization Audit — V6 Compliance

## V6 Standard (from `ReplyBase_Flow.md`)

The standard demands:
1. **Hierarchical cost-control**: `quick_replies` first (Layer 1, $0), AI only for complex fallback
2. **Confidence-based extraction**: Data confirmed before CRM save
3. **Intent-weighted pressure**: Don't annoy low-intent users; CTA only every 3rd turn for researchers
4. **Hard escalation boundaries**: Human handoff for angry/complex
5. **Recovery & abandonment**: Nudge after 45s silence

## Core Marketing Position

> "Never Miss Another Lead — Reply instantly to every enquiry and turn more messages into paying customers—all in one simple platform."

**Translation for templates**: Every template must capture at minimum **name + contact method** (phone or email) before `end_flow`, and do so *conversationally* — not as an interrogation form.

---

## The Golden Pattern (Every Template Must Follow)

```
Node 0: Welcome message (warm, brief, industry-specific)
Node 1: Intent detection (quick_replies + open text fallback)
Node 2: Condition router (branch by intent)
  → Branch A: Value-first response + lead capture
  → Branch B: Value-first response + lead capture
  → Default: Soft catch-all with lead capture
Final: tag_user → update_status → end_flow
```

### Lead Capture Rules
- **Never ask for contact details first** — give value first
- **Always explain WHY you need their info** — "so we can send your quote"
- **Collect name → then ONE contact method** — phone OR email, not both
- **End with a clear next-step promise** — "we'll text you within the hour"

---

## Critical Deficiencies Found

| Issue | Templates Affected | Impact |
|---|---|---|
| Missing `tag_user` action | Barbershop, several partial JSONs | No CRM enrichment |
| Missing `update_status` action | Barbershop, Yoga, several JSONs | Lead not marked qualified |
| Linear interrogation (no branching) | ALL non-Real Estate/eCommerce templates | Feels like a form, not a conversation |
| No condition router after quick_replies | Gym, PT, Salon, Barber, Spa, Nail, Cleaning, Landscape, Handyman, Pet, Care | quick_replies are cosmetic only — no branching logic |
| Asks for BOTH phone AND email | Several templates | Over-collection annoys leads |
| No clear value exchange before contact ask | Most templates | "Why should I give you my number?" |
| JSON templates incomplete (missing full nodes) | Landscaping, Yoga, Nail, Handyman, Care, PT | Can't deploy as-is |

---

## Action Plan

1. **Rewrite every template in `flow-templates.ts`** to follow the Golden Pattern
2. **Regenerate ALL 27 JSON files** from the finalized TypeScript source
3. **Ensure every template has**: welcome → quick_reply intent → condition branch → value-first → lead capture → tag → status → end
4. **Remove the OMNICHANNEL_DEMO and BOOKING_ESCALATION** from the registry (these are ReplyBase-specific sub-flows, not tenant templates)
5. **Add missing OMNICHANNEL_DEMO and BOOKING_ESCALATION to registry** as they serve the Universal category
