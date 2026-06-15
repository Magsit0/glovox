CREATE TYPE "public"."plan_estado" AS ENUM('draft', 'aprobado', 'publicado');--> statement-breakpoint
CREATE TYPE "public"."plan_fase" AS ENUM('A', 'B', 'C');--> statement-breakpoint
CREATE TABLE "ticketing_plan_filas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"categoria" text,
	"etapa" text,
	"tipo_ticket" text NOT NULL,
	"es_variante" boolean DEFAULT false NOT NULL,
	"variante_descuento" text,
	"parent_fila_id" uuid,
	"precio" double precision,
	"stock" integer,
	"precio_override" double precision,
	"volumen_estimado" integer,
	"ingreso_estimado" double precision,
	"proyeccion_meta" jsonb,
	"orden" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticketing_planes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evento_id" text,
	"nombre_evento" text NOT NULL,
	"fecha_evento" date,
	"country" "country" NOT NULL,
	"categoria_evento" text,
	"estado" "plan_estado" DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"descuentos" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cps_pct" double precision DEFAULT 0.15 NOT NULL,
	"rebate_pct" double precision DEFAULT 0.6 NOT NULL,
	"fase" "plan_fase" DEFAULT 'A' NOT NULL,
	"notas" text,
	"published_at" timestamp with time zone,
	"published_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "ticketing_plan_filas" ADD CONSTRAINT "ticketing_plan_filas_plan_id_ticketing_planes_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."ticketing_planes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ticketing_plan_filas_plan_idx" ON "ticketing_plan_filas" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "ticketing_plan_filas_parent_idx" ON "ticketing_plan_filas" USING btree ("parent_fila_id");--> statement-breakpoint
CREATE INDEX "ticketing_planes_evento_idx" ON "ticketing_planes" USING btree ("evento_id");--> statement-breakpoint
CREATE INDEX "ticketing_planes_estado_idx" ON "ticketing_planes" USING btree ("estado");