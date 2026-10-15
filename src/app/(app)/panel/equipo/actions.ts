"use server";

import { revalidatePath } from "next/cache";
import { invalidatePublic } from "@/server/cache/invalidate";
import { inviteMemberInput } from "@/contracts";
import { errorText, type ActionState } from "@/lib/form-state";
import { getActor } from "@/server/auth/get-actor";
import { buildInvitationEmail } from "@/server/email/invitation";
import { sendEmail } from "@/server/email";
import { getMyAgencyDetail, inviteMember, listInvitations, removeMember, revokeInvitation, setMemberRole } from "@/server/services/agency";

const s = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function inviteAction(_prev: ActionState, f: FormData): Promise<ActionState> {
  const actor = await getActor();
  const parsed = inviteMemberInput.safeParse({ email: s(f, "email"), role: s(f, "role") || "agent" });
  if (!parsed.success) return { ok: false, message: "Ingresá un email válido." };
  const r = await inviteMember(actor, parsed.data);
  if (!r.ok) return { ok: false, message: errorText(r.error.code, r.error.message) };
  revalidatePath("/panel/equipo");
  invalidatePublic();
  // el token crudo solo existe ahora: el email se manda acá. Si no se puede enviar, queda el enlace para copiar.
  const detail = await getMyAgencyDetail(actor);
  const agencyName = detail.ok && detail.data ? detail.data.agency.name : "una inmobiliaria";
  const { sent } = await sendEmail(buildInvitationEmail({ to: parsed.data.email, agencyName, role: parsed.data.role, link: r.data.link }));
  return {
    ok: true,
    message: sent
      ? `Enviamos la invitación a ${parsed.data.email}. También podés copiar el enlace por si no le llega (vence en 7 días).`
      : "Invitación creada, pero no se pudo enviar el email. Copiá el enlace y enviáselo a la persona (vence en 7 días).",
    link: r.data.link,
  };
}

/** Reenviar = revocar la invitación vieja (si sigue pendiente) y crear una nueva con el mismo email y rol: el token viejo no se guarda, no se puede reenviar tal cual. */
export async function resendAction(_prev: ActionState, f: FormData): Promise<ActionState> {
  const actor = await getActor();
  const list = await listInvitations(actor);
  if (!list.ok) return { ok: false, message: errorText(list.error.code, list.error.message) };
  const old = list.data.find((i) => i.id === s(f, "id"));
  if (!old) return { ok: false, message: errorText("not_found") };
  if (old.status === "accepted") return { ok: false, message: "Esa invitación ya fue aceptada." };
  if (old.status === "pending") {
    const rv = await revokeInvitation(actor, old.id);
    if (!rv.ok) return { ok: false, message: errorText(rv.error.code, rv.error.message) };
  }
  const r = await inviteMember(actor, { email: old.email, role: old.role === "agency_admin" ? "agency_admin" : "agent" });
  if (!r.ok) return { ok: false, message: errorText(r.error.code, r.error.message) };
  revalidatePath("/panel/equipo");
  const detail = await getMyAgencyDetail(actor);
  const agencyName = detail.ok && detail.data ? detail.data.agency.name : "una inmobiliaria";
  const { sent } = await sendEmail(buildInvitationEmail({ to: old.email, agencyName, role: old.role, link: r.data.link }));
  return {
    ok: true,
    message: sent ? `Reenviamos la invitación a ${old.email}.` : "Invitación nueva creada, pero no se pudo enviar el email. Copiá el enlace.",
    link: r.data.link,
  };
}

export async function revokeAction(_prev: ActionState, f: FormData): Promise<ActionState> {
  const r = await revokeInvitation(await getActor(), s(f, "id"));
  if (!r.ok) return { ok: false, message: errorText(r.error.code, r.error.message) };
  revalidatePath("/panel/equipo");
  invalidatePublic();
  return { ok: true, message: "Invitación revocada." };
}

export async function roleAction(_prev: ActionState, f: FormData): Promise<ActionState> {
  const role = s(f, "role") === "agency_admin" ? "agency_admin" : "agent";
  const r = await setMemberRole(await getActor(), s(f, "memberId"), role);
  if (!r.ok) return { ok: false, message: errorText(r.error.code, r.error.message) };
  revalidatePath("/panel/equipo");
  invalidatePublic();
  return { ok: true, message: "Rol actualizado." };
}

export async function removeAction(_prev: ActionState, f: FormData): Promise<ActionState> {
  const r = await removeMember(await getActor(), s(f, "memberId"), s(f, "reassignTo") || undefined);
  if (!r.ok) return { ok: false, message: errorText(r.error.code, r.error.message) };
  revalidatePath("/panel/equipo");
  invalidatePublic();
  return { ok: true, message: "Miembro dado de baja." };
}
