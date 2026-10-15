import { and, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { auditLog, inquiry, propertyPhoto, propertyReport } from "@/server/db/schema";
import { getStorage } from "@/server/storage";

// H6. Tareas de mantenimiento (las dispara un cron, sin usuario): usan el rol dueño porque actúan sobre todas las
// inmobiliarias y sobre datos que RLS oculta a propósito. Cada tarea es idempotente y devuelve cuánto cambió.

const DAY = 24 * 60 * 60 * 1000;
const ago = (ms: number) => new Date(Date.now() - ms);

/** Subidas de fotos que nunca se confirmaron: ocupan un lugar del máximo de 30 y objetos en el almacenamiento. */
export async function purgeAbandonedUploads(olderThanHours = 24): Promise<number> {
  const stale = await db.select({ id: propertyPhoto.id, key: propertyPhoto.storageKey }).from(propertyPhoto)
    .where(and(eq(propertyPhoto.status, "pending"), lt(propertyPhoto.createdAt, ago(olderThanHours * 60 * 60 * 1000))))
    .limit(500);
  if (!stale.length) return 0;
  const storage = await getStorage();
  for (const s of stale) await storage.deletePrefix(s.key).catch(() => undefined);
  const gone = await db.delete(propertyPhoto)
    .where(and(inArray(propertyPhoto.id, stale.map((s) => s.id)), eq(propertyPhoto.status, "pending")))
    .returning({ id: propertyPhoto.id });
  return gone.length;
}

/**
 * Minimización de datos personales (Ley 25.326): la huella de IP solo sirve para limitar abusos en la última hora,
 * así que se borra a los 30 días; el email del denunciante, al año de resuelta la denuncia.
 */
export async function scrubShortLivedData(): Promise<number> {
  const a = await db.update(inquiry).set({ ipHash: null })
    .where(and(isNotNull(inquiry.ipHash), lt(inquiry.createdAt, ago(30 * DAY)))).returning({ id: inquiry.id });
  const b = await db.update(propertyReport).set({ ipHash: null })
    .where(and(isNotNull(propertyReport.ipHash), lt(propertyReport.createdAt, ago(30 * DAY)), sql`status <> 'open'`)).returning({ id: propertyReport.id });
  const c = await db.update(propertyReport).set({ reporterEmail: null })
    .where(and(isNotNull(propertyReport.reporterEmail), lt(propertyReport.resolvedAt, ago(365 * DAY)))).returning({ id: propertyReport.id });
  return a.length + b.length + c.length;
}

/**
 * Consultas viejas: se anonimizan los datos del visitante (nombre, email, teléfono, mensaje) pero queda la fila
 * (fecha, propiedad, estado) para las estadísticas de la inmobiliaria. Plazo por defecto: 24 meses.
 */
export async function anonymizeOldInquiries(months = Number(process.env.INQUIRY_RETENTION_MONTHS) || 24): Promise<number> {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const rows = await db.update(inquiry)
    .set({ name: "(eliminado)", email: "eliminado@invalid", phone: null, message: "(eliminado por antigüedad)", userId: null, ipHash: null })
    .where(and(lt(inquiry.createdAt, cutoff), sql`${inquiry.email} <> 'eliminado@invalid'`)).returning({ id: inquiry.id });
  return rows.length;
}

export type MaintenanceResult = { abandonedUploads: number; scrubbed: number; anonymizedInquiries: number };

export async function runMaintenance(): Promise<MaintenanceResult> {
  const result = {
    abandonedUploads: await purgeAbandonedUploads(),
    scrubbed: await scrubShortLivedData(),
    anonymizedInquiries: await anonymizeOldInquiries(),
  };
  if (Object.values(result).some((n) => n > 0)) {
    await db.insert(auditLog).values({ action: "maintenance.run", entity: "system", detail: JSON.stringify(result) });
  }
  return result;
}
