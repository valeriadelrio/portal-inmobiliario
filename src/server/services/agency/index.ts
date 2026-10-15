import { and, desc, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  acceptInvitationInput, fail, inviteMemberInput, mapDbError, memberProfileInput, ok, registerAgencyInput,
  updateAgencyInput, type Actor, type AgencyPublicDto, type InviteMemberInput, type MemberProfileInput,
  type MemberPublicDto, type MyAgencyDto, type RegisterAgencyInput, type ServiceResult, type UpdateAgencyInput,
} from "@/contracts";
import { generateInvitationToken, hashToken } from "@/lib/invitation-token";
import { can } from "@/server/auth/policies";
import { db } from "@/server/db/client";
import { withActor } from "@/server/db/with-actor";
import { agency, agencyInvitation, agencyMember, userProfile } from "@/server/db/schema";
import { sendEmail } from "@/server/email";
import { buildAgencyStatusEmail } from "@/server/email/agency-status";

// Pieza 2A. Cada función recibe el Actor primero y devuelve ServiceResult.
// Las reglas finales las aplican la base (RLS y funciones app_*); acá se valida la entrada y se traducen errores.

export const INVITATION_DAYS = 7;
const iso = (d: unknown) => new Date(d as string | Date).toISOString();
const clean = (v: string | undefined) => (v && v.length > 0 ? v : null);
const unauthenticated = () => fail("unauthenticated", "Tenés que iniciar sesión");
const forbidden = () => fail("forbidden", "No tenés permiso para esto");
const invalid = () => fail("validation", "Datos inválidos");

export type AgencyAdminRow = AgencyPublicDto & { status: string; statusReason: string | null; createdAt: string };

/** Agencia del usuario aunque todavía no esté aprobada (para mostrar "pendiente" o "rechazada"). */
export async function getMyAgency(actor: Actor): Promise<ServiceResult<MyAgencyDto | null>> {
  if (actor.kind === "anonymous") return unauthenticated();
  try {
    const rows = await withActor(actor, (tx) => tx.execute(sql`select * from app_my_agency()`));
    const r = rows[0];
    if (!r) return ok(null);
    return ok({
      agencyId: r.agency_id as string, name: r.name as string, slug: r.slug as string,
      status: r.agency_status as string, statusReason: (r.status_reason as string) ?? null,
      role: r.role as string, memberId: r.member_id as string,
    });
  } catch (e) {
    return mapDbError(e);
  }
}

/** Datos completos de la agencia del actor y de su propia ficha de miembro (para las pantallas de edición). */
export async function getMyAgencyDetail(
  actor: Actor,
): Promise<ServiceResult<{ agency: typeof agency.$inferSelect; member: typeof agencyMember.$inferSelect } | null>> {
  if (actor.kind === "anonymous") return unauthenticated();
  try {
    return await withActor(actor, async (tx) => {
      const rows = await tx.execute(sql`select agency_id, member_id from app_my_agency()`);
      if (!rows[0]) return ok(null);
      const [a] = await tx.select().from(agency).where(eq(agency.id, rows[0].agency_id as string));
      const [m] = await tx.select().from(agencyMember).where(eq(agencyMember.id, rows[0].member_id as string));
      return a && m ? ok({ agency: a, member: m }) : ok(null);
    });
  } catch (e) {
    return mapDbError(e);
  }
}

export async function registerAgency(actor: Actor, input: RegisterAgencyInput): Promise<ServiceResult<{ agencyId: string }>> {
  if (actor.kind === "anonymous") return unauthenticated();
  const p = registerAgencyInput.safeParse(input);
  if (!p.success) return invalid();
  const v = p.data;
  try {
    const rows = await withActor(actor, (tx) =>
      tx.execute(sql`select app_register_agency(${v.name}, ${v.slug}, ${clean(v.phone)}, ${clean(v.email)}, ${v.displayName}) as id`),
    );
    return ok({ agencyId: rows[0].id as string });
  } catch (e) {
    return mapDbError(e);
  }
}

