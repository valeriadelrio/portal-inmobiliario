import { and, count, desc, eq, sql, type SQL } from "drizzle-orm";
import {
  fail, getPublishBlockers, mapDbError, ok, propertyInput, toNumber,
  type Actor, type PropertyInput, type PropertyListItemDto, type PropertyStatus, type PublishBlocker, type ServiceResult,
} from "@/contracts";
import { propertySlug } from "@/lib/slug";
import { can } from "@/server/auth/policies";
import { withActor } from "@/server/db/with-actor";
import { getStorage } from "@/server/storage";
import { agency, property, propertyBuilding, propertyLot, propertyPhoto, zone } from "@/server/db/schema";

// Pieza 2B. agencyId SIEMPRE sale de la membresía del Actor, nunca del cliente.
// Las reglas finales (ciclo de vida, publicación, inmutables) las aplican los triggers de la base.

export const PAGE_SIZE = 20;
export type PropertyListFilters = { status?: PropertyStatus; operation?: "sale" | "rent"; type?: string; page?: number };
export type PropertyDetail = PropertyInput & {
  id: string; status: PropertyStatus; slug: string; agentId: string; publishedAt: string | null; blockers: PublishBlocker[];
};

const unauthenticated = () => fail("unauthenticated", "Tenés que iniciar sesión");
const forbidden = () => fail("forbidden", "No tenés permiso para esto");
const num = (v: number | undefined) => (v === undefined ? null : String(v));
const clean = (v: string | undefined) => (v && v.length > 0 ? v : null);

type Row = typeof property.$inferSelect;

const baseValues = (v: PropertyInput) => ({
  operation: v.operation, title: v.title, description: v.description, language: v.language, zoneId: v.zoneId,
  addressText: clean(v.addressText), showExactAddress: v.showExactAddress, price: String(v.price), currency: v.currency,
  expenses: num(v.expenses), totalAreaM2: String(v.totalAreaM2), coveredAreaM2: num(v.coveredAreaM2),
});

const lotValues = (v: Extract<PropertyInput, { type: "lot" }>) => ({
  frontageM: num(v.frontageM), depthM: num(v.depthM), services: v.services, zoning: clean(v.zoning), isCorner: v.isCorner,
});
const buildingValues = (v: Exclude<PropertyInput, { type: "lot" }>) => ({
  rooms: v.rooms, bedrooms: v.bedrooms, bathrooms: v.bathrooms, garages: v.garages, ageYears: v.ageYears ?? null,
  floor: v.floor ?? null, hasElevator: v.hasElevator ?? null, furnished: v.furnished ?? null, amenities: v.amenities,
});

/** Crea la ficha como BORRADOR. Un agente la crea a su nombre; el admin puede elegir otro agente de su agencia. */
export async function createProperty(
  actor: Actor, input: PropertyInput, agentId?: string,
): Promise<ServiceResult<{ id: string; slug: string }>> {
  if (actor.kind === "anonymous") return unauthenticated();
  const m = actor.membership;
  if (!m || !can(actor, { type: "property:create", agencyId: m.agencyId })) return forbidden();
  const p = propertyInput.safeParse(input);
  if (!p.success) return fail("validation", "Datos de la propiedad inválidos");
  const v = p.data;
  const agent = m.role === "agency_admin" ? (agentId ?? m.memberId) : m.memberId;
  if (m.role !== "agency_admin" && agentId && agentId !== m.memberId) return forbidden();

  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = propertySlug(v.title);
    try {
      const row = await withActor(actor, async (tx) => {
        const [r] = await tx.insert(property).values({
          ...baseValues(v), type: v.type, status: "draft", agencyId: m.agencyId, agentId: agent, slug,
        }).returning({ id: property.id, slug: property.slug });
        if (v.type === "lot") await tx.insert(propertyLot).values({ propertyId: r.id, ...lotValues(v) });
        else await tx.insert(propertyBuilding).values({ propertyId: r.id, ...buildingValues(v) });
        return r;
      });
      return ok(row);
    } catch (e) {
      const r = mapDbError(e);
      if (!r.ok && r.error.code === "conflict" && /property_slug_uq/.test(r.error.message)) continue; // sufijo repetido: reintenta
      return r;
    }
  }
  return fail("unexpected", "No se pudo generar una dirección única para la ficha");
}

