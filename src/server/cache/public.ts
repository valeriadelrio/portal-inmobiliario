import { cacheLife, cacheTag } from "next/cache";
import type { SearchFilters } from "@/contracts";
import { getPublicProperty, listPublicSlugs, searchProperties } from "@/server/services/public";
import { getPublicAgencyBySlug } from "@/server/services/agency";
import { listActiveZones } from "@/server/services/zone";

// Lecturas públicas cacheadas (no dependen de la sesión). Se invalidan con la etiqueta "public-properties"
// desde las Server Actions que cambian propiedades, fotos, inmobiliarias o zonas (ver invalidate.ts).

export async function cachedSearch(filters: SearchFilters) {
  "use cache";
  cacheLife("minutes");
  cacheTag("public-properties");
  return searchProperties(filters);
}

export async function cachedPublicProperty(slug: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("public-properties");
  return getPublicProperty(slug);
}

export async function cachedPublicAgency(slug: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("public-properties");
  return getPublicAgencyBySlug(slug);
}

export async function cachedActiveZones() {
  "use cache";
  cacheLife("minutes");
  cacheTag("public-properties");
  return listActiveZones({ kind: "anonymous" });
}

export async function cachedSlugs() {
  "use cache";
  cacheLife("minutes");
  cacheTag("public-properties");
  return listPublicSlugs();
}
