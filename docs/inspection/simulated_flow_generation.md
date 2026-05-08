# Onboarding System — Simulated Flow Generation

This document validates the redesigned onboarding pipeline by simulating 5 different business types and showing the expected flow generation for each.

---

## 1. Sunrise Dental — Healthcare / Booking

**Onboarding Input:**
```json
{
  "business": {
    "name": "Dr. Sarah Chen",
    "company": "Sunrise Dental",
    "industry": "Healthcare & Wellness",
    "subIndustry": "Clinics/Dental",
    "website": "https://sunrisedental.co.uk",
    "businessModel": "B2C"
  },
  "offer": {
    "description": "Family dental practice offering general, cosmetic, and emergency dentistry",
    "targetCustomers": ["Local Consumers (B2C)", "Patients & Clients"],
    "mainProducts": "Check-ups, teeth whitening, veneers, Invisalign, emergency dental care"
  },
  "chatbotGoals": {
    "conversionGoal": "booking",
    "preferredCta": "booking_link",
    "botPersonality": "friendly",
    "escalationPreference": "phone"
  },
  "context": {
    "commonQuestions": "Do you accept NHS patients? How much is whitening? Can I get an emergency appointment today?"
  }
}
```

**Template Resolution:** `"Clinics/Dental"` → sub-industry override → `booking` template ✅

**Generated Tags:** `["booking-lead", "automatic-capture", "cta-booking_link"]`

**Closing Message:**
> "Thanks, {{lead_name}}! You can book a time that works for you, and we'll confirm right away. 📅
> For urgent matters, feel free to call us directly."

---

## 2. TechFlow — SaaS / Lead Capture

**Onboarding Input:**
```json
{
  "business": {
    "name": "Marcus Webb",
    "company": "TechFlow",
    "industry": "Software & Technology",
    "subIndustry": "SaaS",
    "website": "https://techflow.io",
    "businessModel": "B2B"
  },
  "offer": {
    "description": "AI-powered project management for dev teams with sprint planning and resource allocation",
    "targetCustomers": ["Small & Medium Businesses (B2B)", "Startups & Founders"],
    "mainProducts": "TechFlow Pro — Sprint AI, Resource Forecaster, Team Dashboard"
  },
  "chatbotGoals": {
    "conversionGoal": "lead_capture",
    "preferredCta": "email",
    "botPersonality": "professional",
    "escalationPreference": "email"
  },
  "context": {
    "commonQuestions": "Is there a free trial? How does Sprint AI work? Do you integrate with Jira?"
  }
}
```

**Template Resolution:** `"SaaS"` → sub-industry override → `saas` template ✅

**Generated Tags:** `["lead_capture-lead", "automatic-capture", "cta-email"]`

**Closing Message:**
> "Thanks, {{lead_name}}! We'll send you a detailed follow-up to your email. 📧
> I'll have our team follow up with you by email shortly."

---

## 3. GreenClean — Home Services / Lead Capture

**Onboarding Input:**
```json
{
  "business": {
    "name": "Amy Torres",
    "company": "GreenClean",
    "industry": "Home Services & Trades",
    "subIndustry": "Cleaning",
    "website": "",
    "businessModel": "B2C"
  },
  "offer": {
    "description": "Eco-friendly house and office cleaning with non-toxic products",
    "targetCustomers": ["Local Consumers (B2C)"],
    "mainProducts": "Deep cleaning, regular maintenance, move-in/out, office cleaning"
  },
  "chatbotGoals": {
    "conversionGoal": "lead_capture",
    "preferredCta": "call",
    "botPersonality": "friendly",
    "escalationPreference": "phone"
  },
  "context": {
    "commonQuestions": "What areas do you cover? How much per hour? Do you bring your own supplies?"
  }
}
```

**Template Resolution:** `"Cleaning"` → sub-industry override → `cleaning-services` template ✅

**Generated Tags:** `["lead_capture-lead", "automatic-capture", "cta-call"]`

**Closing Message:**
> "Thanks, {{lead_name}}! Our team will give you a call shortly to discuss further. 📞
> For urgent matters, feel free to call us directly."

