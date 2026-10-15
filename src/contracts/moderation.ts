import { z } from "zod";
import type { ModerationStatus, ReportReason, ReportStatus } from "./enums";
import { REPORT_REASON } from "./enums";

export const reportInput = z.object({
  propertyId: z.string().uuid(),
  reason: z.enum(REPORT_REASON),
  message: z.string().trim().max(1000).optional(),
  /** Opcional: solo si quiere que la plataforma pueda contestarle. */
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
});
export type ReportInput = z.infer<typeof reportInput>;

/** Denuncia tal como la ve la administración de la plataforma. */
export type ReportDto = {
  id: string; propertyId: string; propertyTitle: string; propertySlug: string; agencyName: string;
  moderationStatus: ModerationStatus; reason: ReportReason; message: string | null; reporterEmail: string | null;
  status: ReportStatus; resolutionNote: string | null; createdAt: string;
  /** Cantidad de denuncias abiertas sobre la misma ficha. */
  openForProperty: number;
};

export type AuditEntryDto = {
  id: string; at: string; action: string; entity: string; entityId: string | null;
  detail: string | null; actorEmail: string | null; agencyName: string | null;
};

/** Ficha vista por la administración para moderar. */
export type ModerationPropertyDto = {
  id: string; slug: string; title: string; status: string; agencyName: string;
  moderationStatus: ModerationStatus; moderationReason: string | null; openReports: number;
};

export const MODERATION_PAGE_SIZE = 20;
