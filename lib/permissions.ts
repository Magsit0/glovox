/**
 * Dashboard permission system.
 *
 * Config lives in DASHBOARD_PERMISSIONS env var as JSON.
 * Three accepted shapes per email:
 *
 *   "user@glovox.cl": "all"
 *   "user@glovox.cl": ["/route", ...]
 *   "user@glovox.cl": {
 *     "dashboards": ["/marketing/weekly"],
 *     "dataScopes": {
 *       "/marketing/weekly": { "ticketera": ["TeleTicket"] }
 *     }
 *   }
 *
 * Rules:
 *  - "all"               → unrestricted access to every dashboard
 *  - string[]            → only those path prefixes are allowed
 *  - ScopedPermissions   → same routing rules under .dashboards, plus
 *                           per-prefix data filters under .dataScopes
 *  - Email not in config → no access (returns empty array)
 */

export type DataScope = {
  ticketera?: string[];
};

export type DashboardScopes = Record<string, DataScope>;

export type ScopedPermissions = {
  dashboards: "all" | string[];
  dataScopes?: DashboardScopes;
};

export type DashboardPermissions = "all" | string[] | ScopedPermissions;

function isScoped(p: DashboardPermissions): p is ScopedPermissions {
  return typeof p === "object" && !Array.isArray(p) && p !== null;
}

function getParsedPermissions(): Record<string, DashboardPermissions> {
  const raw = process.env.DASHBOARD_PERMISSIONS ?? "{}";
  try {
    return JSON.parse(raw) as Record<string, DashboardPermissions>;
  } catch {
    console.error(
      "[permissions] Could not parse DASHBOARD_PERMISSIONS — defaulting to empty",
    );
    return {};
  }
}

/**
 * Returns the permissions for a given email.
 * If the email is not in the config, returns an empty array (no access).
 */
export function getUserPermissions(email: string): DashboardPermissions {
  const config = getParsedPermissions();
  if (email in config) {
    return config[email];
  }
  return [];
}

/**
 * Dashboards públicos: accesibles para cualquier usuario logueado, sin grant
 * explícito (ni en DASHBOARD_PERMISSIONS ni en user_dashboard_access). El
 * proxy, el check de cada page y el filtro de tiles de la home pasan
 * todos por canAccessPath, así que basta con listarlos acá.
 */
export const PUBLIC_DASHBOARD_PATHS: readonly string[] = [
  "/reportes/grid-kiki-jw",
];

/**
 * Returns true if the given permissions grant access to a pathname.
 * Matches by prefix so "/club" covers "/club/sellers" etc.
 */
export function canAccessPath(
  permissions: DashboardPermissions,
  pathname: string,
): boolean {
  if (PUBLIC_DASHBOARD_PATHS.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }
  if (permissions === "all") return true;
  if (isScoped(permissions)) {
    return canAccessPath(permissions.dashboards, pathname);
  }
  if (permissions.length === 0) return false;
  return permissions.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Returns the data scope that applies to a pathname, or null if no scope
 * restriction applies (i.e. "all", legacy string[], or no matching dataScopes
 * entry). Callers should treat null as "no data filter".
 */
export function getDashboardScope(
  permissions: DashboardPermissions,
  pathname: string,
): DataScope | null {
  if (!isScoped(permissions)) return null;
  const scopes = permissions.dataScopes;
  if (!scopes) return null;
  for (const [prefix, scope] of Object.entries(scopes)) {
    if (pathname.startsWith(prefix)) return scope;
  }
  return null;
}