---

## 4. Luxe Cuts — Beauty / Booking

**Onboarding Input:**
```json
{
  "business": {
    "name": "Isabella Moreno",
    "company": "Luxe Cuts",
    "industry": "Healthcare & Wellness",
    "subIndustry": "MedSpas & Salons",
    "website": "https://luxecuts.com",
    "businessModel": "B2C"
  },
  "offer": {
    "description": "Premium hair salon specializing in colour, styling, and hair treatments",
    "targetCustomers": ["Local Consumers (B2C)"],
    "mainProducts": "Precision cuts, balayage, keratin treatment, bridal styling, extensions"
  },
  "chatbotGoals": {
    "conversionGoal": "booking",
    "preferredCta": "whatsapp",
    "botPersonality": "luxury",
    "escalationPreference": "live_chat"
  },
  "context": {
    "commonQuestions": "Do you accept walk-ins? What's your cancellation policy? How long does balayage take?"
  }
}
```

**Template Resolution:** `"MedSpas & Salons"` → sub-industry override → `hair-salon` template ✅

**Generated Tags:** `["booking-lead", "automatic-capture", "cta-whatsapp"]`

**Closing Message:**
> "Thanks, {{lead_name}}! We'll reach out on WhatsApp to continue the conversation. 💬
> Let me connect you with a team member who can help."

---

## 5. PropFirst — Real Estate / Sales

**Onboarding Input:**
```json
{
  "business": {
    "name": "David Okafor",
    "company": "PropFirst",
    "industry": "Real Estate",
    "subIndustry": "Agencies",
    "website": "https://propfirst.co.uk",
    "businessModel": "B2C"
  },
  "offer": {
    "description": "Residential estate agency covering East London and Essex",
    "targetCustomers": ["Real Estate Buyers/Renters", "Local Consumers (B2C)"],
    "mainProducts": "Property sales, lettings, valuations, property management"
  },
  "chatbotGoals": {
    "conversionGoal": "sales",
    "preferredCta": "call",
    "botPersonality": "professional",
    "escalationPreference": "phone"
  },
  "context": {
    "commonQuestions": "How much is my property worth? Do you handle lettings? What's your commission rate?"
  }
}
```

**Template Resolution:** `"Real Estate"` → main industry match → `real-estate` template ✅

**Generated Tags:** `["sales-lead", "automatic-capture", "cta-call"]`

**Closing Message:**
> "Thanks, {{lead_name}}! Our team will give you a call shortly to discuss further. 📞
> For urgent matters, feel free to call us directly."

---

## Template Coverage Analysis

| Industry | Sub-Industry | Resolved Template | Coverage |
|---|---|---|---|
| Software & Technology | SaaS | `saas` | ✅ Direct |
| Software & Technology | IT Services | `services` | ✅ Override |
| Software & Technology | App Development | `agencies` | ✅ Override |
| E-commerce & Retail | All | `ecommerce` | ✅ Direct |
| Real Estate | All | `real-estate` | ✅ Direct |
| Healthcare & Wellness | Clinics/Dental | `booking` | ✅ Override |
| Healthcare & Wellness | Fitness/Gyms | `boutique-gym` | ✅ Override |
| Healthcare & Wellness | MedSpas & Salons | `hair-salon` | ✅ Override |
| Home Services & Trades | Cleaning | `cleaning-services` | ✅ Override |
| Home Services & Trades | Landscaping | `landscaping` | ✅ Override |
| Home Services & Trades | Plumbing/HVAC | `handyman` | ✅ Override |
| Travel & Hospitality | Hotels/Resorts | `hotel` | ✅ Override |
| Travel & Hospitality | Restaurants & Cafes | `restaurant` | ✅ Override |
| Marketing & Agency | All | `agencies` | ✅ Direct |
| Professional Services | All | `services` | ✅ Direct |
| Other | — | Goal-based fallback | ✅ Fallback |

> [!TIP]
> The old system only mapped **9 of 26 templates**. The new system maps **all 26** through industry + sub-industry overrides + goal-based fallback.
