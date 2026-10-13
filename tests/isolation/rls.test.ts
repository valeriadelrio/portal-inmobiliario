import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "@/contracts";
import { runAsActor, type Tx } from "@/server/db/run-as-actor";
import { testClients } from "../helpers/db";

const { admin, db } = testClients();

// ---- ids fijos ----------------------------------------------------------------------
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const AG = { A: id(1), B: id(2), PENDING: id(3), SUSPENDED: id(4) };
const U = { a1: id(11), a2: id(12), admA: id(13), b1: id(14), admB: id(15), visitor: id(16), root: id(17), pend: id(18), susp: id(19) };
const M = { a1: id(21), a2: id(22), admA: id(23), b1: id(24), admB: id(25), pend: id(26), susp: id(27) };
const ZONE = id(30);
const P = {
  a1: id(41), a1draft: id(42), a2: id(43), a2draft: id(44), b1: id(45), bdraft: id(46),
  pending: id(47), susp: id(48), a1paused: id(49),
};
const INQ = { a1: id(61), a2: id(62), b1: id(63) };

const asUser = (userId: string): Actor => ({ kind: "user", userId, platformAdmin: false, membership: null });
const ANON: Actor = { kind: "anonymous" };
const as = <T>(actor: Actor, fn: (tx: Tx) => Promise<T>) => runAsActor(db, actor, fn);
const ids = (rows: Iterable<Record<string, unknown>>) => [...rows].map((r) => r.id as string).sort();
const sorted = (...x: string[]) => [...x].sort();

async function seed() {
  await admin.unsafe(`truncate audit_log, favorite, inquiry, property_photo, property_lot, property_building,
    property, agency_member, zone, user_profile, agency restart identity cascade`);

  const agencies = [
    [AG.A, "Agencia A", "a", "approved"], [AG.B, "Agencia B", "b", "approved"],
    [AG.PENDING, "Pendiente", "pend", "pending"], [AG.SUSPENDED, "Suspendida", "susp", "suspended"],
  ];
  for (const [i, n, s, st] of agencies)
    await admin`insert into agency (id, name, slug, status) values (${i}, ${n}, ${s}, ${st})`;

  const users: [string, string, string | null][] = [
    [U.a1, "a1@x.com", null], [U.a2, "a2@x.com", null], [U.admA, "admA@x.com", null], [U.b1, "b1@x.com", null],
    [U.admB, "admB@x.com", null], [U.visitor, "visitor@x.com", null], [U.root, "root@x.com", "platform_admin"],
    [U.pend, "pend@x.com", null], [U.susp, "susp@x.com", null],
  ];
  for (const [i, e, r] of users) await admin`insert into user_profile (id, email, platform_role) values (${i}, ${e}, ${r})`;

  const members: [string, string, string, string][] = [
    [M.a1, AG.A, U.a1, "agent"], [M.a2, AG.A, U.a2, "agent"], [M.admA, AG.A, U.admA, "agency_admin"],
    [M.b1, AG.B, U.b1, "agent"], [M.admB, AG.B, U.admB, "agency_admin"],
    [M.pend, AG.PENDING, U.pend, "agent"], [M.susp, AG.SUSPENDED, U.susp, "agent"],
  ];
  for (const [i, a, u, r] of members)
    await admin`insert into agency_member (id, agency_id, user_id, role, status) values (${i}, ${a}, ${u}, ${r}, 'active')`;

  await admin`insert into zone (id, slug, name_es) values (${ZONE}, 'centro', 'Centro')`;

  const props: [string, string, string, string][] = [
    [P.a1, AG.A, M.a1, "active"], [P.a1draft, AG.A, M.a1, "draft"], [P.a1paused, AG.A, M.a1, "paused"],
    [P.a2, AG.A, M.a2, "active"], [P.a2draft, AG.A, M.a2, "draft"],
    [P.b1, AG.B, M.b1, "active"], [P.bdraft, AG.B, M.b1, "draft"],
    [P.pending, AG.PENDING, M.pend, "active"], [P.susp, AG.SUSPENDED, M.susp, "active"],
  ];
  for (const [i, a, m, st] of props)
    await admin`insert into property (id, agency_id, agent_id, operation, type, status, title, description, zone_id,
      price, currency, total_area_m2, slug)
      values (${i}, ${a}, ${m}, 'sale', 'lot', ${st}, 'Lote', 'Descripción de prueba', ${ZONE}, 1000, 'USD', 300, ${"slug-" + i})`;

  await admin`insert into property_lot (property_id) values (${P.a1}), (${P.a1draft})`;
  await admin`insert into property_photo (property_id, agency_id, storage_key) values
    (${P.a1}, ${AG.A}, 'k1'), (${P.a1draft}, ${AG.A}, 'k2')`;

  for (const [i, p, a, m] of [[INQ.a1, P.a1, AG.A, M.a1], [INQ.a2, P.a2, AG.A, M.a2], [INQ.b1, P.b1, AG.B, M.b1]])
    await admin`insert into inquiry (id, property_id, agency_id, agent_id, name, email, message, consent_at)
      values (${i}, ${p}, ${a}, ${m}, 'Ana', 'ana@x.com', 'Hola me interesa', now())`;

  await admin`insert into favorite (user_id, property_id) values (${U.visitor}, ${P.a1}), (${U.a1}, ${P.b1})`;
}

