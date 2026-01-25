import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["oidc-provider"], // Ensure oidc-provider is not bundled
  /* config options here */
  output: "standalone",
};

export default nextConfig;
