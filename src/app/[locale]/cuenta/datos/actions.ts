"use server";

import { revalidatePath } from "next/cache";
import { getDict, isLocale } from "@/i18n";
import type { ActionState } from "@/lib/form-state";
import { getActor } from "@/server/auth/get-actor";
import { getProfileSummary } from "@/server/auth/get-profile";
import { deleteMyAccount } from "@/server/services/account";

/** Elimina la cuenta de quien está logueado, tras confirmar su email. La sesión la cierra el navegador al recibir el "ok". */
export async function deleteAccountAction(_prev: ActionState, f: FormData): Promise<ActionState> {
  const loc = String(f.get("locale") ?? "");
  const t = getDict(isLocale(loc) ? loc : "es").account;
  const actor = await getActor();
  if (actor.kind !== "user") return { ok: false, message: t.failed };
  const profile = await getProfileSummary(actor.userId);
  const typed = String(f.get("email") ?? "").trim().toLowerCase();
  if (!profile || typed !== profile.email.toLowerCase()) return { ok: false, message: t.wrongEmail };
  const r = await deleteMyAccount(actor);
  if (!r.ok) return { ok: false, message: r.error.code === "conflict" ? t.memberBlocked : t.failed };
  revalidatePath("/", "layout");
  return { ok: true, message: "" };
}
