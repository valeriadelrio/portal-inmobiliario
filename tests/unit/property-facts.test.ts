import { describe, expect, it } from "vitest";
import { propertyFacts } from "@/lib/property-facts";

const money = (n: number) => `$ ${n}`;
const get = (f: [string, string][], k: string) => f.find(([l]) => l === k)?.[1];

describe("propertyFacts", () => {
  it("lote: muestra datos de lote y servicios con nombre en español", () => {
    const f = propertyFacts({ type: "lot", totalAreaM2: 300, currency: "USD", showExactAddress: false, frontageM: 10, services: ["water", "sewer"], isCorner: true }, money);
    expect(get(f, "Frente")).toBe("10 m");
    expect(get(f, "Servicios")).toBe("Agua, Cloacas");
    expect(get(f, "Lote de esquina")).toBe("Sí");
    expect(get(f, "Dormitorios")).toBeUndefined();
  });
  it("casa: muestra características y omite lo no cargado", () => {
    const f = propertyFacts({ type: "house", totalAreaM2: 200, coveredAreaM2: 120, currency: "ARS", showExactAddress: false, rooms: 4, bedrooms: 3, bathrooms: 2, garages: 0, amenities: ["pileta"], expenses: 5000 }, money);
    expect(get(f, "Dormitorios")).toBe("3");
    expect(get(f, "Cocheras")).toBeUndefined();
    expect(get(f, "Antigüedad")).toBeUndefined();
    expect(get(f, "Expensas")).toBe("$ 5000");
    expect(get(f, "Frente")).toBeUndefined();
  });
  it("aclara cuando la dirección no es pública", () => {
    const base = { type: "house", totalAreaM2: 1, currency: "USD", addressText: "Rivadavia 100" };
    expect(get(propertyFacts({ ...base, showExactAddress: false }, money), "Dirección")).toMatch(/no se muestra/);
    expect(get(propertyFacts({ ...base, showExactAddress: true }, money), "Dirección")).toBe("Rivadavia 100");
  });
});
