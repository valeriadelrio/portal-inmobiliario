import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import {
  MODERATION_PAGE_SIZE, fail, mapDbError, ok, reportInput,
  type Actor, type AuditEntryDto, type ModerationPropertyDto, type ModerationStatus, type ReportDto,
  type ReportInput, type ReportReason, type ReportStatus, type ServiceResult,
} from "@/contracts";
import { can } from "@/server/auth/policies";
import { db } from "@/server/db/client";
import { withActor } from "@/server/db/with-actor";
import { agency, agencyMember, property, propertyReport, userProfile } from "@/server/db/schema";
import { escapeHtml, sendEmail } from "@/server/email";
import { siteUrl } from "@/lib/site";

// H6. Moderación: los visitantes denuncian una ficha; solo la administración de la plataforma ve las denuncias,
// oculta o restituye fichas y consulta el registro de acciones. Las reglas finales las aplica la base
// (RLS + funciones app_moderate_property / app_resolve_report / app_list_audit, que además dejan auditoría).

const forbidden = () => fail("forbidden", "Solo la administración de la plataforma puede hacer esto");

/**
 * Avisa por email al agente responsable (y a los administradores de su inmobiliaria) que una ficha fue ocultada, con el motivo.
 * Mejor esfuerzo: si el email falla, la moderación igual queda aplicada. Se lee con el rol dueño porque la plataforma
 * no es miembro de la inmobiliaria.
 */
async function notifyHidden(propertyId: string, reason: string | null): Promise<void> {
  try {
    const [p] = await db.select({ title: property.title, agentId: property.agentId, agencyId: property.agencyId })
      .from(property).where(eq(property.id, propertyId));
    if (!p) return;
    const members = await db.select({ email: userProfile.email, role: agencyMember.role, id: agencyMember.id })
      .from(agencyMember).innerJoin(userProfile, eq(userProfile.id, agencyMember.userId))
      .where(and(eq(agencyMember.agencyId, p.agencyId), eq(agencyMember.status, "active")));
    const to = [...new Set(members.filter((m) => m.id === p.agentId || m.role === "agency_admin").map((m) => m.email))];
    const link = `${siteUrl()}/panel/propiedades`;
    await Promise.all(to.map((email) => sendEmail({
      to: email,
      subject: `Tu publicación fue ocultada: ${p.title}`,
      html: `<p>La administración del portal ocultó la publicación <strong>${escapeHtml(p.title)}</strong>; ya no se muestra en el sitio público.</p>
${reason ? `<p><strong>Motivo:</strong> ${escapeHtml(reason)}</p>` : ""}
<p>Podés verla en <a href="${escapeHtml(link)}">tu panel</a>. Si creés que es un error o ya corregiste lo indicado, respondé a este email.</p>`,
    })));
  } catch {
    /* el aviso es secundario */
  }
}

/** Denuncia de un visitante (con o sin cuenta). Repetir la misma denuncia abierta no falla: se toma como ya recibida. */
export async function reportProperty(
  actor: Actor, input: ReportInput, ctx: { ipHash?: string | null } = {},
): Promise<ServiceResult<{ duplicate: boolean }>> {
  const parsed = reportInput.safeParse(input);
  if (!parsed.success) return fail("validation", "Datos de denuncia inválidos");
  const v = parsed.data;
  try {
    await withActor(actor, async (tx) => {
      const [p] = await tx.select({ id: property.id }).from(property).where(eq(property.id, v.propertyId));
      if (!p) throw Object.assign(new Error("not_found"), { code: "P0001" });
      await tx.insert(propertyReport).values({
        propertyId: v.propertyId, reason: v.reason, message: v.message || null,
        reporterEmail: v.email ? v.email.toLowerCase() : null,
        userId: actor.kind === "user" ? actor.userId : null, ipHash: ctx.ipHash ?? null,
      });
    });
    return ok({ duplicate: false });
  } catch (e) {
    const err = e as { cause?: { code?: string; constraint_name?: string }; code?: string };
    if ((err.cause?.code ?? err.code) === "23505") return ok({ duplicate: true });
    return mapDbError(e);
  }
}

export async function listReports(
  actor: Actor, opts: { status?: ReportStatus; page?: number } = {},
): Promise<ServiceResult<{ items: ReportDto[]; total: number; openTotal: number; page: number; pageSize: number }>> {
  if (!can(actor, { type: "moderate" })) return forbidden();
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  try {
    return await withActor(actor, async (tx) => {
      const where = opts.status ? eq(propertyReport.status, opts.status) : undefined;
      const [{ total }] = await tx.select({ total: count() }).from(propertyReport).where(where);
      const [{ openTotal }] = await tx.select({ openTotal: count() }).from(propertyReport).where(eq(propertyReport.status, "open"));
      const rows = await tx.select({
        id: propertyReport.id, propertyId: propertyReport.propertyId, propertyTitle: property.title, propertySlug: property.slug,
        agencyName: agency.name, moderationStatus: property.moderationStatus, reason: propertyReport.reason,
        message: propertyReport.message, reporterEmail: propertyReport.reporterEmail, status: propertyReport.status,
        resolutionNote: propertyReport.resolutionNote, createdAt: propertyReport.createdAt,
        openForProperty: sql<number>`(select count(*) from property_report r2 where r2.property_id = ${propertyReport.propertyId} and r2.status = 'open')`,
      }).from(propertyReport)
        .innerJoin(property, eq(property.id, propertyReport.propertyId))
        .innerJoin(agency, eq(agency.id, property.agencyId))
        .where(where).orderBy(desc(propertyReport.createdAt), desc(propertyReport.id))
        .limit(MODERATION_PAGE_SIZE).offset((page - 1) * MODERATION_PAGE_SIZE);
      return ok({
        total: Number(total), openTotal: Number(openTotal), page, pageSize: MODERATION_PAGE_SIZE,
        items: rows.map((r) => ({
          ...r, moderationStatus: r.moderationStatus as ModerationStatus, reason: r.reason as ReportReason,
          status: r.status as ReportStatus, openForProperty: Number(r.openForProperty), createdAt: r.createdAt.toISOString(),
        })),
      });
    });
  } catch (e) {
    return mapDbError(e);
  }
}

