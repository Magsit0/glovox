CREATE TABLE "data"."inversion_medios_escenario_diario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"escenario_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"plataforma" text NOT NULL,
	"tipo" text DEFAULT '' NOT NULL,
	"monto_usd" double precision NOT NULL,
	"nota" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "data"."inversion_medios_escenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evento_id" text NOT NULL,
	"nombre" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "data"."inversion_medios_escenario_diario" ADD CONSTRAINT "inversion_medios_escenario_diario_escenario_id_inversion_medios_escenarios_id_fk" FOREIGN KEY ("escenario_id") REFERENCES "data"."inversion_medios_escenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inversion_medios_escenario_diario_celda_idx" ON "data"."inversion_medios_escenario_diario" USING btree ("escenario_id","fecha","plataforma","tipo");--> statement-breakpoint
CREATE UNIQUE INDEX "inversion_medios_escenarios_evento_nombre_uq" ON "data"."inversion_medios_escenarios" USING btree ("evento_id",lower("nombre"));