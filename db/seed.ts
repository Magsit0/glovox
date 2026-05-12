import { eq } from "drizzle-orm";
import { db } from "./index";
import {
  dashboards,
  userDashboardAccess,
  users,
  type Country,
  type Role,
} from "./schema";

const SUPERADMIN_EMAIL = "maximiliano@glovox.cl";

const ALL_DASHBOARD_KEYS = [
  "club",
  "marketing.weekly",
  "unabase.cierre-mensual",
  "donations",
  "onepager",
  "frees",
  "ffbb",
];

type SeedUser = {
  email: string;
  role: Role;
  country: Country | null;
  dashboards: string[];
};

/**
 * Mirror of DASHBOARD_PERMISSIONS env var, modeled in DB primitives.
 * - "all" in env → user role with every dashboard granted
 * - {dashboards, dataScopes:{ticketera:[TeleTicket]}} → user, country=PE
 * Goal: env-fallback and DB lookup yield identical permissions.
 */
const TEAM_USERS: SeedUser[] = [
  { email: "benjamin@glovox.cl", role: "user", country: null, dashboards: ALL_DASHBOARD_KEYS },
  { email: "abarros@glovox.cl", role: "user", country: null, dashboards: ALL_DASHBOARD_KEYS },
  { email: "kengel@glovox.cl", role: "user", country: null, dashboards: ALL_DASHBOARD_KEYS },
  { email: "abruna@glovox.cl", role: "user", country: null, dashboards: ALL_DASHBOARD_KEYS },
  { email: "asenerman@glovox.cl", role: "user", country: null, dashboards: ALL_DASHBOARD_KEYS },
  { email: "godo@laud.pe", role: "user", country: "PE", dashboards: ["marketing.weekly"] },
  { email: "insbi@laud.pe", role: "user", country: "PE", dashboards: ["marketing.weekly"] },
  {
    email: "cisterna.maximiliano@gmail.com",
    role: "user",
    country: "PE",
    dashboards: ["marketing.weekly", "onepager"],
  },
];

const DASHBOARD_CATALOG = [
  {
    key: "club",
    pathPrefix: "/club",
    label: "Club Glovox",
    appliesCountryScope: true,
    sortOrder: 10,
  },
  {
    key: "marketing.weekly",
    pathPrefix: "/marketing/weekly",
    label: "Marketing semanal",
    appliesCountryScope: true,
    sortOrder: 20,
  },
  {
    key: "unabase.cierre-mensual",
    pathPrefix: "/unabase/cierre-mensual",
    label: "Unabase — cierre mensual",
    appliesCountryScope: false,
    sortOrder: 30,
  },
  {
    key: "donations",
    pathPrefix: "/donations",
    label: "Donaciones",
    appliesCountryScope: true,
    sortOrder: 40,
  },
  {
    key: "onepager",
    pathPrefix: "/onepager",
    label: "Onepager",
    appliesCountryScope: true,
    sortOrder: 50,
  },
  {
    key: "frees",
    pathPrefix: "/frees",
    label: "Cortesías",
    appliesCountryScope: true,
    sortOrder: 60,
  },
  {
    key: "ffbb",
    pathPrefix: "/ffbb",
    label: "Alimentos y bebidas",
    appliesCountryScope: true,
    sortOrder: 70,
  },
  {
    key: "cierre-negocio",
    pathPrefix: "/cierre-negocio",
    label: "Cierre negocio",
    appliesCountryScope: false,
    sortOrder: 80,
  },
] as const;

async function main() {
  console.log("→ Seeding dashboards catalog…");
  for (const d of DASHBOARD_CATALOG) {
    await db
      .insert(dashboards)
      .values(d)
      .onConflictDoUpdate({
        target: dashboards.key,
        set: {
          pathPrefix: d.pathPrefix,
          label: d.label,
          appliesCountryScope: d.appliesCountryScope,
          sortOrder: d.sortOrder,
        },
      });
    console.log(`  ✓ ${d.key} (${d.pathPrefix})`);
  }

  console.log(`→ Seeding superadmin: ${SUPERADMIN_EMAIL}`);
  await db
    .insert(users)
    .values({
      email: SUPERADMIN_EMAIL,
      role: "superadmin",
      country: null,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { role: "superadmin", revokedAt: null },
    });
  console.log("  ✓ superadmin ready");

  console.log("→ Seeding team users…");
  for (const u of TEAM_USERS) {
    const [row] = await db
      .insert(users)
      .values({
        email: u.email,
        role: u.role,
        country: u.country,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: { role: u.role, country: u.country, revokedAt: null },
      })
      .returning({ id: users.id });

    // Reset dashboard grants to exactly the desired list (idempotent).
    await db
      .delete(userDashboardAccess)
      .where(eq(userDashboardAccess.userId, row.id));
    if (u.dashboards.length > 0) {
      await db.insert(userDashboardAccess).values(
        u.dashboards.map((dashboardKey) => ({
          userId: row.id,
          dashboardKey,
        })),
      );
    }
    console.log(
      `  ✓ ${u.email} (${u.role}, country=${u.country}, dashboards=[${u.dashboards.join(", ")}])`,
    );
  }

  console.log("Seed complete.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
