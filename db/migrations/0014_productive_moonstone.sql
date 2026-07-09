CREATE TABLE "mesas_vip_clientes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"rut" text NOT NULL,
	"razon_social" text NOT NULL,
	"tipo_cliente" text DEFAULT 'empresa' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mesas_vip_clientes_nombre_unique" UNIQUE("nombre"),
	CONSTRAINT "mesas_vip_clientes_rut_unique" UNIQUE("rut")
);
--> statement-breakpoint
CREATE TABLE "mesas_vip_ingresos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evento_id" text NOT NULL,
	"cliente_id" uuid NOT NULL,
	"rut_cliente" text NOT NULL,
	"cliente" text NOT NULL,
	"monto_neto" double precision NOT NULL,
	"monto_bruto" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mesas_vip_ingresos" ADD CONSTRAINT "mesas_vip_ingresos_cliente_id_mesas_vip_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."mesas_vip_clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mesas_vip_ingresos_evento_idx" ON "mesas_vip_ingresos" USING btree ("evento_id");