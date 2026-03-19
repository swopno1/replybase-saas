# PostgreSQL Security Configuration Guide

## Issue

PostgreSQL is currently listening on `0.0.0.0:5432`, making it accessible from the internet. This should be restricted to localhost only.

## Current Status

```bash
# Check current binding
docker port n0sw0s4s00o4k40cwcwsgc0o | grep 5432
# Output: 0.0.0.0:5432->5432/tcp
```

## Solution

### Step 1: Locate PostgreSQL Configuration

PostgreSQL is managed by Coolify. Find its docker-compose file:

```bash
# Find PostgreSQL container details
docker inspect n0sw0s4s00o4k40cwcwsgc0o | grep -A10 "Labels"

# Typical locations:
# - /data/coolify/databases/{database_id}/docker-compose.yaml
# - Check Coolify app ID from container labels

# Find the exact location
find /data/coolify -name "docker-compose.yaml" -exec grep -l "n0sw0s4s00o4k40cwcwsgc0o" {} \;
```

### Step 2: Modify docker-compose.yaml

Edit the PostgreSQL docker-compose.yaml file:

```bash
# Backup first
cp /data/coolify/databases/{database_id}/docker-compose.yaml /data/coolify/databases/{database_id}/docker-compose.yaml.backup

# Edit the file
nano /data/coolify/databases/{database_id}/docker-compose.yaml
```

**Find this section:**

```yaml
services:
  { container_name }:
    image: postgres:17-alpine
    ports:
      - "0.0.0.0:5432:5432" # ❌ INSECURE
```

**Change to:**

```yaml
services:
  { container_name }:
    image: postgres:17-alpine
    ports:
      - "127.0.0.1:5432:5432" # ✅ SECURE
```

### Step 3: Recreate Container

```bash
cd /data/coolify/databases/{database_id}

# Stop the container
docker compose down

# Start with new configuration
docker compose up -d

# Verify binding
docker port n0sw0s4s00o4k40cwcwsgc0o | grep 5432
# Should show: 127.0.0.1:5432->5432/tcp
```

### Step 4: Verify Applications Still Connect

```bash
# Check SaaS app logs
docker logs --tail 20 ukcsgkckg4s0o4s88gk4go8g-192006684386 2>&1 | grep -i "prisma\|database"

# Should see: "No pending migrations to apply" (success)
# Should NOT see: Connection errors
```

## Alternative: Using Coolify UI

If Coolify manages the database configuration:

1. Login to Coolify dashboard
2. Navigate to **Databases** → PostgreSQL instance
3. Find **Network** or **Port Configuration** section
4. Change binding from `0.0.0.0` to `127.0.0.1`
5. Click **Save** and **Restart**

## Verification

After making the change:

```bash
# 1. Check port binding (should show 127.0.0.1)
ss -tulpn | grep 5432

# 2. Test external access (should fail)
nc -zv 104.248.160.102 5432
# Expected: Connection refused or timeout

# 3. Test internal access (should work)
docker exec -it n0sw0s4s00o4k40cwcwsgc0o psql -U postgres -c "SELECT version();"
# Expected: PostgreSQL version string

# 4. Test from SaaS container (should work via Docker network)
docker exec ukcsgkckg4s0o4s88gk4go8g-192006684386 sh -c "node -e \"require('@prisma/client'); console.log('Prisma client loaded')\""
```

## Important Notes

- **Docker Networks**: Applications connect via Docker's internal network (`coolify` network), not via localhost:5432
- **Connection String**: The SaaS app uses `DATABASE_URL=postgresql://...@n0sw0s4s00o4k40cwcwsgc0o:5432/...` which uses the container name, not localhost
- **No Impact**: Changing the external binding does NOT affect internal container-to-container communication
- **Security**: This prevents direct PostgreSQL access from the internet while maintaining app connectivity

## Rollback Procedure

If something breaks:

```bash
# Restore from backup
cp /data/coolify/databases/{database_id}/docker-compose.yaml.backup /data/coolify/databases/{database_id}/docker-compose.yaml

# Recreate container
cd /data/coolify/databases/{database_id}
docker compose down && docker compose up -d
```
