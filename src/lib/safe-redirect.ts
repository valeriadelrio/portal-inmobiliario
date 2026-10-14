/** Solo rutas internas ("/panel", "/invitacion/x"); rechaza "//evil.com", "/\evil.com", "https://..." y vacíos. */
export function safeNext(next: string | null | undefined, fallback = "/panel"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\") || /[\u0000-\u001f]/.test(next)) return fallback;
  return next;
}
