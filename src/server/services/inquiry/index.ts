import { randomUUID } from "node:crypto";
import { and, count, desc, eq, gte } from "drizzle-orm";
import {
  INQUIRY_PAGE_SIZE, INQUIRY_STATUS, fail, inquiryInput, mapDbError, ok,
  type Actor, type InquiryDto, type InquiryInput, type InquiryStatus, type ServiceResult,
} from "@/contracts";
import { can } from "@/server/auth/policies";
import { db } from "@/server/db/client";
import { withActor } from "@/server/db/with-actor";
import { agencyMember, inquiry, property, userProfile } from "@/server/db/schema";
import { escapeHtml, sendEmail } from "@/server/email";
import { siteUrl } from "@/lib/site";

// H4. Consultas: el visitante (con o sin cuenta) escribe desde la ficha; queda en la bandeja del agente
// (RLS: solo el destinatario o el admin de su inmobiliaria la lee) y se le avisa por email.

const MAX_PER_IP_PER_HOUR = 5;

/** Crea la consulta y avisa al agente. El aviso por email es "mejor esfuerzo": si falla, la consulta igual queda en la bandeja. */
export async function createInquiry(
  actor: Actor,
  input: InquiryInput,
  ctx: { ipHash?: string | null } = {},
): Promise<ServiceResult<{ id: string; emailed: boolean }>> {
  const raw = input as { consent?: unknown };
  if (raw.consent !== true) return fail("consent_required", "Falta el consentimiento");
  const parsed = inquiryInput.safeParse(input);
  if (!parsed.success) return fail("validation", "Datos de consulta inválidos");
  const v = parsed.data;

  try {
    if (ctx.ipHash) {
      const since = new Date(Date.now() - 60 * 60 * 1000);
      const [{ n }] = await db.select({ n: count() }).from(inquiry).where(and(eq(inquiry.ipHash, ctx.ipHash), gte(inquiry.createdAt, since)));
      if (Number(n) >= MAX_PER_IP_PER_HOUR) return fail("rate_limited", "Demasiadas consultas");
    }

    const id = randomUUID();
    const prop = await withActor(actor, async (tx) => {
      const [p] = await tx.select({ agencyId: property.agencyId, agentId: property.agentId, title: property.title, slug: property.slug, status: property.status })
        .from(property).where(eq(property.id, v.propertyId));
      if (!p || !["active", "reserved"].includes(p.status)) return null;
      await tx.insert(inquiry).values({
        id, propertyId: v.propertyId, agencyId: p.agencyId, agentId: p.agentId,
        userId: actor.kind === "user" ? actor.userId : null,
        name: v.name, email: v.email.toLowerCase(), phone: v.phone || null, message: v.message, locale: v.locale,
        consentAt: new Date(), ipHash: ctx.ipHash ?? null,
      });
      return p;
    });
    if (!prop) return fail("not_found", "La propiedad no está disponible");

    // El destinatario se busca con el rol dueño: el email de la cuenta del agente nunca es visible para el visitante.
    const [to] = await db.select({ account: userProfile.email, publicEmail: agencyMember.publicEmail })
      .from(agencyMember).innerJoin(userProfile, eq(userProfile.id, agencyMember.userId)).where(eq(agencyMember.id, prop.agentId));
    const recipient = to?.account ?? to?.publicEmail;
    let emailed = false;
    if (recipient) {
      const link = `${siteUrl()}/panel/consultas`;
      const { sent } = await sendEmail({
        to: recipient, replyTo: v.email,
        subject: `Nueva consulta: ${prop.title}`,
        html: `<p><strong>${escapeHtml(v.name)}</strong> (${escapeHtml(v.email)}${v.phone ? `, ${escapeHtml(v.phone)}` : ""}) consultó por <strong>${escapeHtml(prop.title)}</strong>:</p>
<blockquote style="white-space:pre-wrap">${escapeHtml(v.message)}</blockquote>
<p>Podés responder a este email o verla en <a href="${escapeHtml(link)}">tu bandeja de consultas</a>.</p>`,
      });
      emailed = sent;
      if (sent) await db.update(inquiry).set({ emailSentAt: new Date() }).where(eq(inquiry.id, id));
    }
    return ok({ id, emailed });
  } catch (e) {
    return mapDbError(e);
  }
}

