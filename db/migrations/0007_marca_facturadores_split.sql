-- Split marca_clientes into:
--   marca_facturadores: legal entity (RUT UNIQUE)
--   marca_clientes:     brand (nombre UNIQUE, FK to facturador)
--
-- Backfill: per distinct RUT in current marca_clientes, create one facturador
-- whose razon_social = the nombre of the MOST RECENT cliente with that RUT.
-- All existing marca_clientes rows are kept (linked via facturador_id), but
-- nombre duplicates get a " (N)" suffix because the new UNIQUE(nombre) would
-- otherwise reject the migration.

CREATE TABLE "marca_facturadores" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "rut" text NOT NULL,
  "razon_social" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "marca_facturadores_rut_unique" UNIQUE("rut")
);
--> statement-breakpoint

-- Backfill: 1 facturador por RUT distinto, razon_social = nombre del cliente más reciente.
INSERT INTO "marca_facturadores" (id, rut, razon_social, created_at, created_by, updated_at)
SELECT DISTINCT ON (rut)
  gen_random_uuid(),
  rut,
  nombre,
  created_at,
  created_by,
  updated_at
FROM "marca_clientes"
ORDER BY rut, created_at DESC;
--> statement-breakpoint

ALTER TABLE "marca_clientes" ADD COLUMN "facturador_id" uuid;
--> statement-breakpoint

UPDATE "marca_clientes" mc
SET "facturador_id" = mf.id
FROM "marca_facturadores" mf
WHERE mc.rut = mf.rut;
--> statement-breakpoint

-- Deduplicar nombres antes de imponer UNIQUE(nombre). Por cada nombre repetido,
-- las filas posteriores (orden cronológico) reciben sufijo " (2)", " (3)" ...
UPDATE "marca_clientes" mc
SET nombre = mc.nombre || ' (' || ranked.rn || ')'
FROM (
  SELECT id, nombre, ROW_NUMBER() OVER (PARTITION BY nombre ORDER BY created_at) AS rn
  FROM "marca_clientes"
) ranked
WHERE mc.id = ranked.id AND ranked.rn > 1;
--> statement-breakpoint

ALTER TABLE "marca_clientes" ALTER COLUMN "facturador_id" SET NOT NULL;
--> statement-breakpoint

ALTER TABLE "marca_clientes" ADD CONSTRAINT "marca_clientes_facturador_id_marca_facturadores_id_fk"
  FOREIGN KEY ("facturador_id") REFERENCES "public"."marca_facturadores"("id")
  ON DELETE no action ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "marca_clientes" DROP CONSTRAINT "marca_clientes_rut_unique";
--> statement-breakpoint

ALTER TABLE "marca_clientes" DROP COLUMN "rut";
--> statement-breakpoint

ALTER TABLE "marca_clientes" ADD CONSTRAINT "marca_clientes_nombre_unique" UNIQUE("nombre");