/** Cantidad de denuncias abiertas (aviso en el menú de administración). */
export async function countOpenReports(actor: Actor): Promise<number> {
  if (!can(actor, { type: "moderate" })) return 0;
  try {
    return await withActor(actor, async (tx) => {
      const [{ n }] = await tx.select({ n: count() }).from(propertyReport).where(eq(propertyReport.status, "open"));
      return Number(n);
    });
  } catch {
    return 0;
  }
}

/** "dismiss" descarta la denuncia; "hide" oculta la ficha (y cierra todas las denuncias abiertas sobre ella). */
export async function resolveReport(
  actor: Actor, reportId: string, action: "dismiss" | "hide", note?: string,
): Promise<ServiceResult<void>> {
  if (!can(actor, { type: "moderate" })) return forbidden();
  try {
    await withActor(actor, (tx) => tx.execute(sql`select app_resolve_report(${reportId}, ${action}, ${note?.trim() || null})`));
    if (action === "hide") {
      const [r] = await db.select({ propertyId: propertyReport.propertyId, reason: property.moderationReason })
        .from(propertyReport).innerJoin(property, eq(property.id, propertyReport.propertyId)).where(eq(propertyReport.id, reportId));
      if (r) await notifyHidden(r.propertyId, r.reason);
    }
    return ok(undefined);
  } catch (e) {
    return mapDbError(e);
  }
}

/** Oculta (con motivo obligatorio) o restituye una ficha. No cambia el estado que le puso la inmobiliaria. */
export async function moderateProperty(
  actor: Actor, propertyId: string, hide: boolean, reason?: string,
): Promise<ServiceResult<void>> {
  if (!can(actor, { type: "moderate" })) return forbidden();
  try {
    await withActor(actor, (tx) => tx.execute(sql`select app_moderate_property(${propertyId}, ${hide}, ${reason?.trim() || null})`));
    if (hide) await notifyHidden(propertyId, reason?.trim() || null);
    return ok(undefined);
  } catch (e) {
    return mapDbError(e);
  }
}

/** Fichas de todas las inmobiliarias para moderar (búsqueda por título o dirección web). */
export async function listPropertiesForModeration(
  actor: Actor, opts: { q?: string; hidden?: boolean; page?: number } = {},
): Promise<ServiceResult<{ items: ModerationPropertyDto[]; total: number; page: number; pageSize: number }>> {
  if (!can(actor, { type: "moderate" })) return forbidden();
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const q = opts.q?.trim().slice(0, 80);
  try {
    return await withActor(actor, async (tx) => {
      const like = q ? `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
      const where = and(
        opts.hidden ? eq(property.moderationStatus, "hidden") : undefined,
        like ? or(ilike(property.title, like), ilike(property.slug, like), ilike(agency.name, like)) : undefined,
      );
      const [{ total }] = await tx.select({ total: count() }).from(property).innerJoin(agency, eq(agency.id, property.agencyId)).where(where);
      const rows = await tx.select({
        id: property.id, slug: property.slug, title: property.title, status: property.status, agencyName: agency.name,
        moderationStatus: property.moderationStatus, moderationReason: property.moderationReason,
        openReports: sql<number>`(select count(*) from property_report r where r.property_id = ${property.id} and r.status = 'open')`,
      }).from(property).innerJoin(agency, eq(agency.id, property.agencyId))
        .where(where).orderBy(desc(property.updatedAt), desc(property.id))
        .limit(MODERATION_PAGE_SIZE).offset((page - 1) * MODERATION_PAGE_SIZE);
      return ok({
        total: Number(total), page, pageSize: MODERATION_PAGE_SIZE,
        items: rows.map((r) => ({ ...r, moderationStatus: r.moderationStatus as ModerationStatus, openReports: Number(r.openReports) })),
      });
    });
  } catch (e) {
    return mapDbError(e);
  }
}

/** Registro de acciones de la plataforma (más reciente primero). `prefix` filtra por tipo ("property.", "agency."…). */
export async function listAuditLog(
  actor: Actor, opts: { page?: number; prefix?: string } = {},
): Promise<ServiceResult<{ items: AuditEntryDto[]; total: number; page: number; pageSize: number }>> {
  if (!can(actor, { type: "moderate" })) return forbidden();
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const size = 50;
  const prefix = opts.prefix && /^[a-z_]{1,20}\.?$/.test(opts.prefix) ? opts.prefix : null;
  try {
    const rows = await withActor(actor, (tx) =>
      tx.execute<{
        id: string; at: Date; action: string; entity: string; entity_id: string | null; detail: string | null;
        actor_email: string | null; agency_name: string | null; total: string;
      }>(sql`select * from app_list_audit(${size}, ${(page - 1) * size}, ${prefix})`),
    );
    const list = [...rows];
    return ok({
      total: Number(list[0]?.total ?? 0), page, pageSize: size,
      items: list.map((r) => ({
        id: r.id, at: new Date(r.at).toISOString(), action: r.action, entity: r.entity, entityId: r.entity_id,
        detail: r.detail, actorEmail: r.actor_email, agencyName: r.agency_name,
      })),
    });
  } catch (e) {
    return mapDbError(e);
  }
}
