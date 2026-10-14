import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Actor, PropertyInput } from "@/contracts";
import { changeStatus, createProperty, deleteProperty, getProperty, listMyProperties, updateProperty } from "@/server/services/property";
import { AG, ANON, M, P, U, ZONE, admin, asUser, seed } from "../helpers/seed";

beforeEach(seed);
afterAll(() => admin.end());

const member = (userId: string, agencyId: string, memberId: string, role: "agent" | "agency_admin"): Actor => ({
  kind: "user", userId, platformAdmin: false, membership: { agencyId, memberId, role },
});
const admA = member(U.admA, AG.A, M.admA, "agency_admin");
const a1 = member(U.a1, AG.A, M.a1, "agent");
const a2 = member(U.a2, AG.A, M.a2, "agent");
const b1 = member(U.b1, AG.B, M.b1, "agent");
const visitor = asUser(U.visitor);
const code = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? "ok" : r.error!.code);

const lot: PropertyInput = {
  type: "lot", operation: "sale", title: "Lote en el centro", description: "Lote plano de 300 m2 listo para construir",
  language: "es", zoneId: ZONE, showExactAddress: false, price: 45000, currency: "USD", totalAreaM2: 300,
  services: ["water", "electricity"], isCorner: true, frontageM: 10, depthM: 30,
};
const house: PropertyInput = {
  type: "house", operation: "rent", title: "Casa con jardín", description: "Casa de tres dormitorios con jardín amplio",
  language: "es", zoneId: ZONE, showExactAddress: true, price: 600000, currency: "ARS", totalAreaM2: 200, coveredAreaM2: 120,
  rooms: 4, bedrooms: 3, bathrooms: 2, garages: 1, amenities: ["parrilla"],
};
const idOf = (r: { ok: boolean; data?: { id: string } }) => (r.ok ? r.data!.id : "");

async function givePhotos(propertyId: string, agencyId: string, n = 3) {
  await admin`delete from property_photo where property_id = ${propertyId}`;
  for (let i = 0; i < n; i++)
    await admin`insert into property_photo (property_id, agency_id, storage_key, position, is_cover, status)
      values (${propertyId}, ${agencyId}, ${"k" + i}, ${i}, ${i === 0}, 'ready')`;
}

describe("crear", () => {
  it("un agente crea un lote y una casa como borrador, a su nombre y con slug propio", async () => {
    const l = await createProperty(a1, lot);
    const h = await createProperty(a1, house);
    expect(l.ok && h.ok).toBe(true);
    const rows = await admin`select p.status, p.agent_id, p.agency_id, p.slug, p.type, p.price::float price from property p
      where p.id in (${idOf(l)}, ${idOf(h)}) order by p.type`;
    expect(rows.map((r) => [r.type, r.status, r.agent_id, r.agency_id])).toEqual([
      ["house", "draft", M.a1, AG.A], ["lot", "draft", M.a1, AG.A],
    ]);
    expect(new Set(rows.map((r) => r.slug)).size).toBe(2);
    expect((await admin`select 1 from property_lot where property_id = ${idOf(l)}`).length).toBe(1);
    expect((await admin`select 1 from property_building where property_id = ${idOf(h)}`).length).toBe(1);
  });
  it("precio en USD o ARS se guarda tal cual, sin conversión", async () => {
    const h = await createProperty(a1, house);
    const r = await admin`select price::float, currency from property where id = ${idOf(h)}`;
    expect(r[0]).toMatchObject({ price: 600000, currency: "ARS" });
  });
  it("no deja datos inválidos: tipo con campos de otro tipo, precio, superficie", async () => {
    expect(code(await createProperty(a1, { ...lot, price: -1 }))).toBe("validation");
    expect(code(await createProperty(a1, { ...house, coveredAreaM2: 999 } as PropertyInput))).toBe("validation"); // cubierta > total lo frena la base
    expect(code(await createProperty(a1, { ...lot, title: "x" }))).toBe("validation");
  });
  it("nadie sin inmobiliaria aprobada crea; el agencyId nunca viene del cliente", async () => {
    expect(code(await createProperty(ANON, lot))).toBe("unauthenticated");
    expect(code(await createProperty(visitor, lot))).toBe("forbidden");
    const forged = { ...lot, agencyId: AG.B } as PropertyInput;
    const r = await createProperty(a1, forged);
    expect((await admin`select agency_id from property where id = ${idOf(r)}`)[0].agency_id).toBe(AG.A);
  });
  it("un agente no crea a nombre de otro; el admin sí, solo de su inmobiliaria", async () => {
    expect(code(await createProperty(a1, lot, M.a2))).toBe("forbidden");
    const ok1 = await createProperty(admA, lot, M.a2);
    expect((await admin`select agent_id from property where id = ${idOf(ok1)}`)[0].agent_id).toBe(M.a2);
    expect(code(await createProperty(admA, lot, M.b1))).toBe("forbidden"); // agente de otra inmobiliaria
  });
  it("una zona inactiva no sirve", async () => {
    await admin`update zone set is_active = false`;
    expect(code(await createProperty(a1, lot))).toBe("zone_inactive");
  });
});

