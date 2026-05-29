import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
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

export const dashboardAccessLog = pgTable(
  "dashboard_access_log",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    dashboardKey: text("dashboard_key")
      .notNull()
      .references(() => dashboards.key, { onDelete: "cascade" }),
    path: text("path").notNull(),
    accessedAt: timestamp("accessed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("dash_access_user_idx").on(t.userId, t.accessedAt),
    index("dash_access_dashboard_idx").on(t.dashboardKey, t.accessedAt),
  ],
);

// FF&BB — Compras de insumos imputadas por Operaciones. La fuente de verdad
// vive acá; el dashboard cruza contra `onfire.soldItems` × `formulaTragoBQ`
// (BigQuery) por `eventoId` + `insumo` para calcular consumo vs comprado.
export const comprasInsumo = pgTable(
  "compras_insumo",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventoId: text("evento_id"), // null = stock general sin asignar a evento
    insumo: text("insumo").notNull(),
    numeroFactura: text("numero_factura"),
    proveedor: text("proveedor"),
    fechaCompra: date("fecha_compra"),
    nPallets: integer("n_pallets"),
    nDisplay: integer("n_display"),
    xDisplay: integer("x_display"),
    sueltas: integer("sueltas"),
    recibido: integer("recibido"),
    pedido: integer("pedido"),
    tipoOperacion: text("tipo_operacion").notNull().default("ingreso"),
    lugar: text("lugar"),
    obs: text("obs"),
    costoUnitario: doublePrecision("costo_unitario"),
    costoNeto: doublePrecision("costo_neto"),
    iva: doublePrecision("iva"),
    bruto: doublePrecision("bruto"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedBy: uuid("updated_by"),
  },
  (t) => [
    index("compras_insumo_evento_idx").on(t.eventoId),
    index("compras_insumo_insumo_idx").on(t.insumo),
  ],
);

// FF&BB — Catálogo de proveedores. Source-of-truth para el dropdown de
// "proveedor" en el form de imputar compras. Operaciones puede agregar
// nuevos desde el combobox inline.
export const proveedores = pgTable("proveedores", {
  id: uuid("id").defaultRandom().primaryKey(),
  nombre: text("nombre").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdBy: uuid("created_by"),
});

// FF&BB — Catálogo de insumos. El "nombre" se usa para cruzar con
// `formulaTragoBQ` (BigQuery) por igualdad de string. Las otras columnas
// (grupo, mL, marca, porCaja) son metadata operativa.
export const insumosCatalogo = pgTable("insumos_catalogo", {
  id: uuid("id").defaultRandom().primaryKey(),
  nombre: text("nombre").notNull().unique(),
  grupo: text("grupo"),
  ml: integer("ml"),
  marca: text("marca"),
  porCaja: integer("por_caja"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdBy: uuid("created_by"),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Dashboard = typeof dashboards.$inferSelect;
export type UserDashboardAccess = typeof userDashboardAccess.$inferSelect;
export type SuperadminPending = typeof superadminPendings.$inferSelect;
export type DashboardAccessLog = typeof dashboardAccessLog.$inferSelect;
export type CompraInsumo = typeof comprasInsumo.$inferSelect;
export type NewCompraInsumo = typeof comprasInsumo.$inferInsert;
export type Proveedor = typeof proveedores.$inferSelect;
export type NewProveedor = typeof proveedores.$inferInsert;
export type InsumoCatalogo = typeof insumosCatalogo.$inferSelect;
export type NewInsumoCatalogo = typeof insumosCatalogo.$inferInsert;
export type Role = (typeof roleEnum.enumValues)[number];
export type Country = (typeof countryEnum.enumValues)[number];
export type PendingStatus = (typeof pendingStatusEnum.enumValues)[number];