/** El tipo no cambia (lo exige la base): para otro tipo hay que crear una ficha nueva. */
export async function updateProperty(actor: Actor, id: string, input: PropertyInput): Promise<ServiceResult<void>> {
  if (actor.kind === "anonymous") return unauthenticated();
  if (!actor.membership) return forbidden();
  const p = propertyInput.safeParse(input);
  if (!p.success) return fail("validation", "Datos de la propiedad inválidos");
  const v = p.data;
  try {
    return await withActor(actor, async (tx) => {
      const [cur] = await tx.select({ type: property.type, agencyId: property.agencyId }).from(property).where(eq(property.id, id));
      if (!cur || cur.agencyId !== actor.membership?.agencyId) return fail("not_found", "La propiedad no existe");
      if (cur.type !== v.type) return fail("immutable_field", "El tipo de propiedad no se puede cambiar");
      const rows = await tx.update(property).set({ ...baseValues(v), updatedAt: new Date() }).where(eq(property.id, id)).returning({ id: property.id });
      if (!rows.length) return fail("forbidden", "No podés editar esta propiedad");
      if (v.type === "lot") {
        const vals = lotValues(v);
        await tx.insert(propertyLot).values({ propertyId: id, ...vals }).onConflictDoUpdate({ target: propertyLot.propertyId, set: vals });
      } else {
        const vals = buildingValues(v);
        await tx.insert(propertyBuilding).values({ propertyId: id, ...vals }).onConflictDoUpdate({ target: propertyBuilding.propertyId, set: vals });
      }
      return ok(undefined);
    });
  } catch (e) {
    return mapDbError(e);
  }
}

export async function getProperty(actor: Actor, id: string): Promise<ServiceResult<PropertyDetail>> {
  if (actor.kind === "anonymous") return unauthenticated();
  const m = actor.membership;
  if (!m) return forbidden();
  try {
    return await withActor(actor, async (tx) => {
      const [r] = await tx.select().from(property).where(and(eq(property.id, id), eq(property.agencyId, m.agencyId)));
      // un agente solo ve las suyas aunque la RLS deje leer las públicas de su agencia
      if (!r || !can(actor, { type: "property:read", property: { agencyId: r.agencyId, agentId: r.agentId, status: "draft" } })) {
        return fail("not_found", "La propiedad no existe");
      }
      const [lot] = await tx.select().from(propertyLot).where(eq(propertyLot.propertyId, id));
      const [bld] = await tx.select().from(propertyBuilding).where(eq(propertyBuilding.propertyId, id));
      const [ph] = await tx.select({
        ready: count(), cover: sql<number>`count(*) filter (where ${propertyPhoto.isCover})`,
      }).from(propertyPhoto).where(and(eq(propertyPhoto.propertyId, id), eq(propertyPhoto.status, "ready")));
      const [z] = await tx.select({ a: zone.isActive }).from(zone).where(eq(zone.id, r.zoneId));
      const [ag] = await tx.select({ s: agency.status }).from(agency).where(eq(agency.id, r.agencyId));
      const blockers = getPublishBlockers({
        readyPhotos: Number(ph?.ready ?? 0), hasCover: Number(ph?.cover ?? 0) > 0, zoneActive: !!z?.a, agencyApproved: ag?.s === "approved",
      });
      const detail = toDetail(r, lot, bld, blockers);
      return detail ? ok(detail) : fail("unexpected", "La ficha está incompleta");
    });
  } catch (e) {
    return mapDbError(e);
  }
}

function toDetail(
  r: Row, lot: typeof propertyLot.$inferSelect | undefined, bld: typeof propertyBuilding.$inferSelect | undefined, blockers: PublishBlocker[],
): PropertyDetail | null {
  const base = {
    id: r.id, status: r.status as PropertyStatus, slug: r.slug, agentId: r.agentId, publishedAt: r.publishedAt?.toISOString() ?? null, blockers,
    operation: r.operation as "sale" | "rent", title: r.title, description: r.description, language: r.language as "es" | "en",
    zoneId: r.zoneId, addressText: r.addressText ?? undefined, showExactAddress: r.showExactAddress, price: Number(r.price),
    currency: r.currency as "USD" | "ARS", expenses: toNumber(r.expenses) ?? undefined, totalAreaM2: Number(r.totalAreaM2),
    coveredAreaM2: toNumber(r.coveredAreaM2) ?? undefined,
  };
  if (r.type === "lot") {
    if (!lot) return null;
    return {
      ...base, type: "lot", frontageM: toNumber(lot.frontageM) ?? undefined, depthM: toNumber(lot.depthM) ?? undefined,
      services: lot.services as never, zoning: lot.zoning ?? undefined, isCorner: lot.isCorner,
    };
  }
  if (!bld) return null;
  return {
    ...base, type: r.type as Exclude<PropertyInput["type"], "lot">, rooms: bld.rooms, bedrooms: bld.bedrooms, bathrooms: bld.bathrooms,
    garages: bld.garages, ageYears: bld.ageYears ?? undefined, floor: bld.floor ?? undefined, hasElevator: bld.hasElevator ?? undefined,
    furnished: bld.furnished ?? undefined, amenities: bld.amenities,
  };
}

