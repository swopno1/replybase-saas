# Pricing UI/UX Audit

This audit evaluates the visual hierarchy, user journey, and conversion optimization of the pricing screens inside the ReplyBase dashboard and the marketing landing page.

---

## 1. Visual Hierarchy & Card Grid
The pricing layout is structured as a **5-tier responsive grid**:
- **Free**: Left-most card. Subtle borders, basic CTA. Designed to encourage self-onboarding.
- **Launch**: Standard paid card. Ideal for early validation.
- **Grow**: Featured plan (**"Most Popular"**). Highlights a primary background accent, prominent shadow, and default colored button. Draws attention immediately as the optimal choice.
- **Scale**: Highlighted as **"Best for Teams"**. Promoted for API/multichannel users.
- **Business**: Custom CTA and Enterprise support indicators.

---

## 2. Onboarding Conversion Flow
We map conversion triggers across two distinct frontends:
1. **Marketing Landing Page (`replybase-frontend`)**:
   - Each card redirects to the app registration page with a target plan intent parameter:
     - Launch: `https://app.replybase.co.uk/auth/register?plan=launch`
     - Grow: `https://app.replybase.co.uk/auth/register?plan=grow`
   - This registers the user's plan choice and passes it directly to the signup form.
2. **Dashboard Pricing Page (`replybase-development`)**:
   - Opens a custom **Plan Summary** modal summarizing billing cycle, monthly/annual fee, and 14-day free trial details.
   - Redirects to a secure Stripe Checkout page with pre-populated customer info, ensuring minimum checkout friction.

---

## 3. Mobile Responsiveness & Layout
- **Desktop (>= 1024px)**: 5-column grid layout where comparative prices and checklists align horizontally, allowing rapid scanning.
- **Tablet (768px - 1023px)**: Reflows to a multi-column wrap (e.g. 3-column + 2-column or grid rows) to prevent text clipping.
- **Mobile (< 768px)**: Stacks vertically. The Featured plans (Grow and Scale) include special top borders to keep their emphasis visible. The detailed comparison table is automatically hidden on mobile screens, replaced by the clean checklists inside each card.
