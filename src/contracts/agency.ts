import { z } from "zod";
import { MEMBER_ROLE } from "./enums";

/** Debe coincidir con la lista de app_register_agency (db/migrations/0003). */
export const RESERVED_SLUGS = [
  "admin", "panel", "login", "api", "es", "en", "registro", "registro-agencia", "invitacion",
  "inmobiliarias", "propiedades", "cuenta", "buscar", "static", "_next",
] as const;

export const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(60)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Solo minúsculas, números y guiones")
  .refine((s) => !(RESERVED_SLUGS as readonly string[]).includes(s), "Nombre reservado");

export const registerAgencyInput = z.object({
  name: z.string().trim().min(2).max(120),
  slug: slugSchema,
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().email().optional(),
  displayName: z.string().trim().min(2).max(100),
});
export type RegisterAgencyInput = z.infer<typeof registerAgencyInput>;

export const updateAgencyInput = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().email().optional(),
  website: z.string().trim().url().optional(),
  address: z.string().trim().max(200).optional(),
  logoUrl: z.string().trim().url().optional(),
});
export type UpdateAgencyInput = z.infer<typeof updateAgencyInput>;

export const inviteMemberInput = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(MEMBER_ROLE).default("agent"),
});
export type InviteMemberInput = z.infer<typeof inviteMemberInput>;

export const acceptInvitationInput = z.object({
  token: z.string().min(20).max(200),
  displayName: z.string().trim().min(2).max(100),
});

export const memberProfileInput = z.object({
  displayName: z.string().trim().min(2).max(100),
  bio: z.string().trim().max(1000).optional(),
  photoUrl: z.string().trim().url().optional(),
  publicPhone: z.string().trim().max(40).optional(),
  /** Número en formato internacional, solo dígitos (ej. 5492494123456) para wa.me */
  publicWhatsapp: z.string().trim().regex(/^\d{8,15}$/, "Solo dígitos, con código de país").optional(),
  publicEmail: z.string().trim().email().optional(),
});
export type MemberProfileInput = z.infer<typeof memberProfileInput>;

export type AgencyPublicDto = {
  id: string; slug: string; name: string; description: string | null; logoUrl: string | null;
  phone: string | null; email: string | null; website: string | null; address: string | null;
};
export type MemberPublicDto = {
  id: string; displayName: string | null; bio: string | null; photoUrl: string | null;
  publicPhone: string | null; publicWhatsapp: string | null; publicEmail: string | null;
};
export type MyAgencyDto = {
  agencyId: string; name: string; slug: string; status: string; statusReason: string | null;
  role: string; memberId: string;
};
