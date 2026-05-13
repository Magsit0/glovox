import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("user_role", ["superadmin", "user"]);
export const countryEnum = pgEnum("country", ["CL", "PE"]);
export const pendingStatusEnum = pgEnum("pending_status", ["pending", "done"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  role: roleEnum("role").notNull().default("user"),
  // null = sin restricción de país (acceso global)
  country: countryEnum("country"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  // soft delete: signIn rechaza si revokedAt is not null
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const dashboards = pgTable("dashboards", {
  key: text("key").primaryKey(),
  pathPrefix: text("path_prefix").notNull().unique(),
  label: text("label").notNull(),
  appliesCountryScope: boolean("applies_country_scope")
    .notNull()
    .default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  title: text("title").notNull().default(""),
  description: text("description").notNull().default(""),
});

export const userDashboardAccess = pgTable(
  "user_dashboard_access",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    dashboardKey: text("dashboard_key")
      .notNull()
      .references(() => dashboards.key, { onDelete: "cascade" }),
    grantedAt: timestamp("granted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    grantedBy: uuid("granted_by"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.dashboardKey] })],
);

export const superadminPendings = pgTable("superadmin_pendings", {
  id: uuid("id").defaultRandom().primaryKey(),
  dashboardKey: text("dashboard_key")
    .notNull()
    .references(() => dashboards.key, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  status: pendingStatusEnum("status").notNull().default("pending"),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: uuid("actor_id"),
  action: text("action").notNull(),
  targetUserId: uuid("target_user_id"),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Dashboard = typeof dashboards.$inferSelect;
export type UserDashboardAccess = typeof userDashboardAccess.$inferSelect;
export type SuperadminPending = typeof superadminPendings.$inferSelect;
export type Role = (typeof roleEnum.enumValues)[number];
export type Country = (typeof countryEnum.enumValues)[number];
export type PendingStatus = (typeof pendingStatusEnum.enumValues)[number];
