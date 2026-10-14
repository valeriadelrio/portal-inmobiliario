import { randomUUID } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import {
  ALLOWED_MIME, MAX_BYTES, PHOTO_WIDTHS, fail, mapDbError, ok, presignInput, reorderInput,
  type Actor, type PhotoDto, type ServiceResult,
} from "@/contracts";
import { withActor } from "@/server/db/with-actor";
import { property, propertyPhoto } from "@/server/db/schema";
import { getStorage } from "@/server/storage";
import { processImage } from "@/server/storage/process-image";

// Pieza 2C. Subida en 3 pasos: requestPhotoUpload (fila "pending" + URL de subida) -> el navegador sube el archivo
// -> confirmPhotoUpload (valida, genera variantes WebP y marca "ready"). Las reglas finales las aplica la base.

const unauthenticated = () => fail("unauthenticated", "Tenés que iniciar sesión");
const forbidden = () => fail("forbidden", "No tenés permiso para esto");
const notFound = () => fail("not_found", "La foto no existe");

type Row = typeof propertyPhoto.$inferSelect;
const toDto = (p: Row): PhotoDto => ({
  id: p.id, propertyId: p.propertyId, storageKey: p.storageKey, position: p.position, isCover: p.isCover,
  status: p.status as "pending" | "ready", altText: p.altText, width: p.width, height: p.height,
});
const variantKeys = (key: string) => [...PHOTO_WIDTHS.map((w) => `${key}/${w}.webp`), `${key}/original`];

export async function requestPhotoUpload(
  actor: Actor, propertyId: string, mime: string, size: number,
): Promise<ServiceResult<{ photoId: string; url: string; headers: Record<string, string> }>> {
  if (actor.kind === "anonymous") return unauthenticated();
  const m = actor.membership;
  if (!m) return forbidden();
  const p = presignInput.safeParse({ propertyId, mime, size });
  if (!p.success) {
    return fail("validation", size > MAX_BYTES ? "La foto supera los 10 MB" : `Formato no permitido (se aceptan ${ALLOWED_MIME.map((t) => t.split("/")[1]).join(", ")})`);
  }
  const photoId = randomUUID();
  try {
    const key = await withActor(actor, async (tx) => {
      const [prop] = await tx.select({ id: property.id, agencyId: property.agencyId }).from(property)
        .where(and(eq(property.id, propertyId), eq(property.agencyId, m.agencyId)));
      if (!prop) return null;
      const [{ next }] = await tx.select({ next: sql<number>`coalesce(max(${propertyPhoto.position}), -1) + 1` })
        .from(propertyPhoto).where(eq(propertyPhoto.propertyId, propertyId));
      const storageKey = `properties/${m.agencyId}/${propertyId}/${photoId}`;
      await tx.insert(propertyPhoto).values({
        id: photoId, propertyId, agencyId: m.agencyId, storageKey, position: Number(next), isCover: false, status: "pending",
      });
      return storageKey;
    });
    if (!key) return fail("not_found", "La propiedad no existe");
    const put = await (await getStorage()).presignPut(`${key}/original`, p.data.mime, p.data.size);
    return ok({ photoId, ...put });
  } catch (e) {
    return mapDbError(e);
  }
}

export async function confirmPhotoUpload(actor: Actor, photoId: string): Promise<ServiceResult<PhotoDto>> {
  if (actor.kind === "anonymous") return unauthenticated();
  if (!actor.membership) return forbidden();
  try {
    const [row] = await withActor(actor, (tx) =>
      tx.select().from(propertyPhoto).where(and(eq(propertyPhoto.id, photoId), eq(propertyPhoto.agencyId, actor.membership!.agencyId))),
    );
    if (!row) return notFound();
    if (row.status === "ready") return ok(toDto(row));

    const storage = await getStorage();
    const original = await storage.getObject(`${row.storageKey}/original`);
    if (!original) return fail("storage", "No se recibió el archivo. Probá subirlo de nuevo.");
    if (original.length > MAX_BYTES) {
      await discard(actor, row);
      return fail("validation", "La foto supera los 10 MB");
    }

    let processed;
    try {
      processed = await processImage(original);
    } catch {
      await discard(actor, row);
      return fail("validation", "El archivo no es una imagen válida (usá JPG, PNG o WebP).");
    }
    for (const w of PHOTO_WIDTHS) await storage.putObject(`${row.storageKey}/${w}.webp`, processed.variants[w], "image/webp");
    await storage.deleteObjects([`${row.storageKey}/original`]);

    const updated = await withActor(actor, async (tx) => {
      const [hasCover] = await tx.select({ id: propertyPhoto.id }).from(propertyPhoto)
        .where(and(eq(propertyPhoto.propertyId, row.propertyId), eq(propertyPhoto.isCover, true)));
      const [r] = await tx.update(propertyPhoto)
        .set({ status: "ready", width: processed.width, height: processed.height, isCover: !hasCover })
        .where(eq(propertyPhoto.id, photoId)).returning();
      return r;
    });
    return updated ? ok(toDto(updated)) : notFound();
  } catch (e) {
    return mapDbError(e);
  }
}

/** Limpia una subida fallida: fila pendiente y objetos. */
async function discard(actor: Actor, row: Row) {
  await withActor(actor, (tx) => tx.delete(propertyPhoto).where(and(eq(propertyPhoto.id, row.id), eq(propertyPhoto.status, "pending"))));
  await (await getStorage()).deleteObjects(variantKeys(row.storageKey)).catch(() => undefined);
}

