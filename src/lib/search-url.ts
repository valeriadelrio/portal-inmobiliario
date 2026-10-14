import type { SearchFilters } from "@/contracts";

/** Arma la query string de /propiedades a partir de los filtros (solo lo que tiene valor). */
export function searchQuery(f: Partial<SearchFilters>, overrides: Partial<SearchFilters> = {}): string {
  const m = { ...f, ...overrides };
  const q = new URLSearchParams();
  if (m.op) q.set("op", m.op);
  if (m.type?.length) q.set("type", m.type.join(","));
  if (m.zone?.length) q.set("zone", m.zone.join(","));
  if (m.currency) q.set("currency", m.currency);
  for (const k of ["minPrice", "maxPrice", "minRooms", "minArea", "maxArea"] as const) if (m[k] !== undefined) q.set(k, String(m[k]));
  if (m.agency) q.set("agency", m.agency);
  if (m.sort && m.sort !== "recent") q.set("sort", m.sort);
  if (m.page && m.page > 1) q.set("page", String(m.page));
  const s = q.toString();
  return s ? `?${s}` : "";
}
