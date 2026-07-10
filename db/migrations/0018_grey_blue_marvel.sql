ALTER TABLE "compras_insumo" ADD COLUMN "insumo_id" uuid;--> statement-breakpoint
ALTER TABLE "compras_insumo" ADD COLUMN "insumo_raw" text;--> statement-breakpoint
ALTER TABLE "compras_insumo" ADD COLUMN "recibido_canonico" double precision;--> statement-breakpoint
ALTER TABLE "compras_insumo" ADD COLUMN "pedido_canonico" double precision;--> statement-breakpoint
ALTER TABLE "compras_insumo" ADD COLUMN "unidad_factura" text;--> statement-breakpoint
ALTER TABLE "compras_insumo" ADD COLUMN "factor_aplicado" double precision;--> statement-breakpoint
ALTER TABLE "compras_insumo" ADD COLUMN "estandarizado" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "compras_insumo" ADD CONSTRAINT "compras_insumo_insumo_id_insumos_catalogo_id_fk" FOREIGN KEY ("insumo_id") REFERENCES "public"."insumos_catalogo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "compras_insumo_estandarizado_idx" ON "compras_insumo" USING btree ("estandarizado");