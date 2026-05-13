# Codebase Audit: Dependencies & Bundle Size

## 1. Unused Dependencies (SAFE TO REMOVE)
- **`@tabler/icons-react`**: Primarily imported in unused components (`nav-main.tsx`, `nav-secondary.tsx`, `section-cards.tsx`). The application primarily uses `lucide-react` (83 references).
- **`tw-animate-css`**: No direct usage found in the source files. Standard Tailwind animations and `framer-motion` (if any) or built-in CSS transitions are preferred.

## 2. Heavy Bundle Risks
- **`recharts`**: Used in 17 places. Ensure these are only imported in client components that actually render charts to avoid bloating the initial page load.
- **`@dnd-kit/*`**: Used for the Flow Builder. This is a heavy set of libraries. Ensure they are dynamically imported if the Flow Builder is a specific sub-route.
- **`lucide-react`**: Large icon library. Ensure the build pipeline is correctly tree-shaking these icons.

## 3. Library Duplication
- **Icons**: Mixing `lucide-react` and `@tabler/icons-react`. Recommendation is to stick to one (Lucide is the dominant choice in this project).

## 4. Package Maintenance
- **Prisma**: All packages are pinned to `7.8.0`. This is good for consistency.
- **Next.js**: Using version `16.2.4`.

## 5. Recommendations
- **Uninstall Unused Packages**: Remove `@tabler/icons-react` and `tw-animate-css`.
- **Dynamic Imports**: Use `next/dynamic` for heavy components like charts (`recharts`) and the flow builder (`@dnd-kit`) to keep the main bundle small.
- **Audit Tailwind CSS**: The project uses Tailwind 4 (`@tailwindcss/postcss`). Ensure the build process is optimized for the new engine.
