# Repeatable Update Playbook

## Quick Reference: Standard Update Flow

Follow these steps for routine app updates:

1. **Pull Code**: `cd ~/replybase-infra/sites/app && git pull origin main`
2. **Build App**: `cd ~/replybase-infra && docker compose build app`
3. **Restart App**: `docker compose up -d app`
4. **Migrate DB (if schema changed)**: `docker compose exec -u root app npx prisma migrate deploy`
5. **Verify**: `docker ps && docker logs replybase-app --tail=50`

**Notes**:
- Only rebuild `app`; skip `nginx`, `postgres`, `botpress` unless configs change.
- Use root for Prisma to avoid permission errors.

## Troubleshooting

### Container Issues
- **Won't Start**: `docker logs replybase-app --tail=100 && docker ps -a`
- **Restart All**: `docker compose down && docker compose up -d`

### Database Issues
- **Connection Errors**: `docker logs replybase-postgres --tail=50`
- **Test from App**: `docker compose exec -u root app npx prisma migrate deploy`
- **Role/User Errors**: Use correct user from .env (e.g., -U rb_admin, not postgres).

### Nginx Issues
- **Site Not Updating**: `docker compose restart nginx && docker logs replybase-nginx --tail=50`

### Build Failures
- **Clean Cache**: `docker builder prune && docker compose build --no-cache app`
- **Missing '@tailwindcss/postcss' or 'stripe'**:
  - Add to `package.json` dependencies.
  - Change Dockerfile `RUN npm install --production` to `RUN npm install`.
  - Run `npm install` in `./sites/app`.
  - Disable Turbopack in `next.config.js`: `experimental: { turbo: false }`.

## Advanced: Full Redeploy from Scratch

For complete reset (drops all data—backup first).

1. **Stop All**: `docker compose down -v`
2. **Remove Volumes**: `docker volume rm replybase-infra_postgres_data replybase-infra_botpress_data`
3. **Redeploy Postgres**: `docker compose up -d postgres` (wait for healthy)
4. **Reset DB**: `docker compose exec -u root postgres psql -U ${POSTGRES_USER} -d ${POSTGRES_DB} -c "DROP SCHEMA IF EXISTS app CASCADE; CREATE SCHEMA app;"`  
   *Note: If env vars not loaded, replace with actual values (e.g., -U postgres -d replybase).*
5. **Push Schema**: `docker compose exec -u root app npx prisma db push --skip-generate`
6. **Deploy Botpress**: `docker compose up -d botpress`
7. **Deploy Rest**: `docker compose up -d marketing app nginx`
8. **Verify**: `docker ps && curl -i https://app.replybase.co.uk/`

## Advanced: Clean Droplet Redeploy

Fresh droplet start.

1. **Clean Droplet**: `docker compose down -v && docker system prune -a --volumes && sudo apt clean && sudo apt autoremove -y`
2. **Deploy Marketing**: `docker compose up -d marketing nginx`
3. **Deploy DB/Botpress**: `docker compose up -d postgres` (wait), then `docker compose up -d botpress`
4. **Deploy App**: Pull code, `docker compose build app && docker compose up -d app && docker compose exec -u root app npx prisma db push --skip-generate`
5. **Verify**: `docker ps && docker logs replybase-app --tail=50 && curl -i https://app.replybase.co.uk/`

## Strategic Guidelines

- **Issues**: Manual commands, inconsistent names, non-repeatable process.
- **Requirements**: Automate migrations, use CI/CD, secure configs, add health checks/monitoring.
- **Never Run Prisma from Host**: Always in containers.

## TODO: Next Phase Improvements

- [ ] Create `DEPLOY.md` for team guidelines
- [ ] Automate migrations in Dockerfile
- [ ] Set up CI/CD pipeline
- [ ] Add health endpoints and monitoring
- [ ] Document rollback
- [ ] Configure staging environment
