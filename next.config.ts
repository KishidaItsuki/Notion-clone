import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // BlockNote は StrictMode の二重マウントと相性が悪いため無効化
  reactStrictMode: false,
};

export default nextConfig;
