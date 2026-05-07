/**
 * Compare DB-resolved identity vs env-fallback for every email in
 * DASHBOARD_PERMISSIONS. Prints a side-by-side report so we can validate
 * Phase 2 before flipping PERMISSIONS_FALLBACK_TO_ENV=false.
 */
import { getUserIdentity } from "@/lib/permissions-service";

function parseEnvEmails(): string[] {
  const raw = process.env.DASHBOARD_PERMISSIONS ?? "{}";
  try {
    return Object.keys(JSON.parse(raw));
  } catch {
    return [];
  }
}

function summarize(perm: unknown): string {
  if (perm === "all") return "all";
  if (Array.isArray(perm)) return `[${perm.join(", ")}]`;
  if (perm && typeof perm === "object") {
    const obj = perm as { dashboards?: unknown; dataScopes?: unknown };
    const dashes = Array.isArray(obj.dashboards)
      ? `[${obj.dashboards.join(", ")}]`
      : String(obj.dashboards);
    const scopes = obj.dataScopes ? ` scopes=${JSON.stringify(obj.dataScopes)}` : "";
    return `${dashes}${scopes}`;
  }
  return String(perm);
}

async function main() {
  const emails = parseEnvEmails();
  console.log(`Auditing ${emails.length} emails from DASHBOARD_PERMISSIONS\n`);

  for (const email of emails) {
    const identity = await getUserIdentity(email);
    if (!identity) {
      console.log(`✗ ${email} — no identity (DB miss + env miss)`);
      continue;
    }
    const tag = identity.source === "db" ? "DB " : "ENV";
    console.log(
      `${tag} ${email} role=${identity.role} country=${identity.country ?? "-"} → ${summarize(identity.permissions)}`,
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Audit failed:", err);
    process.exit(1);
  });