/** Solo el admin de la agencia (aprobada). La agencia sale de la membresía, nunca de la entrada. */
export async function updateAgency(actor: Actor, input: UpdateAgencyInput): Promise<ServiceResult<void>> {
  if (actor.kind === "anonymous") return unauthenticated();
  const m = actor.membership;
  if (!m || !can(actor, { type: "agency:update", agencyId: m.agencyId })) return forbidden();
  const p = updateAgencyInput.safeParse(input);
  if (!p.success) return invalid();
  const v = p.data;
  try {
    const rows = await withActor(actor, (tx) =>
      tx.update(agency).set({
        name: v.name, description: clean(v.description), phone: clean(v.phone), email: clean(v.email),
        website: clean(v.website), address: clean(v.address), logoUrl: clean(v.logoUrl), updatedAt: new Date(),
      }).where(eq(agency.id, m.agencyId)).returning({ id: agency.id }),
    );
    return rows.length ? ok(undefined) : fail("not_found", "La agencia no existe");
  } catch (e) {
    return mapDbError(e);
  }
}

/** Para la administración de la plataforma: todas las agencias, opcionalmente por estado. */
export async function listAgenciesForAdmin(actor: Actor, status?: string): Promise<ServiceResult<AgencyAdminRow[]>> {
  if (!can(actor, { type: "agency:approve" })) return forbidden();
  try {
    const rows = await withActor(actor, (tx) =>
      tx.select().from(agency).where(status ? eq(agency.status, status) : undefined).orderBy(desc(agency.createdAt)),
    );
    return ok(rows.map((a) => ({
      id: a.id, slug: a.slug, name: a.name, description: a.description, logoUrl: a.logoUrl, phone: a.phone,
      email: a.email, website: a.website, address: a.address, status: a.status, statusReason: a.statusReason,
      createdAt: iso(a.createdAt),
    })));
  } catch (e) {
    return mapDbError(e);
  }
}

/** Avisa por email a los administradores de la inmobiliaria. Mejor esfuerzo: nunca hace fallar el cambio de estado. */
async function notifyAgencyStatus(agencyId: string, status: "approved" | "rejected" | "suspended", reason: string | null, wasSuspended: boolean) {
  try {
    const [a] = await db.select({ name: agency.name }).from(agency).where(eq(agency.id, agencyId));
    if (!a) return;
    const admins = await db.select({ email: userProfile.email }).from(agencyMember)
      .innerJoin(userProfile, eq(userProfile.id, agencyMember.userId))
      .where(and(eq(agencyMember.agencyId, agencyId), eq(agencyMember.role, "agency_admin")));
    await Promise.all([...new Set(admins.map((m) => m.email))].map((to) =>
      sendEmail(buildAgencyStatusEmail({ to, agencyName: a.name, status, reason, wasSuspended }))));
  } catch {
    /* el aviso es secundario */
  }
}

export async function setAgencyStatus(
  actor: Actor, agencyId: string, status: "approved" | "rejected" | "suspended", reason?: string,
): Promise<ServiceResult<void>> {
  if (!can(actor, { type: "agency:approve" })) return forbidden();
  try {
    const [before] = await db.select({ status: agency.status }).from(agency).where(eq(agency.id, agencyId));
    await withActor(actor, (tx) => tx.execute(sql`select app_set_agency_status(${agencyId}, ${status}, ${clean(reason?.trim())})`));
    await notifyAgencyStatus(agencyId, status, reason?.trim() || null, before?.status === "suspended");
    return ok(undefined);
  } catch (e) {
    return mapDbError(e);
  }
}

// --- Miembros e invitaciones -----------------------------------------------------------------
export type MemberRow = MemberPublicDto & { userId: string; role: string; status: string };
export type InvitationRow = { id: string; email: string; role: string; status: string; expiresAt: string };

const toMember = (m: typeof agencyMember.$inferSelect): MemberRow => ({
  id: m.id, userId: m.userId, role: m.role, status: m.status, displayName: m.displayName, bio: m.bio,
  photoUrl: m.photoUrl, publicPhone: m.publicPhone, publicWhatsapp: m.publicWhatsapp, publicEmail: m.publicEmail,
});

