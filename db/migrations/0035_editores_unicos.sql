CREATE TABLE "data"."editores_unicos" (
	"capacidad" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"asignado_por" uuid,
	"asignado_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "data"."editores_unicos" ADD CONSTRAINT "editores_unicos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "data"."users"("id") ON DELETE cascade ON UPDATE no action;