beforeEach(seed);
afterAll(() => admin.end());

describe("lectura pública (anónimo)", () => {
  it("ve activas de agencias aprobadas; no borradores, pausadas, ni agencias pendientes/suspendidas", async () => {
    const rows = await as(ANON, (tx) => tx.execute(sql`select id from property`));
    expect(ids(rows)).toEqual(sorted(P.a1, P.a2, P.b1));
  });
  it("solo ve agencias aprobadas", async () => {
    const rows = await as(ANON, (tx) => tx.execute(sql`select id from agency`));
    expect(ids(rows)).toEqual(sorted(AG.A, AG.B));
  });
  it("ve fotos y detalle solo de propiedades visibles", async () => {
    const photos = await as(ANON, (tx) => tx.execute(sql`select property_id as id from property_photo`));
    expect(ids(photos)).toEqual([P.a1]);
    const lots = await as(ANON, (tx) => tx.execute(sql`select property_id as id from property_lot`));
    expect(ids(lots)).toEqual([P.a1]);
  });
  it("no ve consultas, perfiles ni favoritos", async () => {
    expect(await as(ANON, (tx) => tx.execute(sql`select 1 from inquiry`))).toHaveLength(0);
    expect(await as(ANON, (tx) => tx.execute(sql`select 1 from user_profile`))).toHaveLength(0);
    expect(await as(ANON, (tx) => tx.execute(sql`select 1 from favorite`))).toHaveLength(0);
  });
  it("no puede escribir propiedades", async () => {
    await expect(as(ANON, (tx) => tx.execute(sql`update property set title = 'hack'`))).resolves.toHaveLength(0);
    const t = await admin`select count(*)::int n from property where title = 'hack'`;
    expect(t[0].n).toBe(0);
  });
  it("no tiene acceso a audit_log", async () => {
    await expect(as(ANON, (tx) => tx.execute(sql`select * from audit_log`))).rejects.toThrow();
  });
});

