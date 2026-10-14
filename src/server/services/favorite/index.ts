import { and, desc, eq } from "drizzle-orm";
import { fail, mapDbError, ok, type Actor, type PublicCardDto, type ServiceResult } from "@/contracts";
import { withActor } from "@/server/db/with-actor";
import { agency, favorite, property, propertyBuilding, propertyPhoto, zone } from "@/server/db/schema";
import { cardColumns, toCard } from "../public/card";

// H4. Favoritos: solo para cuentas. RLS limita todo a las filas propias.

const needLogin = () => fail("unauthenticated", "Tenés que iniciar sesión");

export async function addFavorite(actor: Actor, propertyId: string): Promise<ServiceResult<null>> {
  if (actor.kind !== "user") return needLogin();
  try {
    return await withActor(actor, async (tx) => {
      // solo propiedades visibles para el público: la base oculta el resto
      const [p] = await tx.select({ id: property.id, status: property.status }).from(property).where(eq(property.id, propertyId));
      if (!p || !["active", "reserved", "sold_rented"].includes(p.status)) return fail("not_found", "Propiedad no encontrada");
      await tx.insert(favorite).values({ userId: actor.userId, propertyId }).onConflictDoNothing();
      return ok(null);
    });
  } catch (e) {
    return mapDbError(e);
  }
}

export async function removeFavorite(actor: Actor, propertyId: string): Promise<ServiceResult<null>> {
  if (actor.kind !== "user") return needLogin();
  try {
    await withActor(actor, (tx) => tx.delete(favorite).where(and(eq(favorite.userId, actor.userId), eq(favorite.propertyId, propertyId))));
    return ok(null);
  } catch (e) {
    return mapDbError(e);
  }
}

export async function isFavorite(actor: Actor, propertyId: string): Promise<boolean> {
  if (actor.kind !== "user") return false;
  try {
    const rows = await withActor(actor, (tx) => tx.select({ p: favorite.propertyId }).from(favorite).where(eq(favorite.propertyId, propertyId)));
    return rows.length > 0;
  } catch {
    return false;
  }
}

/** Favoritos del usuario, más recientes primero. Las propiedades que ya no son públicas desaparecen de la lista. */
export async function listFavorites(actor: Actor): Promise<ServiceResult<PublicCardDto[]>> {
  if (actor.kind !== "user") return needLogin();
  try {
    const rows = await withActor(actor, (tx) =>
      tx.select(cardColumns).from(favorite)
        .innerJoin(property, eq(property.id, favorite.propertyId))
        .innerJoin(zone, eq(zone.id, property.zoneId))
        .innerJoin(agency, eq(agency.id, property.agencyId))
        .leftJoin(propertyBuilding, eq(propertyBuilding.propertyId, property.id))
        .leftJoin(propertyPhoto, and(eq(propertyPhoto.propertyId, property.id), eq(propertyPhoto.isCover, true), eq(propertyPhoto.status, "ready")))
        .where(eq(favorite.userId, actor.userId))
        .orderBy(desc(favorite.createdAt)).limit(200),
    );
    return ok(rows.map(toCard));
  } catch (e) {
    return mapDbError(e);
  }
}
