import path from "node:path";

import type { NextConfig } from "next";

const workspaceRoot = path.resolve(import.meta.dirname, "../..");

const nextConfig: NextConfig = {
  outputFileTracingRoot: workspaceRoot,
  reactStrictMode: true,
  transpilePackages: ["@the-platform/db", "@the-platform/shared"]
};

export default nextConfig;
