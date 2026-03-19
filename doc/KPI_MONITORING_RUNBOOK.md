# P2 Growth Enablement — KPI Health Monitoring Runbook

**Last Updated:** March 20, 2026  
**Responsible Team:** Product, Engineering (Monitoring & Alerts)

## Overview

This runbook describes how to monitor the health of P2 Growth Enablement KPIs in production and respond to alerts. KPI health monitoring tracks:

- **Onboarding Speed**: Time to first channel, time to first automated reply
- **Engagement**: Weekly active tenants runtime trend
- **Reliability**: Channel setup success rates (Telegram, Facebook, Webchat)
- **Data Quality**: Freshness and completeness of KPI data

## Quick Start

### Accessing KPI Health Monitor

1. **Dashboard**: Navigate to **Admin > KPI Health** in the ReplyBase app
2. **API**: Health check endpoint at `GET /api/admin/kpi-health` (public, returns JSON)
3. **Real-time Status**: Check `data.status` field:
   - 🟢 `healthy` — No action needed
   - 🟡 `degraded` — Investigate alerts, implement recommendations
   - 🔴 `critical` — Immediate action required

### Understanding Status Levels

| Status   | HTTP Code | Meaning                                         | Action                                             |
| -------- | --------- | ----------------------------------------------- | -------------------------------------------------- |
| healthy  | 200       | All metrics within healthy ranges               | Monitor and establish baseline                     |
| degraded | 200       | Some metrics at risk or low data collection     | Investigate via dashboard; check recommendations   |
| critical | 503       | Infrastructure broken or data collection failed | SEV-1 alert; check database, logs, instrumentation |

## Key Metrics & Thresholds

### 1. First Channel Completion Rate

**What it measures**: % of tenants that connected their first communication channel (Telegram, Facebook, Webchat)

**Threshold**: ≥ 5% (configurable: `KPI_MIN_FIRST_CHANNEL_RATE`)

**Alert Triggers**:

- 🟡 **Warning** if < 5% for more than 1 data collection period
- 🔴 **Critical** if 0% (no channel connections at all)

**Investigative Steps**:

1. Check if any onboarding milestone events exist:

   ```sql
   SELECT COUNT(*) FROM "OnboardingMilestoneEvent"
   WHERE "milestoneId" = 'first-channel'
   AND "createdAt" > NOW() - INTERVAL '7 days';
   ```

2. If count > 0: Check on-platform UX — are users getting stuck after landing?
3. If count = 0: Phase B instrumentation may be broken. Review:
   - Channel creation flow is firing `recordMilestoneEvent("first-channel", ...)`
   - Database has persisted events in `onboarding_milestone_event` table

4. Review recent channel setup logs:
   ```sql
   SELECT "source", "event", "type", COUNT(*) as attempts FROM "WebhookLog"
   WHERE "type" IN ('setup_success', 'setup_error')
   AND "createdAt" > NOW() - INTERVAL '24 hours'
   GROUP BY "source", "event", "type" ORDER BY attempts DESC;
   ```

**Common Causes & Fixes**:
| Cause | Fix |
|-------|-----|
| New tenant cohort hasn't had time to activate | Wait 24–48 hours; this is normal for small cohorts |
| Phase B instrumentation not deployed | Verify recent deployments included recordMilestoneEvent calls |
| Database connectivity issue | Check Prisma logs; verify PostgreSQL is accessible |
| Channel UX broken (connection timeout, validation errors) | Test channel setup end-to-end; check browser console for errors |

---

### 2. First Automated Reply Completion Rate

**What it measures**: % of tenants that sent their first automated reply (via Flow or default bot)

**Threshold**: ≥ 2% (configurable: `KPI_MIN_FIRST_REPLY_RATE`)

**Alert Triggers**:

- 🟡 **Warning** if < 2%
- 🔴 **Critical** if 0%

**Key Insight**: This is usually much lower than first-channel rate because:

- Only ~20–30% of users activate a bot after connecting a channel
- Default bot onboarding may have friction
- Users may be testing channel connectivity first before setting up automation

**Investigative Steps**:

1. Confirm first-channel milestone is working (see above)
2. Check if default bot is being created:

   ```sql
   SELECT "tenantId", COUNT(*) as bot_count FROM "Bot"
   WHERE "name" LIKE '%default%'
   GROUP BY "tenantId" LIMIT 10;
   ```

3. Check FlowNode runtime messages:
   ```sql
   SELECT COUNT(*) FROM "CrmMessage"
   WHERE "source" IN ('flow', 'ai', 'system')
   AND "direction" = 'outbound'
   AND "createdAt" > NOW() - INTERVAL '7 days';
   ```

**Common Causes & Fixes**:
| Cause | Fix |
|-------|-----|
| Users not activating bots (low adoption) | Review onboarding UX; check if default bot is compelling |
| Flow execution broken | Test a simple flow end-to-end; check execution logs |
| Milestone event recording broken | Verify recordMilestoneEvent calls after first reply send |
| Low traffic overall | Normal; wait for more user activity |

---

### 3. Average Time to First Channel

**What it measures**: Mean days from tenant account creation to first channel connection

**Threshold**: ≤ 7 days (configurable: `KPI_MAX_DAYS_FIRST_CHANNEL`)

**Alert Triggers**:

- 🟡 **Warning** if > 7 days and increasing trend

**Insight**: If this increases over time (e.g., from 2 days to 5 days), it suggests UX friction or messaging issues.

**Investigative Steps**:

1. Compare time-to-completion across cohorts:

   ```sql
   SELECT DATE("t"."createdAt") as signup_date,
          AVG(EXTRACT(EPOCH FROM ("e"."createdAt" - "t"."createdAt")) / 86400)::int as avg_days
   FROM "OnboardingMilestoneEvent" e
   JOIN "Tenant" t ON t."id" = e."tenantId"
   WHERE e."milestoneId" = 'first-channel'
   GROUP BY DATE("t"."createdAt")
   ORDER BY signup_date DESC LIMIT 30;
   ```

2. If duration is increasing linearly: Check recent UI/onboarding changes
3. If duration has a spike: Check if there's a date-specific event (outage, feature launch, etc.)

**Common Causes & Fixes**:
| Cause | Fix |
|-------|-----|
| Recent UI redesign increased friction | A/B test design; gather user feedback |
| Help/documentation missing | Add in-app hints or guided tour to first channel setup |
| Channel requirements changed (e.g., now require API key) | Simplify setup flow or provide clearer instructions |
| Increased user cohort size (lower avg quality) | This is normal as you scale; focus on activation funnel UX |

---

### 4. Webhook Setup Reliability (Failed Webhook Setup Rate)

**What it measures**: % of channel setup attempts that failed on the webhook integration step (across all channels)

**Threshold**: ≤ 20% (configurable: `KPI_MAX_WEBHOOK_FAILURE_RATE`)

**Alert Triggers**:

- 🟡 **Warning** if > 20%

**Insight**: Represents infrastructure issues with Telegram API, Facebook Graph API, or HTTPS/domain config.

**Investigative Steps**:

1. Break down failures by channel:

   ```sql
   SELECT "source", "type", COUNT(*) as count FROM "WebhookLog"
   WHERE "createdAt" > NOW() - INTERVAL '7 days'
   GROUP BY "source", "type"
   ORDER BY "source", count DESC;
   ```

