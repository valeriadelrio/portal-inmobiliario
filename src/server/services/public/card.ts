import { sql } from "drizzle-orm";
import type { PublicCardDto } from "@/contracts";
import { agency, property, propertyBuilding, propertyPhoto, zone } from "@/server/db/schema";

/** Columnas de una tarjeta pública. Requiere joins a zone, agency, property_building y property_photo (portada). */
export const cardColumns = {
  id: property.id, slug: property.slug, title: property.title, operation: property.operation, type: property.type,
  status: property.status, price: property.price, currency: property.currency, zoneName: zone.nameEs, zoneNameEn: zone.nameEn,
  totalAreaM2: property.totalAreaM2, bedrooms: propertyBuilding.bedrooms, bathrooms: propertyBuilding.bathrooms,
  coverKey: propertyPhoto.storageKey, agencyName: agency.name, agencySlug: agency.slug,
  photoCount: sql<number>`(select count(*) from property_photo ph where ph.property_id = ${property.id} and ph.status = 'ready')`,
};

export const toCard = (r: { price: string; totalAreaM2: string; photoCount: number; coverKey: string | null } & Omit<PublicCardDto, "price" | "totalAreaM2" | "photoCount" | "coverKey">): PublicCardDto => ({
  ...r, price: Number(r.price), totalAreaM2: Number(r.totalAreaM2), photoCount: Number(r.photoCount), coverKey: r.coverKey ?? null,
});
