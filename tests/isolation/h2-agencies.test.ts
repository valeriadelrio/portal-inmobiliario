import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Tx } from "@/server/db/run-as-actor";
import { AG, ANON, M, P, U, admin, as, asUser, ids, seed } from "../helpers/seed";

beforeEach(seed);
afterAll(() => admin.end());

/** Devuelve el código de negocio (P0001) o el mensaje de Postgres. */
async function failure(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "NO_ERROR";
  } catch (e) {
    const err = e as { cause?: { message?: string }; message?: string };
    return err.cause?.message ?? err.message ?? "unknown";
  }
}
const hash = (t: string) => createHash("sha256").update(t).digest("hex");
const register = (slug: string, name = "Mi Inmobiliaria") => (tx: Tx) =>
  tx.execute(sql`select app_register_agency(${name}, ${slug}, '123', 'x@x.com', 'Juana') as id`);
const fnFail = (actor: Parameters<typeof as>[0], fn: (tx: Tx) => Promise<unknown>) => failure(as(actor, fn));

describe("alta de agencia (app_register_agency)", () => {
  it("un anónimo no puede", async () => {
    expect(await fnFail(ANON, register("nueva"))).toBe("forbidden");
  });
  it("un visitante crea una agencia pendiente y queda como admin activo", async () => {
    const [{ id }] = await as(asUser(U.visitor), register("nueva"));
    const a = await admin`select status, slug from agency where id = ${id as string}`;
    expect(a[0]).toMatchObject({ status: "pending", slug: "nueva" });
    const m = await admin`select role, status, display_name from agency_member where agency_id = ${id as string}`;
    expect(m[0]).toMatchObject({ role: "agency_admin", status: "active", display_name: "Juana" });
    const log = await admin`select 1 from audit_log where action = 'agency.register'`;
    expect(log).toHaveLength(1);
  });
  it("no puede crear una segunda agencia si ya es miembro", async () => {
    expect(await fnFail(asUser(U.a1), register("otra"))).toBe("already_member");
  });
  it("rechaza slugs duplicados, reservados o con formato inválido", async () => {
    expect(await fnFail(asUser(U.visitor), register("a"))).toBe("slug_taken");
    expect(await fnFail(asUser(U.visitor), register("admin"))).toBe("invalid_slug");
    expect(await fnFail(asUser(U.visitor), register("Con Espacios"))).toBe("invalid_slug");
    expect(await fnFail(asUser(U.visitor), register("-malo"))).toBe("invalid_slug");
  });
  it("limita a 3 altas por usuario cada 24 h", async () => {
    await admin`insert into audit_log (actor_id, action, entity) select ${U.visitor}, 'agency.register', 'agency' from generate_series(1,3)`;
    expect(await fnFail(asUser(U.visitor), register("cuarta"))).toBe("rate_limited");
  });
  it("no se puede crear una agencia directamente con INSERT (ni aprobada)", async () => {
    const msg = await fnFail(
      asUser(U.visitor),
      (tx) => tx.execute(sql`insert into agency (name, slug, status) values ('X', 'x', 'approved')`),
    );
    expect(msg).toMatch(/permission denied/);
  });
});

