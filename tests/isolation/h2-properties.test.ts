import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Tx } from "@/server/db/run-as-actor";
import { AG, ANON, M, P, U, ZONE, admin, as, asUser, id, seed } from "../helpers/seed";

beforeEach(seed);
afterAll(() => admin.end());

async function failure(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "NO_ERROR";
  } catch (e) {
    const err = e as { cause?: { message?: string }; message?: string };
    return err.cause?.message ?? err.message ?? "unknown";
  }
}
const fail = (actor: Parameters<typeof as>[0], fn: (tx: Tx) => Promise<unknown>) => failure(as(actor, fn));

const a1 = asUser(U.a1);
const setStatus = (propertyId: string, status: string) => (tx: Tx) =>
  tx.execute(sql`update property set status = ${status} where id = ${propertyId} returning id`);

/** Deja una propiedad con n fotos listas; la primera es la portada. */
async function givePhotos(propertyId: string, agencyId: string, n: number, cover = true) {
  await admin`delete from property_photo where property_id = ${propertyId}`;
  for (let i = 0; i < n; i++)
    await admin`insert into property_photo (property_id, agency_id, storage_key, position, is_cover, status)
      values (${propertyId}, ${agencyId}, ${"k" + i}, ${i}, ${cover && i === 0}, 'ready')`;
}

describe("creación", () => {
  const insert = (status: string, slug: string, agent = M.a1) => (tx: Tx) =>
    tx.execute(sql`insert into property (agency_id, agent_id, operation, type, status, title, description, zone_id,
      price, currency, total_area_m2, slug) values (${AG.A}, ${agent}, 'sale', 'lot', ${status}, 'Lote nuevo',
      'Descripción larga de prueba', ${ZONE}, 1000, 'ARS', 300, ${slug})`);

  it("nace siempre como borrador; insertar directamente como activa falla", async () => {
    await expect(as(a1, insert("draft", "nuevo-1"))).resolves.toBeDefined();
    expect(await fail(a1, insert("active", "nuevo-2"))).toBe("invalid_transition");
    expect(await fail(a1, insert("sold_rented", "nuevo-3"))).toBe("invalid_transition");
  });
  it("rechaza slugs inválidos, precio no positivo y superficie cubierta mayor a la total", async () => {
    expect(await fail(a1, insert("draft", "Con Mayus"))).toMatch(/property_slug_ck/);
    const bad = (extra: string) => (tx: Tx) =>
      tx.execute(sql.raw(`insert into property (agency_id, agent_id, operation, type, title, description, zone_id,
        price, total_area_m2, covered_area_m2, slug) values ('${AG.A}', '${M.a1}', 'sale', 'house', 'x', 'y', '${ZONE}',
        ${extra}, 'ok-slug')`));
    expect(await fail(a1, bad("0, 100, 50"))).toMatch(/property_price_ck/);
    expect(await fail(a1, bad("100, 100, 200"))).toMatch(/property_covered_ck/);
  });
  it("no se puede usar una zona inactiva", async () => {
    await admin`update zone set is_active = false where id = ${ZONE}`;
    expect(await fail(a1, insert("draft", "nuevo-4"))).toBe("zone_inactive");
  });
});

describe("publicación", () => {
  it("con menos de 3 fotos listas no se publica", async () => {
    await givePhotos(P.a1draft, AG.A, 2);
    expect(await fail(a1, setStatus(P.a1draft, "active"))).toBe("publish_blocked");
  });
  it("las fotos pendientes no cuentan", async () => {
    await givePhotos(P.a1draft, AG.A, 3);
    await admin`update property_photo set status = 'pending' where property_id = ${P.a1draft} and position = 2`;
    expect(await fail(a1, setStatus(P.a1draft, "active"))).toBe("publish_blocked");
  });
  it("sin portada no se publica", async () => {
    await givePhotos(P.a1draft, AG.A, 3, false);
    expect(await fail(a1, setStatus(P.a1draft, "active"))).toBe("publish_blocked");
  });
  it("con la zona inactiva no se publica", async () => {
    await givePhotos(P.a1draft, AG.A, 3);
    await admin`update zone set is_active = false`;
    expect(await fail(a1, setStatus(P.a1draft, "active"))).toBe("publish_blocked");
  });
  it("con 3 fotos listas y portada se publica, y published_at se fija una sola vez", async () => {
    await givePhotos(P.a1draft, AG.A, 3);
    await as(a1, setStatus(P.a1draft, "active"));
    const first = await admin`select status, published_at from property where id = ${P.a1draft}`;
    expect(first[0].status).toBe("active");
    expect(first[0].published_at).not.toBeNull();

    await as(a1, setStatus(P.a1draft, "paused"));
    await new Promise((r) => setTimeout(r, 20));
    await as(a1, setStatus(P.a1draft, "active"));
    const again = await admin`select published_at from property where id = ${P.a1draft}`;
    expect(again[0].published_at).toEqual(first[0].published_at);
  });
  it("el cliente no puede fijar published_at a mano", async () => {
    await as(a1, (tx) => tx.execute(sql`update property set published_at = '2000-01-01' where id = ${P.a1draft}`));
    const r = await admin`select published_at from property where id = ${P.a1draft}`;
    expect(r[0].published_at).toBeNull();
  });
});

