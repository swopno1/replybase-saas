# Modular Dashboard Architecture

## Overview

The ReplyBase SaaS dashboard has been refactored into a modular, resilient design where individual component failures don't crash the entire page. The navigation sidebar remains visible at all times, even when errors occur in the main content area.

## Architecture

### Core Layout

- **Location**: [app/(dashboard)/layout.tsx](<app/(dashboard)/layout.tsx>)
- The sidebar (`AppSidebar`) and header (`SiteHeader`) are at the layout level
- They remain visible regardless of errors in child pages
- Main content is wrapped in a flex container with proper spacing

### Main Dashboard Page

- **Location**: [app/(dashboard)/page.tsx](<app/(dashboard)/page.tsx>)
- Fetches all data server-side (session, user, database queries)
- Passes immutable data props to modular client components
- Each section is wrapped in `DashboardErrorBoundary` for isolated error handling

## Modular Components

### 1. Error Boundary Component

**File**: [components/dashboard/error-boundary.tsx](components/dashboard/error-boundary.tsx)

```tsx
<DashboardErrorBoundary title="Section Name">
  <SomeComponent />
</DashboardErrorBoundary>
```

**Features**:

- React Error Boundary pattern implementation
- Catches rendering errors in child components
- Displays graceful error card instead of crashing entire page
- Shows error message and logs to console for debugging
- Custom fallback UI possible via `fallback` prop

**Benefits**:

- Each dashboard section fails independently
- Users can continue navigating other sections
- Sidebar/header always accessible

### 2. Setup CTA Component

**File**: [components/dashboard/setup-cta.tsx](components/dashboard/setup-cta.tsx)

**Props**:

```tsx
interface SetupCTAProps {
  needsFacebookConnection: boolean;
  needsPageConnection: boolean;
  needsAIActivation: boolean;
}
```

**Responsibility**: Display setup guidance card based on configuration state

### 3. Status Cards Component

**File**: [components/dashboard/status-cards.tsx](components/dashboard/status-cards.tsx)

**Props**:

```tsx
interface StatusCardsProps {
  isAIActive: boolean;
  activePagesCount: number;
  connectedPagesCount: number;
  isEngineUp: boolean;
  lastMessageTimestamp: Date | null;
}
```

**Displays**:

- AI Status card
- Facebook Pages card
- Engine Status card
- Last Message timestamp card

### 4. Quick Actions Component

**File**: [components/dashboard/quick-actions.tsx](components/dashboard/quick-actions.tsx)

**Props**:

```tsx
interface QuickActionsProps {
  setupComplete: boolean;
}
```

**Responsibility**: Show navigation buttons to key pages when setup is complete

## Error Handling Strategy

### When Errors Occur

1. **Error in Status Cards** → Only that section shows error card, other sections work
2. **Error in Quick Actions** → Users can still see status and navigate
3. **Error in Subscription Status** → Can view other dashboard metrics
4. **Critical Page Error** → Sidebar/header still visible for navigation

### Example: Component Error

```tsx
// This error is caught and isolated
<DashboardErrorBoundary title="Status Overview">
  <StatusCards {...props} /> {/* Error here doesn't affect other sections */}
</DashboardErrorBoundary>
```

## Data Flow

```
Page (Server Component)
  ├─ Fetch Session
  ├─ Fetch User & Tenant
  ├─ Fetch Connected Pages
  ├─ Fetch Last Message
  ├─ Determine Setup Status
  │
  └─ Render Layout with Error Boundaries
      ├─ Header (always visible)
      ├─ Sidebar (always visible)
      ├─ Content Area
      │   ├─ DashboardErrorBoundary
      │   │   └─ SetupCTA (client component)
      │   ├─ DashboardErrorBoundary
      │   │   └─ SubscriptionStatus (client component)
      │   ├─ DashboardErrorBoundary
      │   │   └─ StatusCards (client component)
      │   └─ DashboardErrorBoundary
      │       └─ QuickActions (client component)
```

## Benefits

| Aspect              | Benefit                                                        |
| ------------------- | -------------------------------------------------------------- |
| **Resilience**      | One component error doesn't crash entire dashboard             |
| **User Experience** | Users stay logged in and can navigate even with errors         |
| **Debugging**       | Errors logged to console with component context                |
| **Maintainability** | Smaller, focused components are easier to update               |
| **Testing**         | Components can be tested independently                         |
| **Performance**     | Error boundaries prevent re-render cascades                    |
| **Accessibility**   | Navigation always available for users with accessibility needs |

## Adding New Dashboard Sections

To add a new section to the dashboard:

1. **Create Component**: `components/dashboard/new-section.tsx`

   ```tsx
   "use client";

   export function NewSection(props: Props) {
     return <div>Section content</div>;
   }
   ```

2. **Add to Main Page**: `app/(dashboard)/page.tsx`

   ```tsx
   <DashboardErrorBoundary title="New Section">
     <NewSection {...props} />
   </DashboardErrorBoundary>
   ```

3. **Pass Data from Page**: Fetch needed data server-side and pass as props

## Deployment & Testing

The modular dashboard was tested in production build:

- ✅ Build: Successful
- ✅ Routes: 46+ endpoints
- ✅ TypeScript: No errors
- ✅ Error Boundaries: Active for all major sections

## Future Improvements

- Add analytics tracking for errors
- Implement retry logic for failed data fetches
- Add section-level loading states
- Create error reporting dashboard in admin panel
- Add telemetry for error patterns
