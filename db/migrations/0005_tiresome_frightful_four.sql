CREATE TABLE "insumos_catalogo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"grupo" text,
	"ml" integer,
	"marca" text,
	"por_caja" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "insumos_catalogo_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "proveedores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "proveedores_nombre_unique" UNIQUE("nombre")
);
