CREATE TABLE "dashboard_access_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"dashboard_key" text NOT NULL,
	"path" text NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dashboard_access_log" ADD CONSTRAINT "dashboard_access_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_access_log" ADD CONSTRAINT "dashboard_access_log_dashboard_key_dashboards_key_fk" FOREIGN KEY ("dashboard_key") REFERENCES "public"."dashboards"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dash_access_user_idx" ON "dashboard_access_log" USING btree ("user_id","accessed_at");--> statement-breakpoint
CREATE INDEX "dash_access_dashboard_idx" ON "dashboard_access_log" USING btree ("dashboard_key","accessed_at");