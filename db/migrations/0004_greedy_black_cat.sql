CREATE TABLE "compras_insumo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evento_id" text,
	"insumo" text NOT NULL,
	"numero_factura" text,
	"proveedor" text,
	"fecha_compra" date,
	"n_pallets" integer,
	"n_display" integer,
	"x_display" integer,
	"sueltas" integer,
	"recibido" integer,
	"pedido" integer,
	"tipo_operacion" text DEFAULT 'ingreso' NOT NULL,
	"lugar" text,
	"obs" text,
	"costo_unitario" double precision,
	"costo_neto" double precision,
	"iva" double precision,
	"bruto" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE INDEX "compras_insumo_evento_idx" ON "compras_insumo" USING btree ("evento_id");--> statement-breakpoint
CREATE INDEX "compras_insumo_insumo_idx" ON "compras_insumo" USING btree ("insumo");