describe("visitante con cuenta", () => {
  it("ve lo público y sus propios favoritos, no los ajenos", async () => {
    const props = await as(asUser(U.visitor), (tx) => tx.execute(sql`select id from property`));
    expect(ids(props)).toEqual(sorted(P.a1, P.a2, P.b1));
    const favs = await as(asUser(U.visitor), (tx) => tx.execute(sql`select property_id as id from favorite`));
    expect(ids(favs)).toEqual([P.a1]);
  });
  it("ve solo su perfil (los emails ajenos no son visibles)", async () => {
    const rows = await as(asUser(U.visitor), (tx) => tx.execute(sql`select id from user_profile`));
    expect(ids(rows)).toEqual([U.visitor]);
  });
  it("no puede darse rol de plataforma ni editar el de otros", async () => {
    const err = await as(asUser(U.visitor), (tx) =>
      tx.execute(sql`update user_profile set platform_role = 'platform_admin'`),
    ).catch((e) => e);
    expect(String(err?.cause?.message ?? err?.message)).toMatch(/permission denied/);
    const r = await admin`select platform_role from user_profile where id = ${U.visitor}`;
    expect(r[0].platform_role).toBeNull();
  });
  it("no puede crear una propiedad ni un favorito a nombre de otro", async () => {
    await expect(
      as(asUser(U.visitor), (tx) => tx.execute(sql`insert into property (agency_id, agent_id, operation, type, title,
        description, zone_id, price, total_area_m2, slug) values (${AG.A}, ${M.a1}, 'sale', 'lot', 'x', 'y', ${ZONE}, 1, 1, 'hack')`)),
    ).rejects.toThrow();
    await expect(
      as(asUser(U.visitor), (tx) => tx.execute(sql`insert into favorite (user_id, property_id) values (${U.a1}, ${P.a1})`)),
    ).rejects.toThrow();
  });
});

describe("agente de la agencia A", () => {
  const a1 = asUser(U.a1);
  it("ve lo público más sus propios borradores y pausadas; no los de otro agente ni de otra agencia", async () => {
    const rows = await as(a1, (tx) => tx.execute(sql`select id from property`));
    expect(ids(rows)).toEqual(sorted(P.a1, P.a1draft, P.a1paused, P.a2, P.b1));
  });
  it("edita sus propiedades", async () => {
    const r = await as(a1, (tx) => tx.execute(sql`update property set title = 'Nuevo' where id = ${P.a1} returning id`));
    expect(r).toHaveLength(1);
  });
  it("NO edita las de otro agente de su agencia ni las de otra agencia (0 filas)", async () => {
    for (const p of [P.a2, P.a2draft, P.b1, P.bdraft]) {
      const r = await as(a1, (tx) => tx.execute(sql`update property set title = 'hack' where id = ${p} returning id`));
      expect(r).toHaveLength(0);
      const d = await as(a1, (tx) => tx.execute(sql`delete from property where id = ${p} returning id`));
      expect(d).toHaveLength(0);
    }
    const t = await admin`select count(*)::int n from property where title = 'hack'`;
    expect(t[0].n).toBe(0);
  });
  it("no puede mover su propiedad a otra agencia ni a otro agente", async () => {
    await expect(
      as(a1, (tx) => tx.execute(sql`update property set agency_id = ${AG.B}, agent_id = ${M.b1} where id = ${P.a1}`)),
    ).rejects.toThrow();
    await expect(
      as(a1, (tx) => tx.execute(sql`update property set agent_id = ${M.a2} where id = ${P.a1}`)),
    ).rejects.toThrow();
  });
  it("no puede crear propiedades en otra agencia, ni a nombre de otro agente", async () => {
    const ins = (agency: string, agent: string, slug: string) => (tx: Tx) =>
      tx.execute(sql`insert into property (agency_id, agent_id, operation, type, title, description, zone_id, price,
        total_area_m2, slug) values (${agency}, ${agent}, 'sale', 'lot', 'x', 'y', ${ZONE}, 1, 1, ${slug})`);
    await expect(as(a1, ins(AG.B, M.b1, "s1"))).rejects.toThrow();
    await expect(as(a1, ins(AG.A, M.a2, "s2"))).rejects.toThrow();
    await expect(as(a1, ins(AG.A, M.a1, "ok-a1"))).resolves.toBeDefined();
  });
  it("fotos: agrega a su propiedad; no a la ajena ni con agency_id falso", async () => {
    const add = (prop: string, agency: string) => (tx: Tx) =>
      tx.execute(sql`insert into property_photo (property_id, agency_id, storage_key) values (${prop}, ${agency}, 'k')`);
    await expect(as(a1, add(P.a1, AG.A))).resolves.toBeDefined();
    await expect(as(a1, add(P.a2, AG.A))).rejects.toThrow();
    await expect(as(a1, add(P.b1, AG.B))).rejects.toThrow();
    await expect(as(a1, add(P.b1, AG.A))).rejects.toThrow(); // agency_id mentido
  });
  it("consultas: ve las suyas, no las de otro agente ni de otra agencia", async () => {
    const rows = await as(a1, (tx) => tx.execute(sql`select id from inquiry`));
    expect(ids(rows)).toEqual([INQ.a1]);
  });
  it("no puede cambiar el estado de su agencia ni crear miembros", async () => {
    await expect(as(a1, (tx) => tx.execute(sql`update agency set status = 'approved' where id = ${AG.A}`))).rejects.toThrow();
    await expect(
      as(a1, (tx) => tx.execute(sql`insert into agency_member (agency_id, user_id, role, status)
        values (${AG.A}, ${U.visitor}, 'agency_admin', 'active')`)),
    ).rejects.toThrow();
  });
  it("no puede cambiar el rol de un miembro (ni el propio)", async () => {
    const r = await as(a1, (tx) => tx.execute(sql`update agency_member set role = 'agency_admin' where id = ${M.a1} returning id`));
    expect(r).toHaveLength(0);
    const d = await admin`select role from agency_member where id = ${M.a1}`;
    expect(d[0].role).toBe("agent");
  });
});

