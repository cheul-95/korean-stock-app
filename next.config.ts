import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverRuntimeConfig: {
    KIS_APP_KEY: process.env.KIS_APP_KEY,
    KIS_APP_SECRET: process.env.KIS_APP_SECRET,
    REDIS_URL: process.env.REDIS_URL,
  },
  env: {
    KIS_APP_KEY: process.env.KIS_APP_KEY ?? "",
    KIS_APP_SECRET: process.env.KIS_APP_SECRET ?? "",
    REDIS_URL: process.env.REDIS_URL ?? "",
  },
};

export default nextConfig;
