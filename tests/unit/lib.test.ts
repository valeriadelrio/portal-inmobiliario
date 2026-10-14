import { describe, expect, it } from "vitest";
import {
  PROPERTY_STATUS, PROPERTY_TRANSITIONS, canTransition, fail, getPublishBlockers, mapDbError, ok, toNumber,
} from "@/contracts";
import { generateInvitationToken, hashToken } from "@/lib/invitation-token";
import { photoSrcSet, photoUrl } from "@/lib/photo-url";
import { propertySlug, randomSuffix, slugify } from "@/lib/slug";
import { MemoryStorage } from "@/server/storage/memory";

describe("slugify", () => {
  it("quita acentos, símbolos y recorta guiones", () => {
    expect(slugify("Casa en Villa Italia!")).toBe("casa-en-villa-italia");
    expect(slugify("  ¡Ñandú & Árbol 2ª planta!  ")).toBe("nandu-arbol-2-planta");
    expect(slugify("---")).toBe("");
  });
  it("respeta el largo máximo sin dejar guion final", () => {
    const s = slugify("palabra ".repeat(20), 20);
    expect(s.length).toBeLessThanOrEqual(20);
    expect(s.endsWith("-")).toBe(false);
  });
  it("propertySlug cumple el formato de la base y es distinto cada vez", () => {
    const a = propertySlug("Lote en Las Acacias");
    expect(a).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(propertySlug("Lote en Las Acacias")).not.toBe(a);
    expect(propertySlug("¡¡¡")).toMatch(/^propiedad-[a-z0-9]{6}$/);
    expect(randomSuffix(10)).toHaveLength(10);
  });
});

describe("transiciones y publicación", () => {
  it("el borrador solo puede ir a activa; nadie vuelve a borrador", () => {
    expect(PROPERTY_TRANSITIONS.draft).toEqual(["active"]);
    for (const from of PROPERTY_STATUS) expect(canTransition(from, "draft")).toBe(false);
  });
  it("getPublishBlockers lista todos los motivos", () => {
    expect(getPublishBlockers({ readyPhotos: 3, hasCover: true, zoneActive: true, agencyApproved: true })).toEqual([]);
    expect(getPublishBlockers({ readyPhotos: 2, hasCover: false, zoneActive: false, agencyApproved: false })).toEqual([
      "min_photos", "no_cover", "zone_inactive", "agency_not_approved",
    ]);
  });
  it("toNumber convierte los numeric de Drizzle", () => {
    expect(toNumber("1234.50")).toBe(1234.5);
    expect(toNumber(null)).toBeNull();
  });
});

describe("ServiceResult y mapDbError", () => {
  it("ok / fail", () => {
    expect(ok(1)).toEqual({ ok: true, data: 1 });
    expect(fail("forbidden")).toMatchObject({ ok: false, error: { code: "forbidden" } });
  });
  it("traduce los códigos de negocio (P0001) y los errores de Postgres", () => {
    const wrap = (code: string, message: string) => ({ message: "Failed query", cause: { code, message } });
    expect(mapDbError(wrap("P0001", "publish_blocked"))).toMatchObject({ error: { code: "publish_blocked" } });
    expect(mapDbError(wrap("P0001", "algo_desconocido"))).toMatchObject({ error: { code: "unexpected" } });
    expect(mapDbError(wrap("42501", "permission denied"))).toMatchObject({ error: { code: "forbidden" } });
    expect(mapDbError(wrap("23505", "dup"))).toMatchObject({ error: { code: "conflict" } });
    expect(mapDbError(wrap("23503", "fk"))).toMatchObject({ error: { code: "in_use" } });
    expect(mapDbError(wrap("23514", "check"))).toMatchObject({ error: { code: "validation" } });
    expect(mapDbError(new Error("boom"))).toMatchObject({ error: { code: "unexpected", message: "boom" } });
  });
});

describe("tokens de invitación", () => {
  it("el hash es estable, distinto del token y el token es impredecible", () => {
    const a = generateInvitationToken();
    const b = generateInvitationToken();
    expect(a.token).not.toBe(b.token);
    expect(a.hash).toBe(hashToken(a.token));
    expect(a.hash).not.toBe(a.token);
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.token.length).toBeGreaterThanOrEqual(40);
  });
});

describe("fotos", () => {
  it("photoUrl y srcset usan las 3 variantes", () => {
    process.env.NEXT_PUBLIC_MEDIA_BASE_URL = "https://cdn.test";
    expect(photoUrl("a/b/c", 400)).toBe("https://cdn.test/a/b/c/400.webp");
    expect(photoSrcSet("a/b/c")).toBe(
      "https://cdn.test/a/b/c/400.webp 400w, https://cdn.test/a/b/c/800.webp 800w, https://cdn.test/a/b/c/1600.webp 1600w",
    );
  });
  it("MemoryStorage guarda, lee y borra por prefijo", async () => {
    const s = new MemoryStorage();
    await s.putObject("ag/p1/f1/400.webp", Buffer.from("x"), "image/webp");
    await s.putObject("ag/p1/f2/400.webp", Buffer.from("y"), "image/webp");
    await s.putObject("ag/p2/f3/400.webp", Buffer.from("z"), "image/webp");
    expect((await s.getObject("ag/p1/f1/400.webp"))?.toString()).toBe("x");
    await s.deletePrefix("ag/p1/");
    expect(await s.getObject("ag/p1/f2/400.webp")).toBeNull();
    expect(await s.getObject("ag/p2/f3/400.webp")).not.toBeNull();
  });
});

import { safeNext } from "@/lib/safe-redirect";
describe("safeNext", () => {
  it("acepta rutas internas y rechaza redirecciones externas", () => {
    expect(safeNext("/panel/agencia")).toBe("/panel/agencia");
    expect(safeNext("/invitacion/abc?x=1")).toBe("/invitacion/abc?x=1");
    for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)", "", null, undefined, "/a\nb"])
      expect(safeNext(bad as string | null)).toBe("/panel");
    expect(safeNext("x", "/inicio")).toBe("/inicio");
  });
});

import { whatsappUrl } from "@/lib/whatsapp";
import { searchQuery } from "@/lib/search-url";
describe("whatsappUrl", () => {
  it("arma el enlace wa.me solo con números válidos y codifica el mensaje", () => {
    expect(whatsappUrl("+54 9 2494 123456", "Hola & chau")).toBe("https://wa.me/5492494123456?text=Hola%20%26%20chau");
    for (const bad of [null, undefined, "", "123", "abc", "1234567890123456"]) expect(whatsappUrl(bad, "x")).toBeNull();
  });
});
describe("searchQuery", () => {
  it("solo incluye filtros con valor y cambia la página", () => {
    expect(searchQuery({})).toBe("");
    expect(searchQuery({ op: "sale", type: ["house", "lot"], minPrice: 0, sort: "price_asc", page: 1 })).toBe("?op=sale&type=house%2Clot&minPrice=0&sort=price_asc");
    expect(searchQuery({ op: "rent" }, { page: 3 })).toBe("?op=rent&page=3");
  });
});
