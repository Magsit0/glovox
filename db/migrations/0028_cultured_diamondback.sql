CREATE TABLE "cargos_extra_pm" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proveedor" text NOT NULL,
	"detalle" text,
	"metodo" text NOT NULL,
	"monto_usd" double precision NOT NULL,
	"dia_pago" text,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
