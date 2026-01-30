# Dashboard Modular Implementation Guide

## Quick Start

### For Developers Adding New Dashboard Sections

1. **Create your component** in `components/dashboard/your-section.tsx`

   ```tsx
   "use client";

   export interface YourSectionProps {
     // Add your props here
     data: string;
     count: number;
   }

   export function YourSection({ data, count }: YourSectionProps) {
     return (
       <Card>
         <CardHeader>
           <CardTitle>Your Section</CardTitle>
         </CardHeader>
         <CardContent>{/* Your content */}</CardContent>
       </Card>
     );
   }
   ```

2. **Add to dashboard page** in `app/(dashboard)/page.tsx`

   ```tsx
   // 1. Import
   import { YourSection } from "@/components/dashboard/your-section";

   // 2. Fetch data in page component
   const yourData = await fetchYourData();

   // 3. Render with error boundary
   <DashboardErrorBoundary title="Your Section">
     <YourSection data={yourData.data} count={yourData.count} />
   </DashboardErrorBoundary>;
   ```

3. **That's it!** Your section is now resilient to errors.

## Error Boundary Rules

### ✓ DO:

- Wrap each dashboard section individually
- Pass only immutable data as props
- Keep components stateless when possible
- Use "use client" directive in client components
- Log errors to console for debugging

### ✗ DON'T:

- Nest error boundaries too deeply
- Pass mutable objects or functions as props
- Fetch data inside components wrapped in error boundaries
- Suppress console errors
- Return null from error boundary fallback

## Best Practices

### 1. Separate Data & Presentation

**Bad:**

```tsx
// Components fetching data inside error boundary
export function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchData().then(setData); // Error here crashes section
  }, []);

  return <div>{data}</div>;
}
```

**Good:**

```tsx
// Page fetches server-side
const data = await fetchData();

// Component renders only
export function Dashboard({ data }) {
  return <div>{data}</div>;
}
```

### 2. Type Safety

**Example:**

```tsx
// Always define prop interfaces
export interface StatusCardsProps {
  isAIActive: boolean;
  activePagesCount: number;
  connectedPagesCount: number;
  isEngineUp: boolean;
  lastMessageTimestamp: Date | null;
}

export function StatusCards(props: StatusCardsProps) {
  // TypeScript ensures props are correct
}
```

### 3. Null Handling

**Example:**

```tsx
// Components should handle null props gracefully
export function QuickActions({ setupComplete }: QuickActionsProps) {
  // Return early if not ready
  if (!setupComplete) {
    return null;
  }

  return <div>Quick actions here</div>;
}
```

### 4. Error Messages

**Example:**

```tsx
// Error boundary shows helpful messages
<DashboardErrorBoundary
  title="Facebook Integration"
  fallback={
    <Card className="border-destructive">
      <CardContent>
        <p>Unable to load Facebook pages. Please check your connection.</p>
      </CardContent>
    </Card>
  }
>
  <FacebookPages />
</DashboardErrorBoundary>
```

## Common Patterns

### Pattern 1: Optional Section

```tsx
// Only show if data exists
{
  connectedPages.length > 0 && (
    <DashboardErrorBoundary title="Pages Overview">
      <PagesOverview pages={connectedPages} />
    </DashboardErrorBoundary>
  );
}
```

### Pattern 2: Dependent Sections

```tsx
// Sections can depend on page-level state
<DashboardErrorBoundary title="Quick Actions">
  <QuickActions setupComplete={setupComplete} />
</DashboardErrorBoundary>
```

### Pattern 3: Loading State

```tsx
// Page-level loading before rendering sections
if (!user) {
  return <div>Loading...</div>;
}

// All sections now have guaranteed data
return (
  <div className="space-y-6">
    <DashboardErrorBoundary>
      <Section1 data={data1} />
    </DashboardErrorBoundary>
  </div>
);
```

## Debugging Errors

### Check Browser Console

