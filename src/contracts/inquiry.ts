import { z } from "zod";
import { LOCALE } from "./enums";

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