describe("aprobación de agencias (app_set_agency_status)", () => {
  const setStatus = (agency: string, status: string, reason: string | null = null) => (tx: Tx) =>
    tx.execute(sql`select app_set_agency_status(${agency}, ${status}, ${reason})`);
  const newAgency = async () => {
    const [{ id }] = await as(asUser(U.visitor), register("nueva"));
    return id as string;
  };

  it("solo el admin de plataforma puede", async () => {
    const id = await newAgency();
    for (const actor of [ANON, asUser(U.visitor), asUser(U.a1), asUser(U.admA)])
      expect(await fnFail(actor, setStatus(id, "approved"))).toBe("forbidden");
  });
  it("aprobar: el admin pasa a ver su agencia, el público la ve y quedan registrados quién y cuándo", async () => {
    const id = await newAgency();
    await as(asUser(U.root), setStatus(id, "approved"));
    const a = await admin`select status, approved_at, approved_by from agency where id = ${id}`;
    expect(a[0].status).toBe("approved");
    expect(a[0].approved_at).not.toBeNull();
    expect(a[0].approved_by).toBe(U.root);
    const pub = await as(ANON, (tx) => tx.execute(sql`select id from agency where id = ${id}`));
    expect(pub).toHaveLength(1);
  });
  it("transiciones inválidas fallan (rejected→approved, pending→suspended)", async () => {
    const id = await newAgency();
    expect(await fnFail(asUser(U.root), setStatus(id, "suspended"))).toBe("invalid_transition");
    await as(asUser(U.root), setStatus(id, "rejected", "datos incompletos"));
    expect(await fnFail(asUser(U.root), setStatus(id, "approved"))).toBe("invalid_transition");
  });
  it("rechazar libera a los miembros (pueden registrar otra agencia)", async () => {
    const id = await newAgency();
    await as(asUser(U.root), setStatus(id, "rejected", "no cumple"));
    const m = await admin`select status from agency_member where agency_id = ${id}`;
    expect(m[0].status).toBe("removed");
    await expect(as(asUser(U.visitor), register("segunda"))).resolves.toBeDefined();
  });
  it("suspender oculta sus propiedades al público", async () => {
    await as(asUser(U.root), setStatus(AG.A, "suspended", "moderación"));
    const rows = await as(ANON, (tx) => tx.execute(sql`select id from property`));
    expect(ids(rows)).toEqual([P.b1]);
  });
});

describe("app_my_agency", () => {
  it("una agencia pendiente es visible para su admin", async () => {
    const [{ id }] = await as(asUser(U.visitor), register("nueva"));
    const rows = await as(asUser(U.visitor), (tx) => tx.execute(sql`select * from app_my_agency()`));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ agency_id: id, agency_status: "pending", role: "agency_admin" });
  });
  it("devuelve solo la propia y nada a anónimos/visitantes", async () => {
    expect(await as(ANON, (tx) => tx.execute(sql`select * from app_my_agency()`))).toHaveLength(0);
    expect(await as(asUser(U.visitor), (tx) => tx.execute(sql`select * from app_my_agency()`))).toHaveLength(0);
    const rows = await as(asUser(U.a1), (tx) => tx.execute(sql`select agency_id from app_my_agency()`));
    expect(rows.map((r) => r.agency_id)).toEqual([AG.A]);
  });
});

