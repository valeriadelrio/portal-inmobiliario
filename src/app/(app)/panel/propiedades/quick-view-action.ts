"use server";

import type { PhotoDto } from "@/contracts";
import { errorText } from "@/lib/form-state";
import { getActor } from "@/server/auth/get-actor";
import { listPhotos } from "@/server/services/photo";
import { getProperty, type PropertyDetail } from "@/server/services/property";
import { listActiveZones } from "@/server/services/zone";

export type QuickView = { property: PropertyDetail; photos: PhotoDto[]; zoneName: string };

/** Datos para la vista rápida. Cada llamada verifica la sesión y los permisos como la ficha completa. */
export async function quickViewAction(propertyId: string): Promise<({ ok: true } & QuickView) | { ok: false; message: string }> {
  const actor = await getActor();
  const r = await getProperty(actor, propertyId);
  if (!r.ok) return { ok: false, message: errorText(r.error.code, r.error.message) };
  const [photos, zones] = await Promise.all([listPhotos(actor, propertyId), listActiveZones(actor)]);
  return {
    ok: true,
    property: r.data,
    photos: photos.ok ? photos.data.filter((p) => p.status === "ready") : [],
    zoneName: (zones.ok && zones.data.find((z) => z.id === r.data.zoneId)?.nameEs) || "—",
  };
}
