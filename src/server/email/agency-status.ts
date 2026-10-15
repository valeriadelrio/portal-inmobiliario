import { siteUrl } from "@/lib/site";
import { escapeHtml, type Email } from ".";

type Status = "approved" | "rejected" | "suspended";

/** Aviso a los administradores de una inmobiliaria cuando la plataforma cambia su estado (con el motivo, si lo hay). */
export function buildAgencyStatusEmail(o: { to: string; agencyName: string; status: Status; reason?: string | null; wasSuspended?: boolean }): Email {
  const name = escapeHtml(o.agencyName);
  const reason = o.reason ? `<p><strong>Motivo:</strong> ${escapeHtml(o.reason)}</p>` : "";
  const panel = `<p><a href="${escapeHtml(siteUrl())}/panel">Ir a tu panel</a></p>`;
  const reply = `<p style="color:#64748b;font-size:12px">Si tenés dudas, respondé a este email.</p>`;
  if (o.status === "approved") {
    return {
      to: o.to,
      subject: o.wasSuspended ? `Tu inmobiliaria fue reactivada: ${o.agencyName}` : `Tu inmobiliaria fue aprobada: ${o.agencyName}`,
      html: `<p><strong>${name}</strong> ${o.wasSuspended ? "fue reactivada" : "fue aprobada"}. Ya podés ${o.wasSuspended ? "volver a publicar" : "invitar a tu equipo y publicar propiedades"}.</p>${panel}`,
    };
  }
  if (o.status === "suspended") {
    return {
      to: o.to, subject: `Tu inmobiliaria fue suspendida: ${o.agencyName}`,
      html: `<p><strong>${name}</strong> fue suspendida: sus propiedades dejaron de mostrarse en el sitio público.</p>${reason}${reply}`,
    };
  }
  return {
    to: o.to, subject: `No pudimos aprobar tu inmobiliaria: ${o.agencyName}`,
    html: `<p>No pudimos aprobar el alta de <strong>${name}</strong>.</p>${reason}${reply}`,
  };
}
