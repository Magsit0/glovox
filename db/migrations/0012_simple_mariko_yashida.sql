CREATE TABLE "governance_asset_state" (
	"asset_key" text PRIMARY KEY NOT NULL,
	"status_override" text,
	"owner" text,
	"notes" text,
	"tags" text[],
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
