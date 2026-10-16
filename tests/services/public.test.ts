import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { searchFilters } from "@/contracts";
import { getPublicProperty, listPublicSlugs, searchProperties } from "@/server/services/public";
import { AG, M, P, U, ZONE, admin, id, seed } from "../helpers/seed";

beforeEach(seed);
afterAll(() => admin.end());

const search = async (q: Record<string, string> = {}) => {
  const r = await searchProperties(searchFilters.parse(q));
  if (!r.ok) throw new Error(r.error.message);
  return r.data;
};
const slugs = async (q?: Record<string, string>) => (await search(q)).items.map((i) => i.slug).sort();
const slugOf = (p: string) => `slug-${p}`;

/** Propiedad de prueba con datos controlados. */
async function add(n: number, o: Partial<{ status: string; op: string; type: string; price: number; currency: string; area: number; zone: string; agency: string; agent: string; rooms: number; published: string }> = {}) {
  const pid = id(200 + n);
  await admin`insert into property (id, agency_id, agent_id, operation, type, status, title, description, zone_id, price, currency, total_area_m2, slug, published_at, address_text, show_exact_address)
    values (${pid}, ${o.agency ?? AG.A}, ${o.agent ?? M.a1}, ${o.op ?? "sale"}, ${o.type ?? "house"}, ${o.status ?? "active"}, ${"Prop " + n}, 'Descripción de prueba', ${o.zone ?? ZONE},
      ${o.price ?? 100000}, ${o.currency ?? "USD"}, ${o.area ?? 200}, ${"p" + n}, ${o.published ?? new Date(2026, 0, n).toISOString()}, 'Calle Falsa 123', false)`;
  if ((o.type ?? "house") === "lot") await admin`insert into property_lot (property_id) values (${pid})`;
  else await admin`insert into property_building (property_id, rooms, bedrooms, bathrooms) values (${pid}, ${o.rooms ?? 4}, 2, 1)`;
  return `p${n}`;
}

describe("visibilidad pública", () => {
  it("solo se ve lo activo/reservado/vendido de inmobiliarias aprobadas", async () => {
    // seed: P.a1 y P.a2 y P.b1 activas (aprobadas), borradores, pausada, y activas de agencias pendiente/suspendida
    expect(await slugs()).toEqual([slugOf(P.a1), slugOf(P.a2), slugOf(P.b1)].sort());
    await add(1, { status: "reserved" });
    await add(2, { status: "sold_rented" });
    await add(3, { status: "paused" });
    await add(4, { status: "draft" });
    const s = await slugs();
    expect(s).toEqual(expect.arrayContaining(["p1", "p2"]));
    expect(s).not.toContain("p3");
    expect(s).not.toContain("p4");
  });
  it("una inmobiliaria suspendida desaparece del público", async () => {
    await admin`update agency set status = 'suspended' where id = ${AG.A}`;
    expect(await slugs()).toEqual([slugOf(P.b1)]);
    expect((await getPublicProperty(slugOf(P.a1))).ok && (await getPublicProperty(slugOf(P.a1)) as { data: unknown }).data).toBeNull();
  });
  it("las vendidas/alquiladas van al final", async () => {
    await add(1, { status: "sold_rented", published: new Date(2026, 5, 1).toISOString() });
    const items = (await search()).items;
    expect(items[items.length - 1].status).toBe("sold_rented");
  });
});

