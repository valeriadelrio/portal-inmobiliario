/**
 * Registro de errores del servidor, en una línea JSON (Vercel → Logs permite filtrar y alertar por `"level":"error"`).
 * Sin datos personales: usa la ruta con parámetros (`/invitacion/[token]`, nunca la URL real, que puede llevar un token),
 * ni cabeceras ni cuerpo, y recorta el mensaje (los errores de Postgres pueden citar valores).
 */
export type RequestErrorContext = { routePath?: string; routeType?: string; renderSource?: string };

export function formatRequestError(err: unknown, request: { method?: string }, context: RequestErrorContext = {}) {
  const e = err as { name?: string; message?: string; digest?: string; code?: string; cause?: { code?: string } } | null;
  return {
    level: "error",
    at: new Date().toISOString(),
    route: context.routePath ?? "?",
    type: context.routeType ?? "?",
    source: context.renderSource,
    method: request.method,
    name: e?.name ?? typeof err,
    code: e?.code ?? e?.cause?.code,
    digest: e?.digest,
    message: String(e?.message ?? err).replace(/\s+/g, " ").slice(0, 200),
  };
}
