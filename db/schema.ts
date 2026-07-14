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
    // Estandarización de insumos: liga la fila a un insumo del catálogo
    // (`insumo_id`), conserva el nombre crudo del origen (`insumo_raw`), y guarda
    // las cantidades canónicas (convertidas por `factor_aplicado` según la
    // `unidad_factura`). `estandarizado` marca si la fila ya fue normalizada.
    insumoId: uuid("insumo_id").references(() => insumosCatalogo.id),
    insumoRaw: text("insumo_raw"),
    recibidoCanonico: doublePrecision("recibido_canonico"),
    pedidoCanonico: doublePrecision("pedido_canonico"),
    unidadFactura: text("unidad_factura"),
    factorAplicado: doublePrecision("factor_aplicado"),
    estandarizado: boolean("estandarizado").notNull().default(false),
  },
  (t) => [
    index("compras_insumo_evento_idx").on(t.eventoId),
    index("compras_insumo_insumo_idx").on(t.insumo),
    index("compras_insumo_estandarizado_idx").on(t.estandarizado),
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
  // MEDIOS — marca que además tiene "plan de medios" (ingreso que pasa por la
  // marca pero NO es un fee de auspicio; hoy sólo Heineken y Diageo). Sólo las
  // marcas con este flag aparecen en la matriz del card MEDIOS para imputar
  // ese ingreso aparte. El catálogo de marcas es uno solo (reusa este mismo).
  tienePlanMedios: boolean("tiene_plan_medios").notNull().default(false),
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

// MEDIOS — Ingreso de "plan de medios" por marca imputado manualmente al
// evento (caso Heineken/Diageo). Gemelo de `marca_ingresos` pero en tabla
// aparte porque es un concepto distinto al fee de auspicio. Reusa el catálogo
// `marca_clientes` (sólo las marcas con `tiene_plan_medios = true`). El bruto
// se calcula desde el neto + IVA (19%); snapshot de rut/cliente igual que marcas.
export const mediosIngresos = pgTable(
  "medios_ingresos",
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
  (t) => [index("medios_ingresos_evento_idx").on(t.eventoId)],
);

// MESAS VIP — Cliente que reserva/compra mesas VIP (fila de la matriz). El
// dato viene de un canal informal (planilla en Drive), por eso `rut` y
// `razon_social` son OPCIONALES: muchos clientes son personas sin RUT
// capturado. El identificador de la fila es `nombre` (UNIQUE, normalizado).
// `tipo_cliente` (empresa|natural) sólo afecta el label del formulario.
export const mesasVipClientes = pgTable("mesas_vip_clientes", {
  id: uuid("id").defaultRandom().primaryKey(),
  nombre: text("nombre").notNull().unique(),
  rut: text("rut"),
  razonSocial: text("razon_social"),
  tipoCliente: text("tipo_cliente").notNull().default("empresa"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// MESAS VIP — Venta de mesa(s) por cliente imputada manualmente al evento
// (celda de la matriz). `precio` es el monto BRUTO (IVA incluido) que imputa el
// usuario; neto/IVA se derivan en cliente/servidor (lib/constants/tax.ts) y el
// consumo asociado = 25% del precio (lib/constants/mesasVip.ts) — ninguno se
// persiste. `estado_pago` (pendiente|abono|pagado) es el control de si el
// cliente está al día. Snapshot de rut/cliente para estabilidad histórica.
export const mesasVipIngresos = pgTable(
  "mesas_vip_ingresos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventoId: text("evento_id").notNull(),
    clienteId: uuid("cliente_id")
      .notNull()
      .references(() => mesasVipClientes.id),
    rutCliente: text("rut_cliente"),
    cliente: text("cliente").notNull(),
    precio: doublePrecision("precio").notNull(),
    estadoPago: text("estado_pago").notNull().default("pendiente"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdBy: uuid("created_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("mesas_vip_ingresos_evento_idx").on(t.eventoId)],
);

// CIERRE NEGOCIO — % del cargo por servicio (Punto Ticket) que constituye
// ingreso Glovox ("rebate"), editable por evento desde el cierre de negocio.
// Default 55% cuando no hay fila (lib/constants/rebate.ts). `porcentaje` se
// guarda en puntos porcentuales (55 = 55%). Keyed por EventoID (los primeros
// 6 caracteres de la referencia del negocio, ej. "GLO194").
export const rebateConfig = pgTable("rebate_config", {
  eventoId: text("evento_id").primaryKey(),
  porcentaje: doublePrecision("porcentaje").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdBy: uuid("created_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedBy: uuid("updated_by"),
});

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
export type MediosIngreso = typeof mediosIngresos.$inferSelect;
export type NewMediosIngreso = typeof mediosIngresos.$inferInsert;
export type MesasVipCliente = typeof mesasVipClientes.$inferSelect;
export type NewMesasVipCliente = typeof mesasVipClientes.$inferInsert;
export type MesasVipIngreso = typeof mesasVipIngresos.$inferSelect;
export type NewMesasVipIngreso = typeof mesasVipIngresos.$inferInsert;
export type RebateConfig = typeof rebateConfig.$inferSelect;
export type NewRebateConfig = typeof rebateConfig.$inferInsert;
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

// Un ítem de la agenda: texto + id estable (para reordenar con drag & drop) +
// `done` (marcado como listo/ok). El ORDEN en el array `items` ES la prioridad
// del día.
export interface AgendaItem {
  id: string;
  texto: string;
  done?: boolean;
}

// AGENDA ADMIN — Tablero compartido de tareas por día (/admin/agenda). Herramienta
// operativa interna del panel admin: cada día tiene una lista ordenada de ítems
// (`items` jsonb), reordenables por prioridad. Visible y editable por todos los
// superadmins (no hay scope por usuario). `fecha` es la PK (YYYY-MM-DD) → upsert
// directo por día; `updatedBy` deja rastro de quién editó al final. No alimenta
// ningún dashboard ni BigQuery.
export const adminAgendaNotas = pgTable("admin_agenda_notas", {
  fecha: date("fecha").primaryKey(),
  items: jsonb("items").$type<AgendaItem[]>().notNull().default([]),
  // DEPRECATED (agenda v1, texto libre). El código ya NO la lee ni escribe: se
  // migró a `items` en la migración de backfill. Se mantiene UNA release más
  // (expand/contract) para no romper instancias v1 en vuelo durante el rollout,
  // que sí la consultan. Se elimina con un `DROP COLUMN` en un release POSTERIOR,
  // una vez que el refactor esté 100% desplegado. Ver db/migrations/AGENDA_*_NOTES.md.
  contenido: text("contenido").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedBy: uuid("updated_by"),
});

export type AdminAgendaNota = typeof adminAgendaNotas.$inferSelect;
export type NewAdminAgendaNota = typeof adminAgendaNotas.$inferInsert;

export type Role = (typeof roleEnum.enumValues)[number];
export type Country = (typeof countryEnum.enumValues)[number];
export type PendingStatus = (typeof pendingStatusEnum.enumValues)[number];
