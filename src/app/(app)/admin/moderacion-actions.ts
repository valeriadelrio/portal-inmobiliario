"use server";

import { revalidatePath } from "next/cache";
import { invalidatePublic } from "@/server/cache/invalidate";
import { errorText, type ActionState } from "@/lib/form-state";
import { getActor } from "@/server/auth/get-actor";
import { moderateProperty, resolveReport } from "@/server/services/moderation";

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

function refresh() {
  revalidatePath("/admin", "layout"); // listas y aviso del menú
  revalidatePath("/panel/propiedades");
  invalidatePublic();
}

export async function resolveReportAction(_prev: ActionState, f: FormData): Promise<ActionState> {
  const action = s(f, "action");
  if (action !== "dismiss" && action !== "hide") return { ok: false, message: "Acción inválida." };
  const r = await resolveReport(await getActor(), s(f, "id"), action, s(f, "note") || undefined);
  if (!r.ok) {
    const msg = r.error.code === "invalid_transition" ? "Esa denuncia ya fue resuelta." : errorText(r.error.code, r.error.message);
    return { ok: false, message: msg };
  }
  refresh();
  return { ok: true, message: action === "hide" ? "Publicación ocultada." : "Denuncia descartada." };
}

export async function moderateAction(_prev: ActionState, f: FormData): Promise<ActionState> {
  const hide = s(f, "hide") === "1";
  const reason = s(f, "reason");
  if (hide && reason.length < 3) return { ok: false, message: "Escribí el motivo (mínimo 3 caracteres): lo ve la inmobiliaria." };
  const r = await moderateProperty(await getActor(), s(f, "id"), hide, reason || undefined);
  if (!r.ok) {
    const msg = r.error.code === "invalid_transition" ? "La publicación ya estaba en ese estado." : errorText(r.error.code, r.error.message);
    return { ok: false, message: msg };
  }
  refresh();
  return { ok: true, message: hide ? "Publicación ocultada." : "Publicación restituida." };
}
