CREATE TABLE "admin_agenda_notas" (
	"fecha" date PRIMARY KEY NOT NULL,
	"contenido" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
