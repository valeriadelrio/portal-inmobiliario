import { describe, expect, it } from "vitest";
import { en } from "@/i18n/en";
import { es } from "@/i18n/es";
import { getDict, isLocale, localePath, stripLocale, zoneLabel } from "@/i18n";
import { formatPrice, statusLabel } from "@/lib/labels";
import { propertyFacts } from "@/lib/property-facts";

/** Recorre el diccionario y devuelve todas las claves hoja con su valor. */
function leaves(o: unknown, prefix = ""): [string, unknown][] {
  if (o && typeof o === "object") return Object.entries(o).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k));
  return [[prefix, o]];
}

describe("diccionarios es/en", () => {
  const E = leaves(es);
  const N = leaves(en);
  it("tienen exactamente las mismas claves", () => {
    expect(N.map(([k]) => k).sort()).toEqual(E.map(([k]) => k).sort());
  });
  it("ninguna traducción está vacía y los tipos coinciden", () => {
    const enMap = new Map(N);
    for (const [k, v] of E) {
      const t = enMap.get(k);
      expect(typeof t, k).toBe(typeof v);
      if (typeof t === "string") expect(t.trim(), k).not.toBe("");
    }
  });
  it("las funciones de texto aceptan los mismos argumentos y devuelven texto", () => {
    expect(en.search.count(2)).toMatch(/2/);
    expect(es.search.pageOf(1, 3)).toBe("Página 1 de 3");
    expect(en.search.pageOf(1, 3)).toBe("Page 1 of 3");
    expect(en.facts.years(1)).toBe("1 year");
    expect(en.card.bathrooms(2)).toBe("2 baths");
  });
  it("cubren los mismos tipos, operaciones y servicios", () => {
    for (const k of Object.keys(es.types)) expect(en.types[k], k).toBeTruthy();
    for (const k of Object.keys(es.operations)) expect(en.operations[k], k).toBeTruthy();
    for (const k of Object.keys(es.lotServices)) expect(en.lotServices[k], k).toBeTruthy();
  });
});

describe("rutas por idioma", () => {
  it("español sin prefijo, inglés bajo /en", () => {
    expect(localePath("es", "/propiedades")).toBe("/propiedades");
    expect(localePath("en", "/propiedades")).toBe("/en/propiedades");
    expect(localePath("en", "/")).toBe("/en");
    expect(localePath("es", "/")).toBe("/");
  });
  it("stripLocale quita solo el prefijo /en", () => {
    expect(stripLocale("/en")).toBe("/");
    expect(stripLocale("/en/propiedades/x")).toBe("/propiedades/x");
    expect(stripLocale("/entrada")).toBe("/entrada");
    expect(stripLocale("/propiedades")).toBe("/propiedades");
  });
  it("valida el idioma", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(getDict("en").site.login).toBe("Agency login");
  });
  it("la zona cae al español si no hay traducción", () => {
    expect(zoneLabel("en", "Centro", "Downtown")).toBe("Downtown");
    expect(zoneLabel("en", "Centro", null)).toBe("Centro");
    expect(zoneLabel("es", "Centro", "Downtown")).toBe("Centro");
  });
});

describe("formatos por idioma", () => {
  it("precio con separadores del idioma, sin convertir moneda", () => {
    expect(formatPrice(90000, "USD")).toBe("US$ 90.000");
    expect(formatPrice(90000, "USD", "en")).toBe("US$ 90,000");
    expect(formatPrice(1500000, "ARS", "en")).toBe("$ 1,500,000");
  });
  it("estado según idioma y operación", () => {
    expect(statusLabel("sold_rented", "rent")).toBe("Alquilada");
    expect(statusLabel("sold_rented", "rent", "en")).toBe("Rented");
    expect(statusLabel("sold_rented", "sale", "en")).toBe("Sold");
    expect(statusLabel("reserved", "sale", "en")).toBe("Reserved");
  });
  it("características en inglés", () => {
    const facts = propertyFacts({ type: "lot", totalAreaM2: 300, currency: "USD", showExactAddress: true, services: ["water", "sewer"], isCorner: true }, (n) => `$${n}`, "en");
    expect(facts).toContainEqual(["Total area", "300 m²"]);
    expect(facts).toContainEqual(["Corner lot", "Yes"]);
    expect(facts).toContainEqual(["Utilities", "Water, Sewer"]);
  });
});
