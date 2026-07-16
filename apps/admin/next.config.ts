import type { NextConfig } from "next";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Hoist the monorepo's root .env into process.env. Next.js auto-loads
// .env only from the package's own directory, so without this the THEME
// and SOCIAL_AUTH_ENABLED values set at the root are invisible to the
// admin app. Shell env wins — we only fill in unset keys.
const rootEnv = resolve(process.cwd(), "..", "..", ".env");
if (existsSync(rootEnv)) {
  for (const line of readFileSync(rootEnv, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/i);
    if (!m) continue;
    if (process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
  }
}

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  transpilePackages: ["@repo/shared"],
  // Mirror THEME + SOCIAL_AUTH_ENABLED from .env into the NEXT_PUBLIC_*
  // namespace so server components and the client bundle both see the
  // active theme without a flash of unstyled content. Falls back to the
  // safe defaults when the vars aren't set (atlas, social auth on).
  env: {
    NEXT_PUBLIC_THEME: process.env.THEME || "atlas",
    NEXT_PUBLIC_SOCIAL_AUTH_ENABLED: process.env.SOCIAL_AUTH_ENABLED || "true",
  },
  // Uncomment and run "ANALYZE=true pnpm build" to inspect the bundle
  // ...(process.env.ANALYZE === "true"
  //   ? { ...require("@next/bundle-analyzer")({ enabled: true })(nextConfig) }
  //   : {}),
};

export default nextConfig;