describe("administrador de la agencia A", () => {
  const adm = asUser(U.admA);
  it("ve todas las propiedades de su agencia, incluidos borradores de otros agentes", async () => {
    const rows = await as(adm, (tx) => tx.execute(sql`select id from property`));
    expect(ids(rows)).toEqual(sorted(P.a1, P.a1draft, P.a1paused, P.a2, P.a2draft, P.b1));
  });
  it("edita propiedades de cualquier agente de su agencia, pero no de la agencia B", async () => {
    expect(await as(adm, (tx) => tx.execute(sql`update property set title = 'ok' where id = ${P.a2draft} returning id`))).toHaveLength(1);
    for (const p of [P.b1, P.bdraft])
      expect(await as(adm, (tx) => tx.execute(sql`update property set title = 'hack' where id = ${p} returning id`))).toHaveLength(0);
  });
  it("asigna a un agente de su agencia, no de otra", async () => {
    await expect(
      as(adm, (tx) => tx.execute(sql`update property set agent_id = ${M.a2} where id = ${P.a1draft}`)),
    ).resolves.toBeDefined();
    await expect(
      as(adm, (tx) => tx.execute(sql`update property set agent_id = ${M.b1} where id = ${P.a1draft}`)),
    ).rejects.toThrow();
  });
  it("ve las consultas de su agencia y ninguna de la otra", async () => {
    const rows = await as(adm, (tx) => tx.execute(sql`select id from inquiry`));
    expect(ids(rows)).toEqual(sorted(INQ.a1, INQ.a2));
  });
  it("gestiona miembros de su agencia, no de otra", async () => {
    const own = await as(adm, (tx) => tx.execute(sql`update agency_member set bio = 'x' where id = ${M.a1} returning id`));
    expect(own).toHaveLength(1);
    const other = await as(adm, (tx) => tx.execute(sql`update agency_member set bio = 'hack' where id = ${M.b1} returning id`));
    expect(other).toHaveLength(0);
    await expect(
      as(adm, (tx) => tx.execute(sql`insert into agency_member (agency_id, user_id, role, status)
        values (${AG.B}, ${U.visitor}, 'agent', 'active')`)),
    ).rejects.toThrow();
  });
  it("edita datos de su agencia pero NO su estado de aprobación", async () => {
    const ok = await as(adm, (tx) => tx.execute(sql`update agency set phone = '123' where id = ${AG.A} returning id`));
    expect(ok).toHaveLength(1);
    await expect(as(adm, (tx) => tx.execute(sql`update agency set status = 'approved' where id = ${AG.A}`))).rejects.toThrow();
    const other = await as(adm, (tx) => tx.execute(sql`update agency set phone = 'hack' where id = ${AG.B} returning id`));
    expect(other).toHaveLength(0);
  });
});

