ALTER TABLE "data"."iniciativas_pm_reglas" ADD COLUMN "activa" boolean DEFAULT true NOT NULL;--> statement-breakpoint
-- Segunda regla de «FER Y CAMI | BOOST» (INI003): el mismo boost de Instagram
-- creado con Meta en inglés se llama "Instagram post: …" / "Instagram Post"
-- (40 campañas, US$1.276, ene–nov 2025, misma cuenta y objetivo). La regla
-- compara sin distinguir mayúsculas. Solo si la iniciativa existe y la regla no.
INSERT INTO "data"."iniciativas_pm_reglas" ("iniciativa_id", "plataforma", "account_id", "cuenta", "prefijo")
SELECT 'INI003', 'meta', 'act_551187145315078', 'Glovox', 'Instagram post'
WHERE EXISTS (SELECT 1 FROM "data"."iniciativas_pm" WHERE "id" = 'INI003')
  AND NOT EXISTS (
    SELECT 1 FROM "data"."iniciativas_pm_reglas"
    WHERE "iniciativa_id" = 'INI003' AND lower("prefijo") = 'instagram post'
  );
