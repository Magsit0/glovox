CREATE TABLE "producto_ingresos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evento_id" text NOT NULL,
	"cliente_id" uuid NOT NULL,
	"rut_cliente" text NOT NULL,
	"cliente" text NOT NULL,
	"precio" double precision NOT NULL,
	"exento" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "marca_clientes" ADD COLUMN "tiene_plan_producto" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "producto_ingresos" ADD CONSTRAINT "producto_ingresos_cliente_id_marca_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."marca_clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "producto_ingresos_evento_idx" ON "producto_ingresos" USING btree ("evento_id");