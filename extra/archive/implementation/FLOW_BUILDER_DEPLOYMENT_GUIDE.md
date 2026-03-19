# Flow Builder - Deployment & Setup Guide

## 🚀 Quick Start

This guide will help you deploy the Flow Builder system to production.

---

## 📋 Prerequisites

- PostgreSQL database (v12+)
- Node.js (v18+)
- pnpm or npm
- Access to production database
- Facebook App with Messenger integration

---

## 📦 Step 1: Install Dependencies

```bash
cd replybase-saas
pnpm install
```

---

## 🗄️ Step 2: Database Migration

### 2.1 Run Prisma Migration

```bash
# Generate Prisma Client with new models
npx prisma generate

# Apply migration to database
npx prisma migrate deploy
```

### 2.2 Verify Migration

```bash
# Check if tables were created
npx prisma db pull
```

Expected new tables:

- `flows`
- `flow_nodes`
- `flow_assignments`
- `flow_sessions`

Expected updated tables:

- `plans` (added `maxFlows` column)
- `leads` (added `flowId`, `pageId`, `tags` columns)

---

## 🌱 Step 3: Seed Default Global Flows (Optional)

### 3.1 Get System Tenant ID

First, you need a tenant ID for global flows. You can either:

**Option A**: Use an existing admin tenant

```bash
npx prisma studio
# Navigate to "tenants" table
# Copy an admin tenant ID
```

**Option B**: Create a system tenant

```sql
INSERT INTO tenants (id, name, "aiEnabled", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'System', false, NOW(), NOW())
RETURNING id;
```

### 3.2 Update Seed File

Open `prisma/seed-flows.sql` and replace all occurrences of `YOUR_TENANT_ID_HERE` with the actual tenant ID.

Also replace `FLOW_ID_HERE` placeholders:

1. Run each Flow INSERT separately
2. Note the returned ID
3. Use that ID in the corresponding FlowNode INSERTs

### 3.3 Run Seed Script

```bash
# If using psql
psql $DATABASE_URL -f prisma/seed-flows.sql

# Or manually run each INSERT statement
```

### 3.4 Alternative: Create Flows via UI

Instead of SQL, you can:

1. Log in as admin user
2. Navigate to `/flows`
3. Create flows manually
4. Mark them as global in the database:

```sql
UPDATE flows SET "isGlobal" = true, "ownerId" = NULL WHERE id = 'flow-id';
```

---

## ⚙️ Step 4: Update Plan Limits

Verify plan limits are set correctly:

```sql
-- Check current limits
SELECT name, "maxFlows" FROM plans;

-- Update if needed
UPDATE plans SET "maxFlows" = 3 WHERE name IN ('free', 'starter');
UPDATE plans SET "maxFlows" = 10 WHERE name = 'standard';
UPDATE plans SET "maxFlows" = 999999 WHERE name = 'premium';
```

---

## 🔧 Step 5: Environment Variables

Ensure these environment variables are set in production:

```env
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Facebook
FACEBOOK_CLIENT_ID=your_facebook_app_id
FACEBOOK_CLIENT_SECRET=your_facebook_app_secret
FACEBOOK_WEBHOOK_VERIFY_TOKEN=your_verify_token

# NextAuth
NEXTAUTH_SECRET=your_secret_key
NEXTAUTH_URL=https://app.replybase.co.uk
```

---

## 🏗️ Step 6: Build & Deploy

### 6.1 Build Application

```bash
cd replybase-saas
pnpm build
```

### 6.2 Run Type Checks (Optional)

```bash
pnpm type-check
```

**Note**: You may see TypeScript errors related to Prisma types until you run `npx prisma generate`. This is normal.

### 6.3 Deploy

Deploy using your preferred method (Vercel, Docker, PM2, etc.)

**Example: Vercel**

```bash
vercel --prod
```

**Example: Docker**

```bash
docker build -t replybase-saas .
docker run -p 3000:3000 replybase-saas
```

**Example: PM2**

```bash
pm2 start npm --name "replybase" -- start
pm2 save
```

---

## 🧪 Step 7: Post-Deployment Testing

### 7.1 Verify UI Access

1. Visit `https://app.replybase.co.uk/flows`
2. You should see the Flow Builder dashboard
3. Try creating a test flow

### 7.2 Verify API Endpoints

```bash
# Test flows API (requires authentication)
curl -X GET https://app.replybase.co.uk/api/flows \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN"
```

### 7.3 Test Facebook Integration

1. Assign a flow to a Facebook page
2. Send a message to the page from Messenger
3. Verify flow executes correctly
4. Check database for flow session creation

```sql
SELECT * FROM flow_sessions ORDER BY "createdAt" DESC LIMIT 10;
```

---

## 🔍 Step 8: Monitoring & Logging

### 8.1 Database Monitoring

Monitor these metrics:

- Flow session creation rate
- Active flow assignments
- Flow execution errors

```sql
-- Active sessions
SELECT COUNT(*) FROM flow_sessions WHERE "isActive" = true;

-- Completed sessions today
SELECT COUNT(*) FROM flow_sessions
WHERE "completedAt" >= CURRENT_DATE;

-- Flow usage by flow
SELECT f.name, COUNT(fs.id) as session_count
FROM flows f
LEFT JOIN flow_sessions fs ON f.id = fs."flowId"
GROUP BY f.id, f.name
ORDER BY session_count DESC;
```

