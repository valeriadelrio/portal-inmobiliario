import { asc, eq, inArray } from "drizzle-orm";
import {
  fail, mapDbError, ok, zoneInput, type Actor, type ServiceResult, type ZoneCsvRow, type ZoneDto, type ZoneInput,
} from "@/contracts";
import { can } from "@/server/auth/policies";
import { withActor } from "@/server/db/with-actor";
import { zone } from "@/server/db/schema";

const toDto = (z: typeof zone.$inferSelect): ZoneDto => ({
  id: z.id, slug: z.slug, nameEs: z.nameEs, nameEn: z.nameEn, parentId: z.parentId,
  sortOrder: z.sortOrder, isActive: z.isActive,
});

/** Zonas activas (para formularios y filtros públicos). Lectura abierta. */
export async function listActiveZones(actor: Actor): Promise<ServiceResult<ZoneDto[]>> {
  try {
    const rows = await withActor(actor, (tx) =>
      tx.select().from(zone).where(eq(zone.isActive, true)).orderBy(asc(zone.sortOrder), asc(zone.nameEs)),
    );
    return ok(rows.map(toDto));
  } catch (e) {
    return mapDbError(e);
  }
}

// --- Pieza 2D: administración de zonas (solo platform admin) -------------------------------
const denied = () => fail("forbidden", "Solo la administración de la plataforma gestiona zonas");

/** Todas las zonas, activas e inactivas. */
export async function listAllZones(actor: Actor): Promise<ServiceResult<ZoneDto[]>> {
  if (!can(actor, { type: "zone:manage" })) return denied();
  try {
    const rows = await withActor(actor, (tx) => tx.select().from(zone).orderBy(asc(zone.sortOrder), asc(zone.nameEs)));
    return ok(rows.map(toDto));
  } catch (e) {
    return mapDbError(e);
  }
}

export async function createZone(actor: Actor, input: ZoneInput): Promise<ServiceResult<ZoneDto>> {
  if (!can(actor, { type: "zone:manage" })) return denied();
  const parsed = zoneInput.safeParse(input);
  if (!parsed.success) return fail("validation", "Datos de zona inválidos");
  const v = parsed.data;
  try {
    const [row] = await withActor(actor, (tx) =>
      tx.insert(zone).values({
        slug: v.slug, nameEs: v.nameEs, nameEn: v.nameEn || null, parentId: v.parentId ?? null,
        sortOrder: v.sortOrder, isActive: v.isActive,
      }).returning(),
    );
    return ok(toDto(row));
  } catch (e) {
    return mapDbError(e);
  }
}

export async function updateZone(actor: Actor, id: string, input: ZoneInput): Promise<ServiceResult<ZoneDto>> {
  if (!can(actor, { type: "zone:manage" })) return denied();
  const parsed = zoneInput.safeParse(input);
  if (!parsed.success) return fail("validation", "Datos de zona inválidos");
  const v = parsed.data;
  try {
    const [row] = await withActor(actor, (tx) =>
      tx.update(zone).set({
        slug: v.slug, nameEs: v.nameEs, nameEn: v.nameEn || null, parentId: v.parentId ?? null,
        sortOrder: v.sortOrder, isActive: v.isActive,
      }).where(eq(zone.id, id)).returning(),
    );
    return row ? ok(toDto(row)) : fail("not_found", "La zona no existe");
  } catch (e) {
    return mapDbError(e);
  }
}

/** Borra una zona sin uso. Si tiene propiedades o subzonas: error `in_use` (se sugiere desactivarla). */
export async function deleteZone(actor: Actor, id: string): Promise<ServiceResult<void>> {
  if (!can(actor, { type: "zone:manage" })) return denied();
  try {
    const rows = await withActor(actor, (tx) => tx.delete(zone).where(eq(zone.id, id)).returning({ id: zone.id }));
    return rows.length ? ok(undefined) : fail("not_found", "La zona no existe");
  } catch (e) {
    return mapDbError(e);
  }
}

/**
 * Alta o actualización por slug, todo o nada. Las zonas padre se procesan antes que las hijas;
 * `parent_slug` puede apuntar a una fila del mismo archivo o a una zona ya existente.
 */
export async function importZonesFromCsv(
  actor: Actor, rows: ZoneCsvRow[],
): Promise<ServiceResult<{ created: number; updated: number }>> {
  if (!can(actor, { type: "zone:manage" })) return denied();
  const slugs = rows.map((r) => r.slug);
  if (new Set(slugs).size !== slugs.length) return fail("validation", "El archivo tiene slugs repetidos");
  const ordered = [...rows.filter((r) => !r.parent_slug), ...rows.filter((r) => r.parent_slug)];
  try {
    return await withActor(actor, async (tx) => {
      const parentSlugs = [...new Set(rows.map((r) => r.parent_slug).filter(Boolean))];
      const known = await tx.select({ id: zone.id, slug: zone.slug }).from(zone).where(inArray(zone.slug, [...slugs, ...parentSlugs]));
      const existing = new Set(known.map((z) => z.slug));
      const missing = parentSlugs.find((p) => !existing.has(p) && !slugs.includes(p));
      if (missing) return fail("validation", `La zona padre "${missing}" no existe`);
      const nested = rows.find((r) => r.parent_slug && rows.some((o) => o.slug === r.parent_slug && o.parent_slug));
      if (nested) return fail("zone_depth", `"${nested.slug}" tendría más de 2 niveles`);
      // Todo el archivo es una sola transacción: si algo falla, no se aplica nada.
      let created = 0;
      let updated = 0;
      for (const r of ordered) {
        let parentId: string | null = null;
        if (r.parent_slug) {
          const [p] = await tx.select({ id: zone.id }).from(zone).where(eq(zone.slug, r.parent_slug));
          parentId = p.id;
        }
        const values = { nameEs: r.name_es, nameEn: r.name_en || null, parentId, sortOrder: r.sort_order, isActive: r.is_active };
        if (existing.has(r.slug)) {
          await tx.update(zone).set(values).where(eq(zone.slug, r.slug));
          updated++;
        } else {
          await tx.insert(zone).values({ slug: r.slug, ...values });
          created++;
        }
      }
      return ok({ created, updated });
    });
  } catch (e) {
    return mapDbError(e);
  }
}
