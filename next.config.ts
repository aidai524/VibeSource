import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

if (process.env.VIBESOURCE_CLOUDFLARE_DEV_BINDINGS === "enabled") {
  initOpenNextCloudflareForDev();
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // OpenNext must copy the package's workerd export, not Next.js' default
  // empty Node export, when bundling node-postgres for Workers.
  serverExternalPackages: ["pg-cloudflare"],
};

export default nextConfig;