/** Fotos de una propiedad en orden. Público ve solo las listas; quien gestiona la ficha ve también las pendientes. */
export async function listPhotos(actor: Actor, propertyId: string): Promise<ServiceResult<PhotoDto[]>> {
  try {
    const rows = await withActor(actor, (tx) =>
      tx.select().from(propertyPhoto).where(eq(propertyPhoto.propertyId, propertyId)).orderBy(asc(propertyPhoto.position)),
    );
    return ok(rows.map(toDto));
  } catch (e) {
    return mapDbError(e);
  }
}

export async function reorderPhotos(actor: Actor, propertyId: string, photoIds: string[]): Promise<ServiceResult<void>> {
  if (actor.kind === "anonymous") return unauthenticated();
  if (!actor.membership) return forbidden();
  const p = reorderInput.safeParse({ propertyId, photoIds });
  if (!p.success || new Set(photoIds).size !== photoIds.length) return fail("validation", "Orden inválido");
  try {
    return await withActor(actor, async (tx) => {
      const rows = await tx.select({ id: propertyPhoto.id }).from(propertyPhoto)
        .where(and(eq(propertyPhoto.propertyId, propertyId), eq(propertyPhoto.agencyId, actor.membership!.agencyId)));
      const existing = new Set(rows.map((r) => r.id));
      if (existing.size !== photoIds.length || photoIds.some((id) => !existing.has(id))) {
        return fail("validation", "La lista no coincide con las fotos de la propiedad");
      }
      for (const [i, id] of photoIds.entries()) {
        const upd = await tx.update(propertyPhoto).set({ position: i }).where(eq(propertyPhoto.id, id)).returning({ id: propertyPhoto.id });
        if (!upd.length) return forbidden();
      }
      return ok(undefined);
    });
  } catch (e) {
    return mapDbError(e);
  }
}

export async function setCover(actor: Actor, photoId: string): Promise<ServiceResult<void>> {
  if (actor.kind === "anonymous") return unauthenticated();
  if (!actor.membership) return forbidden();
  try {
    return await withActor(actor, async (tx) => {
      const [ph] = await tx.select().from(propertyPhoto)
        .where(and(eq(propertyPhoto.id, photoId), eq(propertyPhoto.agencyId, actor.membership!.agencyId)));
      if (!ph) return notFound();
      if (ph.status !== "ready") return fail("validation", "La foto todavía se está procesando");
      await tx.update(propertyPhoto).set({ isCover: false }).where(and(eq(propertyPhoto.propertyId, ph.propertyId), eq(propertyPhoto.isCover, true)));
      const upd = await tx.update(propertyPhoto).set({ isCover: true }).where(eq(propertyPhoto.id, photoId)).returning({ id: propertyPhoto.id });
      return upd.length ? ok(undefined) : forbidden();
    });
  } catch (e) {
    return mapDbError(e);
  }
}

/**
 * Borra la foto y sus archivos. En una ficha publicada no puede quedar con menos de 3 fotos ni sin portada
 * (error publish_blocked: primero se cambia la portada). Si era la portada de un borrador, la siguiente pasa a serlo.
 */
export async function deletePhoto(actor: Actor, photoId: string): Promise<ServiceResult<void>> {
  if (actor.kind === "anonymous") return unauthenticated();
  if (!actor.membership) return forbidden();
  try {
    const key = await withActor(actor, async (tx) => {
      const [ph] = await tx.select().from(propertyPhoto)
        .where(and(eq(propertyPhoto.id, photoId), eq(propertyPhoto.agencyId, actor.membership!.agencyId)));
      if (!ph) return null;
      const del = await tx.delete(propertyPhoto).where(eq(propertyPhoto.id, photoId)).returning({ id: propertyPhoto.id });
      if (!del.length) return null;
      if (ph.isCover) {
        const [next] = await tx.select({ id: propertyPhoto.id }).from(propertyPhoto)
          .where(and(eq(propertyPhoto.propertyId, ph.propertyId), eq(propertyPhoto.status, "ready"))).orderBy(asc(propertyPhoto.position)).limit(1);
        if (next) await tx.update(propertyPhoto).set({ isCover: true }).where(eq(propertyPhoto.id, next.id));
      }
      return ph.storageKey;
    });
    if (!key) return notFound();
    await (await getStorage()).deleteObjects(variantKeys(key)).catch(() => undefined);
    return ok(undefined);
  } catch (e) {
    return mapDbError(e);
  }
}

export async function updateAltText(actor: Actor, photoId: string, alt: string): Promise<ServiceResult<void>> {
  if (actor.kind === "anonymous") return unauthenticated();
  if (!actor.membership) return forbidden();
  const text = alt.trim();
  if (text.length > 200) return fail("validation", "El texto alternativo admite hasta 200 caracteres");
  try {
    const rows = await withActor(actor, (tx) =>
      tx.update(propertyPhoto).set({ altText: text || null })
        .where(and(eq(propertyPhoto.id, photoId), eq(propertyPhoto.agencyId, actor.membership!.agencyId))).returning({ id: propertyPhoto.id }),
    );
    return rows.length ? ok(undefined) : notFound();
  } catch (e) {
    return mapDbError(e);
  }
}
