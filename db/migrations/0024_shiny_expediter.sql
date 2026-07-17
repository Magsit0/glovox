DROP INDEX "inversion_medios_diario_evento_fecha_idx";--> statement-breakpoint
ALTER TABLE "inversion_medios_diario" ADD COLUMN "plataforma" text;--> statement-breakpoint
UPDATE "inversion_medios_diario" SET "plataforma" = 'meta' WHERE "plataforma" IS NULL;--> statement-breakpoint
ALTER TABLE "inversion_medios_diario" ALTER COLUMN "plataforma" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "inversion_medios_diario_evento_fecha_plat_idx" ON "inversion_medios_diario" USING btree ("evento_id","fecha","plataforma");