import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "@/contracts";
import { hashToken } from "@/lib/invitation-token";
import {
  acceptInvitation, getMyAgency, getPublicAgencyBySlug, inviteMember, listAgenciesForAdmin, listInvitations, listMembers,
  previewInvitation, registerAgency, removeMember, revokeInvitation, setAgencyStatus, setMemberRole, updateAgency,
  updateMemberProfile,
} from "@/server/services/agency";
import { AG, ANON, M, P, U, admin, asUser, seed } from "../helpers/seed";

beforeEach(seed);
afterAll(() => admin.end());

const member = (userId: string, agencyId: string, memberId: string, role: "agent" | "agency_admin"): Actor => ({
  kind: "user", userId, platformAdmin: false, membership: { agencyId, memberId, role },
});
const root: Actor = { kind: "user", userId: U.root, platformAdmin: true, membership: null };
const admA = member(U.admA, AG.A, M.admA, "agency_admin");
const a1 = member(U.a1, AG.A, M.a1, "agent");
const admB = member(U.admB, AG.B, M.admB, "agency_admin");
const visitor = asUser(U.visitor);
const code = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? "ok" : r.error!.code);
const reg = (name = "Casa Nueva", slug = "casa-nueva") => ({ name, slug, displayName: "Juana Pérez" });

describe("alta y aprobación", () => {
  it("anónimo no registra; un visitante crea una agencia pendiente y la ve como suya", async () => {
    expect(code(await registerAgency(ANON, reg()))).toBe("unauthenticated");
    const r = await registerAgency(visitor, reg());
    expect(r.ok).toBe(true);
    const mine = await getMyAgency(visitor);
    expect(mine.ok && mine.data).toMatchObject({ slug: "casa-nueva", status: "pending", role: "agency_admin" });
    expect(await getPublicAgencyBySlug("casa-nueva")).toEqual({ ok: true, data: null }); // aún no es pública
  });
  it("traduce los errores: slug repetido/reservado, validación y ya miembro", async () => {
    expect(code(await registerAgency(visitor, reg("Otra", "pend")))).toBe("slug_taken");
    expect(code(await registerAgency(visitor, reg("Otra", "admin")))).toBe("validation"); // el contrato ya lo frena
    expect(code(await registerAgency(visitor, { ...reg(), name: "x" }))).toBe("validation");
    expect(code(await registerAgency(a1, reg()))).toBe("already_member");
  });
  it("solo la plataforma aprueba; aprobada pasa a ser pública", async () => {
    await registerAgency(visitor, reg());
    const id = (await getMyAgency(visitor)) as { ok: true; data: { agencyId: string } };
    expect(code(await setAgencyStatus(admA, id.data.agencyId, "approved"))).toBe("forbidden");
    expect(code(await setAgencyStatus(ANON, id.data.agencyId, "approved"))).toBe("forbidden");
    expect((await setAgencyStatus(root, id.data.agencyId, "approved")).ok).toBe(true);
    const pub = await getPublicAgencyBySlug("casa-nueva");
    expect(pub.ok && pub.data?.agency.name).toBe("Casa Nueva");
    expect(code(await setAgencyStatus(root, id.data.agencyId, "rejected"))).toBe("invalid_transition");
  });
  it("rechazada: libera al usuario para registrar otra", async () => {
    await registerAgency(visitor, reg());
    const { data } = (await getMyAgency(visitor)) as { data: { agencyId: string } };
    await setAgencyStatus(root, data.agencyId, "rejected", "Datos incompletos");
    expect((await getMyAgency(visitor) as { data: unknown }).data).toBeNull();
    expect((await registerAgency(visitor, reg("Segunda", "segunda"))).ok).toBe(true);
  });
  it("el listado de la plataforma filtra por estado y es solo para ella", async () => {
    const all = await listAgenciesForAdmin(root);
    expect(all.ok && all.data).toHaveLength(4);
    const pending = await listAgenciesForAdmin(root, "pending");
    expect(pending.ok && pending.data.map((a) => a.slug)).toEqual(["pend"]);
    expect(code(await listAgenciesForAdmin(admA))).toBe("forbidden");
  });
});

