# Accessibility Audit

## Current Status
- **Semantic HTML**: Strong use of Radix-based components ensures accessible roles and attributes.
- **Keyboard Navigation**: Supported via shadcn/ui (tabs, buttons, select menus).
- **Aria Labels**: Generally good; needs specific audit for the custom Webchat widget.

## Identified Gaps
- **Color Contrast**: Some muted-foreground text on light backgrounds may fall below WCAG AA standards.
- **Alt Text**: Ensure all icons and avatars have appropriate descriptive labels or are marked as decorative.
- **Focus Indicators**: Standard focus rings are present; ensure they are high-contrast in all themes.