```
[Dashboard Error] TypeError: Cannot read property 'x' of undefined
  at StatusCards (status-cards.tsx:45)
  at DashboardErrorBoundary (error-boundary.tsx:30)
```

### Use React DevTools

- Install React DevTools extension
- Open Components tab
- Look for `DashboardErrorBoundary` components
- Check their state to see which component errored

### Add Logging

```tsx
export function MyComponent(props: MyProps) {
  console.log("[MyComponent] Rendering with props:", props);

  return (
    <div>
      {props.items.map((item) => (
        <div key={item.id}>{item.name}</div>
      ))}
    </div>
  );
}
```

## Testing Components

### Unit Test Example

```tsx
import { render, screen } from "@testing-library/react";
import { StatusCards } from "@/components/dashboard/status-cards";

test("StatusCards renders AI status", () => {
  render(
    <StatusCards
      isAIActive={true}
      activePagesCount={1}
      connectedPagesCount={1}
      isEngineUp={true}
      lastMessageTimestamp={null}
    />,
  );

  expect(screen.getByText("Active")).toBeInTheDocument();
});
```

### Error Boundary Test

```tsx
test("ErrorBoundary shows error message", () => {
  const ThrowError = () => {
    throw new Error("Test error");
  };

  render(
    <DashboardErrorBoundary title="Test Section">
      <ThrowError />
    </DashboardErrorBoundary>,
  );

  expect(screen.getByText(/Error Loading Section/i)).toBeInTheDocument();
});
```

## Performance Optimization

### 1. Memoize Components

```tsx
import { memo } from "react";

export const StatusCards = memo(function StatusCards(props: StatusCardsProps) {
  return <div>...</div>;
});
```

### 2. Lazy Load Sections

```tsx
import dynamic from "next/dynamic";

const QuickActions = dynamic(
  () =>
    import("@/components/dashboard/quick-actions").then((mod) => ({
      default: mod.QuickActions,
    })),
  {
    loading: () => <div>Loading...</div>,
  },
);
```

### 3. Deduplicate Renders

```tsx
// Page level - fetch once
const data = await prisma.facebookPage.findMany();

// Pass to multiple sections
<Section1 pages={data} />
<Section2 pages={data} />
```

## Migration Guide (Adding Error Boundaries to Existing Sections)

### Step 1: Identify Sections

List all sections in your dashboard that could fail independently.

### Step 2: Extract to Components

Move section-specific JSX to `components/dashboard/section-name.tsx`

### Step 3: Add Boundary

```tsx
- {renderSection()}
+ <DashboardErrorBoundary title="Section Name">
+   <SectionName {...props} />
+ </DashboardErrorBoundary>
```

### Step 4: Test

- Manually throw errors in component
- Verify other sections still work
- Check console for error logs

## FAQ

**Q: What if the error boundary itself errors?**
A: Error boundaries catch errors in their children, not in themselves. If an error boundary has a rendering error, the page-level error boundary catches it.

**Q: Can I use error boundaries with async components?**
A: Error boundaries work with async components. Fetch data server-side and pass as props.

**Q: What if a prop change causes an error?**
A: Error boundary catches it. This is why immutable props are important.

**Q: Should I add error boundaries to every card?**
A: No. Group related cards into error boundary units. Too many boundaries = too much nesting.

**Q: Can users fix errors without reloading?**
A: Yes! Components re-render when props change. Data refetch in page component fixes it.

## Monitoring & Analytics

### Track Errors

```tsx
// In error boundary
componentDidCatch(error: Error) {
  console.error("[Dashboard Error]", error);

  // Send to analytics
  analytics.trackEvent("dashboard_error", {
    section: this.props.title,
    error: error.message
  });
}
```

### Dashboard Health Check

Monitor error frequency in admin panel to identify problematic sections.

## Summary

✅ **Benefits of Modular Dashboards:**

- Robust: Errors don't crash entire page
- Resilient: Navigation always available
- Debuggable: Errors isolated and logged
- Maintainable: Smaller components
- Testable: Independent units
- Performant: Isolated re-renders
