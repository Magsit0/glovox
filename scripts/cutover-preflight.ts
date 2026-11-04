/**
 * Pre-cutover validator. Run before flipping
 * `PERMISSIONS_FALLBACK_TO_ENV=false` in production.
 *
 * Cutover is safe iff **no current env user loses access** — DB may grant
 * more than env (additive drift is fine), but never less.
 *
 * Checks per email:
 *   1. Has a non-revoked DB row, resolved via DB (not env fallback).
 *   2. DB dashboards ⊇ env dashboards (no removals).
 *   3. DB scopes are at least as restrictive as env: where env had a
 *      ticketera dataScope, the DB user must have the matching country
 *      (`users.country`) — we don't widen scope silently. Since 2026-11-04 the
 *      country scope is `users.country` → `categoriaEvento.Pais`
 *      (lib/scopes.ts) and the DB side no longer carries `dataScopes`; the env
 *      ticketera list only tells us which country the user was limited to.
 *
 * Plus invariant: ≥1 active superadmin in DB.
 *
 * Exit 0 = safe to flip. Non-zero = stop and investigate.
 */
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { dashboards, users } from "@/db/schema";
import {
  getUserPermissions as legacyPermissions,
  type DashboardPermissions,
} from "@/lib/permissions";
import { getUserIdentity } from "@/lib/permissions-service";

function envEmails(): string[] {
  const raw = process.env.DASHBOARD_PERMISSIONS ?? "{}";
  try {
    return Object.keys(JSON.parse(raw));
  } catch {
    return [];
  }
}

// Legacy env ticketera scope → the country it stood for.
const LEGACY_TICKETERA_PAIS: Record<string, string> = { TeleTicket: "PE" };

type Resolved = {
  dashboards: Set<string>;
  // path → ticketera filter (sorted, joined). Empty string = no scope.
  scopes: Record<string, string>;
};

function resolve(
  perm: DashboardPermissions | "all",
  fullCatalog: string[],
): Resolved {
  if (perm === "all") {
    return { dashboards: new Set(fullCatalog), scopes: {} };
  }
  if (Array.isArray(perm)) {
    return { dashboards: new Set(perm), scopes: {} };
  }
  if (perm && typeof perm === "object") {
    const dashes =
      perm.dashboards === "all" ? new Set(fullCatalog) : new Set(perm.dashboards);
    const scopes: Record<string, string> = {};
    if (perm.dataScopes) {
      for (const [k, v] of Object.entries(perm.dataScopes)) {
        scopes[k] = [...(v.ticketera ?? [])].sort().join(",");
      }
    }
    return { dashboards: dashes, scopes };
  }
  return { dashboards: new Set(), scopes: {} };
}

async function main() {
  const emails = envEmails();
  let problems = 0;

  // Full catalog from DB — used to expand env "all" into a comparable list.
  const cat = await db.select({ pathPrefix: dashboards.pathPrefix }).from(dashboards);
  const fullCatalog = cat.map((d) => d.pathPrefix);

  console.log(
    `Preflight: ${emails.length} emails in DASHBOARD_PERMISSIONS\n`,
  );

  for (const email of emails) {
    const identity = await getUserIdentity(email);
    if (!identity) {
      console.log(`✗ ${email} — missing from DB and env. STOP.`);
      problems++;
      continue;
    }
    if (identity.source !== "db") {
      console.log(
        `✗ ${email} — resolves via env fallback. Add to db/seed.ts.`,
      );
      problems++;
      continue;
    }

    const envR = resolve(legacyPermissions(email), fullCatalog);
    const dbR = resolve(identity.permissions, fullCatalog);

    // 1) DB dashboards must be a superset of env dashboards.
    const missing = [...envR.dashboards].filter((p) => !dbR.dashboards.has(p));
    // 2) Where env had a ticketera scope, DB must keep the user in that
    //    country (DB cannot widen to global or move them to another country).
    const scopeIssues: string[] = [];
    for (const [path, envScope] of Object.entries(envR.scopes)) {
      if (!envScope) continue;
      const expected = envScope
        .split(",")
        .map((t) => LEGACY_TICKETERA_PAIS[t])
        .find(Boolean);
      if (!identity.country || (expected && identity.country !== expected)) {
        scopeIssues.push(
          `${path}: env=[${envScope}] → country ${expected ?? "?"}, db country=${identity.country ?? "null (global)"}`,
        );
      }
    }

    if (missing.length || scopeIssues.length) {
      console.log(`✗ ${email} — drift detected`);
      if (missing.length) console.log(`    missing in DB: ${missing.join(", ")}`);
      for (const s of scopeIssues) console.log(`    scope: ${s}`);
      problems++;
      continue;
    }

    const extra = [...dbR.dashboards].filter((p) => !envR.dashboards.has(p));
    const note = extra.length ? `  (DB grants extra: ${extra.join(", ")})` : "";
    console.log(`✓ ${email} — DB ⊇ env (${identity.role})${note}`);
  }

  const supers = await db
    .select({ email: users.email })
    .from(users)
    .where(and(eq(users.role, "superadmin"), isNull(users.revokedAt)));
  if (supers.length === 0) {
    console.log("\n✗ No active superadmin in DB. STOP.");
    problems++;
  } else {
    console.log(
      `\n✓ ${supers.length} active superadmin(s): ${supers.map((s) => s.email).join(", ")}`,
    );
  }

  if (problems > 0) {
    console.error(`\n${problems} problem(s). Do NOT flip the flag yet.`);
    process.exit(1);
  }
  console.log(
    "\nAll checks pass. Safe to set PERMISSIONS_FALLBACK_TO_ENV=false.",
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Preflight crashed:", err);
    process.exit(2);
  });
