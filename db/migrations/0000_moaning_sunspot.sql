CREATE TABLE "agency" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"logo_url" text,
	"description" text,
	"phone" text,
	"email" text,
	"website" text,
	"address" text,
	"license_number" text,
	"approved_at" timestamp with time zone,
	"approved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agency_status_ck" CHECK (status in ('pending','approved','suspended','rejected'))
);
--> statement-breakpoint
CREATE TABLE "agency_member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'agent' NOT NULL,
	"status" text DEFAULT 'invited' NOT NULL,
	"bio" text,
	"photo_url" text,
	"public_phone" text,
	"public_whatsapp" text,
	"public_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agency_member_role_ck" CHECK (role in ('agent','agency_admin')),
	CONSTRAINT "agency_member_status_ck" CHECK (status in ('invited','active','removed'))
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"agency_id" uuid,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" uuid,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorite" (
	"user_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorite_user_id_property_id_pk" PRIMARY KEY("user_id","property_id")
);
--> statement-breakpoint
CREATE TABLE "inquiry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"agency_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"message" text NOT NULL,
	"locale" text DEFAULT 'es' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"email_sent_at" timestamp with time zone,
	"consent_at" timestamp with time zone NOT NULL,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inquiry_status_ck" CHECK (status in ('new','read','answered','archived'))
);
--> statement-breakpoint
CREATE TABLE "property" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"operation" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"language" text DEFAULT 'es' NOT NULL,
	"zone_id" uuid NOT NULL,
	"address_text" text,
	"show_exact_address" boolean DEFAULT false NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"price" numeric(14, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"expenses" numeric(14, 2),
	"total_area_m2" numeric(12, 2) NOT NULL,
	"covered_area_m2" numeric(12, 2),
	"slug" text NOT NULL,
	"published_at" timestamp with time zone,
	"status_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "property_operation_ck" CHECK (operation in ('sale','rent')),
	CONSTRAINT "property_type_ck" CHECK (type in ('house','apartment','ph','lot','commercial','office','garage')),
	CONSTRAINT "property_status_ck" CHECK (status in ('draft','active','reserved','sold_rented','paused')),
	CONSTRAINT "property_currency_ck" CHECK (currency in ('USD','ARS')),
	CONSTRAINT "property_language_ck" CHECK (language in ('es','en')),
	CONSTRAINT "property_price_ck" CHECK (price > 0)
);
--> statement-breakpoint
CREATE TABLE "property_building" (
	"property_id" uuid PRIMARY KEY NOT NULL,
	"rooms" integer NOT NULL,
	"bedrooms" integer NOT NULL,
	"bathrooms" integer NOT NULL,
	"garages" integer DEFAULT 0 NOT NULL,
	"age_years" integer,
	"floor" integer,
	"has_elevator" boolean,
	"furnished" boolean,
	"amenities" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_lot" (
	"property_id" uuid PRIMARY KEY NOT NULL,
	"frontage_m" numeric(8, 2),
	"depth_m" numeric(8, 2),
	"services" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"zoning" text,
	"is_corner" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_photo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"agency_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"width" integer,
	"height" integer,
	"position" integer DEFAULT 0 NOT NULL,
	"is_cover" boolean DEFAULT false NOT NULL,
	"alt_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profile" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"full_name" text,
	"phone" text,
	"locale" text DEFAULT 'es' NOT NULL,
	"platform_role" text,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_profile_locale_ck" CHECK (locale in ('es','en')),
	CONSTRAINT "user_profile_role_ck" CHECK (platform_role is null or platform_role = 'platform_admin')
);
--> statement-breakpoint
CREATE TABLE "zone" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name_es" text NOT NULL,
	"name_en" text,
	"parent_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agency_member" ADD CONSTRAINT "agency_member_agency_id_agency_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agency"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_member" ADD CONSTRAINT "agency_member_user_id_user_profile_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite" ADD CONSTRAINT "favorite_user_id_user_profile_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite" ADD CONSTRAINT "favorite_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry" ADD CONSTRAINT "inquiry_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry" ADD CONSTRAINT "inquiry_agency_id_agency_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agency"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry" ADD CONSTRAINT "inquiry_agent_id_agency_member_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agency_member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry" ADD CONSTRAINT "inquiry_user_id_user_profile_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property" ADD CONSTRAINT "property_agency_id_agency_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agency"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property" ADD CONSTRAINT "property_agent_id_agency_member_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agency_member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property" ADD CONSTRAINT "property_zone_id_zone_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zone"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_building" ADD CONSTRAINT "property_building_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_lot" ADD CONSTRAINT "property_lot_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_photo" ADD CONSTRAINT "property_photo_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_photo" ADD CONSTRAINT "property_photo_agency_id_agency_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agency"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agency_slug_uq" ON "agency" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "agency_member_agency_user_uq" ON "agency_member" USING btree ("agency_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agency_member_one_active_uq" ON "agency_member" USING btree ("user_id") WHERE status = 'active';--> statement-breakpoint
CREATE INDEX "inquiry_agency_idx" ON "inquiry" USING btree ("agency_id","agent_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "property_slug_uq" ON "property" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "property_search_idx" ON "property" USING btree ("status","operation","type","zone_id","currency","price");--> statement-breakpoint
CREATE INDEX "property_agency_idx" ON "property" USING btree ("agency_id","status");--> statement-breakpoint
CREATE INDEX "property_photo_order_idx" ON "property_photo" USING btree ("property_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "user_profile_email_uq" ON "user_profile" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "zone_slug_uq" ON "zone" USING btree ("slug");