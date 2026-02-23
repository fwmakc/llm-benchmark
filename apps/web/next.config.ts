import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@llm-benchmark/core"],
  // Native Node.js modules must not be bundled by webpack
  serverExternalPackages: ["better-sqlite3", "keytar"],
};

export default nextConfig;