describe("consultas desde el formulario público", () => {
  const form = (propertyId: string, agency: string, agent: string, userId: string | null = null) => (tx: Tx) =>
    tx.execute(sql`insert into inquiry (property_id, agency_id, agent_id, user_id, name, email, message, consent_at)
      values (${propertyId}, ${agency}, ${agent}, ${userId}, 'Pepe', 'p@x.com', 'Hola quiero info', now())`);
  it("un anónimo puede consultar una ficha pública", async () => {
    await expect(as(ANON, form(P.a1, AG.A, M.a1))).resolves.toBeDefined();
  });
  it("no puede consultar borradores, fichas de agencias no aprobadas ni con destinatario falso", async () => {
    await expect(as(ANON, form(P.a1draft, AG.A, M.a1))).rejects.toThrow();
    await expect(as(ANON, form(P.pending, AG.PENDING, M.pend))).rejects.toThrow();
    await expect(as(ANON, form(P.a1, AG.A, M.a2))).rejects.toThrow(); // agente que no es el de la ficha
    await expect(as(ANON, form(P.a1, AG.B, M.a1))).rejects.toThrow(); // agencia que no es la de la ficha
  });
  it("no puede hacerse pasar por otro usuario", async () => {
    await expect(as(asUser(U.visitor), form(P.a1, AG.A, M.a1, U.a1))).rejects.toThrow();
    await expect(as(asUser(U.visitor), form(P.a1, AG.A, M.a1, U.visitor))).resolves.toBeDefined();
  });
});

describe("agencia suspendida o pendiente", () => {
  it("sus miembros pierden acceso de gestión y sus fichas se ocultan", async () => {
    for (const u of [U.susp, U.pend]) {
      const rows = await as(asUser(u), (tx) => tx.execute(sql`select id from property`));
      expect(ids(rows)).toEqual(sorted(P.a1, P.a2, P.b1));
      const upd = await as(asUser(u), (tx) => tx.execute(sql`update property set title = 'hack' where id in (${P.susp}, ${P.pending}) returning id`));
      expect(upd).toHaveLength(0);
    }
  });
});

describe("el cliente no puede mentir sobre quién es", () => {
  it("un visitante con un Actor falsificado (admin, miembro de A) sigue sin permisos", async () => {
    const forged: Actor = {
      kind: "user", userId: U.visitor, platformAdmin: true,
      membership: { agencyId: AG.A, memberId: M.admA, role: "agency_admin" },
    };
    const rows = await as(forged, (tx) => tx.execute(sql`select id from property`));
    expect(ids(rows)).toEqual(sorted(P.a1, P.a2, P.b1));
    const upd = await as(forged, (tx) => tx.execute(sql`update property set title = 'hack' returning id`));
    expect(upd).toHaveLength(0);
  });
  it("sin user_id configurado se comporta como anónimo", async () => {
    const rows = await admin.begin(async (t) => {
      await t.unsafe("set local role app_user");
      return t.unsafe("select id from inquiry");
    });
    expect(rows).toHaveLength(0);
  });
});

describe("administrador de la plataforma", () => {
  it("ve todo", async () => {
    const root = asUser(U.root);
    expect(await as(root, (tx) => tx.execute(sql`select id from property`))).toHaveLength(9);
    expect(await as(root, (tx) => tx.execute(sql`select id from agency`))).toHaveLength(4);
    expect(await as(root, (tx) => tx.execute(sql`select id from inquiry`))).toHaveLength(3);
  });
});
