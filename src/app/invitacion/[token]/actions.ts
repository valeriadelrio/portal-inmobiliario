"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { errorText, type ActionState } from "@/lib/form-state";
import { getActor } from "@/server/auth/get-actor";
import { acceptInvitation } from "@/server/services/agency";

export async function acceptAction(token: string, _prev: ActionState, f: FormData): Promise<ActionState> {
  const actor = await getActor();
  const r = await acceptInvitation(actor, token, String(f.get("displayName") ?? ""));
  if (!r.ok) return { ok: false, message: errorText(r.error.code, r.error.message) };
  revalidatePath("/", "layout"); // el rol cambió: refresca el avatar del encabezado y el menú
  redirect("/panel/agencia");
}