describe("transiciones", () => {
  it("las inválidas fallan (borrador→vendida, activa→borrador)", async () => {
    expect(await fail(a1, setStatus(P.a1draft, "sold_rented"))).toBe("invalid_transition");
    expect(await fail(a1, setStatus(P.a1draft, "reserved"))).toBe("invalid_transition");
    expect(await fail(a1, setStatus(P.a1, "draft"))).toBe("invalid_transition");
  });
  it("las válidas funcionan y registran status_changed_at", async () => {
    const before = await admin`select status_changed_at from property where id = ${P.a1}`;
    await new Promise((r) => setTimeout(r, 20));
    await as(a1, setStatus(P.a1, "reserved"));
    await as(a1, setStatus(P.a1, "sold_rented"));
    const after = await admin`select status, status_changed_at from property where id = ${P.a1}`;
    expect(after[0].status).toBe("sold_rented");
    expect(new Date(after[0].status_changed_at as string) > new Date(before[0].status_changed_at as string)).toBe(true);
  });
  it("el admin de plataforma puede moderar (volver a borrador)", async () => {
    const r = await as(asUser(U.root), setStatus(P.a1, "draft"));
    expect(r).toHaveLength(1);
  });
  it("campos inmutables: tipo, slug y agencia", async () => {
    expect(await fail(a1, (tx) => tx.execute(sql`update property set type = 'house' where id = ${P.a1}`))).toBe("immutable_field");
    expect(await fail(a1, (tx) => tx.execute(sql`update property set slug = 'otro' where id = ${P.a1}`))).toBe("immutable_field");
    expect(await fail(a1, (tx) => tx.execute(sql`update property set agency_id = ${AG.B} where id = ${P.a1}`))).toBeTruthy();
  });
  it("mover una ficha a una zona inactiva falla", async () => {
    const z2 = id(31);
    await admin`insert into zone (id, slug, name_es, is_active) values (${z2}, 'cerrada', 'Cerrada', false)`;
    expect(await fail(a1, (tx) => tx.execute(sql`update property set zone_id = ${z2} where id = ${P.a1}`))).toBe("zone_inactive");
  });
});

describe("borrado", () => {
  const del = (propertyId: string) => (tx: Tx) => tx.execute(sql`delete from property where id = ${propertyId} returning id`);
  it("borra borradores y pausadas; no activas, reservadas ni vendidas", async () => {
    expect(await as(a1, del(P.a1draft))).toHaveLength(1);
    expect(await as(a1, del(P.a1paused))).toHaveLength(1);
    expect(await as(a1, del(P.a1))).toHaveLength(0);
    for (const st of ["reserved", "sold_rented"]) {
      await admin`update property set status = ${st} where id = ${P.a1}`;
      expect(await as(a1, del(P.a1))).toHaveLength(0);
    }
  });
  it("una pausada con consultas no se puede borrar (se conservan las consultas)", async () => {
    await admin`update property set status = 'paused' where id = ${P.a1}`;
    expect(await fail(a1, del(P.a1))).toMatch(/foreign key|violates/);
  });
  it("borrar la ficha arrastra sus fotos sin que el trigger de fotos lo impida", async () => {
    await givePhotos(P.a1draft, AG.A, 3);
    await as(a1, del(P.a1draft));
    const left = await admin`select count(*)::int n from property_photo where property_id = ${P.a1draft}`;
    expect(left[0].n).toBe(0);
  });
  it("no se borran propiedades ajenas", async () => {
    expect(await as(a1, del(P.a2draft))).toHaveLength(0);
    expect(await as(asUser(U.admB), del(P.a2draft))).toHaveLength(0);
    expect(await as(ANON, del(P.a1draft))).toHaveLength(0);
  });
});

describe("tablas hijas coherentes con el tipo", () => {
  it("property_lot solo para lotes y property_building solo para el resto", async () => {
    const house = id(70);
    await admin`insert into property (id, agency_id, agent_id, operation, type, title, description, zone_id, price,
      total_area_m2, slug) values (${house}, ${AG.A}, ${M.a1}, 'sale', 'house', 'Casa', 'Descripción', ${ZONE}, 1, 1, 'casa-70')`;
    expect(await failure(admin`insert into property_lot (property_id) values (${house})`.then())).toMatch(/wrong_type/);
    expect(await failure(admin`insert into property_building (property_id, rooms, bedrooms, bathrooms) values (${P.a1}, 1, 1, 1)`.then()))
      .toMatch(/wrong_type/);
    await expect(
      admin`insert into property_building (property_id, rooms, bedrooms, bathrooms) values (${house}, 3, 2, 1)`.then(),
    ).resolves.toBeDefined();
  });
  it("un agente no escribe el detalle de la ficha de otro", async () => {
    const r = await as(a1, (tx) => tx.execute(sql`update property_lot set is_corner = true where property_id = ${P.a1} returning property_id`));
    expect(r).toHaveLength(1);
    await admin`insert into property_lot (property_id) values (${P.a2})`; // existe, pero es de otro agente
    const other = await as(a1, (tx) => tx.execute(sql`update property_lot set is_corner = true where property_id = ${P.a2} returning property_id`));
    expect(other).toHaveLength(0);
    const still = await admin`select is_corner from property_lot where property_id = ${P.a2}`;
    expect(still[0].is_corner).toBe(false);
  });
});