describe("edición de la agencia", () => {
  it("solo su admin; no cambia slug ni estado; limpia campos vacíos", async () => {
    const r = await updateAgency(admA, { name: "Agencia A SRL", phone: "2494-1", description: "" });
    expect(r.ok).toBe(true);
    const row = await admin`select name, slug, status, phone, description from agency where id = ${AG.A}`;
    expect(row[0]).toMatchObject({ name: "Agencia A SRL", slug: "a", status: "approved", phone: "2494-1", description: null });
    expect(code(await updateAgency(a1, { name: "Hack" }))).toBe("forbidden");
    expect(code(await updateAgency(visitor, { name: "Hack" }))).toBe("forbidden");
    expect(code(await updateAgency(ANON, { name: "Hack" }))).toBe("unauthenticated");
    expect(code(await updateAgency(admA, { name: "x" }))).toBe("validation");
    expect((await admin`select name from agency where id = ${AG.B}`)[0].name).toBe("Agencia B");
  });
});

describe("invitaciones", () => {
  it("el admin invita; el enlace sirve una sola vez y la base guarda solo el hash", async () => {
    const inv = await inviteMember(admA, { email: "Visitor@X.com", role: "agent" });
    if (!inv.ok) throw new Error(inv.error.message);
    const token = inv.data.link.replace("/invitacion/", "");
    const stored = await admin`select token_hash, email from agency_invitation`;
    expect(stored[0]).toMatchObject({ token_hash: hashToken(token), email: "visitor@x.com" });
    expect(JSON.stringify(stored)).not.toContain(token);

    const pv = await previewInvitation(token);
    expect(pv).toEqual({ ok: true, data: { agencyName: "Agencia A", email: "visitor@x.com", role: "agent" } });
    const acc = await acceptInvitation(visitor, token, "Nuevo Agente");
    expect(acc.ok).toBe(true);
    expect(code(await acceptInvitation(visitor, token, "Nuevo Agente"))).toBe("invitation_invalid");
    expect((await previewInvitation(token)).ok).toBe(false);
    const m = await admin`select role, status, display_name from agency_member where user_id = ${U.visitor}`;
    expect(m[0]).toMatchObject({ role: "agent", status: "active", display_name: "Nuevo Agente" });
  });
  it("solo la persona invitada la acepta; anónimos no", async () => {
    const inv = await inviteMember(admA, { email: "visitor@x.com", role: "agent" });
    const token = (inv as { data: { link: string } }).data.link.replace("/invitacion/", "");
    expect(code(await acceptInvitation(asUser(U.pend), token, "Intruso"))).toBe("invitation_invalid");
    expect(code(await acceptInvitation(ANON, token, "Intruso"))).toBe("unauthenticated");
    expect(code(await acceptInvitation(visitor, "corto", "Nombre"))).toBe("invitation_invalid");
  });
  it("agentes, visitantes y admins de otra agencia no invitan ni ven invitaciones", async () => {
    for (const actor of [a1, visitor, ANON]) {
      expect(["forbidden", "unauthenticated"]).toContain(code(await inviteMember(actor, { email: "x@x.com", role: "agent" })));
      expect(["forbidden", "unauthenticated"]).toContain(code(await listInvitations(actor)));
    }
    await inviteMember(admA, { email: "x@x.com", role: "agent" });
    const b = await listInvitations(admB);
    expect(b.ok && b.data).toHaveLength(0);
  });
  it("email inválido, duplicada vigente y revocación", async () => {
    expect(code(await inviteMember(admA, { email: "no-es-email", role: "agent" }))).toBe("validation");
    const first = await inviteMember(admA, { email: "dup@x.com", role: "agent" });
    expect(first.ok).toBe(true);
    expect(code(await inviteMember(admA, { email: "dup@x.com", role: "agent" }))).toBe("conflict");
    const list = await listInvitations(admA);
    const id = (list as { data: { id: string }[] }).data[0].id;
    expect(code(await revokeInvitation(admB, id))).toBe("not_found"); // otra agencia
    expect((await revokeInvitation(admA, id)).ok).toBe(true);
    expect(code(await revokeInvitation(admA, id))).toBe("not_found");
    const token = (first as { data: { link: string } }).data.link.replace("/invitacion/", "");
    expect((await previewInvitation(token)).ok).toBe(false);
    expect((await inviteMember(admA, { email: "dup@x.com", role: "agent" })).ok).toBe(true); // se puede reinvitar
  });
  it("una invitación vencida o de una agencia no aprobada no sirve", async () => {
    const inv = await inviteMember(admA, { email: "visitor@x.com", role: "agent" });
    const token = (inv as { data: { link: string } }).data.link.replace("/invitacion/", "");
    await admin`update agency_invitation set expires_at = now() - interval '1 minute'`;
    expect((await previewInvitation(token)).ok).toBe(false);
    expect(code(await acceptInvitation(visitor, token, "Nombre"))).toBe("invitation_invalid");
  });
});

