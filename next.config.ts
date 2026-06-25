import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Habilita la integración de React `<ViewTransition>` para animar las
    // navegaciones del grupo MARKETING (home → hub → dashboards y vuelta).
    viewTransition: true,
  },
  async redirects() {
    return [
      { source: "/events", destination: "/club/events", permanent: true },
      { source: "/earnings", destination: "/club/earnings", permanent: true },
      { source: "/unabase/cierre-mensual", destination: "/cierre-mensual", permanent: true },
      { source: "/unabase", destination: "/finanzas", permanent: true },
    ];
  },
};

export default nextConfig;
