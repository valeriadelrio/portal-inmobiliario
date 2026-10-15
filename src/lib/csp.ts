/**
 * Política de contenido (CSP) y cabeceras de seguridad. Se arma aquí (y no a mano en next.config) para poder probarla.
 *
 * Sin nonce a propósito: un nonce obliga a renderizar TODAS las páginas por pedido y anula el cacheo de las fichas
 * (cacheComponents). Por eso `script-src` admite 'unsafe-inline' (los scripts de arranque de Next); igual se bloquean
 * orígenes externos de scripts, objetos, <base>, formularios hacia otros sitios y el embebido en otros sitios.
 * Pendiente (opcional): pasar a hashes con `experimental.sri` cuando salga de experimental.
 */
export type CspEnv = {
  dev?: boolean;
  supabaseUrl?: string;
  /** Origen de las fotos (CDN/R2 público), p. ej. "https://media.midominio.com". Vacío = mismo origen (/media). */
  mediaBaseUrl?: string;
  /** Origen donde el navegador sube las fotos con URL firmada (R2). Vacío = mismo origen. */
  uploadOrigin?: string;
};

const origin = (url?: string): string | null => {
  if (!url) return null;
  try {
    const u = new URL(url, "http://x.invalid");
    return u.hostname === "x.invalid" ? null : u.origin;
  } catch {
    return null;
  }
};

export function buildCsp(env: CspEnv = {}): string {
  const media = origin(env.mediaBaseUrl);
  const extra = (...xs: (string | null)[]) => xs.filter(Boolean).join(" ");
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${env.dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${extra("'self'", "data:", "blob:", media)}`,
    "font-src 'self' data:",
    `connect-src ${extra("'self'", origin(env.supabaseUrl), media, origin(env.uploadOrigin), env.dev ? "ws:" : null)}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (!env.dev) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

export function securityHeaders(env: CspEnv = {}): { key: string; value: string }[] {
  const headers = [
    { key: "Content-Security-Policy", value: buildCsp(env) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ];
  if (!env.dev) headers.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" });
  return headers;
}
