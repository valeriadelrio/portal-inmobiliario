import { LOT_SERVICES } from "@/contracts";
import { parseNumber } from "./parse-number";

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || undefined;
const bool = (f: FormData, k: string) => f.get(k) === "on";

/** Convierte el FormData del formulario de propiedad en el objeto que valida `propertyInput`. */
export function parsePropertyForm(f: FormData): Record<string, unknown> {
  const base = {
    type: text(f, "type"),
    operation: text(f, "operation"),
    title: text(f, "title"),
    description: text(f, "description"),
    language: text(f, "language") ?? "es",
    zoneId: text(f, "zoneId"),
    addressText: text(f, "addressText"),
    showExactAddress: bool(f, "showExactAddress"),
    price: parseNumber(f.get("price")),
    currency: text(f, "currency"),
    expenses: parseNumber(f.get("expenses")),
    totalAreaM2: parseNumber(f.get("totalAreaM2")),
    coveredAreaM2: parseNumber(f.get("coveredAreaM2")),
  };
  if (base.type === "lot") {
    return {
      ...base,
      frontageM: parseNumber(f.get("frontageM")),
      depthM: parseNumber(f.get("depthM")),
      services: f.getAll("services").map(String).filter((s) => (LOT_SERVICES as readonly string[]).includes(s)),
      zoning: text(f, "zoning"),
      isCorner: bool(f, "isCorner"),
    };
  }
  return {
    ...base,
    rooms: parseNumber(f.get("rooms")),
    bedrooms: parseNumber(f.get("bedrooms")),
    bathrooms: parseNumber(f.get("bathrooms")),
    garages: parseNumber(f.get("garages")) ?? 0,
    ageYears: parseNumber(f.get("ageYears")),
    floor: parseNumber(f.get("floor")),
    hasElevator: bool(f, "hasElevator"),
    furnished: bool(f, "furnished"),
    amenities: (text(f, "amenities") ?? "").split(",").map((a) => a.trim()).filter(Boolean).slice(0, 30),
  };
}
