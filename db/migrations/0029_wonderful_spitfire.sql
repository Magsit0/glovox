DROP INDEX "inversion_medios_diario_evento_fecha_plat_idx";--> statement-breakpoint
ALTER TABLE "inversion_medios_diario" ADD COLUMN "tipo" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "inversion_medios_diario_evento_fecha_plat_tipo_idx" ON "inversion_medios_diario" USING btree ("evento_id","fecha","plataforma","tipo");