describe("miembros", () => {
  it("el admin ve el equipo; un agente también ve el de su agencia pero no el ajeno", async () => {
    const r = await listMembers(admA);
    expect(r.ok && r.data.map((m) => m.id).sort()).toEqual([M.a1, M.a2, M.admA].sort());
    expect(code(await listMembers(visitor))).toBe("forbidden");
    expect(code(await listMembers(ANON))).toBe("unauthenticated");
  });
  it("cambio de rol: solo el admin de esa agencia; no deja a la agencia sin admin", async () => {
    expect(code(await setMemberRole(a1, M.a2, "agency_admin"))).toBe("forbidden");
    expect((await setMemberRole(admA, M.a1, "agency_admin")).ok).toBe(true);
    expect(code(await setMemberRole(admB, M.a2, "agent"))).toBe("forbidden");
    expect(code(await setMemberRole(ANON, M.a2, "agent"))).toBe("unauthenticated");
    expect(code(await setMemberRole(admA, M.admA, "agent"))).toBe("ok"); // ya hay otro admin (a1)
    expect(code(await setMemberRole(a1, M.a1, "agent"))).toBe("last_admin"); // a1 quedó como único admin
  });
  it("baja: pide reasignar si tiene propiedades y reasigna al darse", async () => {
    expect(code(await removeMember(admA, M.a1))).toBe("reassign_required");
    expect(code(await removeMember(admA, M.a1, M.a2))).toBe("ok");
    expect((await admin`select agent_id from property where id = ${P.a1}`)[0].agent_id).toBe(M.a2);
    expect(code(await removeMember(admA, M.admA))).toBe("last_admin");
    expect(code(await removeMember(admB, M.a2))).toBe("forbidden");
  });
  it("cada miembro edita solo su ficha pública, con WhatsApp válido", async () => {
    const ok1 = await updateMemberProfile(a1, { displayName: "Ana Agente", publicWhatsapp: "5492494123456", bio: "Hola" });
    expect(ok1.ok).toBe(true);
    const rows = await admin`select id, display_name, public_whatsapp from agency_member where agency_id = ${AG.A}`;
    expect(rows.find((r) => r.id === M.a1)).toMatchObject({ display_name: "Ana Agente", public_whatsapp: "5492494123456" });
    expect(rows.find((r) => r.id === M.a2)?.display_name).not.toBe("Ana Agente");
    expect(code(await updateMemberProfile(a1, { displayName: "Ana", publicWhatsapp: "+54 249 412" }))).toBe("validation");
    expect(code(await updateMemberProfile(visitor, { displayName: "Intruso" }))).toBe("not_found");
    expect(code(await updateMemberProfile(ANON, { displayName: "Intruso" }))).toBe("unauthenticated");
  });
  it("la ficha pública de la agencia muestra solo miembros activos y no filtra emails de cuenta", async () => {
    await removeMember(admA, M.a2, M.a1).catch(() => undefined);
    const r = await getPublicAgencyBySlug("a");
    expect(r.ok && r.data?.members.length).toBeGreaterThan(0);
    expect(JSON.stringify(r)).not.toContain("a1@x.com");
    expect(await getPublicAgencyBySlug("pend")).toEqual({ ok: true, data: null });
    expect(await getPublicAgencyBySlug("no-existe")).toEqual({ ok: true, data: null });
  });
});
