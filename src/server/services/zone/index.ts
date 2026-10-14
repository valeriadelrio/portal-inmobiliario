import { asc, eq } from "drizzle-orm";
import {
  mapDbError, notImplemented, ok, type Actor, type ServiceResult, type ZoneCsvRow, type ZoneDto, type ZoneInput,
} from "@/contracts";
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
export async function listAllZones(_actor: Actor): Promise<ServiceResult<ZoneDto[]>> {
  return notImplemented("listAllZones");
}
export async function createZone(_actor: Actor, _input: ZoneInput): Promise<ServiceResult<ZoneDto>> {
  return notImplemented("createZone");
}
export async function updateZone(_actor: Actor, _id: string, _input: ZoneInput): Promise<ServiceResult<ZoneDto>> {
  return notImplemented("updateZone");
}
export async function deleteZone(_actor: Actor, _id: string): Promise<ServiceResult<void>> {
  return notImplemented("deleteZone");
}
export async function importZonesFromCsv(
  _actor: Actor, _rows: ZoneCsvRow[],
): Promise<ServiceResult<{ created: number; updated: number }>> {
  return notImplemented("importZonesFromCsv");
}
