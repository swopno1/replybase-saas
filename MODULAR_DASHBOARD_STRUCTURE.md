# Dashboard Architecture Diagram

## Page Structure (Always Visible)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Site Header                                 │
│                    (Navigation, User Profile)                       │
├─────────────────┬───────────────────────────────────────────────────┤
│                 │                                                   │
│   Sidebar       │                Main Content Area                  │
│   (Navigation)  │  ┌─────────────────────────────────────────────┐ │
│                 │  │ Header                                      │ │
│   ✓ Always      │  │ Welcome Message                            │ │
│     Visible     │  ├─────────────────────────────────────────────┤ │
│                 │  │ ┌─────────────────────────────────────────┐ │ │
│   Links:        │  │ │ Error Boundary #1: Setup CTA          │ │ │
│   • Dashboard   │  │ │ ┌─────────────────────────────────────┐ │ │ │
│   • Bots        │  │ │ │ SetupCTA Component                  │ │ │ │
│   • Contacts    │  │ │ │ (May show: Connect Facebook, etc)   │ │ │ │
│   • Leads       │  │ │ └─────────────────────────────────────┘ │ │ │
│   • Settings    │  │ └─────────────────────────────────────────┘ │ │
│   • Billing     │  │                                              │ │
│                 │  │ ┌─────────────────────────────────────────┐ │ │
│                 │  │ │ Error Boundary #2: Subscription        │ │ │
│                 │  │ │ ┌─────────────────────────────────────┐ │ │ │
│                 │  │ │ │ SubscriptionStatus Component        │ │ │ │
│                 │  │ │ └─────────────────────────────────────┘ │ │ │
│                 │  │ └─────────────────────────────────────────┘ │ │
│                 │  │                                              │ │
│                 │  │ ┌─────────────────────────────────────────┐ │ │
│                 │  │ │ Error Boundary #3: Status Cards        │ │ │
│                 │  │ │ ┌─────────────────────────────────────┐ │ │ │
│                 │  │ │ │ StatusCards Component               │ │ │ │
│                 │  │ │ │ • AI Status                         │ │ │ │
│                 │  │ │ │ • Facebook Pages                    │ │ │ │
│                 │  │ │ │ • Engine Status                     │ │ │ │
│                 │  │ │ │ • Last Message                      │ │ │ │
│                 │  │ │ └─────────────────────────────────────┘ │ │ │
│                 │  │ └─────────────────────────────────────────┘ │ │
│                 │  │                                              │ │
│                 │  │ ┌─────────────────────────────────────────┐ │ │
│                 │  │ │ Error Boundary #4: Quick Actions       │ │ │
│                 │  │ │ ┌─────────────────────────────────────┐ │ │ │
│                 │  │ │ │ QuickActions Component              │ │ │ │
│                 │  │ │ │ • Manage Facebook Pages             │ │ │ │
│                 │  │ │ │ • Configure AI Status               │ │ │ │
│                 │  │ │ │ • View Activity Logs                │ │ │ │
│                 │  │ │ └─────────────────────────────────────┘ │ │ │
│                 │  │ └─────────────────────────────────────────┘ │ │
│                 │  └─────────────────────────────────────────────┘ │
│                 │                                                   │
└─────────────────┴───────────────────────────────────────────────────┘
```

## Error Scenario

```
Normal State:
┌─────────────────────────────────────────────┐
│ Error Boundary #1: Setup CTA                │
│ └─ SetupCTA Component ✓                     │
├─────────────────────────────────────────────┤
│ Error Boundary #2: Subscription             │
│ └─ SubscriptionStatus Component ✗ ERROR    │
│    → Shows graceful error card              │
├─────────────────────────────────────────────┤
│ Error Boundary #3: Status Cards             │
│ └─ StatusCards Component ✓                  │
├─────────────────────────────────────────────┤
│ Error Boundary #4: Quick Actions            │
│ └─ QuickActions Component ✓                 │
└─────────────────────────────────────────────┘

Sidebar: ✓ ALWAYS VISIBLE
Header:  ✓ ALWAYS VISIBLE
User can navigate to other pages
```

## Component Error vs Page Error

### Before Modularization ❌

```
Error in StatusCards Component
        ↓
Component throws error
        ↓
Entire Page Error Boundary catches it
        ↓
Blank page shown
        ↓
User navigates away or refreshes
```

### After Modularization ✓

```
Error in StatusCards Component
        ↓
Error Boundary #3 catches it
        ↓
Shows error card: "Error Loading Section"
        ↓
Other sections still work
        ↓
Sidebar/Header visible
        ↓
User can navigate to other pages
```

## Component Dependencies

```
DashboardPage (Server)
  │
  ├─→ [Data Fetching]
  │   ├─ getServerSession()
  │   ├─ prisma.user.findUnique()
  │   ├─ prisma.facebookPage.findMany()
  │   ├─ prisma.crmMessage.findFirst()
  │   └─ prisma.account.findFirst()
  │
  └─→ [Error Boundaries]
      │
      ├─ ErrorBoundary → SetupCTA (Client)
      │                  └─ UI only, no data fetches
      │
      ├─ ErrorBoundary → SubscriptionStatus (Client)
      │                  └─ Uses session/user data
      │
      ├─ ErrorBoundary → StatusCards (Client)
      │                  └─ Pure props, no side effects
      │
      └─ ErrorBoundary → QuickActions (Client)
                         └─ Uses setupComplete prop
```

## Data Flow

```
Server Component (page.tsx)
         ↓
    Fetch Data
         ↓
  Build State Objects
         ↓
    Pass to Components
         ↓
    ┌────────────────────────────────┐
    │  Render with Error Boundaries  │
    ├────────────────────────────────┤
    │ ErrorBoundary                  │
    │   └─ Client Component          │
    │       ├─ Receives immutable    │
    │       │  props                 │
    │       └─ Renders or throws     │
    │                                │
    │ [Error caught here]            │
    │ [Other sections unaffected]    │
    └────────────────────────────────┘
```

## Performance Benefits

```
Without Error Boundaries:
├─ One error = entire page re-renders
├─ User loses all dashboard context
├─ Forces page reload
└─ Bad UX

With Error Boundaries:
├─ One error = only that section re-renders
├─ Other sections continue to work
├─ User keeps dashboard context
├─ Graceful degradation
└─ Better UX
```

## Testing Scenarios

### Scenario 1: Status Cards Error

```
1. User loads dashboard
2. All sections render correctly
3. Data updates trigger error in StatusCards
4. Error caught by Error Boundary #3
5. Shows: "Error Loading Status Overview"
6. User can still:
   ✓ See SetupCTA
   ✓ See Subscription Status
   ✓ See Quick Actions
   ✓ Click sidebar links
   ✓ Navigate to other pages
```

### Scenario 2: Multiple Errors

```
1. SetupCTA and StatusCards both error
2. Error Boundary #1 catches SetupCTA error
3. Error Boundary #3 catches StatusCards error
4. Shows 2 error cards
5. SubscriptionStatus and QuickActions work fine
6. User navigates away and comeback
```

### Scenario 3: Data Fetch Error

```
1. Page data fetch fails (e.g., DB down)
2. Page component catches it
3. Page returns error state
4. Sidebar/Header still visible
5. User can navigate to other pages
```