describe("leer y editar", () => {
  it("getProperty devuelve la ficha completa y los bloqueos de publicación", async () => {
    const l = await createProperty(a1, lot);
    const g = await getProperty(a1, idOf(l));
    if (!g.ok) throw new Error(g.error.message);
    expect(g.data).toMatchObject({ type: "lot", status: "draft", price: 45000, currency: "USD", isCorner: true, frontageM: 10, services: ["water", "electricity"] });
    expect(g.data.blockers).toEqual(expect.arrayContaining(["min_photos", "no_cover"]));
    await givePhotos(idOf(l), AG.A);
    const g2 = await getProperty(a1, idOf(l));
    expect(g2.ok && g2.data.blockers).toEqual([]);
  });
  it("edita todos los campos del lote y de la casa", async () => {
    const l = await createProperty(a1, lot);
    expect((await updateProperty(a1, idOf(l), { ...lot, title: "Lote editado", price: 50000, isCorner: false, services: [] })).ok).toBe(true);
    const h = await createProperty(a1, house);
    expect((await updateProperty(a1, idOf(h), { ...house, bedrooms: 4, amenities: ["pileta", "parrilla"] })).ok).toBe(true);
    const gl = await getProperty(a1, idOf(l));
    const gh = await getProperty(a1, idOf(h));
    expect(gl.ok && gl.data).toMatchObject({ title: "Lote editado", price: 50000, isCorner: false, services: [] });
    expect(gh.ok && gh.data).toMatchObject({ bedrooms: 4, amenities: ["pileta", "parrilla"] });
  });
  it("el tipo y el slug no cambian", async () => {
    const l = await createProperty(a1, lot);
    expect(code(await updateProperty(a1, idOf(l), house))).toBe("immutable_field");
    const before = await admin`select slug from property where id = ${idOf(l)}`;
    await updateProperty(a1, idOf(l), { ...lot, title: "Otro título totalmente distinto" });
    expect((await admin`select slug from property where id = ${idOf(l)}`)[0].slug).toBe(before[0].slug);
  });
  it("aislamiento: un agente no ve ni edita las de un compañero; otra inmobiliaria tampoco", async () => {
    const mine = await createProperty(a1, lot);
    expect(code(await getProperty(a2, idOf(mine)))).toBe("not_found");
    expect(code(await updateProperty(a2, idOf(mine), lot))).toBe("not_found");
    expect(code(await getProperty(b1, idOf(mine)))).toBe("not_found");
    expect(code(await updateProperty(b1, idOf(mine), lot))).toBe("not_found");
    expect(code(await changeStatus(b1, idOf(mine), "paused"))).toBe("not_found");
    expect(code(await getProperty(visitor, idOf(mine)))).toBe("forbidden");
    expect(code(await getProperty(ANON, idOf(mine)))).toBe("unauthenticated");
    expect(await getProperty(admA, idOf(mine))).toMatchObject({ ok: true }); // el admin de la inmobiliaria sí
    expect(code(await updateProperty(a2, P.a1, lot))).toBe("forbidden"); // activa y pública de un compañero: la ve pero no la edita
    expect((await admin`select title from property where id = ${P.a1}`)[0].title).toBe("Lote");
  });
});