/** Miembros activos de la agencia del actor. */
export async function listMembers(actor: Actor): Promise<ServiceResult<MemberRow[]>> {
  if (actor.kind === "anonymous") return unauthenticated();
  const m = actor.membership;
  if (!m) return forbidden();
  try {
    const rows = await withActor(actor, (tx) =>
      tx.select().from(agencyMember)
        .where(and(eq(agencyMember.agencyId, m.agencyId), eq(agencyMember.status, "active")))
        .orderBy(agencyMember.role, agencyMember.displayName),
    );
    return ok(rows.map(toMember));
  } catch (e) {
    return mapDbError(e);
  }
}

/** Crea una invitación y devuelve el enlace (ruta relativa). El token crudo solo existe en esta respuesta. */
export async function inviteMember(actor: Actor, input: InviteMemberInput): Promise<ServiceResult<{ link: string }>> {
  if (actor.kind === "anonymous") return unauthenticated();
  const m = actor.membership;
  if (!m || !can(actor, { type: "invitation:manage", agencyId: m.agencyId })) return forbidden();
  const p = inviteMemberInput.safeParse(input);
  if (!p.success) return invalid();
  const { token, hash } = generateInvitationToken();
  try {
    await withActor(actor, (tx) =>
      tx.insert(agencyInvitation).values({
        agencyId: m.agencyId, email: p.data.email, role: p.data.role, tokenHash: hash, status: "pending",
        invitedBy: actor.userId, expiresAt: new Date(Date.now() + INVITATION_DAYS * 24 * 3600 * 1000),
      }),
    );
    return ok({ link: `/invitacion/${token}` });
  } catch (e) {
    const r = mapDbError(e);
    // índice único (agencia, email) pendiente: ya hay una invitación vigente para ese email
    return !r.ok && r.error.code === "conflict" ? fail("conflict", "Ya hay una invitación pendiente para ese email") : r;
  }
}

export async function listInvitations(actor: Actor): Promise<ServiceResult<InvitationRow[]>> {
  if (actor.kind === "anonymous") return unauthenticated();
  const m = actor.membership;
  if (!m || !can(actor, { type: "invitation:manage", agencyId: m.agencyId })) return forbidden();
  try {
    const rows = await withActor(actor, (tx) =>
      tx.select().from(agencyInvitation).where(eq(agencyInvitation.agencyId, m.agencyId))
        .orderBy(desc(agencyInvitation.createdAt)).limit(50),
    );
    return ok(rows.map((i) => ({ id: i.id, email: i.email, role: i.role, status: i.status, expiresAt: iso(i.expiresAt) })));
  } catch (e) {
    return mapDbError(e);
  }
}

export async function revokeInvitation(actor: Actor, id: string): Promise<ServiceResult<void>> {
  if (actor.kind === "anonymous") return unauthenticated();
  const m = actor.membership;
  if (!m || !can(actor, { type: "invitation:manage", agencyId: m.agencyId })) return forbidden();
  try {
    const rows = await withActor(actor, (tx) =>
      tx.update(agencyInvitation).set({ status: "revoked" })
        .where(and(eq(agencyInvitation.id, id), eq(agencyInvitation.agencyId, m.agencyId), eq(agencyInvitation.status, "pending")))
        .returning({ id: agencyInvitation.id }),
    );
    return rows.length ? ok(undefined) : fail("not_found", "La invitación no existe o ya no está pendiente");
  } catch (e) {
    return mapDbError(e);
  }
}

/** Qué se ofrece al abrir el enlace. Pública: no revela nada si el token no es válido. */
export async function previewInvitation(token: string): Promise<ServiceResult<{ agencyName: string; email: string; role: string }>> {
  if (token.length < 20 || token.length > 200) return fail("invitation_invalid", "Invitación inválida");
  try {
    const rows = await withActor({ kind: "anonymous" }, (tx) =>
      tx.execute(sql`select * from app_preview_invitation(${hashToken(token)})`),
    );
    const r = rows[0];
    if (!r) return fail("invitation_invalid", "La invitación no existe, venció o fue revocada");
    return ok({ agencyName: r.agency_name as string, email: r.email as string, role: r.role as string });
  } catch (e) {
    return mapDbError(e);
  }
}

