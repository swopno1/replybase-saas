# 🚀 Flow Builder - Quick Migration Checklist

Use this checklist to deploy the Flow Builder to production.

---

## ✅ Pre-Deployment Checklist

### 1. Database Preparation

- [ ] PostgreSQL database is accessible
- [ ] Database URL is set in `.env` file
- [ ] Database has sufficient storage space
- [ ] Backup current database (recommended)

### 2. Code Preparation

- [ ] All new files are committed to version control
- [ ] No uncommitted changes in working directory
- [ ] `.env` file has all required variables

---

## 📋 Deployment Steps

### Step 1: Generate Prisma Client

```bash
cd replybase-saas
npx prisma generate
```

**Expected Output**: "✔ Generated Prisma Client"

---

### Step 2: Create Migration

```bash
npx prisma migrate dev --name add_flow_builder_models
```

**If migration fails** (database not accessible):

```bash
# For production, use migrate deploy instead
npx prisma migrate deploy
```

**Expected Result**:

- [ ] Migration file created in `prisma/migrations/`
- [ ] Tables created: `flows`, `flow_nodes`, `flow_assignments`, `flow_sessions`
- [ ] Columns added to existing tables

---

### Step 3: Verify Database Schema

```sql
-- Run these queries to verify
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'flow%';

-- Should show:
-- flows
-- flow_nodes
-- flow_assignments
-- flow_sessions
```

**Verification**:

- [ ] `flows` table exists
- [ ] `flow_nodes` table exists
- [ ] `flow_assignments` table exists
- [ ] `flow_sessions` table exists
- [ ] `plans.maxFlows` column exists
- [ ] `leads.flowId` column exists
- [ ] `leads.pageId` column exists
- [ ] `leads.tags` column exists

---

### Step 4: Update Plan Limits

```sql
UPDATE plans SET "maxFlows" = 3 WHERE name IN ('free', 'starter');
UPDATE plans SET "maxFlows" = 10 WHERE name = 'standard';
UPDATE plans SET "maxFlows" = 999999 WHERE name = 'premium';

-- Verify
SELECT name, "maxFlows" FROM plans ORDER BY "maxFlows";
```

**Verification**:

- [ ] Free/Starter plans have `maxFlows = 3`
- [ ] Standard plan has `maxFlows = 10`
- [ ] Premium plan has `maxFlows = 999999`

---

### Step 5: (Optional) Seed Global Flows

**Skip this if you want to create global flows manually via UI**

```bash
# 1. Get a tenant ID for system/admin
psql $DATABASE_URL -c "SELECT id, name FROM tenants LIMIT 5;"

# 2. Edit seed file
nano prisma/seed-flows.sql
# Replace 'YOUR_TENANT_ID_HERE' with actual tenant ID

# 3. Run seed script
psql $DATABASE_URL -f prisma/seed-flows.sql
```

**Verification**:

```sql
SELECT COUNT(*) FROM flows WHERE "isGlobal" = true;
-- Should return 5 (if you seeded all templates)
```

- [ ] Global flows created (or decided to skip)

---

### Step 6: Build Application

```bash
pnpm install  # Install any missing dependencies
pnpm build    # Build for production
```

**Expected Output**: "✓ Compiled successfully"

**If build fails**:

- Run `npx prisma generate` again
- Check for TypeScript errors (should be minimal)
- Ensure all dependencies are installed

**Verification**:

- [ ] Build completes without errors
- [ ] `.next` folder is created
- [ ] No critical TypeScript errors

---

### Step 7: Run Application Locally (Test)

```bash
pnpm start
# Or for development
pnpm dev
```

**Test Checklist**:

- [ ] Visit `http://localhost:3000/flows`
- [ ] Can see "Flow Builder" page
- [ ] Can click "Create Flow" button
- [ ] No console errors
- [ ] UI loads correctly

---

### Step 8: Deploy to Production

**Choose your deployment method:**

#### Option A: Vercel

```bash
vercel --prod
```

#### Option B: Docker

```bash
docker build -t replybase-saas .
docker run -p 3000:3000 replybase-saas
```

#### Option C: PM2 (Node.js)

