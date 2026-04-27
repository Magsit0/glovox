export const DASHBOARDS = [
  "club",
  "marketing",
  "unabase",
  "donations",
  "onepager",
  "frees",
] as const;

export type Dashboard = (typeof DASHBOARDS)[number];

const ALL: readonly Dashboard[] = DASHBOARDS;

const EMAIL_ACCESS: Record<string, readonly Dashboard[]> = {
  "cisterna.maximiliano@gmail.com": ALL,
};

const DOMAIN_ACCESS: Record<string, readonly Dashboard[]> = {
  "glovox.cl": ALL,
};

export function dashboardsForEmail(email: string | null | undefined): Dashboard[] {
  if (!email) return [];
  const normalized = email.toLowerCase();
  if (EMAIL_ACCESS[normalized]) return [...EMAIL_ACCESS[normalized]];
  const domain = normalized.split("@")[1];
  if (domain && DOMAIN_ACCESS[domain]) return [...DOMAIN_ACCESS[domain]];
  return [];
}

const PATH_TO_DASHBOARD: { prefix: string; dashboard: Dashboard }[] = [
  { prefix: "/club", dashboard: "club" },
  { prefix: "/marketing", dashboard: "marketing" },
  { prefix: "/unabase", dashboard: "unabase" },
  { prefix: "/donations", dashboard: "donations" },
  { prefix: "/onepager", dashboard: "onepager" },
  { prefix: "/frees", dashboard: "frees" },
];

export function dashboardForPath(pathname: string): Dashboard | null {
  const match = PATH_TO_DASHBOARD.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  return match?.dashboard ?? null;
}