/** "Mis propiedades": el agente ve las suyas; el admin de la inmobiliaria, todas las de su inmobiliaria. */
export async function listMyProperties(
  actor: Actor, f: PropertyListFilters = {},
): Promise<ServiceResult<{ items: PropertyListItemDto[]; total: number; pageSize: number }>> {
  if (actor.kind === "anonymous") return unauthenticated();
  const m = actor.membership;
  if (!m) return forbidden();
  const page = Math.max(1, Math.floor(f.page ?? 1));
  const where: SQL[] = [eq(property.agencyId, m.agencyId)];
  if (m.role !== "agency_admin") where.push(eq(property.agentId, m.memberId));
  if (f.status) where.push(eq(property.status, f.status));
  if (f.operation) where.push(eq(property.operation, f.operation));
  if (f.type) where.push(eq(property.type, f.type));
  try {
    return await withActor(actor, async (tx) => {
      const [{ total }] = await tx.select({ total: count() }).from(property).where(and(...where));
      const rows = await tx.select({
        id: property.id, slug: property.slug, title: property.title, operation: property.operation, type: property.type,
        status: property.status, price: property.price, currency: property.currency, zoneId: property.zoneId,
        agentId: property.agentId, updatedAt: property.updatedAt, coverKey: propertyPhoto.storageKey,
        zoneName: zone.nameEs, totalAreaM2: property.totalAreaM2, bedrooms: propertyBuilding.bedrooms, bathrooms: propertyBuilding.bathrooms,
        photoCount: sql<number>`(select count(*) from property_photo ph where ph.property_id = ${property.id} and ph.status = 'ready')`,
      }).from(property)
        .innerJoin(zone, eq(zone.id, property.zoneId))
        .leftJoin(propertyBuilding, eq(propertyBuilding.propertyId, property.id))
        .leftJoin(propertyPhoto, and(eq(propertyPhoto.propertyId, property.id), eq(propertyPhoto.isCover, true), eq(propertyPhoto.status, "ready")))
        .where(and(...where)).orderBy(desc(property.updatedAt)).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE);
      return ok({
        total: Number(total), pageSize: PAGE_SIZE,
        items: rows.map((r) => ({
          ...r, price: Number(r.price), totalAreaM2: Number(r.totalAreaM2), photoCount: Number(r.photoCount),
          coverKey: r.coverKey ?? null, updatedAt: r.updatedAt.toISOString(),
        })),
      });
    });
  } catch (e) {
    return mapDbError(e);
  }
}

/** Las transiciones válidas y las condiciones de publicación las decide la base (invalid_transition / publish_blocked). */
export async function changeStatus(actor: Actor, id: string, status: PropertyStatus): Promise<ServiceResult<void>> {
  if (actor.kind === "anonymous") return unauthenticated();
  if (!actor.membership) return forbidden();
  try {
    const rows = await withActor(actor, (tx) =>
      tx.update(property).set({ status, updatedAt: new Date() })
        .where(and(eq(property.id, id), eq(property.agencyId, actor.membership!.agencyId))).returning({ id: property.id }),
    );
    return rows.length ? ok(undefined) : fail("not_found", "La propiedad no existe o no es tuya");
  } catch (e) {
    return mapDbError(e);
  }
}

/** Solo borradores y pausadas, y sin consultas. Las demás se pausan. */
export async function deleteProperty(actor: Actor, id: string): Promise<ServiceResult<void>> {
  if (actor.kind === "anonymous") return unauthenticated();
  const m = actor.membership;
  if (!m) return forbidden();
  try {
    const result = await withActor(actor, async (tx) => {
      const [cur] = await tx.select({ status: property.status }).from(property)
        .where(and(eq(property.id, id), eq(property.agencyId, m.agencyId)));
      if (!cur) return fail("not_found", "La propiedad no existe");
      if (cur.status !== "draft" && cur.status !== "paused") {
        return fail("conflict", "Solo se pueden eliminar borradores o propiedades pausadas. Pausala primero.");
      }
      const rows = await tx.delete(property).where(eq(property.id, id)).returning({ id: property.id });
      return rows.length ? ok(undefined) : fail("forbidden", "No podés eliminar esta propiedad");
    });
    if (result.ok) {
      // las filas de fotos se borran en cascada; también se limpian los archivos (si falla, quedan huérfanos pero no molestan)
      await (await getStorage()).deletePrefix(`properties/${m.agencyId}/${id}`).catch(() => undefined);
    }
    return result;
  } catch (e) {
    return mapDbError(e);
  }
}
