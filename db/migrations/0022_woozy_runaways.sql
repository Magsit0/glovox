CREATE TABLE "inversion_medios_diario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evento_id" text NOT NULL,
	"fecha" date NOT NULL,
	"monto_usd" double precision NOT NULL,
	"nota" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "inversion_medios_techo" (
	"evento_id" text PRIMARY KEY NOT NULL,
	"techo_usd" double precision NOT NULL,
	"nota" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE UNIQUE INDEX "inversion_medios_diario_evento_fecha_idx" ON "inversion_medios_diario" USING btree ("evento_id","fecha");--> statement-breakpoint
CREATE INDEX "inversion_medios_diario_evento_idx" ON "inversion_medios_diario" USING btree ("evento_id");--> statement-breakpoint
CREATE INDEX "inversion_medios_diario_fecha_idx" ON "inversion_medios_diario" USING btree ("fecha");