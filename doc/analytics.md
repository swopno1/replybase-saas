# Plausible Analytics Integration

ReplyBase uses Plausible Analytics for privacy-friendly, reliable analytics.

## Tracked Events

| Event Name | Description | Properties |
|------------|-------------|------------|
| `signup_started` | User started the signup process | `method`, `source`, `plan` |
| `signup_completed` | User successfully created an account | `method`, `source`, `plan` |
| `subscription_started` | User started a checkout session | `plan` |
| `subscription_updated` | User successfully upgraded or changed plan | `tenant_id`, `status` |
| `webchat_opened` | User opened the webchat widget | `url`, `trigger` |
| `webchat_message_sent` | User sent a message through webchat | `url`, `messageLength` |
| `onboarding_step_completed` | User completed an onboarding milestone | `tenant_id`, `step_id` |
| `pricing_viewed` | User viewed the pricing page | `origin` |
| `dashboard_loaded` | User loaded their dashboard | `tenant_id` |

## Environment Configuration

Analytics are only loaded in production (`NODE_ENV === 'production'`) and on allowed domains.

- `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`: The domain registered in Plausible (default: `app.replybase.co.uk`).
- `NEXT_PUBLIC_PLAUSIBLE_SCRIPT_SRC`: The URL of the Plausible script.
- `NEXT_PUBLIC_PLAUSIBLE_SHARED_LINK`: Shared dashboard link for admin panel integration.

## Implementation Details

- **Scripts**: Handled in `components/analytics/analytics-scripts.tsx`.
- **Client Wrappers**: Type-safe event tracking in `lib/client-analytics.ts`.
- **Debouncing**: High-frequency events like `webchat_message_sent` are debounced to avoid network overload.
- **Privacy**: No PII is sent to Plausible.
