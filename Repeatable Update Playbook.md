# Repeatable Update Playbook

## Quick Reference: Update Flow

When you update the SaaS app code, follow these steps in order:

---

### Step 1: Pull Latest Code

```bash
cd ~/replybase-infra/sites/app
git pull origin main
```

---

### Step 2: Rebuild ONLY the App Image

```bash
cd ~/replybase-infra
docker compose build app
```

**Note:** Do not rebuild `nginx`, `postgres`, or `botpress` unless their configurations have changed.

---

### Step 3: Restart the App Container

```bash
docker compose up -d app
```

---

### Step 4: Run Database Migrations (If Schema Changed)

If the update includes Prisma schema changes, run migrations manually (temporary until automated in Dockerfile):

```bash
docker compose exec -u root app npx prisma migrate deploy
```

**Note:** Use `-u root` to avoid permission errors writing to `/app/node_modules/@prisma/engines`. Skip if no schema changes.

---

### Step 5: Verify Deployment

```bash
# Check container status
docker ps

# View recent logs
docker logs replybase-app --tail=50

# Check database logs for errors
docker logs replybase-postgres --tail=50
```

---

## When Prisma Schema Changes

### ✅ Preferred Method (Future-Proof)

1. Ensure migrations run automatically in the `Dockerfile` (e.g., add `RUN npx prisma migrate deploy` after installing dependencies).
2. Rebuild the image (Step 2 above)
3. Restart the container (Step 3 above)

### ⚠️ Temporary Method (Manual - Use Only if Needed)

```bash
docker compose exec -u root app npx prisma migrate deploy
```

**Note:** Requires root permissions due to container setup. Automate this in the Dockerfile for production.

---

## Critical Strategic Guidelines

### Current State Issues

- ❌ Manual SSH commands
- ❌ Running commands from host machine
- ❌ Inconsistent service name usage
- ❌ Non-repeatable deployment process

### Production-Ready Requirements

#### 1. Create `DEPLOY.md`

Document the standardized deployment process for the team.

#### 2. Standardize Commands

Always use:

```bash
docker compose build app
docker compose up -d app
```

#### 3. Never Run Prisma from Host

All Prisma commands should run inside containers or via CI/CD.

#### 4. Automate Everything

- Database migrations should run automatically on container startup
- No manual intervention should be required for standard deployments

---

## Next Steps to Production-Grade

1. **Add CI/CD Pipeline**

   - Automate build on git push
   - Run tests before deployment
   - Auto-deploy to staging/production

2. **Environment-Specific Configs**

   - Separate `.env` files for dev/staging/prod
   - Use secrets management (e.g., Docker secrets, AWS Secrets Manager)

3. **Health Checks**

   - Add health check endpoints to the app
   - Configure Docker health checks
   - Set up monitoring/alerting

4. **Rollback Strategy**
   - Tag Docker images with version numbers
   - Keep previous images for quick rollback
   - Document rollback procedure

---

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker logs replybase-app --tail=100

# Check container status
docker ps -a

# Restart all services
docker compose down && docker compose up -d
```

### Database Connection Issues

```bash
# Verify postgres is running
docker ps | grep postgres

# Check database logs
docker logs replybase-postgres --tail=50

# Test connection from app container
docker compose exec -u root app npx prisma migrate deploy
```

### Nginx Proxy Issues (If Site Not Updating)

```bash
# Restart nginx if configs changed or app container recreated
docker compose restart nginx

# Check nginx logs
docker logs replybase-nginx --tail=50
```

### Image Build Failures

```bash
# Clean build cache
docker builder prune

# Rebuild without cache
docker compose build --no-cache app
```

---

## TODO: Next Phase Improvements

- [ ] Create `DEPLOY.md` with team deployment guidelines
- [ ] Set up automated migrations in Dockerfile
- [ ] Implement CI/CD pipeline
- [ ] Add health check endpoints
- [ ] Configure monitoring and alerts
- [ ] Document rollback procedures
- [ ] Set up staging environment
