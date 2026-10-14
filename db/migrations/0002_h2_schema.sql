CREATE TABLE "agency_invitation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'agent' NOT NULL,
	"token_hash" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"invited_by" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_by" uuid,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agency_invitation_email_ck" CHECK (email = lower(email)),
	CONSTRAINT "agency_invitation_role_ck" CHECK (role in ('agent','agency_admin')),
	CONSTRAINT "agency_invitation_status_ck" CHECK (status in ('pending','accepted','revoked'))
);
--> statement-breakpoint
ALTER TABLE "agency" ADD COLUMN "status_reason" text;--> statement-breakpoint
ALTER TABLE "agency_member" ADD COLUMN "display_name" text;--> statement-breakpoint
ALTER TABLE "property_photo" ADD COLUMN "status" text DEFAULT 'ready' NOT NULL;--> statement-breakpoint
ALTER TABLE "agency_invitation" ADD CONSTRAINT "agency_invitation_agency_id_agency_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agency"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_invitation" ADD CONSTRAINT "agency_invitation_invited_by_user_profile_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_invitation" ADD CONSTRAINT "agency_invitation_accepted_by_user_profile_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."user_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agency_invitation_token_uq" ON "agency_invitation" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "agency_invitation_pending_uq" ON "agency_invitation" USING btree ("agency_id","email") WHERE status = 'pending';--> statement-breakpoint
ALTER TABLE "zone" ADD CONSTRAINT "zone_parent_id_zone_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."zone"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "property_photo_one_cover_uq" ON "property_photo" USING btree ("property_id") WHERE is_cover;--> statement-breakpoint
ALTER TABLE "agency" ADD CONSTRAINT "agency_slug_ck" CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');--> statement-breakpoint
ALTER TABLE "property" ADD CONSTRAINT "property_slug_ck" CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');--> statement-breakpoint
ALTER TABLE "property" ADD CONSTRAINT "property_covered_ck" CHECK (covered_area_m2 is null or covered_area_m2 <= total_area_m2);--> statement-breakpoint
ALTER TABLE "property_photo" ADD CONSTRAINT "property_photo_status_ck" CHECK (status in ('pending','ready'));--> statement-breakpoint
ALTER TABLE "zone" ADD CONSTRAINT "zone_slug_ck" CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');--> statement-breakpoint
ALTER TABLE "zone" ADD CONSTRAINT "zone_parent_ck" CHECK (parent_id is null or parent_id <> id);