/** Bandeja del usuario: las suyas (agente) o todas las de su inmobiliaria (administrador). La base filtra por rol. */
export async function listInquiries(
  actor: Actor,
  opts: { status?: InquiryStatus; page?: number } = {},
): Promise<ServiceResult<{ items: InquiryDto[]; total: number; unread: number; page: number; pageSize: number }>> {
  if (actor.kind !== "user") return fail("unauthenticated", "Tenés que iniciar sesión");
  if (!actor.membership && !actor.platformAdmin) return fail("forbidden", "Solo el equipo de una inmobiliaria tiene bandeja");
  const page = Math.max(1, opts.page ?? 1);
  const status = opts.status && INQUIRY_STATUS.includes(opts.status) ? opts.status : undefined;
  try {
    return await withActor(actor, async (tx) => {
      const where = status ? eq(inquiry.status, status) : undefined;
      const [{ total }] = await tx.select({ total: count() }).from(inquiry).where(where);
      const [{ unread }] = await tx.select({ unread: count() }).from(inquiry).where(eq(inquiry.status, "new"));
      const rows = await tx.select({
        id: inquiry.id, propertyId: inquiry.propertyId, propertyTitle: property.title, propertySlug: property.slug,
        name: inquiry.name, email: inquiry.email, phone: inquiry.phone, message: inquiry.message, status: inquiry.status,
        createdAt: inquiry.createdAt, agentName: agencyMember.displayName,
      }).from(inquiry)
        .innerJoin(property, eq(property.id, inquiry.propertyId))
        .innerJoin(agencyMember, eq(agencyMember.id, inquiry.agentId))
        .where(where).orderBy(desc(inquiry.createdAt), desc(inquiry.id)).limit(INQUIRY_PAGE_SIZE).offset((page - 1) * INQUIRY_PAGE_SIZE);
      return ok({
        total: Number(total), unread: Number(unread), page, pageSize: INQUIRY_PAGE_SIZE,
        items: rows.map((r) => ({ ...r, status: r.status as InquiryStatus, createdAt: r.createdAt.toISOString() })),
      });
    });
  } catch (e) {
    return mapDbError(e);
  }
}

/** Cantidad de consultas nuevas (para el aviso del menú). */
export async function countNewInquiries(actor: Actor): Promise<number> {
  if (actor.kind !== "user" || !actor.membership) return 0;
  try {
    return await withActor(actor, async (tx) => {
      const [{ n }] = await tx.select({ n: count() }).from(inquiry).where(eq(inquiry.status, "new"));
      return Number(n);
    });
  } catch {
    return 0;
  }
}

export async function setInquiryStatus(actor: Actor, inquiryId: string, status: InquiryStatus): Promise<ServiceResult<{ status: InquiryStatus }>> {
  if (actor.kind !== "user") return fail("unauthenticated", "Tenés que iniciar sesión");
  if (!INQUIRY_STATUS.includes(status)) return fail("validation", "Estado inválido");
  try {
    return await withActor(actor, async (tx) => {
      const [row] = await tx.select({ agencyId: inquiry.agencyId, agentId: inquiry.agentId }).from(inquiry).where(eq(inquiry.id, inquiryId));
      if (!row) return fail("not_found", "Consulta no encontrada");
      if (!can(actor, { type: "inquiry:update", inquiry: row })) return fail("forbidden", "No podés modificar esta consulta");
      await tx.update(inquiry).set({ status }).where(eq(inquiry.id, inquiryId));
      return ok({ status });
    });
  } catch (e) {
    return mapDbError(e);
  }
}
