import { z } from "zod";
import { LOCALE, type InquiryStatus } from "./enums";

export const inquiryInput = z.object({
  propertyId: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email(),
  phone: z.string().trim().max(40).optional(),
  message: z.string().trim().min(10).max(2000),
  locale: z.enum(LOCALE),
  /** Consentimiento explícito (Ley 25.326). Obligatorio. */
  consent: z.literal(true),
});
export type InquiryInput = z.infer<typeof inquiryInput>;

/** Consulta tal como la ve el agente en su bandeja. */
export type InquiryDto = {
  id: string; propertyId: string; propertyTitle: string; propertySlug: string;
  name: string; email: string; phone: string | null; message: string;
  status: InquiryStatus; createdAt: string; agentName: string | null;
};

export const INQUIRY_PAGE_SIZE = 20;
