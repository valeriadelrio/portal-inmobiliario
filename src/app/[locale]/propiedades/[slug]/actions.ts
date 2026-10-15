"use server";

import { revalidatePath } from "next/cache";
import { inquiryInput } from "@/contracts";
import { getDict, isLocale } from "@/i18n";
import { errorText, type ActionState } from "@/lib/form-state";
import { requestIpHash } from "@/lib/ip-hash";
import { getActor } from "@/server/auth/get-actor";
import { addFavorite, removeFavorite } from "@/server/services/favorite";
import { createInquiry } from "@/server/services/inquiry";

const s = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function inquiryAction(_prev: ActionState, f: FormData): Promise<ActionState> {
  const loc = s(f, "locale");
  const locale = isLocale(loc) ? loc : "es";
  const t = getDict(locale).inquiry;
  // campo trampa: las personas no lo ven; si viene completo es un bot (se responde "ok" sin guardar nada)
  if (s(f, "website")) return { ok: true, message: t.done };
  if (f.get("consent") !== "on") return { ok: false, message: t.needConsent };
  const parsed = inquiryInput.safeParse({
    propertyId: s(f, "propertyId"), name: s(f, "name"), email: s(f, "email"),
    phone: s(f, "phone") || undefined, message: s(f, "message"), locale, consent: true,
  });
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0]);
    const msg = ({ name: t.badName, email: t.badEmail, message: t.badMessage, phone: t.badPhone } as Record<string, string>)[field];
    return { ok: false, message: msg ?? errorText("validation") };
  }
  const r = await createInquiry(await getActor(), parsed.data, { ipHash: await requestIpHash() });
  if (!r.ok) {
    if (r.error.code === "not_found") return { ok: false, message: t.notAvailable };
    if (r.error.code === "rate_limited") return { ok: false, message: t.rateLimited };
    return { ok: false, message: locale === "es" ? errorText(r.error.code, r.error.message) : t.generic };
  }
  return { ok: true, message: t.done };
}

export async function toggleFavoriteAction(propertyId: string, makeFavorite: boolean): Promise<{ ok: boolean }> {
  const actor = await getActor();
  const r = makeFavorite ? await addFavorite(actor, propertyId) : await removeFavorite(actor, propertyId);
  if (r.ok) { revalidatePath("/cuenta/favoritos"); revalidatePath("/en/cuenta/favoritos"); }
  return { ok: r.ok };
}
