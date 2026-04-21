import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "dict.youdao.com" }],
  },
  experimental: {
    typedRoutes: false,
  },
};

export default nextConfig;