export async function acceptInvitation(actor: Actor, token: string, displayName: string): Promise<ServiceResult<{ memberId: string }>> {
  if (actor.kind === "anonymous") return unauthenticated();
  const p = acceptInvitationInput.safeParse({ token, displayName });
  if (!p.success) return fail("invitation_invalid", "Invitación inválida");
  try {
    const rows = await withActor(actor, (tx) =>
      tx.execute(sql`select app_accept_invitation(${hashToken(p.data.token)}, ${p.data.displayName}) as id`),
    );
    return ok({ memberId: rows[0].id as string });
  } catch (e) {
    return mapDbError(e);
  }
}

/** Cada miembro edita SOLO su propia ficha pública (WhatsApp incluido). */
export async function updateMemberProfile(actor: Actor, input: MemberProfileInput): Promise<ServiceResult<void>> {
  if (actor.kind === "anonymous") return unauthenticated();
  const p = memberProfileInput.safeParse(input);
  if (!p.success) return invalid();
  const v = p.data;
  try {
    const rows = await withActor(actor, (tx) =>
      tx.update(agencyMember).set({
        displayName: v.displayName, bio: clean(v.bio), photoUrl: clean(v.photoUrl), publicPhone: clean(v.publicPhone),
        publicWhatsapp: clean(v.publicWhatsapp), publicEmail: clean(v.publicEmail), updatedAt: new Date(),
      }).where(and(eq(agencyMember.userId, actor.userId), eq(agencyMember.status, "active"))).returning({ id: agencyMember.id }),
    );
    return rows.length ? ok(undefined) : fail("not_found", "No sos miembro de ninguna agencia");
  } catch (e) {
    return mapDbError(e);
  }
}

export async function setMemberRole(actor: Actor, memberId: string, role: "agent" | "agency_admin"): Promise<ServiceResult<void>> {
  if (actor.kind === "anonymous") return unauthenticated();
  try {
    await withActor(actor, (tx) => tx.execute(sql`select app_set_member_role(${memberId}, ${role})`));
    return ok(undefined);
  } catch (e) {
    return mapDbError(e);
  }
}

export async function removeMember(actor: Actor, memberId: string, reassignTo?: string): Promise<ServiceResult<void>> {
  if (actor.kind === "anonymous") return unauthenticated();
  try {
    await withActor(actor, (tx) => tx.execute(sql`select app_remove_member(${memberId}, ${reassignTo ?? null})`));
    return ok(undefined);
  } catch (e) {
    return mapDbError(e);
  }
}

/** Agencia pública (aprobada) con su equipo. null si no existe o no está aprobada. */
export async function getPublicAgencyBySlug(
  slug: string,
): Promise<ServiceResult<{ agency: AgencyPublicDto; members: MemberPublicDto[] } | null>> {
  try {
    return await withActor({ kind: "anonymous" }, async (tx) => {
      const [a] = await tx.select().from(agency).where(and(eq(agency.slug, slug), eq(agency.status, "approved")));
      if (!a) return ok(null);
      const ms = await tx.select().from(agencyMember)
        .where(and(eq(agencyMember.agencyId, a.id), eq(agencyMember.status, "active"))).orderBy(agencyMember.displayName);
      return ok({
        agency: {
          id: a.id, slug: a.slug, name: a.name, description: a.description, logoUrl: a.logoUrl, phone: a.phone,
          email: a.email, website: a.website, address: a.address,
        },
        members: ms.map(({ id, displayName, bio, photoUrl, publicPhone, publicWhatsapp, publicEmail }) => ({
          id, displayName, bio, photoUrl, publicPhone, publicWhatsapp, publicEmail,
        })),
      });
    });
  } catch (e) {
    return mapDbError(e);
  }
}