describe("invitaciones", () => {
  const invite = (agency: string, email: string, token: string, by: string, role = "agent") => (tx: Tx) =>
    tx.execute(sql`insert into agency_invitation (agency_id, email, role, token_hash, invited_by, expires_at)
      values (${agency}, ${email}, ${role}, ${hash(token)}, ${by}, now() + interval '7 days')`);
  const accept = (token: string, name = "Nuevo Agente") => (tx: Tx) =>
    tx.execute(sql`select app_accept_invitation(${hash(token)}, ${name}) as id`);

  it("el admin de A invita a su agencia; agente, visitante y admin de B no pueden", async () => {
    await expect(as(asUser(U.admA), invite(AG.A, "n@x.com", "t1", U.admA))).resolves.toBeDefined();
    expect(await fnFail(asUser(U.a1), invite(AG.A, "n2@x.com", "t2", U.a1))).toBeTruthy();
    expect(await fnFail(asUser(U.visitor), invite(AG.A, "n3@x.com", "t3", U.visitor))).toBeTruthy();
    expect(await fnFail(asUser(U.admB), invite(AG.A, "n4@x.com", "t4", U.admB))).toBeTruthy();
    expect(await fnFail(asUser(U.admA), invite(AG.B, "n5@x.com", "t5", U.admA))).toBeTruthy();
  });
  it("no se puede falsear quién invita ni el estado", async () => {
    expect(await fnFail(asUser(U.admA), invite(AG.A, "n@x.com", "t1", U.admB))).toBeTruthy();
    const msg = await fnFail(
      asUser(U.admA),
      (tx) => tx.execute(sql`insert into agency_invitation (agency_id, email, token_hash, status, invited_by, expires_at)
        values (${AG.A}, 'z@x.com', 'h', 'accepted', ${U.admA}, now() + interval '1 day')`),
    );
    expect(msg).toBeTruthy();
  });
  it("solo el admin de la agencia ve las invitaciones", async () => {
    await as(asUser(U.admA), invite(AG.A, "n@x.com", "t1", U.admA));
    expect(await as(asUser(U.admA), (tx) => tx.execute(sql`select id from agency_invitation`))).toHaveLength(1);
    for (const u of [U.a1, U.visitor, U.admB])
      expect(await as(asUser(u), (tx) => tx.execute(sql`select id from agency_invitation`))).toHaveLength(0);
    expect(await as(ANON, (tx) => tx.execute(sql`select id from agency_invitation`))).toHaveLength(0);
  });
  it("el admin puede revocar pero no marcar como aceptada", async () => {
    await as(asUser(U.admA), invite(AG.A, "n@x.com", "t1", U.admA));
    expect(await fnFail(asUser(U.admA), (tx) => tx.execute(sql`update agency_invitation set status = 'accepted'`))).toBeTruthy();
    const r = await as(asUser(U.admA), (tx) => tx.execute(sql`update agency_invitation set status = 'revoked' returning id`));
    expect(r).toHaveLength(1);
  });

  it("aceptar con el email correcto crea el miembro activo", async () => {
    await as(asUser(U.admA), invite(AG.A, "visitor@x.com", "tok", U.admA));
    const [{ id }] = await as(asUser(U.visitor), accept("tok"));
    const m = await admin`select agency_id, role, status, display_name from agency_member where id = ${id as string}`;
    expect(m[0]).toMatchObject({ agency_id: AG.A, role: "agent", status: "active", display_name: "Nuevo Agente" });
    const inv = await admin`select status, accepted_by from agency_invitation`;
    expect(inv[0]).toMatchObject({ status: "accepted", accepted_by: U.visitor });
  });
  it("con otro email falla; también vencida, revocada, repetida o con membresía previa", async () => {
    await as(asUser(U.admA), invite(AG.A, "visitor@x.com", "tok", U.admA));
    expect(await fnFail(asUser(U.b1), accept("tok"))).toBe("invitation_invalid");
    expect(await fnFail(asUser(U.visitor), accept("token-inexistente"))).toBe("invitation_invalid");
    expect(await fnFail(ANON, accept("tok"))).toBe("forbidden");

    await admin`update agency_invitation set expires_at = now() - interval '1 minute'`;
    expect(await fnFail(asUser(U.visitor), accept("tok"))).toBe("invitation_invalid");

    await admin`update agency_invitation set expires_at = now() + interval '1 day', status = 'revoked'`;
    expect(await fnFail(asUser(U.visitor), accept("tok"))).toBe("invitation_invalid");

    await admin`update agency_invitation set status = 'pending'`;
    await as(asUser(U.visitor), accept("tok"));
    expect(await fnFail(asUser(U.visitor), accept("tok"))).toBe("invitation_invalid"); // dos veces
  });
  it("quien ya es miembro activo de otra agencia no puede aceptar", async () => {
    await as(asUser(U.admA), invite(AG.A, "b1@x.com", "tok", U.admA));
    expect(await fnFail(asUser(U.b1), accept("tok"))).toBe("already_member");
  });
  it("no se acepta en una agencia que dejó de estar aprobada", async () => {
    await as(asUser(U.admA), invite(AG.A, "visitor@x.com", "tok", U.admA));
    await admin`update agency set status = 'suspended' where id = ${AG.A}`;
    expect(await fnFail(asUser(U.visitor), accept("tok"))).toBe("invitation_invalid");
  });
  it("la vista previa solo responde para tokens válidos", async () => {
    await as(asUser(U.admA), invite(AG.A, "visitor@x.com", "tok", U.admA));
    const ok = await as(ANON, (tx) => tx.execute(sql`select * from app_preview_invitation(${hash("tok")})`));
    expect(ok).toHaveLength(1);
    expect(ok[0]).toMatchObject({ agency_name: "Agencia A", email: "visitor@x.com" });
    const bad = await as(ANON, (tx) => tx.execute(sql`select * from app_preview_invitation(${hash("otro")})`));
    expect(bad).toHaveLength(0);
  });
});

