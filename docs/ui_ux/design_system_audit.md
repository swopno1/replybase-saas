# Design System Audit - ReplyBase SaaS (August 2026)

## 1. Visual Coherence
- **Standards**: shadcn/ui + Tailwind CSS.
- **Typography**: Geist Sans is used consistently across all modules.
- **Color**: Palette is restricted and purposeful. Secondary colors (Amber/Green) are reserved for system feedback.

## 2. Iconography
- **Library**: Lucide React.
- **Identified Issue**: Inconsistent stroke weights. Newer components use default Lucide weights (2px), while some older ones have custom overrides.
- **Action**: Standardize all icons to default weight for design coherence (Task UX-002).

## 3. Component Reusability
- **Inventory**:
    - `DataTable`: Highly reusable, used in 8+ views.
    - `ActionableCards`: Consistent but need interaction upgrades.
    - `StatusCards`: Standardized across dashboard and admin.
- **Missing**: A standardized `ActionableEmptyState` component. Many tables still use generic "No results" text (Task UX-001).

## 4. Design System Roadmap
1. **Icon Audit**: Global search-and-replace for `strokeWidth` overrides.
2. **Empty State Library**: Implement `EmptyState` with Title, Icon, and primary CTA.
3. **Skeleton Primitives**: Standardize skeleton loaders for all "Detail" view types.
