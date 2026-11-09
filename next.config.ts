import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist has an optional Node-only `canvas` require; we only use it in the browser.
  webpack: (config) => {
    config.resolve.alias = { ...(config.resolve.alias ?? {}), canvas: false };
    return config;
  },
};

export default nextConfig;
