import { z } from "zod";
import { CURRENCY, LOCALE, LOT_SERVICES, OPERATION, PROPERTY_TYPE } from "./enums";

const common = {
  operation: z.enum(OPERATION),
  title: z.string().trim().min(5).max(140),
  description: z.string().trim().min(20).max(5000),
  language: z.enum(LOCALE),
  zoneId: z.string().uuid(),
  addressText: z.string().trim().max(200).optional(),
  showExactAddress: z.boolean().default(false),
  price: z.number().positive().max(1_000_000_000),
  currency: z.enum(CURRENCY),
  expenses: z.number().nonnegative().optional(),
  totalAreaM2: z.number().positive().max(10_000_000),
  coveredAreaM2: z.number().positive().optional(),
  whatsapp: z.string().trim().optional(),
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
