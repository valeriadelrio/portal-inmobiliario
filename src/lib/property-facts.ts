import { LOT_SERVICE_LABEL } from "./labels";

type Detail = {
  type: string; totalAreaM2: number; coveredAreaM2?: number | null; expenses?: number | null; currency: string; addressText?: string | null; showExactAddress: boolean;
  // lote
  frontageM?: number | null; depthM?: number | null; services?: string[] | null; zoning?: string | null; isCorner?: boolean | null;
  // construido
  rooms?: number | null; bedrooms?: number | null; bathrooms?: number | null; garages?: number | null; ageYears?: number | null; floor?: number | null;
  hasElevator?: boolean | null; furnished?: boolean | null; amenities?: string[] | null;
};

const yn = (b?: boolean | null) => (b ? "Sí" : "No");
const m2 = (n: number) => `${n} m²`;

/** Pares "etiqueta: valor" para mostrar en la vista rápida; omite lo que no se cargó. */
export function propertyFacts(d: Detail, money: (n: number) => string): [string, string][] {
  const f: [string, string][] = [["Superficie total", m2(d.totalAreaM2)]];
  if (d.coveredAreaM2 != null) f.push(["Superficie cubierta", m2(d.coveredAreaM2)]);
  if (d.type === "lot") {
    if (d.frontageM != null) f.push(["Frente", `${d.frontageM} m`]);
    if (d.depthM != null) f.push(["Fondo", `${d.depthM} m`]);
    f.push(["Lote de esquina", yn(d.isCorner)]);
    if (d.zoning) f.push(["Zonificación", d.zoning]);
    f.push(["Servicios", d.services?.length ? d.services.map((s) => LOT_SERVICE_LABEL[s] ?? s).join(", ") : "Ninguno cargado"]);
  } else {
    if (d.rooms != null) f.push(["Ambientes", String(d.rooms)]);
    if (d.bedrooms != null) f.push(["Dormitorios", String(d.bedrooms)]);
    if (d.bathrooms != null) f.push(["Baños", String(d.bathrooms)]);
    if (d.garages) f.push(["Cocheras", String(d.garages)]);
    if (d.ageYears != null) f.push(["Antigüedad", `${d.ageYears} ${d.ageYears === 1 ? "año" : "años"}`]);
    if (d.floor != null) f.push(["Piso", String(d.floor)]);
    if (d.hasElevator != null) f.push(["Ascensor", yn(d.hasElevator)]);
    if (d.furnished != null) f.push(["Amoblado", yn(d.furnished)]);
    if (d.amenities?.length) f.push(["Comodidades", d.amenities.join(", ")]);
  }
  if (d.expenses != null) f.push(["Expensas", money(d.expenses)]);
  if (d.addressText) f.push(["Dirección", d.showExactAddress ? d.addressText : `${d.addressText} (no se muestra al público)`]);
  return f;
}
