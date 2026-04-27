/**
 * Dashboard permission system.
 *
 * Config lives in DASHBOARD_PERMISSIONS env var as JSON:
 *   { "user@glovox.cl": "all" | ["/route", ...] }
 *
 * Rules:
 *  - "all"    → unrestricted access to every dashboard
 *  - string[] → only those path prefixes are allowed
 *  - Email not in config → no access (returns empty array)
 */

export type DashboardPermissions = "all" | string[];

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
  // Not listed → no access
  return [];
}

/**
 * Returns true if the given permissions grant access to a pathname.
 * Matches by prefix so "/club" covers "/club/sellers" etc.
 */
export function canAccessPath(
  permissions: DashboardPermissions,
  pathname: string,
): boolean {
  if (permissions === "all") return true;
  if (permissions.length === 0) return false;
  return permissions.some((prefix) => pathname.startsWith(prefix));
}