### 8.2 Application Logs

Watch for these log patterns:

- `[FlowEngine]` - Flow execution logs
- `[Flows API]` - API request logs
- `[Facebook Webhook]` - Webhook processing logs

### 8.3 Error Tracking

Set up error tracking for:

- Flow execution failures
- Plan limit violations
- Database connection issues
- Facebook API errors

---

## 🐛 Troubleshooting

### Issue: Prisma Client Not Updated

**Symptoms**: TypeScript errors about missing models (flow, flowNode, etc.)

**Solution**:

```bash
npx prisma generate
pnpm build
```

### Issue: Migration Fails

**Symptoms**: Duplicate column errors, constraint violations

**Solution**:

```bash
# Check current schema
npx prisma db pull

# Reset database (WARNING: Data loss)
npx prisma migrate reset

# Or manually drop conflicting tables/columns
psql $DATABASE_URL
# DROP TABLE IF EXISTS flows CASCADE;
```

### Issue: Flow Execution Not Working

**Checklist**:

- [ ] Flow is active (`isActive = true`)
- [ ] Flow is assigned to correct page
- [ ] Flow assignment is active in `flow_assignments` table
- [ ] Page access token is valid
- [ ] Webhook receives messages (check logs)

**Debug Query**:

```sql
SELECT
  f.name as flow_name,
  f."isActive" as flow_active,
  fa."isActive" as assignment_active,
  fp.name as page_name
FROM flows f
LEFT JOIN flow_assignments fa ON f.id = fa."flowId"
LEFT JOIN facebook_pages fp ON fa."pageId" = fp.id
WHERE f.id = 'YOUR_FLOW_ID';
```

### Issue: Plan Limit Not Enforced

**Symptoms**: Users can create more flows than allowed

**Solution**:

```sql
-- Check plan limits
SELECT name, "maxFlows" FROM plans;

-- Update plan limits
UPDATE plans SET "maxFlows" = 3 WHERE name = 'starter';
```

### Issue: Global Flows Not Visible

**Symptoms**: Global Flows tab is empty

**Check**:

```sql
SELECT * FROM flows WHERE "isGlobal" = true;
```

**Solution**: Create global flows or mark existing flows as global:

```sql
UPDATE flows
SET "isGlobal" = true, "ownerId" = NULL
WHERE id IN ('flow-id-1', 'flow-id-2');
```

---

## 🔐 Security Checklist

Before going to production, verify:

- [ ] All API routes require authentication
- [ ] Tenant isolation is enforced
- [ ] Global flows cannot be edited
- [ ] Plan limits are server-side validated
- [ ] Database credentials are secure
- [ ] Environment variables are set correctly
- [ ] HTTPS is enabled (production)
- [ ] Session secrets are strong and unique
- [ ] Facebook webhook signature validation is enabled

---

## 📊 Performance Optimization

### Database Indexes

Verify these indexes exist (auto-created by Prisma):

```sql
-- Check indexes
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('flows', 'flow_nodes', 'flow_assignments', 'flow_sessions');
```

Expected indexes:

- `flows.tenantId`
- `flows.ownerId`
- `flows.isGlobal`
- `flow_nodes.flowId`
- `flow_assignments.flowId`
- `flow_assignments.pageId`
- `flow_sessions.userId`
- `flow_sessions.pageId`
- `flow_sessions.flowId`

### Query Performance

Monitor slow queries:

```sql
-- Enable slow query logging (if not already enabled)
ALTER DATABASE your_database SET log_min_duration_statement = 1000;

-- Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## 📈 Scaling Considerations

### Database

- Set up read replicas for heavy read operations
- Consider partitioning `flow_sessions` table by date
- Archive completed sessions older than 90 days

### Application

- Use Redis for session caching (if needed)
- Scale horizontally with load balancer
- Enable CDN for static assets

### Monitoring

- Set up alerts for:
  - High error rates
  - Slow API responses
  - Database connection pool exhaustion
  - Disk space usage

---

## 🎯 Success Criteria

Deployment is successful when:

1. ✅ Users can access `/flows` page
2. ✅ Users can create, edit, delete flows
3. ✅ Global flows are visible and duplicatable
4. ✅ Flows can be assigned to pages
5. ✅ Flows execute via Facebook messages
6. ✅ Plan limits are enforced
7. ✅ No TypeScript/build errors
8. ✅ All tests pass (see FLOW_BUILDER_TESTING_CHECKLIST.md)

---

## 📞 Support

For issues or questions:

1. Check logs for error messages
2. Review troubleshooting section above
3. Consult `FLOW_BUILDER_IMPLEMENTATION_SUMMARY.md`
4. Contact development team

---

## 📚 Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Facebook Messenger Platform](https://developers.facebook.com/docs/messenger-platform)
- `FLOW_BUILDER_TESTING_CHECKLIST.md` - Testing guide
- `FLOW_BUILDER_IMPLEMENTATION_SUMMARY.md` - Architecture overview

---

**Last Updated**: 2026-02-15  
**Version**: 1.0
