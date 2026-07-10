CREATE TABLE "rebate_config" (
	"evento_id" text PRIMARY KEY NOT NULL,
	"porcentaje" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
