# DigitalOcean AI Migration Guide (Production)

This guide outlines the finalized steps to migrate ReplyBase AI workloads to DigitalOcean AI Inference while maintaining a lean, centralized configuration system.

## 1. Infrastructure Requirements
- **DigitalOcean Token**: Ensure you have a functional DO Token with `read/write` access.
- **Gradient Project ID**: Required if using specialized models outside the standard inference API.
- **Intra-Datacenter Routing**: For sub-500ms TTFT, ensure the app is deployed in the same region as the DO Inference endpoint.

## 2. Environment Configuration
The application now uses a centralized configuration system (`lib/config.ts`). Only secrets and regional overrides should be placed in your `.env` file.

### Mandatory Secret
```bash
# Required to authenticate with DigitalOcean AI Inference API
DIGITALOCEAN_AI_KEY=your_do_token_here
```

### Optional Overrides
The following are managed in `lib/config.ts` but can be overridden if necessary:
```bash
# Base URL for the Inference API
DIGITALOCEAN_AI_BASE_URL=https://inference.do-ai.run/v1

# Override the Primary models if a newer version is released
AI_MODEL_DO_MAIN=meta-llama-3.1-8b-instruct
AI_MODEL_DO_PREMIUM=meta-llama-3.1-70b-instruct
```

## 3. Deployment Strategy

### Step A: Configuration Lock-in
Verify that `lib/config.ts` has the correct **Primary Target Models** for DigitalOcean:
- **Chat**: `meta-llama-3.1-8b-instruct` (Managed by `AI_MODEL_DO_MAIN`)
- **Reasoning/Onboarding**: `meta-llama-3.1-70b-instruct` (Managed by `AI_MODEL_DO_PREMIUM`)

### Step B: Clean Environment
Ensure your production `.env` is free of legacy variables. The migration to `lib/config.ts` means you no longer need `DEFAULT_CHAT_PROVIDER` or `DEFAULT_AI_PROVIDER` in your environment unless you are deviating from the system default.

### Step C: Coolify / Docker Deployment
When deploying via Coolify or Docker:
1. Provide the `DIGITALOCEAN_AI_KEY`.
2. Set `NODE_ENV=production`.
3. Set `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` to the production domain.

## 4. Performance Monitoring
- **TTFT Target**: < 500ms for Chat tasks.
- **TPOT Target**: > 50 tokens/sec for Summary tasks.
- Monitor these metrics via the Admin Dashboard.

## 5. Verification
After deployment, use the **Admin AI Test Runner** to verify:
1. Connectivity to the `digitalocean` provider.
2. Latency metrics for the `meta-llama-3.1-8b-instruct` model.
3. Successful fallback to `gemini` if the DO API is unreachable.
