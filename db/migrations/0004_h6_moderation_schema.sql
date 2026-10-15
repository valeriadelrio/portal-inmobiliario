CREATE TABLE "property_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"message" text,
	"reporter_email" text,
	"user_id" uuid,
	"ip_hash" text,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"resolution_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "property_report_reason_ck" CHECK (reason in ('fake','duplicate','wrong_info','inappropriate','sold','other')),
	CONSTRAINT "property_report_status_ck" CHECK (status in ('open','dismissed','actioned')),
	CONSTRAINT "property_report_message_ck" CHECK (message is null or char_length(message) <= 1000)
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "detail" text;--> statement-breakpoint
ALTER TABLE "property" ADD COLUMN "moderation_status" text DEFAULT 'ok' NOT NULL;--> statement-breakpoint
ALTER TABLE "property" ADD COLUMN "moderation_reason" text;--> statement-breakpoint
ALTER TABLE "property" ADD COLUMN "moderated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "property" ADD COLUMN "moderated_by" uuid;--> statement-breakpoint
ALTER TABLE "property_report" ADD CONSTRAINT "property_report_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_report" ADD CONSTRAINT "property_report_user_id_user_profile_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profile"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "property_report_status_idx" ON "property_report" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "property_report_property_idx" ON "property_report" USING btree ("property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "property_report_open_uq" ON "property_report" USING btree ("property_id","ip_hash") WHERE status = 'open';--> statement-breakpoint
ALTER TABLE "property" ADD CONSTRAINT "property_moderation_ck" CHECK (moderation_status in ('ok','hidden'));