export type Email = { to: string; subject: string; html: string; replyTo?: string };

/**
 * Sin RESEND_API_KEY escribe en consola (desarrollo) y devuelve `sent: false`.
 * Con la clave envía por la API de Resend (EMAIL_FROM = remitente verificado, p. ej. "TERRAE <avisos@tudominio.com>").
 * Nunca lanza: un email caído no debe perder la consulta, que queda guardada en la bandeja.
 */
export async function sendEmail(mail: Email): Promise<{ sent: boolean }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info(`[email:dev] a ${mail.to} — ${mail.subject}`);
    return { sent: false };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "TERRAE <onboarding@resend.dev>",
        to: [mail.to], subject: mail.subject, html: mail.html, reply_to: mail.replyTo,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error(`[email] Resend respondió ${res.status}`);
    return { sent: res.ok };
  } catch (e) {
    console.error("[email] fallo de envío", e instanceof Error ? e.name : "error");
    return { sent: false };
  }
}

export const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
