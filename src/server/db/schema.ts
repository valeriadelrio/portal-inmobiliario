import { sql } from "drizzle-orm";
import {
  boolean, check, doublePrecision, index, integer, jsonb, numeric, pgTable, primaryKey,
  text, timestamp, uniqueIndex, uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
const inList = (col: string, vals: readonly string[]) =>
  sql.raw(`${col} in (${vals.map((v) => `'${v}'`).join(",")})`);

export const agency = pgTable(
  "agency",
  {
    id: id(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    status: text("status").notNull().default("pending"),
    logoUrl: text("logo_url"),
    description: text("description"),
    phone: text("phone"),
    email: text("email"),
    website: text("website"),
    address: text("address"),
    licenseNumber: text("license_number"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: uuid("approved_by"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("agency_slug_uq").on(t.slug),
    check("agency_status_ck", inList("status", ["pending", "approved", "suspended", "rejected"])),
  ],
);

/** 1:1 con el usuario de auth (Supabase auth.users). Sin FK para poder correr en Postgres local. */
export const userProfile = pgTable(
  "user_profile",
  {
    id: uuid("id").primaryKey(),
    email: text("email").notNull(),
    fullName: text("full_name"),
    phone: text("phone"),
    locale: text("locale").notNull().default("es"),
    platformRole: text("platform_role"),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("user_profile_email_uq").on(t.email),
    check("user_profile_locale_ck", inList("locale", ["es", "en"])),
    check("user_profile_role_ck", sql`platform_role is null or platform_role = 'platform_admin'`),
  ],
);

export const agencyMember = pgTable(
  "agency_member",
  {
    id: id(),
    agencyId: uuid("agency_id").notNull().references(() => agency.id),
    userId: uuid("user_id").notNull().references(() => userProfile.id),
    role: text("role").notNull().default("agent"),
    status: text("status").notNull().default("invited"),
    bio: text("bio"),
    photoUrl: text("photo_url"),
    publicPhone: text("public_phone"),
    publicWhatsapp: text("public_whatsapp"),
    publicEmail: text("public_email"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("agency_member_agency_user_uq").on(t.agencyId, t.userId),
    // v1: un usuario activo en una sola agencia
    uniqueIndex("agency_member_one_active_uq").on(t.userId).where(sql`status = 'active'`),
    check("agency_member_role_ck", inList("role", ["agent", "agency_admin"])),
    check("agency_member_status_ck", inList("status", ["invited", "active", "removed"])),
  ],
);

export const zone = pgTable(
  "zone",
  {
    id: id(),
    slug: text("slug").notNull(),
    nameEs: text("name_es").notNull(),
    nameEn: text("name_en"),
    parentId: uuid("parent_id"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [uniqueIndex("zone_slug_uq").on(t.slug)],
);

export const property = pgTable(
  "property",
  {
    id: id(),
    agencyId: uuid("agency_id").notNull().references(() => agency.id),
    agentId: uuid("agent_id").notNull().references(() => agencyMember.id),
    operation: text("operation").notNull(),
    type: text("type").notNull(),
    status: text("status").notNull().default("draft"),
    title: text("title").notNull(),
    description: text("description").notNull(),
    language: text("language").notNull().default("es"),
    zoneId: uuid("zone_id").notNull().references(() => zone.id),
    addressText: text("address_text"),
    showExactAddress: boolean("show_exact_address").notNull().default(false),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    price: numeric("price", { precision: 14, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("USD"),
    expenses: numeric("expenses", { precision: 14, scale: 2 }),
    totalAreaM2: numeric("total_area_m2", { precision: 12, scale: 2 }).notNull(),
    coveredAreaM2: numeric("covered_area_m2", { precision: 12, scale: 2 }),
    slug: text("slug").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    statusChangedAt: timestamp("status_changed_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("property_slug_uq").on(t.slug),
    index("property_search_idx").on(t.status, t.operation, t.type, t.zoneId, t.currency, t.price),
    index("property_agency_idx").on(t.agencyId, t.status),
    check("property_operation_ck", inList("operation", ["sale", "rent"])),
    check(
      "property_type_ck",
      inList("type", ["house", "apartment", "ph", "lot", "commercial", "office", "garage"]),
    ),
    check("property_status_ck", inList("status", ["draft", "active", "reserved", "sold_rented", "paused"])),
    check("property_currency_ck", inList("currency", ["USD", "ARS"])),
    check("property_language_ck", inList("language", ["es", "en"])),
    check("property_price_ck", sql`price > 0`),
  ],
);

/** Solo para tipos construidos (no lotes). */
export const propertyBuilding = pgTable("property_building", {
  propertyId: uuid("property_id").primaryKey().references(() => property.id, { onDelete: "cascade" }),
  rooms: integer("rooms").notNull(),
  bedrooms: integer("bedrooms").notNull(),
  bathrooms: integer("bathrooms").notNull(),
  garages: integer("garages").notNull().default(0),
  ageYears: integer("age_years"),
  floor: integer("floor"),
  hasElevator: boolean("has_elevator"),
  furnished: boolean("furnished"),
  amenities: jsonb("amenities").$type<string[]>().notNull().default([]),
});

/** Solo para type = 'lot'. */
export const propertyLot = pgTable("property_lot", {
  propertyId: uuid("property_id").primaryKey().references(() => property.id, { onDelete: "cascade" }),
  frontageM: numeric("frontage_m", { precision: 8, scale: 2 }),
  depthM: numeric("depth_m", { precision: 8, scale: 2 }),
  services: jsonb("services").$type<string[]>().notNull().default([]),
  zoning: text("zoning"),
  isCorner: boolean("is_corner").notNull().default(false),
});

export const propertyPhoto = pgTable(
  "property_photo",
  {
    id: id(),
    propertyId: uuid("property_id").notNull().references(() => property.id, { onDelete: "cascade" }),
    agencyId: uuid("agency_id").notNull().references(() => agency.id),
    storageKey: text("storage_key").notNull(),
    width: integer("width"),
    height: integer("height"),
    position: integer("position").notNull().default(0),
    isCover: boolean("is_cover").notNull().default(false),
    altText: text("alt_text"),
    createdAt: createdAt(),
  },
  (t) => [index("property_photo_order_idx").on(t.propertyId, t.position)],
);

export const inquiry = pgTable(
  "inquiry",
  {
    id: id(),
    propertyId: uuid("property_id").notNull().references(() => property.id),
    agencyId: uuid("agency_id").notNull().references(() => agency.id),
    agentId: uuid("agent_id").notNull().references(() => agencyMember.id),
    userId: uuid("user_id").references(() => userProfile.id),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    message: text("message").notNull(),
    locale: text("locale").notNull().default("es"),
    status: text("status").notNull().default("new"),
    emailSentAt: timestamp("email_sent_at", { withTimezone: true }),
    consentAt: timestamp("consent_at", { withTimezone: true }).notNull(),
    ipHash: text("ip_hash"),
    createdAt: createdAt(),
  },
  (t) => [
    index("inquiry_agency_idx").on(t.agencyId, t.agentId, t.status),
    check("inquiry_status_ck", inList("status", ["new", "read", "answered", "archived"])),
  ],
);

export const favorite = pgTable(
  "favorite",
  {
    userId: uuid("user_id").notNull().references(() => userProfile.id, { onDelete: "cascade" }),
    propertyId: uuid("property_id").notNull().references(() => property.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.propertyId] })],
);

export const auditLog = pgTable("audit_log", {
  id: id(),
  actorId: uuid("actor_id"),
  agencyId: uuid("agency_id"),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: uuid("entity_id"),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});
