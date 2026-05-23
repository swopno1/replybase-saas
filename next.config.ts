import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  output: "standalone",
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://engine.replybase.co.uk https://*.stripe.com https://*.clarity.ms https://connect.facebook.net https://*.facebook.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https: blob:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://api.openai.com https://api.anthropic.com https://*.google.com https://*.stripe.com https://engine.replybase.co.uk https://*.clarity.ms https://*.posthog.com https://*.facebook.com; frame-src 'self' https://*.stripe.com https://*.facebook.com; worker-src 'self' blob:;",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

const sentryWebpackPluginOptions = {
  // Sentry organisation and project slugs
  org: "replybase",
  project: "javascript-nextjs",

  // Suppresses source map uploading logs during build
  silent: !process.env.CI,

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-side errors will fail.
  tunnelRoute: "/monitoring",

  // Automatically annotate React components to show their full name in breadcrumbs and session replay
  reactComponentAnnotation: { enabled: true },

  // Deletes source maps after uploading to Sentry so they don't appear in production bundles
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,
};

export default process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  : nextConfig;
