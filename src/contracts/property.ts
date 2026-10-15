import { z } from "zod";
import { CURRENCY, LOCALE, LOT_SERVICES, OPERATION, PROPERTY_STATUS, PROPERTY_TYPE, type PropertyStatus } from "./enums";

const common = {
  operation: z.enum(OPERATION),
  title: z.string().trim().min(5).max(140),
  description: z.string().trim().min(20).max(5000),
  language: z.enum(LOCALE),
  zoneId: z.string().uuid(),
  addressText: z.string().trim().max(200).optional(),
  showExactAddress: z.boolean().default(false),
  price: z.number().positive().max(1_000_000_000_000),
  currency: z.enum(CURRENCY),
  expenses: z.number().nonnegative().optional(),
  totalAreaM2: z.number().positive().max(10_000_000),
  coveredAreaM2: z.number().positive().optional(),
};

const buildingDetails = {
  rooms: z.number().int().min(0).max(50),
  bedrooms: z.number().int().min(0).max(50),
  bathrooms: z.number().int().min(0).max(50),
  garages: z.number().int().min(0).max(50).default(0),
  ageYears: z.number().int().min(0).max(300).optional(),
  floor: z.number().int().optional(),
  hasElevator: z.boolean().optional(),
  furnished: z.boolean().optional(),
  amenities: z.array(z.string()).default([]),
};

const building = <T extends Exclude<(typeof PROPERTY_TYPE)[number], "lot">>(type: T) =>
  z.object({ ...common, type: z.literal(type), ...buildingDetails });

export const lotPropertyInput = z.object({
  ...common,
  type: z.literal("lot"),
  frontageM: z.number().positive().optional(),
  depthM: z.number().positive().optional(),
  services: z.array(z.enum(LOT_SERVICES)).default([]),
  zoning: z.string().trim().max(100).optional(),
  isCorner: z.boolean().default(false),
});

/** Un lote no admite ambientes/baños; una edificación no admite frente/fondo. */
export const propertyInput = z.discriminatedUnion("type", [
  lotPropertyInput,
  building("house"),
  building("apartment"),
  building("ph"),
  building("commercial"),
  building("office"),
  building("garage"),
]);

export type PropertyInput = z.infer<typeof propertyInput>;

/** Mínimos para pasar de borrador a activa. */
export const MIN_PHOTOS_TO_PUBLISH = 3;

/** Edición = mismo esquema completo. El tipo es inmutable (lo exige la base; el servicio lo compara). */
export const updatePropertyInput = propertyInput;

/** Debe coincidir con property_guard (db/migrations/0003). El admin de plataforma puede saltarse esta tabla. */
export const PROPERTY_TRANSITIONS: Record<PropertyStatus, readonly PropertyStatus[]> = {
  draft: ["active"],
  active: ["reserved", "sold_rented", "paused"],
  reserved: ["active", "sold_rented", "paused"],
  sold_rented: ["active", "paused"],
  paused: ["active"],
};
export const canTransition = (from: PropertyStatus, to: PropertyStatus) => PROPERTY_TRANSITIONS[from].includes(to);

export const changeStatusInput = z.object({
  propertyId: z.string().uuid(),
  status: z.enum(PROPERTY_STATUS),
});

export type PublishContext = { readyPhotos: number; hasCover: boolean; zoneActive: boolean; agencyApproved: boolean };
export type PublishBlocker = "min_photos" | "no_cover" | "zone_inactive" | "agency_not_approved";

/** Versión para mostrar en pantalla; la regla definitiva la aplica el trigger de la base. */
export function getPublishBlockers(ctx: PublishContext): PublishBlocker[] {
  const out: PublishBlocker[] = [];
  if (ctx.readyPhotos < MIN_PHOTOS_TO_PUBLISH) out.push("min_photos");
  if (!ctx.hasCover) out.push("no_cover");
  if (!ctx.zoneActive) out.push("zone_inactive");
  if (!ctx.agencyApproved) out.push("agency_not_approved");
  return out;
}

/** Drizzle devuelve numeric como string; los DTO exponen number. */
export const toNumber = (v: string | number | null | undefined): number | null =>
  v === null || v === undefined ? null : Number(v);

export type PropertyListItemDto = {
  id: string; slug: string; title: string; operation: string; type: string; status: string;
  price: number; currency: string; zoneId: string; zoneName: string; agentId: string; coverKey: string | null; updatedAt: string;
  totalAreaM2: number; bedrooms: number | null; bathrooms: number | null; photoCount: number;
  /** "hidden": la plataforma la sacó del sitio público (el motivo lo ve la inmobiliaria). */
  moderationStatus: string; moderationReason: string | null;
};
