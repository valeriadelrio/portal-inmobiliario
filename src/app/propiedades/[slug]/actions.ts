"use server";

import { revalidatePath } from "next/cache";
import { inquiryInput } from "@/contracts";
import { errorText, type ActionState } from "@/lib/form-state";
import { requestIpHash } from "@/lib/ip-hash";
import { getActor } from "@/server/auth/get-actor";
import { addFavorite, removeFavorite } from "@/server/services/favorite";
import { createInquiry } from "@/server/services/inquiry";

const s = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function inquiryAction(_prev: ActionState, f: FormData): Promise<ActionState> {
  // campo trampa: las personas no lo ven; si viene completo es un bot (se responde "ok" sin guardar nada)
  if (s(f, "website")) return { ok: true, message: "¡Listo! Tu consulta fue enviada." };
  const consent = f.get("consent") === "on";
  if (!consent) return { ok: false, message: "Para enviar la consulta tenés que aceptar el uso de tus datos." };
  const parsed = inquiryInput.safeParse({
    propertyId: s(f, "propertyId"), name: s(f, "name"), email: s(f, "email"),
    phone: s(f, "phone") || undefined, message: s(f, "message"), locale: "es", consent: true,
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    const msg = { name: "Ingresá tu nombre (mínimo 2 letras).", email: "Ingresá un email válido.", message: "Escribí tu consulta (mínimo 10 caracteres).", phone: "El teléfono es demasiado largo." }[String(field)];
    return { ok: false, message: msg ?? errorText("validation") };
  }
  const r = await createInquiry(await getActor(), parsed.data, { ipHash: await requestIpHash() });
  if (!r.ok) {
    if (r.error.code === "not_found") return { ok: false, message: "Esta propiedad ya no está disponible para consultas." };
    if (r.error.code === "rate_limited") return { ok: false, message: "Enviaste varias consultas seguidas. Probá de nuevo en un rato." };
    return { ok: false, message: errorText(r.error.code, r.error.message) };
  }
  return { ok: true, message: "¡Listo! Tu consulta fue enviada. La inmobiliaria te va a responder por email o teléfono." };
}

export async function toggleFavoriteAction(propertyId: string, makeFavorite: boolean): Promise<{ ok: boolean }> {
  const actor = await getActor();
  const r = makeFavorite ? await addFavorite(actor, propertyId) : await removeFavorite(actor, propertyId);
  if (r.ok) revalidatePath("/cuenta/favoritos");
  return { ok: r.ok };
}
