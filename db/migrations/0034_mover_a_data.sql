-- Separa las tablas EXCLUSIVAS de glovox-data en su propio schema `data`.
-- `ALTER ... SET SCHEMA` solo cambia la etiqueta: no copia datos, y los
-- índices, FKs, defaults y secuencias de cada tabla viajan con ella.
-- Quedan en `public` las 3 COMPARTIDAS con glovox-operaciones (compras_insumo,
-- proveedores, insumos_catalogo); `ops` (operaciones) no se toca.
CREATE SCHEMA IF NOT EXISTS "data";
--> statement-breakpoint
ALTER TYPE "public"."country" SET SCHEMA "data";
--> statement-breakpoint
ALTER TYPE "public"."pending_status" SET SCHEMA "data";
--> statement-breakpoint
ALTER TYPE "public"."user_role" SET SCHEMA "data";
--> statement-breakpoint
ALTER TABLE "public"."admin_agenda_notas" SET SCHEMA "data";
--> statement-breakpoint
ALTER TABLE "public"."audit_log" SET SCHEMA "data";
--> statement-breakpoint
ALTER TABLE "public"."cargos_extra_pm" SET SCHEMA "data";
--> statement-breakpoint
ALTER TABLE "public"."dashboard_access_log" SET SCHEMA "data";
--> statement-breakpoint
ALTER TABLE "public"."dashboards" SET SCHEMA "data";
--> statement-breakpoint
ALTER TABLE "public"."governance_asset_state" SET SCHEMA "data";
--> statement-breakpoint
ALTER TABLE "public"."iniciativas_pm" SET SCHEMA "data";
--> statement-breakpoint
ALTER TABLE "public"."iniciativas_pm_campanas" SET SCHEMA "data";
--> statement-breakpoint
ALTER TABLE "public"."inversion_medios_diario" SET SCHEMA "data";
--> statement-breakpoint
ALTER TABLE "public"."inversion_medios_etapas" SET SCHEMA "data";
--> statement-breakpoint
ALTER TABLE "public"."marca_clientes" SET SCHEMA "data";
--> statement-breakpoint
ALTER TABLE "public"."marca_facturadores" SET SCHEMA "data";
--> statement-breakpoint
ALTER TABLE "public"."marca_ingresos" SET SCHEMA "data";
--> statement-breakpoint
ALTER TABLE "public"."medios_ingresos" SET SCHEMA "data";
--> statement-breakpoint
ALTER TABLE "public"."mesas_vip_clientes" SET SCHEMA "data";
--> statement-breakpoint
ALTER TABLE "public"."mesas_vip_ingresos" SET SCHEMA "data";
--> statement-breakpoint
ALTER TABLE "public"."negocio_variable_envio" SET SCHEMA "data";
--> statement-breakpoint
ALTER TABLE "public"."presupuestos_evento" SET SCHEMA "data";
--> statement-breakpoint
ALTER TABLE "public"."producto_ingresos" SET SCHEMA "data";
--> statement-breakpoint
ALTER TABLE "public"."rebate_config" SET SCHEMA "data";
--> statement-breakpoint
ALTER TABLE "public"."superadmin_pendings" SET SCHEMA "data";
--> statement-breakpoint
ALTER TABLE "public"."ticketing_planes" SET SCHEMA "data";
--> statement-breakpoint
ALTER TABLE "public"."ticketing_sponsors" SET SCHEMA "data";
--> statement-breakpoint
ALTER TABLE "public"."user_dashboard_access" SET SCHEMA "data";
--> statement-breakpoint
ALTER TABLE "public"."users" SET SCHEMA "data";
