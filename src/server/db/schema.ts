import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean, check, doublePrecision, index, integer, jsonb, numeric, pgTable,
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
    statusReason: text("status_reason"),
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
    check("agency_slug_ck", sql`slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
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
    displayName: text("display_name"),
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

export const agencyInvitation = pgTable(
  "agency_invitation",
  {
    id: id(),
    agencyId: uuid("agency_id").notNull().references(() => agency.id),
    email: text("email").notNull(),
    role: text("role").notNull().default("agent"),
    /** sha256 del token; el token crudo nunca se guarda. */
    tokenHash: text("token_hash").notNull(),
    status: text("status").notNull().default("pending"),
    invitedBy: uuid("invited_by").notNull().references(() => userProfile.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedBy: uuid("accepted_by").references(() => userProfile.id),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("agency_invitation_token_uq").on(t.tokenHash),
    uniqueIndex("agency_invitation_pending_uq").on(t.agencyId, t.email).where(sql`status = 'pending'`),
    check("agency_invitation_email_ck", sql`email = lower(email)`),
    check("agency_invitation_role_ck", inList("role", ["agent", "agency_admin"])),
    check("agency_invitation_status_ck", inList("status", ["pending", "accepted", "revoked"])),
  ],
);

export const zone = pgTable(
  "zone",
  {
    id: id(),
    slug: text("slug").notNull(),
    nameEs: text("name_es").notNull(),
    nameEn: text("name_en"),
    parentId: uuid("parent_id").references((): AnyPgColumn => zone.id),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [
    uniqueIndex("zone_slug_uq").on(t.slug),
    check("zone_slug_ck", sql`slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    check("zone_parent_ck", sql`parent_id is null or parent_id <> id`),
  ],
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
    /** Moderación de la plataforma: 'hidden' la saca del sitio público sin tocar el estado que le puso la inmobiliaria. */
    moderationStatus: text("moderation_status").notNull().default("ok"),
    moderationReason: text("moderation_reason"),
    moderatedAt: timestamp("moderated_at", { withTimezone: true }),
    moderatedBy: uuid("moderated_by"),
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
    check("property_moderation_ck", inList("moderation_status", ["ok", "hidden"])),
    check("property_currency_ck", inList("currency", ["USD", "ARS"])),
    check("property_language_ck", inList("language", ["es", "en"])),
    check("property_price_ck", sql`price > 0`),
    check("property_slug_ck", sql`slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
    check("property_covered_ck", sql`covered_area_m2 is null or covered_area_m2 <= total_area_m2`),
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
    status: text("status").notNull().default("ready"),
    createdAt: createdAt(),
  },
  (t) => [
    index("property_photo_order_idx").on(t.propertyId, t.position),
    uniqueIndex("property_photo_one_cover_uq").on(t.propertyId).where(sql`is_cover`),
    check("property_photo_status_ck", inList("status", ["pending", "ready"])),
  ],
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

export const auditLog = pgTable("audit_log", {
  id: id(),
  actorId: uuid("actor_id"),
  agencyId: uuid("agency_id"),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: uuid("entity_id"),
  /** Dato de contexto corto (motivo, estado anterior…). Nunca datos personales de visitantes. */
  detail: text("detail"),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});

/** Denuncias de visitantes sobre una publicación. Las resuelve la administración de la plataforma. */
export const propertyReport = pgTable(
  "property_report",
  {
    id: id(),
    propertyId: uuid("property_id").notNull().references(() => property.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    message: text("message"),
    reporterEmail: text("reporter_email"),
    userId: uuid("user_id").references(() => userProfile.id, { onDelete: "set null" }),
    ipHash: text("ip_hash"),
    status: text("status").notNull().default("open"),
    resolvedBy: uuid("resolved_by"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolutionNote: text("resolution_note"),
    createdAt: createdAt(),
  },
  (t) => [
    index("property_report_status_idx").on(t.status, t.createdAt),
    index("property_report_property_idx").on(t.propertyId),
    // una persona (por huella de IP) no repite una denuncia abierta sobre la misma ficha
    uniqueIndex("property_report_open_uq").on(t.propertyId, t.ipHash).where(sql`status = 'open'`),
    check("property_report_reason_ck", inList("reason", ["fake", "duplicate", "wrong_info", "inappropriate", "sold", "other"])),
    check("property_report_status_ck", inList("status", ["open", "dismissed", "actioned"])),
    check("property_report_message_ck", sql`message is null or char_length(message) <= 1000`),
  ],
);
