import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Tx } from "@/server/db/run-as-actor";
import { AG, ANON, M, P, U, admin, as, asUser, seed } from "../helpers/seed";

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

describe("red de seguridad de toda la base", () => {
  it("todas las tablas de public tienen RLS activado", async () => {
    const rows = await admin`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity and c.relname not like '\\_\\_%'`;
    expect(rows.map((r) => r.relname)).toEqual([]);
  });
  it("PUBLIC, anon y authenticated no tienen privilegios sobre ninguna tabla", async () => {
    const rows = await admin`select c.relname, a.privilege_type from pg_class c join pg_namespace n on n.oid = c.relnamespace,
        lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
      where n.nspname = 'public' and c.relkind = 'r' and a.grantee = 0`;
    expect(rows).toEqual([]);
    for (const role of ["anon", "authenticated"]) {
      const exists = await admin`select 1 from pg_roles where rolname = ${role}`;
      if (!exists.length) continue;
      const bad = await admin`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and has_table_privilege(${role}, c.oid, 'select,insert,update,delete')`;
      expect(bad).toEqual([]);
    }
  });
  it("las funciones de trigger y de mantenimiento no son ejecutables por app_user", async () => {
    const rows = await admin`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname in ('report_guard','rate_limit_guard','property_moderation_guard','moderation_apply')
        and has_function_privilege('app_user', p.oid, 'execute')`;
    expect(rows).toEqual([]);
  });
});

describe("intentos de abuso sobre moderación y denuncias", () => {
  const report = (extra = "") => (tx: Tx) => tx.execute(sql.raw(
    `insert into property_report (property_id, reason, ip_hash${extra ? ", " + extra.split("=")[0] : ""}) values ('${P.a1}', 'fake', 'h'${extra ? ", " + extra.split("=")[1] : ""})`));

  it("nadie se puede denunciar a sí mismo como 'resuelta' ni escribir una resolución al crear", async () => {
    for (const a of [ANON, asUser(U.visitor)]) {
      expect(await failure(as(a, report("status='actioned'")))).toMatch(/row-level security/);
      expect(await failure(as(a, report("resolution_note='ok'")))).toMatch(/row-level security/);
    }
  });
  it("no se puede denunciar a nombre de otra cuenta", async () => {
    expect(await failure(as(asUser(U.visitor), report(`user_id='${U.a1}'`)))).toMatch(/row-level security/);
    expect(await failure(as(ANON, report(`user_id='${U.a1}'`)))).toMatch(/row-level security/);
  });
  it("las denuncias no se pueden leer, modificar ni borrar sin ser administración de la plataforma", async () => {
    await as(ANON, report());
    for (const a of [ANON, asUser(U.visitor), asUser(U.a1), asUser(U.admA)]) {
      const rows = await as(a, (tx) => tx.execute(sql`select * from property_report`));
      expect([...rows]).toHaveLength(0);
      expect(await failure(as(a, (tx) => tx.execute(sql`update property_report set status = 'dismissed'`)))).toMatch(/permission denied/);
      expect(await failure(as(a, (tx) => tx.execute(sql`delete from property_report`)))).toMatch(/permission denied/);
    }
  });
  it("las funciones de moderación rechazan a quien no es administración de la plataforma", async () => {
    const [{ id }] = await admin`insert into property_report (property_id, reason) values (${P.a1}, 'fake') returning id`;
    for (const a of [ANON, asUser(U.visitor), asUser(U.a1), asUser(U.admA), asUser(U.admB)]) {
      expect(await failure(as(a, (tx) => tx.execute(sql`select app_moderate_property(${P.a1}, true, 'motivo')`)))).toBe("forbidden");
      expect(await failure(as(a, (tx) => tx.execute(sql`select app_resolve_report(${id}, 'hide', 'x')`)))).toBe("forbidden");
      expect(await failure(as(a, (tx) => tx.execute(sql`select * from app_list_audit(10, 0, null)`)))).toBe("forbidden");
    }
    const [p] = await admin`select moderation_status from property where id = ${P.a1}`;
    expect(p.moderation_status).toBe("ok");
  });
  it("una inmobiliaria no puede mover su ficha a otra ni saltarse la moderación cambiando de estado", async () => {
    const root = { kind: "user", userId: U.root, platformAdmin: true, membership: null } as never;
    await as(root, (tx) => tx.execute(sql`select app_moderate_property(${P.a1}, true, 'Contenido inapropiado')`));
    const a1 = asUser(U.a1);
    // pausar y volver a activar no la hace pública de nuevo
    await as(a1, (tx) => tx.execute(sql`update property set status = 'paused' where id = ${P.a1}`));
    await as(a1, (tx) => tx.execute(sql`update property set status = 'active' where id = ${P.a1}`)).catch(() => undefined);
    const visible = await as(ANON, (tx) => tx.execute(sql`select id from property where id = ${P.a1}`));
    expect([...visible]).toHaveLength(0);
    const [p] = await admin`select moderation_status, agent_id from property where id = ${P.a1}`;
    expect(p).toMatchObject({ moderation_status: "hidden", agent_id: M.a1 });
    expect(AG.A).toBeTruthy();
  });
  it("las consultas a una ficha oculta no entran aunque se conozca su id", async () => {
    const root = { kind: "user", userId: U.root, platformAdmin: true, membership: null } as never;
    await as(root, (tx) => tx.execute(sql`select app_moderate_property(${P.a1}, true, 'Contenido inapropiado')`));
    const insert = (tx: Tx) => tx.execute(sql`insert into inquiry (property_id, agency_id, agent_id, name, email, message, consent_at)
      values (${P.a1}, ${AG.A}, ${M.a1}, 'x', 'x@x.com', 'mensaje de prueba', now())`);
    expect(await failure(as(ANON, insert))).toMatch(/row-level security/);
  });
});
