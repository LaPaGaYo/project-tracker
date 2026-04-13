import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@the-platform/db", "@the-platform/shared"]
};

export default nextConfig;
