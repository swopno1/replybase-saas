# Admin Operations Report

## Admin Capabilities
- **User Management**: Search and filter all users across tenants.
- **KPI Dashboard**: Real-time health checks and segmented activation metrics.
- **Webchat Rollout**: Controlled rollout of webchat features (A/B testing support).
- **Log Inspection**: Global view of system-wide webhook logs (requires tenantId addition for better filtering).

## Operational Risks
- **Over-privileged Access**: Admin users have broad access to tenant data.
- **Manual Tasks**: Subscription reconciliations are currently automated via cron but require periodic manual audit of Stripe vs DB status.

## Future Enhancements
1. **Impersonation Mode**: Allow admins to securely "view as" a tenant for support troubleshooting.
2. **Quota Management**: Override tenant limits manually for enterprise exceptions.
3. **System Alerts**: Integrate Slack/Discord notifications for failed BullMQ jobs.
