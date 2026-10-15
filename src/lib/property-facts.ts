import { getDict, type Locale } from "@/i18n";

type Detail = {
  type: string; totalAreaM2: number; coveredAreaM2?: number | null; expenses?: number | null; currency: string; addressText?: string | null; showExactAddress: boolean;
  // lote
  frontageM?: number | null; depthM?: number | null; services?: string[] | null; zoning?: string | null; isCorner?: boolean | null;
  // construido
  rooms?: number | null; bedrooms?: number | null; bathrooms?: number | null; garages?: number | null; ageYears?: number | null; floor?: number | null;
  hasElevator?: boolean | null; furnished?: boolean | null; amenities?: string[] | null;
};

const m2 = (n: number) => `${n} m²`;

/** Pares "etiqueta: valor" para la ficha y la vista rápida; omite lo que no se cargó. */
export function propertyFacts(d: Detail, money: (n: number) => string, locale: Locale = "es"): [string, string][] {
  const { facts: t, lotServices } = getDict(locale);
  const yn = (b?: boolean | null) => (b ? t.yes : t.no);
  const f: [string, string][] = [[t.totalArea, m2(d.totalAreaM2)]];
  if (d.coveredAreaM2 != null) f.push([t.coveredArea, m2(d.coveredAreaM2)]);
  if (d.type === "lot") {
    if (d.frontageM != null) f.push([t.frontage, `${d.frontageM} m`]);
    if (d.depthM != null) f.push([t.depth, `${d.depthM} m`]);
    f.push([t.corner, yn(d.isCorner)]);
    if (d.zoning) f.push([t.zoning, d.zoning]);
    f.push([t.services, d.services?.length ? d.services.map((s) => lotServices[s] ?? s).join(", ") : t.noServices]);
  } else {
    if (d.rooms != null) f.push([t.rooms, String(d.rooms)]);
    if (d.bedrooms != null) f.push([t.bedrooms, String(d.bedrooms)]);
    if (d.bathrooms != null) f.push([t.bathrooms, String(d.bathrooms)]);
    if (d.garages) f.push([t.garages, String(d.garages)]);
    if (d.ageYears != null) f.push([t.age, t.years(d.ageYears)]);
    if (d.floor != null) f.push([t.floor, String(d.floor)]);
    if (d.hasElevator != null) f.push([t.elevator, yn(d.hasElevator)]);
    if (d.furnished != null) f.push([t.furnished, yn(d.furnished)]);
    if (d.amenities?.length) f.push([t.amenities, d.amenities.join(", ")]);
  }
  if (d.expenses != null) f.push([t.expenses, money(d.expenses)]);
  if (d.addressText) f.push([t.address, d.showExactAddress ? d.addressText : `${d.addressText} (no se muestra al público)`]);
  return f;
}
