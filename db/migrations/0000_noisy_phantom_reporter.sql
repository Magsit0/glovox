CREATE TYPE "public"."country" AS ENUM('CL', 'PE');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('superadmin', 'user');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"target_user_id" uuid,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dashboards" (
	"key" text PRIMARY KEY NOT NULL,
	"path_prefix" text NOT NULL,
	"label" text NOT NULL,
	"applies_country_scope" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "dashboards_path_prefix_unique" UNIQUE("path_prefix")
);
--> statement-breakpoint
CREATE TABLE "user_dashboard_access" (
	"user_id" uuid NOT NULL,
	"dashboard_key" text NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"granted_by" uuid,
	CONSTRAINT "user_dashboard_access_user_id_dashboard_key_pk" PRIMARY KEY("user_id","dashboard_key")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"country" "country",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "user_dashboard_access" ADD CONSTRAINT "user_dashboard_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_dashboard_access" ADD CONSTRAINT "user_dashboard_access_dashboard_key_dashboards_key_fk" FOREIGN KEY ("dashboard_key") REFERENCES "public"."dashboards"("key") ON DELETE cascade ON UPDATE no action;