2. If Telegram failures spike:
   - Check Telegram API status (https://core.telegram.org/bots/api-release-notes)
   - Verify `TELEGRAM_WEBHOOK_BASE_URL` env var is valid HTTPS domain
   - Check if webhooks are blocked by firewall/WAF

3. If Facebook failures spike:
   - Verify Facebook App ID / App Secret are still valid
   - Check if page access tokens expired
   - Review Facebook logs: https://business.facebook.com/

4. If Webchat failures spike:
   - This is less critical (Webchat is in-page, doesn't need webhook)
   - Check domain allowlist configuration

**Common Causes & Fixes**:
| Cause | Fix |
|-------|-----|
| HTTPS URL misconfigured | Verify TELEGRAM_WEBHOOK_BASE_URL points to valid public domain with valid certificate; test with curl |
| Telegram API rate limit | Implement exponential backoff; check if you're reconnecting too frequently |
| Facebook token expired | Refresh app secret or re-authorize page |
| Network firewall blocking outbound connections to APIs | Check outbound security group rules on server |

---

### 5. Data Freshness

**What it measures**: Presence of recent telemetry data (milestone events, webhook logs, runtime messages in last hour)

**Status**:

- 🟢 `fresh` — > 5 data points collected in last hour
- 🟡 `stale` — 1–4 data points in last hour
- 🔴 `missing` — 0 data points in last hour

**Alert Triggers**:

- 🟡 **Warning** if `stale`
- 🔴 **Critical** if `missing`

**Investigative Steps**:

1. Check if this is during low-traffic hours (expected):
   - Current time and typical user timezone
   - If off-peak hours, `stale` is expected; return later

2. If during peak hours, verify database connectivity:

   ```bash
   # On server, test Prisma connection
   npx prisma db execute --stdin < /dev/null
   # Should return empty result set, not connection error
   ```

3. Check if instrumentation is firing:

   ```sql
   SELECT "createdAt" FROM "OnboardingMilestoneEvent"
   ORDER BY "createdAt" DESC LIMIT 5;
   ```

4. Check application logs for errors:
   ```bash
   # Recent logs
   docker logs --tail 100 replybase-saas | grep -i "error\|warn\|milestone"
   ```

---

## Configurable Alert Thresholds

All thresholds can be overridden via environment variables:

```bash
# Milestone completion thresholds
KPI_MIN_FIRST_CHANNEL_RATE=0.05          # Min 5% completion rate (default)
KPI_MIN_FIRST_REPLY_RATE=0.02            # Min 2% completion rate (default)

# Time-to-completion thresholds (days)
KPI_MAX_DAYS_FIRST_CHANNEL=7             # Max 7 days average (default)
KPI_MAX_DAYS_FIRST_REPLY=30              # Max 30 days average (default)

# Webhook reliability thresholds
KPI_MAX_WEBHOOK_FAILURE_RATE=0.2         # Max 20% failure rate (default)
KPI_MIN_WEBHOOK_ATTEMPTS=5               # Min 5 setup attempts per week (default)

# Data freshness thresholds
KPI_MIN_EVENT_AGE_HOURS=2                # Alert if no events in 2 hours (default)
```

**Example**: Adjust thresholds if product targets change:

```bash
export KPI_MAX_WEBHOOK_FAILURE_RATE=0.1  # Stricter 10% threshold
export KPI_MAX_DAYS_FIRST_CHANNEL=3      # Faster activation target
```

---

## Response Playbooks

### When Status = `degraded`

**Severity**: Low  
**Response Time**: 4–8 business hours  
**Owner**: Product Engineer on-call

1. **Review all active alerts** on the KPI Health dashboard
2. **For each alert**:
   - Read the metric name and message
   - Follow the investigative steps in the corresponding section above
   - Implement the recommended fix if applicable
3. **Re-check health within 30 minutes**
   - If status returns to healthy: Document findings and close alert
   - If status stays degraded: Escalate to engineering lead

**Example Alert**: "First channel completion rate is 2%"

- Follow steps in [First Channel Completion Rate](#1-first-channel-completion-rate)
- Likely conclusion: Phase B not deployed or UX issue
- Action: Deploy missing instrumentation or review onboarding UX

---

### When Status = `critical`

**Severity**: High  
**Response Time**: Immediate (within 15 minutes)  
**Owner**: On-call engineer (page if needed)

1. **Check the critical alert message**
2. **Determine root cause** (see table below)
3. **Implement fix** or escalate to platform team
4. **Verify recovery** by re-running health check

| Alert                                 | Likely Root Cause                                    | Fix                                                            |
| ------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------- |
| "No KPI data collected in last hour"  | Database down, instrumentation broken, network issue | Test DB connection; check logs; redeploy if needed             |
| "Failed to execute KPI health check"  | Exception in health check code                       | Check error in dashboard; review recent code changes           |
| "First channel completion rate is 0%" | No milestone events at all                           | Verify Phase B is deployed; test event recording manually      |
| "Webhook setup error rate is 100%"    | All channel integrations broken                      | Check API auth credentials; verify HTTPS config; test manually |

**Emergency Contact**:

- **Platform Team**: `#platform-oncall` (Slack)
- **Database**: Check CloudSQL/PostgreSQL status in cloud console
- **API Keys**: Verify Telegram, Facebook, or other third-party keys in `.env`

---

## Creating External Alerts (Uptime Monitors)

### UptimeRobot Configuration

1. **Login** to https://uptimerobot.com
2. **Add Monitor**:
   - **Type**: HTTP(S)
   - **URL**: `https://app.replybase.co.uk/api/admin/kpi-health`
   - **Watch for keyword**: `"status":"healthy"` or `"status":"degraded"`
   - **Alert on keyword NOT found**: Yes (alerts if status = critical)
   - **Check interval**: Every 5 minutes
   - **Alert contacts**: Slack, Email, PagerDuty as needed

3. **Response**: HTTP 200 (healthy/degraded) or 503 (critical)

### Slack Integration (Optional)

Add a Slack webhook to post KPI health updates:

```bash
# Send health check to Slack (run via cron every 30 min)
curl -X POST \$SLACK_WEBHOOK_URL \
  -d '{"text": "KPI Health Check: status='$(curl -s /api/admin/kpi-health | jq .status)'"}' \
  -H 'Content-Type: application/json'
```

---

## Escalation Matrix

| Condition                                | Escalate To      | Timeframe             |
| ---------------------------------------- | ---------------- | --------------------- |
| Any `critical` alert                     | On-call engineer | Immediate             |
| `degraded` status lasting > 2 hours      | Engineering lead | 2 hours               |
| Multiple `warning` alerts on same metric | Product team     | Next standup          |
| Thresholds need adjustment               | Product manager  | Next planning session |

---

## Post-Incident Review

After any `critical` alert:

1. **Document**:
   - What alert triggered?
   - Root cause identified?
   - Time to discovery and fix?
   - How was it resolved?

2. **Review**:
   - Could it have been caught earlier?
   - Should thresholds be adjusted?
   - Is monitoring coverage sufficient?

3. **Update**:
   - Add new checks if needed
   - Adjust thresholds based on learnings
   - Update runbook with new scenarios

---

## Appendix: Useful SQL Queries

### Check milestone event distribution over time

```sql
SELECT DATE_TRUNC('day', "createdAt") as day,
       "milestoneId",
       COUNT(*) as count
FROM "OnboardingMilestoneEvent"
WHERE "createdAt" > NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', "createdAt"), "milestoneId"
ORDER BY day DESC;
```

### Check average time-to-milestone by cohort

```sql
SELECT DATE_TRUNC('week', "t"."createdAt") as signup_week,
       COUNT(*) as tenants,
       PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY
         EXTRACT(EPOCH FROM ("e"."createdAt" - "t"."createdAt")) / 86400
       ) as median_days_first_channel
FROM "OnboardingMilestoneEvent" e
JOIN "Tenant" t ON t."id" = e."tenantId"
WHERE e."milestoneId" = 'first-channel'
GROUP BY signup_week
ORDER BY signup_week DESC;
```

### Check webhook setup reliability by channel

```sql
SELECT "source",
       COUNT(*) as total_attempts,
       SUM(CASE WHEN "type" = 'setup_success' THEN 1 ELSE 0 END) as successes,
       SUM(CASE WHEN "type" = 'setup_error' THEN 1 ELSE 0 END) as failures,
       ROUND(SUM(CASE WHEN "type" = 'setup_error' THEN 1 ELSE 0 END)::float /
             COUNT(*) * 100, 2) as failure_rate_pct
FROM "WebhookLog"
WHERE "createdAt" > NOW() - INTERVAL '7 days'
AND "type" IN ('setup_success', 'setup_error')
GROUP BY "source"
ORDER BY failure_rate_pct DESC;
```

---

## See Also

- [Phase B Instrumentation Docs](/doc/ONBOARDING_EVENTS.md)
- [Admin Analytics Dashboard](/admin/analytics)
- [Webchat Monitoring](/admin/webchat-monitoring)
- [Deployment Checklist](/DEPLOYMENT_CHECKLIST.md)
