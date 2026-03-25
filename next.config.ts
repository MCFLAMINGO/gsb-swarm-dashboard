import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Silence workspace root warning
  turbopack: {
    // intentionally empty
  },
};

export default nextConfig;
