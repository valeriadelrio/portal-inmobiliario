import { and, asc, count, desc, eq, gte, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import {
  PUBLIC_PAGE_SIZE, fail, mapDbError, ok, toNumber,
  type PublicCardDto, type PublicPropertyDto, type SearchFilters, type ServiceResult,
} from "@/contracts";
import { cardColumns, toCard } from "./card";
import { withActor } from "@/server/db/with-actor";
import { agency, agencyMember, property, propertyBuilding, propertyLot, propertyPhoto, zone } from "@/server/db/schema";

// H3. Lecturas PÚBLICAS: se ejecutan como visitante anónimo, así que la base (RLS) decide qué es visible:
// solo estados activa/reservada/vendida-alquilada de inmobiliarias aprobadas, y solo fotos listas.

const ANON = { kind: "anonymous" } as const;
const iso = (d: Date | null) => (d ? d.toISOString() : null);

const zoneParent = zone; // alias legible

/** IDs de zona que corresponden a los slugs pedidos, incluyendo las subzonas de una zona padre. */
const zoneIdsFor = (slugs: string[]) => sql`(
  select z.id from zone z where z.slug in (${sql.join(slugs.map((s) => sql`${s}`), sql`, `)})
  union select c.id from zone c join zone p on p.id = c.parent_id where p.slug in (${sql.join(slugs.map((s) => sql`${s}`), sql`, `)})
)`;

export async function searchProperties(
  f: SearchFilters,
): Promise<ServiceResult<{ items: PublicCardDto[]; total: number; page: number; pageSize: number }>> {
  const page = Math.max(1, f.page);
  const hasPrice = f.minPrice !== undefined || f.maxPrice !== undefined;
  // Ordenar por precio mezclando monedas no tiene sentido: se compara solo dentro de una moneda (USD por defecto).
  const currency = f.currency ?? (hasPrice || f.sort !== "recent" ? "USD" : undefined);

  const where: SQL[] = [];
  if (f.op) where.push(eq(property.operation, f.op));
  if (f.agency) where.push(eq(agency.slug, f.agency));
  if (f.type?.length) where.push(inArray(property.type, f.type));
  if (f.zone?.length) where.push(sql`${property.zoneId} in ${zoneIdsFor(f.zone)}`);
  if (currency) where.push(eq(property.currency, currency));
  if (f.minPrice !== undefined) where.push(gte(property.price, String(f.minPrice)));
  if (f.maxPrice !== undefined) where.push(lte(property.price, String(f.maxPrice)));
  if (f.minArea !== undefined) where.push(gte(property.totalAreaM2, String(f.minArea)));
  if (f.maxArea !== undefined) where.push(lte(property.totalAreaM2, String(f.maxArea)));
  if (f.minRooms !== undefined) where.push(gte(propertyBuilding.rooms, f.minRooms)); // los lotes no tienen ambientes: quedan fuera

  const order = [
    sql`case when ${property.status} = 'active' then 0 else 1 end`, // las vendidas/alquiladas van al final
    f.sort === "price_asc" ? asc(property.price) : f.sort === "price_desc" ? desc(property.price) : sql`${property.publishedAt} desc nulls last`,
    desc(property.id),
  ];

  try {
    return await withActor(ANON, async (tx) => {
      const base = tx.select({ total: count() }).from(property)
        .innerJoin(agency, eq(agency.id, property.agencyId))
        .leftJoin(propertyBuilding, eq(propertyBuilding.propertyId, property.id));
      const [{ total }] = await (where.length ? base.where(and(...where)) : base);
      const rows = await tx.select(cardColumns).from(property)
        .innerJoin(zone, eq(zone.id, property.zoneId))
        .innerJoin(agency, eq(agency.id, property.agencyId))
        .leftJoin(propertyBuilding, eq(propertyBuilding.propertyId, property.id))
        .leftJoin(propertyPhoto, and(eq(propertyPhoto.propertyId, property.id), eq(propertyPhoto.isCover, true), eq(propertyPhoto.status, "ready")))
        .where(where.length ? and(...where) : undefined)
        .orderBy(...order).limit(PUBLIC_PAGE_SIZE).offset((page - 1) * PUBLIC_PAGE_SIZE);
      return ok({
        total: Number(total), page, pageSize: PUBLIC_PAGE_SIZE,
        items: rows.map(toCard),
      });
    });
  } catch (e) {
    return mapDbError(e);
  }
}

/** Ficha pública por slug. `ok(null)` si no existe o no es visible (borrador, pausada, inmobiliaria no aprobada). */
export async function getPublicProperty(slug: string): Promise<ServiceResult<PublicPropertyDto | null>> {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 120) return ok(null);
  try {
    return await withActor(ANON, async (tx) => {
      const [r] = await tx.select().from(property).where(eq(property.slug, slug));
      if (!r) return ok(null);
      const [z] = await tx.select().from(zone).where(eq(zone.id, r.zoneId));
      const [parent] = z?.parentId ? await tx.select().from(zoneParent).where(eq(zoneParent.id, z.parentId)) : [];
      const [ag] = await tx.select().from(agency).where(eq(agency.id, r.agencyId));
      if (!z || !ag) return ok(null);
      const [lot] = r.type === "lot" ? await tx.select().from(propertyLot).where(eq(propertyLot.propertyId, r.id)) : [];
      const [bld] = r.type !== "lot" ? await tx.select().from(propertyBuilding).where(eq(propertyBuilding.propertyId, r.id)) : [];
      if (r.type === "lot" ? !lot : !bld) return fail("unexpected", "Ficha incompleta");
      const photos = await tx.select().from(propertyPhoto)
        .where(and(eq(propertyPhoto.propertyId, r.id), eq(propertyPhoto.status, "ready"))).orderBy(asc(propertyPhoto.position));
      const [ag8] = await tx.select().from(agencyMember).where(and(eq(agencyMember.id, r.agentId), eq(agencyMember.status, "active")));
      const cover = photos.find((p) => p.isCover) ?? photos[0];

      return ok({
        id: r.id, slug: r.slug, title: r.title, operation: r.operation, type: r.type, status: r.status,
        price: Number(r.price), currency: r.currency, zoneName: z.nameEs, zoneParentName: parent?.nameEs ?? null,
        totalAreaM2: Number(r.totalAreaM2), coveredAreaM2: toNumber(r.coveredAreaM2), expenses: toNumber(r.expenses),
        bedrooms: bld?.bedrooms ?? null, bathrooms: bld?.bathrooms ?? null, coverKey: cover?.storageKey ?? null, photoCount: photos.length,
        agencyName: ag.name, agencySlug: ag.slug, description: r.description, language: r.language,
        publishedAt: iso(r.publishedAt), updatedAt: r.updatedAt.toISOString(),
        address: r.showExactAddress ? (r.addressText ?? null) : null, // dirección solo si el agente lo autorizó
        detail: lot
          ? { kind: "lot" as const, frontageM: toNumber(lot.frontageM), depthM: toNumber(lot.depthM), services: lot.services, zoning: lot.zoning, isCorner: lot.isCorner }
          : {
              kind: "building" as const, rooms: bld!.rooms, bedrooms: bld!.bedrooms, bathrooms: bld!.bathrooms, garages: bld!.garages,
              ageYears: bld!.ageYears, floor: bld!.floor, hasElevator: bld!.hasElevator, furnished: bld!.furnished, amenities: bld!.amenities,
            },
        photos: photos.map((p) => ({ id: p.id, storageKey: p.storageKey, altText: p.altText, isCover: p.isCover })),
        agent: ag8
          ? { id: ag8.id, displayName: ag8.displayName, bio: ag8.bio, photoUrl: ag8.photoUrl, publicPhone: ag8.publicPhone, publicWhatsapp: ag8.publicWhatsapp, publicEmail: ag8.publicEmail }
          : null,
        agency: { name: ag.name, slug: ag.slug, logoUrl: ag.logoUrl, phone: ag.phone, website: ag.website },
      });
    });
  } catch (e) {
    return mapDbError(e);
  }
}

/** Para el sitemap: fichas indexables (activas y reservadas). */
export async function listPublicSlugs(limit = 5000): Promise<ServiceResult<{ slug: string; updatedAt: string }[]>> {
  try {
    const rows = await withActor(ANON, (tx) =>
      tx.select({ slug: property.slug, updatedAt: property.updatedAt }).from(property)
        .where(or(eq(property.status, "active"), eq(property.status, "reserved"))).orderBy(desc(property.updatedAt)).limit(limit),
    );
    return ok(rows.map((r) => ({ slug: r.slug, updatedAt: r.updatedAt.toISOString() })));
  } catch (e) {
    return mapDbError(e);
  }
}
