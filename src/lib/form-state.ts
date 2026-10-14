/** Estado que devuelven las Server Actions a los formularios (useActionState). */
export type ActionState = { ok: boolean; message: string; link?: string } | null;

const TEXTS: Record<string, string> = {
  unauthenticated: "Tenés que iniciar sesión.",
  forbidden: "No tenés permiso para hacer esto.",
  not_found: "No se encontró lo que buscás.",
  conflict: "Ya existe un registro igual.",
  already_member: "Ya sos parte de una inmobiliaria (en esta versión, una sola por persona).",
  slug_taken: "Ese nombre de dirección ya está en uso. Probá con otro.",
  invalid_slug: "La dirección solo puede tener minúsculas, números y guiones, y no puede ser una palabra reservada.",
  rate_limited: "Hiciste demasiados intentos. Probá de nuevo mañana.",
  invalid_transition: "Ese cambio de estado no está permitido.",
  invitation_invalid: "La invitación no es válida: venció, fue revocada, ya se usó o es para otro email.",
  last_admin: "La inmobiliaria necesita al menos un administrador activo.",
  reassign_required: "Esa persona tiene propiedades o consultas: elegí a quién reasignarlas.",
  validation: "Revisá los datos del formulario.",
};

export function errorText(code: string, message?: string): string {
  if (code === "conflict" && message && message.startsWith("Ya hay")) return message;
  return TEXTS[code] ?? "Ocurrió un error inesperado.";
}