```bash
pm2 start npm --name "replybase" -- start
pm2 save
pm2 startup  # Enable auto-restart
```

**Verification**:

- [ ] Application is running on production URL
- [ ] Can access `/flows` page
- [ ] No 500 errors

---

### Step 9: Post-Deployment Verification

#### 9.1 UI Tests

- [ ] Navigate to `https://app.replybase.co.uk/flows`
- [ ] See empty state or existing flows
- [ ] Click "Create Flow" - dialog opens
- [ ] Create a test flow
- [ ] Flow appears in "My Flows" tab
- [ ] Can edit flow
- [ ] Can add nodes
- [ ] Can save flow
- [ ] Can delete flow

#### 9.2 API Tests

```bash
# Test flows API (replace with actual auth token)
curl -i https://app.replybase.co.uk/api/flows \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN"

# Should return 200 OK with flows array
```

#### 9.3 Database Tests

```sql
-- Check if flow was created
SELECT * FROM flows ORDER BY "createdAt" DESC LIMIT 1;

-- Check if nodes were created
SELECT * FROM flow_nodes WHERE "flowId" = 'YOUR_FLOW_ID';
```

---

### Step 10: Facebook Integration Test

#### 10.1 Assign Flow to Page

- [ ] Go to `/flows/[flowId]/settings`
- [ ] Select a Facebook page
- [ ] Click "Assign to Page"
- [ ] Success message appears

#### 10.2 Test Flow Execution

- [ ] Send a message to the Facebook page from Messenger
- [ ] Verify flow executes
- [ ] Check database for new session:

```sql
SELECT * FROM flow_sessions ORDER BY "createdAt" DESC LIMIT 1;
```

- [ ] Verify you receive a response in Messenger

#### 10.3 Check Webhook Logs

```bash
# Check application logs for:
# [FlowEngine] Executing flow...
# [FlowEngine] Created new session...
grep -i "FlowEngine" /path/to/logs
```

---

## 🎯 Final Verification

### All systems go if:

- [x] ✅ Database migration successful
- [x] ✅ Application builds without errors
- [x] ✅ UI is accessible at `/flows`
- [x] ✅ Users can create flows
- [x] ✅ Flows can be assigned to pages
- [x] ✅ Flows execute via Facebook messages
- [x] ✅ Plan limits are enforced
- [x] ✅ No critical errors in logs

---

## 🐛 Troubleshooting

### Issue: "Property 'flow' does not exist on PrismaClient"

**Solution**:

```bash
npx prisma generate
pnpm build
```

### Issue: Migration fails with "column already exists"

**Solution**:

```bash
# Check what's in database
npx prisma db pull

# If needed, drop tables and re-migrate
psql $DATABASE_URL
DROP TABLE IF EXISTS flows CASCADE;
DROP TABLE IF EXISTS flow_nodes CASCADE;
DROP TABLE IF EXISTS flow_assignments CASCADE;
DROP TABLE IF EXISTS flow_sessions CASCADE;
\q

# Then re-run migration
npx prisma migrate deploy
```

### Issue: Flow doesn't execute

**Check**:

1. Is flow active? (`isActive = true`)
2. Is flow assigned to correct page?
3. Is assignment active? (`flow_assignments.isActive = true`)
4. Are webhook logs showing the message?
5. Is page access token valid?

**Debug**:

```sql
SELECT
  f.name,
  f."isActive",
  fa."isActive" as assignment_active,
  fp.name as page_name
FROM flows f
LEFT JOIN flow_assignments fa ON f.id = fa."flowId"
LEFT JOIN facebook_pages fp ON fa."pageId" = fp.id
WHERE f.id = 'YOUR_FLOW_ID';
```

---

## 📊 Success Criteria

✅ **PASSED** if all items checked above

❌ **FAILED** if any critical item fails (database, build, UI access)

---

## 🎉 You're Done!

The Flow Builder is now live in production!

**Next Steps**:

1. Create some global flow templates for users
2. Monitor usage and error rates
3. Gather user feedback
4. Plan Phase 2 enhancements

---

**Last Updated**: 2026-02-15  
**Version**: 1.0  
**Time to Complete**: ~30-45 minutes
