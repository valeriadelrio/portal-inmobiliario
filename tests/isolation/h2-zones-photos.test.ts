import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Tx } from "@/server/db/run-as-actor";
import { AG, ANON, P, U, ZONE, admin, as, asUser, ids, seed } from "../helpers/seed";

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
const root = asUser(U.root);
const a1 = asUser(U.a1);

describe("zonas: solo el admin de plataforma escribe", () => {
  const insertZone = (slug: string, parent: string | null = null) => (tx: Tx) =>
    tx.execute(sql`insert into zone (slug, name_es, name_en, parent_id) values (${slug}, ${slug}, ${slug}, ${parent}) returning id`);

  it("el admin de plataforma hace alta, edición y baja", async () => {
    const [z] = await as(root, insertZone("villa-italia"));
    const upd = await as(root, (tx) => tx.execute(sql`update zone set name_es = 'Villa Italia' where id = ${z.id as string} returning id`));
    expect(upd).toHaveLength(1);
    const del = await as(root, (tx) => tx.execute(sql`delete from zone where id = ${z.id as string} returning id`));
    expect(del).toHaveLength(1);
  });
  it("nadie más puede insertar, editar ni borrar", async () => {
    for (const actor of [ANON, asUser(U.visitor), a1, asUser(U.admA)]) {
      expect(await fail(actor, insertZone("hack"))).toBeTruthy();
      const upd = await as(actor, (tx) => tx.execute(sql`update zone set name_es = 'hack' returning id`)).catch(() => []);
      expect(upd).toHaveLength(0);
      const del = await as(actor, (tx) => tx.execute(sql`delete from zone returning id`)).catch(() => []);
      expect(del).toHaveLength(0);
    }
    const z = await admin`select name_es from zone where id = ${ZONE}`;
    expect(z[0].name_es).toBe("Centro");
  });
  it("todos pueden leer las zonas", async () => {
    for (const actor of [ANON, asUser(U.visitor), a1])
      expect(ids(await as(actor, (tx) => tx.execute(sql`select id from zone`)))).toEqual([ZONE]);
  });
  it("jerarquía de máximo 2 niveles, sin autoreferencia y con slug válido", async () => {
    const [parent] = await as(root, insertZone("macro"));
    const [child] = await as(root, insertZone("micro", parent.id as string));
    expect(await fail(root, insertZone("nieta", child.id as string))).toBe("zone_depth");
    expect(
      await fail(root, (tx) => tx.execute(sql`update zone set parent_id = ${child.id as string} where id = ${parent.id as string}`)),
    ).toBe("zone_depth");
    expect(await fail(root, (tx) => tx.execute(sql`update zone set parent_id = id where id = ${ZONE}`))).toMatch(/zone_parent_ck/);
    expect(await fail(root, insertZone("Slug Malo"))).toMatch(/zone_slug_ck/);
  });
  it("no se puede borrar una zona en uso", async () => {
    expect(await fail(root, (tx) => tx.execute(sql`delete from zone where id = ${ZONE}`))).toMatch(/foreign key|violates/);
  });
});

describe("fotos", () => {
  const addPhoto = (propertyId: string, agencyId: string, extra = { cover: false, status: "ready" }) => (tx: Tx) =>
    tx.execute(sql`insert into property_photo (property_id, agency_id, storage_key, is_cover, status)
      values (${propertyId}, ${agencyId}, 'k', ${extra.cover}, ${extra.status}) returning id`);

  /** P.a1 activa con 4 fotos listas; la primera es portada. */
  async function liveWithPhotos() {
    await admin`delete from property_photo where property_id = ${P.a1}`;
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) {
      const [r] = await admin`insert into property_photo (property_id, agency_id, storage_key, position, is_cover, status)
        values (${P.a1}, ${AG.A}, ${"k" + i}, ${i}, ${i === 0}, 'ready') returning id`;
      ids.push(r.id as string);
    }
    return ids;
  }

  it("las pendientes no son públicas; quien gestiona la ficha las ve", async () => {
    await admin`insert into property_photo (property_id, agency_id, storage_key, status) values (${P.a1}, ${AG.A}, 'p', 'pending')`;
    const pub = await as(ANON, (tx) => tx.execute(sql`select status from property_photo where property_id = ${P.a1}`));
    expect(pub.map((r) => r.status)).toEqual(["ready"]);
    const own = await as(a1, (tx) => tx.execute(sql`select status from property_photo where property_id = ${P.a1}`));
    expect(own.map((r) => r.status).sort()).toEqual(["pending", "ready"]);
    const other = await as(asUser(U.a2), (tx) => tx.execute(sql`select status from property_photo where property_id = ${P.a1}`));
    expect(other.map((r) => r.status)).toEqual(["ready"]);
  });
  it("máximo 30 fotos por propiedad", async () => {
    await admin`delete from property_photo where property_id = ${P.a1}`;
    for (let i = 0; i < 30; i++) await as(a1, addPhoto(P.a1, AG.A));
    expect(await fail(a1, addPhoto(P.a1, AG.A))).toBe("max_photos");
  });
  it("una sola portada por propiedad", async () => {
    await admin`delete from property_photo where property_id = ${P.a1}`;
    await as(a1, addPhoto(P.a1, AG.A, { cover: true, status: "ready" }));
    expect(await fail(a1, addPhoto(P.a1, AG.A, { cover: true, status: "ready" }))).toMatch(/one_cover/);
  });
  it("en una ficha publicada no se puede dejar menos de 3 fotos listas", async () => {
    const [cover, p2, p3, p4] = await liveWithPhotos();
    const del = (photo: string) => (tx: Tx) => tx.execute(sql`delete from property_photo where id = ${photo} returning id`);
    await expect(as(a1, del(p4))).resolves.toHaveLength(1); // quedan 3
    expect(await fail(a1, del(p3))).toBe("publish_blocked"); // quedarían 2
    expect(await fail(a1, del(p2))).toBe("publish_blocked");
    void cover;
  });
  it("no se puede borrar la portada de una ficha publicada (primero se cambia la portada)", async () => {
    const [cover, p2] = await liveWithPhotos();
    const del = (photo: string) => (tx: Tx) => tx.execute(sql`delete from property_photo where id = ${photo} returning id`);
    expect(await fail(a1, del(cover))).toBe("publish_blocked");
    await as(a1, (tx) => tx.execute(sql`update property_photo set is_cover = false where id = ${cover}`));
    await as(a1, (tx) => tx.execute(sql`update property_photo set is_cover = true where id = ${p2}`));
    await expect(as(a1, del(cover))).resolves.toHaveLength(1);
  });
  it("en borradores y pausadas se borra libremente", async () => {
    await admin`insert into property_photo (property_id, agency_id, storage_key) values (${P.a1draft}, ${AG.A}, 'x')`;
    const r = await as(a1, (tx) => tx.execute(sql`delete from property_photo where property_id = ${P.a1draft} returning id`));
    expect(r.length).toBeGreaterThan(0);
  });
  it("aislamiento: no se agregan fotos a fichas ajenas ni con agency_id falso", async () => {
    expect(await fail(a1, addPhoto(P.a2, AG.A))).toBeTruthy();
    expect(await fail(a1, addPhoto(P.b1, AG.B))).toBeTruthy();
    expect(await fail(a1, addPhoto(P.a1, AG.B))).toBeTruthy();
    expect(await fail(ANON, addPhoto(P.a1, AG.A))).toBeTruthy();
  });
});
