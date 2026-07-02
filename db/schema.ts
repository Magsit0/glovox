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
  uniqueIndex,
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

// GOVERNANCE — estado editable por activo del catálogo de datos. El catálogo
// declarativo (qué debería existir) vive en `data/governance-catalog.json`,
// generado desde el repo `data-governance`. Esta tabla guarda las anotaciones
// que el equipo edita en vivo desde `/governance`: override de estado, owner,
// notas y tags. Scaffolding para la edición (v2); en v1 `/governance` es solo
// lectura y el estado sale del manifiesto.
export const governanceAssetState = pgTable("governance_asset_state", {
  // == CatalogAsset.key (FQN "dataset.tabla")
  assetKey: text("asset_key").primaryKey(),
  statusOverride: text("status_override"),
  owner: text("owner"),
  notes: text("notes"),
  tags: text("tags").array(),
  updatedBy: uuid("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
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

// MARCAS — Facturadores (entidad legal que recibe la factura).
// UN facturador es identificado únicamente por su RUT. Un mismo facturador
// puede emitir facturas representando a varias marcas comerciales distintas
// (caso típico: agencia o holding intermediario).
export const marcaFacturadores = pgTable("marca_facturadores", {
  id: uuid("id").defaultRandom().primaryKey(),
  rut: text("rut").notNull().unique(),
  razonSocial: text("razon_social").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// MARCAS — Marca commercial / sponsor. Esto es lo que se imputa al evento;
// cada fila es una marca distinta (Xtreme, Gatorlit, Entel) y apunta a SU
// facturador. Dos marcas distintas pueden compartir facturador → así "Nube"
// (intermediario) factura tanto a Xtreme como a Gatorlit, y ambas aparecen
// como filas separadas en la matriz, manteniendo el RUT del facturador en
// común. El nombre de la marca es UNIQUE → previene duplicados accidentales
// tipo "Entel" vs "Entel PCS" como marcas distintas si en realidad son lo mismo.
export const marcaClientes = pgTable("marca_clientes", {
  id: uuid("id").defaultRandom().primaryKey(),
  nombre: text("nombre").notNull().unique(),
  facturadorId: uuid("facturador_id")
    .notNull()
    .references(() => marcaFacturadores.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// MARCAS — Ingresos por cliente imputados manualmente al evento. El monto
// bruto se calcula server-side a partir del neto + IVA (19%). Persistimos
// snapshot de rut/cliente para mantener el registro estable aunque el cliente
// cambie de nombre o RUT.
export const marcaIngresos = pgTable(
  "marca_ingresos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventoId: text("evento_id").notNull(),
    clienteId: uuid("cliente_id")
      .notNull()
      .references(() => marcaClientes.id),
    rutCliente: text("rut_cliente").notNull(),
    cliente: text("cliente").notNull(),
    montoNeto: doublePrecision("monto_neto").notNull(),
    montoBruto: doublePrecision("monto_bruto").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("marca_ingresos_evento_idx").on(t.eventoId)],
);

// TICKETING — Planes de pricing (constructor del tab `/ticketing?tab=pricing`).
// Reemplaza el armado manual en Excel ("Plan Ticketing Piknic"). MVP: modelo
// DOCUMENTO — el plan completo (etapas, tipos de producto, sponsors+%, y la
// grilla tipo×etapa con precio/stock) vive en el jsonb `doc` (shape PlanDoc en
// lib/ticketing-pricing/config.ts). Las columnas de cabecera son para listar y
// filtrar; las fórmulas (CPS, ingresos, rebate) se derivan en cliente y
// servidor con lib/ticketing-pricing/formulas.ts, no se persisten.
export const ticketingPlanes = pgTable(
  "ticketing_planes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    nombre: text("nombre").notNull(),
    country: countryEnum("country").notNull(),
    fechaEvento: date("fecha_evento"),
    doc: jsonb("doc").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedBy: uuid("updated_by"),
  },
  (t) => [index("ticketing_planes_country_idx").on(t.country)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Dashboard = typeof dashboards.$inferSelect;
export type UserDashboardAccess = typeof userDashboardAccess.$inferSelect;
export type SuperadminPending = typeof superadminPendings.$inferSelect;
export type GovernanceAssetState = typeof governanceAssetState.$inferSelect;
export type NewGovernanceAssetState = typeof governanceAssetState.$inferInsert;
export type DashboardAccessLog = typeof dashboardAccessLog.$inferSelect;
export type CompraInsumo = typeof comprasInsumo.$inferSelect;
export type NewCompraInsumo = typeof comprasInsumo.$inferInsert;
export type Proveedor = typeof proveedores.$inferSelect;
export type NewProveedor = typeof proveedores.$inferInsert;
export type InsumoCatalogo = typeof insumosCatalogo.$inferSelect;
export type NewInsumoCatalogo = typeof insumosCatalogo.$inferInsert;
export type MarcaFacturador = typeof marcaFacturadores.$inferSelect;
export type NewMarcaFacturador = typeof marcaFacturadores.$inferInsert;
export type MarcaCliente = typeof marcaClientes.$inferSelect;
export type NewMarcaCliente = typeof marcaClientes.$inferInsert;
export type MarcaIngreso = typeof marcaIngresos.$inferSelect;
export type NewMarcaIngreso = typeof marcaIngresos.$inferInsert;
// TICKETING — Catálogo de sponsors/marcas para el constructor de pricing.
// Estandariza el NOMBRE de la marca (evita "ENTEL + BANCO" vs "Entel+Banco"):
// el builder lo elige de acá en vez de tipearlo libre. El % de descuento y el
// cupo NO viven acá — varían por evento y se cargan en el `doc` del plan. Soft
// delete vía `activo` (desactivar no rompe planes viejos, que guardan el nombre
// denormalizado). Único por (país, nombre).
export const ticketingSponsors = pgTable(
  "ticketing_sponsors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    nombre: text("nombre").notNull(),
    country: countryEnum("country").notNull(),
    activo: boolean("activo").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedBy: uuid("updated_by"),
  },
  (t) => [uniqueIndex("ticketing_sponsors_country_nombre_idx").on(t.country, t.nombre)],
);

export type TicketingPlan = typeof ticketingPlanes.$inferSelect;
export type NewTicketingPlan = typeof ticketingPlanes.$inferInsert;
export type TicketingSponsor = typeof ticketingSponsors.$inferSelect;
export type NewTicketingSponsor = typeof ticketingSponsors.$inferInsert;

// PRESUPUESTO — Constructor de presupuesto de evento (/presupuesto). Gemelo de
// ticketingPlanes: modelo DOCUMENTO — el presupuesto completo (asistentes,
// per-cápitas de ingreso, margen objetivo y la cascada de costos por categoría)
// vive en el jsonb `doc` (shape PresupuestoDoc en lib/budget-forecast/config.ts).
// Las fórmulas (ingreso proyectado, techo, cascada) se derivan en cliente y
// servidor con lib/budget-forecast/formulas.ts, no se persisten. Las columnas de
// cabecera son para listar/filtrar.
export const presupuestosEvento = pgTable(
  "presupuestos_evento",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    nombre: text("nombre").notNull(),
    country: countryEnum("country").notNull(),
    fechaEvento: date("fecha_evento"),
    doc: jsonb("doc").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedBy: uuid("updated_by"),
  },
  (t) => [index("presupuestos_evento_country_idx").on(t.country)],
);

export type PresupuestoEvento = typeof presupuestosEvento.$inferSelect;
export type NewPresupuestoEvento = typeof presupuestosEvento.$inferInsert;
export type Role = (typeof roleEnum.enumValues)[number];
export type Country = (typeof countryEnum.enumValues)[number];
export type PendingStatus = (typeof pendingStatusEnum.enumValues)[number];
