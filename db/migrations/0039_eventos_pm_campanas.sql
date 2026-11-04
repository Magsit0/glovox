CREATE TABLE "data"."eventos_pm_campanas" (
	"plataforma" text NOT NULL,
	"campaign_id" text NOT NULL,
	"evento_id" text NOT NULL,
	"campaign_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "eventos_pm_campanas_plataforma_campaign_id_pk" PRIMARY KEY("plataforma","campaign_id")
);
--> statement-breakpoint
CREATE INDEX "eventos_pm_campanas_evento_idx" ON "data"."eventos_pm_campanas" USING btree ("evento_id");