describe("gestión de miembros", () => {
  it("el admin cambia roles en su agencia; el agente y otras agencias no", async () => {
    await as(asUser(U.admA), (tx) => tx.execute(sql`select app_set_member_role(${M.a1}, 'agency_admin')`));
    const r = await admin`select role from agency_member where id = ${M.a1}`;
    expect(r[0].role).toBe("agency_admin");
    expect(await fnFail(asUser(U.a2), (tx) => tx.execute(sql`select app_set_member_role(${M.a1}, 'agent')`))).toBe("forbidden");
    expect(await fnFail(asUser(U.admB), (tx) => tx.execute(sql`select app_set_member_role(${M.a1}, 'agent')`))).toBe("forbidden");
    expect(await fnFail(ANON, (tx) => tx.execute(sql`select app_set_member_role(${M.a1}, 'agent')`))).toBe("forbidden");
  });
  it("un no-miembro (anónimo o visitante) no puede cambiar roles ni remover (regresión: NULL en la comparación)", async () => {
    for (const actor of [ANON, asUser(U.visitor), asUser(U.pend)]) {
      expect(await fnFail(actor, (tx) => tx.execute(sql`select app_set_member_role(${M.a1}, 'agency_admin')`))).toBe("forbidden");
      expect(await fnFail(actor, (tx) => tx.execute(sql`select app_remove_member(${M.a1}, ${M.a2})`))).toBe("forbidden");
    }
    const r = await admin`select role, status from agency_member where id = ${M.a1}`;
    expect(r[0]).toMatchObject({ role: "agent", status: "active" });
  });
  it("no se puede bajar ni remover al último admin", async () => {
    expect(await fnFail(asUser(U.admA), (tx) => tx.execute(sql`select app_set_member_role(${M.admA}, 'agent')`))).toBe("last_admin");
    expect(await fnFail(asUser(U.admA), (tx) => tx.execute(sql`select app_remove_member(${M.admA}, ${M.a1})`))).toBe("last_admin");
  });
  it("remover exige reasignar el trabajo, y lo reasigna", async () => {
    expect(await fnFail(asUser(U.admA), (tx) => tx.execute(sql`select app_remove_member(${M.a1})`))).toBe("reassign_required");
    expect(await fnFail(asUser(U.admA), (tx) => tx.execute(sql`select app_remove_member(${M.a1}, ${M.b1})`))).toBe("reassign_required"); // agente de otra agencia
    await as(asUser(U.admA), (tx) => tx.execute(sql`select app_remove_member(${M.a1}, ${M.a2})`));
    const m = await admin`select status from agency_member where id = ${M.a1}`;
    expect(m[0].status).toBe("removed");
    const props = await admin`select count(*)::int n from property where agent_id = ${M.a1}`;
    expect(props[0].n).toBe(0);
    const inq = await admin`select count(*)::int n from inquiry where agent_id = ${M.a1}`;
    expect(inq[0].n).toBe(0);
  });
  it("un miembro removido pierde sus permisos y puede unirse a otra agencia", async () => {
    await as(asUser(U.admA), (tx) => tx.execute(sql`select app_remove_member(${M.a1}, ${M.a2})`));
    const mine = await as(asUser(U.a1), (tx) => tx.execute(sql`select * from app_my_agency()`));
    expect(mine).toHaveLength(0);
    const upd = await as(asUser(U.a1), (tx) => tx.execute(sql`update property set title = 'x' returning id`));
    expect(upd).toHaveLength(0);
  });
  it("el admin no puede insertar miembros directamente (solo por invitación)", async () => {
    const msg = await fnFail(
      asUser(U.admA),
      (tx) => tx.execute(sql`insert into agency_member (agency_id, user_id, role, status) values (${AG.A}, ${U.visitor}, 'agent', 'active')`),
    );
    expect(msg).toMatch(/permission denied/);
  });
});

describe("funciones no expuestas a la API pública", () => {
  it("anon y authenticated (si existen) no tienen EXECUTE sobre las funciones app_*", async () => {
    const roles = await admin`select rolname from pg_roles where rolname in ('anon', 'authenticated')`;
    for (const r of roles) {
      const bad = await admin`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname like 'app\_%' and has_function_privilege(${r.rolname as string}, p.oid, 'execute')`;
      expect(bad.map((x) => x.proname)).toEqual([]);
    }
  });
  it("app_user sí puede ejecutarlas y PUBLIC no", async () => {
    const rows = await admin`select p.proname, has_function_privilege('app_user', p.oid, 'execute') as app_ok,
        (select bool_or(a.grantee = 0) from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a) as public_ok
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname like 'app\_%'`;
    expect(rows.length).toBeGreaterThan(10);
    for (const r of rows) {
      expect(r.app_ok).toBe(true);
      expect(r.public_ok).toBeFalsy();
    }
  });
});
