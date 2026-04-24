import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/events", destination: "/club/events", permanent: true },
      { source: "/earnings", destination: "/club/earnings", permanent: true },
      { source: "/cierre-mensual", destination: "/unabase/cierre-mensual", permanent: true },
    ];
  },
};

export default nextConfig;
