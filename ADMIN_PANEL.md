# Admin Panel - Secure Access Documentation

## Access Control

**URL:** `https://app.replybase.co.uk/admin`

**Authentication:** Hardcoded email access only

- **Authorized Email:** `amirhossain.limon@gmail.com`
- **Security:** Email is hardcoded in server-side layout (cannot be changed via environment variables)
- **Not Exposed:** No links in navigation or public pages

## Features

### 1. Business Status Dashboard (`/admin`)

**Location:** Main admin page

**Displays:**

- Total Users
- Total Tenants
- Active Subscriptions
- Monthly Revenue (MRR)
- Total Bots
- Total Contacts
- Total Conversations
- Recent Subscriptions (last 10)

### 2. Subscriber Management (`/admin/subscribers`)

**Location:** `/admin/subscribers`

**Features:**

- View all subscriptions in table format
- Search by customer name or email
- Filter by status (all, active, trialing, canceled, incomplete)
- Edit subscription details:
  - Change plan
  - Update status
  - Modify expiration date
- Delete subscriptions
- View current period end dates
- See cancellation flags

**Table Columns:**

- Customer Name
- Email
- Plan
- Price
- Status (color-coded badges)
- Current Period End
- Actions (Edit/Delete)

### 3. Tab Navigation

Clean tab-style navigation at the top:

- Business Status
- Subscribers

## Security Features

1. **Server-Side Authentication Check**
   - Runs on every page load
   - Redirects unauthorized users to homepage
   - No client-side bypasses possible

2. **Hardcoded Admin Email**
   - Located in: `app/admin/layout.tsx`
   - Cannot be changed via .env
   - Must modify source code to change

3. **API Protection**
   - All admin APIs check email on each request
   - Return 403 Forbidden for non-admin users
   - No data leakage

## API Endpoints (Protected)

### GET `/api/admin/subscribers`

Returns all subscriptions with tenant and user details

### PATCH `/api/admin/subscribers/[id]`

Update subscription details (plan, status, dates)

### DELETE `/api/admin/subscribers/[id]`

Delete a subscription

### GET `/api/admin/plans`

Get all available plans for dropdown selection

## Files Created

```
app/admin/
├── layout.tsx              # Authentication & layout
├── page.tsx                # Business status dashboard
└── subscribers/
    └── page.tsx            # Subscriber management

components/
├── admin-nav.tsx           # Tab navigation component
├── edit-subscriber-dialog.tsx  # Edit modal
└── ui/
    └── dialog.tsx          # Dialog UI component

app/api/admin/
├── subscribers/
│   ├── route.ts           # GET all subscribers
│   └── [id]/
│       └── route.ts       # PATCH/DELETE subscriber
└── plans/
    └── route.ts           # GET all plans
```

## Usage

1. **Login** as `amirhossain.limon@gmail.com`
2. **Navigate** to `https://app.replybase.co.uk/admin` (type URL directly)
3. **View Stats** on main page
4. **Click "Subscribers"** tab to manage subscriptions
5. **Search/Filter** to find specific customers
6. **Edit** by clicking pencil icon
7. **Delete** by clicking trash icon (with confirmation)

## Important Notes

⚠️ **Security Reminders:**

- Never share the admin URL publicly
- Admin email is hardcoded for security
- All API calls verify admin email server-side
- No client-side-only protection

✅ **What's Protected:**

- Route is not linked anywhere in the app
- Requires exact email match to access
- All database operations are authenticated
- Redirects non-admin users immediately

🎯 **Best Practices:**

- Always confirm before deleting subscriptions
- Check Stripe before making manual changes
- Use filters to find specific customers quickly
- Review business stats regularly