describe("filtros", () => {
  beforeEach(async () => {
    await admin`delete from inquiry`;
    await admin`delete from property_photo`;
    await admin`delete from property_lot`;
    await admin`delete from property`;
  });
  it("operación, tipo y múltiples tipos", async () => {
    await add(1, { op: "sale", type: "house" });
    await add(2, { op: "rent", type: "apartment" });
    await add(3, { op: "sale", type: "lot" });
    expect(await slugs({ op: "rent" })).toEqual(["p2"]);
    expect(await slugs({ type: "lot" })).toEqual(["p3"]);
    expect(await slugs({ type: "house,lot" })).toEqual(["p1", "p3"]);
  });
  it("precio por moneda: USD por defecto con filtro, ARS si se pide; sin filtro se muestran ambas", async () => {
    await add(1, { price: 50000, currency: "USD" });
    await add(2, { price: 90000, currency: "USD" });
    await add(3, { price: 50000000, currency: "ARS" });
    expect(await slugs()).toEqual(["p1", "p2", "p3"]);
    expect(await slugs({ minPrice: "60000" })).toEqual(["p2"]);
    expect(await slugs({ maxPrice: "60000" })).toEqual(["p1"]);
    expect(await slugs({ minPrice: "1000000", currency: "ARS" })).toEqual(["p3"]);
    expect(await slugs({ currency: "ARS" })).toEqual(["p3"]);
  });
  it("superficie y ambientes (los lotes no tienen ambientes)", async () => {
    await add(1, { area: 100, rooms: 2 });
    await add(2, { area: 300, rooms: 5 });
    await add(3, { area: 800, type: "lot" });
    expect(await slugs({ minArea: "200" })).toEqual(["p2", "p3"]);
    expect(await slugs({ maxArea: "200" })).toEqual(["p1"]);
    expect(await slugs({ minRooms: "3" })).toEqual(["p2"]);
  });
  it("zona incluye sus subzonas", async () => {
    const parent = id(40), child = id(41);
    await admin`insert into zone (id, slug, name_es) values (${parent}, 'norte', 'Norte')`;
    await admin`insert into zone (id, slug, name_es, parent_id) values (${child}, 'villa-x', 'Villa X', ${parent})`;
    await add(1, { zone: ZONE });
    await add(2, { zone: parent });
    await add(3, { zone: child });
    expect(await slugs({ zone: "centro" })).toEqual(["p1"]);
    expect(await slugs({ zone: "villa-x" })).toEqual(["p3"]);
    expect(await slugs({ zone: "norte" })).toEqual(["p2", "p3"]);
    expect(await slugs({ zone: "norte,centro" })).toEqual(["p1", "p2", "p3"]);
  });
  it("orden por precio y por reciente", async () => {
    await add(1, { price: 300, published: new Date(2026, 0, 1).toISOString() });
    await add(2, { price: 100, published: new Date(2026, 0, 3).toISOString() });
    await add(3, { price: 200, published: new Date(2026, 0, 2).toISOString() });
    const order = async (q: Record<string, string>) => (await search(q)).items.map((i) => i.slug);
    expect(await order({ sort: "recent" })).toEqual(["p2", "p3", "p1"]);
    expect(await order({ sort: "price_asc" })).toEqual(["p2", "p3", "p1"]);
    expect(await order({ sort: "price_desc" })).toEqual(["p1", "p3", "p2"]);
  });
  it("pagina de a 12 y devuelve el total", async () => {
    for (let i = 1; i <= 15; i++) await add(i);
    const p1 = await search();
    const p2 = await search({ page: "2" });
    expect(p1).toMatchObject({ total: 15, page: 1, pageSize: 12 });
    expect(p1.items).toHaveLength(12);
    expect(p2.items).toHaveLength(3);
    expect(new Set([...p1.items, ...p2.items].map((i) => i.id)).size).toBe(15);
  });
  it("las tarjetas traen portada, cantidad de fotos y la inmobiliaria", async () => {
    await add(1);
    await admin`insert into property_photo (property_id, agency_id, storage_key, position, is_cover, status) values
      (${id(201)}, ${AG.A}, 'k0', 0, true, 'ready'), (${id(201)}, ${AG.A}, 'k1', 1, false, 'ready'), (${id(201)}, ${AG.A}, 'k2', 2, false, 'pending')`;
    const [card] = (await search()).items;
    expect(card).toMatchObject({ coverKey: "k0", photoCount: 2, agencyName: "Agencia A", agencySlug: "a", zoneName: "Centro", bedrooms: 2 });
  });
});

describe("ficha pública", () => {
  it("devuelve datos, fotos listas y el agente; oculta la dirección si no se autorizó", async () => {
    await add(1);
    await admin`insert into property_photo (property_id, agency_id, storage_key, position, is_cover, status) values
      (${id(201)}, ${AG.A}, 'k0', 0, true, 'ready'), (${id(201)}, ${AG.A}, 'k1', 1, false, 'pending')`;
    await admin`update agency_member set display_name = 'Ana', public_whatsapp = '5492494000000' where id = ${M.a1}`;
    const r = await getPublicProperty("p1");
    if (!r.ok || !r.data) throw new Error("sin ficha");
    expect(r.data).toMatchObject({ title: "Prop 1", agencyName: "Agencia A", address: null, photos: [{ storageKey: "k0", isCover: true }] });
    expect(r.data.agent).toMatchObject({ displayName: "Ana", publicWhatsapp: "5492494000000" });
    expect(r.data.detail.kind).toBe("building");
    await admin`update property set show_exact_address = true where id = ${id(201)}`;
    const shown = await getPublicProperty("p1");
    expect(shown.ok && shown.data?.address).toBe("Calle Falsa 123");
  });
  it("no filtra datos privados (emails de cuentas, coordenadas, ids internos de usuario)", async () => {
    await add(1);
    await admin`update property set lat = -37.32, lng = -59.13 where id = ${id(201)}`;
    const json = JSON.stringify(await getPublicProperty("p1"));
    for (const secret of ["a1@x.com", "admA@x.com", "-37.32", "-59.13", U.a1, "token_hash"]) expect(json).not.toContain(secret);
  });
  it("lote: trae los datos de lote", async () => {
    await add(1, { type: "lot" });
    await admin`update property_lot set frontage_m = 10, services = '["water","gas"]'::jsonb, is_corner = true where property_id = ${id(201)}`;
    const r = await getPublicProperty("p1");
    expect(r.ok && r.data?.detail).toMatchObject({ kind: "lot", frontageM: 10, services: ["water", "gas"], isCorner: true });
  });
  it("borradores, pausadas, inexistentes y slugs raros devuelven null", async () => {
    await add(1, { status: "draft" });
    await add(2, { status: "paused" });
    for (const s of ["p1", "p2", "no-existe", "../etc", "A B", "x".repeat(200)]) expect(await getPublicProperty(s)).toEqual({ ok: true, data: null });
  });
  it("reservada y vendida siguen visibles con su estado", async () => {
    await add(1, { status: "reserved" });
    await add(2, { status: "sold_rented" });
    expect((await getPublicProperty("p1") as { data: { status: string } }).data.status).toBe("reserved");
    expect((await getPublicProperty("p2") as { data: { status: string } }).data.status).toBe("sold_rented");
  });
});

describe("sitemap", () => {
  it("solo lista activas y reservadas", async () => {
    await add(1, { status: "reserved" });
    await add(2, { status: "sold_rented" });
    await add(3, { status: "draft" });
    const r = await listPublicSlugs();
    const s = r.ok ? r.data.map((x) => x.slug) : [];
    expect(s).toContain("p1");
    expect(s).not.toContain("p2");
    expect(s).not.toContain("p3");
    expect(s).toContain(slugOf(P.a1));
  });
});
