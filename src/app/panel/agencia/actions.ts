"use server";

import { revalidatePath } from "next/cache";
import { memberProfileInput, updateAgencyInput } from "@/contracts";
import { errorText, type ActionState } from "@/lib/form-state";
import { getActor } from "@/server/auth/get-actor";
import { updateAgency, updateMemberProfile } from "@/server/services/agency";

const t = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || undefined;

export async function saveAgency(_prev: ActionState, f: FormData): Promise<ActionState> {
  const actor = await getActor();
  const parsed = updateAgencyInput.safeParse({
    name: t(f, "name"), description: t(f, "description"), phone: t(f, "phone"), email: t(f, "email"),
    website: t(f, "website"), address: t(f, "address"), logoUrl: t(f, "logoUrl"),
  });
  if (!parsed.success) return { ok: false, message: "Revisá los datos (el sitio web y el logo deben ser enlaces completos, con https://)." };
  const r = await updateAgency(actor, parsed.data);
  if (!r.ok) return { ok: false, message: errorText(r.error.code, r.error.message) };
  revalidatePath("/panel/agencia");
  return { ok: true, message: "Datos de la inmobiliaria guardados." };
}

export async function saveMyProfile(_prev: ActionState, f: FormData): Promise<ActionState> {
  const actor = await getActor();
  const whatsapp = (t(f, "publicWhatsapp") ?? "").replace(/[\s+()-]/g, "") || undefined;
  const parsed = memberProfileInput.safeParse({
    displayName: t(f, "displayName"), bio: t(f, "bio"), photoUrl: t(f, "photoUrl"), publicPhone: t(f, "publicPhone"),
    publicWhatsapp: whatsapp, publicEmail: t(f, "publicEmail"),
  });
  if (!parsed.success) return { ok: false, message: "Revisá los datos. El WhatsApp va con código de país y solo números (ej. 5492494123456)." };
  const r = await updateMemberProfile(actor, parsed.data);
  if (!r.ok) return { ok: false, message: errorText(r.error.code, r.error.message) };
  revalidatePath("/panel/agencia");
  return { ok: true, message: "Tu perfil público quedó guardado." };
}
