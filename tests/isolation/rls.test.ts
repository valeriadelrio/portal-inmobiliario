import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "@/contracts";
import type { Tx } from "@/server/db/run-as-actor";
import { ANON, AG, INQ, M, P, U, ZONE, admin, as, asUser, ids, seed, sorted } from "../helpers/seed";

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
  it("no ve consultas ni perfiles", async () => {
    expect(await as(ANON, (tx) => tx.execute(sql`select 1 from inquiry`))).toHaveLength(0);
    expect(await as(ANON, (tx) => tx.execute(sql`select 1 from user_profile`))).toHaveLength(0);
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
  it("ve lo público", async () => {
    const props = await as(asUser(U.visitor), (tx) => tx.execute(sql`select id from property`));
    expect(ids(props)).toEqual(sorted(P.a1, P.a2, P.b1));
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
  it("no puede crear una propiedad", async () => {
    await expect(
      as(asUser(U.visitor), (tx) => tx.execute(sql`insert into property (agency_id, agent_id, operation, type, title,
        description, zone_id, price, total_area_m2, slug) values (${AG.A}, ${M.a1}, 'sale', 'lot', 'x', 'y', ${ZONE}, 1, 1, 'hack')`)),
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
  it("no puede cambiar el rol de un miembro (ni el propio): permiso denegado", async () => {
    const err = await as(a1, (tx) =>
      tx.execute(sql`update agency_member set role = 'agency_admin' where id = ${M.a1}`),
    ).catch((e) => e);
    expect(String(err?.cause?.message ?? err?.message)).toMatch(/permission denied/);
    const d = await admin`select role from agency_member where id = ${M.a1}`;
    expect(d[0].role).toBe("agent");
  });
  it("edita su propio perfil público pero no el de otro agente", async () => {
    const own = await as(a1, (tx) => tx.execute(sql`update agency_member set bio = 'hola' where id = ${M.a1} returning id`));
    expect(own).toHaveLength(1);
    const other = await as(a1, (tx) => tx.execute(sql`update agency_member set bio = 'hack' where id = ${M.a2} returning id`));
    expect(other).toHaveLength(0);
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
