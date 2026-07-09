CREATE TABLE "medios_ingresos" (
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
ALTER TABLE "marca_clientes" ADD COLUMN "tiene_plan_medios" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "medios_ingresos" ADD CONSTRAINT "medios_ingresos_cliente_id_marca_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."marca_clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "medios_ingresos_evento_idx" ON "medios_ingresos" USING btree ("evento_id");