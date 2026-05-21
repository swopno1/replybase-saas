# Production Security Hardening - Implementation Summary

Archived from `extra/` so production notes live with Product_Details instead of operational docs.

**Date**: February 12, 2026  
**Status**: Complete

## Completed Tasks

### 1. Typebot Builder OIDC Configuration

Issue:

- Bot-builder OIDC callback failing with an invalid NextAuth callback path.

Resolution summary:

- Corrected callback URL format to `/api/auth/callback/generic-oidc`.
- Updated SaaS OIDC provider configuration to support the corrected callback.
- Restarted builder and SaaS containers successfully.

Verification summary:

- Builder OIDC callback errors cleared.
- OpenID configuration endpoint responded successfully.
- JWKS endpoint responded successfully.

### 2. DEBUG Mode Disabled In Builder

Issue:

- Builder environment had `DEBUG=true` in production.

Resolution summary:

- Set `DEBUG=false` and restarted the container.

### 3. PostgreSQL Exposure Review

Issue:

- PostgreSQL exposure on public interfaces was identified as a security concern.

Status summary:

- Verified no public bind on `5432` on host.
- Follow-up operational detail documented separately in `POSTGRESQL_SECURITY_FIX.md`.

### 4. Engine And Viewer Access Controls

Issue:

- Engine and viewer should not rely on open public access patterns.

Status summary:

- OIDC authentication is active.
- Other authentication methods are disabled.
- Additional proxy-layer controls were documented as deployment hardening guidance.

## Environment Configuration Reference

### SaaS OIDC Provider

- `TYPEBOT_OIDC_CLIENT_ID`
- `TYPEBOT_OIDC_CLIENT_SECRET`
- `TYPEBOT_CALLBACK_URL`

### Bot-Builder OIDC Consumer

- `AUTH_PROVIDER=generic-oidc`
- `OIDC_ISSUER`
- `OIDC_CLIENT_ID`
- `OIDC_CLIENT_SECRET`
- `OIDC_CALLBACK_URL`
- `OIDC_NAME`
- `DEBUG=false`

## Files Referenced

- `lib/oidc-provider.ts`
- `POSTGRESQL_SECURITY_FIX.md`
- `ENGINE_ACCESS_RESTRICTION_GUIDE.md`
- `security-hardening.sh`

## Summary

This note remains useful as historical production context, but it is not an active runbook. Current planning and production note ownership lives under Product_Details.
