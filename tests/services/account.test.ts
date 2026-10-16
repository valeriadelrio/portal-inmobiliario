import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "@/contracts";
import { deleteMyAccount, exportMyData } from "@/server/services/account";
import { reportProperty } from "@/server/services/moderation";
import { AG, ANON, INQ, M, P, U, admin, asUser, seed } from "../helpers/seed";

beforeEach(seed);
afterAll(() => admin.end());

const visitor = asUser(U.visitor);
const a1: Actor = { kind: "user", userId: U.a1, platformAdmin: false, membership: { agencyId: AG.A, memberId: M.a1, role: "agent" } };
const root: Actor = { kind: "user", userId: U.root, platformAdmin: true, membership: null };

async function visitorActivity() {
  await admin`update inquiry set user_id = ${U.visitor} where id = ${INQ.a1}`;
  await reportProperty(visitor, { propertyId: P.a2, reason: "fake", message: "no me convence", email: "visitor@x.com" }, { ipHash: "h1" });
}

describe("exportar mis datos", () => {
  it("devuelve cuenta, consultas y denuncias propias, y nada de otras personas", async () => {
    await visitorActivity();
    const r = await exportMyData(visitor);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.account.email).toBe("visitor@x.com");
    expect(r.data.inquiries).toHaveLength(1);
    expect(r.data.inquiries[0].message).toBe("Hola me interesa");
    expect(r.data.reports.map((x) => x.reason)).toEqual(["fake"]);
    expect(r.data.team).toBeNull();
    expect(JSON.stringify(r.data)).not.toContain("a1@x.com");
  });
  it("un integrante ve su inmobiliaria; un anónimo no puede", async () => {
    const r = await exportMyData(a1);
    expect(r.ok && r.data.team).toEqual({ agency: "Agencia A", role: "agent" });
    const anon = await exportMyData(ANON);
    expect(!anon.ok && anon.error.code).toBe("unauthenticated");
  });
});

describe("eliminar mi cuenta", () => {
  it("anonimiza consultas y denuncias, y deja el perfil deshabilitado y sin datos", async () => {
    await visitorActivity();
    expect((await deleteMyAccount(visitor)).ok).toBe(true);

    const [inq] = await admin`select name, email, phone, message, user_id from inquiry where id = ${INQ.a1}`;
    expect(inq).toMatchObject({ name: "(eliminado)", email: "eliminado@invalid", phone: null, user_id: null });
    const [rep] = await admin`select user_id, reporter_email, ip_hash from property_report`;
    expect(rep).toMatchObject({ user_id: null, reporter_email: null, ip_hash: null });
    const [me] = await admin`select email, full_name, phone, disabled_at from user_profile where id = ${U.visitor}`;
    expect(me.email).toBe(`deleted-${U.visitor}@invalid`);
    expect(me.disabled_at).toBeTruthy();
    const log = await admin`select action from audit_log where action = 'account.delete'`;
    expect(log).toHaveLength(1);
    // las consultas de otras personas no se tocan
    const [other] = await admin`select name from inquiry where id = ${INQ.a2}`;
    expect(other.name).toBe("Ana");
  });
  it("quien integra una inmobiliaria no puede; tampoco la administración de la plataforma ni un anónimo", async () => {
    const m = await deleteMyAccount(a1);
    expect(!m.ok && m.error.code).toBe("conflict");
    const r = await deleteMyAccount(root);
    expect(!r.ok && r.error.code).toBe("conflict");
    const anon = await deleteMyAccount(ANON);
    expect(!anon.ok && anon.error.code).toBe("unauthenticated");
    const [still] = await admin`select email, disabled_at from user_profile where id = ${U.a1}`;
    expect(still).toMatchObject({ email: "a1@x.com", disabled_at: null });
  });
  it("revoca invitaciones pendientes a su email y borra el email de las demás", async () => {
    await admin.unsafe(`insert into agency_invitation (agency_id, email, token_hash, status, invited_by, expires_at) values
      ('${AG.A}', 'visitor@x.com', 'h1', 'pending', '${U.admA}', now() + interval '7 days'),
      ('${AG.B}', 'visitor@x.com', 'h2', 'revoked', '${U.admB}', now() + interval '7 days')`);
    await deleteMyAccount(visitor);
    const rows = await admin`select email, status from agency_invitation order by token_hash`;
    expect(rows.map((r) => r.status)).toEqual(["revoked", "revoked"]);
    expect(rows.every((r) => r.email === `deleted-${U.visitor}@invalid`)).toBe(true);
  });
});
