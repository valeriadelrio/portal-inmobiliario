import { LOT_SERVICE_LABEL } from "./labels";

type Detail = {
  type: string; totalAreaM2: number; coveredAreaM2?: number; expenses?: number; currency: string; addressText?: string; showExactAddress: boolean;
  // lote
  frontageM?: number; depthM?: number; services?: string[]; zoning?: string; isCorner?: boolean;
  // construido
  rooms?: number; bedrooms?: number; bathrooms?: number; garages?: number; ageYears?: number; floor?: number;
  hasElevator?: boolean; furnished?: boolean; amenities?: string[];
};

const yn = (b?: boolean) => (b ? "Sí" : "No");
const m2 = (n: number) => `${n} m²`;

/** Pares "etiqueta: valor" para mostrar en la vista rápida; omite lo que no se cargó. */
export function propertyFacts(d: Detail, money: (n: number) => string): [string, string][] {
  const f: [string, string][] = [["Superficie total", m2(d.totalAreaM2)]];
  if (d.coveredAreaM2 !== undefined) f.push(["Superficie cubierta", m2(d.coveredAreaM2)]);
  if (d.type === "lot") {
    if (d.frontageM !== undefined) f.push(["Frente", `${d.frontageM} m`]);
    if (d.depthM !== undefined) f.push(["Fondo", `${d.depthM} m`]);
    f.push(["Lote de esquina", yn(d.isCorner)]);
    if (d.zoning) f.push(["Zonificación", d.zoning]);
    f.push(["Servicios", d.services?.length ? d.services.map((s) => LOT_SERVICE_LABEL[s] ?? s).join(", ") : "Ninguno cargado"]);
  } else {
    if (d.rooms !== undefined) f.push(["Ambientes", String(d.rooms)]);
    if (d.bedrooms !== undefined) f.push(["Dormitorios", String(d.bedrooms)]);
    if (d.bathrooms !== undefined) f.push(["Baños", String(d.bathrooms)]);
    if (d.garages) f.push(["Cocheras", String(d.garages)]);
    if (d.ageYears !== undefined) f.push(["Antigüedad", `${d.ageYears} ${d.ageYears === 1 ? "año" : "años"}`]);
    if (d.floor !== undefined) f.push(["Piso", String(d.floor)]);
    if (d.hasElevator !== undefined) f.push(["Ascensor", yn(d.hasElevator)]);
    if (d.furnished !== undefined) f.push(["Amoblado", yn(d.furnished)]);
    if (d.amenities?.length) f.push(["Comodidades", d.amenities.join(", ")]);
  }
  if (d.expenses !== undefined) f.push(["Expensas", money(d.expenses)]);
  if (d.addressText) f.push(["Dirección", d.showExactAddress ? d.addressText : `${d.addressText} (no se muestra al público)`]);
  return f;
}
