/** Resultado uniforme de los servicios: nunca lanzan por errores de negocio. */
export const ERROR_CODES = [
  "forbidden", "not_found", "validation", "conflict", "in_use", "unauthenticated",
  // reglas de negocio señaladas por la base (RAISE EXCEPTION '<codigo>')
  "already_member", "slug_taken", "invalid_slug", "rate_limited", "invalid_transition", "publish_blocked",
  "immutable_field", "zone_inactive", "zone_depth", "wrong_type", "max_photos", "invitation_invalid",
  "last_admin", "reassign_required",
  // otros
  "storage", "not_implemented", "unexpected",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export type ServiceError = { code: ErrorCode; message: string; fields?: Record<string, string> };
export type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: ServiceError };

export const ok = <T>(data: T): ServiceResult<T> => ({ ok: true, data });
export const fail = (code: ErrorCode, message: string = code, fields?: Record<string, string>): ServiceResult<never> => ({
  ok: false,
  error: { code, message, fields },
});

const KNOWN = new Set<string>(ERROR_CODES);

/**
 * Traduce un error de Postgres/Drizzle a un código de negocio.
 * - P0001 (RAISE EXCEPTION): el mensaje es el código.
 * - 42501 permiso denegado / RLS -> forbidden; 23505 -> conflict; 23503 -> in_use; 23514 (CHECK) -> validation.
 */
export function mapDbError(e: unknown): ServiceResult<never> {
  const err = e as { code?: string; message?: string; cause?: { code?: string; message?: string } };
  const code = err?.cause?.code ?? err?.code;
  const message = err?.cause?.message ?? err?.message ?? "unexpected";
  if (code === "P0001" && KNOWN.has(message)) return fail(message as ErrorCode);
  if (code === "42501") return fail("forbidden", message);
  if (code === "23505") return fail("conflict", message);
  if (code === "23503") return fail("in_use", message);
  if (code === "23514") return fail("validation", message);
  return fail("unexpected", message);
}

export function notImplemented(name: string): ServiceResult<never> {
  return fail("not_implemented", `${name} todavía no está implementado`);
}
