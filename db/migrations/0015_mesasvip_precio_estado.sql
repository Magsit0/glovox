ALTER TABLE "mesas_vip_clientes" DROP CONSTRAINT "mesas_vip_clientes_rut_unique";--> statement-breakpoint
ALTER TABLE "mesas_vip_clientes" ALTER COLUMN "rut" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "mesas_vip_clientes" ALTER COLUMN "razon_social" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "mesas_vip_ingresos" ADD COLUMN "precio" double precision NOT NULL;--> statement-breakpoint
ALTER TABLE "mesas_vip_ingresos" ADD COLUMN "estado_pago" text DEFAULT 'pendiente' NOT NULL;--> statement-breakpoint
ALTER TABLE "mesas_vip_ingresos" ALTER COLUMN "rut_cliente" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "mesas_vip_ingresos" DROP COLUMN "monto_neto";--> statement-breakpoint
ALTER TABLE "mesas_vip_ingresos" DROP COLUMN "monto_bruto";