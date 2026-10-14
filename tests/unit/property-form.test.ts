import { describe, expect, it } from "vitest";
import { propertyInput } from "@/contracts";
import { parseNumber } from "@/lib/parse-number";
import { parsePropertyForm } from "@/lib/property-form";

const form = (o: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) (Array.isArray(v) ? v : [v]).forEach((x) => f.append(k, x));
  return f;
};
const zone = "00000000-0000-4000-8000-000000000030";

describe("parseNumber", () => {
  it("entiende el formato argentino", () => {
    expect(parseNumber("120000")).toBe(120000);
    expect(parseNumber("120.000")).toBe(120000);
    expect(parseNumber("1.250,50")).toBe(1250.5);
    expect(parseNumber("45,5")).toBe(45.5);
    expect(parseNumber("45.5")).toBe(45.5);
    expect(parseNumber("US$ 45.000")).toBe(45000);
    expect(parseNumber("")).toBeUndefined();
    expect(parseNumber(null)).toBeUndefined();
    expect(parseNumber("abc")).toBeNaN();
  });
});

describe("parsePropertyForm", () => {
  const common = { operation: "sale", title: "Lote en Villa", description: "Lote con todos los servicios listo", zoneId: zone, currency: "USD", price: "45.000", totalAreaM2: "300" };
  it("arma un lote válido y filtra servicios desconocidos", () => {
    const r = propertyInput.safeParse(parsePropertyForm(form({ ...common, type: "lot", services: ["water", "hack", "gas"], isCorner: "on", frontageM: "10,5" })));
    expect(r.success).toBe(true);
    if (r.success && r.data.type === "lot") expect(r.data).toMatchObject({ price: 45000, services: ["water", "gas"], isCorner: true, frontageM: 10.5 });
  });
  it("arma una casa con amenities y no mezcla campos de lote", () => {
    const parsed = parsePropertyForm(form({ ...common, type: "house", rooms: "4", bedrooms: "3", bathrooms: "2", amenities: "pileta, parrilla ,,", frontageM: "9" }));
    expect(parsed).not.toHaveProperty("frontageM");
    const r = propertyInput.safeParse(parsed);
    expect(r.success).toBe(true);
    if (r.success && r.data.type === "house") expect(r.data).toMatchObject({ amenities: ["pileta", "parrilla"], garages: 0, bedrooms: 3 });
  });
  it("una casa sin dormitorios o un precio con letras no pasan", () => {
    expect(propertyInput.safeParse(parsePropertyForm(form({ ...common, type: "house", rooms: "4", bathrooms: "2" }))).success).toBe(false);
    expect(propertyInput.safeParse(parsePropertyForm(form({ ...common, type: "lot", price: "mucho" }))).success).toBe(false);
  });
});
