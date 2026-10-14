/** Enlace wa.me al número público del agente. Devuelve null si el número no es válido (solo dígitos, con código de país). */
export function whatsappUrl(number: string | null | undefined, message: string): string | null {
  const digits = (number ?? "").replace(/\D/g, "");
  if (!/^\d{8,15}$/.test(digits)) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
