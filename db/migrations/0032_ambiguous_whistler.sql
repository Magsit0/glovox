CREATE TABLE "iniciativas_pm" (
	"id" text PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iniciativas_pm_campanas" (
	"plataforma" text NOT NULL,
	"campaign_id" text NOT NULL,
	"iniciativa_id" text NOT NULL,
	"campaign_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "iniciativas_pm_campanas_plataforma_campaign_id_pk" PRIMARY KEY("plataforma","campaign_id")
);
--> statement-breakpoint
ALTER TABLE "iniciativas_pm_campanas" ADD CONSTRAINT "iniciativas_pm_campanas_iniciativa_id_iniciativas_pm_id_fk" FOREIGN KEY ("iniciativa_id") REFERENCES "public"."iniciativas_pm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "iniciativas_pm_campanas_iniciativa_idx" ON "iniciativas_pm_campanas" USING btree ("iniciativa_id");--> statement-breakpoint
-- Iniciativas iniciales de /inversion-medios (pedido 2026-10-15).
INSERT INTO "iniciativas_pm" ("id", "nombre", "orden") VALUES ('INI001', 'Club Glovox', 1), ('INI002', 'Now Mag', 2) ON CONFLICT ("id") DO NOTHING;
