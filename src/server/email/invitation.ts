import { siteUrl } from "@/lib/site";
import { escapeHtml, type Email } from ".";

const ROLE = { agent: "agente", agency_admin: "administrador" } as Record<string, string>;

/** Email con el enlace personal de la invitación. `link` es la ruta relativa (`/invitacion/<token>`). */
export function buildInvitationEmail(o: { to: string; agencyName: string; role: string; link: string }): Email {
  const url = `${siteUrl()}${o.link}`;
  return {
    to: o.to,
    subject: `Te invitaron a ${o.agencyName} en el portal`,
    html: `<p>Te invitaron a sumarte a <strong>${escapeHtml(o.agencyName)}</strong> como ${escapeHtml(ROLE[o.role] ?? o.role)}.</p>
<p><a href="${escapeHtml(url)}">Aceptar la invitación</a></p>
<p>Tenés que ingresar (o crear tu cuenta) con este mismo email: <strong>${escapeHtml(o.to)}</strong>. El enlace es personal, se puede usar una sola vez y vence en 7 días.</p>
<p style="color:#64748b;font-size:12px">Si no esperabas esta invitación, ignorá este mensaje.</p>`,
  };
}
