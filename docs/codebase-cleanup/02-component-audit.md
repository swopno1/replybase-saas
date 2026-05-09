# Codebase Audit: Component & UI Usage

## 1. Client vs. Server Component Distribution
- **Total Components:** 94
- **Client Components (`use client`):** 76 (81%)
- **Server Components:** 18 (19%)

**Observation:** High concentration of client components. Some components like `Logo`, `site-header`, and `badge` are correctly server components. Others in `/components/ui` could potentially be converted to server components if they don't use state or effects, though Radix-based components often require client-side logic.

## 2. Unused UI Components (SAFE TO DELETE)
The following components are not imported anywhere in the application:

- `components/nav-secondary.tsx`
- `components/create-bot-form.tsx`
- `components/nav-main.tsx`
- `components/section-cards.tsx`
- `components/LandingFooter.tsx`
- `components/nav-documents.tsx`
- `components/ai-toggle.tsx`
- `components/admin-nav.tsx`
- `components/ui/breadcrumb.tsx`
- `components/ui/drawer.tsx`
- `components/edit-subscriber-dialog.tsx`
- `components/trial-badge.tsx`
- `components/LandingNavbar.tsx`
- `components/chart-area-interactive.tsx`

## 3. Redundancy & Duplication
- **Facebook Integration UI**: There is some overlap between `components/channels/facebook-config.tsx` and potential legacy routes in `app/api/integrations/facebook`.
- **Navigation**: `components/nav-main.tsx` and `components/nav-secondary.tsx` appear to be leftovers from a previous sidebar iteration (possibly before ShadCN Sidebar was fully adopted).

## 4. Architectural Clutter
- **ShadCN Bloat**: Many UI primitives are present (`breadcrumb`, `drawer`, etc.) but never used. These add to the build time and maintenance surface without providing value.

## 5. Recommendations
- **Purge Unused Primitives**: Remove the UI components listed in section 2.
- **Audit Client Components**: Review the 76 client components to see if any can be demoted to server components to reduce the client-side bundle.
- **Consolidate Admin Components**: Many admin components are deeply nested and only used once in the admin dashboard. Consider if they can be simplified.
