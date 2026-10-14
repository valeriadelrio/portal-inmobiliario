import type { Actor } from "@/contracts";

export function roleLabel(actor: Actor): string {
  if (actor.kind === "anonymous") return "anónimo";
  if (actor.platformAdmin) return "Administradora de la plataforma";
  if (actor.membership) return actor.membership.role === "agency_admin" ? "Administrador de agencia" : "Agente";
  return "Visitante";
}

/** Iniciales para el avatar: del nombre si existe, si no de la parte local del email. */
export function initials(name: string | null, email: string): string {
  const source = (name?.trim() || email.split("@")[0]).replace(/[^\p{L}\p{N} ]/gu, " ").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : source.slice(0, 2);
  return (letters || "?").toUpperCase();
}