describe("listado", () => {
  it("agente: solo las suyas; admin: todas las de su inmobiliaria; nunca las de otra", async () => {
    const l1 = await listMyProperties(a1);
    expect(l1.ok && l1.data.items.map((i) => i.id).sort()).toEqual([P.a1, P.a1draft, P.a1paused].sort());
    const l2 = await listMyProperties(admA);
    expect(l2.ok && l2.data.total).toBe(5);
    const lb = await listMyProperties(b1);
    expect(lb.ok && lb.data.items.map((i) => i.id).sort()).toEqual([P.b1, P.bdraft].sort());
    expect(code(await listMyProperties(visitor))).toBe("forbidden");
    expect(code(await listMyProperties(ANON))).toBe("unauthenticated");
  });
  it("filtra por estado y operación, devuelve la portada y pagina", async () => {
    const drafts = await listMyProperties(admA, { status: "draft" });
    expect(drafts.ok && drafts.data.items.map((i) => i.id).sort()).toEqual([P.a1draft, P.a2draft].sort());
    await createProperty(a1, house);
    const rent = await listMyProperties(a1, { operation: "rent" });
    expect(rent.ok && rent.data.items).toHaveLength(1);
    await givePhotos(P.a1, AG.A);
    const withCover = await listMyProperties(a1, { status: "active" });
    expect(withCover.ok && withCover.data.items[0].coverKey).toBe("k0");
    for (let i = 0; i < 22; i++) await createProperty(a1, { ...lot, title: `Lote número ${i}` });
    const p1 = await listMyProperties(a1, { page: 1 });
    const p2 = await listMyProperties(a1, { page: 2 });
    expect(p1.ok && p1.data.items).toHaveLength(20);
    expect(p2.ok && p2.data.items.length).toBeGreaterThan(0);
    expect(p1.ok && p1.data.total).toBe(3 + 1 + 22);
  });
});

describe("estados", () => {
  it("no publica sin 3 fotos y portada; con fotos sí, y se puede reservar, vender y pausar", async () => {
    const l = await createProperty(a1, lot);
    const id = idOf(l);
    expect(code(await changeStatus(a1, id, "active"))).toBe("publish_blocked");
    expect(code(await changeStatus(a1, id, "reserved"))).toBe("invalid_transition");
    await givePhotos(id, AG.A);
    expect((await changeStatus(a1, id, "active")).ok).toBe(true);
    expect((await changeStatus(a1, id, "reserved")).ok).toBe(true);
    expect((await changeStatus(a1, id, "sold_rented")).ok).toBe(true);
    expect((await changeStatus(a1, id, "paused")).ok).toBe(true);
    expect(code(await changeStatus(a1, id, "draft"))).toBe("invalid_transition"); // jamás vuelve a borrador
  });
  it("un compañero no cambia el estado de una ajena", async () => {
    expect(code(await changeStatus(a2, P.a1, "paused"))).toBe("not_found");
    expect((await admin`select status from property where id = ${P.a1}`)[0].status).toBe("active");
    expect((await changeStatus(admA, P.a1, "paused")).ok).toBe(true); // su admin sí
  });
  it("no publica si la inmobiliaria se suspende", async () => {
    const l = await createProperty(a1, lot);
    await givePhotos(idOf(l), AG.A);
    await admin`update agency set status = 'suspended' where id = ${AG.A}`;
    // con la agencia suspendida el actor ya no tiene membresía efectiva en la base
    expect(["publish_blocked", "forbidden", "not_found"]).toContain(code(await changeStatus(a1, idOf(l), "active")));
  });
});

describe("borrar", () => {
  it("borra borradores y pausadas; las activas hay que pausarlas primero", async () => {
    expect((await deleteProperty(a1, P.a1draft)).ok).toBe(true);
    expect((await deleteProperty(a1, P.a1paused)).ok).toBe(true);
    expect(code(await deleteProperty(a1, P.a1))).toBe("conflict");
    expect((await admin`select 1 from property where id = ${P.a1}`).length).toBe(1);
  });
  it("con consultas no se borra (aunque esté pausada)", async () => {
    await admin`update property set status = 'paused' where id = ${P.a1}`;
    expect(code(await deleteProperty(a1, P.a1))).toBe("in_use");
  });
  it("no borra las de otros", async () => {
    expect(code(await deleteProperty(a2, P.a1draft))).toBe("not_found");
    expect(code(await deleteProperty(b1, P.a1draft))).toBe("not_found");
    expect(code(await deleteProperty(visitor, P.a1draft))).toBe("forbidden");
    expect(code(await deleteProperty(ANON, P.a1draft))).toBe("unauthenticated");
  });
});
