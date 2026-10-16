import { and, eq, sql } from "drizzle-orm";
import { fail, mapDbError, ok, type Actor, type ServiceResult } from "@/contracts";
import { db } from "@/server/db/client";
import {
  agency, agencyInvitation, agencyMember, auditLog, inquiry, property, propertyReport, userProfile,
} from "@/server/db/schema";

// H6. Derechos sobre los datos personales (Ley 25.326): acceso (descarga) y supresión (eliminar la cuenta).
// Se usa el rol dueño con filtros por el id del usuario que sale de la sesión (nunca de datos del cliente) porque
// las consultas que envió un visitante no son visibles para él por RLS (son de la inmobiliaria).

export type MyData = {
  generatedAt: string;
  account: { email: string; fullName: string | null; phone: string | null; locale: string; createdAt: string };
  team: { agency: string; role: string } | null;
  inquiries: { property: string; message: string; sentAt: string; status: string }[];
  reports: { property: string; reason: string; message: string | null; sentAt: string; status: string }[];
};

const needsLogin = () => fail("unauthenticated", "Tenés que iniciar sesión");

export async function exportMyData(actor: Actor): Promise<ServiceResult<MyData>> {
  if (actor.kind !== "user") return needsLogin();
  const uid = actor.userId;
  try {
    const [me] = await db.select().from(userProfile).where(eq(userProfile.id, uid));
    if (!me) return fail("not_found", "Cuenta no encontrada");
    const [team] = await db.select({ agency: agency.name, role: agencyMember.role }).from(agencyMember)
      .innerJoin(agency, eq(agency.id, agencyMember.agencyId)).where(and(eq(agencyMember.userId, uid), eq(agencyMember.status, "active")));
    const inqs = await db.select({ property: property.title, message: inquiry.message, sentAt: inquiry.createdAt, status: inquiry.status })
      .from(inquiry).innerJoin(property, eq(property.id, inquiry.propertyId)).where(eq(inquiry.userId, uid));
    const reps = await db.select({ property: property.title, reason: propertyReport.reason, message: propertyReport.message, sentAt: propertyReport.createdAt, status: propertyReport.status })
      .from(propertyReport).innerJoin(property, eq(property.id, propertyReport.propertyId)).where(eq(propertyReport.userId, uid));
    return ok({
      generatedAt: new Date().toISOString(),
      account: { email: me.email, fullName: me.fullName, phone: me.phone, locale: me.locale, createdAt: me.createdAt.toISOString() },
      team: team ?? null,
      inquiries: inqs.map((i) => ({ ...i, sentAt: i.sentAt.toISOString() })),
      reports: reps.map((r) => ({ ...r, sentAt: r.sentAt.toISOString() })),
    });
  } catch (e) {
    return mapDbError(e);
  }
}

/**
 * Elimina la cuenta: anonimiza las consultas y denuncias que envió, deja el perfil sin datos personales
 * y deshabilitado (otras tablas lo referencian) y borra el usuario de Supabase Auth, todo en una transacción.
 * Quien integra el equipo de una inmobiliaria no puede: primero lo debe quitar el administrador.
 */
export async function deleteMyAccount(actor: Actor): Promise<ServiceResult<void>> {
  if (actor.kind !== "user") return needsLogin();
  if (actor.platformAdmin) return fail("conflict", "Una cuenta de administración de la plataforma no se elimina desde acá");
  const uid = actor.userId;
  try {
    return await db.transaction(async (tx) => {
      const [active] = await tx.select({ id: agencyMember.id }).from(agencyMember)
        .where(and(eq(agencyMember.userId, uid), eq(agencyMember.status, "active")));
      if (active) return fail("conflict", "Sos parte del equipo de una inmobiliaria");

      const [me] = await tx.select({ email: userProfile.email }).from(userProfile).where(eq(userProfile.id, uid));
      if (!me) return fail("not_found", "Cuenta no encontrada");
      const gone = `deleted-${uid}@invalid`;

      await tx.update(inquiry)
        .set({ name: "(eliminado)", email: "eliminado@invalid", phone: null, message: "(eliminado por la persona)", userId: null, ipHash: null })
        .where(eq(inquiry.userId, uid));
      await tx.update(propertyReport).set({ userId: null, reporterEmail: null, ipHash: null }).where(eq(propertyReport.userId, uid));
      await tx.update(propertyReport).set({ reporterEmail: null }).where(eq(propertyReport.reporterEmail, me.email));
      // invitaciones dirigidas a este email: se revocan las pendientes y se borra el email de las demás
      await tx.update(agencyInvitation).set({ status: "revoked" }).where(and(eq(agencyInvitation.email, me.email), eq(agencyInvitation.status, "pending")));
      await tx.update(agencyInvitation).set({ email: gone }).where(eq(agencyInvitation.email, me.email));
      await tx.update(userProfile)
        .set({ email: gone, fullName: null, phone: null, disabledAt: new Date() }).where(eq(userProfile.id, uid));
      await tx.update(agencyMember).set({ displayName: null, bio: null, photoUrl: null, publicPhone: null, publicWhatsapp: null, publicEmail: null })
        .where(eq(agencyMember.userId, uid));
      // En Supabase existe el esquema auth; en la base local de pruebas no.
      const [{ has }] = await tx.execute<{ has: boolean }>(sql`select to_regclass('auth.users') is not null as has`);
      if (has) await tx.execute(sql`delete from auth.users where id = ${uid}`);
      await tx.insert(auditLog).values({ action: "account.delete", entity: "user_profile", entityId: uid });
      return ok(undefined);
    });
  } catch (e) {
    return mapDbError(e);
  }
}
