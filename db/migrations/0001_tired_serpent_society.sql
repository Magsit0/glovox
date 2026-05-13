CREATE TYPE "public"."pending_status" AS ENUM('pending', 'done');--> statement-breakpoint
CREATE TABLE "superadmin_pendings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dashboard_key" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "pending_status" DEFAULT 'pending' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "superadmin_pendings" ADD CONSTRAINT "superadmin_pendings_dashboard_key_dashboards_key_fk" FOREIGN KEY ("dashboard_key") REFERENCES "public"."dashboards"("key") ON DELETE cascade ON UPDATE no action;