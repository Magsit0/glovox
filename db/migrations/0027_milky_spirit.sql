CREATE TABLE "inversion_medios_etapas" (
	"evento_id" text PRIMARY KEY NOT NULL,
	"etapas" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
