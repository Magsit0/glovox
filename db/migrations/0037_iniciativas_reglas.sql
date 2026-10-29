CREATE TABLE "data"."iniciativas_pm_reglas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iniciativa_id" text NOT NULL,
	"plataforma" text NOT NULL,
	"account_id" text NOT NULL,
	"cuenta" text NOT NULL,
	"prefijo" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "data"."iniciativas_pm_reglas" ADD CONSTRAINT "iniciativas_pm_reglas_iniciativa_id_iniciativas_pm_id_fk" FOREIGN KEY ("iniciativa_id") REFERENCES "data"."iniciativas_pm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "iniciativas_pm_reglas_iniciativa_idx" ON "data"."iniciativas_pm_reglas" USING btree ("iniciativa_id");--> statement-breakpoint
-- Regla de «FER Y CAMI | BOOST» (INI003, creada desde la app el 2026-10-27): los
-- boosts de Instagram de la cuenta Meta Glovox, que Meta nombra
-- "Publicación de Instagram: …". Pedido 2026-10-29 (toda la historia). Solo si
-- la iniciativa existe: en una base nueva INI003 no está y la FK fallaría.
INSERT INTO "data"."iniciativas_pm_reglas" ("iniciativa_id", "plataforma", "account_id", "cuenta", "prefijo")
SELECT 'INI003', 'meta', 'act_551187145315078', 'Glovox', 'Publicación de Instagram'
WHERE EXISTS (SELECT 1 FROM "data"."iniciativas_pm" WHERE "id" = 'INI003');
