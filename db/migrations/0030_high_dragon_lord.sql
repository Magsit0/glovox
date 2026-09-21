CREATE TABLE "negocio_variable_envio" (
	"negocio_id" text PRIMARY KEY NOT NULL,
	"enviado" boolean DEFAULT true NOT NULL,
	"marcado_por" uuid,
	"marcado_at" timestamp with time zone DEFAULT now() NOT NULL
);
