export type Email = { to: string; subject: string; html: string };

/**
 * Sin RESEND_API_KEY escribe en consola (desarrollo). Con la clave usará Resend: se conecta cuando
 * hagan falta emails reales (consultas, H4). Devuelve si realmente se envió.
 */
export async function sendEmail(mail: Email): Promise<{ sent: boolean }> {
  if (!process.env.RESEND_API_KEY) {
    console.info(`[email:dev] a ${mail.to} — ${mail.subject}`);
    return { sent: false };
  }
  throw new Error("Envío real con Resend: pendiente de implementar (H4)");
}
