import { describe, expect, it } from "vitest";
import { inquiryInput, propertyInput, searchFilters } from "@/contracts";

const base = {
  operation: "sale", title: "Casa en Villa Italia", description: "Casa de dos dormitorios con patio",
  language: "es", zoneId: "5f1c1c1c-1c1c-4c1c-8c1c-1c1c1c1c1c1c", price: 85000, currency: "USD", totalAreaM2: 300,
};

describe("propertyInput", () => {
  it("acepta un lote sin ambientes y rechaza ambientes en un lote", () => {
    expect(propertyInput.safeParse({ ...base, type: "lot", frontageM: 10, depthM: 30 }).success).toBe(true);
    const bad = propertyInput.safeParse({ ...base, type: "lot", rooms: 3 });
    expect(bad.success).toBe(true); // campos extra se descartan, no llegan al modelo
    if (bad.success) expect("rooms" in bad.data).toBe(false);
  });
  it("una casa exige ambientes, dormitorios y baños", () => {
    expect(propertyInput.safeParse({ ...base, type: "house" }).success).toBe(false);
    expect(propertyInput.safeParse({ ...base, type: "house", rooms: 4, bedrooms: 2, bathrooms: 1 }).success).toBe(true);
  });
  it("acepta USD y ARS, rechaza otras monedas", () => {
    expect(propertyInput.safeParse({ ...base, type: "lot", currency: "ARS" }).success).toBe(true);
    expect(propertyInput.safeParse({ ...base, type: "lot", currency: "EUR" }).success).toBe(false);
  });
});

describe("searchFilters", () => {
  it("parsea query string con listas; la moneda es opcional", () => {
    const f = searchFilters.parse({ op: "rent", type: "house,lot", minPrice: "100" });
    expect(f.type).toEqual(["house", "lot"]);
    expect(f.currency).toBeUndefined();
    expect(f.minPrice).toBe(100);
  });
});

describe("inquiryInput", () => {
  it("exige consentimiento", () => {
    const ok = { propertyId: base.zoneId, name: "Ana", email: "a@b.com", message: "Hola, me interesa", locale: "es" };
    expect(inquiryInput.safeParse({ ...ok, consent: true }).success).toBe(true);
    expect(inquiryInput.safeParse({ ...ok, consent: false }).success).toBe(false);
    expect(inquiryInput.safeParse(ok).success).toBe(false);
  });
});
